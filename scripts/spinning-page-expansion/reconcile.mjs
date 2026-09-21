import { read, write, missing, normalizeSku } from './research.mjs';
import { normalizeReel, requiredDataProblems } from '../reel-pages/lookup.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../../js/calculator-core.js',import.meta.url),'utf8'),sandbox);
const monoDiameter = sandbox.window.ReelCalcCore.monoDiameter;

const pages = read('research/spinning-page-expansion/extracted.json');
const rows = [];
const number = value => {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const capacities = (value, reverse = false) => [...String(value || '').matchAll(/(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)/g)].map(m => ({ lb: Number(m[reverse ? 2 : 1]), yards: Number(m[reverse ? 1 : 2]) }));
for (const page of pages) {
  if (page.kind === 'daiwa') for (const r of page.rows) rows.push({ brand: 'Daiwa', sku: r.MODEL, url: `https://daiwa.us/products/${r.HANDLE}`, evidenceUrl: page.url, gear_ratio: number(r['GEAR RATIO']), weight_oz: number(r['WEIGHT (OZ)']), line_retrieve_in: number(r['LINE PER CRANK (IN)']), max_drag_lb: number(r['DRAG MAX']), bearings: r.BEARINGS, mono: capacities(r['MONO CAPACITY']), braid: capacities(r['J-BRAID CAPACITY']), raw: r });
  if (page.kind === 'lews') for (const p of page.catalog.Items || []) for (const v of p.Children || []) {
    const f = Object.fromEntries((v.Attributes || []).map(a => [a.AttributeName, a.Values?.[0]]));
    if (/quantumfishing/.test(page.url)) f.ItemModel=v.Code;
    rows.push({ brand: "Lew's", sku: f.ItemModel || f.ItemNumber || v.Code, url: p.ContentUrl, evidenceUrl: page.url, gear_ratio: number(f.ItemGearRatio), weight_oz: number(f.ItemWeightOz), line_retrieve_in: number(f.ItemRecoveryPerTurnIn), max_drag_lb: number(f.ItemMaxDragLbs), bearings: f.ItemReelBearings, mono: capacities(f.ItemMonoLineCapacityYdsLbs, true), braid: capacities(f.ItemBraidLineCapacityYdsLbs, true), image: new URL(v.DefaultImageUrl || p.DefaultImageUrl, page.url).href, raw: f });
  }
  if (page.kind === 'shimano') for (const table of page.tables) {
    const headers = table[0];
    if (!headers.includes('SKU')) continue;
    for (const cells of table.slice(1)) {
      const f = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
      rows.push({ brand: 'Shimano', sku: f.SKU, url: page.url, evidenceUrl: page.url, gear_ratio: number(f['GEAR RATIO']), weight_oz: number(f['WEIGHT (OZ)']), line_retrieve_in: number(f['LINE RETRIEVE PER CRANK (IN)']), max_drag_lb: number(f['MAX DRAG (LB)']), bearings: f['BALL BEARINGS'], mono: capacities(f['MONO LINE CAPACITY (LB-YD)']), braid: capacities(f['POWERPRO LINE CAPACITY (LB-YD)']), image: page.images?.[0], raw: f });
    }
  }
  if (page.kind === 'pure') {
    const brand = /abugarcia/.test(page.url) ? 'Abu Garcia' : /pennfishing/.test(page.url) ? 'PENN' : 'Pflueger';
    for (const [variantId, f] of Object.entries(page.variants)) rows.push({ brand, sku: f['Model #'], url: page.url, evidenceUrl: page.url, gear_ratio: number(f['Gear Ratio']), max_drag_lb: number(f['Max Drag (lbs)'] || f['Max Drag']), mono: capacities(f['Mono Capacity (yds)'] || f['Mono Capacity (yds/lbs)'], true), braid: capacities(f['Braid Capacity (yds/lbs)'], true), image: page.product?.variants?.find(v => String(v.id) === variantId)?.featured_image?.src || page.images?.[0], raw: f });
  }
  if (page.kind === 'okuma') for (const v of page.product.variants || []) {
    const f = v.metafields;
    rows.push({ brand: 'Okuma', sku: v.sku, url: page.url, evidenceUrl: page.url, gear_ratio: number(f.gear_ratio), weight_oz: number(f.weight_oz), line_retrieve_in: number(f.line_retrieve), max_drag_lb: number(f.max_drag_pressure), bearings: f.bearings, mono: capacities(f.line_capacity, true), braid: capacities(f.braid_line_capacity, true), image: v.featuredImage?.startsWith('//') ? `https:${v.featuredImage}` : v.featuredImage, raw: f });
  }
}
write('research/spinning-page-expansion/official-rows.json', rows);
const catalog = read('research/spinning-page-expansion/catalog-rows.json');
for(const page of pages.filter(p=>p.url==='https://www.okumafishing.com/en/product/Cedros-Saltwater-Spinning-Reel.html')) for(const cells of page.tables[0].slice(1)) catalog.push({brand:'Okuma',sku:cells[0],weight_oz:Math.round(Number(cells[3])/28.349523125*10)/10,evidenceUrl:page.url,url:page.url,partialCapacities:true,mono:[],braid:[],raw:cells});
for (const r of rows) {
  if(r.brand==="Lew's" && /quantumfishing/.test(r.evidenceUrl)) r.brand='Quantum';
  const product = pages.find(p=>p.url===r.url&&p.kind==='pure');
  const variantId = Object.entries(product?.variants||{}).find(([,v])=>normalizeSku(v['Model #'])===normalizeSku(r.sku))?.[0];
  const sap=product?.product?.variants?.find(v=>String(v.id)===variantId)?.sku;
  const supplements = catalog.filter(c=>c.brand===r.brand && (normalizeSku(c.sku)===normalizeSku(r.sku) || (sap && c.sap===sap)));
  r.supplements = supplements;
  if (sap) r.sap=sap;
  for (const field of ['weight_oz','line_retrieve_in','bearings','max_drag_lb']) {
    const values = [...new Set(supplements.map(c=>c[field]).filter(v=>v!=null))];
    if (r[field]==null && values.length===1) r[field]=values[0];
  }
}
for (const c of catalog) if (!rows.some(r=>r.brand===c.brand&&normalizeSku(r.sku)===normalizeSku(c.sku))) rows.push(c);

const result = [];
for (const original of missing) {
  const matches = rows.filter(r => r.brand === original.brand && normalizeSku(r.sku) === normalizeSku(original.sku));
  // Never silently select between conflicting rows with the same model code.
  const specKey = r => JSON.stringify([r.gear_ratio,r.weight_oz,r.line_retrieve_in,r.max_drag_lb,r.bearings,r.mono,r.braid]);
  const variants = [...new Set(matches.map(specKey))];
  if (!matches.length || variants.length > 1) {
    result.push({ id: original.id, status: 'held', reasons: [matches.length ? 'Conflicting manufacturer rows for the same model code.' : 'Exact model code not matched in collected manufacturer sources.'], candidateSourceRows: matches });
    continue;
  }
  const official = matches[0];
  if (!official.bearings) {
    const sourcePage=pages.find(p=>p.url===official.url);
    for(const table of sourcePage?.tables||[]) {
      const modelColumn=table[0].indexOf('Model Number');
      const bearingColumn=table[0].indexOf('# Ball Bearings');
      if(modelColumn<0||bearingColumn<0)continue;
      const row=table.slice(1).find(c=>normalizeSku(c[modelColumn])===normalizeSku(official.sku));
      if(row?.[bearingColumn])official.bearings=row[bearingColumn];
    }
  }
  if (original.brand === 'Daiwa' && original.model === 'Tatula MQ LT' && official.raw.HANDLE === 'tatula-lt') {
    result.push({id:original.id,status:'held',reasons:['Stored SKU is for Tatula LT, but the record says Tatula MQ LT. Exact generation must be resolved.'],official});
    continue;
  }
  const reel = structuredClone(original);
  const differences = [];
  for (const field of ['gear_ratio','weight_oz','line_retrieve_in','max_drag_lb','bearings']) {
    let value = official[field];
    if (value == null || value === '' || value === '--') continue;
    if (field === 'gear_ratio') value = `${value}:1`;
    if (field === 'bearings') value = String(value);
    if (String(reel[field]) !== String(value)) differences.push({ field, before: reel[field], after: value });
    reel[field] = value;
  }
  const capacityKey = list => JSON.stringify(list.map(x => [Number(x.lb), Number(x.yards)]).sort((a,b) => a[0]-b[0] || a[1]-b[1]));
  const oldMono = (original.capacity_reference_type === 'braid') ? [] : original.capacity_options || [];
  const oldBraid = normalizeReel(original).braidCapacities;
  if(oldBraid.length&&!official.braid.length){
    result.push({id:original.id,status:'held',reasons:['Stored braid ratings were not recovered from the manufacturer source; verify before removing them.'],official,reel});
    continue;
  }
  const capacityConflicts = [];
  if (capacityKey(oldMono) !== capacityKey(official.mono)) capacityConflicts.push({ type: 'mono', stored: oldMono, official: official.mono });
  if (capacityKey(oldBraid) !== capacityKey(official.braid)) capacityConflicts.push({ type: 'braid', stored: oldBraid, official: official.braid });
  if (!official.mono.length || (official.partialCapacities && capacityConflicts.length)) {
    result.push({ id: original.id, status: 'held', reasons: [!official.mono.length ? 'No verified mono reference; braid-only record needs separate display review.' : 'Only a partial catalog capacity row was found; full reference still requires verification.'], differences, capacityConflicts, official, reel });
    continue;
  }
  // Exact-model manufacturer rows replace stored transcription errors. Keep the
  // original and replacement rows in the audit; do not manufacture diameters.
  if (capacityConflicts.length) {
    reel.capacity_options = official.mono.map(c=>{
      const diameter_in=monoDiameter(c.lb);
      return {...c,diameter_in,spool_space:c.yards*diameter_in**2,raw:`${c.lb}-${c.yards}`};
    });
    const anchor = reel.capacity_options.find(c=>c.lb===original.rated_line_lb) || reel.capacity_options[Math.floor(reel.capacity_options.length/2)];
    reel.capacity_yards=anchor.yards;
    reel.rated_line_lb=anchor.lb;
    reel.rated_line_diameter_in=anchor.diameter_in;
    reel.spool_space=anchor.spool_space;
    reel.capacity_note=official.mono.map(c=>`${c.lb}-${c.yards}`).join(', ');
    reel.braid_capacity_note=official.braid.map(c=>`${c.lb}-${c.yards}`).join(', ');
    differences.push({field:'published capacities',before:{mono:oldMono,braid:oldBraid},after:{mono:official.mono,braid:official.braid}});
  }
  reel.data_warnings = (reel.data_warnings || []).filter(w => w !== 'Source/spec should be verified before public use.');
  reel.source_url = official.url;
  reel.capacity_data_source = `Official ${reel.brand} exact-model specification table`;
  reel.spec_date_checked = new Date().toISOString().slice(0,10);
  reel.spec_verification_sources = [official.evidenceUrl,...(official.supplements||[]).map(c=>c.evidenceUrl)].filter((v,i,a)=>a.indexOf(v)===i);
  if(official.line_retrieve_in){
    const retrieveSource=(official.supplements||[]).find(c=>Number(c.line_retrieve_in)===Number(official.line_retrieve_in));
    reel.ipt_verification_status='verified';
    reel.ipt_original_value=official.line_retrieve_in;
    reel.ipt_original_unit='in/turn';
    reel.ipt_source_name=`Official ${reel.brand} exact-model specifications`;
    reel.ipt_source_url=retrieveSource?.evidenceUrl||official.evidenceUrl;
    reel.ipt_date_checked=reel.spec_date_checked;
    reel.ipt_confidence='high';
    reel.ipt_notes='Exact model matched to manufacturer product specifications or manufacturer-authored catalog.';
  }
  if (!reel.reel_type) reel.reel_type='Spinning reel';
  if (reel.brand==='PENN' && /HS$/.test(reel.sku) && !/HS$/.test(reel.size_label)) reel.size_label+='HS';
  const problems = requiredDataProblems(normalizeReel(reel));
  for(const field of ['gear_ratio','weight_oz','line_retrieve_in','max_drag_lb','bearings']) {
    if(!official[field])problems.push(`Manufacturer verification still needed for ${field}.`);
  }
  result.push({ id: original.id, status: problems.length ? 'held' : 'verified', reasons: problems, differences, official, reel });
}
write('research/spinning-page-expansion/reconciliation.json', result);
console.log(JSON.stringify(Object.fromEntries([...new Set(missing.map(r=>r.brand))].map(brand => [brand, { total: missing.filter(r=>r.brand===brand).length, verified: result.filter(r=>r.status==='verified' && r.reel.brand===brand).length } ])), null, 2));
console.log('Verified', result.filter(r=>r.status==='verified').length, 'Held', result.filter(r=>r.status==='held').length);
