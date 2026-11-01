#!/usr/bin/env bash
# Собирает файлы сайта в папку $1 и пишет в неё mc-bundle.json с версией (по содержимому файлов).
# Одинаково используется при сборке APK и при публикации пакета обновления.
set -e
OUT="$1"
[ -n "$OUT" ] || { echo "usage: site-files.sh <out-dir>"; exit 1; }
rm -rf "$OUT"; mkdir -p "$OUT"
shopt -s nullglob
for f in *.html *.css *.js *.png *.jpg *.jpeg *.svg *.webp *.ico *.webmanifest manifest*.json; do
  case "$f" in sw.js) continue;; esac
  cp "$f" "$OUT/"
done
VER=$(cd "$OUT" && find . -type f | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-12)
printf '{"version":"%s"}\n' "$VER" > "$OUT/mc-bundle.json"
echo "$VER"
