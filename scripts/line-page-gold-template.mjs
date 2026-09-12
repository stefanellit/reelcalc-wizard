export function buildGoldLinePage(productId, product, records, helpers) {
  const { escapeHtml: e, jsonLd, sourceItems, faqs } = helpers;
  const name = `${product.brand} ${product.model}`;
  const shortName = product.shortName || product.brand;
  const braidPage = /braid/i.test(product.lineType);
  const chart = records.map(line => `<tr data-chart-line="${e(line.id)}">
    <th scope="row"><button type="button" class="rc-chart-pick" data-select-line="${e(line.id)}" aria-label="Use ${e(name)} ${e(line.lb)} lb" aria-pressed="false" disabled>${e(line.lb)} lb</button></th>
    <td>${Number(line.dia_in).toFixed(3)}</td><td>${Number(line.dia_mm).toFixed(3)}</td>
    <td>${e((line.spool_sizes_yd || []).join(", "))}</td>
  </tr>`).join("\n");
  const notes = product.spoolingGuide.map(item => `<div><h3>${e(item.title)}</h3><p>${e(item.text)}</p>${item.url ? `<a href="${e(item.url)}" data-internal-destination="spooling_guide">${e(item.linkText)}</a>` : ""}</div>`).join("\n");
  const strengthGuide = product.strengthGuide.map(text => `<p>${e(text)}</p>`).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(product.seoTitle)}</title>
  <meta name="description" content="${e(product.metaDescription)}">
  <link rel="canonical" href="https://www.reelcalc.com/lines/p/${e(product.slug)}">
  <link rel="stylesheet" href="../../css/line-page.css">
  <link rel="stylesheet" href="../../css/line-page-gold.css">
  <script type="application/ld+json">${jsonLd(product)}</script>
