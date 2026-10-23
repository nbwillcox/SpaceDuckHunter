# SpaceDuckHunter

A free, retro-flavored duck-shooting game with a head nod to the classic light-gun duck hunt: ducks burst out of the grass, you get a handful of shots, and a very smug raccoon laughs at every miss. The grass is now a glowing **space forest** with a real **day / night cycle** and **dynamic weather** (clear, overcast, rain, thunderstorms with lightning, snow, fog, drifting spores, meteor showers and aurora).

**Play it in your browser:** https://nbwillcox.github.io/SpaceDuckHunter/

The raccoon, the ducks and the forest scenery are AI-generated pictures (Z-Image Turbo via ComfyUI, in `assets/`); the sky, day/night lighting, weather, effects and all sound (including the gunshot, reload, wing flaps, quacks and the raccoon's laugh) are generated in code with Canvas and Web Audio. No build step. A sibling of [SpaceBert](https://github.com/nbwillcox/SpaceBert), [SpaceFox](https://github.com/nbwillcox/SpaceFox) and the other Space games.

## How to play

- Each **level** is 10 ducks, released in rounds (2 at a time at first). You get a few shots per round (spare shots show as `+N`), so make them count.
- Hit enough ducks to reach the level's **quota** (6 of 10 at first, rising to 9) or the raccoon wins and it is game over. Hit all 10 for a **PERFECT** bonus.
- Levels never end: ducks get faster, the flocks get bigger (up to 8 on screen), blue and red ducks are worth more, and the timer gets shorter.
- Your magazine holds 3 shots. When it runs dry, **reload** (takes a moment) as long as you still have spare shots in the round.
- A raccoon laughs if you miss every duck in a round, and also if ducks escape and you got nothing.

## Controls

| Action | Mouse | Gamepad | Keyboard |
| --- | --- | --- | --- |
| Aim | Move the mouse | Left or right stick (d-pad too) | Arrows / `WASD` |
| Shoot | Left click | `A` / bumper / trigger | `Space` / `Enter` |
| Reload | Right click | `B` / `X` / left trigger | `R` |
| Pause | | `Start` | `P` or `Esc` |

### On a phone or tablet

Play in landscape. Tap anywhere on the screen to aim and shoot at that spot, and tap the **RELOAD** button when your clip runs dry. The pause button opens the menu. The on-screen controls appear on touch devices automatically; Settings has size, opacity and a left-handed layout. Use your browser's *Add to Home Screen* to install it as a full-screen app.

## Settings

Volume sliders (master / music / effects / ambient), aim speed, **time of day** (cycle, always day, dusk or night), **day length**, **weather** (dynamic or always clear), auto-reload, screen shake and reduced motion. Saved in your browser, as are the local top-10 high scores.

Debug URL flags: `?level=N` (start on a level), `?bot=1` (autopilot), `?tod=day|dusk|night`, `?wx=clear|clouds|rain|storm|snow|fog|spores|meteors|aurora`, `?touch=1` (force the touch UI).

## License

Free to play and share under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (non-commercial, with a link back to this repository). Not affiliated with or endorsed by any other game or company.
