import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {root,read,write,directory} from './research.mjs';
import {baseline,baseCommit,output} from './build-pages.mjs';
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const reels=read('data/reels.json'),lines=read('data/lines.json'),oldReels=baseline('data/reels.json'),oldLines=baseline('data/lines.json');
let checks=0;
for(const file of ['js/calculator-core.js','js/recommendation-engine.js','js/wizard.js','js/reel-page-calculator.js','js/line-page-engine.js','js/homepage-calculator-v2.js','js/capacity-config.js','js/capacity-resolver.js','js/capacity-service.js','js/squarespace-reel-page-loader.js','examples/reel-comparison.js','data/reel-pages.json']){
  assert.equal(source(file).replaceAll('\r\n','\n'),execFileSync('git',['show',`${baseCommit}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:30e6}).replaceAll('\r\n','\n'),`Protected file changed: ${file}`);checks++;
}
for(const r of oldReels){assert.deepEqual(reels.find(n=>n.id===r.id),r,`Existing reel changed: ${r.id}`);checks++;}
for(const l of oldLines){assert.deepEqual(lines.find(n=>n.id===l.id),l,`Existing line changed: ${l.id}`);checks++;}
for(const list of [reels,lines])assert.equal(new Set(list.map(r=>r.id)).size,list.length);
const c={window:{}};vm.runInNewContext(source('js/calculator-core.js'),c);const core=c.window.ReelCalcCore;
const fresh=read(`${output}/build-data.json`).newReels.map(r=>reels.find(x=>x.id===r.id));
const actuals=read(`${directory}/new-diameter-ratings.json`);
const evidence=read('data/reel-diameter-evidence.json');
let anchors=0,fallbacks=0,backing=0;
for(const reel of fresh){
  for(const a of reel.manufacturer_capacity_ratings||[]){
    assert.equal(a.reel_id,reel.id);assert(a.calculation_eligible);assert(a.normalized.diameter_mm>0&&a.normalized.capacity_meters>0);assert(a.source_url.startsWith('https://'));assert(evidence.sources[a.id]);anchors++;
  }
  for(const type of ['Monofilament','Fluorocarbon','Copolymer','Braid'])for(const mm of [.053,.10,.21,.33,.60]){
    const selected={type,lb:20,dia_in:mm/25.4,custom_line:true};
    const basis=core.manufacturerDiameterBasis(reel,selected);
    const result=core.calculateFullSpoolCapacity(reel,selected,{lineCatalog:lines});
    assert(Number.isFinite(result)&&result>0);
    if(basis){
      assert.equal(basis.anchor.material,type==='Braid'?'braid':'mono');
      const a=basis.anchor.normalized,expected=a.capacity_meters/.9144*(a.diameter_mm/mm)**2;
      assert(Math.abs(result-expected)<1e-8*Math.max(1,expected));
    }else{
      const stripped={...reel};delete stripped.manufacturer_capacity_ratings;
      assert.equal(result,core.calculateFullSpoolCapacity(stripped,selected,{lineCatalog:lines}));fallbacks++;
    }
    const back={type:'Monofilament',lb:10,dia_in:.012};
    const mainFull=core.capacityBasisForActualLine(reel,selected,lines).capacityYards;
    const backFull=core.capacityBasisForActualLine(reel,back,lines).capacityYards;
    const calc=core.calculateActualLineCalibratedBacking(reel,selected,mainFull/2,back,lines);
    assert(Math.abs(calc.backingYards-backFull/2)<1e-8*Math.max(1,backFull));backing++;checks++;
  }
}
assert.equal(anchors,81);assert.equal(reels.length-oldReels.length,26);assert.equal(lines.length-oldLines.length,6);
for(const [lb,mm]of [[4,.053],[6,.074],[8,.090],[10,.104],[12,.117],[15,.128]]){const l=lines.find(x=>x.id===`fins-bfs-ultralight-braid-${lb}`);assert.equal(l.dia_mm,mm);assert.equal(l.dia_in,mm/25.4);checks++;}
const pages=read(`${output}/build-pages.json`);
assert.equal(pages.files.length,18);assert.equal(pages.held.length,8);
for(const page of pages.files){assert(page.checks.every(c=>c.passed));assert(!/undefined|NaN|REPLACE_ME/.test(page.row.Description));assert.equal(page.row.Visible,'No');assert.equal(Object.keys(page.row).length,28);assert(page.row.Description.includes('<table>')&&page.row.Description.includes('FAQs')&&page.row.Description.includes('Setup Wizard'));checks++;}
assert.match(source('js/capacity-config.js'),/capacityOnlyEnabled:false/);
const result={checks,oldReelsPreserved:oldReels.length,oldLinesPreserved:oldLines.length,newReels:fresh.length,newLines:6,verifiedAnchors:anchors,fallbackChecks:fallbacks,backingChecks:backing,reelPages:18,heldPages:8,engineUnchanged:true,experimentalSwitchOff:true};
write(`${output}/test-results.json`,result);console.log(JSON.stringify(result,null,2));
