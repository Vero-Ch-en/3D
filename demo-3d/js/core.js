'use strict';
/* =========================================================================
 * Cozy Birthday Simulator — 3D base. Core: renderer, quality, utilities,
 * procedural textures and materials. Units are metres; y is up.
 * ========================================================================= */
const G = (window.G = {});
G.$ = (id) => document.getElementById(id);
G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
G.lerp = (a, b, t) => a + (b - a) * t;
G.smooth = (a, b, x) => { const t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
G.damp = (a, b, k, dt) => G.lerp(a, b, 1 - Math.exp(-k * dt));
G.rand = (a, b) => a + Math.random() * (b - a);
G.seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
G.MOBILE = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

/* ---------------- quality presets ---------------- */
G.PRESETS = {
  Low: { dpr: 1, shadows: false, dof: false, ssao: false, bloom: 0.35, shadowSize: 1024, trees: 0.45, snow: 1500 },
  High: { dpr: 1.5, shadows: true, dof: true, ssao: false, bloom: 0.5, shadowSize: 2048, trees: 1, snow: 3000 },
  Epic: { dpr: 2, shadows: true, dof: true, ssao: true, bloom: 0.55, shadowSize: 4096, trees: 1, snow: 4500 },
};
G.qName = G.MOBILE ? 'Low' : 'High';
try { G.qName = localStorage.getItem('cbs.base.quality') || G.qName; } catch (e) { /* storage unavailable */ }
if (!G.PRESETS[G.qName]) G.qName = 'High';
G.Q = G.PRESETS[G.qName];

/* ---------------- renderer & scene ---------------- */
G.canvas = G.$('gl');
G.renderer = new THREE.WebGLRenderer({ canvas: G.canvas, antialias: false, powerPreference: 'high-performance' });
G.renderer.physicallyCorrectLights = true;
G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
G.renderer.toneMappingExposure = 0.9;
G.renderer.outputEncoding = THREE.sRGBEncoding;
G.renderer.shadowMap.enabled = true;
G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
G.scene = new THREE.Scene();
G.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
G.pmrem = new THREE.PMREMGenerator(G.renderer);
G.MATS = [];
G.COLL = [];       // axis-aligned blockers {x0,z0,x1,z1}
G.CAMBLOCK = [];   // meshes the camera must not pass through
G.INTER = [];      // interactables

/* ---------------- noise ---------------- */
G.simplex = new THREE.SimplexNoise({ random: G.seeded(491) });
G.fbm = (x, y, o = 4) => { let a = 0, f = 1, w = 0.5; for (let i = 0; i < o; i++) { a += w * G.simplex.noise(x * f, y * f); f *= 2.03; w *= 0.5; } return a; };

/* ---------------- procedural textures ---------------- */
// Procedural textures are painted per pixel at boot; on Low (phones) paint them at half size, a quarter of the work.
G.TEX_SCALE = G.qName === 'Low' ? 0.5 : 1;
function canvasTex(size, fn, o = {}) {
  const k = o.draw ? 1 : G.TEX_SCALE;
  const w = Math.max(16, Math.round((o.w || size) * k)), h = Math.max(16, Math.round((o.h || size) * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  if (o.draw) o.draw(ctx, w, h);
  else {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = fn(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = c[3] == null ? 255 : c[3];
    }
    ctx.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
  if (o.srgb !== false) t.encoding = THREE.sRGBEncoding;
  return t;
}
G.canvasTex = canvasTex;
const TX = (G.TX = {});
G.buildTextures = () => {
  const fbm = G.fbm;
  // Interior: warm vertical pine boards.
  TX.boards = canvasTex(512, (u, v) => {
    const col = Math.floor(u * 6), off = ((col * 37) % 10) / 10;
    const gap = (u * 6) % 1 < 0.02 ? 0.45 : 1;
    const knot = Math.max(0, 1 - Math.hypot(((u * 6) % 1 - 0.5) * 3, ((v + off) % 0.5 - 0.25) * 12)) * 0.25;
    const grain = fbm(u * 30 + col, v * 3, 3) * 0.18 + fbm(u * 120, v * 8, 2) * 0.06;
    const t = (0.82 + ((col * 13) % 5) / 25 + grain - knot) * gap;
    return [176 * t, 118 * t, 72 * t];
  });
  TX.boardsB = canvasTex(256, (u) => { const g = (u * 6) % 1 < 0.02 ? 40 : 170 + G.fbm(u * 80, 0, 2) * 30; return [g, g, g]; }, { srgb: false });
  // Exterior: stacked round logs with chinking.
  TX.logs = canvasTex(512, (u, v) => {
    const row = Math.floor(v * 7), f = (v * 7) % 1;
    if (f < 0.07) { const c = 205 + fbm(u * 40, v * 40) * 25; return [c, c * 0.95, c * 0.88]; }
    const shade = Math.sin(((f - 0.07) / 0.93) * Math.PI);
    const grain = fbm(u * 3 + row * 11, v * 70, 3) * 0.25 + fbm(u * 50, v * 400, 2) * 0.06;
    const t = (0.35 + shade * 0.6) * (0.85 + grain) * (0.9 + ((row * 7) % 5) / 25);
    return [128 * t, 82 * t, 52 * t];
  });
  TX.logsB = canvasTex(256, (u, v) => { const f = (v * 7) % 1; const g = f < 0.07 ? 30 : 60 + Math.sin(((f - 0.07) / 0.93) * Math.PI) * 170 + G.fbm(u * 60, v * 300, 2) * 20; return [g, g, g]; }, { srgb: false });
  // Floor: wide oak planks.
  TX.floor = canvasTex(512, (u, v) => {
    const row = Math.floor(v * 6), off = (row * 0.37) % 1, seg = Math.floor((u + off) * 2);
    const edge = (v * 6) % 1 < 0.025 || ((u + off) * 2) % 1 < 0.006 ? 0.5 : 1;
    const t = (0.74 + ((row * 17 + seg * 31) % 7) / 28 + fbm(u * 3, v * 50 + row * 3, 3) * 0.3) * edge;
    return [150 * t, 98 * t, 62 * t];
  });
  TX.floorB = canvasTex(256, (u, v) => { const row = Math.floor(v * 6), off = (row * 0.37) % 1; const e = (v * 6) % 1 < 0.025 || ((u + off) * 2) % 1 < 0.006; const g = e ? 40 : 160 + G.fbm(u * 40, v * 300, 2) * 30; return [g, g, g]; }, { srgb: false });
  // Roof shingles.
  TX.shingle = canvasTex(256, (u, v) => {
    const row = Math.floor(v * 8), off = row % 2 ? 0.5 : 0, f = (v * 8) % 1;
    const id = Math.floor(u * 6 + off) + row * 9;
    const t = (0.5 + ((id * 37) % 9) / 30 + f * 0.25 + fbm(u * 30, v * 30) * 0.1) * ((u * 6 + off) % 1 < 0.04 ? 0.5 : 1);
    return [70 * t, 58 * t, 54 * t];
  });
  // Field stone (chimney, fireplace, foundation).
  TX.stone = canvasTex(512, (u, v) => {
    const s = 5; let best = 9, second = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = Math.floor(u * s) + i, cy = Math.floor(v * s * 1.6) + j;
      const h = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453; const r = h - Math.floor(h);
      const px = (cx + 0.5 + (r - 0.5) * 0.7) / s, py = (cy + 0.5 + ((r * 7) % 1 - 0.5) * 0.7) / (s * 1.6);
      const d = Math.hypot((u - px) * s, (v - py) * s * 1.6);
      if (d < best) { second = best; best = d; id = r; } else if (d < second) second = d;
    }
    const mortar = second - best < 0.09;
    if (mortar) { const g = 120 + fbm(u * 50, v * 50) * 20; return [g, g * 0.97, g * 0.92]; }
    const t = 0.65 + id * 0.35 + fbm(u * 25, v * 25, 3) * 0.12;
    return [138 * t, 128 * t, 116 * t];
  });
  // Knit: cable pattern.
  const knit = (base, cable) => canvasTex(256, (u, v) => {
    const x = u * 16, y = v * 32;
    const rib = Math.abs(Math.sin(x * Math.PI)) * 0.25;
    const st = Math.abs(Math.sin(y * Math.PI + (Math.floor(x) % 2) * 1.5)) * 0.18;
    let c = 0;
    if (cable) { const cx = (u * 4) % 1; const tw = Math.sin(v * 16 * Math.PI) * 0.08; c = Math.max(0, 1 - Math.abs(cx - 0.5 - tw) * 10) * 0.2; }
    const t = 0.72 + rib + st + c + fbm(u * 40, v * 40, 2) * 0.05;
    return [base[0] * t, base[1] * t, base[2] * t];
  });
  TX.knitCream = knit([226, 210, 186], true);
  TX.knitDark = knit([70, 66, 64], false);
  TX.knitB = canvasTex(256, (u, v) => { const g = 90 + Math.abs(Math.sin(u * 16 * Math.PI)) * 80 + Math.abs(Math.sin(v * 32 * Math.PI)) * 60; return [g, g, g]; }, { srgb: false });
  // Jersey (hoodie).
  TX.jersey = canvasTex(256, (u, v) => { const t = 0.9 + G.fbm(u * 60, v * 60, 2) * 0.08 + Math.sin(v * 400) * 0.015; return [255 * t, 255 * t, 255 * t]; });
  TX.jerseyB = canvasTex(128, (u, v) => { const g = 128 + G.fbm(u * 50, v * 50, 2) * 60; return [g, g, g]; }, { srgb: false });
  // Plaid throw.
  TX.plaid = canvasTex(512, (u, v) => {
    const band = (t, w) => (Math.abs(((t * 4) % 1) - 0.5) < w ? 1 : 0);
    let r = 120, g = 28, b = 30;
    const dkU = band(u, 0.18), dkV = band(v, 0.18);
    if (dkU || dkV) { r = 50; g = 30; b = 32; }
    if (dkU && dkV) { r = 26; g = 22; b = 26; }
    if (band(u + 0.125, 0.025) || band(v + 0.125, 0.025)) { r = 200; g = 170; b = 120; }
    if (band(u + 0.25, 0.012) || band(v + 0.25, 0.012)) { r = 30; g = 60; b = 52; }
    const tw = ((Math.floor(u * 512) + Math.floor(v * 512)) % 4 < 2) ? 0.92 : 1.05;
    return [r * tw, g * tw, b * tw];
  });
  TX.fabricB = canvasTex(256, (u, v) => { const w = 128 + Math.sin(u * 128 * Math.PI) * Math.sin(v * 128 * Math.PI) * 70; return [w, w, w]; }, { srgb: false });
  TX.linen = canvasTex(256, (u, v) => { const t = 0.92 + Math.sin(u * 200) * Math.sin(v * 200) * 0.03 + G.fbm(u * 20, v * 20, 2) * 0.05; return [240 * t, 232 * t, 220 * t]; });
  TX.rug = canvasTex(512, (u, v) => {
    const b = Math.min(u, v, 1 - u, 1 - v);
    let c = [110, 54, 42];
    if (b < 0.05) c = [60, 34, 28]; else if (b < 0.08) c = [196, 160, 112]; else if (b < 0.14) c = [80, 40, 34];
    const d = Math.abs(u - 0.5) + Math.abs(v - 0.5);
    if (b >= 0.14 && Math.abs(Math.sin(d * 30)) < 0.15) c = [186, 140, 92];
    const k = 0.88 + G.fbm(u * 60, v * 60, 2) * 0.14;
    return [c[0] * k, c[1] * k, c[2] * k];
  });
  TX.bark = canvasTex(128, (u, v) => { const t = 0.6 + G.fbm(u * 6, v * 30, 3) * 0.4; return [90 * t, 64 * t, 48 * t]; });
  TX.snowN = canvasTex(256, (u, v) => { const n = G.fbm(u * 4, v * 4, 3) * 0.6 + G.fbm(u * 24, v * 24, 2) * 0.4; const g = 128 + n * 70; return [g, g, g]; }, { srgb: false });
  // Hair strands (alpha-tested cards).
  TX.hair = canvasTex(0, null, {
    w: 128, h: 512, srgb: true, draw: (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const r = G.seeded(77);
      for (let i = 0; i < 220; i++) {
        const x = r() * w, len = h * (0.55 + r() * 0.45), wd = 0.6 + r() * 1.6;
        const l = 150 + r() * 105;
        const g = ctx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, `rgba(${l},${l},${l},1)`); g.addColorStop(0.75, `rgba(${l},${l},${l},0.95)`); g.addColorStop(1, `rgba(${l},${l},${l},0)`);
        ctx.strokeStyle = g; ctx.lineWidth = wd;
        ctx.beginPath(); ctx.moveTo(x, 0);
        const sway = (r() - 0.5) * 18;
        ctx.bezierCurveTo(x + sway * 0.3, len * 0.33, x + sway, len * 0.66, x + sway * 1.3, len);
        ctx.stroke();
      }
    },
  });
  TX.hair.wrapS = TX.hair.wrapT = THREE.ClampToEdgeWrapping;
};

/* ---------------- materials ---------------- */
G.std = (o) => {
  const { env, ...rest } = o;
  const m = new THREE.MeshStandardMaterial(rest);
  m.envMapIntensity = env != null ? env : 0.35;
  G.MATS.push(m);
  return m;
};
// Shared plain materials (no textures, never animated): one material per look instead of one per prop.
const SHARED = new Map();
G.shared = (o) => {
  const key = JSON.stringify(o);
  if (!SHARED.has(key)) SHARED.set(key, G.std(o));
  return SHARED.get(key);
};
/* three r128 frustum-culls an InstancedMesh with its template geometry's bounds at the mesh origin,
 * so instances elsewhere can vanish when the origin leaves the view. Give the geometry a sphere that
 * encloses every instance instead. (Each instanced geometry here is used by one mesh only.) */
G.fitInstanceBounds = (im) => {
  const g = im.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const r0 = g.boundingSphere.radius, c0 = g.boundingSphere.center.clone();
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const pts = [];
  let maxS = 0;
  for (let i = 0; i < im.count; i++) {
    im.getMatrixAt(i, m); m.decompose(p, q, sc);
    pts.push(c0.clone().applyMatrix4(m)); maxS = Math.max(maxS, sc.x, sc.y, sc.z);
  }
  const box = new THREE.Box3().setFromPoints(pts), sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  sphere.radius += r0 * maxS;
  g.boundingSphere = sphere;
};
G.rep = (tex, x, y) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(x, y); return t; };
const MAT = (G.MAT = {});
G.buildMaterials = () => {
  const std = G.std;
  Object.assign(MAT, {
    boards: std({ map: TX.boards, bumpMap: TX.boardsB, bumpScale: 0.003, roughness: 0.7, env: 0.25 }),
    logs: std({ map: TX.logs, bumpMap: TX.logsB, bumpScale: 0.03, roughness: 0.85, env: 0.4 }),
    floor: std({ map: TX.floor, bumpMap: TX.floorB, bumpScale: 0.003, roughness: 0.5, env: 0.45 }),
    shingle: std({ map: TX.shingle, roughness: 0.9 }),
    stone: std({ map: TX.stone, bumpMap: TX.stone, bumpScale: 0.02, roughness: 0.9, env: 0.3 }),
    beam: std({ map: TX.bark, color: '#7a5a42', roughness: 0.8 }),
    trim: std({ color: '#5e4330', roughness: 0.7 }),
    darkWood: std({ map: TX.boards, color: '#6a4a36', roughness: 0.55, env: 0.35 }),
    wood: std({ map: TX.boards, color: '#b88a62', roughness: 0.55, env: 0.35 }),
    snow: std({ color: '#f3f6fb', roughness: 0.75, env: 0.7 }),
    ice: std({ color: '#8fa6b8', roughness: 0.12, metalness: 0.0, env: 1.3 }),
    bark: std({ map: TX.bark, roughness: 1 }),
    metal: std({ color: '#b89b6a', roughness: 0.3, metalness: 1, env: 1 }),
    darkMetal: std({ color: '#2b2724', roughness: 0.45, metalness: 0.85, env: 0.9 }),
    ceramic: std({ color: '#f1ede4', roughness: 0.25, env: 0.9 }),
    plaid: std({ map: TX.plaid, bumpMap: TX.fabricB, bumpScale: 0.003, roughness: 1 }),
    knitCream: std({ map: TX.knitCream, bumpMap: TX.knitB, bumpScale: 0.006, roughness: 1 }),
    linen: std({ map: TX.linen, bumpMap: TX.fabricB, bumpScale: 0.001, roughness: 1 }),
    rug: std({ map: TX.rug, bumpMap: TX.fabricB, bumpScale: 0.004, roughness: 1 }),
    sofa: std({ map: TX.jersey, color: '#4d4038', bumpMap: TX.fabricB, bumpScale: 0.002, roughness: 1 }),
    glassOut: std({ color: '#ffb46a', emissive: '#ff9a40', emissiveIntensity: 0.55, roughness: 0.05, transparent: true, opacity: 0.32, env: 1.2, depthWrite: false }),
    glassIn: std({ color: '#203050', roughness: 0.02, transparent: true, opacity: 0.18, env: 1.4, depthWrite: false }),
    bulb: new THREE.MeshBasicMaterial({ color: '#ffcf86' }),
    flameGlow: new THREE.MeshBasicMaterial({ color: '#ffd59a' }),
    leaf: std({ color: '#4b6f3f', roughness: 0.65, side: THREE.DoubleSide }),
    pot: std({ color: '#a86040', roughness: 0.85 }),
    candle: std({ color: '#f2e8d6', roughness: 0.6, emissive: '#ffb060', emissiveIntensity: 0.06 }),
  });
  MAT.glassOut.side = THREE.FrontSide; MAT.glassIn.side = THREE.FrontSide;
};

/* ---------------- mesh helpers ---------------- */
G.add = (m, parent, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; (parent || G.world).add(m); return m; };
G.box = (w, h, d, mat, x, y, z, o = {}) => {
  const g = o.r ? new THREE.RoundedBoxGeometry(w, h, d, o.seg || 3, o.r) : new THREE.BoxGeometry(w, h, d);
  if (o.uv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uv[0], uv.getY(i) * o.uv[1]); }
  const m = G.add(new THREE.Mesh(g, mat), o.parent, o.cast !== false, true);
  m.position.set(x, y, z);
  if (o.ry) m.rotation.y = o.ry;
  if (o.coll) G.COLL.push({ x0: x - w / 2 - (o.pad || 0), z0: z - d / 2 - (o.pad || 0), x1: x + w / 2 + (o.pad || 0), z1: z + d / 2 + (o.pad || 0) });
  if (o.cam) G.CAMBLOCK.push(m);
  return m;
};
G.cyl = (rt, rb, h, mat, x, y, z, o = {}) => {
  const m = G.add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 20, 1, !!o.open), mat), o.parent, o.cast !== false);
  m.position.set(x, y, z);
  return m;
};
G.sph = (r, mat, x, y, z, s = [1, 1, 1], parent, seg = 20) => {
  const m = G.add(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), mat), parent);
  m.position.set(x, y, z); m.scale.set(s[0], s[1], s[2]);
  return m;
};
/* Merge several geometries (each with a transform matrix and a flat colour) into one vertex-coloured geometry. */
G.merge = (parts) => {
  const P = [], N = [], C = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    const pos = g.attributes.position, nor = g.attributes.normal;
    nm.getNormalMatrix(p.mat);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(p.mat);
      n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z);
      const c = typeof p.color === 'function' ? p.color(v, n, i) : p.color;
      C.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return out;
};
G.mtx = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/* ---------------- static batching ----------------
 * Merge every static, opaque mesh under `root` that shares a material (and shadow flags) into one
 * mesh, turning hundreds of draw calls into a few dozen. Skipped: instanced/skinned meshes, shader and
 * transparent materials, vertex-coloured materials, anything flagged userData.dynamic, and anything
 * in `skip` (or under a skipped object). Merged-away camera blockers are kept detached, with their
 * world matrices, so the camera can still raycast against them.
 */
