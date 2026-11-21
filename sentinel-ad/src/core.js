/* Core motion utilities: easing, keyframes, math, seeded randomness.
   Everything in the film is a pure function of time, so any frame can be
   rendered on its own and the result is always identical. */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, x) => clamp((x - a) / (b - a));
  const smooth = (x) => x * x * (3 - 2 * x);

  // CSS-style cubic-bezier(x1, y1, x2, y2) -> easing function.
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-7) return sy(t);
        const d = dx(t);
        if (Math.abs(d) < 1e-7) break;
        t -= e / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 40; i++) {
        const v = sx(t);
        if (Math.abs(v - x) < 1e-7) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }

  const E = {
    linear: (x) => x,
    sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x),
    inOut: bezier(0.65, 0, 0.35, 1),       // cubic in-out
    flow: bezier(0.76, 0, 0.18, 1),        // the signature "flow" curve: long, glassy in-out
    glide: bezier(0.45, 0, 0.15, 1),       // gentle start, long settle
    out: bezier(0.16, 1, 0.3, 1),          // expo-ish out
    outSoft: bezier(0.22, 1, 0.36, 1),     // quint out
    outQuad: bezier(0.25, 0.46, 0.45, 0.94),
    in: bezier(0.7, 0, 0.84, 0),           // expo-ish in
    inSoft: bezier(0.55, 0, 0.75, 0.2),
    inCubic: bezier(0.32, 0, 0.67, 0),
    outBack: (x) => { const c1 = 1.45, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outBackSoft: (x) => { const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    // damped spring that settles exactly at 1
    spring: (x) => (x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(9.5 * x) * (1 - x * x * x)),
  };

  // Keyframe track. keys: [[time, value, easeToNext], ...]
  function K(t, keys) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < n - 1; i++) {
      const k0 = keys[i], k1 = keys[i + 1];
      if (t < k1[0]) {
        const p = (t - k0[0]) / (k1[0] - k0[0]);
        const e = k0[2] || E.inOut;
        return k0[1] + (k1[1] - k0[1]) * e(p);
      }
    }
    return keys[n - 1][1];
  }

  // 0 -> 1 over [a,b], 1 until c, 1 -> 0 over [c,d]
  function win(t, a, b, c, d, ei = E.outSoft, eo = E.inOut) {
    if (t <= a || t >= d) return 0;
    if (t < b) return ei((t - a) / (b - a));
    if (t <= c) return 1;
    return 1 - eo((t - c) / (d - c));
  }
  const ramp = (t, a, b, e = E.inOut) => e(invLerp(a, b, t));

  // Seeded PRNG (mulberry32)
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let r = Math.imul(s ^ (s >>> 15), 1 | s);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Stateless hash -> [0,1)
  function hash(n) {
    let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  window.Core = { TAU, clamp, lerp, invLerp, smooth, bezier, E, K, win, ramp, rng, hash, mix3, rgba, hex };
})();
