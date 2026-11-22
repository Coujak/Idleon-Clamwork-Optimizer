// node --test tests/purchase-grouping.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const context={window:{},document:{readyState:'loading',addEventListener(){}}};
runInNewContext(readFileSync(new URL('../planner.js',import.meta.url),'utf8'),context);
const {groupPurchaseSteps}=context.window.ClamworksPlanner;

test('consecutive purchases become one group with summed price and compounded gain',()=>{
  const source=[
    {index:6,name:'Encystation Up',from:55,to:56,cost:14,rateGainPct:1.538461538461533},
    {index:6,name:'Encystation Up',from:56,to:57,cost:20,rateGainPct:1.515151515151536},
    {index:6,name:'Encystation Up',from:57,to:58,cost:27,rateGainPct:1.492537313432818}
  ];
  const groups=groupPurchaseSteps(source);
  assert.equal(groups.length,1);
  assert.equal(groups[0].name,'Encystation Up');
  assert.equal(groups[0].from,55);
  assert.equal(groups[0].to,58);
  assert.equal(groups[0].count,3);
  assert.equal(groups[0].cost,61);
  assert.ok(Math.abs(groups[0].rateGainPct-(100*((66/65)*(67/66)*(68/67)-1)))<1e-9);
  assert.equal(source[0].to,56,'input is not mutated');
});

test('interleaved purchases remain separate to preserve buying order',()=>{
  const input=[
    {index:0,name:'Pearl Value',from:10,to:11,cost:1,rateGainPct:10},
    {index:4,name:'Frugality',from:5,to:6,cost:2,rateGainPct:0},
    {index:0,name:'Pearl Value',from:11,to:12,cost:3,rateGainPct:9}
  ];
  const result=groupPurchaseSteps(input);
  assert.deepEqual(Array.from(result,x=>x.index),[0,4,0]);
  assert.deepEqual(Array.from(result,x=>x.count),[1,1,1]);
});

test('empty and skipped level sequences are handled without inventing levels',()=>{
  assert.deepEqual(Array.from(groupPurchaseSteps([])),[]);
  const result=groupPurchaseSteps([
    {index:3,name:'Multi-Scalping',from:4,to:5,cost:5,rateGainPct:2},
    {index:3,name:'Multi-Scalping',from:7,to:8,cost:7,rateGainPct:2}
  ]);
  assert.equal(result.length,2);
});
