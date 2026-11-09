/* Lemonade Inc. | ui.js
   Board and popups: stats bar, tabs, Books, charts, day report, season report, shop, location, button handling.
   Title screen, menu, how-to-play, settings screen and confirm dialogs live in shell.js. */
import { SEASON, DAY_MIN, BALANCE, LOCS, WEATHER, SHOP, UPG, FB, $, money, icon } from './config.js';
import { S, sim, report, sum, cents, loc, locById, haveOf, yieldCups, cupCost, cupsFrom, cupsReady, stockValue, seasonTotals, isStuck, save, buyPack, buyUpgrade, changeRecipe } from './state.js';
import { onSim, openStand } from './sim.js';
import { saleFx } from './render.js';
import { sfx, reducedMotion } from './settings.js';
import { showModal, hideModal, popupHead, dismissModal } from './dialogs.js';

// ---------- UI ----------
let tab = 'supplies', supplyItem = 'lemons';
export const resetTab = () => { tab = 'supplies'; };
const mobileMQ = window.matchMedia('(max-width:560px)');
const isMobile = () => mobileMQ.matches;
mobileMQ.addEventListener('change', () => renderBoard());

function supplyRow(k){
  const it = SHOP[k], expiring = sum(S.lemons.filter(b => b.age === BALANCE.lemonLife - 1), b => b.n);
  const extra = k === 'lemons' && expiring ? ` <span class="warn">${expiring} go bad tonight.</span>` : '';
  return `<div class="row"><div><h3><span class="sup-ico">${it.icon}</span>${it.name}: ${haveOf(k)}</h3><p>${it.note}${extra}</p></div>
    <div class="packs">${it.packs.map(([n,p],i) => `<button class="pack" data-act="buy:${k}:${i}" ${S.cash < p ? 'disabled' : ''}>Buy ${n}<small>${money(p)}</small></button>`).join('')}</div></div>`;
}
function upgradeRow(u){
  const owned = S.upg[u.id];
  return `<div class="list-row"><div class="tile" aria-hidden="true">${u.icon}</div><div class="txt"><h3>${u.name}</h3><p>${u.desc}</p></div>
    ${owned ? `<span class="status status--done">${icon('check')}Owned</span>` : `<button class="btn btn--secondary" data-act="upg:${u.id}" ${S.cash < u.cost ? 'disabled' : ''} aria-label="Buy ${u.name} for ${money(u.cost)}">Buy · ${money(u.cost)}</button>`}</div>`;
}
const TAB_INFO = {
  supplies: 'Stock up on lemons, sugar, ice and cups before you open.',
  recipe:   'Balance your ingredients to find the best-tasting lemonade.',
  price:    'Set your price. Pricier spots and hotter days let you charge more.',
  books:    'Track your daily sales and season-long performance.',
};

function locationRow(l){
  const locked = S.pop < l.need, here = S.loc === l.id;
  const action = here ? `<span class="status status--done">${icon('pin')}You're here</span>`
    : locked ? `<span class="status">${icon('lock')}Needs ${l.need}%</span>`
    : `<button class="btn btn--secondary" data-act="loc:${l.id}">Move here</button>`;
  return `<div class="list-row${locked ? ' is-locked' : ''}${here ? ' is-here' : ''}"><div class="tile" aria-hidden="true">${l.icon}</div><div class="txt"><h3>${l.name}</h3><p>${l.desc} Rent ${l.rent ? money(l.rent) + ' a day' : 'free'}.</p></div>${action}</div>`;
}

