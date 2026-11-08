import re
from datetime import date, datetime, timezone

import pytest

from block_steward import gemini as G
from block_steward.briefing import build_briefing

TODAY = date(2026, 11, 7)  # a Saturday


def ev(title="Cleanup at Jonathan Rogers Park", organiser="Mount Pleasant BIA",
       starts=datetime(2026, 11, 14, 18, 0, tzinfo=timezone.utc), area="Mount Pleasant", **kw):
    d = {"id": 1, "title": title, "organiser": organiser, "starts_at": starts,
         "local_area": area, "done_at": None, "kind": "hotspot"}
    d.update(kw)
    return d


def issue(i, rt="Loose Litter Clean Up Case", addr="100 E 7th Ave", open_cases=3,
          days_open=12, score=10.0):
    return {"issue_id": f"i{i}", "h3_r9": "89", "request_type": rt, "category": "Litter",
            "local_area": "Mount Pleasant", "address": addr, "open_cases": open_cases,
            "days_open": days_open, "times_reported_12m": 5, "base_score": score}


def hot(rt="Loose Litter Clean Up Case", h="89a"):
    return {"h3_r9": h, "request_type": rt, "category": "Litter",
            "local_area": "Mount Pleasant", "times_reported": 6, "months_seen": 4,
            "last_reported": datetime(2026, 11, 1, tzinfo=timezone.utc)}


SUMMARY = {"local_area": "Mount Pleasant", "generated_on": date(2026, 11, 1),
           "summary": "Mount Pleasant had steady litter reports this autumn."}


def full(llm=None):
    return build_briefing(
        "Mount Pleasant", SUMMARY, [ev()],
        [issue(1, score=5), issue(2, "Graffiti Removal - City Property Case", None, 1, 30, 9),
         issue(3, score=7), issue(4, score=1)],
        [hot(h="a"), hot(h="b"), hot("Graffiti Removal - City Property Case", "c")],
        TODAY, llm)


def test_contract_keys_and_template():
    p = full()
    assert set(p) == {"kind", "author", "local_area", "title", "body", "week_of", "model", "dedupe_key"}
    assert p["kind"] == "briefing" and p["author"] == "block-steward-agent"
    assert p["title"] == "This week in Mount Pleasant"
    assert p["model"] == "template"
    assert p["week_of"] == "2026-11-02"
    assert p["dedupe_key"] == "briefing:Mount Pleasant:2026-11-02"
    assert len(p["body"].split("\n\n")) == 3


def test_template_content_uses_data_only_and_vancouver_dates():
    body = full()["body"]
    assert "steady litter reports" in body
    assert "Cleanup at Jonathan Rogers Park" in body
    assert "Mount Pleasant BIA" in body
    assert "Sat, Nov 14" in body  # 18:00 UTC is 10:00 in Vancouver
    # top 3 of 4 issues by score: i2(9), i3(7), i1(5); i4 omitted
    assert body.count("open case") == 3
    assert "raffiti on City property" in body
    assert "2 spots for loose litter" in body
    assert "1 spot for graffiti on City property" in body
    assert not re.search(r"<|^#", body, re.M)


def test_vancouver_day_boundary():
    late = datetime(2026, 11, 15, 3, 0, tzinfo=timezone.utc)  # Nov 14, 7 pm in Vancouver
    body = build_briefing("Mount Pleasant", None, [ev(starts=late)], [], [], TODAY)["body"]
    assert "Sat, Nov 14" in body


def test_events_filtered_to_area_window_and_done():
    far = ev("Far", starts=datetime(2026, 11, 20, 18, tzinfo=timezone.utc))
    other = ev("Elsewhere", area="Kitsilano")
    done = ev("Finished", done_at=datetime(2026, 11, 1, tzinfo=timezone.utc))
    past = ev("Past", starts=datetime(2026, 11, 1, 18, tzinfo=timezone.utc))
    body = build_briefing("Mount Pleasant", None, [far, other, done, past, ev()], [], [], TODAY)["body"]
    for t in ("Far", "Elsewhere", "Finished", "Past"):
        assert t not in body
    assert "Cleanup at Jonathan Rogers Park" in body


