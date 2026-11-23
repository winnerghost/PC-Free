/* ARHAM — pages.js
   One module per page. render() fills a page from data.js before its first
   frame; init() wires interaction once the page is live. Everything made in
   init() is undone when the router swaps the page. */
(function () {
  "use strict";
  const IA = (window.IA = window.IA || {});
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const P = (IA.pages = {});
  const ARROW = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" stroke-width="1.5"/></svg>';
  const OUT = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M5.5 4H12v6.5" stroke="currentColor" stroke-width="1.5"/></svg>';
  const href = (v) => `venture.html#${v.slug}`;
  const meta = (v) => [v.kind, v.role].filter(Boolean).join(" · ");

  /* letters swell toward the cursor (variable width axis) */
  function stretch(el, cleanup, delay = 2) {
    if (!IA.fine || IA.reduced || !el) return;
    const chars = el._u || IA.split(el, "chars");
    let on = false;
    const t = setTimeout(() => (on = true), delay * 1000);
    let raf = 0, ex = 0, ey = 0;
    const update = () => {
      raf = 0;
      chars.forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = Math.hypot(ex - (r.left + r.width / 2), (ey - (r.top + r.height / 2)) * 1.4);
        gsap.to(c, { "--w": 125 - 40 * Math.min(1, d / 520), duration: 0.9, ease: "power3.out", overwrite: "auto" });
      });
    };
    const move = (e) => { if (!on) return; ex = e.clientX; ey = e.clientY; if (!raf) raf = requestAnimationFrame(update); };
    const leave = () => { if (on) gsap.to(chars, { "--w": 100, duration: 1.2, ease: "power3.out" }); };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    cleanup(() => {
      clearTimeout(t);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
    });
  }

  /* =================================================================
     HOME
     ================================================================= */
  P.home = {
    render({ main }) {
      const stage = $("[data-vx-items]", main);
      if (stage) {
        stage.innerHTML = IA.projects
          .map(
            (v, i) => `<article class="vx-item" data-i="${i}" ${i ? 'aria-hidden="true"' : ""}>
  <p class="mono vx-kind">${esc(meta(v))}</p>
  <h3 class="vx-title elastic" style="--len:${v.title.length}">${esc(v.title)}</h3>
  <p class="vx-tag">${esc(v.tagline)}</p>
  <a class="pill" href="${href(v)}" data-label="${esc(v.title)}" data-magnetic="0.25"><span>Explore ${esc(v.title)}</span>${ARROW}</a>
</article>`
          )
          .join("");
      }
      const bar = $("[data-vx-bar]", main);
      if (bar) bar.innerHTML = IA.projects.map(() => "<i><b></b></i>").join("");
    },
    init({ main, cleanup }) {
      stretch($(".hero-word.is-a", main), cleanup, 2.2);
      stretch($(".hero-word.is-b", main), cleanup, 2.4);

      // From liquid to solid: the object hardens as the sentence completes
      const st = $(".statement", main);
      if (st) {
        const text = $(".statement-text", st);
        const words = IA.split(text, "words");
        const stateEl = $("[data-state]", st), solidEl = $("[data-solid]", st);
        let lastState = "";
        const setState = (s) => { if (s !== lastState) { lastState = s; stateEl._final = s; stateEl.textContent = s; IA.scramble(stateEl); } };
        const update = (p) => {
          const n = Math.round(Math.min(1, p * 1.15) * words.length);
          words.forEach((w, i) => w.parentNode.classList.toggle("is-lit", i < n));
          const s = gsap.utils.clamp(0, 1, (p - 0.08) / 0.78);
          const e = s * s * (3 - 2 * s);
          IA.scene.blend("liquid", "solid", e);
          solidEl.textContent = String(Math.round(e * 100)).padStart(3, "0") + "%";
          setState(e < 0.12 ? "Liquid" : e < 0.88 ? "Forming" : "Solid");
        };
        if (IA.reduced) { words.forEach((w) => w.parentNode.classList.add("is-lit")); setState("Solid"); }
        else ScrollTrigger.create({ trigger: st, start: "top top", end: "bottom bottom", onUpdate: (self) => update(self.progress) });
      }

      // Ventures: one stage, four forms
      const vx = $(".vx", main);
      if (vx) {
        const items = $$(".vx-item", vx);
        const bars = $$("[data-vx-bar] b", vx);
        const idxEl = $("[data-vx-i]", vx);
        items.forEach((it) => IA.split($(".vx-title", it), "chars"));
        let cur = -1;
        const show = (i, instant) => {
          if (i === cur) return;
          const prev = items[cur];
          const next = items[i];
          const dir = i > cur ? 1 : -1;
          cur = i;
          const v = IA.projects[i];
          idxEl.textContent = String(i + 1).padStart(2, "0");
          if (IA.objState) IA.objState.accent = v.accent;
          IA.scene.shape(v.shape, 1.3);
          IA.scene.to({ accent: v.accent }, 1.3);
          if (prev) {
            prev.setAttribute("aria-hidden", "true");
            gsap.to($(".vx-title", prev)._u, { yPercent: -118 * dir, duration: 0.6, ease: "expo.in", stagger: 0.015, overwrite: true });
            gsap.to($$(".vx-kind, .vx-tag, .pill", prev), { autoAlpha: 0, y: -16 * dir, duration: 0.4, ease: "power2.in", overwrite: true });
          }
          next.removeAttribute("aria-hidden");
          gsap.fromTo($(".vx-title", next)._u, { yPercent: 118 * dir, "--w": 62 }, { yPercent: 0, "--w": 100, duration: instant ? 0 : 1.1, ease: "expo.out", stagger: 0.03, delay: instant ? 0 : 0.35, overwrite: true });
          gsap.fromTo($$(".vx-kind, .vx-tag, .pill", next), { autoAlpha: 0, y: 20 * dir }, { autoAlpha: 1, y: 0, duration: instant ? 0 : 0.9, ease: "expo.out", stagger: 0.06, delay: instant ? 0 : 0.5, overwrite: true });
        };
        items.forEach((it, i) => { if (i) gsap.set($$(".vx-kind, .vx-tag, .pill", it), { autoAlpha: 0 }); if (i) gsap.set($(".vx-title", it)._u, { yPercent: 118 }); });
        cur = 0;
        ScrollTrigger.create({
          trigger: vx, start: "top top", end: "bottom bottom",
          onUpdate: (self) => {
            const p = self.progress * items.length;
            bars.forEach((b, i) => gsap.set(b, { scaleX: gsap.utils.clamp(0, 1, p - i) }));
            show(Math.min(items.length - 1, Math.floor(p)));
          },
          onToggle: (self) => {
            if (!self.isActive) return;
            const v = IA.projects[Math.max(0, cur)];
            IA.scene.shape(v.shape, 1.3);
            IA.scene.to({ accent: v.accent }, 1.3);
          },
        });
      }
    },
  };

  /* =================================================================
     VENTURES: hover a name and the object becomes that venture
     ================================================================= */
  P.ventures = {
    render({ main }) {
      const list = $("[data-vlist]", main);
      if (!list) return;
      list.innerHTML = IA.projects
        .map(
          (v) => `<li><a class="vrow" href="${href(v)}" data-slug="${v.slug}" data-label="${esc(v.title)}" data-cursor="Open">
  <span class="mono vrow-meta">${esc(meta(v))}</span>
  <span class="vrow-title" data-anim="chars" style="--len:${v.title.length}">${esc(v.title)}</span>
  <span class="vrow-tag">${esc(v.tagline)}</span>
  <span class="vrow-tags mono">${v.tags.map(esc).join(" · ")}</span>
  <span class="vrow-arrow" aria-hidden="true">${ARROW}</span>
</a></li>`
        )
        .join("");
    },
    init({ main, cleanup }) {
      stretch($(".page-title", main), cleanup, 1.8);
      const list = $("[data-vlist]", main);
      if (!list) return;
      const sec = list.closest("[data-obj]");
      $$(".vrow", list).forEach((row) => {
        const v = IA.project(row.dataset.slug);
        const enter = () => {
          IA.lockObj = true;
          list.classList.add("is-hovering");
          row.classList.add("is-hot");
          IA.scene.shape(v.shape, 1.1);
          IA.scene.to({ accent: v.accent }, 1.1);
        };
        const leave = () => { row.classList.remove("is-hot"); };
        row.addEventListener("pointerenter", enter);
        row.addEventListener("focus", enter);
        row.addEventListener("pointerleave", leave);
        row.addEventListener("blur", leave);
      });
      const out = () => {
        list.classList.remove("is-hovering");
        IA.lockObj = false;
        if (sec) IA.applySection(sec, 1.1);
      };
      list.addEventListener("pointerleave", out);
      cleanup(() => { IA.lockObj = false; });
    },
  };

  /* =================================================================
     VENTURE: one page per venture, filled from data.js
     Every block hides itself when its data is empty.
     ================================================================= */
  P.venture = {
    pick() {
      const slug = decodeURIComponent((IA.routeHash != null ? IA.routeHash : location.hash).replace(/^#/, ""));
      const i = Math.max(0, IA.projects.findIndex((p) => p.slug === slug));
      return { v: IA.projects[i], next: IA.projects[(i + 1) % IA.projects.length], i };
    },
    render({ main }) {
      const { v, next, i } = this.pick();
      const set = (key, value, isHTML) => $$(`[data-v="${key}"]`, main).forEach((el) => {
        if (isHTML) el.innerHTML = value; else el.textContent = value;
        (el.closest("[data-v-wrap]") || el).hidden = !value;
      });
      const hero = $(".v-hero", main);
      hero.dataset.obj = `${v.shape} 0.5 0.02 0.5 1 ${v.accent}`;
      hero.dataset.objM = `${v.shape} 0.35 0.5 0.36 1 ${v.accent}`;
      $$("[data-obj-accent]", main).forEach((s) => {
        ["obj", "objM"].forEach((k) => {
          if (!s.dataset[k]) return;
          const parts = s.dataset[k].split(/\s+/);
          parts[5] = v.accent;
          s.dataset[k] = parts.join(" ");
        });
      });
      main.style.setProperty("--accent", v.accent);
      set("index", `${String(i + 1).padStart(2, "0")} / ${String(IA.projects.length).padStart(2, "0")}`);
      set("title", v.title);
      $$('[data-v="title"]', main).forEach((el) => el.style.setProperty("--len", v.title.length));
      $$('[data-v="next-title"]', main).forEach((el) => el.style.setProperty("--len", next.title.length));
      set("meta", meta(v));
      set("tagline", v.tagline);
      set("kind", v.kind);
      set("tags", v.tags.join(" · "));
      set("role", v.role);
      set("status", v.status);
      set("stack", (v.stack || []).join(", "));
      set("online", v.link ? v.link.label : "");
      set("summary", v.summary);
      set("idea", v.idea);
      set("includes-title", v.includes && v.includes.length ? v.includesTitle || "What it includes" : "");
      set("includes", (v.includes || []).map((it) => `<li data-anim="fade"><span class="dot" aria-hidden="true"></span>${esc(it)}</li>`).join(""), true);
      set("story", (v.story || []).map((s) => `<li data-anim="fade"><span class="mono">${esc(s[0])}</span><p>${esc(s[1])}</p></li>`).join(""), true);
      const link = $("[data-v-link]", main);
      if (link) {
        const wrap = link.closest("[data-v-wrap]");
        if (v.link) { link.href = v.link.href; $("span", link).textContent = `Visit ${v.link.label}`; wrap.hidden = false; }
        else wrap.hidden = true;
      }
      const nx = $("[data-v-next]", main);
      if (nx) {
        nx.href = href(next);
        nx.dataset.label = next.title;
        nx.dataset.preview = `${next.shape} ${next.accent}`;
        set("next-title", next.title);
        set("next-meta", meta(next));
      }
      document.title = `${v.title} · ${IA.site.name}`;
    },
    init({ main, cleanup }) {
      stretch($(".v-title", main), cleanup, 1.8);
      const { v, next } = this.pick();
      const nx = $("[data-v-next]", main);
      if (nx && IA.fine) {
        const sec = nx.closest("[data-obj]");
        nx.addEventListener("pointerenter", () => { IA.lockObj = true; IA.scene.shape(next.shape, 1.1); IA.scene.to({ accent: next.accent }, 1.1); });
        nx.addEventListener("pointerleave", () => { IA.lockObj = false; IA.scene.shape(v.shape, 1.1); IA.scene.to({ accent: v.accent }, 1.1); if (sec) IA.applySection(sec, 1.1); });
        cleanup(() => { IA.lockObj = false; });
      }
    },
  };

  /* =================================================================
     ABOUT
     ================================================================= */
  P.about = {
    init({ main, cleanup }) {
      // the object sits where the three worlds overlap
      const venn = $(".venn", main);
      if (venn) {
        const core = $(".venn-core", venn);
        let active = false;
        ScrollTrigger.create({
          trigger: venn, start: "top 70%", end: "bottom 30%",
          onToggle: (self) => {
            active = self.isActive;
            if (active) { IA.lockObj = true; IA.scene.to({ shape: "gem", scale: IA.mobile() ? 0.13 : 0.11, dark: 1, alpha: 1, shadow: 0, accent: "#2b3dff" }, 1.2); }
            else { IA.lockObj = false; }
          },
        });
        const track = () => {
          if (!active || IA.menuOpen) return;
          const r = core.getBoundingClientRect();
          const x = ((r.left + r.width / 2) / window.innerWidth) * 2 - 1;
          const y = -(((r.top + r.height / 2) / window.innerHeight) * 2 - 1);
          IA.scene.s.x += (x - IA.scene.s.x) * 0.2;
          IA.scene.s.y += (y - IA.scene.s.y) * 0.2;
        };
        gsap.ticker.add(track);
        cleanup(() => { gsap.ticker.remove(track); IA.lockObj = false; });
        // hovering a world lights its list
        $$("[data-world]", venn).forEach((w) => {
          const key = w.dataset.world;
          const on = () => venn.dataset.active = key;
          w.addEventListener("pointerenter", on);
          w.addEventListener("focus", on);
        });
        venn.addEventListener("pointerleave", () => delete venn.dataset.active);
        if (!IA.reduced) {
          $$(".venn-ring", venn).forEach((c, i) => {
            gsap.to(c, { x: Math.cos(i * 2.1) * 14, y: Math.sin(i * 2.1) * 14, duration: 4 + i, ease: "sine.inOut", yoyo: true, repeat: -1 });
          });
        }
      }

      // Then / Now / Next stretch open as they pass
      $$(".tnn-word", main).forEach((w) => {
        const u = IA.split(w, "chars");
        if (IA.reduced) return;
        gsap.fromTo(u, { "--w": 62 }, { "--w": 125, ease: "none", scrollTrigger: { trigger: w, start: "top 90%", end: "top 30%", scrub: true } });
      });
    },
  };

  /* =================================================================
     CONTACT
     ================================================================= */
  P.contact = {
    init({ main, cleanup }) {
      stretch($(".contact-title", main), cleanup, 1.8);
      const form = $("form[data-contact]", main);
      if (!form) return;
      const endpoint = IA.site.formEndpoint || form.dataset.endpoint || "";
      const wrap = $(".form-wrap", main);
      if (!IA.site.email && !endpoint) { if (wrap) wrap.hidden = true; return; }
      const done = $(".form-done", main);
      $$(".choices [aria-pressed]", form).forEach((c) => c.addEventListener("click", () => c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true"))));
      let body = "";
      $("[data-copy-message]", done).addEventListener("click", () => IA.copy(body, $("pre", done)));
      $("[data-reset]", done).addEventListener("click", () => {
        form.reset();
        $$("[aria-pressed]", form).forEach((c) => c.setAttribute("aria-pressed", "false"));
        done.hidden = true;
        form.hidden = false;
        ScrollTrigger.refresh();
      });
      const validate = () => {
        let ok = true;
        $$(".field", form).forEach((f) => {
          const input = $("input, textarea", f);
          const err = $(".field-error", f);
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
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!validate()) return;
        const data = new FormData(form);
        const topics = $$('[data-group="type"] [aria-pressed="true"]', form).map((c) => c.textContent.trim());
        body = [
          `Name: ${data.get("name")}`,
          `Email: ${data.get("email")}`,
          `Business or organisation: ${data.get("company") || "-"}`,
          `About: ${topics.join(", ") || "Not specified"}`,
          "",
          String(data.get("message")),
        ].join("\n");
        const h = $("h3", done), p = $("p", done);
        if (endpoint) {
          const btn = $('[type="submit"]', form);
          btn.disabled = true;
          try {
            const res = await fetch(endpoint, { method: "POST", headers: { Accept: "application/json" }, body: data });
            if (!res.ok) throw new Error(res.status);
            h.textContent = "Message sent.";
            p.textContent = "Thank you for reaching out.";
          } catch (err) {
            h.textContent = "The message didn't send.";
            p.textContent = "The connection or the form service failed. Copy the message below and send it by email instead.";
          }
          btn.disabled = false;
        } else {
          h.textContent = "Your message is ready.";
          p.textContent = `This site has no mail server, so the message goes out from your own email. Open it in your email app, or copy it and send it to ${IA.site.email}.`;
        }
        $("pre", done).textContent = body;
        const mail = $("[data-mailto]", done);
        mail.hidden = !IA.site.email;
        mail.href = `mailto:${IA.site.email}?subject=${encodeURIComponent("Hello from " + data.get("name"))}&body=${encodeURIComponent(body)}`;
        form.hidden = true;
        done.hidden = false;
        ScrollTrigger.refresh();
        h.focus();
      });
    },
  };
})();
