from __future__ import annotations

from datetime import timedelta

from app.core.db import UserRow, get_session
from app.services.lifecycle import now_utc
from app.services.lifecycle_messaging import maybe_send_lifecycle_message


def _mk_user(user_id: str, state: str) -> UserRow:
    now = now_utc()
    return UserRow(
        user_id=user_id,
        paid_credits=20,
        lifecycle_state=state,
        created_at=now,
    )


def test_s1_message_waits_24h(monkeypatch) -> None:
    calls: list[tuple[str, str]] = []

    def _fake_send(chat_id: int | str, text: str) -> bool:
        calls.append((str(chat_id), text))
        return True

    monkeypatch.setattr("app.services.lifecycle_messaging.send_text_message", _fake_send)

    with get_session() as db:
        user = _mk_user("u-msg-s1", "S1")
        user.first_miniapp_opened_at = now_utc()
        db.add(user)
        assert maybe_send_lifecycle_message(db, user, now=now_utc()) is False
        assert calls == []

        due_at = user.first_miniapp_opened_at + timedelta(hours=24, minutes=1)
        assert maybe_send_lifecycle_message(db, user, now=due_at) is True
        assert len(calls) == 1


def test_state_cooldown_blocks_duplicate_within_day(monkeypatch) -> None:
    calls: list[tuple[str, str]] = []

    def _fake_send(chat_id: int | str, text: str) -> bool:
        calls.append((str(chat_id), text))
        return True

    monkeypatch.setattr("app.services.lifecycle_messaging.send_text_message", _fake_send)

    with get_session() as db:
        now = now_utc()
        user = _mk_user("u-msg-s4", "S4")
        db.add(user)
        assert maybe_send_lifecycle_message(db, user, now=now) is True
        assert maybe_send_lifecycle_message(db, user, now=now + timedelta(hours=2)) is False
        assert len(calls) == 1


def test_state_change_allows_immediate_send(monkeypatch) -> None:
    calls: list[tuple[str, str]] = []

    def _fake_send(chat_id: int | str, text: str) -> bool:
        calls.append((str(chat_id), text))
        return True

    monkeypatch.setattr("app.services.lifecycle_messaging.send_text_message", _fake_send)

    with get_session() as db:
        now = now_utc()
        user = _mk_user("u-msg-s4s5", "S4")
        db.add(user)
        assert maybe_send_lifecycle_message(db, user, now=now) is True
        user.lifecycle_state = "S5"
        assert maybe_send_lifecycle_message(db, user, now=now + timedelta(minutes=1)) is True
        assert len(calls) == 2
