'use strict';
/* =========================================================================
 * Object drawers, scrapbook art, and title-screen vignettes.
 * All art is procedural; no external images.
 * ========================================================================= */
const Draw = {
  obj(ctx, o, t) {
    const f = this.K[o.kind];
    if (!f) return;
    const X = o.x * TILE, Y = o.y * TILE, W = o.w * TILE, H = o.h * TILE;
    f.call(this, ctx, o, X, Y, W, H, t);
    if (o.glint && Math.sin(t * 3) > 0.2) {
      const gx = X + W / 2 + Math.sin(t * 1.3) * 3, gy = Y + 4;
      ctx.fillStyle = 'rgba(255,248,210,0.9)';
      ctx.beginPath(); ctx.moveTo(gx, gy - 5); ctx.lineTo(gx + 1.2, gy - 1.2); ctx.lineTo(gx + 5, gy); ctx.lineTo(gx + 1.2, gy + 1.2); ctx.lineTo(gx, gy + 5); ctx.lineTo(gx - 1.2, gy + 1.2); ctx.lineTo(gx - 5, gy); ctx.lineTo(gx - 1.2, gy - 1.2); ctx.closePath(); ctx.fill();
    }
  },
  sleeper(ctx, c, x, y, t) {
    const L = c.look, s = c.scale * 0.95;
    circ(ctx, x, y, 7.4 * s, L.skin);
    R.hair(ctx, L, 'down', 7.4 * s, y, s, t, c);
    ctx.fillStyle = '#2a1c18';
    ctx.fillRect(x - 4 * s, y + 1 * s, 2.6 * s, 0.9 * s);
    ctx.fillRect(x + 1.4 * s, y + 1 * s, 2.6 * s, 0.9 * s);
  },
  K: {
    zone() {},
    bed(ctx, o, X, Y, W, H, t) {
      ell(ctx, X + W / 2, Y + H, W / 2, 6, 'rgba(0,0,0,0.2)');
      fillRR(ctx, X - 2, Y - 2, W + 4, H + 2, 5, '#6b4433');
      fillRR(ctx, X, Y + 4, W, H - 6, 4, '#f3ece0');
      fillRR(ctx, X - 2, Y - 4, W + 4, 12, 4, '#7d523d');
      fillRR(ctx, X + 8, Y + 12, W / 2 - 14, 18, 7, '#ffffff');
      fillRR(ctx, X + W / 2 + 6, Y + 12, W / 2 - 14, 18, 7, '#fbf7ef');
      const occ = o.data.occ || {};
      const lx = X + W * 0.27, rx = X + W * 0.73, hy = Y + 22;
      if (occ.left) this.sleeper(ctx, occ.left, lx, hy, t);
      if (occ.right) this.sleeper(ctx, occ.right, rx, hy, t);
      const side = o.data.blanket || 0;
      const bx0 = side < 0 ? X - 2 : side > 0 ? X + W * 0.32 : X - 2;
      const bx1 = side < 0 ? X + W * 0.68 : X + W + 2;
      fillRR(ctx, bx0, Y + 34, bx1 - bx0, H - 36, 6, o.data.color || '#c46f57');
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 3; i++) ctx.fillRect(bx0 + 4, Y + 44 + i * 16, bx1 - bx0 - 8, 2);
      const breathe = (k) => Math.sin(t * 1.6 + k) * 1.2;
      if (occ.left) ell(ctx, lx, Y + 58 + breathe(0), 13, 18, 'rgba(0,0,0,0.08)');
      if (occ.right) ell(ctx, rx, Y + 56 + breathe(2), 11, 16, 'rgba(0,0,0,0.08)');
      if (occ.left || occ.right) ctx.fillStyle = o.data.color || '#c46f57';
      ctx.fillStyle = '#5f3b2c'; ctx.fillRect(X - 2, Y + H - 6, W + 4, 6);
    },
    nightstand(ctx, o, X, Y, W, H) {
      fillRR(ctx, X, Y, W, H, 3, '#8a5a3e');
      ctx.fillStyle = '#74492f'; ctx.fillRect(X + 3, Y + H * 0.55, W - 6, 2);
      circ(ctx, X + W / 2, Y + H * 0.35, 6, o.data.on ? '#ffe6a8' : '#e9dcc0');
      circ(ctx, X + W / 2, Y + H * 0.35, 3, o.data.on ? '#fff6d8' : '#cdbf9f');
    },
    wardrobe(ctx, o, X, Y, W, H) {
      ell(ctx, X + W / 2, Y + H, W / 2, 4, 'rgba(0,0,0,0.2)');
      fillRR(ctx, X, Y - 10, W, H + 10, 3, '#7a5038');
      ctx.fillStyle = '#5f3c29'; ctx.fillRect(X + W / 2 - 0.5, Y - 6, 1, H + 2);
      circ(ctx, X + W / 2 - 4, Y + H / 2 - 4, 1.6, '#e6c27a'); circ(ctx, X + W / 2 + 4, Y + H / 2 - 4, 1.6, '#e6c27a');
    },
    rug(ctx, o, X, Y, W, H) {
      fillRR(ctx, X, Y, W, H, 8, o.data.color || '#9c4f45');
      ctx.strokeStyle = 'rgba(255,230,190,0.45)'; ctx.lineWidth = 2; rr(ctx, X + 5, Y + 5, W - 10, H - 10, 6); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,190,0.25)'; rr(ctx, X + 11, Y + 11, W - 22, H - 22, 4); ctx.stroke();
    },
    laundry(ctx, o, X, Y, W, H) {
      fillRR(ctx, X, Y + 4, W, H - 4, 5, '#c9a57a');
      circ(ctx, X + 8, Y + 6, 6, '#e2a64a'); circ(ctx, X + 17, Y + 5, 5, '#5b7fa6'); circ(ctx, X + 13, Y + 2, 4, '#f0ece2');
    },
    bathtub(ctx, o, X, Y, W, H) {
      fillRR(ctx, X, Y, W, H, 12, '#f7f7f4');
      fillRR(ctx, X + 5, Y + 6, W - 10, H - 12, 9, '#cfe6ef');
      circ(ctx, X + W / 2, Y + 12, 2, '#b8c2c8');
      const cols = ['#5aa0d0', '#e78aa0', '#f2c14e'];
      cols.forEach((c, i) => circ(ctx, X + 6 + i * 6, Y + H - 4, 2.4, c));
    },
    sink(ctx, o, X, Y, W, H) {
      fillRR(ctx, X, Y, W, H, 4, '#efeeea');
      ell(ctx, X + W / 2, Y + H / 2 + 2, W / 3, H / 4, '#cfe0e8');
      const n = S.flags.toothbrushes || 2;
      fillRR(ctx, X + W - 12, Y + 3, 8, 10, 2, '#9fc7d8');
      const cols = ['#5b7fa6', '#6fbf73', '#6fbf73'];
      for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(X + W - 11 + i * 2.2, Y - 5, 1.6, 9); }
    },
    mirror(ctx, o, X, Y, W, H) {
      fillRR(ctx, X + 2, Y - TILE + 12, W - 4, TILE - 14, 3, '#d9d2c4');
      fillRR(ctx, X + 4, Y - TILE + 14, W - 8, TILE - 18, 2, S.env.dark > 0.5 ? '#3a4660' : '#c9dde8');
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(X + 7, Y - TILE + 16, 2, TILE - 22);
    },
    bathmat(ctx, o, X, Y, W, H) { fillRR(ctx, X, Y, W, H, 6, '#8fb3a0'); },
    roof(ctx, o, X, Y, W, H) {
      ctx.fillStyle = '#4a302a'; ctx.fillRect(X, Y, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let j = 0; j < H; j += 10) ctx.fillRect(X, Y + j, W, 2);
      ctx.fillStyle = 'rgba(255,230,200,0.6)';
      ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(o.data.text || '', X + W / 2, Y + H / 2 + 4); ctx.textAlign = 'left';
    },
    door(ctx, o, X, Y, W, H) {
      fillRR(ctx, X + 3, Y + 2, W - 6, H - 2, 2, o.data.color || '#8a5a3e');
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(X + 6, Y + 6, W - 12, 8); ctx.fillRect(X + 6, Y + 18, W - 12, 8);
      circ(ctx, X + W - 9, Y + H / 2 + 2, 1.8, '#e6c27a');
      if (o.data.sign) { fillRR(ctx, X + 6, Y + 6, W - 12, 9, 2, '#fff5dc'); ctx.fillStyle = '#b5483a'; ctx.font = 'bold 5px system-ui'; ctx.textAlign = 'center'; ctx.fillText('NO GIANTS', X + W / 2, Y + 12.5); ctx.textAlign = 'left'; }
    },
    frontdoor(ctx, o, X, Y, W, H) {
      fillRR(ctx, X + 1, Y, W - 2, H, 2, '#6f8f72');
      fillRR(ctx, X + 6, Y + 4, W - 12, 8, 2, S.env.dark > 0.5 ? '#1d2a44' : '#cfe8f5');
      circ(ctx, X + W - 7, Y + H / 2 + 3, 1.8, '#e6c27a');
    },
    snowdoor(ctx, o, X, Y, W, H, t) {
      const gl = 0.5 + Math.sin(t * 2) * 0.2;
      fillRR(ctx, X - 3, Y - 3, W + 6, H + 6, 4, `rgba(200,225,255,${gl * 0.5})`);
      fillRR(ctx, X, Y, W, H, 2, '#d9e6f2');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(X + 2, Y + 3, W - 4, 3);
      circ(ctx, X + W - 4, Y + H / 2, 1.5, '#9fb6cc');
    },
    photo(ctx, o, X, Y, W, H) {
      const fy = Y - TILE + 14;
      fillRR(ctx, X, fy, W, H, 2, '#5f3c29');
      const art = o.data.art;
      ctx.fillStyle = art === 'empty' ? '#e9dcc4' : art === 'snowkids' || art === 'snowkids3' ? '#eef3f8' : art === 'lake' ? '#8cc0dc' : '#f0d9c0';
      ctx.fillRect(X + 3, fy + 3, W - 6, H - 6);
      if (art === 'snowkids' || art === 'snowkids3') { circ(ctx, X + W * 0.4, fy + H * 0.6, 1.5, '#555'); circ(ctx, X + W * 0.6, fy + H * 0.6, 1.3, '#555'); if (art === 'snowkids3') circ(ctx, X + W * 0.85, fy + H * 0.5, 1.6, 'rgba(90,90,100,0.5)'); }
      if (art === 'lake') { ctx.fillStyle = '#6aa05a'; ctx.fillRect(X + 3, fy + H - 8, W - 6, 5); }
      if (art === 'cake') { circ(ctx, X + W / 2, fy + H / 2, 3, '#fff'); }
    },
    coatrack(ctx, o, X, Y, W, H) {
      ell(ctx, X + W / 2, Y + H, 9, 3, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = '#5f3c29'; ctx.fillRect(X + W / 2 - 2, Y - 20, 4, H + 20);
      fillRR(ctx, X + 2, Y - 16, 10, 18, 4, '#3f5770');
      fillRR(ctx, X + W - 13, Y - 14, 10, 16, 4, '#8c6a3a');
      fillRR(ctx, X + W / 2 - 3, Y - 18, 6, 22, 3, '#8f97a6');
    },
    counter(ctx, o, X, Y, W, H, t) {
      ell(ctx, X + W / 2, Y + H, W / 2, 4, 'rgba(0,0,0,0.15)');
      fillRR(ctx, X, Y - 6, W, H + 6, 3, '#d9cbb3');
      ctx.fillStyle = '#9b7a5a'; ctx.fillRect(X, Y + H - 6, W, 6);
      const st = o.data.stoveX;
      if (st != null) {
        const sx = X + st * TILE;
        fillRR(ctx, sx, Y - 4, TILE * 1.2, H + 2, 3, '#3a3a3e');
        for (const [dx, dy] of [[9, 4], [27, 4], [9, 18], [27, 18]]) { circ(ctx, sx + dx, Y + dy, 5, '#555'); circ(ctx, sx + dx, Y + dy, 3, S.flags.stoveOn ? '#e8693c' : '#444'); }
        if (S.flags.pancakesMade && !S.flags.breakfastDone) { circ(ctx, sx + 18, Y + 10, 9, '#f4f1ea'); circ(ctx, sx + 18, Y + 9, 6.5, '#e2b56a'); }
      }
      if (o.data.sinkX != null) { const kx = X + o.data.sinkX * TILE; fillRR(ctx, kx + 4, Y - 1, 26, 16, 4, '#b9c7cf'); circ(ctx, kx + 17, Y - 3, 2, '#8c9aa2'); }
      if (o.data.kettleX != null) {
        const kx = X + o.data.kettleX * TILE;
        fillRR(ctx, kx + 4, Y - 6, 16, 14, 6, '#c8553d'); ctx.fillStyle = '#7a2f22'; ctx.fillRect(kx + 9, Y - 9, 6, 3);
        if (S.flags.kettleOn && Math.sin(t * 4) > -0.5) circ(ctx, kx + 12, Y - 13 - (t * 10 % 6), 2.5, 'rgba(255,255,255,0.5)');
      }
      if (o.data.toasterX != null) { const tx = X + o.data.toasterX * TILE; fillRR(ctx, tx + 4, Y - 4, 18, 12, 3, '#b7bcc2'); ctx.fillStyle = '#555'; ctx.fillRect(tx + 8, Y - 3, 10, 1.5); }
      if (o.data.glass && S.flags.nightGlass) { fillRR(ctx, X + o.data.glass * TILE, Y - 4, 7, 10, 1.5, 'rgba(200,225,240,0.8)'); ctx.fillStyle = 'rgba(120,170,210,0.7)'; ctx.fillRect(X + o.data.glass * TILE + 1, Y + 1, 5, 4); }
    },
    fridge(ctx, o, X, Y, W, H) {
      ell(ctx, X + W / 2, Y + H, W / 2, 4, 'rgba(0,0,0,0.2)');
      fillRR(ctx, X, Y - 18, W, H + 18, 5, '#efe9dc');
      ctx.fillStyle = '#d6cdbb'; ctx.fillRect(X + 2, Y + 2, W - 4, 1.5);
      ctx.fillStyle = '#b5ad9c'; ctx.fillRect(X + W - 7, Y - 12, 2, 10); ctx.fillRect(X + W - 7, Y + 6, 2, 10);
      circ(ctx, X + 8, Y - 8, 2.5, '#e86a7a'); circ(ctx, X + 15, Y - 4, 2.5, '#5aa0d0'); fillRR(ctx, X + 6, Y + 6, 10, 12, 1, '#fff9e6');
    },
    table(ctx, o, X, Y, W, H) {
      ell(ctx, X + W / 2, Y + H + 2, W / 2 + 4, 6, 'rgba(0,0,0,0.18)');
      for (const cx of [X + W * 0.3, X + W * 0.7]) { fillRR(ctx, cx - 9, Y - 14, 18, 14, 3, '#8a5a3e'); fillRR(ctx, cx - 9, Y + H, 18, 14, 3, '#8a5a3e'); }
      fillRR(ctx, X, Y, W, H, 5, '#a8714d');
      ctx.fillStyle = 'rgba(255,230,190,0.12)'; ctx.fillRect(X + 4, Y + 4, W - 8, 3);
      const d = o.data;
      if (d.plates) {
        for (const px of [X + W * 0.33, X + W * 0.66]) { circ(ctx, px, Y + H * 0.62, 9, '#f4f1ea'); if (d.plates !== 'empty') { circ(ctx, px, Y + H * 0.6, 6.5, d.burnt ? '#9b6a3a' : '#e2b56a'); circ(ctx, px, Y + H * 0.56, 5, d.burnt ? '#8a5a2e' : '#ecc47e'); } }
        if (d.bite) { circ(ctx, X + W * 0.66 + 5, Y + H * 0.55, 3, '#f4f1ea'); }
      }
      if (d.mugs) { circ(ctx, X + W * 0.15, Y + H * 0.35, 5, '#c8553d'); circ(ctx, X + W * 0.85, Y + H * 0.35, 5, '#5b7fa6'); circ(ctx, X + W * 0.15, Y + H * 0.35, 3, '#8a5a3a'); circ(ctx, X + W * 0.85, Y + H * 0.35, 3, '#8a5a3a'); }
      if (d.perfect) { for (let i = 0; i < 4; i++) circ(ctx, X + W * 0.5, Y + H * 0.55 - i * 2.5, 9 - i * 0.3, i % 2 ? '#ecc47e' : '#e2b56a'); }
      if (d.cake) {
        fillRR(ctx, X + W / 2 - 16, Y + H / 2 - 12, 32, 20, 4, '#f6e2ea'); ctx.fillStyle = '#e88aa0'; ctx.fillRect(X + W / 2 - 16, Y + H / 2 - 4, 32, 3);
        for (let i = 0; i < 5; i++) { ctx.fillStyle = '#7ab0e0'; ctx.fillRect(X + W / 2 - 12 + i * 6, Y + H / 2 - 20, 2, 8); circ(ctx, X + W / 2 - 11 + i * 6, Y + H / 2 - 22, 1.6, '#ffd36a'); }
      }
    },
    cupboard(ctx, o, X, Y, W, H) {
      fillRR(ctx, X, Y - 8, W, H + 8, 3, '#8a5a3e');
      ctx.fillStyle = '#6a4330'; ctx.fillRect(X + 3, Y + H / 2 - 4, W - 6, 1);
      circ(ctx, X + W - 6, Y + 2, 1.5, '#e6c27a');
    },
    bookshelf(ctx, o, X, Y, W, H) {
      fillRR(ctx, X, Y - 16, W, H + 16, 2, '#6f472f');
      const cols = ['#b5483a', '#3f5770', '#d6a548', '#6f8f72', '#8a6a9a', '#c87a4a', '#e0d4bc'];
      for (let r = 0; r < 2; r++) {
        let bx = X + 3;
        let i = r * 3;
        while (bx < X + W - 6) {
          const bw = 3 + ((i * 7) % 4);
          ctx.fillStyle = cols[i % cols.length];
          ctx.fillRect(bx, Y - 13 + r * 15, bw, 12);
          bx += bw + 1; i++;
        }
      }
      fillRR(ctx, X + W - 16, Y - 15, 12, 14, 1, '#c0392b');
    },
    plant(ctx, o, X, Y, W, H, t) {
      fillRR(ctx, X + 6, Y + 8, W - 12, H - 8, 4, '#c8714a');
      const sw = Math.sin(t * 1.2) * 1.5;
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.45; ell(ctx, X + W / 2 + Math.cos(a) * 9 + sw, Y + 6 + Math.sin(a) * 11, 5, 8, i % 2 ? '#4f8f48' : '#5fa356'); }
    },
    sofa(ctx, o, X, Y, W, H) {
      ell(ctx, X + W / 2, Y + H + 2, W / 2, 5, 'rgba(0,0,0,0.2)');
      fillRR(ctx, X, Y - 10, W, 18, 7, '#5f7f62');
      fillRR(ctx, X + 2, Y + 6, W - 4, H - 6, 5, '#6f8f72');
      fillRR(ctx, X - 4, Y - 4, 10, H + 4, 5, '#56745a');
      fillRR(ctx, X + W - 6, Y - 4, 10, H + 4, 5, '#56745a');
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(X + W / 2 - 1, Y + 8, 2, H - 10);
      fillRR(ctx, X + 10, Y - 6, 14, 10, 4, '#e2a64a');
    },
    fireplace(ctx, o, X, Y, W, H, t) {
      fillRR(ctx, X - 4, Y - 14, W + 8, H + 14, 3, '#8f8a82');
      ctx.fillStyle = '#6e5a4a'; ctx.fillRect(X - 6, Y - 16, W + 12, 5);
      fillRR(ctx, X + 10, Y - 4, W - 20, H, 6, '#2a2220');
      if (o.data.lit) { for (let i = 0; i < 3; i++) { const fx = X + W / 2 + (i - 1) * 7; const fh = 9 + Math.sin(t * 9 + i * 2) * 3; ell(ctx, fx, Y + H - 9, 4, fh, i === 1 ? '#ffcf6a' : '#ff8a3c'); } }
      if (S.flags.giftReceived) {
        const gx = X + W - 12, gy = Y - 20;
        if (S.flags.globeFallen) { ell(ctx, gx, gy + 2, 6, 4, 'rgba(220,235,250,0.85)'); }
        else { circ(ctx, gx, gy - 2, 5, 'rgba(220,235,250,0.85)'); ctx.fillStyle = '#7a5038'; ctx.fillRect(gx - 5, gy + 2, 10, 3); }
      }
    },
    armchair(ctx, o, X, Y, W, H) {
      ell(ctx, X + W / 2, Y + H + 2, W / 2, 4, 'rgba(0,0,0,0.2)');
      fillRR(ctx, X, Y - 8, W, 16, 7, '#9c4f45');
      fillRR(ctx, X + 2, Y + 4, W - 4, H - 4, 5, '#ad5c50');
      fillRR(ctx, X + 4, Y + 6, W - 12, H - 10, 4, '#e8d9b8');
    },
    // ---------- outdoors ----------
    facade(ctx, o, X, Y, W, H) {
      const night = S.env.dark > 0.35;
      ell(ctx, X + W / 2, Y + H, W / 2, 8, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = '#d9c3a5'; ctx.fillRect(X, Y + H * 0.35, W, H * 0.65);
      ctx.fillStyle = '#8a4b3c'; ctx.beginPath(); ctx.moveTo(X - 10, Y + H * 0.4); ctx.lineTo(X + W * 0.15, Y - 6); ctx.lineTo(X + W * 0.85, Y - 6); ctx.lineTo(X + W + 10, Y + H * 0.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 4; i++) ctx.fillRect(X - 6 + i * 2, Y + i * 10, W + 12 - i * 4, 2);
      const win = night ? '#f2c48e' : '#bfe0f2';
      for (const wx of [0.12, 0.3, 0.68, 0.86]) { fillRR(ctx, X + W * wx - 12, Y + H * 0.5, 24, 20, 2, '#e8dcc4'); fillRR(ctx, X + W * wx - 10, Y + H * 0.5 + 2, 20, 16, 1, S.flags.windowSnow && night ? '#e8eef6' : win); }
      fillRR(ctx, X + W * 0.5 - 16, Y + H * 0.48, 32, H * 0.52, 2, '#6f8f72');
      circ(ctx, X + W * 0.5 + 9, Y + H * 0.76, 2, '#e6c27a');
      ctx.fillStyle = '#b89a7a'; ctx.fillRect(X + W * 0.5 - 22, Y + H - 3, 44, 3);
    },
    firepit(ctx, o, X, Y, W, H, t) {
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; circ(ctx, X + W / 2 + Math.cos(a) * 14, Y + H / 2 + Math.sin(a) * 10, 4.5, i % 2 ? '#8f8a82' : '#a29c92'); }
      ell(ctx, X + W / 2, Y + H / 2, 11, 7, '#3a2a22');
      ctx.fillStyle = '#6b4a32'; ctx.save(); ctx.translate(X + W / 2, Y + H / 2); ctx.rotate(0.5); ctx.fillRect(-10, -2, 20, 4); ctx.rotate(-1); ctx.fillRect(-10, -2, 20, 4); ctx.restore();
      if (o.data.lit) {
        const k = o.data.dying ? 0.4 : 1;
        for (let i = 0; i < 4; i++) { const fx = X + W / 2 + (i - 1.5) * 4.5; const fh = (10 + Math.sin(t * 10 + i * 1.7) * 4) * k; ell(ctx, fx, Y + H / 2 - fh * 0.6, 3.6 * k + 1, fh, i % 2 ? '#ffcf6a' : '#ff8a3c'); }
        ell(ctx, X + W / 2, Y + H / 2 - 4, 3, 5 * k, '#fff2c4');
        if (Math.random() < 0.25 * k) FX.ember(X + W / 2, Y + H / 2 - 10);
      }
    },
    log(ctx, o, X, Y, W, H) {
      ell(ctx, X + W / 2, Y + H, W / 2, 4, 'rgba(0,0,0,0.2)');
      fillRR(ctx, X, Y, W, H, H / 2, o.data.worn ? '#8a6448' : '#7a5236');
      ell(ctx, X + 4, Y + H / 2, 4, H / 2 - 1, '#c79a6c');
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(X + 10, Y + H / 2 - 1, W - 20, 2);
    },
    flower(ctx, o, X, Y, W, H, t) {
      const cx = X + W / 2, cy = Y + H / 2 + 4, sw = Math.sin(t * 2 + o.x) * 1;
      ctx.fillStyle = '#4f8f48'; ctx.fillRect(cx - 0.6, cy - 6, 1.2, 8);
      const c = o.data.color || '#f2c14e';
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; circ(ctx, cx + sw + Math.cos(a) * 2.8, cy - 7 + Math.sin(a) * 2.8, 2.2, c); }
      circ(ctx, cx + sw, cy - 7, 1.6, '#fff3b0');
    },
    flag(ctx, o, X, Y, W, H, t) {
      ctx.fillStyle = '#5f3c29'; ctx.fillRect(X + W / 2 - 1, Y - 18, 2, H + 18);
      const w = Math.sin(t * 5) * 2;
      ctx.fillStyle = '#d94a3a'; ctx.beginPath(); ctx.moveTo(X + W / 2 + 1, Y - 18); ctx.lineTo(X + W / 2 + 15, Y - 13 + w); ctx.lineTo(X + W / 2 + 1, Y - 8); ctx.closePath(); ctx.fill();
    },
    bench(ctx, o, X, Y, W, H) {
      ell(ctx, X + W / 2, Y + H + 3, W / 2, 4, 'rgba(0,0,0,0.2)');
      fillRR(ctx, X, Y - 8, W, 7, 2, '#8a5a3e');
      fillRR(ctx, X, Y + 2, W, H - 2, 2, '#9b6a48');
      ctx.fillStyle = '#5f3c29'; ctx.fillRect(X + 4, Y + H - 1, 3, 5); ctx.fillRect(X + W - 7, Y + H - 1, 3, 5);
    },
    sign(ctx, o, X, Y, W, H) {
      ctx.fillStyle = '#6b4a32'; ctx.fillRect(X + W / 2 - 1.5, Y - 10, 3, H + 10);
      fillRR(ctx, X - 4, Y - 16, W + 8, 12, 2, '#b88a5a');
      ctx.fillStyle = '#5a3b22'; ctx.fillRect(X, Y - 11, W, 1.5);
    },
    stones(ctx, o, X, Y, W, H) {
      for (let i = 0; i < 6; i++) ell(ctx, X + 4 + i * 7, Y + H / 2 + ((i * 5) % 3) * 2, 3.5, 2.4, i % 2 ? '#9e988c' : '#b4ada0');
    },
    bigtree(ctx, o, X, Y, W, H, t) {
      const cx = X + W / 2, by = Y + H;
      const snowy = o.data.snowy;
      ell(ctx, cx, by, 26, 8, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = '#5f4030'; ctx.fillRect(cx - 5, by - 26, 10, 26);
      const sw = Math.sin(t * 0.8) * 1.5;
      const c1 = snowy ? '#3e5e52' : '#3f7a3f', c2 = snowy ? '#36564a' : '#4b8a44';
      circ(ctx, cx + sw, by - 46, 28, c1); circ(ctx, cx - 16 + sw, by - 34, 18, c2); circ(ctx, cx + 17 + sw, by - 35, 19, c2);
      if (snowy) { ell(ctx, cx + sw, by - 66, 20, 8, '#f4f8fc'); ell(ctx, cx - 18 + sw, by - 46, 10, 4, '#eef4fa'); ell(ctx, cx + 20 + sw, by - 47, 10, 4, '#eef4fa'); }
      else circ(ctx, cx - 6 + sw, by - 56, 12, 'rgba(160,210,120,0.3)');
    },
    footprints(ctx, o, X, Y, W, H) {
      ctx.fillStyle = 'rgba(120,140,170,0.45)';
      const cx = X + W / 2, cy = Y + H / 2;
      for (let i = 0; i < 6; i++) {
        ell(ctx, cx - 50 + i * 8, cy - 2 + (i % 2) * 5, 2.2, 3.2, 'rgba(120,140,170,0.45)');
        ell(ctx, cx + 50 - i * 8, cy + 4 + (i % 2) * 5, 2.2, 3.2, 'rgba(120,140,170,0.45)');
      }
      if (o.data.third) for (let i = 0; i < 4; i++) ell(ctx, cx + 4 + (i % 2) * 5, cy - 50 + i * 9, 2.4, 3.4, 'rgba(120,140,170,0.25)');
    },
    stall(ctx, o, X, Y, W, H, t) {
      ell(ctx, X + W / 2, Y + H + 2, W / 2, 6, 'rgba(0,0,0,0.25)');
      fillRR(ctx, X, Y + 6, W, H - 6, 3, '#8a5a3e');
      fillRR(ctx, X + 3, Y + H - 14, W - 6, 10, 2, '#c9a57a');
      const c = o.data.color || '#b5483a';
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f6efe2' : c; ctx.fillRect(X - 4 + i * (W + 8) / 6, Y - 6, (W + 8) / 6 + 0.5, 12); }
      for (let i = 0; i < 5; i++) circ(ctx, X + 6 + i * (W - 12) / 4, Y + 8, 2.2, Math.sin(t * 3 + i) > 0 ? '#ffe39a' : '#ffcf6a');
      for (let i = 0; i < 3; i++) circ(ctx, X + 12 + i * 12, Y + H - 16, 3, ['#e86a7a', '#f2c14e', '#7ab0e0'][i]);
    },
    lanterns(ctx, o, X, Y, W, H, t) {
      ctx.strokeStyle = 'rgba(60,40,30,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + W / 2, Y + 14, X + W, Y); ctx.stroke();
      const n = Math.max(3, Math.floor(W / 18));
      for (let i = 1; i < n; i++) { const k = i / n; const lx = X + W * k; const ly = Y + Math.sin(k * Math.PI) * 10 + 4; circ(ctx, lx, ly, 3, ['#ffcf6a', '#ff9a6a', '#ffe39a', '#9ad0ff'][i % 4]); }
      ctx.fillStyle = '#5f3c29'; ctx.fillRect(X - 1, Y - 2, 2, 40); ctx.fillRect(X + W - 1, Y - 2, 2, 40);
    },
    littree(ctx, o, X, Y, W, H, t) {
      const cx = X + W / 2, by = Y + H;
      ell(ctx, cx, by, 22, 7, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = '#2f5a3a';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx, by - 70 + i * 12); ctx.lineTo(cx - 12 - i * 6, by - 30 + i * 8); ctx.lineTo(cx + 12 + i * 6, by - 30 + i * 8); ctx.closePath(); ctx.fill(); }
      for (let i = 0; i < 14; i++) circ(ctx, cx + Math.sin(i * 2.4) * (6 + i * 1.6), by - 64 + i * 3.6, 1.8, Math.sin(t * 2 + i) > 0 ? '#ffe39a' : '#ff8a6a');
      circ(ctx, cx, by - 72, 3.5, '#ffe39a');
    },
    fence(ctx, o, X, Y, W, H) {
      ctx.fillStyle = '#7a5a40';
      const n = Math.floor(W / 10);
      for (let i = 0; i <= n; i++) ctx.fillRect(X + i * 10, Y - 12, 3, 16);
      ctx.fillRect(X, Y - 9, W, 2);
      ctx.fillRect(X, Y - 2, W * 0.55, 2); ctx.fillRect(X + W * 0.7, Y - 2, W * 0.3, 2);
      ctx.save(); ctx.translate(X + W * 0.62, Y - 1); ctx.rotate(0.5); ctx.fillRect(-6, -1, 12, 2); ctx.restore();
    },
    page(ctx, o, X, Y, W, H) {
      ctx.save(); ctx.translate(X + W / 2, Y + H / 2); ctx.rotate(o.data.rot || 0.2);
      ell(ctx, 1, 3, 9, 4, 'rgba(0,0,0,0.12)');
      fillRR(ctx, -8, -10, 16, 20, 1, '#fffaf0');
      ctx.fillStyle = 'rgba(80,90,120,0.4)'; for (let i = 0; i < 4; i++) ctx.fillRect(-5, -6 + i * 4, 10, 1);
      ctx.restore();
    },
    framepost(ctx, o, X, Y, W, H) {
      ctx.fillStyle = '#6b4a32'; ctx.fillRect(X + W / 2 - 1.5, Y - 6, 3, H + 6);
      fillRR(ctx, X + W / 2 - 11, Y - 26, 22, 18, 2, '#5f3c29');
      ctx.fillStyle = o.data.art === 'lake' ? '#e9f2f8' : '#f6eadb'; ctx.fillRect(X + W / 2 - 8, Y - 23, 16, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(X + W / 2 - 8, Y - 13, 16, 2);
    },
    perfecthouse(ctx, o, X, Y, W, H, t) {
      ell(ctx, X + W / 2, Y + H, W / 2 + 6, 10, 'rgba(0,0,0,0.2)');
      const glow = ctx.createRadialGradient(X + W / 2, Y + H * 0.6, 10, X + W / 2, Y + H * 0.6, W);
      glow.addColorStop(0, 'rgba(255,200,130,0.35)'); glow.addColorStop(1, 'rgba(255,200,130,0)');
      ctx.fillStyle = glow; ctx.fillRect(X - W / 2, Y - H / 2, W * 2, H * 2);
      ctx.fillStyle = '#e8d4b4'; ctx.fillRect(X, Y + H * 0.35, W, H * 0.65);
      ctx.fillStyle = '#a5584a'; ctx.beginPath(); ctx.moveTo(X - 10, Y + H * 0.4); ctx.lineTo(X + W * 0.15, Y - 8); ctx.lineTo(X + W * 0.85, Y - 8); ctx.lineTo(X + W + 10, Y + H * 0.4); ctx.closePath(); ctx.fill();
      ell(ctx, X + W * 0.5, Y - 6, W * 0.38, 6, '#f7fafd');
      for (const wx of [0.15, 0.32, 0.68, 0.85]) { fillRR(ctx, X + W * wx - 12, Y + H * 0.5, 24, 20, 2, '#fff1d6'); fillRR(ctx, X + W * wx - 10, Y + H * 0.5 + 2, 20, 16, 1, '#ffd38a'); }
      fillRR(ctx, X + W * 0.5 - 16, Y + H * 0.48, 32, H * 0.52, 2, o.data.open ? '#ffe2a8' : '#6f8f72');
      ctx.strokeStyle = '#3f6b4a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X + W * 0.5, Y + H * 0.6, 7, 0, 7); ctx.stroke();
      if (Math.sin(t * 1.5) > 0.9) circ(ctx, X + W * 0.15, Y + H * 0.6, 2, 'rgba(255,255,255,0.6)');
    },
    doorframe(ctx, o, X, Y, W, H, t) {
      const g = ctx.createRadialGradient(X + W / 2, Y + H / 2, 4, X + W / 2, Y + H / 2, 60);
      g.addColorStop(0, `rgba(255,214,150,${0.45 + Math.sin(t * 2) * 0.1})`); g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g; ctx.fillRect(X - 50, Y - 50, W + 100, H + 100);
      ell(ctx, X + W / 2, Y + H, W / 2 + 4, 5, 'rgba(0,0,0,0.2)');
      fillRR(ctx, X - 4, Y - 26, W + 8, H + 26, 2, '#7d523d');
      fillRR(ctx, X, Y - 22, W, H + 22, 1, o.data.open ? '#fff3d2' : '#8a5a3e');
      if (!o.data.open) circ(ctx, X + W - 6, Y + H / 2 - 8, 2, '#e6c27a');
    },
    biglog(ctx, o, X, Y, W, H) {
      ell(ctx, X + W / 2, Y + H + 2, W / 2, 6, 'rgba(0,0,0,0.2)');
      fillRR(ctx, X, Y, W, H, H / 2, '#6b4a32');
      ctx.fillStyle = '#f4f8fc'; fillRR(ctx, X + 8, Y - 3, W - 16, 7, 3, '#f4f8fc');
      ell(ctx, X + 6, Y + H / 2, 6, H / 2 - 1, '#b88a5a');
      ell(ctx, X + W - 6, Y + H / 2, 6, H / 2 - 1, '#b88a5a');
    },
    lamp(ctx, o, X, Y, W, H) {
      ctx.fillStyle = '#5f3c29'; ctx.fillRect(X + W / 2 - 1, Y - 24, 2, H + 24);
      ctx.fillStyle = o.data.on ? '#ffe6a8' : '#e9dcc0';
      ctx.beginPath(); ctx.moveTo(X + W / 2 - 8, Y - 18); ctx.lineTo(X + W / 2 + 8, Y - 18); ctx.lineTo(X + W / 2 + 5, Y - 30); ctx.lineTo(X + W / 2 - 5, Y - 30); ctx.closePath(); ctx.fill();
    },
  },

  /* ---------- scrapbook / photo art ---------- */
  art(ctx, art, w, h, t) {
    ctx.save();
    const fig = (x, y, col, sc) => { circ(ctx, x, y - 9 * sc, 4 * sc, '#e6b48f'); fillRR(ctx, x - 4 * sc, y - 6 * sc, 8 * sc, 10 * sc, 3 * sc, col); };
    switch (art) {
      case 'lake': {
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bfe0f2'); g.addColorStop(1, '#eaf4fa');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#6aa6c8'; ctx.fillRect(0, h * 0.45, w, h * 0.3);
        ctx.fillStyle = '#7ba95b'; ctx.fillRect(0, h * 0.72, w, h * 0.28);
        fig(w * 0.42, h * 0.86, '#5b7fa6', 1.4); fig(w * 0.58, h * 0.88, '#e2a64a', 1.1);
        ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(w * 0.62 + i * 3, h * 0.66 - i * 3); ctx.lineTo(w * 0.66 + i * 4, h * 0.62 - i * 4); ctx.stroke(); }
        break;
      }
      case 'cake': {
        ctx.fillStyle = '#f2dcc6'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e8c9a8'; for (let i = 0; i < 6; i++) circ(ctx, (i * 53) % w, 12 + (i * 31) % 30, 6, 'rgba(255,255,255,0.4)');
        fig(w * 0.4, h * 0.85, '#3f5770', 1.6); fig(w * 0.62, h * 0.87, '#8a6a9a', 1.3);
        fillRR(ctx, w * 0.47, h * 0.58, 16, 10, 2, '#fff'); ctx.fillStyle = '#e88aa0'; ctx.fillRect(w * 0.47, h * 0.62, 16, 2);
        break;
      }
      case 'pressed': {
        ctx.fillStyle = '#f7f0e0'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 4; i++) { const cx = w * (0.2 + i * 0.2), cy = h * (0.4 + (i % 2) * 0.2); ctx.fillStyle = '#7a9a5a'; ctx.fillRect(cx - 0.5, cy, 1, 30); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; circ(ctx, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 4, ['#d9a0b0', '#c9a0d9', '#e8c070', '#a0c0e0'][i]); } }
        break;
      }
      case 'pancakes': {
        ctx.fillStyle = '#f6ead4'; ctx.fillRect(0, 0, w, h);
        circ(ctx, w / 2, h / 2 + 6, 42, '#fbfaf6');
        for (let i = 0; i < 4; i++) ell(ctx, w / 2, h / 2 + 10 - i * 6, 30, 12, i % 2 ? '#ecc47e' : '#d9a85a');
        circ(ctx, w / 2 + 26, h / 2 - 8, 9, '#f6ead4');
        ctx.fillStyle = '#c0392b'; ctx.fillRect(w / 2 - 4, h / 2 - 16, 8, 4);
        break;
      }
      case 'hill': {
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd0ef'); g.addColorStop(1, '#e6f3fa');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#8fbb68'; ctx.beginPath(); ctx.moveTo(0, h); ctx.quadraticCurveTo(w / 2, h * 0.2, w, h); ctx.fill();
        fig(w * 0.42, h * 0.5, '#5b7fa6', 1.4); fig(w * 0.6, h * 0.52, '#e2a64a', 1.1);
        ctx.fillStyle = '#5f3c29'; ctx.fillRect(w * 0.63, h * 0.3, 2, 22); ctx.fillStyle = '#d94a3a'; ctx.beginPath(); ctx.moveTo(w * 0.63 + 2, h * 0.3); ctx.lineTo(w * 0.63 + 14, h * 0.34); ctx.lineTo(w * 0.63 + 2, h * 0.38); ctx.fill();
        break;
      }
      case 'creek': {
        ctx.fillStyle = '#7ba95b'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#5b97bd'; ctx.fillRect(0, h * 0.35, w, h * 0.4);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(w * 0.2 + i * 30, h * 0.5, 10 - i, Math.PI, 0); ctx.stroke(); }
        break;
      }
      case 'snowkids': case 'snowkids3': {
        ctx.fillStyle = '#e8edf2'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#b9c4d0'; ctx.fillRect(0, 0, w, h * 0.35);
        for (let i = 0; i < 9; i++) { const tx = (i * 37) % w; ctx.fillStyle = '#7d8a86'; ctx.beginPath(); ctx.moveTo(tx, h * 0.38); ctx.lineTo(tx - 8, h * 0.38); ctx.lineTo(tx - 4, h * 0.12); ctx.fill(); }
        fig(w * 0.44, h * 0.72, '#6d7684', 0.9); fig(w * 0.56, h * 0.72, '#8a7f73', 0.8);
        if (art === 'snowkids3') { ctx.globalAlpha = 0.35; fig(w * 0.86, h * 0.64, '#c9d6e6', 1.1); ctx.globalAlpha = 1; }
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 60; i++) ctx.fillRect((i * 71) % w, (i * 43) % h, 1.5, 1.5);
        break;
      }
      case 'campfire': {
        ctx.fillStyle = '#1f2236'; ctx.fillRect(0, 0, w, h);
        const g = ctx.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.7, w * 0.5); g.addColorStop(0, 'rgba(255,170,80,0.7)'); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ell(ctx, w / 2, h * 0.74, 7, 12, '#ff9a3c'); ell(ctx, w / 2, h * 0.76, 4, 7, '#ffe39a');
        fig(w * 0.3, h * 0.86, '#5b7fa6', 1.4); fig(w * 0.7, h * 0.88, '#e2a64a', 1.1);
        break;
      }
      case 'globe': {
        ctx.fillStyle = '#f2e6d4'; ctx.fillRect(0, 0, w, h);
        circ(ctx, w / 2, h * 0.45, 34, 'rgba(190,215,240,0.9)');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 2 - 30, h * 0.55, 60, 8);
        fig(w / 2 - 6, h * 0.6, '#6d7684', 0.6); fig(w / 2 + 6, h * 0.6, '#8a7f73', 0.55);
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#4f7a52'; ctx.beginPath(); ctx.moveTo(w / 2 - 20 + i * 10, h * 0.56); ctx.lineTo(w / 2 - 24 + i * 10, h * 0.56); ctx.lineTo(w / 2 - 22 + i * 10, h * 0.4); ctx.fill(); }
        fillRR(ctx, w / 2 - 26, h * 0.73, 52, 12, 3, '#7a5038');
        break;
      }
      case 'festival': {
        ctx.fillStyle = '#1d2a44'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 10; i++) circ(ctx, i * w / 9, 18 + Math.sin(i) * 6, 3, ['#ffcf6a', '#ff9a6a', '#9ad0ff'][i % 3]);
        ctx.fillStyle = '#eef3f8'; ctx.fillRect(0, h * 0.75, w, h * 0.25);
        fig(w * 0.46, h * 0.86, '#5b7fa6', 1.3); fig(w * 0.56, h * 0.87, '#e2a64a', 1.0);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 71) % w, (i * 37) % (h * 0.75), 1.5, 1.5);
        break;
      }
      case 'meadow': {
        ctx.fillStyle = '#9fcf7a'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 30; i++) circ(ctx, (i * 47) % w, (i * 29) % h, 2.5, ['#f2c14e', '#e86a7a', '#ffffff', '#c9a0d9'][i % 4]);
        fig(w * 0.5, h * 0.7, '#e2a64a', 1.2);
        break;
      }
      default: {
        ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, w, h);
      }
    }
    ctx.restore();
  },

  /* ---------- title-screen vignettes ---------- */
  titleScene(ctx, W, H, t, v) {
    const morning = v === 'foundme' || v === 'uncertain';
    const evening = v === 'iknow';
    if (v === 'firstsnow') return this.titleFestival(ctx, W, H, t);
    const frozen = v === 'stay';
    const tt = frozen ? 3.3 : t;
    const wall = morning ? '#c79f7e' : evening ? '#7a4f3a' : '#3b2621';
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let x = 0; x < W; x += 46) ctx.fillRect(x, 0, 2, H);
    // Window
    const ww = Math.min(W * 0.46, 520), wh = Math.min(H * 0.42, 340), wx = W / 2 - ww / 2, wy = H * 0.1;
    ctx.save();
    ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    if (morning) {
      const g = ctx.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#a9d4ef'); g.addColorStop(1, '#f6e6c8'); ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
      circ(ctx, wx + ww * 0.75, wy + wh * 0.3, 30, 'rgba(255,240,190,0.9)');
      ctx.fillStyle = '#7ba95b'; ctx.fillRect(wx, wy + wh * 0.8, ww, wh * 0.2);
    } else if (evening) {
      const g = ctx.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#6a5a8a'); g.addColorStop(1, '#f2a46a'); ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
    } else {
      const g = ctx.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#141d33'); g.addColorStop(1, '#2c3b5c'); ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
      for (let i = 0; i < 9; i++) { const tx = wx + (i * 67) % ww; ctx.fillStyle = '#20302c'; ctx.beginPath(); ctx.moveTo(tx, wy + wh); ctx.lineTo(tx - 22, wy + wh); ctx.lineTo(tx - 11, wy + wh * 0.55 + (i % 3) * 10); ctx.fill(); }
      ctx.fillStyle = '#e8eef6'; ctx.fillRect(wx, wy + wh * 0.88, ww, wh * 0.12);
      if (v === 'perfect') {
        const fx = wx + ww * 0.3, fy = wy + wh * 0.86;
        const k = 0.5 + Math.sin(t * 7) * 0.15;
        const g2 = ctx.createRadialGradient(fx, fy, 1, fx, fy, 30); g2.addColorStop(0, `rgba(255,140,60,${0.5 * k})`); g2.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = g2; ctx.fillRect(fx - 30, fy - 30, 60, 60);
        ell(ctx, fx, fy, 3, 4 * k, '#ff9a3c');
        circ(ctx, fx + 10, fy - 9, 3, '#d49a74'); fillRR(ctx, fx + 7, fy - 6, 7, 8, 2, '#e2a64a');
      }
      for (let i = 0; i < 70; i++) {
        const sp = 14 + (i % 5) * 6;
        const fx = wx + ((i * 97) % 1000) / 1000 * ww + Math.sin(tt + i) * 4;
        const fy = wy + ((tt * sp + i * 53) % wh);
        circ(ctx, fx, fy, 1 + (i % 3) * 0.6, 'rgba(255,255,255,0.85)');
      }
    }
    ctx.restore();
    ctx.fillStyle = '#e9dcc4'; ctx.fillRect(wx - 10, wy - 10, ww + 20, 10); ctx.fillRect(wx - 10, wy + wh, ww + 20, 14); ctx.fillRect(wx - 10, wy, 10, wh); ctx.fillRect(wx + ww, wy, 10, wh); ctx.fillRect(wx + ww / 2 - 4, wy, 8, wh); ctx.fillRect(wx, wy + wh / 2 - 4, ww, 8);
    ctx.fillStyle = morning ? '#c46f57' : '#8a3f34';
    ctx.fillRect(wx - 70, wy - 20, 60, wh + 60); ctx.fillRect(wx + ww + 10, wy - 20, 60, wh + 60);
    if (v === 'uncertain') { const cx = wx + ww * 0.82, cy = wy + wh + 2; fillRR(ctx, cx - 7, cy - 18, 14, 18, 3, '#9fc7d8'); ['#5b7fa6', '#6fbf73', '#6fbf73'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(cx - 5 + i * 4, cy - 32, 3, 18); }); }
    // Lamp glow
    const lx = W * 0.12, ly = H * 0.55;
    const lit = !morning;
    if (lit) {
      const k = frozen ? 1 : 1 + Math.sin(t * 3) * 0.02;
      const g = ctx.createRadialGradient(lx, ly, 10, lx, ly, 260 * k); g.addColorStop(0, 'rgba(255,200,120,0.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe6a8'; ctx.beginPath(); ctx.moveTo(lx - 26, ly); ctx.lineTo(lx + 26, ly); ctx.lineTo(lx + 16, ly - 34); ctx.lineTo(lx - 16, ly - 34); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5f3c29'; ctx.fillRect(lx - 2, ly, 4, H * 0.2); fillRR(ctx, lx - 40, ly + H * 0.2, 80, 60, 4, '#7a5038');
    }
    // Foreground
    const by = H * 0.74;
    if (evening) {
      fillRR(ctx, W * 0.18, by - 40, W * 0.64, 70, 26, '#5f7f62'); fillRR(ctx, W * 0.16, by, W * 0.68, H - by, 20, '#6f8f72');
      this.titleFig(ctx, W * 0.44, by + 6, '#5b7fa6', '#3a2a22', 1.6, 0.12, t);
      this.titleFig(ctx, W * 0.53, by + 12, '#e2a64a', '#2b1d17', 1.25, -0.25, t);
      fillRR(ctx, W * 0.45, by + 34, 90, 36, 3, '#fbf6ea'); ctx.fillStyle = 'rgba(80,90,120,0.4)'; for (let i = 0; i < 4; i++) ctx.fillRect(W * 0.45 + 6, by + 42 + i * 6, 34, 1.5);
    } else if (frozen) {
      fillRR(ctx, W * 0.15, by - 10, W * 0.7, H, 16, '#6b4433');
      fillRR(ctx, W * 0.17, by, W * 0.66, H, 12, '#f3ece0');
      fillRR(ctx, W * 0.5 - 60, by + 10, 120, 50, 8, '#f6e2ea'); ctx.fillStyle = '#e88aa0'; ctx.fillRect(W * 0.5 - 60, by + 28, 120, 6);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = '#7ab0e0'; ctx.fillRect(W * 0.5 - 48 + i * 16, by - 8, 4, 18); ell(ctx, W * 0.5 - 46 + i * 16, by - 14, 3, 6, '#ffd36a'); }
    } else {
      fillRR(ctx, W * 0.15, by - 30, W * 0.7, 36, 8, '#7d523d');
      fillRR(ctx, W * 0.15, by, W * 0.7, H, 16, '#6b4433');
      fillRR(ctx, W * 0.17, by + 4, W * 0.66, H, 12, '#f3ece0');
      fillRR(ctx, W * 0.22, by + 10, W * 0.2, 34, 14, '#ffffff'); fillRR(ctx, W * 0.58, by + 10, W * 0.2, 34, 14, '#fbf7ef');
      const two = true;
      const still = v === 'perfect';
      const br = (k) => (still ? 0 : Math.sin(t * 1.5 + k) * 2);
      if (two) {
        this.titleHead(ctx, W * 0.36, by + 30, '#e6b48f', '#3a2a22', 1.5);
        this.titleHead(ctx, W * 0.6, by + 30, '#d49a74', '#2b1d17', 1.2, true);
      }
      fillRR(ctx, W * 0.16, by + 50 + br(0), W * 0.68, H, 18, morning ? '#d8826a' : '#c46f57');
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 4; i++) ctx.fillRect(W * 0.18, by + 66 + i * 22 + br(0), W * 0.64, 3);
    }
  },
  titleHead(ctx, x, y, skin, hair, s, messy) {
    circ(ctx, x, y, 14 * s, skin);
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, y - 2, 15 * s, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    if (messy) { circ(ctx, x - 8 * s, y - 12 * s, 6 * s, hair); circ(ctx, x + 6 * s, y - 14 * s, 6 * s, hair); }
    ctx.fillStyle = '#2a1c18'; ctx.fillRect(x - 7 * s, y + 2 * s, 5 * s, 1.6 * s); ctx.fillRect(x + 2 * s, y + 2 * s, 5 * s, 1.6 * s);
  },
  titleFig(ctx, x, y, body, hair, s, rot, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    fillRR(ctx, -18 * s, -30 * s, 36 * s, 44 * s, 12 * s, body);
    circ(ctx, 0, -42 * s, 16 * s, '#e0aa84');
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -44 * s, 17 * s, Math.PI, 0); ctx.fill();
    ctx.restore();
  },
  titleFestival(ctx, W, H, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16213a'); g.addColorStop(0.7, '#2c3b5c'); g.addColorStop(1, '#3a3550');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) { const tx = (i * 131) % W; ctx.fillStyle = '#1e2c2c'; ctx.beginPath(); ctx.moveTo(tx, H * 0.7); ctx.lineTo(tx - 50, H * 0.7); ctx.lineTo(tx - 25, H * 0.35 + (i % 4) * 18); ctx.fill(); ell(ctx, tx - 25, H * 0.37 + (i % 4) * 18, 9, 4, '#e8eef6'); }
    ctx.fillStyle = '#e8eef6'; ctx.fillRect(0, H * 0.68, W, H * 0.32);
    for (let s = 0; s < 3; s++) {
      const y0 = H * (0.2 + s * 0.08);
      ctx.strokeStyle = 'rgba(40,30,30,0.6)'; ctx.beginPath(); ctx.moveTo(0, y0); ctx.quadraticCurveTo(W / 2, y0 + 40, W, y0); ctx.stroke();
      for (let i = 0; i < 18; i++) { const k = i / 17; const x = W * k, y = y0 + Math.sin(k * Math.PI) * 30 + 4; const c = ['255,207,106', '255,154,106', '154,208,255'][(i + s) % 3]; const gg = ctx.createRadialGradient(x, y, 0, x, y, 16); gg.addColorStop(0, `rgba(${c},0.9)`); gg.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = gg; ctx.fillRect(x - 16, y - 16, 32, 32); }
    }
    const fx = W * 0.5 + Math.sin(t * 0.2) * 4;
    this.titleFig(ctx, fx - 22, H * 0.86, '#5b7fa6', '#3a2a22', 0.9, 0, t);
    this.titleFig(ctx, fx + 18, H * 0.87, '#e2a64a', '#2b1d17', 0.72, 0, t);
    fillRR(ctx, fx - 8, H * 0.86 - 14, 14, 5, 2, '#e0aa84');
    return 0.6;
  },
};
