'use strict';
/* =========================================================================
 * Game: lighting & time of day, weather, post, the camera director,
 * input, Partner, story beats, UI and the main loop.
 * ========================================================================= */
(() => {
const { $, clamp, lerp, damp, rand, MAT } = G;
const STATE = (G.STATE = { started: false, tod: 0, todTarget: 0, cuddled: false, cakeDone: false, porchDone: false, busy: false });
const angDamp = (a, b, k, dt) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * (1 - Math.exp(-k * dt)); };

/* =====================================================================
 * Audio (procedural)
 * ===================================================================== */
G.Audio = (() => {
  let ctx = null, master, fireG, windG, padG, pad = [];
  const noise = () => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; return s; };
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    const f = noise(), ff = ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 220; fireG = ctx.createGain(); fireG.gain.value = 0; f.connect(ff); ff.connect(fireG); fireG.connect(master); f.start();
    const w = noise(), wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = 0.5; windG = ctx.createGain(); windG.gain.value = 0.05; w.connect(wf); wf.connect(windG); windG.connect(master); w.start();
    padG = ctx.createGain(); padG.gain.value = 0.04; const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 900; pf.connect(padG); padG.connect(master);
    [130.8, 164.8, 196.0, 246.9].forEach((fr) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr; o.connect(pf); o.start(); pad.push(o); });
  }
  const tone = (f, d, v = 0.06, when = 0) => { if (!ctx) return; const t = ctx.currentTime + when; const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.3); };
  const burst = (dur, freq, vol, type = 'bandpass', q = 1) => { if (!ctx) return; const t = ctx.currentTime; const s = noise(); const bf = ctx.createBiquadFilter(); bf.type = type; bf.frequency.value = freq; bf.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(bf); bf.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05); };
  return {
    start, tone,
    set(o) { if (!ctx) return; const t = ctx.currentTime; if (o.fire != null) fireG.gain.setTargetAtTime(o.fire * 0.22, t, 0.6); if (o.wind != null) windG.gain.setTargetAtTime(o.wind * 0.1, t, 1.2); if (o.pad != null) padG.gain.setTargetAtTime(o.pad * 0.04, t, 1.5); },
    click() { tone(1800, 0.01, 0.03); },
    crackle(dt, level) { if (ctx && Math.random() < dt * 10 * level) burst(0.04, 1500 + Math.random() * 2500, 0.1 * Math.random(), 'bandpass', 2); },
    step(surface) { if (surface === 'snow') burst(0.13, 2400, 0.05, 'highpass', 0.7); else burst(0.06, 300, 0.07, 'bandpass', 1.4); },
    blow() { burst(0.7, 1200, 0.12, 'highpass', 0.7); },
  };
})();

/* =====================================================================
 * Lights, time of day, weather
 * ===================================================================== */
const key = new THREE.DirectionalLight('#ffb070', 3);
key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
const sc = key.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 90;
G.scene.add(key); G.scene.add(key.target);
const hemi = new THREE.HemisphereLight('#9a8fc0', '#d8c0c8', 0.5); G.scene.add(hemi);
G.scene.fog = new THREE.Fog('#b48aa0', 30, 230);
const pathLights = [new THREE.PointLight('#ffa860', 0, 6, 2), new THREE.PointLight('#ffa860', 0, 6, 2)];
pathLights.forEach((l) => G.scene.add(l));
const MOON_DIR = new THREE.Vector3(-0.25, 0.62, 0.74).normalize();
const C = (h) => new THREE.Color(h);
const PAL = {
  keyCol: [C('#ffac6a'), C('#8ea6e8')], keyI: [3.2, 0.7],
  sky: [C('#9a94c8'), C('#22325a')], gnd: [C('#f0d2d0'), C('#1a2238')], hemiI: [1.7, 0.75],
  fog: [C('#c08e9c'), C('#0c1324')], exposure: [0.92, 1.3],
};
const tmpC = new THREE.Color();
function updateLighting(t, dt, focus) {
  STATE.tod = damp(STATE.tod, STATE.todTarget, 0.5, dt);
  const n = STATE.tod;
  G.SKY_UNI.uTod.value = n; G.SKY_UNI.uTime.value = t;
  G.sky.position.copy(G.camera.position);
  const dir = G.SUN_SET.clone().lerp(MOON_DIR, n).normalize();
  key.position.copy(focus).addScaledVector(dir, 40);
  key.target.position.copy(focus);
  key.color.copy(PAL.keyCol[0]).lerp(PAL.keyCol[1], n);
  key.intensity = lerp(PAL.keyI[0], PAL.keyI[1], n);
  hemi.color.copy(PAL.sky[0]).lerp(PAL.sky[1], n);
  hemi.groundColor.copy(PAL.gnd[0]).lerp(PAL.gnd[1], n);
  hemi.intensity = lerp(PAL.hemiI[0], PAL.hemiI[1], n) * (G.inside(focus.x, focus.z) ? 0.55 : 1);
  G.scene.fog.color.copy(PAL.fog[0]).lerp(PAL.fog[1], n);
  G.scene.fog.near = lerp(30, 20, n); G.scene.fog.far = lerp(230, 170, n);
  G.renderer.toneMappingExposure = lerp(PAL.exposure[0], PAL.exposure[1], n);
  const env = n > 0.5 ? G.envNight : G.envSunset; if (G.scene.environment !== env) G.scene.environment = env;
  MAT.glassOut.emissiveIntensity = lerp(0.5, 1.0, n);
  // Interior lights
  const fl = 0.82 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07 + Math.sin(t * 23.1) * 0.03;
  for (const L of G.LAMPS) { L.light.intensity = damp(L.light.intensity, L.on ? L.power * L.flick : 0, 14, dt); L.shade.material.emissiveIntensity = (L.light.intensity / L.power) * 1.2; }
  const F = G.FIRE, fp = F.on ? F.level : 0;
  F.light.intensity = damp(F.light.intensity, F.power * fp * fl, 12, dt);
  F.planes.forEach((p, i) => { p.visible = fp > 0.02; p.material.uniforms.uPower.value = fp; p.lookAt(G.camera.position.x, p.getWorldPosition(tmpV).y, G.camera.position.z); });
  G.CAKE.light.intensity = damp(G.CAKE.light.intensity, G.CAKE.lit ? 1.4 * fl : 0, 10, dt);
  G.CAKE.flames.forEach((f) => { f.visible = G.CAKE.lit; });
  G.MANTLE_LIGHT.intensity = 1.3 * fl;
  G.FLAMES.forEach((f, i) => { f.material.uniforms.uTime.value = t * 1.3 + i * 2.1; if (!F.planes.includes(f)) f.lookAt(G.camera.position); });
  G.PORCH_LAMP.intensity = lerp(4, 7, n) * (0.95 + Math.sin(t * 9) * 0.03);
  G.BENCH_LAMP.intensity = lerp(1.5, 3, n) * fl;
  // Path lanterns: two real lights on the nearest, glow pools on the rest.
  const near = G.PATH_LIGHTS.slice().sort((a, b) => Math.hypot(a.x - focus.x, a.z - focus.z) - Math.hypot(b.x - focus.x, b.z - focus.z));
  pathLights.forEach((l, i) => { const p = near[i]; if (!p) { l.intensity = 0; return; } l.position.set(p.x, p.y, p.z); l.intensity = lerp(2.5, 4, n); });
  G.poolMat.opacity = lerp(0.5, 0.9, n);
  Audio_ambience(focus, dt, fp);
}
const tmpV = new THREE.Vector3();
function Audio_ambience(focus, dt, fp) {
  const inside = G.inside(focus.x, focus.z);
  const dFire = Math.hypot(focus.x - 8, focus.z - 1);
  G.Audio.set({ fire: inside ? clamp(1.4 - dFire * 0.25, 0, 1) * fp : 0, wind: inside ? 0.15 : 0.6 + STATE.tod * 0.2, pad: 1 });
  if (inside) G.Audio.crackle(dt, fp * clamp(1.4 - dFire * 0.25, 0, 1));
}

