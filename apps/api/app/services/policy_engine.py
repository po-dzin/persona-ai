"""
Content policy engine — MVP keyword filter.

Phase 1:
  - Prompt text is checked against a blocklist of explicit/celebrity keywords.
  - Image-level check is a no-op stub (returns passed=True) as a hook for
    future Vision API integration.

Configuration:
  - POLICY_BLOCKED_KEYWORDS env var: comma-separated additional blocked terms
    (merged with the built-in list at startup).
"""
from __future__ import annotations

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
    """Stub: always passes. Replace with Vision API call in Phase 2."""
    return PolicyResult(passed=True)
