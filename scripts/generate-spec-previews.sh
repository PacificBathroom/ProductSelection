#!/usr/bin/env bash
set -e
shopt -s nullglob
for pdf in public/specs/*.pdf; do
  base="${pdf%.pdf}"
  if [[ -e "$base.png" || -e "$base.jpg" || -e "$base.jpeg" || -e "$base.webp" ]]; then
    echo "✓ Exists: $(basename "$base").(png/jpg)"
    continue
  fi
  echo "→ Generating: $(basename "$base").png"
  # first page, single file, ~1600px wide (tweak as you like)
  pdftoppm -png -singlefile -f 1 -scale-to 1600 "$pdf" "$base"
done
