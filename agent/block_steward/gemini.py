"""Minimal Gemini REST client. Returns a callable prompt -> text."""
from __future__ import annotations

import requests

_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def make_gemini(api_key: str, model: str = "gemini-2.5-flash", timeout: int = 30):
    """Build llm(prompt) -> text. Raises on any failure; messages never include the key."""
    url = _URL.format(model=model)

    def llm(prompt: str) -> str:
        try:
            resp = requests.post(
                url,
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=timeout,
            )
            resp.raise_for_status()
            parts = resp.json()["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts)
        except Exception as exc:  # re-raise without request details (key is in headers)
            raise RuntimeError(f"Gemini request failed: {type(exc).__name__}") from None

    llm.model = model
    return llm
