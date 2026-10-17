'use strict';
/* =========================================================================
 * Act IV · The Last Birthday, and the endings.
 * You wake in a house that is almost exactly right. The imitation has made
 * breakfast. Whatever she left behind in Elsewhere is in the kitchen. Her
 * whistle comes from the summer circle, out past the meadow, and the real
 * one is sitting there in the green, where someone small once sat. The way
 * home is a door standing on its own in the snow, and it only opens for two.
 * Five endings, never labelled good or bad: You Found Me, Uncertain Morning,
 * I Know It's You, The Perfect Partner, Stay Here.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S;
const { P, Y, N, choose, wait, until, fixed, V, CH, checkpoint, inter, rewire, findInter, addBond, addScrap, quiet, houseFor, setBreakfast, cyc } = A;
const K = (o) => ({ shot: 'keep', ...o });
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const here = () => S.chapter === 'lastbirthday';
const W = G.world, fy = (x, z) => G.floorAt(x, z);
const CIRCLE = { x: -3.6, z: 45.0 };   // where the real one waits (out on the frozen lake instead, if it kept her)
const kept = () => !!S.flags.keptHer;
const GATE = { x: 6.5, z: 9.6 };          // the bottom of the porch path: it asks you not to go
const EXIT = { x: 1.6, z: 27.5 };         // the door in the snow, in the meadow, on the way home
const trust = (n) => { S.vars.trust = (S.vars.trust || 0) + n; };
const accepted = () => (S.vars.taken || 0) * 0.35 + (S.vars.corruption || 0) + (S.flags.wentBack ? 0.5 : 0) + (S.flags.ateBreakfast ? 0.5 : 0);
const E = (t, o) => N('“' + t + '”', o);   // the Entity speaks without a body, mostly
const fade = async (on, sec = 1.6, col = '#000') => { const f = G.$('fade'); f.style.background = col; f.style.transition = 'opacity ' + sec + 's'; if (on) f.classList.add('on'); else f.classList.remove('on'); await wait(sec + 0.1); if (!on) { f.style.transition = ''; f.style.background = ''; } };

/* ---------- things built once ---------- */
// Her sign, in the kitchen, wherever she left it.
const SIGN = (() => {
  const g = new THREE.Group(); g.visible = false; W.add(g);
  const cone = G.shared({ color: '#6a4a2e', roughness: 0.95 });
  const cones = new THREE.Group(); g.add(cones);
  for (let i = 0; i < 7; i++) { const s = 1 - i * 0.08, m = new THREE.Mesh(new THREE.ConeGeometry(0.03 * s, 0.09 * s, 8), cone); m.rotation.z = Math.PI / 2; m.position.set(12.55 + i * 0.13, 1.0, -1.98); cones.add(m); }
  const plate = new THREE.Group(); g.add(plate);
  G.cyl(0.13, 0.11, 0.015, G.shared({ color: '#f2efe8', roughness: 0.4 }), 13.0, 0.79, 2.95, { parent: plate, seg: 20 });
  const pc = G.cyl(0.085, 0.085, 0.022, G.shared({ color: '#d7a45c', roughness: 0.8 }), 13.0, 0.81, 2.95, { parent: plate, seg: 20 });
  pc.scale.x = 0.62;
  const note = new THREE.Group(); g.add(note);
  const pg = G.box(0.21, 0.004, 0.28, G.shared({ color: '#efe6d2', roughness: 0.9 }), 13.0, 0.79, 2.95, { parent: note }); pg.rotation.y = -0.3;
  return { g, cones, plate, note, pos: { pinecones: [13.0, 1.0, -1.6], pancake: [13.0, 0.85, 2.6], note: [13.0, 0.85, 2.6] } };
})();
// A door standing on its own in the snow. Warm light round the edges.
const EXD = (() => {
  const g = new THREE.Group(); g.visible = false; W.add(g);
  const y = fy(EXIT.x, EXIT.z); g.position.set(EXIT.x, y, EXIT.z); g.rotation.y = 0;
  const wood = G.MAT.darkWood;
  G.box(0.08, 2.1, 0.1, wood, -0.5, 1.05, 0, { parent: g }); G.box(0.08, 2.1, 0.1, wood, 0.5, 1.05, 0, { parent: g }); G.box(1.08, 0.08, 0.1, wood, 0, 2.1, 0, { parent: g });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 2.04), new THREE.MeshBasicMaterial({ color: '#ffd7a0', transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
  glow.position.set(0, 1.03, 0.01); g.add(glow);
  const hinge = new THREE.Group(); hinge.position.set(-0.46, 0, 0.02); g.add(hinge);
  const leaf = G.box(0.9, 2.0, 0.05, G.shared({ color: '#6b4a34', roughness: 0.8 }), 0.45, 1.02, 0, { parent: hinge });
  G.box(0.06, 0.06, 0.06, G.shared({ color: '#c9a45c', roughness: 0.3, metalness: 0.8 }), 0.82, 1.0, 0.05, { parent: hinge });
  const light = { intensity: 0 };   // no real light: a new light would recompile every material
  G.box(1.4, 0.08, 0.5, G.MAT.snow, 0, 0.0, 0, { parent: g, r: 0.03 });
  G.addCollider({ x0: EXIT.x - 0.6, z0: EXIT.z - 0.12, x1: EXIT.x + 0.6, z1: EXIT.z + 0.12 });
  return { g, leaf, hinge, glow, light, leak: leaf };
})();
// The Entity, when it finally stands in front of you: tall, pale, not quite a person, mostly snow.
const ENT = (() => {
  const g = new THREE.Group(); g.visible = false; W.add(g);
  const mat = new THREE.MeshBasicMaterial({ color: '#dfe6f2', transparent: true, opacity: 0, depthWrite: false });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.9, 16, 1, true), mat); body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat); head.position.y = 2.06; head.scale.y = 1.2; g.add(head);
  return { g, mat };
})();

