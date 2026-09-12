import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read = f=>JSON.parse(fs.readFileSync(path.join(root,f),"utf8"));
const save = (f,d)=>fs.writeFileSync(path.join(root,f),JSON.stringify(d,null,2)+"\n");
const config=read("data/line-page-products.json"), lines=read("data/lines.json");
const reviews=read("research/line-pages/source-review.json");
const editorial=read("research/line-pages/seaguar-editorial.json");
const assets=path.join(root,"assets/line-pages"); fs.mkdirSync(assets,{recursive:true});
const exampleReels=["shimano-vanford-fa-2500hga-vf2500hga-691","shimano-stradic-fm-c3000xg-stc3000xgfm-686","shimano-slx-a-150-6-3-rh-slx150a"];
for(const item of read("research/line-pages/seaguar-batch.json")) {
  if(reviews[item.id].status!=="verified") continue;
  const copy=editorial[item.id]; assert(copy,`Missing editorial review: ${item.id}`);
  const source=read(`research/line-pages/sources/${item.id}.json`);
  const selected=lines.find(l=>l.brand==="Seaguar" && l.model===item.model && l.type===item.type && l.lb===copy.defaultLb);
  assert(selected?.spool_sizes_yd.includes(copy.defaultSpoolYards),`Invalid default: ${item.id}`);
  const imageUrl=new URL(source.images[0],"https://seaguar.com").href;
  assert.equal(new URL(imageUrl).hostname,"cdn.shopify.com");
  const localImagePath=`assets/line-pages/${item.id}.png`;
  if(!fs.existsSync(path.join(root,localImagePath))) {
    const response=await fetch(imageUrl,{signal:AbortSignal.timeout(30000)});
    assert(response.ok && response.headers.get("content-type")?.includes("image/png"),`Image failed: ${item.id}`);
    fs.writeFileSync(path.join(root,localImagePath),Buffer.from(await response.arrayBuffer()));
  }
  const {defaultLb,...content}=copy;
  config.products[item.id]={...content,presentation:"gold",brand:"Seaguar",model:item.model,lineType:item.type,
    slug:`${item.id}-${item.type.toLowerCase()}-diameter-capacity-guide`,h1:`Seaguar ${copy.shortName} ${item.type}`,
    seoTitle:`Seaguar ${copy.shortName} Diameter & Reel Capacity | ReelCalc`,
    metaDescription:`See Seaguar ${copy.shortName} diameters by strength. Check full-spool capacity for your reel, plan backing, and compare exact line diameters.`,
    suitabilityTitle:`Is ${copy.shortName} right for your setup?`,
    defaultLineId:selected.id,defaultBackingLineId:"berkley-trilene-big-game-monofilament-10",defaultMode:"capacity",excludedLineIds:[],
    imageUrl,localImagePath,imageAlt:`Seaguar ${item.model} ${item.type.toLowerCase()} retail package`,
    reviewNote:`This is a specification-based setup guide, not a hands-on ${copy.shortName} performance test.`,
    sourceNote:`Specifications checked against Seaguar's assigned product variants on ${source.retrievedAt.slice(0,10)}${reviews[item.id].chartUrl ? " and its published chart" : ""}. Unassigned package combinations are excluded. Stock and package design can change; use the diameter printed on your own package if it differs.`,
    sources:[{label:`Official Seaguar ${copy.shortName} specifications`,url:item.url,note:"Product construction, diameter entries, and assigned retail package lengths."},
      ...(reviews[item.id].chartUrl ? [{label:`Seaguar ${copy.shortName} specification chart`,url:reviews[item.id].chartUrl,note:"Manufacturer chart checked alongside current product variants."}] : [])],
    exampleSetups:exampleReels.map(reelId=>({reelId,lineId:selected.id,workingYards:75,spoolYards:copy.defaultSpoolYards}))
  };
}
save("data/line-page-products.json",config);
const release=read("data/line-page-release.json");
release.products=[...new Set([...release.products,...Object.keys(editorial)])];
// Preparation is not publication. Keep the live directory restricted to confirmed pages.
save("data/line-page-release.json",release);
console.log(`Prepared ${Object.keys(editorial).length} new model configurations and product assets; publishedProducts unchanged.`);
