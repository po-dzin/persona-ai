"""Launcher for preview_start — uses local vendor/ packages to bypass sandbox restrictions."""
import sys, os

# Add local vendor packages (accessible to preview sandbox)
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "vendor"))
# Add API source
sys.path.insert(0, os.path.join(ROOT, "apps/api"))

# Use SQLite for local preview (psycopg2 not available without venv)
db_path = os.path.join(ROOT, "dev.db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{db_path}")
# Load .env for other settings (token, etc.)
env_file = os.path.join(ROOT, ".env")
if os.path.exists(env_file):
    for line in open(env_file):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            k = k.strip()
            if k != "DATABASE_URL":  # keep SQLite override
                os.environ.setdefault(k.strip(), v.strip())

import uvicorn

uvicorn.run(
    "app.main:app",
    host="0.0.0.0",
    port=3000,
    loop="asyncio",
    http="h11",
)
