// Shrinks the realistic character models for download without any decoder (KHR_mesh_quantization, read natively by
// GLTFLoader; the game turns the attributes back into floats right after loading, see dequantize() in people.js).
//   NORMAL     float VEC3 -> BYTE normalized (stride 4)
//   TANGENT    float VEC4 -> BYTE normalized
//   TEXCOORD_n float VEC2 -> UNSIGNED_SHORT normalized, when every value is within 0..1
//   COLOR_0    float VEC3/4 -> UNSIGNED_SHORT normalized (stride 8)
//   WEIGHTS_0  float VEC4 -> UNSIGNED_BYTE normalized (each vertex still sums to exactly 255)
//   indices    UNSIGNED_INT -> UNSIGNED_SHORT when the mesh has fewer than 65536 vertices
// POSITION stays float (the meshes are skinned, and the game reshapes them on load).
// Usage (from demo-3d/): node tools/quantize_glb.js            -> js/models_real.js and models/real/{partner,player}.glb
const fs = require('fs'), vm = require('vm');
const FLOAT = 5126, BYTE = 5120, UBYTE = 5121, USHORT = 5123, UINT = 5125;
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const CSIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

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
// Read an accessor as floats (only plain float / integer accessors without sparse data are expected here).
function readAcc(J, bin, ai) {
  const a = J.accessors[ai], bv = J.bufferViews[a.bufferView], n = NC[a.type], cs = CSIZE[a.componentType];
  const stride = bv.byteStride || n * cs, base = (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Float64Array(a.count * n);
  const rd = { 5126: (o) => bin.readFloatLE(o), 5121: (o) => bin[o], 5123: (o) => bin.readUInt16LE(o), 5125: (o) => bin.readUInt32LE(o), 5120: (o) => bin.readInt8(o), 5122: (o) => bin.readInt16LE(o) }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let j = 0; j < n; j++) out[i * n + j] = rd(base + i * stride + j * cs);
  return { a, n, out };
}

