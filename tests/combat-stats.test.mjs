// node --test tests/combat-stats.test.mjs
// Synthetic fixtures only; no personal game exports stored in GitHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const ctx={module:{exports:{}}};
runInNewContext(readFileSync(new URL('../combat-stats.js',import.meta.url),'utf8'),ctx);
const stat=ctx.module.exports;
function makeSave(classId=16,map=300){
  const data={
    CharacterClass_0:classId,CurrentMap_0:map,AFKtarget_0:'Nothing',
    PVStatList_0:[35000000,12000000,8000000,6000000,1844],Lv0_0:[1844],
    EMm0_0:JSON.stringify({0:{STR:135,Weapon_Power:24},1:{Weapon_Power:60}}),
    EquipOrder_0:[{'0':'EquipmentHats119','1':'EquipmentSword5'}],
    SL_0:{10:434,11:0,13:100},CardEquip_0:['Boss4B','w7a6','B'],
    BuffsActive_0:[],Tower:[10,20,51],
    Menagerie:JSON.stringify([[],[],[],[],[],[1,2,3,0,0,0,0,0,0]])
  };
  return {charNames:['Test Guard'],data,extraData:{accuracy:1.2e30,dropRate:100}};
}
test('real IT-style character fields parsed and assigned to source audit',()=>{
  const a=stat.characterSnapshot(makeSave(),0);
  assert.equal(a.name,'Test Guard');
  assert.equal(a.mainStat,'STR');
  assert.equal(a.mainStatValue,35000000);
  assert.equal(a.sources.equippedWeapon,'EquipmentSword5');
  assert.equal(a.sources.weaponEnhancementPower,60);
  assert.equal(a.sources.level,1844);
  assert.equal(a.sources.assignedCards,2);
  assert.equal(a.sources.learnedTalents,2);
  assert.equal(a.sources.onClamworks,false);
});
test('known additive MK source is not misrepresented as total MK',()=>{
  const a=stat.characterSnapshot(makeSave(),0);
  assert.equal(a.knownMkBaseSubtotal,102);
  assert.equal(a.knownMultikillSources[0].source,'Tower[2] × 2');
  assert.equal(a.completeMultikill,false);
  assert.equal(a.completeDamage,false);
});
test('Self Affliction is applied exactly once for a known off-map observation',()=>{
  const a=stat.characterSnapshot(makeSave(),0);
  assert.equal(a.scurgeAfflictionLevel,3);
  assert.ok(Math.abs(a.clamworksDamageFactor/1e-6-1)<1e-12);
  const m=stat.damageOnClamworks(a,1e30,'saved-map');
  assert.ok(Math.abs(m.value/1e24-1)<1e-12);
  assert.equal(m.complete,false); // Other map-specific bonuses not known
  const c=stat.damageOnClamworks(a,1e30,'clamworks');
  assert.equal(c.value,1e30);
  assert.equal(c.penaltyApplied,false);
  assert.equal(c.complete,true);
});
test('on-map observations never double-count the Scurge damage penalty',()=>{
  const a=stat.characterSnapshot(makeSave(16,306),0);
  const m=stat.damageOnClamworks(a,1e28,'saved-map');
  assert.equal(m.value,1e28);
  assert.equal(m.complete,true);
  assert.equal(m.penaltyApplied,false);
});
test('array/object variants and missing fields are safe',()=>{
  const a=stat.characterSnapshot({data:{CharacterClass_2:40,
    PVStatList_2:{0:1,1:2,2:3,3:4,length:5},Tower:[],Menagerie:[]}},2);
  assert.equal(a.mainStat,'WIS');
  assert.equal(a.knownMkBaseSubtotal,null);
  assert.equal(a.scurgeAfflictionLevel,null);
  assert.equal(stat.damageOnClamworks(a,null).value,null);
});
test('roster audit discovers the saved character count, not a hardcoded nine',()=>{
  const sample=makeSave();
  sample.data.CharacterClass_10=40;
  sample.data.PVStatList_10=[1,2,3,4,5];
  const roster=stat.accountAudit(sample);
  assert.equal(roster.length,2);
  assert.equal(roster[1].id,10);
});
