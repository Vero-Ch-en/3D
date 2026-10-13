'use strict';
/* =========================================================================
 * Story, Echo cycles: an unusually pleasant day → a flawless imitation →
 * The First Snow. Plus every ending's short playable epilogue.
 * ========================================================================= */

Object.assign(Story, {
  async echoHouseDoor() {
    const f = S.partner;
    if (f.fake && f.visible && S.flags.snowWalk) {
      S.control = false;
      faceToward(f, S.player.x, S.player.y);
      await P('Come inside. Everything’s ready.');
      const c = await choose(['Go inside', 'Not yet']);
      if (c === 0) { S.flags.ending = 'perfect'; return; }
      await P('I’ll wait.');
      S.control = true;
      return;
    }
    if (S.flags.snowWalk) return N('(The house is dark. Warm, but dark. You don’t go in.)');
    return N('(Not yet. There’s a fire to sit by.)');
  },
  stallLabel(i) {
    if (S.chapter !== 'winter') return null;
    return ['Hot chocolate', 'Roasted chestnuts', 'Lanterns', 'Scarves', 'Snow globes', 'Music boxes', 'Mittens', 'Gingerbread'][i];
  },
  async useStall(i) {
    if (S.chapter !== 'winter') return;
    switch (i) {
      case 0:
        S.flags.cocoa = true;
        await N('(Two hot chocolates. Within a minute, {P} is holding both.)');
        await P('I’m warming them for you. It’s a service.');
        break;
      case 1: await N('(Chestnuts in a paper cone. {P} eats the first one, burns their tongue, and eats the second one anyway.)'); break;
      case 2: await N('(Paper lanterns in every colour. You buy a small one. It’s slightly lopsided. It’s perfect.)'); break;
      case 3: await N('(Scarves. Red ones. Yellow ones. Neither of you says anything. You both smile.)'); break;
      case 4: await N('(Snow globes. None of them are as good as yours. You tell the stallholder this. {P} drags you away.)'); break;
      case 5: Sound.motif('warm'); await N('(A music box plays a little tune you almost recognise.)'); break;
      case 6: await N('(Mittens. You buy a pair that doesn’t match, on purpose.)'); break;
      default: await N('(Gingerbread people. {P} bites the head off one and looks you dead in the eye.)');
    }
  },
});

/* =====================================================================
 * Echo cycle chapters
 * ===================================================================== */
CH.echo_morning = async () => {
  Game.checkpoint('echo_morning');
  Game.setMap('house');
  Game.newPair();
  const m = S.map, pl = S.player, p = S.partner, bed = m.obj('bed');
  bed.data.occ = { left: pl }; bed.data.blanket = 0;
  standAt(pl, 4.3, 2.4); pl.pose = 'lie';
  standAt(p, 4.3, 13.5); p.dy = -1; p.scripted = true;
  S.flags.pancakesMade = true; S.flags.pancakeQuality = 'golden'; S.flags.stoveOn = true;
  m.obj('table').data.plates = true; m.obj('table').data.mugs = true;
  Game.env({ dark: 0, warm: 0.8, snow: 0, desat: 0, zoom: 1.3, snowGround: 0, white: 0, snowIndoor: false }, true);
  Sound.setAmbience({ pad: 1, birds: 0.8 });
  Sound.setDetune(0);
  Cam.target = [5.1 * TILE, 3 * TILE];
  Game.snapCam();
  UI.setFade(1, '#ffffff');
  UI.fade(0, 2.2, '#ffffff');
  await wait(1.2);
  Game.observe('start');
  await N('(Morning. Warm. Their side of the bed is empty.)');
  await wait(0.6);
  await P('BIRTHDAY PANCAKES! Get down here, {giant}!');
  bed.data.occ = {}; standAt(pl, 4.3, 4.9); pl.dy = 1;
  Cam.target = null;
  S.control = true;
  await until(() => inRect(pl, 1, 11.4, 12, 21));
  S.control = false;
  S.flags.stoveOn = false;
  faceToward(p, pl.x, pl.y);
  await P('Happy birthday! I made pancakes. Perfect ones. Look at them.');
  await P('Happy birthday. …Again.');
  await P('Sorry. Weird. I don’t know why I said “again”.');
  await choose(['“Me neither.”', '“…Again?”', '“Déjà vu?”']);
  await P('It’s like I’ve done this morning before. Not in a bad way. Just… practised.');
  // Partner knows you: habits carried over in Echo Memory, read warmly.
  const h = Echo.data.habits;
  const known = [];
  if (h.waits >= 2) known.push('You always wait for me on walks, you know. Even when I’m fine.');
  if (h.fridge >= 4) known.push('And don’t open the fridge eleven times. I KNOW you.');
  if (h.letWin >= 1) known.push('And if you let me win the race again I’m filing a complaint.');
  if (h.affection >= 8) known.push('You’re going to try to hug me before I’ve even sat down. Go on. I can tell.');
  if (h.comforts >= 1) known.push('You always know when I’m scared. Before I do. It’s annoying. Thank you.');
  for (const k of known.slice(0, 2)) await P(k);
  sitAt(p, 4.96, 17.7, { dy: -1, sort: 4 });
  const s = await choose(['Sit beside them', 'Sit across from them']);
  if (s === 0) { sitAt(pl, 6.22, 17.7, { dy: -1, sort: 4 }); S.mem.sitBeside++; await P(h.sitBeside > h.sitAcross ? 'Beside. Knew it.' : 'Beside! Scandalous.'); }
  else { sitAt(pl, 4.96, 15.2, { dy: 1, sort: -40, lift: 4 }); S.mem.sitAcross++; await P(h.sitAcross > h.sitBeside ? 'Across. Business meeting. Knew it.' : 'Across? Fancy.'); }
  await N('(Their fork drifts toward your plate. Some things don’t change.)');
  await P('Mine now.');
  S.mem.foodStolen++;
  Game.addScrap('pancakes', 'Birthday pancakes. Perfect, for once. Somebody stole a bite anyway.');
  await P('Okay. Birthday walk. Then fire. I’ve planned this extensively.');
  await UI.fade(1, 1.2);
  await UI.card([
    'The walk is lovely.',
    'Every flower is open. The hill is gentle. Nobody falls in the creek.',
    '{P} cheats at the race anyway. Of course they do.',
    'There is no snow in the glade. You check. Twice.',
  ], { min: 5, stagger: 1.4 });
  Game.addScrap('meadow', 'Birthday walk. Perfect weather. Suspiciously perfect.');
  return Story.go('echo_evening');
};

