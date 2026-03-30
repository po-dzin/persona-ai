"""
Unit tests for NanoBananaAdapter.

Covers:
  - Model → Gemini model name mapping
  - _extract_image: happy path, no candidates, no image part
  - submit() in mock mode returns submitted status
  - submit() in real mode calls generateContent and stores result
  - submit() in real mode falls back gracefully on HTTP error
"""

import base64
import json

import pytest

from app.adapters.nano_banana import NanoBananaAdapter, _extract_image, _load_source_image, _MODEL_MAP, _PHOTO_INSTRUCTION
from app.adapters.provider_base import ProviderSubmitResult
from app.adapters.http_client import ProviderHTTPError


# ──────────────────────── model map ──────────────────────────────

def test_model_map_has_all_three_models() -> None:
    assert "nano-banana-v1" in _MODEL_MAP
    assert "nano-banana-v2" in _MODEL_MAP
    assert "nano-banana-pro" in _MODEL_MAP


def test_model_map_v1_is_flash() -> None:
    assert _MODEL_MAP["nano-banana-v1"] == "gemini-2.5-flash-image"


def test_model_map_v2_is_flash_preview() -> None:
    assert _MODEL_MAP["nano-banana-v2"] == "gemini-3.1-flash-image-preview"


def test_model_map_pro_is_pro_preview() -> None:
    assert _MODEL_MAP["nano-banana-pro"] == "gemini-3-pro-image-preview"


def test_unknown_model_falls_back_to_default() -> None:
    adapter = NanoBananaAdapter(integration_mode="mock")
    # In mock mode submit ignores model_id anyway, but verify _MODEL_MAP.get fallback
    result = _MODEL_MAP.get("non-existent-model", "gemini-2.5-flash-image")
    assert result == "gemini-2.5-flash-image"


# ─────────────────── _extract_image ──────────────────────────────

def _make_response(mime: str, b64_data: str) -> dict:
    return {
        "candidates": [{
            "content": {
                "parts": [
                    {"text": "Here is your image:"},
                    {"inlineData": {"mimeType": mime, "data": b64_data}},
                ]
            }
        }]
    }


def test_extract_image_png_success() -> None:
    raw = b"\x89PNG fake image bytes"
    b64 = base64.b64encode(raw).decode()
    resp = _make_response("image/png", b64)

    img_bytes, mime = _extract_image(resp)

    assert img_bytes == raw
    assert mime == "image/png"


def test_extract_image_jpeg_success() -> None:
    raw = b"\xff\xd8\xff fake jpeg"
    b64 = base64.b64encode(raw).decode()
    resp = _make_response("image/jpeg", b64)

    img_bytes, mime = _extract_image(resp)

    assert img_bytes == raw
    assert mime == "image/jpeg"


def test_extract_image_skips_text_parts() -> None:
    """Text-only response → raises ProviderHTTPError."""
    resp = {
        "candidates": [{
            "content": {
                "parts": [{"text": "sorry, no image today"}]
            }
        }]
    }
    with pytest.raises(ProviderHTTPError, match="gemini_no_image_in_response"):
        _extract_image(resp)


def test_extract_image_no_candidates_raises() -> None:
    with pytest.raises(ProviderHTTPError, match="gemini_no_candidates"):
        _extract_image({"candidates": []})


def test_extract_image_empty_response_raises() -> None:
    with pytest.raises(ProviderHTTPError, match="gemini_no_candidates"):
        _extract_image({})


def test_extract_image_picks_first_image_part() -> None:
    raw1 = b"image one"
    raw2 = b"image two"
    resp = {
        "candidates": [{
            "content": {
                "parts": [
                    {"inlineData": {"mimeType": "image/png", "data": base64.b64encode(raw1).decode()}},
                    {"inlineData": {"mimeType": "image/png", "data": base64.b64encode(raw2).decode()}},
                ]
            }
        }]
    }
    img_bytes, _ = _extract_image(resp)
    assert img_bytes == raw1


# ─────────────────── _load_source_image ─────────────────────────

def test_load_source_image_placeholder_url_returns_empty() -> None:
    b64, mime = _load_source_image("https://r2.example/source/u1/img.jpg", timeout=10)
    assert b64 == ""
    assert mime == "image/jpeg"


def test_load_source_image_empty_url_returns_empty() -> None:
    b64, mime = _load_source_image("", timeout=10)
    assert b64 == ""


