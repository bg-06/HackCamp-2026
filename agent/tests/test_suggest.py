import json
import re
from datetime import date, datetime, timedelta, timezone

import h3

from block_steward.suggest import suggest
from block_steward.wording import plain_words

TODAY = date(2026, 11, 8)
CELL_A = h3.latlng_to_cell(49.263, -123.100, 9)
CELL_B = h3.latlng_to_cell(49.265, -123.105, 9)
DUMP = "Abandoned Non-Recyclables-Small Case"
TAG = "Graffiti Removal - City Property Case"


def hs(cell=CELL_A, rt=DUMP, cat="Garbage and Dumping", area="Mount Pleasant",
       n=9, months=6, last=None):
    return {
        "h3_r9": cell, "request_type": rt, "category": cat, "local_area": area,
        "times_reported": n, "months_seen": months,
        "last_reported": last or datetime(2026, 11, 5, 17, 0, tzinfo=timezone.utc),
    }


def ev(cell=CELL_A, days=3, done=None, hour=15):
    start = datetime.combine(TODAY + timedelta(days=days), datetime.min.time(),
                             tzinfo=timezone.utc).replace(hour=hour)
    return {"h3_r9": cell, "done_at": done, "starts_at": start}


def org(oid, lat, lng):
    return {"id": oid, "name": f"Org {oid}", "latitude": lat, "longitude": lng}


def test_uncovered_hotspot_is_suggested():
    assert len(suggest([hs()], [], [], TODAY)) == 1


def test_event_inside_window_covers():
    assert suggest([hs()], [ev(days=3)], [], TODAY) == []
    assert suggest([hs()], [ev(days=0)], [], TODAY) == []
    assert suggest([hs()], [ev(days=14)], [], TODAY) == []


def test_event_outside_window_does_not_cover():
    assert len(suggest([hs()], [ev(days=15)], [], TODAY)) == 1
    assert len(suggest([hs()], [ev(days=-1)], [], TODAY)) == 1


def test_done_event_ignored():
    done = datetime(2026, 11, 9, tzinfo=timezone.utc)
    assert len(suggest([hs()], [ev(days=3, done=done)], [], TODAY)) == 1


def test_event_on_different_cell_ignored():
    assert len(suggest([hs()], [ev(cell=CELL_B, days=3)], [], TODAY)) == 1


def test_window_days_option():
    assert len(suggest([hs()], [ev(days=10)], [], TODAY, window_days=7)) == 1


def test_ranking_and_max_per_area():
    cells = [h3.latlng_to_cell(49.26 + i * 0.003, -123.1, 9) for i in range(5)]
    hots = [
        hs(cell=cells[0], n=5, months=4),
        hs(cell=cells[1], n=9, months=3),
        hs(cell=cells[2], n=9, months=6),
        hs(cell=cells[3], n=5, months=4,
           last=datetime(2026, 11, 7, tzinfo=timezone.utc)),
        hs(cell=cells[4], n=2, months=3),
    ]
    out = suggest(hots, [], [], TODAY)
    assert [p["hotspot"]["h3_r9"] for p in out] == [cells[2], cells[1], cells[3]]
    out5 = suggest(hots, [], [], TODAY, max_per_area=5)
    assert [p["hotspot"]["h3_r9"] for p in out5] == [
        cells[2], cells[1], cells[3], cells[0], cells[4]]


def test_max_per_area_is_per_area():
    hots = [hs(area="Kitsilano", cell=CELL_A), hs(area="Fairview", cell=CELL_B)]
    assert len(suggest(hots, [], [], TODAY, max_per_area=1)) == 2


def test_area_filter():
    hots = [hs(area="Kitsilano", cell=CELL_A), hs(area="Fairview", cell=CELL_B)]
    out = suggest(hots, [], [], TODAY, areas=["Fairview"])
    assert [p["local_area"] for p in out] == ["Fairview"]


def test_null_local_area_skipped():
    assert suggest([hs(area=None)], [], [], TODAY) == []


def test_nearest_orgs_within_2km_sorted_and_capped():
    lat, lng = h3.cell_to_latlng(CELL_A)
    orgs = [
        org(1, lat + 0.010, lng),   # about 1.1 km
        org(2, lat + 0.002, lng),   # about 0.2 km
        org(3, lat + 0.005, lng),   # about 0.6 km
        org(4, lat + 0.008, lng),   # about 0.9 km
        org(5, lat + 0.030, lng),   # about 3.3 km, too far
        {"id": 6, "name": "No coords", "latitude": None, "longitude": None},
    ]
    assert suggest([hs()], [], orgs, TODAY)[0]["org_ids"] == [2, 3, 4]
    out = suggest([hs()], [], orgs, TODAY, max_orgs=10)
    assert out[0]["org_ids"] == [2, 3, 4, 1]


