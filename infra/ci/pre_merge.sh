#!/usr/bin/env bash
set -euo pipefail

python3 scripts/spec_lint.py
pytest
