import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/affiliate-links.js", import.meta.url), "utf8");
const window = {};
vm.runInNewContext(source, { window, URL, Array, Number, String, Math });

const helpers = window.ReelCalcAffiliateLinks;
const affiliateData = JSON.parse(fs.readFileSync(new URL("../data/reel-affiliates.json", import.meta.url), "utf8"));

assert.ok(helpers, "affiliate-link helpers should load");
assert.equal(helpers.recommendedSpoolYards(142), 150);
assert.equal(helpers.recommendedSpoolYards(185), 200);
assert.equal(helpers.recommendedSpoolYards(201), 300);
assert.equal(helpers.recommendedSpoolYards(300), 300);
assert.equal(helpers.recommendedSpoolYards(301), 500);
assert.equal(helpers.recommendedSpoolYards(5200), 5500);

for (let required = 1; required <= 10000; required += 17) {
  const spool = helpers.recommendedSpoolYards(required);
  assert.ok(spool >= required, `suggested spool ${spool} must cover ${required} yards`);
}

const braidOffer = helpers.buildRecommendedLineOffer({
  affiliateData,
  line: { type: "Braid", lb: 20 },
  requiredYards: 185
});
assert.ok(braidOffer, "20 lb braid should produce an offer");
assert.equal(braidOffer.suggestedSpoolYards, 200);
assert.equal(braidOffer.matchType, "generic_search");
assert.match(braidOffer.url, /^https:\/\/(www\.)?amazon\.com\/s\?/);
assert.equal(new URL(braidOffer.url).searchParams.get("tag"), "reelcalc-20");
assert.match(new URL(braidOffer.url).searchParams.get("k"), /20 lb braided fishing line 200 yard spool/i);

const monoOffer = helpers.buildRecommendedLineOffer({
  affiliateData,
  line: { type: "Monofilament", lb: 8 },
  requiredYards: 121
});
assert.match(new URL(monoOffer.url).searchParams.get("k"), /8 lb monofilament fishing line 125 yard spool/i);

assert.equal(helpers.buildRecommendedLineOffer({ affiliateData, line: { type: "Braid", lb: 20 }, requiredYards: 0 }), null);
assert.equal(helpers.buildRecommendedLineOffer({ affiliateData: null, line: { type: "Braid", lb: 20 }, requiredYards: 100 }), null);

console.log("Recommended-line affiliate tests passed.");
