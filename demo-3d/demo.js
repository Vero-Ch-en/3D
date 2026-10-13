'use strict';
/* =========================================================================
 * Cozy Birthday Simulator — 3D vertical-slice demo.
 * One evening in the house: bedroom + living room, Partner, cake, fireplace,
 * snow outside, and the first quiet turn toward the uncanny.
 * Units are metres. x → east, y → up, z → south.
 * ========================================================================= */
(() => {
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const MOBILE = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
function seeded(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

/* ---------------- quality presets ---------------- */
const PRESETS = {
  Low: { dpr: 1, shadows: false, ssao: false, bloom: 0.3, shadowSize: 512, motes: 120, snow: 1200 },
  High: { dpr: 1.5, shadows: true, ssao: false, bloom: 0.42, shadowSize: 1024, motes: 300, snow: 2600 },
  Epic: { dpr: 2, shadows: true, ssao: true, bloom: 0.48, shadowSize: 2048, motes: 420, snow: 4000 },
};
let qName = MOBILE ? 'Low' : 'High';
try { qName = localStorage.getItem('cbs.demo.quality') || qName; } catch (e) { /* storage unavailable */ }
if (!PRESETS[qName]) qName = 'High';
let Q = PRESETS[qName];

/* ---------------- renderer ---------------- */
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0f1c');
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
const ENV = 0.22; // global environment (bounce light) strength

/* ---------------- procedural textures ---------------- */
function noiseCanvas(size, fn) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = fn(x / size, y / size, x, y);
    const i = (y * size + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
const simplex = new THREE.SimplexNoise({ random: seeded(491) });
const fbm = (x, y, o = 4) => { let a = 0, f = 1, w = 0.5; for (let i = 0; i < o; i++) { a += w * simplex.noise(x * f, y * f); f *= 2; w *= 0.5; } return a; };
function tex(cv, rx, ry, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.encoding = THREE.sRGBEncoding;
  return t;
}
const TX = {};
function buildTextures() {
  // Oak floor planks: 8 planks across, staggered lengths.
  const plank = (u, v) => { const row = Math.floor(v * 8); const off = (row * 0.37) % 1; const len = Math.floor((u + off) * 2.5); return [row, len]; };
  const floorC = noiseCanvas(512, (u, v) => {
    const [row, seg] = plank(u, v);
    const tone = ((row * 17 + seg * 31) % 7) / 7;
    const grain = fbm(u * 3, v * 60 + row * 3.1, 3) * 0.5 + fbm(u * 40, v * 400, 2) * 0.12;
    const edge = (v * 8) % 1 < 0.035 || ((u + (row * 0.37) % 1) * 2.5) % 1 < 0.006 ? 0.45 : 1;
    const k = (0.78 + tone * 0.22 + grain * 0.35) * edge;
    return [168 * k, 112 * k, 70 * k];
  });
  const floorB = noiseCanvas(512, (u, v) => {
    const row = Math.floor(v * 8);
    const edge = (v * 8) % 1 < 0.035 || ((u + (row * 0.37) % 1) * 2.5) % 1 < 0.006 ? 40 : 160;
    const g = edge + fbm(u * 40, v * 400, 2) * 30;
    return [g, g, g];
  });
  TX.floor = tex(floorC, 1, 1); TX.floorB = tex(floorB, 1, 1, false);
  const plaster = noiseCanvas(256, (u, v) => { const n = fbm(u * 8, v * 8, 4) * 0.06 + fbm(u * 40, v * 40, 2) * 0.03; const k = 0.93 + n; return [232 * k, 214 * k, 188 * k]; });
  const plasterB = noiseCanvas(256, (u, v) => { const n = 128 + fbm(u * 30, v * 30, 3) * 70; return [n, n, n]; });
  TX.plaster = tex(plaster, 2, 1); TX.plasterB = tex(plasterB, 3, 2, false);
  const weave = (base, scale = 64) => noiseCanvas(256, (u, v) => {
    const w = (Math.sin(u * scale * Math.PI * 2) * Math.sin(v * scale * Math.PI * 2)) * 0.06;
    const n = fbm(u * 6, v * 6, 3) * 0.05;
    const k = 0.92 + w + n;
    return [base[0] * k, base[1] * k, base[2] * k];
  });
  TX.blanket = tex(weave([190, 92, 70], 48), 2, 2);
  TX.knit = tex(weave([214, 168, 96], 40), 3, 3);
  TX.sofa = tex(weave([92, 118, 94], 70), 2, 2);
  TX.linen = tex(weave([238, 232, 220], 80), 2, 2);
  TX.fabricB = tex(noiseCanvas(256, (u, v) => { const w = 128 + Math.sin(u * 64 * Math.PI * 2) * Math.sin(v * 64 * Math.PI * 2) * 60; return [w, w, w]; }), 2, 2, false);
  const rug = noiseCanvas(512, (u, v) => {
    const b = Math.min(u, v, 1 - u, 1 - v);
    let c = [122, 52, 46];
    if (b < 0.06) c = [70, 30, 30]; else if (b < 0.09) c = [214, 176, 120]; else if (b < 0.16) c = [96, 40, 40];
    const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx * 1.4, dy);
    if (b >= 0.16 && Math.abs(Math.sin(r * 26)) < 0.18) c = [196, 150, 96];
    const k = 0.9 + fbm(u * 50, v * 50, 2) * 0.12;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  TX.rug = tex(rug, 1, 1);
  const woodDark = noiseCanvas(256, (u, v) => { const g = fbm(u * 2, v * 30, 4) * 0.3 + 0.85; return [104 * g, 66 * g, 44 * g]; });
  TX.wood = tex(woodDark, 1, 1);
  const brick = noiseCanvas(512, (u, v) => {
    const row = Math.floor(v * 10), off = row % 2 ? 0.5 : 0;
    const bu = (u * 5 + off) % 1, bv = (v * 10) % 1;
    if (bu < 0.04 || bv < 0.08) { const g = 150 + fbm(u * 30, v * 30) * 30; return [g, g * 0.95, g * 0.9]; }
    const id = Math.floor(u * 5 + off) * 13 + row * 7;
    const t = 0.8 + ((id * 37) % 11) / 30 + fbm(u * 20, v * 20, 3) * 0.15;
    return [150 * t, 82 * t, 62 * t];
  });
  TX.brick = tex(brick, 1, 1);
  TX.brickB = tex(noiseCanvas(256, (u, v) => { const row = Math.floor(v * 10), off = row % 2 ? 0.5 : 0; const m = ((u * 5 + off) % 1 < 0.04 || (v * 10) % 1 < 0.08) ? 30 : 180 + fbm(u * 30, v * 30) * 40; return [m, m, m]; }), 1, 1, false);
}

/* ---------------- materials ---------------- */
const MATS = [];
function std(o) { const { env, ...rest } = o; const m = new THREE.MeshStandardMaterial(rest); m.envMapIntensity = env != null ? env : ENV; MATS.push(m); return m; }
let MAT;
function buildMaterials() {
  MAT = {
    floor: std({ map: TX.floor, bumpMap: TX.floorB, bumpScale: 0.004, roughness: 0.55, color: '#ffffff', env: 0.5 }),
    plaster: std({ map: TX.plaster, bumpMap: TX.plasterB, bumpScale: 0.002, roughness: 0.95 }),
    ceiling: std({ color: '#efe6d8', roughness: 1 }),
    beam: std({ map: TX.wood, color: '#a07a5a', roughness: 0.7 }),
    trim: std({ color: '#f1e9da', roughness: 0.5 }),
    wood: std({ map: TX.wood, color: '#ffffff', roughness: 0.55, env: 0.35 }),
    woodLight: std({ map: TX.wood, color: '#e8c8a0', roughness: 0.5, env: 0.35 }),
    blanket: std({ map: TX.blanket, bumpMap: TX.fabricB, bumpScale: 0.002, roughness: 1 }),
    linen: std({ map: TX.linen, bumpMap: TX.fabricB, bumpScale: 0.001, roughness: 1 }),
    knit: std({ map: TX.knit, bumpMap: TX.fabricB, bumpScale: 0.003, roughness: 1 }),
    sofa: std({ map: TX.sofa, bumpMap: TX.fabricB, bumpScale: 0.002, roughness: 1 }),
    rug: std({ map: TX.rug, bumpMap: TX.fabricB, bumpScale: 0.003, roughness: 1 }),
    brick: std({ map: TX.brick, bumpMap: TX.brickB, bumpScale: 0.01, roughness: 0.9 }),
    stone: std({ color: '#8d877e', roughness: 0.8 }),
    soot: std({ color: '#141010', roughness: 1 }),
    metal: std({ color: '#c9b48c', roughness: 0.3, metalness: 1, env: 1 }),
    darkMetal: std({ color: '#2a2724', roughness: 0.45, metalness: 0.8, env: 0.8 }),
    ceramic: std({ color: '#f4f1ea', roughness: 0.2, env: 0.9 }),
    glass: std({ color: '#cfe0f0', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, env: 1.2, depthWrite: false }),
    shade: std({ color: '#f3dfb6', roughness: 0.9, emissive: '#ffb860', emissiveIntensity: 0, side: THREE.DoubleSide }),
    book: (c) => std({ color: c, roughness: 0.8 }),
    cake: std({ color: '#f6e4ea', roughness: 0.6 }),
    icing: std({ color: '#e98aa4', roughness: 0.4, env: 0.6 }),
    candle: std({ color: '#86b8e6', roughness: 0.5 }),
    leaf: std({ color: '#4c7f43', roughness: 0.7, side: THREE.DoubleSide }),
    pot: std({ color: '#b8653f', roughness: 0.8 }),
    photo: std({ color: '#ffffff', roughness: 0.4, env: 0.6 }),
    frame: std({ color: '#3b2619', roughness: 0.5 }),
    snowGround: std({ color: '#dfe7f2', roughness: 0.9, env: 0.4 }),
    pine: std({ color: '#203a31', roughness: 0.9, flatShading: true }),
    pineSnow: std({ color: '#eef3fa', roughness: 0.8, flatShading: true }),
    bark: std({ color: '#3a2a20', roughness: 1 }),
  };
}

/* ---------------- world helpers ---------------- */
const world = new THREE.Group(); scene.add(world);
const COLL = [];           // walkable-space blockers: {x0,z0,x1,z1}
const CAMBLOCK = [];       // meshes the camera must not pass through
const INTER = [];          // interactables
function add(mesh, parent = world, cast = true, recv = true) { mesh.castShadow = cast; mesh.receiveShadow = recv; parent.add(mesh); return mesh; }
function box(w, h, d, mat, x, y, z, o = {}) {
  const g = o.r ? new THREE.RoundedBoxGeometry(w, h, d, o.seg || 3, o.r) : new THREE.BoxGeometry(w, h, d);
  if (o.uv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uv[0], uv.getY(i) * o.uv[1]); }
  const m = add(new THREE.Mesh(g, mat), o.parent || world, o.cast !== false, true);
  m.position.set(x, y, z);
  if (o.coll) COLL.push({ x0: x - w / 2 - (o.pad || 0), z0: z - d / 2 - (o.pad || 0), x1: x + w / 2 + (o.pad || 0), z1: z + d / 2 + (o.pad || 0) });
  if (o.cam) CAMBLOCK.push(m);
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, o = {}) {
  const m = add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 24, 1, !!o.open), mat), o.parent || world, o.cast !== false);
  m.position.set(x, y, z);
  return m;
}
function sph(r, mat, x, y, z, s = [1, 1, 1], parent = world, seg = 24) {
  const m = add(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), mat), parent);
  m.position.set(x, y, z); m.scale.set(s[0], s[1], s[2]);
  return m;
}

