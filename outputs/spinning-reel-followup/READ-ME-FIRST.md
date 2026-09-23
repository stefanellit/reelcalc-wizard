# Spinning Reel Page Import

**Import complete:** all 43 new spinning-reel pages were verified live on September 23, 2026. Their links are activated in the shared guide registry. Held for more research: **125**. The requested 168-page follow-up is not fully complete.

**Do not import the 43-page CSV again.** It is retained as a record of this completed batch.

## Original Import Steps (Completed)

1. In Squarespace, open the same product CSV import screen used for the earlier reel pages.
2. Import **UPLOAD-THIS-43-new-spinning-reel-pages.csv** once. Use the existing **reel-pages** collection, not a new store or collection.
3. Do not change the CSV headers, product type, tags, IDs, or zero-price import fields. Those fields are required for the existing guide-page setup; the shared loader hides shopping controls and prices from readers.
4. Wait for the import confirmation. The expected addition is 43 items. Do not import the file a second time.
5. Tell Codex the import is complete. The next step is checking the live pages and activating their links in the organized guide directory and other selectors.

## What Is Included

- Bass Pro Shops: 2
- Daiwa: 9
- Lew's: 7
- Okuma: 4
- Quantum: 7
- Shimano: 14

## Checks

- Built with the existing shared reel-page generator, calculator engine, styling, line links, and affiliate system. No separate calculator or copied old template.
- Exact model-code matching against manufacturer product tables or manufacturer-authored catalogs; supplemental catalog item numbers used where model labels differ.
- Published mono and braid ratings reconciled against the page tables and calculator parser.
- 516 capacity/backing/overfill scenarios passed, plus unit-conversion and rating round-trip checks.
- All 1166 existing page entries, real-world-test links, and aliases preserved.
- CSV checked for 28 native columns, unique URLs and SKUs, blank product IDs, correct tags, and valid imported HTML.
- Desktop previews tested for line selection, capacity, backing, affiliate links, and disclosure. A 390px phone-width preview was also visually checked.
- Product photographs from manufacturers, their catalogs, or exact-family dealer listings optimized without changing the reels shown. Some older catalog photographs are lower resolution than current product photographs.
- Every new page was opened in the browser; its calculator mounted and its photograph loaded without desktop horizontal overflow. See browser-audit.json for the exact list and manual calculation checks.

## Important Limits

- Manufacturer verification is not a physical spooling test. ReelCalc estimates still depend on published ratings, line diameters, and spooling conditions; existing uncertainty warnings remain active.
- The directory registry stays at its existing size until import is confirmed, preventing premature links to missing Squarespace pages.
- The remaining records are not included just to reach a number. The hold list identifies unresolved model codes, conflicting or incomplete specifications, and missing usable product photographs.

## Publication Status

The user imported the CSV into the existing Squarespace Reel Pages collection. All 43 expected public URLs returned the matching reel ID and model code. The collection already lists the imported guides; the shared registry activates them in the organized Setup Guides hub. See live-import-check.json and activation.json for the checks, and release-status.json for deployment verification.

## Held Reels

Many Daiwa records need model-identity cleanup, not merely another photograph. For example, the stored Tatula MQ records use older Tatula LT model codes, and the stored Certate HD sizes do not match the manufacturer lineup. Different generations, gearing suffixes, and spool sizes have not been silently substituted.

The Offshore Angler Salt Striker product chart and manufacturer manual disagree on bearing count (4+1 versus 5+1); their capacity tables were found. KastKing manuals were located, but they contain parts diagrams rather than the full required specification tables. Manufacturer clarification or additional exact-generation documentation is still needed for unresolved records.

