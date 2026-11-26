#!/usr/bin/env bash
# Run once, by the owner, on a trusted machine:  scripts/gen-signing-key.sh
#
# - generates the official Ed25519 signing key
# - stores the PRIVATE key as the Actions secret TMX_SIGNING_KEY of this repository (write-only afterwards)
# - prints the PUBLIC key, which goes into OFFICIAL_KEYS in the telemon repository
#
# The private key is also written to the file given as $1 (mode 0600) so that you can put it into your
# password manager. Move it there and delete the file; nothing else keeps a copy.
set -euo pipefail
out="${1:?usage: scripts/gen-signing-key.sh <file-for-the-private-key-backup>}"
[ ! -e "$out" ] || { echo "refusing to overwrite $out" >&2; exit 1; }
tmx="${TMX:-tmx}"
umask 077
sec="$("$tmx" keygen)"
printf '%s\n' "$sec" > "$out"
printf '%s' "$sec" | gh secret set TMX_SIGNING_KEY --repo teliti-dev/telemon-extensions
pub="$("$tmx" pubkey "$sec")"
unset sec
echo "public key (for OFFICIAL_KEYS): $pub"
echo "private key backup written to $out (0600): store it in the password manager, then delete the file"
