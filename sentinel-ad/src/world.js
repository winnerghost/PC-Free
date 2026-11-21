/* The home scene: Sentinel mounted on the gate pillar of a modern house, at night.
   Metres. The street side faces +Z. Lights that "turn on" are baked into
   emissive maps (cheap and controllable); only a handful of real lights. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildDevice } from './device.js';
import { DEV } from './camera.js';

const { clamp, lerp, hash } = window.Core;

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function noiseTex(w, h, base, amp, seed, cell = 1) {
  return canvasTex(w, h, (x) => {
    const id = x.createImageData(w, h);
    let s = seed;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < w * h; i++) {
      const v = base + (r() - 0.5) * amp;
      id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = Math.max(0, Math.min(255, v));
      id.data[i * 4 + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    if (cell > 1) { x.globalAlpha = 0.5; x.drawImage(x.canvas, 0, 0, w / cell, h / cell, 0, 0, w, h); }
  });
}

// warm wall-washer scallops baked into an emissive map
function scallopTex(w, h, centers, height = 0.95, spread = 0.11) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'lighter';
    for (const cx of centers) {
      const g = x.createRadialGradient(cx * w, h * 1.02, 0, cx * w, h * 1.02, h * height);
      g.addColorStop(0, 'rgba(255,196,128,1)');
      g.addColorStop(0.25, 'rgba(255,170,96,0.55)');
      g.addColorStop(0.6, 'rgba(255,150,80,0.16)');
      g.addColorStop(1, 'rgba(255,140,70,0)');
      x.save();
      x.translate(cx * w, h);
      x.scale(spread * w / (h * 0.25), 1);
      x.translate(-cx * w, -h);
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.restore();
    }
  });
}

export function buildHome(renderer, cfg) {
  const scene = new THREE.Scene();
  const ringCol = new THREE.Color(cfg.ring);

  // ── sky ───────────────────────────────────────────────────────────────
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunCol: { value: new THREE.Color() }, stars: { value: 0 }, k: { value: 0 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 zen; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float stars; uniform float k; varying vec3 vD;
      float h31(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        float e = clamp(vD.y, -0.2, 1.0);
        vec3 c = mix(hor, zen, pow(clamp(e,0.0,1.0), 0.55));
        c = mix(c, hor*0.35, clamp(-e*5.0,0.0,1.0));
        float sd = max(dot(normalize(vD), sunDir), 0.0);
        c += sunCol * (pow(sd, 900.0)*6.0 + pow(sd, 24.0)*0.35);
        vec3 q = floor(normalize(vD)*420.0);
        float s = step(0.9965, h31(q)) * smoothstep(0.02, 0.25, e);
        c += vec3(0.9,0.95,1.0) * s * stars * (0.5 + 0.5*h31(q+7.0));
        gl_FragColor = vec4(c*k, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
  scene.fog = new THREE.FogExp2(0x000000, 0.012);

  // ── lights ────────────────────────────────────────────────────────────
  const hemi = new THREE.HemisphereLight(0x1a2540, 0x050506, 0.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 11, top: 9, bottom: -7, near: 1, far: 80 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.shadow.autoUpdate = false;
  scene.add(sun, sun.target);
  sun.target.position.set(1.5, 0, 1.5);

  const interior = new THREE.SpotLight(0xffb36b, 0, 26, 0.62, 0.65, 1.4);
  interior.position.set(2.3, 4.2, -6.0);
  interior.target.position.set(2.3, 0.0, 4.0);
  interior.castShadow = true;
  interior.shadow.mapSize.set(2048, 2048);
  interior.shadow.bias = -0.0006; interior.shadow.normalBias = 0.015;
  interior.shadow.autoUpdate = false;
  scene.add(interior, interior.target);

  const lamp = new THREE.SpotLight(0xffd2a0, 0, 16, 0.85, 0.8, 1.6);
  lamp.position.set(7.2, 4.6, 5.6);
  lamp.target.position.set(5.5, 0, 4.4);
  scene.add(lamp, lamp.target);

  // studio lights for the product shots (aimed at the device)
  const rimL = new THREE.SpotLight(0xdbe9ff, 0, 3, 0.2, 0.6, 2);
  rimL.position.copy(DEV).add(new THREE.Vector3(-0.6, 0.35, -0.12));
  rimL.target.position.copy(DEV);
  const rimR = new THREE.SpotLight(0xffffff, 0, 3, 0.2, 0.6, 2);
  rimR.position.copy(DEV).add(new THREE.Vector3(0.6, 0.12, -0.08));
  rimR.target.position.copy(DEV);
  const key = new THREE.SpotLight(0xffffff, 0, 4, 0.16, 0.7, 2);
  key.position.copy(DEV).add(new THREE.Vector3(0.35, 0.6, 0.9));
  key.target.position.copy(DEV);
  scene.add(rimL, rimL.target, rimR, rimR.target, key, key.target);

  // ── ground ────────────────────────────────────────────────────────────
  const paving = canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#7a7a78'; x.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 112 + Math.floor(hash(i * 31 + j * 7) * 26);
      x.fillStyle = `rgb(${v},${v - 1},${v - 3})`;
      x.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
    x.fillStyle = 'rgba(0,0,0,0.55)';
    for (let i = 0; i <= n; i++) { x.fillRect(i * s - 1.5, 0, 3, h); x.fillRect(0, i * s - 1.5, w, 3); }
  }, [40, 40]);
  const groundMat = new THREE.MeshStandardMaterial({ map: paving, color: 0x3a3b3e, roughness: 0.62, metalness: 0.0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(240, 6), new THREE.MeshStandardMaterial({ color: 0x101113, roughness: 0.78, map: noiseTex(256, 256, 128, 40, 11) }));
  asphalt.material.map.wrapS = asphalt.material.map.wrapT = THREE.RepeatWrapping; asphalt.material.map.repeat.set(60, 2);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0.004, 6.5);
  asphalt.receiveShadow = true;
  scene.add(asphalt);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(240, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0x55575a, roughness: 0.9 }));
  curb.position.set(0, 0.06, 3.45);
  curb.receiveShadow = true; curb.castShadow = true;
  scene.add(curb);

  // ── architecture ──────────────────────────────────────────────────────
  const concreteMap = noiseTex(512, 512, 150, 34, 5);
  concreteMap.wrapS = concreteMap.wrapT = THREE.RepeatWrapping;
  const archMats = [];
  function concrete(w, h, centers, color = 0x8c8d8f, height = 0.95, spread = 0.11) {
    const m = new THREE.MeshStandardMaterial({
      color, map: concreteMap, roughness: 0.93, metalness: 0,
      emissive: 0xffffff, emissiveMap: scallopTex(Math.round(256 * w), Math.round(256 * h), centers, height, spread), emissiveIntensity: 0,
    });
    archMats.push(m);
    return m;
  }
  const archMeshes = [];
  const pillarGeo = new THREE.BoxGeometry(0.56, 2.3, 0.56);
  const pillarMat = concrete(0.56, 2.3, [0.5], 0x8e8f91, 1.05, 0.16);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x6f7073, roughness: 0.85, map: concreteMap });
  archMats.push(capMat);
  const P1 = new THREE.Mesh(pillarGeo, pillarMat);
  P1.position.set(0, 1.15, 0);
  const P2 = new THREE.Mesh(pillarGeo, pillarMat);
  P2.position.set(4.6, 1.15, 0);
  for (const p of [P1, P2]) {
    p.castShadow = p.receiveShadow = true;
    scene.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.07, 0.66), capMat);
    archMeshes.push(cap);
    cap.position.set(p.position.x, 2.335, 0);
    cap.castShadow = true;
    scene.add(cap);
  }
  const wallMatL = concrete(7.7, 2.1, [0.12, 0.38, 0.64, 0.9], 0x9a958d, 0.9, 0.06);
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(7.7, 2.1, 0.3), wallMatL);
  wallL.position.set(-0.28 - 3.85, 1.05, -0.05);
  const wallMatR = concrete(7.7, 2.1, [0.1, 0.36, 0.62, 0.88], 0x9a958d, 0.9, 0.06);
  const wallR = new THREE.Mesh(new THREE.BoxGeometry(7.7, 2.1, 0.3), wallMatR);
  wallR.position.set(4.88 + 3.85, 1.05, -0.05);
  for (const wl of [wallL, wallR]) {
    wl.castShadow = wl.receiveShadow = true;
    scene.add(wl);
    const cope = new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.05, 0.38), capMat);
    archMeshes.push(cope);
    cope.position.set(wl.position.x, 2.125, -0.05);
    scene.add(cope);
  }
  // ground uplight fixtures (the glowing dots at the foot of the walls)
  const fixtureMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.45), toneMapped: true });
  const fixtures = new THREE.InstancedMesh(new THREE.CircleGeometry(0.035, 20), fixtureMat, 10);
  const fx = [-7.35, -5.35, -3.35, -1.35, 0, 4.6, 5.65, 7.65, 9.65, 11.65];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  fx.forEach((x, i) => { m4.compose(new THREE.Vector3(x, 0.006, x === 0 || x === 4.6 ? 0.42 : 0.24), q, new THREE.Vector3(1, 1, 1)); fixtures.setMatrixAt(i, m4); });
  scene.add(fixtures);

  // ── the gate: two leaves of horizontal aluminium slats ────────────────
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0.82, roughness: 0.36 });
  const rippleU = { kPos: { value: new THREE.Vector3(0.95, 1.22, 0) }, kAge: { value: new THREE.Vector3(-1, -1, -1) }, kCol: { value: ringCol.clone() }, kAmt: { value: 0 } };
  gateMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, rippleU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 kPos; uniform vec3 kAge; uniform vec3 kCol; uniform float kAmt; varying vec3 vWPos;
        float rip(float a){ if (a < 0.0 || a > 2.4) return 0.0; float d = length(vWPos.xy - kPos.xy);
          float r1 = 0.04 + a*2.8; float w = 0.012 + a*0.012;
          return exp(-pow((d-r1)/w,2.0)) * exp(-a*3.2) + exp(-d*d/0.0012)*exp(-a*18.0)*0.35; }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += kCol * kAmt * (rip(kAge.x)+rip(kAge.y)+rip(kAge.z));')
      // the same glint cap as the unit (see device.js): a lamp can glint off a slat for one frame
      .replace('#include <common>', '#include <common>\nuniform float specMax;')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(specMax));');
    sh.uniforms.specMax = dev.parts.specMax;
  };
  function leaf(width, dir) {
    const parts = [];
    const H = 1.95, frame = 0.06, depth = 0.05;
    const box = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); parts.push(b); };
    box(width, frame, depth, dir * width / 2, H - frame / 2 + 0.06, 0);
    box(width, frame, depth, dir * width / 2, frame / 2 + 0.06, 0);
    box(frame, H, depth, dir * frame / 2, H / 2 + 0.06, 0);
    box(frame, H, depth, dir * (width - frame / 2), H / 2 + 0.06, 0);
    const n = 13, inner = H - frame * 2, pitch = inner / n;
    for (let i = 0; i < n; i++) box(width - frame * 2, pitch - 0.032, 0.026, dir * width / 2, 0.06 + frame + pitch * (i + 0.5), 0);
    const g = mergeGeometries(parts);
    const m = new THREE.Mesh(g, gateMat);
    m.castShadow = m.receiveShadow = true;
    const pivot = new THREE.Group();
    pivot.add(m);
    return pivot;
  }
  const leafL = leaf(2.02, 1); leafL.position.set(0.28, 0, 0);
  const leafR = leaf(2.02, -1); leafR.position.set(4.32, 0, 0);
  scene.add(leafL, leafR);

  // ── behind the gate: the house, glowing warm ──────────────────────────
  const houseTex = canvasTex(1024, 512, (x, w, h) => {
    x.fillStyle = '#0d0c0b'; x.fillRect(0, 0, w, h);
    const win = (x0, y0, ww, hh, k) => {
      const g = x.createLinearGradient(0, y0, 0, y0 + hh);
      g.addColorStop(0, `rgba(255,176,96,${0.55 * k})`); g.addColorStop(1, `rgba(255,140,64,${0.95 * k})`);
      x.fillStyle = g; x.fillRect(x0, y0, ww, hh);
    };
    win(90, 250, 300, 210, 1); win(440, 280, 150, 180, 0.8); win(640, 250, 290, 210, 0.9);
    win(150, 70, 180, 120, 0.5); win(560, 60, 320, 140, 0.65);
    x.fillStyle = 'rgba(0,0,0,0.55)';
    for (let i = 0; i < 9; i++) x.fillRect(110 + i * 34, 250, 3, 210);
  });
  const glowTex = canvasTex(256, 256, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h * 0.62, 0, w / 2, h * 0.62, w * 0.5);
    g.addColorStop(0, 'rgba(255,190,120,1)'); g.addColorStop(0.35, 'rgba(255,160,90,0.45)'); g.addColorStop(1, 'rgba(255,140,70,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const houseMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const house = new THREE.Mesh(new THREE.PlaneGeometry(34, 13), houseMat);
  house.position.set(2.3, 1.2, -16);
  scene.add(house);
  const houseBlock = new THREE.Group();
  // light shafts that pour out through the opening gate
  const shaftTex = canvasTex(64, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,200,140,0.0)'); g.addColorStop(0.08, 'rgba(255,200,140,0.9)'); g.addColorStop(1, 'rgba(255,170,100,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const s = x.createLinearGradient(0, 0, w, 0);
    s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.5, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = s; x.fillRect(0, 0, w, h);
  });
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shafts = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + (i % 3) * 0.35, 9), shaftMat);
    m.rotation.x = -Math.PI / 2 + 0.32;
    m.rotation.y = (i - 3) * 0.08;
    m.position.set(0.9 + i * 0.45, 1.0, 1.8);
    shafts.add(m);
  }
  scene.add(shafts);

  // street lamp
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 16), new THREE.MeshStandardMaterial({ color: 0x1a1b1d, metalness: 0.6, roughness: 0.5 }));
  pole.position.set(7.6, 2.3, 5.75);
  scene.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.12), pole.material);
  arm.position.set(7.2, 4.6, 5.7);
  scene.add(arm);
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.5, 1.7) }));
  lampHead.position.set(6.95, 4.56, 5.7);
  scene.add(lampHead);

  // ── Sentinel on the pillar ────────────────────────────────────────────
  const dev = buildDevice(cfg);
  dev.group.scale.setScalar(0.09);
  dev.group.position.copy(DEV);
  scene.add(dev.group);

  // ── motion-sensing cone and the radar it paints on the ground ─────────
  const lensW = DEV.clone().add(new THREE.Vector3(0, 0.84 * 0.09, 0.016));
  const coneLen = 7.5;
  const coneGeo = (() => {
    const hx = Math.tan(THREE.MathUtils.degToRad(52)), up = Math.tan(THREE.MathUtils.degToRad(8)), dn = Math.tan(THREE.MathUtils.degToRad(34));
    const f = [[-hx, up], [hx, up], [hx, -dn], [-hx, -dn]].map(([a, b]) => new THREE.Vector3(a * coneLen, b * coneLen, coneLen));
    const o = new THREE.Vector3();
    const pos = [], d = [];
    for (let i = 0; i < 4; i++) { const a = f[i], b = f[(i + 1) % 4]; pos.push(o.x, o.y, o.z, a.x, a.y, a.z, b.x, b.y, b.z); d.push(0, 1, 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('dist', new THREE.Float32BufferAttribute(d, 1));
    return g;
  })();
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { col: { value: ringCol.clone() }, a: { value: 0 }, scan: { value: 0 } },
    vertexShader: 'attribute float dist; varying float vD; varying vec3 vL; void main(){ vD = dist; vL = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 col; uniform float a; uniform float scan; varying float vD; varying vec3 vL;
      void main(){ float z = vL.z / ${coneLen.toFixed(1)}; float band = exp(-pow((z - scan)/0.035, 2.0));
        float body = pow(1.0 - z, 2.2) * 0.016; gl_FragColor = vec4(col * (body + band*0.07*(1.0-z)) * a, 1.0); }`,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.copy(lensW);
  cone.rotation.x = 0.1;
  cone.frustumCulled = false;
  scene.add(cone);
  const radarMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { col: { value: ringCol.clone() }, a: { value: 0 }, scan: { value: 0 }, o: { value: new THREE.Vector2(lensW.x, lensW.z) } },
    vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform vec3 col; uniform float a; uniform float scan; uniform vec2 o; varying vec2 vW;
      void main(){ vec2 d = vW - o; float r = length(d); if (d.y <= 0.0) discard;
        float ang = atan(d.x, d.y); float inC = smoothstep(0.93, 0.86, abs(ang)/0.9076);
        float R = ${coneLen.toFixed(1)}*0.95; float fall = smoothstep(R, R*0.6, r) * smoothstep(0.3, 1.0, r);
        float rings = smoothstep(0.035, 0.0, abs(fract(r/1.25 - 0.5) - 0.5)*1.25) * 0.35;
        float spokes = smoothstep(0.012, 0.0, abs(fract(ang/0.2618 + 0.5) - 0.5)*0.2618*r) * 0.22;
        float band = exp(-pow((r/R - scan)/0.03, 2.0));
        gl_FragColor = vec4(col * (rings + spokes + band*1.2 + 0.04) * inC * fall * a, 1.0); }`,
  });
  const radar = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), radarMat);
  radar.rotation.x = -Math.PI / 2;
  radar.position.set(lensW.x, 0.012, lensW.z + 4.5);
  scene.add(radar);

  // ── a passer-by for the motion-tracking moment ────────────────────────
  const walker = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.82 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x2a2421, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.38, 8, 20), cloth); torso.position.y = 1.27; torso.scale.set(1.12, 1, 0.62);
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.08, 6, 16), cloth); hips.position.y = 0.96; hips.scale.set(1.15, 1, 0.75);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.118, 24, 16), cloth); hood.position.set(0, 1.71, -0.01); hood.scale.set(1, 1.12, 1.05);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12), skin); neck.position.y = 1.58;
  walker.add(torso, hips, hood, neck);
  const limb = (r, l, y, x) => {
    const p = new THREE.Group(); p.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 12), cloth); m.position.y = -l / 2 - r;
    p.add(m); walker.add(p); return p;
  };
  const legL = limb(0.075, 0.72, 0.95, -0.09), legR = limb(0.075, 0.72, 0.95, 0.09);
  const armL = limb(0.055, 0.5, 1.47, -0.22), armR = limb(0.055, 0.5, 1.47, 0.22);
  walker.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  walker.rotation.y = Math.PI / 2;
  walker.position.set(-3.2, 0, 2.3);
  scene.add(walker);

  // colours of the day
  const tod = [
    [0, '#02040a', '#0a1120', '#9fb4e0', 0.0],
    [4.8, '#03060d', '#0f1628', '#9fb4e0', 0.0],
    [6.0, '#1b2846', '#e89a64', '#ffc28a', 0.45],
    [7.5, '#2c5ca8', '#c8c6c0', '#fff0d8', 0.85],
    [12, '#2f6fd0', '#b4d3ee', '#fff6e8', 1.0],
    [16.8, '#2d62b8', '#d6cbb8', '#ffe9cc', 0.9],
    [18.3, '#232850', '#ff8a4a', '#ffb070', 0.45],
    [19.4, '#070b18', '#1b2036', '#9fb4e0', 0.0],
    [24, '#02040a', '#0a1120', '#9fb4e0', 0.0],
  ].map(([h, z, hz, s, d]) => [h, new THREE.Color(z), new THREE.Color(hz), new THREE.Color(s), d]);
  const c1 = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color();
  function sky24(h) {
    let i = 0;
    while (i < tod.length - 2 && h >= tod[i + 1][0]) i++;
    const a = tod[i], b = tod[i + 1];
    const u = clamp((h - a[0]) / (b[0] - a[0]));
    c1.copy(a[1]).lerp(b[1], u); c2.copy(a[2]).lerp(b[2], u); c3.copy(a[3]).lerp(b[3], u);
    return lerp(a[4], b[4], u);
  }

  const tmp = new THREE.Vector3();
  // base colours of the world's surfaces, scaled by W so they fade in from black with the world
  const baseCols = [gateMat, asphalt.material, curb.material, pole.material].map((m) => [m, m.color.clone()]);
  let landscape = false;
  return {
    scene, dev, walker, lensW,
    anchors: {
      lens: lensW,
      knock: new THREE.Vector3(0.95, 1.22, 0.03),
      gate: new THREE.Vector3(2.3, 2.15, 0),
      walkerTop: new THREE.Vector3(),
      walkerBox: [new THREE.Vector3(), new THREE.Vector3()],
    },
    shadowsDirty: true,
    setLandscape(v) { landscape = v; },
    update(S, first) {
      const W = S.world;
      // sky & atmosphere
      const day = sky24(S.tod);
      skyMat.uniforms.zen.value.copy(c1);
      skyMat.uniforms.hor.value.copy(c2);
      skyMat.uniforms.k.value = W;
      skyMat.uniforms.stars.value = (1 - day) * 0.9;
      const sa = ((S.tod - 6) / 24) * Math.PI * 2;
      const sunDir = tmp.set(Math.cos(sa) * 0.75, Math.sin(sa), -0.45).normalize();
      skyMat.uniforms.sunDir.value.copy(sunDir);
      skyMat.uniforms.sunCol.value.copy(c3).multiplyScalar(day > 0.05 ? 1 : 0);
      scene.fog.color.copy(c2).multiplyScalar(W * 0.85);
      scene.fog.density = lerp(0.016, 0.007, day);
      // sun by day, moon by night
      const isDay = Math.sin(sa) > 0;
      const dir = isDay ? sunDir : tmp.set(-Math.cos(sa) * 0.6, Math.max(0.35, -Math.sin(sa)), 0.55).normalize();
      sun.position.copy(dir).multiplyScalar(40).add(sun.target.position);
      sun.color.copy(isDay ? c3 : new THREE.Color(0x8fa8d8));
      const dip = 1 - 0.9 * Math.exp(-Math.pow((S.t - 19.6) / 0.12, 2)); // hide the moment shadows switch on
      sun.intensity = W * dip * (isDay ? 4.6 * Math.min(1, Math.sin(sa) * 3) : 0.42 * Math.min(1, -Math.sin(sa) * 3 + 0.0001));
      hemi.color.copy(c1).lerp(new THREE.Color(0xffffff), day * 0.35);
      hemi.groundColor.set(day > 0.1 ? 0x3a3631 : 0x060607);
      hemi.intensity = W * lerp(0.35, 0.7, day);
      // architecture lights (they fade out in daylight)
      const night = 1 - day;
      // The world's materials carry the environment map themselves, so its strength can follow W.
      // (three.js ignores envMapIntensity on materials that inherit scene.environment, which made
      // the gate pop in fully lit by the studio reflections the moment it became visible.)
      // With W = 1 this is exactly scene.environmentIntensity, so lit scenes look the same.
      const envK = W * (S.env + day * 0.6);
      for (const m of archMats) { m.color.setScalar(W); m.envMap = scene.environment; m.envMapIntensity = envK; }
      for (const m of [gateMat, groundMat, asphalt.material, curb.material, pole.material]) { m.envMap = scene.environment; m.envMapIntensity = envK; }
      for (const [m, c] of baseCols) m.color.copy(c).multiplyScalar(W);
      pillarMat.emissiveIntensity = 1.15 * S.lightPillar * night;
      wallMatL.emissiveIntensity = wallMatR.emissiveIntensity = 1.0 * S.lightWall * night;
      groundMat.color.setScalar(0.23 * W);
      fixtureMat.color.setRGB(1.0, 0.72, 0.45).multiplyScalar(4 * Math.max(S.lightPillar, S.lightWall) * night + 0.02);
      fixtures.visible = W > 0.01;
      houseMat.color.setScalar(0.42 * S.interior * lerp(1, 0.15, day));
      shaftMat.color.setScalar(0.11 * S.interior * S.gate * (1 - day));
      shafts.visible = S.gate > 0.01 && W > 0.01;
      interior.intensity = 70 * S.interior * lerp(1, 0.3, day) * (0.55 + 0.45 * S.gate);
      lamp.intensity = 60 * S.lightStreet * night;
      lampHead.material.color.setRGB(3.2, 2.5, 1.7).multiplyScalar(S.lightStreet * night + 0.04 * W);
      for (const o of [ground, asphalt, curb, P1, P2, wallL, wallR, leafL, leafR, house, pole, arm, lampHead, ...archMeshes]) o.visible = W > 0.002;
      // only the lights that matter in this act are in the shaders (each light costs per pixel)
      const lit = W > 0.001;
      sun.visible = hemi.visible = interior.visible = lit;
      lamp.visible = lit && S.lightStreet > 0.001;
      rimL.visible = rimR.visible = key.visible = S.studio > 0.001;
      sun.castShadow = S.t > 19.6 && S.t < 26.6; interior.castShadow = lit;
      // product lighting
      rimL.intensity = 2.0 * S.studio; rimR.intensity = 0.95 * S.studio * (landscape ? 1 : S.rimR); key.intensity = 0.8 * S.studio;
      // the 16:9 camera sees the rounded edges from other angles, so there the glints are capped instead
      const cap = landscape ? S.glintCap : 0;
      dev.parts.specMax.value = cap > 0.001 ? 2.0 / cap : 1e6;
      scene.environmentIntensity = S.env + day * 0.6;
      // the device
      dev.setRing(S.ring, S.arc0, S.arc1, S.seal);
      dev.parts.statusMat.emissiveIntensity = 3 * S.status;
      // knocks
      rippleU.kAge.value.set(S.knocks[0], S.knocks[1], S.knocks[2]);
      rippleU.kAmt.value = 0.8 * S.knockA;
      // gate leaves
      const ang = THREE.MathUtils.degToRad(82) * S.gate;
      leafL.rotation.y = ang; leafR.rotation.y = -ang;
      // sensing cone
      coneMat.uniforms.a.value = S.cone; radarMat.uniforms.a.value = S.cone;
      coneMat.uniforms.scan.value = S.scan; radarMat.uniforms.scan.value = S.scan;
      cone.visible = radar.visible = S.cone > 0.002;
      // walker
      walker.visible = S.walk >= 0 && W > 0.01;
      if (walker.visible) {
        const x = lerp(-2.6, 1.9, S.walk);
        walker.position.x = x;
        const ph = S.walk * 2.7 * 1.7 * Math.PI * 2;
        legL.rotation.x = Math.sin(ph) * 0.45; legR.rotation.x = -Math.sin(ph) * 0.45;
        armL.rotation.x = -Math.sin(ph) * 0.32; armR.rotation.x = Math.sin(ph) * 0.32;
        walker.position.y = Math.abs(Math.cos(ph)) * 0.025;
        this.anchors.walkerBox[0].set(x - 0.35, 0.0, 2.3);
        this.anchors.walkerBox[1].set(x + 0.35, 1.86, 2.3);
      }
      // shadows: refresh once per frame (not per sub-frame)
      if (first) { sun.shadow.needsUpdate = true; interior.shadow.needsUpdate = true; }
    },
  };
}
