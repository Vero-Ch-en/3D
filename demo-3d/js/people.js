'use strict';
/* =========================================================================
 * People: anthropometric bodies (Drillis & Contini ratios), layered
 * hair-card hair, knitwear / hoodie outfits, simple faces with real eyes.
 * Rig: root → hips → spine → chest → neck → head; shoulder → elbow → hand;
 * hip → knee → ankle. +z is forward.
 * ========================================================================= */
(() => {
const { TX, lerp } = G;

/* ---------- hair cards ---------- */
const SKULL = { c: new THREE.Vector3(0, 0.02, -0.005), r: new THREE.Vector3(0.082, 0.103, 0.099) };
function skullNormal(p) {
  const d = p.clone().sub(SKULL.c);
  return new THREE.Vector3(d.x / (SKULL.r.x ** 2), d.y / (SKULL.r.y ** 2), d.z / (SKULL.r.z ** 2)).normalize();
}
function pushOut(p, margin) {
  const d = p.clone().sub(SKULL.c);
  const e = Math.hypot(d.x / (SKULL.r.x * margin), d.y / (SKULL.r.y * margin), d.z / (SKULL.r.z * margin));
  if (e < 1) { d.multiplyScalar(1 / e); p.copy(SKULL.c).add(d); }
}
function hairGeometry(style, seed) {
  const r = G.seeded(seed);
  const P = [], N = [], UV = [], I = [];
  const crown = new THREE.Vector3(0.0, 0.12, -0.035);
  const card = (p0, dir0, L, w0, grav, curl, layer) => {
    const S = 7;
    const pts = [p0.clone()], dirs = [];
    let d = dir0.clone().normalize();
    let q = p0.clone();
    for (let k = 0; k < S; k++) {
      dirs.push(d.clone());
      q = q.clone().addScaledVector(d, L / S);
      pushOut(q, 1.01 + layer * 0.006);
      { const dd = q.clone().sub(SKULL.c); const e = Math.hypot(dd.x / SKULL.r.x, dd.y / SKULL.r.y, dd.z / SKULL.r.z); if (e > 1.08 + layer * 0.02 && q.y > SKULL.c.y - 0.06) { q.copy(SKULL.c).add(dd.multiplyScalar((1.08 + layer * 0.02) / e)); } }
      pts.push(q);
      d.add(new THREE.Vector3(0, -grav, 0)).add(new THREE.Vector3((r() - 0.5) * curl, (r() - 0.5) * curl * 0.5, (r() - 0.5) * curl)).normalize();
    }
    dirs.push(d.clone());
    const base = P.length / 3;
    for (let k = 0; k <= S; k++) {
      const t = k / S, p = pts[k];
      const n = p.distanceTo(SKULL.c) < 0.16 ? skullNormal(p) : new THREE.Vector3(p.x, 0, p.z).normalize();
      const side = new THREE.Vector3().crossVectors(dirs[k], n).normalize();
      const w = w0 * lerp(1, 0.55, t);
      for (const s of [-0.5, 0.5]) {
        const v = p.clone().addScaledVector(side, s * w).addScaledVector(n, 0.002 * layer);
        P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); UV.push(s + 0.5, 1 - t);
      }
      if (k) { const a = base + (k - 1) * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  };
  const onSkull = (theta, phi) => new THREE.Vector3(SKULL.c.x + SKULL.r.x * Math.cos(phi) * Math.sin(theta), SKULL.c.y + SKULL.r.y * Math.sin(phi), SKULL.c.z + SKULL.r.z * Math.cos(phi) * Math.cos(theta));
  const comb = (p, n, frontBias) => {
    const t = p.clone().sub(crown); t.addScaledVector(n, -t.dot(n)); t.normalize();
    return t.multiplyScalar(0.9).addScaledVector(n, 0.35).add(new THREE.Vector3(0, -0.25, frontBias));
  };
  if (style === 'shaggy') {
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 120; i++) {
        const theta = (r() * 2 - 1) * Math.PI, phi = -0.45 + r() * 1.95;
        const front = Math.cos(theta) > 0.55;
        if (front && phi < 0.42) continue;           // hairline
        if (Math.abs(Math.sin(theta)) > 0.85 && phi < -0.05 && Math.cos(theta) > -0.2) continue; // above the ears
        const p = onSkull(theta, phi), n = skullNormal(p);
        let dir = comb(p, n, front ? 0.35 : 0);
        if (front) dir.add(new THREE.Vector3(0, -0.55, 0.45));
        const L = front ? 0.055 + r() * 0.025 : 0.045 + r() * 0.045 + (phi < 0.2 ? 0.015 : 0);
        card(p, dir, L, 0.02 + r() * 0.01, 0.35, 0.2, layer);
      }
    }
  } else {
    // Long, loosely tied hair: body falls to the shoulders, bun at the back, face-framing strands.
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 130; i++) {
        const theta = (r() * 2 - 1) * Math.PI, phi = -0.35 + r() * 1.85;
        const front = Math.cos(theta) > 0.5;
        if (front && phi < 0.45) continue;
        if (Math.abs(Math.sin(theta)) > 0.85 && phi < 0.05 && Math.cos(theta) > -0.2) continue;
        const p = onSkull(theta, phi), n = skullNormal(p);
        const toBun = new THREE.Vector3(0, 0.07, -0.11).sub(p);
        let dir = phi > 0.1 ? toBun.normalize().addScaledVector(n, 0.25) : comb(p, n, 0);
        const L = phi > 0.1 ? 0.06 + r() * 0.05 : 0.14 + r() * 0.1;
        card(p, dir, L, 0.022 + r() * 0.012, phi > 0.1 ? 0.02 : 0.3, 0.18, layer);
      }
    }
    // Bun: cards wound around a point at the back of the crown.
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, b = r() * Math.PI;
      const c = new THREE.Vector3(0, 0.085, -0.115);
      const p = c.clone().add(new THREE.Vector3(Math.cos(a) * Math.sin(b) * 0.032, Math.cos(b) * 0.03, Math.sin(a) * Math.sin(b) * 0.032));
      const dir = new THREE.Vector3(-Math.sin(a), (r() - 0.5) * 0.6, Math.cos(a));
      card(p, dir, 0.08 + r() * 0.05, 0.03, 0.0, 0.6, 1);
    }
    // Face-framing strands and loose flyaways.
    for (const s of [-1, 1]) for (let j = 0; j < 4; j++) {
      const p = onSkull(s * (0.75 + j * 0.12), 0.42 + j * 0.05), n = skullNormal(p);
      card(p, new THREE.Vector3(s * 0.15, -1, 0.25).addScaledVector(n, 0.2), 0.17 + j * 0.03, 0.018 + r() * 0.01, 0.12, 0.25, 2);
    }
    for (let j = 0; j < 7; j++) {
      const th = (r() - 0.5) * 0.9, p = onSkull(th, 0.66 + r() * 0.1), n = skullNormal(p);
      card(p, new THREE.Vector3(th * 0.6, -0.5, 0.6).addScaledVector(n, 0.3), 0.035 + r() * 0.015, 0.02, 0.2, 0.3, 2);  // wispy bangs
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  return g;
}

