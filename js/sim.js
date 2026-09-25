/* Lemonade Inc. | sim.js
   The trading day: customers deciding, queueing, taste scoring, and the end-of-day books. */
'use strict';

// ---------- day simulation ----------
function openStand(){
  const L = loc();
  if (S.cash < L.rent) return;
  const f = S.forecast;
  let type = f.type;
  if (Math.random() > 0.75) { const i = WORDER.indexOf(type); type = WORDER[clamp(i + (Math.random() < .5 ? -1 : 1), 0, WORDER.length-1)]; }
  const [a,b] = WEATHER[type].t;
  const temp = clamp(f.temp + rint(-2,2), a-2, b+2) + L.bias;
  S.cash -= L.rent;
  const tf = clamp((temp - 10) / 24, 0.15, 1.1);
  sim = {
    min:0, speed:1, walkers:[], queue:[], spawnAcc:0, serveT:0, pitcher:0, weather:type, temp, tf,
    N: L.traffic * WEATHER[type].traffic * (1 + S.pop/150) * (S.upg.sign ? 1.15 : 1),
    maxPrice: L.tol * (0.55 + 0.55*tf) * (0.85 + S.pop/300),
    rent:L.rent, soldOut:null, popDelta:0, cogs:0, pcpc:0,
    stats:{ seen:0, sold:0, revenue:0, fb:{} },
  };
  $('#hud').classList.add('on');
  setSpeed(1);
  renderAll();
}
function fb(k){ sim.stats.fb[k] = (sim.stats.fb[k] || 0) + 1; }
function say(w, k, txt){
  if ((k === 'line' || k === 'pricey' || k === 'ok') && sim && sim.walkers.filter(x => x.bubble).length >= 4) return;
  w.bubble = txt || FB[k]; w.bt = 2.6;
}

function spawnWalker(){
  const dir = Math.random() < .5 ? 1 : -1, laneY = 318 + Math.random()*26;
  sim.walkers.push({ x: dir > 0 ? -30 : W+30, y:laneY, laneY, dir, spd:0.8 + Math.random()*0.5,
    body:pick(BODY), skin:pick(SKIN), hair:pick(HAIR), h:0.9 + Math.random()*0.22,
    bw:0.85 + Math.random()*0.35, pants:pick(PANTS), acc:pick(ACC), hatC:pick(['#E8574A','#2F3E5A','#F0C23E','#FFFFFF','#2F8A3E']),
    long:Math.random() < .4, umb:Math.random() < .75, umbC:pick(UMB), hop:0, shiver:0,
    state:'walk', decided:false, arrived:false, bubble:null, bt:0, phase:Math.random()*6, cup:false });
}
function decide(w){
  w.decided = true; sim.stats.seen++;
  const umbrella = S.upg.parasol && (sim.temp >= 30 || sim.weather === 'rain' || sim.weather === 'storm') ? 1.2 : 1;
  const interest = clamp(sim.tf * (0.55 + S.pop/200) * WEATHER[sim.weather].want * umbrella, 0.05, 0.95);
  if (Math.random() > interest) return;
  if (sim.soldOut) { say(w,'soldout'); fb('soldout'); sim.popDelta -= 0.15; return; }
  const r = S.recipe.price / sim.maxPrice;
  const priceOk = r <= 0.5 ? 1 : clamp(1 - (r - 0.5)*1.6, 0, 1);
  if (r > 1 || Math.random() > priceOk) { say(w,'pricey'); fb('pricey'); sim.popDelta -= 0.04; return; }
  if (sim.queue.length >= 6) { say(w,'line'); fb('line'); sim.popDelta -= 0.08; return; }
  w.state = 'queue'; sim.queue.push(w);
}
function makePitcher(){
  const { l, s } = S.recipe;
  if (lemonCount() < l) { sim.soldOut = 'lemons'; return false; }
  if (S.sugar < s) { sim.soldOut = 'sugar'; return false; }
  sim.pcpc = (l*S.cost.lemons + s*S.cost.sugar) / yieldCups();
  useLemons(l); S.sugar -= s; sim.pitcher = yieldCups(); return true;
}
function taste(iceUsed){
  const { l, s } = S.recipe, sour = l - s, str = l + s, ideal = idealIce(sim.temp);
  const terms = [
    ['sour', sour > 0 ? sour*0.11 : 0], ['sweet', sour < 0 ? -sour*0.11 : 0],
    ['watery', str < 8 ? (8-str)*0.07 : 0], ['strong', str > 8 ? (str-8)*0.06 : 0],
  ];
  if (iceUsed === 0) terms.push(['warm', 0.22 + ideal*0.04]);
  else { const d = iceUsed - ideal; terms.push(['ice', d < 0 ? -d*0.08 : 0], ['muchice', d > 0 ? d*0.06 : 0]); }
  const r = S.recipe.price / sim.maxPrice; terms.push(['pricey', r > 0.75 ? (r-0.75)*0.6 : 0]);
  let pen = 0, worst = terms[0];
  for (const t of terms) { pen += t[1]; if (t[1] > worst[1]) worst = t; }
  const score = clamp(1 - pen + (Math.random() - 0.5)*0.12, 0, 1);
  const key = score >= 0.78 ? 'yum' : (worst[1] >= 0.1 ? worst[0] : 'ok');
  return { score, key };
}
function sellOutQueue(){
  for (const q of sim.queue) { q.state = 'leave'; say(q,'soldout'); fb('soldout'); sim.popDelta -= 0.15; }
  sim.queue = [];
}
function serve(w){
  if (S.cups <= 0) sim.soldOut = sim.soldOut || 'cups';
  if (!sim.soldOut && sim.pitcher <= 0) makePitcher();
  if (sim.soldOut) { sim.queue.unshift(w); sellOutQueue(); return; }
  S.cups--; sim.pitcher--;
  const iceUsed = Math.min(S.recipe.i, S.ice); S.ice -= iceUsed;
  const t = taste(iceUsed);
  sim.cogs += sim.pcpc + iceUsed*S.cost.ice + S.cost.cups;
  S.cash += S.recipe.price; sim.stats.revenue += S.recipe.price; sim.stats.sold++;
  sim.popDelta += (t.score - 0.55) * 0.6;
  fb(t.key); say(w, t.key); saleFx(S.recipe.price);
  if (t.key === 'yum') w.hop = 0.6;
  if (t.key === 'muchice') w.shiver = 1.4;
  w.state = 'leave'; w.cup = true;
}
function stepSim(dt){
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
    if (sim.serveT >= (S.upg.register ? 4 : 8)) { sim.serveT = 0; serve(sim.queue.shift()); }
  } else sim.serveT = 0;
  if (sim.min >= DAY_MIN) endDay();
}

