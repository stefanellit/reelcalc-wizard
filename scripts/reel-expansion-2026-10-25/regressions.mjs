import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,output,write,snapshot} from './common.mjs';
snapshot();
const phase=process.argv[2]||'before';
const tests=['test-manufacturer-diameter-first','test-reel-page-capacity-integrity','test-reel-page-faq-context','test-reel-page-initialization','test-reel-page-line-selection','test-reel-comparison-parity','test-wizard-backing-parity','test-selected-line-capacity-warnings','test-shopping-tracking','test-wizard-navigation','reel-pages/test-intro-options'];
const results=[];
for(const name of tests){
  const result=spawnSync(process.execPath,[`scripts/${name}.mjs`],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8e6});
  results.push({name,status:result.status,error:result.error?.message,stdout:result.stdout,stderr:result.stderr});
  console.log(`${result.status===0?'PASS':'FAIL'} ${name}`);
}
write(`${output}/regressions-${phase}.json`,results);
if(phase==='after'){
  const before=JSON.parse(fs.readFileSync(path.join(root,output,'regressions-before.json')));
  const regressions=results.filter(x=>x.status!==0&&before.find(y=>y.name===x.name)?.status===0);
  console.log(JSON.stringify({newFailures:regressions.map(x=>x.name),preExistingFailures:before.filter(x=>x.status!==0).map(x=>x.name)}));
  if(regressions.length)process.exitCode=1;
}
