(function(global) {
  "use strict";
  var mounts = new WeakMap();
  function mount(root) {
    if (mounts.has(root)) return mounts.get(root);
    var ready = initialize(root);
    mounts.set(root, ready);
    return ready;
  }
  async function initialize(root) {
    var loading = root.querySelector("#rcLoading");
    var status = root.querySelector("#rcToolStatus");
    var strength = root.querySelector("#rcStrength");
    var spool = root.querySelector("#rcSpool");
    var selected = root.querySelector("#rcSelectedLine");
    var offerBox = root.querySelector("#rcLeaderOffer");
    var base = new URL(root.dataset.assetBase || "./", document.baseURI);
    async function read(file) {
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 20000);
      var url = new URL(file, base);
      url.searchParams.set("t", Date.now());
      try {
        var response = await fetch(url.href, { credentials: "omit", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Leader data unavailable");
        return await response.json();
      } finally { clearTimeout(timeout); }
    }
    try {
      var payload = await Promise.all([read("data/line-page-products.json"), read("data/lines.json"), read("data/reel-affiliates.json").catch(function() { return null; })]);
      var product = payload[0].products[root.dataset.productId];
      if (!product || product.role !== "leader") throw new Error("Invalid leader product");
      var records = payload[1].filter(function(line) {
        return line.brand === product.brand && line.model === product.model && line.type === product.lineType &&
          !(product.excludedLineIds || []).includes(line.id) && line.role === "leader" && line.dia_in > 0 && line.dia_mm > 0 && line.spool_sizes_yd.length;
      }).sort(function(a, b) { return a.lb - b.lb; });
      if (!records.length) throw new Error("Missing leader strengths");
      var params = new URL(global.location.href).searchParams;
      var line = records.find(function(item) { return item.id === params.get("line"); }) ||
        records.find(function(item) { return item.lb === Number(params.get("lb")); }) ||
        records.find(function(item) { return item.id === product.defaultLineId; }) || records[0];
      function options(element, entries) {
        element.replaceChildren();
        entries.forEach(function(entry) { var option = document.createElement("option"); option.value = entry.value; option.textContent = entry.label; element.appendChild(option); });
      }
      function track(event, extra) {
        try { if (global.ReelCalcAnalytics) global.ReelCalcAnalytics.track(event, Object.assign({ product_id: root.dataset.productId, line_id: line.id, line_brand: line.brand, line_model: line.model, line_lb: line.lb, line_role: "leader", spool_yards: Number(spool.value) }, extra)); } catch (_) {}
      }
      function renderOffer() {
        offerBox.replaceChildren();
        var offer = global.ReelCalcAffiliateLinks && global.ReelCalcAffiliateLinks.buildRecommendedLineOffer({ affiliateData: payload[2], line: line, spoolYards: Number(spool.value) });
        if (offer) {
          var link = document.createElement("a");
          link.className = "rc-inline-link";
          link.href = offer.url;
          link.target = "_blank";
          link.rel = "sponsored noopener noreferrer";
          link.textContent = "Check " + line.brand + " " + line.model + " " + line.lb + " lb on " + offer.retailerName;
          link.addEventListener("click", function() { track("line_page_affiliate_click", { retailer: offer.retailerId, destination: offer.url }); });
          offerBox.appendChild(link);
        }
      }
      function render() {
        strength.value = line.id;
        var oldSpool = Number(spool.value);
        options(spool, line.spool_sizes_yd.map(function(yards) {
          var pack = (line.retail_packages || []).find(function(p) { return p.yards === yards; });
          return { value: yards, label: pack ? pack.meters + " m (about " + yards + " yd)" : yards + " yd package" };
        }));
        spool.value = String(line.spool_sizes_yd.includes(oldSpool) ? oldSpool : line.spool_sizes_yd.includes(product.defaultSpoolYards) ? product.defaultSpoolYards : line.spool_sizes_yd[0]);
        selected.textContent = line.brand + " " + line.model + " " + line.lb + " lb: " + line.dia_mm + " mm / " + Number(line.dia_in.toFixed(6)) + " in";
        root.querySelectorAll("[data-select-line]").forEach(function(button) { button.disabled = false; button.setAttribute("aria-pressed", String(button.dataset.selectLine === line.id)); });
        renderOffer();
      }
      options(strength, records.map(function(item) { return { value: item.id, label: item.lb + " lb" }; }));
      render();
      strength.addEventListener("change", function() { line = records.find(function(item) { return item.id === strength.value; }); render(); track("line_page_strength_selected"); });
      spool.addEventListener("change", function() { renderOffer(); track("line_page_spool_selected"); });
      root.addEventListener("click", function(event) {
        var button = event.target.closest("[data-select-line]");
        if (!button) return;
        var next = records.find(function(item) { return item.id === button.dataset.selectLine; });
        if (!next) return;
        line = next; render(); track("line_page_strength_selected");
        root.querySelector("#choose-leader").scrollIntoView({ block: "start" }); strength.focus({ preventScroll: true });
      });
      root.querySelector("#rcLeaderWizard").addEventListener("click", function() { track("line_page_wizard_click", { preload_mainline: false }); });
      loading.hidden = true; root.querySelector("#rcInteractive").hidden = false; status.textContent = "Leader data ready"; root.dataset.linePageReady = "true";
      track("line_page_view");
      return true;
    } catch (error) {
      mounts.delete(root);
      loading.textContent = "Leader selection is unavailable. The diameter chart and guide remain available below.";
      status.textContent = "Static guide available";
      var retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Retry loading leader data";
      retry.addEventListener("click", function() { mount(root); }, { once: true }); loading.appendChild(retry);
      return false;
    }
  }
  global.ReelCalcLeaderPages = { mount: mount };
  function start() { document.querySelectorAll('[data-reelcalc-line-page][data-line-role="leader"]').forEach(mount); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})(window);
