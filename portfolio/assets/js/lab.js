/* SYED ARHAM ASHRAF — lab.js
   Four live experiments. Each one only runs while it is on screen. */
(function () {
  "use strict";
  const IA = window.IA;
  const { $, $$ } = IA;
  const P = (IA.pages = IA.pages || {});

  function pointer(canvas, scope) {
    const p = { x: -1e4, y: -1e4, down: false, active: false, last: 0, px: -1e4, py: -1e4 };
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const s = canvas.width / r.width;
      p.x = (e.clientX - r.left) * s;
      p.y = (e.clientY - r.top) * s;
      p.active = true;
      p.last = performance.now();
    };
    scope.on(canvas, "pointermove", pos);
    scope.on(canvas, "pointerdown", (e) => { pos(e); p.down = true; p.px = p.x; p.py = p.y; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
    scope.on(canvas, "pointerup", () => (p.down = false));
    scope.on(canvas, "pointercancel", () => (p.down = false));
    scope.on(canvas, "pointerleave", () => { p.active = false; p.down = false; p.x = p.y = -1e4; });
    return p;
  }

  /* 1 ─ Field type: a word made of particles that scatter from your hand */
  function fieldType(card, scope) {
    const canvas = $("canvas", card);
    const ptr = pointer(canvas, scope);
    const words = ["ARHAM", "IDEAS", "BUILD", "QLIVE"];
    let wi = 0, parts = [], w = 0, h = 0, dpr = 1;
    const sample = (word) => {
      const off = document.createElement("canvas");
      const s = 0.5;
      off.width = Math.max(1, Math.round(w * s));
      off.height = Math.max(1, Math.round(h * s));
      const o = off.getContext("2d");
      let size = off.height * 0.62;
      o.font = `800 ${size}px Syne, "Arial Black", sans-serif`;
      const mw = o.measureText(word).width;
      if (mw > off.width * 0.86) size *= (off.width * 0.86) / mw;
      o.font = `800 ${size}px Syne, "Arial Black", sans-serif`;
      o.textAlign = "center";
      o.textBaseline = "middle";
      o.fillStyle = "#fff";
      o.fillText(word, off.width / 2, off.height / 2 + size * 0.04);
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const gap = Math.max(2, Math.round(off.width / 190));
      const pts = [];
      for (let y = 0; y < off.height; y += gap) for (let x = 0; x < off.width; x += gap) if (data[(y * off.width + x) * 4 + 3] > 128) pts.push([x / s, y / s]);
      return pts;
    };
    const assign = () => {
      const pts = sample(words[wi]);
      // shuffle so particles travel across the word
      for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
      while (parts.length < pts.length) parts.push({ x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, tx: 0, ty: 0, on: true, c: 0 });
      parts.forEach((p, i) => {
        if (i < pts.length) { p.tx = pts[i][0]; p.ty = pts[i][1]; p.on = true; }
        else { p.on = false; p.tx = Math.random() * w; p.ty = h + 40; }
        p.c = Math.min(7, Math.floor((p.tx / w) * 8));
      });
    };
    const resize = () => {
      ({ w, h, dpr } = IA.fitCanvas(canvas, 1.5));
      assign();
    };
    let ready = false;
    const start = () => { if (!ready) { ready = true; resize(); } };
    scope.on(window, "resize", () => ready && resize());
    if (document.fonts) document.fonts.ready.then(() => ready && !scope.dead && assign());
    scope.on(canvas, "click", () => { wi = (wi + 1) % words.length; assign(); idle = 0; });
    let idle = 0;
    return {
      start,
      frame(dt) {
        const ctx = canvas.getContext("2d");
        const c = IA.colors;
        const pal = [c.peach, c.rose, c.lilac, c.jade];
        ctx.fillStyle = IA.rgba(c.bg, 1);
        ctx.fillRect(0, 0, w, h);
        idle += dt;
        if (idle > 7) { idle = 0; wi = (wi + 1) % words.length; assign(); }
        const R = 90 * dpr, R2 = R * R;
        const buckets = Array.from({ length: 8 }, () => []);
        for (const p of parts) {
          p.vx += (p.tx - p.x) * 0.05;
          p.vy += (p.ty - p.y) * 0.05;
          const dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const f = (1 - d2 / R2) * (ptr.down ? 14 : 6);
            const d = Math.sqrt(d2) || 1;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
          p.vx *= 0.82;
          p.vy *= 0.82;
          p.x += p.vx;
          p.y += p.vy;
          if (p.on || p.y < h) buckets[p.c].push(p);
        }
        const s = Math.max(2.4, 2.6 * dpr);
        buckets.forEach((b, i) => {
          const u = (i / 7) * 3, k = Math.floor(u);
          ctx.fillStyle = IA.rgba(IA.mixRgb(pal[k], pal[Math.min(3, k + 1)], u - k), 1);
          ctx.beginPath();
          for (const p of b) { ctx.moveTo(p.x + s / 2, p.y); ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2); }
          ctx.fill();
        });
      },
    };
  }

  /* 2 ─ Long exposure: paint with light; it fades like a slow shutter */
  function longExposure(card, scope) {
    const canvas = $("canvas", card);
    const ptr = pointer(canvas, scope);
    let mirror = 1, hue = 0, w = 0, h = 0, dpr = 1, gx = 0, gy = 0, gpx = null, gpy = null, gt = 0;
    const btn = $("[data-mirror]", card);
    if (btn) scope.on(btn, "click", () => {
      mirror = mirror === 1 ? 6 : 1;
      btn.setAttribute("aria-pressed", String(mirror > 1));
      btn.textContent = mirror > 1 ? "Mirror ×6 on" : "Mirror ×6";
    });
    const clr = $("[data-clear]", card);
    const clear = () => {
      const ctx = canvas.getContext("2d");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = IA.rgba(IA.colors.bg, 1);
      ctx.fillRect(0, 0, w, h);
    };
    if (clr) scope.on(clr, "click", clear);
    scope.on(document, "ia:theme", clear);
    const start = () => { ({ w, h, dpr } = IA.fitCanvas(canvas, 1.5)); clear(); };
    scope.on(window, "resize", start);
    const stroke = (ctx, x0, y0, x1, y1, col, speed) => {
      const cx = w / 2, cy = h / 2;
      for (let m = 0; m < mirror; m++) {
        const a = (m / mirror) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const rx = (x, y) => cx + (x - cx) * ca - (y - cy) * sa;
        const ry = (x, y) => cy + (x - cx) * sa + (y - cy) * ca;
        const ax = rx(x0, y0), ay = ry(x0, y0), bx = rx(x1, y1), by = ry(x1, y1);
        ctx.strokeStyle = IA.rgba(col, 0.12);
        ctx.lineWidth = (10 + speed * 0.6) * dpr;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = IA.rgba(col, 0.9);
        ctx.lineWidth = (1.4 + speed * 0.05) * dpr;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
    };
    return {
      start,
      frame(dt, t) {
        const ctx = canvas.getContext("2d");
        const c = IA.colors;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = IA.rgba(c.bg, 0.035);
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = c.light ? "multiply" : "lighter";
        ctx.lineCap = "round";
        hue = (hue + dt * 0.12) % 1;
        const pal = [c.peach, c.rose, c.lilac, c.jade];
        const u = hue * 4, k = Math.floor(u) % 4;
        const col = IA.mixRgb(pal[k], pal[(k + 1) % 4], u - Math.floor(u));
        const idleFor = performance.now() - ptr.last;
        if (ptr.active && idleFor < 2500) {
          if (ptr.px > -1e3) stroke(ctx, ptr.px, ptr.py, ptr.x, ptr.y, col, Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py) / dpr);
          ptr.px = ptr.x; ptr.py = ptr.y;
          gpx = null;
        } else {
          // a ghost painter keeps the frame alive at rest
          ptr.px = -1e4;
          gt += dt;
          gx = w / 2 + Math.sin(gt * 1.1) * w * 0.32 + Math.sin(gt * 2.3) * w * 0.06;
          gy = h / 2 + Math.sin(gt * 1.7 + 1) * h * 0.3;
          if (gpx !== null) stroke(ctx, gpx, gpy, gx, gy, col, Math.hypot(gx - gpx, gy - gpy) / dpr);
          gpx = gx; gpy = gy;
        }
        ctx.globalCompositeOperation = "source-over";
      },
    };
  }

  /* 3 ─ Aperture: the diaphragm behind every page transition */
  function apertureLab(card, scope) {
    const canvas = $("canvas", card);
    const fIn = $("#ap-f", card), bIn = $("#ap-blades", card);
    const fOut = $("#ap-f-out", card), bOut = $("#ap-blades-out", card);
    const shutter = $("[data-shutter]", card), dof = $("[data-dof]", card);
    const stops = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
    const shut = ["1/4000", "1/2000", "1/1000", "1/500", "1/250", "1/125", "1/60", "1/30", "1/15"];
    let open = 1, target = 1, rot = 0;
    const read = () => {
      const i = parseInt(fIn.value, 10);
      const f = stops[i];
      target = IA.clamp(1.4 / f, 0.07, 1);
      fOut.textContent = "f/" + f;
      bOut.textContent = bIn.value + " blades";
      if (shutter) shutter.textContent = shut[i] + " s";
      if (dof) dof.textContent = f <= 2.8 ? "Shallow" : f <= 8 ? "Moderate" : "Deep";
    };
    scope.on(fIn, "input", read);
    scope.on(bIn, "input", read);
    read();
    // drag on the stage to stop down / open up
    let dragY = null, startVal = 0;
    scope.on(canvas, "pointerdown", (e) => { dragY = e.clientY; startVal = parseInt(fIn.value, 10); try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
    scope.on(canvas, "pointermove", (e) => {
      if (dragY === null) return;
      const v = IA.clamp(Math.round(startVal + (e.clientY - dragY) / 28), 0, 8);
      if (v !== parseInt(fIn.value, 10)) { fIn.value = v; read(); }
    });
    scope.on(canvas, "pointerup", () => (dragY = null));
    return {
      start() {},
      frame(dt, t) {
        const { w, h, dpr } = IA.fitCanvas(canvas, 2);
        const ctx = canvas.getContext("2d");
        const c = IA.colors;
        open = IA.damp(open, target, 7, dt);
        rot += dt * 0.05;
        ctx.fillStyle = IA.rgba(c.bg, 1);
        ctx.fillRect(0, 0, w, h);
        const rad = Math.min(w, h) * 0.38;
        // light behind the lens
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, rad);
        g.addColorStop(0, IA.rgba(c.fg, c.light ? 0.9 : 1));
        g.addColorStop(0.4, IA.rgba(c.lilac, 0.8));
        g.addColorStop(1, IA.rgba(c.peach, 0.5));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, rad, 0, Math.PI * 2);
        ctx.fill();
        const N = parseInt(bIn.value, 10);
        IA.art.drawAperture(ctx, w, h, open, {
          blades: N, clip: rad, R: rad / Math.cos(Math.PI / N), rotation: rot - Math.PI / 2, twist: 1.2,
          lineWidth: 1.2 * dpr, ring: c.fg2,
          colors: { blade: IA.mixRgb(c.bg2, c.fg3, 0.25), blade2: IA.mixRgb(c.bg2, c.fg2, 0.3), edge: [c.peach, c.rose, c.lilac, c.jade] },
        });
        // barrel markings
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.strokeStyle = IA.rgba(c.fg3, 0.8);
        ctx.fillStyle = IA.rgba(c.fg2, 1);
        ctx.font = `${10 * dpr}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        stops.forEach((f, i) => {
          const a = -Math.PI * 0.75 + (i / (stops.length - 1)) * Math.PI * 1.5 - Math.PI / 2;
          const r1 = rad + 14 * dpr, r2 = rad + 22 * dpr;
          ctx.lineWidth = dpr;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.stroke();
          const on = i === parseInt(fIn.value, 10);
          ctx.fillStyle = IA.rgba(on ? c.fg : c.fg3, 1);
          ctx.fillText(String(f), Math.cos(a) * (r2 + 16 * dpr), Math.sin(a) * (r2 + 16 * dpr));
        });
        ctx.restore();
      },
    };
  }

  /* 4 ─ Moiré: two ring fields interfere; move to slide one across the other */
  function moire(card, scope) {
    const canvas = $("canvas", card);
    const ptr = pointer(canvas, scope);
    const btn = $("[data-pattern]", card);
    let mode = "rings", ox = 0, oy = 0;
    if (btn) scope.on(btn, "click", () => {
      mode = mode === "rings" ? "lines" : "rings";
      btn.textContent = mode === "rings" ? "Switch to lines" : "Switch to rings";
    });
    return {
      start() {},
      frame(dt, t) {
        const { w, h, dpr } = IA.fitCanvas(canvas, 1.5);
        const ctx = canvas.getContext("2d");
        const c = IA.colors;
        ctx.fillStyle = IA.rgba(c.bg, 1);
        ctx.fillRect(0, 0, w, h);
        const tx = ptr.active ? ptr.x - w / 2 : Math.sin(t * 0.4) * w * 0.12;
        const ty = ptr.active ? ptr.y - h / 2 : Math.cos(t * 0.31) * h * 0.1;
        ox = IA.damp(ox, tx, 5, dt);
        oy = IA.damp(oy, ty, 5, dt);
        const gap = 7 * dpr;
        const maxR = Math.hypot(w, h);
        ctx.lineWidth = 1.6 * dpr;
        const draw = (cx, cy, col, rotA) => {
          ctx.strokeStyle = IA.rgba(col, 0.9);
          ctx.beginPath();
          if (mode === "rings") {
            for (let r = gap; r < maxR; r += gap) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); }
          } else {
            const ca = Math.cos(rotA), sa = Math.sin(rotA);
            for (let d = -maxR; d < maxR; d += gap) {
              ctx.moveTo(cx + ca * d - sa * maxR, cy + sa * d + ca * maxR);
              ctx.lineTo(cx + ca * d + sa * maxR, cy + sa * d - ca * maxR);
            }
          }
          ctx.stroke();
        };
        draw(w / 2, h / 2, c.fg3, 0);
        draw(w / 2 + ox * 0.35, h / 2 + oy * 0.35, c.lilac, (ox / w) * 0.4 + t * 0.03);
      },
    };
  }

  P.lab = {
    init(ctx) {
      const { main, scope } = ctx;
      ctx.iris = (y) => {
        const m = IA.env.mobile;
        return IA.irisScroll(
          { cx: m ? 0.84 : 0.82, cy: m ? 0.1 : 0.24, pupil: m ? 0.07 : 0.095, iris: m ? 0.34 : 0.36, intensity: 1, dust: 0.55, hue: 0.45 },
          { cx: 0.94, cy: 0.1, pupil: 0.03, iris: 0.12, intensity: 0.45, dust: 0.6 },
          y
        );
      };
      const makers = { field: fieldType, exposure: longExposure, aperture: apertureLab, moire };
      $$("[data-exp]", main).forEach((card) => {
        const make = makers[card.dataset.exp];
        if (!make) return;
        const exp = make(card, scope);
        const fpsEl = $(".fps", card);
        let visible = false, started = false, frames = 0, acc = 0;
        const io = scope.observe(new IntersectionObserver((en) => {
          visible = en[0].isIntersecting;
          if (visible && !started) { started = true; exp.start(); }
        }, { rootMargin: "100px" }));
        io.observe(card);
        scope.tick((dt, t) => {
          if (!visible || !started) return;
          exp.frame(IA.env.reduced ? dt * 0.25 : dt, t);
          frames++;
          acc += dt;
          if (acc >= 0.5) {
            if (fpsEl) fpsEl.textContent = `${Math.round(frames / acc)} fps`;
            frames = 0;
            acc = 0;
          }
        }, 30);
      });
    },
  };
})();
