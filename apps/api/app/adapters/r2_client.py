from __future__ import annotations

import logging

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.settings import settings

logger = logging.getLogger(__name__)


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def presigned_put_url(key: str, content_type: str = "image/jpeg", expires_in: int = 3600) -> str:
    """Generate a presigned PUT URL so the client can upload directly to R2."""
    return _client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )


def upload_bytes(key: str, data: bytes, content_type: str = "image/jpeg") -> str:
    """Upload bytes to R2 and return the public URL."""
    _client().put_object(
        Bucket=settings.r2_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    base = settings.r2_public_base_url.strip().rstrip("/")
    return f"{base}/{key.lstrip('/')}"


def public_url(key: str) -> str:
    base = settings.r2_public_base_url.strip().rstrip("/")
    return f"{base}/{key.lstrip('/')}"


def delete_object(key: str) -> bool:
    """Delete an object from R2. Returns True on success, False on error.

    R2/S3 returns HTTP 204 for non-existent keys (idempotent by spec),
    so a missing key is always a success — no special handling needed.
    """
    try:
        _client().delete_object(Bucket=settings.r2_bucket, Key=key)
        return True
    except ClientError as e:
        logger.error("r2_client.delete_object: error deleting %s: %s", key, e)
        return False
