/* All sound is synthesized live with the Web Audio API - no audio files.
   Everything runs through a stereo panner + a shared outdoor reverb so gunshots echo through the trees and ducks sound like they are where they are. */
(function (G) {
  'use strict';
  const S = G.settings;
  const A = { ctx: null, ready: false, sfx: {} };
  let master, sfxBus, musicBus, ambBus, revIn, noiseBuf, voices = 0;
  let rainG, rainF, windG, windF;
  const last = {};
  const R = Math.random;

  function gate(name, ms) {
    const now = performance.now();
    if (now - (last[name] || 0) < ms) return false;
    last[name] = now;
    return true;
  }

  A.init = function () {
    if (A.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { return; }
    const ctx = A.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); sfxBus = ctx.createGain(); musicBus = ctx.createGain(); ambBus = ctx.createGain();
    sfxBus.connect(master); musicBus.connect(master); ambBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = R() * 2 - 1;
    /* shared reverb: decaying, darkening stereo noise impulse */
    const rl = Math.floor(ctx.sampleRate * 1.7), ir = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < rl; i++) { const t = i / rl; lp += ((R() * 2 - 1) - lp) * (0.55 - 0.45 * t); ch[i] = lp * Math.pow(1 - t, 2.4) * (i < 900 ? i / 900 : 1); }
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    revIn = ctx.createGain(); const revOut = ctx.createGain(); revOut.gain.value = 0.7;
    revIn.connect(conv); conv.connect(revOut); revOut.connect(master);
    A.applyVolumes();
    A.ready = true;
    initAmbient();
  };
  A.resume = function () {
    A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };
  A.applyVolumes = function () {
    if (!A.ctx) return;
    master.gain.value = S.master * 1.7;
    sfxBus.gain.value = S.sfx;
    musicBus.gain.value = S.music * 0.5;
    ambBus.gain.value = S.ambient;
  };

  /* ---------- primitives: o.pan (-1..1), o.rev (reverb send 0..1) ---------- */
  function route(node, o, bus) {
    const ctx = A.ctx;
    let out = node;
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); out.connect(p); out = p; }
    out.connect(bus || o.bus || sfxBus);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; out.connect(s); s.connect(revIn); }
  }
  function tone(o) {
    if (!A.ready || voices > 90) return;
    const ctx = A.ctx, t = o.at !== undefined ? o.at : ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + o.dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.2 : o.vol, t + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    if (o.formant) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.formant; f.Q.value = o.fq || 4; osc.connect(f); f.connect(g); } else osc.connect(g);
    route(g, o);
    osc.start(t); osc.stop(t + o.dur + 0.04);
    voices++;
    osc.onended = () => { voices--; g.disconnect(); };
  }
  function noise(o) {
    if (!A.ready || voices > 90) return;
    const ctx = A.ctx, t = o.at !== undefined ? o.at : ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    if (o.q) f.Q.value = o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.25 : o.vol, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); route(g, o);
    src.start(t, R() * 1.5); src.stop(t + o.dur + 0.04);
    voices++;
    src.onended = () => { voices--; g.disconnect(); };
  }
  /* a resonant "metal" tick: noise rung through a very narrow band */
  function ping(o) { noise({ type: 'bandpass', f0: o.f, q: o.q || 25, dur: o.dur || 0.07, vol: o.vol || 0.3, attack: 0.001, delay: o.delay, pan: o.pan, rev: o.rev }); }
  /* a throat: sawtooth glottal source through three vowel formants */
  function voice(o) {
    if (!A.ready || voices > 90) return;
    const ctx = A.ctx, t = ctx.currentTime + (o.delay || 0), dur = o.dur;
    const osc = ctx.createOscillator(), g = ctx.createGain(), mixg = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(o.f0, t); osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1 || o.f0), t + dur);
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib ? o.vib[0] : 6; lg.gain.value = o.vib ? o.vib[1] : o.f0 * 0.015; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05);
    (o.formants || [[800, 6, 1], [1300, 8, 0.6], [2600, 10, 0.3]]).forEach((fm) => {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fm[0]; f.Q.value = fm[1];
      const fg = ctx.createGain(); fg.gain.value = fm[2]; osc.connect(f); f.connect(fg); fg.connect(mixg);
    });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime((o.vol || 0.3) * 1.9, t + (o.attack || 0.012)); g.gain.setValueAtTime((o.vol || 0.3) * 1.9, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    mixg.gain.value = 1; mixg.connect(g); route(g, o);
    osc.start(t); osc.stop(t + dur + 0.05);
    voices++; osc.onended = () => { voices--; g.disconnect(); };
    if (o.breath) noise({ type: 'bandpass', f0: o.breath, q: 0.9, dur: Math.min(0.06, dur), vol: (o.vol || 0.3) * 0.5, attack: 0.004, delay: o.delay, pan: o.pan });
  }
  A.tone = tone; A.noise = noise;
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const panOf = (x) => (x === undefined ? 0 : Math.max(-0.9, Math.min(0.9, (x / 960) * 2 - 1)));

  /* ---------- sound effects ---------- */
  const X = A.sfx;
  X.shot = () => {
    if (!A.ready) return;
    noise({ type: 'highpass', f0: 1800, dur: 0.035, vol: 0.7, attack: 0.001, rev: 0.5 });                 /* the crack */
    noise({ type: 'bandpass', f0: 2600, f1: 420, q: 0.7, dur: 0.16, vol: 0.55, attack: 0.001, rev: 0.45 });
    noise({ type: 'lowpass', f0: 1200, f1: 110, dur: 0.3, vol: 0.5, attack: 0.002, rev: 0.4 });           /* the blast body */
    tone({ type: 'sine', f0: 190, f1: 38, dur: 0.28, vol: 0.62, attack: 0.001 });                         /* chest thump */
    tone({ type: 'sawtooth', f0: 900, f1: 120, dur: 0.07, vol: 0.12, attack: 0.001 });
    noise({ type: 'lowpass', f0: 700, f1: 90, dur: 1.1, vol: 0.2, attack: 0.04, delay: 0.05, rev: 1 });    /* echo down the forest */
    ping({ f: 3200, q: 14, dur: 0.05, vol: 0.18, delay: 0.1 });                                            /* mechanism ratchet */
  };
  X.dry = () => { ping({ f: 2800, q: 18, dur: 0.045, vol: 0.4 }); noise({ type: 'highpass', f0: 2500, dur: 0.02, vol: 0.2 }); tone({ type: 'sine', f0: 240, f1: 130, dur: 0.05, vol: 0.2 }); ping({ f: 2100, q: 12, dur: 0.04, vol: 0.18, delay: 0.07 }); };
  X.reload = (dur) => {                                                                                    /* mag out - rack back - mag in - rack forward */
    dur = dur || 0.85;
    ping({ f: 1900, q: 20, dur: 0.06, vol: 0.4 }); tone({ type: 'sine', f0: 230, f1: 120, dur: 0.07, vol: 0.28 });                                      /* release click */
    noise({ type: 'bandpass', f0: 900, f1: 2800, q: 2.2, dur: dur * 0.2, vol: 0.2, attack: 0.02, delay: dur * 0.12 });                                   /* slide back */
    ping({ f: 1300, q: 14, dur: 0.08, vol: 0.35, delay: dur * 0.32 }); tone({ type: 'sine', f0: 180, f1: 90, dur: 0.06, vol: 0.2, delay: dur * 0.32 });  /* stop */
    ping({ f: 2400, q: 22, dur: 0.07, vol: 0.5, delay: dur * 0.5 }); ping({ f: 3600, q: 22, dur: 0.05, vol: 0.3, delay: dur * 0.5 });                    /* mag seated */
    tone({ type: 'sine', f0: 140, f1: 70, dur: 0.1, vol: 0.4, delay: dur * 0.5 });
    noise({ type: 'bandpass', f0: 3000, f1: 1000, q: 2.2, dur: dur * 0.16, vol: 0.2, attack: 0.02, delay: dur * 0.62 });                                 /* slide forward */
    ping({ f: 2000, q: 18, dur: 0.09, vol: 0.55, delay: dur - 0.1 }); ping({ f: 1200, q: 10, dur: 0.12, vol: 0.35, delay: dur - 0.1 });
    tone({ type: 'sine', f0: 160, f1: 60, dur: 0.12, vol: 0.4, delay: dur - 0.1 });                                                                      /* chk-chk */
  };
  X.quack = (p, x) => {
    if (!gate('quack', 55)) return;
    p = p || 1; const pan = panOf(x), f = 330 * p;
    for (let i = 0; i < (R() < 0.35 ? 2 : 1); i++) {                                                       /* nasal, buzzy, quick pitch drop; sometimes a double */
      const d = i * 0.19;
      voice({ f0: f * 1.25, f1: f * 0.72, dur: 0.15, vol: 0.34, vib: [58, f * 0.05], delay: d, pan, rev: 0.12, formants: [[780, 7, 1], [2100, 9, 0.9], [3300, 8, 0.4]], attack: 0.006 });
      noise({ type: 'bandpass', f0: 1800, q: 1.4, dur: 0.12, vol: 0.12, delay: d, pan });
    }
  };
  X.flap = (pan, v) => {                                                                                   /* one down-beat: a soft "fwup" of air + feather rustle */
    if (!gate('flap', 30)) return;
    v = v === undefined ? 1 : v;
    noise({ type: 'bandpass', f0: 520, f1: 210, q: 0.8, dur: 0.085, vol: 0.5 * v, attack: 0.018, pan });
    noise({ type: 'highpass', f0: 3200, dur: 0.06, vol: 0.1 * v, attack: 0.01, pan });
    tone({ type: 'sine', f0: 95, f1: 60, dur: 0.07, vol: 0.14 * v, attack: 0.01, pan });
  };
  X.hit = (x) => {
    const pan = panOf(x);
    noise({ type: 'bandpass', f0: 1500, f1: 350, q: 0.9, dur: 0.1, vol: 0.5, attack: 0.001, pan });         /* thwack */
    tone({ type: 'triangle', f0: 260, f1: 70, dur: 0.12, vol: 0.45, attack: 0.001, pan });
    noise({ type: 'highpass', f0: 2500, dur: 0.35, vol: 0.16, attack: 0.01, delay: 0.03, pan });             /* feather poof */
    voice({ f0: 760, f1: 280, dur: 0.26, vol: 0.34, vib: [46, 40], delay: 0.05, pan, rev: 0.15, formants: [[820, 7, 1], [2000, 9, 0.8], [3100, 8, 0.3]] });      /* squawk */
  };
  X.fall = (dur) => {
    dur = dur || 0.7;
    tone({ type: 'sine', f0: 1500, f1: 240, dur, vol: 0.13, vib: [7, 30], attack: 0.02 });
    tone({ type: 'triangle', f0: 750, f1: 120, dur, vol: 0.05, vib: [7, 15], attack: 0.02 });
  };
  X.thud = () => {
    noise({ type: 'lowpass', f0: 420, f1: 80, dur: 0.2, vol: 0.6, attack: 0.001 });
    tone({ type: 'sine', f0: 100, f1: 42, dur: 0.18, vol: 0.55, attack: 0.001 });
    noise({ type: 'highpass', f0: 2200, dur: 0.22, vol: 0.12, attack: 0.01, delay: 0.02 });                  /* grass rustle */
    for (let i = 0; i < 3; i++) tone({ type: 'sine', f0: 1500 + R() * 800, f1: 500, dur: 0.03, vol: 0.03, delay: 0.04 + i * 0.03 });
  };
  X.escape = () => {
    for (let i = 0; i < 6; i++) { const t = i * (0.07 + i * 0.012); noise({ type: 'bandpass', f0: 600 - i * 40, f1: 250, q: 0.8, dur: 0.075, vol: 0.45 * (1 - i * 0.1), attack: 0.015, delay: t, pan: (i % 2 ? 0.4 : -0.4) }); }
    voice({ f0: 520, f1: 760, dur: 0.18, vol: 0.2, vib: [50, 20], delay: 0.1, formants: [[780, 7, 1], [2100, 9, 0.9]] });
  };
  X.sniff = () => {                                                                                         /* two wet nose sniffs and a pair of soft paw taps */
    noise({ type: 'bandpass', f0: 1800, f1: 3800, q: 1.4, dur: 0.09, vol: 0.4, attack: 0.02 });
    noise({ type: 'bandpass', f0: 2000, f1: 4200, q: 1.4, dur: 0.08, vol: 0.36, attack: 0.02, delay: 0.12 });
    tone({ type: 'sine', f0: 120, f1: 70, dur: 0.05, vol: 0.12, delay: 0.03 }); tone({ type: 'sine', f0: 115, f1: 66, dur: 0.05, vol: 0.12, delay: 0.17 });
  };
  X.alert = () => {                                                                                         /* "huh!" */
    voice({ f0: 330, f1: 520, dur: 0.16, vol: 0.34, vib: [8, 6], breath: 2500, formants: [[560, 6, 1], [1000, 8, 0.6], [2500, 9, 0.2]] });
    tone({ type: 'square', f0: 1320, f1: 1760, dur: 0.07, vol: 0.06, delay: 0.02 });
  };
  X.jump = () => {
    noise({ type: 'bandpass', f0: 350, f1: 1700, q: 1.2, dur: 0.28, vol: 0.22, attack: 0.05 });
    tone({ type: 'sine', f0: 210, f1: 560, dur: 0.22, vol: 0.22, vib: [20, 25], attack: 0.01 });
  };
  X.pop = () => {
    noise({ type: 'bandpass', f0: 2400, f1: 900, q: 0.8, dur: 0.18, vol: 0.18, attack: 0.02 });             /* grass parting */
    tone({ type: 'sine', f0: 170, f1: 640, dur: 0.12, vol: 0.34, attack: 0.004 });
    tone({ type: 'sine', f0: 340, f1: 1280, dur: 0.07, vol: 0.12, attack: 0.004 });
  };
  X.laugh = (v) => {                                                                                        /* a cackle: breathy "ha"s that speed up, a wheezing inhale, then a rapid chitter */
    if (!A.ready) return;
    v = v || 0;
    const base = [430, 480, 400][v % 3], vow = [[[840, 6, 1], [1250, 8, 0.7], [2700, 10, 0.3]], [[780, 6, 1], [1400, 8, 0.7], [2600, 10, 0.3]]];
    let t = 0, gap = 0.17;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const up = i % 2 === 0, f = base * (up ? 1.1 : 0.92) * (1 + Math.sin(i * 0.9) * 0.04);
      voice({ f0: f * 1.22, f1: f * 0.8, dur: 0.1 - i * 0.002, vol: 0.46 * (1 - i * 0.035), delay: t, breath: 3000, vib: [9, f * 0.01], formants: vow[i % 2], attack: 0.01 });
      t += gap; gap = Math.max(0.1, gap - 0.008);
    }
    noise({ type: 'bandpass', f0: 1200, f1: 3400, q: 1.3, dur: 0.26, vol: 0.2, attack: 0.1, delay: t + 0.02 });                                           /* wheeze in */
    for (let i = 0; i < 3; i++) voice({ f0: base * 2.4, f1: base * 3.1, dur: 0.07, vol: 0.2, delay: t + 0.32 + i * 0.11, vib: [30, 20], formants: [[1900, 8, 1], [3000, 9, 0.6]] });   /* hee hee */
    for (let i = 0; i < 9; i++) tone({ type: 'sawtooth', f0: 1700 + R() * 300, f1: 1200, dur: 0.035, vol: 0.09, delay: t + 0.72 + i * 0.058, formant: 2100, fq: 5 });                 /* chitter */
  };
  X.blip = () => tone({ type: 'square', f0: 660, f1: 880, dur: 0.05, vol: 0.12 });
  X.select = () => { tone({ type: 'square', f0: 520, f1: 780, dur: 0.07, vol: 0.14 }); tone({ type: 'square', f0: 780, f1: 1040, dur: 0.08, vol: 0.14, delay: 0.07 }); };
  X.start = () => X.fanfare([67, 71, 74, 79], 0.1);
  X.fanfare = (notes, step) => { notes.forEach((n, i) => tone({ type: 'square', f0: NOTE(n), dur: (step || 0.12) * 1.5, vol: 0.18, delay: i * (step || 0.12) })); };
  X.round = () => { [72, 76, 79, 84].forEach((n, i) => { tone({ type: 'square', f0: NOTE(n), dur: 0.13, vol: 0.15, delay: i * 0.09 }); tone({ type: 'triangle', f0: NOTE(n - 12), dur: 0.14, vol: 0.2, delay: i * 0.09 }); }); };
  X.clear = () => { [67, 72, 76, 79, 76, 79, 84].forEach((n, i) => { tone({ type: 'square', f0: NOTE(n), dur: 0.18, vol: 0.16, delay: i * 0.13 }); tone({ type: 'triangle', f0: NOTE(n - 12), dur: 0.2, vol: 0.2, delay: i * 0.13 }); }); };
  X.perfect = () => { [72, 76, 79, 84, 88, 91, 96, 91, 96].forEach((n, i) => { tone({ type: 'square', f0: NOTE(n), dur: 0.14, vol: 0.15, delay: i * 0.085 }); tone({ type: 'triangle', f0: NOTE(n - 12), dur: 0.16, vol: 0.2, delay: i * 0.085 }); }); noise({ type: 'highpass', f0: 5000, dur: 0.6, vol: 0.12, delay: 0.5 }); };
  X.over = () => { [67, 66, 65, 64, 62, 60, 55].forEach((n, i) => { tone({ type: 'sawtooth', f0: NOTE(n), f1: NOTE(n) * 0.97, dur: 0.3, vol: 0.16, formant: 900, fq: 1.5, delay: i * 0.22 }); }); };
  X.bonus = () => { for (let i = 0; i < 5; i++) tone({ type: 'square', f0: NOTE(84 + i * 2), dur: 0.07, vol: 0.12, delay: i * 0.05 }); };
  X.thunder = (delay) => {
    if (!A.ready) return;
    const d = delay || 0;
    noise({ type: 'bandpass', f0: 1400, f1: 300, q: 0.5, dur: 0.35, vol: 0.5, attack: 0.002, delay: d, bus: ambBus, rev: 0.6 });                      /* crack */
    noise({ type: 'lowpass', f0: 520, f1: 55, dur: 3.0, vol: 0.9, attack: 0.08, delay: d + 0.05, bus: ambBus, rev: 0.8 });
    noise({ type: 'lowpass', f0: 260, f1: 45, dur: 3.6, vol: 0.7, attack: 0.5, delay: d + 0.4, bus: ambBus, rev: 1 });
    tone({ type: 'sine', f0: 62, f1: 34, dur: 2.2, vol: 0.5, attack: 0.15, delay: d + 0.1, bus: ambBus });
  };
  X.meteor = () => { noise({ type: 'bandpass', f0: 6000, f1: 900, q: 2, dur: 0.8, vol: 0.05, attack: 0.1, bus: ambBus }); };

  /* ---------- ambient bed: wind, rain, crickets by night, odd birdsong by day ---------- */
  function loopNoise(freq, type, q) {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(ambBus); src.start(0, R());
    return { g, f };
  }
  function initAmbient() {
    const r = loopNoise(3200, 'bandpass', 0.5); rainG = r.g; rainF = r.f;
    const w = loopNoise(420, 'lowpass', 0.7); windG = w.g; windF = w.f;
  }
  let cT = 0, bT = 0, cricketPhase = 0;
  A.ambient = function (dt, st) {
    if (!A.ready) return;
    const t = A.ctx.currentTime, rain = Math.min(1, st.rain + st.storm * 1.2);
    rainG.gain.setTargetAtTime(rain * 0.32, t, 0.4);
    rainF.frequency.setTargetAtTime(2400 + st.storm * 1800, t, 0.5);
    windG.gain.setTargetAtTime(Math.min(0.5, Math.abs(st.wind) * 0.3 + st.snow * 0.08), t, 0.5);
    windF.frequency.setTargetAtTime(260 + Math.abs(st.wind) * 500, t, 0.5);
    cT -= dt; bT -= dt;
    if (st.night > 0.4 && rain < 0.5 && cT <= 0) {
      cT = 0.38 + R() * 0.15;
      const v = 0.018 * st.night * (1 - rain), f = 4100 + Math.sin(cricketPhase += 0.4) * 160;
      for (let i = 0; i < 4; i++) tone({ type: 'sine', f0: f, f1: f * 1.02, dur: 0.035, vol: v, delay: i * 0.055, bus: ambBus, pan: Math.sin(cricketPhase) * 0.6 });
    }
    if (st.day > 0.5 && rain < 0.3 && bT <= 0) {
      bT = 2 + R() * 5;
      const f = 2300 + R() * 1500, n = 2 + Math.floor(R() * 3), pan = R() * 1.6 - 0.8;
      for (let i = 0; i < n; i++) tone({ type: 'sine', f0: f * (1 + i * 0.12), f1: f * (1.4 + i * 0.1), dur: 0.09, vol: 0.028, delay: i * 0.13, bus: ambBus, pan, rev: 0.2 });
    }
  };

  /* ---------- tiny title tune (chiptune, looped) ---------- */
  let mTimer = 0, mStep = 0, mPlaying = false;
  const MEL = [67, 0, 71, 74, 0, 71, 69, 0, 67, 0, 62, 64, 66, 0, 67, 0, 69, 0, 72, 76, 0, 72, 71, 0, 69, 0, 64, 66, 67, 0, 0, 0];
  const BASS = [43, 43, 50, 50, 43, 43, 50, 50, 41, 41, 48, 48, 43, 43, 50, 50];
  A.music = function (name) {
    if (!A.ready) return;
    A.stopMusic();
    if (name !== 'title') return;
    mPlaying = true; mStep = 0;
    let next = A.ctx.currentTime + 0.1;
    mTimer = setInterval(() => {
      if (!mPlaying || !A.ctx) return;
      while (next < A.ctx.currentTime + 0.35) {
        const n = MEL[mStep % MEL.length], b = BASS[(mStep >> 1) % BASS.length];
        if (n) tone({ type: 'square', f0: NOTE(n), dur: 0.16, vol: 0.12, at: next, bus: musicBus });
        if (mStep % 2 === 0) tone({ type: 'triangle', f0: NOTE(b), dur: 0.2, vol: 0.2, at: next, bus: musicBus });
        if (mStep % 4 === 2) noise({ type: 'highpass', f0: 6000, dur: 0.04, vol: 0.06, at: next, bus: musicBus });
        next += 0.17; mStep++;
      }
    }, 80);
  };
  A.stopMusic = function () { mPlaying = false; if (mTimer) { clearInterval(mTimer); mTimer = 0; } };

  G.audio = A;
})((window.SGS = window.SGS || {}));
