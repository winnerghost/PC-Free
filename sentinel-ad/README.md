# Sentinel: 36-second ad

A motion-graphics ad for **Sentinel**, designed and built by **Arham Ashraf**.
It plays as one unbroken shot and loops seamlessly: the last frame flows straight back into the first.

| File | Format | Use it for |
| --- | --- | --- |
| `out/Sentinel_Ad_9x16.mp4` | 1080×1920, 60 fps | Instagram Reels, Stories, YouTube Shorts, WhatsApp Status |
| `out/Sentinel_Ad_16x9.mp4` | 1920×1080, 60 fps | YouTube, website hero, presentations |

## The idea

One glowing ring never leaves the screen. It is Sentinel's eye, and it keeps changing shape to tell the story:

clock at 3:07 AM → closed eye → eye snaps open → the lens of the device → a night-vision viewfinder →
it catches an intruder → becomes your phone with the alert → sounds the alarm → arms itself →
becomes the price badge → the product shot → and back into the clock.

Everything moves in one direction (text rises in and out, the camera never cuts), so the film reads as one continuous flow.

| Time | Beat | Headline |
| --- | --- | --- |
| 0–3 s | 3:07 AM, the house is dark | Everyone's asleep. |
| 3–6 s | The eye snaps open | Sentinel isn't. |
| 6–9 s | Pull back: the eye was the lens | Meet Sentinel. |
| 9–12 s | Dive into the lens: night vision | Sees in the dark. |
| 12–15 s | Intruder, locked on (red) | Catches every move. |
| 15–18 s | The ring becomes a phone | Alerts your phone. Instantly. |
| 18–21 s | Red pulses | Sounds the alarm. |
| 21–24 s | The ring arms itself | Plug it in. You're protected. |
| 24–29 s | The ring becomes the price | Peace of mind. Rs 5,999 |
| 29–32 s | Product shot | Designed & built by Arham Ashraf |
| 32–36 s | End card | SENTINEL · Never sleeps. · Order now |

## Before you publish: check the claims

I wrote the features from the name and the price, without the real spec sheet. Please confirm each of these
is true for Sentinel, or tell me what to change: **night vision**, **motion detection**, **phone alerts**,
**built-in alarm/siren**, **plug-in setup**, **no monthly fees / one-time price**.

## Edit it

All words, the price, the colours and the timings are in **`src/config.js`**.
Change the text there and re-render. You do not need to touch anything else.

Watch it live while you edit (it plays in real time and loops):

```sh
cd sentinel-ad
python3 -m http.server 8000
# open http://localhost:8000            (9:16)
# open http://localhost:8000/?w=1920&h=1080   (16:9)
```

Space pauses, the arrow keys scrub, and you can click the bar to jump.

## Render it

```sh
cd sentinel-ad
npm install playwright && npx playwright install chromium   # once
pip install numpy scipy                                       # once
./render/build.sh            # both formats (about 20 min each on 4 cores)
./render/build.sh 9x16       # just the vertical one
```

- **Picture:** `render/capture.mjs` drives headless Chromium frame by frame. Every output frame blends 4 sub-frames across a 180° shutter, which is real motion blur. The frames are encoded as H.264 at 60 fps.
- **Sound:** `render/soundtrack.py` synthesises the music and every sound effect from scratch (80 BPM, D minor lifting to F major for the price). It is timed to the same frames as the picture and loops with no click.

## How it is built

| Path | What it does |
| --- | --- |
| `src/config.js` | Copy, price, colours, notification text, HUD labels |
| `src/timeline.js` | The choreography: every moving value as a keyframe track |
| `src/scene.js` | Canvas renderer: ring, eye, device, viewfinder, phone, price badge, particles, bloom, grain |
| `src/text.js` | Kinetic typography: kerned letters that rise, focus and leave |
| `src/core.js` | Easing curves (CSS cubic-bézier), keyframes, seeded randomness |
| `render/` | Frame capture, soundtrack synthesis, build script |

Fonts: Inter Display, Inter and JetBrains Mono (SIL Open Font License, see `fonts/LICENSE.txt`).
