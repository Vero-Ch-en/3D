'use strict';
/* =========================================================================
 * Atmosphere: footprints in the snow (and wet ones indoors), breath vapour,
 * steam, fire embers, dust motes, sunbeams through the windows by day, window
 * light falling on the snow at night, and snow sliding off the eaves.
 * Built by G.buildFX() after the world; ticked by G.updateFX(dt, t).
 * ========================================================================= */
(() => {
const { clamp, lerp } = G;
const softDot = () => G.canvasTex(0, null, { w: 64, h: 64, draw: (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); } });

/* ---------------- footprints ----------------
 * A ring buffer of instanced decals. Each print is a pressed-in blue-grey shape;
 * as it ages its instance colour rises until it matches the snow, so old prints
 * slowly fill back in instead of popping out. */
const FP = { N: 360, i: 0, born: null, mesh: null, life: 70, fade: 25 };
// Fade target: the instance colour at which the print's colour equals the snow's (in linear space).
const PRINT_C = new THREE.Color('#99a8c9').convertSRGBToLinear(), SNOW_C = new THREE.Color('#f3f6fb').convertSRGBToLinear();
const FADE_TO = [SNOW_C.r / PRINT_C.r, SNOW_C.g / PRINT_C.g, SNOW_C.b / PRINT_C.b];
function buildFootprints() {
  const tex = G.canvasTex(0, null, { w: 64, h: 160, draw: (c, w, h) => {
    c.clearRect(0, 0, w, h);
    // One connected boot outline (toe at the top), softened so it reads as pressed snow.
    c.filter = 'blur(2.5px)';
    c.fillStyle = 'rgb(153,168,201)';
    c.beginPath();
    c.moveTo(32, 6); c.bezierCurveTo(56, 6, 60, 40, 56, 70); c.bezierCurveTo(54, 92, 46, 100, 46, 112);
    c.bezierCurveTo(50, 140, 44, 154, 32, 154); c.bezierCurveTo(20, 154, 14, 140, 18, 112);
    c.bezierCurveTo(18, 100, 8, 90, 8, 66); c.bezierCurveTo(6, 36, 10, 6, 32, 6); c.fill();
    c.filter = 'none';
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(110,125,165,0.55)'; for (let y = 16; y < 100; y += 10) c.fillRect(10, y, 44, 4);  // tread
    c.fillStyle = 'rgba(110,125,165,0.45)'; for (let y = 118; y < 150; y += 10) c.fillRect(16, y, 32, 4);
    c.globalCompositeOperation = 'source-over';
  } });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  // Same surface response as the snow, so a fully faded print is indistinguishable from it.
  const mat = G.std({ map: tex, roughness: 0.75, env: 0.7, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
  const geo = new THREE.PlaneGeometry(0.12, 0.3); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI);  // toe toward +z (forward)
  const m = new THREE.InstancedMesh(geo, mat, FP.N);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const hide = G.mtx(0, -50, 0, 0.0001, 0.0001, 0.0001), white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < FP.N; i++) { m.setMatrixAt(i, hide); m.setColorAt(i, white); }
  m.frustumCulled = false; m.renderOrder = 2; m.receiveShadow = true; m.castShadow = false;   // shadowed like the snow around them
  G.scene.add(m);
  FP.mesh = m; FP.born = new Float32Array(FP.N).fill(-1e9);
}
let fxTime = 0;
G.addFootprint = (x, z, yaw, leg, size = 1, keep = false) => {
  if (!FP.mesh) return;
  const i = FP.i; FP.i = (FP.i + 1) % FP.N;
  const y = G.floorAt(x, z) + 0.022;
  FP.mesh.setMatrixAt(i, G.mtx(x, y, z, (leg ? 1 : -1) * size, 1, size, yaw + (Math.random() - 0.5) * 0.12));
  FP.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
  FP.born[i] = keep ? 1e12 : fxTime;   // kept prints never fill in (until the ring buffer comes round)
  FP.mesh.instanceMatrix.needsUpdate = true; FP.mesh.instanceColor.needsUpdate = true;
};
const _c = new THREE.Color(), HIDE = G.mtx(0, -50, 0, 0.0001, 0.0001, 0.0001);
function updateFootprints() {
  if (!FP.mesh) return;
  let dirty = false;
  for (let i = 0; i < FP.N; i++) {
    const age = fxTime - FP.born[i];
    if (age < FP.life || age > FP.life + FP.fade + 1) continue;
    const k = clamp((age - FP.life) / FP.fade, 0, 1);
    if (k >= 1) { FP.mesh.setMatrixAt(i, HIDE); FP.born[i] = -1e9; FP.mesh.instanceMatrix.needsUpdate = true; continue; }
    _c.setRGB(lerp(1, FADE_TO[0], k), lerp(1, FADE_TO[1], k), lerp(1, FADE_TO[2], k));
    FP.mesh.setColorAt(i, _c); dirty = true;
  }
  if (dirty) FP.mesh.instanceColor.needsUpdate = true;
}

/* ---------------- breath ---------------- */
const PUFFS = [];
let puffTex;
function buildBreath() {
  puffTex = softDot();
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: '#f4f6ff', transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; G.scene.add(s); PUFFS.push({ s, age: 9, life: 1.6, vx: 0, vz: 0 });
  }
}
G.breathe = (c, strength = 1) => {
  const p = PUFFS.find((q) => q.age >= q.life); if (!p) return;
  const h = G.headPos(c), fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  p.s.position.set(h.x + fx * 0.13, h.y - 0.07, h.z + fz * 0.13);
  p.vx = fx * (0.18 + c.speed * 0.6) + G.WIND.gust * 0.2; p.vz = fz * (0.18 + c.speed * 0.6);
  p.age = 0; p.life = 1.8 + Math.random() * 0.6; p.str = strength; p.s.visible = true;
};
function updateBreath(dt) {
  const night = G.STATE.tod;
  for (const p of PUFFS) {
    if (p.age >= p.life) { if (p.s.visible) p.s.visible = false; continue; }
    p.age += dt; const k = p.age / p.life;
    p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt; p.s.position.y += dt * 0.08;
    p.vx *= 1 - dt * 1.2; p.vz *= 1 - dt * 1.2;
    p.s.scale.setScalar(0.08 + k * 0.42);
    p.s.material.opacity = Math.sin(Math.min(1, k * 2.2) * Math.PI * 0.5) * (1 - k) * lerp(0.32, 0.45, night) * p.str;
  }
}

