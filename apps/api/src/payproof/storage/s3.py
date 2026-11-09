"""Private document storage (S3 / MinIO). Downloads only through 5-minute signed links,
issued after the permission check (security.md)."""

import asyncio
import datetime as dt
from functools import lru_cache
from typing import TYPE_CHECKING
from urllib.parse import quote

import boto3
from botocore.config import Config

from payproof.core.settings import get_settings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

LINK_TTL = dt.timedelta(minutes=5)


def _client(endpoint: str, access_key: str, secret_key: str) -> "S3Client":
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="us-east-1",  # MinIO's default; signatures need one
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


class Storage:
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        public_endpoint: str | None = None,
    ) -> None:
        self.bucket = bucket
        self._s3: S3Client = _client(endpoint, access_key, secret_key)
        # the signature covers the host: sign with the address the browser will use
        self._signer: S3Client = (
            _client(public_endpoint, access_key, secret_key) if public_endpoint else self._s3
        )

    async def put(self, key: str, data: bytes, mime: str) -> None:
        # boto3 is blocking: keep it off the event loop
        await asyncio.to_thread(
            self._s3.put_object, Bucket=self.bucket, Key=key, Body=data, ContentType=mime
        )

    async def get(self, key: str) -> bytes:
        obj = await asyncio.to_thread(self._s3.get_object, Bucket=self.bucket, Key=key)
        return await asyncio.to_thread(obj["Body"].read)

    def signed_url(self, key: str, file_name: str) -> tuple[str, dt.datetime]:
        """Signing is local (no request), so it stays sync."""
        expires = dt.datetime.now(dt.UTC) + LINK_TTL
        url = self._signer.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                # RFC 6266: the original (Azerbaijani) name survives the download
                "ResponseContentDisposition": f"attachment; filename*=UTF-8''{quote(file_name)}",
            },
            ExpiresIn=int(LINK_TTL.total_seconds()),
        )
        return url, expires


@lru_cache
def get_storage() -> Storage:
    s = get_settings()
    return Storage(
        s.s3_endpoint_url,
        s.s3_access_key,
        s.s3_secret_key.get_secret_value(),
        s.s3_bucket,
        s.s3_public_endpoint_url,
    )
