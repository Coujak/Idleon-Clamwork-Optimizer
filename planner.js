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
  function afkRerollEstimate({
    regular,pureChance,pureExtra,offerChance,hours,autoClaim=false,
    replacementRegular=null,replacementPureChance=null,replacementPureExtra=null
  }) {
    // Markov model: keep claims containing Pure; each other claim has probability q
    // of being discarded and replaced. Replacements can have different loot tables.
    // Expected regular payouts are unconditional over a claim's drop distribution.
    const r0=regular,p0=pureChance,v0=pureExtra,q=autoClaim?0:offerChance;
    const rr=Number.isFinite(replacementRegular)?replacementRegular:r0;
    const pr=Number.isFinite(replacementPureChance)?replacementPureChance:p0;
    const vr=Number.isFinite(replacementPureExtra)?replacementPureExtra:v0;
    if(![r0,p0,v0,q,hours,rr,pr,vr].every(Number.isFinite)||
      r0<0||v0<0||rr<0||vr<0||hours<=0||p0<0||p0>1||
      pr<0||pr>1||q<0||q>1)return null;
    const base=r0+p0*v0;
    if(q===0||p0===1)return {base,withRerolls:base,probability:p0,gain:0,
      extraPerHour:0,expectedRerolls:0,replacementDistinct:rr!==r0||pr!==p0||vr!==v0};
    const denom=1-q*(1-pr);
    if(denom<=1e-15)return null; // Endless replacement loop without Pure reward.
    const rerolledExpected=rr+(pr*vr)/denom;
    const end=base+q*(1-p0)*(rerolledExpected-r0);
    const chance=p0+q*(1-p0)*pr/denom;
    const rolls=q*(1-p0)/denom;
    return {base,withRerolls:end,probability:chance,
      gain:end-base,extraPerHour:(end-base)/hours,
      expectedRerolls:rolls,replacementDistinct:rr!==r0||pr!==p0||vr!==v0};
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
      autoClaim:document.getElementById('pAfkAutoClaim').checked,
      replacementRegular:read('pAfkReplacementRegular')===''?null:amount('pAfkReplacementRegular'),
      replacementPureChance:read('pAfkReplacementPurePct')===''?null:pct('pAfkReplacementPurePct'),
      replacementPureExtra:read('pAfkReplacementExtra')===''?null:amount('pAfkReplacementExtra')
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
  function effectiveMode(){
    const value=$('pScurgeGoal')?.value||'auto';
    return value==='auto'?(activeFocus==='scurge'?'exp':'pearls'):value;
  }
  function selectedRates(){
    const activeSelected=characterModel&&finite(characterModel.activePearlsPerHour)?
      characterModel.activePearlsPerHour:activePearlsPerHour;
    const afkSelected=characterModel&&finite(characterModel.afkPearlsPerHour)?
      characterModel.afkPearlsPerHour:afkPearlsPerHour;
    const active=activeFocus==='pearls'&&finitePositive(activeSelected)?activeSelected:0;
    const afk=finitePositive(afkSelected)?afkSelected:0;
    const covered=!characterModel||characterModel.coverage===1||
      finitePositive(afkPearlsPerHour);
    return {active,afk,total:active+afk,known:covered&&finitePositive(active+afk)};
  }
  function productionSources(engine){
    if(!engine)return [];
    const p=state,chosen=characterModel;
    const sourceRows=chosen?.sources;
    if(Array.isArray(sourceRows)&&sourceRows.length){
      const entries=[];
      let missing=false;
      for(const row of sourceRows){
        const mk=Number.isFinite(row.multikill)&&row.multikill>=0?row.multikill:null;
        if(row.id==='unmeasured-afk'){missing=true;continue;}
        const raw=engine.benefit(p.pearlLevels,p.scurgeLevels,p.worker,p.scurge,mk,1);
        if(Number.isFinite(row.pearlsPerHour)&&row.pearlsPerHour>0){
          // Reweight from observed total pearl yield to relative kill throughput.
          entries.push({weight:row.pearlsPerHour/(raw||1),multikill:mk});
        }else if(Number.isFinite(row.killsPerHour)&&row.killsPerHour>0){
          entries.push({weight:row.killsPerHour,multikill:mk});
        }
      }
      if(missing||entries.length){
        if(missing)entries.push({weight:1,multikill:null});
        return entries;
      }
    }
    return [{weight:1,multikill:Number.isFinite(chosen?.activeMultikill)?
      chosen.activeMultikill:null}];
  }
  function relativeGainFor(engine,base,levels,options){
    const next=engine.production(levels,state.scurgeLevels,state.worker,state.scurge,options);
    if(!next||!next.value||!base?.value)return null;
    return next.value/base.value;
  }
  // Merge only adjacent purchases of the same upgrade. Interleaved purchases
  // must remain separate because discounts and purchase prices depend on order.
  function groupPurchaseSteps(steps) {
    const groups=[];
    for(const step of Array.isArray(steps)?steps:[]){
      const previous=groups[groups.length-1];
      const sameRun=previous&&previous.index===step.index&&previous.to===step.from;
      const gain=1+(Number(step.rateGainPct)||0)/100;
      if(sameRun){
        previous.to=step.to;
        previous.count++;
        previous.cost+=step.cost;
        previous.gainFactor*=gain;
      }else{
        groups.push({index:step.index,name:step.name,from:step.from,to:step.to,
          count:1,cost:step.cost,gainFactor:gain});
      }
    }
    return groups.map(({gainFactor,...row})=>({
      ...row,rateGainPct:100*(gainFactor-1)
    }));
  }
  function render() {
    if(!state){
      ['pWorker','pPearls','pPromoCost','pPromoChance','pAttempts','pExpected',
        'pExpectedNeed','pEta','pCurrentRate','pBaselineEta','pPlannedEta',
        'pModeledRateChange','pScurgeActiveRate'].forEach(id=>show(id,'—'));
      $('pOutcome').textContent='Import a save to calculate your next promotion.';
      $('pPearlRows').innerHTML='';
      $('pScurgeRows').innerHTML='';
      $('pStrategy').textContent='Import an IT JSON export to begin.';
      if($('pPlanSteps'))$('pPlanSteps').innerHTML='';
      if($('pScurgeSwitch'))$('pScurgeSwitch').textContent='Import an IT JSON to compare Pearl farming with Scurge leveling.';
      if($('pAvailableScurge'))show('pAvailableScurge','—');
      if($('pScurgeEta'))show('pScurgeEta','—');
      return;
    }
    const engine=window.ClamworksOptimization;
    const promo=promotion(state.worker);
    const rateInfo=selectedRates();
    const remainingPearls=expectedNeed(state.pearls,promo.cost,promo.chance);
    const calibrated=rateInfo.known;
    const rawAlpha=$('pClamScaling')?.value;
    const alpha=rawAlpha!==undefined?Number(rawAlpha):0.5;
    const sources=productionSources(engine);
    const options={sources,clamExponent:alpha,
      observedRate:calibrated?rateInfo.total:null,depth:16,width:55};
    const estimate=engine?.planPearls(state,options)||null;
    const scurgeMode=effectiveMode();
    const rawMax=$('pMaxAffliction')?.value?.trim()??'';
    const maxAffliction=rawMax!==''?Number(rawMax):null;
    const scurge=engine?.optimizeScurge(state,{mode:scurgeMode,
      otherPlayers:characterModel?.otherPlayers??0,
      maxDamage:characterModel?.onMapDamage??null,
      maxAffliction:Number.isSafeInteger(maxAffliction)&&maxAffliction>=0?
        maxAffliction:null})||null;
    const nextScurge=engine?.previewNextScurge(state,{
      mode:scurgeMode,otherPlayers:characterModel?.otherPlayers??0,
      maxDamage:characterModel?.onMapDamage??null,
      maxAffliction:Number.isSafeInteger(maxAffliction)&&maxAffliction>=0?
        maxAffliction:null})||null;
    // When the selected character is farming Pearls, their incidental Scurge
    // kills are NOT the measured Scurge specialist's active EXP/hour.
    const xpRate=activeFocus==='scurge'&&characterModel&&finitePositive(characterModel.activeScurgeExpPerHour)?
      characterModel.activeScurgeExpPerHour:activeScurgeExpPerHour;
    show('pWorker','Class '+state.worker+' → '+(state.worker+1));
    show('pPearls',fmt(state.pearls));
    show('pPromoCost',fmt(promo.cost));
    show('pPromoChance',(100*promo.chance).toFixed(2)+'%');
    show('pAttempts',promo.expectedAttempts.toFixed(1));
    show('pExpected',fmt(promo.expectedCost));
    show('pExpectedNeed',fmt(remainingPearls));
    show('pEta',calibrated?hoursText(remainingPearls/rateInfo.total):'Rate calibration needed');
    show('pCurrentRate',calibrated?fmt(rateInfo.total)+'/hr':'Relative model only');
    show('pScurgeActiveRate',finitePositive(xpRate)?fmt(xpRate)+'/hr':'Not supplied');
    show('pFarmMode',(characterModel?.selectedName||'Selected character')+
      (activeFocus==='pearls'?': active pearls + eligible AFK':': active Scurge + eligible AFK'));
    show('pTotalCosted','9 / 9 verified formulas');
    const nextXP=characterModel?.activeScurgeHoursToNext;
    show('pScurgeEta',finite(nextXP)?hoursText(nextXP):'Kills/hr needed');
    show('pNextScurge',nextScurge?
      ('Lv'+nextScurge.level+' → '+nextScurge.name):'No available next-point allocation');
    const pearlActive=finitePositive(activePearlsPerHour)?activePearlsPerHour:
      (activeFocus==='pearls'&&finitePositive(characterModel?.activePearlsPerHour)?
        characterModel.activePearlsPerHour:null);
    const pearlAfk=finitePositive(afkPearlsPerHour)?afkPearlsPerHour:
      (characterModel?.coverage===1&&finite(characterModel?.afkPearlsPerHour)?
        characterModel.afkPearlsPerHour:null);
    const compareScurge=engine?.switchToScurge(state,{
      activePearlsPerHour:pearlActive,
      afkPearlsPerHour:pearlAfk,
      scurgeExpPerHour:finitePositive(xpRate)?xpRate:null,
      nextPoint:engine?.previewNextScurge(state,{mode:'pearls'})||null
    });
    if($('pScurgeSwitch')){
      if(!compareScurge?.available){
        $('pScurgeSwitch').textContent='Scurge vs Pearl farming: enter separate observed active Pearl/hr, AFK Pearl/hr, and optionally Scurge EXP/hr to compare farming your next Scurge Point. '+(compareScurge?.reason||'');
      }else if(compareScurge.worthwhile===null){
        $('pScurgeSwitch').textContent='Scurge vs Pearl farming: earn the next Pearl-value point ('+compareScurge.nextPoint+') only if your Scurge EXP rate is at least '+fmt(compareScurge.minimumExpPerHour)+'/hr. This would take no more than '+hoursText(compareScurge.maxProfitableHours)+'. Add the measured Scurge EXP/hr to get a recommendation.';
      }else{
        $('pScurgeSwitch').textContent=(compareScurge.worthwhile?
          'Consider Scurge leveling first':'Focus on Pearls instead of Scurge right now')+
          ': the next '+compareScurge.nextPoint+' point requires '+hoursText(compareScurge.scurgeHours)+
          ' at your Scurge rate. Compared with farming Pearls continuously, the projected time change to promotion is '+
          (compareScurge.timeSavedHours>=0?'-':'+')+
          hoursText(Math.abs(compareScurge.timeSavedHours))+
          '. Assumes the same AFK roster and unchanged combat throughput.';
      }
    }
    const activeMode=activeFocus==='pearls';
    let status='',details='';
    if(state.worker>=12){
      status='Worker Class 12 reached';
      details='Your current promotion milestone is achieved. Temporary upgrades and Scurge allocations can now be optimized for long-term goals.';
    }else if(!estimate){
      status='Unable to calculate a trustworthy spending comparison';
      details='Check your imported Clamworks upgrade and promotion data.';
    }else if(estimate.best.history.length){
      const grouped=groupPurchaseSteps(estimate.best.history);
      const seq=grouped.map(row=>row.name+' Lv'+row.from+'→'+row.to+
        (row.count>1?' ('+row.count+' levels)':''));
      status='Invest before saving';
      details='Purchase sequence: '+seq.slice(0,8).join(' → ')+
        (seq.length>8?' → '+(seq.length-8)+' more groups':'')+
        '. After these purchases, save for the promotion. Modeled saving: '+
        estimate.relativeImprovementPct.toFixed(2)+'% versus saving immediately.';
    }else{
      status='Save for the next promotion';
      details='Under the selected production assumptions, no tested upgrade sequence shortens the expected time to promotion. Save pearls for each promotion attempt.';
    }
    if(scurge&&scurge.moves.length){
      const distribution=scurge.distribution.filter(d=>d.delta>0).map(d=>d.name+' +'+d.delta);
      details+=' Unspent Scurge Points: '+distribution.join(', ')+
        ' ('+scurgeMode+' objective; no existing allocations are moved).';
    }
    if(scurge?.unsafeExcluded&&scurgeMode==='exp'){
      details+=' Self Affliction was excluded without enough verified on-map damage to confirm that extra levels are safe.';
    }
    if(!calibrated)details+=' The purchase ORDER is based on relative pearl yield; absolute times require observed income.';
    if(!estimate?.support?.haveMK)details+=' Multi-Scalping is excluded until participating characters have known total multikill.';
    if(!activeMode)details+=' Pearl recommendations consider AFK income; the active character is assigned to Scurge progression.';
    $('pOutcome').textContent=status;
    $('pStrategy').textContent=details;
    if($('pPlanSteps')){
      const steps=estimate?.best?.history||[];
      if(state.worker>=12){
        $('pPlanSteps').innerHTML='';
      }else if(!steps.length){
        $('pPlanSteps').innerHTML='<div class="alloc-outcome" style="margin-top:10px">'+
          '<strong>Next action:</strong> Save for promotion. Each attempt costs '+fmt(promo.cost)+
          ' Pearls. Success resets temporary Clamworks upgrades.</div>';
      }else{
        const grouped=groupPurchaseSteps(steps);
        const totalCost=grouped.reduce((sum,row)=>sum+row.cost,0);
        $('pPlanSteps').innerHTML='<details style="margin-top:12px" open>'+
          '<summary>Recommended purchase sequence ('+grouped.length+' groups · '+
          steps.length+' levels)</summary>'+
          '<div class="alloc-scroll"><table class="alloc-table"><thead><tr><th>Step</th><th>Upgrade</th><th>Levels</th><th>Total cost</th><th>Projected yield gain</th></tr></thead><tbody>'+
          grouped.map((a,i)=>'<tr><td>'+(i+1)+'</td><td><strong>'+a.name+
            '</strong></td><td>Lv'+a.from+' → '+a.to+
            ' <span class="bubble">+'+a.count+'</span></td><td class="numeric">'+fmt(a.cost)+
            '</td><td class="numeric">+'+a.rateGainPct.toFixed(2)+'%</td></tr>').join('')+
          '</tbody></table></div><p class="alloc-note">Total planned spending: <strong>'+
          fmt(totalCost)+'</strong> Pearls across '+steps.length+' levels. '+
          'Re-import a fresh IT JSON after buying upgrades to recalculate the remaining plan. Prices and yields change after purchases and promotions.</p></details>';
      }
    }
    const intro='Decision model: game-data costs, promotion chance and reset, '+
      '16-step beam search, Clam Comrades throughput and the imported Pearl/Scurge bonuses.';
    $('pConfidence').textContent=intro+' '+
      (calibrated?'Income is calibrated to observed Pearl production. ':
        'No complete Pearl/hr rate: recommendations have relative, not absolute, timing. ')+
      'Clam Comrades assumes '+Math.round(alpha*100)+'% of ideal logarithmic mob-count scaling. '+
      'This is an approximate throughput effect, not a full combat simulation. '+
      'Pure Pearl AFK reroll behavior is not included in upgrade forecasts. '+
      'Promotions reset temporary upgrades; multi-promotion combat and rate dynamics are not fully simulated.';
    if(estimate){
      show('pModeledRateChange',estimate.relativeImprovementPct.toFixed(2)+'% faster (model)');
      show('pBaselineEta',calibrated?hoursText(estimate.baselineAbsoluteHours):'Relative only');
      show('pPlannedEta',calibrated?hoursText(estimate.bestAbsoluteHours):'Relative only');
    }else{
      show('pModeledRateChange','—');show('pBaselineEta','—');show('pPlannedEta','—');
    }
    const base=engine?.production(state.pearlLevels,state.scurgeLevels,state.worker,state.scurge,options);
    $('pPearlRows').innerHTML=PEARL.map((name,i)=>{
      const current=state.pearlLevels[i],accessible=state.pearlUnlocked>=i||current>0;
      const price=nextCost(state,state.pearlLevels,state.scurgeLevels,costModel(),i);
      const afterLevels=state.pearlLevels.slice();afterLevels[i]++;
      const cap=i===1&&current>=23;
      const ratio=relativeGainFor(engine,base,afterLevels,options);
      const improvement=estimate?.firstActions.find(row=>row.history[0]?.index===i);
      const impact=improvement&&estimate?.baseline>0?
        100*(1-improvement.score/estimate.baseline):null;
      const cutoff=!accessible||cap?'—':(i===4||i===8?'Sequence-dependent':
        (i===3&&!estimate?.support.haveMK?'Need multikill':
        ratio!==null&&ratio>1.000000001?
          fmt(engine.singleBuyCutoff(state.pearls,estimate?.promotion||promo,ratio)):'No positive gain'));
      const note=i===1?'Clam count (throughput assumption)':
        i===3?(estimate?.support.haveMK?'Character multikill modeled':'Missing participating multikill'):
        i===4||i===8?'Discounts future upgrades':'Verified cost / yield formula';
      const display=cap?'At 25-clam cap':accessible&&finite(price)?fmt(price):'Locked';
      return '<tr><td><strong>'+name+'</strong><div class="mini-note">'+note+'</div></td>'+
        '<td><span class="bubble">'+fmt(current)+'</span></td>'+
        '<td class="numeric">'+display+'</td>'+
        '<td class="numeric">'+cutoff+'</td>'+
        '<td class="numeric">'+(impact===null?'—':(impact>0?'+':'')+impact.toFixed(2)+'%')+'</td></tr>';
    }).join('');
    if(scurge){
      $('pScurgeRows').innerHTML=scurge.distribution.map(row=>'<tr><td><strong>'+
        row.name+'</strong><div class="mini-note">'+(row.unlocked?
        (row.index===2?'Damage reduction; never auto-assumed safe':
        row.index===7?'Nearby players: '+(characterModel?.otherPlayers??0):
        'Game-data bonus'):'Unlocks at Scurge Lv'+(engine.UNLOCKS[row.index]))+
        '</div></td><td><span class="bubble'+(row.from?' purple':'')+'">'+fmt(row.from)+
        '</span></td><td class="numeric">'+(row.unlocked?(row.delta?'+'+row.delta:'—'):'Locked')+'</td></tr>').join('');
      show('pAvailableScurge',scurge.free+' unspent · '+scurge.spent+' suggested');
      const rows=$('upgrades');
      if(rows)rows.innerHTML=scurge.distribution.map(row=>'<tr><td><strong>'+row.name+
        '</strong></td><td>'+engine.UNLOCKS[row.index]+'</td><td>'+
        fmt(row.from)+'</td><td>'+(row.unlocked?
        (row.delta?'Suggested +'+row.delta:'No additional points'):'Locked')+'</td></tr>').join('');
      const note=$('allocationNote');
      if(note)note.textContent='Objective: '+scurgeMode+
        '. '+scurge.free+' unspent points. Existing levels stay fixed; '+
        scurge.spent+' suggested for '+scurge.distribution.filter(d=>d.delta>0).map(d=>d.name).join(', ')+
        '. '+(nextScurge?'Next earned point (Scurge Lv'+nextScurge.level+'): '+
          nextScurge.name+'. ':'')+
        'Self Affliction requires confirmed damage before it can be considered. Nearby players are not saved in IT JSON.';
    }
  }
  function onSave(profile) {
    state=profile||null;
    characterModel=null;
    // An observed farming rate belongs to the old save/character configuration.
    // Never carry it across accounts or import revisions as if it were current.
    activePearlsPerHour=NaN;
    afkPearlsPerHour=NaN;
    activeScurgeExpPerHour=NaN;
    for(const id of ['pActiveRate','pAfkRate','pScurgeRate']){
      if($(id))$(id).value='';
    }
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
    // Re-run all recommendations as soon as modeling assumptions change.
    for(const id of ['pClamScaling','pScurgeGoal','pMaxAffliction']){
      const control=$(id);
      if(control)control.addEventListener('change',render);
    }
    for(const id of ['pAfkRegular','pAfkPurePct','pAfkPureExtra','pAfkOfferPct','pAfkClaimHours','pAfkAutoClaim',
      'pAfkReplacementRegular','pAfkReplacementPurePct','pAfkReplacementExtra']){
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
  window.ClamworksPlanner={onSave,setFarmModel,init,promotion,expectedNeed,pearlProxy,nextCost,costModel,breakEvenCost,afkRerollEstimate,groupPurchaseSteps};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