</head>
<body>
<main class="rc-line-page rc-line-gold" data-reelcalc-line-page data-product-id="${e(productId)}" data-asset-base="../../">
  <header class="rc-product-header">
    <div class="rc-line-inner">
      <nav class="rc-breadcrumbs" aria-label="Breadcrumb"><a href="https://www.reelcalc.com/">ReelCalc</a><span>/</span><a href="https://www.reelcalc.com/line-database">Line guides</a><span>/</span>${e(name)}</nav>
      <h1>${e(product.h1)}</h1>
      <p class="rc-product-subtitle">Diameter chart, reel capacity &amp; backing guide</p>
      <div class="rc-product-overview">
        <figure class="rc-product-figure"><img src="../../${e(product.localImagePath)}" alt="${e(product.imageAlt)}" width="160" height="160" loading="eager"></figure>
        <div><p class="rc-product-summary">${e(product.quickSummary)}</p><dl class="rc-product-specs"><div><dt>Construction</dt><dd>${e(product.construction)}</dd></div><div><dt>Listed strengths</dt><dd>${e(records[0].lb)}-${e(records.at(-1).lb)} lb</dd></div><div><dt>Line type</dt><dd>${e(product.lineType)} main line</dd></div></dl></div>
      </div>
      <section class="rc-product-fit" aria-labelledby="product-fit-title"><h2 id="product-fit-title">${e(product.suitabilityTitle)}</h2><p>${e(product.suitabilitySummary)}</p></section>
      <nav class="rc-page-nav" aria-label="On this page"><a href="#use-this-line">Calculator</a><a href="#diameter-chart">Diameter chart</a><a href="#line-guide">Choosing your setup</a><a href="#compare-lines">Compare lines</a></nav>
    </div>
  </header>

  <section class="rc-section rc-calculator-section" id="use-this-line" aria-labelledby="line-tool-title">
    <div class="rc-line-inner">
      <div class="rc-section-heading rc-tool-heading"><div><span class="rc-eyebrow">Your line. Your reel.</span><h2 id="line-tool-title">How much ${e(shortName)} will fit?</h2></div><span class="rc-tool-status" id="rcToolStatus" role="status">Loading line data</span></div>
      <div class="rc-tool-shell">
        <div class="rc-loading" id="rcLoading" role="status">Loading reel and line data...</div>
        <div id="rcInteractive" hidden>
          <div class="rc-control-grid">
            <fieldset class="rc-control-step"><legend><span class="rc-step-number">1</span>Your line</legend>
              <label class="rc-field"><span>${e(name)} strength</span><select id="rcStrength"></select></label>
              <div class="rc-selected-line" id="rcSelectedLine" aria-live="polite"></div>
              <label class="rc-field"><span>Retail spool length</span><select id="rcSpool"></select></label>
              <a class="rc-inline-link" href="#diameter-chart">Full diameter chart</a>
            </fieldset>
            <fieldset class="rc-control-step"><legend><span class="rc-step-number">2</span>Your reel</legend>
              <div class="rc-segmented" id="rcReelSource" role="group" aria-label="Reel details"><button type="button" data-reel-source="database" aria-pressed="true">Find my reel</button><button type="button" data-reel-source="manual" aria-pressed="false">Enter specs</button></div>
              <div id="rcCatalogReel">
              <div class="rc-segmented" id="rcReelType" role="group" aria-label="Reel type"><button type="button" data-reel-type="spinning" aria-pressed="true">Spinning</button><button type="button" data-reel-type="baitcasting" aria-pressed="false">Baitcasting</button></div>
              <label class="rc-field"><span>Brand</span><select id="rcReelBrand"></select></label>
              <label class="rc-field"><span>Series</span><select id="rcReelModel" disabled></select></label>
              <label class="rc-field"><span>Exact model / size</span><select id="rcReelSize" disabled></select></label>
              </div>
              <div id="rcManualReel" hidden>
                <p class="rc-manual-guide">${braidPage ? "Reel not listed? Use its braid capacity rating if available. Otherwise, use its mono rating." : "Reel not listed? Use its mono capacity rating for this " + (/fluoro/i.test(product.lineType) ? "fluorocarbon" : "mono") + " line."}</p>
                <label class="rc-field"${braidPage ? "" : " hidden"}><span>Rating on the reel</span><select id="rcManualType">${braidPage ? '<option value="braid">Braid rating</option>' : ""}<option value="mono">Mono rating</option></select></label>
                <label class="rc-field"><span>Rated strength (lb)</span><input id="rcManualStrength" type="number" min="0.1" max="1000" step="any" inputmode="decimal" placeholder="${braidPage ? "15" : "10"}" aria-describedby="rcManualHelp rcManualError"></label>
                <div class="rc-unit-fields"><label class="rc-field"><span>Rated capacity</span><input id="rcManualCapacity" type="number" min="0.1" max="100000" step="any" inputmode="decimal" placeholder="200" aria-describedby="rcManualError"></label><label class="rc-field"><span>Unit</span><select id="rcManualCapacityUnit" aria-label="Rated capacity unit"><option value="yd">Yards</option><option value="m">Meters</option></select></label></div>
                <div class="rc-unit-fields"><label class="rc-field"><span>Printed diameter (optional)</span><input id="rcManualDiameter" type="number" min="0" step="any" inputmode="decimal" aria-describedby="rcManualHelp rcManualError"></label><label class="rc-field"><span>Unit</span><select id="rcManualDiameterUnit" aria-label="Printed diameter unit"><option value="mm">mm</option><option value="in">in</option></select></label></div>
                <p class="rc-manual-guide" id="rcManualHelp">Use one matching capacity entry from the reel. If it lists a diameter for that entry, enter it instead of, or alongside, the lb test.</p>
                <p class="rc-manual-guide" id="rcManualError" role="status"></p>
              </div>
            </fieldset>
            <fieldset class="rc-control-step"><legend><span class="rc-step-number">3</span>Your spool plan</legend>
              <label class="rc-field"><span id="rcWorkingYardsLabel">Main line to put on the reel (yards)</span><input id="rcWorkingYards" type="number" min="0.1" max="10000" step="any" inputmode="decimal" aria-describedby="rcFullSpoolHelp"></label>
              <p id="rcFullSpoolHelp" class="rc-manual-guide" hidden></p>
              <div class="rc-backing-mode-row"><button type="button" class="rc-button rc-button-secondary rc-backing-mode-button" id="rcBackingModeButton" aria-pressed="false" aria-controls="rcBackingControls">I don't want to use backing</button><span id="rcBackingModeStatus" class="rc-backing-mode-status" hidden>Full-spool capacity</span></div>
              <div id="rcBackingControls"><label class="rc-field"><span>Backing brand</span><select id="rcBackingBrand"></select></label><div class="rc-inline-fields"><label class="rc-field"><span>Backing model</span><select id="rcBackingModel" disabled></select></label><label class="rc-field"><span>Backing strength</span><select id="rcBackingLb" disabled></select></label></div></div>
            </fieldset>
          </div>
          <div class="rc-tool-action"><button type="button" class="rc-button rc-button-primary" id="rcCalculate">Calculate my setup</button><span id="rcCalculationHelp" role="status">Choose an exact reel to continue.</span></div>
          <div class="rc-results" id="rcResults" aria-live="polite" hidden></div>
        </div>
        <noscript><p class="rc-error">The calculator needs JavaScript. The diameter chart and line guide below are still available.</p></noscript>
      </div>
      <p class="rc-tool-footnote">Calculated estimates, not measured fills. Stop at the reel manufacturer's fill level even if some line remains.</p>
    </div>
  </section>

  <section class="rc-section" id="diameter-chart" aria-labelledby="diameter-chart-title"><div class="rc-line-inner">
    <div class="rc-section-heading"><span class="rc-eyebrow">The numbers behind the setup</span><h2 id="diameter-chart-title">${e(name)} diameter chart</h2><p>${e(product.chartNote)}</p></div>
    <div class="rc-table-wrap rc-static-chart"><table class="rc-table rc-diameter-chart"><caption>Listed diameters and offered spool lengths. Retail stock varies.</caption><thead><tr><th scope="col">Strength</th><th scope="col">Inches</th><th scope="col">mm</th><th scope="col">Spools (yd)</th></tr></thead><tbody>${chart}</tbody></table></div>
  </div></section>

  <section class="rc-section rc-guide-section" id="line-guide" aria-labelledby="guide-title"><div class="rc-line-inner">
    <div class="rc-section-heading"><span class="rc-eyebrow">Choosing your setup</span><h2 id="guide-title">Choosing a ${e(shortName)} strength</h2></div>
    <div class="rc-strength-guide"><div class="rc-editorial-copy">${strengthGuide}<p class="rc-editorial-note">${e(product.reviewNote)}</p></div><div class="rc-strength-next"><h3>Want a guided recommendation?</h3><a class="rc-inline-link" id="rcStrengthWizard" href="https://www.reelcalc.com/reelcalc-wizard">Continue in the Setup Wizard</a></div></div>
  </div></section>

  <section class="rc-section" id="compare-lines" aria-labelledby="diameter-intelligence-title"><div class="rc-line-inner">
    <div class="rc-section-heading"><span class="rc-eyebrow">Compare actual diameters</span><h2 id="diameter-intelligence-title">Same pound test, different diameters</h2></div>
    <div class="rc-intelligence-grid"><div id="rcDiameterSummary" class="rc-intelligence-summary" aria-live="polite"><h3>At your selected strength</h3><p>Loading diameter comparisons...</p></div><div class="rc-switch-tool"><h3>What changes with another line?</h3><label class="rc-field"><span>Compare with</span><select id="rcReplacement"></select></label><div class="rc-switch-result" id="rcSwitchResult" aria-live="polite">Select a replacement line to compare.</div><a class="rc-inline-link" id="rcReplacementWizard" href="https://www.reelcalc.com/reelcalc-wizard" hidden>Use this alternative in the Wizard</a></div></div>
    <h3 class="rc-alternatives-title">Nearby diameters in the line database</h3><div class="rc-table-wrap"><table class="rc-table rc-alternatives-table"><thead><tr><th scope="col">Line</th><th scope="col">Strength</th><th scope="col">Inches</th><th scope="col">Difference</th></tr></thead><tbody id="rcAlternatives"><tr><td colspan="4">Loading line database...</td></tr></tbody></table></div>
  </div></section>

  <section class="rc-section rc-guide-section" aria-labelledby="spooling-title"><div class="rc-line-inner"><div class="rc-section-heading"><span class="rc-eyebrow">At the spooling bench</span><h2 id="spooling-title">Backing, working line &amp; leaders</h2></div><div class="rc-spooling-grid">${notes}</div></div></section>

  <section class="rc-section" aria-labelledby="examples-title"><div class="rc-line-inner"><div class="rc-section-heading"><span class="rc-eyebrow">Calculated examples</span><h2 id="examples-title">How Much Fits on These Reels?</h2><p>Estimated full-spool capacity for the ${e(shortName)} strength selected above, with no backing. These are calculated examples, not physical tests or recommendations for every pairing.</p></div><div id="rcExamples" class="rc-example-grid" data-example-mode="capacity" aria-live="polite"><p>Loading capacity estimates...</p></div></div></section>

  <section class="rc-section rc-guide-section" aria-labelledby="faq-title"><div class="rc-line-inner"><div class="rc-section-heading"><h2 id="faq-title">${e(shortName)} questions, answered</h2></div><div class="rc-faq-list">${faqs(product)}</div></div></section>

  <section class="rc-section rc-sources-section" id="sources" aria-labelledby="sources-title"><div class="rc-line-inner"><h2 id="sources-title">Specifications &amp; sources</h2><p>${e(product.sourceNote)}</p><p>Calculations use the catalog's listed inch diameters. Published inch and millimeter values may differ slightly because of rounding.</p><ul class="rc-source-list">${sourceItems(product)}</ul><p class="rc-footer-links"><a href="https://www.reelcalc.com/line-database" data-internal-destination="line_database">Browse all lines</a><a href="https://www.reelcalc.com/reel-comparison" data-internal-destination="reel_comparison">Compare reels</a><a href="#use-this-line">Back to calculator</a></p></div></section>
</main>
<script src="../../js/calculator-core.js" defer></script><script src="../../js/affiliate-links.js" defer></script><script src="../../js/analytics.js" defer></script><script src="../../js/line-page-engine.js" defer></script>
</body>
</html>`;
}
