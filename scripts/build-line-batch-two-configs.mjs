import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const save=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const batch=read('research/line-pages/batch-two-specs.json'),copy=read('research/line-pages/batch-two-editorial.json');
const evidence=read('research/line-pages/batch-two-evidence.json'),config=read('data/line-page-products.json'),lines=read('data/lines.json');
const reels=['shimano-vanford-fa-2500hga-vf2500hga-691','shimano-stradic-fm-c3000xg-stc3000xgfm-686','shimano-slx-a-150-6-3-rh-slx150a'];
for(const item of batch){
  const {defaultLb,...editorial}=copy[item.id];assert(editorial);
  const ev=evidence[item.id];const line=lines.find(l=>l.brand===item.brand&&l.model===item.model&&l.type===item.type&&l.lb===defaultLb);
  assert(line?.spool_sizes_yd.includes(editorial.defaultSpoolYards),item.id+' default package');
  const photoId=item.id==='sunline-super-natural-mono'?'sunline-super-natural-330':item.id;
  const source=read(`research/line-pages/sources/${item.brand.toLowerCase()}/${item.sourceIds[0]}.json`);
  const ext=['sunline-assassin-fc','sunline-sx1'].includes(item.id)?'png':'jpg';
  const localImagePath=`assets/line-pages/${photoId}.${ext}`;assert(fs.existsSync(localImagePath));
  config.products[item.id]={...editorial,presentation:'gold',brand:item.brand,model:item.model,lineType:item.type,
    slug:`${item.id}-${item.type.toLowerCase()}-diameter-capacity-guide`,h1:`${item.brand} ${editorial.shortName} ${item.type}`,
    seoTitle:`${item.brand} ${editorial.shortName} Diameter & Reel Capacity | ReelCalc`,
    metaDescription:`Find ${item.brand} ${editorial.shortName} diameters by strength. Calculate your reel's full-spool amount, plan backing, and compare exact lines and package lengths.`,
    suitabilityTitle:`Is ${editorial.shortName} right for your setup?`,defaultLineId:line.id,
    defaultMode:'capacity',defaultBackingLineId:'berkley-trilene-big-game-monofilament-10',excludedLineIds:ev.excludedLineIds,
    imageUrl:new URL(source.images[0],source.url).href,localImagePath,
    imageAlt:`${item.brand} ${item.model} ${item.type.toLowerCase()} manufacturer product package`,
    reviewNote:`This is a specification-based setup guide, not a hands-on ${editorial.shortName} performance test.`,
    sourceNote:`Specifications checked ${ev.checkedAt.slice(0,10)}. ${ev.note} Check the actual package when buying older or imported stock. Product imagery identifies the model, not every selectable strength.`,
    sources:[...ev.sourceUrls.map((url,i)=>({label:`Official ${item.brand} ${editorial.shortName}${ev.sourceUrls.length>1?' specifications '+(i+1):' specifications'}`,url,note:'Manufacturer material, strength, diameter, and package evidence.'})),
      ...[...new Set(ev.charts)].map((url,i)=>({label:`Manufacturer diameter chart${ev.charts.length>1?' '+(i+1):''}`,url,note:'Published numeric diameter pairs checked visually against the catalog.'}))],
    exampleSetups:reels.map(reelId=>({reelId,lineId:line.id,workingYards:75,spoolYards:editorial.defaultSpoolYards}))};
}
save('data/line-page-products.json',config);
const release=read('data/line-page-release.json');
release.products=[...new Set([...release.products,...batch.map(p=>p.id)])];
save('data/line-page-release.json',release);
console.log('Prepared 10 review-only gold guides. Live publishedProducts unchanged.');
