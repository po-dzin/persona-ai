from contextlib import asynccontextmanager
import logging
from pathlib import Path
import sys
from typing import AsyncGenerator

from app.core.logging_config import configure_logging

configure_logging()  # must be first, before any logger is created

from fastapi import FastAPI, Response
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

# Ensure repo-level packages (e.g. shared.contracts) are importable in managed runtimes.
REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.core.db import get_system_session, init_db
from app.core.settings import settings
from app.routers.v1 import router as v1_router, _executor
from app.routers.admin import router as admin_router
from app.services.vertical_slice import VerticalSliceService
from app.services.lifecycle import run_backfill_once


_logger = logging.getLogger(__name__)


def _warn_missing_secrets() -> None:
    """Log warnings for security-critical settings that are not configured."""
    from app.core.settings import settings

    if not settings.telegram_webhook_secret:
        _logger.warning(
            "TELEGRAM_WEBHOOK_SECRET is not set — Telegram webhook endpoint is unauthenticated. "
            "Set this env var in production."
        )
    if not settings.provider_webhook_secret or settings.provider_webhook_secret == "replace":
        _logger.warning(
            "PROVIDER_WEBHOOK_SECRET is not set or is placeholder — provider webhook is unauthenticated."
        )


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


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    init_db()
    try:
        with get_system_session() as session:
            ran, users_count = run_backfill_once(session)
            if ran:
                _logger.info("lifecycle_backfill_completed users=%s", users_count)
    except Exception:
        _logger.exception("lifecycle_backfill_failed")
    _warn_missing_secrets()
    _register_tg_webhook()
    yield
    _logger.info("shutdown_start waiting for thread executor")
    _executor.shutdown(wait=True)
    _logger.info("shutdown_complete")


def create_app() -> FastAPI:
    app = FastAPI(title="Persona Photo API", version="0.2.0", lifespan=_lifespan)

    app.state.slice_service = VerticalSliceService()
    app.include_router(v1_router)
    app.include_router(admin_router)

    @app.get("/healthz", tags=["infra"])
    def healthz() -> Response:
        try:
            with get_session() as db:
                db.execute(text("SELECT 1"))
            return Response(content='{"status":"ok"}', media_type="application/json")
        except Exception:
            _logger.exception("healthz_db_check_failed")
            return Response(content='{"status":"degraded"}', media_type="application/json", status_code=503)

    # Serve built admin app (present after Docker build or manual build)
    admin_dist = REPO_ROOT / "apps" / "admin" / "dist"
    if admin_dist.exists():
        admin_assets = admin_dist / "assets"
        if admin_assets.exists():
            app.mount("/admin/assets", StaticFiles(directory=str(admin_assets)), name="admin-assets")

        @app.get("/admin", include_in_schema=False)
        @app.get("/admin/", include_in_schema=False)
        def admin_root() -> FileResponse:
            return FileResponse(str(admin_dist / "index.html"))

    # Serve built React app (present after Docker build)
    web_dist = REPO_ROOT / "apps" / "web" / "dist"
    if web_dist.exists():
        assets_dir = web_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="web-assets")

        @app.get("/", include_in_schema=False)
        def root() -> FileResponse:
            return FileResponse(str(web_dist / "index.html"))

        # SPA catch-all: return index.html for all non-API paths
        @app.get("/{full_path:path}", include_in_schema=False)
        def spa_fallback(full_path: str) -> FileResponse:
            return FileResponse(str(web_dist / "index.html"))
    else:
        # No frontend build — redirect root to API docs
        @app.get("/", include_in_schema=False)
        def root() -> RedirectResponse:  # type: ignore[misc]
            return RedirectResponse(url="/docs")

    return app


app = create_app()
