# Batch Two Publication

The user approved publishing the ten reviewed guides. This release does not start another batch.

## Published in Squarespace

- Sunline FC Sniper
- Sunline Shooter
- Sunline Assassin FC
- Sunline Super Natural Mono
- Sunline SX1
- Sunline Xplasma Asegai
- Sunline Siglon PE X8
- Sunline Shooter Machinegun Cast
- Sunline Shooter BMS Azayaka FC
- Berkley GINCLEAR

Assets deployed in `e71a3f3` before import. Squarespace reported ten added entries with no import errors. Each received a native SEO title, description, and manufacturer featured image before being saved Public. The public collection lists all twenty guides. Do not reimport `UPLOAD-THIS-10-new-line-guides.csv` or the earlier seven-guide CSV; those are create-only files and would duplicate pages.

The release manifest now declares twenty published guides. The generated incremental import inventory contains zero new entries. The directory and old review hub use public URLs for this batch.

## Verification

- Every new public URL resolves to its exact model, one visible H1, correct canonical and description, loaded package image, and one ready calculator.
- Initial public HTML metadata, before the hosted guide loader replaced the title, matched each model's native SEO title and description.
- All ten guides have no visible price, variants, or cart controls after the existing scoped guide styling loads. The `/lines` listing also has no visible Add To Cart buttons after loading.
- Public desktop checks found no horizontal page overflow. Squarespace listing image filenames match their models; offscreen images use native lazy loading.
- FC Sniper 8 lb at .0093 inch with an entered 150-yard/.0093-inch reference returned 150 yards without backing.
- Super Natural Mono 8 lb at .0093 inch with the same reference returned 150 yards, with the expected 180 yards left from a 330-yard package after one fill.
- SX1 16 lb on Vanford A C3000XGA returned an estimated 169-yard full capacity and 36.2 yards of Big Game 10 lb backing for 125 yards of main line. Its Wizard URL retained the exact reel, line, strength, main-line amount, and package length. Both purchase links retained the affiliate tag and selected line context.
- Re-ran 656 batch specification/package/release checks, twenty component/schema checks with 493 isolated selectors, nine import-selection safety checks, affiliate tests, and the line-page engine regression tests. All passed.

Evidence: `line-batch-two-import-receipt.txt` and `line-batch-two-public-verification.json`. The prior native/imported responsive audits cover 320, 390, 768, and 1280 widths. This turn's public browser viewport remained 1280x720 despite a temporary viewport request; the override was reset. Do not describe these public checks as new mobile testing.

These are software and recorded-source checks, not physical spooling tests, a guarantee about every underlying reel rating, or a prediction of Google indexing or traffic. No calculation-engine changes were needed for this publication.

## Catalog Position

Twenty of 138 main-catalog models are now published. The other 118 remain tracked for future work, with source conflicts and leader-only products handled separately.
