(function() {
  "use strict";

  if (window.ReelCalcAnalytics) return;

  var VERSION = "1.0";
  var pending = Array.isArray(window.ReelCalcAnalyticsQueue)
    ? window.ReelCalcAnalyticsQueue
    : [];
  var sentOnce = new Set();
  var flushTimer = null;
  var flushAttempts = 0;
  var MAX_QUEUE = 100;
  var MAX_FLUSH_ATTEMPTS = 60;
  var loaderScript = document.currentScript;
  var scriptUrl = loaderScript && loaderScript.src
    ? new URL(loaderScript.src, document.baseURI)
    : null;
  var assetBase = loaderScript && loaderScript.dataset.assetBase
    ? new URL(loaderScript.dataset.assetBase, document.baseURI)
    : scriptUrl
      ? new URL("../", scriptUrl)
      : new URL("./", document.baseURI);
  var lineDataPromise = null;
  var wizardSessionId = "";

  window.ReelCalcAnalyticsQueue = pending;

  function createAnonymousId(prefix) {
    var randomPart = "";
    try {
      randomPart = window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID().replace(/-/g, "")
        : Array.from(window.crypto.getRandomValues(new Uint32Array(4))).map(function(value) {
          return value.toString(36);
        }).join("");
    } catch (error) {
      randomPart = String(Date.now()) + Math.random().toString(36).slice(2);
    }
    return prefix + "_" + randomPart.slice(0, 40);
  }

  function getJourneyId() {
    var storageKey = "reelcalc_journey_id";
    try {
      var current = window.sessionStorage.getItem(storageKey);
      if (current) return current;
      current = createAnonymousId("journey");
      window.sessionStorage.setItem(storageKey, current);
      return current;
    } catch (error) {
      return createAnonymousId("journey");
    }
  }

  var journeyId = getJourneyId();

  function cleanString(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength || 100);
  }

  function cleanEventName(value) {
    return cleanString(value, 40)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function cleanParameters(parameters) {
    var output = {
      reelcalc_version: VERSION,
      journey_id: journeyId
    };
    if (wizardSessionId) output.wizard_session_id = wizardSessionId;
    Object.keys(parameters || {}).slice(0, wizardSessionId ? 22 : 23).forEach(function(key) {
      var cleanKey = cleanString(key, 40)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_");
      var value = parameters[key];
      if (!cleanKey || value === undefined || value === null || value === "") return;
      if (cleanKey === "reelcalc_version" || cleanKey === "journey_id") return;
      if (cleanKey === "wizard_session_id" && wizardSessionId) return;
      if (typeof value === "number") {
        if (Number.isFinite(value)) output[cleanKey] = value;
        return;
      }
      if (typeof value === "boolean") {
        output[cleanKey] = value ? "yes" : "no";
        return;
      }
      output[cleanKey] = cleanString(value, 100);
    });
    return output;
  }

  function emitDebugEvent(name, parameters) {
    try {
      document.dispatchEvent(new CustomEvent("reelcalc:analytics-event", {
        detail: { name: name, parameters: parameters }
      }));
    } catch (error) {
      // Analytics must never interrupt a ReelCalc tool.
    }
  }

  function sendNow(item) {
    if (typeof window.gtag === "function") {
      try {
        window.gtag("event", item.name, item.parameters);
        emitDebugEvent(item.name, item.parameters);
        return true;
      } catch (error) {
        return false;
      }
    }

    if (window.parent && window.parent !== window && document.referrer) {
      try {
        var parentOrigin = new URL(document.referrer).origin;
        window.parent.postMessage({
          source: "reelcalc-analytics",
          name: item.name,
          parameters: item.parameters
        }, parentOrigin);
        emitDebugEvent(item.name, item.parameters);
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  function scheduleFlush() {
    if (flushTimer || flushAttempts >= MAX_FLUSH_ATTEMPTS) return;
    flushTimer = window.setTimeout(function() {
      flushTimer = null;
      flushAttempts += 1;
      flush();
      if (pending.length) scheduleFlush();
    }, 500);
  }

  function flush() {
    if (typeof window.gtag !== "function") return false;
    while (pending.length) {
      if (!sendNow(pending[0])) return false;
      pending.shift();
    }
    return true;
  }

  function track(name, parameters, options) {
    var eventName = cleanEventName(name);
    if (!eventName) return false;

    var settings = options || {};
    var onceKey = settings.onceKey
      ? eventName + ":" + cleanString(settings.onceKey, 200)
      : "";
    if (onceKey && sentOnce.has(onceKey)) return false;
    if (onceKey) sentOnce.add(onceKey);

    var item = {
      name: eventName,
      parameters: cleanParameters(parameters)
    };
    if (sendNow(item)) return true;

    if (pending.length >= MAX_QUEUE) pending.shift();
    pending.push(item);
    scheduleFlush();
    emitDebugEvent(item.name, item.parameters);
    return true;
  }

  function trackOnce(name, parameters, onceKey) {
    return track(name, parameters, { onceKey: onceKey || name });
  }

  function startWizardSession() {
    if (!wizardSessionId) wizardSessionId = createAnonymousId("wizard");
    return wizardSessionId;
  }

  function pageTypeFromLocation() {
    var path = String(location.pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
    if (path === "/") return "homepage";
    if (path.indexOf("reelcalc-wizard") >= 0 || path.indexOf("reel-setup-wizard") >= 0) {
      return "setup_wizard";
    }
    if (path.indexOf("line-database") >= 0) return "line_database";
    if (path.indexOf("fishing-line-setup-guides") >= 0 || path === "/reel-pages") {
      return "guide_directory";
    }
    return "content_page";
  }

  function trackJourneyPageView() {
    if (window.parent && window.parent !== window) return;
    trackOnce("reelcalc_page_view", {
      page_type: pageTypeFromLocation()
    }, location.pathname);
  }

  function numberFromText(value) {
    var match = cleanString(value, 40).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function rowsForTable(table) {
    if (!table) return [];
    return Array.from(table.querySelectorAll("tbody tr.rcdb-data-row"));
  }

  function rowRecord(row) {
    var cells = row ? row.querySelectorAll("td") : [];
    if (cells.length < 6) return null;
    return {
      brand: cleanString(cells[0].textContent, 80),
      model: cleanString(cells[1].textContent, 100),
      type: cleanString(cells[2].textContent, 60),
      lb: numberFromText(cells[3].textContent),
      dia_in: numberFromText(cells[4].textContent),
      dia_mm: numberFromText(cells[5].textContent)
    };
  }

  function sameValue(records, key) {
    if (!records.length) return "";
    var first = records[0][key];
    return records.every(function(record) {
      return String(record[key]) === String(first);
    }) ? first : "";
  }

  function loadLineData() {
    if (!lineDataPromise) {
      lineDataPromise = fetch(new URL("data/lines.json", assetBase).href, {
        credentials: "omit"
      }).then(function(response) {
        if (!response.ok) return [];
        return response.json();
      }).catch(function() {
        return [];
      });
    }
    return lineDataPromise;
  }

  function findCatalogLine(record) {
    if (!record) return Promise.resolve(null);
    return loadLineData().then(function(lines) {
      return lines.find(function(line) {
        return cleanString(line.brand, 80).toLowerCase() === record.brand.toLowerCase() &&
          cleanString(line.model, 100).toLowerCase() === record.model.toLowerCase() &&
          Number(line.lb) === Number(record.lb) &&
          Math.abs(Number(line.dia_in) - Number(record.dia_in)) < 0.00011;
      }) || null;
    });
  }

  function trackLineDatabaseSearch(root, method) {
    var rows = rowsForTable(root.querySelector("#lineTable"));
    var records = rows.map(rowRecord).filter(Boolean);
    var brandFilter = root.querySelector("#brandFilter");
    var typeFilter = root.querySelector("#typeFilter");
    var searchInput = root.querySelector("#lineSearch");
    var params = {
      page_type: "line_database",
      search_method: method,
      result_count: records.length,
      filter_brand: brandFilter ? brandFilter.value : "",
      filter_type: typeFilter ? typeFilter.value : "",
      has_text_query: Boolean(searchInput && searchInput.value.trim())
    };

    if (records.length) {
      params.line_brand = sameValue(records, "brand");
      params.line_model = sameValue(records, "model");
      params.line_type = sameValue(records, "type");
      params.line_lb = sameValue(records, "lb");
    }

    if (records.length === 1) {
      findCatalogLine(records[0]).then(function(line) {
        if (line) params.line_id = line.id;
        track("line_database_search", params);
      });
      return;
    }
    track("line_database_search", params);
  }

  function instrumentLineDatabase() {
    var root = document.getElementById("reelcalc-line-database");
    if (!root || root.dataset.reelcalcAnalyticsReady === "true") return;
    root.dataset.reelcalcAnalyticsReady = "true";
    trackOnce("line_database_view", {
      page_type: "line_database"
    }, location.pathname);

    var searchTimer = null;
    var searchInput = root.querySelector("#lineSearch");
    var brandFilter = root.querySelector("#brandFilter");
    var typeFilter = root.querySelector("#typeFilter");
    var lineSelect = root.querySelector("#lineSelect");
    var findMatchesButton = root.querySelector("#findMatchesButton");

    if (searchInput) {
      searchInput.addEventListener("input", function() {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(function() {
          trackLineDatabaseSearch(root, "text");
        }, 900);
      });
    }
    if (brandFilter) {
      brandFilter.addEventListener("change", function() {
        window.setTimeout(function() {
          trackLineDatabaseSearch(root, "brand_filter");
        }, 0);
      });
    }
    if (typeFilter) {
      typeFilter.addEventListener("change", function() {
        window.setTimeout(function() {
          trackLineDatabaseSearch(root, "type_filter");
        }, 0);
      });
    }
    if (findMatchesButton && lineSelect) {
      findMatchesButton.addEventListener("click", function() {
        window.setTimeout(function() {
          var selectedText = lineSelect.options[lineSelect.selectedIndex]
            ? lineSelect.options[lineSelect.selectedIndex].textContent
            : "";
          var selectedMatch = selectedText.match(/^(.*?)\s+-\s+(\d+(?:\.\d+)?)\s+lb\s+\((\d+(?:\.\d+)?)\s+in\)$/i);
          var resultRows = rowsForTable(root.querySelector("#compareTable"));
          var params = {
            page_type: "line_database",
            result_count: resultRows.length
          };
          if (!selectedMatch) {
            track("line_diameter_comparison", params);
            return;
          }
          var name = cleanString(selectedMatch[1], 180);
          var lineLb = Number(selectedMatch[2]);
          var diameterIn = Number(selectedMatch[3]);
          loadLineData().then(function(lines) {
            var catalogLine = lines.find(function(line) {
              return cleanString(line.brand + " " + line.model, 180).toLowerCase() === name.toLowerCase() &&
                Number(line.lb) === lineLb &&
                Math.abs(Number(line.dia_in) - diameterIn) < 0.00011;
            });
            if (catalogLine) {
              params.line_id = catalogLine.id;
              params.line_brand = catalogLine.brand;
              params.line_model = catalogLine.model;
              params.line_type = catalogLine.type;
              params.line_lb = Number(catalogLine.lb);
            }
            params.line_diameter_mm = Number((diameterIn * 25.4).toFixed(3));
            track("line_diameter_comparison", params);
          });
        }, 0);
      });
    }
  }

  function instrumentHomepageCalculator() {
    var output = document.getElementById("output");
    var reelCapacity = document.getElementById("reelYards");
    var mainLineDiameter = document.getElementById("goodDia");
    if (!output || !reelCapacity || !mainLineDiameter) return;
    var container = output.closest(".calculator-container");
    if (!container || container.dataset.reelcalcAnalyticsReady === "true") return;
    var calculateButton = Array.from(container.querySelectorAll("button")).find(function(button) {
      return cleanString(button.textContent, 30).toLowerCase() === "calculate";
    });
    if (!calculateButton) return;
    container.dataset.reelcalcAnalyticsReady = "true";
    trackOnce("homepage_calculator_view", {
      page_type: "homepage_calculator"
    }, location.pathname);

    calculateButton.addEventListener("click", function() {
      window.setTimeout(function() {
        var outputText = cleanString(output.textContent, 500).toLowerCase();
        if (!outputText || outputText.indexOf("please fill") >= 0 || outputText.indexOf("exceeds") >= 0) {
          return;
        }
        var unitButton = container.querySelector("#unitSegment [data-unit].active");
        var modeButton = container.querySelector("#modeSegment [data-mode].active");
        var unitSystem = unitButton ? unitButton.dataset.unit : "standard";
        var mode = modeButton ? modeButton.dataset.mode : "backing";
        var isMetric = unitSystem === "metric";
        var capacityDisplay = Number(reelCapacity.value) || 0;
        var mainLengthDisplay = Number((document.getElementById("goodYards") || {}).value) || 0;
        var mainDiameterDisplay = Number(mainLineDiameter.value) || 0;
        var backingDiameterDisplay = Number((document.getElementById("backDia") || {}).value) || 0;
        track("homepage_calculation_completed", {
          page_type: "homepage_calculator",
          calculator_mode: mode,
          unit_system: unitSystem,
          reel_capacity_yards: Number((isMetric ? capacityDisplay * 1.0936133 : capacityDisplay).toFixed(1)),
          rated_line_lb: Number((document.getElementById("reelLb") || {}).value) || 0,
          rated_line_diameter_mm: isMetric
            ? Number((Number((document.getElementById("reelDia") || {}).value) || 0).toFixed(3))
            : 0,
          main_line_yards: Number((isMetric ? mainLengthDisplay * 1.0936133 : mainLengthDisplay).toFixed(1)),
          main_line_diameter_mm: Number((isMetric ? mainDiameterDisplay : mainDiameterDisplay * 25.4).toFixed(3)),
          backing_used: mode === "backing",
          backing_diameter_mm: mode === "backing"
            ? Number((isMetric ? backingDiameterDisplay : backingDiameterDisplay * 25.4).toFixed(3))
            : 0,
          handle_turns_available: (Number((document.getElementById("reelIPT") || {}).value) || 0) > 0
        });
      }, 0);
    });
  }

  window.ReelCalcAnalytics = {
    version: VERSION,
    track: track,
    trackOnce: trackOnce,
    flush: flush,
    startWizardSession: startWizardSession,
    getWizardSessionId: function() { return wizardSessionId; },
    getJourneyId: function() { return journeyId; },
    instrumentLineDatabase: instrumentLineDatabase,
    instrumentHomepageCalculator: instrumentHomepageCalculator
  };

  var queuedBeforeLoad = pending.splice(0, pending.length);
  queuedBeforeLoad.forEach(function(item) {
    if (!item || !item.name) return;
    track(item.name, item.parameters, item.options);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      trackJourneyPageView();
      instrumentLineDatabase();
      instrumentHomepageCalculator();
    }, { once: true });
  } else {
    trackJourneyPageView();
    instrumentLineDatabase();
    instrumentHomepageCalculator();
  }
  scheduleFlush();
})();
