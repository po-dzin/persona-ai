from fastapi import FastAPI

from app.routers.v1 import router as v1_router
from app.services.vertical_slice import VerticalSliceService


def create_app() -> FastAPI:
    app = FastAPI(title="Live Photo API", version="0.1.0")
    app.state.slice_service = VerticalSliceService()
    app.include_router(v1_router)

    @app.get("/healthz", tags=["infra"])
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
