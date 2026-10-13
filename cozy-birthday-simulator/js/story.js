'use strict';
/* =========================================================================
 * Story, cycle 1: prologue → Shared Life → Something Strange → Recognition
 * → Elsewhere → The Last Birthday.
 * ========================================================================= */
const P = (t, o) => UI.say('partner', t, o);
const Y = (t, o) => UI.say('player', t, o);
const N = (t, o) => UI.say(null, t, o);
const E = (t) => UI.say('entity', t, { cls: 'entity', speed: 30 });
const POV = (t) => UI.say('povplayer', t);
const choose = (o) => UI.choose(o);
const wait = (s) => new Promise((r) => Game.timers.push({ t: s, r }));
const until = (pred) => new Promise((r) => Game.waiters.push({ pred, r }));
const walk = (c, tx, ty, sp) => new Promise((r) => Game.walkTo(c, tx * TILE, ty * TILE, r, sp));
const sitAt = (c, tx, ty, o = {}) => { c.path = null; c.x = tx * TILE; c.y = ty * TILE; c.pose = 'sit'; c.sitLift = o.lift == null ? 9 : o.lift; c.sitSort = o.sort == null ? 6 : o.sort; c.dx = o.dx || 0; c.dy = o.dy == null ? 1 : o.dy; c.moving = false; };
const standAt = (c, tx, ty) => { c.path = null; c.x = tx * TILE; c.y = ty * TILE; c.pose = 'stand'; c.sitLift = 0; c.moving = false; };
const inRect = (c, x0, y0, x1, y1) => c.x >= x0 * TILE && c.x <= x1 * TILE && c.y >= y0 * TILE && c.y <= y1 * TILE;

const CH = {};