def test_no_orgs_gives_empty_list():
    assert suggest([hs()], [], [], TODAY)[0]["org_ids"] == []


def test_program_for_dumping_and_litter():
    p = suggest([hs()], [], [], TODAY)[0]
    assert p["city_program"] == {
        "name": "City Neighbourhood Cleanup Programs (Cleanup Party, Adopt a Block)",
        "url": "https://app.betterimpact.com/PublicOrganization/c6e38574-b5fa-4920-9679-a5ec7c8dd23c/3",
    }
    assert "The City lends cleanup supplies through its Cleanup Party program." in p["body"]
    assert p["event_draft"]["what_to_bring"] == "Gloves, grabbers and bags"
    lit = suggest([hs(rt="Loose Litter Clean Up Case")], [], [], TODAY)[0]
    assert lit["city_program"] is not None


def test_graffiti_has_no_program():
    p = suggest([hs(rt=TAG, cat="Graffiti")], [], [], TODAY)[0]
    assert p["city_program"] is None
    assert p["event_draft"]["what_to_bring"] == \
        "Gloves and a phone to report new tags in Van311"
    assert "Van311" in p["body"]
    assert "Cleanup Party" not in p["body"]


def test_plain_words_mapping():
    assert plain_words("Abandoned Non-Recyclables-Small Case") == "small abandoned items"
    assert plain_words("Abandoned Recyclables Case") == "abandoned recyclables"
    assert plain_words("Street Cleaning and Debris Pick Up Case") == "street debris"
    assert plain_words("Loose Litter Clean Up Case") == "loose litter"
    assert plain_words("Graffiti Removal - City Property Case") == "graffiti on City property"
    assert plain_words("Graffiti Removal - Park Property Case") == "graffiti in parks"
    assert plain_words("Some New Thing Case") == "some new thing"


def test_payload_contract_keys_and_values():
    p = suggest([hs()], [], [], TODAY)[0]
    assert set(p) == {"kind", "author", "local_area", "org_ids", "title", "body",
                      "hotspot", "event_draft", "city_program", "dedupe_key"}
    assert p["kind"] == "suggestion"
    assert p["author"] == "block-steward-agent"
    assert p["local_area"] == "Mount Pleasant"
    assert p["title"] == "Host a cleanup for small abandoned items in Mount Pleasant?"
    assert set(p["hotspot"]) == {"h3_r9", "request_type", "category",
                                 "times_reported", "months_seen", "last_reported"}
    assert p["hotspot"]["last_reported"].startswith("2026-11-05T")
    assert p["hotspot"]["last_reported"].endswith("-07:00")
    d = p["event_draft"]
    assert set(d) == {"kind", "title", "category", "local_area", "latitude",
                      "longitude", "hotspot_id", "what_to_bring", "signup_url"}
    assert d["kind"] == "hotspot"
    assert d["hotspot_id"] == f"{CELL_A}|{DUMP}"
    assert d["signup_url"] is None
    lat, lng = h3.cell_to_latlng(CELL_A)
    assert (d["latitude"], d["longitude"]) == (lat, lng)
    json.dumps(p)


def test_dedupe_key_format():
    p = suggest([hs()], [], [], TODAY)[0]
    assert p["dedupe_key"] == f"suggestion:{CELL_A}:{DUMP}:2026-W45"


def test_dedupe_key_is_stable_within_iso_week_and_changes_next_week():
    mon = suggest([hs()], [], [], date(2026, 11, 2))[0]["dedupe_key"]
    sun = suggest([hs()], [], [], date(2026, 11, 8))[0]["dedupe_key"]
    nxt = suggest([hs()], [], [], date(2026, 11, 9))[0]["dedupe_key"]
    assert mon == sun and nxt.endswith(":2026-W46")


def test_last_reported_gets_vancouver_offset():
    naive = suggest([hs(last=datetime(2026, 11, 5, 10, 0))], [], [], TODAY)[0]
    assert naive["hotspot"]["last_reported"] == "2026-11-05T10:00:00-07:00"
    aware = suggest([hs(last=datetime(2026, 7, 5, 17, 0, tzinfo=timezone.utc))], [], [], TODAY)[0]
    assert aware["hotspot"]["last_reported"] == "2026-07-05T10:00:00-07:00"


def _free_event(days=3, area="Mount Pleasant", cat="Garbage and Dumping", **kw):
    e = ev(cell=None, days=days)
    e.update({"local_area": area, "category": cat, "latitude": None, "longitude": None})
    e.update(kw)
    return e


