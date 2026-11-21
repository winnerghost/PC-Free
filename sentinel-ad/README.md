# Sentinel: launch teaser ("Coming soon")

A 40-second launch teaser for **Sentinel**, the smart gate guardian designed and built by **Arham Ashraf**.
It is rendered in real 3D and plays as **one continuous camera move with no cuts**. The last frame flows
straight back into the first, so the film loops endlessly.

| File | Format | Use it for |
| --- | --- | --- |
| `out/Sentinel_Ad_9x16.mp4` | 1080×1920, 60 fps | Instagram Reels, Stories, YouTube Shorts, WhatsApp Status |
| `out/Sentinel_Ad_16x9.mp4` | 1920×1080, 60 fps | YouTube, website hero, presentations, screens at events |

## The film

| Time | What you see | On screen |
| --- | --- | --- |
| 0–10 s | Macro shots in the dark: the light ring draws itself, light slides over the glass, then the full product reveal | It sees. · It listens. · It never sleeps. · **SENTINEL** |
| 10–15 s | The lights come up: Sentinel is on the gate pillar. Three knocks send rings across the gate | **Knock detection.** · card: Knock detected |
| 15–20 s | The gate swings open and warm light pours out, then it closes | **Gate open. Gate closed.** · cards: Gate opened / closed |
| 20–25 s | A full 24-hour timelapse while the sensing field scans the street; a passer-by is tracked at 2:28 AM | **Senses motion. 24/7.** · 24 h dial, tracking box |
| 25–30 s | The camera rises from the gate to the planet; links of light race to cities worldwide | **Watch live from anywhere.** · live-view phone |
| 30–35 s | Clips stream up into the cloud and file themselves into a vault | **Saved to the cloud.** |
| 35–40 s | We dive back down to the product | Designed & built by **Arham Ashraf** · **SENTINEL — Coming soon** |

The phone's live view and the footage cards in the cloud are real renders of the 3D scene, made when the page loads.

## Edit it

All words, card texts, times and the ring colour are in **`src/config.js`**.

Watch it live in a browser while you edit (it loops):

```sh
cd sentinel-ad
python3 -m http.server 8000
# 9:16  → http://localhost:8000
# 16:9  → http://localhost:8000/?w=1920&h=1080
```

Space pauses, the arrow keys scrub, and you can click the bar to jump. A laptop GPU plays it live.

## Render it

```sh
cd sentinel-ad
npm install && npx playwright install chromium   # once
pip install numpy scipy                            # once
./render/build.sh            # soundtrack + both formats
./render/build.sh 9x16       # just the vertical one
```

- **Re-render part of it:** `node render/capture.mjs --w 1080 --h 1920 --from 0 --to 800 --out out/part/intro.mp4` renders frames 0–799 only. Every frame is a pure function of time, so a range can replace the same frames in a full render. Join them without re-encoding at a keyframe (ffmpeg `-c copy`). Give each concurrent render its own output folder.
- **Picture:** `render/capture.mjs` drives headless Chromium. Every frame is rendered as 4 jittered, time-offset sub-frames and blended in HDR. That gives 4× anti-aliasing and real motion blur. Bloom, filmic tone mapping, a lens grade and a fine grain are applied after, and the result is encoded as H.264 at 60 fps.
- **Sound:** `render/soundtrack.py` synthesises the score and every effect from scratch on the picture's timeline: the knocks, the gate motor and latch, the timelapse clock, the arcs, and the cloud uploads. It loops with no click and sits at about −14 LUFS for social platforms.

## How it is built

| Path | What it does |
| --- | --- |
| `src/config.js` | Copy, card texts, timings, ring colour, the globe's cities |
| `src/timeline.js` | The choreography: every moving value as a function of time (96 BPM grid) |
| `src/camera.js` | The single camera move, as a smooth time-aware spline |
| `src/device.js` | The Sentinel model: aluminium body, glass face, iridescent lens, light ring |
| `src/world.js` | The gate at night: pillars, slat gate, lights, knock ripples, sensing cone, 24 h sky |
| `src/earth.js` | Dot-matrix globe, arcs, cloud and footage vault |
| `src/overlay.js` | Typography and UI: headlines, cards, tracking box, 24 h dial, live-view phone |
| `src/main.js` | Render engine: accumulation, bloom, grading, baking the live-view renders |
| `vendor/three/` | Three.js (MIT), so the project runs offline |
| `render/make-globe.mjs` | Regenerates `src/data/land.js` from Natural Earth land data |

Fonts: Inter Display, Inter and JetBrains Mono (SIL Open Font License, see `fonts/LICENSE.txt`).
