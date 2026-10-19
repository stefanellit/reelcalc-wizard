import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const dir='research/reel-page-completion-2026-10-18';
const records=read('data/reels.json');
const beast=read(`${dir}/beast-extracted.json`),stella=read(`${dir}/stella-extracted.json`);
const openings={
 BST3000H:'If you want a spinning setup for bass or lighter inshore work, the Beast 3000H gives you a 10 lb / 140-yard mono reference to plan around. Rocket Line Management helps control line coming off the spool, but the diameter of the line you choose still determines how much fits. Use the calculator below for a full fill or a shorter main line over optional backing.',
 BST3500H:'The Beast 3500H gives you more room than the 3000H at the same 10 lb mono rating: 190 yards instead of 140. That extra reserve is useful to consider when you want a longer working section without jumping straight to the 4000H. Rocket Line Management is part of the reel\'s line-handling design. Choose your exact line below to estimate a refill with or without backing.',
 BST4000H:'For a heavier bass or inshore spinning setup, the Beast 4000H starts with a published 12 lb / 180-yard mono capacity. Its Power Stack Carbon Matrix Drag System provides the reel\'s stopping power; choose your fishing drag for the line and rod, not the maximum rating. The calculator is set to this exact model so you can compare a full spool with an optional-backing setup.',
 BST5000H:'The Beast 5000H is the largest of these four sizes, with a 20 lb / 125-yard mono rating and a brass Duragear Gen III gear. For inshore or heavier freshwater fishing, think about how much reserve you need after the cast before choosing a thicker line. Use this reel\'s calculator to plan either a full spool of main line or backing beneath a shorter amount.',
 STLSW8000PGD:'For a saltwater setup built around jigging or working heavier loads, the Stella SW D 8000PG offers the lower 4.8:1 gearing of these two 8000 models. Its listed retrieve is 36 inches per turn, compared with 42 inches on the HG. InfinityXross spreads load across the gear teeth. Shimano publishes PowerPro braid capacities for this model; use the calculator below to plan your chosen main line with or without backing.',
 STLSW8000HGD:'When picking up line quickly matters for your saltwater lure setup, the Stella SW D 8000HG brings in a listed 42 inches per turn with its 5.6:1 gearing. It has the same published PowerPro capacities as the 8000PG, so this choice is about retrieve rather than extra line room. InfinityXross spreads load across the gear teeth. Choose your line below to estimate a full fill or work out optional backing.'
};
const features={BST3000H:'Rocket Line Management',BST3500H:'Rocket Line Management',BST4000H:'Power Stack Carbon Matrix Drag System',BST5000H:'Duragear Gen III',STLSW8000PGD:'InfinityXross',STLSW8000HGD:'InfinityXross'};
const configs=[];
for(const r of records.filter(r=>Object.hasOwn(openings,r.sku))){
 const isBeast=r.brand==='Abu Garcia',proof=isBeast?beast:stella;
 const row=proof.rows.find(t=>t.startsWith(r.sku+' '));if(!row)throw Error('Missing official row '+r.sku);
 const image=isBeast?beast.images.find(i=>i.src.includes(`_${1637482+['3000H','3500H','4000H','5000H'].indexOf(r.size_label)}_alt1`)):stella.images.find(i=>i.src.includes('PRD_')&&i.src.includes('_main'));
 const sourceImage=image.src.startsWith('//')?'https:'+image.src:image.src;
 const patch=isBeast?{}:{capacity_reference_type:'braid',capacity_reference_note:'Shimano publishes PowerPro braid capacities for this exact model; no mono capacity is published in the cited U.S. table.',data_warnings:r.data_warnings.filter(x=>x!=='Mono capacity is not published; spool volume is calculated from the verified PowerPro capacity.')};
 const photo=isBeast?{url:sourceImage.replace('width=300','width=900'),sourceUrl:proof.url}:{url:'https://stefanellit.github.io/reelcalc-wizard/assets/reel-page-images/e1c238fd7a1ea4f56d4c.avif',localFile:'assets/reel-page-images/e1c238fd7a1ea4f56d4c.avif',sourceUrl:proof.url,representative:true};
 configs.push({reelId:r.id,status:'verified',reason:'Exact manufacturer product table rechecked for this batch.',sources:[{url:proof.url,evidence:row}],specs:patch,image:photo,features:[features[r.sku]],intro:openings[r.sku],unavailableSpecs:isBeast?{weight_oz:'Not published in the checked manufacturer specification',line_retrieve_in:'Not published in the checked manufacturer specification'}:{},braidOnly:!isBeast});
}
fs.writeFileSync(path.join(root,dir,'beast-stella.json'),JSON.stringify(configs,null,2)+'\n');
console.log('Prepared '+configs.length+' exact-model page inputs.');