const Story = {
  async go(id) {
    S.chapter = id;
    S.hooks = [];
    Game.waiters = [];
    UI.clearHint();
    if (S.mode !== 'play') return;
    console.info('[story]', id);
    try { await CH[id](); } catch (e) { console.error('[story]', id, e); Game.crash(e); }
  },
  idleHint(lines, cond, after) {
    (async () => {
      let i = 0;
      const chapter = S.chapter;
      while (S.chapter === chapter && cond()) {
        await wait(4);
        if (S.chapter !== chapter || !cond()) break;
        if ((S.idleT || 0) > after && S.control && !UI.blocking() && !S.busy) { UI.hint(lines[i % lines.length], 5); i++; S.idleT = -after; }
      }
    })();
  },

  /* =================================================================
   * Shared interactions called from world objects
   * ================================================================= */
  async morningCuddle() {
    const bed = S.map.obj('bed');
    S.flags.inBedScene = true;
    S.flags.cuddled = true;
    bed.data.occ.left = S.player; S.player.pose = 'lie'; standAt(S.player, 4.3, 2.4); S.player.pose = 'lie';
    Cam.target = [5.1 * TILE, 3 * TILE];
    await N('(You climb back in. They don’t open their eyes. They just shift until they’re against you again.)');
    await P('Knew you’d come back.');
    await Y('It’s my birthday. I do what I want.');
    await P('Mm. Ten more minutes. Birthday rules.');
    Game.addBond(1); S.mem.affection++; Game.observe('affection');
    await UI.fade(1, 0.8); await wait(0.6); await UI.fade(0, 0.8);
    await N('(It is not ten minutes.)');
    await P('…Okay. Okay. Pancakes. I’m getting up. Spiritually.');
    bed.data.occ.left = null; standAt(S.player, 4.3, 4.9); S.player.dy = 1;
    this.partnerGetsUp();
    Cam.target = null;
    S.flags.inBedScene = false;
  },
  partnerGetsUp() {
    const p = S.partner, bed = Game.map('house').obj('bed');
    if (p.pose !== 'lie') return;
    bed.data.occ.right = null;
    standAt(p, 5.9, 4.9); p.dy = 1; p.scripted = false;
    bark(p, '*enormous yawn*', 2);
  },
  async makePancakes() {
    S.flags.stoveOn = true;
    await N('(Flour, eggs, milk, a pinch of salt. The pan hisses.)');
    const sc = await UI.timing({ title: 'Flip the pancakes', rounds: 3, zone: [0.58, 0.74], labels: ['Charcoal.', 'Pancake-shaped.', 'Golden.'] });
    const avg = sc.reduce((a, b) => a + b, 0) / sc.length;
    const q = S.flags.pancakeQuality = avg > 0.7 ? 'golden' : avg > 0.38 ? 'fine' : 'burnt';
    S.flags.stoveOn = false; S.flags.pancakesMade = true;
    const table = Game.map('house').obj('table');
    table.data.plates = true; table.data.burnt = q === 'burnt';
    await N(q === 'golden' ? '(A stack of perfect golden pancakes. You are, briefly, a god.)' : q === 'fine' ? '(A stack of pancakes. Most of them are pancake-shaped.)' : '(A stack of pancakes. The bottom one is more of a concept.)');
    const p = S.partner;
    if (p.pose === 'lie') this.partnerGetsUp();
    if (p.inside) { p.inside = false; p.insideT = null; p.visible = true; standAt(p, 22.5, 9.6); }
    p.task = null; p.scripted = true; p.holding = false;
    bark(p, 'Is that PANCAKES?!', 2.6);
    Game.walkTo(p, 4.96 * TILE, 17.7 * TILE, () => { sitAt(p, 4.96, 17.7, { dy: -1, lift: 9, sort: 4 }); p.seated = true; }, 130);
  },
  async breakfast() {
    const p = S.partner, pl = S.player, table = Game.map('house').obj('table');
    if (!p.seated) { sitAt(p, 4.96, 17.7, { dy: -1, sort: 4 }); p.seated = true; }
    p.scripted = true;
    const c = await choose(['Sit beside them', 'Sit across from them']);
    if (c === 0) { sitAt(pl, 6.22, 17.7, { dy: -1, sort: 4 }); S.mem.sitBeside++; Game.addBond(0.5); await P('Oh, we’re doing beside today. Scandalous.'); }
    else { sitAt(pl, 4.96, 15.2, { dy: 1, sort: -40, lift: 4 }); S.mem.sitAcross++; await P('Across. Fancy. Like a business meeting.'); }
    const q = S.flags.pancakeQuality;
    if (q === 'golden') await P('These are… annoyingly good. I’m annoyed.');
    else if (q === 'fine') await P('Mm. Pancakes. Ten out of ten for shape effort.');
    else await P('Crunchy. Bold choice. I respect it.');
    if (S.flags.teaMade) await P('And tea! Two sugars? …Don’t tell anyone.');
    await N('(Their fork drifts, casually, toward your plate.)');
    const s = await choose(['Let it happen', 'Defend your pancake', 'Slide the whole plate over']);
    if (s === 0) { await P('*chewing* …What? It looked lonely.'); S.mem.foodStolen++; Game.addBond(0.3); }
    else if (s === 1) {
      Game.addRivalry(1);
      await P('Ow! Fork violence! On your birthday!');
      await N('(You look away for one second. One.)');
      await P('Mine now.');
      S.mem.foodStolen++;
    } else { await P('…You’re disgustingly nice. Happy birthday.'); S.mem.foodShared++; Game.addBond(1); }
    table.data.bite = true;
    Game.addScrap('pancakes', q === 'burnt' ? 'Birthday pancakes. Structurally ambitious. Somebody stole a bite anyway.' : 'Birthday pancakes. Somebody stole a bite. (It was {P}.)');
    await P('Okay. Birthday walk. Meadow, hill, creek. I’ve planned this extensively.');
    await Y('Since when?');
    await P('Since about four minutes ago. Shoes!');
    standAt(pl, 6.2, 18.4); standAt(p, 4.9, 18.4);
    p.seated = false; p.scripted = false;
    S.flags.breakfastDone = true;
  },
  async sitSofa() {
    const p = S.partner, pl = S.player;
    if (isNight() && p.fake && p.visible) {
      sitAt(pl, 21.8, 16.45, { lift: 10, sort: 6 });
      sitAt(p, 20.2, 16.45, { lift: 10, sort: 6 });
      await N('(They sit exactly as far from you as they always do. To the centimetre.)');
      return;
    }
    const partnerOnSofa = p.visible && p.pose === 'sit' && p.task && p.task.o && p.task.o.id === 'sofa';
    sitAt(pl, 21.8, 16.45, { lift: 10, sort: 6 });
    if (partnerOnSofa) {
      S.mem.affection++; Game.addBond(0.4);
      bark(p, U.pick(['*leans on you*', 'Mm. Pillow’s here.', 'Oh good. Heater.']), 2.4);
      return;
    }
    await N(S.flags.sofaN ? '(The sofa. It knows the exact shape of both of you.)' : '(You sink into the sofa. It makes a noise like it’s been waiting for you.)');
    S.flags.sofaN = 1;
    if (p.visible && !p.fake && Game.partnerDist() < 9 && S.vars.fear < 0.45 && !p.scripted && !p.lead) {
      p.task = null;
      Game.walkTo(p, 20.2 * TILE, 16.45 * TILE, () => {
        if (pl.pose !== 'sit') return;
        sitAt(p, 20.2, 16.45, { lift: 10, sort: 6 });
        p.task = { o: Game.map('house').obj('sofa'), phase: 'do', t: 12 };
        bark(p, U.pick(['Scoot.', 'Room for one more?', '*flops onto you*']), 2);
        S.mem.affection++; Game.addBond(0.4);
      }, 100);
    }
  },
  async frontDoor() {
    const c = S.chapter, p = S.partner;
    if (c === 'morning' || c === 'echo_morning') {
      if (!S.flags.breakfastDone) return N('(Breakfast first. Birthday law, apparently.)');
      if (Game.partnerDist() > 3) { bark(p, 'Wait for me!', 2); p.lead = null; p.task = null; await walk(p, 16.2, 20.3, 140); }
      S.flags.leaveHouse = true; return;
    }
    if (c === 'evening') {
      if (!S.flags.firstMeetingTalk) return N('(Not yet. Something is bothering you about this house.)');
      S.flags.goCampfire = true; return;
    }
    if (c === 'bedtime') return N('(It’s late. And snowing. In {P}’s opinion, those are two reasons.)');
    if (c === 'night') { this.nightClue('door'); return N('(The door won’t open. Snow is pressed against the glass from outside, flat, like it’s been packed there.)'); }
    return N('(The front door.)');
  },
  async woodsDoor() {
    const c = S.chapter;
    if (c === 'walk') {
      if (!S.flags.gladeDone) return N('(Not yet. There’s a walk to finish.)');
      S.flags.reachedHome = true; return;
    }
    if (c === 'campfire') {
      if (!S.flags.campfireDone) return N('(Not yet. There’s a fire to sit by.)');
      S.flags.goInside = true; return;
    }
    if (c === 'echo_evening') { await Story.echoHouseDoor(); return; }
    return N('(Home.)');
  },
  fireLabel() {
    const fire = S.map.obj('firepit');
    if ((S.chapter === 'campfire' || S.chapter === 'echo_evening') && !fire.data.lit && S.flags.fireReady) return 'Light the fire';
    if (S.chapter === 'echo_evening' && S.flags.partnerAway && !S.flags.poked) return 'Poke the fire';
    return fire.data.lit ? 'Campfire' : 'Fire pit';
  },
  async useFire() {
    const fire = S.map.obj('firepit');
    if ((S.chapter === 'campfire' || S.chapter === 'echo_evening') && !fire.data.lit && S.flags.fireReady) {
      await N('(It takes three matches and some swearing. {P} provides moral support, loudly.)');
      fire.data.lit = true; S.flags.fireLit = true;
      Sound.setAmbience({ fire: 1, crackle: 1, wind: 0.1 });
      await P(S.chapter === 'echo_evening' ? 'Fire person! My hero! Again!' : 'GO, GO, GO— yes! Fire! We have conquered fire.');
      return;
    }
    if (S.chapter === 'echo_evening' && S.flags.partnerAway && !S.flags.poked) {
      S.flags.poked = true;
      await N('(You poke the fire. It sends up a tall spray of sparks, like it’s showing off.)');
      return;
    }
    if (!fire.data.lit) return N('(A ring of stones and some old ash. You’re the fire person. {P} is the moral support person.)');
    return N('(Warm. The kind of warm that gets into your sleeves.)');
  },
  logLabel() {
    if ((S.chapter === 'campfire' || S.chapter === 'echo_evening') && S.flags.fireLit && !S.flags.logSit) return 'Sit with {P}';
    return 'Log';
  },
  async useLog() {
    if ((S.chapter === 'campfire' || S.chapter === 'echo_evening') && S.flags.fireLit && !S.flags.logSit) { S.flags.logSit = true; return; }
    const log = S.map.obj('logseat');
    await N(log.data.worn ? '(The log is worn smooth in two places, side by side.)' : '(A good log. You’ve sat on it a hundred times.)');
  },
  async pickFlower(o) {
    if (S.chapter !== 'walk') return N('(Wildflowers. They’re doing their best.)');
    o.visible = false; S.mem.flowers++;
    FX.sparkle((o.x + 0.3) * TILE, o.y * TILE, o.data.color);
    Sound.tone(1200, 0.05, { vol: 0.04 });
    if (S.mem.flowers === 1) bark(S.player, 'One.', 1.2);
    if (S.mem.flowers === 4 && S.partner.mode === 'flowers') bark(S.partner, 'Stop picking MY flowers!', 2);
  },
  benchLabel() { return S.flags.benchReady && !S.flags.benchDone ? 'Sit with {P}' : 'Bench'; },
  async useBench() {
    if (S.flags.benchReady && !S.flags.benchDone) { S.flags.benchSit = true; return; }
    await N('(Someone carved “A + B” into the bench. Not you. Probably.)');
  },
  stonesLabel() { return S.flags.stonesReady && !S.flags.stonesDone ? 'Skip stones' : 'Flat stones'; },
  async useStones() {
    if (!(S.flags.stonesReady && !S.flags.stonesDone)) return N('(Flat stones, perfect for skipping. {P} has pocketed the best ones.)');
    S.flags.stonesDone = true;
    await P('Best of three. Loser carries the flowers.');
    const sc = await UI.timing({ title: 'Skip stones', rounds: 3, zone: [0.66, 0.8], speed: 1.25, labels: ['Plop.', 'Two skips.', 'Five skips!'] });
    const mine = sc.map((s) => (s > 0.75 ? U.irand(4, 6) : s > 0.35 ? U.irand(2, 3) : U.irand(0, 1)));
    const sum = mine.reduce((a, b) => a + b, 0);
    S.mem.stones = sum;
    await N(`(You skip ${mine.join(', ')}. ${sum} in total.)`);
    await P('My turn.');
    for (let i = 0; i < 3; i++) { Sound.burst(0.08, { freq: 900, vol: 0.06, when: i * 0.5 }); }
    await N('(Their stones go: two, one, and one that hits a duck-shaped rock.)');
    await P('Seven, nine, and twelve.');
    await Y('That was two, one, and a rock.');
    await P('Seven in spirit.');
    if (sum >= 8) { await P('…Fine. You win stones. I win spirit.'); Game.addRivalry(0.5); }
    Game.addScrap('creek', sum >= 8 ? `Stone skipping. Me: ${sum}. {P}: “spirit”.` : 'Stone skipping. Results disputed. A rock was involved.');
  },
  async gladeFootprints() {
    S.flags.sawFootprints = true;
    await N('(Two sets of small footprints. Children’s. They come from opposite sides and stop in the middle, facing each other.)');
    await P('…Those are tiny feet.');
  },
  async gladeTouch() {
    S.flags.touchedSnow = true;
    await N('(Cold. Real. It squeaks under your thumb the way snow is supposed to.)');
    await P('Don’t touch it. …Okay, you touched it. Don’t tell me if it’s cold.');
  },
  async inspectSnowPhoto(o) {
    o.glint = false;
    if (isEvening() && !S.flags.sawPhoto) {
      await N('(The empty frame isn’t empty.)');
      await UI.photo('snowkids', 'Two small figures in the snow. Lanterns, blurred, far behind them.');
      S.flags.sawPhoto = true;
      return;
    }
    if (isNight()) {
      await UI.photo('snowkids3', 'Two small figures in the snow. And at the very edge, out of focus, a third shape. You don’t remember a third shape.');
      S.flags.sawPhoto3 = true; this.nightClue('photo');
      return;
    }
    await UI.photo('snowkids', 'The snow photograph. Neither of you remembers it being taken.');
  },

  /* ---------- talking (real Partner) ---------- */
  async talk() {
    const pool = (TALKS[S.chapter] || []).concat(TALKS.any);
    const used = S.flags.talked || (S.flags.talked = {});
    const t = pool.find((x) => !used[x.id] && (!x.cond || x.cond()));
    if (!t) { await P(U.pick(['Hi.', 'What?', 'You just wanted to hear my voice.', 'Mm?', 'I’m listening. Adorably.'])); return; }
    used[t.id] = true;
    await t.run();
  },
  async fakeTalk() {
    const f = S.partner;
    const lvl = f.fakeLevel || 1;
    const opts = [{ t: '“Where did you go?”', v: 'where' }, { t: '“What did I say, the first time we met?”', v: 'first' }];
    if (S.flags.whistles) opts.push({ t: '“Do you hear that whistling?”', v: 'whistle' });
    opts.push({ t: '“Who are you?”', v: 'who' }, { t: '“Never mind.”', v: 'none' });
    const c = await choose(opts);
    if (c === 'where') await P(lvl >= 2 ? 'Marshmallows! Keep up.' : 'Water. I told you.');
    if (c === 'first') {
      S.flags.heardCertainty = true; Game.observe('certainty');
      await P('I remember now. All of it.');
      await P('You had a red scarf. There were four pine trees, and a fence with one broken slat.');
      await P('You walked up and said, “Do you want to see something?” And I said yes.');
      await P('Isn’t that nice? Now neither of us has to wonder.');
    }
    if (c === 'whistle') { Game.suspicion(1); S.flags.lastFlaw = 'whistle'; await P('Pipes. Old house.'); }
    if (c === 'who') {
      S.flags.lastFlaw = 'confronted';
      Game.suspicion(3);
      if (!S.flags.fakeWithdrawn) { await P('…It’s me.'); await P('Why would you ask me that?'); }
    }
  },

  /* =================================================================
   * Night: imitation, clues, social stealth
   * ================================================================= */
  nightClue(kind) {
    if (S.chapter !== 'night') return;
    S.flags.clues = S.flags.clues || {};
    if (S.flags.clues[kind]) return;
    S.flags.clues[kind] = true;
    if (Object.keys(S.flags.clues).length >= 2) this.revealSnowDoor();
  },
  revealSnowDoor() {
    const d = Game.map('house').obj('snowdoor');
    if (d.visible) return;
    d.visible = true; d.glint = true;
    Game.map('house').grid = null;
  },
  async nightBed() {
    const pl = S.player, f = S.partner, bed = S.map.obj('bed');
    if (pl.pose === 'lie') {
      bed.data.occ.left = null; standAt(pl, 4.3, 4.9); pl.dy = 1;
      if (f.fake && f.visible && f.pose === 'lie') {
        await P('Where are you going?');
        const c = await choose(['“Bathroom.”', '“Just checking something.”', '“I heard something.”']);
        if (c === 0) await P('Okay. Come back.');
        if (c === 1) { Game.suspicion(0.5); await P('…Okay.'); }
        if (c === 2) { Game.suspicion(1.5); S.flags.lastFlaw = 'heard'; await P('Pipes. Old house. Come back to bed.'); }
        if (!S.flags.fakeWithdrawn) { bed.data.occ.right = null; standAt(f, 5.9, 4.9); f.scripted = false; }
      }
      return;
    }
    if (f.fake && f.visible && !S.flags.fakeWithdrawn) {
      bed.data.occ.left = pl; standAt(pl, 4.3, 2.4); pl.pose = 'lie';
      bed.data.occ.right = f; standAt(f, 5.9, 2.4); f.pose = 'lie'; f.scripted = true;
      await P('There you are.');
      const c = await choose(['Sleep', 'Stay awake']);
      if (c === 0) {
        S.mem.acceptedFake++; S.flags.sleptBeside = true; Game.observe('sleptFake');
        await N('(You sleep. It is very warm. You dream of snow, and of someone calling you from very far away.)');
        S.flags.nightExit = true;
        return;
      }
      await N('(You lie awake. They don’t move at all. You can’t hear them breathing.)');
      return;
    }
    bed.data.occ.left = pl; standAt(pl, 4.3, 2.4); pl.pose = 'lie';
    await N('(The other side of the bed is cold.)');
  },
  async nightSnowDoor() {
    const f = S.partner;
    if (f.fake && f.visible && !S.flags.fakeWithdrawn) {
      await P('Where are you going?');
      const c = await choose(['“Getting some air.”', '“I heard something. Come with me?”', '“Who are you?”']);
      if (c === 0) { Game.suspicion(0.5); await P('…It’s cold out there.'); }
      if (c === 1) { Game.suspicion(-0.3); await P('…Okay. I’ll come.'); }
      if (c === 2) { S.flags.lastFlaw = 'confronted'; Game.suspicion(3); if (!S.flags.fakeWithdrawn) await P('…It’s me. It’s me, {giant}.'); }
    }
    await N('(Cold light. The smell of snow. You open it.)');
    S.flags.nightExit = true;
  },
  async fakeWithdraw() {
    if (S.flags.fakeWithdrawn) return;
    S.flags.fakeWithdrawn = true;
    const f = S.partner;
    Game.observe('flaw');
    Echo.learn(S.flags.lastFlaw || 'staring');
    const bed = S.map && S.map.obj('bed');
    if (bed && bed.data.occ && bed.data.occ.right === f) { bed.data.occ.right = null; standAt(f, 5.9, 4.9); }
    f.holding = false; f.scripted = true;
    bark(f, '…What did I do wrong?', 3);
    await wait(2.6);
    if (S.chapter !== 'night' && S.chapter !== 'lastbirthday') return;
    const away = S.map.id === 'house' ? [1.6, 9.6] : [f.x / TILE - 6, f.y / TILE];
    Game.walkTo(f, away[0] * TILE, away[1] * TILE, () => { f.visible = false; }, 60);
    await wait(4);
    f.visible = false;
  },

  /* =================================================================
   * The Last Birthday (memory overlap)
   * ================================================================= */
  async memPancakes() {
    if (S.partner.fake && S.partner.visible) { await P('I made them for you. Perfectly round. See?'); await N('(Not a single bite missing.)'); return; }
    await N('(A perfect stack. Golden. Nobody has stolen a single bite.)');
  },
  async memFire() {
    const f = S.partner;
    if (f.fake && f.visible && !S.flags.memFireDone) {
      S.flags.memFireDone = true;
      await P('Look. I lit the fire for you.');
      await N('(It’s burning beautifully. Three logs, stacked just so.)');
      const c = await choose(['Sit with them', 'Keep moving']);
      if (c === 0) {
        S.mem.acceptedFake++;
        sitAt(S.player, 26.2, 23.75, { dy: -1, sort: 4 }); sitAt(f, 27.6, 23.75, { dy: -1, sort: 4 });
        await P('This is nice. We could just stay here.');
        await N('(It is nice. That’s the trouble with it.)');
        await wait(0.8);
        standAt(S.player, 26.2, 24.4); standAt(f, 27.6, 24.4);
        Game.suspicion(-1);
      } else { Game.suspicion(0.5); await P('…Okay.'); }
      return;
    }
    await N('(Already burning. Nobody here lights fires but you.)');
  },
  async perfectDoor() {
    const ph = S.map.obj('phouse');
    ph.data.open = true;
    await N('(Warm light. The smell of pancakes. Someone inside is humming the way {P} hums.)');
    await P(S.partner.fake && S.partner.visible ? 'Come inside. Everything’s ready.' : 'Come in! It’s your birthday. Everything’s ready.');
    const c = await choose(['Go inside', 'Not yet']);
    if (c === 1) { ph.data.open = false; await N('(You step back. The humming stops, very briefly, and then starts again.)'); return; }
    if (S.vars.bond >= 6 && S.mem.acceptedFake < 2 && !S.flags.rescued) { await this.rescue(); return; }
    S.flags.ending = 'perfect';
  },
  async rescue() {
    S.flags.rescued = true;
    const ph = S.map.obj('phouse');
    Sound.thud(); Cam.shake = 7;
    S.real.visible = false;
    const p = S.partner;
    p.fake = false; p.visible = true; p.scripted = true; p.alpha = 1;
    standAt(p, 17.5, 13.2);
    await walk(p, S.player.x / TILE + 0.8, S.player.y / TILE + 0.2, 190);
    ph.data.open = false;
    p.holding = true;
    await P('Nope. No. Absolutely not.');
    await P('You were going INTO the creepy perfect house? On your BIRTHDAY?');
    await Y('…It smelled like pancakes.');
    await P('EVERYTHING smells like pancakes to you!');
    await P('…Hi.');
    await Y('Hi.');
    await N('(They’re out of breath. Their hand is freezing. They’re holding on far too hard.)');
    await P('Do not EVER let me catch you on a date with a house again.');
    Game.addTrust(1);
    p.scripted = false;
    S.flags.mustHold = true;
    S.flags.reunited = true;
  },
  async eastGate() {
    const f = S.partner;
    if (!(f.fake && f.visible) || S.flags.fakeLeftBehind) return;
    S.control = false;
    f.path = null; faceToward(f, S.player.x, S.player.y);
    if (S.flags.eastGateN) await P('…Again?');
    else { await P('…You’re still looking for them.'); await P('I’m right here.'); }
    S.flags.eastGateN = (S.flags.eastGateN || 0) + 1;
    const c = await choose(['Keep walking', 'Go back with it']);
    if (c === 0) {
      await P('I’ll wait. I’m good at waiting. I learned it from you.');
      f.mode = 'stay'; S.flags.fakeLeftBehind = true;
      S.hooks.push(() => { if (f.visible && Game.partnerDist() > 9) { f.visible = false; S.flags.fakeWithdrawn = true; } });
    } else {
      if (!S.flags.wentBack) { S.flags.wentBack = true; S.mem.acceptedFake += 0.5; }
      await P('Good. Home.');
      standAt(S.player, 31.5, 18.6);
      S.flags.eastGateArmed = false;
    }
    S.control = true;
  },
  async reunionClearing() {
    const r = S.real;
    S.control = false;
    if (S.partner.fake) { S.partner.visible = false; S.flags.fakeWithdrawn = true; }
    // The real one becomes Partner again.
    const p = S.partner;
    p.fake = false; p.fakeLevel = 0; p.mode = null; p.lead = null; p.visible = true; p.scripted = true; p.alpha = 1;
    sitAt(p, r.x / TILE, r.y / TILE, { dy: 1, lift: 4 });
    S.real.visible = false;
    faceToward(S.player, p.x, p.y);
    await N('(Under the big tree, in the snow, exactly where someone small once sat.)');
    await N('(Neither of you moves first.)');
    const c = await choose(['“What did I say? The first time?”', '“Found you.”', 'Walk over']);
    if (c === 0) {
      await P('…I have no idea. I never did.');
      await N('(You laugh. You can’t help it.)');
      await P('What? What’s funny?');
      await N('(And then they get it, and they laugh too.)');
    } else if (c === 1) {
      await P('…Took you long enough.');
      await P('I whistled! Did you hear me whistle? I whistled like an idiot.');
    } else {
      await N('(You walk over. They stand up. They don’t step toward you.)');
      standAt(p, p.x / TILE, p.y / TILE + 0.2);
      await P('Wait. Say something. Something only you would say.');
      const d = await choose(['“Coward.”', '“I don’t remember either.”', 'Just hold out your hand.']);
      if (d === 0) await P('…Ha. Yeah. That’s you.');
      if (d === 1) await P('…Yeah. Yeah, that’s you.');
      if (d === 2) await N('(They look at your hand for a long second. Then they take it, and squeeze, exactly the wrong amount, exactly the way they always do.)');
    }
    standAt(p, p.x / TILE, p.y / TILE + 0.2);
    await walk(p, S.player.x / TILE + 0.7, S.player.y / TILE, 110);
    p.hugT = 2; S.player.hugT = 2; FX.heart(S.player.x, S.player.y - 44);
    await wait(1.2);
    await P('You spent all night with that thing? On your birthday?');
    await Y('It was very polite.');
    await P('“It was very polite.” Listen to yourself.');
    await P('I’m never letting you live this down. Never. When we’re ninety.');
    if (S.mem.acceptedFake >= 1) {
      await P('…Did it get you? Even a bit?');
      const h = await choose(['“A bit.”', '“No.”']);
      if (h === 0) { Game.addTrust(1); await P('Okay. Me too. A bit. We’ll compare notes later.'); }
      else await P('Liar. …It’s okay.');
    }
    Game.addTrust(1);
    p.holding = true; p.scripted = false;
    S.flags.mustHold = true;
    S.flags.reunited = true;
    S.control = true;
  },
  logBoostLabel() { return S.flags.reunited && !S.flags.logDone ? 'Boost {P} over' : 'Fallen tree'; },
  async boostLog() {
    if (!S.flags.reunited) return N('(A fallen tree, waist-high, slick with ice. Too high to climb alone.)');
    if (S.flags.logDone) return;
    if (Game.partnerDist() > 2.6) return N('(Too high to climb alone.)');
    const p = S.partner, pl = S.player;
    p.holding = false; p.scripted = true;
    await N('(You lace your fingers into a step.)');
    await P('If you drop me I’m haunting you.');
    await Game.hop(p, p.x, 17.3 * TILE);
    await P('Hup! …Okay. Your turn. Give me your hand.');
    await N('(They brace their feet and pull. For someone so small, they pull like a tractor.)');
    await Game.hop(pl, pl.x, 17.5 * TILE);
    await P('You’re heavy. Birthday weight.');
    Game.addBond(0.5);
    S.flags.logDone = true; p.holding = true; p.scripted = false;
  },
  async iceSlip() {
    S.flags.iceDone = true;
    const p = S.partner, pl = S.player;
    S.control = false; p.holding = false; p.scripted = true;
    Cam.shake = 4;
    Sound.burst(0.4, { type: 'highpass', freq: 2000, vol: 0.12 });
    await Game.tween(pl, { x: 46.4 * TILE, y: pl.y + 1.4 * TILE }, 0.7);
    await N('(Your feet go out from under you. The ice slopes toward a dark nothing at the edge.)');
    await Game.tween(p, { x: pl.x - 18, y: pl.y }, 0.35);
    await P('Got you. Got you, {giant}.');
    await Game.tween(pl, { x: 44 * TILE }, 0.6);
    p.x = pl.x - 20;
    await P('…Okay. YOU hold MY hand this time.');
    Game.addTrust(0.6);
    p.holding = true; p.scripted = false;
    S.control = true;
  },
  async exitDoor() {
    if (!S.flags.reunited) return N('(A door, standing on its own in the snow. Warm light around the edges. It won’t open. Not for one person.)');
    if (S.flags.offerDone) return;
    S.flags.offerDone = true;
    S.control = false;
    const ent = Game.addExtra(makeChar('entity', 'entity', { alpha: 0 }), 44, 38.7);
    ent.fadeIn = true;
    Sound.setAmbience({ hum: 0.2, wind: 0.25, pad: 0.25 });
    Sound.motif('cold');
    await wait(1);
    await E('You could stay.');
    await E('It could always be your birthday. Nobody would get older. Nothing would be forgotten.');
    await E('Not the pancakes. Not the hill. Not the snow.');
    await E('I would remember it for you.');
    if (S.vars.bond >= 5) await P('…Your call, {giant}. I’m with you. Either way.');
    else await P('Please. Let’s just go home.');
    const c = await choose(['Stay', 'Go home']);
    if (c === 0) { S.flags.ending = 'stay'; return; }
    await E('…Then I will remember it for me.');
    ent.fadeOut = true;
    S.map.obj('exitdoor').data.open = true;
    Sound.chime();
    await N('(The door opens onto an ordinary hallway. Your hallway. It smells like toast.)');
    S.flags.ending = this.pickEnding1();
  },
  pickEnding1() {
    const acc = S.mem.acceptedFake;
    if (acc >= 2) return 'iknow';
    if (acc >= 1 || S.vars.trust < 2) return 'uncertain';
    return 'foundme';
  },
  async elsewhereWhistle() {
    S.map.obj('whistlespot').visible = false;
    Sound.whistle(false);
    await N('(Three. If one of us got lost.)');
    S.flags.povWhistled = true;
  },
};

