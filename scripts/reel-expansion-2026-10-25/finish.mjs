import fs from 'node:fs';
import path from 'node:path';
import {root,output,directory,read,write,hash,mutableFiles} from './common.mjs';

const data=read(`${output}/build-data.json`),pages=read(`${output}/build-pages.json`);
const tests=read(`${output}/test-results.json`),csv=read(`${output}/csv-validation.json`);
const byBrand={},byFamily={};
for(const {config:c} of data.additions){
  byBrand[c.brand]=(byBrand[c.brand]||0)+1;
  const family=`${c.brand} ${c.model}`;
  byFamily[family]=(byFamily[family]||0)+1;
}
const files=[...mutableFiles,...pages.files.flatMap(page=>[page.blockFile,page.previewFile]),
  ...new Set(pages.media.map(image=>image.file)),
  ...['shimano','penn','13-fishing','daiwa','okuma','okuma-images','new-diameter-ratings','new-page-records'].map(name=>`${directory}/${name}.json`),
  ...fs.readdirSync(path.join(root,'scripts/reel-expansion-2026-10-25')).filter(file=>file.endsWith('.mjs')).map(file=>`scripts/reel-expansion-2026-10-25/${file}`)];
write(`${output}/release-manifest.json`,{
  status:'checked-locally-awaiting-publication-approval',
  baseCommit:read(`${output}/originals/manifest.json`).commit,
  files:files.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))})),
  doNotPublish:['research source PDFs and downloaded HTML','local output logs, originals and previews','unrelated pre-existing working files'],
  afterImport:'Verify imported URLs, then merge new-page-records.json by reelId into the current live page registry. Verify both hub lists and comparison search after publishing that registry.'
});
const before=read(`${output}/regressions-before.json`);
write(`${output}/batch-report.json`,{
  status:'prepared-not-published',newReels:data.additions.length,totalReels:data.totalReels,
  byBrand,byFamily,existingReelsChanged:0,newPages:pages.files.length,
  newReelsWithManufacturerDiameters:new Set(read(`${directory}/new-diameter-ratings.json`).map(row=>row.reel_id)).size,
  newManufacturerDiameterRatings:data.diameterRatings,tests,csv,
  shoppingAndAnalyticsBehavior:read(`${output}/shopping-test-results.json`),
  preExistingTestFailures:before.filter(test=>test.status!==0).map(test=>test.name),
  historicalShoppingDataLock:'Fails after the authorized reel additions because it expects byte-identical historical reel/affiliate JSON. All behavioral assertions pass in test-shopping.mjs; existing records and offers are independently verified unchanged.',
  csvAuthoringNote:'Artifact Tool authored the values and verified CSV round-trip equality. Its process returned code 1 on shutdown without an error after writing the success report; the saved CSV also passed an independent PowerShell import.',
  browserChecks:{localOnly:true,desktop:[1280,900],mobile:[390,844],
    representativePages:['Okuma Ceymar HD 3000','13 Fishing Concept A2 LH 5.6:1','PENN Spinfisher VI 6500','Daiwa Caldia LT 2025 LT2500S-XH','Okuma Helios SX 30'],
    capacity:'Ceymar HD mono reference 0.25 mm / 200 m scales to 236.3 m with 0.23 mm custom mono.',
    backing:'Ceymar HD: 100 yd J-Braid X4 20 lb plus 141.8 yd Trilene XL 8 lb shown on mobile.',
    fallback:'Concept A2: J-Braid X4 30 lb gives 245 yd using the unchanged mono fallback, with the existing explanatory caution.',
    wizard:'New Ceymar HD selected and recommendations rendered; all four footer/brand links retain _top.',
    comparison:'After local-only pending registry overlay, new Ceymar HD and Stella FJ exact-code search and comparison rendered.',
    limitations:['No native iPhone Safari on this Windows computer.','No production verification before publishing approval.','Comparison menu and live hubs must be finalized after Squarespace import.']},
  backup:`${output}/originals`,pendingRegistry:`${directory}/new-page-records.json`,
  held:data.held
});
console.log(JSON.stringify({byBrand,pages:pages.files.length,publishFiles:files.length,status:'prepared-not-published'}));