function quantize(glb) {
  const { J, bin } = readGlb(glb);
  const blobs = [];   // new data appended after the existing buffer
  let tail = bin.length;
  const add = (buf, stride, target) => {
    const pad = (4 - (tail % 4)) % 4; if (pad) { blobs.push(Buffer.alloc(pad)); tail += pad; }
    J.bufferViews.push({ buffer: 0, byteOffset: tail, byteLength: buf.length, ...(stride ? { byteStride: stride } : {}), ...(target ? { target } : {}) });
    blobs.push(buf); tail += buf.length; return J.bufferViews.length - 1;
  };
  const stats = { normal: 0, uv: 0, color: 0, weights: 0, index: 0 };
  const done = new Map();   // accessor index -> new accessor index (shared accessors converted once)
  const conv = (ai, kind) => {
    if (done.has(ai)) return done.get(ai);
    const { a, n, out } = readAcc(J, bin, ai);
    if (a.componentType !== FLOAT && kind !== 'index') { done.set(ai, ai); return ai; }
    let na = null;
    if (kind === 'normal' || kind === 'tangent') {
      const st = 4, b = Buffer.alloc(a.count * st);
      for (let i = 0; i < a.count; i++) for (let j = 0; j < n; j++) b.writeInt8(Math.max(-127, Math.min(127, Math.round(out[i * n + j] * 127))), i * st + j);
      na = { bufferView: add(b, st, 34962), componentType: BYTE, normalized: true, count: a.count, type: a.type };
      stats.normal++;
    } else if (kind === 'uv') {
      let ok = true; for (const v of out) if (v < 0 || v > 1) { ok = false; break; }
      if (!ok) { done.set(ai, ai); return ai; }
      const b = Buffer.alloc(a.count * 4);
      for (let i = 0; i < a.count; i++) for (let j = 0; j < 2; j++) b.writeUInt16LE(Math.round(out[i * 2 + j] * 65535), i * 4 + j * 2);
      na = { bufferView: add(b, 0, 34962), componentType: USHORT, normalized: true, count: a.count, type: 'VEC2' };
      stats.uv++;
    } else if (kind === 'color') {
      const st = n === 3 ? 8 : 8, b = Buffer.alloc(a.count * st);
      for (let i = 0; i < a.count; i++) for (let j = 0; j < n; j++) b.writeUInt16LE(Math.round(Math.max(0, Math.min(1, out[i * n + j])) * 65535), i * st + j * 2);
      na = { bufferView: add(b, st, 34962), componentType: USHORT, normalized: true, count: a.count, type: a.type };
      stats.color++;
    } else if (kind === 'weights') {
      const b = Buffer.alloc(a.count * 4);
      for (let i = 0; i < a.count; i++) {
        const w = [0, 1, 2, 3].map((j) => Math.max(0, out[i * 4 + j])), t = w.reduce((s, v) => s + v, 0) || 1;
        const q = w.map((v) => Math.round((v / t) * 255)); let diff = 255 - q.reduce((s, v) => s + v, 0);
        const big = q.indexOf(Math.max(...q)); q[big] = Math.max(0, Math.min(255, q[big] + diff));
        for (let j = 0; j < 4; j++) b[i * 4 + j] = q[j];
      }
      na = { bufferView: add(b, 0, 34962), componentType: UBYTE, normalized: true, count: a.count, type: 'VEC4' };
      stats.weights++;
    } else if (kind === 'index') {
      if (a.componentType !== UINT) { done.set(ai, ai); return ai; }
      let mx = 0; for (const v of out) if (v > mx) mx = v;
      if (mx >= 65535) { done.set(ai, ai); return ai; }
      const b = Buffer.alloc(a.count * 2); for (let i = 0; i < a.count; i++) b.writeUInt16LE(out[i], i * 2);
      na = { bufferView: add(b, 0, 34963), componentType: USHORT, count: a.count, type: 'SCALAR' };
      stats.index++;
    }
    J.accessors.push(na); const ni = J.accessors.length - 1; done.set(ai, ni); return ni;
  };
  for (const m of J.meshes) for (const p of m.primitives) {
    const A = p.attributes;
    for (const k of Object.keys(A)) {
      if (k === 'NORMAL') A[k] = conv(A[k], 'normal');
      else if (k === 'TANGENT') A[k] = conv(A[k], 'tangent');
      else if (/^TEXCOORD_/.test(k)) A[k] = conv(A[k], 'uv');
      else if (k === 'COLOR_0') A[k] = conv(A[k], 'color');
      else if (k === 'WEIGHTS_0') A[k] = conv(A[k], 'weights');
    }
    if (p.indices !== undefined) p.indices = conv(p.indices, 'index');
  }
  // Drop what nothing uses any more: rebuild the buffer from the views still referenced.
  const used = new Set();
  const live = new Set(); J.meshes.forEach((m) => m.primitives.forEach((p) => { Object.values(p.attributes).forEach((a) => live.add(a)); if (p.indices !== undefined) live.add(p.indices); (p.targets || []).forEach((t) => Object.values(t).forEach((a) => live.add(a))); }));
  (J.skins || []).forEach((s) => { if (s.inverseBindMatrices !== undefined) live.add(s.inverseBindMatrices); });
  (J.animations || []).forEach((an) => an.samplers.forEach((s) => { live.add(s.input); live.add(s.output); }));
  J.accessors.forEach((a, i) => { if (live.has(i) && a.bufferView !== undefined) used.add(a.bufferView); });
  (J.images || []).forEach((im) => { if (im.bufferView !== undefined) used.add(im.bufferView); });
  const all = Buffer.concat([bin, ...blobs]);
  const parts = []; let off = 0; const remap = {}, views = [];
  J.bufferViews.forEach((bv, i) => {
    if (!used.has(i)) return;
    const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
    const data = all.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    remap[i] = views.length; views.push({ ...bv, byteOffset: off }); parts.push(data); off += data.length;
  });
  J.accessors.forEach((a, i) => {
    if (a.bufferView === undefined) return;
    if (remap[a.bufferView] === undefined || !live.has(i)) { delete a.bufferView; delete a.byteOffset; a.count = 1; delete a.min; delete a.max; }   // dead: a stub
    else a.bufferView = remap[a.bufferView];
  });
  (J.images || []).forEach((im) => { if (im.bufferView !== undefined) im.bufferView = remap[im.bufferView]; });
  J.bufferViews = views; const nb = Buffer.concat(parts); J.buffers = [{ byteLength: nb.length }];
  J.extensionsUsed = [...new Set([...(J.extensionsUsed || []), 'KHR_mesh_quantization'])];
  J.extensionsRequired = [...new Set([...(J.extensionsRequired || []), 'KHR_mesh_quantization'])];
  return { glb: writeGlb(J, nb), stats };
}

if (require.main === module) {
  // node tools/quantize_glb.js [kids]: the adults (js/models_real.js, models/real/*.glb) or the children (js/models_kids.js;
  // the served kid_*.glb files are meshopt-compressed already and stay as they are).
  const kids = process.argv[2] === 'kids', file = kids ? 'js/models_kids.js' : 'js/models_real.js', v = kids ? 'CBS_REAL_KIDS' : 'CBS_REAL';
  const src = fs.readFileSync(file, 'utf8'); const w = {}; vm.runInNewContext(src, { window: w });
  let s = src; const report = {};
  for (const name of Object.keys(w[v])) {
    const before = Buffer.from(w[v][name], 'base64');
    const { glb, stats } = quantize(before);
    report[name] = { before: before.length, after: glb.length, stats };
    if (!kids) fs.writeFileSync('models/real/' + name + '.glb', glb);
    s = s.replace(new RegExp('(' + name + "\\s*:\\s*['\"])[^'\"]*(['\"])"), (m, a, b) => a + glb.toString('base64') + b);
  }
  fs.writeFileSync(file, s);
  console.log(JSON.stringify(report));
}
module.exports = { quantize };
