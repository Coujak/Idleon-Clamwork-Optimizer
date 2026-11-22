// node --test tests/next-class-layout.test.mjs
// Verify the planner always targets the next Worker Class and uses one unified view.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../planner.css',import.meta.url),'utf8');
const script=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)?.[0]
  .replace(/^<script>/,'').replace(/<\/script>$/,'');
assert.ok(script,'inline import/render script should be present');
const mockClassList=()=>{
  const set=new Set();
  return {add:v=>set.add(v),remove:v=>set.delete(v),
    contains:v=>set.has(v),
    toggle(v,force){if(force===false)set.delete(v);else if(force===true)set.add(v);
      else if(set.has(v))set.delete(v);else set.add(v);return set.has(v)}};
};
function build(){
  const nodes=new Map();
  const tabNames=['overview','allocator'];
  const tabs=tabNames.map(x=>({dataset:{tab:x},classList:mockClassList(),
    addEventListener(){},setAttribute(name,val){this[name]=val;}}));
  const sections=tabNames.map(x=>({id:x,classList:mockClassList()}));
  const document={
    getElementById(id){
      if(!nodes.has(id))nodes.set(id,{
        id,className:'',textContent:'',innerHTML:'',value:'',style:{width:''},
        classList:mockClassList(),addEventListener(){},
        scrollIntoView(){},focus(){},blur(){},setAttribute(){}
      });
      return nodes.get(id);
    },
    querySelectorAll(query){
      if(query==='.tab')return tabs;
      if(query==='.section')return sections;
      return [];
    }
  };
  const received=[];
  const window={
    ClamworksPlanner:{onSave:p=>received.push(['planner',p])},
    ClamworksFarming:{onSave:p=>received.push(['farming',p])}
  };
  const context={document,window,console};
  runInNewContext(script,context,{filename:'index-inline-script'});
  return {context,document,tabs,sections,received};
}
const saveFor=worker=>{
  const opt=Array(530).fill(0);
  opt[454]=7e10;opt[464]=worker;opt[465]=8;
  return {data:{OptLacc:JSON.stringify(opt),
    Menagerie:JSON.stringify([[0,0,0,0,0,0,0,42,16],[],[],[],[],[3,4,2,0,3,0,0,0,0]])}};
};
test('Class 6 save is optimized toward 7, not fixed Class 12',()=>{
  const fixture=build();
  fixture.context.load(saveFor(6));
  const get=id=>fixture.document.getElementById(id).textContent;
  assert.equal(get('worker'),'6');
  assert.equal(get('nextWorker'),'7');
  assert.equal(get('heroTarget'),'Worker Class 6 → 7');
  assert.ok(get('summary').includes('Class 6 → 7'));
  assert.ok(fixture.received.some(([key,data])=>key==='planner'&&data.worker===6));
  assert.equal(fixture.sections.find(x=>x.id==='allocator').classList.contains('active'),true);
  assert.equal(fixture.document.getElementById('accountKpis').classList.contains('hidden'),true,
    'overview KPI cards should not repeat above the optimizer');
});
test('Class 7 and 10 immediately target the following Class from fresh saves',()=>{
  const fixture=build();
  fixture.context.load(saveFor(7));
  assert.equal(fixture.document.getElementById('heroTarget').textContent,'Worker Class 7 → 8');
  fixture.context.load(saveFor(10));
  assert.equal(fixture.document.getElementById('heroTarget').textContent,'Worker Class 10 → 11');
});
test('UI has one unified planner and two side-by-side upgrade lists',()=>{
  assert.equal((html.match(/data-tab="/g)||[]).length,2);
  assert.equal((html.match(/id="pPearlRows"/g)||[]).length,1);
  assert.equal((html.match(/id="pScurgeRows"/g)||[]).length,1);
  assert.equal((html.match(/class="planner-dual-grid"/g)||[]).length,1);
  assert.equal((html.match(/id="scurgeworks"/g)||[]).length,0);
  assert.equal((html.match(/id="promotion"/g)||[]).length,0);
  assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.ok(css.includes('@media(max-width:1000px)'));
  assert.ok(html.includes('id="farmSetup"'));
  assert.ok(html.includes('id="farmSetupSummary"'));
});
test('collapsed details retain the inputs needed by farming and AFK calculators',()=>{
  for(const id of ['pFarmFocus','pScurgeGoal','pClamScaling','pMaxAffliction',
    'pActiveRate','pAfkRate','pScurgeRate','pScurgeAlternatives',
    'pAfkRegular','pAfkPurePct','pAfkOfferPct','pAfkReplacementPurePct']){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
});
