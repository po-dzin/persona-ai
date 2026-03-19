#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
API_DIR = ROOT / "apps" / "api"

for p in (ROOT, API_DIR):
    s = str(p)
    if s not in sys.path:
        sys.path.insert(0, s)

from app.core.settings import required_env_for_mode  # noqa: E402


def load_env_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"env file not found: {path}")

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        # Do not overwrite already exported environment variables.
        os.environ.setdefault(key, value)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate env vars for mock/real runtime modes")
    parser.add_argument("--mode", choices=["mock", "real"], default=os.getenv("INTEGRATION_MODE", "mock"))
    parser.add_argument("--env-file", default=".env", help="Path to .env file (default: .env)")
    args = parser.parse_args()

    env_file = Path(args.env_file)
    if env_file.exists():
        load_env_file(env_file)

    required = required_env_for_mode(args.mode)["required"]
    def is_missing_value(value: str | None) -> bool:
        if not value:
            return True
        normalized = value.strip().lower()
        return normalized in {"replace", "__fill_me__", "<fill_me>", "changeme", "todo"}

    missing = [k for k in required if is_missing_value(os.getenv(k))]

    print(f"Mode: {args.mode}")
    print(f"Env file: {env_file if env_file.exists() else 'not found (using process env only)'}")

    if missing:
        print("\nMissing required env vars:")
        for key in missing:
            print(f"- {key}")
        print("\nResult: FAILED")
        return 1

    print("\nRequired env vars: OK")

    optional_bundle = required_env_for_mode(args.mode)["optional_bundle"]
    optional_missing = [k for k in optional_bundle if is_missing_value(os.getenv(k))]
    if optional_missing:
        print("Optional Stripe bundle: incomplete (ok if Stripe fallback is disabled)")
        for key in optional_missing:
            print(f"- {key}")
    else:
        print("Optional Stripe bundle: OK")

    print("\nResult: PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
