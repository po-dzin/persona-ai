"""
Unit tests for the content policy engine.

Covers:
  - Clean prompts pass through
  - Explicit keyword in prompt → blocked_keyword
  - Celebrity name in prompt → blocked_keyword
  - Case-insensitive matching
  - Image check stub always passes
  - Extra keywords from env var are respected
"""

import os
import importlib

import pytest


def _reload_engine():
    """Reload policy_engine to pick up env var changes."""
    import app.services.policy_engine as mod
    importlib.reload(mod)
    return mod


# ──────────────────────── clean prompts ──────────────────────────────

def test_policy_passes_clean_prompt() -> None:
    from app.services.policy_engine import check_policy
    result = check_policy("beautiful portrait in studio lighting")
    assert result.passed is True
    assert result.reason_code is None


def test_policy_passes_empty_prompt() -> None:
    from app.services.policy_engine import check_policy
    result = check_policy("")
    assert result.passed is True


# ──────────────────────── keyword blocking ───────────────────────────

def test_policy_blocks_explicit_keyword() -> None:
    from app.services.policy_engine import check_policy
    result = check_policy("nude portrait")
    assert result.passed is False
    assert result.reason_code == "blocked_keyword"


def test_policy_blocks_nsfw_keyword() -> None:
    from app.services.policy_engine import check_policy
    result = check_policy("this is NSFW content")
    assert result.passed is False
    assert result.reason_code == "blocked_keyword"


def test_policy_blocks_celebrity_name() -> None:
    from app.services.policy_engine import check_policy
    result = check_policy("photo of trump at the beach")
    assert result.passed is False
    assert result.reason_code == "blocked_keyword"


def test_policy_matching_is_case_insensitive() -> None:
    from app.services.policy_engine import check_policy
    result = check_policy("NUDE beach photo")
    assert result.passed is False


def test_policy_does_not_block_partial_word_matches() -> None:
    """'nude' embedded inside another word should NOT trigger (word boundary)."""
    from app.services.policy_engine import check_policy
    # 'nude' inside 'conduces' → no word boundary match
    result = check_policy("conduces artistic style")
    assert result.passed is True


# ──────────────────────── image check stub ───────────────────────────

def test_policy_image_check_passes_by_default() -> None:
    from app.services.policy_engine import check_policy
    result = check_policy("clean prompt", source_image_url="https://cdn.example.com/photo.jpg")
    assert result.passed is True


def test_policy_image_check_passes_with_none_url() -> None:
    from app.services.policy_engine import check_policy
    result = check_policy("clean prompt", source_image_url=None)
    assert result.passed is True


# ──────────────────────── env var extension ──────────────────────────

def test_extra_blocked_keywords_from_env(monkeypatch) -> None:
    monkeypatch.setenv("POLICY_BLOCKED_KEYWORDS", "unicorn,dragonfire")
    mod = _reload_engine()
    result = mod.check_policy("a dragonfire scene")
    assert result.passed is False
    assert result.reason_code == "blocked_keyword"

    result2 = mod.check_policy("a unicorn meadow")
    assert result2.passed is False


def test_env_extension_does_not_affect_clean_prompts(monkeypatch) -> None:
    monkeypatch.setenv("POLICY_BLOCKED_KEYWORDS", "testword123")
    mod = _reload_engine()
    result = mod.check_policy("completely clean and beautiful portrait")
    assert result.passed is True