/* ---------- snow ---------- */
let SNOW;
function snowSystem(n) {
  const pos = new Float32Array(n * 3), spd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = rand(-18, 18); pos[i * 3 + 1] = rand(0, 12); pos[i * 3 + 2] = rand(-18, 18); spd[i] = rand(0.3, 0.8); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('spd', new THREE.BufferAttribute(spd, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uPx: { value: 1 }, uLight: { value: new THREE.Color('#ffd6c0') } },
    vertexShader: `
      attribute float spd; uniform float uTime; uniform vec3 uCenter; uniform float uPx; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y - uTime * spd, 12.0);
        p.x += sin(uTime * 0.6 + position.z) * 0.3 + uTime * 0.15;
        p.z += cos(uTime * 0.45 + position.x) * 0.25;
        p.x = mod(p.x - uCenter.x + 18.0, 36.0) - 18.0 + uCenter.x;
        p.z = mod(p.z - uCenter.z + 18.0, 36.0) - 18.0 + uCenter.z;
        p.y += uCenter.y - 3.0;
        bool roof = (p.x > -0.6 && p.x < 11.6 && p.z > -0.6 && p.z < 5.1) || (p.x > 3.3 && p.x < 11.5 && p.z > 4.5 && p.z < 7.0 && p.y < 2.6);
        vA = roof ? 0.0 : 1.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = vA * 14.0 * uPx / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform vec3 uLight; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uLight, smoothstep(0.5, 0.05, d) * 0.85 * vA); }',
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; G.scene.add(pts);
  return pts;
}
/* ---------- chimney smoke ---------- */
const SMOKE = [];
function smokeSystem() {
  const tex = G.canvasTex(0, null, { w: 64, h: 64, draw: (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); } });
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#b8b0b8', transparent: true, depthWrite: false, opacity: 0 }));
    G.scene.add(s); SMOKE.push({ s, age: i * 0.35, life: 9 });
  }
}
function updateSmoke(dt) {
  for (const p of SMOKE) {
    p.age += dt; if (p.age > p.life) p.age -= p.life;
    const k = p.age / p.life;
    p.s.position.set(G.CHIMNEY.x + k * 3.5 + Math.sin(p.age * 0.7 + p.age) * 0.5, G.CHIMNEY.y + k * 5, G.CHIMNEY.z - k * 1.2);
    p.s.scale.setScalar(0.5 + k * 2.6);
    p.s.material.opacity = Math.sin(k * Math.PI) * 0.07;
    p.s.material.color.set(STATE.tod > 0.5 ? '#3a4058' : '#c4a8b0');
  }
}

/* =====================================================================
 * Post-processing
 * ===================================================================== */
let composer, bokeh, bloom, ssao, grade, fxaa;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.42 }, uGrain: { value: 0.022 }, uCA: { value: 0.0012 }, uBars: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uCA, uBars; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.0) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d*uCA).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d*uCA).b);
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      // Split-tone: cool shadows, warm highlights.
      c *= mix(vec3(0.9, 0.97, 1.08), vec3(1.07, 1.0, 0.9), smoothstep(0.05, 0.7, l));
      c = mix(vec3(l), c, 1.08);
      c *= 1.0 - uVig * smoothstep(0.3, 0.9, length(d * vec2(1.3, 1.0)));
      c += (h(vUv * 917.0) - 0.5) * uGrain;
      float bar = step(0.5 - uBars, abs(vUv.y - 0.5));
      c = mix(c, vec3(0.0), bar);
      gl_FragColor = vec4(c, 1.0);
    }`,
};
function buildPost() {
  composer = new THREE.EffectComposer(G.renderer);
  composer.addPass(new THREE.RenderPass(G.scene, G.camera));
  ssao = new THREE.SSAOPass(G.scene, G.camera, 2, 2);
  ssao.kernelRadius = 0.3; ssao.minDistance = 0.0006; ssao.maxDistance = 0.03;
  composer.addPass(ssao);
  bokeh = new THREE.BokehPass(G.scene, G.camera, { focus: 3, aperture: 0.004, maxblur: 0.008, width: 2, height: 2 });
  composer.addPass(bokeh);
  bloom = new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.55, 0.85);
  composer.addPass(bloom);
  grade = new THREE.ShaderPass(GradeShader); composer.addPass(grade);
  composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
  fxaa = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaa);
  G.post = { composer, bokeh, bloom, ssao, grade, fxaa, key, hemi };
}
G.applyQuality = () => {
  G.Q = G.PRESETS[G.qName];
  try { localStorage.setItem('cbs.base.quality', G.qName); } catch (e) { /* ignore */ }
  G.renderer.shadowMap.enabled = G.Q.shadows;
  key.castShadow = G.Q.shadows; key.shadow.mapSize.set(G.Q.shadowSize, G.Q.shadowSize);
  if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
  G.FIRE.light.castShadow = G.Q.ssao; G.FIRE.light.shadow.mapSize.set(512, 512); G.FIRE.light.shadow.bias = -0.004;
  ssao.enabled = G.Q.ssao; bokeh.enabled = G.Q.dof; bloom.strength = G.Q.bloom;
  G.MATS.forEach((m) => { m.needsUpdate = true; });
  if (SNOW) SNOW.geometry.setDrawRange(0, G.Q.snow);
  resize();
  document.querySelectorAll('#quality button').forEach((b) => b.classList.toggle('on', b.dataset.q === G.qName));
};
function resize() {
  const W = innerWidth, H = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, G.Q.dpr);
  G.renderer.setPixelRatio(dpr); G.renderer.setSize(W, H, false);
  composer.setPixelRatio(dpr); composer.setSize(W, H);
  G.camera.aspect = W / H; G.camera.updateProjectionMatrix();
  fxaa.material.uniforms.resolution.value.set(1 / (W * dpr), 1 / (H * dpr));
  if (SNOW) SNOW.material.uniforms.uPx.value = H * dpr / 900;
  bokeh.uniforms.aspect.value = W / H;
}
addEventListener('resize', () => composer && resize());

/* =====================================================================
 * Characters & collision
 * ===================================================================== */
