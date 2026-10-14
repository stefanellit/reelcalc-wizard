import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { syncApi } from "./sync-api.mjs";

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "reelcalc-auto-sync-"));
const dataFile = path.join(temp, "catalog.json");
const data = JSON.parse(await fs.readFile(new URL("../../data/line-laboratory.json", import.meta.url), "utf8"));
const rows = data.records.map(r => r.api_provenance.raw);
const response = body => async () => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
let n = 0;
const run = fetchImpl => syncApi({ directory: path.join(temp, "run-" + n++), dataFile, write: true, fetchImpl });
try {
  await fs.writeFile(dataFile, JSON.stringify(data));
  const original = await fs.readFile(dataFile, "utf8");
  assert.equal((await run(response(rows))).written, false);
  assert.equal(await fs.readFile(dataFile, "utf8"), original);
  for (const invalid of [[], [rows[0], rows[0]], [{ ...rows[0], AverageDiameter: -1 }], [{ ...rows[0], ExtraField: true }]]) {
    await assert.rejects(run(response(invalid)));
    assert.equal(await fs.readFile(dataFile, "utf8"), original);
  }
  await assert.rejects(run(async () => { throw new Error("offline"); }));
  await assert.rejects(run(async () => new Response("unavailable", { status: 503 })));
  await assert.rejects(run(async () => new Response("[]", { headers: { "Content-Type": "text/html" } })));
  assert.equal(await fs.readFile(dataFile, "utf8"), original);
  const missing = await run(response(rows.slice(1)));
  assert.equal(missing.written, false);
  assert.equal(missing.review.length, 1);
  assert.equal(await fs.readFile(dataFile, "utf8"), original);
  const updated = structuredClone(rows);
  updated[0].AverageDiameter += .001;
  const changed = await run(response(updated));
  assert.equal(changed.written, false);
  assert.equal(changed.review.length, 1);
  assert.equal(await fs.readFile(dataFile, "utf8"), original);
  // A new valid line can publish while a changed existing measurement stays held.
  updated.push({ Brand: "SYNTHETIC TEST ONLY", Name: "NOT A REAL LINE", RatedStrength: 20, QuotedDiameter: .2, AverageDiameter: .25 });
  const addition = await run(response(updated));
  assert.equal(addition.written, true);
  assert.equal(addition.added.length, 1);
  assert.equal(addition.review.length, 1);
  const saved = JSON.parse(await fs.readFile(dataFile, "utf8"));
  for (const old of data.records) assert.deepEqual(saved.records.find(r => r.source_record_id === old.source_record_id), old);
  assert.equal((await run(response(updated))).written, false);
  assert.equal((await run(response(rows))).records, data.records.length + 1);
  assert.equal(JSON.parse(await fs.readFile(dataFile, "utf8")).records.length, data.records.length + 1);
  console.log("PASS scheduled sync: additions, stable IDs, changed/missing holds, repeat no-op, failed/empty/duplicate/schema/invalid feed preservation");
} finally { await fs.rm(temp, { recursive: true, force: true }); }
