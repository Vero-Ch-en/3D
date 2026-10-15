'use strict';
/* =========================================================================
 * Story, Act I ("Shared Life"), ported from the 2D game:
 * prologue (the lantern fair, as children) → a snowed-in morning in the
 * cabin → (the walk: next stage) → the evening at home.
 * Also: hidden relationship values, memories, the scrapbook, checkpoints,
 * the house's small interactions, Partner's own habits and Together.
 * ========================================================================= */
// Runs once the world is built (boot waits for any real assets first; see assets.js).
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const P = (t, o) => G.say('partner', t, o);
const Y = (t, o) => G.say('player', t, o);
const N = (t, o) => G.say(null, t, o);
const choose = (o) => G.UI.choose(o);
const wait = (s) => G.wait(s);
const until = (f) => G.until(f);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const near = (r = 6) => dist() < r && !PARTNER.hidden;

/* ---------- state: what the two of you have done, and how it's going ---------- */
const fresh = () => ({
  chapter: null,
  vars: { bond: 0, trust: 0, rivalry: 0, fear: 0 },
  mem: { hugs: 0, holds: 0, teases: 0, kisses: 0, fridge: 0, foodStolen: 0, foodShared: 0, snacks: 0, sitBeside: 0, sitAcross: 0, affection: 0, partnerInit: 0 },
  flags: {}, scrap: [], talked: {}, n: {}, reacted: {},
});
const S = (G.S = fresh());
const addBond = (v) => { S.vars.bond = Math.min(12, S.vars.bond + v); };
const addRivalry = (v) => { S.vars.rivalry = Math.min(12, S.vars.rivalry + v); };
const addScrap = (art, caption) => { if (!S.scrap.some((p) => p.art === art)) S.scrap.push({ art, caption }); };
// Successive lines for repeated interactions; the last one repeats.
const cyc = (id, lines) => { S.n[id] = (S.n[id] || 0) + 1; return lines[Math.min(S.n[id] - 1, lines.length - 1)]; };

const SAVE_KEY = 'cbs.base.save';
function checkpoint(chapter) {
  S.chapter = chapter;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, chapter, vars: S.vars, mem: S.mem, scrap: S.scrap, talked: S.talked, flags: { pancakeQuality: S.flags.pancakeQuality, teaMade: S.flags.teaMade } })); } catch (e) { /* private mode */ }
}
function loadSave() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); return d && d.v === 1 && CH[d.chapter] ? d : null; } catch (e) { return null; } }
if (loadSave()) G.$('continue').hidden = false;

/* ---------- house state: lamps, fire, cake, breakfast, the bed ---------- */
const K = () => G.KITCHEN;
function setLamps(on) { G.LAMPS.forEach((L) => { L.on = on; }); }
// Hide the cake's meshes, never its group: the candle light inside it must stay in the scene, or every
// lit material recompiles for the new light count (a long stall).
function setCake(show, lit = show) { G.CAKE.shown = show; G.CAKE.g.children.forEach((o) => { if (!o.isLight) o.visible = show; }); G.CAKE.lit = lit; }
function setBreakfast(o = {}) {
  const k = K();
  k.mugs.forEach((m) => { m.visible = !!o.mugs; });
  k.plates.forEach((pl, i) => {
    const show = !!o.plates && (i === 0 || i === (o.seat === 'C' ? 2 : 1));
    pl.g.visible = show;
    pl.stack.forEach((c, j) => { c.material = o.burnt && j === 0 ? pl.burntMat : pl.cakeMat; c.visible = !(o.bite && i !== 0 && j === 2); });
  });
}
function houseFor(chapter) {
  if (G.Audio.radioOn && G.Audio.radioOn()) G.Audio.radio(false);
  if (K().radioDial) K().radioDial.material.opacity = 0;
  for (const id of ['kettle', 'mug0', 'mug1', 'pan', 'plate0', 'plate1']) G.steam(id, 0, 0, 0, { off: true });
  if (chapter === 'morning') {
    setLamps(false); G.FIRE.on = false; setCake(false); setBreakfast({});
    G.bedMade(false); G.shapeBed({ L: true, R: true });
    STATE.autonomy = false;
  } else {
    setLamps(true); G.FIRE.on = true; setCake(true); setBreakfast({});
    G.bedMade(true); STATE.autonomy = false;
  }
}

/* ---------- a small fair: lanterns on strings and two stalls, for the prologue ---------- */
const FAIR = { meshes: [], spots: [] };
(function buildFair() {
  const W = G.world, glow = new THREE.MeshBasicMaterial({ map: G.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
  const cols = ['#ffb35a', '#ff8a4a', '#ffd9a0', '#ff6a5a'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const wire = G.std({ color: '#2a2420', roughness: 0.8 });
  const add = (m) => { m.userData.dynamic = true; W.add(m); FAIR.meshes.push(m); return m; };
  const poles = [[1.5, 17.2], [5.2, 18.4], [8.8, 18.2], [12.2, 17.0]];
  for (const [x, z] of poles) { const y = G.terrainH(x, z); const m = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.1, 8), G.std({ map: G.TX.bark, color: '#6a4a36', roughness: 0.9 }))); m.position.set(x, y + 1.55, z); m.castShadow = true; }
  const lanG = new THREE.SphereGeometry(0.13, 12, 8), glowG = new THREE.PlaneGeometry(1.1, 1.1);
  for (let i = 0; i < poles.length - 1; i++) {
    const [ax, az] = poles[i], [bx, bz] = poles[i + 1], ay = G.terrainH(ax, az) + 2.95, by = G.terrainH(bx, bz) + 2.95;
    const n = 7;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 0.55;
      if (k > 0 && k < n) {
        const l = add(new THREE.Mesh(lanG, cols[(i * 3 + k) % cols.length])); l.position.set(x, y - 0.14, z); l.scale.set(1, 1.25, 1);
        const g = add(new THREE.Mesh(glowG, glow)); g.position.set(x, y - 0.14, z); g.userData.billboard = true;
        if (k === 3) FAIR.spots.push({ x, y: y - 0.3, z, i: 5, color: '#ffa860' });
      }
      if (k < n) { const x2 = ax + (bx - ax) * (k + 1) / n, z2 = az + (bz - az) * (k + 1) / n, y2 = ay + (by - ay) * (k + 1) / n - Math.sin((k + 1) / n * Math.PI) * 0.55; const len = Math.hypot(x2 - x, y2 - y, z2 - z); const w = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 4), wire)); w.position.set((x + x2) / 2, (y + y2) / 2, (z + z2) / 2); w.lookAt(x2, y2, z2); w.rotateX(Math.PI / 2); }
    }
  }
  // Two stalls with striped awnings.
  const stripe = G.canvasTex(0, null, { w: 128, h: 32, draw: (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#efe4d0' : '#b5413a'; c.fillRect(i * w / 8, 0, w / 8, h); } } });
  const awnM = G.std({ map: stripe, roughness: 0.9 }), woodM = G.std({ map: G.TX.boards, color: '#7a5a42', roughness: 0.8 });
  for (const [x, z, ry] of [[2.6, 16.2, 0.25], [10.6, 16.0, -0.2]]) {
    const y = G.terrainH(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.userData.dynamic = true; W.add(g);
    const part = (geo, mat, px, py, pz, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.x = rx; m.castShadow = true; m.receiveShadow = true; g.add(m); FAIR.meshes.push(m); return m; };
    part(new THREE.BoxGeometry(1.8, 0.9, 0.7), woodM, 0, 0.45, 0);
    for (const sx of [-0.85, 0.85]) part(new THREE.BoxGeometry(0.07, 2.2, 0.07), woodM, sx, 1.1, -0.3);
    part(new THREE.BoxGeometry(2.0, 0.04, 1.0), awnM, 0, 2.15, 0.1, 0.35);
    part(new THREE.BoxGeometry(1.7, 0.08, 0.6), G.std({ color: '#f3f6fb', roughness: 0.75, env: 0.7 }), 0, 0.94, 0);
    for (let k = 0; k < 3; k++) { const l = part(lanG, cols[k], -0.6 + k * 0.6, 1.85, 0.32); l.scale.setScalar(0.8); }
  }
  // The log at the end of the path, where somebody small has wandered off to sit.
  const lx = 6.0, lz = 34.4, ly = G.terrainH(lx, lz);
  const log = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.5, 12), G.std({ map: G.TX.bark, color: '#7a5a46', roughness: 1 }))); log.rotation.z = Math.PI / 2; log.rotation.y = 0.15; log.position.set(lx, ly + 0.12, lz); log.castShadow = log.receiveShadow = true;
  const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.3, 10), G.MAT.snow)); cap.rotation.z = Math.PI / 2; cap.rotation.y = 0.15; cap.scale.set(1, 1, 0.45); cap.position.set(lx - 0.2, ly + 0.27, lz - 0.02);
  FAIR.log = { x: lx + 0.25, z: lz - 0.02, seatY: ly + 0.31 };
  FAIR.meshes.forEach((m) => { m.visible = false; });
  G.updateLanterns = () => { if (!FAIR.on) return; for (const m of FAIR.meshes) if (m.userData.billboard) m.quaternion.copy(G.camera.quaternion); };
})();
function showFair(on) { FAIR.on = on; FAIR.meshes.forEach((m) => { m.visible = on; }); STATE.lightSpots = on ? FAIR.spots.slice(0, 2) : null; }

