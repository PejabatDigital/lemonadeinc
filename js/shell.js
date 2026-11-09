/* Lemonade Inc. | shell.js
   Everything around the game: title screen, in-game menu, how-to-play, settings screen and confirm dialogs.
   Matches the Figma file "Lemonade Inc. — Design System" (Components + Screens pages). */
import { SEASON, VERSION, BALANCE, $, clamp, money, icon } from './config.js';
import { S, sim, setState, setSim, setReport, newState, loc, save, seasonTotals } from './state.js';
import { onSim } from './sim.js';
import { prefs, savePrefs, sysReduce, reducedMotion, applyPrefs, audio, sfx } from './settings.js';
import { showModal, hideModal, hideMenu, modalOpen, currentRedraw, titleOpen, popupHead, onOverlayChange } from './dialogs.js';
import { ACTIONS, renderAll, resetTab } from './ui.js';

onSim('sale', () => sfx('sale'));
onSim('open', () => sfx('open'));
onSim('end', () => sfx('day'));

const hasProgress = () => !!sim || S.day > 1 || S.ledger.length > 0 || S.spend > 0 || S.capex > 0;

// ---------- title screen ----------
function renderTitle(){
  const prog = hasProgress();
  $('#titleActions').innerHTML = (prog
      ? `<button class="btn btn--primary btn--lg btn--block" data-act="t-continue">${icon('play')}Continue · Day ${S.day}</button>
         <button class="btn btn--secondary btn--lg btn--block" data-act="newgame">New season</button>`
      : `<button class="btn btn--primary btn--lg btn--block" data-act="t-play">${icon('play')}Play</button>`)
    + `<div class="btn-row"><button class="btn btn--secondary" data-act="help">${icon('help')}How to play</button>
       <button class="btn btn--secondary" data-act="settings">${icon('settings')}Settings</button></div>
       <p class="title-foot">v${VERSION} · ${sim ? 'Today’s trading saves when the day ends' : 'Your game saves on this device'}</p>`;
}
export function showTitle(){
  renderTitle();
  $('#title').hidden = false; $('#game').inert = true;
  onOverlayChange();
  const b = $('#titleActions .btn'); if (b) b.focus({ preventScroll:true });
}
function hideTitle(){
  $('#title').hidden = true; $('#game').inert = false;
  onOverlayChange();
}

// ---------- in-game menu (side panel / bottom sheet) ----------
function menuItem(ic, label, act, note, opts = {}){
  return `<button class="menu-item${opts.danger ? ' menu-item--danger' : ''}" data-act="${act}" ${opts.disabled ? 'disabled' : ''}>${icon(ic)}<span>${label}${note ? `<small>${note}</small>` : ''}</span>${icon('chevron', 'icon chev')}</button>`;
}
function renderMenu(){
  const L = loc();
  $('#sheet').innerHTML = `<div class="grab" aria-hidden="true"></div>
    <div class="popup-head"><div><h2 id="menuTitle">Menu</h2><p class="sub">Day ${S.day}${S.seasonDone ? '' : ' of ' + SEASON} · ${L.name}${sim ? ' · day paused' : ''}</p></div>
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
  renderMenu();
  $('#sheet').showModal();
  $('[data-act="menu"]').setAttribute('aria-expanded', 'true');
  onOverlayChange();
  const first = $('#sheet .menu-item:not(:disabled)'); if (first) first.focus({ preventScroll:true });
}

// ---------- how to play: 4 cards ----------
const HOWTO = [
  ['🛒', 'Stock up each morning', 'Check the forecast, then buy lemons, sugar, ice and cups. Lemons go bad after ' + BALANCE.lemonLife + ' days and ice melts overnight, so don’t overbuy.'],
  ['🍋', 'Mix your recipe and price', 'Balance lemons, sugar and ice. Customers tell you what they think in speech bubbles. The Price tab shows your cost and margin per cup.'],
  ['☀️', 'Open the stand', 'Watch the day play out from 9am to 6pm. Speed it up with 2× or 4×, or close early if you sell out.'],
  ['📈', 'Grow the business', 'Happy customers raise popularity, which brings more buyers and unlocks busier spots. Buy upgrades in the Shop and track it all in Books.'],
];
let howStep = 0;
function showHelp(step = 0){
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
    <p class="fine">Your game saves on this device between days. A day in progress restarts if you close the app.</p>`, { dismiss:finishHelp });
}
function finishHelp(){ S.seenHelp = true; save(); hideModal(); }

