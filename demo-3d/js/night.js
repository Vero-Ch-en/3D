'use strict';
/* =========================================================================
 * Act III · Recognition: the night.
 * You wake cold; her side is empty and there's a light in the kitchen. She
 * couldn't sleep either. A sleepless night together, the ordinary way: cocoa,
 * the last of the fire, the window seat, cold cake from the fridge. You tease
 * her the way you always do; she answers almost right (a line repeated word
 * for word, the toaster mentioned, a score remembered, a laugh a beat late).
 * Nothing says so. Back in bed she lies exactly on her side; then, from the
 * kitchen, three notes whistled the way only the real one whistles them, and
 * a door in the wall that has never been there. Elsewhere: for a little while
 * you are Partner, at breakfast with an imitation of you.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S;
const { P, Y, N, choose, wait, until, fixed, V, addBond, addScrap, cyc, inter, findInter, rewire, checkpoint, houseFor, quiet, CH, EVE } = A;
const K = (o) => ({ shot: 'keep', ...o });
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const night = () => S.chapter === 'night';
const NIGHT = (G.NIGHT = { clues: new Set(), door: null });

/* ---------- the door that has never been there: east wall of the kitchen, between the fridge and the study ---------- */
(() => {
  const g = new THREE.Group(); g.position.set(14.86, 0, 2.45); g.rotation.y = -Math.PI / 2; g.visible = false;
  const wood = G.MAT.darkWood || G.std({ color: '#3a2a20' });
  const frame = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), wood); m.position.set(x, y, 0); g.add(m); };
  frame(0.1, 2.05, -0.47, 1.02); frame(0.1, 2.05, 0.47, 1.02); frame(1.04, 0.1, 0, 2.08);
  // summer, through the gap: warm light and green
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 2.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.45, 0.9), toneMapped: false }));
  glow.position.set(0, 1.0, -0.02); g.add(glow);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.84, 2.0, 0.04), G.std({ color: '#d9cbb4', roughness: 0.8 }));
  leaf.geometry.translate(0.42, 0, 0); leaf.position.set(-0.42, 1.0, 0.01); leaf.rotation.y = -0.55; g.add(leaf);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), G.std({ color: '#b08a48', metalness: 0.8, roughness: 0.3 })); knob.position.set(0.76, 0, 0.04); leaf.add(knob);
  G.world.add(g); NIGHT.door = g; NIGHT.leaf = leaf;
})();

/* ---------- getting there: the porch ends in "Inside. Please." and the night begins ---------- */
G.goNight = async () => {
  const f = G.$('fade'); f.style.background = '#000'; f.classList.add('on'); await wait(1.4);
  return A.go('bedtime');
};

/* ---------- the photograph again: now with a third shape at the edge, between the trees ---------- */
function thirdShape() {
  const m = EVE && EVE.photo && EVE.photo.material.map; if (!m || !m.image) return;
  const x = m.image.getContext('2d');
  x.fillStyle = 'rgba(30,30,40,0.55)'; x.fillRect(260, 118, 12, 52); x.beginPath(); x.arc(266, 110, 8, 0, 7); x.fill();
  m.needsUpdate = true;
}

/* ---------- the chapter ---------- */
const B = () => G.BED;
const bedShot = () => fixed(V(B().x + 0.05, 2.2, -0.9), V(B().x + 0.02, 0.72, -1.65), 44, 0.01);
const bedClose = () => fixed(V(B().x + 0.04, 2.1, -1.28), V(B().x + 0.02, 0.76, -1.8), 34, 0.012);
/* ---------- the Entity's notes: it watches how you play (console, and kept in this browser) ---------- */
G.observe = (key, text) => {
  S.obs = S.obs || {}; S.obs[key] = (S.obs[key] || 0) + 1;
  try { const k = 'snowed.entity.observations', a = JSON.parse(localStorage.getItem(k) || '[]'); a.push({ t: Date.now(), key, text }); localStorage.setItem(k, JSON.stringify(a.slice(-80))); } catch (e) { /* private window: it forgets */ }
  try { console.log('%c' + text, 'color:#8f93a8;font-style:italic'); } catch (e) { /* */ }
};
const corrupt = (n, why) => { S.vars.corruption = (S.vars.corruption || 0) + n; G.observe('corrupt_' + why, ['It sat with me by the fire. It was warm. It stayed.', 'It agreed with me. It is easier to agree.', 'It closed its eyes beside me. Good.'][{ fire: 0, agree: 1, sleep: 2 }[why] || 1]); };
const suspect = (n, why) => { S.vars.suspicion = (S.vars.suspicion || 0) + n; G.observe('suspect_' + why, { stare: 'It looks at me for a long time. I will look back.', run: 'It moves away from me quickly. I will be slower.', confront: 'It asked me who I am. I told it.', notice: 'It noticed something. I will put it back.' }[why] || 'It is paying attention.'); };

