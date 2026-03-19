from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models.api_models import (
    CreateOrderRequest,
    GenerateRequest,
    PurchaseRequest,
    StartOrderRequest,
    UploadRequest,
    WebhookRequest,
)
from app.services.vertical_slice import VerticalSliceService

router = APIRouter(prefix="/v1", tags=["v1"])


def get_service(request: Request) -> VerticalSliceService:
    return request.app.state.slice_service


@router.get("/styles")
def list_styles(request: Request):
    svc = get_service(request)
    return {"styles": svc.list_styles()}


@router.get("/models")
def list_models(request: Request):
    svc = get_service(request)
    return {"models": svc.list_models()}


@router.get("/packages")
def list_packages(request: Request):
    svc = get_service(request)
    return {"packages": svc.list_packages()}


@router.get("/me/balance")
def get_balance(user_id: str, request: Request):
    svc = get_service(request)
    return {"wallet": svc.get_balance(user_id)}


@router.get("/me/photos")
def get_photos(user_id: str, request: Request):
    svc = get_service(request)
    _ = svc.get_or_create_user(user_id)
    return {"photos": svc.photos(user_id)}


@router.post("/purchase")
def purchase(data: PurchaseRequest, request: Request):
    svc = get_service(request)
    try:
        return svc.purchase(data.user_id, data.package_code, provider=data.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/generate")
def generate(data: GenerateRequest, request: Request):
    svc = get_service(request)
    try:
        return svc.generate(
            user_id=data.user_id,
            source_key=data.source_key,
            model_id=data.model_id,
            style_code=data.style_code,
            prompt=data.prompt,
            aspect_ratio=data.aspect_ratio,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/uploads")
def create_upload(data: UploadRequest, request: Request):
    svc = get_service(request)
    return svc.register_upload(user_id=data.user_id, filename=data.filename)


@router.post("/orders")
def create_order(data: CreateOrderRequest, request: Request):
    svc = get_service(request)
    try:
        order = svc.create_order(
            data.user_id,
            data.style_code,
            data.source_key,
            model_id=data.model_id,
            prompt=data.prompt,
            aspect_ratio=data.aspect_ratio,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"order": svc._serialize_order(order)}


@router.post("/orders/{order_id}/start")
def start_order(order_id: str, data: StartOrderRequest, request: Request):
    svc = get_service(request)
    try:
        order = svc.orders[order_id]
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="order_not_found") from exc

    if order.user_id != data.user_id:
        raise HTTPException(status_code=403, detail="forbidden")

    result = svc.start_order(order_id)
    if result["result"] == "paywall_required":
        return result
    return result


@router.get("/orders/{order_id}")
def get_order(order_id: str, request: Request):
    svc = get_service(request)
    if order_id not in svc.orders:
        raise HTTPException(status_code=404, detail="order_not_found")
    return svc.order_status(order_id)


@router.get("/me/history")
def get_history(user_id: str, request: Request):
    svc = get_service(request)
    _ = svc.get_or_create_user(user_id)
    return {"orders": svc.history(user_id)}


@router.post("/webhooks/{provider}")
def webhook_provider(provider: str, data: WebhookRequest, request: Request):
    svc = get_service(request)
    return svc.ingest_webhook(provider, data.event_id, data.payload)


@router.post("/webhooks/replicate")
def webhook_replicate(data: WebhookRequest, request: Request):
    svc = get_service(request)
    return svc.ingest_webhook("replicate", data.event_id, data.payload)


@router.post("/webhooks/telegram")
def webhook_telegram(data: WebhookRequest, request: Request):
    svc = get_service(request)
    return svc.ingest_webhook("telegram", data.event_id, data.payload)


@router.post("/webhooks/stripe")
def webhook_stripe(data: WebhookRequest, request: Request):
    svc = get_service(request)
    return svc.ingest_webhook("stripe", data.event_id, data.payload)
