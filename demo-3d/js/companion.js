'use strict';
/* =========================================================================
 * Partner, more helpful and more aware (his route, free time only).
 *  - She knows what the day is waiting for (pancakes, breakfast, the cake, the sofa, the porch). If you've been
 *    wandering a while without getting closer, she says so in her own words, walks a few steps that way and points.
 *  - She notices when you're walking into a wall.
 *  - She remembers the day you've had: the pinecones, the race, the ambush, the branch, the fox, the photographs,
 *    the snowman; and the circle, which she doesn't want to talk about.
 *  - She feeds the fire herself when it's getting low and there are logs in the basket (life.js).
 * Not in the night or Act IV: that isn't her.
 * ========================================================================= */
(G.afterBuild = G.afterBuild || []).push(() => {
const { PLAYER, PARTNER, STATE } = G;
const A = G.SAPI, S = A.S;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist = () => Math.hypot(PARTNER.x - PLAYER.x, PARTNER.z - PLAYER.z);
const hers = () => !!G.S && /^(morning|walk|evening|ending_|firstsnow)/.test(S.chapter || '') && !(G.NIGHT && G.NIGHT.swapped);
const canTalk = () => STATE.started && !G.busy() && !PARTNER.hidden && !PARTNER.lie && !PARTNER.bark && !PARTNER.task && !PARTNER.script && !PARTNER.lead && !(S.flags && S.flags.noBarks) && !document.body.classList.contains('ending');

/* ---------- what the day is waiting for ---------- */
function goal() {
  const ch = S.chapter, F = S.flags;
  if (ch === 'morning') {
    if (PARTNER.lie) return null;   // she's still in bed: the hints there are the game's
    if (!F.pancakesMade) return { x: 12.3, z: -1.2, lines: ['Pancakes, {toHim}. The stove’s through in the kitchen. I’ll supervise.', 'The kitchen is that way. The pancakes won’t make themselves. I’ve asked them.'] };
    if (!F.breakfastDone) return { x: 13.0, z: 1.9, lines: ['Breakfast’s on the table. Sit with me before it goes cold.', 'Table, {toHim}. I’m starving and I refuse to eat alone.'] };
    return null;
  }
  if (ch === 'evening' && !STATE.porchDone) {
    if (STATE.watchDoor) return { x: 6.5, z: 3.6, lines: ['Inside, {toHim}. There’s something I want you to see.', 'Come in, come in. Close your eyes. No, open them.'] };
    if (!STATE.cakeDone && G.CAKE) { const p = G.CAKE.g.position; return { x: p.x + 0.6, z: p.z + 0.6, lines: ['There is… something on the table by the fire. Go and look. Don’t ask me why.', 'Have you looked at the table? Go and look at the table.'] }; }
    if (!STATE.cuddled && G.SOFA) return { x: G.SOFA.x, z: G.SOFA.z - 0.6, lines: ['Come and sit with me. The sofa’s got our shape in it.', 'Sofa. Blanket. You. In that order.'] };
    if (G.BENCH) return { x: G.BENCH.x, z: G.BENCH.z + 0.8, lines: ['The porch, {toHim}. The stars are out. Come and look.', 'Bring your coat. The bench on the porch has the best view of the sky.'] };
  }
  return null;
}
const HELP = { t: 0, best: 1e9, said: 0, key: null, cd: 0 };
async function pointTowards(g) {
  const p = PARTNER, a = Math.atan2(g.x - p.x, g.z - p.z), d = Math.min(2.2, Math.hypot(g.x - p.x, g.z - p.z) - 1);
  G.bark(g.lines[HELP.said++ % g.lines.length], 3.6);
  if (d > 0.6 && G.navOpen && G.navOpen(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d)) await Promise.race([G.walkTo(p, p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 1.3), G.wait(3)]);
  if (G.busy() || p.task) return;
  p.yaw = Math.atan2(g.x - p.x, g.z - p.z); p.gaze = { x: g.x, z: g.z, headY: 1.0, t: 2.5 };
  p.forcePose = 'wave'; await G.wait(1.1); if (p.forcePose === 'wave') p.forcePose = null;
}
function updateHelp(dt) {
  const g = hers() ? goal() : null;
  if (!g) { HELP.t = 0; HELP.key = null; return; }
  const key = g.lines[0];
  if (key !== HELP.key) { HELP.key = key; HELP.t = 0; HELP.best = 1e9; HELP.said = 0; }
  const d = Math.hypot(PLAYER.x - g.x, PLAYER.z - g.z);
  if (d < HELP.best - 1.5 || d < 2.5) { HELP.best = Math.min(HELP.best, d); HELP.t = 0; return; }   // getting there
  if (G.busy() || STATE.paused) return;
  HELP.t += dt; HELP.cd -= dt;
  const wait = HELP.said ? 75 : 40;
  if (HELP.t > wait && HELP.cd <= 0 && canTalk() && dist() < 7) { HELP.t = 0; HELP.best = d; HELP.cd = 30; A.run(() => pointTowards(g)); }
}

/* ---------- walking into walls ---------- */
const BUMP = { t: 0, cd: 0, x: 0, z: 0 };
function updateBump(dt) {
  BUMP.cd -= dt;
  const pushing = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((k) => G.keys && G.keys.has(k));
  const moved = Math.hypot(PLAYER.x - BUMP.x, PLAYER.z - BUMP.z) / Math.max(dt, 1e-3); BUMP.x = PLAYER.x; BUMP.z = PLAYER.z;
  if (pushing && moved < 0.15 && !G.busy() && !PLAYER.freeSit && !PLAYER.lie && !(PLAYER.sit > 0.1) && !STATE.noControl) BUMP.t += dt; else BUMP.t = 0;
  if (BUMP.t > 1.8 && BUMP.cd <= 0 && hers() && canTalk() && dist() < 6) { BUMP.t = 0; BUMP.cd = 70; G.bark(pick(['That’s a wall, {toHim}. Walls don’t move. I’ve checked.', 'Other way, {dear}.', 'Are you trying to walk through that? Bold.']), 2.8); }
}

/* ---------- the day you've had: she remembers it ---------- */
const MEM = { cd: 40, used: new Set() };
const DAY = [
  { id: 'pine_won', when: () => S.mem.pinecones === 'won', text: 'You won the pinecones. I’ve decided to be gracious about it. Starting tomorrow.' },
  { id: 'pine_lost', when: () => S.mem.pinecones === 'lost', text: 'I still have my victory gloves on. In case you’d forgotten who won the pinecones.' },
  { id: 'burnt', when: () => S.flags.pancakeQuality === 'burnt', text: 'For the record, the burnt pancake was my favourite. It had character.' },
  { id: 'golden', when: () => S.flags.pancakeQuality === 'golden', text: 'Those pancakes this morning. I’m still thinking about them. Is that strange?' },
  { id: 'ambush', when: () => S.flags.mAmbush, text: 'My aim this afternoon was perfect, I thought. Right in the scarf.' },
  { id: 'branch', when: () => S.flags.mBranch, text: 'I haven’t forgotten the branch. I want you to know that I haven’t forgotten the branch.' },
  { id: 'fox', when: () => S.flags.mTracks, text: 'Do you think the fox is all right? The one with opinions.' },
  { id: 'photo', when: () => (S.photos || []).length > 0, text: 'We should look at the photographs later. Even the ones where I’m blinking.' },
  { id: 'snowman', when: () => G.S.life && G.S.life.snowman, text: 'Do you think the snowman’s cold? He doesn’t have a scarf. I worry.' },
  { id: 'hill', when: () => (S.scrap || []).some((p) => p.art === 'hill'), text: 'What you said on the hill. About being the same people. I keep thinking about it.' },
  { id: 'circle', when: () => S.mem.circleSeen, text: 'That ring of grass. I keep thinking about it. …No. I’m not thinking about it. I’ve decided.' },
];
function updateMemories(dt) {
  MEM.cd -= dt;
  if (MEM.cd > 0 || S.chapter !== 'evening' || STATE.watchDoor || !canTalk() || dist() > 4 || (PARTNER.sit || 0) > 0.2) return;
  const b = DAY.find((x) => !MEM.used.has(x.id) && x.when());
  if (!b) return;
  MEM.used.add(b.id); MEM.cd = 55 + Math.random() * 35; G.bark(b.text, 4.2);
}

/* ---------- she joins you at the window ---------- */
const WIN = { cd: 10, n: 0, v: new THREE.Vector3(), q: new THREE.Vector3() };
function windowLine() {
  if (STATE.tod > 0.7) return pick(['What are you looking at? …Oh. The stars are out. All of them, by the look of it.', 'It’s so dark out there. And so bright in here. I like that.']);
  if ((STATE.snow || 0) > 0.5) return pick(['It’s still coming down. We may never leave. What a pity.', 'Look at it. Every flake on its way to somewhere.']);
  return pick(['What are you looking at? …Oh. It’s lovely, isn’t it.', 'You can see our footprints from here. Look. Two sets.']);
}
function updateWindow(dt) {
  WIN.cd -= dt;
  if (WIN.cd > 0 || WIN.n >= 3 || !hers() || !G.WINDOWS || !G.inside(PLAYER.x, PLAYER.z) || (PLAYER.idleT || 0) < 6 || PLAYER.sit > 0.1 || PLAYER.freeSit || !canTalk() || PARTNER.mode !== 'follow' || PARTNER.carry || PARTNER.hold || (PARTNER.sit || 0) > 0.1) return;
  if (dist() > 8) return;
  const fx = Math.sin(PLAYER.yaw), fz = Math.cos(PLAYER.yaw);
  for (const w of G.WINDOWS) {
    w.inn.getWorldPosition(WIN.v);
    if (WIN.v.y > 2.2) continue;   // the gable windows are out of reach of anyone's view
    const dx = WIN.v.x - PLAYER.x, dz = WIN.v.z - PLAYER.z, d = Math.hypot(dx, dz);
    if (d > 1.4 || d < 0.2 || (dx * fx + dz * fz) / d < 0.7) continue;
    // Stand beside him, on whichever side she's nearer, a touch back from the glass.
    const tx = -dz / d, tz = dx / d, side = ((PARTNER.x - PLAYER.x) * tx + (PARTNER.z - PLAYER.z) * tz) >= 0 ? 1 : -1;
    // Try beside him first (her side, then the other), then a little behind; furniture often fills the obvious spot.
    let sx = null, sz = null;
    for (const [lat, back] of [[0.62, 0], [-0.62, 0], [0.8, 0.25], [-0.8, 0.25], [0.5, 0.5], [-0.5, 0.5], [0.95, 0.55], [-0.95, 0.55], [0.3, 0.75], [-0.3, 0.75]]) {
      const x = PLAYER.x + tx * lat * side - (dx / d) * back, z = PLAYER.z + tz * lat * side - (dz / d) * back;
      if (G.inside(x, z) && (!G.navOpen || G.navOpen(x, z))) { sx = x; sz = z; break; }
    }
    if (sx == null) { WIN.cd = 20; return; }
    WIN.cd = 80; WIN.n++;
    const look = { x: WIN.v.x, y: 1.35, z: WIN.v.z };
    PARTNER.task = { o: { id: 'window', spot: { x: sx, z: sz }, yaw: Math.atan2(WIN.v.x - sx, WIN.v.z - sz), dur: [5.5, 6.5], look, noReach: true,
      onArrive: (p) => { p.gaze = { x: look.x, z: look.z, headY: 1.35, t: 5 }; G.bark(windowLine(), 4.2); },
      onEnd: () => {} }, phase: 'go', t: 0 };
    return;
  }
}

/* ---------- running indoors; coming back after leaving her alone ---------- */
const RUN = { t: 0, cd: 30, n: 0 };
function updateRun(dt) {
  RUN.cd -= dt;
  RUN.t = G.inside(PLAYER.x, PLAYER.z) && (PLAYER.speed || 0) > 2.4 ? RUN.t + dt : 0;
  if (RUN.t > 1.5 && RUN.cd <= 0 && RUN.n < 2 && hers() && canTalk() && dist() < 7) {
    RUN.t = 0; RUN.cd = 150; RUN.n++;
    G.bark(RUN.n === 1 ? 'No running in the cabin, {toHim}. House rules. I’ve just made them.' : 'Mind the— …You missed it. Well done.', 3);
  }
}
const AWAY = { t: 0, cd: 0 };
function updateAway(dt) {
  AWAY.cd -= dt;
  if (!/^(morning|evening)$/.test(S.chapter || '') || !hers() || PARTNER.hidden || PARTNER.lie) { AWAY.t = 0; return; }
  const d = dist();
  if (d > 14 && !G.busy()) { AWAY.t += dt; return; }
  if (AWAY.t > 45 && d < 3.5 && AWAY.cd <= 0 && canTalk()) {
    AWAY.t = 0; AWAY.cd = 120;
    G.bark(pick(['There you are. I was about to send out a search party. It was going to be me.', 'Oh, good, you’re back. I missed you. Don’t tell anyone.', 'Where did you get to? …You can tell me later. Come here.']), 3.6);
    PARTNER.gaze = { x: PLAYER.x, z: PLAYER.z, headY: 1.55, t: 2 };
  } else if (d < 3.5) AWAY.t = 0;
}
(G.onJump = G.onJump || []).push(() => { MEM.used.clear(); MEM.cd = 40; HELP.t = 0; HELP.key = null; WIN.n = 0; WIN.cd = 10; RUN.n = 0; AWAY.t = 0; });

G.STEP_HOOKS.push((dt) => {
  if (!STATE.started) return;
  updateAway(dt); updateHelp(dt); updateBump(dt); updateMemories(dt); updateWindow(dt); updateRun(dt);
});
});
