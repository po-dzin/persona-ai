from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from urllib.request import Request as UrlRequest, urlopen
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import html as _html

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.responses import HTMLResponse

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

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _require_order_ownership(order: dict[str, Any], user_id: str) -> None:
    if order["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="forbidden")


def get_service(request: Request) -> VerticalSliceService:
    return request.app.state.slice_service


def _sign_share_token(order_id: str) -> str:
    """HMAC-SHA256 signature for share tokens to prevent enumeration."""
    secret = (settings.telegram_bot_token or settings.provider_webhook_secret or "dev-insecure").encode()
    return hmac.new(secret, order_id.encode(), hashlib.sha256).hexdigest()[:16]  # type: ignore[attr-defined]


def _verify_share_token(order_id: str, token: str) -> bool:
    if settings.env in {"dev", "test", "local"} and not token:
        return True
    expected = _sign_share_token(order_id)
    return hmac.compare_digest(token, expected)


def _build_photo_share_link(order: dict[str, Any], request: Request) -> str:
    base = settings.telegram_miniapp_url.strip()
    if not base:
        origin = request.headers.get("origin", "").strip().rstrip("/")
        base = origin or "https://example.com"

    parsed = urlparse(base)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))

    order_id = str(order.get("order_id") or "").strip()
    if order_id:
        query["share_order"] = order_id
        query["share_token"] = _sign_share_token(order_id)

    return urlunparse(parsed._replace(query=urlencode(query)))


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
    svc = get_service(request)
    profile = svc.get_profile(
        user_id,
        first_name=tg_user.get("first_name") if tg_user else None,
        username=tg_user.get("username") if tg_user else None,
    )
    if tg_user:
        get_service(request).on_miniapp_opened(user_id)
    return {"profile": profile}


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

@router.post("/uploads/file")
async def upload_file_direct(
    request: Request,
    user_id: str = Depends(require_user),
    file: UploadFile = File(...),
    filename: str = Form(...),
):
    """Accept a file upload directly (avoids browser CORS with R2 presigned URLs)."""
    upload_limiter.check(request, use_user_id=True)
    suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="invalid_file_type")
    content = await file.read()
    source_key = get_service(request).upload_source_file(user_id, filename, content)
    return {"source_key": source_key}


@router.post("/uploads")
def create_upload(data: UploadRequest, request: Request, user_id: str = Depends(require_user)):
    upload_limiter.check(request, use_user_id=True)
    suffix = "." + data.filename.rsplit(".", 1)[-1].lower() if "." in data.filename else ""
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
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
            enhance_prompt=data.enhance_prompt,
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
    _require_order_ownership(result["order"], user_id)
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
                enhance_prompt=data.enhance_prompt,
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

_KNOWN_WEBHOOK_PROVIDERS = {"telegram", "stripe", "nano_banana", "flux"}


@router.post("/webhooks/{provider}")
def webhook_provider(provider: str, data: WebhookRequest, request: Request):
    """Generic provider/payment webhook — no user auth, protected by PROVIDER_WEBHOOK_SECRET."""
    _verify_webhook_secret(request)
    if provider not in _KNOWN_WEBHOOK_PROVIDERS:
        raise HTTPException(status_code=400, detail="unknown_provider")
    return get_service(request).ingest_webhook(provider, data.event_id, data.payload)


def _verify_webhook_secret(request: Request) -> None:
    secret = settings.provider_webhook_secret
    if not secret or secret == "replace":
        if settings.env not in {"dev", "test", "local"}:
            raise HTTPException(status_code=403, detail="webhook_auth_not_configured")
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
    _require_order_ownership(order, user_id)
    if not order.get("result_url"):
        raise HTTPException(status_code=409, detail="photo_not_ready")
    from app.services.tg_bot import send_photo_to_user
    app_link = _build_photo_share_link(order, request)
    send_photo_to_user(user_id, order["result_url"], app_link=app_link)
    return {"ok": True}


@router.get("/me/photos/{order_id}/share-link")
def get_photo_share_link(order_id: str, request: Request, user_id: str = Depends(require_user)):
    svc = get_service(request)
    try:
        status = svc.order_status(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    order = status["order"]
    _require_order_ownership(order, user_id)
    return {
        "app_link": _build_photo_share_link(order, request),
        "result_url": order.get("result_url"),
    }


@router.get("/me/photos/{order_id}/share-file")
def get_photo_share_file(order_id: str, request: Request, user_id: str = Depends(require_user)):
    """Proxy photo bytes for share sheet to avoid client-side R2/CORS pitfalls."""
    svc = get_service(request)
    try:
        status = svc.order_status(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    order = status["order"]
    _require_order_ownership(order, user_id)
    result_url = str(order.get("result_url") or "").strip()
    if not result_url:
        raise HTTPException(status_code=409, detail="photo_not_ready")

    try:
        upstream = UrlRequest(result_url, headers={"User-Agent": "PersonAI/1.0"})
        with urlopen(upstream, timeout=20) as resp:
            payload = resp.read()
            content_type = resp.headers.get_content_type() or "image/jpeg"
    except Exception as exc:
        raise HTTPException(status_code=502, detail="share_file_unavailable") from exc

    return Response(
        content=payload,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=60"},
    )


@router.get("/share/{order_id}")
def get_shared_photo(order_id: str, request: Request, share_token: str = ""):
    """Public read-only shared photo payload for app deeplinks."""
    if not _verify_share_token(order_id, share_token):
        raise HTTPException(status_code=403, detail="invalid_share_token")
    svc = get_service(request)
    try:
        order = svc._find_order(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if order.status != "done" or not order.result_url:
        raise HTTPException(status_code=404, detail="photo_not_available")

    serialized = svc._serialize_order(order)
    return {
        "order_id": serialized.get("order_id"),
        "style_code": serialized.get("style_code"),
        "model_id": serialized.get("model_id"),
        "result_url": serialized.get("result_url"),
        "created_at": serialized.get("created_at"),
        "updated_at": serialized.get("updated_at"),
    }


@router.get("/share-page/{order_id}", response_class=HTMLResponse, include_in_schema=False)
def get_share_preview_page(order_id: str, request: Request, share_token: str = ""):
    """HTML page with Open Graph meta tags for social sharing previews (Threads, etc.)."""
    if not _verify_share_token(order_id, share_token):
        raise HTTPException(status_code=403, detail="invalid_share_token")
    svc = get_service(request)
    try:
        order = svc._find_order(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if order.status != "done" or not order.result_url:
        raise HTTPException(status_code=404, detail="photo_not_available")

    img_url = _html.escape(order.result_url)
    app_link = _build_photo_share_link({"order_id": order_id}, request)
    app_link_esc = _html.escape(app_link)
    app_link_js = json.dumps(app_link)

    return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>PersonAI ✨</title>
  <meta property="og:title" content="Фото из PersonAI ✨">
  <meta property="og:description" content="Создано с помощью ИИ">
  <meta property="og:image" content="{img_url}">
  <meta property="og:url" content="{app_link_esc}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{img_url}">
  <meta http-equiv="refresh" content="0;url={app_link_esc}">
</head>
<body><script>window.location.replace({app_link_js});</script></body>
</html>""")


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
            svc.get_or_create_user(user_id, first_name=user.get("first_name"), username=user.get("username"))
            svc.on_bot_started(user_id)
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
