import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const json = async (file) => JSON.parse(await read(file));
const test = await json("data/real-world-test-004.json");
const reels = await json("data/reels.json");
const lines = await json("data/lines.json");
const registry = await json("data/reel-pages.json");
const guides = await json("data/line-guide-links.json");
const reel = reels.find((row) => row.id === test.reelId);
const reelPage = registry.pages.find((row) => row.reelId === test.reelId);
if (!reel || !reelPage || reel.sku !== test.reel.modelCode) throw new Error("Exact BG LT reel match missing.");
const context = { window: {} };
vm.runInNewContext(await read("js/calculator-core.js"), context);
const core = context.window.ReelCalcCore;
const runs = test.runs.map((run) => {
  const line = lines.find((row) => row.id === run.lineId);
  if (!line) throw new Error(`Missing test line: ${run.lineId}`);
  return { ...run, line, basis: core.capacityBasisForActualLine(reel, line, lines), range: core.calculateActualLineBraidCapacityRange(reel, line, lines) };
});
const [mono, braid] = runs;
const monoReference = test.manufacturerRatings.physical.find((rating) => rating.material === "nylon" && rating.lb === 12);
const braidReference = test.manufacturerRatings.physical.find((rating) => rating.material === "braid" && rating.pe === 2);
const physicalMono = core.calculateLineCapacityFromDiameter(monoReference.printedYards, core.mmToInches(monoReference.diameterMm), core.mmToInches(mono.diameterMm));
const physicalBraid = core.calculateLineCapacityFromDiameter(core.metersToYards(braidReference.meters), core.mmToInches(braidReference.diameterMm), core.mmToInches(braid.diameterMm));
const rounded = (number, digits = 1) => Number(number.toFixed(digits));
const yards = (feet) => rounded(feet / 3);
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const assetBase = "https://stefanellit.github.io/reelcalc-wizard/";
const imagePath = "assets/real-world-tests/daiwa-bg-lt-3000d-xh/";
const canonical = `https://www.reelcalc.com${test.canonicalPath}`;
const guideUrl = (key) => guides.guides[key].url;
const monoGuide = guideUrl("berkley-trilene-xl");
const braidGuide = guideUrl("daiwa-j-braid-x4");
const reelUrl = `https://www.reelcalc.com${reelPage.path}`;
const photo = (file, alt, caption, eager = false) => `<figure class="rc-test-photo" data-test-image="${file}" data-alt="${escape(alt)}" data-width="${[test.heroPhoto, test.factoryPhotos.box].includes(file) ? 2016 : 1512}" data-height="${[test.heroPhoto, test.factoryPhotos.box].includes(file) ? 1512 : 2016}"${eager ? ' data-eager="true"' : ""}>
  <div class="rc-test-photo-media"><div class="rc-test-photo-placeholder"><strong>Test photo loading</strong></div></div>
  <figcaption>${caption} <a href="../../${imagePath}${file}" target="_blank" rel="noopener">Full-size photo</a>.</figcaption>
</figure>`;
const table = (label, headings, rows) => `<div class="rc-test-table-wrap" role="region" aria-label="${label}" tabindex="0"><table><thead><tr>${headings.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((cell, i) => i ? `<td>${cell}</td>` : `<th scope="row">${cell}</th>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const section = (id, title, body) => `<section class="rc-test-section" id="${id}"><div class="rc-test-content"><h2>${title}</h2>${body}</div></section>`;
const affiliate = (run) => `<div class="rc-test-affiliate-area" data-real-world-line-affiliate data-product-role="line" data-line-id="${run.lineId}" data-required-yards="220" data-spool-yards="300" hidden></div>`;
const preload = (base, run, hash = "calculator-setup") => `${base}?mode=capacity&amp;line=${run.lineId}&amp;lb=${run.line.lb}&amp;spool=300${hash ? `#${hash}` : ""}`;

