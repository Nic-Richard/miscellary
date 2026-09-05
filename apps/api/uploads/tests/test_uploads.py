import boto3
import pytest
from django.conf import settings
from django.urls import reverse
from moto import mock_aws

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
    assert body["image"]["ready"] is False
    image = Image.objects.get(id=body["image"]["id"])
    assert image.key.startswith("card/") and image.key.endswith(".png")

    # Completing before the object exists fails.
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
    from conftest import make_user

    other = make_user()
    image = Image.objects.create(
        owner=other, kind="card", key="card/x.jpg", content_type="image/jpeg"
    )
    response = auth_client.post(
        reverse("uploads:complete", args=[image.id]), {"width": 1, "height": 1}, format="json"
    )
    assert response.status_code == 404
