import {db,json,writeGuard,insertRecords} from '../../../server/catalogue';
export async function POST(request:Request){try{
 writeGuard(request);const body=await request.json();if(typeof body.runId!=='string'||!body.runId||body.runId.length>120)throw new Error('runId is required');
 const prior=await db().prepare('SELECT data FROM collection_runs WHERE id=?').bind(body.runId).first<{data:string}>();if(prior)return json({...JSON.parse(prior.data),replayed:true});
 const result=await insertRecords(body.records??[]);const now=new Date().toISOString();
 const checks=Array.isArray(body.sourceChecks)?body.sourceChecks.slice(0,40):[];
 for(const check of checks){if(typeof check.id!=='string')continue;await db().prepare('UPDATE source_registry SET checked_at=?,last_error=? WHERE id=?').bind(now,typeof check.error==='string'?check.error.slice(0,1000):null,check.id).run();}
 const run={id:body.runId,finishedAt:now,status:body.errors?.length?'partial':'completed',found:Number(body.found??0),...result,errors:Array.isArray(body.errors)?body.errors.slice(0,20):[],queries:Array.isArray(body.queries)?body.queries.slice(0,12):[]};
 await db().prepare('INSERT INTO collection_runs(id,data,created_at) VALUES(?,?,?)').bind(body.runId,JSON.stringify(run),now).run();return json(run);
 }catch(e:any){return json({error:e.message},400);}}
