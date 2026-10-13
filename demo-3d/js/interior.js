'use strict';
/* =========================================================================
 * Interior: bedroom (x 0–5) and living room (x 5–11). Lamps, fire, cake.
 * ========================================================================= */
(() => {
const { MAT, TX, box, cyl, sph, lerp } = G;
const LAMPS = (G.LAMPS = []);
const FLAMES = (G.FLAMES = []);

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
G.flameMaterial = flameMaterial;
function candle(x, y, z, h = 0.1, r = 0.035, parent) {
  cyl(r, r, h, MAT.candle, x, y + h / 2, z, { parent, seg: 16 });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.07), flameMaterial('#ffb24a'));
  f.position.set(x, y + h + 0.035, z); (parent || G.world).add(f); FLAMES.push(f);
  return f;
}
G.candle = candle;
function tableLamp(x, y, z, power = 5) {
  const g = new THREE.Group(); g.position.set(x, y, z); G.world.add(g);
  cyl(0.06, 0.08, 0.16, MAT.ceramic, 0, 0.08, 0, { parent: g, seg: 16 });
  cyl(0.012, 0.012, 0.16, MAT.metal, 0, 0.24, 0, { parent: g, seg: 8 });
  const shadeMat = G.std({ color: '#f1dcb2', roughness: 0.9, emissive: '#ffb060', emissiveIntensity: 1, side: THREE.DoubleSide });
  const shade = cyl(0.1, 0.15, 0.18, shadeMat, 0, 0.38, 0, { parent: g, open: true, cast: false });
  const light = new THREE.PointLight('#ffb062', 0, 6, 2); light.position.set(0, 0.34, 0); g.add(light);
  const L = { g, light, shade, on: true, power, flick: 1 };
  LAMPS.push(L);
  return L;
}
function floorLamp(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); G.world.add(g);
  cyl(0.15, 0.17, 0.03, MAT.darkMetal, 0, 0.015, 0, { parent: g });
  cyl(0.014, 0.014, 1.45, MAT.darkMetal, 0, 0.74, 0, { parent: g, seg: 8 });
  const shadeMat = G.std({ color: '#f1dcb2', roughness: 0.9, emissive: '#ffb060', emissiveIntensity: 1, side: THREE.DoubleSide });
  const shade = cyl(0.16, 0.23, 0.3, shadeMat, 0, 1.55, 0, { parent: g, open: true, cast: false });
  const light = new THREE.PointLight('#ffb062', 0, 8, 2); light.position.set(0, 1.5, 0); g.add(light);
  const L = { g, light, shade, on: true, power: 9, flick: 1 };
  LAMPS.push(L);
  G.COLL.push({ x0: x - 0.2, z0: z - 0.2, x1: x + 0.2, z1: z + 0.2 });
  return L;
}
G.toggleLamp = (L) => { L.on = !L.on; G.Audio.click(); };

/* ---------------- photographs (procedural "polaroids") ---------------- */
function photoTex(kind) {
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 190;
  const c = cv.getContext('2d');
  c.fillStyle = '#f4efe6'; c.fillRect(0, 0, 160, 190);
  const g = c.createLinearGradient(0, 10, 0, 150);
  const pal = { lake: ['#e8a070', '#7a8fb0'], snow: ['#c7cfdb', '#eef2f7'], fire: ['#3a2418', '#c06a2a'], hill: ['#9fc4e2', '#e8f0f6'], night: ['#0d1430', '#2a3a66'], cake: ['#5a3a2a', '#e0a070'] }[kind];
  g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); c.fillStyle = g; c.fillRect(10, 10, 140, 140);
  const fig = (x, y, s, col) => { c.fillStyle = '#e8c0a0'; c.beginPath(); c.arc(x, y - 30 * s, 8 * s, 0, 7); c.fill(); c.fillStyle = col; c.fillRect(x - 9 * s, y - 22 * s, 18 * s, 26 * s); };
  if (kind === 'night') { c.fillStyle = '#fff'; for (let i = 0; i < 40; i++) c.fillRect(10 + (i * 37) % 140, 10 + (i * 53) % 90, 1.5, 1.5); }
  fig(64, 140, 1.25, '#5a5d63'); fig(92, 142, 1.0, '#e4d7c2');
  c.fillStyle = 'rgba(255,220,180,0.12)'; c.fillRect(10, 10, 140, 140);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  return t;
}
function polaroid(x, y, z, ry, kind, tilt = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.142), G.std({ map: photoTex(kind), roughness: 0.5, env: 0.5 }));
  m.position.set(x, y, z); m.rotation.set(0, ry, tilt); G.world.add(m);
  return m;
}

