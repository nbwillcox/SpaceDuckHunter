/* All sound is synthesized live with the Web Audio API - no audio files. */
(function (G) {
  'use strict';
  const S = G.settings;
  const A = { ctx: null, ready: false, sfx: {} };
  let master, sfxBus, musicBus, ambBus, noiseBuf, voices = 0;
  let rainG, rainF, windG, windF, drone;
  const last = {};

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
    comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain(); sfxBus = ctx.createGain(); musicBus = ctx.createGain(); ambBus = ctx.createGain();
    sfxBus.connect(master); musicBus.connect(master); ambBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
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
    master.gain.value = S.master;
    sfxBus.gain.value = S.sfx;
    musicBus.gain.value = S.music * 0.5;
    ambBus.gain.value = S.ambient;
  };

  /* ---------- primitives ---------- */
  function tone(o) {
    if (!A.ready || voices > 48) return;
    const ctx = A.ctx, t = o.at !== undefined ? o.at : ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.2 : o.vol, t + (o.attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let out = g;
    if (o.formant) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.formant; f.Q.value = o.fq || 4;
      osc.connect(f); f.connect(g);
    } else osc.connect(g);
    g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.03);
    voices++;
    osc.onended = () => { voices--; out.disconnect(); };
  }
  function noise(o) {
    if (!A.ready || voices > 48) return;
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
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.03);
    voices++;
    src.onended = () => { voices--; g.disconnect(); };
  }
  A.tone = tone; A.noise = noise;
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /* ---------- sound effects ---------- */
  const X = A.sfx;
  X.shot = () => {
    if (!A.ready) return;
    noise({ type: 'bandpass', f0: 3200, f1: 500, q: 0.8, dur: 0.2, vol: 0.5 });
    noise({ type: 'lowpass', f0: 900, f1: 120, dur: 0.32, vol: 0.35 });
    tone({ type: 'sine', f0: 170, f1: 45, dur: 0.2, vol: 0.5 });
    tone({ type: 'square', f0: 1800, f1: 300, dur: 0.05, vol: 0.12 });
  };
  X.dry = () => { tone({ type: 'square', f0: 1500, f1: 900, dur: 0.03, vol: 0.14 }); tone({ type: 'square', f0: 700, f1: 500, dur: 0.04, vol: 0.1, delay: 0.05 }); };
  X.reload = (dur) => {
    dur = dur || 0.85;
    tone({ type: 'square', f0: 900, f1: 500, dur: 0.04, vol: 0.14 });
    noise({ type: 'highpass', f0: 2500, dur: 0.05, vol: 0.2, delay: 0.05 });
    noise({ type: 'bandpass', f0: 1400, q: 3, dur: 0.12, vol: 0.18, delay: dur * 0.38 });
    tone({ type: 'square', f0: 500, f1: 800, dur: 0.05, vol: 0.14, delay: dur * 0.62 });
    tone({ type: 'square', f0: 1200, f1: 1700, dur: 0.06, vol: 0.18, delay: dur - 0.08 });
    noise({ type: 'highpass', f0: 3000, dur: 0.05, vol: 0.2, delay: dur - 0.07 });
  };
  X.quack = (p) => {
    if (!gate('quack', 60)) return;
    p = p || 1;
    const f = 300 * p;
    tone({ type: 'sawtooth', f0: f * 1.15, f1: f * 0.7, dur: 0.17, vol: 0.2, formant: 1100 * p, fq: 3 });
    tone({ type: 'sawtooth', f0: f * 1.1, f1: f * 0.65, dur: 0.14, vol: 0.12, formant: 1900, fq: 5, delay: 0.1 });
  };
  X.flap = () => { if (gate('flap', 95)) noise({ type: 'bandpass', f0: 700, f1: 380, q: 1.2, dur: 0.07, vol: 0.05 }); };
  X.hit = () => {
    noise({ type: 'bandpass', f0: 1800, f1: 400, dur: 0.12, vol: 0.4 });
    tone({ type: 'triangle', f0: 700, f1: 160, dur: 0.14, vol: 0.35 });
    tone({ type: 'sawtooth', f0: 320, f1: 140, dur: 0.18, vol: 0.14, formant: 1200 });
  };
  X.fall = (dur) => { tone({ type: 'sine', f0: 1500, f1: 220, dur: dur || 0.7, vol: 0.12 }); };
  X.thud = () => { noise({ type: 'lowpass', f0: 500, f1: 90, dur: 0.18, vol: 0.5 }); tone({ type: 'sine', f0: 110, f1: 45, dur: 0.16, vol: 0.45 }); };
  X.escape = () => { for (let i = 0; i < 4; i++) tone({ type: 'sawtooth', f0: 380 - i * 30, f1: 520, dur: 0.12, vol: 0.1, formant: 1000, delay: i * 0.1 }); };
  X.sniff = () => { noise({ type: 'highpass', f0: 3200, dur: 0.07, vol: 0.14 }); noise({ type: 'highpass', f0: 3600, dur: 0.06, vol: 0.12, delay: 0.1 }); };
  X.alert = () => { tone({ type: 'square', f0: 880, f1: 1320, dur: 0.14, vol: 0.18 }); };
  X.jump = () => { tone({ type: 'triangle', f0: 300, f1: 900, dur: 0.2, vol: 0.22 }); };
  X.pop = () => { tone({ type: 'sine', f0: 200, f1: 720, dur: 0.13, vol: 0.3 }); noise({ type: 'bandpass', f0: 1200, dur: 0.08, vol: 0.14 }); };
  X.laugh = (v) => {                                    /* the raccoon: a run of fast, falling chitters over a wobbling formant */
    if (!A.ready) return;
    v = v || 0;
    const base = [560, 640, 520][v % 3], n = 9;
    for (let i = 0; i < n; i++) {
      const up = i % 2 === 0, f = base * (up ? 1.18 : 1) * (1 - i * 0.018), t = i * 0.108;
      tone({ type: 'sawtooth', f0: f * 1.25, f1: f * 0.78, dur: 0.1, vol: 0.2, formant: up ? 1500 : 1000, fq: 2.2, delay: t, attack: 0.012 });
      tone({ type: 'square', f0: f * 2.5, f1: f * 1.4, dur: 0.05, vol: 0.05, delay: t });
    }
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
    noise({ type: 'lowpass', f0: 420, f1: 60, dur: 2.6, vol: 0.9, attack: 0.05, delay: d, bus: ambBus });
    noise({ type: 'lowpass', f0: 220, f1: 50, dur: 3.2, vol: 0.7, attack: 0.3, delay: d + 0.25, bus: ambBus });
    noise({ type: 'bandpass', f0: 900, f1: 200, q: 0.6, dur: 0.5, vol: 0.5, delay: d, bus: ambBus });
  };
  X.meteor = () => { noise({ type: 'bandpass', f0: 5000, f1: 1200, q: 2, dur: 0.7, vol: 0.05, bus: ambBus }); };

  /* ---------- ambient bed: wind, rain, crickets by night, odd birdsong by day ---------- */
  function loopNoise(freq, type, q) {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(ambBus); src.start(0, Math.random());
    return { g, f };
  }
  function initAmbient() {
    const r = loopNoise(3200, 'bandpass', 0.5); rainG = r.g; rainF = r.f;
    const w = loopNoise(420, 'lowpass', 0.7); windG = w.g; windF = w.f;
  }
  let cT = 0, bT = 0, cricketPhase = 0;
  /* st: { night, day, rain, storm, wind, snow }  - called every frame */
  A.ambient = function (dt, st) {
    if (!A.ready) return;
    const t = A.ctx.currentTime, rain = Math.min(1, st.rain + st.storm * 1.2);
    rainG.gain.setTargetAtTime(rain * 0.32, t, 0.4);
    rainF.frequency.setTargetAtTime(2400 + st.storm * 1800, t, 0.5);
    windG.gain.setTargetAtTime(Math.min(0.5, Math.abs(st.wind) * 0.3 + st.snow * 0.08), t, 0.5);
    windF.frequency.setTargetAtTime(260 + Math.abs(st.wind) * 500, t, 0.5);
    cT -= dt; bT -= dt;
    if (st.night > 0.4 && rain < 0.5 && cT <= 0) {            /* cricket trill: a burst of 3-4 chirps */
      cT = 0.38 + Math.random() * 0.15;
      const v = 0.018 * st.night * (1 - rain), f = 4100 + Math.sin(cricketPhase += 0.4) * 160;
      for (let i = 0; i < 4; i++) tone({ type: 'sine', f0: f, f1: f * 1.02, dur: 0.035, vol: v, delay: i * 0.055, bus: ambBus });
    }
    if (st.day > 0.5 && rain < 0.3 && bT <= 0) {
      bT = 2 + Math.random() * 5;
      const f = 2300 + Math.random() * 1500, n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) tone({ type: 'sine', f0: f * (1 + i * 0.12), f1: f * (1.4 + i * 0.1), dur: 0.09, vol: 0.028, delay: i * 0.13, bus: ambBus });
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