G.mergeStatic = (root, skip = new Set()) => {
  root.updateMatrixWorld(true);
  const buckets = new Map(), victims = [];
  const nm = new THREE.Matrix3(), v = new THREE.Vector3();
  const skipped = (o) => { for (let p = o; p; p = p.parent) { if (skip.has(p) || (p.userData && p.userData.dynamic) || p.visible === false) return true; } return false; };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.renderOrder || skipped(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => !(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial) || m.transparent || m.vertexColors)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    if (!nor) return;
    const mw = o.matrixWorld, flip = mw.determinant() < 0;
    nm.getNormalMatrix(mw);
    // Batch by area (the cabin interior, and 16 m blocks outside) so culling and shadow cameras still skip what they can't see.
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const wc = o.geometry.boundingSphere.center.clone().applyMatrix4(mw);
    const zone = G.inside && G.inside(wc.x, wc.z) && wc.y < 2.8 ? 'in' : Math.floor(wc.x / 16) + ',' + Math.floor(wc.z / 16);
    const groups = Array.isArray(o.material) && g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = Array.isArray(o.material) ? o.material[gr.materialIndex] : o.material;
      if (!mat) continue;
      const key = mat.uuid + zone + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat, zone, cast: o.castShadow, recv: o.receiveShadow, P: [], N: [], U: [] }));
      for (let t = gr.start; t < gr.start + gr.count; t += 3) {
        const order = flip ? [t, t + 2, t + 1] : [t, t + 1, t + 2];
        for (const i of order) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mw); b.P.push(v.x, v.y, v.z);
          v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); b.N.push(v.x, v.y, v.z);
          if (uv) b.U.push(uv.getX(i), uv.getY(i)); else b.U.push(0, 0);
        }
      }
    }
    if (g !== o.geometry) g.dispose();
    victims.push(o);
  });
  for (const o of victims) {
    o.parent.remove(o);
    if (!G.CAMBLOCK.includes(o)) o.geometry.dispose();   // blockers keep their geometry for raycasts
  }
  let made = 0;
  for (const b of buckets.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.U, 2));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv; m.matrixAutoUpdate = false; m.name = 'static';
    root.add(m); made++;
  }
  return { merged: victims.length, meshes: made };
};