/* ---------------- embers ---------------- */
let EMB;
function buildEmbers() {
  const N = 48, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 }, uOrigin: { value: new THREE.Vector3(8.0, 0.22, 0.74) }, uPx: { value: 1 } },
    vertexShader: `
      attribute float seed; uniform float uTime; uniform float uPower; uniform vec3 uOrigin; uniform float uPx; varying float vA;
      void main(){
        float life = 1.2 + seed * 1.6;
        float k = fract(uTime / life + seed * 7.13);
        vec3 p = uOrigin;
        p.x += (fract(seed * 91.7) - 0.5) * 0.5 + sin(uTime * 3.0 + seed * 40.0) * 0.04 * k;
        p.z += (fract(seed * 13.3) - 0.3) * 0.18 + k * 0.12 * fract(seed * 5.1);
        p.y += k * (0.45 + seed * 0.45);
        vA = uPower * smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.55, 1.0, k)) * (0.5 + 0.5 * sin(uTime * 17.0 + seed * 60.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPx * (8.0 + seed * 8.0) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.55, 0.18) * 2.2, smoothstep(0.5, 0.0, d) * vA); }',
  });
  EMB = new THREE.Points(g, mat); EMB.frustumCulled = false; G.scene.add(EMB);
}

/* ---------------- dust motes ---------------- */
let DUST;
function buildDust() {
  const N = 300, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = G.rand(0.3, 14.7); pos[i * 3 + 1] = G.rand(0.3, 2.5); pos[i * 3 + 2] = G.rand(0.3, 4.3); seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uVis: { value: 0 }, uDay: { value: 0 } },
    vertexShader: `
      attribute float seed; uniform float uTime; uniform float uPx; uniform float uVis; uniform float uDay; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.13 + seed * 31.0) * 0.25;
        p.y += sin(uTime * 0.09 + seed * 17.0) * 0.18;
        p.z += cos(uTime * 0.11 + seed * 23.0) * 0.25;
        // Brighter near the fire and the lamps, where light would catch them.
        float warm = exp(-pow(distance(p.xz, vec2(8.0, 1.2)), 2.0) * 0.35) + exp(-pow(distance(p.xz, vec2(2.4, 0.5)), 2.0) * 0.6) * 0.6 + 0.25;
        // By day they glitter where the sunbeams come in through the south windows.
        float beam = uDay * 1.4 * smoothstep(1.8, 4.3, p.z) * (smoothstep(0.6, 1.8, p.y));
        vA = uVis * (warm * (1.0 - uDay * 0.6) + beam) * (0.5 + 0.5 * sin(uTime * 0.7 + seed * 50.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPx * (4.0 + seed * 5.0) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 0.82, 0.6, smoothstep(0.5, 0.0, d) * vA * 0.35); }',
  });
  DUST = new THREE.Points(g, mat); DUST.frustumCulled = false; G.scene.add(DUST);
}

