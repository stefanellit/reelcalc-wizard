import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const json = async (file) => JSON.parse(await read(file));
const test = await json("data/real-world-test-004.json");
const all = await json("data/real-world-tests.json");
const verification = await json(`generated/reel-tests/${test.slug}-verification.json`);
assert.equal(all.tests.filter((entry) => entry.id === test.id).length, 1);
assert.equal(test.reel.modelCode, "BGLT3000D-XH");
assert.equal(test.backingUsed, false);
assert.equal(test.measurement.absoluteMaximumMeasured, false);
assert.equal(test.measurement.independentCalibrationDocumented, false);
assert.equal(test.runs[0].extraRoomMeasured, false);
assert.match(test.runs[1].extraRoomObservation, /166.8 yards was a comfortable fill/);
assert.deepEqual(verification.observations.map((run) => run.practicalYards), [142.3, 166.8]);
assert.deepEqual(verification.observations.map((run) => run.continuedYards), [220.1, 220.1]);
for (const run of verification.observations) {
  assert.equal(run.practicalYards, Number((run.practicalFeet / 3).toFixed(1)));
  assert.equal(run.continuedYards, Number((run.continuedFeet / 3).toFixed(1)));
}
assert.deepEqual(test.manufacturerRatings.physical.map(({ material, diameterMm, meters, printedYards }) => [material, diameterMm, meters, printedYards ?? null]), [
  ["nylon", 0.25, 260, 280], ["nylon", 0.28, 200, 220], ["nylon", 0.33, 150, 160],
  ["braid", 0.16, 430, null], ["braid", 0.18, 300, null], ["braid", 0.20, 230, null]
], "Only ratings verified in the box and spool photos");
assert.deepEqual(test.missingEvidence, []);
const reelLinks = test.publicationStatus === "published" ? test.reelPageLinks : test.pendingReelPageLinks;
assert.equal(reelLinks.length, 1);
assert.equal(reelLinks[0].reelId, test.reelId);
assert.equal(reelLinks[0].relationship, "exact-reel");
if (test.publicationStatus === "draft") {
  assert.deepEqual(test.reelPageLinks, [], "No dead links on the published reel page before the new post is live");
}
const imageFiles = new Set(verification.images.map((image) => image.file));
assert.equal(imageFiles.size, 13);
for (const file of Object.values(test.factoryPhotos)) assert.ok(imageFiles.has(file));
for (const image of verification.images) {
  const bytes = await fs.readFile(path.join(root, "assets/real-world-tests/daiwa-bg-lt-3000d-xh", image.file));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256, `Preserve original ${image.file}`);
}
const html = await read(`examples/reel-tests/${test.slug}.html`);
const fragment = await read(`generated/reel-tests/${test.slug}-squarespace.html`);
const blog = await read(`generated/reel-tests/${test.slug}-squarespace-blog.html`);
for (const content of [html, fragment, blog]) {
  assert.equal((content.match(/<h1(?:\s|>)/g) || []).length, 1);
  assert.match(content, /css\/real-world-test\.css\?v=2/);
  const schema = JSON.parse(content.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(schema["@graph"].map((node) => node["@type"]), ["Article", "BreadcrumbList"]);
  assert.equal(schema["@graph"][0].url, `https://www.reelcalc.com${test.canonicalPath}`);
  assert.doesNotMatch(JSON.stringify(schema), /"Product"|"offers"|"aggregateRating"|"reviewRating"/);
  assert.deepEqual(new Set([...content.matchAll(/data-test-image="([^"]+)"/g)].map((match) => match[1])), imageFiles);
  for (const run of test.runs) {
    for (const key of ["practicalPhoto", "continuedPhoto", "practicalCounterPhoto", "continuedCounterPhoto"]) {
      assert.ok(content.includes(`data-test-image="${run[key]}"`));
    }
    assert.ok(content.includes(`data-line-id="${run.lineId}"`));
  }
  for (const text of ["we could clearly see room for roughly another 18 yards", "right in line with Daiwa's 0.33 mm / 160-yard spool rating", "We did not measure or photograph a separate 160-yard fill", "0.28 mm is very thin compared with familiar 12 lb mono sold in the U.S.", "Thinner options exist", "not maximum capacities", "We do not yet know what caused the difference", "not before the test", "255.1 yd", "264 yd; range 235-295 yd", "about 158 yards", "about 228 yards", "12/220:", "20/220:", "The box and spool had much more detailed capacity information than the online listing", "line diameter, which simply means how thick the line is"]) {
    assert.ok(content.includes(text) || content.replace(/<[^>]*>/g, "").includes(text), `Required context: ${text}`);
  }
  assert.doesNotMatch(content, /\bTODO\b|\bTBD\b|undefined|Daiwa lied|specs are wrong/);
  const plainText = content.replace(/<[^>]*>/g, "");
  assert.ok(plainText.includes("about 166 yards (166.8 yards on the counter)"));
  assert.ok(plainText.includes("A little more could have been added if needed while still staying comfortable, but definitely not 220 yards"));
  assert.doesNotMatch(plainText, /193.yard|halfway between/);
  assert.ok(plainText.includes("These are possibilities, not findings"));
  assert.doesNotMatch(content, /counter reading could|counter against a known length|counter.{0,30}accuracy/i);
  assert.match(content, /0\.20 mm \/ 230 m/);
  for (const rating of test.manufacturerRatings.physical) {
    assert.ok(content.includes(`${rating.diameterMm.toFixed(2)} mm`));
    assert.ok(content.includes(`${rating.meters} m`));
    assert.ok(imageFiles.has(rating.photo));
  }
  assert.doesNotMatch(content, /angler-judged|nominal versus effective|saved-reel estimate|photographed diameter reference/);
  assert.match(content, /<details class="rc-test-context"><summary><strong>Calculation details<\/strong><\/summary>/);
  assert.match(content, /<details class="rc-test-context"><summary><strong>All capacity ratings printed on the box<\/strong><\/summary>/);
  assert.doesNotMatch(content, /<details[^>]*\bopen\b/, "Technical details should be optional, not expanded by default");
  assert.match(content, /data-default-mode="capacity"/);
  assert.match(content, /data-main-line-id="berkley-trilene-xl-monofilament-12"/);
  assert.match(content, /data-reel-id="daiwa-bg-lt-3000d-xh"/);
  assert.doesNotMatch(content, /#reelcalc-calculator/, "Do not link to a nonexistent anchor on the reel guide");
  const links = [...content.matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  assert.ok(links.includes(test.sources.sufixElite), "Link the U.S.-market diameter example to its manufacturer");
  assert.ok(links.includes("https://www.reelcalc.com/reel-pages/p/daiwa-bg-lt-3000"));
  const guides = await json("data/line-guide-links.json");
  for (const key of ["berkley-trilene-xl", "daiwa-j-braid-x4"]) assert.ok(links.includes(guides.guides[key].url));
  for (const run of test.runs) assert.ok(links.some((link) => link.startsWith("?mode=capacity&line=" + run.lineId)));
  assert.ok(links.includes("https://amzn.to/4y21gqd"));
  assert.match(content, /rel="sponsored nofollow noopener"/);
  assert.match(content, /As an Amazon Associate/);
}
assert.doesNotMatch(blog, /href="\.\.\//);
assert.doesNotMatch(blog, /<!doctype|<html(?:\s|>)/i);
assert.doesNotMatch(blog, /name="robots"/, "Preview noindex must not leak into the publishing snippet");
if (test.publicationStatus === "published") {
  const registry = await json("data/reel-pages.json");
  const manifest = await json("data/reel-page-embeds.json");
  for (const pages of [registry.pages, Object.values(manifest.pages)]) {
    const linked = pages.filter(page => page.realWorldTest?.testId === test.id);
    assert.equal(linked.length, 1, "Link this test only to the exact tested reel");
    assert.equal(linked[0].reelId, test.reelId);
    assert.equal(linked[0].realWorldTest.path, test.canonicalPath);
  }
}

const context = { window: {} };
const engine = await read("js/calculator-core.js");
vm.runInNewContext(engine, context);
const core = context.window.ReelCalcCore;
assert.equal(core.ENGINE_VERSION, verification.engineVersion);
assert.equal(createHash("sha256").update(engine).digest("hex"), verification.engineSha256);
const reel = (await json("data/reels.json")).find((row) => row.id === test.reelId);
const lines = await json("data/lines.json");
const mono = lines.find((line) => line.id === test.runs[0].lineId);
const braid = lines.find((line) => line.id === test.runs[1].lineId);
assert.equal(core.capacityBasisForActualLine(reel, mono, lines).capacityYards, verification.mono.currentCapacityYards);
assert.equal(core.calculateActualLineBraidCapacityRange(reel, braid, lines).centerYards, verification.braid.currentCapacityYards);
assert.ok(Math.abs(core.calculateLineCapacityFromDiameter(220, core.mmToInches(0.28), core.mmToInches(0.33)) - verification.mono.physicalDiameterCapacityYards) < 1e-8);
assert.equal(verification.braid.physicalReference.photo, test.factoryPhotos.box);
assert.ok(Math.abs(core.calculateLineCapacityFromDiameter(core.metersToYards(230), core.mmToInches(0.20), core.mmToInches(0.21)) - verification.braid.physicalDiameterCapacityYards) < 1e-8);

// Exercise the exact opt-in initialization statement; preserve all legacy defaults and explicit URL modes.
const calculator = await read("js/reel-page-calculator.js");
const defaultStatement = calculator.match(/    if \(!preload.mode && mount.dataset.defaultMode === "capacity"\) preload.mode = "capacity";/)?.[0];
assert.ok(defaultStatement);
for (const [mode, defaultMode, expected] of [["", "capacity", "capacity"], ["", undefined, ""], ["backing", "capacity", "backing"], ["capacity", undefined, "capacity"]]) {
  const state = { preload: { mode }, mount: { dataset: { defaultMode } } };
  vm.runInNewContext(defaultStatement, state);
  assert.equal(state.preload.mode, expected);
}
console.log(JSON.stringify({ testId: test.id, status: "passed", originals: imageFiles.size, conversionsChecked: 4, calculatorComparisonsChecked: 4, publishingStatus: test.publicationStatus }, null, 2));
