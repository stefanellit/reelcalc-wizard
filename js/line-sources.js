(function(global) {
  "use strict";
  var SOURCE = "line_laboratory";
  var PREFIX = "line-laboratory:";
  var HOME_URL = "https://linelaboratory.com/";
  var MATERIALS = ["Monofilament", "Fluorocarbon", "Copolymer", "Braid"];
  var requests = new Map();
  var capturedScript = typeof document !== "undefined" ? document.currentScript : null;
  var defaultBase = capturedScript && capturedScript.src ? new URL("../", capturedScript.src).href : "./";

  function required(value, field) {
    if (typeof value !== "string" || !value.trim() || value.length > 1000 || /[\u0000-\u001f]/.test(value)) throw new Error("Invalid " + field);
    return value;
  }
  function positive(value, max, field) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > max) throw new Error("Invalid " + field);
    return value;
  }
  function onlyKeys(value, keys) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(function(key) { return !keys.includes(key); })) throw new Error("Unexpected measurement field");
  }
  function safeUrl(value) {
    if (!value) return "";
    var url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Source URL must be public HTTPS without credentials");
    return url.href;
  }
  function validDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value) &&
      Number.isFinite(Date.parse(value)) && new Date(value).toISOString().replace(".000Z", "Z") === value.replace(".000Z", "Z");
  }
  function identity(record) {
    return JSON.stringify([record.brand, record.product, record.variant, record.material,
      record.rated_strength.value, record.rated_strength.unit, record.rated_strength.label]);
  }
  function validateRecord(record, approvedMethods) {
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Invalid laboratory record");
    ["source_record_id", "original_name", "brand", "product", "variant", "updated_at"].forEach(function(field) { required(record[field], field); });
    if (!/^[A-Za-z0-9._:-]{1,160}$/.test(record.source_record_id)) throw new Error("Invalid stable source_record_id");
    if (!MATERIALS.includes(record.material)) throw new Error("Unsupported material");
    if (!["active", "retired"].includes(record.status)) throw new Error("Invalid status");
    if (!validDate(record.updated_at)) throw new Error("Invalid updated_at; use an ISO UTC timestamp");
    if (record.tested_at && !validDate(record.tested_at)) throw new Error("Invalid tested_at; use an ISO UTC timestamp");
    if (record.quoted_diameter != null) {
      onlyKeys(record.quoted_diameter, ["value", "unit"]);
      if (!["mm", "in"].includes(record.quoted_diameter.unit)) throw new Error("Invalid quoted diameter unit");
      positive(record.quoted_diameter.value, 5, "quoted diameter");
    }
    var strength = record.rated_strength;
    onlyKeys(strength, ["value", "unit", "label"]);
    if (!strength || !["lb", "kg"].includes(strength.unit)) throw new Error("Rated strength needs lb or kg units; tested strength is not a substitute");
    positive(strength.value, strength.unit === "kg" ? 907 : 2000, "rated strength");
    required(strength.label, "original rated-strength label");
    if (record.tested_breaking_strength != null) {
      var tested = record.tested_breaking_strength;
      onlyKeys(tested, ["value", "unit"]);
      if (!["lb", "kg"].includes(tested.unit)) throw new Error("Invalid tested breaking-strength unit");
      positive(tested.value, 10000, "tested breaking strength");
    }
    if (!Array.isArray(record.diameters) || !record.diameters.length) throw new Error("Missing measured diameters");
    var methods = new Set();
    record.diameters.forEach(function(measurement) {
      onlyKeys(measurement, ["method_id", "value", "unit"]);
      required(measurement.method_id, "method_id");
      if (methods.has(measurement.method_id)) throw new Error("Duplicate measurement method");
      methods.add(measurement.method_id);
      if (!["mm", "in"].includes(measurement.unit)) throw new Error("Diameter must use mm or in units");
      positive(measurement.value, 5, "diameter");
      var mm = measurement.unit === "mm" ? measurement.value : measurement.value * 25.4;
      if (mm < 0.00254 || mm > 5.08) throw new Error("Diameter outside supported range");
    });
    required(record.capacity_method_id, "capacity_method_id");
    if (!methods.has(record.capacity_method_id)) throw new Error("Capacity method has no measurement");
    if (!Array.isArray(approvedMethods) || !approvedMethods.includes(record.capacity_method_id)) throw new Error("Capacity measurement method has not been approved");
    safeUrl(record.source_url);
    return record;
  }
  function toLine(record, approvedMethods) {
    validateRecord(record, approvedMethods);
    if (record.status !== "active") return null;
    var measured = record.diameters.find(function(item) { return item.method_id === record.capacity_method_id; });
    var mm = measured.unit === "mm" ? measured.value : measured.value * 25.4;
    return {
      id: PREFIX + record.source_record_id, diameter_source: SOURCE, source_record_id: record.source_record_id,
      original_name: record.original_name, brand: record.brand, model: record.product,
      variant: record.variant, type: record.material, material: record.material,
      lb: record.rated_strength.value * (record.rated_strength.unit === "kg" ? 2.2046226218 : 1),
      rated_strength: record.rated_strength, tested_breaking_strength: record.tested_breaking_strength || null,
      dia_mm: mm, dia_in: mm / 25.4, measurement_method: record.capacity_method_id,
      quoted_diameter: record.quoted_diameter || null,
      quoted_diameter_mm: record.quoted_diameter ? record.quoted_diameter.value * (record.quoted_diameter.unit === "in" ? 25.4 : 1) : null,
      source_url: safeUrl(record.source_url), source_scope_label: "Line Laboratory / " + record.variant,
      tested_at: record.tested_at || null, updated_at: record.updated_at
    };
  }
  function createCatalog(manufacturer, data, release, matches) {
    var manufacturerLines = Array.isArray(manufacturer) ? manufacturer : [];
    var lines = [], error = "", enabled = !!release && release.enabled === true;
    if (enabled) {
      try {
        if (!release || release.schemaVersion !== 1 || !data || data.schemaVersion !== 1 || data.source !== SOURCE || !Array.isArray(data.records)) throw new Error("Invalid laboratory catalog");
        var seen = new Set();
        data.records.forEach(function(record) {
          if (seen.has(record.source_record_id)) throw new Error("Duplicate laboratory record ID");
          seen.add(record.source_record_id);
          var line = toLine(record, release.approvedMethods);
          if (line) lines.push(line);
        });
      } catch (problem) { lines = []; error = problem.message; }
    }
    lines.sort(function(a, b) { return label(a).localeCompare(label(b), undefined, { numeric: true }); });
    var byId = new Map(lines.map(function(line) { return [line.id, line]; }));
    return {
      manufacturer: manufacturerLines, laboratory: lines, enabled: enabled, error: error,
      matches: matches && matches.schemaVersion === 1 && Array.isArray(matches.matches) ? matches.matches : [],
      selectionMode: release && release.selectionMode || "separate",
      available: enabled && !error && lines.length > 0,
      resolve: function(source, id) {
        if (source === SOURCE) return byId.get(id) || null;
        if (source !== "manufacturer" || String(id).startsWith(PREFIX)) return null;
        return manufacturerLines.find(function(line) { return line.id === id; }) || null;
      }
    };
  }
  function sourceOf(line) { return line && line.diameter_source === SOURCE ? SOURCE : "manufacturer"; }
  function label(line) {
    if (sourceOf(line) !== SOURCE) return [line.brand, line.model, line.lb + " lb"].join(" ");
    return line.original_name.trim() + " - " + line.rated_strength.label +
      (line.variant && line.variant !== "Not separately supplied" ? " - " + line.variant : "");
  }
  function selection(search, role) {
    var params = new URLSearchParams(search || "");
    var backing = role === "backing";
    var id = backing ? params.get("backingLine") : params.get("mainLine") || params.get("line");
    var source = params.get(backing ? "backingLineSource" : "lineSource") || (String(id || "").startsWith(PREFIX) ? SOURCE : "manufacturer");
    return { id: id || "", source: source, explicit: !!id || source !== "manufacturer" };
  }
  function buildLink(base, line, role) {
    var url = new URL(base);
    var backing = role === "backing";
    if (!backing) { url.searchParams.delete("mainLine"); url.searchParams.delete("lb"); }
    url.searchParams.set(backing ? "backingLine" : "line", line.id);
    url.searchParams.set(backing ? "backingLineSource" : "lineSource", sourceOf(line));
    return url.href;
  }
  function attribution(line) {
    if (sourceOf(line) !== SOURCE) return "";
    return "Diameter independently measured by Line Laboratory. Spool capacity is still an estimate.";
  }
  function renderDiameters(parent, line) {
    parent.replaceChildren();
    if (sourceOf(line) !== SOURCE) return;
    var list = document.createElement("dl");
    list.className = "rc-lab-diameters";
    list.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0;line-height:1.5";
    [["Label diameter", line.quoted_diameter_mm], ["Measured diameter", line.dia_mm]].forEach(function(item) {
      var group = document.createElement("div"), term = document.createElement("dt"), value = document.createElement("dd");
      term.textContent = item[0];
      value.style.cssText = "margin:2px 0 0;font-weight:700";
      value.textContent = item[1] == null ? "Not supplied" : Number(item[1].toFixed(6)) + " mm";
      group.append(term, value); list.appendChild(group);
    });
    var note = document.createElement("p");
    note.style.margin = "6px 0";
    note.textContent = "Using the measured " + Number(line.dia_mm.toFixed(6)) + " mm diameter in your calculation.";
    var detail = document.createElement("small");
    detail.textContent = "Label value as reported by Line Laboratory; measured value is its published average.";
    parent.appendChild(list);
    var quoted = line.quoted_diameter_mm, measured = line.dia_mm;
    if (Number.isFinite(quoted) && quoted > 0 && Number.isFinite(measured) && measured > 0) {
      var percent = (measured - quoted) / quoted * 100;
      var magnitude = Math.abs(percent);
      var difference = document.createElement("p");
      difference.className = "rc-lab-diameter-difference";
      difference.style.cssText = "margin:6px 0";
      var amount = magnitude < 0.1 ? "less than 0.1" : String(Number(magnitude.toFixed(1)));
      difference.textContent = magnitude < 1e-9 ? "Measured diameter matches the label." :
        "Measured diameter is " + amount + "% " + (percent > 0 ? "larger" : "smaller") + " than the label.";
      parent.appendChild(difference);
    }
    parent.append(note, detail);
  }
  function renderAttribution(parent, line) {
    parent.replaceChildren();
    if (sourceOf(line) !== SOURCE) return;
    var p = document.createElement("p");
    p.textContent = attribution(line);
    parent.appendChild(p);
    var a = document.createElement("a");
    a.href = HOME_URL; a.textContent = "Visit Line Laboratory";
    a.target = "_blank"; a.rel = "noopener"; parent.appendChild(a);
  }
  async function load(manufacturer, base) {
    var root = new URL(base || defaultBase, typeof document !== "undefined" ? document.baseURI : "https://www.reelcalc.com/");
    var key = root.href;
    if (!requests.has(key)) requests.set(key, (async function() {
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, 6000);
      try {
        async function json(path) {
          var url = new URL(path, root);
          if (url.origin !== root.origin) throw new Error("Laboratory data must be hosted with ReelCalc assets");
          var response = await fetch(url.href, { credentials: "omit", cache: "no-cache", signal: controller.signal });
          if (!response.ok) throw new Error("Laboratory data unavailable");
          return response.json();
        }
        var release = await json("data/line-laboratory-release.json");
        if (release.enabled !== true) return { release: release, data: null };
        var data = await json(release.dataPath);
        var matches = release.matchesPath ? await json(release.matchesPath).catch(function() { return null; }) : null;
        return { release: release, data: data, matches: matches };
      } catch (error) { return { release: { enabled: false }, data: null, error: "Laboratory data is unavailable. Manufacturer selections remain available." }; }
      finally { clearTimeout(timer); }
    })());
    var payload = await requests.get(key);
    var catalog = createCatalog(manufacturer, payload.data, payload.release, payload.matches);
    if (payload.error) catalog.error = payload.error;
    return catalog;
  }
  function manufacturerFingerprint(line) {
    return JSON.stringify([line.id, line.brand, line.model, line.type, line.lb, line.dia_in, line.dia_mm, line.source_scope_label || ""]);
  }
  function laboratoryFingerprint(line) {
    return JSON.stringify([line.source_record_id, line.brand, line.model, line.variant, line.type, line.rated_strength.value, line.rated_strength.unit, line.rated_strength.label]);
  }
  function verifiedMatch(manufacturerLine, catalog, matches) {
    if (!manufacturerLine || !catalog) return null;
    var valid = (Array.isArray(matches) ? matches : []).filter(function(match) {
      if (!match || typeof match !== "object") return false;
      if (match.status !== "approved" || !match.approved_by || !match.approved_at || !match.evidence_url || match.manufacturer_id !== manufacturerLine.id) return false;
      try { required(match.approved_by, "match reviewer"); if (!validDate(match.approved_at)) return false; safeUrl(match.evidence_url); } catch (_) { return false; }
      var lab = catalog.resolve(SOURCE, PREFIX + match.source_record_id);
      if (!lab) return false;
      if (manufacturerLine.type !== lab.type || Math.abs(Number(manufacturerLine.lb) - lab.lb) > 0.000001 || !Number.isFinite(Number(manufacturerLine.lb))) return false;
      return match.manufacturer_fingerprint === manufacturerFingerprint(manufacturerLine) &&
        match.laboratory_fingerprint === laboratoryFingerprint(lab);
    });
    return valid.length === 1 ? catalog.resolve(SOURCE, PREFIX + valid[0].source_record_id) : null;
  }

  // An approved cross-reference unlocks a diameter choice, never a guessed product replacement.
  function mountVerifiedChoice(options) {
    var section = document.createElement("fieldset");
    section.className = "rc-measured-diameter-choice";
    section.style.cssText = "border:0;border-top:1px solid #d8dee2;margin:12px 0;padding:10px 0;min-width:0;max-width:100%;font-size:14px;line-height:1.5;overflow-wrap:anywhere";
    var legend = document.createElement("legend");
    legend.textContent = "Diameter to use";
    legend.style.fontWeight = "600";
    section.appendChild(legend);
    var inputs = {}, labels = {};
    var name = "rc-diameter-" + (options.role || "main") + "-" + (++mountVerifiedChoice.sequence);
    ["manufacturer", SOURCE].forEach(function(value) {
      var labelElement = document.createElement("label");
      labelElement.style.cssText = "display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;font:inherit";
      var input = document.createElement("input");
      input.type = "radio"; input.name = name; input.value = value;
      input.style.cssText = "width:18px;height:18px;flex:0 0 18px;margin:0";
      var text = document.createElement("span");
      labelElement.append(input, text); section.appendChild(labelElement);
      inputs[value] = input; labels[value] = text;
      input.addEventListener("change", function() {
        if (!input.checked) return;
        selectedSource = value;
        refresh();
        options.onChange();
      });
    });
    var credit = document.createElement("div"); credit.setAttribute("role", "status"); section.appendChild(credit);
    options.parent.appendChild(section);
    var manufacturerLine = null, laboratoryLine = null, key = "", selectedSource = "manufacturer", unit = "standard";
    function diameter(line) {
      if (!line) return "unavailable";
      return unit === "metric" ? Number((line.dia_mm || line.dia_in * 25.4).toFixed(4)) + " mm" : Number(line.dia_in.toFixed(6)) + " in";
    }
    function refresh() {
      section.hidden = !laboratoryLine && selectedSource === "manufacturer";
      inputs.manufacturer.checked = selectedSource === "manufacturer";
      inputs[SOURCE].checked = selectedSource === SOURCE;
      inputs[SOURCE].disabled = !laboratoryLine;
      labels.manufacturer.textContent = "Manufacturer-listed: " + diameter(manufacturerLine);
      labels[SOURCE].textContent = "Line Laboratory measured: " + diameter(laboratoryLine);
      credit.replaceChildren();
      if (selectedSource === SOURCE) {
        if (laboratoryLine) renderAttribution(credit, laboratoryLine);
        else credit.textContent = "This measurement is no longer available for this line. Choose Manufacturer-listed to calculate with its published diameter.";
      }
    }
    function resolve(line, nextUnit) {
      var nextKey = line && sourceOf(line) === "manufacturer" ? manufacturerFingerprint(line) : "";
      if (key !== nextKey) { selectedSource = "manufacturer"; key = nextKey; }
      manufacturerLine = nextKey ? line : null;
      unit = nextUnit || "standard";
      laboratoryLine = manufacturerLine ? verifiedMatch(manufacturerLine, options.catalog, options.catalog.matches) : null;
      refresh();
      if (selectedSource !== SOURCE) return line;
      if (!laboratoryLine) return null;
      return Object.assign({}, line, laboratoryLine, { manufacturer_line_id: line.id });
    }
    refresh();
    return { element: section, resolve: resolve, source: function() { return selectedSource; },
      reset: function() { selectedSource = "manufacturer"; refresh(); } };
  }
  mountVerifiedChoice.sequence = 0;

  // This picker never changes manufacturer options or tries to match products by name.
  function mountPicker(options) {
    var catalog = options.catalog;
    var requested = options.selection || { source: "manufacturer", id: "" };
    var section = document.createElement("div");
    section.className = "rc-line-source";
    section.style.cssText = "margin:12px 0;max-width:100%;font-size:14px;line-height:1.5;overflow-wrap:anywhere";
    var labelElement = document.createElement("label");
    labelElement.textContent = "Choose a line from";
    var select = document.createElement("select");
    select.setAttribute("aria-label", (options.role || "Main") + " line diameter source");
    select.style.cssText = "display:block;box-sizing:border-box;width:100%;max-width:100%;min-height:44px;margin:4px 0 8px;padding:8px;background:#fff;color:#1f2528;border:1px solid #bcc5c9;border-radius:6px;font:inherit";
    [["manufacturer", "ReelCalc - manufacturer-listed diameters"], [SOURCE, "Line Laboratory - measured diameters"]].forEach(function(item) {
      var option = document.createElement("option"); option.value = item[0]; option.textContent = item[1]; select.appendChild(option);
    });
    labelElement.appendChild(select); section.appendChild(labelElement);
    var coverage = document.createElement("small");
    var materials = MATERIALS.filter(function(material) {
      return catalog.laboratory.some(function(line) { return line.material === material; });
    });
    coverage.textContent = "Currently available: tested " + materials.map(function(material) {
      return material.toLowerCase();
    }).join(", ") + ".";
    coverage.style.cssText = "margin:0 0 8px";
    section.appendChild(coverage);
    var browse = document.createElement("button");
    browse.type = "button"; browse.textContent = "Search Line Laboratory tested lines";
    browse.style.cssText = "display:block;background:none;border:0;padding:6px 0;color:#126b70;text-decoration:underline;text-align:left;font:inherit;cursor:pointer;min-height:44px;max-width:100%;white-space:normal";
    section.appendChild(browse);
    var searchLabel = document.createElement("label"); searchLabel.textContent = "Search tested lines";
    var search = document.createElement("input"); search.type = "search";
    search.setAttribute("aria-label", (options.role || "Main") + " search Line Laboratory tested lines");
    search.placeholder = "Brand, line name or lb test"; search.style.cssText = select.style.cssText;
    searchLabel.appendChild(search); section.appendChild(searchLabel);
    var records = document.createElement("select"); records.setAttribute("aria-label", (options.role || "Main") + " Line Laboratory test");
    records.style.cssText = select.style.cssText;
    function filterRecords() {
      var selected = records.value;
      var words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      var filtered = catalog.laboratory.filter(function(line) {
        return line.id === selected || words.every(function(word) { return label(line).toLowerCase().includes(word); });
      });
      records.replaceChildren();
      var blank = document.createElement("option"); blank.value = "";
      blank.textContent = filtered.length ? "Choose a tested line (" + filtered.length + ")" : "No tested lines found";
      records.appendChild(blank);
      filtered.forEach(function(line) {
        var option = document.createElement("option"); option.value = line.id; option.textContent = label(line); records.appendChild(option);
      });
      records.value = selected;
    }
    filterRecords(); search.addEventListener("input", filterRecords);
    var status = document.createElement("div"); status.setAttribute("role", "status");
    var diameters = document.createElement("div");
    var credit = document.createElement("div");
    section.append(records, status, diameters, credit); options.parent.appendChild(section);
    var source = requested.source;
    var fields = (options.manufacturerFields || []).filter(Boolean).map(function(field) { return { element: field, display: field.style.display }; });
    function render() {
      var lab = source !== "manufacturer";
      select.value = lab ? SOURCE : "manufacturer";
      coverage.hidden = !lab || !catalog.available;
      coverage.style.display = coverage.hidden ? "none" : "block";
      records.hidden = !lab || !catalog.available;
      records.style.display = records.hidden ? "none" : "block";
      searchLabel.hidden = records.hidden;
      searchLabel.style.display = records.hidden ? "none" : "block";
      browse.hidden = lab || !catalog.available;
      browse.style.display = browse.hidden ? "none" : "block";
      fields.forEach(function(field) { field.element.hidden = lab; field.element.style.display = lab ? "none" : field.display; });
      section.hidden = !catalog.available && !lab;
      var line = lab ? catalog.resolve(source, records.value) : null;
      status.textContent = !lab ? "" : !catalog.available ? "Line Laboratory measurements are not available yet. Choose Manufacturer Specifications to use the existing database." :
        !line ? "Choose an exact test above. No manufacturer diameter will be substituted." : label(line);
      renderDiameters(diameters, line);
      renderAttribution(credit, line);
    }
    select.addEventListener("change", function() {
      source = select.value; records.value = ""; search.value = ""; filterRecords();
      options.onSourceChange(source); render();
    });
    browse.addEventListener("click", function() { select.value = SOURCE; select.dispatchEvent(new Event("change")); search.focus(); });
    records.addEventListener("change", function() {
      options.onSelect(catalog.resolve(SOURCE, records.value)); render();
    });
    if (source !== "manufacturer") {
      records.value = requested.id; options.onSourceChange(source);
      options.onSelect(catalog.resolve(source, requested.id));
    }
    render();
    return { element: section, source: function() { return source; },
      setSelection: function(value) {
        source = value.source; search.value = ""; records.value = ""; filterRecords(); records.value = value.id || "";
        options.onSourceChange(source);
        if (source !== "manufacturer") options.onSelect(catalog.resolve(source, value.id));
        render();
      },
      reset: function() { source = "manufacturer"; records.value = ""; search.value = ""; filterRecords(); options.onSourceChange(source); render(); } };
  }
  var api = { SOURCE: SOURCE, PREFIX: PREFIX, validateRecord: validateRecord, identity: identity,
    toLine: toLine, createCatalog: createCatalog, sourceOf: sourceOf, label: label, selection: selection,
    buildLink: buildLink, attribution: attribution, renderAttribution: renderAttribution, renderDiameters: renderDiameters, load: load,
    manufacturerFingerprint: manufacturerFingerprint, laboratoryFingerprint: laboratoryFingerprint,
    verifiedMatch: verifiedMatch, mountVerifiedChoice: mountVerifiedChoice, mountPicker: mountPicker };
  global.ReelCalcLineSources = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
