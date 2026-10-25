import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {root,directory,output,date,read,write,hash,slugify,identity,snapshot,original} from './common.mjs';

snapshot();
const sandbox = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/calculator-core.js'),'utf8'), sandbox);
const core = sandbox.window.ReelCalcCore;
const reels = original('data/reels.json');
const evidence = original('data/reel-diameter-evidence.json');
const additions = [], held = [], diameterRows = [];
const prior = read('data/reels.json');
for (const r of reels) assert.deepEqual(prior.find(x=>x.id===r.id), r, `Existing reel changed since snapshot: ${r.id}`);

function ranges(c) {
  if (c.braidRange && c.monoRange) return [c.braidRange,c.monoRange];
  const size = Number(c.sizeClass);
  if (c.reelType !== 'spinning') {
    if (/bfs|finesse/i.test(c.model)) return ['6-12 lb braid','4-8 lb mono/fluoro'];
    if (size >= 300 || c.reelType === 'round_baitcast') return ['40-65 lb braid','15-25 lb mono/fluoro'];
    return ['30-50 lb braid','10-17 lb mono/fluoro'];
  }
  if (size <= 1000) return ['4-8 lb braid','2-6 lb mono/fluoro'];
  if (size <= 2000) return ['6-12 lb braid','4-8 lb mono/fluoro'];
  if (size <= 3000) return ['10-20 lb braid','6-12 lb mono/fluoro'];
  if (size <= 4000) return ['15-30 lb braid','8-15 lb mono/fluoro'];
  if (size <= 5000) return ['20-40 lb braid','12-20 lb mono/fluoro'];
  if (size <= 6500) return ['30-50 lb braid','15-25 lb mono/fluoro'];
  if (size <= 8500) return ['40-65 lb braid','20-30 lb mono/fluoro'];
  return ['50-80 lb braid','25-40 lb mono/fluoro'];
}

