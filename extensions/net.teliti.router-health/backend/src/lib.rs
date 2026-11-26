//! Router health: reads /system/resource of every router through the host API.
//! - GET /status: current CPU, memory, uptime and version per router.
//! - GET /history?router=<id>: the last samples taken by the `sample` worker.
//! - worker `sample` (every 60 s): appends a sample per router to this extension's own key-value store.

use serde_json::{Value, json};
use telemon_ext_guest::{HostError, Request, Response, entry, host};

const HISTORY: usize = 120;

fn num(row: &Value, key: &str) -> Option<f64> {
    row.get(key).and_then(Value::as_str).and_then(|s| s.parse::<f64>().ok())
}

/// One router's resource row, flattened to the fields the UI needs.
fn snapshot(router: &Value) -> Value {
    let id = router.get("id").and_then(Value::as_str).unwrap_or("");
    let name = router.get("name").and_then(Value::as_str).unwrap_or("");
    match host::router_print(id, "/system/resource") {
        Ok(rows) => {
            let r = rows.get(0).cloned().unwrap_or(Value::Null);
            let (free, total) = (num(&r, "free-memory"), num(&r, "total-memory"));
            let mem = match (free, total) {
                (Some(f), Some(t)) if t > 0.0 => Some(((t - f) / t * 100.0).round()),
                _ => None,
            };
            json!({
                "id": id, "name": name,
                "cpu": num(&r, "cpu-load"), "memoryPct": mem,
                "uptime": r.get("uptime"), "version": r.get("version"), "board": r.get("board-name"),
            })
        }
        Err(e) => json!({ "id": id, "name": name, "error": e.message }),
    }
}

fn denied(e: &HostError) -> Response {
    let status = if e.code == "permission_denied" { 403 } else { 502 };
    Response::error(status, &e.code, &e.message)
}

fn status() -> Response {
    match host::routers_list() {
        Ok(routers) => Response::ok(json!({ "routers": routers.as_array().map(|a| a.iter().map(snapshot).collect::<Vec<_>>()).unwrap_or_default() })),
        Err(e) => denied(&e),
    }
}

fn history(req: &Request) -> Response {
    let Some(router) = req.query_str("router") else { return Response::error(400, "bad_request", "router wajib") };
    match host::kv_get(&format!("hist/{router}")) {
        Ok(v) => Response::ok(json!({ "samples": v.and_then(|s| serde_json::from_str::<Value>(&s).ok()).unwrap_or_else(|| json!([])) })),
        Err(e) => denied(&e),
    }
}

fn sample(req: &Request) -> Response {
    let routers = match host::routers_list() {
        Ok(r) => r,
        Err(e) => return denied(&e),
    };
    for r in routers.as_array().into_iter().flatten() {
        let snap = snapshot(r);
        let Some(id) = snap.get("id").and_then(Value::as_str) else { continue };
        if snap.get("error").is_some() {
            continue;
        }
        let key = format!("hist/{id}");
        let mut list: Vec<Value> = host::kv_get(&key).ok().flatten().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
        list.push(json!({ "at": req.now, "cpu": snap.get("cpu"), "memoryPct": snap.get("memoryPct") }));
        if list.len() > HISTORY {
            list.drain(0..list.len() - HISTORY);
        }
        let _ = host::kv_set(&key, &Value::Array(list).to_string());
    }
    Response::ok(json!({ "sampled": routers.as_array().map(|a| a.len()).unwrap_or(0) }))
}

fn handle(req: Request) -> Response {
    match (req.kind.as_str(), req.route.as_deref(), req.worker.as_deref()) {
        ("http", Some("status"), _) => status(),
        ("http", Some("history"), _) => history(&req),
        ("worker", _, Some("sample")) => sample(&req),
        _ => Response::error(404, "not_found", "unknown request"),
    }
}

entry!(handle);