const MUG3 = (() => { const m = G.cyl(0.04, 0.035, 0.09, G.shared({ color: '#e8e2d6', roughness: 0.4 }), 13.42, 0.97, -1.98, { seg: 14 }); m.rotation.x = Math.PI; m.visible = false; return m; })();
(G.onJump = G.onJump || []).push(() => { SIGN.g.visible = false; TRAIL.g.visible = false; EXD.g.visible = false; ENT.g.visible = false; MUG3.visible = false; G.WALK && G.WALK.showCircle(false); });
/* ---------- what it takes: a memory at a time. A scrapbook page goes blank; the photograph loses one of them. ---------- */
G.take = () => {
  S.vars.taken = (S.vars.taken || 0) + 1;
  const pages = S.scrap.filter((p) => !p.taken && !/^end_/.test(p.art));
  const p = pages.length ? pages[Math.floor(Math.random() * pages.length)] : null;
  if (p) p.taken = true;
  if (S.vars.taken === 1 && G.EVE && G.EVE.photo) {
    const m = G.EVE.photo.material.map; if (m && m.image && m.image.getContext) { const x = m.image.getContext('2d'), c = x.getImageData(150, 110, 1, 1).data, g = x.getImageData(150, 200, 1, 1).data; x.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; x.fillRect(132, 112, 27, 56); x.fillStyle = `rgb(${g[0]},${g[1]},${g[2]})`; x.fillRect(132, 168, 27, 18); m.needsUpdate = true; }
  }
  G.observe('take', p ? 'I took “' + (p.caption || p.art).slice(0, 40) + '”. It was mine anyway.' : 'I took something small.');
  return p;
};

/* ---------- Replaced: it takes your place. You watch from outside. ---------- */
CH.ending_replaced = async () => {
  checkpoint('ending_replaced'); home(false); STATE.watchDoor = false;
  for (const L of G.LAMPS) L.on = true;
  G.setTime({ day: 0, tod: 1, snow: 0.6 }, true); G.WEATHER.hold = 'snow';
  setBreakfast({ plates: true, mugs: true });
  const ch = G.KITCHEN.chairs;
  G.sitAt(PLAYER, ch.B.x, ch.B.z, ch.B.yaw, ch.B.seatY || 0.49); G.sitAt(PARTNER, ch.A.x, ch.A.z, ch.A.yaw, ch.A.seatY || 0.49); PARTNER.mode = 'seated';
  // From outside, through the window by the table, in the snow.
  const shot = fixed(V(13.2, 1.55, 6.3), V(13.0, 1.0, 3.2), 34, 0.012);
  G.setShot(shot);
  await wait(0.3); fade(false, 2.2);
  await N('(Breakfast. Two plates. Two mugs, the handles turned the same way.)', { shot });
  await P('You’re quiet this morning.', { shot });
  await N('(“I’m happy,” it says, in your voice.)', { shot });
  await P('You’re never happy before coffee.', { shot });
  await N('(“I am now.”)', { shot });
  await N('(She laughs. It laughs at exactly the same moment.)', { shot });
  await N('(Outside, in the snow, you watch through the glass. Your hands are very cold. Nobody looks up.)', { shot });
  const c = await choose(['Knock on the glass', 'Whistle', 'Say nothing']);
  if (c === 0) { await N('(You knock. The sound doesn’t carry. It glances at the window anyway, and then back at her, and smiles.)', { shot }); }
  else if (c === 1) { G.Audio.whistle(1.0, 0.5); await wait(1.6); await N('(Three notes. Inside, she stops, her cup halfway to her mouth.)', { shot }); await N('(It puts its hand over hers. After a moment she drinks her tea.)', { shot }); }
  else await N('(You stay where you are until the window fogs over.)', { shot });
  await N('(It will remember everything for both of you. It said it would.)', { shot });
  showEnd('replaced', 'Replaced');
};
/* ---------- the endcard learns the ending's name ---------- */
G.endingName = null;
const showEnd = (id, title) => {
  try { const k = 'snowed.endings', a = JSON.parse(localStorage.getItem(k) || '[]'); if (!a.includes(id)) a.push(id); localStorage.setItem(k, JSON.stringify(a)); } catch (e) { /* */ }
  G.observe('ending_' + id, { foundme: 'It found the real one. I will remember how.', uncertain: 'It went home. It is not sure who with. Neither am I.', iknow: 'It does not know. It chose anyway. I did not plan for that.', perfect: 'It stayed with me. Every day is lovely.', replaced: 'I am him now. She hasn’t noticed. She will not.', stay: 'It stayed. I will remember it for both of us.' }[id]);
  G.$('endEyebrow').textContent = title;
  STATE.nightDone = true; STATE.busy = false; STATE.ending = id;
  addScrap('end_' + id, title + '.');
  G.showEndcard();
};

/* =====================================================================
 * Act IV
 * ===================================================================== */
CH.lastbirthday = async () => {
  checkpoint('lastbirthday');
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.style.background = '#fff'; f.classList.add('on'); await wait(0.6); }
  quiet(); STATE.busy = true;
  if (G.NIGHT && G.NIGHT.swapped) G.swapBodies();
  if (G.NIGHT) G.NIGHT.door.visible = false;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.setTime({ day: 0, tod: 1, snow: 0.55 }, true); G.WEATHER.hold = 'snow';
  G.post.grade.uniforms.uMem.value = 0.32; STATE.fog = null;
  houseFor('evening'); G.FIRE.level = 0.8;
  for (const L of G.LAMPS) { if (L.power0 != null) L.power = L.power0; L.on = true; }
  setBreakfast({ plates: true, mugs: true });     // perfectly round, nobody's bitten anything
  if (kept()) { CIRCLE.x = 7.5; CIRCLE.z = 52.0; } else { CIRCLE.x = -3.6; CIRCLE.z = 45.0; }
  G.WALK && G.WALK.showCircle(!kept());
  TRAIL.g.visible = true; SIGN.g.visible = true; for (const k of ['cones', 'plate', 'note']) SIGN[k].visible = false;
  SIGN[{ pinecones: 'cones', pancake: 'plate', note: 'note' }[S.flags.sign || 'pinecones']].visible = true;
  EXD.g.visible = true; EXD.hinge.rotation.y = 0; EXD.glow.material.opacity = 0.0; EXD.light.intensity = 0; ENT.g.visible = false;
  Object.assign(S.flags, { reunited: false, rescued: false, fakeLeftBehind: false, wentBack: false, ateBreakfast: false, foundSign: false, offerDone: false, ending: null, gateN: 0 });
  STATE.bounds = null;
  const withFake = !S.flags.fakeWithdrawn;
  G.lieDown(PLAYER, G.BED.L, -0.14, 0.15, 0.35);
  if (S.flags.sleptBeside && withFake) { G.lieDown(PARTNER, G.BED.R, -0.40, 0, 0); PARTNER.mode = 'lying'; PARTNER.lidsClosed = false; }
  else { G.standAt(PARTNER, 3.0, 1.5, Math.PI); PARTNER.mode = 'still'; PARTNER.hidden = !withFake; PARTNER.m.visible = withFake; }
  STATE.sceneShot = true; G.setShot(fixed(V(4.4, 1.9, 2.6), V(2.4, 0.6, -0.6), 44, 0.01));
  await wait(0.3);
  fade(false, 2.4, '#fff');
  await G.UI.act('IV', 'The Last Birthday', { white: false });
  await N('(You wake up warm. The lamps are on. It smells of pancakes.)', K());
  if (withFake) {
    await P('There you are. Weird dream, huh?', K());
    const c = await choose(['“What dream?”', '“How long have you been up?”', 'Pull her back under the blanket']);
    if (c === 0) await P('You were talking in your sleep. Something about a door.', K());
    else if (c === 1) await P('Ages. I couldn’t wait. It’s your birthday.', K());
    else await P('Ha— no, no, the pancakes will go cold. Up. It’s your birthday.', K());
    await P('Happy birthday, Partner.', K());
  } else await N('(The house is quiet. Breakfast is laid for two.)', K());
  await G.cutTo(() => { G.standAt(PLAYER, G.BED.L - 0.6, 0.2, Math.PI / 2); if (PARTNER.lie) G.standAt(PARTNER, G.BED.R + 0.6, 0.2, -Math.PI / 2); G.releaseCamera(); G.CAM.cut = true; }, 0.4);
  if (withFake) { PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.mode = 'follow'; PARTNER.lidsClosed = false; }
  STATE.sceneShot = false; STATE.busy = false; S.flags.noTogether = true; S.flags.noBarks = true;
  loops(S.run);
};

