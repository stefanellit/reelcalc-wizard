import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reelsPath = path.join(rootDir, "data", "reels.json");
const corePath = path.join(rootDir, "js", "calculator-core.js");
const jsonReportPath = path.join(rootDir, "reports", "reel-data-quality-audit.json");
const markdownReportPath = path.join(rootDir, "reports", "reel-data-quality-audit.md");

const reels = JSON.parse(fs.readFileSync(reelsPath, "utf8"));
const sandbox = { window: {}, URL, URLSearchParams, Map, Set, Array, Number, String, Math };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(corePath, "utf8"), sandbox, { filename: corePath });
const core = sandbox.window.ReelCalcCore;

const sourceFileByBrand = new Map([
  ["Abu Garcia", "abu_garcia_reel_database_master.json"],
  ["Bass Pro Shops", "bass_pro_reel_database_master.json"],
  ["Offshore Angler", "bass_pro_reel_database_master.json"],
  ["Daiwa", "daiwa_reel_database_master.json"],
  ["KastKing", "kastking_reel_database_master.json"],
  ["Lew's", "lews_reel_database_master.json"],
  ["Okuma", "okuma_reel_database_master.json"],
  ["PENN", "penn_reel_database_master.json"],
  ["Pflueger", "pflueger_reel_database_master.json"],
  ["Quantum", "quantum_reel_database_master.json"],
  ["Shimano", "shimano_reel_database_master.json"],
]);

const officialDomainsByBrand = new Map([
  ["Abu Garcia", ["abugarcia.com"]],
  ["Bass Pro Shops", ["basspro.com"]],
  ["Offshore Angler", ["basspro.com"]],
  ["Daiwa", ["daiwa.us"]],
  ["KastKing", ["kastking.com"]],
  ["Lew's", ["lews.com"]],
  ["Okuma", ["okumafishingusa.com"]],
  ["PENN", ["pennfishing.com"]],
  ["Pflueger", ["pfluegerfishing.com"]],
  ["Shimano", ["fish.shimano.com"]],
]);

const weakSourceDomains = new Set([
  "desertcart.com.au",
  "ebay.com",
  "reddit.com",
]);

const abbreviatedBrands = new Set(["Abu Garcia", "Bass Pro Shops", "Lew's", "Pflueger", "Quantum"]);
const reviewSourcePattern = /verify|partial|seed|community|qa[_\s-]*snippet|needs[_\s-]*official[_\s-]*audit/i;
const placeholderPattern = /needs?\s+manual(?:ly)?\s+entry|manual entry|\btbd\b|\bunknown\b|placeholder|specs?\s+need\s+verification/i;

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function displayName(reel) {
  return [reel.brand, reel.model, reel.size_label].filter(Boolean).join(" ");
}

function sourceDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function approximatelyEqual(left, right, tolerance = 0.005) {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b), 1) * tolerance;
}

function parseRecommendedRange(value) {
  const numbers = String(value || "").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (!numbers.length) return null;
  return { minimum: numbers[0], maximum: numbers[1] ?? numbers[0] };
}

function numericSize(value) {
  return Number(String(value || "").match(/\d+/)?.[0] || 0);
}

function needsRecommendationNormalization(reel) {
  if (!abbreviatedBrands.has(reel.brand)) return false;
  const size = numericSize(reel.size_class || reel.size_label);
  if (reel.brand === "Pflueger") return size > 0 && size <= 40;
  if (reel.brand === "Lew's") return size > 0 && size <= 400;
  if (reel.brand === "Quantum") return size > 0 && size <= 99;
  return size > 0 && size <= 40;
}

function pushIssue(record, code, severity, detail) {
  record.issues.push({ code, severity, detail });
}

function primaryAnchorMatches(reel) {
  return Array.isArray(reel.capacity_options) && reel.capacity_options.some((option) =>
    approximatelyEqual(option.lb, reel.rated_line_lb) &&
    approximatelyEqual(option.yards, reel.capacity_yards) &&
    approximatelyEqual(option.diameter_in, reel.rated_line_diameter_in)
  );
}