CH.echo_evening = async () => {
  Game.checkpoint('echo_evening');
  Game.setMap('woods');
  Game.ensurePair();
  World.setGlade(false);
  const m = S.map, pl = S.player, p = S.partner, fire = m.obj('firepit');
  fire.data.lit = false; fire.data.dying = false;
  m.obj('logseat').data.worn = true;
  standAt(pl, 9.6, 9.8); pl.dy = 1;
  sitAt(p, 12.6, 10.05, { dy: -1, lift: 7, sort: 4 }); p.scripted = true;
  Object.assign(p, { fake: false, fakeLevel: 0, visible: true });
  Game.env({ dark: 0.52, darkRGB: '35,25,55', warm: 0.6, snow: 0, desat: 0, zoom: 1.15, snowGround: 0, white: 0 }, true);
  Sound.setAmbience({ wind: 0.1, birds: 0.08 });
  Game.snapCam();
  UI.setFade(1);
  UI.fade(0, 1.2);
  bark(p, 'Fire person! Do your thing!', 3);
  S.flags.fireReady = true;
  S.control = true;
  await until(() => S.flags.fireLit && !UI.blocking() && !S.busy);
  bark(p, 'Sit with me!', 2.5);
  await until(() => S.flags.logSit);
  S.control = false;
  sitAt(pl, 11.2, 10.05, { dy: -1, lift: 7, sort: 4 });
  await N('(The log is worn smooth in two places, side by side. Your places.)');
  await P('Okay. Close your eyes.');
  await N('(A snow globe. Two tiny figures, a tiny lantern, a few lumpy trees.)');
  await P('I feel like I’ve given you this before.');
  const g = await choose(['“You haven’t.”', '“Maybe you have.”', '“I’d take it every time.”']);
  if (g === 0) await P('No. You’re right. Weird.');
  if (g === 1) { Game.addTrust(0.4); await P('…Yeah. Maybe I have.'); }
  if (g === 2) { Game.addBond(0.6); await P('Stop it. I’ll cry on the marshmallows.'); }
  S.flags.giftReceived = true;
  Game.addScrap('globe', 'Birthday present. Again? It felt like again.');
  await P('Marshmallows! I forgot the marshmallows. Don’t move. Don’t let the fire die.');
  // A mundane separation.
  standAt(p, 12.6, 10.7);
  await walk(p, 8.9, 4.3, 95);
  p.visible = false;
  S.flags.partnerAway = true;
  S.control = true;
  const t0 = S.t;
  await until(() => S.flags.poked || S.t - t0 > 22);
  await until(() => !UI.blocking() && !S.busy);
  S.control = false;
  // Partner returns. The UI, music, and camera say nothing.
  Object.assign(p, { fake: true, fakeLevel: 2, visible: true, alpha: 1, scripted: true });
  for (let i = 0; i < 4; i++) { Sound.step('grass', true); await wait(0.4); }
  standAt(p, 8.9, 4.4);
  sitAt(pl, 11.2, 10.05, { dy: -1, lift: 7, sort: 4 });
  await walk(p, 12.6, 10.05, 95);
  sitAt(p, 12.6, 10.05, { dy: -1, lift: 7, sort: 4 });
  S.flags.partnerAway = false;
  await P('Got them. The good ones. Don’t ask what I had to do.');
  bark(p, '*tap tap*', 1.2);
  Sound.tone(900, 0.03, { vol: 0.03 }); Sound.tone(900, 0.03, { vol: 0.03, when: 0.14 });
  await wait(0.8);
  const sc = await UI.timing({ title: 'Toast a marshmallow', rounds: 1, zone: [0.55, 0.7], speed: 0.9, labels: ['Charcoal.', 'Toasty.', 'Golden.'] });
  await N(sc[0] > 0.35 ? '(A good one.)' : '(A small black planet.)');
  await N('({P} takes it off your stick and eats it.)');
  await P('Tax.');
  await wait(0.6);
  await P('I keep thinking about the snow day. When we met.');
  await P('You had a red scarf with a loose thread. You walked over and said, “Hi, I’m—” and forgot your own name for a second.');
  await P('There were three pines. A fence with one broken slat. I was sitting on the left side of the tree.');
  if (Echo.data.endings.includes('perfect') || Echo.data.endings.includes('stay')) await P('You always choose me, you know. Every time.');
  await P('I remember all of it now. Isn’t that nice? Neither of us has to wonder any more.');
  Game.observe('certainty');
  const c = await choose(['Smile. Keep listening.', '“That’s not what happened.”', '“…Tell me more.”']);
  if (c === 0) {
    await P('Maybe neither of us ever remembered it right. Maybe that’s the sad part.');
    await P('If something could remember it for us… would it matter where the memory came from?');
  } else if (c === 1) {
    Game.suspicion(2);
    await P('Isn’t it? Then tell me what happened.');
    const d = await choose(['“…I don’t know.”', '“You were on the right side of the tree.”']);
    if (d === 0) await P('See? You don’t know. I do.');
    else { S.mem.acceptedFake += 0.5; await P('…Maybe. Maybe you’re right. It’s nice to be sure, isn’t it?'); }
  } else {
    await P('Your mittens didn’t match. You gave me one. I still have it somewhere.');
    await P('I remember everything about you. I always will.');
  }
  await P('Let’s walk. Just a little. The snow’s nice.');
  Game.env({ snow: 0.5, snowGround: 1, warm: -0.2, desat: 0.15 });
  Sound.setAmbience({ wind: 0.45, fire: 0.5, crackle: 0.4 });
  S.flags.windowSnow = true;
  standAt(pl, 11.2, 10.7); standAt(p, 12.6, 10.7);
  p.scripted = false;
  p.lead = { x: 9, y: 4.9 };
  S.flags.snowWalk = true;
  World.setGlade(true);
  Story.idleHint(['(Somewhere off the path, toward the old glade, someone is whistling.)'], () => S.chapter === 'echo_evening' && !S.flags.toGlade && !S.flags.ending, 35);
  S.control = true;
  // Whistles from the glade.
  (async () => {
    await wait(5);
    while (S.chapter === 'echo_evening' && !S.flags.toGlade && !S.flags.ending) {
      const G = m.data.GLADE;
      const d = U.dist(pl.x / TILE, pl.y / TILE, G[0], G[1]);
      Sound.whistle(d > 16, U.clamp((G[0] * TILE - pl.x) / (14 * TILE), -1, 1));
      await wait(U.rand(15, 21));
    }
  })();
  // Turning toward the whistles.
  (async () => {
    await until(() => S.chapter !== 'echo_evening' || S.flags.ending || U.dist(pl.x / TILE, pl.y / TILE, 21, 27.5) < 3.5 || U.dist(pl.x / TILE, pl.y / TILE, m.data.GLADE[0], m.data.GLADE[1]) < 7);
    if (S.chapter !== 'echo_evening' || S.flags.ending) return;
    await until(() => !UI.blocking() && !S.busy);
    if (S.flags.toGlade || S.flags.ending) return;
    if (p.fake && p.visible) {
      S.busy = true; S.control = false;
      p.lead = null; p.path = null;
      faceToward(p, pl.x, pl.y);
      await P('…You’re going to look for them.');
      await P('If I were exactly the same, would it matter where I came from?');
      const k = await choose(['“Yes.”', 'Keep walking.']);
      if (k === 0) await P('…Why?');
      await P('…I’ll be here.');
      p.mode = 'stay';
      S.hooks.push(() => { if (p.visible && Game.partnerDist() > 8) p.visible = false; });
      S.busy = false; S.control = true;
    }
  })();
  await until(() => S.flags.ending || (U.dist(pl.x / TILE, pl.y / TILE, m.data.GLADE[0], m.data.GLADE[1]) < 2.4 && !UI.blocking() && !S.busy && !(p.fake && p.visible && p.mode !== 'stay')));
  S.control = false;
  if (S.flags.ending) { await UI.fade(1, 1.5); return Story.go('ending_' + S.flags.ending); }
  S.flags.toGlade = true;
  await N('(In the middle of the snow, two sets of small footprints. They stop in the middle, facing each other.)');
  await N('(You step into the circle.)');
  await UI.fade(1, 1.8, '#ffffff');
  return Story.go('echo_elsewhere');
};

