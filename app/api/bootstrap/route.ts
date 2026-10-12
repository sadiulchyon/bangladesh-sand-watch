import records from '../../../public/records.json';
import sources from '../../../public/source-registry.json';
import {db,json,writeGuard,insertRecords} from '../../../server/catalogue';
export async function POST(request:Request){try{writeGuard(request);const result=await insertRecords(records,true);const statements=sources.map(s=>db().prepare('INSERT OR IGNORE INTO source_registry(id,data) VALUES(?,?)').bind(s.id,JSON.stringify(s)));await db().batch(statements);return json({...result,sourcesConfigured:sources.length});}catch(e:any){return json({error:e.message},400);}}
