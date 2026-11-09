/* Lemonade Inc. | settings.js
   Player settings and the sound effects. */

// ---------- settings (kept apart from the game save so they survive a new season) ----------
const PREFS_KEY = 'lemonade-inc-settings-v1';
export const prefs = Object.assign({ sound:true, theme:'auto', motion:'auto' }, (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch(e){ return {}; } })());
export const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch(e){} };
export const sysReduce = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => prefs.motion === 'reduce' || (prefs.motion === 'auto' && sysReduce.matches);
export function applyPrefs(){
  const r = document.documentElement;
  if (prefs.theme === 'light' || prefs.theme === 'dark') r.dataset.theme = prefs.theme; else delete r.dataset.theme;
  r.classList.toggle('reduce-motion', prefs.motion === 'reduce');
  r.classList.toggle('motion-on', prefs.motion === 'full');
}

// ---------- sound: tiny synthesized effects, no audio files ----------
let actx = null, lastSale = 0;
export function audio(){
  if (!prefs.sound) return null;
  if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { actx = new AC(); } catch(e){ return null; } }
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
function tone(ctx, t, freq, dur, type, vol){
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.03);
}
export function sfx(kind){
  const ctx = audio(); if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.01;
  if (kind === 'tap') tone(ctx, t, 660, .07, 'triangle', .05);
  else if (kind === 'buy') { tone(ctx, t, 880, .07, 'triangle', .06); tone(ctx, t + .06, 1320, .1, 'triangle', .05); }
  else if (kind === 'upgrade') [523, 659, 784, 1047].forEach((f, i) => tone(ctx, t + i * .07, f, .16, 'triangle', .06));
  else if (kind === 'open') { tone(ctx, t, 392, .12, 'triangle', .07); tone(ctx, t + .1, 523, .18, 'triangle', .07); }
  else if (kind === 'day') [523, 659, 784].forEach((f, i) => tone(ctx, t + i * .09, f, .2, 'sine', .07));
  else if (kind === 'sale') {
    const now = performance.now(); if (now - lastSale < 110) return; lastSale = now;
    tone(ctx, t, 1568, .05, 'square', .018); tone(ctx, t + .05, 2093, .12, 'square', .018);
  }
}
