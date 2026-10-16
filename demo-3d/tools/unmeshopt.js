// Decode a meshopt-compressed GLB (EXT_meshopt_compression) into a plain one, so it loads without WebAssembly.
// Usage: node tools/unmeshopt.js in.glb out.glb
const fs = require('fs');
const MeshoptDecoder = require('../lib/meshopt_decoder.js');
(async () => {
  await MeshoptDecoder.ready;
  const [inp, out] = process.argv.slice(2);
  const b = fs.readFileSync(inp);
  const jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString());
  let off = 20 + jl; const bl = b.readUInt32LE(off); const bin = b.slice(off + 8, off + 8 + bl);
  // Rebuild one binary buffer: every view's bytes, decoded where compressed.
  const chunks = []; let pos = 0;
  const views = json.bufferViews.map((v) => {
    const ext = v.extensions && v.extensions.EXT_meshopt_compression;
    let data;
    if (ext) {
      const src = new Uint8Array(bin.buffer, bin.byteOffset + (ext.byteOffset || 0), ext.byteLength);
      const dst = new Uint8Array(ext.count * ext.byteStride);
      MeshoptDecoder.decodeGltfBuffer(dst, ext.count, ext.byteStride, src, ext.mode, ext.filter || 'NONE');
      data = Buffer.from(dst.buffer);
    } else if (v.buffer === 0 || json.buffers[v.buffer].byteLength) {
      data = bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    }
    return { v, data, ext };
  });
  const nv = [];
  for (const { v, data, ext } of views) {
    const pad = (4 - (pos % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); pos += pad; }
    const o = { buffer: 0, byteOffset: pos, byteLength: data.length };
    if (ext ? ext.byteStride && ext.mode === 'ATTRIBUTES' : v.byteStride) o.byteStride = ext ? ext.byteStride : v.byteStride;
    if (v.target) o.target = v.target;
    if (v.name) o.name = v.name;
    chunks.push(data); pos += data.length; nv.push(o);
  }
  const pad = (4 - (pos % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); pos += pad; }
  json.bufferViews = nv;
  json.buffers = [{ byteLength: pos }];
  const drop = (a) => a && a.filter((e) => e !== 'EXT_meshopt_compression' && e !== 'KHR_meshopt_compression');
  json.extensionsUsed = drop(json.extensionsUsed); json.extensionsRequired = drop(json.extensionsRequired);
  if (json.extensionsRequired && !json.extensionsRequired.length) delete json.extensionsRequired;
  let js = Buffer.from(JSON.stringify(json)); const jp = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  const binAll = Buffer.concat(chunks);
  const hdr = Buffer.alloc(12); hdr.write('glTF', 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(12 + 8 + js.length + 8 + binAll.length, 8);
  const c0 = Buffer.alloc(8); c0.writeUInt32LE(js.length, 0); c0.write('JSON', 4);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(binAll.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(out, Buffer.concat([hdr, c0, js, c1, binAll]));
  console.log(out, fs.statSync(out).size, 'used', json.extensionsUsed, 'buffers before', JSON.parse(b.slice(20, 20 + jl).toString()).buffers);
})();