/* ---------------- window light on the snow ---------------- */
let WINPOOL;
function buildWindowLight() {
  // Four warm panes stretched out from the window, softened and fading with distance.
  const tex = G.canvasTex(0, null, { w: 128, h: 256, draw: (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.filter = 'blur(6px)';
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,170,90,0.95)'); g.addColorStop(0.55, 'rgba(255,150,80,0.45)'); g.addColorStop(1, 'rgba(255,130,70,0)');
    c.fillStyle = g;
    const pad = 14, gap = 7, pw = (w - pad * 2 - gap) / 2, top = 8, ph = (h - top - gap) / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) c.fillRect(pad + i * (pw + gap), top + j * (ph + gap), pw, ph);
  } });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  WINPOOL = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3, polygonOffset: true, polygonOffsetFactor: -3 });
  // [window centre along the wall, wall coordinate, direction out (+1/−1), axis of the wall, width, length]
  // The porch window's patch stops at the deck edge so it doesn't hang in the air over the snow.
  const W = [[2.4, 4.6, 1, 'x', 1.6, 2.6], [9.4, 4.6, 1, 'x', 1.6, 1.7], [2.25, 0, -1, 'z', 1.5, 2.6], [2.1, 15, 1, 'z', 1.4, 2.6], [13, 4.6, 1, 'x', 1.6, 2.6]];
  for (const [a, c, out, axis, wdt, len] of W) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt * 1.15, len), WINPOOL);
    m.rotation.x = -Math.PI / 2;
    let x, z;
    if (axis === 'x') { x = a; z = c + out * (0.15 + len / 2); m.rotation.z = out > 0 ? 0 : Math.PI; }
    else { x = c + out * (0.15 + len / 2); z = a; m.rotation.z = out > 0 ? Math.PI / 2 : -Math.PI / 2; }
    m.position.set(x, G.floorAt(x, z) + 0.025, z);
    m.renderOrder = 2; G.world.add(m);
  }
}

/* ---------------- wet boot prints indoors ----------------
 * Darken the boards (multiply blend) and dry off over a minute or so. */
