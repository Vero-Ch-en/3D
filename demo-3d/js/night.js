'use strict';
/* =========================================================================
 * Act III · Recognition: the night.
 * You wake cold; her side is empty but warm. She comes back ("Couldn't sleep.
 * Got water.") and lies down exactly on her side. It isn't her. The dark house:
 * the chairs pushed in, the fridge with every label facing out, the snow globe
 * swirling as if just shaken, a third shape in the photograph, three notes in
 * the fogged window that aren't the right three. Two of them, and a door is in
 * the kitchen wall that has never been there. Elsewhere: for a little while you
 * are Partner, at breakfast with an imitation of you. You leave a sign only the
 * real one would understand, and go out into the snow to find them.
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
  return A.go('night');
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
  // Just enough light to find your way: her bedside lamp left on low, the kitchen pendant turned right down.
  for (const L of G.LAMPS) {
    if (L.power0 == null) L.power0 = L.power;
    const p = L.g.getWorldPosition(new THREE.Vector3());
    if (p.x > 3 && p.x < 4 && p.z < -1) { L.on = true; L.power = 2.4; }
    else if (p.x > 12.5 && p.x < 13.5 && p.y > 1.5) { L.on = true; L.power = 0.9; }
  }
  NIGHT.clues.clear(); NIGHT.door.visible = false; Object.assign(S.flags, { doorOpen: false, nightUp: false });
  STATE.bounds = { zMin: -5, zMax: 4.3 };     // nobody is going out tonight
  G.lieDown(PLAYER, B().L, -0.14, 0.15, 0.35);
  PARTNER.hidden = true; PARTNER.m.visible = false; PARTNER.mode = 'still';
  STATE.sceneShot = true; G.setShot(bedShot());
  await wait(0.4);
  f.style.transition = 'opacity 2.6s'; f.classList.remove('on'); wait(2.8).then(() => { f.style.transition = ''; f.style.background = ''; });
  await G.UI.act('III', 'Recognition', { white: false });
  G.setShot(bedClose(), false);
  await N('(You wake cold.)', K());
  await N('(The blanket is all on your side. Her side is empty, and still warm.)', K());
  const c0 = await choose(['Wait for her', 'Say her name', 'Listen']);
  if (c0 === 1) { await Y('Partner?', K()); await N('(Nothing. Then, from the kitchen, a glass set down very carefully.)', K()); }
  else if (c0 === 2) await N('(The house ticks in the cold. The tap runs, and stops. Footsteps: slow, even, exactly as far apart as each other.)', K());
  else await N('(You wait. The clock in the hall does its uneven tick. Then footsteps, coming back.)', K());
  // She comes back.
  PARTNER.hidden = false; PARTNER.m.visible = true;
  G.placeChar(PARTNER, 5.6, 1.2, -Math.PI / 2); PARTNER.mode = 'script';
  G.setShot(bedShot(), false);
  await G.walkTo(PARTNER, B().R + 0.55, -0.4, 0.9);
  await P('Couldn’t sleep. Got water.', K());
  G.lieDown(PARTNER, B().R, -0.40, 0, 0); PARTNER.mode = 'lying'; PARTNER.lidsClosed = false;
  G.setShot(bedClose(), false);
  await N('(She lies down exactly on her side of the bed. Not an inch over.)', K());
  await N('(In all the years you have known her, she has never once stayed on her side.)', K());
  const c1 = await choose(['“Are you all right?”', '“Come here. You’re cold.”', 'Say nothing']);
  if (c1 === 0) { await P('Yes. I got water.', K()); await Y('You said.', K()); await P('Yes.', K()); }
  else if (c1 === 1) { await P('Mm. Don’t move, Partner. You’re warm.', K()); await N('(Word for word what she said this morning. The same small pause before “warm”.)', K()); }
  else await N('(You say nothing. Neither does she. Her eyes are open. She is looking at the ceiling as if it were a page she is reading.)', K());
  await P('Goodnight, Partner.', K());
  await wait(1.2);
  await N('(Something about her is exactly right. That’s what’s wrong.)', K());
  await N('(You wait until her breathing is slow and even. It is very slow, and very even. Then you get up.)', K());
  G.cutTo(() => { G.standAt(PLAYER, B().L - 0.6, 2.6, Math.PI); G.releaseCamera(); G.CAM.cut = true; }, 0.4);
  await wait(0.6);
  STATE.sceneShot = false; STATE.busy = false; S.flags.nightUp = true;
  S.flags.noTogether = true; S.flags.noBarks = true;
  G.hint('Look around the house. Quietly.', 6);
  watch(S.run);
};

// Every so often she sits up in the dark and calls you back to bed. She takes any answer.
async function watch(run) {
  const lines = ['Partner? Come back to bed.', 'Where are you, Partner?', 'It’s very late, Partner.', 'Partner. Come back to bed now.'];
  let i = 0;
  while (S.run === run && night() && !S.flags.doorOpen) {
    await wait(26 + Math.random() * 14);
    if (S.run !== run || !night() || S.flags.doorOpen) return;
    if (STATE.busy || A.hereRoom() === 'bedroom') continue;
    G.bark(lines[i++ % lines.length], 3);
  }
}

/* ---------- the clues ---------- */
async function clue(id) {
  if (NIGHT.clues.has(id)) return;
  NIGHT.clues.add(id);
  if (NIGHT.clues.size === 2) {
    await wait(0.6);
    NIGHT.door.visible = true; G.Audio.door && G.Audio.door(true);
    await N('(Somewhere in the kitchen, the house settles, the way houses do in the cold. Except that it sounded like a door.)');
    G.hint('There’s a door in the kitchen.', 5);
  }
}
const nightOnly = () => night() && S.flags.nightUp && !S.flags.doorOpen;
inter('nChairs', [13.0, 0.6, 2.95], 0.95, 'Kitchen table', async () => {
  await N('(The chairs are pushed in. All of them, square to the table, exactly the same distance apart.)');
  await N('(Neither of you has ever pushed a chair in. It is practically a rule of the house.)');
  await clue('chairs');
}, nightOnly);
inter('nFridge', [14.45, 1, -1.35], 0.85, 'Fridge', async () => {
  G.Audio.fridgeOpen && G.Audio.fridgeOpen();
  await N('(Every jar has been turned so that its label faces out. The milk is lined up with the juice. The sad lemon is in a bowl, on its own, like a guest.)');
  await clue('fridge');
}, nightOnly);
inter('nGlobe', [8.5, 1.5, -1.4], 0.85, 'Snow globe', async () => {
  G.shakeGlobe && G.shakeGlobe();
  await N('(The snow globe on the mantle is swirling. As if someone had just shaken it and put it down.)');
  await N('(There is nobody in here.)');
  await clue('globe');
}, nightOnly);
inter('nPhoto', [7.75, 1.4, 4.15], 0.8, 'Photograph', async () => {
  if (!EVE.photo.visible) EVE.showPhoto();
  thirdShape();
  await N('(The photograph. The two children on the log, the lanterns.)');
  await N('(And at the very edge, between the trees, a third shape you didn’t see before. Standing very still. Watching them.)');
  await clue('photo');
}, nightOnly);
inter('nWindow', [13.0, 1.3, 4.05], 0.75, 'Window', async () => {
  await N('(The kitchen window has fogged over from the inside, though nobody has been cooking.)');
  await N('(Somebody has drawn three short lines in it, with a fingertip. Three notes.)');
  await wait(Math.min(1.6, G.Audio.whistle(1.3, 0.9) + 0.2));
  await N('(Not the right three.)');
  await clue('window');
}, nightOnly);
// The front door won't open tonight.
{ const fd = findInter('frontdoor'), orig = fd && fd.raw; if (fd) rewire('frontdoor', async () => { if (night() && !S.flags.doorOpen) { await N('(It won’t open. It isn’t locked. It just won’t.)'); return; } return orig(); }); }
// She's lying there in the dark with her eyes open.
inter('nBed', [2.4, 0.6, 0.15], 1.0, 'Bed', async () => {
  await N(cyc('nBed', ['(She’s lying exactly on her side, on her back, hands folded on the blanket. Her eyes are open.)', '(She turns her head and looks at you, and smiles, the right smile, a second too late.)', '(“Come back to bed, Partner.” She says it kindly. She says it like a line.)']));
}, nightOnly);

