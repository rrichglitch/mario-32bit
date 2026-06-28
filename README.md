# Super Mario 32-Bit

A 32-bit-styled 2D Mario side-scroller, built in plain HTML5 Canvas + JavaScript. No external assets — every pixel is drawn at runtime with smooth vector gradients and rounded shapes for that SNES-era "32-bit" look (no pixel art, no jaggies).

## Play

- **← →** move, **Space** / **↑** jump, **Z** / **Shift** run, **R** reset
- On mobile/touch: on-screen buttons (left: ◀ ▶, right: JUMP / RUN) — works in **landscape orientation** for the best experience

## Features

- Procedural classic World 1-1 level with bricks, ? blocks, pipes, Goombas, coins
- Physics: gravity, momentum, variable jump height, stomp mechanics
- Score / coins / time / lives HUD with classic NES typography
- Smooth gradient sky, parallax clouds + hills, soft shadows
- Touch controls auto-hidden on devices with a real mouse
- Rotation hint in portrait

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

- `index.html` — markup, HUD, overlay, touch controls
- `style.css` — 32-bit theming + responsive landscape layout
- `game.js` — single-file game engine (~1000 lines)
