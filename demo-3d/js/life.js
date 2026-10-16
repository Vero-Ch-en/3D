'use strict';
/* =========================================================================
 * Life in the cabin: coats and boots, the cold, a fire that has to be fed,
 * weather that comes and goes, and Partner's own way of passing the time
 * when you leave her to it. Runs after story.js (uses G.SAPI).
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE, clamp, damp, smooth } = G;
const A = G.SAPI, S = A.S;
const N = A.N, Pt = A.Pt;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const outside = (c) => !G.inside(c.x, c.z) && !G.underRoof(c.x, c.z);
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const FIRE_AT = { x: 8.0, z: 0.6 };
const L = (S.life = S.life || {});
G.LIFE = L;
const freeBark = (line, d) => { if (!G.busy() && !PARTNER.hidden && !PARTNER.bark && dist() < 7 && !(G.S.flags && G.S.flags.noBarks)) { G.bark(line, d || 2.8); return true; } return false; };

/* =====================================================================
 * Outdoor gear: coat, hat, scarf and boots, worn over the indoor clothes
 * ===================================================================== */
function buildGear(m, o) {
  const u = m.userData, k = u.k, fem = !!o.fem;
  const W = fem ? { hip: 0.172, waist: 0.13, chest: 0.155, sh: 0.16 } : { hip: 0.162, waist: 0.15, chest: 0.18, sh: 0.19 };
  const parts = [];
  const add = (mesh, parent, x = 0, y = 0, z = 0) => { mesh.position.set(x * k, y * k, z * k); mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false; mesh.userData.warm = true; parent.add(mesh); parts.push(mesh); return mesh; };
  const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r) * k, y * k)), seg);
  const coatM = G.std({ map: G.rep(G.TX.jersey, 2, 2), color: o.coat, bumpMap: G.TX.jerseyB, bumpScale: 0.004, roughness: 1, env: 0.2 });
  const knit = (c) => G.std({ map: G.rep(G.TX.knitCream, 2, 1), color: c, bumpMap: G.TX.knitB, bumpScale: 0.004, roughness: 1 });
  const bust = fem ? 0.012 : 0, c = 1.17;
  // A wool coat to mid-thigh over the jumper.
  const coat = add(new THREE.Mesh(lathe([
    [W.hip * 1.22, -0.26], [W.hip * 1.19, -0.17], [W.hip * c, -0.05], [W.waist * 1.2, 0.1], [(W.waist + W.chest) / 2 * c, 0.18],
    [(W.chest + bust) * c, 0.27], [W.chest * 1.18, 0.38], [W.sh * c, 0.43], [W.sh * 1.0, 0.475], [0.118, 0.505], [0.088, 0.522], [0.0, 0.526],
  ], 36), coatM), u.spine);
  coat.scale.z = fem ? 0.72 : 0.69;
  add(new THREE.Mesh(new THREE.TorusGeometry(0.083 * k, 0.026 * k, 10, 28), coatM), u.chest, 0, 0.14, 0.004).rotation.x = Math.PI / 2 - 0.15;   // collar
  for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.008 * k, 8, 6), G.shared({ color: '#2a201a', roughness: 0.5 })), u.spine, 0.015, 0.03 + i * 0.11, (W.waist * 1.2 + 0.004) * (fem ? 0.72 : 0.69));
  const ua = 0.186 * 1.75, fa = 0.146 * 1.75;
  u.arms.forEach((a) => {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.058 * k, 16, 12), coatM), a.sh, 0, -0.01, 0).scale.set(1, 0.9, 1);
    add(new THREE.Mesh(lathe([[0.062, 0.01], [0.063, -0.05], [0.057, -0.15], [0.051, -ua + 0.02], [0.049, -ua]], 20), coatM), a.sh).scale.z = 0.94;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.047 * k, 12, 10), coatM), a.el);
    add(new THREE.Mesh(lathe([[0.049, 0], [0.051, -0.06], [0.046, -0.15], [0.044, -fa + 0.05], [0.048, -fa + 0.02], [0.04, -fa + 0.015]], 20), coatM), a.el);
  });
  // Hat: his a plain turned-up beanie, hers a cream bobble hat (she had one like it at the fair).
  const hatM = knit(o.hat), n0 = parts.length;
  const hat = add(new THREE.Mesh(new THREE.SphereGeometry(0.094 * k, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hatM), u.head, 0, 0.026, -0.012);
  hat.scale.set(1.1, 1.12, 1.12);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.09 * k, 0.017 * k, 8, 28), hatM), u.head, 0, 0.04, -0.006).rotation.x = Math.PI / 2 + 0.12;
  if (o.pom) add(new THREE.Mesh(new THREE.SphereGeometry(0.032 * k, 12, 8), hatM), u.head, 0, 0.142, -0.02);
  const hatParts = parts.slice(n0);
  // Scarf: wound twice, one end down the front.
  const sm = knit(o.scarf);
  const sc = add(new THREE.Mesh(new THREE.TorusGeometry(0.075 * k, 0.034 * k, 10, 24), sm), u.chest, 0, 0.15, 0.008);
  sc.rotation.x = Math.PI / 2 - 0.12; sc.scale.set(1.12, 1.18, 0.95);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.065 * k, 0.26 * k, 0.026 * k), sm), u.chest, 0.045, 0.04, 0.12).rotation.set(0.14, 0, 0.1);
  // Boots over the socks.
  const bootM = G.std({ color: o.boots, roughness: 0.62, env: 0.4 });
  const fl = 0.152 * 1.75, ank = 0.039 * 1.75;
  u.legs.forEach((lg) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.043 * k, 0.046 * k, 0.15 * k, 16), bootM), lg.ft, 0, 0.03, -0.004);
    add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), bootM), lg.ft, 0, -ank + 0.034, fl * 0.5 - 0.058).scale.set(0.049 * k, 0.039 * k, fl * 0.53 * k);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.094 * k, 0.022 * k, fl * 1.06 * k), G.shared({ color: '#221c18', roughness: 0.9 })), lg.ft, 0, -ank + 0.008, fl * 0.5 - 0.058);
  });
  // Snow that settles on the shoulders (and the hat) while you stand about in it.
  const snow = [];
  const flake = (parent, x, y, z, sx, sy, sz) => { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), G.MAT.snow); s.scale.set(sx * k, sy * k, sz * k); s.position.set(x * k, y * k, z * k); s.visible = false; s.castShadow = false; s.userData.warm = true; s.userData.base = [sx, sy, sz]; parent.add(s); snow.push(s); return s; };
  // [y with the coat on, y without]: the coat's shoulders sit a little higher than the jumper's.
  for (const a of u.arms) flake(u.chest, a.sh.position.x / k * 0.72, 0.138, -0.005, 0.05, 0.018, 0.045).userData.ys = [0.138, 0.122];
  flake(u.chest, 0, 0.13, -0.075, 0.07, 0.013, 0.042).userData.ys = [0.13, 0.112];
  flake(u.head, 0, 0.115, -0.012, 0.055, 0.02, 0.055);
  return { parts, snow, hat, hatParts };
}
const ADULT = G.KIDS ? G.KIDS.adults : { player: PLAYER.m, partner: PARTNER.m };
const GEAR = {
  player: buildGear(ADULT.player, { coat: '#5c5f63', hat: '#3a3d44', scarf: '#b8322a', boots: '#4a3426' }),
  partner: buildGear(ADULT.partner, { fem: true, coat: '#a8875e', hat: '#ece4d6', scarf: '#7a4a5e', boots: '#6b4a32', pom: true }),
};
const gearOf = (c) => (c === PLAYER ? GEAR.player : GEAR.partner);
function setDressed(c, on) {
  c.dressed = on;
  const g = gearOf(c);
  g.parts.forEach((p) => { p.visible = on && !(c === PLAYER && L.hatGiven && g.hatParts.includes(p)); });   // the snowman has his hat
  if (G.HOOK_COATS) G.HOOK_COATS[c === PLAYER ? 0 : 1].visible = !on;
  BOOTS[c === PLAYER ? 0 : 1].visible = !on;
}
G.setDressed = setDressed;

