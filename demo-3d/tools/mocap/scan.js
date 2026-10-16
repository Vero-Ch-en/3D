const { parseBVH, pose } = require('./retarget.js'); const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const B = parseBVH(fs.readFileSync('bvh/' + f + '.bvh', 'utf8')); const fps = Math.round(1 / B.ft);
  const rows = [];
  for (let s = 1; s + fps < B.frames.length; s += Math.round(fps / 2)) {
    const a = pose(B, B.frames[s]).P.Hips, b = pose(B, B.frames[Math.min(B.frames.length - 1, s + Math.round(fps / 2))]).P.Hips;
    rows.push(`${(s / fps).toFixed(1)}s v${(Math.hypot(b.x - a.x, b.z - a.z) * 2 * 0.0254 * 1.0 / 0.45).toFixed(2)} h${a.y.toFixed(1)}`);
  }
  console.log(f, rows.join(' | '));
}
