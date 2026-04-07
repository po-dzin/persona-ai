"""
End-to-end tests for the generation flow.

Covers:
  - All three models (v1 / v2 / pro) via POST /v1/generate
  - Correct coin deduction per model
  - Synchronous provider completion (order immediately done)
  - Async provider: order stays processing until webhook
  - Photo visible in gallery with correct status transitions
  - Technical failure → credit refund for all three models
  - Policy failure → no refund
  - Aspect ratio + prompt stored in order
  - Direct file upload via POST /v1/uploads/file
  - GET /v1/me/history
  - Favorite toggle
  - generate returns paywall_required when no credits
"""

import io
from dataclasses import replace as dc_replace

import pytest
from fastapi.testclient import TestClient

from app.adapters.provider_base import ProviderSubmitResult
from app.core.db import UserRow, get_session
from app.main import create_app


# ──────────────────────────── helpers ────────────────────────────

def _client():
    return TestClient(create_app())


def _headers(user_id: str) -> dict[str, str]:
    return {"X-Dev-User-Id": user_id}


def _seed_user(user_id: str, *, paid_credits: int = 0) -> None:
    with get_session() as db:
        user = db.get(UserRow, user_id)
        if user is None:
            raise RuntimeError(f"User {user_id!r} not seeded — call /v1/me/balance first")
        user.paid_credits = paid_credits
        db.commit()


def _ensure_user(client: TestClient, user_id: str) -> None:
    """Hit any auth'd endpoint to auto-create the user row."""
    client.get("/v1/me/balance", headers=_headers(user_id))


def _source_key(client: TestClient, user_id: str, filename: str = "photo.jpg") -> str:
    res = client.post("/v1/uploads", json={"filename": filename}, headers=_headers(user_id))
    assert res.status_code == 200
    return res.json()["source_key"]


def _generate(client: TestClient, user_id: str, *, model_id: str = "nano-banana-v1",
              style_code: str = "hollywood", aspect_ratio: str = "1:1",
              prompt: str = "test prompt") -> dict:
    sk = _source_key(client, user_id)
    res = client.post(
        "/v1/generate",
        json={
            "source_key": sk,
            "model_id": model_id,
            "style_code": style_code,
            "aspect_ratio": aspect_ratio,
            "prompt": prompt,
        },
        headers=_headers(user_id),
    )
    assert res.status_code == 200
    return res.json()


def _webhook_done(client: TestClient, order_id: str, event_id: str,
                  result_url: str = "https://cdn.example.com/result.jpg") -> None:
    res = client.post(
        "/v1/webhooks/nano_banana",
        json={
            "event_id": event_id,
            "payload": {"order_id": order_id, "event_type": "done", "result_url": result_url},
        },
    )
    assert res.status_code == 200


def _webhook_failed(client: TestClient, order_id: str, event_id: str,
                    event_type: str = "technical_failed") -> None:
    res = client.post(
        "/v1/webhooks/nano_banana",
        json={
            "event_id": event_id,
            "payload": {"order_id": order_id, "event_type": event_type},
        },
    )
    assert res.status_code == 200


# ──────────────────── model routing & coin cost ──────────────────

@pytest.mark.parametrize("model_id,expected_cost", [
    ("nano-banana-v1", 10),
    ("nano-banana-v2", 20),
    ("nano-banana-pro", 50),
])
def test_each_model_deducts_correct_coins(model_id: str, expected_cost: int) -> None:
    client = _client()
    uid = f"u-cost-{model_id}"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    result = _generate(client, uid, model_id=model_id)

    assert result["result"] == "enqueued"
    assert result["wallet"]["paid_credits"] == 100 - expected_cost


@pytest.mark.parametrize("model_id", ["nano-banana-v1", "nano-banana-v2", "nano-banana-pro"])
def test_all_models_route_to_nano_banana_provider(model_id: str) -> None:
    client = _client()
    uid = f"u-provider-{model_id}"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    result = _generate(client, uid, model_id=model_id)

    assert result["job"]["provider"] == "nano_banana"


# ────────────────── synchronous completion ───────────────────────

