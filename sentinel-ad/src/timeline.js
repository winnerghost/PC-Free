/* The choreography. Every animated property of the film is a keyframe track
   (a pure function of time). Tracks start and end on the same value, so the
   36 s film loops with no seam.

   One shape never leaves the screen: "the ring". It is a superellipse
   |x/a|^px + |y/b|^py = 1, so changing (a, b, px, py) morphs it between
   circle (clock, lens, price badge), almond (eye) and rounded rectangle
   (phone). */
(function () {
  const { TAU, clamp, lerp, E, K, win, ramp, mix3, hex } = Core;
  const RING = 0.46; // ring radius in device units (device body radius = 1)

  function layout(W, H) {
    const portrait = H >= W;
    const U = Math.min(W, H) / 1080;
    const L = portrait
      ? {
          cy: H * 0.405, headY: H * 0.735, headSize: 102 * U, subSize: 36 * U,
          zClock: (330 * U) / RING, zView: (338 * U) / RING, zDevice: 306 * U, zPhone: 700 * U, zPrice: (356 * U) / RING,
          zPack: 262 * U, packLift: -46 * U,
          creditY: H * 0.672, endY: H * 0.648, maxText: W * 0.86,
          phoneA: 0.31, phoneB: 0.62,
        }
      : {
          cy: H * 0.43, headY: H * 0.845, headSize: 80 * U, subSize: 30 * U,
          zClock: (292 * U) / RING, zView: (296 * U) / RING, zDevice: 252 * U, zPhone: 515 * U, zPrice: (268 * U) / RING,
          zPack: 196 * U, packLift: -78 * U,
          creditY: H * 0.80, endY: H * 0.705, maxText: W * 0.8,
          phoneA: 0.30, phoneB: 0.60,
        };
    return Object.assign(L, { W, H, U, portrait, cx: W / 2 });
  }

  const lz = Math.log;

  function state(t, L, CFG) {
    const T = CFG.duration;
    t = ((t % T) + T) % T;
    const S = { t };
    const U = L.U;

    // ── Camera ──────────────────────────────────────────────────────────
    S.Z = Math.exp(K(t, [
      [0.00, lz(L.zClock), E.sine],
      [2.55, lz(L.zClock * 1.03), E.outSoft],
      [3.00, lz(L.zClock * 0.985), E.glide],     // the frame kicks back as the eye snaps open
      [5.45, lz(L.zClock * 1.05), E.flow],
      [7.65, lz(L.zDevice), E.sine],             // pull back: the eye was the lens all along
      [8.80, lz(L.zDevice * 1.035), E.flow],
      [9.85, lz(L.zView), E.sine],               // dive into the lens: see what Sentinel sees
      [14.55, lz(L.zView * 1.06), E.flow],
      [15.45, lz(L.zPhone), E.sine],             // dive in: the lens becomes your phone
      [17.55, lz(L.zPhone * 1.03), E.flow],
      [18.45, lz(L.zDevice * 1.02), E.sine],
      [23.40, lz(L.zDevice * 1.10), E.flow],
      [24.30, lz(L.zPrice), E.sine],             // dive in: the ring becomes the price badge
      [29.05, lz(L.zPrice * 1.045), E.flow],
      [30.25, lz(L.zPack), E.sine],              // pull back to the product shot
      [35.20, lz(L.zPack * 1.05), E.flow],
      [36.00, lz(L.zClock)],                     // ...and dive into the clock again
    ]));
    // An always-on slow float keeps the frame alive (all periods divide 36 s).
    const w = TAU / T;
    S.camX = U * (5 * Math.sin(3 * w * t + 0.3) + 3 * Math.sin(5 * w * t + 1.1));
    S.camY = U * (4 * Math.sin(2 * w * t + 2.0) + 2.5 * Math.cos(7 * w * t)) +
      K(t, [[0, 0], [29.1, 0, E.flow], [30.25, L.packLift, E.sine], [35.2, L.packLift, E.flow], [36, 0]]);
    S.rot = 0.0045 * Math.sin(2 * w * t + 0.5) + 0.0025 * Math.sin(5 * w * t + 2.2);

    // ── The ring ────────────────────────────────────────────────────────
    const A = L.phoneA, B = L.phoneB;
    S.ra = K(t, [[0, RING], [2.50, RING, E.inCubic], [2.97, 0.63, E.linear], [5.50, 0.63, E.flow], [7.10, RING],
      [14.55, RING, E.flow], [15.40, A], [17.60, A, E.flow], [18.40, RING], [36, RING]]);
    S.rb = K(t, [[0, RING], [2.50, RING, E.in], [2.96, 0.004, E.linear], [3.00, 0.004, E.outBack], [3.46, 0.30, E.sine],
      [5.50, 0.30, E.flow], [7.10, RING], [14.55, RING, E.flow], [15.40, B], [17.60, B, E.flow], [18.40, RING], [36, RING]]);
    S.rpx = K(t, [[0, 2], [14.55, 2, E.flow], [15.40, 5.2], [17.60, 5.2, E.flow], [18.40, 2], [36, 2]]);
    S.rpy = K(t, [[0, 2], [2.50, 2, E.inCubic], [2.97, 1], [5.50, 1, E.flow], [7.10, 2],
      [14.55, 2, E.flow], [15.40, 5.2], [17.60, 5.2, E.flow], [18.40, 2], [36, 2]]);
    // stroke width in screen pixels
    S.rw = U * K(t, [[0, 2.4], [2.5, 2.4], [2.97, 3.4, E.linear], [3.0, 4.6, E.out], [3.8, 3.6], [5.5, 3.6, E.flow],
      [7.1, 3.2], [14.6, 3.2, E.flow], [15.4, 2.8], [17.6, 2.8, E.flow], [18.4, 3.4], [23.6, 3.4, E.flow],
      [24.3, 5.6], [29.0, 5.6, E.flow], [30.2, 3.2], [35.2, 3.2, E.flow], [36, 2.4]]);
    // glow intensity
    S.glow = K(t, [[0, 0.5], [2.45, 0.55, E.inCubic], [2.96, 0.15, E.linear], [3.0, 2.0, E.out], [4.2, 1.05],
      [23.82, 1.05, E.linear], [24.0, 2.1, E.out], [25.2, 1.1], [29.0, 1.1, E.flow], [30.2, 1.05],
      [35.2, 1.05, E.flow], [36, 0.5]]);
    // the comet of light that circles the ring forever (12 laps per loop)
    S.cometAng = (t / 3) * TAU - Math.PI / 2;
    S.cometA = K(t, [[0, 0.35], [2.5, 0.35], [3.0, 1], [36, 1]]) * K(t, [[0, 1], [35.3, 1], [36, 0.35]]);

    // Kick-drum pulse (80 BPM half-time: beats 1 and 3, plus a pickup)
    const groove = win(t, 5.9, 6.0, 29.1, 29.4, E.linear, E.linear) + 0.5 * win(t, 32.15, 32.25, 35.0, 35.3, E.linear, E.linear);
    const ph = t % 3;
    const hits = [0, 1.5, 2.25];
    let pulse = 0;
    for (const h of hits) { const d = ph - h; if (d >= 0) pulse = Math.max(pulse, (1 - Math.exp(-d * 38)) * Math.exp(-d * 6.5)); }
    S.pulse = pulse * groove;

    // ── Colour: calm cyan, red while an intruder is around ──────────────
    S.alert = K(t, [[0, 0], [11.95, 0, E.inOut], [12.25, 1], [20.35, 1, E.inOut], [20.95, 0], [36, 0]]);
    const C = CFG.colors;
    S.col = mix3(hex(C.accent), hex(C.alert), S.alert);
    S.hot = mix3(hex(C.accentHot), hex(C.alertHot), S.alert);

    // ── Clock (opening) ─────────────────────────────────────────────────
    S.clockA = K(t, [[0, 1], [2.40, 1, E.inOut], [2.95, 0], [35.30, 0, E.inOut], [35.98, 1], [36, 1]]);
    S.digitsOut = ramp(t, 2.32, 2.86, E.inCubic);
    S.digitsIn = t >= 35.2 ? ramp(t, 35.28, 36.0, E.outSoft) : 1;
    const beatsIn = t >= 35.0 ? Math.floor((t - 36) / 0.75) : Math.floor(t / 0.75);
    const frac = t >= 35.0 ? ((t - 36) / 0.75) - beatsIn : t / 0.75 - beatsIn;
    S.tick = 41 + beatsIn - 1 + E.outBack(clamp(frac / 0.16)); // seconds hand, ticks on the beat
    S.colonA = 0.45 + 0.55 * (frac < 0.5 ? 1 : 0);

    // ── Eye → lens ──────────────────────────────────────────────────────
    S.eye = K(t, [[0, 1], [5.55, 1, E.flow], [7.05, 0], [35.9, 0, E.linear], [36, 1]]);
    S.innerA = K(t, [[0, 0], [2.958, 0, E.linear], [2.966, 1], [8.95, 1, E.inOut], [9.55, 0], [17.75, 0, E.inOut],
      [18.25, 1], [23.55, 1, E.inOut], [23.95, 0], [29.40, 0, E.inOut], [30.05, 1], [35.25, 1, E.inOut], [35.6, 0], [36, 0]]);
    S.innerR = K(t, [[0, 0.235], [5.55, 0.235, E.flow], [7.10, 0.36], [35.9, 0.36, E.linear], [36, 0.235]]);
    S.pupil = K(t, [[0, 0.088], [3.0, 0.11, E.outSoft], [3.6, 0.082], [5.55, 0.082, E.flow], [7.1, 0.11],
      [12.0, 0.11, E.out], [12.5, 0.07], [20.4, 0.07, E.inOut], [21.2, 0.11], [36, 0.11]]);
    S.lookX = K(t, [[0, 0], [3.9, 0, E.out], [4.08, -0.075], [4.58, -0.075, E.out], [4.76, 0.075],
      [5.16, 0.075, E.out], [5.34, 0], [12.3, 0, E.outSoft], [12.8, -0.03], [14.4, -0.03, E.inOut], [15, 0], [36, 0]]);
    S.lookY = K(t, [[0, 0], [3.9, 0, E.out], [4.08, -0.02], [4.58, -0.02, E.out], [4.76, 0.012], [5.34, 0], [36, 0]]);

    // ── Device body ─────────────────────────────────────────────────────
    S.devA = K(t, [[0, 0], [6.0, 0, E.outSoft], [7.6, 1], [8.9, 1, E.inOut], [9.5, 0], [17.7, 0, E.inOut],
      [18.35, 1], [23.5, 1, E.inOut], [23.95, 0], [29.35, 0, E.outSoft], [30.35, 1], [35.2, 1, E.inOut], [35.65, 0], [36, 0]]);
    S.build = ramp(t, 5.95, 7.9, E.linear);              // draw-on reveal (first entrance only)
    const phoneness = win(t, 14.55, 15.4, 17.6, 18.4, E.inOut, E.inOut);
    S.yaw = K(t, [[0, 0], [5.6, 0, E.inOut], [6.5, -0.36, E.flow], [8.3, 0], [36, 0]]) +
      0.10 * Math.sin(3 * w * t + 0.8) * (1 - phoneness) * S.devA;
    S.pitch = 0.05 * Math.sin(2 * w * t + 1.7) * (1 - phoneness) * S.devA;
    S.light = -0.6 + S.yaw * 2.2 + Math.sin(w * t) * 0.35;
    S.glint = [ramp(t, 6.7, 7.9, E.inOut), ramp(t, 30.35, 31.55, E.inOut), ramp(t, 33.0, 34.1, E.inOut)];
    S.ir = win(t, 7.7, 8.25, 8.85, 9.4);
    S.ledPop = ramp(t, 6.5, 7.5, E.linear);

    // ── Sees in the dark: we dive into the lens and look through it ─────
    S.viewA = win(t, 9.15, 9.95, 14.85, 15.5);
    S.sweepA = K(t, [[0, 0], [9.3, 0], [9.6, 1], [11.9, 1], [12.4, 0.35], [14.6, 0.35], [15.1, 0], [36, 0]]);
    S.sweepAng = -Math.PI / 2 + (t - 9.3) * (TAU / 2.4);
    S.reveal = ramp(t, 9.5, 11.8, E.linear);           // the room stays faintly lit once scanned

    // ── Catches every move: an intruder, locked on ──────────────────────
    S.intrA = win(t, 11.75, 12.3, 14.85, 15.45);
    S.intrX = K(t, [[0, -0.47], [11.75, -0.47, E.glide], [14.9, -0.27], [36, -0.27]]);
    S.intrMove = win(t, 11.75, 12.2, 14.3, 14.9, E.linear, E.linear);
    S.lock = ramp(t, 12.28, 12.78, E.out);
    S.lockLabel = ramp(t, 12.6, 13.2, E.linear);

    // ── Alerts your phone ───────────────────────────────────────────────
    S.phone = phoneness;
    S.phoneA = win(t, 15.1, 15.55, 17.42, 17.8);
    S.notif = ramp(t, 15.62, 16.32, E.spring);
    S.notifA = ramp(t, 15.62, 15.9, E.linear);
    const st = t - 16.02;
    S.shake = st > 0 && st < 0.55 ? Math.sin(st * TAU * 21) * Math.exp(-st * 5.5) * 0.028 : 0;

    // ── Sounds the alarm ────────────────────────────────────────────────
    S.alarmA = win(t, 18.1, 18.4, 20.2, 20.85);
    S.alarmT = t;

    // ── Plug it in. Armed. ──────────────────────────────────────────────
    S.arm = ramp(t, 21.05, 22.45, E.inOut);
    S.armA = win(t, 21.0, 21.2, 23.2, 23.6);
    S.armFlash = t > 22.45 ? Math.exp(-(t - 22.45) * 3.2) * (t < 24 ? 1 : 0) : 0;

    // ── Price badge ─────────────────────────────────────────────────────
    S.priceA = win(t, 23.9, 24.35, 28.95, 29.45);
    S.badgeA = win(t, 24.05, 24.8, 28.85, 29.35);
    S.badgeRot = (t - 24) * 0.32;
    S.priceT = t;
    S.shine = ramp(t, 25.45, 26.25, E.inOut);

    // ── Shockwaves (eye opens, price lands, end card) ───────────────────
    S.shocks = [[3.0, 1.0], [24.0, 0.85], [32.25, 0.45]];

    // ── God rays when the eye opens ─────────────────────────────────────
    S.rays = t >= 3.0 && t < 6.5 ? Math.exp(-(t - 3.0) * 1.15) * ramp(t, 3.0, 3.06, E.linear) : 0;
    S.flash = t >= 3.0 && t < 4 ? Math.exp(-(t - 3.0) * 9) : 0;
    S.flash += t >= 24.0 && t < 25.0 ? 0.55 * Math.exp(-(t - 24.0) * 9) : 0;

    // ── HUD ─────────────────────────────────────────────────────────────
    S.hudA = K(t, [[0, 0.9], [36, 0.9]]);
    return S;
  }

  window.Timeline = { layout, state, RING };
})();
