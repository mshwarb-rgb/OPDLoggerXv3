import { DX } from './dx.js';
export const AGE_GROUPS = ['<5','5-14','15-17','>=18'];
export const DISPOSITIONS = ['Discharged','Admitted','ED','Out'];

export function isSurgicalDx(dxId){
  const dx = DX.find(d=>d.id===dxId);
  return dx?.cat === 'S';
}

export function computeStats(visits){
  const stats = {
    total: visits.length,
    male: 0, female: 0,
    surgical: 0, ww: 0, nww: 0,
    disp: Object.fromEntries(DISPOSITIONS.map(d=>[d,0])),
    ageGender: Object.fromEntries(AGE_GROUPS.map(g=>[g,{M:0,F:0}])),
    dxCounts: Object.fromEntries(DX.map(d=>[d.id,0])),
  };

  for(const v of visits){
    if(v.gender==='M') stats.male++;
    if(v.gender==='F') stats.female++;

    const ag = v.ageGroup || '>=18';
    if(stats.ageGender[ag]){
      if(v.gender==='M') stats.ageGender[ag].M++;
      if(v.gender==='F') stats.ageGender[ag].F++;
    }

    const disp = v.disposition || 'Discharged';
    if(stats.disp[disp] !== undefined) stats.disp[disp]++;

    const dxs = [v.dx1, v.dx2].filter(Boolean);
    for(const id of dxs){
      if(stats.dxCounts[id] !== undefined) stats.dxCounts[id]++;
    }

    const surgical = dxs.some(id => isSurgicalDx(id));
    if(surgical){
      stats.surgical++;
      if(v.wwFlag==='WW') stats.ww++;
      if(v.wwFlag==='NWW') stats.nww++;
    }
  }
  return stats;
}
