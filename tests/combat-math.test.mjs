// Run with: node --test tests/combat-math.test.mjs
// Synthetic examples only; no personal save content is committed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const context={module:{exports:{}}};
runInNewContext(readFileSync(new URL('../combat-math.js',import.meta.url),'utf8'),context);
const m=context.module.exports;
test('Class 9 clam HP and World 7 overkill thresholds',()=>{
  const hp=m.monsterHP(9);
  assert.ok(Math.abs(hp/1.9683e29-1)<1e-12);
  assert.equal(m.overkill(24.999*hp,hp).tier,1);
  assert.equal(m.overkill(25*hp,hp).tier,2);
  assert.equal(m.overkill(125*hp,hp).tier,3);
  assert.equal(m.overkill(125*hp,hp).nextDamage,625*hp);
});
test('W7 diminishing returns applied separately to MK base and per tier',()=>{
  const result=m.multikill({worker:0,maxDamage:25e16,rawBase:100,rawPerTier:50});
  assert.equal(result.tier,2);
  assert.equal(result.base,80.6);
  assert.equal(result.perTier,47.3);
  assert.equal(result.total,175);
  assert.equal(result.known,true);
});
test('Unknown damage or raw MK parts never produce a fake MK total',()=>{
  for(const row of [{},{maxDamage:2e30},{maxDamage:2e30,rawBase:40}]){
    const result=m.multikill({worker:9,...row});
    assert.equal(result.known,false);
    assert.equal(result.total,null);
  }
});
test('scurge EXP gain includes live nearby-player Swarming bonus',()=>{
  const s=[101,6,3,1,82,1,0,2,0];
  const base=m.scurgeMultiplier(s,0);
  assert.equal(base,88536);
  assert.ok(Math.abs(m.scurgeMultiplier(s,4)/base-1.8)<1e-12);
});
test('scurge next-level ETA uses current EXP and actual kills/hr',()=>{
  const account={scurgeLevel:194,scurgeExp:2361923618.61605,
    scurgeLevels:[101,6,3,1,82,1,0,0,0]};
  const info=m.scurgeProjection(account,{killsPerHour:1000,otherPlayers:0});
  assert.ok(Math.abs(info.requirement/9026102801.09133-1)<1e-12);
  assert.equal(info.expPerKill,88536);
  assert.equal(info.expPerHour,88536000);
  assert.ok(Math.abs(info.hoursToNext-(info.requirement-info.exp)/88536000)<1e-8);
  assert.equal(m.scurgeProjection(account,{}).hoursToNext,null);
});
