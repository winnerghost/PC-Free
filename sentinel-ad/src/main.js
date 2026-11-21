/* Boot: load fonts, build the scene, expose window.__render(t, frame) for the
   frame-by-frame renderer, and play a live, looping preview in a browser. */
(async function () {
  const CFG = window.SENTINEL_CONFIG;
  const qs = new URLSearchParams(location.search);
  const W = parseInt(qs.get('w') || '1080', 10);
  const H = parseInt(qs.get('h') || '1920', 10);
  const RENDER = qs.has('render');
  const L = Timeline.layout(W, H);

  const stage = document.getElementById('stage');
  stage.style.width = W + 'px';
  stage.style.height = H + 'px';
  const canvas = document.getElementById('c');
  canvas.width = W;
  canvas.height = H;

  const faces = [
    '300 64px "Sentinel Display"', '400 64px "Sentinel Display"', '500 64px "Sentinel Display"', '600 64px "Sentinel Display"',
    '700 64px "Sentinel Display"', 'italic 500 64px "Sentinel Display"', '400 64px "Sentinel Text"', '500 64px "Sentinel Text"',
    '600 64px "Sentinel Text"', '400 64px "Sentinel Mono"', '500 64px "Sentinel Mono"', '600 64px "Sentinel Mono"',
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'AaRs5,999:→·•')));
  await document.fonts.ready;

  const scene = new Scene(canvas, L, CFG);
  const text = new TextLayer(document.getElementById('text'), L, CFG);
  text.build();

  function render(t, frame = 0) {
    const S = Timeline.state(t, L, CFG);
    scene.draw(S.t, frame, S);
    text.update(S.t, S);
    return true;
  }
  window.__render = render;
  window.__info = { W, H, duration: CFG.duration };
  render(0, 0);
  window.__ready = true;
  if (RENDER) return;

  // ── live preview ──────────────────────────────────────────────────────
  document.body.classList.add('preview');
  const bar = document.getElementById('bar');
  const fill = document.querySelector('#scrub i');
  const clock = document.getElementById('time');
  const fit = () => {
    const s = Math.min((innerWidth * 0.96) / W, (innerHeight - 70) / H);
    stage.style.transform = `scale(${s})`;
    stage.style.marginRight = `${W * s - W}px`;
    stage.style.marginBottom = `${H * s - H}px`;
  };
  fit();
  addEventListener('resize', fit);
  let playing = true, offset = 0, last = performance.now() / 1000, t = 0;
  const T = CFG.duration;
  const toggle = () => { playing = !playing; document.getElementById('play').textContent = playing ? 'PAUSE' : 'PLAY'; };
  document.getElementById('play').onclick = toggle;
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') t = (t + 1) % T;
    if (e.code === 'ArrowLeft') t = (t - 1 + T) % T;
  });
  document.getElementById('scrub').onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    t = ((e.clientX - r.left) / r.width) * T;
  };
  function loop() {
    const now = performance.now() / 1000;
    if (playing) t = (t + (now - last)) % T;
    last = now;
    render(t, Math.floor(t * 60));
    fill.style.width = (t / T) * 100 + '%';
    clock.textContent = t.toFixed(2).padStart(5, '0') + 's';
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
