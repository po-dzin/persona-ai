from __future__ import annotations

import base64

from app.adapters.http_client import ProviderHTTPError, post_json
from app.adapters.mock_provider import MockPhotoProvider
from app.adapters.provider_base import ProviderSubmitResult

# Gemini image generation API
_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Internal model_id → Gemini model name
_MODEL_MAP: dict[str, str] = {
    "nano-banana-v1":  "gemini-2.5-flash-image",           # fast v1
    "nano-banana-v2":  "gemini-3.1-flash-image-preview",   # fast v2
    "nano-banana-pro": "gemini-3-pro-image-preview",        # pro
}
_DEFAULT_MODEL = "gemini-2.5-flash-image"

# Accepted aspect ratios (superset supported by all models)
_VALID_AR = {"1:1", "3:4", "4:3", "9:16", "16:9"}


class NanoBananaAdapter(MockPhotoProvider):
    """
    Nano Banana = Google Gemini image generation via AI Studio API.

    nano-banana-v1  → gemini-2.5-flash-image          (fast v1,  10 coins)
    nano-banana-v2  → gemini-3.1-flash-image-preview  (fast v2,  20 coins)
    nano-banana-pro → gemini-3-pro-image-preview       (pro,      50 coins)

    Text-to-image. Source photo is ignored; style is conveyed via prompt.
    Result: base64 PNG → stored in R2.
    """

    def __init__(
        self,
        *,
        integration_mode: str = "mock",
        real_calls_enabled: bool = False,
        api_key: str = "",
        timeout_seconds: int = 60,
    ) -> None:
        super().__init__(provider_id="nano_banana")
        self.integration_mode = integration_mode
        self.real_calls_enabled = real_calls_enabled
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def submit(
        self,
        *,
        order_id: str,
        model_id: str,
        source_key: str,
        source_image_url: str,
        prompt: str,
        aspect_ratio: str,
    ) -> ProviderSubmitResult:
        if not self._is_real():
            return super().submit(
                order_id=order_id,
                model_id=model_id,
                source_key=source_key,
                source_image_url=source_image_url,
                prompt=prompt,
                aspect_ratio=aspect_ratio,
            )

        gemini_model = _MODEL_MAP.get(model_id, _DEFAULT_MODEL)
        ar = aspect_ratio if aspect_ratio in _VALID_AR else "1:1"
        url = f"{_GEMINI_BASE}/{gemini_model}:generateContent"

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": ar,
                    "imageSize": "1K",
                },
            },
        }

        resp = post_json(
            url=url,
            headers={"x-goog-api-key": self.api_key},
            payload=payload,
            timeout_seconds=self.timeout_seconds,
        )

        img_bytes, mime_type = _extract_image(resp)
        ext = "png" if "png" in mime_type else "jpg"
        result_url = self._store_to_r2(img_bytes, order_id, ext)
        return ProviderSubmitResult(
            provider_task_id=f"{gemini_model}-{order_id}",
            status="done",
            result_url=result_url,
        )

    @staticmethod
    def _store_to_r2(img_bytes: bytes, order_id: str, ext: str) -> str:
        from app.adapters.r2_client import upload_bytes

        content_type = "image/png" if ext == "png" else "image/jpeg"
        key = f"results/nano/{order_id}.{ext}"
        return upload_bytes(key, img_bytes, content_type=content_type)

    def _is_real(self) -> bool:
        return (
            self.integration_mode == "real"
            and self.real_calls_enabled
            and bool(self.api_key)
        )


def _extract_image(resp: dict) -> tuple[bytes, str]:
    """Pull the first image part out of a Gemini generateContent response."""
    candidates = resp.get("candidates") or []
    if not candidates:
        raise ProviderHTTPError("gemini_no_candidates")

    parts = (candidates[0].get("content") or {}).get("parts") or []
    for part in parts:
        inline = part.get("inlineData") or {}
        mime = inline.get("mimeType", "")
        data = inline.get("data", "")
        if data and mime.startswith("image/"):
            return base64.b64decode(data), mime

    raise ProviderHTTPError("gemini_no_image_in_response")
