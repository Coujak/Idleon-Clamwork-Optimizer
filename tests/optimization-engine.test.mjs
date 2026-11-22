// node --test tests/optimization-engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const context={module:{exports:{}}};
runInNewContext(readFileSync(new URL('../optimizer-engine.js',import.meta.url),'utf8'),context);
const core=context.module.exports;
const fixture={
 worker:5,scurge:30,scurgeExp:250,
 pearlLevels:[38,11,13,25,27,8,0,0,0],
 scurgeLevels:[10,5,2,0,2,0,0,0,0],pearlUnlocked:8,pearls:2e7
};
const noScurge=Array(9).fill(0);
test('promotion costs and expected failed attempt funding',()=>{
  assert.equal(core.promotion(9).cost,1e14);
  assert.equal(core.promotion(9).chance,1/22);
  assert.equal(core.need(0,100,0.1),1000);
  assert.ok(Math.abs(core.need(100,100,0.1)-900)<1e-9);
  assert.ok(Math.abs(core.need(250,100,0.1)-769.5)<1e-9);
});
test('nine next-cost formulas match verified live-game reference prices',()=>{
  const expected=[2367.0020094966344,46064282.66105488,4607.269540135561,
    2653272.1583636967,641781.0079233249,9444623.736566508,
    9212853.773584904,230321344.33962262,5758033608.490565];
  for(let i=0;i<9;i++){
    const got=core.cost(5,fixture.pearlLevels,noScurge,i);
    assert.ok(Math.abs(got/expected[i]-1)<1e-11,'Slot '+i);
  }
});
test('Clam Comrades scales with mob count and stops at 25 clams',()=>{
  const l=Array(9).fill(0),s=Array(9).fill(0);
  const base=core.benefit(l,s,0,0,0,1);
  l[1]=1;assert.ok(Math.abs(core.benefit(l,s,0,0,0,1)/base-1.5)<1e-12);
  l[1]=23;const max=core.benefit(l,s,0,0,0,1);
  l[1]=24;assert.equal(core.benefit(l,s,0,0,0,1),max);
  const conservative=core.benefit(l,s,0,0,0,0.5);
  assert.ok(conservative<max);
});
test('Multi-Scalping is supported only with known participating multikill',()=>{
  const p=structuredClone(fixture);p.pearlLevels[3]=10;
  assert.equal(core.benefit(p.pearlLevels,p.scurgeLevels,p.worker,p.scurge,null),null);
  const higher=core.benefit(p.pearlLevels,p.scurgeLevels,p.worker,p.scurge,20000);
  const lower=core.benefit(p.pearlLevels,p.scurgeLevels,p.worker,p.scurge,1000);
  assert.ok(higher>lower);
  const unknown=core.planPearls(p,{sources:[{weight:1,multikill:null}]});
  assert.equal(unknown.support.haveMK,false);
  assert.ok(unknown.best.history.every(a=>a.index!==3));
  const complete=core.planPearls(p,{sources:[{weight:1,multikill:10000}]});
  assert.equal(complete.support.haveMK,true);
});
test('promotion search obeys locked upgrades and never worsens the baseline',()=>{
  const p={...fixture,pearlUnlocked:0,pearlLevels:Array(9).fill(0)};
  const result=core.planPearls(p,{depth:8,width:20});
  assert.ok(result.best.score<=result.baseline);
  assert.ok(result.best.history.every(x=>x.index===0));
});
test('best purchase plan contains consistent levels, purchase prices and histories',()=>{
  const p=core.planPearls(fixture,{depth:12,width:30,
    sources:[{weight:1,multikill:12000}]});
  assert.ok(p.visited>0);
  assert.ok(p.relativeImprovementPct>=0);
  assert.ok(p.best.history.length<=12);
  for(const row of p.best.history){
    assert.ok(row.cost>0);
    assert.equal(row.to,row.from+1);
    assert.ok(row.index>=0&&row.index<9);
  }
});
test('single-upgrade cutoff follows the promotion expected-need equation',()=>{
  const cost=core.singleBuyCutoff(0,{cost:100,chance:0.1},1.5);
  assert.ok(Math.abs(cost-333.3333333333333)<1e-8);
  assert.equal(core.singleBuyCutoff(0,{cost:100,chance:0.1},1),0);
});
test('Scurge proposal only spends currently free points, preserving allocated levels',()=>{
  const before=fixture.scurgeLevels;
  const proposal=core.optimizeScurge(fixture,{mode:'pearls'});
  const free=fixture.scurge-before.reduce((a,b)=>a+b,0);
  assert.equal(proposal.free,free);
  assert.ok(proposal.spent<=free);
  assert.ok(proposal.unspent>=0);
  for(let i=0;i<9;i++)assert.ok(proposal.allocation[i]>=before[i]);
});
test('Self Affliction is never automatically increased without safe on-map damage',()=>{
  const p={...fixture,scurge:31};
  const blocked=core.optimizeScurge(p,{mode:'exp',maxAffliction:5});
  assert.equal(blocked.allocation[2],fixture.scurgeLevels[2]);
  const allowed=core.optimizeScurge(p,{mode:'exp',maxAffliction:4,maxDamage:1e40});
  assert.ok(allowed.allocation[2]>=fixture.scurgeLevels[2]);
});
test('next earned Scurge point is a preview; it does not spend the current budget',()=>{
  const p={...fixture,scurge:fixture.scurgeLevels.reduce((a,b)=>a+b,0)};
  const next=core.previewNextScurge(p,{mode:'pearls'});
  assert.ok(next&&next.level>p.scurge);
  assert.equal(core.optimizeScurge(p,{mode:'pearls'}).spent,0);
});
test('Scurge switch assessment requires both farming channels and has a threshold',()=>{
  const p={...fixture,scurge:30,scurgeExp:250};
  const next=core.previewNextScurge(p,{mode:'pearls'});
  const a=core.switchToScurge(p,{activePearlsPerHour:1e4,afkPearlsPerHour:1e3,scurgeExpPerHour:1e8,nextPoint:next});
  assert.equal(a.available,true);
  assert.ok(a.minimumExpPerHour>0);
  assert.ok(a.timeSavedHours>0);
  const b=core.switchToScurge(p,{activePearlsPerHour:1e4,afkPearlsPerHour:1e3,scurgeExpPerHour:0.000001,nextPoint:next});
  assert.equal(b.worthwhile,false);
});
test('future worker milestones correctly reset temporary-upgrade assumption',()=>{
  const plan=core.milestones(9,12);
  assert.equal(plan.length,3);
  assert.equal(plan[0].from,9);
  assert.equal(plan[2].to,12);
  assert.ok(plan.every(x=>x.resetsTemporaryUpgrades));
});
