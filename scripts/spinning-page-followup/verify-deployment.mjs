import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {root,read,write} from './research.mjs';

const out='outputs/spinning-reel-followup';
const build=read(out+'/build.json');
const base='https://stefanellit.github.io/reelcalc-wizard/';
async function get(file){
  const response=await fetch(base+file,{signal:AbortSignal.timeout(40000)});
  assert.equal(response.status,200,file+' unavailable');
  return response;
}
const manifestVersion=read('data/reel-page-embeds.json').version;
const manifest=await (await get(`data/reel-page-embeds.json?v=${manifestVersion}`)).json();
assert.deepEqual(manifest,read('data/reel-page-embeds.json'));
const registry=await (await get('data/reel-pages.json')).json();
assert.deepEqual(registry,read('data/reel-pages.json'));
const importedIds=new Set(build.files.map(page=>page.id));
const additions=registry.pages.filter(page=>importedIds.has(page.reelId));
const directoryActivated=additions.length===build.files.length;
assert.ok(additions.length===0||directoryActivated,'Do not partially activate this verified batch.');
assert.equal(registry.pages.length,build.existingPageCount+additions.length);
if(directoryActivated)assert.ok(additions.every(page=>page.verifiedLive===true));
const reels=await (await get('data/reels.json')).json();
assert.deepEqual(reels,read('data/reels.json'));
const affiliates=await (await get('data/reel-affiliates.json')).json();
assert.deepEqual(affiliates,read('data/reel-affiliates.json'));
const loader=await (await get('js/squarespace-reel-page-loader.js')).text();
assert.ok(loader.includes(`reel-page-embeds.json?v=${manifestVersion}`));
let assets=0;
for(const file of new Set(build.files.map(f=>f.image.assetPath))){
  const response=await get(file);
  assert.match(response.headers.get('content-type'),/^image\//);
  const bytes=Buffer.from(await response.arrayBuffer());
  const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
  assert.equal(hash(bytes),hash(fs.readFileSync(path.join(root,file))));
  assets++;
}
for(const file of build.files){
  const html=await (await get(file.previewFile)).text();
  assert.ok(html.includes(file.id)&&html.includes('data-reelcalc-calculator'));
  assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'));
}
const report={state:'published-and-verified',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),pages:build.files.length,held:build.held.length,manifestVersion:manifest.version,verifiedImageAssets:assets,verifiedHostedPreviews:build.files.length,existingDirectoryPages:build.existingPageCount,totalDirectoryPages:registry.pages.length,imported:directoryActivated,directoryActivated,checkedAt:new Date().toISOString(),deployment:process.argv[2]||'See repository GitHub Pages deployment history.'};
write(out+'/release-status.json',report);
console.log(JSON.stringify(report,null,2));