/* ---------- body ---------- */
G.makeHuman = (o) => {
  const H = o.height, k = H / 1.75, fem = !!o.fem;
  const W = fem ? { hip: 0.172, waist: 0.13, chest: 0.155, sh: 0.16, shoulderX: 0.16 } : { hip: 0.162, waist: 0.15, chest: 0.18, sh: 0.19, shoulderX: 0.19 };
  const std = G.std;
  const skin = std({ color: o.skin, roughness: 0.48, emissive: '#5a2010', emissiveIntensity: 0.06, env: 0.3 });
  const topMat = o.outfit === 'sweater'
    ? std({ map: G.rep(TX.knitCream, 3, 2), bumpMap: G.rep(TX.knitB, 3, 2), bumpScale: 0.0025, roughness: 1, env: 0.2 })
    : std({ map: TX.jersey, color: o.top, bumpMap: TX.jerseyB, bumpScale: 0.002, roughness: 0.95, env: 0.25 });
  const legMat = std({ map: TX.jersey, color: o.legs, bumpMap: TX.jerseyB, bumpScale: 0.002, roughness: 0.9 });
  const sock = std({ map: TX.knitCream, color: o.socks || '#d8cfc2', roughness: 1 });
  const sole = std({ color: '#3a3330', roughness: 0.85 });
  const hairM = std({ map: TX.hair, color: new THREE.Color(o.hair).multiplyScalar(0.62), alphaTest: 0.38, side: THREE.DoubleSide, roughness: 0.72, env: 0.12 });
  const scalpM = std({ color: new THREE.Color(o.hair).multiplyScalar(0.7), roughness: 0.6 });
  const eyeW = std({ color: '#ece6df', roughness: 0.08, env: 1.2 });
  const iris = std({ color: o.eyes || '#5a3a22', roughness: 0.05, env: 1.6 });
  const pupil = std({ color: '#0a0706', roughness: 0.05, env: 1.6 });
  const lip = std({ color: o.lips || '#b86a62', roughness: 0.38, env: 0.5 });
  const lash = std({ color: '#1a120e', roughness: 0.6 });
  const LIDS = [];
  const root = new THREE.Group();
  const M = (geo, mat, parent, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * k, y * k, z * k); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const lathe = (pts, seg = 30) => { const P = pts[0][1] > pts[pts.length - 1][1] ? pts.slice().reverse() : pts; return new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r) * k, y * k)), seg); };
  const ell = (rx, ry, rz, mat, parent, x, y, z, seg = 20, cast = true) => { const m = M(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), mat, parent, x, y, z, cast); m.scale.set(rx * k, ry * k, rz * k); return m; };
  const loose = o.outfit === 'sweater' ? 1.07 : 1.04;

  /* pelvis & torso */
  const hipY = 0.53 * 1.75;
  const hips = new THREE.Group(); hips.position.y = hipY * k; root.add(hips);
  M(lathe([[0, -0.13], [W.hip * 0.62, -0.115], [W.hip * 0.96, -0.06], [W.hip, 0.0], [W.hip * 0.97, 0.06], [W.waist * 1.02, 0.13], [0, 0.135]]), legMat, hips).scale.z = 0.7;
  const spine = new THREE.Group(); spine.position.y = 0.1 * k; hips.add(spine);
  const bust = fem ? 0.012 : 0;
  const hemY = o.outfit === 'sweater' ? -0.13 : -0.07;
  const torso = M(lathe([
    [W.hip * loose * 1.02, hemY], [W.hip * loose, hemY + 0.06], [W.waist * loose * 1.03, 0.1], [(W.waist + W.chest) / 2 * loose, 0.18],
    [(W.chest + bust) * loose, 0.27], [(W.chest + bust * 0.5) * loose, 0.33], [W.chest * 1.02 * loose, 0.38], [W.sh * loose, 0.43],
    [W.sh * 0.88 * loose, 0.47], [0.1, 0.5], [0.066, 0.52], [0, 0.524],
  ], 36), topMat, spine);
  torso.scale.z = fem ? 0.7 : 0.66;
  // Ribbed hem
  M(lathe([[W.hip * loose * 1.03, hemY - 0.002], [W.hip * loose * 1.06, hemY + 0.03], [W.hip * loose * 1.03, hemY + 0.055]]), topMat, spine).scale.z = torso.scale.z;
  const chest = new THREE.Group(); chest.position.y = 0.36 * k; spine.add(chest);
  if (o.outfit === 'hoodie') {
    // Hood bunched behind the neck, drawstrings, kangaroo pocket.
    const hood = ell(0.085, 0.045, 0.035, topMat, chest, 0, 0.12, -0.075, 24); hood.rotation.x = 0.45;
    const hr = M(new THREE.TorusGeometry(0.075 * k, 0.02 * k, 10, 24, Math.PI * 1.25), topMat, chest, 0, 0.155, -0.01); hr.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 1.375);
    for (const s of [-1, 1]) { const ds = M(new THREE.CylinderGeometry(0.0035 * k, 0.0035 * k, 0.16 * k, 6), std({ color: '#d8d4cc', roughness: 0.8 }), chest, s * 0.035, 0.05, 0.118); ds.rotation.x = 0.06; }
    const pk = M(new THREE.BoxGeometry(0.2 * k, 0.11 * k, 0.012 * k), topMat, spine, 0, 0.06, W.waist * loose * (fem ? 0.7 : 0.66) + 0.003); pk.rotation.x = -0.08;
  } else {
    // Cowl collar of the sweater.
    M(new THREE.TorusGeometry(0.075 * k, 0.022 * k, 10, 28), topMat, chest, 0, 0.145, 0.005).rotation.x = Math.PI / 2 - 0.15;
  }

  /* neck & head */
  const neck = new THREE.Group(); neck.position.y = 0.135 * k; chest.add(neck);
  M(new THREE.CylinderGeometry(0.048 * k, 0.056 * k, 0.12 * k, 20), skin, neck, 0, 0.04, 0.005);
  const head = new THREE.Group(); head.position.set(0, 0.155 * k, 0.012 * k); neck.add(head);
  ell(0.077, 0.098, 0.094, skin, head, 0, 0.02, -0.005, 36);
  ell(0.06, 0.064, 0.066, skin, head, 0, -0.034, 0.004, 28);                  // jaw/cheeks
  ell(0.03, 0.022, 0.028, skin, head, 0, -0.082, 0.038, 18);                  // chin
  const bridge = ell(0.011, 0.03, 0.012, skin, head, 0, 0.0, 0.088, 14); bridge.rotation.x = -0.3;
  ell(0.0105, 0.0095, 0.0105, skin, head, 0, -0.025, 0.094, 14);                 // nose tip
  for (const s of [-1, 1]) ell(0.007, 0.0065, 0.008, skin, head, s * 0.0105, -0.029, 0.088, 10);  // nostril wings
  for (const s of [-1, 1]) {
    ell(0.011, 0.024, 0.017, skin, head, s * 0.077, 0.0, -0.008, 12);        // ears
    ell(0.012, 0.012, 0.012, eyeW, head, s * 0.031, 0.007, 0.073, 18, false);
    ell(0.0068, 0.0068, 0.0025, iris, head, s * 0.031, 0.007, 0.0848, 16, false);
    ell(0.0033, 0.0033, 0.0015, pupil, head, s * 0.031, 0.007, 0.0868, 10, false);
    const lid = ell(0.0135, 0.008, 0.0125, skin, head, s * 0.031, 0.0135, 0.073, 16); lid.scale.y *= 0.9; LIDS.push(lid);
    const ln = M(new THREE.BoxGeometry(0.028 * k, 0.0022 * k, 0.004 * k), lash, head, s * 0.031, 0.0125, 0.0855, false); ln.rotation.z = -s * 0.06;
    const brow = M(new THREE.BoxGeometry(0.03 * k, 0.0055 * k, 0.007 * k), scalpM, head, s * 0.033, 0.033, 0.086, false); brow.rotation.z = -s * 0.1;
  }
  ell(0.0165, 0.0045, 0.007, lip, head, 0, -0.0505, 0.0855, 16, false);
  ell(0.015, 0.005, 0.007, lip, head, 0, -0.058, 0.0835, 16, false);
  // Hair: a scalp shell plus layered alpha-tested cards.
  ell(0.08, 0.1, 0.096, scalpM, head, 0, 0.022, -0.01, 28).scale.y *= 1;
  const hg = hairGeometry(o.hairStyle, o.seed || 7);
  const hair = new THREE.Mesh(hg, hairM); hair.scale.setScalar(k); hair.castShadow = false; head.add(hair);
  if (o.hairStyle === 'bun') ell(0.034, 0.03, 0.034, scalpM, head, 0, 0.085, -0.115, 16);

  /* arms */
  const arms = [];
  const ua = 0.186 * 1.75, fa = 0.146 * 1.75;
  const sleeveR = o.outfit === 'sweater' ? 1.1 : 1.0;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * W.shoulderX * k, 0.07 * k, -0.005 * k); chest.add(sh);
    ell(0.047 * sleeveR, 0.042, 0.047 * sleeveR, topMat, sh, 0, -0.01, 0, 20);
    M(lathe([[0.05 * sleeveR, 0], [0.051 * sleeveR, -0.05], [0.046 * sleeveR, -0.15], [0.04 * sleeveR, -ua + 0.02], [0.037 * sleeveR, -ua]]), topMat, sh).scale.z = 0.94;
    const el = new THREE.Group(); el.position.y = -ua * k; sh.add(el);
    ell(0.036 * sleeveR, 0.036, 0.035 * sleeveR, topMat, el, 0, 0, 0, 14);
    const cuffEnd = o.outfit === 'sweater' ? -fa - 0.035 : -fa + 0.01;
    M(lathe([[0.038 * sleeveR, 0], [0.041 * sleeveR, -0.06], [0.036 * sleeveR, -0.15], [0.033 * sleeveR, cuffEnd + 0.04], [0.036 * sleeveR, cuffEnd + 0.004], [0.0, cuffEnd]]), topMat, el);
    M(new THREE.CylinderGeometry(0.022 * k, 0.025 * k, 0.03 * k, 14), skin, el, 0, -fa + 0.005, 0);
    const hand = new THREE.Group(); hand.position.y = -fa * k; el.add(hand);
    ell(0.017, 0.045, 0.038, skin, hand, 0, -0.04, 0, 18);
    for (let f = 0; f < 4; f++) ell(0.0075, 0.03 - Math.abs(f - 1.5) * 0.003, 0.0075, skin, hand, s * 0.002, -0.098 + Math.abs(f - 1.5) * 0.004, -0.024 + f * 0.016, 10);
    const th = ell(0.01, 0.026, 0.011, skin, hand, -s * 0.004, -0.045, 0.038, 12); th.rotation.x = 0.55;
    sh.rotation.z = s * 0.07;
    arms.push({ sh, el, hand });
  }

  /* legs */
  const lids = [];
  const legs = [];
  const tl = 0.245 * 1.75, sl = 0.246 * 1.75, ank = 0.039 * 1.75, fl = 0.152 * 1.75;
  for (const s of [-1, 1]) {
    const thg = new THREE.Group(); thg.position.set(s * (fem ? 0.088 : 0.086) * k, 0, 0); hips.add(thg);
    M(lathe([[0.088, 0.02], [0.085, -0.04], [0.074, -0.18], [0.06, -0.33], [0.052, -tl]]), legMat, thg).scale.z = 0.95;
    const kn = new THREE.Group(); kn.position.y = -tl * k; thg.add(kn);
    ell(0.05, 0.05, 0.048, legMat, kn, 0, 0, 0, 14);
    M(lathe([[0.051, 0], [0.054, -0.09], [0.046, -0.2], [0.04, -sl + 0.03], [0.034, -sl + 0.005], [0, -sl]]), legMat, kn);
    const ft = new THREE.Group(); ft.position.y = -sl * k; kn.add(ft);
    M(new THREE.CylinderGeometry(0.032 * k, 0.036 * k, 0.05 * k, 14), sock, ft, 0, -0.01, 0);
    ell(0.043, 0.034, fl * 0.5, sock, ft, 0, -ank + 0.032, fl * 0.5 - 0.06, 22);
    M(new THREE.BoxGeometry(0.082 * k, 0.016 * k, fl * k), sole, ft, 0, -ank + 0.008, fl * 0.5 - 0.06);
    legs.push({ th: thg, kn, ft });
  }
  root.userData = { hips, spine, chest, neck, head, arms, legs, k, H, hipY: hipY * k, lids: LIDS, bodyMats: [skin, topMat, legMat, sock, sole], skinM: skin, topM: topMat, legM: legMat, sockM: sock, outfit: o.outfit };
  G.scene.add(root);
  return root;
};

