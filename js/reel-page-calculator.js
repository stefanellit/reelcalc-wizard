(function() {
  "use strict";

  var loaderScript = document.currentScript;
  var scriptUrl = new URL(loaderScript.src, document.baseURI);
  var assetBase = loaderScript.dataset.assetBase
    ? new URL(loaderScript.dataset.assetBase, document.baseURI)
    : new URL("../", scriptUrl);
  var jsonCache = new Map();
  var scriptCache = new Map();

  function assetUrl(path) {
    return new URL(path, assetBase).href;
  }

  function loadScript(path, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    var url = assetUrl(path);
    if (scriptCache.has(url)) return scriptCache.get(url);
    var promise = new Promise(function(resolve, reject) {
      var existing = Array.from(document.scripts).find(function(script) {
        return script.src === url;
      });
      var script = existing || document.createElement("script");
      function complete() {
        if (!globalName || window[globalName]) resolve(globalName ? window[globalName] : true);
        else reject(new Error(path + " loaded without " + globalName + "."));
      }
      script.addEventListener("load", complete, { once: true });
      script.addEventListener("error", function() {
        reject(new Error(path + " could not be loaded."));
      }, { once: true });
      if (!existing) {
        script.src = url;
        script.dataset.assetBase = assetBase.href;
        document.head.appendChild(script);
      }
    });
    scriptCache.set(url, promise);
    return promise;
  }

  function loadJson(url) {
    if (!jsonCache.has(url)) {
      jsonCache.set(url, fetch(url, { credentials: "omit" }).then(function(response) {
        if (!response.ok) throw new Error("Data returned HTTP " + response.status + ".");
        return response.json();
      }));
    }
    return jsonCache.get(url);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function displayName(reel) {
    return [reel.brand, reel.model, reel.size_label || reel.size_class].filter(Boolean).join(" ");
  }

  function renderLoadError(mount, message) {
    mount.innerHTML = '<div class="reelcalc-page-status" role="status">' + escapeHtml(message) + "</div>";
  }

  function defaultsForMount(mount) {
    return {
      mainLineLb: Number(mount.dataset.mainLineLb) || 15,
      mainLineYards: Number(mount.dataset.mainLineYards) || 150,
      mainLineDiameterIn: Number(mount.dataset.mainLineDiameterIn) || 0.008,
      backingLb: Number(mount.dataset.backingLb) || 10,
      backingDiameterIn: Number(mount.dataset.backingDiameterIn) || 0.012,
      mainLineId: mount.dataset.mainLineId || "",
      backingLineId: mount.dataset.backingLineId || ""
    };
  }

  function lineSelectorTemplate(role, title, material) {
    return `
      <div class="line-selector" data-role="${role}-selector">
        <div class="line-selector-head">
          <h3>${escapeHtml(title)}</h3>
          <button type="button" class="text-button" data-action="toggle-custom" data-line-role="${role}" aria-pressed="false">My line isn't listed</button>
        </div>
        <div class="material-tabs" role="group" aria-label="${escapeHtml(title)} type">
          <button type="button" data-action="material" data-line-role="${role}" data-material="Monofilament" class="material-button${material === "Monofilament" ? " active" : ""}">Mono</button>
          <button type="button" data-action="material" data-line-role="${role}" data-material="Fluorocarbon" class="material-button${material === "Fluorocarbon" ? " active" : ""}">Fluorocarbon</button>
          <button type="button" data-action="material" data-line-role="${role}" data-material="Copolymer" class="material-button${material === "Copolymer" ? " active" : ""}">Copolymer</button>
          <button type="button" data-action="material" data-line-role="${role}" data-material="Braid" class="material-button${material === "Braid" ? " active" : ""}">Braid</button>
        </div>
        <div data-role="${role}-database-fields">
          <label for="${role}-product">Brand / line</label>
          <select id="${role}-product" data-role="${role}-product"></select>
          <label for="${role}-strength">Strength</label>
          <select id="${role}-strength" data-role="${role}-strength"></select>
          <p class="selection-detail" data-role="${role}-detail"></p>
        </div>
        <div class="custom-fields hidden" data-role="${role}-custom-fields">
          <div class="field-grid">
            <div>
              <label for="${role}-custom-lb">Strength (<span data-role="strength-unit">lb</span>)</label>
              <input id="${role}-custom-lb" data-role="${role}-custom-lb" type="number" inputmode="decimal" min="0.1" step="0.1">
            </div>
            <div>
              <label for="${role}-custom-dia">Diameter (<span data-role="diameter-unit">in</span>)</label>
              <input id="${role}-custom-dia" data-role="${role}-custom-dia" type="number" inputmode="decimal" min="0.001" step="0.001">
            </div>
          </div>
          <p class="selection-detail">Use the published diameter for your exact line. Custom braid estimates may have a wider range.</p>
        </div>
      </div>`;
  }

  function calculatorTemplate(reel, defaults) {
    return `
      <style>
        :host{color:#1f2528;display:block;font-family:Arial,sans-serif;--green:#2f7d32;--green-dark:#256728;--blue:#24688f;--border:#d8dee2;--soft:#f4f7f6;--muted:#5e666a}*{box-sizing:border-box}.calculator{margin:18px auto;max-width:720px;padding:14px 0}.reel-name{color:var(--muted);font-size:13px;margin:0 0 10px;text-align:center}.starting-setup{background:#eef7ef;border-left:4px solid var(--green);border-radius:6px;font-size:13px;line-height:1.5;margin:0 0 14px;padding:11px 12px}.starting-setup .small-button{margin-left:6px}.toolbar{display:grid;gap:10px;margin-bottom:14px}.segmented{background:#f0f2f2;border:1px solid var(--border);border-radius:8px;display:grid;grid-template-columns:1fr 1fr;padding:3px}.segment-button,.material-button{background:transparent;border:0;border-radius:6px;color:#4f585c;cursor:pointer;font:inherit;font-size:13px;font-weight:800;min-height:42px;padding:8px}.segment-button.active,.material-button.active{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);color:#1f2528}.mode-note{color:var(--muted);font-size:13px;margin:0;text-align:center}.guidance{align-items:center;background:#f2f7fa;border-left:4px solid var(--blue);display:flex;font-size:13px;gap:8px;line-height:1.45;margin:14px 0;padding:10px 12px}.info-button{background:transparent;border:1px solid #8a969b;border-radius:50%;color:#344247;cursor:pointer;flex:0 0 auto;font-size:12px;font-weight:800;height:22px;margin:0;padding:0;width:22px}.line-selector{border:1px solid var(--border);border-radius:8px;margin-top:14px;padding:14px}.main-selector{border-left:5px solid var(--green)}.backing-selector{border-left:5px solid #6d5b91}.line-selector-head{align-items:center;display:flex;gap:10px;justify-content:space-between}.line-selector h3{font-size:16px;letter-spacing:0;margin:0}.text-button{background:transparent;border:0;color:#215e86;cursor:pointer;font-size:12px;font-weight:700;padding:5px;text-decoration:underline;text-underline-offset:3px}.text-button.active{color:#7a3f17}.material-tabs{display:grid;gap:5px;grid-template-columns:repeat(4,minmax(0,1fr));margin:12px 0}.material-button{border:1px solid var(--border);min-width:0}.material-button.active{background:#e9f4ea;border-color:#80aa83;box-shadow:none;color:#1f5622}label{display:block;font-size:13px;font-weight:700;letter-spacing:0;margin:10px 0 4px}select,input{background:#fff;border:1px solid #bcc5c9;border-radius:6px;color:#111;font:inherit;min-height:44px;padding:8px;width:100%}select:focus,input:focus,button:focus-visible{outline:3px solid rgba(36,104,143,.2);outline-offset:1px}.selection-detail{color:var(--muted);font-size:12px;line-height:1.45;margin:7px 0 0}.field-grid{display:grid;gap:10px;grid-template-columns:1fr 1fr}.length-field{background:var(--soft);border-radius:8px;margin:12px 0 0;padding:12px}.calculate-button{background:var(--green);border:0;border-radius:7px;color:#fff;cursor:pointer;font-size:16px;font-weight:800;margin-top:16px;min-height:48px;padding:11px 16px;width:100%}.calculate-button:hover{background:var(--green-dark)}.advanced{border-top:1px solid var(--border);margin-top:16px;padding-top:12px}.advanced summary{color:var(--muted);cursor:pointer;font-size:13px;font-weight:700}.output{margin-top:18px;min-height:48px}.output:empty{display:none}.result{border:1px solid var(--border);border-radius:8px;overflow:hidden}.result-head{background:#edf6ee;border-left:6px solid var(--green);padding:16px}.result-kicker{color:#315c34;display:block;font-size:12px;font-weight:800;text-transform:uppercase}.result-number{color:#235e27;display:block;font-size:32px;font-weight:900;line-height:1.15;margin-top:4px}.result-subtitle{margin:5px 0 0}.basis{align-items:flex-start;background:#f5f7f8;display:flex;font-size:13px;gap:8px;padding:11px 14px}.setup-summary{display:grid;gap:1px;background:var(--border);grid-template-columns:1fr 1fr}.summary-item{background:#fff;padding:13px}.summary-item span{color:var(--muted);display:block;font-size:12px}.summary-item strong{display:block;font-size:14px;margin-top:3px}.result-note{color:var(--muted);font-size:12px;line-height:1.5;margin:0;padding:12px 14px}.affiliate-grid{border-top:1px solid var(--border);display:grid;gap:10px;padding:14px}.affiliate-card{background:#f7f8f8;border:1px solid var(--border);border-radius:7px;padding:12px}.affiliate-card strong{display:block;font-size:14px}.affiliate-card p{color:var(--muted);font-size:12px;margin:5px 0 10px}.affiliate-link{align-items:center;background:var(--green);border-radius:6px;color:#fff!important;display:inline-flex;font-size:13px;font-weight:800;min-height:40px;padding:9px 12px;text-decoration:none!important}.disclosure{color:var(--muted);display:block;font-size:10px;line-height:1.4;margin-top:8px}.savings{background:#eef7ef;border-left:4px solid var(--green);font-size:13px;line-height:1.5;margin:12px 14px;padding:10px 12px}.turns{border-top:1px solid var(--border);font-size:13px;line-height:1.6;padding:13px 14px}.error{background:#fff8e5;border:1px solid #d7a72f;border-radius:7px;color:#5f4607;padding:13px}.hidden{display:none!important}.modal-overlay{align-items:center;background:rgba(0,0,0,.6);display:none;inset:0;justify-content:center;position:fixed;z-index:9999}.modal{background:#fff;border-radius:8px;color:#1f2528;max-width:440px;padding:20px;width:90%}.modal h3{font-size:18px;margin:0 0 10px}.modal p{line-height:1.55;margin:0}.modal-close{background:#3e484c;border:0;border-radius:6px;color:#fff;cursor:pointer;font-weight:700;margin-top:18px;min-height:42px;width:100%}@media(max-width:520px){.calculator{padding:4px 0}.segment-button,.material-button{font-size:12px;padding:7px 4px}.material-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.field-grid,.setup-summary{grid-template-columns:1fr}.result-number{font-size:29px}.line-selector-head{align-items:flex-start;flex-direction:column;gap:3px}.text-button{padding-left:0}.guidance{align-items:flex-start}}
      </style>
      <div class="calculator">
        <p class="reel-name">Pre-loaded for ${escapeHtml(displayName(reel))}</p>
        <div class="starting-setup">
          <strong>Suggested starting setup:</strong> <span data-role="recommended-summary">${escapeHtml(defaults.mainLineLb)} lb braid, ${escapeHtml(defaults.mainLineYards)} yards, over ${escapeHtml(defaults.backingLb)} lb mono backing</span>. Using more backing can reduce how much premium line you need.
          <button type="button" class="text-button small-button" data-action="recommended">Use suggested setup</button>
        </div>
        <div class="toolbar">
          <div class="segmented" role="group" aria-label="Measurement units">
            <button type="button" class="segment-button active" data-action="unit" data-unit="standard">Standard</button>
            <button type="button" class="segment-button" data-action="unit" data-unit="metric">Metric</button>
          </div>
          <div class="segmented" role="group" aria-label="Calculator mode">
            <button type="button" class="segment-button active" data-action="mode" data-mode="backing">Backing + Main Line</button>
            <button type="button" class="segment-button" data-action="mode" data-mode="capacity">Capacity Only</button>
          </div>
          <p class="mode-note" data-role="mode-note">Choose your main-line amount, then ReelCalc calculates the backing.</p>
        </div>
        <div class="guidance">
          <span>Choose the line you plan to spool. ReelCalc automatically uses the appropriate mono or braid capacity rating for this reel.</span>
          <button type="button" class="info-button" data-action="capacity-info" aria-label="How ReelCalc chooses a capacity rating">i</button>
        </div>
        <div class="main-selector">${lineSelectorTemplate("main", "Main Line", "Braid")}</div>
        <div class="length-field" data-role="main-yards-wrap">
          <label for="main-yards">Main line amount (<span data-role="length-unit">yards</span>)</label>
          <input id="main-yards" data-role="main-yards" type="number" inputmode="decimal" min="1" step="1" value="${escapeHtml(defaults.mainLineYards)}">
        </div>
        <div class="backing-selector" data-role="backing-wrap">${lineSelectorTemplate("backing", "Backing Line", "Monofilament")}</div>
        <button type="button" class="calculate-button" data-action="calculate">Calculate My Setup</button>
        <details class="advanced">
          <summary>Handle-turn estimate</summary>
          <label for="reel-ipt">Reel retrieve (<span data-role="ipt-unit">inches</span> per turn)</label>
          <input id="reel-ipt" data-role="reel-ipt" type="number" inputmode="decimal" step="0.1" placeholder="Optional">
        </details>
        <div class="output" data-role="output" aria-live="polite"></div>
      </div>
      <div class="modal-overlay" data-role="modal-overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="reelcalc-capacity-info-title">
          <h3 id="reelcalc-capacity-info-title">How ReelCalc Chooses Capacity</h3>
          <p>ReelCalc uses the reel's mono capacity for mono and fluorocarbon, and its published braid capacity for braid when available. Braid does not always convert accurately from a mono capacity rating.</p>
          <button type="button" class="modal-close" data-action="modal-close">Close</button>
        </div>
      </div>`;
  }

  function mountCalculator(mount, reel, lines, affiliateData, services) {
    var core = services.core;
    var selector = services.selector;
    var affiliates = services.affiliates;
    var defaults = defaultsForMount(mount);
    var preload = selector.parsePreload(location.search);
    var shadow = mount.shadowRoot || mount.attachShadow({ mode: "open" });
    shadow.innerHTML = calculatorTemplate(reel, defaults);
    var preparedLines = selector.prepareLines(lines);
    var state = {
      unit: "standard",
      mode: preload.mode === "capacity" ? "capacity" : "backing",
      main: { material: "Braid", custom: false, line: null, awaitingChoice: true },
      backing: { material: "Monofilament", custom: false, line: null, awaitingChoice: true },
      affiliateImpressions: new Set(),
      lastCapacityBasisKey: "",
      mainYardsTouched: false
    };
    var PREMIUM_LINE_COST_LOW = 0.10;
    var PREMIUM_LINE_COST_HIGH = 0.16;
    var BACKING_COST_LOW = 0.01;
    var BACKING_COST_HIGH = 0.03;

    function q(role) {
      return shadow.querySelector('[data-role="' + role + '"]');
    }

    function qa(selectorValue) {
      return Array.from(shadow.querySelectorAll(selectorValue));
    }

    function emit(name, detail) {
      mount.dispatchEvent(new CustomEvent(name, {
        bubbles: true,
        composed: true,
        detail: Object.assign({
          reelId: reel.id,
          reelBrand: reel.brand || "",
          reelModel: reel.model || "",
          reelSize: reel.size_label || reel.size_class || ""
        }, detail || {})
      }));
    }

    function formatNumber(value, digits) {
      return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits == null ? 1 : digits
      });
    }

    function yardsToDisplay(yards) {
      return state.unit === "metric" ? core.yardsToMeters(yards) : Number(yards);
    }

    function displayToYards(value) {
      return state.unit === "metric" ? core.metersToYards(value) : Number(value);
    }

    function inchesToDisplay(inches) {
      return state.unit === "metric" ? core.inchesToMm(inches) : Number(inches);
    }

    function displayToInches(value) {
      return state.unit === "metric" ? core.mmToInches(value) : Number(value);
    }

    function lengthLabel(yards, digits) {
      return formatNumber(yardsToDisplay(yards), digits) + " " + (state.unit === "metric" ? "m" : "yd");
    }

    function rangeLabel(range) {
      return formatNumber(yardsToDisplay(range.minimumYards), 0) + "-" +
        formatNumber(yardsToDisplay(range.maximumYards), 0) + " " +
        (state.unit === "metric" ? "m" : "yd");
    }

    function strengthLabel(line) {
      return state.unit === "metric"
        ? formatNumber(core.lbToKg(line.lb), 1) + " kg"
        : formatNumber(line.lb, 0) + " lb";
    }

    function lineLabel(line) {
      if (!line) return "";
      var product = line.custom_line
        ? "Custom " + selector.normalizedMaterial(line.type).toLowerCase()
        : [line.brand, line.model].filter(Boolean).join(" ");
      return product + " " + strengthLabel(line);
    }

    function setActiveButtons(action, attribute, value) {
      qa('[data-action="' + action + '"]').forEach(function(button) {
        button.classList.toggle("active", button.dataset[attribute] === value);
      });
    }

    function optionsHtml(options, selectedValue, valueKey, labelFunction) {
      return options.map(function(option) {
        var value = option[valueKey];
        return '<option value="' + escapeHtml(value) + '"' + (value === selectedValue ? " selected" : "") + ">" +
          escapeHtml(labelFunction(option)) + "</option>";
      }).join("");
    }

    function setRoleLine(role, line) {
      state[role].line = line || null;
      if (!line) return;
      state[role].awaitingChoice = false;
      state[role].material = line.material || selector.normalizedMaterial(line.type);
      refreshRole(role, line.id);
    }

    function refreshRole(role, selectedLineId) {
      var roleState = state[role];
      var products = selector.productsFor(preparedLines, roleState.material);
      var current = selectedLineId
        ? preparedLines.find(function(line) { return line.id === selectedLineId; })
        : roleState.line;
      if (roleState.awaitingChoice && !selectedLineId) {
        current = null;
      } else if (!current || current.material !== roleState.material) {
        current = products.length
          ? selector.strengthsFor(preparedLines, products[0])[0]
          : null;
      }
      roleState.line = current;

      var currentProductKey = current ? selector.productKey(current) : "";
      q(role + "-product").innerHTML = '<option value="">Choose a line</option>' + optionsHtml(products, currentProductKey, "key", function(product) {
        return product.label;
      });
      var product = products.find(function(item) { return item.key === currentProductKey; }) || products[0];
      if (!currentProductKey) product = null;
      var strengths = selector.strengthsFor(preparedLines, product);
      if (!strengths.some(function(line) { return current && line.id === current.id; })) current = strengths[0] || null;
      roleState.line = current;
      q(role + "-strength").innerHTML = (strengths.length ? "" : '<option value="">Choose a line first</option>') + optionsHtml(strengths, current ? current.id : "", "id", function(line) {
        return strengthLabel(line);
      });
      q(role + "-strength").disabled = !strengths.length;
      q(role + "-detail").textContent = current
        ? "Published diameter: " + formatNumber(inchesToDisplay(current.dia_in), state.unit === "metric" ? 3 : 4) + " " + (state.unit === "metric" ? "mm" : "in")
        : "Choose the exact line and strength you plan to spool.";
      qa('[data-action="material"][data-line-role="' + role + '"]').forEach(function(button) {
        button.classList.toggle("active", button.dataset.material === roleState.material);
      });
    }

    function currentLine(role) {
      var roleState = state[role];
      if (!roleState.custom) return roleState.line;
      var lbDisplay = Number(q(role + "-custom-lb").value);
      var diameterDisplay = Number(q(role + "-custom-dia").value);
      var lb = state.unit === "metric" ? core.kgToLb(lbDisplay) : lbDisplay;
      var diameter = displayToInches(diameterDisplay);
      if (!(lb > 0) || !(diameter > 0)) return null;
      return {
        id: "custom-" + role + "-line",
        brand: "Custom",
        model: roleState.material,
        type: roleState.material,
        material: roleState.material,
        lb: lb,
        dia_in: diameter,
        custom_line: true
      };
    }

    function toggleCustom(role) {
      var roleState = state[role];
      roleState.custom = !roleState.custom;
      var button = shadow.querySelector('[data-action="toggle-custom"][data-line-role="' + role + '"]');
      button.classList.toggle("active", roleState.custom);
      button.setAttribute("aria-pressed", String(roleState.custom));
      button.textContent = roleState.custom ? "Use line database" : "My line isn't listed";
      q(role + "-database-fields").classList.toggle("hidden", roleState.custom);
      q(role + "-custom-fields").classList.toggle("hidden", !roleState.custom);
      if (roleState.custom && !q(role + "-custom-lb").value) {
        var source = roleState.line;
        q(role + "-custom-lb").value = source
          ? formatNumber(state.unit === "metric" ? core.lbToKg(source.lb) : source.lb, 1)
          : "";
        q(role + "-custom-dia").value = source
          ? formatNumber(inchesToDisplay(source.dia_in), state.unit === "metric" ? 3 : 4)
          : "";
      }
      emit("reelcalc:custom-line-changed", { lineRole: role, enabled: roleState.custom });
      updateSuggestedSummary();
      calculateIfReady("custom_line_toggle");
    }

    function updateMode() {
      var capacityOnly = state.mode === "capacity";
      q("backing-wrap").classList.toggle("hidden", capacityOnly);
      q("main-yards-wrap").classList.toggle("hidden", capacityOnly);
      q("mode-note").textContent = capacityOnly
        ? "Choose your exact line to see how much fits without backing."
        : "Choose your main-line amount, then ReelCalc calculates the backing.";
      setActiveButtons("mode", "mode", state.mode);
    }

    function updateUnits(nextUnit) {
      if (nextUnit === state.unit) return;
      var toMetric = nextUnit === "metric";
      var mainYards = Number(q("main-yards").value);
      var ipt = Number(q("reel-ipt").value);
      if (mainYards > 0) q("main-yards").value = formatNumber(toMetric ? core.yardsToMeters(mainYards) : core.metersToYards(mainYards), 1);
      if (ipt > 0) q("reel-ipt").value = formatNumber(toMetric ? ipt * 2.54 : ipt / 2.54, 1);
      ["main", "backing"].forEach(function(role) {
        var lb = Number(q(role + "-custom-lb").value);
        var dia = Number(q(role + "-custom-dia").value);
        if (lb > 0) q(role + "-custom-lb").value = formatNumber(toMetric ? core.lbToKg(lb) : core.kgToLb(lb), 1);
        if (dia > 0) q(role + "-custom-dia").value = formatNumber(toMetric ? core.inchesToMm(dia) : core.mmToInches(dia), toMetric ? 3 : 4);
      });
      state.unit = nextUnit;
      qa('[data-role="length-unit"]').forEach(function(element) { element.textContent = toMetric ? "meters" : "yards"; });
      qa('[data-role="strength-unit"]').forEach(function(element) { element.textContent = toMetric ? "kg" : "lb"; });
      qa('[data-role="diameter-unit"]').forEach(function(element) { element.textContent = toMetric ? "mm" : "in"; });
      qa('[data-role="ipt-unit"]').forEach(function(element) { element.textContent = toMetric ? "centimeters" : "inches"; });
      ["main", "backing"].forEach(function(role) { refreshRole(role, state[role].line && state[role].line.id); });
      updateSuggestedSummary();
      setActiveButtons("unit", "unit", state.unit);
      calculate("unit_change", false);
    }

    function basisExplanation(basis, mainLine, range) {
      if (basis.type === "published-braid-diameter") {
        var actualEstimate = basis.actualLineEstimate;
        if (actualEstimate && actualEstimate.method === "exact") {
          return "The best estimate uses this reel's matching published braid capacity. The range allows for differences in winding tension and fill level.";
        }
        if (actualEstimate && actualEstimate.referenceQuality === "published-pe-diameter") {
          return "The best estimate converts this reel's published PE-size capacity using the selected line's diameter. The range allows for normal braid and spooling variation.";
        }
        if (actualEstimate && actualEstimate.referenceQuality.indexOf("selected-product") === 0) {
          return "The best estimate converts this reel's published braid ratings using diameters from the selected line family. The range allows for normal spooling variation.";
        }
        return "The best estimate converts this reel's published braid ratings using typical verified braid diameters at those strengths. The range allows for line-to-line variation.";
      }
      if (basis.type === "published-braid") {
        var estimate = basis.publishedEstimate;
        if (estimate && estimate.method === "exact") {
          return "The best estimate uses this reel's matching published braid capacity. The range allows for differences in braid thickness, winding tension, and fill level.";
        }
        return "The best estimate uses this reel's published braid ratings near the selected strength. The range is wider because the strength is between published ratings.";
      }
      if (basis.fallback) {
        return "This reel does not provide a usable braid rating for " + strengthLabel(mainLine) + ". ReelCalc is estimating from the published mono capacity and the selected line diameter, so the range is wider.";
      }
      return basis.label + ". The selected line's stored diameter is used for the calculation.";
    }

    function handleTurnsHtml(mainYards, backingYards) {
      var iptDisplay = Number(q("reel-ipt").value);
      if (!(iptDisplay > 0)) return "";
      var ipt = state.unit === "metric" ? iptDisplay / 2.54 : iptDisplay;
      var main = core.calculateHandleTurns(mainYards, ipt);
      if (!main) return "";
      var html = '<div class="turns"><strong>Estimated Handle Turns</strong><br>';
      if (backingYards != null) {
        var backing = core.calculateHandleTurns(backingYards, ipt);
        html += "Backing: about " + formatNumber(backing.approximateTurns, 0) + " turns<br>";
        html += "Main line: about " + formatNumber(main.approximateTurns, 0) + " turns";
      } else {
        html += "Total line: about " + formatNumber(main.approximateTurns, 0) + " turns";
      }
      return html + '<p class="selection-detail">Use this as a starting point and watch the spool fill level.</p></div>';
    }

    function affiliateCard(line, requiredYards, role, planningYards) {
      var purchaseYards = Number(planningYards) > Number(requiredYards)
        ? Number(planningYards)
        : Number(requiredYards);
      var offer = affiliates.buildRecommendedLineOffer({
        affiliateData: affiliateData,
        line: line,
        requiredYards: purchaseYards
      });
      if (!offer) return "";
      var impressionKey = [role, line.id, offer.suggestedSpoolYards].join("|");
      if (!state.affiliateImpressions.has(impressionKey)) {
        state.affiliateImpressions.add(impressionKey);
        emit("reelcalc:line-affiliate-impression", {
          lineRole: role,
          lineId: line.id || "",
          lineBrand: line.brand || "",
          lineModel: line.model || "",
          lineType: selector.normalizedMaterial(line.type),
          lineLb: Number(line.lb) || 0,
          retailer: offer.retailerId,
          requiredLineYards: Number(requiredYards.toFixed(1)),
          planningLineYards: Number(purchaseYards.toFixed(1)),
          suggestedSpoolYards: offer.suggestedSpoolYards
        });
      }
      var roleLabel = role === "main" ? "Main line" : "Backing";
      var amountText = purchaseYards > requiredYards + 0.05
        ? "Best estimate: " + lengthLabel(requiredYards, 1) + ". Plan for up to " + lengthLabel(purchaseYards, 1) + ". "
        : "Calculated amount: " + lengthLabel(requiredYards, 1) + ". ";
      return '<div class="affiliate-card"><strong>' + roleLabel + ': ' + escapeHtml(lineLabel(line)) + "</strong>" +
        "<p>" + escapeHtml(amountText) + "Suggested retail spool: " + escapeHtml(lengthLabel(offer.suggestedSpoolYards, 0)) + ".</p>" +
        '<a class="affiliate-link" href="' + escapeHtml(offer.url) + '" target="_blank" rel="sponsored nofollow noopener" data-affiliate-role="' + role + '" data-retailer="' + escapeHtml(offer.retailerId) + '" data-line-id="' + escapeHtml(line.id || "") + '" data-required-yards="' + escapeHtml(requiredYards.toFixed(1)) + '" data-planning-yards="' + escapeHtml(purchaseYards.toFixed(1)) + '" data-spool-yards="' + escapeHtml(offer.suggestedSpoolYards) + '">' + escapeHtml(offer.label) + "</a>" +
        '<span class="disclosure">' + escapeHtml(offer.disclosure) + "</span></div>";
    }

    function savingsHtml(mainLine, mainYards, backingYards, fullCapacity) {
      var premiumAvoided = Math.max(0, fullCapacity - mainYards);
      var low = Math.max(0, premiumAvoided * PREMIUM_LINE_COST_LOW - backingYards * BACKING_COST_HIGH);
      var high = Math.max(low, premiumAvoided * PREMIUM_LINE_COST_HIGH - backingYards * BACKING_COST_LOW);
      var label = Math.floor(low) < 1
        ? "Up to about $" + Math.ceil(high)
        : "About $" + Math.floor(low) + "-$" + Math.ceil(high);
      return '<div class="savings"><strong>Estimated Line-Cost Savings: ' + label + "</strong><br>" +
        "Savings come from using lower-cost backing instead of filling the entire spool with premium line. " +
        "Estimate uses $0.10-$0.16 per yard for premium line and $0.01-$0.03 per yard for backing. Actual prices vary.</div>";
    }

    function recommendedMainYards(mainLine) {
      var requested = preload.mainLineYards || defaults.mainLineYards;
      if (preload.mainLineYards || state.mode !== "backing") return requested;
      var range = core.calculateActualLineBraidCapacityRange(reel, mainLine, preparedLines);
      var basis = core.capacityBasisForActualLine(reel, mainLine, preparedLines);
      var practicalCapacity = range ? range.minimumYards : (basis && basis.capacityYards);
      if (!(practicalCapacity > 0) || requested <= practicalCapacity * 0.9) return requested;
      var adjusted = Math.max(25, Math.round(practicalCapacity * 0.75 / 25) * 25);
      return Math.min(requested, adjusted);
    }

    function genericSuggestedMainLine() {
      return {
        type: "Braid",
        lb: defaults.mainLineLb,
        dia_in: defaults.mainLineDiameterIn,
        generic_recommendation: true
      };
    }

    function updateSuggestedSummary() {
      var main = currentLine("main");
      var backing = currentLine("backing");
      var yards = displayToYards(Number(q("main-yards").value));
      if (!main || !backing) {
        var mainStrength = state.unit === "metric"
          ? formatNumber(core.lbToKg(defaults.mainLineLb), 1) + " kg"
          : formatNumber(defaults.mainLineLb, 0) + " lb";
        var backingStrength = state.unit === "metric"
          ? formatNumber(core.lbToKg(defaults.backingLb), 1) + " kg"
          : formatNumber(defaults.backingLb, 0) + " lb";
        q("recommended-summary").textContent = mainStrength + " braid, " + lengthLabel(yards, 0) +
          ", over " + backingStrength + " mono backing";
        return;
      }
      q("recommended-summary").textContent = lineLabel(main) + ", " + lengthLabel(yards, 0) +
        ", over " + lineLabel(backing) + " backing";
    }

    function calculateIfReady(interactionSource) {
      var main = currentLine("main");
      var backing = state.mode === "backing" ? currentLine("backing") : true;
      if (main && backing) calculate(interactionSource, false);
      else q("output").replaceChildren();
    }

    function applyPracticalMainLineAmount() {
      if (preload.mainLineYards || state.mainYardsTouched) return;
      var main = currentLine("main") || genericSuggestedMainLine();
      q("main-yards").value = formatNumber(yardsToDisplay(recommendedMainYards(main)), 1);
      updateSuggestedSummary();
    }

    function calculate(interactionSource, userInitiated) {
      var mainLine = currentLine("main");
      var backingLine = state.mode === "backing" ? currentLine("backing") : null;
      var output = q("output");
      if (!mainLine || (state.mode === "backing" && !backingLine)) {
        output.innerHTML = '<div class="error">Choose lines with a usable diameter, or complete the custom-line fields.</div>';
        return;
      }
      var basis = core.capacityBasisForActualLine(reel, mainLine, preparedLines);
      if (!basis) {
        output.innerHTML = '<div class="error">ReelCalc could not establish a usable capacity reference for this setup.</div>';
        return;
      }
      var braidRange = core.calculateActualLineBraidCapacityRange(reel, mainLine, preparedLines);
      var basisText = basisExplanation(basis, mainLine, braidRange);
      var capacityBasisKey = [basis.type, mainLine.id || "custom", mainLine.lb].join("|");
      if (capacityBasisKey !== state.lastCapacityBasisKey) {
        state.lastCapacityBasisKey = capacityBasisKey;
        emit("reelcalc:capacity-basis-selected", {
          capacityBasis: basis.type,
          lineType: selector.normalizedMaterial(mainLine.type),
          lineId: mainLine.id || "",
          fallbackUsed: basis.fallback
        });
      }

      if (state.mode === "capacity") {
        var capacityDisplay = braidRange ? lengthLabel(braidRange.centerYards, 0) : lengthLabel(basis.capacityYards, 1);
        var capacityRangeSummary = braidRange
          ? '<p class="result-subtitle"><strong>Expected real-world range:</strong> ' + escapeHtml(rangeLabel(braidRange)) + '</p>'
          : "";
        var capacityNote = braidRange
          ? "Start near the low end, wind the line under firm even tension, and watch the spool fill. Stop at the reel's recommended fill level rather than forcing on the upper amount."
          : "This estimate uses the selected line's stored diameter and the reel's published mono capacity.";
        output.innerHTML = '<section class="result"><div class="result-head"><span class="result-kicker">' + (braidRange ? "Best full-spool estimate" : "Estimated full-spool capacity") + '</span><strong class="result-number">' + escapeHtml(capacityDisplay) + '</strong><p class="result-subtitle">of ' + escapeHtml(lineLabel(mainLine)) + '</p>' + capacityRangeSummary + '</div>' +
          '<div class="basis"><button type="button" class="info-button" data-action="capacity-info" aria-label="How ReelCalc chooses a capacity rating">i</button><span>' + escapeHtml(basisText) + '</span></div>' +
          '<div class="setup-summary"><div class="summary-item"><span>Reel</span><strong>' + escapeHtml(displayName(reel)) + '</strong></div><div class="summary-item"><span>Main line</span><strong>' + escapeHtml(lineLabel(mainLine)) + '</strong></div></div>' +
          '<p class="result-note">' + escapeHtml(capacityNote) + '</p>' +
          '<div class="affiliate-grid">' + affiliateCard(mainLine, braidRange ? braidRange.centerYards : basis.capacityYards, "main", braidRange ? braidRange.maximumYards : basis.capacityYards) + '</div>' +
          handleTurnsHtml(basis.capacityYards, null) + "</section>";
        dispatchCompleted(interactionSource, userInitiated, mainLine, null, basis, {
          mainLineYards: basis.capacityYards,
          backingYards: 0
        });
        return;
      }

      var desiredDisplay = Number(q("main-yards").value);
      var desiredYards = displayToYards(desiredDisplay);
      if (!(desiredYards > 0)) {
        output.innerHTML = '<div class="error">Enter how much main line you want on the reel.</div>';
        return;
      }
      var result = core.calculateActualLineCalibratedBacking(reel, mainLine, desiredYards, backingLine, preparedLines);
      if (!result || result.overCapacity) {
        output.innerHTML = '<div class="error">That main-line amount is greater than this reel is estimated to hold. Use less main line or choose a thinner line.</div>';
        return;
      }
      var backingRange = core.calculateActualLineCalibratedBackingRange(reel, mainLine, desiredYards, backingLine, preparedLines);
      var backingDisplay = lengthLabel(result.backingYards, 1);
      var backingRangeSummary = backingRange
        ? '<p class="result-subtitle"><strong>Expected real-world range:</strong> ' + escapeHtml(rangeLabel(backingRange)) + '</p>'
        : "";
      var backingNote = backingRange
        ? "Start with the best backing estimate, wind the backing evenly, then add your planned main line under firm tension. Treat the range as an adjustment allowance and stop at the reel's recommended fill level."
        : "Backing uses the selected main and backing line diameters.";
      output.innerHTML = '<section class="result"><div class="result-head"><span class="result-kicker">' + (backingRange ? "Best backing estimate" : "Estimated backing needed") + '</span><strong class="result-number">' + escapeHtml(backingDisplay) + '</strong><p class="result-subtitle">of ' + escapeHtml(lineLabel(backingLine)) + '</p>' + backingRangeSummary + '</div>' +
        '<div class="basis"><button type="button" class="info-button" data-action="capacity-info" aria-label="How ReelCalc chooses a capacity rating">i</button><span>' + escapeHtml(basisText) + '</span></div>' +
        '<div class="setup-summary"><div class="summary-item"><span>Main line</span><strong>' + escapeHtml(lineLabel(mainLine)) + " - " + escapeHtml(lengthLabel(desiredYards, 1)) + '</strong></div><div class="summary-item"><span>Backing</span><strong>' + escapeHtml(lineLabel(backingLine)) + " - " + escapeHtml(backingDisplay) + '</strong></div></div>' +
        '<p class="result-note">' + escapeHtml(backingNote) + '</p>' +
        savingsHtml(mainLine, desiredYards, result.backingYards, basis.capacityYards) +
        '<div class="affiliate-grid">' + affiliateCard(mainLine, desiredYards, "main", desiredYards) + affiliateCard(backingLine, result.backingYards, "backing", backingRange ? backingRange.maximumYards : result.backingYards) + '</div>' +
        handleTurnsHtml(desiredYards, result.backingYards) + "</section>";
      dispatchCompleted(interactionSource, userInitiated, mainLine, backingLine, basis, {
        mainLineYards: desiredYards,
        backingYards: result.backingYards
      });
    }

    function dispatchCompleted(interactionSource, userInitiated, mainLine, backingLine, basis, values) {
      emit("reelcalc:calculation-completed", {
        interactionSource: interactionSource || "automatic",
        isUserInitiated: !!userInitiated,
        mode: state.mode,
        unitSystem: state.unit,
        capacityBasis: basis.type,
        fallbackUsed: basis.fallback,
        mainLineId: mainLine.id || "",
        mainLineBrand: mainLine.brand || "",
        mainLineModel: mainLine.model || "",
        mainLineType: selector.normalizedMaterial(mainLine.type),
        mainLineLb: Number(mainLine.lb) || 0,
        mainLineYards: Number(values.mainLineYards.toFixed(1)),
        mainLineDiameterMm: Number((mainLine.dia_in * core.MM_PER_INCH).toFixed(3)),
        backingLineId: backingLine ? backingLine.id || "" : "",
        backingLineBrand: backingLine ? backingLine.brand || "" : "",
        backingLineModel: backingLine ? backingLine.model || "" : "",
        backingLineType: backingLine ? selector.normalizedMaterial(backingLine.type) : "",
        backingLineLb: backingLine ? Number(backingLine.lb) || 0 : 0,
        backingYards: Number(values.backingYards.toFixed(1)),
        backingDiameterMm: backingLine ? Number((backingLine.dia_in * core.MM_PER_INCH).toFixed(3)) : 0,
        customMainLine: !!mainLine.custom_line,
        customBackingLine: !!(backingLine && backingLine.custom_line)
      });
    }

    function useRecommendedSetup(userInitiated) {
      var main = selector.findLine(preparedLines, "", preload.mainLineId || defaults.mainLineId);
      var backing = selector.findLine(preparedLines, "", preload.backingLineId || defaults.backingLineId);
      if (main) setRoleLine("main", main); else refreshRole("main");
      if (backing) setRoleLine("backing", backing); else refreshRole("backing");
      state.mode = preload.mode === "capacity" ? "capacity" : "backing";
      var suggestedMainYards = recommendedMainYards(main || genericSuggestedMainLine());
      q("main-yards").value = formatNumber(yardsToDisplay(suggestedMainYards), 1);
      updateSuggestedSummary();
      shadow.querySelector('[data-action="recommended"]').hidden = !(main && (state.mode === "capacity" || backing));
      updateMode();
      if (userInitiated) emit("reelcalc:recommended-setup-loaded", {
        mainLineId: main ? main.id : "",
        backingLineId: backing ? backing.id : "",
        mode: state.mode
      });
      if (main && (state.mode === "capacity" || backing)) {
        calculate(userInitiated ? "recommended_setup" : "initial", !!userInitiated);
      } else {
        q("output").replaceChildren();
      }
    }

    shadow.addEventListener("click", function(event) {
      var button = event.target.closest("[data-action]");
      if (button) {
        var action = button.dataset.action;
        if (action === "unit") updateUnits(button.dataset.unit);
        if (action === "mode") {
          state.mode = button.dataset.mode;
          updateMode();
          emit("reelcalc:calculator-mode-changed", { mode: state.mode });
          calculate("mode_change", true);
        }
        if (action === "material") {
          var role = button.dataset.lineRole;
          state[role].material = button.dataset.material;
          state[role].line = null;
          state[role].awaitingChoice = true;
          refreshRole(role);
          emit("reelcalc:line-selection-changed", { lineRole: role, selectionStage: "type", lineType: state[role].material });
          updateSuggestedSummary();
          calculateIfReady("line_type_change");
        }
        if (action === "toggle-custom") toggleCustom(button.dataset.lineRole);
        if (action === "calculate") calculate("calculate_button", true);
        if (action === "recommended") useRecommendedSetup(true);
        if (action === "capacity-info") q("modal-overlay").style.display = "flex";
        if (action === "modal-close") q("modal-overlay").style.display = "none";
      }
      var link = event.target.closest("[data-affiliate-role]");
      if (link) {
        var roleName = link.dataset.affiliateRole;
        var clickedLine = currentLine(roleName);
        emit("reelcalc:line-affiliate-click", {
          lineRole: roleName,
          lineId: link.dataset.lineId || "",
          lineBrand: clickedLine ? clickedLine.brand || "" : "",
          lineModel: clickedLine ? clickedLine.model || "" : "",
          lineType: clickedLine ? selector.normalizedMaterial(clickedLine.type) : "",
          lineLb: clickedLine ? Number(clickedLine.lb) || 0 : 0,
          retailer: link.dataset.retailer || "",
          requiredLineYards: Number(link.dataset.requiredYards) || 0,
          suggestedSpoolYards: Number(link.dataset.spoolYards) || 0
        });
      }
    });

    shadow.addEventListener("change", function(event) {
      var role;
      if (event.target.matches('[data-role$="-product"]')) {
        role = event.target.dataset.role.replace("-product", "");
        var product = selector.productsFor(preparedLines, state[role].material).find(function(item) {
          return item.key === event.target.value;
        });
        var productStrengths = selector.strengthsFor(preparedLines, product);
        var suggestedLb = role === "main" ? defaults.mainLineLb : defaults.backingLb;
        var nextLine = productStrengths.slice().sort(function(a, b) {
          return Math.abs(a.lb - suggestedLb) - Math.abs(b.lb - suggestedLb) || a.lb - b.lb;
        })[0] || null;
        state[role].awaitingChoice = !nextLine;
        state[role].line = nextLine;
        refreshRole(role, nextLine && nextLine.id);
        if (role === "main") applyPracticalMainLineAmount();
        updateSuggestedSummary();
        emit("reelcalc:line-selection-changed", {
          lineRole: role,
          selectionStage: "product",
          lineId: nextLine ? nextLine.id : "",
          lineBrand: nextLine ? nextLine.brand : "",
          lineModel: nextLine ? nextLine.model : "",
          lineType: state[role].material
        });
        calculateIfReady("line_product_change");
      } else if (event.target.matches('[data-role$="-strength"]')) {
        role = event.target.dataset.role.replace("-strength", "");
        state[role].line = preparedLines.find(function(line) { return line.id === event.target.value; }) || null;
        state[role].awaitingChoice = !state[role].line;
        refreshRole(role, state[role].line && state[role].line.id);
        if (role === "main") applyPracticalMainLineAmount();
        updateSuggestedSummary();
        emit("reelcalc:line-selection-changed", {
          lineRole: role,
          selectionStage: "strength",
          lineId: state[role].line ? state[role].line.id : "",
          lineBrand: state[role].line ? state[role].line.brand : "",
          lineModel: state[role].line ? state[role].line.model : "",
          lineType: state[role].material,
          lineLb: state[role].line ? state[role].line.lb : 0
        });
        calculateIfReady("line_strength_change");
      } else if (event.target.matches("input")) {
        if (event.target.matches('[data-role="main-yards"]')) state.mainYardsTouched = true;
        if (event.target.matches('[data-role^="main-custom-"]')) applyPracticalMainLineAmount();
        updateSuggestedSummary();
        calculateIfReady("input_change");
      }
    });

    q("modal-overlay").addEventListener("click", function(event) {
      if (event.target === q("modal-overlay")) q("modal-overlay").style.display = "none";
    });
    if (Number(reel.line_retrieve_in) > 0) q("reel-ipt").value = Number(reel.line_retrieve_in);
    useRecommendedSetup(false);
    setActiveButtons("unit", "unit", state.unit);
    updateMode();
    mount.dataset.reelcalcReady = "true";
    emit("reelcalc:calculator-ready", {
      lineCount: preparedLines.length,
      validLineCount: preparedLines.length
    });
  }

  function initializeMount(mount) {
    if (mount.dataset.reelcalcReady === "true") return;
    var reelId = String(mount.dataset.reelId || "").trim();
    if (!reelId) {
      renderLoadError(mount, "This reel calculator is missing its ReelCalc reel ID.");
      return;
    }
    var reelsUrl = mount.dataset.reelsUrl ? new URL(mount.dataset.reelsUrl, document.baseURI).href : assetUrl("data/reels.json");
    var linesUrl = mount.dataset.linesUrl ? new URL(mount.dataset.linesUrl, document.baseURI).href : assetUrl("data/lines.json");
    var affiliatesUrl = mount.dataset.affiliatesUrl ? new URL(mount.dataset.affiliatesUrl, document.baseURI).href : assetUrl("data/reel-affiliates.json");

    Promise.all([
      loadScript("js/calculator-core.js", "ReelCalcCore"),
      loadScript("js/line-selector.js", "ReelCalcLineSelector"),
      loadScript("js/affiliate-links.js", "ReelCalcAffiliateLinks"),
      loadJson(reelsUrl),
      loadJson(linesUrl),
      loadJson(affiliatesUrl)
    ]).then(function(values) {
      var reels = values[3];
      var lines = values[4];
      var reel = Array.isArray(reels) ? reels.find(function(record) { return record.id === reelId; }) : null;
      if (!reel) throw new Error('ReelCalc could not find the reel record "' + reelId + '".');
      if (!values[0].isReelReady(reel)) throw new Error("This reel is missing required mono capacity data.");
      if (!Array.isArray(lines)) throw new Error("The central line database is unavailable.");
      mountCalculator(mount, reel, lines, values[5], {
        core: values[0],
        selector: values[1],
        affiliates: values[2]
      });
      var introduction = mount.previousElementSibling;
      if (introduction && introduction.tagName === "P") {
        introduction.textContent = "This calculator is pre-loaded for the exact reel shown on this page. Choose the actual line you plan to spool and ReelCalc automatically uses the appropriate published mono or braid capacity. In backing mode, the suggested main-line amount adjusts when needed to leave practical room for backing. The handle-turn estimate uses the reel's published retrieve when available.";
      }
    }).catch(function(error) {
      renderLoadError(mount, "The ReelCalc calculator could not load. " + error.message);
    });
  }

  function initializeAll() {
    document.querySelectorAll("[data-reelcalc-calculator]").forEach(initializeMount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAll, { once: true });
  } else {
    initializeAll();
  }

  window.ReelCalcReelPageCalculator = { initialize: initializeAll };
})();
