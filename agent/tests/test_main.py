from datetime import date, datetime, timedelta

import pytest

from block_steward import __main__ as M
from block_steward.timeutil import LOCAL_TZ

TODAY = date(2026, 11, 9)


class FlakySink:
    """Fails the first `fail_first` sends, then works."""
    def __init__(self, fail_first=1):
        self.fail_first = fail_first
        self.calls = 0
        self.sent = []

    def send(self, payload):
        self.calls += 1
        if self.calls <= self.fail_first:
            raise RuntimeError("boom")
        self.sent.append(payload)


class Settings:
    gemini_api_key = None
    gemini_model = "m"


def _hot(cell, area="Mount Pleasant"):
    return {"h3_r9": cell, "request_type": "Loose Litter Clean Up Case", "category": "Litter",
            "local_area": area, "times_reported": 5, "months_seen": 4,
            "last_reported": datetime(2026, 11, 1, tzinfo=LOCAL_TZ)}


class FakeConn:
    def close(self):
        pass


@pytest.fixture
def fake_db(monkeypatch):
    import h3
    cells = [h3.latlng_to_cell(49.26 + i * 0.003, -123.1, 9) for i in range(3)]
    monkeypatch.setattr(M.db, "connect", lambda s: FakeConn())
    monkeypatch.setattr(M.db, "help_hotspots", lambda c, a=None: [_hot(x) for x in cells])
    monkeypatch.setattr(M.db, "upcoming_events", lambda c, t, d=14: [])
    monkeypatch.setattr(M.db, "orgs", lambda c: [])
    monkeypatch.setattr(M.db, "area_summaries", lambda c, a=None: [])
    monkeypatch.setattr(M.db, "top_track2", lambda c, a, n=5: [])


def test_run_suggest_continues_after_a_failed_send_and_reports_failure(fake_db):
    sink = FlakySink(1)
    result = M.run_suggest(Settings(), sink, ["Mount Pleasant"], TODAY)
    assert sink.calls == 3 and len(sink.sent) == 2
    assert result.sent == 2 and result.failed == 1 and not result.ok


def test_run_brief_continues_after_a_failed_send(fake_db):
    sink = FlakySink(1)
    result = M.run_brief(Settings(), sink, ["Mount Pleasant", "Strathcona"], TODAY)
    assert sink.calls == 2 and len(sink.sent) == 1
    assert result.failed == 1 and not result.ok


def test_all_good_is_ok(fake_db):
    result = M.run_suggest(Settings(), FlakySink(0), ["Mount Pleasant"], TODAY)
    assert result.ok and result.sent == 3


def test_failed_send_logs_type_and_short_message(fake_db, capsys):
    M.run_suggest(Settings(), FlakySink(1), ["Mount Pleasant"], TODAY)
    out = capsys.readouterr().out
    assert "RuntimeError" in out and "boom" in out


class Stop(BaseException):
    pass


def _clock(monkeypatch, start):
    clock = {"now": start}
    monkeypatch.setattr(M, "_now", lambda: clock["now"])
    monkeypatch.setattr(M.time, "sleep",
                        lambda s: clock.__setitem__("now", clock["now"] + timedelta(seconds=s)))
    return clock


def test_run_loop_retries_failed_job_every_30_minutes_up_to_3_tries(monkeypatch):
    clock = _clock(monkeypatch, datetime(2026, 11, 9, 6, 59, tzinfo=LOCAL_TZ))
    runs = []

    def job(settings, sink, areas, today):
        runs.append(clock["now"])
        if len(runs) >= 5:
            raise Stop
        return M.RunResult(sent=0, failed=1)
    monkeypatch.setattr(M, "run_suggest", job)
    monkeypatch.setattr(M, "run_brief", lambda *a: M.RunResult(sent=1, failed=0))
    with pytest.raises(Stop):
        M.run_loop(Settings(), None, None)
    gaps = [b - a for a, b in zip(runs, runs[1:])]
    assert gaps[0] == timedelta(minutes=30) and gaps[1] == timedelta(minutes=30)
    # third try failed: no more retries, wait for the next normal slot
    assert gaps[2] > timedelta(hours=12)


def test_run_loop_exception_also_retries(monkeypatch):
    clock = _clock(monkeypatch, datetime(2026, 11, 9, 6, 59, tzinfo=LOCAL_TZ))
    runs = []

    def job(*a):
        runs.append(clock["now"])
        if len(runs) == 1:
            raise ConnectionError("db down")
        raise Stop
    monkeypatch.setattr(M, "run_suggest", job)
    with pytest.raises(Stop):
        M.run_loop(Settings(), None, None)
    assert runs[1] - runs[0] == timedelta(minutes=30)
