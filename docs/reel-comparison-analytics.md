# Reel Comparison Analytics

The general comparison tool remains canonical at:

`https://www.reelcalc.com/reel-comparison`

Shared URLs use stable reel IDs in `reel1` and `reel2`. The order-independent
`comparison_pair_id` sorts those two IDs and joins them with `__vs__`.

## GA4 events

- `reel_comparison_completed`
- `reel_comparison_reel_1_selected`
- `reel_comparison_reel_2_selected`
- `reel_comparison_link_copied`
- `reel_comparison_reset`
- `reel_comparison_reel_page_clicked`
- `reel_comparison_wizard_clicked`
- `reel_comparison_amazon_clicked`

## GA4 custom dimensions

Create event-scoped custom dimensions for:

| Dimension name | Event parameter |
| --- | --- |
| Comparison pair ID | `comparison_pair_id` |
| Comparison reel 1 ID | `reel_1_id` |
| Comparison reel 2 ID | `reel_2_id` |

Optional event-scoped dimensions that make filtering easier:

| Dimension name | Event parameter |
| --- | --- |
| Comparison source | `comparison_source` |
| Comparison same brand | `same_brand` |
| Comparison same family | `same_family` |
| Comparison same size | `same_size` |

After GA4 begins collecting these parameters, use an Exploration with
`Event name` filtered to `reel_comparison_completed`, rows set to
`Comparison pair ID`, and values set to `Event count` and `Total users`.
Add click or copy event counts in separate tabs or filters to measure deeper
engagement for the same pair IDs.
