/* The planet scene: a dot-matrix Earth (radius 1), a beacon at home, arcs of
   light to cities around the world (live view from anywhere), and a luminous
   cloud where footage clips stream up and file themselves into a vault. */
import * as THREE from 'three';

const { clamp, lerp, E, hash } = window.Core;

export function ll(lat, lon, r = 1) {
  const a = THREE.MathUtils.degToRad(lat), o = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(a) * Math.sin(o) * r, Math.sin(a) * r, Math.cos(a) * Math.cos(o) * r);
}

export function buildEarth(renderer, cfg) {
  const scene = new THREE.Scene();
  const ring = new THREE.Color(cfg.ring);
  const HOME = cfg.globe.home;
  const H = ll(HOME[0], HOME[1]).normalize();
  const lonR = THREE.MathUtils.degToRad(HOME[1]), latR = THREE.MathUtils.degToRad(HOME[0]);
  const Ev = new THREE.Vector3(Math.cos(lonR), 0, -Math.sin(lonR)).normalize();
  const Nv = new THREE.Vector3(-Math.sin(latR) * Math.sin(lonR), Math.cos(latR), -Math.sin(latR) * Math.cos(lonR)).normalize();
  const V = H.clone().multiplyScalar(1.78).add(Nv.clone().multiplyScalar(0.05)); // the cloud vault

  // ── stars ─────────────────────────────────────────────────────────────
  {
    const n = 2600, p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = hash(i * 3 + 1) * 2 - 1, th = hash(i * 3 + 2) * Math.PI * 2, r = Math.sqrt(1 - u * u);
      p.set([Math.cos(th) * r * 60, u * 60, Math.sin(th) * r * 60], i * 3);
      s[i] = 0.4 + Math.pow(hash(i * 7 + 5), 6) * 2.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('sz', new THREE.BufferAttribute(s, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { k: { value: 1 } },
      vertexShader: 'attribute float sz; varying float vS; void main(){ vS = sz; gl_PointSize = sz*1.6; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float k; varying float vS; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(vec3(0.75,0.85,1.0)*smoothstep(0.5,0.0,d)*0.7*k*min(vS,1.4), 1.0); }',
    });
    scene.add(new THREE.Points(g, m));
  }

  // ── the globe ─────────────────────────────────────────────────────────
  const globeMat = new THREE.ShaderMaterial({
    uniforms: { rim: { value: ring.clone() } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform vec3 rim; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1.0 - max(dot(vN, vV), 0.0); vec3 c = mix(vec3(0.006,0.012,0.022), vec3(0.02,0.05,0.09), f);
        c += rim * pow(f, 4.0) * 0.55; gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.995, 128, 64), globeMat));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.16, 96, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { c: { value: ring.clone() } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(max(dot(-vN, vV), 0.0), 3.2); gl_FragColor = vec4(c * f * 0.55, 1.0); }',
  }));
  scene.add(atmo);

  // land dots
  const L = window.SENTINEL_LAND;
  const nDots = L.length / 2;
  const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0042, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }), nDots);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), zf = new THREE.Vector3(0, 0, 1);
  const col = new THREE.Color();
  const dotBase = new Float32Array(nDots);
  for (let i = 0; i < nDots; i++) {
    const p = ll(L[i * 2] / 10, L[i * 2 + 1] / 10, 1.0012);
    qq.setFromUnitVectors(zf, p.clone().normalize());
    m4.compose(p, qq, sc);
    dots.setMatrixAt(i, m4);
    const d = p.distanceTo(H);
    dotBase[i] = 0.28 + 0.9 * Math.exp(-d * d / 0.03) + 0.08 * hash(i);
    col.copy(ring).multiplyScalar(dotBase[i]);
    dots.setColorAt(i, col);
  }
  scene.add(dots);
  const dotPos = Array.from({ length: nDots }, (_, i) => ll(L[i * 2] / 10, L[i * 2 + 1] / 10));

  // ── home beacon ───────────────────────────────────────────────────────
  const beacon = new THREE.Group();
  beacon.position.copy(H);
  beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), H);
  scene.add(beacon);
  const bDot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(cfg.ring).multiplyScalar(4) }));
  beacon.add(bDot);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.32, 8, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { c: { value: ring.clone() }, k: { value: 1 } },
    vertexShader: 'varying float vY; void main(){ vY = position.y/0.32 + 0.5; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 c; uniform float k; varying float vY; void main(){ gl_FragColor = vec4(c * pow(1.0-vY, 1.5) * 1.2 * k, 1.0); }',
  }));
  beam.position.y = 0.16;
  beacon.add(beam);
  const pulses = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), new THREE.MeshBasicMaterial({ color: ring.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    beacon.add(m);
    return m;
  });

  // ── arcs to the world ─────────────────────────────────────────────────
  const arcMat = (i) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { c: { value: ring.clone() }, p: { value: 0 }, k: { value: 0 } },
    vertexShader: 'varying float vU; void main(){ vU = uv.x; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 c; uniform float p; uniform float k; varying float vU;
      void main(){ if (vU > p) discard; float head = exp(-pow((p - vU)/0.07, 2.0)); float tail = 0.22;
        gl_FragColor = vec4(c * (head*4.5 + tail*1.8) * k, 1.0); }`,
  });
  const arcs = cfg.globe.cities.map(([la, lo], i) => {
    const B = ll(la, lo);
    const ang = H.angleTo(B);
    const pts = [];
    for (let j = 0; j <= 96; j++) {
      const u = j / 96;
      const v = new THREE.Vector3().copy(H).multiplyScalar(Math.sin((1 - u) * ang)).add(B.clone().multiplyScalar(Math.sin(u * ang))).divideScalar(Math.sin(ang));
      v.normalize().multiplyScalar(1.004 + Math.sin(Math.PI * u) * (0.06 + ang * 0.16));
      pts.push(v);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.0045, 6, false), arcMat(i));
    scene.add(mesh);
    const end = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 48), new THREE.MeshBasicMaterial({ color: ring.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    end.position.copy(B.clone().multiplyScalar(1.003));
    end.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), B);
    scene.add(end);
    return { mesh, end, B };
  });

  // ── the cloud ─────────────────────────────────────────────────────────
  const cloudPts = 1100;
  const cp = new Float32Array(cloudPts * 3), cs = new Float32Array(cloudPts), ca = new Float32Array(cloudPts);
  const lobes = [[0, 0, 0, 0.3], [0.24, -0.04, 0.05, 0.22], [-0.25, -0.05, -0.02, 0.21], [0.08, 0.12, -0.04, 0.2], [-0.1, 0.1, 0.06, 0.17], [0.42, -0.1, 0.0, 0.14], [-0.44, -0.11, 0.02, 0.13]];
  const right0 = Ev.clone(), up0 = Nv.clone();
  for (let i = 0; i < cloudPts; i++) {
    const lb = lobes[i % lobes.length];
    const u = hash(i * 5 + 1) * 2 - 1, th = hash(i * 5 + 2) * Math.PI * 2, rr = Math.cbrt(hash(i * 5 + 3)) * lb[3];
    const s = Math.sqrt(1 - u * u);
    const lx = lb[0] + Math.cos(th) * s * rr * 1.25, ly = lb[1] + u * rr * 0.72, lz = lb[2] + Math.sin(th) * s * rr;
    const w = V.clone().add(right0.clone().multiplyScalar(lx)).add(H.clone().multiplyScalar(ly)).add(up0.clone().multiplyScalar(lz));
    cp.set([w.x, w.y, w.z], i * 3);
    cs[i] = 0.06 + hash(i * 5 + 4) * 0.2;
    ca[i] = 0.006 + hash(i * 9 + 2) * 0.014;
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  cg.setAttribute('sz', new THREE.BufferAttribute(cs, 1));
  cg.setAttribute('al', new THREE.BufferAttribute(ca, 1));
  const cloudMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { k: { value: 0 }, c: { value: new THREE.Color(0.75, 0.86, 1.0) }, h: { value: 800 } },
    vertexShader: 'attribute float sz; attribute float al; uniform float h; varying float vA; void main(){ vA = al; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = sz*h/(-mv.z); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float k; uniform vec3 c; varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float f = exp(-d*d*3.2); gl_FragColor = vec4(c*f*vA*k, 1.0); }',
  });
  const cloud = new THREE.Points(cg, cloudMat);
  cloud.frustumCulled = false;
  scene.add(cloud);

  // footage cards that fly up into the vault
  const cardGeo = new THREE.PlaneGeometry(0.15, 0.0844);
  const cardMats = [], cards = [];
  const camEnd = H.clone().multiplyScalar(2.38).add(Ev.clone().multiplyScalar(0.6)).add(Nv.clone().multiplyScalar(-0.42));
  const fwd = camEnd.clone().sub(V).normalize();
  const cr = new THREE.Vector3().crossVectors(fwd.clone().negate(), Nv).normalize();
  const cu = new THREE.Vector3().crossVectors(cr, fwd.clone().negate()).normalize();
  const faceQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(cr.clone().negate().negate(), cu, fwd));
  for (let i = 0; i < 12; i++) {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { map: { value: null }, a: { value: 0 }, glow: { value: ring.clone() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D map; uniform float a; uniform vec3 glow; varying vec2 vUv;
        float rr(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
        void main(){ vec2 p = (vUv-0.5)*vec2(1.0, 0.5625); float d = rr(p, vec2(0.5,0.28125), 0.05);
          if (d > 0.0) discard; vec3 c = texture2D(map, vUv).rgb * 1.1;
          float edge = smoothstep(-0.012, 0.0, d);
          c += glow * edge * 1.6; gl_FragColor = vec4(c, a); }`,
    });
    const mesh = new THREE.Mesh(cardGeo, m);
    const col = i % 4, row = Math.floor(i / 4);
    const slot = V.clone().add(cr.clone().multiplyScalar((col - 1.5) * 0.172)).add(cu.clone().multiplyScalar((1 - row) * 0.102)).add(fwd.clone().multiplyScalar(0.06));
    const start = H.clone().multiplyScalar(1.01);
    const ctrl = H.clone().multiplyScalar(1.45).add(cr.clone().multiplyScalar((col - 1.5) * 0.25 + (hash(i) - 0.5) * 0.2));
    mesh.visible = false;
    scene.add(mesh);
    cardMats.push(m);
    cards.push({ mesh, slot, start, ctrl });
  }
  const startQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), H);

  // upload streams: particles flowing from home into the cloud
  const sN = 150;
  const sp = new Float32Array(sN * 3);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const streamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { k: { value: 0 }, c: { value: ring.clone() }, h: { value: 800 } },
    vertexShader: 'uniform float h; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = 0.012*h/(-mv.z); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float k; uniform vec3 c; void main(){ float d = length(gl_PointCoord-0.5)*2.0; gl_FragColor = vec4(c*exp(-d*d*4.0)*1.6*k, 1.0); }',
  });
  const streams = new THREE.Points(sg, streamMat);
  streams.frustumCulled = false;
  scene.add(streams);

  const bez = (a, b, c, u, out) => out.copy(a).multiplyScalar((1 - u) * (1 - u)).add(b.clone().multiplyScalar(2 * u * (1 - u))).add(c.clone().multiplyScalar(u * u));
  const tmpV = new THREE.Vector3();

  return {
    scene, H, E: Ev, N: Nv, V,
    anchors: { home: H.clone().multiplyScalar(1.02), vault: V.clone() },
    setThumbs(canvases) {
      cards.forEach((c, i) => {
        const tex = new THREE.CanvasTexture(canvases[i % canvases.length]);
        tex.colorSpace = THREE.SRGBColorSpace;
        cardMats[i].uniforms.map.value = tex;
      });
    },
    setPixelScale(hpx) { cloudMat.uniforms.h.value = hpx; streamMat.uniforms.h.value = hpx; },
    update(S, first, cam) {
      const t = S.t;
      const cd = cam ? cam.position.length() : 3;
      beam.material.uniforms.k.value = THREE.MathUtils.smoothstep(cd, 1.25, 1.8);
      bDot.visible = cd > 1.12;
      // beacon pulses
      pulses.forEach((p, i) => {
        const ph = ((t * 0.8 + i / 3) % 1);
        p.scale.setScalar(0.01 + ph * 0.09);
        p.material.opacity = (1 - ph) * 0.8;
      });
      // arcs race out, rings land
      arcs.forEach((a, i) => {
        const age = S.arcs[i];
        const p = E.inOut(clamp(age / 1.15));
        a.mesh.material.uniforms.p.value = p;
        a.mesh.material.uniforms.k.value = age > 0 ? 1 - clamp((t - 33.0) / 1.5) : 0;
        a.mesh.visible = age > 0;
        const land = age - 1.15;
        a.end.visible = land > 0;
        if (land > 0) {
          const ph = (land * 0.9) % 1;
          a.end.scale.setScalar(0.006 + ph * 0.03);
          a.end.material.opacity = (1 - ph) * 0.9 * (1 - clamp((t - 33.0) / 1.5));
        }
      });
      // cloud + vault
      cloudMat.uniforms.k.value = S.cloud;
      cloud.visible = S.cloud > 0.002;
      cards.forEach((c, i) => {
        const u = S.cards[i];
        c.mesh.visible = u > 0 && S.cloud > 0.002;
        if (!c.mesh.visible) return;
        const e = E.inOut(u);
        bez(c.start, c.ctrl, c.slot, e, c.mesh.position);
        c.mesh.quaternion.copy(startQ).slerp(faceQ, E.inOut(clamp(u * 1.3)));
        c.mesh.scale.setScalar(lerp(0.25, 1, E.outSoft(clamp(u * 1.6))));
        cardMats[i].uniforms.a.value = clamp(u * 4) * S.cloud;
      });
      // upload streams
      const live = clamp((t - 30.0) / 0.4) * (1 - clamp((t - 33.8) / 0.6));
      streamMat.uniforms.k.value = live * S.cloud;
      streams.visible = live > 0.002;
      if (streams.visible) {
        for (let i = 0; i < sN; i++) {
          const c = cards[i % 12];
          const u = ((t * 0.55 + hash(i * 13) ) % 1);
          bez(c.start, c.ctrl, c.slot, u, tmpV);
          tmpV.add(cr.clone().multiplyScalar((hash(i * 7) - 0.5) * 0.02));
          sp.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
        }
        sg.attributes.position.needsUpdate = true;
      }
    },
  };
}
