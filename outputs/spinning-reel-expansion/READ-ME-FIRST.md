# Spinning Reel Page Import

Ready: **247 new spinning-reel pages**. Held for more research: **168**. The requested 415-page expansion is not fully complete.

## Import Steps

1. In Squarespace, open the same product CSV import screen used for the earlier reel pages.
2. Import **UPLOAD-THIS-247-new-spinning-reel-pages.csv** once. Use the existing **reel-pages** collection, not a new store or collection.
3. Do not change the CSV headers, product type, tags, IDs, or zero-price import fields. Those fields are required for the existing guide-page setup; the shared loader hides shopping controls and prices from readers.
4. Wait for the import confirmation. The expected addition is 247 items. Do not import the file a second time.
5. Tell Codex the import is complete. The next step is checking the live pages and activating their links in the organized guide directory and other selectors.

## What Is Included

- Abu Garcia: 36
- Bass Pro Shops: 4
- Offshore Angler: 4
- Daiwa: 51
- Lew's: 35
- Okuma: 8
- PENN: 36
- Pflueger: 24
- Quantum: 49

## Checks

- Built with the existing shared reel-page generator, calculator engine, styling, line links, and affiliate system. No separate calculator or copied old template.
- Exact model-code matching against manufacturer product tables or manufacturer-authored catalogs; supplemental catalog item numbers used where model labels differ.
- Published mono and braid ratings reconciled against the page tables and calculator parser.
- 2,964 capacity/backing/overfill scenarios passed, plus unit-conversion and rating round-trip checks.
- All 919 existing pages retain their specifications, calculators, real-world-test links, and aliases. Their introductions now use the same plainer wording as the new pages.
- CSV checked for 28 native columns, unique URLs and SKUs, blank product IDs, correct tags, and valid imported HTML.
- Desktop and 390px phone-width imported-content previews tested, including line selection, capacity, backing, affiliate links, and disclosure.
- Manufacturer images optimized without changing the reels shown. Some older catalog photographs are lower resolution than current product photographs.
- The older line-selector regression test already fails on the unchanged baseline because it expects 903 lines instead of the current 1,099. That unrelated test was not changed; the dedicated expansion audit and capacity integrity/calibration tests passed.

## Important Limits

- Manufacturer verification is not a physical spooling test. ReelCalc estimates still depend on published ratings, line diameters, and spooling conditions; existing uncertainty warnings remain active.
- The directory registry stays at its existing size until import is confirmed, preventing premature links to missing Squarespace pages.
- The remaining records are not included just to reach a number. The hold list identifies unresolved model codes, conflicting or incomplete specifications, and missing usable product photographs.

## Not Yet Imported

Nothing in this process imports items into Squarespace. The supporting GitHub assets must be deployed before the file is imported; see release-status.json for deployment verification.

