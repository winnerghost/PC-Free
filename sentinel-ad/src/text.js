/* Headline layer (DOM). Every headline is split into letters that keep their
   real kerning (positions are measured from the unsplit word), so each letter
   can rise, focus and fade on its own while the word still looks set by hand.
   Text always enters from below and leaves upwards: one continuous current. */
(function () {
  const { clamp, lerp, E, rgba } = Core;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function parse(str) {
    const out = [];
    let acc = false, buf = '';
    for (const ch of str) {
      if (ch === '*') { if (buf) out.push({ text: buf, acc }); buf = ''; acc = !acc; }
      else buf += ch;
    }
    if (buf) out.push({ text: buf, acc });
    return out;
  }

  class TextLayer {
    constructor(root, L, CFG) {
      this.root = root; this.L = L; this.CFG = CFG; this.items = [];
    }

    // A line of kerned, individually animatable letters.
    line(parent, str, chars) {
      const line = el('div', 'line', parent);
      const words = [];
      let cur = [];
      for (const s of parse(str)) {
        for (const ch of s.text) {
          if (ch === ' ') { if (cur.length) words.push(cur); cur = []; words.push(null); }
          else cur.push({ ch, acc: s.acc });
        }
      }
      if (cur.length) words.push(cur);
      for (const w of words) {
        if (w === null) { line.appendChild(document.createTextNode(' ')); continue; }
        const wd = el('span', 'word', line);
        const txt = w.map((c) => c.ch).join('');
        const tn = document.createTextNode(txt);
        wd.appendChild(tn);
        const wr = wd.getBoundingClientRect();
        const rg = document.createRange();
        const lefts = [];
        for (let i = 0; i < txt.length; i++) {
          rg.setStart(tn, i); rg.setEnd(tn, i + 1);
          lefts.push(rg.getBoundingClientRect().left - wr.left);
        }
        wd.style.width = wr.width + 'px';
        wd.style.height = wr.height + 'px';
        wd.removeChild(tn);
        w.forEach((c, i) => {
          const s = el('span', 'ch' + (c.acc ? ' acc' : ''), wd);
          s.textContent = c.ch;
          s.style.left = lefts[i] + 'px';
          chars.push(s);
        });
      }
      return line;
    }

    // shrink a block's font size until its widest line fits
    fit(block, size, max) {
      block.style.fontSize = size + 'px';
      let wmax = 0;
      for (const ln of block.querySelectorAll('.line')) wmax = Math.max(wmax, ln.scrollWidth);
      if (wmax > max) block.style.fontSize = (size * max) / wmax + 'px';
    }

    build() {
      const L = this.L, U = L.U;
      this.root.style.setProperty('--u', U + 'px');
      for (const beat of this.CFG.beats) {
        const item = { beat, chars: [], parts: [] };
        const box = el('div', 'beat ' + (beat.kind || 'head'), this.root);
        item.el = box;
        if (!beat.kind) {
          box.style.top = L.headY + 'px';
          const block = el('div', 'block', box);
          // measure-fit with plain text first, then split
          for (const ln of beat.text.split('|')) el('div', 'line', block).textContent = ln.replace(/\*/g, '');
          this.fit(block, L.headSize, L.maxText);
          const fs = block.style.fontSize;
          block.innerHTML = '';
          block.style.fontSize = fs;
          for (const ln of beat.text.split('|')) this.line(block, ln, item.chars);
          if (beat.sub) {
            const s = el('div', 'sub', box);
            s.style.fontSize = L.subSize + 'px';
            s.textContent = beat.sub;
            item.parts.push({ node: s, delay: 0.28, amp: 0.9 });
          }
        } else if (beat.kind === 'credit') {
          box.style.top = L.creditY + 'px';
          const over = el('div', 'over', box);
          over.style.fontSize = L.subSize * 0.74 + 'px';
          over.textContent = beat.over;
          item.parts.push({ node: over, delay: 0, amp: 0.9 });
          const block = el('div', 'block name', box);
          block.style.fontSize = L.headSize * 1.04 + 'px';
          this.line(block, beat.text, item.chars);
          item.charDelay = 0.16;
          const rule = el('div', 'rule', box);
          rule.style.width = L.headSize * 2.4 + 'px';
          item.rule = rule;
        } else if (beat.kind === 'endcard') {
          box.style.top = L.endY + 'px';
          const block = el('div', 'block wordmark', box);
          block.style.fontSize = L.headSize * 0.7 + 'px';
          this.line(block, beat.text, item.chars);
          item.wordmark = true;
          const tag = el('div', 'block tagline', box);
          tag.style.fontSize = L.headSize * 0.62 + 'px';
          item.tagChars = [];
          this.line(tag, beat.sub, item.tagChars);
          const cta = el('div', 'cta', box);
          cta.style.fontSize = L.subSize * 1.18 + 'px';
          cta.innerHTML = `<span class="cta-label">${beat.cta}</span><span class="cta-sep"></span><span class="cta-price">${beat.ctaPrice}</span><span class="cta-arrow">→</span><i class="cta-glint"></i>`;
          item.cta = cta;
          item.glint = cta.querySelector('.cta-glint');
        }
        this.items.push(item);
      }
    }

    // letter animation: rise + focus in from below, then rise + defocus out
    animChar(node, t, tin, tout, U, amp = 1) {
      const pIn = clamp((t - tin) / 0.95);
      const eIn = E.outSoft(pIn);
      const pOut = clamp((t - tout) / 0.5);
      const eOut = E.inCubic(pOut);
      const y = ((1 - eIn) * 0.62 - eOut * 0.45) * amp;
      const blur = ((1 - eIn) * 16 + eOut * 14) * U;
      const op = clamp(pIn * 2.1) * (1 - eOut);
      node.style.transform = `translateY(${y.toFixed(4)}em)`;
      node.style.filter = blur > 0.08 ? `blur(${blur.toFixed(2)}px)` : 'none';
      node.style.opacity = op.toFixed(4);
    }

    update(t, S) {
      const U = this.L.U;
      this.root.style.setProperty('--acc', rgba(S.col, 1));
      this.root.style.setProperty('--acc-glow', rgba(S.col, 0.5));
      this.root.style.setProperty('--acc-hot', rgba(S.hot, 1));
      for (const it of this.items) {
        const { t0, t1 } = it.beat;
        const live = t >= t0 - 0.02 && t <= t1 + 0.85;
        if (!live) {
          if (it.vis !== false) { it.el.style.visibility = 'hidden'; it.vis = false; }
          continue;
        }
        if (it.vis !== true) { it.el.style.visibility = 'visible'; it.vis = true; }
        const n = it.chars.length;
        const st = Math.min(0.034, 0.6 / Math.max(n, 1));
        const so = Math.min(0.016, 0.28 / Math.max(n, 1));
        const outStart = t1 - 0.2;
        const cd = it.charDelay || 0;

        if (it.wordmark) {
          // tracking collapses from wide to set, letters focus in from the centre outwards
          const mid = (n - 1) / 2;
          const p = E.outSoft(clamp((t - t0) / 1.4));
          const extra = lerp(0.5, 0, p);
          it.chars.forEach((c, i) => {
            const d = Math.abs(i - mid) * 0.045;
            this.animChar(c, t, t0 + d, outStart + i * so, U, 0.5);
            c.style.transform += ` translateX(${((i - mid) * extra).toFixed(4)}em)`;
          });
          const tn = it.tagChars.length;
          it.tagChars.forEach((c, i) => this.animChar(c, t, t0 + 0.42 + i * 0.03, outStart + 0.05 + i * so, U));
          // CTA pill
          const pc = clamp((t - t0 - 0.78) / 0.9);
          const ec = E.spring(pc);
          const pco = E.inCubic(clamp((t - outStart - 0.1) / 0.5));
          const cs = lerp(0.82, 1, ec);
          it.cta.style.transform = `translate(-50%, ${((1 - ec) * 0.6 - pco * 0.6).toFixed(4)}em) scale(${cs.toFixed(4)})`;
          it.cta.style.opacity = (clamp(pc * 2.2) * (1 - pco)).toFixed(4);
          const cb = ((1 - E.outSoft(pc)) * 12 + pco * 12) * U;
          it.cta.style.filter = cb > 0.08 ? `blur(${cb.toFixed(2)}px)` : 'none';
          const gp = clamp((t - t0 - 1.5) / 0.85);
          it.glint.style.transform = `translateX(${lerp(-120, 420, E.inOut(gp)).toFixed(2)}%) skewX(-20deg)`;
          it.glint.style.opacity = gp > 0 && gp < 1 ? '1' : '0';
          continue;
        }

        it.chars.forEach((c, i) => this.animChar(c, t, t0 + cd + i * st, outStart + i * so, U));
        for (const p of it.parts) {
          this.animChar(p.node, t, t0 + p.delay, outStart + 0.04, U, p.amp);
        }
        if (it.rule) {
          const pr = E.outSoft(clamp((t - t0 - 0.55) / 0.9));
          const po = E.inCubic(clamp((t - outStart) / 0.45));
          it.rule.style.transform = `translateX(-50%) scaleX(${(pr * (1 - po)).toFixed(4)})`;
          it.rule.style.opacity = (pr * (1 - po)).toFixed(4);
        }
      }
    }
  }

  window.TextLayer = TextLayer;
})();