/* ---------- bedtime: the real one, warm, and the thing she says about water ---------- */
CH.bedtime = async () => {
  checkpoint('bedtime'); STATE.watchDoor = false;
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.style.background = '#000'; f.classList.add('on'); await wait(0.6); }
  quiet(); STATE.busy = true;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.setTime({ day: 0, tod: 1, snow: 0.3 }, true);
  houseFor('evening'); G.FIRE.level = 0.6;
  NIGHT.door.visible = false;
  G.standAt(PLAYER, 3.2, 1.6, Math.PI); G.standAt(PARTNER, 2.5, 1.7, Math.PI); PARTNER.mode = 'still';
  STATE.sceneShot = true; G.setShot(fixed(V(4.2, 1.7, 2.6), V(2.6, 0.9, -0.6), 44, 0.01));
  await wait(0.3);
  f.style.transition = 'opacity 1.6s'; f.classList.remove('on'); wait(1.8).then(() => { f.style.transition = ''; f.style.background = ''; });
  await P('Bed. Now. I’m declaring it.', K());
  await G.cutTo(() => { G.lieDown(PLAYER, B().L, -0.14, 0.15, 0.35); G.lieDown(PARTNER, B().R, -0.40, -0.3, -0.4); PARTNER.mode = 'lying'; G.shapeBed({ L: true, R: true }); G.setShot(bedClose()); }, 0.5);
  await P('Partner.', K());
  await Y('Partner.', K());
  await P('A good first snow?', K());
  const a = await choose(['“Top three.”', '“Apart from the firefly.”', '“Every one with you is.”']);
  if (a === 0) { await P('Top three? What were the other two?', K()); await Y('Classified.', K()); await P('I shall find out. I have methods.', K()); }
  else if (a === 1) { addBond(0.2); S.vars.trust = (S.vars.trust || 0) + 0.4; await P('…Yes. Apart from that.', K()); await N('(She finds your hand under the blanket and keeps it.)', K()); }
  else { addBond(0.6); await P('…Stop it. You can’t say things like that at night. I’ll cry on your good jumper.', K()); }
  const b = await choose(['Hold her', 'Look at her', 'Kiss her goodnight']);
  addBond(0.6);
  if (b === 0) { PARTNER.lidsClosed = true; await N('(She fits into your side as though she were measured for it.)', K()); await P('Mm. Don’t let it go to your head, {giant}.', K()); PARTNER.lidsClosed = false; }
  else if (b === 1) { await P('You’re staring.', K()); await Y('I’m looking.', K()); await P('At me.', K()); await Y('Unfortunately.', K()); await P('You could simply admit I’m lovely.', K()); await Y('I could.', K()); await P('…Coward.', K()); }
  else { await P('Mm. A goodnight kiss. Very proper. Very old married couple.', K()); await Y('We’re not married.', K()); await P('Very old unmarried couple, then.', K()); }
  await P('If I get up for water, don’t steal my side.', K());
  await Y('You don’t recognise sides.', K());
  await P('…Touché. Goodnight, {giant}.', K());
  for (const L of G.LAMPS) L.on = false;
  G.Audio.click && G.Audio.click();
  PARTNER.lidsClosed = true;
  await N('(Snow taps at the window. You don’t remember falling asleep.)', K());
  f.style.background = '#000'; f.style.transition = 'opacity 2.2s'; f.classList.add('on'); await wait(2.4); f.style.transition = '';
  return A.go('night');
};

