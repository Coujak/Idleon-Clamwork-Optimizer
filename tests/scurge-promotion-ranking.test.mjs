// node --test tests/scurge-promotion-ranking.test.mjs
// Synthetic and formula-derived data only; no user save committed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const context={module:{exports:{}}};
runInNewContext(readFileSync(new URL('../optimizer-engine.js',import.meta.url),'utf8'),context);
const engine=context.module.exports;

const profile={
  worker:9,
  scurge:194,
  pearlLevels:[212,23,77,82,185,53,55,63,53],
  scurgeLevels:[101,6,3,1,82,1,0,0,0],
  pearls:583300507264776,
  pearlUnlocked:8
};
const options={mode:'promotion',clamExponent:0.5,depth:16,width:55};

test('next Scurge point compares Pearl Infection, Cost Dissolving and Cross Culting',()=>{
  const next=engine.previewNextScurge(profile,options);
  assert.equal(next.level,195);
  assert.equal(next.name,'Pearl Infection');
  assert.deepEqual(Array.from(next.alternatives,x=>x.name),
    ['Pearl Infection','Cost Dissolving','Cross Culting']);
  const values=next.alternatives.map(x=>x.gainPct);
  assert.ok(Math.abs(values[0]-11.1111111111111)<1e-6);
  assert.ok(Math.abs(values[1]-0.5381428189745)<1e-5);
  assert.equal(values[2],0);
  // True Scurge is locked until Scurge level 1000; never rank it.
  assert.equal(next.alternatives.some(x=>x.name==='True Scurge'),false);
});

test('Cost Dissolving can win if Pearl Infection is heavily saturated',()=>{
  const modified={...profile,scurge:488,
    scurgeLevels:[101,300,3,1,82,1,0,0,0]};
  const next=engine.previewNextScurge(modified,{mode:'promotion',depth:12,width:35});
  assert.equal(next.name,'Cost Dissolving');
  assert.ok(next.alternatives.find(x=>x.name==='Cost Dissolving').gainPct >
    next.alternatives.find(x=>x.name==='Pearl Infection').gainPct);
});

test('existing zero-point allocation is preserved and preview does not grant points',()=>{
  const plan=engine.optimizeScurge(profile,options);
  assert.equal(plan.free,0);
  assert.equal(plan.spent,0);
  assert.deepEqual(Array.from(plan.allocation),profile.scurgeLevels);
  assert.equal(engine.previewNextScurge(profile,options).level,195);
});

test('a genuinely free point is spent using promotion value, including discounts',()=>{
  const p={...profile,scurge:489,
    scurgeLevels:[101,300,3,1,82,1,0,0,0]};
  const allocation=engine.optimizeScurge(p,{mode:'promotion',depth:12,width:35});
  assert.equal(allocation.free,1);
  assert.equal(allocation.spent,1);
  assert.equal(allocation.distribution[3].delta,1);
});
