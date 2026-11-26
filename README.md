# Telemon extensions

Official extensions for [Telemon](https://github.com/teliti-dev/telemon): signed `.tmx` packages and the signed store catalogue the app reads.

The host (loader, permissions, access page, migrations) and the SDK contract live in the Telemon repository (ADR 0028). This repository only holds extensions.

## Layout
```
extensions/<id>/manifest.json   one folder per extension (the folder name is the id)
extensions/<id>/ui/...          ES module bundle (default export { activate(sdk) }), assets
extensions/<id>/migrations/     optional database migrations (declarative JSON, see ADR 0028)
scripts/build.sh                pack, sign, build dist/catalog.json and dist/catalog.json.sig
scripts/gen-signing-key.sh      one-time: create the signing key and store it as the Actions secret
```

## Extensions
- `net.teliti.hello`: UI-only example (widget and page).
- `net.teliti.router-health`: a Rust backend compiled to WASM with the Telemon SDK. Reads `/system/resource` of every router, keeps a short CPU/memory history (worker every 60 s, own key-value store) and shows it on a page and a widget.

- `net.teliti.terminal`: SSH terminal to routers in the browser (xterm.js bundled with bun). The Telemon core holds the SSH session and the host-key pin; this extension is the UI. Needs the sensitive permission `feature.router-ssh` and the `terminal` action; routers must allow writing from Telemon. See ADR 0029.

## Writing a backend
A backend is a `cdylib` crate built for `wasm32-unknown-unknown` with `telemon-ext-guest` (see `extensions/net.teliti.router-health/backend`). Declare routes and workers in `manifest.json`; request the data you read as permissions (they start off when sensitive). The host API and its limits are described in ADR 0028.

## Build locally
```
cargo build --release --manifest-path ../server/crates/telemon-ext/Cargo.toml --bin tmx
TMX=../server/crates/telemon-ext/target/release/tmx TELEMON_DIR=../server TMX_SIGNING_KEY=<hex> scripts/build.sh
```
The app trusts a package only when it is signed by a key pinned in `OFFICIAL_KEYS` of Telemon (or added by the server owner with `TELEMON_EXTENSIONS_OFFICIAL_KEYS`).

## Release
Create a GitHub release; the workflow attaches every `.tmx`, `catalog.json` and `catalog.json.sig` to it. The app reads the catalogue from the release assets.

## Signing key
The key is created and kept **inside GitHub Actions**; nothing is generated or copied by hand.
1. Create a fine-grained personal access token with *Secrets: write* on this repository and *Variables: write* on `teliti-dev/telemon`, and save it here as the secret `KEY_SETUP_TOKEN`.
2. Run the workflow **Setup signing key** (Actions tab). It generates the key, stores the private half as the secret `TMX_SIGNING_KEY` (never printed) and writes the public half to the Telemon repository variable `TELEMON_OFFICIAL_EXT_KEYS`.
3. The next Telemon release compiles that public key into the app. Create a release here to publish signed packages and the catalogue.

Good to know: the private key cannot be read back, and apps pin the public key when they are built. Losing the secret means running the workflow with *rotate* and releasing a new Telemon (the old public key stays trusted next to the new one until you remove it). `scripts/gen-signing-key.sh` is the manual alternative.

## Licenses
Every extension declares its `license` in the manifest (`kind`, `spdx`, `url`, `summary`; see the Telemon wiki, *Writing extensions*). The official extensions here are open source under the AGPL-3.0 (see `LICENSE`).

**Packages that carry `license` need Telemon 0.1.0-rc.12 or newer.** Older builds reject a manifest with an unknown field, so they cannot install or update these packages (the versions they already have keep working).

## Rules
- Extensions add features; they never change core behaviour (ADR 0028).
- Declare every permission and action in the manifest; sensitive permissions start off.
- Keep `telemon` (supported Telemon range) and `requires` (other extensions, with ranges) accurate.
- Never commit a private key.

AGPL-3.0, see `LICENSE`.