/* ---------- the night ---------- */
CH.night = async () => {
  checkpoint('night');
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.style.background = '#000'; f.classList.add('on'); await wait(0.7); }
  quiet(); STATE.busy = true;
  G.useKids(false); G.setDressed(PLAYER, false); G.setDressed(PARTNER, false);
  G.post.grade.uniforms.uMem.value = 0; STATE.fog = null;
  G.setTime({ day: 0, tod: 1, snow: 0.25 }, true);
  houseFor('morning');                        // lamps off, the cake put away, the bed slept in
  G.FIRE.on = true; G.FIRE.level = 0.35;      // the fire down to its last coals
  for (const L of G.LAMPS) { if (L.power0 == null) L.power0 = L.power; const p = L.g.getWorldPosition(new THREE.Vector3()); if (p.x > 12.5 && p.x < 13.5 && p.y > 1.5) { L.on = true; L.power = 0.9; } }
  NIGHT.door.visible = false; NIGHT.done = new Set(); NIGHT.whistles = 0; NIGHT.seen = new Set();
  Object.assign(S.flags, { doorOpen: false, nightUp: false, sleptBeside: false, fakeWithdrawn: false });
  S.vars.suspicion = 0;
  STATE.bounds = { zMin: -5, zMax: 4.3 };     // nobody is going out tonight
  G.lieDown(PLAYER, B().L, -0.14, 0.15, 0.35);
  PARTNER.hidden = true; PARTNER.m.visible = false; PARTNER.mode = 'still';
  STATE.sceneShot = true; G.setShot(bedShot());
  await wait(0.4);
  f.style.transition = 'opacity 2.6s'; f.classList.remove('on'); wait(2.8).then(() => { f.style.transition = ''; f.style.background = ''; });
  await G.UI.act('III', 'Recognition', { white: false });
  G.setShot(bedClose(), false);
  await N('(Cold. The blanket is on your side. All of it.)', K());
  await N('(Her side is empty. Still a little warm.)', K());
  await wait(0.8);
  for (let i = 0; i < 6; i++) { G.Audio.step('wood', 0.5); await wait(0.5); }
  // Footsteps come back. Nothing tells you anything.
  PARTNER.hidden = false; PARTNER.m.visible = true;
  G.placeChar(PARTNER, 5.6, 1.2, -Math.PI / 2); PARTNER.mode = 'script';
  G.setShot(bedShot(), false);
  await G.walkTo(PARTNER, B().R + 0.55, -0.4, 0.9);
  await P('Couldn’t sleep. Got water.', K());
  G.lieDown(PARTNER, B().R, -0.40, 0, 0); PARTNER.mode = 'lying'; PARTNER.lidsClosed = false;
  G.setShot(bedClose(), false);
  await N('(She lies down on her side. Exactly on her side.)', K());
  await P('Come back to sleep.', K());
  STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true; STATE.busy = false;
  S.flags.noTogether = true; S.flags.noBarks = true; S.flags.nightUp = true;
  nightLoops(S.run);
};
// Getting up: you're on your feet beside the bed.
const getUp = () => G.cutTo(() => { G.standAt(PLAYER, B().L - 0.6, 0.2, Math.PI / 2); G.releaseCamera(); G.CAM.cut = true; }, 0.4);
// Moving while you're lying there gets you up (the bed's prompt still offers going back to sleep).
G.lieMove = () => { if (!night() || !S.flags.nightUp || S.flags.doorOpen || NIGHT.rising) return; NIGHT.rising = true; S.flags.upT = G.simT; A.run(async () => { await getUp(); NIGHT.rising = false; }); };