def test_event_covers_via_lat_lng_when_no_h3():
    lat, lng = h3.cell_to_latlng(CELL_A)
    assert suggest([hs()], [_free_event(area="Elsewhere", latitude=lat, longitude=lng)], [], TODAY) == []
    lat2, lng2 = h3.cell_to_latlng(CELL_B)
    assert len(suggest([hs()], [_free_event(area="Elsewhere", latitude=lat2, longitude=lng2)], [], TODAY)) == 1


def test_event_with_h3_set_ignores_area_category_fallback():
    e = _free_event()
    e["h3_r9"] = CELL_B
    assert len(suggest([hs()], [e], [], TODAY)) == 1


def test_event_with_one_coordinate_only_falls_to_area_category():
    assert suggest([hs()], [_free_event(latitude=49.26)], [], TODAY) == []


def test_event_same_area_and_category_covers():
    assert suggest([hs()], [_free_event()], [], TODAY) == []


def test_area_category_fallback_respects_window_and_done():
    assert len(suggest([hs()], [_free_event(days=20)], [], TODAY)) == 1
    done = datetime(2026, 11, 9, tzinfo=timezone.utc)
    assert len(suggest([hs()], [_free_event(done_at=done)], [], TODAY)) == 1


def test_area_category_fallback_needs_same_category_and_area():
    assert len(suggest([hs()], [_free_event(cat="Graffiti")], [], TODAY)) == 1
    assert len(suggest([hs()], [_free_event(area="Strathcona")], [], TODAY)) == 1


def test_body_plain_text_and_data_numbers_only():
    body = suggest([hs()], [], [], TODAY)[0]["body"]
    assert not re.search(r"<[^>]+>|^#", body, re.M)
    assert "9 times over 6 months" in body
    assert "Nov 5" in body
    assert "Mount Pleasant" in body
    assert "No neighbour event is planned at this spot in the next two weeks." in body
    assert set(re.findall(r"\d+", body)) <= {"9", "6", "5"}
    assert 2 <= len(re.findall(r"[.?!](?:\s|$)", body)) <= 4


def test_window_uses_vancouver_time_not_utc():
    # 02:00 UTC on day 15 is the evening of day 14 in Vancouver: covered.
    assert suggest([hs()], [ev(days=15, hour=2)], [], TODAY) == []
    # 02:00 UTC on day 0 is yesterday evening in Vancouver: not covered.
    assert len(suggest([hs()], [ev(days=0, hour=2)], [], TODAY)) == 1


def test_naive_event_time_treated_as_local():
    e = {"h3_r9": CELL_A, "done_at": None,
         "starts_at": datetime(2026, 11, 22, 19, 0)}  # day 14, 7pm local
    assert suggest([hs()], [e], [], TODAY) == []


def test_last_reported_date_shown_in_vancouver_time():
    last = datetime(2026, 11, 6, 3, 0, tzinfo=timezone.utc)  # Nov 5, 7pm Vancouver
    assert "most recently on Nov 5." in suggest([hs(last=last)], [], [], TODAY)[0]["body"]


def test_graffiti_title_is_category_appropriate():
    p = suggest([hs(rt=TAG, cat="Graffiti")], [], [], TODAY)[0]
    assert p["title"] == "Organise a graffiti walk in Mount Pleasant?"
    assert p["event_draft"]["title"] == "Graffiti walk in Mount Pleasant"


def test_titles_use_plain_words_and_differ_per_type():
    a = suggest([hs()], [], [], TODAY)[0]
    b = suggest([hs(rt="Loose Litter Clean Up Case")], [], [], TODAY)[0]
    assert a["title"] != b["title"]
    assert a["event_draft"]["title"] == "Cleanup: small abandoned items in Mount Pleasant"
    assert b["title"] == "Host a cleanup for loose litter in Mount Pleasant?"


def test_verb_agreement_per_phrase():
    for rt, start in [
        ("Street Cleaning and Debris Pick Up Case", "Street debris has been reported"),
        ("Loose Litter Clean Up Case", "Loose litter has been reported"),
        ("Graffiti Removal - Park Property Case", "Graffiti in parks has been reported"),
        ("Abandoned Non-Recyclables-Small Case", "Small abandoned items have been reported"),
        ("Abandoned Recyclables Case", "Abandoned recyclables have been reported"),
    ]:
        assert suggest([hs(rt=rt)], [], [], TODAY)[0]["body"].startswith(start), rt


def test_unit_pluralisation():
    body = suggest([hs(n=1, months=1)], [], [], TODAY)[0]["body"]
    assert "1 time over 1 month " in body
    body = suggest([hs(n=3, months=2)], [], [], TODAY)[0]["body"]
    assert "3 times over 2 months " in body
