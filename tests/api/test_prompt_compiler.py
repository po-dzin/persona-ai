from app.services.prompt_compiler import compile_prompt


def _style_fixture() -> dict:
    return {
        "id": "fixture-style",
        "name": "Fixture",
        "category": "Бизнес и карьера",
        "prompt_spec": {
            "subject": "professional person portrait",
            "style_core": "modern founder portrait",
            "context": "refined office interior",
            "camera": "medium shot, 50mm portrait look",
            "light_color_texture": "soft directional light, premium neutrals, crisp texture",
            "emotion": "calm authority",
            "output_intent": "LinkedIn portrait",
            "negative": "no cluttered background",
        },
        "stylization_level": 2,
        "style_anchors": ["clean office", "tailored outfit", "calm authority"],
        "variation_axes": ["camera angle", "expression", "light"],
    }


def test_compile_prompt_includes_all_8_blocks_and_negative_constraints() -> None:
    result = compile_prompt(style=_style_fixture(), model_id="nb2-1k", seed="seed-1")
    text = result["prompt_text"]
    assert "A professional person portrait" in text
    assert "in a modern founder portrait aesthetic" in text
    assert "set in refined office interior" in text
    assert "photographed as medium shot, 50mm portrait look" in text
    assert "featuring soft directional light, premium neutrals, crisp texture" in text
    assert "The mood is calm authority" in text
    assert "Styled for LinkedIn portrait" in text
    assert "Negative constraints:" in text
    assert "no bad anatomy" in text


def test_stylization_level_changes_output() -> None:
    style_low = _style_fixture()
    style_high = _style_fixture()
    style_low["stylization_level"] = 1
    style_high["stylization_level"] = 5
    text_low = compile_prompt(style=style_low, model_id="nb2-1k", seed="same-seed")["prompt_text"]
    text_high = compile_prompt(style=style_high, model_id="nb2-1k", seed="same-seed")["prompt_text"]
    assert "Stylization level 1 (realistic and natural)" in text_low
    assert "Stylization level 5 (fantasy or illustration stylized)" in text_high
    assert text_low != text_high


def test_variation_seed_produces_deterministic_but_different_output() -> None:
    style = _style_fixture()
    one = compile_prompt(style=style, model_id="nb2-1k", seed="seed-a")["prompt_text"]
    one_repeat = compile_prompt(style=style, model_id="nb2-1k", seed="seed-a")["prompt_text"]
    two = compile_prompt(style=style, model_id="nb2-1k", seed="seed-b")["prompt_text"]
    assert one == one_repeat
    assert one != two


def test_custom_prompt_is_normalized_and_preserves_guardrails() -> None:
    result = compile_prompt(
        style=_style_fixture(),
        model_id="nb2-1k",
        user_prompt="cyberpunk night portrait with neon reflections",
        seed="seed-custom",
    )
    text = result["prompt_text"]
    assert "in a cyberpunk night portrait with neon reflections aesthetic" in text
    assert "Negative constraints:" in text
    assert "no bad anatomy" in text
