from __future__ import annotations

from hashlib import sha256
from typing import Any

_DEFAULT_NEGATIVE = (
    "no distortion, no bad anatomy, no extra limbs, no deformed hands, "
    "no asymmetrical eyes, no plastic skin, no blur, no clutter, no text, no watermark"
)

_STYLIZATION_HINTS = {
    1: "realistic and natural",
    2: "enhanced realistic",
    3: "editorial stylized",
    4: "highly stylized",
    5: "fantasy or illustration stylized",
}

_CATEGORY_BUCKETS = {
    "Студийный портрет": "portrait",
    "Бизнес и карьера": "business",
    "Лайфстайл": "lifestyle",
    "Праздники": "event",
    "Особый повод": "event",
    "Арт и креатив": "art",
    "Фешн": "culture",
    "Культуры и страны": "culture",
    "Эпохи и ретро": "culture",
}

_BLOCK_ORDER = {
    "portrait": ["subject", "camera", "light_color_texture", "style_core", "context", "emotion", "output_intent"],
    "business": ["style_core", "subject", "context", "camera", "light_color_texture", "emotion", "output_intent"],
    "lifestyle": ["context", "emotion", "light_color_texture", "subject", "camera", "style_core", "output_intent"],
    "event": ["context", "style_core", "light_color_texture", "subject", "camera", "emotion", "output_intent"],
    "art": ["style_core", "context", "light_color_texture", "subject", "camera", "emotion", "output_intent"],
    "culture": ["style_core", "context", "light_color_texture", "subject", "camera", "emotion", "output_intent"],
}

_VARIATION_CANDIDATES = {
    "camera angle": ["front-facing", "3/4 angle", "slight low angle"],
    "background": ["minimal backdrop", "environment-rich backdrop", "clean depth-separated background"],
    "expression": ["subtle smile", "neutral confident expression", "intense gaze"],
    "camera distance": ["close-up portrait", "medium shot", "half-body framing"],
    "light": ["soft diffused light", "directional key light", "cinematic contrast lighting"],
    "wardrobe": ["refined modern wardrobe", "casual polished outfit", "editorial statement outfit"],
    "palette shift": ["warm neutral palette", "cool metallic tones", "muted earthy colors"],
    "motion": ["still and composed", "subtle movement", "dynamic energy"],
    "color mode": ["full color", "near-monochrome", "selective muted color"],
}


def compile_prompt(
    *,
    style: dict[str, Any] | None,
    model_id: str,
    user_prompt: str | None = None,
    seed: str | None = None,
) -> dict[str, Any]:
    normalized = _normalize_style(style)
    user_text = (user_prompt or "").strip()
    if user_text:
        normalized["style_core"] = user_text

    style_anchors = _normalize_list(style.get("style_anchors") if style else [])
    variation_axes = _normalize_list(style.get("variation_axes") if style else [])
    stylization_level = _clamp_level(style.get("stylization_level") if style else None)
    category_bucket = _resolve_bucket(style.get("category") if style else None)

    active_seed = seed or _default_seed(style, model_id, user_text)
    variation_phrase, chosen_axis = _pick_variation(variation_axes, active_seed)

    positive_prompt = _compose_positive_prompt(
        normalized,
        category_bucket=category_bucket,
        stylization_level=stylization_level,
        style_anchors=style_anchors,
        variation_phrase=variation_phrase,
    )
    negative = _compose_negative(normalized["negative"])
    prompt_text = f"{positive_prompt}. Negative constraints: {negative}."

    return {
        "prompt_text": prompt_text,
        "prompt_meta": {
            "category_bucket": category_bucket,
            "stylization_level": stylization_level,
            "style_anchors": style_anchors,
            "variation_axis": chosen_axis,
            "variation_seed": active_seed,
        },
    }


def compile_prompt_template(style: dict[str, Any]) -> str:
    normalized = _normalize_style(style)
    style_anchors = _normalize_list(style.get("style_anchors"))
    stylization_level = _clamp_level(style.get("stylization_level"))
    category_bucket = _resolve_bucket(style.get("category"))
    return _compose_positive_prompt(
        normalized,
        category_bucket=category_bucket,
        stylization_level=stylization_level,
        style_anchors=style_anchors,
        variation_phrase=None,
    )


