from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import logging

from app.adapters.http_client import ProviderHTTPError
from app.adapters.provider_registry import build_provider_registry
from app.core.db import JobRow, MediaAssetRow, OrderRow, PaymentRow, UserRow, activate_rls, get_session, set_rls_context
from app.core.settings import settings
from app.services.lifecycle import (
    mark_generation_succeeded,
    mark_payment_succeeded,
    recompute_user_state,
)
from app.services.package_codes import normalize_package_code
from app.services.prompt_compiler import compile_prompt, compile_prompt_template
from app.services.style_catalog import load_style_catalog

logger = logging.getLogger(__name__)

from shared.contracts.status import (
    MODEL_BY_ID,
    MODEL_CATALOG,
    PACKAGE_BONUS_COINS,
    PACKAGE_BONUS_PERCENT,
    PACKAGE_CREDITS,
    PACKAGE_MATRIX,
    PACKAGE_STARS_PRICES,
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# Backward-compat alias used internally — returns datetime object now
now_iso = now_utc


def _to_iso(val: Any) -> str:
    """Convert datetime or ISO string to ISO-8601 string."""
    if val is None:
        return ""
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)


def _style_entry(
    *,
    style_id: str,
    name: str,
    category: str,
    gradient: str,
    prompt_spec: dict[str, str],
    stylization_level: int,
    style_anchors: list[str],
    variation_axes: list[str],
    is_trending: bool = False,
    is_new: bool = False,
) -> dict[str, Any]:
    style: dict[str, Any] = {
        "id": style_id,
        "name": name,
        "category": category,
        "gradient": gradient,
        "prompt_spec": prompt_spec,
        "stylization_level": stylization_level,
        "style_anchors": style_anchors,
        "variation_axes": variation_axes,
        "is_trending": is_trending,
        "is_new": is_new,
    }
    style["prompt_template"] = compile_prompt_template(style)
    return style


