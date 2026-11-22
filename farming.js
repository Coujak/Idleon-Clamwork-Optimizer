/* Clamworks Lab — per-character, source-grounded farming model.
   No external requests, no uploaded-account data stored on GitHub.
   Pearl chances and bonuses mirror Idleon Toolbox parsers/world-7/clamWork.ts.
   Kills/hr and multikill total are NOT present as final combat outputs in raw IT saves.
*/
(function(root){
  'use strict';
  const CLASS_NAMES = {
    1:'Beginner',2:'Journeyman',3:'Maestro',4:'Voidwalker',
    7:'Warrior',8:'Barbarian',9:'Squire',10:'Blood Berserker',12:'Divine Knight',
    14:'Death Bringer',16:'Royal Guardian',19:'Archer',20:'Bowman',
    21:'Hunter',22:'Siege Breaker',25:'Beast Master',29:'Wind Walker',
    31:'Mage',32:'Wizard',33:'Shaman',34:'Elemental Sorcerer',
    36:'Bubonic Conjuror',40:'Arcane Cultist'
  };
  const num = value => {
    if(value===null||value===undefined||String(value).trim()==='')return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  };
  const array = value => {
    try { const x=typeof value==='string'?JSON.parse(value):value; return Array.isArray(x)?x:[]; }
    catch { return []; }
  };
  const dataOf = save => save && typeof save==='object' && save.data && typeof save.data==='object'?save.data:save;
  const esc = value => String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const compact = value => {
    if(value===null||!Number.isFinite(value)) return '—';
    const abs=Math.abs(value);
    if(abs<1e6)return value.toLocaleString('en-US',{maximumFractionDigits:3});
    if(abs<1e9)return (value/1e6).toFixed(2)+'M';
    if(abs<1e12)return (value/1e9).toFixed(2)+'B';
    if(abs<1e15)return (value/1e12).toFixed(2)+'T';
    return value.toExponential(3).replace('e+','E');
  };
  function getRoster(save){
    const d=dataOf(save);
    if(!d||typeof d!=='object')return [];
    const provided=Array.isArray(save?.charNames)?save.charNames:[];
    const ids=[...new Set(Object.keys(d).filter(k=>/^CharacterClass_\d+$/.test(k))
      .map(k=>Number(k.slice('CharacterClass_'.length))))].sort((a,b)=>a-b);
    const characters=ids.map(id=>{
      const stats=array(d['PVStatList_'+id]).map(x=>num(x)??0);
      const classId=num(d['CharacterClass_'+id]);
      return {id,name:String(provided[id]??('Character '+(id+1))),
        classId,className:CLASS_NAMES[classId]??('Class '+classId),
        level:stats[4]??null,str:stats[0]??null,agi:stats[1]??null,
        wis:stats[2]??null,luk:stats[3]??null,
        target:String(d['AFKtarget_'+id]??'Unknown'),
        map:num(d['CurrentMap_'+id]),activity:num(d['PTimeAway_'+id]),
        stationedAtClamworks:d['AFKtarget_'+id]==='w7a6'};
    });
    const likely=characters.reduce((best,c)=>c.activity!==null&&(!best||c.activity>best.activity)?c:best,null);
    return characters.map(c=>({...c,likelyActive:Boolean(likely&&c.id===likely.id)}));
  }
  function getAccount(save){
    const d=dataOf(save);
    if(!d||typeof d!=='object')return null;
    const ola=array(d.OptLacc),menagerie=array(d.Menagerie);
    if(!ola.length||!menagerie.length)return null;
    const levels=Array.from({length:9},(_,i)=>num(ola[455+i])??0);
    const scurge=Array.from({length:9},(_,i)=>num(array(menagerie[5])[i])??0);
    return {worker:num(ola[464])??0,scurgeLevel:num(array(menagerie[0])[8])??0,
      scurgeExp:num(array(menagerie[0])[7]),scurgeUnlocked:num(array(menagerie[2])[4])===1,
      pearlLevels:levels,scurgeLevels:scurge,autoClaim:num(ola[527])===1,
      pearlBalance:num(ola[454])??0,roster:getRoster(save)};
  }
  function pearlYield(account,multikill){
    if(!account)return null;
    const p=account.pearlLevels,s=account.scurgeLevels,worker=account.worker;
    const mkKnown=multikill!==null&&Number.isFinite(multikill)&&multikill>=0;
    const mk=mkKnown?multikill:0;
    // Thingies("ClamBonuses", 3) is (total multikill / 1000) * level.
    const multiScalping=1+(mk/1000)*p[3]/100;
    const pearlValue=(1+p[0])*multiScalping*(1+0.1*p[7])*
      (1+0.5*s[1])*(1+0.1*s[8]*account.scurgeLevel);
    const dropScale=(1+0.1*p[6])*Math.pow(0.66,worker);
    const regularChance=0.005*dropScale;
    const pureChance=p[5]>=1?0.000025*dropScale:0;
    const pureValue=50+50*p[5];
    const luckyChance=(3*p[2])/(100+3*p[2]);
    const luckyMultiplier=1+9*luckyChance;
    const expectedPerKill=(regularChance+pureChance*pureValue)*luckyMultiplier*pearlValue;
    const clamCount=Math.min(25,2+p[1]);
    // These three Scurge bonuses are the known game-data EXP multipliers.
    const scurgeExpMultiplier=(1+s[0])*(1+1.5*s[4])*(1+2*s[2]);
    return {expectedPerKill,perThousand:1000*expectedPerKill,
      regularChance,pureChance,pureValue,luckyChance,luckyMultiplier,pearlValue,
      clamCount,scurgeExpMultiplier,multikillKnown:mkKnown,
      multikillMissing:!mkKnown&&p[3]>0};
  }
  function scenario(account,options={}){
    if(!account)return null;
    const chars=account.roster;
    const chosen=chars.find(c=>c.id===options.selectedId)||chars.find(c=>c.name.toLowerCase()==='coumine2')||
      chars.find(c=>c.likelyActive)||chars[0]||null;
    if(!chosen)return null;
    const rates=options.rates||{};
    const math=options.combatMath||(root&&root.ClamworksCombatMath)||null;
    const stats=options.statEngine||(root&&root.ClamworksStats)||null;
    const snapshots=options.statSnapshots||{};
    const others=Number.isSafeInteger(options.otherPlayers)&&options.otherPlayers>=0?options.otherPlayers:0;
    const rateInfo=c=>{
      const row=rates[c.id]||{};
      const kills=num(row.killsPerHour),directMk=num(row.multikill);
      const validKills=kills!==null&&kills>=0;
      const snapshot=snapshots[c.id]||null;
      const observedDamage=stats?.damageOnClamworks&&snapshot?
        stats.damageOnClamworks(snapshot,row.maxDamage,row.damageLocation||'clamworks'):null;
      const combat=math?.multikill({maxDamage:observedDamage?.value??row.maxDamage,
        rawBase:row.mkBase,rawPerTier:row.mkPerTier,worker:account.worker})||null;
      // Off-map damage adjusted only for Self Affliction is provisional.
      const calculatedMk=combat?.known&&(!observedDamage||observedDamage.complete)?combat.total:null;
      const mk=directMk!==null&&directMk>=0?directMk:calculatedMk;
      const yieldInfo=pearlYield(account,mk!==null&&mk>=0?mk:null);
      const complete=validKills&&!yieldInfo.multikillMissing;
      const scurge=account.scurgeUnlocked?math?.scurgeProjection(account,{
        killsPerHour:validKills?kills:null,otherPlayers:others})||null:null;
      return {...c,killsPerHour:validKills?kills:null,multikill:mk!==null&&mk>=0?mk:null,
        multikillSource:directMk!==null&&directMk>=0?'observed':calculatedMk!==null?'calculated':'missing',
        combat,observedDamage,statSnapshot:snapshot,scurge,yield:yieldInfo,
        pearlsPerHour:complete?yieldInfo.expectedPerKill*kills:null,
        baselinePearlsPerHour:validKills?yieldInfo.expectedPerKill*kills:null};
    };
    const active=rateInfo(chosen);
    const afk=options.includeAfk===false?[]:chars.filter(c=>c.id!==chosen.id&&c.stationedAtClamworks).map(rateInfo);
    const afkKnown=afk.filter(c=>c.pearlsPerHour!==null);
    const coverage=afk.length?afkKnown.length/afk.length:1;
    const afkPartial=afkKnown.reduce((sum,c)=>sum+c.pearlsPerHour,0);
    const afkTotal=coverage===1?afkPartial:null;
    const mode=options.mode==='scurge'?'scurge':'pearls';
    const activeRate=mode==='pearls'?active.pearlsPerHour:null;
    // Never silently treat missing characters' hourly figures as zero.
    const totalRate=activeRate!==null&&afkTotal!==null?activeRate+afkTotal:null;
    return {active,afk,mode,includeAfk:options.includeAfk!==false,afkKnown:afkKnown.length,
      afkPartial,afkTotal,activeRate,totalRate,coverage};
  }
  const api={getRoster,getAccount,pearlYield,scenario,CLASS_NAMES};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root||!root.document)return;
  root.ClamworksFarming=api;
  const $=id=>root.document.getElementById(id);
  let account=null,selectedId=null,mode='pearls',includeAfk=true,rates={},otherPlayers=0,statSnapshots={};
  function readPositiveRate(value){
    if(String(value??'').trim()==='')return null;
    const helper=root.parseCompactNumber;
    const n=typeof helper==='function'?helper(value):Number(value);
    return Number.isFinite(n)&&n>=0?n:null;
  }
  function saveField(index,key,value){
    const n=readPositiveRate(value);
    rates[index]??={};
    rates[index][key]=n;
  }
  function render(){
    const host=$('characterFarming');
    if(!host)return;
    if(!account){
      host.innerHTML='<div class="panel" style="margin-top:16px"><h2>Character-based farming</h2><p class="muted">Import an IT JSON to select a character and calculate Clamworks pearl yields.</p></div>';
      return;
    }
    const plan=scenario(account,{selectedId,mode,includeAfk,rates,otherPlayers,statSnapshots});
    if(!plan)return;
    selectedId=plan.active.id;
    const active=plan.active;
    const stats='STR '+compact(active.str)+' · AGI '+compact(active.agi)+
      ' · WIS '+compact(active.wis)+' · LUK '+compact(active.luk);
    const rows=plan.afk.map(c=>'<tr><td><strong>'+esc(c.name)+'</strong><div class="muted" style="font-size:11px">'+
      esc(c.className)+'</div></td><td><input data-cf-id="'+c.id+'" data-cf-key="killsPerHour" type="text" inputmode="decimal" placeholder="Not in JSON" value="'+esc(rates[c.id]?.killsPerHour??'')+'" style="width:110px" aria-label="'+esc(c.name)+' AFK kills per hour"></td>'+
      '<td><input data-cf-id="'+c.id+'" data-cf-key="multikill" type="text" inputmode="decimal" placeholder="Unknown" value="'+esc(rates[c.id]?.multikill??'')+'" style="width:110px" aria-label="'+esc(c.name)+' multikill"></td>'+
      '<td style="text-align:right">'+(c.pearlsPerHour===null?'—':compact(c.pearlsPerHour))+'</td></tr>').join('');
    const mkAlert=active.yield.multikillMissing?
      ' Multi-Scalping is unlocked; its multiplier needs this character’s total multikill for a complete figure.':'';
    const mapAlert=active.stationedAtClamworks?'':' This character was not assigned to Clamworks in the save; these figures assume you move them there.';
    const combat=active.combat,xp=active.scurge,snap=active.statSnapshot;
    const audit=snap?
      '<div class="alloc-outcome" style="margin-top:10px">'+
      '<strong>Imported combat inputs</strong> · '+esc(snap.className)+
      ' · main stat '+esc(snap.mainStat)+' '+compact(snap.mainStatValue)+
      ' · weapon '+esc(snap.sources.equippedWeapon??'unknown')+
      ' · saved weapon enhancement power '+compact(snap.sources.weaponEnhancementPower)+
      ' · '+(snap.sources.learnedTalents??'—')+' learned talent entries'+
      '<div class="muted" style="margin-top:5px">Confirmed one-source MK-base contribution: W3 Death Note building +'+
      compact(snap.knownMkBaseSubtotal)+' (Tower[2]). This is <strong>NOT the total MK base</strong>.</div>'+
      '<div class="muted" style="margin-top:5px">Self Affliction Lv'+
      compact(snap.scurgeAfflictionLevel)+' on Clamworks: damage ×'+
      (snap.clamworksDamageFactor===null?'unknown':snap.clamworksDamageFactor.toExponential(2))+
      '. Saved map '+compact(snap.sources.map)+'.</div>'+
      '<p class="alloc-note">Full max damage is not derived yet. Account-wide talent, gear, cards, HP/MP, per-X and scaled percent bonuses still need a complete stat engine.</p></div>'
      :'<p class="alloc-note">No character stat snapshot found in the imported JSON.</p>';
    const rawMkSummary=combat?.known
      ?((active.observedDamage&&!active.observedDamage.complete?'Provisional':'Calculated')+
        ' total multikill '+compact(combat.total)+' ('+compact(combat.base)+
        ' base + '+combat.tier+' tiers × '+compact(combat.perTier)+' per tier).'+
        (active.observedDamage&&!active.observedDamage.complete?
        ' Off-map damage correction is not trusted for pearl/hour calculations.':''))
      :('Multikill components incomplete. '+(combat?.tier?'Overkill tier '+combat.tier+'. ':'')+
        'Provide max damage and raw base/per-tier, or enter observed total multikill.');
    const expSummary=xp
      ?('Scurge '+compact(xp.exp)+' / '+compact(xp.requirement)+' EXP; '+compact(xp.expPerKill)+
        ' EXP/actual Clamworks kill; '+(xp.expPerHour===null?'kills/hr required for EXP/hr':
          compact(xp.expPerHour)+' EXP/hr; '+(xp.hoursToNext===null?'ETA unavailable':compact(xp.hoursToNext)+' hours to next level')))
      :'Scurge EXP is locked or not available in this save.';
    const summary=mode==='pearls'
      ?('Selected character: '+(activeRateText(plan.activeRate))+
        '. AFK coverage: '+plan.afkKnown+'/'+plan.afk.length+
        '; '+(plan.afkTotal!==null?'AFK total '+compact(plan.afkTotal)+'/hr':'known AFK portion '+compact(plan.afkPartial)+'/hr (incomplete)')+
        '. '+(plan.totalRate!==null?'Combined '+compact(plan.totalRate)+'/hr.':'Combined rate unavailable until all contributing rates are entered.'))
      :expSummary+' AFK pearl income is tracked separately; AFK characters do not contribute active Scurge kills.';
    host.innerHTML='<section class="panel" style="margin-top:17px" aria-label="Character farming scenario">'+
      '<h2>Character-based Clamworks farming</h2><p class="muted">Choose a character from the imported save. Pearl probabilities and values follow game data; kill rates and multikill must be calibrated, not inferred from base stats.</p>'+
      '<div class="alloc-controls" style="margin-top:12px">'+
      '<label class="alloc-control">Active character<select id="cfCharacter">'+account.roster.map(c=>'<option value="'+c.id+'"'+(c.id===selectedId?' selected':'')+'>'+esc(c.name)+' — '+esc(c.className)+(c.likelyActive?' (likely active)':'')+'</option>').join('')+'</select></label>'+
      '<label class="alloc-control">Farming objective<select id="cfMode"><option value="pearls"'+(mode==='pearls'?' selected':'')+'>Pearl farming</option><option value="scurge"'+(mode==='scurge'?' selected':'')+'>Scurge EXP farming</option></select></label>'+
      '</div><label style="display:flex;gap:8px;align-items:center;margin:12px 0;font-size:13px"><input id="cfIncludeAfk" type="checkbox"'+(includeAfk?' checked':'')+'>Include other characters assigned to Clamworks AFK</label>'+
      '<div class="alloc-outcome"><strong>'+esc(active.name)+'</strong> · '+esc(active.className)+
      ' · Lv '+compact(active.level)+'<div class="muted" style="margin-top:4px">'+stats+
      ' · map '+compact(active.map)+' · '+esc(active.target)+'</div></div>'+
      '<p class="alloc-note">Current Worker Class: '+account.worker+' · '+active.yield.clamCount+
      ' clams · '+compact(active.yield.perThousand)+' expected pearls per 1,000 kills'+(active.yield.multikillMissing?' (excluding unknown multikill).':'.')+
      esc(mkAlert+mapAlert)+'</p>'+
      '<div class="alloc-controls">'+
      '<label class="alloc-control">Selected character · measured clam kills/hr<input id="cfKills" type="text" inputmode="decimal" placeholder="Not available in raw JSON" value="'+esc(rates[selectedId]?.killsPerHour??'')+'"></label>'+
      '<label class="alloc-control">Selected character · observed total multikill (optional override)<input id="cfMultikill" type="text" inputmode="decimal" placeholder="Calculated if components supplied" value="'+esc(rates[selectedId]?.multikill??'')+'"></label>'+
      '</div><details open style="margin-top:12px"><summary>Imported combat stats, damage and multikill</summary>'+
      '<p class="alloc-note">Clam HP and World 7 overkill math come from game data. The raw save lacks final damage and the full multikill breakdown; use your in-game stats to calibrate them. Zero is allowed.</p>'+
      '<div class="alloc-controls">'+
      '<label class="alloc-control">Observed max damage<input id="cfMaxDamage" type="text" inputmode="decimal" placeholder="Requires full combat stat" value="'+esc(rates[selectedId]?.maxDamage??'')+'"></label>'+
      '<label class="alloc-control">Measured damage location<select id="cfDamageLocation"><option value="clamworks"'+((rates[selectedId]?.damageLocation??'clamworks')==='clamworks'?' selected':'')+'>On Clamworks</option><option value="saved-map"'+(rates[selectedId]?.damageLocation==='saved-map'?' selected':'')+'>Saved map (Self Affliction adjustment only)</option></select></label>'+
      '<label class="alloc-control">Raw multikill base (before W7 scale)<input id="cfMkBase" type="text" inputmode="decimal" placeholder="From stat breakdown" value="'+esc(rates[selectedId]?.mkBase??'')+'"></label>'+
      '<label class="alloc-control">Raw multikill per tier (before W7 scale)<input id="cfMkPerTier" type="text" inputmode="decimal" placeholder="From stat breakdown" value="'+esc(rates[selectedId]?.mkPerTier??'')+'"></label>'+
      '<label class="alloc-control">Other real players on Clamworks<input id="cfOtherPlayers" type="number" inputmode="numeric" min="0" max="50" value="'+otherPlayers+'"></label>'+
      '</div>'+audit+'<div class="alloc-outcome">Clam HP: '+compact(combat?.hp)+
      '. Overkill tier: '+(combat?.tier??'—')+
      '. Damage required for next tier: '+compact(combat?.nextDamage)+'. '+esc(rawMkSummary)+'</div>'+
      '<div class="alloc-outcome" style="margin-top:10px">'+esc(expSummary)+'</div></details>'+
      '<details style="margin-top:14px"><summary>AFK characters and individual rates ('+plan.afk.length+')</summary>'+
      '<div class="alloc-scroll"><table class="alloc-table"><thead><tr><th>Character</th><th>Observed kills/hr</th><th>Total multikill</th><th>Expected pearls/hr</th></tr></thead><tbody>'+
      rows+'</tbody></table></div><p class="alloc-note">AFK estimates use drop expectations per recorded kill. Claim rerolls, AFK reward modifiers and unknown kill rates are not yet included; do not treat this as an exact IT AFK claim forecast.</p></details>'+
      '<div class="alloc-outcome" id="cfEstimate" style="margin-top:12px">'+esc(summary)+'</div></section>';
    $('cfCharacter').addEventListener('change',e=>{selectedId=Number(e.target.value);render();});
    $('cfMode').addEventListener('change',e=>{mode=e.target.value==='scurge'?'scurge':'pearls';render();});
    $('cfIncludeAfk').addEventListener('change',e=>{includeAfk=e.target.checked;render();});
    $('cfKills').addEventListener('change',e=>{saveField(selectedId,'killsPerHour',e.target.value);render();});
    $('cfMultikill').addEventListener('change',e=>{saveField(selectedId,'multikill',e.target.value);render();});
    $('cfDamageLocation').addEventListener('change',e=>{
      rates[selectedId]??={};
      rates[selectedId].damageLocation=e.target.value==='saved-map'?'saved-map':'clamworks';render();
    });
    for(const [id,key] of [['cfMaxDamage','maxDamage'],['cfMkBase','mkBase'],['cfMkPerTier','mkPerTier']]){
      $(id).addEventListener('change',e=>{saveField(selectedId,key,e.target.value);render();});
    }
    $('cfOtherPlayers').addEventListener('change',e=>{
      const n=Number(e.target.value);
      otherPlayers=Number.isSafeInteger(n)&&n>=0&&n<=50?n:0;
      render();
    });
    host.querySelectorAll('[data-cf-id]').forEach(el=>el.addEventListener('change',e=>{
      saveField(Number(e.target.dataset.cfId),e.target.dataset.cfKey,e.target.value);render();
    }));
    const focus=$('pFarmFocus');
    if(focus)focus.value=mode;
    root.ClamworksPlanner?.setFarmModel?.({
      mode,selectedName:active.name,
      activePearlsPerHour:plan.activeRate,
      afkPearlsPerHour:plan.afkTotal,
      activeScurgeExpPerHour:plan.active.scurge?.expPerHour??null,
      partialAfk:plan.afkPartial,
      coverage:plan.coverage
    });
  }
  function activeRateText(rate){return rate===null?'measured kills/hr not supplied':compact(rate)+'/hr';}
  api.onSave=(save)=>{
    account=save?getAccount(save):null;
    statSnapshots={};
    if(save&&root.ClamworksStats?.accountAudit){
      for(const item of root.ClamworksStats.accountAudit(save))statSnapshots[item.id]=item;
    }
    const chars=account?.roster||[];
    selectedId=chars.find(c=>c.name.toLowerCase()==='coumine2')?.id??
      chars.find(c=>c.likelyActive)?.id??chars[0]?.id??null;
    mode='pearls';includeAfk=true;rates={};otherPlayers=0;render();
  };
  api.setFocus=value=>{mode=value==='scurge'?'scurge':'pearls';render();};
  function init(){render();}
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:null);
