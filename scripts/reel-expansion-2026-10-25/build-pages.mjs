import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as html from '../line-page-publishing/node_modules/parse5/dist/index.js';
import {generateReelPage} from '../generate-reel-page.mjs';
import {normalizeReel} from '../reel-pages/lookup.mjs';
import {buildRecommendationModel} from '../reel-pages/recommendations.mjs';
import {braidFaqAdvice} from '../reel-pages/braid-faq.mjs';
import {normalizeAffiliateRegistry,ensureAmazonReelOffer} from '../reel-pages/affiliates.mjs';
import {headers,importDescription,escape,all,attr} from '../product-expansion-2026-10/build-pages.mjs';
import {root,directory,output,date,read,write,save,hash,slugify,original} from './common.mjs';

const data=read(`${output}/build-data.json`),reels=read('data/reels.json'),lines=read('data/lines.json');
const registry=original('data/reel-pages.json'),embeds=original('data/reel-page-embeds.json');
const rawAffiliates=original('data/reel-affiliates.json'),affiliates=normalizeAffiliateRegistry(rawAffiliates);
const pages=[],files=[],media=[],images=new Map();
const title=r=>`${r.brand} ${r.model} ${r.size_label}`;

function capacityRows(c){
  const rows=[];
  for(const p of c.capacities){
    const type=p.material==='mono'?'Monofilament':p.material==='braid'?'Braid':'Fluorocarbon';
    const label=p.diameterMm>0?`${p.diameterMm} mm${p.strengthLb?` (${p.strengthLb} lb)`:''}`:p.strengthLb?`${p.strengthLb} lb`:`PE ${p.pe}`;
    const row={type,ratingLabel:label,capacityLabel:`${p.length} ${p.unit==='m'?'m':'yards'}`};
    if(!rows.some(x=>JSON.stringify(x)===JSON.stringify(row)))rows.push(row);
  }
  return rows;
}
function editorial(item,reel,index){
  const c=item.config,n=normalizeReel(reel),rec=buildRecommendationModel(n),name=title(reel);
  const p=c.capacities.find(x=>x.material===(reel.capacity_reference_type||'mono')&&x.strengthLb===reel.rated_line_lb)||c.capacities.find(x=>x.strengthLb>0);
  const material=p.material==='mono'?'mono':p.material==='braid'?'braid':'fluorocarbon';
  const rating=`${p.strengthLb} lb / ${p.length} ${p.unit==='m'?'m':'yards'} ${material}`;
  const feature=c.editorialFeatureSentence??item.familyEditorial?.featureSentence??'';
  const featureNames=['CI4+','HAGANE Gear','MGL Rotor','MicroModule Gear II','SilentDrive','X-Protect','X-Ship','G-Free Body','Propulsion Line Management','Long Stroke Spool','HT-100','Long Cast','Live Liner','Dura-Drag','Superline spool','six-way braking','six-way brakes','CZB spool bearings','Arrowhead line guide','rapid-access side plate','ZAION body','AIR ROTOR','MAGSEALED','Bite N\' Run clutch','AIRDRIVE','ATD TYPE-L','ATD TOUGH','Even Flow line roller','rotor brake','screw-in aluminum handle','Hydro Block','Torsion Control Armor','C-40X','rigid metal handle','oiled-felt drag','carbon-fiber drag'].filter(term=>feature.includes(term)).slice(0,3);
  const use=String(c.useCase).replace(/^Editorial:\s*/i,'').replace(/[.\s]+$/,'').replace(/^([A-Z])/,s=>s.toLowerCase());
  const ratio=String(c.ratio).includes(':')?c.ratio:`${c.ratio}:1`;
  const market = /Japan|JDM/i.test(c.market) ? 'Japanese-market' : 'US-market';
  const introduction=[
    `If you are setting up the ${name} for ${use}, its ${rating} rating is a useful starting point.`,
    `Planning to use the ${name} for ${use}? Its published ${rating} capacity gives you a starting point for choosing line.`,
    `For ${use}, the ${name} pairs ${ratio} gearing with a listed ${Number(c.iptIn).toFixed(1).replace(/\.0$/,'')}-inch retrieve per turn at full spool.`,
    `The ${name} is worth considering for ${use}. This guide follows model ${c.sku}, with a published ${rating} capacity.`
  ][index%4];
  const endings=[
    'Choose your exact line in the preloaded calculator below to estimate a full spool or optional backing beneath a shorter working length.',
    'The calculator below is already set to this reel, whether you want a full spool of main line or backing under a working section.',
    'Use the reel-specific calculator to compare line diameters and plan your fill, with or without backing.'
  ];
  const hasDiam=!!reel.manufacturer_capacity_ratings?.length;
  const diameterNote=hasDiam?'When a verified diameter rating exists for the selected material, the calculator uses it as the reference for your chosen line diameter.':'The manufacturer ratings here use pound test, so ReelCalc uses its existing reference diameters to estimate spool space.';
  const rows=capacityRows(c);
  const text=mat=>c.capacities.filter(p=>p.material===mat).map(p=>`${p.strengthLb?`${p.strengthLb} lb`:p.pe?`PE ${p.pe}`:p.diameterMm+' mm'}${p.diameterMm&&p.strengthLb?` (${p.diameterMm} mm)`:''} / ${p.length} ${p.unit==='m'?'m':'yards'}`).join('; ')||'Not published in the cited specifications';
  const quick=`${rec.braidRange} is a ReelCalc starting suggestion for this setup. For a straight main line, consider ${rec.monoRange}. Match the strength to your rod, presentation and cover; backing is optional.`;
  return {
    intro:[introduction,feature,endings[index%3]].filter(Boolean).join(' '),introVariant:'reviewed-expansion-2026-10-25',introDetailMode:featureNames.length?'verified-features':'verified-specifications',introFeatureNames:featureNames,introEvidenceSource:c.sourceUrls[0],introEvidenceKey:`${c.brand}|${c.model}|${c.sku}`,
    who:`This ${c.brand==='13 Fishing'?'configuration':'size'} is a starting point for ${c.useCase}. Choose the working line for the rod and presentation first, then allow a useful reserve for the fishing you expect. This page follows ${c.sku}${c.generation?` (${c.generation})`:''}; a similarly named model or another generation can have a different spool.`,
    quickAnswer:quick,calculatorHeading:`${c.model} ${c.size}`,calculatorIntro:`${c.sku} is already selected. Capacity Only estimates a full spool; Backing + Main Line estimates backing beneath the working length you choose. Both are estimates.`,
    setupIntro:`Start with a line strength suited to your rod, lure or bait, and the cover you fish. You can fill the spool with main line or use optional backing under a shorter working section. Keep steady tension while spooling and watch the fill level.`,
    setupRows:[{use:c.useCase,setup:rec.braidRange+' with a leader suited to the fishing'},{use:'Full spool of straight main line',setup:rec.monoRange},{use:'Shorter working length',setup:'Your selected main line over optional mono backing'}],
    capacityIntro:`These are the published capacity reference points for ${c.sku}. ${diameterNote} Two lines with the same pound-test label can have different diameters, so they may fill the spool differently.`,capacityRows:rows,monoText:text('mono'),braidText:text('braid'),
    specsIntro:`These specifications follow ${market} model ${c.sku}.${c.brand==='13 Fishing'?' This model is identified by retrieve hand and gear ratio; the cited specifications do not give it a numeric reel size.':''} Retrieve is the listed amount at the rated fill level and falls as line leaves the spool. Maximum drag is an upper rating, not a suggested fishing setting. This is a specification-based setup guide, not a hands-on review.`,
    faqBraid:braidFaqAdvice(n,rec).text,
    faqCapacity:`One published reference for this model is ${rating}. ${rows.length>1?'The full table above shows the other listed capacities.':'The cited source does not list a braid capacity for this exact model.'} Select your exact line to estimate the fill, then watch the spool clearance instead of forcing on the last few yards.`,
    seoTitle:`${name} Line Capacity | ReelCalc`,metaDescription:`${name} (${c.sku}) line capacity, ${hasDiam?'manufacturer diameter ratings, ':''}specs and a preloaded calculator for a full spool or optional backing.`,sourceLinkLabel:'the cited exact-model specifications'
  };
}
function nativeDocument(item){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(item.name)}</title><style>body{margin:0;font:18px Georgia,serif;background:#eef1ef}header,footer{padding:20px}.product-content-wrapper{display:flex;gap:32px}.product-gallery{min-height:500px;width:50%}.product-meta{width:50%;padding-left:38px}.hidden-up-md{display:none}@media(max-width:720px){.hidden-up-md{display:block}.hidden-down-md{display:none}}</style><script src="/js/squarespace-reel-page-loader.js" data-asset-base="/" data-page-slug="${item.slug}" defer></script></head><body><header>ReelCalc</header><main class="product-detail tag-reelcalc-reel-guide"><div data-product-detail-layout="simple"><div class="product-content-wrapper"><div class="product-gallery"></div><div class="product-meta"><h1 class="product-title">${escape(item.name)}</h1><div class="product-price">$0.00</div><div class="product-description hidden-down-md">${item.row.Description}</div><div class="product-add-to-cart"><button>Add to cart</button></div><div class="product-description hidden-up-md">${item.row.Description}</div></div></div></div></main><footer>ReelCalc</footer></body></html>`;
}