STYLE_CATALOG: tuple[dict[str, Any], ...] = (
    _style_entry(
        style_id="hollywood",
        name="Голливуд",
        category="Студийный портрет",
        gradient="linear-gradient(145deg, #3D2855, #7B5FC0, #B896E8)",
        prompt_spec={
            "subject": "confident person, close-up portrait, natural facial proportions",
            "style_core": "cinematic Hollywood glamour",
            "context": "minimal premium studio backdrop",
            "camera": "close-up portrait, editorial framing, 85mm lens look, shallow depth of field",
            "light_color_texture": "dramatic soft spotlight, warm luxury tones, polished cinematic texture",
            "emotion": "iconic confidence and star-like presence",
            "output_intent": "premium social media portrait",
            "negative": "no uncanny expression, no duplicate facial features",
        },
        stylization_level=3,
        style_anchors=["cinematic lighting", "premium retouch", "editorial framing", "luxury tones"],
        variation_axes=["camera angle", "expression", "light", "palette shift"],
        is_trending=True,
    ),
    _style_entry(
        style_id="glamour-90s",
        name="Гламур 90-х",
        category="Фешн",
        gradient="linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)",
        prompt_spec={
            "subject": "bold person portrait with confident pose",
            "style_core": "90s flash editorial glamour",
            "context": "night luxury fashion setting",
            "camera": "medium close-up, paparazzi editorial framing",
            "light_color_texture": "hard flash, glossy makeup finish, rich contrast",
            "emotion": "bold charisma and rebellious edge",
            "output_intent": "fashion editorial shot",
            "negative": "no muddy contrast, no over-smoothed skin",
        },
        stylization_level=3,
        style_anchors=["hard flash", "glossy finish", "paparazzi vibe", "90s aesthetic"],
        variation_axes=["camera angle", "wardrobe", "palette shift", "motion"],
        is_trending=True,
    ),
    _style_entry(
        style_id="cyberpunk",
        name="Киберпанк",
        category="Арт и креатив",
        gradient="linear-gradient(145deg, #1E3A4A, #2E6890, #4A98C4)",
        prompt_spec={
            "subject": "bold person portrait with strong silhouette",
            "style_core": "cyberpunk night portrait",
            "context": "futuristic neon-lit city street",
            "camera": "dynamic close-up, cinematic framing, shallow depth of field",
            "light_color_texture": "neon rim light, deep blue and magenta palette, glossy urban texture",
            "emotion": "mysterious intensity and high energy",
            "output_intent": "dramatic creative portrait",
            "negative": "no low-detail neon artifacts, no crushed facial shadows",
        },
        stylization_level=4,
        style_anchors=["neon rim light", "urban dystopia", "glossy texture", "cinematic depth"],
        variation_axes=["camera angle", "background", "light", "color mode"],
        is_new=True,
    ),
    _style_entry(
        style_id="business",
        name="Бизнес-портрет",
        category="Бизнес и карьера",
        gradient="linear-gradient(145deg, #1E2040, #2E3870, #4A58A0)",
        prompt_spec={
            "subject": "professional person portrait with composed posture",
            "style_core": "clean founder portrait",
            "context": "refined modern office interior",
            "camera": "medium shot, clean 50mm portrait look, centered composition",
            "light_color_texture": "soft directional key light, muted premium neutrals, crisp clarity",
            "emotion": "calm authority and trust",
            "output_intent": "LinkedIn and executive branding portrait",
            "negative": "no cluttered background, no exaggerated contrast",
        },
        stylization_level=2,
        style_anchors=["tailored wardrobe", "clean office", "neutral palette", "sharp framing"],
        variation_axes=["camera distance", "background", "expression"],
    ),
    _style_entry(
        style_id="linkedin",
        name="LinkedIn",
        category="Бизнес и карьера",
        gradient="linear-gradient(145deg, #1E3A4A, #2E6890, #4A98C4)",
        prompt_spec={
            "subject": "approachable professional head-and-shoulders portrait",
            "style_core": "clean professional profile aesthetic",
            "context": "minimal studio with neutral background",
            "camera": "headshot framing, front angle, 85mm portrait look",
            "light_color_texture": "soft even lighting, neutral color palette, natural skin texture",
            "emotion": "approachable confidence",
            "output_intent": "LinkedIn profile photo",
            "negative": "no dramatic shadows, no oversaturated tones",
        },
        stylization_level=1,
        style_anchors=["professional headshot", "neutral background", "clean light"],
        variation_axes=["expression", "camera angle", "light"],
    ),
    _style_entry(
        style_id="ceo-style",
        name="CEO-стиль",
        category="Бизнес и карьера",
        gradient="linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)",
        prompt_spec={
            "subject": "executive portrait with calm dominant posture",
            "style_core": "premium executive editorial portrait",
            "context": "luxury office or boardroom setting",
            "camera": "editorial medium shot, 3/4 angle, sharp portrait framing",
            "light_color_texture": "directional studio light, premium neutral palette, polished texture",
            "emotion": "calm authority and strategic confidence",
            "output_intent": "executive personal brand portrait",
            "negative": "no casual clutter, no playful props",
        },
        stylization_level=3,
        style_anchors=["executive wardrobe", "boardroom context", "premium neutrals", "authoritative pose"],
        variation_axes=["camera angle", "wardrobe", "expression"],
    ),
    _style_entry(
        style_id="k-pop",
        name="K-pop",
        category="Фешн",
        gradient="linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)",
        prompt_spec={
            "subject": "youthful idol-style portrait with expressive pose",
            "style_core": "K-pop concept editorial",
            "context": "stylized studio set with clean pop backdrop",
            "camera": "medium close-up, centered idol framing",
            "light_color_texture": "beauty studio lighting, pastel dream palette, glossy finish",
            "emotion": "playful charisma and polished confidence",
            "output_intent": "social media avatar and trend portrait",
            "negative": "no uncanny doll-like face, no waxy skin",
        },
        stylization_level=3,
        style_anchors=["pastel palette", "beauty light", "idol styling", "polished finish"],
        variation_axes=["expression", "wardrobe", "palette shift"],
        is_trending=True,
    ),
    _style_entry(
        style_id="anime",
        name="Аниме",
        category="Арт и креатив",
        gradient="linear-gradient(145deg, #3D1E3A, #6B2E64, #9B4A90)",
        prompt_spec={
            "subject": "anime-inspired character portrait based on real person likeness",
            "style_core": "anime-inspired cinematic illustration",
            "context": "stylized cinematic environment with depth",
            "camera": "dynamic portrait framing, expressive composition",
            "light_color_texture": "vibrant color grading, clean cel-shaded texture",
            "emotion": "heroic intensity and emotional clarity",
            "output_intent": "creative character portrait",
            "negative": "no broken anatomy, no mismatched eye direction",
        },
        stylization_level=5,
        style_anchors=["cel shading", "expressive eyes", "anime composition", "vibrant palette"],
        variation_axes=["camera angle", "background", "motion", "color mode"],
        is_new=True,
    ),
    _style_entry(
        style_id="nature",
        name="Природа",
        category="Лайфстайл",
        gradient="linear-gradient(145deg, #1E3D2A, #2E6B48, #4A9B70)",
        prompt_spec={
            "subject": "relaxed person lifestyle portrait",
            "style_core": "dreamy nature film look",
            "context": "organic outdoor setting with natural depth",
            "camera": "medium shot, candid framing, 50mm look",
            "light_color_texture": "natural light, earthy palette, soft analog texture",
            "emotion": "peaceful warmth and authenticity",
            "output_intent": "lifestyle social media portrait",
            "negative": "no artificial studio look, no harsh flash",
        },
        stylization_level=2,
        style_anchors=["natural light", "earthy palette", "organic setting", "relaxed expression"],
        variation_axes=["background", "camera distance", "expression", "light"],
    ),
    _style_entry(
        style_id="vintage",
        name="Винтаж",
        category="Лайфстайл",
        gradient="linear-gradient(145deg, #3D3020, #6B5530, #A08050)",
        prompt_spec={
            "subject": "nostalgic portrait with timeless posture",
            "style_core": "analog vintage portrait aesthetic",
            "context": "retro-inspired environment",
            "camera": "medium close-up, classic portrait composition",
            "light_color_texture": "soft warm light, faded palette, subtle film grain",
            "emotion": "nostalgic tenderness",
            "output_intent": "memory-style portrait",
            "negative": "no modern neon colors, no digital oversharpening",
        },
        stylization_level=3,
        style_anchors=["film grain", "retro palette", "analog softness", "timeless mood"],
        variation_axes=["color mode", "background", "camera angle"],
    ),
    _style_entry(
        style_id="travel",
        name="Путешествие",
        category="Лайфстайл",
        gradient="linear-gradient(145deg, #3D3A1E, #6B642E, #9B944A)",
        prompt_spec={
            "subject": "adventurous lifestyle portrait",
            "style_core": "travel diary portrait aesthetic",
            "context": "recognizable destination environment",
            "camera": "medium shot with environmental context, dynamic composition",
            "light_color_texture": "bright daylight, balanced warm-cool travel palette, natural texture",
            "emotion": "open curiosity and joyful energy",
            "output_intent": "travel diary image",
            "negative": "no cluttered tourist crowd focus, no blurred face",
        },
        stylization_level=2,
        style_anchors=["destination cues", "daylight", "candid framing", "adventure mood"],
        variation_axes=["background", "camera distance", "expression"],
    ),
    _style_entry(
        style_id="cozy-evening",
        name="Уютный вечер",
        category="Лайфстайл",
        gradient="linear-gradient(145deg, #3D1E3A, #6B2E64, #9B4A90)",
        prompt_spec={
            "subject": "intimate evening portrait",
            "style_core": "cozy cinematic home mood",
            "context": "warm indoor evening interior",
            "camera": "medium close-up, intimate framing",
            "light_color_texture": "warm ambient practical lights, soft shadows, matte cozy texture",
            "emotion": "intimate warmth and serenity",
            "output_intent": "personal story portrait",
            "negative": "no harsh cold lighting, no noisy grain artifacts",
        },
        stylization_level=2,
        style_anchors=["warm ambience", "intimate framing", "soft shadows"],
        variation_axes=["light", "expression", "background"],
        is_new=True,
    ),
    _style_entry(
        style_id="oil-paint",
        name="Масло",
        category="Арт и креатив",
        gradient="linear-gradient(145deg, #3D2855, #7B5FC0, #B896E8)",
        prompt_spec={
            "subject": "portrait transformed into painterly interpretation",
            "style_core": "classical oil painting portrait",
            "context": "gallery-like timeless setting",
            "camera": "classical portrait composition",
            "light_color_texture": "rich brushstroke texture, painterly color depth, soft dramatic lighting",
            "emotion": "elevated artistic elegance",
            "output_intent": "artistic keepsake portrait",
            "negative": "no low-detail brush artifacts, no plastic digital finish",
        },
        stylization_level=5,
        style_anchors=["visible brushstrokes", "classical composition", "gallery quality"],
        variation_axes=["color mode", "light", "background"],
    ),
    _style_entry(
        style_id="comic",
        name="Комикс",
        category="Арт и креатив",
        gradient="linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)",
        prompt_spec={
            "subject": "character-like portrait with expressive pose",
            "style_core": "comic book portrait illustration",
            "context": "graphic comic-inspired backdrop",
            "camera": "dynamic medium shot with dramatic angle",
            "light_color_texture": "bold ink contours, high-contrast color blocks, halftone texture",
            "emotion": "energetic and heroic",
            "output_intent": "creative poster-like portrait",
            "negative": "no muddy linework, no low-contrast colors",
        },
        stylization_level=5,
        style_anchors=["bold outlines", "graphic contrast", "comic energy"],
        variation_axes=["camera angle", "motion", "palette shift"],
    ),
    _style_entry(
        style_id="wedding",
        name="Свадьба",
        category="Праздники",
        gradient="linear-gradient(145deg, #3D1E28, #6B2E42, #9B4A68)",
        prompt_spec={
            "subject": "romantic portrait with elegant styling",
            "style_core": "romantic wedding photography",
            "context": "wedding celebration environment with floral cues",
            "camera": "medium close-up, timeless editorial framing",
            "light_color_texture": "soft romantic light, clean ivory palette, polished texture",
            "emotion": "romantic tenderness and joy",
            "output_intent": "wedding keepsake portrait",
            "negative": "no cluttered event distractions, no harsh flash",
        },
        stylization_level=3,
        style_anchors=["romantic light", "floral cues", "elegant styling", "timeless frame"],
        variation_axes=["background", "expression", "camera distance"],
    ),
    _style_entry(
        style_id="birthday",
        name="День рождения",
        category="Праздники",
        gradient="linear-gradient(145deg, #1E3D2A, #2E6B48, #4A9B70)",
        prompt_spec={
            "subject": "joyful celebration portrait",
            "style_core": "luxury birthday celebration aesthetic",
            "context": "decorated festive party environment",
            "camera": "lively medium shot with editorial framing",
            "light_color_texture": "warm celebratory lighting, rich festive tones, soft glamorous texture",
            "emotion": "playful radiant joy",
            "output_intent": "birthday story cover",
            "negative": "no background clutter overload, no face motion blur",
        },
        stylization_level=3,
        style_anchors=["celebration cues", "festive tones", "joyful mood", "editorial framing"],
        variation_axes=["expression", "background", "motion", "palette shift"],
    ),
    _style_entry(
        style_id="graduation",
        name="Выпускной",
        category="Праздники",
        gradient="linear-gradient(145deg, #3D2855, #7B5FC0, #B896E8)",
        prompt_spec={
            "subject": "proud graduate portrait",
            "style_core": "graduation keepsake portrait style",
            "context": "academic celebratory setting",
            "camera": "medium portrait shot, clean framing",
            "light_color_texture": "balanced daylight or soft studio light, refined celebratory palette",
            "emotion": "proud confidence and optimism",
            "output_intent": "graduation keepsake portrait",
            "negative": "no distracting background objects, no muddy skin tones",
        },
        stylization_level=2,
        style_anchors=["academic cues", "clean composition", "celebratory mood"],
        variation_axes=["background", "camera angle", "expression"],
    ),
)

