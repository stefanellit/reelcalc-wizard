import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {Workbook} from '@oai/artifact-tool';
import {root,read,write} from './research.mjs';
import {normalizeReel,requiredDataProblems} from '../reel-pages/lookup.mjs';
import {generateReelPage} from '../generate-reel-page.mjs';

const output='outputs/fierce-tiger-followup-2026-10-12';
const baseline='2156908209a7af9931c25d1c19384544abec1d80';
const original=file=>execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:64e6});
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const unchanged=['js/calculator-core.js','js/recommendation-engine.js','js/wizard.js','js/reel-page-calculator.js','js/line-page-engine.js','js/homepage-calculator-v2.js','js/capacity-config.js','js/capacity-resolver.js','js/capacity-service.js','js/squarespace-reel-page-loader.js','examples/reel-comparison.js','data/reel-pages.json','data/lines.json','data/reel-diameter-evidence.json'];
for(const file of unchanged)assert.equal(source(file).replaceAll('\r\n','\n'),original(file).replaceAll('\r\n','\n'),file);
const build=read(`${output}/build-pages.json`),reels=read('data/reels.json'),lines=read('data/lines.json');
const previous=JSON.parse(original('data/reels.json'));
const selected=new Set(build.files.map(p=>p.id));
assert.equal(build.files.length,8);assert.equal(build.held.length,0);
assert.equal(reels.length,previous.length);
assert.equal(new Set(reels.map(r=>r.id)).size,reels.length);
const allowed=new Set(['weight_oz','line_retrieve_in','weight_verification_status','weight_source_name','weight_source_url','weight_date_checked','ipt_original_value','ipt_original_unit','ipt_source_name','ipt_source_url','ipt_confidence','spec_verification_sources','spec_review_notes','spec_conflicts']);
for(const old of previous){
  const now=reels.find(r=>r.id===old.id);
  if(!selected.has(old.id)){assert.deepEqual(now,old);continue;}
  if(old.brand==='Shakespeare'){
    assert.deepEqual({...now,notes:old.notes},old,'Only the Tiger page-status note may change.');
    const disclosures=build.files.find(x=>x.id===old.id).unavailableSpecs;
    const normalized=normalizeReel(now);
    assert.deepEqual(requiredDataProblems(normalized).sort(),['line_retrieve_in','weight_oz','max_drag_lb'].sort());
    assert.deepEqual(requiredDataProblems(normalized,disclosures),[]);
    assert(requiredDataProblems({...normalized,capacityYards:0},{...disclosures,capacity_yards:'Not published'}).includes('capacity_yards'),'Disclosures cannot waive capacity evidence.');
    for(const field of ['weight_oz','max_drag_lb','line_retrieve_in'])assert.equal(now[field],null);
    continue;
  }
  for(const key of new Set([...Object.keys(now),...Object.keys(old)])){
    if(!allowed.has(key))assert.deepEqual(now[key],old[key],`${old.id} changed ${key}`);
  }
  assert(now.weight_oz>0&&now.line_retrieve_in>0);
  assert(now.spec_conflicts.length>0&&now.spec_review_notes.includes('unresolved'));
}
const embeds=read('data/reel-page-embeds.json'),oldEmbeds=JSON.parse(original('data/reel-page-embeds.json'));
for(const [slug,page] of Object.entries(oldEmbeds.pages))assert.deepEqual(embeds.pages[slug],page,`Existing page changed: ${slug}`);
assert.equal(Object.keys(embeds.pages).length-Object.keys(oldEmbeds.pages).length,8);
const oldFeatures=JSON.parse(original('data/reel-family-features.json')),features=read('data/reel-family-features.json');
for(const [key,value] of Object.entries(oldFeatures.families))assert.deepEqual(features.families[key],value);
const affiliates=read('data/reel-affiliates.json'),oldAffiliates=JSON.parse(original('data/reel-affiliates.json'));
for(const [id,offer] of Object.entries(oldAffiliates.reels))assert.deepEqual(affiliates.reels[id],offer);
for(const key of Object.keys(oldAffiliates).filter(k=>k!=='reels'))assert.deepEqual(affiliates[key],oldAffiliates[key]);
const runtime={window:{}};vm.runInNewContext(source('js/calculator-core.js'),runtime);
const core=runtime.window.ReelCalcCore,expected=[];
for(const item of build.files){
  assert(item.checks.every(c=>c.passed));
  assert(!/undefined|NaN|REPLACE_ME|TODO|>0 inches per crank|>0 oz/.test(item.row.Description));
  assert.equal(item.row.Visible,'No');assert.equal(item.row['Product ID [Non Editable]'],'');
  assert.equal(item.row['Product Type [Non Editable]'],'SERVICE');
  assert(!/<(?:script|input|select|button|iframe|style)\b/i.test(item.row.Description));
  if(item.id.startsWith('penn-'))assert(item.row.Description.includes('2026 North America catalog'));
  else {
    assert(item.row.Description.includes('Not confirmed in checked manufacturer sources'));
    assert(item.row.Description.includes('Not published in checked manufacturer sources'));
    assert(!item.row.Description.includes('0-inch'));
  }
  const stagedRegistry=read(`${output}/ACTIVATE-AFTER-IMPORT-reel-pages.json`);
  const future=generateReelPage(item.id,{registry:stagedRegistry});
  assert.equal(future.status,'generated',JSON.stringify(future.problems||future.validation?.failures));
  const reel=reels.find(r=>r.id===item.id),old=previous.find(r=>r.id===item.id);
  const tests=[];
  for(const type of ['Monofilament','Fluorocarbon','Copolymer','Braid'])for(const mm of [.15,.21,.30,.46,.65]){
    const line={type,lb:20,dia_in:mm/25.4,custom_line:true};
    const result=core.calculateFullSpoolCapacity(reel,line,{lineCatalog:lines});
    assert.equal(result,core.calculateFullSpoolCapacity(old,line,{lineCatalog:lines}));
    const basis=core.manufacturerDiameterBasis(reel,line);
    if(basis){
      assert.equal(basis.anchor.material,type==='Braid'?'braid':'mono');
      const a=basis.anchor.normalized;
      assert(Math.abs(result-a.capacity_meters/.9144*(a.diameter_mm/mm)**2)<1e-8);
    }else assert(type==='Braid' && reel.brand==='Shakespeare','Only Tiger braid should need fallback.');
    const backing={type:'Monofilament',lb:12,dia_in:.013};
    const back=core.calculateActualLineCalibratedBacking(reel,line,100,backing,lines);
    const oldBack=core.calculateActualLineCalibratedBacking(old,line,100,backing,lines);
    assert.equal(back.backingYards,oldBack.backingYards);
    tests.push({type,mm,fullYards:result,fullMeters:result*.9144,backingFor100Yards:back.backingYards});
  }
  expected.push({id:item.id,slug:item.slug,tests});
}
assert.equal(new Set(build.files.map(p=>p.row.SKU)).size,8);
const matrix=[build.headers,...build.files.map(p=>build.headers.map(h=>p.row[h]??''))];
assert.equal(build.headers.length,28);
const workbook=Workbook.create(),sheet=workbook.worksheets.add('Squarespace import');
const range=sheet.getRangeByIndexes(0,0,matrix.length,28);
range.setNumberFormat('@');range.values=matrix;
sheet.getRange('A1:E9').format.columnWidth=32;
sheet.getRange('A1:E9').format.wrapText=true;
sheet.getRange('A1:E9').format.rowHeight=48;
sheet.getRange('A1:AB1').format.font={bold:true};
workbook.recalculate();
const values=range.values.map(r=>r.map(v=>v==null?'':String(v)));
assert.deepEqual(values,matrix);
console.log((await workbook.inspect({kind:'table',range:"'Squarespace import'!A1:E9",include:'values,formulas',tableMaxRows:9,tableMaxCols:5,maxChars:2500})).ndjson);
if(!process.argv.includes('--no-preview')){
  const preview=await workbook.render({sheetName:'Squarespace import',range:'A1:E9',scale:1,format:'png'});
  fs.writeFileSync(path.join(root,output,'csv-preview.png'),new Uint8Array(await preview.arrayBuffer()));
}
const quote=value=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value;
const csv=values.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
const file=path.join(root,output,'UPLOAD-8-FIERCE-V-AND-TIGER-PAGES.csv');
fs.writeFileSync(file,csv,'utf8');
const restored=await Workbook.fromCSV(fs.readFileSync(file,'utf8'),{sheetName:'Check'});
assert.deepEqual(restored.worksheets.getItem('Check').getRangeByIndexes(0,0,matrix.length,28).values.map(r=>r.map(v=>v==null?'':String(v))),matrix);
write(`${output}/validation.json`,{checkedAt:new Date().toISOString(),file,rows:8,columns:28,hidden:true,csvRoundTrip:true,protectedFilesUnchanged:unchanged,unrelatedReelsPreserved:reels.length-8,existingPagesPreserved:Object.keys(oldEmbeds.pages).length,capacityAndBackingCases:expected.reduce((n,e)=>n+e.tests.length,0),engineUnchanged:true,expected});
console.log(`Verified 8 hidden import rows, ${reels.length-8} unchanged reels, 160 unchanged capacity/backing cases; CSV: ${file}`);
