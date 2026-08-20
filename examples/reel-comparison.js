(function() {
  "use strict";

  var SITE_BASE = "https://www.reelcalc.com";
  var SCRIPT_URL = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : document.baseURI;
  var ASSET_ROOT = new URL("../", SCRIPT_URL);
  var DEFAULT_MAIN_LINE = "seaguar-smackdown-braid-15";
  var DEFAULT_BACKING_LINE = "berkley-trilene-big-game-monofilament-10";
  var state = {
    options: [],
    optionByLabel: new Map(),
    reelById: new Map(),
    pageByReelId: new Map(),
    reelA: null,
    reelB: null,
    backingEnabled: true,
    affiliateData: null,
    completedPairIds: new Set(),
    restoringHistory: false,
    combo: {
      A: { matches: [], highlightedIndex: -1 },
      B: { matches: [], highlightedIndex: -1 }
    },
    lines: [],
    lineRoles: {
      main: { material: "Braid", line: null, productsByLabel: new Map() },
      backing: { material: "Monofilament", line: null, productsByLabel: new Map() }
    }
  };

  var elements = {
    inputA: document.getElementById("reel-a-input"),
    inputB: document.getElementById("reel-b-input"),
    toggleA: document.getElementById("reel-a-toggle"),
    toggleB: document.getElementById("reel-b-toggle"),
    optionsA: document.getElementById("reel-a-options"),
    optionsB: document.getElementById("reel-b-options"),
    selectionA: document.getElementById("reel-a-selection"),
    selectionB: document.getElementById("reel-b-selection"),
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
    mainLineProducts: document.getElementById("main-line-products"),
    mainLineStrength: document.getElementById("main-line-strength"),
    mainLineDetail: document.getElementById("main-line-detail"),
    backingLineProduct: document.getElementById("backing-line-product"),
    backingLineProducts: document.getElementById("backing-line-products"),
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
    return [reel.brand, reel.model, reel.size_label].filter(Boolean).join(" ");
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

  function comboElements(side) {
    return side === "A"
      ? { input: elements.inputA, menu: elements.optionsA, toggle: elements.toggleA, selection: elements.selectionA }
      : { input: elements.inputB, menu: elements.optionsB, toggle: elements.toggleB, selection: elements.selectionB };
  }

  function currentReel(side) {
    return state[side === "A" ? "reelA" : "reelB"];
  }

  function closeReelMenu(side) {
    var controls = comboElements(side);
    controls.menu.hidden = true;
    controls.input.setAttribute("aria-expanded", "false");
    state.combo[side].matches = [];
    state.combo[side].highlightedIndex = -1;
  }

  function openReelMenu(side, showAll) {
    var controls = comboElements(side);
    var selectedReel = currentReel(side);
    var selectedLabel = selectedReel ? optionLabel(selectedReel) : "";
    var entered = controls.input.value.trim();
    var query = showAll || entered === selectedLabel ? "" : entered.toLowerCase();
    var matches = state.options.filter(function(item) {
      return !query || item.label.toLowerCase().includes(query);
    });
    state.combo[side].matches = matches;
    state.combo[side].highlightedIndex = -1;
    controls.menu.innerHTML = matches.length
      ? matches.map(function(item) {
          var reel = item.reel;
          return '<button type="button" class="rc-reel-option" role="option" data-reel-id="' + escapeHtml(reel.id) + '" aria-selected="' +
            String(Boolean(selectedReel && selectedReel.id === reel.id)) + '"><span>' + escapeHtml(displayName(reel)) +
            '</span><small>' + escapeHtml(reel.sku ? "Model " + reel.sku : "") + "</small></button>";
        }).join("")
      : '<p class="rc-no-reel-results">No matching reels found.</p>';
    controls.menu.hidden = false;
    controls.input.setAttribute("aria-expanded", "true");
  }

  function highlightReelOption(side, nextIndex) {
    var controls = comboElements(side);
    var buttons = Array.from(controls.menu.querySelectorAll(".rc-reel-option"));
    if (!buttons.length) return;
    var index = Math.max(0, Math.min(nextIndex, buttons.length - 1));
    state.combo[side].highlightedIndex = index;
    buttons.forEach(function(button, buttonIndex) {
      button.classList.toggle("is-highlighted", buttonIndex === index);
    });
    buttons[index].scrollIntoView({ block: "nearest" });
  }

  function chooseReel(side, reel) {
    if (!reel) return;
    var controls = comboElements(side);
    var current = currentReel(side);
    if (current && current.id === reel.id) {
      setInputForReel(controls.input, reel);
      closeReelMenu(side);
      return;
    }
    state[side === "A" ? "reelA" : "reelB"] = reel;
    setInputForReel(controls.input, reel);
    controls.selection.textContent = displayName(reel);
    closeReelMenu(side);
    trackEvent(
      side === "A" ? "reel_comparison_reel_1_selected" : "reel_comparison_reel_2_selected",
      comparisonData().selectorParameters(reel, pageForReel(reel), side === "A" ? "left" : "right")
    );
    renderComparison({
      historyMode: "push",
      comparisonSource: "manual_selection"
    });
  }

  function selectedOption(input) {
    var direct = state.optionByLabel.get(input.value.trim().toLowerCase());
    if (direct) return direct;
    var search = input.value.trim().toLowerCase();
    if (!search) return null;
    var matches = state.options.filter(function(item) {
      return item.label.toLowerCase().includes(search);
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function setInputForReel(input, reel) {
    input.value = reel ? optionLabel(reel) : "";
  }

  function updateSelection(side) {
    var controls = comboElements(side);
    var option = selectedOption(controls.input);
    var reel = option ? state.reelById.get(option.reelId) : null;
    if (reel) {
      chooseReel(side, reel);
      return;
    }
    var existing = currentReel(side);
    setInputForReel(controls.input, existing);
    controls.selection.textContent = existing ? displayName(existing) : "Choose an exact reel from the search results.";
    closeReelMenu(side);
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
      "<div>", escapeHtml(reelA.brand + " " + reelA.size_label), "</div>",
      "<div>", escapeHtml(reelB.brand + " " + reelB.size_label), "</div>",
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
          products: elements.mainLineProducts,
          strength: elements.mainLineStrength,
          detail: elements.mainLineDetail
        }
      : {
          product: elements.backingLineProduct,
          products: elements.backingLineProducts,
          strength: elements.backingLineStrength,
          detail: elements.backingLineDetail
        };
  }

  function refreshLineRole(role, preferredLineId) {
    var selector = window.ReelCalcLineSelector;
    var roleState = state.lineRoles[role];
    var controls = roleElements(role);
    var products = selector.productsFor(state.lines, roleState.material);
    roleState.productsByLabel = new Map(products.map(function(product) {
      return [product.label.toLowerCase(), product];
    }));

    var productFragment = document.createDocumentFragment();
    products.forEach(function(product) {
      var option = document.createElement("option");
      option.value = product.label;
      productFragment.appendChild(option);
    });
    controls.products.replaceChildren(productFragment);

    var selected = preferredLineId
      ? state.lines.find(function(line) { return line.id === preferredLineId && line.material === roleState.material; })
      : roleState.line;
    if (!selected || selected.material !== roleState.material) {
      var firstProduct = products[0];
      selected = selector.strengthsFor(state.lines, firstProduct)[0] || null;
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
    var selected = strengths.find(function(line) { return line.id === preferredLineId; }) || strengths[0] || null;
    roleState.line = selected;

    controls.strength.innerHTML = strengths.length
      ? strengths.map(function(line) {
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

  function selectLineProduct(role) {
    var roleState = state.lineRoles[role];
    var controls = roleElements(role);
    var product = roleState.productsByLabel.get(controls.product.value.trim().toLowerCase());
    if (!product) return false;
    refreshLineStrengths(role, product.key, "");
    return true;
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
    if (settings.historyMode && settings.historyMode !== "none") {
      updateUrl(settings.historyMode);
    }
    trackCompletedComparison(settings.comparisonSource || "other");
  }

  function applyComparisonParameters(url) {
    if (!state.reelA || !state.reelB) return;
    url.searchParams.set("reel1", state.reelA.id);
    url.searchParams.set("reel2", state.reelB.id);
    if (state.lineRoles.main.line) url.searchParams.set("mainLine", state.lineRoles.main.line.id);
    if (state.lineRoles.backing.line) url.searchParams.set("backingLine", state.lineRoles.backing.line.id);
    url.searchParams.set("backing", state.backingEnabled ? "on" : "off");
    var desiredYards = Number(elements.mainLineYards.value);
    if (desiredYards > 0) url.searchParams.set("mainYards", trimNumber(desiredYards, 1));
  }

  function updateUrl(mode) {
    if (!state.reelA || !state.reelB || state.reelA.id === state.reelB.id || state.restoringHistory) return;
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
    setInputForReel(elements.inputA, null);
    setInputForReel(elements.inputB, null);
    elements.selectionA.textContent = "Choose a reel.";
    elements.selectionB.textContent = "Choose a reel.";
    closeReelMenu("A");
    closeReelMenu("B");

    var url = new URL(window.location.href);
    ["reel1", "reel2", "mainLine", "backingLine", "backing", "mainYards"].forEach(function(key) {
      url.searchParams.delete(key);
    });
    window.history.pushState({ reelcalcComparison: true }, "", url);
    renderComparison({ historyMode: "none", comparisonSource: "other" });
    if (previousA || previousB) {
      trackEvent("reel_comparison_reset", {
        comparison_pair_id: previousPairId,
        reel_1_id: previousA ? previousA.id : "",
        reel_2_id: previousB ? previousB.id : ""
      });
    }
  }

  function installReelCombo(side) {
    var controls = comboElements(side);

    function openAllAndSelect() {
      var selected = currentReel(side);
      controls.input.focus();
      if (selected && controls.input.value === optionLabel(selected)) controls.input.select();
      openReelMenu(side, true);
    }

    controls.toggle.addEventListener("mousedown", function(event) {
      event.preventDefault();
    });
    controls.toggle.addEventListener("click", openAllAndSelect);
    controls.input.addEventListener("focus", function() {
      var selected = currentReel(side);
      if (selected && controls.input.value === optionLabel(selected)) controls.input.select();
      openReelMenu(side, true);
    });
    controls.input.addEventListener("click", function() {
      var selected = currentReel(side);
      if (selected && controls.input.value === optionLabel(selected)) controls.input.select();
      openReelMenu(side, true);
    });
    controls.input.addEventListener("input", function() {
      openReelMenu(side, false);
    });
    controls.input.addEventListener("keydown", function(event) {
      var comboState = state.combo[side];
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (controls.menu.hidden) openReelMenu(side, false);
        var direction = event.key === "ArrowDown" ? 1 : -1;
        var startingIndex = comboState.highlightedIndex < 0
          ? (direction > 0 ? 0 : comboState.matches.length - 1)
          : comboState.highlightedIndex + direction;
        highlightReelOption(side, startingIndex);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        var highlighted = comboState.matches[comboState.highlightedIndex];
        if (highlighted) chooseReel(side, highlighted.reel);
        else updateSelection(side);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setInputForReel(controls.input, currentReel(side));
        closeReelMenu(side);
      }
    });
    controls.input.addEventListener("blur", function() {
      window.setTimeout(function() {
        if (!controls.menu.contains(document.activeElement)) updateSelection(side);
      }, 120);
    });
    controls.menu.addEventListener("mousedown", function(event) {
      if (event.target.closest(".rc-reel-option")) event.preventDefault();
    });
    controls.menu.addEventListener("click", function(event) {
      var button = event.target.closest(".rc-reel-option");
      if (!button) return;
      chooseReel(side, state.reelById.get(button.dataset.reelId));
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
    });
    elements.swap.addEventListener("click", function() {
      if (!state.reelA || !state.reelB) return;
      var oldA = state.reelA;
      state.reelA = state.reelB;
      state.reelB = oldA;
      setInputForReel(elements.inputA, state.reelA);
      setInputForReel(elements.inputB, state.reelB);
      elements.selectionA.textContent = displayName(state.reelA);
      elements.selectionB.textContent = displayName(state.reelB);
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
        var closest = window.ReelCalcLineSelector.closestLine(state.lines, {
          material: material,
          lb: previous ? previous.lb : 0,
          dia_in: previous ? previous.dia_in : 0
        });
        refreshLineRole(role, closest ? closest.id : "");
        updateUrl("replace");
      });
    });

    ["main", "backing"].forEach(function(role) {
      var controls = roleElements(role);
      controls.product.addEventListener("input", function() {
        if (selectLineProduct(role)) updateUrl("replace");
      });
      controls.product.addEventListener("change", function() {
        var selected = selectLineProduct(role);
        if (!selected && state.lineRoles[role].line) {
          controls.product.value = lineProductLabel(state.lineRoles[role].line);
        }
        if (selected) updateUrl("replace");
      });
      controls.product.addEventListener("blur", function() {
        if (!state.lineRoles[role].productsByLabel.has(controls.product.value.trim().toLowerCase()) && state.lineRoles[role].line) {
          controls.product.value = lineProductLabel(state.lineRoles[role].line);
        }
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
    var mainLineId = params.get("mainLine") || DEFAULT_MAIN_LINE;
    var backingLineId = params.get("backingLine") || DEFAULT_BACKING_LINE;
    var backingEnabled = params.get("backing") !== "off";
    var desiredYards = Number(params.get("mainYards"));
    var mainLine = state.lines.find(function(line) { return line.id === mainLineId; }) ||
      state.lines.find(function(line) { return line.id === DEFAULT_MAIN_LINE; });
    var backingLine = state.lines.find(function(line) { return line.id === backingLineId; }) ||
      state.lines.find(function(line) { return line.id === DEFAULT_BACKING_LINE; });
    if (mainLine) state.lineRoles.main.material = mainLine.material;
    if (backingLine) state.lineRoles.backing.material = backingLine.material === "Braid" ? "Braid" : "Monofilament";
    if (desiredYards > 0) elements.mainLineYards.value = trimNumber(desiredYards, 1);
    refreshLineRole("main", mainLine ? mainLine.id : "");
    refreshLineRole("backing", backingLine ? backingLine.id : "");
    setBackingMode(backingEnabled);
  }

  function chooseReelsFromParams(params, source) {
    var firstId = params.get("reel1") || "";
    var secondId = params.get("reel2") || "";
    state.reelA = firstId ? state.reelById.get(firstId) || null : null;
    state.reelB = secondId ? state.reelById.get(secondId) || null : null;
    setInputForReel(elements.inputA, state.reelA);
    setInputForReel(elements.inputB, state.reelB);
    elements.selectionA.textContent = state.reelA ? displayName(state.reelA) : "Choose a reel.";
    elements.selectionB.textContent = state.reelB ? displayName(state.reelB) : "Choose a reel.";
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
        return reel ? { reelId: reel.id, reel: reel, label: optionLabel(reel) } : null;
      }).filter(Boolean).sort(function(a, b) {
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      });
      state.optionByLabel = new Map(state.options.map(function(option) {
        return [option.label.toLowerCase(), option];
      }));
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
