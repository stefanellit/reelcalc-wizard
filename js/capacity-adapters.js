/* Shared capacity-only result contract. No source-selection math belongs here. */
(function(global){
  'use strict';
  const numericStates=new Set(['manufacturer_exact','manufacturer_interpolated','compatibility_estimate']);
  const copy={
    manufacturer_exact:"Based on the reel manufacturer's published diameter capacity.",
    manufacturer_interpolated:"Estimated between the reel manufacturer's published diameter ratings.",
    compatibility_estimate:"Estimated from the reel's published capacity information and selected line diameter.",
    hold_review:"ReelCalc doesn't have enough consistent data for a dependable automatic capacity estimate for this line.",
    unavailable:'A capacity estimate is not available for this reel and line.'
  };
  const surfaces=['wizard','reel_page','comparison','line_page','recommendations'];
  function isNumeric(result){return !!result&&numericStates.has(result.state)&&result.numeric_available===true&&result.held===false&&typeof result.capacity_yards==='number'&&Number.isFinite(result.capacity_yards)&&result.capacity_yards>0;}
  function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function present(result,options={}){
    const ok=isNumeric(result),state=ok?result.state:result?.state==='unavailable'?'unavailable':'hold_review';
    const metric=options.unit==='metric';
    const amount=ok?result.capacity_yards*(metric?.9144:1):null;
    return Object.freeze({state,numeric_available:ok,capacity_yards:ok?result.capacity_yards:null,
      title:ok?'Estimated full-spool capacity':state==='unavailable'?'Capacity unavailable':'Capacity needs review',
      value:ok?amount.toLocaleString('en-US',{maximumFractionDigits:1})+(metric?' m':' yd'):null,
      explanation:copy[state],caution:ok&&result.review_required?'This published rating is usable only at this diameter. Other ratings need review.':ok?'Actual fill can vary. Watch the spool as you add line.':null,
      recommendation_eligible:ok&&!result.review_required,affiliate_capacity_eligible:ok&&!result.review_required,
      // A full-spool calculation makes no decision about a backing setup.
      backing_required:null,spool_full:null});
  }
  function html(result,options){
    const v=present(result,options);
    return '<section class="result-box rc-capacity-result" data-capacity-state="'+v.state+'" role="status"><p class="result-kicker">'+escape(v.title)+'</p>'+
      (v.numeric_available?'<strong class="result-number" data-capacity-number>'+escape(v.value)+'</strong>':'')+
      '<p class="result-note">'+escape(v.explanation)+'</p>'+(v.caution?'<p class="result-note">'+escape(v.caution)+'</p>':'')+'</section>';
  }
  function withNumeric(result,callback){return isNumeric(result)?callback(result.capacity_yards):null;}
  function assessment(result,spoolYards){
    if(!isNumeric(result)||result.review_required||typeof spoolYards!=='number'||!Number.isFinite(spoolYards)||spoolYards<=0)return null;
    return Object.freeze({capacity_yards:result.capacity_yards,spool_enough:spoolYards>=result.capacity_yards,
      spare_yards:Math.max(0,spoolYards-result.capacity_yards),shortfall_yards:Math.max(0,result.capacity_yards-spoolYards)});
  }
  function create(service){
    function forSurface(name){
      function fromSurface(input={}){
        const reel=input.reel,line=input.mainLine||input.line;
        const capacityOnly=name==='wizard'?input.backingMode==='none':name==='reel_page'?input.mode==='capacity':name==='comparison'?input.backingEnabled===false:input.capacityOnly===true;
        if(!capacityOnly||!reel||input.manual||input.useManualReel||reel.manualRating||reel.manual_reel_entry_mode)return null;
        if(name==='recommendations'&&(input.backingLine||line?.generic_recommendation))return null;
        return service.resolve({mode:'capacity_only',reelId:reel.id,line,material:input.material,region:input.region,
          identity:{sku:reel.sku,generation:reel.generation,market_region:reel.market_region}});
      }
      return Object.freeze({
        surface:name,
        fromSurface,
        calculate(input){return service.resolve(input);},
        render(result,options){return html(result,options);},
        mount(element,result,options){element.innerHTML=html(result,options);},
        present,withNumeric,assessRetailSpool:assessment,
        recommendation(result){return present(result).recommendation_eligible?Object.freeze({capacity_yards:result.capacity_yards,route:result.route,source_ids:result.source_ids}):null;},
        affiliate(result,spoolYards,callback){const check=assessment(result,spoolYards);return check&&check.spool_enough?callback(check):null;}
      });
    }
    return Object.freeze(Object.fromEntries(surfaces.map(s=>[s,forSurface(s)])));
  }
  global.ReelCalcCapacityAdapters=Object.freeze({create,isNumeric,present,html,withNumeric,assessment,surfaces:Object.freeze(surfaces)});
})(window);
