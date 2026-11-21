#!/usr/bin/env python3
"""Score and sound design for the Sentinel teaser, synthesised from scratch.

40 s seamless loop, 96 BPM (beat 0.625 s, bar 2.5 s), D minor lifting to F.
Every effect sits on the picture's timeline (src/timeline.js, src/config.js).

Loop-safety: oscillators are tuned to whole cycles per loop, the score is
rendered twice and the second pass kept (tails wrap into the start), and
every noise burst is seeded per event so both passes are identical.

    python3 render/soundtrack.py out/soundtrack.wav
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
T = 40.0
BEAT = 0.625
BAR = 2.5
STEP = BEAT / 4
NL = int(SR * T)
N = NL * 2
t_all = np.arange(N) / SR

def q(f): return np.round(f * T) / T
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12.0)
def rng(seed): return np.random.default_rng(seed)

def polyblep(ph, dt):
    out = np.zeros_like(ph)
    m = ph < dt; x = ph[m] / dt; out[m] = x + x - x * x - 1
    m = ph > 1 - dt; x = (ph[m] - 1) / dt; out[m] = x * x + x + x + 1
    return out

def saw(freq, n=N, offset=0.0):
    ph = (offset + freq * np.arange(n) / SR) % 1.0
    return 2 * ph - 1 - polyblep(ph, freq / SR)

def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR * 0.45) / (SR / 2), 'low'); return signal.lfilter(b, a, x, axis=-1)
def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high'); return signal.lfilter(b, a, x, axis=-1)
def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], 'band'); return signal.lfilter(b, a, x, axis=-1)

def circ_smooth(x, sec):
    k = max(3, int(sec * SR) | 1)
    w = np.hanning(k); w /= w.sum(); pad = k // 2
    return signal.fftconvolve(np.concatenate([x[-pad:], x, x[:pad]]), w, mode='valid')[: len(x)]

def curve(points):
    tt = np.arange(NL) / SR
    xs = [p[0] for p in points] + [T]; ys = [p[1] for p in points] + [points[0][1]]
    return np.interp(tt, xs, ys)

mix = {k: np.zeros((2, N)) for k in ['pad', 'bass', 'arp', 'drums', 'fx', 'verb']}

def place(bus, x, at, gain=1.0, pan=0.0, send=0.0):
    if x.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2); r = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        x = np.stack([x * l, x * r])
    for loop in range(2):
        s = int(round((at + loop * T) * SR))
        if s < 0 or s >= N: continue
        e = min(N, s + x.shape[1])
        mix[bus][:, s:e] += x[:, : e - s] * gain
        if send: mix['verb'][:, s:e] += x[:, : e - s] * gain * send

def env_exp(n, decay, attack=0.002):
    tt = np.arange(n) / SR
    return (np.clip(tt / attack, 0, 1) if attack > 0 else 1) * np.exp(-tt * decay)

def noise(dur, seed): return rng(seed).standard_normal(int(dur * SR))

# ── harmony ───────────────────────────────────────────────────────────────
CH = {
    'Dm9': [50, 57, 60, 64, 65], 'Bbmaj7': [46, 53, 57, 62, 65], 'Gm9': [43, 50, 57, 58, 62], 'F9': [41, 53, 57, 60, 67],
    'Dm': [50, 57, 62, 65, 69], 'Bb': [46, 53, 58, 62, 65], 'F': [41, 53, 57, 60, 65], 'C': [48, 55, 60, 64, 67],
    'C/E': [52, 55, 60, 64, 67], 'Gm7': [43, 50, 53, 58, 62],
}
ROOT = {'Dm9': 38, 'Bbmaj7': 34, 'Gm9': 31, 'F9': 29, 'Dm': 38, 'Bb': 34, 'F': 29, 'C': 36, 'C/E': 40, 'Gm7': 31}
PROG = [(0.0, 2.5, 'Dm9'), (2.5, 5.0, 'Bbmaj7'), (5.0, 7.5, 'Gm9'), (7.5, 10.0, 'F9'), (10.0, 12.5, 'Dm'), (12.5, 15.0, 'Bb'),
        (15.0, 17.5, 'F'), (17.5, 20.0, 'C'), (20.0, 22.5, 'Dm'), (22.5, 23.75, 'Bb'), (23.75, 25.0, 'C'), (25.0, 26.25, 'Bb'),
        (26.25, 27.5, 'F'), (27.5, 30.0, 'C/E'), (30.0, 32.5, 'Dm'), (32.5, 35.0, 'Bb'), (35.0, 37.5, 'Gm7'),
        (37.5, 39.375, 'Bbmaj7'), (39.375, 40.0, 'Dm9')]

def chord_at(tt):
    for a, b, c in PROG:
        if a <= tt < b: return c
    return PROG[-1][2]

def build_pad():
    pitches = sorted({p for _, _, c in PROG for p in CH[c]})
    tt = np.arange(NL) / SR
    out = np.zeros((2, N))
    for p in pitches:
        ind = np.zeros(NL)
        for a, b, c in PROG:
            if p in CH[c]: ind[(tt >= a) & (tt < b)] = 1.0
        env = np.tile(circ_smooth(ind, 0.5), 2)
        f = mtof(p)
        for det, pan in [(-0.005, -0.85), (0.0, 0.0), (0.0055, 0.85)]:
            v = saw(q(f * (1 + det)), offset=(p * 0.37 + det * 100) % 1)
            out[0] += v * env * np.cos((pan + 1) * np.pi / 4) * np.sqrt(2) / 3
            out[1] += v * env * np.sin((pan + 1) * np.pi / 4) * np.sqrt(2) / 3
    dark, mid, bright = lp(out, 600), lp(out, 1400), lp(out, 3600)
    b = np.tile(circ_smooth(curve([(0, 0.1), (7.4, 0.35), (7.5, 0.9), (10.0, 0.95), (24.9, 1.2), (26.25, 2.0), (34.5, 1.8),
                                   (35.0, 0.9), (37.5, 1.0), (39.9, 0.2)]), 0.2), 2)
    pad = dark * np.clip(1 - b, 0, 1) + mid * np.clip(1 - np.abs(b - 1), 0, 1) + bright * np.clip(b - 1, 0, 1)
    pad = hp(pad, 120)
    vol = np.tile(circ_smooth(curve([(0, 0.5), (7.4, 0.62), (7.5, 0.95), (9.9, 0.8), (10.0, 0.55), (24.9, 0.7), (26.25, 1.0),
                                     (34.4, 0.95), (35.0, 0.6), (37.5, 0.85), (39.9, 0.5)]), 0.15), 2)
    mix['pad'] += pad * vol * (1 + 0.05 * np.sin(2 * np.pi * t_all / 10.0))

# ── drums ─────────────────────────────────────────────────────────────────
def kick(v=1.0, seed=1, big=False):
    dur = 1.1 if big else 0.5
    n = int(dur * SR); tt = np.arange(n) / SR
    f = 42 + 130 * np.exp(-tt * 34) + 26 * np.exp(-tt * 6)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * (3.2 if big else 6.8))
    body = np.tanh(body * 1.7) / np.tanh(1.7)
    c = hp(noise(0.01, seed), 3500) * np.exp(-np.arange(int(0.01 * SR)) / SR * 320) * 0.3
    body[: len(c)] += c
    return body * v

def clap(v=1.0, seed=2):
    n = int(0.45 * SR); tt = np.arange(n) / SR
    x = bp(noise(0.45, seed), 1100, 6500) * np.exp(-tt * 15) * 0.7
    for k, d in enumerate([0.0, 0.01, 0.021]):
        s = int(d * SR); bn = int(0.028 * SR)
        x[s:s + bn] += bp(noise(0.028, seed + 10 + k), 1200, 5000) * np.exp(-np.arange(bn) / SR * 95)
    return x * v

def hat(v=1.0, seed=3, open_=False):
    dur = 0.3 if open_ else 0.05
    n = int(dur * SR); tt = np.arange(n) / SR
    return hp(noise(dur, seed), 7800, 3) * np.exp(-tt * (13 if open_ else 85)) * v

def shaker(v, seed):
    n = int(0.09 * SR); tt = np.arange(n) / SR
    return bp(noise(0.09, seed), 5000, 11000) * np.sin(np.pi * np.clip(tt / 0.09, 0, 1)) ** 2 * v

def build_drums():
    r = rng(42)
    for bar in range(16):
        b0 = bar * BAR
        for st in range(16):
            ts = b0 + st * STEP
            groove = 10.0 <= ts < 25.0 and not (10.95 <= ts < 12.1)
            lift = 26.25 <= ts < 34.4
            if groove:
                if st in (0, 6, 10): place('drums', kick(1.0 if st == 0 else 0.8, 1000 + bar * 16 + st), ts, 0.85)
                if st in (4, 12): place('drums', clap(0.85, 2000 + bar * 16 + st), ts, 0.5, pan=0.05, send=0.25)
                vel = (0.5 if st % 4 == 0 else 0.4 if st % 2 == 0 else 0.28) * (0.9 + 0.2 * r.random())
                place('drums', hat(vel, 3000 + bar * 16 + st, open_=(st in (2, 14))), ts, 0.2 if st not in (2, 14) else 0.13, pan=0.25 if st % 2 else -0.15)
                if st % 2: place('drums', shaker(0.5, 4000 + bar * 16 + st), ts + 0.012, 0.12, pan=-0.35)
            elif lift:
                if st in (0, 10): place('drums', kick(0.85, 5000 + bar * 16 + st), ts, 0.7)
                if st in (2, 6, 10, 14): place('drums', hat(0.45, 6000 + bar * 16 + st, open_=True), ts, 0.11, pan=0.3, send=0.2)
                if st % 2 == 0: place('drums', shaker(0.6, 6500 + bar * 16 + st), ts, 0.1, pan=-0.3)
    # heartbeat in the dark (act 1) and before the loop
    for b in range(3):
        for off, v in ((0.0, 0.55), (0.28, 0.38)):
            place('drums', lp(kick(v, 7100 + b * 2 + int(off * 10)), 150), b * BAR + off, 0.6)
    # timelapse: clock ticks that speed up with the days
    tt, k = 20.0, 0
    while tt < 24.9:
        place('fx', click(3400 if k % 2 else 2800, dur=0.03, decay=260, seed=7300 + k, noise_amt=0.5), tt, 0.1, pan=(0.3 if k % 2 else -0.3))
        tt += max(0.06, 0.32 * np.exp(-(tt - 20.0) * 0.55)); k += 1

def build_bass():
    tt = np.arange(NL) / SR
    for p in sorted(set(ROOT.values())):
        ind = np.zeros(NL)
        for a, b, c in PROG:
            if ROOT[c] == p and (7.5 <= a < 35.0): ind[(tt >= a) & (tt < b)] = 1.0
        if not ind.any(): continue
        env = np.tile(circ_smooth(ind, 0.1), 2)
        f = q(mtof(p))
        x = np.sin(2 * np.pi * f * t_all) + 0.3 * np.sin(4 * np.pi * f * t_all) + 0.08 * np.sin(6 * np.pi * f * t_all)
        # eighth-note pulse in the groove sections
        pulse = np.ones(N)
        gm = ((t_all % T) >= 10.0) & ((t_all % T) < 34.4)
        ph = (t_all % (BEAT / 2)) / (BEAT / 2)
        pulse[gm] = (0.45 + 0.55 * np.exp(-ph[gm] * 5))
        mix['bass'] += np.stack([np.tanh(x * 1.2) * env * pulse] * 2) * 0.34

def sidechain():
    d = np.zeros(NL)
    hits = [bar * BAR + st * STEP for bar in range(16) for st in (0, 6, 10) if 10.0 <= bar * BAR + st * STEP < 25.0]
    hits += [bar * BAR + st * STEP for bar in range(16) for st in (0, 10) if 26.25 <= bar * BAR + st * STEP < 34.4]
    hits += [7.5, 26.25, 35.95, 37.7]
    for h in hits:
        s = int(h * SR); n = int(0.4 * SR)
        idx = (s + np.arange(n)) % NL
        d[idx] = np.maximum(d[idx], np.exp(-np.arange(n) / SR * 9))
    g = np.tile(1 - 0.5 * circ_smooth(d, 0.006), 2)
    mix['pad'] *= g; mix['bass'] *= g

# ── melodic voices ────────────────────────────────────────────────────────
def pluck(freq, v=1.0, dur=0.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = sum((1.0 / k) * np.exp(-tt * (6 + 5 * k)) * np.sin(2 * np.pi * freq * k * tt + k) for k in range(1, 9))
    return x * np.clip(tt / 0.003, 0, 1) * v

def bell(freq, dur=1.6, decay=2.6, bright=0.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * 1.41 * tt) * 2.2 * bright * np.exp(-tt * 6)
    x = np.sin(2 * np.pi * freq * tt + mod) * np.exp(-tt * decay) + 0.3 * np.sin(2 * np.pi * freq * 2 * tt) * np.exp(-tt * decay * 1.8)
    return x * np.clip(tt / 0.002, 0, 1)

def piano(freq, v=1.0, dur=2.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = np.zeros(n)
    for k in range(1, 10):
        fk = freq * k * np.sqrt(1 + 0.0004 * k * k)
        x += (0.8 ** k) * np.sin(2 * np.pi * fk * tt + k * 0.7) * np.exp(-tt * (1.1 + 0.9 * k))
    return lp(x * np.clip(tt / 0.004, 0, 1), 5200) * v

def build_melody():
    # act 1: one quiet piano phrase per line ("It sees" / "It listens" / "It never sleeps")
    for t0, notes in ((0.75, [74, 77, 81]), (3.0, [72, 76, 79]), (5.45, [74, 77, 81, 84])):
        for i, m in enumerate(notes):
            place('arp', piano(q(mtof(m)), 0.7 - i * 0.08), t0 + i * BEAT * 0.5, 0.22, pan=(-0.2 + i * 0.15), send=0.45)
    # groove arpeggio (gate act)
    pat = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 3, 1, 4, 2, 3]
    r = rng(7)
    for bar in range(4, 10):
        for st in range(16):
            ts = bar * BAR + st * STEP
            if 10.95 <= ts < 12.1: continue
            notes = sorted(CH[chord_at(ts + 0.001)])[1:5]
            v = (0.85 if st % 4 == 0 else 0.6) * (0.88 + 0.24 * r.random())
            place('arp', pluck(q(mtof(notes[pat[st] % 4] + 12)), v), ts, 0.13, pan=(-0.35 if st % 2 else 0.35), send=0.22)
    # globe & cloud: shimmering arpeggio an octave up
    for bar in range(10, 14):
        for st in range(0, 16, 2):
            ts = bar * BAR + st * STEP
            if ts < 26.25 or ts >= 34.4: continue
            notes = sorted(CH[chord_at(ts + 0.001)])[1:5]
            place('arp', bell(q(mtof(notes[(st // 2) % 4] + 24)), 1.2, 3.2, 0.35), ts, 0.07, pan=np.sin(st) * 0.5, send=0.5)
    # credit + end card: warm piano chords
    for t0, ch in ((35.95, 'Gm7'), (37.7, 'Bbmaj7')):
        for i, m in enumerate(sorted(CH[ch])[1:]):
            place('arp', piano(q(mtof(m + 12)), 0.55, 3.0), t0 + i * 0.03, 0.16, pan=(-0.3 + i * 0.2), send=0.55)
    src = mix['arp'].copy()
    dl = int(round(STEP * 3 * SR))
    for k in range(1, 5):
        sh = lp(np.roll(src, dl * k, axis=1), 3600) * 0.38 ** k
        if k % 2: mix['arp'][0] += sh[1]; mix['arp'][1] += sh[0]
        else: mix['arp'] += sh

# ── sound design ──────────────────────────────────────────────────────────
def click(freq, dur=0.05, decay=120, seed=0, noise_amt=0.3):
    n = int(dur * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * tt) * np.exp(-tt * decay) + hp(noise(dur, seed), 2500) * np.exp(-tt * decay * 2.2) * noise_amt

def whoosh(dur, seed, up=True, lo=300, hi=5000):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = noise(dur, seed)
    bands = [bp(x, f * 0.7, f * 1.4) for f in np.geomspace(lo, hi, 7)]
    pos = np.clip(tt / dur if up else 1 - tt / dur, 0, 1) * (len(bands) - 1)
    y = sum(b * np.clip(1 - np.abs(pos - i), 0, 1) for i, b in enumerate(bands))
    y *= np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 1.6
    pan = np.sin(np.linspace(-1.2, 1.2, n))
    return np.stack([y * (1 - 0.5 * pan), y * (1 + 0.5 * pan)])

def riser(dur, seed):
    n = int(dur * SR); tt = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(200 + 700 * (tt / dur) ** 2) / SR) * 0.22
    return whoosh(dur, seed, True, 400, 9000) * (tt / dur) ** 2.2 + np.stack([tone, tone]) * (tt / dur) ** 2.2 * 0.5

def impact(seed, size=1.0):
    n = int(3.4 * SR); tt = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(28 + 60 * np.exp(-tt * 8)) / SR) * np.exp(-tt * 1.3)
    crack = lp(noise(3.4, seed), 2600) * np.exp(-tt * 9) * 0.6
    metal = sum(np.sin(2 * np.pi * fr * tt + i) * np.exp(-tt * (2 + i)) for i, fr in enumerate([523, 787, 1182, 1607])) * 0.06
    return np.tanh((boom * 1.5 + crack + metal) * 1.15) * size

def knock(seed):
    """A knuckle on an aluminium gate: a hollow thump with metallic ring."""
    n = int(0.7 * SR); tt = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(165 + 90 * np.exp(-tt * 60)) / SR) * np.exp(-tt * 22)
    ring = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt * d) for f, a, d in [(612, 0.35, 16), (1094, 0.22, 20), (1730, 0.14, 26), (2470, 0.08, 34)])
    tap = bp(noise(0.02, seed), 800, 5000)[: n] if n > 0 else 0
    x = body * 1.1 + ring
    x[: int(0.02 * SR)] += tap * np.exp(-np.arange(int(0.02 * SR)) / SR * 250) * 0.8
    return x

def motor(dur, seed, rise=True):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = (95 if rise else 115) + (25 if rise else -20) * (tt / dur)
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.4 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.3
    x = lp(x, 900) * (1 + 0.25 * np.sin(2 * np.pi * 9 * tt))
    x += bp(noise(dur, seed), 300, 2000) * 0.15
    return x * np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 0.5

def clunk(seed, pitch=1.0):
    n = int(0.9 * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * np.cumsum((70 + 120 * np.exp(-tt * 40)) * pitch) / SR) * np.exp(-tt * 12)
    x += sum(np.sin(2 * np.pi * f * pitch * tt) * np.exp(-tt * d) * a for f, a, d in [(430, 0.4, 14), (980, 0.25, 18), (2300, 0.1, 30)])
    x[: int(0.015 * SR)] += hp(noise(0.015, seed), 1500) * 0.9
    return np.tanh(x * 1.3)

def relay(seed):
    n = int(0.25 * SR); tt = np.arange(n) / SR
    x = hp(noise(0.25, seed), 1800) * np.exp(-tt * 120) + np.sin(2 * np.pi * 120 * tt) * np.exp(-tt * 18) * 0.6
    return x

def zap(freq, seed):
    n = int(1.0 * SR); tt = np.arange(n) / SR
    sweep = np.sin(2 * np.pi * np.cumsum(freq * (0.6 + 0.4 * np.exp(-tt * 4))) / SR) * np.exp(-tt * 4)
    return sweep * 0.5 + bell(freq * 2, 1.0, 4.5, 0.25) * 0.4

def build_fx():
    # the ring forms: rising crystalline sparkle
    for i in range(14):
        m = 79 + [0, 2, 3, 5, 7, 9, 10][i % 7] + 12 * (i // 7)
        place('fx', bell(q(mtof(m)), 1.4, 3.5, 0.3), 0.08 + i * 0.14, 0.035 * (0.5 + i / 14), pan=np.sin(i * 1.3) * 0.6, send=0.6)
    # macro glints
    place('fx', whoosh(1.8, 101, True, 2500, 12000), 2.4, 0.07, send=0.4)
    place('fx', whoosh(2.2, 102, False, 300, 4000), 5.0, 0.22, send=0.3)
    # brand reveal at the downbeat
    place('fx', riser(1.25, 103), 6.25, 0.25)
    place('fx', impact(104, 0.9), 7.5, 0.7, send=0.45)
    for i, m in enumerate([77, 81, 84, 89]):
        place('fx', bell(q(mtof(m)), 2.4, 1.8, 0.4), 7.52 + i * 0.07, 0.045, pan=(-0.45, -0.15, 0.15, 0.45)[i], send=0.65)
    # lights switch on in sequence
    for i, ts in enumerate([9.0, 9.35, 9.7, 9.9]):
        place('fx', relay(110 + i), ts, 0.3, pan=(-0.4, 0.3, -0.1, 0.4)[i], send=0.3)
    n = int(1.6 * SR); tt = np.arange(n) / SR
    place('fx', np.sin(2 * np.pi * q(100.0) * tt) * (1 - np.exp(-tt * 3)) * np.exp(-np.clip(tt - 0.8, 0, None) * 3) * 0.5, 9.0, 0.1)
    # knock, knock, knock — then the detection chime
    for i, k in enumerate([11.25, 11.5625, 11.875]):
        place('fx', knock(120 + i), k, 0.9, pan=0.15, send=0.35)
    place('fx', bell(q(1318.5), 1.2, 4.5, 0.5), 12.08, 0.17, send=0.4)
    place('fx', bell(q(1975.5), 1.2, 4.5, 0.5), 12.2, 0.14, send=0.4)
    # gate opens: latch, motor, stop
    place('fx', clunk(130, 1.0), 15.38, 0.42, send=0.3)
    place('fx', motor(1.45, 131, True), 15.4, 0.2)
    place('fx', clunk(132, 0.8), 16.85, 0.26, send=0.3)
    place('fx', bell(q(1568.0), 1.0, 5, 0.4), 16.2, 0.13, send=0.4)
    # gate closes: motor, latch, lock beep
    place('fx', motor(1.4, 133, False), 17.55, 0.2)
    place('fx', clunk(134, 1.15), 18.95, 0.5, send=0.35)
    place('fx', bell(q(1046.5), 0.6, 8, 0.3), 19.02, 0.12)
    place('fx', bell(q(1568.0), 0.8, 7, 0.3), 19.12, 0.12)
    # camera swing to the street, day races by
    place('fx', whoosh(1.4, 140, True, 300, 6000), 19.2, 0.25, send=0.3)
    place('fx', whoosh(4.6, 141, True, 200, 3000), 20.2, 0.12, send=0.3)
    # someone detected at 2:28 AM
    place('fx', bell(q(880.0), 0.8, 6, 0.4), 20.78, 0.14, send=0.3)
    place('fx', bell(q(1318.5), 0.8, 6, 0.4), 20.86, 0.12, send=0.3)
    # crane up to the planet, the lift, arcs racing out
    place('fx', riser(1.25, 150), 25.0, 0.42)
    place('fx', whoosh(1.5, 151, True, 200, 7000), 24.95, 0.35, send=0.3)
    place('fx', impact(152, 1.0), 26.25, 0.75, send=0.55)
    for i, ts in enumerate([26.95, 27.2, 27.45, 27.7, 27.95, 28.2, 28.45]):
        place('fx', zap(q(mtof([77, 79, 81, 84, 86, 89, 91][i])), 160 + i), ts, 0.07, pan=np.sin(i * 1.7) * 0.7, send=0.5)
    place('fx', bell(q(1568.0), 1.0, 5, 0.4), 27.55, 0.1, send=0.4)
    # clips fly up into the cloud
    for i in range(12):
        ts = 30.35 + i * 0.19
        place('fx', whoosh(0.5, 170 + i, True, 1200 + i * 150, 9000), ts, 0.06, pan=np.sin(i) * 0.6, send=0.3)
    place('fx', bell(q(1318.5), 1.5, 3.2, 0.3), 32.05, 0.12, send=0.5)
    place('fx', bell(q(1760.0), 1.5, 3.2, 0.3), 32.14, 0.1, send=0.5)
    # dive home, land on the product, final note
    place('fx', riser(1.0, 180), 33.9, 0.2)
    place('fx', whoosh(1.3, 181, False, 150, 7000), 34.6, 0.5, send=0.3)
    place('fx', impact(182, 0.7), 35.95, 0.5, send=0.5)
    place('fx', impact(183, 0.85), 37.7, 0.6, send=0.55)
    for i, m in enumerate([74, 77, 81, 86]):
        place('fx', bell(q(mtof(m)), 2.6, 1.5, 0.35), 37.72 + i * 0.08, 0.04, pan=(-0.45, -0.15, 0.15, 0.45)[i], send=0.7)
    # the ring lets go: reverse shimmer into the loop
    n = int(1.0 * SR); tt = np.arange(n) / SR
    sh = bell(q(mtof(86)), 1.0, 3.0, 0.4)[::-1] * (tt / 1.0) ** 2
    place('fx', sh, 39.0, 0.05, send=0.6)

def reverb(x, rt=2.6, seed=99):
    n = int(rt * 1.4 * SR); tt = np.arange(n) / SR
    r = rng(seed)
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)]) * np.exp(-tt * 6.9 / rt)
    ir = lp(ir, 5000); ir[:, : int(0.014 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    return np.stack([signal.fftconvolve(x[0], ir[0])[:N], signal.fftconvolve(x[1], ir[1])[:N]])

def main(path):
    build_pad(); build_bass(); build_drums(); build_melody(); build_fx(); sidechain()
    wet = reverb(mix['verb'] + 0.16 * mix['pad'] + 0.1 * mix['arp'])
    bus = mix['pad'] * 0.5 + mix['bass'] * 0.8 + mix['drums'] * 0.8 + mix['arp'] * 0.8 + mix['fx'] * 1.0 + wet * 0.3
    bus = hp(bus, 30)
    ride = np.tile(circ_smooth(curve([(0, 0.72), (7.4, 0.8), (7.5, 1.0), (9.9, 0.88), (10.0, 0.92), (24.9, 0.95), (26.25, 1.08),
                                      (34.4, 1.0), (35.0, 0.85), (37.6, 0.95), (39.9, 0.74)]), 0.05), 2)
    y = (bus * ride)[:, NL:]
    y = y / (np.sqrt(np.mean(y ** 2)) * 5.9)
    y = np.tanh(y * 1.05) / np.tanh(1.05)
    y = y / np.max(np.abs(y)) * 0.891
    print(f'loop seam jump {np.max(np.abs(y[:, -1] - y[:, 0])):.4f} (99.9th pct step {np.percentile(np.abs(np.diff(y, axis=1)), 99.9):.4f})')
    wavfile.write(path, SR, (y.T * 32767).astype(np.int16))
    print('wrote', path, f'{y.shape[1] / SR:.2f}s')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav')
