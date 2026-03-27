"""
Cloudflare R2 uploads via S3-compatible API (boto3).
Env: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT_URL
"""

from __future__ import annotations

import os
import re
import uuid

from botocore.config import Config


def _require_r2_config() -> tuple[str, str, str, str]:
    access = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    secret = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    bucket = os.environ.get("R2_BUCKET_NAME", "").strip()
    endpoint = os.environ.get("R2_ENDPOINT_URL", "").strip()
    if not all([access, secret, bucket, endpoint]):
        raise RuntimeError(
            "R2 is not configured (need R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "
            "R2_BUCKET_NAME, R2_ENDPOINT_URL)"
        )
    return access, secret, bucket, endpoint


def _s3_client():
    import boto3

    access, secret, _bucket, endpoint = _require_r2_config()
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def safe_filename(name: str) -> str:
    base = os.path.basename(name or "").strip() or "file"
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", base)
    return (cleaned[:200] or "file")[:200]


def build_object_key(unit_id: str, original_name: str) -> str:
    uid = str(uuid.uuid4())
    safe = safe_filename(original_name)
    return f"units/{unit_id}/{uid}-{safe}"


def public_object_url(object_key: str) -> str:
    """Path-style URL for the object (R2 S3 API endpoint + bucket + key)."""
    _, _, bucket, endpoint = _require_r2_config()
    base = endpoint.rstrip("/")
    return f"{base}/{bucket}/{object_key}"


def upload_bytes(object_key: str, body: bytes, content_type: str | None) -> str:
    _, _, bucket, _ = _require_r2_config()
    client = _s3_client()
    extra: dict = {}
    if content_type:
        extra["ContentType"] = content_type
    client.put_object(Bucket=bucket, Key=object_key, Body=body, **extra)
    return public_object_url(object_key)
