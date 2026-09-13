import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { parse } from './line-page-publishing/node_modules/parse5/dist/index.js';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const lines=read('data/lines.json'),products=read('data/line-page-products.json').products;
const batch=read('research/line-pages/batch-two-specs.json'),evidence=read('research/line-pages/batch-two-evidence.json');
const publishedMode=process.argv.includes('--published');
const walk=(n,p)=>[...(p(n)?[n]:[]),...(n.childNodes||[]).flatMap(c=>walk(c,p))];
const attr=(n,key)=>n.attrs?.find(a=>a.name===key)?.value;
const text=n=>walk(n,n=>n.nodeName==='#text').map(n=>n.value).join('');
let checks=0;const check=(v,label)=>{checks++;assert(v,label);};
for(const item of batch){
  const p=products[item.id],ev=evidence[item.id];
  const offered=lines.filter(l=>l.brand===item.brand&&l.model===item.model&&!p.excludedLineIds.includes(l.id));
  check(offered.length===ev.rows.length,item.id+' complete strengths');
  const page=parse(fs.readFileSync(`examples/line-pages/${item.id}.html`,'utf8'));
  const chart=walk(page,n=>!!attr(n,'data-chart-line'));
  check(chart.length===offered.length,item.id+' chart completeness');
  for(const line of offered){
    const row=ev.rows.find(r=>r.lb===line.lb),node=chart.find(n=>attr(n,'data-chart-line')===line.id),cells=node.childNodes.filter(n=>n.tagName==='td');
    check(line.dia_in===row.dia_in&&line.dia_mm===row.dia_mm,line.id+' verified numbers');
    check(Number(text(cells[0]))===line.dia_in&&Number(text(cells[1]))===line.dia_mm,line.id+' visible precision');
    check(JSON.stringify(line.spool_sizes_yd)===JSON.stringify(row.spool_sizes_yd),line.id+' packages');
    check(Math.abs(line.dia_in*25.4-line.dia_mm)/line.dia_mm<.035,line.id+' unit plausibility');
    if(item.metric){
      check(Math.abs(line.dia_in-line.dia_mm/25.4)<.00000051,line.id+' metric conversion');
      for(const pack of line.retail_packages)check(Math.abs(pack.yards*.9144-pack.meters)<.005,line.id+' length conversion');
    }else check(line.source_skus.length>0,line.id+' assigned SKU evidence');
  }
  for(const id of p.excludedLineIds)check(!chart.some(n=>attr(n,'data-chart-line')===id),id+' excluded');
  check(read('data/line-page-release.json').publishedProducts.includes(item.id)===publishedMode,item.id+(publishedMode?' is published':' remains review-only'));
}
const find=(model,lb)=>lines.find(l=>l.brand==='Sunline'&&l.model===model&&l.lb===lb);
check(find('FC Sniper',8).dia_in===.0093,'FC Sniper 8 lb primary chart');
check(find('Shooter',25).dia_mm===.435,'Shooter US 25 lb not Sniper 25 lb');
check(find('Assassin FC',12).spool_sizes_yd.join(',')==='225,660,1200','Assassin 12 lb assigned extra bulk');
check(find('Super Natural Mono',80).spool_sizes_yd.join(',')==='3300','Super Natural 80 lb bulk only');
check(find('SX1',8).spool_sizes_yd.join(',')==='600','SX1 8 lb bulk only');
check(find('Xplasma Asegai',20).spool_sizes_yd.join(',')==='330','Asegai 20 lb retail length');
check(find('Siglon PE X8',60).spool_sizes_yd.join(',')==='1980','Siglon heavy size bulk only');
const window={};vm.runInNewContext(fs.readFileSync('js/affiliate-links.js','utf8'),{window,URL});
const affiliateData=read('data/reel-affiliates.json');
for(const [model,lb,meters] of [['Shooter Machinegun Cast',12,150],['Shooter Machinegun Cast',25,100],['Shooter BMS Azayaka FC',8,80],['Shooter BMS Azayaka FC',8,320]]){
  const line=find(model,lb),pack=line.retail_packages.find(p=>p.meters===meters);
  const offer=window.ReelCalcAffiliateLinks.buildRecommendedLineOffer({affiliateData,line,spoolYards:pack.yards,requiredYards:pack.yards});
  check(new URL(offer.url).searchParams.get('k').includes(`${meters} meter spool`),model+' correct Amazon package unit');
  check(offer.suggestedSpoolYards===pack.yards,model+' purchase amount unchanged');
}
console.log(JSON.stringify({passed:true,models:batch.length,strengths:batch.reduce((n,p)=>n+evidence[p.id].rows.length,0),checks}));
