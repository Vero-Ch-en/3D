'use strict';
/* =========================================================================
 * Core: utilities, tiles, maps, collision, pathfinding, input, camera, FX.
 * ========================================================================= */

const TILE = 32;
const CFG = window.CBS_CONFIG;

const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  rand: (a, b) => a + Math.random() * (b - a),
  irand: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  chance: (p) => Math.random() < p,
  smooth: (t) => t * t * (3 - 2 * t),
  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  },
  polyDist(px, py, pts) {
    let best = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
      best = Math.min(best, U.segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    }
    return best;
  },
  // Substitute names / nicknames from config.
  fmt(s) {
    return String(s)
      .replace(/\{giant\}/g, CFG.nickForPlayer)
      .replace(/\{gremlin\}/g, CFG.nickForPartner)
      .replace(/\{P\}/g, CFG.partnerLabel)
      .replace(/\{Y\}/g, CFG.playerLabel);
  },
};

/* ---------------- Tiles ---------------- */
const T = {
  VOID: 0, WALL: 1, WOOD: 2, TILEF: 3, GRASS: 4, PATH: 5, SNOW: 6, WATER: 7,
  TREE: 8, WINDOW: 9, DGRASS: 10, ICE: 11, SNOWWALL: 12, HILL: 13, STREE: 14, STONE: 15,
};
const SOLID_T = new Set([T.VOID, T.WALL, T.WATER, T.TREE, T.WINDOW, T.SNOWWALL, T.STREE]);

function surfaceOf(t) {
  if (t === T.WOOD || t === T.TILEF || t === T.STONE) return 'wood';
  if (t === T.SNOW || t === T.ICE) return 'snow';
  return 'grass';
}

/* ---------------- Map ---------------- */
class GameMap {
  constructor(id, w, h, fill, opts = {}) {
    this.id = id; this.w = w; this.h = h;
    this.t = new Uint8Array(w * h).fill(fill);
    const r = U.rng(U.hash(id));
    this.v = new Float32Array(w * h);
    for (let i = 0; i < this.v.length; i++) this.v[i] = r();
    this.objects = [];
    this.grid = null;
    this.zones = [];
    this.kind = opts.kind || 'indoor';
    this.bg = opts.bg || '#140f0c';
    this.tilesAcross = opts.tilesAcross || (this.kind === 'indoor' ? 17 : 21);
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inb(x, y) ? this.t[y * this.w + x] : T.VOID; }
  set(x, y, v) { if (this.inb(x, y)) { this.t[y * this.w + x] = v; this.grid = null; } }
  rect(x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v); }
  circle(cx, cy, r, v, pred) {
    for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++) {
      for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) {
        if (Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= r && (!pred || pred(this.get(i, j)))) this.set(i, j, v);
      }
    }
  }
  add(o) {
    const obj = Object.assign({
      id: 'o' + this.objects.length, kind: 'box', x: 0, y: 0, w: 1, h: 1,
      solid: false, visible: true, layer: 'mid', label: null, use: null, data: {}, range: 0.9,
    }, o);
    this.objects.push(obj);
    this.grid = null;
    return obj;
  }
  obj(id) { return this.objects.find((o) => o.id === id); }
  remove(id) { this.objects = this.objects.filter((o) => o.id !== id); this.grid = null; }
}

/* ---------------- Collision ---------------- */
function tileSolid(map, tx, ty) { return SOLID_T.has(map.get(tx, ty)); }
function objSolidAt(map, px, py) {
  for (const o of map.objects) {
    if (!o.solid || !o.visible) continue;
    const x0 = o.x * TILE, y0 = o.y * TILE;
    if (px >= x0 && px < x0 + o.w * TILE && py >= y0 && py < y0 + o.h * TILE) return true;
  }
  return false;
}
function solidAt(map, px, py) {
  return tileSolid(map, Math.floor(px / TILE), Math.floor(py / TILE)) || objSolidAt(map, px, py);
}
// Characters collide with a small footprint around their feet.
function canStand(map, x, y, r) {
  const k = r * 0.85;
  return !(solidAt(map, x, y) || solidAt(map, x - k, y) || solidAt(map, x + k, y) ||
    solidAt(map, x, y - k * 0.55) || solidAt(map, x, y + k * 0.35));
}
function moveChar(map, c, dx, dy) {
  let moved = false;
  if (dx && canStand(map, c.x + dx, c.y, c.r)) { c.x += dx; moved = true; }
  if (dy && canStand(map, c.x, c.y + dy, c.r)) { c.y += dy; moved = true; }
  return moved;
}
function rectDist(px, py, o) {
  const x0 = o.x * TILE, y0 = o.y * TILE, x1 = x0 + o.w * TILE, y1 = y0 + o.h * TILE;
  const dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy) / TILE;
}

