import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loadLinePackModels, sha256 } from './line-pack-sources.mjs';
import { resolutionScopeLabel } from './line-resolution-scope.mjs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const save=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const base='research/line-pages/full-catalog';
const preflight=read('reports/full-line-pack-preflight.json');
const lines=read('data/lines.json');
const products=read('data/line-page-products.json');
const release=read('data/line-page-release.json');
const reviews=read('research/line-pages/review-status.json');
const ledgerFile=`${base}/staging-ledger.json`;
const ledger=fs.existsSync(ledgerFile)?read(ledgerFile):{models:{}};
const requested=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',');
const imported=new Set(read('generated/line-pages/imported-products.json').importedProducts);
const originalProducts=structuredClone(products);
const originalLines=structuredClone(lines);
const originalRelease=structuredClone(release);
const originalReviews=structuredClone(reviews);
const images=[];
const changed=[];
let baseline;
for(const {model,pack,file,group:dir,resolution,sourcePackSha256,reviewFile,reviewSha256} of loadLinePackModels()){
    if(requested&&!requested.includes(model.id))continue;
    if(model.status!=='source-verified'||!model.product)continue;
    if(imported.has(model.id)) {
      assert(!requested?.includes(model.id),`Already imported; frozen guide: ${model.id}`);
      continue;
    }
    assert(!release.publishedProducts.includes(model.id),`Already live: ${model.id}`);
    const hash=crypto.createHash('sha256').update(JSON.stringify(model)).digest('hex');
    const checked=preflight.models.find(m=>m.id===model.id);
    assert(checked?.hash===hash&&!checked.errors.length,`Run current structural preflight first: ${model.id}`);
    if(ledger.models[model.id]?.hash===hash&&(!resolution||ledger.models[model.id].integrationSchemaVersion===2))continue;
    const previous = ledger.models[model.id];
    const withdrawnRows = (previous?.updates || []).filter(update =>
      !model.rows.some(row => row.lb === update.updated.lb));
    if (!resolution && withdrawnRows.length && !previous.withdrawnAt) {
      baseline ||= JSON.parse(execFileSync('git', ['show', '8d15fd1:data/lines.json'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }));
      for (const update of withdrawnRows) {
        const index = lines.findIndex(line => line.id === update.id);
        assert.deepEqual(lines[index], update.updated, `Unrelated edit on withdrawn candidate row: ${update.id}`);
        const original = baseline.find(line => line.id === update.id);
        if (original) lines[index] = original;
        else lines.splice(index, 1);
      }
    }
    const oldRows=lines.filter(l=>l.brand===model.brand&&l.model===model.model&&l.type===model.lineType&&(!l.role||l.role===model.role));
    const mapping=new Map();
    const updates=[];
    for(const row of model.rows){
      const old=oldRows.find(l=>l.lb===row.lb);
      const id=old?.id||row.lineId||row.id||`${model.id}-${model.lineType.toLowerCase().replace(/\s+/g,'-')}-${row.lb}`;
      if(resolution)assert.equal(row.lineId||row.id,id,`Reviewed row ID differs from catalog identity: ${model.id}/${row.lb}`);
      assert(!lines.some(l=>l.id===id&&l!==old),`ID collision ${id}`);
      const metric=[...new Map((row.retail_packages||[]).filter(p=>Number(p.meters)>0).map(p=>[p.yards,{yards:p.yards,meters:p.meters}])).values()];
      const next={...old,id,brand:model.brand,model:model.model,type:model.lineType,role:model.role,
        lb:row.lb,dia_in:row.dia_in,dia_mm:row.dia_mm,spool_sizes_yd:[...new Set(row.spool_sizes_yd)].sort((a,b)=>a-b),
        retail_packages:metric,product_source_url:model.sourceUrls[0],diameter_source_url:row.sourceUrl,
        diameter_basis:row.diameterBasis,source_note:`Checked ${pack.checkedAt.slice(0,10)}. ${row.diameterBasis}; exact model-specific evidence retained in the source review.`,
        search_text:`${model.brand} ${model.model} ${model.lineType} ${row.lb} lb`.toLowerCase()};
      if(resolution){
        next.source_scope=model.product.chartNote;
        next.source_scope_label=resolutionScopeLabel(model,row);
        next.source_note=`Checked ${pack.checkedAt.slice(0,10)}. ${row.evidence} ${row.verificationScope||''} ${model.product.sourceNote}`.trim();
        next.source_pack={path:file,sha256:sourcePackSha256,modelSha256:hash,reviewFile,reviewSha256};
        // Keep complete SKU/color/printed-label evidence separate from normalized runtime packages.
        next.source_evidence=structuredClone(row);
      }
      const originalUpdate=resolution&&previous?.hash===hash?previous.updates.find(update=>update.id===id):null;
      updates.push({id,old:originalUpdate?originalUpdate.old:old||null,updated:next});
      mapping.set(row.lineId||row.id||id,id);
      if(old)lines[lines.indexOf(old)]=next;else lines.push(next);
    }
    const product=structuredClone(model.product);
    product.role=model.role;
    if(!resolution)product.defaultMode='capacity';
    product.defaultLineId=mapping.get(product.defaultLineId)||product.defaultLineId;
    product.excludedLineIds=[...new Set([...(product.excludedLineIds||[]),...oldRows.filter(l=>!model.rows.some(r=>r.lb===l.lb)).map(l=>l.id)])];
    // Gold examples follow the selected strength; repeating a reel would duplicate a card.
    if(!resolution)product.exampleSetups=model.role==='leader'?[]:[...new Map(product.exampleSetups.map(e=>[e.reelId,{...e,lineId:product.defaultLineId,spoolYards:product.defaultSpoolYards}])).values()];
    if(resolution){
      const sourceImage=product.localImagePath;
      const target=sourceImage.startsWith('assets/')?sourceImage:`assets/line-pages/full-catalog/${dir}/${model.id}${path.extname(sourceImage)}`;
      const imageSha256=sha256(fs.readFileSync(sourceImage));
      if(fs.existsSync(target))assert.equal(sha256(fs.readFileSync(target)),imageSha256,`Different existing asset: ${target}`);
      images.push({id:model.id,source:sourceImage,target,sha256:imageSha256});
      product.localImagePath=target;
    }
    products.products[model.id]=product;
    if(!release.products.includes(model.id))release.products.push(model.id);
    reviews[model.id]=resolution?{status:'source-reviewed-awaiting-local-validation',browserAudit:false,
      sourcePack:file,sourcePackSha256,sourceHash:hash,independentReview:reviewFile,independentReviewSha256:reviewSha256,
      notes:['Exact independently signed resolution staged locally. Source/SKU/date scope and exclusions retained. Browser checks and publication remain main-owned.']}:
      {status:'research-preview',browserAudit:false,notes:['Source pack structurally checked. Independent source/content review and calculator/browser audits still required.']};
    ledger.models[model.id]={hash,integrationSchemaVersion:resolution?2:undefined,stagedAt:new Date().toISOString(),sourcePack:file,sourcePackSha256,independentReview:reviewFile,independentReviewSha256:reviewSha256,updates,product,withdrawnRowIds:resolution?[]:withdrawnRows.map(row=>row.id)};
    changed.push({id:model.id,rows:updates.length,excluded:product.excludedLineIds.length});
}
assert.equal(new Set(lines.map(l=>l.id)).size,lines.length,'Duplicate catalog IDs');
for(const id of imported){
  assert.equal(JSON.stringify(products.products[id]),JSON.stringify(originalProducts.products[id]),`Frozen product changed: ${id}`);
  assert.deepEqual(reviews[id],originalReviews[id],`Frozen review changed: ${id}`);
}
const changedRowIds=new Set(changed.flatMap(entry=>ledger.models[entry.id].updates.map(row=>row.id)));
for(const row of originalLines)if(!changedRowIds.has(row.id))assert.equal(JSON.stringify(lines.find(line=>line.id===row.id)),JSON.stringify(row),`Unrelated catalog correction changed: ${row.id}`);
assert.deepEqual(release.publishedProducts,originalRelease.publishedProducts);
if(release.products.length!==originalRelease.products.length)release.version=String(Number(originalRelease.version)+1);
if(process.argv.includes('--apply')){
  for(const image of images)if(image.source!==image.target){
    fs.mkdirSync(path.dirname(image.target),{recursive:true});
    if(!fs.existsSync(image.target))fs.copyFileSync(image.source,image.target,fs.constants.COPYFILE_EXCL);
    assert.equal(sha256(fs.readFileSync(image.target)),image.sha256);
  }
  save('data/lines.json',lines);save('data/line-page-products.json',products);save('data/line-page-release.json',release);
  save('research/line-pages/review-status.json',reviews);save(ledgerFile,ledger);
  if(changed.length)save('reports/resolution-integration/staged.json',{stagedAt:new Date().toISOString(),models:changed,images,
    originalProductsUnchanged:imported.size,unrelatedRowsUnchanged:originalLines.filter(row=>!changedRowIds.has(row.id)).length,publishedProductsUnchanged:release.publishedProducts,
    version:release.version,publicationReady:false});
}
console.log(JSON.stringify({mode:process.argv.includes('--apply')?'local-preview-only':'dry-run',models:changed,publishedUnchanged:release.publishedProducts.length},null,2));