/* =====================================================================
 * Talk topics (real Partner). Each runs once; then small talk.
 * ===================================================================== */
const TALKS = {
  morning: [
    { id: 'gift', run: async () => {
      await P('What do you want for your birthday?');
      const c = await choose(['“Pancakes.”', '“You.”', '“To know what’s in the study.”']);
      if (c === 0) await P('Pancakes aren’t a gift. They’re a lifestyle.');
      if (c === 1) { Game.addBond(0.5); await P('Ugh. Gross. …You already have me. That’s not a gift, that’s a returns policy.'); }
      if (c === 2) await P('Nice try. NO GIANTS.');
    } },
    { id: 'dream', run: async () => { await P('I had a dream we were kids again, and you were exactly this size.'); await Y('That’s horrifying.'); await P('It was. You couldn’t fit on the swings.'); } },
  ],
  walk: [
    { id: 'doug', run: async () => { await P('Do you think Doug knows us?'); await Y('He’s a tree.'); await P('He’s a tree who KNOWS us.'); } },
    { id: 'fair', run: async () => { await P('Remember that winter fair? Where we met?'); await Y('Vaguely.'); await P('Same. Vaguely is my favourite way to remember things.'); } },
  ],
  evening: [
    { id: 'snowq', run: async () => {
      await P('Do you think it’s still there? The snow?');
      const c = await choose(['“Probably melted.”', '“I don’t know.”']);
      if (c === 0) await P('…Yeah. Probably.');
      else { Game.addTrust(0.4); await P('…Me neither. Thanks for not pretending.'); }
    } },
  ],
  campfire: [
    { id: 'stars', run: async () => { await P('If you could keep one day forever, which one?'); const c = await choose(['“This one.”', '“None. I want the next one.”']); if (c === 0) await P('Even with the snow thing?'); else { Game.addTrust(0.3); await P('…Yeah. Me too. Greedy.'); } } },
  ],
  lastbirthday: [
    { id: 'scared', run: async () => { await P('I’m scared.'); await Y('Me too.'); await P('Okay. Good. Not good. You know what I mean.'); } },
  ],
  any: [
    { id: 'size', run: async () => { await P('Why are you so big.'); await Y('Why are you so small.'); await P('Concentrated.'); } },
  ],
};

