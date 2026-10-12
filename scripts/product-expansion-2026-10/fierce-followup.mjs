import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {root,read,write,directory} from './research.mjs';
import {headers,save,escape,customize,sourceNotes,importDescription} from './build-pages.mjs';
import {generateReelPage} from '../generate-reel-page.mjs';
import {normalizeAffiliateRegistry,ensureAmazonReelOffer} from '../reel-pages/affiliates.mjs';
import {renderSquarespaceBlock,renderPreviewDocument} from '../reel-pages/render.mjs';
import {validateGeneratedPage} from '../reel-pages/validate.mjs';

export const output='outputs/fierce-tiger-followup-2026-10-12';
export const baselineCommit='2156908209a7af9931c25d1c19384544abec1d80';
export const catalog='https://publuu.com/flip-book/164752/2555201/page/64';
const catalogImage='https://d1uiew9hysv4w7.cloudfront.net/164752/2555201/svg/2555201_65.svg';
const au='https://pennfishing.com.au/penn-fierce-v/';
const facts=[{size:5000,weight:18.5,ipt:36,auWeight:557},{size:6000,weight:20,ipt:41,auWeight:606},{size:8000,weight:27.1,ipt:44,auWeight:815}];
const fromBaseline=file=>JSON.parse(execFileSync('git',['show',`${baselineCommit}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:64e6}));
const oldReels=fromBaseline('data/reels.json');
const reels=read('data/reels.json'),lines=read('data/lines.json');
const registry=read('data/reel-pages.json'),staged=structuredClone(registry);
const affiliates=normalizeAffiliateRegistry(read('data/reel-affiliates.json'));
const embeds=read('data/reel-page-embeds.json'),images=read(`${directory}/images.json`);
const build=read('outputs/product-expansion-2026-10-12/build-data.json');
const tigerItems=build.newReels.filter(x=>x.config.brand==='Shakespeare');
const featureCatalog=read('data/reel-family-features.json');
featureCatalog.families['Shakespeare|Tiger Spinning']={brand:'Shakespeare',model:'Tiger Spinning',sourceUrl:'https://www.shakespeare-fishing.com/products/tiger-spinning-reel-1656817',sourceStatus:'verified',verification:'verified-features',terms:[{name:'Stren clear monofilament',clause:'comes pre-spooled on the reel'},{name:'Soft-touch handle knobs',clause:'provide a comfortable grip'}],excludedBySize:{},notes:'Official standalone TIGRSP30/40/50/60/80 features. Not the older Tiger combos. No weight, max drag or line retrieve inferred.'};
write('data/reel-family-features.json',featureCatalog);
const files=[],updates=[];
const proof=read(`${directory}/sources.json`)[catalogImage];
assert(proof?.ok,'Catalog source must be cached before building.');
const source=fs.readFileSync(path.join(root,proof.file),'utf8');
for(const fact of facts){
  const sku=`FRCV${fact.size}`,reel=reels.find(r=>r.sku===sku);
  assert(reel && source.includes(sku) && source.includes(reel.manufacturer_product_number));
  const previous=oldReels.find(r=>r.id===reel.id);
  Object.assign(reel,{
    weight_oz:fact.weight,
    line_retrieve_in:fact.ipt,
    weight_verification_status:'verified',
    weight_source_name:'PENN 2026 North America catalog, printed page 58',
    weight_source_url:catalog,
    weight_date_checked:'2026-10-12',
    ipt_verification_status:'verified',
    ipt_original_value:fact.ipt,
    ipt_original_unit:'in/turn',
    ipt_source_name:'PENN 2026 North America catalog, printed page 58',
    ipt_source_url:catalog,
    ipt_date_checked:'2026-10-12',
    ipt_confidence:'high',
    spec_verification_sources:[...new Set([...reel.spec_verification_sources,catalog,au])],
    spec_review_notes:`U.S. weight and retrieve verified in PENN's 2026 North America catalog, printed page 58. Use the North American specification for this U.S.-source record. PENN Australia lists ${fact.auWeight} g for the same numeric SKU; the reason for that manufacturer discrepancy remains unresolved. Earlier dealer evidence is preserved in the research audit.`,
    spec_conflicts:[{field:'weight_oz',status:'unresolved-regional-publication-difference',preferred_source:catalog,preferred_original_value:fact.weight,preferred_original_unit:'oz',other_source:au,other_original_value:fact.auWeight,other_original_unit:'g',decision:'Use the exact-model North American manufacturer catalog for the U.S.-source record; do not claim the Australian value is a typo.'}]
  });
  if(fact.size===8000)reel.spec_conflicts.push({field:'braid_capacity_note',status:'unresolved-regional-publication-difference',preferred_source:catalog,preferred_original_value:'390 yd / 65 lb',other_source:au,other_original_value:'390 yd / 60 lb',decision:'Retain the existing U.S. 65 lb / 390 yd rating, corroborated by the U.S. catalog and product page.'});
  assert.deepEqual(reel.manufacturer_capacity_ratings,previous.manufacturer_capacity_ratings);
  updates.push({id:reel.id,sku,numericSku:reel.manufacturer_product_number,weight_oz:fact.weight,line_retrieve_in:fact.ipt,previousSpecReview:previous.spec_review_notes,previousRetrieve:{value:previous.line_retrieve_in,originalValue:previous.ipt_original_value,originalUnit:previous.ipt_original_unit,source:previous.ipt_source_url},conflicts:reel.spec_conflicts});
}
for(const item of tigerItems){
  const reel=reels.find(r=>r.id===item.id);
  reel.notes='No official braid capacity published. Weight, maximum drag and line retrieve remain unconfirmed. The owner approved a capacity guide with those three missing specifications clearly labeled on October 12, 2026; numeric fields remain null.';
}
write('data/reels.json',reels);