function renderStats(){
  $('#stats').innerHTML = `
    <span class="stat"><small>Day</small>${S.day}${S.seasonDone ? '' : ' of ' + SEASON}</span>
    <span class="stat"><small>Popularity</small>${S.pop}%<span class="meter"><i style="width:${S.pop}%"></i></span></span>`;
}
function renderSceneStats(){
  const f = S.forecast, w = WEATHER[sim ? sim.weather : f.type];
  const temp = sim ? sim.temp : f.temp + loc().bias;
  $('#sceneStats').innerHTML = `
    <span class="scene-badge weather">${w.icon} ${temp}°C</span>
    <span class="scene-badge cash">${money(S.cash)}</span>`;
}
function stockNote(ready, limit){
  const name = SHOP[limit].name.toLowerCase(), ice = cupsFrom('ice');
  if (!ready) return `Need more ${name}.`;
  let note = `Enough for ${ready}${sim ? ' more' : ''} cup${ready === 1 ? '' : 's'}, limited by ${name}.`;
  if (sim && sim.pitcher) note += ` ${sim.pitcher} already mixed.`;
  if (ice < ready) note += ` Ice covers ${ice}, the rest will be warm.`;
  return note;
}
// Updates the cells in place instead of redrawing them, so the bars can slide down during the day.
function renderStock(){
  const el = $('#stock');
  if (!el.firstChild) el.innerHTML = Object.entries(SHOP).map(([k, it]) => `<div class="stock-item" data-stock="${k}" role="img">
    <span class="stock-count"><span aria-hidden="true">${it.icon}</span> <b></b></span><small></small><span class="stock-bar"><i></i></span></div>`).join('')
    + '<p class="stock-note"></p>';
  const ready = cupsReady(), limit = ['lemons', 'sugar', 'cups'].reduce((a, k) => cupsFrom(k) < cupsFrom(a) ? k : a);
  el.classList.toggle('live', !!sim);
  for (const k of Object.keys(SHOP)) {
    const have = haveOf(k), makes = cupsFrom(k), what = makes === Infinity ? 'not used' : `makes ${makes}`;
    const cell = el.querySelector(`[data-stock="${k}"]`), start = sim ? sim.opening[k] : 0;
    cell.querySelector('b').textContent = have;
    cell.querySelector('small').textContent = what;
    cell.querySelector('i').style.width = start ? `${have / start * 100}%` : '0%';
    cell.setAttribute('aria-label', `${SHOP[k].name}: ${have}, ${what}`);
    cell.classList.toggle('is-limit', k === limit);
    cell.classList.toggle('is-out', have === 0);
  }
  el.querySelector('.stock-note').textContent = stockNote(ready, limit);
}
// Redrawing replaces the buttons, so put keyboard focus back on the one that was pressed.
function renderBoard(){
  const at = document.activeElement, act = at && at.closest('#board, #openBar') ? at.dataset.act : null;
  paintBoard();
  if (!act) return;
  const again = $(`[data-act="${act}"]:not(:disabled)`) || $('#board [role="tab"][aria-selected="true"]');
  if (again) again.focus({ preventScroll:true });
}
function paintBoard(){
  const el = $('#board');
  $('#openBar').classList.toggle('on', !sim);
  if (sim) {
    const st = sim.stats;
    el.innerHTML = `<div class="tiles tiles--live">
      <div><b>${st.sold}</b><span>cups sold</span></div>
      <div><b class="${st.revenue - sim.cogs - sim.rent >= 0 ? 'good' : 'badc'}">${money(st.revenue - sim.cogs - sim.rent)}</b><span>profit so far (before waste)</span></div>
      <div><b>${money(st.revenue)}</b><span>taken today</span></div>
      <div><b>${sim.queue.length}</b><span>in line</span></div>
      </div>${sim.soldOut ? `<p class="warn warn--line">Out of ${sim.soldOut}! Customers are being turned away. Close early to restock tomorrow.</p>` : ''}`;
    return;
  }
  const tabs = [['supplies','Supplies'],['recipe','Recipe'],['price','Price'],['books','Books']];
  const recStep = (key, label, note, val) => `<div class="row"><div><h3>${label}</h3><p>${note}</p></div>
    <div class="step"><button data-act="rec:${key}:-1" aria-label="Less ${label}">−</button><output>${val}</output><button data-act="rec:${key}:1" aria-label="More ${label}">+</button></div></div>`;
  let body = '';
  if (tab === 'supplies') {
    if (isMobile()) {
      const chips = Object.entries(SHOP).map(([k,it]) => `<button class="chip" data-act="sel:${k}" aria-pressed="${supplyItem===k}" aria-label="${it.name}">${it.icon}</button>`).join('');
      body = `<div class="chips">${chips}</div>` + supplyRow(supplyItem);
    } else {
      body = Object.keys(SHOP).map(supplyRow).join('');
    }
  } else if (tab === 'recipe') {
    const r = S.recipe;
    body = recStep('l','Lemons per pitcher',`One pitcher fills ${yieldCups()} cups.`, r.l)
      + recStep('s','Sugar per pitcher','Cups of sugar. Balance it against the lemons.', r.s)
      + recStep('i','Ice per cup','Hotter days call for more ice.', r.i);
  } else if (tab === 'price') {
    body = pricePanel() + recStep('price','Price per cup','Changes in 5¢ steps.', money(S.recipe.price));
  } else {
    body = renderBooks();
  }
  const ready = cupsReady(), L = loc(), stuck = isStuck();
  let msg = `Ready to sell about ${ready} cups at ${L.name}.`;
  if (L.rent) msg += ` Rent today is ${money(L.rent)}.`;
  if (stuck) msg = 'You’re out of cups and can’t afford more, so Lemonade Inc. is out of business. Start a new season to try again.';
  else if (S.cash < L.rent) msg = `You need ${money(L.rent)} for rent here. Move somewhere cheaper.`;
  else if (!ready) msg = S.cups ? 'Not enough lemons or sugar for one pitcher.' : 'You have no cups. Buy some before opening.';
  else if (S.ice < S.recipe.i * Math.min(ready, 20)) msg += ' You are short on ice.';
  el.innerHTML = `<div class="tabs" role="tablist">${tabs.map(([k,n]) => `<button role="tab" aria-selected="${tab===k}" data-act="tab:${k}">${n}</button>`).join('')}</div>
    <p class="panel-desc">${TAB_INFO[tab]}</p>
    <div class="panel"><div class="rows">${body}</div></div>
    <div class="go"><p>${msg}</p></div>`;
  $('#openBar').innerHTML = `<button class="loc-badge" data-act="showloc" aria-label="Location: ${L.name}. Change location">${icon('pin')}${L.name}</button>
    ${stuck ? '<button class="btn btn--primary btn--lg" data-act="newgame">New season</button>'
      : `<button class="btn btn--primary btn--lg" data-act="open" ${S.cash < L.rent ? 'disabled' : ''}>Open stand</button>`}`;
}
function pricePanel(){
  const c = cupCost(), r = S.recipe, m = r.price - c.total, pct = r.price ? m / r.price * 100 : 0, L = loc();
  const be = L.rent ? (m > 0 ? `${Math.ceil(L.rent / m)} cups to cover rent` : 'Not possible at this price') : 'No rent here';
  return `<div><dl class="cost">
    <dt>Cost per cup</dt><dd>${cents(c.total)}</dd>
    <dt>Price</dt><dd>${cents(r.price)}</dd>
    <dt>Margin per cup</dt><dd class="${m > 0 ? 'good' : 'badc'}">${cents(m)} (${pct.toFixed(0)}%)</dd>
    <dt>Break-even at ${L.name}</dt><dd>${be}</dd>
  </dl></div>`;
}

