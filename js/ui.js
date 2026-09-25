/* Lemonade Inc. | ui.js
   Menus and panels: stats bar, tabs, Books, charts, day report, season report, button handling. */
'use strict';

// ---------- UI ----------
const mobileMQ = window.matchMedia('(max-width:560px)');
const isMobile = () => mobileMQ.matches;
mobileMQ.addEventListener('change', () => renderBoard());

function supplyRow(k){
  const it = SHOP[k], fresh = S.lemons.filter(b => b.age === 3).reduce((a,b) => a+b.n, 0);
  const have = k === 'lemons' ? lemonCount() : S[k];
  const extra = k === 'lemons' && fresh ? ` <span class="warn">${fresh} go bad tonight.</span>` : '';
  return `<div class="row"><div><h3>${it.icon} ${it.name}: ${have}</h3><p>${it.note}${extra}</p></div>
    <div class="packs">${it.packs.map(([n,p],i) => `<button class="pack" data-act="buy:${k}:${i}" ${S.cash < p ? 'disabled' : ''}>Buy ${n}<small>${money(p)}</small></button>`).join('')}</div></div>`;
}
function upgradeRow(u){
  return `<div class="row"><div><h3>${u.icon} ${u.name}</h3><p>${u.desc}</p></div>
    <div>${S.upg[u.id] ? '<span class="owned">Owned</span>' : `<button class="pack" data-act="upg:${u.id}" ${S.cash < u.cost ? 'disabled' : ''}>Buy<small>${money(u.cost)}</small></button>`}</div></div>`;
}
function locationRow(l){
  const locked = S.pop < l.need, here = S.loc === l.id;
  return `<div class="row"><div><h3>${l.name}</h3><p>${l.desc} Rent ${l.rent ? money(l.rent) + ' a day' : 'free'}.${locked ? ` <span class="warn">Needs ${l.need}% popularity.</span>` : ''}</p></div>
    <div>${here ? '<span class="owned">You are here</span>' : `<button class="pack" data-act="loc:${l.id}" ${locked ? 'disabled' : ''}>Move here</button>`}</div></div>`;
}

