# Aturan repo

Repo extension official Telemon (AGPL-3.0). Satu branch: `main`; kerja lewat branch dan PR.

1. Satu folder per extension di `extensions/<id>/` (nama folder = id manifest). Manifest mengikuti ADR 0028 di repo docs (`telemon/docs/decisions/0028-*`) dan `crates/telemon-ext` di repo `telemon`.
2. Kunci privat penanda tangan hanya ada di Actions secret `TMX_SIGNING_KEY` dan cadangan di password manager; jangan di berkas, commit, atau log.
3. Paket dan katalog dibuat `scripts/build.sh` (alat `tmx` dari repo `telemon`). Jangan menandatangani di laptop untuk rilis.
4. Action pihak ketiga dikunci SHA.
5. Commit dan PR tanpa atribusi Claude.

6. Setiap manifest memuat `license` (jenis, SPDX, tautan, ringkasan); extension official di sini AGPL-3.0. Paket dengan `license` hanya terpasang di Telemon 0.1.0-rc.12 ke atas (manifest memakai `deny_unknown_fields`).
