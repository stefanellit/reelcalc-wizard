/* Generated: Phase 10 capacity-only. Public activation is OFF. */
(function(global){'use strict';
const MANIFEST={"version":"capacity-only-2026-09-27-v1","data_sha256":"18e693a2c728ca253293012cdece562dfe4ffee4cd5a7ad9e9a793879826efd9","engine_version":"2026.08-dual-anchor-v1","engine_sha256":"4a23382f4d826b0a90896f6201df1521b0f5b2520308a3543abd3d13eef95c7f","phase9_payload_sha256":"a3d8936489b3ae05352f954780b81292f72e1d9decd6b16139ed08b065080dac"};
function lexicalPrecision(value,text){
  const tokens=(String(text??'').match(/(?:\d+(?:\.\d+)?|\.\d+)/g)??[]).filter(t=>Math.abs(Number(t)-value)<1e-12);
  const places=unique(tokens.map(t=>t.includes('.')?t.split('.')[1].length:0));
  return {tokens,decimal_places:places.length===1?places[0]:null,step:places.length===1?10**(-places[0]):null,
    status:places.length===1?'recovered_from_original_text':places.length?'ambiguous_lexical_precision':'precision_not_preserved_in_text'};
}
function agreement(anchors,coarse=false){
  if(!anchors.length||anchors.some(a=>!positive(a.diameter_mm)||!positive(a.capacity_yards)))return {state:'unusable',K_spread_percent:null};
  const ks=anchors.map(a=>a.capacity_yards*a.diameter_mm**2),spread=100*(Math.max(...ks)/Math.min(...ks)-1);
  const coarseApplicable=coarse&&anchors.every(a=>a.rounding?.ten_unit_length_candidate);
  const intervals=anchors.map(a=>a.rounding?.[coarseApplicable?'hypothetical_ten_unit_length_K_interval':'strict_display_K_interval']);
  const allKnown=intervals.every(Boolean),overlap=allKnown?[Math.max(...intervals.map(x=>x[0])),Math.min(...intervals.map(x=>x[1]))]:null;
  const sorted=[...anchors].sort((a,b)=>a.diameter_mm-b.diameter_mm);
  const monotone=sorted.every((a,i)=>i===0||a.capacity_yards<sorted[i-1].capacity_yards);
  return {state:anchors.length===1?'single_anchor_unvalidated':spread<1e-10?'compatible_anchors':allKnown&&overlap[0]<=overlap[1]?'mild_rounding_disagreement':allKnown?'material_disagreement_requiring_caution':'rounding_precision_unresolved',
    K_spread_percent:spread,K_range:[Math.min(...ks),Math.max(...ks)],rounding_intersection:overlap&&overlap[0]<=overlap[1]?overlap:null,
    rounding_is_assumed:true,coarse_rounding_applied:coarseApplicable,all_precision_recovered:allKnown,strict_capacity_decreases_with_diameter:monotone};
}
function position(anchors,d){const a=[...anchors].sort((a,b)=>a.diameter_mm-b.diameter_mm),lo=a[0]?.diameter_mm,hi=a.at(-1)?.diameter_mm;if(!positive(d)||!positive(lo))return {position:'unusable',extrapolation_factor:null};const state=d<lo?'below':d>hi?'above':a.some(x=>x.diameter_mm===d)?'at_anchor':'inside';return {position:state,extrapolation_factor:d<lo?lo/d:d>hi?d/hi:1,diameter_range:[lo,hi]};}
function predict(method, anchors, d) {
  if (method !== 'loglog_length') throw new Error('Unapproved integration method');
  const a = [...anchors].sort((x,y)=>x.diameter_mm-y.diameter_mm);
  const exact=a.find(x=>x.diameter_mm===d); if(exact)return exact.capacity_yards;
  const i=a.findIndex(x=>x.diameter_mm>d),l=a[i-1],r=a[i];if(!l||!r)return null;
  return Math.exp(Math.log(l.capacity_yards)+(Math.log(r.capacity_yards)-Math.log(l.capacity_yards))*Math.log(d/l.diameter_mm)/Math.log(r.diameter_mm/l.diameter_mm));
}
function predict(method, anchors, d) {
  if (method !== 'loglog_length') throw new Error('Unapproved integration method');
  const a = [...anchors].sort((x,y)=>x.diameter_mm-y.diameter_mm);
  const exact=a.find(x=>x.diameter_mm===d); if(exact)return exact.capacity_yards;
  const i=a.findIndex(x=>x.diameter_mm>d),l=a[i-1],r=a[i];if(!l||!r)return null;
  return Math.exp(Math.log(l.capacity_yards)+(Math.log(r.capacity_yards)-Math.log(l.capacity_yards))*Math.log(d/l.diameter_mm)/Math.log(r.diameter_mm/l.diameter_mm));
}
function proposedBasis(c,diameter){
  const result={case_id:c.case_id??`${c.reel_id}:${c.material}`,material:c.material,selected_diameter_mm:diameter,
    capacity_yards:null,effective_K_yd_mm2:null,method:null,status:'hold',reason:null,
    production_enabled:false,policy_selected_after_analysis:true};
  const hold=(reason,state)=>({...result,reason,evidence_state:state??result.evidence_state});
  if(!['mono','braid'].includes(c.material)||!positive(diameter))return hold('invalid_material_or_diameter','unusable');
  const expected=c.material==='mono'?'M1':'B1';
  if((c.phase5_route??'')!==expected)return hold('phase5_source_not_admitted',c.blocking_issues?.length?'unresolved_source_conflict':'outside_verified_anchor_scope');
  const anchors=c.anchors??[];
  if(!anchors.length||anchors.some(a=>!positive(a.diameter_mm)||!positive(a.capacity_yards))||new Set(anchors.map(a=>a.diameter_mm)).size!==anchors.length)
    return hold('invalid_or_duplicate_diameter_anchors','unusable');
  const state=agreement(anchors),loc=position(anchors,diameter);
  result.evidence_state=state.state;result.range_position=loc.position;result.extrapolation_factor=loc.extrapolation_factor;
  result.confidence=c.material==='braid'?'limited_nominal_braid_chart_evidence':'manufacturer_chart_only';
  const exact=anchors.find(a=>Math.abs(a.diameter_mm-diameter)<=Number.EPSILON*Math.max(a.diameter_mm,diameter)*4);
  if(exact)return {...result,status:'published_anchor_only',method:'published_anchor',range_position:'at_anchor',extrapolation_factor:1,capacity_yards:exact.capacity_yards,
    effective_K_yd_mm2:exact.capacity_yards*diameter**2,used_anchor_ids:[exact.anchor_id],
    reason:'Quote this manufacturer rating without merging the chart. Not a measured fill guarantee; any chart caution remains.'};
  if(anchors.length<2)return hold('single_anchor_has_no_validated_range');
  if(!state.strict_capacity_decreases_with_diameter)return hold('nondecreasing_capacity_chart_requires_review','material_disagreement_requiring_caution');
  if(!['compatible_anchors','mild_rounding_disagreement'].includes(state.state))return hold('do_not_combine_unresolved_anchor_disagreement');
  if(loc.position!=='inside')return hold('outside_verified_range_no_supported_automatic_limit');
  const capacity=predict('loglog_length',anchors,diameter);
  if(!positive(capacity))return hold('no_valid_bracket','unusable');
  const sorted=[...anchors].sort((a,b)=>a.diameter_mm-b.diameter_mm),right=sorted.findIndex(a=>a.diameter_mm>diameter);
  return {...result,status:'conditional_research_estimate',method:'loglog_length',capacity_yards:capacity,
    effective_K_yd_mm2:capacity*diameter**2,used_anchor_ids:[sorted[right-1].anchor_id,sorted[right].anchor_id],
    reason:'Bracketed interpolation; rounding compatibility is conditional, not proof of tolerance or real-world accuracy.'};
}
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const unique=a=>[...new Set(a)];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const near=(a,b)=>Math.abs(a-b)<=Number.EPSILON*Math.max(Math.abs(a),Math.abs(b))*4;
const diameter=l=>positive(l.dia_in)?l.dia_in*25.4:positive(l.dia_mm)?l.dia_mm:null;
const lineType=l=>/braid/i.test(l.type)?'braid':/fluoro/i.test(l.type)?'fluoro':/mono|nylon|copolymer/i.test(l.type)?'mono':null;
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const insist=(ok,message)=>{if(!ok)throw Error('Capacity data: '+message);};
const sha=async value=>Array.from(new Uint8Array(await global.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');

async function create(input,core){
  insist(core?.ENGINE_VERSION===MANIFEST.engine_version,'engine version mismatch');
  const data=structuredClone(input);
  insist(data.schema_version===1&&data.resolver_version===MANIFEST.version&&data.data_version===MANIFEST.version&&data.engine_version===core.ENGINE_VERSION,'version mismatch');
  const reels=new Map(data.reels.map(r=>[r.reel.id,r])),lines=new Map(data.lines.map(l=>[l.id,l])),charts=new Map(data.charts.map(c=>[c.reel_id+'|'+c.material,c]));
  insist(reels.size===data.reels.length&&lines.size===data.lines.length&&charts.size===data.charts.length,'duplicate identity');
  for(const r of data.reels)for(const m of ['mono','braid'])insist(r.plans[m].length===16&&r.plans[m].every(i=>Number.isInteger(i)&&data.plans[i]),'invalid source decision table');
  for(const c of data.charts){
    const r=reels.get(c.reel_id);
    insist(r&&r.reel.sku===c.sku&&['mono','braid'].includes(c.material)&&c.phase5_route===(c.material==='mono'?'M1':'B1'),'chart identity/material');
    insist(c.region.every(x=>r.regions[c.material].includes(x)),'chart region');
    for(const a of c.anchors){
      insist(a.evidence_ids.length&&a.originals.length===a.evidence_ids.length,'missing anchor evidence');
      a.originals.forEach((o,i)=>{
        const d=o.original.diameter,l=o.original.capacity;
        insist(o.evidence_id===a.evidence_ids[i]&&c.source_ids.includes(o.source_id),'anchor provenance');
        insist(['mm','millimeters','in','inches'].includes(d.unit)&&['yd','yards','m','meters'].includes(l.unit),'anchor units');
        const mm=d.value*(['in','inches'].includes(d.unit)?25.4:1),yd=['m','meters'].includes(l.unit)?l.value/0.9144:l.value;
        insist(positive(mm)&&positive(yd)&&near(mm,a.diameter_mm)&&near(yd,a.capacity_yards),'normalized anchor');
      });
      const o=a.originals[0].original,d=o.diameter,l=o.capacity;
      const dp=lexicalPrecision(d.value,a.rounding.diameter.tokens.join(' ')),lp=lexicalPrecision(l.value,a.rounding.length.tokens.join(' '));
      insist(same(dp,a.rounding.diameter)&&same(lp,a.rounding.length),'stale lexical precision');
      const ds=['in','inches'].includes(d.unit)?25.4:1,ls=['m','meters'].includes(l.unit)?1/.9144:1;
      const interval=dp.step!==null&&lp.step!==null?[Math.max(0,l.value-lp.step/2)*ls*Math.max(0,d.value-dp.step/2)**2*ds**2,(l.value+lp.step/2)*ls*(d.value+dp.step/2)**2*ds**2]:null;
      insist(same(interval,a.rounding.strict_display_K_interval),'stale rounding interval');
    }
    insist(same(agreement(c.anchors),c.agreement),'stale chart agreement');
  }
  insist(await sha(data)===MANIFEST.data_sha256,'unsealed payload or evidence promotion');
  freeze(data);

  function hold(request,reason){
    return freeze({state:'hold_review',capacity_yards:null,numeric_available:false,route:'STOP',material:request.material??null,
      selected_diameter_mm:request.line?diameter(request.line):null,source_ids:[],anchors_used:[],range_state:null,
      held:true,review_required:true,warnings:[reason],legacy_state:'needs_review',reel_id:request.reelId??null,data_version:MANIFEST.version});
  }
  function resolve(request={}){
    if(request.mode&&request.mode!=='capacity_only'||request.backing||request.backingLine)return hold(request,'Capacity-only API: backing inputs are not supported.');
    if(request.policy&&request.policy!=='hold_verified_outside_range')return hold(request,'Unrecognized explicit test policy.');
    const r=reels.get(request.reelId);
    if(!r)return hold(request,'Known exact database reel ID required; no family or numeric-rating identity inference.');
    for(const f of ['sku','generation','market_region'])if(request.identity?.[f]!=null&&request.identity[f]!==r.reel[f])return hold(request,'Requested '+f+' does not match the frozen exact reel identity.');
    let line=request.line??lines.get(request.lineId);
    if(!line)return hold(request,'Selected line or known line ID required.');
    const product=lines.get(line.id);
    if(product){
      for(const f of ['dia_in','dia_mm','type','lb'])if(line[f]!=null&&line[f]!==product[f])return hold(request,'Selected product '+f+' was altered; use its stored value or a separately identified custom line.');
      if(line.custom_line)return hold(request,'A custom diameter must not impersonate a catalog product.');
      line=product;
    }else if(line.custom_line!==true)return hold(request,'Unknown product requires an explicitly user-supplied diameter.');
    const type=lineType(line),material=type==='braid'?'braid':'mono',mm=diameter(line);
    if(!type||request.material&&request.material!==material)return hold(request,'Requested material conflicts with selected line; no cross-material transfer.');
    if(!positive(mm))return hold({...request,line},'Actual selected-line diameter is missing; pound test and PE are not automatic replacements.');
    if(request.region!=null&&!r.regions[material].includes(request.region))return hold(request,'Requested region has no approved exact-model same-material evidence.');
    const adapted=positive(line.dia_in)?line:{...line,dia_in:mm/25.4};
    const basis=core.capacityBasisForActualLine(r.reel,adapted,data.lines);
    const oldCapacity=positive(basis?.capacityYards)?basis.capacityYards:null;
    const pe=basis?.actualLineEstimate?.method==='pe-diameter-calibrated';
    const mask=(positive(oldCapacity?oldCapacity*mm**2:null)?1:0)|(basis?.type==='mono-derived-braid-fallback'?2:0)|(basis?.actualLineEstimate?4:0)|(pe?8:0);
    const b=data.plans[r.plans[material][mask]],lower=b.compatibility,c=charts.get(r.reel.id+'|'+material),direct=material==='mono'?'M1':'B1';
    const warnings=b.warnings.map(w=>w.startsWith('Published anchors imply different effective K')?'Published anchors imply unequal effective K values; retain each original anchor and apply Phase 6 only per query.':w);
    if(type==='fluoro')warnings.push('Actual fluorocarbon diameter on a mono/nylon reel chart; equal packing has not been physically validated.');
    if(positive(line.dia_in)&&positive(line.dia_mm)&&!near(line.dia_in*25.4,line.dia_mm))warnings.push('Stored product inch and mm figures differ; original inch preference retained without fuzzy matching or product correction.');
    let v=null,capacity=null,route='STOP',legacyState=b.eligibility,review=b.eligibility==='needs_review',fallback=false,outside=false;
    if(b.route===direct){
      insist(c,'missing admitted chart');v=proposedBasis(c,mm);
      if(positive(v.capacity_yards)){
        capacity=v.capacity_yards;route=direct+(v.method==='published_anchor'?'_exact':'_interpolation');legacyState=v.status;
        if(!['compatible_anchors','mild_rounding_disagreement','single_anchor_unvalidated'].includes(v.evidence_state)||c.agreement.strict_capacity_decreases_with_diameter===false){
          review=true;warnings.push('This exact anchor is quoted only; other diameters in this chart require review. Do not merge incompatible anchors.');
        }
        warnings.push(material==='braid'?'Manufacturer nominal braid diameter evidence is limited; no measured fill guarantee.':'Manufacturer chart result, not a measured fill guarantee.');
      }else{
        outside=['outside_verified_range_no_supported_automatic_limit','single_anchor_has_no_validated_range'].includes(v.reason);
        if(!outside){legacyState='needs_review';review=true;warnings.push('Verified chart cannot supply an automatic estimate for this query; compatibility cannot bypass its review hold.');}
        else{legacyState='unavailable';warnings.push('Outside the verified diameter range: no verified extrapolation. Only an independently eligible compatibility route may continue.');if(lower?.state==='needs_review'){legacyState='needs_review';review=true;}}
      }
    }else if(['M5','B2','B3'].includes(b.route)&&b.eligibility==='eligible_compatibility'){
      capacity=oldCapacity;route=b.route;fallback=true;legacyState='low_confidence_compatibility';
    }
    if(fallback)warnings.push('Selected result is existing compatibility behavior, not verified manufacturer diameter or shadow inference.');
    if(pe&&fallback)warnings.push('Existing PE normalization remains compatibility evidence, not a printed manufacturer diameter.');
    const numeric=positive(capacity),state=numeric?(route.endsWith('_exact')?'manufacturer_exact':route.endsWith('_interpolation')?'manufacturer_interpolated':'compatibility_estimate'):review||v?'hold_review':'unavailable';
    const anchors=c?.anchors.filter(a=>(v?.used_anchor_ids??[]).includes(a.anchor_id)).map(a=>({anchor_id:a.anchor_id,diameter_mm:a.diameter_mm,capacity_yards:a.capacity_yards,evidence_ids:a.evidence_ids,original_values:a.originals.map(o=>o.original)}))??[];
    return freeze({state,capacity_yards:numeric?capacity:null,numeric_available:numeric,route,material,selected_diameter_mm:mm,
      selected_line:{id:line.id,original_dia_in:line.dia_in??null,original_dia_mm:line.dia_mm??null,overwritten:false},
      source_ids:route.startsWith(direct)?b.source_ids:fallback?[r.inventory_id]:[],anchors_used:anchors,
      range_state:v?.range_position??null,held:!numeric,review_required:review,warnings:unique(warnings),interpolation:v?.method??'not_used',legacy_state:legacyState,
      reel_id:r.reel.id,source_review_ids:b.review_ids,data_version:MANIFEST.version,
      applicability:{sku:r.reel.sku,generation:r.reel.generation??null,market_region:r.reel.market_region??null,source_regions:r.regions[material]},
      reason:v?.reason??null,compatibility:{route:lower?.route??null,eligibility:lower?.state??'unavailable',source_ids:lower?.source_ids??[]},backing_enabled:false});
  }
  return Object.freeze({resolve,version:MANIFEST.version,reelCount:reels.size});
}
global.ReelCalcCapacityResolver=Object.freeze({create,manifest:freeze(MANIFEST)});

})(window);
