import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(readFileSync(new URL('./wrangler.jsonc',import.meta.url),'utf8'));
if(config.d1_databases[0].database_id==='00000000-0000-4000-8000-000000000000') throw new Error('Set the actual Cloudflare D1 database ID in cloudflare/wrangler.jsonc before deployment.');
const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['wrangler','deploy','--config','wrangler.jsonc'],{stdio:'inherit'});
if(result.error) throw result.error;
process.exit(result.status??1);