for (const brandFile of ['shimano','penn','13-fishing','daiwa','okuma']) {
  const file = `${directory}/${brandFile}.json`;
  assert(fs.existsSync(path.join(root,file)), `Research not yet finished: ${file}`);
  const research = read(file);
  const imageOverrides = brandFile === 'okuma' ? read(`${directory}/okuma-images.json`) : [];
  held.push(...(research.held || []).map(x=>({...x,researchFile:file})));
  for (const c of research.candidates) {
    const photo = imageOverrides.find(image => image.model === c.model);
    if (photo) c.image = photo;
    const id = slugify(`${c.brand} ${c.model} ${c.size} ${c.sku}`);
    const duplicates = reels.filter(r => r.id === id || (identity(r.brand) === identity(c.brand) &&
      (identity(r.sku) === identity(c.sku) || identity(`${r.model}${r.size_label}`) === identity(`${c.model}${c.size}`))));
    if (duplicates.length) {
      held.push({model:`${c.brand} ${c.model} ${c.sku}`,reason:'Already represented in the database.',existingIds:duplicates.map(x=>x.id)});
      continue;
    }
    const problems = ['brand','model','sku','size','ratio','bearings','useCase'].filter(k=>!c[k]);
    for (const k of ['sizeClass','weightOz','dragLb','iptIn']) if (!(Number(c[k])>0)) problems.push(k);
    if (!c.image?.url || !c.image?.sourceUrl) problems.push('verified product image');
    if (!c.sourceUrls?.length) problems.push('source URLs');
    const capacities = c.capacities || [];
    const mono = capacities.filter(x=>x.material==='mono'&&x.strengthLb>0&&x.length>0);
    const braid = capacities.filter(x=>x.material==='braid'&&x.strengthLb>0&&x.length>0);
    if (!mono.length && !braid.length) problems.push('published pound-test capacity');
    if (problems.length) {
      held.push({model:`${c.brand} ${c.model} ${c.sku}`,reason:`Unconfirmed: ${problems.join(', ')}`,sources:c.sourceUrls});
      continue;
    }
    for (const rating of capacities) {
      assert(['mono','braid','fluoro'].includes(rating.material), `Material missing: ${c.sku}`);
      assert(['m','yd'].includes(rating.unit) && rating.length>0 && rating.sourceUrl, `Incomplete capacity: ${c.sku}`);
    }
    const basisMaterial = mono.length ? 'mono' : 'braid';
    const basis = mono.length ? mono : braid;
    const options = basis.map(p=>{
      const yards=p.unit==='m'?p.length/.9144:p.length;
      const diameter=core.assumedRatingDiameter(basisMaterial,p.strengthLb);
      return {lb:p.strengthLb,yards,diameter_in:diameter,spool_space:Number((yards*diameter**2).toFixed(6)),raw:`${p.strengthLb}-${p.length}${p.unit==='m'?' m':''}`};
    });
    const anchor=options[Math.floor(options.length/2)], [braidRange,monoRange]=ranges(c);
    const note = list => list.map(p=>`${p.strengthLb||`PE ${p.pe}`}-${p.length}${p.unit==='m'?' m':''}`).join(', ');
    const reel={
      id,brand:c.brand,model:c.model,sku:c.sku,size_label:String(c.size),size_class:String(c.sizeClass),recommendation_size_class:Number(c.sizeClass),
      reel_type:c.reelType==='spinning'?'Spinning reel':c.reelType==='round_baitcast'?'round_baitcast':'low_profile_baitcast',
      ...(c.reelType==='spinning'?{}:{baitcaster_class:c.reelType==='round_baitcast'?'round_casting':Number(c.sizeClass)>=300?'power':/bfs|finesse/i.test(c.model)?'bait_finesse':'standard'}),
      retrieve_hand:c.hand,capacity_yards:anchor.yards,rated_line_lb:anchor.lb,rated_line_diameter_in:anchor.diameter_in,spool_space:anchor.spool_space,
      capacity_options:options,capacity_note:mono.length?note(mono):`Braid reference: ${note(braid)}`,
      braid_capacity_note:note(capacities.filter(x=>x.material==='braid'&&(x.strengthLb>0||x.pe>0))),
      ...(basisMaterial==='braid'?{capacity_reference_type:'braid'}:{}),
      capacity_status:'ready',capacity_data_source:'Published exact-model specifications; manufacturer sources and cited corroboration',source_url:c.sourceUrls[0],source_file:file,data_warnings:[],
      gear_ratio:c.ratio,max_drag_lb:Number(c.dragLb),weight_oz:Number(c.weightOz),line_retrieve_in:Number(c.iptIn),bearings:c.bearings,
      reelcalc_recommended_braid:braidRange,reelcalc_recommended_mono_fluoro:monoRange,reelcalc_use_case:c.useCase,
      market_region:c.market,generation:c.generation,
      notes:typeof c.fieldNotes==='string'?c.fieldNotes:JSON.stringify(c.fieldNotes||{}),
      search_text:`${c.brand} ${c.model} ${c.size} ${c.sku} ${c.useCase}`.toLowerCase(),
      spec_date_checked:date,spec_verification_sources:[...new Set(c.sourceUrls)],
      capacity_reference_note:'Pound-test reference diameters use the existing ReelCalc lookup, not manufacturer measurements. Verified manufacturer diameters are stored separately by material.',
      ipt_verification_status:'verified',ipt_original_value:c.iptIn,ipt_original_unit:'in/turn',ipt_source_name:'Exact-model specification research',ipt_source_url:c.sourceUrls[0],ipt_date_checked:date,ipt_confidence:'high',
      published_capacity_ratings:capacities
    };
    for (const p of capacities.filter(x=>x.diameterMm>0 && ['mono','braid'].includes(x.material))) {
      const aid=`diam-${hash(`${id}|${p.material}|${p.diameterMm}|${p.length}|${p.unit}`).slice(0,24)}`;
      if (reel.manufacturer_capacity_ratings?.some(x=>x.id===aid)) continue;
      const meters=p.unit==='yd'?p.length*.9144:p.length;
      const raw={anchor_id:aid,reel_id:id,material:p.material,strength_lb:p.strengthLb||null,pe_size:p.pe||null,
        original:{diameter:{value:p.diameterMm,unit:'mm'},capacity:{value:p.length,unit:p.unit}},
        normalized:{diameter_mm:p.diameterMm,diameter_in:p.diameterMm/25.4,capacity_meters:meters,capacity_yards:meters/.9144},
        original_text:p.raw,source_type:'manufacturer_product_specifications',source_url:p.sourceUrl,evidence_file:file,source_sha256:hash(fs.readFileSync(path.join(root,file))),
        date_checked:date,source_model:c.sku,exact_model_verified:true,model_match_evidence:c.duplicateCheck||'Exact manufacturer model code verified in the cited table.',
        confidence:'high',status:'verified_source',notes:'Published material-specific diameter and length; no lb or PE conversion used to invent a diameter.'};
      diameterRows.push(raw);
      evidence.sources[aid]={reel_id:id,origin:{file:`${directory}/new-diameter-ratings.json`,pointer:`/${diameterRows.length-1}`},raw};
      (reel.manufacturer_capacity_ratings||=[]).push({id:aid,reel_id:id,material:p.material,original:raw.original,normalized:{diameter_mm:p.diameterMm,capacity_meters:meters},verification_status:'verified_source',calculation_eligible:true,evidence_file:'data/reel-diameter-evidence.json',source_url:p.sourceUrl});
    }
    reels.push(reel);
    additions.push({id,config:c,researchFile:file,familyEditorial:research.familyEditorial?.[c.model]||null});
  }
}
assert(additions.length>0,'No verified new records');
write(`${directory}/new-diameter-ratings.json`,diameterRows);
evidence.input_manifest.push({key:'reel-expansion-2026-10-25',file:`${directory}/new-diameter-ratings.json`,sha256:hash(fs.readFileSync(path.join(root,directory,'new-diameter-ratings.json')))});
const coverage={both:0,mono_only:0,braid_only:0,neither:0};
for(const reel of reels){const m=new Set((reel.manufacturer_capacity_ratings||[]).filter(x=>x.calculation_eligible).map(x=>x.material));coverage[m.has('mono')&&m.has('braid')?'both':m.has('mono')?'mono_only':m.has('braid')?'braid_only':'neither']++;}
const allRatings=reels.flatMap(x=>x.manufacturer_capacity_ratings||[]);
evidence.summary={...evidence.summary,date,total_reels:reels.length,reels_with_stored_diameter_evidence:reels.filter(x=>x.manufacturer_capacity_ratings?.length).length,reels_with_eligible_material_ratings:reels.length-coverage.neither,eligible_material_coverage:coverage,stored_evidence_rows:allRatings.length,eligible_rows:allRatings.filter(x=>x.calculation_eligible).length,held_rows:allRatings.filter(x=>!x.calculation_eligible).length,scope:'Append-only verified reel expansion; all pre-existing reel records unchanged.'};
write('data/reels.json',reels);
write('data/reel-diameter-evidence.json',evidence);
write(`${output}/build-data.json`,{date,originalReels:original('data/reels.json').length,totalReels:reels.length,additions,held,diameterRatings:diameterRows.length});
console.log(JSON.stringify({newReels:additions.length,total:reels.length,diameterRatings:diameterRows.length,held:held.length}));