/* ---------- Blender body (rigged glTF) driven by the procedural rig ----------
 * The procedural rig above keeps animating as before. The Blender mesh's bones
 * copy each rig group's motion: Mbone = Mgroup * Mgroup_rest^-1 * Mbone_rest.
 * The procedural body meshes are hidden; eyes, lids, brows, lips and hair stay.
 */
/* Character models: fetched as .glb when served over http(s); opened from disk (file://, where fetch
 * is blocked) they come from js/models.js, which embeds the same files as base64 and is only loaded then. */
let embedded = null;
const loadEmbedded = () => embedded || (embedded = new Promise((res) => {
  if (window.CBS_MODELS) return res(window.CBS_MODELS);
  const s = document.createElement('script');
  s.src = 'js/models.js';
  s.onload = () => res(window.CBS_MODELS || {});
  s.onerror = () => res({});
  document.head.appendChild(s);
}));
G.loadModelBuffer = async (name) => {
  const custom = G.ASSET_MANIFEST && G.ASSET_MANIFEST.characters[name];
  if (location.protocol !== 'file:') {
    try {
      const r = await fetch(custom ? custom.url : 'models/' + name + '.glb');
      if (r.ok) return await r.arrayBuffer();
    } catch (e) { /* fall through to the embedded copy */ }
  }
  const all = await loadEmbedded();
  if (!all[name]) return null;
  return Uint8Array.from(atob(all[name]), (c) => c.charCodeAt(0)).buffer;
};
G.attachBlenderBody = async (root, name) => {
  if (!THREE.GLTFLoader) return false;
  const bin = await G.loadModelBuffer(name);
  if (!bin) return false;
  return new Promise((resolve) => {
    new THREE.GLTFLoader().parse(bin, '', (gltf) => {
      const u = root.userData, k = u.k;
      const model = gltf.scene;
      // A model from the asset manifest can bring its own materials and proportions; the built-in ones
      // are authored for a 1.75 m body and take the game's knit and jersey materials.
      const spec = (G.ASSET_MANIFEST && G.ASSET_MANIFEST.characters[name]) || {};
      if (spec.fit) { const b = new THREE.Box3().setFromObject(model); model.scale.setScalar(u.H / Math.max(0.1, b.max.y - b.min.y)); }
      else model.scale.setScalar(spec.scale || k);
      // Rest pose: zero every rig rotation, then capture world matrices.
      const groups = { hips: u.hips, spine: u.spine, chest: u.chest, neck: u.neck, head: u.head };
      u.arms.forEach((a, i) => { const s = i ? 'R' : 'L'; groups['sh_' + s] = a.sh; groups['el_' + s] = a.el; groups['hand_' + s] = a.hand; });
      u.legs.forEach((l, i) => { const s = i ? 'R' : 'L'; groups['th_' + s] = l.th; groups['kn_' + s] = l.kn; groups['ft_' + s] = l.ft; });
      const saved = [];
      root.traverse((o) => { saved.push([o, o.position.clone(), o.rotation.clone()]); });
      const pos0 = root.position.clone(), rot0 = root.rotation.clone();
      root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);
      Object.values(groups).forEach((g) => g.rotation.set(0, 0, 0));
      u.hips.position.y = u.hipY;
      root.add(model);
      root.updateMatrixWorld(true);
      const map = [], used = new Set(), wpos = new THREE.Vector3();
      // Match bones to rig groups: exact names first (the built-in models), else by common rig naming,
      // picking the left or right group by which side of the body the bone actually sits on.
      const groupFor = (o) => {
        if (groups[o.name]) return o.name;
        const a = G.boneAlias ? G.boneAlias(o.name) : null;
        if (!a) return null;
        if (['hips', 'spine', 'chest', 'neck', 'head'].includes(a.part)) return a.part;
        const x = o.getWorldPosition(wpos).x, l = groups[a.part + '_L'], r = groups[a.part + '_R'];
        if (!l || !r) return null;
        const lx = l.getWorldPosition(new THREE.Vector3()).x;
        return Math.sign(x) === Math.sign(lx) ? a.part + '_L' : a.part + '_R';
      };
      model.traverse((o) => {
        const gn = o.isBone ? groupFor(o) : null;
        if (gn && !used.has(gn)) { used.add(gn); map.push({ bone: o, group: groups[gn], restInv: new THREE.Matrix4().copy(groups[gn].matrixWorld).invert(), boneRest: o.matrixWorld.clone() }); }
        if (o.isMesh && spec.keepMaterials) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; return; }
        if (o.isMesh) {
          o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
          const nm = (o.material.name || '').split('.')[0];
          const src = { skin: u.skinM, top: u.topM, legs: u.legM, socks: u.sockM }[nm] || u.skinM;
          const m = src.clone(); m.skinning = true; G.MATS.push(m); o.material = m;
          // Cylindrical UVs so knit and jersey textures wrap the body.
          const p = o.geometry.attributes.position, uv = new Float32Array(p.count * 2);
          for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const cx = Math.abs(x) > 0.15 && y > 0.75 && y < 1.5 ? Math.sign(x) * 0.18 : Math.abs(x) > 0.03 && y < 0.95 ? Math.sign(x) * 0.087 : 0; uv[i * 2] = (Math.atan2(z, x - cx) / (2 * Math.PI) + 0.5) * 2; uv[i * 2 + 1] = y * 3; }
          o.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        }
      });
      // Bones parents before children.
      const depth = (b) => { let d = 0; for (let p = b.parent; p; p = p.parent) d++; return d; };
      map.sort((a, b) => depth(a.bone) - depth(b.bone));
      saved.forEach(([o, p, r]) => { o.position.copy(p); o.rotation.copy(r); });
      root.position.copy(pos0); root.rotation.copy(rot0);
      // Hide procedural body parts.
      const hide = new Set(u.bodyMats);
      root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && (spec.hideProcedural === 'all' ? !model.getObjectById(o.id) : hide.has(o.material) && !u.lids.includes(o))) o.visible = false; });
      u.retarget = { map, model };
      resolve(true);
    }, (err) => { console.error('model', name, err); resolve(false); });
  });
};
const _m = new THREE.Matrix4(), _pi = new THREE.Matrix4();
G.retarget = (root) => {
  const R = root.userData.retarget;
  if (!R) return;
  root.updateMatrixWorld(true);
  for (const e of R.map) {
    _m.multiplyMatrices(e.group.matrixWorld, e.restInv).multiply(e.boneRest);
    _pi.copy(e.bone.parent.matrixWorld).invert();
    _m.premultiply(_pi);
    _m.decompose(e.bone.position, e.bone.quaternion, e.bone.scale);
    e.bone.updateMatrixWorld(true);
  }
};

