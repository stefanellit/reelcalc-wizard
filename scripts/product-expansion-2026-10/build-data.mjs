import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { root, directory, read, write } from './research.mjs';

export const output = 'outputs/product-expansion-2026-10-12';
export const baseCommit = 'dd1a66e8ee2d2195d8ae44dcde382213d204f48d';
export const baseline = file => JSON.parse(execFileSync('git', ['show', `${baseCommit}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 64e6 }));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sourceManifest = read(`${directory}/sources.json`);
const extracted = key => read(`${directory}/extracted/${key}.json`);
const source = key => {
  const item = Object.entries(sourceManifest).find(([, value]) => value.file.endsWith(`${key}.txt`));
  assert(item?.[1]?.ok, `Missing saved source ${key}`);
  return { url: item[0], ...item[1] };
};
const reels = baseline('data/reels.json');
const lines = baseline('data/lines.json');
const evidence = baseline('data/reel-diameter-evidence.json');
const features = baseline('data/reel-family-features.json');
const additions = [];
const rawRatings = [];
const conflicts = [];

// This is the existing importer reference table, not manufacturer diameter evidence.
const monoDiameter = lb => [[2,.006],[4,.008],[6,.0095],[8,.011],[10,.012],[12,.014],[15,.015],[20,.018],[25,.019],[30,.022],[Infinity,.025]].find(([max]) => lb <= max)[1];
const pairs = value => [...String(value).matchAll(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/g)].map(([, yards, lb]) => [+lb, +yards]);
const tableRow = (key, identity) => {
  const rows = extracted(key).tables[0];
  const row = rows?.find(row => row[0] === identity);
  assert(row, `No exact ${identity} row in ${key}`);
  return Object.fromEntries(rows[0].map((header, index) => [header, row[index]]));
};
function productImage(key, numericSku) {
  const data = extracted(key);
  const variant = data.product?.variants.find(item => item.sku === numericSku);
  const filename = data.variants?.[variant?.id]?.images?.split(',')[0].trim();
  const image = data.product?.images.find(url => filename && url.includes(filename));
  const result = image || variant?.featured_image?.src;
  assert(result, `No exact product image: ${key}/${numericSku}`);
  return result.startsWith('//') ? `https:${result}` : result;
}
function addReel(config) {
  const id = slug(`${config.brand} ${config.model} ${config.size} ${config.sku}`);
  const normalize = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  assert(!reels.some(r => r.id === id || (normalize(r.brand) === normalize(config.brand) &&
    (normalize(r.sku) === normalize(config.sku) || normalize(`${r.model}${r.size_label}`) === normalize(`${config.model}${config.size}`)))), `Duplicate reel ${id}`);
  const options = config.mono.map(([lb, yards]) => ({lb, yards, diameter_in: monoDiameter(lb), spool_space: Number((yards * monoDiameter(lb) ** 2).toFixed(6)), raw: `${lb}-${yards}`}));
  assert(options.length, `Missing official mono capacity for ${config.sku}`);
  const anchor = options[Math.floor(options.length / 2)];
  const s = source(config.sourceKey);
  const reel = {
    id, brand: config.brand, model: config.model, sku: config.sku, size_label: String(config.size), size_class: String(config.sizeClass || config.size),
    recommendation_size_class: config.recommendationSize || Number(config.sizeClass || config.size),
    reel_type: config.baitcast ? (config.round ? 'round_baitcast' : 'low_profile_baitcast') : 'Spinning reel',
    ...(config.baitcast ? {baitcaster_class: config.round ? 'round_casting' : 'standard', retrieve_hand: config.hand || 'RH'} : {retrieve_hand:'reversible'}),
    capacity_yards: anchor.yards, rated_line_lb: anchor.lb, rated_line_diameter_in: anchor.diameter_in, spool_space: anchor.spool_space,
    capacity_options: options, capacity_note: options.map(r => r.raw).join(', '), braid_capacity_note: (config.braid || []).map(([lb, yards]) => `${lb}-${yards}`).join(', '),
    capacity_status: 'ready', capacity_data_source: 'Official manufacturer exact-model specification table', source_url: s.url, source_file: s.file, data_warnings: [],
    gear_ratio: config.ratio, max_drag_lb: config.drag ?? null, weight_oz: config.weight ?? null, line_retrieve_in: config.ipt ?? null, bearings: config.bearings,
    reelcalc_recommended_braid: config.braidRange, reelcalc_recommended_mono_fluoro: config.monoRange, reelcalc_use_case: config.useCase,
    notes: config.notes || '', search_text: `${config.brand} ${config.model} ${config.size} ${config.sku} ${config.useCase}`.toLowerCase(),
    spec_date_checked: '2026-10-12', spec_verification_sources: [s.url, ...(config.supplements || []).map(k => source(k).url)],
    capacity_reference_note: 'Pound-test reference diameters retain the existing ReelCalc importer lookup. They are assumptions, not manufacturer-published diameters. Verified manufacturer diameters are stored separately by material.',
    ...(config.numericSku ? {manufacturer_product_number:config.numericSku} : {}),
    ...(config.comboSkus ? {combo_skus:config.comboSkus, product_form:'combo-reel', notes:'Capacity record for the reel supplied in these combos. Rod length/action does not create a separate reel record.'} : {}),
    ...(config.ipt ? {ipt_verification_status:'verified', ipt_original_value:config.iptOriginal || config.ipt, ipt_original_unit:config.iptOriginal ? 'cm/turn' : 'in/turn', ipt_source_name:config.supplements?.length ? 'Exact-model dealer specification supplement' : 'Official manufacturer specifications', ipt_source_url:source(config.supplements?.[0] || config.sourceKey).url, ipt_date_checked:'2026-10-12', ipt_confidence:config.supplements?.length ? 'medium' : 'high'} : {})
  };
  reels.push(reel);
  additions.push({id, name:`${config.brand} ${config.model} ${config.size}`, config});
  return reel;
}
function addDiameter(reel, material, diameter, length, key, locator, matchNote = 'Exact manufacturer model or numeric product SKU matches the reel record.') {
  const s = source(key);
  const original = {diameter:{value:diameter,unit:'mm'},capacity:{value:length,unit:'m'}};
  const id = `diam-${hash(`${reel.id}|${material}|${diameter}|${length}`).slice(0,24)}`;
  if (reel.manufacturer_capacity_ratings?.some(r => r.id === id)) return;
  const raw = {anchor_id:id,reel_id:reel.id,material,strength_lb:null,pe_size:null,original,
    normalized:{diameter_mm:diameter,diameter_in:diameter/25.4,capacity_meters:length,capacity_yards:length/.9144},
    original_text:locator.cell,source_type:'manufacturer_product_page',source_id:key,source_url:s.url,evidence_file:s.file,source_sha256:s.sha256,date_checked:'2026-10-12',source_model:reel.sku,
    exact_model_verified:true,model_match_evidence:matchNote,confidence:'high',status:'verified_source',source_locator:locator,
    notes:'Material-labelled published diameter and length. No PE conversion or pound-test-to-diameter inference. Regional rounded lengths retained as printed.'};
  rawRatings.push(raw);
  evidence.sources[id] = {reel_id:reel.id,origin:{file:`${directory}/new-diameter-ratings.json`,pointer:`/${rawRatings.length-1}`},raw};
  (reel.manufacturer_capacity_ratings ||= []).push({id,reel_id:reel.id,material,original,normalized:{diameter_mm:diameter,capacity_meters:length},verification_status:'verified_source',calculation_eligible:true,evidence_file:'data/reel-diameter-evidence.json',source_url:s.url});
}
function tableDiameters(reel, key, identity, material) {
  const row = tableRow(key, identity);
  const header = material === 'mono' ? 'Mono Capacity (m/mm)' : 'Braid Capacity (m/mm)';
  const cell = row[header];
  assert(cell, `Missing ${header} for ${identity}`);
  for (const [, length, diameter] of cell.matchAll(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/g)) addDiameter(reel, material, +diameter, +length, key, {identity,header,cell});
}
function addFeatures(reel, terms) {
  features.families[`${reel.brand}|${reel.model}`] = {brand:reel.brand,model:reel.model,sourceUrl:reel.source_url,sourceStatus:'verified',verification:'verified-features',terms:terms.map(([name,clause])=>({name,clause})),excludedBySize:{},notes:'Manufacturer feature claims paraphrased in their spool/setup context; not hands-on testing.'};
}

const pennDetails = [
  [1000,'1653901',221,56,9,4,135,8,130],[2000,'1653902',269,75,10,6,180,10,180],
  [2500,'1653904',272,83,12,8,175,15,220],[3000,'1653906',326,89,15,10,165,20,180],
  [4000,'1653908',343,93,15,10,220,20,260],[5000,'1653910',524,91,25,15,200,30,300],
  [6000,'1653912',567,104,25,20,230,40,390],[8000,'1653914',785,112,30,25,310,65,390]
];
const pennAU = {5000:{mono:[[.36,205],[.38,185],[.46,125]],braid:[[.29,385],[.36,275],[.38,220]]},6000:{mono:[[.38,305],[.46,210],[.48,190]],braid:[[.36,450],[.38,355],[.41,305]]},8000:{mono:[[.46,310],[.48,285],[.56,210]],braid:[[.41,435],[.46,355],[.48,315]]}};
for (const [size,numericSku,grams,cm,drag,lb,yards,blb,byards] of pennDetails) {
  const key = size === 8000 ? 'cee1e6fbb833a5a9' : '43285154ec6b6859';
  const eu = tableRow('cee1e6fbb833a5a9',numericSku);
  const reel = addReel({brand:'PENN',model:'Fierce V',size,sku:`FRCV${size}`,numericSku,sourceKey:key,supplements:['35fd5d375165b930'],ratio:eu['Gear Ratio'],drag,weight:+(grams/28.349523125).toFixed(2),ipt:+(cm/2.54).toFixed(1),iptOriginal:cm,bearings:'4+1',mono:[[lb,yards]],braid:[[blb,byards]],braidRange:size<=2000?'8-15 lb braid':size<=3000?'10-20 lb braid':size===4000?'15-30 lb braid':size<=6000?'30-50 lb braid':'40-65 lb braid',monoRange:size<=2000?'4-8 lb mono/fluoro':size<=3000?'6-12 lb mono/fluoro':size===4000?'10-15 lb mono/fluoro':size<=6000?'15-25 lb mono/fluoro':'20-30 lb mono/fluoro',useCase:size<=2000?'light inshore and freshwater fishing':size<=4000?'inshore lures and light bait fishing':'heavier inshore bait fishing and surf fishing',image:productImage(key,numericSku),notes:'Fierce V generation, separate from Fierce IV. Exact US/EU product number used for diameter evidence. Dealer weight/retrieve supplement retained separately.'});
  for (const material of ['mono','braid']) tableDiameters(reel,'cee1e6fbb833a5a9',numericSku,material);
  if (pennAU[size]) for (const material of ['mono','braid']) for(const [mm,m] of pennAU[size][material]) addDiameter(reel,material,mm,m,'1defc777e2f1a9d9',{identity:numericSku,header:`${material} capacity (m/mm)`,cell:`${mm} mm / ${m} m`},'AU and US/EU numeric product SKU match exactly for this size. Weight discrepancy retained in research; published diameter capacities are not contradictory.');
  addFeatures(reel,[['CNC Gear technology','handles the gearing'],['HT-100 carbon-fiber drag washers','provide drag pressure when a fish takes line']]);
  if(size>=5000) {
    reel.weight_oz=null;
    reel.spec_review_notes='Net weight unresolved: exact-SKU European dealer and Australian manufacturer weights disagree. Full page held; capacity remains usable.';
  }
  if(size===8000) {
    reel.source_url='https://www.pennfishing.com/products/fierce-v-spinning-reel-1656770?variant=55709936648332';
    reel.spec_verification_sources.push(reel.source_url);
    reel.notes+=' US selected-variant page checked separately: mono 25 lb/310 yd, braid 65 lb/390 yd. AU lists 60 lb instead; not used for the US pound-test record.';
  }
}
features.families['PENN|Fierce V'].sourceUrl=source('43285154ec6b6859').url;
conflicts.push({product:'PENN Fierce V 2500/3000/4000',status:'NEEDS REVIEW',decision:'Use exact US/EU SKU diameter rows; do not activate additional AU rows for different numeric SKUs.',detail:'AU SKUs 1653958/1653959/1653960 differ from US/EU 1653904/1653906/1653908. The AU 2500 .28 mm/175 m also differs from the exact EU .28 mm/160 m. All raw sources preserved.'});
conflicts.push({product:'PENN Fierce V 5000/6000/8000',status:'NEEDS REVIEW',decision:'Leave canonical weights blank and hold full pages. Retain verified capacities and retrieve.',detail:'Same-SKU AU weights 557/606/815 g differ from European dealer 524/567/785 g. US 8000 braid is 65 lb/390 yd; AU is 60 lb/390 yd. Use the exact US pound-test value, with independent EU/AU mm anchors.'});

const abu = [
  ['C1-5500','1649410','Ambassadeur C1','5500','912cc5a14768517c','9aa6e47e40976f0a',null,'ea8ea97297f06149',10.58,25,11],
  ['C1-6500','1649411','Ambassadeur C1','6500','912cc5a14768517c','1abd1bce172be05a','1abd1bce172be05a','ffd3dcc3a84057ec',10.58,25,11],
  ['C1-7000','1649425','Ambassadeur C1 7000','7000','c2423ad42682a68c','b1e090ceaf2e46e5','b1e090ceaf2e46e5','0e9a46decacb8fe7',21.45,22,20],
  ['C1-5500LC','1649433','Ambassadeur C1 Line Counter','5500','a52ec0d89869967d','3e0f31214151e74d','3e0f31214151e74d','ff403a594f597313',10.58,25,11],
  ['C1-6500LC','1649434','Ambassadeur C1 Line Counter','6500','a52ec0d89869967d','3e0f31214151e74d','3e0f31214151e74d','648375827c383a76',10.58,25,11],
  ['C2-5600','1649415','Ambassadeur C2','5600','c966c7bcaf51804d','1a1b69944f61faf5',null,'764208a65c40b4a9',10.58,26,12.5],
  ['C2-6600','1649416','Ambassadeur C2','6600','c966c7bcaf51804d','b4bf4d478419e931','b4bf4d478419e931','880e6ce018721076',11.29,26,12.5]
];
for(const [sku,numericSku,model,size,key,mkey,bkey,supplement,weight,ipt,drag] of abu) {
  const row = tableRow(key,sku);
  const reel = addReel({brand:'Abu Garcia',model:model==='Ambassadeur C1 7000'?'Ambassadeur C1':model,size,sku,numericSku,sourceKey:key,supplements:[supplement],ratio:row['Gear Ratio'],drag,weight,ipt,bearings:sku.startsWith('C2')?'3+1':sku==='C1-7000'?'2+1':'2',mono:pairs(row['Mono Capacity (yds/lbs)']),braid:pairs(row['Braid Capacity (yds/lbs)']),baitcast:true,round:true,braidRange:size==='7000'?'40-65 lb braid':'30-50 lb braid',monoRange:size==='7000'?'17-25 lb mono/fluoro':'12-20 lb mono/fluoro',useCase:sku.endsWith('LC')?'trolling and repeatable line deployment':size==='7000'?'heavier bait fishing and trolling':'larger lures, bait fishing and trolling',image:productImage(key,numericSku)});
  tableDiameters(reel,mkey,mkey.includes('9aa6')||mkey.includes('1a1b')?sku:numericSku,'mono');
  if(bkey) tableDiameters(reel,bkey,numericSku,'braid');
  if(sku.endsWith('LC')) addFeatures(reel,[['The lighted digital line counter','helps repeat a line-out setting'],['The synchronized levelwind','distributes line across the spool']]);
  else if(sku.startsWith('C2')) addFeatures(reel,[['The 6-pin centrifugal brake','provides adjustable casting control'],['The synchronized levelwind','distributes line across the spool']]);
  else addFeatures(reel,[['The 4-pin centrifugal brake','provides casting control'],['The synchronized levelwind','distributes line across the spool']]);
}
// C1 7000 has a separate official product page, so its intro uses exact specs instead of another size's feature source.
features.families['Abu Garcia|Ambassadeur C1'].sourceUrl = source('912cc5a14768517c').url;
conflicts.push({product:'Abu Garcia C1/C2',status:'NEEDS REVIEW',decision:'Use US yds/lb columns for pound-test ratings and EU explicit m/mm columns for diameters.',detail:'Pure Fishing labels some unchanged US braid figures as m/lb. Those ambiguous unit-labelled columns were excluded. C1 7000 table lists 2 ball bearings; description specifies 2 ball bearings plus 1 roller bearing, stored as 2+1.'});

const hm = addReel({brand:"Lew's",model:'HyperMag Shallow Spool',size:300,recommendationSize:3000,sku:'HM300SSG2',sourceKey:'c3c7fb51f2033612',ratio:'7.0:1',drag:20,weight:7,ipt:40,bearings:'10+1',mono:[[8,120]],braid:[[10,180]],braidRange:'10-20 lb braid',monoRange:'6-10 lb mono/fluoro',useCase:'finesse spinning and quick slack pickup',image:'https://www.lews.com/globalassets/lews-catalog/hmssrsg2/hmssrsg2_hypermagshallowspoolspinningreel_main.png',notes:'Manufacturer listed as coming soon when checked. Shallow-spool HM300SSG2 is distinct from HMS300. No manufacturer diameter found.'});
addFeatures(hm,[['EvenLay slow oscillation','guides the line onto its shallow spool'],['The magnesium frame','keeps the listed reel weight at 7 oz']]);

const rs = addReel({brand:'Daiwa',model:'RS',size:500,sku:'RS500',sourceKey:'9d431c214042dc15',ratio:'5.2:1',drag:6.6,weight:5.8,ipt:24.8,bearings:'3+1',mono:[[4,170]],braid:[[6,220]],braidRange:'4-8 lb braid',monoRange:'2-4 lb mono/fluoro',useCase:'ultralight trout and panfish fishing',image:'https://daiwa.us/cdn/shop/files/RS500.png?v=1782137192',notes:'US RS500 specifications match the exact RS500 model on Daiwa France for ratio, weight and retrieve. France gives explicit mm, not PE, in the braid column.'});
addDiameter(rs,'mono',.16,160,'615c853f98ab7369',{identity:'RS500',header:'nylon',cell:'160m/0,16mm'},'Exact RS500 SKU. US 5.2 ratio, 5.8 oz and 24.8 in retrieve match French 5.2, 165 g and 63 cm within published rounding.');
addDiameter(rs,'braid',.06,200,'615c853f98ab7369',{identity:'RS500',header:'tresse',cell:'200m/0,06mm'},'Exact RS500 SKU and matching physical specifications. Explicit source mm value retained, not converted from PE.');
addFeatures(rs,[['Infinite Anti-Reverse','limits backward handle movement'],['The aluminum spool','holds the line on this compact ultralight reel']]);

for (const size of [30,40,50,60,80]) {
  const sku=`TIGRSP${size}`, numericSku=String(1645661+[30,40,50,60,80].indexOf(size));
  const row=Object.values(extracted('38a3be27e17171d2').variants).find(v=>v['Model #']===sku);
  const reel=addReel({brand:'Shakespeare',model:'Tiger Spinning',size,sizeClass:size*100,sku,numericSku,sourceKey:'38a3be27e17171d2',ratio:row['Gear Ratio'],bearings:'1',mono:pairs(row['Mono Capacity (yds)']),braid:[],braidRange:size===30?'10-15 lb braid':size===40?'15-20 lb braid':size===50?'20-30 lb braid':'30-50 lb braid',monoRange:size===30?'4-8 lb mono/fluoro':size===40?'8-12 lb mono/fluoro':size===50?'12-17 lb mono/fluoro':size===60?'14-20 lb mono/fluoro':'20-30 lb mono/fluoro',useCase:size<=40?'general freshwater lure and bait fishing':'heavier bait fishing',image:productImage('38a3be27e17171d2',numericSku),notes:'No official braid capacity published. Weight, maximum drag and line retrieve remain unavailable; full SEO page held pending verification.'});
  tableDiameters(reel,'64aa284865ce7307',sku,'mono');
}

const bottomland = [
  [150,'MOBL1SH70M','MACH Bottomland Baitcast','d39babb489306061','7.5:1',30,7.2,15,'4+1',12,110,30,110,['MOBL1SH70M','MOBL1SHL70M','MOBL1SH70MH','MOBL1SHL70MH','MOBL1SH73MH']],
  [100,'MOBL1060LS','MACH Bottomland Spinning','be45fedb27d93770','5.2:1',26,8.3,10,'3+1',6,135,8,135,['MOBL1060LS']],
  [200,'MOBL2066MS','MACH Bottomland Spinning','be45fedb27d93770','5.2:1',27,8.5,13,'3+1',6,190,8,280,['MOBL2066MS','MOBL2066MS-2']],
  [300,'MOBL3070MS','MACH Bottomland Spinning','be45fedb27d93770','5.2:1',28,9.1,13,'3+1',8,205,10,300,['MOBL3070MS','MOBL3072MHS-2']]
];
for(const [size,sku,model,key,ratio,ipt,weight,drag,bearings,lb,yd,blb,byd,comboSkus] of bottomland) {
  const baitcast=size===150;
  const reel=addReel({brand:"Lew's",model,size,sku,sourceKey:key,ratio,ipt,weight,drag,bearings,mono:[[lb,yd]],braid:[[blb,byd]],comboSkus,baitcast,hand:'RH/LH',recommendationSize:baitcast?150:size*10,braidRange:baitcast?'30-50 lb braid':size===100?'8-10 lb braid':size===200?'10-15 lb braid':'10-20 lb braid',monoRange:baitcast?'10-15 lb mono/fluoro':size===100?'4-6 lb mono/fluoro':size===200?'6-8 lb mono/fluoro':'6-10 lb mono/fluoro',useCase:baitcast?'bass fishing with moving baits':size===100?'light freshwater fishing':size===200?'general freshwater spinning':'bass and all-around freshwater spinning',image:`https://www.lews.com/globalassets/lews-catalog/${baitcast?'moblcmbc/moblcmbc_machbottomlandbaitcastcombo_main.png':'moblcmbs/moblcmbs_machbottomlandspinningcombo_main.png'}`});
  addFeatures(reel,baitcast?[['The MC1 magnetic brake','provides adjustable casting control'],['The graphite frame','is part of the supplied combo reel']]:[['The braid-ready aluminum spool','is part of the supplied combo reel'],['The multi-disc drag','controls line release under load']]);
}

const fins = [[4,.053,.002],[6,.074,.003],[8,.090,.0035],[10,.104,.004],[12,.117,.0045],[15,.128,.005]].map(([lb,mm,publishedIn])=>({
  id:`fins-bfs-ultralight-braid-${lb}`,brand:'FINS',model:'BFS Ultralight',type:'Braid',lb,dia_mm:mm,dia_in:mm/25.4,
  published_dia_in:publishedIn,diameter_basis:'manufacturer-mm-converted-to-in',
  source_note:'Checked 2026-10-12. Exact manufacturer millimeter diameter retained. Calculation inches are mm / 25.4 without rounding; rounded published inches are preserved separately.',
  search_text:`fins bfs ultralight braid ${lb} lb`,role:'mainline',spool_sizes_yd:[150,500],retail_packages:[],colors:['Dark Green','Chartreuse'],construction:'8-carrier braid',
  product_source_url:source('52f199ae052f2993').url,diameter_source_url:source('f19c4af17f505cbf').url
}));
for(const line of fins) {
  assert(!lines.some(l=>l.id===line.id || (slug(l.brand+' '+l.model)===slug(line.brand+' '+line.model)&&l.lb===line.lb&&l.type===line.type)),`Duplicate line ${line.id}`);
  lines.push(line);
}

// Refuse to overwrite unrelated changes to pre-existing canonical records.
for(const [file,original,key] of [['data/reels.json',baseline('data/reels.json'),'id'],['data/lines.json',baseline('data/lines.json'),'id']]) {
  const current=read(file);
  for(const before of original) assert.deepEqual(current.find(r=>r[key]===before[key]),before,`Unexpected existing-record change in ${file}: ${before[key]}`);
}
write(`${directory}/new-diameter-ratings.json`,rawRatings);
const newFile=`${directory}/new-diameter-ratings.json`;
evidence.input_manifest.push({key:'product-expansion-2026-10-12',file:newFile,sha256:hash(fs.readFileSync(path.join(root,newFile)))});
const withRatings = reels.filter(r=>r.manufacturer_capacity_ratings?.length);
const eligible=reels.filter(r=>r.manufacturer_capacity_ratings?.some(a=>a.calculation_eligible));
const materialCounts = {both:0,monoOnly:0,braidOnly:0,neither:0};
for(const reel of reels) {
  const materials=new Set(reel.manufacturer_capacity_ratings?.filter(r=>r.calculation_eligible).map(r=>r.material));
  materialCounts[materials.has('mono')&&materials.has('braid')?'both':materials.has('mono')?'monoOnly':materials.has('braid')?'braidOnly':'neither']++;
}
const allRatings=reels.flatMap(r=>r.manufacturer_capacity_ratings||[]);
evidence.summary={...evidence.summary,date:'2026-10-12',total_reels:reels.length,reels_with_stored_diameter_evidence:withRatings.length,reels_with_eligible_material_ratings:eligible.length,eligible_material_coverage:{both:materialCounts.both,mono_only:materialCounts.monoOnly,braid_only:materialCounts.braidOnly,neither:materialCounts.neither},stored_evidence_rows:allRatings.length,eligible_rows:allRatings.filter(r=>r.calculation_eligible).length,held_rows:allRatings.filter(r=>!r.calculation_eligible).length,legacy_reel_fields_unchanged:true,scope:'Additive exact-model product expansion. Existing records and calculator behavior preserved.'};
write(`${output}/coverage.json`,{totalReels:reels.length,newReels:additions.length,newLines:fins.length,newDiameterRatings:rawRatings.length,withStoredRatings:withRatings.length,withEligibleRatings:eligible.length,materialCounts,totalRatings:allRatings.length,eligibleRatings:allRatings.filter(r=>r.calculation_eligible).length,heldRatings:allRatings.filter(r=>!r.calculation_eligible).length});
write(`${output}/build-data.json`,{baseCommit,newReels:additions,newLines:fins.map(l=>l.id),conflicts,heldPages:additions.filter(a=>!reels.find(r=>r.id===a.id).weight_oz).map(a=>({id:a.id,reason:a.config.brand==='Shakespeare'?'Missing verified reel weight, maximum drag and line retrieve.':'Conflicting exact-model published weight; full page held.'})),newDiameterRatings:rawRatings.map(r=>({id:r.anchor_id,reelId:r.reel_id,material:r.material,mm:r.normalized.diameter_mm,meters:r.normalized.capacity_meters,source:r.source_url}))});
write('data/reels.json',reels);
write('data/lines.json',lines);
write('data/reel-diameter-evidence.json',evidence);
write('data/reel-family-features.json',features);
console.log(`Added ${additions.length} reels, ${fins.length} line strengths, ${rawRatings.length} verified diameter ratings. Existing records unchanged.`);
