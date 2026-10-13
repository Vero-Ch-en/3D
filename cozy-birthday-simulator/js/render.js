'use strict';
/* =========================================================================
 * Renderer: tiles, y-sorted objects & characters, lighting, weather, grading.
 * ========================================================================= */

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, c) { ctx.fillStyle = c; rr(ctx, x, y, w, h, r); ctx.fill(); }
function ell(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fill(); }
function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); ctx.fill(); }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = U.clamp(Math.round(r + amt), 0, 255); g = U.clamp(Math.round(g + amt), 0, 255); b = U.clamp(Math.round(b + amt), 0, 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const R = {
  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.lc = document.createElement('canvas');
    this.lctx = this.lc.getContext('2d');
    this.flakes = [];
    for (let i = 0; i < 320; i++) this.flakes.push({ x: Math.random(), y: Math.random(), z: U.rand(0.3, 1), p: Math.random() * 6.28 });
    addEventListener('resize', () => this.resize());
    this.resize();
  },
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr; this.W = innerWidth; this.H = innerHeight;
    for (const c of [this.cv, this.lc]) { c.width = Math.round(this.W * dpr); c.height = Math.round(this.H * dpr); }
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    const v = document.createElement('canvas'); v.width = this.cv.width; v.height = this.cv.height;
    const x = v.getContext('2d');
    const gr = x.createRadialGradient(v.width / 2, v.height / 2, Math.min(v.width, v.height) * 0.33, v.width / 2, v.height / 2, Math.max(v.width, v.height) * 0.78);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,4,0.6)');
    x.fillStyle = gr; x.fillRect(0, 0, v.width, v.height);
    this.vig = v;
  },
  toScreen(x, y) { return [(x - Cam.x) * Cam.zoom + this.W / 2, (y - Cam.y) * Cam.zoom + this.H / 2]; },

  frame(time, dt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (S.mode === 'title') {
      const v = Game.titleVariant();
      Draw.titleScene(ctx, W, H, time, v);
      if (v === 'firstsnow') this.snow(dt, 0.6, 0.3, true);
      ctx.drawImage(this.vig, 0, 0, W, H);
      return;
    }
    const map = S.map;
    ctx.fillStyle = map ? map.bg : '#000';
    ctx.fillRect(0, 0, W, H);
    if (!map) return;
    const z = Cam.zoom;
    const shx = Cam.shake ? U.rand(-1, 1) * Cam.shake : 0, shy = Cam.shake ? U.rand(-1, 1) * Cam.shake : 0;
    ctx.save();
    ctx.translate(W / 2 + shx, H / 2 + shy);
    ctx.scale(z, z);
    ctx.translate(-Cam.x, -Cam.y);
    const hw = W / 2 / z, hh = H / 2 / z;
    const tx0 = Math.max(0, Math.floor((Cam.x - hw) / TILE) - 1), tx1 = Math.min(map.w - 1, Math.ceil((Cam.x + hw) / TILE) + 1);
    const ty0 = Math.max(0, Math.floor((Cam.y - hh) / TILE) - 1), ty1 = Math.min(map.h - 1, Math.ceil((Cam.y + hh) / TILE) + 2);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) this.tile(ctx, map, tx, ty, time);

    const inView = (o) => (o.x + o.w) * TILE > Cam.x - hw - 64 && o.x * TILE < Cam.x + hw + 64 && (o.y + o.h) * TILE > Cam.y - hh - 96 && o.y * TILE < Cam.y + hh + 96;
    for (const o of map.objects) if (o.visible && o.layer === 'floor' && inView(o)) Draw.obj(ctx, o, time);
    for (const o of map.objects) if (o.visible && o.layer === 'wall' && inView(o)) Draw.obj(ctx, o, time);

    const list = [];
    for (const o of map.objects) {
      if (!o.visible || o.layer !== 'mid' || !inView(o)) continue;
      list.push({ y: (o.y + o.h) * TILE + (o.sortOff || 0), o });
    }
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = map.get(tx, ty);
        if (t === T.TREE || t === T.STREE) list.push({ y: (ty + 1) * TILE - 3, tree: [tx, ty, t] });
      }
    }
    for (const c of Game.chars()) if (c.visible && c.pose !== 'lie') list.push({ y: c.y + (c.pose === 'sit' ? (c.sitSort || 0) : 0), c });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.o) Draw.obj(ctx, it.o, time);
      else if (it.tree) this.tree(ctx, map, it.tree[0], it.tree[1], it.tree[2], time);
      else this.char(ctx, it.c, time);
    }
    for (const o of map.objects) if (o.visible && o.layer === 'over' && inView(o)) Draw.obj(ctx, o, time);
    FX.draw(ctx);
    ctx.restore();

    this.lighting(time);
    this.grade();
    if (S.env.snow > 0.01 && (map.kind !== 'indoor' || S.env.snowIndoor)) this.snow(dt, S.env.snow, S.env.snowWind || 0.3, false);
    ctx.drawImage(this.vig, 0, 0, W, H);
    this.bubbles(time);
  },

  /* ---------- tiles ---------- */
  tile(ctx, map, tx, ty, time) {
    const t = map.get(tx, ty), v = map.v[ty * map.w + tx], x = tx * TILE, y = ty * TILE;
    switch (t) {
      case T.WOOD: {
        ctx.fillStyle = v < 0.5 ? '#c08a56' : '#b98250'; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(80,45,20,0.18)';
        for (let i = 0; i < 4; i++) ctx.fillRect(x, y + i * 8 + 7, TILE, 1);
        ctx.fillStyle = 'rgba(80,45,20,0.12)';
        ctx.fillRect(x + ((ty * 7 + tx * 13) % 4) * 8, y, 1, TILE);
        break;
      }
      case T.TILEF: {
        const c = (tx + ty) % 2 === 0;
        ctx.fillStyle = c ? '#e6ddcb' : '#d6ccb7'; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(120,100,80,0.12)'; ctx.fillRect(x, y, TILE, 1); ctx.fillRect(x, y, 1, TILE);
        break;
      }
      case T.STONE: ctx.fillStyle = v < 0.5 ? '#a9a398' : '#9e988c'; ctx.fillRect(x, y, TILE, TILE); break;
      case T.WALL: case T.WINDOW: this.wallTile(ctx, map, tx, ty, t, time); break;
      case T.GRASS: case T.TREE: case T.HILL: case T.DGRASS: {
        const base = t === T.HILL ? '#8fbb68' : (t === T.DGRASS || t === T.TREE) ? '#6a9450' : '#7ba95b';
        ctx.fillStyle = shade(base, (v - 0.5) * 14); ctx.fillRect(x, y, TILE, TILE);
        if (v > 0.6) { ctx.fillStyle = 'rgba(40,80,30,0.35)'; ctx.fillRect(x + v * 20, y + (1 - v) * 24, 2, 4); ctx.fillRect(x + v * 9 + 4, y + v * 14, 2, 3); }
        if (v < 0.08) { circ(ctx, x + 10 + v * 80, y + 12, 1.6, '#f4f0d0'); }
        break;
      }
      case T.PATH: {
        ctx.fillStyle = shade('#c9a978', (v - 0.5) * 12); ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(110,80,50,0.25)';
        ctx.fillRect(x + v * 26, y + (1 - v) * 26, 3, 2); ctx.fillRect(x + (1 - v) * 20 + 3, y + v * 20 + 5, 2, 2);
        break;
      }
      case T.SNOW: case T.STREE: {
        ctx.fillStyle = shade('#eef3f8', (v - 0.5) * 8); ctx.fillRect(x, y, TILE, TILE);
        if (v > 0.7) { ctx.fillStyle = 'rgba(150,175,210,0.25)'; ctx.fillRect(x + v * 18, y + 10, 6, 2); }
        break;
      }
      case T.ICE: {
        ctx.fillStyle = '#cfe4f0'; ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + v * 10, y + 4); ctx.lineTo(x + 20 + v * 8, y + 26); ctx.stroke();
        break;
      }
      case T.SNOWWALL: {
        ctx.fillStyle = '#e4ecf4'; ctx.fillRect(x, y, TILE, TILE);
        fillRR(ctx, x + 1, y - 6, TILE - 2, TILE + 2, 10, '#f7fafd');
        ctx.fillStyle = 'rgba(140,170,210,0.35)'; ctx.fillRect(x + 2, y + TILE - 8, TILE - 4, 6);
        break;
      }
      case T.WATER: {
        ctx.fillStyle = '#5b97bd'; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        const o = Math.sin(time * 1.6 + tx * 0.9 + ty * 0.5) * 6;
        ctx.fillRect(x + 6 + o, y + 10, 10, 1.5); ctx.fillRect(x + 14 - o, y + 22, 8, 1.5);
        break;
      }
      default: ctx.fillStyle = map.bg; ctx.fillRect(x, y, TILE, TILE);
    }
  },
  wallTile(ctx, map, tx, ty, t, time) {
    const x = tx * TILE, y = ty * TILE;
    const below = map.get(tx, ty + 1);
    const front = below !== T.WALL && below !== T.WINDOW && below !== T.VOID;
    ctx.fillStyle = '#3b2a24'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#4a352d'; ctx.fillRect(x, y, TILE, 3);
    if (front) {
      ctx.fillStyle = '#7d5c4a'; ctx.fillRect(x, y + 12, TILE, TILE - 12);
      ctx.fillStyle = '#6a4d3e'; ctx.fillRect(x, y + TILE - 4, TILE, 4);
      ctx.fillStyle = 'rgba(255,240,220,0.06)';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + i * 11 + 3, y + 12, 1, TILE - 16);
    }
    if (t === T.WINDOW) {
      const night = S.env.dark > 0.45;
      const snowy = S.flags.windowSnow;
      const gx = front ? x + 5 : x + 8, gy = front ? y + 13 : y + 6, gw = front ? TILE - 10 : TILE - 16, gh = front ? TILE - 20 : TILE - 12;
      ctx.fillStyle = '#e8dcc4'; ctx.fillRect(gx - 2, gy - 2, gw + 4, gh + 4);
      ctx.fillStyle = night ? '#1d2a44' : (S.env.warm > 0.7 && S.env.dark > 0.08 ? '#f2c48e' : '#bfe0f2');
      ctx.fillRect(gx, gy, gw, gh);
      if (snowy) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 5; i++) { const fy = (time * 8 + i * 7 + tx * 3) % gh; ctx.fillRect(gx + ((i * 9 + tx * 5) % gw), gy + fy, 1.5, 1.5); }
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(gx, gy + gh - 2, gw, 2);
      }
      ctx.fillStyle = '#e8dcc4'; ctx.fillRect(gx + gw / 2 - 0.5, gy, 1, gh);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(gx + 2, gy + 2, 3, gh - 4);
    }
  },
  tree(ctx, map, tx, ty, t, time) {
    const v = map.v[ty * map.w + tx];
    const cx = tx * TILE + 16 + (v - 0.5) * 8, by = ty * TILE + 28;
    const sz = 0.85 + v * 0.45;
    ell(ctx, cx, by, 14 * sz, 5 * sz, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = '#6b4a32'; ctx.fillRect(cx - 3, by - 14 * sz, 6, 14 * sz);
    const sway = Math.sin(time * 0.9 + tx) * 1.2;
    if (t === T.STREE) {
      circ(ctx, cx + sway, by - 26 * sz, 16 * sz, '#3e5e52');
      circ(ctx, cx - 7 * sz + sway, by - 18 * sz, 11 * sz, '#36564a');
      circ(ctx, cx + 8 * sz + sway, by - 19 * sz, 11 * sz, '#3a5a4e');
      ell(ctx, cx + sway - 2, by - 34 * sz, 12 * sz, 6 * sz, '#f4f8fc');
      ell(ctx, cx + 8 * sz + sway, by - 24 * sz, 6 * sz, 3 * sz, '#eef4fa');
    } else {
      const dark = map.get(tx, ty) === T.TREE && v > 0.5 ? '#3d7240' : '#477d44';
      circ(ctx, cx + sway, by - 26 * sz, 17 * sz, dark);
      circ(ctx, cx - 8 * sz + sway, by - 18 * sz, 11 * sz, '#3f7340');
      circ(ctx, cx + 9 * sz + sway, by - 19 * sz, 12 * sz, '#43783f');
      circ(ctx, cx - 4 * sz + sway, by - 31 * sz, 8 * sz, 'rgba(160,210,120,0.35)');
      if (S.env.snowGround > 0.01) ell(ctx, cx + sway - 2, by - 36 * sz, 11 * sz * S.env.snowGround, 5 * sz * S.env.snowGround, '#f4f8fc');
    }
  },

  /* ---------- characters ---------- */
  char(ctx, c, time) {
    const L = c.look, s = c.scale;
    ctx.save();
    ctx.globalAlpha = c.alpha;
    ctx.translate(c.x, c.y);
    if (c.lookId === 'entity') { this.entity(ctx, c, time); ctx.restore(); return; }
    const sit = c.pose === 'sit';
    const bob = c.moving ? Math.abs(Math.sin(c.walkT * (c.running ? 14 : 10))) * 1.6 * s : Math.sin(time * 2 + c.x) * 0.35;
    const sway = c.sway + (c.fidgetKind === 'sway' ? Math.sin(c.fidget * Math.PI * 2) * 0.07 : 0);
    ell(ctx, 0, 1, 10 * s, 4 * s, 'rgba(0,0,0,0.22)');
    if (c.jump) ctx.translate(0, -c.jump);
    if (sit) ctx.translate(0, -c.sitLift);
    ctx.rotate(sway);
    const facing = Math.abs(c.dy) >= Math.abs(c.dx) ? (c.dy > 0 ? 'down' : 'up') : (c.dx > 0 ? 'right' : 'left');
    const bodyH = (sit ? 11 : 15) * s, bodyW = 14 * s;
    const by = -bodyH - (sit ? 3 * s : 6 * s) - bob;
    if (!sit) {
      const sw = c.moving ? Math.sin(c.walkT * (c.running ? 14 : 10)) * 2.6 * s : 0;
      fillRR(ctx, -5 * s, -8 * s - sw * 0.3, 4 * s, 8 * s + sw * 0.3, 1.5 * s, L.legs);
      fillRR(ctx, 1 * s, -8 * s + sw * 0.3, 4 * s, 8 * s - sw * 0.3, 1.5 * s, L.legs);
    } else {
      fillRR(ctx, -6 * s, -5 * s, 12 * s, 5 * s, 2 * s, L.legs);
    }
    fillRR(ctx, -bodyW / 2, by, bodyW, bodyH + 2 * s, 5 * s, L.body);
    ctx.fillStyle = L.body2; ctx.fillRect(-bodyW / 2 + 2 * s, by + bodyH - 2 * s, bodyW - 4 * s, 2 * s);
    // Arms
    const armSwing = c.moving ? Math.sin(c.walkT * (c.running ? 14 : 10)) * 2 * s : 0;
    if (c.holding && c.holdSide) {
      const hx = c.holdSide * bodyW * 0.62;
      ell(ctx, hx, by + bodyH * 0.6, 2.6 * s, 2.6 * s, L.skin);
      ell(ctx, -c.holdSide * (bodyW / 2 + 1 * s), by + bodyH * 0.45 + armSwing, 2.6 * s, 4.5 * s, L.body2);
    } else if (c.hugT > 0) {
      ell(ctx, -bodyW / 2 - 1, by + bodyH * 0.35, 2.8 * s, 4.5 * s, L.body2);
      ell(ctx, bodyW / 2 + 1, by + bodyH * 0.35, 2.8 * s, 4.5 * s, L.body2);
    } else {
      ell(ctx, -bodyW / 2 - 1 * s, by + bodyH * 0.45 + armSwing, 2.6 * s, 4.6 * s, L.body2);
      ell(ctx, bodyW / 2 + 1 * s, by + bodyH * 0.45 - armSwing, 2.6 * s, 4.6 * s, L.body2);
    }
    if (c.scarf || L.scarf) { fillRR(ctx, -bodyW / 2 + 1, by - 1 * s, bodyW - 2, 4 * s, 2 * s, L.scarf || '#b5483a'); if (facing !== 'up') ctx.fillRect(bodyW / 2 - 5 * s, by + 2 * s, 3 * s, 6 * s); }
    // Head
    const hr = 7.6 * s, hy = by - hr * 0.8;
    circ(ctx, 0, hy, hr, L.skin);
    this.hair(ctx, L, facing, hr, hy, s, time, c);
    if (L.hat) { ell(ctx, 0, hy - hr * 0.55, hr * 1.02, hr * 0.62, L.hat); }
    // Face
    if (facing !== 'up') {
      const ox = facing === 'left' ? -3 * s : facing === 'right' ? 3 * s : 0;
      const blink = c.blinkT < 0.12 || c.mood === 'sleepy';
      ctx.fillStyle = '#2a1c18';
      const ey = hy + 1 * s;
      if (c.mood === 'happy') {
        ctx.strokeStyle = '#2a1c18'; ctx.lineWidth = 1.1 * s;
        for (const ex of facing === 'down' ? [-2.8, 2.8] : [ox > 0 ? 1.5 : -1.5]) { ctx.beginPath(); ctx.arc(ex * s + (facing === 'down' ? 0 : ox), ey + 0.6 * s, 1.4 * s, Math.PI, 0); ctx.stroke(); }
      } else if (blink) {
        for (const ex of facing === 'down' ? [-2.8, 2.8] : [ox > 0 ? 1.5 : -1.5]) ctx.fillRect(ex * s + (facing === 'down' ? 0 : ox) - 1.4 * s, ey, 2.8 * s, 0.9 * s);
      } else {
        const er = c.mood === 'scared' ? 1.35 * s : 1.05 * s;
        for (const ex of facing === 'down' ? [-2.8, 2.8] : [ox > 0 ? 1.5 : -1.5]) circ(ctx, ex * s + (facing === 'down' ? 0 : ox), ey, er, '#2a1c18');
      }
      if (facing === 'down') {
        ctx.fillStyle = 'rgba(230,120,110,0.35)';
        ctx.beginPath(); ctx.arc(-4.4 * s, hy + 3.4 * s, 1.5 * s, 0, 7); ctx.arc(4.4 * s, hy + 3.4 * s, 1.5 * s, 0, 7); ctx.fill();
      }
    }
    // Fidget: hand to hair
    if (c.fidgetKind === 'tuck' && c.fidget > 0) {
      const k = Math.sin(c.fidget * Math.PI);
      ell(ctx, (bodyW / 2) * 0.8, U.lerp(by + bodyH * 0.45, hy - hr * 0.2, k), 2.6 * s, 2.6 * s, L.skin);
    }
    ctx.restore();
  },
  hair(ctx, L, facing, hr, hy, s, time, c) {
    if (L.hairStyle === 'none') return;
    ctx.fillStyle = L.hair;
    if (facing === 'up') {
      ctx.beginPath(); ctx.arc(0, hy, hr + 0.6, 0, Math.PI * 2); ctx.fill();
      if (L.hairStyle === 'messy') { circ(ctx, -4 * s, hy - hr * 0.7, 3 * s, L.hair); circ(ctx, 4 * s, hy - hr * 0.8, 2.6 * s, L.hair); }
      return;
    }
    ctx.beginPath();
    ctx.arc(0, hy - 0.5 * s, hr + 0.6, Math.PI * 1.02, Math.PI * 1.98);
    ctx.lineTo(hr * 0.7, hy - hr * 0.15);
    ctx.lineTo(-hr * 0.7, hy - hr * 0.15);
    ctx.closePath(); ctx.fill();
    if (facing === 'left') { ell(ctx, hr * 0.55, hy, hr * 0.5, hr * 0.85, L.hair); }
    if (facing === 'right') { ell(ctx, -hr * 0.55, hy, hr * 0.5, hr * 0.85, L.hair); }
    if (L.hairStyle === 'messy') {
      const w = Math.sin(time * 3 + (c ? c.x : 0)) * 0.6;
      circ(ctx, -5 * s, hy - hr * 0.62, 3.1 * s, L.hair);
      circ(ctx, 1 * s + w, hy - hr * 0.95, 3.2 * s, L.hair);
      circ(ctx, 5.5 * s, hy - hr * 0.5, 2.8 * s, L.hair);
      circ(ctx, -hr * 0.9, hy + 1 * s, 2.4 * s, L.hair);
    } else {
      circ(ctx, -3 * s, hy - hr * 0.75, 2.6 * s, L.hair);
    }
  },
  entity(ctx, c, time) {
    const k = (Math.sin(time * 0.7) + 1) / 2;
    const s = U.lerp(0.95, 1.22, k);
    const a = 0.32 + Math.sin(time * 5.3) * 0.06 + Math.sin(time * 1.1) * 0.05;
    ctx.globalAlpha = c.alpha * a;
    ctx.strokeStyle = 'rgba(210,228,250,0.9)'; ctx.lineWidth = 1.2;
    fillRR(ctx, -7 * s, -21 * s, 14 * s, 17 * s, 5 * s, 'rgba(225,236,250,0.55)');
    rr(ctx, -7 * s, -21 * s, 14 * s, 17 * s, 5 * s); ctx.stroke();
    circ(ctx, 0, -27 * s, 7.4 * s, 'rgba(235,243,252,0.6)');
    ctx.beginPath(); ctx.arc(0, -27 * s, 7.4 * s, 0, 7); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const fy = -((time * 14 + i * 11) % 44);
      circ(ctx, Math.sin(time * 2 + i) * 9, fy, 1.1, 'rgba(255,255,255,0.8)');
    }
  },

  /* ---------- lighting & grading ---------- */
  lighting(time) {
    const d = S.env.dark;
    if (d < 0.01) return;
    const l = this.lctx, dpr = this.dpr, ctx = this.ctx;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, this.lc.width, this.lc.height);
    l.fillStyle = `rgba(${S.env.darkRGB},${d})`;
    l.fillRect(0, 0, this.lc.width, this.lc.height);
    l.globalCompositeOperation = 'destination-out';
    const lights = this.collectLights(time);
    for (const L of lights) {
      const [sx, sy] = this.toScreen(L.x, L.y);
      const r = L.r * Cam.zoom * dpr;
      if (r <= 0) continue;
      const g = l.createRadialGradient(sx * dpr, sy * dpr, 0, sx * dpr, sy * dpr, r);
      g.addColorStop(0, `rgba(0,0,0,${L.i})`);
      g.addColorStop(0.55, `rgba(0,0,0,${L.i * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.beginPath(); l.arc(sx * dpr, sy * dpr, r, 0, Math.PI * 2); l.fill();
    }
    ctx.drawImage(this.lc, 0, 0, this.W, this.H);
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.color) continue;
      const [sx, sy] = this.toScreen(L.x, L.y);
      const r = L.r * Cam.zoom * 0.8;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(${L.color},${(L.glow || 0.18) * Math.min(1, d + 0.25)})`);
      g.addColorStop(1, `rgba(${L.color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
  collectLights(time) {
    const out = [];
    for (const o of S.map.objects) {
      if (!o.visible || !o.light) continue;
      const L = typeof o.light === 'function' ? o.light(o, time) : o.light;
      if (!L) continue;
      const fl = L.flicker ? 1 + Math.sin(time * 13 + o.x) * 0.04 + Math.sin(time * 7.3) * 0.04 : 1;
      out.push(Object.assign({ x: (o.x + o.w / 2) * TILE, y: (o.y + o.h / 2) * TILE }, L, { r: L.r * fl }));
    }
    const p = S.player;
    if (p && p.visible) out.push({ x: p.x, y: p.y - 12, r: 64 + 40 * (1 - S.env.dark), i: 0.45 });
    if (S.partner && S.partner.visible && S.map.kind !== 'indoor') out.push({ x: S.partner.x, y: S.partner.y - 10, r: 46, i: 0.3 });
    return out;
  },
  grade() {
    const e = S.env, ctx = this.ctx;
    if (e.desat > 0.01) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = `rgba(128,128,128,${U.clamp(e.desat, 0, 1)})`;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (e.warm > 0.01) { ctx.fillStyle = `rgba(255,150,70,${e.warm * 0.075})`; ctx.fillRect(0, 0, this.W, this.H); }
    else if (e.warm < -0.01) { ctx.fillStyle = `rgba(90,130,205,${-e.warm * 0.15})`; ctx.fillRect(0, 0, this.W, this.H); }
    if (e.white > 0.001) { ctx.fillStyle = `rgba(255,255,255,${e.white})`; ctx.fillRect(0, 0, this.W, this.H); }
  },
  snow(dt, density, wind, title) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const n = Math.floor(this.flakes.length * U.clamp(density, 0, 1));
    const frozen = S.flags.frozenSnow;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const f = this.flakes[i];
      if (!frozen && dt) {
        f.y += (0.025 + 0.05 * f.z) * dt;
        f.p += dt * (0.6 + f.z);
        f.x += (Math.sin(f.p) * 0.004 + wind * 0.012 * f.z) * dt * 6;
        if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
        if (f.x > 1.02) f.x -= 1.04; if (f.x < -0.02) f.x += 1.04;
      }
      const par = title ? 0 : ((Cam.x * Cam.zoom * 0.35 * f.z) / W) % 1;
      let sx = ((f.x - par) % 1 + 1) % 1 * W;
      const sy = f.y * H;
      ctx.globalAlpha = 0.35 + 0.55 * f.z;
      ctx.beginPath(); ctx.arc(sx, sy, 0.6 + f.z * 1.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  bubbles() {
    const ctx = this.ctx;
    ctx.font = '600 13px system-ui, -apple-system, "Segoe UI", sans-serif';
    for (const c of Game.chars()) {
      const b = c.bubble;
      if (!b || !c.visible) continue;
      const lift = (c.pose === 'sit' ? 34 : 44) * c.scale + (c.pose === 'lie' ? -20 : 0);
      const [sx, sy0] = this.toScreen(c.x, c.y - lift);
      const words = b.text.split(' ');
      const lines = []; let cur = '';
      for (const w of words) { const tryL = cur ? cur + ' ' + w : w; if (ctx.measureText(tryL).width > 190 && cur) { lines.push(cur); cur = w; } else cur = tryL; }
      if (cur) lines.push(cur);
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
      const h = lines.length * 17 + 10;
      const a = Math.min(1, b.age * 6, b.t * 3);
      const sy = sy0 - h - 6 - (1 - Math.min(1, b.age * 5)) * 6;
      ctx.globalAlpha = a;
      fillRR(ctx, sx - w / 2, sy, w, h, 9, 'rgba(255,250,240,0.95)');
      ctx.beginPath(); ctx.moveTo(sx - 5, sy + h - 1); ctx.lineTo(sx + 5, sy + h - 1); ctx.lineTo(sx, sy + h + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2a24';
      ctx.textAlign = 'center';
      lines.forEach((l, i) => ctx.fillText(l, sx, sy + 20 + i * 17));
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  },
};
