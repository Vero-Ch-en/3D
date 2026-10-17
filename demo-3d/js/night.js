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
  // the light she left on in the kitchen, turned right down
  for (const L of G.LAMPS) {
    if (L.power0 == null) L.power0 = L.power;
    const p = L.g.getWorldPosition(new THREE.Vector3());
    if (p.x > 12.5 && p.x < 13.5 && p.y > 1.5) { L.on = true; L.power = 1.1; }
  }
  NIGHT.door.visible = false; NIGHT.done = new Set(); NIGHT.odd = 0;
  Object.assign(S.flags, { doorOpen: false, nightUp: false, nightFound: false, nightBed: false });
  STATE.bounds = { zMin: -5, zMax: 4.3 };     // nobody is going out tonight
  G.lieDown(PLAYER, B().L, -0.14, 0.15, 0.35);
  // She's up: in the kitchen, at the window, in the dark.
  G.standAt(PARTNER, 13.0, 3.7, 0); PARTNER.mode = 'still'; PARTNER.stillLook = { x: 13.0, z: 8, headY: 1.5 };
  STATE.sceneShot = true; G.setShot(bedShot());
  await wait(0.4);
  f.style.transition = 'opacity 2.6s'; f.classList.remove('on'); wait(2.8).then(() => { f.style.transition = ''; f.style.background = ''; });
  await G.UI.act('III', 'Recognition', { white: false });
  G.setShot(bedClose(), false);
  await N('(You wake up cold. The blanket is all on your side, which has never once happened.)', K());
  await N('(Her side is empty. There’s a light on in the kitchen.)', K());
  G.cutTo(() => { G.standAt(PLAYER, B().L - 0.6, 0.2, Math.PI / 2); G.releaseCamera(); G.CAM.cut = true; }, 0.4);
  await wait(0.6);
  STATE.sceneShot = false; STATE.busy = false; S.flags.nightUp = true;
  S.flags.noTogether = true; S.flags.noBarks = true;
  G.hint('There’s a light on in the kitchen.', 6);
};

/* ---------- finding her, and the night up together ---------- */
const nightUp = () => night() && S.flags.nightUp && !S.flags.doorOpen && !S.flags.nightBed;
inter('nHer', [13.0, 1.2, 3.55], 1.3, 'Partner', async () => {
  if (!S.flags.nightFound) {
    S.flags.nightFound = true;
    G.gaze(PARTNER, [PLAYER.x, PLAYER.y + 1.6, PLAYER.z], 4); PARTNER.stillLook = null; PARTNER.lookAt = null;
    await P('Oh. Hello. Couldn’t sleep either?');
    const c = await choose(['“You stole the whole blanket. Then left it.”', '“Midnight snack, is it?”', '“Come back to bed.”']);
    if (c === 0) { await P('I gave it to you. As a present. You looked cold.'); await Y('That’s not how it works. You steal it; I complain.'); await P('Yes. Sorry. Next time I’ll steal it properly.'); await N('(She laughs, a moment after you’d expect.)'); NIGHT.odd++; }
    else if (c === 1) { await P('I was thinking about it. I was mostly looking at the snow.'); await Y('Mostly.'); await P('Mostly.'); }
    else { await P('In a little while. Since we’re both up.'); }
  }
  await nightMenu();
}, nightUp);

