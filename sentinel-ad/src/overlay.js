/* DOM overlay: headlines, notification cards pinned to points in 3D, the 24 h
   dial, the motion-tracking box, the live-view phone, credit and end card.
   Letters keep their real kerning (measured before splitting). */
const { clamp, lerp, E } = window.Core;

function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
function parse(str) {
  const out = []; let acc = false, buf = '';
  for (const ch of str) { if (ch === '*') { if (buf) out.push({ text: buf, acc }); buf = ''; acc = !acc; } else buf += ch; }
  if (buf) out.push({ text: buf, acc });
  return out;
}

const ICONS = {
  knock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M12 9.5V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M15 9.5v-3a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.6-2.2L4.5 15a1.6 1.6 0 0 1 2.4-2.1L9 15V11"/><path d="M20.5 3.5l1.5-1.5M21 7h2"/></svg>',
  gate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 20V5M21 20V5"/><path d="M6 7h5v13H6zM13 7h5v13h-5z"/><path d="M6 11h5M6 15h5M13 11h5M13 15h5"/></svg>',
  gateOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 20V5M21 20V5"/><path d="M5 8l4-2v15l-4-1zM19 8l-4-2v15l4-1z"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="6" r="2.6"/><path d="M8 21l1.4-7.5L8 11.5l3-2.5h2l3 2.5-1.4 2L16 21"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.5 9 4.75 4.75 0 0 0 7 18.5z"/><path d="M9.5 13.8l2 2 3.5-3.8"/></svg>',
  live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/></svg>',
};

export class Overlay {
  constructor(root, L, CFG) {
    this.root = root; this.L = L; this.CFG = CFG; this.items = [];
  }

  // kerned, individually animatable letters
  line(parent, str, chars) {
    const line = el('div', 'line', parent);
    const words = []; let cur = [];
    for (const s of parse(str)) for (const ch of s.text) {
      if (ch === ' ') { if (cur.length) words.push(cur); cur = []; words.push(null); }
      else cur.push({ ch, acc: s.acc });
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
      for (let i = 0; i < txt.length; i++) { rg.setStart(tn, i); rg.setEnd(tn, i + 1); lefts.push(rg.getBoundingClientRect().left - wr.left); }
      wd.style.width = wr.width + 'px'; wd.style.height = wr.height + 'px';
      wd.removeChild(tn);
      w.forEach((c, i) => { const s = el('span', 'ch' + (c.acc ? ' acc' : ''), wd); s.textContent = c.ch; s.style.left = lefts[i] + 'px'; chars.push(s); });
    }
    return line;
  }

  fit(block, size, max) {
    block.style.fontSize = size + 'px';
    let w = 0;
    for (const ln of block.querySelectorAll('.line')) w = Math.max(w, ln.scrollWidth);
    if (w > max) block.style.fontSize = (size * max) / w + 'px';
  }