| Reel | Stored model code | Why held |
| --- | --- | --- |
| Abu Garcia Beast Spinning 3000H | BST3000H | line_retrieve_in weight_oz Manufacturer verification still needed for weight_oz. Manufacturer verification still needed for line_retrieve_in. |
| Abu Garcia Beast Spinning 3500H | BST3500H | line_retrieve_in weight_oz Manufacturer verification still needed for weight_oz. Manufacturer verification still needed for line_retrieve_in. |
| Abu Garcia Beast Spinning 4000H | BST4000H | line_retrieve_in weight_oz Manufacturer verification still needed for weight_oz. Manufacturer verification still needed for line_retrieve_in. |
| Abu Garcia Beast Spinning 5000H | BST5000H | line_retrieve_in weight_oz Manufacturer verification still needed for weight_oz. Manufacturer verification still needed for line_retrieve_in. |
| Abu Garcia Zata Spinning 20 | ZATASP20 | Exact model code not matched in collected manufacturer sources. |
| Abu Garcia Zata Spinning 30 | ZATASP30 | Exact model code not matched in collected manufacturer sources. |
| Abu Garcia Zata Spinning 40 | ZATASP40 | Exact model code not matched in collected manufacturer sources. |
| Abu Garcia Jordan Lee Spinning 20 | JLEESP20 | Exact model code not matched in collected manufacturer sources. |
| Abu Garcia Jordan Lee Spinning 30 | JLEESP30 | Exact model code not matched in collected manufacturer sources. |
| Bass Pro Shops CatMaxx Spinning Reel large | CATMAXX-VERIFY | Exact model code not matched in collected manufacturer sources. |
| Bass Pro Shops Pro Qualifier Spinning Reel various | PQS-VERIFY | Exact model code not matched in collected manufacturer sources. |
| Offshore Angler Salt Striker Baitfeeder Spinning Reel 4000 | SST-4000 | Exact model code not matched in collected manufacturer sources. |
| Offshore Angler Salt Striker Baitfeeder Spinning Reel 6000 | SST-6000 | Exact model code not matched in collected manufacturer sources. |
| Offshore Angler Salt Striker Baitfeeder Spinning Reel 8000 | SST-8000 | Exact model code not matched in collected manufacturer sources. |
| Daiwa Revros LT 1000D | RVSLT1000D | Exact model code not matched in collected manufacturer sources. |
| Daiwa Revros LT 2000D | RVSLT2000D | Exact model code not matched in collected manufacturer sources. |
| Daiwa Revros LT 2500D-XH | RVSLT2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Revros LT 3000D-C | RVSLT3000D-C | Exact model code not matched in collected manufacturer sources. |
| Daiwa Revros LT 4000D-C | RVSLT4000D-C | Exact model code not matched in collected manufacturer sources. |
| Daiwa Revros LT 5000D-C | RVSLT5000D-C | Exact model code not matched in collected manufacturer sources. |
| Daiwa Revros LT 6000D | RVSLT6000D | Exact model code not matched in collected manufacturer sources. |
| Daiwa Regal LT 1000D | RGLT1000D | Exact model code not matched in collected manufacturer sources. |
| Daiwa Regal LT 2000D | RGLT2000D | Exact model code not matched in collected manufacturer sources. |
| Daiwa Regal LT 2500D-XH | RGLT2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Regal LT 3000D-C | RGLT3000D-C | Exact model code not matched in collected manufacturer sources. |
| Daiwa Regal LT 4000D-C | RGLT4000D-C | Exact model code not matched in collected manufacturer sources. |
| Daiwa Regal LT 5000D-C | RGLT5000D-C | Exact model code not matched in collected manufacturer sources. |
| Daiwa Regal LT 6000D | RGLT6000D | Exact model code not matched in collected manufacturer sources. |
| Daiwa Tatula MQ LT 1000D-XH | TALT1000D-XH | Stored SKU is for Tatula LT, but the record says Tatula MQ LT. Exact generation must be resolved. |
| Daiwa Tatula MQ LT 2000D-XH | TALT2000D-XH | Stored SKU is for Tatula LT, but the record says Tatula MQ LT. Exact generation must be resolved. |
| Daiwa Tatula MQ LT 2500D-XH | TALT2500D-XH | Stored SKU is for Tatula LT, but the record says Tatula MQ LT. Exact generation must be resolved. |
| Daiwa Tatula MQ LT 3000D-CXH | TALT3000D-CXH | Stored SKU is for Tatula LT, but the record says Tatula MQ LT. Exact generation must be resolved. |
| Daiwa Tatula MQ LT 4000D-CXH | TALT4000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Tatula Elite Spinning 3000D-CXH | TAEL3000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Procyon MQ LT 1000D-XH | PCNMQLT1000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Procyon MQ LT 2000D-XH | PCNMQLT2000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Procyon MQ LT 3000D-CXH | PCNMQLT3000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Procyon MQ LT 5000D-CXH | PCNMQLT5000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Ballistic MQ LT 1000D-XH | BALMQLT1000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Ballistic MQ LT 2000D-XH | BALMQLT2000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Ballistic MQ LT 2500D-XH | BALMQLT2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Ballistic MQ LT 3000D-CXH | BALMQLT3000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Ballistic MQ LT 4000D-CXH | BALMQLT4000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Ballistic MQ LT 5000D-CXH | BALMQLT5000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Sol MQ 3000D-CXH | SOLMQLT3000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Sol MQ 4000D-CXH | SOLMQLT4000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate 1000D-XH | CERTLT1000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate 2000D-XH | CERTLT2000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate 2500D-XH | CERTLT2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate 3000D-CXH | CERTLT3000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate 4000D-CXH | CERTLT4000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate 5000D-CXH | CERTLT5000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Luvias ST 1000D-XH | LUVST1000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Luvias ST 2000D-XH | LUVST2000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Luvias ST 2500D-XH | LUVST2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Exist 1000D-XH | EXIST1000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Exist 2000D-XH | EXIST2000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Exist 2500D-XH | EXIST2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Exist 3000D-CXH | EXIST3000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Exist 4000D-CXH | EXIST4000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Kage LT 2500D-XH | KGLT2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa BG MQ 5000D-CXH | BGMQ5000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa BG MQ 20000-H | BGMQ20000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist MQ 2500D-XH | SALTISTMQ2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist MQ 5000D-XH | SALTISTMQ5000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist MQ 20000-H | SALTISTMQ20000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist Back Bay LT 3000-CXH | STBLT3000-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist Back Bay LT 4000-CXH | STBLT4000-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate SW 5000-H | CERTSW5000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate SW 6000-H | CERTSW6000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate SW 8000-H | CERTSW8000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate SW 10000-H | CERTSW10000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate SW 14000-XH | CERTSW14000-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate SW 18000-H | CERTSW18000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate SW 20000-H | CERTSW20000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate HD 5000-H | CERTHD5000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate HD 6000-H | CERTHD6000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate HD 8000-H | CERTHD8000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate HD 10000-H | CERTHD10000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate HD 14000-XH | CERTHD14000-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate HD 18000-H | CERTHD18000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Certate HD 20000-H | CERTHD20000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltiga SW 5000-H | SALTIGA5000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltiga SW 6000-H | SALTIGA6000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltiga SW 8000-H | SALTIGA8000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltiga SW 10000-H | SALTIGA10000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltiga SW 14000-XH | SALTIGA14000-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltiga SW 18000-H | SALTIGA18000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltiga SW 20000-H | SALTIGA20000-H | Exact model code not matched in collected manufacturer sources. |
| KastKing Centron Spinning 1000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Brutus Spinning 2000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Brutus Spinning 3000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Brutus Spinning 4000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Brutus Spinning 5000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Valiant Eagle Spinning 1000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Valiant Eagle Spinning 2000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Valiant Eagle Spinning 3000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Valiant Eagle Spinning 4000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Crixus Spinning 2000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Crixus Spinning 3000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Crixus Spinning 4000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Pontus Baitfeeder 3000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Pontus Baitfeeder 4000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| KastKing Pontus Baitfeeder 5000 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| Lew's KVD Elite Spinning Reel 200 | KVD200G2 | data_warnings: Lew's current product table and 2026 manufacturer guide disagree on mono capacity; current product-page value retained pending manufacturer clarification. |
| Lew's KVD Elite Spinning Reel 300 | KVD300G2 | data_warnings: Lew's current product table and 2026 manufacturer guide disagree on mono capacity; current product-page value retained pending manufacturer clarification. |
| Lew's KVD Elite Spinning Reel 300 Shallow | KVDSS300G2 | Exact model code not matched in collected manufacturer sources. |
| Lew's American Hero Camo Spinning Reel 200 | AHC200G2C | Exact model code not matched in collected manufacturer sources. |
| Lew's Crappie Thunder Spinning Reel 75 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| Lew's Crappie Thunder Spinning Reel 100 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| Lew's Crappie Thunder Spinning Reel 200 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| Okuma Avenger B 14000 | AV-14000B | Exact model code not matched in collected manufacturer sources. |
| Okuma ROX 1000 | ROX-1000A | weight_oz Manufacturer verification still needed for weight_oz. |
| Okuma ROX 3000 | ROX-3000A | weight_oz Manufacturer verification still needed for weight_oz. |
| Okuma ROX 4000 | ROX-4000A | weight_oz data_warnings: Official Okuma ROX 4000 braid table contains an internally inconsistent 190/12 row; that row is excluded until Okuma clarifies it. Manufacturer verification still needed for weight_oz. |
| Quantum Optix 10 | OP10 | Exact model code not matched in collected manufacturer sources. |
| Quantum Optix 20 | OP20 | Exact model code not matched in collected manufacturer sources. |
| Quantum Optix 30 | OP30D.CP2 | Exact model code not matched in collected manufacturer sources. |
| Quantum Optix 40 | OP40 | Exact model code not matched in collected manufacturer sources. |
| Quantum Optix 80 | OP80D.CP2 | Exact model code not matched in collected manufacturer sources. |
| Shimano Nexave FI 1000 | NEX1000FI | Shimano product and Fishshop tables disagree on mono 4 lb and braid 15 lb capacities. Manufacturer clarification is needed. |
| Shimano Nexave FJ 4000HG | NEX4000HGFJ | Stored braid ratings were not recovered from the manufacturer source; verify before removing them. |
| Shimano IX 2000R | IX2000R | Shimano product and Fishshop tables disagree on the PowerPro capacity ratings. Manufacturer clarification is needed. |
| Shimano Stella SW D 8000PG | STLSW8000PGD | No verified mono reference; braid-only record needs separate display review. |
| Shimano Stella SW D 8000HG | STLSW8000HGD | No verified mono reference; braid-only record needs separate display review. |
