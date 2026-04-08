from dataclasses import replace as dc_replace

import app.services.tg_bot as tg_bot


class _SvcStub:
    def __init__(self) -> None:
        self.events: list[tuple[str, str, dict]] = []

    def ingest_webhook(self, provider: str, event_id: str, payload: dict):
        self.events.append((provider, event_id, payload))
        return {"accepted": True}


def test_successful_payment_refunds_stars_in_demo_mode(monkeypatch) -> None:
    patched_settings = dc_replace(tg_bot.settings, free_demo_mode=True)
    monkeypatch.setattr(tg_bot, "settings", patched_settings)

    calls: list[tuple[str, dict]] = []

    def fake_tg_api(method: str, payload: dict):
        calls.append((method, payload))
        return {"ok": True, "result": True}

    monkeypatch.setattr(tg_bot, "_tg_api", fake_tg_api)
    svc = _SvcStub()

    tg_bot.handle_successful_payment(
        user_id="12345",
        payload="PACKAGE_STARTER",
        stars=230,
        telegram_payment_charge_id="chg_123",
        svc=svc,
    )

    assert svc.events
    assert svc.events[0][2]["package_code"] == "STARTER"
    assert ("refundStarPayment", {"user_id": 12345, "telegram_payment_charge_id": "chg_123"}) in calls


def test_successful_payment_no_refund_when_demo_mode_disabled(monkeypatch) -> None:
    patched_settings = dc_replace(tg_bot.settings, free_demo_mode=False)
    monkeypatch.setattr(tg_bot, "settings", patched_settings)

    calls: list[tuple[str, dict]] = []

    def fake_tg_api(method: str, payload: dict):
        calls.append((method, payload))
        return {"ok": True, "result": True}

    monkeypatch.setattr(tg_bot, "_tg_api", fake_tg_api)
    svc = _SvcStub()

    tg_bot.handle_successful_payment(
        user_id="12345",
        payload="PACKAGE_STARTER",
        stars=230,
        telegram_payment_charge_id="chg_123",
        svc=svc,
    )

    assert svc.events
    assert all(method != "refundStarPayment" for method, _ in calls)