const WP = { N: 80, i: 0, born: null, str: null, mesh: null, life: 60 };
function buildWetPrints() {
  const tex = G.canvasTex(0, null, { w: 64, h: 160, draw: (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    c.filter = 'blur(4px)'; c.fillStyle = 'rgb(150,140,130)';
    c.beginPath(); c.ellipse(32, 52, 20, 42, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(32, 128, 15, 24, 0, 0, Math.PI * 2); c.fill();
  } });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, polygonOffset: true, polygonOffsetFactor: -4 });
  const geo = new THREE.PlaneGeometry(0.12, 0.3); geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI);
  const m = new THREE.InstancedMesh(geo, mat, WP.N); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < WP.N; i++) { m.setMatrixAt(i, HIDE); m.setColorAt(i, new THREE.Color(1, 1, 1)); }
  m.frustumCulled = false; m.renderOrder = 2; G.scene.add(m);
  WP.mesh = m; WP.born = new Float32Array(WP.N).fill(-1e9); WP.str = new Float32Array(WP.N);
}
G.addWetPrint = (x, z, yaw, leg, size = 1, str = 1) => {
  if (!WP.mesh || str < 0.05) return;
  const i = WP.i; WP.i = (WP.i + 1) % WP.N;
  WP.mesh.setMatrixAt(i, G.mtx(x, 0.006, z, (leg ? 1 : -1) * size, 1, size, yaw + (Math.random() - 0.5) * 0.12));
  WP.born[i] = fxTime; WP.str[i] = str; WP.mesh.instanceMatrix.needsUpdate = true;
};
function updateWetPrints() {
  if (!WP.mesh) return;
  let dirty = false;
  for (let i = 0; i < WP.N; i++) {
    const age = fxTime - WP.born[i];
    if (age > WP.life + 1) { if (WP.born[i] > -1e8) { WP.mesh.setMatrixAt(i, HIDE); WP.born[i] = -1e9; WP.mesh.instanceMatrix.needsUpdate = true; } continue; }
    // White = no darkening; the print fades back to white as the boards dry.
    const k = 1 - (1 - Math.min(1, age / WP.life)) * WP.str[i] * 0.85; _c.setRGB(k, k, k); WP.mesh.setColorAt(i, _c); dirty = true;
  }
  if (dirty) WP.mesh.instanceColor.needsUpdate = true;
}

/* ---------------- steam ----------------
 * Emitters (mugs, the kettle, the pan) breathe out soft wisps that rise, drift and thin out. */
const STEAM = { pool: [], em: new Map() };
function buildSteam() {
  const tex = softDot();
  for (let i = 0; i < 48; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; G.scene.add(s); STEAM.pool.push({ s, age: 9, life: 1 }); }
}
// rate: wisps per second; dur: seconds of game time (Infinity until cleared); size: wisp scale.
G.steamMove = (id, x, y, z) => { const e = STEAM.em.get(id); if (e) { e.x = x; e.y = y; e.z = z; } };   // follow a mug that's being carried
G.steam = (id, x, y, z, o = {}) => { if (o.off) { STEAM.em.delete(id); return; } STEAM.em.set(id, { x, y, z, rate: o.rate || 2, until: fxTime + (o.dur == null ? Infinity : o.dur), size: o.size || 1, acc: 0 }); };
function updateSteam(dt) {
  for (const [id, e] of STEAM.em) {
    if (fxTime > e.until) { STEAM.em.delete(id); continue; }
    e.acc += dt * e.rate;
    while (e.acc > 1) { e.acc -= 1; const p = STEAM.pool.find((q) => q.age >= q.life); if (!p) break; p.age = 0; p.life = 1.6 + Math.random(); p.size = e.size; p.s.position.set(e.x + (Math.random() - 0.5) * 0.03, e.y, e.z + (Math.random() - 0.5) * 0.03); p.vx = (Math.random() - 0.5) * 0.05; p.s.visible = true; }
  }
  for (const p of STEAM.pool) {
    if (p.age >= p.life) { if (p.s.visible) p.s.visible = false; continue; }
    p.age += dt; const k = p.age / p.life;
    p.s.position.y += dt * (0.22 - k * 0.08); p.s.position.x += (p.vx + Math.sin(p.age * 3 + p.life) * 0.03) * dt;
    p.s.scale.setScalar((0.03 + k * 0.16) * p.size);
    p.s.material.opacity = Math.sin(Math.min(1, k * 3) * Math.PI * 0.5) * (1 - k) * 0.18;
  }
}

/* ---------------- sunbeams ----------------
 * By day, a soft shaft of light from each sunlit window, extruded along the sun's direction and
 * faded with distance. A stand-in for real volumetric light: swap it out when the renderer has one. */