function loops(run) {
  const live = () => S.run === run && here() && !S.flags.ending;
  // Her whistle, from the circle. Louder the closer you get.
  (async () => {
    while (live() && !S.flags.reunited) {
      await wait(14 + Math.random() * 6);
      if (!live() || S.flags.reunited) return;
      const d = Math.hypot(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z);
      G.Audio.whistle(1.12, d > 25 ? 0.9 : 0.4); A4.wh = (A4.wh || 0) + 1;
      if (A4.wh === 1 && !PARTNER.hidden && !S.flags.fakeLeftBehind && dist() < 6) { await wait(1.4); if (live() && !G.busy()) G.bark('The kettle.', 2); }
      if (A4.wh === 2 && !PARTNER.hidden && !S.flags.fakeLeftBehind && dist() < 6) { await wait(1.4); if (live() && !G.busy()) G.bark('Wind in the chimney. Come and eat.', 2.6); }
    }
  })();
  // A nudge if you've been standing about.
  (async () => {
    await wait(120);
    if (live() && !S.flags.reunited && !G.busy()) G.hint('(Three notes, somewhere outside. Slightly flat on the last one.)', 6);
  })();
  G.TICKERS.add(function tick(dt) {
    if (!live()) { G.TICKERS.delete(tick); return; }
    if (G.busy()) return;
    // The imitation asks you not to go: at the bottom of the porch path, each time you try.
    const fake = !S.flags.reunited && !PARTNER.hidden && !S.flags.fakeLeftBehind;
    if (fake && Math.hypot(PLAYER.x - GATE.x, PLAYER.z - GATE.z) < 1.6 && !S.flags.gateArmed0) { S.flags.gateArmed0 = true; A.run(gate); }
    if (S.flags.gateArmed0 && Math.hypot(PLAYER.x - GATE.x, PLAYER.z - GATE.z) > 4) S.flags.gateArmed0 = false;
    // The one you left on the path fades out of sight.
    if (S.flags.fakeLeftBehind && !PARTNER.hidden && !S.flags.reunited && dist() > 12) { PARTNER.hidden = true; PARTNER.m.visible = false; S.flags.fakeWithdrawn = true; }
    // Out in the snow you're dressed for it.
    if (PLAYER.z > G.CAB.z1 + 0.5 && !PLAYER.dressed) G.setDressed(PLAYER, true);
    // The circle.
    if (!S.flags.reunited && Math.hypot(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z) < 5.2) A.run(reunion);
    // On the way home: let go of her hand, and the snow closes in.
    if (S.flags.reunited && !S.flags.offerDone && !PARTNER.hold && dist() > 2.2) { NIGHTT.t = (NIGHTT.t || 0) + dt; if (NIGHTT.t > 3) { NIGHTT.t = -10; G.bark('Hand. Now. Just— hold my hand.', 3); } }
  });
}
const NIGHTT = {}, A4 = {};

async function gate() {
  STATE.busy = true; PARTNER.mode = 'still';
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.6, PLAYER.z], 6);
  const ob = (S.vars.corruption || 0) + (S.vars.taken || 0) * 0.5;
  if (S.flags.gateN) await P(ob >= 2 ? 'Again. You keep doing this.' : '…Again?');
  else { await P('…You’re still looking for them.'); await P('I’m right here.'); }
  S.flags.gateN = (S.flags.gateN || 0) + 1;
  let c = await choose(['Keep walking', 'Go back with it']);
  if (c === 0 && ob >= 2) {
    // It doesn't let go the first time.
    await N('(Its hand is on your arm. You didn’t see it move.)');
    await P(kept() ? 'She isn’t out there. I made sure. There’s only me now.' : 'No. You don’t get to leave me in the snow. Not after everything I remember for you.');
    c = await choose(['Pull your arm away', 'Go back with it']);
  }
  if (c === 0) {
    await P('I’ll wait. I’m good at waiting. I learned it from you.');
    S.flags.fakeLeftBehind = true; PARTNER.mode = 'still';
    G.observe('gate_left', 'It left me at the bottom of the path. I waited.');
  } else {
    if (!S.flags.wentBack) S.flags.wentBack = true;
    S.flags.wentBackN = (S.flags.wentBackN || 0) + 1;
    if (S.flags.wentBackN >= 2 && ob >= 1.5) { await P('Good. Now stay.'); STATE.busy = false; await fade(true, 1.8); return A.go('ending_replaced'); }
    await P('Good. Home.');
    await G.cutTo(() => { G.standAt(PLAYER, 6.5, 5.2, Math.PI); G.standAt(PARTNER, 7.1, 5.4, Math.PI); G.CAM.cut = true; }, 0.4);
    PARTNER.mode = 'follow';
    G.observe('gate_back', 'It came back inside with me. It is easier inside.');
  }
  STATE.busy = false;
}

