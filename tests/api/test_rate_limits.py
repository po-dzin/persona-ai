from __future__ import annotations

from dataclasses import replace as dc_replace

from fastapi.testclient import TestClient
import pytest

import app.routers.v1 as v1_mod
from app.core.rate_limit import generate_limiter, tg_webhook_limiter, upload_limiter
from app.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def _headers(user_id: str) -> dict[str, str]:
    return {"X-Dev-User-Id": user_id}


@pytest.fixture(autouse=True)
def reset_rate_limiter_state():
    originals = [
        (generate_limiter, generate_limiter.calls, generate_limiter.period),
        (upload_limiter, upload_limiter.calls, upload_limiter.period),
        (tg_webhook_limiter, tg_webhook_limiter.calls, tg_webhook_limiter.period),
    ]
    for limiter, _, _ in originals:
        limiter._windows.clear()
    yield
    for limiter, calls, period in originals:
        limiter.calls = calls
        limiter.period = period
        limiter._windows.clear()


def test_generate_endpoint_returns_429_after_user_limit() -> None:
    client = _client()
    user_id = "u-rate-generate"
    generate_limiter.calls = 1

    first_upload = client.post("/v1/uploads", json={"filename": "first.jpg"}, headers=_headers(user_id))
    assert first_upload.status_code == 200

    first_generate = client.post(
        "/v1/generate",
        json={
            "source_key": first_upload.json()["source_key"],
            "model_id": "nb2-1k",
            "style_code": "hollywood",
            "aspect_ratio": "1:1",
        },
        headers=_headers(user_id),
    )
    assert first_generate.status_code == 200

    second_generate = client.post(
        "/v1/generate",
        json={
            "source_key": first_upload.json()["source_key"],
            "model_id": "nb2-1k",
            "style_code": "hollywood",
            "aspect_ratio": "1:1",
        },
        headers=_headers(user_id),
    )
    assert second_generate.status_code == 429
    assert second_generate.json()["detail"] == "rate_limit_exceeded"
    assert second_generate.headers["Retry-After"] == "60"


def test_upload_endpoint_returns_429_after_user_limit() -> None:
    client = _client()
    user_id = "u-rate-upload"
    upload_limiter.calls = 1

    first = client.post("/v1/uploads", json={"filename": "first.jpg"}, headers=_headers(user_id))
    assert first.status_code == 200

    second = client.post("/v1/uploads", json={"filename": "second.jpg"}, headers=_headers(user_id))
    assert second.status_code == 429
    assert second.json()["detail"] == "rate_limit_exceeded"
    assert second.headers["Retry-After"] == "60"


def test_tg_webhook_returns_429_after_ip_limit(monkeypatch) -> None:
    client = _client()
    tg_webhook_limiter.calls = 1
    monkeypatch.setattr(
        v1_mod,
        "settings",
        dc_replace(v1_mod.settings, telegram_webhook_secret=""),
    )
    headers = {"X-Forwarded-For": "203.0.113.10"}

    first = client.post(
        "/v1/tg/webhook",
        json={"message": {"chat": {"id": 1}, "text": "ping"}},
        headers=headers,
    )
    assert first.status_code == 200

    second = client.post(
        "/v1/tg/webhook",
        json={"message": {"chat": {"id": 1}, "text": "ping"}},
        headers=headers,
    )
    assert second.status_code == 429
    assert second.json()["detail"] == "rate_limit_exceeded"
    assert second.headers["Retry-After"] == "60"
