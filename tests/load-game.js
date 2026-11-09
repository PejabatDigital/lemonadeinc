/* Sets up the real game modules with no browser. If config.js, state.js or sim.js touch the page, the tests crash. */
import { STAND_X, QY, mulberry, setRng } from '../js/config.js';
import { S, sim, newState, setState, setSim, setReport } from '../js/state.js';
import { openStand, stepSim } from '../js/sim.js';

export function stockUp(){ S.cash = 1000; S.cups = 500; S.sugar = 500; S.ice = 3000; S.lemons = [{ n:500, age:0 }]; }
export function customer(){ return { state:'walk', decided:false, x:STAND_X, y:QY, laneY:330, dir:1, spd:1, phase:0, bt:0, hop:0, shiver:0 }; }
export function playDay(){
  openStand();
  if (!sim) return null;
  sim.speed = 4;
  while (sim) stepSim(0.05);
  return S.ledger[S.ledger.length - 1];
}

// Starts a fresh game. run() returns a plain copy of the result, so later play can't change what a test saw.
export function loadGame(seed = 1) {
  setRng(mulberry(seed));
  setSim(null);
  setReport(null);
  setState(newState());
  return {
    run(fn, ...args) {
      const result = fn(...args);
      return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
    },
  };
}

export function assertNear(actual, expected, tolerance = 1e-9) {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`expected ${actual} to be within ${tolerance} of ${expected}`);
}