/* ---------------- build ---------------- */
G.buildInterior = () => {
  const W = G.world;
  /* ===== Bedroom ===== */
  const bx = 2.4;
  box(1.8, 0.3, 2.15, MAT.darkWood, bx, 0.15, 1.2, { coll: true, r: 0.03 });
  box(1.9, 1.2, 0.09, MAT.darkWood, bx, 0.6, 0.16, { r: 0.03 });
  box(1.7, 0.22, 2.0, MAT.linen, bx, 0.41, 1.22, { r: 0.09, seg: 4 });
  const p1 = box(0.66, 0.16, 0.42, MAT.linen, bx - 0.44, 0.6, 0.48, { r: 0.08, seg: 4 }); p1.rotation.x = -0.25;
  const p2 = box(0.66, 0.16, 0.42, MAT.linen, bx + 0.44, 0.6, 0.48, { r: 0.08, seg: 4 }); p2.rotation.x = -0.2;
  box(0.5, 0.2, 0.18, MAT.knitCream, bx + 0.25, 0.62, 0.72, { r: 0.08, seg: 4 }).rotation.set(-0.4, 0.2, 0);
  const duvet = box(1.76, 0.12, 1.5, MAT.knitCream, bx, 0.56, 1.5, { r: 0.06, seg: 4 }); duvet.scale.y = 1;
  box(1.84, 0.06, 0.6, MAT.plaid, bx, 0.64, 1.95, { r: 0.03 }).rotation.z = 0.01;
  // Plush bunny.
  const bun = new THREE.Group(); bun.position.set(bx + 0.62, 0.6, 0.8); bun.rotation.y = -0.4; W.add(bun);
  const fluff = G.std({ color: '#f2ece4', roughness: 1, map: TX.knitCream, bumpMap: TX.knitB, bumpScale: 0.002 });
  sph(0.075, fluff, 0, 0.06, 0, [1, 1.05, 0.9], bun); sph(0.06, fluff, 0, 0.17, 0.02, [1, 0.95, 0.95], bun);
  for (const s of [-1, 1]) { sph(0.022, fluff, s * 0.025, 0.27, 0.0, [0.8, 2.4, 0.5], bun); sph(0.008, MAT.darkMetal, s * 0.022, 0.18, 0.07, [1, 1, 1], bun, 8); }
  // Nightstands and lamps.
  for (const s of [-1, 1]) box(0.5, 0.56, 0.42, MAT.wood, bx + s * 1.28, 0.28, 0.38, { coll: true, r: 0.02 });
  const lampL = tableLamp(bx - 1.28, 0.56, 0.36, 5), lampR = tableLamp(bx + 1.28, 0.56, 0.36, 5);
  candle(bx + 1.42, 0.56, 0.5, 0.08);
  G.INTER.push({ id: 'lampL', pos: [bx - 1.28, 0.8, 0.6], r: 1.0, label: 'Lamp', act: () => G.toggleLamp(lampL) });
  G.INTER.push({ id: 'lampR', pos: [bx + 1.28, 0.8, 0.6], r: 1.0, label: 'Lamp', act: () => G.toggleLamp(lampR) });
  // Fairy lights over the headboard, polaroids pegged on a string.
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, x = lerp(0.6, 4.2, t), y = 1.9 - Math.sin(t * Math.PI * 3) * 0.08 - Math.sin(t * Math.PI) * 0.12;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), MAT.bulb); b.position.set(x, y, 0.135); W.add(b);
  }
  ['lake', 'snow', 'fire', 'hill', 'night', 'cake'].forEach((k, i) => polaroid(1.1 + i * 0.5, 1.62 - Math.sin((i + 0.5) / 6 * Math.PI) * 0.1, 0.125, 0, k, (i % 2 ? 1 : -1) * 0.06));
  G.INTER.push({ id: 'photos', pos: [2.4, 1.5, 1.4], r: 1.3, label: 'Photographs', act: () => G.say(null, '(Six polaroids on a string. The lake. The fire. The night you both got lost and didn’t mind.)') });
  // Wardrobe, rug, plant, laundry basket.
  box(1.1, 2.1, 0.62, MAT.darkWood, 4.3, 1.05, 0.44, { coll: true, cam: true, r: 0.02 });
  box(0.01, 1.9, 0.01, MAT.darkMetal, 4.3, 1.05, 0.755);
  const rug = G.add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), MAT.rug), W, false, true); rug.rotation.x = -Math.PI / 2; rug.position.set(bx, 0.006, 3.2);
  plant(0.45, 3.6, 1.0);
  box(0.9, 0.42, 0.5, MAT.wood, 3.6, 0.21, 4.15, { coll: true, r: 0.02 });   // chest at the foot wall
  box(0.6, 0.05, 0.45, MAT.plaid, 3.5, 0.45, 4.15, { r: 0.02 });
  for (let i = 0; i < 4; i++) box(0.22, 0.05 + i * 0.002, 0.16, G.std({ color: ['#6b3a2e', '#2e4a5a', '#c9b48a', '#3a5a40'][i], roughness: 0.8 }), 3.85, 0.48 + i * 0.05, 4.1);

  /* ===== Living room ===== */
  const fx = 8.0;
  box(2.0, 2.7, 0.62, MAT.stone, fx, 1.35, 0.35, { coll: true, cam: true, uv: [1.2, 1.6] });
  box(2.25, 0.12, 0.44, MAT.darkWood, fx, 1.42, 0.62, { r: 0.02 });
  box(1.0, 0.78, 0.25, G.std({ color: '#070504', roughness: 1, env: 0 }), fx, 0.42, 0.56, { cast: false });
  box(1.7, 0.06, 0.6, MAT.stone, fx, 0.03, 0.98, { cast: false });
  const logA = cyl(0.065, 0.065, 0.6, MAT.bark, fx - 0.05, 0.13, 0.74); logA.rotation.z = Math.PI / 2; logA.rotation.y = 0.3;
  const logB = cyl(0.06, 0.06, 0.55, MAT.bark, fx + 0.05, 0.22, 0.74); logB.rotation.z = Math.PI / 2; logB.rotation.y = -0.4;
  const fireG = new THREE.Group(); fireG.position.set(fx, 0.15, 0.74); W.add(fireG);
  const firePlanes = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.72), flameMaterial('#ff7a2a'));
    m.position.set((i - 1) * 0.14, 0.33, 0); fireG.add(m); firePlanes.push(m); FLAMES.push(m);
  }
  const fireLight = new THREE.PointLight('#ff8a3a', 0, 10, 2); fireLight.position.set(fx, 0.5, 1.35); W.add(fireLight);
  G.FIRE = { planes: firePlanes, light: fireLight, on: true, power: 9, level: 1 };
  G.INTER.push({ id: 'fire', pos: [fx, 0.6, 1.25], r: 1.3, label: () => (G.FIRE.on ? 'Fireplace' : 'Light the fire'), act: () => { G.FIRE.on = !G.FIRE.on; if (G.FIRE.on) G.say('partner', 'Fire person. My hero.'); } });
  // Mantle: candles, frames, a snow globe, a sprig of pine.
  candle(fx - 0.85, 1.48, 0.6, 0.16, 0.03); candle(fx - 0.72, 1.48, 0.62, 0.11, 0.03); candle(fx + 0.82, 1.48, 0.62, 0.13, 0.03);
  G.MANTLE_LIGHT = new THREE.PointLight('#ffa850', 1.4, 3, 2); G.MANTLE_LIGHT.position.set(fx, 1.75, 0.8); W.add(G.MANTLE_LIGHT);
  polaroid(fx - 0.3, 1.62, 0.68, 0, 'lake', -0.12); polaroid(fx + 0.05, 1.6, 0.68, 0, 'hill', 0.08);
  sph(0.07, G.std({ color: '#dcebfa', roughness: 0.02, transparent: true, opacity: 0.35, env: 1.5 }), fx + 0.5, 1.56, 0.6);
  cyl(0.07, 0.08, 0.05, MAT.darkWood, fx + 0.5, 1.5, 0.6);
  // Tall bookshelf left of the fireplace.
  bookshelf(6.15, 0.3, 1.5, 0.34, 2.4, 0);
  // Sofa facing the fire.
  const sx = 8.0, sz = 3.0;
  box(2.2, 0.44, 0.92, MAT.sofa, sx, 0.22, sz, { coll: true, r: 0.07, seg: 4 });
  box(2.2, 0.58, 0.24, MAT.sofa, sx, 0.66, sz + 0.38, { r: 0.09, seg: 4 });
  for (const s of [-1, 1]) box(0.22, 0.64, 0.92, MAT.sofa, sx + s * 1.1, 0.32, sz, { r: 0.09, seg: 4 });
  for (const s of [-1, 1]) box(0.96, 0.15, 0.64, MAT.sofa, sx + s * 0.5, 0.51, sz - 0.08, { r: 0.07, seg: 4 });
  const pil1 = box(0.42, 0.4, 0.13, MAT.knitCream, sx - 0.72, 0.77, sz + 0.2, { r: 0.06, seg: 3 }); pil1.rotation.set(-0.3, 0.3, 0.12);
  const pil2 = box(0.4, 0.38, 0.13, MAT.plaid, sx + 0.75, 0.76, sz + 0.2, { r: 0.06, seg: 3 }); pil2.rotation.set(-0.3, -0.25, -0.1);
  const drape = box(0.7, 0.04, 1.0, MAT.plaid, sx + 0.95, 0.68, sz + 0.05, { r: 0.02 }); drape.rotation.set(0.2, 0, -0.5);
  G.SOFA = { x: sx, z: sz, seatY: 0.6 };
  G.INTER.push({ id: 'sofa', pos: [sx, 0.5, sz - 0.6], r: 1.1, label: () => (G.STATE.cuddled ? 'Sofa' : 'Curl up together'), act: () => G.Story.cuddle() });
  // Blanket used in the cuddle scene (hidden until then).
  const blanket = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2, 24, 20), MAT.plaid);
  const bp = blanket.geometry.attributes.position;
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i); bp.setZ(i, Math.sin(x * 9) * 0.02 + Math.cos(y * 7 + x * 3) * 0.025 + Math.max(0, 0.36 - Math.abs(y + 0.15) * 0.9) * 0.0); }
  blanket.geometry.computeVertexNormals();
  blanket.material = MAT.plaid.clone(); blanket.material.side = THREE.DoubleSide; G.MATS.push(blanket.material);
  blanket.castShadow = true; blanket.receiveShadow = true; blanket.visible = false; W.add(blanket);
  G.CUDDLE_BLANKET = blanket;
  // Coffee table with the cake, mugs, cookies and a candle.
  const tx = 8.0, tz = 1.85;
  box(1.15, 0.06, 0.62, MAT.darkWood, tx, 0.43, tz, { r: 0.02 });
  for (const [a, b] of [[-0.5, -0.24], [0.5, -0.24], [-0.5, 0.24], [0.5, 0.24]]) box(0.06, 0.4, 0.06, MAT.darkWood, tx + a, 0.2, tz + b);
  G.COLL.push({ x0: tx - 0.6, z0: tz - 0.34, x1: tx + 0.6, z1: tz + 0.34 });
  G.CAKE = buildCake(tx - 0.12, 0.46, tz);
  for (const [dx, dz, c] of [[0.36, 0.14, '#efe7da'], [0.42, -0.12, '#8a3a2e']]) {
    cyl(0.045, 0.04, 0.1, G.std({ color: c, roughness: 0.3, env: 0.8 }), tx + dx, 0.51, tz + dz, { seg: 18 });
    cyl(0.04, 0.04, 0.005, G.std({ color: '#4a2a1a', roughness: 0.2 }), tx + dx, 0.555, tz + dz, { seg: 16 });
  }
  candle(tx - 0.45, 0.46, tz - 0.16, 0.09, 0.03);
  G.INTER.push({ id: 'cake', pos: [tx, 0.6, tz], r: 1.1, label: () => (G.CAKE.lit ? 'Make a wish' : 'Cake'), act: () => G.Story.cake() });
  // Armchair.
  const chair = new THREE.Group(); chair.position.set(6.25, 0, 1.95); chair.rotation.y = 0.95; W.add(chair);
  const cm = G.std({ map: TX.knitDark, color: '#9a6a52', roughness: 1 });
  box(0.86, 0.42, 0.82, cm, 0, 0.21, 0, { parent: chair, r: 0.07, seg: 4 });
  box(0.86, 0.64, 0.2, cm, 0, 0.72, 0.33, { parent: chair, r: 0.08, seg: 4 });
  for (const s of [-1, 1]) box(0.16, 0.56, 0.82, cm, s * 0.43, 0.33, 0, { parent: chair, r: 0.07, seg: 4 });
  box(0.6, 0.05, 0.6, MAT.knitCream, 0, 0.45, -0.02, { parent: chair, r: 0.02 });
  G.COLL.push({ x0: 5.75, z0: 1.45, x1: 6.75, z1: 2.45 });
  // East wall bookshelf, floor lamp, plant, rug.
  bookshelf(10.72, 3.95, 0.34, 1.05, 2.1, Math.PI / 2);
  floorLamp(10.35, 0.55);
  floorLamp(6.15, 3.55);
  plant(10.4, 4.2, 1.2);
  const rug2 = G.add(new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.0), MAT.rug), W, false, true); rug2.rotation.x = -Math.PI / 2; rug2.position.set(8, 0.006, 2.2);
  // Coats by the door.
  box(0.6, 0.05, 0.08, MAT.darkWood, 5.5, 1.75, 4.45);
  const coat = G.std({ map: TX.jersey, color: '#5c5f63', roughness: 1 });
  box(0.3, 0.75, 0.12, coat, 5.38, 1.35, 4.38, { r: 0.05 }); box(0.28, 0.7, 0.12, G.std({ map: TX.knitCream, roughness: 1 }), 5.65, 1.38, 4.38, { r: 0.05 });
};

