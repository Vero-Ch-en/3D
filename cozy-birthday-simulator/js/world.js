'use strict';
/* =========================================================================
 * World: map construction and the interaction library.
 * "Small world, many reactions."
 * ========================================================================= */

// Successive lines for repeated interactions; the last one repeats.
function cyc(o, arr, key = 'n') {
  o.data[key] = (o.data[key] || 0) + 1;
  return arr[Math.min(o.data[key] - 1, arr.length - 1)];
}
const ch = () => S.chapter;
const isNight = () => ch() === 'night';
const isEvening = () => ch() === 'evening';

const World = {
  build(id) {
    const f = { house: this.house, woods: this.woods, memory: this.memory, memoryB: this.memoryB, festival: this.festival }[id];
    return f.call(this);
  },

  /* =====================================================================
   * THE HOUSE
   * ===================================================================== */
  house() {
    const m = new GameMap('house', 28, 22, T.WALL, { kind: 'indoor', bg: '#1a1210', tilesAcross: 16 });
    m.rect(1, 1, 10, 7, T.WOOD);   // bedroom
    m.rect(12, 1, 5, 7, T.TILEF);  // bathroom
    m.rect(18, 1, 9, 7, T.WOOD);   // study
    m.rect(1, 9, 26, 2, T.WOOD);   // hallway
    m.rect(1, 12, 11, 9, T.TILEF); // kitchen
    m.rect(13, 12, 14, 9, T.WOOD); // living room
    m.set(5, 8, T.WOOD); m.set(14, 8, T.TILEF); m.set(22, 8, T.WOOD);
    m.set(6, 11, T.TILEF); m.set(7, 11, T.TILEF); m.set(19, 11, T.WOOD); m.set(20, 11, T.WOOD);
    m.set(12, 15, T.WOOD); m.set(12, 16, T.WOOD);
    for (const [x, y] of [[1, 0], [8, 0], [13, 0], [22, 0], [27, 14], [27, 15], [0, 15]]) m.set(x, y, T.WINDOW);

    /* ---------- bedroom ---------- */
    m.add({ id: 'rug_bed', kind: 'rug', x: 2.8, y: 4.7, w: 5, h: 2, layer: 'floor', data: { color: '#9c4f45' } });
    m.add({
      id: 'bed', kind: 'bed', x: 3.6, y: 1, w: 3, h: 3.3, solid: true, range: 1.1, data: { occ: {}, blanket: 1 },
      label: () => {
        if (S.flags.inBedScene) return null;
        if (ch() === 'bedtime') return 'Get into bed';
        if (isNight()) return S.player.pose === 'lie' ? 'Get up' : (S.partner.visible && S.partner.pose === 'lie' ? 'Lie down beside them' : 'Lie down');
        if (ch() === 'morning' && S.partner.pose === 'lie') return 'Lie back down';
        return 'Bed';
      },
      use: async (o) => {
        if (ch() === 'bedtime') { S.flags.bedtimeReady = true; return; }
        if (isNight()) { await Story.nightBed(); return; }
        if (ch() === 'morning' && S.partner.pose === 'lie') { await Story.morningCuddle(); return; }
        await N(cyc(o, [
          '(The bed. Their side and your side exist in theory. In practice, it’s all their side.)',
          '(You straighten the duvet. It will not survive the night.)',
          '(Not yet. Too much birthday left.)',
        ]));
      },
    });
    const lamp = (id, x) => m.add({
      id, kind: 'nightstand', x, y: 1.1, w: 0.95, h: 0.85, solid: true, data: { on: false },
      light: (o) => (o.data.on ? { r: 150, i: 0.95, color: '255,190,110', glow: 0.22 } : null),
      label: () => 'Lamp',
      use: async (o) => {
        o.data.on = !o.data.on;
        Sound.tone(1800, 0.02, { vol: 0.04, type: 'square', release: 0.02 });
        if (o.data.on && S.partner.visible && Game.partnerDist() < 5 && !S.partner.fake && U.chance(0.5)) bark(S.partner, U.pick(['Mood lighting. Bold.', 'Ooh. Ambience.', 'Are we being romantic at a lamp?']));
      },
    });
    lamp('lampL', 2.55); lamp('lampR', 6.7);
    m.add({
      id: 'wardrobe', kind: 'wardrobe', x: 9.7, y: 2, w: 1.2, h: 2.4, solid: true, label: 'Wardrobe',
      use: async (o) => N(cyc(o, [
        '(Your hoodie is in here. Correction: it was. It is in {P}’s possession now, permanently.)',
        '(Half the hangers are empty. The other half hold clothes neither of you has worn since a wedding.)',
        '(A shoebox labelled “IMPORTANT”. It contains one shoe.)',
      ])),
    });
    m.add({
      id: 'laundry', kind: 'laundry', x: 1.2, y: 6.4, w: 0.8, h: 0.8, solid: true, label: 'Laundry basket',
      use: async (o) => N(cyc(o, ['(Mostly {P}’s. Some yours. Some genuinely unidentifiable.)', '(A sock with no partner. Relatable, for a sock.)'])),
    });
    m.add({
      id: 'nsL', kind: 'zone', x: 2.55, y: 1.9, w: 0.95, h: 0.3, label: 'Your side table',
      use: async (o) => N(cyc(o, ['(A glass of water from Tuesday. A charger. A note in {P}’s handwriting: “you snore. lovingly.”)', '(The note has a tiny drawing of you snoring. It’s unflattering and accurate.)'])),
    });
    m.add({
      id: 'nsR', kind: 'zone', x: 6.7, y: 1.9, w: 0.95, h: 0.3, label: 'Their side table',
      use: async (o) => {
        if (isNight()) return N('(Four hair ties. A bookmark. Their phone is still here, face down. They didn’t take it with them.)');
        return N(cyc(o, [
          '(Their side: four hair ties, a receipt, and a book they’ve been “almost finished with” for a year.)',
          '(A shopping list: “eggs, batteries, ̶c̶a̶n̶d̶l̶e̶s̶ (NOT candles, they’ll notice)”. Huh.)',
          '(The book has a bookmark on page 12. It has been on page 12 since spring.)',
        ]));
      },
    });
    const bwin = (id, x) => m.add({
      id, kind: 'zone', x, y: 1, w: 1, h: 0.4, label: 'Window',
      use: async (o) => {
        if (S.flags.windowSnow) return N(isNight() ? '(Snow, heavy and silent, all the way to the trees. The garden is gone under it.)' : '(Snow on the sill. Only on the sill. The garden beyond is green.)');
        if (S.env.dark > 0.3) return N('(The garden in the dusk. Somebody’s wind chime, three gardens over.)');
        await N(cyc(o, ['(Morning. A fat pigeon is judging you from the gutter.)', '(The pigeon remains. The judgement remains.)']));
        if (o.data.n === 1 && Game.partnerDist() < 6 && !S.partner.fake) await P('That’s Gerald. He’s not judging. That’s just his face.');
      },
    });
    bwin('bwin1', 1); bwin('bwin2', 8);

    /* ---------- bathroom ---------- */
    m.add({ id: 'bathmat', kind: 'bathmat', x: 14.1, y: 4.4, w: 1.6, h: 1, layer: 'floor' });
    m.add({
      id: 'bathtub', kind: 'bathtub', x: 12.1, y: 1.1, w: 1.7, h: 3.2, solid: true, label: 'Bath',
      use: async (o) => N(cyc(o, ['(Bath bombs, lined up by colour. The blue one is labelled “EMERGENCY”.)', '(You do not know what the emergency is. You hope to never find out.)'])),
    });
    m.add({
      id: 'sink', kind: 'sink', x: 14.2, y: 1.05, w: 1.3, h: 0.8, solid: true, label: 'Toothbrushes',
      use: async (o) => {
        const n = S.flags.toothbrushes || 2;
        if (isNight()) return N('(Two toothbrushes. Yours, and one dinosaur. The bristles are dry.)');
        if (n === 3) {
          await N('(Three toothbrushes. Yours. Theirs. And… theirs. Exactly theirs. Same dinosaur. Same chewed bristles.)');
          if (!S.flags.toothbrushSeen) {
            S.flags.toothbrushSeen = true;
            const c = await choose(['Throw the third one away', 'Leave it']);
            if (c === 0) { S.flags.toothbrushes = 2; S.flags.toothbrushThrown = true; await N('(You drop it in the bin. It makes a very normal sound.)'); }
            else await N('(You leave it. It isn’t hurting anyone. Probably.)');
            if (S.partner.inside) bark(S.partner, 'Everything okay out there?', 3);
          }
          return;
        }
        await N(cyc(o, [
          '(Two toothbrushes. Yours is the sensible one. Theirs has a dinosaur on it.)',
          '(The dinosaur’s name, you have been told, is Rex. Rex has seen things.)',
          '(Two toothbrushes. Everything in order.)',
        ]));
      },
    });
    m.add({
      id: 'mirror', kind: 'mirror', x: 15.6, y: 1, w: 1.2, h: 0.5, layer: 'wall', label: 'Mirror',
      use: async (o) => {
        if (isNight()) return N('(The mirror is fogged. You haven’t run any water.)');
        await N(cyc(o, ['(You look one year older. Around the eyes, maybe. Or that’s just the pillow crease.)', '(You attempt a mature, older face. It doesn’t take.)', '(Still you. Annoyingly.)']));
      },
    });

    /* ---------- study (Partner's project) ---------- */
    m.add({ id: 'roof', kind: 'roof', x: 17.9, y: 0.4, w: 9.2, h: 7.6, layer: 'over', data: { text: '' } });
    m.add({
      id: 'studydoor', kind: 'door', x: 22, y: 8, w: 1, h: 1, solid: true, data: { sign: true }, label: 'Study door',
      use: async (o) => {
        if (S.partner.inside) { bark(S.partner, U.pick(['NOPE.', 'Birthday business! Shoo!', 'I can hear you breathing on the door.', 'No giants. It says. On the sign.']), 2.6); return; }
        if (isNight()) return N('(Locked. You can hear nothing at all on the other side. Not even the house.)');
        await N(cyc(o, ['(Locked. A sign on it says “NO GIANTS” in marker.)', '(Still locked. The sign has acquired a second, smaller sign: “THIS MEANS YOU”.)']));
      },
    });

    /* ---------- hallway ---------- */
    const photo = (id, x, art, lines) => m.add({
      id, kind: 'photo', x, y: 9, w: 0.8, h: 0.5, layer: 'wall', data: { art }, label: 'Photo',
      use: async (o) => {
        if (o.data.art === 'snowkids' || o.data.art === 'snowkids3') { await Story.inspectSnowPhoto(o); return; }
        if (o.data.art === 'empty') return N(cyc(o, ['(An empty frame. You’ve been meaning to fill it for three years.)', '(Still empty. It’s waiting for the right one, apparently.)']));
        await UI.photo(o.data.art, lines[0]);
        if (lines[1] && Game.partnerDist() < 5 && !S.partner.fake) await P(lines[1]);
      },
    });
    photo('photo_lake', 2.5, 'lake', ['Lake trip. Someone sneezed at the exact moment.', 'Burn that one. I’m begging you.']);
    photo('photo_cake', 8.6, 'cake', ['Somebody’s wedding. Both holding the same slice of cake. Neither of you remembers whose wedding.', 'It was a lovely wedding. Whoever they were.']);
    photo('photo_empty', 17.6, 'empty', []);
    m.add({
      id: 'coatrack', kind: 'coatrack', x: 25.3, y: 9.2, w: 0.9, h: 0.6, solid: true, label: 'Coats',
      use: async (o) => N(cyc(o, ['(Your coat. Their coat. And a scarf neither of you claims. Grey? Blue? The light in here is bad.)', '(The unclaimed scarf. You both swear it’s the other one’s.)'])),
    });

    /* ---------- kitchen ---------- */
    m.add({ id: 'counter', kind: 'counter', x: 1, y: 12, w: 8.1, h: 0.95, solid: true, data: { kettleX: 0.2, stoveX: 2.6, sinkX: 5.1, toasterX: 7.1, glass: 4.6 } });
    m.add({
      id: 'kettle', kind: 'zone', x: 1.1, y: 12, w: 0.9, h: 0.95, label: () => (S.flags.teaMade ? 'Kettle' : 'Make tea'),
      use: async (o) => {
        if (isNight()) return N('(The kettle is cold. It has been cold for hours.)');
        if (!S.flags.teaMade && (ch() === 'morning' || ch() === 'echo_morning')) {
          S.flags.kettleOn = true;
          await N('(You fill the kettle and get two mugs down. One for you. One for them: two sugars, which they will deny.)');
          S.flags.teaMade = true; S.flags.kettleOn = false;
          Game.map('house').obj('table').data.mugs = true;
          if (Game.partnerDist() < 7 && !S.partner.fake) bark(S.partner, 'Is that tea? Is one of those mine?');
          return;
        }
        await N('(The kettle’s still warm.)');
      },
    });
    m.add({
      id: 'stove', kind: 'zone', x: 3.6, y: 12, w: 1.2, h: 0.95,
      label: () => (ch() === 'morning' && !S.flags.pancakesMade ? 'Make pancakes' : 'Stove'),
      use: async (o) => {
        if (ch() === 'morning' && !S.flags.pancakesMade) { await Story.makePancakes(); return; }
        if (isNight()) return N('(The hob is cold. One of the dials is turned to “THE SNOW”. There is no setting called that.)');
        await N(cyc(o, ['(The pan is still a bit warm from breakfast.)', '(You resist the urge to make more pancakes.)']));
      },
    });
    m.add({
      id: 'ksink', kind: 'zone', x: 6.1, y: 12, w: 1.1, h: 0.95,
      label: () => (isNight() && S.flags.nightGlass ? 'A glass of water' : 'Sink'),
      use: async (o) => {
        if (isNight() && S.flags.nightGlass) { S.flags.sawGlass = true; Story.nightClue('glass'); return N('(A glass of water on the counter, half full. The tap is still dripping. Whoever filled it didn’t take it with them.)'); }
        await N(cyc(o, ['(Dishes from last night: two mugs, two forks, one suspiciously licked spoon.)', '(You wash the spoon. Some mysteries are better left clean.)']));
      },
    });
    m.add({
      id: 'toaster', kind: 'zone', x: 8.1, y: 12, w: 0.9, h: 0.95, label: 'Toaster',
      use: async (o) => N(cyc(o, ['(The toaster has two settings: “warm bread” and “house fire”.)', '(You leave the toaster alone. Today is not a house-fire day.)'])),
    });
    m.add({
      id: 'fridge', kind: 'fridge', x: 9.3, y: 12, w: 1.5, h: 1.2, solid: true, label: 'Fridge',
      use: async (o) => {
        S.mem.fridge++;
        Game.observe('fridge');
        if (isNight()) return N('(The fridge light doesn’t come on. Inside, everything is arranged perfectly, labels facing out.)');
        const near = Game.partnerDist() < 7 && S.partner.visible && !S.partner.fake;
        const n = S.mem.fridge;
        if (n === 1) { S.flags.knowsPancakes = true; return N('(Eggs. Milk. Butter. A sad lemon. Pancakes are possible.)'); }
        if (n === 2) return N('(Still eggs. Still milk. The lemon is still sad.)');
        if (n === 3) { if (near) return P('It’s not going to grow new food.'); if (S.partner.visible || S.partner.inside) bark(S.partner, 'I can HEAR the fridge door!', 3); return N('(Cold air. Comforting, somehow.)'); }
        if (n === 5 && near) return P('Are you waiting for it to say happy birthday? Because I can write it on something.');
        return N('(The fridge hums. It has nothing new to say.)');
      },
    });
    m.add({
      id: 'table', kind: 'table', x: 4, y: 15.4, w: 3.2, h: 1.6, solid: true, range: 1.2, data: {},
      label: () => (S.flags.pancakesMade && !S.flags.breakfastDone ? 'Sit down for breakfast' : 'Kitchen table'),
      use: async (o) => {
        if (S.flags.pancakesMade && !S.flags.breakfastDone) { await Story.breakfast(); return; }
        if (isNight()) return N('(Two chairs, pushed in neatly. Neither of you ever pushes the chairs in.)');
        await N(cyc(o, ['(The table. Mostly used for piling things on.)', '(A pile of post, a bowl of keys, and a single birthday card, face down. It’s addressed to you. It says “not yet” on the envelope.)']));
      },
    });
    m.add({
      id: 'cupboard', kind: 'cupboard', x: 1.1, y: 18.8, w: 1, h: 1.2, solid: true, label: 'Snack cupboard',
      use: async (o) => {
        if (isNight()) return N('(The snack cupboard is full. Completely full. Nothing has been opened.)');
        await N('({P}’s snack cupboard. A note on the door: “property of me. NOT THE GIANT.”)');
        if (!S.flags.snackLeft) {
          const c = await choose(['Leave them a snack on the counter', 'Steal a biscuit', 'Close it']);
          if (c === 0) { S.flags.snackLeft = true; S.mem.snacks++; Game.addBond(0.6); await N('(You leave a biscuit on the counter, on a folded napkin, like a tiny gift.)'); }
          if (c === 1) { S.mem.stoleSnack = 1; Game.addRivalry(0.5); await N('(Delicious. Illegal. Delicious.)'); if (Game.partnerDist() < 6) await P('I SAW THAT.'); }
        }
      },
    });
    m.add({
      id: 'kwindow', kind: 'zone', x: 1, y: 14.6, w: 0.4, h: 1.2, label: 'Window',
      use: async (o) => {
        if (S.flags.windowSnow) return N(isNight() ? '(Snow against the glass. Not falling. Pressed there, flat, like it’s been packed in.)' : '(Snow on the outside sill. Only the sill.)');
        return N(cyc(o, ['(The garden. Sun on wet grass. A perfectly normal morning.)', '(The neighbour’s cat is sitting in your garden like it pays rent.)']));
      },
    });
    m.add({
      id: 'snowdoor', kind: 'snowdoor', x: 0.55, y: 16.7, w: 0.45, h: 1.3, visible: false,
      light: { r: 90, i: 0.7, color: '190,215,255', glow: 0.25 },
      label: 'A door that shouldn’t be here', range: 1.1,
      use: async () => { await Story.nightSnowDoor(); },
    });

    /* ---------- living room ---------- */
    m.add({ id: 'rug_living', kind: 'rug', x: 18.4, y: 16.7, w: 4.8, h: 2.3, layer: 'floor', data: { color: '#6e5a8a' } });
    m.add({
      id: 'bookshelf', kind: 'bookshelf', x: 13.4, y: 12, w: 2.6, h: 0.9, solid: true, label: 'Scrapbook', range: 1,
      use: async () => {
        if (isNight()) { await N('(The scrapbook falls open on its own, to the snow photograph.)'); await UI.photo('snowkids3', 'There are three of them now. You are almost sure there were two.'); S.flags.sawPhoto3 = true; Story.nightClue('photo'); return; }
        await UI.scrapbook(S.scrap, { start: Math.max(0, Math.ceil(S.scrap.length / 2) - 1) });
        if (Game.partnerDist() < 4 && !S.partner.fake && U.chance(0.6)) bark(S.partner, U.pick(['Skip the lake page.', 'We need more pages.', 'Is that my handwriting? It’s so bad.']));
      },
    });
    m.add({
      id: 'plant', kind: 'plant', x: 25.6, y: 12.1, w: 0.9, h: 0.9, solid: true, label: 'Basil',
      use: async (o) => {
        if (isNight()) return N('(Basil’s leaves are all turned toward the kitchen. Away from you.)');
        await N(cyc(o, ['(Basil. Not basil. {P} named it Basil to confuse guests.)', '(You water Basil. Basil is indifferent, as always.)', '(Basil has a new leaf. You decide not to make it weird.)']));
        if (o.data.n === 2) { S.mem.waterBasil = 1; if (Game.partnerDist() < 6) bark(S.partner, 'Thank you for hydrating my son.'); }
      },
    });
    m.add({
      id: 'sofa', kind: 'sofa', x: 19, y: 14.8, w: 3.6, h: 1.2, solid: true, range: 1.1, label: 'Sofa',
      use: async () => { await Story.sitSofa(); },
    });
    m.add({
      id: 'cushion', kind: 'zone', x: 22.3, y: 14.9, w: 0.4, h: 1.1, label: 'Under the cushions',
      use: async (o) => {
        const pancake = S.mem.foodStolen > 0 ? ' a bite of pancake (fresh),' : '';
        await N(`(Under the cushion: three of your socks, a pen, the remote for a TV you no longer own,${pancake} and half a biscuit.)`);
        if (o.data.n === undefined) { o.data.n = 1; await N('(It’s their stash. Everything in it was stolen from you. You decide to let it grow.)'); }
      },
    });
    m.add({ id: 'armchair', kind: 'armchair', x: 24.4, y: 16.4, w: 1.4, h: 1.3, solid: true, label: 'Armchair', use: async (o) => N(cyc(o, ['(The armchair. Technically yours. {P}’s blanket lives on it.)', '(The blanket smells like them. You fold it. Badly.)'])) });
    m.add({
      id: 'fireplace', kind: 'fireplace', x: 19.6, y: 20, w: 2.4, h: 1, solid: true, data: { lit: false },
      light: (o) => (o.data.lit ? { r: 200, i: 0.9, color: '255,150,70', glow: 0.3, flicker: true } : null),
      label: () => (S.flags.giftReceived ? 'Snow globe' : 'Fireplace'),
      use: async (o) => {
        if (S.flags.giftReceived) {
          if (isNight()) { S.flags.globeFallen = true; Story.nightClue('globe'); return N('(The snow globe has fallen over. The snow inside is not settling. It’s swirling, slowly, like someone just shook it.)'); }
          return N('(The snow globe. Two tiny figures, a lantern, and {P}’s best guess at the trees.)');
        }
        await N(cyc(o, ['(Cold ashes. {P} keeps saying they’ll learn to light it. You keep saying “sure”.)', '(You are the designated fire person. It’s in the unwritten constitution.)']));
      },
    });
    m.add({ id: 'llamp', kind: 'lamp', x: 13.3, y: 19.7, w: 0.6, h: 0.6, solid: true, data: { on: false }, light: (o) => (o.data.on ? { r: 160, i: 0.9, color: '255,190,110', glow: 0.2 } : null), label: 'Lamp', use: async (o) => { o.data.on = !o.data.on; Sound.tone(1800, 0.02, { vol: 0.04, type: 'square', release: 0.02 }); } });
    m.add({
      id: 'lwindow', kind: 'zone', x: 26.5, y: 13.8, w: 0.5, h: 1.6, label: 'Window',
      use: async (o) => {
        if (S.flags.windowSnow) return N(isNight() ? '(Snow, all the way out. No streetlights. No street.)' : '(Snow on the sill. The street beyond is dry.)');
        return N(cyc(o, ['(A cloud shaped like a cat. Or a pancake.)', '(A cloud shaped like a pancake. Definitely a pancake.)']));
      },
    });
    m.add({
      id: 'frontdoor', kind: 'frontdoor', x: 15, y: 21, w: 1, h: 1, solid: true, range: 1, label: 'Front door',
      use: async () => { await Story.frontDoor(); },
    });

    /* ---------- Partner's own intentions (smart objects) ---------- */
    m.obj('sofa').smart = { spot: [20.2, 16.45], pose: 'sit', lift: 10, sort: 6, face: [0, 1], dur: [10, 18], lines: ['Sofa claimed.', 'This is my sofa now. Pay rent.', '*flops dramatically*'] };
    m.obj('lwindow').smart = { spot: [26, 14.6], face: [1, 0], dur: [5, 8], lines: ['Cloud looks like you. Big. Soft.', 'There\u2019s a squirrel and he\u2019s being weird.'] };
    m.obj('plant').smart = { spot: [25.1, 13.7], face: [1, -0.6], dur: [4, 7], lines: ['You\u2019re doing amazing, Basil.', 'Don\u2019t tell the {giant}, but you\u2019re my favourite.'] };
    m.obj('bookshelf').smart = { spot: [14.7, 13.5], face: [0, -1], dur: [5, 9], lines: ['I\u2019m reading this one. I\u2019ve been reading it for a year.', 'Who owns six copies of the same cookbook? Us. We do.'] };
    m.obj('fridge').smart = { spot: [10, 13.8], face: [0, -1], dur: [3, 5], lines: ['*rustling* \u2026nothing.', '*steals a grape*', 'We need cheese. Spiritually.'] };
    m.obj('studydoor').smart = { spot: [22.5, 9.6], exit: [22.5, 9.6], hide: true, dur: [12, 22], line: 'Birthday business. Don\u2019t follow me.', cond: () => S.chapter === 'morning' };
    m.obj('mirror').smart = { spot: [16.2, 2.3], face: [0, -1], dur: [3, 5], lines: ['Who\u2019s that gorgeous person.', '*makes a face at the mirror*'] };
    m.obj('photo_lake').smart = { spot: [2.9, 9.8], face: [0, -1], dur: [3, 6], lines: ['We look so young here. Gross.', 'Mid-sneeze. Iconic.'] };
    m.obj('bwin2').smart = { spot: [8.5, 2.0], face: [0, -1], dur: [4, 6], lines: ['Morning, Gerald.', 'Gerald\u2019s back.'] };
    m.obj('armchair').smart = { spot: [25.1, 18.1], pose: 'sit', lift: 6, sort: 4, face: [0, 1], dur: [8, 14], lines: ['*wraps self in blanket*', 'Blanket burrito. Do not disturb.'] };
    return m;
  },

  /* =====================================================================
   * THE WOODS (morning walk, campfire)
   * ===================================================================== */
  woods() {
    const W = 56, H = 46;
    const m = new GameMap('woods', W, H, T.GRASS, { kind: 'outdoor', bg: '#2f4a2a', tilesAcross: 21 });
    const r = U.rng(491);
    const PATH = [[9, 4.5], [8.6, 8], [10, 12], [14, 15.5], [19, 18.6], [24, 21], [27, 22]];
    const HILLP = [[28, 21], [31, 19], [35, 15.5], [39, 12.5], [42.5, 10.5]];
    const CREEKP = [[28, 23.5], [31, 28], [35, 31.5], [38.6, 33.6]];
    const TRAIL = [[24.5, 24], [21, 27], [17.5, 30.2], [15, 32.6]];
    const WATER = [[29, 47], [32, 42], [35.5, 38.8], [40, 37], [46, 35.4], [52, 33.5], [58, 32.5]];
    const MEADOW = [27, 22], HILL = [45, 8], GLADE = [13.5, 34.5], FIRE = [11.8, 8.2];
    const d = (x, y, p) => Math.hypot(x - p[0], y - p[1]);
    m.data = { MEADOW, HILL, GLADE, FIRE };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        const dp = Math.min(U.polyDist(cx, cy, PATH), U.polyDist(cx, cy, HILLP), U.polyDist(cx, cy, CREEKP));
        const dtr = U.polyDist(cx, cy, TRAIL), dw = U.polyDist(cx, cy, WATER);
        const houseArea = x >= 1 && x <= 17 && y <= 6;
        let t = T.GRASS;
        if (dw < 1.4) t = T.WATER;
        else if (dp < 1.05) t = T.PATH;
        else if (dtr < 0.6) t = T.PATH;
        else if (d(cx, cy, HILL) < 4.6) t = T.HILL;
        if (t === T.GRASS && !houseArea) {
          const border = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
          const dg = d(cx, cy, GLADE);
          const open = dp > 2.1 && dtr > 1.5 && dw > 2.2 && d(cx, cy, MEADOW) > 6.2 && d(cx, cy, HILL) > 5.4 && dg > 3.9 && d(cx, cy, FIRE) > 3.2;
          let dens = 0.13;
          if (dg > 3.9 && dg < 6.6) dens = dtr > 1.1 ? 0.62 : 0;
          else if (x < 10 && y > 14) dens = 0.3;
          if (border || (open && r() < dens) || (dg > 3.9 && dg < 6.6 && dtr > 1.1 && r() < dens)) t = T.TREE;
          else if (open && r() < 0.25) t = T.DGRASS;
        }
        m.set(x, y, t);
      }
    }
    m.add({ id: 'facade', kind: 'facade', x: 3, y: 0, w: 12, h: 3.7, solid: true });
    m.add({ id: 'hdoor', kind: 'zone', x: 8.4, y: 3.3, w: 1.2, h: 0.5, range: 1, label: 'Front door', use: async () => { await Story.woodsDoor(); } });
    m.add({
      id: 'firepit', kind: 'firepit', x: FIRE[0] - 0.5, y: FIRE[1] - 0.5, w: 1, h: 1, solid: true, data: { lit: false }, range: 1,
      light: (o) => (o.data.lit ? { r: o.data.dying ? 90 : 230, i: 0.95, color: '255,150,70', glow: 0.35, flicker: true } : null),
      label: () => (Story.fireLabel ? Story.fireLabel() : null),
      use: async () => { await Story.useFire(); },
    });
    m.add({ id: 'logseat', kind: 'log', x: 10.4, y: 9.2, w: 2.8, h: 0.5, solid: true, range: 1, data: { worn: false }, label: () => (Story.logLabel ? Story.logLabel() : null), use: async () => { await Story.useLog(); } });
    // The meadow's flowers (deterministic placement — environmental continuity).
    const fr = U.rng(77);
    const cols = ['#f2c14e', '#e86a7a', '#ffffff', '#c9a0d9', '#ff9a6a', '#9ad0ff'];
    let fi = 0;
    for (let i = 0; i < 60 && fi < 18; i++) {
      const a = fr() * Math.PI * 2, rad = 1.5 + fr() * 4;
      const fx = MEADOW[0] + Math.cos(a) * rad, fy = MEADOW[1] + Math.sin(a) * rad;
      if (m.get(Math.floor(fx), Math.floor(fy)) !== T.GRASS) continue;
      m.add({ id: 'flower' + fi, kind: 'flower', x: fx - 0.3, y: fy - 0.3, w: 0.6, h: 0.6, layer: 'floor', data: { color: cols[fi % cols.length], meadow: true }, range: 0.5, label: () => (ch() === 'walk' ? 'Pick flower' : 'Flowers'), use: async (o) => Story.pickFlower(o) });
      fi++;
    }
    m.add({ id: 'sign', kind: 'sign', x: 29.4, y: 23.4, w: 0.6, h: 0.5, solid: true, label: 'Signpost', use: async () => N('(↑ Hill.  ↘ Creek.  ← Home. Someone has added “snacks?” in pen, with an arrow pointing at nothing.)') });
    m.add({ id: 'doug', kind: 'bigtree', x: 20.6, y: 14.6, w: 1, h: 1, solid: true, label: 'Doug', use: async (o) => { await N(cyc(o, ['(Doug. A tree. {P} named him on your first walk here. Doug has never acknowledged this.)', '(You pat Doug. Doug is unmoved, which is very Doug of him.)'])); if (o.data.n === 1 && Game.partnerDist() < 6) bark(S.partner, 'Morning, Doug!'); } });
    m.add({ id: 'flag', kind: 'flag', x: 45.6, y: 6.6, w: 0.4, h: 0.5, label: null });
    m.add({ id: 'bench', kind: 'bench', x: 44.1, y: 8.1, w: 2.4, h: 0.6, solid: true, range: 1, label: () => (Story.benchLabel ? Story.benchLabel() : 'Bench'), use: async () => { await Story.useBench(); } });
    m.add({ id: 'stones', kind: 'stones', x: 38.2, y: 34.6, w: 1.6, h: 0.6, layer: 'floor', range: 1.2, label: () => (Story.stonesLabel ? Story.stonesLabel() : 'Flat stones'), use: async () => { await Story.useStones(); } });
    m.add({ id: 'footprints', kind: 'footprints', x: GLADE[0] - 2, y: GLADE[1] - 1, w: 4, h: 2, layer: 'floor', visible: false, data: {}, range: 1, label: 'Footprints', use: async () => { await Story.gladeFootprints(); } });
    m.add({ id: 'gsnow', kind: 'zone', x: GLADE[0] + 1.2, y: GLADE[1] - 2.4, w: 1.2, h: 1, visible: false, range: 1, label: 'Touch the snow', use: async () => { await Story.gladeTouch(); } });

    m.obj('doug').smart = { spot: [21.1, 16.3], face: [0, -1], dur: [3, 5], lines: ['Morning, Doug!', 'Doug looks taller.', '*hugs Doug*'] };
    m.obj('sign').smart = { spot: [29.7, 24.4], face: [0, -1], dur: [2, 4], lines: ['\u201cSnacks?\u201d Yes. Always.'] };
    m.obj('stones').smart = { spot: [38.9, 34.0], face: [0, 1], dur: [3, 6], lines: ['*pockets a good stone*', 'This one\u2019s mine. Don\u2019t look at it.'] };
    return m;
  },
  setGlade(on) {
    const m = Game.map('woods');
    const g = m.data.GLADE;
    m.circle(g[0], g[1], 3.4, on ? T.SNOW : T.GRASS, (t) => t === T.GRASS || t === T.SNOW || t === T.DGRASS);
    m.obj('footprints').visible = on;
    m.obj('gsnow').visible = on;
  },

  /* =====================================================================
   * THE MEMORY OVERLAP (cycle 1 climax)
   * ===================================================================== */
  memory() {
    const W = 52, H = 46;
    const m = new GameMap('memory', W, H, T.SNOW, { kind: 'outdoor', bg: '#c9d3df', tilesAcross: 19 });
    const r = U.rng(26);
    const MAIN = [[8, 36], [12, 32.5], [16, 29.5], [22, 26.5], [27, 23.5], [31, 18]];
    const WEST = [[31, 18], [22, 13.5], [13, 12]];
    const EAST = [[31, 18], [36, 13], [40, 9]];
    const CLEAR = [41, 7];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        const border = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
        const dp = Math.min(U.polyDist(cx, cy, MAIN), U.polyDist(cx, cy, WEST), U.polyDist(cx, cy, EAST));
        const inCorr = x >= 40 && x <= 47 && y >= 11;
        const corrWall = (x === 39 || x === 48) && y >= 11;
        let t = T.SNOW;
        if (border || corrWall) t = T.STREE;
        else if (!inCorr && dp > 2.2 && Math.hypot(cx - CLEAR[0], cy - CLEAR[1]) > 5 && r() < 0.11) t = T.STREE;
        else if (!inCorr && dp > 3.5 && x > 30 && y > 20 && r() < 0.5) t = T.STREE;
        m.set(x, y, t);
      }
    }
    // Fragments
    m.rect(5, 34, 7, 5, T.WOOD);
    m.rect(17, 27, 7, 4, T.TILEF);
    m.rect(41, 21, 6, 6, T.ICE);
    m.data = { CLEAR };
    m.add({ id: 'mbed', kind: 'bed', x: 6.4, y: 34.2, w: 3, h: 3.3, solid: true, data: { occ: {}, blanket: -1 }, label: 'The bed', use: async () => N('(Your bed. Snow on the pillows. It is still warm on your side.)') });
    m.add({ id: 'mlamp', kind: 'lamp', x: 10.3, y: 34.6, w: 0.6, h: 0.6, solid: true, data: { on: true }, light: { r: 140, i: 0.9, color: '255,190,110', glow: 0.25 }, label: 'Lamp', use: async () => N('(It’s on. There’s no cable.)') });
    m.add({ id: 'mframe1', kind: 'framepost', x: 13.3, y: 31.4, w: 0.8, h: 0.5, solid: true, data: { art: 'lake' }, label: 'Photo', use: async () => UI.photo('lake', 'The lake. Sharper than you remember. You can count every leaf. There is snow on the far bank.') });
    m.add({ id: 'mframe2', kind: 'framepost', x: 15.6, y: 28.9, w: 0.8, h: 0.5, solid: true, data: { art: 'cake' }, label: 'Photo', use: async () => UI.photo('cake', 'The wedding. Under it, in neat handwriting that isn’t either of yours: “Cousin. Third. June.” You never knew that.') });
    m.add({ id: 'mtable', kind: 'table', x: 18.6, y: 28.2, w: 3.2, h: 1.6, solid: true, data: { perfect: true }, label: 'Breakfast', use: async () => Story.memPancakes() });
    m.add({
      id: 'mfire', kind: 'firepit', x: 26.6, y: 21.6, w: 1, h: 1, solid: true, data: { lit: true }, range: 1.1,
      light: { r: 220, i: 0.95, color: '255,150,70', glow: 0.35, flicker: true },
      label: 'Campfire', use: async () => Story.memFire(),
    });
    m.add({ id: 'mlog', kind: 'log', x: 25.4, y: 22.9, w: 2.8, h: 0.5, solid: true, data: { worn: true }, label: null });
    const pages = [
      ['page1', 12, 34, 'Your seventh birthday. You both forgot it until dinner. Cake at eleven at night. (You don’t remember this. It feels true anyway.)'],
      ['page2', 23.6, 25.6, 'A rainy afternoon. You fell asleep on the floor halfway through a film, both of you, and woke up holding hands. (You don’t remember this either. Somebody does.)'],
      ['page3', 29.5, 20.6, 'An argument about a lamp. Resolved. Forgotten. Kept anyway.'],
    ];
    for (const [id, x, y, text] of pages) m.add({ id, kind: 'page', x, y, w: 0.6, h: 0.6, layer: 'floor', data: { rot: x * 0.3 }, label: 'Scrapbook page', range: 0.8, use: async () => N('(' + text.replace(/^\(|\)$/g, '') + ')') });
    m.add({ id: 'msign', kind: 'sign', x: 31.6, y: 19.2, w: 0.6, h: 0.5, solid: true, label: 'Signpost', use: async () => N('(← HOME.  → —  The right-hand arrow has been scratched blank.)') });
    m.add({
      id: 'phouse', kind: 'perfecthouse', x: 8, y: 6.5, w: 10, h: 5, solid: true, data: { open: false },
      light: { r: 260, i: 0.9, color: '255,200,130', glow: 0.25 },
    });
    m.add({ id: 'pdoor', kind: 'zone', x: 12.4, y: 11.1, w: 1.2, h: 0.5, range: 1.1, label: 'The warm house', use: async () => Story.perfectDoor() });
    m.add({ id: 'oldtree', kind: 'bigtree', x: 40.5, y: 4.4, w: 1, h: 1, solid: true, data: { snowy: true }, label: null });
    // Escape corridor
    m.add({ id: 'biglog', kind: 'biglog', x: 40, y: 15.6, w: 8, h: 0.9, solid: true, range: 1.2, label: () => (Story.logBoostLabel ? Story.logBoostLabel() : null), use: async () => Story.boostLog() });
    m.add({ id: 'exitdoor', kind: 'doorframe', x: 43.4, y: 39.4, w: 1.2, h: 0.8, solid: true, range: 1.2, data: { open: false }, light: { r: 200, i: 0.9, color: '255,214,150', glow: 0.3 }, label: 'The door home', use: async () => Story.exitDoor() });
    return m;
  },
  setWalls(open) {
    const m = Game.map('memory');
    for (let y = 30; y <= 34; y++) for (let x = 40; x <= 47; x++) m.set(x, y, open ? T.SNOW : ((x + y) % 3 === 0 || y === 32 ? T.SNOWWALL : T.SNOW));
    if (!open) for (let x = 40; x <= 47; x++) m.set(x, 32, T.SNOWWALL);
  },

  /* =====================================================================
   * ELSEWHERE (Partner's perspective)
   * ===================================================================== */
  memoryB() {
    const m = new GameMap('memoryB', 30, 14, T.SNOW, { kind: 'indoor', bg: '#0f1420', tilesAcross: 15 });
    for (let y = 0; y < 14; y++) for (let x = 0; x < 30; x++) if (x < 1 || y < 1 || x > 28 || y > 12) m.set(x, y, T.STREE);
    m.rect(1, 2, 12, 9, T.WALL);
    m.rect(2, 3, 10, 7, T.TILEF);
    m.set(12, 6, T.TILEF); m.set(12, 7, T.TILEF);
    for (let y = 2; y <= 11; y++) for (let x = 13; x <= 28; x++) if ((y < 4 || y > 9) && U.rng(x * 31 + y)() < 0.6) m.set(x, y, T.STREE);
    m.add({ id: 'bcounter', kind: 'counter', x: 2, y: 3, w: 7, h: 0.95, solid: true, data: { sinkX: 2.2, kettleX: 0.3, stoveX: 4.4 } });
    m.add({ id: 'btable', kind: 'table', x: 5, y: 6.6, w: 2.8, h: 1.4, solid: true, data: {} });
    m.add({ id: 'whistlespot', kind: 'zone', x: 17, y: 5, w: 2, h: 3, visible: false, range: 1.2, label: 'Whistle', use: async () => Story.elsewhereWhistle() });
    return m;
  },

  /* =====================================================================
   * THE WINTER EVENT (prologue, First Snow, real festival)
   * ===================================================================== */
  festival() {
    const W = 46, H = 44;
    const m = new GameMap('festival', W, H, T.SNOW, { kind: 'outdoor', bg: '#1b2238', tilesAcross: 20 });
    const r = U.rng(1);
    const CLEAR = [23, 9.5];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        const border = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
        const fest = y >= 24 && y <= 41 && x >= 4 && x <= 41;
        const path = Math.abs(cx - 23) < 2 && y > 12 && y < 26;
        const dc = Math.hypot(cx - CLEAR[0], cy - CLEAR[1]);
        let t = T.SNOW;
        if (border) t = T.STREE;
        else if (!fest && !path && dc > 5.6 && r() < (y < 24 ? 0.32 : 0.12)) t = T.STREE;
        m.set(x, y, t);
      }
    }
    m.data = { CLEAR };
    m.add({ id: 'oldtree', kind: 'bigtree', x: 22.5, y: 5.6, w: 1, h: 1, solid: true, data: { snowy: true }, label: null });
    m.add({ id: 'fence', kind: 'fence', x: 17.4, y: 12.4, w: 4.2, h: 0.4, visible: false, label: null });
    const stalls = [[7, 27, '#b5483a'], [12.5, 27, '#3f6b5a'], [27.5, 27, '#8a6a9a'], [33, 27, '#d6a548'], [9, 35, '#4f6d9a'], [15, 35, '#c87a4a'], [30, 35, '#6f8f72'], [35.5, 35, '#b5483a']];
    stalls.forEach(([x, y, c], i) => m.add({
      id: 'stall' + i, kind: 'stall', x, y, w: 3.4, h: 2, solid: true, data: { color: c }, range: 1.1,
      light: { r: 160, i: 0.85, color: '255,200,120', glow: 0.22 },
      label: () => (Story.stallLabel ? Story.stallLabel(i) : null), use: async () => Story.useStall(i),
    }));
    for (const [x, y, w] of [[6, 25, 10], [26, 25, 11], [8, 33, 10], [28, 33, 10]]) m.add({ id: 'lan' + x + y, kind: 'lanterns', x, y, w, h: 0.3, layer: 'mid', light: { r: 220, i: 0.6, color: '255,200,120', glow: 0.18 } });
    m.add({ id: 'littree', kind: 'littree', x: 22.5, y: 31.5, w: 1, h: 1, solid: true, light: { r: 200, i: 0.85, color: '255,220,150', glow: 0.25 } });
    return m;
  },
};