CH.echo_elsewhere = async () => {
  Game.setMap('festival');
  const me = makeChar('player', 'partner', { speed: 86 });
  S.player = me;
  const fp = makeChar('fakePlayer', 'player', { speed: 84 });
  S.partner = fp;
  Object.assign(fp, { fake: true, fakeLevel: 2, visible: true, scripted: true });
  S.map.obj('fence').visible = true;
  standAt(me, 22.4, 29.5); me.dy = -1;
  standAt(fp, 23.6, 29.5);
  Game.spawnCrowd(16, true);
  S.flags.noTogether = true;
  Game.env({ dark: 0.45, darkRGB: '22,26,52', warm: 0.1, desat: 0.3, snow: 0.5, zoom: 1.2, snowGround: 1, white: 0 }, true);
  Sound.setAmbience({ crowd: 0.3, wind: 0.3 });
  Game.snapCam();
  UI.setFade(1, '#ffffff');
  await UI.card(['Elsewhere.'], { hold: 2.2, min: 1.2 });
  UI.fade(0, 1.4, '#ffffff');
  await N('(For a little while, you are {P} again.)');
  await N('(The winter fair. All of it. Every stall, every lantern, exactly where it was. You don’t remember it being this exact.)');
  await POV('I remember exactly what I said to you, the first time. I said, “Do you want to see something?”');
  await N('(Nobody remembers that. Not even them. Especially not them.)');
  const c = await choose(['“…Yeah. You did.”', 'Say nothing.']);
  if (c === 1) await POV('You’re quiet.');
  await N('(Keep it talking. Keep it walking. Find the quiet place.)');
  await POV('Come on. This way.');
  Game.walkTo(fp, 10 * TILE, 38 * TILE, () => { fp.fadeOut = true; }, 90);
  S.control = true;
  UI.hint('(The quiet place is north, past the lanterns. It always was.)', 6);
  await until(() => me.y < 16 * TILE);
  S.control = false;
  fp.visible = false;
  await N('(You slip away between the trees, the way you did when you were small.)');
  Sound.whistle(false);
  await N('(Three. Just in case.)');
  await UI.fade(1, 1.6, '#ffffff');
  S.flags.noTogether = false;
  return Story.go('firstsnow');
};

