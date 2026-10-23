/* Game rules + state machine: level intro (the sniffing raccoon), rounds of flying ducks, 3-shot budget with a reloadable clip, the raccoon's reactions, quota checks, endless levels. */
(function (G) {
  'use strict';
  const U = G.U, C = G.C, S = G.settings, A = G.audio, I = G.input, Art = G.art, Sky = G.sky;
  const W = C.W, H = C.H, SFX = A.sfx;
  const TAU = Math.PI * 2;
  const FLAP = [0, 1, 2, 3, 2, 1];
  const BASE = { black: 500, blue: 1000, red: 1500 };

  const Game = {
    demo: true, bot: false, phase: 'idle', level: 1, score: 0, t: 0,
    ducks: [], parts: [], popups: [], rings: [], banner: null, shake: 0, flash: 0,
    row: [], quota: 6, levelHits: 0, spawned: 0, roundN: 0, roundHits: 0, roundSize: 2, lastLandX: W / 2,
    clip: 3, budget: 3, reloadT: 0, hint: null, hintT: 0, coon: null, onOver: null, perfect: false,
    stats: { shots: 0, hits: 0 },
  };
  G.game = Game;

  /* ---------------------------------------------------------------- level tuning (endless: ducks get faster, then more of them) */
  function params(L) {
    const size = Math.min(8, 2 + Math.floor((L - 1) / 2));
    let speed = L <= 14 ? 150 + 22 * L : 458 + (L - 14) * 7;
    speed = Math.min(640, speed);
    return { size, speed, flyT: Math.max(4.4, 7.6 - 0.2 * L), quota: Math.min(9, 6 + Math.floor((L - 1) / 3)), turn: Math.max(0.3, 1.5 - 0.05 * L), mult: 1 + Math.floor((L - 1) / 3) * 0.5 };
  }
  Game.params = params;
  function pickColor(L) {
    if (L < 3) return 'black';
    const red = U.clamp((L - 5) * 0.12, 0, 0.7), blue = U.clamp(0.2 + (L - 3) * 0.12, 0, 0.85) * (1 - red), r = Math.random();
    return r < red ? 'red' : r < red + blue ? 'blue' : 'black';
  }

  /* ---------------------------------------------------------------- effects */
  function feathers(x, y, col, n) {
    for (let i = 0; i < n; i++) Game.parts.push({ k: 'f', x, y, vx: U.rand(-190, 190), vy: U.rand(-260, 40), rot: U.rand(0, TAU), vr: U.rand(-7, 7), life: U.rand(0.9, 1.6), max: 1.6, col, sz: U.rand(5, 10) });
    for (let i = 0; i < 10; i++) Game.parts.push({ k: 's', x, y, vx: U.rand(-300, 300), vy: U.rand(-300, 300), life: U.rand(0.2, 0.45), max: 0.45, col: '#fff6c0', sz: U.rand(1.5, 3) });
  }
  function popup(text, x, y, col, size) { Game.popups.push({ text, x, y, t: 0, col: col || '#ffe36a', size: size || 26 }); }
  function banner(text, sub, dur, col) { Game.banner = { text, sub, t: 0, dur, col: col || '#ffffff' }; }
  function hint(text, t) { Game.hint = text; Game.hintT = t || 0.9; }

  /* ---------------------------------------------------------------- ducks */
  function newDuck(x, y, color, p, idx) {
    const ang = -U.rand(0.45, 1.25) - (Math.random() < 0.5 ? 0 : 0), dir = Math.random() < 0.5 ? -1 : 1;
    const sp = p.speed * ({ black: 1, blue: 1.1, red: 1.22 }[color]) * U.rand(0.9, 1.1);
    return {
      x, y, color, sp, vx: Math.cos(ang) * sp * dir, vy: Math.sin(ang) * sp, state: 'fly', t: 0, flap: Math.random() * 6, dirT: U.rand(0.2, 0.6),
      turn: p.turn, size: 90, val: Math.round(BASE[color] * p.mult / 50) * 50, idx, spin: 0, quack: U.rand(0.1, 1.2),
    };
  }
  function steer(d, dt) {
    d.dirT -= dt;
    if (d.dirT <= 0) {
      d.dirT = d.turn * U.rand(0.55, 1.3);
      let a;
      if (d.y > 330) a = -U.rand(0.25, 1.35);
      else if (d.y < 120) a = U.rand(0.1, 1.2);
      else a = U.rand(-1.3, 1.1);
      const dir = Math.random() < 0.5 ? -1 : 1;
      d.tx = Math.cos(a) * d.sp * dir; d.ty = Math.sin(a) * d.sp;
    }
    if (d.tx !== undefined) { const k = Math.min(1, dt * 7); d.vx += (d.tx - d.vx) * k; d.vy += (d.ty - d.vy) * k; }
    const m = Math.hypot(d.vx, d.vy) || 1; d.vx *= d.sp / m; d.vy *= d.sp / m;
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.x < 44) { d.x = 44; d.vx = Math.abs(d.vx); if (d.tx !== undefined) d.tx = Math.abs(d.tx); }
    else if (d.x > W - 44) { d.x = W - 44; d.vx = -Math.abs(d.vx); if (d.tx !== undefined) d.tx = -Math.abs(d.tx); }
    if (d.y < 52) { d.y = 52; d.vy = Math.abs(d.vy); if (d.ty !== undefined) d.ty = Math.abs(d.ty); }
    else if (d.y > 392) { d.y = 392; d.vy = -Math.abs(d.vy); if (d.ty !== undefined) d.ty = -Math.abs(d.ty); }
  }
  function updateDucks(dt) {
    for (const d of Game.ducks) {
      d.t += dt;
      if (d.state === 'fly') {
        steer(d, dt);
        d.flap += dt * (8 + d.sp / 70);
        d.quack -= dt; if (d.quack <= 0) { d.quack = U.rand(1.6, 4); if (Game.phase === 'fly' || Game.demo) SFX.quack(U.rand(0.85, 1.25)); }
      } else if (d.state === 'hit') {
        if (d.t > 0.34) { d.state = 'fall'; d.t = 0; d.vy = 0; d.vx = U.rand(-30, 30); SFX.fall(0.75); }
      } else if (d.state === 'fall') {
        d.vy += 1050 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.spin += dt;
        if (d.y >= C.LAUNCH_Y + 4) { d.state = 'landed'; d.t = 0; SFX.thud(); Game.lastLandX = U.clamp(d.x, 150, W - 150); Game.shake = Math.max(Game.shake, 3); Game.roundHits++; }
      } else if (d.state === 'escape') {
        d.vy += (-420 - d.vy) * Math.min(1, dt * 3); d.vx += (Math.sign(d.vx || 1) * 90 - d.vx) * Math.min(1, dt * 2);
        d.x += d.vx * dt; d.y += d.vy * dt; d.flap += dt * 16;
        if (d.y < -90) { d.state = 'gone'; }
      }
    }
  }
  function escapeAll() {
    let any = false;
    for (const d of Game.ducks) if (d.state === 'fly') { d.state = 'escape'; d.t = 0; Game.row[d.idx] = 2; any = true; }
    if (any) SFX.escape();
  }

  /* ---------------------------------------------------------------- shooting */
  Game.reserve = () => Math.max(0, Game.budget - Game.clip);
  Game.reloadFrac = () => (Game.reloadT > 0 ? 1 - Game.reloadT / C.RELOAD : 0);
  function startReload() {
    if (Game.phase !== 'fly' || Game.reloadT > 0) return;
    if (Game.clip >= C.CLIP) { return; }
    if (Game.reserve() <= 0) { hint(Game.clip <= 0 ? 'OUT OF SHOTS' : 'NO SPARE SHOTS', 0.9); return; }
    Game.reloadT = C.RELOAD; SFX.reload(C.RELOAD);
  }
  function shoot(x, y) {
    if (Game.phase !== 'fly') return;
    if (Game.reloadT > 0) { SFX.dry(); return; }
    if (Game.clip <= 0) {
      SFX.dry();
      if (Game.reserve() > 0) { hint('RELOAD!', 1.0); if (S.autoReload) startReload(); } else hint('OUT OF SHOTS', 0.9);
      return;
    }
    Game.clip--; Game.budget--; Game.stats.shots++; Game.lastShotT = Game.t;
    SFX.shot(); Game.flash = 0.16; Game.recoil = 1;
    if (S.shake) Game.shake = Math.max(Game.shake, 4);
    Game.rings.push({ x, y, t: 0, max: 0.28, col: '#ffffff', r: 8 });
    let best = null, bd = 1e9;
    for (const d of Game.ducks) {
      if (d.state !== 'fly') continue;
      const rx = d.size * 0.52 + 9, ry = d.size * 0.4 + 9, dx = (x - d.x) / rx, dy = (y - d.y) / ry, q = dx * dx + dy * dy;
      if (q <= 1 && q < bd) { bd = q; best = d; }
    }
    if (best) {
      const d = best; d.state = 'hit'; d.t = 0; Game.row[d.idx] = 1; Game.levelHits++; Game.stats.hits++;
      Game.score += d.val; SFX.hit(); feathers(d.x, d.y, d.color === 'red' ? '#e3303f' : d.color === 'blue' ? '#4a86ff' : '#2fe0a0', 14);
      popup('+' + d.val, d.x, d.y - 34, d.color === 'red' ? '#ff8c8c' : d.color === 'blue' ? '#9cc4ff' : '#ffe36a', 28);
      Game.rings.push({ x: d.x, y: d.y, t: 0, max: 0.4, col: '#fff0a0', r: 14 });
    }
    if (Game.clip <= 0 && Game.reserve() > 0 && S.autoReload) startReload();
  }

  /* ---------------------------------------------------------------- phases */
  function beginLevel() {
    const p = params(Game.level);
    Game.row = new Array(C.LEVEL_DUCKS).fill(0); Game.quota = p.quota; Game.levelHits = 0; Game.spawned = 0; Game.roundN = 0;
    Game.phase = 'intro'; Game.pt = 0; Game.coon = { x: -100, y: 478, name: 'sniff', h: 128, front: true, flip: false };
    Game.ducks.length = 0; Game.perfect = false; Game.introFlags = {};
  }
  function startRound() {
    const p = params(Game.level), left = C.LEVEL_DUCKS - Game.spawned, size = Math.min(p.size, left);
    Game.roundSize = size; Game.roundN++; Game.roundHits = 0; Game.ducks.length = 0;
    Game.budget = Math.max(4, size + 2); Game.clip = Math.min(C.CLIP, Game.budget); Game.reloadT = 0;
    Game.flyT = p.flyT + 0.3 * Math.max(0, size - 2); Game.lastShotT = Game.t; Game.coon = null;
    const xs = []; const lo = 130, hi = W - 130;
    for (let i = 0; i < size; i++) xs.push(lo + (hi - lo) * ((i + U.rand(0.1, 0.9)) / size));
    for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
    for (let i = 0; i < size; i++) Game.ducks.push(newDuck(xs[i], C.LAUNCH_Y + 12, pickColor(Game.level), p, Game.spawned + i));
    Game.spawned += size;
    Game.phase = 'fly'; Game.pt = 0;
    banner('ROUND ' + Game.roundN, null, 0.9, '#ffe36a');
    Game.ducks.forEach((d, i) => setTimeout(() => SFX.quack(U.rand(0.9, 1.3)), i * 90));
  }
  function startCoon() {
    Game.phase = 'coon'; Game.pt = 0;
    const hits = Game.roundHits;
    Game.coonMode = hits >= 2 ? 'hold2' : hits === 1 ? 'hold1' : 'laugh';
    Game.coonX = hits > 0 ? Game.lastLandX : U.rand(280, 680);
    Game.coonT = hits > 0 ? 1.55 : 2.0;
    Game.coonVar = Math.floor(Math.random() * 3);
  }
  function endLevel() {
    Game.phase = 'levelend'; Game.pt = 0;
    const ok = Game.levelHits >= Game.quota;
    Game.perfect = Game.levelHits === C.LEVEL_DUCKS;
    Game.ok = ok;
    if (ok) {
      if (Game.perfect) { Game.score += 10000; banner('PERFECT!!', '+10,000 BONUS', 3.2, '#ffe36a'); SFX.perfect(); }
      else { banner('LEVEL CLEAR', Game.levelHits + ' / ' + C.LEVEL_DUCKS + ' HIT', 3.0, '#9dffb4'); SFX.clear(); }
    } else {
      banner('GAME OVER', 'NEEDED ' + Game.quota + ' HITS · GOT ' + Game.levelHits, 99, '#ff7a7a'); SFX.over();
      Game.coonMode = 'laugh'; Game.coonX = W / 2; Game.coonVar = 1; Game.overT = 0;
      setTimeout(() => SFX.laugh(1), 500);
    }
  }

  /* raccoon placement during the intro walk-in */
  function coonIntro(t) {
    const c = Game.coon, F = Game.introFlags;
    if (t < 2.4) {
      const u = t / 2.4; c.x = -90 + 520 * u; c.y = 478 + Math.sin(t * 13) * 3; c.name = 'sniff'; c.h = 124; c.front = true; c.rot = Math.sin(t * 13) * 0.02;
      const k = Math.floor(t / 0.62); if (F.sn !== k) { F.sn = k; SFX.sniff(); }
    } else if (t < 2.95) {
      const u = (t - 2.4) / 0.55; c.x = 430; c.y = 478 - 34 * Math.sin(u * Math.PI); c.name = 'jump'; c.h = 140; c.front = true; c.rot = 0;
      if (!F.al) { F.al = 1; SFX.alert(); }
    } else if (t < 3.7) {
      const u = (t - 2.95) / 0.75; c.x = 430 + 84 * u; c.y = 478 - 190 * Math.sin(Math.PI * u) + (u > 0.72 ? ((u - 0.72) / 0.28) * 150 : 0); c.name = 'jump'; c.h = 140; c.front = u < 0.68; c.rot = (u - 0.5) * 0.4;
      if (!F.jp) { F.jp = 1; SFX.jump(); }
    } else c.hidden = true;
  }

  /* ---------------------------------------------------------------- main update */
  let ambT = 0, flapT = 0;
  Game.update = function (dt) {
    Game.t += dt;
    Sky.update(dt);
    ambT += dt; if (ambT > 0.12) { A.ambient(ambT, { night: Sky.night, day: Sky.day, rain: Sky.rain, storm: Sky.storm, wind: Sky.wind, snow: Sky.snow }); ambT = 0; }
    if (Game.shake > 0) Game.shake = Math.max(0, Game.shake - dt * 26);
    if (Game.flash > 0) Game.flash -= dt;
    if (Game.recoil > 0) Game.recoil = Math.max(0, Game.recoil - dt * 7);
    if (Game.hintT > 0) Game.hintT -= dt;
    for (let i = Game.parts.length - 1; i >= 0; i--) {
      const p = Game.parts[i]; p.life -= dt; if (p.life <= 0) { Game.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'f') { p.vy += 380 * dt; p.vx *= 1 - dt * 1.8; p.rot += p.vr * dt; p.vr *= 1 - dt * 0.8; }
      else { p.vx *= 1 - dt * 5; p.vy *= 1 - dt * 5; }
    }
    for (let i = Game.popups.length - 1; i >= 0; i--) { const p = Game.popups[i]; p.t += dt; p.y -= 38 * dt; if (p.t > 1.1) Game.popups.splice(i, 1); }
    for (let i = Game.rings.length - 1; i >= 0; i--) { const r = Game.rings[i]; r.t += dt; if (r.t > r.max) Game.rings.splice(i, 1); }
    if (Game.banner) { Game.banner.t += dt; if (Game.banner.t > Game.banner.dur) Game.banner = null; }

    if (Game.demo) { attract(dt); return; }
    Game.pt += dt;
    switch (Game.phase) {
      case 'intro': {
        coonIntro(Game.pt);
        I.takeShot(); I.takeReload();
        if (Game.pt > 3.7) {
          Game.coon = null; Game.phase = 'banner'; Game.pt = 0;
          banner('LEVEL ' + Game.level, 'HIT ' + Game.quota + ' OF ' + C.LEVEL_DUCKS + ' TO ADVANCE', 1.7, '#ffffff'); SFX.round();
        }
        break;
      }
      case 'banner': I.takeShot(); I.takeReload(); if (Game.pt > 1.8) startRound(); break;
      case 'fly': flyPhase(dt); break;
      case 'resolve': updateDucks(dt); if (Game.pt > 0.55) { if (Game.roundHits > 0 || true) startCoon(); } break;
      case 'coon': {
        I.takeShot(); I.takeReload();
        if (!Game.coonSfx) { Game.coonSfx = true; if (Game.coonMode === 'laugh') SFX.laugh(Game.coonVar); else SFX.pop(); }
        if (Game.pt > Game.coonT + 0.56) {
          Game.coonSfx = false;
          if (Game.spawned < C.LEVEL_DUCKS) { Game.phase = 'prep'; Game.pt = 0; } else endLevel();
        }
        break;
      }
      case 'prep': I.takeShot(); I.takeReload(); if (Game.pt > 0.35) startRound(); break;
      case 'levelend': {
        I.takeShot(); I.takeReload();
        if (Game.ok) { if (Game.pt > (Game.perfect ? 3.4 : 3.1)) { Game.level++; beginLevel(); } }
        else {
          Game.overT += dt;
          if (Game.overT > 2.6 && Game.onOver) { const f = Game.onOver; Game.onOver = null; Game.phase = 'dead'; f(); }
        }
        break;
      }
      default: break;
    }
  };

  function flyPhase(dt) {
    if (Game.bot) botThink(dt);
    let s; while ((s = I.takeShot())) shoot(s.x, s.y);
    if (I.takeReload()) startReload();
    if (Game.reloadT > 0) { Game.reloadT -= dt; if (Game.reloadT <= 0) { Game.reloadT = 0; Game.clip = Math.min(C.CLIP, Game.budget); SFX.blip(); } }
    updateDucks(dt);
    flapT -= dt; if (flapT <= 0 && Game.ducks.some((d) => d.state === 'fly')) { flapT = 0.1; SFX.flap(); }
    Game.flyT -= dt;
    const alive = Game.ducks.some((d) => d.state === 'fly');
    if (alive && (Game.flyT <= 0 || (Game.budget <= 0 && Game.t - Game.lastShotT > 0.7 && !Game.ducks.some((d) => d.state === 'hit')))) escapeAll();
    if (Game.ducks.every((d) => d.state === 'landed' || d.state === 'gone')) { Game.phase = 'resolve'; Game.pt = 0; }
  }

  /* attract mode behind the title screen: a few ducks wander and leave, then a new flock appears */
  let attractT = 0;
  function attract(dt) {
    attractT -= dt;
    if (!Game.ducks.length || attractT <= 0 && Game.ducks.every((d) => d.state === 'gone')) {
      Game.ducks.length = 0;
      const p = params(1 + Math.floor(Math.random() * 6));
      for (let i = 0; i < 3; i++) Game.ducks.push(newDuck(U.rand(160, 800), C.LAUNCH_Y + 12, pickColor(5), p, i));
      attractT = U.rand(14, 20);
    }
    if (attractT <= 0 && Game.ducks.some((d) => d.state === 'fly')) for (const d of Game.ducks) if (d.state === 'fly') d.state = 'escape';
    updateDucks(dt);
  }

  /* simple autopilot used by ?bot=1 and for testing */
  let botCool = 0, botMiss = 0;
  function botThink(dt) {
    botCool -= dt;
    if (Game.clip <= 0 && Game.reserve() > 0 && Game.reloadT <= 0) { I.x = W / 2; I._reload = true; return; }
    if (Game.reloadT > 0 || botCool > 0) return;
    let tgt = null, bd = 1e9;
    for (const d of Game.ducks) if (d.state === 'fly') { const q = U.dist2(I.x, I.y, d.x, d.y); if (q < bd) { bd = q; tgt = d; } }
    if (!tgt) return;
    const lead = 0.1;
    const tx = tgt.x + tgt.vx * lead, ty = tgt.y + tgt.vy * lead;
    I.x = U.lerp(I.x, tx, 0.6); I.y = U.lerp(I.y, ty, 0.6);
    if (Math.hypot(I.x - tx, I.y - ty) < 26) {
      botCool = 0.32;
      const off = (Math.random() < 0.18 + Game.level * 0.012) ? U.rand(40, 90) : 0;
      I.fire(I.x + off, I.y);
    }
  }

  /* ---------------------------------------------------------------- lifecycle */
  Game.reset = function (demo, level) {
    Game.demo = !!demo; Game.level = level || 1; Game.score = 0; Game.ducks.length = 0; Game.parts.length = 0; Game.popups.length = 0; Game.rings.length = 0;
    Game.banner = null; Game.coon = null; Game.coonSfx = false; Game.stats = { shots: 0, hits: 0 }; Game.reloadT = 0; Game.clip = C.CLIP; Game.budget = C.CLIP;
    Game.row = new Array(C.LEVEL_DUCKS).fill(0); Game.quota = params(Game.level).quota; Game.levelHits = 0; Game.spawned = 0;
    Game.phase = demo ? 'idle' : 'banner'; Game.pt = 0;
    if (!demo) beginLevel();
  };
  Game.hasTarget = () => Game.phase === 'fly';
})((window.SGS = window.SGS || {}));
