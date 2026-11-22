/* Clamworks Lab — combat-stat extraction and transparent damage audit.
   Independently implemented from raw Idleon Toolbox export conventions and
   the public Idleon Toolbox combat breakdown. No account data leaves the browser.
   This does not pretend to resolve the full game-wide damage equation.
*/
(function(root){
  'use strict';
  const className={
    1:'Beginner',2:'Journeyman',3:'Maestro',4:'Voidwalker',
    7:'Warrior',8:'Barbarian',9:'Squire',10:'Blood Berserker',
    12:'Divine Knight',14:'Death Bringer',16:'Royal Guardian',
    19:'Archer',20:'Bowman',21:'Hunter',22:'Siege Breaker',
    25:'Beast Master',29:'Wind Walker',31:'Mage',32:'Wizard',
    33:'Shaman',34:'Elemental Sorcerer',36:'Bubonic Conjuror',
    40:'Arcane Cultist'
  };
  const strClasses=new Set([7,8,9,10,12,14,16]);
  const agiClasses=new Set([19,20,21,22,25,29]);
  const wisClasses=new Set([31,32,33,34,36,40]);
  function obj(v){
    if(v===null||v===undefined)return null;
    if(typeof v==='string'){
      try{return JSON.parse(v)}catch{return v}
    }
    return v;
  }
  const data=save=>(save?.data&&typeof save.data==='object'?save.data:save)||{};
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
  const list=v=>{
    const x=obj(v);
    if(Array.isArray(x))return x;
    if(x&&typeof x==='object'&&Number.isInteger(x.length)){
      return Array.from({length:x.length},(_,i)=>x[i]??x[String(i)]);
    }
    return [];
  };
  function fromSlots(v){
    const x=obj(v);
    if(Array.isArray(x))return x;
    if(x&&typeof x==='object')return Object.keys(x).filter(k=>/^\d+$/.test(k)).sort((a,b)=>a-b).map(k=>x[k]);
    return [];
  }
  function namedClass(id){return className[id]||('Class '+id)}
  function primaryStat(classId){
    if(strClasses.has(classId))return 'STR';
    if(agiClasses.has(classId))return 'AGI';
    if(wisClasses.has(classId))return 'WIS';
    return 'LUK';
  }
  function characterSnapshot(save,characterId){
    const raw=data(save),id=Number(characterId);
    if(!Number.isInteger(id)||id<0||raw['CharacterClass_'+id]===undefined)return null;
    const classId=finite(raw['CharacterClass_'+id]);
    const stats=list(raw['PVStatList_'+id]);
    const levels=list(raw['Lv0_'+id]);
    const order=fromSlots(raw['EquipOrder_'+id]);
    const worn=order[0]||{};
    const equip=fromSlots(raw['EMm0_'+id]);
    const rawWeapon=equip[1]||{};
    const talents=obj(raw['SL_'+id]);
    const rawBuffs=list(raw['BuffsActive_'+id]);
    const cards=list(raw['CardEquip_'+id]);
    const main=primaryStat(classId);
    const mainIdx={STR:0,AGI:1,WIS:2,LUK:3}[main];
    const map=finite(raw['CurrentMap_'+id]);
    const name=Array.isArray(save?.charNames)?save.charNames[id]:null;
    const sources={
      level:finite(levels[0])??finite(stats[4]),
      statSTR:finite(stats[0]),statAGI:finite(stats[1]),
      statWIS:finite(stats[2]),statLUK:finite(stats[3]),
      equippedWeapon:typeof worn[1]==='string'?worn[1]:null,
      weaponEnhancementPower:finite(rawWeapon.Weapon_Power),
      assignedCards:cards.filter(x=>typeof x==='string'&&x!=='B').length,
      learnedTalents:talents&&typeof talents==='object'?
        Object.values(talents).filter(x=>finite(x)>0).length:null,
      buffs:rawBuffs.length,
      onClamworks:map===306,
      map,
      afkTarget:raw['AFKtarget_'+id]??null
    };
    const mainValue=finite(stats[mainIdx]);
    const tower=list(raw.Tower);
    const towerLevel=finite(tower[2]);
    const knownMkBaseTower=towerLevel!==null?2*towerLevel:null;
    const scurge=list(raw.Menagerie);
    const scurgeLv=finite(list(scurge[5])[2]);
    const penalty=scurgeLv===null?null:Math.pow(100,-scurgeLv);
    const extras=save?.extraData&&typeof save.extraData==='object'?save.extraData:{};
    return {
      id,name:name||('Character '+(id+1)),classId,className:namedClass(classId),
      mainStat:main,mainStatValue:mainValue,sources,
      knownMultikillSources:knownMkBaseTower===null?[]:[
        {name:'W3 Death Note building',value:knownMkBaseTower,source:'Tower[2] × 2'}
      ],
      knownMkBaseSubtotal:knownMkBaseTower,
      scurgeAfflictionLevel:scurgeLv,clamworksDamageFactor:penalty,
      liveSnapshot:{
        // extraData is not character indexed; it belongs to the export/session.
        accuracy:finite(extras.accuracy),dropRate:finite(extras.dropRate),
        attribution:'Export-level context; not reliable for other selected characters or a changed map'
      },
      unavailable:[
        'Final max damage: requires weapon-power, additive base damage, per-X, percent multipliers and softcap',
        'Raw multikill base: requires other sources beyond Tower[2], including stamps, cards, gear, stars, obols and achievements',
        'Raw multikill per tier: requires death-note ranks and account/character effects',
        'Kills/hr: requires combat actions, monster respawns and survivability'
      ],
      completeDamage:false,completeMultikill:false
    };
  }
  function damageOnClamworks(snapshot,displayedDamage,source='saved-map'){
    const n=finite(displayedDamage);
    if(!snapshot||n===null||n<0)return {value:null,complete:false,reason:'No measured damage value'};
    if(source==='clamworks')return {value:n,complete:true,penaltyApplied:false,
      reason:'Observed on Clamworks; no extra Self Affliction penalty applied.'};
    if(snapshot.sources.map===306)return {value:n,complete:true,penaltyApplied:false,
      reason:'Saved map is Clamworks; the displayed damage already includes Self Affliction.'};
    if(snapshot.clamworksDamageFactor===null)return {value:null,complete:false,
      reason:'Self Affliction level is missing from the save.'};
    return {value:n*snapshot.clamworksDamageFactor,complete:false,
      penaltyApplied:true,reason:'Applies the Clamworks-specific Self Affliction penalty to damage measured elsewhere. Other map-specific modifiers could change the final value.'};
  }
  function accountAudit(save){
    const raw=data(save);
    return Object.keys(raw).filter(k=>/^CharacterClass_\d+$/.test(k))
      .map(k=>characterSnapshot(save,Number(k.split('_')[1])))
      .filter(Boolean).sort((a,b)=>a.id-b.id);
  }
  const api={characterSnapshot,accountAudit,primaryStat,damageOnClamworks,namedClass};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ClamworksStats=api;
})(typeof window!=='undefined'?window:null);
