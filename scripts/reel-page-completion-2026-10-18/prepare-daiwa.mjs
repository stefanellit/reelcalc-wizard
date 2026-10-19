import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {root,output,directory,read,write} from './build.mjs';
import {parseCapacityNote} from '../reel-pages/lookup.mjs';

const originals=read(`${output}/originals/data/reels.json`);
const research=['freshwater','premium','saltwater'].flatMap(name=>read(`${directory}/daiwa-${name}.json`));
const followupFile=path.join(root,directory,'freshwater-followup.json');
const followup=fs.existsSync(followupFile)?read(`${directory}/freshwater-followup.json`):null;
// This is the existing importer lookup, not a manufacturer diameter claim.
const monoDiameter=lb=>[[2,.006],[4,.008],[6,.0095],[8,.011],[10,.012],[12,.014],[15,.015],[20,.018],[25,.019],[30,.022],[Infinity,.025]].find(([max])=>lb<=max)[1];
const intros={
 RGLT1000D:"For small freshwater lures, the original Regal LT 1000D gives you a 6 lb / 160-yard mono reference without moving up to a larger reel. Its Air Rotor is part of Daiwa's lightweight spinning design. This guide covers RGLT1000D, not the newer B-generation model. Choose your line below to plan a full spool or a shorter main line over optional backing.",
 RGLT2000D:"The original Regal LT 2000D adds reserve for light-line fishing: Daiwa lists 220 yards of 6 lb mono, compared with 160 on the 1000D. Its Air Rotor keeps this in the lighter freshwater spinning family. The calculator below follows the non-B RGLT2000D, so you can check your chosen line with or without backing.",
 'RGLT2500D-XH':"For bass finesse and general freshwater lure fishing, the original Regal LT 2500D-XH combines a 10 lb / 210-yard mono rating with 34.5 inches of listed line pickup per turn. Its 6.2:1 gearing is useful when recovering slack, while ATD drag handles line release under load. Use the calculator for this non-B model to plan your refill, with backing only if you want it.",
 'RGLT3000D-C':"The original Regal LT 3000D-C gives you a deeper-spool option for freshwater fishing, rated for 220 yards of 12 lb mono. Its 5.3:1 gearing and listed 31.6-inch retrieve make it a more moderate-speed choice than an XH model. ATD drag is part of this original non-B reel. Select your exact line below to work out a full fill or optional backing.",
 'RGLT5000D-C-B':"With a 20 lb / 180-yard mono rating, the 2024 Regal LT 5000D-C gives you room to plan a heavier freshwater spinning setup. The ZAION V body keeps weight in check, with a published reel weight of 8.5 oz. This guide follows the B-generation RGLT5000D-C-B. Use its calculator to compare line diameters and decide whether to fill with main line or add backing underneath.",
 'RGLT6000D-B':"The 2024 Regal LT 6000D carries a published 270 yards of 20 lb mono or 320 yards of 30 lb braid, giving you more reserve than the 5000D-C at those same ratings. The ZAION V body is part of this B-generation design, which weighs a listed 11.1 oz. For heavier freshwater spinning, choose your line and working length below to plan a full fill or an optional-backing setup.",
 'TALT1000D-XH':"The original Tatula LT 1000D-XH pairs a 5.8 oz reel with a deep spool for light freshwater fishing. Daiwa lists 160 yards of 6 lb mono and a 30.5-inch retrieve, so it offers reserve and quick slack pickup for small-lure work. Its ZAION frame belongs to the original LT design, not the later MQ. Choose your line below for a full-spool estimate or an optional-backing setup.",
 'TALT2000D-XH':"For light-line freshwater fishing, the original Tatula LT 2000D-XH keeps the listed weight at 5.8 oz while adding line reserve over the 1000: 220 yards of 6 lb mono instead of 160. Its ZAION frame and 6.2:1 gearing suit an easy-to-handle spinning setup with quick slack pickup. This is the original TALT model, not MQ; the calculator below is set to its capacities.",
 'TALT2500D-XH':"The original Tatula LT 2500D-XH is a useful size to consider for bass finesse and general freshwater spinning. Its 6.2 oz weight, ZAION frame and listed 34.5-inch retrieve balance light handling with quick line pickup. Daiwa rates it for 210 yards of 10 lb mono. Choose your actual line below to estimate a refill with or without backing; this guide covers TALT2500D-XH, not Tatula MQ.",
 'TALT3000D-CXH':"If you want more line reserve without adding listed weight over the original Tatula LT 2500D-XH, the 3000D-CXH is rated for 280 yards of 10 lb mono and also weighs 6.2 oz. Its ZAION frame and 36.8-inch retrieve suit freshwater spinning where slack pickup matters. This guide covers the original non-MQ TALT3000D-CXH, with a calculator for your chosen line and optional backing.",
 'TATUEL3000D-CXH':"The Tatula Elite Spinning 3000D-CXH puts a 3000 spool and rotor on a 2500-sized ZAION body, giving you line reserve in a compact freshwater setup. Daiwa lists 280 yards of 10 lb mono and 36.8 inches of retrieve per turn. The AIRDRIVE rotor is part of its lightweight front-end design. Use the calculator below for a full spool or a shorter main line over optional backing."
};
const terms={RGLT1000D:'Air Rotor',RGLT2000D:'Air Rotor','RGLT2500D-XH':'ATD drag','RGLT3000D-C':'ATD drag','RGLT5000D-C-B':'ZAION V body','RGLT6000D-B':'ZAION V body','TALT1000D-XH':'ZAION frame','TALT2000D-XH':'ZAION frame','TALT2500D-XH':'ZAION frame','TALT3000D-CXH':'ZAION frame','TATUEL3000D-CXH':'AIRDRIVE rotor'};
const accepted=[];
for(const x of research.filter(x=>x.status==='verified'&&intros[x.specs.sku])){
 const r=originals.find(r=>r.id===x.reelId),s=x.specs;
 assert(r);assert(!r.manufacturer_capacity_ratings?.length,'Requires separate evidence reconciliation '+r.id);
 const options=parseCapacityNote(s.monoCapacity.raw).map(p=>{
  const diameter=r.capacity_options?.find(c=>c.lb===p.lb)?.diameter_in||monoDiameter(p.lb);
  return {lb:p.lb,yards:p.yards,diameter_in:diameter,spool_space:Number((p.yards*diameter**2).toFixed(6)),raw:`${p.lb}-${p.yards}`};
 });
 assert(options.length);
 const anchor=options.find(o=>o.lb===r.rated_line_lb)||options[Math.floor(options.length/2)];
 const currentRegal=s.sku.endsWith('-B'),originalTatula=s.sku.startsWith('TALT');
 const legacySource=x.sources.find(p=>p.url.endsWith('Daiwa-2020-Catalog.pdf'));
 const sourceUrl=currentRegal?'https://daiwa.us/products/24-regal-lt':s.sku.startsWith('TATUEL')?x.image.sourceUrl:followup?.legacyCatalog?.url||legacySource.url;
 const relevantSources=x.sources.filter(p=>p.url===sourceUrl||p.url.includes('/sheets/specs?'));
 if(legacySource&&sourceUrl===followup?.legacyCatalog?.url)relevantSources.push({url:sourceUrl,evidence:legacySource.evidence+' Complete archived manufacturer PDF verified; original live URL is no longer available.'});
 let image=x.image;
 if(s.sku==='TATUEL3000D-CXH')image={url:'https://stefanellit.github.io/reelcalc-wizard/assets/reel-page-images/c2fb7f41052f71e34787.webp',localFile:'assets/reel-page-images/c2fb7f41052f71e34787.webp',sourceUrl:'https://www.tackledirect.com/daiwa-tatuel2500d-xh-tatula-elite-spinning-reel.html',credit:'Exact-family dealer product photograph'};
 // Resolved photographs live in a separate review file so no alternate-generation image is guessed.
 if(!image.url){
  const key=originalTatula?'tatulaOriginal':'regalOriginal';
  image=followup?.images?.[key];
  if(image)image={...image,localFile:followup.imageVerification[key].cache};
 }
 if(!image?.url)continue;
 const specs={model:s.model,sku:s.sku,reel_type:'Spinning reel',generation:s.generation,market_region:s.market,
  capacity_options:options,capacity_note:options.map(o=>o.raw).join(', '),braid_capacity_note:parseCapacityNote(s.braidCapacity.raw).map(p=>`${p.lb}-${p.yards}`).join(', '),
  capacity_yards:anchor.yards,rated_line_lb:anchor.lb,rated_line_diameter_in:anchor.diameter_in,spool_space:anchor.spool_space,
  capacity_data_source:'Official manufacturer exact-model specification table',source_url:sourceUrl,source_file:`${directory}/daiwa-freshwater.json`,
  data_warnings:(r.data_warnings||[]).filter(w=>w!=='Source/spec should be verified before public use.'),
  gear_ratio:s.gearRatio.replace(/:1$/,''),weight_oz:s.weight.value,max_drag_lb:s.maxDrag.value,line_retrieve_in:s.retrieve.value,bearings:s.bearings,
  notes:`${s.generation}. ${x.reason} Original seeded record retained in the October 18, 2026 batch audit.`,
  search_text:`Daiwa ${s.model} ${r.size_label} ${s.sku} ${r.reelcalc_use_case}`.toLowerCase(),
  spec_date_checked:'2026-10-18',spec_verification_sources:relevantSources.map(p=>p.url),
  capacity_reference_note:'Pound-test reference diameters retain the existing ReelCalc importer lookup. They are assumptions, not manufacturer-published diameters.',
  ipt_verification_status:'verified',ipt_original_value:s.retrieve.value,ipt_original_unit:s.retrieve.unit,ipt_source_name:'Official manufacturer exact-model specifications',ipt_source_url:sourceUrl,ipt_date_checked:'2026-10-18',ipt_confidence:'high',ipt_notes:`Exact ${s.sku}, ${s.generation}.`};
 accepted.push({reelId:r.id,status:'verified',reason:x.reason,sources:relevantSources,specs,image:{...image,representative:true},features:[terms[s.sku]],intro:intros[s.sku],useCase:s.fishingUse.text.replace(/\.$/,'').toLowerCase(),unavailableSpecs:{}});
}
const saltFollowup=read(`${directory}/saltwater-followup.json`);
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/calculator-core.js'),'utf8'),sandbox);
const core=sandbox.window.ReelCalcCore;
const certateOpenings={
 '8000-H':'For an offshore spinning setup where line reserve matters, the 2026 Certate SW 8000-H starts with a published J-Braid capacity of 50 lb / 280 yards. Its listed 43.4-inch retrieve and 5.6:1 gearing give you a reference for jigging or working saltwater lures.',
 '10000-H':'The 2026 Certate SW 10000-H adds reserve over the 8000-H at the same 50 lb J-Braid rating: 330 yards instead of 280. Its listed 46.1-inch retrieve is worth considering when you need to pick up line quickly during offshore lure or jig work.',
 '14000-XH':'For offshore casting where fast line pickup is useful, the 2026 Certate SW 14000-XH has 6.2:1 gearing and a listed 52.6-inch retrieve. Daiwa rates its spool for 330 yards of 65 lb J-Braid, so you can plan your working line and reserve around that reference.',
 '18000-H':'The 2026 Certate SW 18000-H moves into a larger offshore setup, with a 31.2 oz weight and a published 80 lb / 330-yard J-Braid capacity. Its 5.5:1 gearing retrieves a listed 51 inches per turn; match that size and line reserve to the rod and the fishing ahead.',
 '20000-H':'When a long reserve of heavy braid is part of your offshore plan, the 2026 Certate SW 20000-H is rated for 330 yards of 100 lb J-Braid. Its listed weight is 31.6 oz and retrieve is 54.4 inches per turn, making it a substantial setup rather than a light-tackle choice.'
};
for(const x of saltFollowup.filter(x=>x.status==='verified'&&x.sourceGeneration===2026)){
 const r=originals.find(r=>r.id===x.reelId);assert(r&&/2026/.test(r.notes));
 assert(!r.manufacturer_capacity_ratings?.length);
 const options=parseCapacityNote(x.braidCapacityRaw).map(p=>{const diameter=core.assumedRatingDiameter('braid',p.lb);return {lb:p.lb,yards:p.yards,diameter_in:diameter,spool_space:Number((p.yards*diameter**2).toFixed(6)),raw:`${p.lb}-${p.yards}`};});
 assert(options.length);const anchor=options.at(-1);
 const specs={model:'Certate SW 2026',sku:x.sourceModel,release_year:2026,market_region:'US',reel_type:'sw_spinning',capacity_reference_type:'braid',capacity_options:options,
  capacity_note:'J-Braid basis: '+options.map(p=>p.raw).join(', '),braid_capacity_note:options.map(p=>p.raw).join(', '),
  capacity_yards:anchor.yards,rated_line_lb:anchor.lb,rated_line_diameter_in:anchor.diameter_in,spool_space:anchor.spool_space,
  capacity_data_source:'Official Daiwa US J-Braid capacity',source_url:x.productSourceUrl,source_file:`${directory}/saltwater-followup.json`,capacity_status:'ready',
  data_warnings:(r.data_warnings||[]).filter(w=>w!=='Source/spec should be verified before public use.'),gear_ratio:x.gearRatio.replace(/:1$/,''),max_drag_lb:x.dragValue,weight_oz:x.weightValue,line_retrieve_in:x.retrieveValue,bearings:x.bearingsRaw,
  capacity_reference_note:'Daiwa publishes J-Braid capacities, not mono capacities, for this 2026 model. The fallback reference uses the existing ReelCalc assumed braid diameter table, not a verified manufacturer diameter.',
  notes:`2026 US ${x.sourceModel}. ${x.generationRationale} Original seeded record retained in the October 18, 2026 batch audit.`,
  spec_date_checked:'2026-10-18',spec_verification_sources:[x.productSourceUrl,x.sourceUrl,x.generationSourceUrl],
  ipt_verification_status:'verified',ipt_original_value:x.retrieveValue,ipt_original_unit:x.retrieveUnit,ipt_source_name:'Official Daiwa 2026 US specifications',ipt_source_url:x.productSourceUrl,ipt_date_checked:'2026-10-18',ipt_confidence:'high',ipt_notes:'Exact 2026 US model; older Certate SW values excluded.',
  search_text:`Daiwa Certate SW 2026 ${r.size_label} ${x.sourceModel} ${r.reelcalc_use_case}`.toLowerCase()};
 const intro=certateOpenings[r.size_label]+" Daiwa's POWERDRIVE DESIGN belongs to this 2026 generation. Choose your line below to estimate a full fill or optional backing.";
 const capacityIntro='Daiwa lists J-Braid capacities for this 2026 model, but no factory mono capacity. The table keeps that distinction. Other lines can fill differently, even at the same pound-test rating, so use the calculator as a starting estimate and check the spool as you wind.';
 accepted.push({reelId:r.id,status:'verified',reason:x.generationRationale,specs,sources:[{url:x.productSourceUrl,evidence:`${x.sourceModel}: braid ${x.braidCapacityRaw}; mono: ${x.monoCapacityRaw}; ${x.gearRatio}; ${x.dragValue} lb; ${x.weightValue} oz; ${x.retrieveValue} in/turn; ${x.bearingsRaw}.`},{url:x.sourceUrl,evidence:x.sourceLocation},{url:x.generationSourceUrl,evidence:'2026 generation corroboration; US figures retained.'}],image:{url:x.imageUrl,sourceUrl:x.imageSourceUrl,representative:true},intro,features:['POWERDRIVE DESIGN'],useCase:'offshore casting and jigging',braidOnly:true,
  editorial:{capacityIntro,who:'This is a heavier saltwater spinning reel for offshore casting and jigging. Match its line reserve and weight to the rod, depth and fish you expect. Choose the leader and fishing drag for the tackle and structure, rather than using the maximum drag rating as a target.',faqCapacity:`Daiwa lists J-Braid at ${parseCapacityNote(x.braidCapacityRaw).map(p=>`${p.lb} lb / ${p.yards} yards`).join(' and ')}. No mono capacity is published in the cited 2026 U.S. table. The calculator can estimate other lines from the available reference, but that is not a factory mono rating.`,specsIntro:`These are the published 2026 US ${x.sourceModel} specifications, not those of the older Certate SW. Retrieve falls as line leaves the spool, and maximum drag is an upper rating, not a suggested fishing setting.`}});
}
write(`${directory}/daiwa-reviewed.json`,accepted);
write(`${output}/daiwa-review-decisions.json`,research.map(r=>({reelId:r.reelId,status:accepted.some(a=>a.reelId===r.reelId)?'included':'held',researchStatus:r.status,reason:accepted.some(a=>a.reelId===r.reelId)?r.reason:r.status!=='verified'?r.reason:r.specs.sku&&intros[r.specs.sku]?'Exact-model specifications established; correct-generation product photograph still required.':'Manufacturer model specifications found, but database identity/generation mapping or compatible capacity reference is not sufficiently established for this batch.',sources:r.sources})));
console.log(JSON.stringify({included:accepted.length,held:research.length-accepted.length}));
