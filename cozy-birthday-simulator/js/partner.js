'use strict';
/* =========================================================================
 * Partner AI. A person with local intentions, not a follower tether.
 * States: relaxed, interested, social, competitive, affectionate,
 *         uneasy, scared, terrified, scripted.
 * The same code drives the imitation; only behavioural rhythm differs.
 * Nothing visual distinguishes them.
 * ========================================================================= */
const BARKS = {
  social: ['Hi.', 'Just checking you’re still here.', 'Birthday person. Hello.', 'You look thinky.', 'Boop.', 'Hey. Hey. Hi.', 'Still you? Good.', 'Missed you. It’s been ninety seconds.'],
  socialOut: ['Look at that tree. Doug’s cousin.', 'I can smell summer. Or a dog.', 'You walk so loud. Like a friendly bear.', 'Race you. No. Later. Maybe.', 'Hold my hand or I’ll fall in something.'],
  uneasy: ['…It’s quiet.', 'Stay close, okay?', 'Do you hear birds? I don’t hear birds.', '…Okay.'],
  scared: ['Don’t let go.', 'Please don’t go anywhere.', 'Home. Please.', 'Stay.'],
  wait: ['Come ON, slowpoke.', 'Old knees! Old knees!', 'I’m waiting. Majestically.', 'Hurry up, {giant}!'],
  waited: ['You always wait for me.', 'You waited again.', 'You know you can just walk, right? I’ll catch up.'],
  initHand: ['*takes your hand*', 'Mine.', 'Hand. Thank you.'],
  initHug: ['*hugs you from behind*', 'Gotcha.', 'Just a quick one.'],
};

