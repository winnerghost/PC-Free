/* One continuous camera move. Keys are joined with a time-aware Catmull-Rom
   (cubic Hermite) spline, so velocity is smooth through every key: the camera
   never stops dead and never jerks. */
import * as THREE from 'three';
import { T } from './timeline.js';

// device anchor points (world, metres) — must match world.js
export const DEV = new THREE.Vector3(0, 1.45, 0.3034);
export const LENS = new THREE.Vector3(0, 1.45 + 0.84 * 0.09, 0.3034 + 0.16 * 0.09);

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const D = (x, y, z) => DEV.clone().add(v(x, y, z));
const Lp = (x, y, z) => LENS.clone().add(v(x, y, z));

// [time, position, target, vertical fov (16:9), portrait distance factor]
const HOME = [
  [0.0, Lp(0.0, 0.0, 0.088), Lp(0, 0, 0), 30, 1.45, 1.45, 0.0],
  [1.3, Lp(0.006, 0.003, 0.079), Lp(0, 0, 0), 30, 1.45, 1.55, 0.0],
  [2.6, Lp(0.034, 0.012, 0.078), Lp(0.002, -0.008, 0), 30, 1.35, 1.45, 0.0],
  [3.9, D(0.05, 0.012, 0.105), D(0.0, -0.006, 0.014), 30, 1.2, 1.64, 0.016],
  [5.1, D(0.075, -0.05, 0.15), D(0.0, -0.03, 0.012), 30, 1.15, 1.5, 0.023],
  [6.7, D(0.24, 0.035, 0.42), D(0.0, 0.004, 0.0), 30, 1.05, 1.45, -0.012],
  [8.5, D(-0.17, 0.05, 0.53), D(0.0, 0.0, 0.0), 30, 1.1, 1.55, -0.03],
  [10.1, D(-0.05, 0.1, 1.45), D(0.28, -0.06, 0.0), 30, 1.25, 1.0, 0.0],
  [11.5, v(0.74, 1.5, 1.95), v(0.3, 1.35, 0.0), 30, 1.22, 1.0, 0.0],
  [14.3, v(0.9, 1.47, 1.78), v(0.36, 1.33, 0.0), 30, 1.22, 1.0, 0.0],
  [16.1, v(2.85, 1.62, 7.1), v(2.05, 1.05, -0.6), 30, 1.18, 1.0, 0.0],
  [19.1, v(2.55, 1.55, 6.4), v(2.1, 1.05, -0.8), 30, 1.18, 1.0, 0.0],
  [20.7, v(3.3, 2.45, 6.3), v(0.35, 0.85, 1.7), 30, 1.2, 1.0, 0.0],
  [24.7, v(3.6, 2.6, 5.8), v(0.3, 0.9, 1.8), 30, 1.2, 1.0, 0.0, true],
  [26.4, v(0.3, 26.0, 1.2), v(0.15, 0.0, 0.55), 30, 1.0, 1.0, 0.0],
  [34.9, v(0.1, 22.0, 1.5), v(0.0, 1.0, 0.35), 30, 1.0, 1.0, 0.0],
  [35.95, D(0.17, 0.08, 0.62), D(0.01, -0.012, 0.0), 30, 1.0, 1.4, -0.018, true],
  [36.9, D(0.13, 0.035, 0.6), D(0.0, -0.006, 0.0), 30, 1.05, 1.45, -0.022],
  [37.7, D(0.12, 0.04, 0.63), D(0.0, 0.0, 0.0), 30, 1.1, 1.6, -0.034],
  [39.05, D(-0.07, 0.02, 0.47), D(0.0, 0.02, 0.0), 30, 1.05, 1.5, -0.03],
];

