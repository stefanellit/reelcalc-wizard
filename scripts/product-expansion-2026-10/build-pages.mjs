import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as html from '../line-page-publishing/node_modules/parse5/dist/index.js';
import {root,read,write,directory} from './research.mjs';
import {generateReelPage} from '../generate-reel-page.mjs';
import {renderSquarespaceBlock,renderPreviewDocument} from '../reel-pages/render.mjs';
import {normalizeAffiliateRegistry,ensureAmazonReelOffer} from '../reel-pages/affiliates.mjs';
import {validateGeneratedPage} from '../reel-pages/validate.mjs';

export const output='outputs/product-expansion-2026-10-12';
export const baseCommit='dd1a66e8ee2d2195d8ae44dcde382213d204f48d';
export const baseline=file=>JSON.parse(execFileSync('git',['show',`${baseCommit}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:64e6}));
export const headers=['Product ID [Non Editable]','Variant ID [Non Editable]','Product Type [Non Editable]','Product Page','Product URL','Title','Description','SKU','GTIN','MPN','Option Name 1','Option Value 1','Option Name 2','Option Value 2','Option Name 3','Option Value 3','Price','Sale Price','On Sale','Stock','Categories','Tags','Weight','Length','Width','Height','Visible','Hosted Image URLs'];
export const all=(node,predicate)=>[...(predicate(node)?[node]:[]),...(node.childNodes||[]).flatMap(n=>all(n,predicate))];
export const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
export const remove=node=>{node.parentNode.childNodes=node.parentNode.childNodes.filter(n=>n!==node);};
export const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function save(file,text){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text+'\n');}
export function importDescription(block){
  const doc=html.parseFragment(block);
  for(const node of all(doc,n=>n.nodeName==='#comment'||['script','link'].includes(n.tagName)))remove(node);
  for(const node of all(doc,n=>['article','section'].includes(n.tagName)).reverse()){
    const parent=node.parentNode,index=parent.childNodes.indexOf(node);
    for(const child of node.childNodes)child.parentNode=parent;
    parent.childNodes.splice(index,1,...node.childNodes);
  }
  for(const node of all(doc,n=>n.attrs))node.attrs=node.attrs.filter(a=>!['class','id','hidden','loading'].includes(a.name)&&!a.name.startsWith('data-'));
  return html.serialize(doc).trim();
}
export function sourceNotes(block,reel){
  const doc=html.parseFragment(block);
  const urls=[...new Set([reel.source_url,...(reel.spec_verification_sources||[]),...(reel.manufacturer_capacity_ratings||[]).map(r=>r.source_url)].filter(Boolean))];
  const target=all(doc,n=>attr(n,'data-section')==='specifications')[0].childNodes.find(n=>n.tagName==='div');
  const note=html.parseFragment(`<p class="reelcalc-source-note">Sources checked October 12, 2026: ${urls.map((url,i)=>`<a href="${escape(url)}" target="_blank" rel="nofollow noopener">${i===0?'Manufacturer product listing':/pecheur|consumermarine|firstchoice|outdoorwarehouse|sm4sports/.test(url)?'Exact-model dealer specification supplement':'Manufacturer capacity table'}</a>`).join('; ')}. Specifications and setup guidance, not a hands-on reel review.</p>`);
  for(const node of note.childNodes){node.parentNode=target;target.childNodes.push(node);}
  return html.serialize(doc);
}
export function customize(m,item){
  const c=item.config,n=m.reel.displayName,s=Number(c.size),r=m.recommendation;
  const context=c.brand==='PENN'?({1000:'For a light inshore or freshwater setup, the 1000 keeps the published mono starting point at 4 lb / 135 yards.',2000:'The 2000 gives you a 6 lb / 180-yard mono reference for a light spinning setup.',2500:'The 2500 starts from an 8 lb / 175-yard mono rating, useful when choosing between straight mono and a braid-and-leader setup.',3000:'Moving to the 3000 gives you a 10 lb / 165-yard mono rating and a 20 lb / 180-yard braid reference.',4000:'The 4000 offers more reserve than the 3000 at the same 10 lb mono rating: 220 yards instead of 165.'}[s]):
    c.model.includes('Line Counter')?`The ${c.size} pairs a round spool with a line counter for repeating a trolling distance. Spool fill still matters when comparing line-out readings between setups.`:
    c.model==='Ambassadeur C1'&&s===7000?'The 7000 is the larger C1 here, with a 20 lb / 325-yard mono rating for anglers who need more line in reserve. Its 4.1:1 gearing is a different starting point from the faster 5500 and 6500.':
    c.round?`The ${c.size} is a round baitcaster for ${c.useCase}. ${s===5500||s===5600?'Its 0.35 mm / 210 m mono rating gives a diameter-based reference for choosing a full fill or a shorter working section.':'Its 0.35 mm / 280 m mono rating gives you room to plan a longer fill or reserve space beneath your working line.'}`:
    c.model==='HyperMag Shallow Spool'?'The shallow spool is the point of this 300: it is rated for 120 yards of 8 lb mono or 180 yards of 10 lb braid, rather than a large reserve of unused line. The 7.0:1 gearing retrieves a listed 40 inches per turn.':
    c.model==='RS'?'This 500-size ultralight starts with a 4 lb / 170-yard US mono rating. Daiwa also publishes exact RS500 millimeter capacities, which make it easier to compare thin lines without treating every 4 lb label as the same thickness.':
    c.baitcast?'This page covers the 150-size baitcaster supplied with MACH Bottomland combos. Its 7.5:1 gearing and 12 lb / 110-yard mono rating are useful starting points for a bass casting setup.':
    `This guide covers the ${c.size}-size spinning reel supplied with MACH Bottomland combos. ${s===100?'The 6 lb / 135-yard mono rating suits planning a lighter setup.':s===200?'The 6 lb / 190-yard mono rating gives more reserve than the 100 at the same listed strength.':'At 8 lb / 205 yards for mono, the 300 gives you a thicker-line starting point than the smaller sizes.'}`;
  const profiles=read('data/reel-family-features.json').families;
  const terms=(profiles[`${c.brand}|${c.model}`]?.terms||[]).slice(c.brand==='PENN'?1:0);
  const feature=terms.slice(0,1).map(t=>`${t.name} ${t.clause}.`).join(' ');
  const endings=[`Use the calculator below with your exact line to plan a full spool or work out optional backing.`,`The calculator is already set to this reel, so you can compare your line choices with or without backing.`,`Choose your line below to estimate a full fill, or set a shorter main-line amount and check how much backing fits underneath.`];
  m.intro=`${context} ${feature} ${endings[s%3]}`;
  m.introDetailMode='verified-features';m.introFeatureNames=terms.slice(0,1).map(t=>t.name);m.introEvidenceSource=m.reel.sourceUrl;
  m.who=`For ${c.useCase}, start with the rod's line range and the cover you expect to fish. ReelCalc's ${r.braidRange} and ${r.monoRange} ranges are setup suggestions, not extra manufacturer ratings. ${c.round?'Allow enough working line for casting or trolling plus a useful reserve.':c.model==='RS'?'Keep an ultralight setup balanced with the rod and small presentations rather than choosing heavier line simply because it fits.':'Choose the lighter end for open water, and move up when the rod, cover and presentation call for it.'}`;
  m.setupIntro=`${r.primarySetup} is a starting suggestion for this reel. You can fill the spool with main line, or use backing beneath a shorter working section. Select the actual line and its listed diameter before deciding how many yards to put on.`;
  r.rows=[{use:c.useCase,setup:r.primarySetup.replace(' over monofilament backing','')},{use:'Simple straight-line setup',setup:r.monoRange}];
  m.setupRows=r.rows;
  m.calculatorIntro=`The ${n} is already selected. Capacity Only estimates a full spool; Backing + Main Line lets you choose a working length and estimate the backing beneath it. Both use the diameter of your selected line.`;
  m.faqBraid=`Start with ${r.braidRange}, then match the strength to your rod and fishing conditions. ${c.baitcast?'Very thin braid can dig into lower wraps on a baitcaster, so maximum yardage is not the only consideration.':'For a braid-and-leader setup, choose the leader for the cover and presentation rather than matching the braid label alone.'} Backing is optional; check that braid is secured against slipping if you tie directly to the spool.`;
  m.specsIntro=`These are published specifications for ${c.sku}. Retrieve is the listed amount per turn at the rated fill level, not a fixed value as the spool empties. Maximum drag is an upper rating, not the setting to use with every line.`;
  const ratings=read('data/reels.json').find(r=>r.id===item.id).manufacturer_capacity_ratings||[];
  m.capacityIntro=ratings.length?'The table keeps the published pound-test ratings and the verified millimeter ratings separate. ReelCalc uses a verified diameter rating for the matching line material when available, then scales it to your chosen line. A pound-test label alone does not tell you its thickness.':'These are the manufacturer\'s pound-test/yard ratings. No verified millimeter capacity was found for this model, so the calculator uses ReelCalc\'s existing reference-diameter estimate. Your selected line\'s diameter can make the result different from the label.';
  for(const a of ratings){assert(a.normalized.capacity_meters>0);m.capacityRows.push({type:a.material==='braid'?'Braid':'Monofilament',ratingLabel:`${a.normalized.diameter_mm} mm`,capacityLabel:`${a.normalized.capacity_meters} m (about ${Math.round(a.normalized.capacity_meters/.9144)} yd)`});}
  m.faqCapacity=`Use the factory ratings in the capacity table as reference points, not a promise that every line of that pound test fits the same amount. Select your exact line in the calculator, and watch the reel's fill clearance as you spool under steady tension.`;
  m.seoTitle=`${n} Line Capacity | ReelCalc`;
  m.metaDescription=`${n} (${c.sku}) line capacity, ${ratings.length?'verified diameter ratings, ':''}specs and a preloaded calculator for full-spool or backing setups.`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')){
  build();
}
export function build(){
  const build=read(`${output}/build-data.json`),held=new Set(build.heldPages.map(r=>r.id));
  const ready=build.newReels.filter(r=>!held.has(r.id)),images=read(`${directory}/images.json`);
  const reels=read('data/reels.json'),lines=read('data/lines.json'),registry=baseline('data/reel-pages.json'),staged=structuredClone(registry);
  const originalAffiliates=baseline('data/reel-affiliates.json'),affiliates=normalizeAffiliateRegistry(originalAffiliates),embeds=baseline('data/reel-page-embeds.json');
  const files=[];
  for(const item of ready){
    const reel=reels.find(r=>r.id===item.id),photo=images[item.id];
    const slug=item.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const page={reelId:item.id,path:'/reel-pages/p/'+slug,family:[reel.brand,reel.model].join(' '),imageUrl:photo.imageUrl,imageAlt:`${item.name}${reel.product_form==='combo-reel'?' shown on a representative MACH Bottomland combo rod':''}, manufacturer product photograph`,imageOriginalUrl:photo.originalUrl,imageSource:'Manufacturer product photograph',imageSourcePage:reel.source_url,imageMethod:'verified-manufacturer-image',verifiedLive:false,quickAnswerNote:''};
    assert(!staged.pages.some(p=>p.path===page.path||p.reelId===item.id));
    staged.pages.push(page);ensureAmazonReelOffer(affiliates,reel);
    const featureCatalog=read('data/reel-family-features.json');
    if(reel.sku==='C1-7000')featureCatalog.families['Abu Garcia|Ambassadeur C1'].sourceUrl=reel.source_url;
    const localRegistry={...registry,pages:[...registry.pages,page]};
    const result=generateReelPage(item.id,{reels,lines,registry:localRegistry,affiliates,featureCatalog});
    assert(result.status==='generated',JSON.stringify({id:item.id,status:result.status,problems:result.problems,failures:result.validation?.failures}));
    const m=result.model;customize(m,item);
    const block=sourceNotes(renderSquarespaceBlock(m,registry.assetBaseUrl),reel);
    const validation=validateGeneratedPage({html:block,reel:m.reel,model:m,registry:localRegistry,projectFiles:{calculatorExists:true,coreExists:true,mobileCssPresent:true}});
    assert.equal(validation.status,'PASSED',JSON.stringify(validation.failures));
    const blockFile=`generated/reel-pages/p/${slug}-squarespace.html`,previewFile=`generated/reel-pages/p/${slug}-preview.html`;
    save(blockFile,block);save(previewFile,renderPreviewDocument(m,sourceNotes(renderSquarespaceBlock(m,'../../..'),reel).replaceAll(photo.imageUrl,'../../../'+photo.file)));
    embeds.pages[slug]={reelId:item.id,pageTitle:m.pageTitle,seoTitle:m.seoTitle,metaDescription:m.metaDescription,canonicalPath:page.path,imageUrl:page.imageUrl,imageAlt:page.imageAlt,...Object.fromEntries(['intro','introVariant','introDetailMode','introFeatureNames','introEvidenceSource','introEvidenceKey'].map(k=>[k,m[k]])),related:m.related,sizeGuide:null,calculator:m.calculatorDefaults,content:Object.fromEntries(['who','setupIntro','setupRows','specsIntro','faqBraid','capacityIntro','capacityRows','monoText','braidText','faqCapacity'].map(k=>[k,m[k]]))};
    const row=Object.fromEntries(headers.map(h=>[h,'']));
    Object.assign(row,{'Product Type [Non Editable]':'SERVICE','Product Page':'reel-pages','Product URL':slug,Title:m.pageTitle,Description:importDescription(block),SKU:'RC'+crypto.createHash('sha256').update(item.id).digest('hex').slice(0,18).toUpperCase(),MPN:reel.sku,Price:'0','On Sale':'No',Stock:'Unlimited',Tags:'reelcalc-reel-guide',Visible:'No','Hosted Image URLs':photo.imageUrl});
    files.push({id:item.id,name:item.name,slug,blockFile,previewFile,row,checks:validation.checks,source:reel.source_url,sources:reel.spec_verification_sources});
    originalAffiliates.reels[item.id]=affiliates.reels[item.id];
  }
  embeds.version=Number(embeds.version)+1;staged.version=Number(staged.version)+1;
  write('data/reel-page-embeds.json',embeds);write('data/reel-affiliates.json',originalAffiliates);
  write(`${output}/ACTIVATE-AFTER-IMPORT-reel-pages.json`,staged);
  write(`${output}/build-pages.json`,{headers,files,held:build.heldPages});
  console.log(`Built and validated ${files.length} reel pages. ${held.size} held.`);
}
