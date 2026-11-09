/* Lemonade Inc. | dialogs.js
   The popup and the menu (both native <dialog>s), and whether the trading day should be paused. */
import { $, icon } from './config.js';
import { sim } from './state.js';

// ---------- what's open: the day pauses while anything covers it ----------
export const titleOpen = () => !$('#title').hidden;
export const menuOpen = () => $('#sheet').open;
export const modalOpen = () => $('#card').open;
export const isPaused = () => !!sim && (titleOpen() || menuOpen() || modalOpen());
export function onOverlayChange(){
  document.body.classList.toggle('is-paused', isPaused());
  document.body.classList.toggle('locked', titleOpen() || menuOpen() || modalOpen());
}

// Popups. opts: { wide, dismiss, redraw }. dismiss is what ✕ / Esc / tapping outside does: a function,
// or false when the player has to pick one of the buttons (day report). redraw reopens this popup,
// so a confirm shown on top of it can come back.
let modalDismiss = null, modalRedraw = null, modalReturn = null;
export function popupHead(title, sub, close = true){
  return `<div class="popup-head"><div><h2 id="dlgTitle">${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
    ${close ? `<button class="iconbtn" data-act="dismiss" aria-label="Close">${icon('close')}</button>` : ''}</div>`;
}
export function showModal(html, opts = {}){
  hideMenu();
  const card = $('#card');
  modalDismiss = opts.dismiss === undefined ? hideModal : opts.dismiss;
  modalRedraw = opts.redraw || null;
  card.classList.toggle('wide', !!opts.wide); card.innerHTML = html;
  if (!card.open) { modalReturn = document.activeElement; card.showModal(); }
  card.scrollTop = 0;
  card.focus({ preventScroll:true });
  onOverlayChange();
}
export function hideModal(){
  const opener = modalReturn;
  modalDismiss = modalRedraw = modalReturn = null;
  $('#card').close();
  // close() refocuses the button that opened the popup, unless that button was redrawn while it was up.
  if (opener && !document.contains(opener) && opener.dataset.act) {
    const again = $(`[data-act="${opener.dataset.act}"]`);
    if (again) again.focus({ preventScroll:true });
  }
}
export const dismissModal = () => { if (modalDismiss) modalDismiss(); };
export const currentRedraw = () => modalRedraw;
export function hideMenu(){ $('#sheet').close(); }

// ---------- tapping outside, closing, Esc ----------
function tappedOutside(e){
  const d = e.currentTarget, r = d.getBoundingClientRect();
  return e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
}
$('#card').addEventListener('click', e => { if (tappedOutside(e)) dismissModal(); });
$('#sheet').addEventListener('click', e => { if (tappedOutside(e)) hideMenu(); });
$('#card').addEventListener('close', onOverlayChange);
$('#sheet').addEventListener('close', () => { $('[data-act="menu"]').setAttribute('aria-expanded', 'false'); onOverlayChange(); });
// A popup decides for itself whether it can be dismissed (phone back gestures arrive here).
$('#card').addEventListener('cancel', e => { e.preventDefault(); dismissModal(); });
// Esc is handled here too: browsers stop honouring preventDefault on a repeated cancel.
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOpen()) { e.preventDefault(); dismissModal(); }
});