let SHAFTS;
function buildSunbeams() {
  const d = G.SUN_DAY.clone().negate(), len = 4.2;
  // [window corners as (x, y, z) × 4]: the south windows and the kitchen's east window.
  const wins = [[1.6, 3.2, 'S'], [8.6, 10.2, 'S'], [12.2, 13.8, 'S'], [1.4, 2.8, 'E']];
  // Each side of the shaft is its own quad with an 'across' coordinate, so the beam's edges fade out
  // instead of reading as flat glass panels.
  const P = [], A = [], U = [];
  for (const [a, b, side] of wins) {
    const y0 = 0.85, y1 = 2.05;
    const q = side === 'S' ? [[a, y0, 4.48], [b, y0, 4.48], [b, y1, 4.48], [a, y1, 4.48]] : [[14.88, y0, a], [14.88, y0, b], [14.88, y1, b], [14.88, y1, a]];
    const far = (v) => [v[0] + d.x * len, v[1] + d.y * len, v[2] + d.z * len];
    for (let k = 0; k < 4; k++) {
      const v0 = q[k], v1 = q[(k + 1) % 4], f0 = far(v0), f1 = far(v1);
      for (const [v, al, u] of [[v0, 0, 0], [v1, 0, 1], [f1, 1, 1], [v0, 0, 0], [f1, 1, 1], [f0, 1, 0]]) { P.push(v[0], v[1], v[2]); A.push(al); U.push(u); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('along', new THREE.Float32BufferAttribute(A, 1)); g.setAttribute('across', new THREE.Float32BufferAttribute(U, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uI: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'attribute float along; attribute float across; varying float vA; varying float vU; varying vec3 vP; void main(){ vA = along; vU = across; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uI; uniform float uTime; varying float vA; varying float vU; varying vec3 vP;
      void main(){
        float f = pow(1.0 - vA, 1.8) * smoothstep(0.0, 0.06, vA) * pow(sin(vU * 3.14159), 1.5);
        float flicker = 0.85 + 0.15 * sin(vP.x * 3.0 + vP.y * 2.0 + uTime * 0.3);
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * f * uI * flicker, 1.0);
      }`,
  });
  SHAFTS = new THREE.Mesh(g, mat); SHAFTS.frustumCulled = false; SHAFTS.renderOrder = 4; G.scene.add(SHAFTS);
}

/* ---------------- snow sliding off the eaves ---------------- */
const PUFF = [];
function buildPuffs() {
  const tex = softDot();
  for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#f4f7ff', transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; G.scene.add(s); PUFF.push({ s, age: 9, life: 1 }); }
}
// Eave lines a clump can fall from: [x0, x1, z, y].
const EAVES = [[3.3, 11.6, 6.98, 2.35], [11.6, 15.6, 5.15, 2.75], [-0.6, 3.3, 5.15, 2.75], [-0.6, 15.6, -0.75, 2.75]];
G.snowPuff = (near) => {
  let best = null, bd = 1e9;
  for (const [x0, x1, z, y] of EAVES) { const x = G.clamp(near.x + (Math.random() - 0.5) * 6, x0, x1), dd = Math.hypot(x - near.x, z - near.z); if (dd < bd) { bd = dd; best = { x, y, z }; } }
  if (!best || bd > 9) return false;
  let n = 0;
  for (const p of PUFF) { if (p.age < p.life) continue; p.age = 0; p.life = 0.9 + Math.random() * 0.7; p.x = best.x + (Math.random() - 0.5) * 0.5; p.z = best.z + (Math.random() - 0.5) * 0.2; p.y = best.y; p.vy = -Math.random() * 0.5; p.vx = (Math.random() - 0.5) * 0.4 + G.WIND.gust * 0.3; p.vz = 0; p.sz = 1; p.op = 1; p.s.visible = true; if (++n > 14) break; }
  return true;
};
// A burst of powder at a point (a snowball landing).
G.puffAt = (x, y, z, n = 12) => {
  let k = 0;
  for (const p of PUFF) { if (p.age < p.life) continue; p.age = 0; p.life = 0.5 + Math.random() * 0.5; p.x = x + (Math.random() - 0.5) * 0.15; p.z = z + (Math.random() - 0.5) * 0.15; p.y = y + (Math.random() - 0.5) * 0.15; p.vy = Math.random() * 1.2; p.vx = (Math.random() - 0.5) * 1.6; p.vz = (Math.random() - 0.5) * 1.6; p.sz = 1; p.op = 1; p.s.visible = true; if (++k >= n) break; }
};
// Powder kicked up by a boot: a few small puffs off the toe, forward and up, gone in half a second.
G.kickAt = (x, y, z, yaw, amt = 1) => {
  let k = 0; const n = Math.round(2 + amt * 2), fx = Math.sin(yaw), fz = Math.cos(yaw);
  for (const p of PUFF) { if (p.age < p.life) continue; p.age = 0; p.life = 0.35 + Math.random() * 0.3; p.x = x + fx * 0.12 + (Math.random() - 0.5) * 0.08; p.z = z + fz * 0.12 + (Math.random() - 0.5) * 0.08; p.y = y + 0.04; const sp = (0.4 + Math.random() * 0.6) * amt; p.vx = fx * sp + (Math.random() - 0.5) * 0.3; p.vz = fz * sp + (Math.random() - 0.5) * 0.3; p.vy = 0.5 + Math.random() * 0.7 * amt; p.sz = 0.35 + Math.random() * 0.2; p.op = 0.8; p.s.visible = true; if (++k >= n) break; }
};
/* Snowballs: a packed ball flying in an arc from one hand to its target. Resolves when it lands. */
const BALLS = [];
let ballGeo, ballMat;
G.throwSnow = (from, to, dur = 0.55) => new Promise((res) => {
  if (!ballGeo) { ballGeo = new THREE.SphereGeometry(0.045, 10, 8); ballMat = G.MAT.snow; }
  const m = new THREE.Mesh(ballGeo, ballMat); m.castShadow = true; G.scene.add(m);
  BALLS.push({ m, from: from.clone(), to: to.clone(), t: 0, dur, res });
});
function updateBalls(dt) {
  for (let i = BALLS.length - 1; i >= 0; i--) {
    const b = BALLS[i]; b.t += dt; const k = Math.min(1, b.t / b.dur);
    b.m.position.lerpVectors(b.from, b.to, k); b.m.position.y += Math.sin(k * Math.PI) * 0.35 * b.from.distanceTo(b.to) / 3;
    if (k >= 1) { G.scene.remove(b.m); BALLS.splice(i, 1); G.puffAt(b.to.x, b.to.y, b.to.z, 14); b.res(); }
  }
}
/* The snow globe on the mantle: shake it and the snow inside swirls, then settles. */
let GLOBE;
function buildGlobeSnow() {
  const N = 70, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 99 }, uC: { value: new THREE.Vector3(8.5, 1.56, 0.75) }, uPx: { value: 1 } },
    vertexShader: `
      attribute float seed; uniform float uT; uniform vec3 uC; uniform float uPx; varying float vA;
      void main(){
        float s = fract(seed * 13.7), a = seed * 6.283 + uT * (2.5 - uT * 0.25) * (0.6 + s);
        float settle = clamp(uT / 7.0, 0.0, 1.0);
        float r = 0.055 * sqrt(fract(seed * 7.3)) * (1.0 - settle * 0.3);
        float y = mix(0.05 * (fract(seed * 3.1) * 2.0 - 1.0) + sin(uT * 2.0 + seed * 9.0) * 0.015 * (1.0 - settle), -0.045, settle * settle);
        vec3 p = uC + vec3(cos(a) * r, y, sin(a) * r);
        vA = 1.0 - smoothstep(9.0, 12.0, uT);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPx * (2.0 + s * 2.0) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.1, d) * vA); }',
  });
  GLOBE = new THREE.Points(g, mat); GLOBE.frustumCulled = false; GLOBE.renderOrder = 5; G.scene.add(GLOBE);
}
G.shakeGlobe = () => { if (GLOBE) GLOBE.material.uniforms.uT.value = 0; };
function updatePuffs(dt) {
  for (const p of PUFF) {
    if (p.age >= p.life) { if (p.s.visible) p.s.visible = false; continue; }
    p.age += dt; const k = p.age / p.life;
    p.vy -= dt * 6; p.y = Math.max(G.floorAt(p.x, p.z) + 0.02, p.y + p.vy * dt); p.x += p.vx * dt; p.z += (p.vz || 0) * dt;
    const sz = p.sz || 1;
    p.s.position.set(p.x, p.y, p.z); p.s.scale.setScalar((0.12 + k * 0.5) * sz);
    p.s.material.opacity = (1 - k) * 0.55 * (p.op || 1);
  }
}

