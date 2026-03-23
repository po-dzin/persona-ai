from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response

from app.models.api_models import (
    CreateOrderRequest,
    GenerateRequest,
    PurchaseRequest,
    StartOrderRequest,
    UploadRequest,
    WebhookRequest,
)
from app.services.vertical_slice import VerticalSliceService
from app.core.settings import settings

router = APIRouter(prefix="/v1", tags=["v1"])


def get_service(request: Request) -> VerticalSliceService:
    return request.app.state.slice_service


# ──────────────────────────── catalog ────────────────────────────

@router.get("/styles")
def list_styles(request: Request):
    return {"styles": get_service(request).list_styles()}


@router.get("/models")
def list_models(request: Request):
    return {"models": get_service(request).list_models()}


@router.get("/packages")
def list_packages(request: Request):
    return {"packages": get_service(request).list_packages()}


# ──────────────────────────── user ───────────────────────────────

@router.get("/me/balance")
def get_balance(user_id: str, request: Request):
    return {"wallet": get_service(request).get_balance(user_id)}


@router.get("/me/photos")
def get_photos(user_id: str, request: Request):
    svc = get_service(request)
    svc.get_or_create_user(user_id)
    return {"photos": svc.photos(user_id)}


@router.get("/me/history")
def get_history(user_id: str, request: Request):
    svc = get_service(request)
    svc.get_or_create_user(user_id)
    return {"orders": svc.history(user_id)}


# ──────────────────────────── uploads ────────────────────────────

@router.post("/uploads")
def create_upload(data: UploadRequest, request: Request):
    return get_service(request).register_upload(user_id=data.user_id, filename=data.filename)


# ──────────────────────────── orders ─────────────────────────────

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
        result = svc.start_order(order_id)
    except ValueError as exc:
        status = 404 if "not_found" in str(exc) else 403
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    return result


@router.get("/orders/{order_id}")
def get_order(order_id: str, request: Request):
    svc = get_service(request)
    try:
        return svc.order_status(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ──────────────────────────── generate ───────────────────────────

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


# ──────────────────────────── purchase ───────────────────────────

@router.post("/purchase")
def purchase(data: PurchaseRequest, request: Request):
    svc = get_service(request)
    try:
        return svc.purchase(data.user_id, data.package_code, provider=data.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ──────────────────────────── webhooks ───────────────────────────

@router.post("/webhooks/{provider}")
def webhook_provider(provider: str, data: WebhookRequest, request: Request):
    return get_service(request).ingest_webhook(provider, data.event_id, data.payload)


@router.post("/webhooks/replicate")
def webhook_replicate(data: WebhookRequest, request: Request):
    return get_service(request).ingest_webhook("replicate", data.event_id, data.payload)


@router.post("/webhooks/stripe")
def webhook_stripe(data: WebhookRequest, request: Request):
    return get_service(request).ingest_webhook("stripe", data.event_id, data.payload)


# ──────────────────── Telegram bot webhook ────────────────────────

@router.post("/tg/webhook")
async def telegram_bot_webhook(request: Request):
    """
    Receives Telegram bot updates.
    Validates X-Telegram-Bot-Api-Secret-Token header.
    Handles: /start, pre_checkout_query, successful_payment.
    """
    secret = settings.telegram_webhook_secret
    if secret:
        token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not hmac.compare_digest(token, secret):
            return Response(status_code=403)

    body = await request.body()
    try:
        update: dict[str, Any] = json.loads(body)
    except Exception:
        return Response(status_code=400)

    svc = get_service(request)
    await _handle_tg_update(update, svc)
    return {"ok": True}


async def _handle_tg_update(update: dict[str, Any], svc: VerticalSliceService) -> None:
    from app.services.tg_bot import (
        answer_pre_checkout,
        handle_successful_payment,
        send_start_message,
    )

    # /start command
    message = update.get("message") or {}
    text = message.get("text", "")
    chat_id = (message.get("chat") or {}).get("id")
    user = message.get("from") or {}
    user_id = str(user.get("id", "")) if user.get("id") else None

    if text.startswith("/start") and chat_id:
        await send_start_message(chat_id)
        return

    # Stars: must approve pre_checkout_query within 10s
    pcq = update.get("pre_checkout_query")
    if pcq:
        await answer_pre_checkout(pcq["id"])
        return

    # Stars: successful_payment → credit user
    sp = message.get("successful_payment")
    if sp and user_id:
        handle_successful_payment(
            user_id=user_id,
            payload=sp.get("invoice_payload", ""),
            stars=sp.get("total_amount", 0),
            svc=svc,
        )