/* =====================================================================
 * Chapters
 * ===================================================================== */
CH.prologue = async () => {
  Game.setMap('festival');
  const m = S.map;
  m.obj('fence').visible = true;
  S.player = makeChar('player', 'kidPlayer', { speed: 66 });
  S.partner = makeChar('partner', 'kidPartner');
  Game.place(S.player, 23, 23.5); S.player.dy = -1; S.player.dx = 0;
  sitAt(S.partner, 23.1, 7.3, { lift: 2, dy: 1 });
  S.partner.scripted = true;
  S.flags.noTogether = true;
  Game.env({ dark: 0.5, darkRGB: '20,26,48', warm: 0.1, snow: 0.7, desat: 0.75, zoom: 1.1, snowGround: 1, white: 0 }, true);
  Sound.setAmbience({ wind: 0.5, crowd: 0.1 });
  Game.snapCam();
  UI.setFade(1);
  await wait(0.4);
  UI.fade(0, 2.6);
  await UI.card(['We don’t remember exactly how it started.'], { hold: 3.6, min: 1.6 });
  S.control = true;
  UI.hint(UI.touch ? 'Drag anywhere on the left to walk.' : 'Walk with WASD or the arrow keys.', 7);
  await until(() => Game.partnerDist() < 2.3);
  S.control = false;
  faceToward(S.player, S.partner.x, S.partner.y);
  await wait(0.7);
  faceToward(S.partner, S.player.x, S.player.y);
  await wait(1.1);
  await N('(Snow. Cold air. Lanterns, somewhere behind you. Somebody else who had wandered off.)');
  await N('(You came over. That part, everyone agrees on.)');
  await UI.fade(1, 2.4, '#ffffff');
  S.flags.noTogether = false;
  return Story.go('morning');
};

CH.morning = async () => {
  Game.checkpoint('morning');
  Game.setMap('house');
  Game.newPair();
  const bed = S.map.obj('bed');
  bed.data.occ = { left: S.player, right: S.partner }; bed.data.blanket = 1;
  standAt(S.player, 4.3, 2.4); S.player.pose = 'lie';
  standAt(S.partner, 5.9, 2.4); S.partner.pose = 'lie'; S.partner.scripted = true;
  Game.env({ dark: 0, warm: 0.5, snow: 0, desat: 0, zoom: 1.3, snowGround: 0, white: 0, snowIndoor: false }, true);
  Sound.setAmbience({ pad: 1, birds: 0.5 });
  Sound.setDetune(0);
  Cam.target = [5.1 * TILE, 3 * TILE];
  Game.snapCam();
  UI.setFade(1, '#ffffff');
  UI.fade(0, 2.2, '#ffffff');
  await UI.act('I', 'Shared Life');
  Game.observe('start');
  await N('(Morning. Warm. Something is breathing on your neck.)');
  await P('…Mmf. Don’t move. You’re warm.');
  await Y('You took the entire blanket.');
  await P('Our blanket.');
  await Y('It’s on your side.');
  await P('I don’t recognize sides.');
  const c = await choose(['Stay a little longer', 'Steal the blanket back', 'Get up']);
  if (c === 0) {
    Game.addBond(1); S.mem.affection++;
    await N('(You stay. They burrow into your side like they were measured for it.)');
    await P('Good. Correct answer.');
    await P('Happy birthday, by the way.');
    await Y('You said that into my armpit.');
    await P('Your armpit’s invited too.');
  } else if (c === 1) {
    Game.addRivalry(1);
    bed.data.blanket = -1;
    await N('(One heroic tug. The blanket is yours. Briefly.)');
    await P('Thief. On your birthday. Shameless.');
    bed.data.blanket = 1;
    await N('(It is back on their side within four seconds. You did not see how.)');
    await P('Happy birthday, though. Thief.');
  } else {
    await N('(You start to get up. A pillow hits you in the back of the head.)');
    await P('Traitor.');
    await P('…Happy birthday, traitor.');
  }
  await Y('Morning, {gremlin}.');
  await P('Birthday people make breakfast. It’s the law.');
  await Y('That’s not the law.');
  await P('I’m the law. …Pancakes. Please. I’ll be up in a minute.');
  bed.data.occ.left = null;
  standAt(S.player, 4.3, 4.9); S.player.dy = 1;
  Cam.target = null;
  S.control = true;
  UI.hint(UI.touch ? 'Tap Use near things to interact. Tap ♥ near {P} to be together.' : 'E or Space: interact.   Q: be together (hug, hold hands, talk).', 9);
  (async () => { await until(() => S.chapter !== 'morning' || S.flags.pancakesMade || S.flags.cuddled || S.t > 0); await wait(30); if (S.chapter === 'morning' && S.partner.pose === 'lie' && !S.flags.inBedScene) Story.partnerGetsUp(); })();
  Story.idleHint(['(Pancakes. They said pancakes.)', '(The kitchen is downstairs, past the hallway.)'], () => !S.flags.pancakesMade, 45);
  await until(() => S.flags.breakfastDone);
  S.partner.lead = { x: 16.2, y: 19.4 };
  bark(S.partner, 'Shoes! Birthday walk!', 2.6);
  await until(() => S.flags.leaveHouse);
  S.control = false;
  S.partner.lead = null;
  await UI.fade(1, 0.9);
  return Story.go('walk');
};

