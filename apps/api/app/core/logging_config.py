from __future__ import annotations

import logging
import logging.config
import os


def configure_logging() -> None:
    """
    Configure structured JSON logging when LOG_FORMAT=json (production),
    or plain text logging for local development.
    """
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = os.getenv("LOG_FORMAT", "text").lower()

    if log_format == "json":
        _configure_json(log_level)
    else:
        _configure_text(log_level)


def _configure_text(level: str) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


def _configure_json(level: str) -> None:
    try:
        from pythonjsonlogger import jsonlogger  # type: ignore[import-untyped]

        handler = logging.StreamHandler()
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%SZ",
            rename_fields={"levelname": "level", "asctime": "ts", "name": "logger"},
        )
        handler.setFormatter(formatter)

        root = logging.getLogger()
        root.handlers.clear()
        root.addHandler(handler)
        root.setLevel(level)

        # Quiet noisy libraries
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    except ImportError:
        # python-json-logger not installed — fall back to text
        _configure_text(level)
        logging.getLogger(__name__).warning(
            "python-json-logger not installed; using plain text logging. "
            "Add 'python-json-logger' to requirements.txt for JSON output."
        )
