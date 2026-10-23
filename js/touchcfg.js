/* Touch controls for SpaceDuckHunter: tap the screen to shoot where you tap; one RELOAD button. Read by js/mobile.js. */
window.TOUCH_CFG = {
  id: 'spaceduckhunter', title: 'SpaceDuckHunter', orient: 'landscape', accent: '#7dff6a',
  hint: '<b>Tap</b> anywhere to shoot there &middot; tap <b>RELOAD</b> when the clip is empty',
  unlock: () => window.SGS && window.SGS.audio && window.SGS.audio.resume(),
  pause: { pos: { r: 12, t: 10 } },
  controls: [
    { t: 'btn', id: 'reload', label: 'RELOAD', key: 'KeyR', hold: false, size: 92, pos: { r: 18, b: 84 } },
  ],
};
