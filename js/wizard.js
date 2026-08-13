const DATA_PATHS = {
  reels: "data/reels.json",
  lines: "data/lines.json",
  quality: "data/data-quality-report.json",
  reelAffiliates: "data/reel-affiliates.json"
};

const {
  YARDS_PER_METER,
  MM_PER_INCH,
  LB_PER_KG,
  monoDiameter,
  estimateMonoLbFromDiameter,
  calculatePublishedBraidCapacity,
  calculateFullSpoolCapacity: calculateCoreFullSpoolCapacity,
  calculateBackingNeeded,
  calculateHandleTurns,
  isReelReady,
  isLineReady
} = window.ReelCalcCore;
const SIMILAR_DIAMETER_TOLERANCE_IN = 0.0015;
const DEFAULT_BACKING = {
  id: "default-backing",
  brand: "Generic",
  model: "Monofilament backing",
  type: "Monofilament",
  lb: 10,
  dia_in: 0.012,
  dia_mm: 0.305
};

const state = {
  reels: [],
  lines: [],
  quality: null,
  affiliateData: null,
  reelFilters: { brand: "", model: "", size: "" },
  lineFilters: { brand: "", model: "", lb: "" },
  selectedReel: null,
  selectedLine: null,
  selectedSetup: null,
  recommendations: [],
  useManualReel: false,
  useManualLine: false,
  manualReel: null,
  manualLine: null,
  path: "recommend",
  backingMode: "none",
  backingFilters: { brand: "", model: "", lb: "" },
  backingLine: null,
  useManualBacking: false,
  manualBacking: null,
  desiredMainYards: 100,
  unitSystem: "standard",
  reelLabelMap: new Map(),
  lineLabelMap: new Map(),
};

const el = {};

function byId(id) {
  return document.getElementById(id);
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (window.ReelCalcAnalytics && typeof window.ReelCalcAnalytics.startWizardSession === "function") {
    window.ReelCalcAnalytics.startWizardSession();
  }
  cacheElements();
  bindEvents();
  await loadData();
  populateReelFilters();
  var preloadedReel = applyReelPreloadFromUrl();
  populateLineFilters();
  populateBackingFilters();
  renderAll();
  trackWizardEvent("wizard_viewed", {
    page_type: "setup_wizard",
    reel_preloaded: Boolean(preloadedReel)
  }, { onceKey: "wizard-view" });
  if (preloadedReel) trackSelectedReel("url_preload");
}

function cacheElements() {
  [
    "dataStatus", "reelBrand", "reelModel", "reelSize",
    "manualReelToggle", "manualReelPanel", "manualReelYards", "manualReelLb", "reelSummary",
    "pathPanel", "recommendPanel", "exactPanel", "fishingType", "priority", "recommendations",
    "lineBrand", "lineModel", "lineLb",
    "manualLineToggle", "manualLinePanel", "manualLineType", "manualLineLb", "manualLineDiameter", "lineSummary",
    "resultPanel", "capacityResult", "backingPanel", "backingFields", "backingBrand", "backingModel", "backingLb",
    "manualBackingToggle", "manualBackingPanel", "manualBackingType", "manualBackingLb", "manualBackingDiameter",
    "mainLineYards", "mainLineSlider", "backingResult", "similarPanel", "similarLines",
    "manualReelCapacityLabel", "manualReelStrengthLabel", "lineLbLabel",
    "manualLineStrengthLabel", "manualLineDiameterLabel", "backingLbLabel",
    "manualBackingStrengthLabel", "manualBackingDiameterLabel", "mainLineYardsLabel"
  ].forEach(function(id) {
    el[id] = byId(id);
  });
}

function bindEvents() {
  document.querySelectorAll("[data-unit]").forEach(function(button) {
    button.addEventListener("click", function() {
      switchUnitSystem(button.dataset.unit);
    });
  });

  el.reelBrand.addEventListener("change", function() {
    state.reelFilters.brand = el.reelBrand.value;
    state.reelFilters.model = "";
    state.reelFilters.size = "";
    state.selectedReel = null;
    populateReelFilters();
    resolveReelFromFilters();
    resetDesiredMainLine();
    renderAll();
  });
  el.reelModel.addEventListener("change", function() {
    state.reelFilters.model = el.reelModel.value;
    state.reelFilters.size = "";
    state.selectedReel = null;
    populateReelFilters();
    resolveReelFromFilters();
    resetDesiredMainLine();
    renderAll();
  });
  el.reelSize.addEventListener("change", function() {
    state.reelFilters.size = el.reelSize.value;
    state.selectedReel = null;
    resolveReelFromFilters();
    resetDesiredMainLine();
    renderAll();
    if (state.selectedReel) trackSelectedReel("wizard_selector");
  });
  el.reelSummary.addEventListener("click", function(event) {
    var link = event.target.closest("[data-reel-affiliate-link]");
    if (!link) return;
    trackWizardEvent("reel_affiliate_clicked", {
      page_type: "setup_wizard",
      placement: "wizard_reel_summary",
      reel_id: link.dataset.reelId || "",
      retailer: link.dataset.retailer || "",
      match_type: link.dataset.matchType || ""
    });
  });
  el.capacityResult.addEventListener("click", function(event) {
    var link = event.target.closest("[data-line-affiliate-link]");
    if (!link) return;
    var setup = state.selectedSetup;
    var line = getActiveMainLine();
    var recommendationIndex = setup
      ? state.recommendations.findIndex(function(item) {
        return item === setup || (item.line && setup.line && item.line.id === setup.line.id && item.useCase === setup.useCase);
      })
      : -1;
    trackWizardEvent("line_affiliate_clicked", Object.assign({
      page_type: "setup_wizard",
      placement: "wizard_recommendation_result",
      affiliate_context: "generic_recommendation",
      retailer: link.dataset.retailer || "",
      match_type: link.dataset.matchType || "generic_search",
      required_line_yards: Number(link.dataset.requiredYards) || 0,
      suggested_spool_yards: Number(link.dataset.spoolYards) || 0,
      recommendation_rank: recommendationIndex >= 0 ? recommendationIndex + 1 : 0,
      recommendation_type: setup && setup.useCase ? setup.useCase : ""
    }, reelEventParameters(getActiveReel()), lineEventParameters(line)));
  });

  el.manualReelToggle.addEventListener("click", function() {
    state.useManualReel = !state.useManualReel;
    el.manualReelPanel.classList.toggle("hidden", !state.useManualReel);
    updateManualReel();
    resetDesiredMainLine();
    renderAll();
    trackWizardEvent("wizard_manual_mode_changed", {
      page_type: "setup_wizard",
      entry_type: "reel",
      enabled: state.useManualReel
    });
  });
  [el.manualReelYards, el.manualReelLb].forEach(function(input) {
    input.addEventListener("input", function() {
      state.useManualReel = true;
      el.manualReelPanel.classList.remove("hidden");
      updateManualReel();
      resetDesiredMainLine();
      renderAll();
    });
    input.addEventListener("change", function() {
      if (state.manualReel) trackSelectedReel("manual_entry");
    });
  });

  document.querySelectorAll("[data-path]").forEach(function(button) {
    button.addEventListener("click", function() {
      state.path = button.dataset.path;
      if (state.path === "exact") {
        state.selectedSetup = null;
      }
      setActiveButtons("data-path", state.path);
      renderAll();
      trackWizardEvent("wizard_mode_selected", {
        page_type: "setup_wizard",
        wizard_mode: state.path
      });
    });
  });

  el.fishingType.addEventListener("change", function() {
    state.selectedSetup = null;
    renderAll();
    trackWizardEvent("wizard_technique_selected", Object.assign({
      page_type: "setup_wizard",
      fishing_use: el.fishingType.value,
      priority: el.priority.value
    }, reelEventParameters(getActiveReel())));
  });
  el.priority.addEventListener("change", function() {
    state.selectedSetup = null;
    renderAll();
    trackWizardEvent("wizard_priority_selected", Object.assign({
      page_type: "setup_wizard",
      fishing_use: el.fishingType.value,
      priority: el.priority.value
    }, reelEventParameters(getActiveReel())));
  });
  el.recommendations.addEventListener("click", function(event) {
    var button = event.target.closest("[data-setup-index]");
    if (!button) return;
    var setup = state.recommendations[Number(button.dataset.setupIndex)];
    if (!setup) return;
    state.selectedSetup = setup;
    state.path = "recommend";
    setActiveButtons("data-path", state.path);
    resetDesiredMainLine();
    renderAll();
    trackRecommendedSetup(setup, Number(button.dataset.setupIndex));
    scrollToMainResultAfterRender();
  });

  el.lineBrand.addEventListener("change", function() {
    state.lineFilters.brand = el.lineBrand.value;
    state.lineFilters.model = "";
    state.lineFilters.lb = "";
    state.selectedLine = null;
    state.useManualLine = false;
    populateLineFilters();
    resolveLineFromFilters();
    resetDesiredMainLine();
    renderAll();
  });
  el.lineModel.addEventListener("change", function() {
    state.lineFilters.model = el.lineModel.value;
    state.lineFilters.lb = "";
    state.selectedLine = null;
    state.useManualLine = false;
    populateLineFilters();
    resolveLineFromFilters();
    resetDesiredMainLine();
    renderAll();
  });
  el.lineLb.addEventListener("change", function() {
    state.lineFilters.lb = el.lineLb.value;
    state.selectedLine = null;
    state.useManualLine = false;
    resolveLineFromFilters();
    resetDesiredMainLine();
    renderAll();
    if (state.selectedLine) {
      trackSelectedLine(state.selectedLine, "exact_selector", "main_line");
      trackWizardCalculation("exact_line");
    }
  });

  el.manualLineToggle.addEventListener("click", function() {
    state.useManualLine = !state.useManualLine;
    if (state.useManualLine) state.selectedLine = null;
    el.manualLinePanel.classList.toggle("hidden", !state.useManualLine);
    updateManualLine();
    resetDesiredMainLine();
    renderAll();
    trackWizardEvent("wizard_manual_mode_changed", {
      page_type: "setup_wizard",
      entry_type: "line",
      enabled: state.useManualLine
    });
  });
  [el.manualLineType, el.manualLineLb, el.manualLineDiameter].forEach(function(input) {
    input.addEventListener("input", function() {
      state.useManualLine = true;
      state.selectedLine = null;
      el.manualLinePanel.classList.remove("hidden");
      updateManualLine();
      resetDesiredMainLine();
      renderAll();
    });
    input.addEventListener("change", function() {
      updateManualLine();
      resetDesiredMainLine();
      renderAll();
      if (state.manualLine) {
        trackSelectedLine(state.manualLine, "manual_entry", "main_line");
        trackWizardCalculation("manual_line");
      }
    });
  });

  document.querySelectorAll("[data-backing]").forEach(function(button) {
    button.addEventListener("click", function() {
      state.backingMode = button.dataset.backing;
      setActiveButtons("data-backing", state.backingMode);
      el.backingFields.classList.toggle("hidden", state.backingMode !== "yes");
      renderAll();
      trackWizardEvent("wizard_backing_mode_selected", Object.assign({
        page_type: "setup_wizard",
        backing_mode: state.backingMode
      }, reelEventParameters(getActiveReel())));
    });
  });
  el.backingBrand.addEventListener("change", function() {
    state.backingFilters.brand = el.backingBrand.value;
    state.backingFilters.model = "";
    state.backingFilters.lb = "";
    state.backingLine = null;
    state.useManualBacking = false;
    el.manualBackingPanel.classList.add("hidden");
    populateBackingFilters();
    resolveBackingFromFilters();
    renderAll();
  });
  el.backingModel.addEventListener("change", function() {
    state.backingFilters.model = el.backingModel.value;
    state.backingFilters.lb = "";
    state.backingLine = null;
    state.useManualBacking = false;
    el.manualBackingPanel.classList.add("hidden");
    populateBackingFilters();
    resolveBackingFromFilters();
    renderAll();
  });
  el.backingLb.addEventListener("change", function() {
    state.backingFilters.lb = el.backingLb.value;
    state.backingLine = null;
    state.useManualBacking = false;
    el.manualBackingPanel.classList.add("hidden");
    resolveBackingFromFilters();
    renderAll();
    if (state.backingLine) {
      trackSelectedLine(state.backingLine, "exact_selector", "backing");
      trackBackingCalculation("backing_line_selected");
    }
  });
  el.manualBackingToggle.addEventListener("click", function() {
    state.useManualBacking = !state.useManualBacking;
    if (state.useManualBacking) state.backingLine = null;
    el.manualBackingPanel.classList.toggle("hidden", !state.useManualBacking);
    updateManualBacking();
    renderAll();
    trackWizardEvent("wizard_manual_mode_changed", {
      page_type: "setup_wizard",
      entry_type: "backing",
      enabled: state.useManualBacking
    });
  });
  [el.manualBackingType, el.manualBackingLb, el.manualBackingDiameter].forEach(function(input) {
    input.addEventListener("input", function() {
      state.useManualBacking = true;
      state.backingLine = null;
      el.manualBackingPanel.classList.remove("hidden");
      updateManualBacking();
      renderAll();
    });
    input.addEventListener("change", function() {
      updateManualBacking();
      renderAll();
      if (state.manualBacking) {
        trackSelectedLine(state.manualBacking, "manual_entry", "backing");
        trackBackingCalculation("manual_backing");
      }
    });
  });
  el.mainLineYards.addEventListener("input", function() {
    var rawValue = el.mainLineYards.value.trim();
    if (rawValue === "") {
      state.desiredMainYards = null;
      renderAll();
      return;
    }
    var desiredDisplay = Number(rawValue);
    if (!Number.isFinite(desiredDisplay)) return;
    state.desiredMainYards = displayLengthToYards(desiredDisplay);
    el.mainLineSlider.value = String(clampSliderValue(desiredDisplay));
    renderAll();
  });
  el.mainLineYards.addEventListener("change", function() {
    if (!(Number(state.desiredMainYards) > 0)) {
      resetDesiredMainLine();
    }
    syncDesiredMainLineInputs();
    renderAll();
    trackBackingCalculation("main_line_length_changed");
  });
  el.mainLineSlider.addEventListener("input", function() {
    var desiredDisplay = Number(el.mainLineSlider.value);
    state.desiredMainYards = displayLengthToYards(desiredDisplay);
    el.mainLineYards.value = formatLengthInput(state.desiredMainYards);
    renderAll();
  });
}

