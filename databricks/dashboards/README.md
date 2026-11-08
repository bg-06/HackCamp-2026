# Dashboard: GreenHands BC: Vancouver 311

The dashboard is code. `block_by_block.lvdash.json` is deployed and published by the bundle
(`resources.dashboards.block_by_block` in `databricks/databricks.yml`, on the `warehouse_id` variable):

    cd databricks && databricks bundle deploy

It has a title and six charts, one per query in `queries.sql`: bar (hotspots by area), table (City-only issues),
line (cases per week by track), bar (median days to close by category), point map (open issues by track), table (AI sorting).
Tracks use fixed colours from the app: `neighbours` green `#2f7a2a`, `city` maple red `#9b2f26`.

## Editing it

1. Edit the deployed dashboard in the Databricks UI (Dashboards), or edit the JSON file directly.
2. To pull UI changes back into the repo, from the `databricks/` folder:
   `databricks bundle generate dashboard --resource block_by_block --dashboard-dir dashboards --force`
   This overwrites `./dashboards/block_by_block.lvdash.json` with the deployed dashboard. Add `--watch` to keep
   syncing while you edit in the UI. Then commit the `.lvdash.json`. (Or copy the JSON from the dashboard's **File > Export**.)
3. Deploy again. Keep `queries.sql` in sync with the dataset queries.

Note: queries 3, 4 and 5 filter relative to today's date (last 12 months or 90 days). The data is refreshed daily up to about yesterday, so they return rows; if the data stops updating, those charts thin out and eventually go empty.