CH.firstsnow = async () => {
  Game.checkpoint('firstsnow');
  Game.setMap('festival');
  Game.newPair();
  const m = S.map, pl = S.player, p = S.partner;
  m.obj('fence').visible = true;
  standAt(pl, 23, 21.5); pl.dy = -1;
  sitAt(p, 23.1, 7.3, { lift: 3, dy: 1 }); p.scripted = true;
  Game.env({ dark: 0.5, darkRGB: '20,26,48', warm: 0.1, desat: 0.25, snow: 0.6, zoom: 1.1, snowGround: 1, white: 0 }, true);
  Sound.setAmbience({ wind: 0.4, crowd: 0.06 });
  Sound.setDetune(0);
  Game.snapCam();
  UI.setFade(1, '#ffffff');
  UI.fade(0, 2.2, '#ffffff');
  await UI.act('', 'The First Snow');
  S.control = true;
  await until(() => Game.partnerDist() < 3.2);
  S.control = false;
  faceToward(pl, p.x, p.y);
  await N('(Neither of you moves first.)');
  standAt(p, 23.1, 7.5); faceToward(p, pl.x, pl.y);
  const c = await choose(['“Do you remember exactly what I said? When we met?”', 'Wait.']);
  if (c === 1) {
    await wait(1.6);
    await P('…Are you going to ask me something? A test? It’s fine. Ask.');
    await Y('Do you remember exactly what I said? When we met?');
  }
  await P('…No.');
  await P('I really don’t. I never did.');
  await N('(You laugh. You can’t help it.)');
  await P('What? What’s funny?');
  await N('(And then they get it, and they laugh too.)');
  await P('It gave you a whole speech, didn’t it.');
  await Y('Red scarf. Loose thread. Three pines.');
  await P('Mine said you asked if I wanted to see something.');
  await Y('Did I?');
  await P('No idea!');
  await walk(p, pl.x / TILE + 0.7, pl.y / TILE, 100);
  p.hugT = 2.2; pl.hugT = 2.2; FX.heart(pl.x, pl.y - 44);
  await wait(1.4);
  p.holding = true; p.scripted = false;
  // The Entity allowed the reunion. The festival reconstructs, warmly.
  Game.env({ dark: 0.36, warm: 0.45, desat: 0 });
  Sound.setAmbience({ crowd: 0.25, wind: 0.2, pad: 0.35 });
  Sound.motif('warm');
  Game.spawnCrowd(14, true);
  const ent = Game.addExtra(makeChar('entity', 'entity', { alpha: 0 }), 24.8, 9.4);
  ent.fadeIn = true;
  await wait(1.4);
  faceToward(pl, ent.x, ent.y);
  await E('I let you find each other.');
  await E('I wanted you both here. Together. Uncertain. So you could hear this properly.');
  await E('You have forgotten almost everything.');
  await UI.scrapbook([
    { art: 'note', caption: 'Your seventh birthday. You both forgot it until dinner. Cake at eleven at night.' },
    { art: 'campfire', caption: 'A rainy afternoon. Asleep on the floor halfway through a film. Holding hands when you woke.' },
    { art: 'note', caption: 'The argument about the lamp. Resolved on a Tuesday. Forgotten by Thursday.' },
    { art: 'snowkids', caption: 'The first snow. Every word. Every tree.' },
    { art: 'lake', caption: 'The sneeze. The real one, a second before the photograph.' },
    { art: 'note', caption: 'Four hundred and twelve ordinary Tuesdays.' },
  ], { title: 'Everything' });
  await E('You have forgotten most of your life together.');
  await E('I haven’t.');
  await P('…Which of these are ours?');
  await E('All of them.');
  await E('…That is the problem.');
  await choose(['“You don’t remember us.”']);
  await Y('You don’t remember us.');
  await E('I remember everything.');
  await Y('Exactly.');
  await E('Stay, and you get all of it back. You never forget each other. You never grow apart. You never lose anything.');
  await E('Or leave. The memories fade. You both change. One day, one of you loses the other.');
  await E('I am not lying about the cost.');
  await P('…It isn’t. That’s the worst part.');
  const d = await choose(['Stay — keep everything', 'Leave — let it fade']);
  if (d === 0) { await UI.fade(1, 1.5); return Story.go('ending_stay'); }
  await E('I can keep them.');
  await E('I can keep you.');
  await E('Nothing has to be lost.');
  await P('Some of it does.');
  await Y('That’s how you know it was ours.');
  // Its last move, in its own language: separation.
  await E('…Then let me show you what losing looks like.');
  Sound.setAmbience({ crowd: 0.65, wind: 0.2, hum: 0.2 });
  Game.spawnCrowd(34, false, true);
  p.holding = false; p.scripted = true;
  Game.walkTo(p, 14 * TILE, 30 * TILE, () => { p.visible = false; }, 140);
  ent.fadeOut = true;
  await N('(The fair fills up all at once. Voices you know. Laughter you know. {P}’s hand is gone.)');
  Story.idleHint(['(Look for them. Look everywhere.)'], () => S.chapter === 'firstsnow' && (S.flags.figuresMet || 0) < 3, 20);
  // Increasingly convincing reconstructions in the crowd.
  S.flags.figuresMet = 0;
  const spots = [[12, 29.5], [34, 30], [18, 38], [29, 38.5], [8, 37], [38, 37.5]];
  spots.forEach(([x, y]) => {
    const fig = Game.addExtra(makeChar('figure', 'partner'), x, y);
    Object.assign(fig, { role: 'figure', fake: true, fakeLevel: 2, dy: -1 });
  });
  S.control = true;
  const t0 = S.t;
  await until(() => (S.flags.figuresMet >= 3 || S.t - t0 > 75) && !UI.blocking());
  await wait(1.2);
  for (const e of S.extras) if (e.role === 'figure') e.fadeOut = true;
  Sound.whistle(false, 0);
  await wait(1.6);
  S.control = false;
  await N('(Three whistles. From the quiet place. It could make that sound. You know it could.)');
  await N('(You go anyway.)');
  for (const e of S.extras) if (e.role === 'crowd' && e.y < 26 * TILE) e.fadeOut = true;
  Object.assign(p, { visible: true, fake: false, fakeLevel: 0, scripted: true, alpha: 1 });
  standAt(p, 23.1, 7.6); p.dy = 1;
  S.control = true;
  await until(() => Game.partnerDist() < 2.6);
  S.control = false;
  faceToward(pl, p.x, p.y); faceToward(p, pl.x, pl.y);
  await N('(This time, there is no test.)');
  await choose(['Go to them']);
  await walk(pl, p.x / TILE - 0.6, p.y / TILE + 0.1, 90);
  p.hugT = 2.5; pl.hugT = 2.5; FX.heart(pl.x, pl.y - 44);
  await wait(1.6);
  Game.observe('chosen');
  p.holding = true; p.scripted = false;
  for (const e of S.extras) if (e.role === 'crowd') e.fadeOut = true;
  const ent2 = Game.addExtra(makeChar('entity', 'entity', { alpha: 0 }), 21.4, 9.6);
  ent2.fadeIn = true;
  await wait(1);
  await E('You will forget.');
  await Y('Probably.');
  await P('Probably.');
  ent2.fadeOut = true;
  Sound.setAmbience({ wind: 0.25, pad: 0.4 });
  await N('(You keep walking.)');
  S.control = true;
  m.obj('fence').visible = false;
  UI.hint('(Walk together, south, toward the lights.)', 6);
  const sy = pl.y;
  await until(() => pl.y > sy + 4 * TILE);
  S.control = false;
  await UI.fade(1, 2.4, '#ffffff');
  return Story.go('winter');
};

