#!/usr/bin/env bash
# Pack and sign every extension and build the signed store catalogue into dist/.
#   TMX=<path to tmx> TMX_SIGNING_KEY=<private key hex> [TELEMON_DIR=<telemon checkout>] scripts/build.sh
# Backends need: rustup target add wasm32-unknown-unknown. UIs with dependencies need bun.
set -euo pipefail
cd "$(dirname "$0")/.."
tmx="${TMX:?set TMX to the tmx binary (cargo build -p telemon-ext --bin tmx in the telemon repository)}"
: "${TMX_SIGNING_KEY:?set TMX_SIGNING_KEY}"
rm -rf dist stage && mkdir dist stage
for dir in extensions/*/; do
  id="$(basename "$dir")"
  version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$dir/manifest.json")"
  # Stage only what ships: manifest, ui, migrations and the compiled backend (never the Rust sources).
  mkdir "stage/$id"
  cp "$dir/manifest.json" "stage/$id/"
  for part in ui migrations; do [ -d "$dir/$part" ] && cp -r "$dir/$part" "stage/$id/"; done
  # UI written with dependencies (ui-src/ + package.json): bundle to a single ES module with bun.
  if [ -f "$dir/ui-src/index.js" ]; then
    (cd "$dir" && bun install --frozen-lockfile)
    mkdir -p "stage/$id/ui"
    bun build "$dir/ui-src/index.js" --outfile "stage/$id/ui/index.js" --format esm --minify --target browser
  fi
  if [ -f "$dir/backend/Cargo.toml" ]; then
    cargo_args=(build --release --locked --target wasm32-unknown-unknown --manifest-path "$dir/backend/Cargo.toml")
    if [ -n "${TELEMON_DIR:-}" ]; then
      # Local builds (and CI) use the SDK from a Telemon checkout instead of the git branch.
      cargo_args+=(--config "patch.'https://github.com/teliti-dev/telemon'.telemon-ext-guest.path='${TELEMON_DIR}/crates/telemon-ext-guest'")
    fi
    cargo "${cargo_args[@]}"
    wasm="$(ls "$dir"/backend/target/wasm32-unknown-unknown/release/*.wasm | head -1)"
    cp "$wasm" "stage/$id/backend.wasm"
  fi
  "$tmx" pack "stage/$id" -o "dist/${id}-${version}.tmx" --key-env TMX_SIGNING_KEY
done
export TMX_GENERATED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
"$tmx" catalog dist -o dist/catalog.json --key-env TMX_SIGNING_KEY
ls -l dist
