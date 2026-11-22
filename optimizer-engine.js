/* Clamworks Lab — independent promotion and Scurge decision engine.
 * Game-data cost and bonus formulas cross-checked with Idleon Toolbox.
 * No remote data, save uploads or third-party executable code.
 * All farming forecasts are relative scenarios unless an observed rate is supplied.
 */
(function(root){
  'use strict';
  const NAMES=['Pearl Value','Clam Comrades','Lucky Day','Multi-Scalping',
    'Frugality','Pure Pearls','Encystation Up','Shinier Pearls','Anti Inflation'];
  const SCURGE=['Reckoning','Pearl Infection','Self Affliction',
    'Cost Dissolving','Even Better','Cross Culting','Gravestart','Swarming','True Scurge'];
  const UNLOCKS=[0,5,10,25,50,100,250,500,1000];
  const GROWTH=[1.2,5,1.5,1.4,1.15,1.5,1.35,1.25,1.22];
  const isNum=x=>typeof x==='number'&&Number.isFinite(x);
  const positive=x=>isNum(x)&&x>0;
  const safeNum=(n,fallback=0)=>isNum(n)?n:fallback;
  const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
  const array9=v=>Array.from({length:9},(_,i)=>Math.max(0,Math.floor(Number(v?.[i])||0)));
  const estimate=profile=>({worker:Math.max(0,Number(profile.worker)||0),
    scurgeLevel:Math.max(0,Number(profile.scurge??profile.scurgeLevel)||0),
    levels:array9(profile.pearlLevels),scurge:array9(profile.scurgeLevels),
    balance:Math.max(0,Number(profile.pearls)||0),
    unlocked:Math.max(0,Number(profile.pearlUnlocked)||0)});
  function promotion(worker){
    return {cost:1e5*Math.pow(10,worker),chance:0.5/(2+worker),
      expectedAttempts:2*(2+worker),expectedCost:2*(2+worker)*1e5*Math.pow(10,worker)};
  }
  function need(balance,cost,chance){
    if(!isNum(balance)||balance<0||!positive(cost)||!positive(chance)||chance>1)return null;
    if(balance<cost)return cost/chance-balance;
    const n=Math.floor(balance/cost),rem=balance-n*cost;
    return Math.pow(1-chance,n)*(cost/chance-rem);
  }
  function cost(worker,levels,scurge,index){
    const p=array9(levels),s=array9(scurge),i=Number(index),lv=p[i];
    if(!Number.isInteger(i)||i<0||i>8||!Number.isInteger(lv))return null;
    const discount=(1+0.12*p[4])*(1+0.25*s[3])*(1+0.1*s[i]*s[5])*(1+0.16*p[8]);
    const raw=i===0? Math.pow(GROWTH[i],lv)+3*lv+Math.pow(lv,2.5):
      4*Math.pow(10+3*worker,i-1)*Math.pow(GROWTH[i],lv)+2*lv+Math.pow(lv,1.5);
    const answer=raw/discount;
    return positive(answer)?answer:null;
  }
  function benefit(levels,scurge,worker,rank,multikill,clamExponent=1){
    const p=array9(levels),s=array9(scurge);
    if(!isNum(worker)||!isNum(rank))return null;
    const knownMk=isNum(multikill)&&multikill>=0;
    if(!knownMk&&p[3]>0)return null;
    const mk=knownMk?multikill:0;
    const pearlValue=(1+p[0])*(1+(mk/1000)*p[3]/100)*(1+0.1*p[7])*
      (1+0.5*s[1])*(1+0.1*s[8]*rank);
    const chance10=(3*p[2])/(100+3*p[2]);
    const dropScale=(1+0.1*p[6])*Math.pow(0.66,worker);
    const pearlChance=0.005*dropScale;
    const pureChance=p[5]>0?0.000025*dropScale:0;
    const pureValue=50+50*p[5];
    const clams=Math.min(25,2+p[1]);
    const throughput=Math.pow(clams/2,clamExponent);
    const value=throughput*pearlValue*(1+9*chance10)*(pearlChance+pureChance*pureValue);
    return positive(value)?value:null;
  }
  // Relative model: a source is a baseline rate, a multikill, and a weight.
  // Without measured income we use one neutral source to compare *relative*
  // decisions; Multi-Scalping is then excluded rather than guessed.
  function production(levels,scurge,worker,rank,options={}){
    const alpha=isNum(options.clamExponent)?clamp(options.clamExponent,0,1):1;
    const sources=Array.isArray(options.sources)&&options.sources.length?
      options.sources:[{weight:1,multikill:null}];
    let total=0,knownMk=true;
    for(const source of sources){
      const w=Number(source.weight);
      if(!positive(w))continue;
      const value=benefit(levels,scurge,worker,rank,source.multikill,alpha);
      if(value===null){
        if(array9(levels)[3]>0 && !isNum(source.multikill)){
          // Unknown constant existing MK factor: this is a neutral proxy for
          // non-MK upgrades, not a pretend complete payoff forecast.
          const old=array9(levels);old[3]=0;
          const neutral=benefit(old,scurge,worker,rank,0,alpha);
          if(neutral===null)return null;
          knownMk=false;total+=w*neutral;continue;
        }
        return null;
      }
      total+=w*value;
    }
    return {value:positive(total)?total:null,knownMk,assumptions:{
      clamExponent:alpha,relative:true,sourceCount:sources.length}};
  }
  function ready(profile,levels,index){
    if(index===1 && levels[index]>=23)return false; // 2 baseline + 23 = 25 clams
    return levels[index]>0||index<=profile.unlocked;
  }
  function sourceSupport(options,profile){
    const sources=options.sources||[];
    const candidates=sources.filter(s=>positive(s.weight));
    const usedNeutral=candidates.length===0;
    const haveMK=candidates.length>0&&candidates.every(s=>isNum(s.multikill)&&s.multikill>=0);
    const mkUseful=haveMK&&candidates.some(s=>s.multikill>0);
    return {usedNeutral,haveMK,mkUseful};
  }
  function planPearls(rawProfile,options={}){
    if(!rawProfile)return null;
    const p=estimate(rawProfile),promo=promotion(p.worker);
    const support=sourceSupport(options,p);
    const base=production(p.levels,p.scurge,p.worker,p.scurgeLevel,options);
    if(!base||!positive(base.value)||!positive(promo.cost))return null;
    const absoluteRate=positive(options.observedRate)?options.observedRate:null;
    const basePerHour=absoluteRate||base.value;
    // If actual income is unknown, times are expressed as uncalibrated units.
    // The best action and relative improvement remain invariant to multiplying
    // all rate estimates by a common constant.
    const normalizedRate=levels=>{
      const r=production(levels,p.scurge,p.worker,p.scurgeLevel,options);
      return r&&positive(r.value)?r.value/base.value*basePerHour:null;
    };
    const score=(elapsed,balance,rate)=>{
      const left=need(balance,promo.cost,promo.chance);
      return left===null||!positive(rate)?Infinity:elapsed+left/rate;
    };
    const initial={levels:p.levels.slice(),balance:p.balance,elapsed:0,rate:basePerHour,
      score:score(0,p.balance,basePerHour),history:[]};
    let best=initial, frontier=[initial],firstActions=[],visited=0;
    const depth=clamp(Math.floor(options.depth??14),1,32);
    const width=clamp(Math.floor(options.width??48),1,120);
    const minimum=positive(options.minImprovement)?options.minImprovement:1e-12;
    for(let turn=0;turn<depth;turn++){
      const candidates=[];
      const seen=new Set();
      for(const current of frontier){
        for(let i=0;i<9;i++){
          if(i===3&&!support.haveMK)continue;
          if(!ready(p,current.levels,i))continue;
          const price=cost(p.worker,current.levels,p.scurge,i);
          if(!positive(price))continue;
          // Upgrades more expensive than 3x the expected total promotion spend
          // cannot pay off before this promotion under this finite horizon.
          if(price>3*promo.expectedCost)continue;
          const newLevels=current.levels.slice();newLevels[i]++;
          const nextRate=normalizedRate(newLevels);
          if(!positive(nextRate))continue;
          const waiting=Math.max(0,price-current.balance)/current.rate;
          const afterBalance=Math.max(0,current.balance-price);
          const elapsed=current.elapsed+waiting;
          const s=score(elapsed,afterBalance,nextRate);
          const key=newLevels.join(',');
          if(seen.has(key))continue;
          seen.add(key);
          const action={index:i,name:NAMES[i],from:current.levels[i],to:newLevels[i],
            cost:price,waitHours:absoluteRate===null?null:waiting,
            rateGainPct:100*(nextRate/current.rate-1)};
          const row={levels:newLevels,balance:afterBalance,elapsed,
            history:current.history.concat([action]),rate:nextRate,score:s};
          visited++;
          if(turn===0)firstActions.push(row);
          if(s<best.score-minimum)best=row;
          if(s<=initial.score*1.25)candidates.push(row);
        }
      }
      if(!candidates.length)break;
      candidates.sort((a,b)=>a.score-b.score);
      frontier=candidates.slice(0,width);
    }
    firstActions.sort((a,b)=>a.score-b.score);
    const benefitPct=initial.score>0?Math.max(0,100*(initial.score-best.score)/initial.score):0;
    return {goal:'next-promotion',promotion:promo,best,baseline:initial.score,
      bestAbsoluteHours:absoluteRate!==null?best.score:null,
      baselineAbsoluteHours:absoluteRate!==null?initial.score:null,
      relativeImprovementPct:benefitPct,baseProduction:base.value,
      calibrated:absoluteRate!==null,modelClamExponent:base.assumptions.clamExponent,
      support,firstActions,visited,depth,width,profile:p};
  }
  // Break-even purchase price for one upgrade at the current promotion,
  // holding the *resulting* production multiplier constant after purchase.
  function singleBuyCutoff(balance,promotionInfo,gainFactor){
    const r=Number(gainFactor);
    if(!positive(r)||r<=1)return 0;
    const c=promotionInfo?.cost,chance=promotionInfo?.chance;
    const base=need(balance,c,chance);
    if(base===null)return null;
    const after=price=>{
      const wait=Math.max(0,price-balance);
      const remain=Math.max(0,balance-price);
      const tail=need(remain,c,chance);
      return tail===null?Infinity:wait+tail/r;
    };
    let lo=0,hi=Math.max(1,balance,c/chance);
    while(after(hi)<base&&hi<Number.MAX_VALUE/10)hi*=2;
    if(!Number.isFinite(hi))return null;
    for(let k=0;k<65;k++){
      const middle=(lo+hi)/2;
      if(after(middle)<=base)lo=middle;else hi=middle;
    }
    return lo;
  }
  function expireModel(current,improvement){
    return !positive(current)||!positive(improvement)?null:current/improvement;
  }
  function marginalScurge(s,p,idx,mode,otherPlayers){
    const after=s.slice();after[idx]++;
    const value=x=>(1+0.5*x[1])*(1+0.1*x[8]*p.scurgeLevel);
    const exp=x=>(1+x[0])*(1+2*x[2])*(1+1.5*x[4])*(1+0.1*x[7]*otherPlayers);
    const purchaseScale=x=>(1+0.25*x[3])*
      (1+0.1*x[5]*Math.max(0,x.reduce((n,v,i)=>n+(p.levels[i]||0),0)/9));
    const pearl=Math.log(value(after)/value(s));
    const xp=Math.log(exp(after)/exp(s));
    const discount=Math.log(purchaseScale(after)/purchaseScale(s));
    if(mode==='exp')return xp;
    if(mode==='cost')return discount;
    if(mode==='balanced')return 0.6*pearl+0.4*xp+0.1*discount;
    return pearl;
  }
  // Evaluate a *single* additional Scurge Point using the same next-promotion
  // purchase model as the Pearl planner. Unlike a raw Pearl-value multiplier,
  // this compares Cost Dissolving and Cross Culting against Pearl Infection.
  // EXP-only upgrades are excluded from this one-promotion horizon.
  function comparePromotionScurge(rawProfile,options={}){
    if(!rawProfile)return null;
    const p=estimate(rawProfile);
    const baseLevels=array9(options.scurgeLevels||p.scurge);
    const strategy={sources:options.sources||[],clamExponent:options.clamExponent??0.5,
      depth:options.depth??14,width:options.width??45};
    const profile={...rawProfile,scurge:p.scurgeLevel,scurgeLevels:baseLevels};
    const baseline=planPearls(profile,strategy);
    if(!baseline||!positive(baseline.best.score))return null;
    const candidates=[];
    for(const index of [1,3,5,8]){
      if(p.scurgeLevel<UNLOCKS[index])continue;
      const upgraded=baseLevels.slice();upgraded[index]++;
      const plan=planPearls({...profile,scurgeLevels:upgraded},strategy);
      if(!plan)continue;
      candidates.push({
        index,name:SCURGE[index],
        score:plan.best.score,
        gainPct:100*(1-plan.best.score/baseline.best.score),
        recommendedPearlBuys:plan.best.history.length,
        firstPurchase:plan.best.history[0]?.name||null
      });
    }
    candidates.sort((a,b)=>a.score-b.score);
    return {level:p.scurgeLevel,baseline:baseline.best.score,candidates,
      winner:candidates[0]||null,model:'next-promotion-relative'};
  }
  function optimizeScurge(rawProfile,options={}){
    if(!rawProfile)return null;
    const p=estimate(rawProfile),s=p.scurge.slice();
    const free=Math.max(0,Math.floor(p.scurgeLevel-s.reduce((a,b)=>a+b,0)));
    const mode=['promotion','pearls','exp','cost','balanced'].includes(options.mode)?options.mode:'pearls';
    const near=clamp(Number(options.otherPlayers)||0,0,50);
    const maxDamage=options.maxDamage;
    const maxAffliction=options.maxAffliction??null;
    const moves=[];
    const initial=s.slice();
    let unsafeExcluded=false;
    const hp=1e16*Math.pow(30,p.worker);
    const maxPoints=mode==='promotion'?Math.min(free,12):free;
    for(let k=0;k<maxPoints;k++){
      if(mode==='promotion'){
        const comparison=comparePromotionScurge({...rawProfile,scurge:p.scurgeLevel,scurgeLevels:s},{
          ...options,scurgeLevels:s
        });
        const candidate=comparison?.winner;
        if(!candidate||candidate.gainPct<=1e-9)break;
        s[candidate.index]++;
        moves.push(candidate.index);
        continue;
      }
      let winner=null;
      for(let i=0;i<9;i++){
        if(p.scurgeLevel<UNLOCKS[i])continue;
        if(mode==='exp'&&i===2){
          // Only add a level when a known, currently measured on-map max
          // damage remains >= monster HP after /100. Never assume one-shot.
          const explicitlyAllowed=maxAffliction!==null&&s[2]+1<=maxAffliction;
          const damageSafe=positive(maxDamage)&&maxDamage/Math.pow(100,s[2]-initial[2]+1)>=hp;
          if(!explicitlyAllowed||!damageSafe){unsafeExcluded=true;continue;}
        }
        if(mode!=='exp'&&i===2)continue;
        const delta=marginalScurge(s,p,i,mode,near);
        if(!isNum(delta)||delta<=1e-15)continue;
        if(!winner||delta>winner.gain)winner={index:i,gain:delta};
      }
      if(!winner)break;
      s[winner.index]++;moves.push(winner.index);
    }
    const distribution=Array.from({length:9},(_,i)=>({
      index:i,name:SCURGE[i],from:initial[i],to:s[i],delta:s[i]-initial[i],
      unlocked:p.scurgeLevel>=UNLOCKS[i]}));
    return {mode,free,spent:moves.length,unspent:free-moves.length,allocation:s,
      distribution,unsafeExcluded,otherPlayers:near,moves,
      searchLimited:mode==='promotion'&&free>12&&moves.length===12};
  }
  // Preview of where the very next earned Scurge Point would go.
  // It does not grant the point before the required level is reached.
  function previewNextScurge(rawProfile,options={}){
    if(!rawProfile)return null;
    const p=estimate(rawProfile),spent=p.scurge.reduce((a,b)=>a+b,0);
    const atLevel=Math.max(p.scurgeLevel+1,spent+1);
    const model={...rawProfile,scurge:atLevel,scurgeLevel:atLevel,
      scurgeLevels:p.scurge.slice(),pearlLevels:p.levels.slice()};
    if(options.mode==='promotion'){
      const comparison=comparePromotionScurge(model,options);
      const first=comparison?.winner;
      return first&&first.gainPct>1e-9?{level:atLevel,index:first.index,name:first.name,
        availableAtLevel:atLevel,goal:'promotion',gainPct:first.gainPct,
        alternatives:comparison.candidates}:null;
    }
    const result=optimizeScurge(model,options);
    const first=result?.moves[0];
    return Number.isInteger(first)?{level:atLevel,index:first,name:SCURGE[first],
      availableAtLevel:atLevel,goal:result.mode}:null;
  }
  // Compare taking a break to earn ONE Scurge level against farming Pearls.
  // Assumes the selected new point boosts all Pearl-value payouts but does not
  // change combat throughput; modes that alter damage/cost cannot use this rule.
  function switchToScurge(rawProfile,{
    activePearlsPerHour,afkPearlsPerHour,scurgeExpPerHour=null,nextPoint=null
  }={}){
    if(!rawProfile||!positive(activePearlsPerHour)||!isNum(afkPearlsPerHour)||
      afkPearlsPerHour<0||!nextPoint||![1,8].includes(nextPoint.index)){
      return {available:false,reason:'Requires separate measured active Pearl/hr and AFK Pearl/hr, and a next-point allocation that raises Pearl value.'};
    }
    const p=estimate(rawProfile),promo=promotion(p.worker);
    const nextLv=p.scurgeLevel,expReq=(50+15*nextLv)*Math.pow(1.08,nextLv);
    const currentXp=Number(rawProfile.scurgeExp);
    if(!Number.isFinite(expReq)||!Number.isFinite(currentXp)||currentXp<0){
      return {available:false,reason:'Current Scurge EXP is missing or invalid.'};
    }
    const remaining=Math.max(0,expReq-currentXp);
    if(remaining<=0)return {available:false,reason:'The next Scurge level is already ready.'};
    const after=p.scurge.slice();after[nextPoint.index]++;
    const pearlBonus=s=>(1+0.5*s[1])*(1+0.1*s[8]*p.scurgeLevel);
    const bonus=pearlBonus(after)/pearlBonus(p.scurge);
    if(!(bonus>1))return {available:false,reason:'Next point does not increase Pearl value.'};
    const baselineRate=activePearlsPerHour+afkPearlsPerHour;
    const baselineNeed=need(p.balance,promo.cost,promo.chance);
    const baselineTime=baselineNeed/baselineRate;
    if(!positive(baselineTime))return {available:false,reason:'No meaningful remaining promotion farming time.'};
    const scenario=hours=>{
      const earnedPearls=p.balance+afkPearlsPerHour*hours;
      const afterNeed=need(earnedPearls,promo.cost,promo.chance);
      const end=hours+afterNeed/(baselineRate*bonus);
      return end;
    };
    let lo=0,hi=baselineTime;
    for(let i=0;i<65;i++){
      const mid=(lo+hi)/2;
      if(scenario(mid)<baselineTime)lo=mid;else hi=mid;
    }
    const maxHours=lo;
    const neededExpPerHour=maxHours>0?remaining/maxHours:null;
    const expKnown=positive(scurgeExpPerHour);
    const scurgeHours=expKnown?remaining/scurgeExpPerHour:null;
    const optimizedTime=scurgeHours===null?null:scenario(scurgeHours);
    const timeSaved=optimizedTime===null?null:baselineTime-optimizedTime;
    return {available:true,nextPoint:nextPoint.name,bonus,
      remainingExp:remaining,baselineHours:baselineTime,
      maxProfitableHours:maxHours,minimumExpPerHour:neededExpPerHour,
      scurgeHours,optimizedHours:optimizedTime,timeSavedHours:timeSaved,
      worthwhile:timeSaved===null?null:timeSaved>0,
      assumptions:'Active Pearl farming stops during Scurge leveling; AFK income continues. Pearl-value gain applies to all characters; combat throughput held constant.'};
  }
  function milestones(worker,target=12){
    const out=[];
    for(let lv=Math.max(0,worker);lv<target;lv++){
      const p=promotion(lv);out.push({from:lv,to:lv+1,...p,
        resetsTemporaryUpgrades:true});
    }
    return out;
  }
  const api={NAMES,SCURGE,UNLOCKS,GROWTH,promotion,need,cost,benefit,production,
    planPearls,optimizeScurge,comparePromotionScurge,previewNextScurge,switchToScurge,milestones,sourceSupport,singleBuyCutoff};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ClamworksOptimization=api;
})(typeof window!=='undefined'?window:null);
