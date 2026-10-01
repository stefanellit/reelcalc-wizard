/* Lazily initialized sidecar; legacy public APIs and backing are never replaced. */
(function(global){
  'use strict';
  const resolverUrl=new URL('capacity-resolver.js',global.document?.currentScript?.src||'https://invalid.local/js/capacity-service.js');
  const dataUrl=new URL('../data/capacity-production/capacity-runtime.json',resolverUrl);
  const release='capacity-only-2026-09-27-v1';
  resolverUrl.searchParams.set('v',release);
  dataUrl.searchParams.set('v',release);
  function unavailable(reason){return Object.freeze({state:'unavailable',numeric_available:false,capacity_yards:null,route:'STOP',material:null,selected_diameter_mm:null,source_ids:[],anchors_used:[],range_state:null,held:true,review_required:false,warnings:[reason]});}
  function productionEnabled(){return global.ReelCalcCapacityConfig?.capacityOnlyEnabled===true;}
  function construct(load,enabled){
    let instance=null,pending=null,failure=null,lastError='';
    function diagnostics(){return {status:failure?'failed':lastError?'failed':instance?'ready':'loading',code:failure||lastError||(!instance?'not_ready':'')};}
    function resolve(input={}){
      // null means NOT HANDLED, never a capacity value. Callers retain their legacy branch.
      if(!enabled()||input.mode!=='capacity_only'||input.backing||input.backingLine||input.manual||input.reelId==='manual-reel')return null;
      if(failure)return unavailable('Capacity data could not be loaded or verified.');
      if(!instance)return unavailable('Capacity data is not ready.');
      lastError='';
      try{return instance.resolve(input);}catch(error){lastError='resolver_runtime';throw error;}
    }
    async function ready(){
      if(!enabled())return false;
      if(!pending)pending=Promise.resolve().then(load).then(value=>{instance=value;return true;}).catch(error=>{
        const message=String(error?.message||'');
        failure=/version mismatch/.test(message)?'version_mismatch'
          :/^Capacity data:/.test(message)?'integrity_failure'
          :error?.capacityFailure||'engine_initialization';
        return false;
      });
      return pending;
    }
    return Object.freeze({ready,resolve,isEnabled:enabled,diagnostics});
  }
  function loadScript(url){return new Promise((resolve,reject)=>{const script=global.document.createElement('script');script.src=url;const timer=setTimeout(()=>{script.remove();reject(Error('Capacity script timeout'));},10000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);reject(Error('Capacity script unavailable'));};global.document.head.appendChild(script);});}
  const production=construct(async()=>{
    function failure(code){return Object.assign(Error('Capacity asset unavailable'),{capacityFailure:code});}
    if(!global.ReelCalcCapacityResolver)try{await loadScript(resolverUrl.href);}catch(_){throw failure('resolver_load');}
    let response;
    try{response=await global.fetch(dataUrl.href,{cache:'default',signal:AbortSignal.timeout(15000)});}catch(_){throw failure('data_load');}
    if(!response.ok)throw failure('data_load');
    let data;
    try{data=await response.json();}catch(_){throw failure('data_parse');}
    return global.ReelCalcCapacityResolver.create(data,global.ReelCalcCore);
  },productionEnabled);
  function createForTesting(options){
    if(options?.testOnly!==true||options.enabled!==true)throw Error('Explicit isolated test enablement required');
    return construct(()=>options.load?options.load():global.ReelCalcCapacityResolver.create(options.data,options.core||global.ReelCalcCore),()=>true);
  }
  global.ReelCalcCapacityService=Object.freeze({production,createForTesting});
})(window);