const PLAYER = (G.PLAYER = { m: null, x: 0, y: 0, z: 0, yaw: Math.PI, speed: 0, phase: 0, r: 0.24, look: 0 });
const PARTNER = (G.PARTNER = { m: null, x: 0, y: 0, z: 0, yaw: Math.PI, speed: 0, phase: 0, r: 0.2, look: 0, mode: 'follow', script: null });
const head = (c) => ({ x: c.x, z: c.z, headY: c.y + c.m.userData.H * 0.93 - (c.sit > 0.5 ? 0.45 : 0) });
G.headPos = (c) => new THREE.Vector3(c.x, c.y + c.m.userData.H * 0.935 - (c.sit || 0) * (c.m.userData.hipY - ((c.seatY || 0.6) - c.y)), c.z);
function collide(c, ox, oz) {
  for (const b of G.COLL) {
    if (b.solidExterior) continue;
    const cx = clamp(c.x, b.x0, b.x1), cz = clamp(c.z, b.z0, b.z1);
    const dx = c.x - cx, dz = c.z - cz, d = Math.hypot(dx, dz);
    if (d < c.r) {
      if (d > 1e-5) { c.x = cx + dx / d * c.r; c.z = cz + dz / d * c.r; }
      else { const l = c.x - b.x0, r = b.x1 - c.x, t = c.z - b.z0, bb = b.z1 - c.z, m = Math.min(l, r, t, bb); if (m === l) c.x = b.x0 - c.r; else if (m === r) c.x = b.x1 + c.r; else if (m === t) c.z = b.z0 - c.r; else c.z = b.z1 + c.r; }
    }
  }
  if (!G.walkable(c.x, c.z)) { c.x = ox; c.z = oz; }
  // Can't climb onto the porch except by the steps.
  const fy = G.floorAt(c.x, c.z);
  if (fy - c.yFloor > 0.22 && !(c.x > G.PORCH.stepX0 && c.x < G.PORCH.stepX1)) { c.x = ox; c.z = oz; }
  c.yFloor = G.floorAt(c.x, c.z);
}
function moveChar(c, dx, dz) { const ox = c.x, oz = c.z; c.x += dx; c.z += dz; collide(c, ox, oz); }
/* ---------- navigation: grid A* over the real colliders ----------
 * Cells are 0.15 m. A cell is open when it is inside the walkable clearing and
 * far enough from every collider for a character to stand there. Moving
 * between neighbouring cells is refused when the floor height jumps (porch
 * edge), so routes onto the porch always use the steps.
 */
