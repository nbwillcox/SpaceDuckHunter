/* Drawing the scene in the right order (sky, ducks, grass, raccoon, grass, weather, HUD) + HUD, banners and the reticle. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, S = G.settings, I = G.input, Art = G.art, Sky = G.sky, Game = G.game;
  const W = C.W, H = C.H, TAU = Math.PI * 2;
  const FLAP = [0, 1, 2, 3];
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function txt(ctx, s, x, y, size, col, align, weight, outline) {
    ctx.font = (weight || 800) + ' ' + size + 'px ' + FONT; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    if (outline) { ctx.lineWidth = outline; ctx.strokeStyle = 'rgba(4,8,20,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }

  /* ---------------------------------------------------------------- ducks */
  function drawDucks(ctx) {
    const night = Sky.night * 0.8, fog = 1 - Sky.fog * 0.28;
    for (const d of Game.ducks) {
      if (d.state === 'landed' || d.state === 'gone') continue;
      const glow = Sky.glowSprite(d.color === 'red' ? 10 : d.color === 'blue' ? 215 : 160);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (0.16 + 0.26 * Sky.night) * (d.state === 'hit' ? 2 : 1);
      ctx.drawImage(glow, d.x - 74, d.y - 64, 148, 128); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (d.state === 'fly' || d.state === 'escape') {
        const fl = Math.abs(d.vx) < 1 ? 1 : (d.vx < 0), tilt = Math.atan2(d.vy, Math.max(30, Math.abs(d.vx))) * 0.6;
        Art.drawDuck(ctx, d.color, FLAP[Math.floor(d.flap) % 4], d.x, d.y, { flip: fl, rot: fl ? -tilt : tilt, size: d.size, night, alpha: fog });
      } else if (d.state === 'hit') {
        const sc = 1 + 0.12 * Math.sin(d.t * 30);
        Art.drawDuck(ctx, d.color, 4, d.x, d.y, { flip: d.vx < 0, size: d.size * sc, night });
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, 0.7 - d.t * 2.2); ctx.drawImage(Sky.glowSprite(55), d.x - 60, d.y - 60, 120, 120); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      } else if (d.state === 'fall') {
        const fl = Math.floor(d.spin / 0.09) % 2 === 0;
        Art.drawDuck(ctx, d.color, 5, d.x, d.y, { flip: fl, rot: (fl ? 1 : -1) * 1.25, size: d.size, night });
      }
    }
  }

  /* ---------------------------------------------------------------- raccoon */
  const LAUGH_SEQ = ['laugh_p1', 'laugh_p2', 'laugh_p1', 'laugh_p3', 'laugh_p2', 'laugh_p3'];
  function coonResult(ctx) {
    const t = Game.pt, T = Game.coonT, night = Sky.night;
    let e = 1;
    if (t < 0.28) e = U.easeOutCubic(t / 0.28); else if (t > T) e = 1 - Math.pow(Math.min(1, (t - T) / 0.28), 2);
    if (e <= 0.001) return;
    let name, h = 300, bob = 0, shk = 0;
    if (Game.coonMode === 'hold2') name = 'hold2';
    else if (Game.coonMode === 'hold1') name = 'hold1';
    else { name = LAUGH_SEQ[(Math.floor(t / 0.13) + Game.coonVar) % LAUGH_SEQ.length]; bob = Math.abs(Math.sin(t * 22)) * 12; shk = Math.sin(t * 61) * 2.5; h = 316; }
    if (Game.coonMode !== 'laugh') bob = Math.sin(t * 6) * 3;
    const x = Game.coonX + shk, y = 536 + 340 * (1 - e) - bob;
    Art.coon(ctx, name, x, y, h, { night, rot: Game.coonMode === 'laugh' ? Math.sin(t * 17) * 0.035 : 0 });
    if (Game.coonMode === 'laugh' && t > 0.2 && t < T) {
      const k = Math.floor(t / 0.26) % 2, a = Math.min(1, (t - 0.2) * 5) * (t > T - 0.3 ? (T - t) / 0.3 : 1);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x + (k ? 150 : -170), y - h + 40 - (t * 20 % 10)); ctx.rotate(k ? 0.18 : -0.2);
      const s = 1 + 0.12 * Math.sin(t * 24); ctx.scale(s, s);
      txt(ctx, k ? 'HA!' : 'HA HA!', 0, 0, 40, '#ffe36a', 'center', 900, 7); ctx.restore();
    }
  }
  function coonGameOver(ctx) {
    const t = Game.pt - 0.7; if (t <= 0) return;
    const e = U.easeOutCubic(Math.min(1, t / 0.4));
    const name = LAUGH_SEQ[(Math.floor(t / 0.12)) % LAUGH_SEQ.length], bob = Math.abs(Math.sin(t * 22)) * 14;
    Art.coon(ctx, name, W / 2 + Math.sin(t * 59) * 3, 560 + 380 * (1 - e) - bob, 430, { night: Sky.night, rot: Math.sin(t * 15) * 0.04 });
  }
  function coonBehind(ctx) {
    if (Game.demo) return;
    if (Game.phase === 'coon') coonResult(ctx);
    else if (Game.phase === 'levelend' && !Game.ok) coonGameOver(ctx);
    else if (Game.phase === 'intro' && Game.coon && !Game.coon.front && !Game.coon.hidden) { const c = Game.coon; Art.coon(ctx, c.name, c.x, c.y + 6, c.h, { rot: c.rot, night: Sky.night }); }
  }
  function coonFront(ctx) {
    if (Game.demo || Game.phase !== 'intro' || !Game.coon || !Game.coon.front || Game.coon.hidden) return;
    const c = Game.coon;
    Art.coon(ctx, c.name, c.x, c.y + 8, c.h, { rot: c.rot, night: Sky.night, flip: c.flip });
    if (c.name === 'jump' && Game.pt < 2.95) { ctx.save(); txt(ctx, '!', c.x + 52, c.y - c.h - 6 - Math.sin((Game.pt - 2.4) * 18) * 3, 46, '#ffe36a', 'center', 900, 7); ctx.restore(); }
  }

  /* ---------------------------------------------------------------- particles */
  function drawParts(ctx) {
    for (const p of Game.parts) {
      const a = Math.min(1, p.life / 0.5);
      ctx.globalAlpha = a;
      if (p.k === 'f') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.moveTo(-p.sz, 0); ctx.quadraticCurveTo(0, -p.sz * 0.55, p.sz, 0); ctx.quadraticCurveTo(0, p.sz * 0.55, -p.sz, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-p.sz, 0); ctx.lineTo(p.sz, 0); ctx.stroke(); ctx.restore();
      } else { ctx.fillStyle = p.col; ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
    }
    ctx.globalAlpha = 1;
    for (const r of Game.rings) { const k = r.t / r.max; ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.col; ctx.lineWidth = 3 * (1 - k) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r + k * 34, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- HUD */
  function panel(ctx, x, y, w, h) {
    rr(ctx, x, y, w, h, 9); ctx.fillStyle = 'rgba(4,10,24,0.74)'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(120,255,200,0.45)'; ctx.stroke();
  }
  function bullet(ctx, x, y, on) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = on ? '#ffd24a' : 'rgba(255,255,255,0.12)';
    rr(ctx, -6, -4, 12, 20, 2.5); ctx.fill();
    ctx.fillStyle = on ? '#ff9a3d' : 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(0, -17, 6, -4); ctx.closePath(); ctx.fill();
    if (on) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-3.5, -1, 2, 14); }
    ctx.restore();
  }
  function hud(ctx) {
    if (Game.demo) return;
    const touch = I.mode === 'touch' || document.body.classList.contains('touch');
    /* SHOT */
    panel(ctx, 20, 480, 196, 52);
    txt(ctx, 'SHOT', 32, 495, 11, '#9dffd0', 'left', 800);
    const hidden = Game.reloadT > 0;
    for (let i = 0; i < C.CLIP; i++) bullet(ctx, 40 + i * 24, 516, !hidden && i < Game.clip);
    const res = Game.reserve();
    txt(ctx, res > 0 ? '+' + res : '', 120, 516, 18, '#ffd24a', 'left', 900);
    if (!touch) txt(ctx, 'R: RELOAD', 206, 495, 10, 'rgba(190,220,255,0.7)', 'right', 700);
    if (hidden) { const f = Game.reloadFrac(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(130, 526, 76, 3); ctx.fillStyle = '#7dff9a'; ctx.fillRect(130, 526, 76 * f, 3); txt(ctx, 'RELOADING', 168, 508, 10, '#7dff9a', 'center', 800); }
    /* HIT row */
    panel(ctx, 236, 480, 430, 52);
    txt(ctx, 'HIT', 250, 495, 11, '#9dffd0', 'left', 800);
    const blink = Math.floor(Game.t * 6) % 2 === 0;
    for (let i = 0; i < C.LEVEL_DUCKS; i++) {
      const st = Game.row[i], x = 292 + i * 36, y = 508;
      const active = Game.phase === 'fly' && i >= Game.spawned - Game.roundSize && i < Game.spawned && st === 0;
      if (st === 1) Art.icon(ctx, x, y, 1.3, '#ff4b5c', '#ffd0d4');
      else if (st === 2) Art.icon(ctx, x, y, 1.3, 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.35)');
      else Art.icon(ctx, x, y, 1.3, active ? (blink ? '#ffffff' : 'rgba(255,255,255,0.35)') : 'rgba(255,255,255,0.88)', 'rgba(20,30,60,0.8)');
    }
    const qx = 296 + (Game.quota - 1) * 36 + 18;
    ctx.strokeStyle = 'rgba(255,227,106,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(qx, 496); ctx.lineTo(qx, 524); ctx.stroke();
    txt(ctx, 'NEED ' + Game.quota, 656, 495, 10, '#ffe36a', 'right', 800);
    /* SCORE */
    panel(ctx, 686, 480, 254, 52);
    txt(ctx, 'LEVEL ' + Game.level, 700, 495, 11, '#9dffd0', 'left', 800);
    txt(ctx, 'HI ' + U.fmt(Math.max(G.scores.best(), Game.score)), 928, 495, 10, 'rgba(190,220,255,0.7)', 'right', 700);
    txt(ctx, U.pad(Game.score, 6), 928, 516, 27, '#ffffff', 'right', 900);
  }

  function reticle(ctx) {
    if (Game.demo || (Game.phase !== 'fly' && Game.phase !== 'prep' && Game.phase !== 'banner' && Game.phase !== 'resolve')) return;
    let x = I.x, y = I.y;
    if (I.mode === 'touch') {
      if (I.ping > 0) { const k = 1 - I.ping / 0.35; ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(I.pingX, I.pingY, 12 + k * 30, 0, TAU); ctx.stroke(); }
      return;
    }
    const rec = Game.recoil || 0, r = 21 + rec * 9, empty = Game.clip <= 0 && Game.reloadT <= 0 && Game.phase === 'fly';
    const col = empty ? (Math.floor(Game.t * 8) % 2 ? '#ff4b5c' : '#ffb0b8') : '#ffffff';
    ctx.save(); ctx.translate(x, y);
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? col : 'rgba(0,10,30,0.8)'; ctx.lineWidth = pass ? 2.2 : 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r - 9, 0); ctx.lineTo(-r + 6, 0); ctx.moveTo(r - 6, 0); ctx.lineTo(r + 9, 0); ctx.moveTo(0, -r - 9); ctx.lineTo(0, -r + 6); ctx.moveTo(0, r - 6); ctx.lineTo(0, r + 9); ctx.stroke();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, TAU); ctx.fill();
    if (Game.reloadT > 0) { ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * Game.reloadFrac()); ctx.stroke(); }
    ctx.restore();
    if (Game.hintT > 0 && Game.hint) { ctx.globalAlpha = Math.min(1, Game.hintT * 3); txt(ctx, Game.hint, x, y - 42, 20, '#ff6a7a', 'center', 900, 5); ctx.globalAlpha = 1; }
  }

  function bannerDraw(ctx) {
    const b = Game.banner; if (!b) return;
    const a = Math.min(1, b.t * 6) * (b.dur < 90 ? Math.min(1, (b.dur - b.t) * 5) : 1);
    const s = 1 + Math.max(0, 0.25 - b.t * 1.2);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, b.sub ? 168 : 150); ctx.scale(s, s);
    const big = b.text.length > 9 ? 58 : 74;
    txt(ctx, b.text, 0, 0, big, b.col, 'center', 900, 12);
    if (b.sub) txt(ctx, b.sub, 0, big * 0.78, 24, '#e8f4ff', 'center', 800, 6);
    ctx.restore();
  }
  function popupsDraw(ctx) {
    for (const p of Game.popups) { ctx.globalAlpha = 1 - Math.max(0, (p.t - 0.7) / 0.4); txt(ctx, p.text, p.x, p.y, p.size, p.col, 'center', 900, 5); }
    ctx.globalAlpha = 1;
  }

  Game.render = function (ctx) {
    Sky.setLook(I.x, I.y);
    ctx.save();
    if (Game.shake > 0 && S.shake) ctx.translate(U.rand(-Game.shake, Game.shake), U.rand(-Game.shake, Game.shake));
    Sky.drawBack(ctx);
    drawDucks(ctx);
    Sky.drawGrassBack(ctx);
    coonBehind(ctx);
    Sky.drawGrassFront(ctx);
    coonFront(ctx);
    drawParts(ctx);
    Sky.drawFront(ctx);
    ctx.restore();
    if (Game.flash > 0 && !S.reduced) { ctx.fillStyle = 'rgba(255,255,240,' + Math.min(0.3, Game.flash * 1.6) + ')'; ctx.fillRect(0, 0, W, H); }
    popupsDraw(ctx);
    hud(ctx);
    bannerDraw(ctx);
    if (!Game.demo) txt(ctx, Sky.label(), 16, 18, 12, 'rgba(225,240,255,0.8)', 'left', 800, 4);
    reticle(ctx);
  };
})((window.SGS = window.SGS || {}));
