import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root,read,write,missing,baseline} from './research.mjs';
import {generateReelPage} from '../generate-reel-page.mjs';
import {renderSquarespaceBlock,renderPreviewDocument} from '../reel-pages/render.mjs';
import {normalizeAffiliateRegistry,ensureAmazonReelOffer} from '../reel-pages/affiliates.mjs';
import {refreshIntros} from '../reel-pages/refresh-intros.mjs';

const output='outputs/spinning-reel-expansion';
const reconciliation=read('research/spinning-page-expansion/reconciliation.json');
const images=read('research/spinning-page-expansion/images-optimized.json');
const originalReels=baseline('data/reels.json');
const originalRegistry=baseline('data/reel-pages.json');
const originalEmbeds=baseline('data/reel-page-embeds.json');
const originalAffiliates=baseline('data/reel-affiliates.json');
const affiliates=normalizeAffiliateRegistry(originalAffiliates);
const ready=reconciliation.filter(r=>r.status==='verified'&&images[r.id]?.status==='ready');
const readyIds=new Set(ready.map(r=>r.id));
const reels=originalReels.map(r=>ready.find(v=>v.id===r.id)?.reel||r);
const stagedRegistry=structuredClone(originalRegistry);
const embeds=structuredClone(originalEmbeds);
const usedPaths=new Set(stagedRegistry.pages.map(p=>p.path));
const slugify=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const headers=['Product ID [Non Editable]','Variant ID [Non Editable]','Product Type [Non Editable]','Product Page','Product URL','Title','Description','SKU','GTIN','MPN','Option Name 1','Option Value 1','Option Name 2','Option Value 2','Option Name 3','Option Value 3','Price','Sale Price','On Sale','Stock','Categories','Tags','Weight','Length','Width','Height','Visible','Hosted Image URLs'];
for(const r of ready){
  const reel=r.reel;
  let slug=slugify([reel.brand,reel.model,reel.size_label].join(' '));
  if(usedPaths.has('/reel-pages/p/'+slug))slug+='-'+slugify(reel.sku);
  if(usedPaths.has('/reel-pages/p/'+slug))throw new Error('Duplicate URL: '+slug);
  const image=images[r.id];
  const page={reelId:r.id,path:'/reel-pages/p/'+slug,family:slugify(reel.brand+' '+reel.model),imageUrl:image.imageUrl,imageAlt:image.imageAlt,imageOriginalUrl:image.originalUrl,imageSource:'Manufacturer product image',imageSourcePage:image.source,imageMethod:'verified-manufacturer-image',verifiedLive:false,quickAnswerNote:'Using more backing can reduce how much premium line you need.'};
  usedPaths.add(page.path);
  stagedRegistry.pages.push(page);
  ensureAmazonReelOffer(affiliates,reel);
}
const files=[];
const failures=[];
const lines=read('data/lines.json');
const featureCatalog=read('data/reel-family-features.json');
refreshIntros(embeds,reels,featureCatalog);
for(const item of ready){
  const result=generateReelPage(item.id,{reels,lines,registry:stagedRegistry,affiliates,featureCatalog});
  if(result.status!=='generated'){failures.push({id:item.id,status:result.status,problems:result.problems||result.validation?.failures});continue;}
  const m=result.model;
  const slug=m.page.path.split('/').at(-1);
  const name=m.reel.displayName;
  const compact=[m.reel.brand,m.reel.model.replace(/\bSpinning(?: Reel)?\b/g,'').trim(),m.reel.sizeLabel].join(' ').replace(/\s+/g,' ');
  m.seoTitle=`${compact} Line Capacity | ReelCalc`;
  m.metaDescription=`${compact} line capacity, published specs, line recommendations, and backing guidance. Choose your line in the preloaded ReelCalc calculator.`;
  // Imported pages must not link to neighboring pages that are still waiting for import.
  m.related=m.related.filter(r=>originalRegistry.pages.some(p=>p.reelId===r.reelId));
  const production=renderSquarespaceBlock(m,stagedRegistry.assetBaseUrl);
  const preview=renderPreviewDocument(m,renderSquarespaceBlock(m,'../../..').replaceAll(m.page.imageUrl,'../../../'+images[item.id].assetPath));
  fs.mkdirSync(path.join(root,'generated/reel-pages/p'),{recursive:true});
  const blockFile=`generated/reel-pages/p/${slug}-squarespace.html`;
  const previewFile=`generated/reel-pages/p/${slug}-preview.html`;
  fs.writeFileSync(path.join(root,blockFile),production+'\n');
  fs.writeFileSync(path.join(root,previewFile),preview+'\n');
  // Only link to already-live neighboring pages until this import is confirmed.
  const related=m.related;
  embeds.pages[slug]={reelId:item.id,pageTitle:m.pageTitle,seoTitle:m.seoTitle,metaDescription:m.metaDescription,canonicalPath:m.page.path,imageUrl:m.page.imageUrl,imageAlt:m.page.imageAlt,intro:m.intro,introVariant:m.introVariant,introDetailMode:m.introDetailMode,introFeatureNames:m.introFeatureNames,introEvidenceSource:m.introEvidenceSource,introEvidenceKey:m.introEvidenceKey,related,sizeGuide:m.resources.find(r=>/^\/blog\/what-line-should-i-put-on-a-(?:2500|3000|4000)-spinning-reel$/.test(r.path))||null,calculator:m.calculatorDefaults,content:Object.fromEntries(['who','setupIntro','specsIntro','faqBraid','capacityIntro','capacityRows','monoText','braidText','faqCapacity'].map(key=>[key,m[key]]))};
  const row=Object.fromEntries(headers.map(h=>[h,'']));
  Object.assign(row,{'Product Type [Non Editable]':'SERVICE','Product Page':'reel-pages','Product URL':slug,Title:m.pageTitle,SKU:'RC'+crypto.createHash('sha256').update(item.id).digest('hex').slice(0,18).toUpperCase(),MPN:item.reel.sku,Price:'0','On Sale':'No',Stock:'Unlimited',Categories:'Fishing Line Setup Guides',Tags:'reelcalc-reel-guide',Visible:'Yes'});
  files.push({id:item.id,name,slug,blockFile,previewFile,row,checks:result.validation.checks,source:item.official.evidenceUrl,supplements:item.reel.spec_verification_sources,image:images[item.id]});
}
write(output+'/generation-failures.json',failures);
if(failures.length)throw new Error('Generation failures: '+failures.length+'; see report.');
embeds.version=11;
stagedRegistry.version=Number(originalRegistry.version)+1;
const held=reconciliation.filter(r=>!readyIds.has(r.id)).map(r=>{const original=missing.find(m=>m.id===r.id);return {id:r.id,name:[original.brand,original.model,original.size_label].join(' '),sku:original.sku,reasons:r.status==='verified'?[images[r.id]?.reason||'Image verification incomplete.']:r.reasons,source:original.source_url};});
write(output+'/build.json',{headers,files,held,baseCommit:'a5c6809bccd835cd8b0e57878cdf36bafb56de8e',existingPageCount:originalRegistry.pages.length});
write(output+'/support/data/reels.json',reels);
write(output+'/support/data/reel-page-embeds.json',embeds);
const publishedAffiliates=structuredClone(originalAffiliates);
for(const item of ready)publishedAffiliates.reels[item.id]=affiliates.reels[item.id];
write(output+'/support/data/reel-affiliates.json',publishedAffiliates);
write(output+'/ACTIVATE-AFTER-IMPORT-reel-pages.json',stagedRegistry);
write(output+'/held-reels.json',held);
write(output+'/specification-changes.json',ready.map(r=>({id:r.id,differences:r.differences,source:r.official.evidenceUrl,supplements:r.reel.spec_verification_sources})));
console.log('Generated:',files.length,'Held:',held.length,'Existing pages preserved:',originalRegistry.pages.length);
