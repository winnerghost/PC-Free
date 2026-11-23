/* ARHAM — app.js
   Site-wide systems:
   - Lenis smooth scroll wired into GSAP ScrollTrigger
   - pages as cards: the menu drops the page to reveal navigation, and page
     changes deal a new card in while the old one lifts away
   - the 3D object follows sections ([data-obj]) and the menu (live preview)
   - text: char/word reveals with variable width, scramble, elastic width
     that reacts to scroll speed
   - cursor, magnetic buttons, loader, clock */
(function () {
  "use strict";
  const IA = (window.IA = window.IA || {});
  const html = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  IA.$ = $;
  IA.$$ = $$;
  IA.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  IA.fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  IA.mobile = () => window.innerWidth < 760;
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* unavailable */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  IA.esc = esc;

  if (!window.gsap) { html.classList.remove("is-loading"); return; }
  gsap.registerPlugin(ScrollTrigger);
  gsap.config({ nullTargetWarn: false });

  /* ================================================================
     Scroll
     ================================================================ */
  let lenis = null;
  function initScroll() {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!IA.reduced && window.Lenis) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    // scroll speed squeezes elastic type
    let sv = 0, lastSet = -1;
    gsap.ticker.add(() => {
      const v = lenis ? Math.abs(lenis.velocity) : 0;
      sv += (Math.min(v * 1.2, 36) - sv) * 0.14;
      const r = Math.round(sv * 10) / 10;
      if (r !== lastSet) { lastSet = r; html.style.setProperty("--sv", r); }
    });
    // header: a soft backdrop once scrolled, tucked away while reading downward
    const hud = $(".hud");
    gsap.ticker.add(() => {
      const y = window.scrollY;
      html.classList.toggle("is-scrolled", y > 60);
      if (!hud) return;
      const v = lenis ? lenis.velocity : 0;
      if (IA.menuOpen || y < 200 || IA.reduced) hud.classList.remove("is-hidden");
      else if (v > 1.5) hud.classList.add("is-hidden");
      else if (v < -1.5) hud.classList.remove("is-hidden");
    });
  }
  IA.scrollTo = (y, immediate) => {
    if (lenis) lenis.scrollTo(y, { immediate: !!immediate, duration: 1.4, force: true });
    else window.scrollTo({ top: y, behavior: immediate || IA.reduced ? "auto" : "smooth" });
  };
  IA.scrollStop = () => { if (lenis) lenis.stop(); };
  IA.scrollStart = () => { if (lenis) lenis.start(); };

  /* ================================================================
     Text: split, reveal, scramble
     ================================================================ */
  function split(el, mode) {
    if (el._u) return el._u;
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    const walk = (node) => {
      [...node.childNodes].forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const m = document.createElement("span");
            m.className = "m";
            m.setAttribute("aria-hidden", "true");
            if (mode === "chars") {
              [...part].forEach((c, i) => {
                const u = document.createElement("span");
                u.className = "u c";
                u.textContent = c;
                m.appendChild(u);
              });
            } else {
              const u = document.createElement("span");
              u.className = "u";
              u.textContent = part;
              m.appendChild(u);
            }
            frag.appendChild(m);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && ch.tagName !== "BR") walk(ch);
      });
    };
    walk(el);
    el._u = $$(".u", el);
    el._u.forEach((u, i) => u.style.setProperty("--i", i));
    return el._u;
  }
  IA.split = split;

  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+—·";
  function scramble(el, delay = 0) {
    const final = el._final != null ? el._final : el.textContent;
    el._final = final;
    const dur = Math.min(1.4, 0.5 + final.length * 0.018) * 1000;
    let t0 = 0;
    const run = (now) => {
      if (!t0) t0 = now || performance.now();
      const p = Math.min(1, ((now || performance.now()) - t0) / dur);
      let out = "";
      for (let i = 0; i < final.length; i++) {
        const ch = final[i];
        if (ch === " " || i / final.length < p) out += ch;
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      el.style.visibility = "visible";
      if (p < 1) requestAnimationFrame(run);
      else el.textContent = final;
    };
    gsap.delayedCall(delay, run);
  }
  IA.scramble = scramble;

  function prep(root) {
    if (IA.reduced) return;
    $$("[data-anim]", root).forEach((el) => {
      if (el._prepped) return;
      el._prepped = true;
      const t = el.dataset.anim;
      if (t === "chars") gsap.set(split(el, "chars"), { yPercent: 118, "--w": 62 });
      else if (t === "words") gsap.set(split(el, "words"), { yPercent: 118 });
      else if (t === "fade") gsap.set(el, { autoAlpha: 0, y: 36 });
      else if (t === "line") gsap.set(el, { scaleX: 0, transformOrigin: "left center" });
      else if (t === "scramble") { el._final = el.textContent; el.style.visibility = "hidden"; }
    });
  }
  function play(el, extra = 0) {
    if (el._played) return;
    el._played = true;
    if (IA.reduced) return;
    const t = el.dataset.anim, d = parseFloat(el.dataset.delay || 0) + extra;
    if (t === "chars") gsap.to(el._u, { yPercent: 0, "--w": 100, duration: 1.25, ease: "expo.out", stagger: 0.032, delay: d });
    else if (t === "words") gsap.to(el._u, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.016, delay: d });
    else if (t === "fade") gsap.to(el, { autoAlpha: 1, y: 0, duration: 1.2, ease: "expo.out", delay: d });
    else if (t === "line") gsap.to(el, { scaleX: 1, duration: 1.4, ease: "expo.inOut", delay: d });
    else if (t === "scramble") scramble(el, d);
  }
  IA.play = play;
  function offsetIn(el, root) {
    let y = 0, n = el;
    while (n && n !== root) { y += n.offsetTop; n = n.offsetParent; }
    return y;
  }
  function playFirstScreen(page, extra = 0) {
    const vh = window.innerHeight;
    $$("[data-anim]", page).forEach((el) => { if (offsetIn(el, page) < vh * 0.92) play(el, extra); });
  }
  function bindReveals(page) {
    $$("[data-anim]", page).forEach((el) => {
      if (el._played) return;
      ScrollTrigger.create({ trigger: el, start: "top 92%", once: true, onEnter: () => play(el) });
    });
  }

  /* ================================================================
     Cursor + magnetic
     ================================================================ */
  function initCursor() {
    const c = $(".cursor");
    if (!c || !IA.fine || IA.reduced) return;
    html.classList.add("has-cursor");
    const label = $(".cursor-label", c);
    let x = -100, y = -100;
    const xTo = gsap.quickTo(c, "x", { duration: 0.35, ease: "power3" });
    const yTo = gsap.quickTo(c, "y", { duration: 0.35, ease: "power3" });
    window.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; xTo(x); yTo(y); c.classList.add("is-on"); }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => c.classList.remove("is-on"));
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest ? e.target.closest("a, button, [data-cursor], input, textarea, label, .page.is-card") : null;
      const lab = t && (t.dataset.cursor || (t.classList.contains("page") ? "Back" : ""));
      c.classList.toggle("is-label", !!lab);
      if (lab) label.textContent = lab;
      c.classList.toggle("is-link", !!t && !lab && !t.matches("input, textarea"));
      c.classList.toggle("is-text", !!t && t.matches("input, textarea"));
    });
    window.addEventListener("pointerdown", () => c.classList.add("is-down"));
    window.addEventListener("pointerup", () => c.classList.remove("is-down"));
  }

  function initMagnetic() {
    if (!IA.fine || IA.reduced) return;
    let cur = null, box = null;
    document.addEventListener("pointermove", (e) => {
      const m = e.target.closest ? e.target.closest("[data-magnetic]") : null;
      if (m !== cur) {
        if (cur) gsap.to(cur, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" });
        cur = m;
        box = m ? m.getBoundingClientRect() : null;
      }
      if (!cur) return;
      const k = parseFloat(cur.dataset.magnetic) || 0.35;
      gsap.to(cur, { x: (e.clientX - box.left - box.width / 2) * k, y: (e.clientY - box.top - box.height / 2) * k, duration: 0.5, ease: "power3.out" });
    }, { passive: true });
  }

  /* ================================================================
     Sections drive the page tone and the 3D object
     ================================================================ */
  IA.objState = null;
  IA.lockObj = false;
  function parseObj(sec) {
    const str = (IA.mobile() && sec.dataset.objM) || sec.dataset.obj;
    if (!str) return null;
    const [shape, x, y, s, dark, accent] = str.trim().split(/\s+/);
    const o = { x: +x, y: +y, scale: +s, dark: +dark, accent: accent || "#2b3dff", alpha: 1 };
    if (shape !== "-") o.shape = shape;
    if (shape === "none") { o.alpha = 0; delete o.shape; }
    return o;
  }
  IA.setObj = (o, dur = 1.5) => {
    if (!o) return;
    IA.objState = Object.assign({}, IA.objState || {}, o);
    if (IA.menuOpen) return;
    IA.scene.to(Object.assign({ shadow: o.dark > 0.5 ? 0 : 1 }, o), dur);
  };
  function setTone(page, tone) {
    if (!tone) return;
    page.dataset.tone = tone;
    if (page === currentPage()) html.dataset.tone = tone;
  }
  function applySection(sec, dur) {
    const page = sec.closest(".page");
    if (sec.dataset.tone) setTone(page, sec.dataset.tone);
    if (sec.dataset.obj && !IA.lockObj) IA.setObj(parseObj(sec), dur);
  }
  IA.applySection = applySection;
  function bindSections(page) {
    $$("[data-tone], [data-obj]", page).forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec, start: "top 55%", end: "bottom 55%",
        onToggle: (self) => { if (self.isActive) applySection(sec); },
      });
    });
  }
  function sectionAtCenter(page) {
    const mid = window.innerHeight * 0.55;
    let found = null;
    $$("[data-obj], [data-tone]", page).forEach((s) => {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) found = s;
    });
    return found || $("[data-obj]", page);
  }
  const currentPage = () => $$(".page").filter((p) => !p.classList.contains("is-leaving"))[0];

  /* ================================================================
     Site settings, clock, copy, toast
     ================================================================ */
  function applySite(root) {
    const s = IA.site;
    $$("[data-needs-email]", root).forEach((el) => (el.hidden = !s.email));
    $$("[data-email]", root).forEach((el) => (el.textContent = s.email));
    $$("[data-socials]", root).forEach((el) => {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      (s.socials || []).forEach((p) => {
        const a = document.createElement("a");
        a.href = p.href;
        a.target = "_blank";
        a.rel = "noopener";
        a.className = el.dataset.socials || "";
        a.textContent = p.label + " ↗";
        el.appendChild(a);
      });
    });
  }
  function clocks() {
    let t;
    try {
      t = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: IA.site.timezone }).format(new Date());
    } catch (e) { t = new Date().toTimeString().slice(0, 8); }
    $$("[data-clock]").forEach((el) => (el.textContent = el.dataset.clock === "full" ? `${t} ${IA.site.tzLabel}` : t));
  }
  IA.toast = (msg) => {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    gsap.fromTo(t, { yPercent: 160 }, { yPercent: 0, duration: 0.7, ease: "expo.out" });
    gsap.to(t, { yPercent: 160, duration: 0.6, ease: "expo.in", delay: 2.4 });
  };
  IA.copy = async (text, el) => {
    try { await navigator.clipboard.writeText(text); IA.toast("Copied"); }
    catch (e) {
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      IA.toast("Selected. Press Ctrl+C or Cmd+C to copy");
    }
  };

  /* ================================================================
     Page lifecycle
     ================================================================ */
  let current = null;
  function mount(page) {
    const main = $("main", page);
    const name = main.dataset.page;
    html.dataset.page = name;
    const cleanups = [];
    const ctx = gsap.context(() => {
      applySite(page);
      const mod = IA.pages && IA.pages[name];
      if (mod && mod.init) {
        try { mod.init({ page, main, cleanup: (fn) => cleanups.push(fn) }); } catch (err) { console.error(err); }
      }
      prep(page);
      bindReveals(page);
      bindSections(page);
    }, page);
    current = { page, ctx, cleanups, name };
    ScrollTrigger.refresh();
    const sec = sectionAtCenter(page);
    if (sec) applySection(sec, 1.6);
    $$("[data-nav]").forEach((a) => a.toggleAttribute("aria-current", a.dataset.nav === (name === "venture" ? "ventures" : name)));
  }
  function unmount() {
    if (!current) return;
    current.cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    current.ctx.revert();
    current = null;
  }
  // venture pages fill themselves from data before their first frame
  IA.renderPage = (page) => {
    const main = $("main", page);
    const mod = IA.pages && IA.pages[main.dataset.page];
    if (mod && mod.render) mod.render({ page, main });
  };

  /* ================================================================
     Backstage title shown between cards
     ================================================================ */
  function backstage(text) {
    const el = $(".backstage-title");
    if (!el) return null;
    el.textContent = text;
    el._u = null;
    const u = split(el, "chars");
    const tl = gsap.timeline();
    tl.fromTo(u, { yPercent: 118, "--w": 62 }, { yPercent: 0, "--w": 118, duration: 0.9, ease: "expo.out", stagger: 0.03 });
    return tl;
  }
  function backstageOut() {
    const el = $(".backstage-title");
    if (el && el._u) gsap.to(el._u, { yPercent: -118, duration: 0.6, ease: "expo.in", stagger: 0.015 });
  }

  /* ================================================================
     Menu: the page drops away like a card; the object previews each link
     ================================================================ */
  const menu = {
    init() {
      this.el = $("#menu");
      this.btn = $(".menu-btn");
      if (!this.el || !this.btn) return;
      this.words = $$(".menu-link .menu-word", this.el);
      this.words.forEach((w) => split(w, "chars"));
      this.btn.addEventListener("click", () => (IA.menuOpen ? this.close() : this.open()));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && IA.menuOpen) { this.close(); this.btn.focus(); } });
      document.addEventListener("click", (e) => {
        if (!IA.menuOpen || router.busy) return;
        const card = e.target.closest && e.target.closest(".page.is-card");
        if (card) { e.preventDefault(); this.close(); }
      }, true);
      $$("[data-preview]", this.el).forEach((a) => {
        const word = $(".menu-word", a);
        a.addEventListener("pointerenter", () => {
          if (!IA.menuOpen) return;
          const [shape, accent] = a.dataset.preview.split(" ");
          IA.scene.shape(shape, 1.1);
          IA.scene.to({ accent: accent || "#2b3dff" }, 1.1);
          this.el.classList.add("is-hovering");
          a.classList.add("is-hot");
          if (word && word._u && !IA.reduced) gsap.to(word._u, { "--w": 125, duration: 0.8, ease: "expo.out", stagger: 0.025, overwrite: "auto" });
        });
        a.addEventListener("pointerleave", () => {
          a.classList.remove("is-hot");
          this.el.classList.remove("is-hovering");
          if (word && word._u && !IA.reduced) gsap.to(word._u, { "--w": 100, duration: 0.8, ease: "expo.out", stagger: 0.015, overwrite: "auto" });
        });
      });
    },
    open() {
      if (router.busy || IA.menuOpen) return;
      const page = currentPage();
      IA.menuOpen = true;
      IA.scrollStop();
      html.classList.add("menu-open");
      this.btn.setAttribute("aria-expanded", "true");
      this.el.hidden = false;
      const y = window.scrollY, vh = window.innerHeight, H = page.offsetHeight;
      page.classList.add("is-card");
      page.setAttribute("aria-hidden", "true");
      gsap.set(page, { clipPath: `inset(${y}px 0px ${Math.max(0, H - y - vh)}px 0px round 0px)`, transformOrigin: `50% ${y}px` });
      const m = IA.mobile();
      if (this.tl) this.tl.kill();
      this.tl = gsap.timeline({ defaults: { ease: "expo.inOut" } })
        .to(page, { scale: m ? 0.9 : 0.84, y: vh * (m ? 0.74 : 0.68), clipPath: `inset(${y}px 0px ${Math.max(0, H - y - vh)}px 0px round 30px)`, duration: 1.05 }, 0)
        .fromTo(this.words.map((w) => w._u).flat(), { yPercent: 118, "--w": 62 }, { yPercent: 0, "--w": 100, duration: 1.1, ease: "expo.out", stagger: 0.012 }, 0.32)
        .fromTo($$(".menu-fade", this.el), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: "expo.out", stagger: 0.05 }, 0.45)
        .to(".menu-btn-label .is-a", { yPercent: -100, duration: 0.6 }, 0)
        .to(".menu-btn-label .is-b", { yPercent: -100, duration: 0.6 }, 0);
      IA.scene.to({ x: m ? 0.35 : 0.3, y: m ? -0.2 : 0.42, scale: m ? 0.22 : 0.3, dark: 1, shadow: 0, alpha: 1 }, 1.2);
      const first = $(".menu-link", this.el);
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 400);
    },
    close(instant) {
      if (!IA.menuOpen) return Promise.resolve();
      const page = currentPage();
      return new Promise((resolve) => {
        const done = () => {
          gsap.set(page, { clearProps: "transform,clipPath,transformOrigin" });
          page.classList.remove("is-card");
          page.removeAttribute("aria-hidden");
          this.el.hidden = true;
          html.classList.remove("menu-open");
          IA.menuOpen = false;
          this.btn.setAttribute("aria-expanded", "false");
          IA.scrollStart();
          resolve();
        };
        if (instant) { if (this.tl) this.tl.progress(0).kill(); done(); return; }
        if (IA.objState) IA.scene.to(Object.assign({ shadow: IA.objState.dark > 0.5 ? 0 : 1 }, IA.objState), 1.2);
        this.tl.eventCallback("onReverseComplete", done);
        this.tl.timeScale(1.35).reverse();
      });
    },
  };
  IA.menu = menu;

  /* ================================================================
     Router: fetch the next page and deal it in as a new card
     ================================================================ */
  const LABELS = { "": "Home", "index.html": "Home", "ventures.html": "Ventures", "about.html": "About", "contact.html": "Contact", "venture.html": "Venture" };
  const router = {
    cache: new Map(),
    busy: false,
    key: (u) => u.pathname + u.search,
    init() {
      const snap = "<!doctype html>" + html.outerHTML;
      this.cache.set(this.key(new URL(location.href)), snap);
      const m = $("main");
      if (m && m.dataset.page === "home") this.cache.set(this.key(new URL("index.html", location.href)), snap);
      document.addEventListener("click", (e) => this.onClick(e));
      window.addEventListener("popstate", () => this.go(location.href, { push: false }));
      document.addEventListener("pointerover", (e) => {
        const a = e.target.closest && e.target.closest("a[href]");
        if (a && this.internal(a) && location.protocol !== "file:") this.load(new URL(a.href, location.href)).catch(() => {});
      });
    },
    internal(a) {
      if (a.target && a.target !== "_self") return false;
      if (a.hasAttribute("download") || a.hasAttribute("data-no-router")) return false;
      const href = a.getAttribute("href") || "";
      if (/^(mailto|tel|sms|javascript):/i.test(href)) return false;
      const url = new URL(a.href, location.href);
      return url.origin === location.origin && (/\.html?$/.test(url.pathname) || url.pathname.endsWith("/"));
    },
    onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || !this.internal(a)) return;
      const url = new URL(a.href, location.href);
      const same = url.pathname === location.pathname && url.search === location.search;
      const isVenture = html.dataset.page === "venture";
      if (same && url.hash && !(isVenture && url.hash !== location.hash)) {
        const t = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (t) { e.preventDefault(); IA.scrollTo(t.getBoundingClientRect().top + window.scrollY); }
        return;
      }
      if (same && !url.hash && !isVenture) {
        e.preventDefault();
        if (IA.menuOpen) menu.close().then(() => IA.scrollTo(0)); else IA.scrollTo(0);
        return;
      }
      if (location.protocol === "file:") return;
      e.preventDefault();
      this.go(url.href, { label: a.dataset.label });
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
        const v = IA.project(decodeURIComponent(url.hash.slice(1))) || IA.projects[0];
        return v.title;
      }
      return LABELS[file] || "Arham";
    },
    async go(href, { push = true, label } = {}) {
      if (this.busy) return;
      this.busy = true;
      const url = new URL(href, location.href);
      const loading = this.load(url);
      loading.catch(() => {});
      const fromMenu = IA.menuOpen;
      IA.menuOpen = false;
      const old = currentPage();
      const vh = window.innerHeight;
      IA.scrollStop();
      IA.lockObj = true;

      // 1. the old card leaves
      const tl = gsap.timeline();
      if (fromMenu) {
        tl.to(old, { y: vh * 1.15, duration: 0.75, ease: "expo.in" }, 0)
          .to($$(".menu-word .u, .menu-fade", menu.el), { yPercent: -118, autoAlpha: 0, duration: 0.6, ease: "expo.in", stagger: 0.006 }, 0);
      } else {
        const y = window.scrollY, H = old.offsetHeight;
        gsap.set(old, { clipPath: `inset(${y}px 0px ${Math.max(0, H - y - vh)}px 0px round 0px)`, transformOrigin: `50% ${y + vh / 2}px` });
        tl.to(old, { scale: 0.86, clipPath: `inset(${y}px 0px ${Math.max(0, H - y - vh)}px 0px round 30px)`, duration: 0.65, ease: "power3.inOut" }, 0)
          .to(old, { y: -vh * 1.12, duration: 0.75, ease: "expo.in" }, 0.45);
      }
      old.classList.add("is-leaving");
      const title = backstage(label || this.labelFor(url));
      if (title) tl.add(title, fromMenu ? 0.5 : 0.5);

      let text;
      try { text = await loading; } catch (err) { location.href = url.href; return; }
      const doc = new DOMParser().parseFromString(text, "text/html");
      const nextPage = doc.querySelector(".page");
      if (!nextPage) { location.href = url.href; return; }
      if (push) { try { history.pushState({}, "", url.href); } catch (err) { /* sandboxed frame */ } }
      IA.routeHash = url.hash;

      // 2. the new card is dealt in from below
      const fresh = document.importNode(nextPage, true);
      fresh.classList.add("is-entering");
      gsap.set(fresh, { y: vh * 1.08, scale: 0.86, borderRadius: 30, transformOrigin: "50% 50%" });
      old.after(fresh);
      if (doc.title) document.title = doc.title;
      IA.renderPage(fresh);
      applySite(fresh);
      prep(fresh);
      const firstSec = $("[data-obj]", fresh);
      IA.lockObj = false;
      if (firstSec) applySection(firstSec, 1.5);

      await tl.then();
      if (menu.el) {
        menu.el.hidden = true;
        gsap.set($$(".menu-word .u, .menu-fade", menu.el), { clearProps: "all" });
      }
      html.classList.remove("menu-open");
      menu.btn && menu.btn.setAttribute("aria-expanded", "false");
      gsap.set(".menu-btn-label span", { yPercent: 0 });
      backstageOut();
      playFirstScreen(fresh, 0.35);
      await gsap.timeline()
        .to(fresh, { y: 0, duration: 0.95, ease: "expo.out" }, 0)
        .to(fresh, { scale: 1, borderRadius: 0, duration: 0.7, ease: "power3.inOut" }, 0.55)
        .then();

      // 3. swap for real
      unmount();
      old.remove();
      fresh.classList.remove("is-entering");
      gsap.set(fresh, { clearProps: "transform,borderRadius,transformOrigin" });
      window.scrollTo(0, 0);
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      mount(fresh);
      IA.scrollStart();
      const h1 = $("h1", fresh);
      if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
      this.busy = false;
    },
  };
  IA.router = router;

  /* ================================================================
     Loader and boot
     ================================================================ */
  function runLoader(first) {
    return new Promise((resolve) => {
      const count = $(".loader-count");
      const word = $(".loader-word");
      if (word) {
        const u = split(word, "chars");
        gsap.fromTo(u, { yPercent: 118, "--w": 62 }, { yPercent: 0, "--w": 125, duration: 1.4, ease: "expo.out", stagger: 0.05 });
      }
      let loaded = false;
      const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      const win = new Promise((r) => (document.readyState === "complete" ? r() : window.addEventListener("load", r, { once: true })));
      Promise.all([fonts, win]).then(() => (loaded = true));
      setTimeout(() => (loaded = true), 3500);
      const o = { v: 0 };
      const minT = first ? 1.9 : 0.5;
      gsap.to(o, {
        v: 100, duration: minT, ease: "power2.inOut",
        onUpdate: () => { if (count) count.textContent = String(Math.round(o.v)).padStart(3, "0"); },
        onComplete: () => {
          const wait = () => (loaded ? resolve() : setTimeout(wait, 60));
          wait();
        },
      });
    });
  }

  async function boot() {
    IA.scene.init($(".stage"));
    initScroll();
    initCursor();
    initMagnetic();
    menu.init();
    router.init();
    clocks();
    setInterval(clocks, 1000);
    applySite(document);
    document.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-copy-email]");
      if (b && IA.site.email) IA.copy(IA.site.email, b);
    });

    const page = currentPage();
    IA.routeHash = location.hash;
    IA.renderPage(page);
    prep(page);
    const vh = window.innerHeight;
    const first = !session.get("arham-seen");

    if (IA.reduced) {
      html.classList.remove("is-loading");
      IA.scene.to({ alpha: 1 }, 0.01);
      $$("[data-anim]", page).forEach((el) => play(el));
      mount(page);
      return;
    }

    const H = page.offsetHeight;
    gsap.set(page, { y: vh * 1.08, scale: 0.86, transformOrigin: `50% ${vh / 2}px`, clipPath: `inset(0px 0px ${Math.max(0, H - vh)}px 0px round 30px)` });
    html.classList.remove("is-loading");
    IA.scene.to({ shape: "liquid", x: 0, y: 0.02, scale: 0.26, dark: 1, alpha: 1, shadow: 0, accent: "#2b3dff" }, 0.01);
    await runLoader(first);
    session.set("arham-seen", "1");

    const lw = $(".loader-word");
    if (lw && lw._u) gsap.to(lw._u, { yPercent: -118, duration: 0.7, ease: "expo.in", stagger: 0.025 });
    gsap.to(".loader-meta", { autoAlpha: 0, duration: 0.4 });
    const firstSec = $("[data-obj]", page);
    if (firstSec) applySection(firstSec, 1.8);
    playFirstScreen(page, 0.55);
    await gsap.timeline()
      .to(page, { y: 0, duration: 1.15, ease: "expo.out" }, 0.25)
      .to(page, { scale: 1, clipPath: `inset(0px 0px ${Math.max(0, H - vh)}px 0px round 0px)`, duration: 0.8, ease: "power3.inOut" }, 0.85)
      .then();
    gsap.set(page, { clearProps: "transform,clipPath,transformOrigin" });
    $(".loader") && $(".loader").remove();
    mount(page);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
