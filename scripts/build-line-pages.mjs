import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGoldLinePage } from "./line-page-gold-template.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "data", "line-page-products.json"), "utf8"));
const lines = JSON.parse(fs.readFileSync(path.join(root, "data", "lines.json"), "utf8"));
const outputDirectory = path.join(root, "examples", "line-pages");

fs.mkdirSync(outputDirectory, { recursive: true });

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function productLines(product) {
  const excluded = new Set(product.excludedLineIds || []);
  return lines.filter((line) =>
    line.brand === product.brand &&
    line.model === product.model &&
    line.type === product.lineType &&
    !excluded.has(line.id) &&
    Number(line.lb) > 0 &&
    Number(line.dia_in) > 0
  ).sort((a, b) => Number(a.lb) - Number(b.lb));
}

function formatNumber(value, digits) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function chartRows(records) {
  return records.map((line) => {
    const spoolSizes = Array.isArray(line.spool_sizes_yd) ? line.spool_sizes_yd.join(", ") : "Not verified";
    return `<tr>
      <td><strong>${escapeHtml(line.lb)} lb</strong></td>
      <td class="rc-number">${formatNumber(line.dia_in, 3)} in</td>
      <td class="rc-number">${formatNumber(line.dia_mm, 3)} mm</td>
      <td>${escapeHtml(spoolSizes)} yd</td>
    </tr>`;
  }).join("\n");
}

function sourceItems(product) {
  return product.sources.map((source) => `<li>
    <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.label)}</a>
    <small>${escapeHtml(source.note)}</small>
  </li>`).join("\n");
}

function facts(product) {
  return product.manufacturerFacts.map((fact) => `<li>
    <strong>${escapeHtml(fact.label)}</strong>
    ${escapeHtml(fact.text)}
  </li>`).join("\n");
}

function guidance(product) {
  return product.productGuidance.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
}

function faqs(product) {
  return product.faqs.map((faq) => `<details>
    <summary>${escapeHtml(faq.question)}</summary>
    <p>${escapeHtml(faq.answer)}</p>
  </details>`).join("\n");
}

function jsonLd(product) {
  const pageUrl = `https://www.reelcalc.com/lines/${product.slug}`;
  const graph = [
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: product.seoTitle,
      description: product.metaDescription,
      isPartOf: { "@id": "https://www.reelcalc.com/#website" }
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.reelcalc.com/" },
        { "@type": "ListItem", position: 2, name: "Fishing Line Database", item: "https://www.reelcalc.com/line-database" },
        { "@type": "ListItem", position: 3, name: `${product.brand} ${product.model}`, item: pageUrl }
      ]
    },
    {
      "@type": "Product",
      name: `${product.brand} ${product.model}`,
      image: product.imageUrl,
      description: product.quickSummary,
      category: `${product.lineType} fishing line`,
      brand: { "@type": "Brand", name: product.brand }
    },
    {
      "@type": "FAQPage",
      mainEntity: product.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer }
      }))
    }
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

