from dataclasses import replace as dc_replace

import app.services.tg_bot as tg_bot


class _SvcStub:
    def __init__(self) -> None:
        self.events: list[tuple[str, str, dict]] = []

    def ingest_webhook(self, provider: str, event_id: str, payload: dict):
        self.events.append((provider, event_id, payload))
        return {"accepted": True}


def test_successful_payment_refunds_stars_for_test_package_in_demo_mode(monkeypatch) -> None:
    """Only the TEST package is refunded in demo mode; real packages are not."""
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
        payload="PACKAGE_TEST",
        stars=1,
        telegram_payment_charge_id="chg_123",
        svc=svc,
    )

    assert svc.events
    assert svc.events[0][2]["package_code"] == "TEST"
    assert ("refundStarPayment", {"user_id": 12345, "telegram_payment_charge_id": "chg_123"}) in calls


def test_real_package_not_refunded_in_demo_mode(monkeypatch) -> None:
    """Real packages must never be auto-refunded even with FREE_DEMO_MODE=true."""
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
    assert all(method != "refundStarPayment" for method, _ in calls)


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


def test_create_invoice_link_uses_total_credits_with_bonus(monkeypatch) -> None:
    patched_settings = dc_replace(tg_bot.settings, free_demo_mode=False)
    monkeypatch.setattr(tg_bot, "settings", patched_settings)

    captured: dict[str, dict] = {}

    def fake_tg_api(method: str, payload: dict):
        captured[method] = payload
        return {"ok": True, "result": "https://t.me/invoice/demo"}

    monkeypatch.setattr(tg_bot, "_tg_api", fake_tg_api)

    link = tg_bot.create_invoice_link("POPULAR")

    assert link == "https://t.me/invoice/demo"
    invoice_payload = captured["createInvoiceLink"]
    assert invoice_payload["title"] == "Popular — 880 монет"
    assert invoice_payload["description"] == "Пополнение баланса PersonAI на 880 монет"
