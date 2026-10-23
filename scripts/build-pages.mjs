// Builds the public, read-only GitHub Pages site into _site/ from the archive data
// (see scripts/archive-data.mjs for how the D1 snapshot and snapshots/*.json are combined).
import {readFileSync,writeFileSync,rmSync,mkdirSync,cpSync} from 'node:fs';
import path from 'node:path';
import {loadArchive,root} from './archive-data.mjs';

const out=path.join(root,'_site');
const archive=loadArchive();

rmSync(out,{recursive:true,force:true});
cpSync(path.join(root,'public'),out,{recursive:true});
mkdirSync(path.join(out,'data'),{recursive:true});
writeFileSync(path.join(out,'data/archive.json'),JSON.stringify(archive));
const index=path.join(out,'index.html'),html=readFileSync(index,'utf8');
if(!html.includes('<html lang="en">'))throw new Error('Expected <html lang="en"> in public/index.html');
writeFileSync(index,html.replace('<html lang="en">','<html lang="en" data-mode="public">'));
writeFileSync(path.join(out,'.nojekyll'),'');
console.log(`Built _site: ${archive.records.length} records, ${archive.sources.length} sources, ${archive.discovery.length} discovery entries, ${archive.backfill.length} backfill jobs.`);
