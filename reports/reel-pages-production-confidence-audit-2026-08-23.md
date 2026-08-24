# ReelCalc Reel Pages Production Confidence Audit

Date: 2026-08-23

## Executive conclusion

The current reel-page system is mechanically sound, useful to anglers, and safe to keep live. All 919 registered reel pages passed live desktop and mobile functional testing. Calculator conservation checks, recommendation sanity checks, reel-to-wizard links, comparison links, line selectors, page structure, responsive layout, and baitcaster-specific behavior passed.

This audit does not claim that every one of the 1,336 stored reel records was independently re-researched from scratch. It distinguishes records that are clean, records that are usable with review notes, and records intentionally withheld from automatic calculations.

## Current inventory

- 1,336 reel records across 14 brands
- 1,320 calculation-ready records
- 16 intentionally blocked/manual records
- 919 registered live reel pages
- 421 spinning-reel pages
- 498 baitcaster pages
- 903 usable line records available to page calculators

## Live page results

All 919 registered live pages passed:

- HTTP response and page initialization
- Ten required gold-standard content sections
- Shared reel calculator initialization
- Main-line and backing-line selector population
- Reel-specific backing calculation completion
- Exact reel preload link to the Setup Wizard
- Exact reel preload link to the Comparison Tool
- Product image loading
- No visible Add to Cart or Buy controls
- No loader errors
- No horizontal overflow on desktop or mobile

Detailed results: `reports/all-reel-pages-live-audit.json`

## Calculation and recommendation results

- 465,960 actual-line backing calculations passed spool-space conservation checks
- 2,674 published braid anchors passed ordering and range checks
- 39,600 general recommendation scenarios passed
- 451,500 baitcaster full-spool calculations passed
- 163,792 baitcaster braid-range calculations passed
- 8,000 baitcaster backing calculations passed
- 451,500 baitcaster handle-turn calculations passed
- 15,000 baitcaster recommendation scenarios passed
- Maximum baitcaster braid recommendation was 324 yards; no implausible 1,000-yard recommendation remained
- No specialty braid recommendation card fell below the reel-specific practical minimum
- Reel-page and Comparison Tool calculation parity passed across all 919 page reels

## Active-page data confidence

Of the 919 active page records:

- 831 are clean with no audit flags
- 59 are usable review records, mainly because a reputable secondary source is used or a conservative braid-anchor note is present
- 29 are JDM/PE-capacity records whose manufacturer braid notation cannot be honestly converted directly into pound test
- 0 active pages are blocked

The 29 PE records remain usable because ReelCalc does not invent a pound-test braid rating. The calculator uses the verified reference capacity and, where available, exact PE/diameter calibration. These records should receive future market-specific review, but they are not producing a known calculation failure.

## Source verification

- 305 unique source URLs were checked
- 61 were directly reachable during the final pass
- 244 were access-restricted by manufacturer or retailer bot protection
- 0 were broken after repairs
- Every inspectable source matched the stored reel model or SKU

## Live sitemap coverage

- 421 of the 919 canonical reel-page URLs are currently present in Squarespace's live sitemap
- All 421 spinning-reel pages are present
- All 498 newly imported baitcaster pages are currently absent from the sitemap
- The missing baitcaster URLs still return valid public pages and passed the live functional audit

Because the baitcaster import is new, this may be a Squarespace sitemap propagation delay. Recheck the sitemap after 24 to 72 hours. If the 498 URLs remain absent, their Squarespace SEO availability and collection indexing settings need to be reviewed before treating the baitcaster launch as fully discoverable in search.

Two provenance repairs were made:

1. Three withheld Daiwa Tatula Elite records now use Daiwa's current official product URL.
2. The discontinued Daiwa CA 80 record now uses a live exact-model Tackle Warehouse specification table plus Daiwa's official schematic archive.

One manufacturer conflict was resolved and documented:

- Abu Garcia Revo Winch LP now uses the coherent official Australian braid row: 20 lb / 235 yd, 30 lb / 175 yd, and 40 lb / 145 yd. The U.S. page appears to repeat a mono value in its third braid cell. Both official sources remain documented.

## Duplicate and blocked-record review

- Duplicate reel IDs: 0
- Duplicate SKU groups: 9
- Seven duplicate-SKU groups are separate Shimano Vanquish and Vanquish CE generations that reuse regional model labels
- Two are Lew's/Mach aliases already suppressed from duplicate page generation
- The 16 blocked records are not active pages and cannot preload an automatic calculation until required capacity data is verified

## Honest residual limits

1. A user can deliberately select an extremely thin line on a very large reel and receive a very large theoretical capacity. Recommendation modes guard against this, but exact-line modes honor the user's chosen line. A future plain-language warning would improve usability without changing the math.
2. Manufacturer winding tension, actual line diameter, spool lip fill level, and regional product differences prevent any diameter-based calculator from guaranteeing an exact physical yardage. ReelCalc's ranges and estimate wording are therefore appropriate.
3. The 498 baitcaster pages are live but are not yet listed in Squarespace's sitemap. This does not affect calculator use, but it can delay search discovery.
4. The old master Squarespace import artifact is stale relative to the 919-page registry. It must be rebuilt before the next mass import; it does not affect pages already live.
5. Thirty-five non-blocked database records remain high-priority research items. Twenty-nine are PE-notation records and six have explicitly recorded source conflicts. Existing safeguards prevent unsupported data from silently replacing verified anchors.

## Production decision

Keep the current pages live. The system has strong automated coverage and no known systemic calculation, recommendation, link, loader, or responsive-layout failure. Recheck baitcaster sitemap inclusion after Squarespace has had time to process the new import. Future accuracy work should focus on the documented PE/source-review queue and user-submitted spool-result validation, not another broad rewrite of the calculation engine.