## Held Reels

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
| Bass Pro Shops Johnny Morris CarbonLite Tech Spinning Reel 1500 | JCTT1500 | Exact model code not matched in collected manufacturer sources. |
| Bass Pro Shops Johnny Morris CarbonLite Tech Spinning Reel 3000 | JCTT3000 | Exact model code not matched in collected manufacturer sources. |
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
| Daiwa Tatula Elite Spinning 2500D-XH | TAEL2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Tatula Elite Spinning 3000D-CXH | TAEL3000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Tatula Elite Spinning 4000D-CXH | TAEL4000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Procyon MQ LT 1000D-XH | PCNMQLT1000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Procyon MQ LT 2000D-XH | PCNMQLT2000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Procyon MQ LT 2500D-XH | PCNMQLT2500D-XH | Verified product image still needed. |
| Daiwa Procyon MQ LT 3000D-CXH | PCNMQLT3000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Procyon MQ LT 4000D-CXH | PCNMQLT4000D-CXH | Verified product image still needed. |
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
| Daiwa Kage LT 1000D-XH | KGLT1000D-XH | Verified product image still needed. |
| Daiwa Kage LT 2000D-XH | KGLT2000D-XH | Verified product image still needed. |
| Daiwa Kage LT 2500D-XH | KGLT2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa BG MQ 5000D-CXH | BGMQ5000D-CXH | Exact model code not matched in collected manufacturer sources. |
| Daiwa BG MQ 20000-H | BGMQ20000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist MQ 2500D-XH | SALTISTMQ2500D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist MQ 5000D-XH | SALTISTMQ5000D-XH | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist MQ 8000-H | SALTISTMQ8000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist MQ 10000-H | SALTISTMQ10000-H | Exact model code not matched in collected manufacturer sources. |
| Daiwa Saltist MQ 14000-H | SALTISTMQ14000-H | Exact model code not matched in collected manufacturer sources. |
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
| Lew's KVD Spinning Reel 200 | KVD200 | Verified product image still needed. |
| Lew's KVD Spinning Reel 300 | KVD300 | Verified product image still needed. |
| Lew's KVD Spinning Reel 400 | KVD400 | Verified product image still needed. |
| Lew's MACH 1 Spinning Reel 100 | MH100A | Exact model code not matched in collected manufacturer sources. |
| Lew's MACH 1 Spinning Reel 200 | MH200A | Exact model code not matched in collected manufacturer sources. |
| Lew's MACH 1 Spinning Reel 300 | MH300A | Exact model code not matched in collected manufacturer sources. |
| Lew's American Hero Camo Spinning Reel 200 | AHC200G2C | Exact model code not matched in collected manufacturer sources. |
| Lew's American Hero Tier 1 Spinning Reel 200 | T1-200 | Verified product image still needed. |
| Lew's Crappie Thunder Spinning Reel 75 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| Lew's Crappie Thunder Spinning Reel 100 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| Lew's Crappie Thunder Spinning Reel 200 | Not recorded | Exact model code not matched in collected manufacturer sources. |
| Okuma Avenger B 14000 | AV-14000B | Exact model code not matched in collected manufacturer sources. |
| Okuma ROX 1000 | ROX-1000A | weight_oz Manufacturer verification still needed for weight_oz. |
| Okuma ROX 3000 | ROX-3000A | weight_oz Manufacturer verification still needed for weight_oz. |
| Okuma ROX 4000 | ROX-4000A | weight_oz data_warnings: Official Okuma ROX 4000 braid table contains an internally inconsistent 190/12 row; that row is excluded until Okuma clarifies it. Manufacturer verification still needed for weight_oz. |
| Okuma Azores Blue 4000 | Z-4000H-BLUE | weight_oz Manufacturer verification still needed for weight_oz. |
| Okuma Azores Blue 6000 | Z-6000H-BLUE | weight_oz Manufacturer verification still needed for weight_oz. |
| Okuma Azores Blue 8000 | Z-8000H-BLUE | weight_oz Manufacturer verification still needed for weight_oz. |
| Okuma Azores Blue 14000 | Z-14000H-BLUE | weight_oz Manufacturer verification still needed for weight_oz. |
| Quantum Benchmark 2500 | BM2500.B2 | Exact model code not matched in collected manufacturer sources. |
| Quantum Benchmark 3000 | BM3000.B2 | Exact model code not matched in collected manufacturer sources. |
| Quantum Benchmark 4000 | BM4000.B2 | Exact model code not matched in collected manufacturer sources. |
| Quantum Benchmark 5000 | BM5000.B2 | Exact model code not matched in collected manufacturer sources. |
| Quantum Benchmark 6000 | BM6000.B2 | Exact model code not matched in collected manufacturer sources. |
| Quantum Benchmark 8000 | BM8000.B2 | Exact model code not matched in collected manufacturer sources. |
| Quantum Optix 10 | OP10 | Exact model code not matched in collected manufacturer sources. |
| Quantum Optix 20 | OP20 | Exact model code not matched in collected manufacturer sources. |
| Quantum Optix 30 | OP30D.CP2 | Exact model code not matched in collected manufacturer sources. |
| Quantum Optix 40 | OP40 | Exact model code not matched in collected manufacturer sources. |
| Quantum Optix 80 | OP80D.CP2 | Exact model code not matched in collected manufacturer sources. |
| Quantum Smoke X 25 | SMX25XPT.BX3 | Exact model code not matched in collected manufacturer sources. |
| Shimano Nexave FI 1000 | NEX1000FI | HTTP 403 |
| Shimano Nexave FI 2500HG | NEX2500HGFI | HTTP 403 |
| Shimano Nexave FI C3000HG | NEXC3000HGFI | HTTP 403 |
| Shimano Nexave FI 4000HG | NEX4000HGFI | HTTP 403 |
| Shimano Nexave FI C5000HG | NEXC5000HGFI | HTTP 403 |
| Shimano Nexave FJ 4000HG | NEX4000HGFJ | Stored braid ratings were not recovered from the manufacturer source; verify before removing them. |
| Shimano Twin Power XD FB C3000XG | TPXDC3000XGFB | HTTP 403 |
| Shimano Twin Power XD FB 4000XG | TPXD4000XGFB | HTTP 403 |
| Shimano Twin Power XD FB C5000XG | TPXDC5000XGFB | HTTP 403 |
| Shimano Exsence A C3000MHG | EXSC3000MHGA | HTTP 403 |
| Shimano Exsence A 4000MXG | EXS4000MXGA | HTTP 403 |
| Shimano IX 1000R | IX1000R | No verified mono reference; braid-only record needs separate display review. |
| Shimano IX 2000R | IX2000R | No verified mono reference; braid-only record needs separate display review. |
| Shimano IX 4000R | IX4000R | No verified mono reference; braid-only record needs separate display review. |
| Shimano Spheros SW A 14000XG | SPSW14000XGA | data_warnings: Printed capacity entries vary more than expected with the calculator diameter lookup. |
| Shimano Saragosa SW A 14000XG | SRG14000SWAXG | data_warnings: Printed capacity entries vary more than expected with the calculator diameter lookup. |
| Shimano Stella SW D 8000PG | STLSW8000PGD | No verified mono reference; braid-only record needs separate display review. |
| Shimano Stella SW D 8000HG | STLSW8000HGD | No verified mono reference; braid-only record needs separate display review. |
| Shimano Stella SW D 14000XG | STLSW14000XGD | data_warnings: Printed capacity entries vary more than expected with the calculator diameter lookup. |
