// Retarget CMU motion capture (BVH, cgspeed conversion) onto Snowed In's procedural rig.
// The rig: hips → spine → chest → neck → head; chest → sh → el (→ hand); hips → th → kn → ft.
// At rest every joint is unrotated, limbs hanging straight down, facing +z (same axes as the BVH).
// Limbs are matched by direction (so the BVH's T-pose rest doesn't matter); the torso and head by
// rotation relative to their parent. Output: Euler XYZ angles per joint, 30 frames a second.
const THREE = require('../../lib/three.min.js');
const fs = require('fs');
const { Quaternion: Q, Vector3: V, Euler: E, Matrix4: M } = THREE;

function parseBVH(text) {
  const lines = text.split(/\r?\n/);
  const joints = []; const stack = []; let i = 0, cur = null;
  for (; i < lines.length; i++) {
    const t = lines[i].trim(); if (!t) continue;
    const w = t.split(/\s+/);
    if (w[0] === 'ROOT' || w[0] === 'JOINT') { cur = { name: w[1], parent: stack.length ? stack[stack.length - 1] : null, offset: null, channels: [] }; joints.push(cur); }
    else if (w[0] === 'End') { cur = { name: (stack[stack.length - 1].name) + '_end', parent: stack[stack.length - 1], offset: null, channels: [], end: true }; joints.push(cur); }
    else if (w[0] === '{') stack.push(cur);
    else if (w[0] === '}') stack.pop();
    else if (w[0] === 'OFFSET') cur.offset = new V(+w[1], +w[2], +w[3]);
    else if (w[0] === 'CHANNELS') cur.channels = w.slice(2, 2 + +w[1]);
    else if (w[0] === 'MOTION') { i++; break; }
  }
  const nF = +lines[i].split(/\s+/)[1]; const ft = +lines[i + 1].split(/\s+/)[2];
  const frames = [];
  for (let f = 0; f < nF; f++) frames.push(lines[i + 2 + f].trim().split(/\s+/).map(Number));
  let c = 0; for (const j of joints) { j.c0 = c; c += j.channels.length; }
  return { joints, frames, ft, by: Object.fromEntries(joints.map((j) => [j.name, j])) };
}
const D2R = Math.PI / 180;
function pose(B, fr) {
  // world position and rotation of every joint for one frame
  const P = {}, R = {};
  for (const j of B.joints) {
    const loc = new Q(), pos = j.offset.clone();
    for (let k = 0; k < j.channels.length; k++) {
      const ch = j.channels[k], v = fr[j.c0 + k];
      if (ch === 'Xposition') pos.x = v; else if (ch === 'Yposition') pos.y = v; else if (ch === 'Zposition') pos.z = v;
      else { const ax = ch[0] === 'X' ? new V(1, 0, 0) : ch[0] === 'Y' ? new V(0, 1, 0) : new V(0, 0, 1); loc.multiply(new Q().setFromAxisAngle(ax, v * D2R)); }
    }
    if (!j.parent) { R[j.name] = loc; P[j.name] = pos; }
    else { R[j.name] = R[j.parent.name].clone().multiply(loc); P[j.name] = pos.applyQuaternion(R[j.parent.name]).add(P[j.parent.name]); }
  }
  return { P, R };
}
const DOWN = new V(0, -1, 0);
const eul = (q) => { const e = new E().setFromQuaternion(q, 'XYZ'); return [e.x, e.y, e.z]; };
// Swing the limb from straight down onto d1 (parent-local), then twist about it so it bends toward d2.
function limb(d1, d2, bendSign) {
  const q1 = new Q().setFromUnitVectors(DOWN, d1.clone().normalize());
  const d2s = d2.clone().normalize().applyQuaternion(q1.clone().invert());
  const bend = Math.acos(Math.max(-1, Math.min(1, d2s.dot(DOWN))));
  const px = d2s.x * bendSign, pz = d2s.z * bendSign;
  let a = Math.atan2(px, pz);
  const conf = Math.min(1, Math.max(0, (bend - 0.05) / 0.25));   // a straight limb has no bend plane
  a *= conf;
  const q = q1.clone().multiply(new Q().setFromAxisAngle(new V(0, 1, 0), a));
  return { q, bend };
}
function retarget(B, from, to, opts = {}) {
  const step = Math.max(1, Math.round((1 / 30) / B.ft));
  const out = { fps: Math.round(1 / (B.ft * step)), n: 0, spineW: [], hips: [], hipsPos: [], spine: [], chest: [], neck: [], head: [], sh0: [], sh1: [], el0: [], el1: [], th0: [], th1: [], kn0: [], kn1: [], ft0: [], ft1: [] };
  const rest = pose(B, B.frames[0].map(() => 0));
  const legLen = rest.P.LeftUpLeg.distanceTo(rest.P.LeftLeg) + rest.P.LeftLeg.distanceTo(rest.P.LeftFoot) + Math.abs(rest.P.LeftFoot.y - rest.P.LeftToeBase.y);
  const hip0 = rest.P.Hips.y - Math.min(rest.P.LeftToeBase.y, rest.P.LeftFoot.y);
  const toeRest = rest.P.LeftToeBase.clone().sub(rest.P.LeftFoot); const toePitch0 = Math.atan2(-toeRest.y, toeRest.z);
  // Heading: smoothed facing of the hips, so the walk's own hip twist survives.
  const frames = []; for (let f = from; f < to; f += step) frames.push(pose(B, B.frames[f]));
  const yaw = frames.map((p) => { const fw = new V(0, 0, 1).applyQuaternion(p.R.Hips); return Math.atan2(fw.x, fw.z); });
  for (let i = 1; i < yaw.length; i++) { while (yaw[i] - yaw[i - 1] > Math.PI) yaw[i] -= 2 * Math.PI; while (yaw[i] - yaw[i - 1] < -Math.PI) yaw[i] += 2 * Math.PI; }
  const win = opts.headingWin || 30, sm = yaw.map((_, i) => { let s = 0, n = 0; for (let k = -win; k <= win; k++) { const j = i + k; if (j >= 0 && j < yaw.length) { s += yaw[j]; n++; } } return s / n; });
  const px = frames.map((p) => p.P.Hips.x), pz = frames.map((p) => p.P.Hips.z);
  const avg = (a, i, w) => { let s = 0, n = 0; for (let k = -w; k <= w; k++) { const j = i + k; if (j >= 0 && j < a.length) { s += a[j]; n++; } } return s / n; };
  frames.forEach((p, i) => {
    const H = new Q().setFromAxisAngle(new V(0, 1, 0), -sm[i]);   // undo heading
    const Rw = (n) => H.clone().multiply(p.R[n]);
    const Pw = (n) => p.P[n].clone().applyQuaternion(H);
    const hips = Rw('Hips');
    out.hips.push(eul(hips));
    // Hip position: height relative to standing, sideways/forward sway about the smoothed path (rig local).
    const off = new V(p.P.Hips.x - avg(px, i, win), 0, p.P.Hips.z - avg(pz, i, win)).applyQuaternion(H);
    const ground = opts.ground != null ? opts.ground : 0;
    out.hipsPos.push([off.x / legLen, (p.P.Hips.y - ground) / hip0, off.z / legLen]);
    const rel = (a, b) => p.R[a].clone().invert().multiply(p.R[b]);
    out.spine.push(eul(rel('Hips', 'Spine')));
    out.spineW.push(eul(hips.clone().multiply(rel('Hips', 'Spine'))));   // the spine against the upright body (no pelvis)
    out.chest.push(eul(rel('Spine', 'Spine1')));
    out.neck.push(eul(rel('Spine1', 'Neck1')));
    out.head.push(eul(rel('Neck1', 'Head')));
    const chestW = Rw('Spine1'), chestI = chestW.clone().invert(), hipsI = hips.clone().invert();
    [['Right', 0], ['Left', 1]].forEach(([S, k]) => {
      const a = Pw(S + 'Arm'), b = Pw(S + 'ForeArm'), c = Pw(S + 'Hand');
      const A = limb(b.clone().sub(a).applyQuaternion(chestI), c.clone().sub(b).applyQuaternion(chestI), 1);   // elbows bend forward
      out['sh' + k].push(eul(A.q)); out['el' + k].push(-A.bend);
      const u = Pw(S + 'UpLeg'), kn = Pw(S + 'Leg'), ft = Pw(S + 'Foot'), toe = Pw(S + 'ToeBase');
      // Legs: knees are hinges, so measure them front-to-back only (this conversion has the shins kinked
      // sideways at the knee); the hip keeps a little of its own sideways spread.
      const d1 = kn.clone().sub(u).applyQuaternion(hipsI), d2 = ft.clone().sub(kn).applyQuaternion(hipsI);
      const side = Math.max(-0.12, Math.min(0.12, Math.atan2(d1.x, -d1.y)));
      const p1 = Math.atan2(-d1.z, -d1.y), p2 = Math.atan2(-d2.z, -d2.y);   // pitch of thigh and shin (forward is negative x rotation)
      const qT = new Q().setFromEuler(new E(p1, 0, side, 'XYZ'));
      const L = { q: qT, bend: Math.max(0, p2 - p1) };
      out['th' + k].push(eul(L.q)); out['kn' + k].push(L.bend);
      // Foot pitch, in the shin's frame.
      const shinQ = hips.clone().multiply(L.q).multiply(new Q().setFromAxisAngle(new V(1, 0, 0), L.bend));
      const d3 = toe.clone().sub(ft).applyQuaternion(shinQ.clone().invert());
      out['ft' + k].push(Math.atan2(-d3.y, d3.z) - toePitch0);
    });
    out.n++;
  });
  return out;
}
module.exports = { parseBVH, pose, retarget };
if (require.main === module) {
  const [file, a, b] = process.argv.slice(2);
  const B = parseBVH(fs.readFileSync(file, 'utf8'));
  console.log(file, 'frames', B.frames.length, 'ft', B.ft);
  const r = retarget(B, +(a || 0), Math.min(B.frames.length, +(b || 600)));
  const s = (arr) => arr.slice(0, 5).map((x) => (Array.isArray(x) ? x.map((v) => v.toFixed(2)).join('/') : x.toFixed(2))).join(' ');
  for (const k of ['hipsPos', 'hips', 'spine', 'sh0', 'el0', 'th0', 'kn0', 'ft0']) console.log(k, s(r[k]));
}
