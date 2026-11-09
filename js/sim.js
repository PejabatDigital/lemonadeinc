/* Lemonade Inc. | sim.js
   The trading day: customers deciding, queueing, taste scoring, and the end-of-day books. */
import { W, STAND_X, QY, DAY_MIN, SEASON, BALANCE, WEATHER, SHOP, CUSTOMERS, FB, TIPS, clamp, rng } from './config.js';
import { S, sim, report, setSim, setReport, genForecast, loc, idealIce, yieldCups, lemonCount, haveOf, useLemons, addCash, sum, stockValue, isStuck, save } from './state.js';

// The sim never touches the page. It announces 'open', 'sale' and 'end', and ui.js and shell.js react.
const simListeners = {};
export const onSim = (event, fn) => (simListeners[event] = simListeners[event] || []).push(fn);
const emit = (event, ...args) => (simListeners[event] || []).forEach(fn => fn(...args));

// ---------- day simulation ----------
export function openStand(){
  const L = loc();
  if (S.cash < L.rent || isStuck()) return;
  const { type } = S.forecast.actual, temp = S.forecast.actual.temp + L.bias;
  addCash(-L.rent);
  const tf = clamp((temp - 10) / 24, 0.15, 1.1);
  setSim({
    min:0, speed:1, walkers:[], queue:[], spawnAcc:0, serveT:0, pitcher:0, weather:type, temp, tf,
    N: L.traffic * WEATHER[type].traffic * (1 + S.pop/150) * (S.upg.sign ? BALANCE.signTraffic : 1),
    willingness: (0.55 + 0.55*tf) * (0.85 + S.pop/300), // today's mood: hot days and a good name loosen wallets
    rent:L.rent, soldOut:null, popDelta:0, cogs:0, pcpc:0,
    opening:Object.fromEntries(Object.keys(SHOP).map(k => [k, haveOf(k)])),
    stats:{ seen:0, sold:0, revenue:0, fb:{},
      byType:Object.fromEntries(Object.keys(CUSTOMERS).map(k => [k, { wanted:0, bought:0, pricey:0, left:0, soldout:0 }])) },
  });
  emit('open');
}
export const priceLimit = type => CUSTOMERS[type].budget * sim.willingness;
function fb(k){ sim.stats.fb[k] = (sim.stats.fb[k] || 0) + 1; }
const tally = w => sim.stats.byType[w.type];
function say(w, k){
  if ((k === 'line' || k === 'pricey' || k === 'ok') && sim && sim.walkers.filter(x => x.bubble).length >= 4) return;
  w.bubble = FB[k]; w.bt = 2.6;
}

