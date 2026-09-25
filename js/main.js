/* Lemonade Inc. | main.js
   Game loop and start-up. */
'use strict';

// ---------- loop ----------
let last = performance.now(), liveT = 0;
function frame(ts){
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
  if (sim) {
    stepSim(dt);
    if (sim) {
      const m = Math.floor(sim.min), h = 9 + Math.floor(m/60), mm = String(m % 60).padStart(2,'0');
      $('#clock').textContent = `${h > 12 ? h - 12 : h}:${mm} ${h >= 12 ? 'pm' : 'am'}`;
      liveT += dt; if (liveT > 0.25) { liveT = 0; renderAll(); }
    }
  }
  draw(ts, dt);
  requestAnimationFrame(frame);
}

S = load() || newState();
resize();
renderAll();
$('#verline').textContent = 'Version ' + VERSION;
if (!S.seenHelp) showHelp();
requestAnimationFrame(frame);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {});

// Offline support (only when served over http/https, not when opened as a local file)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