function formatSpecDisplay(document, config, photo) {
  if(photo.width<480){
    const image=all(document,node=>node.tagName==='img')[0];
    if(image)image.attrs.push({name:'style',value:`max-width:${photo.width}px;height:auto`});
  }
  for (const row of all(document, node=>node.tagName==='tr')) {
    const cells=(row.childNodes||[]).filter(node=>node.tagName==='td');
    const label=cells[0]?.childNodes?.[0]?.value;
    if(label==='Reel size'&&config.brand==='13 Fishing')cells[0].childNodes[0].value='Variant (hand / gearing)';
    if(label==='Line retrieve'&&cells[1]?.childNodes?.[0])cells[1].childNodes[0].value=`${Number(Number(config.iptIn).toFixed(1))} inches per crank`;
  }
  return document;
}

for(const [index,item] of data.additions.entries()){
  const c=item.config,reel=reels.find(x=>x.id===item.id);
  let slug=slugify(title(reel));
  if(pages.some(p=>p.path===`/reel-pages/p/${slug}`))slug+='-'+slugify(c.sku);
  assert(!registry.pages.some(p=>p.reelId===reel.id||p.path===`/reel-pages/p/${slug}`),`Page already exists: ${slug}`);
  let photo=images.get(c.image.url);
  if(!photo){
    const ext=path.extname(new URL(c.image.url).pathname).match(/^\.(jpg|jpeg|png|webp|avif)$/i)?.[0]||'.jpg';
    const imageFile=`assets/reel-expansion-2026-10-25/${slugify(c.brand+' '+c.model)}-${hash(c.image.url).slice(0,8)}${ext}`;
    if(!fs.existsSync(path.join(root,imageFile))){
      const response=await fetch(c.image.url,{signal:AbortSignal.timeout(60000),headers:{'User-Agent':'Mozilla/5.0'}});
      assert(response.ok&&/^image\//.test(response.headers.get('content-type')||''),`Invalid image ${c.image.url}: ${response.status}`);
      save(imageFile,Buffer.from(await response.arrayBuffer()));
    }
    const dimensions=await sharp(path.join(root,imageFile)).metadata();
    assert(dimensions.width>100&&dimensions.height>100,`Unusable product image: ${imageFile}`);
    photo={file:imageFile,url:c.image.url,width:dimensions.width,height:dimensions.height};images.set(c.image.url,photo);
  }
  const page={reelId:reel.id,path:`/reel-pages/p/${slug}`,family:slugify(c.brand+' '+c.model),imageUrl:registry.assetBaseUrl.replace(/\/$/,'')+'/'+photo.file,imageAlt:`${c.brand} ${c.model}${c.image.representative?' representative family image':' '+c.size}, product photograph`,imageOriginalUrl:c.image.url,imageSource:c.image.credit||'Product photograph from the cited source',imageSourcePage:c.image.sourceUrl,imageMethod:'verified-product-image',verifiedLive:false,quickAnswerNote:'',editorial:editorial(item,reel,index)};
  ensureAmazonReelOffer(affiliates,reel);rawAffiliates.reels[reel.id]=affiliates.reels[reel.id];
  const result=generateReelPage(reel.id,{reels,lines,registry:{...registry,pages:[...registry.pages,page]},affiliates});
  assert.equal(result.status,'generated',JSON.stringify({id:reel.id,problems:result.problems,failures:result.validation?.failures}));
  const m=result.model,doc=html.parseFragment(result.productionBlock);
  const spec=all(doc,n=>attr(n,'data-section')==='specifications')[0].childNodes.find(n=>n.tagName==='div');
  const urls=[...new Set([...c.sourceUrls,...c.capacities.map(p=>p.sourceUrl)])];
  const notes=html.parseFragment(`<p class="reelcalc-source-note">Sources checked October 25, 2026: ${urls.map((url,i)=>`<a href="${escape(url)}" rel="nofollow noopener" target="_blank">${i?'Supporting specification source':'Exact-model specification source'}</a>`).join('; ')}.</p>`);
  for(const node of notes.childNodes){node.parentNode=spec;spec.childNodes.push(node);}
  const block=html.serialize(formatSpecDisplay(doc,c,photo)),blockFile=`generated/reel-pages/p/${slug}-squarespace.html`,previewFile=`generated/reel-pages/p/${slug}-preview.html`;
  assert(!fs.existsSync(path.join(root,blockFile))||fs.existsSync(path.join(root,output,'native',slug+'.html')),'Refusing to overwrite unowned generated page');
  save(blockFile,block);save(previewFile,html.serialize(formatSpecDisplay(html.parse(result.previewDocument.replaceAll(page.imageUrl,'../../../'+photo.file)),c,photo)));
  embeds.pages[slug]={reelId:reel.id,pageTitle:m.pageTitle,seoTitle:m.seoTitle,metaDescription:m.metaDescription,canonicalPath:page.path,imageUrl:page.imageUrl,imageAlt:page.imageAlt,...Object.fromEntries(['intro','introVariant','introDetailMode','introFeatureNames','introEvidenceSource','introEvidenceKey'].map(k=>[k,m[k]])),related:m.related,sizeGuide:null,calculator:m.calculatorDefaults,content:Object.fromEntries(['who','setupIntro','setupRows','specsIntro','faqBraid','capacityIntro','capacityRows','monoText','braidText','faqCapacity'].map(k=>[k,m[k]]))};
  const row=Object.fromEntries(headers.map(h=>[h,'']));
  Object.assign(row,{'Product Type [Non Editable]':'SERVICE','Product Page':'reel-pages','Product URL':slug,Title:m.pageTitle,Description:importDescription(block),SKU:'RC'+hash(reel.id).slice(0,18).toUpperCase(),MPN:c.sku,Price:'0','On Sale':'No',Stock:'Unlimited',Tags:'reelcalc-reel-guide',Visible:'No','Hosted Image URLs':page.imageUrl});
  const entry={id:reel.id,name:title(reel),slug,row,blockFile,previewFile,sourceUrls:urls,checks:result.validation.checks};
  pages.push(page);files.push(entry);media.push({reelId:reel.id,...photo});save(`${output}/native/${slug}.html`,nativeDocument(entry));
}
embeds.version=Number(embeds.version)+1;
write('data/reel-page-embeds.json',embeds);write('data/reel-affiliates.json',rawAffiliates);
write(`${directory}/new-page-records.json`,{status:'awaiting-hidden-Squarespace-import',pages,instructions:'After import and approval, merge only these entries into the current reel-pages registry by reelId. Do not replace the current registry with a saved full snapshot.'});
write(`${output}/build-pages.json`,{headers,files,media,held:data.held});
save(`${output}/review.html`,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>ReelCalc new reel guides</title><style>body{font:17px/1.6 Arial;max-width:1000px;margin:30px auto;padding:0 20px;color:#213d31}h1{font-size:28px}li{padding:8px 0}img{width:70px;height:70px;object-fit:contain;vertical-align:middle;margin-right:15px}a{color:#165c3b}</style></head><body><h1>${files.length} new reel setup guides</h1><p>Prepared for hidden Squarespace import. Existing reel records are unchanged.</p><ul>${files.map(x=>`<li><img src="/${media.find(i=>i.reelId===x.id).file}" alt=""><a href="/${output}/native/${x.slug}.html">${escape(x.name)}</a></li>`).join('')}</ul></body></html>`);
console.log(JSON.stringify({pages:files.length,images:images.size,hidden:true}));