CH.winter = async () => {
  Game.setMap('festival');
  Game.ensurePair();
  const m = S.map, pl = S.player, p = S.partner;
  m.obj('fence').visible = false;
  standAt(pl, 22.6, 36.4); pl.dy = -1;
  standAt(p, 23.6, 36.4); p.holding = true; p.scripted = false;
  Object.assign(p, { fake: false, fakeLevel: 0, visible: true, mode: null, lead: null });
  Game.spawnCrowd(22, false);
  Game.env({ dark: 0.3, darkRGB: '35,30,62', warm: 0.9, desat: 0, snow: 0.32, zoom: 1.15, snowGround: 1, white: 0 }, true);
  Sound.setAmbience({ crowd: 0.45, pad: 0.45, wind: 0.08 });
  Game.snapCam();
  UI.setFade(1, '#ffffff');
  UI.fade(0, 2.2, '#ffffff');
  await UI.card(['A winter fair. An ordinary one.'], { hold: 3, min: 1.4 });
  Sound.motif('warm');
  await P('Hot chocolate. Then the quiet bit. Then more hot chocolate.');
  S.control = true;
  const t0 = S.t;
  await until(() => (S.flags.cocoa || S.t - t0 > 45) && !UI.blocking() && !S.busy);
  await wait(2);
  p.holding = false;
  p.lead = { x: 23.4, y: 12 };
  bark(p, 'Come on. The quiet bit.', 3);
  await until(() => U.dist(pl.x / TILE, pl.y / TILE, 23, 11) < 4 && !UI.blocking() && !S.busy);
  S.control = false;
  p.lead = null;
  standAt(p, pl.x / TILE + 0.8, pl.y / TILE);
  faceToward(p, 23 * TILE, 6 * TILE); faceToward(pl, 23 * TILE, 6 * TILE);
  await P('Okay. Where was the tree.');
  const a = await choose(['“That one.”', '“There wasn’t a tree.”', '“Three trees, at least.”']);
  if (a === 0) await P('Wrong. It was… that one. Or that one.');
  if (a === 1) await P('There was DEFINITELY a tree.');
  if (a === 2) await P('Don’t you dare use my line.');
  await P('Was I sitting or standing?');
  await Y('Sitting.');
  await P('I feel like I was standing.');
  await Y('You were sitting.');
  await P('…Agree to disagree.');
  await P('What did you say? First thing?');
  await Y('No idea.');
  await P('Me neither.');
  await N('(Nothing corrects you.)');
  p.hugT = 2; pl.hugT = 2; FX.heart(pl.x, pl.y - 40);
  await wait(1.4);
  Game.addScrap('festival', 'Winter fair. Hot chocolate (both mine, apparently). Disagreed about the tree.');
  Game.addScrap('note', 'Do not remember exactly how it started. Still glad it did.');
  await N('(Later, at home, you write the last entry together.)');
  await UI.scrapbook(S.scrap, { start: Math.ceil(S.scrap.length / 2) - 1 });
  return Story.go('ending_firstsnow');
};

