/* Boot, canvas sizing, fixed-step loop and app modes. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, S = G.settings, A = G.audio, I = G.input, Game = G.game, UI = G.ui, Sky = G.sky, Art = G.art;
  const W = C.W, H = C.H, STEP = 1 / 120;
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const view = (G.view = { ox: 0, oy: 0, s: 1, w: 0, h: 0, dpr: 1, rs: 1 });
  const params = new URLSearchParams(location.search);
  G.debug = { level: parseInt(params.get('level'), 10) || 0, bot: params.get('bot') === '1', tod: params.get('tod') || '', wx: params.get('wx') || '' };
  const M = { mode: 'loading' };
  G.main = M;

  /* adaptive resolution: if frames run long the canvas renders at a lower internal resolution, and creeps back up when there is headroom */
  let qual = 1, ema = 1 / 60, qT = 0;
  function setSize(c, w, h) { w = Math.max(8, w); h = Math.max(8, h); if (c.width !== w) c.width = w; if (c.height !== h) c.height = h; }
  function sizeCanvas() {
    view.rs = view.dpr * Math.max(0.6, qual);
    setSize(canvas, Math.round(view.w * view.rs), Math.round(view.h * view.rs));
  }
  function adapt(dt) {
    if (dt >= 0.09) return;
    ema += (dt - ema) * 0.04; qT += dt;
    if (qT < 1.2) return;
    qT = 0;
    if (ema > 0.027 && qual > 0.55) { qual = Math.max(0.55, qual - 0.15); sizeCanvas(); }
    else if (ema < 0.019 && qual < 1) { qual = Math.min(1, qual + 0.05); sizeCanvas(); }
  }
  M.quality = () => ({ qual: +qual.toFixed(2), ema: +ema.toFixed(4), canvas: canvas.width + 'x' + canvas.height });
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = Math.max(64, window.innerWidth), h = Math.max(64, window.innerHeight);
    const s = Math.min(w / W, h / H);
    view.w = w; view.h = h; view.dpr = dpr; view.s = s;
    view.ox = (w - W * s) / 2; view.oy = (h - H * s) / 2;
    if (window.TK) window.TK.layout(view, W, H);
    sizeCanvas();
  }
  window.addEventListener('resize', resize);

  function render() {
    if (canvas.width < 16) { resize(); return; }
    const rs = view.rs;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    /* letterbox bars take the sky's colours so the scene bleeds out to the window edges */
    const top = Sky.topColor || [8, 12, 40], hor = Sky.horizonColor || [30, 40, 90];
    const gy0 = view.oy * rs, gh = H * view.s * rs, gr = ctx.createLinearGradient(0, gy0, 0, gy0 + gh);
    gr.addColorStop(0, 'rgb(' + (top[0] | 0) + ',' + (top[1] | 0) + ',' + (top[2] | 0) + ')'); gr.addColorStop(0.69, 'rgb(' + (hor[0] | 0) + ',' + (hor[1] | 0) + ',' + (hor[2] | 0) + ')'); gr.addColorStop(0.74, '#03140f'); gr.addColorStop(1, '#010806');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(rs * view.s, 0, 0, rs * view.s, view.ox * rs, view.oy * rs);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
    Game.render(ctx);
    ctx.restore();
    ctx.setTransform(rs, 0, 0, rs, 0, 0);
    const fw = W * view.s, fh = H * view.s;
    ctx.strokeStyle = 'rgba(125,255,170,0.10)'; ctx.lineWidth = 8; ctx.strokeRect(view.ox, view.oy, fw, fh);
    ctx.strokeStyle = 'rgba(125,255,170,0.45)'; ctx.lineWidth = 1.5; ctx.strokeRect(view.ox, view.oy, fw, fh);
  }
  M._render = render;

  /* ---------- app modes ---------- */
  M.startGame = function () {
    if (M.mode === 'loading') return;
    A.resume(); A.stopMusic();
    I.clear();
    Game.reset(false, G.debug.level || 1);
    Game.onOver = () => { M.mode = 'over'; const sc = Game.score, lv = Game.level; Game.reset(true, 1); UI.showGameOver(sc, lv); };
    if (G.debug.bot) Game.bot = true;
    M.mode = 'play';
    UI.hideAll();
    A.sfx.start();
  };
  M.toTitle = function () {
    Game.onOver = null;
    Game.reset(true, 1);
    M.mode = 'title';
    UI.lastIdx = -1;
    UI.show('title');
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
    A.music('title');
  };
  M.pause = function () {
    if (M.mode !== 'play') return;
    M.mode = 'pause';
    I.clear();
    if (A.ctx) A.ctx.suspend();
    UI.show('pause');
  };
  M.resume = function () {
    if (M.mode !== 'pause') return;
    M.mode = 'play';
    I.clear();
    UI.hideAll();
    if (A.ctx) A.ctx.resume();
  };

  let last = 0, acc = 0, musicKicked = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (M.mode === 'loading') return;
    if (now - last < 10.5) return;                                  /* about 60 fps cap on 90 / 120 / 144 Hz screens */
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;
    adapt(dt);
    if (dt > 0.05) dt = 0.05;
    if (!musicKicked && A.ready && M.mode === 'title') { musicKicked = true; A.music('title'); }
    I.poll(dt);
    if (M.mode === 'pause') { if (I.takePause()) M.resume(); }
    else {
      acc += dt;
      while (acc >= STEP) {
        if (M.mode === 'play' && I.takePause()) { M.pause(); acc = 0; break; }
        if (M.mode !== 'play') { I.takePause(); I.takeReload(); while (I.takeShot()); }
        Game.update(STEP);
        acc -= STEP;
      }
    }
    render();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) M.pause(); });
  window.addEventListener('blur', () => M.pause());
  I.bind(canvas);

  function boot() {
    resize();
    const hero = 'assets/coon_hero.webp?v=1';
    document.getElementById('heroImg').src = hero; document.getElementById('overImg').src = hero;
    if (['day', 'dusk', 'night'].indexOf(G.debug.tod) >= 0) { S.tod = G.debug.tod; Sky.forceTime({ day: 0.5, dusk: 0.73, night: 0.02 }[G.debug.tod]); }
    Art.load().then(() => {
      Sky.setImages(Art.env); Sky.init();
      Game.reset(true, 1);
      if (G.debug.wx) { S.weather = 'dynamic'; Sky.setWeather(G.debug.wx); for (const k in Sky.wxI) Sky.wxI[k] = k === G.debug.wx ? 1 : 0; }
      M.mode = 'title'; UI.show('title');
      if (A.ctx && A.ctx.state === 'running') A.music('title');
    });
    requestAnimationFrame((t) => { last = t; frame(t); });
  }
  boot();
})((window.SGS = window.SGS || {}));