/* ---------- the mat by the door: boots when they're off, and the puddle they leave ---------- */
const BOOTS = [];
const PUDDLE = (() => {
  const W = G.world;
  const mat = G.add(new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.5), G.std({ map: G.TX.rug, color: '#8a6a48', roughness: 1 })), W, false, true);
  mat.rotation.x = -Math.PI / 2; mat.position.set(5.55, 0.007, 4.22); mat.userData.dynamic = true;
  const tex = G.canvasTex(0, null, { w: 128, h: 128, draw: (c, w, h) => { const g = c.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, 'rgba(90,90,100,1)'); g.addColorStop(0.6, 'rgba(150,150,160,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = g; c.beginPath(); c.ellipse(64, 64, 62, 44, 0, 0, 7); c.fill(); } });
  const pm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, polygonOffset: true, polygonOffsetFactor: -4, color: '#ffffff' });
  const pd = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.46), pm); pd.rotation.x = -Math.PI / 2; pd.position.set(5.55, 0.01, 4.22); pd.renderOrder = 2; W.add(pd);
  const leather = [G.std({ color: '#4a3426', roughness: 0.62, env: 0.4 }), G.std({ color: '#6b4a32', roughness: 0.62, env: 0.4 })];
  [[5.32, 4.22, 0.25, 1.0], [5.76, 4.24, -0.2, 0.86]].forEach(([x, z, ry, s], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.userData.dynamic = true; W.add(g);
    for (const dx of [-0.065, 0.065]) {
      G.cyl(0.043 * s, 0.047 * s, 0.17 * s, leather[i], dx, 0.13 * s, -0.02, { parent: g, seg: 14 });
      const f = G.sph(1, leather[i], dx, 0.045 * s, 0.05 * s, [0.05 * s, 0.045 * s, 0.13 * s], g, 16); f.castShadow = true;
    }
    BOOTS.push(g);
  });
  return { mesh: pd, mat: pm, wet: 0 };
})();