CH.walk = async () => {
  Game.checkpoint('walk');
  Game.setMap('woods');
  Game.ensurePair();
  World.setGlade(true);
  const m = S.map, MEADOW = m.data.MEADOW, GLADE = m.data.GLADE;
  standAt(S.player, 9, 4.9); S.player.dy = 1;
  standAt(S.partner, 10.2, 5.1); S.partner.scripted = false;
  Game.env({ dark: 0, warm: 0.45, snow: 0, desat: 0, zoom: 1, snowGround: 0, white: 0 }, true);
  Sound.setAmbience({ birds: 1, wind: 0.15 });
  Game.snapCam();
  UI.fade(0, 1);
  await P('Birthday walk! Meadow, hill, creek. In that order.');
  S.control = true;
  S.partner.lead = { x: 24.5, y: 20.6 };
  await until(() => U.dist(S.player.x / TILE, S.player.y / TILE, MEADOW[0], MEADOW[1]) < 6.5);
  S.partner.lead = null; S.partner.path = null;
  await P('Flower contest. Most flowers by the time we get to the hill wins. Starting… now!');
  S.partner.mode = 'flowers'; S.flags.flowerContest = true;
  UI.hint(UI.touch ? 'Pick flowers with Use. Or don’t. It’s your birthday.' : 'Pick flowers with E. Or don’t. It’s your birthday.', 6);
  const raceStart = [31.4, 18.9];
  await until(() => U.dist(S.player.x / TILE, S.player.y / TILE, raceStart[0], raceStart[1]) < 2.4);
  // ---- The race ----
  const p = S.partner;
  p.mode = null; p.task = null; p.lead = null;
  S.control = false;
  if (Game.partnerDist() > 2) { bark(p, 'Wait for me!', 1.6); await walk(p, S.player.x / TILE + 0.9, S.player.y / TILE, 170); }
  faceToward(p, 45 * TILE, 7.6 * TILE); faceToward(S.player, 45 * TILE, 7.6 * TILE);
  await P('Race you to the top. Three, two—');
  p.scripted = true;
  let partnerArrived = false;
  Game.walkTo(p, 45.4 * TILE, 7.75 * TILE, () => { partnerArrived = true; }, 114);
  p.running = true;
  S.control = true;
  bark(S.player, 'HEY—', 1.2);
  UI.hint(UI.touch ? 'Push the stick all the way to run.' : 'Hold Shift to run.', 5);
  let ran = false;
  S.hooks.push(() => { if (S.player.running) ran = true; });
  const finish = [45.2, 7.7];
  await until(() => partnerArrived || U.dist(S.player.x / TILE, S.player.y / TILE, finish[0], finish[1]) < 1.35);
  const youWon = !partnerArrived;
  S.control = false;
  if (youWon) {
    S.mem.raceWins++;
    if (!partnerArrived) await until(() => partnerArrived);
    await N('(They arrive, pluck the flag out of the ground, and plant it one step behind themselves.)');
    const flag = m.obj('flag'); flag.x = p.x / TILE - 0.2; flag.y = p.y / TILE + 0.3;
    await P('And the winner is—');
    await Y('You moved the marker.');
    await P('Prove it.');
    await Y('It’s in your hand.');
    await P('Circumstantial.');
    Game.addRivalry(1);
  } else if (!ran) {
    S.mem.letWin++; Game.observe('letwin');
    await P('…Did you just let me win? On your own birthday?');
    const c = await choose(['“Yes.”', '“No. I’m just old now.”']);
    if (c === 0) { Game.addBond(0.5); await P('Disgusting. Rematch next year.'); }
    else await P('Old knees. I knew it.');
  } else {
    await P('HA! Birthday loser! …That’s a compliment.');
    Game.addRivalry(0.5);
  }
  const mine = S.mem.flowers, theirs = S.mem.partnerFlowers;
  if (mine > theirs) { await Y(`I have ${mine} flowers.`); await P('…The stick counts as six.'); }
  else { await P(`Also, I have ${Math.max(11, theirs)} flowers.`); await Y(`You have ${theirs || 'zero'} and a stick.`); await P('The stick is a flower in spirit.'); }
  Game.addScrap('hill', youWon ? 'Hill race. Winner: me. Official winner, according to {P}: {P}.' : 'Hill race. {P} won. Gloated for eleven minutes.');
  // ---- The viewpoint ----
  S.flags.benchReady = true;
  p.scripted = true;
  bark(p, 'Sit. View. Mandatory.', 3);
  await walk(p, 46.05, 8.95, 90);
  sitAt(p, 46.05, 8.95, { dy: 1, lift: 8, sort: 4 });
  S.control = true;
  await until(() => S.flags.benchSit);
  S.control = false;
  sitAt(S.player, 44.6, 8.95, { dy: 1, lift: 8, sort: 4 });
  await wait(1.8);
  await Game.tween(p, { x: 45.35 * TILE }, 0.9);
  await wait(0.9);
  await P('Do you feel older?');
  await Y('…A little. Around the knees.');
  await P('Good. I like you with old knees.');
  await P('Do you think we’re the same people we were? When we were kids?');
  const q = await choose(['“Hope not. You bit people.”', '“No. Still us, though.”', '“I don’t remember enough to know.”']);
  if (q === 0) { await P('ONE person. And he deserved it.'); await P('…But yeah. Still us.'); }
  if (q === 1) { Game.addBond(0.5); await P('Still us. Yeah. I like that.'); }
  if (q === 2) { await P('Me neither. Isn’t that weird? We don’t remember most of it, and it doesn’t matter at all.'); }
  await N('(They lean their head on your shoulder.)');
  const l = await choose(['Put an arm around them', 'Stay still and let them lean']);
  Game.addBond(1); S.mem.affection++; Game.observe('affection');
  if (l === 0) await P('Mm. Warm. Good arm.');
  else await N('(You stay very still. You can feel them breathing.)');
  await wait(0.6);
  await P('…Okay. Creek. I’m going to destroy you at stones.');
  standAt(S.player, 44.6, 9.6); standAt(p, 45.4, 9.6);
  S.flags.benchDone = true;
  p.scripted = false;
  p.lead = { x: 37.6, y: 33.4 };
  S.flags.stonesReady = true;
  S.control = true;
  await until(() => S.flags.stonesDone && !UI.blocking() && !S.busy);
  // ---- The glade ----
  p.lead = null;
  await wait(1.4);
  p.scripted = true;
  Game.walkTo(p, 18.3 * TILE, 29.4 * TILE, () => { bark(p, '…Hey. Come look at this.', 3.5); }, 95);
  await wait(1.0);
  bark(p, 'Hang on— what’s that?', 2);
  await until(() => !p.path || Game.partnerDist() > 6);
  await until(() => !p.path);
  p.mode = 'stay'; p.scripted = false;
  await until(() => U.dist(S.player.x / TILE, S.player.y / TILE, 18.3, 29.4) < 5.5 || U.dist(S.player.x / TILE, S.player.y / TILE, GLADE[0], GLADE[1]) < 6);
  Sound.setAmbience({ wind: 0.25 });
  S.vars.fear = 0.5;
  p.mode = null; p.holding = true;
  bark(p, '…It’s quiet.', 2.5);
  await until(() => U.dist(S.player.x / TILE, S.player.y / TILE, GLADE[0], GLADE[1]) < 4.4);
  S.control = false;
  Game.env({ warm: -0.35 });
  await N('(Snow. A perfect circle of it, in the middle of a warm day.)');
  await P('…It’s not even cold.');
  await Y('Somebody’s prank?');
  await P('With what? Who pranks a forest?');
  m.obj('footprints').glint = true;
  S.control = true;
  await until(() => S.flags.sawFootprints && !UI.blocking() && !S.busy);
  m.obj('footprints').glint = false;
  S.control = false;
  await wait(0.4);
  await P('Can we go home? I want to go home.');
  const g = await choose(['Hold them', 'Make a joke', 'Look closer first']);
  if (g === 0) {
    p.hugT = 2.2; S.player.hugT = 2.2;
    S.mem.comforts++; Game.addTrust(1.5); Game.addBond(0.5); Game.observe('comfort');
    await N('(You hold them. They hold on to the front of your jacket with both fists.)');
    await P('…Okay. Okay. Home.');
  } else if (g === 1) {
    Game.addTrust(0.4);
    await Y('Maybe it’s a birthday present.');
    await P('…That’s not funny.');
    await P('…It’s a little funny. Home. Now.');
  } else {
    await N('(Up close, the footprints are crisp. Fresh. Whoever made them is still standing here. There is nobody standing here.)');
    await P('Please.');
  }
  p.holding = true; S.flags.mustHold = true;
  S.vars.fear = 0.55;
  S.flags.gladeDone = true;
  S.mem.gladeVisits = (S.mem.gladeVisits || 0) + 1;
  S.control = true;
  UI.hint('(Home is back up the path, past the meadow.)', 6);
  await until(() => S.flags.reachedHome);
  S.flags.mustHold = false;
  S.control = false;
  await UI.fade(1, 1);
  return Story.go('evening');
};

