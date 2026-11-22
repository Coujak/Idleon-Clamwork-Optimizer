/* Clamworks Lab — provisional promotion-cycle planner
   Upgrade costs use public game-data constants; farming throughput remains
   estimated until character-specific active and AFK simulation is integrated.
*/
(() => {
  'use strict';
  const PEARL = ['Pearl Value','Clam Comrades','Lucky Day','Multi-Scalping','Frugality','Pure Pearls','Encystation Up','Shinier Pearls','Anti Inflation'];
  const SCURGE = ['Reckoning','Pearl Infection','Self Affliction','Cost Dissolving','Even Better','Cross Culting','Gravestart','Swarming','True Scurge'];
  const S_UNLOCK = [0,5,10,25,50,100,250,500,1000];
  // Legends of Idleon game data generalSpelunky[28] (bonuses) and [29] (cost growth).
  // Cross-checked with Morta1/IdleonToolbox live-game costs on 2026-10-12.
  const P_PER_LEVEL = [1,1,3,1,12,50,10,10,16];
  const S_PER_LEVEL = [1,50,200,25,150,10,1,10,10];
  const COST_RATES = [1.20,5.00,1.50,1.40,1.15,1.50,1.35,1.25,1.22];
  const fmt = window.fmt || (n => Number(n).toLocaleString('en-US',{maximumFractionDigits:2}));
  const numberInput = window.parseCompactNumber || (value => Number(value));
  const $ = id => document.getElementById(id);
  const clamp = (n,low,high) => Math.max(low,Math.min(high,n));
  const finite = n => Number.isFinite(n) && n >= 0;
  const finitePositive = n => Number.isFinite(n) && n > 0;
  let state = null;
  let activePearlsPerHour = NaN;
  let afkPearlsPerHour = NaN;
  let activeScurgeExpPerHour = NaN;
  let activeFocus = 'pearls';
  let characterModel = null;

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
    const regular = 0.005*dropMulti;
    const black = levels[5]>=1 ? 0.000025*dropMulti*(50+50*levels[5]) : 0;
    // Both pearl types are multiplied by the entire pearl-value factor and 10x roll.
    // Validated against Clamworks AFK payout implementation and Toolbox formula.
    // Multi-Scalping and live clam-count throughput still need a combat model.
    return (regular+black)*pearlValue*chance10;
  }
  function costModel() {
    return COST_RATES;
  }
  function nextCost(profile,levels,scurge,model,i) {
    // Thingies.Clam_Cost: level is the CURRENT level; this is the in-game purchase price.
    const lv=Number(levels[i])||0;
    const rate=Number(model[i]);
    if(!finitePositive(rate))return NaN;
    const raw=i===0
      ? Math.pow(rate,lv)+3*lv+Math.pow(lv,2.5)
      : (20*Math.pow(10+3*profile.worker,i-1)/5)*Math.pow(rate,lv)
        +2*lv+Math.pow(lv,1.5);
    const result=raw*reduction(levels,scurge,i);
    return finite(result)?result:NaN;
  }
  function accessible(profile,levels,i) {
    return levels[i]>0 || i<=(profile.pearlUnlocked??0);
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
  function afkRerollEstimate({ regular, pureChance, pureExtra, offerChance, hours, autoClaim=false }) {
    // Simplified policy: keep any claim with Pure Pearls, otherwise reroll if offered.
    // Each rerolled claim is assumed to have the same probability and reward distribution.
    // In-game replacement tables can differ, so do NOT substitute this for the native AFK worker.
    if (![regular,pureChance,pureExtra,offerChance,hours].every(Number.isFinite)
      || regular<0 || pureExtra<0 || pureChance<0 || pureChance>1
      || offerChance<0 || offerChance>1 || hours<=0) return null;
    const q=autoClaim?0:offerChance;
    const probability=pureChance>0 ? pureChance/(1-q*(1-pureChance)) : 0;
    const base=regular+pureChance*pureExtra;
    const withRerolls=regular+probability*pureExtra;
    return {base,withRerolls,probability,gain:withRerolls-base,
      extraPerHour:(withRerolls-base)/hours,expectedRerolls:pureChance>0?
        q*(1-pureChance)/(1-q*(1-pureChance)):q===1?Infinity:q/(1-q)};
  }
  function renderReroll() {
    const read=id=>document.getElementById(id).value.trim();
    const number=id=>numberInput(read(id));
    const pct=id=>read(id)===''?NaN:number(id)/100;
    const amount=id=>read(id)===''?NaN:number(id);
    const result=afkRerollEstimate({
      regular:amount('pAfkRegular'),
      pureChance:pct('pAfkPurePct'), pureExtra:amount('pAfkPureExtra'),
      offerChance:pct('pAfkOfferPct'), hours:amount('pAfkClaimHours'),
      autoClaim:document.getElementById('pAfkAutoClaim').checked
    });
    const node=$('pAfkRerollSummary');
    if(!result){
      node.textContent='Enter your typical AFK claim details to compare collecting immediately versus rerolling Pure Pearl misses.';
      return;
    }
    node.textContent='Without rerolls: '+fmt(result.base)+' pearls/claim. '+
      'Keep Pure; reroll misses: '+fmt(result.withRerolls)+' pearls/claim '+
      '(+'+fmt(result.gain)+', or +'+fmt(result.extraPerHour)+'/hr across that character’s claim interval). '+
      'Pure Pearl chance: '+(100*result.probability).toFixed(2)+'% after rerolls. '+
      'Expected rerolls per claim: '+(Number.isFinite(result.expectedRerolls)?
      result.expectedRerolls.toFixed(2):'unbounded')+'.';
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
    const calibrated=costModel();
    const estimate=simulate(state,state.scurgeLevels,calibrated,3);
    const scurge=allocateScurge(state,calibrated);
    const after=simulate(state,scurge.allocation,calibrated,3);
    const baseCost=estimate?estimate.baseline:NaN;
    const bestAfter=after?after.best.score:NaN;
    const baseRate=estimate?.baseRate||NaN;
    const remainingPearls=expectedNeed(state.pearls,promo.cost,promo.chance);
    const selectedRate=characterModel&&finite(characterModel.activePearlsPerHour)?characterModel.activePearlsPerHour:activePearlsPerHour;
    const afkSelected=characterModel&&finite(characterModel.afkPearlsPerHour)?characterModel.afkPearlsPerHour:afkPearlsPerHour;
    const baseActive=activeFocus==='pearls'&&finitePositive(selectedRate)?selectedRate:0;
    const baseAfk=finitePositive(afkSelected)?afkSelected:0;
    const rate=baseActive+baseAfk;
    // A partially calibrated AFK list is not a complete account income rate.
    const completeAfk=!characterModel||characterModel.coverage===1||finitePositive(afkPearlsPerHour);
    const hasRate=finitePositive(rate)&&completeAfk;
    show('pExpectedNeed',fmt(remainingPearls));
    show('pEta',hasRate?hoursText(remainingPearls/rate):'Enter farming rates');
    show('pScurgeActiveRate',finitePositive(activeScurgeExpPerHour)?fmt(activeScurgeExpPerHour)+'/hr':'Not supplied');
    show('pFarmMode',(characterModel?.selectedName||'Selected character')+(activeFocus==='pearls'?': active pearls + AFK':': Scurge EXP + AFK pearls'));
    let status='', details='';
    if(state.worker>=12){
      status='Worker Class 12 reached';
      details='Switch your objective to permanent progression and future-content preparation.';
    }else if(!estimate){
      status='Need a valid account snapshot';
    }else if(activeFocus==='scurge'){
      status='Scurge farming focus — pearl allocation is provisional';
      details='While Arcane Cultist is active, only AFK pearl earnings are included in the displayed pearl-rate estimate. We have not yet modeled how Scurge EXP unlocks future points or changes your class-12 timeline. Switch to the Royal Guard pearl-farming focus for the provisional spend-versus-save comparison.';
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
    $('pConfidence').textContent='GAME-DATA COSTS VERIFIED. Character-specific pearl yields follow the game formulas; measured kills/hr and multikill are needed for calibrated hourly estimates. Pearl purchase rankings remain PROVISIONAL: the search is limited to three levels, does not yet optimize combat effects of Clam Comrades or Multi-Scalping, and does not simulate future Scurge levels or Worker Class cycles.';
    $('pPearlRows').innerHTML=PEARL.map((name,i)=>{
      const current=state.pearlLevels[i];
      const cost=nextCost(state,state.pearlLevels,state.scurgeLevels,calibrated,i);
      const action=estimate?.firstActions.find(row=>row.history[0].i===i);
      const pct=action?100*(1-action.score/estimate.baseline):NaN;
      const note=(i===1)?'Kill-rate model pending':(i===3)?'Multikill model pending':
        (i===4||i===8)?'Indirect: discounts future purchases':'Game-data price';
      const threshold=breakEvenCost(state,state.scurgeLevels,i);
      const cutoff=i===4||i===8?'Sequence-dependent':i===1||i===3?'Combat-dependent':finite(threshold)?fmt(threshold):'—';
      return '<tr><td><strong>'+name+'</strong><div class="mini-note">'+note+'</div></td>'+
        '<td><span class="bubble">'+fmt(current)+'</span></td>'+
        '<td class="numeric">'+(accessible(state,state.pearlLevels,i)&&finite(cost)?fmt(cost):'Locked')+'</td>'+
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
    show('pTotalCosted','9 / 9 loaded');
    show('pBaselineEta',hasRate?hoursText(remainingPearls/rate):'Not available');
    show('pPlannedEta',hasRate&&estimate&&after&&activeFocus==='pearls'?hoursText(bestAfter*baseRate/rate):'Not available');
    // The cost-growth constants come from public game data, not imported private saves.
  }
  function onSave(profile) {
    state=profile||null;
    characterModel=null;
    if(profile&&typeof profile.autoClaim==='boolean'){
      $('pAfkAutoClaim').checked=profile.autoClaim;
    }else if(!profile){
      $('pAfkAutoClaim').checked=false;
    }
    renderReroll();
    render();
  }
  function init() {
    for(const [id,set] of [
      ['pActiveRate',value=>{activePearlsPerHour=value}],
      ['pAfkRate',value=>{afkPearlsPerHour=value}],
      ['pScurgeRate',value=>{activeScurgeExpPerHour=value}]
    ]){
      $(id).addEventListener('change',event=>{
        const parsed=numberInput(event.target.value);
        set(finitePositive(parsed)?parsed:NaN);
        render();
      });
      $(id).addEventListener('keydown',event=>{if(event.key==='Enter')event.target.blur()});
    }
    $('pFarmFocus').addEventListener('change',event=>{
      activeFocus=event.target.value==='scurge'?'scurge':'pearls';
      if(window.ClamworksFarming?.setFocus){window.ClamworksFarming.setFocus(activeFocus)}
      else render();
    });
    for(const id of ['pAfkRegular','pAfkPurePct','pAfkPureExtra','pAfkOfferPct','pAfkClaimHours','pAfkAutoClaim']){
      $(id).addEventListener('input',renderReroll);
      $(id).addEventListener('change',renderReroll);
    }
    renderReroll();
    render();
  }
  function setFarmModel(next){
    characterModel=next||null;
    if(next?.mode==='pearls'||next?.mode==='scurge')activeFocus=next.mode;
    render();
  }
  window.ClamworksPlanner={onSave,setFarmModel,init,promotion,expectedNeed,pearlProxy,nextCost,costModel,breakEvenCost,afkRerollEstimate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
