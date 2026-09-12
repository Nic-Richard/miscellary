import uuid
from urllib.parse import urlsplit, urlunsplit

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings

ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_SIZE = 10 * 1024 * 1024
PRESIGN_SECONDS = 600


def public_endpoint_for(host: str | None) -> str:
    """The storage address a client on `host` can reach.

    Development runs storage beside the API, so whichever address a client used
    to call the API is the one it can reach storage on. A browser calls
    localhost and a phone calls the LAN address, and a signature only matches
    the host it was signed for, so this follows the caller rather than being
    pinned to either.
    """
    configured = settings.AWS_S3_PUBLIC_ENDPOINT_URL
    if not configured or not host or not settings.DEBUG:
        return configured
    caller = host if host.endswith("]") else host.rsplit(":", 1)[0]
    if not caller or caller in {"localhost", "127.0.0.1"}:
        return configured
    parts = urlsplit(configured)
    port = f":{parts.port}" if parts.port else ""
    return urlunsplit((parts.scheme, f"{caller}{port}", parts.path, "", ""))


def client(*, public: bool = False, host: str | None = None):
    """An S3 client. `public` signs against the endpoint the caller can reach."""
    endpoint = settings.AWS_S3_ENDPOINT_URL
    if public:
        endpoint = public_endpoint_for(host) or endpoint
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


def presigned_put_url(key: str, content_type: str, host: str | None = None) -> str:
    # SigV4 covers the host, so the signature only matches if the client sends
    # the request to the same one it was signed for.
    return client(public=True, host=host).generate_presigned_url(
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


def put_object(key: str, body: bytes, content_type: str) -> None:
    client().put_object(
        Bucket=settings.AWS_STORAGE_BUCKET_NAME,
        Key=key,
        Body=body,
        ContentType=content_type,
    )
