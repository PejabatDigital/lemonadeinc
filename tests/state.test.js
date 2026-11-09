/* Stock, costs, recipe limits, upgrades, saves and forecasts. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, assertNear } = require('./load-game');

test('buying stock averages the cost of everything you hold', () => {
  const r = loadGame().run(() => {
    S.cash = 100;
    buyPack('lemons', 0);
    const first = S.cost.lemons;
    buyPack('lemons', 1);
    return { first, second: S.cost.lemons, cash: S.cash, spend: S.spend, have: lemonCount() };
  });
  assertNear(r.first, 0.25);
  assertNear(r.second, 11.8 / 52);
  assert.equal(r.cash, 88.2);
  assertNear(r.spend, 11.8);
  assert.equal(r.have, 52);
});

test('a pack you cannot afford is refused and changes nothing', () => {
  const r = loadGame().run(() => {
    S.cash = 2.99;
    return { ok: buyPack('lemons', 0), cash: S.cash, spend: S.spend, lemons: S.lemons };
  });
  assert.deepEqual(r, { ok: false, cash: 2.99, spend: 0, lemons: [] });
});

test('lemons bought the same day share a batch, older ones stay apart', () => {
  const r = loadGame().run(() => {
    S.cash = 100;
    buyPack('lemons', 0);
    buyPack('lemons', 0);
    const sameDay = S.lemons.map(b => ({ ...b }));
    S.lemons[0].age = 1;
    buyPack('lemons', 0);
    return { sameDay, nextDay: S.lemons };
  });
  assert.deepEqual(r.sameDay, [{ n: 24, age: 0 }]);
  assert.deepEqual(r.nextDay, [{ n: 24, age: 1 }, { n: 12, age: 0 }]);
});

test('the oldest lemons get used first', () => {
  const r = loadGame().run(() => {
    S.lemons = [{ n: 3, age: 2 }, { n: 5, age: 0 }];
    useLemons(4);
    return S.lemons;
  });
  assert.deepEqual(r, [{ n: 4, age: 0 }]);
});

test('cups ready is limited by whichever supply runs out first', () => {
  const r = loadGame().run(() => {
    S.recipe.l = 4; S.recipe.s = 4; S.lemons = [{ n: 8, age: 0 }]; S.sugar = 20; S.cups = 100;
    const byLemons = cupsReady();
    S.sugar = 7;
    const bySugar = cupsReady();
    S.sugar = 20; S.cups = 10;
    const byCups = cupsReady();
    S.cups = 100; S.upg.juicer = true;
    const withJuicer = cupsReady();
    S.upg.juicer = false; S.recipe.l = 0; S.recipe.s = 0;
    const noIngredients = cupsReady();
    return { byLemons, bySugar, byCups, withJuicer, noIngredients };
  });
  assert.deepEqual(r, { byLemons: 24, bySugar: 12, byCups: 10, withJuicer: 30, noIngredients: 100 });
});

test('cost per cup adds up the recipe at what you paid', () => {
  const r = loadGame().run(() => {
    S.lemons = [{ n: 10, age: 0 }]; S.sugar = 10; S.ice = 10; S.cups = 10;
    S.cost = { lemons: 0.24, sugar: 0.12, ice: 0.02, cups: 0.03 };
    S.recipe.l = 4; S.recipe.s = 4; S.recipe.i = 3;
    return cupCost();
  });
  assertNear(r.lemons, 0.08);
  assertNear(r.sugar, 0.04);
  assertNear(r.ice, 0.06);
  assertNear(r.total, 0.21);
});

test('cost per cup falls back to the shop price when you hold none', () => {
  const r = loadGame().run(() => { S.cost.lemons = 9; return { unit: unitCost('lemons'), ref: refCost('lemons') }; });
  assert.equal(r.unit, r.ref);
});

test('recipe steps stay within their limits and prices stay in clean 5c steps', () => {
  const r = loadGame().run(() => {
    S.recipe.price = 0.1;
    changeRecipe('price', 1);
    const stepped = S.recipe.price;
    S.recipe.price = 0.05; changeRecipe('price', -1);
    const minPrice = S.recipe.price;
    S.recipe.price = 5; changeRecipe('price', 1);
    const maxPrice = S.recipe.price;
    S.recipe.l = 10; changeRecipe('l', 1);
    S.recipe.s = 0; changeRecipe('s', -1);
    S.recipe.i = 8; changeRecipe('i', 1);
    return { stepped, minPrice, maxPrice, l: S.recipe.l, s: S.recipe.s, i: S.recipe.i };
  });
  assert.deepEqual(r, { stepped: 0.15, minPrice: 0.05, maxPrice: 5, l: 10, s: 0, i: 8 });
});

test('an upgrade is charged once and logged', () => {
  const r = loadGame().run(() => {
    S.cash = 100; S.day = 5;
    const first = buyUpgrade('cooler');
    const again = buyUpgrade('cooler');
    return { first, again, cash: S.cash, capex: S.capex, owned: S.upg.cooler, log: S.upgLog.cooler };
  });
  assert.deepEqual(r, { first: true, again: false, cash: 60, capex: 40, owned: true, log: { cost: 40, day: 5 } });
});

test('an upgrade you cannot afford is refused', () => {
  const r = loadGame().run(() => { S.cash = 39.99; return { ok: buyUpgrade('cooler'), cash: S.cash, owned: !!S.upg.cooler }; });
  assert.deepEqual(r, { ok: false, cash: 39.99, owned: false });
});

test('you are only stuck with no cups and no money for the cheapest pack', () => {
  const r = loadGame().run(() => {
    S.cups = 0; S.cash = 1.49; const broke = isStuck();
    S.cash = 1.5; const canBuy = isStuck();
    S.cash = 0; S.cups = 1; const hasCup = isStuck();
    return { broke, canBuy, hasCup };
  });
  assert.deepEqual(r, { broke: true, canBuy: false, hasCup: false });
});

test('cash stays in whole cents', () => {
  const r = loadGame().run(() => { S.cash = 0.1; addCash(0.2); return S.cash; });
  assert.equal(r, 0.3);
});

test('ideal ice rises with the temperature', () => {
  const r = loadGame().run(() => [18, 19, 23, 24, 28, 29, 32, 33].map(idealIce));
  assert.deepEqual(r, [1, 2, 2, 3, 3, 4, 4, 5]);
});

test('forecasts follow the weather odds', () => {
  const r = loadGame().run(() => {
    const seen = {}, N = 100000;
    for (let i = 0; i < N; i++) { const t = genForecast().type; seen[t] = (seen[t] || 0) + 1; }
    return WORDER.map(k => [seen[k] / N, WEATHER[k].weight]);
  });
  for (const [share, weight] of r) assertNear(share, weight, 0.01);
});

test('the real weather is at most one step from the forecast and in range', () => {
  const r = loadGame().run(() => {
    let tooFar = 0, outOfRange = 0, shifted = 0;
    for (let i = 0; i < 20000; i++) {
      const f = genForecast(), a = f.actual, [lo, hi] = WEATHER[a.type].t;
      const steps = Math.abs(WORDER.indexOf(a.type) - WORDER.indexOf(f.type));
      if (steps > 1) tooFar++;
      if (steps) shifted++;
      if (a.temp < lo - 2 || a.temp > hi + 2) outOfRange++;
    }
    return { tooFar, outOfRange, shifted };
  });
  assert.equal(r.tooFar, 0);
  assert.equal(r.outOfRange, 0);
  assert.ok(r.shifted > 3000 && r.shifted < 6000, `shifted ${r.shifted} of 20000`);
});

test('old saves are filled in when loaded', () => {
  const r = loadGame().run(() => {
    const old = JSON.parse(JSON.stringify(newState()));
    delete old.forecast.actual; delete old.cost; delete old.ledger; delete old.upgLog; delete old.capex;
    old.upg.sign = true;
    const d = normalize(old);
    return { hasActual: !!d.forecast.actual, cost: d.cost.lemons, ref: refCost('lemons'), ledger: d.ledger, capex: d.capex, sign: d.upgLog.sign };
  });
  assert.equal(r.hasActual, true);
  assert.equal(r.cost, r.ref);
  assert.deepEqual(r.ledger, []);
  assert.equal(r.capex, 0);
  assert.deepEqual(r.sign, { cost: 35, day: 1 });
});

test('season totals add up the ledger', () => {
  const r = loadGame().run(() => {
    const row = (sold, sales, cogs, net) => ({ sold, sales, cogs, net, waste: 1, wLemons: 0.5, wIce: 0.3, wPitcher: 0.2, rent: 2 });
    const empty = seasonTotals();
    S.ledger = [row(10, 5, 2, 1), row(30, 15, 6, 6)];
    return { empty: empty.avgMargin, totals: seasonTotals() };
  });
  assert.equal(r.empty, 0);
  assert.equal(r.totals.sold, 40);
  assert.equal(r.totals.net, 7);
  assert.equal(r.totals.waste, 2);
  assert.equal(r.totals.rent, 4);
  assertNear(r.totals.avgMargin, 12 / 40);
});