# Canonical style source of truth comes from shared/contracts/style_specs.json.
# Keep STYLE_CATALOG tuple type for backward compatibility in this module.
STYLE_CATALOG = tuple(load_style_catalog())

STYLE_BY_ID = {style["id"]: style for style in STYLE_CATALOG}
GENERATION_PROVIDER_ALIASES: dict[str, str] = {}
DEFAULT_STYLE_MODEL_ID = "nb2-1k"

_VALID_ASPECT_RATIOS = frozenset({"1:1", "16:9", "9:16", "3:4", "4:3", "21:9", "5:4", "2:3"})
_DEMO_TEST_PACKAGE = {
    "code": "TEST",
    "title": "Test",
    "credits": 1000,
    "bonus_coins": 0,
    "stars_price": 1,
    "bonus_percent": 0,
    "sort_order": 1,
}


class VerticalSliceService:
    """Domain service backed by PostgreSQL."""

    def __init__(self) -> None:
        self.provider_registry = build_provider_registry()

    # ------------------------------------------------------------------ users

    def get_or_create_user(
        self,
        user_id: str,
        first_name: str | None = None,
        username: str | None = None,
    ) -> UserRow:
        with get_session() as db:
            user = db.get(UserRow, user_id)
            if not user:
                user = UserRow(
                    user_id=user_id,
                    first_name=first_name,
                    username=username,
                    paid_credits=20,
                    lifecycle_state="S0",
                    lifecycle_state_updated_at=now_iso(),
                    created_at=now_iso(),
                )
                db.add(user)
                recompute_user_state(db, user, source="system", reason="user_created")
                db.commit()
                db.refresh(user)
            else:
                # Update display info when TG provides it (names can change)
                changed = False
                if first_name and user.first_name != first_name:
                    user.first_name = first_name
                    changed = True
                if username is not None and user.username != username:
                    user.username = username
                    changed = True
                if changed:
                    db.commit()
                    db.refresh(user)
            # Propagate UUID to ContextVar so all subsequent sessions enforce RLS.
            activate_rls(user.id)
            return user

    def get_balance(self, user_id: str) -> dict[str, Any]:
        user = self.get_or_create_user(user_id)
        return self._serialize_wallet(user)

    def get_profile(
        self,
        user_id: str,
        first_name: str | None = None,
        username: str | None = None,
    ) -> dict[str, Any]:
        user = self.get_or_create_user(user_id, first_name=first_name, username=username)
        with get_session() as db:
            generations_count = (
                db.query(OrderRow)
                .filter(OrderRow.user_id == user_id)
                .count()
            )
        return {
            "user_id": user_id,
            "first_name": user.first_name,
            "username": user.username,
            "paid_credits": user.paid_credits,
            "generations_count": generations_count,
            "referrals_count": 0,
            "is_admin": user_id in settings.admin_user_ids,
        }

    # ---------------------------------------------------------------- catalog

    def list_styles(self) -> list[dict[str, Any]]:
        return [dict(style) for style in STYLE_CATALOG]

    def list_models(self) -> list[dict[str, Any]]:
        return [
            {
                "id": model["id"],
                "name": model["name"],
                "provider": model["provider"],
                "coins": model["coins"],
                "is_active": model["is_active"],
                "official_only": model["official_only"],
            }
            for model in MODEL_CATALOG
            if model["is_active"]
        ]

    def list_packages(self) -> list[dict[str, Any]]:
        package_matrix = list(PACKAGE_MATRIX)
        if settings.free_demo_mode:
            package_matrix = [_DEMO_TEST_PACKAGE, *package_matrix]
        return [
            {
                "code": pkg["code"],
                "title": pkg["title"],
                "credits": pkg["credits"],
                "bonus_coins": pkg["bonus_coins"],
                "bonus_percent": pkg["bonus_percent"],
                "price_stars": pkg["stars_price"],
                "provider": "telegram_stars",
                "sort_order": pkg["sort_order"],
            }
            for pkg in package_matrix
        ]

    # --------------------------------------------------------------- uploads

    def upload_source_file(self, user_id: str, filename: str, content: bytes) -> str:
        """Upload raw bytes server-side to R2, return the source_key."""
        self.get_or_create_user(user_id)
        upload_id = str(uuid4())
        source_key = f"source/{user_id}/{upload_id}/{filename}"
        try:
            from app.adapters.r2_client import upload_bytes
            upload_bytes(source_key, content, content_type="image/jpeg")
        except Exception:
            pass  # R2 not configured; source_key still usable for generate
        self._record_media_asset(
            user_id=user_id,
            order_id=None,
            kind="source",
            storage_key=source_key,
            ttl_hours=settings.source_retention_hours,
        )
        return source_key

    def _record_media_asset(
        self,
        *,
        user_id: str,
        order_id: str | None,
        kind: str,
        storage_key: str,
        ttl_hours: int,
    ) -> None:
        """Insert a media_assets row with an expiry timestamp.

        Idempotent: duplicate inserts for the same storage_key (e.g. from
        webhook retries) are silently skipped via the unique constraint on
        storage_key.
        """
        from sqlalchemy.exc import IntegrityError

        try:
            expires_at = now_utc() + timedelta(hours=ttl_hours)
            with get_session() as db:
                db.add(MediaAssetRow(
                    id=str(uuid4()),
                    user_id=user_id,
                    order_id=order_id,
                    kind=kind,
                    storage_bucket=settings.r2_bucket,
                    storage_key=storage_key,
                    expires_at=expires_at,
                    created_at=now_utc(),
                ))
        except IntegrityError:
            # Already recorded (e.g. webhook retry) — no-op
            logger.debug("_record_media_asset: duplicate skipped for %s", storage_key)
        except Exception:
            logger.warning("_record_media_asset: failed to record asset %s", storage_key)

    def _record_result_asset(self, *, user_id: str, order_id: str, result_url: str) -> None:
        """Track an R2-hosted result image for TTL-based cleanup.

        Only records assets whose URL starts with our R2 public base URL.
        Provider CDN URLs (e.g. BFL signed URLs that were NOT mirrored) are skipped.
        """
        r2_base = settings.r2_public_base_url.rstrip("/")
        if not result_url.startswith(r2_base + "/"):
            return
        storage_key = result_url[len(r2_base) + 1:]
        self._record_media_asset(
            user_id=user_id,
            order_id=order_id,
            kind="result",
            storage_key=storage_key,
            ttl_hours=settings.result_retention_days * 24,
        )

    def register_upload(self, user_id: str, filename: str) -> dict[str, str]:
        self.get_or_create_user(user_id)
        upload_id = str(uuid4())
        source_key = f"source/{user_id}/{upload_id}/{filename}"
        signed_put_url = self._presigned_upload_url(source_key)
        return {
            "upload_id": upload_id,
            "source_key": source_key,
            "signed_put_url": signed_put_url,
        }

    @staticmethod
    def _presigned_upload_url(source_key: str) -> str:
        if not settings.r2_access_key_id:
            return f"https://r2.example/upload/{source_key}"
        try:
            from app.adapters.r2_client import presigned_put_url

            return presigned_put_url(source_key, content_type="image/jpeg")
        except Exception:
            return f"https://r2.example/upload/{source_key}"

    # --------------------------------------------------------------- orders

    def create_order(
        self,
        user_id: str,
        style_code: str,
        source_key: str,
        *,
        model_id: str | None = None,
        prompt: str | None = None,
        aspect_ratio: str = "1:1",
        enhance_prompt: bool = True,
    ) -> OrderRow:
        self.get_or_create_user(user_id)
        model = self._resolve_model(model_id)
        style = STYLE_BY_ID.get(style_code)
        order_id = str(uuid4())
        if enhance_prompt:
            compiled_prompt = compile_prompt(
                style=style,
                model_id=model["id"],
                user_prompt=prompt,
                seed=order_id,
            )
            prompt_value = str(compiled_prompt["prompt_text"]).strip()
        else:
            prompt_value = (prompt or (style["prompt_template"] if style else "") or "").strip()
        if aspect_ratio not in _VALID_ASPECT_RATIOS:
            aspect_ratio = "1:1"
        order = OrderRow(
            order_id=order_id,
            user_id=user_id,
            style_code=style_code,
            source_key=source_key,
            model_id=model["id"],
            prompt=prompt_value,
            aspect_ratio=aspect_ratio,
            status="awaiting_credit_or_payment",
            credit_cost=model["coins"],
            created_at=now_iso(),
            updated_at=now_iso(),
        )
        with get_session() as db:
            db.add(order)
            db.commit()
            db.refresh(order)
        return order

    def generate(
        self,
        *,
        user_id: str,
        source_key: str,
        model_id: str,
        style_code: str = "hollywood",
        prompt: str | None = None,
        aspect_ratio: str = "1:1",
        enhance_prompt: bool = True,
    ) -> dict[str, Any]:
        order = self.create_order(
            user_id,
            style_code,
            source_key,
            model_id=model_id,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            enhance_prompt=enhance_prompt,
        )
        return self.start_order(order.order_id)

    def start_order(self, order_id: str, requesting_user_id: str | None = None) -> dict[str, Any]:
        with get_session() as db:
            order = db.get(OrderRow, order_id)
            if not order:
                raise ValueError("order_not_found")
            if requesting_user_id and order.user_id != requesting_user_id:
                raise ValueError("forbidden")

            # SELECT FOR UPDATE — prevents concurrent double-spend
            user = (
                db.query(UserRow)
                .filter(UserRow.user_id == order.user_id)
                .with_for_update()
                .first()
            )
            if not user:
                raise ValueError("user_not_found")
            set_rls_context(db, user.id)

            # Content policy check — must pass before any credit deduction
            from app.services.policy_engine import check_policy
            policy = check_policy(
                prompt=order.prompt,
                source_image_url=self._build_source_image_url(order.source_key),
            )
            if not policy.passed:
                order.status = "failed"
                order.fail_reason_code = policy.reason_code or "policy_blocked"
                order.updated_at = now_iso()
                db.commit()
                return {
                    "result": "policy_blocked",
                    "reason_code": policy.reason_code,
                    "order": self._serialize_order(order),
                    "wallet": self._serialize_wallet(user),
                }

            # Debit credits
            if user.paid_credits >= order.credit_cost:
                user.paid_credits -= order.credit_cost
            else:
                order.status = "awaiting_credit_or_payment"
                order.updated_at = now_iso()
                recompute_user_state(db, user, source="system", reason="paywall_required")
                db.commit()
                return {
                    "result": "paywall_required",
                    "order": self._serialize_order(order),
                    "wallet": self._serialize_wallet(user),
                }

            # Submit to provider
            provider_id = MODEL_BY_ID[order.model_id]["provider"]

            job = JobRow(
                job_id=str(uuid4()),
                order_id=order.order_id,
                provider=provider_id,
                status="queued",
                attempts=0,
                updated_at=now_iso(),
            )
            db.add(job)

            try:
                provider = self.provider_registry[provider_id]
                submit = provider.submit(
                    order_id=order.order_id,
                    model_id=order.model_id,
                    source_key=order.source_key,
                    source_image_url=self._build_source_image_url(order.source_key),
                    prompt=order.prompt,
                    aspect_ratio=order.aspect_ratio,
                )
            except Exception as exc:
                job.status = "failed"
                job.updated_at = now_iso()
                order.status = "failed"
                order.fail_reason_code = "technical_failed"
                order.updated_at = now_iso()
                user.paid_credits += order.credit_cost
                db.commit()
                raise ValueError(f"provider_error: {exc}") from exc

            job.status = "submitted"
            job.provider_task_id = submit.provider_task_id
            job.updated_at = now_iso()

            # Save result immediately for synchronous providers (NanoBanana/Imagen 4, etc.)
            # that return result_url inline. Async providers return status="submitted"
            # and result arrives later via webhook.
            if submit.result_url and submit.status == "done":
                order.status = "done"
                order.result_url = submit.result_url
                job.status = "done"
                job.updated_at = now_iso()
                mark_generation_succeeded(db, user, order_id=order.order_id)
                self._record_result_asset(user_id=order.user_id, order_id=order.order_id, result_url=submit.result_url)
            else:
                order.status = "processing"
                recompute_user_state(db, user, source="system", reason="order_processing")

            order.updated_at = now_iso()
            db.commit()

            return {
                "result": "enqueued",
                "order": self._serialize_order(order),
                "job": self._serialize_job(job),
                "wallet": self._serialize_wallet(user),
            }

    def order_status(self, order_id: str) -> dict[str, Any]:
        with get_session() as db:
            order = db.get(OrderRow, order_id)
            if not order:
                raise ValueError("order_not_found")
            job = (
                db.query(JobRow)
                .filter(JobRow.order_id == order_id)
                .order_by(JobRow.updated_at.desc())
                .first()
            )
            return {
                "order": self._serialize_order(order),
                "job": self._serialize_job(job) if job else None,
            }

    def history(self, user_id: str) -> list[dict[str, Any]]:
        with get_session() as db:
            user = db.get(UserRow, user_id)
            set_rls_context(db, user.id if user else None)
            orders = (
                db.query(OrderRow)
                .filter(OrderRow.user_id == user_id)
                .order_by(OrderRow.created_at.desc())
                .all()
            )
            return [self._serialize_order(o) for o in orders]

    def photos(self, user_id: str) -> list[dict[str, Any]]:
        with get_session() as db:
            user = db.get(UserRow, user_id)
            set_rls_context(db, user.id if user else None)
            orders = (
                db.query(OrderRow)
                .filter(OrderRow.user_id == user_id)
                .order_by(OrderRow.created_at.desc())
                .all()
            )
            return [
                {
                    "order_id": o.order_id,
                    "style_code": o.style_code,
                    "model_id": o.model_id,
                    "status": o.status,
                    "prompt": o.prompt,
                    "result_url": o.result_url,
                    "is_favorite": bool(o.is_favorite),
                    "created_at": _to_iso(o.created_at),
                    "updated_at": _to_iso(o.updated_at),
                }
                for o in orders
            ]

    def toggle_favorite(self, user_id: str, order_id: str) -> dict[str, Any]:
        with get_session() as db:
            user = db.get(UserRow, user_id)
            set_rls_context(db, user.id if user else None)
            order = db.get(OrderRow, order_id)
            if not order:
                raise ValueError("order_not_found")
            if order.user_id != user_id:
                raise ValueError("forbidden")
            order.is_favorite = not bool(order.is_favorite)
            order.updated_at = now_iso()
            db.commit()
            return {"order_id": order_id, "is_favorite": order.is_favorite}

    def delete_photo(self, user_id: str, order_id: str) -> dict[str, Any]:
        with get_session() as db:
            user = db.get(UserRow, user_id)
            set_rls_context(db, user.id if user else None)
            order = db.get(OrderRow, order_id)
            if not order:
                raise ValueError("order_not_found")
            if order.user_id != user_id:
                raise ValueError("forbidden")

            db.query(JobRow).filter(JobRow.order_id == order_id).delete()
            db.delete(order)
            db.commit()
            return {"order_id": order_id, "deleted": True}

    # -------------------------------------------------------------- payments

    def purchase(self, user_id: str, package_code: str, provider: str = "telegram") -> dict[str, Any]:
        self.get_or_create_user(user_id)
        canonical_code = self._normalize_package_code(package_code)
        package = self._resolve_package(canonical_code)
        if package is None:
            raise ValueError("package_not_found")

        payment_id = str(uuid4())
        event_id = f"purchase-{payment_id}"
        payload = {
            "payment_id": payment_id,
            "user_id": user_id,
            "package_code": canonical_code,
            "status": "paid",
            "amount": package["stars_price"],
        }
        result = self.ingest_webhook(provider, event_id, payload)
        with get_session() as db:
            user = db.get(UserRow, user_id)
            return {
                "payment_id": payment_id,
                "provider": provider,
                "package_code": canonical_code,
                "result": result,
                "wallet": self._serialize_wallet(user),
            }

    def ingest_webhook(self, provider: str, event_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        provider = GENERATION_PROVIDER_ALIASES.get(provider, provider)
        logger.info("webhook_received provider=%s event_id=%s", provider, event_id)

        _tg_notify: tuple[str, str, str] | None = None  # (user_id, result_url, order_id)

        with get_session() as db:
            # Idempotency: check if this event was already processed
            existing = (
                db.query(PaymentRow)
                .filter(PaymentRow.payment_id == event_id)
                .first()
            )
            if existing:
                logger.info("webhook_deduplicated provider=%s event_id=%s", provider, event_id)
                return {"deduplicated": True}

            # Provider generation webhook (result/failure callback)
            if provider in self.provider_registry:
                order_id = str(payload.get("order_id", ""))
                event_type = str(payload.get("event_type", "done"))
                if not order_id:
                    logger.warning("webhook_ignored_no_order_id provider=%s event_id=%s", provider, event_id)
                    return {"deduplicated": False, "ignored": True}

                order = db.get(OrderRow, order_id)
                if not order:
                    logger.warning("webhook_ignored_order_not_found provider=%s event_id=%s order_id=%s", provider, event_id, order_id)
                    return {"deduplicated": False, "ignored": True}

                job = (
                    db.query(JobRow)
                    .filter(JobRow.order_id == order_id)
                    .order_by(JobRow.updated_at.desc())
                    .first()
                )

                if event_type == "done":
                    order.status = "done"
                    order.result_url = payload.get("result_url")
                    if job:
                        job.status = "done"
                        job.updated_at = now_iso()
                    user = db.get(UserRow, order.user_id)
                    if user and order.result_url:
                        mark_generation_succeeded(db, user, order_id=order.order_id)
                        _tg_notify = (order.user_id, order.result_url, order.order_id)
                        self._record_result_asset(user_id=order.user_id, order_id=order.order_id, result_url=order.result_url)
                    logger.info("webhook_generation_done provider=%s order_id=%s user_id=%s", provider, order_id, order.user_id)
                elif event_type == "processing":
                    order.status = "processing"
                    if job:
                        job.status = "processing"
                        job.updated_at = now_iso()
                    logger.info("webhook_generation_processing provider=%s order_id=%s", provider, order_id)
                elif event_type == "technical_failed":
                    order.status = "failed"
                    order.fail_reason_code = "technical_failed"
                    if job:
                        job.status = "failed"
                        job.updated_at = now_iso()
                    user = db.get(UserRow, order.user_id)
                    if user:
                        user.paid_credits += order.credit_cost
                        logger.info(
                            "webhook_generation_failed_refund provider=%s order_id=%s user_id=%s credits_refunded=%d",
                            provider, order_id, order.user_id, order.credit_cost,
                        )
                    else:
                        logger.error("webhook_generation_failed_no_user provider=%s order_id=%s user_id=%s", provider, order_id, order.user_id)
                elif event_type == "policy_failed":
                    order.status = "failed"
                    order.fail_reason_code = "policy_failed"
                    if job:
                        job.status = "failed"
                        job.updated_at = now_iso()
                    logger.info("webhook_generation_policy_failed provider=%s order_id=%s user_id=%s", provider, order_id, order.user_id)
                else:
                    logger.warning("webhook_unknown_event_type provider=%s event_type=%s order_id=%s", provider, event_type, order_id)

                order.updated_at = now_iso()
                db.commit()

            # Payment webhook (Stars / Stripe)
            if provider in {"telegram", "stripe"}:
                # Use provider-specific charge ID for deduplication, not event_id,
                # to prevent double-credit if the same payment arrives with different event_ids.
                if provider == "telegram":
                    payment_id = str(payload.get("telegram_payment_charge_id") or event_id)
                elif provider == "stripe":
                    payment_id = str(payload.get("stripe_payment_intent_id") or event_id)
                else:
                    payment_id = event_id

                # Second idempotency check on the resolved payment_id
                if payment_id != event_id:
                    dup = db.query(PaymentRow).filter(PaymentRow.payment_id == payment_id).first()
                    if dup:
                        return {"deduplicated": True}

                user_id = payload.get("user_id")
                package_code_raw = str(payload.get("package_code", ""))
                package_code = self._normalize_package_code(package_code_raw)
                status = str(payload.get("status", "paid"))
                package = self._resolve_package(package_code)
                amount = int(payload.get("amount", package["stars_price"] if package else 0))

                payment = PaymentRow(
                    payment_id=payment_id,
                    provider=provider,
                    status=status,
                    package_code=package_code,
                    user_id=str(user_id) if user_id else None,
                    amount=amount,
                    created_at=now_iso(),
                )
                db.add(payment)

                if status == "paid" and user_id and package:
                    uid = str(user_id)
                    # SELECT FOR UPDATE prevents double-credit on duplicate webhooks
                    user = (
                        db.query(UserRow)
                        .filter(UserRow.user_id == uid)
                        .with_for_update()
                        .first()
                    )
                    if not user:
                        user = UserRow(
                            user_id=uid,
                            paid_credits=0,
                            lifecycle_state="S0",
                            lifecycle_state_updated_at=now_iso(),
                            created_at=now_iso(),
                        )
                        db.add(user)
                    base_credits = package["credits"]
                    bonus_credits = package["bonus_coins"]
                    user.paid_credits += base_credits + bonus_credits
                    mark_payment_succeeded(db, user, payment_id=payment_id)
                    logger.info(
                        "payment_credited user_id=%s package=%s credits=%d+%d total_now=%d",
                        uid, package_code, base_credits, bonus_credits, user.paid_credits,
                    )
                else:
                    logger.warning(
                        "payment_skipped_credit status=%s user_id=%s package=%s",
                        status, user_id, package_code,
                    )

                db.commit()

        if _tg_notify:
            self._notify_tg_generation_done(*_tg_notify)

        return {"deduplicated": False, "accepted": True}

    def _notify_tg_generation_done(self, user_id: str, result_url: str, order_id: str) -> None:
        if not settings.telegram_bot_token:
            return
        try:
            from app.services.tg_bot import send_photo_to_user
            app_link = self._build_share_link(order_id)
            send_photo_to_user(user_id, result_url, app_link=app_link)
            logger.info("tg_notification_sent user_id=%s order_id=%s", user_id, order_id)
        except Exception:
            logger.warning("tg_notification_failed user_id=%s order_id=%s", user_id, order_id, exc_info=True)

    def _build_share_link(self, order_id: str) -> str | None:
        import hashlib
        import hmac as _hmac
        from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

        base = settings.telegram_miniapp_url.strip().rstrip("/")
        if not base:
            return None
        secret = (settings.telegram_bot_token or settings.provider_webhook_secret or "").encode()
        token = _hmac.new(secret, order_id.encode(), hashlib.sha256).hexdigest()[:16]
        parsed = urlparse(base)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query["share_order"] = order_id
        query["share_token"] = token
        return urlunparse(parsed._replace(query=urlencode(query)))

    # ------------------------------------------------------------ helpers

    def _resolve_model(self, model_id: str | None) -> dict[str, Any]:
        if not model_id:
            return dict(MODEL_BY_ID[DEFAULT_STYLE_MODEL_ID])
        try:
            return dict(MODEL_BY_ID[model_id])
        except KeyError as exc:
            raise ValueError("model_not_found") from exc

    @staticmethod
    def _build_source_image_url(source_key: str) -> str:
        base = settings.r2_public_base_url.strip().rstrip("/")
        if base:
            return f"{base}/{source_key.lstrip('/')}"
        return f"https://r2.example/{source_key.lstrip('/')}"

    @staticmethod
    def _normalize_package_code(package_code: str) -> str:
        return normalize_package_code(package_code)

    @staticmethod
    def _resolve_package(package_code: str) -> dict[str, Any] | None:
        if package_code in PACKAGE_CREDITS:
            return {
                "code": package_code,
                "credits": PACKAGE_CREDITS[package_code],
                "bonus_coins": PACKAGE_BONUS_COINS.get(package_code, 0),
                "stars_price": PACKAGE_STARS_PRICES[package_code],
                "bonus_percent": PACKAGE_BONUS_PERCENT.get(package_code, 0),
            }
        if settings.free_demo_mode and package_code == "TEST":
            return {
                "code": "TEST",
                "credits": _DEMO_TEST_PACKAGE["credits"],
                "bonus_coins": _DEMO_TEST_PACKAGE["bonus_coins"],
                "stars_price": _DEMO_TEST_PACKAGE["stars_price"],
                "bonus_percent": _DEMO_TEST_PACKAGE["bonus_percent"],
            }
        return None

    def _find_order(self, order_id: str) -> "OrderRow":
        with get_session() as db:
            order = db.get(OrderRow, order_id)
            if not order:
                raise ValueError("order_not_found")
            return order

    def on_miniapp_opened(self, user_id: str) -> None:
        from app.services.lifecycle import mark_miniapp_opened

        with get_session() as db:
            user = db.get(UserRow, user_id)
            if user:
                mark_miniapp_opened(db, user)

    def on_bot_started(self, user_id: str) -> None:
        from app.services.lifecycle import mark_bot_started

        with get_session() as db:
            user = db.get(UserRow, user_id)
            if user:
                mark_bot_started(db, user)

    @staticmethod
    def _serialize_wallet(user: UserRow) -> dict[str, Any]:
        return {
            "paid_credits": user.paid_credits,
        }

    @staticmethod
    def _serialize_order(order: OrderRow) -> dict[str, Any]:
        return {
            "order_id": order.order_id,
            "user_id": order.user_id,
            "style_code": order.style_code,
            "source_key": order.source_key,
            "model_id": order.model_id,
            "prompt": order.prompt,
            "aspect_ratio": order.aspect_ratio,
            "status": order.status,
            "credit_cost": order.credit_cost,
            "result_url": order.result_url,
            "fail_reason_code": order.fail_reason_code,
            "created_at": _to_iso(order.created_at),
            "updated_at": _to_iso(order.updated_at),
        }

    @staticmethod
    def _serialize_job(job: JobRow) -> dict[str, Any]:
        return {
            "job_id": job.job_id,
            "order_id": job.order_id,
            "provider": job.provider,
            "status": job.status,
            "attempts": job.attempts,
            "provider_task_id": job.provider_task_id,
            "updated_at": _to_iso(job.updated_at),
        }
