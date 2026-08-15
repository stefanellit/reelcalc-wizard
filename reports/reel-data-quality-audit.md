# Reel Data Quality Audit

Generated: 2026-08-15T13:04:40.218Z

## Scope And Honesty Note

This automated pass validates structure, provenance, internal consistency, and risk signals. It does not claim that every stored specification was independently confirmed from a current manufacturer page.

## Summary

- Total reels: **836**
- Clean in this automated pass: **384**
- Review: **430**
- High-priority review: **6**
- Calculation blocked: **16**
- Duplicate ID groups: **0**
- Duplicate SKU groups: **7**

## Coverage By Brand

| Brand | Total | Clean | Review | High priority | Blocked |
| --- | ---: | ---: | ---: | ---: | ---: |
| Abu Garcia | 45 | 0 | 45 | 0 | 0 |
| Bass Pro Shops | 24 | 14 | 9 | 0 | 1 |
| Daiwa | 172 | 37 | 135 | 0 | 0 |
| KastKing | 67 | 34 | 18 | 0 | 15 |
| Lew's | 49 | 4 | 42 | 3 | 0 |
| Offshore Angler | 19 | 12 | 7 | 0 | 0 |
| Okuma | 96 | 76 | 19 | 1 | 0 |
| PENN | 91 | 44 | 47 | 0 | 0 |
| Pflueger | 29 | 5 | 24 | 0 | 0 |
| Quantum | 61 | 1 | 58 | 2 | 0 |
| Shimano | 183 | 157 | 26 | 0 | 0 |

## Issue Counts

| Check | Records |
| --- | ---: |
| data_warning | 286 |
| provenance_requires_review | 172 |
| missing_weight_oz | 160 |
| missing_line_retrieve_in | 88 |
| secondary_source | 66 |
| missing_max_drag_lb | 63 |
| missing_gear_ratio | 57 |
| missing_bearings | 54 |
| braid_anchor_recommendation_gap | 41 |
| missing_sku | 18 |
| missing_calculator_capacity | 16 |
| placeholder_or_verification_text | 16 |
| source_conflict | 6 |

## Priority Review Queue

| Reel | SKU | Status | Reasons | Source |
| --- | --- | --- | --- | --- |
| Bass Pro Shops Pro Qualifier Spinning Reel various | PQS-VERIFY | blocked | placeholder_or_verification_text, missing_calculator_capacity | basspro.com |
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
