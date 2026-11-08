"""Read-only look at our Postgres: tables, row counts, key columns, applied migrations.

    pip install "psycopg[binary]"
    python docs/next-steps/check_db.py

Reads the connection from the repo-root `env` file (or `.env`). Never prints the password.
Only runs SELECTs.
"""
import pathlib
import sys

import psycopg

ROOT = pathlib.Path(__file__).resolve().parents[2]
env_file = next((p for p in (ROOT / "env", ROOT / ".env") if p.exists()), None)
if env_file is None:
    sys.exit("No env or .env file at the repo root. Copy env.example to env and fill it in.")
env = {}
for line in env_file.read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

with psycopg.connect(
    host=env["POSTGRES_HOST"], port=env["POSTGRES_PORT"], dbname=env["POSTGRES_DB"],
    user=env["POSTGRES_USER"], password=env["POSTGRES_PASSWORD"],
    sslmode=env.get("POSTGRES_SSLMODE", "require"), connect_timeout=15,
) as conn:
    conn.read_only = True
    tables = [r[0] for r in conn.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1")]
    print(f"{len(tables)} tables:")
    for t in tables:
        n = conn.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]
        cols = [r[0] for r in conn.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = %s ORDER BY ordinal_position", (t,))]
        print(f"  {t:<22} {n:>9} rows   {', '.join(cols)}")
    if "schema_migrations" in tables:
        print("applied migrations:", [r[0] for r in conn.execute("SELECT filename FROM schema_migrations ORDER BY 1")])
    else:
        print("applied migrations: (no schema_migrations table yet)")
    if "ingest_state" in tables:
        print("ingest_state:")
        for r in conn.execute("SELECT dataset_id, last_started_at, last_succeeded_at, last_error FROM ingest_state ORDER BY 1"):
            print("  ", r)