/* ---------- animation ---------- */
/* Poses blended on top of the base idle/walk for the arms:
 * [shoulder x (forward −), shoulder z (inward +), elbow x (bend −), shoulder twist (about the upper arm)]. */
const ARM_POSES = (G.ARM_POSES = {
  cold: [-0.5, 0.3, -1.65, -0.85],   // arms wrapped around yourself
  warm: [-1.0, 0.18, -0.45, -0.25],  // hands held out to the fire
  pockets: [-0.18, 0.22, -1.05, -0.55], // hands tucked into the hoodie pocket
});
G.animate = (c, dt, t) => {
  const u = c.m.userData, k = u.k, { lerp: L, clamp, damp } = G;
  c.m.position.set(c.x, c.y, c.z);
  // Lean into turns: roll about the character's own forward axis, scaled by speed.
  const prevYaw = c._prevYaw == null ? c.yaw : c._prevYaw;
  let dy = c.yaw - prevYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  c._prevYaw = c.yaw;
  const sp = c.lie ? 0 : clamp(c.speed / 1.6, 0, 2);
  c.turnLean = damp(c.turnLean || 0, clamp((dy / Math.max(dt, 1e-3)) * sp * 0.05, -0.1, 0.1), 6, dt);
  // Lying down (in bed): the body tips back onto the mattress, head toward −z; lieRoll turns it onto one side.
  if (c.lie) c.m.rotation.set(-Math.PI / 2 + (c.lieTilt == null ? 0.09 : c.lieTilt), c.lieRoll || 0, 0);   // tilt: head up on the pillow
  else c.m.rotation.set(0, c.yaw, -c.turnLean);
  const prevPh = c.phase;
  c.phase += dt * (4.0 + sp * 3.0) * Math.min(1, sp * 2);
  const ph = c.phase, w = Math.min(1, sp);
  const sit = c.sit || 0, idle = (1 - w) * (1 - sit);
  // Foot plants (heel strike when a leg is fully forward) drive footstep sounds and footprints.
  const plant = (p) => Math.floor((p - 1.5 * Math.PI) / Math.PI);
  if (w > 0.25 && sit < 0.1 && plant(ph) !== plant(prevPh)) {
    const leg = ((plant(ph) % 2) + 2) % 2, lx = (leg ? 1 : -1) * 0.09 * k, fz = 0.22 * w;
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    c.stepEvent = { leg, x: c.x + lx * cy + fz * sy, z: c.z - lx * sy + fz * cy, yaw: c.yaw };
  }
  // Idle weight shift: hips drift over one foot then the other every few seconds.
  const shift = Math.sin(t * 0.45 + (c.seedT || 0)) * idle;
  u.legs.forEach((Lg, i) => {
    const p = ph + (i ? Math.PI : 0), s = i ? 1 : -1;
    const bend = Math.max(0, s * shift) * 0.09;   // the unloaded leg softens at the knee
    Lg.th.rotation.set(L(Math.sin(p) * 0.55 * w - bend * 0.5, -1.5, sit), 0, L(-s * 0.02 * idle, 0, sit));
    Lg.kn.rotation.x = L(Math.max(0, -Math.sin(p + 0.6)) * 1.0 * w + 0.03 + bend, 1.55, sit);
    Lg.ft.rotation.x = L(Math.sin(p) * 0.2 * w - bend * 0.5, -0.05, sit);
  });
  u.hips.position.y = L(u.hipY, (c.seatY || 0.6) - c.y + 0.03, sit) - Math.abs(Math.sin(ph)) * 0.03 * w - Math.abs(shift) * 0.006;
  u.hips.position.x = shift * 0.018 * k;
  u.hips.rotation.set(0, Math.sin(ph) * 0.1 * w, -shift * 0.035);
  u.spine.rotation.y = -Math.sin(ph) * 0.15 * w;
  u.spine.rotation.z = shift * 0.045;
  u.spine.rotation.x = 0.04 * w * (sp > 1.2 ? 2.5 : 1) - sit * 0.08 + (c.lean || 0);
  // Breathing: a slow chest rise, quicker after running.
  c.breathRate = damp(c.breathRate || 1.8, sp > 1.2 ? 3.4 : 1.8, 0.6, dt);   // ~3.5 s per breath at rest
  c.breath = (c.breath || 0) + dt * c.breathRate;
  const br = Math.sin(c.breath) * 0.012;
  u.chest.scale.set(1 + br, 1 + br * 0.4, 1 + br);
  u.chest.rotation.x = -br * 1.2;
  // Arm poses fade in and out instead of popping.
  const pw = c.poseW || (c.poseW = {});
  const want = c.forcePose || c.pose;
  c.holdW = damp(c.holdW || 0, c.holdOn ? 1 : 0, 8, dt);
  for (const name in ARM_POSES) pw[name] = damp(pw[name] || 0, want === name ? 1 : 0, 4, dt);
  u.arms.forEach((A, i) => {
    const s = i ? 1 : -1, p = ph + (i ? 0 : Math.PI);
    const swing = Math.sin(p);
    // Relaxed hang: slight forward set and soft elbows; the forearm bends more on the forward swing.
    let sx = swing * 0.45 * w - 0.06 * idle + Math.sin(c.breath) * 0.015 * idle;
    let sz = s * (0.08 + 0.01 * Math.sin(c.breath)) + s * shift * (i ? -0.02 : 0.02);
    let ex = -0.22 * idle - (0.25 + Math.max(0, -swing) * 0.35) * w, sy = 0;
    if (sit > 0.5) { sx = -0.3; ex = -0.75; sz = s * 0.1; }
    for (const name in ARM_POSES) {
      const wgt = pw[name] * (1 - sit) * (name === 'warm' ? idle : 1);
      if (wgt < 0.001) continue;
      const P = ARM_POSES[name];
      // On this rig +s rolls the arm in toward the body (−s spreads it, as the hug does).
      sx = L(sx, P[0] + (name === 'cold' ? Math.sin(t * 31 + i) * 0.012 : 0), wgt); sz = L(sz, s * P[1], wgt); ex = L(ex, P[2], wgt); sy = L(sy, s * P[3], wgt);
    }
    if (c.pose === 'chin') { if (i === (c.chinSide || 0)) { sx = -1.6; sz = s * -0.35; ex = -2.3; } }
    if (c.hug > 0) {
      // [forward, spread, elbow, twist]; the taller one wraps lower so their arms go around, not over.
      const hp = c.hugPose || [-1.3, 0.6, -1.4, 0];
      sx = L(sx, hp[0], c.hug); sz = L(sz, -s * hp[1], c.hug); ex = L(ex, hp[2], c.hug); sy = L(sy, s * hp[3], c.hug);
    }
    if (i === c.holdArm && (c.holdW || 0) > 0.001) { const hw = c.holdW; sx = L(sx, -0.14 + (c.holdReach || 0), hw); sz = L(sz, -s * 0.14, hw); ex = L(ex, -0.18, hw); sy = L(sy, s * 0.2, hw); }
    A.sh.rotation.set(sx, sy, sz); A.el.rotation.set(ex, 0, 0);
  });
  // Blinks on a natural, irregular rhythm (sometimes a double blink).
  c.blinkT = (c.blinkT == null ? Math.random() * 3 : c.blinkT) - dt;
  if (c.blinkT < -0.13) c.blinkT = Math.random() < 0.15 ? 0.18 : 2 + Math.random() * 4.5;
  const shut = c.lidsClosed || c.blinkT < 0;
  if (u.lids) u.lids.forEach((ld) => { ld.position.y = (shut ? 0.0085 : 0.0135) * k; ld.scale.y = (shut ? 0.0125 : 0.0072) * k; });
  // With nothing to look at, glance around now and then.
  let tgt = c.lie ? null : c.lookAt;
  if (c.lie) { c.look = damp(c.look || 0, c.lieLook || 0, 3, dt); c.lookUp = damp(c.lookUp || 0, 0, 3, dt); }
  else if (!tgt && idle > 0.5 && !c.lockHead) {
    c.glanceT = (c.glanceT || 0) - dt;
    if (c.glanceT <= 0) { c.glanceT = 2.5 + Math.random() * 4; c.glance = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.6; c.glanceUp = (Math.random() - 0.4) * 0.5; }
    if (c.glance) { const a = c.yaw + c.glance; tgt = { x: c.x + Math.sin(a) * 3, z: c.z + Math.cos(a) * 3, headY: c.y + u.H * 0.93 + (c.glanceUp || 0) * 3 }; }
  }
  if (tgt) {
    const dx = tgt.x - c.x, dz = tgt.z - c.z;
    let a = Math.atan2(dx, dz) - c.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
    c.look = damp(c.look || 0, clamp(a, -1.1, 1.1), 4, dt);
    const dy = (tgt.headY || 1.5) - (c.y + u.H * 0.93);
    c.lookUp = damp(c.lookUp || 0, clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.4, 0.4), 4, dt);
  } else if (!c.lie) { c.look = damp(c.look || 0, 0, 3, dt); c.lookUp = damp(c.lookUp || 0, 0, 3, dt); }
  u.neck.rotation.set(c.lookUp * 0.4, c.look * 0.45, c.tilt || 0);
  u.head.rotation.set(c.lookUp * 0.6 + Math.sin(t * 0.7 + c.z) * 0.02 + (c.headDown || 0), c.look * 0.55, (c.tilt || 0) * 0.6);
  G.retarget(c.m);
};
})();
