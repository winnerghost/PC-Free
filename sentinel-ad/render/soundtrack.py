#!/usr/bin/env python3
"""Soundtrack for the Sentinel film: synthesised from scratch, 36 s seamless loop.

80 BPM (beat = 0.75 s, bar = 3 s), D minor, lifting to F major for the price.
Every sound effect is placed on the same timeline as the picture.

Loop-safety:
  * every oscillator frequency is quantised to a multiple of 1/36 Hz, so it
    completes a whole number of cycles per loop;
  * the score is rendered twice and the second pass is kept, so reverb and
    delay tails from the end wrap round into the start;
  * every noise burst is seeded per event, so both passes are identical.

    python3 render/soundtrack.py out/soundtrack.wav
"""
import sys
import numpy as np
from scipy import signal

SR = 48000
T = 36.0
BEAT = 0.75
BAR = 3.0
STEP = BEAT / 4            # 16th note
NL = int(SR * T)           # samples per loop
N = NL * 2                 # render two loops, keep the second
t_all = np.arange(N) / SR


def q(f):
    """Loop-safe frequency: a whole number of cycles in T seconds."""
    return np.round(f * T) / T


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def rng(seed):
    return np.random.default_rng(seed)


def polyblep(ph, dt):
    out = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt
    out[m] = x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt
    out[m] = x * x + x + x + 1
    return out


def saw(freq, n=N, offset=0.0):
    dt = freq / SR
    ph = (offset + freq * np.arange(n) / SR) % 1.0
    return 2 * ph - 1 - polyblep(ph, dt)


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR * 0.45) / (SR / 2), 'low')
    return signal.lfilter(b, a, x, axis=-1)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x, axis=-1)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], 'band')
    return signal.lfilter(b, a, x, axis=-1)


def circ_smooth(x, sec):
    """Smooth a periodic control curve (loop-safe)."""
    k = max(3, int(sec * SR) | 1)
    w = np.hanning(k)
    w /= w.sum()
    pad = k // 2
    xx = np.concatenate([x[-pad:], x, x[:pad]])
    return signal.fftconvolve(xx, w, mode='valid')[: len(x)]


def curve(points, n=N):
    """Piecewise-linear periodic curve over one loop, tiled to n samples."""
    tt = np.arange(NL) / SR
    xs = [p[0] for p in points] + [T]
    ys = [p[1] for p in points] + [points[0][1]]
    c = np.interp(tt, xs, ys)
    return np.tile(c, n // NL)


# ── buses ─────────────────────────────────────────────────────────────────
mix = {k: np.zeros((2, N)) for k in ['pad', 'bass', 'arp', 'drums', 'fx', 'verb_send']}


def place(bus, x, at, gain=1.0, pan=0.0, send=0.0):
    """Add a mono or stereo one-shot at time `at` (seconds, both loops)."""
    if x.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * np.sqrt(2), x * r * np.sqrt(2)])
    for loop in range(2):
        s = int(round((at + loop * T) * SR))
        if s >= N:
            continue
        e = min(N, s + x.shape[1])
        if s < 0:
            continue
        mix[bus][:, s:e] += x[:, : e - s] * gain
        if send:
            mix['verb_send'][:, s:e] += x[:, : e - s] * gain * send


def env_exp(n, decay, attack=0.002):
    tt = np.arange(n) / SR
    a = np.clip(tt / attack, 0, 1) if attack > 0 else 1
    return a * np.exp(-tt * decay)


