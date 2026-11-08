import importlib.util
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "verify_event_impact", Path(__file__).resolve().parents[1] / "operations" / "verify_event_impact.py")
verify = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verify)


def successful_run():
    return {"job_id": verify.FAST_JOB_ID, "start_time": 1000, "end_time": 2000,
            "state": {"result_state": "SUCCESS"},
            "tasks": [{"task_key": name, "state": {"result_state": "SUCCESS"}}
                      for name in ("refresh_rankings", "publish_gold")]}


def matching_row():
    return {"event_id": "event-1", "done_at": "2026-11-07T21:00:00Z", "category": "Garbage",
            "valid_h3": "true", "expected_before": "0", "expected_after": "0",
            "delta_event_id": "event-1", "delta_before": "0", "delta_after": "0",
            "postgres_event_id": "event-1", "postgres_before": "0", "postgres_after": "0",
            "delta_event_matches": "true", "postgres_event_matches": "true", "fresh": "true",
            "run_after_completion": "true"}


def test_success_requires_both_tasks():
    assert verify.check_run(successful_run()) == (1000, 2000)
    run = successful_run()
    run["tasks"].pop()
    with pytest.raises(ValueError, match="publish_gold"):
        verify.check_run(run)


def test_an_unrelated_or_unfinished_run_is_rejected():
    run = successful_run()
    run["job_id"] = 1
    with pytest.raises(ValueError, match="different job"):
        verify.check_run(run)
    run = successful_run()
    run["state"] = {"life_cycle_state": "RUNNING"}
    with pytest.raises(ValueError, match="not succeeded"):
        verify.check_run(run)


def test_latest_success_skips_failed_runs(monkeypatch):
    def fake_cli(*args):
        if args[0] == "api":
            return {"runs": [{"run_id": 1, "state": {"result_state": "FAILED"}},
                             {"run_id": 2, "state": {"result_state": "SUCCESS"}}]}
        assert args == ("jobs", "get-run", "2")
        return successful_run()

    monkeypatch.setattr(verify, "cli", fake_cli)
    assert verify.latest_successful_run() == successful_run()


def test_latest_success_reports_no_success(monkeypatch):
    monkeypatch.setattr(verify, "cli", lambda *args: {"runs": []})
    with pytest.raises(ValueError, match="No successful"):
        verify.latest_successful_run()


def test_zero_reports_is_valid_when_row_and_fresh_publication_exist():
    assert verify.assess(matching_row()) == []


@pytest.mark.parametrize("field,value,message", [
    ("done_at", None, "not been completed"),
    ("valid_h3", "false", "resolution-9"),
    ("category", None, "category"),
    ("delta_event_id", None, "missing from delta"),
    ("postgres_event_id", None, "missing from postgres"),
    ("delta_event_matches", None, "different event inputs"),
    ("postgres_before", "1", "before count differs"),
    ("delta_after", None, "after count differs"),
    ("fresh", "false", "not fresh"),
    ("run_after_completion", "false", "before event completion"),
])
def test_incomplete_stale_or_mismatching_data_fails(field, value, message):
    row = matching_row()
    row[field] = value
    assert any(message in error for error in verify.assess(row))


def test_event_id_is_bound_as_data_not_interpolated_into_sql(monkeypatch):
    malicious = "event' OR 1=1 --"
    monkeypatch.setattr("sys.argv", ["verify", "--event-id", malicious, "--run-id", "123"])
    monkeypatch.setattr(verify, "cli", lambda *args: successful_run())

    def query(statement, parameters):
        assert malicious not in statement
        assert parameters[0] == {"name": "event_id", "value": malicious, "type": "STRING"}
        return [matching_row()]

    monkeypatch.setattr(verify, "select", query)
    assert verify.main() == 0


def test_event_defaults_to_latest_successful_scheduled_run(monkeypatch):
    monkeypatch.setattr("sys.argv", ["verify", "--event-id", "event-1"])
    monkeypatch.setattr(verify, "latest_successful_run", successful_run)
    monkeypatch.setattr(verify, "select", lambda *args: [matching_row()])
    assert verify.main() == 0
