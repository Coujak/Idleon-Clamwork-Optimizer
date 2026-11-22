// node --test tests/unified-allocation-layout.test.mjs
// Synthetic save state: verify Scurge changes feed the Pearl purchase list.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const engineCode=readFileSync(new URL('../optimizer-engine.js',import.meta.url),'utf8');
const plannerCode=readFileSync(new URL('../planner.js',import.meta.url),'utf8');
const fmt=x=>Number(x).toLocaleString('en-US',{maximumFractionDigits:2});
function harness(){
 const nodes={};
 const doc={
   readyState:'loading',addEventListener(){},
   getElementById(id){
     if(!nodes[id])nodes[id]={
       id,value:id==='pClamScaling'?'0.5':id==='pScurgeGoal'?'auto':id==='pFarmFocus'?'pearls':'',
       innerHTML:'',textContent:'',checked:false,addEventListener(){}
     };
     return nodes[id];
   }
 };
 const context={window:{fmt},document:doc};
 runInNewContext(engineCode,context,{filename:'optimizer-engine.js'});
 runInNewContext(plannerCode,context,{filename:'planner.js'});
 context.window.ClamworksPlanner.init();
 return {nodes,engine:context.window.ClamworksOptimization,planner:context.window.ClamworksPlanner};
}
const base={
 worker:9,pearls:583300507264776,scurge:489,scurgeExp:300,
 scurgeLevels:[101,300,3,1,82,1,0,0,0],
 pearlLevels:[212,23,77,82,185,53,55,63,53],pearlUnlocked:8
};
test('next-class planner uses proposed Scurge discounts in Pearl prices',()=>{
 const {nodes,engine,planner}=harness();
 planner.onSave(base);
 const planned=base.scurgeLevels.slice();planned[3]++;
 const expected=engine.cost(base.worker,base.pearlLevels,planned,6);
 const original=engine.cost(base.worker,base.pearlLevels,base.scurgeLevels,6);
 assert.ok(expected<original);
 assert.equal(nodes.pOutcome.textContent,'Allocate Scurge Points first');
 assert.ok(nodes.pStrategy.textContent.includes('Cost Dissolving +1'));
 assert.ok(nodes.pPearlRows.innerHTML.includes(fmt(expected)));
 assert.ok(!nodes.pPearlRows.innerHTML.includes(fmt(original)));
 const pearlRows=[...nodes.pPearlRows.innerHTML.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
 const scurgeRows=[...nodes.pScurgeRows.innerHTML.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
 assert.equal(pearlRows.length,9);
 assert.equal(scurgeRows.length,9);
 assert.ok(pearlRows.every(m=>(m[1].match(/<td\b/g)||[]).length===4));
 assert.ok(scurgeRows.every(m=>(m[1].match(/<td\b/g)||[]).length===3));
});
test('with no unspent points, two lists use the imported current Scurge levels',()=>{
 const {nodes,engine,planner}=harness();
 const current={...base,scurge:488};
 planner.onSave(current);
 assert.equal(nodes.pOutcome.textContent,'Invest before saving');
 assert.ok(nodes.pPearlRows.innerHTML.includes(fmt(engine.cost(9,base.pearlLevels,base.scurgeLevels,6))));
 assert.equal(nodes.pAvailableScurge.textContent,'0 free');
});