function nightLoops(run) {
  const live = () => S.run === run && night() && !S.flags.doorOpen;
  // The real one's whistle, from the kitchen, now and then. It has an explanation for it.
  (async () => {
    let k = 0;
    while (live()) {
      await wait(k === 0 ? 14 : 18 + Math.random() * 8);
      if (!live()) return;
      G.Audio.whistle(1.12, 0.6); NIGHT.whistles++; k++;
      if (k === 1 && !PARTNER.hidden) { await wait(1.6); if (live() && !G.busy()) G.bark('…Pipes. Old house.', 2.6); }
      if (NIGHT.whistles >= 2 && !NIGHT.door.visible && !PLAYER.lie) { NIGHT.door.visible = true; }
    }
  })();
  // If you're up, so is she: she gets out of bed after a little while and keeps you company.
  (async () => {
    await until(() => !live() || (!PLAYER.lie && S.flags.upT && G.simT - S.flags.upT > 10));
    if (!live() || S.flags.fakeWithdrawn) return;
    G.standAt(PARTNER, B().R + 0.6, 0.2, Math.PI / 2); PARTNER.mode = 'follow'; PARTNER.lidsClosed = false;
    G.bark('Can’t sleep either?', 2.4);
  })();
  // Social stealth: staring at her too long, or bolting away, is noticed.
  let stare = 0;
  G.TICKERS.add(function tick(dt) {
    if (!live()) { G.TICKERS.delete(tick); return; }
    const it = findInter('nHer'); if (it) { it.pos[0] = PARTNER.x; it.pos[2] = PARTNER.z; }
    if (PARTNER.hidden || PARTNER.lie || G.busy() || S.flags.fakeWithdrawn) { stare = 0; return; }
    const d = dist(), fx = PARTNER.x - PLAYER.x, fz = PARTNER.z - PLAYER.z, l = Math.hypot(fx, fz) || 1;
    const facing = (fx * Math.sin(PLAYER.yaw) + fz * Math.cos(PLAYER.yaw)) / l > 0.85;
    if ((PLAYER.speed || 0) < 0.2 && d < 2.4 && facing && !PLAYER.lie && !(PLAYER.sit > 0.1)) { stare += dt; if (stare > 5) { stare = -6; suspect(1, 'stare'); G.bark('…What?', 1.6); } }
    else stare = Math.max(0, stare - dt);
    if ((PLAYER.speed || 0) > 2.4 && d < 3.2) { NIGHT.runT = (NIGHT.runT || 0) + dt; if (NIGHT.runT > 1.2) { NIGHT.runT = -8; suspect(0.5, 'run'); } }
    if ((S.vars.suspicion || 0) >= 3 && !S.flags.fakeWithdrawn) withdraw();
  });
  // A hint, if you've heard the whistle and stood about a while.
  (async () => { await wait(70); if (live() && NIGHT.whistles > 0 && !G.busy()) G.hint('(The whistling seems to come from the kitchen.)', 6); })();
}
// Too watched: she goes back to bed, and lies there with her eyes open.
async function withdraw() {
  S.flags.fakeWithdrawn = true;
  G.bark('I’m going back to bed, Partner. You should too.', 3);
  PARTNER.mode = 'script'; await G.walkTo(PARTNER, B().R + 0.55, -0.4, 1.0);
  G.lieDown(PARTNER, B().R, -0.40, 0, 0); PARTNER.mode = 'lying'; PARTNER.lidsClosed = false;
}

/* ---------- in bed: go back to sleep beside her, or get up ---------- */
inter('nBed', [2.4, 0.6, 0.15], 1.25, () => (PLAYER.lie ? 'Get up' : 'Bed'), async () => {
  if (PLAYER.lie) {
    const c = await choose(['Get up', 'Go back to sleep']);
    if (c === 0) { S.flags.upT = G.simT; await getUp(); return; }
    S.flags.sleptBeside = true; corrupt(1, 'sleep');
    const f = G.$('fade'); f.style.background = '#000'; f.style.transition = 'opacity 1.4s'; f.classList.add('on'); await wait(2.6);
    f.classList.remove('on'); await wait(1.2); f.style.transition = '';
    await N('(You sleep. When you open your eyes the room is colder, and the whistling is very close.)');
    G.Audio.whistle(1.12, 0.6); NIGHT.whistles = Math.max(NIGHT.whistles, 2); NIGHT.door.visible = true;
    await N('(Beside you, she hasn’t moved. Her eyes are open.)');
    return;
  }
  await N(cyc('nBedSeen', ['(She’s lying exactly on her side, on her back, hands folded on the blanket.)', '(“Come back to sleep, Partner.” She says it kindly. She says it like a line.)']));
}, () => night() && S.flags.nightUp && !S.flags.doorOpen);

