# Tutorial

This tutorial walks through building a dashboard with the Host Overview Panel
step by step, starting from a basic Prometheus setup and progressively adding
features.

Each page builds on the previous one, so it's best to follow them in order.

## Prerequisites

-   Grafana 12.0 or later.
-   A Prometheus data source with node exporter and cadvisor metrics
    (or [Alloy's](https://grafana.com/docs/alloy/latest/)
    unix and cadvisor integrations).

!!! Tip

    You can use provisioned Grafana environment from this plugin's [repo]
    to set up all data sources and explore demo dashboards:

    1.  Clone this repo:

            git clone https://github.com/taminomara/grafana-host-overview-panel.git
            cd grafana-host-overview-panel

    2.  Install NPM dependencies:

            npm install

    3.  Build plugin:

            npm run build

    4.  Start Grafana, Prometheus, and sidecar containers:

            docker compose up -d

    5.  Give Grafana a few minutes to initialize and provision all dashboards.

    6.  Navigate to [http://localhost:3000/dashboards] and explore example dashboards.

    7.  Login to grafana under username `admin`, password `admin` to change
        default theme.

## Pages

1. [**Basic setup**](basic-setup.md) — create a panel, add a query, configure
   resource ID, status, and grouping.
2. [**Adding more data**](joins.md) — join CPU and memory metrics from other
   queries into resource tooltips.
3. [**Displaying thresholds in cells**](cell-color-overrides.md) — use
   thresholds to highlight cells when metrics exceed limits.
4. [**Marking cells as sidecars**](sidecars.md) — visually distinguish
   auxiliary resources like monitoring agents.
5. [**Adding known IDs**](adding-known-ids.md) — show placeholder cells for
   missing resources.
6. [**Adding data to host groups**](joins-groups.md) — attach host-level
   metrics to group headers.
7. [**Adding data links**](data-links.md) — navigate from groups and cells
   to detailed dashboards.
8. [**Sorting**](sorting.md) — control sort order for resources and groups,
   including custom regex-based sorting.

[repo]: https://github.com/taminomara/grafana-host-overview-panel
[http://localhost:3000/dashboards]: http://localhost:3000/dashboards
