"""
Content policy engine.

Checks:
  1. Prompt text — keyword blocklist (fast, no API cost).
  2. Source image — Gemini Vision safety check (uses NANO_BANANA_API_KEY).
     Fails open on API error so a Gemini outage never blocks legitimate users.

Configuration:
  - POLICY_BLOCKED_KEYWORDS: comma-separated extra blocked terms.
  - POLICY_IMAGE_CHECK_ENABLED: set to "false" to disable image check (default: true).
"""
from __future__ import annotations

import base64
import logging
import os
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ── Built-in keyword blocklist ────────────────────────────────────────────────
# Covers explicit NSFW terms and celebrity-name patterns per spec §6.
# Keep entries lowercase; matching is case-insensitive.
_BUILTIN_BLOCKED: list[str] = [
    # Explicit content
    "nude", "naked", "nsfw", "explicit", "porn", "hentai", "xxx",
    # Violence
    "gore", "snuff",
    # Celebrity / public figure guard (MVP sample — extend via env)
    "putin", "trump", "biden", "obama", "zelensky",
]


def _load_blocklist() -> list[re.Pattern[str]]:
    extra_raw = os.getenv("POLICY_BLOCKED_KEYWORDS", "")
    extra = [t.strip().lower() for t in extra_raw.split(",") if t.strip()]
    all_terms = _BUILTIN_BLOCKED + extra
    return [re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE) for term in all_terms]


_BLOCKLIST: list[re.Pattern[str]] = _load_blocklist()


# ── Result type ───────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class PolicyResult:
    passed: bool
    reason_code: str | None = None   # e.g. "blocked_keyword", "blocked_image"


# ── Public API ────────────────────────────────────────────────────────────────

def check_policy(prompt: str, source_image_url: str | None = None) -> PolicyResult:
    """
    Run content policy checks on the generation request.

    Returns PolicyResult(passed=True) if all checks pass.
    Returns PolicyResult(passed=False, reason_code=...) on violation.
    """
    text_result = _check_prompt(prompt)
    if not text_result.passed:
        return text_result

    # Image-level check: stub for Phase 2 Vision API integration
    return _check_image(source_image_url)


def _check_prompt(prompt: str) -> PolicyResult:
    for pattern in _BLOCKLIST:
        if pattern.search(prompt):
            logger.info("policy_engine: prompt blocked by pattern %r", pattern.pattern)
            return PolicyResult(passed=False, reason_code="blocked_keyword")
    return PolicyResult(passed=True)


def _check_image(source_image_url: str | None) -> PolicyResult:
    """
    Gemini Vision safety check.
    Fails open on any API/network error — a Gemini outage must not block users.
    """
    if not source_image_url:
        return PolicyResult(passed=True)

    if not _image_check_enabled():
        return PolicyResult(passed=True)

    from app.core.settings import settings
    api_key = settings.nano_banana_api_key
    if not api_key:
        return PolicyResult(passed=True)

    # Skip placeholder / local dev URLs
    if "r2.example" in source_image_url or not source_image_url.startswith("http"):
        return PolicyResult(passed=True)

    try:
        return _gemini_image_check(source_image_url, api_key)
    except Exception:
        logger.warning("policy_image_check_failed url=%s — failing open", source_image_url, exc_info=True)
        return PolicyResult(passed=True)


def _image_check_enabled() -> bool:
    return os.getenv("POLICY_IMAGE_CHECK_ENABLED", "true").strip().lower() not in {"false", "0", "no"}


_GEMINI_SAFETY_MODEL = "gemini-2.0-flash-lite"
_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

_SAFETY_PROMPT = (
    "You are a content safety classifier. "
    "Look at this image and answer ONLY with one word: SAFE or UNSAFE. "
    "Answer UNSAFE if the image contains: nudity, explicit sexual content, graphic violence, "
    "or real identifiable public figures/celebrities in compromising or manipulated scenarios. "
    "Answer SAFE for normal portraits, selfies, and everyday photos."
)


def _gemini_image_check(image_url: str, api_key: str) -> PolicyResult:
    from app.adapters.http_client import fetch_bytes, post_json

    # Download image (30s timeout — policy check shouldn't block longer)
    raw = fetch_bytes(image_url, timeout_seconds=30)
    mime = "image/png" if raw[:4] == b"\x89PNG" else "image/jpeg"
    b64 = base64.b64encode(raw).decode("ascii")

    payload = {
        "contents": [{
            "parts": [
                {"inlineData": {"mimeType": mime, "data": b64}},
                {"text": _SAFETY_PROMPT},
            ]
        }],
        "generationConfig": {"maxOutputTokens": 4},
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ],
    }

    url = f"{_GEMINI_BASE}/{_GEMINI_SAFETY_MODEL}:generateContent"
    resp = post_json(url, headers={"x-goog-api-key": api_key}, payload=payload, timeout_seconds=20)

    # Parse response
    try:
        answer = resp["candidates"][0]["content"]["parts"][0]["text"].strip().upper()
    except (KeyError, IndexError):
        logger.warning("policy_image_check_unexpected_response resp=%r", resp)
        return PolicyResult(passed=True)

    if "UNSAFE" in answer:
        logger.info("policy_image_check_blocked url=%s answer=%r", image_url, answer)
        return PolicyResult(passed=False, reason_code="blocked_image")

    logger.debug("policy_image_check_passed url=%s answer=%r", image_url, answer)
    return PolicyResult(passed=True)
