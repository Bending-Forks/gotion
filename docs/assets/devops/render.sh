#!/bin/sh
# Regenerates an SVG from every .drawio file here with the draw.io CLI: `drawio`, or the command in $DRAWIO.
set -e
cd "$(dirname "$0")"
for f in *.drawio; do
	${DRAWIO:-drawio} --export --format svg --output "${f%.drawio}.svg" "$f"
done
