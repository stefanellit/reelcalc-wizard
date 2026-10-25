import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {root,output,directory,read,write,hash,original,mutableFiles,identity} from './common.mjs';
const baseline=read(`${output}/originals/manifest.json`),reels=read('data/reels.json'),old=original('data/reels.json'),lines=read('data/lines.json');
for(const [file,sha]of Object.entries(baseline.hashes))if(!mutableFiles.includes(file))assert.equal(hash(fs.readFileSync(path.join(root,file))),sha,`Protected original changed: ${file}`);
for(const r of old)assert.deepEqual(reels.find(x=>x.id===r.id),r,`Existing reel changed ${r.id}`);
assert.deepEqual(lines,original('data/lines.json'));
assert.deepEqual(read('data/reel-pages.json'),original('data/reel-pages.json'));
const added=read(`${output}/build-data.json`).additions,records=added.map(x=>reels.find(r=>r.id===x.id));
assert.equal(reels.length,old.length+records.length);
for(const r of records){
  assert(!old.some(x=>identity(x.brand)===identity(r.brand)&&(identity(x.sku)===identity(r.sku)||identity(x.model+x.size_label)===identity(r.model+r.size_label))),'Duplicate '+r.id);
  assert(r.published_capacity_ratings.length&&r.spec_verification_sources.length);
  for(const c of r.published_capacity_ratings)assert(c.length>0&&c.sourceUrl.startsWith('https://'));
}
assert.equal(new Set(reels.map(r=>r.id)).size,reels.length);
const currentAff=read('data/reel-affiliates.json'),oldAff=original('data/reel-affiliates.json');
for(const [id,entry]of Object.entries(oldAff.reels))assert.deepEqual(currentAff.reels[id],entry);
const embeds=read('data/reel-page-embeds.json'),oldEmbeds=original('data/reel-page-embeds.json');
for(const [id,entry]of Object.entries(oldEmbeds.pages))assert.deepEqual(embeds.pages[id],entry);
const evidence=read('data/reel-diameter-evidence.json'),oldEvidence=original('data/reel-diameter-evidence.json');
for(const [id,entry]of Object.entries(oldEvidence.sources))assert.deepEqual(evidence.sources[id],entry);
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/calculator-core.js'),'utf8'),sandbox);
const core=sandbox.window.ReelCalcCore;
let anchors=0,diameterChecks=0,fallbackChecks=0,backingChecks=0;
for(const r of records){
  for(const a of r.manufacturer_capacity_ratings||[]){assert(a.calculation_eligible&&evidence.sources[a.id]);assert.equal(a.reel_id,r.id);anchors++;}
  for(const type of ['Monofilament','Fluorocarbon','Copolymer','Braid'])for(const mm of [.10,.21,.33,.48,.60]){
    const selected={type,lb:20,dia_in:mm/25.4,custom_line:true};
    const basis=core.manufacturerDiameterBasis(r,selected),full=core.calculateFullSpoolCapacity(r,selected,{lineCatalog:lines});
    assert(Number.isFinite(full)&&full>0,`${r.id} ${type} ${mm}`);
    if(basis){const a=basis.anchor.normalized;assert.equal(basis.anchor.material,type==='Braid'?'braid':'mono');assert(Math.abs(full-a.capacity_meters/.9144*(a.diameter_mm/mm)**2)<Math.max(1,full)*1e-8);diameterChecks++;}
    else{const legacy={...r};delete legacy.manufacturer_capacity_ratings;assert.equal(full,core.calculateFullSpoolCapacity(legacy,selected,{lineCatalog:lines}));fallbackChecks++;}
    const back={type:'Monofilament',lb:10,dia_in:.012};
    const mainFull=core.capacityBasisForActualLine(r,selected,lines).capacityYards,backFull=core.capacityBasisForActualLine(r,back,lines).capacityYards;
    const calc=core.calculateActualLineCalibratedBacking(r,selected,mainFull/2,back,lines);
    assert(Math.abs(calc.backingYards-backFull/2)<Math.max(1,backFull)*1e-8);backingChecks++;
  }
}
const built=read(`${output}/build-pages.json`),pending=read(`${directory}/new-page-records.json`);
assert.equal(built.files.length,records.length);assert.equal(pending.pages.length,records.length);
assert.equal(new Set(built.files.map(x=>x.slug)).size,records.length);
for(const f of built.files){
  assert(f.checks.every(x=>x.passed),f.name);
  assert(!/undefined|NaN|REPLACE_ME/.test(f.row.Description),f.name);
  assert.equal(f.row.Visible,'No');assert.equal(f.row['Product ID [Non Editable]'],'');assert.equal(f.row['Product Type [Non Editable]'],'SERVICE');
  assert.equal(Object.keys(f.row).length,built.headers.length);
  assert(f.row.Description.includes('FAQs')&&f.row.Description.includes('<table>')&&f.row.Description.includes('Setup Wizard'));
  const offer=currentAff.reels[f.id].offers.amazon.reel;
  assert.equal(offer.matchType,'search');assert.equal(offer.verifiedExact,false);
  assert.equal(new URL(offer.url).searchParams.get('tag'),oldAff.retailers.amazon.affiliateTag);
  assert(currentAff.retailers.amazon.disclosure.includes('Amazon Associate'));
  assert(fs.readFileSync(path.join(root,f.blockFile),'utf8').includes('data-reelcalc-affiliates'));
  assert.equal(embeds.pages[f.slug].reelId,f.id);
  assert(pending.pages.find(x=>x.reelId===f.id).editorial.intro);
  assert(fs.statSync(path.join(root,built.media.find(x=>x.reelId===f.id).file)).size>1000);
}
const summary={oldReelsPreserved:old.length,newReels:records.length,pages:built.files.length,verifiedDiameterRatings:anchors,diameterChecks,fallbackChecks,backingChecks,protectedFilesUnchanged:Object.keys(baseline.hashes).length-mutableFiles.length,allOriginalAffiliatesAndEmbedsPreserved:true};
write(`${output}/test-results.json`,summary);console.log(JSON.stringify(summary,null,2));
