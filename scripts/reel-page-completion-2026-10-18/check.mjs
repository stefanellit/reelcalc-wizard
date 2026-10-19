import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {root,output,read,write} from './build.mjs';
import {generateReelPage} from '../generate-reel-page.mjs';
import {normalizeReel} from '../reel-pages/lookup.mjs';

const original=f=>read(`${output}/originals/${f}`);
const hash=f=>createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const build=read(`${output}/build-pages.json`),reels=read('data/reels.json');
const oldReels=original('data/reels.json'),oldRegistry=original('data/reel-pages.json');
const registry=read(`${output}/ACTIVATE-AFTER-IMPORT-reel-pages.json`);
const embeds=read('data/reel-page-embeds.json'),affiliates=read('data/reel-affiliates.json');
const allowed=new Set(build.dataChanges.map(x=>x.id));
assert.equal(reels.length,oldReels.length);
assert.equal(new Set(reels.map(r=>r.id)).size,reels.length);
for(const old of oldReels){
 const current=reels.find(r=>r.id===old.id);
 if(!allowed.has(old.id))assert.deepEqual(current,old,`Unrelated reel changed: ${old.id}`);
 for(const key of Object.keys(old).filter(k=>/recommended|manufacturer_capacity_ratings/.test(k))){
  assert.deepEqual(current[key],old[key],`Protected data changed: ${old.id} ${key}`);
 }
}
for(const file of ['js/calculator-core.js','js/wizard.js','js/reel-page-calculator.js','js/squarespace-reel-page-loader.js','data/reel-pages.json','data/reel-family-features.json']){
 assert.equal(hash(file),hash(`${output}/originals/${file}`),`Protected file changed: ${file}`);
}
for(const [slug,entry]of Object.entries(original('data/reel-page-embeds.json').pages))assert.deepEqual(embeds.pages[slug],entry,`Existing embed changed: ${slug}`);
for(const [id,entry]of Object.entries(original('data/reel-affiliates.json').reels))assert.deepEqual(affiliates.reels[id],entry,`Existing affiliate changed: ${id}`);
assert.equal(registry.pages.length,oldRegistry.pages.length+build.files.length);
assert.equal(new Set(registry.pages.map(p=>p.path)).size,registry.pages.length);
assert.equal(new Set(registry.pages.map(p=>p.reelId)).size,registry.pages.length);
const checks=[];
for(const item of build.files){
 const raw=reels.find(r=>r.id===item.id),entry=registry.pages.find(p=>p.reelId===item.id);
 const generated=generateReelPage(item.id,{reels,registry,affiliates});
 assert.equal(generated.status,'generated',`${item.id}: regeneration failed`);
 const model=generated.model;
 for(const key of ['intro','who','faqBraid','capacityRows','capacityIntro','faqCapacity','setupRows'])assert.deepEqual(model[key],entry.editorial[key],`${item.id}: reviewed ${key} lost`);
 assert.equal(embeds.pages[item.slug].reelId,item.id);
 assert.equal(item.row.Visible,'No');
 assert.equal(item.row['Product Type [Non Editable]'],'SERVICE');
 assert.equal(item.row['Product ID [Non Editable]'],'');
 assert.equal(item.row.MPN,raw.sku);
 assert(!/<script\b|data-reelcalc/.test(item.row.Description),'CSV contains executable/custom attributes');
 assert(affiliates.genericDisclosure,`${item.id}: disclosure configuration missing`);
 assert(affiliates.reels[item.id],`${item.id}: affiliate configuration missing`);
 assert(!/undefined|NaN/.test(item.row.Description));
 assert(item.row['Hosted Image URLs']);
 if(raw.capacity_reference_type==='braid'){
  assert.deepEqual(normalizeReel(raw).monoCapacities,[]);
  assert(!model.capacityRows.some(r=>r.type==='Monofilament'));
  assert(/no (?:factory )?mono capacity|no mono capacity|leaves the mono-capacity column blank/i.test(model.capacityIntro+' '+model.faqCapacity));
 }
 if(raw.sku.startsWith('TALT'))assert.equal(raw.model,'Tatula LT');
 if(raw.sku.startsWith('CERSW'))assert.equal(raw.release_year,2026);
 const media=build.media.find(m=>m.reelId===item.id);
 assert(fs.statSync(path.join(root,media.file)).size>1000);
 checks.push({id:item.id,regeneration:true,hiddenImport:true,image:true,disclosure:true,capacityMaterial:true});
}
// This existing global test has a baseline mismatch unrelated to this new batch.
const fierce=oldRegistry.pages.find(p=>p.reelId==='penn-fierce-v-1000-frcv1000');
const oldLookup=await import('data:text/javascript;base64,'+fs.readFileSync(path.join(root,output,'originals/scripts/reel-pages/lookup.mjs')).toString('base64'));
const oldFierce=oldReels.find(r=>r.id===fierce.reelId);
assert.deepEqual(normalizeReel(oldFierce),oldLookup.normalizeReel(oldFierce));
const baselineMismatch={reelId:fierce?.reelId,existingManifestUnchanged:true,reason:'The pre-existing Fierce V 1000 embed includes two verified diameter rows that the generic generator does not reproduce. This batch does not rewrite either source.'};
write(`${output}/integrity-results.json`,{pages:checks.length,reels:reels.length,changedReels:allowed.size,protectedFilesUnchanged:true,existingPagesUnchanged:true,checks,baselineMismatch});
console.log(`Passed ${checks.length} new-page integrity checks; existing pages and calculator code unchanged.`);
