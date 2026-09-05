import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings

ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_SIZE = 10 * 1024 * 1024
PRESIGN_SECONDS = 600


def client(*, public: bool = False):
    """An S3 client. `public` signs against the endpoint the browser can reach."""
    endpoint = settings.AWS_S3_ENDPOINT_URL
    if public and settings.AWS_S3_PUBLIC_ENDPOINT_URL:
        endpoint = settings.AWS_S3_PUBLIC_ENDPOINT_URL
    return boto3.client(
        "s3",
        endpoint_url=endpoint or None,
        region_name=settings.AWS_S3_REGION,
        # Empty in production: the App Runner instance role provides credentials.
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        # SigV4 is required by newer AWS regions; MinIO supports it too.
        config=Config(signature_version="s3v4"),
    )


def new_key(kind: str, content_type: str) -> str:
    return f"{kind}/{uuid.uuid4().hex}.{ALLOWED_TYPES[content_type]}"


def presigned_put_url(key: str, content_type: str) -> str:
    # Signed for the public endpoint: SigV4 covers the host, so the signature
    # only matches if the browser sends the request to the same one.
    return client(public=True).generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=PRESIGN_SECONDS,
    )


def object_size(key: str) -> int | None:
    """Size of the uploaded object, or None if it isn't there."""
    try:
        head = client().head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
    except ClientError:
        return None
    return int(head["ContentLength"])


def delete_object(key: str) -> None:
    client().delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
