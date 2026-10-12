import assert from 'node:assert/strict';
import {read,write,directory} from './research.mjs';
import {baseline} from './build-pages.mjs';
const products=baseline('data/line-page-products.json'),release=baseline('data/line-page-release.json');
const photo=read(`${directory}/images.json`)['fins-bfs-ultralight'];
assert(!products.products['fins-bfs-ultralight']);
products.products['fins-bfs-ultralight']={
  presentation:'gold',brand:'FINS',model:'BFS Ultralight',lineType:'Braid',role:'mainline',shortName:'BFS Ultralight',
  slug:'fins-bfs-ultralight-braid-diameter-capacity-guide',h1:'FINS BFS Ultralight Braid',
  seoTitle:'FINS BFS Ultralight Diameter & Reel Capacity | ReelCalc',
  metaDescription:'FINS BFS Ultralight 4-15 lb diameter chart, spool lengths and a reel capacity calculator. Plan a BFS or ultralight setup with optional backing.',
  construction:'8-carrier braided main line; made in the USA',
  quickSummary:'FINS BFS Ultralight is an eight-carrier braid offered from 4 to 15 lb for bait finesse and ultralight fishing. The small diameters matter here: 8 lb is listed at 0.090 mm, while 15 lb is 0.128 mm. Choose a strength below to see how much fits your reel, or plan a shorter working section over backing.',
  suitabilityTitle:'A thin main line for small presentations',
  suitabilitySummary:'Consider this line for a light spinning setup or a bait-finesse reel designed for thin line. Match the strength to the rod, lure and cover first. A large capacity estimate does not mean an ultralight reel needs hundreds of yards, and a 15 lb label does not make this thin braid a substitute for every heavier-cover setup.',
  strengthGuide:[
    'The 4 and 6 lb sizes are listed at 0.053 and 0.074 mm. These are the thinnest options in this family, so check that your reel is suitable for very fine braid and that the rod and drag setting protect a light setup.',
    'At 8 and 10 lb, the listed diameters are 0.090 and 0.104 mm. Compare those measurements with the line already on your reel instead of assuming another brand\'s 8 or 10 lb braid takes up the same space.',
    'The 12 and 15 lb options step up to 0.117 and 0.128 mm. They remain fine-diameter lines. On a baitcaster, keep the wraps firm and check for line digging in after a snag or hard pull.'
  ],
  spoolingGuide:[
    {title:'Decide how much working line you need',text:'A 150-yard package is available, but you do not have to put all of it on one reel. Pick a working length that covers your casts and a sensible reserve, then calculate optional backing beneath it. A full main-line fill is also an option.'},
    {title:'Keep the fine braid secure',text:'Use steady tension while spooling. Follow the reel maker\'s instructions for tying braid directly to the spool, or use a short mono base where needed to prevent the entire line pack from slipping.'},
    {title:'Check the last few yards by eye',text:'Stop at the reel\'s recommended fill clearance rather than forcing on the last part of a calculated amount. Nominal braid diameter and the way it lays on the spool can affect the final fill.'}
  ],
  faqs:[
    {question:'What is the listed diameter of FINS BFS Ultralight 8 lb?',answer:'FINS lists 8 lb at 0.090 mm. ReelCalc converts that millimeter figure to inches without rounding it first, so the calculation keeps the precision of the manufacturer\'s metric listing.'},
    {question:'Can I use it on a spinning reel as well as a BFS baitcaster?',answer:'FINS markets this braid for bait finesse and ultralight fishing. A suitable light spinning reel is another option. Check the reel\'s line guidance and match the rod, drag and leader to the intended setup.'},
    {question:'Which spool lengths and colors are listed?',answer:'The manufacturer lists 150- and 500-yard packages in Dark Green and Chartreuse. These are listed configurations, not a guarantee that every combination is currently in stock.'},
    {question:'Do I have to use backing?',answer:'No. You can calculate a full spool of main line or add backing beneath a shorter working section. Even without volume-filling backing, braid still needs a secure attachment to prevent slipping on the arbor.'}
  ],
  chartNote:'Manufacturer-listed millimeter diameters for all six strengths. The inch values here are converted from those millimeter figures, not the more coarsely rounded inch labels. Listed package lengths are 150 and 500 yards.',
  sourceNote:'Checked October 12, 2026 against the FINS BFS Ultralight product listing and launch article. The six published millimeter values are preserved exactly. ReelCalc uses their unrounded inch conversions for calculations.',
  reviewNote:'This is a specification-based setup guide, not a hands-on test or an independent measurement of braid diameter.',
  defaultLineId:'fins-bfs-ultralight-braid-8',defaultSpoolYards:150,defaultMode:'capacity',
  defaultBackingLineId:'berkley-trilene-big-game-monofilament-10',excludedLineIds:[],
  imageUrl:photo.originalUrl,localImagePath:photo.file,imageAlt:'FINS BFS Ultralight Dark Green box and line spool, manufacturer photograph',
  sources:[
    {label:'FINS BFS Ultralight product specifications',url:'https://www.finsfishing.com/products/bfs-ultralight',note:'Strengths, diameters, package lengths, colors and construction.'},
    {label:'FINS introduction to BFS Ultralight',url:'https://www.finsfishing.com/blogs/news/introducing-bfs-ultralight-an-american-made-answer-to-japanese-bait-finesse-system-braids',note:'Manufacturer description of the bait-finesse and ultralight line family.'}
  ],
  exampleSetups:[{reelId:'daiwa-rs-500-rs500',lineId:'fins-bfs-ultralight-braid-6',workingYards:100,spoolYards:150},{reelId:'shimano-curado-bfs-cubfsxgr',lineId:'fins-bfs-ultralight-braid-10',workingYards:75,spoolYards:150}]
};
const x=products.products['xbraid-x9-fulldrag-braid'];
const rows=read(`${directory}/extracted/602bf3513d7c92df.json`).valueRanges[0].values.filter(r=>/XBFD9/.test(r[1]||'')&&/Marsh Green/i.test(r[10]||''));
assert(rows.length>0,'No manufacturer Marsh Green product rows');
x.colorVariants=[{color:'Multi Color',calculationData:'Existing verified line records retained'},{color:'Marsh Green',calculationData:'Not included: manufacturer diameter columns are blank',sourceUrl:'https://daiwa-us-sheets-proxy.devotedigital.workers.dev/sheets/specs?ranges=LINES!A1:Z100000',checkedAt:'2026-10-12',variants:rows.map(r=>({manufacturerSku:r[1],package:r[3],strengthLb:Number(r[4])}))}];
x.faqs.push({question:'Is X9 Fulldrag also available in Marsh Green?',answer:'Daiwa now lists Marsh Green packages alongside Multi Color. The checked Marsh Green rows do not publish diameters, so this guide\'s calculator continues to use the verified Multi Color specifications. We have not copied those diameters into the Marsh Green variants.'});
release.version=Number(release.version)+1;release.products.push('fins-bfs-ultralight');
write('data/line-page-products.json',products);write('data/line-page-release.json',release);
write('outputs/product-expansion-2026-10-12/marsh-green-variants.json',x.colorVariants[1]);
console.log('Configured FINS guide and',rows.length,'Marsh Green variants. Existing line diameters unchanged.');
