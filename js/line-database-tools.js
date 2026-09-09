(function(global) {
  "use strict";
  if (global.ReelCalcLineTools) return;

  var VERSION = "1";
  var PE_SIZES = [0.4, 0.5, 0.6, 0.8, 1, 1.2, 1.5, 1.7, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12];
  var script = typeof document !== "undefined" ? document.currentScript : null;
  var assetBase = script && script.dataset.assetBase
    ? new URL(script.dataset.assetBase, document.baseURI).href
    : script && script.src ? new URL("../", script.src).href : "";
  var destinations = {
    homepage: script && script.dataset.homepageUrl || "https://www.reelcalc.com/",
    wizard: script && script.dataset.wizardUrl || "https://www.reelcalc.com/reelcalc-wizard",
    pe: script && script.dataset.peCalculatorUrl || "https://www.reelcalc.com/pe-line-capacity-calculator"
  };
  var lineDataPromise;
  var handoffApplied = false;

  function clean(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit || 200);
  }
  function key(value) { return clean(value).toLowerCase(); }
  function positive(value) {
    if (value == null || clean(value) === "") return null;
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }
  function format(value, places) {
    return Number(value).toFixed(places).replace(/0+$/, "").replace(/\.$/, "");
  }
  function nameOf(line) { return clean(line.brand + " " + line.model); }
  function labelOf(line) { return nameOf(line) + (line.lb ? " " + line.lb + " lb" : ""); }
  function material(type) {
    return /braid/i.test(type) ? "braid" : /fluoro/i.test(type) ? "fluoro" : /mono|copolymer/i.test(type) ? "mono" : null;
  }
  function optionLabel(line, isPE) {
    return nameOf(line) + (isPE
      ? " - PE " + line.pe + (line.lb ? " / " + line.lb + " lb" : "") + " / " + format(line.dia_mm, 3) + " mm"
      : " - " + line.lb + " lb (" + format(line.dia_in, 4) + " in)");
  }
  function rowRecord(cells, isPE) {
    if (cells.length !== (isPE ? 9 : 6)) return null;
    var record = {
      brand: clean(cells[0]), model: clean(cells[1]), type: isPE ? "Braid" : clean(cells[2]),
      lb: positive(cells[3]), pe: isPE ? positive(cells[2]) : null,
      dia_in: positive(cells[isPE ? 7 : 4]), dia_mm: positive(cells[isPE ? 6 : 5]),
      notes: isPE ? clean(cells[8], 400) : ""
    };
    return record.brand && record.model && material(record.type) && record.dia_in && record.dia_mm &&
      (isPE ? record.pe : record.lb) ? record : null;
  }
  function matchCatalogLine(line, catalog) {
    if (!line || !line.lb || /reference/i.test(line.notes)) return null;
    var matches = catalog.filter(function(item) {
      return key(item.brand) === key(line.brand) && key(item.model) === key(line.model) &&
        key(item.type) === key(line.type) && Number(item.lb) === line.lb &&
        // Match both displayed diameters; never swap in a different product specification.
        format(item.dia_in, 4) === format(line.dia_in, 4) &&
        format(item.dia_mm, 3) === format(line.dia_mm, 3);
    });
    return matches.length === 1 ? matches[0] : null;
  }
  function calculatorParams(line, isPE) {
    return {
      rcSource: isPE ? "pe_line_database" : "line_database",
      rcLineName: nameOf(line), rcLineType: material(line.type),
      rcDiameter: String(isPE ? line.dia_mm : line.dia_in), rcDiameterUnit: isPE ? "mm" : "in",
      rcLineLb: line.lb ? String(line.lb) : "", rcPe: isPE ? String(line.pe) : "",
      rcLineNote: isPE ? line.notes : ""
    };
  }
  function buildDestination(line, isPE, tool, catalogLine, urls) {
    var routes = urls || destinations;
    if (tool === "wizard") {
      if (!catalogLine || !catalogLine.id) return null;
      var wizard = new URL(routes.wizard);
      wizard.searchParams.set("line", catalogLine.id);
      wizard.searchParams.set("lb", String(catalogLine.lb));
      wizard.searchParams.set("source", isPE ? "pe_line_database" : "line_database");
      return wizard.href;
    }
    var usePE = isPE && PE_SIZES.includes(Number(line.pe));
    var url = new URL(usePE ? routes.pe : routes.homepage);
    var params = calculatorParams(line, isPE);
    Object.keys(params).forEach(function(name) { if (params[name]) url.searchParams.set(name, params[name]); });
    url.hash = usePE ? "reelcalc-pe-calculator" : "reelcalc-homepage-calculator";
    return url.href;
  }
  function readSelectionParams(search) {
    var params = new URLSearchParams(search);
    var source = params.get("rcSource");
    if (!["line_database", "pe_line_database"].includes(source)) return null;
    var type = params.get("rcLineType");
    var unit = params.get("rcDiameterUnit");
    var diameter = positive(params.get("rcDiameter"));
    var name = clean(params.get("rcLineName"));
    if (!["braid", "mono", "fluoro"].includes(type) || !["in", "mm"].includes(unit) || !name || !diameter) return null;
    var diameterIn = unit === "mm" ? diameter / 25.4 : diameter;
    if (diameterIn < 0.0001 || diameterIn > 0.2) return null;
    var pe = positive(params.get("rcPe"));
    var lb = positive(params.get("rcLineLb"));
    if ((pe && pe > 100) || (lb && lb > 2000) || (source === "pe_line_database" && (!pe || type !== "braid"))) return null;
    return { source: source, name: name, type: type, unit: unit, diameter: diameter, diameterIn: diameterIn,
      pe: pe, lb: lb, note: clean(params.get("rcLineNote"), 400) };
  }
  function track(event, line, isPE, extra) {
    var params = Object.assign({ page_type: isPE ? "pe_line_database" : "line_database",
      source_database: isPE ? "pe" : "regular", line_brand: line.brand, line_model: line.model,
      line_type: line.type, line_lb: line.lb, line_diameter_mm: line.dia_mm,
      pe_size: line.pe, line_role: "main" }, extra || {});
    if (global.ReelCalcAnalytics && typeof global.ReelCalcAnalytics.track === "function") {
      global.ReelCalcAnalytics.track(event, params);
    } else {
      global.ReelCalcAnalyticsQueue = global.ReelCalcAnalyticsQueue || [];
      global.ReelCalcAnalyticsQueue.push({ name: event, parameters: params });
    }
  }
  function stylesheet() {
    if (!assetBase || document.querySelector("link[data-reelcalc-line-tools]")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("css/line-database-tools.css?v=" + VERSION, assetBase).href;
    link.dataset.reelcalcLineTools = "true";
    document.head.appendChild(link);
  }
  function catalog() {
    if (!lineDataPromise) lineDataPromise = fetch(new URL("data/lines.json", assetBase).href, { credentials: "omit" })
      .then(function(response) { if (!response.ok) throw new Error("Line catalog unavailable"); return response.json(); })
      .then(function(data) { if (!Array.isArray(data)) throw new Error("Invalid line catalog"); return data; })
      .catch(function() { return []; });
    return lineDataPromise;
  }

  function mountDatabase(root, isPE) {
    if (root.dataset.reelcalcLineTools === "true") return;
    var select = root.querySelector(isPE ? "#peLineSelect" : "#lineSelect");
    var controls = root.querySelector(".rcdb-finder-controls");
    var matches = root.querySelector(isPE ? "#peMatchResults" : "#matchResults");
    var find = root.querySelector(isPE ? "#peFindMatchesButton" : "#findMatchesButton");
    if (!select || !controls) return;
    root.dataset.reelcalcLineTools = "true";
    var records = new Map();
    var catalogLines = [];
    var current = null;
    var currentCatalogLine = null;
    var panel = document.createElement("section");
    panel.className = "rc-line-actions";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Selected line actions");
    panel.innerHTML = '<p class="rc-line-eyebrow">Selected main line</p><strong class="rc-line-name"></strong>' +
      '<p class="rc-line-specs"></p><p class="rc-line-note" hidden></p><div class="rc-line-buttons">' +
      '<a data-line-destination="wizard" hidden>Use in Setup Wizard</a>' +
      '<a data-line-destination="calculator">Use in Calculator</a>' +
      '<button type="button" class="rc-line-clear">Clear selection</button></div>';
    controls.after(panel);
    var wizard = panel.querySelector('[data-line-destination="wizard"]');
    var calculator = panel.querySelector('[data-line-destination="calculator"]');
    var note = panel.querySelector(".rc-line-note");
    var status = document.createElement("span");
    status.className = "rc-line-sr-status";
    status.setAttribute("role", "status");
    panel.appendChild(status);

    function selectedLabel() {
      return select.value === "" ? "" : key(select.options[select.selectedIndex].textContent);
    }
    function highlight() {
      root.querySelectorAll("tr[data-rc-line-label]").forEach(function(row) {
        row.classList.toggle("rc-line-selected-row", row.dataset.rcLineLabel === selectedLabel());
      });
    }
    function render() {
      current = records.get(selectedLabel()) || null;
      panel.hidden = !current;
      highlight();
      if (!current) return;
      currentCatalogLine = matchCatalogLine(current, catalogLines);
      panel.querySelector(".rc-line-name").textContent = labelOf(current);
      panel.querySelector(".rc-line-specs").textContent = (isPE ? "PE " + current.pe + " / " : "") +
        current.type + " / " + format(current.dia_mm, 3) + " mm / " + format(current.dia_in, 4) + " in";
      note.textContent = current.notes;
      note.hidden = !current.notes;
      wizard.hidden = !currentCatalogLine;
      if (currentCatalogLine) wizard.href = buildDestination(current, isPE, "wizard", currentCatalogLine);
      else wizard.removeAttribute("href");
      calculator.href = buildDestination(current, isPE, "calculator");
      calculator.textContent = isPE && PE_SIZES.includes(current.pe) ? "Use in PE Calculator" : "Use in Calculator";
      calculator.classList.toggle("rc-line-secondary", Boolean(currentCatalogLine));
      status.textContent = "Selected " + labelOf(current);
    }
    function captureRows() {
      root.querySelectorAll("tbody tr.rcdb-data-row").forEach(function(row) {
        var record = rowRecord(Array.from(row.cells).map(function(cell) { return cell.textContent; }), isPE);
        if (!record) return;
        var label = key(optionLabel(record, isPE));
        records.set(label, record);
        if (row.dataset.rcLineLabel === label) return;
        row.dataset.rcLineLabel = label;
        var pick = document.createElement("button");
        pick.type = "button";
        pick.className = "rc-line-pick";
        pick.textContent = record.model;
        pick.title = "Select this line";
        pick.setAttribute("aria-label", "Select " + labelOf(record) + (isPE ? " PE " + record.pe : ""));
        pick.addEventListener("click", function() {
          var option = Array.from(select.options).find(function(item) { return key(item.textContent) === label; });
          if (!option) return;
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          panel.scrollIntoView({ behavior: "smooth", block: "center" });
          (wizard.hidden ? calculator : wizard).focus({ preventScroll: true });
        });
        row.cells[1].replaceChildren(pick);
      });
      render();
    }
    select.addEventListener("change", function() {
      if (!selectedLabel()) { if (matches) matches.hidden = true; render(); return; }
      // Find Matches supplies a full selected row even if the main table was already filtered.
      if (find && (!records.has(selectedLabel()) || (matches && !matches.hidden))) find.click();
      captureRows();
      if (current) track("line_database_line_selected", current, isPE, { line_id: currentCatalogLine && currentCatalogLine.id });
    });
    panel.querySelector(".rc-line-clear").addEventListener("click", function() {
      select.value = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.focus();
    });
    panel.querySelectorAll("a[data-line-destination]").forEach(function(anchor) {
      anchor.addEventListener("click", function() {
        if (!current) return;
        var tool = anchor.dataset.lineDestination === "wizard" ? "wizard" : isPE && PE_SIZES.includes(current.pe) ? "pe_calculator" : "homepage_calculator";
        track(anchor.dataset.lineDestination === "wizard" ? "line_database_use_wizard" : "line_database_use_calculator",
          current, isPE, { line_id: currentCatalogLine && currentCatalogLine.id, destination_tool: tool, transport_type: "beacon" });
      });
    });
    var observer = new MutationObserver(captureRows);
    root.querySelectorAll("tbody").forEach(function(body) { observer.observe(body, { childList: true }); });
    captureRows();
    catalog().then(function(data) { catalogLines = data; render(); });
  }

  function loadedSummary(group, selection, usesPE) {
    var summary = document.createElement("div");
    summary.className = "rc-line-loaded";
    var name = document.createElement("strong");
    name.textContent = selection.name + (selection.lb ? " " + selection.lb + " lb" : "");
    var detail = document.createElement("span");
    detail.textContent = usesPE ? "PE " + selection.pe + ". Capacity uses an estimated PE diameter."
      : (selection.note ? selection.note + " " : "") + "Diameter: " + selection.diameter + " " + selection.unit + ".";
    summary.append(name, detail);
    if (usesPE) {
      var link = document.createElement("a");
      var url = new URL(destinations.homepage);
      var incoming = new URLSearchParams(global.location.search);
      ["rcSource", "rcLineName", "rcLineType", "rcDiameter", "rcDiameterUnit", "rcLineLb", "rcPe", "rcLineNote"].forEach(function(param) {
        if (incoming.has(param)) url.searchParams.set(param, incoming.get(param));
      });
      url.hash = "reelcalc-homepage-calculator";
      link.href = url.href;
      link.textContent = "Use this line's diameter in the main calculator";
      summary.appendChild(link);
    }
    (group.querySelector(".step-heading") || group.querySelector("h3")).after(summary);
    return summary;
  }
  function dispatchInput(input) { input.dispatchEvent(new Event("input", { bubbles: true })); }
  function applyHomepage(selection) {
    var root = document.getElementById("reelcalc-homepage-calculator");
    if (!root || root.dataset.reelcalcInitialized !== "true") return false;
    var diameter = root.querySelector("#mainDiameter");
    if (!diameter || diameter.value !== "") return true;
    var unit = selection.unit === "mm" ? "metric" : "standard";
    root.querySelector('[data-unit="' + unit + '"]').click();
    root.querySelector('#workingTypeSegment [data-line-type="' + (selection.type === "braid" ? "braid" : "mono") + '"]').click();
    diameter.value = String(selection.diameter);
    dispatchInput(diameter);
    var group = diameter.closest(".calc-group");
    var summary = loadedSummary(group, selection, false);
    diameter.addEventListener("input", function() { summary.remove(); });
    root.querySelector("#workingTypeSegment").addEventListener("click", function() { summary.remove(); });
    root.dataset.reelcalcLinePreloaded = "true";
    if (global.location.hash === "#reelcalc-homepage-calculator") root.scrollIntoView({ block: "start" });
    return true;
  }
  function applyPE(selection) {
    var working = document.getElementById("workingPe");
    if (!working || selection.source !== "pe_line_database") return false;
    var option = Array.from(working.options).find(function(item) { return Number(item.value) === selection.pe; });
    if (!option) return true;
    var root = working.closest(".calculator-container");
    if (!root) return true;
    root.id = root.id || "reelcalc-pe-calculator";
    working.value = option.value;
    var reel = root.querySelector("#reelPe");
    if (reel) {
      if (!Array.from(reel.options).some(function(item) { return item.value === ""; })) {
        var blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "Choose your reel's PE rating";
        reel.prepend(blank);
      }
      reel.value = "";
    }
    ["reelLength", "workingLength", "backingDia", "reelIPT"].forEach(function(id) {
      var input = root.querySelector("#" + id);
      if (input) { input.value = ""; dispatchInput(input); }
    });
    working.dispatchEvent(new Event("change", { bubbles: true }));
    var output = root.querySelector("#output");
    if (output) output.textContent = "";
    var summary = loadedSummary(working.closest(".calc-group"), selection, true);
    working.addEventListener("change", function() { summary.remove(); });
    root.dataset.reelcalcLinePreloaded = "true";
    if (global.location.hash === "#reelcalc-pe-calculator") root.scrollIntoView({ block: "start" });
    return true;
  }
  function initialize() {
    stylesheet();
    var regular = document.getElementById("reelcalc-line-database");
    var pe = document.getElementById("reelcalc-pe-line-database");
    if (regular) mountDatabase(regular, false);
    if (pe) mountDatabase(pe, true);
    if (handoffApplied) return;
    var selection = readSelectionParams(global.location.search);
    if (selection) handoffApplied = applyHomepage(selection) || applyPE(selection);
  }

  global.ReelCalcLineTools = { initialize: initialize, rowRecord: rowRecord, optionLabel: optionLabel,
    matchCatalogLine: matchCatalogLine, buildDestination: buildDestination, readSelectionParams: readSelectionParams };
  if (typeof document !== "undefined") {
    document.addEventListener("reelcalc:homepage-calculator-ready", initialize);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
    else initialize();
  }
})(window);