def tone(freq, dur, decay, harmonics=((1, 1.0),), attack=0.002, detune=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.zeros(n)
    for k, a in harmonics:
        x += a * np.sin(2 * np.pi * freq * k * (1 + detune) * tt)
    return x * env_exp(n, decay, attack)


def noise(dur, seed):
    return rng(seed).standard_normal(int(dur * SR))


# ── harmony ───────────────────────────────────────────────────────────────
CH = {
    'Dm9': [50, 57, 60, 64, 65], 'Bbmaj7': [46, 53, 57, 62, 65], 'Dm': [50, 57, 62, 65, 69],
    'Bb': [46, 53, 58, 62, 65], 'Gm': [43, 50, 55, 58, 62], 'A': [45, 52, 57, 61, 64],
    'C': [48, 55, 60, 64, 67], 'Fmaj7': [41, 53, 57, 60, 64], 'C/E': [52, 55, 60, 64, 67],
    'F': [41, 53, 57, 60, 65],
}
ROOT = {'Dm9': 38, 'Bbmaj7': 34, 'Dm': 38, 'Bb': 34, 'Gm': 31, 'A': 33, 'C': 36, 'Fmaj7': 29, 'C/E': 40, 'F': 29}
PROG = [  # (start, end, chord)
    (0.0, 3.0, 'Dm9'), (3.0, 6.0, 'Bbmaj7'), (6.0, 9.0, 'Dm'), (9.0, 12.0, 'Bb'), (12.0, 15.0, 'Gm'),
    (15.0, 18.0, 'A'), (18.0, 21.0, 'Dm'), (21.0, 22.5, 'Bb'), (22.5, 24.0, 'C'), (24.0, 27.0, 'Fmaj7'),
    (27.0, 30.0, 'C/E'), (30.0, 33.0, 'Bbmaj7'), (33.0, 35.25, 'F'), (35.25, 36.0, 'Dm9'),
]


def chord_at(tt):
    for a, b, c in PROG:
        if a <= tt < b:
            return c
    return PROG[-1][2]


# ── pad: continuous voices per pitch, legato across chords ────────────────
def build_pad():
    pitches = sorted({p for _, _, c in PROG for p in CH[c]})
    tt = np.arange(NL) / SR
    out = np.zeros((2, N))
    for p in pitches:
        ind = np.zeros(NL)
        for a, b, c in PROG:
            if p in CH[c]:
                ind[(tt >= a) & (tt < b)] = 1.0
        if not ind.any():
            continue
        env = np.tile(circ_smooth(ind, 0.55), 2)
        f = mtof(p)
        voices = []
        for det, pan in [(-0.0045, -0.8), (0.0, 0.0), (0.0052, 0.8)]:
            fq = q(f * (1 + det))
            v = saw(fq, offset=hash((p, det)) % 1000 / 1000.0)
            voices.append((v, pan))
        for v, pan in voices:
            l = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
            r = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
            out[0] += v * env * l / 3
            out[1] += v * env * r / 3
        # a soft sine an octave down gives body
        sub = np.sin(2 * np.pi * q(f / 2) * t_all) * env * 0.1
        out += sub
    dark, mid, bright = lp(out, 650), lp(out, 1500), lp(out, 3400)
    b = curve([(0, 0.15), (2.9, 0.2), (3.0, 0.7), (6.0, 0.95), (21.0, 1.0), (23.9, 1.8), (24.0, 2.0),
               (29.0, 2.0), (30.0, 1.1), (33.0, 0.9), (35.25, 0.35)])
    b = circ_smooth(b[:NL], 0.25)
    b = np.tile(b, 2)
    w_d = np.clip(1 - b, 0, 1)
    w_m = np.clip(1 - np.abs(b - 1), 0, 1)
    w_b = np.clip(b - 1, 0, 1)
    pad = hp(dark * w_d + mid * w_m + bright * w_b, 110)
    vol = curve([(0, 0.55), (2.9, 0.62), (3.0, 0.95), (5.8, 0.85), (6.0, 0.62), (21.0, 0.62), (23.95, 0.9),
                 (24.0, 0.9), (29.0, 0.85), (30.0, 0.8), (33.0, 0.75), (35.25, 0.6)])
    vol = np.tile(circ_smooth(vol[:NL], 0.2), 2)
    # slow stereo shimmer (period divides the loop)
    wob = 1 + 0.06 * np.sin(2 * np.pi * t_all / 9.0)
    mix['pad'] += pad * vol * wob


# ── drums ─────────────────────────────────────────────────────────────────
def kick(v=1.0, seed=1, big=False):
    dur = 0.9 if big else 0.55
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 44 + 120 * np.exp(-tt * 32) + 30 * np.exp(-tt * 6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-tt * (4.2 if big else 6.5))
    body = np.tanh(body * 1.6) / np.tanh(1.6)
    click = hp(noise(0.012, seed), 3000) * np.exp(-np.arange(int(0.012 * SR)) / SR * 300) * 0.35
    body[: len(click)] += click
    return body * v


def snare(v=1.0, seed=2, clap=True):
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    nz = bp(noise(0.5, seed), 900, 7000) * np.exp(-tt * 13)
    if clap:
        for k, d in enumerate([0.0, 0.011, 0.023]):
            s = int(d * SR)
            burst = bp(noise(0.03, seed + 10 + k), 1000, 5000) * np.exp(-np.arange(int(0.03 * SR)) / SR * 90)
            nz[s: s + len(burst)] += burst * 0.8
    body = np.sin(2 * np.pi * 185 * tt) * np.exp(-tt * 22) * 0.5
    return (nz * 0.8 + body) * v


def hat(v=1.0, seed=3, open_=False):
    dur = 0.32 if open_ else 0.06
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = hp(noise(dur, seed), 7500, 3) * np.exp(-tt * (12 if open_ else 70))
    return x * v


def build_drums():
    r = rng(42)
    for bar in range(12):
        b0 = bar * BAR
        groove = 2 <= bar <= 9
        for st in range(16):
            ts = b0 + st * STEP
            # kicks
            if groove and st in (0, 8, 10) and not (bar == 7 and st >= 8):
                place('drums', kick(1.0 if st != 10 else 0.75, seed=1000 + bar * 16 + st), ts, 0.9)
            # snare / clap on 2 and 4
            if groove and st in (4, 12) and not (bar == 7 and st >= 8):
                place('drums', snare(0.85, seed=2000 + bar * 16 + st), ts, 0.55, pan=0.05, send=0.25)
            # hats: 8ths in bar 2, 16ths from bar 3
            if 2 <= bar <= 9:
                if bar == 2 and st % 2:
                    continue
                vel = (0.55 if st % 4 == 0 else 0.42 if st % 2 == 0 else 0.3) * (0.9 + 0.2 * r.random())
                op = st in (6, 14) and bar >= 3
                place('drums', hat(vel, seed=3000 + bar * 16 + st, open_=op), ts, 0.22 if not op else 0.16,
                      pan=0.25 if st % 2 else -0.15)
    # snare roll into the drop
    tt = 22.5
    k = 0
    while tt < 24.0 - 1e-6:
        prog = (tt - 22.5) / 1.5
        place('drums', snare(0.3 + 0.6 * prog, seed=5000 + k, clap=False), tt, 0.5, send=0.2)
        tt += STEP if tt < 23.25 else STEP / 2
        k += 1
    # big hits
    place('drums', kick(1.25, seed=7001, big=True), 24.0, 1.0)
    place('drums', kick(0.8, seed=7002, big=True), 32.25, 0.7)
    place('drums', kick(0.55, seed=7003), 30.0, 0.6)
    # heartbeat in the dark (intro)
    for ts in (0.0, 0.32, 1.5, 1.82):
        hb = kick(0.5, seed=7100 + int(ts * 100))
        place('drums', lp(hb, 160), ts, 0.55)


# ── bass ──────────────────────────────────────────────────────────────────
def build_bass():
    tt = np.arange(NL) / SR
    for p in sorted(set(ROOT.values())):
        ind = np.zeros(NL)
        for a, b, c in PROG:
            if ROOT[c] == p and (6.0 <= a < 30.0 or 32.25 <= a < 35.25 or (a == 33.0)):
                ind[(tt >= a) & (tt < b)] = 1.0
        if not ind.any():
            continue
        env = np.tile(circ_smooth(ind, 0.12), 2)
        f = q(mtof(p))
        x = np.sin(2 * np.pi * f * t_all) + 0.28 * np.sin(2 * np.pi * 2 * f * t_all) + 0.1 * np.sin(2 * np.pi * 3 * f * t_all)
        x = np.tanh(x * 1.3) * env
        mix['bass'] += np.stack([x, x]) * 0.36


def sidechain():
    """Duck pad and bass under the kick (loop-safe envelope)."""
    d = np.zeros(NL)
    tt = np.arange(NL) / SR
    hits = []
    for bar in range(2, 10):
        for st in (0, 8, 10):
            if bar == 7 and st >= 8:
                continue
            hits.append(bar * BAR + st * STEP)
    hits += [24.0, 32.25]
    for h in hits:
        s = int(h * SR)
        n = int(0.45 * SR)
        e = np.exp(-np.arange(n) / SR * 9)
        idx = (s + np.arange(n)) % NL
        d[idx] = np.maximum(d[idx], e)
    g = 1 - 0.55 * circ_smooth(d, 0.006)
    g = np.tile(g, 2)
    mix['pad'] *= g
    mix['bass'] *= g


# ── arpeggio (plucks + ping-pong delay) ───────────────────────────────────
def pluck(freq, v=1.0, dur=0.45):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.zeros(n)
    for k in range(1, 9):
        x += (1.0 / k) * np.exp(-tt * (7 + 5.5 * k)) * np.sin(2 * np.pi * freq * k * tt + k)
    x *= np.clip(tt / 0.003, 0, 1)
    return x * v


def build_arp():
    pattern = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 3, 1, 4, 2, 3]
    r = rng(7)
    for bar in range(2, 10):
        for st in range(16):
            ts = bar * BAR + st * STEP
            if bar == 2 and st < 8:
                continue
            if bar == 7 and st >= 8:  # breathe before the drop
                continue
            c = CH[chord_at(ts + 0.001)]
            notes = sorted(c)[1:5] if len(c) > 4 else sorted(c)
            p = notes[pattern[st] % len(notes)] + 12
            v = (0.9 if st % 4 == 0 else 0.62) * (0.88 + 0.24 * r.random())
            place('arp', pluck(q(mtof(p)), v), ts, 0.16, pan=(-0.35 if st % 2 else 0.35), send=0.25)
    # ping-pong dotted-eighth delay
    src = mix['arp'].copy()
    dl = int(round(STEP * 3 * SR))
    for k in range(1, 6):
        g = 0.42 ** k
        sh = np.roll(src, dl * k, axis=1)
        sh = lp(sh, 3800)
        if k % 2:
            mix['arp'][0] += sh[1] * g
            mix['arp'][1] += sh[0] * g
        else:
            mix['arp'] += sh * g


