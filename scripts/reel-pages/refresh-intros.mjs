import assert from "node:assert/strict";
import { normalizeReel } from "./lookup.mjs";
import { buildRecommendationModel } from "./recommendations.mjs";
import { featureProfileFor } from "./features.mjs";
import { buildIntro } from "./render.mjs";

// Refresh only introduction copy, keeping published page settings and calculators intact.
export function refreshIntros(manifest, reels, featureCatalog, { approvedFeatureKeys = [] } = {}) {
  const byId = new Map(reels.map((reel) => [reel.id, reel]));
  for (const entry of Object.values(manifest.pages)) {
    const raw = byId.get(entry.reelId);
    assert.ok(raw, `Missing reel for ${entry.canonicalPath}`);
    const reel = normalizeReel(raw);
    const intro = buildIntro(reel, buildRecommendationModel(reel), featureProfileFor(reel, featureCatalog));
    if (approvedFeatureKeys.includes(intro.evidenceKey)) {
      assert.equal(featureCatalog.families[intro.evidenceKey]?.sourceStatus, "verified");
      entry.introDetailMode = intro.detailMode;
      entry.introFeatureNames = intro.featureNames;
      entry.introEvidenceSource = intro.evidenceSource;
    } else {
      assert.equal(intro.detailMode, entry.introDetailMode, `${entry.reelId}: intro evidence changed`);
      assert.deepEqual(intro.featureNames, entry.introFeatureNames, `${entry.reelId}: approved features changed`);
    }
    assert.equal(intro.evidenceKey, entry.introEvidenceKey, `${entry.reelId}: evidence key changed`);
    // Retain existing source URLs, including older aliases for the same product.
    entry.intro = intro.text;
    entry.introVariant = intro.variant;
  }
  return manifest;
}
