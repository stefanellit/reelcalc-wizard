import assert from 'node:assert/strict';
import {read,write} from './research.mjs';

const out='outputs/spinning-reel-expansion';
const build=read(out+'/build.json');
const check=read(out+'/live-import-check.json');
const staged=read(out+'/ACTIVATE-AFTER-IMPORT-reel-pages.json');
const current=read('data/reel-pages.json');
const manifest=read('data/reel-page-embeds.json');
const newIds=new Set(build.files.map(page=>page.id));
const results=new Map(check.results.map(result=>[result.slug,result]));
assert.equal(check.summary.present,build.files.length);
assert.equal(check.summary.uncertain,0);
assert.equal(check.summary.notFound,0);
assert.ok(Date.now()-Date.parse(check.summary.checkedAt)<24*60*60*1000,'Repeat the live check before activation.');
assert.equal(results.size,build.files.length);
for(const page of build.files){
  const result=results.get(page.slug);
  const url='https://www.reelcalc.com/reel-pages/p/'+page.slug;
  assert.ok(result&&result.status===200&&result.expectedReel&&result.expectedModel,page.slug);
  assert.equal(result.url,url);
  assert.equal(result.finalUrl,url);
  assert.equal(manifest.pages[page.slug]?.reelId,page.id);
}
assert.deepEqual(current.pages.filter(page=>!newIds.has(page.reelId)),staged.pages.filter(page=>!newIds.has(page.reelId)),'Preserve existing directory entries.');
const registry={...staged,pages:staged.pages.map(page=>newIds.has(page.reelId)?{...page,verifiedLive:true}:page)};
assert.equal(registry.pages.length,build.existingPageCount+newIds.size);
assert.equal(new Set(registry.pages.map(page=>page.path)).size,registry.pages.length);
assert.equal(new Set(registry.pages.map(page=>page.reelId)).size,registry.pages.length);
write('data/reel-pages.json',registry);
write(out+'/activation.json',{activatedAt:new Date().toISOString(),liveCheckAt:check.summary.checkedAt,added:newIds.size,total:registry.pages.length,version:registry.version});
console.log(`Activated ${newIds.size} verified live reel guides; ${registry.pages.length} total.`);
