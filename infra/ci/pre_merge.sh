#!/usr/bin/env bash
set -euo pipefail

python3 scripts/spec_lint.py
pytest
npm --prefix apps/web ci
npm --prefix apps/web run check:ui-gates
npm --prefix apps/web test
npm --prefix apps/web run build
