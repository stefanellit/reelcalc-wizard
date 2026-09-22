import fs from 'node:fs';
import path from 'node:path';
import {root,read,write} from './research.mjs';

const out='outputs/spinning-reel-followup';
const build=read(out+'/build.json');
const audit=read(out+'/audit.json');
if(audit.status!=='passed'||audit.pages!==build.files.length)throw new Error('Passing audit required.');
const basename=`UPLOAD-THIS-${build.files.length}-new-spinning-reel-pages.csv`;
if(!fs.existsSync(path.join(root,out,basename)))throw new Error('Import CSV missing.');
for(const file of ['reels.json','reel-page-embeds.json','reel-affiliates.json'])fs.copyFileSync(path.join(root,out,'support/data',file),path.join(root,'data',file));
const byBrand={};
const reels=read('data/reels.json');
for(const f of build.files){const brand=reels.find(r=>r.id===f.id).brand;byBrand[brand]=(byBrand[brand]||0)+1;}
const report=[
  '# Spinning Reel Page Import',
  '',
  `Ready: **${build.files.length} new spinning-reel pages**. Held for more research: **${build.held.length}**. The requested 168-page follow-up is not fully complete.`,
  '',
  '## Import Steps',
  '',
  `1. In Squarespace, open the same product CSV import screen used for the earlier reel pages.`,
  `2. Import **${basename}** once. Use the existing **reel-pages** collection, not a new store or collection.`,
  '3. Do not change the CSV headers, product type, tags, IDs, or zero-price import fields. Those fields are required for the existing guide-page setup; the shared loader hides shopping controls and prices from readers.',
  `4. Wait for the import confirmation. The expected addition is ${build.files.length} items. Do not import the file a second time.`,
  '5. Tell Codex the import is complete. The next step is checking the live pages and activating their links in the organized guide directory and other selectors.',
  '',
  '## What Is Included',
  '',
  ...Object.entries(byBrand).map(([brand,count])=>`- ${brand}: ${count}`),
  '',
  '## Checks',
  '',
  '- Built with the existing shared reel-page generator, calculator engine, styling, line links, and affiliate system. No separate calculator or copied old template.',
  '- Exact model-code matching against manufacturer product tables or manufacturer-authored catalogs; supplemental catalog item numbers used where model labels differ.',
  '- Published mono and braid ratings reconciled against the page tables and calculator parser.',
  `- ${audit.calculationScenarios.toLocaleString('en-US')} capacity/backing/overfill scenarios passed, plus unit-conversion and rating round-trip checks.`,
  `- All ${audit.existingPagesPreserved} existing page entries, real-world-test links, and aliases preserved.`,
  '- CSV checked for 28 native columns, unique URLs and SKUs, blank product IDs, correct tags, and valid imported HTML.',
  '- Desktop previews tested for line selection, capacity, backing, affiliate links, and disclosure. A 390px phone-width preview was also visually checked.',
  '- Product photographs from manufacturers, their catalogs, or exact-family dealer listings optimized without changing the reels shown. Some older catalog photographs are lower resolution than current product photographs.',
  '- Every new page was opened in the browser; its calculator mounted and its photograph loaded without desktop horizontal overflow. See browser-audit.json for the exact list and manual calculation checks.',
  '',
  '## Important Limits',
  '',
  '- Manufacturer verification is not a physical spooling test. ReelCalc estimates still depend on published ratings, line diameters, and spooling conditions; existing uncertainty warnings remain active.',
  '- The directory registry stays at its existing size until import is confirmed, preventing premature links to missing Squarespace pages.',
  '- The remaining records are not included just to reach a number. The hold list identifies unresolved model codes, conflicting or incomplete specifications, and missing usable product photographs.',
  '',
  '## Not Yet Imported',
  '',
  'Nothing in this process imports items into Squarespace. The supporting GitHub assets must be deployed before the file is imported; see release-status.json for deployment verification.',
  '',
  '## Held Reels',
  '',
  'Many Daiwa records need model-identity cleanup, not merely another photograph. For example, the stored Tatula MQ records use older Tatula LT model codes, and the stored Certate HD sizes do not match the manufacturer lineup. Different generations, gearing suffixes, and spool sizes have not been silently substituted.',
  '',
  'The Offshore Angler Salt Striker product chart and manufacturer manual disagree on bearing count (4+1 versus 5+1); their capacity tables were found. KastKing manuals were located, but they contain parts diagrams rather than the full required specification tables. Manufacturer clarification or additional exact-generation documentation is still needed for unresolved records.',
  '',
  '| Reel | Stored model code | Why held |',
  '| --- | --- | --- |',
  ...build.held.map(h=>`| ${h.name.replaceAll('|','/')} | ${h.sku||'Not recorded'} | ${h.reasons.join(' ').replaceAll('|','/')} |`),
  ''
].join('\n');
fs.writeFileSync(path.join(root,out,'READ-ME-FIRST.md'),report);
write(out+'/release-status.json',{state:'prepared-not-yet-published',pages:build.files.length,held:build.held.length,imported:false,directoryActivated:false});
console.log('Prepared support files and import instructions. Directory activation intentionally deferred.');
