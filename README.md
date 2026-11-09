# 🍋 Lemonade Inc.

A browser lemonade-stand management game. Buy supplies each morning, set your recipe and price, watch the weather, and grow the business over a 30-day season. Plays on desktop and iPad, with no install and no build step.

Live: https://lemonadeinc.kasahkod.cc

## Project structure

```
index.html              Page layout; loads the CSS and scripts
css/style.css           All styling. Tokens at the top match the Figma design system
js/config.js            Tunable game data: locations, weather, shop packs, upgrades, feedback text, helpers
js/state.js             Game state, save/load, purchases, stock value and cost-per-cup maths
js/render.js            Canvas drawing: sky, locations, stand, customers, weather, effects
js/sim.js               The trading day: customer decisions, queue, taste scoring, end-of-day books
js/ui.js                Stats bar, tabs, Books tab and charts, day and season reports, shop, location, button handling
js/shell.js             Title screen, menu, settings, how to play, confirm dialogs, sound effects, icons, pausing
js/main.js              Game loop, start-up, offline support registration
assets/                 Title-screen art as WebP: logo, plus portrait, 5:4 and 16:9 backgrounds (sources in ../LI images)
sw.js                   Service worker (offline play, network-first so updates show immediately)
manifest.webmanifest    Home Screen app settings
icons/                  App icons
tests/                  Automated tests for the game rules
```

The scripts are plain (non-module) JavaScript loaded in order, so they share one global scope. Keep the load order in `index.html` as it is.

## Run it locally

Opening `index.html` directly works for playing. For testing offline mode and the app manifest, serve it over http instead:

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Test it

The game rules have automated tests. They only need Node, with nothing to install. From the project folder:

```
node --test
```

## Deploy

The code is on [GitHub](https://github.com/PejabatDigital/lemonadeinc) and the live site is hosted on Cloudflare at https://lemonadeinc.kasahkod.cc. It's a static site with no build step, served from the repo root.

## Design system

The look is documented in Figma: **Lemonade Inc. — Design System** (Foundations, Components, Screens) and the **screen flow** FigJam board. The CSS variables at the top of `css/style.css` use the same names as the Figma variables (`--bg-surface`, `--accent-fill`, `--r-md`, …), so change a colour in both places.

Use the shared components instead of one-off styles: `.btn` (`--primary`, `--secondary`, `--danger`, `--lg`, `--block`), `.iconbtn`, `.seg`, `.toggle`, `.list-row`, `.menu-item`, `.callout`, and `popupHead()` for the top of any popup.

## Things to know

- **Saves** live in each browser's local storage for the site's domain, under the key `sunny-squeeze-save-v1` in `js/config.js`. Changing the key or the domain strands existing saves, which is why the key still has the game's old name.
- **Offline cache:** if you add or rename files, add them to `ASSETS` in `sw.js` and bump the version in `CACHE`.
- **Balancing:** prices, traffic, rent and upgrade costs are all in `js/config.js`, and `BALANCE` there holds the other tuning numbers. Taste and buying behaviour are in `js/sim.js` (`decide` and `taste`).
- **Rules stay off the page:** `js/config.js`, `js/state.js` and `js/sim.js` must not touch the page, because the tests run them without a browser. The sim announces `open`, `sale` and `end` with `emit`, and `ui.js` and `shell.js` react with `onSim`. Anything random that affects the game uses `rng()`, not `Math.random`.
- **Settings** (sound, theme, reduce motion) are saved separately under `lemonade-inc-settings-v1`, so starting a new season keeps them.
- **Pausing:** the trading day stops while the menu, a popup or the title screen is open (`isPaused()` in `shell.js`).
- **Fonts** come from Google Fonts (Baloo 2 and Nunito), with system fallbacks.
