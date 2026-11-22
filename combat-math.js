/* Clamworks Lab — independently authored, game-formula combat/Scurge math.
   Source mechanics cross-checked against Idleon Toolbox's Clamwork and damage
   parsers. The exported save does not contain calculated per-character damage,
   multikill base/per-tier, or actual combat kills/hour, so these are explicitly
   optional calibration inputs rather than silently invented account statistics.
*/
(function(root) {
  'use strict';
  const n = x => x===undefined||x===null||String(x).trim()===''?null:
    Number.isFinite(Number(x))?Number(x):null;
  const finite = x => typeof x==='number'&&Number.isFinite(x)&&x>=0;
  const money = x => finite(x)?x:null;
  function monsterHP(worker) {
    if(!finite(worker))return null;
    return money(1e16*Math.pow(30,worker));
  }
  function w7Multikill(raw) {
    if(!finite(raw))return null;
    if(raw<20)return raw;
    if(raw<50)return 20+(raw-20)/1.1;
    if(raw<100)return 47.3+(raw-50)/1.5;
    if(raw<150)return 80.6+(raw-100)/5;
    if(raw<200)return 90.6+(raw-150)/10;
    if(raw<250)return 95.6+(raw-200)/20;
    return 98.14+(raw-250)/50;
  }
  function damageForTier(hp,tier) {
    if(!finite(hp)||hp<=0||!Number.isInteger(tier)||tier<2||tier>51)return null;
    const required=hp*Math.pow(5,tier);
    return Number.isFinite(required)?required:null;
  }
  function overkill(maxDamage,hp){
    if(!finite(maxDamage)||!finite(hp)||hp<=0)return null;
    let tier=1;
    // For World 7, tier two starts at monster HP times 5^2, and each
    // following tier multiplies that threshold by 5. Tiers are capped at 51.
    for(let t=2;t<=51;t++){
      const req=damageForTier(hp,t);
      if(req!==null&&maxDamage>=req)tier=t;else break;
    }
    return {tier,nextDamage:damageForTier(hp,tier+1),
      currentThreshold:tier===1?0:damageForTier(hp,tier),
      hp,maximum:tier===51};
  }
  function multikill({maxDamage,rawBase,rawPerTier,worker}){
    const hp=monsterHP(worker), overkillInfo=overkill(n(maxDamage),hp);
    const base=w7Multikill(n(rawBase)),perTier=w7Multikill(n(rawPerTier));
    if(!overkillInfo)return {known:false,hp,tier:null,rawBase:n(rawBase),
      rawPerTier:n(rawPerTier),base,perTier,total:null,nextDamage:null,
      reason:'Enter max damage for the selected character to calculate Clamworks overkill tier.'};
    const known=base!==null&&perTier!==null;
    return {known,hp,tier:overkillInfo.tier,rawBase:n(rawBase),
      rawPerTier:n(rawPerTier),base,perTier,total:known?
        Math.floor(base+overkillInfo.tier*perTier):null,
      nextDamage:overkillInfo.nextDamage,currentThreshold:overkillInfo.currentThreshold,
      reason:known?'':'The save does not expose final multikill-base and multikill-per-tier values; supply those to derive total multikill.'};
  }
  function scurgeExpRequired(level){
    if(!finite(level))return null;
    const v=(50+15*level)*Math.pow(1.08,level);
    return Number.isFinite(v)?v:null;
  }
  function scurgeMultiplier(levels,otherPlayers=0){
    if(!Array.isArray(levels)||levels.length<9||!finite(otherPlayers))return null;
    const s=levels.map(x=>n(x));
    if(s.some(x=>!finite(x)))return null;
    // Scurge EXP per physical Clamworks kill (not Kill-per-Kill credited kills).
    return (1+s[0])*(1+2*s[2])*(1+1.5*s[4])*(1+0.1*s[7]*otherPlayers);
  }
  function scurgeProjection(account,options={}){
    if(!account)return null;
    const lv=n(account.scurgeLevel),exp=n(account.scurgeExp);
    const req=scurgeExpRequired(lv);
    const otherPlayers=n(options.otherPlayers)??0;
    const perKill=scurgeMultiplier(account.scurgeLevels,otherPlayers);
    const kills=n(options.killsPerHour);
    const rate=perKill!==null&&finite(kills)?kills*perKill:null;
    const expKnown=finite(exp);
    const toNext=expKnown&&req!==null?Math.max(0,req-exp):null;
    const hours=rate!==null&&rate>0&&toNext!==null?toNext/rate:null;
    return {level:lv,exp:expKnown?exp:null,requirement:req,toNext,
      expPerKill:perKill,expPerHour:rate,hoursToNext:hours,
      otherPlayers,uncertain:!expKnown||rate===null,source:'save+combat calibration'};
  }
  const api={monsterHP,w7Multikill,damageForTier,overkill,multikill,
    scurgeExpRequired,scurgeMultiplier,scurgeProjection};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ClamworksCombatMath=api;
})(typeof window!=='undefined'?window:null);