/* =====================================================================
 * The cold: frost at the edges of your sight, heavier breath, shivers
 * ===================================================================== */
const frostEl = G.$('frost');
if (frostEl) {
  // A frosted-glass vignette, drawn once: dense feathery crystals at the edges, clear in the middle.
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const c = cv.getContext('2d'), r = G.seeded(77);
  const vg = c.createRadialGradient(256, 256, 120, 256, 256, 362); vg.addColorStop(0, 'rgba(235,245,255,0)'); vg.addColorStop(0.65, 'rgba(225,238,252,0.22)'); vg.addColorStop(1, 'rgba(240,248,255,0.8)');
  c.fillStyle = vg; c.fillRect(0, 0, 512, 512);
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineCap = 'round';
  const branch = (x, y, a, len, w, d) => { if (d > 4 || len < 3) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); for (const s of [-1, 1]) branch(x + (x2 - x) * 0.5, y + (y2 - y) * 0.5, a + s * (0.6 + r() * 0.3), len * 0.5, w * 0.7, d + 1); branch(x2, y2, a + (r() - 0.5) * 0.4, len * 0.7, w * 0.8, d + 1); };
  for (let i = 0; i < 260; i++) {
    const ang = r() * Math.PI * 2, rad = 200 + Math.pow(r(), 0.5) * 170, x = 256 + Math.cos(ang) * rad, y = 256 + Math.sin(ang) * rad;
    branch(x, y, ang + Math.PI + (r() - 0.5) * 1.2, 10 + r() * 26, 1.2 + r() * 1.2, 0);
  }
  frostEl.style.backgroundImage = `url(${cv.toDataURL()})`;
}
const COLD = { outing: false, warned: {}, inT: 0 };
function updateCold(dt) {
  const storm = G.WEATHER.kind === 'heavy' ? 1 : 0;
  for (const c of [PLAYER, PARTNER]) {
    c.cold = c.cold || 0;
    if (outside(c)) {
      let rate = (0.0032 + 0.0045 * STATE.tod + 0.004 * storm + (G.onIce(c.x, c.z) ? 0.002 : 0)) * (c.dressed ? 1 : 3.4) * (c.speed > 2 ? 0.75 : 1);
      if (c.lie) rate *= 2.2;   // lying in the snow
      c.cold = Math.min(1, c.cold + rate * dt);
    } else if (G.inside(c.x, c.z)) {
      const nearFire = G.FIRE.on && Math.hypot(c.x - FIRE_AT.x, c.z - FIRE_AT.z) < 2.7;
      c.cold = Math.max(0, c.cold - dt * (nearFire ? 0.04 * (0.4 + G.FIRE.level) : 0.011));
    }
    // Snow settles on shoulders and hats while it's falling, and melts away indoors.
    const snowing = outside(c) && STATE.snow > 0.25;
    c.snowAcc = clamp((c.snowAcc || 0) + dt * (snowing ? STATE.snow * 0.012 * (c.speed > 0.3 ? 0.6 : 1) : G.inside(c.x, c.z) ? -0.03 : -0.004), 0, 1);
    const g = gearOf(c), show = c.snowAcc > 0.06;
    g.snow.forEach((s, i) => { const onHat = i === g.snow.length - 1; s.visible = show && (!onHat || (c.dressed && !(c === PLAYER && L.hatGiven))); if (s.visible) { const b = s.userData.base, f = 0.35 + 0.65 * c.snowAcc, k = c.m.userData.k; s.scale.set(b[0] * k * f, b[1] * k * (0.4 + c.snowAcc), b[2] * k * f); if (s.userData.ys) s.position.y = s.userData.ys[c.dressed ? 0 : 1] * k; } });
  }
  if (frostEl) { const f = smooth(0.38, 1, PLAYER.cold) * 0.92; if (Math.abs((frostEl._o || 0) - f) > 0.004) { frostEl._o = f; frostEl.style.opacity = f.toFixed(3); } }
  // Her side of it.
  const out = outside(PLAYER), inNow = G.inside(PLAYER.x, PLAYER.z);
  if (out && !COLD.outing) { COLD.outing = true; COLD.warned = {}; if (!PLAYER.dressed && S.chapter !== 'prologue') wait2(1.5, () => { if (outside(PLAYER) && !PLAYER.dressed && !freeBark(pick(['Coat, Partner! And boots. You’ll catch your death.', 'Where is your coat? It’s snowing, Partner.']), 3)) return; if (!L.coatHint) { L.coatHint = 1; G.hint('Your coat and boots are on the hook by the front door.', 5); } }); }
  if (inNow && COLD.outing) {
    COLD.outing = false;
    if (PLAYER.cold > 0.45 && S.chapter !== 'prologue') wait2(1.2, () => freeBark(pick(['You’re frozen! Come and stand by the fire.', 'Look at you. Fire. Now. I insist.']), 3));
  }
  if (out && PLAYER.cold > 0.72 && !COLD.warned.a) { COLD.warned.a = 1; freeBark(pick(['Your nose has gone from pink to blue. Inside soon?', 'I can’t feel my face. Can you feel yours?']), 3); }
  if (out && PLAYER.cold > 0.9 && !COLD.warned.b) {
    COLD.warned.b = 1;
    if (!G.busy() && dist() < 3 && PARTNER.mode === 'follow' && !PARTNER.hold && !PARTNER.task && !PARTNER.lead) { G.setHold(true); PARTNER.holdTimer = 16; G.bark('Your hands are ice. Give them here.', 2.8); }
  }
  // Warming up again by the fire.
  if (PLAYER.cold > 0.5) COLD.wasCold = true;
  if (COLD.wasCold && PLAYER.cold < 0.12 && inNow) { COLD.wasCold = false; if (!L.thawHint) { L.thawHint = 1; G.hint('(The warmth comes back into your fingers in pins and needles.)', 5); } }
}
const wait2 = (s, f) => G.wait(s).then(f);

