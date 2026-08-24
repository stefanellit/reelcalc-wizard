# Reel Data Quality Audit

Generated: 2026-08-24T01:07:41.792Z

## Scope And Honesty Note

This automated pass validates structure, provenance, internal consistency, and risk signals. It does not claim that every stored specification was independently confirmed from a current manufacturer page.

## Summary

- Total reels: **1336**
- Clean in this automated pass: **841**
- Review: **444**
- High-priority review: **35**
- Calculation blocked: **16**
- Duplicate ID groups: **0**
- Duplicate SKU groups: **9**

## Coverage By Brand

| Brand | Total | Clean | Review | High priority | Blocked |
| --- | ---: | ---: | ---: | ---: | ---: |
| Abu Garcia | 108 | 60 | 48 | 0 | 0 |
| Bass Pro Shops | 24 | 14 | 9 | 0 | 1 |
| Daiwa | 341 | 175 | 144 | 22 | 0 |
| KastKing | 74 | 41 | 18 | 0 | 15 |
| Lew's | 122 | 77 | 42 | 3 | 0 |
| Mach | 8 | 8 | 0 | 0 | 0 |
| Offshore Angler | 19 | 12 | 7 | 0 | 0 |
| Okuma | 133 | 113 | 19 | 1 | 0 |
| PENN | 91 | 44 | 47 | 0 | 0 |
| Penn | 9 | 9 | 0 | 0 | 0 |
| Pflueger | 36 | 12 | 24 | 0 | 0 |
| Quantum | 61 | 1 | 58 | 2 | 0 |
| SEVIIN | 16 | 16 | 0 | 0 | 0 |
| Shimano | 294 | 259 | 28 | 7 | 0 |

## Issue Counts

| Check | Records |
| --- | ---: |
| data_warning | 286 |
| provenance_requires_review | 172 |
| missing_weight_oz | 160 |
| secondary_source | 97 |
| missing_line_retrieve_in | 88 |
| missing_max_drag_lb | 63 |
| missing_gear_ratio | 57 |
| missing_bearings | 54 |
| braid_anchor_recommendation_gap | 45 |
| unparsed_braid_capacity | 29 |
| missing_sku | 18 |
| missing_calculator_capacity | 16 |
| placeholder_or_verification_text | 16 |
| source_conflict | 6 |
| resolved_source_discrepancy | 1 |

## Priority Review Queue

| Reel | SKU | Status | Reasons | Source |
| --- | --- | --- | --- | --- |
| Bass Pro Shops Pro Qualifier Spinning Reel various | PQS-VERIFY | blocked | placeholder_or_verification_text, missing_calculator_capacity | basspro.com |
| Daiwa 22 Zillion TW HD 1000 1000H | 4550133215643 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 22 Zillion TW HD 1000 1000HL | 4550133215650 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 22 Zillion TW HD 1000 1000XH | 4550133215667 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 22 Zillion TW HD 1000 1000XHL | 4550133215674 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 24 Steez SV TW 100 100 | 4550133344299 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 24 Steez SV TW 100 100H | 4550133344312 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 24 Steez SV TW 100 100HL | 4550133344329 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 24 Steez SV TW 100 100L | 4550133344305 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 24 Steez SV TW 100 100XH | 4550133344336 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 24 Steez SV TW 100 100XHL | 4550133344343 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 25 Alphas BF TW 6.3L | 4550133256417 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 25 Alphas BF TW 6.3R | 4550133256400 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 25 Alphas BF TW 8.5L | 4550133256431 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 25 Alphas BF TW 8.5R | 4550133256424 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 26 Ryoga 150H | 4550133217272 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 26 Ryoga 150HL | 4550133217289 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 26 Ryoga 150P | 4550133217258 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 26 Ryoga 150PL | 4550133217265 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 26 Ryoga SV 100 | 4550133217234 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 26 Ryoga SV 100L | 4550133217241 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 26 Ryoga SV 100P | 4550133217210 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| Daiwa 26 Ryoga SV 100PL | 4550133217227 | high_priority_review | unparsed_braid_capacity | daiwa.com |
| KastKing Brutus Spinning 2000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Brutus Spinning 3000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Brutus Spinning 4000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Brutus Spinning 5000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Centron Spinning 1000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Crixus Spinning 2000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Crixus Spinning 3000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Crixus Spinning 4000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Pontus Baitfeeder 3000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Pontus Baitfeeder 4000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Pontus Baitfeeder 5000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Valiant Eagle Spinning 1000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Valiant Eagle Spinning 2000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Valiant Eagle Spinning 3000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| KastKing Valiant Eagle Spinning 4000 | missing | blocked | placeholder_or_verification_text, missing_calculator_capacity | kastking.com |
| Lew's KVD Elite Spinning Reel 200 | KVD200G2 | high_priority_review | source_conflict | lews.com |
| Lew's KVD Elite Spinning Reel 300 | KVD300G2 | high_priority_review | source_conflict | lews.com |
| Lew's KVD Elite Spinning Reel 300 Shallow | KVDSS300G2 | high_priority_review | source_conflict | core-prod.lews.com |
| Okuma ROX 4000 | ROX-4000A | high_priority_review | source_conflict | okumafishingusa.com |
| Quantum Optix 20 | OP20 | high_priority_review | source_conflict | quantumfishing.com |
| Quantum Optix 40 | OP40 | high_priority_review | source_conflict | quantumfishing.com |
| Shimano Aldebaran DC 30HG | 047830 | high_priority_review | unparsed_braid_capacity | fish.shimano.com |
| Shimano Aldebaran DC 30XG | 047854 | high_priority_review | unparsed_braid_capacity | fish.shimano.com |
| Shimano Aldebaran DC 31HG | 047847 | high_priority_review | unparsed_braid_capacity | fish.shimano.com |
| Shimano Aldebaran DC 31XG | 047861 | high_priority_review | unparsed_braid_capacity | fish.shimano.com |
| Shimano Vanquish 1000SSSPG | 1000SSSPG | high_priority_review | unparsed_braid_capacity | fish.shimano.com |
| Shimano Vanquish CE 1000SSS | 1000SSS | high_priority_review | unparsed_braid_capacity | fish.shimano.com |
| Shimano Vanquish CE 1000SSSPG | 1000SSSPG | high_priority_review | unparsed_braid_capacity | fish.shimano.com |