const article = `<article class="reelcalc-real-world-test" data-test-id="${test.id}" data-test-number="4" data-reel-id="${test.reelId}" data-image-base="${imagePath}">
<header class="rc-test-section rc-test-hero"><div class="rc-test-content">
  <p class="rc-test-badge">ReelCalc Real-World Test #004</p>
  <h1>${test.title}</h1>
  <p class="rc-test-summary">The online specs said <strong>12 lb mono / 220 yards</strong> and <strong>20 lb J-Braid / 220 yards</strong>. When the reel arrived, the box and spool had much more detailed information. We put both lines on the reel to see what actually fit.</p>
  <div class="rc-test-photo-grid rc-test-photo-grid--single">${photo(test.heroPhoto, "Empty Daiwa BG LT 3000D-XH reel with its exact model marking visible", "The BG LT 3000D-XH used for both tests, starting with an empty spool.", true)}</div>
</div></header>
${section("quick-answer", "Quick Answer", `<div class="rc-test-result">
  <p class="rc-test-result-lead"><strong>Both lines looked overfilled at 220 yards.</strong> The extra details on the reel helped explain the mono result: our 12 lb line was thicker than the 12 lb line Daiwa based its rating on. We still have questions about the braid.</p>
  <div class="rc-test-metric-grid" aria-label="Key test results">
    <div class="rc-test-metric"><strong>${yards(mono.practicalFeet)} yd</strong><span>first stop with mono</span></div>
    <div class="rc-test-metric"><strong>${yards(braid.practicalFeet)} yd</strong><span>first stop with braid</span></div>
    <div class="rc-test-metric"><strong>220 yd</strong><span>both lines looked overfilled</span></div>
    <div class="rc-test-metric"><strong>No backing</strong><span>empty spool for each line</span></div>
  </div>
</div><p class="rc-test-source-note">The first stops were where the spool looked ready to fish, not the most line we could squeeze on.</p>`)}
${section("why-this-test", "First, the Online Ratings Raised a Question", `<p><a href="${test.sources.daiwa}" target="_blank" rel="noopener">Daiwa's online table</a> listed these two ratings for BGLT3000D-XH:</p>
<ul><li><strong>12/220:</strong> 220 yards of 12 lb mono.</li><li><strong>20/220:</strong> 220 yards of 20 lb J-Braid.</li></ul>
<p>That caught our attention. Mono and braid with those strength labels can be very different thicknesses. Would 220 yards of each really fit? We bought the reel to find out.</p>
<p class="rc-test-source-note">The online table says J-Braid, but does not name a particular version such as X4.</p>`)}
${section("physical-ratings", "Then the Reel Arrived: The Box and Spool Told Us More", `<p>The box and spool had much more detailed capacity information than the online listing. They included <strong>line diameter, which simply means how thick the line is</strong>.</p>
<p>Here is the important part: <strong>Daiwa's 12 lb / 220 yd mono rating uses 0.28 mm line.</strong> Our 12 lb Trilene XL is 0.33 mm. Same pound test, thicker line, less room on the spool.</p>
<p>For context, <strong>0.28 mm is very thin compared with familiar 12 lb mono sold in the U.S.</strong> Besides our 0.33 mm Trilene XL, <a href="${test.sources.sufixElite}" target="_blank" rel="noopener">Sufix Elite 12 lb</a> is about 0.36 mm (0.014 in). Thinner options exist, so always check the diameter rather than going by pound test alone.</p>
<div class="rc-test-photo-grid rc-test-photo-grid--single">${photo(test.factoryPhotos.box, "Daiwa BG LT3000D-XH box showing nylon and braid capacity ratings with line diameters", "The box adds the line thickness behind each rating, plus several more line sizes.")}</div>
<div class="rc-test-photo-grid rc-test-photo-grid--single">${photo(test.factoryPhotos.spool, "Empty spool showing 12 lb nylon at 0.28 mm and 220 yards, 16 lb nylon at 0.33 mm and 160 yards, and 0.18 mm braid at 300 meters", "The empty spool confirms the key mono detail: 0.28 mm line at 220 yards, or thicker 0.33 mm line at 160 yards.")}</div>
<details class="rc-test-context"><summary><strong>All capacity ratings printed on the box</strong></summary>
${table("Verified box and spool capacity ratings", ["Line marking", "Printed capacity"], test.manufacturerRatings.physical.map((rating) => [
  `${rating.material === "nylon" ? `${rating.lb} lb nylon` : `PE #${rating.pe} braid`} / ${rating.diameterMm.toFixed(2)} mm`,
  `${rating.meters} m${rating.printedYards ? ` / ${rating.printedYards} yd` : ""}`
]))}
<p class="rc-test-source-note">Meter and yard amounts are shown as Daiwa printed them, with its rounding. The box also notes that capacity can vary with the line and how it is spooled.</p></details>`)}
${section("equipment", "The Lines and Counter", `<div class="rc-test-equipment-grid">
  <div class="rc-test-equipment-item"><h3>Berkley Trilene XL</h3><dl><dt>Type</dt><dd>12 lb nylon monofilament</dd><dt>Package diameter</dt><dd>0.013 in / 0.33 mm</dd><dt>Supply spool</dt><dd>300 yd / 274 m</dd></dl></div>
  <div class="rc-test-equipment-item"><h3>Daiwa J-Braid X4</h3><dl><dt>Type</dt><dd>20 lb braid</dd><dt>Package diameter</dt><dd>0.21 mm / PE #2.5</dd><dt>Supply spool</dt><dd>300 yd / 270 m</dd></dl></div>
