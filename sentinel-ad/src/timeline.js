/* The choreography of the 40 s film (96 BPM: beat 0.625 s, bar 2.5 s).
   Every value is a pure function of time; the last frame flows back into the
   first, so the film loops with no seam.

   Act 1  0-10 s   macro details in the dark, product reveal, wordmark
   Act 2  10-25 s  the gate at night: knock detection, gate open/close, 24 h timelapse
   Act 3  25-35 s  rise to the globe (live view anywhere), up into the cloud
   Act 4  35-40 s  dive home: credit, "Coming soon", back into the lens */
const { TAU, clamp, lerp, E, K, win, ramp } = window.Core;

export const T = 40;
export const BEAT = 0.625;

// time of day (hours) shown by the timelapse; night everywhere else
const NIGHT = 21.68; // 9:41 PM
export const knockTimes = [11.25, 11.5625, 11.875];
export const arcTimes = [26.95, 27.2, 27.45, 27.7, 27.95, 28.2, 28.45];
export const cardTimes = Array.from({ length: 12 }, (_, i) => 30.35 + i * 0.19);

export function state(t) {
  t = ((t % T) + T) % T;
  const S = { t };

  // ── the light ring: a comet that grows into a full ring, and back ─────
  const C = 0.35;
  if (t < 2.1) {
    const p = E.inOut(clamp(t / 2.1));
    S.arc0 = -C; S.arc1 = lerp(0, TAU - C, p);
    if (S.arc1 - S.arc0 >= TAU - 1e-3) S.arc1 = S.arc0 + TAU;
  } else if (t > 39.0) {
    const p = E.inOut(clamp((t - 39.0) / 1.0));
    S.arc0 = lerp(-C, TAU - C, p); S.arc1 = lerp(TAU - C, TAU, p);
  } else { S.arc0 = 0; S.arc1 = TAU; }
  // ring brightness, with flashes on knocks and a beacon while we rise
  let ring = K(t, [[0, 1.0], [24.9, 1.0, E.inOut], [26.1, 2.6], [34.7, 2.6, E.inOut], [35.6, 1.0], [40, 1.0]]);
  for (const k of knockTimes) { const d = t - k; if (d >= 0 && d < 1.2) ring += 1.6 * Math.exp(-d * 7); }
  for (const g of [16.2, 18.85]) { const d = t - g; if (d >= 0 && d < 1.5) ring += 0.9 * Math.exp(-d * 5); }
  { const d = t - 20.8; if (d >= 0 && d < 1.5) ring += 1.2 * Math.exp(-d * 5); }
  S.ring = ring;
  S.status = 0.55 + 0.45 * Math.sin(t * TAU / 2.5);

  // ── lighting ─────────────────────────────────────────────────────────
  // studio rim lights on the product (strong in product shots, softer at the gate)
  S.studio = K(t, [[0, 0.12], [1.2, 0.18, E.inOut], [3.4, 1.0], [9.2, 1.0, E.inOut], [10.8, 0.0], [25.0, 0.0, E.inOut],
    [26.0, 0.0], [34.8, 0.0, E.inOut], [36.2, 1.0], [39.3, 1.0, E.inOut], [40, 0.12]]);
  S.env = K(t, [[0, 0.1], [1.4, 0.14, E.inOut], [3.6, 1.1], [9.2, 1.1, E.inOut], [10.8, 0.3], [25.0, 0.3],
    [26.0, 0.05], [34.8, 0.05, E.inOut], [36.2, 1.1], [39.3, 1.1, E.inOut], [40, 0.1]]);
  // the gate's architectural lighting turns on in sequence, and off again at the end
  const on = (a, b) => ramp(t, a, b, E.inOut);
  const off = 1 - ramp(t, 26.3, 26.6, E.linear);
  S.lightPillar = Math.min(on(9.0, 9.5), off);
  S.lightWall = Math.min(on(9.35, 10.0), off);
  S.lightGate = Math.min(on(9.7, 10.5), off);
  S.lightStreet = Math.min(on(9.9, 10.8), off);
  S.world = Math.min(on(8.9, 10.2), off);          // sky, moon, fog: the world appears
  S.interior = Math.min(on(9.8, 10.8), off);

  // ── knock detection ──────────────────────────────────────────────────
  S.knocks = knockTimes.map((k) => t - k);
  S.knockA = win(t, 10.8, 11.1, 14.6, 15.2);

  // ── gate open / close ────────────────────────────────────────────────
  S.gate = K(t, [[0, 0], [15.4, 0, E.inOut], [16.85, 1], [17.55, 1, E.inOut], [18.95, 0], [40, 0]]);
  S.gateOpen = 1 - Math.abs(1 - S.gate * 2) * 0; // kept for clarity

  // ── 24 h timelapse + motion sensing ──────────────────────────────────
  const hrs = K(t, [[0, 0], [20.0, 0, E.inCubic], [21.9, 4.6, E.linear], [24.3, 22.0, E.outSoft], [25.0, 24.0], [40, 24]]);
  S.tod = (NIGHT + (t > 25.0 ? 0 : hrs)) % 24;
  S.cone = win(t, 19.7, 20.5, 25.0, 25.7);
  S.scan = ((t - 19.7) / 1.25) % 1;
  S.walk = t >= 19.9 && t <= 22.6 ? (t - 19.9) / 2.7 : -1;
  S.detect = ramp(t, 20.75, 21.15, E.out) * (1 - ramp(t, 22.1, 22.5, E.inOut));
  S.detectTod = 2.0 + 28 / 60;

  // ── home -> earth -> home ─────────────────────────────────────────────
  S.mix = ramp(t, 25.95, 26.45, E.inOut) * (1 - ramp(t, 34.65, 35.15, E.inOut));
  S.arcs = arcTimes.map((a) => t - a);
  S.globeSpin = (t - 26) * 0.045;
  S.cloud = win(t, 29.6, 30.8, 34.4, 35.0);
  S.cards = cardTimes.map((c) => clamp((t - c) / 1.5));
  S.vault = win(t, 31.6, 32.6, 34.3, 34.9);

  // ── film-level grading ───────────────────────────────────────────────
  S.flash = 0;
  for (const k of knockTimes) { const d = t - k; if (d >= 0 && d < 0.6) S.flash += 0.05 * Math.exp(-d * 10); }
  return S;
}
