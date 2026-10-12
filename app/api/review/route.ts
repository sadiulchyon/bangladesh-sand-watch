import {db,json,writeGuard} from '../../../server/catalogue';
export async function PATCH(request:Request){try{
 writeGuard(request);const body=await request.json();const entries=Object.entries(body.reviews??{});if(!entries.length||entries.length>500)throw new Error('Invalid review batch');
 const statements=[];
 for(const [id,v] of entries as [string,any][]){if(!['Pending','Accept','Revise','Reject'].includes(v.decision)||typeof v.notes!=='string'||v.notes.length>10000)throw new Error('Invalid review');const row=await db().prepare('SELECT id FROM archive_records WHERE id=?').bind(id).first();if(!row)throw new Error('Unknown record');statements.push(db().prepare('INSERT INTO editorial_reviews(record_id,decision,notes,updated_at) VALUES(?,?,?,?) ON CONFLICT(record_id) DO UPDATE SET decision=excluded.decision,notes=excluded.notes,updated_at=excluded.updated_at').bind(id,v.decision,v.notes,new Date().toISOString()));}
 await db().batch(statements);return json({saved:entries.length});
 }catch(e:any){return json({error:e.message},400);}}
