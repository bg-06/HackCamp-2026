"""Check publisher preflight without Spark, credentials, or a database."""
import ast
from pathlib import Path

import pytest


def load_preflight():
    source = Path(__file__).resolve().parents[1] / "notebooks" / "publish_gold.py"
    tree = ast.parse(source.read_text(encoding="utf-8"))
    # Load the actual destination map and preflight function without executing notebook cells.
    selected = [
        node for node in tree.body
        if (isinstance(node, ast.FunctionDef) and node.name == "validate_targets")
        or (isinstance(node, ast.Assign)
            and any(isinstance(t, ast.Name) and t.id == "TABLES" for t in node.targets))
    ]
    namespace = {}
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(source), "exec"), namespace)
    return namespace["validate_targets"], namespace["TABLES"]


class Connection:
    def __init__(self, missing=()):
        self.missing = set(missing)
        self.checked = []

    def run(self, query, *, table):
        assert query == "SELECT to_regclass(:table)"
        self.checked.append(table)
        return [[None if table in self.missing else table]]


def test_all_destinations_checked_without_writes():
    validate, tables = load_preflight()
    conn = Connection()
    validate(conn)
    assert conn.checked == [*tables, "gold_published"]


@pytest.mark.parametrize("missing", [
    ["gold_published"],
    ["gold_help_hotspots", "gold_track2_issues"],
])
def test_missing_destinations_fail_with_migration_instructions(missing):
    validate, tables = load_preflight()
    conn = Connection(missing)
    with pytest.raises(RuntimeError) as exc:
        validate(conn)
    for table in missing:
        assert table in str(exc.value)
    assert "npm --prefix app run db:migrate" in str(exc.value)
    assert conn.checked == [*tables, "gold_published"]