/* =====================================================================
 * Interactions around the house
 * ===================================================================== */
const ch = () => S.chapter;
const morning = () => ch() === 'morning';
const findInter = (id) => G.INTER.find((i) => i.id === id);
// Which room someone is in, so Partner only answers what she could actually hear or see.
const room = (x, z) => (G.inside(x, z) ? (x < 5 ? 'bedroom' : x < 11 ? 'living' : 'kitchen') : G.onDeck(x, z) ? 'porch' : 'outside');
const hereRoom = () => room(PLAYER.x, PLAYER.z);
const sameRoom = () => hereRoom() === room(PARTNER.x, PARTNER.z);
const canHear = () => !PARTNER.hidden && !PARTNER.script && !PARTNER.slide && (sameRoom() ? dist() < 7.5 : dist() < 3.2);
// Interactions that talk take the scene; the player can't walk off mid-sentence. Afterwards Partner may react.
async function run(fn, id) {
  if (STATE.busy) return;
  STATE.busy = true; S.pSpoke = false;
  try { await fn(); } catch (e) { console.error(e); }
  STATE.busy = false;
  if (id) { S.lastUse = { id, t: G.simT, room: hereRoom() }; react(id); const it = findInter(id); if (it && canHear() && !PARTNER.task) G.gaze(PARTNER, it.pos, 2.4); }
}
const inter = (id, pos, r, label, act, when) => G.INTER.push({ id, pos, r, label, act: () => run(act, id), when });
const rewire = (id, act) => { const it = findInter(id); it.act = () => run(act, id); return it; };
const Pt = (t, o) => { S.pSpoke = true; return P(t, o); };   // Partner speaking inside an interaction

/* ---------- Partner reacts to what you're doing, if she's within earshot ----------
 * lines: when she's up and about; drowsy: from bed (bedroom only); each object reacts on first use,
 * then now and then. Barks don't stop you moving. */
const REACT = {
  bed: { lines: ['If you make that bed, I shall only unmake it tonight.', 'Leave the dent on my side. I’m attached to it.'], drowsy: ['Mm. Come back.', 'You’re letting the cold in, Partner.'] },
  wardrobe: { lines: ['If you’re looking for your grey jumper, I’m very probably wearing it.', 'The one shoe is important. I won’t explain.'], drowsy: ['Wear the grey one. No. Wait. I have the grey one.', 'Not the wedding jumper. Please.'] },
  chest: { lines: ['Be gentle with Kevin. He’s had a hard winter.', 'Kevin is lukewarm by design, Partner.'], drowsy: ['Is that Kevin? Bring him here.'] },
  bwin: { lines: ['Is Gerald there? Do say good morning from me.', 'He’s been on that sill since autumn. I think he pays rent in feathers.'], drowsy: ['Tell Gerald I’m asleep.', 'Is it still snowing? Don’t tell me. Yes, tell me.'] },
  wwin: { lines: ['The trees look very pleased with themselves this morning.', 'It snowed all night. I heard it. Well. I imagined I heard it.'], drowsy: ['Close the curtain. Or don’t. I can’t decide.'] },
  photos: { lines: ['I still say the lake one is cursed.', 'We should take a new one today. A good one. On purpose.'], drowsy: ['The lake one is cursed. Mm.'] },
  lampL: { lines: [], drowsy: ['Too bright, Partner. Far too bright.', 'Mood lighting. Very bold for this hour.'] },
  lampR: { lines: [], drowsy: ['That is my lamp. I can feel it from here.'] },
  fire: { lines: ['There. Now it feels like a proper morning.', 'I do love watching you be competent at things.'] },
  clock: { lines: ['Leave it fast, please. It’s the only reason we’re ever on time.', 'Four minutes fast. Like you, at breakfast.'], drowsy: ['What time is it? No. Don’t tell me.'] },
  basil: { lines: ['Thank you for looking after my son.', 'Basil says thank you. Basil is very shy about it.'] },
  scrap: { lines: ['We need more pages, I think.', 'Please skip the lake page. I’m begging you, Partner.', 'Is that my handwriting? It’s dreadful.'] },
  shelf2: { lines: ['Six copies. And neither of us has made a single recipe.', 'The pine candle is for emergencies. Don’t light it on a whim.'] },
  lwin: { lines: ['Any good clouds?', 'If it’s a pancake-shaped cloud, I saw it first.'] },
  coats: { lines: ['That scarf is yours. It has always been yours.', 'The scarf is not mine, Partner, and I won’t hear otherwise.'] },
  cushion: { lines: ['That is a private collection.', 'Please put my stash back exactly as you found it.'] },
  armchair: { lines: ['That blanket and I have an understanding.', 'Your chair. My blanket. A fair arrangement.'] },
  ctable: { lines: ['I’ll clear those. Eventually. In a broad sense.', 'The spoon mug is mine. I was making a point.'] },
  kettle: { lines: ['Is one of those for me? Say it is.', 'Two sugars, please. And not a word to anyone.'] },
  ksink: { lines: ['The spoon is innocent. I was testing the honey.', 'Leave the washing up. It’s a snow day. I’ll do it. Later.'] },
  toaster: { lines: ['Not the toaster. We agreed. After last time.', 'The toaster and I are no longer speaking.'] },
  fridge: { lines: ['Anything new in there?', 'The lemon is mine. I have plans for it.', 'Please close the door, Partner. You’re heating the snow.'] },
  ktable: { lines: ['Don’t open the card. It says “not yet”. That means you.', 'I tidied that table. Briefly.'] },
  kwin: { lines: ['Did you see the heart on the rail? I didn’t draw it. I drew it.', 'It looks like the whole world has been tidied away.'] },
  ewin: { lines: ['Nothing to see over there. Look somewhere else. Lovely snow, isn’t it?', 'Why are you looking at the study? Look at the sky.'] },
  study: { lines: ['No. Absolutely not. Kindly step away from the door.', 'It says “private”, Partner. In my best handwriting.'] },
  cupboard: { lines: ['Hands where I can see them, please.', 'Every biscuit in there is accounted for.'] },
  bench: { lines: ['It’s far too cold to sit out here before dark.', 'Later. When the stars are out. I promise.'] },
};
let reactT = -99;
function react(id) {
  const R = REACT[id];
  if (!R || S.pSpoke || S.flags.noBarks) return;
  const asleep = PARTNER.lie;
  if (asleep ? hereRoom() !== 'bedroom' : !canHear()) return;
  const pool = asleep ? R.drowsy : R.lines;
  if (!pool || !pool.length) return;
  const first = !S.reacted[id];
  if (!first && (G.simT - reactT < 8 || Math.random() > 0.45)) return;
  S.reacted[id] = (S.reacted[id] || 0) + 1;
  reactT = G.simT;
  const line = pool[(S.reacted[id] - 1) % pool.length];
  G.bark(line, 2.2 + line.length / 22);
}

