#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ALL_FILES = [
    ROOT / "photo_animation_mvp_spec.md",
    ROOT / "live_photo_app_architecture.html",
    ROOT / "uiux-spec.html",
    ROOT / "specs" / "photo_animation_mvp_spec.md",
    ROOT / "specs" / "live_photo_app_architecture.html",
    ROOT / "specs" / "uiux-spec.html",
    *sorted((ROOT / "specs").glob("*.md")),
]
FILES = [f for f in ALL_FILES if f.exists()]

OUTDATED_PATTERNS = [
    r"BackgroundTasks only",
    r"5\s*/\s*20\s*/\s*50",
    r"S/M/L\s*=\s*5/20/50",
    r"\b40–180\b",
    r"bot-only",
    r"LivePortrait",
    r"Runway Gen-4 Turbo",
]

REQUIRED_GLOBAL = [
    r"150/370/880/2300/6000",
    r"webhook_events",
    r"Celery Beat",
    r"30–120",
    r"48h",
    r"30d",
]

# High-signal per-file lock checks
REQUIRED_BY_FILE = {
    "specs/photo_animation_mvp_spec.md": [r"Mini App \+ Web", r"Nano Banana", r"webhook_events"],
    "specs/00_unified_spec.md": [r"150/370/880/2300/6000", r"webhook_events\(provider,event_id\)"],
    "specs/08_tariff_spec.md": [r"7–42", r"Starter/Basic/Popular/Pro/Ultra", r"150/370/880/2300/6000"],
    "specs/06_technical_architecture_diagrams.md": [r"Redis \+ Celery", r"webhook_events\(provider,event_id\)"],
}


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def find_matches(pattern: str, text: str) -> list[tuple[int, str]]:
    rx = re.compile(pattern, re.IGNORECASE)
    matches = []
    for i, line in enumerate(text.splitlines(), 1):
        if rx.search(line):
            matches.append((i, line.strip()))
    return matches


def check_outdated() -> list[str]:
    errors: list[str] = []
    for f in FILES:
        text = f.read_text(encoding="utf-8")
        for p in OUTDATED_PATTERNS:
            for line_no, line in find_matches(p, text):
                errors.append(f"[OUTDATED] {rel(f)}:{line_no}: /{p}/ -> {line}")
    return errors


def check_required() -> list[str]:
    errors: list[str] = []
    corpus = "\n".join(f.read_text(encoding="utf-8") for f in FILES)

    for p in REQUIRED_GLOBAL:
        if not re.search(p, corpus, re.IGNORECASE):
            errors.append(f"[MISSING-GLOBAL] /{p}/")

    for rf, patterns in REQUIRED_BY_FILE.items():
        fp = ROOT / rf
        if not fp.exists():
            errors.append(f"[MISSING-FILE] {rf}")
            continue
        text = fp.read_text(encoding="utf-8")
        for p in patterns:
            if not re.search(p, text, re.IGNORECASE):
                errors.append(f"[MISSING] {rf}: /{p}/")

    return errors


def parse_schema_tables(schema_text: str) -> set[str]:
    return set(re.findall(r"CREATE TABLE IF NOT EXISTS\s+([a-z_]+)\s*\(", schema_text, flags=re.IGNORECASE))


def parse_er_entities(er_text: str) -> set[str]:
    entities = re.findall(r"^\s{2}([A-Z_]+)\s*\{", er_text, flags=re.MULTILINE)
    return {e.lower() for e in entities}


def check_er_sync() -> list[str]:
    errors: list[str] = []
    schema = (ROOT / "specs" / "schema.sql")
    er = (ROOT / "specs" / "07_database_er_diagram.md")
    if not schema.exists() or not er.exists():
        return ["[MISSING] specs/schema.sql or specs/07_database_er_diagram.md"]

    schema_tables = parse_schema_tables(schema.read_text(encoding="utf-8"))
    er_entities = parse_er_entities(er.read_text(encoding="utf-8"))

    missing = sorted(schema_tables - er_entities)
    extra = sorted(er_entities - schema_tables)

    if missing:
        errors.append(f"[ER-SYNC] Missing in ER: {', '.join(missing)}")
    if extra:
        errors.append(f"[ER-SYNC] Extra in ER: {', '.join(extra)}")
    return errors


def main() -> int:
    checks = [
        ("Outdated patterns", check_outdated),
        ("Required canon markers", check_required),
        ("ER sync", check_er_sync),
    ]

    all_errors: list[str] = []
    for name, fn in checks:
        errs = fn()
        if errs:
            print(f"❌ {name}: {len(errs)} issue(s)")
            for e in errs:
                print(f"  - {e}")
            all_errors.extend(errs)
        else:
            print(f"✅ {name}: OK")

    if all_errors:
        print(f"\nFAILED: {len(all_errors)} total issue(s)")
        return 1

    print("\nPASSED: specs are consistent with v2 canon")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
