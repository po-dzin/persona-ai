from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models.api_models import (
    CreateOrderRequest,
    StartOrderRequest,
    UploadRequest,
    WebhookRequest,
)
from app.services.vertical_slice import VerticalSliceService

router = APIRouter(prefix="/v1", tags=["v1"])


def get_service(request: Request) -> VerticalSliceService:
    return request.app.state.slice_service


@router.post("/uploads")
def create_upload(data: UploadRequest, request: Request):
    svc = get_service(request)
    return svc.register_upload(user_id=data.user_id, filename=data.filename)


@router.get("/packages")
def list_packages(request: Request):
    svc = get_service(request)
    return {"packages": svc.list_packages()}


@router.post("/orders")
def create_order(data: CreateOrderRequest, request: Request):
    svc = get_service(request)
    order = svc.create_order(data.user_id, data.style_code, data.source_key)
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
