# Host Overview Panel

A Grafana panel plugin for visualizing the status of fleets of resources — servers, database instances, containers, or any entity with a status field and optional metrics.

![Screenshot with preview of a service overview dashboard](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/service.png)

![Screenshot with preview of a data center overview dashboard](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/dc.png)

![Screenshot with preview of a database overview dashboard](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/db.png)

## Features

- **Modern design for Grafana 12** — panel uses built-in theme-ready components.
- **Flexible grouping** — nest resources by any combination of fields, with configurable sort order, coloring, and layout.
- **Multiple display modes** — simple colored cells, cells with text labels, or rich table cards showing multiple fields per resource.
- **Joins** — attach metrics from other data frames to groups or individual resources via key-based joins.
- **Field visualizations** — text, colored text, colored background, gauges, and sparklines for joined or inline fields.
- **Color overrides** — fields and joins can override cell colors based on threshold severity.
- **Data links support** — defined data links for any group, resource, or metric.
- **Tooltips** — hoverable tooltips with configurable title, fields, and joined data.

## Requirements

- Grafana 12.0 or later.

## Data format

Host Overview Panel requires data in long format. That is, a table with
a column for resource ID and metrics.

![Screenshot with a data table showing columns "service", "node", "process", "status"](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/data_example.png)

In most use-cases, the ["Time series to table"] transformation with will do the job.

["Time series to table"]: https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/transform-data/#time-series-to-table-transform

## Quickstart (Prometheus)

> **Note**
>
> You can get example dashboard JSON [at GitHub](https://github.com/taminomara/grafana-host-overview-panel/blob/main/provisioning/dashboards/prom.json).

### Basic setup

Let's build a dashboard that would show status of all Prometheus scraping targets.

1.  Create a panel with visualization type "Host Overview".

2.  Select your Prometheus data source, select metric "up". Select query type "Instant".

    ![Screenshot of Prometheus query](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/quickstart-1.png)

3.  Add data transformations.

    First is "Time series to table".

    Second is "Extract fields" with source "instance", format "RegExp", and regular expression `/(?<host>[^:]*)(?::(?<port>\d+))?/`.

    ![Screenshot of data transformations](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/quickstart-2.png)

4.  In visualization settings, add grouping by host (**Grouping and layout** > **Resource groups**).

    ![Screenshot of grouping settings](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/quickstart-3.png)

5.  In **Resource** > **ID field**, select "job".

    ![Screenshot of ID field](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/quickstart-4.png)

6.  In **Resource content**, set **Status field** to "up", **Resource display mode** to "Cell with text", **Cell size** to "30".

    ![Screenshot of resource content settings](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/quickstart-5.png)

7.  Add a **field override**, type "Fields with name", select field "up". Override **Value mappings** and **Display name**.

    ![Screenshot of field override](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/quickstart-6.png)

### Adding group metrics

Let's add CPU and Memory metrics to hosts from the previous dashboard.

1.  Add two other queries for CPU and Memory. If you're using node exporter
    or Alloy's unix integration, queries will be:

    CPU:

    ```promql
    100 * (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval])))
    ```

    Memory:

    ```promql
    clamp_min((1 - (node_memory_MemAvailable_bytes / on (instance) node_memory_MemTotal_bytes)) * 100, 0)
    ```

    Set type "instant" if you plan to display them as gauges
    (we will use sparklines in this example).

    ![Screenshot of CPU and Memory queries](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/advanced-1.png)

2.  In visualization settings, select data frame with metric "up" as primary (in **Host Overview** > **Data frame**).

    ![Screenshot of data frame settings](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/advanced-2.png)

3.  Go to settings of group "host" and add joins for CPU and Memory. Join by field "host".

    ![Screenshot of group settings](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/advanced-3.png)

    ![Screenshot of adding a join](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/advanced-4.png)

    ![Screenshot of join settings](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/advanced-5.png)

4.  Add a **field override** for CPU and Memory. Override "Unit", "Min", "Max", "Display name",
    and optionally "Thresholds". If you want to display metric as a gauge, add override
    for "Display mode" as well.

    ![Screenshot of field overrides for CPU](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/advanced-6.png)

### Overriding group's border color from thresholds

You can highlight border around a group if one of group's metrics goes beyond
its threshold.

> **Warning**
>
> Border overrides only work with thresholds, they ignore value mappings.

![Screenshot of group with CPU metric over a threshold](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/borders-2.png)

1.  Go to group settings and enable **Overrides border color** for every join.

    ![Screenshot of border overrides for join on CPU](https://raw.githubusercontent.com/taminomara/grafana-host-overview-panel/refs/heads/main/src/img/screenshots/borders-1.png)

### Adding data links for resources

If you have a dashboard for detailed host state, you can link it from host groups.

1.  Add a **field override** for field "host", add a data link.

    The exact data link contents will depend on what dashboard you use, for example
    it can be this:

    ```
    /d/lQ3U-gWZk/?var-instance=${__data.fields.instance}&${__url_time_range}
    ```

    See grafana documentation for [reference on template variables].

[reference on template variables]: https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/configure-data-links/
