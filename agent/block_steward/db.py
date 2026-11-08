"""Read-only Postgres access. SELECT only, parameterised; the agent never writes here."""
from __future__ import annotations

from datetime import timedelta

import psycopg
from psycopg.rows import dict_row


def connect(settings):
    # sslmode=require encrypts without verifying the server certificate (team's choice).
    conn = psycopg.connect(
        host=settings.postgres_host, port=settings.postgres_port,
        dbname=settings.postgres_db, user=settings.postgres_user,
        password=settings.postgres_password, sslmode=settings.postgres_sslmode,
        row_factory=dict_row, connect_timeout=15)
    conn.read_only = True
    return conn


def _rows(conn, sql, params=()):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def help_hotspots(conn, areas=None):
    sql = ("SELECT h3_r9, request_type, category, local_area, times_reported, "
           "months_seen, last_reported FROM gold_help_hotspots")
    if areas:
        return _rows(conn, sql + " WHERE local_area = ANY(%s) ORDER BY local_area, times_reported DESC",
                     (list(areas),))
    return _rows(conn, sql + " ORDER BY local_area, times_reported DESC")


def upcoming_events(conn, today, days=14):
    # One-day buffer each side; the pure logic does the exact Vancouver-date filtering.
    return _rows(
        conn,
        "SELECT id, h3_r9, category, done_at, kind, title, organiser, org_id, starts_at, "
        "ends_at, location, local_area, latitude, longitude FROM events "
        "WHERE starts_at >= %s AND starts_at < %s ORDER BY starts_at",
        (today - timedelta(days=1), today + timedelta(days=days + 2)))


def orgs(conn):
    return _rows(conn, "SELECT id, name, kind, address, local_area, latitude, longitude, "
                       "website FROM orgs")


def area_summaries(conn, areas=None):
    """Latest gold_area_summaries row per area."""
    sql = ("SELECT DISTINCT ON (local_area) local_area, generated_on, summary "
           "FROM gold_area_summaries ")
    if areas:
        return _rows(conn, sql + "WHERE local_area = ANY(%s) ORDER BY local_area, generated_on DESC",
                     (list(areas),))
    return _rows(conn, sql + "ORDER BY local_area, generated_on DESC")


def top_track2(conn, area, n=5):
    return _rows(
        conn,
        "SELECT issue_id, h3_r9, request_type, category, local_area, address, open_cases, "
        "days_open, times_reported_12m, base_score FROM gold_track2_issues "
        "WHERE local_area = %s ORDER BY base_score DESC NULLS LAST LIMIT %s",
        (area, n))