@pytest.mark.parametrize("model_id", ["nano-banana-v1", "nano-banana-v2", "nano-banana-pro"])
def test_sync_provider_completion_sets_order_done_immediately(monkeypatch, model_id: str) -> None:
    """When the provider returns status=done inline, no webhook should be needed."""
    import app.services.vertical_slice as svc_mod

    done_result = ProviderSubmitResult(
        provider_task_id="sync-task",
        status="done",
        result_url="https://cdn.example.com/sync-result.jpg",
    )
    monkeypatch.setattr(
        svc_mod.VerticalSliceService,
        "_get_provider_submit",
        lambda self, provider_id: lambda **_: done_result,
        raising=False,
    )

    # Patch at registry level — replace submit on the adapter instance
    from app.adapters.nano_banana import NanoBananaAdapter
    monkeypatch.setattr(NanoBananaAdapter, "submit", lambda self, **kw: done_result)

    client = _client()
    uid = f"u-sync-{model_id}"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    result = _generate(client, uid, model_id=model_id)

    assert result["result"] == "enqueued"
    assert result["order"]["status"] == "done"
    assert result["order"]["result_url"] == "https://cdn.example.com/sync-result.jpg"

    # Photo immediately visible as done — no webhook required
    photos = client.get("/v1/me/photos", headers=_headers(uid)).json()["photos"]
    assert photos[0]["status"] == "done"
    assert photos[0]["result_url"] == "https://cdn.example.com/sync-result.jpg"


# ─────────────────── async webhook flow ──────────────────────────

@pytest.mark.parametrize("model_id", ["nano-banana-v1", "nano-banana-v2", "nano-banana-pro"])
def test_async_provider_order_stays_processing_until_webhook(model_id: str) -> None:
    """Mock provider returns submitted → order in processing → webhook finalises it."""
    client = _client()
    uid = f"u-async-{model_id}"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    result = _generate(client, uid, model_id=model_id)
    order_id = result["order"]["order_id"]

    assert result["result"] == "enqueued"
    assert result["order"]["status"] == "processing"

    # Gallery shows processing before webhook
    photos = client.get("/v1/me/photos", headers=_headers(uid)).json()["photos"]
    assert photos[0]["status"] == "processing"
    assert photos[0]["result_url"] is None

    # Webhook finalises
    _webhook_done(client, order_id, f"evt-async-{model_id}")

    photos_after = client.get("/v1/me/photos", headers=_headers(uid)).json()["photos"]
    assert photos_after[0]["status"] == "done"
    assert photos_after[0]["result_url"] == "https://cdn.example.com/result.jpg"


# ─────────────────── failures & refunds ──────────────────────────

@pytest.mark.parametrize("model_id,cost", [
    ("nano-banana-v1", 10),
    ("nano-banana-v2", 20),
    ("nano-banana-pro", 50),
])
def test_technical_failure_refunds_coins_for_all_models(model_id: str, cost: int) -> None:
    client = _client()
    uid = f"u-refund-{model_id}"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    result = _generate(client, uid, model_id=model_id)
    order_id = result["order"]["order_id"]
    assert result["wallet"]["paid_credits"] == 100 - cost

    _webhook_failed(client, order_id, f"evt-fail-{model_id}", "technical_failed")

    wallet = client.get("/v1/me/balance", headers=_headers(uid)).json()["wallet"]
    assert wallet["paid_credits"] == 100

    photos = client.get("/v1/me/photos", headers=_headers(uid)).json()["photos"]
    assert photos[0]["status"] == "failed"


def test_policy_failure_does_not_refund_coins() -> None:
    client = _client()
    uid = "u-policy-fail"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=50)

    result = _generate(client, uid, model_id="nano-banana-v2")
    order_id = result["order"]["order_id"]
    assert result["wallet"]["paid_credits"] == 30  # 50 - 20

    _webhook_failed(client, order_id, "evt-policy-v2", "policy_failed")

    wallet = client.get("/v1/me/balance", headers=_headers(uid)).json()["wallet"]
    assert wallet["paid_credits"] == 30  # not refunded


def test_generate_returns_paywall_when_no_credits() -> None:
    client = _client()
    uid = "u-paywall-gen"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=0)

    sk = _source_key(client, uid)
    res = client.post(
        "/v1/generate",
        json={"source_key": sk, "model_id": "nano-banana-v1",
              "style_code": "hollywood", "aspect_ratio": "1:1"},
        headers=_headers(uid),
    )
    assert res.status_code == 200
    assert res.json()["result"] == "paywall_required"


def test_generate_insufficient_coins_for_pro_but_enough_for_v1() -> None:
    """20 coins: enough for v2 but not pro."""
    client = _client()
    uid = "u-partial-coins"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=20)

    # v2 succeeds (costs 20)
    r_v2 = _generate(client, uid, model_id="nano-banana-v2")
    assert r_v2["result"] == "enqueued"
    assert r_v2["wallet"]["paid_credits"] == 0

    # pro now fails (0 coins left, costs 50)
    sk = _source_key(client, uid)
    r_pro = client.post(
        "/v1/generate",
        json={"source_key": sk, "model_id": "nano-banana-pro",
              "style_code": "hollywood", "aspect_ratio": "1:1"},
        headers=_headers(uid),
    )
    assert r_pro.json()["result"] == "paywall_required"