/* ---------------- Gerald ----------------
 * The bullfinch who lives on the bedroom window sill (outside). He hops, looks about, and flies off
 * if you come too close outside, coming back a while later. Mornings only. */
let BIRD;
function buildBird() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const rose = G.shared({ color: '#d0573e', roughness: 0.85 }), grey = G.shared({ color: '#6f7480', roughness: 0.9 }), black = G.shared({ color: '#1a1a1e', roughness: 0.7 }), white = G.shared({ color: '#f2f0ea', roughness: 0.9 });
  const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; body.add(m); return m; };
  const sph = new THREE.SphereGeometry(1, 12, 9);
  part(sph, rose, 0, 0.045, 0.005, 0.034, 0.036, 0.04);       // round rosy front
  part(sph, grey, 0, 0.055, -0.012, 0.032, 0.032, 0.038);     // grey back
  const head = new THREE.Group(); head.position.set(0, 0.085, 0.022); body.add(head);
  const hm = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); head.add(m); return m; };
  hm(sph, rose, 0, 0, 0, 0.022, 0.022, 0.022); hm(sph, black, 0, 0.008, -0.004, 0.023, 0.016, 0.022);
  hm(new THREE.ConeGeometry(1, 1, 8), black, 0, -0.002, 0.024, 0.008, 0.014, 0.008).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) hm(sph, black, s * 0.014, 0.004, 0.012, 0.004, 0.004, 0.004);
  part(new THREE.BoxGeometry(1, 1, 1), black, 0, 0.05, -0.05, 0.024, 0.008, 0.04).rotation.x = 0.4;   // tail
  part(sph, white, 0, 0.04, -0.03, 0.02, 0.012, 0.012);
  for (const s of [-1, 1]) part(new THREE.CylinderGeometry(0.002, 0.002, 0.02, 4), black, s * 0.01, 0.008, 0, 1, 1, 1);
  g.position.set(2.35, 0.87, 4.8); g.rotation.y = Math.PI * 0.85; G.scene.add(g);
  BIRD = { g, body, head, home: g.position.clone(), state: 'sit', t: 0, hopT: 1, lookT: 1, away: 0, v: new THREE.Vector3() };
}
function updateBird(dt, t) {
  if (!BIRD) return;
  const B = BIRD, day = (G.STATE.day || 0) > 0.5, P = G.PLAYER;
  B.g.visible = day && B.state !== 'gone';
  if (!day) return;
  B.t += dt;
  const near = !G.inside(P.x, P.z) && Math.hypot(P.x - B.home.x, P.z - B.home.z) < 2.6;
  if (B.state === 'sit') {
    B.hopT -= dt; B.lookT -= dt;
    if (B.lookT < 0) { B.lookT = 0.4 + Math.random() * 1.6; B.head.rotation.y = (Math.random() - 0.5) * 1.6; B.head.rotation.z = (Math.random() - 0.5) * 0.5; }
    if (B.hopT < 0) { B.hopT = 1.5 + Math.random() * 4; B.hop = 0.25; B.g.rotation.y += (Math.random() - 0.5) * 1.4; if (Math.random() < 0.4 && G.Audio.tweet) G.Audio.tweet(); }
    if (B.hop > 0) { B.hop -= dt; B.body.position.y = Math.sin((1 - B.hop / 0.25) * Math.PI) * 0.025; }
    if (near) { B.state = 'fly'; B.t = 0; B.v.set(0.6, 1.4, 1.8); if (G.Audio.tweet) G.Audio.tweet(); }
  } else if (B.state === 'fly') {
    B.g.position.addScaledVector(B.v, dt); B.v.y += dt * 0.6;
    B.body.rotation.x = -0.4; B.body.position.y = Math.sin(t * 60) * 0.004;
    if (B.t > 3) { B.state = 'gone'; B.t = 0; }
  } else if (B.state === 'gone' && B.t > 35 && !near) { B.state = 'sit'; B.g.position.copy(B.home); B.body.rotation.x = 0; }
}

