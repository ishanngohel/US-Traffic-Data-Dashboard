importScripts("https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide...");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded pyodide!");
  const data_archives = [];
  for (const archive of data_archives) {
    let zipResponse = await fetch(archive);
    let zipBinary = await zipResponse.arrayBuffer();
    self.postMessage({type: 'status', msg: `Unpacking ${archive}`})
    self.pyodide.unpackArchive(zipBinary, "zip");
  }
  await self.pyodide.loadPackage("micropip");
  self.postMessage({type: 'status', msg: `Installing environment`})
  try {
    await self.pyodide.runPythonAsync(`
      import micropip
      await micropip.install(['https://cdn.holoviz.org/panel/wheels/bokeh-3.9.2-py3-none-any.whl', 'https://cdn.holoviz.org/panel/1.9.4/dist/wheels/panel-1.9.4-py3-none-any.whl', 'pyodide-http', 'pandas', 'numpy', 'plotly==5.24.1', 'matplotlib', 'seaborn', 'hvplot', 'holoviews']);
    `);
  } catch(e) {
    console.log(e)
    self.postMessage({
      type: 'status',
      msg: `Error while installing packages`
    });
  }
  console.log("Environment loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(`\nimport asyncio\n\nfrom panel.io.pyodide import init_doc, write_doc\n\ninit_doc()\n\n# !pip install geoviews bokeh dash -q\n# !pip install -q panel hvplot jupyter_bokeh\n\nimport hvplot.pandas\nimport pandas as pd\nimport holoviews as hv\nimport panel as pn\nimport matplotlib.pyplot as plt\nimport seaborn as sns\nimport plotly.express as px\nimport plotly.graph_objects as go\n\npn.extension('bokeh', 'plotly', sizing_mode="stretch_width")\n\n# ---------- LOAD & CLEAN ----------\nurl = "https://raw.githubusercontent.com/hganesh2024/dsci454-data/main/US_Accidents_sampled_100k.csv.gz"\ntry:\n    df = pd.read_csv(url, compression="gzip")\nexcept Exception:\n    # Offline fallback (used only if the live download is unavailable, e.g. during\n    # static build). In the browser the real dataset above loads normally.\n    import numpy as np\n    _n = 300\n    _rng = np.random.default_rng(0)\n    df = pd.DataFrame({\n        "Start_Lat": _rng.uniform(25, 48, _n),\n        "Start_Lng": _rng.uniform(-124, -68, _n),\n        "City": _rng.choice(["Los Angeles", "Houston", "Miami", "Chicago"], _n),\n        "State": _rng.choice(["CA", "TX", "FL", "IL"], _n),\n        "Weather_Condition": _rng.choice(["Clear", "Rain", "Cloudy", "Fog", "Snow"], _n),\n        "Temperature(F)": _rng.uniform(20, 100, _n),\n        "Visibility(mi)": _rng.uniform(0, 10, _n),\n        "Severity": _rng.integers(1, 5, _n),\n        "Sunrise_Sunset": _rng.choice(["Day", "Night"], _n),\n        "Start_Time": pd.to_datetime("2019-01-01") + pd.to_timedelta(_rng.integers(0, 1500, _n), unit="D") + pd.to_timedelta(_rng.integers(0, 24, _n), unit="h"),\n    })\n\ndf = df.dropna(subset=['Start_Lat', 'Start_Lng'])\ndf['City'] = df['City'].fillna('Unknown')\ndf['State'] = df['State'].fillna('Unknown')\ndf['Weather_Condition'] = df['Weather_Condition'].fillna('Unknown')\ndf['Temperature(F)'] = df['Temperature(F)'].fillna(0)\ndf['Visibility(mi)'] = df['Visibility(mi)'].fillna(0)\ndf['Severity'] = df['Severity'].fillna(2).astype(int)\n\nlabels = {1: '1 - Minor', 2: '2 - Moderate', 3: '3 - Serious', 4: '4 - Critical'}\ndf['Severity Label'] = df['Severity'].map(labels)\n\ndf["Start_Time"] = pd.to_datetime(df["Start_Time"], format="mixed", errors="coerce")\ndf = df.dropna(subset=["Start_Time"])\ndf["Year"] = df["Start_Time"].dt.year\ndf["Hour"] = df["Start_Time"].dt.hour\nday_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]\ndf["Day"] = pd.Categorical(df["Start_Time"].dt.day_name(), categories=day_order, ordered=True)\n\n# ---------- GLOBAL WIDGETS (sidebar) ----------\nseverity_widget = pn.widgets.MultiChoice(\n    name="Severity",\n    value=[1, 2, 3, 4],\n    options=[1, 2, 3, 4]\n)\n\nstate_widget = pn.widgets.MultiChoice(\n    name="State",\n    value=[],  # empty = all\n    options=sorted(df['State'].unique().tolist()),\n    placeholder="All states"\n)\n\nyear_widget = pn.widgets.IntRangeSlider(\n    name="Year Range",\n    start=int(df['Year'].min()),\n    end=int(df['Year'].max()),\n    value=(2017, 2022),\n    step=1\n)\n\n# ---------- FILTERED DATA (reactive) ----------\ndef filter_df(severity, states, year_range):\n    filtered = df[df['Severity'].isin(severity)]\n    filtered = filtered[(filtered['Year'] >= year_range[0]) & (filtered['Year'] <= year_range[1])]\n    if states:\n        filtered = filtered[filtered['State'].isin(states)]\n    return filtered\n\n# ---------- CHARTS (all reactive to widgets) ----------\ndef plot_map(severity, states, year_range):\n    d = filter_df(severity, states, year_range)\n    if len(d) == 0:\n        return pn.pane.Markdown("### No data matches filters")\n    sample = d.sample(n=min(20000, len(d)), random_state=42)\n    fig = px.scatter_mapbox(\n        sample, lat='Start_Lat', lon='Start_Lng', color='Severity',\n        color_continuous_scale=['green', 'yellow', 'orange', 'red'],\n        zoom=3, height=450,\n        hover_data=['City', 'State', 'Weather_Condition']\n    )\n    fig.update_traces(marker=dict(size=4, opacity=0.6))\n    fig.update_layout(mapbox_style='carto-darkmatter', margin=dict(l=0, r=0, t=10, b=0),\n                      paper_bgcolor='rgba(0,0,0,0)')\n    return pn.pane.Plotly(fig, sizing_mode="stretch_width", height=450)\n\ndef plot_yearly(severity, states, year_range):\n    d = filter_df(severity, states, year_range)\n    yearly = d.groupby("Year").size().reset_index(name="Count")\n    fig, ax = plt.subplots(figsize=(7, 3.5))\n    sns.lineplot(data=yearly, x="Year", y="Count", marker="o", linewidth=2, ax=ax, color='#E74C3C')\n    ax.set_title("Accidents Per Year")\n    ax.grid(alpha=0.3)\n    plt.tight_layout()\n    plt.close(fig)\n    return pn.pane.Matplotlib(fig, tight=True, sizing_mode="stretch_width")\n\ndef plot_kde(severity, states, year_range):\n    d = filter_df(severity, states, year_range).dropna(subset=["Sunrise_Sunset"])\n    fig, ax = plt.subplots(figsize=(7, 3.5))\n    if len(d) > 0:\n        sns.kdeplot(data=d, x="Severity", hue="Sunrise_Sunset",\n                    fill=True, common_norm=False, alpha=0.5, ax=ax)\n    ax.set_title("Severity: Day vs Night")\n    plt.tight_layout()\n    plt.close(fig)\n    return pn.pane.Matplotlib(fig, tight=True, sizing_mode="stretch_width")\n\ndef plot_weather(severity, states, year_range):\n    d = filter_df(severity, states, year_range)\n    top = d['Weather_Condition'].value_counts().head(10)\n    fig = px.bar(x=top.index, y=top.values,\n                 labels={'x': 'Weather', 'y': 'Accidents'},\n                 color=top.values, color_continuous_scale='Reds')\n    fig.update_layout(height=400, margin=dict(l=10, r=10, t=30, b=10),\n                      title="Top 10 Weather Conditions",\n                      paper_bgcolor='rgba(0,0,0,0)', showlegend=False,\n                      coloraxis_showscale=False)\n    return pn.pane.Plotly(fig, sizing_mode="stretch_width", height=400)\n\ndef plot_heatmap(severity, states, year_range):\n    d = filter_df(severity, states, year_range)\n    heatmap_data = d.groupby(["Day", "Hour"], observed=True).size().reset_index(name="Count")\n    return heatmap_data.hvplot.heatmap(\n        x="Hour", y="Day", C="Count", cmap="Reds",\n        height=400, responsive=True, title="Accidents by Day & Hour"\n    )\n\n# ---------- BIND WIDGETS TO PLOTS ----------\ndeps = dict(severity=severity_widget, states=state_widget, year_range=year_widget)\n\nmap_pane = pn.bind(plot_map, **deps)\nyearly_pane = pn.bind(plot_yearly, **deps)\nkde_pane = pn.bind(plot_kde, **deps)\nweather_pane = pn.bind(plot_weather, **deps)\nheatmap_pane = pn.bind(plot_heatmap, **deps)\n\n# ---------- KPI CARDS ----------\ndef make_kpis(severity, states, year_range):\n    d = filter_df(severity, states, year_range)\n    total = pn.indicators.Number(name="Total Accidents", value=len(d),\n                                  format="{value:,}", font_size="28pt", title_size="14pt")\n    avg_sev = pn.indicators.Number(name="Avg Severity", value=round(d['Severity'].mean(), 2) if len(d) else 0,\n                                    font_size="28pt", title_size="14pt")\n    states_n = pn.indicators.Number(name="States", value=d['State'].nunique(),\n                                     font_size="28pt", title_size="14pt")\n    return pn.Row(total, avg_sev, states_n)\n\nkpi_pane = pn.bind(make_kpis, **deps)\n\n# sidebar styled like FastListTemplate\nsidebar = pn.Column(\n    pn.pane.Markdown("## \U0001f697 Dashboard\\n### Filters", styles={'color': 'white'}),\n    severity_widget,\n    state_widget,\n    year_widget,\n    width=280,\n    styles={'background': '#2C3E50', 'padding': '20px', 'color': 'white'},\n    height=900\n)\n\n# main content area\nmain = pn.Column(\n    pn.pane.Markdown("# US Traffic Accidents Dashboard",\n                     styles={'background': '#2C3E50', 'color': 'white', 'padding': '15px'}),\n    kpi_pane,\n    pn.Card(map_pane, title="Accident Locations"),\n    pn.Row(\n        pn.Card(yearly_pane, title="Yearly Trend"),\n        pn.Card(kde_pane, title="Day vs Night"),\n    ),\n    pn.Row(\n        pn.Card(weather_pane, title="Weather Conditions"),\n        pn.Card(heatmap_pane, title="Time Heatmap"),\n    ),\n    sizing_mode="stretch_width"\n)\n\ndashboard = pn.Row(sidebar, main)\ndashboard.servable()\n\nawait write_doc()`)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.globals.set('patch', msg.patch)
    self.pyodide.runPythonAsync(`
    from panel.io.pyodide import _convert_json_patch
    state.curdoc.apply_json_patch(_convert_json_patch(patch), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.globals.set('location', msg.location)
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads(location)
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()