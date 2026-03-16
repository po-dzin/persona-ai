from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4


@dataclass
class MockPaymentResult:
    event_id: str
    provider: str
    status: str


class MockPaymentAdapter:
    """Mock adapter for Stars/Stripe with webhook event shape compatibility."""

    def create_paid_event(self, provider: str, user_id: str, package_code: str) -> tuple[str, dict]:
        event_id = str(uuid4())
        payload = {
            "payment_id": str(uuid4()),
            "user_id": user_id,
            "package_code": package_code,
            "status": "paid",
        }
        return event_id, payload