/* ---------------- the house ---------------- */
const WALL_H = 2.7, T = 0.16;
const HOUSE = { x0: 0, z0: 0, x1: 11, z1: 4.6 };
// Wall along x at z, from x0 to x1, with openings [{a,b,y0,y1}] in x.
function wallX(z, x0, x1, holes = [], face = 0) {
  const segs = []; let x = x0;
  holes.sort((p, q) => p.a - q.a).forEach((h) => { segs.push([x, h.a, 0, WALL_H]); if (h.y0 > 0) segs.push([h.a, h.b, 0, h.y0]); segs.push([h.a, h.b, h.y1, WALL_H]); x = h.b; });
  segs.push([x, x1, 0, WALL_H]);
  for (const [a, b, y0, y1] of segs) {
    if (b - a < 0.001 || y1 - y0 < 0.001) continue;
    const m = box(b - a, y1 - y0, T, MAT.plaster, (a + b) / 2, (y0 + y1) / 2, z, { cam: true, uv: [(b - a) / 2.5, (y1 - y0) / 2.7] });
    if (y0 === 0) COLL.push({ x0: a, z0: z - T / 2 - 0.05, x1: b, z1: z + T / 2 + 0.05 });
  }
  for (const h of holes) if (h.y0 === 0) { /* doorway: no collider */ }
}
function wallZ(x, z0, z1, holes = []) {
  const segs = []; let z = z0;
  holes.sort((p, q) => p.a - q.a).forEach((h) => { segs.push([z, h.a, 0, WALL_H]); if (h.y0 > 0) segs.push([h.a, h.b, 0, h.y0]); segs.push([h.a, h.b, h.y1, WALL_H]); z = h.b; });
  segs.push([z, z1, 0, WALL_H]);
  for (const [a, b, y0, y1] of segs) {
    if (b - a < 0.001 || y1 - y0 < 0.001) continue;
    box(T, y1 - y0, b - a, MAT.plaster, x, (y0 + y1) / 2, (a + b) / 2, { cam: true, uv: [(b - a) / 2.5, (y1 - y0) / 2.7] });
    if (y0 === 0) COLL.push({ x0: x - T / 2 - 0.05, z0: a, x1: x + T / 2 + 0.05, z1: b });
  }
}
function windowFrame(axis, c, a, b, y0, y1) {
  // axis 'x': window in a wall running along x at z=c; 'z': wall along z at x=c
  const fw = 0.06, depth = T + 0.04;
  const mk = (w, h, d, x, y, z) => box(w, h, d, MAT.trim, x, y, z, { cast: true });
  const mid = (a + b) / 2;
  if (axis === 'x') {
    mk(b - a + fw * 2, fw, depth, mid, y1 + fw / 2, c); mk(b - a + fw * 2, fw, depth + 0.12, mid, y0 - fw / 2, c);
    mk(fw, y1 - y0, depth, a - fw / 2, (y0 + y1) / 2, c); mk(fw, y1 - y0, depth, b + fw / 2, (y0 + y1) / 2, c);
    mk(0.04, y1 - y0, depth * 0.5, mid, (y0 + y1) / 2, c); mk(b - a, 0.04, depth * 0.5, mid, (y0 + y1) / 2, c);
    const g = box(b - a, y1 - y0, 0.01, MAT.glass, mid, (y0 + y1) / 2, c, { cast: false }); g.renderOrder = 2;
  } else {
    mk(depth, fw, b - a + fw * 2, c, y1 + fw / 2, mid); mk(depth + 0.12, fw, b - a + fw * 2, c, y0 - fw / 2, mid);
    mk(depth, y1 - y0, fw, c, (y0 + y1) / 2, a - fw / 2); mk(depth, y1 - y0, fw, c, (y0 + y1) / 2, b + fw / 2);
    mk(depth * 0.5, y1 - y0, 0.04, c, (y0 + y1) / 2, mid); mk(depth * 0.5, 0.04, b - a, c, (y0 + y1) / 2, mid);
    const g = box(0.01, y1 - y0, b - a, MAT.glass, c, (y0 + y1) / 2, mid, { cast: false }); g.renderOrder = 2;
  }
}
function curtains(axis, c, a, b, inward) {
  const mat = std({ color: '#8a3b33', roughness: 1, side: THREE.DoubleSide });
  for (const s of [a - 0.35, b + 0.05]) {
    const geo = new THREE.PlaneGeometry(0.32, 2.3, 8, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 40) * 0.035);
    geo.computeVertexNormals();
    const m = add(new THREE.Mesh(geo, mat));
    if (axis === 'x') { m.position.set(s + 0.15, 1.3, c + inward * 0.14); }
    else { m.position.set(c + inward * 0.14, 1.3, s + 0.15); m.rotation.y = Math.PI / 2; }
  }
}

function buildHouse() {
  const { x1, z1 } = HOUSE;
  // Floor + ceiling
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(x1, z1), MAT.floor), world, false, true);
  floor.rotation.x = -Math.PI / 2; floor.position.set(x1 / 2, 0, z1 / 2);
  const fuv = floor.geometry.attributes.uv; for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * x1 / 2, fuv.getY(i) * z1 / 2);
  const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(x1, z1), MAT.ceiling), world, false, true);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(x1 / 2, WALL_H, z1 / 2);
  CAMBLOCK.push(ceil);
  for (let x = 1.2; x < x1; x += 1.6) box(0.14, 0.16, z1, MAT.beam, x, WALL_H - 0.08, z1 / 2, { cast: false });
  // Outer walls
  wallX(0, 0, x1, []);                                                   // north
  wallX(z1, 0, x1, []);                                                  // south
  wallZ(0, 0, z1, [{ a: 1.5, b: 3.0, y0: 0.85, y1: 2.15 }]);             // west (bedroom window)
  wallZ(x1, 0, z1, [{ a: 1.4, b: 3.2, y0: 0.7, y1: 2.2 }]);              // east (living-room window)
  wallZ(5, 0, z1, [{ a: 3.0, b: 4.0, y0: 0, y1: 2.15 }]);                // dividing wall with doorway
  windowFrame('z', 0, 1.5, 3.0, 0.85, 2.15); curtains('z', 0, 1.5, 3.0, 1);
  windowFrame('z', x1, 1.4, 3.2, 0.7, 2.2); curtains('z', x1, 1.4, 3.2, -1);
  // Door frame trim in the dividing wall
  box(0.24, 0.08, 1.1, MAT.trim, 5, 2.19, 3.5); box(0.24, 2.15, 0.06, MAT.trim, 5, 1.075, 2.97); box(0.24, 2.15, 0.06, MAT.trim, 5, 1.075, 4.03);
  // Skirting boards
  const skirt = (w, d, x, z) => box(w, 0.1, d, MAT.trim, x, 0.05, z, { cast: false });
  skirt(x1, 0.02, x1 / 2, T / 2 + 0.01); skirt(x1, 0.02, x1 / 2, z1 - T / 2 - 0.01);
  skirt(0.02, z1, T / 2 + 0.01, z1 / 2); skirt(0.02, z1, x1 - T / 2 - 0.01, z1 / 2);
  // House bounds for the player
  COLL.push({ x0: -5, z0: -5, x1: 0.1, z1: z1 + 5 }, { x0: x1 - 0.1, z0: -5, x1: x1 + 5, z1: z1 + 5 }, { x0: -5, z0: -5, x1: x1 + 5, z1: 0.1 }, { x0: -5, z0: z1 - 0.1, x1: x1 + 5, z1: z1 + 5 });
}