async function loadData() {
  try {
    var affiliateRequest = fetch(DATA_PATHS.reelAffiliates).then(function(response) {
      if (!response.ok) return null;
      return response.json();
    }).catch(function() {
      return null;
    });
    var responses = await Promise.all([
      fetch(DATA_PATHS.reels),
      fetch(DATA_PATHS.lines),
      fetch(DATA_PATHS.quality),
      affiliateRequest
    ]);
    responses.slice(0, 3).forEach(function(response) {
      if (!response.ok) throw new Error("Data request failed");
    });
    state.reels = await responses[0].json();
    state.lines = await responses[1].json();
    state.quality = await responses[2].json();
    state.affiliateData = responses[3] && responses[3].reels
      ? responses[3]
      : null;
    el.dataStatus.className = "data-pill";
    el.dataStatus.textContent = "Search " + formatCountBadge(state.reels.length) + " reels and " + formatCountBadge(state.lines.length) + " lines";
  } catch (error) {
    el.dataStatus.className = "data-pill error";
    el.dataStatus.textContent = "Data did not load. Run this from a local server.";
    trackWizardEvent("reelcalc_data_error", {
      page_type: "setup_wizard",
      data_area: "wizard_initial_load"
    }, { onceKey: "wizard-data-load" });
    console.error(error);
  }
}

function renderAll() {
  var reel = getActiveReel();
  var line = getActiveMainLine();
  var reelReady = isReelReady(reel);
  var lineReady = reelReady && isLineReady(line);
  var reelStarted = reelReady || state.useManualReel;

  updateUnitLabels();
  updateManualToggleStates();
  el.pathPanel.classList.toggle("hidden", !reelStarted);
  el.recommendPanel.classList.toggle("hidden", !reelStarted || state.path !== "recommend");
  el.exactPanel.classList.toggle("hidden", !reelStarted || state.path !== "exact");
  el.resultPanel.classList.toggle("hidden", !reelStarted);
  el.backingPanel.classList.toggle("hidden", !reelStarted);
  el.similarPanel.classList.toggle("hidden", !reelStarted);
  el.backingFields.classList.toggle("hidden", state.backingMode !== "yes" || !lineReady);
  setActiveButtons("data-unit", state.unitSystem);
  setActiveButtons("data-path", state.path);
  setActiveButtons("data-backing", state.backingMode);
  renderReelSummary();
  renderRecommendations();
  renderLineSummary();
  renderCapacityResult();
  renderBackingResult();
  renderSimilarLines();
}

function scrollToMainResultAfterRender() {
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      var resultTarget = byId("reelcalc-main-result");
      if (!resultTarget) return;

      var header = document.querySelector("header") ||
        document.querySelector(".header") ||
        document.querySelector(".site-header") ||
        document.querySelector(".Header") ||
        document.querySelector("#header");
      var headerHeight = header ? header.getBoundingClientRect().height : 0;
      var isMobileViewport = window.matchMedia &&
        window.matchMedia("(max-width: 700px)").matches;
      var extraSpacing = isMobileViewport ? 96 : 20;
      var targetPosition = resultTarget.getBoundingClientRect().top +
        window.scrollY -
        headerHeight -
        extraSpacing;

      window.scrollTo({
        top: Math.max(targetPosition, 0),
        behavior: "smooth"
      });
    });
  });
}

function setActiveButtons(dataName, value) {
  document.querySelectorAll("[" + dataName + "]").forEach(function(button) {
    button.classList.toggle("active", button.getAttribute(dataName) === value);
  });
}

function updateManualToggleStates() {
  updateManualToggle(el.manualReelToggle, state.useManualReel, "Enter reel manually");
  updateManualToggle(el.manualLineToggle, state.useManualLine, "Enter line manually");
  updateManualToggle(el.manualBackingToggle, state.useManualBacking, "Enter backing manually");
  el.manualReelPanel.classList.toggle("hidden", !state.useManualReel);
  el.manualLinePanel.classList.toggle("hidden", !state.useManualLine);
  el.manualBackingPanel.classList.toggle("hidden", !state.useManualBacking);
  setControlsDisabled([el.reelBrand, el.reelModel, el.reelSize], state.useManualReel);
  setControlsDisabled([el.lineBrand, el.lineModel, el.lineLb], state.useManualLine);
  setControlsDisabled([el.backingBrand, el.backingModel, el.backingLb], state.useManualBacking);
}

function updateManualToggle(button, isActive, label) {
  button.classList.toggle("manual-active", isActive);
  button.setAttribute("aria-pressed", String(isActive));
  button.textContent = label + ": " + (isActive ? "On" : "Off");
}

function setControlsDisabled(controls, disabled) {
  controls.forEach(function(control) {
    if (!control) return;
    control.disabled = disabled;
    control.setAttribute("aria-disabled", String(disabled));
    var field = control.closest ? control.closest(".field") : null;
    if (field) field.classList.toggle("field-disabled", disabled);
  });
}

