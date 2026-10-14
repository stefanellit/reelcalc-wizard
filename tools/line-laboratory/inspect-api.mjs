import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

export const endpoint = "https://linelaboratory.com/api/v1/braid/diameters/";
const fields = ["Brand", "Name", "RatedStrength", "QuotedDiameter", "AverageDiameter"];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sha = text => crypto.createHash("sha256").update(text).digest("hex");

// This is a staging inspection, not an importer. Missing identity metadata is not invented.
export function inspectFeed(text, observedAt = new Date().toISOString()) {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows) || !rows.length) throw new Error("EMPTY_OR_INVALID_FEED");
  if (rows.length > 50000) throw new Error("FEED_TOO_LARGE");
  const issues = [], groups = new Map();
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row) ||
        Object.keys(row).length !== fields.length || fields.some(key => !Object.hasOwn(row, key))) {
      throw new Error("API_SCHEMA_CHANGED");
    }
    for (const key of ["Brand", "Name"]) {
      if (typeof row[key] !== "string" || !row[key].trim() || row[key].length > 1000 || /[\u0000-\u001f]/.test(row[key])) throw new Error("INVALID_NAME");
    }
    for (const key of ["RatedStrength", "QuotedDiameter", "AverageDiameter"]) {
      if (typeof row[key] !== "number" || !Number.isFinite(row[key]) || row[key] <= 0) throw new Error("INVALID_MEASUREMENT");
    }
    // Candidate keys are review labels only, never persistent test IDs or automatic matches.
    const key = JSON.stringify([row.Brand, row.Name, row.RatedStrength]);
    groups.set(key, [...(groups.get(key) || []), index + 1]);
    if (row.Brand !== row.Brand.trim() || row.Name !== row.Name.trim()) issues.push({ row: index + 1, issue: "surrounding_whitespace_preserved" });
    if (/AliExpress/i.test(row.Brand)) issues.push({ row: index + 1, issue: "seller_qualified_identity_do_not_merge_with_named_manufacturer" });
    if (row.AverageDiameter < row.QuotedDiameter) issues.push({ row: index + 1, issue: "measured_smaller_than_quoted_review_only" });
  });
  const duplicateIdentities = [...groups].filter(([, indices]) => indices.length > 1).map(([key, rows]) => ({ key, rows }));
  return {
    schemaVersion: 1, status: "staged_not_calculator_ready", endpoint, observedAt,
    feedSha256: sha(text), rowCount: rows.length, brandLabels: new Set(rows.map(row => row.Brand)).size,
    fields, duplicateIdentities, issues,
    unitEvidence: { url: "https://linelaboratory.com/braid-summary/", strength: "Rated (lb)", diameter: "Measured (mm)",
      note: "Units checked against public table labels; the API itself has no unit fields." },
    missingMetadata: ["permanent test ID", "sample variant / market / color where relevant", "measurement-method definition for AverageDiameter", "test/update timestamp", "individual test URL"],
    releaseBlockers: ["Agree a stable identity/update strategy", "Verify exact product/strength/variant matches", "Confirm AverageDiameter definition and use as optional capacity input"],
    rows
  };
}

export async function captureFeed(directory, fetchImpl = fetch) {
  const out = path.resolve(directory);
  await fs.mkdir(out, { recursive: true });
  const realOut = await fs.realpath(out), realRoot = await fs.realpath(root);
  const relative = path.relative(realRoot, realOut);
  if (!relative || (!relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))) throw new Error("STAGING_MUST_BE_OUTSIDE_SITE");
  const response = await fetchImpl(endpoint, { redirect: "error", signal: AbortSignal.timeout(20000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("API_HTTP_ERROR");
  if (!/application\/json/i.test(response.headers.get("content-type") || "")) throw new Error("API_NOT_JSON");
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 10_000_000) throw new Error("FEED_TOO_LARGE");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  const report = inspectFeed(text);
  const folder = path.join(realOut, report.observedAt.replace(/[:.]/g, "-") + "-" + report.feedSha256.slice(0, 12));
  await fs.mkdir(folder);
  await fs.writeFile(path.join(folder, "api-response.json"), text, { flag: "wx" });
  await fs.writeFile(path.join(folder, "inspection.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  const { rows, ...summary } = report;
  return { ...summary, folder };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== "--output") throw new Error("OUTPUT_DIRECTORY_REQUIRED");
    console.log(JSON.stringify(await captureFeed(args[1]), null, 2));
  } catch (error) {
    console.error(/^[A-Z_]+$/.test(error.message) ? error.message : "API_INSPECTION_FAILED");
    process.exitCode = 1;
  }
}
