/* Scene renderer. Draws one frame of the film for a given state S.
   World space: device centre at the origin, device body radius = 1.
   Emissive things are also drawn into a quarter-res buffer that becomes
   a three-level bloom. */
(function () {
  const { TAU, clamp, lerp, invLerp, E, K, ramp, rng, hash, mix3, rgba, hex } = Core;
  const RING = Timeline.RING;
  const FD = '"Sentinel Display"', FM = '"Sentinel Mono"', FT = '"Sentinel Text"';

  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  // Superellipse |x/a|^px + |y/b|^py = 1, sampled by angle.
  function superPath(ctx, a, b, px, py, N = 240) {
    const ex = 2 / px, ey = 2 / py;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU;
      const c = Math.cos(th), s = Math.sin(th);
      const x = a * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), ex);
      const y = b * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), ey);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  class Scene {
    constructor(canvas, L, CFG) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.L = L;
      this.CFG = CFG;
      this.W = L.W; this.H = L.H; this.U = L.U;
      this.C = {};
      for (const k in CFG.colors) this.C[k] = hex(CFG.colors[k]);
      const q = 4;
      this.q = q;
      this.e = mkCanvas(L.W / q, L.H / q); this.ex = this.e.getContext('2d');
      this.b1 = mkCanvas(L.W / q, L.H / q); this.b1x = this.b1.getContext('2d');
      this.b2 = mkCanvas(L.W / 8, L.H / 8); this.b2x = this.b2.getContext('2d');
      this.b3 = mkCanvas(L.W / 16, L.H / 16); this.b3x = this.b3.getContext('2d');
      this.prepare();
    }

    prepare() {
      const { W, H, U } = this;
      // soft sprites (white, tinted at draw time through separate colour sprites)
      this.dot = this.makeSprite([255, 255, 255], 'dot');
      this.disc = this.makeSprite([255, 255, 255], 'disc');
      this.coolDot = this.makeSprite([190, 222, 255], 'dot');
      this.coolDisc = this.makeSprite([170, 210, 255], 'disc');
      this.accDot = mkCanvas(64, 64);
      this.accDisc = mkCanvas(64, 64);

      // particle field
      const R = rng(20251121);
      this.parts = [];
      for (let i = 0; i < 300; i++) {
        const d = Math.pow(R(), 2.2);
        this.parts.push({
          x: (R() * 2 - 1) * 1.45, y: (R() * 2 - 1) * 1.3, d,
          ph: R() * TAU, ph2: R() * TAU, k: 1 + Math.floor(R() * 3), sp: 1 + Math.floor(R() * 2),
          s: lerp(1.0, 2.4, R()) * (1 + d * 9),
          a: lerp(0.35, 1.0, R()) * lerp(1, 0.16, d),
          acc: R() < 0.42,
        });
      }

      // film grain tiles (screen-blended, so they lift the darkest tones too: no banding)
      this.grain = [];
      const gR = rng(77);
      // grain particles are 2 px wide and the amplitude is low: enough to stop banding
      // in the dark gradients without the noise eating the video bitrate
      const qs = new URLSearchParams(location.search);
      this.grainAmp = +(qs.get('grain') || 1);
      this.ditherAmp = +(qs.get('dither') || 1);
      // static 1 px dither: breaks up banding in the dark gradients, and because it never
      // moves the encoder can reuse it from frame to frame almost for free
      {
        const d = mkCanvas(512, 512), dx = d.getContext('2d');
        const id = dx.createImageData(512, 512);
        const dR = rng(4242);
        for (let i = 0; i < id.data.length; i += 4) {
          const v = Math.floor(dR() * 6);
          id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
        }
        dx.putImageData(id, 0, 0);
        this.dither = this.ctx.createPattern(d, 'repeat');
      }
      for (let k = 0; k < 4; k++) {
        const g = mkCanvas(256, 256), gx = g.getContext('2d');
        const id = gx.createImageData(256, 256);
        for (let i = 0; i < id.data.length; i += 4) {
          const v = Math.floor(Math.pow(gR(), 2.0) * 16);
          id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
        }
        gx.putImageData(id, 0, 0);
        const big = mkCanvas(512, 512), bx = big.getContext('2d');
        bx.imageSmoothingEnabled = true;
        bx.drawImage(g, 0, 0, 512, 512);
        this.grain.push(this.ctx.createPattern(big, 'repeat'));
      }

      // vignette
      this.vig = mkCanvas(W, H);
      const vx = this.vig.getContext('2d');
      const vg = vx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.45, Math.hypot(W, H) * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(0.55, 'rgba(0,0,0,0.18)');
      vg.addColorStop(1, 'rgba(0,0,0,0.78)');
      vx.fillStyle = vg; vx.fillRect(0, 0, W, H);

      // scanlines for the night-vision viewfinder
      const sl = mkCanvas(1, 4), slx = sl.getContext('2d');
      slx.fillStyle = 'rgba(0,0,0,0.0)'; slx.fillRect(0, 0, 1, 4);
      slx.fillStyle = 'rgba(0,0,0,0.38)'; slx.fillRect(0, 0, 1, 1.4);
      this.scan = this.ctx.createPattern(sl, 'repeat');

      // god rays
      const rr = rng(99);
      this.rayset = [];
      for (let i = 0; i < 46; i++) this.rayset.push({ a: rr() * TAU, w: lerp(0.01, 0.05, rr()), l: lerp(1.6, 4.2, rr()), o: lerp(0.25, 1, rr()) });

      // HUD glyphs for the scramble effect
      this.glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/+%<>';

      // measure badge text
      this.badgeChars = null;
    }

    makeSprite(col, kind, canvas) {
      const c = canvas || mkCanvas(64, 64), x = c.getContext('2d');
      x.clearRect(0, 0, 64, 64);
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      if (kind === 'dot') {
        g.addColorStop(0, rgba(col, 1)); g.addColorStop(0.18, rgba(col, 0.85));
        g.addColorStop(0.45, rgba(col, 0.22)); g.addColorStop(1, rgba(col, 0));
      } else {
        g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(0.62, rgba(col, 0.48));
        g.addColorStop(0.82, rgba(col, 0.2)); g.addColorStop(1, rgba(col, 0));
      }
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return c;
    }

    // world matrix
    mat(S, scale = 1) {
      const z = S.Z * scale, c = Math.cos(S.rot) * z, s = Math.sin(S.rot) * z;
      return [c, s, -s, c, (this.L.cx + S.camX) * scale, (this.L.cy + S.camY) * scale];
    }
    // device layer at depth zd, with yaw/pitch squash (+ optional phone shake)
    dev(ctx, m, S, zd = 0) {
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.translate(zd * Math.sin(S.yaw), -zd * Math.sin(S.pitch));
      if (S.shake) ctx.rotate(S.shake);
      ctx.scale(Math.cos(S.yaw), Math.cos(S.pitch));
    }

    draw(t, frame, S) {
      const ctx = this.ctx, { W, H } = this;
      this.S = S;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';

      // accent sprites follow the current hero colour
      this.makeSprite(S.col, 'dot', this.accDot);
      this.makeSprite(S.col, 'disc', this.accDisc);

      // emissive buffer
      const ex = this.ex;
      ex.setTransform(1, 0, 0, 1, 0, 0);
      ex.globalCompositeOperation = 'source-over';
      ex.globalAlpha = 1;
      ex.clearRect(0, 0, this.e.width, this.e.height);

      const m = this.mat(S), mq = this.mat(S, 1 / this.q);

      this.background(ctx, S);
      this.particles(ctx, S, false);
      this.rays(ctx, ex, S, m, mq);
      this.alarm(ctx, ex, S, m, mq);
      this.device(ctx, ex, S, m, mq);
      this.view(ctx, ex, S, m, mq);
      this.phone(ctx, ex, S, m, mq);
      this.inner(ctx, ex, S, m, mq);
      this.ring(ctx, ex, S, m, mq);
      this.clock(ctx, ex, S, m, mq);
      this.armed(ctx, ex, S, m, mq);
      this.price(ctx, ex, S, m, mq);
      this.bloom(ctx, S);
      this.particles(ctx, S, true);
      this.hud(ctx, S, t);
      this.finish(ctx, S, frame);
    }

    // ── background ────────────────────────────────────────────────────────
    background(ctx, S) {
      const { W, H, L, C } = this;
      ctx.fillStyle = rgba(C.bg, 1);
      ctx.fillRect(0, 0, W, H);
      const x = L.cx + S.camX, y = L.cy + S.camY;
      const R = Math.max(W, H);
      let g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.95);
      g.addColorStop(0, rgba(C.bgLift, 0.9));
      g.addColorStop(0.4, rgba(C.bgLift, 0.32));
      g.addColorStop(1, rgba(C.bgLift, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // light the room with Sentinel's colour
      const a = 0.07 + 0.05 * Math.min(S.glow, 2) + 0.05 * S.pulse + 0.1 * S.alarmA * this.alarmEnv(S.t);
      g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.7);
      g.addColorStop(0, rgba(S.col, a));
      g.addColorStop(0.5, rgba(S.col, a * 0.3));
      g.addColorStop(1, rgba(S.col, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    alarmEnv(t) {
      if (t < 18 || t > 21) return 0;
      const ph = (t - 18) % 0.375;
      return (1 - Math.exp(-ph * 45)) * Math.exp(-ph * 8);
    }

    // ── particles: drifting dust, depth parallax, shockwaves, radar glints ─
    particles(ctx, S, front) {
      const { W, H, L, U } = this;
      const T = this.CFG.duration, w = TAU / T, t = S.t;
      const unit = Math.max(W, H) / 2;
      const cx = L.cx, cy = L.cy;
      const zr = S.Z / L.zDevice;
      let shock = 0;
      for (const [tb, amp] of S.shocks) {
        const tau = t - tb;
        if (tau > 0 && tau < 4) shock += amp * (1 - Math.exp(-tau * 14)) * Math.exp(-tau * 1.5);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.parts) {
        if ((p.d > 0.55) !== front) continue;
        let yy = p.y - (2.6 * p.sp / T) * t;
        yy = ((yy + 1.3) % 2.6 + 2.6) % 2.6 - 1.3;
        const xx = p.x + 0.025 * Math.sin(p.k * w * t + p.ph);
        yy += 0.018 * Math.cos(p.k * w * t + p.ph2);
        const edge = clamp((1.3 - Math.abs(yy)) / 0.25);
        const sc = Math.pow(zr, 0.22 + 0.6 * p.d) * (1 + 0.16 * shock * (0.4 + p.d));
        const par = 0.55 + p.d * 1.6;
        const rx = xx * unit * sc, ry = yy * unit * sc;
        const cr = Math.cos(S.rot * par), sr = Math.sin(S.rot * par);
        const sx = cx + rx * cr - ry * sr + S.camX * par;
        const sy = cy + rx * sr + ry * cr + S.camY * par;
        const size = p.s * U * (0.9 + 0.25 * Math.sqrt(zr)) * (front ? 1.15 : 1);
        if (sx < -size || sx > W + size || sy < -size || sy > H + size) continue;
        let a = p.a * edge * (0.75 + 0.35 * S.pulse);
        if (S.sweepA > 0 && !front) {
          const ang = Math.atan2(sy - (L.cy + S.camY), sx - (L.cx + S.camX));
          let behind = (S.sweepAng - ang) % TAU; if (behind < 0) behind += TAU;
          a *= 1 + 2.2 * Math.exp(-behind * 2.4) * S.sweepA;
        }
        const spr = p.d > 0.3 ? (p.acc ? this.accDisc : this.coolDisc) : (p.acc ? this.accDot : this.coolDot);
        ctx.globalAlpha = clamp(a);
        const s2 = size * (p.d > 0.3 ? 2.2 : 3.2);
        ctx.drawImage(spr, sx - s2 / 2, sy - s2 / 2, s2, s2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // ── god rays as the eye opens ─────────────────────────────────────────
    rays(ctx, ex, S, m, mq) {
      if (S.rays <= 0.003) return;
      const draw = (c, mm, alpha) => {
        c.setTransform(mm[0], mm[1], mm[2], mm[3], mm[4], mm[5]);
        c.globalCompositeOperation = 'lighter';
        const rot = S.t * 0.05;
        for (const r of this.rayset) {
          const a0 = r.a + rot, l = RING * r.l * (0.9 + 0.35 * (1 - S.rays));
          const g = c.createLinearGradient(0, 0, Math.cos(a0) * l, Math.sin(a0) * l);
          g.addColorStop(0, rgba(S.hot, 0));
          g.addColorStop(0.18, rgba(S.col, 0.55 * r.o * alpha));
          g.addColorStop(1, rgba(S.col, 0));
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(Math.cos(a0 - r.w) * RING * 0.5, Math.sin(a0 - r.w) * RING * 0.5);
          c.lineTo(Math.cos(a0) * l, Math.sin(a0) * l);
          c.lineTo(Math.cos(a0 + r.w) * RING * 0.5, Math.sin(a0 + r.w) * RING * 0.5);
          c.closePath();
          c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      };
      draw(ctx, m, S.rays * 0.35);
      draw(ex, mq, S.rays * 0.9);
    }

    // ── alarm pulses ──────────────────────────────────────────────────────
    alarm(ctx, ex, S, m, mq) {
      if (S.alarmA <= 0.002) return;
      const t = S.t;
      for (let k = 0; k < 8; k++) {
        const tb = 18.0 + k * 0.375;
        const age = t - tb;
        if (age < 0 || age > 1.6) continue;
        const r = 1.02 + age * 2.1;
        const a = Math.pow(1 - age / 1.6, 2) * S.alarmA;
        for (const [c, mm, lw, al] of [[ctx, m, 2.6, 0.75], [ex, mq, 7, 1]]) {
          c.setTransform(mm[0], mm[1], mm[2], mm[3], mm[4], mm[5]);
          c.beginPath(); c.arc(0, 0, r, 0, TAU);
          c.strokeStyle = rgba(S.col, a * al);
          c.lineWidth = (lw * this.U * (1.4 - age * 0.5)) / S.Z;
          c.stroke();
        }
      }
    }

    // ── the device ────────────────────────────────────────────────────────
    device(ctx, ex, S, m, mq) {
      const A = S.devA;
      if (A <= 0.002) return;
      const C = this.C, U = this.U;
      const cyw = Math.cos(S.yaw), syw = Math.sin(S.yaw);
      ctx.save();
      ctx.globalAlpha = A;

      // floor glow
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      let g = ctx.createRadialGradient(0, 1.32, 0, 0, 1.32, 1.5);
      g.addColorStop(0, rgba(S.col, 0.16)); g.addColorStop(1, rgba(S.col, 0));
      ctx.save(); ctx.scale(1, 0.22); ctx.translate(0, 1.32 / 0.22 - 1.32);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 1.32, 1.5, 0, TAU); ctx.fill(); ctx.restore();

      // body thickness (side wall)
      const depth = 0.42;
      const bx = -depth * syw, fx = 0;
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      if (Math.abs(syw) > 0.004) {
        const sg = ctx.createLinearGradient(bx - cyw, 0, fx + cyw, 0);
        const lit = syw > 0 ? 1 : 0;
        sg.addColorStop(0, lit ? '#0a0c10' : '#1d2129');
        sg.addColorStop(0.5, '#111419');
        sg.addColorStop(1, lit ? '#262b33' : '#08090c');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.ellipse(bx, 0, cyw, 1, 0, 0, TAU); ctx.fill();
        ctx.beginPath();
        ctx.rect(Math.min(bx, fx), -1, Math.abs(bx - fx), 2); ctx.fill();
        // specular streak along the side wall
        ctx.strokeStyle = 'rgba(200,215,235,0.10)';
        ctx.lineWidth = 2.2 * U / S.Z;
        ctx.beginPath(); ctx.ellipse((bx + fx) / 2, 0, cyw, 0.985, 0, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
      }

      // front shell
      this.dev(ctx, m, S, 0);
      g = ctx.createRadialGradient(-0.25, -0.35, 0.1, 0, 0, 1);
      g.addColorStop(0, '#1b1f26'); g.addColorStop(0.7, '#111419'); g.addColorStop(1, '#0a0c0f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
      // rim light
      g = ctx.createLinearGradient(-0.8, -0.8, 0.8, 0.8);
      g.addColorStop(0, 'rgba(230,238,250,0.55)'); g.addColorStop(0.5, 'rgba(230,238,250,0.06)'); g.addColorStop(1, 'rgba(230,238,250,0.18)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.2 * U / S.Z;
      ctx.beginPath(); ctx.arc(0, 0, 0.994, 0, TAU); ctx.stroke();

      // brushed-metal bezel
      this.dev(ctx, m, S, 0.03);
      const r0 = 0.80, r1 = 0.935;
      const cg = ctx.createConicGradient(S.light, 0, 0);
      const stops = [[0, '#2b3038'], [0.07, '#cfd6df'], [0.12, '#59606a'], [0.25, '#1f2329'], [0.36, '#8c95a2'],
        [0.46, '#f4f7fa'], [0.52, '#6c7480'], [0.66, '#22262c'], [0.78, '#aab3be'], [0.88, '#3a3f47'], [1, '#2b3038']];
      for (const [o, c] of stops) cg.addColorStop(o, c);
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(0, 0, r1, 0, TAU); ctx.arc(0, 0, r0, 0, TAU, true); ctx.fill();
      for (let i = 0; i < 14; i++) {
        const r = r0 + ((i + 0.5) / 14) * (r1 - r0);
        ctx.strokeStyle = hash(i * 7 + 3) > 0.5 ? `rgba(255,255,255,${0.03 + hash(i) * 0.06})` : `rgba(0,0,0,${0.05 + hash(i + 9) * 0.08})`;
        ctx.lineWidth = 1.1 * U / S.Z;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 1.4 * U / S.Z;
      ctx.beginPath(); ctx.arc(0, 0, r0, Math.PI * 0.95, Math.PI * 1.7); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2 * U / S.Z;
      ctx.beginPath(); ctx.arc(0, 0, r1, 0, TAU); ctx.stroke();

      // glass face
      this.dev(ctx, m, S, 0);
      g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, r0);
      g.addColorStop(0, '#0d1117'); g.addColorStop(0.75, '#07090c'); g.addColorStop(1, '#030405');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r0, 0, TAU); ctx.fill();
      // light from the ring spilling onto the glass
      g = ctx.createRadialGradient(0, 0, RING * 0.8, 0, 0, r0);
      g.addColorStop(0, rgba(S.col, 0.0)); g.addColorStop(0.12, rgba(S.col, 0.16 * (0.8 + 0.4 * S.pulse)));
      g.addColorStop(0.5, rgba(S.col, 0.03)); g.addColorStop(1, rgba(S.col, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // IR LEDs
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU + Math.PI / 8;
        const x = Math.cos(an) * 0.655, y = Math.sin(an) * 0.655;
        const pop = clamp((S.ledPop - i / 10) * 5);
        ctx.fillStyle = '#0d0a0c'; ctx.beginPath(); ctx.arc(x, y, 0.03, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1 * U / S.Z; ctx.stroke();
        const on = Math.max(S.ir * 0.9, pop * (1 - S.ledPop) * 1.0);
        if (on > 0.01) {
          ctx.fillStyle = `rgba(255,60,80,${0.75 * on})`;
          ctx.beginPath(); ctx.arc(x, y, 0.016, 0, TAU); ctx.fill();
          this.dev(ex, mq, S, 0);
          ex.globalAlpha = A;
          ex.fillStyle = `rgba(255,50,70,${0.9 * on})`;
          ex.beginPath(); ex.arc(x, y, 0.05, 0, TAU); ex.fill();
          ex.globalAlpha = 1;
        }
      }
      // engraving + status LED
      this.textPx(ctx, S, this.CFG.brand, 0, 0.552, 0.044, `500`, FM, 'rgba(255,255,255,0.30)', 0.34);
      const led = 0.6 + 0.4 * Math.sin(S.t * TAU / 3);
      ctx.fillStyle = rgba(S.hot, 0.9 * led);
      ctx.beginPath(); ctx.arc(0, -0.735, 0.014, 0, TAU); ctx.fill();
      this.dev(ex, mq, S, 0);
      ex.globalAlpha = A;
      ex.fillStyle = rgba(S.col, 0.9 * led); ex.beginPath(); ex.arc(0, -0.735, 0.05, 0, TAU); ex.fill();
      ex.globalAlpha = 1;

      // draw-on construction lines (first entrance)
      if (S.build > 0 && S.build < 1) {
        this.dev(ctx, m, S, 0.03);
        const b = S.build;
        for (const [r, d0] of [[0.994, 0], [r1, 0.08], [r0, 0.16], [0.655, 0.24]]) {
          const p = E.inOut(clamp((b - d0) / 0.55));
          const fade = 1 - clamp((b - d0 - 0.45) / 0.4);
          if (p <= 0 || fade <= 0) continue;
          ctx.strokeStyle = rgba(S.hot, 0.85 * fade);
          ctx.lineWidth = 1.6 * U / S.Z;
          ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
        }
      }

      // glass reflections
      this.dev(ctx, m, S, 0.02);
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, r0 * 0.995, 0, TAU); ctx.clip();
      const off = -S.yaw * 0.35;
      ctx.beginPath();
      ctx.arc(off, 0, r0 * 0.97, 0, TAU);
      ctx.arc(off + 0.13, 0.17, r0 * 0.97, 0, TAU, true);
      g = ctx.createLinearGradient(-0.6 + off, -0.6, 0.1 + off, 0.1);
      g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fill('evenodd');
      // specular glints that sweep across the face
      for (const gp of S.glint) {
        if (gp <= 0 || gp >= 1) continue;
        const x = lerp(-1.6, 1.6, gp);
        const lg = ctx.createLinearGradient(x - 0.35, -0.35, x + 0.35, 0.35);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.20)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = lg; ctx.fillRect(-1, -1, 2, 2);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
      // bezel glints
      for (const gp of S.glint) {
        if (gp <= 0 || gp >= 1) continue;
        this.dev(ctx, m, S, 0.03);
        const an = lerp(Math.PI * 0.8, Math.PI * 2.1, gp);
        const cg2 = ctx.createConicGradient(an - 0.5, 0, 0);
        cg2.addColorStop(0, 'rgba(255,255,255,0)'); cg2.addColorStop(0.08, 'rgba(255,255,255,0.75)'); cg2.addColorStop(0.16, 'rgba(255,255,255,0)'); cg2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = cg2;
        ctx.beginPath(); ctx.arc(0, 0, r1, 0, TAU); ctx.arc(0, 0, r0, 0, TAU, true); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }

    // text with size in world units, drawn at pixel scale (crisp at any zoom)
    textPx(ctx, S, str, x, y, size, weight, family, fill, spacingEm = 0, align = 'center', base = 'middle') {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 / S.Z, 1 / S.Z);
      const px = size * S.Z;
      ctx.font = `${weight} ${px}px ${family}`;
      ctx.letterSpacing = `${spacingEm * px}px`;
      ctx.textAlign = align; ctx.textBaseline = base;
      ctx.fillStyle = fill;
      // letterSpacing adds trailing space; compensate for centred text
      ctx.fillText(str, align === 'center' ? (spacingEm * px) / 2 : 0, 0);
      ctx.restore();
    }

    // ── the ring ──────────────────────────────────────────────────────────
    ring(ctx, ex, S, m, mq) {
      const lw = S.rw / S.Z;
      const path = (c) => superPath(c, S.ra, S.rb, S.rpx, S.rpy);
      // halo + core on the main canvas
      this.dev(ctx, m, S, 0.01);
      path(ctx);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(S.col, 0.28);
      ctx.lineWidth = lw * 3.4;
      ctx.stroke();
      ctx.strokeStyle = rgba(mix3(S.col, S.hot, 0.65), 0.95);
      ctx.lineWidth = lw;
      ctx.stroke();
      // comet of light travelling round
      const tail = 2.4;
      const cg = ctx.createConicGradient(S.cometAng - tail, 0, 0);
      cg.addColorStop(0, rgba(S.hot, 0));
      cg.addColorStop((tail / TAU) * 0.985, rgba([255, 255, 255], 0.95 * S.cometA));
      cg.addColorStop(tail / TAU, rgba([255, 255, 255], 0));
      cg.addColorStop(1, rgba(S.hot, 0));
      ctx.strokeStyle = cg;
      ctx.lineWidth = lw * 1.25;
      ctx.stroke();
      // emissive
      this.dev(ex, mq, S, 0.01);
      path(ex);
      ex.lineJoin = 'round';
      ex.strokeStyle = rgba(S.col, clamp(0.55 * S.glow * (1 + 0.5 * S.pulse)));
      ex.lineWidth = lw * 4.5;
      ex.stroke();
      const cg2 = ex.createConicGradient(S.cometAng - tail, 0, 0);
      cg2.addColorStop(0, rgba(S.col, 0));
      cg2.addColorStop((tail / TAU) * 0.985, rgba(S.hot, 0.9 * S.cometA));
      cg2.addColorStop(tail / TAU, rgba(S.col, 0));
      cg2.addColorStop(1, rgba(S.col, 0));
      ex.strokeStyle = cg2;
      ex.lineWidth = lw * 6;
      ex.stroke();
      if (S.glow > 1.05) {
        ex.strokeStyle = rgba(S.hot, clamp((S.glow - 1.05) * 0.4));
        ex.lineWidth = lw * 10;
        ex.stroke();
      }
    }

    // ── iris (eye) / lens (device) inside the ring ────────────────────────
    inner(ctx, ex, S, m, mq) {
      const A = S.innerA;
      if (A <= 0.002) return;
      const R = S.innerR, eye = S.eye;
      ctx.save();
      this.dev(ctx, m, S, 0);
      superPath(ctx, S.ra * 0.994, Math.max(S.rb * 0.994, 0.0005), S.rpx, S.rpy);
      ctx.clip();
      ctx.globalAlpha = A;
      this.dev(ctx, m, S, -0.05);
      ctx.translate(S.lookX, S.lookY);

      // lens barrel (device)
      if (eye < 0.999) {
        ctx.globalAlpha = A * (1 - eye);
        let g = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R);
        g.addColorStop(0, '#0b0e12'); g.addColorStop(0.8, '#161a20'); g.addColorStop(1, '#22272e');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
        for (const [rr, c, w] of [[R * 0.985, 'rgba(255,255,255,0.16)', 1.4], [R * 0.84, 'rgba(0,0,0,0.6)', 2.5], [R * 0.82, 'rgba(255,255,255,0.08)', 1], [R * 0.68, 'rgba(255,255,255,0.10)', 1]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w * this.U / S.Z; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
        }
        // glass element with an iridescent coating
        const rg = R * 0.66;
        g = ctx.createRadialGradient(-rg * 0.2, -rg * 0.25, 0, 0, 0, rg);
        g.addColorStop(0, '#0e1826'); g.addColorStop(0.7, '#050911'); g.addColorStop(1, '#020305');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rg, 0, TAU); ctx.fill();
        const ig = ctx.createConicGradient(S.t * 0.3 + S.yaw * 3, 0, 0);
        ig.addColorStop(0, 'rgba(122,77,255,0.0)'); ig.addColorStop(0.15, 'rgba(122,77,255,0.32)');
        ig.addColorStop(0.32, 'rgba(49,255,168,0.0)'); ig.addColorStop(0.5, 'rgba(49,255,168,0.22)');
        ig.addColorStop(0.68, 'rgba(61,123,255,0.0)'); ig.addColorStop(0.84, 'rgba(61,123,255,0.3)'); ig.addColorStop(1, 'rgba(122,77,255,0.0)');
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = ig;
        ctx.beginPath(); ctx.arc(0, 0, rg, 0, TAU); ctx.arc(0, 0, S.pupil * 1.15, 0, TAU, true); ctx.fill('evenodd');
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = rgba(S.col, 0.55); ctx.lineWidth = 1.5 * this.U / S.Z;
        ctx.beginPath(); ctx.arc(0, 0, rg, 0, TAU); ctx.stroke();
      }
      // iris (eye)
      if (eye > 0.001) {
        ctx.globalAlpha = A * eye;
        let g = ctx.createRadialGradient(0, 0, S.pupil * 0.9, 0, 0, R);
        g.addColorStop(0, rgba(mix3(S.col, [0, 0, 0], 0.8), 1));
        g.addColorStop(0.35, rgba(mix3(S.col, [0, 0, 0], 0.52), 1));
        g.addColorStop(0.74, rgba(mix3(S.col, [0, 0, 0], 0.14), 1));
        g.addColorStop(0.9, rgba(mix3(S.col, S.hot, 0.4), 1));
        g.addColorStop(1, rgba(mix3(S.col, [0, 0, 0], 0.78), 1));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
        // fibres
        const n = 150, rot = S.t * 0.12;
        ctx.lineWidth = 1.2 * this.U / S.Z;
        for (let i = 0; i < n; i++) {
          const an = (i / n) * TAU + rot + hash(i) * 0.04;
          const r0 = S.pupil * 1.2, r1 = R * (0.72 + hash(i + 50) * 0.24);
          const bend = (hash(i + 99) - 0.5) * 0.3;
          ctx.strokeStyle = rgba(S.hot, 0.06 + hash(i + 7) * 0.3);
          ctx.beginPath();
          ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0);
          ctx.quadraticCurveTo(Math.cos(an + bend) * (r0 + r1) / 2, Math.sin(an + bend) * (r0 + r1) / 2, Math.cos(an) * r1, Math.sin(an) * r1);
          ctx.stroke();
        }
        // machine detail: an inner index ring around the pupil
        ctx.strokeStyle = rgba(S.hot, 0.5);
        ctx.lineWidth = 1.4 * this.U / S.Z;
        ctx.beginPath(); ctx.arc(0, 0, S.pupil * 1.28, 0, TAU); ctx.stroke();
        for (let i = 0; i < 24; i++) {
          const an = (i / 24) * TAU - rot * 2;
          ctx.strokeStyle = rgba(S.hot, i % 6 === 0 ? 0.85 : 0.4);
          ctx.beginPath();
          ctx.moveTo(Math.cos(an) * S.pupil * 1.42, Math.sin(an) * S.pupil * 1.42);
          ctx.lineTo(Math.cos(an) * S.pupil * (i % 6 === 0 ? 1.78 : 1.62), Math.sin(an) * S.pupil * (i % 6 === 0 ? 1.78 : 1.62));
          ctx.stroke();
        }
        ctx.strokeStyle = rgba(mix3(S.col, [0, 0, 0], 0.85), 0.95); ctx.lineWidth = 3.2 * this.U / S.Z;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.99, 0, TAU); ctx.stroke();
        // iris glow (clipped by the eyelids, like the iris itself)
        ex.save();
        this.dev(ex, mq, S, 0);
        superPath(ex, S.ra * 0.994, Math.max(S.rb * 0.994, 0.0005), S.rpx, S.rpy);
        ex.clip();
        this.dev(ex, mq, S, -0.05); ex.translate(S.lookX, S.lookY);
        ex.globalAlpha = A * eye;
        const eg = ex.createRadialGradient(0, 0, S.pupil, 0, 0, R * 1.05);
        eg.addColorStop(0, rgba(S.col, 0)); eg.addColorStop(0.85, rgba(S.col, 0.32)); eg.addColorStop(1, rgba(S.col, 0));
        ex.fillStyle = eg; ex.beginPath(); ex.arc(0, 0, R * 1.05, 0, TAU); ex.fill();
        ex.globalAlpha = 1;
        ex.restore();
      }
      // pupil + highlights (shared)
      ctx.globalAlpha = A;
      let g = ctx.createRadialGradient(0, 0, S.pupil * 0.6, 0, 0, S.pupil * 1.08);
      g.addColorStop(0, '#000000'); g.addColorStop(0.85, '#010203'); g.addColorStop(1, 'rgba(1,2,3,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, S.pupil * 1.08, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(-R * 0.3, -R * 0.33, R * 0.11, R * 0.075, -0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(R * 0.24, R * 0.22, R * 0.035, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // ── the clock (opening frame) ─────────────────────────────────────────
    clock(ctx, ex, S, m, mq) {
      const A = S.clockA;
      const showDigits = S.t < 2.9 || S.t >= 35.28;
      if (A <= 0.002 && !showDigits) return;
      this.dev(ctx, m, S, 0);
      const U = this.U;
      if (A > 0.002) {
        const cur = S.tick;
        for (let i = 0; i < 60; i++) {
          const an = (i / 60) * TAU - Math.PI / 2;
          const major = i % 5 === 0;
          const r0 = RING + 0.035, r1 = RING + (major ? 0.085 : 0.06);
          let d = cur - i; d = ((d % 60) + 60) % 60;
          const lit = d < 9 ? Math.pow(1 - d / 9, 2) : 0;
          const head = Math.max(0, 1 - Math.abs(cur - i - Math.round(cur - i)) * 3) * (Math.abs(cur - i) < 1.01 ? 1 : 0);
          const al = (0.26 + (major ? 0.14 : 0) + 0.7 * lit) * A;
          ctx.strokeStyle = lit > 0.02 ? rgba(mix3([200, 210, 225], S.hot, lit), al) : `rgba(200,210,225,${al})`;
          ctx.lineWidth = (major ? 2.4 : 1.6) * U / S.Z;
          ctx.beginPath();
          ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0);
          ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1);
          ctx.stroke();
          if (lit > 0.05) {
            this.dev(ex, mq, S, 0);
            ex.strokeStyle = rgba(S.col, lit * A);
            ex.lineWidth = 6 * U / S.Z;
            ex.beginPath(); ex.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ex.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ex.stroke();
            this.dev(ctx, m, S, 0);
          }
        }
        // the moving second hand: a bright bead on the ring
        const an = (cur / 60) * TAU - Math.PI / 2;
        ctx.fillStyle = rgba(S.hot, A);
        ctx.beginPath(); ctx.arc(Math.cos(an) * RING, Math.sin(an) * RING, 0.011, 0, TAU); ctx.fill();
        this.dev(ex, mq, S, 0);
        ex.fillStyle = rgba(S.col, A);
        ex.beginPath(); ex.arc(Math.cos(an) * RING, Math.sin(an) * RING, 0.04, 0, TAU); ex.fill();
      }
      if (showDigits) this.digits(ctx, ex, S, m, mq);
    }

    digits(ctx, ex, S, m, mq) {
      const ck = this.CFG.clock;
      const str = ck.hh + ':' + ck.mm;
      const out = S.t < 2.9 ? S.digitsOut : 0;
      const inn = S.t >= 35.28 ? S.digitsIn : 1;
      if (out >= 1 || inn <= 0) return;
      const size = 0.24;
      const adv = size * 0.6, colonAdv = size * 0.34;
      const total = adv * 4 + colonAdv;
      let x = -total / 2 - 0.012;
      this.dev(ctx, m, S, 0);
      ctx.save();
      const sc = 1 - 0.32 * E.inCubic(out);
      ctx.scale(sc, sc);
      const blurPx = (out * 22 + (1 - inn) * 18) * this.U;
      if (blurPx > 0.3) ctx.filter = `blur(${blurPx}px)`;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        const isColon = ch === ':';
        const w = isColon ? colonAdv : adv;
        // roll-in from below with a per-digit stagger
        const p = clamp((inn - i * 0.07) / 0.72);
        const e = E.outSoft(p);
        const dy = (1 - e) * 0.16;
        const a = clamp(p * 1.6) * (1 - out) * (isColon ? S.colonA : 1);
        this.textPx(ctx, S, ch, x + w / 2, 0.012 + dy, size, 300, FD, `rgba(243,246,250,${a})`, 0, 'center', 'middle');
        x += w;
      }
      ctx.restore();
      // AM marker
      const a2 = (1 - out) * clamp((inn - 0.35) / 0.5);
      this.dev(ctx, m, S, 0);
      this.textPx(ctx, S, ck.ampm, 0, 0.16, 0.042, 500, FM, rgba(S.hot, 0.75 * a2), 0.45);
      this.textPx(ctx, S, 'ALL QUIET', 0, -0.155, 0.03, 500, FM, `rgba(160,172,190,${0.75 * a2})`, 0.5);
    }

    // ── what Sentinel sees: night-vision viewfinder inside the ring ───────
    view(ctx, ex, S, m, mq) {
      const A = S.viewA;
      if (A <= 0.002) return;
      const U = this.U, t = S.t;
      ctx.save();
      this.dev(ctx, m, S, 0);
      superPath(ctx, S.ra * 0.992, S.rb * 0.992, S.rpx, S.rpy);
      ctx.clip();
      ctx.globalAlpha = A;
      ctx.scale(RING, RING); // ring radius = 1 inside here
      const px = (v) => (v * U) / (S.Z * RING);
      // dark night-vision feed
      let g = ctx.createRadialGradient(0, -0.1, 0, 0, 0, 1.3);
      g.addColorStop(0, '#06232b'); g.addColorStop(0.6, '#03121a'); g.addColorStop(1, '#010507');
      ctx.fillStyle = g; ctx.fillRect(-1.6, -1.6, 3.2, 3.2);

      // room in one-point perspective
      const VP = [0.04, 0.02];
      const back = { x0: -0.5, x1: 0.52, y0: -0.4, y1: 0.42 };
      const fr = (p, f) => [VP[0] + (p[0] - VP[0]) * f, VP[1] + (p[1] - VP[1]) * f];
      const lines = [];
      const BL = [back.x0, back.y1], BR = [back.x1, back.y1], TL = [back.x0, back.y0], TR = [back.x1, back.y0];
      lines.push([TL, TR], [TR, BR], [BR, BL], [BL, TL]);
      for (const c of [TL, TR, BR, BL]) lines.push([c, fr(c, 3.4)]);
      for (let i = 1; i < 7; i++) { // floor rays
        const x = lerp(back.x0, back.x1, i / 7);
        lines.push([[x, back.y1], fr([x, back.y1], 3.4)]);
      }
      for (const f of [1.18, 1.42, 1.78, 2.35]) lines.push([fr(BL, f), fr(BR, f)]); // floor depth lines
      for (const f of [1.3, 1.8]) { lines.push([fr(TL, f), fr(BL, f)]); lines.push([fr(TR, f), fr(BR, f)]); }
      // doorway (left) with the door ajar
      const D = { x0: -0.42, x1: -0.14, y0: -0.07 };
      lines.push([[D.x0, back.y1], [D.x0, D.y0]], [[D.x0, D.y0], [D.x1, D.y0]], [[D.x1, D.y0], [D.x1, back.y1]]);
      lines.push([[D.x1, D.y0], [D.x1 + 0.11, D.y0 - 0.05]], [[D.x1 + 0.11, D.y0 - 0.05], [D.x1 + 0.11, back.y1 + 0.07]], [[D.x1 + 0.11, back.y1 + 0.07], [D.x1, back.y1]]);
      // window (right)
      const Wn = { x0: 0.16, x1: 0.42, y0: -0.28, y1: 0.0 };
      lines.push([[Wn.x0, Wn.y0], [Wn.x1, Wn.y0]], [[Wn.x1, Wn.y0], [Wn.x1, Wn.y1]], [[Wn.x1, Wn.y1], [Wn.x0, Wn.y1]], [[Wn.x0, Wn.y1], [Wn.x0, Wn.y0]]);
      lines.push([[(Wn.x0 + Wn.x1) / 2, Wn.y0], [(Wn.x0 + Wn.x1) / 2, Wn.y1]], [[Wn.x0, (Wn.y0 + Wn.y1) / 2], [Wn.x1, (Wn.y0 + Wn.y1) / 2]]);
      // a sofa silhouette (right, on the floor)
      lines.push([[0.08, 0.42], [0.08, 0.27]], [[0.08, 0.27], [0.46, 0.27]], [[0.46, 0.27], [0.46, 0.42]], [[0.08, 0.33], [0.46, 0.33]]);

      // moonlight from the window
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(120,210,230,${0.07 * (0.4 + S.reveal)})`;
      ctx.fillRect(Wn.x0, Wn.y0, Wn.x1 - Wn.x0, Wn.y1 - Wn.y0);
      g = ctx.createLinearGradient(0, Wn.y1, 0, 0.9);
      g.addColorStop(0, `rgba(120,210,230,${0.05 * (0.4 + S.reveal)})`); g.addColorStop(1, 'rgba(120,210,230,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(Wn.x0, Wn.y1); ctx.lineTo(Wn.x1, Wn.y1); ctx.lineTo(Wn.x1 + 0.12, 0.85); ctx.lineTo(Wn.x0 - 0.18, 0.85); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // radar-revealed wireframe
      const sweepHL = (x, y) => {
        const ang = Math.atan2(y, x);
        let b = (S.sweepAng - ang) % TAU; if (b < 0) b += TAU;
        return Math.exp(-b * 1.7) * S.sweepA;
      };
      const base = 0.1 + 0.34 * S.reveal;
      ctx.lineCap = 'round';
      const nv = [90, 255, 220];
      for (const [p0, p1] of lines) {
        const seg = 10;
        for (let s = 0; s < seg; s++) {
          const a0 = s / seg, a1 = (s + 1) / seg;
          const x0 = lerp(p0[0], p1[0], a0), y0 = lerp(p0[1], p1[1], a0);
          const x1 = lerp(p0[0], p1[0], a1), y1 = lerp(p0[1], p1[1], a1);
          const hl = sweepHL((x0 + x1) / 2, (y0 + y1) / 2);
          const al = clamp(base + hl * 0.95);
          ctx.strokeStyle = rgba(mix3(nv, [255, 255, 255], hl * 0.5), al * 0.85);
          ctx.lineWidth = px(1.6 + hl * 1.2);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
      }
      // the sweep wedge itself
      if (S.sweepA > 0.01) {
        const cg = ctx.createConicGradient(S.sweepAng - 1.25, 0, 0);
        cg.addColorStop(0, 'rgba(90,255,220,0)');
        cg.addColorStop(1.25 / TAU, `rgba(90,255,220,${0.2 * S.sweepA})`);
        cg.addColorStop(1.25 / TAU + 0.002, 'rgba(90,255,220,0)');
        cg.addColorStop(1, 'rgba(90,255,220,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = cg; ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
        ctx.strokeStyle = `rgba(190,255,240,${0.55 * S.sweepA})`;
        ctx.lineWidth = px(1.6);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(S.sweepAng) * 1.4, Math.sin(S.sweepAng) * 1.4); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }

      // the intruder
      if (S.intrA > 0.002) this.intruder(ctx, ex, S, m, mq, px, sweepHL);

      // scanlines + grain shimmer + viewfinder marks
      ctx.globalAlpha = A * 0.55;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.scan;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
      ctx.globalAlpha = A;
      g = ctx.createRadialGradient(0, 0, 0.55, 0, 0, 1.02);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = g; ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
      // REC + timestamp
      const rec = Math.floor(t * 2) % 2 === 0;
      ctx.fillStyle = rgba(this.C.alert, rec ? 0.95 : 0.25);
      ctx.beginPath(); ctx.arc(-0.3, -0.73, 0.022, 0, TAU); ctx.fill();
      const ss = String(41 + Math.floor(t - 9)).padStart(2, '0');
      ctx.restore();
      ctx.save();
      this.dev(ctx, m, S, 0);
      ctx.globalAlpha = A;
      ctx.scale(RING, RING);
      const S2 = Object.assign({}, S, { Z: S.Z * RING });
      this.textPx(ctx, S2, `REC  03:07:${ss}`, 0.03, -0.73, 0.05, 500, FM, 'rgba(210,240,235,0.85)', 0.12);
      this.textPx(ctx, S2, 'IR · NIGHT VISION', 0, 0.75, 0.042, 500, FM, 'rgba(120,255,220,0.65)', 0.25);
      ctx.restore();
    }

    intruder(ctx, ex, S, m, mq, px, sweepHL) {
      const x = S.intrX, feet = 0.42, h = 0.5;
      const det = S.lock;
      const figure = (c, dx, scale = 1) => {
        const top = feet - h;
        const hx = x + dx;
        c.beginPath();
        c.arc(hx, top + 0.055, 0.052, 0, TAU);
        c.moveTo(hx - 0.085, top + 0.15);
        c.quadraticCurveTo(hx, top + 0.1, hx + 0.085, top + 0.15);
        c.lineTo(hx + 0.1, top + 0.3);
        c.lineTo(hx + 0.07, top + 0.31);
        c.lineTo(hx + 0.058, feet);
        c.lineTo(hx + 0.012, feet);
        c.lineTo(hx, top + 0.33);
        c.lineTo(hx - 0.012, feet);
        c.lineTo(hx - 0.058, feet);
        c.lineTo(hx - 0.07, top + 0.31);
        c.lineTo(hx - 0.1, top + 0.3);
        c.closePath();
      };
      const A = S.intrA;
      const hl = sweepHL(x, feet - h / 2);
      // motion echoes
      for (let k = 3; k >= 1; k--) {
        figure(ctx, -k * 0.03 * S.intrMove);
        ctx.fillStyle = rgba(S.col, 0.07 * A * S.intrMove * (4 - k) / 3 * (0.4 + det));
        ctx.fill();
      }
      figure(ctx, 0);
      const g = ctx.createLinearGradient(0, feet - h, 0, feet);
      g.addColorStop(0, rgba(mix3([20, 40, 44], S.col, det), A));
      g.addColorStop(1, rgba(mix3([6, 18, 20], mix3(S.col, [0, 0, 0], 0.5), det), A));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(mix3([120, 255, 230], S.hot, det), (0.35 + 0.65 * Math.max(det, hl)) * A);
      ctx.lineWidth = px(1.8);
      ctx.stroke();
      // glow
      ex.save();
      this.dev(ex, mq, S, 0);
      ex.scale(RING, RING);
      figure(ex, 0);
      ex.fillStyle = rgba(S.col, 0.55 * det * A);
      ex.fill();
      ex.restore();
      // lock-on brackets
      if (det > 0.001) {
        const cx = x, cy = feet - h / 2;
        const hw = 0.14 * lerp(2.3, 1, det), hh = 0.3 * lerp(1.8, 1, det);
        const arm = 0.05;
        ctx.strokeStyle = rgba(S.hot, det * A);
        ctx.lineWidth = px(2.4);
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const bx = cx + sx * hw, by = cy + sy * hh;
          ctx.beginPath();
          ctx.moveTo(bx - sx * arm, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by - sy * arm);
          ctx.stroke();
        }
        // label
        const txt = 'MOTION DETECTED';
        const n = Math.floor(S.lockLabel * txt.length);
        if (n > 0) {
          const S2 = Object.assign({}, S, { Z: S.Z * RING });
          ctx.fillStyle = rgba(S.col, 0.85 * A);
          const lx = cx - hw, ly = cy - hh - 0.135;
          ctx.fillRect(lx, ly - 0.035, 0.012, 0.07);
          this.textPx(ctx, S2, txt.slice(0, n), lx + 0.035, ly, 0.052, 600, FM, rgba(S.hot, A), 0.12, 'left', 'middle');
          this.textPx(ctx, S2, 'FRONT DOOR · PERSON', lx + 0.035, ly + 0.065, 0.04, 500, FM, rgba(S.hot, 0.6 * A * S.lockLabel), 0.12, 'left', 'middle');
        }
      }
    }

    // ── phone: the ring becomes your phone ────────────────────────────────
    phone(ctx, ex, S, m, mq) {
      const A = S.phoneA;
      if (A <= 0.002) return;
      const U = this.U, L = this.L;
      const pa = L.phoneA, pb = L.phoneB;
      ctx.save();
      this.dev(ctx, m, S, 0);
      superPath(ctx, S.ra * 0.99, S.rb * 0.99, S.rpx, S.rpy);
      ctx.clip();
      ctx.globalAlpha = A;
      // wallpaper
      let g = ctx.createLinearGradient(0, -pb, 0, pb);
      g.addColorStop(0, '#0a1220'); g.addColorStop(1, '#04060b');
      ctx.fillStyle = g; ctx.fillRect(-pa, -pb, pa * 2, pb * 2);
      g = ctx.createRadialGradient(pa * 0.3, pb * 0.45, 0, pa * 0.3, pb * 0.45, pb * 0.9);
      g.addColorStop(0, rgba(S.col, 0.38)); g.addColorStop(1, rgba(S.col, 0));
      ctx.fillStyle = g; ctx.fillRect(-pa, -pb, pa * 2, pb * 2);
      g = ctx.createRadialGradient(-pa * 0.6, -pb * 0.2, 0, -pa * 0.6, -pb * 0.2, pb * 0.7);
      g.addColorStop(0, 'rgba(70,90,255,0.22)'); g.addColorStop(1, 'rgba(70,90,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-pa, -pb, pa * 2, pb * 2);
      // island
      ctx.fillStyle = '#000';
      roundRect(ctx, -0.055, -pb + 0.035, 0.11, 0.032, 0.016); ctx.fill();
      // lock icon + time
      const lx = 0, ly = -pb * 0.80;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.8 * U / S.Z;
      ctx.beginPath(); ctx.arc(lx, ly - 0.006, 0.011, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      roundRect(ctx, lx - 0.016, ly - 0.006, 0.032, 0.024, 0.004); ctx.fill();
      this.textPx(ctx, S, 'Wednesday', 0, -pb * 0.67, 0.026, 500, FT, 'rgba(255,255,255,0.75)', 0.01);
      this.textPx(ctx, S, '3:07', 0, -pb * 0.5, 0.15, 500, FD, 'rgba(255,255,255,0.95)', -0.02);
      // notification card (slides down on a spring)
      const n = S.notif;
      const cw = pa * 1.8, ch = 0.172;
      const cy0 = -pb * 0.2;
      const cy = lerp(-pb - 0.25, cy0, n);
      const cx = -cw / 2;
      ctx.globalAlpha = A * S.notifA;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      roundRect(ctx, cx, cy, cw, ch, 0.035); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1 * U / S.Z; ctx.stroke();
      // app icon: the ring
      const ix = cx + 0.026, iy = cy + 0.028, is = 0.07;
      ctx.fillStyle = '#05080c'; roundRect(ctx, ix, iy, is, is, 0.016); ctx.fill();
      ctx.strokeStyle = rgba(S.hot, 1); ctx.lineWidth = 2.2 * U / S.Z;
      ctx.beginPath(); ctx.arc(ix + is / 2, iy + is / 2, is * 0.29, 0, TAU); ctx.stroke();
      ctx.fillStyle = rgba(S.hot, 1); ctx.beginPath(); ctx.arc(ix + is / 2, iy + is / 2, is * 0.09, 0, TAU); ctx.fill();
      const tx = ix + is + 0.022;
      const nt = this.CFG.notification;
      this.textPx(ctx, S, nt.app, tx, iy + 0.012, 0.024, 700, FT, 'rgba(255,255,255,0.65)', 0.08, 'left', 'middle');
      this.textPx(ctx, S, nt.when, cx + cw - 0.026, iy + 0.012, 0.024, 500, FT, 'rgba(255,255,255,0.5)', 0, 'right', 'middle');
      this.textPx(ctx, S, nt.title, tx, iy + 0.056, 0.035, 600, FT, 'rgba(255,255,255,0.98)', 0, 'left', 'middle');
      this.textPx(ctx, S, nt.body, tx, iy + 0.1, 0.027, 500, FT, 'rgba(255,255,255,0.72)', 0, 'left', 'middle');
      // snapshot thumbnail: the intruder Sentinel just caught
      const tw = 0.072, th2 = 0.094, tx2 = cx + cw - tw - 0.026, ty2 = cy + ch - th2 - 0.026;
      ctx.save();
      roundRect(ctx, tx2, ty2, tw, th2, 0.012); ctx.clip();
      ctx.fillStyle = '#04161b'; ctx.fillRect(tx2, ty2, tw, th2);
      ctx.fillStyle = rgba(S.col, 0.9);
      const hx = tx2 + tw / 2, hy = ty2 + 0.03;
      ctx.beginPath(); ctx.arc(hx, hy, 0.012, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx - 0.022, hy + 0.06); ctx.quadraticCurveTo(hx - 0.02, hy + 0.017, hx, hy + 0.017); ctx.quadraticCurveTo(hx + 0.02, hy + 0.017, hx + 0.022, hy + 0.06); ctx.closePath(); ctx.fill();
      ctx.restore();
      // card glow
      this.dev(ex, mq, S, 0);
      ex.globalAlpha = A * S.notifA * 0.6;
      ex.fillStyle = rgba(S.col, 0.5);
      roundRect(ex, cx, cy, cw, ch, 0.035); ex.fill();
      ex.globalAlpha = 1;
      // lock-screen buttons + home bar
      ctx.globalAlpha = A;
      for (const sx of [-1, 1]) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(sx * pa * 0.56, pb * 0.8, 0.036, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      roundRect(ctx, -0.06, pb * 0.955, 0.12, 0.008, 0.004); ctx.fill();
      ctx.restore();
    }

    // ── arming sequence ───────────────────────────────────────────────────
    armed(ctx, ex, S, m, mq) {
      if (S.armA <= 0.002) return;
      const n = 36, U = this.U;
      for (const [c, mm, w, al] of [[ctx, m, 5, 0.95], [ex, mq, 9, 0.9]]) {
        this.dev(c, mm, S, 0.01);
        c.lineCap = 'butt';
        for (let i = 0; i < n; i++) {
          const a0 = (i / n) * TAU - Math.PI / 2 + 0.02, a1 = ((i + 1) / n) * TAU - Math.PI / 2 - 0.02;
          const lit = clamp((S.arm * n - i) * 1.5);
          const a = (c === ctx ? 0.16 + 0.84 * lit : lit) * S.armA * (1 + 0.6 * S.armFlash);
          if (a < 0.01) continue;
          c.strokeStyle = rgba(lit > 0.5 ? S.hot : [150, 165, 185], clamp(a * al));
          c.lineWidth = (w * U) / S.Z;
          c.beginPath(); c.arc(0, 0, RING + 0.075, a0, a1); c.stroke();
        }
      }
    }

    // ── the price badge ───────────────────────────────────────────────────
    price(ctx, ex, S, m, mq) {
      const A = S.priceA;
      if (A <= 0.002 && S.badgeA <= 0.002) return;
      const U = this.U, t = S.t;
      this.dev(ctx, m, S, 0);
      ctx.save();
      // watch-bezel ticks that draw on
      const draw = clamp((t - 24.0) / 0.9);
      for (let i = 0; i < 120; i++) {
        if (i / 120 > E.outSoft(draw)) break;
        const an = (i / 120) * TAU - Math.PI / 2;
        const major = i % 10 === 0;
        const r0 = RING + 0.03, r1 = RING + (major ? 0.07 : 0.048);
        ctx.strokeStyle = `rgba(200,212,228,${(major ? 0.6 : 0.3) * A})`;
        ctx.lineWidth = (major ? 2 : 1.2) * U / S.Z;
        ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.stroke();
      }
      // rotating badge text
      if (S.badgeA > 0.002) {
        const txt = this.CFG.badge;
        const size = 0.034, R = RING + 0.115;
        ctx.font = `600 ${size * S.Z}px ${FM}`;
        if (!this.badgeW || this.badgeZ !== S.Z) {
          this.badgeZ = S.Z;
          this.badgeW = [...txt].map((c) => ctx.measureText(c).width / S.Z + size * 0.5);
        }
        const total = this.badgeW.reduce((a, b) => a + b, 0);
        const circ = TAU * R;
        const reps = Math.max(1, Math.round(circ / total));
        const stretch = circ / (total * reps);
        let an = -Math.PI / 2 + S.badgeRot;
        for (let r = 0; r < reps; r++) {
          [...txt].forEach((ch, i) => {
            const w = this.badgeW[i] * stretch;
            const mid = an + w / R / 2;
            ctx.save();
            ctx.rotate(mid);
            ctx.translate(R, 0);
            ctx.rotate(Math.PI / 2);
            ctx.scale(1 / S.Z, 1 / S.Z);
            ctx.font = `600 ${size * S.Z}px ${FM}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = ch === '•' ? rgba(S.col, S.badgeA) : `rgba(225,233,243,${0.85 * S.badgeA})`;
            ctx.fillText(ch, 0, 0);
            ctx.restore();
            an += w / R;
          });
        }
      }
      ctx.restore();
      if (A <= 0.002) return;
      // currency + odometer digits
      const val = this.CFG.price, cur = this.CFG.currency;
      const size = 0.205;
      const adv = size * 0.6, commaAdv = size * 0.3;
      const widths = [...val].map((c) => (c === ',' ? commaAdv : adv));
      const total = widths.reduce((a, b) => a + b, 0);
      const curW = size * 0.42;
      let x = -(total + curW) / 2 + curW;
      const y = 0.02;
      this.dev(ctx, m, S, 0);
      const ca = A * clamp((t - 24.1) / 0.4);
      this.textPx(ctx, S, cur, x - curW * 0.55, y - size * 0.16, size * 0.3, 600, FD, rgba(S.hot, ca), 0, 'center', 'middle');
      ctx.save();
      // clip a window for the rolling digits
      ctx.beginPath(); ctx.rect(-1, y - size * 0.62, 2, size * 1.24); ctx.clip();
      let di = 0;
      const shineX = lerp(-0.6, 0.6, S.shine);
      [...val].forEach((ch, i) => {
        const w = widths[i];
        const cxp = x + w / 2;
        if (ch === ',') {
          this.textPx(ctx, S, ',', cxp, y, size, 600, FD, `rgba(243,246,250,${A * clamp((t - 24.5) / 0.3)})`);
        } else {
          const target = parseInt(ch, 10);
          const t0 = 24.18 + di * 0.11;
          const p = E.outBackSoft(clamp((t - t0) / 0.8));
          const rolls = 9 + di * 3;
          const pos = target + rolls * (1 - p); // fractional digit index
          const lh = size * 1.35;
          for (let k = -1; k <= 1; k++) {
            const idx = Math.floor(pos) + k;
            const dgt = ((idx % 10) + 10) % 10;
            const yy = y + (idx - pos) * lh;
            if (Math.abs(yy - y) > lh * 1.2 || (k !== 0 && Math.abs(Math.abs(yy - y) - lh) < 1e-6)) continue;
            const a = A * clamp((t - t0 + 0.1) / 0.25) * (1 - clamp(Math.abs(yy - y) / lh) * 0.7);
            const shine = Math.exp(-Math.pow((cxp - shineX) / 0.09, 2)) * (S.shine > 0 && S.shine < 1 ? 1 : 0);
            const col = mix3([232, 238, 246], [255, 255, 255], shine);
            this.textPx(ctx, S, String(dgt), cxp, yy, size, 600, FD, rgba(col, a));
          }
          di++;
        }
        x += w;
      });
      ctx.restore();
      // under-price line
      this.textPx(ctx, S, 'ONE-TIME', 0, 0.175, 0.034, 600, FM, rgba(S.hot, 0.8 * A * clamp((t - 24.9) / 0.5)), 0.5);
      // glow behind the number
      this.dev(ex, mq, S, 0);
      const gg = ex.createRadialGradient(0, 0, 0, 0, 0, RING * 0.9);
      gg.addColorStop(0, rgba(S.col, 0.16 * A)); gg.addColorStop(1, rgba(S.col, 0));
      ex.fillStyle = gg; ex.beginPath(); ex.arc(0, 0, RING * 0.9, 0, TAU); ex.fill();
    }

    // ── bloom ─────────────────────────────────────────────────────────────
    bloom(ctx, S) {
      const { W, H, U } = this;
      const b1 = this.b1x, b2 = this.b2x, b3 = this.b3x;
      b1.setTransform(1, 0, 0, 1, 0, 0); b1.clearRect(0, 0, this.b1.width, this.b1.height);
      b1.filter = `blur(${2.2 * U}px)`; b1.drawImage(this.e, 0, 0); b1.filter = 'none';
      b2.setTransform(1, 0, 0, 1, 0, 0); b2.clearRect(0, 0, this.b2.width, this.b2.height);
      b2.filter = `blur(${3 * U}px)`; b2.drawImage(this.e, 0, 0, this.b2.width, this.b2.height); b2.filter = 'none';
      b3.setTransform(1, 0, 0, 1, 0, 0); b3.clearRect(0, 0, this.b3.width, this.b3.height);
      b3.filter = `blur(${3.5 * U}px)`; b3.drawImage(this.e, 0, 0, this.b3.width, this.b3.height); b3.filter = 'none';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingQuality = 'high';
      ctx.globalAlpha = 0.95; ctx.drawImage(this.b1, 0, 0, W, H);
      ctx.globalAlpha = 0.85; ctx.drawImage(this.b2, 0, 0, W, H);
      ctx.globalAlpha = 0.75; ctx.drawImage(this.b3, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // ── viewfinder HUD ────────────────────────────────────────────────────
    hud(ctx, S, t) {
      const { W, H, U, L } = this;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const m = 56 * U, arm = 40 * U;
      const top = L.portrait ? 150 * U : m, bot = L.portrait ? H - 170 * U : H - m;
      ctx.strokeStyle = 'rgba(220,230,242,0.28)';
      ctx.lineWidth = 2 * U;
      for (const [x, y, sx, sy] of [[m, top, 1, 1], [W - m, top, -1, 1], [W - m, bot, -1, -1], [m, bot, 1, -1]]) {
        ctx.beginPath(); ctx.moveTo(x, y + sy * arm); ctx.lineTo(x, y); ctx.lineTo(x + sx * arm, y); ctx.stroke();
      }
      // section read-out with a decode/scramble transition
      const list = this.CFG.hud;
      let idx = 0;
      for (let i = 0; i < list.length; i++) if (t >= list[i][0]) idx = i;
      let [t0, label] = list[idx];
      let age = t - t0;
      const T = this.CFG.duration;
      if (t >= T - 0.75) { label = list[0][1]; age = t - (T - 0.75); }
      else if (idx === 0) age = t + 0.75;
      let out = '';
      for (let i = 0; i < label.length; i++) {
        const ch = label[i];
        const reveal = 0.02 * i + 0.12;
        if (age < 0.02 * i) out += ' ';
        else if (age < reveal && ch !== ' ') out += this.glyphs[Math.floor(hash(i * 31 + Math.floor(t * 30)) * this.glyphs.length)];
        else out += ch;
      }
      ctx.font = `500 ${21 * U}px ${FM}`;
      ctx.letterSpacing = `${3.2 * U}px`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const hotLabel = /DETECTED|SIREN/.test(label);
      ctx.fillStyle = hotLabel ? rgba(S.hot, 0.92) : 'rgba(205,216,230,0.72)';
      ctx.fillRect(m + 20 * U, top + 22 * U - 7 * U, 3 * U, 14 * U);
      ctx.fillText(out, m + 34 * U, top + 22 * U);
      // live dot
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(205,216,230,0.72)';
      ctx.fillText('LIVE', W - m - 20 * U, top + 22 * U);
      const tw = ctx.measureText('LIVE').width;
      const blink = 0.35 + 0.65 * (Math.floor(t / 0.75) % 2 === 0 ? 1 : 0.25);
      ctx.fillStyle = rgba(this.C.alert, blink);
      ctx.beginPath(); ctx.arc(W - m - 20 * U - tw - 16 * U, top + 22 * U, 6 * U, 0, TAU); ctx.fill();
      ctx.letterSpacing = '0px';
    }

    finish(ctx, S, frame) {
      const { W, H } = this;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // alarm vignette
      if (S.alarmA > 0.002) {
        const e = this.alarmEnv(S.t) * S.alarmA;
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
        g.addColorStop(0, rgba(this.C.alert, 0)); g.addColorStop(1, rgba(this.C.alert, 0.22 * e));
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (S.flash > 0.002) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(S.hot, 0.2 * S.flash);
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(this.vig, 0, 0);
      if (this.ditherAmp > 0) {
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = this.ditherAmp;
        ctx.fillStyle = this.dither;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      // grain: new pattern + offset every frame
      const k = Math.floor((frame >>> 0) / 3); // new grain 20 times a second
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.5 * this.grainAmp;
      ctx.fillStyle = this.grain[k % 4];
      const ox = Math.floor(hash(k * 3 + 1) * 512), oy = Math.floor(hash(k * 5 + 2) * 512);
      ctx.translate(-ox, -oy);
      ctx.fillRect(ox, oy, W, H);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  window.Scene = Scene;
  window.SceneUtil = { superPath, roundRect };
})();
