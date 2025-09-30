#!/usr/bin/env bash
set -e
missing=0
shopt -s nullglob
for pdf in public/specs/*.pdf; do
  base="${pdf%.pdf}"
  if [[ -e "$base.png" || -e "$base.jpg" || -e "$base.jpeg" || -e "$base.webp" ]]; then
    :
  else
    echo "MISSING PREVIEW: $base.(png|jpg|jpeg|webp)"
    missing=$((missing+1))
  fi
done
echo "Total missing: $missing"