/* ---------- putting coats on and taking them off ---------- */
const coats = A.findInter('coats');
coats.label = () => (PLAYER.dressed ? 'Hang up your coat' : 'Put on your coat and boots');
A.rewire('coats', async () => {
  if (!PLAYER.dressed) {
    setDressed(PLAYER, true);
    await N(A.cyc('coatOn', ['(Coat. Boots. The red scarf, wound twice. You look like a parcel somebody loves.)', '(Coat, boots, scarf. Ready for whatever the weather has in mind.)']));
    if (!S.flags.scarfTalk && A.canHear() && !PARTNER.lie) { S.flags.scarfTalk = 1; await Pt('You’ve had that red scarf as long as I’ve known you.'); }
    return;
  }
  setDressed(PLAYER, false);
  if (PLAYER.snowyT > 1 || PLAYER.snowAcc > 0.05) PUDDLE.wet = 1;
  PLAYER.snowAcc = 0;
  await N(A.cyc('coatOff', ['(You hang up your coat and kick your boots onto the mat, where they drip contentedly.)', '(Coat on the hook, boots on the mat.)']));
});
REACTadd('coats', ['Hang mine next to yours, please. They like to be together.', 'The unclaimed scarf stays on the hook. It’s a free scarf.']);
function REACTadd(id, lines) { const R = A.REACT[id] || (A.REACT[id] = { lines: [] }); R.lines = R.lines.concat(lines); }

/* Partner dresses herself on the way out and hangs her coat up a few seconds after coming in. */
function updatePartnerGear(dt) {
  const p = PARTNER;
  if (S.chapter === 'prologue') return;
  if (!G.inside(p.x, p.z) && !p.dressed && !p.hidden) setDressed(p, true);
  if (G.inside(p.x, p.z) && p.dressed && !p.sit) { p.inT = (p.inT || 0) + dt; if (p.inT > 3.5 && p.x > 4.8 && p.x < 7.4) { setDressed(p, false); p.inT = 0; if (p.snowyT > 1) PUDDLE.wet = 1; p.snowAcc = 0; if (Math.random() < 0.6) freeBark(pick(['*hangs her coat beside yours*', '*kicks her boots onto the mat*']), 2); } }
  else if (!G.inside(p.x, p.z)) p.inT = 0;
  // Still in your coat by the fire after a while: she notices.
  if (PLAYER.dressed && G.inside(PLAYER.x, PLAYER.z)) { L.coatInT = (L.coatInT || 0) + dt; if (L.coatInT > 50 && !L.coatTease) { L.coatTease = 1; freeBark('Are you planning to wear that coat all evening, Partner?', 3); } } else L.coatInT = 0;
  // The puddle on the mat dries; drips while it's fresh.
  PUDDLE.wet = Math.max(0, PUDDLE.wet - dt / 240);
  const k = 1 - PUDDLE.wet * 0.42; PUDDLE.mat.color.setRGB(k, k, k * 1.01);
  PUDDLE.mesh.visible = PUDDLE.wet > 0.01;
  if (PUDDLE.wet > 0.3 && Math.hypot(PLAYER.x - 5.55, PLAYER.z - 4.2) < 3 && Math.random() < dt * 0.25) G.Audio.tone(1800 + Math.random() * 800, 0.02, 0.008);
}

/* =====================================================================
 * The fire: it burns down, and wants feeding from the log basket
 * ===================================================================== */