// Bedroom
inter('bed', [2.4, 0.5, 2.55], 1.25, () => (morning() && PARTNER.lie ? 'Lie back down' : 'Bed'), async () => {
  if (morning() && PARTNER.lie) { await Story.morningCuddle(); S.pSpoke = true; return; }
  await N(cyc('bed', ['(The bed. Her side and your side exist in theory. In practice, it is all her side.)', '(You straighten the duvet. It will not survive the night.)', '(Not yet. There’s too much day left.)']));
});
inter('wardrobe', [4.3, 1, 1.05], 0.9, 'Wardrobe', () => N(cyc('wardrobe', ['(Your grey jumper should be in here. It is not. It is in {P}’s possession now, permanently.)', '(Half the hangers are empty. The other half hold jumpers neither of you has worn since a wedding.)', '(A shoebox labelled “IMPORTANT”. It contains one shoe.)'])));
inter('chest', [3.6, 0.5, 3.6], 0.8, 'Blanket chest', () => N(cyc('chest', ['(Spare blankets, and a hot-water bottle shaped like a sheep. His name is Kevin, apparently.)', '(Kevin the sheep is lukewarm, and somehow disapproving.)'])));
inter('bwin', [2.4, 1.3, 4.05], 0.9, 'Window', async () => {
  if (!morning()) return N('(Snow, blue in the dark, all the way to the trees.)');
  await N(cyc('bwin', ['(Morning. A round little bullfinch is regarding you from the sill.)', '(The bullfinch remains. So does its opinion of you.)']));
  if (S.n.bwin === 1 && canHear() && !PARTNER.lie) await Pt('That’s Gerald. He isn’t judging you. That’s simply his face.');
});
inter('wwin', [0.6, 1.3, 2.25], 0.9, 'Window', () => N(morning() ? cyc('wwin', ['(The pines are still holding last night’s snow, very carefully, as if it might break.)', '(A clump of snow slides off a branch. The tree looks relieved.)']) : '(The trees, and the dark between them.)'));
rewire('clock', () => N(cyc('clock', ['(The clock is four minutes fast. It has been four minutes fast for as long as anyone can remember. Nobody fixes it.)', '(Tick. Tock. Four minutes ahead of the rest of the world, and perfectly content.)'])));
rewire('photos', () => N('(Six polaroids on a string. The lake. The fire. The night you both got lost and didn’t mind.)'));
for (const id of ['lampL', 'lampR']) { const it = findInter(id); const was = it.act; it.act = () => { was(); S.lastUse = { id, t: G.simT, room: hereRoom() }; react(id); }; }
// Living room
const fire = rewire('fire', async () => {
  if (G.FIRE.on) { await N(cyc('fireOn', ['(Warm. The kind of warm that gets into your sleeves.)', '(You add a log. The fire approves.)'])); return; }
  G.FIRE.on = true; G.Audio.blow();
  await N('(It takes three matches and a certain amount of quiet swearing.)');
  if (canHear()) await Pt('The fire person, at work. My hero, Partner.');
});
fire.label = () => (G.FIRE.on ? 'Fireplace' : 'Light the fire');
const sofa = findInter('sofa');
sofa.label = () => (ch() === 'evening' ? (STATE.cuddled ? 'Sofa' : 'Curl up together') : 'Sit');
sofa.act = () => { if (ch() === 'evening') return G.Story.cuddle(); return run(sitSofa, 'sofa'); };
const cake = findInter('cake');
cake.when = () => G.CAKE.shown !== false;
inter('ctable', [8, 0.5, 1.85], 1.0, 'Coffee table', () => N(cyc('ctable', ['(Two mugs from last night. One has a lipstick mark; the other has a spoon standing upright in it.)', '(The coaster is a beer mat from somewhere neither of you has ever been.)'])), () => G.CAKE.shown === false);
const scrapShelf = rewire('shelf6.15', () => G.UI.scrapbook(S.scrap));
scrapShelf.label = 'Scrapbook';
REACT['shelf6.15'] = REACT.scrap;
rewire('shelf10.72', () => N(cyc('shelf2', ['(Six copies of the same cookbook. Nobody knows how.)', '(Paperbacks with cracked spines, a jar of sea glass, and a candle that smells of pine.)'])));
REACT['shelf10.72'] = REACT.shelf2;
inter('basil', [10.4, 0.8, 4.2], 0.85, 'Basil', async () => {
  await N(cyc('basil', ['(Basil. Not basil. {P} named him Basil to confuse guests.)', '(You water Basil. Basil remains indifferent.)', '(Basil has a new leaf. You decide not to make a fuss about it.)']));
  if (S.n.basil === 2) S.flags.waterBasil = 1;
});
inter('lwin', [9.4, 1.3, 4.05], 0.9, 'Window', () => N(morning() ? cyc('lwin', ['(A cloud shaped like a cat. Or a pancake.)', '(A cloud shaped like a pancake. Definitely a pancake.)']) : '(The porch lights, and the snow coming down through them.)'));
inter('coats', [5.5, 1.3, 4.1], 0.8, 'Coats', () => N(cyc('coats', ['(Your coat. Her coat. And a scarf neither of you will claim. Grey? Blue? The light in here is bad.)', '(The unclaimed scarf. Each of you insists it belongs to the other.)'])));
inter('cushion', [9.2, 0.6, 2.5], 0.6, 'Under the cushions', async () => {
  const pancake = S.mem.foodStolen > 0 ? ' a bite of pancake (fresh),' : '';
  await N(`(Under the cushion: three of your socks, a pen, the remote for a radio you no longer own,${pancake} and half a biscuit.)`);
  if (!S.flags.stash) { S.flags.stash = 1; await N('(It’s her stash. Everything in it was taken from you. You decide to let it grow.)'); }
}, () => morning());
inter('armchair', [6.0, 0.6, 2.45], 0.75, 'Armchair', () => N(cyc('armchair', ['(The armchair. Technically yours. {P}’s blanket lives on it.)', '(The blanket smells of her. You fold it. Badly.)'])));
inter('frontdoor', [6.5, 1, 4.15], 0.8, 'Front door', async () => {
  if (morning()) {
    if (!S.flags.breakfastDone) { await N('(Breakfast first. Snow-day law, apparently.)'); if (canHear() && !PARTNER.lie) await Pt('Not without breakfast, Partner. I won’t allow it.'); return; }
    S.flags.leaveHouse = true; return;
  }
  return N('(The front door. Somebody has hung a sprig of pine on it.)');
});
// Kitchen
inter('kettle', [11.55, 1, 0.75], 0.75, () => (morning() && !S.flags.teaMade ? 'Make tea' : 'Kettle'), async () => {
  if (morning() && !S.flags.teaMade) {
    S.flags.teaMade = true;
    G.Audio.kettle(); G.steam('kettle', 11.65, 1.12, 0.36, { rate: 3, dur: 9 });
    await N('(You fill the kettle and take two mugs down. One for you. One for her: two sugars, which she will deny.)');
    setBreakfast({ mugs: true, plates: S.flags.pancakesMade, burnt: S.flags.pancakeQuality === 'burnt' });
    K().mugs.forEach((m, i) => G.steam('mug' + i, m.position.x, 0.86, m.position.z, { rate: 1.1, dur: 240, size: 0.55 }));
    return;
  }
  await N('(The kettle’s still warm.)');
});
inter('stove', [12.35, 1, 0.8], 0.7, () => (morning() && !S.flags.pancakesMade ? 'Make pancakes' : 'Stove'), async () => {
  if (morning() && !S.flags.pancakesMade) { await Story.makePancakes(); S.pSpoke = true; return; }
  await N(cyc('stove', ['(The pan is still a little warm from breakfast.)', '(You resist the urge to make more pancakes.)']));
});
inter('ksink', [13.05, 1, 0.8], 0.6, 'Sink', () => N(cyc('ksink', ['(Dishes from last night: two mugs, two forks, one suspiciously licked spoon.)', '(You wash the spoon. Some mysteries are better left clean.)'])));
inter('toaster', [13.48, 1, 0.75], 0.55, 'Toaster', () => N(cyc('toaster', ['(The toaster has two settings: “warm bread” and “house fire”.)', '(You leave the toaster alone. Today is not a house-fire day.)'])));
inter('fridge', [14.45, 1, 1.05], 0.75, 'Fridge', async () => {
  const n = ++S.mem.fridge;
  if (n === 1) { S.flags.knowsPancakes = true; return N('(Eggs. Milk. Butter. A sad lemon. Pancakes are possible.)'); }
  if (n === 2) return N('(Still eggs. Still milk. The lemon is still sad.)');
  if (n === 3) { if (canHear()) return Pt('It won’t grow new food if you keep checking, Partner.'); return N('(Cold air. Comforting, somehow.)'); }
  if (n === 5 && canHear()) return Pt('Are you waiting for it to say good morning? I could write it on something.');
  return N('(The fridge hums. It has nothing new to say.)');
});
inter('ktable', [13.0, 0.8, 2.95], 1.3, () => (morning() && S.flags.pancakesMade && !S.flags.breakfastDone ? 'Sit down for breakfast' : 'Kitchen table'), async () => {
  if (morning() && S.flags.pancakesMade && !S.flags.breakfastDone) { await Story.breakfast(); S.pSpoke = true; return; }
  await N(cyc('ktable', ['(The table. Mostly used for piling things on.)', '(A pile of post, a bowl of keys, and an envelope, face down, addressed to you. On the back, in her handwriting: “not yet”.)']));
});
inter('cupboard', [11.45, 1, 3.75], 0.7, 'Snack cupboard', async () => {
  await N('({P}’s snack cupboard. A note on the door: “Property of me. Not Partner’s.”)');
  if (S.flags.snackDone) return;
  const c = await choose(['Leave her a snack on the counter', 'Steal a biscuit', 'Close it']);
  if (c === 0) { S.flags.snackDone = 1; S.mem.snacks++; addBond(0.6); await N('(You leave a biscuit on the counter, on a folded napkin, like a small gift.)'); }
  if (c === 1) { S.flags.snackDone = 1; S.flags.stoleSnack = 1; addRivalry(0.5); await N('(Delicious. Illegal. Delicious.)'); if (canHear()) await Pt('I saw that, Partner. I see everything.'); }
});
inter('kwin', [13.0, 1.3, 4.05], 0.75, 'Window', () => N(morning() ? cyc('kwin', ['(The clearing, white and blue and perfectly still. Somebody has drawn a heart in the snow on the porch rail.)', '(The heart is still there. So is a smaller, crosser one beside it.)']) : '(Your reflection, and the snow behind it.)'));
inter('radio', [13.58, 1.0, 4.1], 0.7, () => (G.Audio.radioOn() ? 'Turn the radio off' : 'Turn the radio on'), async () => {
  const on = !G.Audio.radioOn();
  G.Audio.radio(on); K().radioDial.material.opacity = on ? 0.9 : 0;
  S.pSpoke = true;
  if (on && !S.flags.radioN) { S.flags.radioN = 1; await N('(The radio warms up with a hum, wanders through some static, and settles on something slow.)'); }
  if (canHear() && !PARTNER.lie) G.bark(on ? pick(['Oh, I love this one.', 'Leave it on. Please.', 'Is this an invitation, Partner?']) : pick(['Oh. I was enjoying that.', 'Spoilsport.']), 2.6);
});
inter('ewin', [14.6, 1.3, 2.1], 0.6, 'Window', () => N(cyc('ewin', ['(The study’s roof, sloping away under a fat roll of snow.)', '(The study’s little window has a curtain drawn across it. It didn’t yesterday.)'])));
inter('study', [14.6, 1, 3.85], 0.7, 'Study door', async () => {
  if (PARTNER.hidden) { G.bark(['Not now, Partner!', 'Private business. Please go away. Lovingly.', 'I can hear you breathing on the door.', 'The sign says “private”. I wrote it myself.'], 2.6); S.pSpoke = true; return; }
  await N(cyc('study', ['(Locked. A sign on it, in marker: “PRIVATE”.)', '(Still locked. Beneath the sign, smaller: “this means you, Partner”.)']));
});

