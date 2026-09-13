import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadLinePackModels } from './line-pack-sources.mjs';
const base='research/line-pages/full-catalog';
const catalog=JSON.parse(fs.readFileSync('generated/line-pages/catalog-progress.json','utf8'));
const records=JSON.parse(fs.readFileSync('data/lines.json','utf8'));
const reels=JSON.parse(fs.readFileSync('data/reels.json','utf8'));
const release=JSON.parse(fs.readFileSync('data/line-page-release.json','utf8'));
const report={checkedAt:new Date().toISOString(),publishedBaseline:release.publishedProducts.length,models:[]};
const seen=new Set();
const fields=['h1','slug','seoTitle','metaDescription','construction','quickSummary','suitabilityTitle','suitabilitySummary','chartNote','sourceNote','reviewNote','localImagePath','imageUrl','imageAlt'];
for(const {group:dir, file, sourcePackSha256, model} of loadLinePackModels()){
    const errors=[],warnings=[];
    const check=(condition,message)=>{if(!condition)errors.push(message);};
    const inventory=catalog.entries.find(m=>m.id===model.id);
    check(inventory,'Not in scoped main catalog');
    check(!seen.has(model.id),'Assigned in more than one pack');seen.add(model.id);
    check(!release.publishedProducts.includes(model.id),'Already published; never include in new imports');
    check(inventory?.brand===model.brand&&inventory?.model===model.model,'Catalog brand/model mismatch');
    if(model.status==='source-verified'){
      check(model.sourceUrls?.length&&model.sourceUrls.every(s=>/^https?:\/\//.test(s)),'Missing web sources');
      check(model.sourceFiles?.length&&model.sourceFiles.every(f=>fs.existsSync(f)),'Missing saved source evidence');
      check(['mainline','leader'].includes(model.role),'Missing product role');
      check(model.rows?.length,'No numeric rows');
      const strengths=new Set();
      const sorted=[...model.rows].sort((a,b)=>a.lb-b.lb);
      for(const [i,row] of sorted.entries()){
        const prefix=`${row.lb} lb: `;
        check(!strengths.has(row.lb),prefix+'duplicate strength');strengths.add(row.lb);
        check([row.lb,row.dia_in,row.dia_mm].every(v=>Number.isFinite(v)&&v>0),prefix+'invalid numeric value');
        check(['published-in','published-mm','published-pair'].includes(row.diameterBasis),prefix+'missing diameter basis');
        check(typeof row.evidence==='string'&&row.evidence.trim().length>10&&/^https?:\/\//.test(row.sourceUrl||''),prefix+'missing row evidence');
        check(row.spool_sizes_yd?.length&&row.spool_sizes_yd.every(y=>Number.isFinite(y)&&y>0),prefix+'invalid package lengths');
        check(!i||row.dia_in>=sorted[i-1].dia_in,prefix+'diameter decreases as strength rises');
        const delta=Math.abs(row.dia_in*25.4-row.dia_mm);
        if(row.diameterBasis==='published-in')check(delta<0.0001,prefix+'incorrect mm conversion');
        if(row.diameterBasis==='published-mm')check(delta<0.0001,prefix+'incorrect inch conversion');
        if(row.diameterBasis==='published-pair'){
          check(delta<=0.018,prefix+'published units disagree beyond rounding tolerance');
          if(delta/row.dia_mm>0.035)warnings.push(prefix+'independently rounded unit pair needs explicit review');
        }
        const old=records.find(l=>l.brand===model.brand&&l.model===model.model&&l.type===model.lineType&&l.lb===row.lb);
        if(old&&Math.abs(old.dia_in-row.dia_in)>0.000001)warnings.push(prefix+`catalog diameter changes ${old.dia_in} -> ${row.dia_in}`);
        for(const p of row.retail_packages||[])if(p.meters)check(Math.abs(p.yards-p.meters/0.9144)<0.6,prefix+'incorrect package-unit conversion');
      }
      if(model.product){
        const p=model.product;
        check(p&&p.presentation==='gold','Missing gold configuration');
        if(p){
          fields.forEach(f=>check(typeof p[f]==='string'&&p[f].trim(),`Missing gold field ${f}`));
          ['strengthGuide','spoolingGuide','faqs','sources',...(model.role==='leader'?[]:['exampleSetups'])].forEach(f=>check(Array.isArray(p[f])&&p[f].length,`Missing ${f}`));
          check(p.brand===model.brand&&p.model===model.model&&p.lineType===model.lineType,'Product identity differs from evidence');
          check(fs.existsSync(p.localImagePath||''),'Missing actual product image');
          const defaultRow=model.rows.find(r=>(r.lineId||r.id||records.find(l=>l.brand===model.brand&&l.model===model.model&&l.type===model.lineType&&l.lb===r.lb)?.id||`${model.id}-${model.lineType.toLowerCase()}-${r.lb}`)===p.defaultLineId);
          check(defaultRow?.spool_sizes_yd.includes(p.defaultSpoolYards),'Default not supported by verified row/package');
          for(const example of p.exampleSetups||[])check(reels.some(r=>r.id===example.reelId),'Example reel missing: '+example.reelId);
          check(!/\b(undefined|NaN)\b/.test(JSON.stringify(p)),'Placeholder leak in gold configuration');
        }
      } else if(model.role==='leader') warnings.push('Requires reviewed leader-specific gold presentation before integration');
      else errors.push('Missing gold configuration');
    }
    report.models.push({id:model.id,group:dir,sourcePack:file,sourcePackSha256,role:model.role,status:model.status,rows:model.rows?.length||0,hash:crypto.createHash('sha256').update(JSON.stringify(model)).digest('hex'),errors,warnings,reason:model.reason});
}
report.summary={accounted:report.models.length,sourceVerified:report.models.filter(m=>m.status==='source-verified').length,structuralErrors:report.models.reduce((n,m)=>n+m.errors.length,0)};
fs.mkdirSync('reports',{recursive:true});
fs.writeFileSync('reports/full-line-pack-preflight.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
for(const m of report.models.filter(m=>m.errors.length))console.log(m.id,JSON.stringify(m.errors));
console.log('Structural checks only. This does not certify source accuracy or publication readiness.');
if(report.summary.structuralErrors)process.exitCode=1;