function endDay(){
  const st = sim.stats, change = clamp(sim.popDelta, -12, 12);
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
  const spoiled = sum(S.lemons.filter(b => b.age >= 4), b => b.n);
  const wLemons = spoiled * S.cost.lemons;
  S.lemons = S.lemons.filter(b => b.age < 4);
  if (spoiled) notes.push(`${spoiled} lemons went bad.`);
  const waste = wPitcher + wIce + wLemons;
  const net = st.revenue - sim.cogs - waste - sim.rent;
  S.total += net;
  if (!S.best || net > S.best.profit) S.best = { day:S.day, profit:net };
  const row = { day:S.day, weather:sim.weather, temp:sim.temp, loc:S.loc, seen:st.seen, sold:st.sold,
    sales:st.revenue, cogs:sim.cogs, wLemons, wIce, wPitcher, waste, rent:sim.rent, capex:S.capex || 0,
    bought:S.spend, net, cash:S.cash, stock:stockValue(), pop:S.pop, price:S.recipe.price };
  S.ledger.push(row);
  const top = Object.entries(st.fb).filter(([k]) => k !== 'yum' && k !== 'ok').sort((a,b) => b[1]-a[1])[0];
  report = Object.assign({}, row, { popChange:S.pop - before, fb:st.fb, notes, locName:loc().name,
    tip: top && top[1] >= 2 ? TIPS[top[0]] : null });
  S.day++; S.spend = 0; S.capex = 0; S.forecast = genForecast();
  if (S.day > SEASON && !S.seasonDone) { S.seasonDone = true; report.season = true; }
  sim = null;
  $('#hud').classList.remove('on');
  save(); renderAll(); showReport();
}

function setSpeed(n){
  if (!sim) return; sim.speed = n;
  document.querySelectorAll('[data-act^="speed:"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.act === 'speed:' + n)));
}