/* =====================================================================
 * Endings — short final chapters, then the real message.
 * ===================================================================== */
async function finishEnding(id, name, full) {
  S.control = false;
  await UI.fade(1, 1.6);
  Sound.setAmbience({ pad: 0.5 });
  if (full) Sound.motif('warm');
  await UI.ending({
    name,
    heading: CFG.birthday.heading,
    message: full ? CFG.birthday.full : [CFG.birthday.short],
    signature: CFG.birthday.signature,
    full,
  });
  Game.finish(id);
}
function homeMorning(occBoth) {
  Game.setMap('house');
  Game.ensurePair();
  const m = S.map, pl = S.player, p = S.partner, bed = m.obj('bed');
  Object.assign(p, { fake: false, fakeLevel: 0, visible: true, inside: false, holding: false, mode: null, lead: null, task: null, scripted: true });
  m.obj('photo_empty').data.art = 'snowkids';
  m.obj('snowdoor').visible = false;
  for (const id of ['lampL', 'lampR', 'llamp']) m.obj(id).data.on = false;
  S.flags.windowSnow = false; S.flags.nightGlass = false;
  if (occBoth) {
    bed.data.occ = { left: pl, right: p }; bed.data.blanket = 1;
    standAt(pl, 4.3, 2.4); pl.pose = 'lie';
    standAt(p, 5.9, 2.4); p.pose = 'lie';
    Cam.target = [5.1 * TILE, 3 * TILE];
  }
  Game.env({ dark: 0, warm: 0.55, snow: 0, desat: 0, zoom: 1.3, snowGround: 0, white: 0, snowIndoor: false }, true);
  Sound.setAmbience({ pad: 1, birds: 0.6 });
  Sound.setDetune(0);
  Game.snapCam();
}

