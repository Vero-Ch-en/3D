'use strict';
/* =========================================================================
 * Game: state, loop, interaction, camera, saves and Echo Memory, menus.
 * ========================================================================= */
const KEY_SAVE = 'cbs.cycleSave.v1';
const KEY_ECHO = 'cbs.echoMemory.v1';
const KEY_OBS = 'cbs.entity.observations';

function freshState() {
  return {
    mode: 'title', map: null, mapId: null,
    player: null, partner: null, extras: [], real: null,
    control: false, busy: false, chapter: null, cycle: 1,
    vars: { bond: 0, trust: 0, rivalry: 0, fear: 0, suspicion: 0 },
    mem: { waits: 0, comforts: 0, hugs: 0, holds: 0, teases: 0, kisses: 0, fridge: 0, foodStolen: 0, foodShared: 0, snacks: 0, letWin: 0, raceWins: 0, flowers: 0, partnerFlowers: 0, sitBeside: 0, sitAcross: 0, affection: 0, partnerInit: 0, acceptedFake: 0, stones: 0, ranAhead: 0 },
    flags: {},
    env: { dark: 0, warm: 0.4, snow: 0, desat: 0, zoom: 1, white: 0, snowGround: 0, darkRGB: '12,16,34', snowIndoor: false, snowWind: 0.3 },
    envT: { dark: 0, warm: 0.4, snow: 0, desat: 0, zoom: 1, white: 0, snowGround: 0 },
    scrap: [], trail: [], hooks: [], obs: {}, t: 0, idleT: 0,
  };
}
let S = freshState();

const DEFAULT_SCRAP = [
  { art: 'lake', caption: 'Lake trip. Someone sneezed. (Not naming names. It was {P}.)' },
  { art: 'cake', caption: 'Whose wedding was this?? Great cake though.' },
  { art: 'pressed', caption: 'Pressed flowers from the park. ({P} says the park. I say the other park.)' },
  { art: 'note', caption: 'Birthday, a few years ago. You made me wear the hat. I have never forgiven you. (Kept the hat.)' },
];

/* ---------------- Echo Memory (persists across cycles) ---------------- */
const Echo = {
  data: null,
  fresh() { return { cycle: 1, endings: [], last: null, habits: { waits: 0, affection: 0, comforts: 0, letWin: 0, fridge: 0, sitBeside: 0, sitAcross: 0 }, flaws: [], done: false }; },
  load() {
    try { this.data = JSON.parse(localStorage.getItem(KEY_ECHO)); } catch (e) { this.data = null; }
    if (!this.data || !this.data.habits) this.data = this.fresh();
  },
  save() { try { localStorage.setItem(KEY_ECHO, JSON.stringify(this.data)); } catch (e) { /* private mode */ } },
  reset() {
    try { localStorage.removeItem(KEY_ECHO); localStorage.removeItem(KEY_SAVE); localStorage.removeItem(KEY_OBS); } catch (e) { /* ignore */ }
    this.data = this.fresh();
  },
  learn(flaw) { if (!this.data.flaws.includes(flaw)) this.data.flaws.push(flaw); this.save(); },
};

/* ---------------- The Entity's notes (developer console only) ---------------- */
const OBS = {
  start: () => `PAIR_00491\nCYCLE ${S.cycle}\n\nObservation resumed.`,
  wait: (n) => (n === 3 ? 'A waits.\nFrequently.\nEven when unnecessary.' : null),
  ahead: (n) => (n === 2 ? 'A assumes B will follow.\nB usually does.' : null),
  fridge: (n) => (n === 4 ? 'A opens the cold container repeatedly.\nContents unchanged.\nReason unknown.\n\nRetain for review.' : null),
  affection: (n) => (n === 6 ? 'Prolonged contact events exceed required stabilization duration.\n\nNo corrective action needed.' : null),
  comfort: (n) => (n === 1 ? 'B afraid. A remained.\nNo reward to A detected.\n\nI continue thinking about it.' : null),
  letwin: (n) => (n === 1 ? 'A reduced speed deliberately.\nB won.\nB was not pleased by winning.\n\nContradiction.' : null),
  sleptFake: () => 'A accepted reconstruction for six hours.\nA was asleep.\nAcceptance invalid?\n\nRevising.',
  flaw: () => `IMITATION B / CYCLE ${S.cycle}\n\nRecognized.\nCause: ${S.flags.lastFlaw || 'unknown'}.\n\nLearning.`,
  certainty: (n) => (n === 1 ? 'Reconstruction supplied certainty.\nA did not request certainty.\n\nLogged.' : null),
  chosen: () => 'A and B chose.\nNo verification performed.\n\nWhy does being chosen matter\nif the result is identical?',
};