/* ---------------- Pathfinding (BFS on tile grid) ---------------- */
function walkGrid(map) {
  if (map.grid) return map.grid;
  const g = new Uint8Array(map.w * map.h);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      g[y * map.w + x] = canStand(map, (x + 0.5) * TILE, (y + 0.5) * TILE, 7) ? 1 : 0;
    }
  }
  map.grid = g;
  return g;
}
function nearestWalkable(map, tx, ty) {
  const g = walkGrid(map);
  for (let r = 0; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx, y = ty + dy;
        if (map.inb(x, y) && g[y * map.w + x]) return [x, y];
      }
    }
  }
  return null;
}
function findPath(map, sx, sy, gx, gy) {
  const g = walkGrid(map);
  const W = map.w;
  let s = [Math.floor(sx / TILE), Math.floor(sy / TILE)];
  let e = [Math.floor(gx / TILE), Math.floor(gy / TILE)];
  if (!map.inb(s[0], s[1]) || !g[s[1] * W + s[0]]) s = nearestWalkable(map, s[0], s[1]) || s;
  const exact = map.inb(e[0], e[1]) && g[e[1] * W + e[0]] && canStand(map, gx, gy, 7);
  if (!map.inb(e[0], e[1]) || !g[e[1] * W + e[0]]) { e = nearestWalkable(map, e[0], e[1]); if (!e) return null; }
  const start = s[1] * W + s[0], goal = e[1] * W + e[0];
  if (start === goal) return [{ x: exact ? gx : (e[0] + 0.5) * TILE, y: exact ? gy : (e[1] + 0.5) * TILE }];
  const prev = new Int32Array(map.w * map.h).fill(-1);
  prev[start] = start;
  const q = [start];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false;
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi];
    if (cur === goal) { found = true; break; }
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (!map.inb(nx, ny)) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -1 || !g[ni]) continue;
      if (dx && dy && (!g[cy * W + nx] || !g[ny * W + cx])) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (!found) return null;
  const pts = [];
  for (let c = goal; c !== start; c = prev[c]) pts.push({ x: (c % W + 0.5) * TILE, y: (((c / W) | 0) + 0.5) * TILE });
  pts.reverse();
  if (exact) pts[pts.length - 1] = { x: gx, y: gy };
  return pts;
}

/* ---------------- Characters ---------------- */
const LOOKS = {
  player: { body: '#5b7fa6', body2: '#46678c', hair: '#3a2a22', skin: '#e6b48f', legs: '#3b3f4f', scale: 1.22, hairStyle: 'short' },
  partner: { body: '#e2a64a', body2: '#c48a31', hair: '#2b1d17', skin: '#d49a74', legs: '#4a3b52', scale: 0.95, hairStyle: 'messy' },
  kidPlayer: { body: '#6d7684', body2: '#5a6270', hair: '#3a2a22', skin: '#e6b48f', legs: '#3b3f4f', scale: 0.62, hairStyle: 'short', scarf: '#9a9aa2' },
  kidPartner: { body: '#8a7f73', body2: '#756b60', hair: '#2b1d17', skin: '#d49a74', legs: '#4a3b52', scale: 0.55, hairStyle: 'messy', scarf: '#a8a29a' },
  entity: { body: '#dfe9f5', body2: '#c9d6e6', hair: '#eef4fb', skin: '#f4f8fc', legs: '#d5e0ee', scale: 1.05, hairStyle: 'none' },
};
function crowdLook(r) {
  const bodies = ['#7a5c8f', '#5f8a7a', '#a4553f', '#4f6d9a', '#8d7a4a', '#6a4f45', '#3f6b5a', '#9a6b7b'];
  const hairs = ['#2a1d17', '#5a3b22', '#b08a52', '#1d1d24', '#7a4a2a', '#c9c2b5'];
  const skins = ['#e6b48f', '#c58c63', '#8d5b3d', '#f0c9a5', '#a8714d'];
  const b = bodies[Math.floor(r() * bodies.length)];
  return { body: b, body2: b, hair: hairs[Math.floor(r() * hairs.length)], skin: skins[Math.floor(r() * skins.length)], legs: '#2f3340', scale: 0.8 + r() * 0.45, hairStyle: r() < 0.5 ? 'short' : 'messy', hat: r() < 0.35 ? bodies[Math.floor(r() * bodies.length)] : null };
}

