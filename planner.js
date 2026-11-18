/* Clamworks Lab — transparent promotion-cycle planner
   The save has upgrade levels, but NOT the nine cost-growth constants.
   Prices must be calibrated against the next-cost numbers shown in game.
   Sources: current game descriptions and Clamworks formula reference.
*/
(() => {
  'use strict';
  const PEARL = ['Pearl Value','Clam Comrades','Lucky Day','Multi-Scalping','Frugality','Pure Pearls','Encystation Up','Shinier Pearls','Anti Inflation'];
  const SCURGE = ['Reckoning','Pearl Infection','Self Affliction','Cost Dissolving','Even Better','Cross Culting','Gravestart','Swarming','True Scurge'];
  const S_UNLOCK = [0,5,10,25,50,100,250,500,1000];
  const P_PER_LEVEL = [1,1,3,null,12,50,10,10,16];
  const S_PER_LEVEL = [2,50,200,25,150,10,null,10,10];
  const fmt = window.fmt || (n => Number(n).toLocaleString('en-US',{maximumFractionDigits:2}));
  const numberInput = window.parseCompactNumber || (value => Number(value));
  const $ = id => document.getElementById(id);
  const clamp = (n,low,high) => Math.max(low,Math.min(high,n));
  const finite = n => Number.isFinite(n) && n >= 0;
  const finitePositive = n => Number.isFinite(n) && n > 0;
  let state = null;
  let prices = Array(9).fill(NaN);
  let observedRate = NaN;
  let multikill = NaN;

  function promotion(worker) {
    const cost = 1e5 * Math.pow(10,worker);
    const chance = 0.5 / (2 + worker);
    return {cost,chance,expectedAttempts:1/chance,expectedCost:cost/chance};
  }
  function expectedNeed(balance,cost,chance) {
    if (!finitePositive(cost) || !finitePositive(chance) || chance > 1 || !finite(balance)) return NaN;
    if (balance < cost) return cost / chance - balance;
    const n = Math.floor(balance / cost);
    const remainder = balance - n * cost;
    // Immediate attempts consume whole promotion costs; success stops spending.
    return Math.pow(1-chance,n) * (cost / chance - remainder);
  }
  function reduction(levels,scurge,index) {
    return 1/((1+0.12*levels[4])*(1+0.25*scurge[3])*
      (1+0.1*scurge[index]*scurge[5])*(1+0.16*levels[8]));
  }
  function pearlProxy(levels,scurge,worker,rank,blackUnlocked) {
    const chance10 = 1 + 9*(3*levels[2])/(100+3*levels[2]);
    const pearlValue = (1+levels[0])*(1+0.1*levels[7])*
      (1+0.5*scurge[1])*(1+0.1*scurge[8]*rank);
    const dropMulti = (1+0.1*levels[6]) * Math.pow(0.66,worker);
    const regular = 0.005*dropMulti*pearlValue*chance10;
    const black = blackUnlocked ? 0.000025*dropMulti*(50+50*levels[5]) : 0;
    // Multi-Scalping and clam-count kill-speed effects need character-specific metrics.
    // Both are held fixed, not fabricated, in this provisional pearl proxy.
    return regular + black;
  }
  function costModel(profile,baseScurge) {
    const baseReduction = Array.from({length:9},(_,i)=>reduction(profile.pearlLevels,baseScurge,i));
    return Array.from({length:9},(_,i)=>{
      const quoted = prices[i];
      if(!finitePositive(quoted))return null;
      const currentNext = Math.max(1,profile.pearlLevels[i]+1);
      const undiscounted = quoted/baseReduction[i];
      const baseTerm = i===0?1:4*Math.pow(10+3*profile.worker,i-1);
      const poly = i===0?3*currentNext+Math.pow(currentNext,2.5):2*currentNext+Math.pow(currentNext,1.5);
      const ratio=(undiscounted-poly)/baseTerm;
      const growth = ratio>0?Math.pow(ratio,1/currentNext):NaN;
      return {undiscounted,currentNext,growth,baseTerm,knownNext:quoted};
    });
  }
  function nextCost(profile,levels,scurge,model,i) {
    if(!model[i])return NaN;
    const calibrated=model[i];
    const nextLevel = levels[i]+1;
    let raw;
    if(nextLevel===calibrated.currentNext)raw=calibrated.undiscounted;
    else if(finitePositive(calibrated.growth)){
      const poly = i===0?3*nextLevel+Math.pow(nextLevel,2.5):2*nextLevel+Math.pow(nextLevel,1.5);
      raw=calibrated.baseTerm*Math.pow(calibrated.growth,nextLevel)+poly;
    }else return NaN;
    const result=raw*reduction(levels,scurge,i);
    return finitePositive(result)?result:NaN;
  }
  function accessible(profile,levels,i) {
    if(levels[i]>0)return true;
    const unlock=20*Math.pow(10+3*profile.worker,i);
    // If unpurchased and never visible, access may require obtaining this threshold.
    // We do not block it here; the game might have unlocked it previously.
    return finitePositive(unlock);
  }
  function simulate(profile,scurge,model,maximumDepth=3) {
    const promo=promotion(profile.worker);
    const baseRate=pearlProxy(profile.pearlLevels,scurge,profile.worker,profile.scurge,profile.blackUnlocked);
    if(!finitePositive(baseRate))return null;
    const starting={levels:profile.pearlLevels.slice(),balance:profile.pearls,elapsed:0,history:[],rate:baseRate};
    const score=node=>node.elapsed+expectedNeed(node.balance,promo.cost,promo.chance)/node.rate;
    let best={...starting,score:score(starting)};
    let frontier=[starting];
    const width=20;
    const evaluated=[];
    for(let depth=0;depth<maximumDepth;depth++){
      const next=[];
      for(const node of frontier){
        for(let i=0;i<9;i++){
          if(i===1||i===3)continue; // Cannot estimate added kills/hr or Multi-Scalping without a character model.
          if(!accessible(profile,node.levels,i))continue;
          const cost=nextCost(profile,node.levels,scurge,model,i);
          if(!finitePositive(cost))continue;
          const needed=Math.max(0,cost-node.balance);
          const wait=needed/node.rate;
          const afterBalance=Math.max(0,node.balance-cost);
          const levels=node.levels.slice();levels[i]++;
          const rate=pearlProxy(levels,scurge,profile.worker,profile.scurge,profile.blackUnlocked);
          if(!finitePositive(rate))continue;
          const trial={levels,balance:afterBalance,elapsed:node.elapsed+wait,
            history:node.history.concat([{i,cost,rateGain:rate/node.rate-1}]),rate};
          trial.score=score(trial);
          evaluated.push(trial);
          if(trial.score<best.score-1e-10)best=trial;
          next.push(trial);
        }
      }
      if(!next.length)break;
      next.sort((a,b)=>a.score-b.score);
      const seen=new Set();
      frontier=next.filter(row=>{
        const key=row.levels.join(',');
        if(seen.has(key))return false;
        seen.add(key);return true;
      }).slice(0,width);
    }
    const firstActions=evaluated.filter(row=>row.history.length===1)
      .sort((a,b)=>a.score-b.score);
    return {best,baseline:score(starting),baseRate,promo,firstActions,model,availablePriceCount:model.filter(Boolean).length};
  }
  function allocateScurge(profile,model) {
    const level=profile.scurge;
    const used=profile.scurgeLevels.reduce((a,b)=>a+b,0);
    const free=Math.max(0,Math.floor(level-used));
    const allocation=profile.scurgeLevels.slice();
    const moves=[];
    // Short-run promotion objective. EXP leveling and combat-changing upgrades are
    // excluded until the character-specific Scurge EXP / kill model is available.
    const indices=[1,3,5,8].filter(i=>level>=S_UNLOCK[i]);
    let current=simulate(profile,allocation,model,2);
    for(let p=0;p<Math.min(500,free);p++){
      let winner=null;
      for(const index of indices){
        const candidate=allocation.slice();candidate[index]++;
        const plan=simulate(profile,candidate,model,2);
        if(plan&&(!winner||plan.best.score<winner.plan.best.score))winner={index,plan};
      }
      if(!winner)break;
      allocation[winner.index]++;
      moves.push(winner.index);
      current=winner.plan;
    }
    return {allocation,moves,free,plan:current,unassigned:Math.max(0,free-moves.length)};
  }
  function breakEvenCost(profile,scurge,index) {
    if(index===1||index===3||index===4||index===8)return NaN;
    const oldRate=pearlProxy(profile.pearlLevels,scurge,profile.worker,profile.scurge,profile.blackUnlocked);
    const levels=profile.pearlLevels.slice();levels[index]++;
    const newRate=pearlProxy(levels,scurge,profile.worker,profile.scurge,profile.blackUnlocked);
    if(!finitePositive(oldRate)||!finitePositive(newRate)||newRate<=oldRate)return 0;
    const promo=promotion(profile.worker);
    const baseline=expectedNeed(profile.pearls,promo.cost,promo.chance)/oldRate;
    const score=cost=>Math.max(0,cost-profile.pearls)/oldRate+
      expectedNeed(Math.max(0,profile.pearls-cost),promo.cost,promo.chance)/newRate;
    let lo=0,hi=promo.expectedCost;
    if(score(hi)<baseline)return NaN;
    for(let n=0;n<58;n++){
      const mid=(lo+hi)/2;
      if(score(mid)<baseline)lo=mid;else hi=mid;
    }
    return lo;
  }
  function hoursText(hours) {
    if(!finite(hours))return '—';
    if(hours<1)return (hours*60).toFixed(1)+' min';
    if(hours<72)return hours.toFixed(1)+' hr';
    return (hours/24).toFixed(1)+' days';
  }
  function show(id,value){const el=$(id);if(el)el.textContent=value;}
  function render() {
    if(!state){
      ['pWorker','pPearls','pPromoCost','pPromoChance','pAttempts','pExpected'].forEach(id=>show(id,'—'));
      $('pOutcome').textContent='Import a save to calculate your current promotion target.';
      $('pPearlRows').innerHTML='';
      $('pScurgeRows').innerHTML='';
      $('pStrategy').innerHTML='Import a JSON save to begin.';
      return;
    }
    const promo=promotion(state.worker);
    show('pWorker','Class '+state.worker+' → '+(state.worker+1));
    show('pPearls',fmt(state.pearls));
    show('pPromoCost',fmt(promo.cost));
    show('pPromoChance',(100*promo.chance).toFixed(2)+'%');
    show('pAttempts',promo.expectedAttempts.toFixed(1));
    show('pExpected',fmt(promo.expectedCost));
    const calibrated=costModel(state,state.scurgeLevels);
    const estimate=simulate(state,state.scurgeLevels,calibrated,3);
    const scurge=allocateScurge(state,calibrated);
    const after=simulate(state,scurge.allocation,calibrated,3);
    const baseCost=estimate?estimate.baseline:NaN;
    const bestAfter=after?after.best.score:NaN;
    const baseRate=estimate?.baseRate||NaN;
    const remainingPearls=expectedNeed(state.pearls,promo.cost,promo.chance);
    const rate=observedRate;
    const hasRate=finitePositive(rate);
    show('pExpectedNeed',fmt(remainingPearls));
    show('pEta',hasRate?hoursText(remainingPearls/rate):'Add pearl rate');
    let status='', details='';
    const unknown=9-calibrated.filter(Boolean).length;
    const unknownRelevant=[0,2,4,5,6,7,8].filter(i=>!calibrated[i]);
    if(state.worker>=12){
      status='Worker Class 12 reached';
      details='Switch your objective to permanent progression and future-content preparation.';
    }else if(!estimate){
      status='Need a valid account snapshot';
    }else if(unknownRelevant.length){
      status='Provisional — enter next pearl-upgrade costs';
      details='The save does not contain the game’s cost-growth constants. Enter the in-game next prices to compare buying with saving. Missing prices: '+unknownRelevant.map(i=>PEARL[i]).join(', ')+'.';
    }else if(after.best.history.length){
      status='Invest before saving';
      details='Candidate: '+after.best.history.map(x=>PEARL[x.i]+' +1').join(' → ')+'. Estimated saving versus starting to save now: '+((1-bestAfter/baseCost)*100).toFixed(2)+'% of modeled remaining farming time.';
    }else{
      status='Save pearls for promotion';
      details='Within the compared purchase sequences, buying more pearl upgrades does not shorten expected time to promotion. Save toward '+fmt(promo.cost)+' pearls per attempt.';
    }
    if(scurge.moves.length){
      const allocationText=[...new Set(scurge.moves)].map(i=>SCURGE[i]+' +'+scurge.moves.filter(x=>x===i).length).join(', ');
      details+=' Suggested free Scurge Points for the promotion push: '+allocationText+'.';
    }
    $('pOutcome').textContent=status;
    $('pStrategy').textContent=details || 'No further modeled improvement found.';
    $('pConfidence').textContent=unknownRelevant.length
      ?'INCOMPLETE: missing next-cost inputs. Rankings cannot be called globally optimal.'
      :'PROVISIONAL: only pearl-rate upgrades and purchase sequences up to three levels are compared. Combat effects, future Scurge leveling and post-promotion resets are not simulated.';
    $('pPearlRows').innerHTML=PEARL.map((name,i)=>{
      const current=state.pearlLevels[i];
      const cost=nextCost(state,state.pearlLevels,state.scurgeLevels,calibrated,i);
      const action=estimate?.firstActions.find(row=>row.history[0].i===i);
      const pct=action?100*(1-action.score/estimate.baseline):NaN;
      const note=(i===1)?'Combat-dependent':(i===3)?'Requires multikill model':(i===4||i===8)?'Indirect: helps future purchases':!calibrated[i]?'Enter next cost':finite(pct)?(pct>0.00001?'Potential gain':'No immediate gain'):'Needs calibration';
      const val=finitePositive(prices[i])?String(prices[i]):'';
      const threshold=breakEvenCost(state,state.scurgeLevels,i);
      const cutoff=i===4||i===8?'Sequence-dependent':i===1||i===3?'Requires combat':finite(threshold)?fmt(threshold):'—';
      return '<tr><td><strong>'+name+'</strong><div class="mini-note">'+note+'</div></td>'+
        '<td><span class="bubble">'+fmt(current)+'</span></td>'+
        '<td><input type="text" class="planner-price" data-price="'+i+'" aria-label="'+name+' next upgrade cost" placeholder="e.g. 1.5B" value="'+val+'"></td>'+
        '<td class="numeric">'+(finitePositive(cost)?fmt(cost):'—')+'</td>'+
        '<td class="numeric">'+cutoff+'</td>'+
        '<td class="numeric">'+(finite(pct)?(pct>0?'+':'')+pct.toFixed(2)+'%':'—')+'</td></tr>';
    }).join('');
    $('pScurgeRows').innerHTML=SCURGE.map((name,i)=>{
      const delta=scurge.allocation[i]-state.scurgeLevels[i];
      const locked=state.scurge<S_UNLOCK[i];
      return '<tr><td><strong>'+name+'</strong><div class="mini-note">'+(locked?'Unlocks at Scurge '+S_UNLOCK[i]:(i===0||i===2||i===4||i===6||i===7?'EXP or combat benefit not modeled for promotions':'Pearl or upgrade-cost benefit'))+'</div></td>'+
        '<td><span class="bubble'+(state.scurgeLevels[i]?' purple':'')+'">'+fmt(state.scurgeLevels[i])+'</span></td>'+
        '<td class="numeric">'+(locked?'Locked':delta?'+'+delta:'—')+'</td></tr>';
    }).join('');
    show('pAvailableScurge',scurge.free+' unspent');
    show('pCurrentRate',hasRate?fmt(rate)+'/hr':'Not supplied');
    show('pModeledRateChange',finitePositive(bestAfter)&&finitePositive(baseCost)?(100*(1-bestAfter/baseCost)).toFixed(2)+'% best modeled time reduction':'—');
    show('pTotalCosted',calibrated.filter(Boolean).length+' / 9 prices entered');
    show('pBaselineEta',hasRate?hoursText(remainingPearls/rate):'Not available');
    show('pPlannedEta',hasRate&&estimate&&after?hoursText(bestAfter*baseRate/rate):'Not available');
    // Calibrations are intentionally not persisted or embedded in the public source.
  }
  function onSave(profile) {
    if(!profile){state=null;prices=Array(9).fill(NaN);render();return}
    const changed=!state||state.worker!==profile.worker||state.scurge!==profile.scurge||
      state.pearlLevels.some((v,i)=>v!==profile.pearlLevels[i]);
    if(changed) prices=Array(9).fill(NaN);
    state=profile;
    render();
  }
  function init() {
    for(const row of document.querySelectorAll('[data-planner-tab]')){
      row.addEventListener('click',()=>{if(window.showTab)window.showTab('allocator')});
    }
    $('pPearlRows').addEventListener('change',event=>{
      const index=Number(event.target.dataset.price);
      if(!Number.isInteger(index)||index<0||index>8)return;
      const parsed=numberInput(event.target.value);
      prices[index]=finitePositive(parsed)?parsed:NaN;
      render();
    });
    $('pRate').addEventListener('change',event=>{
      const parsed=numberInput(event.target.value);
      observedRate=finitePositive(parsed)?parsed:NaN;
      render();
    });
    $('pRate').addEventListener('keydown',event=>{if(event.key==='Enter')event.target.blur()});
    $('pResetPrices').addEventListener('click',()=>{prices=Array(9).fill(NaN);render()});
    render();
  }
  window.ClamworksPlanner={onSave,init,promotion,expectedNeed,pearlProxy};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
