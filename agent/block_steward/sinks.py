"""Where payloads go: dry-run (print + JSON files) or http (Auth0 token, POST to the app API)."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import requests

ROUTES = {"suggestion": "/agent/suggestions", "briefing": "/agent/briefings"}


def _safe(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", text).strip("_")


class DryRunSink:
    def __init__(self, out_dir):
        self.out_dir = Path(out_dir)

    def send(self, payload: dict) -> None:
        self.out_dir.mkdir(parents=True, exist_ok=True)
        name = f"{payload['kind']}-{_safe(payload['dedupe_key'])}.json"
        (self.out_dir / name).write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"[dry-run] {payload['kind']} for {payload['local_area']}: "
              f"{payload['title']} -> {name}")


class HttpSink:
    def __init__(self, base_url, auth0_domain, client_id, client_secret, audience,
                 clock=time.time, timeout=30):
        self.base_url = base_url.rstrip("/")
        self.domain = auth0_domain
        self.client_id = client_id
        self.client_secret = client_secret
        self.audience = audience
        self.clock = clock
        self.timeout = timeout
        self._token = None
        self._expires_at = 0.0

    def _get_token(self) -> str:
        if self._token and self.clock() < self._expires_at - 60:
            return self._token
        resp = requests.post(
            f"https://{self.domain}/oauth/token",
            json={"grant_type": "client_credentials", "client_id": self.client_id,
                  "client_secret": self.client_secret, "audience": self.audience},
            timeout=self.timeout)
        if not 200 <= resp.status_code < 300:
            raise RuntimeError(f"Auth0 token request failed: HTTP {resp.status_code} "
                               f"{(resp.text or '')[:200]}")
        data = resp.json()
        self._token = data["access_token"]
        self._expires_at = self.clock() + float(data.get("expires_in", 3600))
        return self._token

    def send(self, payload: dict) -> None:
        url = self.base_url + ROUTES[payload["kind"]]
        resp = requests.post(
            url, json=payload, timeout=self.timeout,
            headers={"Authorization": f"Bearer {self._get_token()}"})
        if not 200 <= resp.status_code < 300:
            raise RuntimeError(f"POST {ROUTES[payload['kind']]} failed: HTTP "
                               f"{resp.status_code} {(resp.text or '')[:200]}")