function makeChar(id, look, o = {}) {
  const L = typeof look === 'string' ? LOOKS[look] : look;
  return Object.assign({
    id, look: L, lookId: typeof look === 'string' ? look : 'custom',
    x: 0, y: 0, r: 9, scale: L.scale, speed: 92, dx: 0, dy: 1,
    moving: false, running: false, walkT: 0, pose: 'stand', visible: true, alpha: 1,
    path: null, onArrive: null, pathSpeed: 0, bubble: null, mood: 'neutral',
    fidget: 0, fidgetKind: null, fidgetT: U.rand(2, 5), blinkT: U.rand(1, 4),
    holding: false, hugT: 0, tapT: 0, sway: 0, scarf: !!L.scarf, sitLift: 0,
  }, o);
}
function faceToward(c, x, y) {
  const dx = x - c.x, dy = y - c.y, l = Math.hypot(dx, dy) || 1;
  c.dx = dx / l; c.dy = dy / l;
}
function bark(c, text, dur) {
  if (!c) return;
  const t = U.fmt(text);
  c.bubble = { text: t, t: dur || Math.max(2.2, 1.2 + t.length * 0.055), age: 0 };
}

/* ---------------- Input ---------------- */
const Input = {
  keys: new Set(), pressedKeys: new Set(), vdown: new Set(), vpressed: new Set(),
  stick: { x: 0, y: 0, active: false },
  binds: {
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    run: ['ShiftLeft', 'ShiftRight'], use: ['KeyE', 'Space', 'Enter', 'NumpadEnter'],
    together: ['KeyQ', 'KeyF'], pause: ['Escape', 'KeyP'], mute: ['KeyM'], back: ['Escape', 'Backspace'],
    n1: ['Digit1', 'Numpad1'], n2: ['Digit2', 'Numpad2'], n3: ['Digit3', 'Numpad3'], n4: ['Digit4', 'Numpad4'], n5: ['Digit5', 'Numpad5'],
  },
  lastDevice: 'keyboard',
  init() {
    const block = new Set(['Space', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
    addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
      if (!this._audio) { this._audio = true; Sound.init(); }
      Sound.resume();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.vdown.clear(); });
    addEventListener('pointerdown', () => { Sound.init(); Sound.resume(); });
  },
  down(a) { return this.binds[a].some((k) => this.keys.has(k)) || this.vdown.has(a); },
  hit(a) { return this.binds[a].some((k) => this.pressedKeys.has(k)) || this.vpressed.has(a); },
  consume(a) { for (const k of this.binds[a]) this.pressedKeys.delete(k); this.vpressed.delete(a); },
  press(a) { this.vpressed.add(a); },
  axis() {
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    let y = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
    if (this.stick.active) { x = this.stick.x; y = this.stick.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  },
  endFrame() { this.pressedKeys.clear(); this.vpressed.clear(); },
};

/* ---------------- Camera ---------------- */
const Cam = { x: 0, y: 0, zoom: 2, target: null, shake: 0 };

/* ---------------- World-space particles ---------------- */
const FX = {
  list: [],
  add(p) { this.list.push(Object.assign({ vx: 0, vy: 0, life: 1, age: 0, size: 3, color: '#fff', kind: 'dot', grav: 0 }, p)); },
  heart(x, y) { for (let i = 0; i < 3; i++) this.add({ kind: 'heart', x: x + U.rand(-8, 8), y: y + U.rand(-6, 2), vy: -U.rand(14, 26), vx: U.rand(-6, 6), life: U.rand(1.1, 1.7), size: U.rand(3, 4.5), color: '#e86a7a' }); },
  ember(x, y) { this.add({ x: x + U.rand(-6, 6), y, vy: -U.rand(18, 40), vx: U.rand(-8, 8), life: U.rand(0.6, 1.3), size: U.rand(1, 2.2), color: U.pick(['#ffcf6a', '#ff9a3c', '#ffe7a8']) }); },
  sparkle(x, y, color) { for (let i = 0; i < 6; i++) this.add({ x, y, vx: U.rand(-30, 30), vy: U.rand(-40, -5), life: U.rand(0.4, 0.8), size: U.rand(1, 2), color: color || '#fff6d0', grav: 60 }); },
  snowpuff(x, y) { for (let i = 0; i < 5; i++) this.add({ x: x + U.rand(-4, 4), y, vx: U.rand(-14, 14), vy: U.rand(-10, -2), life: U.rand(0.3, 0.6), size: U.rand(1, 2), color: '#ffffff', grav: 30 }); },
  update(dt) {
    for (const p of this.list) { p.age += dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.list = this.list.filter((p) => p.age < p.life);
  },
  draw(ctx) {
    for (const p of this.list) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      if (p.kind === 'heart') {
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + s * 0.9);
        ctx.bezierCurveTo(p.x - s * 1.6, p.y - s * 0.2, p.x - s * 0.5, p.y - s * 1.4, p.x, p.y - s * 0.4);
        ctx.bezierCurveTo(p.x + s * 0.5, p.y - s * 1.4, p.x + s * 1.6, p.y - s * 0.2, p.x, p.y + s * 0.9);
        ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
};
