from __future__ import annotations

from shared.contracts.status import PACKAGE_CREDITS


def normalize_package_code(package_code: str) -> str:
    code = package_code.strip().upper()
    if code.startswith("PACKAGE_"):
        code = code.removeprefix("PACKAGE_")
    if code.endswith("_STARS"):
        code = code.removesuffix("_STARS")
    return code


def is_known_package_code(package_code: str) -> bool:
    return normalize_package_code(package_code) in PACKAGE_CREDITS
