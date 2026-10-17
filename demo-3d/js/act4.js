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
const CIRCLE = { x: -3.6, z: 45.0 };
const GATE = { x: 6.5, z: 9.6 };          // the bottom of the porch path: it asks you not to go
const EXIT = { x: 1.6, z: 27.5 };         // the door in the snow, in the meadow, on the way home
const trust = (n) => { S.vars.trust = (S.vars.trust || 0) + n; };
const accepted = () => (S.vars.corruption || 0) + (S.flags.wentBack ? 0.5 : 0) + (S.flags.ateBreakfast ? 0.5 : 0);
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

/* ---------- the endcard learns the ending's name ---------- */
G.endingName = null;
const showEnd = (id, title) => {
  try { const k = 'snowed.endings', a = JSON.parse(localStorage.getItem(k) || '[]'); if (!a.includes(id)) a.push(id); localStorage.setItem(k, JSON.stringify(a)); } catch (e) { /* */ }
  G.observe('ending_' + id, { foundme: 'It found the real one. I will remember how.', uncertain: 'It went home. It is not sure who with. Neither am I.', iknow: 'It does not know. It chose anyway. I did not plan for that.', perfect: 'It stayed with me. Every day is lovely.', stay: 'It stayed. I will remember it for both of us.' }[id]);
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
  G.WALK && G.WALK.showCircle(true);
  SIGN.g.visible = true; for (const k of ['cones', 'plate', 'note']) SIGN[k].visible = false;
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
  await N('(Through the window, the snow is falling very slowly. Some of it isn’t falling at all.)', K());
  if (withFake) {
    await P('There you are. Weird dream, huh?', K());
    await P('Happy birthday, Partner. I made breakfast. Everything’s ready.', K());
  } else await N('(The house is empty. Breakfast is laid for two.)', K());
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
      G.Audio.whistle(1.12, d > 25 ? 0.9 : 0.4);
    }
  })();
  // A nudge if you've been standing about.
  (async () => {
    const lines = ['(The whistling is coming from outside. Past the meadow. Where the circle was.)', '(Somewhere out past the meadow, someone is whistling three notes. Slightly flat on the last one.)'];
    for (let i = 0; live() && !S.flags.reunited; i++) { await wait(55); if (live() && !S.flags.reunited && !G.busy()) G.hint(lines[i % 2], 6); }
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
    if (S.flags.reunited && !S.flags.offerDone && !PARTNER.hold && dist() > 2.2) { NIGHTT.t = (NIGHTT.t || 0) + dt; if (NIGHTT.t > 3) { NIGHTT.t = -10; G.bark('Hand. Now. Just— hold my hand, {giant}.', 3); } }
  });
}
const NIGHTT = {};

async function gate() {
  STATE.busy = true; PARTNER.mode = 'still';
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.6, PLAYER.z], 6);
  if (S.flags.gateN) await P('…Again?');
  else { await P('…You’re still looking for them.'); await P('I’m right here.'); }
  S.flags.gateN = (S.flags.gateN || 0) + 1;
  const c = await choose(['Keep walking', 'Go back with it']);
  if (c === 0) {
    await P('I’ll wait. I’m good at waiting. I learned it from you.');
    S.flags.fakeLeftBehind = true; PARTNER.mode = 'still';
    G.observe('gate_left', 'It left me at the bottom of the path. I waited.');
  } else {
    if (!S.flags.wentBack) S.flags.wentBack = true;
    await P('Good. Home.');
    await G.cutTo(() => { G.standAt(PLAYER, 6.5, 5.2, Math.PI); G.standAt(PARTNER, 7.1, 5.4, Math.PI); G.CAM.cut = true; }, 0.4);
    PARTNER.mode = 'follow';
    G.observe('gate_back', 'It came back inside with me. It is easier inside.');
  }
  STATE.busy = false;
}

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
  await N('(In the ring of summer in the snow, cross-legged in the grass, exactly where someone small once sat.)', K());
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
  if (S.flags.foundSign) { await P('Did you find it? What I left?', K()); await Y('Obviously.', K()); await P('Obviously, he says. You walked past it twice. I could feel it.', K()); trust(0.5); }
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
  G.hint('Hold her hand. The door in the meadow.', 5);
  addScrap('lastbday', 'A ring of summer in the snow, and her in it, whistling like an idiot.');
}
inter('aExit', [EXIT.x, 1.0, EXIT.z + 0.6], 1.3, 'The door', async () => {
  if (!S.flags.reunited) { await N('(A door, standing on its own in the snow. Warm light round the edges. It won’t open. Not for one person.)'); return; }
  if (!PARTNER.hold || dist() > 1.6) { await N('(It won’t open. Not for one person.)'); return; }
  if (S.flags.offerDone) return;
  S.flags.offerDone = true;
  return offer();
}, () => here());

