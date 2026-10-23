import {canonicalDistrict,detectRivers} from './places.js';
export const groupOf=r=>['Law','Rules','Lease'].includes(r.type)?'official':r.type==='Research'?'research':r.type==='Project'?'project':'news';
const aliases=[[/শোমেশ্বরী|সোমেশ্বরী|shomeshwari|someshwari/gu,' someshwari '],[/তিস্তা|teesta/gu,' teesta '],[/ব্রহ্মপুত্র|brahmaputra/gu,' brahmaputra '],[/মেঘনা|meghna/gu,' meghna '],[/ছোট যমুনা|chhoto jamuna/gu,' chhoto jamuna '],[/জিঞ্জিরাম|jinjiram/gu,' jinjiram '],[/সিলেট|sylhet/gu,' sylhet '],[/সুনামগঞ্জ|sunamganj/gu,' sunamganj '],[/নেত্রকোনা|netrakona|netrokona/gu,' netrokona '],[/জামালপুর|jamalpur/gu,' jamalpur '],[/লালমনিরহাট|lalmonirhat/gu,' lalmonirhat '],[/নীলফামারী|nilphamari/gu,' nilphamari '],[/নওগাঁ|naogaon/gu,' naogaon '],[/রংপুর|rangpur/gu,' rangpur '],[/বালুমহাল|balumahal/gu,' balumahal '],[/বাংলাদেশ|bangladesh/gu,' bangladesh '],[/বালু|sand/gu,' sand '],[/পাথর|stone/gu,' stone '],[/নুড়ি|gravel/gu,' gravel ']];
export function normalize(s){let v=String(s??'').normalize('NFKC').toLowerCase();for(const [pattern,to] of aliases)v=v.replace(pattern,to);return v.replace(/\s+/g,' ').trim();}
export const tokens=s=>String(s??'').split(';').map(s=>s.trim()).filter(Boolean);
export function districts(r){if(r.district==='Multiple; national'||r.district==='National')return ['National / multiple'];if(r.district==='Multiple')return ['Multiple districts'];if(r.type==='Project')return ['Regional study'];return [...new Set(String(r.district??'').split(/\s*[;\/]\s*/).map(canonicalDistrict).filter(Boolean))];}
const rivers={
 'BSW-001':['Chhoto Jamuna'],'BSW-002':['Teesta'],'BSW-003':['National / multiple'],
 'BSW-004':['Sylhet stone quarries'],'BSW-005':['Sylhet stone quarries'],'BSW-006':['Buri Teesta'],
 'BSW-007':['Someshwari'],'BSW-008':['Meghna'],'BSW-009':['Teesta'],
 'BSW-010':['Meghna','Brahmaputra','Jinjiram'],'BSW-011':['Brahmaputra'],'BSW-012':['Someshwari'],
 'BSW-013':['Ganga–Brahmaputra–Meghna basin'],'BSW-014':['National jurisdiction'],
 'BSW-015':['National jurisdiction'],'BSW-016':['National jurisdiction'],'BSW-017':['Sunamganj lease areas']
};
export const riverNames=r=>{if(rivers[r.id])return rivers[r.id];const found=detectRivers(r.river);return found.length?found:['Other / unspecified'];};
export const yearOf=r=>r.date?r.date.slice(0,4):r.id==='BSW-014'?'2010 (act year)':'Unknown';
export const decisionOf=(r,reviews)=>reviews[r.id]?.decision??r.decision??'Pending';
export function filterRecords(records,f,reviews={}){
 const q=normalize(f.search??'').split(' ').filter(Boolean);
 return records.filter(r=>{
  const corpus=normalize([r.id,r.title,r.source,r.district,r.river,r.material,r.topics,r.en,r.bn,r.documentId].join(' '));
  return q.every(t=>corpus.includes(t))&&(!f.dateFrom||(r.date&&r.date>=f.dateFrom))&&(!f.dateTo||(r.date&&r.date<=f.dateTo))&&(!f.category||f.category==='all'||groupOf(r)===f.category)&&(!f.district||f.district==='all'||districts(r).includes(f.district))&&(!f.river||f.river==='all'||riverNames(r).includes(f.river))&&(!f.year||f.year==='all'||yearOf(r)===f.year)&&(!f.material||f.material==='all'||(f.material==='gravel'?/stone|gravel/i.test(r.material):r.material.toLowerCase().includes(f.material)))&&(!f.topic||f.topic==='all'||tokens(r.topics).includes(f.topic))&&(!f.sourceLanguage||f.sourceLanguage==='all'||r.language===f.sourceLanguage)&&(!f.decision||f.decision==='all'||decisionOf(r,reviews)===f.decision)&&(!f.source||f.source==='all'||r.source===f.source);
 });
}
export function sortRecords(records,sort='newest'){
 return [...records].sort((a,b)=>{if(sort==='id')return a.id.localeCompare(b.id);if(sort==='source')return a.source.localeCompare(b.source)||a.id.localeCompare(b.id);if(!a.date&&!b.date)return a.id.localeCompare(b.id);if(!a.date)return 1;if(!b.date)return -1;return(sort==='oldest'?1:-1)*a.date.localeCompare(b.date)||a.id.localeCompare(b.id);});
}
export function safeUrl(url){try{const u=new URL(url);return u.protocol==='https:'||u.protocol==='http:'?u.href:'';}catch{return '';}}
export function csv(rows){const escape=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return '\uFEFF'+rows.map(r=>r.map(escape).join(',')).join('\r\n');}
export function validateReviewBackup(data,records){
 if(!data||data.kind!=='bangladesh-sand-watch-review'||data.schemaVersion!==1||!data.reviews||Array.isArray(data.reviews)||typeof data.reviews!=='object')throw new Error('Invalid review backup');
 const ids=new Set(records.map(r=>r.id));const result={};
 for(const [id,v] of Object.entries(data.reviews)){if(!ids.has(id)||!v||!['Pending','Accept','Revise','Reject'].includes(v.decision)||typeof v.notes!=='string'||v.notes.length>10000)throw new Error('Invalid review record');result[id]={decision:v.decision,notes:v.notes};}
 return result;
}
// Related records: shared named rivers/sites weigh most, then districts, then topics.
// A pair is flagged as possibly the same event only when it shares a specific place,
// the source dates are at most three days apart, and the titles overlap. It is a hint for
// reviewers, never a merge.
const broadPlaces=new Set(['National / multiple','Multiple districts','Regional study','Regional / transboundary','Global','Other / unspecified','Multiple rivers','National jurisdiction','Canals, streams & chharas','Coast & estuaries','Sand mahal / lease areas','Stone quarries']);
const commonWords=new Set(['sand','stone','gravel','extraction','illegal','illegally','river','rivers','the','and','from','for','with','over','amid','despite','bangladesh','উত্তোলন','উত্তোলনে','উত্তোলনের','অবৈধ','অবৈধভাবে','নদী','নদীতে','নদীর','থেকে','বালু','পাথর','বালু-পাথর','অভিযান','অভিযানে','জন্য','করে','হচ্ছে','চলছে']);
// Compare four-letter stems so Bangla case endings (চ্যানেল / চ্যানেলের) still match; place names
// are already scored separately, so they do not count as title overlap.
const placeWords=r=>new Set([...riverNames(r),...districts(r)].flatMap(p=>normalize(p).split(/[^\p{L}\p{M}\p{N}]+/u)).map(w=>[...w].slice(0,4).join('')));
const titleWords=r=>{const skip=placeWords(r);return new Set(normalize(r.title).split(/[^\p{L}\p{M}\p{N}-]+/u).filter(w=>w.length>2&&!commonWords.has(w)).map(w=>[...w].slice(0,4).join('')).filter(w=>!skip.has(w)));};
const dayGap=(a,b)=>a.date&&b.date?Math.abs(Date.parse(a.date)-Date.parse(b.date))/864e5:Infinity;
export function relatedRecords(records,r,limit=5){
 const rivers=new Set(riverNames(r).filter(p=>!broadPlaces.has(p))),places=new Set(districts(r).filter(p=>!broadPlaces.has(p))),topics=new Set(tokens(r.topics)),words=titleWords(r);
 return records.filter(o=>o.id!==r.id).map(o=>{
  const sharedRivers=riverNames(o).filter(p=>rivers.has(p)).length,sharedPlaces=districts(o).filter(p=>places.has(p)).length;
  const sharedTopics=tokens(o.topics).filter(t=>topics.has(t)).length,ow=titleWords(o);
  const common=[...words].filter(w=>ow.has(w)).length,overlap=common/Math.max(1,Math.min(words.size,ow.size));
  const sameEvent=(sharedRivers+sharedPlaces)>0&&dayGap(r,o)<=3&&common>=2&&overlap>=0.3;
  return {record:o,sameEvent,score:sharedRivers*3+sharedPlaces*2+Math.min(sharedTopics,3)*0.5+(sameEvent?10:0)};
 }).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score||(b.record.date??'').localeCompare(a.record.date??'')).slice(0,limit);
}
