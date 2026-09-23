import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const batch=process.argv[2]||'spinning-reel-expansion';
assert.ok(['spinning-reel-expansion','spinning-reel-followup'].includes(batch),'Unknown import batch.');
const out=path.join(root,'outputs',batch);
const build=JSON.parse(fs.readFileSync(path.join(out,'build.json'),'utf8'));
const results=[];
for(const page of build.files){
  const url=`https://www.reelcalc.com/reel-pages/p/${page.slug}`;
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
    const html=await response.text();
    results.push({name:page.name,slug:page.slug,url,finalUrl:response.url,status:response.status,
      expectedReel:html.includes(page.id),expectedModel:html.includes(page.row.MPN),
      title:html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||''});
  }catch(error){results.push({name:page.name,slug:page.slug,url,error:error.message});}
  if(results.length%25===0)console.log(`Checked ${results.length}/${build.files.length}`);
}
const summary={checkedAt:new Date().toISOString(),expected:build.files.length,
  present:results.filter(r=>r.status===200&&r.expectedReel&&r.expectedModel).length,
  notFound:results.filter(r=>r.status===404).length,
  uncertain:results.filter(r=>r.status!==404&&!(r.status===200&&r.expectedReel&&r.expectedModel)).length};
fs.writeFileSync(path.join(out,'live-import-check.json'),JSON.stringify({summary,results},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