def test_max_three_events():
    evs = [ev(f"Event {i}", starts=datetime(2026, 11, 8 + i, 18, tzinfo=timezone.utc)) for i in range(5)]
    body = build_briefing("Mount Pleasant", None, evs, [], [], TODAY)["body"]
    assert "Event 2" in body and "Event 3" not in body


def test_no_events_no_summary_reads_well():
    p = build_briefing("Mount Pleasant", None, [], [issue(1, addr=None)], [], TODAY)
    body = p["body"]
    assert len(body.split("\n\n")) == 3
    assert "No neighbour events" in body
    assert "None" not in body and "{" not in body
    assert "oose litter" in body


def test_nothing_at_all():
    body = build_briefing("Mount Pleasant", None, [], [], [], TODAY)["body"]
    assert len(body.split("\n\n")) == 3
    assert "None" not in body
    assert "Van311" in body


def test_llm_path_and_prompt():
    seen = []

    def llm(prompt):
        seen.append(prompt)
        return "  Hi neighbours! Join the cleanup on Sat, Nov 14.  "
    llm.model = "gemini-2.5-flash"
    p = full(llm)
    assert p["body"] == "Hi neighbours! Join the cleanup on Sat, Nov 14."
    assert p["model"] == "gemini-2.5-flash"
    pr = seen[0]
    for needle in ("120 words", "Markdown", "HTML", "Canadian", "steady litter reports",
                   "Cleanup at Jonathan Rogers Park"):
        assert needle in pr


@pytest.mark.parametrize("bad", [
    "", "   ", "x" * 1201, "Hello <b>there</b>", "# Heading\nText", "Intro\n## Sub\nText",
    "Use <script>", None,
])
def test_bad_llm_reply_falls_back(bad):
    p = full(lambda prompt: bad)
    assert p["model"] == "template"
    assert p["body"].startswith("Here is")


def test_llm_exception_falls_back():
    def boom(prompt):
        raise RuntimeError("down")
    assert full(boom)["model"] == "template"


def test_llm_exactly_1200_ok():
    assert full(lambda p: "x" * 1200)["model"] != "template"


def test_week_of_monday():
    def f(d):
        return build_briefing("A", None, [], [], [], d)["week_of"]
    assert f(date(2026, 11, 9)) == "2026-11-09"
    assert f(date(2026, 11, 15)) == "2026-11-09"
    assert f(date(2026, 11, 7)) == "2026-11-02"


# ---- gemini.py ----

class FakeResp:
    def __init__(self, data, status=200):
        self._d, self.status_code = data, status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._d


def test_gemini_request(monkeypatch):
    calls = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.update(url=url, headers=headers, json=json, timeout=timeout)
        return FakeResp({"candidates": [{"content": {"parts": [{"text": "Hello "}, {"text": "world"}]}}]})
    monkeypatch.setattr(G.requests, "post", fake_post)
    llm = G.make_gemini("SECRET", timeout=7)
    assert llm("hi") == "Hello world"
    assert llm.model == "gemini-2.5-flash"
    assert calls["url"] == ("https://generativelanguage.googleapis.com/v1beta/models/"
                            "gemini-2.5-flash:generateContent")
    assert calls["headers"]["x-goog-api-key"] == "SECRET"
    assert "SECRET" not in calls["url"]
    assert calls["json"]["contents"][0]["parts"][0]["text"] == "hi"
    assert calls["timeout"] == 7


def test_gemini_errors_do_not_leak_key(monkeypatch):
    monkeypatch.setattr(G.requests, "post", lambda *a, **k: FakeResp({}, 500))
    with pytest.raises(Exception) as e:
        G.make_gemini("SECRET")("hi")
    assert "SECRET" not in str(e.value)
    monkeypatch.setattr(G.requests, "post", lambda *a, **k: FakeResp({"candidates": []}))
    with pytest.raises(Exception) as e:
        G.make_gemini("SECRET")("hi")
    assert "SECRET" not in str(e.value)
