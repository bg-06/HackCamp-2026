"""Settings from the repo-root `env` / `.env` files; real environment variables win."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def parse_env_file(path: Path) -> dict:
    values = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "'\"":
            val = val[1:-1]
        values[key.strip()] = val
    return values


@dataclass(frozen=True)
class Settings:
    postgres_host: str = ""
    postgres_port: int = 5432
    postgres_db: str = ""
    postgres_user: str = ""
    postgres_password: str = field(default="", repr=False)
    postgres_sslmode: str = "require"
    sink: str = "dry-run"
    api_base_url: str = ""
    auth0_domain: str = ""
    auth0_client_id: str = ""
    auth0_client_secret: str = field(default="", repr=False)
    auth0_audience: str = "https://api.blockbyblock"
    gemini_api_key: str | None = field(default=None, repr=False)
    gemini_model: str = "gemini-2.5-flash"
    areas: list | None = None


def load_settings(root: Path | None = None, environ=None) -> Settings:
    root = Path(root) if root is not None else REPO_ROOT
    merged = {}
    merged.update(parse_env_file(root / ".env"))
    merged.update(parse_env_file(root / "env"))  # `env` wins over `.env`
    merged.update(os.environ if environ is None else environ)

    def get(key, default=""):
        val = (merged.get(key) or "").strip()
        return val if val else default

    areas = [a.strip() for a in get("AGENT_AREAS").split(",") if a.strip()]
    return Settings(
        postgres_host=get("POSTGRES_HOST"),
        postgres_port=int(get("POSTGRES_PORT", "5432")),
        postgres_db=get("POSTGRES_DB"),
        postgres_user=get("POSTGRES_USER"),
        postgres_password=get("POSTGRES_PASSWORD"),
        postgres_sslmode=get("POSTGRES_SSLMODE", "require"),
        sink=get("AGENT_SINK", "dry-run"),
        api_base_url=get("AGENT_API_BASE_URL"),
        auth0_domain=get("AUTH0_DOMAIN"),
        auth0_client_id=get("AUTH0_CLIENT_ID"),
        auth0_client_secret=get("AUTH0_CLIENT_SECRET"),
        auth0_audience=get("AUTH0_AUDIENCE", "https://api.blockbyblock"),
        gemini_api_key=get("GEMINI_API_KEY") or None,
        gemini_model=get("GEMINI_MODEL", "gemini-2.5-flash"),
        areas=areas or None,
    )
