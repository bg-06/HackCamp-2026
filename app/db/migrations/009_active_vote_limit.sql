-- Preserve the two most recently cast active votes for accounts that accumulated
-- more than two under the old daily allowance. Historical cast records remain.
WITH ranked AS (
  SELECT v.ctid, row_number() OVER (PARTITION BY v.user_id ORDER BY v.created_at DESC, v.issue_id) AS position
  FROM votes v JOIN gold_track2_issues i ON i.issue_id = v.issue_id
  WHERE v.user_id IS NOT NULL AND v.value = 1
)
DELETE FROM votes WHERE ctid IN (SELECT ctid FROM ranked WHERE position > 2);
