-- DEV ONLY: a few fake gold rows so the app has something to show before Databricks publishes.
-- Each INSERT only runs if that table is empty. The first real publish_gold run replaces them
-- (it TRUNCATEs each gold_* table before copying).
-- H3 cells are real res-9 cells in each area.

INSERT INTO gold_track2_issues (issue_id, h3_r9, request_type, category, local_area, address,
                                open_cases, days_open, times_reported_12m, base_score)
SELECT * FROM (VALUES
  ('fixture-issue-1', '8928de8d107ffff', 'Pothole Case',                          'Roads and Sidewalks',  'Mount Pleasant',     'Main St and E 7th Ave',      3, 41, 12, 16.1),
  ('fixture-issue-2', '8928de8dec3ffff', 'Street Light Out Case',                 'Lighting and Signals', 'Strathcona',         'E Hastings St and Hawks Ave', 1, 18,  4,  5.8),
  ('fixture-issue-3', '8928de8ce4fffff', 'Sidewalk Repair Case',                  'Roads and Sidewalks',  'Kitsilano',          'W 4th Ave and Vine St',      2, 75,  6, 13.5),
  ('fixture-issue-4', '8928de8d313ffff', 'Catch Basin Maintenance Case',          'Water and Sewer',      'Grandview-Woodland', 'Commercial Dr and E 1st Ave', 1,  9,  3,  3.9)
) AS v(issue_id, h3_r9, request_type, category, local_area, address, open_cases, days_open, times_reported_12m, base_score)
WHERE NOT EXISTS (SELECT 1 FROM gold_track2_issues);

INSERT INTO gold_help_hotspots (h3_r9, request_type, category, local_area, times_reported, months_seen, last_reported)
SELECT * FROM (VALUES
  ('8928de8d107ffff', 'Abandoned Non-Recyclables-Small Case',  'Garbage and Dumping', 'Mount Pleasant',     9, 6, TIMESTAMP '2026-11-02 09:15:00'),
  ('8928de8dec3ffff', 'Graffiti Removal - City Property Case', 'Graffiti',            'Strathcona',        14, 8, TIMESTAMP '2026-11-05 13:40:00'),
  ('8928de8d313ffff', 'Street Cleaning and Debris Pick Up Case', 'Garbage and Dumping', 'Grandview-Woodland', 7, 4, TIMESTAMP '2026-10-29 16:05:00')
) AS v(h3_r9, request_type, category, local_area, times_reported, months_seen, last_reported)
WHERE NOT EXISTS (SELECT 1 FROM gold_help_hotspots);

INSERT INTO gold_hotspots_h3 (h3_r9, track, category, open_count)
SELECT * FROM (VALUES
  ('8928de8d107ffff', 'neighbours', 'Garbage and Dumping', 5),
  ('8928de8d107ffff', 'city',       'Roads and Sidewalks', 3),
  ('8928de8dec3ffff', 'neighbours', 'Graffiti',            8),
  ('8928de8dec3ffff', 'city',       'Lighting and Signals', 1),
  ('8928de8ce4fffff', 'city',       'Roads and Sidewalks', 2),
  ('8928de8d313ffff', 'neighbours', 'Garbage and Dumping', 4),
  ('8928de8d313ffff', 'city',       'Water and Sewer',     1)
) AS v(h3_r9, track, category, open_count)
WHERE NOT EXISTS (SELECT 1 FROM gold_hotspots_h3);

INSERT INTO gold_area_summaries (local_area, generated_on, summary)
SELECT * FROM (VALUES
  ('Mount Pleasant', DATE '2026-11-09', 'Dumping near Main and 7th keeps coming back, so a cleanup there would help most. The most pressing City issue is a cluster of potholes on Main. The City closed most reports within 3 days this week.'),
  ('Strathcona',     DATE '2026-11-09', 'Graffiti on City property along Hastings is the most reported problem neighbours could help with. A street light has been out for over two weeks. Most other reports were closed within a few days.')
) AS v(local_area, generated_on, summary)
WHERE NOT EXISTS (SELECT 1 FROM gold_area_summaries);