function switchUnitSystem(nextUnit) {
  if (!nextUnit || nextUnit === state.unitSystem) return;
  var previousUnit = state.unitSystem;
  convertDisplayedUnitInputs(previousUnit, nextUnit);
  state.unitSystem = nextUnit;
  updateManualReel();
  updateManualLine();
  updateManualBacking();
  populateLineFilters();
  populateBackingFilters();
  renderAll();
  trackWizardEvent("wizard_unit_changed", {
    page_type: "setup_wizard",
    unit_system: state.unitSystem
  });
}

function convertDisplayedUnitInputs(fromUnit, toUnit) {
  convertInputValue(el.manualReelYards, function(value) {
    return convertLengthDisplay(value, fromUnit, toUnit);
  }, 0);
  convertInputValue(el.manualReelLb, function(value) {
    return convertManualReelSecondDisplay(value, fromUnit, toUnit);
  }, toUnit === "metric" ? 3 : 0);
  convertInputValue(el.manualLineLb, function(value) {
    return convertStrengthDisplay(value, fromUnit, toUnit);
  }, toUnit === "metric" ? 1 : 0);
  convertInputValue(el.manualLineDiameter, function(value) {
    return convertDiameterDisplay(value, fromUnit, toUnit);
  }, toUnit === "metric" ? 3 : 4);
  convertInputValue(el.manualBackingLb, function(value) {
    return convertStrengthDisplay(value, fromUnit, toUnit);
  }, toUnit === "metric" ? 1 : 0);
  convertInputValue(el.manualBackingDiameter, function(value) {
    return convertDiameterDisplay(value, fromUnit, toUnit);
  }, toUnit === "metric" ? 3 : 4);
  convertInputValue(el.mainLineYards, function(value) {
    return convertLengthDisplay(value, fromUnit, toUnit);
  }, 0);
}

function convertInputValue(input, converter, digits) {
  if (!input || input.value === "") return;
  var value = Number(input.value);
  if (!Number.isFinite(value)) return;
  input.value = formatInputNumber(converter(value), digits);
}

function convertLengthDisplay(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  return toUnit === "metric" ? value / YARDS_PER_METER : value * YARDS_PER_METER;
}

function convertStrengthDisplay(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  return toUnit === "metric" ? value / LB_PER_KG : value * LB_PER_KG;
}

function convertDiameterDisplay(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  return toUnit === "metric" ? value * MM_PER_INCH : value / MM_PER_INCH;
}

function convertManualReelSecondDisplay(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  if (toUnit === "metric") {
    return monoDiameter(Number(value)) * MM_PER_INCH;
  }
  return estimateMonoLbFromDiameter(Number(value) / MM_PER_INCH);
}

function updateUnitLabels() {
  var metric = isMetric();
  el.manualReelCapacityLabel.textContent = metric ? "Rated capacity meters" : "Rated capacity yards";
  el.manualReelStrengthLabel.textContent = metric ? "Rated line diameter mm" : "Rated line lb test";
  el.lineLbLabel.textContent = metric ? "Kg test" : "Lb test";
  el.manualLineStrengthLabel.textContent = metric ? "Line kg test" : "Line lb test";
  el.manualLineDiameterLabel.textContent = metric ? "Diameter mm" : "Diameter in";
  el.backingLbLabel.textContent = metric ? "Kg test" : "Lb test";
  el.manualBackingStrengthLabel.textContent = metric ? "Backing kg test" : "Backing lb test";
  el.manualBackingDiameterLabel.textContent = metric ? "Backing diameter mm" : "Backing diameter in";
  el.mainLineYardsLabel.textContent = metric ? "Desired main line meters" : "Desired main line yards";
  el.mainLineSlider.setAttribute("aria-label", metric ? "Desired main line meters" : "Desired main line yards");
  el.manualReelYards.placeholder = metric ? "150" : "165";
  el.manualReelLb.placeholder = metric ? "0.305" : "10";
  el.manualLineLb.placeholder = metric ? "6.8" : "15";
  el.manualLineDiameter.placeholder = metric ? "0.229" : "0.009";
  el.manualBackingDiameter.placeholder = metric ? "0.305" : "0.012";
  el.manualReelLb.min = metric ? "0.001" : "1";
  el.manualReelLb.step = metric ? "0.001" : "1";
  el.manualLineLb.step = metric ? "0.1" : "1";
  el.manualBackingLb.step = metric ? "0.1" : "1";
  el.manualLineDiameter.step = metric ? "0.001" : "0.0001";
  el.manualBackingDiameter.step = metric ? "0.001" : "0.0001";
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(function(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }).map(String))).sort(function(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}

function fillSelect(select, options, placeholder, selectedValue, formatOption) {
  var safeValue = selectedValue === undefined || selectedValue === null ? "" : String(selectedValue);
  select.innerHTML = "";
  var placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);
  options.forEach(function(optionValue) {
    var option = document.createElement("option");
    option.value = String(optionValue);
    option.textContent = formatOption ? formatOption(optionValue) : String(optionValue);
    select.appendChild(option);
  });
  select.value = options.map(String).includes(safeValue) ? safeValue : "";
}