const PartnerAI = {
  update(p, dt) {
    if (!p) return;
    p.blinkT -= dt; if (p.blinkT < -0.15) p.blinkT = U.rand(2, 5);
    if (p.bubble) { p.bubble.age += dt; p.bubble.t -= dt; if (p.bubble.t <= 0) p.bubble = null; }
    if (p.hugT > 0) p.hugT -= dt;
    if (p.inside) { this.inside(p, dt); return; }
    if (!p.visible) return;
    this.fidget(p, dt);
    if (p.path) return; // path following is handled by Game.updateChar
    if (p.scripted || p.pose === 'lie') return;
    if (p.pose === 'sit' && !p.holding && !p.task) return;
    const pl = S.player;
    const d = Game.partnerDist();
    const fear = S.vars.fear;
    p.mood = p.fake ? 'neutral' : fear > 0.45 ? 'scared' : p.moodHold || 'neutral';
    if (p.mode === 'stay') { p.moving = false; faceToward(p, pl.x, pl.y); return; }
    if (p.holding) { this.followTrail(p, dt, 22, true); return; }
    if (p.lead) { this.lead(p, dt); return; }
    if (p.fake) { this.fakeFollow(p, dt); return; }
    if (fear > 0.45) {
      this.followTrail(p, dt, fear > 0.7 ? 20 : 32, false);
      p.socialT = (p.socialT || 0) + dt;
      if (p.socialT > 9 && U.chance(0.4)) { p.socialT = 0; bark(p, U.pick(BARKS.scared)); }
      return;
    }
    if (p.mode === 'flowers') { this.flowers(p, dt); return; }
    // Relaxed autonomy, driven by needs.
    p.social = (p.social || 0) + dt * (0.03 + Math.min(0.03, S.vars.bond * 0.004));
    p.curious = (p.curious || 0) + dt * 0.045;
    if (fear > 0.2) { p.social += dt * 0.05; p.curious = 0; }
    if (p.task) { this.task(p, dt); return; }
    const maxD = S.map.kind === 'indoor' ? 11 : 7;
    if (d > maxD) { this.goNear(p, 2.2); return; }
    if (p.social > 1 && d < 12) { p.social = 0; this.approach(p); return; }
    if (p.curious > 1) {
      p.curious = 0;
      const objs = S.map.objects.filter((o) => o.smart && o.visible && (!o.smart.cond || o.smart.cond()) && o !== p.lastSmart);
      if (objs.length) {
        const o = U.pick(objs);
        p.task = { o, phase: 'go', t: 0 };
        p.lastSmart = o;
        const [sx, sy] = o.smart.spot;
        Game.walkTo(p, sx * TILE, sy * TILE, null, 70);
        return;
      }
    }
    if (d > 2.5 && d < maxD && !p.moving && U.chance(dt * 0.15)) faceToward(p, pl.x, pl.y);
  },

  fidget(p, dt) {
    if (p.fake && (p.fakeLevel || 1) < 2) { p.fidgetKind = null; return; } // the imitation stands perfectly still
    if (p.fidgetKind) {
      p.fidget += dt * 1.4;
      if (p.fidget >= 1) { p.fidgetKind = null; p.fidget = 0; }
      return;
    }
    if (p.moving || p.pose !== 'stand') return;
    p.fidgetT -= dt;
    if (p.fidgetT <= 0) {
      p.fidgetT = U.rand(2.5, 6);
      const k = U.pick(['tuck', 'sway', 'look', 'sway']);
      if (k === 'look') { p.dx = -p.dx || 0.7; p.dy = p.dy * 0.4; }
      else { p.fidgetKind = k; p.fidget = 0; }
    }
  },

  inside(p, dt) {
    if (p.insideT == null) return;
    p.insideT -= dt;
    if (p.insideT <= 0) {
      p.inside = false; p.insideT = null; p.visible = true;
      const o = p.insideObj;
      if (o) { p.x = o.smart.exit[0] * TILE; p.y = o.smart.exit[1] * TILE; }
      p.task = null;
    }
  },

  followTrail(p, dt, gap, tight) {
    const pl = S.player;
    const trail = S.trail;
    let tx = pl.x, ty = pl.y;
    let acc = 0;
    for (let i = trail.length - 1; i > 0; i--) {
      acc += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
      if (acc >= gap) { tx = trail[i - 1].x; ty = trail[i - 1].y; break; }
    }
    if (tight && !pl.moving) {
      // Stand beside rather than behind when stopped.
      const side = (pl.dx >= 0 ? -1 : 1);
      const bx = pl.x + side * 18, by = pl.y + 2;
      if (canStand(S.map, bx, by, 6)) { tx = bx; ty = by; }
    }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > 260) { p.x = tx; p.y = ty; return; }
    if (d > 3) {
      const sp = Math.max(pl.speed * (pl.running ? 1.8 : 1.05), d * 3);
      const st = Math.min(d, sp * dt);
      p.x += dx / d * st; p.y += dy / d * st;
      p.dx = dx / d; p.dy = dy / d; p.moving = true; p.walkT += dt * (sp / 92);
      p.running = sp > 120;
    } else {
      p.moving = false; p.running = false;
      if (tight) { p.dx = pl.dx; p.dy = pl.dy; }
    }
    p.holdSide = p.x < pl.x ? 1 : -1;
    pl.holdSide = -p.holdSide;
  },

  goNear(p, r) {
    const pl = S.player;
    const a = Math.atan2(p.y - pl.y, p.x - pl.x);
    Game.walkTo(p, pl.x + Math.cos(a) * r * TILE, pl.y + Math.sin(a) * r * TILE, null, 105);
  },

  approach(p) {
    const pl = S.player;
    Game.walkTo(p, pl.x + (p.x < pl.x ? -24 : 24), pl.y + 4, () => {
      if (Game.partnerDist() > 2.2 || p.holding) return;
      faceToward(p, pl.x, pl.y);
      // Signature micro-behaviour: the double tap.
      p.tapT = 0.6;
      bark(p, '*tap tap*', 1.1);
      Sound.tone(900, 0.03, { vol: 0.03 }); Sound.tone(900, 0.03, { vol: 0.03, when: 0.14 });
      setTimeout(() => {
        if (!p.visible || p.fake) return;
        const affectionate = S.mem.affection >= 4 && S.vars.bond > 3;
        if (affectionate && U.chance(0.35) && !p.holding && S.flags.allowHold !== false) {
          if (U.chance(0.5)) { p.holding = true; S.mem.partnerInit++; bark(p, U.pick(BARKS.initHand)); p.holdTimer = U.rand(14, 24); }
          else { p.hugT = 1.4; S.player.hugT = 1.4; FX.heart(pl.x, pl.y - 40); S.mem.partnerInit++; bark(p, U.pick(BARKS.initHug)); }
          return;
        }
        if (S.mem.waits >= 3 && !S.flags.saidWaits && S.map.kind !== 'indoor') { S.flags.saidWaits = true; bark(p, U.pick(BARKS.waited), 3.4); return; }
        bark(p, U.pick(S.map.kind === 'indoor' ? BARKS.social : BARKS.social.concat(BARKS.socialOut)));
      }, 900);
    }, 100);
  },

  task(p, dt) {
    const t = p.task;
    if (!t) return;
    const o = t.o;
    if (t.phase === 'go') {
      if (p.path) return;
      t.phase = 'do';
      t.t = U.rand(o.smart.dur[0], o.smart.dur[1]);
      if (o.smart.hide) { p.inside = true; p.visible = false; p.insideT = t.t; p.insideObj = o; if (o.smart.line) bark(p, o.smart.line); p.task = null; return; }
      if (o.smart.pose === 'sit') { p.pose = 'sit'; p.sitLift = o.smart.lift || 8; p.sitSort = o.smart.sort || 4; }
      if (o.smart.face) { p.dx = o.smart.face[0]; p.dy = o.smart.face[1]; }
      if (o.smart.lines && U.chance(0.75)) bark(p, U.pick(o.smart.lines));
      if (o.smart.onUse) o.smart.onUse(p);
      return;
    }
    t.t -= dt;
    const d = Game.partnerDist();
    if (t.t <= 0 || d > 13) {
      p.pose = 'stand'; p.sitLift = 0;
      p.task = null;
    }
  },

  lead(p, dt) {
    const L = p.lead;
    const d = Game.partnerDist();
    p.leadT = (p.leadT || 0) - dt;
    if (L.arrived) { if (!p.moving) faceToward(p, S.player.x, S.player.y); if (d > 3 && U.chance(dt * 0.08)) bark(p, U.pick(BARKS.wait)); return; }
    if (d > 6.5) {
      if (p.path) { p.path = null; p.moving = false; }
      faceToward(p, S.player.x, S.player.y); // look back
      if (p.leadT <= 0) { p.leadT = U.rand(6, 10); bark(p, U.pick(BARKS.wait)); }
      return;
    }
    if (!p.path) {
      Game.walkTo(p, L.x * TILE, L.y * TILE, () => { L.arrived = true; if (L.cb) L.cb(); }, d < 3 ? 104 : 88);
    }
    // Look back over the shoulder now and then.
    if (p.moving && U.chance(dt * 0.25)) { p.lookBackT = 0.5; }
  },

  flowers(p, dt) {
    if (p.path) return;
    if ((p.picked || 0) >= 5) { p.mode = null; bark(p, 'Okay, I have SO many. Hill!'); return; }
    const fl = S.map.objects.filter((o) => o.kind === 'flower' && o.visible && o.data.meadow);
    if (!fl.length) { p.mode = null; return; }
    fl.sort((a, b) => U.dist(a.x, a.y, p.x / TILE, p.y / TILE) - U.dist(b.x, b.y, p.x / TILE, p.y / TILE));
    const f = fl[Math.min(fl.length - 1, U.irand(0, 1))];
    Game.walkTo(p, (f.x + 0.3) * TILE, (f.y + 0.5) * TILE, () => {
      if (!f.visible) return;
      f.visible = false; p.picked = (p.picked || 0) + 1; S.mem.partnerFlowers++;
      FX.sparkle((f.x + 0.3) * TILE, f.y * TILE, f.data.color);
      if (U.chance(0.4)) bark(p, U.pick(['Mine!', 'Ha!', 'That one’s pretty. Like me.', 'Six. Seven. Twelve.']));
    }, 96);
  },

  // The imitation, first form: no wandering, no fidget, no double-tap, steady gaze.
  fakeFollow(p, dt) {
    const pl = S.player;
    const d = Game.partnerDist();
    if (p.fakeLevel >= 2) { this.followTrail(p, dt, 30, false); return; }
    if (d > 1.6) this.followTrail(p, dt, 40, false);
    else { p.moving = false; faceToward(p, pl.x, pl.y); }
  },

  /* ---------------- Together actions ---------------- */
  actions() {
    const p = S.partner;
    const acts = [
      { id: 'hug', t: 'Hug', icon: '♡' },
      { id: 'hand', t: p.holding ? 'Let go' : 'Hold hand', icon: '✋' },
      { id: 'tease', t: 'Tease', icon: '☺' },
      { id: 'kiss', t: 'Kiss', icon: '♥' },
      { id: 'talk', t: 'Talk', icon: '…' },
    ];
    return acts.filter((a) => !(S.flags.noKiss && a.id === 'kiss'));
  },
  async together(id) {
    const p = S.partner, pl = S.player;
    if (!id) return;
    faceToward(pl, p.x, p.y);
    if (p.pose !== 'sit' && p.pose !== 'lie') faceToward(p, pl.x, pl.y);
    const fear = S.vars.fear;
    if (p.fake) return this.fakeTogether(id);
    switch (id) {
      case 'hug': {
        S.mem.hugs++; S.mem.affection++;
        Game.addBond(S.mem.hugs < 6 ? 0.35 : 0.08);
        p.hugT = 1.6; pl.hugT = 1.6; FX.heart((p.x + pl.x) / 2, pl.y - 40);
        if (fear > 0.45) { S.vars.fear = Math.max(0.3, fear - 0.15); S.mem.comforts++; Game.addTrust(0.4); Game.observe('comfort'); bark(p, U.pick(['…Don’t let go yet.', 'Okay. Okay.', 'Thank you.']), 2.6); return; }
        const n = S.mem.hugs;
        bark(p, n === 1 ? 'Oh! Hello. Birthday hug. Accepted.' : U.pick(['Mmf. Squished.', 'You’re so warm. Unfair.', 'Okay you can stop. Don’t stop.', '*nuzzles your shoulder*', 'Ten out of ten hug.']), 2.6);
        return;
      }
      case 'hand': {
        if (p.holding) {
          if (S.flags.mustHold) { bark(p, U.pick(['No. Hand.', 'Nope. We’re holding hands. That’s the rule now.']), 2.4); return; }
          p.holding = false; pl.holdSide = 0; bark(p, U.pick(['Aw.', 'Fine. Free range.', 'Okay.']), 1.6);
          return;
        }
        if (p.pose === 'sit' || p.pose === 'lie') { bark(p, 'Mm. Come here then.', 2); return; }
        p.holding = true; p.holdTimer = null; S.mem.holds++; S.mem.affection++;
        Game.addBond(S.mem.holds < 6 ? 0.3 : 0.05);
        if (fear > 0.45) { Game.addTrust(0.3); S.vars.fear = Math.max(0.3, fear - 0.1); }
        bark(p, fear > 0.45 ? U.pick(['*grips tight*', 'Thank you.']) : U.pick(['*laces fingers*', 'Swinging privileges?', 'Ooh. Fancy.', '*swings your hand*']), 2);
        return;
      }
      case 'tease': {
        S.mem.teases++; Game.addRivalry(0.25);
        if (fear > 0.45) { bark(p, 'Not… not now. Please.', 2.2); return; }
        const lines = [
          ['You have pillow face.', 'You have pillow PERSONALITY.'],
          ['Your hair looks like a hedgehog lost a fight.', 'The hedgehog won, actually.'],
          ['I’m older AND wiser now.', 'Older, sure.'],
          ['You’re so small.', 'I’m concentrated.'],
          ['Gremlin.', 'Lamp post.'],
          ['You’re staring.', 'I’m looking. Correction: YOU’RE staring.'],
        ];
        const L = lines[(S.mem.teases - 1) % lines.length];
        await Y(L[0]);
        await P(L[1]);
        return;
      }
      case 'kiss': {
        S.mem.kisses++; S.mem.affection++;
        Game.addBond(S.mem.kisses < 5 ? 0.35 : 0.05);
        p.hugT = 1.0; pl.hugT = 1.0; FX.heart((p.x + pl.x) / 2, pl.y - 44);
        if (fear > 0.45) { bark(p, '…Okay. That helped. A bit.', 2.4); S.vars.fear = Math.max(0.3, fear - 0.1); return; }
        bark(p, U.pick(['Mm. Cheeky.', 'Birthday kiss. Noted.', 'Again? Greedy.', 'Your breath is birthday breath.', '*flustered noise*', 'You can’t just DO that. …Do it again.']), 2.4);
        return;
      }
      case 'talk': await Story.talk(); return;
    }
  },
  // The imitation gets the facts right and the rhythm wrong.
  async fakeTogether(id) {
    const p = S.partner, pl = S.player;
    const lvl = p.fakeLevel || 1;
    switch (id) {
      case 'hug':
        p.hugT = 1.6; pl.hugT = 1.6;
        Game.suspicion(-0.5);
        bark(p, lvl >= 2 ? U.pick(['Mmf. Squished.', 'You’re warm.']) : U.pick(['There. Better?', 'I’m here.']), 2.2);
        return;
      case 'hand':
        if (p.holding) { p.holding = false; Game.suspicion(0.6); bark(p, '…Okay.', 1.6); return; }
        p.holding = true; Game.suspicion(-0.3);
        bark(p, lvl >= 2 ? '*laces fingers*' : '*holds your hand. Very still.*', 2);
        return;
      case 'tease':
        await Y(U.pick(['You have pillow face.', 'Gremlin.', 'You’re so small.']));
        if (lvl >= 2) await P('Says the walking lamp post.');
        else await P('Ha. You’re so funny, {giant}.');
        return;
      case 'kiss':
        p.hugT = 1; pl.hugT = 1;
        Game.suspicion(-0.4);
        bark(p, lvl >= 2 ? 'Mm. Cheeky.' : 'I love you.', 2.2);
        return;
      case 'talk': await Story.fakeTalk(); return;
    }
  },
};
