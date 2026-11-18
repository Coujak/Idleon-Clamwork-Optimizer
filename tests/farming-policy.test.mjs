// Run with: node --test tests/farming-policy.test.mjs
// Basic transparent check of the simplified AFK "keep Pure; reroll misses" scenario.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const context={window:{},document:{readyState:'loading',addEventListener(){}}};
runInNewContext(readFileSync(new URL('../planner.js',import.meta.url),'utf8'),context);
const {afkRerollEstimate,pearlProxy}=context.window.ClamworksPlanner;
const setup={regular:10,pureChance:0.25,pureExtra:100,offerChance:0.5,hours:24};
test('keep-Pure rerolling replaces the reward and increases Pure chance',()=>{
 const a=afkRerollEstimate(setup);
 assert.equal(a.base,35);
 assert.equal(a.withRerolls,50);
 assert.equal(a.probability,0.4);
 assert.equal(a.gain,15);
 assert.equal(a.extraPerHour,15/24);
});
test('auto-claim prevents the modeled reroll benefit',()=>{
 const a=afkRerollEstimate({...setup,autoClaim:true});
 assert.equal(a.gain,0);
 assert.equal(a.expectedRerolls,0);
 assert.equal(a.probability,setup.pureChance);
});
test('no reroll offer leaves the original payout',()=>{
 const a=afkRerollEstimate({...setup,offerChance:0});
 assert.equal(a.withRerolls,a.base);
});
test('Pure Pearls share the Lucky Day and pearl-value multipliers',()=>{
 const levels=[8,1,5,0,2,1,3,4,0],scurge=Array(9).fill(0),worker=3,rank=0;
 const base=pearlProxy(levels,scurge,worker,rank,true);
 const higherPearlValue=levels.slice();higherPearlValue[0]++;
 const boosted=pearlProxy(higherPearlValue,scurge,worker,rank,true);
 assert.ok(Math.abs(boosted/base-10/9)<1e-12);
});