async function nightMenu() {
  const all = [['cocoa', 'Make some cocoa'], ['fire', 'Sit by what’s left of the fire'], ['seat', 'Watch the snow from the window seat'], ['cake', 'Raid the fridge for the last of the cake']];
  const left = all.filter(([id]) => !NIGHT.done.has(id));
  const opts = left.map((o) => o[1]).concat(NIGHT.done.size ? ['Go back to bed'] : []);
  if (NIGHT.done.size === 0) await P('Since we’re up. What shall we do?');
  else if (NIGHT.done.size >= 2) { await P('It’s very late, Partner.'); return toBed(); }
  else await P('One more thing? Then bed.');
  const c = await choose(opts);
  if (c >= left.length) return toBed();
  const id = left[c][0]; NIGHT.done.add(id);
  await ({ cocoa, fire, seat, cake })[id]();
  return nightMenu();
}
const two = (px, pz, qx, qz, pyaw, qyaw) => G.cutTo(() => { G.standAt(PLAYER, px, pz, pyaw); G.standAt(PARTNER, qx, qz, qyaw); PARTNER.mode = 'still'; }, 0.35);
async function cocoa() {
  const K2 = G.KITCHEN || {}, kx = (K2.stove && K2.stove.x) || 12.35;
  await two(kx - 0.35, -1.25, kx + 0.4, -1.2, Math.PI + 0.2, Math.PI - 0.3);
  const shot = fixed(V(kx + 0.1, 1.55, 0.2), V(kx, 1.0, -1.5), 42, 0.012);
  await N('(Milk in the little pan, the hob ticking, the window black and full of snow.)', { shot });
  await P('How many sugars?', { shot });
  const c = await choose(['“Two.”', '“One, and a second one that doesn’t count.”', '“None. I’m sweet enough.”']);
  if (c === 0) { await P('One. And a second one that doesn’t count.', { shot }); await N('(Exactly how she said it this morning. Exactly.)', { shot }); NIGHT.odd++; }
  else if (c === 1) { await P('That’s my line.', { shot }); await Y('I know. I’m stealing it.', { shot }); await P('That’s fair. You can have it.', { shot }); await N('(She never gives anything up without a fight. Not even a line.)', { shot }); NIGHT.odd++; }
  else { await P('That’s not true, Partner. You’re an ordinary amount of sweet.', { shot }); }
  const t = await choose(['“Toast with it?”', '“Don’t burn it this time.”', 'Just stir']);
  if (t === 0) { await P('The toaster? Of course. It works perfectly well.', { shot }); await N('(You have never, in all your years in this house, heard her say a single word about the toaster.)', { shot }); NIGHT.odd++; }
  else if (t === 1) { await P('I won’t.', { shot }); await N('(She doesn’t. Not even a little at the bottom, the way she always does and always blames on the pan.)', { shot }); }
  else await N('(You stir. She watches the spoon go round as if she were learning how.)', { shot });
  await N('(It’s good cocoa. It’s exactly right.)', { shot });
}
async function fire() {
  const S0 = G.SOFA;
  await G.cutTo(() => {
    for (const [c, x] of [[PLAYER, S0.x + 0.35], [PARTNER, S0.x - 0.25]]) { c.x = x; c.z = S0.z - 0.08; c.y = c.yFloor = 0; c.yaw = Math.PI; c.seatY = S0.seatY; c.sitTarget = 1; c.sit = 1; c.speed = 0; }
    PARTNER.mode = 'seated';
  }, 0.35);
  const shot = fixed(V(S0.x - 1.1, 1.2, S0.z - 1.6), V(S0.x, 0.95, S0.z), 36, 0.012);
  G.FIRE.level = 0.5;
  await N('(The fire is down to a red glow. You put one more log on, mostly for the company.)', { shot });
  await Y('Today was a good day.', { shot });
  await P('It was a perfect day.', { shot });
  const c = await choose(['“You let me win the pinecones, you said.”', '“Who got to the bench first? Honestly.”', '“Same time next year?”']);
  if (c === 0) { await P('Did I? You won by two. Eleven to nine.', { shot }); await N('(She has never once remembered a score. She once argued for an hour that you’d played to fifty.)', { shot }); NIGHT.odd++; }
  else if (c === 1) { await P('You did. I was three steps behind you.', { shot }); await Y('You always say you won.', { shot }); await P('Do I? Then I won.', { shot }); await N('(She says it as if she were filling in a form.)', { shot }); NIGHT.odd++; }
  else { await P('Exactly the same time. Exactly the same day.', { shot }); }
  await N('(She leans her head on your shoulder. It’s the right weight. You keep very still anyway.)', { shot });
  await G.cutTo(() => { for (const c of [PLAYER, PARTNER]) { c.sitTarget = c.sit = 0; } G.standAt(PLAYER, S0.x + 1.55, S0.z - 0.1, -Math.PI / 2); G.standAt(PARTNER, S0.x - 1.55, S0.z - 0.1, Math.PI / 2); PARTNER.mode = 'still'; }, 0.3);
  G.FIRE.level = 0.35;
}
async function seat() {
  const Nk = G.NOOK;
  await G.cutTo(() => { G.sitAt(PLAYER, Nk.x + 0.35, Nk.z, 0, Nk.seatY); G.sitAt(PARTNER, Nk.x - 0.35, Nk.z, 0, Nk.seatY); PARTNER.mode = 'seated'; }, 0.35);
  const shot = fixed(V(Nk.x + 0.2, 1.35, Nk.z + 2.0), V(Nk.x, 0.95, Nk.z), 38, 0.012);
  await N('(Snow going past the window behind you, slow and fat and silent. The house ticks.)', { shot });
  await P('Do you think we’re the same people we were when we were children?', { shot });
  const c = await choose(['“You asked me that on the hill today.”', '“I hope not. I was terrible at whistling.”', '“Mostly. Taller.”']);
  if (c === 0) { await P('Did I? And what did you say?', { shot }); await Y('You don’t remember?', { shot }); await P('I remember everything, Partner.', { shot }); await N('(She says it fondly. It isn’t a joke.)', { shot }); NIGHT.odd++; }
  else if (c === 1) { await P('You were perfect at whistling. Three notes. Like this.', { shot }); await wait(Math.min(1.6, G.Audio.whistle(1.12) + 0.2)); await N('(Perfectly in tune. She has never once whistled it in tune.)', { shot }); NIGHT.odd++; }
  else { await P('Yes. Exactly the same, only taller. Nothing has changed at all.', { shot }); }
  await N('(Outside, the snow keeps coming down, all of it at exactly the same speed.)', { shot });
  await G.cutTo(() => { for (const c of [PLAYER, PARTNER]) { c.sitTarget = c.sit = 0; } G.standAt(PLAYER, Nk.x + 0.4, Nk.z + 0.9, Math.PI); G.standAt(PARTNER, Nk.x - 0.4, Nk.z + 0.9, Math.PI); PARTNER.mode = 'still'; }, 0.3);
}
async function cake() {
  const K2 = G.KITCHEN || {}, tb = K2.table || { x: 13.0, z: 2.95 };
  await G.cutTo(() => { G.sitAt(PLAYER, 13.3, 3.58, Math.PI, 0.49); G.sitAt(PARTNER, 13.0, 2.3, 0, 0.49); PARTNER.mode = 'seated'; }, 0.35);
  const shot = fixed(V(tb.x + 1.6, 1.35, tb.z + 0.4), V(tb.x, 0.9, tb.z), 40, 0.012);
  await N('(The last of the cake, two forks, the fridge door left open for the light.)', { shot });
  const c = await choose(['Steal the bit with the most icing', '“Half each. You check.”', '“You have it. It was your cake.”']);
  if (c === 0) { await P('Have it. You like that bit.', { shot }); await N('(She lets you. She has never once let you.)', { shot }); NIGHT.odd++; }
  else if (c === 1) { await N('(At the fair she checked the chestnuts were split exactly in half. You wait for her to check.)', { shot }); await P('It’s exactly half. I can tell.', { shot }); await N('(She doesn’t look.)', { shot }); NIGHT.odd++; }
  else { await P('Thank you, Partner.', { shot }); await N('(She eats it neatly, in exactly the same size bites.)', { shot }); }
  await N('(When you stand up, she pushes her chair in. Square to the table.)', { shot });
  await G.cutTo(() => { for (const c of [PLAYER, PARTNER]) { c.sitTarget = c.sit = 0; } G.standAt(PLAYER, 12.6, 3.9, Math.PI); G.standAt(PARTNER, 13.4, 3.9, Math.PI); PARTNER.mode = 'still'; }, 0.3);
}
// Back to bed. She lies down exactly on her side. Then, from the kitchen: three notes.
async function toBed() {
  S.flags.nightBed = true;
  await G.cutTo(() => {
    G.lieDown(PLAYER, B().L, -0.14, 0.15, 0.35);
    G.lieDown(PARTNER, B().R, -0.40, 0, 0); PARTNER.mode = 'lying'; PARTNER.lidsClosed = false;
    for (const L of G.LAMPS) if (L.power0 != null && L.on) L.on = false;
    G.setShot(bedClose());
  }, 0.6);
  STATE.sceneShot = true;
  await N('(She lies down exactly on her side of the bed. Not an inch over.)', K());
  await P('Goodnight, Partner. Sleep well. Goodnight.', K());
  PARTNER.lidsClosed = true;
  await wait(1.6);
  await N(NIGHT.odd >= 3 ? '(You lie awake a long time, adding things up.)' : '(You lie awake a little while. It was a lovely night. Wasn’t it?)', K());
  await wait(1.2);
  await N('(Then, very faint, from the kitchen: three notes. Whistled the way only one person in the world whistles them, slightly flat on the last one.)', K());
  await wait(Math.min(1.8, G.Audio.whistle(1.12, 0.6) + 0.3));
  await N('(Beside you, she doesn’t stir. Her breathing is very slow, and very even.)', K());
  NIGHT.door.visible = true;
  G.cutTo(() => { G.standAt(PLAYER, B().L - 0.6, 0.2, Math.PI / 2); G.releaseCamera(); G.CAM.cut = true; }, 0.4);
  await wait(0.6);
  STATE.sceneShot = false;
  G.hint('The whistle came from the kitchen.', 6);
}
// The front door won't open tonight.
{ const fd = findInter('frontdoor'), orig = fd && fd.raw; if (fd) rewire('frontdoor', async () => { if (night() && !S.flags.doorOpen) { await N('(It won’t open. It isn’t locked. It just won’t.)'); return; } return orig(); }); }

/* ---------- the door, and Elsewhere ---------- */
inter('nDoor', [14.6, 1, 2.45], 0.9, 'The door', async () => {
  await N('(A door in the kitchen wall, between the fridge and the study. It has never been there. It is standing a little open, and through the gap it is summer: warm air, cut grass, crickets.)');
  await N('(And somewhere out there, three notes again. Slightly flat on the last one.)');
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
