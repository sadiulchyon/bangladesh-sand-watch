import jobs from '../../../../public/backfill-plan.json';
import {db,json,writeGuard} from '../../../../server/catalogue';
export async function POST(request:Request){try{writeGuard(request);for(let i=0;i<jobs.length;i+=80)await db().batch(jobs.slice(i,i+80).map(j=>db().prepare('INSERT OR IGNORE INTO backfill_queue(id,data,status) VALUES(?,?,?)').bind(j.id,JSON.stringify(j),'Queued')));return json({jobsConfigured:jobs.length,scopeStart:'2026-01-01'});}catch(e:any){return json({error:e.message},400);}}