function renderStats(){
  const f = S.forecast, w = WEATHER[sim ? sim.weather : f.type];
  const temp = sim ? sim.temp : f.temp + loc().bias;
  $('#stats').innerHTML = `
    <span class="stat"><small>Day</small>${S.day}${S.seasonDone ? '' : ' of ' + SEASON}</span>
    <span class="stat"><small>Cash</small>${money(S.cash)}</span>
    <span class="stat"><small>Popularity</small>${S.pop}%<span class="meter"><i style="width:${S.pop}%"></i></span></span>
    <span class="stat" title="${sim ? 'Today' : 'Forecast'}">${w.icon} ${temp}°C <small style="margin:0 0 0 4px">${sim ? 'today' : 'forecast'}</small></span>
    <button class="iconbtn" data-act="help">How to play</button>`;
}
function renderBoard(){
  const el = $('#board');
  if (sim) {
    const st = sim.stats;
    el.innerHTML = `<div class="live">
      <div><b>${st.sold}</b><span>cups sold</span></div>
      <div><b class="${st.revenue - sim.cogs - sim.rent >= 0 ? 'good' : 'badc'}">${money(st.revenue - sim.cogs - sim.rent)}</b><span>profit so far (before waste)</span></div>
      <div><b>${money(st.revenue)}</b><span>taken today</span></div>
      <div><b>${sim.queue.length}</b><span>in line</span></div>
      <div><b>${lemonCount()} / ${S.sugar}</b><span>lemons / sugar left</span></div>
      <div><b>${S.ice} / ${S.cups}</b><span>ice / cups left</span></div>
      </div>${sim.soldOut ? `<p class="warn" style="margin:12px 0 0;font-weight:800">Out of ${sim.soldOut}! Customers are being turned away. Close early to restock tomorrow.</p>` : ''}`;
    return;
  }
  const tabs = [['supplies','Supplies'],['recipe','Recipe'],['upgrades','Upgrades'],['spot','Location'],['books','Books']];
  let body = '';
  if (tab === 'supplies') {
    if (isMobile()) {
      const chips = Object.entries(SHOP).map(([k,it]) => `<button class="chip" data-act="sel:sup:${k}" aria-pressed="${supplyItem===k}" aria-label="${it.name}">${it.icon}</button>`).join('');
      body = `<div class="chips">${chips}</div>` + supplyRow(SHOP[supplyItem] ? supplyItem : 'lemons');
    } else {
      body = Object.keys(SHOP).map(supplyRow).join('');
    }
  } else if (tab === 'recipe') {
    const r = S.recipe, st = (key, label, note, val) => `<div class="row"><div><h3>${label}</h3><p>${note}</p></div>
      <div class="step"><button data-act="rec:${key}:-1" aria-label="Less ${label}">−</button><output>${val}</output><button data-act="rec:${key}:1" aria-label="More ${label}">+</button></div></div>`;
    body = st('l','Lemons per pitcher',`One pitcher fills ${yieldCups()} cups.`, r.l)
      + st('s','Sugar per pitcher','Cups of sugar. Balance it against the lemons.', r.s)
      + st('i','Ice per cup','Hotter days call for more ice.', r.i)
      + st('price','Price per cup','Pricier spots and hotter days let you charge more.', money(r.price));
    body = costPanel() + body;
  } else if (tab === 'upgrades') {
    if (isMobile()) {
      const chips = UPG.map(u => `<button class="chip" data-act="sel:upg:${u.id}" aria-pressed="${upgId===u.id}">${u.icon} ${u.name}</button>`).join('');
      body = `<div class="chips">${chips}</div>` + upgradeRow(UPG.find(x => x.id === upgId) || UPG[0]);
    } else {
      body = UPG.map(upgradeRow).join('');
    }
  } else if (tab === 'books') {
    body = renderBooks();
  } else {
    if (isMobile()) {
      const chips = LOCS.map(l => `<button class="chip" data-act="sel:loc:${l.id}" aria-pressed="${locId===l.id}">${l.name}</button>`).join('');
      body = `<div class="chips">${chips}</div>` + locationRow(LOCS.find(x => x.id === locId) || LOCS[0]);
    } else {
      body = LOCS.map(locationRow).join('');
    }
  }
  const ready = cupsReady(), L = loc();
  let msg = `Ready to sell about ${ready} cups at ${L.name}.`;
  if (L.rent) msg += ` Rent today is ${money(L.rent)}.`;
  if (S.cash < L.rent) msg = `You need ${money(L.rent)} for rent here. Move somewhere cheaper.`;
  else if (!ready) msg = S.cups ? 'Not enough lemons or sugar for one pitcher.' : 'You have no cups. Buy some before opening.';
  else if (S.ice < S.recipe.i * Math.min(ready, 20)) msg += ' You are short on ice.';
  el.innerHTML = `<div class="tabs" role="tablist">${tabs.map(([k,n]) => `<button role="tab" aria-selected="${tab===k}" data-act="tab:${k}">${n}</button>`).join('')}</div>
    <div class="rows">${body}</div>
    <div class="go"><p>${msg}</p><button class="open" data-act="open" ${S.cash < L.rent ? 'disabled' : ''}>Open stand</button></div>`;
}
function costPanel(){
  const c = cupCost(), r = S.recipe, m = r.price - c.total, pct = r.price ? m / r.price * 100 : 0, L = loc();
  const be = L.rent ? (m > 0 ? `${Math.ceil(L.rent / m)} cups to cover rent` : 'Not possible at this price') : 'No rent here';
  return `<div><dl class="cost">
    <dt>🍋 Lemons</dt><dd>${cents(c.lemons)}</dd>
    <dt>🍬 Sugar</dt><dd>${cents(c.sugar)}</dd>
    <dt>🧊 Ice</dt><dd>${cents(c.ice)}</dd>
    <dt>🥤 Cup</dt><dd>${cents(c.cups)}</dd>
    <dt class="sum">Cost per cup</dt><dd class="sum">${cents(c.total)}</dd>
    <dt>Price</dt><dd>${cents(r.price)}</dd>
    <dt>Margin per cup</dt><dd class="${m > 0 ? 'good' : 'badc'}">${cents(m)} (${pct.toFixed(0)}%)</dd>
    <dt>Break-even at ${L.name}</dt><dd>${be}</dd>
  </dl><p class="note">Costs use the average price you paid for the stock you hold. Items you don't have yet use the smallest-pack price.</p></div>`;
}

