from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, Response, UploadFile

from app.core.auth import require_user, parse_tg_user
from app.core.rate_limit import generate_limiter, tg_webhook_limiter, upload_limiter
from app.core.settings import settings
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

# Thread pool for running blocking provider calls without blocking event loop
_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="gen-worker")


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
def get_balance(request: Request, user_id: str = Depends(require_user)):
    return {"wallet": get_service(request).get_balance(user_id)}


@router.get("/me/profile")
def get_profile(
    request: Request,
    user_id: str = Depends(require_user),
    x_telegram_init_data: str = Header(default=""),
):
    tg_user = parse_tg_user(x_telegram_init_data)
    return {"profile": get_service(request).get_profile(
        user_id,
        first_name=tg_user.get("first_name") if tg_user else None,
        username=tg_user.get("username") if tg_user else None,
    )}


@router.get("/me/photos")
def get_photos(request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    svc.get_or_create_user(user_id)
    return {"photos": svc.photos(user_id)}


@router.get("/me/history")
def get_history(request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    svc.get_or_create_user(user_id)
    return {"orders": svc.history(user_id)}


# ──────────────────────────── uploads ────────────────────────────

_IMAGE_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"RIFF", "image/webp"),   # WebP: RIFF....WEBP — check full header below
]


def _validate_image_magic(content: bytes) -> None:
    """Raise 400 if the file's magic bytes don't match a known image format."""
    for magic, _ in _IMAGE_MAGIC:
        if content[: len(magic)] == magic:
            # Extra check for WebP: bytes 8-11 must be 'WEBP'
            if magic == b"RIFF" and content[8:12] != b"WEBP":
                continue
            return
    raise HTTPException(status_code=400, detail="invalid_file_content")


@router.post("/uploads/file")
async def upload_file_direct(
    request: Request,
    user_id: str = Depends(require_user),
    file: UploadFile = File(...),
    filename: str = Form(...),
):
    """Accept a file upload directly (avoids browser CORS with R2 presigned URLs)."""
    upload_limiter.check(request, use_user_id=True)
    allowed = {".jpg", ".jpeg", ".png", ".webp"}
    suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail="invalid_file_type")
    content = await file.read()
    _validate_image_magic(content)
    source_key = get_service(request).upload_source_file(user_id, filename, content)
    return {"source_key": source_key}


@router.post("/uploads")
def create_upload(data: UploadRequest, request: Request, user_id: str = Depends(require_user)):
    # Validate file extension
    allowed = {".jpg", ".jpeg", ".png", ".webp"}
    suffix = "." + data.filename.rsplit(".", 1)[-1].lower() if "." in data.filename else ""
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail="invalid_file_type")
    return get_service(request).register_upload(user_id=user_id, filename=data.filename)


# ──────────────────────────── orders ─────────────────────────────

