'use strict';
/* =========================================================================
 * DOM UI: dialogue, choices, cards, fades, prompts, together menu,
 * scrapbook, photo viewer, timing minigame, endings, touch controls.
 * Presentation is neutral: nothing here ever reveals who is real.
 * ========================================================================= */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  el: {},
  dlg: null, ch: null, cardState: null, modal: null, mg: null, tg: null, sb: null,
  lastLine: '', lastWho: null, hideAt: 0, advanceReq: false,
  touch: false,

  init() {
    for (const id of ['dialogue', 'choices', 'card', 'prompt', 'together', 'minigame', 'scrapbook', 'viewer', 'ending', 'hint', 'fade', 'touch']) this.el[id] = document.getElementById(id);
    this.el.who = this.el.dialogue.querySelector('.who');
    this.el.text = this.el.dialogue.querySelector('.text');
    this.el.dialogue.addEventListener('pointerdown', (e) => { e.preventDefault(); this.advanceReq = true; });
    this.el.card.addEventListener('pointerdown', (e) => { e.preventDefault(); this.advanceReq = true; });
    this.el.viewer.addEventListener('pointerdown', (e) => { e.preventDefault(); this.advanceReq = true; });
    this.touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
    if (this.touch) document.body.classList.add('touch');
    this.initTouch();
  },
  blocking() { return !!(this.dlg || this.ch || this.cardState || this.modal); },
  // Blocking UI is serialized so two story threads can never overwrite each other's dialogue.
  _q: Promise.resolve(),
  serial(fn) { const run = this._q.then(fn); this._q = run.catch(() => {}); return run; },
  resetQueue() { this._q = Promise.resolve(); },
  key(a) { return this.touch ? '' : ({ use: 'E', together: 'Q', run: 'Shift' }[a] || a); },

  /* ---------- dialogue ---------- */
  say(who, text, o = {}) {
    return this.serial(() => new Promise((res) => {
      const full = U.fmt(text);
      const e = this.el;
      const cls = who === 'povplayer' ? 'player' : who;
      e.dialogue.className = 'show ' + (cls ? 'who-' + cls : 'narration') + (o.cls ? ' ' + o.cls : '');
      const pov = CFG.playerLabel === 'You' ? CFG.nickForPlayer.charAt(0).toUpperCase() + CFG.nickForPlayer.slice(1) : CFG.playerLabel;
      const name = who === 'player' ? CFG.playerLabel : who === 'partner' ? CFG.partnerLabel : who === 'povplayer' ? pov : (who === 'entity' || !who) ? '' : who;
      e.who.textContent = name;
      e.who.style.display = name ? '' : 'none';
      e.text.textContent = '';
      this.lastLine = full; this.lastWho = who;
      this.dlg = { res, full, shown: 0, done: false, opened: performance.now(), speed: o.speed || 44, who };
    }));
  },
  /* ---------- choices ---------- */
  choose(opts) {
    return this.serial(() => new Promise((res) => {
      const list = opts.map((o, i) => (typeof o === 'string' ? { t: o, v: i } : Object.assign({ v: i }, o)));
      const box = this.el.choices;
      box.innerHTML = '';
      list.forEach((o, i) => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.innerHTML = `<span class="k">${i + 1}</span><span>${esc(U.fmt(o.t))}</span>`;
        b.addEventListener('click', () => this.pick(i));
        b.addEventListener('mouseenter', () => this.hl(i));
        box.appendChild(b);
      });
      box.classList.remove('hidden');
      if (this.lastLine && performance.now() - this.hideAt < 400) {
        const lw = this.lastWho === 'povplayer' ? 'player' : this.lastWho;
        this.el.dialogue.className = 'show context ' + (lw ? 'who-' + lw : 'narration');
        this.el.text.textContent = this.lastLine;
      }
      this.ch = { list, idx: 0, res, opened: performance.now() };
      this.hl(0);
    }));
  },
  hl(i) {
    if (!this.ch) return;
    this.ch.idx = i;
    [...this.el.choices.children].forEach((b, k) => b.classList.toggle('on', k === i));
  },
  pick(i) {
    const c = this.ch;
    if (!c || performance.now() - c.opened < 150) return;
    this.ch = null;
    this.el.choices.classList.add('hidden');
    this.el.dialogue.className = 'hidden';
    Sound.blip();
    c.res(c.list[i].v);
  },

  /* ---------- cards & fades ---------- */
  card(lines, o = {}) {
    return this.serial(() => new Promise((res) => {
      this.el.card.innerHTML = lines.map((l, i) => `<p style="animation-delay:${(o.stagger == null ? 0.9 : o.stagger) * i}s">${esc(U.fmt(l))}</p>`).join('');
      this.el.card.className = 'show' + (o.cls ? ' ' + o.cls : '');
      this.cardState = { res, t: 0, min: o.min == null ? 1 + lines.length * 0.6 : o.min, hold: o.hold || 0 };
    }));
  },
  act(num, title) { return this.card([num, title], { cls: 'act', hold: 3.4, min: 1.4, stagger: 0.35 }); },
  fade(to, dur = 1, color = '#000') {
    const f = this.el.fade;
    f.style.background = color;
    f.style.transition = `opacity ${dur}s ease`;
    void f.offsetWidth;
    f.style.opacity = to;
    return new Promise((r) => setTimeout(r, dur * 1000 + 30));
  },
  setFade(v, color = '#000') { const f = this.el.fade; f.style.transition = 'none'; f.style.background = color; f.style.opacity = v; },
  prompt(html) {
    if (this._prompt === html) return;
    this._prompt = html;
    this.el.prompt.innerHTML = html || '';
    this.el.prompt.classList.toggle('hidden', !html);
  },
  clearHint() { clearTimeout(this._hintT); this.el.hint.classList.remove('show'); },
  hint(text, dur = 6) {
    const h = this.el.hint;
    h.textContent = U.fmt(text);
    h.classList.add('show');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => h.classList.remove('show'), dur * 1000);
  },

  /* ---------- together menu ---------- */
  together(actions) {
    return new Promise((res) => {
      const box = this.el.together;
      box.innerHTML = '';
      actions.forEach((a, i) => {
        const b = document.createElement('button');
        b.innerHTML = `<span class="ic">${a.icon || ''}</span><span>${esc(a.t)}</span><span class="k">${i + 1}</span>`;
        b.addEventListener('click', () => this.tgPick(i));
        b.addEventListener('mouseenter', () => this.tgHl(i));
        box.appendChild(b);
      });
      box.classList.remove('hidden');
      this.modal = 'together';
      this.tg = { actions, idx: 0, res, opened: performance.now() };
      this.tgHl(0);
    });
  },
  tgHl(i) { if (!this.tg) return; this.tg.idx = i; [...this.el.together.children].forEach((b, k) => b.classList.toggle('on', k === i)); },
  tgPick(i) {
    const t = this.tg;
    if (!t) return;
    this.tg = null; this.modal = null;
    this.el.together.classList.add('hidden');
    t.res(i == null ? null : t.actions[i].id);
  },

  /* ---------- scrapbook ---------- */
  scrapbook(pages, o = {}) {
    return this.serial(() => new Promise((res) => {
      this.modal = 'scrap';
      const n = Math.max(2, pages.length + (pages.length % 2));
      this.sb = { pages, spread: Math.max(0, Math.min(o.start == null ? 0 : o.start, Math.ceil(n / 2) - 1)), max: Math.ceil(n / 2) - 1, res, title: o.title || 'Our Scrapbook' };
      this.renderScrap();
      this.el.scrapbook.classList.remove('hidden');
    }));
  },
  renderScrap() {
    const sb = this.sb, box = this.el.scrapbook;
    box.innerHTML = '';
    const book = document.createElement('div'); book.className = 'book';
    for (let k = 0; k < 2; k++) {
      const pg = sb.pages[sb.spread * 2 + k];
      const page = document.createElement('div'); page.className = 'page' + (k ? ' right' : '');
      if (pg) {
        if (pg.art && pg.art !== 'note') {
          const cv = document.createElement('canvas'); cv.width = 260; cv.height = 170; cv.className = 'polaroid';
          cv.style.transform = `rotate(${((sb.spread * 2 + k) * 37 % 7 - 3) * 0.8}deg)`;
          Draw.art(cv.getContext('2d'), pg.art, 260, 170, 0);
          page.appendChild(cv);
        }
        const cap = document.createElement('div'); cap.className = 'cap' + (pg.art === 'note' ? ' note' : '');
        cap.textContent = U.fmt(pg.caption || '');
        page.appendChild(cap);
      } else {
        const cap = document.createElement('div'); cap.className = 'cap blank'; cap.textContent = '';
        page.appendChild(cap);
      }
      book.appendChild(page);
    }
    box.appendChild(book);
    const nav = document.createElement('div'); nav.className = 'nav';
    nav.innerHTML = `<button data-a="prev" ${sb.spread ? '' : 'disabled'}>‹</button><span>${esc(sb.title)} · ${sb.spread + 1}/${sb.max + 1}</span><button data-a="next">${sb.spread < sb.max ? '›' : '✕'}</button>`;
    nav.querySelector('[data-a=prev]').addEventListener('click', () => this.scrapTurn(-1));
    nav.querySelector('[data-a=next]').addEventListener('click', () => this.scrapTurn(1));
    box.appendChild(nav);
  },
  scrapTurn(d) {
    const sb = this.sb;
    if (!sb) return;
    if (d > 0 && sb.spread >= sb.max) { this.closeScrap(); return; }
    sb.spread = U.clamp(sb.spread + d, 0, sb.max);
    Sound.burst(0.12, { type: 'highpass', freq: 3000, vol: 0.05 });
    this.renderScrap();
  },
  closeScrap() { const sb = this.sb; this.sb = null; this.modal = null; this.el.scrapbook.classList.add('hidden'); sb.res(); },

  /* ---------- single photo ---------- */
  photo(art, caption) {
    return this.serial(() => new Promise((res) => {
      const v = this.el.viewer;
      v.innerHTML = '';
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 210; cv.className = 'polaroid big';
      Draw.art(cv.getContext('2d'), art, 320, 210, 0);
      v.appendChild(cv);
      if (caption) { const c = document.createElement('div'); c.className = 'cap'; c.textContent = U.fmt(caption); v.appendChild(c); }
      v.classList.remove('hidden');
      this.modal = 'photo';
      this.pv = { res, opened: performance.now() };
    }));
  },

  /* ---------- timing minigame ---------- */
  timing(o) {
    return this.serial(() => new Promise((res) => {
      const box = this.el.minigame;
      const zone = o.zone || [0.6, 0.76];
      box.innerHTML = `<div class="mg-title">${esc(U.fmt(o.title))}</div><div class="bar"><div class="zone" style="left:${zone[0] * 100}%;width:${(zone[1] - zone[0]) * 100}%"></div><div class="needle"></div></div><div class="mg-sub">${esc(U.fmt(o.sub || (this.touch ? 'Tap Use when the marker is in the warm zone' : 'Press E / Space when the marker is in the warm zone')))}</div><div class="mg-res"></div><div class="dots"></div>`;
      box.classList.remove('hidden');
      this.modal = 'minigame';
      this.mg = { o, zone, t: Math.random(), scores: [], round: 0, res, cool: 0.4, speed: o.speed || 1, needle: box.querySelector('.needle'), resEl: box.querySelector('.mg-res'), dots: box.querySelector('.dots') };
      box.onpointerdown = (e) => { e.preventDefault(); this.advanceReq = true; };
    }));
  },

  /* ---------- ending / message ---------- */
  ending(o) {
    return this.serial(() => new Promise((res) => {
      const box = this.el.ending;
      const msg = (o.message || []).map((l) => `<p>${esc(U.fmt(l))}</p>`).join('');
      box.innerHTML = `<div class="ending-inner ${o.full ? 'full' : ''}">
        ${o.name ? `<div class="ending-name">${esc(o.name)}</div>` : ''}
        ${o.image ? `<div class="ending-image">${esc(U.fmt(o.image))}</div>` : ''}
        <div class="ending-msg"><h2>${esc(U.fmt(o.heading || CFG.birthday.heading))}</h2>${msg}${o.signature ? `<p class="sig">${esc(U.fmt(o.signature))}</p>` : ''}</div>
        <button class="btn">Continue</button></div>`;
      box.classList.remove('hidden');
      requestAnimationFrame(() => { box.classList.add('show'); this.fade(0, 1.2); });
      this.modal = 'ending';
      const done = () => { box.classList.remove('show'); setTimeout(() => box.classList.add('hidden'), 600); this.modal = null; res(); };
      box.querySelector('.btn').addEventListener('click', done);
      this.endState = { done, opened: performance.now() };
    }));
  },

  /* ---------- per-frame ---------- */
  update(dt) {
    const now = performance.now();
    const adv = () => { const a = this.advanceReq || Input.hit('use'); if (a) { Input.consume('use'); this.advanceReq = false; } return a; };
    if (this.modal === 'ending') {
      if (adv() && now - this.endState.opened > 1500) this.endState.done();
      return;
    }
    if (this.modal === 'together' && this.tg) {
      const t = this.tg;
      if (Input.hit('left') || Input.hit('up')) this.tgHl((t.idx + t.actions.length - 1) % t.actions.length);
      if (Input.hit('right') || Input.hit('down')) this.tgHl((t.idx + 1) % t.actions.length);
      for (let i = 0; i < 5; i++) if (Input.hit('n' + (i + 1)) && i < t.actions.length) { this.tgPick(i); return; }
      if (Input.hit('together') || Input.hit('back')) { Input.consume('together'); Input.consume('back'); Input.consume('pause'); this.tgPick(null); return; }
      if (adv() && now - t.opened > 120) this.tgPick(t.idx);
      return;
    }
    if (this.modal === 'scrap' && this.sb) {
      if (Input.hit('left')) this.scrapTurn(-1);
      else if (Input.hit('right') || adv()) this.scrapTurn(1);
      else if (Input.hit('back')) { Input.consume('pause'); Input.consume('back'); this.closeScrap(); }
      return;
    }
    if (this.modal === 'photo') {
      if (adv() && now - this.pv.opened > 300) { this.modal = null; this.el.viewer.classList.add('hidden'); this.pv.res(); }
      return;
    }
    if (this.modal === 'minigame' && this.mg) { this.updateMinigame(dt, adv); return; }
    if (this.cardState) {
      const c = this.cardState;
      c.t += dt;
      const a = adv();
      if (c.t > c.min && (a || (c.hold && c.t > c.hold))) {
        this.cardState = null;
        this.el.card.className = 'hide';
        setTimeout(() => c.res(), 450);
      }
      return;
    }
    if (this.ch) {
      const c = this.ch;
      if (Input.hit('up')) this.hl((c.idx + c.list.length - 1) % c.list.length);
      if (Input.hit('down')) this.hl((c.idx + 1) % c.list.length);
      for (let i = 0; i < 5; i++) if (Input.hit('n' + (i + 1)) && i < c.list.length) { this.pick(i); return; }
      if (adv()) this.pick(c.idx);
      return;
    }
    if (this.dlg) {
      const d = this.dlg;
      if (!d.done) {
        const before = Math.floor(d.shown);
        d.shown += dt * d.speed;
        const n = Math.floor(d.shown);
        if (n !== before && n % 3 === 0 && d.who) Sound.blip();
        if (n >= d.full.length) { d.done = true; d.shown = d.full.length; }
        this.el.text.textContent = d.full.slice(0, Math.floor(d.shown));
      }
      if (adv() && now - d.opened > 140) {
        if (!d.done) { d.done = true; d.shown = d.full.length; this.el.text.textContent = d.full; }
        else { this.dlg = null; this.hideAt = now; d.res(); }
      }
      return;
    }
    if (!this.dlg && this.el.dialogue.className !== 'hidden' && now - this.hideAt > 70 && !this.ch) this.el.dialogue.className = 'hidden';
    this.advanceReq = false;
  },
  updateMinigame(dt, adv) {
    const m = this.mg;
    const sp = m.speed * (0.8 + m.round * 0.18);
    m.t += dt * sp;
    const p = Math.abs(((m.t % 2) + 2) % 2 - 1);
    m.needle.style.left = (p * 100) + '%';
    m.cool -= dt;
    if (m.cool <= 0 && adv()) {
      const [a, b] = m.zone, c = (a + b) / 2, hw = (b - a) / 2;
      const off = Math.abs(p - c);
      const score = off <= hw ? 1 - (off / hw) * 0.3 : Math.max(0, 0.7 - (off - hw) * 3);
      m.scores.push(score);
      const labels = m.o.labels || ['Oops.', 'Not bad.', 'Lovely.'];
      m.resEl.textContent = U.fmt(score > 0.75 ? labels[2] : score > 0.35 ? labels[1] : labels[0]);
      const dot = document.createElement('span'); dot.className = 'dot ' + (score > 0.75 ? 'good' : score > 0.35 ? 'ok' : 'bad'); m.dots.appendChild(dot);
      Sound.tone(score > 0.75 ? 880 : score > 0.35 ? 660 : 330, 0.08, { vol: 0.05 });
      m.round++;
      m.cool = 0.55;
      if (m.round >= (m.o.rounds || 3)) {
        const r = m.res, sc = m.scores;
        this.mg = null;
        setTimeout(() => { this.el.minigame.classList.add('hidden'); this.modal = null; r(sc); }, 700);
      }
    }
  },

  /* ---------- touch ---------- */
  initTouch() {
    const zone = document.getElementById('stickzone'), stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let id = null, ox = 0, oy = 0;
    zone.addEventListener('pointerdown', (e) => {
      id = e.pointerId; ox = e.clientX; oy = e.clientY;
      stick.style.left = (ox - 55) + 'px'; stick.style.top = (oy - 55) + 'px'; stick.classList.add('on');
      zone.setPointerCapture(id);
      Input.stick.active = true; Input.stick.x = 0; Input.stick.y = 0;
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const l = Math.hypot(dx, dy), m = 45;
      if (l > m) { dx = dx / l * m; dy = dy / l * m; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      const k = l < 8 ? 0 : 1;
      Input.stick.x = (dx / m) * k; Input.stick.y = (dy / m) * k;
      Input.vdown[l > m * 0.92 ? 'add' : 'delete']('run');
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; Input.stick.active = false; Input.stick.x = 0; Input.stick.y = 0; Input.vdown.delete('run');
      knob.style.transform = ''; stick.classList.remove('on');
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    for (const [bid, act] of [['btn-use', 'use'], ['btn-together', 'together'], ['btn-pause', 'pause']]) {
      const b = document.getElementById(bid);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Input.press(act); Input.vdown.add(act); });
      b.addEventListener('pointerup', () => Input.vdown.delete(act));
      b.addEventListener('pointerleave', () => Input.vdown.delete(act));
    }
  },
  showTouch(on) { this.el.touch.classList.toggle('hidden', !(on && this.touch)); },
};
