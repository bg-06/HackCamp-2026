"""Pull a sample of Vancouver 311 data so we know its shape.

Writes to data/sample/ (committed):
  311_recent.jsonl   every record modified in the last N days (same query shape as the Databricks ingest task)
  schema.json        field names and types from the dataset catalog
  profile.json       value counts for categorical fields and null rates over the full dataset

With --full it also downloads the complete parquet export to data/raw/ (gitignored, ~1.3M rows).

Stdlib only:  python scripts/pull_311_sample.py [--days 7] [--full]
"""
import argparse
import datetime as dt
import json
import pathlib
import urllib.parse
import urllib.request

DATASET = "3-1-1-service-requests"
BASE = f"https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/{DATASET}"
ROOT = pathlib.Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "data" / "sample"
RAW = ROOT / "data" / "raw"

CATEGORICAL = ["department", "service_request_type", "status", "closure_reason", "local_area", "channel"]
NULLABLE = ["address", "local_area", "latitude", "longitude", "service_request_close_date", "closure_reason"]


def get(url, params=None):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=300) as r:
        return r.read()


def get_json(url, params=None):
    return json.loads(get(url, params))


def value_counts(field):
    rows = get_json(f"{BASE}/records", {
        "select": f"{field}, count(*) as n", "group_by": field, "order_by": "n desc", "limit": 1000,
    })["results"]
    return {str(r[field]): r["n"] for r in rows}


def count(where=None):
    params = {"limit": 0}
    if where:
        params["where"] = where
    return get_json(f"{BASE}/records", params)["total_count"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--full", action="store_true", help="also download the full parquet export")
    args = ap.parse_args()
    SAMPLE.mkdir(parents=True, exist_ok=True)

    meta = get_json(BASE)
    schema = {
        "dataset": DATASET,
        "records_count": meta["metas"]["default"].get("records_count"),
        "data_processed": meta["metas"]["default"].get("data_processed"),
        "fields": [{"name": f["name"], "type": f["type"], "label": f.get("label")} for f in meta["fields"]],
    }
    (SAMPLE / "schema.json").write_text(json.dumps(schema, indent=2))
    print(f"schema: {len(schema['fields'])} fields, {schema['records_count']} records")

    since = (dt.date.today() - dt.timedelta(days=args.days)).isoformat()
    records = get_json(f"{BASE}/exports/json", {"where": f"last_modified_timestamp >= date'{since}'"})
    with open(SAMPLE / "311_recent.jsonl", "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"recent: {len(records)} records modified since {since}")

    total = count()
    profile = {
        "total": total,
        "opened_range": {
            "min": get_json(f"{BASE}/records", {"select": "min(service_request_open_timestamp) as v"})["results"][0]["v"],
            "max": get_json(f"{BASE}/records", {"select": "max(service_request_open_timestamp) as v"})["results"][0]["v"],
        },
        "null_rate": {fld: round(count(f"{fld} is null") / total, 4) for fld in NULLABLE},
        "value_counts": {fld: value_counts(fld) for fld in CATEGORICAL},
    }
    (SAMPLE / "profile.json").write_text(json.dumps(profile, indent=2, ensure_ascii=False))
    print("profile: " + ", ".join(f"{k}={len(v)} distinct" for k, v in profile["value_counts"].items()))

    if args.full:
        RAW.mkdir(parents=True, exist_ok=True)
        out = RAW / f"{DATASET}.parquet"
        print(f"downloading full parquet to {out} ...")
        out.write_bytes(get(f"{BASE}/exports/parquet"))
        print(f"full: {out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