  build() {
    const L = this.L, U = L.U, C = this.CFG;
    this.root.style.setProperty('--u', U + 'px');
    for (const b of C.beats) {
      const it = { b, chars: [], parts: [] };
      const box = el('div', 'beat ' + (b.kind || 'head'), this.root);
      it.el = box;
      const y = b.kind === 'intro' ? L.introY : b.kind === 'brand' ? L.brandY : b.kind === 'end' ? L.endY : b.kind === 'credit' ? L.creditY : L.headY;
      box.style.top = y + 'px';
      if (b.kind === 'credit') {
        const over = el('div', 'over', box, b.over);
        over.style.fontSize = L.subSize * 0.72 + 'px';
        it.parts.push({ node: over, d: 0, amp: 0.8 });
        const blk = el('div', 'block name', box);
        blk.style.fontSize = L.headSize * 0.98 + 'px';
        this.line(blk, b.text, it.chars);
        it.charDelay = 0.18;
        it.rule = el('div', 'rule', box);
        it.rule.style.width = L.headSize * 2.6 + 'px';
      } else {
        const blk = el('div', 'block ' + (b.kind || 'head'), box);
        const size = b.kind === 'intro' ? L.introSize : b.kind === 'brand' || b.kind === 'end' ? L.brandSize : L.headSize;
        for (const ln of b.text.split('|')) el('div', 'line', blk).textContent = ln.replace(/\*/g, '');
        this.fit(blk, size, L.maxText);
        const fs = blk.style.fontSize;
        blk.innerHTML = ''; blk.style.fontSize = fs;
        for (const ln of b.text.split('|')) this.line(blk, ln, it.chars);
        if (b.kind === 'brand' || b.kind === 'end') it.tracked = true;
        if (b.sub) {
          const s = el('div', 'sub', box, b.sub);
          s.style.fontSize = (b.kind === 'end' ? L.subSize * 1.05 : L.subSize) + 'px';
          if (b.kind === 'end') s.classList.add('soon');
          it.parts.push({ node: s, d: b.kind === 'end' ? 0.55 : 0.3, amp: 0.9 });
        }
      }
      this.items.push(it);
    }

    // notification cards
    const card = (icon, t1, t2, cls = '') => {
      const c = el('div', 'card ' + cls, this.root, `<div class="ic">${ICONS[icon]}</div><div class="tx"><div class="t1">${t1}</div><div class="t2">${t2}</div></div>`);
      c.style.fontSize = L.cardSize + 'px';
      return c;
    };
    this.cards = {
      knock: card('knock', C.cards.knock[0], C.cards.knock[1]),
      opened: card('gateOpen', C.cards.opened[0], C.cards.opened[1]),
      closed: card('gate', C.cards.closed[0], C.cards.closed[1]),
      cloud: card('cloud', C.cards.cloud[0], C.cards.cloud[1]),
    };
    // knock waveform inside the knock card
    const wf = el('div', 'wave', this.cards.knock.querySelector('.tx'));
    this.waveBars = Array.from({ length: 28 }, () => el('i', '', wf));

    // motion tracking box
    this.track = el('div', 'track', this.root, '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><div class="tag"><b></b><span></span></div>');
    this.track.style.fontSize = L.cardSize * 0.82 + 'px';
    this.trackTag = this.track.querySelector('.tag b');
    this.trackTime = this.track.querySelector('.tag span');

    // 24 h dial
    const ticks = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2, r0 = i % 12 === 0 ? 38 : i % 2 === 0 ? 41 : 42.5, r1 = 45;
      return `<line x1="${50 + Math.sin(a) * r0}" y1="${50 - Math.cos(a) * r0}" x2="${50 + Math.sin(a) * r1}" y2="${50 - Math.cos(a) * r1}" stroke-width="${i % 12 === 0 ? 1.2 : 0.6}"/>`;
    }).join('');
    this.dial = el('div', 'dial', this.root, `<svg viewBox="0 0 100 100"><g class="tk">${ticks}</g><circle class="trk" cx="50" cy="50" r="45"/><path class="sweep" d=""/><circle class="dot" cx="50" cy="5" r="2.6"/></svg><div class="dtime"><b>00:00</b><span>24 / 7</span></div>`);
    this.dial.style.width = this.dial.style.height = L.dialSize + 'px';
    this.dial.style.fontSize = L.dialSize * 0.095 + 'px';
    this.dialSweep = this.dial.querySelector('.sweep');
    this.dialDot = this.dial.querySelector('.dot');
    this.dialTime = this.dial.querySelector('.dtime b');

    // live view phone
    this.phone = el('div', 'phone', this.root, `<div class="scr"><img alt=""><div class="bar"><span class="livepill"><i></i>LIVE</span><span class="loc">${C.cards.live[0]}</span></div><div class="foot"><span>${C.cards.live[1]}</span><span class="sig"><i></i><i></i><i></i><i></i></span></div></div>`);
    this.phone.style.width = L.phoneW + 'px';
    this.phone.style.fontSize = L.cardSize * 0.78 + 'px';
    this.phoneImg = this.phone.querySelector('img');
  }

  setLiveImage(url) { this.phoneImg.src = url; }

  anim(node, t, tin, tout, U, amp = 1, dur = 1.05) {
    const pIn = clamp((t - tin) / dur);
    const eIn = E.outSoft(pIn);
    const pOut = clamp((t - tout) / 0.55);
    const eOut = E.inCubic(pOut);
    const y = ((1 - eIn) * 0.42 - eOut * 0.32) * amp;
    const blur = ((1 - eIn) * 14 + eOut * 12) * U;
    const op = clamp(pIn * 1.9) * (1 - eOut);
    node.style.transform = `translateY(${y.toFixed(4)}em)`;
    node.style.filter = blur > 0.08 ? `blur(${blur.toFixed(2)}px)` : 'none';
    node.style.opacity = op.toFixed(4);
    return op;
  }

  cardAnim(node, t, tin, tout, pos, U) {
    if (t < tin - 0.05 || t > tout + 0.7 || !pos) { node.style.visibility = 'hidden'; return; }
    node.style.visibility = 'visible';
    const p = clamp((t - tin) / 0.9), e = E.spring(p), q = E.inCubic(clamp((t - tout) / 0.5));
    const s = lerp(0.86, 1, e) * lerp(1, 0.96, q);
    const blur = ((1 - E.outSoft(p)) * 12 + q * 10) * U;
    node.style.left = pos[0] + 'px'; node.style.top = pos[1] + 'px';
    node.style.transform = `translate(${pos[2] || '-50%'}, ${(-50 + (1 - e) * 18 - q * 14).toFixed(2)}%) scale(${s.toFixed(4)})`;
    node.style.opacity = (clamp(p * 2.4) * (1 - q)).toFixed(4);
    node.style.filter = blur > 0.08 ? `blur(${blur.toFixed(2)}px)` : 'none';
  }

  update(t, S, P) {
    const L = this.L, U = L.U;
    // headlines
    for (const it of this.items) {
      const { t0, t1 } = it.b;
      const live = t >= t0 - 0.02 && t <= t1 + 0.9;
      if (!live) { if (it.vis !== false) { it.el.style.visibility = 'hidden'; it.vis = false; } continue; }
      if (it.vis !== true) { it.el.style.visibility = 'visible'; it.vis = true; }
      const n = it.chars.length;
      const st = Math.min(0.036, 0.62 / Math.max(n, 1)), so = Math.min(0.016, 0.26 / Math.max(n, 1));
      const outT = t1 - 0.25, cd = it.charDelay || 0;
      if (it.tracked) {
        const mid = (n - 1) / 2, p = E.outSoft(clamp((t - t0) / 1.6)), extra = lerp(0.42, 0, p);
        it.chars.forEach((c, i) => {
          this.anim(c, t, t0 + Math.abs(i - mid) * 0.05, outT + i * so, U, 0.5, 1.2);
          c.style.transform += ` translateX(${((i - mid) * extra).toFixed(4)}em)`;
        });
      } else {
        it.chars.forEach((c, i) => this.anim(c, t, t0 + cd + i * st, outT + i * so, U));
      }
      for (const p of it.parts) this.anim(p.node, t, t0 + p.d, outT + 0.05, U, p.amp);
      if (it.rule) {
        const pr = E.outSoft(clamp((t - t0 - 0.6) / 1.0)), po = E.inCubic(clamp((t - outT) / 0.45));
        it.rule.style.transform = `translateX(-50%) scaleX(${(pr * (1 - po)).toFixed(4)})`;
        it.rule.style.opacity = (pr * (1 - po)).toFixed(4);
      }
    }

    const C = this.CFG.timing;
    // knock card + live waveform
    this.cardAnim(this.cards.knock, t, C.knockCard[0], C.knockCard[1], P.knockCard, U);
    if (t > C.knockCard[0] - 0.1 && t < C.knockCard[1] + 0.8) {
      this.waveBars.forEach((b, i) => {
        const x = i / 27;
        let v = 0.12 + 0.05 * Math.sin(i * 1.7 + t * 9);
        S.knocks.forEach((age, k) => { const c = 0.3 + k * 0.17; if (age > 0) v += Math.exp(-Math.pow((x - c) / 0.035, 2)) * 0.95 * clamp(age * 6); });
        b.style.transform = `scaleY(${Math.min(1, v).toFixed(3)})`;
      });
    }
    this.cardAnim(this.cards.opened, t, C.openedCard[0], C.openedCard[1], P.gateCard, U);
    this.cardAnim(this.cards.closed, t, C.closedCard[0], C.closedCard[1], P.gateCard, U);
    this.cardAnim(this.cards.cloud, t, C.cloudCard[0], C.cloudCard[1], P.cloudCard, U);

    // tracking box around the passer-by
    if (S.detect > 0.001 && P.walker) {
      const [x0, y0, x1, y1] = P.walker;
      const k = lerp(1.35, 1, E.outBack(clamp(S.detect)));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = (x1 - x0) * k, h = (y1 - y0) * k;
      Object.assign(this.track.style, { visibility: 'visible', left: cx - w / 2 + 'px', top: cy - h / 2 + 'px', width: w + 'px', height: h + 'px', opacity: clamp(S.detect * 1.5).toFixed(3) });
      this.trackTag.textContent = this.CFG.cards.person;
      const hh = Math.floor(S.detectTod), mm = Math.floor((S.detectTod - hh) * 60);
      this.trackTime.textContent = `${String(((hh + 11) % 12) + 1)}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
    } else this.track.style.visibility = 'hidden';

    // 24 h dial
    const dA = clamp((t - C.dial[0]) / 0.7) * (1 - clamp((t - C.dial[1]) / 0.6));
    if (dA > 0.001) {
      const f = ((S.tod - this.CFG.nightHour + 24) % 24) / 24;
      const a = f * Math.PI * 2;
      const big = a > Math.PI ? 1 : 0;
      const x = 50 + Math.sin(a) * 45, y = 50 - Math.cos(a) * 45;
      this.dialSweep.setAttribute('d', f > 0.001 ? `M50 5 A45 45 0 ${big} 1 ${x.toFixed(2)} ${y.toFixed(2)}` : '');
      this.dialDot.setAttribute('cx', x.toFixed(2)); this.dialDot.setAttribute('cy', y.toFixed(2));
      const hh = Math.floor(S.tod), mm = Math.floor((S.tod - hh) * 60);
      this.dialTime.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const p = E.outSoft(clamp((t - C.dial[0]) / 0.9));
      Object.assign(this.dial.style, { visibility: 'visible', left: P.dial[0] + 'px', top: P.dial[1] + 'px', opacity: dA.toFixed(3), transform: `translate(-50%,-50%) scale(${lerp(0.9, 1, p).toFixed(4)})`, filter: dA < 0.99 ? `blur(${((1 - dA) * 10 * U).toFixed(2)}px)` : 'none' });
    } else this.dial.style.visibility = 'hidden';

    // live-view phone
    this.cardAnim(this.phone, t, C.phone[0], C.phone[1], P.phone, U);
  }
}