/* ---------------- Game ---------------- */
const Game = {
  maps: {}, timers: [], waiters: [], lastT: 0, variant: 'first',

  map(id) { return this.maps[id] || (this.maps[id] = World.build(id)); },
  chars() { const a = []; if (S.player) a.push(S.player); if (S.partner) a.push(S.partner); return a.concat(S.extras); },
  setMap(id) {
    S.map = this.map(id); S.mapId = id;
    S.extras = []; S.trail = [];
    Cam.target = null;
  },
  place(c, tx, ty) { c.x = tx * TILE; c.y = ty * TILE; c.path = null; },
  newPair() {
    S.player = makeChar('player', 'player');
    S.partner = makeChar('partner', 'partner', { r: 8 });
  },
  ensurePair() {
    if (!S.player || S.player.lookId !== 'player' || S.player.id !== 'player') S.player = makeChar('player', 'player');
    if (!S.partner || S.partner.lookId !== 'partner' || S.partner.id !== 'partner') S.partner = makeChar('partner', 'partner', { r: 8 });
    const p = S.partner;
    Object.assign(p, { visible: true, inside: false, insideT: null, scripted: false, task: null, lead: null, mode: null, holding: false, pose: 'stand', alpha: 1 });
    S.player.visible = true; S.player.pose = 'stand';
  },
  addExtra(c, tx, ty) { c.x = tx * TILE; c.y = ty * TILE; S.extras.push(c); return c; },
  partnerDist() {
    const p = S.partner, pl = S.player;
    if (!p || !pl || !p.visible) return 99;
    return U.dist(p.x, p.y, pl.x, pl.y) / TILE;
  },
  addBond(v) { S.vars.bond += v; },
  addTrust(v) { S.vars.trust += v; },
  addRivalry(v) { S.vars.rivalry += v; },
  addScrap(art, caption) { S.scrap.push({ art, caption }); },
  suspicion(d) {
    const f = S.partner;
    if (!f || !f.fake || S.flags.fakeWithdrawn) return;
    S.vars.suspicion = Math.max(0, S.vars.suspicion + d);
    const s = S.vars.suspicion;
    if (s >= 2 && !S.flags.sus2) { S.flags.sus2 = true; bark(f, 'It’s me. It’s me, {giant}. Why are you looking at me like that?', 3.4); }
    if (s >= 4 && !S.flags.sus4) { S.flags.sus4 = true; bark(f, 'Ask me anything. Go on. I know everything about us.', 3.4); }
    if (s >= 6 && !S.flags.sus6) { S.flags.sus6 = true; bark(f, 'You’re tired. You had a weird day. Come to bed.', 3.4); }
    if (s >= 8) Story.fakeWithdraw();
  },
  observe(kind) {
    const n = (S.obs[kind] = (S.obs[kind] || 0) + 1);
    const f = OBS[kind];
    const rec = f && f(n);
    if (!rec) return;
    console.log('%c' + rec, 'color:#8a94a6;font-family:ui-monospace,monospace;white-space:pre;line-height:1.5');
    try {
      const list = JSON.parse(localStorage.getItem(KEY_OBS) || '[]');
      list.push(rec);
      localStorage.setItem(KEY_OBS, JSON.stringify(list.slice(-60)));
    } catch (e) { /* ignore */ }
  },
  env(o, instant) {
    for (const k of Object.keys(o)) {
      if (typeof o[k] === 'number') { S.envT[k] = o[k]; if (instant) S.env[k] = o[k]; }
      else S.env[k] = o[k];
    }
  },
  snapCam() {
    const t = Cam.target || [S.player.x, S.player.y - 16];
    Cam.x = t[0]; Cam.y = t[1];
    Cam.zoom = this.targetZoom();
    this.clampCam();
  },
  targetZoom() {
    const m = S.map;
    if (!m) return 2;
    const across = R.W < R.H ? m.tilesAcross * 0.62 : m.tilesAcross;
    return U.clamp(R.W / (across * TILE), 0.8, 3.4) * S.env.zoom;
  },
  clampCam() {
    const m = S.map;
    const hw = R.W / 2 / Cam.zoom, hh = R.H / 2 / Cam.zoom;
    const mw = m.w * TILE, mh = m.h * TILE;
    Cam.x = mw > hw * 2 ? U.clamp(Cam.x, hw, mw - hw) : mw / 2;
    Cam.y = mh > hh * 2 ? U.clamp(Cam.y, hh, mh - hh) : mh / 2;
  },
  walkTo(c, px, py, cb, speed) {
    const path = findPath(S.map, c.x, c.y, px, py);
    c.pose = 'stand'; c.sitLift = 0;
    c.path = path && path.length ? path : [{ x: px, y: py }];
    c.pathSpeed = speed || c.speed;
    c.onArrive = cb || null;
  },
  followPath(c, dt) {
    const tgt = c.path[0];
    const dx = tgt.x - c.x, dy = tgt.y - c.y, d = Math.hypot(dx, dy);
    const sp = c.pathSpeed || c.speed;
    if (d < 2) {
      c.path.shift();
      if (!c.path.length) { c.path = null; c.moving = false; c.running = false; const cb = c.onArrive; c.onArrive = null; if (cb) cb(); }
      return;
    }
    const st = Math.min(d, sp * dt);
    c.x += dx / d * st; c.y += dy / d * st;
    c.dx = dx / d; c.dy = dy / d;
    c.moving = true; c.running = sp > 125; c.walkT += dt * (sp / 92);
  },
  tween(c, props, dur) {
    return new Promise((res) => {
      const from = {}; for (const k in props) from[k] = c[k];
      let t = 0;
      S.hooks.push(function tw(dt) {
        t += dt;
        const k = U.smooth(Math.min(1, t / dur));
        for (const p in props) c[p] = U.lerp(from[p], props[p], k);
        if (t >= dur) { const i = S.hooks.indexOf(tw); if (i >= 0) S.hooks.splice(i, 1); res(); }
      });
    });
  },
  async hop(c, tx, ty) {
    const x0 = c.x, y0 = c.y;
    let t = 0;
    await new Promise((res) => {
      S.hooks.push(function h(dt) {
        t += dt;
        const k = Math.min(1, t / 0.6);
        c.x = U.lerp(x0, tx, k); c.y = U.lerp(y0, ty, k);
        c.sitLift = 0; c.jump = Math.sin(k * Math.PI) * 22;
        if (k >= 1) { c.jump = 0; const i = S.hooks.indexOf(h); if (i >= 0) S.hooks.splice(i, 1); res(); }
      });
    });
    Sound.step('snow');
  },
  runScene(fn) {
    S.busy = true;
    Promise.resolve().then(fn).catch((e) => console.error(e)).finally(() => { S.busy = false; });
  },
  spawnCrowd(n, ghostly, dense) {
    const r = U.rng(n * 7 + (dense ? 3 : 0));
    for (let i = 0; i < n; i++) {
      const look = crowdLook(r);
      if (ghostly) { look.body = '#8b93a6'; look.body2 = '#7b8396'; look.hair = '#5d6475'; look.hat = null; }
      const c = makeChar('crowd' + i, look, { speed: 30 + r() * 20, role: 'crowd', alpha: ghostly ? 0.65 : 1, persist: false });
      const x = dense ? 8 + r() * 30 : 6 + r() * 34, y = dense ? 10 + r() * 30 : 27 + r() * 13;
      if (!canStand(S.map, x * TILE, y * TILE, 6)) continue;
      c.dense = !!dense;
      this.addExtra(c, x, y);
    }
  },
  updateExtra(c, dt) {
    c.blinkT -= dt; if (c.blinkT < -0.15) c.blinkT = U.rand(2, 5);
    if (c.bubble) { c.bubble.age += dt; c.bubble.t -= dt; if (c.bubble.t <= 0) c.bubble = null; }
    if (c.hugT > 0) c.hugT -= dt;
    if (c.path) this.followPath(c, dt);
    if (c.fadeIn) { c.alpha = Math.min(1, c.alpha + dt * 0.7); if (c.alpha >= 1) c.fadeIn = false; }
    if (c.fadeOut) { c.alpha -= dt * 0.8; if (c.alpha <= 0) { c.visible = false; c.dead = true; } }
    if (c.role === 'crowd' && !c.path && U.chance(dt * 0.3)) {
      const x = c.dense ? 8 + Math.random() * 30 : 6 + Math.random() * 34, y = c.dense ? 10 + Math.random() * 30 : 27 + Math.random() * 13;
      this.walkTo(c, x * TILE, y * TILE, null, c.speed);
    }
    if (c.role === 'figure' && !c.met && !c.fadeOut) {
      if (U.dist(c.x, c.y, S.player.x, S.player.y) < 1.7 * TILE) {
        c.met = true;
        faceToward(c, S.player.x, S.player.y);
        const lines = ['There you are!', 'Happy birthday!', 'I remember everything.', 'Stay a little longer?', 'Found you.', 'You keep coming back.'];
        bark(c, lines[(S.flags.figuresMet || 0) % lines.length], 2.6);
        S.flags.figuresMet = (S.flags.figuresMet || 0) + 1;
        setTimeout(() => { c.fadeOut = true; }, 1800);
      } else if (!c.moving && U.chance(dt * 0.2)) c.dx = -c.dx || 0.6;
    }
  },

  /* ---------------- per-frame ---------------- */
  update(dt) {
    if (Input.hit('mute')) { const on = Sound.toggle(); UI.hint(on ? 'Sound on' : 'Sound off', 1.5); this.refreshMenus(); }
    if (S.mode === 'title') {
      if (Input.hit('use')) { const b = document.querySelector('#title-buttons .btn.primary'); if (b) b.click(); }
      Input.endFrame(); return;
    }
    if (S.mode === 'paused') { if (Input.hit('pause')) this.resume(); Input.endFrame(); return; }
    if (S.mode !== 'play') { Input.endFrame(); return; }
    if (Input.hit('pause') && !UI.modal && !UI.ch) { Input.consume('pause'); this.pause(); Input.endFrame(); return; }
    UI.update(dt);
    S.t += dt;
    if (this.timers.length) {
      for (const t of this.timers) t.t -= dt;
      const due = this.timers.filter((t) => t.t <= 0);
      if (due.length) { this.timers = this.timers.filter((t) => t.t > 0); due.forEach((t) => t.r()); }
    }
    const k = 1 - Math.exp(-dt * 1.3);
    for (const key in S.envT) S.env[key] = U.lerp(S.env[key], S.envT[key], k);
    if (!S.map) { Input.endFrame(); return; }
    const free = S.control && !UI.blocking() && !S.busy;
    this.updatePlayer(dt, free);
    if (S.partner) {
      const p = S.partner;
      if (p.path) this.followPath(p, dt);
      PartnerAI.update(p, dt);
      if (p.holdTimer != null && p.holding) { p.holdTimer -= dt; if (p.holdTimer <= 0) { p.holdTimer = null; if (!S.flags.mustHold) p.holding = false; } }
    }
    for (const c of S.extras) this.updateExtra(c, dt);
    if (S.extras.some((c) => c.dead)) S.extras = S.extras.filter((c) => !c.dead);
    for (const h of S.hooks.slice()) h(dt);
    this.behaviourMemory(dt);
    if (this.waiters.length) {
      const ready = this.waiters.filter((w) => { try { return w.pred(); } catch (e) { return false; } });
      if (ready.length) { this.waiters = this.waiters.filter((w) => !ready.includes(w)); ready.forEach((w) => w.r()); }
    }
    this.updateInteraction(free);
    this.updateCamera(dt);
    FX.update(dt);
    Sound.update(dt);
    Input.endFrame();
  },
  updatePlayer(dt, free) {
    const p = S.player;
    if (!p) return;
    p.blinkT -= dt; if (p.blinkT < -0.15) p.blinkT = U.rand(2, 5);
    if (p.bubble) { p.bubble.age += dt; p.bubble.t -= dt; if (p.bubble.t <= 0) p.bubble = null; }
    if (p.hugT > 0) p.hugT -= dt;
    p.holding = !!(S.partner && S.partner.holding && S.partner.visible);
    if (p.path) { this.followPath(p, dt); return; }
    if (p.pose === 'lie') { p.moving = false; return; }
    const a = free ? Input.axis() : { x: 0, y: 0 };
    if (p.pose === 'sit') {
      if (free && (a.x || a.y)) { p.pose = 'stand'; p.sitLift = 0; p.y += 6; }
      else { p.moving = false; return; }
    }
    const run = free && Input.down('run');
    const sp = p.speed * (run ? 1.75 : 1);
    if (a.x || a.y) {
      const l = Math.hypot(a.x, a.y) || 1;
      p.dx = a.x / l; p.dy = a.y / l;
      moveChar(S.map, p, a.x * sp * dt, a.y * sp * dt);
      p.moving = true; p.running = run;
      p.walkT += dt * (run ? 1.4 : 1);
      p.stepT = (p.stepT || 0) - dt * (run ? 1.5 : 1);
      if (p.stepT <= 0) {
        p.stepT = 0.36;
        const surf = surfaceOf(S.map.get(Math.floor(p.x / TILE), Math.floor(p.y / TILE)));
        Sound.step(surf);
        if (surf === 'snow' && U.chance(0.5)) FX.snowpuff(p.x, p.y);
      }
      const last = S.trail[S.trail.length - 1];
      if (!last || U.dist(last.x, last.y, p.x, p.y) > 4) { S.trail.push({ x: p.x, y: p.y }); if (S.trail.length > 260) S.trail.shift(); }
      S.idleT = 0;
    } else { p.moving = false; p.running = false; S.idleT = (S.idleT || 0) + dt; }
  },
  behaviourMemory(dt) {
    const p = S.partner;
    if (!S.map || S.map.kind === 'indoor' || !p || !p.visible || p.fake || p.holding || !S.control || p.scripted) return;
    const d = this.partnerDist();
    if (d > 4.5 && !S.player.moving) {
      S.waitT = (S.waitT || 0) + dt;
      if (S.waitT > 1.4 && !S.waitCounted) { S.waitCounted = true; S.mem.waits++; this.addTrust(0.15); this.observe('wait'); }
    }
    if (d < 2.5) { S.waitT = 0; S.waitCounted = false; }
    if (d > 7 && S.player.running) { S.aheadT = (S.aheadT || 0) + dt; if (S.aheadT > 3) { S.aheadT = -20; S.mem.ranAhead++; this.observe('ahead'); } }
  },
  findTarget() {
    const p = S.player;
    let best = null, bs = 1e9;
    for (const o of S.map.objects) {
      if (!o.visible || !o.use) continue;
      const label = typeof o.label === 'function' ? o.label(o) : o.label;
      if (!label) continue;
      const d = rectDist(p.x, p.y - 6, o);
      if (d > o.range) continue;
      const cx = (o.x + o.w / 2) * TILE, cy = (o.y + o.h / 2) * TILE;
      const fx = cx - p.x, fy = cy - p.y, fl = Math.hypot(fx, fy) || 1;
      const score = d - ((fx * p.dx + fy * p.dy) / fl) * 0.35;
      if (score < bs) { bs = score; best = { o, label }; }
    }
    return best;
  },
  canTogether() {
    const p = S.partner;
    if (!p || !p.visible || p.inside || S.flags.noTogether) return false;
    if (p.pose === 'lie' && S.player.pose !== 'lie') return false;
    return this.partnerDist() < 1.9;
  },
  updateInteraction(free) {
    if (!free) { UI.prompt(null); return; }
    const tgt = this.findTarget();
    const near = this.canTogether();
    let html = '';
    if (tgt) html += `<span class="key">${UI.touch ? 'Use' : 'E'}</span>${esc(U.fmt(tgt.label))}`;
    if (near) html += `${html ? '<span class="sep"></span>' : ''}<span class="key">${UI.touch ? '♥' : 'Q'}</span>Together`;
    UI.prompt(html || null);
    if (tgt && Input.hit('use')) { Input.consume('use'); this.runScene(() => tgt.o.use(tgt.o)); }
    else if (near && Input.hit('together')) {
      Input.consume('together');
      this.runScene(async () => { const id = await UI.together(PartnerAI.actions()); await PartnerAI.together(id); });
    }
  },
  updateCamera(dt) {
    const z = this.targetZoom();
    Cam.zoom = U.lerp(Cam.zoom, z, 1 - Math.exp(-dt * 2.5));
    const t = Cam.target || [S.player.x, S.player.y - 16];
    const k = 1 - Math.exp(-dt * 4);
    Cam.x = U.lerp(Cam.x, t[0], k); Cam.y = U.lerp(Cam.y, t[1], k);
    this.clampCam();
    Cam.shake *= Math.exp(-dt * 5);
    if (Cam.shake < 0.1) Cam.shake = 0;
  },

  /* ---------------- saves ---------------- */
  checkpoint(chapter) {
    const data = { v: 1, cycle: S.cycle, chapter, vars: S.vars, mem: S.mem, flags: S.flags, scrap: S.scrap };
    try { localStorage.setItem(KEY_SAVE, JSON.stringify(data)); } catch (e) { /* ignore */ }
  },
  loadSave() { try { return JSON.parse(localStorage.getItem(KEY_SAVE)); } catch (e) { return null; } },
  finish(id) {
    const e = Echo.data;
    e.endings.push(id); e.last = id; e.cycle = e.endings.length + 1;
    const h = e.habits, m = S.mem;
    h.waits += m.waits; h.affection += m.affection; h.comforts += m.comforts; h.letWin += m.letWin; h.fridge += m.fridge; h.sitBeside += m.sitBeside; h.sitAcross += m.sitAcross;
    if (id === 'firstsnow') e.done = true;
    Echo.save();
    try { localStorage.removeItem(KEY_SAVE); } catch (err) { /* ignore */ }
    this.showTitle();
  },
  crash(e) {
    UI.hint('Something went wrong. Returning to the title screen…', 5);
    setTimeout(() => this.showTitle(), 1500);
  },

  /* ---------------- menus ---------------- */
  titleVariant() {
    const e = Echo.data;
    if (!e || !e.last) return 'first';
    return e.last;
  },
  begin(cycle) {
    S = freshState();
    S.cycle = cycle;
    S.scrap = DEFAULT_SCRAP.map((p) => Object.assign({}, p));
    this.maps = {}; this.timers = []; this.waiters = [];
    S.mode = 'play';
    document.getElementById('title').classList.add('hidden');
    UI.showTouch(true);
    Sound.setAmbience({});
    Story.go(cycle >= 2 ? 'echo_morning' : 'prologue');
  },
  startNew() {
    Echo.load();
    if (Echo.data.done) Echo.reset();
    try { localStorage.removeItem(KEY_SAVE); } catch (e) { /* ignore */ }
    this.begin(Echo.data.endings.length + 1);
  },
  continueSave() {
    const sv = this.loadSave();
    if (!sv) return this.startNew();
    S = freshState();
    S.cycle = sv.cycle; S.vars = sv.vars; S.mem = Object.assign(freshState().mem, sv.mem); S.flags = sv.flags || {}; S.scrap = sv.scrap || DEFAULT_SCRAP.slice();
    this.maps = {}; this.timers = []; this.waiters = [];
    S.mode = 'play';
    document.getElementById('title').classList.add('hidden');
    UI.showTouch(true);
    Story.go(sv.chapter);
  },
  showTitle() {
    S.mode = 'title';
    S.control = false;
    this.timers = []; this.waiters = [];
    UI.prompt(null); UI.showTouch(false);
    for (const id of ['dialogue', 'choices', 'together', 'minigame', 'scrapbook', 'viewer', 'ending', 'pause']) { const el = document.getElementById(id); if (el) el.className = 'hidden'; }
    UI.dlg = null; UI.ch = null; UI.cardState = null; UI.modal = null; UI.mg = null; UI.tg = null; UI.sb = null;
    UI.resetQueue();
    document.getElementById('card').className = 'hide';
    UI.setFade(0);
    Echo.load();
    const v = this.titleVariant();
    Sound.setAmbience(v === 'firstsnow' ? { wind: 0.2, crowd: 0.15, pad: 0.4 } : v === 'perfect' ? { wind: 0.25, hum: 0.15 } : { pad: 0.6, wind: 0.08 });
    this.refreshMenus();
    document.getElementById('title').classList.remove('hidden');
  },
  refreshMenus() {
    const e = Echo.data || Echo.fresh();
    const sv = this.loadSave();
    const n = e.endings.length;
    const sub = document.getElementById('title-sub');
    const lines = {
      0: 'A birthday. A house. Someone you know very, very well.',
      1: 'You came back.',
      2: 'You keep coming back.',
    };
    sub.textContent = e.done ? 'For once, it ended.' : (lines[Math.min(n, 2)]);
    const box = document.getElementById('title-buttons');
    box.innerHTML = '';
    const add = (label, fn, cls) => { const b = document.createElement('button'); b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = label; b.addEventListener('click', () => { Sound.init(); Sound.resume(); fn(); }); box.appendChild(b); return b; };
    if (sv && !e.done) add('Continue', () => this.continueSave(), 'primary');
    add(e.done ? 'Begin a new story' : n === 0 ? 'Begin' : 'Begin again', () => this.startNew(), sv ? '' : 'primary');
    if (n > 0 || sv) {
      const er = add('Erase all echoes', () => {
        if (er.dataset.confirm) { Echo.reset(); this.showTitle(); return; }
        er.dataset.confirm = '1'; er.textContent = 'Erase everything? Tap again to confirm.';
        setTimeout(() => { if (er.isConnected) { delete er.dataset.confirm; er.textContent = 'Erase all echoes'; } }, 4000);
      }, 'quiet');
    }
    add(Sound.enabled ? 'Sound: on' : 'Sound: off', () => { Sound.toggle(); this.refreshMenus(); }, 'quiet');
    const ps = document.getElementById('pause-sound');
    if (ps) ps.textContent = Sound.enabled ? 'Sound: on' : 'Sound: off';
    const foot = document.getElementById('title-foot');
    foot.textContent = n > 0 && !e.done ? `Endings found: ${n}` : '';
  },
  pause() {
    S.mode = 'paused';
    document.getElementById('pause').className = '';
    this.refreshMenus();
  },
  resume() {
    S.mode = 'play';
    document.getElementById('pause').className = 'hidden';
  },
};

