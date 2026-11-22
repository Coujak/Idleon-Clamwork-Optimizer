/* Auto-extracted Clamworks multikill components.
 * These are independently implemented from public game mechanics. This module
 * reports *known components*, not a fabricated total when other sources,
 * full character damage or multikill-per-tier remain unresolved.
 */
(function(root) {
  'use strict';
  const parse = input => {
    if (typeof input !== 'string') return input;
    try { return JSON.parse(input); } catch { return input; }
  };
  const arr = input => {
    const value = parse(input);
    return Array.isArray(value) ? value : [];
  };
  const n = value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  const rawOf = save => save && typeof save === 'object' && save.data && typeof save.data === 'object'
    ? save.data : (save || {});

  // These three game achievements are additive flat MULTIKILL_base bonuses.
  // Standard completed achievement status = AchieveReg[index] === -1.
  const achievement = (achievements, idx) => arr(achievements)[idx] === -1 ? 1 : 0;
  function knownBase(save) {
    const raw = rawOf(save);
    const result = [];
    const unavailable = [];
    const tower = arr(raw.Tower);
    const level = n(tower[2]);
    if (level !== null) result.push({key:'tower',name:'Death Note building',amount:2*level,
      detail:'Tower[2] × 2',confidence:'game-data'});
    else unavailable.push('Death Note building (Tower[2])');

    const salt = arr(raw.SaltLick);
    const saltLevel = n(salt[8]);
    if (saltLevel !== null) result.push({key:'salt',name:'Purple Salt Lick',amount:3*saltLevel,
      detail:'SaltLick[8] × 3%',confidence:'game-data'});
    else unavailable.push('Purple Salt Lick (SaltLick[8])');

    const achievements = arr(raw.AchieveReg);
    if (achievements.length > 148) {
      const a148 = Math.min(5,achievement(achievements,148));
      const a122 = 6*achievement(achievements,122);
      const a123 = 2*achievement(achievements,123);
      result.push(
        {key:'achievement-148',name:'Achievement 148',amount:a148,
          detail:'AchieveStatus(148), capped at +5',confidence:'game-data'},
        {key:'achievement-122',name:'Achievement 122',amount:a122,
          detail:'+6 on completion',confidence:'game-data'},
        {key:'achievement-123',name:'Achievement 123',amount:a123,
          detail:'+2 on completion',confidence:'game-data'}
      );
    } else unavailable.push('Achievement completion statuses (AchieveReg)');

    const total = result.reduce((sum,source)=>sum+source.amount,0);
    return {sources:result,knownRawBase:total,fullyParsed:unavailable.length===0,
      unavailable,notIncluded:[
        'Star signs and active all-sign effects',
        'Overkill stamp and other stamp multipliers',
        'Equipment, obols and set bonuses',
        'Onyx statues and Monolithialism talent'
      ]};
  }

  function knownPerTier(save,characterId){
    const raw=rawOf(save),id=Number(characterId);
    const found=Number.isInteger(id)&&id>=0&&raw['CharacterClass_'+id]!==undefined;
    return {sources:[],knownRawPerTier:0,complete:false,characterFound:found,
      notIncluded:[
        'World 7 and Sneaking Death Note ranks',
        'Overkill vials, active character talents, Arcade and artifacts',
        'Lab chips, equipment, obols, measurements and cards',
        'Star signs, prayers, shiny pets, Post Office and equipped bubble'
      ]};
  }
  function analyze(save,characterId,worker,damage=null,rawOtherBase=null,rawPerTier=null,math=null) {
    const base=knownBase(save),tier=knownPerTier(save,characterId);
    const hp=math?.monsterHP?.(worker)??null;
    const knownScaledBase=math?.w7Multikill?.(base.knownRawBase)??null;
    const hasOther= n(rawOtherBase)!==null;
    const hasTier=n(rawPerTier)!==null;
    const resolvedBase=base.fullyParsed&&hasOther?base.knownRawBase+n(rawOtherBase):null;
    const resolvedTier=hasTier?n(rawPerTier):null;
    const onMapDamage=n(damage);
    const calculation=math?.multikill?.({
      maxDamage:onMapDamage,rawBase:resolvedBase,rawPerTier:resolvedTier,worker
    })??null;
    return {
      ...base,
      perTier:tier,
      hp,knownScaledBase,
      missingOtherBase:!hasOther,missingRawPerTier:!hasTier,missingDamage:onMapDamage===null,
      resolvedRawBase:resolvedBase,resolvedRawPerTier:resolvedTier,
      total:calculation?.known?calculation.total:null,
      tier:calculation?.tier??null,
      calculation,
      exact:calculation?.known===true
    };
  }

  const api={knownBase,knownPerTier,analyze};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  if(root)root.ClamworksAutoMultikill=api;
})(typeof window !== 'undefined' ? window : null);
