/* Page integration only. Capacity mathematics remain in the shared resolver. */
(function(global) {
  'use strict';
  if (global.ReelCalcCapacityPages) return;
  var base = new URL('./', document.currentScript.src);
  var release = 'capacity-only-2026-09-27-v1';
  var monitoringRelease = 'capacity-monitoring-2026-09-30-v1';
  var adapters = null;
  var loadStage = '', bridgeFailure = '';
  var unavailable = Object.freeze({state:'unavailable', numeric_available:false, capacity_yards:null,
    route:'STOP', material:null, selected_diameter_mm:null, source_ids:[], anchors_used:[],
    range_state:null, held:true, review_required:false});
  function enabled() { return global.ReelCalcCapacityConfig?.capacityOnlyEnabled === true; }
  function script(name, fresh) {
    return new Promise(function(resolve, reject) {
      var node = document.createElement('script');
      var url = new URL(name, base);
      url.searchParams.set('v', fresh ? String(Date.now()) : name === 'capacity-service.js' ? monitoringRelease : release);
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
      loadStage = 'adapter_load';
      await script('capacity-adapters.js');
      loadStage = 'service_load';
      await script('capacity-service.js');
      loadStage = 'bridge_initialization';
      adapters = global.ReelCalcCapacityAdapters.create(global.ReelCalcCapacityService.production);
      return await global.ReelCalcCapacityService.production.ready();
    } catch (_) { bridgeFailure = loadStage || 'configuration_load'; return false; }
  })();
  function resolve(surface, input) {
    if (!enabled()) return null;
    var capacityOnly = surface === 'wizard' ? input.backingMode === 'none'
      : surface === 'reel_page' ? input.mode === 'capacity'
      : surface === 'comparison' ? input.backingEnabled === false : input.capacityOnly === true;
    if (!capacityOnly || !input.reel || input.manual || input.useManualReel || input.reel.manualRating || input.reel.manual_reel_entry_mode) return null;
    var result;
    try { result = adapters ? adapters[surface].fromSurface(input) : unavailable; }
    catch (error) {
      send('reelcalc_capacity_failure', {surface:surface, failure_code:'resolver_runtime', engine_status:'failed',
        calculation_origin:action?.origin || 'automatic', capacity_action_id:action?.id || String(++sequence), monitoring_version:monitoringRelease});
      throw error;
    }
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
      selected_line_diameter:result.selected_diameter_mm, verified_anchor_count:result.anchors_used?.length || 0,
      range_state:result.range_state || '', review_state:!!result.review_required,
      source_tier:/_exact|_interpolation/.test(result.route) ? 'manufacturer' : result.route === 'STOP' ? 'none' : 'compatibility',
      fallback_used:result.state === 'compatibility_estimate'};
  }
  // Reuse the site's existing transport/consent path. Monitoring must never block rendering.
  function send(name, parameters) {
    try {
      if (global.ReelCalcAnalytics?.track) global.ReelCalcAnalytics.track(name, parameters);
      else {
        var queue = global.ReelCalcAnalyticsQueue = global.ReelCalcAnalyticsQueue || [];
        if (queue.length < 100) queue.push({name:name, parameters:parameters, options:{}});
      }
    } catch (_) {}
  }
  var action = null, autoAction = null, sequence = 0, observed = new WeakSet(), seenEvents = new WeakSet();
  var lastInput = new WeakMap(), automatic = new Map();
  function observe(root) {
    if (!root || observed.has(root)) return;
    observed.add(root);
    ['click','input','change','keydown'].forEach(function(type) {
      root.addEventListener(type, function(event) {
        if (!enabled() || !event.isTrusted || seenEvents.has(event)) return;
        if (type === 'keydown' && !['Enter','ArrowUp','ArrowDown'].includes(event.key)) return;
        var target = event.composedPath ? event.composedPath()[0] : event.target;
        if (!target?.matches?.('button,input,select,[role="option"]') && !target?.closest?.('button,[role="option"]')) return;
        seenEvents.add(event);
        var previous = lastInput.get(target);
        // Browsers fire change after input for the same value; that is one edit.
        action = type === 'change' && previous?.type === 'input' && previous.value === target.value
          ? previous.action : {id:String(++sequence), origin:'user', source:type, batches:new Map()};
        lastInput.set(target, {type:type, value:target.value, action:action});
        var current = action;
        setTimeout(function() { if (action === current) action = null; }, 0);
      }, true);
    });
  }
  observe(document);
  function record(surface, result, line, options) {
    try {
      if (!enabled() || !result || !['wizard','reel_page','line_page','comparison'].includes(surface)) return;
      var status = bridgeFailure ? {status:'failed',code:bridgeFailure}
        : global.ReelCalcCapacityService?.production?.diagnostics?.() || {status:'loading',code:'not_ready'};
      var detail = Object.assign({surface:surface}, analytics(result,line), {
        numeric_available:result.numeric_available === true && Number.isFinite(result.capacity_yards),
        engine_status:status.status, failure_code:status.code,
        monitoring_version:monitoringRelease
      });
      var signature = JSON.stringify(detail), key = surface + '|' + detail.reel_id + '|' + detail.line_id;
      if (!action && automatic.get(key) === signature) return;
      automatic.set(key, signature);
      if (!action && !autoAction) {
        autoAction = {id:String(++sequence),origin:'automatic',source:'automatic',batches:new Map()};
        setTimeout(function() { autoAction = null; },0);
      }
      var current = action || autoAction;
      // One batch per action/surface, including both comparison reels and repeated renders.
      var batch = current.batches.get(surface);
      if (!batch) {
        batch = {rows:new Map(), flushed:false};
        current.batches.set(surface,batch);
        setTimeout(function() { flushBatch(current,surface,batch); },0);
      }
      if (batch.flushed) return;
      batch.rows.set(detail.reel_id+'|'+detail.line_id, {detail:detail, onNumericComplete:options?.onNumericComplete});
    } catch (_) {}
  }
  function flushBatch(current,surface,batch) {
    if (!enabled()) return;
    batch.flushed = true;
    var numeric = 0, holds = 0, unavailableCount = 0, failures = 0;
    batch.rows.forEach(function(row) {
      var detail = Object.assign({},row.detail,{calculation_origin:current.origin, interaction_source:current.source, capacity_action_id:current.id});
      var valid = detail.engine_status === 'ready';
      if (!valid) failures++;
      else if (detail.numeric_available) numeric++;
      else if (detail.capacity_state === 'hold_review') holds++;
      else unavailableCount++;
      send(valid?'reelcalc_capacity_decision':'reelcalc_capacity_failure',detail);
      try { document.dispatchEvent(new CustomEvent('reelcalc:capacity-only-result',{detail:detail})); } catch (_) {}
      if (valid && detail.numeric_available && current.origin === 'user' && surface === 'reel_page') {
        try { row.onNumericComplete?.(); } catch (_) {}
      }
    });
    var summary = {surface:surface, calculation_origin:current.origin, interaction_source:current.source,
      capacity_action_id:current.id, result_count:batch.rows.size, numeric_result_count:numeric,
      hold_result_count:holds, unavailable_result_count:unavailableCount, failure_count:failures,
      monitoring_version:monitoringRelease, calculator_mode:'capacity'};
    send('reelcalc_capacity_interaction',summary);
    if (numeric && current.origin === 'user' && surface !== 'reel_page') {
      var name = {wizard:'wizard_calculation_completed',line_page:'line_page_setup_calculated',comparison:'reel_comparison_capacity_completed'}[surface];
      var first = batch.rows.values().next().value.detail;
      send(name,Object.assign({},summary,surface==='comparison'?{}:{reel_id:first.reel_id,line_id:first.line_id,
        capacity_state:first.capacity_state,capacity_route:first.capacity_route,numeric_available:true}));
    }
  }
  function assessment(result, yards) {
    return global.ReelCalcCapacityAdapters ? global.ReelCalcCapacityAdapters.assessment(result, yards) : null;
  }
  global.ReelCalcCapacityPages = Object.freeze({ready:ready, enabled:enabled, resolve:resolve,
    present:present, html:html, analytics:analytics, record:record, observe:observe, assessment:assessment});
})(window);