/* ---------------- boot ---------------- */
function boot() {
  Input.init();
  UI.init();
  R.init(document.getElementById('view'));
  Echo.load();
  document.getElementById('pause-resume').addEventListener('click', () => Game.resume());
  document.getElementById('pause-sound').addEventListener('click', () => { Sound.toggle(); Game.refreshMenus(); });
  document.getElementById('pause-title').addEventListener('click', () => Game.showTitle());
  Game.showTitle();
  const q = new URLSearchParams(location.search);
  if (q.has('debug')) {
    window.CBS = { get S() { return S; }, Game, Story, UI, Echo, World, Input, Sound, CH, Cam };
    Game.timeScale = Math.min(8, Math.max(1, +q.get('speed') || 1));
    if (q.get('chapter')) {
      const cycle = q.get('chapter').startsWith('echo') || ['firstsnow', 'winter'].includes(q.get('chapter')) ? 2 : 1;
      S = freshState(); S.cycle = cycle; S.scrap = DEFAULT_SCRAP.slice();
      Game.maps = {};
      S.mode = 'play';
      document.getElementById('title').classList.add('hidden');
      UI.showTouch(true);
      Story.go(q.get('chapter'));
    }
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try { Game.update(dt * (Game.timeScale || 1)); R.frame(now / 1000, dt); }
    catch (e) { console.error(e); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
window.addEventListener('DOMContentLoaded', boot);
