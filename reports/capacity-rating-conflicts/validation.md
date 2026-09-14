# Capacity Warning Validation

Checked 2026-09-13 before publishing.

- New assessment tests: all 1,336 reel entries; 1,266 assessable, 268 flagged. Raw and prepared catalogs agree. Missing data, manual ratings, braid-only references, PE meters, threshold boundary, reversed conflicts, invalid anchors, overlapping anchors, and non-mutation checked.
- Published braid calibration: passed, 1,243 reels and 2,681 exact ratings.
- Single braid-anchor regression: passed.
- Reel-page capacity integrity: passed, including 919 live-manifest reel entries.
- Line-page engine: passed all nine representative calculation cases.
- Line-page publishing: passed all 120 hosted guides and isolated styles.
- Comparison/reel-page parity: passed 1,009,981 capacities, 44,112 backing results, and related ranges and handle-turn checks.
- Independent before/after comparison against the pre-change core: 5,344 capacity/backing outputs identical.
- Browser: wizard, hosted line-page calculator, shadow-DOM reel-page calculator and comparison checked at 375px and 1009px content widths. Warnings present for BG LT; no horizontal overflow or warning text clipping. Wizard backing warning present. Changing the wizard reel to PENN Fierce IV 8000 removed all conflict warnings.

## Existing Test Limitation

`scripts/test-wizard-backing-parity.mjs` fails an older expected-value assertion (expected 112.7778, actual 181.8992). The same failure was reproduced with both the pre-change core and pre-change wizard exported from commit db9e40e. This warning-only change does not resolve or conceal that existing test mismatch. The broader current shared-engine parity suite passes.

## Scope

The warning is a screening heuristic about conflicting estimates under reference-diameter assumptions. It is not a manufacturer-error verdict, a guaranteed-capacity check, or a new packing correction. The homepage manual-input calculator is unchanged. No reel ratings or line specifications were edited.