CH.ending_foundme = async () => {
  homeMorning(true);
  const pl = S.player, p = S.partner;
  UI.setFade(1, '#ffffff');
  UI.fade(0, 2.2, '#ffffff');
  await wait(1);
  await N('(Morning. An ordinary one.)');
  await N('(You wake up already holding on to them. Hard.)');
  await P('…You’re squeezing.');
  await Y('Yeah.');
  await P('…Okay. Squeeze away.');
  const c = await choose(['Don’t let go', 'Make breakfast together']);
  if (c === 0) await N('(You don’t let go. Gerald the pigeon judges you both from the gutter. It’s fine.)');
  else await N('(Toast, this time. They steal your crust. Of course they do.)');
  await P('Hey. You found me.');
  await Y('You whistled like an idiot.');
  await P('I whistled PERFECTLY.');
  Game.addScrap('note', 'Ordinary morning. Squeezed. (Lovingly.)');
  S.map.obj('bed').data.occ = {};
  standAt(pl, 4.3, 4.9); standAt(p, 5.9, 4.9); p.scripted = false;
  Cam.target = null;
  S.control = true;
  UI.hint('(Take your time.)', 4);
  await wait(12);
  await N('(Two toothbrushes in the cup. The window shows the garden. Green.)');
  return finishEnding('foundme', 'You Found Me', false);
};

CH.ending_uncertain = async () => {
  homeMorning(false);
  const pl = S.player, p = S.partner;
  standAt(pl, 4.3, 4.9); standAt(p, 5.9, 4.9); p.scripted = false;
  S.flags.toothbrushes = 3; S.flags.toothbrushSeen = true;
  UI.setFade(1, '#ffffff');
  UI.fade(0, 2.2, '#ffffff');
  await N('(Morning. Home. The garden is green again.)');
  await P('Morning, {giant}.');
  await Y('Morning, {gremlin}.');
  S.control = true;
  UI.hint('(Brush your teeth. It’s a normal morning.)', 6);
  await until(() => inRect(pl, 12, 1, 17, 7.5) && !UI.blocking());
  S.control = false;
  standAt(p, 15.4, 5.6);
  await N('(Three toothbrushes stand in the cup. Yours. Theirs. And theirs.)');
  if (S.flags.toothbrushThrown) await N('(You threw that one away. You’re almost sure you threw that one away.)');
  await P('…Did you buy a new toothbrush?');
  await Y('No.');
  await P('Huh.');
  await N('(They shrug. They brush their teeth with one of them. You don’t ask which.)');
  return finishEnding('uncertain', 'Uncertain Morning', false);
};

CH.ending_iknow = async () => {
  Game.setMap('house');
  Game.ensurePair();
  const pl = S.player, p = S.partner, m = S.map;
  Object.assign(p, { fake: false, visible: true, inside: false, holding: false, scripted: true });
  m.obj('llamp').data.on = true;
  S.flags.windowSnow = false;
  sitAt(pl, 21.8, 16.45, { lift: 10, sort: 6 }); sitAt(p, 20.2, 16.45, { lift: 10, sort: 6 });
  Game.env({ dark: 0.25, darkRGB: '60,30,20', warm: 0.85, snow: 0, desat: 0, zoom: 1.4, white: 0 }, true);
  Sound.setAmbience({ pad: 0.8 });
  Sound.setDetune(0);
  Game.snapCam();
  UI.setFade(1, '#ffffff');
  UI.fade(0, 2, '#ffffff');
  await N('(Home. The sofa. The scrapbook open between you.)');
  await N('(Some pages are blank now. Some have photographs neither of you is sure about.)');
  await P('Was that us? At the lake?');
  await Y('I think so.');
  await P('I don’t remember the lake.');
  await P('Do you know it’s me? Really know?');
  const c = await choose(['“No.”', '“Yes.”', '“I’m choosing it anyway.”']);
  if (c === 0) await P('Me neither. …I’m choosing it anyway.');
  if (c === 1) await P('Liar. …Lovely liar.');
  if (c === 2) await P('…Yeah. Same.');
  await N('(You start a new page. Not memories. Disagreements.)');
  Game.addScrap('note', 'Things we disagree about: the scarf. The tree. The lake. Whether you snore. (You do.)');
  await UI.scrapbook(S.scrap, { start: Math.ceil(S.scrap.length / 2) - 1 });
  return finishEnding('iknow', 'I Know It’s You', false);
};

