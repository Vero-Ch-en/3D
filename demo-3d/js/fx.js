'use strict';
/* =========================================================================
 * Atmosphere: footprints in the snow, breath vapour, fire embers, dust motes
 * in the lamplight and window light falling on the snow outside.
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
G.addFootprint = (x, z, yaw, leg, size = 1) => {
  if (!FP.mesh) return;
  const i = FP.i; FP.i = (FP.i + 1) % FP.N;
  const y = G.floorAt(x, z) + 0.022;
  FP.mesh.setMatrixAt(i, G.mtx(x, y, z, (leg ? 1 : -1) * size, 1, size, yaw + (Math.random() - 0.5) * 0.12));
  FP.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
  FP.born[i] = fxTime;
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
  const N = 220, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = G.rand(0.3, 10.7); pos[i * 3 + 1] = G.rand(0.3, 2.5); pos[i * 3 + 2] = G.rand(0.3, 4.3); seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uVis: { value: 0 } },
    vertexShader: `
      attribute float seed; uniform float uTime; uniform float uPx; uniform float uVis; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.13 + seed * 31.0) * 0.25;
        p.y += sin(uTime * 0.09 + seed * 17.0) * 0.18;
        p.z += cos(uTime * 0.11 + seed * 23.0) * 0.25;
        // Brighter near the fire and the lamps, where light would catch them.
        float warm = exp(-pow(distance(p.xz, vec2(8.0, 1.2)), 2.0) * 0.35) + exp(-pow(distance(p.xz, vec2(2.4, 0.5)), 2.0) * 0.6) * 0.6 + 0.25;
        vA = uVis * warm * (0.5 + 0.5 * sin(uTime * 0.7 + seed * 50.0));
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

G.buildFX = () => { buildFootprints(); buildBreath(); buildEmbers(); buildDust(); buildWindowLight(); };
G.updateFX = (dt, t) => {
  fxTime += dt;
  updateFootprints();
  updateBreath(dt);
  const px = innerHeight * Math.min(window.devicePixelRatio || 1, G.Q.dpr);
  if (EMB) { EMB.material.uniforms.uTime.value = t; EMB.material.uniforms.uPower.value = G.FIRE.on ? G.FIRE.level : 0; EMB.material.uniforms.uPx.value = px / 900; }
  if (DUST) {
    const camIn = G.inside(G.camera.position.x, G.camera.position.z);
    DUST.material.uniforms.uTime.value = t; DUST.material.uniforms.uPx.value = px / 900;
    DUST.material.uniforms.uVis.value = G.damp(DUST.material.uniforms.uVis.value, camIn ? 1 : 0, 2, dt);
  }
  if (WINPOOL) WINPOOL.opacity = lerp(0.18, 0.65, G.STATE.tod) * (1 - (G.STATE.day || 0));
};
})();
