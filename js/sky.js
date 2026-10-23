/* The space forest: layered backdrop prerendered in a day and a night palette (cross-faded by the time of day), plus the sky itself
   (stars, nebula, ringed planet, sun, two moons, aurora, clouds) and a weather system (clouds, rain, storm + lightning, snow, fog, spores, meteors). */
(function (G) {
  'use strict';
  const C = G.C, S = G.settings, U = G.U, W = C.W, H = C.H, HOR = C.HORIZON;
  const mk = () => document.createElement('canvas');
  const RS = 1.5, PAD = 40, LW = W + PAD * 2;
  const TAU = Math.PI * 2;
  const clamp = U.clamp, lerp = U.lerp;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgb = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')';

  const Sky = { t: 0.42, sunH: 1, day: 1, dusk: 0, night: 0, wind: 0.25, cover: 0.2, dark: 0, fog: 0, rain: 0, storm: 0, snow: 0,
    wx: 'clear', wxI: {}, glowPulse: 0, flash: 0 };
  G.sky = Sky;

  /* ---------------------------------------------------------------- time-of-day colours */
  const KEYS = [
    [0.00, '#040616', '#0a1040', '#1a2262'], [0.20, '#0b1245', '#231a6a', '#6a2a7a'], [0.27, '#2a2f80', '#b04a8a', '#ff9a5a'],
    [0.36, '#3b62d8', '#5fa8ee', '#a8f0e0'], [0.50, '#2f58d0', '#4a9be8', '#8fe8e0'], [0.64, '#3b62d8', '#5fa8ee', '#b0f0d8'],
    [0.73, '#3a2a80', '#c0407a', '#ff8a50'], [0.80, '#121450', '#3a1f78', '#8a2f80'], [0.90, '#060924', '#0e1550', '#1f2a70'], [1.00, '#040616', '#0a1040', '#1a2262'],
  ].map((k) => [k[0], hex(k[1]), hex(k[2]), hex(k[3])]);
  function skyColors(t) {
    let i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1], f = smooth(0, 1, (t - a[0]) / (b[0] - a[0]));
    return [mix(a[1], b[1], f), mix(a[2], b[2], f), mix(a[3], b[3], f)];
  }

  /* ---------------------------------------------------------------- palettes (day / night) */
  const PAL = {
    day: { far: ['#9a94ec', '#d0c8ff'], t1: ['#6a8cd0', '#9ad0e6'], cap1: ['#7aaae0', '#b4e6f4'], t2: ['#2c7f93', '#4cb3a8'], cap2: ['#35c0a2', '#a6f0aa'],
      hero: ['#4e3672', '#8a62a8'], heroCap: ['#1fb596', '#92ee9c'], bush: ['#1d8f7a', '#74eca0'], ground: ['#2f8062', '#0f4034'],
      gb: ['#0d4a3a', '#1e8a64', '#62dc96'], gf: ['#07382c', '#16805c', '#8af2a8'], haze: 'rgba(210,240,255,0.22)' },
    night: { far: ['#171b52', '#2a307e'], t1: ['#0b1546', '#17265f'], cap1: ['#17338a', '#2656aa'], t2: ['#061835', '#0d2c50'], cap2: ['#0d5666', '#1a8c88'],
      hero: ['#120d2c', '#2a1c52'], heroCap: ['#0c5864', '#22a4a4'], bush: ['#093848', '#1cae8e'], ground: ['#08243a', '#020a14'],
      gb: ['#03161e', '#07424c', '#2cd8ac'], gf: ['#020d14', '#06353e', '#3ef0c0'], haze: 'rgba(60,90,200,0.16)' },
  };

  /* ---------------------------------------------------------------- layer prerender helpers */
  function layerCanvas(h) {
    const c = mk(); c.width = Math.round(LW * RS); c.height = Math.round(h * RS);
    const g = c.getContext('2d'); g.scale(RS, RS);
    return { c, g, h, glows: [] };
  }
  function lin(g, x0, y0, x1, y1, c0, c1) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; }

  function drawFar(L, p, rnd) {
    const g = L.g, h = L.h;
    g.fillStyle = lin(g, 0, 0, 0, h, p.far[1], p.far[0]);
    const pts = [];
    g.beginPath(); g.moveTo(0, h);
    for (let x = -10; x < LW + 40; x += 22 + rnd() * 38) {
      let y = h - (62 + 58 * Math.sin(x * 0.011 + 1) + 34 * Math.sin(x * 0.029 + 2) + rnd() * 46);
      if (rnd() < 0.2) y -= 34 + rnd() * 40;
      pts.push([x, y]); g.lineTo(x, y);
    }
    g.lineTo(LW + 40, h); g.closePath(); g.fill();
    for (let i = 1; i < pts.length - 1; i++) {                               /* crystal facets on the peaks */
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      if (b[1] < a[1] && b[1] < c[1]) {
        g.fillStyle = 'rgba(255,255,255,0.20)'; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(b[0] + (c[0] - b[0]) * 0.3, b[1] + (c[1] - b[1]) * 0.3 + 38); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,30,0.20)'; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(a[0], a[1]); g.lineTo(b[0] - (b[0] - a[0]) * 0.35, b[1] + 44); g.closePath(); g.fill();
        if (rnd() < 0.5) { L.glows.push({ x: b[0], y: b[1] + 3, r: 9 + rnd() * 7, h: 195 + rnd() * 90 }); }
      }
    }
    g.fillStyle = lin(g, 0, h - 90, 0, h, 'rgba(255,255,255,0)', p.haze); g.fillRect(0, h - 90, LW, 90);
  }

  /* one spore-tree: a tapering trunk under a scalloped dome cap */
  function sporeTree(L, x, base, th, w, capW, capH, trunk, cap, rnd, glowChance) {
    const g = L.g, lean = (rnd() - 0.5) * th * 0.14, tx = x + lean, ty = base - th;
    g.fillStyle = lin(g, x - w / 2, 0, x + w / 2, 0, trunk[1], trunk[0]);
    g.beginPath();
    g.moveTo(x - w * 0.95, base + 4);
    g.quadraticCurveTo(x - w * 0.5, base - 8, x - w * 0.36, base - th * 0.2);
    g.bezierCurveTo(x - w * 0.3 + lean * 0.3, base - th * 0.5, tx - w * 0.26, base - th * 0.8, tx - w * 0.2, ty);
    g.lineTo(tx + w * 0.2, ty);
    g.bezierCurveTo(tx + w * 0.26, base - th * 0.8, x + w * 0.3 + lean * 0.3, base - th * 0.5, x + w * 0.36, base - th * 0.2);
    g.quadraticCurveTo(x + w * 0.5, base - 8, x + w * 0.95, base + 4);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = Math.max(1, w * 0.06);                     /* rim light down the lit side */
    g.beginPath(); g.moveTo(x - w * 0.28, base - th * 0.15); g.bezierCurveTo(x - w * 0.24 + lean * 0.3, base - th * 0.5, tx - w * 0.18, base - th * 0.8, tx - w * 0.14, ty + 4); g.stroke();
    for (let i = 0; i < 3 + (w / 14 | 0); i++) {                                                     /* growth rings */
      const yy = ty + th * (0.15 + rnd() * 0.75);
      g.strokeStyle = 'rgba(0,0,20,0.16)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x + lean * (1 - (yy - ty) / th), yy, w * 0.3, w * 0.07, 0, 0, Math.PI); g.stroke();
    }
    /* cap */
    const cx = tx, top = ty - capH * 0.45;
    g.fillStyle = 'rgba(0,0,20,0.4)'; g.beginPath(); g.ellipse(cx, ty + capH * 0.16, capW * 0.5, capH * 0.18, 0, 0, TAU); g.fill();
    g.fillStyle = lin(g, 0, top, 0, ty + capH * 0.4, cap[1], cap[0]);
    g.beginPath(); g.moveTo(cx - capW / 2, ty + capH * 0.34);
    g.bezierCurveTo(cx - capW * 0.55, top - capH * 0.22, cx + capW * 0.55, top - capH * 0.22, cx + capW / 2, ty + capH * 0.34);
    const n = Math.max(5, Math.round(capW / 26));
    for (let i = n; i > 0; i--) {
      const x0 = cx - capW / 2 + capW * (i / n), x1 = cx - capW / 2 + capW * ((i - 1) / n);
      g.quadraticCurveTo((x0 + x1) / 2, ty + capH * 0.34 + capH * 0.22, x1, ty + capH * 0.34);
    }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(1.2, capW * 0.012);
    g.beginPath(); g.moveTo(cx - capW * 0.42, ty + capH * 0.08); g.bezierCurveTo(cx - capW * 0.36, top - capH * 0.02, cx - capW * 0.1, top - capH * 0.08, cx + capW * 0.08, top - capH * 0.07); g.stroke();
    const spots = 4 + Math.round(capW / 24);
    for (let i = 0; i < spots; i++) {
      const sx = cx + (rnd() - 0.5) * capW * 0.78, sy = top + capH * (0.08 + rnd() * 0.5), sr = 2 + rnd() * capW * 0.035;
      g.fillStyle = 'rgba(255,255,255,0.26)'; g.beginPath(); g.ellipse(sx, sy, sr * 1.3, sr, 0, 0, TAU); g.fill();
      if (rnd() < glowChance) L.glows.push({ x: sx, y: sy, r: sr * 3.4 + 5, h: [160, 175, 300, 320, 95][(rnd() * 5) | 0] });
    }
  }
  function drawForest(L, p, rnd, o) {
    const items = [];
    for (let x = -30; x < LW + 30; x += o.gap * (0.55 + rnd() * 0.9)) items.push({ x, th: o.hMin + rnd() * (o.hMax - o.hMin), w: o.wMin + rnd() * (o.wMax - o.wMin), cw: o.cMin + rnd() * (o.cMax - o.cMin) });
    items.sort((a, b) => a.th - b.th);
    for (const t of items) sporeTree(L, t.x, L.h - o.sink, t.th, t.w, t.cw, t.cw * o.cRatio, o.trunk, o.cap, rnd, o.glow);
  }

  function drawHero(L, p, rnd) {
    const g = L.g, base = L.h - 6;
    /* a lone sapling far right, then the great tree on the left */
    sporeTree(L, LW - 86, base, 270, 46, 190, 70, p.hero, p.heroCap, rnd, 0.5);
    const gx = 168;
    sporeTree(L, gx, base, 350, 124, 360, 128, p.hero, p.heroCap, rnd, 0.7);
    g.fillStyle = lin(g, 0, base - 90, 0, base, p.hero[1], p.hero[0]);                                   /* buttress roots */
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(gx + s * 40, base - 120); g.bezierCurveTo(gx + s * 80, base - 40, gx + s * 130, base - 10, gx + s * 190, base + 6); g.lineTo(gx + s * 60, base + 6); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(0,0,10,0.6)'; g.beginPath(); g.ellipse(gx + 4, base - 100, 24, 34, 0, 0, TAU); g.fill();       /* knot-hole */
    L.glows.push({ x: gx + 4, y: base - 96, r: 30, h: 180 });
    for (let i = 0; i < 9; i++) {                                                                       /* hanging vines with glow-fruit */
      const vx = gx - 170 + rnd() * 340, vy = base - 350 + 52 + rnd() * 30, len = 50 + rnd() * 90;
      g.strokeStyle = 'rgba(0,0,10,0.5)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(vx, vy);
      g.bezierCurveTo(vx + 8, vy + len * 0.4, vx - 8, vy + len * 0.7, vx + (rnd() - 0.5) * 10, vy + len); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(vx, vy + len, 5.5, 0, TAU); g.fill();
      L.glows.push({ x: vx, y: vy + len, r: 22, h: [175, 300, 95][(rnd() * 3) | 0] });
    }
  }
  function drawBush(L, p, rnd) {
    const g = L.g, cx = LW - 150, by = L.h - 4;
    g.fillStyle = lin(g, 0, by - 60, 0, by, p.bush[0], p.ground[0]); g.beginPath(); g.ellipse(cx, by, 150, 38, 0, Math.PI, TAU); g.fill();
    const leaves = [];
    for (let i = 0; i < 30; i++) leaves.push({ ox: (rnd() - 0.5) * 190, a: (rnd() - 0.5) * 2.2, len: 60 + rnd() * 84, wd: 11 + rnd() * 9 });
    leaves.sort((a, b) => a.len - b.len);
    for (const l of leaves) {
      g.save(); g.translate(cx + l.ox, by - 6); g.rotate(l.a);
      g.fillStyle = lin(g, 0, 0, 0, -l.len, p.bush[0], p.bush[1]);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-l.wd, -l.len * 0.5, 0, -l.len); g.quadraticCurveTo(l.wd, -l.len * 0.5, 0, 0); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, -l.len * 0.9); g.stroke();
      g.restore();
      if (rnd() < 0.35) L.glows.push({ x: cx + l.ox + Math.sin(l.a) * l.len, y: by - 6 - Math.cos(l.a) * l.len, r: 13, h: [165, 100, 310][(rnd() * 3) | 0] });
    }
    for (let i = 0; i < 6; i++) {                                                                       /* crystal shards */
      const sx = cx + (rnd() - 0.5) * 150, sh = 28 + rnd() * 40, sw = 7 + rnd() * 6;
      g.fillStyle = 'rgba(190,240,255,0.5)'; g.beginPath(); g.moveTo(sx - sw, by); g.lineTo(sx, by - sh); g.lineTo(sx + sw, by); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(sx - sw, by); g.lineTo(sx, by - sh); g.lineTo(sx - 1, by); g.closePath(); g.fill();
      L.glows.push({ x: sx, y: by - sh * 0.55, r: 16, h: 190 });
    }
  }
  function drawGround(L, p, rnd) {
    const g = L.g, h = L.h;
    g.fillStyle = lin(g, 0, 0, 0, h, p.ground[0], p.ground[1]); g.fillRect(0, 0, LW, h);
    g.fillStyle = lin(g, 0, 0, 0, 40, p.haze, 'rgba(255,255,255,0)'); g.fillRect(0, 0, LW, 40);
    for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.04 + rnd() * 0.05) + ')'; g.beginPath(); g.ellipse(rnd() * LW, 12 + rnd() * (h - 12), 6 + rnd() * 26, 1.5 + rnd() * 3, 0, 0, TAU); g.fill(); }
    for (let i = 0; i < 28; i++) {                                                                      /* glow-mushroom clusters */
      const x = rnd() * LW, y = 18 + rnd() * 70, n = 2 + ((rnd() * 3) | 0), hue = [170, 310, 100][(rnd() * 3) | 0];
      for (let k = 0; k < n; k++) {
        const mx = x + k * 9 + rnd() * 5, mh = 6 + rnd() * 9;
        g.fillStyle = 'rgba(20,10,40,0.55)'; g.fillRect(mx - 1, y - mh, 2.2, mh);
        g.fillStyle = 'hsl(' + hue + ',70%,72%)'; g.beginPath(); g.ellipse(mx, y - mh, 5 + rnd() * 3, 3.2, 0, Math.PI, TAU); g.fill();
        L.glows.push({ x: mx, y: y - mh, r: 11, h: hue });
      }
    }
  }
  function drawGrass(L, p, rnd, o) {
    const g = L.g, h = L.h;
    g.fillStyle = lin(g, 0, h - 50, 0, h, o.cols[0], 'rgba(2,10,10,1)'); g.fillRect(0, h - 40, LW, 40);
    for (let i = 0; i < o.n; i++) {
      const x = -20 + rnd() * (LW + 40), bh = o.hMin + Math.pow(rnd(), 0.8) * (o.hMax - o.hMin), lean = (rnd() - 0.5) * 30, bw = 3 + rnd() * 4.5, y0 = h + 4;
      const col = rnd() < 0.5 ? o.cols[1] : o.cols[0];
      g.fillStyle = lin(g, 0, y0, 0, y0 - bh, col, o.cols[2]);
      g.beginPath(); g.moveTo(x - bw, y0); g.quadraticCurveTo(x - bw * 0.4 + lean * 0.2, y0 - bh * 0.55, x + lean, y0 - bh);
      g.quadraticCurveTo(x + bw * 0.5 + lean * 0.3, y0 - bh * 0.5, x + bw, y0); g.closePath(); g.fill();
      if (rnd() < o.tip) { L.glows.push({ x: x + lean, y: y0 - bh + 1, r: 8, h: [165, 100, 190, 320][(rnd() * 4) | 0], grass: true }); }
    }
  }

  /* ---------------------------------------------------------------- AI-art sprite layers (used when assets/env_*.webp are loaded) */
  let IMG = {};
  Sky.setImages = function (o) { IMG = o || {}; };
  const spriteCache = {};
  /* a sprite recoloured for a variant: night darkens it toward navy; haze washes distant objects toward the sky colour */
  function variant(key, night, hazeA, dark) {
    const id = key + '|' + night + '|' + hazeA + '|' + (dark || 0);
    if (spriteCache[id]) return spriteCache[id];
    const im = IMG[key], c = mk(); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop';
    if (night) { g.fillStyle = 'rgba(6,14,64,0.60)'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(40,80,210,0.16)'; g.fillRect(0, 0, c.width, c.height); }
    if (dark) { g.fillStyle = 'rgba(0,18,14,' + dark + ')'; g.fillRect(0, 0, c.width, c.height); }
    if (hazeA > 0) { g.fillStyle = night ? 'rgba(34,52,130,' + hazeA + ')' : 'rgba(205,228,255,' + hazeA + ')'; g.fillRect(0, 0, c.width, c.height); }
    return (spriteCache[id] = c);
  }
  function put(L, key, x, base, h, night, hazeA, o) {
    o = o || {};
    const im = IMG[key], w = h * im.naturalWidth / im.naturalHeight, g = L.g;
    g.save(); g.translate(x, base);
    if (o.flip) g.scale(-1, 1);
    g.drawImage(variant(key, night, hazeA, o.dark), -w / 2, -h, w, h);
    g.restore();
    return w;
  }
  const TREES = ['tree1', 'tree2', 'tree3', 'tree4', 'tree5'];
  function forestS(L, night, rnd, o) {
    const items = [];
    for (let x = -30; x < LW + 30; x += o.gap * (0.6 + rnd() * 0.8)) items.push({ x, h: o.hMin + rnd() * (o.hMax - o.hMin), k: TREES[(rnd() * TREES.length) | 0], f: rnd() < 0.5, g: rnd() });
    items.sort((a, b) => a.h - b.h);
    for (const t of items) {
      const w = put(L, t.k, t.x, L.h - 2, Math.min(t.h, L.h - 4), night, o.haze, { flip: t.f });
      const n = 2 + ((t.h / 100) | 0);
      for (let i = 0; i < n; i++) L.glows.push({ x: t.x + (rnd() - 0.5) * w * 0.55, y: L.h - 2 - t.h * (0.7 + rnd() * 0.25), r: 6 + t.h * 0.05 + rnd() * 6, h: [165, 180, 300, 320, 95][(rnd() * 5) | 0] });
    }
  }
  function farS(L, p, rnd, night) {
    drawFar(L, p, rnd);
    for (let i = 0; i < 24; i++) {
      const x = rnd() * LW, h = 70 + rnd() * 120, k = rnd() < 0.5 ? 'crys1' : 'crys2', f = rnd() < 0.5;
      put(L, k, x, L.h + 4 - rnd() * 10, h, night, 0.38, { flip: f });
      if (rnd() < 0.6) L.glows.push({ x, y: L.h - h * 0.8, r: 8 + h * 0.06, h: 195 + rnd() * 100 });
    }
  }
  function groundS(L, p, rnd, night) {
    drawGround(L, p, rnd);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * LW, y = 30 + rnd() * 92, h = 18 + rnd() * 24, k = rnd() < 0.5 ? 'shroom1' : 'shroom2';
      put(L, k, x, y + h * 0.4, h, night, 0, { flip: rnd() < 0.5 });
      L.glows.push({ x, y: y - h * 0.2, r: 8 + h * 0.3, h: [170, 310, 100][(rnd() * 3) | 0] });
    }
  }
  function heroS(L, p, rnd, night) {
    put(L, 'tree5', LW - 58, L.h - 4, 300, night, 0.12);
    put(L, 'hero', 178, L.h - 2, 438, night, 0);
    for (let i = 0; i < 9; i++) L.glows.push({ x: 40 + rnd() * 270, y: L.h - 120 - rnd() * 280, r: 14 + rnd() * 10, h: [175, 300, 95][(rnd() * 3) | 0] });
    put(L, 'bush', LW - 150, L.h - 2, 210, night, 0);
    for (let i = 0; i < 6; i++) L.glows.push({ x: LW - 230 + rnd() * 160, y: L.h - 20 - rnd() * 150, r: 12 + rnd() * 6, h: [165, 100, 310][(rnd() * 3) | 0] });
  }
  function grassS(L, night, rnd, o) {
    const g = L.g, h = L.h;
    g.fillStyle = lin(g, 0, h - 50, 0, h, night ? '#04181c' : '#0d4a3a', 'rgba(2,10,10,1)'); g.fillRect(0, h - 40, LW, 40);
    const items = [];
    for (let i = 0; i < o.n; i++) items.push({ x: -20 + rnd() * (LW + 40), h: o.hMin + rnd() * (o.hMax - o.hMin), k: rnd() < 0.5 ? 'tuft1' : 'tuft2', f: rnd() < 0.5, t: rnd() });
    items.sort((a, b) => a.h - b.h);
    for (const t of items) {
      put(L, t.k, t.x, h + 6, t.h, night, 0, { flip: t.f, dark: o.dark });
      if (t.t < o.tip) L.glows.push({ x: t.x + (rnd() - 0.5) * 18, y: h + 6 - t.h * 0.92, r: 8, h: [165, 100, 190, 320][(rnd() * 4) | 0], grass: true });
    }
  }

  /* ---------------------------------------------------------------- build */
  const LAYERS = [];       /* {name, y0, h, par, day, night, glows} drawn back to front */
  const spec = [
    { name: 'far', h: 262, y0: HOR - 252, par: 0.004, fn: (L, p, r) => drawFar(L, p, r), seed: 11 },
    { name: 't1', h: 300, y0: HOR + 24 - 300, par: 0.009, seed: 12, fn: (L, p, r) => drawForest(L, p, r, { gap: 58, hMin: 150, hMax: 250, wMin: 12, wMax: 20, cMin: 70, cMax: 130, cRatio: 0.42, sink: 0, trunk: p.t1, cap: p.cap1, glow: 0.35 }) },
    { name: 't2', h: 380, y0: HOR + 62 - 380, par: 0.017, seed: 13, fn: (L, p, r) => drawForest(L, p, r, { gap: 112, hMin: 230, hMax: 340, wMin: 24, wMax: 40, cMin: 120, cMax: 220, cRatio: 0.4, sink: 0, trunk: p.t2, cap: p.cap2, glow: 0.5 }) },
    { name: 'ground', h: H - (HOR + 6), y0: HOR + 6, par: 0, seed: 14, fn: (L, p, r) => drawGround(L, p, r) },
    { name: 'hero', h: 450, y0: HOR + 98 - 450, par: 0.026, seed: 15, fn: (L, p, r) => { drawHero(L, p, r); drawBush(L, p, r); } },
  ];
  const GRASS = {};
  let built = false;
  const glowSprites = {};
  function glowSprite(hue) {
    const k = Math.round(hue / 15) * 15;
    if (glowSprites[k]) return glowSprites[k];
    const c = mk(); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'hsla(' + k + ',100%,88%,1)'); gr.addColorStop(0.18, 'hsla(' + k + ',100%,66%,0.75)'); gr.addColorStop(0.5, 'hsla(' + k + ',100%,52%,0.22)'); gr.addColorStop(1, 'hsla(' + k + ',100%,50%,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (glowSprites[k] = c);
  }
  Sky.glowSprite = glowSprite;

  function build() {
    if (built) return; built = true;
    const S2 = !!(IMG.tree1 && IMG.hero && IMG.tuft1);
    const painters = {
      far: (L, p, r, n) => (S2 && IMG.crys1 ? farS(L, p, r, n) : drawFar(L, p, r)),
      t1: (L, p, r, n) => (S2 ? forestS(L, n, r, { gap: 66, hMin: 170, hMax: 265, haze: 0.5 }) : drawForest(L, p, r, { gap: 58, hMin: 150, hMax: 250, wMin: 12, wMax: 20, cMin: 70, cMax: 130, cRatio: 0.42, sink: 0, trunk: p.t1, cap: p.cap1, glow: 0.35 })),
      t2: (L, p, r, n) => (S2 ? forestS(L, n, r, { gap: 150, hMin: 270, hMax: 372, haze: 0.16 }) : drawForest(L, p, r, { gap: 112, hMin: 230, hMax: 340, wMin: 24, wMax: 40, cMin: 120, cMax: 220, cRatio: 0.4, sink: 0, trunk: p.t2, cap: p.cap2, glow: 0.5 })),
      ground: (L, p, r, n) => (S2 && IMG.shroom1 ? groundS(L, p, r, n) : drawGround(L, p, r)),
      hero: (L, p, r, n) => { if (S2) heroS(L, p, r, n); else { drawHero(L, p, r); drawBush(L, p, r); } },
    };
    for (const sp of spec) {
      const out = { name: sp.name, y0: sp.y0, h: sp.h, par: sp.par, glows: [] };
      for (const key of ['day', 'night']) {
        const L = layerCanvas(sp.h);
        painters[sp.name](L, PAL[key], mulberry(sp.seed), key === 'night');
        out[key] = L.c;
        if (key === 'night') out.glows = L.glows;
      }
      LAYERS.push(out);
    }
    const gspec = { back: { y0: 414, h: 126, n: 520, hMin: 34, hMax: 112, tip: 0.2, seed: 21, k: 'gb', sn: 96, sh0: 46, sh1: 96, dark: 0.12, stip: 0.18 },
      front: { y0: 440, h: 100, n: 380, hMin: 40, hMax: 98, tip: 0.18, seed: 22, k: 'gf', sn: 84, sh0: 40, sh1: 88, dark: 0.28, stip: 0.16 } };
    for (const nm in gspec) {
      const gs = gspec[nm], out = { y0: gs.y0, h: gs.h, glows: [] };
      for (const key of ['day', 'night']) {
        const L = layerCanvas(gs.h);
        if (S2) grassS(L, key === 'night', mulberry(gs.seed), { n: gs.sn, hMin: gs.sh0, hMax: gs.sh1, tip: gs.stip, dark: gs.dark });
        else drawGrass(L, PAL[key], mulberry(gs.seed), { n: gs.n, hMin: gs.hMin, hMax: gs.hMax, tip: gs.tip, cols: PAL[key][gs.k] });
        out[key] = L.c; if (key === 'night') out.glows = L.glows;
      }
      GRASS[nm] = out;
    }
    buildSkyAssets();
  }

  /* ---------------------------------------------------------------- sky assets */
  let stars = [], nebula = null, planet = null, moonA = null, moonB = null, clouds = [], cloudSprites = [], cloudCv = null, vignette = null, fogTex = [], auroraStrip = null;
  function buildSkyAssets() {
    const r = mulberry(99);
    for (let i = 0; i < 280; i++) stars.push({ x: r() * W, y: Math.pow(r(), 1.4) * (HOR - 10), s: 0.5 + r() * 1.6, tw: r() * 6, sp: 0.8 + r() * 2.2, h: r() < 0.15 ? 200 : r() < 0.3 ? 30 : 0 });
    nebula = mk(); nebula.width = W; nebula.height = HOR;
    {
      const g = nebula.getContext('2d');
      const blobs = [[160, 120, 280, 190, 0.42, 280], [520, 90, 340, 130, 0.36, 195], [800, 190, 300, 170, 0.34, 320], [380, 240, 260, 110, 0.28, 240], [90, 260, 200, 90, 0.26, 175]];
      for (const b of blobs) {
        g.save(); g.translate(b[0], b[1]); g.scale(1, b[3] / b[2]);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, b[2]);
        gr.addColorStop(0, 'hsla(' + b[5] + ',90%,60%,' + b[4] + ')'); gr.addColorStop(0.5, 'hsla(' + (b[5] + 30) + ',90%,45%,' + b[4] * 0.4 + ')'); gr.addColorStop(1, 'hsla(' + b[5] + ',90%,40%,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, b[2], 0, TAU); g.fill(); g.restore();
      }
    }
    planet = mk(); planet.width = 300; planet.height = 200;
    if (IMG.planet) { const g = planet.getContext('2d'), im = IMG.planet, hh = 190, ww = hh * im.naturalWidth / im.naturalHeight; g.drawImage(im, 150 - ww / 2, 100 - hh / 2, ww, hh); } else {
      const g = planet.getContext('2d'), cx = 150, cy = 100, R = 56;
      const ring = (front) => { g.save(); g.translate(cx, cy); g.rotate(-0.32); g.lineWidth = 7; g.strokeStyle = front ? 'rgba(255,220,170,0.85)' : 'rgba(255,220,170,0.55)'; g.beginPath(); g.ellipse(0, 0, 112, 26, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke();
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,170,120,0.55)'; g.beginPath(); g.ellipse(0, 0, 96, 21, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke(); g.restore(); };
      ring(false);
      const gr = g.createRadialGradient(cx - 18, cy - 20, 4, cx, cy, R);
      gr.addColorStop(0, '#ffd9a8'); gr.addColorStop(0.55, '#e0809a'); gr.addColorStop(1, '#5a2a78');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(' + (i % 2 ? '255,230,200' : '120,40,110') + ',0.16)'; g.fillRect(cx - R, cy - R + i * 20 + 4, R * 2, 8 + (i % 3) * 3); }
      g.restore(); ring(true);
    }
    const moon = (R, c0, c1, tintGreen) => { const c = mk(); c.width = c.height = R * 4; const g = c.getContext('2d'), m = R * 2;
      const gl = g.createRadialGradient(m, m, R * 0.8, m, m, R * 2); gl.addColorStop(0, 'rgba(200,220,255,0.35)'); gl.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = gl; g.fillRect(0, 0, c.width, c.height);
      if (IMG.moon) { g.drawImage(IMG.moon, m - R, m - R, R * 2, R * 2); if (tintGreen) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(110,255,190,0.4)'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over'; } return c; }
      const gr = g.createRadialGradient(m - R * 0.3, m - R * 0.3, R * 0.1, m, m, R); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
      g.fillStyle = gr; g.beginPath(); g.arc(m, m, R, 0, TAU); g.fill();
      const rr = mulberry(5); for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(40,50,90,0.2)'; g.beginPath(); g.arc(m + (rr() - 0.5) * R * 1.2, m + (rr() - 0.5) * R * 1.2, R * (0.08 + rr() * 0.18), 0, TAU); g.fill(); }
      return c; };
    moonA = moon(30, '#fffbe6', '#b9c4e6'); moonB = moon(15, '#d8ffe6', '#7fc9b0', true);
    if (IMG.cloud1) {
      for (const k of ['cloud1', 'cloud2', 'cloud3', 'cloud1']) { const im = IMG[k], c = mk(); c.width = 360; c.height = Math.round(360 * im.naturalHeight / im.naturalWidth); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cloudSprites.push(c); }
    } else for (let v = 0; v < 4; v++) {
      const c = mk(); c.width = 360; c.height = 140; const g = c.getContext('2d'), rr = mulberry(40 + v);
      const n = 11 + v * 2;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), x = 50 + t * 260, rad = 28 + Math.sin(t * Math.PI) * 30 + rr() * 14, y = 88 - Math.sin(t * Math.PI) * 24 + (rr() - 0.5) * 12;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
      }
      cloudSprites.push(c);
    }
    cloudCv = mk(); cloudCv.width = W; cloudCv.height = 320;
    for (let i = 0; i < 11; i++) clouds.push({ x: r() * (W + 400) - 200, y: 20 + r() * 230, s: 0.7 + r() * 0.9, v: i % 4, sp: 4 + r() * 8, z: r() });
    vignette = mk(); vignette.width = 480; vignette.height = 270;
    { const g = vignette.getContext('2d'), gr = g.createRadialGradient(240, 135, 90, 240, 135, 300); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,10,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, 480, 270); }
    for (let k = 0; k < 2; k++) {
      const c = mk(); c.width = 640; c.height = 150; const g = c.getContext('2d'), rr = mulberry(70 + k);
      for (let i = 0; i < 38; i++) {
        const x = rr() * 640, y = 30 + rr() * 100, rad = 50 + rr() * 90;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.34)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); if (x < rad) { g.save(); g.translate(640, 0); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); }
      }
      g.globalCompositeOperation = 'destination-in';                                      /* feather the top and bottom edges so the bands never show a seam */
      const fm = g.createLinearGradient(0, 0, 0, 150); fm.addColorStop(0, 'rgba(0,0,0,0)'); fm.addColorStop(0.35, 'rgba(0,0,0,1)'); fm.addColorStop(0.65, 'rgba(0,0,0,1)'); fm.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fm; g.fillRect(0, 0, 640, 150); g.globalCompositeOperation = 'source-over';
      fogTex.push(c);
    }
    auroraStrip = mk(); auroraStrip.width = 4; auroraStrip.height = 170;
    { const g = auroraStrip.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 170); gr.addColorStop(0, 'rgba(80,255,200,0)'); gr.addColorStop(0.35, 'rgba(90,255,190,0.55)'); gr.addColorStop(0.7, 'rgba(120,120,255,0.30)'); gr.addColorStop(1, 'rgba(200,80,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 170); }
  }

  /* ---------------------------------------------------------------- weather particles */
  const rain = [], snow = [], spores = [], flies = [], meteors = [], splashes = [];
  const lightning = { t: 0, segs: [], x: 0, next: 4, thunderAt: -1 };
  for (let i = 0; i < 340; i++) rain.push({ x: Math.random() * (W + 200) - 100, y: Math.random() * H, v: 700 + Math.random() * 500, l: 12 + Math.random() * 16, z: Math.random() });
  for (let i = 0; i < 230; i++) snow.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.6, ph: Math.random() * 6, sp: 28 + Math.random() * 50, z: Math.random() });
  for (let i = 0; i < 120; i++) spores.push({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.2, h: [165, 100, 310, 190][i % 4], ph: Math.random() * 6, sp: 10 + Math.random() * 30 });
  for (let i = 0; i < 70; i++) flies.push({ x: Math.random() * W, y: 300 + Math.random() * 150, ph: Math.random() * 6, sp: 0.4 + Math.random() * 0.8, r: 14 + Math.random() * 40, h: i % 3 ? 70 : 170, bl: Math.random() * 6 });

  const WX = ['clear', 'clouds', 'rain', 'storm', 'snow', 'fog', 'spores', 'meteors', 'aurora'];
  const WX_W = { clear: 3, clouds: 2.4, rain: 2.4, storm: 1.2, snow: 1.5, fog: 1.8, spores: 1.6, meteors: 2.2, aurora: 2.2 };
  const WX_LABEL = { clear: 'CLEAR', clouds: 'OVERCAST', rain: 'RAIN', storm: 'THUNDERSTORM', snow: 'SNOWFALL', fog: 'FOG', spores: 'SPORE DRIFT', meteors: 'METEOR SHOWER', aurora: 'AURORA' };
  let wxTimer = 25, wxDir = 1, time = 0;
  for (const k of WX) Sky.wxI[k] = k === 'clear' ? 1 : 0;

  function pickWeather() {
    if (S.weather === 'clear') return 'clear';
    let tot = 0; const opts = [];
    for (const k of WX) {
      if (k === Sky.wx) continue;
      if ((k === 'meteors' || k === 'aurora') && Sky.night < 0.6) continue;
      if (k === 'snow' && Sky.dusk > 0.8) continue;
      opts.push(k); tot += WX_W[k];
    }
    let r = Math.random() * tot;
    for (const k of opts) { r -= WX_W[k]; if (r <= 0) return k; }
    return 'clear';
  }
  Sky.setWeather = function (k) { Sky.wx = k; wxTimer = 45 + Math.random() * 40; wxDir = Math.random() < 0.5 ? -1 : 1; if (k === 'storm') lightning.next = 1.2; };
  Sky.label = function () {
    const tod = Sky.night > 0.6 ? 'NIGHT' : Sky.sunH > 0.4 ? 'DAY' : Sky.t < 0.5 ? 'DAWN' : 'DUSK';
    return tod + ' · ' + WX_LABEL[Sky.wx];
  };

  function newBolt() {
    const x = 120 + Math.random() * (W - 240); lightning.x = x;
    const segs = []; let cx = x, cy = -10;
    const pushPath = (px, py, depth) => {
      let x0 = px, y0 = py;
      while (y0 < HOR - 20 - depth * 40) {
        const nx = x0 + (Math.random() - 0.5) * 70, ny = y0 + 22 + Math.random() * 34;
        segs.push([x0, y0, nx, ny, depth]);
        if (depth < 1 && Math.random() < 0.13) pushPath(nx, ny, depth + 1);
        x0 = nx; y0 = ny;
      }
    };
    pushPath(cx, cy, 0);
    lightning.segs = segs; lightning.t = 0.42;
    lightning.thunderAt = 0.18 + Math.random() * 1.1;
  }

  /* ---------------------------------------------------------------- update */
  Sky.update = function (dt) {
    time += dt;
    /* time of day */
    const fixed = { day: 0.5, dusk: 0.73, night: 0.02 }[S.tod];
    if (fixed === undefined) Sky.t = (Sky.t + dt / Math.max(30, S.dayLen)) % 1;
    else { let d = fixed - Sky.t; d -= Math.round(d); Sky.t = (Sky.t + clamp(d, -0.06 * dt, 0.06 * dt) + 1) % 1; }
    const sunH = Math.sin(TAU * (Sky.t - 0.25));
    Sky.sunH = sunH;
    const bright = smooth(-0.22, 0.28, sunH);
    Sky.day = bright; Sky.night = 1 - smooth(-0.34, 0.1, sunH);
    Sky.dusk = Math.exp(-Math.pow((sunH - 0.01) / 0.2, 2));
    /* weather schedule */
    if (S.weather === 'clear' && Sky.wx !== 'clear') Sky.setWeather('clear');
    wxTimer -= dt;
    if (wxTimer <= 0) Sky.setWeather(pickWeather());
    if ((Sky.wx === 'meteors' || Sky.wx === 'aurora') && Sky.night < 0.35) Sky.setWeather('clear');
    for (const k of WX) {
      const tgt = k === Sky.wx ? 1 : 0, cur = Sky.wxI[k];
      Sky.wxI[k] = clamp(cur + clamp(tgt - cur, -0.3 * dt, 0.22 * dt), 0, 1);
    }
    const I = Sky.wxI;
    Sky.rain = Math.max(I.rain, I.storm); Sky.storm = I.storm; Sky.snow = I.snow; Sky.fog = I.fog;
    Sky.cover = clamp(Math.max(0.16, I.clouds * 0.82, I.rain * 0.9, I.storm, I.snow * 0.7, I.fog * 0.4), 0, 1);
    Sky.dark = I.clouds * 0.12 + I.rain * 0.28 + I.storm * 0.46 + I.snow * 0.1 + I.fog * 0.1;
    const gust = Math.sin(time * 0.35) * 0.12 + Math.sin(time * 1.3 + 2) * 0.08;
    Sky.wind = wxDir * (0.2 + I.storm * 0.95 + I.rain * 0.4 + I.spores * 0.4 + I.snow * 0.18 + I.clouds * 0.1) + gust;
    Sky.glowPulse = 0.78 + 0.22 * Math.sin(time * 1.7);
    /* lightning */
    if (lightning.t > 0) {
      lightning.t -= dt;
      if (lightning.thunderAt >= 0) { lightning.thunderAt -= dt; if (lightning.thunderAt < 0) G.audio.sfx.thunder(0); }
    }
    Sky.flash = lightning.t > 0 ? (Math.sin(lightning.t * 52) > -0.2 ? Math.min(1, lightning.t * 3.2) : 0.2) : 0;
    if (I.storm > 0.55) { lightning.next -= dt; if (lightning.next <= 0) { newBolt(); lightning.next = 2.5 + Math.random() * 6; } }
    const red = S.reduced ? 0.5 : 1;
    /* particles */
    if (Sky.rain > 0.01) {
      const slant = Sky.wind * 220;
      const n = Math.floor(rain.length * Sky.rain * red);
      for (let i = 0; i < n; i++) {
        const p = rain[i];
        p.y += p.v * dt * (0.7 + p.z * 0.5); p.x += slant * dt * (0.6 + p.z * 0.6);
        if (p.y > H - (p.z > 0.5 ? 20 : 120) || p.x < -120 || p.x > W + 120) {
          if (p.z > 0.4 && p.x > 0 && p.x < W && splashes.length < 60 && Math.random() < 0.5) splashes.push({ x: p.x, y: C.GRASS_TOP + 14 + Math.random() * 60, t: 0.28 });
          p.y = -20 - Math.random() * 60; p.x = Math.random() * (W + 240) - 120 - slant * 0.4;
        }
      }
    }
    for (let i = splashes.length - 1; i >= 0; i--) { splashes[i].t -= dt; if (splashes[i].t <= 0) splashes.splice(i, 1); }
    if (Sky.snow > 0.01) {
      const n = Math.floor(snow.length * Sky.snow * red);
      for (let i = 0; i < n; i++) {
        const p = snow[i];
        p.y += p.sp * dt * (0.6 + p.z); p.x += (Math.sin(time * 0.9 + p.ph) * 22 + Sky.wind * 60) * dt;
        if (p.y > H + 6) { p.y = -6; p.x = Math.random() * W; }
        if (p.x < -6) p.x = W + 6; else if (p.x > W + 6) p.x = -6;
      }
    }
    const sporeI = Math.max(I.spores, 0.18 * Sky.night);
    if (sporeI > 0.01) {
      const n = Math.floor(spores.length * sporeI * red);
      for (let i = 0; i < n; i++) {
        const p = spores[i];
        p.x += (Sky.wind * 70 + Math.sin(time * 0.7 + p.ph) * 14) * dt * (I.spores > 0.2 ? 1.6 : 0.7); p.y += Math.sin(time * 0.5 + p.ph * 2) * 12 * dt - 4 * dt;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H; else if (p.y > H + 10) p.y = -10;
      }
    }
    if (I.meteors > 0.4) {
      if (Math.random() < dt * 1.2 * I.meteors * red) {
        const sx = Math.random() * (W + 300), sp = 520 + Math.random() * 420;
        meteors.push({ x: sx, y: -20, vx: -sp * 0.62, vy: sp * 0.5, life: 1.2 + Math.random() * 0.6, t: 0, h: [190, 40, 320][(Math.random() * 3) | 0] });
        if (Math.random() < 0.3) G.audio.sfx.meteor();
      }
    }
    for (let i = meteors.length - 1; i >= 0; i--) { const m = meteors[i]; m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt; if (m.t > m.life || m.y > HOR) meteors.splice(i, 1); }
  };

  /* ---------------------------------------------------------------- drawing */
  const lt = { px: 0, py: 0 };
  Sky.setLook = function (ax, ay) { lt.px = (ax - W / 2) / (W / 2); lt.py = (ay - H / 2) / (H / 2); };

  function drawSkyGradient(ctx) {
    const c = skyColors(Sky.t), dk = Sky.dark * 0.8;
    const grey = [92, 100, 124];
    const top = mix(c[0], mix(grey, c[0], 0.3), dk * 0.7), mid = mix(c[1], grey, dk * 0.75), hor = mix(c[2], grey, dk * 0.7);
    const gr = ctx.createLinearGradient(0, 0, 0, HOR + 20);
    gr.addColorStop(0, rgb(top)); gr.addColorStop(0.55, rgb(mid)); gr.addColorStop(1, rgb(hor));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, HOR + 30);
    Sky.horizonColor = hor; Sky.topColor = top;
  }
  function arcPos(t, rx) { const a = TAU * (t - 0.25); return { x: W * 0.5 - Math.cos(a) * W * rx, h: Math.sin(a) }; }

  Sky.drawBack = function (ctx) {
    if (!built) build();
    drawSkyGradient(ctx);
    const night = Sky.night, hide = 1 - Sky.cover * 0.85;
    /* stars + nebula */
    if (night > 0.02) {
      ctx.globalAlpha = night * 0.55 * hide; ctx.drawImage(nebula, -lt.px * 5, 0);
      ctx.globalAlpha = 1;
      for (const s of stars) {
        const a = night * hide * (0.45 + 0.55 * Math.sin(time * s.sp + s.tw)) * (s.y > HOR - 80 ? 0.4 : 1);
        if (a < 0.03) continue;
        ctx.globalAlpha = a; ctx.fillStyle = s.h === 200 ? '#bfe6ff' : s.h === 30 ? '#ffe9b8' : '#ffffff';
        ctx.fillRect(s.x - lt.px * 2, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }
    /* planet */
    ctx.globalAlpha = (0.2 + 0.8 * night) * (1 - Sky.cover * 0.6) * (1 - Sky.dark * 0.5);
    ctx.drawImage(planet, 600 - lt.px * 6, 20 - lt.py * 3);
    ctx.globalAlpha = 1;
    /* sun */
    const sp = arcPos(Sky.t, 0.46), sy = HOR + 10 - sp.h * (HOR - 40);
    if (sp.h > -0.25) {
      const a = (1 - Sky.cover * 0.8) * smooth(-0.25, 0.05, sp.h), warm = Sky.dusk;
      const R = 40 + warm * 14;
      const gr = ctx.createRadialGradient(sp.x, sy, 4, sp.x, sy, R * 4.4);
      gr.addColorStop(0, rgb(mix([255, 252, 220], [255, 150, 90], warm), 0.7 * a)); gr.addColorStop(1, 'rgba(255,170,100,0)');
      ctx.fillStyle = gr; ctx.fillRect(sp.x - R * 4.4, sy - R * 4.4, R * 8.8, R * 8.8);
      ctx.fillStyle = rgb(mix([255, 250, 215], [255, 130, 70], warm), a); ctx.beginPath(); ctx.arc(sp.x, sy, R * 0.55, 0, TAU); ctx.fill();
    }
    /* moons */
    for (const m of [{ s: moonA, off: 0.5, rx: 0.4, r: 60 }, { s: moonB, off: 0.5 + 0.19, rx: 0.36, r: 30 }]) {
      const p = arcPos(Sky.t + m.off, m.rx), y = HOR + 6 - p.h * (HOR - 60);
      if (p.h > -0.1) { ctx.globalAlpha = smooth(-0.1, 0.1, p.h) * clamp(night * 1.3, 0, 1) * (1 - Sky.cover * 0.7); ctx.drawImage(m.s, p.x - m.r, y - m.r); ctx.globalAlpha = 1; }
    }
    /* aurora */
    const au = Sky.wxI.aurora * night;
    if (au > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      for (let r = 0; r < 3; r++) {
        for (let x = 0; x < W + 16; x += 9) {
          const wv = Math.sin(x * 0.012 + time * (0.35 + r * 0.12) + r * 2) * 28 + Math.sin(x * 0.027 - time * 0.5 + r) * 14;
          ctx.globalAlpha = au * (0.35 + 0.3 * Math.sin(x * 0.02 + time * 0.8 + r * 3)) * (r === 1 ? 0.7 : 1) * 0.95;
          ctx.drawImage(auroraStrip, x, 40 + r * 34 + wv, 12, 150 + Math.sin(x * 0.03 + time + r) * 30);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    /* meteors */
    if (meteors.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const m of meteors) {
        const f = 1 - m.t / m.life, tx = m.x - m.vx * 0.12, ty = m.y - m.vy * 0.12;
        const gr = ctx.createLinearGradient(m.x, m.y, tx, ty); gr.addColorStop(0, 'hsla(' + m.h + ',100%,92%,' + f + ')'); gr.addColorStop(1, 'hsla(' + m.h + ',100%,60%,0)');
        ctx.strokeStyle = gr; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    /* clouds */
    drawClouds(ctx);
    /* lightning bolt */
    if (lightning.t > 0 && lightning.segs.length) {
      ctx.lineCap = 'round';
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass ? 'rgba(255,255,255,' + Math.min(1, lightning.t * 4) + ')' : 'rgba(150,170,255,' + Math.min(0.5, lightning.t * 2) + ')';
        ctx.lineWidth = pass ? 2 : 7;
        ctx.beginPath(); for (const s of lightning.segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke();
      }
    }
    /* forest layers back to front; the glow-points ride on the night variant */
    const nf = night, sway = Math.sin(time * 0.4) * 1.2;
    for (const L of LAYERS) {
      const ox = -PAD - lt.px * L.par * 600 + sway * L.par * 40, oy = L.y0;
      if (nf < 0.98) ctx.drawImage(L.day, ox, oy, LW, L.h);
      if (nf > 0.02) { ctx.globalAlpha = nf; ctx.drawImage(L.night, ox, oy, LW, L.h); ctx.globalAlpha = 1; }
      if (L.name === 'far') hazeBand(ctx, 40);
      if (L.name === 't1' || L.name === 't2') hazeBand(ctx, 70, L.name === 't1' ? 0.5 : 0.3);
      drawGlows(ctx, L, ox, oy);
    }
    /* back weather: far rain layer, back fog */
    drawFog(ctx, 0);
    if (Sky.rain > 0.01) drawRain(ctx, 0);
    drawParticlesBack(ctx);
    /* darkness of the storm over the scenery */
    if (Sky.dark > 0.01) { ctx.fillStyle = 'rgba(8,12,34,' + (Sky.dark * (0.55 - 0.25 * night)) + ')'; ctx.fillRect(0, 0, W, H); }
  };
  function hazeBand(ctx, hgt, a) {
    const hc = Sky.horizonColor || [160, 200, 240], al = (a === undefined ? 0.55 : a) * (0.35 + 0.65 * (1 - Sky.night * 0.7));
    const gr = ctx.createLinearGradient(0, HOR - hgt, 0, HOR + 18); gr.addColorStop(0, rgb(hc, 0)); gr.addColorStop(1, rgb(hc, al * 0.55));
    ctx.fillStyle = gr; ctx.fillRect(0, HOR - hgt, W, hgt + 18);
  }
  function drawGlows(ctx, L, ox, oy) {
    const a = Sky.night * 0.95 + (1 - Sky.night) * 0.1 * Sky.dark;
    if (a < 0.03 || !L.glows) return;
    ctx.globalCompositeOperation = 'lighter';
    const pulse = Sky.glowPulse;
    for (let i = 0; i < L.glows.length; i++) {
      const g = L.glows[i], sw = 0.82 + 0.18 * Math.sin(time * 1.4 + i * 1.7);
      ctx.globalAlpha = Math.min(1, a * sw * (g.grass ? 0.6 : pulse));
      const r = g.r * (g.grass ? 1 : 0.9 + 0.2 * sw);
      ctx.drawImage(glowSprite(g.h), ox + g.x - r, oy + g.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawClouds(ctx) {
    const cov = Sky.cover; if (cov < 0.05) return;
    const g = cloudCv.getContext('2d'); g.clearRect(0, 0, W, 320);
    const n = Math.round(clouds.length * (0.35 + 0.65 * cov));
    for (let i = 0; i < n; i++) {
      const c = clouds[i];
      c.x += (Sky.wind * 18 + c.sp * 0.3 * Math.sign(Sky.wind || 1)) * 0.016 * (0.5 + c.z);
      if (c.x > W + 220) c.x = -380; else if (c.x < -380) c.x = W + 220;
      const sc = c.s * (1 + cov * 0.35);
      const cs = cloudSprites[c.v]; g.drawImage(cs, c.x - lt.px * 8 * c.z, c.y - lt.py * 3, cs.width * sc, cs.height * sc);
    }
    const base = mix([44, 54, 108], [252, 253, 255], Sky.day);
    const tint = mix(mix(base, [255, 150, 120], Sky.dusk * 0.75), [78, 86, 108], clamp(Sky.dark * 1.7, 0, 0.9));
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = rgb(tint, IMG.cloud1 ? 0.62 : 0.88); g.fillRect(0, 0, W, 320); g.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = clamp(cov * 1.1, 0, 0.96); ctx.drawImage(cloudCv, 0, 0); ctx.globalAlpha = 1;
  }
  function drawFog(ctx, front) {
    const f = Sky.fog; if (f < 0.02) return;
    const tint = Sky.night > 0.5 ? 0.25 : 1;
    for (let k = 0; k < 2; k++) {
      const y = front ? 400 + k * 30 : 292 + k * 54, sp = (k ? 14 : 8) * (front ? 1.6 : 1), off = (time * sp * (1 + Math.abs(Sky.wind) * 0.4) * Math.sign(-Sky.wind || 1)) % 640;
      ctx.globalAlpha = f * (front ? 0.5 : 0.65) * tint; ctx.fillStyle = 'rgba(255,255,255,1)';
      for (let x = -640 + off; x < W + 640; x += 640) ctx.drawImage(fogTex[k], x, y, 640, front ? 190 : 170);
    }
    if (Sky.night > 0.4) { ctx.globalAlpha = f * 0.35 * Sky.night; ctx.fillStyle = '#1a2a60'; ctx.fillRect(0, 290, W, H - 290); }
    ctx.globalAlpha = 1;
  }
  function drawRain(ctx, front) {
    const n = Math.floor(rain.length * Sky.rain * (S.reduced ? 0.5 : 1)), slant = Sky.wind * 0.22;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 1; pass++) {
      ctx.strokeStyle = front ? 'rgba(210,230,255,' + (0.4 + 0.15 * Sky.storm) + ')' : 'rgba(190,215,255,0.2)'; ctx.lineWidth = front ? 1.5 : 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p = rain[i]; if ((p.z > 0.5) !== !!front) continue;
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l * slant * 4, p.y - p.l * (front ? 1.25 : 0.8));
      }
      ctx.stroke();
    }
  }
  function drawParticlesBack(ctx) {
    const nightFly = Sky.night * (1 - Sky.rain * 0.9);
    if (nightFly > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const x = f.x + Math.sin(time * f.sp + f.ph) * f.r, y = f.y + Math.cos(time * f.sp * 0.8 + f.ph * 1.7) * f.r * 0.5;
        const b = Math.max(0, Math.sin(time * 1.6 + f.bl)); if (b < 0.1) continue;
        ctx.globalAlpha = nightFly * b * 0.9; const r = 7 + b * 5; ctx.drawImage(glowSprite(f.h), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  function drawSpores(ctx) {
    const sporeI = Math.max(Sky.wxI.spores, 0.18 * Sky.night); if (sporeI < 0.01) return;
    const n = Math.floor(spores.length * sporeI * (S.reduced ? 0.5 : 1));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const p = spores[i], r = p.r * 4.2, tw = 0.5 + 0.5 * Math.sin(time * 2 + p.ph);
      ctx.globalAlpha = (0.35 + 0.45 * tw) * Math.min(1, sporeI * 1.5 + 0.2); ctx.drawImage(glowSprite(p.h), p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function drawSnow(ctx) {
    if (Sky.snow < 0.01) return;
    const n = Math.floor(snow.length * Sky.snow * (S.reduced ? 0.5 : 1));
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const p = snow[i]; ctx.moveTo(p.x + p.r * (0.6 + p.z * 0.8), p.y); ctx.arc(p.x, p.y, p.r * (0.6 + p.z * 0.8), 0, TAU); }
    ctx.fill();
  }

  function drawGrassLayer(ctx, G2, amp, ph) {
    const bands = 9, bh = G2.h / bands, sw = Math.sin(time * 1.15 + ph) * amp * (0.55 + Math.abs(Sky.wind)) + Sky.wind * amp * 0.9;
    for (let b = 0; b < bands; b++) {
      const f = Math.pow((bands - b) / bands, 1.7), dx = sw * f + Math.sin(time * 2.1 + ph + b) * f * amp * 0.12 * (0.4 + Math.abs(Sky.wind));
      const sy = b * bh * RS, y = G2.y0 + b * bh;
      const ox = -PAD + dx - lt.px * 7;
      if (Sky.night < 0.98) ctx.drawImage(G2.day, 0, sy, G2.day.width, bh * RS + 0.5, ox, y, LW, bh + 0.4);
      if (Sky.night > 0.02) { ctx.globalAlpha = Sky.night; ctx.drawImage(G2.night, 0, sy, G2.night.width, bh * RS + 0.5, ox, y, LW, bh + 0.4); ctx.globalAlpha = 1; }
    }
    drawGlows(ctx, G2, -PAD + sw * 0.15, G2.y0);
  }
  Sky.drawGrassBack = function (ctx) { drawGrassLayer(ctx, GRASS.back, 5, 0.7); };
  Sky.drawGrassFront = function (ctx) { drawGrassLayer(ctx, GRASS.front, 7, 2.3); };
  /* everything that goes over the scene but under the HUD */
  Sky.drawFront = function (ctx) {
    drawFog(ctx, 1);
    drawSpores(ctx);
    if (Sky.rain > 0.01) {
      drawRain(ctx, 1);
      ctx.strokeStyle = 'rgba(210,235,255,0.5)'; ctx.lineWidth = 1;
      for (const s of splashes) { const k = 1 - s.t / 0.28; ctx.globalAlpha = (1 - k) * 0.8; ctx.beginPath(); ctx.ellipse(s.x, s.y, 2 + k * 9, 1 + k * 3, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    drawSnow(ctx);
    if (Sky.dusk > 0.02) { const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,110,160,' + 0.05 * Sky.dusk + ')'); gr.addColorStop(0.7, 'rgba(255,140,60,' + 0.14 * Sky.dusk + ')'); gr.addColorStop(1, 'rgba(120,40,90,' + 0.12 * Sky.dusk + ')'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = 0.5 + 0.2 * Sky.night; ctx.drawImage(vignette, 0, 0, W, H); ctx.globalAlpha = 1;
    if (Sky.flash > 0.01) { ctx.fillStyle = 'rgba(210,225,255,' + (Sky.flash * 0.55 * (S.reduced ? 0.4 : 1)) + ')'; ctx.fillRect(0, 0, W, H); }
  };
  Sky.init = function () { build(); };
  Sky.forceTime = function (t) { Sky.t = t; };
})((window.SGS = window.SGS || {}));