for(const item of [...facts.map(f=>build.newReels.find(x=>x.config.sku===`FRCV${f.size}`)),...tigerItems]){
  const tiger=item.config.brand==='Shakespeare',fact=facts.find(f=>f.size===Number(item.config.size));
  const reel=reels.find(r=>r.id===item.id),photo=images[item.id]||{imageUrl:item.config.image,originalUrl:item.config.image};
  const slug=tiger?`shakespeare-tiger-spinning-${item.config.size}`:`penn-fierce-v-${fact.size}`;
  assert(!registry.pages.some(p=>p.reelId===item.id||p.path===`/reel-pages/p/${slug}`),'Do not create an already-registered page.');
  const page={reelId:item.id,path:`/reel-pages/p/${slug}`,family:tiger?'Shakespeare Tiger Spinning':'PENN Fierce V',imageUrl:photo.imageUrl,imageAlt:`${item.name}, manufacturer product photograph`,imageOriginalUrl:photo.originalUrl,imageSource:'Manufacturer product photograph',imageSourcePage:reel.source_url,imageMethod:'verified-manufacturer-image',verifiedLive:false,quickAnswerNote:''};
  if(tiger)page.unavailableSpecs={weight_oz:'Not confirmed in checked manufacturer sources',max_drag_lb:'Not published in checked manufacturer sources',line_retrieve_in:'Not published in checked manufacturer sources'};
  staged.pages.push(page);ensureAmazonReelOffer(affiliates,reel);
  const localRegistry={...registry,pages:[...registry.pages,page]};
  const result=generateReelPage(item.id,{reels,lines,registry:localRegistry,affiliates,featureCatalog});
  assert.equal(result.status,'generated',JSON.stringify(result.problems||result.validation?.failures));
  const m=result.model;customize(m,item);
  const feature='HT-100 carbon fiber drag washers';
  const intros={
    5000:`For heavier inshore bait fishing or a surf setup, the Fierce V 5000 starts with a published 15 lb / 200-yard mono capacity. PENN also lists 0.36 mm / 205 m for mono, giving you a way to compare the thickness of your actual line. Its ${feature} are part of the saltwater-focused design. Use the reel-specific calculator below for a full spool or a shorter main line with optional backing.`,
    6000:`The Fierce V 6000 gives you more line in reserve than the 5000, with published ratings of 20 lb / 230 yards for mono and 40 lb / 390 yards for braid. For surf or heavier inshore bait fishing, that makes line choice worth planning before you spool up. It uses ${feature}. Choose your line in the preloaded calculator to work out a full fill or leave room for backing.`,
    8000:`If your surf setup calls for heavier line and plenty in reserve, the Fierce V 8000 has a published 25 lb / 310-yard mono rating. Its 5.3:1 gearing is slower than the 5000 and 6000, while the larger spool still retrieves a listed 44 inches per turn at the rated fill level. PENN fits ${feature}. The calculator below is set to this exact reel, with both full-spool and optional-backing setups available.`
  };
  if(!tiger){
    m.intro=intros[fact.size];m.introFeatureNames=[feature];
    m.specsIntro=`Weight (${fact.weight} oz) and retrieve (${fact.ipt} inches per turn) follow PENN's 2026 North America catalog for ${reel.sku}. PENN Australia publishes a different weight for the same product number, so we have kept the U.S. figure here rather than treating the two as interchangeable. Maximum drag is an upper rating, not a suggested fishing setting.`;
  }else{
    const openings={30:'The Tiger 30 is the lighter-line option in this group, with published mono ratings from 4 to 8 lb. If you are matching it to a light freshwater rod, those ratings are a useful place to start.',40:'For a general freshwater setup, the Tiger 40 gives you a published 10 lb / 210-yard mono reference, with 8 and 12 lb alternatives also listed. Choose the line to suit the rod and cover rather than filling it with the heaviest option.',50:'The Tiger 50 steps up to published mono ratings of 12, 14 and 17 lb. For bait fishing, think about how much line you need beyond the distance to your bait, then check the actual diameter before buying a replacement spool.',60:'With a published 17 lb / 220-yard mono reference, the Tiger 60 gives you room to plan a heavier bait-fishing setup. Its 5.1:1 ratio is the same as the 50, but the capacity table is specific to this larger size.',80:'The Tiger 80 is the largest of these five spinning models, with a 25 lb / 290-yard mono reference and 4.4:1 gearing. The thicker line used for heavier bait fishing takes up more space, so check your chosen line against the diameter ratings below.'};
    const endings={30:'The calculator is set to TIGRSP30 for a full refill or a shorter working line over optional backing.',40:'Use the exact-reel calculator below to compare a full spool with an optional-backing setup.',50:'Choose your line below to estimate a full fill, or work out backing beneath a shorter main line.',60:'The preloaded calculator lets you plan either a full spool of main line or a setup with backing underneath.',80:'Use this reel\'s calculator to plan your refill with or without backing.'};
    m.intro=`${openings[item.config.size]} Stren clear monofilament comes pre-spooled on the reel. ${endings[item.config.size]}`;
    m.introFeatureNames=['Stren clear monofilament'];
    m.calculatorHeading=`Tiger Spinning ${item.config.size}`;
    m.specsIntro='Shakespeare publishes this model\'s gear ratio, bearing count and mono capacities. We could not confirm its net weight, maximum drag or line retrieve from the manufacturer sources checked. Those fields stay labeled below; no values have been guessed. Without a verified retrieve rate, the calculator does not preload a handle-turn estimate.';
    m.capacityIntro='These are Shakespeare\'s published mono ratings, including exact-model millimeter capacities. No manufacturer braid capacity was found. If you select braid, ReelCalc uses its existing mono-based fallback and labels the estimate accordingly; it is not a factory braid rating.';
    m.who=`For ${item.config.useCase}, match the line to your rod, presentation and cover. ${reel.reelcalc_recommended_mono_fluoro} is ReelCalc's starting range for a straight-line setup. The suggested ${reel.reelcalc_recommended_braid} range is an alternative, not a published Shakespeare braid rating or a statement about maximum drag.`;
    m.setupIntro=`The reel comes with Stren clear mono. When replacing it, ${reel.reelcalc_recommended_mono_fluoro} is a starting range to consider alongside your rod rating. You can fill with main line or use optional backing. For braid, secure the base against slipping and watch the actual fill level because Shakespeare does not publish a braid capacity for this model.`;
    m.faqBraid=`ReelCalc suggests ${reel.reelcalc_recommended_braid} as a starting range, subject to your rod and fishing conditions. Shakespeare does not publish a braid capacity for ${reel.sku}, so the calculator uses its existing mono-based fallback rather than a verified braid rating. Backing is optional, but braid must be secured against slipping on the spool.`;
    m.calculatorIntro=`This calculator is set to ${reel.sku}. Estimate a full spool of your chosen main line, or choose a shorter length with optional backing. Mono calculations can use the verified diameter ratings; braid uses the existing fallback because no factory braid rating was found.`;
    m.recommendation.quickAnswer=`For a straightforward refill, start with ${reel.reelcalc_recommended_mono_fluoro} and match it to your rod. The braid range is a ReelCalc suggestion, not a published braid rating from Shakespeare.`;
  }
  let block=sourceNotes(renderSquarespaceBlock(m,registry.assetBaseUrl),reel);
  const validation=validateGeneratedPage({html:block,reel:m.reel,model:m,registry:localRegistry,projectFiles:{calculatorExists:true,coreExists:true,mobileCssPresent:true}});
  assert.equal(validation.status,'PASSED',JSON.stringify(validation.failures));
  const blockFile=`generated/reel-pages/p/${slug}-squarespace.html`,previewFile=`generated/reel-pages/p/${slug}-preview.html`;
  save(blockFile,block);
  save(previewFile,renderPreviewDocument(m,sourceNotes(renderSquarespaceBlock(m,'../../..'),reel).replaceAll(photo.imageUrl,photo.file?'../../../'+photo.file:photo.imageUrl)));
  embeds.pages[slug]={reelId:item.id,pageTitle:m.pageTitle,seoTitle:m.seoTitle,metaDescription:m.metaDescription,canonicalPath:page.path,imageUrl:page.imageUrl,imageAlt:page.imageAlt,...Object.fromEntries(['intro','introVariant','introDetailMode','introFeatureNames','introEvidenceSource','introEvidenceKey'].map(k=>[k,m[k]])),related:m.related,sizeGuide:null,calculator:m.calculatorDefaults,content:Object.fromEntries(['who','setupIntro','setupRows','specsIntro','faqBraid','capacityIntro','capacityRows','monoText','braidText','faqCapacity'].map(k=>[k,m[k]]))};
  const row=Object.fromEntries(headers.map(h=>[h,'']));
  Object.assign(row,{'Product Type [Non Editable]':'SERVICE','Product Page':'reel-pages','Product URL':slug,Title:m.pageTitle,Description:importDescription(block),SKU:'RC'+crypto.createHash('sha256').update(item.id).digest('hex').slice(0,18).toUpperCase(),MPN:reel.sku,Price:'0','On Sale':'No',Stock:'Unlimited',Tags:'reelcalc-reel-guide',Visible:'No','Hosted Image URLs':photo.imageUrl});
  files.push({id:item.id,name:item.name,slug,row,blockFile,previewFile,unavailableSpecs:page.unavailableSpecs||{},checks:validation.checks});
  save(`${output}/native/${slug}.html`,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="canonical" href="https://www.reelcalc.com${page.path}"><title>${escape(m.pageTitle)}</title><style>body{margin:0;font:18px Georgia,serif;background:#eef1ef}header,footer{padding:20px}.product-content-wrapper{display:flex;gap:32px}.product-gallery{min-height:500px;width:50%}.product-meta{width:50%;padding-left:38px}.hidden-up-md{display:none}@media(max-width:720px){.hidden-up-md{display:block}.hidden-down-md{display:none}}</style><script src="/js/squarespace-reel-page-loader.js" data-asset-base="/" data-page-slug="${slug}" defer></script></head><body><header>ReelCalc</header><main class="product-detail tag-reelcalc-reel-guide"><div data-product-detail-layout="simple"><div class="product-content-wrapper"><div class="product-gallery">Product gallery</div><div class="product-meta"><h1 class="product-title">${escape(m.pageTitle)}</h1><div class="product-price">$0.00</div><div class="product-description hidden-down-md">${row.Description}</div><div class="product-add-to-cart"><button>Add to cart</button></div><div class="product-description hidden-up-md">${row.Description}</div></div></div></div></main><footer>ReelCalc</footer></body></html>`);
}
const oldEmbeds=fromBaseline('data/reel-page-embeds.json');
embeds.version=Number(oldEmbeds.version)+1;staged.version=Number(registry.version)+1;
write('data/reel-page-embeds.json',embeds);write('data/reel-affiliates.json',affiliates);
write(`${output}/ACTIVATE-AFTER-IMPORT-reel-pages.json`,staged);
write(`${output}/build-pages.json`,{headers,files,held:[]});
write(`${directory}/fierce-tiger-followup.json`,{checkedAt:new Date().toISOString(),baselineCommit,catalog,catalogImage,catalogPrintedPage:58,catalogViewerPage:65,sourceCache:proof,updates,tiger:{status:'capacity-guides-with-approved-disclosures',models:tigerItems.map(x=>x.id),newVerifiedFields:0,ownerApproval:'Finish useful guides with missing specs clearly labeled',previousNotes:tigerItems.map(i=>({id:i.id,notes:oldReels.find(r=>r.id===i.id).notes})),reason:'Manufacturer product pages and catalog omit verified net reel weight, max drag and line retrieve. Commerce shipping-weight fields are not accepted as net reel weight.',sources:['https://www.shakespeare-fishing.com/products/tiger-spinning-reel-1656817','https://www.purefishing.com/products/shakespeare-tiger-spinning-reel-1656817','https://publuu.com/flip-book/164752/2514736/page/46'],previousAudit:`${directory}/agent-tiger.json`}});
save(`${output}/review.html`,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Fierce V and Tiger guides</title><style>body{max-width:850px;margin:32px auto;padding:0 18px;font:17px/1.5 Arial;color:#20342d}h1{font-size:28px}a{color:#17633e}li{padding:10px 0}img{width:110px;height:110px;object-fit:contain;vertical-align:middle;margin-right:16px}</style></head><body><h1>Fierce V and Tiger guides</h1><p>Eight guides prepared to import hidden. Tiger's unconfirmed weight, maximum drag and retrieve rate are clearly labeled; verified capacity data remains available.</p><ul>${files.map(p=>`<li><img src="${p.row['Hosted Image URLs']}" alt=""><a href="native/${p.slug}.html">${escape(p.name)}</a></li>`).join('')}</ul><p><a href="${catalog}">PENN North America catalog, printed page 58</a></p></body></html>`);
console.log(JSON.stringify({pages:files.length,missingSpecsDisclosed:15,updatedSpecs:updates.map(x=>({id:x.id,weight:x.weight_oz,retrieve:x.line_retrieve_in}))},null,2));