const F = G.FIRE;
F.fuel = F.on ? 1 : 0;
L.basket = L.basket == null ? 4 : L.basket;
const BASKET = (() => {
  const W = G.world, g = new THREE.Group(); g.position.set(9.42, 0, 0.92); g.userData.dynamic = true; W.add(g);
  const wick = G.std({ map: G.rep(G.TX.knitCream, 3, 1), color: '#9a7a50', roughness: 1 });
  G.cyl(0.24, 0.2, 0.32, wick, 0, 0.16, 0, { parent: g, seg: 22, open: true });
  G.cyl(0.2, 0.2, 0.02, wick, 0, 0.01, 0, { parent: g, seg: 22 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.016, 8, 26), wick); rim.rotation.x = Math.PI / 2; rim.position.y = 0.32; g.add(rim);
  const logs = [];
  for (let i = 0; i < 5; i++) { const lg = G.cyl(0.05 + (i % 2) * 0.008, 0.055, 0.42, G.MAT.bark, -0.1 + (i % 3) * 0.1, 0.2 + Math.floor(i / 3) * 0.1, (i % 2 ? 0.05 : -0.05), { parent: g, seg: 9 }); lg.rotation.set(Math.PI / 2 + (i - 2) * 0.12, 0, Math.PI / 2 + (i % 2 ? 0.2 : -0.15)); logs.push(lg); }
  G.COLL.push({ x0: 9.17, z0: 0.67, x1: 9.67, z1: 1.17 });
  return { g, logs };
})();
const WOODPILE = (() => {
  const W = G.world, g = new THREE.Group(); g.position.set(4.3, 0, 4.92); W.add(g);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 6 - (row > 2 ? 2 : 0); i++) {
    const lg = G.cyl(0.075, 0.075, 0.42, G.MAT.bark, -0.45 + i * 0.165 + (row % 2) * 0.08, 0.08 + row * 0.14, 0, { parent: g, seg: 9 }); lg.rotation.x = Math.PI / 2;
    G.cyl(0.07, 0.07, 0.005, G.shared({ color: '#c49a6a', roughness: 0.9 }), lg.position.x, lg.position.y, 0.212, { parent: g, seg: 9 }).rotation.x = Math.PI / 2;
  }
  G.box(1.1, 0.05, 0.5, G.MAT.snow, -0.05, 0.6, 0, { parent: g, r: 0.02 });
  G.COLL.push({ x0: 3.72, z0: 4.65, x1: 4.88, z1: 5.18 });
  return g;
})();
function armful(m, n) {
  const u = m.userData, k = u.k, g = new THREE.Group(); g.position.set(0, -0.06 * k, 0.2 * k); g.visible = false; g.userData.warm = true; u.chest.add(g);
  for (let i = 0; i < n; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.42, 9), G.MAT.bark); lg.rotation.z = Math.PI / 2 + (i - 1) * 0.08; lg.position.set((i - 1) * 0.02, (i % 2) * 0.07 - 0.02, (i % 2) * -0.035); lg.castShadow = true; lg.userData.warm = true; g.add(lg); }
  return g;
}
const ARMS = { player: armful(ADULT.player, 3), partner: armful(ADULT.partner, 2) };
function setCarry(c, on) { c.carry = on; (c === PLAYER ? ARMS.player : ARMS.partner).visible = on; }
const fire = A.findInter('fire');
fire.label = () => (!F.on ? 'Light the fire' : F.fuel < 0.62 && L.basket > 0 ? 'Add a log' : 'Poke the fire');
const pokeAct = fire.raw;
A.rewire('fire', async () => {
  if (!F.on) {
    if (L.basket <= 0) { await N('(No logs. The basket by the hearth is empty, and the woodpile is out on the porch.)'); return; }
    L.basket--; F.fuel = 0.6; F.on = true; G.Audio.blow();
    await N('(It takes three matches and a certain amount of quiet swearing.)');
    if (A.canHear()) await Pt('The fire person, at work. My hero, Partner.');
    return;
  }
  if (F.fuel < 0.62 && L.basket > 0) {
    L.basket--; F.fuel = Math.min(1, F.fuel + 0.42); G.Audio.poke(); G.sparkBurst();
    await N(A.cyc('addLog', ['(You set a log on the embers. It thinks about it, then catches with a pleased little roar.)', '(Another log. The fire settles in for the long haul.)', '(A log on the fire. Sparks go up the chimney like they have somewhere to be.)']));
    if (L.basket === 0 && !L.emptyHint) { L.emptyHint = 1; G.hint('That was the last log in the basket. There’s a woodpile on the porch.', 5); }
    return;
  }
  await pokeAct();
});
A.inter('basket', [9.42, 0.4, 1.25], 0.8, () => (PLAYER.carry ? 'Fill the log basket' : 'Log basket'), async () => {
  if (PLAYER.carry) {
    const helped = PARTNER.carry; setCarry(PLAYER, false); if (helped) setCarry(PARTNER, false);
    L.basket = Math.min(5, L.basket + (helped ? 5 : 3)); G.Audio.poke();
    await N(helped ? '(Five logs in the basket, stacked by two people with very different ideas about stacking.)' : '(You stack the logs in the basket. Enough for the evening.)');
    return;
  }
  await N(L.basket ? `(${['', 'One log', 'Two logs', 'Three logs', 'Four logs', 'Five logs'][L.basket]} in the basket.)` : '(Empty. The woodpile is out on the porch.)');
});
A.inter('woodpile', [4.3, 0.6, 5.4], 0.85, () => (PLAYER.carry ? 'Woodpile' : 'Take an armful of logs'), async () => {
  if (PLAYER.carry) { await N('(Your arms are full already.)'); return; }
  if (PLAYER.freeSit) return;
  setCarry(PLAYER, true);
  await N(A.cyc('logs', ['(An armful of logs, cold and sweet-smelling, with snow in the bark.)', '(Another armful. Your arms remember the shape.)']));
  if (A.canHear() && PARTNER.mode === 'follow' && !PARTNER.task && !PARTNER.lie && !PARTNER.carry && !PARTNER.hold && dist() < 4) { setCarry(PARTNER, true); G.bark(pick(['I’ll take the small ones.', 'Give me two. I’m stronger than I look.']), 2.4); }
});
A.REACT.basket = { lines: ['Thank you, Partner. You do keep us warm.'] };
A.REACT.woodpile = { lines: ['Mind your back. It’s the only one you have.', 'The one at the bottom is the load-bearing log. Don’t touch it.'] };
function updateFire(dt) {
  if (F.on && !F._was && F.fuel < 0.05) F.fuel = 0.6;   // lit by a scene
  F._was = F.on;
  if (S.chapter !== L.ch) { L.ch = S.chapter; if (F.on) F.fuel = 1; L.basket = Math.max(L.basket, 3); PUDDLE.wet = 0; }
  if (F.on) {
    F.fuel = Math.max(0, F.fuel - dt / 480);
    if (F.fuel <= 0) { F.outT = (F.outT || 0) + dt; if (F.outT > 50) { F.on = false; F.outT = 0; freeBark('Oh. The fire’s gone out.', 2.6); } } else F.outT = 0;
    if (F.fuel < 0.2 && !L.lowWarned) { L.lowWarned = 1; freeBark(pick(['The fire’s getting sleepy, Partner.', 'Is it me, or is it getting colder in here?']), 3); }
    if (F.fuel > 0.4) L.lowWarned = 0;
  }
  F.level = !F.on ? 0 : F.fuel > 0.02 ? 0.3 + 0.7 * smooth(0, 0.55, F.fuel) : 0.14;   // embers when it's nearly out
  BASKET.logs.forEach((lg, i) => { lg.visible = i < L.basket; });
  // Logs are heavy, and you can't sit down with an armful.
  PLAYER.speedMul = (PLAYER.carry ? 0.8 : 1) * (G.surfaceAt(PLAYER.x, PLAYER.z) === 'snow' ? 0.84 : 1) * (PLAYER.extraMul || 1);
  if (PLAYER.carry) ARMS.player.visible = !(PLAYER.sit > 0.2);
  if (PARTNER.carry && (PARTNER.sit > 0.2 || PARTNER.hidden || PARTNER.lie)) setCarry(PARTNER, false);
}