function populateReelFilters() {
  var brand = state.reelFilters.brand;
  var model = state.reelFilters.model;
  var size = state.reelFilters.size;
  var brands = uniqueSorted(state.reels.map(function(reel) { return reel.brand; }));
  var modelPool = state.reels.filter(function(reel) {
    return !brand || reel.brand === brand;
  });
  var models = uniqueSorted(modelPool.map(function(reel) { return reel.model; }));
  var sizePool = modelPool.filter(function(reel) {
    return !model || reel.model === model;
  });
  fillSelect(el.reelBrand, brands, "Select brand", brand);
  fillSelect(el.reelModel, models, "Select model", model, function(modelName) {
    if (!brand) return modelName;
    return formatReelModelOption(modelName, modelPool);
  });
  if (brand && model) {
    var exactReels = sizePool.slice().sort(function(a, b) {
      var sizeCompare = String(a.size_label || a.size_class || "").localeCompare(
        String(b.size_label || b.size_class || ""),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
      if (sizeCompare) return sizeCompare;
      return String(a.sku || a.id).localeCompare(String(b.sku || b.id), undefined, { numeric: true, sensitivity: "base" });
    });
    fillSelect(el.reelSize, exactReels.map(function(reel) { return reel.id; }), "Select exact size", size, function(reelId) {
      var reel = exactReels.find(function(item) { return item.id === reelId; });
      return formatExactReelOption(reel, exactReels);
    });
  } else {
    var sizes = uniqueSorted(sizePool.map(function(reel) { return reel.size_label || reel.size_class; }));
    fillSelect(el.reelSize, sizes, "Select size", size, function(sizeLabel) {
      return formatReelSizeOption(sizeLabel, sizePool);
    });
  }
}

function formatReelModelOption(modelName, modelPool) {
  var reels = modelPool.filter(function(reel) {
    return reel.model === modelName;
  });
  if (!reels.length) return modelName;

  var missingCount = reels.filter(function(reel) {
    return !isReelReady(reel);
  }).length;
  if (!missingCount) return modelName;
  if (missingCount === reels.length) return modelName + " - manual capacity needed";
  return modelName + " - some sizes need manual capacity";
}

function formatReelSizeOption(sizeLabel, sizePool) {
  var reels = sizePool.filter(function(reel) {
    return (reel.size_label || reel.size_class) === sizeLabel;
  });
  if (!reels.length) return sizeLabel;
  return reels.some(function(reel) { return !isReelReady(reel); })
    ? sizeLabel + " - manual capacity needed"
    : sizeLabel;
}

function formatExactReelOption(reel, exactReels) {
  if (!reel) return "Unknown reel variant";
  var sizeLabel = reel.size_label || reel.size_class || reel.sku || "Unknown size";
  var sameSize = exactReels.filter(function(item) {
    return (item.size_label || item.size_class) === sizeLabel;
  });
  var label = sizeLabel;
  if (sameSize.length > 1) {
    label += " - " + (reel.sku || reel.id);
    if (reel.gear_ratio) label += " - " + reel.gear_ratio;
  }
  if (!isReelReady(reel)) label += " - manual capacity needed";
  return label;
}

function resolveReelFromFilters() {
  var exactMatch = state.reels.find(function(reel) {
    return reel.id === state.reelFilters.size;
  });
  if (exactMatch && exactMatch.brand === state.reelFilters.brand && exactMatch.model === state.reelFilters.model) {
    selectReel(exactMatch, false);
    return;
  }
  var matches = state.reels.filter(function(reel) {
    var reelSize = reel.size_label || reel.size_class;
    return (!state.reelFilters.brand || reel.brand === state.reelFilters.brand) &&
      (!state.reelFilters.model || reel.model === state.reelFilters.model) &&
      (!state.reelFilters.size || reelSize === state.reelFilters.size);
  });
  if (state.reelFilters.brand && state.reelFilters.model && state.reelFilters.size && matches.length) {
    selectReel(matches[0], false);
  } else if (matches.length === 1 && state.reelFilters.brand && state.reelFilters.model) {
    selectReel(matches[0], false);
  }
}

function selectReel(reel, updateSearch) {
  state.selectedReel = reel;
  state.useManualReel = false;
  state.manualReel = null;
  state.reelFilters.brand = reel.brand || "";
  state.reelFilters.model = reel.model || "";
  state.reelFilters.size = reel.id || "";
  populateReelFilters();
  if (!isReelReady(reel)) {
    state.useManualReel = true;
    el.manualReelPanel.classList.remove("hidden");
  } else {
    el.manualReelPanel.classList.add("hidden");
  }
}

function applyReelPreloadFromUrl() {
  var requested = new URLSearchParams(window.location.search).get("reel");
  if (!requested) return null;

  var normalizedRequested = normalizeSearch(requested);
  var reel = state.reels.find(function(item) {
    return item.id === requested;
  }) || state.reels.find(function(item) {
    return normalizeSearch(item.id) === normalizedRequested ||
      normalizeSearch(item.sku) === normalizedRequested;
  });

  if (reel) {
    selectReel(reel, false);
    resetDesiredMainLine();
    return reel;
  }
  trackWizardEvent("wizard_reel_not_found", {
    page_type: "setup_wizard",
    selection_source: "url_preload"
  });
  return null;
}

function populateLineFilters() {
  var brand = state.lineFilters.brand;
  var model = state.lineFilters.model;
  var lb = state.lineFilters.lb;
  var brands = uniqueSorted(state.lines.map(function(line) { return line.brand; }));
  var modelPool = state.lines.filter(function(line) {
    return !brand || line.brand === brand;
  });
  var models = uniqueSorted(modelPool.map(function(line) { return line.model; }));
  var lbPool = modelPool.filter(function(line) {
    return !model || line.model === model;
  });
  var lbs = uniqueSorted(lbPool.map(function(line) { return line.lb; }));
  fillSelect(el.lineBrand, brands, "Select line brand", brand);
  fillSelect(el.lineModel, models, "Select line model", model);
  fillSelect(el.lineLb, lbs, isMetric() ? "Select kg test" : "Select lb test", lb, formatStrength);
}

function resolveLineFromFilters() {
  var matches = state.lines.filter(function(line) {
    return (!state.lineFilters.brand || line.brand === state.lineFilters.brand) &&
      (!state.lineFilters.model || line.model === state.lineFilters.model) &&
      (!state.lineFilters.lb || String(line.lb) === String(state.lineFilters.lb));
  });
  if (state.lineFilters.brand && state.lineFilters.model && state.lineFilters.lb && matches.length) {
    selectLine(matches[0], false);
  } else if (matches.length === 1 && state.lineFilters.brand && state.lineFilters.model) {
    selectLine(matches[0], false);
  }
}

function selectLine(line, updateSearch) {
  state.selectedLine = line;
  state.selectedSetup = null;
  state.useManualLine = false;
  state.manualLine = null;
  state.lineFilters.brand = line.brand || "";
  state.lineFilters.model = line.model || "";
  state.lineFilters.lb = String(line.lb || "");
  el.manualLinePanel.classList.add("hidden");
  populateLineFilters();
}

function isBackingLineOption(line) {
  var type = String(line.type || "").toLowerCase();
  return Number(line.dia_in) > 0 && (type.includes("braid") || type.includes("mono"));
}

function populateBackingFilters() {
  var brand = state.backingFilters.brand;
  var model = state.backingFilters.model;
  var lb = state.backingFilters.lb;
  var backingPool = state.lines.filter(isBackingLineOption);
  var brands = uniqueSorted(backingPool.map(function(line) { return line.brand; }));
  var modelPool = backingPool.filter(function(line) {
    return !brand || line.brand === brand;
  });
  var models = uniqueSorted(modelPool.map(function(line) { return line.model; }));
  var lbPool = modelPool.filter(function(line) {
    return !model || line.model === model;
  });
  var lbs = uniqueSorted(lbPool.map(function(line) { return line.lb; }));
  fillSelect(el.backingBrand, brands, "Select backing brand", brand);
  fillSelect(el.backingModel, models, "Select backing model", model);
  fillSelect(el.backingLb, lbs, isMetric() ? "Select kg test" : "Select lb test", lb, formatStrength);
}

function resolveBackingFromFilters() {
  var matches = state.lines.filter(function(line) {
    return isBackingLineOption(line) &&
      (!state.backingFilters.brand || line.brand === state.backingFilters.brand) &&
      (!state.backingFilters.model || line.model === state.backingFilters.model) &&
      (!state.backingFilters.lb || String(line.lb) === String(state.backingFilters.lb));
  });
  if (state.backingFilters.brand && state.backingFilters.model && state.backingFilters.lb && matches.length) {
    selectBackingLine(matches[0]);
  } else if (matches.length === 1 && state.backingFilters.brand && state.backingFilters.model) {
    selectBackingLine(matches[0]);
  }
}

function selectBackingLine(line) {
  state.backingLine = line;
  state.useManualBacking = false;
  state.manualBacking = null;
  state.backingFilters.brand = line.brand || "";
  state.backingFilters.model = line.model || "";
  state.backingFilters.lb = String(line.lb || "");
  el.manualBackingPanel.classList.add("hidden");
  populateBackingFilters();
}

function updateManualReel() {
  var yards = displayLengthToYards(Number(el.manualReelYards.value));
  var lb;
  var diameter;
  var entryMode = isMetric() ? "metric-diameter" : "standard-strength";
  if (entryMode === "metric-diameter") {
    diameter = displayDiameterToInches(Number(el.manualReelLb.value));
    lb = estimateMonoLbFromDiameter(diameter);
  } else {
    lb = displayStrengthToLb(Number(el.manualReelLb.value));
    diameter = monoDiameter(lb);
  }
  if (yards > 0 && lb > 0 && diameter > 0) {
    state.manualReel = {
      id: "manual-reel",
      brand: "Manual",
      model: "Manual reel entry",
      sku: "",
      size_label: "",
      size_class: "",
      capacity_yards: yards,
      rated_line_lb: lb,
      rated_line_diameter_in: diameter,
      manual_reel_entry_mode: entryMode,
      capacity_note: formatManualReelCapacityNote(yards, lb, diameter, entryMode),
      capacity_status: "ready",
      data_warnings: [],
      source_url: "",
      search_text: "manual reel"
    };
  } else {
    state.manualReel = null;
  }
}

function updateManualLine() {
  var type = el.manualLineType.value;
  var lb = displayStrengthToLb(Number(el.manualLineLb.value));
  var diameter = displayDiameterToInches(Number(el.manualLineDiameter.value));
  if (type && lb > 0 && diameter > 0) {
    state.manualLine = {
      id: "manual-line",
      brand: "Manual",
      model: "Manual line entry",
      type: type,
      lb: lb,
      dia_in: diameter,
      dia_mm: Number((diameter * MM_PER_INCH).toFixed(3)),
      source_note: "Manual entry"
    };
  } else {
    state.manualLine = null;
  }
}

function updateManualBacking() {
  var type = el.manualBackingType.value;
  var lb = displayStrengthToLb(Number(el.manualBackingLb.value));
  var diameter = displayDiameterToInches(Number(el.manualBackingDiameter.value));
  if (type && lb > 0 && diameter > 0) {
    state.manualBacking = {
      id: "manual-backing",
      brand: "Manual",
      model: "Manual backing entry",
      type: type,
      lb: lb,
      dia_in: diameter,
      dia_mm: Number((diameter * MM_PER_INCH).toFixed(3))
    };
  } else {
    state.manualBacking = null;
  }
}

function getActiveReel() {
  if (state.useManualReel) return state.manualReel;
  return state.selectedReel;
}

function getActiveMainLine() {
  if (state.path === "recommend") return state.selectedSetup ? state.selectedSetup.line : null;
  if (state.useManualLine) return state.manualLine;
  return state.selectedLine;
}

function getBackingLine() {
  if (state.useManualBacking && state.manualBacking) return state.manualBacking;
  if (state.backingLine) return state.backingLine;
  return DEFAULT_BACKING;
}

function getVisibleReelWarnings(values) {
  if (!Array.isArray(values)) return [];
  return values.map(function(value) {
    return String(value || "")
      .replace(/source\/spec should be verified before public use\.?/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }).filter(Boolean);
}

function renderReelSummary() {
  var reel = getActiveReel();
  if (state.useManualReel && !state.manualReel) {
    el.reelSummary.className = "summary-strip selected-card warning-box";
    el.reelSummary.classList.remove("hidden");
    var selectedText = isMetric()
      ? "Manual reel entry is active. Enter rated capacity meters and rated line diameter in mm to calculate."
      : "Manual reel entry is active. Enter rated capacity yards and rated line lb test to calculate.";
    if (state.selectedReel) {
      selectedText = isReelReady(state.selectedReel)
        ? "Manual reel entry is active. Use the manual fields above to enter a printed reel capacity."
        : "This reel is missing required capacity data in the source file. Use the manual fields above to enter the printed reel capacity and calculate.";
    }
    el.reelSummary.textContent = selectedText;
    return;
  }
  if (!reel) {
    el.reelSummary.className = "summary-strip hidden";
    el.reelSummary.innerHTML = "";
    return;
  }
  var warnings = getVisibleReelWarnings(reel.data_warnings);
  var ready = isReelReady(reel);
  var html = "<div class=\"selected-card-head\">";
  html += "<div><span class=\"eyebrow\">Your reel</span><strong>" + escapeHtml(formatReelShort(reel)) + "</strong></div>";
  html += "</div>";
  html += "<div class=\"selected-card-grid\">";
  if (ready) {
    html += "<div><span>Rating used</span><strong>" + formatReelRating(reel) + "</strong></div>";
    var diameterLabel = reel.id === "manual-reel" && reel.manual_reel_entry_mode !== "metric-diameter" ? "Estimated mono diameter" : "Rated diameter";
    html += "<div><span>" + diameterLabel + "</span><strong>" + formatDiameterWithUnit(reel.rated_line_diameter_in) + "</strong></div>";
    var capacityNote = reel.id === "manual-reel" ? formatManualReelCapacityNote(reel.capacity_yards, reel.rated_line_lb, reel.rated_line_diameter_in, reel.manual_reel_entry_mode) : reel.capacity_note;
    if (capacityNote) html += "<div><span>Printed capacity</span><strong>" + escapeHtml(capacityNote) + "</strong></div>";
    if (reel.braid_capacity_note) html += "<div><span>Braid note</span><strong>" + escapeHtml(reel.braid_capacity_note) + "</strong></div>";
  } else {
    html += "<div class=\"tiny-note\">This reel is missing required capacity data. Manual entry is required.</div>";
  }
  html += "</div>";
  if (warnings.length) html += "<div class=\"tiny-note\">Data note: " + escapeHtml(warnings.join(" ")) + "</div>";
  html += reelAffiliateHtml(reel);
  el.reelSummary.className = ready ? "summary-strip selected-card" : "summary-strip selected-card warning-box";
  el.reelSummary.classList.remove("hidden");
  el.reelSummary.innerHTML = html;
}

function reelAffiliateHtml(reel) {
  if (state.useManualReel || !reel || !reel.id) return "";
  var offer = resolvePreferredReelAffiliate(reel.id);
  if (!offer) return "";

  var html = "<div class=\"reel-affiliate-row\">";
  html += "<a class=\"reel-affiliate-button\" href=\"" + escapeHtml(offer.url) + "\" target=\"_blank\" rel=\"sponsored nofollow noopener\" data-reel-affiliate-link data-reel-id=\"" + escapeHtml(reel.id) + "\" data-retailer=\"" + escapeHtml(offer.retailerId) + "\" data-match-type=\"" + escapeHtml(offer.matchType) + "\">" + escapeHtml(offer.label) + "</a>";
  html += "<span class=\"reel-affiliate-disclosure\">" + escapeHtml(offer.disclosure) + "</span>";
  html += "</div>";
  return html;
}

function isAllowedRetailerUrl(value, retailer) {
  try {
    var url = new URL(String(value || ""));
    var host = url.hostname.toLowerCase();
    var allowedHosts = Array.isArray(retailer && retailer.allowedHosts)
      ? retailer.allowedHosts
      : [];
    var allowed = allowedHosts.some(function(allowedHost) {
      var expected = String(allowedHost || "").toLowerCase();
      return expected && (host === expected || host.endsWith("." + expected));
    });
    return url.protocol === "https:" && allowed ? url.href : "";
  } catch (error) {
    return "";
  }
}

function resolvePreferredReelAffiliate(reelId) {
  var data = state.affiliateData;
  var mapping = data && data.reels ? data.reels[reelId] : null;
  var priority = data && Array.isArray(data.retailerPriority)
    ? data.retailerPriority
    : [];
  if (!mapping) return null;

  for (var index = 0; index < priority.length; index += 1) {
    var retailerId = priority[index];
    var retailer = data.retailers && data.retailers[retailerId];
    var offer = mapping.offers && mapping.offers[retailerId]
      ? mapping.offers[retailerId].reel
      : null;
    var url = isAllowedRetailerUrl(offer && offer.url, retailer);
    if (!retailer || !offer || !url) continue;
    var isSearch = offer.matchType === "search";
    return {
      retailerId: retailerId,
      url: url,
      matchType: isSearch ? "search" : "exact",
      label: offer.label || (isSearch ? retailer.searchLabel : retailer.directLabel) ||
        "Check Current Price at " + (retailer.name || retailerId),
      disclosure: [data.genericDisclosure, retailer.disclosure].filter(Boolean).join(" ")
    };
  }
  return null;
}

function trackWizardEvent(name, parameters, options) {
  if (window.ReelCalcAnalytics && typeof window.ReelCalcAnalytics.track === "function") {
    window.ReelCalcAnalytics.track(name, parameters || {}, options || {});
    return;
  }
  window.ReelCalcAnalyticsQueue = window.ReelCalcAnalyticsQueue || [];
  window.ReelCalcAnalyticsQueue.push({
    name: name,
    parameters: parameters || {},
    options: options || {}
  });
}

function reelEventParameters(reel) {
  if (!reel) return {};
  return {
    reel_id: reel.id || "",
    reel_brand: reel.brand || "",
    reel_model: reel.model || "",
    reel_size: reel.size_label || reel.size_class || "",
    reel_size_class: reel.size_class || reel.size_label || "",
    capacity_status: isReelReady(reel) ? "ready" : "missing"
  };
}

function lineEventParameters(line) {
  if (!line) return {};
  return {
    line_id: line.id || "",
    line_brand: line.brand || "",
    line_model: line.model || "",
    line_type: genericLineType(line.type || "line"),
    line_lb: Number(line.lb) || 0,
    line_diameter_mm: Number(line.dia_in) > 0
      ? Number((Number(line.dia_in) * MM_PER_INCH).toFixed(3))
      : 0
  };
}

function trackSelectedReel(selectionSource) {
  var reel = getActiveReel();
  if (!reel) return;
  trackWizardEvent("wizard_reel_selected", Object.assign({
    page_type: "setup_wizard",
    selection_source: selectionSource,
    manual_entry: reel.id === "manual-reel"
  }, reelEventParameters(reel)));
}

function trackSelectedLine(line, selectionSource, lineRole) {
  if (!line) return;
  trackWizardEvent("wizard_line_selected", Object.assign({
    page_type: "setup_wizard",
    selection_source: selectionSource,
    line_role: lineRole,
    manual_entry: line.id === "manual-line" || line.id === "manual-backing"
  }, reelEventParameters(getActiveReel()), lineEventParameters(line)));
}

function trackWizardCalculation(selectionSource) {
  var reel = getActiveReel();
  var line = getActiveMainLine();
  if (!isReelReady(reel) || !isLineReady(line)) return;
  trackWizardEvent("wizard_calculation_completed", Object.assign({
    page_type: "setup_wizard",
    selection_source: selectionSource,
    wizard_mode: state.path,
    unit_system: state.unitSystem,
    fishing_use: state.path === "recommend" ? el.fishingType.value : "",
    priority: state.path === "recommend" ? el.priority.value : "",
    backing_used: state.backingMode === "yes"
  }, reelEventParameters(reel), lineEventParameters(line)));
}

function trackRecommendedSetup(setup, index) {
  if (!setup || !setup.line) return;
  var reel = getActiveReel();
  var params = Object.assign({
    page_type: "setup_wizard",
    selection_source: "recommendation",
    fishing_use: el.fishingType.value,
    priority: el.priority.value,
    recommendation_rank: index + 1,
    recommendation_type: setup.useCase || "",
    line_type: genericLineType(setup.line.type || "line"),
    line_lb: Number(setup.line.lb) || 0,
    line_diameter_mm: Number(setup.line.dia_in) > 0
      ? Number((Number(setup.line.dia_in) * MM_PER_INCH).toFixed(3))
      : 0
  }, reelEventParameters(reel));
  trackWizardEvent("wizard_setup_selected", params);
  trackWizardCalculation("recommendation");
}

function trackBackingCalculation(selectionSource) {
  var reel = getActiveReel();
  var mainLine = getActiveMainLine();
  var backing = getBackingLine();
  if (state.backingMode !== "yes" ||
      !isReelReady(reel) ||
      !isLineReady(mainLine) ||
      !isLineReady(backing) ||
      !(Number(state.desiredMainYards) > 0)) return;
  trackWizardEvent("wizard_backing_calculated", Object.assign({
    page_type: "setup_wizard",
    selection_source: selectionSource,
    unit_system: state.unitSystem,
    desired_main_yards: Number(state.desiredMainYards.toFixed(1)),
    main_line_type: genericLineType(mainLine.type || "line"),
    main_line_lb: Number(mainLine.lb) || 0,
    backing_line_id: backing.id || "",
    backing_type: genericLineType(backing.type || "line"),
    backing_lb: Number(backing.lb) || 0,
    backing_diameter_mm: Number(backing.dia_in) > 0
      ? Number((Number(backing.dia_in) * MM_PER_INCH).toFixed(3))
      : 0
  }, reelEventParameters(reel)));
}

function renderLineSummary() {
  if (state.path !== "exact") {
    el.lineSummary.className = "summary-strip hidden";
    el.lineSummary.innerHTML = "";
    return;
  }
  var line = getActiveMainLine();
  if (state.useManualLine && !state.manualLine) {
    el.lineSummary.className = "summary-strip selected-card warning-box";
    el.lineSummary.textContent = "Manual line entry is active. Enter line type, " + strengthUnit() + " test, and diameter (" + diameterUnit() + ") to calculate.";
    return;
  }
  if (!line) {
    el.lineSummary.className = "summary-strip hidden";
    el.lineSummary.innerHTML = "";
    return;
  }
  if (!isLineReady(line)) {
    el.lineSummary.className = "summary-strip selected-card warning-box";
    el.lineSummary.textContent = "This line is missing diameter data. Enter a manual diameter before calculating.";
    return;
  }
  el.lineSummary.className = "summary-strip selected-card";
  el.lineSummary.innerHTML = "<div class=\"selected-card-head\"><div><span class=\"eyebrow\">Your line</span><strong>" + escapeHtml(formatLineShort(line)) + "</strong></div></div><div class=\"selected-card-grid\"><div><span>Diameter</span><strong>" + formatDiameterWithUnit(line.dia_in) + "</strong></div></div>";
}

function renderRecommendations() {
  if (state.path !== "recommend") return;
  var reel = getActiveReel();
  if (!reel || !isReelReady(reel)) {
    el.recommendations.innerHTML = "<div class=\"empty-state warning-box\">Choose a reel with capacity data, or enter manual reel specs, to get recommendations.</div>";
    state.recommendations = [];
    return;
  }
  if (!window.ReelCalcRecommendations) {
    el.recommendations.innerHTML = "<div class=\"empty-state warning-box\">Recommendation engine did not load. Refresh the page and try again.</div>";
    state.recommendations = [];
    return;
  }
  var compatibility = window.ReelCalcRecommendations.recommendationCompatibility
    ? window.ReelCalcRecommendations.recommendationCompatibility(reel, el.fishingType.value)
    : { recommend: true };
  if (compatibility && compatibility.recommend === false) {
    state.selectedSetup = null;
    state.recommendations = [];
    el.recommendations.innerHTML = "<div class=\"empty-state warning-box\">" + escapeHtml(compatibility.message) + "</div>";
    return;
  }
  state.recommendations = window.ReelCalcRecommendations.recommendSetups({
    reel: reel,
    lines: state.lines,
    fishingType: el.fishingType.value,
    priority: el.priority.value,
    calculateFullSpoolCapacity: calculateFullSpoolCapacity
  }).filter(function(setup) {
    return setup.line && setup.line.dia_in;
  });
  if (!state.recommendations.length) {
    el.recommendations.innerHTML = "<div class=\"empty-state warning-box\">No matching line records were found for this recommendation set.</div>";
    return;
  }
  var topRecommendation = state.recommendations[0];
  var recommendationKey = [
    reel.id || "manual-reel",
    el.fishingType.value,
    el.priority.value
  ].join("|");
  trackWizardEvent("wizard_recommendation_generated", Object.assign({
    page_type: "setup_wizard",
    fishing_use: el.fishingType.value,
    priority: el.priority.value,
    recommendation_count: state.recommendations.length,
    top_line_type: genericLineType(topRecommendation.line.type || "line"),
    top_line_lb: Number(topRecommendation.line.lb) || 0,
    top_recommendation_type: topRecommendation.useCase || ""
  }, reelEventParameters(reel)), { onceKey: recommendationKey });
  el.recommendations.innerHTML = state.recommendations.map(function(setup, index) {
    var capacity = setup.capacityYards || calculateFullSpoolCapacity(reel, setup.line);
    var selected = state.selectedSetup && state.selectedSetup.title === setup.title && state.selectedSetup.line.id === setup.line.id;
    var isBestPick = index === 0;
    var html = "<article class=\"setup-card" + (isBestPick ? " best-pick" : "") + (selected ? " selected" : "") + "\">";
    html += "<div class=\"setup-card-head\"><h3>" + escapeHtml(setup.title) + "</h3>";
    if (isBestPick) html += "<span class=\"pill best\">Best Pick</span>";
    html += "</div>";
    html += "<p class=\"setup-headline\"><strong>" + escapeHtml(formatSetupHeadline(setup)) + "</strong></p>";
    html += "<div class=\"card-meta\">";
    html += "<span class=\"pill subtle\">" + formatDiameterWithUnit(setup.line.dia_in) + "</span>";
    html += "<span class=\"pill subtle\">" + formatLength(capacity, 1) + " est.</span>";
    html += "<span class=\"pill subtle\">" + escapeHtml(recommendationPurposeLabel(setup)) + "</span>";
    html += "</div>";
    html += "<p>" + escapeHtml(setup.explanation) + "</p>";
    if (setup.warnings && setup.warnings.length) {
      html += "<div class=\"setup-warning\"><strong>Warning:</strong> " + escapeHtml(setup.warnings.join(" ")) + "</div>";
    }
    if (setup.tradeoffs && setup.tradeoffs.length) {
      html += "<p class=\"tiny-note\"><strong>Keep in mind:</strong> " + escapeHtml(setup.tradeoffs.join(" ")) + "</p>";
    }
    var braidCapacityNote = publishedBraidCapacityNote(reel, setup.line);
    if (braidCapacityNote) {
      html += "<p class=\"tiny-note\">" + escapeHtml(braidCapacityNote) + " A specific braid may vary from the published rating.</p>";
    } else {
      html += "<p class=\"tiny-note\">" + escapeHtml(setup.diameterNote || ("Estimate uses " + formatGenericLineShort(setup.line) + " diameter data.")) + " If you pick a specific line later, ReelCalc uses that line's listed diameter.</p>";
    }
    html += "<button class=\"use-button\" type=\"button\" data-setup-index=\"" + String(index) + "\">" + (selected ? "Selected" : "Use setup") + "</button>";
    html += "</article>";
    return html;
  }).join("");
}

function formatSetupHeadline(setup) {
  var line = setup.line;
  var main = formatStrength(line.lb) + " " + String(line.type || "line").toLowerCase();
  if (setup.leaderType && setup.leaderLb) {
    return main + " + " + formatStrength(setup.leaderLb) + " " + setup.leaderType.toLowerCase() + " leader";
  }
  return main;
}

function recommendationPurposeLabel(setup) {
  var labels = {
    "best-overall": "All-around",
    "casting-distance": "Longer casts",
    "finesse": "Finesse",
    "heavy-cover": "More power",
    "simple-mono": "Easy setup",
    "fluorocarbon": "Low visibility"
  };
  return labels[setup.useCase] || "Recommended";
}

function formatGenericLineShort(line) {
  if (!line) return "";
  var type = genericLineType(line.type);
  return [formatStrength(line.lb), type].filter(Boolean).join(" ");
}

function typicalBraidDiameter(line) {
  if (!line || !window.ReelCalcRecommendations || !window.ReelCalcRecommendations.typicalDiameter) return null;
  var type = String(line.type || "").toLowerCase();
  if (!type.includes("braid")) return null;
  var typical = window.ReelCalcRecommendations.typicalDiameter(state.lines, "Braid", Number(line.lb));
  return typical && Number(typical.dia_in) > 0 ? Number(typical.dia_in) : null;
}

function getPublishedBraidEstimate(reel, line) {
  return calculatePublishedBraidCapacity(reel, line, typicalBraidDiameter(line));
}

function calculateFullSpoolCapacity(reel, line) {
  return calculateCoreFullSpoolCapacity(reel, line, {
    usePublishedBraid: true,
    referenceBraidDiameterIn: typicalBraidDiameter(line)
  });
}

function publishedBraidCapacityNote(reel, line) {
  var estimate = getPublishedBraidEstimate(reel, line);
  if (!estimate) return "";
  if (estimate.method === "exact" && estimate.anchors.length) {
    var rating = estimate.anchors[0];
    return "Capacity uses this reel's published " + formatStrength(rating.lb) + " braid rating of " + formatLength(rating.yards, 0, true) + ".";
  }
  if (estimate.method.indexOf("diameter-adjusted") !== -1 && estimate.anchors.length) {
    var anchor = estimate.anchors[0];
    return "Capacity starts from this reel's published " + formatStrength(anchor.lb) + " braid rating of " + formatLength(anchor.yards, 0, true) + " and adjusts conservatively for this line's listed diameter.";
  }
  return "Capacity is anchored to this reel's published braid ratings near " + formatStrength(estimate.targetLb) + ".";
}

function genericLineType(typeValue) {
  var type = String(typeValue || "line").toLowerCase();
  if (type.includes("braid")) return "braid";
  if (type.includes("mono")) return "monofilament";
  if (type.includes("fluoro") && type.includes("leader")) return "fluorocarbon leader";
  if (type.includes("fluoro")) return "fluorocarbon";
  if (type.includes("copoly")) return "copolymer";
  return type;
}

function getVerifiedHandleTurnReel() {
  if (state.useManualReel || !state.selectedReel) return null;
  var reel = state.selectedReel;
  return reel.ipt_verification_status === "verified" && Number(reel.line_retrieve_in) > 0
    ? reel
    : null;
}

function formatIpt(ipt) {
  var value = Number(ipt);
  if (isMetric()) return formatNumber(value * MM_PER_INCH / 10, 1) + " cm per turn";
  return formatNumber(value, 1) + " in per turn";
}

function formatTurnEstimate(estimate) {
  if (!estimate) return "Unavailable";
  var html = "<strong>Approximately " + formatNumber(estimate.approximateTurns, 0) + " turns</strong>";
  html += "<span>Practical range: " + formatNumber(estimate.rangeMin, 0) + "-" + formatNumber(estimate.rangeMax, 0) + "</span>";
  return html;
}

function handleTurnEstimateHtml(parts) {
  var exactReel = getVerifiedHandleTurnReel();
  if (!exactReel) {
    return "<div class=\"handle-turn-unavailable\"><span class=\"estimate-flag\">ESTIMATE UNAVAILABLE</span><h3>Estimated Handle Turns</h3><p>Handle-turn estimate unavailable: a verified inches-per-turn specification has not yet been added for this exact reel variant.</p></div>";
  }

  var ipt = Number(exactReel.line_retrieve_in);
  var validParts = parts.filter(function(part) {
    return Number(part.yards) >= 0;
  });
  var totalYards = validParts.reduce(function(sum, part) {
    return sum + Number(part.yards);
  }, 0);
  var html = "<section class=\"handle-turn-estimate\" aria-label=\"Estimated handle turns\">";
  html += "<div class=\"handle-turn-heading\"><div><span class=\"estimate-flag\">ESTIMATED HANDLE TURNS ONLY</span><h3>Estimated Handle Turns</h3></div><span class=\"ipt-badge\">" + escapeHtml(formatIpt(ipt)) + "</span></div>";
  html += "<div class=\"handle-turn-grid\">";
  validParts.forEach(function(part) {
    var itemClass = part.kind === "backing" ? " backing" : " main-line";
    var itemTitle = part.kind === "backing" ? "Backing Handle Turns" : "Main-Line Handle Turns";
    html += "<div class=\"handle-turn-item" + itemClass + "\"><span class=\"handle-turn-block-title\">" + itemTitle + "</span><span class=\"handle-turn-line-label\">" + escapeHtml(part.label) + "</span>" + formatTurnEstimate(calculateHandleTurns(part.yards, ipt)) + "</div>";
  });
  if (validParts.length > 1) {
    html += "<div class=\"handle-turn-item total\"><span class=\"handle-turn-block-title\">Total Handle Turns</span><span class=\"handle-turn-line-label\">Backing + main line</span>" + formatTurnEstimate(calculateHandleTurns(totalYards, ipt)) + "</div>";
  }
  html += "</div>";
  html += "<div class=\"handle-turn-warning\"><strong>ESTIMATE ONLY</strong><p>Use this as a starting point. Line tension, packing, and spool fill can change the actual count. Watch the spool and stop at your preferred fill level.</p></div>";
  html += "</section>";
  return html;
}

function formatRetailSpoolLength(yards) {
  var value = Number(yards);
  if (!Number.isFinite(value)) return "";
  if (isMetric()) {
    return formatNumber(value / YARDS_PER_METER, 0) + " m (" + formatNumber(value, 0) + " yd)";
  }
  return formatNumber(value, 0) + " yd";
}

function recommendationAffiliateHtml(line, fullCapacity) {
  if (state.path !== "recommend" || !state.selectedSetup || !line ||
      !window.ReelCalcAffiliateLinks || !state.affiliateData) return "";

  var requiredYards = state.backingMode === "yes"
    ? Number(state.desiredMainYards)
    : Number(fullCapacity);
  if (!(requiredYards > 0)) return "";

  var offer = window.ReelCalcAffiliateLinks.buildRecommendedLineOffer({
    affiliateData: state.affiliateData,
    line: line,
    requiredYards: requiredYards
  });
  if (!offer) return "";

  var lineLabel = formatGenericLineShort(line);
  var setupDescription = state.backingMode === "yes"
    ? "Your backing setup uses about " + formatLength(requiredYards, 0, true) + " of main line."
    : "A full spool is estimated to use about " + formatLength(requiredYards, 0, true) + ".";
  var buttonLabel = "Shop " + formatRetailSpoolLength(offer.suggestedSpoolYards) + " " + lineLabel + " options";
  var html = "<section class=\"line-affiliate-card\" aria-label=\"Shop the recommended main line\">";
  html += "<div class=\"line-affiliate-copy\"><span class=\"eyebrow\">Shop this main-line setup</span>";
  html += "<strong>Look for at least " + escapeHtml(formatRetailSpoolLength(offer.suggestedSpoolYards)) + " of " + escapeHtml(lineLabel) + "</strong>";
  html += "<p>" + escapeHtml(setupDescription) + " This brand-neutral search includes a small allowance for normal spool-fill variation.</p></div>";
  html += "<a class=\"line-affiliate-button\" href=\"" + escapeHtml(offer.url) + "\" target=\"_blank\" rel=\"sponsored nofollow noopener\" data-line-affiliate-link data-retailer=\"" + escapeHtml(offer.retailerId) + "\" data-match-type=\"" + escapeHtml(offer.matchType) + "\" data-required-yards=\"" + escapeHtml(String(Number(requiredYards.toFixed(1)))) + "\" data-spool-yards=\"" + escapeHtml(String(offer.suggestedSpoolYards)) + "\">" + escapeHtml(buttonLabel) + "</a>";
  html += "<span class=\"line-affiliate-disclosure\">" + escapeHtml(offer.disclosure) + "</span>";
  html += "</section>";
  return html;
}

function renderCapacityResult() {
  var reel = getActiveReel();
  var line = getActiveMainLine();
  if (state.useManualReel && !state.manualReel) {
    el.capacityResult.className = "empty-state warning-box";
    el.capacityResult.textContent = isMetric()
      ? "Enter the reel's rated capacity in meters and the rated line diameter in mm to calculate capacity."
      : "Enter the reel's rated capacity in yards and rated line lb test to calculate capacity.";
    return;
  }
  if (!reel) {
    el.capacityResult.className = "empty-state";
    el.capacityResult.textContent = "Choose a reel, or enter reel specs manually, to start calculating.";
    return;
  }
  if (!isReelReady(reel)) {
    el.capacityResult.className = "empty-state warning-box";
    el.capacityResult.textContent = "This reel is missing required capacity data. Enter rated capacity " + lengthUnitLong() + " and rated line " + strengthUnit() + " test to continue.";
    return;
  }
  if (!line) {
    el.capacityResult.className = "empty-state";
    el.capacityResult.textContent = state.path === "recommend" ? "Choose one of the recommended setups above." : "Choose a line from the database or enter line specs manually.";
    return;
  }
  if (!isLineReady(line)) {
    el.capacityResult.className = "empty-state warning-box";
    el.capacityResult.textContent = "The selected line is missing diameter data. Enter a manual line diameter before calculating.";
    return;
  }
  var capacity = calculateFullSpoolCapacity(reel, line);
  var lineLabel = formatActiveLineShort(line);
  var braidCapacityNote = publishedBraidCapacityNote(reel, line);
  var html = "<div id=\"reelcalc-main-result\" class=\"result-box capacity-result\">";
  html += "<div class=\"capacity-hero\">";
  html += "<div><span class=\"eyebrow\">Estimated full-spool capacity</span><strong class=\"capacity-number\">" + formatLength(capacity, 1, true) + "</strong><p>of " + escapeHtml(lineLabel) + "</p></div>";
  html += "</div>";
  html += "<div class=\"capacity-detail-grid\">";
  html += "<div class=\"capacity-detail-card\"><span>Reel used</span><strong>" + escapeHtml(formatReelShort(reel)) + "</strong><p>" + (braidCapacityNote ? escapeHtml(braidCapacityNote) : "Rated at " + formatReelRating(reel) + " line.") + "</p></div>";
  html += "<div class=\"capacity-detail-card\"><span>Line used</span><strong>" + escapeHtml(lineLabel) + "</strong><p>Diameter: " + formatDiameterWithUnit(line.dia_in) + ".</p></div>";
  html += "</div>";
  html += recommendationAffiliateHtml(line, capacity);
  if (state.backingMode !== "yes") {
    html += handleTurnEstimateHtml([{ kind: "main-line", label: formatActiveLineShort(line), yards: capacity }]);
  }
  html += "</div>";
  el.capacityResult.className = "";
  el.capacityResult.innerHTML = html;
}

function renderBackingResult() {
  var reel = getActiveReel();
  var line = getActiveMainLine();
  if (state.useManualReel && !state.manualReel) {
    el.backingResult.className = "empty-state";
    el.backingResult.textContent = "Backing results will appear after you enter the manual reel specs and choose a main line.";
    return;
  }
  if (!reel || !line || !isReelReady(reel) || !isLineReady(line)) {
    el.backingResult.className = "empty-state";
    el.backingResult.textContent = "Backing results will appear after you choose a reel and main line.";
    return;
  }
  var fullCapacity = calculateFullSpoolCapacity(reel, line);
  updateSliderBounds(fullCapacity);
  if (state.backingMode !== "yes") {
    el.backingResult.className = "";
    el.backingResult.innerHTML = "<div class=\"result-box\"><p><strong>No backing:</strong> fill the reel with approximately " + formatLength(fullCapacity, 1, true) + " of " + escapeHtml(formatActiveLineShort(line)) + ".</p>" + spoolBar(0, 100) + "<p class=\"tiny-note\">This is the estimated full-spool capacity of the selected main line.</p></div>";
    return;
  }
  if (!(Number(state.desiredMainYards) > 0)) {
    el.backingResult.className = "empty-state";
    el.backingResult.textContent = "Enter the desired main line " + lengthUnitLong() + " to calculate backing.";
    return;
  }
  var backing = getBackingLine();
  var desired = Number(state.desiredMainYards) || 0;
  var result = calculateBackingNeeded(reel, line, desired, backing);
  var html = "<div class=\"result-box" + (result.overCapacity ? " error-box" : "") + "\">";
  if (result.overCapacity) {
    html += "<p><strong>That is more line than this reel is estimated to hold.</strong> Use less main line or a thinner line.</p>";
  } else {
    html += "<p><strong>Estimated backing needed:</strong> " + formatLength(result.backingYards, 1, true) + ".</p>";
  }
  html += spoolBar(result.backingPercent, result.mainPercent);
  html += "<div class=\"result-grid\">";
  html += metricTile("Main line", formatLength(desired, 1) + " " + formatActiveLineShort(line));
  html += metricTile("Main diameter", formatDiameterWithUnit(line.dia_in));
  html += metricTile("Backing line", formatLength(result.backingYards, 1) + " " + formatLineShort(backing));
  html += metricTile("Backing diameter", formatDiameterWithUnit(backing.dia_in));
  html += "</div>";
  if (!result.overCapacity) {
    html += handleTurnEstimateHtml([
      { kind: "backing", label: formatLineShort(backing), yards: result.backingYards },
      { kind: "main-line", label: formatActiveLineShort(line), yards: desired }
    ]);
  }
  var backingNote = backing === DEFAULT_BACKING
    ? "No backing line selected yet, so this uses " + formatStrength(DEFAULT_BACKING.lb) + " monofilament at " + formatDiameterWithUnit(DEFAULT_BACKING.dia_in) + "."
    : "Backing calculation uses the selected backing specs.";
  html += "<p class=\"tiny-note\">" + escapeHtml(backingNote) + " More main line uses more spool space and leaves less room for backing.</p>";
  html += "</div>";
  el.backingResult.className = "";
  el.backingResult.innerHTML = html;
}

function renderSimilarLines() {
  var reel = getActiveReel();
  var line = getActiveMainLine();
  if (state.useManualReel && !state.manualReel) {
    el.similarLines.className = "empty-state";
    el.similarLines.textContent = "Similar line options will appear after you enter the manual reel specs and choose a main line.";
    return;
  }
  if (!reel || !line || !isReelReady(reel) || !isLineReady(line)) {
    el.similarLines.className = "empty-state";
    el.similarLines.textContent = "Similar line options will appear after a main line is selected.";
    return;
  }
  var groups = findSimilarDiameterLines(state.lines, line.dia_in, reel, line.id);
  if (!groups.length) {
    el.similarLines.className = "empty-state";
    el.similarLines.textContent = "No similar-diameter line options were found within +/-" + formatDiameterWithUnit(SIMILAR_DIAMETER_TOLERANCE_IN) + ".";
    return;
  }
  var html = groups.map(function(group) {
    var block = "<section class=\"line-group\"><h3>" + escapeHtml(group.title) + "</h3><div class=\"line-group-grid\">";
    block += group.lines.map(function(item) {
      var yards = calculateFullSpoolCapacity(reel, item);
      var card = "<article class=\"line-card\">";
      card += "<h3>" + escapeHtml(item.brand) + "</h3>";
      card += "<p><strong>" + escapeHtml(item.model) + "</strong></p>";
      card += "<div class=\"card-meta\">";
      card += "<span class=\"pill subtle\">" + escapeHtml(item.type) + "</span>";
      card += "<span class=\"pill subtle\">" + formatStrength(item.lb) + "</span>";
      card += "<span class=\"pill subtle\">" + formatDiameterWithUnit(item.dia_in) + "</span>";
      card += "</div>";
      card += "<p>Estimated " + lengthUnitLong() + " on selected reel: <strong>" + formatLength(yards, 1) + "</strong></p>";
      card += "</article>";
      return card;
    }).join("");
    block += "</div></section>";
    return block;
  }).join("");
  el.similarLines.className = "";
  el.similarLines.innerHTML = html;
}

function findSimilarDiameterLines(lines, diameterIn, reel, excludeId) {
  var grouped = new Map();
  lines.filter(function(line) {
    return isLineReady(line) && line.id !== excludeId && Math.abs(Number(line.dia_in) - diameterIn) <= SIMILAR_DIAMETER_TOLERANCE_IN;
  }).sort(function(a, b) {
    return Math.abs(Number(a.dia_in) - diameterIn) - Math.abs(Number(b.dia_in) - diameterIn);
  }).forEach(function(line) {
    var group = similarGroupName(line.type);
    if (!grouped.has(group)) grouped.set(group, []);
    if (grouped.get(group).length < 5) grouped.get(group).push(line);
  });
  var order = ["Similar braid options", "Similar monofilament options", "Similar fluorocarbon options", "Other similar options"];
  return order.filter(function(title) { return grouped.has(title); }).map(function(title) {
    return { title: title, lines: grouped.get(title) };
  });
}

function similarGroupName(typeValue) {
  var type = String(typeValue || "").toLowerCase();
  if (type.includes("braid")) return "Similar braid options";
  if (type.includes("mono") || type.includes("copoly")) return "Similar monofilament options";
  if (type.includes("fluoro")) return "Similar fluorocarbon options";
  return "Other similar options";
}

function updateSliderBounds(fullCapacity) {
  var max = Math.max(1, Math.floor(yardsToDisplayLength(fullCapacity)));
  el.mainLineSlider.max = String(max);
  var isEditingMainLine = document.activeElement === el.mainLineYards;
  if (isEditingMainLine && !(Number(state.desiredMainYards) > 0)) {
    return;
  }
  var desiredDisplay = yardsToDisplayLength(Number(state.desiredMainYards) || 0);
  if (!state.desiredMainYards || state.desiredMainYards <= 0 || (!isEditingMainLine && desiredDisplay > max * 1.5)) {
    resetDesiredMainLine();
  }
  syncDesiredMainLineInputs({ preserveMainLineInput: isEditingMainLine });
}

function syncDesiredMainLineInputs(options) {
  var preserveInput = options && options.preserveMainLineInput;
  var desiredDisplay = yardsToDisplayLength(Number(state.desiredMainYards) || 1);
  if (!preserveInput) {
    el.mainLineYards.value = formatLengthInput(state.desiredMainYards);
  }
  el.mainLineSlider.value = String(clampSliderValue(desiredDisplay));
}

function resetDesiredMainLine() {
  var reel = getActiveReel();
  var line = getActiveMainLine();
  if (reel && line && isReelReady(reel) && isLineReady(line)) {
    var full = calculateFullSpoolCapacity(reel, line);
    state.desiredMainYards = Math.max(1, Math.min(150, Math.round(full * 0.65)));
  } else {
    state.desiredMainYards = 100;
  }
}

function clampSliderValue(value) {
  var min = Number(el.mainLineSlider.min) || 1;
  var max = Number(el.mainLineSlider.max) || 300;
  return Math.max(min, Math.min(max, Number(value) || min));
}

function spoolBar(backingPercent, mainPercent) {
  var backing = Math.max(0, Math.min(100, backingPercent));
  var main = Math.max(0, Math.min(100, mainPercent));
  if (backing + main > 100) {
    var total = backing + main;
    backing = backing / total * 100;
    main = main / total * 100;
  }
  var empty = Math.max(0, 100 - backing - main);
  var html = "<div class=\"spool-bar\" style=\"--backing-width: " + formatNumber(backing, 2) + "%; --main-width: " + formatNumber(main, 2) + "%; --empty-width: " + formatNumber(empty, 2) + "%\">";
  html += "<div class=\"spool-backing\" title=\"Backing\"></div>";
  html += "<div class=\"spool-main\" title=\"Main line\"></div>";
  html += "<div class=\"spool-empty\" title=\"Unused spool space\"></div>";
  html += "</div>";
  return html;
}

function metricTile(label, value) {
  return "<div class=\"metric-tile\"><span>" + escapeHtml(label) + "</span><strong>" + escapeHtml(value) + "</strong></div>";
}

function formatReelRating(reel) {
  if (reel && reel.id === "manual-reel" && reel.manual_reel_entry_mode === "metric-diameter") {
    return formatLength(reel.capacity_yards, 0) + " / " + formatDiameterWithUnit(reel.rated_line_diameter_in);
  }
  return formatLength(reel.capacity_yards, 0) + " / " + formatStrength(reel.rated_line_lb);
}

function formatManualReelCapacityNote(yards, lb, diameter, entryMode) {
  if (entryMode === "metric-diameter") {
    return formatDiameterWithUnit(diameter) + " / " + formatLength(yards, 0) + " manual entry";
  }
  return formatStrength(lb) + " / " + formatLength(yards, 0) + " manual entry";
}

function formatReelLabel(reel) {
  var size = reel.size_label || reel.size_class || "";
  var sku = reel.sku ? " - " + reel.sku : "";
  return [reel.brand, reel.model, size].filter(Boolean).join(" ") + sku;
}

function formatReelShort(reel) {
  if (!reel) return "";
  if (reel.id === "manual-reel") return "Manual reel entry";
  return [reel.brand, reel.model, reel.size_label || reel.size_class].filter(Boolean).join(" ");
}

function formatLineLabel(line) {
  return [line.brand, line.model, line.type, line.lb ? formatStrength(line.lb) : ""].filter(Boolean).join(" ");
}

function formatLineShort(line) {
  if (!line) return "";
  if (line.id === "default-backing") return formatStrength(line.lb) + " " + String(line.type || "line").toLowerCase() + " backing";
  if (line.id === "manual-line") return line.type + " " + formatStrength(line.lb) + " manual line";
  if (line.id === "manual-backing") return line.type + " " + formatStrength(line.lb) + " manual backing";
  return [line.brand, line.model, line.type, line.lb ? formatStrength(line.lb) : ""].filter(Boolean).join(" ");
}

function formatActiveLineShort(line) {
  return state.path === "recommend" ? formatGenericLineShort(line) : formatLineShort(line);
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
}

function tokensMatch(text, query) {
  var normalizedText = normalizeSearch(text);
  var tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return tokens.every(function(token) {
    return normalizedText.includes(token);
  });
}

function isMetric() {
  return state.unitSystem === "metric";
}

function lengthUnit() {
  return isMetric() ? "m" : "yd";
}

function lengthUnitLong() {
  return isMetric() ? "meters" : "yards";
}

function strengthUnit() {
  return isMetric() ? "kg" : "lb";
}

function diameterUnit() {
  return isMetric() ? "mm" : "in";
}

function yardsToDisplayLength(yards) {
  var value = Number(yards);
  if (!Number.isFinite(value)) return value;
  return isMetric() ? value / YARDS_PER_METER : value;
}

function displayLengthToYards(value) {
  var number = Number(value);
  if (!Number.isFinite(number)) return number;
  return isMetric() ? number * YARDS_PER_METER : number;
}

function displayStrengthToLb(value) {
  var number = Number(value);
  if (!Number.isFinite(number)) return number;
  return isMetric() ? number * LB_PER_KG : number;
}

function displayDiameterToInches(value) {
  var number = Number(value);
  if (!Number.isFinite(number)) return number;
  return isMetric() ? number / MM_PER_INCH : number;
}

function formatLength(yards, digits, longUnit) {
  return formatNumber(yardsToDisplayLength(yards), digits) + " " + (longUnit ? lengthUnitLong() : lengthUnit());
}

function formatLengthInput(yards) {
  return formatInputNumber(yardsToDisplayLength(yards), 0);
}

function formatStrength(lb) {
  var value = Number(lb);
  if (!Number.isFinite(value)) return "-- " + strengthUnit();
  if (isMetric()) return formatNumber(value / LB_PER_KG, 1) + " kg";
  return formatNumber(value, 0) + " lb";
}

function formatDiameterWithUnit(inches) {
  var value = Number(inches);
  if (!Number.isFinite(value)) return "-- " + diameterUnit();
  if (isMetric()) return formatNumber(value * MM_PER_INCH, 3) + " mm";
  return formatDiameter(value) + " in";
}

function formatInputNumber(value, digits) {
  var number = Number(value);
  if (!Number.isFinite(number)) return "";
  return number.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatCountBadge(count) {
  var number = Number(count);
  if (!Number.isFinite(number) || number < 100) return String(count || 0);
  return String(Math.floor(number / 50) * 50) + "+";
}

function formatNumber(value, digits) {
  var number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatDiameter(value) {
  var number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
