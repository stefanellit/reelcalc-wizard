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
    let instance=null,pending=null,failure=null;
    function resolve(input={}){
      // null means NOT HANDLED, never a capacity value. Callers retain their legacy branch.
      if(!enabled()||input.mode!=='capacity_only'||input.backing||input.backingLine||input.manual||input.reelId==='manual-reel')return null;
      if(failure)return unavailable('Capacity data could not be loaded or verified.');
      if(!instance)return unavailable('Capacity data is not ready.');
      return instance.resolve(input);
    }
    async function ready(){
      if(!enabled())return false;
      if(!pending)pending=Promise.resolve().then(load).then(value=>{instance=value;return true;}).catch(()=>{failure=true;return false;});
      return pending;
    }
    return Object.freeze({ready,resolve,isEnabled:enabled});
  }
  function loadScript(url){return new Promise((resolve,reject)=>{const script=global.document.createElement('script');script.src=url;const timer=setTimeout(()=>{script.remove();reject(Error('Capacity script timeout'));},10000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);reject(Error('Capacity script unavailable'));};global.document.head.appendChild(script);});}
  const production=construct(async()=>{
    if(!global.ReelCalcCapacityResolver)await loadScript(resolverUrl.href);
    const response=await global.fetch(dataUrl.href,{cache:'default',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Capacity data unavailable');
    return global.ReelCalcCapacityResolver.create(await response.json(),global.ReelCalcCore);
  },productionEnabled);
  function createForTesting(options){
    if(options?.testOnly!==true||options.enabled!==true)throw Error('Explicit isolated test enablement required');
    return construct(()=>options.load?options.load():global.ReelCalcCapacityResolver.create(options.data,options.core||global.ReelCalcCore),()=>true);
  }
  global.ReelCalcCapacityService=Object.freeze({production,createForTesting});
})(window);
