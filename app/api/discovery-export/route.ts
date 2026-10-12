import {db} from '../../../server/catalogue';
function cell(v:any){let s=typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export async function GET(request:Request){
 const u=new URL(request.url),status=u.searchParams.get('status')??'all',query=u.searchParams.get('query')??'';
 const cols=['title','url','sourceDate','dateKind','dateEvidence','status','reason','recordId','query','rank','retrievalAttempts','loggedAt'];
 const encoder=new TextEncoder();
 const stream=new ReadableStream({async start(controller){try{controller.enqueue(encoder.encode('\uFEFF'+cols.map(cell).join(',')+'\r\n'));let offset=0;for(;;){const data=await db().prepare('SELECT data FROM discovery_log WHERE (? = ? OR json_extract(data,?) = ?) AND (? = ? OR data LIKE ?) ORDER BY updated_at DESC,id LIMIT 300 OFFSET ?').bind(status,'all','$.status',status,query,'','%'+query+'%',offset).all();for(const row of data.results as any[]){const d=JSON.parse(row.data);controller.enqueue(encoder.encode(cols.map(k=>cell(d[k])).join(',')+'\r\n'));}if(data.results.length<300)break;offset+=300;}controller.close();}catch(e){controller.error(e);}}});
 return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="Bangladesh_Sand_Watch_discovery_log.csv"','Cache-Control':'no-store'}});
}
