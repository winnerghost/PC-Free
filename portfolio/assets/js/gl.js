/* IRIS ARDEN — gl.js
   The living iris: a full-screen fragment shader drawn behind every page.
   Fibres are polar fbm noise, coloured by an opal thin-film palette. The pupil
   dilates with scroll, the fibres lean toward the cursor, and each page eases
   the iris to its own position, size and brightness. */
(function () {
  "use strict";
  const IA = window.IA;

  const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCenter;
uniform vec2 uMouse;
uniform vec2 uLook;
uniform float uPupil;
uniform float uIris;
uniform float uIntensity;
uniform float uLight;
uniform float uEnergy;
uniform float uHue;
uniform float uDust;
uniform vec3 uBg;
uniform vec3 uPupilCol;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;

float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float noise3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash13(i);
  float b = hash13(i + vec3(1.0, 0.0, 0.0));
  float c = hash13(i + vec3(0.0, 1.0, 0.0));
  float d = hash13(i + vec3(1.0, 1.0, 0.0));
  float e = hash13(i + vec3(0.0, 0.0, 1.0));
  float g = hash13(i + vec3(1.0, 0.0, 1.0));
  float h = hash13(i + vec3(0.0, 1.0, 1.0));
  float k = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
float fbm3(vec3 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise3(p); p = p * 2.02 + vec3(3.1, 1.7, 5.3); a *= 0.5; }
  return v;
}
vec3 opal(float t){
  t = fract(t) * 4.0;
  vec3 c = mix(uC0, uC1, smoothstep(0.0, 1.0, t));
  c = mix(c, uC2, smoothstep(1.0, 2.0, t));
  c = mix(c, uC3, smoothstep(2.0, 3.0, t));
  c = mix(c, uC0, smoothstep(3.0, 4.0, t));
  return c;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  float m = min(uRes.x, uRes.y);
  vec2 p = (frag - uCenter) / m - uLook;
  float r = length(p);
  float pr = uPupil;
  float ir = max(uIris, pr + 0.001);
  float t = uTime;

  float haze = exp(-r / (ir * 1.4 + 0.0001));
  float lum = 0.0;
  vec3 tint = opal(atan(p.y, p.x) / 6.2831853 + uHue);
  float ring = 0.0;
  float glow = 0.0;

  if (r > pr - 0.01 && r < ir * 2.6 && uIntensity > 0.002) {
    float a = atan(p.y, p.x);
    vec2 mo = (uMouse - uCenter) / m;
    float ma = atan(mo.y, mo.x);
    float mInf = exp(-length(mo - p) * 3.0);
    float aw = a + 0.28 * mInf * sin(a - ma) + 0.025 * sin(t * 0.3 + r * 22.0);
    vec2 d = vec2(cos(aw), sin(aw));
    float band = (r - pr) / (ir - pr);

    float f1 = fbm3(vec3(d * 7.0, r / ir * 1.8 - t * 0.07));
    float f2 = noise3(vec3(d * 34.0, r / ir * 1.2 + t * 0.05));
    float f3 = noise3(vec3(d * 96.0, band * 3.0 - t * 0.03));
    float fib = f1 * 0.62 + f2 * 0.3 + f3 * 0.22;
    fib = smoothstep(0.32, 0.92, fib);

    float inner = smoothstep(0.0, 0.05, band);
    float outer = 1.0 - smoothstep(0.45, 1.0, band);
    float irisM = inner * outer;
    float collar = exp(-pow((band - 0.2) / 0.09, 2.0));
    float wisp = fbm3(vec3(d * 4.0, t * 0.04 - r * 0.6));
    float corona = pow(wisp, 2.6) * 2.2 * exp(-max(r - ir * 0.75, 0.0) / (ir * 0.42)) * smoothstep(pr, pr + (ir - pr) * 0.6, r);

    float hueT = a / 6.2831853 + uHue + f1 * 0.45 + band * 0.3 + t * 0.012;
    tint = opal(hueT);
    lum = irisM * (fib * 0.95 + collar * 0.55 * (0.6 + fib)) + corona * 0.6;
    lum *= 1.0 + uEnergy * 0.6;

    float rw = 0.0028 + 0.0018 * uEnergy;
    ring = exp(-pow((r - pr) / rw, 2.0));
    glow = exp(-max(r - pr, 0.0) / 0.035) * step(pr, r);
  }

  float pupil = 1.0 - smoothstep(pr - 0.0025, pr + 0.0012, r);
  vec3 pcol = mix(uPupilCol, uBg, smoothstep(0.35, 1.1, pr));

  vec2 cell = floor(frag / 28.0);
  float h = hash12(cell);
  vec2 sp = (cell + 0.2 + 0.6 * vec2(hash12(cell + 3.1), hash12(cell + 7.7))) * 28.0;
  float sd = length(frag - sp);
  float tw = 0.5 + 0.5 * sin(t * (0.6 + h * 1.8) + h * 40.0);
  float star = step(0.93, h) * smoothstep(1.8, 0.0, sd) * tw * uDust;

  float grain = hash12(frag + fract(t * 7.0) * 311.0) - 0.5;
  vec2 vq = (frag / uRes - 0.5) * vec2(uRes.x / m, uRes.y / m);
  float vig = smoothstep(1.25, 0.2, length(vq) * 0.9);

  vec2 cp = (p + uLook * 0.8 - vec2(-0.38, 0.34) * pr) / max(pr, 0.0001);
  float catchl = smoothstep(0.24, 0.12, length(cp * vec2(1.0, 1.35))) * pupil * (1.0 - smoothstep(0.3, 0.8, pr));

  vec3 dark = uBg * (0.8 + 0.2 * vig);
  dark += tint * lum * uIntensity * 1.05;
  dark += tint * haze * 0.05 * uIntensity;
  dark += mix(tint, vec3(1.0), 0.6) * glow * 0.25 * uIntensity;
  dark = mix(dark, pcol, pupil);
  dark += vec3(1.0, 0.97, 0.95) * ring * 0.95 * uIntensity;
  dark += vec3(0.9, 0.95, 1.0) * catchl * 0.08 * uIntensity;
  dark += vec3(0.95, 0.9, 1.0) * star * 0.55;
  dark += grain * 0.035;

  vec3 lite = uBg;
  lite = mix(lite, tint, clamp(lum * uIntensity * 0.9, 0.0, 0.95));
  lite = mix(lite, tint, haze * 0.07 * uIntensity);
  lite = mix(lite, pcol, pupil);
  lite = mix(lite, uPupilCol, ring * 0.85 * uIntensity);
  lite = mix(lite, vec3(1.0), catchl * 0.1 * uIntensity);
  lite = mix(lite, uPupilCol, star * 0.22);
  lite += grain * 0.03;

  gl_FragColor = vec4(mix(dark, lite, uLight), 1.0);
}`;

  const KEYS = ["cx", "cy", "pupil", "iris", "intensity", "hue", "dust"];

  const iris = {
    ok: false,
    canvas: null,
    state: { cx: 0.5, cy: 0.48, pupil: 0.6, iris: 1.6, intensity: 0, hue: 0, dust: 0.5 },
    target: { cx: 0.5, cy: 0.48, pupil: 0.105, iris: 0.4, intensity: 1, hue: 0, dust: 0.5 },
    speed: 2.6,
    dilate: 1,
    dilateTarget: 1,
    pulse: 0,
    energy: 0,
    light: 0,
    colors: null,
    colorTarget: null,
    mouse: { x: 0, y: 0, sx: 0, sy: 0, px: 0, py: 0 },
    look: { x: 0, y: 0 },
    scale: 0.75,

    set(p, instant = false) {
      Object.assign(this.target, p);
      if (instant) Object.assign(this.state, p);
    },

    /* CSS-pixel position/radius of the pupil, so DOM can align to it */
    screen() {
      const W = window.innerWidth, H = window.innerHeight, m = Math.min(W, H);
      const s = this.state;
      return {
        x: s.cx * W + this.look.x * m,
        y: s.cy * H - this.look.y * m,
        r: s.pupil * this.dilate * (1 - this.pulse * 0.22) * m,
        m,
      };
    },

    readTheme() {
      const root = document.documentElement;
      const g = (n) => IA.toRgb(IA.cssColor(n, root)).map((v) => v / 255);
      const t = {
        bg: g("--bg"), pupil: g("--pupil"),
        c0: g("--peach"), c1: g("--rose"), c2: g("--lilac"), c3: g("--jade"),
      };
      this.colorTarget = t;
      if (!this.colors) this.colors = JSON.parse(JSON.stringify(t));
      const isLight = getComputedStyle(root).colorScheme.indexOf("light") === 0;
      this.lightTarget = isLight ? 1 : 0;
      if (this.light === undefined || this.firstTheme !== true) { this.light = this.lightTarget; this.firstTheme = true; }
    },

    init() {
      const canvas = document.getElementById("iris-gl");
      if (!canvas) return;
      this.canvas = canvas;
      let gl = null;
      try {
        gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" });
      } catch (e) { gl = null; }
      this.readTheme();
      this.mouse.x = this.mouse.sx = window.innerWidth / 2;
      this.mouse.y = this.mouse.sy = window.innerHeight * 0.4;

      window.addEventListener("pointermove", (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      }, { passive: true });
      window.addEventListener("pointerdown", (e) => {
        if (e.target.closest("a,button,input,textarea,label,select,canvas.interactive")) return;
        this.pulse = 1;
      });

      if (!gl) { document.documentElement.classList.add("no-gl"); this.loopNoGL(); return; }

      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { document.documentElement.classList.add("no-gl"); return; }
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { document.documentElement.classList.add("no-gl"); return; }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const U = {};
      ["uRes", "uTime", "uCenter", "uMouse", "uLook", "uPupil", "uIris", "uIntensity", "uLight", "uEnergy",
        "uHue", "uDust", "uBg", "uPupilCol", "uC0", "uC1", "uC2", "uC3"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

      this.gl = gl;
      this.U = U;
      this.ok = true;
      this.scale = IA.env.mobile ? 0.6 : 0.8;

      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.ok = false; }, false);

      let slow = 0, fast = 0;
      IA.ticker.add((dt, time) => {
        if (document.hidden) return;
        this.update(dt);
        if (!this.ok) return;
        // adaptive resolution
        if (dt > 0.028) { slow += dt; fast = 0; } else { fast += dt; slow = Math.max(0, slow - dt * 0.5); }
        if (slow > 1.2 && this.scale > 0.45) { this.scale = Math.max(0.45, this.scale - 0.1); slow = 0; }
        if (fast > 6 && this.scale < (IA.env.mobile ? 0.6 : 0.8)) { this.scale += 0.05; fast = 0; }
        // nothing to show while the aperture is fully shut
        const ap = IA.aperture;
        if (ap && ap.el && ap.open <= 0.001 && ap.el.classList.contains("is-active")) return;
        this.render(IA.env.reduced ? time * 0.15 : time);
      }, 100);
    },

    update(dt) {
      const s = this.state, t = this.target, k = this.speed;
      KEYS.forEach((key) => { s[key] = IA.damp(s[key], t[key], key === "intensity" ? k * 0.8 : k, dt); });
      this.dilate = IA.damp(this.dilate, this.dilateTarget, 5, dt);
      this.pulse = IA.damp(this.pulse, 0, 6, dt);
      const ms = this.mouse;
      ms.sx = IA.damp(ms.sx, ms.x, 5, dt);
      ms.sy = IA.damp(ms.sy, ms.y, 5, dt);
      const v = Math.hypot(ms.x - ms.px, ms.y - ms.py) / Math.max(dt, 0.001);
      ms.px = ms.x; ms.py = ms.y;
      this.energy = IA.damp(this.energy, IA.clamp(v / 3000), v / 3000 > this.energy ? 8 : 1.6, dt);

      const W = window.innerWidth, H = window.innerHeight, m = Math.min(W, H);
      const lx = ((ms.sx - s.cx * W) / m) * 0.03;
      const ly = (-(ms.sy - s.cy * H) / m) * 0.03;
      this.look.x = IA.clamp(lx, -0.03, 0.03);
      this.look.y = IA.clamp(ly, -0.03, 0.03);

      if (this.colors && this.colorTarget) {
        for (const key in this.colors) {
          const c = this.colors[key], ct = this.colorTarget[key];
          for (let i = 0; i < 3; i++) c[i] = IA.damp(c[i], ct[i], 3, dt);
        }
      }
      this.light = IA.damp(this.light, this.lightTarget, 3, dt);
    },

    render(time) {
      const gl = this.gl, U = this.U, c = this.canvas;
      const { w, h } = IA.fitCanvas(c, 1.5, this.scale);
      gl.viewport(0, 0, w, h);
      const sx = w / window.innerWidth, sy = h / window.innerHeight;
      const s = this.state, col = this.colors;
      gl.uniform2f(U.uRes, w, h);
      gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uCenter, s.cx * w, (1 - s.cy) * h);
      gl.uniform2f(U.uMouse, this.mouse.sx * sx, h - this.mouse.sy * sy);
      gl.uniform2f(U.uLook, this.look.x, this.look.y);
      const pupil = s.pupil * this.dilate * (1 - this.pulse * 0.22);
      gl.uniform1f(U.uPupil, pupil);
      gl.uniform1f(U.uIris, Math.max(s.iris, pupil * 1.05) * (1 + (this.dilate - 1) * 0.35));
      gl.uniform1f(U.uIntensity, s.intensity);
      gl.uniform1f(U.uLight, this.light);
      gl.uniform1f(U.uEnergy, this.energy);
      gl.uniform1f(U.uHue, s.hue);
      gl.uniform1f(U.uDust, s.dust);
      gl.uniform3fv(U.uBg, col.bg);
      gl.uniform3fv(U.uPupilCol, col.pupil);
      gl.uniform3fv(U.uC0, col.c0);
      gl.uniform3fv(U.uC1, col.c1);
      gl.uniform3fv(U.uC2, col.c2);
      gl.uniform3fv(U.uC3, col.c3);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    loopNoGL() {
      IA.ticker.add((dt) => this.update(dt), 100);
    },
  };

  IA.iris = iris;
})();
