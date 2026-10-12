import {env} from 'cloudflare:workers';
export const categories=['News','Editorial','Context','Research','Project','Law','Rules','Lease'];
export function db(){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
export function canonicalUrl(value:string){const u=new URL(value);if(!['https:','http:'].includes(u.protocol))throw new Error('Invalid source URL');u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(k))u.searchParams.delete(k);return u.toString();}
export async function keyFor(value:string){return 'BSW-'+[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,16);}
export function validateRecord(r:any){
 if(!r||typeof r!=='object'||!categories.includes(r.type))throw new Error('Invalid record type');
 for(const k of ['source','title','district','river','material','topics','en','bn','evidence','flag','url'])if(typeof r[k]!=='string'||!r[k].trim()||r[k].length>20000)throw new Error('Missing or oversized '+k);
 if(!['Bangla','English'].includes(r.language))throw new Error('Source language must be Bangla or English');
 if(r.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date))throw new Error('Invalid source date');
 canonicalUrl(r.url);if(r.alternateUrl)canonicalUrl(r.alternateUrl);
 const fields=['type','source','title','date','dateKind','district','river','material','topics','language','en','bn','evidence','flag','documentId','otherDate','url','alternateUrl','notes'];
 return Object.fromEntries(fields.map(k=>[k,typeof r[k]==='string'?r[k]:'']));
}
export async function insertRecords(input:any[],preserveIds=false){
 if(!Array.isArray(input)||input.length>20)throw new Error('At most 20 records per request');
 input.forEach(validateRecord);
 const out={added:0,duplicates:0,recordIds:[] as string[]};
 for(const incoming of input){
  const r=validateRecord(incoming),url=canonicalUrl(r.url),doi=/^10\./.test(r.documentId)?r.documentId.toLowerCase().replace(/^https?:\/\/doi.org\//,''):null;
  const existing=await db().prepare('SELECT id FROM archive_records WHERE canonical_url = ? OR (doi IS NOT NULL AND doi = ?)').bind(url,doi).first<{id:string}>();
  if(existing){out.duplicates++;out.recordIds.push(existing.id);continue;}
  const id=preserveIds&&/^BSW-\d{3}$/.test(incoming.id)?incoming.id:await keyFor(url);const now=new Date().toISOString();
  await db().batch([db().prepare('INSERT OR IGNORE INTO archive_records (id,canonical_url,doi,data,created_at) VALUES (?,?,?,?,?)').bind(id,url,doi,JSON.stringify({...r,id,decision:'Pending',reviewNotes:'',collectedAt:now}),now),db().prepare('INSERT OR IGNORE INTO editorial_reviews (record_id,decision,notes,updated_at) VALUES (?,?,?,?)').bind(id,'Pending','',now)]);
  out.added++;out.recordIds.push(id);
 }
 return out;
}
export function json(value:any,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function writeGuard(request:Request){
 // The deployed Site is owner-private. Sites dispatch authorizes browser and
 // service callers before this shared-project endpoint. Keep the Site private.
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new Error('Cross-origin writes are not allowed');
 if(!request.headers.get('content-type')?.includes('application/json'))throw new Error('JSON body required');
 const size=Number(request.headers.get('content-length')??0);if(size>1000000)throw new Error('Request too large');
}
