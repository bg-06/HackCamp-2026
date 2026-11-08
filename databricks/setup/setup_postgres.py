"""One-time setup: connect Databricks to our Postgres.

Reads the repo-root `env` or `.env` file (gitignored) and, using the already-authenticated `databricks` CLI:
  1. creates secret scope `bbb` (if missing) and stores pg_host, pg_port, pg_db, pg_user, pg_password, pg_sslmode
  2. runs databricks/sql/setup.sql on a SQL warehouse: Unity Catalog connection `bbb_pg`,
     foreign catalog `bbb_app` (read-only view of Postgres), `bbb.gold.track_overrides` and
     `bbb.gold.type_labels`
  3. runs databricks/sql/type_labels_seed.sql: the reviewed AI labels per request type

Secrets go to the CLI on stdin, never on the command line, and are never printed.

    python databricks/setup/setup_postgres.py [--warehouse-id ID] [--skip-secrets]

Re-runnable: everything is CREATE ... IF NOT EXISTS, and secrets are overwritten with the env values.
"""
import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCOPE = "bbb"
KEYS = {  # secret key -> env var
    "pg_host": "POSTGRES_HOST",
    "pg_port": "POSTGRES_PORT",
    "pg_db": "POSTGRES_DB",
    "pg_user": "POSTGRES_USER",
    "pg_password": "POSTGRES_PASSWORD",
    "pg_sslmode": "POSTGRES_SSLMODE",
}


def read_env(path):
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    missing = [v for v in KEYS.values() if not env.get(v) or env[v].startswith("<")]
    if missing:
        sys.exit(f"Fill in {', '.join(missing)} in {path} first (copy env.example to env).")
    return env


def cli(*args, stdin=None):
    r = subprocess.run(["databricks", *args], input=stdin, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"databricks {' '.join(args[:3])} failed: {r.stderr.strip()}")
    return r.stdout


def put_secrets(env):
    scopes = json.loads(cli("secrets", "list-scopes", "-o", "json") or "[]")
    if SCOPE not in {s["name"] for s in scopes}:
        cli("secrets", "create-scope", SCOPE)
        print(f"created secret scope {SCOPE}")
    for key, var in KEYS.items():
        cli("secrets", "put-secret", SCOPE, key, stdin=env[var])  # value read from stdin
        print(f"stored secret {SCOPE}/{key}")


def pick_warehouse(given):
    if given:
        return given
    whs = json.loads(cli("warehouses", "list", "-o", "json"))
    if not whs:
        sys.exit("No SQL warehouse found; pass --warehouse-id.")
    return whs[0]["id"]


def run_sql(warehouse_id, statement):
    body = {"warehouse_id": warehouse_id, "statement": statement, "wait_timeout": "50s",
            "on_wait_timeout": "CONTINUE"}
    resp = json.loads(cli("api", "post", "/api/2.0/sql/statements", "--json", json.dumps(body)))
    sid, state = resp["statement_id"], resp["status"]["state"]
    while state in ("PENDING", "RUNNING"):
        resp = json.loads(cli("api", "get", f"/api/2.0/sql/statements/{sid}"))
        state = resp["status"]["state"]
    if state != "SUCCEEDED":
        raise RuntimeError(f"{statement.splitlines()[0]} -> {state}: {resp['status'].get('error')}")


def statements(sql):
    """Split a SQL file on ';' after dropping full-line '--' comments (they may contain ';')."""
    code = "\n".join(l for l in sql.splitlines() if not l.strip().startswith("--"))
    return [st.strip() for st in code.split(";") if st.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--warehouse-id")
    ap.add_argument("--skip-secrets", action="store_true")
    a = ap.parse_args()

    env_file = next((p for p in (ROOT / "env", ROOT / ".env") if p.exists()), None)
    if env_file is None:
        sys.exit("No env or .env file at the repo root. Copy env.example to .env and fill it in.")
    env = read_env(env_file)
    if not a.skip_secrets:
        put_secrets(env)

    sql = (ROOT / "databricks" / "sql" / "setup.sql").read_text()
    sql = sql.replace("${pg_host}", env["POSTGRES_HOST"]).replace("${pg_port}", env["POSTGRES_PORT"])
    sql = sql.replace("${pg_db}", env["POSTGRES_DB"])
    wh = pick_warehouse(a.warehouse_id)
    sql += ";\n" + (ROOT / "databricks" / "sql" / "type_labels_seed.sql").read_text()
    for body in statements(sql):
        run_sql(wh, body)
        print("ok:", body.splitlines()[0])
    print("Done. Check with: SHOW TABLES IN bbb_app.public")


if __name__ == "__main__":
    main()
