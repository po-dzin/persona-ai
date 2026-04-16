"""
Unit tests for r2_client adapter.

Covers:
  - upload_bytes: calls put_object and returns correct public URL
  - delete_object: calls delete_object on boto3 client
  - delete_object: returns False gracefully on NoSuchKey
  - delete_object: returns False gracefully on generic ClientError
"""

import pytest
from botocore.exceptions import ClientError
from unittest.mock import MagicMock, patch


# ──────────────────────── fixtures ───────────────────────────────────

@pytest.fixture()
def mock_boto_client(monkeypatch):
    """Patch boto3.client to return a mock S3 client."""
    import app.adapters.r2_client as r2_mod
    fake = MagicMock()
    monkeypatch.setattr(r2_mod, "_client", lambda: fake)
    return fake


# ──────────────────────── upload_bytes ───────────────────────────────

def test_upload_bytes_calls_put_object(mock_boto_client) -> None:
    from app.adapters.r2_client import upload_bytes

    mock_boto_client.put_object.return_value = {}

    url = upload_bytes("photos/test.jpg", b"fake-image-data", "image/jpeg")

    mock_boto_client.put_object.assert_called_once()
    call_kwargs = mock_boto_client.put_object.call_args.kwargs
    assert call_kwargs["Key"] == "photos/test.jpg"
    assert call_kwargs["Body"] == b"fake-image-data"
    assert call_kwargs["ContentType"] == "image/jpeg"
    assert "photos/test.jpg" in url


# ──────────────────────── delete_object ──────────────────────────────

def test_delete_object_returns_true_on_success(mock_boto_client) -> None:
    from app.adapters.r2_client import delete_object

    mock_boto_client.delete_object.return_value = {}

    result = delete_object("photos/test.jpg")

    assert result is True
    mock_boto_client.delete_object.assert_called_once()
    call_kwargs = mock_boto_client.delete_object.call_args.kwargs
    assert call_kwargs["Key"] == "photos/test.jpg"


def test_delete_object_returns_false_on_no_such_key(mock_boto_client) -> None:
    from app.adapters.r2_client import delete_object

    error_response = {"Error": {"Code": "NoSuchKey", "Message": "Not found"}}
    mock_boto_client.delete_object.side_effect = ClientError(error_response, "DeleteObject")

    result = delete_object("photos/missing.jpg")

    assert result is False


def test_delete_object_returns_false_on_generic_client_error(mock_boto_client) -> None:
    from app.adapters.r2_client import delete_object

    error_response = {"Error": {"Code": "AccessDenied", "Message": "Access denied"}}
    mock_boto_client.delete_object.side_effect = ClientError(error_response, "DeleteObject")

    result = delete_object("photos/secret.jpg")

    assert result is False