# ── the picture's easing curves (ported from src/core.js) so ticks land on frames ──
def bezier(x1, y1, x2, y2):
    cx = 3 * x1; bx = 3 * (x2 - x1) - cx; ax = 1 - cx - bx
    cy = 3 * y1; by = 3 * (y2 - y1) - cy; ay = 1 - cy - by
    def f(x):
        lo, hi = 0.0, 1.0
        for _ in range(60):
            m = (lo + hi) / 2
            if ((ax * m + bx) * m + cx) * m < x: lo = m
            else: hi = m
        m = (lo + hi) / 2
        return ((ay * m + by) * m + cy) * m
    return f


ease_inout = bezier(0.65, 0, 0.35, 1)


def out_back_soft(x):
    c1, c3 = 0.9, 1.9
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def crossings(fn, t0, t1, step=1 / 4800):
    """Times where floor(fn(t)) changes."""
    out = []
    prev = np.floor(fn(t0))
    tt = t0
    while tt < t1:
        tt += step
        v = np.floor(fn(tt))
        if v != prev:
            out.append(tt)
            prev = v
    return out


# ── sound design ──────────────────────────────────────────────────────────
def whoosh(dur, seed, up=True, lo=300, hi=5000):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = noise(dur, seed)
    # sweep a band by blending fixed bands (cheap, smooth)
    bands = [bp(x, f * 0.7, f * 1.4) for f in np.geomspace(lo, hi, 7)]
    pos = (tt / dur) if up else (1 - tt / dur)
    pos = np.clip(pos, 0, 1) * (len(bands) - 1)
    y = np.zeros(n)
    for i, b in enumerate(bands):
        y += b * np.clip(1 - np.abs(pos - i), 0, 1)
    shape = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 1.6
    y *= shape
    pan = np.sin(np.linspace(-1.2, 1.2, n))
    return np.stack([y * (1 - 0.5 * pan), y * (1 + 0.5 * pan)])