/* ---------------- furniture ---------------- */
const LAMPS = [];
function tableLamp(x, z, on = true) {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  cyl(0.07, 0.09, 0.03, MAT.metal, 0, 0.62, 0, { parent: g });
  cyl(0.012, 0.012, 0.28, MAT.metal, 0, 0.77, 0, { parent: g });
  const shade = cyl(0.11, 0.16, 0.2, MAT.shade.clone(), 0, 0.98, 0, { parent: g, open: true, cast: false });
  shade.material.side = THREE.DoubleSide; MATS.push(shade.material);
  const light = new THREE.PointLight('#ffb867', 0, 6, 2);
  light.position.set(0, 0.95, 0); g.add(light);
  const L = { g, light, shade, on, power: 6, kind: 'lamp', flick: 1 };
  LAMPS.push(L);
  return L;
}
function floorLamp(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  cyl(0.16, 0.18, 0.03, MAT.darkMetal, 0, 0.015, 0, { parent: g });
  cyl(0.015, 0.015, 1.5, MAT.darkMetal, 0, 0.77, 0, { parent: g });
  const shade = cyl(0.17, 0.24, 0.32, MAT.shade.clone(), 0, 1.6, 0, { parent: g, open: true, cast: false });
  shade.material.side = THREE.DoubleSide; MATS.push(shade.material);
  const light = new THREE.PointLight('#ffb867', 0, 8, 2);
  light.position.set(0, 1.55, 0); g.add(light);
  const L = { g, light, shade, on: true, power: 10, kind: 'lamp', flick: 1 };
  LAMPS.push(L);
  COLL.push({ x0: x - 0.2, z0: z - 0.2, x1: x + 0.2, z1: z + 0.2 });
  return L;
}
let CAKE, FIRE, PHOTO3;
function buildFurniture() {
  /* ---- bedroom (x 0..5) ---- */
  const bx = 2.4, bz = 1.15;  // bed centre; headboard against north wall
  box(1.75, 0.32, 2.15, MAT.wood, bx, 0.16, bz + 0.1, { coll: true, r: 0.03 });
  box(1.85, 1.15, 0.08, MAT.wood, bx, 0.58, 0.14, { r: 0.03 });
  box(1.66, 0.22, 2.0, MAT.linen, bx, 0.43, bz + 0.12, { r: 0.08, seg: 4 });
  box(0.62, 0.14, 0.4, MAT.linen, bx - 0.42, 0.6, 0.48, { r: 0.07, seg: 4 }).rotation.x = -0.15;
  box(0.62, 0.14, 0.4, MAT.linen, bx + 0.42, 0.6, 0.48, { r: 0.07, seg: 4 }).rotation.x = -0.1;
  const blanket = box(1.78, 0.08, 1.45, MAT.blanket, bx + 0.05, 0.56, bz + 0.45, { r: 0.04, seg: 3 });
  blanket.rotation.z = 0.015;
  box(0.9, 0.05, 0.55, MAT.knit, bx + 0.5, 0.62, bz + 0.95, { r: 0.025 }).rotation.y = 0.2;
  // Nightstands + lamps
  for (const s of [-1, 1]) {
    box(0.48, 0.58, 0.42, MAT.woodLight, bx + s * 1.25, 0.29, 0.38, { coll: true, r: 0.02 });
    box(0.4, 0.02, 0.01, MAT.metal, bx + s * 1.25, 0.42, 0.595);
  }
  const lampL = tableLamp(bx - 1.25, 0.38), lampR = tableLamp(bx + 1.25, 0.38);
  lampR.on = false;
  INTER.push({ id: 'lampL', pos: [bx - 1.25, 0.8, 0.6], r: 1.1, label: 'Lamp', act: () => toggleLamp(lampL) });
  INTER.push({ id: 'lampR', pos: [bx + 1.25, 0.8, 0.6], r: 1.1, label: 'Lamp', act: () => toggleLamp(lampR) });
  // Wardrobe
  box(1.1, 2.1, 0.6, MAT.wood, 4.35, 1.05, 0.42, { coll: true, cam: true, r: 0.02 });
  box(0.01, 1.9, 0.01, MAT.soot, 4.35, 1.05, 0.725);
  sph(0.025, MAT.metal, 4.29, 1.1, 0.74); sph(0.025, MAT.metal, 4.41, 1.1, 0.74);
  INTER.push({ id: 'wardrobe', pos: [4.35, 1, 0.9], r: 1.1, label: 'Wardrobe', act: () => say(null, '(Your hoodie is in here. Correction: it was. It belongs to {P} now, permanently.)') });
  // Rug
  const rug = add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), MAT.rug), world, false, true);
  rug.rotation.x = -Math.PI / 2; rug.position.set(bx, 0.006, 3.15);
  // Laundry basket
  cyl(0.22, 0.18, 0.42, MAT.knit, 0.45, 0.21, 4.1, { seg: 20 });
  COLL.push({ x0: 0.2, z0: 3.85, x1: 0.7, z1: 4.35 });
  /* ---- living room (x 5..11) ---- */
  // Fireplace on the north wall
  const fx = 8.0;
  box(1.9, 1.25, 0.5, MAT.brick, fx, 0.625, 0.33, { coll: true, cam: true, uv: [1.6, 1.0] });
  box(2.1, 0.1, 0.62, MAT.woodLight, fx, 1.3, 0.36, { r: 0.02 });
  box(0.95, 0.75, 0.12, MAT.soot, fx, 0.4, 0.38, { cast: false });
  box(0.95, 0.04, 0.3, MAT.soot, fx, 0.04, 0.55, { cast: false });
  box(1.6, 0.04, 0.5, MAT.stone, fx, 0.02, 0.85, { cast: false });
  const logA = cyl(0.06, 0.06, 0.6, MAT.bark, fx - 0.05, 0.12, 0.6); logA.rotation.z = Math.PI / 2; logA.rotation.y = 0.3;
  const logB = cyl(0.055, 0.055, 0.55, MAT.bark, fx + 0.05, 0.2, 0.6); logB.rotation.z = Math.PI / 2; logB.rotation.y = -0.4;
  FIRE = buildFire(fx, 0.14, 0.6);
  INTER.push({ id: 'fire', pos: [fx, 0.6, 1.0], r: 1.3, label: () => (FIRE.on ? 'Fireplace' : 'Light the fire'), act: () => toggleFire() });
  // Mantle things: candles + snow globe + frame
  sph(0.07, std({ color: '#dcebfa', roughness: 0.02, transparent: true, opacity: 0.35, env: 1.5 }), fx + 0.65, 1.43, 0.3);
  cyl(0.07, 0.08, 0.05, MAT.wood, fx + 0.65, 1.37, 0.3);
  // Sofa facing the fire
  const sx = 8.0, sz = 2.95;
  box(2.1, 0.42, 0.9, MAT.sofa, sx, 0.21, sz, { coll: true, r: 0.06, seg: 4 });
  box(2.1, 0.55, 0.22, MAT.sofa, sx, 0.62, sz + 0.38, { r: 0.08, seg: 4 });
  box(0.2, 0.62, 0.9, MAT.sofa, sx - 1.05, 0.31, sz, { r: 0.08, seg: 4 }); box(0.2, 0.62, 0.9, MAT.sofa, sx + 1.05, 0.31, sz, { r: 0.08, seg: 4 });
  box(0.92, 0.14, 0.62, MAT.sofa, sx - 0.47, 0.49, sz - 0.08, { r: 0.06, seg: 4 }); box(0.92, 0.14, 0.62, MAT.sofa, sx + 0.47, 0.49, sz - 0.08, { r: 0.06, seg: 4 });
  const pil = box(0.42, 0.38, 0.12, MAT.knit, sx - 0.7, 0.72, sz + 0.2, { r: 0.05, seg: 3 }); pil.rotation.set(-0.3, 0.3, 0.1);
  box(1.2, 0.03, 0.75, MAT.knit, sx + 0.4, 0.58, sz + 0.05, { r: 0.012 }).rotation.y = -0.1;
  INTER.push({ id: 'sofa', pos: [sx, 0.5, sz - 0.5], r: 1.0, label: 'Sofa', act: () => say(null, '(The sofa makes a noise like it’s been waiting for you.)') });
  // Coffee table with the birthday cake
  const tx = 8.0, tz = 1.75;
  box(1.1, 0.05, 0.6, MAT.woodLight, tx, 0.42, tz, { r: 0.015 });
  for (const [a, b] of [[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]]) box(0.05, 0.4, 0.05, MAT.woodLight, tx + a, 0.2, tz + b);
  COLL.push({ x0: tx - 0.58, z0: tz - 0.33, x1: tx + 0.58, z1: tz + 0.33 });
  CAKE = buildCake(tx, 0.445, tz);
  INTER.push({ id: 'cake', pos: [tx, 0.6, tz], r: 1.1, label: () => (CAKE.lit ? 'Make a wish' : 'Cake'), act: () => blowCandles() });
  // Armchair
  const ax = 6.2, az = 1.9;
  const chair = new THREE.Group(); chair.position.set(ax, 0, az); chair.rotation.y = 0.9; world.add(chair);
  const cm = std({ color: '#8f3f36', roughness: 1, map: TX.linen });
  box(0.85, 0.42, 0.8, cm, 0, 0.21, 0, { parent: chair, r: 0.06, seg: 4 });
  box(0.85, 0.62, 0.2, cm, 0, 0.72, 0.32, { parent: chair, r: 0.07, seg: 4 });
  box(0.16, 0.55, 0.8, cm, -0.42, 0.33, 0, { parent: chair, r: 0.06, seg: 4 }); box(0.16, 0.55, 0.8, cm, 0.42, 0.33, 0, { parent: chair, r: 0.06, seg: 4 });
  COLL.push({ x0: ax - 0.5, z0: az - 0.5, x1: ax + 0.5, z1: az + 0.5 });
  // Bookshelf on the east wall
  const shx = 10.75, shz = 3.85;
  box(0.36, 2.0, 1.2, MAT.wood, shx, 1.0, shz, { coll: true, cam: true });
  const cols = ['#7b2f28', '#2f4a62', '#b58a3c', '#4b6b4f', '#6a4f7a', '#a8603a', '#d9cdb4', '#3a3a3a'];
  const r = seeded(7);
  for (let row = 0; row < 4; row++) {
    const y = 0.12 + row * 0.47;
    box(0.32, 0.025, 1.14, MAT.wood, shx - 0.02, y, shz);
    let z = shz - 0.53;
    while (z < shz + 0.5) {
      const w = 0.035 + r() * 0.04, h = 0.24 + r() * 0.14;
      const bk = box(0.22, h, w, MAT.book(cols[Math.floor(r() * cols.length)]), shx - 0.06, y + h / 2 + 0.013, z + w / 2, { cast: false });
      if (r() < 0.12) { bk.rotation.x = 0.25; }
      z += w + 0.005;
    }
  }
  // Floor lamp + plant
  floorLamp(10.4, 0.5);
  cyl(0.17, 0.13, 0.36, MAT.pot, 5.55, 0.18, 0.45, { seg: 20 });
  COLL.push({ x0: 5.3, z0: 0.2, x1: 5.8, z1: 0.7 });
  const lr = seeded(3);
  for (let i = 0; i < 14; i++) {
    const leaf = add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI), MAT.leaf));
    leaf.scale.set(0.45, 1, 0.12); const a = lr() * Math.PI * 2;
    leaf.position.set(5.55 + Math.cos(a) * 0.12, 0.5 + lr() * 0.4, 0.45 + Math.sin(a) * 0.12);
    leaf.rotation.set(Math.sin(a) * 0.7, a, Math.cos(a) * 0.7);
  }
  // Rug (living)
  const rug2 = add(new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.9), MAT.rug), world, false, true);
  rug2.rotation.x = -Math.PI / 2; rug2.position.set(8, 0.006, 2.1);
  // Photos on the dividing wall (living-room side), one of them the snow photograph.
  PHOTO3 = photoFrame(5.09, 1.55, 1.4, 'snow');
  photoFrame(5.09, 1.45, 0.75, 'lake');
  INTER.push({ id: 'photo', pos: [5.2, 1.5, 1.4], r: 1.0, label: 'Photo', act: () => inspectPhoto() });
  INTER.push({ id: 'photo2', pos: [5.2, 1.4, 0.75], r: 0.8, label: 'Photo', act: () => say(null, '(The lake trip. Someone sneezed at the exact moment. It was {P}.)') });
  INTER.push({ id: 'windowW', pos: [0.3, 1.4, 2.25], r: 1.1, label: 'Window', act: () => say(null, STATE.horror ? '(The snow isn’t falling any more. It’s just… hanging there.)' : '(Snow, heavy and silent, all the way to the trees.)') });
  INTER.push({ id: 'windowE', pos: [10.7, 1.4, 2.3], r: 1.1, label: 'Window', act: () => say(null, '(The garden is gone under the snow. Somebody’s wind chime, three gardens over.)') });
}
function photoFrame(x, y, z, art) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.PI / 2; world.add(g);
  box(0.46, 0.36, 0.03, MAT.frame, 0, 0, 0, { parent: g });
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192;
  drawPhoto(cv.getContext('2d'), art, false);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  const p = add(new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.28), std({ map: t, roughness: 0.35, env: 0.6 })), g, false);
  p.position.z = 0.017;
  return { g, cv, t };
}
function drawPhoto(ctx, art, third) {
  const W = 256, H = 192;
  if (art === 'lake') {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9cc8e4'); g.addColorStop(1, '#eef4f8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#5d93b5'; ctx.fillRect(0, H * 0.48, W, H * 0.25); ctx.fillStyle = '#6f9b55'; ctx.fillRect(0, H * 0.72, W, H);
    fig(ctx, W * 0.43, H * 0.9, '#46678c', 1.3); fig(ctx, W * 0.57, H * 0.92, '#c48a31', 1.0);
    return;
  }
  ctx.fillStyle = '#dfe5ea'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#aab4c0'; ctx.fillRect(0, 0, W, H * 0.36);
  for (let i = 0; i < 9; i++) { const tx = (i * 37) % W; ctx.fillStyle = '#5e6c68'; ctx.beginPath(); ctx.moveTo(tx, H * 0.4); ctx.lineTo(tx - 10, H * 0.4); ctx.lineTo(tx - 5, H * 0.1); ctx.fill(); }
  for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(255,214,140,${0.5})`; ctx.beginPath(); ctx.arc(30 + i * 40, 30, 3, 0, 7); ctx.fill(); }
  fig(ctx, W * 0.45, H * 0.75, '#6d7684', 0.8); fig(ctx, W * 0.55, H * 0.75, '#8a7f73', 0.72);
  if (third) { ctx.globalAlpha = 0.35; ctx.filter = 'blur(2px)'; fig(ctx, W * 0.88, H * 0.66, '#c9d6e6', 1.1); ctx.filter = 'none'; ctx.globalAlpha = 1; }
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 70; i++) ctx.fillRect((i * 71) % W, (i * 43) % H, 1.5, 1.5);
  ctx.fillStyle = 'rgba(120,90,60,0.12)'; ctx.fillRect(0, 0, W, H);
}
function fig(ctx, x, y, col, s) {
  ctx.fillStyle = '#e1b08e'; ctx.beginPath(); ctx.arc(x, y - 22 * s, 6 * s, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 7 * s, y); ctx.lineTo(x + 7 * s, y); ctx.lineTo(x + 5 * s, y - 16 * s); ctx.lineTo(x - 5 * s, y - 16 * s); ctx.fill();
}

/* ---------------- fire, candles ---------------- */
function flameMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform float uTime; uniform float uPower; uniform vec3 uColor; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = vUv; float y = uv.y;
        float w = n(vec2(uv.x*4.0, y*3.0 - uTime*3.2))*0.55 + n(vec2(uv.x*9.0, y*7.0 - uTime*5.0))*0.3;
        float shape = 1.0 - smoothstep(0.0, 0.5 - y*0.42, abs(uv.x - 0.5 + (w-0.4)*0.25*y));
        float f = shape * (1.0 - y) * smoothstep(0.0, 0.12, y) * (0.6 + w);
        f = clamp(f * 1.6, 0.0, 1.0) * uPower;
        vec3 c = mix(uColor, vec3(1.0, 0.95, 0.75), smoothstep(0.55, 1.0, f));
        gl_FragColor = vec4(c * f * 3.0, f);
      }`,
  });
}
const FLAMES = [];
function buildFire(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); world.add(g);
  const planes = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), flameMaterial('#ff7a2a'));
    m.position.set((i - 1) * 0.14, 0.33, 0); m.rotation.y = (i - 1) * 0.6; g.add(m); planes.push(m); FLAMES.push(m);
  }
  const light = new THREE.PointLight('#ff8a3a', 0, 9, 2);
  light.position.set(x, 0.5, z + 0.55); world.add(light);
  light.castShadow = true; light.shadow.bias = -0.004; light.shadow.radius = 4;
  return { g, planes, light, on: true, power: 7, level: 1 };
}
function buildCake(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); world.add(g);
  cyl(0.19, 0.19, 0.012, MAT.ceramic, 0, 0.006, 0, { parent: g, seg: 32 });
  cyl(0.15, 0.15, 0.13, MAT.cake, 0, 0.077, 0, { parent: g, seg: 32 });
  cyl(0.152, 0.152, 0.02, MAT.icing, 0, 0.12, 0, { parent: g, seg: 32 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; sph(0.016, MAT.icing, Math.cos(a) * 0.13, 0.145, Math.sin(a) * 0.13, [1, 1, 1], g, 8); }
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, cx = Math.cos(a) * 0.075, cz = Math.sin(a) * 0.075;
    cyl(0.006, 0.006, 0.07, MAT.candle, cx, 0.175, cz, { parent: g, seg: 8 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.05), flameMaterial('#ffb24a'));
    f.position.set(cx, 0.235, cz); g.add(f); flames.push(f); FLAMES.push(f);
  }
  const light = new THREE.PointLight('#ffb867', 0, 3, 2);
  light.position.set(0, 0.32, 0); g.add(light);
  return { g, flames, light, lit: true, blown: false };
}

