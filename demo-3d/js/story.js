'use strict';
/* =========================================================================
 * Story, Act I ("Shared Life"), ported from the 2D game:
 * prologue (the lantern fair, as children) → the birthday morning in the
 * cabin → (the walk: next stage) → the evening at home.
 * Also: hidden relationship values, memories, the scrapbook, checkpoints,
 * the house's small interactions, Partner's own habits and Together.
 * ========================================================================= */
(() => {
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
  flags: {}, scrap: [], talked: {}, n: {},
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
const inter = (id, pos, r, label, act, when) => G.INTER.push({ id, pos, r, label, act: () => run(act), when });
const findInter = (id) => G.INTER.find((i) => i.id === id);
// Interactions that talk take the scene; the player can't walk off mid-sentence.
async function run(fn) { if (STATE.busy) return; STATE.busy = true; try { await fn(); } catch (e) { console.error(e); } STATE.busy = false; }

// Bedroom
inter('bed', [2.4, 0.5, 2.55], 1.25, () => (morning() && PARTNER.lie ? 'Lie back down' : 'Bed'), async () => {
  if (morning() && PARTNER.lie) { await Story.morningCuddle(); return; }
  await N(cyc('bed', ['(The bed. Their side and your side exist in theory. In practice, it’s all their side.)', '(You straighten the duvet. It will not survive the night.)', '(Not yet. Too much birthday left.)']));
});
inter('wardrobe', [4.3, 1, 1.05], 0.9, 'Wardrobe', () => N(cyc('wardrobe', ['(Your hoodie is in here. Correction: it was. It is in {P}’s possession now, permanently.)', '(Half the hangers are empty. The other half hold jumpers neither of you has worn since a wedding.)', '(A shoebox labelled “IMPORTANT”. It contains one shoe.)'])));
inter('chest', [3.6, 0.5, 3.6], 0.8, 'Blanket chest', () => N(cyc('chest', ['(Spare blankets, and a hot-water bottle shaped like a sheep. Its name is Kevin, apparently.)', '(Kevin the sheep is lukewarm and judgemental.)'])));
inter('bwin', [2.4, 1.3, 4.05], 0.9, 'Window', async () => {
  if (!morning()) return N('(Snow, blue in the dark, all the way to the trees.)');
  await N(cyc('bwin', ['(Morning. A fat bullfinch is judging you from the sill.)', '(The bullfinch remains. The judgement remains.)']));
  if (S.n.bwin === 1 && near(6)) await P('That’s Gerald. He’s not judging. That’s just his face.');
});
inter('wwin', [0.6, 1.3, 2.25], 0.9, 'Window', () => N(morning() ? cyc('wwin', ['(The pines are still holding last night’s snow, very carefully, like it might break.)', '(A clump of snow slides off a branch. The tree looks relieved.)']) : '(The trees, and the dark between them.)'));
// Living room
const fire = findInter('fire');
fire.label = () => (G.FIRE.on ? 'Fireplace' : 'Light the fire');
fire.act = () => run(async () => {
  if (G.FIRE.on) { await N(cyc('fireOn', ['(Warm. The kind of warm that gets into your sleeves.)', '(You add a log. The fire approves.)'])); return; }
  G.FIRE.on = true; G.Audio.blow();
  await N('(It takes three matches and some quiet swearing.)');
  if (near(7)) await P('Fire person. My hero, {giant}.'); else G.bark('Is that FIRE? My hero!', 2.4);
});
const sofa = findInter('sofa');
sofa.label = () => (ch() === 'evening' ? (STATE.cuddled ? 'Sofa' : 'Curl up together') : 'Sit');
sofa.act = () => { if (ch() === 'evening') return G.Story.cuddle(); return run(sitSofa); };
const cake = findInter('cake');
cake.when = () => G.CAKE.shown !== false;
inter('ctable', [8, 0.5, 1.85], 1.0, 'Coffee table', () => N(cyc('ctable', ['(Two mugs from last night. One has a lipstick mark and the other has a spoon standing up in it.)', '(The coaster is a beer mat from somewhere neither of you has ever been.)'])), () => G.CAKE.shown === false);
const scrapShelf = findInter('shelf6.15');
scrapShelf.label = 'Scrapbook';
scrapShelf.act = () => run(async () => {
  await G.UI.scrapbook(S.scrap);
  if (near(4) && Math.random() < 0.6) G.bark(['Skip the lake page.', 'We need more pages.', 'Is that my handwriting? It’s so bad.']);
});
findInter('shelf10.72').act = () => run(() => N(cyc('shelf2', ['(Six copies of the same cookbook. Nobody knows how.)', '(Paperbacks with cracked spines, a jar of sea glass, and a candle that smells like pine.)'])));
inter('basil', [10.4, 0.8, 4.2], 0.85, 'Basil', async () => {
  await N(cyc('basil', ['(Basil. Not basil. {P} named it Basil to confuse guests.)', '(You water Basil. Basil is indifferent, as always.)', '(Basil has a new leaf. You decide not to make it weird.)']));
  if (S.n.basil === 2) { S.flags.waterBasil = 1; if (near(6)) G.bark('Thank you for hydrating my son.', 2.6); }
});
inter('lwin', [9.4, 1.3, 4.05], 0.9, 'Window', () => N(morning() ? cyc('lwin', ['(A cloud shaped like a cat. Or a pancake.)', '(A cloud shaped like a pancake. Definitely a pancake.)']) : '(The porch lights, and the snow coming down through them.)'));
inter('coats', [5.5, 1.3, 4.1], 0.8, 'Coats', () => N(cyc('coats', ['(Your coat. Their coat. And a scarf neither of you claims. Grey? Blue? The light in here is bad.)', '(The unclaimed scarf. You both swear it’s the other one’s.)'])));
inter('cushion', [9.2, 0.6, 2.5], 0.6, 'Under the cushions', async () => {
  const pancake = S.mem.foodStolen > 0 ? ' a bite of pancake (fresh),' : '';
  await N(`(Under the cushion: three of your socks, a pen, the remote for a radio you no longer own,${pancake} and half a biscuit.)`);
  if (!S.flags.stash) { S.flags.stash = 1; await N('(It’s their stash. Everything in it was stolen from you. You decide to let it grow.)'); }
}, () => morning());
inter('armchair', [6.0, 0.6, 2.45], 0.75, 'Armchair', () => N(cyc('armchair', ['(The armchair. Technically yours. {P}’s blanket lives on it.)', '(The blanket smells like them. You fold it. Badly.)'])));
inter('frontdoor', [6.5, 1, 4.15], 0.8, 'Front door', async () => {
  if (morning()) {
    if (!S.flags.breakfastDone) return N('(Breakfast first. Birthday law, apparently.)');
    S.flags.leaveHouse = true; return;
  }
  return N('(The front door. Somebody has hung a sprig of pine on it.)');
});
// Kitchen
inter('kettle', [11.55, 1, 0.75], 0.75, () => (morning() && !S.flags.teaMade ? 'Make tea' : 'Kettle'), async () => {
  if (morning() && !S.flags.teaMade) {
    S.flags.teaMade = true;
    await N('(You fill the kettle and get two mugs down. One for you. One for them: two sugars, which they will deny.)');
    setBreakfast({ mugs: true, plates: S.flags.pancakesMade, burnt: S.flags.pancakeQuality === 'burnt' });
    if (near(7)) G.bark('Is that tea? Is one of those mine?', 2.6);
    return;
  }
  await N('(The kettle’s still warm.)');
});
inter('stove', [12.35, 1, 0.8], 0.7, () => (morning() && !S.flags.pancakesMade ? 'Make pancakes' : 'Stove'), async () => {
  if (morning() && !S.flags.pancakesMade) { await Story.makePancakes(); return; }
  await N(cyc('stove', ['(The pan is still a bit warm from breakfast.)', '(You resist the urge to make more pancakes.)']));
});
inter('ksink', [13.05, 1, 0.8], 0.6, 'Sink', () => N(cyc('ksink', ['(Dishes from last night: two mugs, two forks, one suspiciously licked spoon.)', '(You wash the spoon. Some mysteries are better left clean.)'])));
inter('toaster', [13.48, 1, 0.75], 0.55, 'Toaster', () => N(cyc('toaster', ['(The toaster has two settings: “warm bread” and “house fire”.)', '(You leave the toaster alone. Today is not a house-fire day.)'])));
inter('fridge', [14.45, 1, 1.05], 0.75, 'Fridge', async () => {
  const n = ++S.mem.fridge;
  if (n === 1) { S.flags.knowsPancakes = true; return N('(Eggs. Milk. Butter. A sad lemon. Pancakes are possible.)'); }
  if (n === 2) return N('(Still eggs. Still milk. The lemon is still sad.)');
  if (n === 3) { if (near(5)) return P('It’s not going to grow new food.'); G.bark('I can HEAR the fridge door!', 3); return N('(Cold air. Comforting, somehow.)'); }
  if (n === 5 && near(5)) return P('Are you waiting for it to say happy birthday? Because I can write it on something.');
  return N('(The fridge hums. It has nothing new to say.)');
});
inter('ktable', [13.0, 0.8, 2.95], 1.3, () => (morning() && S.flags.pancakesMade && !S.flags.breakfastDone ? 'Sit down for breakfast' : 'Kitchen table'), async () => {
  if (morning() && S.flags.pancakesMade && !S.flags.breakfastDone) { await Story.breakfast(); return; }
  await N(cyc('ktable', ['(The table. Mostly used for piling things on.)', '(A pile of post, a bowl of keys, and a birthday card, face down. It’s addressed to you. It says “not yet” on the envelope.)']));
});
inter('cupboard', [11.45, 1, 3.75], 0.7, 'Snack cupboard', async () => {
  await N('({P}’s snack cupboard. A note on the door: “property of me. NOT THE GIANT.”)');
  if (S.flags.snackDone) return;
  const c = await choose(['Leave them a snack on the counter', 'Steal a biscuit', 'Close it']);
  if (c === 0) { S.flags.snackDone = 1; S.mem.snacks++; addBond(0.6); await N('(You leave a biscuit on the counter, on a folded napkin, like a tiny gift.)'); }
  if (c === 1) { S.flags.snackDone = 1; addRivalry(0.5); await N('(Delicious. Illegal. Delicious.)'); if (near(6)) await P('I SAW THAT.'); }
});
inter('kwin', [13.0, 1.3, 4.05], 0.75, 'Window', () => N(morning() ? cyc('kwin', ['(The clearing, white and blue and perfectly still. Somebody has drawn a heart in the snow on the porch rail.)', '(The heart is still there. So is a smaller, angrier one next to it.)']) : '(Your reflection, and behind it the snow.)'));
inter('ewin', [14.6, 1.3, 2.1], 0.6, 'Window', () => N(cyc('ewin', ['(The study’s roof, sloping away under a fat roll of snow.)', '(The study’s little window has a curtain pulled across it. It didn’t yesterday.)'])));
inter('study', [14.6, 1, 3.85], 0.7, 'Study door', async () => {
  if (PARTNER.hidden) { G.bark(['NOPE.', 'Birthday business! Shoo!', 'I can hear you breathing on the door.', 'No giants. It says. On the sign.'], 2.6); return; }
  await N(cyc('study', ['(Locked. A sign on it says “NO GIANTS” in marker.)', '(Still locked. Under the sign, smaller: “this means you”.)']));
});

/* ---------- Partner's own intentions (smart objects) ---------- */
G.SMART = [
  { id: 'sofa', spot: { x: 6.55, z: 2.95 }, seatAt: { x: 7.5, z: 2.95, yaw: Math.PI, y: 0.6 }, dur: [10, 18], lines: ['Sofa claimed.', 'This is my sofa now. Pay rent.', '*flops dramatically*'] },
  { id: 'lwin', spot: { x: 9.4, z: 4.08 }, yaw: 0, dur: [5, 8], look: { x: 9.4, y: 1.6, z: 8 }, lines: ['Cloud looks like you. Big. Soft.', 'There’s a squirrel and he’s being weird about the snow.'] },
  { id: 'basil', spot: { x: 9.85, z: 3.72 }, yaw: 0.8, dur: [4, 7], look: { x: 10.4, y: 0.7, z: 4.2 }, lines: ['You’re doing amazing, Basil.', 'Don’t tell the {giant}, but you’re my favourite.'] },
  { id: 'books', spot: { x: 6.2, z: 0.95 }, yaw: Math.PI, dur: [5, 9], look: { x: 6.15, y: 1.2, z: 0.2 }, lines: ['I’m reading this one. I’ve been reading it for a year.', 'Who owns six copies of the same cookbook? Us. We do.'] },
  { id: 'fridge', spot: { x: 14.35, z: 1.22 }, yaw: Math.PI, dur: [3, 5], look: { x: 14.5, y: 1.1, z: 0.4 }, lines: ['*rustling* …nothing.', '*steals a grape*', 'We need cheese. Spiritually.'] },
  { id: 'study', spot: { x: 14.5, z: 3.85 }, yaw: Math.PI / 2, dur: [12, 22], hide: true, exit: { x: 14.45, z: 3.85, yaw: -Math.PI / 2 }, line: 'Birthday business. Don’t follow me.', cond: () => morning() && !S.flags.pancakesMade },
  { id: 'bwin', spot: { x: 2.4, z: 4.05 }, yaw: 0, dur: [4, 6], look: { x: 2.4, y: 1.4, z: 7 }, lines: ['Morning, Gerald.', 'Gerald’s back.'] },
  { id: 'kwin', spot: { x: 13.0, z: 4.1 }, yaw: 0, dur: [4, 6], look: { x: 13, y: 1.4, z: 8 }, lines: ['It’s so white out there. Like someone deleted the world.', 'Somebody drew a heart on the porch rail. It was me. Don’t look.'] },
];

async function sitSofa() {
  if (PARTNER.hold) G.setHold(false);
  const S0 = G.SOFA, from = { x: PLAYER.x, z: PLAYER.z, yaw: PLAYER.yaw };
  await G.sitDown(PLAYER, S0.x + 0.45, S0.z - 0.05, Math.PI, S0.seatY);
  PLAYER.freeSit = from;
  const partnerThere = PARTNER.task && PARTNER.task.o.id === 'sofa' && PARTNER.task.phase === 'do';
  if (partnerThere) { S.mem.affection++; addBond(0.4); G.bark(['*leans on you*', 'Mm. Pillow’s here.', 'Oh good. Heater.'], 2.4); return; }
  await N(S.flags.sofaN ? '(The sofa. It knows the exact shape of both of you.)' : '(You sink into the sofa. It makes a noise like it’s been waiting for you.)');
  S.flags.sofaN = 1;
  if (!PARTNER.lie && !PARTNER.hidden && dist() < 9 && PARTNER.mode === 'follow' && !PARTNER.hold) {
    if (PARTNER.task) G.endPartnerTask();
    const o = G.SMART.find((x) => x.id === 'sofa');
    PARTNER.task = { o, phase: 'go', t: 0 };
    S.mem.affection++; addBond(0.4);
  }
}

/* =====================================================================
 * Together: hug, hold hands, tease, kiss, talk
 * ===================================================================== */
const TALKS = {
  morning: [
    { id: 'gift', run: async () => {
      await P('What do you want for your birthday?');
      const c = await choose(['“Pancakes.”', '“You.”', '“To know what’s in the study.”']);
      if (c === 0) await P('Pancakes aren’t a gift. They’re a lifestyle.');
      if (c === 1) { addBond(0.5); await P('Ugh. Gross. …You already have me. That’s not a gift, that’s a returns policy.'); }
      if (c === 2) await P('Nice try. NO GIANTS.');
    } },
    { id: 'dream', run: async () => { await P('I had a dream we were kids again, and you were exactly this size.'); await Y('That’s horrifying.'); await P('It was. You couldn’t fit on the sledge.'); } },
  ],
  evening: [
    { id: 'fair', run: async () => { await P('Remember that winter fair? Where we met?'); await Y('Vaguely.'); await P('Same. Vaguely is my favourite way to remember things.'); } },
  ],
  any: [
    { id: 'size', run: async () => { await P('Why are you so big.'); await Y('Why are you so small.'); await P('Concentrated.'); } },
  ],
};
async function talk() {
  const pool = (TALKS[ch()] || []).concat(TALKS.any);
  const t = pool.find((x) => !S.talked[x.id]);
  if (!t) { await P(pick(['Hi.', 'What?', 'You just wanted to hear my voice.', 'Mm?', 'I’m listening. Adorably.'])); return; }
  S.talked[t.id] = true;
  await t.run();
}
const TEASES = [
  ['You have pillow face.', 'You have pillow PERSONALITY.'],
  ['Your hair looks like a hedgehog lost a fight.', 'The hedgehog won, actually.'],
  ['I’m older AND wiser now.', 'Older, sure.'],
  ['You’re so small.', 'I’m concentrated.'],
  ['{gremlin}.', 'Lamp post.'],
  ['You’re staring.', 'I’m looking. Correction: YOU’RE staring.'],
];
async function together() {
  if (G.busy() || S.flags.noTogether) return;
  const p = PARTNER;
  const seated = (p.sit || 0) > 0.3 || (PLAYER.sit || 0) > 0.3;
  const acts = [];
  if (!seated) acts.push({ id: 'hug', t: 'Hug' }, { id: 'hand', t: p.hold ? 'Let go' : 'Hold hands' });
  acts.push({ id: 'tease', t: 'Tease' }, { id: 'kiss', t: 'Kiss' }, { id: 'talk', t: 'Talk' });
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
      await G.hug('hug', S.mem.hugs === 1 ? 'Oh! Hello. Birthday hug. Accepted.' : ['Mmf. Squished.', 'You’re so warm. Unfair.', 'Okay you can stop. Don’t stop.', '*nuzzles your shoulder*', 'Ten out of ten hug.']);
      return;
    }
    case 'hand': {
      if (p.hold) { G.setHold(false); G.bark(['Aw.', 'Fine. Free range.', 'Okay.'], 1.6); return; }
      G.setHold(true); S.mem.holds++; S.mem.affection++; addBond(S.mem.holds < 6 ? 0.3 : 0.05);
      G.bark(['*laces fingers*', 'Swinging privileges?', 'Ooh. Fancy.', '*swings your hand*'], 2);
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
      const line = ['Mm. Cheeky.', 'Birthday kiss. Noted.', 'Again? Greedy.', 'Your breath is birthday breath.', '*flustered noise*', 'You can’t just DO that. …Do it again.'];
      if (seated || !(await G.hug('kiss', line))) G.bark(line, 2.4);
      return;
    }
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
    if (!silent) G.bark('*enormous yawn*', 2);
  },
  async morningCuddle() {
    S.flags.inBedScene = true; S.flags.cuddled = true;
    STATE.sceneShot = true;
    await G.cutTo(() => { G.lieDown(PLAYER, G.BED.L, 2.26, 0.15, 0.35); G.shapeBed({ L: true, R: true }); G.setShot(bedCloseShot()); });
    await N('(You climb back in. They don’t open their eyes. They just shift until they’re against you again.)', { shot: 'keep' });
    PARTNER.lidsClosed = true;
    await P('Knew you’d come back.', { shot: 'keep' });
    await Y('It’s my birthday. I do what I want.', { shot: 'keep' });
    await P('Mm. Ten more minutes. Birthday rules.', { shot: 'keep' });
    addBond(1); S.mem.affection++;
    await G.fade(true); await wait(0.8); await G.fade(false);
    await N('(It is not ten minutes.)', { shot: 'keep' });
    PARTNER.lidsClosed = false;
    await P('…Okay. Okay. Pancakes. I’m getting up. Spiritually.', { shot: 'keep' });
    await G.cutTo(() => { G.standAt(PLAYER, 1.1, 1.9, Math.PI / 2); Story.partnerGetsUp(true); STATE.sceneShot = false; G.releaseCamera(); });
    addScrap('blanket', 'Ten more minutes. (It was not ten minutes.)');
    S.flags.inBedScene = false;
  },
  async makePancakes() {
    const k = K();
    STATE.sceneShot = true;
    await G.slideTo(PLAYER, 12.22, 0.97, Math.PI, 0.35);   // stand at the hob, a little left of the pan, so the camera can see both
    G.setShot(panShot());
    k.burner.material.opacity = 0.8; G.Audio.sizzle(true);
    await N('(Flour, eggs, milk, a pinch of salt. The pan hisses.)', { shot: 'keep' });
    k.pancakeInPan.visible = true;
    const col = (q) => (q > 0.75 ? '#e0ad66' : q > 0.35 ? '#c58a46' : '#5a3a22');
    const sc = await G.UI.timing({ title: 'Flip the pancakes', rounds: 3, zone: [0.58, 0.74], labels: ['Charcoal.', 'Pancake-shaped.', 'Golden.'], onPress: (q) => { G.Audio.flip(); flipAnim(k.pancakeInPan, col(q)); } });
    const avg = sc.reduce((a, b) => a + b, 0) / sc.length;
    const q = (S.flags.pancakeQuality = avg > 0.7 ? 'golden' : avg > 0.38 ? 'fine' : 'burnt');
    k.burner.material.opacity = 0; G.Audio.sizzle(false); k.pancakeInPan.visible = false;
    S.flags.pancakesMade = true;
    setBreakfast({ mugs: S.flags.teaMade, plates: true, burnt: q === 'burnt' });
    G.setShot(tableShot('B')); G.CAM.cut = true;
    await N(q === 'golden' ? '(A stack of perfect golden pancakes. You are, briefly, a god.)' : q === 'fine' ? '(A stack of pancakes. Most of them are pancake-shaped.)' : '(A stack of pancakes. The bottom one is more of a concept.)', { shot: 'keep' });
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.cut = true;
    // She comes running, from wherever she was.
    const p = PARTNER;
    if (p.lie) Story.partnerGetsUp(true);
    if (p.task) G.endPartnerTask();
    if (p.hold) G.setHold(false);
    p.mode = 'script';
    G.bark('Is that PANCAKES?!', 2.6);
    const A = k.chairs.A;
    G.walkTo(p, A.x, A.z + 0.52, 1.6).then(async () => { if (S.flags.breakfastDone) return; await G.sitDown(p, A.x, A.z, A.yaw, A.seatY); p.mode = 'seated'; });
  },
  async breakfast() {
    const p = PARTNER, k = K();
    if (p.hold) G.setHold(false);
    const c = await choose(['Sit beside them', 'Sit across from them']);
    const seat = c === 0 ? 'B' : 'C', ch2 = k.chairs[seat];
    STATE.sceneShot = true;
    await G.cutTo(() => { if (p.mode !== 'seated') { p.script = null; p.slide = null; const A = k.chairs.A; G.sitAt(p, A.x, A.z, A.yaw, A.seatY); p.mode = 'seated'; } G.sitAt(PLAYER, ch2.x, ch2.z, ch2.yaw, ch2.seatY); setBreakfast({ mugs: S.flags.teaMade, plates: true, seat, burnt: S.flags.pancakeQuality === 'burnt' }); G.setShot(tableShot(seat)); });
    if (c === 0) { S.mem.sitBeside++; addBond(0.5); await P('Oh, we’re doing beside today. Scandalous.', { shot: 'keep' }); }
    else { S.mem.sitAcross++; await P('Across. Fancy. Like a business meeting.', { shot: 'keep' }); }
    const q = S.flags.pancakeQuality;
    if (q === 'golden') await P('These are… annoyingly good. I’m annoyed.', { shot: 'keep' });
    else if (q === 'fine') await P('Mm. Pancakes. Ten out of ten for shape effort.', { shot: 'keep' });
    else await P('Crunchy. Bold choice. I respect it.', { shot: 'keep' });
    if (S.flags.teaMade) await P('And tea! Two sugars? …Don’t tell anyone.', { shot: 'keep' });
    if (S.flags.snackDone && S.mem.snacks) await P('Also somebody left a biscuit on a napkin for me. Like a tiny gift. I’m keeping it forever. I already ate it.', { shot: 'keep' });
    await N('(Their fork drifts, casually, toward your plate.)', { shot: 'keep' });
    const s = await choose(['Let it happen', 'Defend your pancake', 'Slide the whole plate over']);
    const bite = () => setBreakfast({ mugs: S.flags.teaMade, plates: true, seat, bite: true, burnt: q === 'burnt' });
    if (s === 0) { bite(); await P('*chewing* …What? It looked lonely.', { shot: 'keep' }); S.mem.foodStolen++; addBond(0.3); }
    else if (s === 1) {
      addRivalry(1);
      await P('Ow! Fork violence! On your birthday!', { shot: 'keep' });
      await N('(You look away for one second. One.)', { shot: 'keep' });
      bite();
      await P('Mine now.', { shot: 'keep' });
      S.mem.foodStolen++;
    } else { bite(); await P('…You’re disgustingly nice. Happy birthday.', { shot: 'keep' }); S.mem.foodShared++; addBond(1); }
    addScrap('pancakes', q === 'burnt' ? 'Birthday pancakes. Structurally ambitious. Somebody stole a bite anyway.' : 'Birthday pancakes. Somebody stole a bite. (It was {P}.)');
    await P('Okay. Birthday walk. The meadow, the hill, the lake. I’ve planned this extensively.', { shot: 'keep' });
    await Y('Since when?', { shot: 'keep' });
    await P('Since about four minutes ago. Boots!', { shot: 'keep' });
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
  await N('(Morning. Warm. Something is breathing on your neck.)', { shot: 'keep' });
  await P('…Mmf. Don’t move. You’re warm.', { shot: 'keep' });
  await Y('You took the entire blanket.', { shot: 'keep' });
  PARTNER.lidsClosed = false;
  await P('Our blanket.', { shot: 'keep' });
  await Y('It’s on your side.', { shot: 'keep' });
  await P('I don’t recognize sides.', { shot: 'keep' });
  const c = await choose(['Stay a little longer', 'Steal the blanket back', 'Get up']);
  if (c === 0) {
    addBond(1); S.mem.affection++;
    PARTNER.lidsClosed = true;
    await N('(You stay. They burrow into your side like they were measured for it.)', { shot: 'keep' });
    await P('Good. Correct answer.', { shot: 'keep' });
    await P('Happy birthday, by the way.', { shot: 'keep' });
    await Y('You said that into my armpit.', { shot: 'keep' });
    await P('Your armpit’s invited too.', { shot: 'keep' });
    PARTNER.lidsClosed = false;
  } else if (c === 1) {
    addRivalry(1);
    await slideBlanket(-1);
    await N('(One heroic tug. The blanket is yours. Briefly.)', { shot: 'keep' });
    await P('Thief. On your birthday. Shameless.', { shot: 'keep' });
    await slideBlanket(0.35);
    await N('(It is back on their side within four seconds. You did not see how.)', { shot: 'keep' });
    await P('Happy birthday, though. Thief.', { shot: 'keep' });
    addScrap('blanket', 'The Great Blanket Robbery. (Lasted four seconds.)');
  } else {
    await N('(You start to get up. A pillow hits you in the back of the head.)', { shot: 'keep' });
    await P('Traitor.', { shot: 'keep' });
    await P('…Happy birthday, traitor.', { shot: 'keep' });
  }
  await Y('Morning, {gremlin}.', { shot: 'keep' });
  await P('Birthday people make breakfast. It’s the law.', { shot: 'keep' });
  await Y('That’s not the law.', { shot: 'keep' });
  await P('I’m the law. …Pancakes. Please. I’ll be up in a minute.', { shot: 'keep' });
  await G.cutTo(() => {
    G.standAt(PLAYER, 1.1, 1.9, Math.PI / 2);
    G.shapeBed({ R: true }, c === 1 ? 0.35 : 0);
    PARTNER.lieLook = -0.2; PARTNER.lidsClosed = true;
    STATE.sceneShot = false; G.releaseCamera(); G.CAM.yaw = -Math.PI / 2 + Math.PI; G.CAM.cut = true;
  });
  STATE.busy = false;
  G.hint(G.MOBILE ? 'Tap Use near things to interact. Tap ♥ near {P} to be together.' : 'E or Space: interact.   Q: be together (hug, hold hands, talk).', 9);
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
    const lines = () => (S.flags.pancakesMade ? ['(They’re at the kitchen table. With a fork. Waiting.)'] : ['(Pancakes. They said pancakes.)', '(The kitchen is through the living room, past the fire.)']);
    while (live() && !S.flags.breakfastDone) { await wait(5); idle = PLAYER.speed < 0.1 && !G.busy() ? idle + 5 : 0; if (idle > 40) { const L = lines(); G.hint(L[i++ % L.length], 5); idle = -20; } }
  })();
  await until(() => S.flags.breakfastDone);
  G.setHold(false);
  PARTNER.lead = { x: 6.45, z: 7.95, waitLines: ['Boots! Birthday walk!', 'Come ON, slowpoke.', 'The day isn’t getting any younger. Neither are you.'] };
  G.bark('Boots! Birthday walk!', 2.6);
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
  await G.UI.card(['The birthday walk.', 'The meadow, the hill, the frozen lake —', 'and the long way home.'], { hold: 4.6, stagger: 0.9 });
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
bench.act = () => { if (ch() === 'evening') return G.Story.porch(); return run(() => N(cyc('bench', ['(Someone carved two initials into the bench. Not you. Probably.)', '(The bench is cold enough to count as a dare. Later. When there are stars.)']))); };
G.$('pScrap').addEventListener('click', () => { G.UI.scrapbook(S.scrap); });
})();