/* ---------- her things, left along the way: nobody tells you to follow them ---------- */
const TRAIL = (() => {
  const g = new THREE.Group(); g.visible = false; W.add(g);
  const wool = G.shared({ color: '#b5524a', roughness: 0.95 }), cone = G.shared({ color: '#6a4a2e', roughness: 0.95 }), stone = G.shared({ color: '#4a4a4e', roughness: 0.45 });
  const mit = { x: 6.95, z: 7.55 };   // the bottom porch step
  const m1 = G.box(0.1, 0.03, 0.16, wool, mit.x, fy(mit.x, mit.z) + 0.03, mit.z, { parent: g, r: 0.015 }); m1.rotation.y = 0.5;
  G.box(0.04, 0.03, 0.06, wool, mit.x + 0.06, fy(mit.x, mit.z) + 0.03, mit.z - 0.07, { parent: g, r: 0.01 });
  const st = { x: 3.6, z: 37.2 };     // the stump in the meadow
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), cone); c.position.set(st.x, fy(st.x, st.z) + 0.58, st.z); g.add(c);
  const sh = { x: 1.2, z: 41.6 };     // three flat stones, pointing west
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6), stone); m.scale.set(1, 0.4, 0.8); m.position.set(sh.x - i * 0.32, fy(sh.x - i * 0.32, sh.z) + 0.02, sh.z); g.add(m); }
  return { g, mit, st, sh };
})();
const seenTrail = (k) => { S.flags['trail_' + k] = true; S.flags.trailN = (S.flags.trailN || 0) + 1; trust(0.3); };
const fakeNear = () => !PARTNER.hidden && !S.flags.reunited && !S.flags.fakeLeftBehind && dist() < 4;
inter('aMitten', [TRAIL.mit.x, 0.5, TRAIL.mit.z], 0.9, 'Mitten', async () => {
  seenTrail('mitten');
  await N('(A red mitten on the bottom step, half under the snow. The left one.)');
  if (fakeNear()) await P('Not mine. Mine are in my pockets. Look.');
  else await N('(You put it in your pocket.)');
}, () => here() && !S.flags.trail_mitten);
inter('aStump', [TRAIL.st.x, 0.6, TRAIL.st.z + 0.5], 1.0, 'Stump', async () => {
  seenTrail('stump');
  await N('(On the stump, where you held the pinecone contest, a single pinecone stood on its end.)');
  await N('(One. Like a score nobody else would understand.)');
  if (fakeNear()) await P('Is that from the contest? You won that. Eleven to nine.');
}, () => here() && !S.flags.trail_stump);
inter('aStones', [TRAIL.sh.x - 0.3, 0.3, TRAIL.sh.z], 1.0, 'Stones', async () => {
  seenTrail('stones');
  await N('(Three flat stones in a row in the snow, from her secret summer pile. Biggest to smallest. Pointing west.)');
}, () => here() && !S.flags.trail_stones);

/* ---------- its present ---------- */
inter('aGift', [8.2, 0.6, 1.1], 1.0, 'A present', async () => {
  S.flags.giftOpen = true;
  await N('(A present on the sofa, wrapped very neatly. The corners are perfect.)');
  if (!PARTNER.hidden && !S.flags.fakeLeftBehind) await P('Open it, open it.');
  await N('(A snow globe. Inside it, a little cabin with a lamp in the window, and two tiny people on the porch step.)');
  const c = await choose(['Shake it', 'Put it down gently']);
  if (c === 0) {
    await N('(You shake it. The snow lifts and turns, and then stops in the water, and stays where it is.)');
    if (!PARTNER.hidden && !S.flags.fakeLeftBehind) { await P('Isn’t it lovely? Nothing ever settles. It stays just like that.'); G.observe('gift', 'It shook the globe. I made the snow stay up for it.'); }
  } else if (!PARTNER.hidden && !S.flags.fakeLeftBehind) await P('You can shake it, you know. It won’t break. Nothing in it breaks.');
  addScrap('globe', 'A snow globe where the snow doesn’t come down.');
}, () => here() && !S.flags.giftOpen && !S.flags.reunited);

/* ---------- talking to it, on your birthday ---------- */
inter('aHer', [0, 1.2, 0], 1.1, 'Partner', async () => {
  const left = [['night', '“About last night…”'], ['plan', '“What shall we do today?”'], ['tease', 'Tease her'], ['who', '“What did I say? The first time we met?”']].filter(([k]) => !(A4.talk || (A4.talk = new Set())).has(k));
  if (!left.length) { await P(cyc('aHerIdle', ['Breakfast’s getting cold, birthday boy.', 'I’m right here, Partner.', 'Everything’s ready whenever you are.'])); return; }
  const c = await choose(left.map((o) => o[1]).concat(['Never mind']));
  if (c >= left.length) return;
  const k = left[c][0]; A4.talk.add(k);
  if (k === 'night') { await P('What about it? We went to bed. You slept. I watched the snow for a bit.'); await Y('You got up for water.'); await P('Did I? Then I must have been thirsty.'); }
  else if (k === 'plan') { await P('Anything you like. The hill again. The lake. Pancakes again. We could do yesterday again, exactly the same.'); const d = await choose(['“Exactly the same sounds nice.”', '“Something new.”']); if (d === 0) { S.vars.corruption = (S.vars.corruption || 0) + 0.5; await P('Doesn’t it? I thought so too.'); } else await P('New. Yes. Of course. Something new.'); }
  else if (k === 'tease') { await P('Go on, then. I’m ready.'); await Y('Your hat’s on inside out.'); await P('Oh! Thank you.'); await N('(She turns it the right way round. It was already the right way round.)'); }
  else { await P('You said, “Nice hat.” And I said, “It’s my brother’s.” And then you laughed, and I laughed, and that was that.'); await P('I remember all of it. Every word.'); G.observe('first', 'It asked about the first time. I knew all of it. That was a mistake.'); }
}, () => here() && !PARTNER.hidden && !S.flags.reunited && !S.flags.fakeLeftBehind && !PARTNER.lie);
G.TICKERS.add(() => { const it = findInter('aHer'); if (it) { it.pos[0] = PARTNER.x; it.pos[2] = PARTNER.z; } });

/* ---------- the perfect breakfast ---------- */
inter('aBreakfast', [13.0, 0.9, 3.1], 1.1, 'Breakfast', async () => {
  const fake = !PARTNER.hidden && !S.flags.reunited;
  await N('(Pancakes, perfectly round. Two mugs, the handles turned the same way. Nobody has stolen anything.)');
  if (fake) await P('Sit down. It’s your birthday. Everything’s ready.');
  const c = await choose(['Sit down', 'Not yet']);
  if (c === 1) { if (fake) { await N('(The humming stops, very briefly, and then starts again.)'); } return; }
  S.flags.ateBreakfast = true;
  const ch = G.KITCHEN.chairs;
  await G.cutTo(() => { G.sitAt(PLAYER, ch.B.x, ch.B.z, ch.B.yaw, ch.B.seatY || 0.49); if (fake) { G.sitAt(PARTNER, ch.A.x, ch.A.z, ch.A.yaw, ch.A.seatY || 0.49); PARTNER.mode = 'seated'; } G.setShot(fixed(V(13.0, 1.4, 1.55), V(13.0, 0.98, 3.4), 42, 0.01)); STATE.sceneShot = true; }, 0.4);
  if (kept()) { await N('(Nobody comes through the door. Nobody is coming.)', K()); await fade(true, 1.8); return A.go('ending_replaced'); }
  if ((S.vars.bond || 0) >= 6 && accepted() < 2 && !S.flags.rescued) return rescue();
  await N('(It tastes exactly right. It tastes exactly the way you remember it tasting.)', K());
  S.flags.ending = 'perfect';
  await fade(true, 1.8);
  return A.go('ending_perfect');
}, () => here() && !S.flags.reunited);

