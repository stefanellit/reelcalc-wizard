# Group B Independent Source Review

Completed September 13, 2026. All 22 source-verified pages / 201 original rows reviewed, including exact source tables, 490 Sufix package bindings and all images. User subsequently authorized Group B corrections. Both confirmed findings are applied to the pack and source builders; **22 gold configs and 199 usable rows remain**.

## Confirmed Holds

**GB-002 / P1: Advance Mono 25 lb filler lengths conflict.** Exact SKUs `604-125`, `604-125G` and `604-125L` are retained as 330 yd, but their manufacturer image labels say 250 yd. This appears in the saved primary HTML and in an independent live HTTP check of the [official U.S. page](https://www.rapala.com/us_en/advance-monofilament-ul-li-the-mono-that-thinks-it-s-a-braid-li-ul) at 14:53:16 UTC. If 250 yd is correct, the current option overstates supply by 80 yd (32%).

Applied: hold those three filler packages, not the entire 25 lb strength. Its `.020 in / .508 mm` diameter and separate 1,200 yd SKUs `604-1025`, `604-1025G` and `604-1025L` remain supported; the latter's length fields and image labels agree. Package/source guidance and FAQ now describe the exception. Conflicting metadata is retained in exclusions; neither filler length is silently selected. Original pack locations: lines 7939, 7948 and 7957.

**GB-001 / P1: TopKnot Leader 40 and 50 lb have unresolved inch/mm pairs.** Original pack rows at lines 10687 and 10738 cover both Natural Clear and Disappearing Pink, in 30 and 100 yd. Applied: remove both usable strength rows, preserve all affected source entries and legacy exclusion IDs, retain the existing 130 lb hold, and update product/leader editorial. The 12 supported strengths remain.

| Strength | Printed mm / in | Inch value converted to mm | Difference |
| --- | --- | --- | --- |
| 40 lb | .570 / .023 | .5842 | .0142 mm |
| 50 lb | .620 / .025 | .6350 | .0150 mm |

At the printed precision, the maximum combined nearest-rounding allowance is .0132 mm: .0005 + (.0005 x 25.4). Both exceed it. Parsing `.570` into `0.57` does not establish a lower-precision source. The claim that all retained pairs are within rounding tolerance is therefore inaccurate.

Evidence: saved [Clear HTML](<C:/Users/Tyler/Documents/reelcalc WIZARD/tmp/line-page-launch-candidate/research/line-pages/full-catalog/group-b/evidence/yo-18.html:256>) and [Pink HTML](<C:/Users/Tyler/Documents/reelcalc WIZARD/tmp/line-page-launch-candidate/research/line-pages/full-catalog/group-b/evidence/yo-19.html:253>), with the same pairs repeated in their 100 yd tables. The independently opened [official DUEL TopKnot Leader alternative](https://www.duel.co.jp/english/products/topknot-leader) repeats the three-decimal pairs for R1232-/40 lb and R1233-/50 lb; it does not resolve the conflict. A live refresh of the Yo-Zuri page returned 502, so its saved primary HTML was used.

Remaining condition: manufacturer clarification is needed before restoring the held entries. This finding identifies inconsistent source pairs, not which value is physically correct.

## Review Coverage

- All seven SPRO models: exact Shopify variants plus visually inspected package labels/catalog diameters. Printed 150 m/164 yd and 300 m/328 yd pairs remain distinct from meter-only conversions. Current Cast Control 16 lb identity is supported; its older 15 lb conflict remains disclosed.
- All six verified Sufix models: independently read raw HTML tables and exact embedded variant fields, including image-label lengths. All 490 package bindings checked; the three Advance Mono exceptions above were the only new retained-package conflicts found. Fourth-decimal .0085-inch data is preserved.
- All nine Yo-Zuri models: exact Clear/Pink and solid/Five Color scope, package tables and unit pairs checked. No Hybrid mass-to-length inference. T7/MainLine and Leader/Ice identities remain separate. Existing 300 lb leader and SB9 White 100 lb bulk holds remain.
- All four leaders retain `Fluorocarbon Leader`, `role: leader`, empty examples and replacement-section guidance. No additional role or copy blocker found.
- All 22 images visually reviewed and matched byte-for-byte to in-memory encodings of saved manufacturer originals; primary image URLs were verified. Four older Yo-Zuri canvases have large white margins and limited fine-print resolution, but correct product identity. No image assets changed.

The full 22-model ledger and source-specific notes are in [group-b-review.json](<C:/Users/Tyler/Documents/reelcalc WIZARD/tmp/line-page-launch-candidate/research/line-pages/full-catalog/independent-review/group-b-review.json>).

## Verification And Hashes

Before pack SHA-256: `79a2abe9dd11af9439cc066ceac324a74f191bd2c06f1b25d7168d52eaa1ca99`

After pack SHA-256: `3228ff1eec731e0f072667d2b7b65744e5821857ae3c7a03ca10c4f2c8219973`

The review JSON records full before/after hashes for every changed Group B artifact. Passed: syntax checks for five modules; execution of the actual extracted Sufix and leader builder row/exclusion logic against saved fixtures; copy, legacy-ID and role checks; an idempotent repair check. The repair asserted that all other 22 models (20 verified and two unresolved) were unchanged. Source builders now preserve the holds on regeneration.

The earlier 2,493-check validation report predates this corrected pack and is marked historical in Group B's handoff/status. Main still owns fresh staging, renderer, browser and release validation. No main browser/runtime, shared data or release files changed. No stock, price, licensing or hands-on performance audit performed.
