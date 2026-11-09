/* The trading day: opening, customers, serving, taste, end-of-day books. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, assertNear } = require('./load-game');

test('opening charges rent and starts the day', () => {
  const r = loadGame().run(() => {
    stockUp(); S.cash = 50; S.loc = 'park';
    openStand();
    return { cash: S.cash, rent: sim.rent };
  });
  assert.deepEqual(r, { cash: 38, rent: 12 });
});

test('the stand will not open without the rent', () => {
  const r = loadGame().run(() => { stockUp(); S.cash = 11.99; S.loc = 'park'; openStand(); return { open: !!sim, cash: S.cash }; });
  assert.deepEqual(r, { open: false, cash: 11.99 });
});

test('a stuck player cannot burn days', () => {
  const r = loadGame().run(() => {
    S.cash = 0.5; S.cups = 0; S.loc = 'lane';
    openStand();
    return { open: !!sim, day: S.day };
  });
  assert.deepEqual(r, { open: false, day: 1 });
});

test('the day uses the saved weather plus the location bonus', () => {
  const r = loadGame().run(() => {
    stockUp(); S.loc = 'beach';
    S.forecast.actual = { type: 'storm', temp: 18 };
    openStand();
    return { weather: sim.weather, temp: sim.temp };
  });
  assert.deepEqual(r, { weather: 'storm', temp: 21 });
});

test('replaying a day from the same save gets the same weather', () => {
  const r = loadGame(3).run(() => {
    let changed = 0;
    for (let i = 0; i < 500; i++) {
      S = newState(); S.cups = 1;
      const saved = JSON.stringify(S);
      openStand();
      const first = sim.weather + sim.temp;
      sim = null; S = normalize(JSON.parse(saved));
      openStand();
      if (sim.weather + sim.temp !== first) changed++;
      sim = null;
    }
    return changed;
  });
  assert.equal(r, 0);
});

test('taste feedback names what is wrong', () => {
  const cases = [
    { l: 4, s: 4, temp: 28, ice: 3, want: 'yum' },
    { l: 8, s: 2, temp: 28, ice: 3, want: 'sour' },
    { l: 2, s: 8, temp: 28, ice: 3, want: 'sweet' },
    { l: 1, s: 1, temp: 28, ice: 3, want: 'watery' },
    { l: 8, s: 8, temp: 28, ice: 3, want: 'strong' },
    { l: 4, s: 4, temp: 35, ice: 1, want: 'ice' },
    { l: 4, s: 4, temp: 15, ice: 8, want: 'muchice' },
    { l: 4, s: 4, temp: 30, ice: 0, want: 'warm' },
    { l: 4, s: 4, temp: 28, ice: 3, price: 3, want: 'pricey' },
  ];
  for (const c of cases) {
    const got = loadGame().run(k => {
      rng = () => 0.5;
      S.recipe.l = k.l; S.recipe.s = k.s; S.recipe.price = k.price || 0.4;
      sim = { temp: k.temp, maxPrice: 2 };
      return taste(k.ice).key;
    }, c);
    assert.equal(got, c.want, JSON.stringify(c));
  }
});

test('a small flaw on a bad roll is just pretty good', () => {
  const r = loadGame().run(() => {
    rng = () => 0;
    S.recipe.l = 4; S.recipe.s = 4; S.recipe.price = 1.8;
    sim = { temp: 28, maxPrice: 2 };
    return taste(2).key;
  });
  assert.equal(r, 'ok');
});

test('foot traffic and price tolerance follow location, weather, popularity and the sign', () => {
  const day = (type, pop, sign) => loadGame().run((t, p, s) => {
    stockUp(); S.loc = 'lane'; S.pop = p; S.upg.sign = s;
    S.forecast.actual = { type: t, temp: 22 };
    openStand();
    return { traffic: sim.N, maxPrice: sim.maxPrice };
  }, type, pop, sign);
  const sunny = day('sunny', 30, false);
  assertNear(sunny.traffic, 70 * 1.2);
  assertNear(sunny.maxPrice, 0.75 * (0.55 + 0.55 * 0.5) * (0.85 + 30 / 300));
  assertNear(day('rain', 30, false).traffic, 70 * 0.45 * 1.2);
  assertNear(day('sunny', 30, true).traffic, 70 * 1.2 * 1.15);
  const unknown = day('sunny', 0, false);
  assertNear(unknown.traffic, 70);
  assertNear(unknown.maxPrice, 0.75 * (0.55 + 0.55 * 0.5) * 0.85);
});

test('interest depends on the weather, and the parasol only helps when hot or wet', () => {
  const wouldQueue = options => loadGame().run(k => {
    stockUp(); S.recipe.price = 0.1; S.pop = 30; S.upg.parasol = k.parasol;
    openStand();
    sim.tf = 0.5; sim.weather = k.weather; sim.temp = k.temp;
    rng = () => k.roll;
    const w = customer();
    decide(w);
    return w.state === 'queue';
  }, options);
  assert.equal(wouldQueue({ weather: 'sunny', temp: 25, roll: 0.34, parasol: false }), true);
  assert.equal(wouldQueue({ weather: 'sunny', temp: 25, roll: 0.36, parasol: false }), false);
  assert.equal(wouldQueue({ weather: 'rain', temp: 18, roll: 0.3, parasol: false }), false);
  assert.equal(wouldQueue({ weather: 'rain', temp: 18, roll: 0.3, parasol: true }), true);
  assert.equal(wouldQueue({ weather: 'sunny', temp: 25, roll: 0.36, parasol: true }), false);
  assert.equal(wouldQueue({ weather: 'sunny', temp: 30, roll: 0.36, parasol: true }), true);
});

test('good lemonade raises popularity and bad lemonade lowers it', () => {
  const afterSale = (l, s) => loadGame().run((lemons, sugar) => {
    stockUp(); S.recipe.l = lemons; S.recipe.s = sugar; S.recipe.i = 3; S.recipe.price = 0.1;
    openStand();
    sim.temp = 28; sim.maxPrice = 2;
    rng = () => 0.5;
    serve(customer());
    return sim.popDelta;
  }, l, s);
  assertNear(afterSale(4, 4), (1 - 0.55) * 0.6);
  assertNear(afterSale(8, 2), (0.22 - 0.55) * 0.6);
});

function decideWith(setup) {
  return loadGame().run(body => {
    stockUp();
    S.recipe.price = 0.1;
    openStand();
    rng = () => 0;
    new Function('sim', 'S', body)(sim, S);
    const w = customer();
    decide(w);
    return { state: w.state, queued: sim.queue.includes(w), seen: sim.stats.seen, fb: sim.stats.fb, pop: sim.popDelta };
  }, setup);
}

test('an interested customer at a fair price joins the line', () => {
  assert.deepEqual(decideWith(''), { state: 'queue', queued: true, seen: 1, fb: {}, pop: 0 });
});

test('an uninterested customer walks past and says nothing', () => {
  const r = loadGame().run(() => {
    stockUp(); openStand();
    rng = () => 0.99;
    const w = customer();
    decide(w);
    return { state: w.state, seen: sim.stats.seen, fb: sim.stats.fb };
  });
  assert.deepEqual(r, { state: 'walk', seen: 1, fb: {} });
});

test('sold out customers are turned away and it hurts popularity', () => {
  const r = decideWith("sim.soldOut = 'cups';");
  assert.equal(r.queued, false);
  assert.deepEqual(r.fb, { soldout: 1 });
  assertNear(r.pop, -0.15);
});

test('a price over the limit drives customers off', () => {
  const r = decideWith('S.recipe.price = sim.maxPrice + 0.05;');
  assert.equal(r.queued, false);
  assert.deepEqual(r.fb, { pricey: 1 });
  assertNear(r.pop, -0.04);
});

test('a line of six turns the next customer away, five does not', () => {
  const full = decideWith('sim.queue = [1, 2, 3, 4, 5, 6];');
  assert.equal(full.queued, false);
  assert.deepEqual(full.fb, { line: 1 });
  assert.equal(decideWith('sim.queue = [1, 2, 3, 4, 5];').queued, true);
});

test('serving takes payment and uses up supplies', () => {
  const r = loadGame().run(() => {
    stockUp(); S.recipe.l = 4; S.recipe.s = 4; S.recipe.i = 3; S.recipe.price = 0.5;
    S.cost = { lemons: 0.24, sugar: 0.12, ice: 0.02, cups: 0.03 };
    openStand();
    const cash = S.cash, w = customer();
    serve(w);
    const after = { paid: S.cash - cash, cups: S.cups, sugar: S.sugar, ice: S.ice, lemons: lemonCount(), pitcher: sim.pitcher, sold: sim.stats.sold, cogs: sim.cogs, left: w.state, cup: w.cup };
    serve(customer());
    return { ...after, lemonsAfterSecond: lemonCount() };
  });
  assertNear(r.paid, 0.5);
  assert.equal(r.cups, 499);
  assert.equal(r.sugar, 496);
  assert.equal(r.ice, 2997);
  assert.equal(r.lemons, 496);
  assert.equal(r.pitcher, 11);
  assert.equal(r.sold, 1);
  assertNear(r.cogs, (4 * 0.24 + 4 * 0.12) / 12 + 3 * 0.02 + 0.03);
  assert.equal(r.left, 'leave');
  assert.equal(r.cup, true);
  assert.equal(r.lemonsAfterSecond, 496, 'the second cup comes from the same pitcher');
});

test('with no ice the lemonade is served warm', () => {
  const r = loadGame().run(() => {
    stockUp(); S.ice = 0; openStand();
    sim.temp = 30;
    serve(customer());
    return { sold: sim.stats.sold, fb: sim.stats.fb, ice: S.ice };
  });
  assert.equal(r.sold, 1);
  assert.equal(r.ice, 0);
  assert.equal(r.fb.warm, 1);
});

for (const [name, setup, reason] of [
  ['cups', 'S.cups = 0;', 'cups'],
  ['lemons', 'S.lemons = [];', 'lemons'],
  ['sugar', 'S.sugar = 0;', 'sugar'],
]) {
  test(`running out of ${name} sends the whole line home`, () => {
    const r = loadGame().run(body => {
      stockUp(); openStand();
      new Function('S', body)(S);
      const cash = S.cash, first = customer(), second = customer();
      sim.queue.push(second);
      serve(first);
      return { paid: S.cash - cash, soldOut: sim.soldOut, line: sim.queue.length, first: first.state, second: second.state, fb: sim.stats.fb };
    }, setup);
    assert.deepEqual(r, { paid: 0, soldOut: reason, line: 0, first: 'leave', second: 'leave', fb: { soldout: 2 } });
  });
}

for (const [label, register, cupsNeeded] of [['8 game minutes', false, 8], ['4 with a register', true, 4]]) {
  test(`serving a customer takes ${label}`, () => {
    const soldBy = loadGame().run(owned => {
      stockUp(); S.upg.register = owned; openStand();
      sim.N = 0;
      const w = customer();
      w.state = 'queue';
      sim.walkers.push(w); sim.queue.push(w);
      const out = [];
      for (let m = 0; m < 8; m++) { stepSim(1 / 9); out.push(sim.stats.sold); }
      return out;
    }, register);
    assert.equal(soldBy[cupsNeeded - 2], 0, 'not served a minute early');
    assert.equal(soldBy[cupsNeeded - 1], 1, 'served on time');
  });
}

test('the day ends at closing time', () => {
  const r = loadGame().run(() => {
    stockUp(); openStand();
    sim.N = 0;
    stepSim((DAY_MIN - 1) / 9);
    const stillOpen = !!sim;
    stepSim(1 / 9);
    return { stillOpen, closed: !sim, day: S.day };
  });
  assert.deepEqual(r, { stillOpen: true, closed: true, day: 2 });
});

test('without a cooler all the ice melts and counts as waste', () => {
  const r = loadGame().run(() => {
    stockUp(); S.ice = 11; S.cost.ice = 0.02; openStand(); endDay();
    return { ice: S.ice, wIce: S.ledger[0].wIce };
  });
  assert.equal(r.ice, 0);
  assertNear(r.wIce, 0.22);
});

test('a cooler keeps half the ice, rounded down', () => {
  const r = loadGame().run(() => {
    stockUp(); S.ice = 11; S.cost.ice = 0.02; S.upg.cooler = true; openStand(); endDay();
    return { ice: S.ice, wIce: S.ledger[0].wIce };
  });
  assert.equal(r.ice, 5);
  assertNear(r.wIce, 0.12);
});

test('lemons go bad on their last day and younger ones age', () => {
  const r = loadGame().run(() => {
    stockUp(); S.cost.lemons = 0.25;
    S.lemons = [{ n: 7, age: BALANCE.lemonLife - 1 }, { n: 5, age: BALANCE.lemonLife - 2 }];
    openStand(); endDay();
    return { lemons: S.lemons, wLemons: S.ledger[0].wLemons };
  });
  assert.deepEqual(r.lemons, [{ n: 5, age: 3 }]);
  assertNear(r.wLemons, 1.75);
});

test('net profit is sales minus cost of cups, waste and rent', () => {
  const r = loadGame().run(() => {
    stockUp(); S.ice = 0; S.loc = 'park'; openStand();
    sim.stats.revenue = 40; sim.cogs = 10; sim.pitcher = 5; sim.pcpc = 0.2;
    endDay();
    return S.ledger[0];
  });
  assertNear(r.wPitcher, 1);
  assertNear(r.waste, 1);
  assertNear(r.net, 40 - 10 - 1 - 12);
});

test('the end of the day moves on and resets the daily tallies', () => {
  const r = loadGame().run(() => {
    stockUp(); S.spend = 9; S.capex = 4;
    const forecast = JSON.stringify(S.forecast);
    openStand(); endDay();
    return { day: S.day, spend: S.spend, capex: S.capex, open: !!sim, newForecast: JSON.stringify(S.forecast) !== forecast, bought: S.ledger[0].bought, invested: S.ledger[0].capex };
  });
  assert.deepEqual(r, { day: 2, spend: 0, capex: 0, open: false, newForecast: true, bought: 9, invested: 4 });
});

test('popularity moves at most 12 points a day and stays between 0 and 100', () => {
  const change = (start, delta) => loadGame().run((s, d) => {
    stockUp(); S.pop = s; openStand(); sim.popDelta = d; endDay();
    return { pop: S.pop, change: report.popChange };
  }, start, delta);
  assert.deepEqual(change(50, 100), { pop: 62, change: 12 });
  assert.deepEqual(change(50, -100), { pop: 38, change: -12 });
  assert.deepEqual(change(95, 100), { pop: 100, change: 5 });
  assert.deepEqual(change(3, -100), { pop: 0, change: -3 });
});

test('the season is flagged once, at the end of the last day', () => {
  const r = loadGame().run(() => {
    stockUp(); S.day = SEASON - 1; openStand(); endDay();
    const before = !!report.season;
    openStand(); endDay();
    const last = !!report.season, done = S.seasonDone;
    openStand(); endDay();
    return { before, last, done, after: !!report.season };
  });
  assert.deepEqual(r, { before: false, last: true, done: true, after: false });
});

test('the tip addresses the most common complaint, if it came up twice', () => {
  const tip = (fb, owned) => loadGame().run((f, o) => {
    stockUp(); S.upg.register = o; openStand(); sim.stats.fb = f; endDay();
    return report.tip;
  }, fb, owned);
  const texts = loadGame().run(() => TIPS);
  assert.equal(tip({ sour: 2, sweet: 1, yum: 50 }, false), texts.sour);
  assert.equal(tip({ sour: 1, yum: 50 }, false), null);
  assert.equal(tip({ line: 3 }, false), texts.line);
  assert.equal(tip({ line: 3 }, true), texts.lineOwned);
});

test('the sim announces opening, each sale and the end of the day', () => {
  const r = loadGame().run(() => {
    const seen = { open: 0, sale: 0, end: 0, money: [] };
    onSim('open', () => seen.open++);
    onSim('sale', p => { seen.sale++; seen.money.push(p); });
    onSim('end', () => seen.end++);
    stockUp(); S.recipe.price = 0.3;
    const row = playDay();
    return { ...seen, sold: row.sold };
  });
  assert.equal(r.open, 1);
  assert.equal(r.end, 1);
  assert.ok(r.sold > 0);
  assert.equal(r.sale, r.sold);
  assert.ok(r.money.every(p => p === 0.3));
});

test('nothing is announced when the stand refuses to open', () => {
  const r = loadGame().run(() => {
    let opened = 0;
    onSim('open', () => opened++);
    S.cash = 0; S.loc = 'beach';
    openStand();
    return opened;
  });
  assert.equal(r, 0);
});

test('the same seed plays out the same season', () => {
  const season = seed => loadGame(seed).run(() => {
    stockUp();
    for (let d = 0; d < 10; d++) playDay();
    return S.ledger;
  });
  assert.deepEqual(season(7), season(7));
  assert.notDeepEqual(season(7), season(8));
});

test('the books balance over many randomly played seasons', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const r = loadGame(seed).run(() => {
      let worstCash = 0, worstStock = 0, days = 0, sold = 0;
      for (let season = 0; season < 5; season++) {
        S = newState(); S.cash = 300;
        for (let d = 0; d < 30; d++) {
          S.recipe.l = rint(1, 8); S.recipe.s = rint(1, 8); S.recipe.i = rint(0, 5); S.recipe.price = rint(1, 16) * 0.05;
          for (const k of Object.keys(SHOP)) for (let i = 0; i < 3; i++) if (rng() < 0.5) buyPack(k, rint(0, 2));
          if (rng() < 0.05) buyUpgrade(pickUpgrade());
          const cashBefore = S.cash + S.spend + S.capex, stockBefore = stockValue() - S.spend;
          const row = playDay();
          if (!row) continue;
          worstCash = Math.max(worstCash, Math.abs(cashBefore + row.sales - row.rent - row.bought - row.capex - S.cash));
          worstStock = Math.max(worstStock, Math.abs(stockBefore + row.bought - row.cogs - row.waste - stockValue()));
          days++; sold += row.sold;
        }
      }
      function pickUpgrade(){ return UPG[rint(0, UPG.length - 1)].id; }
      return { worstCash, worstStock, days, sold };
    });
    assert.ok(r.days > 100, `played ${r.days} days`);
    assert.ok(r.sold > 0, 'some cups were sold');
    assertNear(r.worstCash, 0, 1e-6);
    assertNear(r.worstStock, 0, 1e-6);
  }
});
