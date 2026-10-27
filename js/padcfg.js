/* Controller map for SpaceDuckHunter: sticks / D-pad move the crosshair (as a pointer), A / triggers shoot, B / X reload. Read by js/pad.js. */
window.PAD_CFG = {
  id: 'spaceduckhunter', title: 'SpaceDuckHunter',
  hint: '<b>Sticks / D-pad</b> aim &nbsp; <b>A / RT / RB</b> shoot &nbsp; <b>B / X / LT</b> reload &nbsp; <b>Start</b> pause',
  cursor: { sticks: ['left', 'right'], speed: 900, pointer: true, dpad: true },
  actions: [
    { id: 'shoot', label: 'Shoot', btn: ['A', 'RT', 'RB'], mouse: 0 },
    { id: 'reload', label: 'Reload', btn: ['B', 'X', 'LT'], mouse: 2 },
  ],
};