// earth scene: globe of radius 1 at the origin; the home pin points along H
export function earthKeys(H, E, N, V) {
  const P = (a, b, c) => H.clone().multiplyScalar(a).add(E.clone().multiplyScalar(b)).add(N.clone().multiplyScalar(c));
  return [
    [25.4, P(1.42, 0.0, -0.02), P(1.0, 0, 0), 30, 1.0],
    [26.7, P(1.75, 0.22, -0.18), P(0.92, 0.05, 0.0), 30, 1.0],
    [28.3, P(2.35, 1.55, -0.55), v(0, 0, 0).add(N.clone().multiplyScalar(0.06)), 30, 1.22],
    [30.1, P(2.0, 2.15, -0.25), v(0, 0, 0), 30, 1.22],
    [31.8, P(2.6, 1.25, -0.6), V.clone(), 30, 1.18],
    [33.8, P(2.38, 0.6, -0.42), V.clone(), 30, 1.12],
    [34.95, P(1.36, 0.0, -0.02), P(0.98, 0, 0), 30, 1.0],
    [35.6, P(1.2, 0.0, 0.0), P(0.9, 0, 0), 30, 1.0],
  ];
}

function hermite(keys, t, periodic) {
  const n = keys.length;
  let i = 0;
  if (periodic) {
    t = ((t % T) + T) % T;
    while (i < n - 1 && t >= keys[i + 1][0]) i++;
  } else {
    if (t <= keys[0][0]) return keys[0];
    if (t >= keys[n - 1][0]) return keys[n - 1];
    while (i < n - 2 && t >= keys[i + 1][0]) i++;
  }
  const get = (j) => {
    if (periodic) {
      const w = ((j % n) + n) % n, wrap = Math.floor(j / n);
      const k = keys[w];
      return [k[0] + wrap * T, ...k.slice(1)];
    }
    return keys[Math.max(0, Math.min(n - 1, j))];
  };
  const k0 = get(i - 1), k1 = get(i), k2 = get(i + 1), k3 = get(i + 2);
  const t1 = k1[0], t2 = k2[0];
  const u = (t - t1) / (t2 - t1);
  const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
  const dt = t2 - t1;
  const out = [t];
  for (let c = 1; c < k1.length; c++) {
    const a = k1[c], b = k2[c];
    if (a instanceof THREE.Vector3) {
      const m1 = k2[c].clone().sub(k0[c]).multiplyScalar(dt / Math.max(1e-6, k2[0] - k0[0]));
      const m2 = k3[c].clone().sub(k1[c]).multiplyScalar(dt / Math.max(1e-6, k3[0] - k1[0]));
      if (k1[7] === true) m1.set(0, 0, 0);
      if (k2[7] === true) m2.set(0, 0, 0);
      if (!periodic && i === 0) m1.copy(b).sub(a);
      if (!periodic && i === n - 2) m2.copy(b).sub(a);
      out.push(a.clone().multiplyScalar(h00).add(m1.multiplyScalar(h10)).add(b.clone().multiplyScalar(h01)).add(m2.multiplyScalar(h11)));
    } else if (typeof a === 'number') {
      const m1 = ((k2[c] - k0[c]) * dt) / Math.max(1e-6, k2[0] - k0[0]);
      const m2 = ((k3[c] - k1[c]) * dt) / Math.max(1e-6, k3[0] - k1[0]);
      out.push(a * h00 + m1 * h10 + b * h01 + m2 * h11);
    } else out.push(a);
  }
  return out;
}

const UP = new THREE.Vector3(0, 1, 0);
export function applyCamera(cam, key, L, upHint) {
  const [, pos, tgt0, fov, pk, lk = 1, ldy = 0] = key;
  const tgt = L.portrait ? tgt0 : tgt0.clone().add(new THREE.Vector3(0, ldy, 0));
  const p = tgt0.clone().add(pos.clone().sub(tgt0).multiplyScalar(L.portrait ? pk : lk)).add(L.portrait ? new THREE.Vector3() : new THREE.Vector3(0, ldy, 0));
  cam.position.copy(p);
  // when looking nearly straight down, blend the up vector so the view never flips
  const dir = tgt.clone().sub(p).normalize();
  const vert = THREE.MathUtils.smoothstep(Math.abs(dir.y), 0.75, 0.97);
  const up = (upHint ? upHint.clone() : UP.clone()).lerp(new THREE.Vector3(0, 0, -1), upHint ? 0 : vert).normalize();
  cam.up.copy(up);
  cam.lookAt(tgt);
  const f = L.portrait ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * L.portraitFov)) : fov;
  if (cam.fov !== f) { cam.fov = f; cam.updateProjectionMatrix(); }
}

export function homeCamera(t) { return hermite(HOME, t, true); }
export function earthCamera(keys, t) { return hermite(keys, t, false); }