const svgWrap = (w, h, g) => `<svg viewBox="0 0 ${w} ${h}" role="img">${g}</svg>`;
const axisLine = (x1, x2, y) => `<line class="axis" x1="${x1}" x2="${x2}" y1="${y}" y2="${y}"/>`;
const yLabel = (pl, y, txt) => `<text x="${pl-6}" y="${y+4}" text-anchor="end">${txt}</text>`;
const xLabel = (x, h, txt) => `<text x="${x.toFixed(1)}" y="${h-6}" text-anchor="middle">${txt}</text>`;
function svgBars(vals, labels, fmt){
  const w = 600, h = 180, pl = 52, pr = 8, pt = 12, pb = 24, n = vals.length;
  const top = Math.max(0, ...vals), bot = Math.min(0, ...vals), range = (top - bot) || 1;
  const y = v => pt + (top - v) / range * (h - pt - pb), bw = (w - pl - pr) / n, every = Math.ceil(n / 10);
  let g = axisLine(pl, w-pr, y(0)) + yLabel(pl, y(top), fmt(top));
  if (bot < 0) g += yLabel(pl, y(bot), fmt(bot));
  if (top !== 0 && bot !== 0) g += yLabel(pl, y(0), fmt(0));
  vals.forEach((v, i) => {
    const x = pl + i*bw + bw*0.15, y0 = y(Math.max(v, 0)), hh = Math.max(1, Math.abs(y(v) - y(0)));
    g += `<rect class="${v >= 0 ? 'bar-pos' : 'bar-neg'}" x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${(bw*0.7).toFixed(1)}" height="${hh.toFixed(1)}" rx="2"><title>Day ${labels[i]}: ${fmt(v)}</title></rect>`;
    if (i % every === 0) g += xLabel(pl + i*bw + bw/2, h, labels[i]);
  });
  return svgWrap(w, h, g);
}
function svgLine(vals, labels, fmt){
  const w = 600, h = 180, pl = 52, pr = 12, pt = 12, pb = 24, n = vals.length;
  const top = Math.max(...vals), bot = Math.min(0, ...vals), range = (top - bot) || 1;
  const x = i => n === 1 ? (pl + w - pr) / 2 : pl + i * (w - pl - pr) / (n - 1), y = v => pt + (top - v) / range * (h - pt - pb);
  const every = Math.ceil(n / 10);
  let g = axisLine(pl, w-pr, y(bot)) + yLabel(pl, y(top), fmt(top)) + yLabel(pl, y(bot), fmt(bot));
  g += `<polyline class="trend" points="${vals.map((v,i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`;
  vals.forEach((v, i) => {
    g += `<circle class="trend-dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5"><title>Day ${labels[i]}: ${fmt(v)}</title></circle>`;
    if (i % every === 0) g += xLabel(x(i), h, labels[i]);
  });
  return svgWrap(w, h, g);
}
function svgScatter(pts){
  const w = 600, h = 180, pl = 40, pr = 12, pt = 12, pb = 26;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y1 = Math.max(10, ...ys);
  const x = v => pl + (v - x0) / (x1 - x0) * (w - pl - pr), y = v => pt + (y1 - v) / y1 * (h - pt - pb);
  let g = axisLine(pl, w-pr, y(0)) + yLabel(pl, y(y1), y1) + yLabel(pl, y(0), 0);
  g += `<text x="${pl}" y="${h-6}">${Math.round(x0+1)}°C</text><text x="${w-pr}" y="${h-6}" text-anchor="end">${Math.round(x1-1)}°C</text>`;
  pts.forEach(p => { g += `<circle cx="${x(p.x).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="6" fill="${p.c}" fill-opacity=".85"><title>Day ${p.d}: ${p.y} cups at ${p.x}°C</title></circle>`; });
  return svgWrap(w, h, g);
}