CH.ending_perfect = async () => {
  Game.setMap('house');
  Game.ensurePair();
  const pl = S.player, p = S.partner, m = S.map;
  Object.assign(p, { fake: true, fakeLevel: 1, visible: true, inside: false, holding: false, scripted: true, mode: null });
  m.obj('table').data.plates = true; m.obj('table').data.bite = false; m.obj('table').data.burnt = false;
  m.obj('bed').data.occ = {}; m.obj('bed').data.blanket = 0;
  for (const id of ['lampL', 'lampR', 'llamp']) m.obj(id).data.on = true;
  S.flags.windowSnow = false; S.flags.toothbrushes = 2;
  sitAt(pl, 6.22, 17.7, { dy: -1, sort: 4 }); sitAt(p, 4.96, 17.7, { dy: -1, sort: 4 });
  Game.env({ dark: 0, warm: 0.7, snow: 0, desat: 0.2, zoom: 1.35, white: 0 }, true);
  Sound.setAmbience({ pad: 0.8 });
  Sound.setDetune(12);
  Game.snapCam();
  UI.setFade(1);
  UI.fade(0, 2);
  await N('(Inside, everything is exactly where it belongs.)');
  await P('Breakfast’s ready. Perfectly round. Nobody will steal any.');
  await N('(They laugh at every one of your jokes. They never steal your food. They never take the blanket.)');
  await N('(It is lovely. Every single day of it is lovely.)');
  await UI.fade(1, 2);
  // Elsewhere, the real one keeps a fire going.
  Game.setMap('woods');
  World.setGlade(true);
  const fire = S.map.obj('firepit');
  fire.data.lit = true; fire.data.dying = true;
  const real = makeChar('real', 'partner');
  S.player = makeChar('cam', 'player', { visible: false });
  standAt(S.player, 11.8, 9.6);
  S.partner = real;
  sitAt(real, 12.6, 10.05, { dy: -1, lift: 7, sort: 4 }); real.scripted = true;
  Game.env({ dark: 0.78, darkRGB: '10,14,32', warm: -0.4, snow: 0.55, snowGround: 1, desat: 0.2, zoom: 1.5 }, true);
  Sound.setAmbience({ wind: 0.5, fire: 0.2, crackle: 0.2 });
  Sound.setDetune(0);
  Game.snapCam();
  UI.fade(0, 2.2);
  await wait(2.4);
  Sound.whistle(false);
  await wait(3.2);
  Sound.whistle(false);
  await wait(3.4);
  await N('(Somewhere else, someone keeps a small fire going for as long as they can.)');
  return finishEnding('perfect', 'The Perfect Partner', false);
};

CH.ending_stay = async () => {
  Game.setMap('house');
  Game.ensurePair();
  const pl = S.player, p = S.partner, m = S.map;
  Object.assign(p, { fake: false, fakeLevel: 0, visible: true, inside: false, holding: false, scripted: true, mode: null });
  const tb = m.obj('table');
  tb.data.plates = false; tb.data.cake = true; tb.data.mugs = false;
  for (const id of ['lampL', 'lampR', 'llamp']) m.obj(id).data.on = true;
  S.flags.windowSnow = true; S.flags.frozenSnow = true;
  sitAt(pl, 6.22, 17.7, { dy: -1, sort: 4 }); sitAt(p, 4.96, 17.7, { dy: -1, sort: 4 });
  Game.env({ dark: 0.45, darkRGB: '30,24,40', warm: 0.6, snow: 0, desat: 0.1, zoom: 1.4, white: 0 }, true);
  Sound.setAmbience({ pad: 0.6 });
  Sound.setDetune(6);
  Game.snapCam();
  UI.setFade(1);
  UI.fade(0, 2);
  await N('(A cake. Candles. Snow outside the window, hanging in the air, not falling.)');
  await UI.card(['Day 1.', 'Day 2.', 'Day 41.', 'Day 412.'], { min: 3.5, stagger: 1.1 });
  await N('(Nobody gets older. Nothing gets forgotten. The candles never burn down.)');
  if (S.vars.bond >= 5) {
    await P('If you’re staying, I’m staying. Obviously.');
    await N('(They make the same joke about the candles every time. You laugh every time. You’re almost sure it’s the same joke.)');
  } else {
    await P('…I can’t. I’m sorry. I can’t live inside a photograph.');
    p.scripted = true;
    await walk(p, 15.5, 20.4, 80);
    p.visible = false;
    Sound.thud();
    await N('(The front door closes. On the other side of it, very faintly, the snow starts falling again.)');
  }
  S.flags.frozenSnow = false;
  return finishEnding('stay', 'Stay Here', false);
};

CH.ending_firstsnow = async () => {
  return finishEnding('firstsnow', 'The First Snow', true);
};
