# 🍋 Lemonade Inc.

A browser lemonade-stand management game. Buy supplies each morning, set your recipe and price, watch the weather, and grow the business over a 30-day season. Plays on desktop and iPad, with no install and no build step.

Live: https://lemonadeinc.netlify.app

## Project structure

```
index.html              Page layout; loads the CSS and scripts in order
css/style.css           All styling. Tokens at the top match the Figma design system
js/config.js            Tunable game data: locations, weather, shop packs, upgrades, feedback text, helpers
js/state.js             Game state, save/load, stock value and cost-per-cup maths
js/render.js            Canvas drawing: sky, locations, stand, customers, weather, effects
js/sim.js               The trading day: customer decisions, queue, taste scoring, end-of-day books
js/ui.js                Stats bar, tabs, Books tab and charts, day and season reports, shop, location, button handling
js/shell.js             Title screen, menu, settings, how to play, confirm dialogs, sound effects, icons, pausing
js/main.js              Game loop, start-up, offline support registration
assets/                 Title-screen art (logo, portrait and landscape backgrounds) as WebP
sw.js                   Service worker (offline play, network-first so updates show immediately)
manifest.webmanifest    Home Screen app settings
icons/                  App icons
netlify.toml            Netlify settings
```

The scripts are plain (non-module) JavaScript loaded in order, so they share one global scope. Keep the load order in `index.html` as it is.

## Run it locally

Opening `index.html` directly works for playing. For testing offline mode and the app manifest, serve it over http instead:

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Deploy

Netlify is linked to this repo. Every push to `main` goes live automatically. Push other branches to get a preview link to test on the iPad before merging.

## Design system

The look is documented in Figma: **Lemonade Inc. — Design System** (Foundations, Components, Screens) and the **screen flow** FigJam board. The CSS variables at the top of `css/style.css` use the same names as the Figma variables (`--bg-surface`, `--accent-fill`, `--r-md`, …), so change a colour in both places.

Use the shared components instead of one-off styles: `.btn` (`--primary`, `--secondary`, `--danger`, `--lg`, `--block`), `.iconbtn`, `.seg`, `.toggle`, `.list-row`, `.menu-item`, `.callout`, and `popupHead()` for the top of any popup.

## Things to know

- **Saves** live in each browser's local storage, under the key `sunny-squeeze-save-v1` in `js/config.js`. Don't rename it, and keep the same domain, or existing saves won't load. The old name is kept on purpose so earlier saves carry over.
- **Offline cache:** if you add or rename files, add them to `ASSETS` in `sw.js` and bump `CACHE` (e.g. `lemonade-inc-v2`).
- **Balancing:** prices, traffic, rent and upgrade costs are all in `js/config.js`. Taste and buying behaviour are in `js/sim.js` (`decide` and `taste`).
- **Settings** (sound, theme, reduce motion) are saved separately under `lemonade-inc-settings-v1`, so starting a new season keeps them.
- **Pausing:** the trading day stops while the menu, a popup or the title screen is open (`isPaused()` in `shell.js`).
- **Fonts** come from Google Fonts (Baloo 2 and Nunito), with system fallbacks.