/* =====================================================================
 * Weather: calm, light snow, heavier snow, the odd short blizzard, clear spells
 * ===================================================================== */
const KINDS = {
  clear: { snow: 0.0, bias: -0.22, fog: 1.12 },
  light: { snow: 0.3, bias: -0.06, fog: 1 },
  snow: { snow: 0.75, bias: 0.06, fog: 0.82 },
  heavy: { snow: 1.0, bias: 0.34, fog: 0.5 },
};
const PLAN = { morning: ['light', 'clear', 'light', 'snow', 'light'], walk: ['clear', 'light', 'clear', 'light'], evening: ['snow', 'heavy', 'snow', 'light', 'snow'] };
const WEATHER = (G.WEATHER = { kind: 'snow', t: 0, next: 150, i: 0, ch: null, hold: null });
function setWeather(kind, quiet) {
  const K = KINDS[kind]; if (!K) return;
  WEATHER.kind = kind; STATE.snowTarget = K.snow; G.WIND.biasTarget = K.bias; STATE.fogK = K.fog;
  if (quiet) return;
  if (kind === 'heavy') { G.Audio.rattle(); wait2(2, () => freeBark(pick(['Listen to that. The wind’s trying the door.', 'Here it comes. Proper snow now.']), 3)); }
  if (kind === 'clear' && STATE.day > 0.5) wait2(3, () => freeBark(pick(['Oh, look. The sun’s out.', 'The snow’s stopped. Everything’s sparkling.']), 3));
}
G.setWeather = setWeather;
function updateWeather(dt) {
  const ch = S.chapter;
  if (!PLAN[ch]) { if (WEATHER.ch) { WEATHER.ch = null; G.WIND.biasTarget = 0; STATE.fogK = 1; } return; }
  if (WEATHER.ch !== ch) { WEATHER.ch = ch; WEATHER.i = 0; WEATHER.t = 0; WEATHER.next = 120 + Math.random() * 90; WEATHER.kind = PLAN[ch][0]; G.WIND.biasTarget = KINDS[WEATHER.kind].bias; STATE.fogK = KINDS[WEATHER.kind].fog; return; }   // the chapter set its own snow; leave it for the first spell
  if (WEATHER.hold) { if (WEATHER.kind !== WEATHER.hold) setWeather(WEATHER.hold, true); return; }   // a scene wants particular weather
  if (STATE.todTarget > 0.5 && WEATHER.kind !== 'clear') { setWeather('clear', true); return; }   // stars on the porch: a clear night
  WEATHER.t += dt;
  if (WEATHER.t > WEATHER.next && !G.busy()) {
    WEATHER.t = 0; WEATHER.i = (WEATHER.i + 1) % PLAN[ch].length;
    const kind = PLAN[ch][WEATHER.i];
    WEATHER.next = (kind === 'heavy' ? 50 : 110) + Math.random() * 90;   // blizzards are short
    setWeather(kind);
  }
  if (WEATHER.kind === 'heavy' && G.WIND.gust > 0.9 && Math.random() < dt * 0.3) G.Audio.rattle();
}