CH.evening = async () => {
  Game.checkpoint('evening');
  Game.setMap('house');
  Game.ensurePair();
  const m = S.map, p = S.partner;
  standAt(S.player, 15.5, 20.3); S.player.dy = -1;
  standAt(p, 16.6, 20.3); p.holding = true; p.scripted = true; p.visible = true; p.inside = false;
  m.obj('bed').data.occ = {};
  m.obj('table').data.plates = 'empty';
  Game.env({ dark: 0.16, darkRGB: '70,35,20', warm: 0.95, snow: 0, desat: 0, zoom: 1.3, snowGround: 0, white: 0 }, true);
  Sound.setAmbience({ pad: 0.7 });
  S.flags.windowSnow = false;
  S.vars.fear = 0.32;
  Game.snapCam();
  UI.fade(0, 1.2);
  await UI.act('II', 'Something Strange');
  await P('…Okay. Okay. We’re home. Home is normal.');
  await P('I’m going to do birthday business in the study. It’ll make me feel normal.');
  await Y('Okay.');
  await P('Don’t come in.');
  await Y('I know.');
  await P('I mean it. No giants.');
  p.holding = false;
  await walk(p, 22.5, 9.6, 100);
  p.visible = false; p.inside = true; p.insideT = null;
  m.obj('photo_empty').data.art = 'snowkids'; m.obj('photo_empty').glint = true;
  S.flags.toothbrushes = 3;
  Game.addScrap('snowkids', '(No caption. Neither of you remembers sticking this in.)');
  m.obj('llamp').data.on = true;
  S.vars.fear = 0.15;
  S.control = true;
  Story.idleHint(['(Something in the hallway catches the light.)'], () => !S.flags.sawPhoto, 25);
  await until(() => S.flags.sawPhoto && !UI.blocking() && !S.busy);
  S.control = false;
  p.inside = false; p.visible = true; standAt(p, 22.5, 9.6); p.scripted = true;
  await walk(p, S.player.x / TILE + 0.9, 9.7, 110);
  faceToward(p, S.player.x, S.player.y);
  await P('What’s— hey. What are you looking at?');
  await N('(You show them.)');
  await P('Who put that there?');
  await Y('I thought you did.');
  await P('I’ve never seen it. Have you seen it?');
  const a = await choose(['“No.”', '“…Maybe? I don’t know.”']);
  if (a === 1) Game.addTrust(0.3);
  await P('That’s us. Isn’t it? That’s the fair. The snow day.');
  await P('Who took it? Nobody was there. That was the whole point. We were the ones who wandered off.');
  await P('…Scrapbook. I want to check the scrapbook.');
  await Promise.all([walk(S.player, 21.8, 16.45, 110), walk(p, 20.2, 16.45, 110)]);
  sitAt(S.player, 21.8, 16.45, { lift: 10, sort: 6 }); sitAt(p, 20.2, 16.45, { lift: 10, sort: 6 });
  await UI.scrapbook(S.scrap, { start: Math.ceil(S.scrap.length / 2) - 1 });
  await P('It’s in here too. Okay. Okay, that’s fine. That’s a normal amount of fine.');
  await P('What do you remember? About that day.');
  const r = await choose(['“Snow. Lanterns. You.”', '“Not much, honestly.”', '“You were sitting under a tree.”']);
  if (r === 0) { Game.addBond(0.4); await P('Lanterns. Yeah. I remember lanterns.'); }
  if (r === 1) await P('Same. Isn’t that rubbish? The most important day and I’ve got about four seconds of it.');
  if (r === 2) await P('Was I? I feel like I was standing. Maybe I was standing under a tree.');
  await P('Your scarf was yellow.');
  const s = await choose(['“It was red.”', '“Was it?”', '“I don’t remember.”']);
  if (s === 0) { await P('Yellow. Like a duck.'); await Y('Red. Like a… red duck.'); await P('Agree to disagree.'); }
  else await P('It was definitely one of those colours.');
  S.flags.scarfAnswer = ['red', 'unsure', 'unknown'][s];
  await P('How many trees were there?');
  await Y('One?');
  await P('Three. At least three. Maybe one.');
  await P('Do you remember what you said to me? First thing?');
  await Y('No.');
  await P('Me neither. I just remember you came over.');
  await Y('I came over.');
  await P('You always come over.');
  await wait(0.6);
  await P('Remember the whistle?');
  await Y('Three.');
  await P('Three. If one of us got lost at the fair.');
  Sound.whistle(false);
  await wait(1.6);
  await P('Still got it.');
  Game.addBond(0.6);
  S.flags.knowsWhistle = true; S.flags.firstMeetingTalk = true;
  await P('Okay. I’m done being weird. Fire. Outside. I have a thing for you.');
  standAt(S.player, 21.8, 17.2); standAt(p, 20.2, 17.2);
  p.scripted = false;
  p.lead = { x: 16.2, y: 19.6 };
  S.control = true;
  await until(() => S.flags.goCampfire);
  S.control = false;
  p.lead = null;
  await UI.fade(1, 0.9);
  return Story.go('campfire');
};

CH.campfire = async () => {
  Game.setMap('woods');
  Game.ensurePair();
  World.setGlade(true);
  const m = S.map, p = S.partner, fire = m.obj('firepit');
  fire.data.lit = false; fire.data.dying = false;
  standAt(S.player, 9, 4.9); S.player.dy = 1;
  standAt(p, 10.2, 5.1);
  Game.env({ dark: 0.52, darkRGB: '35,25,55', warm: 0.5, snow: 0, desat: 0, zoom: 1.15, snowGround: 0, white: 0 }, true);
  Sound.setAmbience({ wind: 0.1, birds: 0.08 });
  Game.snapCam();
  UI.fade(0, 1);
  p.scripted = true;
  await walk(p, 12.6, 10.05, 95);
  sitAt(p, 12.6, 10.05, { dy: -1, lift: 7, sort: 4 });
  bark(p, 'You do the fire. I’ll do moral support.', 3.5);
  S.flags.fireReady = true;
  S.control = true;
  await until(() => S.flags.fireLit && !UI.blocking() && !S.busy);
  bark(p, 'Sit with me!', 2.5);
  await until(() => S.flags.logSit);
  S.control = false;
  sitAt(S.player, 11.2, 10.05, { dy: -1, lift: 7, sort: 4 });
  await wait(0.8);
  await P('Marshmallow. Mandatory.');
  const sc = await UI.timing({ title: 'Toast a marshmallow', rounds: 1, zone: [0.55, 0.7], speed: 0.9, labels: ['Charcoal.', 'Toasty.', 'Golden.'] });
  await N(sc[0] > 0.75 ? '(Perfectly golden. A masterpiece.)' : sc[0] > 0.35 ? '(Toasty. Respectable.)' : '(It catches fire. You blow it out. It is now a small black planet.)');
  await N('({P} takes it off your stick. Eats it. Maintains eye contact.)');
  await P('Tax.');
  S.mem.foodStolen++;
  await P('Okay. Close your eyes.');
  const e = await choose(['Close them', 'Peek']);
  if (e === 1) await P('I SAID— fine. Whatever. Look.');
  await N('(A snow globe. Inside: two tiny figures, a tiny lantern, and a few lumpy trees.)');
  await P('I made it. The trees are probably wrong. I didn’t remember how many there were, so I guessed.');
  const g = await choose(['“It’s perfect.”', '“You made this?”', '“…Three trees?”']);
  if (g === 0) await P('It’s not. That’s what I like about it.');
  if (g === 1) await P('With my own two hands and a frankly irresponsible amount of glue.');
  if (g === 2) await P('THREE. AT LEAST.');
  S.flags.giftReceived = true;
  Game.addScrap('globe', 'Birthday present. Two people, one lantern, a disputed number of trees.');
  await P('Happy birthday, {giant}.');
  const h = await choose(['Kiss them', 'Pull them closer', '“Thank you.”']);
  Game.addBond(1); S.mem.affection++; Game.observe('affection');
  if (h === 0) { FX.heart(S.player.x, S.player.y - 40); await P('Mm. Cheeky. Accepted.'); }
  if (h === 1) { await Game.tween(p, { x: 11.9 * TILE }, 0.5); await P('Oh, hello. Warm.'); }
  if (h === 2) await P('You’re welcome. Don’t cry. If you cry I’ll cry.');
  await wait(0.8);
  await P('Can we stay here for a second?');
  await Y('Yeah.');
  await N('(You hold them.)');
  await P('…Okay.');
  S.mem.comforts++; Game.addTrust(1); S.vars.fear = 0.1;
  await wait(1.2);
  Game.env({ snow: 0.18 });
  await N('(Something lands on the back of your hand. Cold. Gone.)');
  await P('…Is that—');
  Game.env({ snow: 0.35, warm: 0.2 });
  await P('Inside. Please.');
  standAt(S.player, 11.2, 10.7); standAt(p, 12.4, 10.7);
  p.scripted = false; p.holding = true; S.flags.mustHold = true;
  S.vars.fear = 0.48;
  S.flags.campfireDone = true;
  S.control = true;
  await until(() => S.flags.goInside);
  S.flags.mustHold = false;
  S.control = false;
  await UI.fade(1, 0.9);
  return Story.go('bedtime');
};

