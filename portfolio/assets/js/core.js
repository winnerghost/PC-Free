/* SYED ARHAM ASHRAF — core.js
   Site-wide systems: theme, smooth scroll, cursor, aperture transitions,
   a fetch-based router (pages swap without a reload, so the iris keeps living
   between them), the preloader and the HUD. */
(function () {
  "use strict";
  const IA = window.IA;
  const html = document.documentElement;
  const { $, $$ } = IA;

  let introResolve;
  IA.introReady = new Promise((r) => (introResolve = r));

  /* ================================================================
     Theme
     ================================================================ */
  const theme = {
    current() {
      return getComputedStyle(html).colorScheme.indexOf("light") === 0 ? "light" : "dark";
    },
    read() {
      const g = (n) => IA.toRgb(IA.cssColor(n));
      IA.colors = {
        bg: g("--bg"), bg2: g("--bg-2"), bg3: g("--bg-3"),
        fg: g("--fg"), fg2: g("--fg-2"), fg3: g("--fg-3"),
        peach: g("--peach"), rose: g("--rose"), lilac: g("--lilac"), jade: g("--jade"),
        blade: g("--blade"), blade2: g("--blade-2"), pupil: g("--pupil"), accent: g("--accent"),
        light: this.current() === "light",
      };
      const btn = $(".theme-toggle");
      if (btn) btn.setAttribute("aria-label", IA.colors.light ? "Switch to dark theme" : "Switch to light theme");
    },
    apply(mode) {
      html.dataset.theme = mode;
      IA.store.set("ia-theme", mode);
      this.read();
      IA.iris.readTheme();
      document.dispatchEvent(new CustomEvent("ia:theme"));
    },
    async toggle() {
      if (this.busy) return;
      this.busy = true;
      const next = this.current() === "light" ? "dark" : "light";
      if (IA.env.reduced) { this.apply(next); this.busy = false; return; }
      await aperture.close(next === "light" ? "Porcelain" : "Lacquer", next === "light" ? "Light theme" : "Dark theme");
      this.apply(next);
      await IA.wait(200);
      await aperture.openUp();
      this.busy = false;
    },
    init() {
      this.read();
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const onSys = () => { if (!IA.store.get("ia-theme")) { this.read(); IA.iris.readTheme(); document.dispatchEvent(new CustomEvent("ia:theme")); } };
      mq.addEventListener ? mq.addEventListener("change", onSys) : mq.addListener(onSys);
      // host frames may flip data-theme on <html>
      new MutationObserver(() => { this.read(); IA.iris.readTheme(); document.dispatchEvent(new CustomEvent("ia:theme")); })
        .observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    },
  };
  IA.theme = theme;

  /* ================================================================
     Smooth scroll (wheel only; touch and keyboard stay native)
     ================================================================ */
  const scroll = {
    y: 0, target: 0, current: 0, velocity: 0, max: 0, animating: false, locked: false, lastSet: -1,
    init() {
      this.smooth = IA.env.fine && !IA.env.reduced;
      this.current = this.target = this.y = window.scrollY;
      this.measure();
      window.addEventListener("resize", () => this.measure());
      if ("ResizeObserver" in window) new ResizeObserver(() => this.measure()).observe(document.body);
      window.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
      window.addEventListener("scroll", () => this.onNative(), { passive: true });
      IA.ticker.add((dt) => this.tick(dt), -100);
    },
    measure() {
      this.max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      this.target = IA.clamp(this.target, 0, this.max);
    },
    canScrollInside(el, dy) {
      while (el && el !== document.body) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) {
          if ((dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) || (dy < 0 && el.scrollTop > 0)) return true;
        }
        el = el.parentElement;
      }
      return false;
    },
    onWheel(e) {
      if (!this.smooth || e.ctrlKey) return;
      if (this.locked) { e.preventDefault(); return; }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (this.canScrollInside(e.target, e.deltaY)) return;
      e.preventDefault();
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 40;
      else if (e.deltaMode === 2) d *= window.innerHeight;
      if (!this.animating) this.current = this.target = window.scrollY;
      this.target = IA.clamp(this.target + d, 0, this.max);
      this.animating = true;
    },
    onNative() {
      const y = window.scrollY;
      if (this.animating && Math.abs(y - this.lastSet) <= 2) return;
      this.current = this.target = y;
      this.animating = false;
    },
    tick(dt) {
      const prev = this.y;
      if (this.animating) {
        this.current = IA.damp(this.current, this.target, 8.5, dt);
        if (Math.abs(this.target - this.current) < 0.4) { this.current = this.target; this.animating = false; }
        window.scrollTo(0, this.current);
        this.lastSet = window.scrollY;
      }
      this.y = window.scrollY;
      const v = (this.y - prev) / Math.max(dt, 0.001);
      this.velocity = IA.damp(this.velocity, v, 10, dt);
    },
    to(y, { immediate = false } = {}) {
      y = IA.clamp(y, 0, this.max);
      if (immediate || IA.env.reduced) {
        this.animating = false;
        window.scrollTo(0, y);
        this.current = this.target = this.y = window.scrollY;
        return;
      }
      if (!this.smooth) { window.scrollTo({ top: y, behavior: "smooth" }); return; }
      if (!this.animating) this.current = window.scrollY;
      this.target = y;
      this.animating = true;
    },
    lock(on) { this.locked = on; html.style.overflow = on ? "hidden" : ""; },
  };
  IA.scroll = scroll;

  /* ================================================================
     Cursor + magnetic + tilt (delegated, so swapped pages just work)
     ================================================================ */
  const cursor = {
    init() {
      if (!IA.env.fine || IA.env.reduced) return;
      html.classList.add("has-cursor");
      const el = document.createElement("div");
      el.className = "cursor";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = '<div class="cursor-ring"><span class="cursor-label"></span></div><div class="cursor-dot"></div>';
      document.body.appendChild(el);
      this.el = el;
      this.ring = el.firstChild;
      this.dot = el.lastChild;
      this.label = el.querySelector(".cursor-label");
      this.x = this.rx = window.innerWidth / 2;
      this.y = this.ry = window.innerHeight / 2;
      this.s = 1;
      this.el.classList.add("is-hidden");
      window.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        this.x = e.clientX; this.y = e.clientY;
        this.el.classList.remove("is-hidden");
      }, { passive: true });
      document.addEventListener("pointerover", (e) => this.state(e.target));
      document.documentElement.addEventListener("mouseleave", () => this.el.classList.add("is-hidden"));
      window.addEventListener("pointerdown", () => (this.down = true));
      window.addEventListener("pointerup", () => (this.down = false));
      IA.ticker.add((dt) => {
        this.rx = IA.damp(this.rx, this.x, 16, dt);
        this.ry = IA.damp(this.ry, this.y, 16, dt);
        this.s = IA.damp(this.s, this.down ? 0.82 : 1, 14, dt);
        this.ring.style.transform = `translate3d(${this.rx}px,${this.ry}px,0) scale(${this.s})`;
        this.dot.style.transform = `translate3d(${this.x}px,${this.y}px,0)`;
      }, 90);
    },
    state(t) {
      if (!this.el) return;
      const el = t && t.closest ? t.closest('[data-cursor], a, button, input, textarea, select, label, [role="button"]') : null;
      this.el.classList.remove("is-hover", "is-label", "is-text");
      if (!el) return;
      if (el.matches('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea')) this.el.classList.add("is-text");
      else if (el.dataset.cursor) { this.label.textContent = el.dataset.cursor; this.el.classList.add("is-label"); }
      else this.el.classList.add("is-hover");
    },
    reset() { if (this.el) this.el.classList.remove("is-hover", "is-label", "is-text"); },
  };
  IA.cursor = cursor;

  function delegatedFx() {
    let mag = null, magRect = null, tilt = null, tiltRect = null;
    const resetMag = () => {
      if (!mag) return;
      mag.style.transition = "";
      mag.style.transform = "";
      const inner = mag.querySelector("[data-magnetic-inner]");
      if (inner) inner.style.transform = "";
      mag = null;
    };
    const resetTilt = () => {
      if (!tilt) return;
      tilt.style.setProperty("--rx", "0deg");
      tilt.style.setProperty("--ry", "0deg");
      tilt = null;
    };
    document.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || IA.env.reduced) return;
      const t = e.target.closest ? e.target : null;
      const m = t && t.closest("[data-magnetic]");
      if (m !== mag) { resetMag(); if (m) { mag = m; magRect = m.getBoundingClientRect(); } }
      if (mag) {
        const s = parseFloat(mag.dataset.magnetic) || 0.3;
        const dx = e.clientX - (magRect.left + magRect.width / 2);
        const dy = e.clientY - (magRect.top + magRect.height / 2);
        mag.style.transition = "transform 0.3s cubic-bezier(0.16,1,0.3,1)";
        mag.style.transform = `translate(${dx * s}px, ${dy * s}px)`;
        const inner = mag.querySelector("[data-magnetic-inner]");
        if (inner) inner.style.transform = `translate(${dx * s * 0.5}px, ${dy * s * 0.5}px)`;
      }
      const tl = t && t.closest("[data-tilt]");
      if (tl !== tilt) { resetTilt(); if (tl) { tilt = tl; tiltRect = tl.getBoundingClientRect(); } }
      if (tilt) {
        const px = (e.clientX - tiltRect.left) / tiltRect.width;
        const py = (e.clientY - tiltRect.top) / tiltRect.height;
        const amt = parseFloat(tilt.dataset.tilt) || 6;
        tilt.style.setProperty("--rx", `${(0.5 - py) * amt}deg`);
        tilt.style.setProperty("--ry", `${(px - 0.5) * amt * 1.2}deg`);
        tilt.style.setProperty("--mx", `${px * 100}%`);
        tilt.style.setProperty("--my", `${py * 100}%`);
      }
    }, { passive: true });
    window.addEventListener("scroll", () => {
      if (mag) magRect = mag.getBoundingClientRect();
      if (tilt) tiltRect = tilt.getBoundingClientRect();
    }, { passive: true });
    document.addEventListener("pointerover", (e) => {
      const d = e.target.closest && e.target.closest("[data-dilate]");
      IA.iris.dilateTarget = d ? parseFloat(d.dataset.dilate) || 1.35 : 1;
    });
    IA.resetDelegated = () => { resetMag(); resetTilt(); IA.iris.dilateTarget = 1; };
  }

  /* ================================================================
     Aperture transition
     ================================================================ */
  const aperture = {
    open: 1,
    init() {
      const el = document.createElement("div");
      el.className = "aperture";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = '<canvas></canvas><div class="aperture-label"><span class="label"></span><span class="serif"></span></div>';
      document.body.appendChild(el);
      this.el = el;
      this.canvas = el.querySelector("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.labelEl = el.querySelector(".aperture-label");
      window.addEventListener("resize", () => { if (this.open < 1) this.draw(this.open); });
      this.capture();
    },
    capture() {
      const c = IA.colors;
      this.colors = { blade: c.blade, blade2: c.blade2, edge: [c.peach, c.rose, c.lilac, c.jade] };
      this.labelEl.style.color = `rgb(${c.fg.join(",")})`;
    },
    draw(v) {
      this.open = v;
      const { w, h, dpr } = IA.fitCanvas(this.canvas, 1.5);
      this.ctx.clearRect(0, 0, w, h);
      if (v >= 1) return;
      IA.art.drawAperture(this.ctx, w, h, v, { blades: 7, colors: this.colors, lineWidth: 1.2 * dpr, twist: 1.35 });
    },
    solid(a) {
      const { w, h } = IA.fitCanvas(this.canvas, 1);
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.fillStyle = IA.rgba(this.colors.blade, a);
      this.ctx.fillRect(0, 0, w, h);
      this.open = a > 0 ? 0 : 1;
    },
    setLabel(title, kicker) {
      this.labelEl.querySelector(".serif").textContent = title || "";
      this.labelEl.querySelector(".label").textContent = kicker || "";
    },
    async close(title, kicker) {
      this.capture();
      this.setLabel(title, kicker);
      this.el.classList.add("is-active");
      if (IA.env.reduced) {
        await IA.tween({ from: 0, to: 1, duration: 180, ease: IA.ease.linear, onUpdate: (v) => this.solid(v) });
        this.labelEl.classList.add("is-on");
        return;
      }
      await IA.tween({ from: this.open, to: 0, duration: 720, ease: IA.ease.inOutQuart, onUpdate: (v) => this.draw(v) });
      this.labelEl.classList.add("is-on");
    },
    async openUp() {
      this.labelEl.classList.remove("is-on");
      if (IA.env.reduced) {
        await IA.tween({ from: 1, to: 0, duration: 180, ease: IA.ease.linear, onUpdate: (v) => this.solid(v) });
        this.solid(0);
        this.el.classList.remove("is-active");
        return;
      }
      await IA.wait(140);
      await IA.tween({ from: 0, to: 1, duration: 1050, ease: IA.ease.inOutCubic, onUpdate: (v) => this.draw(v) });
      this.draw(1);
      this.el.classList.remove("is-active");
    },
  };
  IA.aperture = aperture;

  /* ================================================================
     Menu, HUD, clock, f-stop meter, toast
     ================================================================ */
  const menu = {
    init() {
      this.el = $("#menu");
      this.btn = $(".menu-toggle");
      if (!this.el || !this.btn) return;
      this.btn.addEventListener("click", () => (this.isOpen ? this.close() : this.open()));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && this.isOpen) { this.close(); this.btn.focus(); } });
    },
    open() {
      this.isOpen = true;
      this.el.hidden = false;
      requestAnimationFrame(() => this.el.classList.add("is-open"));
      this.btn.setAttribute("aria-expanded", "true");
      this.btn.querySelector("span").textContent = "Close";
      scroll.lock(true);
      const first = this.el.querySelector("a");
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 300);
    },
    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.el.classList.remove("is-open");
      this.btn.setAttribute("aria-expanded", "false");
      this.btn.querySelector("span").textContent = "Menu";
      scroll.lock(false);
      setTimeout(() => { if (!this.isOpen) this.el.hidden = true; }, 900);
    },
  };
  IA.menu = menu;

  const hud = {
    init() {
      this.el = $(".hud");
      const tbtn = $(".theme-toggle");
      if (tbtn) tbtn.addEventListener("click", () => theme.toggle());
      this.clocks();
      setInterval(() => this.clocks(), 1000);
      let acc = 0;
      IA.ticker.add((dt) => {
        if (!this.el) return;
        const y = scroll.y;
        this.el.classList.toggle("is-scrolled", y > 40);
        const v = scroll.velocity;
        if (menu.isOpen || y < 240 || IA.env.reduced) { this.el.classList.remove("is-hidden"); acc = 0; return; }
        if (v > 60) acc += dt; else if (v < -60) acc = 0;
        if (acc > 0.18) this.el.classList.add("is-hidden");
        if (v < -60) this.el.classList.remove("is-hidden");
      }, 20);
      document.addEventListener("click", (e) => {
        if (!e.target.closest) return;
        const top = e.target.closest("[data-to-top]");
        if (top) { e.preventDefault(); scroll.to(0); }
        const mail = e.target.closest("[data-copy-email-global]");
        if (mail) IA.copy(IA.site.email, mail);
      });
    },
    clocks() {
      let t;
      try {
        t = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: IA.site.timezone }).format(new Date());
      } catch (e) {
        t = new Date().toTimeString().slice(0, 8);
      }
      $$("[data-clock]").forEach((el) => {
        el.innerHTML = el.dataset.clock === "plain" ? t : `${IA.site.tzLabel} <b>${t}</b>`;
      });
    },
    setActive(name) {
      const map = { venture: "ventures" };
      const key = map[name] || name;
      $$("[data-nav]").forEach((a) => {
        if (a.dataset.nav === key) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    },
  };

  const fmeter = {
    stops: [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22],
    init() {
      this.el = $(".fmeter");
      if (!this.el) return;
      this.canvas = this.el.querySelector("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.num = this.el.querySelector("b");
      this.last = -1;
      document.addEventListener("ia:theme", () => (this.last = -1));
      IA.ticker.add(() => {
        if (!this.canvas.clientWidth) return; // hidden on small screens
        this.el.classList.toggle("is-on", scroll.y > window.innerHeight * 0.4);
        const p = scroll.max > 0 ? IA.clamp(scroll.y / scroll.max) : 0;
        const q = Math.round(p * 200) / 200;
        if (q === this.last) return;
        this.last = q;
        const idx = Math.round(q * (this.stops.length - 1));
        this.num.textContent = "f/" + this.stops[idx];
        const { w, h, dpr } = IA.fitCanvas(this.canvas, 2);
        const ctx = this.ctx;
        ctx.clearRect(0, 0, w, h);
        const c = IA.colors;
        const rad = w / 2 - dpr;
        IA.art.drawAperture(ctx, w, h, IA.map(q, 0, 1, 0.9, 0.16), {
          blades: 7, clip: rad, R: rad / Math.cos(Math.PI / 7), lineWidth: dpr * 0.8, ring: c.fg2,
          colors: { blade: IA.mixRgb(c.bg, c.fg3, 0.55), blade2: IA.mixRgb(c.bg, c.fg2, 0.6), edge: [c.fg] }, edgeAlpha: 0.6,
        });
      }, 30);
    },
  };

  IA.toast = (msg) => {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("is-on"), 2200);
  };

  IA.copy = async (text, fallbackEl) => {
    try {
      await navigator.clipboard.writeText(text);
      IA.toast("Copied to clipboard");
      return true;
    } catch (e) {
      if (fallbackEl) {
        const range = document.createRange();
        range.selectNodeContents(fallbackEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        IA.toast("Selected. Press Ctrl+C or Cmd+C to copy");
      }
      return false;
    }
  };

  function makeGrain() {
    const g = $(".grain");
    if (!g) return;
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    try { g.style.backgroundImage = `url(${c.toDataURL("image/png")})`; } catch (e) { g.remove(); }
  }

  /* ================================================================
     Shared page behaviours (run on every mount)
     ================================================================ */
  function countUp(el) {
    const to = parseFloat(el.dataset.count);
    if (isNaN(to)) return;
    const dec = parseInt(el.dataset.decimals || "0", 10);
    const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    IA.tween({
      from: 0, to, duration: 1800, ease: IA.ease.outExpo,
      onUpdate: (v) => (el.textContent = pre + v.toFixed(dec) + suf),
    });
  }
  IA.countUp = countUp;

  function reveal(el) {
    el.classList.add("is-in");
    if (el.dataset.count && !IA.env.reduced) countUp(el);
  }

  IA.observeReveals = function (root, scope) {
    IA.$$("[data-split]", root).forEach((el) => IA.splitWords(el, { chars: el.dataset.split === "chars" }));
    const els = IA.$$("[data-split],[data-reveal],[data-count]", root).filter((el) => !el.classList.contains("is-in"));
    if (IA.env.reduced || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-in")); return; }
    IA.introReady.then(() => {
      if (scope.dead) return;
      const io = scope.observe(new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); } });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0.01 }));
      els.forEach((el) => io.observe(el));
    });
  };

  /* scale a line of type so it exactly fills its container's width */
  function fitText(el) {
    if (!el.offsetParent) return;
    const max = parseFloat(el.dataset.fitMax || "999");
    if (window.innerWidth <= (parseFloat(el.dataset.fitMin) || 0)) { el.style.fontSize = ""; return; }
    const avail = el.parentElement.clientWidth - parseFloat(getComputedStyle(el.parentElement).paddingLeft) - parseFloat(getComputedStyle(el.parentElement).paddingRight);
    el.style.fontSize = "100px";
    el.style.width = "max-content";
    const wNow = el.getBoundingClientRect().width;
    el.style.width = "";
    if (wNow > 0) el.style.fontSize = Math.min(max, (100 * avail) / wNow) + "px";
  }
  IA.fitAll = (root = document) => IA.$$("[data-fit]", root).forEach(fitText);
  window.addEventListener("resize", () => IA.fitAll());
  if (document.fonts) document.fonts.ready.then(() => { IA.fitAll(); scroll.measure(); });

  /* site-wide settings from data.js: email, profiles */
  function applySite(root) {
    const s = IA.site;
    IA.$$("[data-needs-email]", root).forEach((el) => (el.hidden = !s.email));
    IA.$$("[data-email]", root).forEach((el) => (el.textContent = s.email));
    IA.$$("[data-socials]", root).forEach((el) => {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      const tpl = el.dataset.socials;
      (s.socials || []).forEach((p) => {
        const a = document.createElement("a");
        a.href = p.href;
        a.target = "_blank";
        a.rel = "noopener";
        a.innerHTML = tpl === "rich"
          ? `${IA.esc(p.label)} <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M5.5 4H12v6.5" stroke="currentColor" stroke-width="1.4"/></svg>`
          : IA.esc(p.label);
        el.appendChild(a);
      });
    });
  }

  function shared(main, scope) {
    applySite(main);
    IA.fitAll(main);
    IA.observeReveals(main, scope);

    // parallax: element moves relative to its parent's position in the viewport
    const pars = IA.$$("[data-parallax]", main);
    if (pars.length && !IA.env.reduced) {
      scope.tick(() => {
        const vh = window.innerHeight;
        pars.forEach((el) => {
          const r = el.parentElement.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          const off = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
          el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
        });
      }, 15);
    }

    // marquee
    IA.$$("[data-marquee]", main).forEach((mq) => {
      const track = mq.querySelector(".marquee-track");
      const group = track && track.firstElementChild;
      if (!group) return;
      track.appendChild(group.cloneNode(true)).setAttribute("aria-hidden", "true");
      let x = 0, skew = 0;
      const dir = parseFloat(mq.dataset.marquee) || -1;
      scope.tick((dt) => {
        const gw = group.offsetWidth || 1;
        const v = scroll.velocity;
        const speed = (IA.env.reduced ? 0 : 70) + Math.min(Math.abs(v) * 0.35, 1400);
        x += dir * speed * dt * (v < -20 ? -1 : 1);
        if (x <= -gw) x += gw;
        if (x > 0) x -= gw;
        skew = IA.damp(skew, IA.clamp(v * -0.004, -8, 8), 6, dt);
        track.style.transform = `translate3d(${x.toFixed(2)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
      }, 15);
    });
  }

  /* ================================================================
     Page lifecycle + iris coordination
     ================================================================ */
  let current = null;
  const footerPreset = () => ({ cx: IA.env.mobile ? 0.62 : 0.74, cy: 0.42, pupil: 0.08, iris: 0.32, intensity: 0.9, dust: 0.45 });

  /* blend two iris presets by how far the page has scrolled (in viewport heights) */
  IA.irisScroll = (top, below, y, span = 0.9) => {
    const t = IA.ease.inOutCubic(IA.clamp(y / (window.innerHeight * span)));
    const o = {};
    for (const k in top) o[k] = IA.lerp(top[k], below[k] != null ? below[k] : top[k], t);
    return o;
  };
  const DEFAULT_IRIS = { cx: 0.5, cy: 0.5, pupil: 0.1, iris: 0.38, intensity: 0.6, dust: 0.4, hue: 0 };

  function mountPage(main) {
    const scope = new IA.Scope();
    const _destroy = scope.destroy.bind(scope);
    scope.destroy = () => { scope.dead = true; _destroy(); };
    const name = main.dataset.page || "home";
    html.dataset.current = name;
    hud.setActive(name);
    const ctx = { main, scope, iris: DEFAULT_IRIS };
    current = { name, scope, ctx };
    const page = IA.pages && IA.pages[name];
    if (page && page.init) {
      try { page.init(ctx); } catch (e) { console.error(e); }
    }
    shared(main, scope);
    scroll.measure();
    // run once immediately so iris targets are right before the reveal
    applyIris(true);
  }

  function unmountPage() {
    if (!current) return;
    current.scope.destroy();
    cursor.reset();
    IA.resetDelegated && IA.resetDelegated();
    current = null;
  }

  function applyIris() {
    if (!current) return;
    const ip = current.ctx.iris;
    let p = Object.assign({}, DEFAULT_IRIS, typeof ip === "function" ? ip(scroll.y) : ip);
    const foot = $(".footer");
    if (foot && current.name !== "contact") {
      const top = foot.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const f = IA.ease.inOutCubic(IA.clamp(1 - (top - vh * 0.1) / (vh * 0.9)));
      if (f > 0) {
        const fp = footerPreset();
        // the iris rides beside the call to action as the footer scrolls
        const cta = foot.querySelector(".footer-cta");
        if (cta) {
          const r = cta.getBoundingClientRect();
          fp.cy = IA.clamp((r.top + r.height * 0.45) / vh, -0.1, 0.6);
        }
        for (const k in fp) p[k] = IA.lerp(p[k], fp[k], f);
      }
    }
    IA.iris.set(p);
  }

  /* ================================================================
     Router: fetch the next page, swap <main>, keep everything else alive
     ================================================================ */
  const NAMES = { "": "Home", "index.html": "Home", "ventures.html": "Ventures", "about.html": "About", "lab.html": "Lab", "contact.html": "Contact", "venture.html": "Venture" };
  const router = {
    cache: new Map(),
    busy: false,
    key(url) { return url.pathname + url.search; },
    init() {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      const snapshot = "<!doctype html>" + html.outerHTML;
      this.cache.set(this.key(new URL(location.href)), snapshot);
      // hosts may serve the home page at "/" rather than "/index.html"
      const m = $("main");
      if (m && m.dataset.page === "home") this.cache.set(this.key(new URL("index.html", location.href)), snapshot);
      document.addEventListener("click", (e) => this.onClick(e));
      window.addEventListener("popstate", () => this.go(location.href, { push: false }));
      document.addEventListener("pointerover", (e) => {
        const a = e.target.closest && e.target.closest("a[href]");
        if (!a || !this.internal(a)) return;
        const url = new URL(a.href, location.href);
        if (url.protocol === "file:") return;
        this.load(url).catch(() => {});
      });
    },
    internal(a) {
      if (a.target && a.target !== "_self") return false;
      if (a.hasAttribute("download") || a.hasAttribute("data-no-router")) return false;
      const href = a.getAttribute("href") || "";
      if (/^(mailto|tel|sms|javascript):/i.test(href)) return false;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return false;
      return /(\.html?|\/)$/.test(url.pathname) || url.pathname === location.pathname;
    },
    onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || !this.internal(a)) return;
      const url = new URL(a.href, location.href);
      const samePath = url.pathname === location.pathname && url.search === location.search;
      if (samePath && url.hash && !(current && current.name === "venture" && url.hash !== location.hash)) {
        const id = decodeURIComponent(url.hash.slice(1));
        const target = id && document.getElementById(id);
        if (target) {
          e.preventDefault();
          scroll.to(target.getBoundingClientRect().top + window.scrollY - 20);
          if (target.tabIndex < 0 && !/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        }
        return;
      }
      if (samePath && !url.hash && current && current.name !== "venture") { e.preventDefault(); scroll.to(0); menu.close(); return; }
      if (url.protocol === "file:") return; // fetch is not allowed from file://, use a normal load
      e.preventDefault();
      this.go(url.href, { label: a.dataset.label, kicker: a.dataset.kicker });
    },
    load(url) {
      const k = this.key(url);
      if (this.cache.has(k)) return Promise.resolve(this.cache.get(k));
      const p = fetch(url.pathname + url.search, { credentials: "same-origin" })
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then((t) => { this.cache.set(k, t); return t; });
      p.catch(() => this.cache.delete(k));
      return p;
    },
    labelFor(url) {
      const file = url.pathname.split("/").pop();
      if (file === "venture.html") {
        const p = IA.project(decodeURIComponent(url.hash.slice(1))) || IA.projects[0];
        return [p.title, p.kind];
      }
      return [NAMES[file] || IA.site.name, "Next"];
    },
    async go(href, { push = true, label, kicker } = {}) {
      if (this.busy) return;
      this.busy = true;
      const url = new URL(href, location.href);
      const [t, k] = this.labelFor(url);
      menu.close();
      const loading = this.load(url);
      loading.catch(() => {});
      await aperture.close(label || t, kicker || k);
      let text;
      try { text = await loading; } catch (err) { location.href = url.href; return; }
      const doc = new DOMParser().parseFromString(text, "text/html");
      const next = doc.querySelector("main");
      if (!next) { location.href = url.href; return; }
      if (push) { try { history.pushState({}, "", url.href); } catch (err) { /* sandboxed frame */ } }
      IA.routeHash = url.hash;
      unmountPage();
      const old = $("main");
      const fresh = document.importNode(next, true);
      old.replaceWith(fresh);
      if (doc.title) document.title = doc.title;
      scroll.to(0, { immediate: true });
      mountPage(fresh);
      await aperture.openUp();
      const h1 = fresh.querySelector("h1");
      if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
      this.busy = false;
    },
  };
  IA.router = router;

  /* ================================================================
     Preloader + boot
     ================================================================ */
  function runPreloader(pre) {
    return new Promise((resolve) => {
      const count = pre.querySelector(".preloader-count");
      const bar = pre.querySelector(".preloader-bar i");
      let loaded = false;
      const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      const win = new Promise((r) => (document.readyState === "complete" ? r() : window.addEventListener("load", r, { once: true })));
      Promise.all([fonts, win]).then(() => (loaded = true));
      setTimeout(() => (loaded = true), 3500);
      const start = performance.now();
      let shown = 0;
      const stop = IA.ticker.add((dt) => {
        const t = Math.min(1, (performance.now() - start) / 1400);
        const goal = Math.min(loaded ? 1 : 0.88, IA.ease.outCubic(t));
        shown = Math.max(shown, IA.damp(shown, goal, 7, dt));
        if (goal === 1 && shown > 0.985) shown = 1;
        if (count) count.textContent = String(Math.round(shown * 100)).padStart(3, "0");
        if (bar) bar.style.transform = `scaleX(${shown})`;
        if (shown >= 1) { stop(); setTimeout(resolve, 220); }
      }, 60);
    });
  }

  async function intro() {
    const pre = $(".preloader");
    const first = pre && !IA.store.sget("ia-loaded") && !IA.env.reduced && !html.classList.contains("no-preload");
    if (!IA.env.reduced) {
      aperture.capture();
      aperture.el.classList.add("is-active");
      aperture.draw(0);
    }
    if (first) {
      await runPreloader(pre);
      IA.store.sset("ia-loaded", "1");
      pre.classList.add("is-done");
      await IA.wait(250);
    } else {
      if (pre) pre.classList.add("is-done");
      await IA.wait(80);
    }
    introResolve();
    if (!IA.env.reduced) await aperture.openUp();
  }

  function boot() {
    theme.init();
    makeGrain();
    IA.iris.init();
    aperture.init();
    router.init();
    scroll.init();
    cursor.init();
    delegatedFx();
    menu.init();
    hud.init();
    fmeter.init();
    IA.ticker.add(() => applyIris(), 5);
    IA.routeHash = location.hash;
    const foot = $(".footer");
    if (foot) { applySite(foot); IA.fitAll(foot); IA.observeReveals(foot, new IA.Scope()); }
    applySite($("#menu") || document.createElement("div"));
    mountPage($("main"));
    intro();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
