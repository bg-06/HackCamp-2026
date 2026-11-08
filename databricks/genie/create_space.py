"""Create or update the Genie space from databricks/genie/instructions.md.

Run from the repo root (the databricks CLI must be logged in):

    python databricks/genie/create_space.py

Idempotent: if a space titled TITLE exists it is updated, otherwise created.
It only finds spaces you can access: a teammate without access to the existing space would create a second one,
so share the space with the team or ask its owner to re-run the script.
Uses only the standard library and the `databricks` CLI.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

TITLE = "GreenHands BC: Vancouver 311"
WAREHOUSE_ID = "2f68997ea797ec69"  # must match the warehouse_id variable default in databricks/databricks.yml
DESCRIPTION = "Ask questions about Vancouver 311 service requests, hotspots and City issues."
INSTRUCTIONS = Path(__file__).with_name("instructions.md")


def section(text, heading):
    """Body of the '## heading...' section (up to the next '## ')."""
    m = re.search(r"^## " + re.escape(heading) + r".*?\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    if not m:
        sys.exit(f"instructions.md: section not found: {heading}")
    return m.group(1)


def parse(path):
    text = path.read_text(encoding="utf-8")
    tables = re.findall(r"^- `([\w.]+)`", section(text, "Tables to add"), re.M)
    general = section(text, "General instructions").strip()
    examples = []
    body = section(text, "Sample questions and SQL")
    for m in re.finditer(r"^### \d+\. (.+?)\n(.*?)(?=^### |\Z)", body, re.S | re.M):
        question, block = m.group(1).strip(), m.group(2)
        # Only the first sql block: the alternative for question 3 is not used.
        sql = re.search(r"```sql\n(.*?)```", block, re.S)
        if sql:
            examples.append((question, sql.group(1).strip()))
    if not tables or not general or not examples:
        sys.exit("instructions.md: parsed nothing; check its structure")
    return tables, general, examples


def new_id(n):
    return f"01f1c0de000000000000000000{n:06x}"  # 32 hex chars, ascending


def build_serialized(tables, general, examples):
    # ids are 32 hex chars and ascending within each list
    space = {
        "version": 2,
        "config": {"sample_questions": [
            {"id": new_id(100 + i), "question": [q]} for i, (q, _) in enumerate(examples)]},
        "data_sources": {"tables": [{"identifier": t} for t in sorted(tables)]},
        "instructions": {
            "text_instructions": [{"id": new_id(1), "content": [general]}],
            # one-element sql list: elements are concatenated without newlines
            "example_question_sqls": [
                {"id": new_id(200 + i), "question": [q], "sql": [sql]}
                for i, (q, sql) in enumerate(examples)],
        },
    }
    return json.dumps(space)


def cli(*args):
    exe = shutil.which("databricks") or "databricks"
    r = subprocess.run([exe, *args, "-o", "json"], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        sys.exit(f"databricks {' '.join(args[:2])} failed:\n{r.stderr or r.stdout}")
    return json.loads(r.stdout or "{}")


def find_spaces():
    found, token = [], None
    while True:
        out = cli("genie", "list-spaces", *(["--page-token", token] if token else []))
        found += [s for s in out.get("spaces", []) if s.get("title") == TITLE]
        token = out.get("next_page_token")
        if not token:
            return found


def main():
    serialized = build_serialized(*parse(INSTRUCTIONS))
    existing = find_spaces()
    if existing:
        sid = existing[0]["space_id"]
        cli("genie", "update-space", sid, "--title", TITLE, "--description", DESCRIPTION,
            "--warehouse-id", WAREHOUSE_ID, "--serialized-space", serialized)
        print(f"updated space {sid}" + (f" (WARNING: {len(existing)} spaces share this title)" if len(existing) > 1 else ""))
    else:
        out = cli("genie", "create-space", WAREHOUSE_ID, serialized, "--title", TITLE, "--description", DESCRIPTION)
        sid = out["space_id"]
        print(f"created space {sid}")
    print(f"space id: {sid}")


if __name__ == "__main__":
    main()
