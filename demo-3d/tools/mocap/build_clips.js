// Build Snowed In's motion clips (js/mocap.js) from CMU motion capture.
// Data: CMU Graphics Lab Motion Capture Database, mocap.cs.cmu.edu (no restrictions on use),
// via the cgspeed BVH conversion (github.com/Shriinivas/cmubvh).
const fs = require('fs');
const { parseBVH, retarget } = require('./retarget.js');
const KEYS = ['hips', 'hipsPos', 'spine', 'spineW', 'chest', 'neck', 'head', 'sh0', 'sh1', 'el0', 'el1', 'th0', 'th1', 'kn0', 'kn1', 'ft0', 'ft1'];
const load = (f) => parseBVH(fs.readFileSync(__dirname + '/bvh/' + f + '.bvh', 'utf8'));
const seg = (f, a, b, o) => { const B = load(f), fps = Math.round(1 / B.ft); return retarget(B, Math.max(1, Math.round(a * fps)), Math.min(B.frames.length, Math.round(b * fps)), o); };
const isArr = (x) => Array.isArray(x);
const mix = (a, b, t) => (isArr(a) ? a.map((v, i) => mix(v, b[i], t)) : a + (b - a) * t);
// Join clips end to end with crossfades, and close the loop the same way.
function chain(parts, fade) {
  const out = {}; KEYS.forEach((k) => (out[k] = []));
  for (const p of parts) {
    for (const k of KEYS) {
      const A = out[k], Bk = p[k];
      if (!A.length) { A.push(...Bk); continue; }
      const n = Math.min(fade, A.length, Bk.length);
      const tail = A.splice(A.length - n, n);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, s = t * t * (3 - 2 * t); A.push(mix(tail[i], Bk[i], s)); }
      A.push(...Bk.slice(n));
    }
  }
  // Loop: blend the last `fade` frames into the first ones.
  for (const k of KEYS) { const A = out[k], n = Math.min(fade, A.length >> 2); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, s = t * t * (3 - 2 * t); A[A.length - n + i] = mix(A[A.length - n + i], A[i], s); } }
  out.n = out.hips.length; out.fps = 30;
  return out;
}
// One walk cycle: from the right thigh's furthest-forward point to the next, blended so it loops.
function walkCycle(c) {
  // The right foot's forward reach (ankle z in the hips frame is what a thigh swing does; use the thigh's
  // forward angle, smoothed), and its minima at least half a second apart.
  const raw = c.th0.map((e) => e[0]), fwd = raw.map((_, i) => { let s = 0, n = 0; for (let k = -3; k <= 3; k++) { const j = i + k; if (j >= 0 && j < raw.length) { s += raw[j]; n++; } } return s / n; });
  const lo = Math.min(...fwd), hi = Math.max(...fwd), thr = lo + (hi - lo) * 0.3;
  const peaks = []; for (let i = 1; i < fwd.length - 1; i++) if (fwd[i] <= fwd[i - 1] && fwd[i] <= fwd[i + 1] && fwd[i] < thr && (!peaks.length || i - peaks[peaks.length - 1] > 15)) peaks.push(i);
  console.log('thigh fwd range', lo.toFixed(2), hi.toFixed(2), 'peaks', peaks);
  const mid = Math.floor(peaks.length / 2) - 1, a = peaks[Math.max(0, mid)], b = peaks[Math.max(0, mid) + 1];
  const out = { fps: 30 };
  for (const k of KEYS) {
    const A = c[k].slice(a, b + 1); const n = A.length;
    // spread the small end-to-start mismatch along the cycle so it loops without a jump
    const d = mix(A[0], A[n - 1], 1); const err = isArr(A[0]) ? A[0].map((v, i) => v - A[n - 1][i]) : A[0] - A[n - 1];
    out[k] = A.slice(0, n - 1).map((v, i) => (isArr(v) ? v.map((x, j) => x + err[j] * (i / (n - 1))) : v + err * (i / (n - 1))));
  }
  out.n = out.hips.length; out.peaks = [a, b];
  return out;
}
const round = (c) => { const o = { fps: c.fps, n: c.n }; for (const k of KEYS) o[k] = c[k].map((v) => (isArr(v) ? v.map((x) => +x.toFixed(3)) : +v.toFixed(3))); return o; };
const idle = chain([seg('82_08', 0.2, 8.0), seg('40_10', 0.1, 5.4), seg('40_11', 2.5, 5.4), seg('77_02', 0.1, 2.2)], 24);
const sitIdle = chain([seg('86_09', 10.6, 23.2)], 30);
const walk = walkCycle(seg('16_15', 0.1, 3.9, { headingWin: 45 }));
// Standing hip height is the clip's own mean, so the game can scale to each character.
// The recording's rest pose has the head bowed a little: keep the motion, drop the constant offset.
// Waiting for a bus, the subject looks around a lot; here that's calmed to glances.
function unbias(c, keys, scale = {}) {
  for (const k of keys) { const m = [0, 1, 2].map((j) => c[k].reduce((s, v) => s + v[j], 0) / c.n); c[k] = c[k].map((v) => v.map((x, j) => (x - m[j]) * ((scale[k] || [1, 1, 1])[j]))); }
  return c;
}
unbias(idle, ['neck', 'head', 'chest', 'spineW'], { neck: [0.6, 0.45, 0.6], head: [0.7, 0.6, 0.7], spineW: [0.6, 0.7, 0.7] });
unbias(sitIdle, ['neck', 'head', 'chest', 'spineW'], { neck: [0.7, 0.6, 0.7], spineW: [0.6, 0.7, 0.7] });
unbias(walk, ['neck', 'head']);
// This conversion reads every knee about 0.3 rad more bent than it is (a standing knee comes out at ~20°):
// take that off, keeping the shape of the stride.
const kneeMin = Math.min(...walk.kn0, ...walk.kn1), kneeFix = Math.max(0, kneeMin - 0.06);
for (const k of ['kn0', 'kn1']) walk[k] = walk[k].map((v) => Math.max(0.03, v - kneeFix));
console.log('knee offset removed', kneeFix.toFixed(2));
const meanY = (c) => c.hipsPos.reduce((s, v) => s + v[1], 0) / c.n;
const data = { source: 'CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu): 82_08, 40_10, 40_11, 77_02 (idle), 86_09 (seated), 16_15 (walk)', idle: round(idle), walk: round(walk), sit: round(sitIdle), idleY: +meanY(idle).toFixed(3), walkY: +meanY(walk).toFixed(3) };
const js = '/* Motion clips retargeted from motion capture (tools/mocap, build_clips.js). ' + data.source + '. CMU places no restrictions on the use of the data. */\nwindow.CBS_MOCAP = ' + JSON.stringify(data) + ';\n';
fs.writeFileSync(process.argv[2] || 'mocap.js', js);
console.log('idle', idle.n, 'frames', (idle.n / 30).toFixed(1) + 's', 'walk', walk.n, 'frames', walk.peaks, 'sit', sitIdle.n, 'bytes', js.length, 'idleY', data.idleY, 'walkY', data.walkY);