@router.post("/orders")
def create_order(data: CreateOrderRequest, request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    try:
        order = svc.create_order(
            user_id,
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
def start_order(order_id: str, data: StartOrderRequest, request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    try:
        return svc.start_order(order_id, requesting_user_id=user_id)
    except ValueError as exc:
        code = str(exc)
        status = 404 if "not_found" in code else 403
        raise HTTPException(status_code=status, detail=code) from exc


@router.get("/orders/{order_id}")
def get_order(order_id: str, request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    try:
        result = svc.order_status(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    # Ensure user can only see their own orders
    if result["order"]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="forbidden")
    return result


# ──────────────────────── generate (async) ───────────────────────

@router.post("/generate")
async def generate(data: GenerateRequest, request: Request, user_id: str = Depends(require_user)):
    """
    Runs provider.submit() in a thread pool so the blocking Flux polling
    (up to 120s) doesn't stall the FastAPI event loop.
    """
    generate_limiter.check(request, use_user_id=True)
    svc = get_service(request)
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            _executor,
            lambda: svc.generate(
                user_id=user_id,
                source_key=data.source_key,
                model_id=data.model_id,
                style_code=data.style_code,
                prompt=data.prompt,
                aspect_ratio=data.aspect_ratio,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


# ──────────────────────────── purchase ───────────────────────────

@router.post("/purchase/invoice")
def purchase_invoice(data: PurchaseRequest, request: Request, user_id: str = Depends(require_user)):
    """Create a Telegram Stars invoice link for the given package."""
    from app.services.tg_bot import create_invoice_link
    if not settings.telegram_bot_token:
        # No bot token: fallback to direct credit for local dev only.
        return get_service(request).purchase(user_id, data.package_code, provider="telegram")
    try:
        link = create_invoice_link(data.package_code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="invoice_creation_failed") from exc
    if not link:
        raise HTTPException(status_code=502, detail="invoice_creation_failed")
    return {"invoice_link": link}


@router.post("/purchase")
def purchase(data: PurchaseRequest, request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    try:
        return svc.purchase(user_id, data.package_code, provider=data.provider)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ──────────────────────────── webhooks ───────────────────────────

@router.post("/webhooks/{provider}")
def webhook_provider(provider: str, data: WebhookRequest, request: Request):
    """Generic provider/payment webhook — no user auth, protected by PROVIDER_WEBHOOK_SECRET."""
    _verify_webhook_secret(request)
    return get_service(request).ingest_webhook(provider, data.event_id, data.payload)


def _verify_webhook_secret(request: Request) -> None:
    secret = settings.provider_webhook_secret
    if not secret or secret == "replace":
        return
    token = request.headers.get("X-Webhook-Secret", "")
    if not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=403, detail="invalid_webhook_secret")


# ──────────────────── favorites ──────────────────────────────────

@router.post("/me/photos/{order_id}/favorite")
def toggle_favorite(order_id: str, request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    try:
        return svc.toggle_favorite(user_id, order_id)
    except ValueError as exc:
        code = str(exc)
        status = 404 if "not_found" in code else 403
        raise HTTPException(status_code=status, detail=code) from exc


@router.delete("/me/photos/{order_id}")
def delete_photo(order_id: str, request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    try:
        return svc.delete_photo(user_id, order_id)
    except ValueError as exc:
        code = str(exc)
        status = 404 if "not_found" in code else 403
        raise HTTPException(status_code=status, detail=code) from exc


# ──────────────────── send photo to Telegram ─────────────────────

@router.post("/me/photos/{order_id}/send")
def send_photo_to_telegram(order_id: str, request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    try:
        status = svc.order_status(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    order = status["order"]
    if order["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="forbidden")
    if not order.get("result_url"):
        raise HTTPException(status_code=409, detail="photo_not_ready")
    from app.services.tg_bot import send_photo_to_user
    send_photo_to_user(user_id, order["result_url"])
    return {"ok": True}


# ──────────────────── Telegram bot webhook ────────────────────────

@router.post("/tg/webhook")
async def telegram_bot_webhook(request: Request):
    """
    Receives Telegram bot updates.
    Validates X-Telegram-Bot-Api-Secret-Token header.
    Handles: /start, pre_checkout_query, successful_payment.
    """
    tg_webhook_limiter.check(request)
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

    message = update.get("message") or {}
    text = message.get("text", "")
    chat_id = (message.get("chat") or {}).get("id")
    user = message.get("from") or {}
    user_id = str(user.get("id")) if user.get("id") else None

    if text.startswith("/start") and chat_id:
        if user_id:
            svc.get_or_create_user(
                user_id,
                first_name=user.get("first_name"),
                username=user.get("username"),
            )
        await send_start_message(chat_id)
        return

    pcq = update.get("pre_checkout_query")
    if pcq:
        await answer_pre_checkout(pcq["id"])
        return

    sp = message.get("successful_payment")
    if sp and user_id:
        handle_successful_payment(
            user_id=user_id,
            payload=sp.get("invoice_payload", ""),
            stars=sp.get("total_amount", 0),
            telegram_payment_charge_id=sp.get("telegram_payment_charge_id", ""),
            svc=svc,
        )
