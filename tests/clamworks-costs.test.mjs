// Run with: node --test tests/clamworks-costs.test.mjs
// Fixture: Morta1/IdleonToolbox '__test__/parsers/live-verified-clam-work.test.js'
// 2026-10-12 running-game Thingies("Clam_Cost", i, 0) values.
// This is a public test fixture, not an uploaded user account.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const browser = {window:{}, document:{readyState:'loading',addEventListener(){}}};
const code=readFileSync(new URL('../planner.js', import.meta.url),'utf8');
runInNewContext(code,browser,{filename:'planner.js'});
const {nextCost,costModel,promotion}=browser.window.ClamworksPlanner;
const levels=[38,11,13,25,27,8,0,0,0];
const scurge=Array(9).fill(0);
const account={worker:5,pearlLevels:levels,scurgeLevels:scurge};
const expected=[
  2367.0020094966344,
  46064282.66105488,
  4607.269540135561,
  2653272.1583636967,
  641781.0079233249,
  9444623.736566508,
  9212853.773584904,
  230321344.33962262,
  5758033608.490565
];
test('all nine calculated prices match live-game tested Clam_Cost references',()=>{
  for(let i=0;i<9;i++){
    const actual=nextCost(account,levels,scurge,costModel(),i);
    assert.ok(Math.abs(actual/expected[i]-1)<1e-11,
      'slot '+i+': calculated '+actual+', live game '+expected[i]);
  }
});
test('the game-data growth rates are available without a price import',()=>{
  assert.deepEqual(Array.from(costModel()),[1.2,5,1.5,1.4,1.15,1.5,1.35,1.25,1.22]);
});
test('promoting at Worker Class 9 costs 100T and has 1/22 chance',()=>{
  const result=promotion(9);
  assert.equal(result.cost,1e14);
  assert.equal(result.chance,1/22);
});
test('scurge pearl-cost discount lowers otherwise identical prices',()=>{
  const base=nextCost(account,levels,scurge,costModel(),0);
  const discounted=scurge.slice();discounted[3]=1;
  const reduced=nextCost(account,levels,discounted,costModel(),0);
  assert.ok(reduced<base);
  assert.ok(Math.abs(reduced/base-(1/1.25))<1e-12);
});
