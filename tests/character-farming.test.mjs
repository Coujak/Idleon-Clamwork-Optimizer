// Run with: node --test tests/character-farming.test.mjs
// Synthetic fixtures only: no personal save data is committed to this repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../farming.js',import.meta.url),'utf8');
const context={module:{exports:{}}};
runInNewContext(code,context,{filename:'farming.js'});
const {getRoster,getAccount,pearlYield,scenario}=context.module.exports;
function fixture(){
  const ola=Array(530).fill(0);
  ola[454]=1e9;ola[455]=1;ola[456]=2;ola[457]=3;ola[458]=5;ola[459]=2;
  ola[460]=1;ola[461]=1;ola[462]=4;ola[463]=1;ola[464]=9;
  const data={OptLacc:JSON.stringify(ola),
    Menagerie:JSON.stringify([[0,0,0,0,0,0,0,0,194],[],[],[],[],[1,2,3,4,5,6,0,0,1]])};
  const charNames=['Test Guard','Test Mage','Test Scout'];
  for(let i=0;i<3;i++){
    data['CharacterClass_'+i]=[16,40,22][i];
    data['AFKtarget_'+i]=i===1?'Nothing':'w7a6';
    data['PTimeAway_'+i]=[4,10,5][i];
    data['PVStatList_'+i]=[100+i,200+i,300+i,400+i,500+i];
    data['CurrentMap_'+i]=i===1?300:306;
  }
  return {charNames,data};
}
test('roster imports class, stats, targets and PTimeAway detection',()=>{
  const roster=getRoster(fixture());
  assert.equal(roster.length,3);
  assert.equal(roster[0].className,'Royal Guardian');
  assert.equal(roster[1].className,'Arcane Cultist');
  assert.equal(roster[1].wis,301);
  assert.equal(roster[1].likelyActive,true);
  assert.equal(roster[1].stationedAtClamworks,false);
});
test('scenario excludes the selected active from AFK and respects the toggle',()=>{
  const a=getAccount(fixture());
  const plan=scenario(a,{selectedId:0,includeAfk:true});
  assert.equal(plan.active.name,'Test Guard');
  assert.equal(plan.afk.length,1);
  assert.equal(plan.afk[0].name,'Test Scout');
  assert.equal(scenario(a,{selectedId:0,includeAfk:false}).afk.length,0);
});
test('drop formula with worker=0 and one Pearl Value level yields ten pearls per 1,000 kills',()=>{
  const a={worker:0,scurgeLevel:0,pearlLevels:[1,0,0,0,0,0,0,0,0],scurgeLevels:Array(9).fill(0)};
  const y=pearlYield(a,null);
  assert.ok(Math.abs(y.perThousand-10)<1e-9);
  assert.equal(y.pureChance,0);
});
test('Pure Pearl, Lucky Day and multikill increase expected pearls',()=>{
  const a=getAccount(fixture());
  const low=pearlYield(a,0);
  const high=pearlYield(a,50000);
  assert.ok(high.perThousand>low.perThousand);
  assert.ok(low.pureChance>0);
  assert.ok(low.luckyMultiplier>1);
  assert.equal(pearlYield(a,null).multikillMissing,true);
});
test('unknown multikill and missing AFK rates never become invented hourly totals',()=>{
  const a=getAccount(fixture());
  const p=scenario(a,{selectedId:0,rates:{0:{killsPerHour:2000},2:{killsPerHour:1000}}});
  assert.equal(p.activeRate,null);
  assert.equal(p.afkTotal,null);
  assert.equal(p.totalRate,null);
  const calibrated=scenario(a,{selectedId:0,rates:{
    0:{killsPerHour:2000,multikill:10000},2:{killsPerHour:1000,multikill:2000}}});
  assert.ok(calibrated.activeRate>0);
  assert.ok(calibrated.afkTotal>0);
  assert.ok(Math.abs(calibrated.totalRate-calibrated.activeRate-calibrated.afkTotal)<1e-7);
});