export function pickCustomer(){
  const mix = Object.entries(loc().mix);
  let r = rng() * sum(mix, m => m[1]);
  for (const [type, weight] of mix) if ((r -= weight) < 0) return type;
  return mix[0][0];
}
function spawnWalker(){
  const type = pickCustomer(), dir = rng() < .5 ? 1 : -1, laneY = 318 + rng()*26;
  sim.walkers.push({ type, x: dir > 0 ? -30 : W+30, y:laneY, laneY, dir, spd:(0.8 + rng()*0.5) * (CUSTOMERS[type].pace || 1), hop:0, shiver:0,
    state:'walk', decided:false, arrived:false, waited:0, bubble:null, bt:0, phase:rng()*6, cup:false });
}
export function decide(w){
  w.decided = true; sim.stats.seen++;
  const umbrella = S.upg.parasol && (sim.temp >= 30 || WEATHER[sim.weather].wet) ? BALANCE.parasolInterest : 1;
  const interest = clamp(sim.tf * (0.55 + S.pop/200) * WEATHER[sim.weather].want * umbrella, 0.05, 0.95);
  if (rng() > interest) return;
  tally(w).wanted++;
  if (sim.soldOut) { say(w,'soldout'); fb('soldout'); tally(w).soldout++; sim.popDelta -= BALANCE.popLoss.soldout; return; }
  const r = S.recipe.price / priceLimit(w.type);
  const priceOk = r <= 0.5 ? 1 : clamp(1 - (r - 0.5)*1.6, 0, 1);
  if (r > 1 || rng() > priceOk) { say(w,'pricey'); fb('pricey'); tally(w).pricey++; sim.popDelta -= BALANCE.popLoss.pricey; return; }
  if (sim.queue.length >= BALANCE.maxQueue) { say(w,'line'); fb('line'); tally(w).left++; sim.popDelta -= BALANCE.popLoss.line; return; }
  w.state = 'queue'; sim.queue.push(w);
}
function leaveLine(w){
  sim.queue.splice(sim.queue.indexOf(w), 1);
  w.state = 'leave'; say(w,'line'); fb('line'); tally(w).left++; sim.popDelta -= BALANCE.popLoss.line;
}
function makePitcher(){
  const { l, s } = S.recipe;
  if (lemonCount() < l) { sim.soldOut = 'lemons'; return false; }
  if (S.sugar < s) { sim.soldOut = 'sugar'; return false; }
  sim.pcpc = (l*S.cost.lemons + s*S.cost.sugar) / yieldCups();
  useLemons(l); S.sugar -= s; sim.pitcher = yieldCups(); return true;
}
export function taste(iceUsed, type){
  const { l, s } = S.recipe, likes = CUSTOMERS[type].likes, sour = l - s - likes.sour, str = l + s - likes.strength, ideal = idealIce(sim.temp) + likes.ice;
  const terms = [
    ['sour', sour > 0 ? sour*0.11 : 0], ['sweet', sour < 0 ? -sour*0.11 : 0],
    ['watery', str < 0 ? -str*0.07 : 0], ['strong', str > 0 ? str*0.06 : 0],
  ];
  if (iceUsed === 0) terms.push(['warm', 0.22 + ideal*0.04]);
  else { const d = iceUsed - ideal; terms.push(['ice', d < 0 ? -d*0.08 : 0], ['muchice', d > 0 ? d*0.06 : 0]); }
  const forgiven = 1 - BALANCE.popForgiveness * S.pop/100;
  for (const t of terms) t[1] *= forgiven;
  const r = S.recipe.price / priceLimit(type); terms.push(['pricey', r > 0.75 ? (r-0.75)*0.6 : 0]);
  let pen = 0, worst = terms[0];
  for (const t of terms) { pen += t[1]; if (t[1] > worst[1]) worst = t; }
  const score = clamp(1 - pen + (rng() - 0.5)*0.12, 0, 1);
  const key = score >= 0.78 ? 'yum' : (worst[1] >= 0.1 ? worst[0] : 'ok');
  return { score, key };
}
function sellOutQueue(){
  for (const q of sim.queue) { q.state = 'leave'; say(q,'soldout'); fb('soldout'); tally(q).soldout++; sim.popDelta -= BALANCE.popLoss.soldout; }
  sim.queue = [];
}
export function serve(w){
  if (S.cups <= 0) sim.soldOut = sim.soldOut || 'cups';
  if (!sim.soldOut && sim.pitcher <= 0) makePitcher();
  if (sim.soldOut) { sim.queue.unshift(w); sellOutQueue(); return; }
  S.cups--; sim.pitcher--;
  const iceUsed = Math.min(S.recipe.i, S.ice); S.ice -= iceUsed;
  const t = taste(iceUsed, w.type);
  sim.cogs += sim.pcpc + iceUsed*S.cost.ice + S.cost.cups;
  addCash(S.recipe.price); sim.stats.revenue += S.recipe.price; sim.stats.sold++; tally(w).bought++;
  sim.popDelta += (t.score - 0.55) * 0.6;
  fb(t.key); say(w, t.key); emit('sale', S.recipe.price);
  if (t.key === 'yum') w.hop = 0.6;
  if (t.key === 'muchice') w.shiver = 1.4;
  w.state = 'leave'; w.cup = true;
}
export function stepSim(dt){
  const dm = dt * sim.speed * 9;
  sim.min += dm;
  sim.spawnAcc += dm * sim.N / DAY_MIN;
  while (sim.spawnAcc >= 1) { spawnWalker(); sim.spawnAcc -= 1; }
  const v = 70 * sim.speed * dt;
  for (const w of sim.walkers) {
    if (w.bubble) { w.bt -= dt * Math.max(1, sim.speed*0.6); if (w.bt <= 0) w.bubble = null; }
    if (w.hop > 0) w.hop = Math.max(0, w.hop - dt * Math.max(1, sim.speed*0.6));
    if (w.shiver > 0) w.shiver = Math.max(0, w.shiver - dt * Math.max(1, sim.speed*0.6));
    if (w.state === 'queue') {
      const i = sim.queue.indexOf(w), tx = STAND_X - i*30, dx = tx - w.x, dy = QY - w.y, d = Math.hypot(dx, dy);
      if (d > 1.5) { const k = Math.min(1, v*w.spd*1.2 / d); w.x += dx*k; w.y += dy*k; w.phase += dt*sim.speed*8; w.arrived = false; }
      else { w.x = tx; w.y = QY; w.arrived = true; }
      // The clock runs once they're standing in line. Whoever is at the counter is being served, so they stay.
      if (i > 0 && w.arrived && (w.waited += dm) >= CUSTOMERS[w.type].patience) leaveLine(w);
    } else {
      w.x += w.dir * v * w.spd; w.phase += dt*sim.speed*8;
      if (w.state === 'leave') w.y += (w.laneY - w.y) * Math.min(1, dt*sim.speed*1.5);
      if (w.state === 'walk' && !w.decided && Math.abs(w.x - STAND_X) < 170) decide(w);
    }
  }
  sim.walkers = sim.walkers.filter(w => w.state === 'queue' || (w.x > -60 && w.x < W+60));
  const f = sim.queue[0];
  if (f && f.arrived) {
    sim.serveT += dm;
    if (sim.serveT >= (S.upg.register ? BALANCE.registerServeMinutes : BALANCE.serveMinutes)) { sim.serveT = 0; serve(sim.queue.shift()); }
  } else sim.serveT = 0;
  if (sim.min >= DAY_MIN) endDay();
}

