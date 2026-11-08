import json

import pytest

from block_steward import sinks
from block_steward.sinks import DryRunSink, HttpSink

SUGG = {"kind": "suggestion", "title": "Clean up", "local_area": "Mount Pleasant",
        "dedupe_key": "suggestion:89abc:dumping/x:2026-11-09"}
BRIEF = {"kind": "briefing", "title": "This week", "local_area": "Strathcona",
         "dedupe_key": "briefing:Strathcona:2026-11-09"}


def test_dry_run_writes_safe_file_and_prints(tmp_path, capsys):
    sink = DryRunSink(tmp_path / "out")
    sink.send(SUGG)
    sink.send(BRIEF)
    names = sorted(p.name for p in (tmp_path / "out").iterdir())
    assert names == ["briefing-briefing_Strathcona_2026-11-09.json",
                     "suggestion-suggestion_89abc_dumping_x_2026-11-09.json"]
    data = json.loads((tmp_path / "out" / names[1]).read_text(encoding="utf-8"))
    assert data == SUGG
    out = capsys.readouterr().out
    assert "Clean up" in out and "Mount Pleasant" in out


class FakeResp:
    def __init__(self, status=200, body=None, text=""):
        self.status_code = status
        self._body = body
        self.text = text

    def json(self):
        return self._body


class FakeRequests:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def post(self, url, **kw):
        self.calls.append((url, kw))
        return self.responses.pop(0)


def _sink(monkeypatch, responses, clock=None):
    fake = FakeRequests(responses)
    monkeypatch.setattr(sinks, "requests", fake)
    s = HttpSink("https://app.example/api/", "tenant.auth0.com", "cid", "csecret",
                 "https://api.blockbyblock", clock=clock or (lambda: 1000.0))
    return s, fake


def test_http_gets_token_then_posts(monkeypatch):
    s, fake = _sink(monkeypatch, [FakeResp(200, {"access_token": "tok", "expires_in": 3600}),
                                  FakeResp(201, {})])
    s.send(SUGG)
    (turl, tkw), (purl, pkw) = fake.calls
    assert turl == "https://tenant.auth0.com/oauth/token"
    assert tkw["json"]["grant_type"] == "client_credentials"
    assert tkw["json"]["audience"] == "https://api.blockbyblock"
    assert purl == "https://app.example/api/agent/suggestions"
    assert pkw["headers"]["Authorization"] == "Bearer tok"
    assert pkw["json"] == SUGG


def test_http_routes_briefings_and_caches_token(monkeypatch):
    s, fake = _sink(monkeypatch, [FakeResp(200, {"access_token": "tok", "expires_in": 3600}),
                                  FakeResp(200, {}), FakeResp(200, {})])
    s.send(BRIEF)
    s.send(BRIEF)
    urls = [c[0] for c in fake.calls]
    assert urls.count("https://tenant.auth0.com/oauth/token") == 1
    assert urls[1].endswith("/agent/briefings")


def test_http_refreshes_expired_token(monkeypatch):
    now = [1000.0]
    s, fake = _sink(monkeypatch, [FakeResp(200, {"access_token": "t1", "expires_in": 100}),
                                  FakeResp(200, {}),
                                  FakeResp(200, {"access_token": "t2", "expires_in": 100}),
                                  FakeResp(200, {})], clock=lambda: now[0])
    s.send(BRIEF)
    now[0] += 500
    s.send(BRIEF)
    assert fake.calls[3][1]["headers"]["Authorization"] == "Bearer t2"


def test_http_error_has_status_and_short_body_but_no_token(monkeypatch):
    s, _ = _sink(monkeypatch, [FakeResp(200, {"access_token": "SECRETTOKEN", "expires_in": 3600}),
                               FakeResp(403, text="forbidden " + "x" * 1000)])
    with pytest.raises(RuntimeError) as e:
        s.send(SUGG)
    msg = str(e.value)
    assert "403" in msg and "forbidden" in msg
    assert len(msg) < 400
    assert "SECRETTOKEN" not in msg


def test_http_token_failure_does_not_leak_secret(monkeypatch):
    s, _ = _sink(monkeypatch, [FakeResp(401, text="access_denied")])
    with pytest.raises(RuntimeError) as e:
        s.send(SUGG)
    assert "401" in str(e.value) and "csecret" not in str(e.value)
