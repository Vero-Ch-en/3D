// Puts the winter clothes made in Blender (tools/overcoat.py + tools/winter_gear.py, exported with export_obj)
// into the game's realistic models: the coat mesh is replaced, and hat_/scarf_/gloves_/boots_<name> are added as
// skinned meshes on the same skeleton (replaced if they're already there). Old data is dropped from the file.
// Usage (from demo-3d/): node tools/patch_gear.js <dir with <key>.bin and gear_meta.json>
// Keys: coat_<name> (replaces the coat), leggings_<name> (replaces the leggings, keeping their material), anything else is added.
// Per vertex (little endian): 8 x f32 (pos xyz, normal xyz, uv), 3 x u8 rgb, 4 x (u8 joint, f32 weight); then u16
// indices. Positions/normals are Blender world space at rest; glTF model space is [x - OX, z, -y].
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = process.argv[2];
const META = JSON.parse(fs.readFileSync(path.join(dir, 'gear_meta.json'), 'utf8'));
const OX = { partner: 0.45, player: -0.45 };
const src = fs.readFileSync('js/models_real.js', 'utf8'); const w = {}; vm.runInNewContext(src, { window: w });
const out = {};

function readGlb(buf) {
  const jl = buf.readUInt32LE(12); const J = JSON.parse(buf.slice(20, 20 + jl).toString('utf8').trim());
  const bs = 20 + jl + 8, bl = buf.readUInt32LE(20 + jl); return { J, bin: buf.slice(bs, bs + bl) };
}
function writeGlb(J, bin) {
  const pad = (b, c) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, c)]);
  const js = pad(Buffer.from(JSON.stringify(J), 'utf8'), 0x20); bin = pad(bin, 0);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]);
}
function decode(key, name, jn) {
  const M = META[key], B = fs.readFileSync(path.join(dir, key + '.bin')), nv = M.nv, ni = M.ni, S = 55;
  const jmap = M.names.map((k) => { const i = jn.indexOf(k); if (i < 0) throw new Error(key + ': no joint ' + k); return i; });
  const pos = Buffer.alloc(nv * 12), nrm = Buffer.alloc(nv * 12), uv = Buffer.alloc(nv * 8), col = Buffer.alloc(nv * 12), jt = Buffer.alloc(nv * 4), wt = Buffer.alloc(nv * 16);
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) {
    const o = i * S, f = (k) => B.readFloatLE(o + 4 * k);
    const p = [f(0) - OX[name], f(2), -f(1)], n = [f(3), f(5), -f(4)];
    for (let k = 0; k < 3; k++) { pos.writeFloatLE(p[k], i * 12 + 4 * k); nrm.writeFloatLE(n[k], i * 12 + 4 * k); mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
    uv.writeFloatLE(f(6), i * 8); uv.writeFloatLE(-f(7), i * 8 + 4);
    for (let k = 0; k < 3; k++) col.writeFloatLE(Math.pow(B[o + 32 + k] / 255, 2.2), i * 12 + 4 * k);   // authored as screen (sRGB) colours; three.js wants linear
    let t = 0; const js = [], ws = [];
    for (let k = 0; k < 4; k++) { js.push(jmap[B[o + 35 + k * 5]]); ws.push(B.readFloatLE(o + 36 + k * 5)); t += ws[k]; }
    for (let k = 0; k < 4; k++) { jt[i * 4 + k] = ws[k] > 0 ? js[k] : 0; wt.writeFloatLE(t > 0 ? ws[k] / t : (k ? 0 : 1), i * 16 + 4 * k); }
  }
  return { nv, ni, mn, mx, blobs: [pos, nrm, uv, col, jt, wt, Buffer.from(B.slice(nv * S, nv * S + ni * 2))] };
}

