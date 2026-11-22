// node --test tests/auto-multikill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const modules={};
for(const file of ['auto-multikill.js','combat-math.js','farming.js']){
  const context={module:{exports:{}}};
  runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  modules[file]=context.module.exports;
}
const auto=modules['auto-multikill.js'];
const math=modules['combat-math.js'];
const farming=modules['farming.js'];

function fixture(){
  const achievements=Array(160).fill(0);
  achievements[148]=-1;
  achievements[123]=-1;
  const salt=Array(25).fill(0);salt[8]=10;
  const opt=Array(530).fill(0);opt[464]=9;opt[465]=8;opt[458]=82;
  const menagerie=[[0,0,0,0,0,0,0,0,194],[],[0,0,0,0,1],[],[],
    [101,6,3,1,82,1,0,0,0]];
  return {charNames:['Guard'],data:{
    CharacterClass_0:16,AFKtarget_0:'Nothing',CurrentMap_0:300,
    Tower:JSON.stringify([11,201,51]),
    SaltLick:JSON.stringify(salt),
    AchieveReg:JSON.stringify(achievements),
    OptLacc:JSON.stringify(opt),Menagerie:JSON.stringify(menagerie)
  }};
}
test('automatically parses five independent bonus sources from raw IT save',()=>{
  const result=auto.knownBase(fixture());
  assert.equal(result.sources.length,5);
  assert.equal(result.sources.find(s=>s.key==='tower').amount,102);
  assert.equal(result.sources.find(s=>s.key==='salt').amount,30);
  assert.equal(result.sources.find(s=>s.key==='achievement-148').amount,1);
  assert.equal(result.sources.find(s=>s.key==='achievement-122').amount,0);
  assert.equal(result.sources.find(s=>s.key==='achievement-123').amount,2);
  assert.equal(result.knownRawBase,135);
  assert.equal(result.fullyParsed,true);
});
test('World 7 scaled subtotal is not misrepresented as total multikill',()=>{
  const a=auto.analyze(fixture(),0,9,null,null,null,math);
  assert.ok(Math.abs(a.knownScaledBase-87.6)<1e-10);
  assert.equal(a.total,null);
  assert.equal(a.exact,false);
  assert.equal(a.missingRawPerTier,true);
  assert.equal(a.missingDamage,true);
});
test('known bonuses combine with explicitly supplied remaining contributions',()=>{
  const a=auto.analyze(fixture(),0,9,1e35,40,100,math);
  assert.equal(a.resolvedRawBase,175);
  assert.equal(a.resolvedRawPerTier,100);
  assert.equal(a.exact,true);
  assert.equal(a.total,a.calculation.total);
});
test('missing AchieveReg never silently creates a completed achievement',()=>{
  const f=fixture();delete f.data.AchieveReg;
  const result=auto.knownBase(f);
  assert.equal(result.knownRawBase,132);
  assert.equal(result.fullyParsed,false);
  assert.ok(result.unavailable.length);
  const calc=auto.analyze(f,0,9,1e40,0,100,math);
  assert.equal(calc.total,null);
});
test('the farming optimizer uses explicit overrides or complete bonus breakdown only',()=>{
  const raw=fixture();
  const account=farming.getAccount(raw);
  const snapshots={0:{sources:{map:306}}};
  const stats={damageOnClamworks:(snap,damage)=>({
    value:damage??null,complete:damage!=null
  })};
  const unknown=farming.scenario(account,{selectedId:0,rawSave:raw,
    combatMath:math,autoMultikill:auto,statEngine:stats,statSnapshots:snapshots,
    rates:{0:{killsPerHour:1000}}});
  assert.equal(unknown.active.multikill,null);
  assert.equal(unknown.active.pearlsPerHour,null);
  assert.equal(unknown.active.mkAudit.knownRawBase,135);
  const calibrated=farming.scenario(account,{selectedId:0,rawSave:raw,
    combatMath:math,autoMultikill:auto,statEngine:stats,statSnapshots:snapshots,
    rates:{0:{killsPerHour:1000,maxDamage:1e35,mkBase:40,mkPerTier:100}}});
  assert.ok(calibrated.active.multikill>=0);
  assert.ok(calibrated.active.pearlsPerHour>0);
  const measured=farming.scenario(account,{selectedId:0,rawSave:raw,
    combatMath:math,autoMultikill:auto,statEngine:stats,statSnapshots:snapshots,
    rates:{0:{killsPerHour:1000,multikill:12000}}});
  assert.equal(measured.active.multikill,12000);
});
