/* ARHAM — scene.js
   One liquid-chrome object, ray-marched in a fragment shader, that travels
   through the whole site. It can blend between eight forms at once:
     0 liquid   1 solid    2 QLive "Q"   3 Nexora card
     4 Nuviistudios twist  5 Dead Air    6 crystal     7 drop
   Weights for every form are tweened, so any form can morph into any other
   at any moment without a jump. */
(function () {
  "use strict";
  const IA = (window.IA = window.IA || {});

  const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPos;
uniform float uScale;
uniform vec2 uRot;
uniform float uW[8];
uniform vec3 uMouse;
uniform float uBlob;
uniform float uDark;
uniform vec3 uAccent;
uniform float uAlpha;
uniform float uPix;
uniform float uShadow;

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float sdBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r; }
float sdTorusXY(vec3 p, vec2 t){ vec2 q = vec2(length(p.xy) - t.x, p.z); return length(q) - t.y; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - r; }

float sLiquid(vec3 p){
  float t = uTime * 0.55;
  float d = length(p) - 0.6;
  for (int i = 0; i < 5; i++) {
    float f = float(i);
    vec3 c = vec3(sin(t * 0.9 + f * 1.7) * 0.8, cos(t * 0.73 + f * 2.3) * 0.62, sin(t * 0.51 + f * 0.9) * 0.5);
    d = smin(d, length(p - c) - (0.26 + 0.07 * sin(t * 1.3 + f)), 0.42);
  }
  return d;
}
float sSolid(vec3 p){ return sdBox(p, vec3(0.68), 0.15); }
float sQ(vec3 p){
  float d = sdTorusXY(p, vec2(0.66, 0.2));
  return smin(d, sdCap(p, vec3(0.28, -0.28, 0.), vec3(0.86, -0.86, 0.), 0.16), 0.1);
}
float sCard(vec3 p){
  p.xy *= rot(-0.16);
  float d = sdBox(p, vec3(1.0, 0.63, 0.06), 0.06);
  vec3 q = p - vec3(0.22, 0., 0.06);
  for (int i = 0; i < 3; i++) {
    float R = 0.16 + float(i) * 0.15;
    float a = sdTorusXY(q, vec2(R, 0.03));
    a = max(a, 0.02 - q.x);
    a = max(a, abs(q.y) - R * 0.78);
    d = smin(d, a, 0.03);
  }
  return d;
}
float sTwist(vec3 p){
  p.yz *= rot(1.05);
  float a = atan(p.z, p.x);
  vec2 q = vec2(length(p.xz) - 0.66, p.y);
  q *= rot(a * 1.5 + uTime * 0.4);
  vec2 dd = abs(q) - vec2(0.18);
  return (length(max(dd, 0.)) + min(max(dd.x, dd.y), 0.) - 0.05) * 0.7;
}
float sDead(vec3 p){
  float sl = floor(p.y * 6. + floor(uTime * 5.));
  float g = step(0.8, fract(sin(sl * 91.3) * 437.5)) * 0.2 * sin(uTime * 23. + sl);
  p.x += g;
  float d = length(p) - 0.76;
  d += 0.07 * sin(p.x * 8. + uTime * 1.5) * sin(p.y * 8.) * sin(p.z * 8. + uTime);
  return d * 0.75;
}
float sGem(vec3 p){ p = abs(p); return (p.x + p.y + p.z - 1.0) * 0.57735 - 0.05; }
float sDrop(vec3 p){ return length(p) - (0.68 + 0.035 * sin(uTime * 2. + p.y * 6.) + 0.03 * sin(uTime * 1.3 + p.x * 5.)); }

float map(vec3 p){
  vec3 lp = (p - uPos) / uScale;
  vec3 q = lp;
  q.xz *= rot(uRot.x);
  q.yz *= rot(uRot.y);
  float d = 0., ws = 0.;
  if (uW[0] > 0.001) { d += uW[0] * sLiquid(q); ws += uW[0]; }
  if (uW[1] > 0.001) { d += uW[1] * sSolid(q);  ws += uW[1]; }
  if (uW[2] > 0.001) { d += uW[2] * sQ(q);      ws += uW[2]; }
  if (uW[3] > 0.001) { d += uW[3] * sCard(q);   ws += uW[3]; }
  if (uW[4] > 0.001) { d += uW[4] * sTwist(q);  ws += uW[4]; }
  if (uW[5] > 0.001) { d += uW[5] * sDead(q);   ws += uW[5]; }
  if (uW[6] > 0.001) { d += uW[6] * sGem(q);    ws += uW[6]; }
  if (uW[7] > 0.001) { d += uW[7] * sDrop(q);   ws += uW[7]; }
  d /= max(ws, 0.0001);
  if (uBlob > 0.001) {
    float b = length(lp - uMouse) - 0.22;
    d = mix(d, smin(d, b, 0.45), uBlob);
  }
  return d * uScale;
}

vec3 nrm(vec3 p){
  float e = 0.0012 * uScale;
  vec2 k = vec2(1., -1.);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

vec3 env(vec3 r){
  // a product-photography studio: bright sweep, black flags, softboxes, one coloured strip
  vec3 top = mix(vec3(1.0, 1.0, 0.99), vec3(0.2, 0.2, 0.22), uDark);
  vec3 bot = mix(vec3(0.62, 0.62, 0.64), vec3(0.01, 0.01, 0.014), uDark);
  float y = r.y * 0.5 + 0.5;
  vec3 c = mix(bot, top, smoothstep(0.3, 0.8, y));
  // dark horizon band
  c *= 1. - 0.85 * smoothstep(0.1, 0., abs(y - 0.47));
  // black flags left and right of the set
  float az = atan(r.x, r.z);
  c *= 1. - 0.92 * smoothstep(0.22, 0.06, abs(az - 1.15)) * smoothstep(-0.6, 0.2, r.y);
  c *= 1. - 0.92 * smoothstep(0.18, 0.04, abs(az + 1.55)) * smoothstep(-0.6, 0.3, r.y);
  c *= 1. - 0.6 * smoothstep(0.5, 0.1, abs(az - 3.1));
  // softboxes
  c += vec3(2.0) * smoothstep(0.88, 0.97, dot(r, normalize(vec3(-0.55, 0.72, 0.42))));
  c += vec3(1.2) * smoothstep(0.9, 0.98, dot(r, normalize(vec3(0.6, 0.55, 0.58))));
  // vertical strip light
  c += vec3(1.4) * smoothstep(0.045, 0., abs(r.x + 0.33)) * smoothstep(-0.1, 0.5, r.y) * step(0., r.z);
  // coloured accent strip and a faint floor bounce
  c += uAccent * 2.6 * smoothstep(0.86, 0.97, dot(r, normalize(vec3(0.88, 0.02, 0.42))));
  c += uAccent * 0.12 * smoothstep(0.1, -0.7, r.y);
  return c;
}

vec3 shade(vec3 p, vec3 rd){
  vec3 n = nrm(p);
  vec3 r = reflect(rd, n);
  float fr = pow(1. - max(dot(n, -rd), 0.), 4.);
  vec3 c = env(r) * mix(0.72, 1.0, fr);
  float ao = clamp(map(p + n * 0.12 * uScale) / (0.12 * uScale), 0., 1.);
  c *= mix(0.5, 1., ao);
  c += vec3(1.) * pow(max(dot(r, normalize(vec3(-0.6, 0.7, 0.45))), 0.), 90.) * 1.6;
  c = c / (1. + c * 0.35);
  return pow(c, vec3(0.4545));
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0., 0., 4.2);
  vec3 rd = normalize(vec3(uv, -1.7));
  vec4 col = vec4(0.);

  vec3 oc = ro - uPos;
  float R = 1.9 * uScale;
  float b = dot(oc, rd), c = dot(oc, oc) - R * R, h = b * b - c;
  if (h > 0. && uAlpha > 0.001) {
    float t = max(-b - sqrt(h), 0.), tMax = -b + sqrt(h);
    float dmin = 1e9, tmin = t;
    bool hit = false;
    for (int i = 0; i < 96; i++) {
      vec3 p = ro + rd * t;
      float d = map(p);
      if (d < dmin) { dmin = d; tmin = t; }
      if (d < 0.0007 * t) { hit = true; break; }
      t += d * 0.9;
      if (t > tMax) break;
    }
    float pw = uPix * tmin * 1.5;
    if (hit) col = vec4(shade(ro + rd * t, rd), 1.);
    else if (dmin < pw) col = vec4(shade(ro + rd * tmin, rd), 1. - dmin / pw);
  }

  // soft contact shadow on the studio floor (light backdrop only)
  vec2 so = uPos.xy * (1.7 / 4.2) + vec2(0., -uScale * 1.12 * (1.7 / 4.2));
  vec2 se = (uv - so) / vec2(uScale * 0.95 * (1.7 / 4.2), uScale * 0.16 * (1.7 / 4.2));
  float sa = exp(-dot(se, se) * 1.6) * 0.26 * (1. - uDark) * uShadow;
  float a = col.a + sa * (1. - col.a);
  gl_FragColor = vec4(col.rgb * col.a * uAlpha, a * uAlpha);
}`;

  const SHAPES = { liquid: 0, solid: 1, qlive: 2, card: 3, twist: 4, dead: 5, gem: 6, drop: 7 };

  const scene = {
    SHAPES,
    ok: false,
    // tweenable state (x/y in screen space -1..1, s = fraction of the smaller half-axis)
    s: { x: 0, y: 0, scale: 0.6, dark: 0, alpha: 0, blob: 0, shadow: 1, ar: 0.17, ag: 0.24, ab: 1, spin: 0.25 },
    w: { w0: 1, w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0, w7: 0 },
    mouse: { x: 0, y: 0, tx: 0, ty: 0 },
    rot: { x: 0, y: 0, tx: 0, ty: 0, auto: 0 },
    quality: 1,

    init(canvas) {
      this.canvas = canvas;
      let gl = null;
      try {
        gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "high-performance" });
      } catch (e) { gl = null; }
      if (!gl) { document.documentElement.classList.add("no-gl"); return; }
      const sh = (type, src) => {
        const o = gl.createShader(type);
        gl.shaderSource(o, src);
        gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; }
        return o;
      };
      const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { document.documentElement.classList.add("no-gl"); return; }
      const pr = gl.createProgram();
      gl.attachShader(pr, vs);
      gl.attachShader(pr, fs);
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { document.documentElement.classList.add("no-gl"); return; }
      gl.useProgram(pr);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.U = {};
      ["uRes", "uTime", "uPos", "uScale", "uRot", "uW", "uMouse", "uBlob", "uDark", "uAccent", "uAlpha", "uPix", "uShadow"].forEach(
        (n) => (this.U[n] = gl.getUniformLocation(pr, n))
      );
      this.gl = gl;
      this.ok = true;
      this.quality = window.innerWidth < 760 ? 0.62 : 0.8;
      this.wArr = new Float32Array(8);

      window.addEventListener("pointermove", (e) => {
        this.mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
      }, { passive: true });
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.ok = false; });

      let slow = 0, last = performance.now(), time = 0;
      const loop = (now) => {
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (document.hidden || !this.ok) return;
        time += dt * (IA.reduced ? 0.2 : 1);
        if (dt > 0.03) slow += dt; else slow = Math.max(0, slow - dt * 0.4);
        if (slow > 1 && this.quality > 0.45) { this.quality -= 0.08; slow = 0; }
        this.frame(dt, time);
      };
      requestAnimationFrame(loop);
    },

    /* morph to a form; any form can follow any other, even mid-morph */
    shape(name, duration = 1.4) {
      const id = typeof name === "number" ? name : SHAPES[name];
      if (id == null || !window.gsap) return;
      const to = {};
      for (let i = 0; i < 8; i++) to["w" + i] = i === id ? 1 : 0;
      gsap.to(this.w, Object.assign(to, { duration, ease: "power3.inOut", overwrite: true }));
    },
    /* set weights directly (scroll-scrubbed morphs) */
    blend(a, b, t) {
      gsap.killTweensOf(this.w);
      for (let i = 0; i < 8; i++) this.w["w" + i] = 0;
      this.w["w" + SHAPES[a]] = 1 - t;
      this.w["w" + SHAPES[b]] += t;
    },
    /* move / restyle; accent is a hex colour */
    to(props, duration = 1.3, ease = "power3.inOut") {
      if (!window.gsap) return;
      const p = Object.assign({}, props);
      if (p.accent) {
        const n = parseInt(p.accent.replace("#", ""), 16);
        p.ar = ((n >> 16) & 255) / 255;
        p.ag = ((n >> 8) & 255) / 255;
        p.ab = (n & 255) / 255;
        delete p.accent;
      }
      if (p.shape != null) { this.shape(p.shape, duration); delete p.shape; }
      gsap.to(this.s, Object.assign(p, { duration, ease, overwrite: "auto" }));
    },

    frame(dt, time) {
      const gl = this.gl, U = this.U, c = this.canvas, s = this.s;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6) * this.quality;
      const W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      gl.viewport(0, 0, W, H);

      const k = 1 - Math.exp(-dt * 5);
      this.mouse.x += (this.mouse.tx - this.mouse.x) * k;
      this.mouse.y += (this.mouse.ty - this.mouse.y) * k;
      // forms with a front (the Q, the card) turn to face you and sway; others spin
      const face = Math.min(1, this.w.w2 + this.w.w3);
      this.rot.auto += dt * s.spin * (IA.reduced ? 0.2 : 1) * (1 - face);
      if (face > 0.01) {
        const TAU = Math.PI * 2;
        const target = Math.round(this.rot.auto / TAU) * TAU + Math.sin(time * 0.7) * 0.42;
        this.rot.auto += (target - this.rot.auto) * (1 - Math.exp(-dt * 3 * face));
      }
      this.rot.x += (this.mouse.x * 0.5 - this.rot.x) * k;
      this.rot.y += (-this.mouse.y * 0.35 - this.rot.y) * k;

      const aspect = W / H;
      const halfH = (4.2 / 1.7) * 0.5, halfW = halfH * aspect;
      const unit = Math.min(halfH, halfW);
      const px = s.x * halfW, py = s.y * halfH;
      const scale = Math.max(0.0001, s.scale * unit);
      // pointer in object space, held close enough to stay attached
      let mx = (this.mouse.x * halfW - px) / scale, my = (this.mouse.y * halfH - py) / scale;
      const ml = Math.hypot(mx, my), lim = 1.35;
      if (ml > lim) { mx *= lim / ml; my *= lim / ml; }

      for (let i = 0; i < 8; i++) this.wArr[i] = this.w["w" + i];
      gl.uniform2f(U.uRes, W, H);
      gl.uniform1f(U.uTime, time);
      gl.uniform3f(U.uPos, px, py, 0);
      gl.uniform1f(U.uScale, scale);
      gl.uniform2f(U.uRot, this.rot.auto + this.rot.x, this.rot.y);
      gl.uniform1fv(U.uW, this.wArr);
      gl.uniform3f(U.uMouse, mx, my, 0.45);
      gl.uniform1f(U.uBlob, Math.max(s.blob, this.w.w0 * 0.9, this.w.w7));
      gl.uniform1f(U.uDark, s.dark);
      gl.uniform3f(U.uAccent, s.ar, s.ag, s.ab);
      gl.uniform1f(U.uAlpha, s.alpha);
      gl.uniform1f(U.uPix, 1 / (H * 1.7));
      gl.uniform1f(U.uShadow, s.shadow);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };

  IA.scene = scene;
})();