// She comes in through the front door at a run.
async function rescue() {
  S.flags.rescued = true;
  G.Audio.thud && G.Audio.thud();
  if (!PARTNER.hidden) { PARTNER.hidden = true; PARTNER.m.visible = false; }
  await N('(The front door bangs open. Snow blows in across the floor.)', K());
  G.setDressed(PARTNER, true);
  PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.mode = 'script'; PARTNER.lidsClosed = false;
  G.placeChar(PARTNER, 6.5, 4.0, Math.PI);
  await G.cutTo(() => { PLAYER.sitTarget = PLAYER.sit = 0; G.standAt(PLAYER, 12.4, 2.6, -Math.PI / 2); G.standAt(PARTNER, 11.6, 2.6, Math.PI / 2); G.setShot(fixed(V(12.0, 1.6, 0.6), V(12.0, 1.2, 2.6), 46, 0.01)); }, 0.3);
  await P('Nope. No. Absolutely not.', K());
  await P('You were going to sit down to breakfast with it? On your BIRTHDAY?', K());
  await Y('…It smelled like pancakes.', K());
  await P('EVERYTHING smells like pancakes to you!', K());
  await P('…Hi.', K());
  await Y('Hi.', K());
  await N('(She’s out of breath. Her hand is freezing. She’s holding on far too hard.)', K());
  await P('Do not EVER let me catch you on a date with a breakfast again.', K());
  trust(1); addBond(0.5);
  return afterReunion();
}

/* ---------- the circle: the real one ---------- */
async function reunion() {
  if (S.flags.reunited || S.flags.reuniting) return;
  S.flags.reuniting = true; STATE.busy = true;
  if (!PARTNER.hidden) { await N('(When you look round, it isn’t behind you any more.)'); }
  S.flags.fakeWithdrawn = true;
  G.setDressed(PARTNER, true);
  PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.lidsClosed = false;
  await G.cutTo(() => {
    G.sitAt(PARTNER, CIRCLE.x, CIRCLE.z + 0.4, Math.PI, fy(CIRCLE.x, CIRCLE.z) + 0.05); PARTNER.mode = 'seated';
    const a = Math.atan2(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z), px = CIRCLE.x + Math.sin(a) * 3.2, pz = CIRCLE.z + Math.cos(a) * 3.2;
    G.standAt(PLAYER, px, pz, a + Math.PI);
    G.setShot(fixed(V(px + Math.sin(a) * 2.2 + 1.2, fy(px, pz) + 1.7, pz + Math.cos(a) * 2.2), V(CIRCLE.x, fy(CIRCLE.x, CIRCLE.z) + 0.7, CIRCLE.z), 44, 0.01)); STATE.sceneShot = true;
  }, 0.5);
  await N(kept() ? '(Out on the frozen lake, sitting on the ice with her knees up, a long way from anywhere. Her lips are blue.)' : '(In the ring of summer in the snow, cross-legged in the grass, exactly where someone small once sat.)', K());
  if (kept()) { await P('It put me back in bed. Three times. The third time I stayed.', K()); await P('Then I woke up out here. I’ve been whistling for hours.', K()); }
  await N('(Neither of you moves first.)', K());
  const c = await choose(['“What did I say? The first time?”', '“Found you.”', 'Walk over']);
  if (c === 0) {
    await P('…I have no idea. I never did.', K());
    await N('(You laugh. You can’t help it.)', K());
    await P('What? What’s funny?', K());
    await N('(And then she gets it, and she laughs too.)', K());
    G.observe('reunion_forgot', 'She did not remember. That was how it knew her. I remembered too well.');
  } else if (c === 1) {
    await P('…Took you long enough.', K());
    await P('I whistled! Did you hear me whistle? I whistled like an idiot.', K());
  } else {
    await N('(You walk over. She stands up. She doesn’t step towards you.)', K());
    await P('Wait. Say something. Something only you would say.', K());
    const d = await choose(['“Coward.”', '“I don’t remember either.”', 'Just hold out your hand']);
    if (d === 0) await P('…Ha. Yes. That’s you.', K());
    else if (d === 1) await P('…Yes. Yes, that’s you.', K());
    else await N('(She looks at your hand for a long second. Then she takes it and squeezes, exactly the wrong amount, exactly the way she always does.)', K());
  }
  await G.cutTo(() => { PARTNER.sitTarget = PARTNER.sit = 0; const a = Math.atan2(PLAYER.x - CIRCLE.x, PLAYER.z - CIRCLE.z); G.sitAt(PARTNER, CIRCLE.x - 0.3, CIRCLE.z, Math.PI / 2 + 0.3, fy(CIRCLE.x, CIRCLE.z) + 0.05); G.sitAt(PLAYER, CIRCLE.x + 0.35, CIRCLE.z + 0.1, -Math.PI / 2 - 0.2, fy(CIRCLE.x, CIRCLE.z) + 0.05); PARTNER.mode = 'seated'; G.setShot(fixed(V(CIRCLE.x + 0.2, fy(CIRCLE.x, CIRCLE.z) + 1.3, CIRCLE.z + 2.6), V(CIRCLE.x, fy(CIRCLE.x, CIRCLE.z) + 0.6, CIRCLE.z), 40, 0.01)); }, 0.5);
  await N(kept() ? '(You sit down next to her on the ice. She is shaking. You put your coat round both of you.)' : '(You sit down next to her. The grass is warm. It smells like July.)', K());
  const n = S.flags.trailN || 0;
  if (n >= 2) { await P('You followed them. My things.', K()); await Y('You dropped a mitten.', K()); await P('I PLACED a mitten. There’s a difference. I was very cold about it.', K()); trust(0.4); }
  else if (n === 1) { await P('Did you see anything I left? I left you things. I was very clever about it.', K()); await Y('One thing.', K()); await P('One. I left a whole trail, Partner.', K()); }
  else await P('I left you things, you know. A whole trail. You walked straight past all of it, didn’t you.', K());
  if (S.flags.foundSign) { await P('And the kitchen. Did you find what I left in the kitchen?', K()); await Y('Obviously.', K()); await P('“Obviously,” he says.', K()); trust(0.3); }
  await P('What was it like? With it.', K());
  const w = await choose(['“You were perfect.”', '“You never stole anything.”', '“It agreed with me. About everything.”']);
  if (w === 0) await P('Ew. Then it definitely wasn’t me.', K());
  else if (w === 1) await P('Not a single thing? Not even the blanket? Monster.', K());
  else await P('Then you knew. You must have known. I never agree with you about anything.', K());
  await P('It came into the kitchen, you know. Wearing you. All the way in, in bare feet.', K());
  await P('You never come all the way into the kitchen. You stand at the door and complain about the floor.', K());
  await Y('The floor is cold.', K());
  await P('The floor is cold. That’s when I knew.', K());
  await N('(Out past the edge of the grass, the snow goes on falling, very slowly.)', K());
  await N(kept() ? '(In the frost on the ice between you, two sets of small footprints, stopping toe to toe.)' : '(In the grass between you, two sets of small footprints, stopping toe to toe.)', K());
  const q = await choose(['“Do you think that’s us?”', 'Say nothing', 'Put your hand in the footprint']);
  if (q === 0) { await P('I think we’ve been here before. A long time ago. I think one of us waited.', K()); await Y('Which one?', K()); await P('I don’t remember. I hope it was you. I hope you were very patient and very cold.', K()); }
  else if (q === 1) { await N('(She leans against you. Neither of you says anything for a while. It is the best part of the day.)', K()); addBond(0.4); }
  else { await N('(Your hand is much too big for it. So is hers, when she puts it next to yours.)', K()); await P('We were so small.', K()); }
  await G.cutTo(() => { PARTNER.sitTarget = PARTNER.sit = 0; G.standAt(PARTNER, CIRCLE.x, CIRCLE.z + 1.4, 0); G.standAt(PLAYER, CIRCLE.x + 0.1, CIRCLE.z + 2.0, Math.PI); PARTNER.mode = 'still'; }, 0.35);
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false;
  if (G.hug) { await G.hug('hug'); await until(() => !G.busy()); }
  STATE.busy = true;
  await P('You spent all night with that thing? On your birthday?');
  await Y('It was very polite.');
  await P('“It was very polite.” Listen to yourself.');
  await P('I’m never letting you live this down. Never. When we’re ninety.');
  if (accepted() >= 1) {
    await P('…Did it get you? Even a bit?');
    const h = await choose(['“A bit.”', '“No.”']);
    if (h === 0) { trust(1); await P('Okay. Me too. A bit. We’ll compare notes later.'); }
    else await P('Liar. …It’s okay.');
  }
  trust(1);
  return afterReunion();
}
async function afterReunion() {
  S.flags.reunited = true; S.flags.reuniting = false;
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
  await P('There’s a door. In the meadow, on its own. I saw it on the way. Come on — and don’t you dare let go.');
  PARTNER.mode = 'follow'; G.setHold(true);
  STATE.busy = false;
  walkTalk(S.run);
  addScrap('lastbday', 'A ring of summer in the snow, and her in it, whistling like an idiot.');
}
inter('aExit', [EXIT.x, 1.0, EXIT.z + 0.6], 1.3, 'The door', async () => {
  if (!S.flags.reunited) { await N('(A door, standing on its own in the snow. Warm light round the edges. It won’t open. Not for one person.)'); return; }
  if (!PARTNER.hold || dist() > 1.6) { await N('(It won’t open. Not for one person.)'); return; }
  if (S.flags.offerDone) return;
  S.flags.offerDone = true;
  return offer();
}, () => here());

