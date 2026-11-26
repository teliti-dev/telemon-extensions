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

## Build locally
```
cargo build --release --manifest-path ../server/crates/telemon-ext/Cargo.toml --bin tmx
TMX=../server/crates/telemon-ext/target/release/tmx TMX_SIGNING_KEY=<hex> scripts/build.sh
```
The app trusts a package only when it is signed by a key pinned in `OFFICIAL_KEYS` of Telemon (or added by the server owner with `TELEMON_EXTENSIONS_OFFICIAL_KEYS`).

## Release
Create a GitHub release; the workflow attaches every `.tmx`, `catalog.json` and `catalog.json.sig` to it. The app reads the catalogue from the release assets.

## Rules
- Extensions add features; they never change core behaviour (ADR 0028).
- Declare every permission and action in the manifest; sensitive permissions start off.
- Keep `telemon` (supported Telemon range) and `requires` (other extensions, with ranges) accurate.
- Never commit a private key.

AGPL-3.0, see `LICENSE`.
