export const groupOf=r=>['Law','Rules','Lease'].includes(r.type)?'official':r.type==='Research'?'research':r.type==='Project'?'project':'news';
const aliases=[[/শোমেশ্বরী|সোমেশ্বরী|shomeshwari|someshwari/gu,' someshwari '],[/তিস্তা|teesta/gu,' teesta '],[/ব্রহ্মপুত্র|brahmaputra/gu,' brahmaputra '],[/মেঘনা|meghna/gu,' meghna '],[/ছোট যমুনা|chhoto jamuna/gu,' chhoto jamuna '],[/জিঞ্জিরাম|jinjiram/gu,' jinjiram '],[/সিলেট|sylhet/gu,' sylhet '],[/সুনামগঞ্জ|sunamganj/gu,' sunamganj '],[/নেত্রকোনা|netrakona|netrokona/gu,' netrokona '],[/জামালপুর|jamalpur/gu,' jamalpur '],[/লালমনিরহাট|lalmonirhat/gu,' lalmonirhat '],[/নীলফামারী|nilphamari/gu,' nilphamari '],[/নওগাঁ|naogaon/gu,' naogaon '],[/রংপুর|rangpur/gu,' rangpur '],[/বালুমহাল|balumahal/gu,' balumahal '],[/বাংলাদেশ|bangladesh/gu,' bangladesh '],[/বালু|sand/gu,' sand '],[/পাথর|stone/gu,' stone '],[/নুড়ি|gravel/gu,' gravel ']];
export function normalize(s){let v=String(s??'').normalize('NFKC').toLowerCase();for(const [pattern,to] of aliases)v=v.replace(pattern,to);return v.replace(/\s+/g,' ').trim();}
export const tokens=s=>String(s??'').split(';').map(s=>s.trim()).filter(Boolean);
export function districts(r){if(r.district==='Multiple; national'||r.district==='National')return ['National / multiple'];if(r.district==='Multiple')return ['Multiple districts'];if(r.type==='Project')return ['Regional study'];return tokens(r.district).filter(s=>s!=='others');}
const rivers={
 'BSW-001':['Chhoto Jamuna'],'BSW-002':['Teesta'],'BSW-003':['National / multiple'],
 'BSW-004':['Sylhet stone quarries'],'BSW-005':['Sylhet stone quarries'],'BSW-006':['Buri Teesta'],
 'BSW-007':['Someshwari'],'BSW-008':['Meghna'],'BSW-009':['Teesta'],
 'BSW-010':['Meghna','Brahmaputra','Jinjiram'],'BSW-011':['Brahmaputra'],'BSW-012':['Someshwari'],
 'BSW-013':['Ganga–Brahmaputra–Meghna basin'],'BSW-014':['National jurisdiction'],
 'BSW-015':['National jurisdiction'],'BSW-016':['National jurisdiction'],'BSW-017':['Sunamganj lease areas']
};
export const riverNames=r=>rivers[r.id]??tokens(r.river);
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
