import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import sources from "../../js/line-sources.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const serial = value => JSON.stringify(value, null, 2) + "\n";
const fields = ["source_record_id", "original_name", "brand", "product", "variant", "material", "rated_strength", "tested_breaking_strength", "diameters", "quoted_diameter", "capacity_method_id", "source_url", "tested_at", "updated_at", "status", "api_provenance"];
const csvFields = ["source_record_id", "original_name", "brand", "product", "variant", "material", "rated_strength_value", "rated_strength_unit", "rated_strength_label", "diameters_json", "capacity_method_id", "tested_breaking_strength_value", "tested_breaking_strength_unit", "source_url", "tested_at", "updated_at", "status"];
export { csvFields };

function number(value) {
  if (typeof value !== "string" || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) throw new Error("INVALID_NUMBER");
  return Number(value);
}
function publicRecord(record) {
  if (!record || Object.keys(record).some(key => !fields.includes(key))) throw new Error("UNEXPECTED_RECORD_FIELD");
  return Object.fromEntries(fields.filter(key => record[key] !== undefined).map(key => [key, record[key]]));
}
export function decodeFeed(text, format, columnMap = {}) {
  if (format === "json") {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.source !== sources.SOURCE || parsed.schemaVersion !== 1 || !Array.isArray(parsed.records)) throw new Error("INVALID_JSON_ENVELOPE");
    return parsed.records.map(publicRecord);
  }
  if (format !== "csv") throw new Error("UNSUPPORTED_FORMAT");
  if (Object.keys(columnMap).some(key => !csvFields.includes(key))) throw new Error("UNKNOWN_COLUMN_MAPPING");
  const mapped = csvFields.map(key => columnMap[key] || key);
  if (new Set(mapped).size !== mapped.length) throw new Error("DUPLICATE_COLUMN_MAPPING");
  const rows = parse(text, { bom: true, skip_empty_lines: true, max_record_size: 50000,
    columns(headers) {
      if (new Set(headers).size !== headers.length || mapped.some(name => !headers.includes(name))) throw new Error("INVALID_CSV_HEADERS");
      return headers;
    }
  });
  return rows.map(row => {
    const get = key => row[columnMap[key] || key];
    const record = {};
    for (const key of ["source_record_id", "original_name", "brand", "product", "variant", "material", "capacity_method_id", "updated_at", "status"]) record[key] = get(key);
    record.rated_strength = { value: number(get("rated_strength_value")), unit: get("rated_strength_unit"), label: get("rated_strength_label") };
    record.diameters = JSON.parse(get("diameters_json"));
    if (get("tested_breaking_strength_value") || get("tested_breaking_strength_unit")) record.tested_breaking_strength = { value: number(get("tested_breaking_strength_value")), unit: get("tested_breaking_strength_unit") };
    if (get("source_url")) record.source_url = get("source_url");
    if (get("tested_at")) record.tested_at = get("tested_at");
    return publicRecord(record);
  });
}

export function mergeRecords(current, incoming, config, now = new Date().toISOString()) {
  if (current.schemaVersion !== 1 || current.source !== sources.SOURCE || !Array.isArray(current.records)) throw new Error("INVALID_EXISTING_DATA");
  if (!incoming.length) throw new Error("EMPTY_FEED_KEPT_EXISTING_DATA");
  if (!Array.isArray(config.approvedMethods) || !config.approvedMethods.length) throw new Error("METHOD_APPROVAL_REQUIRED");
  const byId = new Map();
  for (const old of current.records) {
    sources.validateRecord(old, config.approvedMethods);
    if (byId.has(old.source_record_id)) throw new Error("DUPLICATE_EXISTING_ID");
    byId.set(old.source_record_id, old);
  }
  const seen = new Set();
  const counts = { added: 0, updated: 0, unchanged: 0, retained: 0 };
  for (const record of incoming) {
    sources.validateRecord(record, config.approvedMethods);
    if (Date.parse(record.updated_at) > Date.parse(now)) throw new Error("FUTURE_UPDATE_DATE");
    if (seen.has(record.source_record_id)) throw new Error("DUPLICATE_FEED_ID");
    seen.add(record.source_record_id);
    const old = byId.get(record.source_record_id);
    if (old && serial(old) === serial(record)) { counts.unchanged++; continue; }
    if (old) {
      if (Date.parse(record.updated_at) <= Date.parse(old.updated_at)) throw new Error("STALE_OR_UNVERSIONED_UPDATE");
      if (sources.identity(old) !== sources.identity(record)) {
        const approval = (config.identityApprovals || []).find(item => item.id === record.source_record_id &&
          item.before === digest(sources.identity(old)) && item.after === digest(sources.identity(record)) && item.approvedBy && item.approvedAt);
        if (!approval) throw new Error("IDENTITY_CHANGE_REQUIRES_REVIEW");
      }
      counts.updated++;
    } else counts.added++;
    byId.set(record.source_record_id, record);
  }
  counts.retained = current.records.filter(record => !seen.has(record.source_record_id)).length;
  const changed = counts.added + counts.updated > 0;
  return { changed, counts, data: changed ? { ...current, lastSuccessfulSync: now, records: [...byId.values()].sort((a, b) => a.source_record_id.localeCompare(b.source_record_id)) } : current };
}

