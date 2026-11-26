#!/usr/bin/env bash
# Pack and sign every extension and build the signed store catalogue into dist/.
#   TMX=<path to tmx> TMX_SIGNING_KEY=<private key hex> scripts/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
tmx="${TMX:?set TMX to the tmx binary (cargo build -p telemon-ext --bin tmx in the telemon repository)}"
: "${TMX_SIGNING_KEY:?set TMX_SIGNING_KEY}"
rm -rf dist && mkdir dist
for dir in extensions/*/; do
  id="$(basename "$dir")"
  version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$dir/manifest.json")"
  "$tmx" pack "$dir" -o "dist/${id}-${version}.tmx" --key-env TMX_SIGNING_KEY
done
export TMX_GENERATED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
"$tmx" catalog dist -o dist/catalog.json --key-env TMX_SIGNING_KEY
ls -l dist