/* ---------------- spindrift ----------------
 * When a gust comes through, loose snow skims along the ground outside. */
let DRIFT;
function buildSpindrift() {
  const N = 260, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 16 - 8; pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random() * 16 - 8; seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uGust: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uPx: { value: 1 }, uCol: { value: new THREE.Color('#f4f7ff') } },
    vertexShader: `
      attribute float seed; uniform float uTime; uniform float uGust; uniform vec3 uCenter; uniform float uPx; varying float vA;
      void main(){
        vec3 p = position;
        float sp = 1.5 + seed * 2.5;
        p.x = mod(p.x + uTime * sp + 8.0, 16.0) - 8.0 + uCenter.x;
        p.z = mod(p.z - uTime * sp * 0.35 + 8.0, 16.0) - 8.0 + uCenter.z;
        p.y = uCenter.y + seed * 0.25 + abs(sin(uTime * 3.0 + seed * 20.0)) * 0.08;
        float edge = 1.0 - smoothstep(5.0, 8.0, length(p.xz - uCenter.xz));
        bool roof = p.x > -0.6 && p.x < 15.6 && p.z > -0.6 && p.z < 7.0;
        vA = roof ? 0.0 : smoothstep(0.45, 0.85, uGust) * edge;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPx * (5.0 + seed * 6.0) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uCol, smoothstep(0.5, 0.0, d) * vA * 0.5); }',
  });
  DRIFT = new THREE.Points(g, mat); DRIFT.frustumCulled = false; G.scene.add(DRIFT);
}

G.buildFX = () => { buildGlobeSnow(); buildBird(); buildSpindrift(); buildFootprints(); buildWetPrints(); buildBreath(); buildSteam(); buildEmbers(); buildDust(); buildWindowLight(); buildSunbeams(); buildPuffs(); };
let sparkT = 0;
G.sparkBurst = () => { sparkT = 1; };
G.updateFX = (dt, t) => {
  fxTime += dt;
  updateFootprints(); updateWetPrints();
  updateBreath(dt); updateSteam(dt); updatePuffs(dt); updateBird(dt, t); updateBalls(dt);
  if (GLOBE) { const U = GLOBE.material.uniforms; U.uT.value = Math.min(99, U.uT.value + dt); U.uPx.value = innerHeight * Math.min(window.devicePixelRatio || 1, G.Q.dpr) / 900 * 0.45; GLOBE.visible = U.uT.value < 12; }
  if (DRIFT) { const U = DRIFT.material.uniforms, P = G.PLAYER; U.uTime.value = t; U.uGust.value = G.WIND.gust; U.uCenter.value.set(P.x, G.terrainH(P.x, P.z) + 0.02, P.z); U.uPx.value = innerHeight * Math.min(window.devicePixelRatio || 1, G.Q.dpr) / 900; DRIFT.visible = !G.inside(P.x, P.z); }
  sparkT = Math.max(0, sparkT - dt * 1.5);
  if (SHAFTS) { const i = (G.STATE.day || 0) * 0.06; SHAFTS.visible = i > 0.002; SHAFTS.material.uniforms.uI.value = i; SHAFTS.material.uniforms.uTime.value = t; }
  const px = innerHeight * Math.min(window.devicePixelRatio || 1, G.Q.dpr);
  if (EMB) { EMB.material.uniforms.uTime.value = t; EMB.material.uniforms.uPower.value = (G.FIRE.on ? G.FIRE.level : 0) * (1 + sparkT * 2.5); EMB.material.uniforms.uPx.value = px / 900; }
  if (DUST) {
    const camIn = G.inside(G.camera.position.x, G.camera.position.z);
    DUST.material.uniforms.uTime.value = t; DUST.material.uniforms.uPx.value = px / 900;
    DUST.material.uniforms.uVis.value = G.damp(DUST.material.uniforms.uVis.value, camIn ? 1 : 0, 2, dt);
    DUST.material.uniforms.uDay.value = G.STATE.day || 0;
  }
  // The wall clock follows the day: mid-morning, late afternoon, then night, creeping on as you play.
  if (G.CLOCK) {
    const S = G.STATE, h = (S.day > 0.5 ? 9.2 : lerp(17.0, 21.0, S.tod)) + (G.simT % 3600) / 3600 * 0.5;
    G.CLOCK.m.rotation.z = -(h % 1) * Math.PI * 2; G.CLOCK.h.rotation.z = -((h % 12) / 12) * Math.PI * 2;
  }
  if (WINPOOL) WINPOOL.opacity = lerp(0.18, 0.65, G.STATE.tod) * (1 - (G.STATE.day || 0));
};
})();