CH.bedtime = async () => {
  Game.setMap('house');
  Game.ensurePair();
  const m = S.map, p = S.partner, bed = m.obj('bed');
  standAt(S.player, 15.5, 20.3); S.player.dy = -1;
  standAt(p, 16.5, 20.3); p.holding = true;
  m.obj('lampL').data.on = true; m.obj('lampR').data.on = true; m.obj('llamp').data.on = true;
  m.obj('photo_empty').data.art = 'snowkids'; m.obj('photo_empty').glint = false;
  S.flags.windowSnow = true;
  bed.data.occ = {}; bed.data.blanket = 0;
  Game.env({ dark: 0.72, darkRGB: '14,18,40', warm: 0.5, snow: 0, desat: 0, zoom: 1.3, white: 0 }, true);
  Sound.setAmbience({ pad: 0.5, wind: 0.15 });
  S.vars.fear = 0.2;
  Game.snapCam();
  UI.fade(0, 1);
  await P('Bed. Now. I’m declaring it.');
  p.holding = false; p.scripted = true;
  Game.walkTo(p, 5.9 * TILE, 4.9 * TILE, () => { bed.data.occ.right = p; standAt(p, 5.9, 2.4); p.pose = 'lie'; }, 95);
  S.control = true;
  await until(() => S.flags.bedtimeReady);
  S.control = false;
  if (p.pose !== 'lie') { bed.data.occ.right = p; standAt(p, 5.9, 2.4); p.pose = 'lie'; }
  bed.data.occ.left = S.player; standAt(S.player, 4.3, 2.4); S.player.pose = 'lie';
  Cam.target = [5.1 * TILE, 3 * TILE];
  await P('Hey.');
  await Y('Hey.');
  await P('Best birthday?');
  const a = await choose(['“Top three.”', '“Apart from the snow thing.”', '“Every one with you is.”']);
  if (a === 0) { await P('Top THREE? What were the other two?'); await Y('Classified.'); }
  if (a === 1) { Game.addTrust(0.4); await P('…Yeah. Apart from that.'); }
  if (a === 2) { Game.addBond(0.6); await P('…Ugh. Stop. You can’t say stuff like that at night, I’ll cry on you.'); }
  const b = await choose(['Cuddle', 'Look at them', 'Kiss them goodnight', 'Kiss them like you mean it']);
  S.mem.affection++; Game.addBond(0.6);
  if (b === 0) {
    await N('(They fit into your side like they were measured for it.)');
    await P('Mm. Big spoon privileges. Don’t let it go to your head.');
  } else if (b === 1) {
    await P('You’re staring.');
    await Y('I’m looking.');
    await P('At me.');
    await Y('Unfortunately.');
    await P('You could just admit I’m cute.');
    await Y('I could.');
    await P('…Coward.');
  } else if (b === 2) {
    FX.heart(5.1 * TILE, 2 * TILE);
    await P('Mm. Goodnight kiss. Very wholesome. Very old person.');
  } else {
    Cam.target = [8.5 * TILE, 0.9 * TILE];
    Game.env({ zoom: 1.6 });
    await N('(They pull you in by the collar. The camera, very politely, finds something interesting to look at.)');
    await P('Oh, now you’re looking away?');
    await Y('Very respectful camera.');
    await P('Coward.');
    await N('(Laughter. A pillow hits the floor. Outside, the snow keeps coming down, unbothered.)');
    await Y('Still feeling confident?');
    await P('…Don’t get smug.');
    await UI.fade(1, 1.4);
    await wait(1);
    Cam.target = [5.1 * TILE, 3 * TILE];
    Game.env({ zoom: 1.3 });
    await UI.fade(0, 1.4);
    await N('(Later. One blanket, shared for once. Their fingers in your hair, absent-minded.)');
    await P('…Happy birthday.');
    await Y('You said that.');
    await P('I’m saying it again. In case it didn’t stick.');
    Game.addBond(1); S.mem.affection += 2; Game.observe('affection');
  }
  await P('If I get up for water, don’t steal my side.');
  await Y('You don’t recognize sides.');
  await P('…Touché. Night, {giant}.');
  m.obj('lampL').data.on = false; m.obj('lampR').data.on = false; m.obj('llamp').data.on = false;
  Sound.tone(1800, 0.02, { vol: 0.04, type: 'square', release: 0.02 });
  await N('(Snow taps at the window. You don’t remember falling asleep.)');
  await UI.fade(1, 2.5);
  Cam.target = null;
  return Story.go('night');
};

CH.night = async () => {
  Game.checkpoint('night');
  Game.setMap('house');
  Game.ensurePair();
  const m = S.map, pl = S.player, f = S.partner, bed = m.obj('bed');
  bed.data.occ = { left: pl }; bed.data.blanket = -1;
  standAt(pl, 4.3, 2.4); pl.pose = 'lie';
  Object.assign(f, { visible: false, inside: false, insideT: null, fake: false, holding: false, lead: null, mode: null, task: null, scripted: true });
  for (const id of ['lampL', 'lampR', 'llamp']) m.obj(id).data.on = false;
  m.obj('photo_empty').data.art = 'snowkids3';
  m.obj('snowdoor').visible = false;
  m.obj('table').data.plates = false; m.obj('table').data.mugs = false;
  S.flags.windowSnow = true; S.flags.nightGlass = true; S.flags.toothbrushes = 2; S.flags.giftReceived = true;
  S.vars.suspicion = 0; S.vars.fear = 0;
  Game.env({ dark: 0.86, darkRGB: '8,12,30', warm: -0.6, snow: 0, desat: 0.1, zoom: 1.35, white: 0 }, true);
  Sound.setAmbience({ hum: 0.6, wind: 0.2 });
  Sound.setDetune(30);
  Cam.target = [5.1 * TILE, 3 * TILE];
  Game.snapCam();
  UI.fade(0, 2.5);
  await UI.act('III', 'Recognition');
  await N('(Cold. The blanket is on your side. All of it.)');
  await N('(Their side is empty. Still a little warm.)');
  await wait(1);
  for (let i = 0; i < 6; i++) { Sound.step('wood', i < 3); await wait(0.48); }
  // Footsteps return. A Partner-form figure enters. Nothing tells you anything.
  Object.assign(f, { fake: true, fakeLevel: 1, visible: true, alpha: 1 });
  standAt(f, 5.5, 9.7);
  await walk(f, 5.5, 7.2, 70);
  await walk(f, 6.2, 4.9, 70);
  faceToward(f, pl.x, pl.y);
  await P('Hey. Couldn’t sleep. Got water.');
  bed.data.occ.right = f; standAt(f, 5.9, 2.4); f.pose = 'lie';
  await N('(They lie down on their side. Exactly on their side.)');
  await P('Come back to sleep.');
  Cam.target = null;
  S.control = true;
  // Faint whistles from somewhere below.
  (async () => {
    let k = 0;
    while (S.chapter === 'night' && !S.flags.nightExit) {
      await wait(k === 0 ? 10 : U.rand(17, 25));
      if (S.chapter !== 'night' || S.flags.nightExit) break;
      const pan = U.clamp((3 * TILE - pl.x) / (10 * TILE), -1, 1);
      Sound.whistle(true, pan);
      S.flags.whistles = (S.flags.whistles || 0) + 1;
      k++;
      if (k === 1 && f.fake && f.visible && !UI.blocking()) { await wait(1.4); bark(f, '…Pipes. Old house.', 2.6); }
      if (k >= 2) Story.nightClue('whistle');
    }
  })();
  // Social stealth: staring and abrupt distance raise suspicion.
  let stare = 0;
  S.hooks.push((dt) => {
    if (!f.fake || !f.visible || S.flags.fakeWithdrawn || UI.blocking()) return;
    const d = Game.partnerDist();
    const fx = f.x - pl.x, fy = f.y - pl.y, l = Math.hypot(fx, fy) || 1;
    const facing = (fx * pl.dx + fy * pl.dy) / l > 0.8;
    if (!pl.moving && d < 2.4 && facing && pl.pose === 'stand') { stare += dt; if (stare > 5) { stare = -6; S.flags.lastFlaw = 'staring'; Game.suspicion(1); bark(f, '…What?', 1.6); } }
    else stare = Math.max(0, stare - dt);
    if (pl.running && d > 3) Game.suspicion(dt * 0.25);
  });
  (async () => { await wait(150); if (S.chapter === 'night') Story.revealSnowDoor(); })();
  Story.idleHint(['(The whistling seems to come from downstairs. The kitchen?)', '(Something in this house is not where it should be.)'], () => S.chapter === 'night' && !S.flags.nightExit && (S.flags.whistles || 0) > 0, 35);
  (async () => {
    const door = m.obj('snowdoor');
    await until(() => S.chapter !== 'night' || (door.visible && inRect(pl, 1, 12, 12, 21)));
    if (S.chapter !== 'night') return;
    await until(() => !UI.blocking() && !S.busy);
    if (!S.flags.nightExit) { S.busy = true; await N('(There’s a door in the kitchen wall. There has never been a door in the kitchen wall.)'); S.busy = false; }
  })();
  await until(() => S.flags.nightExit && !UI.blocking());
  S.control = false;
  await UI.fade(1, 1.6, S.flags.sleptBeside ? '#000000' : '#dfe9f5');
  Sound.setDetune(0);
  return Story.go('elsewhere');
};

