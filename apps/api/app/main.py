from pathlib import Path
import sys

from fastapi import FastAPI

# Ensure repo-level packages (e.g. shared.contracts) are importable in managed runtimes.
REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.routers.v1 import router as v1_router
from app.services.vertical_slice import VerticalSliceService


def create_app() -> FastAPI:
    app = FastAPI(title="Persona Photo API", version="0.2.0")
    app.state.slice_service = VerticalSliceService()
    app.include_router(v1_router)

    @app.get("/healthz", tags=["infra"])
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
