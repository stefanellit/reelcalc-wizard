/* Page integration only. Capacity mathematics remain in the shared resolver. */
(function(global) {
  'use strict';
  if (global.ReelCalcCapacityPages) return;
  var base = new URL('./', document.currentScript.src);
  var release = 'capacity-only-2026-09-27-v1';
  var adapters = null;
  var unavailable = Object.freeze({state:'unavailable', numeric_available:false, capacity_yards:null,
    route:'STOP', material:null, selected_diameter_mm:null, source_ids:[], anchors_used:[],
    range_state:null, held:true, review_required:false});
  function enabled() { return global.ReelCalcCapacityConfig?.capacityOnlyEnabled === true; }
  function script(name, fresh) {
    return new Promise(function(resolve, reject) {
      var node = document.createElement('script');
      var url = new URL(name, base);
      url.searchParams.set('v', fresh ? String(Date.now()) : release);
      node.src = url.href;
      var timer = setTimeout(function() { node.remove(); reject(Error('Capacity asset timed out')); }, 10000);
      node.onload = function() { clearTimeout(timer); resolve(); };
      node.onerror = function() { clearTimeout(timer); node.remove(); reject(Error('Capacity asset unavailable')); };
      document.head.appendChild(node);
    });
  }
  var ready = (async function() {
    try {
      // A fresh central configuration is required on reload, including rollback.
      await script('capacity-config.js', true);
      if (!enabled()) return false;
      await script('capacity-adapters.js');
      await script('capacity-service.js');
      adapters = global.ReelCalcCapacityAdapters.create(global.ReelCalcCapacityService.production);
      return await global.ReelCalcCapacityService.production.ready();
    } catch (_) { return false; }
  })();
  function resolve(surface, input) {
    if (!enabled()) return null;
    var capacityOnly = surface === 'wizard' ? input.backingMode === 'none'
      : surface === 'reel_page' ? input.mode === 'capacity'
      : surface === 'comparison' ? input.backingEnabled === false : input.capacityOnly === true;
    if (!capacityOnly || !input.reel || input.manual || input.useManualReel || input.reel.manualRating || input.reel.manual_reel_entry_mode) return null;
    var result = adapters ? adapters[surface].fromSurface(input) : unavailable;
    if (result && !result.reel_id) {
      var line = input.line || input.mainLine;
      result = Object.assign({}, result, {reel_id:input.reel.id || '',
        material:/braid/i.test(line?.type || line?.material || '') ? 'braid' : line ? 'mono' : null,
        selected_diameter_mm:Number(line?.dia_in) > 0 ? Number(line.dia_in) * 25.4 : null});
    }
    return result;
  }
  function present(result, options) {
    return global.ReelCalcCapacityAdapters ? global.ReelCalcCapacityAdapters.present(result, options) : {
      state:'unavailable', numeric_available:false, capacity_yards:null, value:null,
      title:'Capacity unavailable', explanation:'A capacity estimate is not available for this reel and line.',
      recommendation_eligible:false, affiliate_capacity_eligible:false
    };
  }
  function html(result, options) {
    return global.ReelCalcCapacityAdapters ? global.ReelCalcCapacityAdapters.html(result, options)
      : '<section class="rc-capacity-result" data-capacity-state="unavailable" role="status"><p>Capacity unavailable</p><p>A capacity estimate is not available for this reel and line.</p></section>';
  }
  function analytics(result, line) {
    if (!enabled() || !result) return {};
    return {reel_id:result.reel_id || '', line_id:line?.id || '', material:result.material || '',
      capacity_route:result.route, capacity_state:result.state,
      selected_line_diameter:result.selected_diameter_mm, verified_anchor_count:result.anchors_used.length,
      range_state:result.range_state || '', review_state:!!result.review_required,
      source_tier:/_exact|_interpolation/.test(result.route) ? 'manufacturer' : result.route === 'STOP' ? 'none' : 'compatibility',
      fallback_used:result.state === 'compatibility_estimate'};
  }
  function record(surface, result, line, identity) {
    if (!enabled() || !result) return;
    var detail = Object.assign({surface:surface}, analytics(result, line), identity || {});
    // This separate event does not change or inflate existing completion events.
    document.dispatchEvent(new CustomEvent('reelcalc:capacity-only-result', {detail:detail}));
  }
  function assessment(result, yards) {
    return global.ReelCalcCapacityAdapters ? global.ReelCalcCapacityAdapters.assessment(result, yards) : null;
  }
  global.ReelCalcCapacityPages = Object.freeze({ready:ready, enabled:enabled, resolve:resolve,
    present:present, html:html, analytics:analytics, record:record, assessment:assessment});
})(window);
