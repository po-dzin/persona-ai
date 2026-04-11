from app.adapters.flux import FluxAdapter, _BFL_ENDPOINT, _apply_quality_scale


def test_endpoint_map_has_flux2_sku_ids() -> None:
    assert _BFL_ENDPOINT["flux2-pro-1k"] == "flux-2-pro"
    assert _BFL_ENDPOINT["flux2-pro-4k"] == "flux-2-pro"
    assert _BFL_ENDPOINT["flux2-max-1k"] == "flux-2-max"
    assert _BFL_ENDPOINT["flux2-max-4k"] == "flux-2-max"


def test_quality_scaling_values() -> None:
    assert _apply_quality_scale(model_id="flux2-pro-1k", width=1024, height=1024) == (1024, 1024)
    assert _apply_quality_scale(model_id="flux2-pro-2k", width=1024, height=1024) == (1448, 1448)
    assert _apply_quality_scale(model_id="flux2-pro-4k", width=1024, height=1024) == (2048, 2048)


def test_submit_uses_endpoint_and_scaled_size(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_post_json(*, url, headers, payload, timeout_seconds):
        captured["url"] = url
        captured["payload"] = payload
        return {"id": "task-1"}

    def fake_get_json(*, url, headers, timeout_seconds):
        return {"status": "Ready", "result": {"sample": "https://bfl.example/out.jpg"}}

    def fake_fetch_bytes(url, timeout_seconds):
        return b"fake-jpeg-bytes"

    def fake_upload_bytes(key, data, content_type):
        return f"https://cdn.example.com/{key}"

    import app.adapters.flux as flux_mod
    import app.adapters.r2_client as r2_mod

    monkeypatch.setattr(flux_mod, "post_json", fake_post_json)
    monkeypatch.setattr(flux_mod, "get_json", fake_get_json)
    monkeypatch.setattr(flux_mod, "fetch_bytes", fake_fetch_bytes)
    monkeypatch.setattr(flux_mod.time, "sleep", lambda *_: None)
    monkeypatch.setattr(r2_mod, "upload_bytes", fake_upload_bytes)

    adapter = FluxAdapter(
        integration_mode="real",
        real_calls_enabled=True,
        api_key="test-key",
        poll_interval=0,
        max_polls=1,
    )

    result = adapter.submit(
        order_id="ord-flux",
        model_id="flux2-max-4k",
        source_key="source/u1/img.jpg",
        source_image_url="https://r2.example/source/u1/img.jpg",
        prompt="cinematic portrait",
        aspect_ratio="1:1",
    )

    assert str(captured["url"]).endswith("/flux-2-max")
    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["width"] == 2048
    assert payload["height"] == 2048
    assert result.status == "done"
    assert result.result_url == "https://cdn.example.com/results/flux/ord-flux.jpg"
