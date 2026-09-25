/* Lemonade Inc. | state.js
   Game state, saving/loading, stock and cost-per-cup calculations. */
'use strict';

// ---------- state ----------
let S, sim = null, tab = 'supplies', report = null;
let supplyItem = 'lemons';

function genForecast(){
  let r = Math.random(), i = 0;
  while (i < WWEIGHT.length - 1 && r > WWEIGHT[i]) { r -= WWEIGHT[i]; i++; }
  const type = WORDER[i], [a,b] = WEATHER[type].t;
  return { type, temp: rint(a,b) };
}
function newState(){
  return { v:1, day:1, cash:20, pop:10, lemons:[], sugar:0, ice:0, cups:0,
    recipe:{ l:4, s:4, i:3, price:0.40 }, loc:'lane', upg:{}, forecast:genForecast(),
    spend:0, total:0, best:null, seasonDone:false, notes:[], seenHelp:false,
    cost:Object.fromEntries(Object.keys(SHOP).map(k => [k, refCost(k)])), ledger:[], upgLog:{}, capex:0 };
}
function save(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch(e){} }
function load(){
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const d = JSON.parse(raw); if (d && d.v === 1) return normalize(d); } } catch(e){}
  return null;
}
const lemonCount = () => S.lemons.reduce((a,b) => a + b.n, 0);
const loc = () => LOCS.find(l => l.id === S.loc) || LOCS[0];
const yieldCups = () => S.upg.juicer ? 15 : 12;
const idealIce = t => t >= 33 ? 5 : t >= 29 ? 4 : t >= 24 ? 3 : t >= 19 ? 2 : 1;
const refCost = k => SHOP[k].packs[0][1] / SHOP[k].packs[0][0];
const haveOf = k => k === 'lemons' ? lemonCount() : S[k];
const unitCost = k => haveOf(k) > 0 ? S.cost[k] : refCost(k);
const cents = n => Math.abs(n) < 1 ? (n < 0 ? '-' : '') + (Math.abs(n)*100).toFixed(1) + '¢' : money(n);
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
function cupCost(){
  const { l, s, i } = S.recipe, y = yieldCups();
  const c = { lemons:l*unitCost('lemons')/y, sugar:s*unitCost('sugar')/y, ice:i*unitCost('ice'), cups:unitCost('cups') };
  c.total = c.lemons + c.sugar + c.ice + c.cups;
  return c;
}
const stockValue = () => sum(Object.keys(SHOP), k => haveOf(k) * S.cost[k]);
function normalize(d){
  d.cost = d.cost || {};
  for (const k in SHOP) if (d.cost[k] == null) d.cost[k] = refCost(k);
  d.ledger = d.ledger || []; d.upgLog = d.upgLog || {}; d.capex = d.capex || 0;
  for (const u of UPG) if (d.upg[u.id] && !d.upgLog[u.id]) d.upgLog[u.id] = { cost:u.cost, day:1 };
  return d;
}

function cupsReady(){
  const { l, s } = S.recipe;
  const pitchers = Math.min(l > 0 ? Math.floor(lemonCount()/l) : Infinity, s > 0 ? Math.floor(S.sugar/s) : Infinity);
  return Math.min(pitchers * yieldCups(), S.cups);
}
function useLemons(n){
  let left = n;
  for (const b of S.lemons) { const take = Math.min(b.n, left); b.n -= take; left -= take; if (!left) break; }
  S.lemons = S.lemons.filter(b => b.n > 0);
}
