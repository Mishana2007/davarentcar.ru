#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "1/3 Optimize root JPG assets..."
while IFS= read -r img; do
  sips -Z 1800 -s format jpeg -s formatOptions 74 "$img" >/dev/null
done < <(find assets -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' \))

echo "2/3 Optimize full gallery JPG images..."
while IFS= read -r img; do
  sips -Z 1800 -s format jpeg -s formatOptions 74 "$img" >/dev/null
done < <(find assets/gallery -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) ! -path '*/thumbs/*')

echo "3/3 Build gallery thumbnails..."
while IFS= read -r img; do
  dir="$(dirname "$img")"
  base="$(basename "$img")"
  thumbdir="$dir/thumbs"
  out="$thumbdir/$base"
  mkdir -p "$thumbdir"
  cp "$img" "$out"
  sips -Z 520 -s format jpeg -s formatOptions 55 "$out" >/dev/null
done < <(find assets/gallery -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) ! -path '*/thumbs/*')

echo "Create alias *-1.jpg thumbnails..."
for dir in assets/gallery/*; do
  [[ -d "$dir" ]] || continue
  folder="$(basename "$dir")"
  thumbdir="$dir/thumbs"
  [[ -d "$thumbdir" ]] || continue
  alias="$thumbdir/$folder-1.jpg"

  if [[ ! -f "$alias" ]]; then
    if [[ -f "$thumbdir/$folder-01.jpg" ]]; then
      cp "$thumbdir/$folder-01.jpg" "$alias"
    else
      first="$(find "$thumbdir" -maxdepth 1 -type f -iname '*.jpg' | sort | head -n 1)"
      [[ -n "$first" ]] && cp "$first" "$alias"
    fi
  fi
done

echo "Done."
du -sh assets/gallery/* 2>/dev/null | sort -h