# ─────────────── order metadata stored correctly ─────────────────

def test_aspect_ratio_stored_in_order() -> None:
    client = _client()
    uid = "u-ar"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    result = _generate(client, uid, aspect_ratio="9:16")
    order_id = result["order"]["order_id"]

    order = client.get(f"/v1/orders/{order_id}", headers=_headers(uid)).json()["order"]
    assert order["aspect_ratio"] == "9:16"


def test_prompt_stored_in_order() -> None:
    client = _client()
    uid = "u-prompt"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    result = _generate(client, uid, prompt="cyberpunk neon city portrait")
    order_id = result["order"]["order_id"]

    order = client.get(f"/v1/orders/{order_id}", headers=_headers(uid)).json()["order"]
    assert order["prompt"] == "cyberpunk neon city portrait"


def test_model_id_stored_in_order() -> None:
    client = _client()
    uid = "u-model-stored"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    result = _generate(client, uid, model_id="nano-banana-v2")
    order_id = result["order"]["order_id"]

    photos = client.get("/v1/me/photos", headers=_headers(uid)).json()["photos"]
    assert photos[0]["model_id"] == "nano-banana-v2"


# ─────────────────── direct file upload ──────────────────────────

def test_direct_file_upload_returns_source_key() -> None:
    client = _client()
    uid = "u-direct-upload"
    img_bytes = b"\xff\xd8\xff" + b"\x00" * 100  # minimal JPEG header

    res = client.post(
        "/v1/uploads/file",
        headers={"X-Dev-User-Id": uid},
        files={"file": ("photo.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        data={"filename": "photo.jpg"},
    )
    assert res.status_code == 200
    assert "source_key" in res.json()
    assert res.json()["source_key"] != ""


def test_direct_file_upload_rejects_non_image() -> None:
    client = _client()
    uid = "u-bad-upload"

    res = client.post(
        "/v1/uploads/file",
        headers={"X-Dev-User-Id": uid},
        files={"file": ("script.exe", io.BytesIO(b"MZ\x90"), "application/octet-stream")},
        data={"filename": "script.exe"},
    )
    assert res.status_code == 400
    assert "invalid_file_type" in res.text


def test_generate_after_direct_file_upload() -> None:
    client = _client()
    uid = "u-direct-then-gen"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=50)

    img_bytes = b"\xff\xd8\xff" + b"\x00" * 100
    up = client.post(
        "/v1/uploads/file",
        headers={"X-Dev-User-Id": uid},
        files={"file": ("photo.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        data={"filename": "photo.jpg"},
    )
    assert up.status_code == 200
    source_key = up.json()["source_key"]

    res = client.post(
        "/v1/generate",
        json={"source_key": source_key, "model_id": "nano-banana-v1",
              "style_code": "hollywood", "aspect_ratio": "1:1"},
        headers=_headers(uid),
    )
    assert res.status_code == 200
    assert res.json()["result"] == "enqueued"


# ──────────────────────── gallery & history ───────────────────────

def test_multiple_orders_appear_in_gallery_newest_first() -> None:
    client = _client()
    uid = "u-gallery-order"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    r1 = _generate(client, uid, model_id="nano-banana-v1")
    r2 = _generate(client, uid, model_id="nano-banana-v2")

    photos = client.get("/v1/me/photos", headers=_headers(uid)).json()["photos"]
    assert len(photos) == 2
    # newest first
    assert photos[0]["order_id"] == r2["order"]["order_id"]
    assert photos[1]["order_id"] == r1["order"]["order_id"]


def test_history_endpoint_returns_orders() -> None:
    client = _client()
    uid = "u-history"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=100)

    _generate(client, uid, model_id="nano-banana-v1")
    _generate(client, uid, model_id="nano-banana-v2")

    res = client.get("/v1/me/history", headers=_headers(uid))
    assert res.status_code == 200
    orders = res.json()["orders"]
    assert len(orders) == 2
    model_ids = {o["model_id"] for o in orders}
    assert model_ids == {"nano-banana-v1", "nano-banana-v2"}


def test_gallery_does_not_leak_other_users_photos() -> None:
    client = _client()
    uid_a, uid_b = "u-gallery-a", "u-gallery-b"
    for uid in (uid_a, uid_b):
        _ensure_user(client, uid)
        _seed_user(uid, paid_credits=50)

    _generate(client, uid_a, model_id="nano-banana-v1")
    _generate(client, uid_b, model_id="nano-banana-v2")

    photos_a = client.get("/v1/me/photos", headers=_headers(uid_a)).json()["photos"]
    photos_b = client.get("/v1/me/photos", headers=_headers(uid_b)).json()["photos"]

    assert len(photos_a) == 1 and photos_a[0]["model_id"] == "nano-banana-v1"
    assert len(photos_b) == 1 and photos_b[0]["model_id"] == "nano-banana-v2"


def test_second_account_isolation_blocks_cross_account_reads_and_mutations() -> None:
    client = _client()
    owner_id, second_id = "u-second-owner", "u-second-account"

    for uid in (owner_id, second_id):
        _ensure_user(client, uid)
        _seed_user(uid, paid_credits=50)

    owner_result = _generate(client, owner_id, model_id="nano-banana-v1")
    second_result = _generate(client, second_id, model_id="nano-banana-v2")
    owner_order_id = owner_result["order"]["order_id"]
    second_order_id = second_result["order"]["order_id"]

    owner_history = client.get("/v1/me/history", headers=_headers(owner_id)).json()["orders"]
    second_history = client.get("/v1/me/history", headers=_headers(second_id)).json()["orders"]
    assert {order["order_id"] for order in owner_history} == {owner_order_id}
    assert {order["order_id"] for order in second_history} == {second_order_id}

    owner_photos = client.get("/v1/me/photos", headers=_headers(owner_id)).json()["photos"]
    second_photos = client.get("/v1/me/photos", headers=_headers(second_id)).json()["photos"]
    assert {photo["order_id"] for photo in owner_photos} == {owner_order_id}
    assert {photo["order_id"] for photo in second_photos} == {second_order_id}

    assert client.get(f"/v1/orders/{owner_order_id}", headers=_headers(second_id)).status_code == 403
    assert client.post(f"/v1/me/photos/{owner_order_id}/favorite", headers=_headers(second_id)).status_code == 403
    assert client.delete(f"/v1/me/photos/{owner_order_id}", headers=_headers(second_id)).status_code == 403

    owner_photos_after = client.get("/v1/me/photos", headers=_headers(owner_id)).json()["photos"]
    assert {photo["order_id"] for photo in owner_photos_after} == {owner_order_id}


# ───────────────────── favorite toggle ───────────────────────────

def test_favorite_toggle_flips_and_flips_back() -> None:
    client = _client()
    uid = "u-fav"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=50)

    result = _generate(client, uid)
    order_id = result["order"]["order_id"]

    # Initially not favorite
    photos = client.get("/v1/me/photos", headers=_headers(uid)).json()["photos"]
    assert photos[0]["is_favorite"] is False

    # Toggle on
    r1 = client.post(f"/v1/me/photos/{order_id}/favorite", headers=_headers(uid))
    assert r1.status_code == 200
    assert r1.json()["is_favorite"] is True

    # Toggle off
    r2 = client.post(f"/v1/me/photos/{order_id}/favorite", headers=_headers(uid))
    assert r2.json()["is_favorite"] is False


def test_favorite_toggle_forbidden_for_other_user() -> None:
    client = _client()
    uid_owner, uid_other = "u-fav-owner", "u-fav-other"
    _ensure_user(client, uid_owner)
    _seed_user(uid_owner, paid_credits=50)

    result = _generate(client, uid_owner)
    order_id = result["order"]["order_id"]

    res = client.post(f"/v1/me/photos/{order_id}/favorite", headers=_headers(uid_other))
    assert res.status_code == 403


# ───────────────────── generate response shape ───────────────────

def test_generate_response_contains_required_fields() -> None:
    client = _client()
    uid = "u-shape"
    _ensure_user(client, uid)
    _seed_user(uid, paid_credits=50)

    result = _generate(client, uid, model_id="nano-banana-v2", style_code="cyberpunk",
                       aspect_ratio="16:9", prompt="neon city")

    assert result["result"] == "enqueued"
    order = result["order"]
    assert "order_id" in order
    assert order["model_id"] == "nano-banana-v2"
    assert order["style_code"] == "cyberpunk"
    assert order["credit_cost"] == 20
    assert "wallet" in result
    assert "job" in result
    assert result["job"]["provider"] == "nano_banana"


def test_new_user_welcome_coins_deducted_on_generation() -> None:
    """New users receive 20 welcome paid coins; generation deducts the model cost."""
    client = _client()
    uid = "u-welcome-gen"
    _ensure_user(client, uid)

    # Fresh user has 20 welcome coins
    balance = client.get("/v1/me/balance", headers=_headers(uid)).json()["wallet"]
    assert balance["paid_credits"] == 20

    result = _generate(client, uid, model_id="nano-banana-v1")  # costs 10 coins

    assert result["result"] == "enqueued"
    assert result["wallet"]["paid_credits"] == 10  # 20 − 10
