import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {root,read,write} from './research.mjs';
import {normalizeReel} from '../reel-pages/lookup.mjs';
import {refreshIntros} from '../reel-pages/refresh-intros.mjs';

const out='outputs/spinning-reel-followup';
const build=read(out+'/build.json');
const baseline=file=>JSON.parse(execFileSync('git',['show',`${build.baseCommit}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:40e6}));
const oldReels=baseline('data/reels.json');
const oldRegistry=baseline('data/reel-pages.json');
const oldEmbeds=baseline('data/reel-page-embeds.json');
const oldAffiliates=baseline('data/reel-affiliates.json');
const reels=read(out+'/support/data/reels.json');
const manifest=read(out+'/support/data/reel-page-embeds.json');
const registry=read(out+'/ACTIVATE-AFTER-IMPORT-reel-pages.json');
const affiliates=read(out+'/support/data/reel-affiliates.json');
const verified=read('research/spinning-page-followup/reconciliation.json');
const ids=new Set(build.files.map(f=>f.id));
assert.equal(ids.size,build.files.length);
assert.equal(new Set(build.files.map(f=>f.slug)).size,ids.size);
assert.equal(build.files.length+build.held.length,168);
assert.equal(registry.pages.length,oldRegistry.pages.length+ids.size);
assert.equal(reels.length,oldReels.length);
assert.deepEqual(registry.pages.slice(0,oldRegistry.pages.length),oldRegistry.pages);
const activeRegistry=read('data/reel-pages.json');
if(activeRegistry.pages.length===oldRegistry.pages.length){
  assert.deepEqual(activeRegistry,oldRegistry,'Do not activate the directory before import.');
}else{
  const liveCheck=read(out+'/live-import-check.json');
  assert.equal(liveCheck.summary.present,ids.size);
  assert.equal(liveCheck.summary.notFound,0);
  assert.equal(liveCheck.summary.uncertain,0);
  assert.deepEqual(activeRegistry,{...registry,pages:registry.pages.map(page=>ids.has(page.reelId)?{...page,verifiedLive:true}:page)});
  const directorySandbox={window:{},URL,Map,Set,Array,Number,String,Math};
  vm.createContext(directorySandbox);
  vm.runInContext(fs.readFileSync(path.join(root,'js/reel-guide-list.js'),'utf8'),directorySandbox);
  const entries=directorySandbox.window.ReelCalcGuideList.mergeEntries(read('data/reel-guide-legacy.json'),activeRegistry,reels,new Set(),false);
  for(const file of build.files)assert.equal(entries.filter(entry=>entry.reelId===file.id&&entry.path==='/reel-pages/p/'+file.slug).length,1);
}
for(const r of oldReels)if(!ids.has(r.id))assert.deepEqual(reels.find(n=>n.id===r.id),r);
const refreshedOld=refreshIntros(structuredClone(oldEmbeds),reels,read('data/reel-family-features.json'));
for(const [slug,value] of Object.entries(oldEmbeds.pages)){
  const actual=manifest.pages[slug];
  assert.deepEqual(actual,{...value,intro:refreshedOld.pages[slug].intro,introVariant:refreshedOld.pages[slug].introVariant});
}
for(const key of Object.keys(oldEmbeds).filter(k=>!['pages','version'].includes(k)))assert.deepEqual(manifest[key],oldEmbeds[key]);
for(const [id,value] of Object.entries(oldAffiliates.reels))if(!ids.has(id))assert.deepEqual(affiliates.reels[id],value);
const sandbox={window:{},URL,URLSearchParams,Map,Set,Array,Number,String,Math};
vm.createContext(sandbox);
for(const file of ['calculator-core','line-selector'])vm.runInContext(fs.readFileSync(path.join(root,`js/${file}.js`),'utf8'),sandbox);
const core=sandbox.window.ReelCalcCore;
const lines=sandbox.window.ReelCalcLineSelector.prepareLines(read('data/lines.json'));
const selections=['powerpro-spectra-braid-15','seaguar-invizx-fluorocarbon-10','berkley-trilene-big-game-monofilament-10'].map(id=>lines.find(l=>l.id===id));
assert.ok(selections.every(Boolean));
const backing=selections[2];
for(const entry of Object.values(manifest.pages)){
  const reel=normalizeReel(reels.find(r=>r.id===entry.reelId));
  assert.ok(entry.intro.includes(reel.displayName)&&entry.intro.includes(reel.sku));
  assert.doesNotMatch(entry.intro,/working scale|capacity baseline|pulling margin|useful headroom|falls in the|comfortable for repeated|all-day comfort/i);
  assert.doesNotMatch(entry.intro,/for sealed spinning|for sealed budget spinning|for rear-drag\/quickfire style/i);
  assert.doesNotMatch(entry.intro,/\b(?:we|I) (?:tested|used|fished|found|caught)\b/i);
  assert.doesNotMatch(entry.intro,/\b(?:undefined|null|NaN)\b/);
  assert.ok(entry.intro.split(/\s+/).length<=150,'Keep introductions concise.');
  if(entry.introDetailMode==='verified-specifications'){
    const fact=`It weighs ${reel.weightOz} oz, brings in ${reel.retrieveIn} inches of line with each handle turn, and has a listed maximum drag of ${reel.maxDragLb} lb.`;
    assert.ok(entry.intro.includes(fact),`${entry.reelId}: exact specification sentence missing`);
    assert.equal(entry.intro.split(fact).length-1,1);
  }
  for(const name of entry.introFeatureNames)assert.ok(entry.intro.includes(name));
  if(/^(?:JP|JDM|Japan)$/i.test(reel.marketRegion))assert.ok(entry.intro.includes(`exact Japanese-market ${reel.sku} specifications`));
}
const pairs=rows=>Array.from(rows,r=>[Number(r.lb),Number(r.yards)]).sort((a,b)=>a[0]-b[0]);
let calculations=0;
for(const f of build.files){
  assert.ok(!oldRegistry.pages.some(p=>p.reelId===f.id||p.path.endsWith('/'+f.slug)));
  const r=reels.find(r=>r.id===f.id),v=verified.find(v=>v.id===f.id);
  assert.equal(v.status,'verified');
  for(const field of ['gear_ratio','weight_oz','line_retrieve_in','max_drag_lb','bearings'])assert.ok(v.official[field],`${f.id}: ${field} lacks manufacturer evidence`);
  assert.ok(r.sku&&!/VERIFY|PLACEHOLDER/i.test(r.sku));
  assert.equal(r.data_warnings.length,0);
  assert.deepEqual(pairs(r.capacity_options),pairs(v.official.mono));
  assert.deepEqual(pairs(normalizeReel(r).braidCapacities),pairs(v.official.braid));
  assert.deepEqual(pairs(core.publishedBraidCapacityOptions(r)),pairs(v.official.braid));
  assert.ok(core.isReelReady(r));
  assert.ok(f.checks.every(check=>check.passed!==false));
  const html=fs.readFileSync(path.join(root,f.blockFile),'utf8');
  assert.match(fs.readFileSync(path.join(root,f.previewFile),'utf8'),/<meta name="robots" content="noindex, nofollow">/);
  assert.ok(!html.includes('noindex'),'Squarespace guides must remain indexable.');
  assert.ok(html.includes('reel-page-calculator.js')&&html.includes('data-reelcalc-calculator'));
  assert.match(fs.readFileSync(path.join(root,'js/reel-page-calculator.js'),'utf8'),/js\/calculator-core\.js/);
  assert.ok(html.includes('data-reelcalc-affiliates'));
  assert.match(affiliates.retailers.amazon.disclosure,/As an Amazon Associate/);
  const offer=affiliates.reels[f.id].offers.amazon.reel;
  assert.equal(new URL(offer.url).searchParams.get('tag'),'reelcalc-20');
  assert.equal(offer.matchType,'search');
  assert.ok(fs.statSync(path.join(root,f.image.assetPath)).size>1000);
  assert.ok(manifest.pages[f.slug]);
  for(const related of manifest.pages[f.slug].related)assert.ok(oldRegistry.pages.some(p=>p.reelId===related.reelId));
  for(const line of selections){
    const capacity=core.calculateFullSpoolCapacity(r,line,{lineCatalog:lines});
    assert.ok(Number.isFinite(capacity)&&capacity>0&&capacity<50000,`${f.id}: invalid capacity`);
    const a=core.calculateActualLineCalibratedBacking(r,line,capacity*0.25,backing,lines);
    const b=core.calculateActualLineCalibratedBacking(r,line,capacity*0.75,backing,lines);
    assert.ok(a&&b&&!a.overCapacity&&!b.overCapacity,`${f.id}: backing failed`);
    assert.ok(Number.isFinite(a.backingYards)&&a.backingYards>b.backingYards&&b.backingYards>=0);
    const c=core.calculateActualLineCalibratedBacking(r,line,capacity*1.1,backing,lines);
    assert.ok(c.overCapacity,`${f.id}: overfill not detected`);
    assert.ok(Math.abs(core.metersToYards(core.yardsToMeters(capacity))-capacity)<1e-8);
    calculations+=4;
  }
  for(const row of r.capacity_options){
    assert.ok(Math.abs(core.calculateLineCapacityFromDiameter(row.yards,row.diameter_in,row.diameter_in)-row.yards)<1e-8);
  }
}
const report={pages:ids.size,held:build.held.length,existingPagesPreserved:oldRegistry.pages.length,calculationScenarios:calculations,status:'passed',checkedAt:new Date().toISOString()};
write(out+'/audit.json',report);
console.log(JSON.stringify(report,null,2));