const NAV = { cs: 0.15, x0: -17, z0: -11, nx: 0, nz: 0, open: null, h: null };
const AGENT_R = 0.21;
function buildNav() {
  const N = NAV; N.nx = Math.ceil((30 - N.x0) / N.cs); N.nz = Math.ceil((42 - N.z0) / N.cs);
  const n = N.nx * N.nz; N.open = new Uint8Array(n); N.h = new Float32Array(n);
  const boxes = G.COLL.filter((b) => !b.solidExterior);
  for (let j = 0; j < N.nz; j++) for (let i = 0; i < N.nx; i++) {
    const x = N.x0 + (i + 0.5) * N.cs, z = N.z0 + (j + 0.5) * N.cs, k = j * N.nx + i;
    N.h[k] = G.floorAt(x, z);
    if (!G.walkable(x, z)) continue;
    let ok = true;
    for (const b of boxes) { if (x > b.x0 - AGENT_R && x < b.x1 + AGENT_R && z > b.z0 - AGENT_R && z < b.z1 + AGENT_R) { const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1); if (Math.hypot(dx, dz) < AGENT_R) { ok = false; break; } } }
    N.open[k] = ok ? 1 : 0;
  }
}
const cellOf = (x, z) => [Math.floor((x - NAV.x0) / NAV.cs), Math.floor((z - NAV.z0) / NAV.cs)];
const cellPos = (i, j) => ({ x: NAV.x0 + (i + 0.5) * NAV.cs, z: NAV.z0 + (j + 0.5) * NAV.cs });
const inGrid = (i, j) => i >= 0 && j >= 0 && i < NAV.nx && j < NAV.nz;
const isOpen = (i, j) => inGrid(i, j) && NAV.open[j * NAV.nx + i] === 1;
function canStep(i0, j0, i1, j1) { return isOpen(i1, j1) && Math.abs(NAV.h[j1 * NAV.nx + i1] - NAV.h[j0 * NAV.nx + i0]) < 0.13; }
function nearestOpen(i, j, maxR = 14) {
  if (isOpen(i, j)) return [i, j];
  for (let r = 1; r <= maxR; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    if (isOpen(i + di, j + dj)) return [i + di, j + dj];
  }
  return null;
}
function lineClear(a, b) {
  // Walk the segment in half-cell steps; every sample must be open and level with the last.
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / (NAV.cs * 0.5)));
  let [pi, pj] = cellOf(a.x, a.z);
  for (let s = 1; s <= n; s++) {
    const [i, j] = cellOf(a.x + (b.x - a.x) * s / n, a.z + (b.z - a.z) * s / n);
    if (i === pi && j === pj) continue;
    if (!canStep(pi, pj, i, j)) return false;
    pi = i; pj = j;
  }
  return true;
}
let heapK, heapF, gScore, came, closed;
function findPath(sx, sz, tx, tz) {
  if (!NAV.open) buildNav();
  const n = NAV.nx * NAV.nz;
  if (!gScore) { gScore = new Float32Array(n); came = new Int32Array(n); closed = new Uint8Array(n); heapK = new Int32Array(n); heapF = new Float32Array(n); }
  const s = nearestOpen(...cellOf(sx, sz), 6), t = nearestOpen(...cellOf(tx, tz));
  if (!s || !t) return null;
  const goal = t[1] * NAV.nx + t[0], start = s[1] * NAV.nx + s[0];
  gScore.fill(Infinity); closed.fill(0); came.fill(-1);
  let hn = 0;
  const push = (k, f) => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (heapF[p] <= f) break; heapK[i] = heapK[p]; heapF[i] = heapF[p]; i = p; } heapK[i] = k; heapF[i] = f; };
  const pop = () => { const top = heapK[0]; const k = heapK[--hn], f = heapF[hn]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= hn) break; if (c + 1 < hn && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= f) break; heapK[i] = heapK[c]; heapF[i] = heapF[c]; i = c; } heapK[i] = k; heapF[i] = f; return top; };
  const hEst = (i, j) => { const dx = Math.abs(i - t[0]), dz = Math.abs(j - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  gScore[start] = 0; push(start, hEst(s[0], s[1]));
  let found = false, iter = 0;
  while (hn && iter++ < 60000) {
    const k = pop();
    if (closed[k]) continue;
    if (k === goal) { found = true; break; }
    closed[k] = 1;
    const i = k % NAV.nx, j = (k / NAV.nx) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (!canStep(i, j, ni, nj)) continue;
      if (di && dj && (!canStep(i, j, ni, j) || !canStep(i, j, i, nj))) continue;   // no corner cutting
      const nk = nj * NAV.nx + ni, g = gScore[k] + (di && dj ? 1.414 : 1);
      if (g < gScore[nk]) { gScore[nk] = g; came[nk] = k; push(nk, g + hEst(ni, nj)); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let k = goal; k !== -1 && k !== start; k = came[k]) cells.push(cellPos(k % NAV.nx, (k / NAV.nx) | 0));
  cells.reverse();
  // String-pull: keep only the points where the straight line would be blocked.
  const pts = [], startP = { x: sx, z: sz };
  let anchor = startP;
  for (let i = 0; i < cells.length; i++) {
    const next = cells[i + 1];
    if (next && lineClear(anchor, next)) continue;
    pts.push(cells[i]); anchor = cells[i];
  }
  const last = isOpen(...cellOf(tx, tz)) ? { x: tx, z: tz } : cells[cells.length - 1] || { x: tx, z: tz };
  if (!pts.length || Math.hypot(pts[pts.length - 1].x - last.x, pts[pts.length - 1].z - last.z) > 0.01) pts.push(last);
  return pts;
}
G.findPath = findPath; G.NAV = NAV;
/* Steer along a cached path to (tx, tz). Re-plans when the target moves, every
 * so often, and when the character stops making progress. Returns true on arrival. */
function steer(c, tx, tz, speed, dt, stopAt = 0.06) {
  const nav = c.nav || (c.nav = { path: null, tx: 1e9, tz: 1e9, age: 9, stuckT: 0, lastD: 1e9, fail: 0 });
  nav.age += dt;
  const dGoal = Math.hypot(tx - c.x, tz - c.z);
  if (dGoal < stopAt) { c.speed = damp(c.speed, 0, 10, dt); nav.path = null; return true; }
  if (!nav.path || Math.hypot(tx - nav.tx, tz - nav.tz) > 0.4 || nav.age > 1.5) {
    nav.path = findPath(c.x, c.z, tx, tz); nav.tx = tx; nav.tz = tz; nav.age = 0;
    if (!nav.path) nav.fail += 1; else nav.fail = 0;
  }
  let w = { x: tx, z: tz };
  if (nav.path) {
    while (nav.path.length > 1 && Math.hypot(nav.path[0].x - c.x, nav.path[0].z - c.z) < 0.18) nav.path.shift();
    w = nav.path[0];
  }
  const dx = w.x - c.x, dz = w.z - c.z, l = Math.hypot(dx, dz) || 1;
  const slow = nav.path && nav.path.length === 1 ? clamp(l / 0.5, 0.35, 1) : 1;
  c.speed = damp(c.speed, speed * slow, 5, dt);
  c.yaw = angDamp(c.yaw, Math.atan2(dx, dz), 9, dt);
  // Move along the waypoint direction (not the smoothed facing) so corners are taken cleanly.
  moveChar(c, dx / l * c.speed * dt, dz / l * c.speed * dt);
  // Stuck: little progress toward the goal for a while -> re-plan now; if it persists, nudge to the next open cell.
  if (nav.lastD - dGoal < 0.15 * dt && c.speed > 0.2) nav.stuckT += dt; else nav.stuckT = Math.max(0, nav.stuckT - dt * 2);
  nav.lastD = dGoal;
  if (nav.stuckT > 0.8) { nav.path = null; nav.stuckT = 0; nav.unstuck = (nav.unstuck || 0) + 1;
    if (nav.unstuck > 2) { const o = nearestOpen(...cellOf(c.x, c.z), 4); if (o) { const p = cellPos(o[0], o[1]); c.x = p.x; c.z = p.z; c.yFloor = G.floorAt(c.x, c.z); } nav.unstuck = 0; } }
  return false;
}
function placeChar(c, x, z, yaw) { c.x = x; c.z = z; c.yaw = yaw; c.yFloor = G.floorAt(x, z); c.y = c.yFloor; c.speed = 0; }

/* =====================================================================
 * Camera director
 * ===================================================================== */
const CAM = (G.CAM = { yaw: 0, pitch: 0.2, zoom: 1, pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 42, focus: 3, aperture: 0.003, shot: null, cut: true, lastDrag: -99, idle: 0, bars: 0 });
const ray = new THREE.Raycaster();
function blocked(from, to) {
  const d = to.clone().sub(from), len = d.length();
  ray.set(from, d.normalize()); ray.far = len;
  return ray.intersectObjects(G.CAMBLOCK, false).length > 0;
}
function clampToWalls(target, desired) {
  const d = desired.clone().sub(target), len = d.length();
  ray.set(target, d.clone().normalize()); ray.far = len + 0.25;
  const hit = ray.intersectObjects(G.CAMBLOCK, false)[0];
  if (hit) return target.clone().addScaledVector(d.normalize(), Math.max(0.3, hit.distance - 0.2));
  return desired;
}
/* Shots return { pos, look, fov, focus, aperture }. */
const SHOTS = {
  follow(t) {
    const p = PLAYER, inside = G.inside(p.x, p.z) || G.underRoof(p.x, p.z);
    const dist = (inside ? 1.75 : 2.9) * CAM.zoom, height = inside ? 1.58 : 1.72;
    const tgt = new THREE.Vector3(p.x, p.y + height - (p.sit || 0) * 0.45, p.z);
    const right = new THREE.Vector3(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw));
    tgt.addScaledVector(right, inside ? 0.32 : 0.42);
    const pitch = CAM.pitch + (inside ? 0.06 : 0);
    const dir = new THREE.Vector3(Math.sin(CAM.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(CAM.yaw) * Math.cos(pitch));
    let pos = clampToWalls(tgt, tgt.clone().addScaledVector(dir, dist));
    pos.y = Math.max(pos.y, G.floorAt(pos.x, pos.z) + 0.35);
    if (G.inside(pos.x, pos.z)) pos.y = Math.min(pos.y, G.CAB.wallH - 0.15);
    const lookAhead = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)).multiplyScalar(p.speed * 0.25);
    return { pos, look: tgt.clone().add(lookAhead), fov: inside ? 50 : 46, focus: pos.distanceTo(tgt) + 0.2, aperture: 0.0025 };
  },
  ots(subject, fg, side0 = 1) {
    // Over the foreground character's shoulder, framing the subject's face.
    const hs = G.headPos(subject), hf = G.headPos(fg);
    const d = new THREE.Vector3(hs.x - hf.x, 0, hs.z - hf.z); const dist = Math.max(0.5, d.length()); d.normalize();
    const side = new THREE.Vector3(d.z, 0, -d.x);
    for (const sgn of [side0, -side0]) for (const back of [0.75, 0.5, 0.32]) {
      const pos = hf.clone().addScaledVector(d, -back).addScaledVector(side, sgn * 0.3); pos.y = hf.y + 0.02;
      if (!blocked(hs, pos)) return { pos, look: hs.clone().add(new THREE.Vector3(0, -0.02, 0)), fov: 30, focus: pos.distanceTo(hs), aperture: 0.016 };
    }
    return SHOTS.twoShot();
  },
  twoShot(low = true) {
    const a = G.headPos(PLAYER), b = G.headPos(PARTNER), m = a.clone().add(b).multiplyScalar(0.5);
    const across = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    let f = new THREE.Vector3(-across.z, 0, across.x);
    const fwd = new THREE.Vector3(Math.sin(PLAYER.yaw) + Math.sin(PARTNER.yaw), 0, Math.cos(PLAYER.yaw) + Math.cos(PARTNER.yaw));
    if (fwd.lengthSq() > 0.01 && f.dot(fwd) < 0) f.negate();
    for (const sgn of [1, -1]) {
      const ff = f.clone().multiplyScalar(sgn);
      const pos = m.clone().addScaledVector(ff, 1.5); pos.y = m.y - (low ? 0.35 : 0.05);
      if (!blocked(m, pos)) return { pos, look: m.clone().add(new THREE.Vector3(0, -0.12, 0)), fov: 36, focus: pos.distanceTo(m), aperture: 0.012 };
    }
    return SHOTS.follow();
  },
  rearPair(dist = 2.4, up = 0.25, lookFar = 8, fov = 48) {
    const a = PLAYER, b = PARTNER, m = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + 1.4, (a.z + b.z) / 2);
    const f = new THREE.Vector3(Math.sin(a.yaw) + Math.sin(b.yaw), 0, Math.cos(a.yaw) + Math.cos(b.yaw)).normalize();
    const pos = m.clone().addScaledVector(f, -dist); pos.y += up;
    const look = m.clone().addScaledVector(f, lookFar); look.y += 0.6;
    return { pos, look, fov, focus: dist + 0.3, aperture: 0.004 };
  },
};
G.SHOTS = SHOTS;
let handT = 0;
function updateCamera(dt, t) {
  const c = CAM;
  if (G.keys.has('KeyZ') || G.keys.has('Comma')) { c.yaw += dt * 1.6; c.lastDrag = t; }
  if (G.keys.has('KeyC') || G.keys.has('Period')) { c.yaw -= dt * 1.6; c.lastDrag = t; }
  let s;
  if (c.shot) s = c.shot(t);
  else {
    // Exploration: recentre behind the player while moving; drift toward an
    // over-the-shoulder framing of Partner when standing still near them.
    if (PLAYER.speed > 0.3 && t - c.lastDrag > 2.5) c.yaw = angDamp(c.yaw, PLAYER.yaw + Math.PI, 1.2 * clamp(PLAYER.speed / 1.5, 0.3, 1.5), dt);
    c.idle = PLAYER.speed < 0.1 ? c.idle + dt : 0;
    s = SHOTS.follow(t);
    const dP = Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
    if (c.idle > 2.2 && t - c.lastDrag > 4 && dP < 3.2 && dP > 0.6 && PARTNER.sit < 0.5) {
      const o = SHOTS.ots(PARTNER, PLAYER, 1), k = G.smooth(2.2, 4.5, c.idle);
      s = { pos: s.pos.clone().lerp(o.pos, k), look: s.look.clone().lerp(o.look, k), fov: lerp(s.fov, o.fov + 8, k), focus: lerp(s.focus, o.focus, k), aperture: lerp(s.aperture, o.aperture * 0.8, k) };
    }
  }
  const k = c.cut ? 1 : 1 - Math.exp(-(c.shot ? 3 : 6) * dt);
  c.cut = false;
  c.pos.lerp(s.pos, k); c.look.lerp(s.look, k);
  c.fov = lerp(c.fov, s.fov, k); c.focus = lerp(c.focus, s.focus, k); c.aperture = lerp(c.aperture, s.aperture, k);
  // Subtle handheld drift.
  handT += dt;
  const hx = Math.sin(handT * 0.9) * 0.006 + Math.sin(handT * 2.3) * 0.003, hy = Math.sin(handT * 1.3 + 1) * 0.005 + Math.sin(handT * 3.1) * 0.002;
  G.camera.position.copy(c.pos).add(new THREE.Vector3(hx, hy, 0));
  G.camera.lookAt(c.look.x + hx * 0.5, c.look.y + hy * 0.5, c.look.z);
  const fov = G.camera.aspect < 0.8 ? c.fov * 1.35 : c.fov;
  if (Math.abs(G.camera.fov - fov) > 0.01) { G.camera.fov = fov; G.camera.updateProjectionMatrix(); }
  if (bokeh) { bokeh.uniforms.focus.value = c.focus; bokeh.uniforms.aperture.value = c.aperture; }
  c.bars = damp(c.bars, c.shot && !G.MOBILE ? 0.06 : 0, 4, dt);
  grade.uniforms.uBars.value = c.bars;
}
function setShot(fn, cut = true) { CAM.shot = fn; CAM.cut = cut; }
function releaseCamera() { CAM.shot = null; CAM.cut = false; CAM.yaw = PLAYER.yaw + Math.PI; CAM.lastDrag = -99; }
G.setShot = setShot; G.releaseCamera = releaseCamera;