async function readFeed(config, input) {
  if (input) return fs.readFile(input, "utf8");
  const url = new URL(config.feedUrl);
  if (url.protocol !== "https:" || url.username || url.password || !config.allowedFeedHosts?.includes(url.hostname)) throw new Error("UNAPPROVED_FEED_HOST");
  const headers = {};
  if (config.tokenEnvironmentVariable) {
    const token = process.env[config.tokenEnvironmentVariable];
    if (!token) throw new Error("FEED_CREDENTIAL_MISSING");
    headers.Authorization = "Bearer " + token;
  }
  const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("FEED_HTTP_ERROR");
  let text = "";
  const decoder = new TextDecoder();
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 10_000_000) throw new Error("FEED_TOO_LARGE");
    text += decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

export async function runImport({ config, input, write = false, dataFile = path.join(root, "data/line-laboratory.json") }) {
  if (config.partnerAuthorized !== true || !config.approvedBy || !config.authorizationReference) throw new Error("PARTNER_AUTHORIZATION_REQUIRED");
  // Raw partner files and credentials must never be included in public site assets.
  const privateDir = path.resolve(config.privateDir || root);
  const relative = path.relative(root, privateDir);
  if (!relative || (!relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))) throw new Error("PRIVATE_DIRECTORY_MUST_BE_OUTSIDE_SITE");
  await fs.mkdir(privateDir, { recursive: true });
  const logFile = path.join(privateDir, "sync.jsonl");
  const lockFile = path.join(privateDir, "import.lock");
  const lock = await fs.open(lockFile, "wx").catch(() => { throw new Error("IMPORT_ALREADY_RUNNING"); });
  try {
    const text = await readFeed(config, input);
    if (Buffer.byteLength(text) > 10_000_000) throw new Error("FEED_TOO_LARGE");
    const before = await fs.readFile(dataFile, "utf8");
    const result = mergeRecords(JSON.parse(before), decodeFeed(text, config.format, config.columnMap), config);
    const receipt = { at: new Date().toISOString(), feedSha256: digest(text), beforeSha256: digest(before), approvedBy: config.approvedBy, authorizationReference: config.authorizationReference, write, ...result.counts };
    if (write && result.changed) {
      const snapshot = path.join(privateDir, receipt.at.replace(/[:.]/g, "-") + "-" + receipt.feedSha256.slice(0, 12));
      await fs.mkdir(snapshot);
      await fs.writeFile(path.join(snapshot, "feed." + config.format), text, { flag: "wx" });
      await fs.writeFile(path.join(snapshot, "before.json"), before, { flag: "wx" });
      await fs.writeFile(path.join(snapshot, "after.json"), serial(result.data), { flag: "wx" });
      await fs.writeFile(path.join(snapshot, "receipt.json"), serial(receipt), { flag: "wx" });
      if (await fs.readFile(dataFile, "utf8") !== before) throw new Error("DATA_CHANGED_DURING_IMPORT");
      const temp = dataFile + "." + crypto.randomUUID() + ".tmp";
      try { await fs.writeFile(temp, serial(result.data), { flag: "wx" }); await fs.rename(temp, dataFile); }
      finally { await fs.rm(temp, { force: true }); }
    }
    await fs.appendFile(logFile, JSON.stringify({ ...receipt, status: "ok", changed: result.changed }) + "\n");
    return { ...result.counts, changed: result.changed, written: write && result.changed };
  } catch (error) {
    // Parser/fetch messages may include raw data, endpoints or credentials; log only safe codes.
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : "INVALID_FEED_OR_IO_FAILURE";
    await fs.appendFile(logFile, JSON.stringify({ at: new Date().toISOString(), status: "error", code }) + "\n");
    throw new Error(code);
  } finally { await lock.close(); await fs.rm(lockFile, { force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
    if (!value("--config")) throw new Error("CONFIG_REQUIRED");
    const config = JSON.parse(await fs.readFile(value("--config"), "utf8"));
    console.log(JSON.stringify(await runImport({ config, input: value("--input"), write: args.includes("--write") }), null, 2));
  } catch (error) { console.error(/^[A-Z_]+$/.test(error.message) ? error.message : "IMPORT_FAILED"); process.exitCode = 1; }
}