for (const name of ['partner', 'player']) {
  const glb = Buffer.from(w.CBS_REAL[name], 'base64'); const { J, bin } = readGlb(glb);
  const coatMi = J.meshes.findIndex((m) => /^coat/i.test(m.name)); const coatNode = J.nodes.findIndex((n) => n.mesh === coatMi);
  const skin = J.skins[J.nodes[coatNode].skin]; const jn = skin.joints.map((j) => J.nodes[j].name.replace(/^mixamorig:?/, ''));
  const parentIdx = J.nodes.findIndex((n) => (n.children || []).includes(coatNode));
  const mat = J.meshes[coatMi].primitives[0].material;
  const keys = Object.keys(META).filter((k) => META[k].n === name);
  // which primitive each key fills (creating meshes/nodes for the new pieces)
  const target = {};
  for (const key of keys) {
    if (key.startsWith('coat_')) { target[key] = J.meshes[coatMi].primitives[0]; continue; }
    // leggings_<name>: replaces the leggings in place (his trousers, tools/trousers.py), keeping their own material
    if (key.startsWith('leggings_')) { const li = J.meshes.findIndex((m) => /^leggings/i.test(m.name)); if (li < 0) throw new Error('no leggings mesh'); target[key] = J.meshes[li].primitives[0]; continue; }
    let mi = J.meshes.findIndex((m) => m.name === key);
    if (mi < 0) {
      J.meshes.push({ name: key, primitives: [{ attributes: {}, material: mat }] }); mi = J.meshes.length - 1;
      J.nodes.push({ name: key, mesh: mi, skin: J.nodes[coatNode].skin }); const ni = J.nodes.length - 1;
      if (parentIdx >= 0) J.nodes[parentIdx].children.push(ni); else J.scenes[J.scene || 0].nodes.push(ni);
    }
    target[key] = J.meshes[mi].primitives[0];
  }
  // accessors the replaced primitives used: drop their data
  const dead = new Set(); for (const key of keys) { const pr = target[key]; Object.values(pr.attributes).forEach((a) => dead.add(a)); if (pr.indices !== undefined) dead.add(pr.indices); }
  const used = new Set(); J.accessors.forEach((a, i) => { if (!dead.has(i) && a.bufferView !== undefined) used.add(a.bufferView); });
  (J.images || []).forEach((im) => { if (im.bufferView !== undefined) used.add(im.bufferView); });
  const parts = []; let off = 0; const views = []; const remap = {};
  const push = (b) => { const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; } const at = off; parts.push(b); off += b.length; return at; };
  J.bufferViews.forEach((bv, i) => { if (!used.has(i)) return; remap[i] = views.length; views.push({ ...bv, byteOffset: push(bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)) }); });
  J.accessors.forEach((a) => { if (a.bufferView !== undefined && remap[a.bufferView] !== undefined) a.bufferView = remap[a.bufferView]; });
  (J.images || []).forEach((im) => { if (im.bufferView !== undefined && remap[im.bufferView] !== undefined) im.bufferView = remap[im.bufferView]; });
  for (const i of dead) { const a = J.accessors[i]; delete a.bufferView; delete a.byteOffset; delete a.min; delete a.max; a.count = 1; }
  const acc = (bv, ct, type, count, extra) => { J.accessors.push({ bufferView: bv, componentType: ct, count, type, ...(extra || {}) }); return J.accessors.length - 1; };
  out[name] = {};
  for (const key of keys) {
    const d = decode(key, name, jn);
    const vb = d.blobs.map((b, k) => { views.push({ buffer: 0, byteOffset: push(b), byteLength: b.length, target: k === 6 ? 34963 : 34962 }); return views.length - 1; });
    const pr = target[key];
    pr.attributes = { POSITION: acc(vb[0], 5126, 'VEC3', d.nv, { min: d.mn, max: d.mx }), NORMAL: acc(vb[1], 5126, 'VEC3', d.nv), TEXCOORD_0: acc(vb[2], 5126, 'VEC2', d.nv),
      COLOR_0: acc(vb[3], 5126, 'VEC3', d.nv), JOINTS_0: acc(vb[4], 5121, 'VEC4', d.nv), WEIGHTS_0: acc(vb[5], 5126, 'VEC4', d.nv) };
    if (key.startsWith('leggings_')) delete pr.attributes.COLOR_0;   // plain cloth: no vertex colours (as the original)
    pr.indices = acc(vb[6], 5123, 'SCALAR', d.ni); delete pr.targets;
    out[name][key] = d.nv;
  }
  J.bufferViews = views; const nb = Buffer.concat(parts); J.buffers = [{ byteLength: nb.length + ((4 - (nb.length % 4)) % 4) }];
  const res = writeGlb(J, nb);
  fs.writeFileSync('models/real/' + name + '.glb', res); w.CBS_REAL[name] = res.toString('base64'); out[name].bytes = res.length; out[name].before = glb.length;
}
let s = src; for (const n of ['partner', 'player']) s = s.replace(new RegExp('(' + n + ": ')[^']*'"), (m, a) => a + w.CBS_REAL[n] + "'");
fs.writeFileSync('js/models_real.js', s); console.log(JSON.stringify(out));
