(function(global) {
  "use strict";

  var mounts = new WeakMap();

  function mount(root) {
    if (mounts.has(root)) return mounts.get(root);

    var assetBase = new URL(root.dataset.assetBase || "./", document.baseURI);
    var productId = root.dataset.productId || "";
    var state = {
      product: null,
      reels: [],
      lines: [],
      productLines: [],
      affiliateData: null,
      selectedLine: null,
      selectedReel: null,
      reelSource: "database",
      manualReel: null,
      selectedSpoolYards: 0,
      reelType: "spinning",
      reelBrand: "",
      reelModel: "",
      backingBrand: "",
      backingModel: "",
      selectedBackingLine: null,
      capacityOnly: false,
      savedWorkingYards: 0,
      lastResult: null
    };
    var el = {};
    var staticBound = false;
    var interactiveBound = false;

    var ready = init();
    mounts.set(root, ready);
    return ready;

    async function init() {
      cacheElements();
      if (!staticBound) { bindStaticEvents(); staticBound = true; }
      el.loading.className = "rc-loading";
      el.loading.textContent = "Loading reel and line data...";
      try {
        if (!global.ReelCalcCore) throw new Error("The shared calculation engine is unavailable.");
        var payload = await Promise.all([
          fetchJson("data/line-page-products.json"),
          fetchJson("data/reels.json"),
          fetchJson("data/lines.json"),
          fetchJson("data/reel-affiliates.json")
        ]);
        state.product = payload[0] && payload[0].products ? payload[0].products[productId] : null;
        state.reels = Array.isArray(payload[1]) ? payload[1] : [];
        state.lines = Array.isArray(payload[2]) ? payload[2] : [];
        state.affiliateData = payload[3] || null;
        if (!state.product) throw new Error("The requested line-page product configuration is missing.");
        prepareData();
        if (!interactiveBound) { bindInteractiveEvents(); interactiveBound = true; }
        applyPreload();
        renderAll();
        el.loading.hidden = true;
        el.interactive.hidden = false;
        el.toolStatus.textContent = "Line data ready";
        track("line_page_view", baseEventParameters(), { onceKey: productId + ":view" });
        exposeTestApi();
        root.dataset.linePageReady = "true";
        return true;
      } catch (error) {
        el.loading.className = "rc-error";
        el.loading.textContent = "The interactive setup tool could not load. The verified diameter chart and setup guidance below are still available.";
        el.toolStatus.textContent = "Static guide available";
        var retry = document.createElement("button");
        retry.type = "button";
        retry.className = "rc-button rc-button-secondary";
        retry.textContent = "Retry loading calculator";
        retry.addEventListener("click", init, { once: true });
        el.loading.appendChild(retry);
        global.console && console.error("ReelCalc line page:", error);
        return false;
      }
    }

    async function fetchJson(relativePath) {
      var url = new URL(relativePath, assetBase);
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 20000);
      // A published catalog change must not depend on replacing a Squarespace snippet.
      url.searchParams.set("t", Date.now());
      try {
        var response = await fetch(url.href, { credentials: "omit", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(relativePath + " returned " + response.status);
        return await response.json();
      } finally { clearTimeout(timeout); }
    }

    function cacheElements() {
      [
        "rcToolStatus", "rcLoading", "rcInteractive", "rcStrength", "rcSpool", "rcSelectedLine",
        "rcReelType", "rcReelBrand", "rcReelModel", "rcReelSize", "rcWorkingYards", "rcBackingBrand",
        "rcWorkingYardsLabel", "rcFullSpoolHelp",
        "rcReelSource", "rcCatalogReel", "rcManualReel", "rcManualType", "rcManualStrength",
        "rcManualCapacity", "rcManualCapacityUnit", "rcManualDiameter", "rcManualDiameterUnit", "rcManualError",
        "rcBackingModel", "rcBackingLb", "rcBackingModeButton", "rcBackingModeStatus", "rcBackingControls",
        "rcCalculate", "rcCalculationHelp", "rcResults", "rcDiameterSummary", "rcAlternatives",
        "rcReplacement", "rcSwitchResult", "rcReplacementWizard", "rcFishingType", "rcPriority",
        "rcRecommendation", "rcStrengthWizard", "rcExamples"
      ].forEach(function(id) {
        el[id.replace(/^rc/, "").replace(/^[A-Z]/, function(value) { return value.toLowerCase(); })] = root.querySelector("#" + id);
      });
    }

    function bindStaticEvents() {
      root.addEventListener("click", function(event) {
        var chartPick = event.target.closest("[data-select-line]");
        if (chartPick && state.product) {
          var line = state.productLines.find(function(item) { return item.id === chartPick.dataset.selectLine; });
          if (line) {
            setSelectedLine(line, true);
            el.strength.focus({ preventScroll: true });
            root.querySelector("#use-this-line").scrollIntoView({ behavior: "auto", block: "start" });
          }
          return;
        }
        var internal = event.target.closest("[data-internal-destination]");
        if (!internal) return;
        track("line_page_internal_link_click", Object.assign(baseEventParameters(), {
          destination: internal.dataset.internalDestination || ""
        }));
      });
      var image = root.querySelector(".rc-product-figure img");
      if (image) {
        image.addEventListener("error", function() {
          image.closest(".rc-product-figure").hidden = true;
        });
      }
    }

    function bindInteractiveEvents() {
      if (el.reelSource) {
        el.reelSource.addEventListener("click", function(event) {
          var button = event.target.closest("[data-reel-source]");
          if (!button) return;
          state.reelSource = button.dataset.reelSource;
          updateReelSource();
          setSuggestedWorkingAmount(false);
          renderRecommendation();
          refreshCalculationIfVisible();
        });
        [el.manualType, el.manualStrength, el.manualCapacity, el.manualCapacityUnit, el.manualDiameter, el.manualDiameterUnit].forEach(function(input) {
          input.addEventListener(input.tagName === "SELECT" ? "change" : "input", function() {
            readManualReel();
            setSuggestedWorkingAmount(false);
            renderRecommendation();
            refreshCalculationIfVisible();
          });
        });
      }
      el.strength.addEventListener("change", function() {
        setSelectedLine(state.productLines.find(function(line) { return line.id === el.strength.value; }) || null, true);
      });
      el.spool.addEventListener("change", function() {
        state.selectedSpoolYards = positiveNumber(el.spool.value) || 0;
        setSuggestedWorkingAmount(false);
        track("line_page_spool_selected", Object.assign(baseEventParameters(), selectedLineParameters(), {
          spool_length_yd: state.selectedSpoolYards
        }));
        refreshCalculationIfVisible();
      });
      el.reelType.addEventListener("click", function(event) {
        var button = event.target.closest("[data-reel-type]");
        if (!button) return;
        state.reelType = button.dataset.reelType;
        state.reelBrand = "";
        state.reelModel = "";
        state.selectedReel = null;
        updateReelTypeButtons();
        populateReelSelectors();
        renderRecommendation();
        renderSwitchComparison(false);
        hideResults();
      });
      el.reelBrand.addEventListener("change", function() {
        state.reelBrand = el.reelBrand.value;
        state.reelModel = "";
        state.selectedReel = null;
        populateReelSelectors();
        renderRecommendation();
        renderSwitchComparison(false);
        hideResults();
      });
      el.reelModel.addEventListener("change", function() {
        state.reelModel = el.reelModel.value;
        state.selectedReel = null;
        populateReelSelectors();
        renderRecommendation();
        renderSwitchComparison(false);
        hideResults();
      });
      el.reelSize.addEventListener("change", function() {
        state.selectedReel = readyReels().find(function(reel) { return reel.id === el.reelSize.value; }) || null;
        setSuggestedWorkingAmount(true);
        renderRecommendation();
        if (state.selectedReel) {
          track("line_page_reel_selected", Object.assign(baseEventParameters(), selectedLineParameters(), reelParameters()));
        }
        refreshCalculationIfVisible();
      });
      el.workingYards.addEventListener("input", function() {
        refreshCalculationIfVisible();
      });
      el.backingModeButton.addEventListener("click", function() {
        if (!state.capacityOnly) {
          state.savedWorkingYards = positiveNumber(el.workingYards.value) || 0;
        }
        state.capacityOnly = !state.capacityOnly;
        if (state.capacityOnly) {
          setSuggestedWorkingAmount(true);
        } else if (state.savedWorkingYards > 0) {
          el.workingYards.value = cleanNumber(state.savedWorkingYards, 1);
        } else {
          setSuggestedWorkingAmount(true);
        }
        updateBackingMode();
        refreshCalculationIfVisible();
      });
      el.backingBrand.addEventListener("change", function() {
        state.backingBrand = el.backingBrand.value;
        state.backingModel = "";
        state.selectedBackingLine = null;
        populateBackingLines();
        refreshCalculationIfVisible();
      });
      el.backingModel.addEventListener("change", function() {
        state.backingModel = el.backingModel.value;
        state.selectedBackingLine = null;
        populateBackingLines();
        refreshCalculationIfVisible();
      });
      el.backingLb.addEventListener("change", function() {
        state.selectedBackingLine = backingCandidates().find(function(line) { return line.id === el.backingLb.value; }) || null;
        populateBackingLines();
        refreshCalculationIfVisible();
      });
      el.calculate.addEventListener("click", function() {
        renderCalculation(true);
      });
      el.replacement.addEventListener("change", function() {
        renderSwitchComparison(true);
      });
      if (el.fishingType) el.fishingType.addEventListener("change", renderRecommendation);
      if (el.priority) el.priority.addEventListener("change", renderRecommendation);
      if (el.strengthWizard) el.strengthWizard.addEventListener("click", function() {
        track("line_page_wizard_click", Object.assign(baseEventParameters(), selectedLineParameters(), reelParameters(), {
          selection_source: "strength_guide"
        }));
      });
    }

    function prepareData() {
      var excluded = new Set(state.product.excludedLineIds || []);
      state.productLines = state.lines.filter(function(line) {
        return line.brand === state.product.brand &&
          line.model === state.product.model &&
          line.type === state.product.lineType &&
          !excluded.has(line.id) &&
          isLineReady(line) &&
          Array.isArray(line.spool_sizes_yd) &&
          line.spool_sizes_yd.length;
      }).sort(function(a, b) { return Number(a.lb) - Number(b.lb); });
      if (!state.productLines.length) throw new Error("No verified product strengths are available.");
    }

    function applyPreload() {
      var params = new URLSearchParams(location.search);
      var requestedLine = params.get("line") || "";
      var requestedLb = positiveNumber(params.get("lb"));
      state.selectedLine = state.productLines.find(function(line) { return line.id === requestedLine; }) ||
        state.productLines.find(function(line) { return requestedLb && Number(line.lb) === requestedLb; }) ||
        state.productLines.find(function(line) { return line.id === state.product.defaultLineId; }) ||
        state.productLines[0];

      var requestedSpool = positiveNumber(params.get("spool"));
      var offered = offeredSpools(state.selectedLine);
      var defaultSpool = positiveNumber(state.product.defaultSpoolYards);
      state.selectedSpoolYards = offered.indexOf(requestedSpool) >= 0
        ? requestedSpool
        : offered.indexOf(defaultSpool) >= 0
          ? defaultSpool
          : offered[0];

      var requestedReel = params.get("reel") || "";
      state.selectedReel = state.reels.find(function(reel) { return reel.id === requestedReel && isReelReady(reel); }) || null;
      if (state.selectedReel) {
        state.reelType = isBaitcaster(state.selectedReel) ? "baitcasting" : "spinning";
        state.reelBrand = state.selectedReel.brand || "";
        state.reelModel = state.selectedReel.model || "";
      }
      if (el.reelSource && params.get("reelSource") === "manual") {
        state.reelSource = "manual";
        manualFields().forEach(function(field) {
          var value = params.get(field[0]);
          if (value !== null) field[1].value = value;
        });
        // Mono and fluorocarbon pages always start from a mono reference.
        if (!isBraid(state.selectedLine)) el.manualType.value = "mono";
      }

      var requestedWorking = positiveNumber(params.get("mainYards"));
      if (requestedWorking) el.workingYards.value = cleanNumber(requestedWorking, 1);
      state.capacityOnly = (params.get("mode") || state.product.defaultMode) === "capacity";

      var requestedBacking = params.get("backingLine") || state.product.defaultBackingLineId;
      state.selectedBackingLine = state.lines.find(function(line) {
        return line.id === requestedBacking && normalizedType(line.type) === "monofilament" && isLineReady(line);
      }) || null;
      if (state.selectedBackingLine) {
        state.backingBrand = state.selectedBackingLine.brand || "";
        state.backingModel = state.selectedBackingLine.model || "";
      }
    }

    function renderAll() {
      populateStrengths();
      populateSpools();
      updateSelectedLineSummary();
      updateReelTypeButtons();
      updateReelSource();
      populateReelSelectors();
      populateBackingLines();
      updateBackingMode();
      populateReplacementLines();
      renderDiameterIntelligence();
      renderSwitchComparison(false);
      renderRecommendation();
      renderExamples();
      setSuggestedWorkingAmount(false);
      updateCalculateState();
      if (activeReel()) renderCalculation(false);
    }

    function activeReel() {
      return state.reelSource === "manual" ? state.manualReel : state.selectedReel;
    }

    function manualFields() {
      return [
        ["ratingType", el.manualType], ["ratingLb", el.manualStrength],
        ["ratingCapacity", el.manualCapacity], ["ratingCapacityUnit", el.manualCapacityUnit],
        ["ratingDiameter", el.manualDiameter], ["ratingDiameterUnit", el.manualDiameterUnit]
      ];
    }

    function updateReelSource() {
      if (!el.reelSource) return;
      var manual = state.reelSource === "manual";
      el.catalogReel.hidden = manual;
      el.manualReel.hidden = !manual;
      Array.from(el.reelSource.querySelectorAll("[data-reel-source]")).forEach(function(button) {
        button.setAttribute("aria-pressed", String(button.dataset.reelSource === state.reelSource));
      });
      if (manual) readManualReel();
    }

    function readManualReel() {
      var core = global.ReelCalcCore;
      var capacity = positiveNumber(el.manualCapacity.value);
      var lb = positiveNumber(el.manualStrength.value);
      var hasDiameter = el.manualDiameter.value !== "" || el.manualDiameter.validity.badInput;
      var hasStrength = el.manualStrength.value !== "" || el.manualStrength.validity.badInput;
      var type = el.manualType.value;
      var diameter = hasDiameter ? core.assessDiameter(Number(el.manualDiameter.value), el.manualDiameterUnit.value === "mm", false) : null;
      var error = "";
      if (!capacity || capacity > 100000) error = "Enter a rated capacity greater than zero (up to 100,000).";
      else if (!["yd", "m"].includes(el.manualCapacityUnit.value) || !["mm", "in"].includes(el.manualDiameterUnit.value)) error = "Choose the units printed on the reel.";
      else if (!["mono", "braid"].includes(type) || (!isBraid(state.selectedLine) && type !== "mono")) error = "Choose the matching capacity rating type.";
      else if (hasStrength && (!lb || lb > 1000)) error = "Check the rated strength in pounds (greater than zero, up to 1,000 lb).";
      else if (hasDiameter && !diameter.valid) error = diameter.message;
      else if (!hasDiameter && !lb) error = "Enter the rated lb test or the matching printed diameter.";
      [el.manualCapacity, el.manualStrength, el.manualDiameter].forEach(function(input) {
        input.setAttribute("aria-invalid", "false");
      });
      if (error) {
        var invalid = !capacity || capacity > 100000 ? el.manualCapacity : hasDiameter && !diameter.valid ? el.manualDiameter : el.manualStrength;
        invalid.setAttribute("aria-invalid", "true");
      }
      el.manualError.textContent = el.manualCapacity.value || hasStrength || hasDiameter ? error : "";
      state.manualReel = error ? null : {
        manualRating: {
          type: type,
          capacityYards: el.manualCapacityUnit.value === "m" ? core.metersToYards(capacity) : capacity,
          referenceDiameterIn: hasDiameter ? diameter.diameterIn : core.assumedRatingDiameter(type, lb),
          diameterProvided: hasDiameter
        }
      };
    }

    function populateStrengths() {
      fillSelect(el.strength, state.productLines.map(function(line) {
        return { value: line.id, label: cleanNumber(line.lb, 0) + " lb" };
      }), "Choose strength", state.selectedLine && state.selectedLine.id);
      el.strength.options[0].disabled = true;
    }

    function populateSpools() {
      var spools = offeredSpools(state.selectedLine);
      if (spools.indexOf(state.selectedSpoolYards) < 0) state.selectedSpoolYards = spools[0] || 0;
      fillSelect(el.spool, spools.map(function(yards) {
        return { value: String(yards), label: formatYards(yards) + " retail spool" };
      }), "No verified spool length", String(state.selectedSpoolYards || ""));
      el.spool.options[0].disabled = spools.length > 0;
    }

    function offeredSpools(line) {
      return Array.isArray(line && line.spool_sizes_yd)
        ? line.spool_sizes_yd.map(Number).filter(function(value) { return value > 0; }).sort(function(a, b) { return a - b; })
        : [];
    }

    function setSelectedLine(line, shouldTrack) {
      if (!line) return;
      state.selectedLine = line;
      var spools = offeredSpools(line);
      if (spools.indexOf(state.selectedSpoolYards) < 0) state.selectedSpoolYards = spools[0] || 0;
      populateStrengths();
      populateSpools();
      updateSelectedLineSummary();
      populateReplacementLines();
      renderDiameterIntelligence();
      renderSwitchComparison(false);
      renderRecommendation();
      if (el.examples.dataset.exampleMode === "capacity") renderExamples();
      setSuggestedWorkingAmount(false);
      if (shouldTrack) {
        track("line_page_strength_selected", Object.assign(baseEventParameters(), selectedLineParameters()));
      }
      refreshCalculationIfVisible();
    }

    function updateSelectedLineSummary() {
      var line = state.selectedLine;
      if (!line) {
        el.selectedLine.textContent = "Choose a verified strength.";
        return;
      }
      el.selectedLine.innerHTML = "<strong>" + escapeHtml(lineLabel(line)) + "</strong><br>" +
        formatDiameter(line);
      Array.from(root.querySelectorAll("[data-select-line]")).forEach(function(button) {
        var selected = button.dataset.selectLine === line.id;
        button.disabled = false;
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        button.closest("tr").classList.toggle("is-selected", selected);
      });
    }

    function readyReels() {
      return state.reels.filter(function(reel) {
        return isReelReady(reel) && (state.reelType === "baitcasting" ? isBaitcaster(reel) : isSpinningReel(reel));
      });
    }

    function isBaitcaster(reel) {
      var type = String(reel && reel.reel_type || "").toLowerCase();
      return type.indexOf("baitcast") >= 0 || String(reel && reel.source_file || "").toLowerCase().indexOf("baitcaster") >= 0;
    }

    function isSpinningReel(reel) {
      var type = String(reel && reel.reel_type || "").toLowerCase();
      return !isBaitcaster(reel) && type.indexOf("conventional") < 0 && type.indexOf("trolling") < 0;
    }

    function populateReelSelectors() {
      var reels = readyReels();
      var brands = uniqueSorted(reels.map(function(reel) { return reel.brand; }));
      fillSelect(el.reelBrand, brands.map(optionFromValue), "Select brand", state.reelBrand);

      var brandReels = reels.filter(function(reel) { return reel.brand === state.reelBrand; });
      var models = uniqueSorted(brandReels.map(function(reel) { return reel.model; }));
      fillSelect(el.reelModel, models.map(optionFromValue), "Select series", state.reelModel);
      el.reelModel.disabled = !state.reelBrand;

      var modelReels = brandReels.filter(function(reel) { return reel.model === state.reelModel; })
        .sort(compareReels);
      fillSelect(el.reelSize, modelReels.map(function(reel) {
        return { value: reel.id, label: reelSizeLabel(reel) };
      }), "Select exact size", state.selectedReel && state.selectedReel.id);
      el.reelSize.disabled = !state.reelModel;
      updateCalculateState();
    }

    function updateReelTypeButtons() {
      Array.from(el.reelType.querySelectorAll("[data-reel-type]")).forEach(function(button) {
        button.setAttribute("aria-pressed", button.dataset.reelType === state.reelType ? "true" : "false");
      });
    }

    function populateBackingLines() {
      var candidates = backingCandidates();
      var brands = uniqueSorted(candidates.map(function(line) { return line.brand; }));
      fillSelect(el.backingBrand, brands.map(optionFromValue), "Select backing brand", state.backingBrand);

      var brandLines = candidates.filter(function(line) { return line.brand === state.backingBrand; });
      var models = uniqueSorted(brandLines.map(function(line) { return line.model; }));
      fillSelect(el.backingModel, models.map(optionFromValue), "Select model", state.backingModel);
      el.backingBrand.disabled = state.capacityOnly;
      el.backingModel.disabled = state.capacityOnly || !state.backingBrand;

      var modelLines = brandLines.filter(function(line) { return line.model === state.backingModel; }).sort(function(a, b) {
        return Number(a.lb) - Number(b.lb);
      });
      fillSelect(el.backingLb, modelLines.map(function(line) {
        return { value: line.id, label: cleanNumber(line.lb, 1) + " lb - " + formatDiameter(line) };
      }), "Select strength", state.selectedBackingLine && state.selectedBackingLine.id);
      el.backingLb.disabled = state.capacityOnly || !state.backingModel;
    }

    function updateBackingMode() {
      el.backingModeButton.setAttribute("aria-pressed", state.capacityOnly ? "true" : "false");
      el.backingModeButton.textContent = state.capacityOnly ? "Use backing instead" : "I don't want to use backing";
      el.backingModeStatus.hidden = !state.capacityOnly;
      el.backingControls.classList.toggle("is-disabled", state.capacityOnly);
      if (root.classList.contains("rc-line-gold")) el.backingControls.hidden = state.capacityOnly;
      el.workingYards.disabled = state.capacityOnly;
      el.backingBrand.disabled = state.capacityOnly;
      el.backingModel.disabled = state.capacityOnly || !state.backingBrand;
      el.backingLb.disabled = state.capacityOnly || !state.backingModel;
    }

    function backingCandidates() {
      return state.lines.filter(function(line) {
        return isLineReady(line) && normalizedType(line.type) === "monofilament" && Number(line.lb) <= 40;
      }).sort(compareLines);
    }

    function populateReplacementLines() {
      var type = normalizedType(state.selectedLine && state.selectedLine.type);
      var candidates = state.lines.filter(function(line) {
        return isLineReady(line) &&
          normalizedType(line.type) === type &&
          !sameProduct(line, state.selectedLine);
      }).sort(compareLines);
      var current = el.replacement.value;
      fillSelect(el.replacement, candidates.map(function(line) {
        return { value: line.id, label: lineLabel(line) + " - " + formatDiameter(line) };
      }), "Choose replacement line", candidates.some(function(line) { return line.id === current; }) ? current : "");
    }

    function setSuggestedWorkingAmount(force) {
      if (!activeReel() || !state.selectedLine || !state.selectedSpoolYards) {
        updateCalculateState();
        return;
      }
      var full = fullCapacity(activeReel(), state.selectedLine);
      if (!(full > 0)) return;
      var current = positiveNumber(el.workingYards.value);
      if (state.capacityOnly) {
        el.workingYards.value = cleanNumber(full, full < 100 ? 1 : 0);
      } else if (force || !current) {
        // Never round a suggested working fill above the calculated capacity.
        el.workingYards.value = cleanNumber(Math.floor(Math.min(full, state.selectedSpoolYards) * 10) / 10, 1);
      }
      el.workingYards.max = String(Math.ceil(full * 1.5));
      updateCalculateState();
    }

    function updateCalculateState() {
      if (state.capacityOnly && (!activeReel() || !state.selectedLine)) el.workingYards.value = "";
      if (el.workingYardsLabel) el.workingYardsLabel.textContent = state.capacityOnly
        ? "Estimated full-spool amount (yards)"
        : "Main line to put on the reel (yards)";
      if (el.fullSpoolHelp) {
        el.fullSpoolHelp.hidden = !state.capacityOnly;
        el.fullSpoolHelp.textContent = activeReel() && state.selectedLine
          ? "The estimated amount of " + lineLabel(state.selectedLine) + " needed to fill " + reelLabel(activeReel()) + " with no backing."
          : "Choose a reel or enter its specs to see how much of the selected line fills the spool with no backing.";
      }
      var ready = !!activeReel() && !!state.selectedLine && state.selectedSpoolYards > 0 && positiveNumber(el.workingYards.value) > 0;
      el.calculate.disabled = !ready;
      el.calculationHelp.textContent = ready
        ? ""
        : !activeReel() ? (state.reelSource === "manual" ? "Complete the reel capacity rating to continue." : "Choose an exact reel to continue.")
        : !state.selectedSpoolYards ? "Choose a retail spool length."
        : "Enter a main-line amount greater than zero.";
      el.workingYards.setAttribute("aria-invalid", activeReel() && !positiveNumber(el.workingYards.value) ? "true" : "false");
    }

    function refreshCalculationIfVisible() {
      updateCalculateState();
      renderSwitchComparison(false);
      if (!el.results.hidden) {
        if (!el.calculate.disabled) renderCalculation(false);
        else {
          state.lastResult = null;
          el.results.innerHTML = '<p class="rc-error">' + escapeHtml(el.calculationHelp.textContent) + " Results will update when the inputs are complete.</p>";
        }
      }
    }

    function hideResults() {
      state.lastResult = null;
      el.results.hidden = true;
      updateCalculateState();
    }

    function renderCalculation(userInitiated) {
      var result = calculateSetup({
        reel: activeReel(),
        line: state.selectedLine,
        spoolYards: state.selectedSpoolYards,
        workingYards: positiveNumber(el.workingYards.value),
        backingLine: state.capacityOnly ? null : state.selectedBackingLine,
        capacityOnly: state.capacityOnly
      });
      if (!result.ok) {
        state.lastResult = null;
        el.results.hidden = false;
        el.results.innerHTML = '<div class="rc-error">' + escapeHtml(result.message) + "</div>";
        return;
      }

      state.lastResult = result;
      var capacityDisplay = result.capacityRange
        ? formatYards(result.capacityRange.centerYards) + '<small>Expected range: ' + formatYards(result.capacityRange.minimumYards) + "-" + formatYards(result.capacityRange.maximumYards) + "</small>"
        : formatYards(result.fullCapacity);
      var backingDisplay = result.overCapacity
        ? 'Revise the plan<small>The main-line amount exceeds estimated capacity.</small>'
        : result.needsBacking
        ? result.backingLine
          ? formatYards(result.backingYards) + '<small>' + escapeHtml(lineLabel(result.backingLine)) + (result.backingRange ? "<br>Range: " + formatYards(result.backingRange.minimumYards) + "-" + formatYards(result.backingRange.maximumYards) : "") + "</small>"
          : 'Choose backing<small>A shorter working fill needs backing underneath it.</small>'
        : 'No volume backing<small>' + (isBraid(result.line) ? 'Follow the reel instructions for braid attachment.' : 'This plan uses a full-mainline fill.') + '</small>';
      var badgeClass = result.assessmentTone === "error" ? " error" : result.assessmentTone === "warning" ? " warning" : "";
      var affiliateHtml = result.assessmentTone === "success"
        ? lineOfferLink(result.offer, result.line, "mainline", result.spoolYards, "rcAffiliateCta") +
          lineOfferLink(backingLineOffer(result), result.backingLine, "backing", 0, "rcBackingAffiliateCta")
        : "";
      var manual = !!result.reel.manualRating;
      var wizardLabel = manual ? "Use this line in the Wizard" : "Continue with this reel &amp; line";
      var wizardNote = manual
        ? "The Wizard opens with this line and strength. Choose a listed reel there; manually entered reel specs are not transferred."
        : "The Wizard opens with this reel, line strength, and main-line amount. Its backing options are selected separately.";

      var planSummary = state.capacityOnly
        ? "About " + formatYards(result.fullCapacity) + " fills this reel with the selected line and no backing."
        : "Using a " + formatYards(result.spoolYards) + " retail spool and " + formatYards(result.workingYards) + " of working main line.";
      el.results.innerHTML = '<div class="rc-result-head"><span class="rc-eyebrow">Your ReelCalc setup</span><h3>' +
        escapeHtml(lineLabel(result.line)) + " on " + escapeHtml(reelLabel(result.reel)) +
        '</h3><p>' + escapeHtml(planSummary) + '</p></div>' +
        '<div class="rc-result-grid">' +
          '<div class="rc-result-metric"><span>Estimated full spool</span><strong>' + capacityDisplay + "</strong></div>" +
          '<div class="rc-result-metric"><span>' + (state.capacityOnly ? 'Full-spool amount' : 'Planned main line') + '</span><strong>' + formatYards(result.workingYards) + '</strong><small>' + escapeHtml(lineLabel(result.line)) + "</small></div>" +
          '<div class="rc-result-metric"><span>Calculated backing</span><strong>' + backingDisplay + "</strong></div>" +
          '<div class="rc-result-metric"><span>Retail spool left</span><strong>' + (result.spoolEnoughForPlan ? formatYards(result.leftoverYards) : "Short by " + formatYards(result.shortfallYards)) + '</strong><small>' + (state.capacityOnly ? 'After this full-spool fill' : 'After this working fill') + '</small></div>' +
        "</div>" +
        '<div class="rc-assessment">' +
          '<div class="rc-assessment-main"><span class="rc-assessment-badge' + badgeClass + '">' + escapeHtml(result.assessmentLabel) + '</span><h4>Is this spool enough?</h4><p>' + escapeHtml(result.assessmentText) + "</p>" + (result.practicalNote ? "<p><strong>Practical note:</strong> " + escapeHtml(result.practicalNote) + "</p>" : "") + "</div>" +
          '<div class="rc-efficiency"><h4>How far will one spool go?</h4><p>' + escapeHtml(result.efficiencyText) + "</p></div>" +
        "</div>" +
        '<div class="rc-result-actions"><a class="rc-button rc-button-primary" id="rcWizardCta" href="' + escapeHtml(result.wizardUrl) + '">' + wizardLabel + '</a>' + affiliateHtml + '<button type="button" class="rc-button rc-button-secondary" id="rcCopyResult">Copy Setup</button><p class="rc-disclosure">' + wizardNote + '</p><p class="rc-disclosure">As an Amazon Associate, ReelCalc earns from qualifying purchases at no extra cost to you. Check the strength and spool length before buying.</p></div>' +
        (manual ? '<p class="rc-notice">' + escapeHtml(manualRatingNote(result.reel, result.line, result.needsBacking ? result.backingLine : null)) + '</p>' : "") +
        '<p class="rc-notice">ReelCalc estimates capacity from published reel capacity and line-diameter data. Actual capacity can vary with line packing, spool tolerances, fill level, and manufacturer specifications.</p>';
      el.results.hidden = false;
      bindResultActions(result);
      updateLocation(result);

      if (userInitiated) {
        track("line_page_setup_calculated", Object.assign(baseEventParameters(), selectedLineParameters(), reelParameters(), {
          spool_length_yd: result.spoolYards,
          estimated_capacity_yd: rounded(result.fullCapacity, 1),
          working_line_yd: rounded(result.workingYards, 1),
          backing_yd: rounded(result.backingYards, 1),
          backing_used: result.needsBacking && !!result.backingLine,
          capacity_only_mode: state.capacityOnly
        }));
        if (result.needsBacking && result.backingLine) {
          track("line_page_backing_calculated", Object.assign(baseEventParameters(), selectedLineParameters(), reelParameters(), {
            backing_line_id: result.backingLine.id || "",
            backing_yd: rounded(result.backingYards, 1)
          }));
        }
      }
    }

    function calculateSetup(options) {
      var reel = options.reel;
      var line = options.line;
      var spoolYards = positiveNumber(options.spoolYards);
      var workingYards = positiveNumber(options.workingYards);
      var backingLine = options.backingLine;
      if (!reel || !isReelReady(reel)) return { ok: false, message: "Choose a listed reel or enter a valid capacity rating." };
      if (!line || !isLineReady(line)) return { ok: false, message: "Choose a line strength with verified diameter data." };
      if (!spoolYards) return { ok: false, message: "Choose a verified retail spool length." };
      if (!workingYards) return { ok: false, message: "Enter a working main-line amount greater than zero." };

      var capacity = fullCapacity(reel, line);
      if (!(capacity > 0)) return { ok: false, message: "ReelCalc could not establish a usable capacity reference for this reel and line." };
      if (options.capacityOnly) workingYards = capacity;
      var capacityRange = !reel.manualRating && isBraid(line) && global.ReelCalcCore.calculateActualLineBraidCapacityRange
        ? global.ReelCalcCore.calculateActualLineBraidCapacityRange(reel, line, state.lines)
        : null;
      var needsBacking = !options.capacityOnly && workingYards < capacity * (1 - 1e-10);
      var overCapacity = workingYards > capacity * (1 + 1e-10);
      var backing = null;
      var backingRange = null;
      if (needsBacking && backingLine && isLineReady(backingLine)) {
        if (reel.manualRating) {
          backing = global.ReelCalcCore.estimateSetup({
            workingRating: reel.manualRating, backingRating: reel.manualRating,
            workingDiameterIn: Number(line.dia_in), backingDiameterIn: Number(backingLine.dia_in),
            workingYards: workingYards
          });
        } else {
          backing = global.ReelCalcCore.calculateActualLineCalibratedBacking(reel, line, workingYards, backingLine, state.lines);
          backingRange = global.ReelCalcCore.calculateActualLineCalibratedBackingRange(reel, line, workingYards, backingLine, state.lines);
        }
      }

      var spoolEnoughForPlan = spoolYards >= workingYards;
      var leftoverYards = Math.max(0, spoolYards - workingYards);
      var shortfallYards = Math.max(0, workingYards - spoolYards);
      var assessment = setupAssessment({
        capacity: capacity,
        workingYards: workingYards,
        spoolYards: spoolYards,
        needsBacking: needsBacking,
        hasBacking: !!(backing && !backing.overCapacity),
        overCapacity: overCapacity,
        spoolEnoughForPlan: spoolEnoughForPlan,
        line: line,
        reel: reel
      });
      var fullUsefulFills = Math.floor(spoolYards / workingYards);
      var efficiencyText = workingYards < 50
        ? "This plan uses less than 50 yards of working line. Check that it leaves enough line for your casts, fish runs, and retying before treating it as a usable fishing fill. Specialty short-line fishing may need less than general casting."
        : overCapacity
        ? "The working-line amount must be reduced before spool efficiency can be evaluated for this reel."
        : spoolEnoughForPlan
        ? fullUsefulFills >= 2
          ? "This retail spool supports approximately " + fullUsefulFills + " separate " + formatYards(workingYards) + " working fills, with about " + formatYards(spoolYards - fullUsefulFills * workingYards) + " remaining."
          : "This retail spool supports one " + formatYards(workingYards) + " working fill, with about " + formatYards(leftoverYards) + " remaining."
        : "This retail spool is about " + formatYards(shortfallYards) + " short of the chosen working-line amount. Select a larger offered spool or reduce the plan.";
      var offer = global.ReelCalcAffiliateLinks && global.ReelCalcAffiliateLinks.buildRecommendedLineOffer
        ? global.ReelCalcAffiliateLinks.buildRecommendedLineOffer({
            affiliateData: state.affiliateData,
            line: line,
            requiredYards: workingYards,
            spoolYards: spoolYards
          })
        : null;

      return {
        ok: true,
        reel: reel,
        line: line,
        spoolYards: spoolYards,
        workingYards: workingYards,
        backingLine: backingLine,
        overCapacity: overCapacity,
        fullCapacity: capacity,
        capacityRange: capacityRange,
        needsBacking: needsBacking,
        backingYards: backing && !backing.overCapacity ? Math.max(0, Number(backing.backingYards) || 0) : 0,
        backingRange: backingRange,
        spoolEnoughForPlan: spoolEnoughForPlan,
        leftoverYards: leftoverYards,
        shortfallYards: shortfallYards,
        assessmentLabel: assessment.label,
        assessmentText: assessment.text,
        assessmentTone: assessment.tone,
        practicalNote: assessment.practicalNote,
        efficiencyText: efficiencyText,
        offer: offer,
        wizardUrl: wizardUrl(reel, line, workingYards, spoolYards)
      };
    }

    function setupAssessment(context) {
      if (context.overCapacity) {
        return {
          label: "Plan exceeds capacity",
          tone: "error",
          text: "The chosen working-line amount is greater than this reel's estimated full-spool capacity. Reduce the amount or choose a thinner line.",
          practicalNote: "Do not force the full retail spool onto the reel."
        };
      }
      if (!context.spoolEnoughForPlan) {
        return {
          label: "Not enough for this plan",
          tone: "error",
          text: "The selected retail spool does not contain enough line for the chosen working fill.",
          practicalNote: "Choose a larger verified spool length or lower the working-line amount."
        };
      }
      if (context.workingYards < 50) {
        return {
          label: "Enough line - limited reserve",
          tone: "warning",
          text: "The retail spool contains enough line, but the planned working length is short. Backing occupies space; it does not replace the working line needed for casting and fish runs.",
          practicalNote: practicalCompatibilityNote(context.reel, context.line, context.capacity)
        };
      }
      if (!context.needsBacking) {
        return {
          label: "Yes - full mainline",
          tone: "success",
          text: "This retail spool contains enough line for the reel's estimated full-mainline fill.",
          practicalNote: practicalCompatibilityNote(context.reel, context.line, context.capacity)
        };
      }
      if (context.hasBacking) {
        return {
          label: "Yes - with backing",
          tone: "success",
          text: "This retail spool covers the chosen working-line amount. The calculated backing fills the remaining spool volume underneath it.",
          practicalNote: practicalCompatibilityNote(context.reel, context.line, context.capacity)
        };
      }
      return {
        label: "Backing needed",
        tone: "warning",
        text: "The retail spool covers the chosen working line, but the plan leaves unused spool volume. Choose a backing line to calculate the amount underneath it.",
        practicalNote: practicalCompatibilityNote(context.reel, context.line, context.capacity)
      };
    }

    function practicalCompatibilityNote(reel, line, capacity) {
      if (capacity < 50) return "This is a low-capacity pairing. A thinner line or larger reel may be more manageable for many applications.";
      if (capacity > 1000) return "This is a very high-capacity pairing. A shorter working fill over backing can avoid buying unnecessary premium line.";
      if (!isBraid(line) && isSpinningReel(reel) && Number(line.lb) >= 15 && numericSizeClass(reel) <= 3000) {
        var material = normalizedType(line.type) === "monofilament" ? "mono" : "fluorocarbon";
        return "This " + material + " fits by volume, but heavier " + material + " can be harder to manage on a compact spinning spool.";
      }
      return "Wind under firm, even tension and stop at the reel manufacturer's recommended fill level.";
    }

    function bindResultActions(result) {
      var wizard = root.querySelector("#rcWizardCta");
      var copy = root.querySelector("#rcCopyResult");
      if (wizard) wizard.addEventListener("click", function() {
        track("line_page_wizard_click", Object.assign(baseEventParameters(), selectedLineParameters(), reelParameters(), {
          spool_length_yd: result.spoolYards,
          working_line_yd: rounded(result.workingYards, 1)
        }));
      });
      bindLineOfferLinks(el.results, result.reel, "calculator_result");
      if (copy) copy.addEventListener("click", function() {
        var text = [
          lineLabel(result.line) + " on " + reelLabel(result.reel),
          "Estimated full capacity: " + formatYards(result.fullCapacity),
          "Working main line: " + formatYards(result.workingYards),
          result.overCapacity ? "Plan exceeds estimated capacity; reduce the main-line amount."
            : result.needsBacking
              ? result.backingLine ? "Backing: " + formatYards(result.backingYards) + " of " + lineLabel(result.backingLine) : "Backing: not selected; the shorter main line leaves unused spool space."
              : "Backing: no volume backing in this plan; follow the reel's attachment instructions.",
          "Retail spool: " + formatYards(result.spoolYards),
          result.reel.manualRating ? manualRatingNote(result.reel, result.line, result.backingLine) : "",
          "Estimate from ReelCalc.com"
        ].join("\n");
        copyText(text).then(function() {
          copy.textContent = "Copied";
          window.setTimeout(function() { copy.textContent = "Copy Setup"; }, 1400);
        }).catch(function() { copy.textContent = "Copy unavailable"; });
      });
    }

    function renderDiameterIntelligence() {
      var selected = state.selectedLine;
      if (!selected) return;
      var comparable = uniqueProductStrengths(state.lines.filter(function(line) {
        return isLineReady(line) &&
          normalizedType(line.type) === normalizedType(selected.type) &&
          Number(line.lb) === Number(selected.lb) &&
          !sameProduct(line, selected);
      }));
      var groups = [
        { key: "thinner", label: "thinner", lines: [] },
        { key: "same", label: "same-diameter", lines: [] },
        { key: "thicker", label: "thicker", lines: [] }
      ];
      comparable.sort(function(a, b) { return Number(a.dia_in) - Number(b.dia_in) || compareLines(a, b); }).forEach(function(line) {
        var difference = Number(line.dia_in) - Number(selected.dia_in);
        groups[difference < -0.00005 ? 0 : difference > 0.00005 ? 2 : 1].lines.push(line);
      });
      var firstGroup = groups.find(function(group) { return group.lines.length; });
      var summary = '<h3>At your selected strength</h3><p><strong>' + escapeHtml(lineLabel(selected)) + ":</strong> " + formatDiameter(selected) +
        '</p><p>' + comparable.length + ' other ' + cleanNumber(selected.lb, 0) + ' lb ' + escapeHtml(normalizedType(selected.type)) + ' lines in the database.</p>' +
        groups.map(function(group) {
          var label = group.lines.length + " " + group.label + " " + (group.lines.length === 1 ? "line" : "lines");
          if (!group.lines.length) return '<p class="rc-diameter-empty">' + label + '</p>';
          return '<details class="rc-diameter-group" data-diameter-group="' + group.key + '"' + (group === firstGroup && group.lines.length <= 6 ? ' open' : '') +
            '><summary>' + label + '</summary><table class="rc-table rc-diameter-matches"><caption>' + cleanNumber(selected.lb, 0) + ' lb lines compared with ' + escapeHtml(lineLabel(selected)) +
            '</caption><thead><tr><th scope="col">Line</th><th scope="col">Listed diameter</th></tr></thead><tbody>' + group.lines.map(function(line) {
              return '<tr data-comparable-line="' + escapeHtml(line.id) + '"><td>' + escapeHtml(line.brand + " " + line.model) + '</td><td>' + cleanNumber(line.dia_in, 3) + ' in</td></tr>';
            }).join("") + '</tbody></table></details>';
        }).join("") + '<p class="rc-table-note">Grouped by listed inch diameter, not independent measurements. Matching diameters do not guarantee identical strength or performance.</p>';
      el.diameterSummary.innerHTML = summary;

      var alternatives = nearestAlternatives(selected, 6);
      el.alternatives.innerHTML = alternatives.length ? alternatives.map(function(line) {
        var difference = Math.abs(Number(line.dia_in) - Number(selected.dia_in));
        return "<tr><td><strong>" + escapeHtml(line.brand + " " + line.model) + '</strong></td><td class="rc-number">' + cleanNumber(line.lb, 0) + ' lb</td><td class="rc-number">' + cleanNumber(line.dia_in, 3) + ' in</td><td class="rc-number">' + (difference < 1e-10 ? "Same" : difference < 0.00005 ? "Nearly the same" : cleanNumber(difference, 4) + " in") + "</td></tr>";
      }).join("") : '<tr><td colspan="4">No useful same-category diameter matches are available.</td></tr>';
    }

    function nearestAlternatives(selected, limit) {
      if (!selected) return [];
      var seen = new Set();
      return state.lines.filter(function(line) {
        return isLineReady(line) && normalizedType(line.type) === normalizedType(selected.type) && !sameProduct(line, selected);
      }).sort(function(a, b) {
        return Math.abs(Number(a.dia_in) - Number(selected.dia_in)) - Math.abs(Number(b.dia_in) - Number(selected.dia_in)) || compareLines(a, b);
      }).filter(function(line) {
        var key = String(line.brand).toLowerCase() + "|" + String(line.model).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit);
    }

    function renderSwitchComparison(shouldTrack) {
      var replacement = state.lines.find(function(line) { return line.id === el.replacement.value; }) || null;
      var current = state.selectedLine;
      if (!current || !replacement) {
        el.switchResult.textContent = "Select a replacement line to compare.";
        el.replacementWizard.hidden = true;
        return;
      }
      var difference = Number(replacement.dia_in) - Number(current.dia_in);
      var percent = Math.abs(difference) / Number(current.dia_in) * 100;
      var sameDiameter = Math.abs(difference) < 0.00005;
      var direction = difference > 0 ? "thicker" : "thinner";
      var reel = activeReel();
      var reelSubject = reel ? (reel.manualRating ? "your reel" : "the " + reelLabel(reel)) : "a reel";
      var capacitySentence = "";
      if (reel) {
        var oldCapacity = fullCapacity(reel, current);
        var newCapacity = fullCapacity(reel, replacement);
        if (oldCapacity > 0 && newCapacity > 0) {
          capacitySentence = " ReelCalc estimates about " +
            formatYards(oldCapacity) + " of " + lineLabel(current) + " and " +
            formatYards(newCapacity) + " of " + lineLabel(replacement) + ".";
        }
      }
      var diameterMatchText = Math.abs(difference) < 1e-10 ? "has the same listed diameter as " : "has nearly the same listed diameter as ";
      var comparisonSentence = sameDiameter
        ? "<strong>" + escapeHtml(lineLabel(replacement)) + "</strong> " + diameterMatchText + escapeHtml(lineLabel(current)) + ", so " + escapeHtml(reelSubject) + " should hold about the same amount."
        : "<strong>" + escapeHtml(lineLabel(replacement)) + "</strong> has a listed diameter " + cleanNumber(percent, 1) + "% " + direction + " than " + escapeHtml(lineLabel(current)) + ", so " + escapeHtml(reelSubject) + " should hold " + (difference > 0 ? "less" : "more") + " of it.";
      el.switchResult.innerHTML = comparisonSentence + escapeHtml(capacitySentence);
      el.replacementWizard.href = wizardUrl(reel, replacement, state.capacityOnly ? 0 : positiveNumber(el.workingYards.value), 0);
      el.replacementWizard.hidden = false;
      el.replacementWizard.onclick = function() {
        track("line_page_compare_click", Object.assign(baseEventParameters(), selectedLineParameters(), reelParameters(), {
          replacement_line_id: replacement.id || "",
          replacement_diameter_mm: rounded(Number(replacement.dia_in) * 25.4, 3)
        }));
        track("line_page_alternative_selected", Object.assign(baseEventParameters(), {
          line_id: replacement.id || "",
          destination: "setup_wizard"
        }));
      };
      if (shouldTrack) {
        track("line_page_compare_click", Object.assign(baseEventParameters(), selectedLineParameters(), {
          replacement_line_id: replacement.id || "",
          comparison_action: "selection"
        }));
      }
    }

    function renderRecommendation() {
      if (el.strengthWizard) el.strengthWizard.href = wizardUrl(activeReel(), state.selectedLine, 0, 0);
      if (!el.recommendation) return;
      if (!state.selectedReel) {
        el.recommendation.textContent = "Choose a reel above for a size-aware starting range.";
        return;
      }
      if (!global.ReelCalcRecommendations || typeof global.ReelCalcRecommendations.recommendSetups !== "function") {
        el.recommendation.textContent = "The recommendation engine is unavailable. Use the verified chart and your rod, lure, cover, and target fish as the guide.";
        return;
      }
      var setups = global.ReelCalcRecommendations.recommendSetups({
        reel: state.selectedReel,
        lines: state.lines,
        fishingType: el.fishingType.value,
        priority: el.priority.value,
        calculateFullSpoolCapacity: function(reel, line) { return fullCapacity(reel, line); }
      });
      var material = normalizedType(state.selectedLine && state.selectedLine.type);
      var relevant = setups.filter(function(setup) {
        return setup.line && normalizedType(setup.line.type) === material;
      }).slice(0, 3);
      if (!relevant.length) {
        el.recommendation.innerHTML = "<strong>No comfortable match found.</strong><br>This reel and fishing choice do not produce a reliable " + escapeHtml(material) + " starting point in the current recommendation engine.";
        return;
      }
      var offeredMatches = relevant.map(function(setup) {
        return closestProductLine(Number(setup.line.lb));
      }).filter(Boolean);
      var uniqueStrengths = uniqueSorted(offeredMatches.map(function(line) { return Number(line.lb); })).slice(0, 2);
      var strengthText = uniqueStrengths.length > 1
        ? cleanNumber(Math.min.apply(Math, uniqueStrengths), 0) + "-" + cleanNumber(Math.max.apply(Math, uniqueStrengths), 0) + " lb"
        : cleanNumber(uniqueStrengths[0], 0) + " lb";
      el.recommendation.innerHTML = "<strong>Suggested starting range: " + escapeHtml(strengthText) + " " + escapeHtml(state.product.brand + " " + state.product.model) +
        ".</strong><br>This is matched from ReelCalc's current " + escapeHtml(el.fishingType.options[el.fishingType.selectedIndex].text) + " recommendation for " + escapeHtml(reelLabel(state.selectedReel)) + ". Confirm the final choice against rod power, lure weight, cover, drag, and target fish.";
    }

    function closestProductLine(targetLb) {
      return state.productLines.slice().sort(function(a, b) {
        return Math.abs(Number(a.lb) - targetLb) - Math.abs(Number(b.lb) - targetLb) || Number(a.lb) - Number(b.lb);
      })[0] || null;
    }

    function renderExamples() {
      var capacityExamples = el.examples.dataset.exampleMode === "capacity";
      var backingLine = state.lines.find(function(line) { return line.id === state.product.defaultBackingLineId; }) || null;
      var cards = (state.product.exampleSetups || []).map(function(example) {
        var reel = state.reels.find(function(item) { return item.id === example.reelId; });
        var line = capacityExamples ? state.selectedLine : state.lines.find(function(item) { return item.id === example.lineId; });
        if (!reel || !line || !isReelReady(reel) || !isLineReady(line)) return "";
        if (capacityExamples) {
          var capacity = fullCapacity(reel, line);
          if (!(capacity > 0) || !Number.isFinite(capacity)) return "";
          return '<article class="rc-example-card rc-capacity-card" data-plan-reel="' + escapeHtml(reel.id) + '"><h3>' + escapeHtml(reelLabel(reel)) +
            '</h3><p class="rc-example-line">' + escapeHtml(lineLabel(line)) + '</p><p class="rc-example-capacity"><span>Estimated full capacity</span><strong>' + formatYards(capacity) +
            '</strong><span>With no backing underneath</span></p>' +
            (capacity < 50 ? '<p class="rc-example-caution">Low estimated capacity. Consider a thinner line or larger reel.</p>' : '') +
            '<div class="rc-example-actions"><a class="rc-button rc-button-secondary" href="' + escapeHtml(wizardUrl(reel, line, 0, 0)) +
            '" data-example-reel="' + escapeHtml(reel.id) + '" data-example-line="' + escapeHtml(line.id) + '">Set Up This Reel</a></div></article>';
        }
        var result = calculateSetup({
          reel: reel,
          line: line,
          spoolYards: example.spoolYards,
          workingYards: example.workingYards,
          backingLine: backingLine
        });
        if (!result.ok) return "";
        var backingValue = result.overCapacity ? "Revise the plan" : result.needsBacking ? result.backingLine ? formatYards(result.backingYards) : "Not selected" : "No volume backing";
        var backingExplanation = result.overCapacity ? "Reduce the working main line before adding backing."
          : result.needsBacking ? result.backingLine ? "Estimated " + lineLabel(result.backingLine) + " to wind on first, underneath the " + formatYards(result.workingYards) + " of working line."
            : "Select backing to fill the space under this shorter main-line amount."
          : "This main-line amount fills the estimated spool volume; follow the reel's attachment instructions.";
        return '<article class="rc-example-card" data-plan-reel="' + escapeHtml(reel.id) + '"><h3>' + escapeHtml(reelLabel(reel)) + '</h3><p class="rc-example-line">' + escapeHtml(lineLabel(line)) + '</p><dl class="rc-plan-details">' +
          examplePlanRow("Estimated full capacity", formatYards(result.fullCapacity), "About this much " + lineLabel(line) + " would fill this reel with no backing underneath.") +
          examplePlanRow("Working main line", formatYards(result.workingYards), "The " + lineLabel(line) + " used for casting and fishing in this plan" + (result.needsBacking && result.backingLine ? ", on top of the backing." : ".")) +
          examplePlanRow("Backing underneath", backingValue, backingExplanation) +
          examplePlanRow("Retail spool", formatYards(result.spoolYards), result.spoolEnoughForPlan ? "The package of " + lineLabel(line) + ". After this one working fill, " + formatYards(result.leftoverYards) + " stays on the package, not on the reel." : "This package is " + formatYards(result.shortfallYards) + " short of the working-line amount. Choose a larger spool.") +
          '</dl><div class="rc-example-actions"><a class="rc-button rc-button-secondary" href="' + escapeHtml(result.wizardUrl) + '" data-example-reel="' + escapeHtml(reel.id) + '" data-example-line="' + escapeHtml(line.id) + '">Build This Setup</a>' +
          (result.assessmentTone === "success" ? lineOfferLink(result.offer, line, "mainline", result.spoolYards) + lineOfferLink(backingLineOffer(result), backingLine, "backing", 0) : "") + '</div></article>';
      }).filter(Boolean);
      el.examples.innerHTML = cards.length ? cards.join("") : "<p>Calculated examples are temporarily unavailable.</p>";
      Array.from(el.examples.querySelectorAll("[data-example-reel]")).forEach(function(link) {
        link.addEventListener("click", function() {
          var line = state.lines.find(function(item) { return item.id === link.dataset.exampleLine; });
          track("line_page_wizard_click", Object.assign(baseEventParameters(), {
            reel_id: link.dataset.exampleReel || "",
            line_id: link.dataset.exampleLine || "",
            selected_lb_test: line ? Number(line.lb) : 0,
            selection_source: "calculated_example"
          }));
        });
      });
      Array.from(el.examples.querySelectorAll("[data-plan-reel]")).forEach(function(card) {
        var reel = state.reels.find(function(item) { return item.id === card.dataset.planReel; });
        bindLineOfferLinks(card, reel, "calculated_example");
      });
    }

    function examplePlanRow(label, value, explanation) {
      return '<div><dt>' + escapeHtml(label) + '</dt><dd><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(explanation) + '</span></dd></div>';
    }

    function backingLineOffer(result) {
      if (result.assessmentTone !== "success" || !result.needsBacking || !result.backingLine || !(result.backingYards > 0) || !global.ReelCalcAffiliateLinks) return null;
      var offer = global.ReelCalcAffiliateLinks.buildRecommendedLineOffer({ affiliateData: state.affiliateData, line: result.backingLine, requiredYards: result.backingYards });
      if (offer && offer.matchType === "generic_search") {
        // Backing package lengths aren't verified here; search by exact product and strength.
        var url = new URL(offer.url);
        var retailer = state.affiliateData.retailers[offer.retailerId];
        url.searchParams.set(retailer.searchQueryParameter || "q", lineLabel(result.backingLine) + " " + normalizedType(result.backingLine.type) + " fishing line");
        offer = Object.assign({}, offer, { url: url.href, suggestedSpoolYards: null });
      }
      return offer;
    }

    function lineOfferLink(offer, line, role, spoolYards, id) {
      if (!offer || !line) return "";
      var className = id === "rcAffiliateCta" ? "rc-button rc-button-affiliate" : "rc-line-offer";
      return '<a class="' + className + '"' + (id ? ' id="' + id + '"' : '') + ' href="' + escapeHtml(offer.url) +
        '" target="_blank" rel="sponsored nofollow noopener" data-affiliate-line="' + escapeHtml(line.id) + '" data-affiliate-role="' + role +
        '" data-retailer="' + escapeHtml(offer.retailerId) + '" data-spool-yards="' + (spoolYards || "") + '">Check ' + escapeHtml(lineLabel(line)) +
        (spoolYards ? " - " + formatYards(spoolYards) : " backing") + ' on ' + escapeHtml(offer.retailerName) + '</a>';
    }

    function bindLineOfferLinks(container, reel, source) {
      Array.from(container.querySelectorAll("[data-affiliate-line]")).forEach(function(link) {
        link.addEventListener("click", function() {
          var line = state.lines.find(function(item) { return item.id === link.dataset.affiliateLine; });
          if (!line || !reel) return;
          var parameters = Object.assign(baseEventParameters(), {
            line_id: line.id, line_brand: line.brand, line_model: line.model, line_type: normalizedType(line.type),
            selected_lb_test: Number(line.lb), diameter_mm: rounded(Number(line.dia_in) * 25.4, 3),
            reel_id: reel.id, reel_brand: reel.brand, reel_series: reel.model, reel_size: reel.size_label || reel.size_class || "",
            line_role: link.dataset.affiliateRole, retailer: link.dataset.retailer,
            selection_source: source, destination: "retailer"
          });
          if (Number(link.dataset.spoolYards) > 0) parameters.spool_length_yd = Number(link.dataset.spoolYards);
          track("line_page_affiliate_click", parameters);
        });
      });
    }

    function fullCapacity(reel, line) {
      if (!global.ReelCalcCore || typeof global.ReelCalcCore.calculateFullSpoolCapacity !== "function") return null;
      if (reel && reel.manualRating) return global.ReelCalcCore.capacityFromRating(reel.manualRating, Number(line && line.dia_in));
      return Number(global.ReelCalcCore.calculateFullSpoolCapacity(reel, line, { lineCatalog: state.lines })) || null;
    }

    function isReelReady(reel) {
      if (reel && reel.manualRating) return positiveNumber(reel.manualRating.capacityYards) > 0 && positiveNumber(reel.manualRating.referenceDiameterIn) > 0;
      return !!(global.ReelCalcCore && global.ReelCalcCore.isReelReady && global.ReelCalcCore.isReelReady(reel));
    }

    function manualRatingNote(reel, line, backingLine) {
      var rating = reel.manualRating;
      var text = "Based on your entered " + rating.type + " rating: " + formatYards(rating.capacityYards) + " at " + cleanNumber(rating.referenceDiameterIn, 4) + " in. " +
        (rating.diameterProvided ? "The reel's printed diameter is used." : "The reference diameter is estimated from the rated lb test.");
      if (backingLine && (isBraid(line) !== isBraid(backingLine))) text += " With one reel rating supplied, the same reference is used for both the main line and backing.";
      if (rating.type === "mono" && isBraid(line)) text += " The mono rating is being used as a fallback for braid.";
      if ([line, backingLine].some(function(item) {
        return item && global.ReelCalcCore.diameterExtrapolation(rating.referenceDiameterIn, Number(item.dia_in)).large;
      })) text += " The selected line diameter differs substantially from this reference; line packing may cause a larger variation in the actual fill.";
      return text;
    }

    function isLineReady(line) {
      return !!(global.ReelCalcCore && global.ReelCalcCore.isLineReady && global.ReelCalcCore.isLineReady(line));
    }

    function isBraid(line) {
      return normalizedType(line && line.type) === "braid";
    }

    function normalizedType(value) {
      var type = String(value || "").toLowerCase();
      if (type.indexOf("braid") >= 0) return "braid";
      if (type.indexOf("mono") >= 0) return "monofilament";
      if (type.indexOf("fluoro") >= 0) return "fluorocarbon";
      if (type.indexOf("copoly") >= 0) return "copolymer";
      return type || "line";
    }

    function sameProduct(a, b) {
      return !!a && !!b && String(a.brand).toLowerCase() === String(b.brand).toLowerCase() && String(a.model).toLowerCase() === String(b.model).toLowerCase();
    }

    function uniqueProductStrengths(lines) {
      var seen = new Set();
      return lines.filter(function(line) {
        var key = [line.brand, line.model, line.lb, line.dia_in].join("|").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function wizardUrl(reel, line, mainYards, spoolYards) {
      var url = new URL("https://www.reelcalc.com/reelcalc-wizard");
      if (reel && reel.id && !reel.manualRating) url.searchParams.set("reel", reel.id);
      if (line && line.id) {
        url.searchParams.set("line", line.id);
        url.searchParams.set("lb", cleanNumber(line.lb, 1));
      }
      if (!(reel && reel.manualRating)) {
        if (positiveNumber(mainYards)) url.searchParams.set("mainYards", cleanNumber(mainYards, 1));
        if (positiveNumber(spoolYards)) url.searchParams.set("spool", cleanNumber(spoolYards, 0));
      }
      return url.href;
    }

    function updateLocation(result) {
      if (!history || typeof history.replaceState !== "function") return;
      var url = new URL(location.href);
      url.searchParams.set("line", result.line.id);
      url.searchParams.set("lb", cleanNumber(result.line.lb, 1));
      if (result.reel.manualRating) {
        url.searchParams.delete("reel");
        url.searchParams.set("reelSource", "manual");
        manualFields().forEach(function(field) { url.searchParams.set(field[0], field[1].value); });
      } else {
        url.searchParams.set("reel", result.reel.id);
        url.searchParams.delete("reelSource");
        manualFields().forEach(function(field) { url.searchParams.delete(field[0]); });
      }
      url.searchParams.set("spool", cleanNumber(result.spoolYards, 0));
      url.searchParams.set("mainYards", cleanNumber(result.workingYards, 1));
      if (result.backingLine && !state.capacityOnly) url.searchParams.set("backingLine", result.backingLine.id);
      else url.searchParams.set("backingLine", "none");
      if (state.capacityOnly) url.searchParams.set("mode", "capacity");
      else if (state.product.defaultMode === "capacity") url.searchParams.set("mode", "backing");
      else url.searchParams.delete("mode");
      history.replaceState(null, "", url.href);
    }

    function baseEventParameters() {
      return {
        page_type: "line_page",
        page_slug: state.product ? state.product.slug : productId,
        line_brand: state.product ? state.product.brand : "",
        line_model: state.product ? state.product.model : "",
        line_type: state.product ? normalizedType(state.product.lineType) : ""
      };
    }

    function selectedLineParameters() {
      var line = state.selectedLine;
      return line ? {
        line_id: line.id || "",
        selected_lb_test: Number(line.lb) || 0,
        diameter_mm: rounded(Number(line.dia_in) * 25.4, 3)
      } : {};
    }

    function reelParameters() {
      var reel = activeReel();
      if (state.reelSource === "manual") return { reel_source: "manual", rating_type: reel ? reel.manualRating.type : "" };
      return reel ? {
        reel_id: reel.id || "",
        reel_brand: reel.brand || "",
        reel_series: reel.model || "",
        reel_size: reel.size_label || reel.size_class || ""
      } : {};
    }

    function track(name, parameters, options) {
      try {
        if (global.ReelCalcAnalytics && typeof global.ReelCalcAnalytics.track === "function") {
          global.ReelCalcAnalytics.track(name, parameters, options || {});
        }
      } catch (error) {
        // Analytics must never interrupt the calculator.
      }
    }

    function fillSelect(select, options, placeholder, selectedValue) {
      var selected = String(selectedValue || "");
      select.innerHTML = '<option value="">' + escapeHtml(placeholder) + "</option>" + options.map(function(option) {
        var value = String(option.value);
        return '<option value="' + escapeHtml(value) + '"' + (value === selected ? " selected" : "") + ">" + escapeHtml(option.label) + "</option>";
      }).join("");
    }

    function optionFromValue(value) {
      return { value: value, label: value };
    }

    function uniqueSorted(values) {
      return Array.from(new Set(values.filter(Boolean))).sort(function(a, b) {
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
      });
    }

    function compareReels(a, b) {
      return numericSizeClass(a) - numericSizeClass(b) || String(reelSizeLabel(a)).localeCompare(String(reelSizeLabel(b)), undefined, { numeric: true, sensitivity: "base" });
    }

    function compareLines(a, b) {
      return String(a.brand || "").localeCompare(String(b.brand || ""), undefined, { sensitivity: "base" }) ||
        String(a.model || "").localeCompare(String(b.model || ""), undefined, { sensitivity: "base" }) ||
        Number(a.lb) - Number(b.lb);
    }

    function numericSizeClass(reel) {
      var match = String(reel && (reel.size_class || reel.size_label || reel.sku) || "").match(/\d+/);
      return match ? Number(match[0]) : 0;
    }

    function reelSizeLabel(reel) {
      return [reel.size_label || reel.size_class || reel.sku || "Size not listed", reel.sku && reel.sku !== reel.size_label ? "- " + reel.sku : ""].filter(Boolean).join(" ");
    }

    function reelLabel(reel) {
      if (reel && reel.manualRating) return "your reel (entered specs)";
      return [reel && reel.brand, reel && reel.model, reel && (reel.size_label || reel.size_class || reel.sku)].filter(Boolean).join(" ");
    }

    function lineLabel(line) {
      return [line && line.brand, line && line.model, line && positiveNumber(line.lb) ? cleanNumber(line.lb, 1) + " lb" : ""].filter(Boolean).join(" ");
    }

    function formatDiameter(line) {
      var inches = Number(line && line.dia_in);
      var mm = Number(line && line.dia_mm) || inches * 25.4;
      return cleanNumber(inches, 3) + " in / " + cleanNumber(mm, 3) + " mm";
    }

    function formatYards(value) {
      return cleanNumber(value, Number(value) < 100 ? 1 : 0) + " yd";
    }

    function cleanNumber(value, digits) {
      var number = Number(value);
      if (!Number.isFinite(number)) return "";
      return number.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    }

    function positiveNumber(value) {
      var number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : 0;
    }

    function rounded(value, digits) {
      var number = Number(value);
      return Number.isFinite(number) ? Number(number.toFixed(digits)) : 0;
    }

    function escapeHtml(value) {
      return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function copyText(value) {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(value);
      var area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      return Promise.resolve();
    }

    function exposeTestApi() {
      global.ReelCalcLinePage = {
        state: state,
        calculateSetup: calculateSetup,
        fullCapacity: fullCapacity,
        wizardUrl: wizardUrl,
        selectLine: function(lineId) {
          var line = state.productLines.find(function(item) { return item.id === lineId; });
          if (line) setSelectedLine(line, false);
          return line || null;
        },
        selectReel: function(reelId) {
          var reel = state.reels.find(function(item) { return item.id === reelId && isReelReady(item); });
          if (!reel) return null;
          state.reelSource = "database";
          state.selectedReel = reel;
          updateReelSource();
          state.reelType = isBaitcaster(reel) ? "baitcasting" : "spinning";
          state.reelBrand = reel.brand;
          state.reelModel = reel.model;
          updateReelTypeButtons();
          populateReelSelectors();
          setSuggestedWorkingAmount(true);
          return reel;
        }
      };
    }
  }

  global.ReelCalcLinePages = { mount: mount };
  function start() {
    var root = document.querySelector("[data-reelcalc-line-page]");
    if (root) mount(root);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(window);