/* ---------- with her: talk, tease, and the ordinary things people do at three in the morning ---------- */
inter('nHer', [13.0, 1.2, 3.55], 1.1, 'Partner', async () => {
  if (S.flags.fakeWithdrawn) { await N('(She’s gone back to bed.)'); return; }
  await nightMenu();
}, () => night() && S.flags.nightUp && !S.flags.doorOpen && !PARTNER.lie && !PARTNER.hidden);

async function nightMenu() {
  const all = [['cocoa', 'Make some cocoa'], ['fire', 'Sit by what’s left of the fire'], ['seat', 'Watch the snow from the window seat'], ['cake', 'Raid the fridge for the last of the cake']];
  const left = all.filter(([id]) => !NIGHT.done.has(id));
  const opts = left.map((o) => o[1]).concat(['Tease her', '“Who are you?”', 'Not now']);
  await P(NIGHT.done.size ? 'What now, Partner?' : 'Since we’re both up. What shall we do?');
  const c = await choose(opts);
  if (c < left.length) { const id = left[c][0]; NIGHT.done.add(id); PARTNER.mode = 'still'; await ({ cocoa, fire, seat, cake })[id](); PARTNER.mode = 'follow'; return; }
  const k = c - left.length;
  if (k === 0) return tease();
  if (k === 1) {
    suspect(2, 'confront');
    await P('Partner. It’s three in the morning. I’m me. Who else would I be?');
    await N('(She smiles.)');
    return;
  }
  await P('All right.');
}
async function tease() {
  const c = await choose(['“You stole the whole blanket. Then gave it back.”', '“Nice hat.”', 'Poke her in the side']);
  if (c === 0) { await P('I gave it to you. You looked cold.'); await Y('That isn’t how it works. You steal it; I complain.'); await P('Yes. Sorry. Next time I’ll steal it properly.'); NIGHT.seen.add('blanket'); }
  else if (c === 1) { await P('Thank you. You said that at the fair, the first thing you ever said to me.'); const d = await choose(['“I did, didn’t I.”', '“Did I? I don’t remember.”']); if (d === 0) corrupt(1, 'agree'); else { await P('I remember everything, Partner.'); NIGHT.seen.add('certain'); } }
  else { await N('(She doesn’t flinch.)'); await P('Goodness. What was that for?'); NIGHT.seen.add('flinch'); }
}
const two = (px, pz, qx, qz, pyaw, qyaw) => G.cutTo(() => { G.standAt(PLAYER, px, pz, pyaw); G.standAt(PARTNER, qx, qz, qyaw); PARTNER.mode = 'still'; }, 0.35);
async function cocoa() {
  const K2 = G.KITCHEN || {}, kx = (K2.stove && K2.stove.x) || 12.35;
  await two(kx - 0.35, -1.25, kx + 0.4, -1.2, Math.PI + 0.2, Math.PI - 0.3);
  const shot = fixed(V(kx + 0.1, 1.55, 0.2), V(kx, 1.0, -1.5), 42, 0.012);
  await N('(Milk in the little pan, the hob ticking, the window black and full of snow.)', { shot });
  await P('How many sugars?', { shot });
  const c = await choose(['“Two.”', '“One, and a second one that doesn’t count.”', '“None. I’m sweet enough.”']);
  if (c === 0) { await P('One. And a second one that doesn’t count.', { shot }); NIGHT.seen.add('verbatim'); }
  else if (c === 1) { await P('That’s my line.', { shot }); await Y('I know. I’m stealing it.', { shot }); await P('That’s fair. You can have it.', { shot }); NIGHT.seen.add('gaveup'); }
  else await P('That’s not true, Partner. You’re an ordinary amount of sweet.', { shot });
  const t = await choose(['“Toast with it?”', '“Don’t burn it this time.”', 'Just stir']);
  if (t === 0) { await P('The toaster? Of course. It works perfectly well.', { shot }); NIGHT.seen.add('toaster'); }
  else if (t === 1) { await P('I won’t.', { shot }); await N('(She doesn’t. Not even a little at the bottom.)', { shot }); }
  else await N('(You stir. She watches the spoon go round.)', { shot });
  await N('(It’s good cocoa.)', { shot });
}
async function fire() {
  const S0 = G.SOFA;
  await G.cutTo(() => { for (const [c, x] of [[PLAYER, S0.x + 0.35], [PARTNER, S0.x - 0.25]]) { c.x = x; c.z = S0.z - 0.08; c.y = c.yFloor = 0; c.yaw = Math.PI; c.seatY = S0.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; } PARTNER.mode = 'seated'; }, 0.35);
  const shot = fixed(V(S0.x - 1.1, 1.2, S0.z - 1.6), V(S0.x, 0.95, S0.z), 36, 0.012);
  G.FIRE.level = 0.5; corrupt(1, 'fire');
  await N('(The fire is down to a red glow. You put one more log on, mostly for the company.)', { shot });
  await P('It was a perfect day. You won the pinecones by two. Eleven to nine.', { shot });
  const c = await choose(['“Eleven to nine. That’s right.”', '“You never remember a score.”', '“Was it?”']);
  if (c === 0) corrupt(1, 'agree');
  else if (c === 1) { await P('I remember this one.', { shot }); NIGHT.seen.add('score'); suspect(0.5, 'notice'); }
  else await P('It was. I counted.', { shot });
  await N('(She leans her head on your shoulder.)', { shot });
  await G.cutTo(() => { for (const c2 of [PLAYER, PARTNER]) { c2.sitTarget = c2.sit = 0; } G.standAt(PLAYER, S0.x + 1.55, S0.z - 0.1, -Math.PI / 2); G.standAt(PARTNER, S0.x - 1.55, S0.z - 0.1, Math.PI / 2); }, 0.3);
  G.FIRE.level = 0.35;
}
async function seat() {
  const Nk = G.NOOK;
  await G.cutTo(() => { G.sitAt(PLAYER, Nk.x + 0.35, Nk.z, 0, Nk.seatY); G.sitAt(PARTNER, Nk.x - 0.35, Nk.z, 0, Nk.seatY); PARTNER.mode = 'seated'; }, 0.35);
  const shot = fixed(V(Nk.x + 0.2, 1.35, Nk.z + 2.0), V(Nk.x, 0.95, Nk.z), 38, 0.012);
  await N('(Snow going past the window behind you, slow and fat and silent.)', { shot });
  await P('We’re exactly the same people we were when we were seven. Nothing has changed at all.', { shot });
  const c = await choose(['“Exactly the same.”', '“You asked me that on the hill. You weren’t sure.”', '“Taller.”']);
  if (c === 0) corrupt(1, 'agree');
  else if (c === 1) { await P('I’m sure now.', { shot }); NIGHT.seen.add('certain'); }
  else await P('Taller. Otherwise exactly the same.', { shot });
  await G.cutTo(() => { for (const c2 of [PLAYER, PARTNER]) { c2.sitTarget = c2.sit = 0; } G.standAt(PLAYER, Nk.x + 0.4, Nk.z + 0.9, Math.PI); G.standAt(PARTNER, Nk.x - 0.4, Nk.z + 0.9, Math.PI); }, 0.3);
}
async function cake() {
  const K2 = G.KITCHEN || {}, tb = K2.table || { x: 13.0, z: 2.95 };
  await G.cutTo(() => { G.sitAt(PLAYER, 13.3, 3.58, Math.PI, 0.49); G.sitAt(PARTNER, 13.0, 2.3, 0, 0.49); PARTNER.mode = 'seated'; }, 0.35);
  const shot = fixed(V(tb.x + 1.6, 1.35, tb.z + 0.4), V(tb.x, 0.9, tb.z), 40, 0.012);
  await N('(The last of the cake, two forks, the fridge door left open for the light.)', { shot });
  const c = await choose(['Steal the bit with the most icing', '“Half each. You check.”', '“You have it.”']);
  if (c === 0) { await P('Have it. You like that bit.', { shot }); NIGHT.seen.add('icing'); }
  else if (c === 1) { await P('It’s exactly half. I can tell.', { shot }); await N('(She doesn’t look.)', { shot }); NIGHT.seen.add('nocheck'); }
  else await P('Thank you, Partner.', { shot });
  await N('(When you stand up, she pushes her chair in. Square to the table.)', { shot });
  await G.cutTo(() => { for (const c2 of [PLAYER, PARTNER]) { c2.sitTarget = c2.sit = 0; } G.standAt(PLAYER, 12.6, 3.9, Math.PI); G.standAt(PARTNER, 13.4, 3.9, Math.PI); }, 0.3);
}
/* ---------- small things in the dark house, for anyone who looks (none of them needed) ---------- */
inter('nSink', [13.05, 1, -1.6], 0.6, 'Sink', async () => { await N('(Three mugs on the drying rack, washed and turned upside down. There were two.)'); NIGHT.seen.add('mugs'); }, () => night() && S.flags.nightUp && !S.flags.doorOpen);
inter('nPhoto', [7.75, 1.4, 4.15], 0.8, 'Photograph', async () => { if (!EVE.photo.visible) EVE.showPhoto(); thirdShape(); await N('(The photograph. The two children on the log. And at the very edge, between the trees, a third shape, standing very still.)'); NIGHT.seen.add('photo'); }, () => night() && S.flags.nightUp && !S.flags.doorOpen);
inter('nWin', [0.6, 1.3, -0.15], 0.8, 'Window', async () => { await N('(There’s snow on the inside of the sill. A little drift of it, as if the window had been open. It hasn’t.)'); NIGHT.seen.add('sill'); }, () => night() && S.flags.nightUp && !S.flags.doorOpen);
// The front door won't open tonight.
{ const fd = findInter('frontdoor'), orig = fd && fd.raw; if (fd) rewire('frontdoor', async () => { if (night() && !S.flags.doorOpen) { await N('(It won’t open. It isn’t locked. It just won’t.)'); return; } return orig(); }); }
// Walking into the kitchen once the door is there.
G.TICKERS.add(() => { if (night() && NIGHT.door.visible && !S.flags.doorOpen && !NIGHT.doorSaid && PLAYER.x > 11.3 && !G.busy()) { NIGHT.doorSaid = true; A.run(async () => { await N('(There’s a door in the kitchen wall. There has never been a door in the kitchen wall.)'); }); } });