def _normalize_style(style: dict[str, Any] | None) -> dict[str, str]:
    prompt_spec = style.get("prompt_spec") if style else None
    if isinstance(prompt_spec, dict):
        subject = _as_text(prompt_spec.get("subject"))
        style_core = _as_text(prompt_spec.get("style_core"))
        context = _as_text(prompt_spec.get("context"))
        camera = _as_text(prompt_spec.get("camera"))
        light = _as_text(prompt_spec.get("light_color_texture"))
        emotion = _as_text(prompt_spec.get("emotion"))
        output_intent = _as_text(prompt_spec.get("output_intent"))
        negative = _as_text(prompt_spec.get("negative"))
    else:
        legacy = _as_text(style.get("prompt_template") if style else "")
        subject = "confident person portrait"
        style_core = legacy or "clean portrait aesthetic"
        context = "coherent portrait environment"
        camera = "close-up portrait, 85mm lens look, shallow depth of field"
        light = "soft directional lighting, balanced color palette, natural texture"
        emotion = "calm confidence"
        output_intent = "premium profile portrait"
        negative = ""

    return {
        "subject": subject or "confident person portrait",
        "style_core": style_core or "clean portrait aesthetic",
        "context": context or "coherent portrait environment",
        "camera": camera or "close-up portrait, shallow depth of field",
        "light_color_texture": light or "soft directional light, balanced palette, natural texture",
        "emotion": emotion or "calm confidence",
        "output_intent": output_intent or "high quality profile image",
        "negative": negative,
    }


def _compose_positive_prompt(
    spec: dict[str, str],
    *,
    category_bucket: str,
    stylization_level: int,
    style_anchors: list[str],
    variation_phrase: str | None,
) -> str:
    blocks = {
        "subject": f"A {spec['subject']}",
        "style_core": f"in a {spec['style_core']} aesthetic",
        "context": f"set in {spec['context']}",
        "camera": f"photographed as {spec['camera']}",
        "light_color_texture": f"featuring {spec['light_color_texture']}",
        "emotion": f"The mood is {spec['emotion']}",
        "output_intent": f"Styled for {spec['output_intent']}",
    }
    ordered_keys = _BLOCK_ORDER.get(category_bucket, _BLOCK_ORDER["portrait"])
    ordered_segments = [blocks[key] for key in ordered_keys if blocks.get(key)]

    if style_anchors:
        ordered_segments.append(f"Style anchors: {', '.join(style_anchors[:5])}")
    ordered_segments.append(
        f"Stylization level {stylization_level} ({_STYLIZATION_HINTS[stylization_level]})"
    )
    if variation_phrase:
        ordered_segments.append(f"Variation emphasis: {variation_phrase}")

    ordered_segments.append(
        "Natural proportions, coherent composition, strong facial likeness, high visual quality"
    )
    return ", ".join(ordered_segments)


def _compose_negative(spec_negative: str) -> str:
    extra = _as_text(spec_negative)
    if not extra:
        return _DEFAULT_NEGATIVE
    return f"{_DEFAULT_NEGATIVE}, {extra}"


def _pick_variation(axes: list[str], seed: str) -> tuple[str | None, str | None]:
    if not axes:
        return None, None
    seed_int = _seed_to_int(seed)
    axis = axes[seed_int % len(axes)]
    candidates = _VARIATION_CANDIDATES.get(axis, [axis])
    phrase = candidates[(seed_int // max(1, len(axes))) % len(candidates)]
    return phrase, axis


def _default_seed(style: dict[str, Any] | None, model_id: str, user_prompt: str) -> str:
    style_id = _as_text(style.get("id") if style else "custom")
    return f"{style_id}:{model_id}:{user_prompt or 'auto'}"


def _resolve_bucket(category: str | None) -> str:
    if not category:
        return "portrait"
    return _CATEGORY_BUCKETS.get(str(category), "portrait")


def _seed_to_int(seed: str) -> int:
    digest = sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:12], 16)


def _clamp_level(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 2
    return min(5, max(1, parsed))


def _normalize_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    result: list[str] = []
    for item in raw:
        text = _as_text(item)
        if text:
            result.append(text)
    return result


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()
