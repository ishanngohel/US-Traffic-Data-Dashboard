# U.S. Traffic Accidents — Interactive Dashboard

An interactive dashboard exploring ~100,000 U.S. traffic accidents, built in Python with
**Panel**, **hvPlot/HoloViews**, **Plotly**, and **Matplotlib/Seaborn**. Users can filter by
accident severity, state, and year range and watch every chart update reactively.

Group final project for **DSCI 454 (Data Visualization & User Interface Design)**, USC.
Team: Fatima, Hari, Ishan Gohel, and Zayanna. *Ishan led the data cleaning and preparation.*

---

## Overview

The dashboard turns a 100k-row sample of the U.S. Accidents dataset into an explorable tool that
reveals when, where, and under what conditions accidents cluster. A sidebar of filters
(severity, state, year range) drives a reactive layout of six coordinated views.

## Features

- **KPI summary** — headline counts that update with the active filters.
- **Accident location map** — a Plotly scatter-mapbox of up to 20k sampled accidents, colored by
  severity (green → red) over a dark base map.
- **Yearly trend** — accidents per year as an interactive line chart.
- **Day vs. night severity** — a KDE comparing severity distributions by `Sunrise_Sunset`.
- **Top weather conditions** — the 10 most common weather conditions among accidents.
- **Time-of-week heatmap** — an hvPlot day-by-hour heatmap showing when accidents concentrate.

All views are wired to the same filter widgets through Panel's reactive callbacks, so changing a
filter updates the entire dashboard at once.

## Data

- **Source:** [US Accidents dataset](https://www.kaggle.com/datasets/sobhanmoosavi/us-accidents)
  (Moosavi et al.), sampled to ~100,000 rows for responsiveness.
- The notebook loads a gzipped sample directly from a hosted URL, so no manual download is needed.

## Data preparation (Ishan's focus)

- Dropped records missing coordinates; filled missing city/state/weather/temperature/visibility.
- Mapped numeric `Severity` (1–4) to readable labels (Minor → Critical).
- Parsed `Start_Time` into datetime and derived `Year`, `Hour`, and an ordered `Day` of week for
  the time-based views.

## Tech stack

Python · Panel · hvPlot / HoloViews · Plotly · Matplotlib / Seaborn · Bokeh · pandas

## Running it

```bash
git clone https://github.com/ishanngohel/us-traffic-accidents-dashboard.git
cd us-traffic-accidents-dashboard
pip install -r requirements.txt
jupyter notebook us_traffic_accidents_dashboard.ipynb
```

Run the cells top to bottom; the final cell renders the interactive dashboard.

> The dashboard is interactive (Panel + Bokeh + Plotly) and won't render on GitHub's static
> notebook preview. Run it in Jupyter/Colab to use it, or see the screenshots in `images/`.

<!-- ![Dashboard overview](images/dashboard.png) -->
