// Builds the public, read-only GitHub Pages site into _site/.
// The archive data comes from the verified D1 snapshot (cloudflare/initial-data_v2.sql),
// loaded into an in-memory SQLite database and exported in the same shape as GET /api/archive.
// Any snapshots/*.json files (saved responses of GET /api/archive from a live host) are then
// merged on top in filename order; entries with the same id are replaced by the newer file.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,readdirSync,rmSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out=path.join(root,'_site');
const snapshot=process.env.SNAPSHOT??'cloudflare/initial-data_v2.sql';

const db=new DatabaseSync(':memory:');
const migrations=path.join(root,'drizzle');
for(const file of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort())
  for(const statement of readFileSync(path.join(migrations,file),'utf8').split('--> statement-breakpoint'))
    if(statement.trim())db.exec(statement);
db.exec(readFileSync(path.join(root,snapshot),'utf8'));

const all=sql=>db.prepare(sql).all();
const archive={
  records:all('SELECT data FROM archive_records ORDER BY created_at,id').map(r=>JSON.parse(r.data)),
  // Editorial notes are internal working notes; only the decision is published.
  reviews:Object.fromEntries(all('SELECT record_id,decision FROM editorial_reviews').map(r=>[r.record_id,{decision:r.decision,notes:''}])),
  sources:all('SELECT data,checked_at,last_error FROM source_registry ORDER BY id').map(r=>({...JSON.parse(r.data),checkedAt:r.checked_at,lastError:r.last_error})),
  runs:all('SELECT data FROM collection_runs ORDER BY created_at DESC LIMIT 20').map(r=>JSON.parse(r.data)),
  discovery:all('SELECT data FROM discovery_log ORDER BY updated_at DESC LIMIT 2000').map(r=>JSON.parse(r.data)),
  searches:all('SELECT data FROM search_log ORDER BY checked_at DESC LIMIT 2000').map(r=>JSON.parse(r.data)),
  backfill:all('SELECT data,status,checked_at FROM backfill_queue ORDER BY id').map(r=>({...JSON.parse(r.data),status:r.status,checkedAt:r.checked_at}))
};
const lists=['records','sources','runs','discovery','searches','backfill'];
const snapshots=path.join(root,'snapshots');
const exports=existsSync(snapshots)?readdirSync(snapshots).filter(f=>f.endsWith('.json')).sort():[];
for(const file of exports){
  const data=JSON.parse(readFileSync(path.join(snapshots,file),'utf8'));
  if(!Array.isArray(data.records))throw new Error(`snapshots/${file} is not a GET /api/archive response`);
  const before=archive.records.length;
  for(const key of lists){
    const merged=new Map(archive[key].map(x=>[x.id,x]));
    for(const item of data[key]??[]){if(!item?.id)throw new Error(`snapshots/${file}: ${key} entry without id`);merged.set(item.id,item);}
    archive[key]=[...merged.values()];
  }
  for(const [id,review] of Object.entries(data.reviews??{}))archive.reviews[id]={decision:review.decision,notes:''};
  console.log(`Merged snapshots/${file}: ${archive.records.length-before} new records.`);
}
for(const record of archive.records)archive.reviews[record.id]??={decision:'Pending',notes:''};
archive.runs.sort((a,b)=>String(b.finishedAt??'').localeCompare(String(a.finishedAt??'')));
for(const record of archive.records)if(!record.title||!record.url)throw new Error(`Record ${record.id} lacks a title or url`);
if(!archive.records.length||new Set(archive.records.map(r=>r.id)).size!==archive.records.length)throw new Error('Snapshot records are empty or duplicated');

rmSync(out,{recursive:true,force:true});
cpSync(path.join(root,'public'),out,{recursive:true});
mkdirSync(path.join(out,'data'),{recursive:true});
writeFileSync(path.join(out,'data/archive.json'),JSON.stringify(archive));
const index=path.join(out,'index.html'),html=readFileSync(index,'utf8');
if(!html.includes('<html lang="en">'))throw new Error('Expected <html lang="en"> in public/index.html');
writeFileSync(index,html.replace('<html lang="en">','<html lang="en" data-mode="public">'));
writeFileSync(path.join(out,'.nojekyll'),'');
console.log(`Built _site: ${archive.records.length} records, ${archive.sources.length} sources, ${archive.discovery.length} discovery entries, ${archive.backfill.length} backfill jobs.`);