/* ---------- the door, and Elsewhere ---------- */
inter('nDoor', [14.6, 1, 2.45], 0.9, 'The door', async () => {
  await N('(A door in the kitchen wall, between the fridge and the study. It is standing a little open. Through the gap: the kitchen, at night, from the other side.)');
  const c = await choose(['Go through', 'Not yet']);
  if (c === 1) return;
  S.flags.doorOpen = true;
  G.observe('door', S.flags.sleptBeside ? 'It slept beside me first. Then it went.' : 'It went through. It always goes through.');
  await elsewhere();
}, () => night() && NIGHT.door.visible && !S.flags.doorOpen);

// Play as her for a while: the bodies swap places, so the controls drive her.
G.swapBodies = () => {
  const a = PLAYER.m; PLAYER.m = PARTNER.m; PARTNER.m = a;
  const st = PLAYER.scarfTail; PLAYER.scarfTail = PARTNER.scarfTail; PARTNER.scarfTail = st;
  for (const c of [PLAYER, PARTNER]) { c._hsp = null; c._ikOff = null; c.lookAt = null; c.hugWith = null; c.holdWith = null; c.lie = false; c.sit = c.sitTarget = 0; }
  NIGHT.swapped = !NIGHT.swapped;
};
async function elsewhere() {
  const f = G.$('fade'); f.style.background = S.flags.sleptBeside ? '#000' : '#dfe9f5'; f.style.transition = 'opacity 1.6s'; f.classList.add('on'); await wait(1.8);
  STATE.busy = true; STATE.sceneShot = false;
  NIGHT.door.visible = false; STATE.bounds = { zMin: -5, zMax: 4.3 };
  G.swapBodies();
  // Earlier, the same night. She's up for water. He's asleep.
  G.standAt(PLAYER, 13.05, -1.25, Math.PI); PARTNER.hidden = true; PARTNER.m.visible = false; PARTNER.mode = 'still';
  G.post.grade.uniforms.uMem.value = 0.25;
  G.releaseCamera(); G.CAM.cut = true;
  await wait(0.3);
  f.classList.remove('on'); wait(1.8).then(() => { f.style.transition = ''; f.style.background = ''; });
  await G.UI.card(['Earlier.'], { hold: 2.2 });
    await N('(Water. A cold glass. The house making its house noises. In the bedroom, he is asleep and snoring, lovingly.)');
  STATE.busy = false; S.flags.noTogether = true;
    await wait(4);
  // Something in his shape comes into the kitchen.
  STATE.busy = true;
  PARTNER.hidden = false; PARTNER.m.visible = true; G.placeChar(PARTNER, 10.6, 2.0, Math.PI / 2); PARTNER.mode = 'script';
  await G.walkTo(PARTNER, PLAYER.x - 1.1, PLAYER.z + 0.9, 0.9);
  G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.5, PLAYER.z], 9); G.gaze(PLAYER, [PARTNER.x, PARTNER.y + 1.7, PARTNER.z], 9);
  await Y('Come back to bed, Partner.');
  await N('(He’s come all the way into the kitchen, in his bare feet.)');
  const c = await choose(['“Did you call from the door?”', '“Two minutes.”', '“…Hello, {giant}.”']);
  if (c === 0) { await Y('No. I came for you.'); }
  else if (c === 1) { await Y('I’ll wait.'); }
  else { await Y('Hello.'); }
  await Y('Come on.');
  STATE.busy = false;
  G.walkTo(PARTNER, 5.6, 1.2, 0.9).then(() => { PARTNER.hidden = true; PARTNER.m.visible = false; });
  await until(() => PLAYER.x < 11.4 || PARTNER.hidden);
  await until(() => !G.busy());
  STATE.busy = true;
  await N('(He doesn’t wait for you.)');
  STATE.busy = false;
  NIGHT.canWhistle = true;
  G.hint(G.MOBILE ? 'Go to the kitchen window and tap Use to whistle.' : 'Go to the kitchen window and whistle (' + G.keyFor('interact') + ').', 6);
  await until(() => S.flags.povWhistled && !G.busy());
  STATE.busy = true;
  await N('(You leave him something. Just in case.)');
  const s = await choose(['Line the pinecones up along the windowsill', 'Leave half a pancake, one enormous bite out of it', 'Write on a page of the scrapbook']);
  S.flags.sign = ['pinecones', 'pancake', 'note'][s];
  if (s === 0) await N('(Seven pinecones, in a row along the sill, biggest to smallest. The contest. He won it, and you said you let him.)');
  else if (s === 1) await N('(Half a pancake on a plate, with one enormous bite out of it. He’ll know that bite anywhere.)');
  else await N('(You write: “If it’s sure about the night we met, it isn’t me. — your {gremlin}”)');
  await N('(Then you walk out into the snow, towards wherever he is.)');
  STATE.busy = false; STATE.bounds = null; NIGHT.outside = true;
  G.hint('The front door.', 4);
  await until(() => PLAYER.z > 4.9);
  STATE.busy = true;
  f.style.background = '#ffffff'; f.style.transition = 'opacity 2.2s'; f.classList.add('on'); await wait(2.4);
  G.swapBodies(); G.post.grade.uniforms.uMem.value = 0;
  addScrap('night', 'A door in the kitchen wall. The kitchen at night, from her side. Something left behind for the real one to find.');
  STATE.busy = false;
  return A.go('lastbirthday');
}
// Her whistle, at the kitchen window (only in Elsewhere).
inter('eWhistle', [13.05, 1.3, -1.45], 0.8, 'Whistle', async () => {
  await wait(Math.min(1.8, G.Audio.whistle(1.12, 0.6) + 0.3));
  await N('(Three notes, out into the dark. Slightly flat on the last one. If he’s awake, he’ll know.)');
  S.flags.povWhistled = true; NIGHT.canWhistle = false;
}, () => NIGHT.canWhistle);
// In Elsewhere the front door opens: that's the way out to find him.
{ const fd = findInter('frontdoor'), raw = fd && fd.raw; if (fd) rewire('frontdoor', async () => { if (NIGHT.outside) { await N('(Out into the snow.)'); return; } return raw(); }); }

});
