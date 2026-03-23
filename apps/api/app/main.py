from pathlib import Path
import sys

from fastapi import FastAPI

# Ensure repo-level packages (e.g. shared.contracts) are importable in managed runtimes.
REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.core.db import init_db
from app.core.settings import settings
from app.routers.v1 import router as v1_router
from app.services.vertical_slice import VerticalSliceService


def _register_tg_webhook() -> None:
    """Register Telegram bot webhook on startup (idempotent)."""
    if not settings.telegram_bot_token or not settings.telegram_miniapp_url:
        return
    try:
        from app.services.tg_bot import register_webhook

        base = settings.telegram_miniapp_url.rstrip("/")
        webhook_url = f"{base}/v1/tg/webhook"
        register_webhook(webhook_url, settings.telegram_webhook_secret)
    except Exception:
        pass  # Non-fatal — can register manually


def create_app() -> FastAPI:
    app = FastAPI(title="Persona Photo API", version="0.2.0")

    @app.on_event("startup")
    def on_startup() -> None:
        init_db()
        _register_tg_webhook()

    app.state.slice_service = VerticalSliceService()
    app.include_router(v1_router)

    @app.get("/healthz", tags=["infra"])
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
