/* Lemonade Inc. | shell.js
   Everything around the game: icons, settings, sound, title screen, in-game menu, how-to-play,
   confirm dialogs, keyboard and focus handling, and pausing the day while a menu is open.
   Matches the Figma file "Lemonade Inc. — Design System" (Components + Screens pages). */
'use strict';

// ---------- icons (24px line set, same as Figma "Icon/*") ----------
const ICONS = {
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  chevron:'<path d="M9 5l7 7-7 7"/>',
  play:'<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  settings:'<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4"/><path d="M12 17h.01"/>',
  shop:'<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  pin:'<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  home:'<path d="M4 11.5L12 4l8 7.5"/><path d="M6.5 10v10h11V10"/>',
  chart:'<path d="M5 20v-8M12 20V5M19 20v-5"/>',
  reset:'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
  lock:'<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};
const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ---------- settings (kept apart from the game save so they survive a new season) ----------
const PREFS_KEY = 'lemonade-inc-settings-v1';
const prefs = Object.assign({ sound:true, theme:'auto', motion:'auto' }, (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch(e){ return {}; } })());
const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch(e){} };
const sysReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches:false };
const reducedMotion = () => prefs.motion === 'reduce' || (prefs.motion === 'auto' && sysReduce.matches);
function applyPrefs(){
  const r = document.documentElement;
  if (prefs.theme === 'light' || prefs.theme === 'dark') r.dataset.theme = prefs.theme; else delete r.dataset.theme;
  r.classList.toggle('reduce-motion', prefs.motion === 'reduce');
  r.classList.toggle('motion-on', prefs.motion === 'full');
}

