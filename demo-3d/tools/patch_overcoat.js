// Puts the overcoats exported by tools/overcoat.py (export()) into the game's realistic models.
// Usage (from demo-3d/): node tools/patch_overcoat.js <dir with partner.bin, player.bin, meta.json>
// The coat mesh's primitive in models/real/<name>.glb gets new POSITION, NORMAL, TEXCOORD_0, COLOR_0, JOINTS_0,
// WEIGHTS_0 and indices (appended to the binary chunk; the old coat data is dropped from the file), and
// js/models_real.js is rewritten with the new glbs embedded.
// Export layout per vertex (little endian): 8 x f32 (pos xyz, normal xyz, uv), 3 x u8 rgb, 4 x (u8 joint, f32 weight);
// then u16 indices. Positions and normals are Blender world space at rest; the model's glTF space is
// [x - OX, z, -y] (OX = the character's x offset in the .blend: partner +0.45, player -0.45).
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = process.argv[2];
const META = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const OX = { partner: 0.45, player: -0.45 };
const src = fs.readFileSync('js/models_real.js', 'utf8'); const w = {}; vm.runInNewContext(src, { window: w });
const out = {};
for (const name of ['partner', 'player']) {
  const glb = Buffer.from(w.CBS_REAL[name], 'base64');
  const jl = glb.readUInt32LE(12); const J = JSON.parse(glb.slice(20, 20 + jl).toString('utf8').trim());
  const binStart = 20 + jl + 8, binLen = glb.readUInt32LE(20 + jl); let bin = glb.slice(binStart, binStart + binLen);
  const mi = J.meshes.findIndex((m) => /^coat/i.test(m.name)); const pr = J.meshes[mi].primitives[0];
  const node = J.nodes.find((n) => n.mesh === mi); const skin = J.skins[node.skin];
  const jn = skin.joints.map((j) => J.nodes[j].name.replace(/^mixamorig:?/, ''));
  const M = META[name], B = fs.readFileSync(path.join(dir, name + '.bin')), nv = M.nv, ni = M.ni, S = 55;
  const jmap = M.names.map((k) => { const i = jn.indexOf(k); if (i < 0) throw new Error(name + ': no joint ' + k); return i; });
  const pos = Buffer.alloc(nv * 12), nrm = Buffer.alloc(nv * 12), uv = Buffer.alloc(nv * 8), col = Buffer.alloc(nv * 12), jt = Buffer.alloc(nv * 4), wt = Buffer.alloc(nv * 16);
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) {
    const o = i * S, f = (k) => B.readFloatLE(o + 4 * k);
    const p = [f(0) - OX[name], f(2), -f(1)], n = [f(3), f(5), -f(4)];
    for (let k = 0; k < 3; k++) { pos.writeFloatLE(p[k], i * 12 + 4 * k); nrm.writeFloatLE(n[k], i * 12 + 4 * k); mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
    uv.writeFloatLE(f(6), i * 8); uv.writeFloatLE(-f(7), i * 8 + 4);
    for (let k = 0; k < 3; k++) col.writeFloatLE(B[o + 32 + k] / 255, i * 12 + 4 * k);
    let t = 0; const js = [], ws = [];
    for (let k = 0; k < 4; k++) { js.push(jmap[B[o + 35 + k * 5]]); ws.push(B.readFloatLE(o + 36 + k * 5)); t += ws[k]; }
    for (let k = 0; k < 4; k++) { jt[i * 4 + k] = ws[k] > 0 ? js[k] : 0; wt.writeFloatLE(t > 0 ? ws[k] / t : (k ? 0 : 1), i * 16 + 4 * k); }
  }
  const idx = Buffer.from(B.slice(nv * S, nv * S + ni * 2));
  // Drop the old coat's data: rebuild the binary chunk from the buffer views still in use.
  const oldAcc = new Set([...Object.values(pr.attributes), pr.indices]);
  const blobs = [pos, nrm, uv, col, jt, wt, idx];
  const used = new Set(); J.accessors.forEach((a, i) => { if (!oldAcc.has(i) && a.bufferView !== undefined) used.add(a.bufferView); });
  (J.images || []).forEach((im) => { if (im.bufferView !== undefined) used.add(im.bufferView); });
  const parts = []; let off = 0; const remap = {};
  const pushBlob = (b) => { const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; } const at = off; parts.push(b); off += b.length; return at; };
  J.bufferViews.forEach((bv, i) => { if (!used.has(i)) return; remap[i] = { ...bv, byteOffset: pushBlob(bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)) }; });
  const views = []; Object.keys(remap).map(Number).sort((a, b) => a - b).forEach((i) => { remap[i].newIndex = views.length; const { newIndex, ...v } = remap[i]; views.push(v); });
  J.accessors.forEach((a) => { if (a.bufferView !== undefined && remap[a.bufferView]) a.bufferView = remap[a.bufferView].newIndex; });
  (J.images || []).forEach((im) => { if (im.bufferView !== undefined && remap[im.bufferView]) im.bufferView = remap[im.bufferView].newIndex; });
  const nb = blobs.map((b, k) => { const at = pushBlob(b); views.push({ buffer: 0, byteOffset: at, byteLength: b.length, ...(k === 6 ? { target: 34963 } : { target: 34962 }) }); return views.length - 1; });
  J.bufferViews = views;
  const acc = (bv, ct, type, count, extra) => { J.accessors.push({ bufferView: bv, componentType: ct, count, type, ...(extra || {}) }); return J.accessors.length - 1; };
  // old coat accessors stay in the list (unreferenced, no data) so other indices don't shift; give them no view
  for (const i of oldAcc) { delete J.accessors[i].bufferView; delete J.accessors[i].byteOffset; delete J.accessors[i].min; delete J.accessors[i].max; J.accessors[i].count = 1; }
  pr.attributes = {
    POSITION: acc(nb[0], 5126, 'VEC3', nv, { min: mn, max: mx }), NORMAL: acc(nb[1], 5126, 'VEC3', nv), TEXCOORD_0: acc(nb[2], 5126, 'VEC2', nv),
    COLOR_0: acc(nb[3], 5126, 'VEC3', nv), JOINTS_0: acc(nb[4], 5121, 'VEC4', nv), WEIGHTS_0: acc(nb[5], 5126, 'VEC4', nv),
  };
  pr.indices = acc(nb[6], 5123, 'SCALAR', ni); delete pr.targets;
  bin = Buffer.concat(parts); const binPad = (4 - (bin.length % 4)) % 4; bin = Buffer.concat([bin, Buffer.alloc(binPad)]);
  J.buffers = [{ byteLength: bin.length }];
  let js = Buffer.from(JSON.stringify(J), 'utf8'); const jsPad = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.from(' '.repeat(jsPad))]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  const res = Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]);
  fs.writeFileSync('models/real/' + name + '.glb', res); w.CBS_REAL[name] = res.toString('base64');
  out[name] = { nv, tris: ni / 3, bytes: res.length, before: glb.length };
}
let s = src; for (const n of ['partner', 'player']) s = s.replace(new RegExp('(' + n + ": ')[^']*'"), (m, a) => a + w.CBS_REAL[n] + "'");
fs.writeFileSync('js/models_real.js', s); console.log(JSON.stringify(out));
