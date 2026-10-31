# AGENTS.md

Vanilla HTML5 Canvas asteroids clone. No dependencies, no bundler, no package.json, no tests, no linter.

## Run

Open `index.html` directly in the browser, or:

```bash
npx serve .
```

then visit `http://localhost:3000`.

## Architecture

- All game logic lives in `game.js` (single file, ~400 lines), loaded by `index.html` via plain `<script>` tag — no modules.
- Canvas is 800×600, defined in `index.html`, with id `canvas`.
- No build step: changes to `game.js` or `index.html` are visible on browser refresh (hard refresh to bypass cache).

## Conventions

- Docs (README, page content) and comments are in Spanish; code identifiers in English.
- No tooling to add tests or lint — verify changes manually in the browser.
