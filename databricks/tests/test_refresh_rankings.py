"""Exercise the notebook's SQL loading and dependency guards without Databricks."""
from pathlib import Path
import runpy
from types import SimpleNamespace


def run_notebook(monkeypatch, tables_exist):
    notebooks = Path(__file__).resolve().parents[1] / "notebooks"
    monkeypatch.chdir(notebooks)
    executed, values = [], {}

    def execute(sql):
        # A comment semicolon must not leave prose as the start of a SQL statement.
        assert sql.startswith("CREATE OR REPLACE TABLE bbb.gold."), sql
        executed.append(sql)

    spark = SimpleNamespace(
        conf=SimpleNamespace(set=lambda *_: None),
        catalog=SimpleNamespace(tableExists=lambda _: tables_exist), sql=execute)
    dbutils = SimpleNamespace(jobs=SimpleNamespace(taskValues=SimpleNamespace(set=values.__setitem__)))
    runpy.run_path(str(notebooks / "refresh_rankings.py"), init_globals={"spark": spark, "dbutils": dbutils})
    return executed, values


def test_loads_both_ranking_statements(monkeypatch):
    executed, values = run_notebook(monkeypatch, True)
    assert len(executed) == 2
    assert values["refreshed"] == ["bbb.gold.issue_priority", "bbb.gold.event_impact"]


def test_missing_app_tables_skip_both_statements(monkeypatch):
    executed, values = run_notebook(monkeypatch, False)
    assert executed == []
    assert values["refreshed"] == []
