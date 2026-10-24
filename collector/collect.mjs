// Automated collector for the public archive, run daily by .github/workflows/collect.yml.
//
// 1. Candidates: unread discovery-log backlog, GDELT and Bing News search, OpenAlex research.
// 2. Each page is actually read (direct download, Firecrawl as fallback) — never a search snippet.
// 3. GitHub Models writes the bilingual record from the article text, or rejects it as off-topic.
//    The source date comes only from the page's own metadata, never from the model.
// 4. Records are validated, de-duplicated by canonical URL / DOI and written to
//    snapshots/auto-<date>.json as Pending, marked auto-collected, with the run and discovery log.
import {Readability} from '@mozilla/readability';
import {parseHTML} from 'linkedom';
import {createHash} from 'node:crypto';
import {writeFileSync,appendFileSync} from 'node:fs';
import path from 'node:path';
import {loadArchive,categories,root} from '../scripts/archive-data.mjs';

const env=process.env;
const MAX_RECORDS=Number(env.MAX_RECORDS||12);
const MAX_MODEL_CALLS=Number(env.MAX_MODEL_CALLS||30);
const MAX_FETCHES=Number(env.MAX_FETCHES||60); // page downloads per run
const MAX_ATTEMPTS=3; // automated retrieval attempts before a backlog item is left for a person
const MODEL=env.MODEL||'openai/gpt-4.1-mini';
const DRY_RUN=env.DRY_RUN==='true';
const now=new Date(),stamp=now.toISOString();
const runId=`auto-${stamp.slice(0,16).replace(/[:T]/g,'-')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(...a);
const summary=[];

// ---------- identity (must match server/catalogue.ts) ----------
export function canonicalUrl(value){const u=new URL(value);if(!['https:','http:'].includes(u.protocol))throw new Error('Invalid source URL');u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(k))u.searchParams.delete(k);return u.toString();}
export const keyFor=value=>'BSW-'+createHash('sha256').update(value).digest('hex').slice(0,16);
const discoveryId=url=>'auto-'+createHash('sha256').update(url).digest('hex').slice(0,16);

// ---------- network ----------
const UA='Mozilla/5.0 (compatible; BangladeshSandWatch/1.0; +https://sadiulchyon.github.io/bangladesh-sand-watch/)';
async function get(url,{type='text',timeout=25000,headers={}}={}){
  const res=await fetch(url,{headers:{'User-Agent':UA,'Accept-Language':'bn,en;q=0.8',...headers},redirect:'follow',signal:AbortSignal.timeout(timeout)});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return {url:res.url||url,body:type==='json'?await res.json():await res.text()};
}

// ---------- candidate sources ----------
const relevant=/sand|gravel|stone|quarr|dredg|balumahal|বালু|পাথর|নুড়ি|ড্রেজ|বালুমহাল|উত্তোলন/i;
const backlogStatuses=new Set(['Awaiting retrieval','Awaiting source review','Retry','Body missing','Date unresolved','Failed retrieval']);
const priority=/prothomalo|jugantor|tbsnews|ittefaq|thedailystar|banglatribune|kalerkantho|dhakatribune|newagebd|bdnews24|samakal|bd-pratidin|jagonews24|risingbd|banglanews24|bonikbarta|dailysun|observerbd|bssnews/;

function backlog(archive){
  return archive.discovery.filter(d=>backlogStatuses.has(d.status)&&d.url&&(d.autoAttempts??0)<MAX_ATTEMPTS&&!/instagram|facebook|youtube|scribd|academia\.edu/.test(d.url))
    .sort((a,b)=>Number(priority.test(b.url))-Number(priority.test(a.url)))
    .map(d=>({url:d.url,title:d.title,query:d.query??'backlog',origin:'backlog',discovery:d}));
}
async function gdelt(){
  const q='(sand OR gravel OR stone OR dredging) (extraction OR mining OR quarry OR dredger) sourcecountry:bangladesh';
  try{
    const {body}=await get(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&format=json&maxrecords=75&timespan=21d&sort=datedesc`,{type:'json'});
    return (body.articles??[]).map(a=>({url:a.url,title:a.title,query:'GDELT: '+q,origin:'gdelt'}));
  }catch(e){log('GDELT failed:',e.message);return [];}
}
async function bing(){
  const queries=['বালু উত্তোলন','অবৈধ বালু উত্তোলন','বালুমহাল','পাথর উত্তোলন','sand extraction Bangladesh','sand mining Bangladesh','stone extraction Sylhet'];
  const out=[];
  for(const q of queries){
    try{
      const {body}=await get(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&setlang=${/[ঀ-৿]/.test(q)?'bn':'en'}&cc=BD`);
      // RSS <link> is not HTML (it would parse as a void element), so read items directly.
      for(const item of body.match(/<item>[\s\S]*?<\/item>/g)??[]){
        const field=tag=>decodeXml(item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))?.[1]??'');
        const link=field('link')||field('guid');
        if(!link)continue;
        let url=link;try{url=new URL(link).searchParams.get('url')||link;}catch{}
        out.push({url,title:field('title'),query:'Bing News: '+q,origin:'bing'});
      }
    }catch(e){log(`Bing "${q}" failed:`,e.message);}
    await sleep(1500);
  }
  return out;
}
async function openalex(){
  const out=[];
  for(const q of ['sand mining Bangladesh','sand extraction river Bangladesh','stone quarrying Sylhet','riverbed mining Bangladesh']){
    try{
      const {body}=await get(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=25&sort=relevance_score:desc&mailto=bangladesh-sand-watch@users.noreply.github.com`,{type:'json'});
      for(const w of body.results??[]){
        const abstract=fromInverted(w.abstract_inverted_index);
        if(!abstract||!w.doi)continue;
        out.push({url:w.doi,title:w.title,query:'OpenAlex: '+q,origin:'openalex',work:{...w,abstract}});
      }
    }catch(e){log(`OpenAlex "${q}" failed:`,e.message);}
    await sleep(1000);
  }
  return out;
}
const decodeXml=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').trim();
function fromInverted(index){if(!index)return '';const words=[];for(const [w,positions] of Object.entries(index))for(const p of positions)words[p]=w;return words.filter(Boolean).join(' ');}