/* ---------------- outside: sky, moon, pines, snow ---------------- */
let SNOW, MOTES, SKY;
function buildOutside() {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uHorror: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uHorror; varying vec3 vP;
      void main(){ float h = vP.y;
        vec3 top = vec3(0.02,0.03,0.09), mid = vec3(0.08,0.13,0.28), hor = vec3(0.42,0.36,0.46);
        vec3 c = mix(hor, mid, smoothstep(-0.02, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.7, h));
        c = mix(c, vec3(0.62,0.66,0.72)*0.55, uHorror*smoothstep(0.3,-0.1,h));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  SKY = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), skyMat); SKY.position.set(5.5, 0, 2.3); scene.add(SKY);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: '#e8eefc' }));
  moon.position.set(-55, 22, -20); scene.add(moon);
  const ground = add(new THREE.Mesh(new THREE.PlaneGeometry(220, 220), MAT.snowGround), scene, false, true);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
  // Pine forest ring
  const r = seeded(11), coneG = new THREE.ConeGeometry(1, 1, 8), capG = new THREE.ConeGeometry(1, 1, 8);
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2, d = 7 + r() * 34;
    const x = 5.5 + Math.cos(a) * d * 1.3, z = 2.3 + Math.sin(a) * d;
    if (x > -2.5 && x < 13.5 && z > -2.5 && z < 7) continue;
    const s = 1.3 + r() * 1.8;
    const t = new THREE.Group(); t.position.set(x, 0, z); scene.add(t);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.9 * s, 6), MAT.bark); tr.position.y = 0.45 * s; t.add(tr);
    for (let k = 0; k < 4; k++) {
      const c = new THREE.Mesh(coneG, MAT.pine); const rr = (1.2 - k * 0.24) * s, hh = 1.4 * s;
      c.scale.set(rr, hh, rr); c.position.y = (1.1 + k * 0.85) * s; c.rotation.y = r() * 3; c.castShadow = i % 3 === 0; t.add(c);
      const cap = new THREE.Mesh(capG, MAT.pineSnow); cap.scale.set(rr * 0.62, hh * 0.45, rr * 0.62); cap.position.y = (1.1 + k * 0.85 + 0.42) * s; t.add(cap);
    }
  }
  // Moonlight: cold spot through the west (bedroom) window, and soft fill from the east.
  const moonSpot = new THREE.SpotLight('#9fb6ff', 0, 30, 0.45, 0.6, 2);
  moonSpot.position.set(-7, 6.5, 2.2); moonSpot.target.position.set(1.8, 0, 2.3);
  moonSpot.castShadow = true; moonSpot.shadow.bias = -0.0005;
  scene.add(moonSpot); scene.add(moonSpot.target);
  const moonFill = new THREE.DirectionalLight('#7f93c8', 0.0); moonFill.position.set(-30, 25, -10); scene.add(moonFill);
  // Fake light shafts from the west window.
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uI: { value: 0.05 }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uI; uniform float uTime; varying vec2 vUv; void main(){ float a = smoothstep(0.0,0.25,vUv.x)*smoothstep(1.0,0.6,vUv.x)*smoothstep(0.0,0.15,vUv.y)*smoothstep(1.0,0.85,vUv.y); a *= 0.8 + 0.2*sin(vUv.x*40.0 + uTime*0.5); gl_FragColor = vec4(vec3(0.62,0.72,1.0)*a*uI, a*uI); }',
  });
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), shaftMat);
  shaft.position.set(1.15, 1.0, 2.25); shaft.rotation.set(0, 0, -0.55); shaft.renderOrder = 3; world.add(shaft);
  const shaft2 = shaft.clone(); shaft2.rotation.set(Math.PI / 2, 0, -0.55); shaft2.position.set(1.15, 1.0, 2.25); world.add(shaft2);
  STATE.moon = { spot: moonSpot, fill: moonFill, shaft: shaftMat };
}
function snowSystem(n) {
  const pos = new Float32Array(n * 3), spd = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = rand(-10, 21); pos[i * 3 + 1] = rand(0, 9); pos[i * 3 + 2] = rand(-10, 14); spd[i] = rand(0.35, 0.9); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('spd', new THREE.BufferAttribute(spd, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uIndoor: { value: 0 }, uFrozen: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `
      attribute float spd; uniform float uTime; uniform float uIndoor; uniform float uFrozen; uniform float uPx; varying float vA;
      void main(){
        vec3 p = position;
        float t = uTime * (1.0 - uFrozen);
        p.y = mod(p.y - t * spd, 9.0);
        p.x += sin(t * 0.7 + position.z) * 0.25 + t * 0.12; p.x = mod(p.x + 10.0, 31.0) - 10.0;
        p.z += cos(t * 0.5 + position.x) * 0.2;
        bool inside = p.x > 0.05 && p.x < 10.95 && p.z > 0.05 && p.z < 4.55 && p.y < 2.65;
        vA = inside ? uIndoor : 1.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (vA > 0.01 ? 16.0 : 0.0) * uPx / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.92,0.95,1.0), smoothstep(0.5, 0.1, d) * 0.85 * vA); }',
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  return pts;
}
function moteSystem(n) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rand(0.2, 10.8); pos[i * 3 + 1] = rand(0.2, 2.5); pos[i * 3 + 2] = rand(0.2, 4.4); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uI: { value: 1 }, uPx: { value: 1 } },
    vertexShader: 'uniform float uTime; uniform float uPx; varying float vA; void main(){ vec3 p = position; p.x += sin(uTime*0.13 + position.y*3.0)*0.2; p.y += sin(uTime*0.09 + position.x*2.0)*0.15; p.z += cos(uTime*0.11 + position.x)*0.2; vec4 mv = modelViewMatrix*vec4(p,1.0); vA = 0.5 + 0.5*sin(uTime*0.8 + position.x*13.0); gl_PointSize = 3.5 * uPx / -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float uI; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(vec3(1.0,0.85,0.6)*smoothstep(0.5,0.0,d)*0.35*vA*uI, 1.0); }',
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; scene.add(p);
  return p;
}

/* =====================================================================
 * Characters: mannequin-style humans with real joints.
 * ===================================================================== */
function makeHuman(o) {
  // Anthropometric proportions (fractions of stature, after Drillis & Contini):
  // hip joint 0.53H, shoulder 0.82H, chin 0.87H, head 0.13H tall, upper arm 0.186H,
  // forearm 0.146H, hand 0.108H, thigh 0.245H, shin 0.246H, ankle 0.039H, foot 0.152H.
  const H = o.height, k = H / 1.75;
  const fem = !!o.fem;
  const W = fem ? { hip: 0.172, waist: 0.128, chest: 0.152, sh: 0.158, shoulderX: 0.158 } : { hip: 0.162, waist: 0.145, chest: 0.178, sh: 0.188, shoulderX: 0.188 };
  const skin = std({ color: o.skin, roughness: 0.5, env: 0.35 });
  const top = std({ color: o.knit ? '#ffffff' : o.top, roughness: 0.95, map: o.knit ? TX.knit : TX.linen, bumpMap: TX.fabricB, bumpScale: 0.002 });
  const pants = std({ color: o.pants, roughness: 0.9, map: TX.linen, bumpMap: TX.fabricB, bumpScale: 0.001 });
  const hairM = std({ color: o.hair, roughness: 0.55, env: 0.45 });
  const sock = std({ color: o.socks || '#ddd6cc', roughness: 1, map: TX.linen });
  const sole = std({ color: '#3a3330', roughness: 0.8 });
  const eyeW = std({ color: '#efe9e2', roughness: 0.15, env: 1 });
  const iris = std({ color: o.eyes || '#3b2a1e', roughness: 0.1, env: 1.4 });
  const lip = std({ color: o.lips || '#b0645a', roughness: 0.45 });
  const root = new THREE.Group();
  const M = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * k, y * k, z * k); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  // Lathe profiles must run bottom-to-top, or the faces point inward.
  const lathe = (pts, seg = 28) => { const P = pts[0][1] > pts[pts.length - 1][1] ? pts.slice().reverse() : pts; return new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r) * k, y * k)), seg); };
  const ell = (rx, ry, rz, mat, parent, x, y, z, seg = 20) => { const m = M(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), mat, parent, x, y, z); m.scale.set(rx * k, ry * k, rz * k); return m; };

  /* ---- pelvis & torso ---- */
  const hipY = 0.53 * 1.75;
  const hips = new THREE.Group(); hips.position.y = hipY * k; root.add(hips);
  const pelvis = M(lathe([[0, -0.13], [W.hip * 0.62, -0.115], [W.hip * 0.95, -0.06], [W.hip, 0.0], [W.hip * 0.97, 0.06], [W.waist * 1.02, 0.13], [0, 0.135]]), pants, hips);
  pelvis.scale.z = 0.7;
  const belt = M(new THREE.TorusGeometry(W.waist * 1.02 * k, 0.009 * k, 8, 32), sole, hips, 0, 0.118, 0); belt.rotation.x = Math.PI / 2; belt.scale.y = 0.7;
  const spine = new THREE.Group(); spine.position.y = 0.1 * k; hips.add(spine);
  const bust = fem ? 0.012 : 0;
  const torso = M(lathe([
    [W.waist * 1.06, 0.0], [W.waist * 1.02, 0.05], [W.waist, 0.1], [(W.waist + W.chest) / 2, 0.18],
    [W.chest + bust, 0.27], [W.chest + bust * 0.5, 0.33], [W.chest * 1.02, 0.38], [W.sh, 0.43],
    [W.sh * 0.88, 0.47], [0.1, 0.5], [0.064, 0.52], [0, 0.522],
  ], 32), top, spine);
  torso.scale.z = fem ? 0.68 : 0.64;
  // Sweater hem
  const hem = M(new THREE.TorusGeometry(W.waist * 1.06 * k, 0.01 * k, 8, 32), top, spine, 0, 0.005, 0); hem.rotation.x = Math.PI / 2; hem.scale.y = fem ? 0.68 : 0.64;
  const chest = new THREE.Group(); chest.position.y = 0.36 * k; spine.add(chest);

  /* ---- neck & head ---- */
  const neck = new THREE.Group(); neck.position.y = 0.135 * k; chest.add(neck);
  M(new THREE.CylinderGeometry(0.05 * k, 0.058 * k, 0.11 * k, 20), skin, neck, 0, 0.04, 0.005);
  M(new THREE.TorusGeometry(0.06 * k, 0.012 * k, 8, 24), top, neck, 0, -0.002, 0).rotation.x = Math.PI / 2;  // collar
  const head = new THREE.Group(); head.position.set(0, 0.155 * k, 0.012 * k); neck.add(head);
  // Skull: 0.155 wide, 0.23 tall (incl. jaw), 0.19 deep.
  ell(0.077, 0.098, 0.094, skin, head, 0, 0.02, -0.005, 32);
  ell(0.064, 0.064, 0.072, skin, head, 0, -0.036, 0.0, 24);                 // cheeks/jaw
  ell(0.03, 0.022, 0.03, skin, head, 0, -0.084, 0.036, 16);                 // chin
  const nose = M(new THREE.ConeGeometry(0.013 * k, 0.038 * k, 12), skin, head, 0, -0.012, 0.09); nose.rotation.x = Math.PI / 2 - 0.35;
  ell(0.011, 0.009, 0.01, skin, head, 0, -0.03, 0.093, 12);                  // nose tip
  for (const s of [-1, 1]) {
    ell(0.012, 0.024, 0.016, skin, head, s * 0.077, -0.0, -0.005, 12);       // ears
    ell(0.0125, 0.0085, 0.006, eyeW, head, s * 0.03, 0.005, 0.083, 14);
    ell(0.0062, 0.0062, 0.003, iris, head, s * 0.03, 0.005, 0.0885, 12);
    const lid = ell(0.0135, 0.004, 0.008, skin, head, s * 0.03, 0.0125, 0.083, 12); lid.rotation.z = -s * 0.05;
    const brow = M(new THREE.BoxGeometry(0.026 * k, 0.0045 * k, 0.008 * k), hairM, head, s * 0.032, 0.026, 0.087); brow.rotation.z = -s * 0.1;
  }
  ell(0.019, 0.0055, 0.008, lip, head, 0, -0.058, 0.08, 14);
  ell(0.017, 0.0045, 0.007, lip, head, 0, -0.066, 0.077, 14);
  // Hair (conforms to skull: same scale basis)
  const hair = new THREE.Group(); hair.position.set(0, 0.02 * k, -0.005 * k); hair.scale.set(0.077 / 0.1, 0.098 / 0.1, 0.094 / 0.1); head.add(hair);
  const cap = M(new THREE.SphereGeometry(0.107, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM, hair, 0, 0.004, 0); cap.rotation.x = -0.2;
  M(new THREE.SphereGeometry(0.1, 24, 16), hairM, hair, 0, -0.012, -0.022).scale.set(1.02, 0.95, 0.9);
  if (o.hairStyle === 'bun') {
    ell(0.042, 0.04, 0.042, hairM, head, 0, 0.1, -0.085, 20);
    for (const [x, y, z, r] of [[-0.06, 0.07, 0.05, 0.022], [0.065, 0.06, 0.045, 0.02], [-0.02, 0.105, 0.055, 0.02]]) ell(r, r, r, hairM, head, x, y, z, 12);
    for (const s of [-1, 1]) ell(0.012, 0.045, 0.012, hairM, head, s * 0.07, -0.02, 0.035, 10);
  } else {
    for (const s of [-1, 1]) ell(0.01, 0.028, 0.03, hairM, head, s * 0.074, 0.025, 0.0, 10); // sideburn/temple fill
  }

  /* ---- arms ---- */
  const arms = [];
  const ua = 0.186 * 1.75, fa = 0.146 * 1.75;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * W.shoulderX * k, 0.07 * k, -0.005 * k); chest.add(sh);
    ell(0.05, 0.046, 0.05, top, sh, 0, -0.005, 0, 20);                // deltoid
    const up = M(lathe([[0.05, 0], [0.051, -0.05], [0.046, -0.15], [0.039, -ua + 0.02], [0.036, -ua]]), top, sh);
    up.scale.z = 0.92;
    const el = new THREE.Group(); el.position.y = -ua * k; sh.add(el);
    ell(0.035, 0.035, 0.034, top, el, 0, 0, 0, 14);
    M(lathe([[0.037, 0], [0.04, -0.06], [0.035, -0.15], [0.03, -fa + 0.03], [0.033, -fa + 0.01], [0.0, -fa + 0.008]]), top, el);   // sleeve with cuff
    M(new THREE.CylinderGeometry(0.022 * k, 0.025 * k, 0.03 * k, 14), skin, el, 0, -fa + 0.005, 0);                     // wrist
    const hand = new THREE.Group(); hand.position.y = -fa * k; el.add(hand);
    ell(0.017, 0.045, 0.038, skin, hand, 0, -0.04, 0, 18);                    // palm
    ell(0.014, 0.04, 0.034, skin, hand, s * 0.002, -0.095, 0.004, 16);         // fingers
    const th = ell(0.011, 0.028, 0.012, skin, hand, s * -0.004, -0.04, 0.038, 12); th.rotation.x = 0.5;  // thumb
    sh.rotation.z = s * 0.07;
    arms.push({ sh, el, hand, up });
  }

  /* ---- legs ---- */
  const legs = [];
  const tl = 0.245 * 1.75, sl = 0.246 * 1.75, ank = 0.039 * 1.75;
  for (const s of [-1, 1]) {
    const thg = new THREE.Group(); thg.position.set(s * (fem ? 0.088 : 0.085) * k, 0, 0); hips.add(thg);
    const tm = M(lathe([[0.088, 0.02], [0.085, -0.04], [0.074, -0.18], [0.06, -0.33], [0.052, -tl]]), pants, thg);
    tm.scale.z = 0.95;
    const kn = new THREE.Group(); kn.position.y = -tl * k; thg.add(kn);
    ell(0.05, 0.05, 0.048, pants, kn, 0, 0, 0, 14);
    M(lathe([[0.051, 0], [0.054, -0.09], [0.046, -0.2], [0.042, -sl + 0.03], [0.045, -sl + 0.01], [0, -sl + 0.005]]), pants, kn);
    const ft = new THREE.Group(); ft.position.y = -sl * k; kn.add(ft);
    M(new THREE.CylinderGeometry(0.03 * k, 0.034 * k, 0.04 * k, 14), sock, ft, 0, -0.005, 0);
    // Slipper/shoe: 0.152H long, heel under ankle, toes forward.
    const fl = 0.152 * 1.75;
    ell(0.042, 0.034, fl * 0.5, sock, ft, 0, -ank + 0.032, fl * 0.5 - 0.06, 22);
    const so = M(new THREE.BoxGeometry(0.08 * k, 0.016 * k, fl * k), sole, ft, 0, -ank + 0.008, fl * 0.5 - 0.06);
    so.scale.x = 1;
    legs.push({ th: thg, kn, ft });
  }
  root.userData = { hips, spine, chest, neck, head, arms, legs, k, H, hipY: hipY * k };
  scene.add(root);
  return root;
}

/* ---------------- characters & animation ---------------- */
const PLAYER = { m: null, x: 6.5, z: 2.9, yaw: Math.PI * 0.8, vx: 0, vz: 0, speed: 0, phase: 0, r: 0.25, sitT: 0, hug: 0, look: 0, name: 'You' };
const PARTNER = { m: null, x: 7.55, z: 2.8, yaw: Math.PI, speed: 0, phase: 0, r: 0.22, target: null, wait: 9, mode: 'sitting', sit: 1, look: 0, hug: 0, sit: 0, bark: null, name: 'Partner' };
function animate(c, dt, t) {
  const u = c.m.userData, k = u.k;
  c.m.position.set(c.x, 0, c.z);
  c.m.rotation.y = c.yaw;
  const sp = clamp(c.speed / 1.6, 0, 2);
  c.phase += dt * (4.2 + sp * 3.2) * Math.min(1, sp * 2);
  const ph = c.phase, w = Math.min(1, sp);
  const sit = c.sit || 0;
  // Legs
  u.legs.forEach((L, i) => {
    const p = ph + (i ? Math.PI : 0);
    L.th.rotation.x = lerp(Math.sin(p) * 0.55 * w, -1.45, sit);
    L.kn.rotation.x = lerp(Math.max(0, -Math.sin(p + 0.6)) * 1.0 * w + 0.03, 1.5, sit);
    L.ft.rotation.x = lerp(Math.sin(p) * 0.2 * w, 0.0, sit);
  });
  u.hips.position.y = lerp(u.hipY, 0.6, sit) - Math.abs(Math.sin(ph)) * 0.03 * w;
  u.hips.rotation.y = Math.sin(ph) * 0.12 * w;
  u.spine.rotation.y = -Math.sin(ph) * 0.18 * w;
  u.spine.rotation.x = 0.05 * w * (sp > 1.2 ? 2.5 : 1) - sit * 0.05;
  // Breathing
  const br = Math.sin(t * 1.6 + c.x) * 0.012;
  u.chest.scale.set(1 + br, 1 + br * 0.5, 1 + br);
  // Arms
  u.arms.forEach((A, i) => {
    const s = i ? 1 : -1, p = ph + (i ? 0 : Math.PI);
    let sx = Math.sin(p) * 0.5 * w, sz = s * (0.07 + 0.015 * Math.sin(t * 1.6)), ex = -0.12 - 0.35 * w - Math.max(0, Math.sin(p)) * 0.3 * w;
    if (sit > 0.5) { sx = -0.35; ex = -0.95; sz = s * 0.14; }
    if (c.hug > 0) { sx = lerp(sx, -1.35, c.hug); sz = lerp(sz, -s * 0.55, c.hug); ex = lerp(ex, -1.4, c.hug); }
    if (c.hold && i === c.holdSide) { sx = -0.25; sz = s * 0.35; ex = -0.2; }
    A.sh.rotation.set(sx, 0, sz); A.el.rotation.set(ex, 0, 0);
  });
  // Head look-at
  const tgt = c.lookAt;
  if (tgt) {
    const dx = tgt.x - c.x, dz = tgt.z - c.z;
    let a = Math.atan2(dx, dz) - c.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
    c.look = damp(c.look, clamp(a, -1.0, 1.0), 4, dt);
  } else c.look = damp(c.look, 0, 3, dt);
  u.neck.rotation.y = c.look * 0.45; u.head.rotation.y = c.look * 0.55;
  u.head.rotation.x = Math.sin(t * 0.7 + c.z) * 0.03 + (c.headDown || 0);
}

/* ---------------- collision ---------------- */
function collide(c) {
  for (const b of COLL) {
    const cx = clamp(c.x, b.x0, b.x1), cz = clamp(c.z, b.z0, b.z1);
    const dx = c.x - cx, dz = c.z - cz, d = Math.hypot(dx, dz);
    if (d < c.r) {
      if (d > 1e-5) { c.x = cx + dx / d * c.r; c.z = cz + dz / d * c.r; }
      else { // centre inside the box: push out along the shallowest axis
        const l = c.x - b.x0, r = b.x1 - c.x, t = c.z - b.z0, bb = b.z1 - c.z, m = Math.min(l, r, t, bb);
        if (m === l) c.x = b.x0 - c.r; else if (m === r) c.x = b.x1 + c.r; else if (m === t) c.z = b.z0 - c.r; else c.z = b.z1 + c.r;
      }
    }
  }
}

/* ---------------- input ---------------- */
const keys = new Set(), pressed = new Set();
addEventListener('keydown', (e) => { if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); Audio.start(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const hit = (...c) => c.some((k) => pressed.has(k));
const down = (...c) => c.some((k) => keys.has(k));
const CAM = { yaw: -0.63, pitch: 0.28, dist: 2.7, x: 0, y: 1.5, z: 0, shake: 0 };
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } Audio.start(); });
canvas.addEventListener('pointermove', (e) => { if (!drag || drag.id !== e.pointerId) return; CAM.yaw -= (e.clientX - drag.x) * 0.006; CAM.pitch = clamp(CAM.pitch + (e.clientY - drag.y) * 0.004, -0.15, 0.9); drag.x = e.clientX; drag.y = e.clientY; });
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); CAM.dist = clamp(CAM.dist * (e.deltaY > 0 ? 1.1 : 0.9), 1.3, 4.2); }, { passive: false });
// Touch joystick
const stick = { x: 0, y: 0, on: false };
(() => {
  const zone = $('stickzone'), knob = $('knob'), base = $('stick');
  let id = null, ox = 0, oy = 0;
  zone.addEventListener('pointerdown', (e) => { id = e.pointerId; ox = e.clientX; oy = e.clientY; base.style.left = (ox - 55) + 'px'; base.style.top = (oy - 55) + 'px'; base.classList.add('on'); zone.setPointerCapture(id); stick.on = true; Audio.start(); e.preventDefault(); });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy); if (l > 45) { dx *= 45 / l; dy *= 45 / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; stick.x = dx / 45; stick.y = dy / 45; });
  const end = (e) => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; base.classList.remove('on'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  $('btn-use').addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add('KeyE'); });
  $('btn-hug').addEventListener('pointerdown', (e) => { e.preventDefault(); pressed.add('KeyQ'); });
})();

/* ---------------- audio (procedural) ---------------- */
const Audio = (() => {
  let ctx = null, master, fireG, windG, padG, padOsc = [];
  function noise() { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; return s; }
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    const f = noise(), ff = ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 220; fireG = ctx.createGain(); fireG.gain.value = 0.25; f.connect(ff); ff.connect(fireG); fireG.connect(master); f.start();
    const w = noise(), wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.5; windG = ctx.createGain(); windG.gain.value = 0.06; w.connect(wf); wf.connect(windG); windG.connect(master); w.start();
    padG = ctx.createGain(); padG.gain.value = 0.05; const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 900; pf.connect(padG); padG.connect(master);
    [130.8, 164.8, 196.0].forEach((fr) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr; o.connect(pf); o.start(); padOsc.push(o); });
  }
  function tone(f, d, v = 0.06, when = 0, glide) { if (!ctx) return; const t = ctx.currentTime + when; const o = ctx.createOscillator(); o.frequency.setValueAtTime(f, t); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + d); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.3); }
  function crackle(dt, level) { if (!ctx || Math.random() > dt * 10 * level) return; const t = ctx.currentTime; const s = noise(); const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1500 + Math.random() * 2500; bf.Q.value = 2; const g = ctx.createGain(); g.gain.setValueAtTime(0.12 * Math.random(), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(bf); bf.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + 0.06); }
  return {
    start, tone, crackle,
    set(o) { if (!ctx) return; const t = ctx.currentTime; if (o.fire != null) fireG.gain.setTargetAtTime(o.fire * 0.25, t, 0.5); if (o.wind != null) windG.gain.setTargetAtTime(o.wind * 0.12, t, 1.2); if (o.pad != null) padG.gain.setTargetAtTime(o.pad * 0.05, t, 1.5); if (o.detune != null) padOsc.forEach((p, i) => p.detune.setTargetAtTime(o.detune * (i - 1), t, 2)); },
    click() { tone(1800, 0.01, 0.03); },
    whistle(faint) { const v = faint ? 0.02 : 0.08; [[1320, 1580], [1580, 1190], [1190, 1490]].forEach((n, i) => tone(n[0], 0.26, v, i * 0.44, n[1])); },
    blow() { if (!ctx) return; const t = ctx.currentTime; const s = noise(); const bf = ctx.createBiquadFilter(); bf.type = 'highpass'; bf.frequency.value = 1200; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); s.connect(bf); bf.connect(g); g.connect(master); s.start(t); s.stop(t + 0.8); },
  };
})();

/* ---------------- UI ---------------- */
const CFG = { partner: 'Partner', you: 'You', nickYou: 'giant', nickThem: 'gremlin' };
const fmt = (s) => s.replace(/\{P\}/g, CFG.partner).replace(/\{giant\}/g, CFG.nickYou).replace(/\{gremlin\}/g, CFG.nickThem);
const DLG = { q: [], cur: null, shown: 0, t: 0 };
function say(who, text) { return new Promise((res) => { DLG.q.push({ who, text: fmt(text), res }); }); }
function updateDialogue(dt) {
  const box = $('dialogue');
  if (!DLG.cur && DLG.q.length) { DLG.cur = DLG.q.shift(); DLG.shown = 0; DLG.t = 0; box.className = 'show ' + (DLG.cur.who ? 'who-' + DLG.cur.who : 'narr'); $('who').textContent = DLG.cur.who === 'partner' ? CFG.partner : DLG.cur.who === 'player' ? CFG.you : ''; }
  if (!DLG.cur) { box.className = ''; return; }
  DLG.t += dt; DLG.shown = Math.min(DLG.cur.text.length, DLG.shown + dt * 46);
  $('text').textContent = DLG.cur.text.slice(0, Math.floor(DLG.shown));
  if ((hit('KeyE', 'Space', 'Enter') || DLG.click) && DLG.t > 0.15) {
    DLG.click = false; pressed.delete('KeyE'); pressed.delete('Space'); pressed.delete('Enter');
    if (DLG.shown < DLG.cur.text.length) DLG.shown = DLG.cur.text.length;
    else { const r = DLG.cur.res; DLG.cur = null; r(); }
  }
}
$('dialogue').addEventListener('pointerdown', (e) => { e.preventDefault(); DLG.click = true; });
const busy = () => !!DLG.cur || DLG.q.length > 0 || STATE.cine;
function bark(c, text, dur = 2.8) { c.bark = { text: fmt(text), t: dur }; }
function hint(text, dur = 5) { const h = $('hint'); h.textContent = fmt(text); h.classList.add('show'); clearTimeout(hint._t); hint._t = setTimeout(() => h.classList.remove('show'), dur * 1000); }

/* ---------------- story state ---------------- */
const STATE = { horror: 0, horrorT: 0, cine: false, photoArmed: false, ended: false, warm: 1, coldSnap: 0 };
function toggleLamp(L) { L.on = !L.on; Audio.click(); if (L.on && Math.random() < 0.5 && dist(PARTNER, PLAYER) < 4) bark(PARTNER, ['Mood lighting. Bold.', 'Ooh. Ambience.'][Math.floor(Math.random() * 2)]); }
function toggleFire() {
  if (STATE.horror) { say(null, '(The ashes are cold. Not cooling. Cold, like nobody ever lit them.)'); return; }
  FIRE.on = !FIRE.on;
  if (FIRE.on) say('partner', 'Fire person! My hero.');
}
async function blowCandles() {
  if (!CAKE.lit) { say(null, '(One slice missing. You didn’t cut it.)'); return; }
  STATE.cine = true;
  PARTNER.target = { x: CAKE.g.position.x + 0.7, z: CAKE.g.position.z + 0.6 }; PARTNER.mode = 'goto';
  await say('partner', 'Wait wait wait. Wish first. A good one. Not a boring one.');
  Audio.blow();
  CAKE.lit = false; CAKE.blown = true;
  STATE.cine = false;
  await say('partner', '*claps* Happy birthday, {giant}!');
  await say('player', 'What did you wish for?');
  await say('partner', 'It’s YOUR birthday. I wished for cake. Obviously.');
  await say('partner', '…Hey. That photo by the door. Was that always there?');
  STATE.photoArmed = true;
  hint('The photographs are on the wall by the doorway.', 6);
}
async function inspectPhoto() {
  if (!STATE.photoArmed) { await say(null, '(Two small figures in the snow. Lanterns, blurred, far behind them. Neither of you remembers it being taken.)'); return; }
  if (STATE.horror) { await say(null, '(Three figures now. The third one is closer than it was.)'); return; }
  drawPhoto(PHOTO3.cv.getContext('2d'), 'snow', true); PHOTO3.t.needsUpdate = true;
  await say(null, '(Two small figures in the snow. And at the very edge, out of focus, a third.)');
  await say(null, '(You don’t remember a third.)');
  startHorror();
}
function startHorror() {
  STATE.horror = 1; STATE.horrorT = 0;
  Audio.set({ wind: 1.0, pad: 0.4, detune: 40 });
  PARTNER.mode = 'scripted'; PARTNER.target = null; PARTNER.speed = 0;
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

/* ---------------- Partner AI ---------------- */
const SPOTS = [
  { x: 7.55, z: 2.8, sit: true, yaw: Math.PI, lines: ['Sofa claimed.', 'This is my sofa now. Pay rent.'], dur: [8, 14] },
  { x: 10.35, z: 2.3, yaw: Math.PI / 2, lines: ['Cloud looks like you. Big. Soft.', 'Everything’s so white.'], dur: [4, 7] },
  { x: 10.2, z: 3.85, yaw: Math.PI / 2, lines: ['I’m reading this one. Have been for a year.'], dur: [4, 7] },
  { x: 8.0, z: 1.3, yaw: Math.PI, lines: ['*warms hands*', 'Ahh. Toasty.'], dur: [4, 8] },
  { x: 0.75, z: 2.3, yaw: -Math.PI / 2, lines: ['Snow’s getting heavy.'], dur: [4, 6] },
  { x: 6.6, z: 3.6, yaw: 0, lines: [], dur: [2, 3] },
];
function partnerAI(p, dt, t) {
  p.lookAt = PLAYER;
  p.sit = damp(p.sit, p.mode === 'sitting' ? 1 : 0, 6, dt);
  if (p.hug > 0 && !STATE.hugging) p.hug = Math.max(0, p.hug - dt * 2);
  if (STATE.horror) return;
  const d = dist(p, PLAYER);
  if (p.mode === 'goto' || p.mode === 'approach' || p.mode === 'tospot') {
    const tx = p.target.x, tz = p.target.z;
    // Doorway routing between bedroom (x<5) and living room.
    let gx = tx, gz = tz;
    if ((p.x < 5) !== (tx < 5)) { gx = p.x < 5 ? 5.4 : 4.6; gz = 3.5; if (Math.abs(p.x - 5) < 0.45 && Math.abs(p.z - 3.5) < 0.4) { gx = tx; gz = tz; } }
    const dx = gx - p.x, dz = gz - p.z, l = Math.hypot(dx, dz);
    const stopAt = p.mode === 'approach' ? 0.85 : 0.08;
    if (l > stopAt || (gx !== tx)) {
      const sp = p.mode === 'approach' ? 1.4 : 1.15;
      p.speed = damp(p.speed, sp, 6, dt);
      p.x += dx / l * p.speed * dt; p.z += dz / l * p.speed * dt;
      p.yaw = turn(p.yaw, Math.atan2(dx, dz), dt, 8);
      collide(p);
      p.lookAt = l > 1.5 ? null : PLAYER;
    } else {
      p.speed = damp(p.speed, 0, 10, dt);
      if (p.mode === 'tospot') {
        const s = p.spot; p.yaw = turn(p.yaw, s.yaw, dt, 6);
        p.mode = s.sit ? 'sitting' : 'idle'; p.wait = rand(s.dur[0], s.dur[1]);
        if (s.lines.length && Math.random() < 0.8) bark(p, s.lines[Math.floor(Math.random() * s.lines.length)]);
      } else if (p.mode === 'approach') {
        p.mode = 'idle'; p.wait = rand(3, 5);
        bark(p, ['*tap tap*', 'Hi.', 'Still you? Good.', 'Birthday person. Hello.', 'Missed you. It’s been ninety seconds.'][Math.floor(Math.random() * 5)]);
        Audio.tone(900, 0.03, 0.03); Audio.tone(900, 0.03, 0.03, 0.14);
      } else { p.mode = 'idle'; p.wait = 1.5; }
    }
    return;
  }
  p.speed = damp(p.speed, 0, 8, dt);
  p.wait -= dt;
  if (p.wait <= 0 && !busy()) {
    if (p.mode === 'sitting') { p.mode = 'idle'; p.wait = 0.6; return; }
    if (Math.random() < 0.35 && d > 1.4) { p.mode = 'approach'; p.target = PLAYER; return; }
    const s = SPOTS[Math.floor(Math.random() * SPOTS.length)];
    p.spot = s; p.target = { x: s.x, z: s.z }; p.mode = 'tospot';
  }
}
function turn(a, b, dt, k) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * Math.min(1, dt * k); }

/* ---------------- post-processing ---------------- */
let composer, bloom, ssao, grade, fxaa;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uSat: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uVig: { value: 0.35 }, uGrain: { value: 0.018 }, uCA: { value: 0.0015 }, uLift: { value: 0.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uSat, uVig, uGrain, uCA, uLift; uniform vec3 uTint; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.0) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + d * uCA).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - d * uCA).b;
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(vec3(l), c, uSat) * uTint + uLift;
      c *= 1.0 - uVig * smoothstep(0.25, 0.85, length(d * vec2(1.25,1.0)));
      c += (h(vUv * 911.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};
function buildPost() {
  composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  ssao = new THREE.SSAOPass(scene, camera, 2, 2);
  ssao.kernelRadius = 0.35; ssao.minDistance = 0.0008; ssao.maxDistance = 0.04;
  composer.addPass(ssao);
  bloom = new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), 0.45, 0.45, 0.9);
  composer.addPass(bloom);
  grade = new THREE.ShaderPass(GradeShader); composer.addPass(grade);
  composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
  fxaa = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaa);
}
function applyQuality() {
  Q = PRESETS[qName];
  try { localStorage.setItem('cbs.demo.quality', qName); } catch (e) { /* ignore */ }
  renderer.shadowMap.enabled = Q.shadows;
  for (const L of LAMPS) { L.light.castShadow = Q.shadows && L.kind === 'lamp' && L === LAMPS[0]; L.light.shadow.mapSize.set(Q.shadowSize / 2, Q.shadowSize / 2); L.light.shadow.bias = -0.003; }
  FIRE.light.castShadow = Q.shadows; FIRE.light.shadow.mapSize.set(Q.shadowSize / 2, Q.shadowSize / 2);
  STATE.moon.spot.castShadow = Q.shadows; STATE.moon.spot.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
  ssao.enabled = Q.ssao;
  bloom.strength = Q.bloom;
  MATS.forEach((m) => { m.needsUpdate = true; });
  if (SNOW) { SNOW.geometry.setDrawRange(0, Math.min(Q.snow, SNOW.geometry.attributes.position.count)); }
  if (MOTES) MOTES.geometry.setDrawRange(0, Math.min(Q.motes, MOTES.geometry.attributes.position.count));
  resize();
  document.querySelectorAll('#quality button').forEach((b) => b.classList.toggle('on', b.dataset.q === qName));
}
function resize() {
  const W = innerWidth, H = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, Q.dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
  composer.setPixelRatio(dpr); composer.setSize(W, H);
  camera.aspect = W / H; camera.fov = W < H ? 70 : 55; camera.updateProjectionMatrix();
  fxaa.material.uniforms.resolution.value.set(1 / (W * dpr), 1 / (H * dpr));
  const px = H * dpr / 900;
  if (SNOW) SNOW.material.uniforms.uPx.value = px;
  if (MOTES) MOTES.material.uniforms.uPx.value = px;
}
addEventListener('resize', () => composer && resize());

/* ---------------- camera ---------------- */
const ray = new THREE.Raycaster();
function updateCamera(dt) {
  if (down('KeyZ', 'Comma')) CAM.yaw += dt * 1.6;
  if (down('KeyC', 'Period')) CAM.yaw -= dt * 1.6;
  const F = window.DEMO && window.DEMO.FOLLOW;
  const tx = F ? F.x : PLAYER.x, ty = F ? F.y : 1.45 * (PLAYER.m.userData.k) + 0.05, tz = F ? F.z : PLAYER.z;
  CAM.x = damp(CAM.x, tx, 8, dt); CAM.y = damp(CAM.y, ty, 8, dt); CAM.z = damp(CAM.z, tz, 8, dt);
  const target = new THREE.Vector3(CAM.x, CAM.y, CAM.z);
  // Shoulder offset to the right.
  const right = new THREE.Vector3(Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw));
  if (!F) target.addScaledVector(right, 0.32);
  const dir = new THREE.Vector3(Math.sin(CAM.yaw) * Math.cos(CAM.pitch), Math.sin(CAM.pitch), Math.cos(CAM.yaw) * Math.cos(CAM.pitch));
  let d = CAM.dist;
  ray.set(target, dir); ray.far = d + 0.3;
  const hits = ray.intersectObjects(CAMBLOCK, false);
  if (hits.length) d = Math.max(0.35, hits[0].distance - 0.22);
  CAM.cur = CAM.cur == null ? d : (d < CAM.cur ? d : damp(CAM.cur, d, 3, dt));
  camera.position.copy(target).addScaledVector(dir, CAM.cur);
  camera.position.y = Math.min(camera.position.y, WALL_H - 0.12);
  if (CAM.shake) { camera.position.x += rand(-1, 1) * CAM.shake; camera.position.y += rand(-1, 1) * CAM.shake; CAM.shake *= Math.exp(-dt * 6); }
  camera.lookAt(target);
}

/* ---------------- interaction ---------------- */
function nearest() {
  let best = null, bd = 1e9;
  const fx = Math.sin(PLAYER.yaw), fz = Math.cos(PLAYER.yaw);
  for (const it of INTER) {
    const dx = it.pos[0] - PLAYER.x, dz = it.pos[2] - PLAYER.z, d = Math.hypot(dx, dz);
    if (d > it.r) continue;
    const s = d - ((dx * fx + dz * fz) / (d || 1)) * 0.4;
    if (s < bd) { bd = s; best = it; }
  }
  return best;
}
async function hug() {
  if (dist(PLAYER, PARTNER) > 1.3 || STATE.horror) return;
  STATE.hugging = true;
  const a = Math.atan2(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
  PLAYER.yaw = a; PARTNER.yaw = a + Math.PI; PARTNER.mode = 'idle'; PARTNER.wait = 3; PARTNER.speed = 0;
  const mx = (PLAYER.x + PARTNER.x) / 2, mz = (PLAYER.z + PARTNER.z) / 2;
  PARTNER.x = mx + Math.sin(a) * 0.17; PARTNER.z = mz + Math.cos(a) * 0.17; PLAYER.x = mx - Math.sin(a) * 0.17; PLAYER.z = mz - Math.cos(a) * 0.17;
  const t0 = performance.now();
  heartBurst(mx, 1.75, mz);
  bark(PARTNER, ['Mmf. Squished.', 'You’re so warm. Unfair.', 'Ten out of ten hug.', '*nuzzles your shoulder*'][Math.floor(Math.random() * 4)]);
  await new Promise((r) => setTimeout(r, 1700));
  STATE.hugging = false;
}
const HEARTS = [];
function heartBurst(x, y, z) {
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex(), color: '#ff8aa0', transparent: true, depthWrite: false }));
    s.position.set(x + rand(-0.15, 0.15), y + rand(0, 0.1), z + rand(-0.1, 0.1)); s.scale.setScalar(0.09);
    scene.add(s); HEARTS.push({ s, vy: rand(0.25, 0.45), life: rand(1.2, 1.8), age: 0 });
  }
}
let _ht; function heartTex() { if (_ht) return _ht; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(32, 54); c.bezierCurveTo(4, 34, 10, 6, 32, 20); c.bezierCurveTo(54, 6, 60, 34, 32, 54); c.fill(); return (_ht = new THREE.CanvasTexture(cv)); }

/* ---------------- horror timeline ---------------- */
function horrorUpdate(dt) {
  if (!STATE.horror) return;
  const t = (STATE.horrorT += dt);
  // 0–2.2s: lights flicker; then die.
  for (const L of LAMPS) L.flick = t < 2.2 ? (Math.random() < 0.45 ? 0.05 : 1) : 0;
  if (t > 2.2) { FIRE.level = damp(FIRE.level, 0.12, 0.8, dt); CAKE.lit = false; }
  STATE.coldSnap = clamp((t - 1.5) / 4, 0, 1);
  SNOW.material.uniforms.uIndoor.value = clamp((t - 4) / 5, 0, 1);
  SNOW.material.uniforms.uFrozen.value = clamp((t - 9) / 3, 0, 1);
  SKY.material.uniforms.uHorror.value = STATE.coldSnap;
  if (t > 2 && !STATE.h1) { STATE.h1 = 1; CAM.shake = 0.01; Audio.set({ fire: 0.1 }); }
  if (t > 3.5 && !STATE.h2) {
    STATE.h2 = 1;
    // Partner stops whatever they were doing and goes to the west window. Slowly.
    PARTNER.mode = 'scripted';
    (async () => {
      await walkTo(PARTNER, 4.6, 3.5, 0.7); await walkTo(PARTNER, 0.8, 2.3, 0.7);
      PARTNER.yaw = -Math.PI / 2; PARTNER.lookAt = null;
      await wait(2.5);
      Audio.whistle(true);
      await wait(2.2);
      PARTNER.lookAt = PLAYER;
      await say('partner', '…It’s quiet.');
      await say('partner', 'Do you hear birds? I don’t hear birds.');
      await say('partner', 'Stay close, okay?');
      STATE.ended = true;
      $('endcard').classList.add('show');
    })();
  }
}
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
function walkTo(c, x, z, sp) {
  return new Promise((res) => { c.script = { x, z, sp, res }; });
}
function scriptedMove(c, dt) {
  const s = c.script; if (!s) { c.speed = damp(c.speed, 0, 8, dt); return; }
  const dx = s.x - c.x, dz = s.z - c.z, l = Math.hypot(dx, dz);
  if (l < 0.06) { c.script = null; c.speed = 0; s.res(); return; }
  c.speed = damp(c.speed, s.sp, 5, dt);
  c.x += dx / l * Math.min(l, c.speed * dt); c.z += dz / l * Math.min(l, c.speed * dt);
  c.yaw = turn(c.yaw, Math.atan2(dx, dz), dt, 5);
}
function resetEvening() {
  STATE.horror = 0; STATE.horrorT = 0; STATE.h1 = STATE.h2 = 0; STATE.coldSnap = 0; STATE.ended = false; STATE.photoArmed = false;
  for (const L of LAMPS) L.flick = 1;
  FIRE.level = 1; FIRE.on = true; CAKE.lit = true; CAKE.blown = false;
  SNOW.material.uniforms.uIndoor.value = 0; SNOW.material.uniforms.uFrozen.value = 0; SKY.material.uniforms.uHorror.value = 0;
  drawPhoto(PHOTO3.cv.getContext('2d'), 'snow', false); PHOTO3.t.needsUpdate = true;
  PARTNER.mode = 'idle'; PARTNER.wait = 1; PARTNER.script = null;
  Audio.set({ wind: 0.5, fire: 1, pad: 1, detune: 0 });
  $('endcard').classList.remove('show');
  DLG.q.length = 0; DLG.cur = null;
}

/* ---------------- per-frame ---------------- */
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60, lowT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; updateStats(); }
  if (STATE.started) step(dt, t);
  // Light state
  const cold = STATE.coldSnap;
  for (const L of LAMPS) {
    const target = L.on ? L.power * L.flick : 0;
    L.light.intensity = damp(L.light.intensity, target, 18, dt);
    L.shade.material.emissiveIntensity = (L.light.intensity / L.power) * 1.4;
  }
  const fl = 0.82 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07 + Math.sin(t * 23.1) * 0.03;
  const fpow = FIRE.on ? FIRE.level : 0;
  FIRE.light.intensity = damp(FIRE.light.intensity, FIRE.power * fpow * fl, 12, dt);
  FIRE.planes.forEach((p, i) => { p.visible = fpow > 0.02; p.material.uniforms.uTime.value = t + i * 3.1; p.material.uniforms.uPower.value = fpow; p.lookAt(camera.position.x, p.getWorldPosition(new THREE.Vector3()).y, camera.position.z); });
  CAKE.light.intensity = damp(CAKE.light.intensity, CAKE.lit ? 1.6 * fl : 0, 10, dt);
  CAKE.flames.forEach((f, i) => { f.visible = CAKE.lit; f.material.uniforms.uTime.value = t * 1.4 + i; f.lookAt(camera.position); });
  const moon = STATE.moon;
  moon.spot.intensity = lerp(520, 1100, cold); moon.fill.intensity = lerp(0.05, 0.25, cold);
  moon.shaft.uniforms.uI.value = lerp(0.045, 0.1, cold); moon.shaft.uniforms.uTime.value = t;
  MATS.forEach((m) => { if (m._baseEnv == null) m._baseEnv = m.envMapIntensity; m.envMapIntensity = m._baseEnv * lerp(1, 0.6, cold); });
  renderer.toneMappingExposure = lerp(1.0, 0.8, cold);
  SNOW.material.uniforms.uTime.value = t;
  MOTES.material.uniforms.uTime.value = t; MOTES.material.uniforms.uI.value = lerp(1, 0.15, cold);
  const u = grade.uniforms;
  u.uTime.value = t;
  u.uSat.value = lerp(1.08, 0.45, cold);
  u.uTint.value.set(lerp(1.04, 0.86, cold), lerp(1.0, 0.95, cold), lerp(0.94, 1.12, cold));
  u.uVig.value = lerp(0.38, 0.62, cold);
  u.uCA.value = lerp(0.0012, 0.004, cold);
  Audio.crackle(dt, FIRE.on ? FIRE.level : 0);
  // Hearts
  for (const h of HEARTS) { h.age += dt; h.s.position.y += h.vy * dt; h.s.material.opacity = 1 - h.age / h.life; }
  for (let i = HEARTS.length - 1; i >= 0; i--) if (HEARTS[i].age > HEARTS[i].life) { scene.remove(HEARTS[i].s); HEARTS.splice(i, 1); }
  if (STATE.intro) introCam(dt); else if (PLAYER.m) updateCamera(dt);
  composer.render(dt);
  bubbles(dt);
  pressed.clear();
}
function step(dt, t) {
  updateDialogue(dt);
  // Player movement (camera-relative)
  let ix = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
  let iy = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
  if (stick.on) { ix = stick.x; iy = stick.y; }
  const free = !busy() && !STATE.intro && !STATE.hugging;
  if (!free) { ix = iy = 0; }
  const l = Math.hypot(ix, iy);
  const run = down('ShiftLeft', 'ShiftRight') || (stick.on && l > 0.95);
  const target = l > 0.05 ? (run ? 3.0 : 1.55) * Math.min(1, l) : 0;
  PLAYER.speed = damp(PLAYER.speed, target, 8, dt);
  if (l > 0.05) {
    const cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw);
    const mx = ix * cy + iy * sy, mz = -ix * sy + iy * cy;
    PLAYER.yaw = turn(PLAYER.yaw, Math.atan2(mx, mz), dt, 10);
  }
  PLAYER.x += Math.sin(PLAYER.yaw) * PLAYER.speed * dt;
  PLAYER.z += Math.cos(PLAYER.yaw) * PLAYER.speed * dt;
  collide(PLAYER);
  PLAYER.hug = damp(PLAYER.hug, STATE.hugging ? 1 : 0, 8, dt); PARTNER.hug = PLAYER.hug;
  PLAYER.lookAt = dist(PLAYER, PARTNER) < 3 ? PARTNER : null;
  // Partner
  if (PARTNER.mode === 'scripted') scriptedMove(PARTNER, dt); else partnerAI(PARTNER, dt, t);
  animate(PLAYER, dt, t); animate(PARTNER, dt, t);
  horrorUpdate(dt);
  // Interaction prompt
  const it = free ? nearest() : null;
  const near = free && dist(PLAYER, PARTNER) < 1.3 && !STATE.horror;
  let html = '';
  if (it) html += `<span class="key">${MOBILE ? 'Use' : 'E'}</span>${typeof it.label === 'function' ? it.label() : it.label}`;
  if (near) html += `${html ? '<span class="sep"></span>' : ''}<span class="key">${MOBILE ? '♥' : 'Q'}</span>Hug`;
  const pr = $('prompt'); if (pr._h !== html) { pr._h = html; pr.innerHTML = html; pr.classList.toggle('hidden', !html); }
  if (it && hit('KeyE', 'Space', 'Enter')) { pressed.clear(); it.act(); }
  else if (near && hit('KeyQ', 'KeyF')) hug();
  if (STATE.ended && hit('KeyR')) resetEvening();
}

/* ---------------- speech bubbles ---------------- */
function bubbles(dt) {
  const el = $('bubble');
  const c = PARTNER;
  if (!c.bark || !STATE.started) { el.classList.remove('show'); return; }
  c.bark.t -= dt; if (c.bark.t <= 0) { c.bark = null; el.classList.remove('show'); return; }
  const v = new THREE.Vector3(c.x, c.m.userData.H + 0.28, c.z).project(camera);
  if (v.z > 1) { el.classList.remove('show'); return; }
  el.textContent = c.bark.text;
  el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
  el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  el.classList.add('show');
}

/* ---------------- intro ---------------- */
function introCam(dt) {
  const k = clamp((STATE.introT += dt) / 6, 0, 1), e = k * k * (3 - 2 * k);
  const a = new THREE.Vector3(1.0, 1.55, 3.9), b = new THREE.Vector3(9.4, 1.6, 4.1);
  camera.position.lerpVectors(a, b, e);
  const la = new THREE.Vector3(0.2, 1.3, 2.2), lb = new THREE.Vector3(8.0, 0.8, 0.6);
  camera.lookAt(new THREE.Vector3().lerpVectors(la, lb, e));
  if (k >= 1) {
    STATE.intro = false;
    CAM.x = PLAYER.x; CAM.y = 1.5; CAM.z = PLAYER.z;
    (async () => {
      await say('partner', 'There you are. Happy birthday, {giant}.');
      await say('player', 'You said that this morning.');
      await say('partner', 'I’m saying it again, in case it didn’t stick. Cake’s on the table.');
      await say('partner', 'And don’t look in the wardrobe. I mean it.');
      hint(MOBILE ? 'Left side: walk. Drag the right side to look. Use to interact, ♥ to hug.' : 'WASD to walk, Shift to run, drag the mouse to look, scroll to zoom. E to interact, Q to hug.', 8);
    })();
  }
}

/* ---------------- stats overlay ---------------- */
function updateStats() {
  const s = $('stats'); if (s.hidden) return;
  const i = renderer.info.render;
  s.textContent = `${fps.toFixed(0)} FPS  ${(1000 / Math.max(1, fps)).toFixed(1)} ms\nDraw calls ${i.calls}   Tris ${(i.triangles / 1000).toFixed(0)}k\nQuality ${qName}   Shadows ${Q.shadows ? 'on' : 'off'}   AO ${Q.ssao ? 'on' : 'off'}`;
  // Auto-scalability: step down if the frame rate stays low.
  if (STATE.started && fps < 26) { lowT += 0.5; if (lowT > 4 && qName !== 'Low') { qName = qName === 'Epic' ? 'High' : 'Low'; applyQuality(); hint('Quality lowered to ' + qName + ' for smoother play.', 4); lowT = 0; } } else lowT = 0;
}
addEventListener('keydown', (e) => { if (e.code === 'Backquote') { const s = $('stats'); s.hidden = !s.hidden; } });

/* ---------------- boot ---------------- */
function boot() {
  buildTextures(); buildMaterials(); buildHouse(); buildFurniture(); buildOutside();
  SNOW = snowSystem(4000); MOTES = moteSystem(420);
  PLAYER.m = makeHuman({ height: 1.86, skin: '#d9a888', top: '#4f6f96', pants: '#2f3442', hair: '#3a2a22', hairStyle: 'short', socks: '#c9c2b6' });
  PARTNER.m = makeHuman({ height: 1.58, fem: true, skin: '#c48c68', top: '#d79c46', knit: true, pants: '#4a3b52', hair: '#21160f', hairStyle: 'bun', socks: '#e7d9c4' });
  buildPost();
  document.querySelectorAll('#quality button').forEach((b) => b.addEventListener('click', () => { qName = b.dataset.q; applyQuality(); }));
  applyQuality();
  CAM.x = PLAYER.x; CAM.z = PLAYER.z;
  $('loading').classList.add('done');
  $('begin').addEventListener('click', () => {
    Audio.start(); Audio.set({ wind: 0.5, fire: 1, pad: 1 });
    $('title').classList.add('hide');
    STATE.started = true; STATE.intro = true; STATE.introT = 0;
  });
  $('reset').addEventListener('click', () => resetEvening());
  requestAnimationFrame(frame);
  // Debug hooks for automated previews.
  window.DEMO = { STATE, PLAYER, PARTNER, CAM, startHorror, skipIntro: () => { STATE.started = true; STATE.intro = false; $('title').classList.add('hide'); }, setQ: (q) => { qName = q; applyQuality(); } };
}
try { boot(); } catch (e) { console.error(e); $('loading').textContent = 'This demo needs WebGL. ' + e.message; }
})();
