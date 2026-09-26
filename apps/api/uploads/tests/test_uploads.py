from urllib.parse import parse_qs, urlsplit

import boto3
import pytest
from django.conf import settings
from django.urls import reverse
from moto import mock_aws

from conftest import make_user
from uploads import storage
from uploads.models import Image

pytestmark = pytest.mark.django_db


@pytest.fixture
def bucket():
    with mock_aws():
        s3 = boto3.client("s3", region_name=settings.AWS_S3_REGION)
        s3.create_bucket(Bucket=settings.AWS_STORAGE_BUCKET_NAME)
        yield s3


def test_upload_flow(auth_client, user, bucket):
    response = auth_client.post(
        reverse("uploads:create"), {"kind": "card", "content_type": "image/png"}, format="json"
    )
    assert response.status_code == 201
    body = response.json()
    assert body["upload_url"].startswith("https://")
    signed_headers = parse_qs(urlsplit(body["upload_url"]).query)["X-Amz-SignedHeaders"][0]
    assert "cache-control" in signed_headers
    assert body["image"]["ready"] is False
    image = Image.objects.get(id=body["image"]["id"])
    assert image.key.startswith("card/") and image.key.endswith(".png")

    complete = reverse("uploads:complete", args=[image.id])
    response = auth_client.post(complete, {"width": 800, "height": 600}, format="json")
    assert response.status_code == 400

    bucket.put_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=image.key, Body=b"x" * 123)
    response = auth_client.post(complete, {"width": 800, "height": 600}, format="json")
    assert response.status_code == 200
    assert response.json()["ready"] is True
    assert response.json()["url"] == f"{settings.MEDIA_PUBLIC_URL}/{image.key}"
    image.refresh_from_db()
    assert image.size == 123 and image.width == 800


def test_rejects_unknown_types(auth_client):
    response = auth_client.post(
        reverse("uploads:create"), {"kind": "card", "content_type": "image/gif"}, format="json"
    )
    assert response.status_code == 400
    assert "content_type" in response.json()["fields"]


def test_oversized_upload_completion_removes_object_and_record(auth_client, bucket):
    response = auth_client.post(
        reverse("uploads:create"), {"kind": "card", "content_type": "image/jpeg"}, format="json"
    )
    image = Image.objects.get(id=response.json()["image"]["id"])
    bucket.put_object(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key=image.key,
        Body=b"x" * (storage.MAX_SIZE + 1),
    )

    response = auth_client.post(
        reverse("uploads:complete", args=[image.id]), {"width": 800, "height": 600}, format="json"
    )

    assert response.status_code == 400
    assert not Image.objects.filter(id=image.id).exists()
    objects = bucket.list_objects_v2(Bucket=settings.AWS_STORAGE_BUCKET_NAME).get("Contents", [])
    assert all(obj["Key"] != image.key for obj in objects)


def test_cannot_complete_someone_elses_upload(auth_client, bucket):
    other = make_user()
    image = Image.objects.create(
        owner=other, kind="card", key="card/x.jpg", content_type="image/jpeg"
    )
    response = auth_client.post(
        reverse("uploads:complete", args=[image.id]), {"width": 1, "height": 1}, format="json"
    )
    assert response.status_code == 404


def test_credit_publishes_only_the_attribution_fields():
    from uploads.serializers import ImageSerializer

    image = Image(
        kind="card",
        key="card/credited.jpg",
        content_type="image/jpeg",
        source_metadata={
            "source_url": "https://commons.wikimedia.org/wiki/File:Example.jpg",
            "author": "Example photographer",
            "license": "CC BY-SA 4.0",
            "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
            "adaptation": "Cropped by the card renderer from the downloaded source.",
            "internal_note": "not for publication",
        },
    )
    credit = ImageSerializer(image).data["credit"]
    assert credit == {
        "author": "Example photographer",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "source_url": "https://commons.wikimedia.org/wiki/File:Example.jpg",
    }


def test_credit_is_absent_when_nobody_is_named():
    from uploads.serializers import ImageSerializer

    bare = Image(kind="card", key="card/bare.jpg", content_type="image/jpeg")
    assert ImageSerializer(bare).data["credit"] is None
    blank = Image(
        kind="card",
        key="card/blank.jpg",
        content_type="image/jpeg",
        source_metadata={"author": "   ", "license": "CC0"},
    )
    assert ImageSerializer(blank).data["credit"] is None


def test_presigned_host_follows_the_caller_in_development(settings):
    settings.DEBUG = True
    settings.AWS_S3_PUBLIC_ENDPOINT_URL = "http://localhost:9000"
    assert storage.public_endpoint_for("10.0.0.84:8000") == "http://10.0.0.84:9000"
    assert storage.public_endpoint_for("localhost:8000") == "http://localhost:9000"
    assert storage.public_endpoint_for("127.0.0.1:8000") == "http://localhost:9000"
    assert storage.public_endpoint_for(None) == "http://localhost:9000"


def test_presigned_host_is_pinned_outside_development(settings):
    settings.DEBUG = False
    settings.AWS_S3_PUBLIC_ENDPOINT_URL = "https://media.example.com"
    assert storage.public_endpoint_for("10.0.0.84:8000") == "https://media.example.com"
    settings.AWS_S3_PUBLIC_ENDPOINT_URL = ""
    assert storage.public_endpoint_for("10.0.0.84:8000") == ""


def test_server_uploads_are_immutable(bucket):
    storage.put_object("renders/example.webp", b"render", "image/webp")
    stored = bucket.head_object(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key="renders/example.webp",
    )
    assert stored["CacheControl"] == storage.CACHE_CONTROL


def test_source_urls_are_signed_in_production(settings, bucket):
    settings.MEDIA_SOURCE_URLS_SIGNED = True
    url = storage.object_url("card/private-source.webp")
    query = parse_qs(urlsplit(url).query)
    assert query["X-Amz-Expires"] == [str(storage.SOURCE_URL_SECONDS)]
    assert "X-Amz-Signature" in query


def _image(owner) -> Image:
    return Image.objects.create(
        owner=owner, kind=Image.Kind.CARD, key=f"card/{owner.pk}.jpg", content_type="image/jpeg"
    )


def test_credit_names_the_source_and_its_licence(auth_client, user):
    image = _image(user)
    url = reverse("uploads:credit", args=[image.id])
    response = auth_client.patch(
        url,
        {"licence": "cc-by", "author": " Ada Lens ", "source_url": "https://example.com/p/1"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["credit"] == {
        "author": "Ada Lens",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "source_url": "https://example.com/p/1",
    }

    own = auth_client.patch(url, {"licence": "own"}, format="json")
    assert own.status_code == 200
    assert own.json()["credit"] is None


def test_credit_needs_a_name_unless_the_photo_is_your_own(auth_client, user):
    image = _image(user)
    response = auth_client.patch(
        reverse("uploads:credit", args=[image.id]), {"licence": "permission"}, format="json"
    )
    assert response.status_code == 400
    assert "author" in response.json()["fields"]


def test_only_the_owner_can_credit_a_photo(auth_client):
    image = _image(make_user())
    response = auth_client.patch(
        reverse("uploads:credit", args=[image.id]),
        {"licence": "cc-by", "author": "Someone"},
        format="json",
    )
    assert response.status_code == 404