/* ---------- Partner's own intentions (smart objects) ---------- */
G.SMART = [
  { id: 'sofa', spot: { x: 6.55, z: 2.95 }, seatAt: { x: 7.5, z: 2.95, yaw: Math.PI, y: 0.6 }, dur: [10, 18], lines: ['I’m claiming the sofa.', 'This sofa is mine now. Rent is one cushion a week.', '*settles in with great ceremony*'] },
  { id: 'lwin', spot: { x: 9.4, z: 4.08 }, yaw: 0, dur: [5, 8], look: { x: 9.4, y: 1.6, z: 8 }, lines: ['That cloud looks like you. Tall. Soft.', 'There’s a squirrel out there behaving very oddly about the snow.'] },
  { id: 'basil', spot: { x: 9.85, z: 3.72 }, yaw: 0.8, dur: [4, 7], look: { x: 10.4, y: 0.7, z: 4.2 }, lines: ['You’re doing wonderfully, Basil.', 'Don’t tell Partner, Basil, but you’re my favourite.'] },
  { id: 'books', spot: { x: 6.2, z: 0.95 }, yaw: Math.PI, dur: [5, 9], look: { x: 6.15, y: 1.2, z: 0.2 }, lines: ['I am reading this one. I have been reading it for a year.', 'Who owns six copies of the same cookbook? We do, apparently.'] },
  { id: 'fridge', spot: { x: 14.35, z: 1.22 }, yaw: Math.PI, dur: [3, 5], look: { x: 14.5, y: 1.1, z: 0.4 }, lines: ['*rustling* …nothing. I was looking at nothing.', '*takes a single grape*', 'We need cheese. Spiritually.'] },
  { id: 'study', spot: { x: 14.5, z: 3.85 }, yaw: Math.PI / 2, dur: [12, 22], hide: true, exit: { x: 14.45, z: 3.85, yaw: -Math.PI / 2 }, line: 'Private business. Please don’t follow me.', cond: () => morning() && !S.flags.pancakesMade },
  { id: 'bwin', spot: { x: 2.4, z: 4.05 }, yaw: 0, dur: [4, 6], look: { x: 2.4, y: 1.4, z: 7 }, lines: ['Good morning, Gerald.', 'Gerald’s back. Hello, Gerald.'] },
  { id: 'kwin', spot: { x: 13.0, z: 4.1 }, yaw: 0, dur: [4, 6], look: { x: 13, y: 1.4, z: 8 }, lines: ['It’s so white out there. As if someone had tidied the world away.', 'Somebody drew a heart on the porch rail. It was me. Please don’t look.'] },
];

async function sitSofa() {
  if (PARTNER.hold) G.setHold(false);
  const S0 = G.SOFA, from = { x: PLAYER.x, z: PLAYER.z, yaw: PLAYER.yaw };
  await G.sitDown(PLAYER, S0.x + 0.45, S0.z - 0.05, Math.PI, S0.seatY);
  PLAYER.freeSit = from;
  S.pSpoke = true;   // the sofa has its own replies
  const partnerThere = PARTNER.task && PARTNER.task.o.id === 'sofa' && PARTNER.task.phase === 'do';
  if (partnerThere) { S.mem.affection++; addBond(0.4); G.bark(['*leans against you*', 'Mm. My pillow has arrived.', 'Oh, good. The heater.'], 2.4); return; }
  await N(S.flags.sofaN ? '(The sofa. It knows the exact shape of both of you.)' : '(You sink into the sofa. It makes a noise as if it had been waiting for you.)');
  S.flags.sofaN = 1;
  if (!PARTNER.lie && !PARTNER.hidden && dist() < 9 && PARTNER.mode === 'follow' && !PARTNER.hold) {
    if (PARTNER.task) G.endPartnerTask();
    const o = G.SMART.find((x) => x.id === 'sofa');
    PARTNER.task = { o, phase: 'go', t: 0 };
    G.bark(['Budge up, Partner.', 'Is there room for one more?', 'Don’t move. I’m coming.'], 2);
    S.mem.affection++; addBond(0.4);
  }
}

/* =====================================================================
 * Together: hug, hold hands, tease, kiss, talk
 * ===================================================================== */
/* Talking picks, in order: what you just did (if she saw it), where you are and what's going on,
 * the day's own topics, then small talk that fits the room. Each topic runs once. */