// ---------- sound: tiny synthesized effects, no audio files ----------
let actx = null, lastSale = 0;
function audio(){
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
function sfx(kind){
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
// Hook the game's own moments without touching the sim: a sale, opening, end of day.
{ const f = saleFx; saleFx = function(p){ sfx('sale'); return f.apply(this, arguments); }; }
{ const f = openStand; openStand = function(){ const r = f.apply(this, arguments); if (sim) sfx('open'); return r; }; }
{ const f = showReport; showReport = function(){ sfx('day'); return f.apply(this, arguments); }; }

// ---------- overlay state: pause the trading day while a menu or popup is up ----------
let titleOpen = false, menuOpen = false;
const isPaused = () => !!sim && (titleOpen || menuOpen || modalOpen());
function onOverlayChange(){
  document.body.classList.toggle('is-paused', isPaused());
  document.body.classList.toggle('locked', titleOpen || menuOpen || modalOpen());
}
const hasProgress = () => !!sim || S.day > 1 || S.ledger.length > 0 || S.spend > 0;

// ---------- title screen ----------
function renderTitle(){
  const prog = hasProgress();
  $('#titleActions').innerHTML = (prog
      ? `<button class="btn btn--primary btn--lg btn--block" data-act="t-continue">${icon('play')}Continue · Day ${S.seasonDone ? S.day - 1 : S.day}</button>
         <button class="btn btn--secondary btn--lg btn--block" data-act="newgame">New season</button>`
      : `<button class="btn btn--primary btn--lg btn--block" data-act="t-play">${icon('play')}Play</button>`)
    + `<div class="btn-row"><button class="btn btn--secondary" data-act="help">${icon('help')}How to play</button>
       <button class="btn btn--secondary" data-act="settings">${icon('settings')}Settings</button></div>
       <p class="title-foot">v${VERSION} · Your game saves on this device</p>`;
}
function showTitle(){
  titleOpen = true; renderTitle();
  $('#title').hidden = false; $('#game').inert = true;
  onOverlayChange();
  const b = $('#titleActions .btn'); if (b) b.focus({ preventScroll:true });
}
function hideTitle(){
  titleOpen = false; $('#title').hidden = true; $('#game').inert = false;
  onOverlayChange();
}

// ---------- in-game menu (side panel / bottom sheet) ----------
function menuItem(ic, label, act, note, opts = {}){
  return `<button class="menu-item${opts.danger ? ' menu-item--danger' : ''}" data-act="${act}" ${opts.disabled ? 'disabled' : ''}>${icon(ic)}<span>${label}${note ? `<small>${note}</small>` : ''}</span>${icon('chevron', 'icon chev')}</button>`;
}
function renderMenu(){
  const L = loc();
  $('#sheet').innerHTML = `<div class="grab" aria-hidden="true"></div>
    <div class="popup-head"><div><h2 id="menuTitle">Menu</h2><p class="sub">Day ${S.seasonDone ? S.day - 1 : S.day}${S.seasonDone ? '' : ' of ' + SEASON} · ${L.name}${sim ? ' · day paused' : ''}</p></div>
      <button class="iconbtn" data-act="closemenu" aria-label="Close menu">${icon('close')}</button></div>
    <nav class="menu-list" aria-labelledby="menuTitle">
      ${menuItem('shop', 'Shop', 'shop', 'One-time upgrades')}
      ${menuItem('pin', 'Change location', 'showloc', sim ? 'After today’s trading' : L.name, { disabled:!!sim })}
      ${S.ledger.length ? menuItem('chart', 'Season report', 'season', `${S.ledger.length} day${S.ledger.length > 1 ? 's' : ''} so far`) : ''}
      ${menuItem('help', 'How to play', 'help')}
      ${menuItem('settings', 'Settings', 'settings')}
      <div class="menu-sep"></div>
      ${menuItem('home', 'Back to title', 't-show')}
    </nav>`;
}
function showMenu(){
  renderMenu(); menuOpen = true;
  $('#sheet').classList.add('on'); $('.scrim').classList.add('on');
  $('[data-act="menu"]').setAttribute('aria-expanded', 'true');
  onOverlayChange();
  const first = $('#sheet .menu-item:not(:disabled)'); if (first) first.focus({ preventScroll:true });
}
// instant = another screen is about to open, so don't hand focus back to the menu button
function hideMenu(instant){
  if (!menuOpen) return;
  menuOpen = false;
  $('#sheet').classList.remove('on'); $('.scrim').classList.remove('on');
  $('[data-act="menu"]').setAttribute('aria-expanded', 'false');
  if (!instant) $('[data-act="menu"]').focus({ preventScroll:true });
  onOverlayChange();
}

// ---------- how to play: 4 cards ----------
const HOWTO = [
  ['🛒', 'Stock up each morning', 'Check the forecast, then buy lemons, sugar, ice and cups. Lemons go bad after 4 days and ice melts overnight, so don’t overbuy.'],
  ['🍋', 'Mix your recipe and price', 'Balance lemons, sugar and ice. Customers tell you what they think in speech bubbles. The Price tab shows your cost and margin per cup.'],
  ['☀️', 'Open the stand', 'Watch the day play out from 9am to 6pm. Speed it up with 2× or 4×, or close early if you sell out.'],
  ['📈', 'Grow the business', 'Happy customers raise popularity, which brings more buyers and unlocks busier spots. Buy upgrades in the Shop and track it all in Books.'],
];
let howStep = 0;
function showHelp(step = 0){
  hideMenu(true);
  howStep = clamp(step, 0, HOWTO.length - 1);
  const [art, h, body] = HOWTO[howStep], last = howStep === HOWTO.length - 1;
  showModal(`${popupHead('How to play', `Run Lemonade Inc. for a ${SEASON}-day season and make as much money as you can.`)}
    <div class="howto" aria-live="polite"><div class="howto-art" aria-hidden="true">${art}</div>
      <h3>${howStep + 1} · ${h}</h3><p>${body}</p></div>
    <div class="pager-nav">
      <div class="dots" role="img" aria-label="Card ${howStep + 1} of ${HOWTO.length}">${HOWTO.map((_, i) => `<i class="${i === howStep ? 'on' : ''}"></i>`).join('')}</div>
      ${howStep ? '<button class="btn btn--secondary" data-act="how:prev">Back</button>' : '<button class="btn btn--secondary" data-act="how:done">Skip</button>'}
      <button class="btn btn--primary" data-act="how:${last ? 'done' : 'next'}">${last ? 'Let’s squeeze' : 'Next'}</button>
    </div>
    <p class="fine">Your game saves automatically on this device.</p>`, { dismiss:finishHelp });
}
function finishHelp(){ S.seenHelp = true; save(); hideModal(); }

// ---------- settings ----------
const cap = s => s[0].toUpperCase() + s.slice(1);
function showSettings(){
  hideMenu(true);
  showModal(`${popupHead('Settings', 'Saved automatically on this device.')}
    <div class="set-row"><div><b id="lblSound">Sound effects</b><small>Cha-ching on every sale.</small></div>
      <button class="toggle" role="switch" aria-checked="${prefs.sound}" aria-labelledby="lblSound" data-act="set:sound"></button></div>
    <div class="set-row"><div><b id="lblTheme">Theme</b></div>
      <div class="seg" role="group" aria-labelledby="lblTheme">${['auto', 'light', 'dark'].map(t => `<button aria-pressed="${prefs.theme === t}" data-act="set:theme:${t}">${cap(t)}</button>`).join('')}</div></div>
    <div class="set-row"><div><b id="lblMotion">Reduce motion</b><small>Fewer animations. Follows your device until you change it.</small></div>
      <button class="toggle" role="switch" aria-checked="${reducedMotion()}" aria-labelledby="lblMotion" data-act="set:motion"></button></div>
    ${hasProgress() ? `<div style="margin-top:8px">${menuItem('reset', 'Start a new season', 'newgame', null, { danger:true })}</div>` : ''}
    <p class="fine">Lemonade Inc. v${VERSION}</p>`);
}
function setPref(key, val, btn){
  if (key === 'sound') { prefs.sound = !prefs.sound; btn.setAttribute('aria-checked', String(prefs.sound)); if (prefs.sound) sfx('tap'); }
  else if (key === 'theme') { prefs.theme = val; document.querySelectorAll('[data-act^="set:theme"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.act === 'set:theme:' + val))); }
  else if (key === 'motion') { const on = !reducedMotion(); prefs.motion = on ? 'reduce' : (sysReduce.matches ? 'full' : 'auto'); btn.setAttribute('aria-checked', String(on)); }
  savePrefs(); applyPrefs();
}

// ---------- new season (always confirmed) ----------
let nsBack = null;
function confirmNewSeason(){
  if (!hasProgress()) { startNewSeason(); return; }
  // Remember where we came from so "Keep playing" goes back there.
  const card = $('#card');
  nsBack = !modalOpen() ? null
    : card.querySelector('[data-act^="set:"]') ? showSettings
    : (report && report.season && card.querySelector('[data-act="next"]')) ? () => showModal(card.innerHTML, { dismiss:false })
    : card.querySelector('.tally') && S.seasonDone ? showSeason : null;
  hideMenu(true);
  const sub = S.seasonDone ? `Your season finished with ${money(S.total)} profit.` : `You’re on day ${S.day} with ${money(S.cash)} in the till.`;
  showModal(`${popupHead('Start a new season?', sub, false)}
    <p class="callout callout--warn">This wipes your current season, upgrades and books. It can’t be undone.</p>
    <div class="btn-stack"><button class="btn btn--danger btn--lg btn--block" data-act="ns:yes">Yes, start over</button>
    <button class="btn btn--secondary btn--lg btn--block" data-act="ns:no">Keep playing</button></div>`, { dismiss:cancelNewSeason });
}
function cancelNewSeason(){ const back = nsBack; nsBack = null; hideModal(); if (back) back(); }
function startNewSeason(){
  if (sim) { sim = null; $('#hud').classList.remove('on'); }
  S = newState(); S.seenHelp = true; report = null; tab = 'supplies';
  save(); hideModal(); hideMenu(true); renderAll();
  if (titleOpen) hideTitle();
  sfx('upgrade');
}

// ---------- actions (called from the click handler in ui.js) ----------
function shellAction(act, a, c, btn){
  if (act === 't-play') { audio(); hideTitle(); if (!S.seenHelp) showHelp(); return true; }
  if (act === 't-continue') { audio(); hideTitle(); return true; }
  if (act === 't-show') { hideMenu(true); hideModal(); showTitle(); return true; }
  if (act === 'how') { if (a === 'next') showHelp(howStep + 1); else if (a === 'prev') showHelp(howStep - 1); else finishHelp(); return true; }
  if (act === 'settings') { showSettings(); return true; }
  if (act === 'set') { setPref(a, c, btn); return true; }
  if (act === 'ns') { if (a === 'yes') startNewSeason(); else cancelNewSeason(); return true; }
  return false;
}

// ---------- keyboard, backdrop, focus trap ----------
$('#modal').addEventListener('click', e => { if (e.target === e.currentTarget && modalDismiss) modalDismiss(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (modalOpen()) { if (modalDismiss) { e.preventDefault(); modalDismiss(); } }
    else if (menuOpen) { e.preventDefault(); hideMenu(); }
    return;
  }
  if (modalOpen() && $('#card .howto') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const n = howStep + (e.key === 'ArrowRight' ? 1 : -1);
    if (n >= 0 && n < HOWTO.length) { e.preventDefault(); showHelp(n); }
    return;
  }
  if (e.key === 'Tab') {
    const root = modalOpen() ? $('#card') : menuOpen ? $('#sheet') : titleOpen ? $('#title') : null;
    if (!root) return;
    const f = [...root.querySelectorAll('button:not(:disabled), [href], input, select, [tabindex]:not([tabindex="-1"])')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], at = document.activeElement;
    if (e.shiftKey && (at === first || at === root || !root.contains(at))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !root.contains(at))) { e.preventDefault(); first.focus(); }
  }
});
// Swipe between how-to-play cards on touch screens.
{ let x0 = null;
  $('#card').addEventListener('touchstart', e => { x0 = $('#card .howto') ? e.touches[0].clientX : null; }, { passive:true });
  $('#card').addEventListener('touchend', e => {
    if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { const n = howStep + (dx < 0 ? 1 : -1); if (n >= 0 && n < HOWTO.length) showHelp(n); }
  }, { passive:true });
}
sysReduce.addEventListener && sysReduce.addEventListener('change', () => applyPrefs());