def test_load_source_image_detects_jpeg(monkeypatch) -> None:
    import app.adapters.nano_banana as nb_mod
    monkeypatch.setattr(nb_mod, "fetch_bytes", lambda url, timeout_seconds: b"\xff\xd8\xff fake jpeg")
    b64, mime = _load_source_image("https://cdn.real.com/photo.jpg", timeout=10)
    assert mime == "image/jpeg"
    assert base64.b64decode(b64) == b"\xff\xd8\xff fake jpeg"


def test_load_source_image_detects_png(monkeypatch) -> None:
    import app.adapters.nano_banana as nb_mod
    monkeypatch.setattr(nb_mod, "fetch_bytes", lambda url, timeout_seconds: b"\x89PNG fake png")
    b64, mime = _load_source_image("https://cdn.real.com/photo.png", timeout=10)
    assert mime == "image/png"


def test_load_source_image_returns_empty_on_fetch_error(monkeypatch) -> None:
    import app.adapters.nano_banana as nb_mod
    def fail(*a, **kw): raise ProviderHTTPError("fetch_failed")
    monkeypatch.setattr(nb_mod, "fetch_bytes", fail)
    b64, mime = _load_source_image("https://cdn.real.com/photo.jpg", timeout=10)
    assert b64 == ""


# ──────────────────── adapter mock mode ──────────────────────────

def test_mock_mode_returns_submitted_status() -> None:
    adapter = NanoBananaAdapter(integration_mode="mock")
    result = adapter.submit(
        order_id="ord-1",
        model_id="nano-banana-v1",
        source_key="source/u1/img.jpg",
        source_image_url="https://r2.example/source/u1/img.jpg",
        prompt="test",
        aspect_ratio="1:1",
    )
    assert isinstance(result, ProviderSubmitResult)
    assert result.status == "submitted"
    assert result.provider_task_id != ""


def test_mock_mode_not_real_when_no_api_key() -> None:
    adapter = NanoBananaAdapter(integration_mode="real", real_calls_enabled=True, api_key="")
    assert adapter._is_real() is False


def test_mock_mode_not_real_when_disabled() -> None:
    adapter = NanoBananaAdapter(integration_mode="real", real_calls_enabled=False, api_key="key")
    assert adapter._is_real() is False


def test_real_mode_is_real_when_all_conditions_met() -> None:
    adapter = NanoBananaAdapter(integration_mode="real", real_calls_enabled=True, api_key="key")
    assert adapter._is_real() is True


# ──────────────────── adapter real mode ──────────────────────────

def test_real_mode_calls_correct_gemini_endpoint(monkeypatch) -> None:
    """Verify URL, headers, and text-only payload when source URL is a placeholder."""
    captured = {}

    def fake_post_json(*, url, headers, payload, timeout_seconds):
        captured["url"] = url
        captured["headers"] = headers
        captured["payload"] = payload
        raw = b"\x89PNG test"
        b64 = base64.b64encode(raw).decode()
        return {
            "candidates": [{
                "content": {"parts": [
                    {"inlineData": {"mimeType": "image/png", "data": b64}}
                ]}
            }]
        }

    def fake_upload_bytes(key, data, content_type):
        return f"https://cdn.example.com/{key}"

    import app.adapters.nano_banana as nb_mod
    import app.adapters.r2_client as r2_mod
    monkeypatch.setattr(nb_mod, "post_json", fake_post_json)
    monkeypatch.setattr(r2_mod, "upload_bytes", fake_upload_bytes)

    adapter = NanoBananaAdapter(
        integration_mode="real",
        real_calls_enabled=True,
        api_key="test-key-123",
    )
    # r2.example placeholder → no image fetched, plain text-only payload
    result = adapter.submit(
        order_id="ord-real",
        model_id="nano-banana-v1",
        source_key="source/u1/img.jpg",
        source_image_url="https://r2.example/img.jpg",
        prompt="cyberpunk portrait",
        aspect_ratio="1:1",
    )

    assert "gemini-2.5-flash-image:generateContent" in captured["url"]
    assert captured["headers"]["x-goog-api-key"] == "test-key-123"
    parts = captured["payload"]["contents"][0]["parts"]
    # text-only: first (and only) part is the raw prompt (no photo instruction prefix)
    assert parts[0]["text"] == "cyberpunk portrait"
    assert len(parts) == 1
    assert captured["payload"]["generationConfig"]["responseModalities"] == ["TEXT", "IMAGE"]
    assert captured["payload"]["generationConfig"]["imageConfig"]["aspectRatio"] == "1:1"
    assert result.status == "done"
    assert result.result_url.endswith(".png")