CH.elsewhere = async () => {
  Game.setMap('memoryB');
  const me = makeChar('player', 'partner', { speed: 86 });
  S.player = me;
  const fp = makeChar('fakePlayer', 'player', { speed: 80 });
  S.partner = fp;
  Object.assign(fp, { fake: true, fakeLevel: 1, visible: false, scripted: true });
  standAt(me, 5.2, 4.3); me.dy = -1;
  S.flags.noTogether = true;
  Game.env({ dark: 0.72, darkRGB: '10,14,32', warm: -0.45, snow: 0.35, snowIndoor: true, desat: 0.15, zoom: 1.35, white: 0 }, true);
  Sound.setAmbience({ hum: 0.35, wind: 0.25 });
  Game.snapCam();
  UI.setFade(1);
  await UI.card(['Earlier.'], { hold: 2.2, min: 1.2 });
  UI.fade(0, 1.4);
  await N('(For a little while, you are {P}.)');
  await N('(Water. A cold glass. The house making its house noises. Upstairs, the {giant} is asleep and snoring, lovingly.)');
  S.control = true;
  UI.hint('You are {P} now.', 4);
  await wait(3);
  standAt(fp, 12.6, 6.6); fp.visible = true;
  await walk(fp, 10.2, 6.6, 70);
  S.control = false;
  faceToward(fp, me.x, me.y); faceToward(me, fp.x, fp.y);
  await POV('Hey. Come back to bed.');
  await N('(They came all the way downstairs. They never come downstairs. They yell from the stairs, and then complain about the stairs.)');
  const c = await choose(['“Did you yell from the stairs?”', '“Two minutes.”', '“…Hey, {giant}.”']);
  if (c === 0) { await POV('No. I came for you.'); await N('(Right words. Wrong answer.)'); }
  if (c === 1) { await POV('I’ll wait.'); await N('(…Since when?)'); }
  if (c === 2) { await POV('Hey.'); await N('(No “hey, {gremlin}”. Nothing.)'); }
  await POV('Come on.');
  Game.walkTo(fp, 26 * TILE, 6.6 * TILE, () => { fp.fadeOut = true; }, 78);
  S.control = true;
  await until(() => me.x > 12.4 * TILE);
  await N('(…You didn’t wait. You always wait.)');
  await until(() => !fp.path);
  fp.visible = false;
  const ws = S.map.obj('whistlespot'); ws.visible = true; ws.glint = true;
  UI.hint(UI.touch ? 'Tap Use to whistle.' : 'Press E to whistle.', 6);
  await until(() => S.flags.povWhistled && !UI.blocking());
  S.control = false;
  await N('(Then you leave them something. Something only they would get. Something it wouldn’t think to copy.)');
  const s = await choose(['Line up the flowers from today', 'Leave half a pancake, bite included', 'Write on a scrapbook page']);
  S.flags.sign = ['flowers', 'pancake', 'note'][s];
  if (s === 0) await N('(The meadow flowers, laid out in a line in the snow. Some of them are sticks. They’ll know.)');
  if (s === 1) await N('(Half a pancake on a plate, with one enormous bite out of it. They’ll know that bite anywhere.)');
  if (s === 2) await N('(You write: “if it’s sure about the snow day, it isn’t me. — your {gremlin}”)');
  await N('(Then you walk into the snow, toward wherever they are.)');
  S.control = true;
  await until(() => me.x > 24 * TILE || S.t < 0);
  S.control = false;
  await UI.fade(1, 1.8, '#ffffff');
  S.flags.noTogether = false;
  return Story.go('lastbirthday');
};

CH.lastbirthday = async () => {
  Game.checkpoint('lastbirthday');
  Game.setMap('memory');
  Game.newPair();
  const m = S.map, pl = S.player, f = S.partner;
  const withFake = !S.flags.fakeWithdrawn;
  standAt(pl, 8.0, 38.3); pl.dy = 1;
  Object.assign(f, { fake: withFake, fakeLevel: 1, visible: withFake, scripted: false });
  standAt(f, 9.3, 38.5);
  if (S.flags.sleptBeside) { m.obj('mbed').data.occ = { left: pl }; standAt(pl, 7.1, 35.6); pl.pose = 'lie'; if (withFake) { standAt(f, 8.7, 35.6); f.pose = 'lie'; m.obj('mbed').data.occ.right = f; } }
  // The real Partner waits in the quiet clearing.
  S.real = Game.addExtra(makeChar('real', 'partner'), 41.1, 6.3);
  sitAt(S.real, 41.1, 6.3, { lift: 4 });
  S.real.persist = true;
  // Partner's improvised sign.
  if (S.flags.sign === 'flowers') {
    const cols = ['#f2c14e', '#e86a7a', '#ffffff', '#c9a0d9'];
    for (let i = 0; i < 9; i++) m.add({ id: 'sf' + i, kind: 'flower', x: 32.4 + i * 0.85, y: 15.9 - i * 0.78, w: 0.6, h: 0.6, layer: 'floor', data: { color: cols[i % 4] }, range: 0.6, label: 'Flowers', use: async () => { S.flags.foundSign = true; await N('(Meadow flowers, laid in a line in the snow. Pointing east. Some of them are just sticks.)'); } });
  } else if (S.flags.sign === 'pancake') {
    m.add({ id: 'signpancake', kind: 'table', x: 33.6, y: 14.2, w: 1.4, h: 0.9, solid: true, data: { plates: true, bite: true }, label: 'Half a pancake', use: async () => { S.flags.foundSign = true; await N('(Half a pancake on a plate, in the snow, with one enormous bite out of it. You would know that bite anywhere.)'); } });
  } else {
    m.add({ id: 'signnote', kind: 'page', x: 34, y: 14.4, w: 0.6, h: 0.6, layer: 'floor', data: { rot: -0.3 }, label: 'A scrapbook page', range: 0.9, use: async () => { S.flags.foundSign = true; await N('(In {P}’s terrible handwriting: “if it’s sure about the snow day, it isn’t me. — your {gremlin}”)'); } });
  }
  World.setWalls(false);
  Game.env({ dark: 0.3, darkRGB: '30,40,72', warm: -0.5, desat: 0.35, snow: 0.6, snowIndoor: false, zoom: 1.05, snowGround: 1, white: 0 }, true);
  Sound.setAmbience({ hum: 0.35, wind: 0.6 });
  Sound.setDetune(40);
  Game.snapCam();
  UI.fade(0, 2);
  await UI.act('IV', 'The Last Birthday');
  if (pl.pose === 'lie') { await N('(You wake up warm. The bed is warm. Everything past the bed is snow.)'); m.obj('mbed').data.occ = {}; standAt(pl, 8.0, 38.3); if (withFake) standAt(f, 9.3, 38.5); }
  else await N('(Snow, where the bedroom should end.)');
  if (withFake) { await P('There you are. Weird dream, huh?'); await P('Come on. Let’s go home. It’s just this way.'); }
  S.control = true;
  // Whistles from the quiet place.
  (async () => {
    while (S.chapter === 'lastbirthday' && !S.flags.reunited) {
      await wait(U.rand(16, 22));
      if (S.chapter !== 'lastbirthday' || S.flags.reunited) break;
      const d = U.dist(pl.x / TILE, pl.y / TILE, 41, 7);
      Sound.whistle(d > 18, U.clamp((41 * TILE - pl.x) / (14 * TILE), -1, 1));
    }
  })();
  // Fork: the warm house calls.
  (async () => {
    await until(() => S.chapter !== 'lastbirthday' || U.dist(pl.x / TILE, pl.y / TILE, 31, 18) < 3.2);
    if (S.chapter !== 'lastbirthday') return;
    if (f.fake && f.visible) bark(f, 'Home’s this way. It’s warm. I made breakfast.', 3.5);
  })();
  // The east path: the imitation will not follow you to the real one.
  Story.idleHint(['(The whistles are coming from the east. Past the signpost.)', '(Somewhere east of here, someone is whistling three notes.)'], () => S.chapter === 'lastbirthday' && !S.flags.reunited, 40);
  S.flags.eastGateArmed = true;
  S.hooks.push(() => {
    if (!S.flags.eastGateArmed || S.busy || UI.blocking() || !S.control) return;
    if (f.fake && f.visible && !S.flags.fakeLeftBehind && U.dist(pl.x / TILE, pl.y / TILE, 35.2, 13.6) < 2.2) { S.flags.eastGateArmed = false; Game.runScene(() => Story.eastGate()); }
  });
  S.hooks.push(() => { if (!S.flags.eastGateArmed && !S.flags.fakeLeftBehind && U.dist(pl.x / TILE, pl.y / TILE, 35.2, 13.6) > 5) S.flags.eastGateArmed = true; });
  // The clearing.
  (async () => {
    await until(() => S.chapter !== 'lastbirthday' || S.flags.rescued || (U.dist(pl.x / TILE, pl.y / TILE, 41, 7.2) < 5.2 && !S.busy && !UI.blocking()));
    if (S.chapter !== 'lastbirthday' || S.flags.rescued) return;
    S.busy = true;
    await Story.reunionClearing();
    S.busy = false;
  })();
  await until(() => S.flags.reunited || S.flags.ending);
  if (S.flags.ending) { S.control = false; await UI.fade(1, 1.5); return Story.go('ending_' + S.flags.ending); }
  // ---- Escape ----
  S.real.visible = false;
  await until(() => !UI.blocking() && !S.busy);
  S.control = false;
  await P('There’s a door. I saw it. Down past the tree. Come on — and don’t you dare let go.');
  S.flags.mustHold = false;
  S.control = true;
  S.flags.escape = true; S.flags.wallsOpen = false;
  Story.idleHint(['(The door is south, down the corridor of trees below the big tree.)'], () => S.chapter === 'lastbirthday' && !S.flags.ending, 40);
  S.hooks.push(() => {
    const want = !!S.partner.holding;
    if (want === S.flags.wallsOpen) return;
    if (!want && pl.y > 29.4 * TILE && pl.y < 35.2 * TILE) return; // never close on top of you
    World.setWalls(want); S.flags.wallsOpen = want;
    Sound.burst(0.3, { type: 'lowpass', freq: 400, vol: 0.1 });
    if (!want) bark(S.partner, 'Hand. Now. It only moves when we’re— just hold my hand.', 3);
  });
  S.hooks.push(() => {
    if (S.flags.iceDone || S.busy || UI.blocking()) return;
    const t = m.get(Math.floor(pl.x / TILE), Math.floor(pl.y / TILE));
    if (t === T.ICE) Game.runScene(() => Story.iceSlip());
  });
  await until(() => S.flags.ending && !UI.blocking());
  S.control = false;
  await UI.fade(1, 1.6, S.flags.ending === 'stay' ? '#000000' : '#ffffff');
  return Story.go('ending_' + S.flags.ending);
};
