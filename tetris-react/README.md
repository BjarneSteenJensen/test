# Tetris (React)

A React port of the vanilla-JS Tetris game in `../tetris/`. Same game logic, sound
effects, and controls, rendered via a canvas `<canvas>` inside a React component
(`src/App.jsx`), built with Vite.

## Running

This project ships with its own local Node.js runtime in `.node-runtime/`
(not committed — see `.gitignore`), so it works even if Node/npm aren't
installed system-wide. If you already have Node 18+ installed globally, you
can ignore `.node-runtime` and just use your own `node`/`npm`.

```bash
# if you don't have Node on your PATH, use the bundled runtime for this session:
export PATH="$(pwd)/.node-runtime/bin:$PATH"

npm install      # first time only
npm run dev      # start the dev server (prints a local URL)
npm run build    # production build -> dist/
npm run preview  # preview the production build
npm run lint     # oxlint
```

## Controls

- Move: Arrow Left / Right
- Soft drop: Arrow Down
- Hard drop: Space
- Rotate: Arrow Up, X (CW), Z (CCW)
- Pause: P
- Touch: on-screen buttons + swipe/tap gestures on the board

## Layout

- `src/App.jsx` — the whole game (state, canvas rendering, audio, input handling)
- `src/index.css` — global styles (design tokens, layout, light/dark theme)
- `legacy-cdn/` — the original no-build single-file version (React + Babel via CDN)