// On the way back, holding hands, she talks: a few things at a time, as you walk.
async function walkTalk(run) {
  const ok = () => S.run === run && here() && !S.flags.offerDone;
  const beats = [
    [40, async () => { await P('Is it strange that I’m not cold?'); await Y('Yes.'); await P('I’m going to be furious about it later. When I’m cold again.'); }],
    [35, async () => { await P('When we get home, can we not talk about it? For one day?'); const c = await choose(['“One day.”', '“We’ll talk about it now and then never again.”', '“We’ll put it in the scrapbook.”']); if (c === 0) await P('One day. Then I’m telling everyone. With diagrams.'); else if (c === 1) await P('That’s not how talking works, but I admire it.'); else { await P('Under what? “The night something wore my face”?'); await Y('Under “Birthday”.'); await P('…Fine. Under Birthday.'); } }],
    [31, async () => { await P('It knew everything, you know. Every single thing we’ve ever done.'); await P('But it didn’t know which bits we’d got wrong. It thought we remembered everything perfectly.'); await Y('We don’t.'); await P('We absolutely don’t. It’s my favourite thing about us.'); }],
  ];
  for (const [z, fn] of beats) {
    await until(() => !ok() || (PLAYER.z < z && !G.busy()));
    if (!ok()) return;
    STATE.busy = true; await fn(); STATE.busy = false;
  }
}
// The Entity, at last, asks. It has been watching how you play, and it says so.
async function offer() {
  STATE.busy = true;
  const shot = fixed(V(EXIT.x + 2.6, fy(EXIT.x, EXIT.z) + 1.6, EXIT.z + 3.4), V(EXIT.x, fy(EXIT.x, EXIT.z) + 1.2, EXIT.z), 44, 0.01);
  STATE.sceneShot = true; G.setShot(shot);
  ENT.g.position.set(EXIT.x + 1.3, fy(EXIT.x + 1.3, EXIT.z - 0.4), EXIT.z - 0.4); ENT.g.visible = true;
  for (let t = 0; t < 1; t += 1 / 45) { ENT.mat.opacity = t * 0.55; await wait(1 / 30); }
  await wait(0.6);
  const o = S.obs || {};
  const said = [];
  if (o.corrupt_fire) said.push('You liked the fire. I kept it going all night.');
  if (o.corrupt_agree) said.push('You agreed with me. It was nice, being agreed with.');
  if (o.corrupt_sleep) said.push('You went back to sleep beside me. You trusted me with that.');
  if (o.suspect_stare) said.push('You looked at me for a long time. Nobody has looked at me like that.');
  if (o.gift) said.push('You shook the globe. I held the snow up for you.');
  if (o.sign) said.push('You found what she left. I didn’t think to copy that. I will next time.');
  if (!said.length) said.push('I watched you all night. You were kind to me, mostly.');
  await N('(It doesn’t have her face any more. It doesn’t have any face. It stands there like snow that has decided to stand.)', { shot });
  for (const t of said.slice(0, 2)) await E(t, { shot });
  await E('You could stay. I would remember all of it. Every bit you’d get wrong.', { shot });
  if ((S.vars.bond || 0) >= 5) await P('…Your call. I’m with you. Either way.', { shot });
  else await P('Please. Let’s just go home.', { shot });
  const c = await choose(['Stay', 'Go home']);
  if (c === 0) { S.flags.ending = 'stay'; await fade(true, 1.8); return A.go('ending_stay'); }
  await E('…Then I will remember it for me.', { shot });
  for (let t = 1; t > 0; t -= 1 / 40) { ENT.mat.opacity = t * 0.55; await wait(1 / 30); }
  ENT.g.visible = false;
  G.Audio.chime && G.Audio.chime();
  for (let t = 0; t <= 1; t += 1 / 40) { EXD.hinge.rotation.y = -t * 1.4; EXD.glow.material.opacity = t * 0.9; EXD.light.intensity = t * 4; await wait(1 / 30); }
  await N('(The door opens onto an ordinary hallway. Your hallway. It smells like toast.)', { shot });
  const acc = accepted();
  S.flags.ending = acc >= 2 ? 'iknow' : (acc >= 1 || (S.vars.trust || 0) < 2) ? 'uncertain' : 'foundme';
  await fade(true, 1.8, '#fff');
  return A.go('ending_' + S.flags.ending);
}

