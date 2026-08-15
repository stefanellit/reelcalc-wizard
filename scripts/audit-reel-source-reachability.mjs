import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reels = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "reels.json"), "utf8"));
const reportPath = path.join(rootDir, "reports", "reel-source-reachability.json");
const markdownPath = path.join(rootDir, "reports", "reel-source-reachability.md");

const groups = new Map();
for (const reel of reels) {
  const url = String(reel.source_url || "").trim();
  if (!url) continue;
  if (!groups.has(url)) groups.set(url, []);
  groups.get(url).push(reel);
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function modelWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !["reel", "spinning", "series"].includes(word));
}

async function inspectSource(url, records) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ReelCalcSourceAudit/1.0; +https://www.reelcalc.com)",
        accept: "text/html,application/xhtml+xml,application/pdf,application/json,text/plain;q=0.9,*/*;q=0.8",
      },
    });
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const canInspectContent = /html|json|text/.test(contentType);
    let body = "";
    if (canInspectContent && response.ok) body = (await response.text()).slice(0, 8_000_000);
    else if (response.body) await response.body.cancel();

    const normalizedBody = normalize(body);
    const recordChecks = records.map((reel) => {
      const sku = normalize(reel.sku);
      const words = modelWords(reel.model);
      return {
        id: reel.id,
        name: [reel.brand, reel.model, reel.size_label].filter(Boolean).join(" "),
        sku: reel.sku || "",
        sku_found: Boolean(canInspectContent && sku && normalizedBody.includes(sku)),
        model_terms_found: Boolean(canInspectContent && words.length && words.some((word) => normalizedBody.includes(normalize(word)))),
      };
    });

    return {
      url,
      final_url: response.url,
      http_status: response.status,
      state: response.ok ? "reachable" : [401, 403, 429].includes(response.status) ? "access_restricted" : "broken",
      content_type: contentType,
      content_checked: canInspectContent,
      record_count: records.length,
      sku_matches: recordChecks.filter((record) => record.sku_found).length,
      model_term_matches: recordChecks.filter((record) => record.model_terms_found).length,
      records: recordChecks,
    };
  } catch (error) {
    return {
      url,
      final_url: "",
      http_status: 0,
      state: error?.name === "AbortError" ? "timeout" : "network_error",
      content_type: "",
      content_checked: false,
      record_count: records.length,
      sku_matches: 0,
      model_term_matches: 0,
      error: String(error?.message || error),
      records: records.map((reel) => ({
        id: reel.id,
        name: [reel.brand, reel.model, reel.size_label].filter(Boolean).join(" "),
        sku: reel.sku || "",
        sku_found: false,
        model_terms_found: false,
      })),
    };
  } finally {
    clearTimeout(timer);
  }
}

const entries = [...groups.entries()];
const sources = [];
const concurrency = 6;
for (let index = 0; index < entries.length; index += concurrency) {
  const batch = entries.slice(index, index + concurrency);
  sources.push(...await Promise.all(batch.map(([url, records]) => inspectSource(url, records))));
  console.log(`Checked ${Math.min(index + concurrency, entries.length)} of ${entries.length} source URLs`);
}

sources.sort((left, right) => left.state.localeCompare(right.state) || left.url.localeCompare(right.url));
const stateCounts = {};
for (const source of sources) stateCounts[source.state] = (stateCounts[source.state] || 0) + 1;
const inspectable = sources.filter((source) => source.content_checked && source.state === "reachable");
const noIdentityMatch = inspectable.filter((source) => source.sku_matches === 0 && source.model_term_matches === 0);

const result = {
  generated_at: new Date().toISOString(),
  methodology_note: "Reachability and page-text identity checks are evidence triage only. A reachable page or SKU text match does not independently verify every stored specification.",
  summary: {
    reel_records: reels.length,
    unique_source_urls: sources.length,
    ...stateCounts,
    inspectable_sources: inspectable.length,
    inspectable_sources_without_identity_match: noIdentityMatch.length,
  },
  sources,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

const concerning = sources.filter((source) => source.state !== "reachable" || noIdentityMatch.includes(source));
const markdown = [
  "# Reel Source Reachability Audit",
  "",
  `Generated: ${result.generated_at}`,
  "",
  result.methodology_note,
  "",
  "## Summary",
  "",
  `- Reel records represented: **${reels.length}**`,
  `- Unique source URLs checked: **${sources.length}**`,
  ...Object.entries(stateCounts).map(([state, count]) => `- ${state}: **${count}**`),
  `- Inspectable pages with no SKU or model-term match: **${noIdentityMatch.length}**`,
  "",
  "## Sources Requiring Review",
  "",
  "| State | HTTP | Records | Identity match | URL |",
  "| --- | ---: | ---: | --- | --- |",
  ...concerning.map((source) => `| ${source.state} | ${source.http_status || "-"} | ${source.record_count} | ${source.sku_matches} SKU / ${source.model_term_matches} model | ${source.url} |`),
  "",
].join("\n");
fs.writeFileSync(markdownPath, markdown, "utf8");

console.log("Reel source reachability audit complete");
console.log(`- ${sources.length} unique source URLs checked for ${reels.length} reels`);
console.log(`- States: ${Object.entries(stateCounts).map(([state, count]) => `${state}=${count}`).join(", ")}`);
console.log(`- Inspectable sources with no identity match: ${noIdentityMatch.length}`);
