(function() {
  "use strict";

  var loaderScript = document.currentScript;
  var loaderUrl = new URL(loaderScript && loaderScript.src ? loaderScript.src : document.baseURI);
  var exampleBase = new URL("./", loaderUrl);
  var projectBase = new URL("../", loaderUrl);
  var assetVersion = loaderUrl.searchParams.get("v");
  var mount = document.querySelector("[data-reelcalc-comparison]");
  var canonicalUrl = "https://www.reelcalc.com/reel-comparison";

  function ensureCanonical() {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }

  if (!mount || mount.dataset.reelcalcLoaded === "true") return;
  ensureCanonical();
  mount.dataset.reelcalcLoaded = "true";
  mount.innerHTML = `
    <div class="rc-compare" id="reel-comparison">
      <header class="rc-page-header">
        <p class="rc-kicker"><strong>ReelCalc</strong> Comparison Tool</p>
        <h1>Compare Fishing Reels</h1>
        <p>See published specifications, line capacities, and practical line guidance for two exact reels.</p>
      </header>

      <section class="rc-selector-band" aria-labelledby="compare-heading">
        <h2 id="compare-heading" class="rc-visually-hidden">Choose two reels</h2>
        <div class="rc-selector-grid">
          <div class="rc-selector-field">
            <label for="reel-a-input">First reel</label>
            <div class="rc-reel-combobox">
              <input id="reel-a-input" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="reel-a-options" autocomplete="off" placeholder="Search brand, model, or size">
              <button class="rc-reel-menu-toggle" id="reel-a-toggle" type="button" aria-label="Open first reel list" title="Open reel list">&#9662;</button>
              <div class="rc-reel-options" id="reel-a-options" role="listbox" hidden></div>
            </div>
            <p id="reel-a-selection" class="rc-selection-note"></p>
          </div>

          <button class="rc-swap-button" id="swap-reels" type="button" aria-label="Swap selected reels" title="Swap selected reels" disabled>&#8644;</button>

          <div class="rc-selector-field">
            <label for="reel-b-input">Second reel</label>
            <div class="rc-reel-combobox">
              <input id="reel-b-input" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="reel-b-options" autocomplete="off" placeholder="Search brand, model, or size">
              <button class="rc-reel-menu-toggle" id="reel-b-toggle" type="button" aria-label="Open second reel list" title="Open reel list">&#9662;</button>
              <div class="rc-reel-options" id="reel-b-options" role="listbox" hidden></div>
            </div>
            <p id="reel-b-selection" class="rc-selection-note"></p>
          </div>
        </div>

        <div class="rc-selector-actions">
          <button class="rc-reset-button" id="reset-comparison" type="button" disabled>Clear comparison</button>
          <button class="rc-copy-button" id="copy-comparison" type="button" disabled>Copy comparison link</button>
        </div>
      </section>

      <div class="rc-status" id="comparison-status" role="status" aria-live="polite">Loading verified reel data...</div>

      <main id="comparison-results" hidden>
        <section class="rc-section rc-overview" aria-labelledby="overview-heading">
          <h2 id="overview-heading">Reels at a Glance</h2>
          <div class="rc-reel-headings">
            <article class="rc-reel-heading" id="reel-a-heading"></article>
            <article class="rc-reel-heading" id="reel-b-heading"></article>
          </div>
        </section>

        <section class="rc-section" aria-labelledby="differences-heading">
          <h2 id="differences-heading">Quick Differences</h2>
          <div class="rc-difference-grid" id="quick-differences"></div>
        </section>

        <section class="rc-section" aria-labelledby="specs-heading">
          <h2 id="specs-heading">Specifications</h2>
          <div class="rc-comparison-table" id="specification-comparison"></div>
          <div class="rc-comparison-summary" id="comparison-summary" aria-live="polite"></div>
        </section>

        <section class="rc-section" aria-labelledby="capacity-heading">
          <h2 id="capacity-heading">Published Line Capacity</h2>
          <p class="rc-section-intro">These are the capacity ratings published for each exact reel model.</p>
          <div class="rc-comparison-table" id="capacity-comparison"></div>
        </section>

        <section class="rc-section rc-line-fit-section" aria-labelledby="line-fit-heading">
          <h2 id="line-fit-heading">Compare Line Fit</h2>
          <p class="rc-section-intro">Choose the same actual line setup for both reels to compare capacity, backing, and estimated handle turns.</p>

          <div class="rc-backing-mode">
            <div>
              <span class="rc-control-label">Backing</span>
              <p id="backing-mode-note">Compare a chosen main-line amount with backing underneath it.</p>
            </div>
            <div class="rc-mode-switch" role="group" aria-label="Use backing">
              <button type="button" class="rc-mode-button" data-backing-mode="off">No backing</button>
              <button type="button" class="rc-mode-button is-active" data-backing-mode="on">Use backing</button>
            </div>
          </div>

          <div class="rc-line-fit-controls">
            <div class="rc-line-chooser" data-line-role="main">
              <h3>Main line</h3>
              <div class="rc-material-tabs" role="group" aria-label="Main line type">
                <button type="button" class="rc-material-button" data-line-role="main" data-material="Monofilament">Mono</button>
                <button type="button" class="rc-material-button" data-line-role="main" data-material="Fluorocarbon">Fluorocarbon</button>
                <button type="button" class="rc-material-button" data-line-role="main" data-material="Copolymer">Copolymer</button>
                <button type="button" class="rc-material-button is-active" data-line-role="main" data-material="Braid">Braid</button>
              </div>

              <label for="main-line-product">Brand / line</label>
              <input id="main-line-product" list="main-line-products" type="search" autocomplete="off" placeholder="Search line brand or model">
              <datalist id="main-line-products"></datalist>

              <label for="main-line-strength">Strength</label>
              <select id="main-line-strength"></select>
              <p class="rc-line-detail" id="main-line-detail"></p>
            </div>

            <div class="rc-line-amount">
              <label for="main-line-yards">Main line amount</label>
              <div class="rc-number-field">
                <input id="main-line-yards" type="number" inputmode="decimal" min="1" step="1" value="100">
                <span>yards</span>
              </div>
              <p>ReelCalc will compare the backing needed underneath this amount.</p>
            </div>

            <div class="rc-line-chooser" data-line-role="backing">
              <h3>Backing line</h3>
              <div class="rc-material-tabs rc-backing-materials" role="group" aria-label="Backing line type">
                <button type="button" class="rc-material-button is-active" data-line-role="backing" data-material="Monofilament">Mono</button>
                <button type="button" class="rc-material-button" data-line-role="backing" data-material="Braid">Braid</button>
              </div>

              <label for="backing-line-product">Brand / line</label>
              <input id="backing-line-product" list="backing-line-products" type="search" autocomplete="off" placeholder="Search line brand or model">
              <datalist id="backing-line-products"></datalist>

              <label for="backing-line-strength">Strength</label>
              <select id="backing-line-strength"></select>
              <p class="rc-line-detail" id="backing-line-detail"></p>
            </div>
          </div>

          <div class="rc-line-fit-summary" id="line-fit-summary" aria-live="polite"></div>
          <div class="rc-comparison-table" id="line-fit-comparison"></div>
        </section>

        <section class="rc-section" aria-labelledby="setup-heading">
          <h2 id="setup-heading">ReelCalc Line Guidance</h2>
          <div class="rc-comparison-table" id="setup-comparison"></div>
        </section>

        <section class="rc-section rc-source-section" aria-labelledby="sources-heading">
          <h2 id="sources-heading">Full Guides and Current Prices</h2>
          <div class="rc-source-grid" id="source-links"></div>
        </section>
      </main>
    </div>`;

  function loadStyle(url) {
    var existing = document.querySelector('link[data-reelcalc-comparison-style]');
    if (existing) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.reelcalcComparisonStyle = "true";
    document.head.appendChild(link);
  }

  function versionedUrl(url) {
    var value = new URL(url);
    if (assetVersion) value.searchParams.set("v", assetVersion);
    return value.href;
  }

  function loadScript(url, globalName, marker) {
    if (globalName && window[globalName]) return Promise.resolve();
    var existing = document.querySelector('script[data-reelcalc-script="' + marker + '"]');
    if (existing) {
      return new Promise(function(resolve, reject) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }
    return new Promise(function(resolve, reject) {
      var script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.dataset.reelcalcScript = marker;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });
  }

  loadStyle(versionedUrl(new URL("reel-comparison.css", exampleBase)));
  loadScript(versionedUrl(new URL("js/calculator-core.js", projectBase)), "ReelCalcCore", "calculator-core")
    .then(function() {
      return loadScript(versionedUrl(new URL("js/line-selector.js", projectBase)), "ReelCalcLineSelector", "line-selector");
    })
    .then(function() {
      return loadScript(versionedUrl(new URL("js/comparison-data.js", projectBase)), "ReelCalcComparisonData", "comparison-data");
    })
    .then(function() {
      return loadScript(versionedUrl(new URL("js/analytics.js", projectBase)), "ReelCalcAnalytics", "analytics").catch(function() {
        return undefined;
      });
    })
    .then(function() {
      return loadScript(versionedUrl(new URL("reel-comparison.js", exampleBase)), "", "reel-comparison");
    })
    .catch(function() {
      var status = mount.querySelector("#comparison-status");
      if (status) {
        status.textContent = "The comparison tool could not load. Refresh the page and try again.";
        status.classList.add("is-error");
      }
    });
})();