</div><div class="rc-test-photo-grid">
${photo(mono.packagePhoto, "Berkley Trilene XL Smooth Casting label: 12 lb, 300 yards, 0.013 inch and 0.33 mm", "The tested 12 lb Trilene XL is labeled 0.33 mm.")}
${photo(braid.packagePhoto, "Daiwa J-Braid X4 label: 20 lb, 300 yards or 270 meters, 0.21 mm and PE number 2.5", "The tested 20 lb J-Braid X4 is labeled 0.21 mm.")}
</div><p>Each test started with an empty spool, with no backing. We used the same Rapala digital line counter, kept tension on the line, and watched the fill level.</p>
<div class="rc-test-affiliate-area" data-product-role="tool"><a class="reelcalc-affiliate-link" href="https://amzn.to/4y21gqd" target="_blank" rel="sponsored nofollow noopener" data-retailer="amazon" data-link-placement="test_equipment">Check the Rapala Line Counter on Amazon</a><p class="reelcalc-affiliate-disclosure">As an Amazon Associate, ReelCalc may earn from qualifying purchases.</p></div>`)}
${section("mono-test", "What Happened With 12 lb Mono?", `<p>We first stopped at <strong>about ${yards(mono.practicalFeet)} yards</strong>, when the spool looked ready to fish. Then we kept going to the online rating of <strong>220 yards total</strong>. At that point, it looked overfilled.</p>
<div class="rc-test-photo-grid">
${photo(mono.practicalPhoto, "Trilene XL on the BG LT spool at the first stopping point of about 142.3 yards", "First stop: about 142.3 yards. Some room remained.")}
${photo(mono.continuedPhoto, "Trilene XL visibly overfilling the BG LT spool after continuing to about 220 yards total", "At about 220 yards total, the mono was visibly overfilled.")}
${photo(mono.practicalCounterPhoto, "Rapala line counter reading 426.8 feet during the mono test", "First stop: 426.8 ft / about 142.3 yd.")}
${photo(mono.continuedCounterPhoto, "Rapala line counter reading 660.3 feet after the mono overfill check", "Continued fill: 660.3 ft / about 220.1 yd.")}
</div><div class="rc-test-observation"><p><strong>Could we have added more?</strong> Yes. At our first stop, we could clearly see room for roughly another 18 yards. That would bring the fill to about 160 yards, right in line with Daiwa's 0.33 mm / 160-yard spool rating. We did not measure or photograph a separate 160-yard fill.</p></div>
<h3>Why 160 Yards Makes More Sense Than 220</h3>
<p>Daiwa's spool says <strong>0.33 mm nylon / 160 yards</strong>. Our Trilene XL is that same thickness. Daiwa calls its 0.33 mm line 16 lb, while Berkley calls ours 12 lb. The thickness is what takes up spool space, not the strength printed on the package.</p>
<p>So the online rating was not necessarily wrong. It left out an important detail: the 12 lb mono behind that 220-yard rating was thinner than ours.</p>${affiliate(mono)}`)}
${section("braid-test", "What Happened With 20 lb Braid?", `<p>After removing all the mono, we spooled the 20 lb J-Braid X4. We first stopped at <strong>about 166 yards</strong> (166.8 yards on the counter), which was a comfortable fill. A little more could have been added if needed while still staying comfortable, but <strong>definitely not 220 yards</strong>. When we continued to that amount, the spool was visibly overfilled.</p>
<div class="rc-test-photo-grid">
${photo(braid.practicalPhoto, "J-Braid X4 on the BG LT spool at the first stopping point of about 166.8 yards", "First stop: about 166.8 yards.")}
${photo(braid.continuedPhoto, "J-Braid X4 on the BG LT spool after the intentional 220-yard overfill check", "At about 220 yards total, the braid was also overfilled.")}
${photo(braid.practicalCounterPhoto, "Rapala line counter reading 500.5 feet during the braid test", "First stop: 500.5 ft / about 166.8 yd.")}
${photo(braid.continuedCounterPhoto, "Rapala line counter reading 660.2 feet after the braid overfill check", "Continued fill: 660.2 ft / about 220.1 yd.")}
</div><p class="rc-test-source-note">We did not measure how much extra braid could be added while keeping a comfortable fill. The first stop was not a maximum-capacity measurement.</p>
<h3>What Could Explain the Braid Overfill?</h3>
<p>Unlike the mono, line thickness alone does not explain this result well. Even a calculation using the more detailed braid rating on the box suggests more line than we were comfortable fishing with.</p>
<ul><li><strong>How tightly and evenly it was wound.</strong> Looser wraps or line building up in one area could use more room. We kept tension on the line, but did not measure it.</li>
<li><strong>The braid's thickness and how it packs.</strong> We used the 0.21 mm package figure. We did not measure the line ourselves, and that number alone may not fully describe how the woven line fills the spool.</li>
<li><strong>A different stopping point.</strong> Daiwa may use a different fill level when setting its capacity rating. We have not confirmed that level.</li>
<li><strong>How the published rating was established.</strong> It could reflect another J-Braid version, a calculation, different spooling conditions, or an optimistic estimate. We do not yet know which method Daiwa used for this exact rating.</li></ul>
<p>These are possibilities, not findings. <strong>We do not yet know what caused the difference.</strong> What we could see was that 220 yards looked overfilled.</p>${affiliate(braid)}`)}
${section("results", "The Results at a Glance", `${table("Measured stopping points, calculator estimates and overfill results", ["Test line", "Where we first stopped", "ReelCalc estimate", "At about 220 yd"], [
  [mono.name, `${yards(mono.practicalFeet)} yd`, `${rounded(mono.basis.capacityYards)} yd`, mono.continuedFillObservation],
  [braid.name, `${yards(braid.practicalFeet)} yd`, `${Math.round(braid.range.centerYards)} yd`, braid.continuedFillObservation]
])}
<p class="rc-test-source-note">First stops are approximate amounts measured by the counter, not maximum capacities. We checked ReelCalc while writing this page, not before the test.</p>`)}
${section("reelcalc-comparison", "What This Taught Us About ReelCalc", `<p><strong>ReelCalc estimated too much line for both of these spool-ups.</strong> Selecting the exact line helps, but the calculator also needs the right line thickness behind the reel's rating.</p>
<p>For mono, ReelCalc had assumed a thicker line for Daiwa's 220-yard rating. That made the reel seem to hold more than it should. Using the thickness printed on the spool instead gives <strong>about ${Math.round(physicalMono)} yards</strong>, close to Daiwa's 160-yard rating for our line's thickness.</p>
<p>That helps explain the mono. It does not solve the braid difference, so we need more testing before changing how braid is calculated.</p>
<details class="rc-test-context"><summary><strong>Calculation details</strong></summary>
<p>The mono calculation is 220 &times; (0.28 / 0.33)<sup>2</sup> = about ${Math.round(physicalMono)} yards. It adjusts Daiwa's 220-yard rating for our thicker line.</p>
<p>For braid, the box lists 0.20 mm / 230 m. Our X4 is labeled 0.21 mm. Adjusting that box rating for the slightly thicker line gives about ${Math.round(physicalBraid)} yards. Our first stop of ${yards(braid.practicalFeet)} yards was comfortable with a little room left, but 220 yards already looked overfilled.</p>
<p>The current saved mono reference is 0.014 in (about 0.356 mm) / 220 yd, rather than the spool's 0.28 mm / 220 yd. The current braid estimate uses pound-test ratings and typical braid diameters, giving ${Math.round(braid.range.centerYards)} yd; range ${braid.range.minimumYards}-${braid.range.maximumYards} yd.</p>
<p>ReelCalc uses stored line sizes of 0.013 in for Trilene XL and 0.008 in for X4. The separate calculations above use the photographed millimeter sizes. Those inch and millimeter labels are rounded, so they do not convert exactly.</p>
</details>`)}
${section("limitations", "A Few Things to Keep in Mind", `<p>This was one reel and one spool-up with each line. We judged the fill by eye and used a Rapala counter for length. We did not measure the gap below the spool lip, tension, or line thickness ourselves.</p>
<p>The photos show what happened in our test. They do not promise the exact same yardage for every angler.</p>
<h3>The Takeaway</h3><p><strong>Check line thickness, not just pound test.</strong> The details on the box and spool helped explain why our mono did not fit the simple online rating. The braid needs another look. In either case, watch the spool instead of forcing on a set number of yards.</p>`)}
${section("calculator-setup", "Try These Lines in ReelCalc", `<p>This calculator still uses the saved reel ratings discussed above. <strong>Its estimates were too high for these two tests.</strong> Use it to compare the numbers, not as a target to force onto your spool.</p>
<div class="rc-test-actions"><a class="rc-test-button" href="${preload("", mono)}">Compare 12 lb Trilene XL</a><a class="rc-test-button rc-test-button--secondary" href="${preload("", braid)}">Compare 20 lb J-Braid X4</a></div>
<div data-reelcalc-calculator data-reel-id="${test.reelId}" data-default-mode="capacity" data-main-line-id="${mono.lineId}" data-main-line-lb="12"><p>Reel calculator loading. <a href="${preload(reelUrl, mono, "")}">Open the exact reel's calculator</a>.</p></div>
<div class="rc-test-actions"><a class="rc-test-button rc-test-button--secondary" data-rc-test-event="real_world_test_wizard_click" data-link-placement="primary_cta" href="https://www.reelcalc.com/reelcalc-wizard?reel=${test.reelId}&amp;mode=capacity&amp;line=${mono.lineId}&amp;lb=12&amp;spool=300">Open This Reel in the Setup Wizard</a></div>`)}
${section("related", "Related ReelCalc Guides", `<ul class="rc-test-link-list">
<li><a href="${reelUrl}">Daiwa BG LT 3000D-XH Reel Setup Guide</a></li>
<li><a href="${monoGuide}">Berkley Trilene XL Diameter &amp; Capacity Guide</a></li>
<li><a href="${braidGuide}">Daiwa J-Braid X4 Diameter &amp; Capacity Guide</a></li>
<li><a href="https://www.reelcalc.com/line-database">Compare Line Diameters in the Database</a></li>
<li><a href="https://www.reelcalc.com/">ReelCalc Line Capacity and Backing Calculator</a></li>
<li><a href="https://www.reelcalc.com/reel-tests">More Real-World Spooling Tests</a></li>
</ul><div class="rc-test-affiliate-area" data-reelcalc-affiliates data-affiliate-kind="reel" data-product-role="reel" data-reel-id="${test.reelId}" hidden></div>`)}
</article>`;