const recent = (id) => S.lastUse && S.lastUse.id === id && G.simT - S.lastUse.t < 60;
const ABOUT = {
  kettle: async () => { await Pt('Thank you for the tea, Partner.'); await Y('Two sugars.'); await Pt('One. And a second one that doesn’t count.'); },
  stove: async () => { await Pt('You were very serious at that stove. Like a surgeon. A pancake surgeon.'); await Y('Pancakes deserve respect.'); await Pt('So do I, and I’ve never seen that face for me.'); },
  fridge: async () => { await Pt('You keep visiting the fridge as if it were a friend.'); await Y('It’s a good listener.'); await Pt('It hums when you talk. That isn’t listening, Partner. That’s politeness.'); },
  cupboard: async () => {
    if (S.flags.stoleSnack) { await Pt('About the biscuit.'); await Y('What biscuit?'); await Pt('Precisely the answer a thief would give.'); addRivalry(0.2); }
    else if (S.mem.snacks) { await Pt('Did you leave a biscuit on a napkin for me?'); await Y('It might have been Gerald.'); await Pt('Gerald has no thumbs. Thank you, Partner.'); addBond(0.3); }
    else { await Pt('Were you about to open my cupboard?'); await Y('Admiring it. From a respectful distance.'); await Pt('Keep it respectful.'); }
  },
  basil: async () => { await Pt('Basil likes you, you know. He just can’t show it.'); await Y('He’s a plant.'); await Pt('He is a very reserved plant.'); },
  radio: async () => { await Pt('Do you remember the first time we danced in here?'); await Y('Two in the morning. The kettle was boiling.'); await Pt('And you stepped on my foot, and the kettle screamed, and neither of us stopped.'); },
  study: async () => {
    await Pt('You were looking at the study door.');
    const c = await choose(['“What’s in there?”', '“I wasn’t.”', '“I’ll wait.”']);
    if (c === 0) await Pt('Things. Private things. Things for later. That is all you may know.');
    if (c === 1) await Pt('You were. You had your curious face on. It’s very obvious.');
    if (c === 2) { addBond(0.3); await Pt('…Thank you. It will be worth it. I hope.'); }
  },
  ewin: async () => { await Pt('Why were you looking at the study window?'); await Y('Admiring the snow.'); await Pt('Admire it from another window, please.'); },
  scrap: async () => { await Pt('Which page is your favourite?'); await Y('The one we haven’t made yet.'); await Pt('That is either very romantic or a way of avoiding the question.'); },
  'shelf6.15': async () => ABOUT.scrap(),
  fire: async () => { await Pt('I’m going to learn to light it myself one day.'); await Y('You say that every winter.'); await Pt('And every winter you light it first. That’s hardly my fault.'); },
  bwin: async () => { await Pt('I think Gerald comes back because of you.'); await Y('Because I feed him?'); await Pt('Because you say good morning to him. It matters to a bird.'); },
  wardrobe: async () => { await Pt('I will give the grey jumper back. In principle.'); await Y('When?'); await Pt('When it stops smelling of you, Partner. So never.'); },
  photos: async () => { await Pt('We should take a photograph today. A proper one.'); await Y('With both of us looking?'); await Pt('Let’s not be unrealistic.'); },
  coats: async () => { await Pt('The scarf. Be honest. Is it yours?'); await Y('It’s yours.'); await Pt('Then we’re agreed. It belongs to no one. A free scarf.'); },
  cushion: async () => { await Pt('You found my collection.'); await Y('Three of my socks are in there.'); await Pt('They were lonely. I gave them a home.'); },
  ktable: async () => { await Pt('You didn’t open the card, did you?'); await Y('It said “not yet”.'); await Pt('Good. Tonight. It’s for tonight.'); },
  clock: async () => { await Pt('Do you ever think we should fix the clock?'); await Y('No.'); await Pt('No. It would feel like someone else’s house.'); },
  toaster: async () => { await Pt('We are not speaking about the toaster.'); await Y('We never do.'); await Pt('And that is how it will stay.'); },
  bed: async () => { await Pt('You made the bed. I noticed.'); await Y('Badly.'); await Pt('Lovingly badly. That’s the best kind.'); },
  sofa: async () => { await Pt('This is my favourite place in the cabin.'); await Y('The sofa?'); await Pt('Next to you on it. The sofa’s only part of it.'); addBond(0.2); },
  chest: async () => { await Pt('Kevin was a present from my grandmother.'); await Y('Kevin the sheep?'); await Pt('Kevin the sheep. Treat him with the respect he is owed.'); },
};
const ROOM = {
  bedroom: [
    { id: 'r_bed1', when: () => morning(), run: async () => { await Pt('I’ve decided this is the best room.'); await Y('Because of the bed?'); await Pt('Because of the bed, and the person who keeps getting out of it too early.'); } },
    { id: 'r_bed2', when: () => !morning(), run: async () => { await Pt('The fairy lights were your idea. I want that on record.'); await Y('They were yours.'); await Pt('Then I have excellent ideas.'); } },
  ],
  living: [
    { id: 'r_liv1', when: () => morning() && !G.FIRE.on, run: async () => { await Pt('It’s a little cold in here, isn’t it?'); await Y('Is that a hint?'); await Pt('It is a heavy hint, Partner. The fire is right there.'); } },
    { id: 'r_liv2', when: () => G.FIRE.on, run: async () => { await Pt('Listen to the fire. It sounds like someone whispering.'); await Y('What’s it saying?'); await Pt('That we should stay in all day. I agree with it entirely.'); } },
    { id: 'r_liv3', run: async () => { await Pt('Do you remember carrying that sofa in?'); await Y('I remember you directing.'); await Pt('Someone had to have a vision.'); } },
  ],
  kitchen: [
    { id: 'r_kit1', when: () => morning() && !S.flags.pancakesMade, run: async () => { await Pt('Are we having pancakes, or are we simply standing in the kitchen together?'); await Y('Is there a difference?'); await Pt('About four pancakes’ difference.'); } },
    { id: 'r_kit2', when: () => S.flags.pancakesMade, run: async () => { await Pt('The kitchen smells wonderful. You’ve outdone yourself.'); await Y('Even the burnt one?'); await Pt('Especially the burnt one. It has character.'); } },
    { id: 'r_kit3', run: async () => { await Pt('I like this kitchen best in the morning. It feels new.'); await Y('It’s the same kitchen.'); await Pt('Then it’s the snow. Everything looks new under snow.'); } },
  ],
  porch: [
    { id: 'r_por1', when: () => morning(), run: async () => { await Pt('It’s so quiet out here in the mornings.'); await Y('Apart from Gerald.'); await Pt('Gerald is part of the quiet.'); } },
    { id: 'r_por2', when: () => !morning(), run: async () => { await Pt('The string lights were crooked all year. I like them crooked.'); await Y('I could straighten them.'); await Pt('Don’t you dare.'); } },
  ],
  outside: [
    { id: 'r_out1', when: () => morning(), run: async () => { await Pt('Look at our footprints. Yours are enormous.'); await Y('Yours are tiny.'); await Pt('Efficient, Partner. Mine are efficient.'); } },
    { id: 'r_out2', when: () => !morning(), run: async () => { await Pt('The cabin looks so small from out here.'); await Y('It is small.'); await Pt('It’s exactly big enough. That’s different.'); } },
  ],
};
const DAY = {
  morning: [
    { id: 'gift', run: async () => {
      await Pt('If you could have anything at all today, what would it be?');
      const c = await choose(['“Pancakes.”', '“You.”', '“To know what’s in the study.”']);
      if (c === 0) await Pt('Pancakes aren’t a wish, Partner. They’re a way of life.');
      if (c === 1) { addBond(0.5); await Pt('Oh, honestly. …You already have me. That isn’t a wish. That’s a standing arrangement.'); }
      if (c === 2) await Pt('A good try. The answer is still “private”.');
    } },
    { id: 'dream', run: async () => { await Pt('I dreamt we were children again, and you were already this tall.'); await Y('That sounds unsettling.'); await Pt('It was. You couldn’t fit on the sledge.'); } },
  ],
  evening: [
    { id: 'secret', when: () => STATE.cakeDone, run: async () => { await Pt('I nearly said something this morning. Twice.'); await Y('About what day it is?'); await Pt('About what day it is. The pancakes very nearly broke me.'); } },
    { id: 'fair', run: async () => { await Pt('Do you remember the winter fair? It was the first snow then, too.'); await Y('Vaguely.'); await Pt('Same. Vaguely is my favourite way to remember things.'); } },
  ],
  any: [
    { id: 'size', run: async () => { await Pt('Why are you so tall, Partner?'); await Y('Why are you so small?'); await Pt('Concentrated.'); } },
  ],
};
const SMALL = {
  bedroom: ['Mm?', 'Yes, Partner?', 'If you’re about to suggest a nap, the answer is yes.'],
  living: ['Hello again.', 'You only wanted to hear my voice. I can tell.', 'I’m listening. Attentively.'],
  kitchen: ['Is this about food? It’s usually about food.', 'Yes, Partner?', 'If you’re asking whether I want more tea, I do.'],
  porch: ['It’s lovely out, isn’t it?', 'Mm. Yes?'],
  outside: ['My nose is cold. That’s all I have to report.', 'Yes, Partner?'],
};
async function talk() {
  const here = hereRoom(), seen = S.lastUse && S.lastUse.room === room(PARTNER.x, PARTNER.z);
  // In bed she's barely awake.
  if (PARTNER.lie) { await Pt(pick(['…Mm. Five more minutes. Then you may talk to me.', 'I’m asleep, Partner. This is a dream. Go and make pancakes in it.', '…Shh. I’m conserving warmth.'])); return; }
  if (S.lastUse && G.simT - S.lastUse.t < 60 && ABOUT[S.lastUse.id] && !S.talked['a_' + S.lastUse.id] && (seen || dist() < 4)) {
    S.talked['a_' + S.lastUse.id] = true; await ABOUT[S.lastUse.id](); return;
  }
  if (PARTNER.hold && !S.talked.s_hold) { S.talked.s_hold = true; await Pt('You know, you could just hold my hand all day. I wouldn’t object.'); await Y('People might talk.'); await Pt('There are no people, Partner. There is Gerald.'); return; }
  if ((PLAYER.sit || 0) > 0.5 && (PARTNER.sit || 0) > 0.5 && !S.talked.s_sofa) { S.talked.s_sofa = true; await ABOUT.sofa(); return; }
  const roomT = (ROOM[here] || []).find((x) => !S.talked[x.id] && (!x.when || x.when()));
  if (roomT) { S.talked[roomT.id] = true; await roomT.run(); return; }
  const dayT = (DAY[ch()] || []).concat(DAY.any).find((x) => !S.talked[x.id] && (!x.when || x.when()));
  if (dayT) { S.talked[dayT.id] = true; await dayT.run(); return; }
  await Pt(pick(SMALL[here] || SMALL.living));
}
const TEASES = [
  ['You have a pillow crease on your face.', 'It’s a dimple. A very long dimple.'],
  ['Your hair is doing something remarkable this morning.', 'It’s called “style”, Partner. Look it up.'],
  ['I’m a year older, and therefore wiser.', 'Older, certainly.'],
  ['You’re very small.', 'I’m concentrated.'],
  ['You snore, you know.', 'I purr. There’s a difference, and it’s considerable.'],
  ['You’re staring.', 'I’m looking. You are the one staring.'],
];
async function together() {
  if (G.busy() || S.flags.noTogether) return;
  const p = PARTNER;
  // From bed she can only be talked to (or kissed good morning).
  const seated = (p.sit || 0) > 0.3 || (PLAYER.sit || 0) > 0.3 || p.lie;
  const acts = [];
  if (!seated) acts.push({ id: 'hug', t: 'Hug' }, { id: 'hand', t: p.hold ? 'Let go' : 'Hold hands' });
  const music = G.Audio.radioOn() && G.inside(PLAYER.x, PLAYER.z) && PLAYER.x > 5;
  if (!seated && music) acts.push({ id: 'dance', t: 'Dance' });
  if (!p.lie) acts.push({ id: 'tease', t: 'Tease' });
  acts.push({ id: 'kiss', t: 'Kiss' }, { id: 'talk', t: 'Talk' });
  STATE.busy = true;   // she waits while you decide
  const keep = p.task && p.task.phase === 'go' ? null : p.task;
  if (p.task && !keep) G.endPartnerTask();
  const id = await G.UI.together(acts);
  STATE.busy = false;
  if (!id) return;
  if (id !== 'tease' && id !== 'talk' && p.task && !seated) G.endPartnerTask();
  switch (id) {
    case 'hug': {
      S.mem.hugs++; S.mem.affection++; addBond(S.mem.hugs < 6 ? 0.35 : 0.08);
      await G.hug('hug', S.mem.hugs === 1 ? 'Oh. Hello. A snow-day hug. Accepted.' : ['Mm. Squashed. Very nice.', 'You’re so warm. It hardly seems fair.', 'You may stop. Please don’t stop.', '*rests her cheek against your shoulder*', 'A very good hug. Ten out of ten.']);
      return;
    }
    case 'hand': {
      if (p.hold) { G.setHold(false); G.bark(['Oh. All right.', 'Very well. Free range.', 'Fine. I’ll miss it.'], 1.8); return; }
      G.setHold(true); S.mem.holds++; S.mem.affection++; addBond(S.mem.holds < 6 ? 0.3 : 0.05);
      G.bark(['*laces her fingers through yours*', 'May I swing it a little?', 'Oh, how formal of us.', '*gives your hand a squeeze*'], 2);
      return;
    }
    case 'tease': {
      S.mem.teases++; addRivalry(0.25);
      const L = TEASES[(S.mem.teases - 1) % TEASES.length];
      STATE.busy = true; await Y(L[0]); await P(L[1]); STATE.busy = false;
      return;
    }
    case 'kiss': {
      S.mem.kisses++; S.mem.affection++; addBond(S.mem.kisses < 5 ? 0.35 : 0.05);
      const line = p.lie ? ['Mm. Good morning to you too.', '…Again. For warmth.'] : ['Well. Good morning to you too.', 'A good-morning kiss. Noted.', 'Again? Greedy, Partner.', '*a small, flustered noise*', 'You can’t simply do that. …Do it again.'];
      if (seated || !(await G.hug('kiss', line))) G.bark(line, 2.4);
      return;
    }
    case 'dance': S.mem.dances = (S.mem.dances || 0) + 1; S.mem.affection++; addBond(S.mem.dances < 3 ? 0.5 : 0.1); if (S.mem.dances === 1) addScrap('dance', 'A slow dance in the kitchen. Somebody stepped on somebody’s foot.'); await G.dance(); return;
    case 'talk': STATE.busy = true; await talk(); STATE.busy = false; return;
  }
}
/* =====================================================================
 * Shots
 * ===================================================================== */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const fixed = (pos, look, fov = 38, aperture = 0.012) => () => ({ pos: pos.clone(), look: look.clone(), fov, focus: pos.distanceTo(look), aperture });