// ---------- reading a page ----------
function metaDates(document){
  const pick=(...sel)=>{for(const s of sel){const v=document.querySelector(s)?.getAttribute('content');if(v)return v;}return '';};
  let published=pick('meta[property="article:published_time"]','meta[name="article:published_time"]','meta[itemprop="datePublished"]','meta[name="publish-date"]','meta[name="pubdate"]','meta[property="og:published_time"]');
  let modified=pick('meta[property="article:modified_time"]','meta[itemprop="dateModified"]','meta[property="og:updated_time"]');
  for(const s of document.querySelectorAll('script[type="application/ld+json"]')){
    try{for(const node of [JSON.parse(s.textContent)].flat().flatMap(n=>n['@graph']??[n])){published||=node.datePublished??'';modified||=node.dateModified??'';}}catch{}
  }
  return {published,modified};
}
const isoDay=v=>{if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':new Date(d.getTime()+6*3600e3).toISOString().slice(0,10);}; // Bangladesh time (UTC+6)
function cleanTitle(t,site){let s=String(t??'').replace(/\s+/g,' ').trim();for(const sep of [' | ',' - ',' – ',' — ',' :: ']){const parts=s.split(sep);if(parts.length>1&&parts.at(-1).length<40)s=parts.slice(0,-1).join(sep);}return s||String(t??'').trim();}

async function readPage(url){
  try{
    const {url:finalUrl,body}=await get(url);
    const {document}=parseHTML(body);
    const dates=metaDates(document),site=document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')??'';
    const ogTitle=document.querySelector('meta[property="og:title"]')?.getAttribute('content')||document.querySelector('h1')?.textContent||document.title;
    const article=new Readability(document).parse();
    const text=(article?.textContent??'').replace(/\s+/g,' ').trim();
    if(text.length>=600)return {ok:true,via:'direct',url:finalUrl,text,title:cleanTitle(ogTitle||article?.title,site),site,dates};
    throw new Error(`article text too short (${text.length} chars)`);
  }catch(e){
    if(!env.FIRECRAWL_API_KEY)return {ok:false,error:e.message};
    try{
      const res=await fetch('https://api.firecrawl.dev/v1/scrape',{method:'POST',headers:{'Authorization':`Bearer ${env.FIRECRAWL_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({url,formats:['markdown'],onlyMainContent:true}),signal:AbortSignal.timeout(60000)});
      const data=await res.json();
      if(!res.ok||!data.success)throw new Error(data.error??`Firecrawl HTTP ${res.status}`);
      const m=data.data.metadata??{},text=String(data.data.markdown??'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
      if(text.length<600)throw new Error(`Firecrawl text too short (${text.length} chars)`);
      return {ok:true,via:'firecrawl',url:m.sourceURL??url,text,title:cleanTitle(m.ogTitle??m.title,m.ogSiteName),site:m.ogSiteName??'',dates:{published:m.publishedTime??m['article:published_time']??'',modified:m.modifiedTime??m['article:modified_time']??''}};
    }catch(f){return {ok:false,error:`${e.message}; Firecrawl: ${f.message}`};}
  }
}

// ---------- the model ----------
const instructions=`You catalogue evidence for Bangladesh Sand Watch, a bilingual archive of reporting, official documents and research on sand, gravel, stone and soil extraction in Bangladesh.
Read ONLY the supplied text. Never add facts that are not in it. Keep the source's claim strength: allegations stay attributed ("residents alleged", "the paper reported"), never stated as fact.
First decide relevance: the text must substantively concern sand/gravel/stone/soil extraction, dredging, quarrying, balumahal leasing or their governance in Bangladesh. Passing mentions, other countries, or unrelated topics are NOT relevant.
Return JSON only:
{"relevant":true|false,"reason":"one sentence",
 "type":"News|Editorial|Context|Research|Project|Law|Rules|Lease",
 "source":"publisher or journal name",
 "district":"Bangladesh district(s) named in the text, separated by '; ', or 'National' or 'Unknown'",
 "river":"river(s), channel or site named in the text, separated by '; ', or 'Unknown'",
 "material":"Sand|Stone|Gravel|Soil or a '; ' list",
 "topics":"2-5 short topics separated by '; '",
 "en":"2-3 sentence attributed English summary",
 "bn":"the same summary in natural Bangla",
 "evidence":"what the text rests on (e.g. reporter's site visit, officials quoted, court order, abstract only)",
 "flag":"what a reviewer must still check, e.g. 'Allegations' or 'Abstract only'"}
If not relevant, return {"relevant":false,"reason":"..."} only.`;

// GitHub Models endpoints, tried in order by probeModel(); the first that returns a real chat
// completion is used for the run. Redirects are not followed so they show up in the log.
const endpoints=[
  {name:'models.github.ai',url:'https://models.github.ai/inference/chat/completions',model:MODEL,headers:{'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},json:true},
  {name:'models.inference.ai.azure.com (legacy)',url:'https://models.inference.ai.azure.com/chat/completions',model:MODEL.replace(/^[^/]+\//,''),headers:{},json:true}
];
let endpoint=null,modelCalls=0;
async function callModel(ep,messages){
  const res=await fetch(ep.url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(90000),
    headers:{'Authorization':`Bearer ${env.GITHUB_TOKEN}`,'Content-Type':'application/json',...ep.headers},
    body:JSON.stringify({model:ep.model,temperature:0.1,...(ep.json?{response_format:{type:'json_object'}}:{}),messages})});
  return {res,text:await res.text()};
}
// Model replies sometimes wrap JSON in prose or code fences; take the outermost object.
function parseReply(text){
  let data;try{data=JSON.parse(text);}catch{throw new Error(`model endpoint returned non-JSON: ${JSON.stringify(text.slice(0,120))}`);}
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content!=='string')throw new Error(`model response has no message content: ${JSON.stringify(text.slice(0,200))}`);
  const a=content.indexOf('{'),b=content.lastIndexOf('}');
  if(a<0||b<a)throw new Error(`model reply is not JSON: ${JSON.stringify(content.slice(0,120))}`);
  return JSON.parse(content.slice(a,b+1));
}
async function probeModel(){
  try{
    const res=await fetch('https://models.github.ai/catalog/models',{headers:{'Authorization':`Bearer ${env.GITHUB_TOKEN}`,'Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
    const text=await res.text();
    try{const ids=JSON.parse(text).map(m=>m.id);log(`Model catalog (${ids.length}): ${ids.slice(0,40).join(', ')}`);if(!ids.includes(MODEL))log(`! ${MODEL} is not in the catalog`);}
    catch{log(`Model catalog: HTTP ${res.status} ${text.slice(0,160)}`);}
  }catch(e){log('Model catalog failed:',e.message);}
  const messages=[{role:'system',content:'You answer with JSON only.'},{role:'user',content:'Return the JSON object {"ok": true}.'}];
  for(const ep of endpoints){
    for(const json of [true,false]){
      ep.json=json;
      try{
        const {res,text}=await callModel(ep,messages);
        log(`Probe ${ep.name} (model ${ep.model}, json mode ${json}): HTTP ${res.status}, ${res.headers.get('content-type')??'no content-type'}${res.headers.get('location')?', redirect to '+res.headers.get('location'):''}, body ${JSON.stringify(text.slice(0,200))}`);
        if(res.ok&&parseReply(text).ok===true){endpoint=ep;log(`Using ${ep.name} with model ${ep.model}.`);return true;}
      }catch(e){log(`Probe ${ep.name} (json mode ${json}) failed: ${e.message}`);}
    }
  }
  return false;
}
async function writeRecord(page,{kind='article'}={}){
  if(modelCalls>=MAX_MODEL_CALLS)throw new Error('model call budget reached');
  if(modelCalls)await sleep(4500); // free tier: about 15 requests per minute
  modelCalls++;
  const content=`Source URL: ${page.url}\nSite: ${page.site||'unknown'}\nTitle: ${page.title}\nMaterial type: ${kind}\n\nText:\n${page.text.slice(0,12000)}`;
  for(let attempt=1;attempt<=3;attempt++){
    const {res,text}=await callModel(endpoint,[{role:'system',content:instructions},{role:'user',content}]);
    if(res.status===429){const wait=Number(res.headers.get('retry-after')||60);log(`Model rate limited; waiting ${wait}s`);if(wait>120)throw new Error('model daily limit reached');await sleep(wait*1000);continue;}
    if(!res.ok)throw new Error(`model HTTP ${res.status}: ${text.slice(0,300)}`);
    return parseReply(text);
  }
  throw new Error('model rate limited three times');
}

// ---------- validation (mirrors validateRecord in server/catalogue.ts) ----------
const clean=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/\s+/g,' ').trim().slice(0,4000);
const bangla=/[ঀ-৿]/;
function buildRecord(page,out,extra){
  if(!out||out.relevant!==true)return {skip:out?.reason||'model returned no decision'};
  const r={type:clean(out.type),source:clean(out.source)||clean(page.site),title:clean(page.title),date:'',dateKind:'',
    district:clean(out.district)||'Unknown',river:clean(out.river)||'Unknown',material:clean(out.material)||'Sand',topics:clean(out.topics),
    language:bangla.test(page.title)||(page.text.match(/[ঀ-৿]/g)?.length??0)>page.text.length*0.3?'Bangla':'English',
    en:clean(out.en),bn:clean(out.bn),evidence:clean(out.evidence),documentId:'',otherDate:'',url:canonicalUrl(page.url),alternateUrl:'',...extra};
  r.flag=['Auto-collected: machine-written summary, verify against source',clean(out.flag)].filter(Boolean).join('; ');
  if(!categories.includes(r.type))return {skip:`invalid type ${r.type}`};
  for(const k of ['source','title','district','river','material','topics','en','bn','evidence','flag'])if(!r[k])return {skip:`missing ${k}`};
  if(!bangla.test(r.bn))return {skip:'Bangla summary is not in Bangla'};
  if(r.en.length<60||r.bn.length<40)return {skip:'summary too short'};
  return {record:r};
}

// ---------- main ----------
if(!await probeModel()){
  const msg='No working GitHub Models endpoint (see the probe lines above). Nothing was collected or saved.';
  log(msg);if(env.GITHUB_STEP_SUMMARY)appendFileSync(env.GITHUB_STEP_SUMMARY,`## Collector stopped\n\n${msg}\n`);
  process.exit(1);
}
const archive=loadArchive({log:()=>{}});
const knownUrls=new Set(),knownDois=new Set(archive.records.map(r=>String(r.documentId??'').toLowerCase()).filter(Boolean));
for(const r of archive.records){try{knownUrls.add(canonicalUrl(r.url));}catch{}}
const knownIds=new Set(archive.records.map(r=>r.id));

const fresh=[...await bing(),...await gdelt()].filter(c=>c.url&&relevant.test(c.title??''));
const research=await openalex();
// Fresh search hits first (most timely), then the older backlog.
const queue=[...fresh,...backlog(archive),...research];
const seen=new Set(),candidates=[];
for(const c of queue){
  let url;try{url=canonicalUrl(c.url);}catch{continue;}
  if(seen.has(url)||knownUrls.has(url)||knownIds.has(keyFor(url)))continue;
  if(c.work&&knownDois.has(c.work.doi.replace(/^https?:\/\/doi.org\//,'').toLowerCase()))continue;
  seen.add(url);candidates.push({...c,url});
}
log(`Candidates: ${candidates.length} (backlog ${candidates.filter(c=>c.origin==='backlog').length}, news search ${candidates.filter(c=>c.origin==='bing'||c.origin==='gdelt').length}, research ${candidates.filter(c=>c.origin==='openalex').length})`);

const records=[],discovery=[],errors=[];let fetches=0,modelFailures=0;
const logEntry=(c,status,reason,recordId)=>discovery.push({...(c.discovery??{}),autoAttempts:(c.discovery?.autoAttempts??0)+(status==='Awaiting retrieval'?0:1),id:c.discovery?.id??discoveryId(c.url),url:c.url,title:c.discovery?.title??c.title??c.url,query:c.discovery?.query??c.query,status,reason,recordId:recordId??c.discovery?.recordId,loggedAt:stamp,collector:'github-actions'});
// Alternate news and research so one source type cannot use up the whole budget.
const ordered=[];const news=candidates.filter(c=>c.origin!=='openalex'),papers=candidates.filter(c=>c.origin==='openalex');
while(news.length||papers.length){ordered.push(...news.splice(0,3));if(papers.length)ordered.push(papers.shift());}

for(const c of ordered){
  if(records.length>=MAX_RECORDS||modelCalls>=MAX_MODEL_CALLS||fetches>=MAX_FETCHES)break;
  try{
    let page,extra={};
    if(c.work){
      const w=c.work,doi=w.doi.replace(/^https?:\/\/doi.org\//,'');
      page={url:w.doi,title:w.title,site:w.primary_location?.source?.display_name??'',text:w.abstract};
      extra={documentId:doi,date:/^\d{4}-\d{2}-\d{2}$/.test(w.publication_date??'')?w.publication_date:'',dateKind:'Publication date (OpenAlex metadata)',
        notes:`Auto-collected ${stamp.slice(0,10)} from the OpenAlex abstract (abstract only; full text not read).`};
      if(page.text.length<300){logEntry(c,'Excluded','abstract too short to summarise');continue;}
    }else{
      fetches++;page=await readPage(c.url);
      if(!page.ok){logEntry(c,'Failed retrieval',page.error);errors.push(`${c.url}: ${page.error}`);continue;}
      if(!relevant.test(page.title+' '+page.text.slice(0,4000))){logEntry(c,'Excluded','no extraction terms in article text');continue;}
      const published=isoDay(page.dates.published),modified=isoDay(page.dates.modified);
      extra={date:published||modified,dateKind:published?'Publication date':modified?'Updated date':'',
        otherDate:published&&modified&&modified!==published?`Updated ${modified}`:'',
        notes:`Auto-collected ${stamp.slice(0,10)} (${page.via} retrieval, ${page.text.length} characters read). Date ${published?'from article:published_time / datePublished metadata':modified?'from modified-time metadata only':'not found in page metadata'}.`};
    }
    const out=await writeRecord(page,{kind:c.work?'research abstract':'article'});
    modelFailures=0;
    const built=buildRecord(page,out,extra);
    if(c.work&&built.record){built.record.type='Research';built.record.evidence=built.record.evidence||'Abstract only';if(!/abstract/i.test(built.record.flag))built.record.flag+='; Abstract only';}
    if(built.skip){logEntry(c,'Excluded',built.skip);log(`- excluded ${c.url}: ${built.skip}`);continue;}
    const r=built.record,id=keyFor(r.url);
    if(knownIds.has(id)||records.some(x=>x.id===id)){logEntry(c,'Already archived','duplicate canonical URL',id);continue;}
    records.push({...r,id,decision:'Pending',reviewNotes:'',collectedAt:new Date().toISOString(),auto:true,model:MODEL});
    logEntry(c,'Added to archive','auto-collected',id);
    log(`+ ${id} ${r.date||'undated'} ${r.source}: ${r.title.slice(0,90)}`);
    summary.push(`| ${r.date||'—'} | ${r.source} | [${r.title.replace(/\|/g,'/').slice(0,100)}](${r.url}) |`);
  }catch(e){
    errors.push(`${c.url}: ${e.message}`);log(`! ${c.url}: ${e.message}`);
    if(/^model/.test(e.message)&&++modelFailures>=3){log('Three model failures in a row; stopping.');break;}
    if(/budget|daily limit/.test(e.message))break;
  }
}
// Log new search hits that were not processed this run so they join the backlog.
for(const c of candidates)if(c.origin!=='backlog'&&!discovery.some(d=>d.url===c.url))logEntry(c,'Awaiting retrieval','found by automated search; not processed this run');

const run={id:runId,finishedAt:new Date().toISOString(),status:errors.length?'partial':'completed',found:candidates.length,added:records.length,fetches,duplicates:discovery.filter(d=>d.status==='Already archived').length,
  recordIds:records.map(r=>r.id),errors:errors.slice(0,20),queries:['Backlog','Bing News RSS','GDELT DOC API','OpenAlex'],collector:'github-actions',model:MODEL,modelCalls};
log(`Run ${runId}: ${records.length} records added, ${discovery.filter(d=>d.status==='Excluded').length} excluded, ${errors.length} errors, ${modelCalls} model calls.`);

if(env.GITHUB_STEP_SUMMARY){
  appendFileSync(env.GITHUB_STEP_SUMMARY,`## Collector run ${runId}\n\n${records.length} new records, ${modelCalls} model calls, ${errors.length} errors${DRY_RUN?' (dry run, nothing saved)':''}.\n\n`+(summary.length?`| Date | Source | Title |\n|---|---|---|\n${summary.join('\n')}\n`:'')+(errors.length?`\n<details><summary>Errors</summary>\n\n${errors.slice(0,30).map(e=>'- '+e.replace(/[<>]/g,'')).join('\n')}\n</details>\n`:''));
}
if(modelFailures>=3&&!records.length){log('Not saving: the model failed and no records were written.');process.exitCode=1;}
else if(!DRY_RUN&&(records.length||discovery.length)){
  const file=path.join(root,'snapshots',`${runId}.json`);
  writeFileSync(file,JSON.stringify({records,runs:[run],discovery},null,1));
  log(`Wrote ${path.relative(root,file)}`);
}
if(env.GITHUB_OUTPUT)appendFileSync(env.GITHUB_OUTPUT,`added=${records.length}\n`);
