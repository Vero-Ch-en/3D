'use strict';
/* =========================================================================
 * Memories (the title screen): what you've collected across every playthrough, kept in this browser.
 *  - Her, when nobody was looking: the short cutaways (companion.js). Ones you haven't seen show where to look.
 *  - The scrapbook: every page you've ever earned, in the scrapbook viewer.
 *  - Photographs: the last 12 you took, with her captions.
 * Storage can be missing (private windows): everything degrades to "nothing yet".
 * ========================================================================= */
(() => {
const K = { vig: 'snowed.mem.vig', scrap: 'snowed.mem.scrap', photo: 'snowed.mem.photo' };
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

G.remember = (kind, v) => {
  if (kind === 'vig') { const a = read(K.vig, []); const id = v === 'kwin' ? 'lwin' : v; if (!a.includes(id)) { a.push(id); write(K.vig, a); } }
  else if (kind === 'scrap') { const a = read(K.scrap, []); if (!a.some((p) => p.art === v.art)) { a.push({ art: v.art, caption: v.caption }); write(K.scrap, a); } }
  else if (kind === 'photo') {
    const a = read(K.photo, []); a.push({ src: v.src, caption: v.caption, t: Date.now() });
    // Photographs are big: keep the newest that fit (at most 12), dropping the oldest if storage is full.
    while (a.length > 12) a.shift();
    while (a.length && !write(K.photo, a)) a.shift();
  }
  sync();
};

// The cutaways, in the order you're likely to meet them, with a nudge for the ones you haven't.
const VIG_LIST = [
  ['bed', 'Five more minutes', 'The morning, if you get up first.'],
  ['read', 'The same paragraph', 'The armchair, while you’re in another room.'],
  ['radio', 'A dance with no one', 'The kitchen radio, when you’ve left her to it.'],
  ['water', 'What she tells the plants', 'The watering can, while you’re elsewhere.'],
  ['basil', 'A secret for Basil', 'The windowsill herbs.'],
  ['books', 'The bookmark', 'The bookshelf.'],
  ['lwin', 'A heart on the glass', 'A window, while you’re not looking.'],
  ['nap', 'Checking the cushion', 'The sofa, in the evening.'],
  ['stoke', 'Her only job', 'The hearth, when she sees to it herself.'],
];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const $ = (id) => document.getElementById(id);

function count() {
  const v = read(K.vig, []), sc = read(K.scrap, []), ph = read(K.photo, []);
  return { v: VIG_LIST.filter(([id]) => v.includes(id)).length, sc: sc.length, ph: ph.length };
}
function sync() {
  const b = $('memoriesBtn'); if (!b) return;
  const c = count(), n = c.v + c.sc + c.ph;
  b.textContent = n ? 'Memories · ' + n : 'Memories';
}
function render(tab) {
  const v = read(K.vig, []), sc = read(K.scrap, []), ph = read(K.photo, []), c = count();
  const tabs = [['her', 'Her, unobserved', c.v + '/' + VIG_LIST.length], ['book', 'Scrapbook', String(c.sc)], ['photos', 'Photographs', String(c.ph)]];
  let body = '';
  if (tab === 'her') {
    const texts = G.VIGS || {};
    body = '<p class="mem-sub">When you’re in another room and she’s busy with something of her own, now and then you get to see her when she thinks nobody’s watching.</p>'
      + VIG_LIST.map(([id, name, hint]) => {
        const f = v.includes(id), t = texts[id] && texts[id].text;
        return `<div class="ending ${f ? 'found' : 'locked'}"><div class="et"><div class="en">${f ? esc(name) : '· · ·'}</div><div class="eh">${f && t ? esc(G.fmt(t)) : esc(hint)}</div></div></div>`;
      }).join('');
  } else if (tab === 'book') {
    body = sc.length
      ? `<p class="mem-sub">${sc.length} page${sc.length === 1 ? '' : 's'}, from every day you’ve spent here.</p><div class="mem-pages">${sc.map((p) => `<div class="mem-page"><canvas width="220" height="190" data-art="${esc(p.art)}"></canvas><div class="mem-cap">${esc(G.fmt(p.caption))}</div></div>`).join('')}</div>`
      : '<p class="mem-sub">Nothing yet. The scrapbook fills up as you go.</p>';
  } else {
    body = ph.length
      ? `<p class="mem-sub">The last ${ph.length} you took. (Press T in free time, with her in the frame.)</p><div class="mem-pages">${ph.slice().reverse().map((p) => `<div class="mem-page photo"><img alt="" src="${esc(p.src)}"><div class="mem-cap">${esc(G.fmt(p.caption || ''))}</div></div>`).join('')}</div>`
      : '<p class="mem-sub">No photographs yet. In free time, press T (or the camera button) with her in the frame.</p>';
  }
  $('memories').innerHTML = `<div class="pause-panel mem-panel"><h2 id="memTitle">Memories</h2>
    <div class="mem-tabs" role="tablist">${tabs.map(([id, t, n]) => `<button type="button" role="tab" class="${id === tab ? 'on' : ''}" data-tab="${id}" aria-selected="${id === tab}">${t} <span>${n}</span></button>`).join('')}</div>
    <div class="mem-body">${body}</div>
    <div class="row" style="display:flex;justify-content:flex-end"><button class="btn small" id="memClose" type="button">Close</button></div></div>`;
  $('memories').querySelectorAll('canvas[data-art]').forEach((cv) => { try { G.UI.paintSnap(cv, cv.dataset.art); } catch (e) { /* painter not ready */ } });
}
function open(tab = 'her') { render(tab); $('memories').hidden = false; }
function close() { $('memories').hidden = true; $('memories').innerHTML = ''; }
function wire() {
  const b = $('memoriesBtn'), box = $('memories');
  if (!b || !box) return;
  b.addEventListener('click', () => open());
  box.addEventListener('click', (e) => {
    if (e.target === box || e.target.id === 'memClose') return close();
    const t = e.target.closest && e.target.closest('[data-tab]'); if (t) render(t.dataset.tab);
  });
  addEventListener('keydown', (e) => { if (!box.hidden && e.code === 'Escape') close(); });
  sync();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
G.openMemories = open;
})();
