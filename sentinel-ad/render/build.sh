#!/usr/bin/env bash
# Build the Sentinel ad: soundtrack + vertical (9:16) and horizontal (16:9) films.
#   ./render/build.sh            # both formats
#   ./render/build.sh 9x16       # one format
# Needs: node + playwright (with Chromium), ffmpeg, python3 with numpy + scipy.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out

FORMATS=${1:-"9x16 16x9"}
WORKERS=${WORKERS:-4}

echo "▸ soundtrack"
python3 render/soundtrack.py out/soundtrack.wav

for f in $FORMATS; do
  case $f in
    9x16) W=1080; H=1920 ;;
    16x9) W=1920; H=1080 ;;
    *) echo "unknown format $f"; exit 1 ;;
  esac
  echo "▸ video $f (${W}x${H}, 60 fps, 4-sample motion blur)"
  node render/capture.mjs --w $W --h $H --fps 60 --sub 4 --workers "$WORKERS" --crf 20 --out "out/video_$f.mp4"
  echo "▸ mux $f"
  ffmpeg -v error -y -i "out/video_$f.mp4" -i out/soundtrack.wav -map 0:v -map 1:a \
    -c:v copy -c:a aac -b:a 256k -movflags +faststart -shortest "out/Sentinel_Ad_$f.mp4"
done
ls -lh out/Sentinel_Ad_*.mp4
