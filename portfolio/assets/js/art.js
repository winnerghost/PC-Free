/* IRIS ARDEN — art.js
   1. drawAperture(): the iris diaphragm used by page transitions, the f-stop
      meter, the process panels and the Lab.
   2. Generative project covers. Every project draws its own artwork from a
      seed, so the site ships with no image files at all. */
(function () {
  "use strict";
  const IA = window.IA;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------
     Aperture
     open: 0 = fully closed, 1 = fully open (blades outside the frame)
     The exterior of the regular opening polygon is split into N wedges by
     extending each polygon edge past its end vertex: a pinwheel, which reads
     exactly like overlapping camera blades.
     ------------------------------------------------------------------ */
  function drawAperture(ctx, w, h, open, o = {}) {
    const N = o.blades || 7;
    const cx = o.cx != null ? o.cx : w / 2;
    const cy = o.cy != null ? o.cy : h / 2;
    const Rfull = o.R || (Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) / Math.cos(Math.PI / N)) + 4;
    const r = Rfull * IA.clamp(open, 0, 1);
    const rot = (o.rotation || -Math.PI / 2) + (1 - open) * (o.twist != null ? o.twist : 1.25);
    const BIG = Rfull * 6 + 2000;
    const step = TAU / N;
    const theme = o.colors || {};
    const blade = theme.blade || [29, 15, 25];
    const blade2 = theme.blade2 || [43, 22, 36];
    const edge = theme.edge || [[255, 181, 154], [245, 154, 185], [194, 176, 255], [159, 240, 212]];

    if (o.clip != null && o.clip <= 0) return;
    ctx.save();
    if (o.clip) {
      ctx.beginPath();
      ctx.arc(cx, cy, o.clip, 0, TAU);
      ctx.clip();
    }
    const verts = [];
    for (let i = 0; i < N; i++) {
      const a = rot + i * step;
      verts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    for (let i = 0; i < N; i++) {
      const apex = verts[(i + 1) % N];
      const a0 = rot + i * step + Math.PI / 2 + step / 2;
      const a1 = a0 + step;
      const p0 = [apex[0] + Math.cos(a0) * BIG, apex[1] + Math.sin(a0) * BIG];
      const p1 = [apex[0] + Math.cos(a1) * BIG, apex[1] + Math.sin(a1) * BIG];
      const shade = 0.5 + 0.5 * Math.sin(i * 2.399 + 0.7);
      const base = IA.mixRgb(blade, blade2, shade * 0.85);
      const lit = IA.mixRgb(base, blade2, 0.6);
      const gx = apex[0] + Math.cos(a1) * Rfull * 0.6;
      const gy = apex[1] + Math.sin(a1) * Rfull * 0.6;
      const g = ctx.createLinearGradient(apex[0], apex[1], gx, gy);
      g.addColorStop(0, IA.rgba(lit, 1));
      g.addColorStop(1, IA.rgba(base, 1));
      ctx.beginPath();
      ctx.moveTo(apex[0], apex[1]);
      ctx.lineTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }
    // leading edges: thin opal light along each blade edge
    const lw = o.lineWidth || 1;
    for (let i = 0; i < N; i++) {
      const apex = verts[(i + 1) % N];
      const a1 = rot + i * step + Math.PI / 2 + step / 2 + step;
      const len = Math.max(r * 2.2, Rfull * 0.5);
      const ex = apex[0] + Math.cos(a1) * len, ey = apex[1] + Math.sin(a1) * len;
      const c = edge[i % edge.length];
      const g = ctx.createLinearGradient(apex[0], apex[1], ex, ey);
      g.addColorStop(0, IA.rgba(c, o.edgeAlpha != null ? o.edgeAlpha : 0.75));
      g.addColorStop(1, IA.rgba(c, 0));
      ctx.beginPath();
      ctx.moveTo(apex[0], apex[1]);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = g;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    if (o.ring) {
      ctx.beginPath();
      ctx.arc(cx, cy, o.clip || Rfull, 0, TAU);
      ctx.strokeStyle = IA.rgba(o.ring, 0.5);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------
     Generative covers
     ------------------------------------------------------------------ */
  const rgb = (hex) => IA.hexToRgb(hex);

  function bgGradient(ctx, w, h, a, b, x = 0.6, y = 0.4) {
    const g = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, Math.max(w, h) * 0.95);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function vignette(ctx, w, h, strength = 0.55) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function grain(ctx, w, h, r, amount = 0.05) {
    const n = Math.floor((w * h) / 90);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${amount * r()})` : `rgba(0,0,0,${amount * r()})`;
      ctx.fillRect(r() * w, r() * h, 1, 1);
    }
  }

  const styles = {
    /* Halden — orbits around a lit planet */
    orbits(ctx, w, h, r, P, t, k) {
      bgGradient(ctx, w, h, P[1], P[0], 0.68, 0.3);
      const S = Math.min(w, h);
      for (let i = 0; i < 380; i++) {
        const x = r() * w, y = r() * h, s = (r() * 1.3 + 0.3) * k;
        const tw = 0.5 + 0.5 * Math.sin(t * (0.5 + r() * 2) + i);
        ctx.fillStyle = `rgba(244,237,231,${(0.15 + r() * 0.6) * (0.55 + 0.45 * tw)})`;
        ctx.fillRect(x, y, s, s);
      }
      const cx = w * 0.62, cy = h * 0.52;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.32);
      const orbitCount = 10;
      for (let i = 0; i < orbitCount; i++) {
        const rx = S * (0.16 + i * 0.07), ry = rx * 0.36;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.strokeStyle = `rgba(244,237,231,${0.07 + 0.05 * ((i + 1) % 3 === 0)})`;
        ctx.lineWidth = k;
        ctx.stroke();
        const a = r() * TAU + t * (0.35 / (i + 1));
        const px = Math.cos(a) * rx, py = Math.sin(a) * ry;
        const c = rgb(P[2 + (i % 2)]);
        const gg = ctx.createRadialGradient(px, py, 0, px, py, 14 * k);
        gg.addColorStop(0, IA.rgba(c, 0.95));
        gg.addColorStop(1, IA.rgba(c, 0));
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(px, py, 14 * k, 0, TAU);
        ctx.fill();
        ctx.fillStyle = IA.rgba([255, 255, 255], 0.95);
        ctx.beginPath();
        ctx.arc(px, py, 1.8 * k, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      // planet with opal limb
      const pr = S * 0.15;
      const body = ctx.createRadialGradient(cx - pr * 0.4, cy - pr * 0.5, pr * 0.1, cx, cy, pr);
      body.addColorStop(0, P[1]);
      body.addColorStop(1, P[0]);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, pr, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const limb = ctx.createLinearGradient(cx - pr, cy - pr, cx + pr, cy + pr);
      limb.addColorStop(0, P[3]);
      limb.addColorStop(0.5, P[2]);
      limb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.strokeStyle = limb;
      ctx.lineWidth = 2.5 * k;
      ctx.shadowColor = P[2];
      ctx.shadowBlur = 24 * k;
      ctx.beginPath();
      ctx.arc(cx, cy, pr, Math.PI * 0.85 + Math.sin(t * 0.3) * 0.1, Math.PI * 1.85);
      ctx.stroke();
      ctx.restore();
      vignette(ctx, w, h, 0.5);
    },

    /* Ophira — folds of silk light */
    silk(ctx, w, h, r, P, t, k, live) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, P[0]);
      g.addColorStop(1, P[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const n = live ? 56 : 80;
      const f1 = 0.9 + r() * 0.6, f2 = 2.2 + r() * 1.2, ph = r() * 10;
      const lg = ctx.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, P[2]);
      lg.addColorStop(0.5, P[3]);
      lg.addColorStop(1, P[4]);
      ctx.strokeStyle = lg;
      const stepX = Math.max(6, 10 * k);
      for (let i = 0; i < n; i++) {
        const u = i / n;
        ctx.globalAlpha = 0.05 + 0.22 * Math.pow(Math.sin(u * Math.PI), 2);
        ctx.lineWidth = (0.8 + 1.4 * Math.sin(u * Math.PI)) * k;
        ctx.beginPath();
        for (let x = -20; x <= w + 20; x += stepX) {
          const X = x / w;
          const y =
            h * (0.18 + u * 0.64) +
            Math.sin(X * f1 * Math.PI + ph + u * 2.4 + t * 0.35) * h * 0.17 * (1 - u * 0.35) +
            Math.sin(X * f2 * Math.PI + ph * 1.3 - u * 3.1 + t * 0.22) * h * 0.05;
          if (x === -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      vignette(ctx, w, h, 0.45);
    },

    /* Northlight — rings that listen */
    rings(ctx, w, h, r, P, t, k, live, seed) {
      bgGradient(ctx, w, h, P[1], P[0], 0.5, 0.5);
      const noise = IA.makeNoise(seed);
      const S = Math.min(w, h);
      const cx = w * 0.5, cy = h * 0.5;
      const count = live ? 40 : 52;
      const steps = live ? 110 : 160;
      const c1 = rgb(P[2]), c2 = rgb(P[3]);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < count; i++) {
        const u = i / count;
        const base = S * (0.1 + u * 0.36);
        const amp = S * 0.035 * (0.25 + u) * (0.6 + 0.4 * Math.sin(i * 0.37 + t * 1.2));
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const a = (s / steps) * TAU;
          const nn = noise.n2(Math.cos(a) * 1.6 + i * 0.06, Math.sin(a) * 1.6 + t * 0.18 + i * 0.03);
          const rr = base + nn * amp * 2;
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const c = IA.mixRgb(c1, c2, u);
        ctx.strokeStyle = IA.rgba(c, 0.12 + 0.4 * Math.pow(1 - Math.abs(u - 0.55) * 1.6, 2));
        ctx.lineWidth = 1.1 * k;
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = P[0];
      ctx.beginPath();
      ctx.arc(cx, cy, S * 0.075, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = IA.rgba(rgb(P[4]), 0.35);
      ctx.lineWidth = k;
      ctx.beginPath();
      ctx.arc(cx, cy, S * 0.075, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = P[4];
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5 * k, 0, TAU);
      ctx.fill();
      vignette(ctx, w, h, 0.4);
    },

    /* Tessellate — glass tiles, a motion grid */
    tiles(ctx, w, h, r, P, t, k) {
      ctx.fillStyle = P[0];
      ctx.fillRect(0, 0, w, h);
      const cols = 7;
      const cell = w / cols;
      const rows = Math.ceil(h / cell) + 1;
      const gap = cell * 0.08;
      const c2 = rgb(P[2]), c3 = rgb(P[3]), c4 = rgb(P[4]), c1 = rgb(P[1]);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = r();
          const px = x * cell + gap / 2, py = y * cell - cell * 0.3 + gap / 2;
          const s = cell - gap;
          const wave = 0.5 + 0.5 * Math.sin(t * 0.9 + x * 0.6 + y * 0.45);
          ctx.save();
          ctx.translate(px + s / 2, py + s / 2);
          const lit = v > 0.72;
          const base = lit ? IA.mixRgb(c2, c3, (x + y) / (cols + rows)) : c1;
          const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
          g.addColorStop(0, IA.rgba(base, lit ? 0.9 : 0.55));
          g.addColorStop(1, IA.rgba(lit ? c4 : c1, lit ? 0.25 + 0.3 * wave : 0.25));
          ctx.fillStyle = g;
          if (v < 0.2) {
            ctx.beginPath();
            ctx.arc(0, 0, s / 2, 0, TAU);
            ctx.fill();
          } else if (v < 0.36) {
            ctx.rotate(Math.floor(r() * 4) * (Math.PI / 2) + (lit ? t * 0.2 : 0));
            ctx.beginPath();
            ctx.moveTo(-s / 2, -s / 2);
            ctx.arc(-s / 2, -s / 2, s, 0, Math.PI / 2);
            ctx.closePath();
            ctx.fill();
          } else {
            const rad = s * 0.22;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(-s / 2, -s / 2, s, s, rad) : ctx.rect(-s / 2, -s / 2, s, s);
            ctx.fill();
          }
          ctx.strokeStyle = `rgba(255,255,255,${lit ? 0.35 : 0.06})`;
          ctx.lineWidth = k;
          ctx.beginPath();
          ctx.moveTo(-s / 2 + s * 0.2, -s / 2 + 1);
          ctx.lineTo(s / 2 - s * 0.2, -s / 2 + 1);
          ctx.stroke();
          ctx.restore();
        }
      }
      vignette(ctx, w, h, 0.55);
    },

    /* Atlas of Tides — currents traced by particles */
    flow(ctx, w, h, r, P, t, k, live, seed) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, P[0]);
      g.addColorStop(1, P[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const noise = IA.makeNoise(seed);
      const lines = live ? 360 : 1100;
      const steps = live ? 34 : 54;
      const sc = 0.0021 / k;
      const len = 2.4 * k;
      const c2 = rgb(P[2]), c3 = rgb(P[3]), c4 = rgb(P[4]);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 0.9 * k;
      for (let i = 0; i < lines; i++) {
        let x = r() * w, y = r() * h;
        const u = y / h;
        const c = u < 0.5 ? IA.mixRgb(c2, c3, u * 2) : IA.mixRgb(c3, c4, (u - 0.5) * 2);
        ctx.strokeStyle = IA.rgba(c, 0.08 + r() * 0.28);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < steps; s++) {
          const a = noise.fbm(x * sc, y * sc + t * 0.05, 3) * TAU * 1.7;
          x += Math.cos(a) * len;
          y += Math.sin(a) * len;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      vignette(ctx, w, h, 0.5);
    },

    /* Kintsu — a mended bowl seen from above */
    cracks(ctx, w, h, r, P, t, k) {
      bgGradient(ctx, w, h, P[1], P[0], 0.45, 0.35);
      const S = Math.min(w, h);
      const cx = w * 0.5, cy = h * 0.53, R = S * 0.38;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 40 * k;
      ctx.shadowOffsetY = 18 * k;
      const bowl = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      bowl.addColorStop(0, "#3a3238");
      bowl.addColorStop(0.7, "#251f25");
      bowl.addColorStop(1, "#1a161a");
      ctx.fillStyle = bowl;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(244,237,231,0.14)";
      ctx.lineWidth = 1.5 * k;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.97, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = "rgba(244,237,231,0.06)";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.42, 0, TAU);
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.965, 0, TAU);
      ctx.clip();
      const gold = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      const sh = (Math.sin(t * 0.6) + 1) / 2;
      gold.addColorStop(0, P[2]);
      gold.addColorStop(IA.clamp(0.3 + sh * 0.4, 0.05, 0.95), "#fff4dc");
      gold.addColorStop(1, P[3]);
      ctx.strokeStyle = gold;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = P[2];
      ctx.shadowBlur = 10 * k;
      const crack = (x, y, a, len, width, depth) => {
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        let segs = 6 + Math.floor(r() * 6);
        for (let i = 0; i < segs; i++) {
          a += (r() - 0.5) * 0.9;
          const l = len / segs;
          x += Math.cos(a) * l;
          y += Math.sin(a) * l;
          ctx.lineTo(x, y);
          if (depth < 3 && r() < 0.22) {
            ctx.stroke();
            crack(x, y, a + (r() > 0.5 ? 0.9 : -0.9), len * 0.45, width * 0.6, depth + 1);
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(x, y);
          }
        }
        ctx.stroke();
      };
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = r() * TAU;
        crack(cx + Math.cos(a) * R, cy + Math.sin(a) * R, a + Math.PI + (r() - 0.5) * 0.6, R * (0.9 + r() * 0.8), (2.6 + r() * 1.6) * k, 0);
      }
      ctx.restore();
      grain(ctx, w, h, r, 0.06);
      vignette(ctx, w, h, 0.4);
    },
  };

  const cache = new Map();

  function render(ctx, w, h, project, opts = {}) {
    const seed = IA.hashStr(project.slug) + (opts.variant || 0) * 7919;
    const r = IA.rng(seed);
    const k = Math.max(0.5, Math.min(w, h) / 600);
    const fn = styles[project.cover.style] || styles.silk;
    ctx.save();
    if (opts.zoom) {
      ctx.translate(w / 2, h / 2);
      ctx.scale(opts.zoom, opts.zoom);
      ctx.translate(-w / 2 + (opts.panX || 0) * w, -h / 2 + (opts.panY || 0) * h);
    }
    fn(ctx, w, h, r, project.cover.palette, opts.t || 0, k, !!opts.live, seed);
    ctx.restore();
  }

  /* draw a project's cover into a canvas (sized from its CSS box) */
  function paint(canvas, project, opts = {}) {
    const { w, h } = IA.fitCanvas(canvas, opts.maxDpr || 1.75, opts.scale || 1);
    render(canvas.getContext("2d"), w, h, project, opts);
    return canvas;
  }

  /* cached offscreen render, for quick reuse (hover previews, thumbnails) */
  function cover(project, w, h, variant = 0) {
    const key = `${project.slug}:${w}x${h}:${variant}`;
    if (cache.has(key)) return cache.get(key);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const c = document.createElement("canvas");
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    render(c.getContext("2d"), c.width, c.height, project, { variant });
    cache.set(key, c);
    return c;
  }

  /* copy a cached cover into a visible canvas with object-fit: cover semantics */
  function blit(target, src) {
    const { w, h } = IA.fitCanvas(target, 1.75);
    const ctx = target.getContext("2d");
    const s = Math.max(w / src.width, h / src.height);
    const dw = src.width * s, dh = src.height * s;
    ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  IA.art = { drawAperture, paint, cover, blit, styles };
})();
