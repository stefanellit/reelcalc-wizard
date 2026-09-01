(function() {
  "use strict";

  var SITE_BASE = "https://www.reelcalc.com";
  var SCRIPT_URL = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : document.baseURI;
  var ASSET_ROOT = new URL("../", SCRIPT_URL);
  var state = {
    options: [],
    optionsByType: new Map(),
    optionByReelId: new Map(),
    reelById: new Map(),
    pageByReelId: new Map(),
    reelA: null,
    reelB: null,
    backingEnabled: true,
    affiliateData: null,
    completedPairIds: new Set(),
    restoringHistory: false,
    selectors: {
      A: { type: "", brand: "", family: "", matches: [], highlightedIndex: -1, resultLimit: 12, lastQuery: "", debounceTimer: null, controls: null },
      B: { type: "", brand: "", family: "", matches: [], highlightedIndex: -1, resultLimit: 12, lastQuery: "", debounceTimer: null, controls: null }
    },
    lines: [],
    lineRoles: {
      main: { material: "Braid", line: null, matches: [], highlightedIndex: -1, resultLimit: 20 },
      backing: { material: "Monofilament", line: null, matches: [], highlightedIndex: -1, resultLimit: 20 }
    }
  };

  var elements = {
    selectorMountA: document.getElementById("reel-a-selector"),
    selectorMountB: document.getElementById("reel-b-selector"),
    swap: document.getElementById("swap-reels"),
    copy: document.getElementById("copy-comparison"),
    reset: document.getElementById("reset-comparison"),
    status: document.getElementById("comparison-status"),
    results: document.getElementById("comparison-results"),
    headingA: document.getElementById("reel-a-heading"),
    headingB: document.getElementById("reel-b-heading"),
    differences: document.getElementById("quick-differences"),
    specifications: document.getElementById("specification-comparison"),
    summary: document.getElementById("comparison-summary"),
    capacities: document.getElementById("capacity-comparison"),
    lineFitSummary: document.getElementById("line-fit-summary"),
    lineFitComparison: document.getElementById("line-fit-comparison"),
    mainLineProduct: document.getElementById("main-line-product"),
    mainLineOptions: document.getElementById("main-line-options"),
    mainLineStrength: document.getElementById("main-line-strength"),
    mainLineDetail: document.getElementById("main-line-detail"),
    backingLineProduct: document.getElementById("backing-line-product"),
    backingLineOptions: document.getElementById("backing-line-options"),
    backingLineStrength: document.getElementById("backing-line-strength"),
    backingLineDetail: document.getElementById("backing-line-detail"),
    backingModeNote: document.getElementById("backing-mode-note"),
    mainLineYards: document.getElementById("main-line-yards"),
    setups: document.getElementById("setup-comparison"),
    sources: document.getElementById("source-links")
  };

  function assetUrl(path) {
    return new URL(path, ASSET_ROOT).href;
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
    var data = window.ReelCalcComparisonData;
    return data && typeof data.reelName === "function"
      ? data.reelName(reel)
      : [reel && reel.brand, reel && reel.model, reel && reel.size_label].filter(Boolean).join(" ");
  }

  function optionLabel(reel) {
    return displayName(reel) + (reel.sku ? " | " + reel.sku : "");
  }

  function trimNumber(value, decimals) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "Not published";
    return number.toFixed(decimals).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
  }

  function measurement(value, decimals, suffix) {
    return Number.isFinite(Number(value))
      ? trimNumber(value, decimals) + suffix
      : "Not published";
  }

  function gearRatio(value) {
    var ratio = String(value || "").trim();
    if (!ratio) return "Not published";
    return ratio.includes(":") ? ratio : ratio + ":1";
  }

  function formatMoney(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number)
      : "Not published";
  }

  function humanizeReelType(value) {
    var normalized = String(value || "").toLowerCase();
    var water = normalized.includes("saltwater")
      ? "Saltwater"
      : (normalized.includes("freshwater") ? "Freshwater" : "");
    var style = normalized.includes("spinning") || normalized.includes("front_drag")
      ? "spinning reel"
      : normalized.replace(/[_-]+/g, " ").trim();
    return [water, style].filter(Boolean).join(" ") || "Fishing reel";
  }

  function monoCapacity(reel) {
    var capacities = Array.isArray(reel.capacity_options) ? reel.capacity_options : [];
    if (capacities.length) {
      return capacities.map(function(item) {
        return trimNumber(item.lb, 1) + " lb / " + trimNumber(item.yards, 0) + " yd";
      }).join(", ");
    }
    return reel.capacity_note || "Not published";
  }

  function braidCapacity(reel) {
    return String(reel.braid_capacity_note || "").trim() || "Not published";
  }

  function setStatus(message, isError) {
    elements.status.textContent = message || "";
    elements.status.classList.toggle("is-error", Boolean(isError));
  }

  function comparisonData() {
    return window.ReelCalcComparisonData;
  }

  function trackEvent(name, parameters, options) {
    if (window.ReelCalcAnalytics && typeof window.ReelCalcAnalytics.track === "function") {
      return window.ReelCalcAnalytics.track(name, parameters, options);
    }
    window.ReelCalcAnalyticsQueue = Array.isArray(window.ReelCalcAnalyticsQueue)
      ? window.ReelCalcAnalyticsQueue
      : [];
    window.ReelCalcAnalyticsQueue.push({
      name: name,
      parameters: parameters || {},
      options: options || {}
    });
    return true;
  }

  function pageForReel(reel) {
    return reel ? state.pageByReelId.get(reel.id) || null : null;
  }

  function pairId() {
    return state.reelA && state.reelB
      ? comparisonData().normalizedPairId(state.reelA.id, state.reelB.id)
      : "";
  }

  function comparisonClickParameters(clickedReel, position) {
    var otherReel = position === "left" ? state.reelB : state.reelA;
    return {
      comparison_pair_id: pairId(),
      clicked_reel_id: clickedReel ? clickedReel.id : "",
      other_reel_id: otherReel ? otherReel.id : "",
      clicked_position: position
    };
  }

  function trackCompletedComparison(source) {
    var normalizedId = pairId();
    if (!normalizedId || state.completedPairIds.has(normalizedId)) return;
    state.completedPairIds.add(normalizedId);
    trackEvent(
      "reel_comparison_completed",
      comparisonData().comparisonParameters(
        state.reelA,
        state.reelB,
        pageForReel(state.reelA),
        pageForReel(state.reelB),
        source
      ),
      { onceKey: normalizedId }
    );
  }

  function reelTypeKey(reel) {
    return /baitcast/i.test(String(reel && reel.reel_type || "")) ? "baitcasting" : "spinning";
  }

  function reelTypeLabel(reelOrType) {
    var type = typeof reelOrType === "string" ? reelOrType : reelTypeKey(reelOrType);
    return type === "baitcasting" ? "Baitcasting" : "Spinning";
  }

  function reelFamilyName(reel) {
    return String(reel && reel.model || "").trim();
  }

  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function compactSearch(value) {
    return normalizeSearch(value).replace(/\s+/g, "");
  }

  function exactModelLabel(reel) {
    var size = String(reel && reel.size_label || "").trim();
    var sku = String(reel && reel.sku || "").trim();
    if (!sku || compactSearch(size).includes(compactSearch(sku))) return size || sku || displayName(reel);
    return size + " | " + sku;
  }

  function selectorMarkup(side) {
    var id = side.toLowerCase();
    var number = side === "A" ? "1" : "2";
    return [
      '<div class="rc-reel-selector">',
      '<h3 class="rc-reel-selector-title" id="reel-', id, '-title">Reel ', number, "</h3>",
      '<fieldset class="rc-reel-type-fieldset"><legend>Reel type</legend>',
      '<div class="rc-reel-type-switch" role="group" aria-label="Reel ', number, ' type">',
      '<button type="button" data-reel-type="spinning" aria-pressed="false">Spinning</button>',
      '<button type="button" data-reel-type="baitcasting" aria-pressed="false">Baitcasting</button>',
      "</div></fieldset>",
      '<label for="reel-', id, '-input">Search for an exact reel</label>',
      '<div class="rc-reel-combobox">',
      '<input id="reel-', id, '-input" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="reel-', id, '-options" aria-describedby="reel-', id, '-search-help" autocomplete="off" placeholder="Choose a reel type first" disabled>',
      '<div class="rc-reel-options" id="reel-', id, '-options" role="listbox" aria-label="Reel ', number, ' search results" hidden></div>',
      "</div>",
      '<p class="rc-selector-help" id="reel-', id, '-search-help">Choose Spinning or Baitcasting, then search by model, family, size, or model code.</p>',
      '<button class="rc-browse-toggle" id="reel-', id, '-browse-toggle" type="button" aria-expanded="false" aria-controls="reel-', id, '-browse" disabled>Browse by brand</button>',
      '<div class="rc-browse-fields" id="reel-', id, '-browse" hidden>',
      '<label for="reel-', id, '-brand">Brand</label><select id="reel-', id, '-brand" disabled><option value="">Select brand</option></select>',
      '<label for="reel-', id, '-family">Reel family</label><select id="reel-', id, '-family" disabled><option value="">Select family</option></select>',
      '<label for="reel-', id, '-exact">Exact model / size</label><select id="reel-', id, '-exact" disabled><option value="">Select exact model / size</option></select>',
      "</div>",
      '<div class="rc-selected-reel" id="reel-', id, '-selected" hidden>',
      '<div><span>Selected Reel</span><strong id="reel-', id, '-selection"></strong><small id="reel-', id, '-selection-detail"></small></div>',
      '<button type="button" id="reel-', id, '-clear" aria-label="Clear Reel ', number, '">Clear</button>',
      "</div></div>"
    ].join("");
  }

  function mountReelSelector(side) {
    var id = side.toLowerCase();
    var mount = side === "A" ? elements.selectorMountA : elements.selectorMountB;
    mount.innerHTML = selectorMarkup(side);
    var controls = {
      root: mount.querySelector(".rc-reel-selector"),
      input: document.getElementById("reel-" + id + "-input"),
      menu: document.getElementById("reel-" + id + "-options"),
      help: document.getElementById("reel-" + id + "-search-help"),
      typeButtons: Array.from(mount.querySelectorAll("[data-reel-type]")),
      browseToggle: document.getElementById("reel-" + id + "-browse-toggle"),
      browse: document.getElementById("reel-" + id + "-browse"),
      brand: document.getElementById("reel-" + id + "-brand"),
      family: document.getElementById("reel-" + id + "-family"),
      exact: document.getElementById("reel-" + id + "-exact"),
      selected: document.getElementById("reel-" + id + "-selected"),
      selection: document.getElementById("reel-" + id + "-selection"),
      selectionDetail: document.getElementById("reel-" + id + "-selection-detail"),
      clear: document.getElementById("reel-" + id + "-clear")
    };
    state.selectors[side].controls = controls;
    elements["input" + side] = controls.input;
    elements["options" + side] = controls.menu;
    elements["selection" + side] = controls.selection;
  }

  function mountReelSelectors() {
    mountReelSelector("A");
    mountReelSelector("B");
  }

  function comboElements(side) {
    return state.selectors[side].controls;
  }

  function currentReel(side) {
    return state[side === "A" ? "reelA" : "reelB"];
  }

  function optionForReel(reel) {
    return reel ? state.optionByReelId.get(reel.id) || null : null;
  }

  function optionsForType(type) {
    return state.optionsByType.get(type) || [];
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort(function(a, b) {
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }

  function setSelectOptions(select, values, placeholder, selectedValue) {
    select.innerHTML = '<option value="">' + escapeHtml(placeholder) + "</option>" + values.map(function(value) {
      return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + "</option>";
    }).join("");
    select.disabled = !values.length;
    select.value = values.includes(selectedValue) ? selectedValue : "";
  }

  function syncTypeButtons(side) {
    var selector = state.selectors[side];
    var controls = comboElements(side);
    controls.typeButtons.forEach(function(button) {
      var active = button.dataset.reelType === selector.type;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    var ready = Boolean(selector.type);
    controls.input.disabled = !ready;
    controls.browseToggle.disabled = !ready;
    controls.input.placeholder = ready ? "Search model, family, size, or code" : "Choose a reel type first";
    controls.help.textContent = ready
      ? "Search " + reelTypeLabel(selector.type).toLowerCase() + " reels, or browse by brand below."
      : "Choose Spinning or Baitcasting, then search by model, family, size, or model code.";
  }

  function populateBrands(side, selectedValue) {
    var selector = state.selectors[side];
    var brands = uniqueSorted(optionsForType(selector.type).map(function(option) { return option.reel.brand; }));
    setSelectOptions(comboElements(side).brand, brands, "Select brand", selectedValue || selector.brand);
    selector.brand = comboElements(side).brand.value;
  }

  function populateFamilies(side, selectedValue) {
    var selector = state.selectors[side];
    var families = uniqueSorted(optionsForType(selector.type).filter(function(option) {
      return option.reel.brand === selector.brand;
    }).map(function(option) { return option.family; }));
    setSelectOptions(comboElements(side).family, families, "Select family", selectedValue || selector.family);
    selector.family = comboElements(side).family.value;
  }

  function populateExactModels(side, selectedReelId) {
    var selector = state.selectors[side];
    var controls = comboElements(side);
    var exactOptions = optionsForType(selector.type).filter(function(option) {
      return option.reel.brand === selector.brand && option.family === selector.family;
    }).sort(function(a, b) {
      return a.exactLabel.localeCompare(b.exactLabel, undefined, { numeric: true });
    });
    controls.exact.innerHTML = '<option value="">Select exact model / size</option>' + exactOptions.map(function(option) {
      return '<option value="' + escapeHtml(option.reel.id) + '">' + escapeHtml(option.exactLabel) + "</option>";
    }).join("");
    controls.exact.disabled = !exactOptions.length;
    controls.exact.value = exactOptions.some(function(option) { return option.reel.id === selectedReelId; }) ? selectedReelId : "";
  }

  function setSelectedSummary(side, reel) {
    var controls = comboElements(side);
    controls.selected.hidden = !reel;
    controls.selection.textContent = reel ? displayName(reel) : "";
    controls.selectionDetail.textContent = reel
      ? reelTypeLabel(reel) + " | " + exactModelLabel(reel)
      : "";
  }

  function syncSelectorFromReel(side, reel) {
    var selector = state.selectors[side];
    var controls = comboElements(side);
    if (!reel) {
      controls.input.value = "";
      selector.brand = "";
      selector.family = "";
      populateBrands(side, "");
      setSelectOptions(controls.family, [], "Select family", "");
      controls.exact.innerHTML = '<option value="">Select exact model / size</option>';
      controls.exact.disabled = true;
      setSelectedSummary(side, null);
      return;
    }
    var option = optionForReel(reel);
    selector.type = option ? option.type : reelTypeKey(reel);
    selector.brand = reel.brand;
    selector.family = option ? option.family : reelFamilyName(reel);
    syncTypeButtons(side);
    populateBrands(side, selector.brand);
    populateFamilies(side, selector.family);
    populateExactModels(side, reel.id);
    controls.input.value = displayName(reel);
    setSelectedSummary(side, reel);
  }

  function resetSelector(side, clearType) {
    var selector = state.selectors[side];
    var controls = comboElements(side);
    if (clearType) selector.type = "";
    selector.brand = "";
    selector.family = "";
    selector.matches = [];
    selector.highlightedIndex = -1;
    selector.resultLimit = 12;
    controls.input.value = "";
    controls.input.removeAttribute("aria-activedescendant");
    controls.browse.hidden = true;
    controls.browseToggle.setAttribute("aria-expanded", "false");
    controls.browseToggle.textContent = "Browse by brand";
    setSelectedSummary(side, null);
    syncTypeButtons(side);
    populateBrands(side, "");
    setSelectOptions(controls.family, [], "Select family", "");
    controls.exact.innerHTML = '<option value="">Select exact model / size</option>';
    controls.exact.disabled = true;
  }

  function closeReelMenu(side) {
    var selector = state.selectors[side];
    var controls = comboElements(side);
    if (selector.debounceTimer) window.clearTimeout(selector.debounceTimer);
    selector.debounceTimer = null;
    controls.menu.hidden = true;
    controls.input.setAttribute("aria-expanded", "false");
    controls.input.setAttribute("aria-busy", "false");
    controls.input.removeAttribute("aria-activedescendant");
    selector.matches = [];
    selector.highlightedIndex = -1;
  }

  function searchScore(option, query) {
    if (!query.normalized) return 1;
    var fields = option.searchFields;
    if (fields.id === query.normalized || fields.idCompact === query.compact) return 1200;
    if (fields.skuCompact && fields.skuCompact === query.compact) return 1150;
    if (fields.sizeCompact && fields.sizeCompact === query.compact) return 1100;
    if (fields.label === query.normalized) return 1050;
    if (fields.family === query.normalized) return 1000;
    if (fields.label.startsWith(query.normalized)) return 900;
    if (fields.family.startsWith(query.normalized) || fields.sku.startsWith(query.normalized) || fields.size.startsWith(query.normalized)) return 850;
    var tokens = query.normalized.split(" ").filter(Boolean);
    if (tokens.length && tokens.every(function(token) { return fields.all.includes(token); })) {
      return 700 - Math.min(fields.all.indexOf(tokens[0]), 100);
    }
    if (query.compact && fields.allCompact.includes(query.compact)) return 600;
    return -1;
  }

  function rankedSearchResults(side, entered) {
    var selector = state.selectors[side];
    var query = { normalized: normalizeSearch(entered), compact: compactSearch(entered) };
    return optionsForType(selector.type).map(function(option) {
      return { option: option, score: searchScore(option, query) };
    }).filter(function(item) { return item.score >= 0; }).sort(function(a, b) {
      return b.score - a.score || a.option.label.localeCompare(b.option.label, undefined, { numeric: true });
    }).map(function(item) { return item.option; });
  }

  function renderReelMenu(side, entered) {
    var selector = state.selectors[side];
    var controls = comboElements(side);
    if (!selector.type) {
      closeReelMenu(side);
      return;
    }
    selector.lastQuery = entered;
    var matches = rankedSearchResults(side, entered);
    selector.matches = matches;
    selector.highlightedIndex = -1;
    var visible = matches.slice(0, selector.resultLimit);
    var selectedReel = currentReel(side);
    controls.menu.innerHTML = visible.length ? visible.map(function(option, index) {
      var reel = option.reel;
      var details = [reelTypeLabel(option.type), reel.size_label, reel.sku ? "Model " + reel.sku : ""].filter(Boolean).join(" | ");
      return '<button id="reel-' + side.toLowerCase() + '-option-' + index + '" type="button" class="rc-reel-option" role="option" data-reel-id="' + escapeHtml(reel.id) + '" aria-selected="' +
        String(Boolean(selectedReel && selectedReel.id === reel.id)) + '"><span>' + escapeHtml(displayName(reel)) +
        '</span><small>' + escapeHtml(details) + "</small></button>";
    }).join("") : '<p class="rc-no-reel-results">No matching ' + escapeHtml(reelTypeLabel(selector.type).toLowerCase()) + ' reels found. Try a family, size, or model code.</p>';
    if (matches.length > visible.length) {
      controls.menu.insertAdjacentHTML("beforeend", '<button type="button" class="rc-show-more-reels">Show 12 more</button>');
    }
    controls.menu.dataset.query = entered;
    controls.menu.hidden = false;
    controls.input.setAttribute("aria-expanded", "true");
    controls.input.setAttribute("aria-busy", "false");
  }

  function openReelMenu(side, showAll) {
    var controls = comboElements(side);
    var selected = currentReel(side);
    var entered = controls.input.value.trim();
    var query = showAll || (selected && entered === displayName(selected)) ? "" : entered;
    state.selectors[side].resultLimit = 12;
    renderReelMenu(side, query);
  }

  function debounceReelSearch(side) {
    var selector = state.selectors[side];
    var controls = comboElements(side);
    if (selector.debounceTimer) window.clearTimeout(selector.debounceTimer);
    controls.input.setAttribute("aria-busy", "true");
    selector.debounceTimer = window.setTimeout(function() {
      selector.debounceTimer = null;
      selector.resultLimit = 12;
      renderReelMenu(side, controls.input.value);
    }, 100);
  }

  function highlightReelOption(side, nextIndex) {
    var selector = state.selectors[side];
    var controls = comboElements(side);
    var buttons = Array.from(controls.menu.querySelectorAll(".rc-reel-option"));
    if (!buttons.length) return;
    var index = Math.max(0, Math.min(nextIndex, buttons.length - 1));
    selector.highlightedIndex = index;
    buttons.forEach(function(button, buttonIndex) {
      button.classList.toggle("is-highlighted", buttonIndex === index);
    });
    controls.input.setAttribute("aria-activedescendant", buttons[index].id);
    buttons[index].scrollIntoView({ block: "nearest" });
  }

  function chooseReel(side, reel, method) {
    if (!reel) return;
    var current = currentReel(side);
    state[side === "A" ? "reelA" : "reelB"] = reel;
    syncSelectorFromReel(side, reel);
    closeReelMenu(side);
    if (!current || current.id !== reel.id) {
      var parameters = comparisonData().selectorParameters(reel, pageForReel(reel), side === "A" ? "left" : "right");
      parameters.selection_method = method === "browse" ? "browse" : "search";
      trackEvent(side === "A" ? "reel_comparison_reel_1_selected" : "reel_comparison_reel_2_selected", parameters);
    }
    renderComparison({ historyMode: "push", comparisonSource: "manual_selection" });
  }

  function clearReel(side, options) {
    var settings = options || {};
    var previous = currentReel(side);
    state[side === "A" ? "reelA" : "reelB"] = null;
    resetSelector(side, !settings.preserveType);
    closeReelMenu(side);
    renderComparison({ historyMode: settings.historyMode || "push", comparisonSource: "other" });
    if (previous && settings.track !== false) {
      trackEvent("reel_comparison_reel_cleared", {
        reel_id: previous.id,
        selector_position: side === "A" ? "left" : "right"
      });
    }
  }

  function reelHeading(reel, page) {
    return [
      '<div class="rc-reel-image-wrap">',
      '<img class="rc-reel-image" src="', escapeHtml(page.imageUrl), '" alt="', escapeHtml(page.imageAlt), '">',
      "</div>",
      '<p class="rc-reel-brand">', escapeHtml(reel.brand), "</p>",
      "<h3>", escapeHtml(reel.model + " " + reel.size_label), "</h3>",
      '<p class="rc-reel-sku">Model ', escapeHtml(reel.sku || "not listed"), "</p>",
      '<p class="rc-reel-msrp"><span>MSRP</span><strong>', escapeHtml(formatMoney(reel.msrp_usd)), "</strong></p>"
    ].join("");
  }

  function comparisonTable(rows, reelA, reelB) {
    var html = [
      '<div class="rc-comparison-row is-header">',
      "<div>Specification</div>",
      "<div>", escapeHtml(displayName(reelA)), "</div>",
      "<div>", escapeHtml(displayName(reelB)), "</div>",
      "</div>"
    ];
    rows.forEach(function(row) {
      html.push(
        '<div class="rc-comparison-row">',
        '<div class="rc-row-label">', escapeHtml(row.label), "</div>",
        "<div>", row.a, "</div>",
        "<div>", row.b, "</div>",
        "</div>"
      );
    });
    return html.join("");
  }

  function textValue(value) {
    return escapeHtml(value || "Not published");
  }

  function lineProductLabel(line) {
    return [line.brand, line.model].filter(Boolean).join(" ");
  }

  function lineLabel(line) {
    return line ? lineProductLabel(line) + " " + trimNumber(line.lb, 1) + " lb" : "Choose a line";
  }

  function roleElements(role) {
    return role === "main"
      ? {
          product: elements.mainLineProduct,
          menu: elements.mainLineOptions,
          strength: elements.mainLineStrength,
          detail: elements.mainLineDetail
        }
      : {
          product: elements.backingLineProduct,
          menu: elements.backingLineOptions,
          strength: elements.backingLineStrength,
          detail: elements.backingLineDetail
        };
  }

  function refreshLineRole(role, preferredLineId) {
    var selector = window.ReelCalcLineSelector;
    var roleState = state.lineRoles[role];
    var controls = roleElements(role);
    closeLineMenu(role);

    var selected = preferredLineId
      ? state.lines.find(function(line) { return line.id === preferredLineId && line.material === roleState.material; })
      : roleState.line;
    if (!selected || selected.material !== roleState.material) {
      selected = null;
    }
    roleState.line = selected;
    controls.product.value = selected ? lineProductLabel(selected) : "";
    refreshLineStrengths(role, selected ? selector.productKey(selected) : "", selected ? selected.id : "");

    document.querySelectorAll('.rc-material-button[data-line-role="' + role + '"]').forEach(function(button) {
      button.classList.toggle("is-active", button.dataset.material === roleState.material);
    });
  }

  function refreshLineStrengths(role, productKey, preferredLineId) {
    var selector = window.ReelCalcLineSelector;
    var roleState = state.lineRoles[role];
    var controls = roleElements(role);
    var product = selector.productsFor(state.lines, roleState.material).find(function(item) {
      return item.key === productKey;
    });
    var strengths = selector.strengthsFor(state.lines, product);
    var selected = strengths.find(function(line) { return line.id === preferredLineId; }) || null;
    roleState.line = selected;

    controls.strength.innerHTML = strengths.length
      ? '<option value=""' + (selected ? "" : " selected") + '>Choose strength</option>' + strengths.map(function(line) {
          return '<option value="' + escapeHtml(line.id) + '"' + (selected && line.id === selected.id ? " selected" : "") + ">" +
            escapeHtml(trimNumber(line.lb, 1) + " lb") + "</option>";
        }).join("")
      : '<option value="">Choose a line first</option>';
    controls.strength.disabled = !strengths.length;
    controls.detail.textContent = selected
      ? "Published diameter: " + trimNumber(selected.dia_in, 4) + " in (" + trimNumber(selected.dia_mm || selected.dia_in * 25.4, 3) + " mm)"
      : "Choose an exact line and strength.";
    renderLineFit();
  }

  function closeLineMenu(role) {
    var roleState = state.lineRoles[role];
    var controls = roleElements(role);
    controls.menu.hidden = true;
    controls.product.setAttribute("aria-expanded", "false");
    controls.product.removeAttribute("aria-activedescendant");
    roleState.matches = [];
    roleState.highlightedIndex = -1;
  }

  function renderLineMenu(role, entered) {
    var selector = window.ReelCalcLineSelector;
    var roleState = state.lineRoles[role];
    var controls = roleElements(role);
    if (controls.product.disabled) {
      closeLineMenu(role);
      return;
    }
    var matches = selector.searchLines(state.lines, roleState.material, entered);
    roleState.matches = matches;
    roleState.highlightedIndex = -1;
    var visible = matches.slice(0, roleState.resultLimit);
    controls.menu.innerHTML = visible.length ? visible.map(function(line, index) {
      var selected = roleState.line && roleState.line.id === line.id;
      var metricDiameter = line.dia_mm || line.dia_in * 25.4;
      return '<button id="' + role + '-line-option-' + index + '" type="button" class="rc-line-option" role="option" data-line-id="' +
        escapeHtml(line.id) + '" aria-selected="' + String(Boolean(selected)) + '"><span>' +
        escapeHtml(lineProductLabel(line)) + '</span><small>' +
        escapeHtml(trimNumber(line.lb, 1) + " lb | " + trimNumber(line.dia_in, 4) + " in | " + trimNumber(metricDiameter, 3) + " mm") +
        "</small></button>";
    }).join("") : '<p class="rc-no-line-results">No matching ' + escapeHtml(roleState.material.toLowerCase()) + ' lines found. Try a brand, model, or pound test.</p>';
    if (matches.length > visible.length) {
      controls.menu.insertAdjacentHTML("beforeend", '<button type="button" class="rc-show-more-lines">Show 20 more</button>');
    }
    controls.menu.hidden = false;
    controls.product.setAttribute("aria-expanded", "true");
  }

  function openLineMenu(role, showAll) {
    var roleState = state.lineRoles[role];
    var controls = roleElements(role);
    var selectedLabel = roleState.line ? lineProductLabel(roleState.line) : "";
    var entered = controls.product.value.trim();
    roleState.resultLimit = 20;
    renderLineMenu(role, showAll || (selectedLabel && entered === selectedLabel) ? "" : entered);
  }

  function highlightLineOption(role, nextIndex) {
    var roleState = state.lineRoles[role];
    var controls = roleElements(role);
    var buttons = Array.from(controls.menu.querySelectorAll(".rc-line-option"));
    if (!buttons.length) return;
    var index = Math.max(0, Math.min(nextIndex, buttons.length - 1));
    roleState.highlightedIndex = index;
    buttons.forEach(function(button, buttonIndex) {
      button.classList.toggle("is-highlighted", buttonIndex === index);
    });
    controls.product.setAttribute("aria-activedescendant", buttons[index].id);
    buttons[index].scrollIntoView({ block: "nearest" });
  }

  function chooseExactLine(role, line) {
    if (!line) return;
    var selector = window.ReelCalcLineSelector;
    var controls = roleElements(role);
    state.lineRoles[role].line = line;
    controls.product.value = lineProductLabel(line);
    refreshLineStrengths(role, selector.productKey(line), line.id);
    closeLineMenu(role);
    updateUrl("replace");
  }

  function setBackingMode(enabled) {
    state.backingEnabled = Boolean(enabled);
    document.querySelectorAll(".rc-mode-button").forEach(function(button) {
      button.classList.toggle("is-active", button.dataset.backingMode === (state.backingEnabled ? "on" : "off"));
    });
    var backingChooser = document.querySelector('.rc-line-chooser[data-line-role="backing"]');
    var amountControl = document.querySelector(".rc-line-amount");
    backingChooser.classList.toggle("is-disabled", !state.backingEnabled);
    amountControl.classList.toggle("is-disabled", !state.backingEnabled);
    backingChooser.setAttribute("aria-disabled", String(!state.backingEnabled));
    amountControl.setAttribute("aria-disabled", String(!state.backingEnabled));
    roleElements("backing").product.disabled = !state.backingEnabled;
    roleElements("backing").strength.disabled = !state.backingEnabled;
    elements.mainLineYards.disabled = !state.backingEnabled;
    document.querySelectorAll('.rc-material-button[data-line-role="backing"]').forEach(function(button) {
      button.disabled = !state.backingEnabled;
    });
    if (!state.backingEnabled) closeLineMenu("backing");
    elements.backingModeNote.textContent = state.backingEnabled
      ? "Compare a chosen main-line amount with backing underneath it."
      : "Compare how much main line fills each reel without backing.";
    renderLineFit();
  }

  function numericDifference(config, reelA, reelB) {
    var a = Number(reelA[config.key]);
    var b = Number(reelB[config.key]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return { label: config.label, value: "Published data is incomplete" };
    }
    if (Math.abs(a - b) < 0.001) {
      return { label: config.label, value: "Same published " + config.equalLabel };
    }
    var chosen = config.lowerWins ? (a < b ? reelA : reelB) : (a > b ? reelA : reelB);
    var difference = Math.abs(a - b);
    return {
      label: config.label,
      value: displayName(chosen) + " by " + trimNumber(difference, 1) + " " + config.unit
    };
  }

  function renderDifferences(reelA, reelB) {
    var items = [
      numericDifference({
        key: "weight_oz",
        label: "Lighter reel",
        equalLabel: "weight",
        unit: "oz",
        lowerWins: true
      }, reelA, reelB),
      numericDifference({
        key: "line_retrieve_in",
        label: "More line pickup",
        equalLabel: "retrieve rate",
        unit: "in/turn",
        lowerWins: false
      }, reelA, reelB),
      numericDifference({
        key: "max_drag_lb",
        label: "Higher maximum drag",
        equalLabel: "maximum drag",
        unit: "lb",
        lowerWins: false
      }, reelA, reelB)
    ];
    elements.differences.innerHTML = items.map(function(item) {
      return '<div class="rc-difference-item"><span class="rc-difference-label">' +
        escapeHtml(item.label) + '</span><span class="rc-difference-value">' +
        escapeHtml(item.value) + "</span></div>";
    }).join("");
  }

  function yardsLabel(value, decimals) {
    return Number.isFinite(Number(value)) ? trimNumber(value, decimals == null ? 1 : decimals) + " yd" : "Unavailable";
  }

  function yardsRangeLabel(range) {
    return trimNumber(range.minimumYards, 0) + "-" + trimNumber(range.maximumYards, 0) + " yd";
  }

  function turnsLabel(turns) {
    if (!turns || !(turns.approximateTurns >= 0)) return "Not published";
    return '<span class="rc-fit-primary">About ' + escapeHtml(trimNumber(turns.approximateTurns, 0)) +
      ' turns</span><span class="rc-value-note">Approximate range: ' +
      escapeHtml(trimNumber(turns.rangeMin, 0) + "-" + trimNumber(turns.rangeMax, 0) + " turns") + "</span>";
  }

  function lineStrengthWarning(reel, line) {
    if (!line || line.material !== "Braid") return "";
    var options = window.ReelCalcCore.publishedBraidCapacityOptions(reel);
    var strength = Number(line.lb);
    if (!options.length || !(strength > 0)) return "";
    var strengths = options.map(function(option) { return Number(option.lb); }).filter(function(value) { return value > 0; });
    if (!strengths.length) return "";
    var minimum = Math.min.apply(Math, strengths);
    var maximum = Math.max.apply(Math, strengths);
    if (strength >= minimum && strength <= maximum) return "";
    return "This line strength is outside this reel's published braid ratings. Treat the capacity as an estimate, not a line recommendation.";
  }

  function lineFitForReel(reel, mainLine, backingLine, desiredYards) {
    var core = window.ReelCalcCore;
    var basis = core.capacityBasisForActualLine(reel, mainLine, state.lines);
    var capacity = core.calculateFullSpoolCapacity(reel, mainLine, { lineCatalog: state.lines });
    var capacityRange = mainLine.material === "Braid"
      ? core.calculateActualLineBraidCapacityRange(reel, mainLine, state.lines)
      : null;
    if (!state.backingEnabled) {
      var fullSpoolRetrieve = Number(reel.line_retrieve_in);
      return {
        basis: basis,
        capacity: capacity,
        capacityRange: capacityRange,
        lineStrengthWarning: lineStrengthWarning(reel, mainLine),
        backing: null,
        backingRange: null,
        backingEnabled: false,
        overCapacity: !(capacity > 0),
        mainTurns: capacity > 0 && fullSpoolRetrieve > 0 ? core.calculateHandleTurns(capacity, fullSpoolRetrieve) : null,
        backingTurns: null
      };
    }
    var backing = core.calculateActualLineCalibratedBacking(reel, mainLine, desiredYards, backingLine, state.lines);
    var backingRange = mainLine.material === "Braid"
      ? core.calculateActualLineCalibratedBackingRange(reel, mainLine, desiredYards, backingLine, state.lines)
      : null;
    var overCapacity = !backing || backing.overCapacity || !(capacity > 0);
    var retrieve = Number(reel.line_retrieve_in);
    return {
      basis: basis,
      capacity: capacity,
      capacityRange: capacityRange,
      lineStrengthWarning: lineStrengthWarning(reel, mainLine),
      backing: backing,
      backingRange: backingRange,
      backingEnabled: true,
      overCapacity: overCapacity,
      mainTurns: !overCapacity && retrieve > 0 ? core.calculateHandleTurns(desiredYards, retrieve) : null,
      backingTurns: !overCapacity && backing && retrieve > 0 ? core.calculateHandleTurns(backing.backingYards, retrieve) : null
    };
  }

  function capacityFitHtml(fit) {
    if (!(fit.capacity > 0)) return '<span class="rc-fit-warning">Capacity could not be calculated</span>';
    var html = '<span class="rc-fit-primary">' + escapeHtml(yardsLabel(fit.capacity, 0)) + "</span>";
    if (fit.capacityRange) {
      html += '<span class="rc-value-note">Expected real-world range: ' + escapeHtml(yardsRangeLabel(fit.capacityRange)) + "</span>";
    }
    if (fit.lineStrengthWarning) {
      html += '<span class="rc-value-note rc-fit-warning">' + escapeHtml(fit.lineStrengthWarning) + "</span>";
    }
    return html;
  }

  function backingFitHtml(fit, desiredYards) {
    if (!fit.backingEnabled) {
      return '<span class="rc-fit-primary">No backing</span><span class="rc-value-note">The full spool estimate is main line only.</span>';
    }
    if (fit.overCapacity) {
      return '<span class="rc-fit-warning">' + escapeHtml(trimNumber(desiredYards, 0)) +
        ' yd exceeds the best full-spool estimate</span><span class="rc-value-note">Reduce the main-line amount before adding backing.</span>';
    }
    var html = '<span class="rc-fit-primary">' + escapeHtml(yardsLabel(fit.backing.backingYards, 1)) + "</span>";
    if (fit.backingRange) {
      html += '<span class="rc-value-note">Expected real-world range: ' + escapeHtml(yardsRangeLabel(fit.backingRange)) + "</span>";
    }
    if (fit.backing.backingYards < 0.5) {
      html += '<span class="rc-value-note">The selected main-line amount nearly fills this reel.</span>';
    }
    return html;
  }

  function basisHtml(fit) {
    if (!fit.basis) return "Capacity basis unavailable";
    var note = fit.basis.label;
    if (fit.basis.fallback) {
      note += ". This reel does not have a usable published braid rating, so ReelCalc is using its mono capacity as a fallback.";
    }
    return '<span class="rc-fit-basis">' + escapeHtml(note) + "</span>";
  }

  function backingTurnsHtml(fit) {
    if (!fit.backingEnabled) return textValue("No backing used");
    if (fit.overCapacity) return textValue("Not applicable");
    if (fit.backing && fit.backing.backingYards < 0.5) return textValue("No backing needed");
    return turnsLabel(fit.backingTurns);
  }

  function renderLineFit() {
    var mainLine = state.lineRoles.main.line;
    var backingLine = state.lineRoles.backing.line;
    var desiredYards = Number(elements.mainLineYards.value);
    if (!state.reelA || !state.reelB || !mainLine || (state.backingEnabled && (!backingLine || !(desiredYards > 0)))) {
      elements.lineFitSummary.textContent = state.backingEnabled
        ? "Choose both lines and enter a main-line amount to compare line fit."
        : "Choose a main line to compare full-spool capacity.";
      elements.lineFitComparison.innerHTML = "";
      return;
    }

    var fitA = lineFitForReel(state.reelA, mainLine, backingLine, desiredYards);
    var fitB = lineFitForReel(state.reelB, mainLine, backingLine, desiredYards);
    elements.lineFitSummary.innerHTML = state.backingEnabled
      ? "Comparing <strong>" + escapeHtml(lineLabel(mainLine)) + "</strong> over <strong>" +
        escapeHtml(lineLabel(backingLine)) + "</strong>, with <strong>" + escapeHtml(trimNumber(desiredYards, 0)) +
        " yards of main line</strong>."
      : "Comparing a full spool of <strong>" + escapeHtml(lineLabel(mainLine)) + "</strong> with no backing.";
    elements.lineFitComparison.innerHTML = comparisonTable([
      { label: "Full spool estimate", a: capacityFitHtml(fitA), b: capacityFitHtml(fitB) },
      { label: "Backing needed", a: backingFitHtml(fitA, desiredYards), b: backingFitHtml(fitB, desiredYards) },
      { label: "Main-line handle turns", a: fitA.overCapacity ? textValue(state.backingEnabled ? "Reduce main-line amount" : "Unavailable") : turnsLabel(fitA.mainTurns), b: fitB.overCapacity ? textValue(state.backingEnabled ? "Reduce main-line amount" : "Unavailable") : turnsLabel(fitB.mainTurns) },
      { label: "Backing handle turns", a: backingTurnsHtml(fitA), b: backingTurnsHtml(fitB) },
      { label: "Capacity basis", a: basisHtml(fitA), b: basisHtml(fitB) }
    ], state.reelA, state.reelB);
  }

  function allowedAffiliateUrl(value, retailer) {
    try {
      var url = new URL(String(value || ""));
      var host = url.hostname.toLowerCase();
      var allowedHosts = Array.isArray(retailer && retailer.allowedHosts) ? retailer.allowedHosts : [];
      var allowed = allowedHosts.some(function(item) {
        var expected = String(item || "").toLowerCase();
        return expected && (host === expected || host.endsWith("." + expected));
      });
      return url.protocol === "https:" && allowed ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function reelAffiliateOffer(reel) {
    var data = state.affiliateData;
    var mapping = data && data.reels ? data.reels[reel.id] : null;
    var priority = data && Array.isArray(data.retailerPriority) ? data.retailerPriority : [];
    if (!mapping) return null;
    for (var index = 0; index < priority.length; index += 1) {
      var retailerId = priority[index];
      var retailer = data.retailers && data.retailers[retailerId];
      var offer = mapping.offers && mapping.offers[retailerId] ? mapping.offers[retailerId].reel : null;
      var url = retailer && offer ? allowedAffiliateUrl(offer.url, retailer) : "";
      if (!url) continue;
      var isSearch = offer.matchType === "search";
      return {
        url: url,
        label: offer.label || (isSearch ? retailer.searchLabel : retailer.directLabel) || "Check Current Price on " + retailer.name,
        disclosure: [data.genericDisclosure, retailer.disclosure].filter(Boolean).join(" "),
        matchType: isSearch ? "search" : "exact"
      };
    }
    return null;
  }

  function sourceColumn(reel, page, position) {
    var pageUrl = SITE_BASE + page.path;
    var wizardUrl = SITE_BASE + "/reelcalc-wizard?reel=" + encodeURIComponent(reel.id);
    var affiliate = reelAffiliateOffer(reel);
    var attributes = ' data-reel-id="' + escapeHtml(reel.id) + '" data-position="' + position + '"';
    return [
      '<article class="rc-source-column">',
      "<h3>", escapeHtml(displayName(reel)), "</h3>",
      "<p>See the complete line-capacity guide, continue with this reel preloaded in the Setup Wizard, or check its current price.</p>",
      '<div class="rc-action-links">',
      '<a class="rc-action-link" data-comparison-action="reel-page"', attributes, ' href="', escapeHtml(pageUrl), '" target="_blank" rel="noopener">View full reel guide</a>',
      '<a class="rc-action-link is-secondary" data-comparison-action="wizard"', attributes, ' href="', escapeHtml(wizardUrl), '" target="_blank" rel="noopener">Open in Setup Wizard</a>',
      affiliate ? '<a class="rc-action-link is-amazon" data-comparison-action="amazon"' + attributes + ' data-link-type="' + affiliate.matchType + '" href="' + escapeHtml(affiliate.url) + '" target="_blank" rel="sponsored nofollow noopener">' + escapeHtml(affiliate.label) + "</a>" : "",
      "</div>",
      affiliate ? '<p class="rc-affiliate-disclosure">' + escapeHtml(affiliate.disclosure) + "</p>" : "",
      "</article>"
    ].join("");
  }

  function renderComparison(options) {
    var settings = options || {};
    var reelA = state.reelA;
    var reelB = state.reelB;
    var hasBothReels = Boolean(reelA && reelB);
    elements.swap.disabled = !hasBothReels;
    elements.copy.disabled = !hasBothReels;
    elements.reset.disabled = !reelA && !reelB;
    if (settings.historyMode && settings.historyMode !== "none") {
      updateUrl(settings.historyMode);
    }
    if (!reelA || !reelB) {
      elements.results.hidden = true;
      setStatus("Choose two exact reels to compare.", false);
      return;
    }
    if (reelA.id === reelB.id) {
      elements.results.hidden = true;
      setStatus("Choose two different reels for a side-by-side comparison.", true);
      return;
    }

    var pageA = state.pageByReelId.get(reelA.id);
    var pageB = state.pageByReelId.get(reelB.id);
    elements.headingA.innerHTML = reelHeading(reelA, pageA);
    elements.headingB.innerHTML = reelHeading(reelB, pageB);
    renderDifferences(reelA, reelB);

    elements.specifications.innerHTML = comparisonTable([
      { label: "Reel size", a: textValue(reelA.size_label), b: textValue(reelB.size_label) },
      { label: "Reel type", a: textValue(humanizeReelType(reelA.reel_type)), b: textValue(humanizeReelType(reelB.reel_type)) },
      { label: "Weight", a: textValue(measurement(reelA.weight_oz, 1, " oz")), b: textValue(measurement(reelB.weight_oz, 1, " oz")) },
      { label: "Gear ratio", a: textValue(gearRatio(reelA.gear_ratio)), b: textValue(gearRatio(reelB.gear_ratio)) },
      { label: "Retrieve", a: textValue(measurement(reelA.line_retrieve_in, 1, " in/turn")), b: textValue(measurement(reelB.line_retrieve_in, 1, " in/turn")) },
      { label: "Maximum drag", a: textValue(measurement(reelA.max_drag_lb, 1, " lb")), b: textValue(measurement(reelB.max_drag_lb, 1, " lb")) },
      { label: "Bearings", a: textValue(reelA.bearings), b: textValue(reelB.bearings) },
      { label: "MSRP", a: textValue(formatMoney(reelA.msrp_usd)), b: textValue(formatMoney(reelB.msrp_usd)) }
    ], reelA, reelB);
    if (elements.summary) {
      elements.summary.innerHTML = '<h3>What the Specs Show</h3><p>' +
        escapeHtml(comparisonData().comparisonSummary(reelA, reelB)) + "</p>";
    }

    elements.capacities.innerHTML = comparisonTable([
      { label: "Mono capacity", a: textValue(monoCapacity(reelA)), b: textValue(monoCapacity(reelB)) },
      { label: "Braid capacity", a: textValue(braidCapacity(reelA)), b: textValue(braidCapacity(reelB)) },
      {
        label: "Primary rating used",
        a: textValue(measurement(reelA.rated_line_lb, 1, " lb") + " / " + measurement(reelA.capacity_yards, 0, " yd")),
        b: textValue(measurement(reelB.rated_line_lb, 1, " lb") + " / " + measurement(reelB.capacity_yards, 0, " yd"))
      }
    ], reelA, reelB);
    renderLineFit();

    elements.setups.innerHTML = comparisonTable([
      { label: "Recommended braid", a: textValue(reelA.reelcalc_recommended_braid), b: textValue(reelB.reelcalc_recommended_braid) },
      { label: "Mono / fluoro", a: textValue(reelA.reelcalc_recommended_mono_fluoro), b: textValue(reelB.reelcalc_recommended_mono_fluoro) },
      { label: "Best fit", a: textValue(reelA.reelcalc_use_case), b: textValue(reelB.reelcalc_use_case) }
    ], reelA, reelB);

    elements.sources.innerHTML = sourceColumn(reelA, pageA, "left") + sourceColumn(reelB, pageB, "right");
    elements.results.hidden = false;
    setStatus("", false);
    trackCompletedComparison(settings.comparisonSource || "other");
  }

  function applyComparisonParameters(url) {
    if (state.reelA) url.searchParams.set("reel1", state.reelA.id);
    else url.searchParams.delete("reel1");
    if (state.reelB) url.searchParams.set("reel2", state.reelB.id);
    else url.searchParams.delete("reel2");
    if (state.lineRoles.main.line) url.searchParams.set("mainLine", state.lineRoles.main.line.id);
    else url.searchParams.delete("mainLine");
    if (state.lineRoles.backing.line) url.searchParams.set("backingLine", state.lineRoles.backing.line.id);
    else url.searchParams.delete("backingLine");
    url.searchParams.set("backing", state.backingEnabled ? "on" : "off");
    var desiredYards = Number(elements.mainLineYards.value);
    if (desiredYards > 0) url.searchParams.set("mainYards", trimNumber(desiredYards, 1));
  }

  function updateUrl(mode) {
    if (state.restoringHistory) return;
    var url = new URL(window.location.href);
    applyComparisonParameters(url);
    if (url.href === window.location.href) return;
    var method = mode === "push" ? "pushState" : "replaceState";
    window.history[method]({ reelcalcComparison: true }, "", url);
  }

  function comparisonShareUrl() {
    var url = new URL(SITE_BASE + "/reel-comparison");
    applyComparisonParameters(url);
    return url.href;
  }

  function legacyCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    var copied = false;
    try {
      copied = Boolean(document.execCommand && document.execCommand("copy"));
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(area);
    return copied;
  }

  function markComparisonCopied() {
    setStatus("Comparison link copied.", false);
    trackEvent("reel_comparison_link_copied", {
      comparison_pair_id: pairId(),
      reel_1_id: state.reelA.id,
      reel_2_id: state.reelB.id
    });
  }

  function copyComparisonLink() {
    if (!state.reelA || !state.reelB || state.reelA.id === state.reelB.id) {
      setStatus("Choose two different reels before copying the comparison link.", true);
      return;
    }
    updateUrl("replace");
    var url = comparisonShareUrl();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function() {
        markComparisonCopied();
      }).catch(function() {
        if (legacyCopy(url)) markComparisonCopied();
        else setStatus("Copy was unavailable. Use the link in the address bar.", true);
      });
    } else if (legacyCopy(url)) {
      markComparisonCopied();
    } else {
      setStatus("Copy was unavailable. Use the link in the address bar.", true);
    }
  }

  function resetComparison() {
    var previousPairId = pairId();
    var previousA = state.reelA;
    var previousB = state.reelB;
    state.reelA = null;
    state.reelB = null;
    resetSelector("A", true);
    resetSelector("B", true);
    closeReelMenu("A");
    closeReelMenu("B");

    var url = new URL(window.location.href);
    ["reel1", "reel2", "mainLine", "backingLine", "backing", "mainYards"].forEach(function(key) {
      url.searchParams.delete(key);
    });
    window.history.pushState({ reelcalcComparison: true }, "", url);
    chooseLinesFromParams(url.searchParams);
    renderComparison({ historyMode: "none", comparisonSource: "other" });
    if (previousA || previousB) {
      trackEvent("reel_comparison_reset", {
        comparison_pair_id: previousPairId,
        reel_1_id: previousA ? previousA.id : "",
        reel_2_id: previousB ? previousB.id : ""
      });
    }
  }

  function setSelectorType(side, type) {
    var selector = state.selectors[side];
    var controls = comboElements(side);
    var selected = currentReel(side);
    var incompatible = selected && reelTypeKey(selected) !== type;
    closeReelMenu(side);
    selector.type = type;
    if (incompatible) {
      clearReel(side, { preserveType: true, historyMode: "push" });
    } else if (selected) {
      syncSelectorFromReel(side, selected);
    } else {
      resetSelector(side, false);
    }
    syncTypeButtons(side);
  }

  function installReelCombo(side) {
    var selector = state.selectors[side];
    var controls = comboElements(side);

    controls.typeButtons.forEach(function(button) {
      button.addEventListener("click", function() {
        setSelectorType(side, button.dataset.reelType);
      });
    });

    controls.input.addEventListener("focus", function() {
      var selected = currentReel(side);
      if (selected && controls.input.value === displayName(selected)) controls.input.select();
      openReelMenu(side, true);
    });
    controls.input.addEventListener("click", function() {
      var selected = currentReel(side);
      if (selected && controls.input.value === displayName(selected)) controls.input.select();
      openReelMenu(side, true);
    });
    controls.input.addEventListener("input", function() {
      debounceReelSearch(side);
    });
    controls.input.addEventListener("keydown", function(event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (controls.menu.hidden) openReelMenu(side, false);
        var direction = event.key === "ArrowDown" ? 1 : -1;
        var visibleCount = controls.menu.querySelectorAll(".rc-reel-option").length;
        var startingIndex = selector.highlightedIndex < 0
          ? (direction > 0 ? 0 : visibleCount - 1)
          : selector.highlightedIndex + direction;
        highlightReelOption(side, startingIndex);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        var highlighted = selector.matches[selector.highlightedIndex];
        if (highlighted) chooseReel(side, highlighted.reel, "search");
        else if (selector.matches.length === 1) chooseReel(side, selector.matches[0].reel, "search");
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        var selected = currentReel(side);
        controls.input.value = selected ? displayName(selected) : controls.input.value;
        closeReelMenu(side);
      }
    });
    controls.input.addEventListener("blur", function() {
      window.setTimeout(function() {
        var activeElement = document.activeElement;
        if (activeElement !== controls.input && !controls.menu.contains(activeElement)) {
          var selected = currentReel(side);
          if (selected) controls.input.value = displayName(selected);
          closeReelMenu(side);
        }
      }, 140);
    });
    controls.menu.addEventListener("mousedown", function(event) {
      if (event.target.closest("button")) event.preventDefault();
    });
    controls.menu.addEventListener("click", function(event) {
      var showMore = event.target.closest(".rc-show-more-reels");
      if (showMore) {
        selector.resultLimit += 12;
        renderReelMenu(side, selector.lastQuery);
        controls.input.focus();
        return;
      }
      var button = event.target.closest(".rc-reel-option");
      if (!button) return;
      chooseReel(side, state.reelById.get(button.dataset.reelId), "search");
    });

    controls.browseToggle.addEventListener("click", function() {
      var expanded = controls.browseToggle.getAttribute("aria-expanded") === "true";
      controls.browseToggle.setAttribute("aria-expanded", String(!expanded));
      controls.browseToggle.textContent = expanded ? "Browse by brand" : "Hide browse options";
      controls.browse.hidden = expanded;
      if (!expanded) controls.brand.focus();
    });

    controls.brand.addEventListener("change", function() {
      var value = controls.brand.value;
      var selected = currentReel(side);
      if (selected && selected.brand !== value) clearReel(side, { preserveType: true, historyMode: "push" });
      selector.brand = value;
      controls.brand.value = value;
      selector.family = "";
      populateFamilies(side, "");
      populateExactModels(side, "");
    });
    controls.family.addEventListener("change", function() {
      var value = controls.family.value;
      var selected = currentReel(side);
      var selectedOption = optionForReel(selected);
      if (selected && selectedOption && selectedOption.family !== value) clearReel(side, { preserveType: true, historyMode: "push" });
      selector.family = value;
      controls.family.value = value;
      populateExactModels(side, "");
    });
    controls.exact.addEventListener("change", function() {
      var reel = state.reelById.get(controls.exact.value) || null;
      if (reel) chooseReel(side, reel, "browse");
    });
    controls.clear.addEventListener("click", function() {
      clearReel(side, { preserveType: true, historyMode: "push" });
      controls.input.focus();
    });
  }

  function installEvents() {
    installReelCombo("A");
    installReelCombo("B");
    document.addEventListener("mousedown", function(event) {
      if (!event.target.closest(".rc-reel-combobox")) {
        closeReelMenu("A");
        closeReelMenu("B");
      }
      if (!event.target.closest(".rc-line-combobox")) {
        closeLineMenu("main");
        closeLineMenu("backing");
      }
    });
    elements.swap.addEventListener("click", function() {
      if (!state.reelA || !state.reelB) return;
      var oldA = state.reelA;
      state.reelA = state.reelB;
      state.reelB = oldA;
      syncSelectorFromReel("A", state.reelA);
      syncSelectorFromReel("B", state.reelB);
      renderComparison({ historyMode: "push", comparisonSource: "other" });
    });
    elements.copy.addEventListener("click", copyComparisonLink);
    elements.reset.addEventListener("click", resetComparison);

    elements.sources.addEventListener("click", function(event) {
      var link = event.target.closest("[data-comparison-action]");
      if (!link) return;
      var clickedReel = state.reelById.get(link.dataset.reelId) || null;
      var position = link.dataset.position === "left" ? "left" : "right";
      var action = link.dataset.comparisonAction;
      if (action === "reel-page") {
        trackEvent("reel_comparison_reel_page_clicked", comparisonClickParameters(clickedReel, position));
      } else if (action === "wizard") {
        trackEvent("reel_comparison_wizard_clicked", {
          comparison_pair_id: pairId(),
          reel_id: clickedReel ? clickedReel.id : ""
        });
      } else if (action === "amazon") {
        trackEvent("reel_comparison_amazon_clicked", {
          comparison_pair_id: pairId(),
          reel_id: clickedReel ? clickedReel.id : "",
          link_type: link.dataset.linkType === "search" ? "search" : "exact"
        });
      }
    });

    document.querySelectorAll(".rc-mode-button").forEach(function(button) {
      button.addEventListener("click", function() {
        setBackingMode(button.dataset.backingMode === "on");
        updateUrl("replace");
      });
    });

    document.querySelectorAll(".rc-material-button").forEach(function(button) {
      button.addEventListener("click", function() {
        var role = button.dataset.lineRole;
        var material = button.dataset.material;
        var previous = state.lineRoles[role].line;
        state.lineRoles[role].material = material;
        var closest = previous
          ? window.ReelCalcLineSelector.closestLine(state.lines, {
              material: material,
              lb: previous.lb,
              dia_in: previous.dia_in
            })
          : null;
        refreshLineRole(role, closest ? closest.id : "");
        updateUrl("replace");
      });
    });

    ["main", "backing"].forEach(function(role) {
      var roleState = state.lineRoles[role];
      var controls = roleElements(role);
      controls.product.addEventListener("focus", function() {
        if (roleState.line && controls.product.value === lineProductLabel(roleState.line)) controls.product.select();
        openLineMenu(role, true);
      });
      controls.product.addEventListener("click", function() {
        openLineMenu(role, true);
      });
      controls.product.addEventListener("input", function() {
        if (roleState.line && controls.product.value !== lineProductLabel(roleState.line)) {
          roleState.line = null;
          refreshLineStrengths(role, "", "");
          updateUrl("replace");
        }
        roleState.resultLimit = 20;
        renderLineMenu(role, controls.product.value);
      });
      controls.product.addEventListener("keydown", function(event) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (controls.menu.hidden) openLineMenu(role, false);
          var direction = event.key === "ArrowDown" ? 1 : -1;
          var count = controls.menu.querySelectorAll(".rc-line-option").length;
          var start = roleState.highlightedIndex < 0
            ? (direction > 0 ? 0 : count - 1)
            : roleState.highlightedIndex + direction;
          highlightLineOption(role, start);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          var highlighted = roleState.matches[roleState.highlightedIndex];
          if (highlighted) chooseExactLine(role, highlighted);
          else if (roleState.matches.length === 1) chooseExactLine(role, roleState.matches[0]);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          if (roleState.line) controls.product.value = lineProductLabel(roleState.line);
          closeLineMenu(role);
        }
      });
      controls.product.addEventListener("blur", function() {
        window.setTimeout(function() {
          if (document.activeElement !== controls.product && !controls.menu.contains(document.activeElement)) {
            if (roleState.line) controls.product.value = lineProductLabel(roleState.line);
            closeLineMenu(role);
          }
        }, 140);
      });
      controls.menu.addEventListener("mousedown", function(event) {
        if (event.target.closest("button")) event.preventDefault();
      });
      controls.menu.addEventListener("click", function(event) {
        var showMore = event.target.closest(".rc-show-more-lines");
        if (showMore) {
          roleState.resultLimit += 20;
          renderLineMenu(role, controls.product.value);
          controls.product.focus();
          return;
        }
        var button = event.target.closest(".rc-line-option");
        if (!button) return;
        chooseExactLine(role, state.lines.find(function(line) { return line.id === button.dataset.lineId; }) || null);
      });
      controls.strength.addEventListener("change", function() {
        var line = state.lines.find(function(item) { return item.id === controls.strength.value; }) || null;
        state.lineRoles[role].line = line;
        controls.detail.textContent = line
          ? "Published diameter: " + trimNumber(line.dia_in, 4) + " in (" + trimNumber(line.dia_mm || line.dia_in * 25.4, 3) + " mm)"
          : "Choose an exact line and strength.";
        renderLineFit();
        updateUrl("replace");
      });
    });

    elements.mainLineYards.addEventListener("input", function() {
      renderLineFit();
      updateUrl("replace");
    });
    elements.mainLineYards.addEventListener("change", function() {
      renderLineFit();
      updateUrl("replace");
    });
    window.addEventListener("popstate", function() {
      restoreFromUrl("other");
    });
  }

  function chooseLinesFromParams(params) {
    var mainLineId = params.get("mainLine") || "";
    var backingLineId = params.get("backingLine") || "";
    var backingEnabled = params.get("backing") !== "off";
    var desiredYards = Number(params.get("mainYards"));
    var mainLine = mainLineId
      ? state.lines.find(function(line) { return line.id === mainLineId; }) || null
      : null;
    var backingLine = backingLineId
      ? state.lines.find(function(line) { return line.id === backingLineId; }) || null
      : null;
    state.lineRoles.main.line = null;
    state.lineRoles.backing.line = null;
    state.lineRoles.main.material = "Braid";
    state.lineRoles.backing.material = "Monofilament";
    if (mainLine) state.lineRoles.main.material = mainLine.material;
    if (backingLine) state.lineRoles.backing.material = backingLine.material === "Braid" ? "Braid" : "Monofilament";
    elements.mainLineYards.value = desiredYards > 0 ? trimNumber(desiredYards, 1) : "100";
    refreshLineRole("main", mainLine ? mainLine.id : "");
    refreshLineRole("backing", backingLine ? backingLine.id : "");
    setBackingMode(backingEnabled);
  }

  function chooseReelsFromParams(params, source) {
    var firstId = params.get("reel1") || "";
    var secondId = params.get("reel2") || "";
    state.reelA = firstId ? state.reelById.get(firstId) || null : null;
    state.reelB = secondId ? state.reelById.get(secondId) || null : null;
    if (state.reelA) syncSelectorFromReel("A", state.reelA);
    else resetSelector("A", true);
    if (state.reelB) syncSelectorFromReel("B", state.reelB);
    else resetSelector("B", true);
    renderComparison({ historyMode: "none", comparisonSource: source || "other" });
    if ((firstId && !state.reelA) || (secondId && !state.reelB)) {
      setStatus("One reel in this shared comparison is unavailable. Choose a replacement reel to continue.", true);
    }
  }

  function restoreFromUrl(source) {
    state.restoringHistory = true;
    try {
      var params = new URLSearchParams(window.location.search);
      chooseLinesFromParams(params);
      chooseReelsFromParams(params, source || "other");
    } finally {
      state.restoringHistory = false;
    }
  }

  async function initialize() {
    try {
      mountReelSelectors();
      if (!window.ReelCalcCore || !window.ReelCalcLineSelector || !window.ReelCalcComparisonData) {
        throw new Error("The ReelCalc calculation engine could not be loaded.");
      }
      var responses = await Promise.all([
        fetch(assetUrl("data/reels.json"), { credentials: "omit" }),
        fetch(assetUrl("data/reel-pages.json"), { credentials: "omit" }),
        fetch(assetUrl("data/lines.json"), { credentials: "omit" }),
        fetch(assetUrl("data/reel-affiliates.json"), { credentials: "omit" })
      ]);
      if (!responses[0].ok || !responses[1].ok || !responses[2].ok || !responses[3].ok) {
        throw new Error("The verified reel, line, or purchase-link data could not be loaded.");
      }
      var data = await Promise.all(responses.map(function(response) { return response.json(); }));
      var reels = data[0];
      var registry = data[1];
      state.lines = window.ReelCalcLineSelector.prepareLines(data[2]);
      state.affiliateData = data[3];
      state.reelById = new Map(reels.map(function(reel) { return [reel.id, reel]; }));
      state.pageByReelId = new Map(registry.pages.map(function(page) { return [page.reelId, page]; }));
      state.options = registry.pages.map(function(page) {
        var reel = state.reelById.get(page.reelId);
        if (!reel) return null;
        var type = reelTypeKey(reel);
        var family = reelFamilyName(reel);
        var label = optionLabel(reel);
        var searchable = [reel.brand, reel.model, reel.size_label, reel.sku, reel.id, reel.generation, reel.gear_ratio, reel.retrieve_hand].filter(Boolean).join(" ");
        return {
          reelId: reel.id,
          reel: reel,
          label: label,
          type: type,
          family: family,
          exactLabel: exactModelLabel(reel),
          searchFields: {
            label: normalizeSearch(displayName(reel)),
            family: normalizeSearch(family),
            sku: normalizeSearch(reel.sku),
            skuCompact: compactSearch(reel.sku),
            size: normalizeSearch(reel.size_label),
            sizeCompact: compactSearch(reel.size_label),
            id: normalizeSearch(reel.id),
            idCompact: compactSearch(reel.id),
            all: normalizeSearch(searchable),
            allCompact: compactSearch(searchable)
          }
        };
      }).filter(Boolean).sort(function(a, b) {
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      });
      state.optionByReelId = new Map(state.options.map(function(option) {
        return [option.reel.id, option];
      }));
      state.optionsByType = new Map([
        ["spinning", state.options.filter(function(option) { return option.type === "spinning"; })],
        ["baitcasting", state.options.filter(function(option) { return option.type === "baitcasting"; })]
      ]);
      installEvents();
      var initialParams = new URLSearchParams(window.location.search);
      var initialSource = initialParams.get("reel1") && initialParams.get("reel2")
        ? "shared_url"
        : "other";
      restoreFromUrl(initialSource);
    } catch (error) {
      elements.results.hidden = true;
      setStatus(error.message || "The comparison tool could not load.", true);
    }
  }

  initialize();
})();