function renderBooks(){
  const lg = S.ledger, stock = stockValue(), { sold, waste, net, avgMargin } = seasonTotals();
  const tiles = `<div class="tiles">
    <div><b>${money(S.cash)}</b><span>cash on hand</span></div>
    <div><b>${money(stock)}</b><span>stock value</span></div>
    <div><b class="${net >= 0 ? 'good' : 'badc'}">${money(net)}</b><span>season profit</span></div>
    <div><b>${cents(avgMargin)}</b><span>average margin per cup</span></div>
    <div><b class="${waste > 0 ? 'badc' : ''}">${money(waste)}</b><span>lost to waste</span></div>
    <div><b>${sold}</b><span>cups sold</span></div></div>`;
  if (!lg.length) return tiles + `<p class="note">Your books fill in after your first day of trading. Open the stand to get started.</p>`;
  const days = lg.map(r => r.day);
  const charts = `<div class="charts">
    <div class="chart"><h4>Net profit per day</h4>${svgBars(lg.map(r => r.net), days, v => money(v))}</div>
    <div class="chart"><h4>Cash at close</h4>${svgLine(lg.map(r => r.cash), days, v => money(v))}</div>
    <div class="chart"><h4>Cups sold by temperature</h4>${svgScatter(lg.map(r => ({ x:r.temp, y:r.sold, d:r.day, c:WEATHER[r.weather].color })))}</div>
  </div>`;
  const rows = lg.slice().reverse().map(r => `<tr><td>${r.day}</td><td>${WEATHER[r.weather].icon} ${r.temp}°</td><td>${locById(r.loc).name}</td>
    <td>${r.sold}</td><td>${money(r.price)}</td><td>${money(r.sales)}</td><td>−${money(r.cogs)}</td><td>${r.waste ? '−' + money(r.waste) : '–'}</td><td>${r.rent ? '−' + money(r.rent) : '–'}</td>
    <td class="${r.net >= 0 ? 'good' : 'badc'}">${money(r.net)}</td><td>${r.capex ? money(r.capex) : '–'}</td><td>${money(r.cash)}</td></tr>`).join('');
  return tiles + charts + `<div class="books-h"><h3>Daily ledger</h3><button class="pack" data-act="season">Season report</button></div>
    <div class="ledger"><table><thead><tr><th>Day</th><th>Weather</th><th>Spot</th><th>Cups</th><th>Price</th><th>Sales</th><th>Cost of cups</th><th>Waste</th><th>Rent</th><th>Net</th><th>Upgrades</th><th>Cash</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note mt-2">Net profit is sales minus the cost of what went into sold cups, waste and rent. Stock you buy stays on the books as stock value until it is used, and upgrades are counted as investments.</p>`;
}