const bedShot = () => { const B = G.BED; return fixed(V(B.x + 0.05, 2.2, 1.5), V(B.x + 0.02, 0.72, 0.75), 44, 0.008); };
const bedCloseShot = () => { const B = G.BED; return fixed(V(B.x + 0.04, 2.1, 1.12), V(B.x + 0.02, 0.76, 0.6), 34, 0.012); };
const panShot = () => fixed(V(13.05, 1.5, 1.2), V(12.45, 0.95, 0.5), 38, 0.016);
const tableShot = (seat) => (seat === 'C' ? fixed(V(11.3, 1.42, 2.62), V(13.0, 1.02, 3.0), 50, 0.008) : fixed(V(13.0, 1.4, 1.55), V(13.0, 0.98, 3.4), 42, 0.01));

/* =====================================================================
 * Shared scenes
 * ===================================================================== */
const Story = G.Story;
Object.assign(Story, {
  together,
  async begin(fromSave) {
    const sv = fromSave && loadSave();
    if (sv) { Object.assign(S, fresh(), { vars: sv.vars, mem: sv.mem, scrap: sv.scrap || [], talked: sv.talked || {} }); Object.assign(S.flags, sv.flags || {}); return go(sv.chapter); }
    Object.assign(S, fresh());
    return go('prologue');
  },
  partnerGetsUp(silent) {
    const p = PARTNER;
    if (!p.lie) return;
    G.standAt(p, 3.72, 1.55, -Math.PI / 2); p.mode = 'follow';
    G.shapeBed({});
    STATE.autonomy = true;
    if (!silent) G.bark(['*an enormous yawn* Good morning, Partner.', '*stretches* I’m up. Spiritually and now physically.'], 2.6);
  },
  async morningCuddle() {
    S.flags.inBedScene = true; S.flags.cuddled = true;
    STATE.sceneShot = true;
    await G.cutTo(() => { G.lieDown(PLAYER, G.BED.L, 2.26, 0.15, 0.35); G.shapeBed({ L: true, R: true }); G.setShot(bedCloseShot()); });
    await N('(You climb back in. She doesn’t open her eyes. She simply shifts until she’s against you again.)', { shot: 'keep' });
    PARTNER.lidsClosed = true;
    await P('I knew you’d come back.', { shot: 'keep' });
    await Y('It’s a snow day. Nobody is going anywhere.', { shot: 'keep' });
    await P('Mm. Ten more minutes, Partner. Snow-day rules.', { shot: 'keep' });
    addBond(1); S.mem.affection++;
    await G.fade(true); await wait(0.8); await G.fade(false);
    await N('(It is not ten minutes.)', { shot: 'keep' });
    PARTNER.lidsClosed = false;
    await P('…All right. All right. Pancakes. I am getting up. In spirit.', { shot: 'keep' });
    await G.cutTo(() => { G.standAt(PLAYER, 1.1, 1.9, Math.PI / 2); Story.partnerGetsUp(true); STATE.sceneShot = false; G.releaseCamera(); });
    addScrap('blanket', 'Ten more minutes. (It was not ten minutes.)');
    S.flags.inBedScene = false;
  },
  async makePancakes() {
    const k = K();
    STATE.sceneShot = true;
    await G.slideTo(PLAYER, 12.22, 0.97, Math.PI, 0.35);   // stand at the hob, a little left of the pan, so the camera can see both
    G.setShot(panShot());
    k.burner.material.opacity = 0.8; G.Audio.sizzle(true); G.steam('pan', 12.5, 0.96, 0.51, { rate: 4, size: 1.3 });
    await N('(Flour, eggs, milk, a pinch of salt. The pan hisses.)', { shot: 'keep' });
    k.pancakeInPan.visible = true;
    const col = (q) => (q > 0.75 ? '#e0ad66' : q > 0.35 ? '#c58a46' : '#5a3a22');
    const sc = await G.UI.timing({ title: 'Flip the pancakes', rounds: 3, zone: [0.58, 0.74], labels: ['Charcoal.', 'Pancake-shaped.', 'Golden.'], onPress: (q) => { G.Audio.flip(); flipAnim(k.pancakeInPan, col(q)); } });
    const avg = sc.reduce((a, b) => a + b, 0) / sc.length;
    const q = (S.flags.pancakeQuality = avg > 0.7 ? 'golden' : avg > 0.38 ? 'fine' : 'burnt');
    k.burner.material.opacity = 0; G.Audio.sizzle(false); k.pancakeInPan.visible = false; G.steam('pan', 0, 0, 0, { off: true });
    k.plates.forEach((pl, i) => { if (i < 2) G.steam('plate' + i, pl.g.position.x, 0.82, pl.g.position.z, { rate: 1.4, dur: 120, size: 0.7 }); });
    S.flags.pancakesMade = true;
    setBreakfast({ mugs: S.flags.teaMade, plates: true, burnt: q === 'burnt' });
    G.setShot(tableShot('B')); G.CAM.cut = true;
    await N(q === 'golden' ? '(A stack of perfect golden pancakes. For a moment, you are a god.)' : q === 'fine' ? '(A stack of pancakes. Most of them are pancake-shaped.)' : '(A stack of pancakes. The bottom one is more of a concept.)', { shot: 'keep' });
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
    // She comes running, from wherever she was.
    const p = PARTNER;
    if (p.lie) Story.partnerGetsUp(true);
    if (p.task) G.endPartnerTask();
    if (p.hold) G.setHold(false);
    p.mode = 'script';
    G.bark('Do I smell pancakes, Partner?', 2.6);
    const A = k.chairs.A;
    G.walkTo(p, A.x, A.z + 0.52, 1.6).then(async () => { if (S.flags.breakfastDone) return; await G.sitDown(p, A.x, A.z, A.yaw, A.seatY); p.mode = 'seated'; });
  },
  async breakfast() {
    const p = PARTNER, k = K();
    if (p.hold) G.setHold(false);
    const c = await choose(['Sit beside her', 'Sit across from her']);
    const seat = c === 0 ? 'B' : 'C', ch2 = k.chairs[seat];
    STATE.sceneShot = true;
    await G.cutTo(() => { if (p.mode !== 'seated') { p.script = null; p.slide = null; const A = k.chairs.A; G.sitAt(p, A.x, A.z, A.yaw, A.seatY); p.mode = 'seated'; } G.sitAt(PLAYER, ch2.x, ch2.z, ch2.yaw, ch2.seatY); setBreakfast({ mugs: S.flags.teaMade, plates: true, seat, burnt: S.flags.pancakeQuality === 'burnt' }); G.setShot(tableShot(seat)); });
    if (c === 0) { S.mem.sitBeside++; addBond(0.5); await P('Oh, beside me today. How scandalous.', { shot: 'keep' }); }
    else { S.mem.sitAcross++; await P('Across from me. How formal. Like a business meeting.', { shot: 'keep' }); }
    const q = S.flags.pancakeQuality;
    if (q === 'golden') await P('These are… irritatingly good. I’m quite put out.', { shot: 'keep' });
    else if (q === 'fine') await P('Mm. Pancakes. Full marks for effort with the shapes.', { shot: 'keep' });
    else await P('Crunchy. A bold choice, Partner. I respect it.', { shot: 'keep' });
    if (S.flags.teaMade) await P('And tea. Two sugars? …Please don’t tell anyone.', { shot: 'keep' });
    if (S.flags.snackDone && S.mem.snacks) await P('Also, someone left a biscuit on a napkin for me. I intend to keep it forever. I have already eaten it.', { shot: 'keep' });
    await N('(Her fork drifts, casually, toward your plate.)', { shot: 'keep' });
    const s = await choose(['Let it happen', 'Defend your pancake', 'Slide the whole plate over']);
    const bite = () => setBreakfast({ mugs: S.flags.teaMade, plates: true, seat, bite: true, burnt: q === 'burnt' });
    if (s === 0) { bite(); await P('*chewing* …What? It looked lonely.', { shot: 'keep' }); S.mem.foodStolen++; addBond(0.3); }
    else if (s === 1) {
      addRivalry(1);
      await P('Fork violence! At the breakfast table, Partner!', { shot: 'keep' });
      await N('(You look away for one second. One.)', { shot: 'keep' });
      bite();
      await P('Mine now. Thank you.', { shot: 'keep' });
      S.mem.foodStolen++;
    } else { bite(); await P('…You are unbearably kind. Thank you, Partner.', { shot: 'keep' }); S.mem.foodShared++; addBond(1); }
    addScrap('pancakes', q === 'burnt' ? 'Snow-day pancakes. Structurally ambitious. Somebody stole a bite anyway.' : 'Snow-day pancakes. Somebody stole a bite. (It was {P}.)');
    await P('Now. A walk. The meadow, the hill, the lake, all under fresh snow. I have planned this extensively.', { shot: 'keep' });
    await Y('Since when?', { shot: 'keep' });
    await P('Since about four minutes ago. Boots, please.', { shot: 'keep' });
    await G.cutTo(() => {
      G.standAt(PLAYER, 13.25, 1.75, Math.PI); G.standAt(p, 12.6, 1.8, Math.PI);
      p.mode = 'follow'; STATE.sceneShot = false; G.releaseCamera();
    });
    S.flags.breakfastDone = true;
  },
});