function plant(x, z, s = 1) {
  cyl(0.15 * s, 0.12 * s, 0.32 * s, MAT.pot, x, 0.16 * s, z, { seg: 18 });
  const r = G.seeded(Math.round(x * 100 + z));
  for (let i = 0; i < 16; i++) {
    const leaf = G.add(new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 10, 6, 0, Math.PI), MAT.leaf));
    leaf.scale.set(0.42, 1, 0.1); const a = r() * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 0.1 * s, (0.42 + r() * 0.38) * s, z + Math.sin(a) * 0.1 * s);
    leaf.rotation.set(Math.sin(a) * 0.8, a, Math.cos(a) * 0.8);
  }
  G.COLL.push({ x0: x - 0.2 * s, z0: z - 0.2 * s, x1: x + 0.2 * s, z1: z + 0.2 * s });
}
function bookshelf(x, z, w, d, h, ry) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.world.add(g);
  box(w, h, 0.03, MAT.darkWood, 0, h / 2, -d / 2 + 0.015, { parent: g });
  for (const s of [-1, 1]) box(0.04, h, d, MAT.darkWood, s * (w / 2 - 0.02), h / 2, 0, { parent: g });
  const cols = ['#6e2f26', '#2d4659', '#a8803c', '#43614a', '#5e4870', '#9a5a36', '#d4c6a8', '#33302c', '#7a6a5a'];
  const r = G.seeded(Math.round(x * 31 + z * 7));
  const rows = Math.floor(h / 0.42);
  for (let row = 0; row < rows; row++) {
    const y = 0.06 + row * 0.42;
    box(w - 0.06, 0.03, d - 0.02, MAT.darkWood, 0, y, 0.01, { parent: g });
    let u = -w / 2 + 0.06;
    while (u < w / 2 - 0.1) {
      const kind = r();
      if (kind < 0.08) { cyl(0.04, 0.045, 0.12, G.std({ color: '#cfd8d0', roughness: 0.05, transparent: true, opacity: 0.55, env: 1.2 }), u + 0.05, y + 0.075, 0, { parent: g }); u += 0.12; continue; }
      if (kind < 0.12) { G.candle(u + 0.04, y + 0.015, 0.0, 0.07, 0.025, g); u += 0.1; continue; }
      const bw = 0.025 + r() * 0.035, bh = 0.2 + r() * 0.13;
      const b = box(bw, bh, d * 0.75, G.std({ color: cols[Math.floor(r() * cols.length)], roughness: 0.85 }), u + bw / 2, y + 0.015 + bh / 2, 0.02, { parent: g, cast: false });
      if (r() < 0.1) b.rotation.z = 0.22;
      u += bw + 0.004;
    }
  }
  G.COLL.push(ry ? { x0: x - d / 2, z0: z - w / 2, x1: x + d / 2, z1: z + w / 2 } : { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
  G.INTER.push({ id: 'shelf' + x, pos: [x, 1, z], r: 1.2, label: 'Bookshelf', act: () => G.say(null, '(Paperbacks with cracked spines, a jar of sea glass, and a candle that smells like pine.)') });
}
function buildCake(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); G.world.add(g);
  cyl(0.19, 0.19, 0.012, MAT.ceramic, 0, 0.006, 0, { parent: g, seg: 32 });
  const sponge = G.std({ color: '#f3e3cf', roughness: 0.7 });
  cyl(0.15, 0.15, 0.13, sponge, 0, 0.077, 0, { parent: g, seg: 32 });
  cyl(0.153, 0.153, 0.018, G.std({ color: '#fff6ec', roughness: 0.35, env: 0.6 }), 0, 0.14, 0, { parent: g, seg: 32 });
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; sph(0.017, G.std({ color: '#b83a3a', roughness: 0.25, env: 0.9 }), Math.cos(a) * 0.12, 0.16, Math.sin(a) * 0.12, [1, 1, 1], g, 10); }
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, cx = Math.cos(a) * 0.065, cz = Math.sin(a) * 0.065;
    cyl(0.005, 0.005, 0.07, G.std({ color: '#e8d6c0', roughness: 0.5 }), cx, 0.185, cz, { parent: g, seg: 8 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.05), flameMaterial('#ffb24a'));
    f.position.set(cx, 0.245, cz); g.add(f); flames.push(f); FLAMES.push(f);
  }
  const light = new THREE.PointLight('#ffb062', 0, 3, 2); light.position.set(0, 0.32, 0); g.add(light);
  return { g, flames, light, lit: true };
}
})();