/* =====================================================================
 * Input
 * ===================================================================== */
const keys = (G.keys = new Set()), pressed = new Set();
addEventListener('keydown', (e) => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); G.Audio.start(); if (e.code === 'Backquote') toggleStats(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const hit = (...c) => c.some((k) => pressed.has(k));
let drag = null;
G.canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { G.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } G.Audio.start(); });
G.canvas.addEventListener('pointermove', (e) => { if (!drag || drag.id !== e.pointerId || CAM.shot) return; CAM.yaw -= (e.clientX - drag.x) * 0.006; CAM.pitch = clamp(CAM.pitch + (e.clientY - drag.y) * 0.004, -0.2, 0.85); drag.x = e.clientX; drag.y = e.clientY; CAM.lastDrag = performance.now() / 1000; });
G.canvas.addEventListener('pointerup', () => { drag = null; });
G.canvas.addEventListener('wheel', (e) => { e.preventDefault(); CAM.zoom = clamp(CAM.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.6, 1.8); }, { passive: false });
const stick = { x: 0, y: 0, on: false };
(() => {
  const zone = $('stickzone'), knob = $('knob'), base = $('stick');
  let id = null, ox = 0, oy = 0;
  zone.addEventListener('pointerdown', (e) => { id = e.pointerId; ox = e.clientX; oy = e.clientY; base.style.left = (ox - 55) + 'px'; base.style.top = (oy - 55) + 'px'; base.classList.add('on'); zone.setPointerCapture(id); stick.on = true; G.Audio.start(); e.preventDefault(); });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy); if (l > 45) { dx *= 45 / l; dy *= 45 / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; stick.x = dx / 45; stick.y = dy / 45; });
  const end = (e) => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; base.classList.remove('on'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  $('btn-use').addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add('KeyE'); });
  $('btn-hug').addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add('KeyQ'); });
})();

/* =====================================================================
 * Dialogue (cinematic subtitles) with automatic shot selection
 * ===================================================================== */
const DLG = { q: [], cur: null, shown: 0, t: 0, auto: false };
G.say = (who, text, o = {}) => new Promise((res) => DLG.q.push({ who, text, res, o }));
const busy = () => !!DLG.cur || DLG.q.length > 0 || STATE.busy;
function pickShotFor(who, o) {
  if (o.shot === 'keep') return;
  if (o.shot) { setShot(o.shot, o.cut !== false); return; }
  const d = Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
  if (d > 3.6 || STATE.sceneShot) return;
  if (who === 'partner') setShot(() => SHOTS.ots(PARTNER, PLAYER, 1));
  else if (who === 'player') setShot(() => SHOTS.ots(PLAYER, PARTNER, -1));
  else setShot(() => SHOTS.twoShot(), true);
}
function updateDialogue(dt) {
  const box = $('subs');
  if (!DLG.cur && DLG.q.length) {
    DLG.cur = DLG.q.shift(); DLG.shown = 0; DLG.t = 0;
    box.className = 'show ' + (DLG.cur.who ? 'who-' + DLG.cur.who : 'narr');
    $('who').textContent = DLG.cur.who === 'partner' ? 'Partner' : DLG.cur.who === 'player' ? 'You' : '';
    pickShotFor(DLG.cur.who, DLG.cur.o);
  }
  if (!DLG.cur) { if (box.className !== '') { box.className = ''; if (!STATE.sceneShot && CAM.shot) releaseCamera(); } return; }
  const cur = DLG.cur;
  DLG.t += dt; DLG.shown = Math.min(cur.text.length, DLG.shown + dt * 42);
  $('line').textContent = cur.text.slice(0, Math.floor(DLG.shown));
  const auto = cur.o.auto && DLG.t > cur.o.auto;
  if (auto || ((hit('KeyE', 'Space', 'Enter') || DLG.click) && DLG.t > 0.15)) {
    DLG.click = false; pressed.delete('KeyE'); pressed.delete('Space'); pressed.delete('Enter');
    if (!auto && DLG.shown < cur.text.length) DLG.shown = cur.text.length;
    else { DLG.cur = null; cur.res(); }
  }
}
$('subs').addEventListener('pointerdown', (e) => { e.preventDefault(); DLG.click = true; });
function bark(text, dur = 2.6) { PARTNER.bark = { text, t: dur }; }
function hint(text, dur = 5) { const h = $('hint'); h.textContent = text; h.classList.add('show'); clearTimeout(hint._t); hint._t = setTimeout(() => h.classList.remove('show'), dur * 1000); }
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
// Fade to black, run the setup, fade back in: a cinematic cut that also skips fiddly walking.
async function cutTo(setup) { $('fade').classList.add('on'); await wait(0.65); setup(); CAM.cut = true; await wait(0.15); $('fade').classList.remove('on'); }

