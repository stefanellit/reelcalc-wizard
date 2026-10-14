import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectFeed, endpoint } from "./inspect-api.mjs";
import sources from "../../js/line-sources.js";

export const method = "line-laboratory-api-average";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serial = value => JSON.stringify(value, null, 2) + "\n";
const key = row => JSON.stringify([row.Brand, row.Name, row.RatedStrength]);

// IDs are ReelCalc-owned registry IDs, not IDs supplied by the laboratory.
// Exact raw identities alone can be reused; renames are never guessed or merged.
export function prepareApi(text, current, observedAt, { holdChanged = false } = {}) {
  inspectFeed(text, observedAt);
  const rows = JSON.parse(text);
  if (!rows.length) throw new Error("Empty feed: existing data retained");
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  const existing = current.records || [];
  const byKey = new Map(), ids = new Set();
  for (const record of existing) {
    sources.validateRecord(record, [method]);
    if (ids.has(record.source_record_id)) throw new Error("Duplicate catalog ID");
    ids.add(record.source_record_id);
    if (!record.api_provenance?.raw) throw new Error("Existing record lacks API registry provenance");
    const identity = key(record.api_provenance.raw);
    if (byKey.has(identity)) throw new Error("Ambiguous existing API identity");
    byKey.set(identity, record);
  }
  const seen = new Set(), records = [], review = [];
  for (const row of rows) {
    const identity = key(row);
    if (seen.has(identity)) throw new Error("Duplicate raw API identity; manual review required");
    seen.add(identity);
    const old = byKey.get(identity);
    if (old) {
      if (old.quoted_diameter?.value !== row.QuotedDiameter || old.diameters[0].value !== row.AverageDiameter) {
        if (!holdChanged) throw new Error("Changed measurement requires review; existing data retained: " + identity);
        review.push({ id: old.source_record_id, reason: "Changed measurement; original retained pending review", incoming: row });
      }
      records.push(old);
      continue;
    }
    const record = {
      source_record_id: "rc-api-" + crypto.randomUUID(),
      original_name: row.Brand + " " + row.Name, brand: row.Brand, product: row.Name,
      variant: "Not separately supplied", material: "Braid",
      rated_strength: { value: row.RatedStrength, unit: "lb", label: row.RatedStrength + " lb" },
      quoted_diameter: { value: row.QuotedDiameter, unit: "mm" },
      diameters: [{ method_id: method, value: row.AverageDiameter, unit: "mm" }],
      capacity_method_id: method, source_url: "https://linelaboratory.com/braid-summary/",
      updated_at: observedAt, status: "active",
      api_provenance: { endpoint, raw: row, snapshot_sha256: hash, observed_at: observedAt,
        id_origin: "reelcalc_local_registry", updated_at_basis: "local_import_not_source_test_date",
        units_evidence: "https://linelaboratory.com/braid-summary/",
        measurement_definition: "AverageDiameter as supplied by API; not a derived packing diameter" }
    };
    sources.validateRecord(record, [method]);
    records.push(record);
  }
  for (const old of existing) if (!seen.has(key(old.api_provenance.raw))) {
    records.push(old); review.push({ id: old.source_record_id, reason: "Missing from feed; retained, not renamed or deleted" });
  }
  records.sort((a, b) => a.source_record_id.localeCompare(b.source_record_id));
  const changed = serial(records) !== serial(existing);
  return { changed, review, data: changed ? { schemaVersion: 1, source: sources.SOURCE,
    lastSuccessfulSync: observedAt, records } : current };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const snapshot = process.argv[2];
  if (!snapshot) throw new Error("Provide the saved API snapshot directory");
  const text = await fs.readFile(path.join(snapshot, "api-response.json"), "utf8");
  const report = JSON.parse(await fs.readFile(path.join(snapshot, "inspection.json"), "utf8"));
  if (report.endpoint !== endpoint || report.feedSha256 !== crypto.createHash("sha256").update(text).digest("hex")) throw new Error("Snapshot receipt does not match API response");
  const observedAt = report.observedAt || report.observed_at;
  if (!observedAt) throw new Error("Snapshot observation timestamp missing");
  const target = path.join(root, "data/line-laboratory.json");
  const before = await fs.readFile(target, "utf8");
  const result = prepareApi(text, JSON.parse(before), observedAt);
  if (process.argv.includes("--write") && result.changed) {
    if (await fs.readFile(target, "utf8") !== before) throw new Error("Catalog changed during preparation");
    await fs.writeFile(target + ".tmp", serial(result.data), { flag: "wx" });
    await fs.rename(target + ".tmp", target);
  }
  console.log(JSON.stringify({ records: result.data.records.length, changed: result.changed,
    written: process.argv.includes("--write") && result.changed, review: result.review, releaseSettingsChanged: false }));
}