export function endDay(){
  for (const q of sim.queue) tally(q).left++; // still waiting at closing time
  const atClose = Object.fromEntries(Object.keys(SHOP).map(k => [k, haveOf(k)]));
  const st = sim.stats, change = clamp(sim.popDelta, -BALANCE.popDailyLimit, BALANCE.popDailyLimit);
  const before = S.pop; S.pop = clamp(Math.round(S.pop + change), 0, 100);
  const notes = [];
  const wPitcher = sim.pitcher * sim.pcpc;
  if (sim.pitcher > 0) notes.push(`${sim.pitcher} unsold cups of lemonade were poured out.`);
  let wIce = 0;
  if (S.ice > 0) {
    const kept = S.upg.cooler ? Math.floor(S.ice/2) : 0, melted = S.ice - kept;
    wIce = melted * S.cost.ice;
    notes.push(kept ? `Your cooler saved ${kept} ice cubes; ${melted} melted.` : `${melted} ice cubes melted overnight.`);
    S.ice = kept;
  }
  S.lemons.forEach(b => b.age++);
  const spoiled = sum(S.lemons.filter(b => b.age >= BALANCE.lemonLife), b => b.n);
  const wLemons = spoiled * S.cost.lemons;
  S.lemons = S.lemons.filter(b => b.age < BALANCE.lemonLife);
  if (spoiled) notes.push(`${spoiled} lemons went bad.`);
  const waste = wPitcher + wIce + wLemons;
  const net = st.revenue - sim.cogs - waste - sim.rent;
  const row = { day:S.day, weather:sim.weather, temp:sim.temp, loc:S.loc, seen:st.seen, sold:st.sold,
    sales:st.revenue, cogs:sim.cogs, wLemons, wIce, wPitcher, waste, rent:sim.rent, capex:S.capex,
    bought:S.spend, net, cash:S.cash, stock:stockValue(), pop:S.pop, price:S.recipe.price };
  S.ledger.push(row);
  const top = Object.entries(st.fb).filter(([k]) => k !== 'yum' && k !== 'ok').sort((a,b) => b[1]-a[1])[0];
  const tipKey = top && (top[0] === 'line' && S.upg.register ? 'lineOwned' : top[0]);
  const used = Object.fromEntries(Object.keys(SHOP).map(k => [k, { opened:sim.opening[k], used:sim.opening[k] - atClose[k], lost:atClose[k] - haveOf(k), left:haveOf(k) }]));
  setReport(Object.assign({}, row, { popChange:S.pop - before, fb:st.fb, byType:st.byType, used, notes, locName:loc().name,
    tip: top && top[1] >= 2 ? TIPS[tipKey] : null }));
  S.day++; S.spend = 0; S.capex = 0; S.forecast = genForecast();
  if (S.day > SEASON && !S.seasonDone) { S.seasonDone = true; report.season = true; }
  setSim(null);
  save();
  emit('end');
}
