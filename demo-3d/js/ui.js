'use strict';
/* =========================================================================
 * Story UI: choices, title cards, the timing minigame, the Together menu and
 * the scrapbook. Each returns a promise. Keys are read in the capture phase
 * so a key that answers the UI never also walks, interacts or advances.
 * ========================================================================= */
(() => {
const { $ } = G;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let modal = null;   // { kind, key(e) -> handled }

const UI = (G.UI = {
  blocking: () => !!modal,
  get modal() { return modal ? modal.kind : null; },
});

addEventListener('keydown', (e) => {
  if (!modal || e.repeat) return;
  if (G.STATE.paused && modal.kind !== 'scrapbook') return;   // the pause menu has the keys
  if (modal.key(e) !== false) { e.preventDefault(); e.stopPropagation(); }
}, true);

/* A vertical list of options. opts: strings or { t, v }. Resolves to the index (or v). */
UI.choose = (opts) => new Promise((res) => {
  const box = $('choices');
  const list = opts.map((o) => (typeof o === 'string' ? { t: o } : o));
  box.innerHTML = list.map((o, i) => `<button type="button" style="animation-delay:${i * 0.06}s"><span class="n">${i + 1}</span><span>${esc(G.fmt(o.t))}</span></button>`).join('');
  box.hidden = false;
  const btns = [...box.querySelectorAll('button')];
  let sel = 0, opened = performance.now();
  const mark = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
  const pick = (i) => {
    if (performance.now() - opened < 250) return;   // a held key from the last line shouldn't choose
    modal = null; box.hidden = true; box.innerHTML = '';
    G.Audio.chime && G.Audio.click();
    res(list[i].v != null ? list[i].v : i);
  };
  btns.forEach((b, i) => { b.addEventListener('click', () => pick(i)); b.addEventListener('pointerenter', () => { sel = i; mark(); }); });
  mark();
  modal = { kind: 'choices', key(e) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= btns.length) { pick(n - 1); return; }
    if (['ArrowDown', 'KeyS'].includes(e.code)) { sel = (sel + 1) % btns.length; mark(); return; }
    if (['ArrowUp', 'KeyW'].includes(e.code)) { sel = (sel + btns.length - 1) % btns.length; mark(); return; }
    if (['Enter', 'Space', 'KeyE'].includes(e.code)) { pick(sel); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') return;   // swallow: a choice can't be skipped
    return false;
  } };
});

/* Centered lines over the (black or white) fade. o: { cls, hold, white } */
UI.card = (lines, o = {}) => new Promise((res) => {
  const box = $('card');
  box.className = o.white ? 'on-white' : '';
  box.innerHTML = `<div>${lines.map((l, i) => `<p class="${o.cls ? o.cls[i] || '' : ''}" style="animation-delay:${0.2 + i * (o.stagger || 0.6)}s">${esc(G.fmt(l))}</p>`).join('')}</div>`;
  requestAnimationFrame(() => box.classList.add('show'));
  G.wait(o.hold || 3).then(() => { box.classList.remove('show'); G.wait(1.2).then(() => { box.innerHTML = ''; res(); }); });
});
UI.act = (num, title, o = {}) => UI.card(['Act ' + num, title], { cls: ['act-n', 'act-t'], stagger: 0.45, hold: o.hold || 3.4, white: o.white });

/* Timing minigame: stop the marker in the warm zone. Resolves to an array of scores in 0..1. */
UI.timing = (o) => new Promise((res) => {
  const box = $('minigame'), zone = o.zone || [0.6, 0.76], rounds = o.rounds || 3;
  box.innerHTML = `<div class="mg-title">${esc(G.fmt(o.title))}</div><div class="mg-bar"><div class="mg-zone" style="left:${zone[0] * 100}%;width:${(zone[1] - zone[0]) * 100}%"></div><div class="mg-needle"></div></div>
    <div class="mg-sub">${G.MOBILE ? 'Tap when the marker is in the warm zone' : 'Press E or Space when the marker is in the warm zone'}</div><div class="mg-res"></div><div class="mg-dots">${'<i></i>'.repeat(rounds)}</div>`;
  box.hidden = false;
  const needle = box.querySelector('.mg-needle'), resEl = box.querySelector('.mg-res'), dots = box.querySelectorAll('.mg-dots i');
  const scores = []; let t = Math.random() * 0.3, dir = 1, cool = 0.5;
  const speed = (o.speed || 1) * 0.9;
  const press = () => {
    if (cool > 0 || scores.length >= rounds) return;
    const c = (zone[0] + zone[1]) / 2, hw = (zone[1] - zone[0]) / 2, d = Math.abs(t - c);
    const sc = d <= hw ? 1 - 0.3 * (d / hw) : Math.max(0, 0.62 - (d - hw) * 3.2);
    scores.push(sc);
    dots[scores.length - 1].classList.add('done');
    const L = o.labels || ['Miss.', 'Okay.', 'Perfect.'];
    resEl.textContent = G.fmt(sc > 0.75 ? L[2] : sc > 0.35 ? L[1] : L[0]);
    if (o.onPress) o.onPress(sc, scores.length - 1);
    cool = 0.75;
    if (scores.length >= rounds) G.wait(1.1).then(() => { G.TICKERS.delete(tick); modal = null; box.hidden = true; res(scores); });
  };
  // Runs on the game clock, so it pauses with the game.
  const tick = (dt) => {
    cool -= dt;
    if (scores.length >= rounds) return;
    t += dir * dt * speed * (1 + scores.length * 0.18);   // each round runs a touch faster
    if (t > 1) { t = 1; dir = -1; } else if (t < 0) { t = 0; dir = 1; }
    needle.style.left = (t * 100) + '%';
  };
  G.TICKERS.add(tick);
  box.onpointerdown = (e) => { e.preventDefault(); press(); };
  modal = { kind: 'minigame', key(e) {
    if (['Enter', 'Space', 'KeyE'].includes(e.code)) { press(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') return;
    return false;
  } };
});

/* The Together menu: a row of actions. Resolves to an action id, or null if closed. */
UI.together = (acts) => new Promise((res) => {
  const box = $('together');
  box.innerHTML = acts.map((a, i) => `<button type="button" style="animation-delay:${i * 0.04}s"><span class="n">${i + 1}</span>${esc(G.fmt(a.t))}</button>`).join('');
  box.hidden = false;
  const btns = [...box.querySelectorAll('button')];
  let sel = 0;
  const mark = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
  const done = (v) => { modal = null; box.hidden = true; box.innerHTML = ''; res(v); };
  btns.forEach((b, i) => { b.addEventListener('click', () => done(acts[i].id)); b.addEventListener('pointerenter', () => { sel = i; mark(); }); });
  mark();
  // Walking away, or tapping anywhere else, closes it.
  const away = (e) => { if (!box.contains(e.target)) { removeEventListener('pointerdown', away, true); if (modal && modal.kind === 'together') done(null); } };
  setTimeout(() => addEventListener('pointerdown', away, true), 0);
  modal = { kind: 'together', key(e) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= btns.length) { done(acts[n - 1].id); return; }
    if (['ArrowRight', 'KeyD', 'ArrowDown'].includes(e.code)) { sel = (sel + 1) % btns.length; mark(); return; }
    if (['ArrowLeft', 'KeyA', 'ArrowUp'].includes(e.code)) { sel = (sel + btns.length - 1) % btns.length; mark(); return; }
    if (['Enter', 'Space', 'KeyE'].includes(e.code)) { done(acts[sel].id); return; }
    if (['Escape', 'KeyQ', 'KeyW', 'KeyS'].includes(e.code)) { done(null); return; }
    return false;
  } };
});

/* ---------- scrapbook ---------- */
// Little painted snapshots for each page, drawn on a canvas like the polaroids in the cabin.
function paintSnap(cv, art) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const sky = { pancakes: ['#f3d9b0', '#e7b780'], blanket: ['#efe3d0', '#c9b59a'], snowkids: ['#1a2440', '#4a5a86'], tea: ['#e8d8c0', '#b89470'], basil: ['#dfe8d6', '#9db08c'], study: ['#e9dcc8', '#b39a7c'], hug: ['#f0d6c0', '#d39a7a'], default: ['#d8dde6', '#9aa6b8'] }[art] || ['#d8dde6', '#9aa6b8'];
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const fig = (x, y, s, col, hair) => { c.fillStyle = '#e8c0a0'; c.beginPath(); c.arc(x, y - 34 * s, 10 * s, 0, 7); c.fill(); c.fillStyle = hair; c.beginPath(); c.arc(x, y - 37 * s, 10.5 * s, Math.PI, 0); c.fill(); c.fillStyle = col; c.beginPath(); c.roundRect ? c.roundRect(x - 11 * s, y - 24 * s, 22 * s, 30 * s, 6 * s) : c.rect(x - 11 * s, y - 24 * s, 22 * s, 30 * s); c.fill(); };
  if (art === 'pancakes') {
    c.fillStyle = '#f7f2ea'; c.beginPath(); c.ellipse(W / 2, H * 0.68, W * 0.34, H * 0.11, 0, 0, 7); c.fill();
    for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#d49a52' : '#e0ad66'; c.beginPath(); c.ellipse(W / 2, H * 0.64 - i * 9, W * 0.25, H * 0.06, 0, 0, 7); c.fill(); }
    c.fillStyle = '#8a4a1e'; c.beginPath(); c.ellipse(W / 2 + 6, H * 0.6 - 36, W * 0.12, H * 0.03, 0, 0, 7); c.fill();
    c.fillStyle = sky[0]; c.beginPath(); c.arc(W / 2 + W * 0.2, H * 0.6 - 30, 14, 0, 7); c.fill();   // the bite
  } else if (art === 'snowkids') {
    c.fillStyle = '#e8eef6'; c.fillRect(0, H * 0.7, W, H * 0.3);
    for (let i = 0; i < 9; i++) { c.fillStyle = `rgba(255,190,110,${0.35 + (i % 3) * 0.15})`; c.beginPath(); c.arc(16 + i * (W / 9), H * 0.36 + Math.sin(i) * 8, 6, 0, 7); c.fill(); }
    fig(W * 0.4, H * 0.78, 0.8, '#34506e', '#2a1a12'); fig(W * 0.62, H * 0.8, 0.72, '#c08a3e', '#6a4028');
  } else if (art === 'blanket') {
    c.fillStyle = '#8a2a2a'; c.beginPath(); c.ellipse(W * 0.55, H * 0.62, W * 0.42, H * 0.2, -0.1, 0, 7); c.fill();
    c.fillStyle = '#e8c0a0'; c.beginPath(); c.arc(W * 0.3, H * 0.42, 13, 0, 7); c.fill(); c.beginPath(); c.arc(W * 0.7, H * 0.4, 12, 0, 7); c.fill();
  } else {
    fig(W * 0.42, H * 0.86, 1.15, '#4a4d54', '#1e140f'); fig(W * 0.6, H * 0.88, 0.98, '#e4d7c2', '#5e3a26');
  }
  c.fillStyle = 'rgba(255,230,190,0.12)'; c.fillRect(0, 0, W, H);
}
UI.scrapbook = (pages) => new Promise((res) => {
  const box = $('scrap');
  let at = Math.max(0, (pages.length % 2 ? pages.length - 1 : pages.length - 2));
  at -= at % 2;
  const render = () => {
    const page = (p) => (p ? `<div class="scrap-page"><canvas width="220" height="190" data-art="${esc(p.art)}"></canvas><div class="scrap-cap">${esc(G.fmt(p.caption))}</div></div>` : '<div class="scrap-page"><div class="scrap-empty">(Room for more.)</div></div>');
    box.innerHTML = `<div class="scrap-book">${page(pages[at])}${page(pages[at + 1])}<div class="scrap-nav"><button class="btn" data-k="prev" ${at <= 0 ? 'disabled' : ''}>←</button><button class="btn" data-k="close">Close</button><button class="btn" data-k="next" ${at + 2 >= pages.length ? 'disabled' : ''}>→</button></div></div>`;
    box.querySelectorAll('canvas').forEach((cv) => paintSnap(cv, cv.dataset.art));
    box.querySelector('[data-k=prev]').onclick = () => { if (at > 0) { at -= 2; render(); } };
    box.querySelector('[data-k=next]').onclick = () => { if (at + 2 < pages.length) { at += 2; render(); } };
    box.querySelector('[data-k=close]').onclick = close;
  };
  const close = () => { modal = null; box.hidden = true; box.innerHTML = ''; res(); };
  if (!pages.length) pages = [{ art: 'default', caption: 'An empty scrapbook. It’s waiting for today.' }];
  render(); box.hidden = false;
  modal = { kind: 'scrapbook', key(e) {
    if (['ArrowLeft', 'KeyA'].includes(e.code)) { if (at > 0) { at -= 2; render(); } return; }
    if (['ArrowRight', 'KeyD'].includes(e.code)) { if (at + 2 < pages.length) { at += 2; render(); } return; }
    if (['Escape', 'Enter', 'Space', 'KeyE', 'KeyP'].includes(e.code)) { close(); return; }
    return false;
  } };
});
})();
