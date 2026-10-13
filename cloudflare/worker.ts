import {authorized,denied} from './auth.mjs';
import * as archive from '../app/api/archive/route';
import * as backfill from '../app/api/backfill/route';
import * as discoveryExport from '../app/api/discovery-export/route';
import * as ingest from '../app/api/ingest/route';
import * as review from '../app/api/review/route';
import * as updatePlan from '../app/api/update-plan/route';

// Authentication runs before every asset and API request. Never trust the
// ChatGPT-specific identity headers on this independently hosted Worker.
export default {
  async fetch(request:Request, env:any):Promise<Response> {
    if(!await authorized(request,env)) return denied();
    const url=new URL(request.url),p=url.pathname;
    if(request.method==='GET') {
      if(p==='/api/archive') return archive.GET();
      if(p==='/api/backfill') return backfill.GET();
      if(p==='/api/discovery-export') return discoveryExport.GET(request);
      if(p==='/api/update-plan') {
        const result=await updatePlan.GET(); const plan=await result.json() as any;
        return Response.json({...plan,maxNewRecords:10,hosting:'Cloudflare Workers Free',writeBatchLimits:{records:10,reviews:20,logs:40},bootstrap:'Import cloudflare/initial-data_v2.sql with Wrangler. HTTP bootstrap is disabled.'});
      }
    }
    if(p.startsWith('/api/')) {
      if(!['POST','PATCH'].includes(request.method)) return new Response('Not found',{status:404});
      if(!request.headers.get('content-type')?.includes('application/json')) return new Response('JSON required',{status:415});
      const origin=request.headers.get('origin');
      if(origin&&origin!==url.origin) return new Response('Cross-origin writes refused',{status:403});
      // Read the actual bytes too; Content-Length can be missing or dishonest.
      const reader=request.body?.getReader();const parts:Uint8Array[]=[];let size=0;
      if(reader) while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){await reader.cancel();return new Response('Request too large',{status:413});}parts.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
      let body:any;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return new Response('Invalid JSON',{status:400});}
      if(!body||typeof body!=='object')return new Response('JSON object required',{status:400});
      const replay=new Request(request.url,{method:request.method,headers:request.headers,body:bytes});
      if(p==='/api/ingest'&&request.method==='POST') {
        if((body.records?.length??0)>10||(body.sourceChecks?.length??0)>5)return new Response('Free plan: at most 10 records and 5 source checks per request',{status:400});
        return ingest.POST(replay);
      }
      if(p==='/api/review'&&request.method==='PATCH') {
        if(Object.keys(body.reviews??{}).length>20)return new Response('Free plan: at most 20 reviews per request',{status:400});
        return review.PATCH(replay);
      }
      if(p==='/api/backfill'&&request.method==='POST') {
        if((body.searches?.length??0)+(body.hits?.length??0)+(body.jobs?.length??0)>40)return new Response('Free plan: at most 40 log entries per request',{status:400});
        return backfill.POST(replay);
      }
      return new Response('Not found',{status:404});
    }
    if(!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
    return env.ASSETS.fetch(request);
  }
};
