import {execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {writeFileSync} from 'node:fs';
let ttyHidden=false;
if(process.stdin.isTTY){execFileSync('stty',['-echo','-icanon'],{stdio:['inherit','ignore','ignore']});ttyHidden=true;}
const restore=()=>{if(ttyHidden){try{execFileSync('stty',['echo','icanon'],{stdio:['inherit','ignore','ignore']});}catch{}}};
process.on('exit',restore);
console.log('Ready for one Site API request JSON on stdin (input is hidden).');
const reader=createInterface({input:process.stdin});
reader.once('line',async line=>{reader.close();try{
 const input=JSON.parse(line),origin=new URL(input.siteUrl);if(origin.protocol!=='https:')throw new Error('HTTPS required');
 const url=new URL(input.path,origin);if(url.origin!==origin.origin||!url.pathname.startsWith('/api/'))throw new Error('Site API path required');
 const response=await fetch(url,{method:input.method??'GET',headers:{'OAI-Sites-Authorization':'Bearer '+input.token,...(input.body?{'Content-Type':'application/json'}:{})},body:input.body?JSON.stringify(input.body):undefined,redirect:'error'});
 const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{throw new Error('API returned a non-JSON response ('+response.status+')');}
 if(input.outputPath&&response.ok){writeFileSync(input.outputPath,JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({status:response.status,savedData:input.outputPath}));return;}
 if(input.summary&&data.records)data={recordCount:data.records.length,recordIds:data.records.map(r=>r.id),pending:data.records.filter(r=>data.reviews[r.id]?.decision==='Pending').length,sourceCount:data.sources?.length,reviews:data.reviews,runs:data.runs};
 if(input.summary&&data.sourceRegistry)data={version:data.version,maxSearchQueries:data.maxSearchQueries,maxNewRecords:data.maxNewRecords,sourceCount:data.sourceRegistry.length,executionSteps:data.execution?.length};
 console.log(JSON.stringify({status:response.status,data}));if(!response.ok)process.exitCode=1;
 }catch(e){console.error('Site API request failed: '+e.message);process.exitCode=1;}finally{restore();}});