function buildPage(productId, product) {
  const records = productLines(product);
  if (product.presentation === "gold") {
    for (const field of ["h1", "seoTitle", "metaDescription", "construction", "quickSummary", "suitabilityTitle", "suitabilitySummary", "chartNote", "sourceNote", "reviewNote", "localImagePath"]) {
      if (!product[field]) throw new Error(`${productId}: missing gold-page ${field}`);
    }
    for (const field of ["strengthGuide", "spoolingGuide", "sources", "faqs", "exampleSetups"]) {
      if (!Array.isArray(product[field]) || !product[field].length) throw new Error(`${productId}: missing ${field}`);
    }
    if (!records.length || !records.some(line => line.id === product.defaultLineId && line.spool_sizes_yd?.includes(product.defaultSpoolYards))) throw new Error(`${productId}: invalid default line/spool`);
    for (const line of records) {
      if (!(line.dia_mm > 0) || !line.spool_sizes_yd?.length || !line.spool_sizes_yd.every(yards => Number.isFinite(yards) && yards > 0)) throw new Error(`${productId}: incomplete verified specifications for ${line.id}`);
    }
    if (!fs.existsSync(path.join(root, product.localImagePath))) throw new Error(`${productId}: missing product image`);
  }
  if (!records.length) throw new Error(`No verified line records found for ${productId}.`);
  if (product.presentation === "gold") {
    return buildGoldLinePage(productId, product, records, { escapeHtml, jsonLd, sourceItems, faqs });
  }
  const range = `${records[0].lb}-${records.at(-1).lb} lb`;
  const commonSpools = Array.from(new Set(records.flatMap((line) => line.spool_sizes_yd || [])))
    .sort((a, b) => a - b)
    .join(", ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(product.seoTitle)}</title>
  <meta name="description" content="${escapeHtml(product.metaDescription)}">
  <link rel="canonical" href="https://www.reelcalc.com/lines/${escapeHtml(product.slug)}">
  <link rel="stylesheet" href="../../css/line-page.css">
  <script type="application/ld+json">${jsonLd(product)}</script>
</head>
<body>
  <main class="rc-line-page" data-reelcalc-line-page data-product-id="${escapeHtml(productId)}" data-asset-base="../../">
    <header class="rc-line-hero">
      <div class="rc-line-inner">
        <nav class="rc-breadcrumbs" aria-label="Breadcrumb">
          <a href="https://www.reelcalc.com/">ReelCalc</a> / <a href="https://www.reelcalc.com/line-database">Line Database</a> / ${escapeHtml(product.brand)} ${escapeHtml(product.model)}
        </nav>
        <div class="rc-hero-grid">
          <div>
            <span class="rc-eyebrow">${escapeHtml(product.eyebrow)}</span>
            <h1>${escapeHtml(product.h1)}</h1>
            <p class="rc-hero-summary">${escapeHtml(product.quickSummary)}</p>
            <div class="rc-quick-facts" aria-label="Product quick facts">
              <div class="rc-quick-fact"><span>Line type</span><strong>${escapeHtml(product.lineType)}</strong></div>
              <div class="rc-quick-fact"><span>Verified strengths</span><strong>${escapeHtml(range)}</strong></div>
              <div class="rc-quick-fact"><span>Offered spools</span><strong>${escapeHtml(commonSpools)} yd</strong></div>
            </div>
          </div>
          <figure class="rc-product-figure">
            <img src="../../${escapeHtml(product.localImagePath)}" alt="${escapeHtml(product.imageAlt)}" width="520" height="420" loading="eager">
            <figcaption>Official product image. Package design can change.</figcaption>
          </figure>
        </div>
      </div>
    </header>

    <section class="rc-section rc-section-white" aria-labelledby="quick-answer-title">
      <div class="rc-line-inner">
        <div class="rc-section-heading">
          <span class="rc-eyebrow">Quick answer</span>
          <h2 id="quick-answer-title">Where this line fits</h2>
        </div>
        <ul class="rc-fact-list">
          <li><strong>Best fit</strong>${escapeHtml(product.bestFit)}</li>
          <li><strong>Important tradeoff</strong>${escapeHtml(product.tradeoff)}</li>
          <li><strong>ReelCalc note</strong>${escapeHtml(product.reelcalcNote)}</li>
        </ul>
      </div>
    </section>

    <section class="rc-section rc-section-blue" id="use-this-line" aria-labelledby="line-tool-title">
      <div class="rc-line-inner">
        <div class="rc-tool-shell">
          <div class="rc-tool-intro">
            <div>
              <span class="rc-eyebrow">ReelCalc setup tool</span>
              <h2 id="line-tool-title">Use This Line on Your Reel</h2>
              <p>Choose an exact strength, reel, and retail spool. ReelCalc will estimate capacity, a practical working fill, and backing through the same calculation engine used elsewhere on ReelCalc.</p>
            </div>
            <span class="rc-tool-status" id="rcToolStatus">Loading verified data</span>
          </div>

          <div class="rc-loading" id="rcLoading">Loading ReelCalc reel and line data...</div>
          <div class="rc-js-only" id="rcInteractive" hidden>
            <div class="rc-control-grid">
              <fieldset class="rc-control-step">
                <legend><span class="rc-step-number">1</span>Choose strength</legend>
                <label class="rc-field">
                  <span>Pound test</span>
                  <select id="rcStrength"></select>
                </label>
                <label class="rc-field">
                  <span>Retail spool length</span>
                  <select id="rcSpool"></select>
                </label>
                <div class="rc-selected-line" id="rcSelectedLine" aria-live="polite"></div>
              </fieldset>

              <fieldset class="rc-control-step">
                <legend><span class="rc-step-number">2</span>Choose exact reel</legend>
                <span class="rc-field-label">Reel type</span>
                <div class="rc-segmented" id="rcReelType">
                  <button type="button" data-reel-type="spinning" aria-pressed="true">Spinning</button>
                  <button type="button" data-reel-type="baitcasting" aria-pressed="false">Baitcasting</button>
                </div>
                <label class="rc-field"><span>Brand</span><select id="rcReelBrand"></select></label>
                <label class="rc-field"><span>Series</span><select id="rcReelModel" disabled></select></label>
                <label class="rc-field"><span>Exact size</span><select id="rcReelSize" disabled></select></label>
              </fieldset>

              <fieldset class="rc-control-step">
                <legend><span class="rc-step-number">3</span>Plan the fill</legend>
                <label class="rc-field">
                  <span>Working main-line amount (yards)</span>
                  <input id="rcWorkingYards" type="number" min="1" max="10000" step="1" inputmode="decimal">
                </label>
                <div class="rc-backing-mode-row">
                  <button type="button" class="rc-button rc-button-secondary rc-backing-mode-button" id="rcBackingModeButton" aria-pressed="false">I don't want to use backing</button>
                  <span class="rc-backing-mode-status" id="rcBackingModeStatus" hidden>Capacity-only mode is on.</span>
                </div>
                <div id="rcBackingControls">
                  <label class="rc-field">
                    <span>Backing brand</span>
                    <select id="rcBackingBrand"></select>
                  </label>
                  <div class="rc-inline-fields">
                    <label class="rc-field"><span>Backing model</span><select id="rcBackingModel" disabled></select></label>
                    <label class="rc-field"><span>Strength</span><select id="rcBackingLb" disabled></select></label>
                  </div>
                </div>
                <p class="rc-control-help">Use the full estimated capacity for a full-mainline fill, or choose a shorter working amount to calculate backing underneath it.</p>
              </fieldset>
            </div>

            <div class="rc-tool-action">
              <button type="button" class="rc-button rc-button-primary" id="rcCalculate">Calculate This Setup</button>
              <span class="rc-control-help" id="rcCalculationHelp">Choose an exact reel to continue.</span>
            </div>

            <div class="rc-results" id="rcResults" aria-live="polite" hidden></div>
          </div>

          <noscript>
            <div class="rc-error">The interactive reel calculation requires JavaScript. The verified chart and setup guidance below remain available.</div>
          </noscript>
        </div>
      </div>
    </section>

    <section class="rc-section rc-section-white" aria-labelledby="diameter-intelligence-title">
      <div class="rc-line-inner">
        <div class="rc-section-heading">
          <span class="rc-eyebrow">Database comparison</span>
          <h2 id="diameter-intelligence-title">How Does This Diameter Compare?</h2>
          <p>ReelCalc compares the selected strength with other lines in the same broad category and then finds nearby physical diameters across the line database.</p>
        </div>
        <div class="rc-intelligence-grid">
          <div class="rc-intelligence-summary" id="rcDiameterSummary" aria-live="polite">
            <h3>Diameter position</h3>
            <p>Select a strength above to compare its physical diameter.</p>
          </div>
          <div>
            <h3>Lines Closest in Diameter</h3>
            <div class="rc-table-wrap">
              <table class="rc-table">
                <thead><tr><th>Line</th><th class="rc-number">Strength</th><th class="rc-number">Diameter</th><th class="rc-number">Difference</th></tr></thead>
                <tbody id="rcAlternatives"><tr><td colspan="4">Loading line database...</td></tr></tbody>
              </table>
            </div>
            <p class="rc-table-note">Similar diameter suggests similar spool volume, not identical strength, handling, abrasion resistance, or knot performance.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="rc-section rc-section-blue" aria-labelledby="switch-title">
      <div class="rc-line-inner">
        <div class="rc-two-column">
          <div class="rc-switch-tool">
            <span class="rc-eyebrow">Physical comparison</span>
            <h3 id="switch-title">Switching From This Line?</h3>
            <p>Choose another catalog line and see whether the reel is likely to hold more or less.</p>
            <label class="rc-field"><span>Replacement line</span><select id="rcReplacement"></select></label>
            <div class="rc-switch-result" id="rcSwitchResult" aria-live="polite">Select a replacement line to compare.</div>
            <a class="rc-button rc-button-secondary" id="rcReplacementWizard" href="https://www.reelcalc.com/reelcalc-wizard" hidden>Recalculate With This Line</a>
          </div>
          <div class="rc-recommend-tool">
            <span class="rc-eyebrow">Starting range</span>
            <h3>What Pound Test Should I Consider?</h3>
            <p>${escapeHtml(product.recommendationIntro)}</p>
            <div class="rc-recommend-grid">
              <label class="rc-field"><span>Fishing type</span><select id="rcFishingType"><option value="trout">Trout / panfish</option><option value="bass" selected>Bass</option><option value="walleye">Walleye</option><option value="inshore">Inshore saltwater</option><option value="surf">Surf / heavy saltwater</option><option value="freshwater">General freshwater</option></select></label>
              <label class="rc-field"><span>Priority</span><select id="rcPriority"><option value="all-around" selected>All-around</option><option value="distance">Casting distance</option><option value="sensitivity">Sensitivity</option><option value="simplicity">Simplicity</option><option value="abrasion">Abrasion resistance</option></select></label>
            </div>
            <div class="rc-recommend-result" id="rcRecommendation" aria-live="polite">Choose a reel above for a size-aware starting range.</div>
          </div>
        </div>
      </div>
    </section>

    <section class="rc-section rc-section-white" aria-labelledby="setup-choice-title">
      <div class="rc-line-inner">
        <div class="rc-section-heading"><span class="rc-eyebrow">Rigging choice</span><h2 id="setup-choice-title">${escapeHtml(product.setupComparison.title)}</h2></div>
        <div class="rc-two-column">
          <div class="rc-comparison-column"><h3>${escapeHtml(product.setupComparison.leftTitle)}</h3><p>${escapeHtml(product.setupComparison.leftText)}</p></div>
          <div class="rc-comparison-column"><h3>${escapeHtml(product.setupComparison.rightTitle)}</h3><p>${escapeHtml(product.setupComparison.rightText)}</p></div>
        </div>
      </div>
    </section>

    <section class="rc-section rc-section-green" aria-labelledby="planning-title">
      <div class="rc-line-inner">
        <div class="rc-section-heading"><span class="rc-eyebrow">Practical setup notes</span><h2 id="planning-title">${escapeHtml(product.productGuidanceTitle)}</h2></div>
        <ul class="rc-guidance-list">${guidance(product)}</ul>
      </div>
    </section>

    <section class="rc-section rc-section-white" aria-labelledby="examples-title">
      <div class="rc-line-inner">
        <div class="rc-section-heading"><span class="rc-eyebrow">Calculated examples</span><h2 id="examples-title">Example Reel Setups</h2><p>These examples use real reel records and the production ReelCalc engine. They are starting plans, not universal prescriptions.</p></div>
        <div class="rc-example-grid" id="rcExamples" aria-live="polite"><p>Loading calculated examples...</p></div>
      </div>
    </section>

    <section class="rc-section rc-section-blue" aria-labelledby="diameter-chart-title">
      <div class="rc-line-inner">
        <div class="rc-section-heading"><span class="rc-eyebrow">Verified specifications</span><h2 id="diameter-chart-title">${escapeHtml(product.brand)} ${escapeHtml(product.model)} Diameter Chart</h2><p>Strength-specific spool lengths reflect verified offered configurations, not a promise of current stock at any retailer.</p></div>
        <div class="rc-table-wrap rc-static-chart">
          <table class="rc-table">
            <thead><tr><th>Strength</th><th class="rc-number">Diameter (in)</th><th class="rc-number">Diameter (mm)</th><th>Verified spool lengths</th></tr></thead>
            <tbody>${chartRows(records)}</tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="rc-section rc-section-white" aria-labelledby="facts-title">
      <div class="rc-line-inner">
        <div class="rc-section-heading"><span class="rc-eyebrow">What is verified</span><h2 id="facts-title">Product Facts and Source Boundaries</h2><p>Specifications, manufacturer claims, and ReelCalc-derived estimates are labeled separately so the page does not turn marketing copy into measured fact.</p></div>
        <ul class="rc-fact-list">${facts(product)}</ul>
        <h3>Sources</h3>
        <ul class="rc-source-list">${sourceItems(product)}</ul>
      </div>
    </section>

    <section class="rc-section rc-section-green" aria-labelledby="faq-title">
      <div class="rc-line-inner">
        <div class="rc-section-heading"><span class="rc-eyebrow">Product-specific answers</span><h2 id="faq-title">Frequently Asked Questions</h2></div>
        <div class="rc-faq-list">${faqs(product)}</div>
      </div>
    </section>

    <section class="rc-section rc-section-white" aria-labelledby="next-tools-title">
      <div class="rc-line-inner">
        <div class="rc-section-heading"><span class="rc-eyebrow">Continue with ReelCalc</span><h2 id="next-tools-title">Useful Next Steps</h2></div>
        <ul class="rc-internal-links">
          <li><a href="https://www.reelcalc.com/reelcalc-wizard" data-internal-destination="setup_wizard">Open the Reel Setup Wizard</a></li>
          <li><a href="https://www.reelcalc.com/" data-internal-destination="capacity_calculator">Reel Capacity Calculator</a></li>
          <li><a href="https://www.reelcalc.com/line-database" data-internal-destination="line_database">Fishing Line Database</a></li>
          <li><a href="https://www.reelcalc.com/reel-comparison" data-internal-destination="reel_comparison">Compare Fishing Reels</a></li>
          <li><a href="https://www.reelcalc.com/pe-line-calculator" data-internal-destination="pe_calculator">PE Line Calculator</a></li>
          <li><a href="https://www.reelcalc.com/blog/what-size-mono-backing-should-i-use-for-braid" data-internal-destination="backing_guide">Backing Size Guide</a></li>
        </ul>
      </div>
    </section>
  </main>

  <script src="../../js/calculator-core.js" defer></script>
  <script src="../../js/recommendation-engine.js" defer></script>
  <script src="../../js/affiliate-links.js" defer></script>
  <script src="../../js/analytics.js" defer></script>
  <script src="../../js/line-page-engine.js" defer></script>
</body>
</html>`;
}

for (const [productId, product] of Object.entries(config.products)) {
  if (process.argv[2] && process.argv[2] !== productId) continue;
  const outputPath = path.join(outputDirectory, `${productId}.html`);
  fs.writeFileSync(outputPath, `${buildPage(productId, product)}\n`);
  console.log(`Built ${path.relative(root, outputPath)}`);
}