def riser(dur, seed):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = whoosh(dur, seed, up=True, lo=400, hi=9000)
    env = (tt / dur) ** 2.2
    tone_ = saw(q(110), n) * 0 + np.sin(2 * np.pi * np.cumsum(220 + 660 * (tt / dur) ** 2) / SR) * 0.25
    y = x * env + np.stack([tone_, tone_]) * env * 0.5
    return y


def impact(seed, size=1.0):
    dur = 3.2
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = 30 + 55 * np.exp(-tt * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.4)
    crack = lp(noise(dur, seed), 2400) * np.exp(-tt * 9) * 0.7
    metal = sum(np.sin(2 * np.pi * fr * tt + i) * np.exp(-tt * (2.2 + i)) for i, fr in enumerate([523, 791, 1187, 1601])) * 0.08
    x = np.tanh((boom * 1.5 + crack + metal) * 1.2) * size
    return x


def click(freq, dur=0.05, decay=120, seed=0, noise_amt=0.3):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * tt) * np.exp(-tt * decay)
    x += hp(noise(dur, seed), 2500) * np.exp(-tt * decay * 2.2) * noise_amt
    return x


def bell(freq, dur=1.4, decay=3.0, bright=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * 1.41 * tt) * 2.2 * bright * np.exp(-tt * 6)
    x = np.sin(2 * np.pi * freq * tt + mod) * np.exp(-tt * decay)
    x += 0.35 * np.sin(2 * np.pi * freq * 2.0 * tt) * np.exp(-tt * decay * 1.8)
    return x * np.clip(tt / 0.002, 0, 1)


