/* Art: the vector-drawn space ducks (three colours, flap frames, hit + fall poses, cached) and the raccoon pictures (image files). */
(function (G) {
  'use strict';
  const mk = () => document.createElement('canvas');
  const TAU = Math.PI * 2;
  const Art = { ready: false, img: {}, dark: {}, duck: {}, duckDark: {} };
  G.art = Art;

  const COON = ['laugh_p1', 'laugh_p2', 'laugh_p3', 'hold1', 'hold2', 'sniff', 'jump', 'hero', 'hero_helmet'];
  Art.load = function () {
    return new Promise((resolve) => {
      let left = COON.length;
      const done = () => { if (--left <= 0) { Art.ready = true; resolve(); } };
      COON.forEach((n) => {
        const im = new Image();
        im.onload = () => {
          Art.img[n] = im;
          const c = mk(); c.width = im.naturalWidth; c.height = im.naturalHeight;     /* a night-shaded copy, cross-faded over the original */
          const g = c.getContext('2d'); g.drawImage(im, 0, 0);
          g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(10,18,60,0.55)'; g.fillRect(0, 0, c.width, c.height);
          Art.dark[n] = c; done();
        };
        im.onerror = done;
        im.src = 'assets/coon_' + n + '.webp?v=1';
      });
    });
  };
  /* bottom-centre anchored; h = drawn height */
  Art.coon = function (ctx, name, x, y, h, o) {
    const im = Art.img[name]; if (!im) return null;
    o = o || {};
    const w = h * im.naturalWidth / im.naturalHeight;
    ctx.save(); ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
    ctx.drawImage(im, -w / 2, -h, w, h);
    const n = o.night || 0;
    if (n > 0.03) { ctx.globalAlpha = n * (o.nightK === undefined ? 0.75 : o.nightK); ctx.drawImage(Art.dark[name], -w / 2, -h, w, h); ctx.globalAlpha = 1; }
    ctx.restore();
    return w;
  };

  /* ---------------------------------------------------------------- ducks */
  const DUCK = {
    black: { body: '#262d44', belly: '#56668c', head: '#13a872', headHi: '#6af4b8', wing: '#171d33', wingTip: '#6a86d0', ring: '#f4f6ff', bill: '#ffb41e', rim: '#6fe8ff' },
    blue: { body: '#2f6bff', belly: '#cfe6ff', head: '#1a3db8', headHi: '#78a0ff', wing: '#1b46cf', wingTip: '#9cc4ff', ring: '#ffffff', bill: '#ffc42c', rim: '#9fd0ff' },
    red: { body: '#e3303f', belly: '#ffc0ae', head: '#7c1428', headHi: '#ee6074', wing: '#b01a30', wingTip: '#ff9482', ring: '#fff2e2', bill: '#ffd42c', rim: '#ffa090' },
  };
  Art.DUCK_COLORS = Object.keys(DUCK);
  const WING = [-104, -136, -176, 128];                     /* hinge angles (deg from +x) per flap frame */

  function leaf(g, len, wd, col, tip, lw) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.18, -wd * 1.1, len * 0.7, -wd * 0.8, len, -wd * 0.1);
    g.lineTo(len * 0.9, wd * 0.15);
    g.lineTo(len * 0.84, wd * 0.42); g.lineTo(len * 0.7, wd * 0.34); g.lineTo(len * 0.62, wd * 0.62); g.lineTo(len * 0.48, wd * 0.5);
    g.bezierCurveTo(len * 0.28, wd * 0.72, len * 0.08, wd * 0.5, 0, 0);
    g.closePath(); g.fill();
    g.strokeStyle = tip; g.lineWidth = lw || 1.4; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(len * 0.22, -wd * 0.1); g.lineTo(len * 0.92, -wd * 0.04); g.moveTo(len * 0.3, wd * 0.2); g.lineTo(len * 0.78, wd * 0.28); g.stroke();
    g.fillStyle = tip; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(len * 0.7, -wd * 0.7); g.lineTo(len, -wd * 0.1); g.lineTo(len * 0.9, wd * 0.15); g.lineTo(len * 0.7, wd * 0.34); g.closePath(); g.fill();
    g.globalAlpha = 1;
  }
  function drawDuck(g, P, frame, pose) {
    const wing = pose === 'hit' ? -96 : pose === 'fall' ? 150 : WING[frame];
    g.lineJoin = 'round';
    /* far wing */
    g.save(); g.translate(-5, -9); g.rotate((wing + (pose === 'hit' ? 12 : -8)) * Math.PI / 180); leaf(g, 44, 14, P.wing, P.wingTip); g.restore();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 0, 0);
    /* tail + feet tuck */
    g.fillStyle = P.wing; g.beginPath(); g.moveTo(-26, -2); g.lineTo(-44, -9); g.lineTo(-40, 1); g.lineTo(-45, 8); g.lineTo(-26, 7); g.closePath(); g.fill();
    g.strokeStyle = '#ff9a1a'; g.lineWidth = 2.4; g.lineCap = 'round';
    if (pose !== 'hit') { g.beginPath(); g.moveTo(-6, 13); g.lineTo(-17, 20); g.lineTo(-10, 22); g.moveTo(2, 14); g.lineTo(-8, 22); g.lineTo(-1, 24); g.stroke(); }
    /* body */
    const bg = g.createLinearGradient(0, -16, 0, 17); bg.addColorStop(0, P.body); bg.addColorStop(0.65, P.body); bg.addColorStop(1, P.belly);
    g.fillStyle = bg;
    g.beginPath(); g.moveTo(-34, 1); g.bezierCurveTo(-28, -13, 4, -17, 20, -9); g.bezierCurveTo(30, -4, 29, 12, 14, 16); g.bezierCurveTo(-2, 20, -24, 15, -34, 1); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-24, -6); g.bezierCurveTo(-12, -13, 4, -13, 14, -8); g.stroke();
    /* neck + head */
    const hx = pose === 'hit' ? 28 : 31, hy = pose === 'hit' ? -22 : -19;
    g.fillStyle = P.head; g.beginPath(); g.moveTo(12, -9); g.bezierCurveTo(14, -17, hx - 8, hy - 2, hx - 6, hy + 10); g.lineTo(hx + 8, hy + 9); g.bezierCurveTo(hx + 10, hy + 1, 24, -2, 24, 5); g.lineTo(18, 8); g.closePath(); g.fill();
    g.fillStyle = P.ring; g.beginPath(); g.ellipse(18, -3, 8.5, 3.2, 0.9, 0, TAU); g.fill();               /* neck ring */
    const hg = g.createRadialGradient(hx - 3, hy - 4, 1, hx, hy, 11); hg.addColorStop(0, P.headHi); hg.addColorStop(1, P.head);
    g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, 10.2, 0, TAU); g.fill();
    /* bill */
    g.fillStyle = P.bill;
    if (pose === 'hit' || pose === 'fall') {
      g.beginPath(); g.moveTo(hx + 7, hy - 3); g.quadraticCurveTo(hx + 20, hy - 7, hx + 25, hy - 3); g.lineTo(hx + 9, hy); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(hx + 8, hy + 2); g.lineTo(hx + 22, hy + 5); g.quadraticCurveTo(hx + 17, hy + 10, hx + 8, hy + 7); g.closePath(); g.fill();
      g.fillStyle = '#7a1428'; g.beginPath(); g.moveTo(hx + 9, hy); g.lineTo(hx + 21, hy + 1); g.lineTo(hx + 9, hy + 3); g.closePath(); g.fill();
    } else {
      g.beginPath(); g.moveTo(hx + 7, hy - 4); g.quadraticCurveTo(hx + 21, hy - 5, hx + 24, hy + 1); g.quadraticCurveTo(hx + 18, hy + 8, hx + 7, hy + 6); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(120,60,0,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx + 8, hy + 1); g.lineTo(hx + 22, hy + 1); g.stroke();
    }
    /* eye */
    if (pose === 'hit' || pose === 'fall') {
      g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(hx - 1, hy - 7); g.lineTo(hx + 7, hy - 1); g.moveTo(hx + 7, hy - 7); g.lineTo(hx - 1, hy - 1); g.stroke();
    } else {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 3, hy - 3, 4.2, 0, TAU); g.fill();
      g.fillStyle = '#10141f'; g.beginPath(); g.arc(hx + 4.2, hy - 3, 2.4, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 4.9, hy - 3.8, 0.9, 0, TAU); g.fill();
    }
    /* near wing */
    g.save(); g.translate(-3, -8); g.rotate(wing * Math.PI / 180); leaf(g, 50, 17, P.wing, P.wingTip, 1.8); g.restore();
  }
  function bakeDuck(key, frame, pose) {
    const P = DUCK[key], c = mk(), S = 2.4; c.width = Math.round(150 * S); c.height = Math.round(130 * S);
    const g = c.getContext('2d'); g.scale(S, S); g.translate(72, 66);
    /* thin rim light so the dark duck stays readable against any sky */
    const rim = mk(); rim.width = c.width; rim.height = c.height;
    const rg = rim.getContext('2d'); rg.scale(S, S); rg.translate(72, 66); drawDuck(rg, P, frame, pose);
    rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalCompositeOperation = 'source-in'; rg.fillStyle = P.rim; rg.fillRect(0, 0, rim.width, rim.height);
    g.save(); g.globalAlpha = 0.9;
    for (const [dx, dy] of [[-1.3, 0], [1.3, 0], [0, -1.3], [0, 1.3], [-0.9, -0.9], [0.9, 0.9], [-0.9, 0.9], [0.9, -0.9]]) { g.setTransform(1, 0, 0, 1, dx * S, dy * S); g.drawImage(rim, 0, 0); }
    g.restore(); g.setTransform(S, 0, 0, S, 72 * S, 66 * S);
    drawDuck(g, P, frame, pose);
    const d = mk(); d.width = c.width; d.height = c.height; const dg = d.getContext('2d'); dg.drawImage(c, 0, 0);
    dg.globalCompositeOperation = 'source-atop'; dg.fillStyle = 'rgba(8,14,50,0.42)'; dg.fillRect(0, 0, d.width, d.height);
    return [c, d];
  }
  Art.buildDucks = function () {
    for (const k of Art.DUCK_COLORS) {
      Art.duck[k] = []; Art.duckDark[k] = [];
      for (let f = 0; f < 4; f++) { const r = bakeDuck(k, f, 'fly'); Art.duck[k].push(r[0]); Art.duckDark[k].push(r[1]); }
      for (const pose of ['hit', 'fall']) { const r = bakeDuck(k, 0, pose); Art.duck[k].push(r[0]); Art.duckDark[k].push(r[1]); }
    }
  };
  /* frame: 0..3 flap, 4 hit, 5 fall. size = body length in px (the bake is 150 units wide) */
  Art.drawDuck = function (ctx, key, frame, x, y, o) {
    const c = Art.duck[key][frame]; if (!c) return;
    o = o || {};
    const sc = (o.size || 70) / 78, w = 150 * sc, h = 130 * sc;
    ctx.save(); ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.flip ? -1 : 1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.drawImage(c, -w / 2, -h / 2 - 2 * sc, w, h);
    const n = o.night || 0;
    if (n > 0.03) { ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * n; ctx.drawImage(Art.duckDark[key][frame], -w / 2, -h / 2 - 2 * sc, w, h); }
    ctx.restore();
  };

  /* small flat duck icon for the HIT row */
  Art.icon = function (ctx, x, y, s, fill, stroke) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineJoin = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(-9, 1); ctx.lineTo(-13, -3); ctx.lineTo(-8, -2.5); ctx.closePath(); ctx.fill(); ctx.stroke();           /* tail */
    ctx.beginPath(); ctx.ellipse(-1, 2, 9.5, 5.6, -0.12, 0, TAU); ctx.fill(); ctx.stroke();                                         /* body */
    ctx.beginPath(); ctx.arc(7, -4.2, 4, 0, TAU); ctx.fill(); ctx.stroke();                                                          /* head */
    ctx.beginPath(); ctx.moveTo(10.4, -4.6); ctx.lineTo(15, -3.2); ctx.lineTo(10.4, -2.2); ctx.closePath(); ctx.fillStyle = stroke; ctx.fill();
    ctx.strokeStyle = stroke; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(-6, 1); ctx.quadraticCurveTo(-1, -3.2, 3, 1.2); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
  };

  G.art = Art;
})((window.SGS = window.SGS || {}));