/* =====================================================================
 * Partner
 * ===================================================================== */
function partnerAI(dt, t) {
  const p = PARTNER;
  if (p.bark) { p.bark.t -= dt; if (p.bark.t <= 0) p.bark = null; }
  if (p.script) {
    const s = p.script;
    if (steer(p, s.x, s.z, s.speed || 1.2, dt, 0.08)) { p.script = null; if (s.yaw != null) p.yaw = s.yaw; s.res && s.res(); }
    p.lookAt = null;
    return;
  }
  if (p.mode === 'seated') { p.speed = 0; p.lookAt = head(PLAYER); return; }
  if (p.mode === 'follow') {
    const side = new THREE.Vector3(Math.cos(PLAYER.yaw), 0, -Math.sin(PLAYER.yaw));
    let tx = PLAYER.x - side.x * 0.75 - Math.sin(PLAYER.yaw) * 0.35, tz = PLAYER.z - side.z * 0.75 - Math.cos(PLAYER.yaw) * 0.35;
    if (!NAV.open) buildNav();
    { const o = nearestOpen(...cellOf(tx, tz), 6); if (o && Math.hypot(cellPos(o[0], o[1]).x - PLAYER.x, cellPos(o[0], o[1]).z - PLAYER.z) < 1.6) { const q = cellPos(o[0], o[1]); tx = q.x; tz = q.z; } else { tx = PLAYER.x; tz = PLAYER.z; } }
    const d = Math.hypot(PLAYER.x - p.x, PLAYER.z - p.z);
    if (d > 1.15 || (p.speed > 0.05 && Math.hypot(tx - p.x, tz - p.z) > 0.25)) steer(p, tx, tz, clamp(d * 1.1, 0.8, PLAYER.speed > 2 ? 3.0 : 1.65), dt, 0.2);
    else { p.speed = damp(p.speed, 0, 8, dt); p.yaw = angDamp(p.yaw, Math.atan2(PLAYER.x - p.x, PLAYER.z - p.z), 2, dt); }
    // Lost entirely (no route for a few seconds and far behind): catch up quietly behind the player.
    if (p.nav && p.nav.fail > 3 && d > 6) { const o = nearestOpen(...cellOf(PLAYER.x - Math.sin(PLAYER.yaw) * 1.2, PLAYER.z - Math.cos(PLAYER.yaw) * 1.2), 8); if (o) { const q = cellPos(o[0], o[1]); placeChar(p, q.x, q.z, PLAYER.yaw); p.nav = null; } }
    p.lookAt = head(PLAYER);
  }
}
const walkTo = (c, x, z, speed, yaw) => new Promise((res) => { c.script = { x, z, speed, yaw, res }; });
G.walkTo = walkTo;

/* =====================================================================
 * Story beats
 * ===================================================================== */