def beep(freq, dur=0.09):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * freq * tt)) * 0.5 + np.sin(2 * np.pi * freq * tt) * 0.5
    e = np.clip(tt / 0.004, 0, 1) * np.clip((dur - tt) / 0.012, 0, 1)
    return lp(x * e, 5000)


def servo(dur=0.18, f0=900, f1=1500, seed=0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * np.sin(np.pi / 2 * tt / dur)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + bp(noise(dur, seed), 1500, 6000) * 0.5
    return x * np.sin(np.pi * tt / dur) ** 2


def build_fx():
    # clock ticks on the beat (opening, and the loop-in)
    for k, ts in enumerate([0.0, 0.75, 1.5, 2.25, 35.25]):
        place('fx', click(2600 if k % 2 == 0 else 2100, decay=160, seed=100 + k), ts, 0.38, pan=0.1, send=0.25)
    # low drone in the dark
    drone_n = int(3.2 * SR)
    tt = np.arange(drone_n) / SR
    dr = np.sin(2 * np.pi * q(36.71) * tt) * np.sin(np.pi * np.clip(tt / 3.2, 0, 1)) ** 0.7
    place('fx', dr, 0.0, 0.11)
    # eyelid swish down, riser, then the eye snaps open
    place('fx', whoosh(0.55, 11, up=False, lo=500, hi=4000), 2.42, 0.25, send=0.3)
    place('fx', riser(1.25, 12), 1.75, 0.35)
    place('fx', impact(13), 3.0, 0.9, send=0.5)
    place('fx', bell(q(mtof(81)), 2.5, 1.2), 3.0, 0.07, pan=-0.3, send=0.6)
    place('fx', bell(q(mtof(88)), 2.5, 1.4), 3.04, 0.05, pan=0.3, send=0.6)
    # the eye glances around: tiny servos
    for i, ts in enumerate([3.9, 4.58, 5.16]):
        place('fx', servo(0.16, 800 + 120 * i, 1350 + 100 * i, seed=20 + i), ts - 0.02, 0.13, pan=(-0.5, 0.5, 0)[i])
    # pull back reveal
    place('fx', whoosh(2.1, 21, up=False, lo=200, hi=3500), 5.5, 0.4, send=0.3)
    # LEDs pop on, one by one
    for i in range(8):
        place('fx', click(3200 + 140 * i, dur=0.06, decay=90, seed=30 + i, noise_amt=0.1), 6.5 + i * 0.1, 0.13, pan=np.sin(i) * 0.6, send=0.35)
    # night vision powers up
    n = int(0.9 * SR)
    tt = np.arange(n) / SR
    hum = np.sin(2 * np.pi * np.cumsum(120 + 500 * (tt / 0.9) ** 2) / SR) * np.sin(np.pi * tt / 0.9) * 0.6
    place('fx', hum, 7.6, 0.12, send=0.3)
    # dive into the lens
    place('fx', whoosh(1.1, 22, up=True, lo=250, hi=6000), 8.75, 0.42, send=0.3)
    # sonar pings each radar sweep
    for i, ts in enumerate([9.3, 11.7, 14.1]):
        place('fx', bell(q(1396.9), 1.6, 3.5, bright=0.3), ts, (0.16, 0.11, 0.08)[i], pan=0.2, send=0.7)
    # intruder: detection beeps, lock-on, typing
    place('fx', beep(880), 12.25, 0.17)
    place('fx', beep(1318.5), 12.38, 0.17)
    place('fx', click(1800, dur=0.08, decay=60, seed=40, noise_amt=0.5), 12.78, 0.3, send=0.2)
    for i in range(15):
        place('fx', click(4200, dur=0.02, decay=400, seed=50 + i, noise_amt=0.6), 12.6 + i * 0.04, 0.06)
    # the ring becomes your phone
    place('fx', whoosh(0.95, 23, up=True, lo=300, hi=5000), 14.5, 0.32, send=0.3)
    # notification chime + vibration
    place('fx', bell(q(1318.5), 1.2, 4.0, bright=0.6), 15.92, 0.2, send=0.4)
    place('fx', bell(q(1975.5), 1.2, 4.0, bright=0.6), 16.06, 0.17, send=0.4)
    n = int(0.48 * SR)
    tt = np.arange(n) / SR
    buzz = np.sign(np.sin(2 * np.pi * 150 * tt)) * (0.5 + 0.5 * np.sin(2 * np.pi * 30 * tt)) * np.exp(-tt * 3)
    place('fx', lp(buzz, 600), 16.02, 0.1)
    # back to the device
    place('fx', whoosh(0.9, 24, up=False, lo=250, hi=4500), 17.55, 0.3, send=0.3)
    # alarm: a rising whoop on every pulse
    for k in range(7):
        ts = 18.0 + k * 0.375
        n = int(0.36 * SR)
        tt = np.arange(n) / SR
        f = 620 + 520 * (tt / 0.36)
        w = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
        w *= np.clip(tt / 0.01, 0, 1) * np.clip((0.36 - tt) / 0.04, 0, 1)
        place('fx', lp(w, 2600), ts, 0.075, pan=(-0.4 if k % 2 else 0.4), send=0.35)
    # all clear
    for i, m in enumerate([77, 81, 84]):
        place('fx', bell(q(mtof(m)), 1.5, 2.6, bright=0.4), 20.5 + i * 0.09, 0.08, pan=(-0.3, 0, 0.3)[i], send=0.5)
    # arming: 36 rising blips, then a confirmation
    arm_times = crossings(lambda tt: 36 * ease_inout(min(1, max(0, (tt - 21.05) / 1.4))) + 1e-9, 21.0, 22.5)
    for i, ts in enumerate(arm_times[:36]):
        place('fx', click(1200 + 45 * i, dur=0.04, decay=150, seed=60 + i, noise_amt=0.05), ts, 0.05, pan=np.sin(i / 36 * 2 * np.pi) * 0.6)
    place('fx', beep(1046.5, 0.08), 22.45, 0.12, send=0.3)
    place('fx', beep(1568.0, 0.14), 22.55, 0.12, send=0.3)
    # build into the price
    place('fx', riser(1.5, 25), 22.5, 0.4)
    place('fx', whoosh(0.9, 26, up=True, lo=300, hi=7000), 23.3, 0.3)
    place('fx', impact(27, 1.0), 24.0, 0.85, send=0.5)
    # shimmer when the price lands
    for i, m in enumerate([84, 88, 91, 96]):
        place('fx', bell(q(mtof(m)), 2.2, 2.0, bright=0.5), 24.0 + i * 0.06, 0.05, pan=(-0.5, -0.15, 0.15, 0.5)[i], send=0.6)
    # odometer: ticks that slow down as each digit settles
    for d in range(4):
        t0 = 24.18 + d * 0.11
        rolls = 9 + d * 3
        pos = lambda tt, t0=t0, rolls=rolls: rolls * (1 - out_back_soft(min(1, max(0, (tt - t0) / 0.8))))
        for j, ts in enumerate(crossings(pos, t0, t0 + 0.8)):
            place('fx', click(5200 - d * 300, dur=0.015, decay=500, seed=200 + d * 40 + j, noise_amt=0.8), ts, 0.035, pan=-0.3 + 0.2 * d)
        place('fx', click(2400 - d * 120, dur=0.08, decay=70, seed=300 + d, noise_amt=0.2), t0 + 0.8, 0.12, pan=-0.3 + 0.2 * d, send=0.3)
    # shine sweep
    place('fx', whoosh(0.8, 28, up=True, lo=3000, hi=12000), 25.45, 0.12)
    # pull back to the product, credit, end card
    place('fx', whoosh(1.2, 29, up=False, lo=200, hi=4000), 29.0, 0.36, send=0.3)
    place('fx', bell(q(mtof(70)), 2.8, 1.3, bright=0.3), 29.55, 0.07, send=0.6)
    place('fx', bell(q(mtof(74)), 2.8, 1.3, bright=0.3), 29.6, 0.06, send=0.6)
    place('fx', impact(30, 0.6), 32.25, 0.5, send=0.5)
    for i, m in enumerate([77, 81, 84, 89]):
        place('fx', bell(q(mtof(m)), 2.0, 2.2, bright=0.4), 32.3 + i * 0.07, 0.05, pan=(-0.4, -0.1, 0.1, 0.4)[i], send=0.6)
    place('fx', click(900, dur=0.1, decay=40, seed=400, noise_amt=0.1), 33.3, 0.12, send=0.3)   # CTA pops in
    # dive back into the clock
    place('fx', whoosh(0.85, 31, up=True, lo=250, hi=5000), 35.15, 0.32, send=0.3)


# ── reverb ────────────────────────────────────────────────────────────────
def reverb(x, rt=2.4, seed=99):
    n = int(rt * 1.4 * SR)
    tt = np.arange(n) / SR
    r = rng(seed)
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)]) * np.exp(-tt * 6.9 / rt)
    ir = lp(ir, 5200)
    ir[:, : int(0.012 * SR)] *= 0.0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    out = np.stack([signal.fftconvolve(x[0], ir[0])[:N], signal.fftconvolve(x[1], ir[1])[:N]])
    return out