const schema = { "@context": "https://schema.org", "@graph": [
  { "@type": "Article", "@id": `${canonical}#article`, headline: test.title, description: test.description, url: canonical, mainEntityOfPage: canonical, image: `${assetBase}${imagePath}${test.heroPhoto}`, author: { "@type": "Organization", name: "ReelCalc", url: "https://www.reelcalc.com/" }, publisher: { "@type": "Organization", name: "ReelCalc", url: "https://www.reelcalc.com/" }, about: { "@type": "Thing", name: "Daiwa BG LT 3000D-XH mono and braid spool capacity" } },
  { "@type": "BreadcrumbList", "@id": `${canonical}#breadcrumbs`, itemListElement: [
    { "@type": "ListItem", position: 1, name: "ReelCalc", item: "https://www.reelcalc.com/" },
    { "@type": "ListItem", position: 2, name: "Real-World Tests", item: "https://www.reelcalc.com/reel-tests" },
    { "@type": "ListItem", position: 3, name: "BG LT 3000D-XH Capacity Test", item: canonical }
  ] }
] };
const schemaTag = `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
const scripts = (base) => ["reel-page-runtime", "affiliate-links", "real-world-test-runtime", "reel-page-calculator"].map((name) => `<script src="${base}js/${name}.js?v=${name === "reel-page-calculator" ? "bg-test-004" : "2"}" data-asset-base="${base}"></script>`).join("\n");
const local = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(test.seoTitle)}</title><meta name="description" content="${escape(test.description)}"><meta name="robots" content="noindex"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="../../css/real-world-test.css?v=2"><style>body{color:#1f2528;font-family:Arial,sans-serif;margin:0;padding:34px 0}</style>${schemaTag}</head><body>\n<!-- REELCALC_REAL_WORLD_TEST_START -->\n${article}\n<!-- REELCALC_REAL_WORLD_TEST_END -->\n${scripts("../../")}</body></html>\n`;
const hosted = `<link rel="stylesheet" href="${assetBase}css/real-world-test.css?v=2">\n${schemaTag}\n${article.replaceAll(`../../${imagePath}`, `${assetBase}${imagePath}`)}\n${scripts(assetBase)}\n`;
const blog = `${hosted}<style>body.view-item:has(.reelcalc-real-world-test[data-test-id="${test.id}"]) .blog-item-top-wrapper{display:none!important}</style>
<script>(()=>{const page=document.querySelector('.reelcalc-real-world-test[data-test-id="${test.id}"]');if(!page)return;const title=Array.from(document.querySelectorAll('h1.entry-title[data-content-field="title"]')).find(h=>h.textContent.trim()===${JSON.stringify(test.title)});if(title&&!page.contains(title))title.closest('.blog-item-top-wrapper')?.remove();})();</script>\n`;
const images = [];
for (const file of new Set([test.heroPhoto, ...Object.values(test.factoryPhotos), ...test.runs.flatMap((run) => [run.packagePhoto, run.practicalPhoto, run.practicalCounterPhoto, run.continuedPhoto, run.continuedCounterPhoto])])) {
  const bytes = await fs.readFile(path.join(root, imagePath, file));
  images.push({ file, sha256: createHash("sha256").update(bytes).digest("hex"), original: true });
}
const snapshot = {
  testId: test.id, engineVersion: core.ENGINE_VERSION, engineSha256: createHash("sha256").update(await read("js/calculator-core.js")).digest("hex"),
  reelId: reel.id, storedMonoDiameterIn: reel.rated_line_diameter_in,
  mono: { storedDiameterIn: mono.line.dia_in, currentCapacityYards: mono.basis.capacityYards, physicalReference: monoReference, physicalDiameterCapacityYards: physicalMono },
  braid: { storedDiameterIn: braid.line.dia_in, currentCapacityYards: braid.range.centerYards, minimumYards: braid.range.minimumYards, maximumYards: braid.range.maximumYards, physicalReference: braidReference, physicalDiameterCapacityYards: physicalBraid },
  observations: runs.map((run) => ({ lineId: run.lineId, practicalFeet: run.practicalFeet, practicalYards: yards(run.practicalFeet), continuedFeet: run.continuedFeet, continuedYards: yards(run.continuedFeet) })), images
};
const output = path.join(root, "generated/reel-tests");
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(root, `examples/reel-tests/${test.slug}.html`), local);
await fs.writeFile(path.join(output, `${test.slug}-squarespace.html`), hosted);
await fs.writeFile(path.join(output, `${test.slug}-squarespace-blog.html`), blog);
await fs.writeFile(path.join(output, `${test.slug}-verification.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
await fs.writeFile(path.join(output, `${test.slug}-seo.txt`), [
  "PAGE TITLE / H1", test.title, "", "SEO TITLE", test.seoTitle, "", "META DESCRIPTION", test.description, "", "URL SLUG", test.slug,
  "", "CANONICAL URL", canonical, "", "HUB EXCERPT", test.hubExcerpt, "", "HUB THUMBNAIL", `${imagePath}${test.heroPhoto}`, "", "PUBLICATION STATUS", test.publicationStatus === "published" ? "Published" : "Draft for review; not live.", "",
  "PUBLISHING", "Create one post in the existing /reel-tests Squarespace blog. This automatically adds its card to the current Real-World Tests hub. Do not create a second hub, product, or collection.",
  `Use ${test.slug}-squarespace-blog.html for the post code block. Publish assets before the post.`,
  "All six physical capacity rows are verified against the supplied box and empty-spool photos. Both originals are included, along with all 11 test photos.",
  "After the post is live, transfer pendingReelPageLinks to reelPageLinks and set publicationStatus to published in data/real-world-test-004.json. Rebuild this page and sync the published test links. Verify the live blog card and exact reel link.",
  "Before running scripts/sync-real-world-test-links.mjs, replace its legacy hard-coded version assignments with monotonic version bumps. The current registry and embed manifest have newer versions. Refresh the reel loader's manifest cache version when deploying the new link.",
  "Do not substitute the older BG 3000 or BG MQ. Do not change the calculator's reel data or formulas as part of publishing this article.", ""
].join("\n"));

// Register the draft without exposing a dead article link on a published reel page.
const allTests = await json("data/real-world-tests.json");
const index = allTests.tests.findIndex((row) => row.id === test.id);
const record = { ...test, images };
if (index < 0) allTests.tests.push(record); else allTests.tests[index] = record;
await fs.writeFile(path.join(root, "data/real-world-tests.json"), `${JSON.stringify(allTests, null, 2)}\n`);
console.log(JSON.stringify({ page: `examples/reel-tests/${test.slug}.html`, monoEstimate: rounded(mono.basis.capacityYards), braidEstimate: Math.round(braid.range.centerYards), images: images.length, status: test.publicationStatus }, null, 2));
