/* Lemonade Inc. | main.js
   Game loop and start-up. The day only advances while no menu or popup is open. */
import { $ } from './config.js';
import { sim, setState, load, newState } from './state.js';
import { stepSim } from './sim.js';
import { resize, renderFrame } from './render.js';
import { applyPrefs } from './settings.js';
import { isPaused, titleOpen } from './dialogs.js';
import { renderAll } from './ui.js';
import { showTitle } from './shell.js';

// ---------- loop ----------
let last = performance.now(), liveT = 0;
function frame(ts){
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
  if (sim && !isPaused()) {
    stepSim(dt);
    if (sim) {
      const m = Math.floor(sim.min), h = 9 + Math.floor(m/60), mm = String(m % 60).padStart(2,'0');
      $('#clock').textContent = `${h > 12 ? h - 12 : h}:${mm} ${h >= 12 ? 'pm' : 'am'}`;
      liveT += dt; if (liveT > 0.25) { liveT = 0; renderAll(); }
    }
  }
  if (!titleOpen()) renderFrame(dt, isPaused()); // the title screen covers the whole canvas
  requestAnimationFrame(frame);
}

setState(load() || newState());
applyPrefs();
resize();
renderAll();
showTitle();
requestAnimationFrame(frame);

// Offline support (only when served over http/https, not when opened as a local file)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
