(function (G) {
  'use strict';

  const C = {
    W: 960,
    H: 540,
    REPO: 'https://github.com/nbwillcox/SpaceDuckHunter',
    HORIZON: 372,          /* y where the far forest meets the ground */
    GRASS_TOP: 432,        /* y of the tallest blades in the foreground grass (ducks launch from just below this) */
    LAUNCH_Y: 452,
    CLIP: 3,               /* bullets per magazine */
    RELOAD: 0.85,          /* seconds */
    LEVEL_DUCKS: 10,
  };

  const KEY = 'spaceduckhunter.settings.v1';
  const defaults = {
    master: 0.8, music: 0.5, sfx: 0.9, ambient: 0.6,
    shake: true, reduced: false, autoReload: false,
    tod: 'cycle', weather: 'dynamic', dayLen: 240, aim: 1,
  };

  const S = Object.assign({}, defaults);
  let hadSaved = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { Object.assign(S, JSON.parse(raw)); hadSaved = true; }
  } catch (e) { /* storage unavailable */ }
  S.save = function () {
    try {
      const o = {};
      for (const k in defaults) o[k] = S[k];
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) { /* ignore */ }
  };
  if (!hadSaved && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) S.reduced = true;
  G.C = C;
  G.settings = S;
})((window.SGS = window.SGS || {}));