function capacityOptionsAreMonotonic(options) {
  const sorted = options
    .map((option) => ({ lb: Number(option.lb), yards: Number(option.yards) }))
    .filter((option) => option.lb > 0 && option.yards > 0)
    .sort((a, b) => a.lb - b.lb);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].lb > sorted[index - 1].lb && sorted[index].yards > sorted[index - 1].yards * 1.05) return false;
  }
  return true;
}

function duplicateValues(items, keyFor) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

const records = reels.map((reel) => {
  const record = {
    id: reel.id,
    name: displayName(reel),
    brand: reel.brand,
    model: reel.model,
    size: reel.size_label,
    sku: reel.sku || "",
    source_url: reel.source_url || "",
    source_domain: sourceDomain(reel.source_url),
    issues: [],
  };

  for (const field of ["id", "brand", "model", "size_label"]) {
    if (!String(reel[field] ?? "").trim()) pushIssue(record, `missing_${field}`, "blocker", `${field} is empty.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(reel.id || ""))) {
    pushIssue(record, "invalid_id", "blocker", "Stable reel ID format is invalid.");
  }
  if (!String(reel.sku || "").trim()) pushIssue(record, "missing_sku", "review", "Exact model/SKU is missing.");

  const expectedSourceFile = sourceFileByBrand.get(reel.brand);
  if (expectedSourceFile && reel.source_file !== expectedSourceFile) {
    pushIssue(record, "source_file_brand_mismatch", "high", `Expected ${expectedSourceFile}; found ${reel.source_file || "blank"}.`);
  }

  if (!record.source_domain) {
    pushIssue(record, "missing_or_invalid_source_url", "high", "Source URL is missing or invalid.");
  } else if (weakSourceDomains.has(record.source_domain)) {
    pushIssue(record, "weak_source_domain", "high", `The only stored source is ${record.source_domain}.`);
  }

  const officialDomains = officialDomainsByBrand.get(reel.brand) || [];
  const isOfficialSource = officialDomains.includes(record.source_domain);
  if (!isOfficialSource && officialDomains.length) {
    pushIssue(record, "secondary_source", "review", `Stored source is not the listed manufacturer domain (${record.source_domain}).`);
  }

  const dataSource = String(reel.capacity_data_source || "");
  if (!dataSource) pushIssue(record, "missing_capacity_data_source", "review", "Capacity provenance label is missing.");
  if (reviewSourcePattern.test(dataSource)) {
    pushIssue(record, "provenance_requires_review", "review", `Capacity source label: ${dataSource}.`);
  }
  if (placeholderPattern.test(JSON.stringify(reel))) {
    pushIssue(record, "placeholder_or_verification_text", "high", "Record contains placeholder or unresolved verification wording.");
  }
  if (Array.isArray(reel.data_warnings) && reel.data_warnings.length) {
    pushIssue(record, "data_warning", "review", reel.data_warnings.join(" "));
  }
  if (String(reel.spec_verification_status || "").toLowerCase() === "source_conflict" ||
      (Array.isArray(reel.source_conflicts) && reel.source_conflicts.length)) {
    pushIssue(record, "source_conflict", "high", "Record has unresolved conflicting published specifications.");
  }

  const calculatorReady = Number(reel.capacity_yards) > 0 &&
    Number(reel.rated_line_lb) > 0 &&
    Number(reel.rated_line_diameter_in) > 0 &&
    Array.isArray(reel.capacity_options) && reel.capacity_options.length > 0;
  if (!calculatorReady) {
    pushIssue(record, "missing_calculator_capacity", "blocker", "A complete mono/reference capacity anchor is unavailable.");
  } else {
    if (!primaryAnchorMatches(reel)) {
      pushIssue(record, "primary_anchor_not_in_options", "blocker", "Primary capacity does not match any stored capacity option.");
    }
    const expectedSpace = Number(reel.capacity_yards) * Number(reel.rated_line_diameter_in) ** 2;
    if (!approximatelyEqual(expectedSpace, reel.spool_space, 0.01)) {
      pushIssue(record, "stored_spool_space_mismatch", "high", "Stored spool_space does not match the primary capacity and diameter.");
    }
    for (const option of reel.capacity_options) {
      if (!(Number(option.lb) > 0) || !(Number(option.yards) > 0) || !(Number(option.diameter_in) > 0)) {
        pushIssue(record, "invalid_capacity_option", "blocker", `Invalid capacity option: ${JSON.stringify(option)}.`);
        continue;
      }
      const optionSpace = Number(option.yards) * Number(option.diameter_in) ** 2;
      if (!approximatelyEqual(optionSpace, option.spool_space, 0.01)) {
        pushIssue(record, "capacity_option_space_mismatch", "high", `Option ${option.raw || `${option.lb}-${option.yards}`} has inconsistent spool_space.`);
      }
    }
    if (!capacityOptionsAreMonotonic(reel.capacity_options)) {
      pushIssue(record, "nonmonotonic_mono_capacity", "high", "Higher-strength mono option unexpectedly lists substantially more yardage.");
    }
  }

  const braidOptions = core.publishedBraidCapacityOptions(reel);
  if (String(reel.braid_capacity_note || "").trim() && !braidOptions.length) {
    pushIssue(record, "unparsed_braid_capacity", "high", `Braid capacity could not be parsed: ${reel.braid_capacity_note}.`);
  }
  if (braidOptions.length) {
    const sorted = braidOptions.slice().sort((a, b) => Number(a.lb) - Number(b.lb));
    const duplicateStrengths = duplicateValues(sorted, (option) => String(option.lb));
    if (duplicateStrengths.length) {
      pushIssue(record, "duplicate_braid_strength", "high", "Published braid capacity repeats a strength with multiple values.");
    }
    if (!capacityOptionsAreMonotonic(sorted)) {
      pushIssue(record, "nonmonotonic_braid_capacity", "high", "Higher-strength braid unexpectedly lists substantially more yardage.");
    }
    const recommended = parseRecommendedRange(reel.reelcalc_recommended_braid);
    const lightestAnchor = Math.min(...sorted.map((option) => Number(option.lb)));
    if (recommended && lightestAnchor > recommended.minimum * 2) {
      pushIssue(record, "braid_anchor_recommendation_gap", "review", `Lightest published braid anchor is ${lightestAnchor} lb while guidance starts at ${recommended.minimum} lb; recommendation regression tests must confirm the lower-strength estimates remain practical.`);
    }
  }

  if (needsRecommendationNormalization(reel) && !(Number(reel.recommendation_size_class) > 0)) {
    pushIssue(record, "missing_recommendation_size_class", "high", "Abbreviated brand size lacks a normalized recommendation size.");
  }

  for (const field of ["gear_ratio", "line_retrieve_in", "weight_oz", "max_drag_lb", "bearings"]) {
    const value = reel[field];
    if (value === null || value === undefined || String(value).trim() === "" || (field !== "gear_ratio" && field !== "bearings" && !(Number(value) > 0))) {
      pushIssue(record, `missing_${field}`, "review", `${field} is unavailable.`);
    }
  }

  const rank = { blocker: 4, high: 3, review: 2, info: 1 };
  record.maximum_severity = record.issues.reduce((highest, issue) => rank[issue.severity] > rank[highest] ? issue.severity : highest, "info");
  record.status = record.issues.some((issue) => issue.severity === "blocker")
    ? "blocked"
    : record.issues.some((issue) => issue.severity === "high")
      ? "high_priority_review"
      : record.issues.length
        ? "review"
        : "clean";
  return record;
});

const duplicateIds = duplicateValues(reels, (reel) => normalize(reel.id));
const duplicateSkus = duplicateValues(reels, (reel) => normalize(reel.sku));
const issueCounts = new Map();
for (const record of records) {
  for (const issue of record.issues) issueCounts.set(issue.code, (issueCounts.get(issue.code) || 0) + 1);
}

const statusCounts = Object.fromEntries(["clean", "review", "high_priority_review", "blocked"].map((status) => [
  status,
  records.filter((record) => record.status === status).length,
]));
const byBrand = [...new Set(reels.map((reel) => reel.brand))].sort().map((brand) => {
  const brandRecords = records.filter((record) => record.brand === brand);
  return {
    brand,
    total: brandRecords.length,
    clean: brandRecords.filter((record) => record.status === "clean").length,
    review: brandRecords.filter((record) => record.status === "review").length,
    high_priority_review: brandRecords.filter((record) => record.status === "high_priority_review").length,
    blocked: brandRecords.filter((record) => record.status === "blocked").length,
  };
});

const result = {
  generated_at: new Date().toISOString(),
  methodology: {
    scope: "All records in data/reels.json",
    limitation: "This automated pass validates structure, provenance, internal consistency, and risk signals. It does not claim that every stored specification was independently confirmed from a current manufacturer page.",
  },
  summary: {
    total_reels: reels.length,
    ...statusCounts,
    duplicate_id_groups: duplicateIds.length,
    duplicate_sku_groups: duplicateSkus.length,
  },
  issue_counts: Object.fromEntries([...issueCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  by_brand: byBrand,
  duplicate_ids: duplicateIds.map(([key, group]) => ({ key, ids: group.map((reel) => reel.id) })),
  duplicate_skus: duplicateSkus.map(([key, group]) => ({
    key,
    records: group.map((reel) => ({ id: reel.id, name: displayName(reel), sku: reel.sku })),
  })),
  records,
};

fs.mkdirSync(path.dirname(jsonReportPath), { recursive: true });
fs.writeFileSync(jsonReportPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

const priorityRecords = records
  .filter((record) => ["blocked", "high_priority_review"].includes(record.status))
  .sort((left, right) => left.brand.localeCompare(right.brand) || left.name.localeCompare(right.name));
const markdown = [
  "# Reel Data Quality Audit",
  "",
  `Generated: ${result.generated_at}`,
  "",
  "## Scope And Honesty Note",
  "",
  result.methodology.limitation,
  "",
  "## Summary",
  "",
  `- Total reels: **${reels.length}**`,
  `- Clean in this automated pass: **${statusCounts.clean}**`,
  `- Review: **${statusCounts.review}**`,
  `- High-priority review: **${statusCounts.high_priority_review}**`,
  `- Calculation blocked: **${statusCounts.blocked}**`,
  `- Duplicate ID groups: **${duplicateIds.length}**`,
  `- Duplicate SKU groups: **${duplicateSkus.length}**`,
  "",
  "## Coverage By Brand",
  "",
  "| Brand | Total | Clean | Review | High priority | Blocked |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...byBrand.map((row) => `| ${row.brand} | ${row.total} | ${row.clean} | ${row.review} | ${row.high_priority_review} | ${row.blocked} |`),
  "",
  "## Issue Counts",
  "",
  "| Check | Records |",
  "| --- | ---: |",
  ...Object.entries(result.issue_counts).map(([code, count]) => `| ${code} | ${count} |`),
  "",
  "## Priority Review Queue",
  "",
  "| Reel | SKU | Status | Reasons | Source |",
  "| --- | --- | --- | --- | --- |",
  ...priorityRecords.map((record) => `| ${record.name} | ${record.sku || "missing"} | ${record.status} | ${record.issues.filter((issue) => issue.severity === "blocker" || issue.severity === "high").map((issue) => issue.code).join(", ")} | ${record.source_domain || "missing"} |`),
  "",
].join("\n");
fs.writeFileSync(markdownReportPath, markdown, "utf8");

console.log("Reel data quality audit");
console.log(`- ${reels.length} reels checked across ${byBrand.length} brands`);
console.log(`- Clean: ${statusCounts.clean}; review: ${statusCounts.review}; high priority: ${statusCounts.high_priority_review}; blocked: ${statusCounts.blocked}`);
console.log(`- Duplicate IDs: ${duplicateIds.length}; duplicate SKUs: ${duplicateSkus.length}`);
console.log(`- Reports: ${path.relative(rootDir, jsonReportPath)} and ${path.relative(rootDir, markdownReportPath)}`);

if (duplicateIds.length) process.exitCode = 1;