/* =====================================================================
 * Partner's own time: things she does when you leave her to it
 * ===================================================================== */
const book = (() => {
  const u = ADULT.partner.userData, k = u.k, g = new THREE.Group(); g.position.set(0, -0.06 * k, 0.22 * k); g.rotation.x = -0.9; g.visible = false; g.userData.warm = true; u.chest.add(g);
  const cover = G.std({ color: '#3a5a6a', roughness: 0.8 });
  for (const s of [-1, 1]) { const half = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.004, 0.13), cover); half.position.set(s * 0.045, 0, 0); half.rotation.z = -s * 0.25; g.add(half); const pg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.12), G.shared({ color: '#efe6d2', roughness: 0.9 })); pg.position.set(s * 0.043, 0.007, 0); pg.rotation.z = -s * 0.25; g.add(pg); }
  g.traverse((o) => { o.userData.warm = true; o.castShadow = true; });
  return g;
})();
G.PARTNER_BOOK = book;
const can = (() => {
  const W = G.world, g = new THREE.Group(); g.position.set(13.78, 0.9, 0.38); g.userData.dynamic = true; W.add(g);
  const zinc = G.std({ color: '#8a9aa0', roughness: 0.35, metalness: 0.8, env: 1 });
  G.cyl(0.07, 0.075, 0.15, zinc, 0, 0.075, 0, { parent: g, seg: 16 });
  const sp = G.cyl(0.012, 0.018, 0.2, zinc, 0.1, 0.11, 0, { parent: g, seg: 8 }); sp.rotation.z = -0.9;
  const hd = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI), zinc); hd.position.set(-0.02, 0.15, 0); g.add(hd);
  return { g, home: g.position.clone() };
})();
const handOf = (m) => ADULT.partner.userData.arms[0].hand;
function holdCan(on) {
  if (on) { handOf().add(can.g); can.g.position.set(0, -0.15, 0.03); can.g.rotation.set(0, Math.PI / 2, 0); }
  else { G.world.add(can.g); can.g.position.copy(can.home); can.g.rotation.set(0, 0, 0); }
}
const alone = () => dist() > 5.5 || !A.sameRoom();
const SOLO = [
  { id: 'read', solo: true, stay: true, spot: { x: 6.95, z: 1.5 }, seatAt: { x: 6.22, z: 1.97, yaw: 2.23, y: 0.47 }, dur: [70, 130],
    cond: () => soloOK('read') && !(PLAYER.freeSit && Math.hypot(PLAYER.x - 6.22, PLAYER.z - 1.97) < 0.6) && G.inside(PLAYER.x, PLAYER.z),
    lines: ['I’ll just read for a bit. Don’t let me fall asleep.', 'Chapter eleven. Again.'],
    onArrive: (p) => { book.visible = true; p.holdPose = 'read'; }, onTick: dozeTick, onEnd: (p) => { book.visible = false; p.holdPose = null; wake(p, true); } },
  { id: 'nap', solo: true, stay: true, spot: { x: 6.55, z: 2.95 }, seatAt: { x: 7.45, z: 2.95, yaw: Math.PI, y: 0.6 }, dur: [60, 120],
    cond: () => soloOK('nap') && S.chapter === 'evening' && !(PLAYER.sit > 0.2),
    lines: ['I’m only resting my eyes.', '*curls up in the corner of the sofa*'], onTick: dozeTick, onEnd: (p) => wake(p, true) },
  { id: 'radio', solo: true, stay: true, sway: true, spot: { x: 13.75, z: 4.1 }, yaw: 0.3, dur: [40, 80],
    cond: () => soloOK('radio'),
    onArrive: (p) => { if (!G.Audio.radioOn()) { G.Audio.radio(true); G.KITCHEN.radioDial.material.opacity = 0.9; G.bark(pick(['A little music, I think.', 'This kitchen needs a song.']), 2.6); } else G.bark('Oh, I like this one.', 2.2); },
    onTick: (p, dt, T) => { T.humT = (T.humT == null ? 6 : T.humT) - dt; if (T.humT < 0) { T.humT = 12 + Math.random() * 10; G.Audio.hum(); } if (!G.Audio.radioOn()) T.abort = true; p.swayTarget = 0.6; } },
  { id: 'water', solo: true, stay: true, spot: { x: 13.78, z: 0.98 }, dur: [90, 90],
    cond: () => soloOK('water') && !L.watered,
    onArrive: (p, T) => waterRound(p, p.task), onEnd: (p) => { holdCan(false); p.holdPose = null; } },
];
function soloOK(id) { return STATE.autonomy && S.chapter !== 'prologue' && Math.random() < 0.6 && (G.simT - (L['solo_' + id] || -999)) > 150; }
SOLO.forEach((o) => { const arrive = o.onArrive; o.onArrive = (p) => { L['solo_' + o.id] = G.simT; if (arrive) arrive(p, p.task); }; });
G.SMART.push(...SOLO);
// Reading or curled up on the sofa: left alone long enough, she drifts off. Coming back wakes her.
function dozeTick(p, dt, T) {
  T.aloneT = alone() ? (T.aloneT || 0) + dt : 0;
  if (!p.dozing && T.t > 18 && T.aloneT > 22) { p.dozing = true; p.lidsClosed = true; p.tiltTarget = -0.3; p.headDown = 0.25; if (p.holdPose === 'read') p.holdPose = 'cup'; }
  if (p.dozing) {
    T.t = Math.min(T.t, T.dur - 5);   // she isn't going anywhere while she's asleep
    if (dist() < 1.7) { T.nearT = (T.nearT || 0) + dt; if (T.nearT > 1.6) wake(p); } else T.nearT = 0;
  }
}
function wake(p, quiet) {
  if (!p.dozing) return;
  p.dozing = false; p.lidsClosed = false; p.tiltTarget = 0; p.headDown = 0;
  if (p.holdPose === 'cup' && book.visible) p.holdPose = 'read';
  if (!quiet) { G.bark(pick(['Mm? I was resting my eyes.', 'I wasn’t asleep. I was reading with my eyes closed.', '…Oh. Hello. How long was I out?']), 2.8); S.mem.dozes = (S.mem.dozes || 0) + 1; }
}
async function waterRound(p, T) {
  const live = () => p.task === T;
  holdCan(true);
  const pour = async (x, z, look) => {
    await G.walkTo(p, x, z, 1.1); if (!live()) return false;
    p.yaw = Math.atan2(look[0] - p.x, look[2] - p.z); G.gaze(p, look, 4);
    p.holdPose = 'water'; G.Audio.tone && pourSound();
    await G.wait(3.6); p.holdPose = null; return live();
  };
  if (!(await pour(12.82, 4.1, [12.82, 0.95, 4.47]))) return;
  G.bark(pick(['There you are, herbs. Drink up.', 'Thyme, rosemary, and the one we can’t identify.']), 2.6);
  if (!(await pour(9.85, 3.72, [10.4, 0.7, 4.2]))) return;
  G.bark(pick(['Basil. Darling. Don’t drink it all at once.', 'You’re doing wonderfully, Basil.']), 2.6);
  L.watered = true;
  await G.walkTo(p, 13.78, 0.98, 1.1); if (!live()) return;
  T.abort = true;
}
function pourSound() { for (let i = 0; i < 14; i++) G.Audio.tone(900 + Math.random() * 1400, 0.03, 0.004, i * 0.2 + Math.random() * 0.1); }
// Run off and leave her behind indoors, and she settles into something of her own.
function updateSolo(dt) {
  const p = PARTNER;
  if (!STATE.autonomy || p.mode !== 'follow' || p.task || p.lead || p.hold || p.hidden || p.lie || G.busy()) { L.leftT = 0; return; }
  if (dist() > 7 && G.inside(p.x, p.z)) {
    L.leftT = (L.leftT || 0) + dt;
    if (L.leftT > 2.5) {
      L.leftT = 0;
      const opts = SOLO.filter((o) => (!o.cond || o.cond()) && Math.hypot(o.spot.x - p.x, o.spot.z - p.z) < 6);
      if (opts.length) { const o = opts[0]; p.task = { o, phase: 'go', t: 0 }; G.bark(pick(['I’ll be in here, Partner.', 'Go on, then. I’ll find something to do.', 'Fine. Leave me. I have a book.']), 2.4); }
    }
  } else L.leftT = 0;
}
G.onQuiet = () => { for (const c of [PLAYER, PARTNER]) { setCarry(c, false); c.cold = 0; c.snowAcc = 0; } book.visible = false; holdCan(false); };
G.onLoadSave = () => {};

// The evening's set pieces take her away from whatever she was doing (and wake her, gently).
for (const k of ['cake', 'cuddle', 'porch']) {
  const f = G.Story[k];
  G.Story[k] = function (...a) { if (PARTNER.task) { wake(PARTNER, true); G.endPartnerTask(); } setCarry(PARTNER, false); return f.apply(this, a); };
}
G.STEP_HOOKS.push((dt) => {
  if (!STATE.started) return;
  updateCold(dt); updatePartnerGear(dt); updateFire(dt); updateWeather(dt); updateSolo(dt);
  // After the cake, the evening is hers too: she wanders off to things she likes.
  if (S.chapter === 'evening' && STATE.cakeDone && !STATE.porchDone && !G.busy()) STATE.autonomy = true;
});
setDressed(PLAYER, false); setDressed(PARTNER, false);
});
