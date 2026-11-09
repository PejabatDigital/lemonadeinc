/* Loads the game rules with no browser. If config.js, state.js or sim.js touch the page, the tests crash. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JS_DIR = path.join(__dirname, '..', 'js');

const HELPERS = `
  function stockUp(){ S.cash = 1000; S.cups = 500; S.sugar = 500; S.ice = 3000; S.lemons = [{ n:500, age:0 }]; }
  function customer(){ return { state:'walk', decided:false, x:STAND_X, y:QY, laneY:330, dir:1, spd:1, phase:0, bt:0, hop:0, shiver:0 }; }
  function playDay(){
    openStand();
    if (!sim) return null;
    sim.speed = 4;
    while (sim) stepSim(0.05);
    return S.ledger[S.ledger.length - 1];
  }
`;

function loadGame(seed = 1) {
  const context = vm.createContext({});
  for (const file of ['config', 'state', 'sim']) {
    const source = fs.readFileSync(path.join(JS_DIR, `${file}.js`), 'utf8');
    vm.runInContext(source, context, { filename: `${file}.js` });
  }
  vm.runInContext(`${HELPERS}; rng = mulberry(${seed}); S = newState();`, context);
  return {
    // Runs fn inside the game. It can't see variables from the test file, so pass them as args.
    run(fn, ...args) {
      const json = vm.runInContext(`JSON.stringify((${fn})(...${JSON.stringify(args)}))`, context);
      return json === undefined ? undefined : JSON.parse(json);
    },
  };
}

function assertNear(actual, expected, tolerance = 1e-9) {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`expected ${actual} to be within ${tolerance} of ${expected}`);
}

module.exports = { loadGame, assertNear };