/* =====================================================================
 * Chapters
 * ===================================================================== */
const CH = {};
async function go(id) {
  S.chapter = id;
  S.run = (S.run || 0) + 1;   // background loops belong to one run of a chapter
  try { await CH[id](); } catch (e) { console.error('[story]', id, e); }
}
function flipAnim(m, color) {
  let t = 0; const y0 = 0.04;
  const step = () => { t += 1 / 60; const k = Math.min(1, t / 0.45); m.position.y = y0 + Math.sin(k * Math.PI) * 0.16; m.rotation.x = k * Math.PI; if (k > 0.5) m.material = G.shared({ color, roughness: 0.7 }); if (k < 1) requestAnimationFrame(step); else { m.rotation.x = 0; m.position.y = y0; } };
  step();
}
function quiet() {
  // Clear anything a previous scene left running.
  for (const c of [PLAYER, PARTNER]) { c.script = null; c.slide = null; c.lie = false; c.sit = c.sitTarget = 0; c.freeSit = null; c.rise = null; c.task = null; c.lead = null; c.speed = 0; c.nav = null; c.lidsClosed = false; c.tilt = c.tiltTarget = 0; }
  G.setHold(false); PARTNER.hidden = false; PARTNER.m.visible = true; PARTNER.mode = 'follow';
  STATE.busy = false; STATE.sceneShot = false; STATE.noControl = false; STATE.autonomy = false; STATE.bounds = null;
  Object.assign(S.flags, { noTogether: false, noBarks: false, noInteract: false });
}