const Story = (G.Story = {
  async intro() {
    STATE.busy = true; STATE.sceneShot = true;
    const z0 = 27;
    placeChar(PLAYER, G.pathX(z0) + 0.35, z0, Math.PI); placeChar(PARTNER, G.pathX(z0) - 0.45, z0 - 0.4, Math.PI);
    PLAYER.script = { x: G.pathX(19) + 0.35, z: 19, speed: 1.05 };
    PARTNER.script = { x: G.pathX(18.6) - 0.45, z: 18.6, speed: 1.05 };
    setShot(() => SHOTS.rearPair(2.6, 0.15, 12, 46));
    await G.say('partner', 'Look. Every window’s still glowing. We left all the lights on.', { shot: 'keep', auto: 4.2 });
    await G.say('player', 'You left all the lights on.', { shot: 'keep', auto: 2.6 });
    await G.say('partner', 'We did. It’s your birthday, so the cabin’s mine now. Those are the rules.', { shot: 'keep', auto: 4.2 });
    await new Promise((r) => { const chk = () => (!PLAYER.script ? r() : setTimeout(chk, 100)); chk(); });
    STATE.sceneShot = false; STATE.busy = false;
    PARTNER.mode = 'follow';
    releaseCamera();
    hint(G.MOBILE ? 'Drag on the left to walk; drag on the right to look. Use to interact, ♥ to hug.' : 'WASD to walk, Shift to run. Drag to look, scroll to zoom. E to interact, Q to hug.', 8);
    STATE.watchDoor = true;
  },
  async cake() {
    if (!G.CAKE.lit) { G.say(null, '(One slice missing. You didn’t cut it.)'); return; }
    STATE.busy = true;
    PARTNER.mode = 'script';
    const cx = G.CAKE.g.position.x, cz = G.CAKE.g.position.z;
    await walkTo(PARTNER, cx + 0.15, cz + 0.85, 1.3, Math.PI);
    PARTNER.mode = 'follow'; STATE.busy = false;
    const cakeShot = () => { const p = new THREE.Vector3(cx + 0.55, 0.78, cz + 0.7), l = new THREE.Vector3(cx, 0.62, cz); return { pos: p, look: l, fov: 34, focus: p.distanceTo(l), aperture: 0.03 }; };
    await G.say(null, '(Five candles. Somebody counted very carefully.)', { shot: cakeShot });
    await G.say('partner', 'Wait. Make a wish first. A good one. Not a boring one.');
    await G.say('player', 'What counts as boring?');
    await G.say('partner', '“More sleep.” “A new kettle.” Anything you’d actually say out loud.');
    G.Audio.blow(); G.CAKE.lit = false;
    await G.say(null, '(You blow them out. All five, first try.)', { shot: cakeShot });
    await G.say('partner', 'Happy birthday, you.');
    STATE.cakeDone = true;
  },
  async cuddle() {
    if (STATE.cuddled) { G.say(null, '(The sofa still remembers the shape of both of you.)'); return; }
    STATE.busy = true; STATE.sceneShot = true;
    const S = G.SOFA;
    const bl = G.CUDDLE_BLANKET;
    await cutTo(() => {
      for (const [c, x] of [[PLAYER, S.x + 0.35], [PARTNER, S.x - 0.25]]) { c.x = x; c.z = S.z - 0.08; c.y = c.yFloor = 0; c.yaw = Math.PI; c.seatY = S.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; }
      PARTNER.mode = 'seated'; PARTNER.script = null;
      bl.visible = true; bl.position.set(S.x + 0.05, 0.69, S.z - 0.2); bl.rotation.set(-Math.PI / 2 + 0.18, 0, 0); bl.scale.set(0.95, 0.75, 1);
      setShot(() => { const pos = new THREE.Vector3(S.x - 1.05, 1.22, S.z - 1.55), look = new THREE.Vector3(S.x + 0.02, 0.98, S.z - 0.05); return { pos, look, fov: 34, focus: pos.distanceTo(look), aperture: 0.012 }; });
    });
    await wait(1.2);
    PARTNER.tiltTarget = -0.32; PARTNER.leanTarget = 0.12; PARTNER.lidsClosed = true;
    await G.say(null, '(One blanket, two people, and the fire doing all the talking.)', { shot: 'keep' });
    await G.say('partner', 'Don’t move. You’re the perfect height for this.', { shot: 'keep' });
    await G.say('player', 'I have to move eventually.', { shot: 'keep' });
    await G.say('partner', 'Eventually is a whole word away.', { shot: 'keep' });
    await wait(1.5);
    PARTNER.tiltTarget = 0; PARTNER.leanTarget = 0; PARTNER.lidsClosed = false;
    bl.visible = false;
    for (const c of [PLAYER, PARTNER]) { c.sitTarget = 0; c.z = S.z - 0.75; }
    PARTNER.x = S.x - 0.6;
    PARTNER.mode = 'follow';
    STATE.cuddled = true; STATE.busy = false; STATE.sceneShot = false;
    releaseCamera();
    hint('The bench on the porch has the best view of the sky.', 6);
  },
  async porch() {
    if (STATE.porchDone) { STATE.todTarget = STATE.todTarget > 0.5 ? 0 : 1; return; }
    STATE.busy = true; STATE.sceneShot = true;
    const B = G.BENCH;
    const rear = () => { const pos = new THREE.Vector3(B.x + 0.05, 1.2, B.z - 0.62), look = new THREE.Vector3(B.x - 0.3, 2.4, B.z + 12); return { pos, look, fov: 62, focus: 1.0, aperture: 0.005 }; };
    await cutTo(() => {
      for (const [c, x] of [[PLAYER, B.x + 0.38], [PARTNER, B.x - 0.38]]) { c.x = x; c.z = B.z + 0.02; c.y = c.yFloor = 0; c.yaw = 0; c.seatY = B.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; }
      PARTNER.mode = 'seated'; PARTNER.script = null;
      setShot(rear);
    });
    STATE.todTarget = 1;
    await wait(2.5);
    await G.say(null, '(The sun goes, and then all at once there are more stars than sky.)', { shot: 'keep' });
    PARTNER.tiltTarget = -0.25;
    await G.say('partner', 'Pick one. That one’s yours. Happy birthday.', { shot: 'keep' });
    await G.say('player', 'Which one?', { shot: 'keep' });
    await G.say('partner', 'The bright one. Obviously. I’m not giving you a dim one on your birthday.', { shot: 'keep' });
    await wait(1.5);
    $('endcard').classList.add('show');
    STATE.porchDone = true;
  },
  closeEnd() {
    $('endcard').classList.remove('show');
    PARTNER.tiltTarget = 0;
    for (const c of [PLAYER, PARTNER]) { c.sitTarget = 0; c.z = G.BENCH.z + 0.55; }
    PARTNER.mode = 'follow'; STATE.busy = false; STATE.sceneShot = false;
    releaseCamera();
  },
});
async function hug() {
  if (busy() || Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z) > 1.4 || PARTNER.sit > 0.2) return;
  STATE.busy = true;
  const a = Math.atan2(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
  PLAYER.yaw = a; PARTNER.yaw = a + Math.PI; PARTNER.speed = 0;
  const mx = (PLAYER.x + PARTNER.x) / 2, mz = (PLAYER.z + PARTNER.z) / 2;
  PARTNER.x = mx + Math.sin(a) * 0.17; PARTNER.z = mz + Math.cos(a) * 0.17; PLAYER.x = mx - Math.sin(a) * 0.17; PLAYER.z = mz - Math.cos(a) * 0.17;
  STATE.hugging = true; PARTNER.lidsClosed = true; PARTNER.tiltTarget = -0.2;
  setShot(() => { const m = G.headPos(PARTNER); const side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)); const pos = m.clone().addScaledVector(side, 0.9).add(new THREE.Vector3(Math.sin(a) * 0.5, -0.12, Math.cos(a) * 0.5)); return { pos, look: m, fov: 32, focus: pos.distanceTo(m), aperture: 0.018 }; });
  bark(['Mm. Hi.', 'You’re so warm. It’s unfair.', 'Ten out of ten hug.'][Math.floor(Math.random() * 3)]);
  await wait(2.6);
  STATE.hugging = false; PARTNER.lidsClosed = false; PARTNER.tiltTarget = 0; STATE.busy = false;
  releaseCamera();
}

/* =====================================================================
 * Per-frame
 * ===================================================================== */
function nearest() {
  let best = null, bd = 1e9;
  const fx = Math.sin(PLAYER.yaw), fz = Math.cos(PLAYER.yaw);
  for (const it of G.INTER) {
    const dx = it.pos[0] - PLAYER.x, dz = it.pos[2] - PLAYER.z, d = Math.hypot(dx, dz);
    if (d > it.r) continue;
    const s = d - ((dx * fx + dz * fz) / (d || 1)) * 0.4;
    if (s < bd) { bd = s; best = it; }
  }
  return best;
}
let stepT = 0;
function step(dt, t) {
  updateDialogue(dt);
  let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let iy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (stick.on) { ix = stick.x; iy = stick.y; }
  const free = !busy() && !PLAYER.script && (PLAYER.sit || 0) < 0.05;
  if (!free) ix = iy = 0;
  const l = Math.hypot(ix, iy);
  if (PLAYER.script) {
    const s = PLAYER.script;
    if (steer(PLAYER, s.x, s.z, s.speed || 1.2, dt, 0.08)) { PLAYER.script = null; s.res && s.res(); }
  } else {
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || (stick.on && l > 0.95);
    const target = l > 0.05 ? (run ? 3.1 : 1.5) * Math.min(1, l) : 0;
    PLAYER.speed = damp(PLAYER.speed, target, 7, dt);
    if (l > 0.05) {
      const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
      PLAYER.yaw = angDamp(PLAYER.yaw, Math.atan2(ix * cy + iy * sy, -ix * sy + iy * cy), 9, dt);
    }
    if (PLAYER.speed > 0.01) moveChar(PLAYER, Math.sin(PLAYER.yaw) * PLAYER.speed * dt, Math.cos(PLAYER.yaw) * PLAYER.speed * dt);
  }
  partnerAI(dt, t);
  for (const c of [PLAYER, PARTNER]) {
    c.y = damp(c.y, c.yFloor != null ? c.yFloor : G.floorAt(c.x, c.z), 14, dt);
    c.sit = damp(c.sit || 0, c.sitTarget || 0, 5, dt);
    c.tilt = damp(c.tilt || 0, c.tiltTarget || 0, 3, dt);
    c.lean = damp(c.lean || 0, c.leanTarget || 0, 3, dt);
    c.hug = damp(c.hug || 0, STATE.hugging ? 1 : 0, 7, dt);
    G.animate(c, dt, t);
    const lids = c.m.userData.lids;
    if (lids) { const blink = (Math.sin(t * 0.9 + c.x * 3) > 0.995) || c.lidsClosed; lids.forEach((ld) => { ld.position.y = (blink ? 0.0085 : 0.0135) * c.m.userData.k; ld.scale.y = (blink ? 0.0125 : 0.0072) * c.m.userData.k; }); }
  }
  PLAYER.lookAt = Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z) < 3 ? head(PARTNER) : null;
  // Footsteps
  if (PLAYER.speed > 0.4) { stepT -= dt * PLAYER.speed / 1.5; if (stepT <= 0) { stepT = 0.42; G.Audio.step(G.inside(PLAYER.x, PLAYER.z) || PLAYER.yFloor > -0.05 ? 'wood' : 'snow'); } }
  // Interaction prompt
  const it = free ? nearest() : null;
  const nearP = free && Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z) < 1.4 && PARTNER.sit < 0.2;
  let html = '';
  if (it) html += `<span class="key">${G.MOBILE ? 'Use' : 'E'}</span>${typeof it.label === 'function' ? it.label() : it.label}`;
  if (nearP) html += `${html ? '<span class="sep"></span>' : ''}<span class="key">${G.MOBILE ? '♥' : 'Q'}</span>Hug`;
  const pr = $('prompt'); if (pr._h !== html) { pr._h = html; pr.innerHTML = html; pr.classList.toggle('hidden', !html); }
  if (it && hit('KeyE', 'Space', 'Enter')) { pressed.clear(); it.act(); }
  else if (nearP && hit('KeyQ', 'KeyF')) hug();
  if (hit('KeyN')) STATE.todTarget = STATE.todTarget > 0.5 ? 0 : 1;
  if (STATE.watchDoor && G.inside(PLAYER.x, PLAYER.z)) { STATE.watchDoor = false; bark('Cake first. Then the sofa. Then the stars. I made a schedule.', 4); }
  if (STATE.watchDoor && PLAYER.z < 8.5 && !STATE.porchBark) { STATE.porchBark = true; bark('Inside, inside. My nose has stopped working.', 3); }
}
function bubble(dt) {
  const el = $('bubble'), c = PARTNER;
  if (!c.bark || !STATE.started) { el.classList.remove('show'); return; }
  const v = G.headPos(c).add(new THREE.Vector3(0, 0.3, 0)).project(G.camera);
  if (v.z > 1) { el.classList.remove('show'); return; }
  el.textContent = c.bark.text;
  el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  el.classList.add('show');
}

