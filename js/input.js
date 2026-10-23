/* Aim + fire + reload. Mouse: move to aim, left click shoot, right click reload. Touch: tap to shoot at that spot. Gamepad: sticks aim, A / triggers shoot, B / X reload, Start pause. Keyboard: arrows / WASD aim, Space shoot, R reload. */
(function (G) {
  'use strict';
  const C = G.C, S = G.settings;
  const I = { x: C.W / 2, y: C.H * 0.42, mode: 'mouse', _shots: [], _reload: false, _pause: false, _any: false, ping: 0, pingX: 0, pingY: 0, padName: '' };
  const held = Object.create(null);
  const AIM_KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D' };
  const SHOOT_KEYS = new Set(['Space', 'Enter', 'KeyZ', 'KeyJ']);
  const RELOAD_KEYS = new Set(['KeyR', 'KeyX', 'KeyK']);
  const GAME_KEYS = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  I.takeShot = () => I._shots.shift() || null;
  I.takeReload = () => { const b = I._reload; I._reload = false; return b; };
  I.takePause = () => { const b = I._pause; I._pause = false; return b; };
  I.takeAny = () => { const b = I._any; I._any = false; return b; };
  I.clear = () => { I._shots.length = 0; I._reload = I._pause = I._any = false; for (const k in held) held[k] = false; };
  I.fire = (x, y) => { if (I._shots.length < 4) I._shots.push({ x: x === undefined ? I.x : x, y: y === undefined ? I.y : y }); };

  function typing(t) { const n = t && t.tagName; return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT'; }

  window.addEventListener('keydown', (e) => {
    if (typing(e.target)) return;
    const c = e.code;
    if (!e.repeat) {
      I._any = true;
      if (SHOOT_KEYS.has(c)) { I.mode = 'key'; I.fire(); }
      else if (RELOAD_KEYS.has(c)) I._reload = true;
      else if (c === 'KeyP' || c === 'Escape') I._pause = true;
    }
    if (AIM_KEYS[c]) { held[AIM_KEYS[c]] = true; I.mode = 'key'; }
    if ((GAME_KEYS.has(c) || RELOAD_KEYS.has(c) || AIM_KEYS[c]) && e.target.tagName !== 'BUTTON') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { const d = AIM_KEYS[e.code]; if (d) held[d] = false; });
  window.addEventListener('blur', () => I.clear());

  function toLogical(e) {
    const v = G.view;
    I.x = clamp((e.clientX - v.ox) / v.s, 0, C.W);
    I.y = clamp((e.clientY - v.oy) / v.s, 0, C.H);
  }
  I.bind = function (canvas) {
    canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') { I.mode = 'mouse'; toLogical(e); } });
    canvas.addEventListener('pointerdown', (e) => {
      I._any = true;
      toLogical(e);
      if (e.pointerType === 'touch') { I.mode = 'touch'; I.ping = 0.35; I.pingX = I.x; I.pingY = I.y; I.fire(); e.preventDefault(); return; }
      I.mode = 'mouse';
      if (e.button === 0) I.fire();
      else if (e.button === 2) I._reload = true;
      e.preventDefault();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  let pad = { shoot: false, reload: false, pause: false };
  /* called once per frame (not per physics step) */
  I.poll = function (dt) {
    if (!I._init && document.body.classList.contains('touch')) { I._init = true; I.mode = 'touch'; }
    const sp = 560 * (S.aim || 1);
    let dx = (held.R ? 1 : 0) - (held.L ? 1 : 0), dy = (held.D ? 1 : 0) - (held.U ? 1 : 0);
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    if (dx || dy) { I.x = clamp(I.x + dx * sp * dt, 0, C.W); I.y = clamp(I.y + dy * sp * dt, 0, C.H); }
    if (I.ping > 0) I.ping -= dt;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null;
    for (const q of pads) if (q && q.connected) { p = q; break; }
    if (!p) { I.padName = ''; return; }
    I.padName = p.id;
    const ax = (i) => p.axes[i] || 0;
    const stick = (a, b) => { let x = ax(a), y = ax(b); const m = Math.hypot(x, y); if (m < 0.18) return [0, 0, 0]; const k = Math.min(1, (m - 0.18) / 0.82); return [x / m, y / m, Math.pow(k, 1.5)]; };
    const L = stick(0, 1), R = stick(2, 3), s = L[2] > R[2] ? L : R;
    const bt = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    let ddx = (bt(15) ? 1 : 0) - (bt(14) ? 1 : 0), ddy = (bt(13) ? 1 : 0) - (bt(12) ? 1 : 0);
    if (s[2] > 0 || ddx || ddy) {
      I.mode = 'pad';
      const mx = s[2] > 0 ? s[0] * s[2] : ddx * 0.55, my = s[2] > 0 ? s[1] * s[2] : ddy * 0.55;
      I.x = clamp(I.x + mx * sp * 1.3 * dt, 0, C.W); I.y = clamp(I.y + my * sp * 1.3 * dt, 0, C.H);
    }
    const shoot = bt(0) || bt(5) || bt(7), reload = bt(1) || bt(2) || bt(6), pause = bt(9);
    if (shoot && !pad.shoot) { I.mode = 'pad'; I.fire(); I._any = true; }
    if (reload && !pad.reload) { I.mode = 'pad'; I._reload = true; }
    if (pause && !pad.pause) I._pause = true;
    pad = { shoot, reload, pause };
  };

  G.input = I;
})((window.SGS = window.SGS || {}));