def test_real_mode_includes_source_photo_when_url_is_real(monkeypatch) -> None:
    """When source_image_url is a real CDN URL, image is sent as inlineData part."""
    captured = {}
    fake_jpeg = b"\xff\xd8\xff fake jpeg bytes"

    def fake_fetch_bytes(url, timeout_seconds):
        return fake_jpeg

    def fake_post_json(*, url, headers, payload, timeout_seconds):
        captured["payload"] = payload
        raw = b"\x89PNG result"
        b64 = base64.b64encode(raw).decode()
        return {"candidates": [{"content": {"parts": [
            {"inlineData": {"mimeType": "image/png", "data": b64}}
        ]}}]}

    def fake_upload(key, data, content_type):
        return f"https://cdn/{key}"

    import app.adapters.nano_banana as nb_mod
    import app.adapters.r2_client as r2_mod
    monkeypatch.setattr(nb_mod, "fetch_bytes", fake_fetch_bytes)
    monkeypatch.setattr(nb_mod, "post_json", fake_post_json)
    monkeypatch.setattr(r2_mod, "upload_bytes", fake_upload)

    adapter = NanoBananaAdapter(integration_mode="real", real_calls_enabled=True, api_key="k")
    adapter.submit(
        order_id="ord-photo",
        model_id="nano-banana-v1",
        source_key="source/u1/img.jpg",
        source_image_url="https://cdn.real.com/source/u1/img.jpg",
        prompt="Hollywood portrait",
        aspect_ratio="1:1",
    )

    parts = captured["payload"]["contents"][0]["parts"]
    # parts[0] = inlineData (source photo), parts[1] = text with instruction prefix
    assert parts[0]["inlineData"]["mimeType"] == "image/jpeg"
    assert base64.b64decode(parts[0]["inlineData"]["data"]) == fake_jpeg
    assert parts[1]["text"].startswith(_PHOTO_INSTRUCTION)
    assert "Hollywood portrait" in parts[1]["text"]


def test_real_mode_uses_correct_model_per_model_id(monkeypatch) -> None:
    calls = []

    def fake_post_json(*, url, headers, payload, timeout_seconds):
        calls.append(url)
        raw = b"\x89PNG"
        return {"candidates": [{"content": {"parts": [
            {"inlineData": {"mimeType": "image/png", "data": base64.b64encode(raw).decode()}}
        ]}}]}

    def fake_upload(key, data, content_type):
        return f"https://cdn/{key}"

    import app.adapters.nano_banana as nb_mod
    import app.adapters.r2_client as r2_mod
    monkeypatch.setattr(nb_mod, "post_json", fake_post_json)
    monkeypatch.setattr(r2_mod, "upload_bytes", fake_upload)

    adapter = NanoBananaAdapter(integration_mode="real", real_calls_enabled=True, api_key="k")

    for model_id, expected_slug in [
        ("nano-banana-v1", "gemini-2.5-flash-image"),
        ("nano-banana-v2", "gemini-3.1-flash-image-preview"),
        ("nano-banana-pro", "gemini-3-pro-image-preview"),
    ]:
        calls.clear()
        adapter.submit(
            order_id=f"ord-{model_id}",
            model_id=model_id,
            source_key="k",
            source_image_url="https://r2.example/k",
            prompt="test",
            aspect_ratio="1:1",
        )
        assert expected_slug in calls[0], f"{model_id} should call {expected_slug}"


def test_real_mode_raises_on_http_error(monkeypatch) -> None:
    """ProviderHTTPError should propagate — no silent mock fallback in real mode."""
    import app.adapters.nano_banana as nb_mod

    def fail_post(*args, **kwargs):
        raise ProviderHTTPError("http_404: model not found")

    monkeypatch.setattr(nb_mod, "post_json", fail_post)

    adapter = NanoBananaAdapter(integration_mode="real", real_calls_enabled=True, api_key="k")
    with pytest.raises(ProviderHTTPError):
        adapter.submit(
            order_id="ord-fail",
            model_id="nano-banana-v1",
            source_key="k",
            source_image_url="https://r2/k",
            prompt="test",
            aspect_ratio="1:1",
        )