function showSeason(){
  const lg = S.ledger; if (!lg.length) return;
  const { sold, sales, cogs, waste, wLemons, wIce, wPitcher, rent, net, avgMargin } = seasonTotals();
  const capex = sum(Object.values(S.upgLog), u => u.cost);
  const best = lg.reduce((a, r) => r.net > a.net ? r : a), worst = lg.reduce((a, r) => r.net < a.net ? r : a);
  const byLoc = LOCS.map(l => { const rs = lg.filter(r => r.loc === l.id); return { l, n:rs.length, total:sum(rs, r => r.net), cups:sum(rs, r => r.sold) }; }).filter(x => x.n);
  const upg = Object.entries(S.upgLog).map(([id, u]) => {
    const def = UPG.find(x => x.id === id), since = sum(lg.filter(r => r.day >= u.day), r => r.net);
    return `<tr><td>${def.icon} ${def.name}</td><td>${u.day}</td><td>${money(u.cost)}</td><td>${money(since)}</td><td class="${since >= u.cost ? 'pos' : ''}">${since >= u.cost ? 'Paid off' : money(u.cost - since) + ' to go'}</td></tr>`;
  }).join('');
  const html = `${popupHead('Season report', `Days ${lg[0].day} to ${lg[lg.length-1].day}, ${lg.length} days of trading`)}
    <dl class="tally">
      <dt>Cups sold</dt><dd>${sold}</dd>
      <dt>Sales</dt><dd>${money(sales)}</dd>
      <dt>Cost of cups sold</dt><dd>−${money(cogs)}</dd>
      <dt>Average margin per cup</dt><dd>${cents(avgMargin)}</dd>
      <dt>Waste</dt><dd>−${money(waste)}</dd>
      <dt class="indent">Lemons gone bad</dt><dd class="indent">${money(wLemons)}</dd>
      <dt class="indent">Melted ice</dt><dd class="indent">${money(wIce)}</dd>
      <dt class="indent">Lemonade poured out</dt><dd class="indent">${money(wPitcher)}</dd>
      <dt>Rent paid</dt><dd>${rent ? '−' + money(rent) : money(0)}</dd>
      <dt class="profit">Net profit</dt><dd class="profit ${net >= 0 ? 'pos' : 'neg'}">${money(net)}</dd>
      <dt>Invested in upgrades</dt><dd>${money(capex)}</dd>
      <dt>Profit after upgrades</dt><dd class="${net - capex >= 0 ? 'pos' : 'neg'}">${money(net - capex)}</dd>
    </dl>
    <p class="callout">Best day: day ${best.day}, ${money(best.net)} (${WEATHER[best.weather].label.toLowerCase()}, ${best.temp}°C). Worst day: day ${worst.day}, ${money(worst.net)} (${WEATHER[worst.weather].label.toLowerCase()}, ${worst.temp}°C).</p>
    <h3>By location</h3>
    <div class="mini-wrap"><table class="mini"><thead><tr><th>Spot</th><th>Days</th><th>Cups</th><th>Avg per day</th><th>Total</th></tr></thead><tbody>
      ${byLoc.map(x => `<tr><td>${x.l.name}</td><td>${x.n}</td><td>${x.cups}</td><td>${money(x.total / x.n)}</td><td class="${x.total >= 0 ? 'pos' : 'neg'}">${money(x.total)}</td></tr>`).join('')}
    </tbody></table></div>
    <h3>Upgrades</h3>
    ${upg ? `<div class="mini-wrap"><table class="mini"><thead><tr><th>Upgrade</th><th>Bought day</th><th>Cost</th><th>Profit since</th><th>Status</th></tr></thead><tbody>${upg}</tbody></table></div>
    <p class="sub sub--small">An upgrade counts as paid off once your total profit since buying it covers its cost.</p>` : '<p class="sub">No upgrades bought yet.</p>'}
    <div class="btn-stack"><button class="btn btn--primary btn--lg btn--block" data-act="dismiss">Back to the stand</button>
    ${S.seasonDone && lg.length >= SEASON ? '<button class="btn btn--secondary btn--block" data-act="newgame">Start a new season</button>' : ''}</div>`;
  showModal(html, { wide:true, redraw:showSeason });
}