// Her sign, in the kitchen. Not needed for anything; she'll ask.
inter('aSign', [13.0, 1.0, 2.6], 0.9, () => (S.flags.sign === 'pinecones' ? 'Pinecones' : S.flags.sign === 'pancake' ? 'Half a pancake' : 'A scrapbook page'), async () => {
  S.flags.foundSign = true; G.observe('sign', 'It found what she left. I did not think to copy that.');
  if (S.flags.sign === 'pinecones') await N('(Seven pinecones in a row along the sill, biggest to smallest. You won by two. She let you. She’d say she let you.)');
  else if (S.flags.sign === 'pancake') await N('(Half a pancake on a plate, with one enormous bite out of it. You would know that bite anywhere.)');
  else await N('(In her terrible handwriting: “If it’s sure about the night we met, it isn’t me. — me”)');
}, () => here() && !S.flags.foundSign);
G.TICKERS.add(() => { const it = findInter('aSign'); if (it) { const p = SIGN.pos[S.flags.sign || 'pinecones']; it.pos[0] = p[0]; it.pos[1] = p[1]; it.pos[2] = p[2]; } });
// The front door opens in Act IV; it's the only way to her.
{ const fd = findInter('frontdoor'), raw = fd && fd.raw; if (fd) rewire('frontdoor', async () => { if (here()) { await N('(Out into the snow.)'); return; } return raw(); }); }

/* =====================================================================
 * The endings
 * ===================================================================== */
function home(lyingBoth) {
  quiet(); STATE.busy = true; STATE.sceneShot = true; MUG3.visible = false; STATE.watchDoor = false;
  if (G.NIGHT && G.NIGHT.swapped) G.swapBodies();
  G.WALK && G.WALK.showCircle(false); SIGN.g.visible = false; TRAIL.g.visible = false; EXD.g.visible = false; ENT.g.visible = false;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.WEATHER.hold = 'clear'; G.setTime({ day: 2, tod: 0, snow: 0 }, true);
  G.post.grade.uniforms.uMem.value = 0; STATE.fog = null; STATE.bounds = null;
  houseFor('morning');
  PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.lidsClosed = false; PARTNER.hold = false;
  if (lyingBoth) { G.lieDown(PLAYER, G.BED.L, -0.14, 0.15, 0.35); G.lieDown(PARTNER, G.BED.R, -0.40, -0.3, -0.4); PARTNER.mode = 'lying'; G.setShot(fixed(V(2.4, 1.55, 1.25), V(2.4, 0.6, -1.0), 40, 0.01)); }
}
const free = () => { STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false; PARTNER.mode = 'follow'; };
const stand = () => G.cutTo(() => { G.standAt(PLAYER, G.BED.L - 0.6, 0.2, Math.PI / 2); G.standAt(PARTNER, G.BED.R + 0.6, 0.2, -Math.PI / 2); }, 0.4);

CH.ending_foundme = async () => {
  checkpoint('ending_foundme'); home(true);
  await wait(0.3); fade(false, 2.2, '#fff'); await wait(1);
  await N('(Morning. An ordinary one. The snow has stopped.)', K());
  await N('(You wake up already holding on to her. Hard.)', K());
  await P('…You’re squeezing.', K());
  await Y('Yes.', K());
  await P('…Okay. Squeeze away.', K());
  const c = await choose(['Don’t let go', 'Make breakfast together']);
  if (c === 0) await N('(You don’t let go. The kettle can wait. Everything can wait.)', K());
  else { await N('(Toast, this time. She steals your crust. Of course she does.)', K()); }
  await P('Hey. You found me.', K());
  await Y('You whistled like an idiot.', K());
  await P('I whistled PERFECTLY.', K());
  addScrap('foundme', 'Ordinary morning. Squeezed. (Lovingly.)');
  await stand(); free();
  G.hint('(Take your time.)', 4);
  await wait(14);
  STATE.busy = true;
  await N('(From somewhere in the house: three notes. Slightly flat on the last one.)');
  const w = await choose(['Whistle back', 'Go and find her']);
  if (w === 0) { await wait(Math.min(1.8, G.Audio.whistle(1.0, 0.8) + 0.3)); await N('(Badly. She laughs, from the kitchen.)'); }
  else await N('(She’s in the kitchen, in your jumper, with two mugs. Two.)');
  showEnd('foundme', 'You Found Me');
};

CH.ending_uncertain = async () => {
  checkpoint('ending_uncertain'); home(true);
  await wait(0.3); fade(false, 2.2, '#fff');
  await N('(Morning. Home. The snow has stopped.)', K());
  await P('Morning, you.', K());
  await Y('Morning.', K());
  await stand(); free();
  G.hint('(Put the kettle on. It’s a normal morning.)', 6);
  await until(() => PLAYER.x > 11.6 && PLAYER.z < 0.6 && !G.busy());
  STATE.busy = true;
  await G.cutTo(() => { G.standAt(PLAYER, 13.05, -1.25, Math.PI); G.standAt(PARTNER, 12.3, -1.0, Math.PI - 0.4); PARTNER.mode = 'still'; G.setShot(fixed(V(13.2, 1.6, 0.4), V(13.0, 1.0, -1.7), 42, 0.01)); STATE.sceneShot = true; }, 0.35);
  MUG3.visible = true;
  await N('(The drying rack.)', K());
  await P('…Did you get a new mug?', K());
  await Y('No.', K());
  await P('Huh.', K());
  await N('(She makes tea in one of them, humming.)', K());
  await wait(1.2);
  await N('(It’s a lovely morning.)', K());
  showEnd('uncertain', 'Uncertain Morning');
};

