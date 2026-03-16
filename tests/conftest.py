import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API_DIR = ROOT / "apps" / "api"

for p in (ROOT, API_DIR):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)
