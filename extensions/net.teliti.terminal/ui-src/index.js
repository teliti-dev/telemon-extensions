// Router terminal (SSH): xterm.js in the browser, bridged by Telemon to the router (ADR 0029).
// The server checks every condition again: permission toggle, access level and action, Router edit permission,
// router write flag, pinned host key. This page only makes them visible.
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import css from "@xterm/xterm/css/xterm.css" with { type: "text" }

let cssAdded = false
function addCss() {
  if (cssAdded) return
  const s = document.createElement("style")
  s.textContent = css
  document.head.appendChild(s)
  cssAdded = true
}

async function getJson(url, init) {
  const r = await fetch(url, { credentials: "same-origin", ...init })
  let d = null
  try {
    d = await r.json()
  } catch {}
  if (!r.ok) throw new Error(d?.error?.message ?? `HTTP ${r.status}`)
  return d
}

export default {
  activate(sdk) {
    const h = sdk.React.createElement
    const { useEffect, useRef, useState } = sdk.React
    const { Card, CardHeader, CardTitle, CardContent } = sdk.ui

    function Console({ router, name, onClose }) {
      const box = useRef(null)
      const [note, setNote] = useState("Connecting…")
      useEffect(() => {
        addCss()
        const term = new Terminal({ cursorBlink: true, fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", scrollback: 5000 })
        const fit = new FitAddon()
        term.loadAddon(fit)
        term.open(box.current)
        fit.fit()
        const ws = new WebSocket(sdk.sessionUrl("ssh", { router, cols: term.cols, rows: term.rows }))
        ws.binaryType = "arraybuffer"
        const enc = new TextEncoder()
        let opened = false
        ws.onopen = () => {
          opened = true
          setNote("")
          term.focus()
        }
        ws.onmessage = (e) => {
          if (typeof e.data === "string") {
            try {
              const m = JSON.parse(e.data)
              if (m.type === "end") setNote("Session ended: " + m.reason)
            } catch {}
          } else term.write(new Uint8Array(e.data))
        }
        ws.onclose = () => setNote((n) => n || (opened ? "Session closed." : "Could not open the session. Possible causes: the host key is not pinned, the router refused the account (it needs the ssh policy), SSH is off or blocked on the router, or you have reached the session limit."))
        term.onData((d) => ws.readyState === 1 && ws.send(enc.encode(d)))
        const resize = () => {
          fit.fit()
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }))
        }
        const ro = new ResizeObserver(resize)
        ro.observe(box.current)
        return () => {
          ro.disconnect()
          try {
            ws.close()
          } catch {}
          term.dispose()
        }
      }, [router])
      return h("div", { className: "flex h-full flex-col gap-2 p-2" },
        h("div", { className: "flex items-center gap-2 text-sm" },
          h("strong", null, name),
          note && h("span", { className: "text-muted-foreground", "data-testid": "term-note" }, note),
          h("button", { className: "ml-auto rounded-md border px-2 py-1 text-xs", onClick: onClose }, "Close tab")),
        h("div", { ref: box, "data-testid": "term-box", style: { flex: 1, minHeight: 0, background: "#000", padding: 6, borderRadius: 6 } }))
    }

    function Setup({ router, onReady, onBack }) {
      const [info, setInfo] = useState(null)
      const [err, setErr] = useState(null)
      const [port, setPort] = useState(22)
      const [busy, setBusy] = useState(false)
      const load = (p) =>
        getJson(`/api/routers/${router.id}/ssh` + (p ? `?port=${encodeURIComponent(p)}` : "")).then(
          (d) => {
            setInfo(d)
            setPort(p ?? d.port)
            setErr(null)
          },
          (e) => setErr(e.message),
        )
      useEffect(() => {
        load()
      }, [router.id])
      async function pin() {
        setBusy(true)
        try {
          await getJson(`/api/routers/${router.id}/ssh`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port: Number(port), fingerprint: info.presented }) })
          await load(port)
        } catch (e) {
          setErr(e.message)
        } finally {
          setBusy(false)
        }
      }
      if (err) return h("p", { className: "text-sm text-destructive" }, err)
      if (!info) return h("p", { className: "text-sm text-muted-foreground" }, "…")
      const changed = info.pinned && info.presented && info.pinned !== info.presented
      return h("div", { className: "grid gap-3 p-3 text-sm" },
        h("div", null, h("strong", null, router.name), " · SSH port ",
          h("input", { type: "number", min: 1, max: 65535, value: port, className: "w-20 rounded-md border bg-background px-1", onChange: (e) => setPort(e.target.value), onBlur: () => Number(port) !== info.port && load(Number(port)) })),
        info.error && h("p", { className: "text-destructive" }, info.error),
        info.pinned
          ? h("p", null, "Pinned host key: ", h("code", { "data-testid": "pinned-fp" }, info.pinned))
          : info.presented
            ? h("div", { className: "grid gap-2" },
                h("p", null, "This router offers the host key below. Compare it with the key shown on the router (", h("code", null, "/ip ssh print"), " or the SSH host key fingerprint) and pin it only if it matches."),
                h("code", { "data-testid": "presented-fp", className: "break-all" }, info.presented),
                h("div", null, h("button", { disabled: busy, className: "rounded-md border px-3 py-1", onClick: pin }, "Pin this host key")))
            : null,
        changed && h("p", { className: "text-destructive" }, "The router now offers a different host key (" + info.presented + "). Connections are refused until you investigate."),
        h("div", { className: "flex gap-2" },
          h("button", { disabled: !info.pinned || changed, className: "rounded-md border px-3 py-1 disabled:opacity-50", onClick: () => onReady() }, "Open terminal"),
          h("button", { className: "rounded-md border px-3 py-1", onClick: onBack }, "Back")))
    }

    // Satu tab panel = satu router: langkah menyematkan kunci host lalu terminalnya.
    function Tab({ params, close }) {
      const [live, setLive] = useState(false)
      const router = { id: String(params.router), name: String(params.name) }
      return live ? h(Console, { router: router.id, name: router.name, onClose: close }) : h(Setup, { router, onReady: () => setLive(true), onBack: close })
    }

    sdk.registerPanel({ id: "terminal", Component: Tab })
    sdk.registerRouterAction({
      id: "open",
      disabled: (r) => (!sdk.hasPermission("feature.router-ssh") ? "The permission feature.router-ssh is off (Settings > Extensions > Router terminal)." : !r.canWrite ? "This router does not allow writing from Telemon, so terminals are off." : null),
      run: (r) => sdk.panel.open("terminal", { key: r.id, title: "SSH · " + r.name, params: { router: r.id, name: r.name } }),
    })
  },
}
