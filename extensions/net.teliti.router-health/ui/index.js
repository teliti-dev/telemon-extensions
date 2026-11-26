// Router health UI: a dashboard page with one row per router and a CPU sparkline, and a small widget.
export default {
  activate(sdk) {
    const h = sdk.React.createElement
    const { useEffect, useState } = sdk.React
    const { Card, CardHeader, CardTitle, CardContent } = sdk.ui

    function useStatus() {
      const [state, setState] = useState({ loading: true })
      useEffect(() => {
        let alive = true
        const load = () =>
          sdk.api.get("/status").then(
            (d) => alive && setState({ data: d }),
            (e) => alive && setState({ error: e.message }),
          )
        load()
        const t = setInterval(load, 30000)
        return () => {
          alive = false
          clearInterval(t)
        }
      }, [])
      return state
    }

    function Spark({ id }) {
      const [samples, setSamples] = useState([])
      useEffect(() => {
        sdk.api.get("/history?router=" + encodeURIComponent(id)).then((d) => setSamples(d.samples || []), () => {})
      }, [id])
      const pts = samples.map((s) => s.cpu).filter((v) => typeof v === "number")
      if (pts.length < 2) return h("span", { className: "text-xs text-muted-foreground" }, "—")
      const w = 120, hgt = 24
      const line = pts.map((v, i) => (i / (pts.length - 1)) * w + "," + (hgt - (Math.min(v, 100) / 100) * hgt)).join(" ")
      return h("svg", { width: w, height: hgt, role: "img", "aria-label": "CPU history" }, h("polyline", { points: line, fill: "none", stroke: "currentColor", strokeWidth: 1.5 }))
    }

    function Page() {
      const s = useStatus()
      if (s.error) return h("p", { className: "text-sm text-destructive" }, s.error)
      if (!s.data) return h("p", { className: "text-sm text-muted-foreground" }, "…")
      return h(Card, null,
        h(CardHeader, null, h(CardTitle, null, "Routers")),
        h(CardContent, null,
          h("table", { className: "w-full text-sm", "data-testid": "rh-table" },
            h("thead", null, h("tr", { className: "text-left text-xs text-muted-foreground" }, ["Router", "CPU", "Memory", "Uptime", "Version", "CPU history"].map((c) => h("th", { key: c, className: "py-1 pr-3 font-normal" }, c)))),
            h("tbody", null, s.data.routers.map((r) =>
              h("tr", { key: r.id, className: "border-t" },
                h("td", { className: "py-1 pr-3 font-medium" }, r.name),
                r.error
                  ? h("td", { colSpan: 5, className: "py-1 text-destructive" }, r.error)
                  : [
                      h("td", { key: "c", className: "py-1 pr-3 tabular-nums" }, r.cpu == null ? "—" : r.cpu + "%"),
                      h("td", { key: "m", className: "py-1 pr-3 tabular-nums" }, r.memoryPct == null ? "—" : r.memoryPct + "%"),
                      h("td", { key: "u", className: "py-1 pr-3" }, r.uptime || "—"),
                      h("td", { key: "v", className: "py-1 pr-3" }, r.version || "—"),
                      h("td", { key: "s", className: "py-1" }, h(Spark, { id: r.id })),
                    ])))))
      )
    }

    function Worst() {
      const s = useStatus()
      let body = "…"
      if (s.error) body = s.error
      else if (s.data) {
        const ok = s.data.routers.filter((r) => typeof r.cpu === "number").sort((a, b) => b.cpu - a.cpu)[0]
        body = ok ? ok.name + " · " + ok.cpu + "% CPU" : "—"
      }
      return h(Card, { "data-testid": "rh-widget" }, h(CardHeader, null, h(CardTitle, null, "Busiest router")), h(CardContent, null, body))
    }

    sdk.registerWidget({ type: "worst-cpu", size: { w: 6, h: 36 }, Component: Worst })
    sdk.registerPage({ id: "home", Component: Page })
  },
}