function svgBars(vals, labels, fmt){
  const w = 600, h = 180, pl = 52, pr = 8, pt = 12, pb = 24, n = vals.length;
  const top = Math.max(0, ...vals), bot = Math.min(0, ...vals), range = (top - bot) || 1;
  const y = v => pt + (top - v) / range * (h - pt - pb), bw = (w - pl - pr) / n, every = Math.ceil(n / 10);
  let g = `<line x1="${pl}" x2="${w-pr}" y1="${y(0)}" y2="${y(0)}" stroke="#B9C8BC" stroke-opacity=".5"/>`;
  g += `<text x="${pl-6}" y="${y(top)+4}" text-anchor="end">${fmt(top)}</text>`;
  if (bot < 0) g += `<text x="${pl-6}" y="${y(bot)+4}" text-anchor="end">${fmt(bot)}</text>`;
  if (top !== 0 && bot !== 0) g += `<text x="${pl-6}" y="${y(0)+4}" text-anchor="end">${fmt(0)}</text>`;
  vals.forEach((v, i) => {
    const x = pl + i*bw + bw*0.15, y0 = y(Math.max(v, 0)), hh = Math.max(1, Math.abs(y(v) - y(0)));
    g += `<rect x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${(bw*0.7).toFixed(1)}" height="${hh.toFixed(1)}" rx="2" fill="${v >= 0 ? '#9BE39A' : '#FFB4A8'}"><title>Day ${labels[i]}: ${fmt(v)}</title></rect>`;
    if (i % every === 0) g += `<text x="${(pl + i*bw + bw/2).toFixed(1)}" y="${h-6}" text-anchor="middle">${labels[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" font-size="13" fill="#B9C8BC" font-family="Nunito, system-ui, sans-serif" role="img">${g}</svg>`;
}
function svgLine(vals, labels, fmt){
  const w = 600, h = 180, pl = 52, pr = 12, pt = 12, pb = 24, n = vals.length;
  const top = Math.max(...vals), bot = Math.min(0, ...vals), range = (top - bot) || 1;
  const x = i => n === 1 ? (pl + w - pr) / 2 : pl + i * (w - pl - pr) / (n - 1), y = v => pt + (top - v) / range * (h - pt - pb);
  const every = Math.ceil(n / 10);
  let g = `<line x1="${pl}" x2="${w-pr}" y1="${y(bot)}" y2="${y(bot)}" stroke="#B9C8BC" stroke-opacity=".5"/>`;
  g += `<text x="${pl-6}" y="${y(top)+4}" text-anchor="end">${fmt(top)}</text><text x="${pl-6}" y="${y(bot)+4}" text-anchor="end">${fmt(bot)}</text>`;
  g += `<polyline fill="none" stroke="#FFD93B" stroke-width="3" stroke-linejoin="round" points="${vals.map((v,i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`;
  vals.forEach((v, i) => {
    g += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="#FFD93B"><title>Day ${labels[i]}: ${fmt(v)}</title></circle>`;
    if (i % every === 0) g += `<text x="${x(i).toFixed(1)}" y="${h-6}" text-anchor="middle">${labels[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" font-size="13" fill="#B9C8BC" font-family="Nunito, system-ui, sans-serif" role="img">${g}</svg>`;
}
function svgScatter(pts){
  const w = 600, h = 180, pl = 40, pr = 12, pt = 12, pb = 26;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y1 = Math.max(10, ...ys);
  const x = v => pl + (v - x0) / (x1 - x0) * (w - pl - pr), y = v => pt + (y1 - v) / y1 * (h - pt - pb);
  let g = `<line x1="${pl}" x2="${w-pr}" y1="${y(0)}" y2="${y(0)}" stroke="#B9C8BC" stroke-opacity=".5"/>`;
  g += `<text x="${pl-6}" y="${y(y1)+4}" text-anchor="end">${y1}</text><text x="${pl-6}" y="${y(0)+4}" text-anchor="end">0</text>`;
  g += `<text x="${pl}" y="${h-6}">${Math.round(x0+1)}°C</text><text x="${w-pr}" y="${h-6}" text-anchor="end">${Math.round(x1-1)}°C</text>`;
  pts.forEach(p => { g += `<circle cx="${x(p.x).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="6" fill="${p.c}" fill-opacity=".85"><title>Day ${p.d}: ${p.y} cups at ${p.x}°C</title></circle>`; });
  return `<svg viewBox="0 0 ${w} ${h}" font-size="13" fill="#B9C8BC" font-family="Nunito, system-ui, sans-serif" role="img">${g}</svg>`;
}
const WCOLOR = { hot:'#FFB347', sunny:'#FFD93B', cloudy:'#D5DEE3', rain:'#7FC4F0', storm:'#A99CF0' };

function renderBooks(){
  const lg = S.ledger, stock = stockValue();
  const sold = sum(lg, r => r.sold), sales = sum(lg, r => r.sales), cogs = sum(lg, r => r.cogs), waste = sum(lg, r => r.waste);
  const avgM = sold ? (sales - cogs) / sold : 0;
  const tiles = `<div class="tiles">
    <div><b>${money(S.cash)}</b><span>cash on hand</span></div>
    <div><b>${money(stock)}</b><span>stock value</span></div>
    <div><b class="${S.total >= 0 ? 'good' : 'badc'}">${money(S.total)}</b><span>season profit</span></div>
    <div><b>${cents(avgM)}</b><span>average margin per cup</span></div>
    <div><b class="${waste > 0 ? 'badc' : ''}">${money(waste)}</b><span>lost to waste</span></div>
    <div><b>${sold}</b><span>cups sold</span></div></div>`;
  if (!lg.length) return tiles + `<p class="note">Your books fill in after your first day of trading. Open the stand to get started.</p>`;
  const days = lg.map(r => r.day);
  const charts = `<div class="charts">
    <div class="chart"><h4>Net profit per day</h4>${svgBars(lg.map(r => r.net), days, v => money(v))}</div>
    <div class="chart"><h4>Cash at close</h4>${svgLine(lg.map(r => r.cash), days, v => money(v))}</div>
    <div class="chart"><h4>Cups sold by temperature</h4>${svgScatter(lg.map(r => ({ x:r.temp, y:r.sold, d:r.day, c:WCOLOR[r.weather] })))}</div>
  </div>`;
  const rows = lg.slice().reverse().map(r => `<tr><td>${r.day}</td><td>${WEATHER[r.weather].icon} ${r.temp}°</td><td>${(LOCS.find(l => l.id === r.loc) || LOCS[0]).name}</td>
    <td>${r.sold}</td><td>${money(r.price)}</td><td>${money(r.sales)}</td><td>−${money(r.cogs)}</td><td>${r.waste ? '−' + money(r.waste) : '–'}</td><td>${r.rent ? '−' + money(r.rent) : '–'}</td>
    <td class="${r.net >= 0 ? 'good' : 'badc'}">${money(r.net)}</td><td>${r.capex ? money(r.capex) : '–'}</td><td>${money(r.cash)}</td></tr>`).join('');
  return tiles + charts + `<div class="books-h"><h3>Daily ledger</h3><button class="pack" data-act="season">Season report</button></div>
    <div class="ledger"><table><thead><tr><th>Day</th><th>Weather</th><th>Spot</th><th>Cups</th><th>Price</th><th>Sales</th><th>Cost of cups</th><th>Waste</th><th>Rent</th><th>Net</th><th>Upgrades</th><th>Cash</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note" style="margin-top:8px">Net profit is sales minus the cost of what went into sold cups, waste and rent. Stock you buy stays on the books as stock value until it is used, and upgrades are counted as investments.</p>`;
}

function showSeason(){
  const lg = S.ledger; if (!lg.length) return;
  const sold = sum(lg, r => r.sold), sales = sum(lg, r => r.sales), cogs = sum(lg, r => r.cogs);
  const wL = sum(lg, r => r.wLemons), wI = sum(lg, r => r.wIce), wP = sum(lg, r => r.wPitcher);
  const rent = sum(lg, r => r.rent), net = sum(lg, r => r.net), capex = sum(Object.values(S.upgLog), u => u.cost);
  const best = lg.reduce((a, r) => r.net > a.net ? r : a), worst = lg.reduce((a, r) => r.net < a.net ? r : a);
  const byLoc = LOCS.map(l => { const rs = lg.filter(r => r.loc === l.id); return { l, n:rs.length, total:sum(rs, r => r.net), cups:sum(rs, r => r.sold) }; }).filter(x => x.n);
  const upg = Object.entries(S.upgLog).map(([id, u]) => {
    const def = UPG.find(x => x.id === id), since = sum(lg.filter(r => r.day >= u.day), r => r.net);
    return `<tr><td>${def.icon} ${def.name}</td><td>${u.day}</td><td>${money(u.cost)}</td><td>${money(since)}</td><td class="${since >= u.cost ? 'pos' : ''}">${since >= u.cost ? 'Paid off' : money(u.cost - since) + ' to go'}</td></tr>`;
  }).join('');
  const html = `<h2>Season report</h2><p class="sub">Days ${lg[0].day} to ${lg[lg.length-1].day}, ${lg.length} days of trading</p>
    <dl class="tally">
      <dt>Cups sold</dt><dd>${sold}</dd>
      <dt>Sales</dt><dd>${money(sales)}</dd>
      <dt>Cost of cups sold</dt><dd>−${money(cogs)}</dd>
      <dt>Average margin per cup</dt><dd>${cents(sold ? (sales - cogs) / sold : 0)}</dd>
      <dt>Waste</dt><dd>−${money(wL + wI + wP)}</dd>
      <dt class="indent">Lemons gone bad</dt><dd class="indent">${money(wL)}</dd>
      <dt class="indent">Melted ice</dt><dd class="indent">${money(wI)}</dd>
      <dt class="indent">Lemonade poured out</dt><dd class="indent">${money(wP)}</dd>
      <dt>Rent paid</dt><dd>${rent ? '−' + money(rent) : money(0)}</dd>
      <dt class="profit">Net profit</dt><dd class="profit ${net >= 0 ? 'pos' : 'neg'}">${money(net)}</dd>
      <dt>Invested in upgrades</dt><dd>${money(capex)}</dd>
      <dt>Profit after upgrades</dt><dd class="${net - capex >= 0 ? 'pos' : 'neg'}">${money(net - capex)}</dd>
    </dl>
    <p class="tip">Best day: day ${best.day}, ${money(best.net)} (${WEATHER[best.weather].label.toLowerCase()}, ${best.temp}°C). Worst day: day ${worst.day}, ${money(worst.net)} (${WEATHER[worst.weather].label.toLowerCase()}, ${worst.temp}°C).</p>
    <h3>By location</h3>
    <div class="mini-wrap"><table class="mini"><thead><tr><th>Spot</th><th>Days</th><th>Cups</th><th>Avg per day</th><th>Total</th></tr></thead><tbody>
      ${byLoc.map(x => `<tr><td>${x.l.name}</td><td>${x.n}</td><td>${x.cups}</td><td>${money(x.total / x.n)}</td><td class="${x.total >= 0 ? 'pos' : 'neg'}">${money(x.total)}</td></tr>`).join('')}
    </tbody></table></div>
    <h3>Upgrades</h3>
    ${upg ? `<div class="mini-wrap"><table class="mini"><thead><tr><th>Upgrade</th><th>Bought day</th><th>Cost</th><th>Profit since</th><th>Status</th></tr></thead><tbody>${upg}</tbody></table></div>
    <p class="sub" style="font-size:14px">An upgrade counts as paid off once your total profit since buying it covers its cost.</p>` : '<p class="sub">No upgrades bought yet.</p>'}
    <button class="open" data-act="closemodal">Back to the stand</button>
    ${S.seasonDone && lg.length >= SEASON ? '<button class="ghost" data-act="newgame">Start a new season</button>' : ''}`;
  $('#card').classList.add('wide');
  showModal(html);
}

function renderAll(){ renderStats(); renderBoard(); }

function showModal(html){ $('#card').innerHTML = html; $('#modal').classList.add('on'); const b = $('#card button'); if (b) b.focus(); }
function hideModal(){ $('#modal').classList.remove('on'); $('#card').classList.remove('wide'); }
function showReport(){
  const r = report, w = WEATHER[r.weather];
  const gross = r.sales - r.cogs, mpc = r.sold ? gross / r.sold : 0, pct = r.sales ? gross / r.sales * 100 : 0;
  const fbs = Object.entries(r.fb).sort((a,b) => b[1]-a[1]).slice(0,6).map(([k,n]) => `<li>${FB[k]} ×${n}</li>`).join('');
  const wparts = [[r.wLemons,'Lemons gone bad'],[r.wIce,'Melted ice'],[r.wPitcher,'Lemonade poured out']].filter(x => x[0] > 0.005);
  let html = `<h2>Day ${r.day} wrap-up</h2><p class="sub">${w.icon} ${w.label}, ${r.temp}°C at ${r.locName}</p>
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
    ${r.bought > 0 ? `<p class="sub" style="margin:4px 0">You spent ${money(r.bought)} on stock today. Unused stock is worth ${money(r.stock)} and carries over.</p>` : ''}
    ${r.capex > 0 ? `<p class="sub" style="margin:4px 0">You invested ${money(r.capex)} in upgrades.</p>` : ''}
    ${fbs ? `<ul class="fb">${fbs}</ul>` : '<p class="sub">Nobody stopped by today.</p>'}
    ${r.tip ? `<p class="tip">Tip: ${r.tip}</p>` : ''}
    ${r.notes.map(n => `<p class="sub" style="margin:4px 0">${n}</p>`).join('')}`;
  if (r.season) {
    html += `<p class="tip">That's your ${SEASON}-day season! Total profit ${money(S.total)}.</p>
      <button class="open" data-act="season">See season report</button><button class="ghost" data-act="next">Keep playing</button><button class="ghost" data-act="newgame">Start a new season</button>`;
  } else html += `<button class="open" data-act="next">Start day ${S.day}</button>`;
  showModal(html);
  countUp($('#netv'));
}
function countUp(el){
  if (!el || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const v = +el.dataset.v, t0 = performance.now();
  const step = now => { const p = Math.min(1, (now - t0) / 800), e = 1 - Math.pow(1 - p, 3); el.textContent = money(v * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function showHelp(){
  showModal(`<h2>How to play</h2><p class="sub">Run Lemonade Inc. for a ${SEASON}-day season and make as much money as you can.</p>
    <ol class="help">
      <li>Each morning, check the forecast and buy lemons, sugar, ice and cups.</li>
      <li>Set your recipe and price. Customers tell you what they think in speech bubbles.</li>
      <li>Open the stand and watch the day play out. Speed it up with 2× or 4×.</li>
      <li>Happy customers raise your popularity, which brings more buyers and unlocks better locations.</li>
      <li>Lemons go bad after 4 days and ice melts overnight, so don't overbuy.</li>
      <li>The Recipe tab shows your cost and margin per cup. The Books tab tracks your daily finances.</li>
    </ol>
    <p class="sub">Your game saves automatically in this browser.</p>
    <button class="open" data-act="closehelp">Let's squeeze</button>
    <button class="ghost" data-act="newgame">Restart from day 1</button>`);
}

function showDrawer(){ $('#drawer').classList.add('on'); $('.scrim').classList.add('on'); }
function hideDrawer(){ $('#drawer').classList.remove('on'); $('.scrim').classList.remove('on'); }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const [act, a, c] = b.dataset.act.split(':');
  if (act === 'tab') { tab = a; renderBoard(); return; }
  if (act === 'menu') { showDrawer(); return; }
  if (act === 'closemenu') { hideDrawer(); return; }
  if (act === 'sel') {
    if (a === 'sup') supplyItem = c; else if (a === 'upg') upgId = c; else if (a === 'loc') locId = c;
    renderBoard(); return;
  }
  if (act === 'buy') {
    const [n, p] = SHOP[a].packs[+c]; if (S.cash < p) return;
    const have = haveOf(a); S.cost[a] = (have * S.cost[a] + p) / (have + n);
    S.cash = +(S.cash - p).toFixed(2); S.spend += p;
    if (a === 'lemons') { const last = S.lemons[S.lemons.length-1]; if (last && last.age === 0) last.n += n; else S.lemons.push({ n, age:0 }); }
    else S[a] += n;
    save(); renderAll(); return;
  }
  if (act === 'rec') {
    const d = +c, r = S.recipe;
    if (a === 'price') r.price = +clamp(r.price + d*0.05, 0.05, 5).toFixed(2);
    else r[a] = clamp(r[a] + d, 0, a === 'i' ? 8 : 10);
    save(); renderAll(); return;
  }
  if (act === 'upg') { const u = UPG.find(x => x.id === a); if (S.cash >= u.cost && !S.upg[a]) { S.cash -= u.cost; S.capex = (S.capex || 0) + u.cost; S.upg[a] = true; S.upgLog[a] = { cost:u.cost, day:S.day }; save(); renderAll(); } return; }
  if (act === 'loc') { S.loc = a; save(); renderAll(); return; }
  if (act === 'open') { openStand(); return; }
  if (act === 'speed') { setSpeed(+a); return; }
  if (act === 'close') { if (sim) sim.min = DAY_MIN; return; }
  if (act === 'next') { hideModal(); tab = 'supplies'; renderAll(); return; }
  if (act === 'help') { hideDrawer(); showHelp(); return; }
  if (act === 'season') { showSeason(); return; }
  if (act === 'closemodal') { hideModal(); renderAll(); return; }
  if (act === 'closehelp') { S.seenHelp = true; save(); hideModal(); return; }
  if (act === 'newgame') { if (sim) return; S = newState(); S.seenHelp = true; save(); hideModal(); tab = 'supplies'; renderAll(); return; }
});
