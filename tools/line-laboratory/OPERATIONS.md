# Line Laboratory daily update

## Scope and schedule

- Optional choices in the Setup Wizard, reel-page calculators and reel comparison only.
- Manufacturer choices remain the default; no formula, reel anchor or recommendation changes.
- GitHub Actions workflow: `line-laboratory-sync.yml`, daily at 09:23 UTC, plus manual Run workflow.
- Runs on GitHub, not Tyler's desktop. GitHub schedules can be delayed; updates are not instant.
- The current public feed supplies braid only. Do not invent a mono endpoint.

## Safe update policy

1. Fetch the fixed public endpoint with timeout, response-size, JSON/schema, positive-number and supported-diameter checks.
2. Add valid new raw brand/name/rated-strength identities, assigning persistent ReelCalc IDs. No matching against the manufacturer catalog.
3. Preserve existing IDs, source data and measurements. Changed measurements and missing rows are held and reported, never silently replaced or deleted. Exact duplicate identities or invalid feeds stop the entire update.
4. Run importer and three-calculator integration tests before and after synchronization.
5. Commit only the catalog, using a normal fast-forward push. A concurrent main-branch change makes publication fail safely; rerun against the new main branch rather than force-pushing.
6. Explicitly request a legacy GitHub Pages build when needed. A bot-token commit alone does not trigger that build. Check that the public catalog and release settings match the repository; retry a previously unpublished catalog even on a no-change sync.

The public API does not provide permanent IDs, variant identifiers or correction dates. A rename is not assumed to be the same test. Ask the provider for stable IDs before automating measurement corrections.

## Monitoring

Open GitHub Actions > Update Line Laboratory catalog. Each run provides a summary and a 90-day artifact with the public feed, hash receipt and `sync-report.json`. New entries also retain their raw API fields/hash in the versioned catalog.

Failures and held records make the run fail visibly without overwriting accepted measurements. GitHub email notifications depend on the repository owner's Actions notification preferences; do not assume email is enabled. GitHub can disable scheduled workflows in a public repository after 60 days without repository activity. Check/re-enable the workflow if that occurs. No changes are manufactured just to avoid that rule.

For held corrections, inspect the report and provider evidence, preserve the original provenance in history, then make an explicitly reviewed update. Re-run the workflow after resolving the hold.

## Rollback

Set `enabled` to false in `data/line-laboratory-release.json` and deploy to hide the optional source. Existing manufacturer selections still work. Explicit laboratory links display unavailability rather than silently changing diameter.

To undo a bad catalog release, restore the catalog from its last good Git revision in a new commit; never reset or force-push shared history. Disable the scheduled workflow while investigating if necessary. Do not regenerate the registry IDs.

## Local checks

`node tools/line-laboratory/test-sync.mjs`

`node tools/line-laboratory/test.mjs`

`node tools/line-laboratory/sync-api.mjs --output <directory-outside-site>` is a read-only rehearsal. Add `--write` only to update the local catalog. Publication is a separate workflow step.
