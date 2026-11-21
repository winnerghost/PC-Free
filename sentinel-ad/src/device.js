/* The Sentinel unit: a slim pill of anodised aluminum with a black glass face,
   a camera lens inside a light ring, a sensor dome, a speaker grille and the
   wordmark printed on the glass. Built in local units (width 1, height 2.6),
   then scaled to real size (about 9 x 23 cm) by the caller. */
import * as THREE from 'three';

function stadium(w, h) {
  const r = w / 2, s = new THREE.Shape();
  const y0 = -h / 2 + r, y1 = h / 2 - r;
  s.moveTo(-r, y0);
  s.lineTo(-r, y1);
  s.absarc(0, y1, r, Math.PI, 0, true);
  s.lineTo(r, y0);
  s.absarc(0, y0, r, 0, -Math.PI, true);
  return s;
}

function wordmarkTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 1024, 128);
  x.font = '600 76px "Sentinel Display"';
  x.letterSpacing = '30px';
  x.fillStyle = '#ffffff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 512 + 15, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildDevice(cfg) {
  const g = new THREE.Group();
  g.name = 'sentinel';

  // ── body: anodised aluminum ───────────────────────────────────────────
  const bevel = 0.07;
  const bodyGeo = new THREE.ExtrudeGeometry(stadium(1.0 - bevel * 2, 2.6 - bevel * 2), {
    depth: 0.24, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 12, curveSegments: 64,
  });
  bodyGeo.translate(0, 0, -0.12 - 0.07);
  const metal = new THREE.MeshStandardMaterial({ color: 0x41464e, metalness: 1.0, roughness: 0.24 });
  const body = new THREE.Mesh(bodyGeo, metal);
  g.add(body);
  const FRONT = 0.12 + 0.07 - 0.07; // front face of the body (z)

  // ── black glass face ──────────────────────────────────────────────────
  const gb = 0.018;
  const glassGeo = new THREE.ExtrudeGeometry(stadium(0.9 - gb * 2, 2.5 - gb * 2), {
    depth: 0.012, bevelEnabled: true, bevelThickness: gb, bevelSize: gb, bevelSegments: 8, curveSegments: 64,
  });
  glassGeo.translate(0, 0, FRONT - 0.008 + gb);
  const glass = new THREE.MeshStandardMaterial({ color: 0x020203, metalness: 0.0, roughness: 0.065, envMapIntensity: 2.6 });
  const face = new THREE.Mesh(glassGeo, glass);
  g.add(face);
  const GZ = FRONT - 0.008 + 0.012 + gb * 2; // outer surface of the glass (0.16)

  // ── camera module ─────────────────────────────────────────────────────
  const LY = 0.84;
  const lensG = new THREE.Group();
  lensG.position.set(0, LY, GZ);
  g.add(lensG);
  // the light ring (emissive, drives the bloom)
  const arcGLSL = `
    float arcMask(vec2 p, float a0, float a1){
      if (a1 - a0 >= 6.2831) return 1.0;
      float a = atan(p.x, p.y); if (a < 0.0) a += 6.2831853;
      float u = a - a0; u = u - 6.2831853*floor(u/6.2831853);
      float len = a1 - a0;
      float full = smoothstep(6.2831853 - 1.4, 6.2831853, len); // blend into the full ring: no pop
      float m = 0.0;
      if (u <= len + 0.02) {
        float tail = smoothstep(0.0, max(0.05, len*0.55), u);
        float head = smoothstep(len + 0.02, len - 0.01, u);
        m = tail*head*(0.65 + 0.35*smoothstep(len*0.5, len, u));
      }
      return mix(m, 1.0, full);
    }`;
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color(cfg.ring) }, k: { value: 0 }, arc0: { value: 0 }, arc1: { value: Math.PI * 2 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 col; uniform float k; uniform float arc0; uniform float arc1; varying vec3 vP; ${'${arcGLSL}'}
      void main(){ float m = arcMask(vP.xy, arc0, arc1); if (m <= 0.001) discard; gl_FragColor = vec4(mix(col, vec3(1.0), 0.35) * k * m, 1.0); }`,
  });
  ringMat.fragmentShader = ringMat.fragmentShader.replace('${arcGLSL}', arcGLSL);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.0095, 24, 256), ringMat);
  ring.position.z = -0.004;
  lensG.add(ring);
  // diffused halo of the ring under the glass
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { col: { value: new THREE.Color(cfg.ring) }, k: { value: 0 }, arc0: { value: 0 }, arc1: { value: Math.PI * 2 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform vec3 col; uniform float k; uniform float arc0; uniform float arc1; varying vec2 vP; ARC
      void main(){ float r = length(vP); float d = abs(r-0.315);
        float on = arcMask(vP, arc0, arc1);
        float g = exp(-d*d/(0.0012)) * 0.9 + exp(-d*d/0.012)*0.12;
        gl_FragColor = vec4(col * g * k * on, 1.0); }`,
  });
  haloMat.fragmentShader = haloMat.fragmentShader.replace('ARC', arcGLSL);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), haloMat);
  halo.position.z = 0.0015;
  lensG.add(halo);
  // lens barrel
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.9, roughness: 0.28 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.05, 96, 1, true), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.02;
  lensG.add(barrel);
  const chamfer = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.01, 16, 160), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 1, roughness: 0.18 }));
  chamfer.position.z = 0.0;
  lensG.add(chamfer);
  for (const [r, z, c] of [[0.2, -0.03, 0x101114], [0.16, -0.045, 0x08090b], [0.12, -0.055, 0x050506]]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(r, 96), new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.35 }));
    d.position.z = z;
    lensG.add(d);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 8, 120), new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 1, roughness: 0.3 }));
    rim.position.z = z + 0.002;
    lensG.add(rim);
  }
  // the front element: a dome with an iridescent coating
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x030409, metalness: 0.0, roughness: 0.015, clearcoat: 1.0, clearcoatRoughness: 0.0,
    iridescence: 1.0, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 560], envMapIntensity: 1.6,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.19, 96, 48, 0, Math.PI * 2, 0, 0.62), lensMat);
  dome.rotation.x = Math.PI / 2;
  dome.position.z = -0.17;
  lensG.add(dome);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.045, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  pupil.position.z = -0.05;
  lensG.add(pupil);

  // ── sensor dome (motion + knock sensing) ──────────────────────────────
  const sensor = new THREE.Group();
  sensor.position.set(0, 0.16, GZ);
  g.add(sensor);
  const sDome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 64, 24, 0, Math.PI * 2, 0, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.38, metalness: 0.1 }));
  sDome.rotation.x = Math.PI / 2;
  sDome.position.z = -0.06;
  sensor.add(sDome);
  const sRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 12, 120), new THREE.MeshStandardMaterial({ color: 0xaab2bc, metalness: 1, roughness: 0.2 }));
  sensor.add(sRing);

  // ── speaker grille ────────────────────────────────────────────────────
  const holes = [];
  const pitch = 0.05;
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
    const x = (i + (j % 2 ? 0.5 : 0)) * pitch, y = j * pitch * 0.866;
    if (Math.hypot(x, y) < 0.2) holes.push([x, y]);
  }
  const hole = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0115, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }), holes.length);
  const m4 = new THREE.Matrix4();
  holes.forEach(([x, y], i) => { m4.makeTranslation(x, -0.62 + y, GZ + 0.0008); hole.setMatrixAt(i, m4); });
  g.add(hole);

  // ── wordmark printed on the glass ─────────────────────────────────────
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.0775),
    new THREE.MeshBasicMaterial({ map: wordmarkTexture(cfg.brand), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  wm.position.set(0, -1.0, GZ + 0.0008);
  g.add(wm);

  // ── status pin-light ──────────────────────────────────────────────────
  const statusMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(cfg.ring), emissiveIntensity: 0 });
  const status = new THREE.Mesh(new THREE.CircleGeometry(0.014, 24), statusMat);
  status.position.set(0, 1.18, GZ + 0.0008);
  g.add(status);

  // a little light that the ring casts on the glass and on whatever is near
  const ringLight = new THREE.PointLight(new THREE.Color(cfg.ring), 0, 3.0, 2);
  ringLight.position.set(0, LY, GZ + 0.25);
  ringLight.visible = false; // too faint to matter, and every light costs per pixel

  return {
    group: g,
    parts: { ringMat, haloMat, statusMat, ringLight, metal, glass, lensMat },
    lensLocal: new THREE.Vector3(0, LY, GZ),
    setRing(intensity, arc0 = 0, arc1 = Math.PI * 2) {
      ringMat.uniforms.k.value = intensity * 3.2;
      ringMat.uniforms.arc0.value = arc0; ringMat.uniforms.arc1.value = arc1;
      haloMat.uniforms.k.value = intensity * 0.32;
      haloMat.uniforms.arc0.value = arc0; haloMat.uniforms.arc1.value = arc1;
      ring.visible = intensity > 0.0005;
    },
  };
}