/* ---------- title: establishing crane shot ---------- */
function titleShot(t) {
  const k = (t * 0.025) % 1, e = 0.5 - Math.cos(k * Math.PI * 2) * 0.5;
  const pos = new THREE.Vector3(lerp(3.5, 8.5, e), lerp(5.2, 2.0, e), lerp(30, 21, e));
  const look = new THREE.Vector3(6.5, lerp(3.0, 2.2, e), 2);
  return { pos, look, fov: 40, focus: 22, aperture: 0.0008 };
}

/* ---------- stats ---------- */
let fpsAcc = 0, fpsN = 0, fps = 60, lowT = 0;
function toggleStats() { const s = $('stats'); s.hidden = !s.hidden; }
function stats() {
  const s = $('stats');
  if (!s.hidden) { const i = G.renderer.info.render; s.textContent = `${fps.toFixed(0)} FPS  ${(1000 / Math.max(1, fps)).toFixed(1)} ms\nDraw calls ${i.calls}   Tris ${(i.triangles / 1000).toFixed(0)}k\nQuality ${G.qName}  DOF ${G.Q.dof ? 'on' : 'off'}  AO ${G.Q.ssao ? 'on' : 'off'}`; }
  if (STATE.started && fps < 24) { lowT += 0.5; if (lowT > 5 && G.qName !== 'Low') { G.qName = G.qName === 'Epic' ? 'High' : 'Low'; G.applyQuality(); hint('Quality lowered to ' + G.qName + ' for smoother play.', 4); lowT = 0; } } else lowT = 0;
}

/* ---------- loop ---------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; stats(); }
  if (STATE.started) step(dt, t);
  else { for (const c of [PLAYER, PARTNER]) G.animate(c, dt, t); }
  if (!STATE.started) { CAM.shot = titleShot; }
  updateCamera(dt, t);
  const focus = STATE.started ? new THREE.Vector3(PLAYER.x, PLAYER.y + 1, PLAYER.z) : new THREE.Vector3(6.5, 1, 8);
  updateLighting(t, dt, focus);
  if (SNOW) { SNOW.material.uniforms.uTime.value = t; SNOW.material.uniforms.uCenter.value.copy(G.camera.position); SNOW.material.uniforms.uLight.value.set(STATE.tod > 0.5 ? '#c8d4ff' : '#ffe2d0'); }
  updateSmoke(dt);
  grade.uniforms.uTime.value = t;
  composer.render(dt);
  bubble(dt);
  pressed.clear();
}

/* ---------- boot ---------- */
function boot() {
  G.buildTextures(); G.buildMaterials();
  G.buildSky(); G.buildTerrain(); G.buildMountains(); G.buildForest(); G.buildPath(); G.buildCabin(); G.buildInterior();
  SNOW = snowSystem(4500); smokeSystem();
  PLAYER.m = G.makeHuman({ height: 1.84, skin: '#d9ab8e', outfit: 'hoodie', top: '#3f4146', legs: '#25272c', hair: '#1e140f', hairStyle: 'shaggy', socks: '#2f2b28', seed: 11 });
  PARTNER.m = G.makeHuman({ height: 1.6, fem: true, skin: '#e8bfa4', outfit: 'sweater', legs: '#2c2626', hair: '#5e3a26', hairStyle: 'bun', socks: '#e6dccd', eyes: '#4a3020', lips: '#c47a70', seed: 23 });
  placeChar(PLAYER, G.pathX(27) + 0.35, 27, Math.PI); placeChar(PARTNER, G.pathX(27) - 0.45, 26.6, Math.PI);
  buildNav();
  G.attachBlenderBody(PLAYER.m, 'player'); G.attachBlenderBody(PARTNER.m, 'partner');
  buildPost();
  document.querySelectorAll('#quality button').forEach((b) => b.addEventListener('click', () => { G.qName = b.dataset.q; G.applyQuality(); }));
  $('timeBtn').addEventListener('click', () => { STATE.todTarget = STATE.todTarget > 0.5 ? 0 : 1; });
  $('statsBtn').addEventListener('click', toggleStats);
  $('endClose').addEventListener('click', () => Story.closeEnd());
  G.applyQuality();
  CAM.shot = titleShot; CAM.cut = true;
  $('loading').classList.add('done');
  $('begin').addEventListener('click', () => {
    G.Audio.start();
    $('title').classList.add('hide');
    STATE.started = true;
    Story.intro();
  });
  requestAnimationFrame(frame);
  window.DEMO = { G, STATE, PLAYER, PARTNER, CAM, SHOTS, Story, skipIntro() { $('title').classList.add('hide'); STATE.started = true; DLG.q.length = 0; if (DLG.cur) { const r = DLG.cur.res; DLG.cur = null; } STATE.busy = false; STATE.sceneShot = false; PLAYER.script = null; PARTNER.script = null; STATE.watchDoor = false; placeChar(PLAYER, 6.5, 8.5, Math.PI); placeChar(PARTNER, 5.8, 8.8, Math.PI); PARTNER.mode = 'follow'; releaseCamera(); CAM.cut = true; }, setQ(q) { G.qName = q; G.applyQuality(); }, placeChar, simPartner(dt, n) { for (let i = 0; i < n; i++) partnerAI(dt, 0); } };
}
try { boot(); } catch (e) { console.error(e); $('loading').textContent = 'This demo needs WebGL. ' + e.message; }
})();