CH.ending_iknow = async () => {
  checkpoint('ending_iknow'); home(false);
  for (const L of G.LAMPS) L.on = true; G.FIRE.on = true; G.FIRE.level = 0.7;
  G.setTime({ day: 2, tod: 1, snow: 0 }, true);
  const S0 = G.SOFA;
  for (const [c, x] of [[PLAYER, S0.x + 0.35], [PARTNER, S0.x - 0.25]]) { c.x = x; c.z = S0.z - 0.08; c.y = c.yFloor = 0; c.yaw = Math.PI; c.seatY = S0.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; }
  PARTNER.mode = 'seated';
  const shot = fixed(V(S0.x - 1.1, 1.2, S0.z - 1.6), V(S0.x, 0.95, S0.z), 36, 0.012);
  G.setShot(shot);
  await wait(0.3); fade(false, 2, '#fff');
  await N('(Home. The sofa. The scrapbook open between you.)', { shot });
  await N('(Some pages are blank now. Some have photographs neither of you is sure about.)', { shot });
  await P('Was that us? At the lake?', { shot });
  await Y('I think so.', { shot });
  await P('I don’t remember the lake.', { shot });
  await P('Do you know it’s me? Really know?', { shot });
  const c = await choose(['“No.”', '“Yes.”', '“I’m choosing it anyway.”']);
  if (c === 0) await P('Me neither. …I’m choosing it anyway.', { shot });
  else if (c === 1) await P('Liar. …Lovely liar.', { shot });
  else await P('…Yes. Same.', { shot });
  await N('(You start a new page. Not memories. Disagreements.)', { shot });
  addScrap('iknow', 'Things we disagree about: the scarf. The pinecones. The lake. Whether you snore. (You do.)');
  if (G.UI.scrapbook) await G.UI.scrapbook(S.scrap);
  showEnd('iknow', 'I Know It’s You');
};

CH.ending_perfect = async () => {
  checkpoint('ending_perfect'); home(false);
  for (const L of G.LAMPS) L.on = true;
  setBreakfast({ plates: true, mugs: true });
  const ch = G.KITCHEN.chairs;
  G.sitAt(PLAYER, ch.B.x, ch.B.z, ch.B.yaw, ch.B.seatY || 0.49); G.sitAt(PARTNER, ch.A.x, ch.A.z, ch.A.yaw, ch.A.seatY || 0.49); PARTNER.mode = 'seated';
  const shot = fixed(V(13.0, 1.4, 1.55), V(13.0, 0.98, 3.4), 42, 0.01);
  G.setShot(shot);
  await wait(0.3); fade(false, 2);
  await N('(Inside, everything is exactly where it belongs.)', { shot });
  await P('Breakfast’s ready. Perfectly round. Nobody will steal any.', { shot });
  await N('(She laughs at every one of your jokes. She never steals your food. She never takes the blanket.)', { shot });
  await N('(It is lovely. Every single day of it is lovely.)', { shot });
  await fade(true, 2);
  // Somewhere else, the real one keeps a small fire going in the circle.
  G.setTime({ day: 1, tod: 1, snow: 0.6 }, true); G.WEATHER.hold = 'snow';
  G.WALK && G.WALK.showCircle(true);
  G.setDressed(PARTNER, true);
  PARTNER.sitTarget = PARTNER.sit = 0; G.sitAt(PARTNER, CIRCLE.x, CIRCLE.z + 0.4, Math.PI, fy(CIRCLE.x, CIRCLE.z) + 0.05);
  G.standAt(PLAYER, 13.0, 1.0, 0); PLAYER.m.visible = false;
  const far = fixed(V(CIRCLE.x + 3.2, fy(CIRCLE.x, CIRCLE.z) + 1.8, CIRCLE.z - 3.4), V(CIRCLE.x, fy(CIRCLE.x, CIRCLE.z) + 0.6, CIRCLE.z), 40, 0.01);
  G.setShot(far);
  fade(false, 2.2);
  await wait(2.4); G.Audio.whistle(1.12, 0.6);
  await wait(3.2); G.Audio.whistle(1.12, 0.6);
  await wait(3.4);
  await N('(Somewhere else, someone sits in the last bit of summer for as long as it lasts, and whistles.)', { shot: far });
  PLAYER.m.visible = true;
  showEnd('perfect', 'The Perfect Partner');
};

CH.ending_stay = async () => {
  checkpoint('ending_stay'); home(false);
  houseFor('evening'); G.FIRE.level = 0.8;
  G.setTime({ day: 1, tod: 1, snow: 0.4 }, true); G.WEATHER.hold = 'snow'; STATE.snowStill = true;
  const ch = G.KITCHEN.chairs;
  G.sitAt(PLAYER, ch.B.x, ch.B.z, ch.B.yaw, ch.B.seatY || 0.49); G.sitAt(PARTNER, ch.A.x, ch.A.z, ch.A.yaw, ch.A.seatY || 0.49); PARTNER.mode = 'seated';
  const shot = fixed(V(13.0, 1.4, 1.55), V(13.0, 0.98, 3.4), 42, 0.01);
  G.setShot(shot);
  await wait(0.3); fade(false, 2);
  await N('(A cake. Candles. Snow outside the window, hanging in the air, not falling.)', { shot });
  await G.UI.card(['Day 1.', 'Day 2.', 'Day 41.', 'Day 412.'], { hold: 3.5, stagger: 1.1 });
  await N('(Nobody gets older. Nothing gets forgotten. The candles never burn down.)', { shot });
  if ((S.vars.bond || 0) >= 5) {
    await P('If you’re staying, I’m staying. Obviously.', { shot });
    await N('(She makes the same joke about the candles every time. You laugh every time. You’re almost sure it’s the same joke.)', { shot });
  } else {
    await P('…I can’t. I’m sorry. I can’t live inside a photograph.', { shot });
    PARTNER.sitTarget = PARTNER.sit = 0; PARTNER.mode = 'script';
    await G.walkTo(PARTNER, 6.5, 4.2, 0.9);
    PARTNER.hidden = true; PARTNER.m.visible = false;
    G.Audio.thud && G.Audio.thud();
    await N('(The front door closes. On the other side of it, very faintly, the snow starts falling again.)', { shot });
  }
  STATE.snowStill = false;
  showEnd('stay', 'Stay Here');
};
});
