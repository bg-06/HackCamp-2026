# Dashboard setup: Block by Block: Vancouver 311

1. In Databricks, open **Dashboards**, then **Create dashboard**. Name it `Block by Block: Vancouver 311`.
2. Open the **Data** tab. For each query in `databricks/dashboards/queries.sql`, click **Create from SQL**, paste the query (without the comment), and rename the dataset to the comment's title.
3. Open the **Canvas** tab and add one visualization per dataset, using the chart type in the comment:
   - Query 1: bar chart (x `local_area`, y `hotspots`).
   - Query 2: table.
   - Query 3: line chart (x `week`, y `cases`, colour by `track`).
   - Query 4: bar chart (x `category`, y `median_days`).
   - Query 5: point map (latitude, longitude, colour by `track`).
   - Query 6: table.
4. Use one fixed colour for `neighbours` and another for `city` in every chart, the same as the app.
5. Click **Publish**.

Note: queries 1, 3, 4 and 5 filter relative to today's date. If the data does not reach the present (for example while the Postgres load is partial), those charts will be empty until fresh data arrives.
