(function(global) {
  "use strict";
  if (global.ReelCalcLineGuides) return;
  var script = typeof document !== "undefined" && document.currentScript;
  var base = script && script.src ? new URL("../", script.src).href : "";
  var pending;
  var slots = new WeakMap();

  function key(value) { return String(value || "").trim().toLowerCase(); }
  function sameSpec(line, row) {
    return ["brand", "model", "type"].every(function(field) { return key(line[field]) === key(row[field]); }) &&
      Number(line.lb) === Number(row.lb) && Number(line.dia_in).toFixed(4) === Number(row.dia_in).toFixed(4) &&
      (!line.dia_mm || Number(line.dia_mm).toFixed(3) === Number(row.dia_mm).toFixed(3));
  }
  function resolve(line, data, context) {
    if (!line || line.custom_line || line.manual || /reference/i.test(line.notes || "") || !data) return null;
    var id = line.id;
    var row = id && data.lines[id];
    // Never redirect an unknown ID to a lookalike, or replace an excluded regional specification.
    if (id && (!row || !sameSpec(line, row))) return null;
    if (!id) {
      var matches = Object.keys(data.lines).filter(function(candidate) { return sameSpec(line, data.lines[candidate]); });
      if (matches.length !== 1) return null;
      id = matches[0]; row = data.lines[id];
    }
    var guide = data.guides[row.guide];
    if (!guide) return null;
    var url;
    try { url = new URL(guide.url); } catch (_) { return null; }
    if (url.origin !== "https://www.reelcalc.com" || !url.pathname.startsWith("/lines/p/")) return null;
    url.searchParams.set("line", id);
    url.searchParams.set("lb", String(row.lb));
    if (context && context.reel && !/^manual|^custom/i.test(context.reel)) url.searchParams.set("reel", context.reel);
    url.hash = "diameter-chart";
    return { url: url.href, lineId: id, productId: row.guide, title: guide.title, lb: row.lb };
  }
  function catalog() {
    if (!pending) pending = fetch(new URL("data/line-guide-links.json", base).href, { credentials: "omit", cache: "no-cache" })
      .then(function(response) { if (!response.ok) throw new Error("Guide links unavailable"); return response.json(); })
      .then(function(data) { return data && data.lines && data.guides ? data : null; })
      .catch(function() { return null; });
    return pending;
  }
  function showAfter(element, line, context) {
    if (!element) return Promise.resolve(null);
    var slot = slots.get(element);
    if (!slot) {
      var anchor = document.createElement("a");
      anchor.dataset.reelcalcLineGuide = "true";
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.style.cssText = "display:block;grid-column:1/-1;width:fit-content;max-width:100%;margin:6px 0;position:static;white-space:normal;overflow-wrap:anywhere;font:600 13px/1.5 Arial,sans-serif;letter-spacing:0;color:#215e86;text-decoration:underline;text-underline-offset:3px;";
      slot = { anchor: anchor, revision: 0, selection: null, context: {} };
      slots.set(element, slot);
      anchor.addEventListener("click", function() {
        if (!slot.selection) return;
        var params = { line_id: slot.selection.lineId, line_lb: slot.selection.lb, line_product_id: slot.selection.productId,
          page_type: slot.context.source || "", line_role: slot.context.role || "main", destination_url: anchor.href, transport_type: "beacon" };
        if (global.ReelCalcAnalytics && global.ReelCalcAnalytics.track) global.ReelCalcAnalytics.track("line_guide_click", params);
        else (global.ReelCalcAnalyticsQueue = global.ReelCalcAnalyticsQueue || []).push({ name: "line_guide_click", parameters: params });
      });
    }
    var revision = ++slot.revision;
    slot.selection = null;
    slot.context = context || {};
    slot.anchor.hidden = true;
    slot.anchor.style.display = "none";
    slot.anchor.removeAttribute("href");
    element.after(slot.anchor);
    if (!line) return Promise.resolve(null);
    return catalog().then(function(data) {
      if (slot.revision !== revision || !element.isConnected) return null;
      var match = resolve(line, data, context);
      if (!match) return null;
      slot.selection = match;
      slot.anchor.href = match.url;
      slot.anchor.textContent = "View " + match.title + " guide (" + match.lb + " lb)";
      slot.anchor.setAttribute("aria-label", slot.anchor.textContent + ", opens in a new tab");
      slot.anchor.hidden = false;
      slot.anchor.style.display = "block";
      return match;
    });
  }
  global.ReelCalcLineGuides = { resolve: resolve, showAfter: showAfter };
  if (typeof document !== "undefined") document.dispatchEvent(new Event("reelcalc:line-guides-ready"));
})(window);