// The Entity, at last, asks.
async function offer() {
  STATE.busy = true;
  const shot = fixed(V(EXIT.x + 2.6, fy(EXIT.x, EXIT.z) + 1.6, EXIT.z + 3.4), V(EXIT.x, fy(EXIT.x, EXIT.z) + 1.2, EXIT.z), 44, 0.01);
  STATE.sceneShot = true; G.setShot(shot);
  ENT.g.position.set(EXIT.x + 1.3, fy(EXIT.x + 1.3, EXIT.z - 0.4), EXIT.z - 0.4); ENT.g.visible = true;
  for (let t = 0; t < 1; t += 1 / 45) { ENT.mat.opacity = t * 0.55; await wait(1 / 30); }
  await wait(0.6);
  await E('You could stay.', { shot });
  await E('It could always be your birthday. Nobody would get older. Nothing would be forgotten.', { shot });
  await E('Not the pancakes. Not the hill. Not the snow.', { shot });
  await E('I would remember it for you.', { shot });
  if ((S.vars.bond || 0) >= 5) await P('…Your call, {giant}. I’m with you. Either way.', { shot });
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
  else await N('(In her terrible handwriting: “If it’s sure about the night we met, it isn’t me. — your {gremlin}”)');
}, () => here() && !S.flags.foundSign);
G.TICKERS.add(() => { const it = findInter('aSign'); if (it) { const p = SIGN.pos[S.flags.sign || 'pinecones']; it.pos[0] = p[0]; it.pos[1] = p[1]; it.pos[2] = p[2]; } });
// The front door opens in Act IV; it's the only way to her.
{ const fd = findInter('frontdoor'), raw = fd && fd.raw; if (fd) rewire('frontdoor', async () => { if (here()) { await N('(Out into the snow.)'); return; } return raw(); }); }

/* =====================================================================
 * The endings
 * ===================================================================== */
function home(lyingBoth) {
  quiet(); STATE.busy = true; STATE.sceneShot = true;
  if (G.NIGHT && G.NIGHT.swapped) G.swapBodies();
  G.WALK && G.WALK.showCircle(false); SIGN.g.visible = false; EXD.g.visible = false; ENT.g.visible = false;
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
  await N('(Two mugs on the drying rack. Two. The window full of ordinary snow.)');
  showEnd('foundme', 'You Found Me');
};

CH.ending_uncertain = async () => {
  checkpoint('ending_uncertain'); home(true);
  await wait(0.3); fade(false, 2.2, '#fff');
  await N('(Morning. Home. The snow has stopped.)', K());
  await P('Morning, {giant}.', K());
  await Y('Morning, {gremlin}.', K());
  await stand(); free();
  G.hint('(Put the kettle on. It’s a normal morning.)', 6);
  await until(() => PLAYER.x > 11.6 && PLAYER.z < 0.6 && !G.busy());
  STATE.busy = true;
  await G.cutTo(() => { G.standAt(PLAYER, 13.05, -1.25, Math.PI); G.standAt(PARTNER, 12.3, -1.0, Math.PI - 0.4); PARTNER.mode = 'still'; G.setShot(fixed(V(13.2, 1.6, 0.4), V(13.0, 1.0, -1.7), 42, 0.01)); STATE.sceneShot = true; }, 0.35);
  await N('(Three mugs on the drying rack. Yours. Hers. And hers.)', K());
  await P('…Did you get a new mug?', K());
  await Y('No.', K());
  await P('Huh.', K());
  await N('(She shrugs and makes tea in one of them. You don’t ask which.)', K());
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
