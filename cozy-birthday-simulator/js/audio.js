'use strict';
/* =========================================================================
 * Procedural audio (Web Audio). No external assets.
 * Ambience layers: pad (home theme), wind, fire, hum, crowd, birds, crackle.
 * ========================================================================= */
const Sound = (() => {
  let ctx = null, master, sfx, amb, mus, noise;
  let enabled = true;
  try { enabled = localStorage.getItem('cbs.sound') !== 'off'; } catch (e) { /* storage unavailable */ }
  const layers = {};
  const pad = { osc: [], idx: 0, t: 0, detune: 0 };
  const CHORDS = [
    [261.63, 329.63, 392.0], [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63], [196.0, 246.94, 293.66],
  ];
  const LEVEL = { pad: 0.32, wind: 0.55, fire: 0.6, hum: 0.22, crowd: 0.2 };
  const target = { pad: 0, wind: 0, fire: 0, hum: 0, crowd: 0, birds: 0, crackle: 0 };

  function g(v, dest) { const n = ctx.createGain(); n.gain.value = v; n.connect(dest); return n; }
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; return s; }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = g(enabled ? 0.9 : 0, ctx.destination);
    sfx = g(0.8, master); amb = g(0.75, master); mus = g(0.55, master);
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Home pad: three soft triangles through a lowpass.
    const pg = g(0, amb);
    const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 820; pf.connect(pg);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = CHORDS[0][i] / 2;
      const og = ctx.createGain(); og.gain.value = 0.13; o.connect(og); og.connect(pf); o.start();
      pad.osc.push(o);
    }
    layers.pad = pg;
    // Wind
    const w = noiseSrc(); const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 450; wf.Q.value = 0.6;
    const wg = g(0, amb); w.connect(wf); wf.connect(wg); w.start(); layers.wind = wg; layers.windF = wf;
    // Fire rumble
    const f = noiseSrc(); const ff = ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 170;
    const fg = g(0, amb); f.connect(ff); ff.connect(fg); f.start(); layers.fire = fg;
    // Hum (two beating sines)
    const hg = g(0, amb);
    [55, 55.7, 110.4].forEach((fq) => { const o = ctx.createOscillator(); o.frequency.value = fq; const og = ctx.createGain(); og.gain.value = 0.3; o.connect(og); og.connect(hg); o.start(); });
    layers.hum = hg;
    // Crowd murmur
    const c = noiseSrc(); const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 650; cf.Q.value = 1.1;
    const cg = g(0, amb); c.connect(cf); cf.connect(cg); c.start(); layers.crowd = cg;
    apply();
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const k of ['pad', 'wind', 'fire', 'hum', 'crowd']) layers[k].gain.setTargetAtTime(target[k] * LEVEL[k], t, 1.1);
  }
  function setAmbience(o) {
    for (const k of Object.keys(target)) target[k] = 0;
    Object.assign(target, o || {});
    apply();
  }
  function setDetune(c) { pad.detune = c; }

  function tone(freq, dur, o = {}) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + (o.when || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const gn = ctx.createGain();
    const v = o.vol == null ? 0.1 : o.vol, a = o.attack || 0.01, r = o.release == null ? 0.25 : o.release;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(v, t + a);
    gn.gain.setValueAtTime(v, t + Math.max(a, dur * 0.6));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    osc.connect(gn);
    let out = gn;
    if (o.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); gn.connect(p); out = p; }
    out.connect(o.dest || sfx);
    osc.start(t); osc.stop(t + dur + r + 0.05);
  }
  function burst(dur, o = {}) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + (o.when || 0);
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
    const gn = ctx.createGain(); const v = o.vol || 0.1;
    gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + 0.005); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gn);
    let out = gn;
    if (o.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; gn.connect(p); out = p; }
    out.connect(o.dest || sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  function chirp() {
    const f = 2100 + Math.random() * 1700, n = 1 + Math.floor(Math.random() * 3), pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < n; i++) tone(f * (1 + Math.random() * 0.08), 0.06, { vol: 0.035, glide: f * 1.35, when: i * 0.12, release: 0.05, pan });
  }
  function crackle() { burst(0.02 + Math.random() * 0.05, { freq: 1400 + Math.random() * 2600, q: 2.5, vol: 0.05 + Math.random() * 0.12 }); }
  function step(surface, soft) {
    const k = soft ? 0.5 : 1;
    if (surface === 'snow') burst(0.11, { type: 'highpass', freq: 2600, q: 0.7, vol: 0.05 * k });
    else if (surface === 'grass') burst(0.06, { freq: 1300, q: 0.6, vol: 0.035 * k });
    else burst(0.05, { freq: 320, q: 1.4, vol: 0.07 * k });
  }
  // The private three-note whistle.
  function whistle(faint, pan) {
    const v = faint ? 0.028 : 0.11;
    const notes = [[1320, 1580], [1580, 1190], [1190, 1490]];
    notes.forEach((n, i) => tone(n[0], 0.26, { vol: v, glide: n[1], when: i * 0.44, release: 0.12, pan: pan == null ? null : pan }));
  }
  function blip() { tone(500 + Math.random() * 70, 0.02, { type: 'triangle', vol: 0.02, release: 0.03 }); }
  function thud() { tone(70, 0.4, { vol: 0.25, glide: 40, release: 0.5 }); burst(0.3, { type: 'lowpass', freq: 200, vol: 0.15 }); }
  function chime() { [880, 1108.7, 1318.5].forEach((f, i) => tone(f, 0.25, { vol: 0.05, when: i * 0.07, release: 0.6, dest: mus })); }
  // Original music-box motif. 'cold' plays it slower, detuned, with one note missing.
  const MOTIF = [659.25, 783.99, 880, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 659.25, 587.33, 523.25];
  function motif(variant) {
    if (!ctx || !enabled) return;
    const cold = variant === 'cold';
    const sp = cold ? 0.55 : 0.4;
    MOTIF.forEach((f, i) => {
      if (cold && i === 7) return;
      const det = cold ? (Math.random() * 30 - 15) : 0;
      tone(f, 0.08, { vol: 0.07, when: i * sp, release: 1.1, detune: det, dest: mus });
      tone(f * 2, 0.05, { vol: 0.015, when: i * sp, release: 0.6, type: 'triangle', detune: det, dest: mus });
    });
  }
  function update(dt) {
    if (!ctx || !enabled) return;
    pad.t -= dt;
    if (pad.t <= 0) {
      pad.t = 7;
      pad.idx = (pad.idx + 1) % CHORDS.length;
      const ch = CHORDS[pad.idx];
      pad.osc.forEach((o, i) => {
        o.frequency.setTargetAtTime(ch[i] / 2, ctx.currentTime, 0.9);
        o.detune.setTargetAtTime(pad.detune * (i - 1), ctx.currentTime, 2);
      });
    }
    layers.windF.frequency.setTargetAtTime(330 + Math.sin(performance.now() / 2300) * 190, ctx.currentTime, 0.6);
    if (target.birds > 0 && Math.random() < dt * 0.7 * target.birds) chirp();
    if (target.crackle > 0 && Math.random() < dt * 9 * target.crackle) crackle();
  }
  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem('cbs.sound', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(enabled ? 0.9 : 0, ctx.currentTime, 0.1);
    return enabled;
  }
  return {
    init, resume, setAmbience, setDetune, update, tone, burst, step, whistle, blip, thud, chime, motif, toggle,
    get enabled() { return enabled; },
  };
})();
