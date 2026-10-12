import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {root,write} from './research.mjs';
import {baseCommit,output} from './build-pages.mjs';
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64e6});
const commit=git('rev-parse','HEAD').toString().trim();
const changed=git('diff','--name-only',baseCommit,commit).toString().trim().split(/\r?\n/);
const production=changed.filter(file=>/^(data|assets|components|examples|generated|previews)\//.test(file));
assert(production.length>0,'No published support files');
assert(!changed.some(f=>f.startsWith('js/')),'Calculator scripts were changed');
const protectedFiles=['js/calculator-core.js','js/wizard.js','js/reel-page-calculator.js','js/line-page-engine.js','js/homepage-calculator-v2.js','js/recommendation-engine.js','js/capacity-config.js','data/reel-pages.json'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const checks=[];
for(const file of [...production,...protectedFiles]){
  const url=`https://stefanellit.github.io/reelcalc-wizard/${file}?release=${commit}`;
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
  assert(response.ok,`${response.status}: ${file}`);
  const bytes=Buffer.from(await response.arrayBuffer()),expected=git('show',`${commit}:${file}`);
  assert.equal(hash(bytes),hash(expected),`Live file does not match release: ${file}`);
  checks.push({file,status:response.status,sha256:hash(bytes)});
  console.log(`Verified ${file}`);
}
write(`${output}/publication.json`,{status:'Checked supporting data, images and page files are live. New Squarespace pages are not imported or published; both CSVs import hidden.',commit,verifiedAt:new Date().toISOString(),baseUrl:'https://stefanellit.github.io/reelcalc-wizard/',newSquarespacePagesPublished:false,checks});
console.log(`Verified ${checks.length} live files against release ${commit}.`);
