/* Engine: builds both worlds, renders each video frame as N jittered,
   time-offset sub-frames accumulated in HDR (anti-aliasing + true motion
   blur), then bloom, filmic tone mapping, lens grade, grain and dither.
   Exposes window.__render(t, frame) for the frame-by-frame renderer. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { state, T } from './timeline.js';
import { homeCamera, earthCamera, earthKeys, applyCamera, DEV, LENS } from './camera.js';
import { buildHome } from './world.js';
import { buildEarth } from './earth.js';
import { Overlay } from './overlay.js';

const CFG = window.SENTINEL_CONFIG;
const qs = new URLSearchParams(location.search);
const W = +(qs.get('w') || 1080), H = +(qs.get('h') || 1920);
const RENDER = qs.has('render');
const MB = +(qs.get('mb') || (RENDER ? 4 : 1));
const SHUTTER = +(qs.get('shutter') || 0.5);
const FPS = 60;

const portrait = H >= W;
const U = Math.min(W, H) / 1080;
const L = portrait
  ? { portrait, U, W, H, portraitFov: 1.62, headY: H * 0.795, introY: H * 0.77, brandY: H * 0.775, endY: H * 0.765, creditY: H * 0.79,
      headSize: 84 * U, subSize: 32 * U, introSize: 110 * U, brandSize: 92 * U, cardSize: 30 * U, dialSize: 300 * U, phoneW: 300 * U, maxText: W * 0.88 }
  : { portrait, U, W, H, portraitFov: 1, headY: H * 0.835, introY: H * 0.8, brandY: H * 0.8, endY: H * 0.78, creditY: H * 0.82,
      headSize: 72 * U, subSize: 28 * U, introSize: 96 * U, brandSize: 84 * U, cardSize: 26 * U, dialSize: 250 * U, phoneW: 250 * U, maxText: W * 0.8 };

const stage = document.getElementById('stage');
stage.style.width = W + 'px'; stage.style.height = H + 'px';
const ui = document.getElementById('ui');

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
stage.insertBefore(renderer.domElement, ui);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

// ── studio reflections: strip lights and a softbox, like a product shoot ──
const pmrem = new THREE.PMREMGenerator(renderer);
const env = (() => {
  const s = new THREE.Scene();
  const box = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); s.add(m); };
  box(0.45, 7, 0.45, -3.2, 0.6, 1.8, new THREE.Color(7.5, 7.6, 8.0));
  box(0.3, 6, 0.3, 3.1, 0.3, 1.2, new THREE.Color(4.2, 4.4, 4.8));
  box(4.0, 0.12, 2.2, 0, 4.4, 0.6, new THREE.Color(2.4, 2.4, 2.5));
  box(1.4, 1.4, 0.1, 2.0, 1.4, -3.6, new THREE.Color(1.8, 1.25, 0.8));
  box(14, 0.1, 14, 0, -3.2, 0, new THREE.Color(0.025, 0.025, 0.03));
  // big soft panels in front: the glass face reflects them as a smooth gradient sheen
  for (let i = 0; i < 14; i++) { const y = 3.6 - i * 0.29, k = 1.5 * Math.pow(0.78, i) + 0.02; box(5.0, 0.3, 0.1, 0.5, y, 4.3, new THREE.Color(k, k * 1.01, k * 1.06)); }
  return pmrem.fromScene(s, 0.02).texture;
})();

await Promise.all(['300', '400', '500', '600'].flatMap((w) => [`${w} 64px "Sentinel Display"`, `${w} 64px "Sentinel Text"`]).concat(['500 64px "Sentinel Mono"']).map((f) => document.fonts.load(f, 'Sentinel 0123456789:·')));
await document.fonts.ready;

const home = buildHome(renderer, CFG);
home.scene.environment = env;
home.setLandscape(!portrait);
const earth = buildEarth(renderer, CFG);
earth.scene.environment = env;
const camH = new THREE.PerspectiveCamera(30, W / H, 0.004, 900);
const camE = new THREE.PerspectiveCamera(30, W / H, 0.005, 200);
const eKeys = earthKeys(earth.H, earth.E, earth.N, earth.V);

// ── render targets + accumulation ───────────────────────────────────────
const rtS = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const rtA = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
const accum = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: { tex: { value: null }, w: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform sampler2D tex; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * w, 1.0); }',
  blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
}));
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.addPass(new TexturePass(rtA.texture));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.32, 0.42, 1.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(W, H) }, seed: { value: 0 }, vig: { value: 0.55 }, grain: { value: 0.022 }, flash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float seed; uniform float vig; uniform float grain; uniform float flash; varying vec2 vUv;
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c*vec2(res.x/res.y,1.0), c*vec2(res.x/res.y,1.0));
      float ca = 0.0016 * r2;
      vec3 col = vec3(texture2D(tDiffuse, vUv + c*ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - c*ca).b);
      float v = smoothstep(1.15, 0.2, length(c*vec2(res.x/max(res.x,res.y), res.y/max(res.x,res.y))*1.55));
      col *= mix(1.0, v, vig);
      col += flash;
      float l = dot(col, vec3(0.299,0.587,0.114));
      float g = (h12(floor(vUv*res/2.0) + seed*37.0) - 0.5) * grain * (0.35 + 0.65*smoothstep(0.0, 0.5, l)*(1.0-smoothstep(0.6,1.0,l)) + 0.25);
      float d = (h12(vUv*res + 7.31) - 0.5) / 255.0 * 1.6;
      gl_FragColor = vec4(col + g + d, 1.0);
    }`,
});
composer.addPass(finalPass);

const JIT = [[0.125, 0.375], [0.375, -0.125], [-0.125, -0.375], [-0.375, 0.125]];
function jitter(k, n) {
  if (n === 1) return [0, 0];
  if (n === 4) return JIT[k];
  const h = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  return [h(k + 1, 2) - 0.5, h(k + 1, 3) - 0.5];
}

function shoot(world, cam, S, tk, jx, jy, first) {
  if (world === home) applyCamera(cam, homeCamera(tk), L);
  else { applyCamera(cam, earthCamera(eKeys, tk), L, earth.N); earth.setPixelScale(H / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))); }
  world.update(S, first, cam);
  cam.setViewOffset(W, H, jx, jy, W, H);
  renderer.setRenderTarget(rtS);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(world.scene, cam);
}
function add(w) {
  accum.material.uniforms.tex.value = rtS.texture;
  accum.material.uniforms.w.value = w;
  renderer.setRenderTarget(rtA);
  accum.render(renderer);
}

// ── overlay ─────────────────────────────────────────────────────────────
const overlay = new Overlay(ui, L, CFG);
overlay.build();
const vtmp = new THREE.Vector3();
function project(v, cam) {
  vtmp.copy(v).project(cam);
  if (vtmp.z > 1) return null;
  return [(vtmp.x + 1) / 2 * W, (1 - vtmp.y) / 2 * H];
}
function place(node, p, dx, dy) {
  if (!p) return null;
  const w = node.offsetWidth || 300, h = node.offsetHeight || 80, m = 40 * U;
  const x = Math.min(W - m - w / 2, Math.max(m + w / 2, p[0] + dx));
  const y = Math.min(H * 0.68 - h / 2, Math.max(m + h / 2 + (portrait ? 120 * U : 0), p[1] + dy));
  return [x, y];
}
function overlayFrame(t) {
  const S = state(t);
  const P = {};
  if (S.mix < 0.5) {
    applyCamera(camH, homeCamera(t), L); camH.clearViewOffset(); camH.updateMatrixWorld();
    P.knockCard = place(overlay.cards.knock, project(home.anchors.knock, camH), portrait ? 0 : 0.17 * W, portrait ? -0.2 * H : -0.12 * H);
    P.gateCard = place(overlay.cards.opened, project(home.anchors.gate, camH), 0, -0.075 * H);
    if (S.walk >= 0) {
      const [a, b] = home.anchors.walkerBox;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) {
        const q = project(new THREE.Vector3(i & 1 ? b.x : a.x, i & 2 ? b.y : a.y, (i & 4 ? 0.25 : -0.25) + a.z), camH);
        if (!q) continue;
        x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
      }
      if (x1 > x0) P.walker = [x0, y0, x1, y1];
    }
  } else {
    applyCamera(camE, earthCamera(eKeys, t), L, earth.N); camE.clearViewOffset(); camE.updateMatrixWorld();
    P.cloudCard = place(overlay.cards.cloud, project(earth.anchors.vault, camE), 0, portrait ? 0.2 * H : 0.27 * H);
  }
  P.dial = portrait ? [W / 2, 0.215 * H] : [0.84 * W, 0.3 * H];
  P.phone = portrait ? [0.74 * W, 0.47 * H] : [0.8 * W, 0.46 * H];
  overlay.update(t, S, P);
}

// ── bake real renders for the live view and the cloud's footage cards ──
function bake(S, pos, tgt, fov, w, h) {
  home.update(S, true);
  const cam = new THREE.PerspectiveCamera(fov, w / h, 0.01, 900);
  cam.position.copy(pos); cam.lookAt(tgt);
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
  const rt8 = new THREE.WebGLRenderTarget(w, h);
  renderer.setRenderTarget(rt); renderer.setClearColor(0, 1); renderer.clear();
  renderer.render(home.scene, cam);
  const op = new OutputPass(); op.setSize(w, h);
  op.render(renderer, rt8, rt);
  const px = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt8, 0, 0, w, h, px);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), id = x.createImageData(w, h);
  for (let r = 0; r < h; r++) id.data.set(px.subarray((h - 1 - r) * w * 4, (h - r) * w * 4), r * w * 4);
  x.putImageData(id, 0, 0);
  rt.dispose(); rt8.dispose();
  return c;
}
{
  const V3 = (a, b, c) => new THREE.Vector3(a, b, c);
  const lit = (t, o) => Object.assign(state(t), { world: 1, lightPillar: 1, lightWall: 1, lightGate: 1, lightStreet: 1, interior: 1, studio: 0.4, env: 0.25, cone: 0, knockA: 0 }, o);
  const lensOut = LENS.clone().add(V3(0, 0, 0.05));
  const liveC = bake(lit(12.5, { walk: 0.52, tod: 21.7 }), lensOut, V3(0.3, 0.9, 5), 78, 360, 740);
  overlay.setLiveImage(liveC.toDataURL('image/jpeg', 0.92));
  const thumbs = [
    bake(lit(12.5, {}), V3(2.3, 1.6, 7.2), V3(2.3, 1.0, 0), 34, 384, 216),
    bake(lit(17.2, { gate: 1 }), V3(3.4, 1.4, 6.0), V3(2.0, 1.0, -1), 38, 384, 216),
    bake(lit(12.5, { tod: 12.5 }), V3(1.6, 1.6, 6.4), V3(1.8, 1.0, 0), 38, 384, 216),
    bake(lit(12.5, { walk: 0.5 }), lensOut, V3(0.3, 0.9, 5), 70, 384, 216),
    bake(lit(12.5, { tod: 18.1 }), V3(4.6, 1.5, 6.6), V3(1.5, 1.1, 0), 36, 384, 216),
    bake(lit(12.5, { walk: 0.3, tod: 9.5 }), lensOut, V3(-0.3, 0.9, 5), 70, 384, 216),
  ];
  earth.setThumbs(thumbs);
}

function render(t, frame = 0) {
  t = ((t % T) + T) % T;
  renderer.autoClear = false;
  renderer.setRenderTarget(rtA);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, false, false);
  for (let k = 0; k < MB; k++) {
    const off = MB > 1 ? ((k + 0.5) / MB - 0.5) * SHUTTER / FPS : 0;
    const tk = t + off;
    const S = state(tk);
    const [jx, jy] = jitter(k, MB);
    if (S.mix < 0.999) { shoot(home, camH, S, tk, jx, jy, k === 0); add((1 - S.mix) / MB); }
    if (S.mix > 0.001) { shoot(earth, camE, S, tk, jx, jy, k === 0); add(S.mix / MB); }
  }
  renderer.autoClear = true;
  const Sc = state(t);
  finalPass.uniforms.seed.value = Math.floor(frame / 3);
  finalPass.uniforms.flash.value = Sc.flash;
  composer.render();
  overlayFrame(t);
  return true;
}
window.__render = render;
window.__info = { W, H, duration: T };
render(0, 0);
window.__ready = true;

if (!RENDER) {
  document.body.classList.add('preview');
  const fit = () => {
    const s = Math.min((innerWidth * 0.96) / W, (innerHeight - 70) / H);
    stage.style.transform = `scale(${s})`;
    stage.style.marginRight = `${W * s - W}px`;
    stage.style.marginBottom = `${H * s - H}px`;
  };
  fit(); addEventListener('resize', fit);
  let playing = true, t = 0, last = performance.now() / 1000;
  const toggle = () => { playing = !playing; document.getElementById('play').textContent = playing ? 'PAUSE' : 'PLAY'; };
  document.getElementById('play').onclick = toggle;
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') t = (t + 1) % T;
    if (e.code === 'ArrowLeft') t = (t - 1 + T) % T;
  });
  document.getElementById('scrub').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); t = ((e.clientX - r.left) / r.width) * T; };
  const fill = document.querySelector('#scrub i'), clock = document.getElementById('time');
  (function loop() {
    const now = performance.now() / 1000;
    if (playing) t = (t + (now - last)) % T;
    last = now;
    render(t, Math.floor(t * 60));
    fill.style.width = (t / T) * 100 + '%';
    clock.textContent = t.toFixed(2).padStart(5, '0') + 's';
    requestAnimationFrame(loop);
  })();
}