// ---------- settings ----------
const cap = s => s[0].toUpperCase() + s.slice(1);
function showSettings(){
  showModal(`${popupHead('Settings', 'Saved automatically on this device.')}
    <div class="set-row"><div><b id="lblSound">Sound effects</b><small>Cha-ching on every sale.</small></div>
      <button class="toggle" role="switch" aria-checked="${prefs.sound}" aria-labelledby="lblSound" data-act="set:sound"></button></div>
    <div class="set-row"><div><b id="lblTheme">Theme</b></div>
      <div class="seg" role="group" aria-labelledby="lblTheme">${['auto', 'light', 'dark'].map(t => `<button aria-pressed="${prefs.theme === t}" data-act="set:theme:${t}">${cap(t)}</button>`).join('')}</div></div>
    <div class="set-row"><div><b id="lblMotion">Reduce motion</b><small>Fewer animations. Follows your device until you change it.</small></div>
      <button class="toggle" role="switch" aria-checked="${reducedMotion()}" aria-labelledby="lblMotion" data-act="set:motion"></button></div>
    ${hasProgress() ? `<div class="mt-2">${menuItem('reset', 'Start a new season', 'newgame', null, { danger:true })}</div>` : ''}
    <p class="fine">Lemonade Inc. v${VERSION}</p>`, { redraw:showSettings });
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
  nsBack = modalOpen() ? currentRedraw() : null; // so "Keep playing" returns to the popup we came from
  const sub = S.seasonDone ? `Your season finished with ${money(seasonTotals().net)} profit.` : `You’re on day ${S.day} with ${money(S.cash)} in the till.`;
  showModal(`${popupHead('Start a new season?', sub, false)}
    <p class="callout callout--warn">This wipes your current season, upgrades and books. It can’t be undone.</p>
    <div class="btn-stack"><button class="btn btn--danger btn--lg btn--block" data-act="ns:yes">Yes, start over</button>
    <button class="btn btn--secondary btn--lg btn--block" data-act="ns:no">Keep playing</button></div>`, { dismiss:cancelNewSeason });
}
function cancelNewSeason(){ const back = nsBack; nsBack = null; if (back) back(); else hideModal(); }
function startNewSeason(){
  if (sim) { setSim(null); $('#hud').classList.remove('on'); }
  setState(newState()); S.seenHelp = true; setReport(null); resetTab();
  save(); hideModal(); hideMenu(); renderAll();
  if (titleOpen()) hideTitle();
  sfx('upgrade');
}

// ---------- button actions ----------
Object.assign(ACTIONS, {
  menu: showMenu,
  closemenu: hideMenu,
  help(){ showHelp(); },
  settings: showSettings,
  newgame: confirmNewSeason,
  set: setPref,
  't-play'(){ audio(); hideTitle(); if (!S.seenHelp) showHelp(); },
  't-continue'(){ audio(); hideTitle(); },
  't-show'(){ hideMenu(); hideModal(); showTitle(); },
  how(dir){ if (dir === 'next') showHelp(howStep + 1); else if (dir === 'prev') showHelp(howStep - 1); else finishHelp(); },
  ns(answer){ if (answer === 'yes') startNewSeason(); else cancelNewSeason(); },
});

document.addEventListener('keydown', e => {
  if (modalOpen() && $('#card .howto') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const n = howStep + (e.key === 'ArrowRight' ? 1 : -1);
    if (n >= 0 && n < HOWTO.length) { e.preventDefault(); showHelp(n); }
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
