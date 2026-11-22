/* IRIS ARDEN — pages.js
   One module per page. Each init(ctx) receives { main, scope, iris } and may
   set ctx.iris to a preset object or a function of scroll position. Anything
   registered on ctx.scope is torn down when the router swaps pages. */
(function () {
  "use strict";
  const IA = window.IA;
  const { $, $$ } = IA;
  const P = (IA.pages = IA.pages || {});

  const ARROW = '<svg class="arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" stroke-width="1.4"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const projectHref = (p) => `project.html#${p.slug}`;
  const linkAttrs = (p) => `href="${projectHref(p)}" data-label="${esc(p.title)}" data-kicker="${esc(p.client)}"`;

  /* idle-time cover rendering so hovers never stutter */
  function warmCovers(list, w, h, scope) {
    let i = 0;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 60));
    const next = () => {
      if (scope.dead || i >= list.length) return;
      IA.art.cover(list[i++], w, h);
      idle(next);
    };
    idle(next);
  }

  /* ---------------- work list rows + floating preview ---------------- */
  function renderRows(listEl, projects) {
    listEl.innerHTML = projects
      .map(
        (p) => `<li data-tags="${p.tags.join(" ")}">
  <a class="work-row" ${linkAttrs(p)} data-cursor="Open" data-slug="${p.slug}">
    <span class="label year">${p.year}</span>
    <span class="work-row-title">${esc(p.title)}</span>
    <span class="work-row-tags">${p.tags.map((t) => `<span class="chip">${t}</span>`).join("")}</span>
    <span class="work-row-arrow" aria-hidden="true">${ARROW}</span>
    <span class="work-row-thumb" aria-hidden="true"><canvas></canvas></span>
  </a>
</li>`
      )
      .join("");
  }

  function bindPreview(listEl, scope) {
    const thumbs = $$(".work-row", listEl);
    // phone/tablet: inline thumbnails painted when visible
    const io = scope.observe(new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const row = en.target;
        const c = row.querySelector(".work-row-thumb canvas");
        if (c && c.offsetWidth) IA.art.paint(c, IA.project(row.dataset.slug), { maxDpr: 1.5 });
        io.unobserve(row);
      });
    }, { rootMargin: "200px" }));
    thumbs.forEach((r) => io.observe(r));

    if (!IA.env.fine) return;
    const pv = document.createElement("div");
    pv.className = "hover-preview";
    pv.setAttribute("aria-hidden", "true");
    pv.innerHTML = '<canvas></canvas><span class="hover-preview-cap"></span>';
    listEl.closest("main").appendChild(pv);
    const canvas = pv.querySelector("canvas");
    const cap = pv.querySelector(".hover-preview-cap");
    let mx = 0, my = 0, x = 0, y = 0, rot = 0, active = null, shownOnce = false;
    warmCovers($$(".work-row", listEl).map((r) => IA.project(r.dataset.slug)), 400, 300, scope);

    scope.on(window, "pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    thumbs.forEach((row) => {
      scope.on(row, "pointerenter", () => {
        const p = IA.project(row.dataset.slug);
        if (active !== p) IA.art.blit(canvas, IA.art.cover(p, 400, 300));
        active = p;
        cap.textContent = `${p.client} · ${p.year}`;
        if (!shownOnce) { x = mx; y = my; shownOnce = true; }
        pv.classList.add("is-on");
      });
      scope.on(row, "pointerleave", () => pv.classList.remove("is-on"));
    });
    scope.tick((dt) => {
      const px = x;
      x = IA.damp(x, mx, 9, dt);
      y = IA.damp(y, my, 9, dt);
      rot = IA.damp(rot, IA.clamp((x - px) * 0.35, -14, 14), 8, dt);
      const w = pv.offsetWidth, h = pv.offsetHeight;
      pv.style.transform = `translate3d(${(x - w * 0.5).toFixed(1)}px, ${(y - h * 0.62).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
    }, 20);
  }

  /* ---------------- word-level wrapper for scroll-lit text ---------------- */
  function wrapLit(el) {
    const words = [];
    const walk = (node, opal) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const s = document.createElement("span");
            s.className = "mw" + (opal ? " opal-text" : "");
            s.textContent = part;
            words.push(s);
            frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          const isOpal = child.classList.contains("opal-text");
          if (isOpal) child.classList.remove("opal-text");
          walk(child, opal || isOpal);
        }
      });
    };
    walk(el, false);
    return words;
  }

  function apertureIcon(canvas, open, accent) {
    const { w, h, dpr } = IA.fitCanvas(canvas, 2);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const c = IA.colors;
    const rad = w / 2 - 2 * dpr;
    IA.art.drawAperture(ctx, w, h, open, {
      blades: 7,
      clip: rad,
      R: rad / Math.cos(Math.PI / 7),
      lineWidth: dpr,
      ring: c.fg2,
      twist: 1.2,
      colors: {
        blade: IA.mixRgb(c.bg2, c.fg3, 0.35),
        blade2: IA.mixRgb(c.bg2, c.fg2, 0.4),
        edge: accent ? [c.peach, c.rose, c.lilac, c.jade] : [c.fg],
      },
    });
  }
  IA.apertureIcon = apertureIcon;

  /* =================================================================
     HOME
     ================================================================= */
  P.home = {
    init(ctx) {
      const { main, scope } = ctx;
      const mobile = () => IA.env.mobile;

      // the iris dilates as you scroll into it
      ctx.iris = (y) => {
        const vh = window.innerHeight;
        const p = IA.clamp(y / (vh * 0.95));
        const e = Math.pow(p, 2.1);
        return {
          cx: 0.5,
          cy: mobile() ? 0.43 : 0.455,
          pupil: IA.lerp(mobile() ? 0.12 : 0.105, 1.9, e),
          iris: IA.lerp(mobile() ? 0.42 : 0.4, 3.6, e),
          intensity: IA.lerp(1, 0.75, p),
          dust: IA.lerp(0.3, 0.9, p),
          hue: 0,
        };
      };

      // circular caption riding the iris
      const ringText = $(".iris-ring-text", main);
      if (ringText) {
        IA.introReady.then(() => setTimeout(() => !scope.dead && ringText.classList.add("is-on"), 900));
        scope.tick(() => {
          const s = IA.iris.screen();
          const R = s.r * 1.45;
          const S = R * 2.5;
          ringText.style.width = S + "px";
          ringText.style.height = S + "px";
          ringText.style.transform = `translate3d(${(s.x - S / 2).toFixed(1)}px, ${(s.y - S / 2).toFixed(1)}px, 0)`;
          const vis = IA.clamp(1 - IA.scroll.y / (window.innerHeight * 0.25)) * (window.innerWidth > 600 ? 1 : 0);
          ringText.style.visibility = vis > 0.01 ? "visible" : "hidden";
          ringText.querySelector("svg").style.opacity = vis.toFixed(3);
        }, 95);
      }

      // manifesto: words light up as you scroll through it
      const man = $(".manifesto", main);
      if (man) {
        const words = wrapLit($(".manifesto-text", man));
        let lit = -1;
        const set = (n) => {
          if (n === lit) return;
          lit = n;
          words.forEach((w, i) => w.classList.toggle("is-lit", i < n));
        };
        if (IA.env.reduced) set(words.length);
        else scope.tick(() => {
          const r = man.getBoundingClientRect();
          const vh = window.innerHeight;
          const total = IA.env.mobile ? r.height + vh * 0.2 : r.height - vh;
          const start = IA.env.mobile ? vh * 0.75 : 0;
          const p = IA.clamp((start - r.top) / Math.max(1, total * 0.85));
          set(Math.round(p * words.length));
        }, 20);
      }

      // selected work
      const list = $("[data-work-list]", main);
      if (list) {
        renderRows(list, IA.projects.filter((p) => p.featured));
        bindPreview(list, scope);
      }

      // process: pinned horizontal track with aperture icons opening per stage
      const proc = $(".process", main);
      if (proc) {
        const sticky = $(".process-sticky", proc);
        const track = $(".process-track", proc);
        const panels = $$(".process-panel", proc);
        const canvases = panels.map((p) => p.querySelector("canvas"));
        const opens = panels.map((p) => parseFloat(p.dataset.open || "0.5"));
        const lastOpen = panels.map(() => -1);
        let dist = 0;
        const measure = () => {
          if (IA.env.mobile) { proc.style.height = ""; dist = 0; return; }
          const cs = getComputedStyle(sticky);
          const inner = sticky.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          dist = Math.max(0, track.scrollWidth - inner);
          proc.style.height = `${window.innerHeight + dist}px`;
          IA.scroll.measure();
        };
        measure();
        scope.on(window, "resize", measure);
        IA.introReady.then(() => !scope.dead && measure());
        if (document.fonts) document.fonts.ready.then(() => !scope.dead && measure());
        scope.on(document, "ia:theme", () => lastOpen.fill(-1));
        scope.tick(() => {
          const vw = window.innerWidth;
          if (dist > 0) {
            const r = proc.getBoundingClientRect();
            const p = IA.clamp(-r.top / dist);
            track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`;
          }
          panels.forEach((panel, i) => {
            const b = panel.getBoundingClientRect();
            if (b.bottom < 0 || b.top > window.innerHeight) return;
            const c = 1 - IA.clamp(Math.abs(b.left + b.width / 2 - vw * 0.5) / (vw * 0.7));
            const o = IA.env.mobile ? opens[i] : opens[i] * (0.3 + 0.7 * IA.ease.outCubic(c));
            if (Math.abs(o - lastOpen[i]) < 0.003) return;
            lastOpen[i] = o;
            apertureIcon(canvases[i], o, true);
          });
        }, 15);
      }
    },
  };

  /* =================================================================
     WORK
     ================================================================= */
  P.work = {
    init(ctx) {
      const { main, scope } = ctx;
      ctx.iris = (y) => {
        const m = IA.env.mobile;
        return IA.irisScroll(
          { cx: m ? 0.84 : 0.8, cy: m ? 0.1 : 0.27, pupil: m ? 0.07 : 0.105, iris: m ? 0.34 : 0.4, intensity: 1, dust: 0.5, hue: 0.12 },
          { cx: m ? 0.88 : 0.93, cy: 0.12, pupil: 0.03, iris: 0.13, intensity: 0.5, dust: 0.6 },
          y
        );
      };
      const projects = IA.projects;
      const grid = $("[data-work-grid]", main);
      const list = $("[data-work-list]", main);
      const views = $(".work-views", main);
      const count = $("[data-work-count]", main);
      if (count) count.textContent = `(${String(projects.length).padStart(2, "0")})`;

      grid.innerHTML = projects
        .map(
          (p, i) => `<a class="card" ${linkAttrs(p)} data-cursor="Open" data-tags="${p.tags.join(" ")}" data-slug="${p.slug}" data-reveal style="--d:${(i % 2) * 120}ms">
  <div class="card-frame" data-tilt="5">
    <canvas class="latent" aria-hidden="true"></canvas>
    <canvas class="developed" aria-hidden="true"></canvas>
    <span class="card-glare" aria-hidden="true"></span>
    <span class="card-badge">${p.year} · ${p.tags.join(" / ")}</span>
    <span class="card-hint" aria-hidden="true">${IA.env.fine ? "Hover to develop" : ""}</span>
  </div>
  <div class="card-info">
    <h2 class="card-title">${esc(p.title)}</h2>
    <span class="label">${esc(p.client)}</span>
    <p class="card-sub">${esc(p.tagline)}</p>
  </div>
</a>`
        )
        .join("");
      renderRows(list, projects);
      bindPreview(list, scope);

      const cards = $$(".card", grid);
      const layout = () => {
        let v = 0;
        cards.forEach((c) => { if (!c.classList.contains("is-hidden")) c.classList.toggle("is-offset", v++ % 2 === 1); });
      };
      layout();

      // covers: latent (monochrome) underneath, developed (colour) revealed by the lens
      const io = scope.observe(new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const card = en.target;
          const p = IA.project(card.dataset.slug);
          const dev = card.querySelector(".developed");
          const lat = card.querySelector(".latent");
          IA.art.paint(dev, p, { maxDpr: 1.6 });
          const { w, h } = IA.fitCanvas(lat, 1.6);
          lat.getContext("2d").drawImage(dev, 0, 0, w, h);
          io.unobserve(card);
        });
      }, { rootMargin: "300px" }));
      cards.forEach((c) => io.observe(c));

      cards.forEach((card) => {
        const dev = card.querySelector(".developed");
        let r = IA.env.fine ? 0 : 4000;
        dev.style.setProperty("--r", r + "px");
        if (!IA.env.fine) return;
        let stop = null;
        const to = (target, dur) => {
          if (stop) stop.cancelled = true;
          const token = { cancelled: false };
          stop = token;
          const from = r;
          IA.tween({ from, to: target, duration: dur, ease: IA.ease.outExpo, onUpdate: (v) => { if (token.cancelled) return; r = v; dev.style.setProperty("--r", v.toFixed(1) + "px"); } });
        };
        scope.on(card, "pointerenter", () => to(Math.max(card.offsetWidth * 0.32, 160), 900));
        scope.on(card, "pointerleave", () => to(0, 700));
      });

      // filters with FLIP
      const chips = $$("[data-filter]", main);
      chips.forEach((chip) => {
        const tag = chip.dataset.filter;
        const n = tag === "All" ? projects.length : projects.filter((p) => p.tags.includes(tag)).length;
        const sup = chip.querySelector("sup");
        if (sup) sup.textContent = n;
        scope.on(chip, "click", () => {
          chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
          const first = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
          const show = (el) => tag === "All" || el.dataset.tags.split(" ").includes(tag);
          cards.forEach((c) => c.classList.toggle("is-hidden", !show(c)));
          $$("li", list).forEach((li) => (li.hidden = !show(li)));
          layout();
          cards.forEach((c) => {
            if (c.classList.contains("is-hidden") || IA.env.reduced) return;
            c.classList.add("is-in");
            const a = first.get(c), b = c.getBoundingClientRect();
            if (!a.width) {
              c.animate([{ opacity: 0, transform: "translateY(40px) scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: 800, easing: "cubic-bezier(0.16,1,0.3,1)" });
              return;
            }
            const dx = a.left - b.left, dy = a.top - b.top;
            if (Math.abs(dx) + Math.abs(dy) > 1) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 900, easing: "cubic-bezier(0.16,1,0.3,1)" });
          });
          IA.scroll.measure();
        });
      });

      // grid / list toggle
      const toggles = $$("[data-view]", main);
      const setView = (v) => {
        views.classList.toggle("work-grid-view", v === "grid");
        views.classList.toggle("work-list-view", v === "list");
        toggles.forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.view === v)));
        IA.store.set("ia-view", v);
        IA.scroll.measure();
        if (v === "grid") cards.forEach((c) => c.classList.add("is-in"));
      };
      toggles.forEach((t) => scope.on(t, "click", () => setView(t.dataset.view)));
      setView(IA.store.get("ia-view", "grid") === "list" ? "list" : "grid");
    },
  };

  /* =================================================================
     PROJECT (case study rendered from data.js)
     ================================================================= */
  P.project = {
    init(ctx) {
      const { main, scope } = ctx;
      const slug = decodeURIComponent((IA.routeHash != null ? IA.routeHash : location.hash).replace(/^#/, ""));
      const idx = Math.max(0, IA.projects.findIndex((p) => p.slug === slug));
      const p = IA.projects[idx];
      const next = IA.projects[(idx + 1) % IA.projects.length];
      document.title = `${p.title} · Iris Arden`;
      ctx.iris = (y) => {
        const m = IA.env.mobile;
        return IA.irisScroll(
          { cx: m ? 0.84 : 0.83, cy: m ? 0.1 : 0.22, pupil: m ? 0.065 : 0.075, iris: 0.3, intensity: 0.95, dust: 0.5, hue: p.hue },
          { cx: 0.93, cy: 0.1, pupil: 0.03, iris: 0.12, intensity: 0.45, dust: 0.6 },
          y
        );
      };

      const set = (key, value, isHTML) => $$(`[data-p="${key}"]`, main).forEach((el) => (isHTML ? (el.innerHTML = value) : (el.textContent = value)));
      const words = p.title.split(" ");
      const titleHTML = words.length > 1 ? `${esc(words.slice(0, -1).join(" "))} <span class="serif">${esc(words[words.length - 1])}</span>` : esc(p.title);
      set("title", titleHTML, true);
      set("client", p.client);
      set("year", String(p.year));
      set("tags", p.tags.join(" / "));
      set("tagline", p.tagline);
      set("role", p.role);
      set("duration", p.duration);
      set("stack", p.stack.join(", "));
      set("summary", p.summary);
      set("challenge", p.challenge);
      set("frame-cap", `${p.client} · ${p.year} · Live render`);
      set(
        "approach",
        p.approach.map((a, i) => `<li class="p-step" data-reveal style="--d:${i * 90}ms"><span class="label">Step ${i + 1}</span><div><h3>${esc(a[0])}</h3><p>${esc(a[1])}</p></div></li>`).join(""),
        true
      );
      set(
        "results",
        p.results
          .map((r, i) => {
            const val = `${r.prefix || ""}${r.decimals ? r.v.toFixed(r.decimals) : r.v}${r.suffix || ""}`;
            return `<div class="p-result" data-reveal style="--d:${i * 110}ms"><b data-count="${r.v}" data-decimals="${r.decimals || 0}" data-prefix="${esc(r.prefix || "")}" data-suffix="${esc(r.suffix || "")}">${esc(val)}</b><span>${esc(r.l)}</span></div>`;
          })
          .join(""),
        true
      );
      set("credits", p.credits.map((c) => `<div><dt>${esc(c[0])}</dt><dd>${esc(c[1])}</dd></div>`).join(""), true);
      const nextLink = $("[data-p-next]", main);
      if (nextLink) {
        nextLink.setAttribute("href", projectHref(next));
        nextLink.dataset.label = next.title;
        nextLink.dataset.kicker = next.client;
        set("next-title", next.title);
        set("next-client", `${next.client} · ${next.year}`);
        const nc = $(".p-next-cover canvas", main);
        if (nc) IA.introReady.then(() => !scope.dead && IA.art.blit(nc, IA.art.cover(next, 400, 300)));
      }

      // hero: a live render of the cover that opens to full bleed on scroll
      const frame = $(".p-frame", main);
      const live = $(".p-frame canvas", main);
      let visible = true, acc = 1;
      const fio = scope.observe(new IntersectionObserver((en) => (visible = en[0].isIntersecting)));
      fio.observe(frame);
      const paintLive = (t) => IA.art.paint(live, p, { t, live: true, maxDpr: 1.25 });
      paintLive(0);
      scope.tick((dt, time) => {
        const r = frame.getBoundingClientRect();
        const vh = window.innerHeight;
        const k = IA.env.reduced ? 1 : IA.clamp(1 - r.top / (vh * 0.7));
        const ins = (1 - IA.ease.outCubic(k)) * 6;
        frame.style.setProperty("--inset", ins.toFixed(2) + "%");
        frame.style.setProperty("--inset-x", (IA.env.mobile ? 0 : ins).toFixed(2) + "%");
        if (!visible || IA.env.reduced) return;
        acc += dt;
        if (acc < 1 / 30) return;
        acc = 0;
        paintLive(time);
      }, 25);

      // gallery: alternate compositions from the same generator
      $$(".p-shot", main).forEach((shot, i) => {
        const c = shot.querySelector("canvas");
        const cap = shot.querySelector("figcaption");
        if (cap) cap.textContent = ["Detail study", "System at rest", "Full composition"][i] || "Study";
        const sio = scope.observe(new IntersectionObserver((en) => {
          if (!en[0].isIntersecting) return;
          IA.art.paint(c, p, { variant: i + 1, zoom: [1.6, 1.25, 1][i] || 1, panX: [0.12, -0.08, 0][i] || 0, panY: [0.05, 0.1, 0][i] || 0 });
          sio.disconnect();
        }, { rootMargin: "300px" }));
        sio.observe(shot);
      });
    },
  };

  /* =================================================================
     ABOUT
     ================================================================= */
  function contourPortrait(canvas, scope) {
    const noise = IA.makeNoise(11);
    const GX = 64, GY = 80;
    const W = GX + 1;
    const field = new Float32Array(W * (GY + 1));
    const LEVELS = 15;
    const m = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4, a: 0, ta: 0 };
    const SEG = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]], [[3, 0]], [[0, 2]], [[3, 2], [0, 1]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];
    const e = (x, y, cx, cy, rx, ry) => { const dx = (x - cx) / rx, dy = (y - cy) / ry; return Math.exp(-(dx * dx + dy * dy) * 1.15); };
    scope.on(canvas, "pointermove", (ev) => {
      const r = canvas.getBoundingClientRect();
      m.tx = (ev.clientX - r.left) / r.width;
      m.ty = (ev.clientY - r.top) / r.height;
      m.ta = 1;
    });
    scope.on(canvas, "pointerleave", () => (m.ta = 0));
    let visible = false, acc = 1;
    const io = scope.observe(new IntersectionObserver((en) => (visible = en[0].isIntersecting)));
    io.observe(canvas);

    const draw = (t) => {
      const { w, h, dpr } = IA.fitCanvas(canvas, 1.75);
      const ctx = canvas.getContext("2d");
      const c = IA.colors;
      ctx.fillStyle = `rgb(${c.bg2.join(",")})`;
      ctx.fillRect(0, 0, w, h);
      for (let j = 0; j <= GY; j++) {
        for (let i = 0; i <= GX; i++) {
          const x = i / GX, y = j / GY;
          let v = Math.max(e(x, y, 0.5, 0.35, 0.2, 0.24), e(x, y, 0.5, 0.62, 0.09, 0.14) * 0.85, e(x, y, 0.5, 1.02, 0.5, 0.33) * 0.95);
          v += noise.fbm(x * 3.2, y * 3.2 + t * 0.04, 3) * 0.2;
          if (m.a > 0.01) {
            const d = Math.hypot(x - m.x, (y - m.y) * 1.25);
            v += (Math.sin(d * 46 - t * 5) * Math.exp(-d * 7) * 0.07 + Math.exp(-d * d * 70) * 0.14) * m.a;
          }
          field[j * W + i] = v;
        }
      }
      const sx = w / GX, sy = h / GY;
      const pal = [c.peach, c.rose, c.lilac, c.jade];
      ctx.lineWidth = Math.max(1, dpr * 0.9);
      ctx.lineJoin = "round";
      for (let l = 0; l < LEVELS; l++) {
        const L = 0.06 + (l / (LEVELS - 1)) * 0.9;
        const u = (l / (LEVELS - 1)) * (pal.length - 1);
        const k = Math.floor(u);
        const col = IA.mixRgb(pal[k], pal[Math.min(k + 1, pal.length - 1)], u - k);
        ctx.strokeStyle = IA.rgba(col, l % 4 === 0 ? 0.95 : 0.55);
        ctx.beginPath();
        for (let j = 0; j < GY; j++) {
          for (let i = 0; i < GX; i++) {
            const a = field[j * W + i], b = field[j * W + i + 1], cc = field[(j + 1) * W + i + 1], d = field[(j + 1) * W + i];
            const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (cc > L ? 2 : 0) | (d > L ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const pt = (edge) => {
              switch (edge) {
                case 0: return [(i + (L - a) / (b - a)) * sx, j * sy];
                case 1: return [(i + 1) * sx, (j + (L - b) / (cc - b)) * sy];
                case 2: return [(i + (L - d) / (cc - d)) * sx, (j + 1) * sy];
                default: return [i * sx, (j + (L - a) / (d - a)) * sy];
              }
            };
            const segs = SEG[idx];
            for (let s = 0; s < segs.length; s++) {
              const p0 = pt(segs[s][0]), p1 = pt(segs[s][1]);
              ctx.moveTo(p0[0], p0[1]);
              ctx.lineTo(p1[0], p1[1]);
            }
          }
        }
        ctx.stroke();
      }
    };
    draw(0);
    scope.on(document, "ia:theme", () => draw(IA.ticker.time));
    scope.tick((dt, time) => {
      m.x = IA.damp(m.x, m.tx, 6, dt);
      m.y = IA.damp(m.y, m.ty, 6, dt);
      m.a = IA.damp(m.a, m.ta, 3, dt);
      if (!visible || IA.env.reduced) return;
      acc += dt;
      if (acc < 1 / 30) return;
      acc = 0;
      draw(time);
    }, 25);
  }

  function constellation(wrap, scope) {
    const canvas = wrap.querySelector("canvas");
    const items = $$("[data-skill]", wrap.closest("section") || document);
    const groups = ["Design", "Code", "Practice"];
    const centers = [[0.24, 0.4], [0.7, 0.36], [0.48, 0.72]];
    const r = IA.rng(42);
    const nodes = items.map((li) => {
      const g = Math.max(0, groups.indexOf(li.dataset.group));
      const a = r() * Math.PI * 2, d = 0.05 + r() * 0.15;
      const hx = centers[g][0] + Math.cos(a) * d * 1.2, hy = centers[g][1] + Math.sin(a) * d;
      return { label: li.dataset.skill, li, g, hx, hy, x: hx, y: hy, vx: 0, vy: 0, ph: r() * 10 };
    });
    // edges: two nearest within group + a few bridges
    const edges = [];
    nodes.forEach((n, i) => {
      const near = nodes.map((m, j) => [j, (m.hx - n.hx) ** 2 + (m.hy - n.hy) ** 2]).filter(([j]) => j !== i && nodes[j].g === n.g).sort((a, b) => a[1] - b[1]).slice(0, 2);
      near.forEach(([j]) => { if (!edges.some((e) => (e[0] === j && e[1] === i))) edges.push([i, j]); });
    });
    [["GLSL", "Generative art"], ["Figma", "Design systems"], ["Three.js", "Prototyping"], ["Rive", "Motion systems"], ["Blender", "WebGPU"]].forEach(([a, b]) => {
      const i = nodes.findIndex((n) => n.label === a), j = nodes.findIndex((n) => n.label === b);
      if (i > -1 && j > -1) edges.push([i, j]);
    });
    const mouse = { x: -9, y: -9, in: false };
    let hot = -1;
    const setHot = (i) => {
      if (i === hot) return;
      if (hot > -1) nodes[hot].li.classList.remove("is-hot");
      hot = i;
      if (hot > -1) nodes[hot].li.classList.add("is-hot");
    };
    scope.on(canvas, "pointermove", (e) => {
      const b = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - b.left) / b.width;
      mouse.y = (e.clientY - b.top) / b.height;
      mouse.in = true;
    });
    scope.on(canvas, "pointerleave", () => { mouse.in = false; setHot(-1); });
    items.forEach((li, i) => {
      scope.on(li, "pointerenter", () => setHot(i));
      scope.on(li, "pointerleave", () => setHot(-1));
    });
    let visible = false;
    const io = scope.observe(new IntersectionObserver((en) => (visible = en[0].isIntersecting)));
    io.observe(canvas);
    scope.tick((dt, t) => {
      if (!visible) return;
      const { w, h, dpr } = IA.fitCanvas(canvas, 2);
      const ctx = canvas.getContext("2d");
      const c = IA.colors;
      const pal = [c.peach, c.lilac, c.jade];
      const aspect = w / h;
      let best = -1, bestD = 0.0016;
      nodes.forEach((n, i) => {
        const tx = n.hx + Math.sin(t * 0.4 + n.ph) * 0.012;
        const ty = n.hy + Math.cos(t * 0.35 + n.ph) * 0.012;
        let fx = (tx - n.x) * 9, fy = (ty - n.y) * 9;
        if (mouse.in && !IA.env.reduced) {
          const dx = (n.x - mouse.x) * aspect, dy = n.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 0.02) { const f = (0.02 - d2) * 90; fx += dx * f; fy += dy * f; }
          if (d2 < bestD) { bestD = d2; best = i; }
        }
        n.vx = (n.vx + fx * dt) * Math.pow(0.02, dt);
        n.vy = (n.vy + fy * dt) * Math.pow(0.02, dt);
        n.x += n.vx * dt * 10;
        n.y += n.vy * dt * 10;
      });
      if (mouse.in) setHot(best);
      ctx.clearRect(0, 0, w, h);
      edges.forEach(([i, j]) => {
        const a = nodes[i], b = nodes[j];
        const on = hot === i || hot === j;
        ctx.strokeStyle = IA.rgba(on ? pal[a.g] : c.fg2, on ? 0.75 : 0.18);
        ctx.lineWidth = (on ? 1.4 : 1) * dpr;
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      });
      ctx.font = `${11 * dpr}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      nodes.forEach((n, i) => {
        const x = n.x * w, y = n.y * h;
        const on = hot === i;
        const col = pal[n.g];
        if (on) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 26 * dpr);
          g.addColorStop(0, IA.rgba(col, 0.45));
          g.addColorStop(1, IA.rgba(col, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 26 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = IA.rgba(col, 1);
        ctx.beginPath();
        ctx.arc(x, y, (on ? 5 : 3.2) * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = IA.rgba(on ? c.fg : c.fg2, on ? 1 : 0.85);
        ctx.fillText(n.label.toUpperCase(), x + 10 * dpr, y);
      });
    }, 25);
  }

  P.about = {
    init(ctx) {
      const { main, scope } = ctx;
      ctx.iris = (y) => {
        const m = IA.env.mobile;
        // on porcelain the dark pupil must never sit under the dark headline
        const L = IA.colors.light;
        return IA.irisScroll(
          { cx: m ? 0.86 : L ? 0.1 : 0.14, cy: m ? 0.1 : L ? 0.95 : 0.78, pupil: m ? 0.065 : 0.07, iris: 0.3, intensity: 0.9, dust: 0.5, hue: 0.3 },
          { cx: 0.05, cy: 0.9, pupil: 0.035, iris: 0.14, intensity: 0.5, dust: 0.6 },
          y
        );
      };
      const portrait = $(".portrait-frame canvas", main);
      if (portrait) contourPortrait(portrait, scope);
      const con = $(".constellation", main);
      if (con) constellation(con, scope);
    },
  };

  /* =================================================================
     CONTACT
     ================================================================= */
  P.contact = {
    init(ctx) {
      const { main, scope } = ctx;
      // the form sits inside the pupil: scrolling dilates it like the home page
      ctx.iris = (y) => {
        const m = IA.env.mobile;
        // dark theme: the pupil sits behind the title; porcelain: beside it, so dark type stays legible
        const L = IA.colors.light;
        return IA.irisScroll(
          { cx: L ? (m ? 0.72 : 0.76) : 0.5, cy: L ? (m ? 0.56 : 0.6) : m ? 0.3 : 0.42, pupil: m ? 0.13 : 0.12, iris: 0.5, intensity: 0.85, dust: 0.45, hue: 0.55 },
          { cx: 0.5, cy: 0.45, pupil: 1.7, iris: 3.4, intensity: 0.7, dust: 0.85 },
          y,
          1.1
        );
      };

      // variable-weight title that swells toward the cursor
      const title = $(".contact-title", main);
      if (title) {
        const text = title.textContent.trim();
        title.setAttribute("aria-label", text);
        title.innerHTML = text
          .split(/\s+/)
          .map((word) => `<span class="cw" aria-hidden="true">${[...word].map((ch) => `<span class="ch">${esc(ch)}</span>`).join("")}</span>`)
          .join(" ");
        const chars = $$(".ch", title);
        let mx = -1e4, my = -1e4, active = 0;
        scope.on(window, "pointermove", (e) => { mx = e.clientX; my = e.clientY; active = 1; }, { passive: true });
        const weights = chars.map(() => 500);
        scope.tick((dt, t) => {
          const rects = chars.map((c) => c.getBoundingClientRect());
          chars.forEach((c, i) => {
            const r = rects[i];
            let target;
            if (active && IA.env.fine) {
              const d = Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height / 2));
              target = 400 + 400 * Math.pow(1 - IA.clamp(d / 420), 2);
            } else {
              target = 500 + 300 * (0.5 + 0.5 * Math.sin(t * 1.6 - i * 0.55));
            }
            if (IA.env.reduced) target = 600;
            weights[i] = IA.damp(weights[i], target, 7, dt);
            c.style.setProperty("--w", weights[i].toFixed(0));
          });
        }, 25);
      }

      const email = $("[data-email]", main);
      $$("[data-copy-email]", main).forEach((b) => scope.on(b, "click", () => IA.copy(IA.site.email, email)));

      // form
      const form = $("form[data-contact]", main);
      if (!form) return;
      const done = $(".form-done", main);
      $$(".choices [aria-pressed]", form).forEach((chip) => {
        scope.on(chip, "click", () => {
          const group = chip.closest(".choices");
          const single = group.dataset.single !== undefined;
          if (single) $$("[aria-pressed]", group).forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
          else chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
        });
      });
      let lastBody = "";
      scope.on(done.querySelector("[data-copy-message]"), "click", () => IA.copy(lastBody, done.querySelector("pre")));
      scope.on(done.querySelector("[data-reset]"), "click", () => {
        form.reset();
        $$("[aria-pressed]", form).forEach((c) => c.setAttribute("aria-pressed", "false"));
        done.hidden = true;
        form.hidden = false;
        IA.scroll.measure();
      });
      const validate = () => {
        let ok = true;
        $$(".field", form).forEach((f) => {
          const input = f.querySelector("input, textarea");
          const err = f.querySelector(".field-error");
          let msg = "";
          if (input.required && !input.value.trim()) msg = `Add your ${input.dataset.name || "details"} so I can reply.`;
          else if (input.type === "email" && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) msg = "That email address is missing an @ or a domain.";
          f.classList.toggle("is-invalid", !!msg);
          input.setAttribute("aria-invalid", msg ? "true" : "false");
          if (err) err.textContent = msg;
          if (msg && ok) { input.focus(); ok = false; }
        });
        return ok;
      };
      scope.on(form, "submit", async (e) => {
        e.preventDefault();
        if (!validate()) return;
        const data = new FormData(form);
        const pick = (g) => $$(`[data-group="${g}"] [aria-pressed="true"]`, form).map((c) => c.textContent.trim());
        const body = [
          `Name: ${data.get("name")}`,
          `Email: ${data.get("email")}`,
          `Company: ${data.get("company") || "—"}`,
          `Project: ${pick("type").join(", ") || "Not specified"}`,
          `Budget: ${pick("budget").join(", ") || "Not specified"}`,
          "",
          String(data.get("message")),
        ].join("\n");
        const endpoint = form.dataset.endpoint;
        const btn = form.querySelector('[type="submit"]');
        if (endpoint) {
          btn.disabled = true;
          try {
            const res = await fetch(endpoint, { method: "POST", headers: { Accept: "application/json" }, body: data });
            if (!res.ok) throw new Error(res.status);
            done.querySelector("h3").textContent = "Message sent.";
            done.querySelector("p").textContent = "Thank you. I reply to every message within two working days.";
          } catch (err) {
            done.querySelector("h3").textContent = "The message didn't send.";
            done.querySelector("p").textContent = "Your connection or the form service failed. Copy the message below and email it directly.";
          }
          btn.disabled = false;
        }
        lastBody = body;
        done.querySelector("pre").textContent = body;
        const mail = done.querySelector("[data-mailto]");
        if (mail) mail.href = `mailto:${IA.site.email}?subject=${encodeURIComponent("Project enquiry from " + data.get("name"))}&body=${encodeURIComponent(body)}`;
        form.hidden = true;
        done.hidden = false;
        IA.scroll.measure();
        done.querySelector("h3").focus();
      });
    },
  };
})();