export function renderAll(){ renderStats(); renderSceneStats(); renderStock(); renderBoard(); }

function setSpeed(n){
  if (!sim) return; sim.speed = n;
  document.querySelectorAll('[data-act^="speed:"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.act === 'speed:' + n)));
}
onSim('open', () => { $('#hud').classList.add('on'); setSpeed(1); renderAll(); });
onSim('sale', saleFx);
onSim('end', () => { $('#hud').classList.remove('on'); renderAll(); showReport(); });

function showReport(){ openReport(); countUp($('#netv')); }
function openReport(){
  const r = report, w = WEATHER[r.weather];
  const gross = r.sales - r.cogs, mpc = r.sold ? gross / r.sold : 0, pct = r.sales ? gross / r.sales * 100 : 0;
  const fbs = Object.entries(r.fb).sort((a,b) => b[1]-a[1]).slice(0,6).map(([k,n]) => `<li>${FB[k]} ×${n}</li>`).join('');
  const wparts = [[r.wLemons,'Lemons gone bad'],[r.wIce,'Melted ice'],[r.wPitcher,'Lemonade poured out']].filter(x => x[0] > 0.005);
  let html = `${popupHead(`Day ${r.day} wrap-up`, `${w.icon} ${w.label}, ${r.temp}°C at ${r.locName}`, false)}
    <dl class="tally">
      <dt>People walking past</dt><dd>${r.seen}</dd>
      <dt>Cups sold at ${money(r.price)}</dt><dd>${r.sold}</dd>
      <dt>Sales</dt><dd>${money(r.sales)}</dd>
      <dt>Cost of cups sold</dt><dd>−${money(r.cogs)}</dd>
      <dt>Margin per cup</dt><dd>${cents(mpc)} (${pct.toFixed(0)}%)</dd>
      <dt>Waste</dt><dd>${r.waste > 0.005 ? '−' + money(r.waste) : money(0)}</dd>
      ${wparts.map(([v,l]) => `<dt class="indent">${l}</dt><dd class="indent">${money(v)}</dd>`).join('')}
      <dt>Rent</dt><dd>${r.rent ? '−' + money(r.rent) : money(0)}</dd>
      <dt class="profit">Net profit</dt><dd class="profit ${r.net >= 0 ? 'pos' : 'neg'}" id="netv" data-v="${r.net}">${money(r.net)}</dd>
      <dt>Popularity</dt><dd>${r.pop}% <span class="${r.popChange >= 0 ? 'pos' : 'neg'}">(${r.popChange >= 0 ? '+' : ''}${r.popChange})</span></dd>
      <dt>Cash at close</dt><dd>${money(r.cash)}</dd>
    </dl>
    ${r.bought > 0 ? `<p class="sub sub--tight">You spent ${money(r.bought)} on stock today. Unused stock is worth ${money(r.stock)} and carries over.</p>` : ''}
    ${r.capex > 0 ? `<p class="sub sub--tight">You invested ${money(r.capex)} in upgrades.</p>` : ''}
    ${fbs ? `<ul class="fb">${fbs}</ul>` : '<p class="sub">Nobody stopped by today.</p>'}
    ${r.tip ? `<p class="callout">Tip: ${r.tip}</p>` : ''}
    ${r.notes.map(n => `<p class="sub sub--tight">${n}</p>`).join('')}`;
  if (r.season) {
    html += `<p class="callout">🎉 That's your ${SEASON}-day season! Total profit ${money(seasonTotals().net)}.</p>
      <div class="btn-stack"><button class="btn btn--primary btn--lg btn--block" data-act="season">See season report</button>
      <div class="btn-row"><button class="btn btn--secondary" data-act="next">Keep playing</button><button class="btn btn--secondary" data-act="newgame">New season</button></div></div>`;
  } else html += `<div class="btn-stack"><button class="btn btn--primary btn--lg btn--block" data-act="next">Start day ${S.day}</button></div>`;
  showModal(html, { dismiss:false, redraw:openReport });
}
function countUp(el){
  if (!el || reducedMotion()) return;
  const v = +el.dataset.v, t0 = performance.now();
  const step = now => { const p = Math.min(1, (now - t0) / 800), e = 1 - Math.pow(1 - p, 3); el.textContent = money(v * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
// Spells out what a pack changes, so the player can judge it before the money goes.
let buyAskedAt = 0;
function askBuy(k, i){
  const it = SHOP[k], [n, p] = it.packs[i], have = haveOf(k), each = p / n;
  const saving = 1 - each / (it.packs[0][1] / it.packs[0][0]);
  const before = cupsFrom(k), best = Math.max(0, ...S.ledger.map(r => r.sold));
  buyAskedAt = performance.now();
  showModal(`${popupHead(`Buy ${n} ${it.units}?`, `${money(p)}, ${cents(each)} each${saving > 0.005 ? ` (${Math.round(saving * 100)}% off the smallest pack)` : ''}`, false)}
    <dl class="tally">
      <dt>${it.name} in stock</dt><dd>${have} → ${have + n}</dd>
      ${k !== 'cups' && before !== Infinity ? `<dt>Makes</dt><dd>${before} → ${cupsFrom(k, have + n)} cups</dd>` : ''}
      <dt>Cash</dt><dd>${money(S.cash)} → ${money(S.cash - p)}</dd>
      ${best ? `<dt>Your best day so far</dt><dd>${best} cups sold</dd>` : ''}
    </dl>
    <p class="sub sub--tight">${it.note}</p>
    <div class="btn-stack"><button class="btn btn--primary btn--lg btn--block" data-act="buyyes:${k}:${i}">Confirm</button>
    <button class="btn btn--secondary btn--lg btn--block" data-act="dismiss">Cancel</button></div>`);
}
function confirmBuy(k, i){
  if (performance.now() - buyAskedAt < 300) return; // the second tap of a double-tap can land on Confirm
  hideModal();
  if (buyPack(k, +i)) { sfx('buy'); save(); renderAll(); }
}
function showShop(){
  showModal(`${popupHead('Shop', `One-time upgrades for your stand. You have ${money(S.cash)}.`)}
    <div class="list">${UPG.map(upgradeRow).join('')}</div>`, { wide:true });
}
function showLocations(){
  showModal(`${popupHead('Location', `Busier spots unlock as popularity grows. You're at ${S.pop}%.`)}
    <div class="list">${LOCS.map(locationRow).join('')}</div>`, { wide:true });
}

// What each data-act="name:a:c" button does. shell.js adds its own.
export const ACTIONS = {
  tab(name){ tab = name; renderBoard(); },
  dismiss: dismissModal,
  sel(item){ supplyItem = item; renderBoard(); },
  showloc: showLocations,
  shop: showShop,
  buy(item, pack){ askBuy(item, +pack); },
  buyyes: confirmBuy,
  rec(key, dir){ changeRecipe(key, +dir); save(); renderAll(); },
  upg(id){ if (buyUpgrade(id)) { sfx('upgrade'); save(); renderAll(); showShop(); } },
  loc(id){ S.loc = id; sfx('tap'); save(); renderAll(); hideModal(); },
  open: openStand,
  speed(n){ setSpeed(+n); },
  close(){ if (sim) sim.min = DAY_MIN; },
  next(){ hideModal(); tab = 'supplies'; renderAll(); },
  season: showSeason,
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const [act, a, c] = b.dataset.act.split(':');
  ACTIONS[act](a, c, b);
});
