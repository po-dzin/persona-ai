#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
API_DIR = ROOT / "apps" / "api"
for p in (ROOT, API_DIR):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)

from app.main import create_app


def main() -> int:
    client = TestClient(create_app())
    user_id = "smoke-user"

    styles = client.get("/v1/styles")
    models = client.get("/v1/models")
    packages = client.get("/v1/packages")
    assert styles.status_code == 200 and styles.json()["styles"]
    assert models.status_code == 200 and models.json()["models"]
    assert packages.status_code == 200 and packages.json()["packages"]

    upload = client.post("/v1/uploads", json={"user_id": user_id, "filename": "smoke.jpg"})
    assert upload.status_code == 200
    source_key = upload.json()["source_key"]

    model_id = models.json()["models"][0]["id"]
    style_code = styles.json()["styles"][0]["id"]

    generated = client.post(
        "/v1/generate",
        json={
            "user_id": user_id,
            "source_key": source_key,
            "model_id": model_id,
            "style_code": style_code,
            "aspect_ratio": "1:1",
        },
    )
    assert generated.status_code == 200
    payload = generated.json()
    assert payload["result"] in {"enqueued", "paywall_required"}

    if payload["result"] == "paywall_required":
        purchased = client.post(
            "/v1/purchase",
            json={"user_id": user_id, "package_code": "STARTER", "provider": "telegram"},
        )
        assert purchased.status_code == 200
        generated = client.post(
            "/v1/generate",
            json={
                "user_id": user_id,
                "source_key": source_key,
                "model_id": model_id,
                "style_code": style_code,
                "aspect_ratio": "1:1",
            },
        )
        assert generated.status_code == 200
        payload = generated.json()
        assert payload["result"] == "enqueued"

    order_id = payload["order"]["order_id"]
    provider = payload["job"]["provider"]

    callback = client.post(
        f"/v1/webhooks/{provider}",
        json={
            "event_id": "smoke-done-1",
            "payload": {
                "order_id": order_id,
                "event_type": "done",
                "result_url": "https://cdn.example.com/smoke.jpg",
            },
        },
    )
    assert callback.status_code == 200

    photos = client.get("/v1/me/photos", params={"user_id": user_id})
    assert photos.status_code == 200
    assert photos.json()["photos"][0]["status"] == "done"

    print("smoke_phase1: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