def main(path):
    build_pad()
    build_bass()
    build_drums()
    build_arp()
    build_fx()
    sidechain()
    send = mix['verb_send'] + 0.18 * mix['pad'] + 0.12 * mix['arp']
    wet = reverb(send)
    bus = (mix['pad'] * 0.5 + mix['bass'] * 0.85 + mix['drums'] * 0.8 + mix['arp'] * 0.75 + mix['fx'] * 1.0 + wet * 0.32)
    bus = hp(bus, 30)
    ride = curve([(0, 0.72), (2.95, 0.8), (3.0, 1.0), (5.8, 0.9), (6.0, 0.92), (21.0, 0.92), (23.95, 1.0),
                  (24.0, 1.08), (28.9, 1.0), (29.25, 0.82), (32.2, 0.82), (32.25, 0.95), (35.2, 0.86), (35.25, 0.74)])
    ride = np.tile(circ_smooth(ride[:NL], 0.05), 2)
    bus = bus * ride
    y = bus[:, NL:]                      # keep the second loop: tails have wrapped round
    # gentle bus compression (soft knee) + limiter
    rms = np.sqrt(np.mean(y ** 2))
    y = y / (rms * 5.2)                  # around -14 dBFS RMS before limiting
    y = np.tanh(y * 1.05) / np.tanh(1.05)
    peak = np.max(np.abs(y))
    y = y / peak * 0.891                 # -1 dBFS
    # loop check: the jump from the last sample to the first should be tiny
    seam = np.max(np.abs(y[:, -1] - y[:, 0]))
    step = np.percentile(np.abs(np.diff(y, axis=1)), 99.9)
    print(f'loop seam jump {seam:.4f} (99.9th pct sample step {step:.4f})')
    from scipy.io import wavfile
    wavfile.write(path, SR, (y.T * 32767).astype(np.int16))
    print('wrote', path, f'{y.shape[1] / SR:.2f}s')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav')