CH.prologue = async () => {
  quiet(); STATE.busy = true;
  S.flags.noTogether = true; S.flags.noBarks = true; S.flags.noInteract = true;
  STATE.bounds = { zMin: 15 };   // the fair is behind you; the cabin isn't part of this memory
  G.useKids(true); showFair(true);
  houseFor('evening'); G.setCake(false);
  G.setTime({ day: 0, tod: 1, snow: 0.8 }, true);
  G.post.grade.uniforms.uMem.value = 1; STATE.fog = { near: 7, far: 30 };   // the cabin, years later, is lost in the dark
  const L = FAIR.log;
  G.placeChar(PLAYER, 6.5, 21.6, 0);
  G.sitAt(PARTNER, L.x, L.z, 0, L.seatY); PARTNER.mode = 'still'; PARTNER.stillLook = { x: L.x, z: L.z + 8, headY: L.seatY + 0.3 };
  G.releaseCamera(); G.CAM.yaw = Math.PI; G.CAM.pitch = 0.14; G.CAM.cut = true;
  await wait(0.5);
  G.fade(false);
  await G.UI.card(['We don’t remember exactly how it started.'], { hold: 3.8 });
  STATE.busy = false;
  G.hint(G.MOBILE ? 'Drag on the left side of the screen to walk.' : 'Walk with WASD or the arrow keys.', 7);
  await until(() => dist() < 2.4);
  STATE.noControl = true;
  await wait(0.7);
  STATE.sceneShot = true;
  // Low and wide, behind her, looking back up the path at you.
  G.setShot(() => { const pos = V(L.x + 1.6, L.seatY + 0.55, L.z + 1.9), look = V((PLAYER.x + L.x) / 2, L.seatY + 0.35, (PLAYER.z + L.z) / 2); return { pos, look, fov: 40, focus: pos.distanceTo(look), aperture: 0.012 }; }, false);
  PLAYER.yaw = Math.atan2(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
  await wait(1.0);
  PARTNER.stillLook = { x: PLAYER.x, z: PLAYER.z, headY: PLAYER.y + PLAYER.m.userData.H * 0.9 };
  await wait(1.1);
  await N('(Snow. Cold air. Lanterns, somewhere behind you. Somebody else who had wandered off.)', { shot: 'keep' });
  await N('(You came over. That part, everyone agrees on.)', { shot: 'keep' });
  const f = G.$('fade'); f.style.transition = 'opacity 2.4s'; G.fade(true, '#ffffff');
  await wait(2.6); f.style.transition = '';
  S.flags.noTogether = false; S.flags.noBarks = false; S.flags.noInteract = false; STATE.bounds = null;
  return go('morning');
};

CH.morning = async () => {
  checkpoint('morning');
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.style.background = '#ffffff'; f.classList.add('on'); await wait(0.7); }
  quiet(); STATE.busy = true;
  G.useKids(false); showFair(false);
  G.post.grade.uniforms.uMem.value = 0; STATE.fog = null;
  G.setTime({ day: 1, tod: 0, snow: 0.12 }, true);
  houseFor('morning');
  Object.assign(S.flags, { teaMade: false, pancakesMade: false, breakfastDone: false, leaveHouse: false, cuddled: false });
  const B = G.BED;
  G.lieDown(PLAYER, B.L, 2.26, 0.15, 0.35);
  G.lieDown(PARTNER, B.R, 2.0, -0.3, -0.4); PARTNER.mode = 'lying'; PARTNER.lidsClosed = true;
  STATE.sceneShot = true; G.setShot(bedShot());
  await wait(0.4);
  f.style.transition = 'opacity 2.2s'; f.classList.remove('on'); wait(2.4).then(() => { f.style.transition = ''; f.style.background = ''; });
  await G.UI.act('I', 'Shared Life', { white: false });
  G.setShot(bedCloseShot(), false);
  await N('(The first real snow of the winter came in the night. Morning. Warm. Someone is breathing, very softly, against your neck.)', { shot: 'keep' });
  await P('…Mm. Don’t move, Partner. You’re warm.', { shot: 'keep' });
  await Y('You have taken the entire blanket.', { shot: 'keep' });
  PARTNER.lidsClosed = false;
  await P('Our blanket.', { shot: 'keep' });
  await Y('It is entirely on your side.', { shot: 'keep' });
  await P('I don’t recognise sides. Not before nine.', { shot: 'keep' });
  const c = await choose(['Stay a little longer', 'Steal the blanket back', 'Get up']);
  if (c === 0) {
    addBond(1); S.mem.affection++;
    PARTNER.lidsClosed = true;
    await N('(You stay. She settles into your side as though she were measured for it.)', { shot: 'keep' });
    await P('Good. That was the correct answer.', { shot: 'keep' });
    await P('It snowed all night, by the way. We are officially snowed in.', { shot: 'keep' });
    await Y('You said that into my shoulder.', { shot: 'keep' });
    await P('Then your shoulder may consider itself informed.', { shot: 'keep' });
    PARTNER.lidsClosed = false;
  } else if (c === 1) {
    addRivalry(1);
    await slideBlanket(-1);
    await N('(One heroic tug. The blanket is yours. Briefly.)', { shot: 'keep' });
    await P('Theft. First thing in the morning. I’m shocked, Partner.', { shot: 'keep' });
    await slideBlanket(0.35);
    await N('(It is back on her side within four seconds. You did not see how.)', { shot: 'keep' });
    await P('Good morning, all the same. Thief.', { shot: 'keep' });
    addScrap('blanket', 'The Great Blanket Robbery. (Lasted four seconds.)');
  } else {
    await N('(You begin to get up. A pillow meets the back of your head.)', { shot: 'keep' });
    await P('Traitor.', { shot: 'keep' });
    await P('…Good morning, traitor.', { shot: 'keep' });
  }
  await Y('Good morning, {gremlin}.', { shot: 'keep' });
  await P('On snow days, whoever wakes first makes breakfast. I believe that’s the law.', { shot: 'keep' });
  await Y('You woke up first.', { shot: 'keep' });
  await P('I have no recollection of that. …Pancakes, please. I’ll be up in a minute.', { shot: 'keep' });
  await G.cutTo(() => {
    G.standAt(PLAYER, 1.1, 1.9, Math.PI / 2);
    G.shapeBed({ R: true }, c === 1 ? 0.35 : 0);
    PARTNER.lieLook = -0.2; PARTNER.lidsClosed = true;
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.yaw = -Math.PI / 2 + Math.PI; G.CAM.cut = true;
  });
  STATE.busy = false;
  G.hint(G.MOBILE ? 'Tap Use near things to interact. Tap ♥ near {P} to be together.' : 'E or Space: interact.   Q: be together (hug, hold hands, talk).   V: first person.', 9);
  // She gets up on her own after a while; never in front of you mid-move.
  const run = S.run, live = () => S.run === run;
  (async () => {
    await wait(30);
    await until(() => !live() || !PARTNER.lie || (!G.busy() && (PLAYER.x > 5.2 || Math.random() < 0.02)));
    if (!live() || !PARTNER.lie) return;
    if (PLAYER.x < 5.2) await G.cutTo(() => Story.partnerGetsUp(true)); else Story.partnerGetsUp();
  })();
  // Birdsong now and then, and a nudge toward the kitchen if you dawdle.
  (async () => { while (live()) { await wait(7 + Math.random() * 10); if (STATE.day > 0.5 && !STATE.paused) G.Audio.chirp(); } })();
  (async () => {
    let idle = 0, i = 0;
    const lines = () => (S.flags.pancakesMade ? ['(She’s at the kitchen table. With a fork. Waiting.)'] : ['(Pancakes. She did say pancakes.)', '(The kitchen is through the living room, past the fire.)']);
    while (live() && !S.flags.breakfastDone) { await wait(5); idle = PLAYER.speed < 0.1 && !G.busy() ? idle + 5 : 0; if (idle > 40) { const L = lines(); G.hint(L[i++ % L.length], 5); idle = -20; } }
  })();
  await until(() => S.flags.breakfastDone);
  G.setHold(false);
  PARTNER.lead = { x: 6.45, z: 7.95, waitLines: ['Boots, Partner. The walk awaits.', 'Do come along, Partner.', 'The day isn’t getting any younger. Nor are you.'] };
  G.bark('Boots, please! The snow won’t wait.', 2.8);
  await until(() => S.flags.leaveHouse || (PLAYER.z > 6.9 && Math.abs(PLAYER.x - 6.5) < 2.2));
  STATE.noControl = true;
  PARTNER.lead = null;
  return go('walk');
};

/* The walk is the next part of the port; for now the day passes on a card and the evening picks up at home. */
async function slideBlanket(to) {
  const B = G.BED; let s = B.shift || 0; const from = s;
  for (let t = 0; t <= 1.001; t += 1 / 24) { s = from + (to - from) * G.smooth(0, 1, t); G.shapeBed({ L: true, R: true }, s); await wait(1 / 40); }
  B.shift = to;
}
CH.walk = async () => {
  STATE.busy = true;
  const f = G.$('fade'); f.style.transition = 'opacity 1.6s'; f.classList.add('on'); await wait(1.7); f.style.transition = '';
  await G.UI.card(['The walk.', 'The meadow, the hill, the frozen lake —', 'and the long way home.'], { hold: 4.6, stagger: 0.9 });
  return go('evening');
};
CH.evening = async () => {
  checkpoint('evening');
  const f = G.$('fade');
  if (!f.classList.contains('on')) { f.classList.add('on'); await wait(0.7); }
  quiet();
  G.useKids(false); showFair(false); G.post.grade.uniforms.uMem.value = 0; STATE.fog = null;
  G.setTime({ day: 0, tod: 0, snow: 1 }, true);
  houseFor('evening');
  Object.assign(STATE, { cuddled: false, cakeDone: false, porchDone: false });
  G.Story.intro();
  await wait(0.9);
  f.classList.remove('on');
};
G.setCake = setCake;
G.CH = CH; G.go = go;

const bench = findInter('bench');
bench.label = () => (ch() === 'evening' ? (STATE.porchDone ? 'Bench' : 'Watch the stars') : 'Bench');
bench.act = () => { if (ch() === 'evening') return G.Story.porch(); return run(() => N(cyc('bench', ['(Someone has carved two initials into the bench. Not you. Probably.)', '(The bench is cold enough to count as a dare. Later. When there are stars.)'])), 'bench'); };
G.$('pScrap').addEventListener('click', () => { G.UI.scrapbook(S.scrap); });
});
