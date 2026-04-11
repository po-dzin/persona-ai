from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.services.prompt_compiler import compile_prompt_template


_STYLE_SPEC_PATH = Path(__file__).resolve().parents[4] / "shared" / "contracts" / "style_specs.json"

_CATEGORY_VARIATION_AXES = {
    "portrait": ["camera angle", "expression", "light", "camera distance"],
    "business": ["camera angle", "expression", "background"],
    "lifestyle": ["background", "light", "camera distance", "expression"],
    "event": ["background", "expression", "palette shift", "motion"],
    "art": ["camera angle", "background", "motion", "color mode"],
    "culture": ["background", "wardrobe", "palette shift", "camera angle"],
}


def load_style_catalog() -> list[dict[str, Any]]:
    raw_styles = _load_raw_styles()
    return [_normalize_style_entry(style) for style in raw_styles]


def _load_raw_styles() -> list[dict[str, Any]]:
    if not _STYLE_SPEC_PATH.exists():
        raise RuntimeError(f"style spec file not found: {_STYLE_SPEC_PATH}")
    payload = json.loads(_STYLE_SPEC_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise RuntimeError("style spec file must contain an array")
    return [item for item in payload if isinstance(item, dict)]


def _normalize_style_entry(raw: dict[str, Any]) -> dict[str, Any]:
    prompt_template = _as_text(raw.get("promptTemplate") or raw.get("prompt_template"))
    category = _as_text(raw.get("category")) or "Студийный портрет"
    bucket = _category_bucket(category)

    style: dict[str, Any] = {
        "id": _as_text(raw.get("id")),
        "name": _as_text(raw.get("name")),
        "category": category,
        "gradient": _as_text(raw.get("gradient")),
        "is_trending": bool(raw.get("isTrending") or raw.get("is_trending")),
        "is_new": bool(raw.get("isNew") or raw.get("is_new")),
    }
    style["prompt_spec"] = _normalize_prompt_spec(raw.get("promptSpec") or raw.get("prompt_spec"), prompt_template, bucket)
    style["stylization_level"] = _normalize_stylization_level(raw.get("stylizationLevel") or raw.get("stylization_level"), bucket)
    style["style_anchors"] = _normalize_anchors(raw.get("styleAnchors") or raw.get("style_anchors"), prompt_template)
    style["variation_axes"] = _normalize_variation_axes(raw.get("variationAxes") or raw.get("variation_axes"), bucket)
    style["prompt_template"] = compile_prompt_template(style)
    return style


def _normalize_prompt_spec(raw: Any, prompt_template: str, bucket: str) -> dict[str, str]:
    if isinstance(raw, dict):
        return {
            "subject": _as_text(raw.get("subject")) or _default_subject(bucket),
            "style_core": _as_text(raw.get("styleCore") or raw.get("style_core")) or _default_style_core(prompt_template),
            "context": _as_text(raw.get("context")) or _default_context(bucket),
            "camera": _as_text(raw.get("camera")) or _default_camera(bucket),
            "light_color_texture": _as_text(raw.get("lightColorTexture") or raw.get("light_color_texture")) or _default_light(prompt_template),
            "emotion": _as_text(raw.get("emotion")) or _default_emotion(bucket),
            "output_intent": _as_text(raw.get("outputIntent") or raw.get("output_intent")) or _default_output_intent(bucket),
            "negative": _as_text(raw.get("negative")),
        }
    return {
        "subject": _default_subject(bucket),
        "style_core": _default_style_core(prompt_template),
        "context": _default_context(bucket),
        "camera": _default_camera(bucket),
        "light_color_texture": _default_light(prompt_template),
        "emotion": _default_emotion(bucket),
        "output_intent": _default_output_intent(bucket),
        "negative": "",
    }


def _normalize_stylization_level(raw: Any, bucket: str) -> int:
    try:
        level = int(raw)
        return min(5, max(1, level))
    except (TypeError, ValueError):
        if bucket == "art":
            return 5
        if bucket == "culture":
            return 3
        if bucket == "business":
            return 2
        return 2


def _normalize_anchors(raw: Any, prompt_template: str) -> list[str]:
    if isinstance(raw, list):
        result = [_as_text(v) for v in raw]
        result = [v for v in result if v]
        if result:
            return result[:5]
    segments = [seg.strip() for seg in prompt_template.split(",") if seg.strip()]
    if not segments:
        return ["clean portrait aesthetic"]
    return segments[:5]


def _normalize_variation_axes(raw: Any, bucket: str) -> list[str]:
    if isinstance(raw, list):
        result = [_as_text(v) for v in raw]
        result = [v for v in result if v]
        if result:
            return result[:5]
    return _CATEGORY_VARIATION_AXES.get(bucket, _CATEGORY_VARIATION_AXES["portrait"])


def _default_style_core(prompt_template: str) -> str:
    segments = [seg.strip() for seg in prompt_template.split(",") if seg.strip()]
    if segments:
        return segments[0]
    return "clean portrait aesthetic"


def _default_light(prompt_template: str) -> str:
    segments = [seg.strip() for seg in prompt_template.split(",") if seg.strip()]
    if len(segments) >= 2:
        return ", ".join(segments[1:4])
    return "soft directional light, balanced palette, natural texture"


def _default_subject(bucket: str) -> str:
    if bucket == "business":
        return "professional person portrait with natural facial proportions"
    if bucket == "event":
        return "celebratory portrait with expressive natural pose"
    if bucket == "art":
        return "person portrait transformed into artistic interpretation"
    return "confident person portrait with natural facial proportions"


def _default_context(bucket: str) -> str:
    if bucket == "business":
        return "clean modern office or studio environment"
    if bucket == "lifestyle":
        return "coherent lifestyle environment"
    if bucket == "event":
        return "occasion-focused event environment"
    if bucket == "art":
        return "stylized visual world aligned with the style"
    if bucket == "culture":
        return "culture-specific environment cues"
    return "coherent portrait environment"


def _default_camera(bucket: str) -> str:
    if bucket == "business":
        return "medium shot, front or 3/4 angle, clean portrait framing"
    if bucket == "art":
        return "dynamic portrait framing with cinematic depth"
    return "close-up or medium portrait, 85mm lens look, shallow depth of field"


def _default_emotion(bucket: str) -> str:
    if bucket == "business":
        return "calm authority and trust"
    if bucket == "lifestyle":
        return "natural warmth and authenticity"
    if bucket == "event":
        return "joyful celebratory energy"
    if bucket == "art":
        return "bold expressive intensity"
    if bucket == "culture":
        return "authentic cultural atmosphere"
    return "calm confidence"


def _default_output_intent(bucket: str) -> str:
    if bucket == "business":
        return "LinkedIn or executive profile portrait"
    if bucket == "event":
        return "social media story cover"
    if bucket == "art":
        return "creative portrait artwork"
    return "high quality profile portrait"


def _category_bucket(category: str) -> str:
    if category in {"Студийный портрет"}:
        return "portrait"
    if category in {"Бизнес и карьера"}:
        return "business"
    if category in {"Лайфстайл", "Сезоны и атмосфера"}:
        return "lifestyle"
    if category in {"Праздники", "Особый повод"}:
        return "event"
    if category in {"Арт и креатив", "Персонажи и герои"}:
        return "art"
    if category in {"Фешн", "Культуры и страны", "Эпохи и ретро", "Романтика и отношения", "Семья и память"}:
        return "culture"
    return "portrait"


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()