/* ---------- the door, and Elsewhere ---------- */
inter('nDoor', [14.6, 1, 2.45], 0.9, 'The door', async () => {
  await N('(A door in the kitchen wall. It has never been there. It is standing a little open, and through the gap it is summer: warm air, cut grass, crickets.)');
  const c = await choose(['Go through', 'Not yet']);
  if (c === 1) return;
  S.flags.doorOpen = true;
  await elsewhere();
}, () => night() && NIGHT.door.visible && !S.flags.doorOpen);

async function elsewhere() {
  const f = G.$('fade'); f.style.background = '#fff8e8'; f.style.transition = 'opacity 1.6s'; f.classList.add('on'); await wait(1.8);
  STATE.busy = true; STATE.sceneShot = true;
  NIGHT.door.visible = false; STATE.bounds = null;
  // Morning, in the kitchen. It's the same day again, and too bright.
  G.setTime({ day: 1, tod: 0, snow: 0.05 }, true);
  for (const L of G.LAMPS) if (L.power0 != null) L.power = L.power0;
  G.post.grade.uniforms.uMem.value = 0.45;
  G.FIRE.on = true; G.FIRE.level = 1;
  for (const c of [PLAYER, PARTNER]) { c.lie = false; c.lidsClosed = false; c.sit = c.sitTarget = 0; }
  G.sitAt(PARTNER, 13.0, 2.3, 0, 0.49); PARTNER.mode = 'seated';
  G.standAt(PLAYER, 12.35, -0.95, Math.PI); PLAYER.pose = null;
  const shot = fixed(V(14.2, 1.45, 3.4), V(12.7, 1.05, 1.6), 40, 0.012);
  G.setShot(shot);
  await wait(0.5);
  f.classList.remove('on'); wait(1.8).then(() => { f.style.transition = ''; f.style.background = ''; });
  await G.UI.card(['Elsewhere.'], { hold: 2.2 });
  await N('(For a little while, you are her.)', K());
  await N('(Morning, in the kitchen. Pancakes. He is at the stove, and he is getting every one of them perfectly round.)', K());
  PLAYER.yaw = 0.2;
  await Y('Good morning, Partner. It is the first snow. We met at the lantern fair, when we were seven.', K());
  await Y('You were sitting on a log. There were three trees. The scarf was red. I said “Are you lost?”', K());
  await N('(Every word of it right, as far as anyone could check. Said in the order you would put things in a list.)', K());
  const c = await choose(['“That’s right.”', '“How do you know that?”', 'Say nothing, and smile']);
  if (c === 0) { await Y('Yes. It is right.', K()); await N('(He has never once in his life been sure about the night you met. Neither have you. That was the whole point of it.)', K()); }
  else if (c === 1) { await Y('I remember it. I remember all of it. Don’t you?', K()); await N('(No. And until now you thought that was something the two of you shared.)', K()); }
  else { await N('(You smile. He smiles back, a second later, exactly the same width.)', K()); }
  await Y('Here. Your pancake. It is the best one.', K());
  await N('(It is. It is perfect. You have never wanted anything less.)', K());
  await N('(You need to leave him something. Something the real one would understand, and this one wouldn’t.)', K());
  const s = await choose(['Line the pinecones up along the windowsill', 'Take one enormous bite out of half a pancake', 'A note on the fridge']);
  S.flags.sign = ['pinecones', 'pancake', 'note'][s];
  if (s === 0) await N('(Seven pinecones, in a row, biggest to smallest, along the sill. The contest from this morning. He won it, and you said you let him.)', K());
  else if (s === 1) await N('(Half a pancake, one enormous bite out of it, left on his plate. You have stolen half his pancake every snow day for years.)', K());
  else await N('(A note under the lemon magnet: “If it’s sure about the night we met, it isn’t me.”)', K());
  await Y('Where are you going, Partner?', K());
  await P('Out. To look at the snow.', K());
  await Y('It will be exactly the same snow tomorrow.', K());
  await N('(That is what frightens you most.)', K());
  // Out into the snow to find him.
  f.style.background = '#ffffff'; f.style.transition = 'opacity 2.2s'; f.classList.add('on'); await wait(2.4);
  G.post.grade.uniforms.uMem.value = 0;
  addBond(0.5); addScrap('night', 'A door in the kitchen wall. Summer through the gap. Something left behind for the real one to find.');
  await G.UI.card(['Act IV · The Same Day', 'To be continued.'], { hold: 3.2 });
  f.classList.remove('on'); f.style.transition = ''; f.style.background = '';
  STATE.nightDone = true;
  G.showEndcard();
}
});
