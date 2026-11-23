/* SYED ARHAM ASHRAF — lib.js
   Small, dependency-free toolkit shared by every module:
   math, easing, a single rAF ticker, tweens, text splitting, seeded noise. */
(function () {
  "use strict";

  const IA = (window.IA = window.IA || {});

  /* ---------- math ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const map = (v, a, b, c, d, clampIt = true) => {
    let t = (v - a) / (b - a);
    if (clampIt) t = clamp(t);
    return c + (d - c) * t;
  };
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
  const smoothstep = (a, b, v) => {
    const t = clamp((v - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  const ease = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
    inOutExpo: (t) =>
      t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
  };

  /* ---------- environment ---------- */
  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const env = {
    get reduced() { return mqReduce.matches; },
    get fine() { return mqFine.matches; },
    get mobile() { return window.innerWidth < 861; },
  };

  const store = {
    get(k, fallback = null) {
      try { const v = localStorage.getItem(k); return v === null ? fallback : v; } catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
    sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };

  /* ---------- ticker: one rAF loop for the whole site ---------- */
  const ticker = (() => {
    const subs = [];
    let last = performance.now();
    let running = false;
    let time = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      for (let i = 0; i < subs.length; i++) {
        try { subs[i].fn(dt, time, now); } catch (err) { console.error(err); }
      }
      requestAnimationFrame(frame);
    }
    return {
      add(fn, priority = 0) {
        const s = { fn, priority };
        subs.push(s);
        subs.sort((a, b) => a.priority - b.priority);
        if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
        return () => { const i = subs.indexOf(s); if (i > -1) subs.splice(i, 1); };
      },
      get time() { return time; },
    };
  })();

  /* ---------- tween ---------- */
  function tween({ from = 0, to = 1, duration = 1000, ease: e = ease.outExpo, onUpdate, delay = 0 }) {
    return new Promise((resolve) => {
      if (duration <= 0) { onUpdate && onUpdate(to, 1); resolve(); return; }
      const start = performance.now() + delay;
      let stop = null;
      stop = ticker.add(() => {
        const now = performance.now();
        if (now < start) return;
        const t = clamp((now - start) / duration);
        const v = from + (to - from) * e(t);
        onUpdate && onUpdate(v, t);
        if (t >= 1) { stop(); resolve(); }
      }, 50);
    });
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- scope: collects listeners / loops for clean page teardown ---------- */
  class Scope {
    constructor() { this.fns = []; }
    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      this.fns.push(() => target.removeEventListener(type, fn, opts));
      return fn;
    }
    tick(fn, priority = 10) { this.fns.push(ticker.add(fn, priority)); }
    add(fn) { this.fns.push(fn); }
    observe(io) { this.fns.push(() => io.disconnect()); return io; }
    timeout(fn, ms) { const id = setTimeout(fn, ms); this.fns.push(() => clearTimeout(id)); return id; }
    interval(fn, ms) { const id = setInterval(fn, ms); this.fns.push(() => clearInterval(id)); return id; }
    destroy() { while (this.fns.length) { try { this.fns.pop()(); } catch (e) { console.error(e); } } }
  }

  /* ---------- text splitting (keeps inline markup such as <em>) ---------- */
  function splitWords(el, { chars = false } = {}) {
    if (el.dataset.splitDone) return el.querySelectorAll(".wi");
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            if (chars) {
              [...part].forEach((c) => {
                const ci = document.createElement("span");
                ci.className = "wi";
                ci.style.setProperty("--i", i++);
                ci.textContent = c;
                w.appendChild(ci);
              });
            } else {
              const wi = document.createElement("span");
              wi.className = "wi";
              wi.style.setProperty("--i", i++);
              wi.textContent = part;
              w.appendChild(wi);
            }
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !child.matches("br")) {
          walk(child);
        }
      });
    };
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    walk(el);
    el.querySelectorAll(".w").forEach((w) => w.setAttribute("aria-hidden", "true"));
    el.dataset.splitDone = "1";
    return el.querySelectorAll(".wi");
  }

  /* ---------- seeded random + value noise ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function makeNoise(seed = 1) {
    const r = rng(seed);
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256).map((_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const grad = (h, x, y) => {
      switch (h & 7) {
        case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
        case 4: return x; case 5: return -x; case 6: return y; default: return -y;
      }
    };
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    function n2(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const a = perm[X] + Y, b = perm[X + 1] + Y;
      return lerp(
        lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u),
        lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u),
        v
      ) * 0.7071;
    }
    function n3(x, y, z) {
      // cheap 3D: blend two 2D slices
      const zi = Math.floor(z), zf = z - zi, s = fade(zf);
      return lerp(n2(x + zi * 17.13, y + zi * 3.71), n2(x + (zi + 1) * 17.13, y + (zi + 1) * 3.71), s);
    }
    function fbm(x, y, oct = 4) {
      let v = 0, a = 0.5, f = 1;
      for (let i = 0; i < oct; i++) { v += a * n2(x * f, y * f); f *= 2.02; a *= 0.5; }
      return v;
    }
    return { n2, n3, fbm };
  }

  /* ---------- color ---------- */
  function hexToRgb(hex) {
    hex = hex.trim().replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const n = parseInt(hex.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function cssColor(name, el = document.documentElement) {
    return getComputedStyle(el).getPropertyValue(name).trim();
  }
  function toRgb(str) {
    str = str.trim();
    if (str.startsWith("#")) return hexToRgb(str);
    const m = str.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function mixRgb(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

  /* ---------- canvas helper ---------- */
  function fitCanvas(canvas, maxDpr = 2, scale = 1) {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr) * scale;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h, dpr };
  }

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  Object.assign(IA, {
    clamp, lerp, map, damp, smoothstep, ease, env, store, ticker, tween, wait, Scope,
    splitWords, rng, hashStr, makeNoise, hexToRgb, cssColor, toRgb, rgba, mixRgb, fitCanvas, $, $$,
  });
})();
