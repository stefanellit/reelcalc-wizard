(function() {
  "use strict";

  var loaderScript = document.currentScript;
  var scriptUrl = new URL(loaderScript.src, document.baseURI);
  var assetBase = loaderScript.dataset.assetBase
    ? new URL(loaderScript.dataset.assetBase, document.baseURI)
    : new URL("../", scriptUrl);
  var reelCache = new Map();
  var corePromise = null;

  function loadCore() {
    if (window.ReelCalcCore) return Promise.resolve(window.ReelCalcCore);
    if (corePromise) return corePromise;

    corePromise = new Promise(function(resolve, reject) {
      var script = document.createElement("script");
      script.src = new URL("js/calculator-core.js", assetBase).href;
      script.onload = function() {
        if (window.ReelCalcCore) resolve(window.ReelCalcCore);
        else reject(new Error("Calculator core loaded without ReelCalcCore."));
      };
      script.onerror = function() {
        reject(new Error("Calculator core could not be loaded."));
      };
      document.head.appendChild(script);
    });

    return corePromise;
  }

  function loadReels(url) {
    if (!reelCache.has(url)) {
      reelCache.set(url, fetch(url, { credentials: "omit" }).then(function(response) {
        if (!response.ok) throw new Error("Reel data returned HTTP " + response.status + ".");
        return response.json();
      }).then(function(data) {
        if (!Array.isArray(data)) throw new Error("Reel data is not an array.");
        return data;
      }));
    }
    return reelCache.get(url);
  }

  function renderLoadError(mount, message) {
    mount.innerHTML = "";
    var box = document.createElement("div");
    box.className = "reelcalc-page-status";
    box.setAttribute("role", "status");
    box.textContent = message;
    mount.appendChild(box);
  }

  function calculatorTemplate(reel, defaults) {
    var startingSetup = defaults.showStartingSetup
      ? '<p class="starting-setup"><strong>Suggested starting setup:</strong> ' +
        escapeHtml(defaults.mainLineLb) + " lb braid, " +
        escapeHtml(defaults.mainLineYards) + " yards, over " +
        escapeHtml(defaults.backingLb) + " lb monofilament backing. " +
        "Using more backing can reduce how much premium line you need.</p>"
      : "";
    return `
      <style>
        :host {
          color: #1f2528;
          display: block;
          font-family: Arial, sans-serif;
        }
        * { box-sizing: border-box; }
        .calculator-container {
          margin: 20px auto;
          max-width: 600px;
          padding: 20px;
        }
        label {
          display: block;
          font-weight: bold;
          letter-spacing: 0;
          margin-top: 15px;
        }
        .info-btn {
          background: transparent;
          border: 0;
          color: inherit;
          cursor: pointer;
          display: inline;
          font-size: 14px;
          margin: 0 0 0 6px;
          opacity: 0.7;
          padding: 0;
          width: auto;
        }
        .info-btn:hover { opacity: 1; }
        input {
          background: #ffffff;
          border: 1px solid #cccccc;
          border-radius: 8px;
          color: #111111;
          font: inherit;
          margin-top: 5px;
          padding: 8px;
          width: 100%;
        }
        input:disabled {
          background: rgba(0, 0, 0, 0.06);
          cursor: not-allowed;
          opacity: 0.75;
        }
        .calculate-btn,
        .modal button {
          background: #4caf50;
          border: 0;
          border-radius: 8px;
          color: #ffffff;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          margin-top: 20px;
          padding: 10px;
          width: 100%;
        }
        .calculate-btn:hover { background: #3f9343; }
        .output {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          margin-top: 20px;
          min-height: 48px;
          padding: 12px;
          white-space: normal;
        }
        .output:empty { display: none; }
        .savings-box {
          background: rgba(76, 175, 80, 0.1);
          border-left: 4px solid #4caf50;
          border-radius: 6px;
          font-size: 15px;
          margin-top: 15px;
          padding: 12px;
        }
        .turns-box {
          border-top: 1px solid #cfd4d6;
          margin-top: 16px;
          padding-top: 16px;
        }
        .turns-note {
          display: block;
          font-size: 13px;
          margin-top: 10px;
          opacity: 0.78;
        }
        .toggle-row {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          font-weight: bold;
          gap: 10px;
          justify-content: center;
          margin: 10px 0 12px;
        }
        .toggle-subtext {
          font-size: 13px;
          margin: -4px 0 14px;
          opacity: 0.75;
          text-align: center;
        }
        .segmented {
          background: rgba(0, 0, 0, 0.06);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 999px;
          display: flex;
          max-width: 520px;
          padding: 3px;
          width: 100%;
        }
        .seg-btn {
          background: transparent;
          border: 0;
          border-radius: 999px;
          color: rgba(0, 0, 0, 0.65);
          cursor: pointer;
          flex: 1;
          font-size: 13px;
          font-weight: 800;
          margin: 0;
          min-width: 0;
          padding: 10px 12px;
        }
        .seg-btn.active[data-unit="standard"] {
          background: rgba(231, 76, 60, 0.26);
          color: rgba(0, 0, 0, 0.82);
        }
        .seg-btn.active[data-unit="metric"] {
          background: rgba(52, 152, 219, 0.26);
          color: rgba(0, 0, 0, 0.82);
        }
        .seg-btn.active[data-mode="backing"] {
          background: linear-gradient(90deg, rgba(52, 152, 219, 0.26), rgba(46, 204, 113, 0.26), rgba(155, 89, 182, 0.26));
          color: rgba(0, 0, 0, 0.82);
        }
        .seg-btn.active[data-mode="capacity"] {
          background: linear-gradient(90deg, rgba(52, 152, 219, 0.26), rgba(46, 204, 113, 0.26));
          color: rgba(0, 0, 0, 0.82);
        }
        .mode-badge {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 999px;
          color: #0b1b17;
          display: inline-block;
          font-size: 12px;
          font-weight: 800;
          margin-right: 8px;
          padding: 3px 10px;
          vertical-align: middle;
        }
        .badge-capacity {
          background: linear-gradient(90deg, rgba(52, 152, 219, 0.35), rgba(46, 204, 113, 0.35));
        }
        .badge-backing {
          background: linear-gradient(90deg, rgba(52, 152, 219, 0.35), rgba(46, 204, 113, 0.35), rgba(155, 89, 182, 0.35));
        }
        .calc-group {
          border: 1px solid #e6e6e6;
          border-radius: 12px;
          margin-top: 18px;
          padding: 14px 14px 10px 18px;
          position: relative;
        }
        .calc-group h3 {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0;
          margin: 0 0 8px;
        }
        .calc-group::before {
          border-radius: 10px;
          bottom: 10px;
          content: "";
          left: 0;
          position: absolute;
          top: 10px;
          width: 6px;
        }
        .group-reel {
          background: rgba(52, 152, 219, 0.08);
          border-color: rgba(52, 152, 219, 0.25);
        }
        .group-reel::before { background: #3498db; }
        .group-premium {
          background: rgba(46, 204, 113, 0.08);
          border-color: rgba(46, 204, 113, 0.25);
        }
        .group-premium::before { background: #2ecc71; }
        .group-backing {
          background: rgba(155, 89, 182, 0.08);
          border-color: rgba(155, 89, 182, 0.25);
        }
        .group-backing::before { background: #9b59b6; }
        .modal-overlay {
          align-items: center;
          background: rgba(0, 0, 0, 0.6);
          display: none;
          inset: 0;
          justify-content: center;
          position: fixed;
          z-index: 9999;
        }
        .modal {
          background: #ffffff;
          border-radius: 12px;
          color: #000000;
          max-width: 420px;
          padding: 20px;
          width: 90%;
        }
        .modal h3,
        .modal p { color: #000000; }
        .modal h3 { margin: 0 0 10px; }
        .modal button { background: #444444; }
        .reel-name {
          color: #5e666a;
          font-size: 13px;
          margin: 0 0 8px;
          text-align: center;
        }
        .starting-setup {
          background: rgba(46, 125, 50, 0.08);
          border-left: 4px solid #2e7d32;
          border-radius: 6px;
          color: #26332b;
          font-size: 13px;
          line-height: 1.5;
          margin: 0 0 14px;
          padding: 10px 12px;
        }
        .hidden { display: none !important; }
        @media (max-width: 520px) {
          .calculator-container { padding: 8px 0; }
          .seg-btn {
            font-size: 12px;
            padding: 10px 7px;
          }
        }
      </style>
      <div class="calculator-container">
        <p class="reel-name">Pre-loaded for ${escapeHtml(displayName(reel))}</p>
        ${startingSetup}
        <div class="toggle-row">
          <div class="segmented" data-role="unit-segment" aria-label="Units">
            <button type="button" class="seg-btn active" data-unit="standard">Standard</button>
            <button type="button" class="seg-btn" data-unit="metric">Metric</button>
          </div>
        </div>
        <div class="toggle-row">
          <div class="segmented" data-role="mode-segment" aria-label="Calculator mode">
            <button type="button" class="seg-btn active" data-mode="backing">Backing + Working Line</button>
            <button type="button" class="seg-btn" data-mode="capacity">Capacity Only</button>
          </div>
          <button type="button" class="info-btn" data-info="modes" aria-label="About calculator modes">i</button>
        </div>
        <div class="toggle-subtext" data-role="mode-subtext">
          <span class="mode-badge badge-backing">BACKING MODE</span>
          Backing mode is selected: calculate backing + your chosen working line length.
        </div>
        <div class="calc-group group-reel">
          <h3>Reel Specs</h3>
          <div data-role="reel-lb-wrap">
            <label>
              Reel rated mono lb test
              <button type="button" class="info-btn" data-info="reel-lb" aria-label="About rated mono pound test">i</button>
            </label>
            <input data-role="reel-lb" type="number" inputmode="decimal">
          </div>
          <div class="hidden" data-role="reel-dia-wrap">
            <label>
              Reel rated mono diameter (mm)
              <button type="button" class="info-btn" data-info="reel-dia" aria-label="About rated mono diameter">i</button>
            </label>
            <input data-role="reel-dia" type="number" inputmode="decimal" step="0.01">
          </div>
          <label>
            Reel capacity (<span data-role="length-unit">yards</span>)
            <button type="button" class="info-btn" data-info="reel-capacity" aria-label="About reel capacity">i</button>
          </label>
          <input data-role="reel-yards" type="number" inputmode="decimal">
        </div>
        <div class="calc-group group-premium">
          <h3>Premium Line</h3>
          <label>
            Braid/Fluoro line (<span data-role="length-unit">yards</span>)
            <button type="button" class="info-btn" data-info="premium-length" aria-label="About premium line length">i</button>
          </label>
          <input data-role="good-yards" type="number" inputmode="decimal" value="${escapeHtml(defaults.mainLineYards)}" placeholder="Example: 50">
          <label>
            Braid/Fluoro line diameter (<span data-role="dia-unit">in</span>)
            <button type="button" class="info-btn" data-info="premium-dia" aria-label="About premium line diameter">i</button>
          </label>
          <input data-role="good-dia" type="number" inputmode="decimal" step="0.001" value="${escapeHtml(defaults.mainLineDiameterIn)}">
        </div>
        <div class="calc-group group-backing" data-role="backing-group">
          <h3>Backing</h3>
          <label>
            Backing diameter (<span data-role="dia-unit">in</span>)
            <button type="button" class="info-btn" data-info="backing-dia" aria-label="About backing diameter">i</button>
          </label>
          <input data-role="back-dia" type="number" inputmode="decimal" step="0.001" value="${escapeHtml(defaults.backingDiameterIn)}">
        </div>
        <button type="button" class="calculate-btn" data-role="calculate">Calculate</button>
        <label>
          Reel <span data-role="ipt-unit">inches</span> per turn (optional)
          <button type="button" class="info-btn" data-info="ipt" aria-label="About line retrieve per turn">i</button>
        </label>
        <input data-role="reel-ipt" type="number" inputmode="decimal" step="0.1" placeholder="Optional">
        <div class="output" data-role="output" aria-live="polite"></div>
      </div>
      <div class="modal-overlay" data-role="modal-overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="reelcalc-modal-title">
          <h3 id="reelcalc-modal-title" data-role="modal-title"></h3>
          <p data-role="modal-text"></p>
          <button type="button" data-role="modal-close">Close</button>
        </div>
      </div>
    `;
  }

  function displayName(reel) {
    return [reel.brand, reel.model, reel.size_label].filter(Boolean).join(" ");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function calculatorDefaults(mount) {
    var mainLineLb = Number(mount.dataset.mainLineLb);
    var mainLineYards = Number(mount.dataset.mainLineYards);
    var mainLineDiameterIn = Number(mount.dataset.mainLineDiameterIn);
    var backingLb = Number(mount.dataset.backingLb);
    var backingDiameterIn = Number(mount.dataset.backingDiameterIn);
    var showStartingSetup =
      mainLineLb > 0 &&
      mainLineYards > 0 &&
      mainLineDiameterIn > 0 &&
      backingLb > 0 &&
      backingDiameterIn > 0;

    return {
      mainLineLb: mainLineLb > 0 ? mainLineLb : "",
      mainLineYards: mainLineYards > 0 ? mainLineYards : 50,
      mainLineDiameterIn: mainLineDiameterIn > 0 ? mainLineDiameterIn : 0.009,
      backingLb: backingLb > 0 ? backingLb : "",
      backingDiameterIn: backingDiameterIn > 0 ? backingDiameterIn : 0.012,
      showStartingSetup: showStartingSetup
    };
  }

  function mountCalculator(mount, reel, core) {
    var shadow = mount.shadowRoot || mount.attachShadow({ mode: "open" });
    var defaults = calculatorDefaults(mount);
    shadow.innerHTML = calculatorTemplate(reel, defaults);

    var state = {
      isMetric: false,
      isCapacityOnly: false,
      currentDisplayIsMetric: false,
      lastStandardReelLb: Number(reel.rated_line_lb),
      standardRatedDiameterIn: Number(reel.rated_line_diameter_in),
      lastMetricReelDiaMm: Number(reel.rated_line_diameter_in) * core.MM_PER_INCH
    };
    var PREMIUM_LINE_COST_LOW = 0.10;
    var PREMIUM_LINE_COST_HIGH = 0.16;
    var BACKING_COST_LOW = 0.01;
    var BACKING_COST_HIGH = 0.03;
    var INCH_TO_CM = 2.54;
    var CM_TO_INCH = 1 / INCH_TO_CM;

    function q(role) {
      return shadow.querySelector('[data-role="' + role + '"]');
    }

    function qa(role) {
      return shadow.querySelectorAll('[data-role="' + role + '"]');
    }

    function safeNumber(element) {
      var value = String(element.value || "").trim();
      return value === "" ? NaN : Number(value);
    }

    function setSegmentActive(role, key, value) {
      q(role).querySelectorAll(".seg-btn").forEach(function(button) {
        button.classList.toggle("active", button.dataset[key] === value);
      });
    }

    function showInfo(title, text) {
      q("modal-title").textContent = title;
      q("modal-text").textContent = text;
      q("modal-overlay").style.display = "flex";
      q("modal-close").focus();
    }

    function hideInfo() {
      q("modal-overlay").style.display = "none";
    }

    function infoContent(key) {
      var content = {
        modes: [
          "Calculator Modes",
          "Backing + Working Line calculates how much backing you need beneath a chosen working-line length. Capacity Only estimates how much of the selected line fills the spool without backing."
        ],
        "reel-lb": [
          "Reel rated mono lb test",
          "This is pre-loaded from the reel's published monofilament capacity rating."
        ],
        "reel-dia": [
          "Reel rated mono diameter",
          "This is the diameter associated with the reel's published capacity rating."
        ],
        "reel-capacity": [
          state.isMetric ? "Reel capacity (meters)" : "Reel capacity (yards)",
          "This capacity is pre-loaded from ReelCalc's verified reel record."
        ],
        "premium-length": [
          "Premium line length",
          "Enter how much braid or fluorocarbon you want on top. This field is not used in Capacity Only mode."
        ],
        "premium-dia": [
          "Premium line diameter",
          "Enter the published diameter of the exact braid or fluorocarbon you plan to use."
        ],
        "backing-dia": [
          "Backing diameter",
          "Enter the published diameter of your backing line."
        ],
        ipt: [
          "Reel line retrieve",
          "ReelCalc pre-loads the published line retrieve when it is available. Standard uses inches per turn and Metric uses centimeters per turn."
        ]
      };
      return content[key];
    }

    function updateUnitUI() {
      qa("length-unit").forEach(function(element) {
        element.textContent = state.isMetric ? "meters" : "yards";
      });
      qa("dia-unit").forEach(function(element) {
        element.textContent = state.isMetric ? "mm" : "in";
      });
      q("good-dia").step = state.isMetric ? "0.01" : "0.001";
      q("back-dia").step = state.isMetric ? "0.01" : "0.001";
      q("ipt-unit").textContent = state.isMetric ? "cm" : "inches";
    }

    function updateReelSpecUI() {
      var reelLb = q("reel-lb");
      var reelDia = q("reel-dia");

      if (state.isMetric) {
        var lbValue = Number(reelLb.value);
        if (lbValue > 0) state.lastStandardReelLb = lbValue;
        if (reelDia.dataset.userEdited !== "true") {
          reelDia.value = state.lastMetricReelDiaMm.toFixed(3);
        }
        q("reel-lb-wrap").classList.add("hidden");
        q("reel-dia-wrap").classList.remove("hidden");
      } else {
        reelLb.value = state.lastStandardReelLb;
        var diaValue = Number(reelDia.value);
        if (diaValue > 0) state.lastMetricReelDiaMm = diaValue;
        q("reel-dia-wrap").classList.add("hidden");
        q("reel-lb-wrap").classList.remove("hidden");
      }
    }

    function convertDisplayedValues(toMetric) {
      if (toMetric === state.currentDisplayIsMetric) return;

      var reelLength = safeNumber(q("reel-yards"));
      var goodLength = safeNumber(q("good-yards"));
      var goodDiameter = safeNumber(q("good-dia"));
      var backingDiameter = safeNumber(q("back-dia"));
      var ipt = safeNumber(q("reel-ipt"));

      if (toMetric) {
        if (!Number.isNaN(reelLength)) q("reel-yards").value = core.yardsToMeters(reelLength).toFixed(1);
        if (!Number.isNaN(goodLength)) q("good-yards").value = core.yardsToMeters(goodLength).toFixed(1);
        if (!Number.isNaN(goodDiameter)) q("good-dia").value = core.inchesToMm(goodDiameter).toFixed(2);
        if (!Number.isNaN(backingDiameter)) q("back-dia").value = core.inchesToMm(backingDiameter).toFixed(2);
        if (!Number.isNaN(ipt)) q("reel-ipt").value = (ipt * INCH_TO_CM).toFixed(1);
      } else {
        if (!Number.isNaN(reelLength)) q("reel-yards").value = core.metersToYards(reelLength).toFixed(1);
        if (!Number.isNaN(goodLength)) q("good-yards").value = core.metersToYards(goodLength).toFixed(1);
        if (!Number.isNaN(goodDiameter)) q("good-dia").value = core.mmToInches(goodDiameter).toFixed(3);
        if (!Number.isNaN(backingDiameter)) q("back-dia").value = core.mmToInches(backingDiameter).toFixed(3);
        if (!Number.isNaN(ipt)) q("reel-ipt").value = (ipt * CM_TO_INCH).toFixed(1);
      }

      state.currentDisplayIsMetric = toMetric;
    }

    function updateModeUI() {
      var goodYards = q("good-yards");
      setSegmentActive("mode-segment", "mode", state.isCapacityOnly ? "capacity" : "backing");

      if (state.isCapacityOnly) {
        q("backing-group").classList.add("hidden");
        q("mode-subtext").innerHTML = '<span class="mode-badge badge-capacity">CAPACITY MODE</span>Capacity Only is selected: estimate the maximum amount of your braid/fluoro that fills the reel (no backing).';
        goodYards.disabled = true;
        goodYards.placeholder = "Disabled in Capacity Only";
      } else {
        q("backing-group").classList.remove("hidden");
        q("mode-subtext").innerHTML = '<span class="mode-badge badge-backing">BACKING MODE</span>Backing mode is selected: calculate backing + your chosen working line length.';
        goodYards.disabled = false;
        goodYards.placeholder = "Example: 50";
      }
    }

    function calculate(interactionSource) {
      var reelLengthDisplay = Number(q("reel-yards").value);
      var goodLengthDisplay = Number(q("good-yards").value);
      var goodDiameterDisplay = Number(q("good-dia").value);
      var backingDiameterDisplay = Number(q("back-dia").value);
      var reelLb = Number(q("reel-lb").value);
      var reelDiameterMm = Number(q("reel-dia").value);
      var output = q("output");
      var missingStandardReel = !state.isMetric && !reelLb;
      var missingMetricReel = state.isMetric && !reelDiameterMm;

      if (
        !reelLengthDisplay ||
        !goodDiameterDisplay ||
        missingStandardReel ||
        missingMetricReel ||
        (!state.isCapacityOnly && !backingDiameterDisplay) ||
        (!state.isCapacityOnly && !goodLengthDisplay)
      ) {
        output.textContent = "Please fill in all required fields.";
        return;
      }

      var reelYards = state.isMetric ? core.metersToYards(reelLengthDisplay) : reelLengthDisplay;
      var goodYards = state.isMetric ? core.metersToYards(goodLengthDisplay) : goodLengthDisplay;
      var goodDiameterIn = state.isMetric ? core.mmToInches(goodDiameterDisplay) : goodDiameterDisplay;
      var backingDiameterIn = state.isMetric ? core.mmToInches(backingDiameterDisplay) : backingDiameterDisplay;
      var ratedDiameterIn = state.isMetric
        ? core.mmToInches(reelDiameterMm)
        : state.standardRatedDiameterIn;
      var calculationReel = {
        capacity_yards: reelYards,
        rated_line_diameter_in: ratedDiameterIn
      };
      var selectedLine = { dia_in: goodDiameterIn };
      var unitLabel = state.isMetric ? "meters" : "yards";

      if (state.isCapacityOnly) {
        var maxGoodYards = core.calculateMainLineCapacity(calculationReel, selectedLine);
        if (!(maxGoodYards > 0)) {
          output.textContent = "Please check the reel and line values.";
          return;
        }
        var maxOutput = state.isMetric ? core.yardsToMeters(maxGoodYards) : maxGoodYards;
        output.innerHTML =
          "<strong>Capacity Only Result</strong><br><br>" +
          "Estimated maximum that will fill the reel:<br>" +
          "<strong>Braid/Fluoro line:</strong> " + maxOutput.toFixed(1) + " " + unitLabel +
          '<div style="margin-top:6px;font-size:13px;opacity:0.8;">Note: This is an estimate based on line diameter and the reel&#39;s rated capacity.</div>';

        appendHandleTurns(output, maxGoodYards, null);
        dispatchCompleted(mount, reel, "capacity", {
          interactionSource: interactionSource || "automatic",
          isUserInitiated: interactionSource !== "initial",
          unitSystem: state.isMetric ? "metric" : "standard",
          mainLineYards: Number(maxGoodYards.toFixed(1)),
          mainLineDiameterMm: Number((goodDiameterIn * core.MM_PER_INCH).toFixed(3)),
          backingYards: 0,
          startingMainLineLb: Number(defaults.mainLineLb) || 0,
          startingBackingLb: Number(defaults.backingLb) || 0
        });
        return;
      }

      var backingResult = core.calculateBackingNeeded(
        calculationReel,
        selectedLine,
        goodYards,
        { dia_in: backingDiameterIn }
      );

      if (!backingResult || backingResult.overCapacity) {
        output.textContent = "Premium line exceeds reel capacity. Reduce length or use thinner line.";
        return;
      }

      var backingYards = backingResult.backingYards;
      var maxPremiumOnlyYards = core.calculateMainLineCapacity(calculationReel, selectedLine);
      var premiumYardsAvoided = Math.max(0, maxPremiumOnlyYards - goodYards);
      var savingsLow = Math.max(
        0,
        premiumYardsAvoided * PREMIUM_LINE_COST_LOW - backingYards * BACKING_COST_HIGH
      );
      var savingsHigh = Math.max(
        savingsLow,
        premiumYardsAvoided * PREMIUM_LINE_COST_HIGH - backingYards * BACKING_COST_LOW
      );
      var savingsLowRounded = Math.floor(savingsLow);
      var savingsHighRounded = Math.ceil(savingsHigh);
      var savingsLabel = savingsLowRounded < 1
        ? "Up to about $" + savingsHighRounded
        : savingsLowRounded === savingsHighRounded
          ? "About $" + savingsLowRounded
          : "About $" + savingsLowRounded + "-$" + savingsHighRounded;
      var backingOutput = state.isMetric ? core.yardsToMeters(backingYards) : backingYards;
      var goodOutput = state.isMetric ? core.yardsToMeters(goodYards) : goodYards;
      var totalOutput = backingOutput + goodOutput;

      output.innerHTML =
        "You need:<br>" +
        "<strong>Backing:</strong> " + backingOutput.toFixed(1) + " " + unitLabel + "<br>" +
        "<strong>Braid/Fluoro line:</strong> " + goodOutput.toFixed(1) + " " + unitLabel + "<br>" +
        "<strong>Total on spool:</strong> " + totalOutput.toFixed(1) + " " + unitLabel +
        '<div style="margin-top:6px;font-size:13px;opacity:0.8;">Note: A total length greater than the reel&#39;s rated capacity is normal due to differences in line diameter.</div>' +
        '<div class="savings-box"><strong>Estimated Line-Cost Savings</strong><br><br>' +
        "<strong>" + savingsLabel + "</strong><br>" +
        "Savings come from using lower-cost backing instead of filling the entire spool with premium line.<br>" +
        "<em>Typical retail estimate using $0.10-$0.16 per yard for premium line and " +
        "$0.01-$0.03 per yard for backing. Actual prices vary by line, strength, and spool size.</em></div>";

      appendHandleTurns(output, goodYards, backingYards);
      dispatchCompleted(mount, reel, "backing", {
        interactionSource: interactionSource || "automatic",
        isUserInitiated: interactionSource !== "initial",
        unitSystem: state.isMetric ? "metric" : "standard",
        mainLineYards: Number(goodYards.toFixed(1)),
        mainLineDiameterMm: Number((goodDiameterIn * core.MM_PER_INCH).toFixed(3)),
        backingYards: Number(backingYards.toFixed(1)),
        backingDiameterMm: Number((backingDiameterIn * core.MM_PER_INCH).toFixed(3)),
        startingMainLineLb: Number(defaults.mainLineLb) || 0,
        startingBackingLb: Number(defaults.backingLb) || 0
      });
    }

    function appendHandleTurns(output, workingYards, backingYards) {
      var iptDisplay = Number(q("reel-ipt").value);
      if (!(iptDisplay > 0)) return;
      var iptInches = state.isMetric ? iptDisplay * CM_TO_INCH : iptDisplay;
      var workingTurns = core.calculateHandleTurns(workingYards, iptInches);
      if (!workingTurns) return;

      var html = '<div class="turns-box"><strong>Estimated Handle Turns</strong><br>';
      if (backingYards !== null) {
        var backingTurns = core.calculateHandleTurns(backingYards, iptInches);
        html += "<strong>Backing:</strong> " + backingTurns.rawTurns.toFixed(1) + " turns<br>";
        html += "<strong>Working Line:</strong> " + workingTurns.rawTurns.toFixed(1) + " turns";
      } else {
        html += "<strong>Total line:</strong> " + workingTurns.rawTurns.toFixed(1) + " turns";
      }
      html += '<span class="turns-note"><em>Handle turns are estimated. Actual turns may vary slightly as spool diameter changes while filling.</em></span></div>';
      output.insertAdjacentHTML("beforeend", html);
    }

    function dispatchCompleted(element, reelRecord, mode, calculation) {
      element.dispatchEvent(new CustomEvent("reelcalc:calculation-completed", {
        bubbles: true,
        detail: Object.assign({
          reelId: reelRecord.id,
          reelBrand: reelRecord.brand || "",
          reelModel: reelRecord.model || "",
          reelSize: reelRecord.size_label || reelRecord.size_class || "",
          mode: mode
        }, calculation || {})
      }));
    }

    q("reel-lb").value = reel.rated_line_lb;
    q("reel-yards").value = reel.capacity_yards;
    q("reel-dia").value = state.lastMetricReelDiaMm.toFixed(3);
    q("reel-dia").dataset.userEdited = "false";
    if (Number(reel.line_retrieve_in) > 0) q("reel-ipt").value = Number(reel.line_retrieve_in);

    q("unit-segment").addEventListener("click", function(event) {
      var button = event.target.closest(".seg-btn");
      if (!button) return;
      var goingMetric = button.dataset.unit === "metric";
      setSegmentActive("unit-segment", "unit", button.dataset.unit);
      convertDisplayedValues(goingMetric);
      state.isMetric = goingMetric;
      updateReelSpecUI();
      updateUnitUI();
      calculate("unit_change");
    });

    q("mode-segment").addEventListener("click", function(event) {
      var button = event.target.closest(".seg-btn");
      if (!button) return;
      state.isCapacityOnly = button.dataset.mode === "capacity";
      updateModeUI();
      calculate("mode_change");
    });

    shadow.querySelectorAll("[data-info]").forEach(function(button) {
      button.addEventListener("click", function() {
        var content = infoContent(button.dataset.info);
        if (content) showInfo(content[0], content[1]);
      });
    });

    q("modal-close").addEventListener("click", hideInfo);
    q("modal-overlay").addEventListener("click", function(event) {
      if (event.target === q("modal-overlay")) hideInfo();
    });
    q("calculate").addEventListener("click", function() {
      calculate("calculate_button");
    });
    q("reel-dia").addEventListener("input", function() {
      this.dataset.userEdited = "true";
      var value = Number(this.value);
      if (value > 0) state.lastMetricReelDiaMm = value;
    });
    q("reel-lb").addEventListener("input", function() {
      var value = Number(this.value);
      if (value > 0) {
        state.lastStandardReelLb = value;
        state.standardRatedDiameterIn = core.monoDiameter(value);
        if (q("reel-dia").dataset.userEdited !== "true") {
          state.lastMetricReelDiaMm = state.standardRatedDiameterIn * core.MM_PER_INCH;
        }
      }
    });

    [
      "reel-lb",
      "reel-dia",
      "reel-yards",
      "good-yards",
      "good-dia",
      "back-dia",
      "reel-ipt"
    ].forEach(function(role) {
      q(role).addEventListener("change", function() {
        calculate("input_change");
      });
    });

    setSegmentActive("unit-segment", "unit", "standard");
    setSegmentActive("mode-segment", "mode", "backing");
    updateUnitUI();
    updateModeUI();
    updateReelSpecUI();
    calculate("initial");
    mount.dataset.reelcalcReady = "true";
    mount.dispatchEvent(new CustomEvent("reelcalc:calculator-ready", {
      bubbles: true,
      detail: {
        reelId: reel.id,
        reelBrand: reel.brand || "",
        reelModel: reel.model || "",
        reelSize: reel.size_label || reel.size_class || ""
      }
    }));
  }

  function initializeMount(mount) {
    if (mount.dataset.reelcalcReady === "true") return;
    var reelId = String(mount.dataset.reelId || "").trim();
    if (!reelId) {
      renderLoadError(mount, "This reel calculator is missing its ReelCalc reel ID.");
      return;
    }

    var reelsUrl = mount.dataset.reelsUrl
      ? new URL(mount.dataset.reelsUrl, document.baseURI).href
      : new URL("data/reels.json", assetBase).href;

    Promise.all([loadCore(), loadReels(reelsUrl)]).then(function(values) {
      var core = values[0];
      var reels = values[1];
      var reel = reels.find(function(record) {
        return record.id === reelId;
      });

      if (!reel) {
        renderLoadError(mount, "ReelCalc could not find the reel record \"" + reelId + "\".");
        return;
      }
      if (!core.isReelReady(reel)) {
        renderLoadError(mount, "This reel is missing verified capacity data. The calculator cannot be pre-loaded yet.");
        return;
      }

      mountCalculator(mount, reel, core);
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

  window.ReelCalcReelPageCalculator = {
    initialize: initializeAll
  };
})();
