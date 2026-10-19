import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as html from "../line-page-publishing/node_modules/parse5/dist/index.js";
import { normalizeReel } from "./lookup.mjs";
import { buildRecommendationModel } from "./recommendations.mjs";
import { braidFaqAdvice, isLegacyBraidFaq } from "./braid-faq.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const walk = (node) => [node, ...(node.childNodes || []).flatMap(walk)];
export const textOf = (node) => node.nodeName === "#text" ? node.value : (node.childNodes || []).map(textOf).join("");
export const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

// Offsets keep every byte outside the answer intact, including tracking attributes.
export function patchFaq(source, answer, previousAnswers = []) {
  const document = html.parse(source, { sourceCodeLocationInfo: true });
  const replacements = [];
  for (const heading of walk(document).filter((node) => node.tagName === "h3" && /^What Size Braid Is Best for /i.test(textOf(node).trim()))) {
    const siblings = heading.parentNode.childNodes;
    const paragraph = siblings.slice(siblings.indexOf(heading) + 1).find((node) => node.tagName);
    if (paragraph?.tagName !== "p") continue;
    const current = textOf(paragraph);
    if (current === answer || (!isLegacyBraidFaq(current) && !previousAnswers.includes(current))) continue;
    const location = paragraph.sourceCodeLocation;
    if (!location?.startTag || !location?.endTag) throw new Error("FAQ paragraph has no safe edit boundary");
    replacements.push({ start: location.startTag.endOffset, end: location.endTag.startOffset, before: source.slice(location.startTag.endOffset, location.endTag.startOffset) });
  }
  let updated = source;
  for (const edit of [...replacements].sort((a, b) => b.start - a.start)) {
    updated = updated.slice(0, edit.start) + escape(answer) + updated.slice(edit.end);
  }
  return { updated, replacements };
}

export function previousDefault(recommendation) {
  const prefix = `${recommendation.braidRange} is the practical ReelCalc range for this ${recommendation.baitcaster ? "baitcaster" : "reel"}.`;
  if (recommendation.baitcaster) return `${prefix} Use the lighter end for open water and easier casting, and the stronger end around vegetation, docks, wood, frogs, or larger baits. Avoid choosing very thin braid only to maximize yardage because thin braid can dig into a baitcaster spool under load.`;
  if (recommendation.heavyDuty) return `${prefix} Use the lighter end when line capacity and casting distance matter most. Move toward the stronger end for large baits, rough structure, heavy current, or situations where abrasion resistance and pulling power take priority.`;
  return `${prefix} Use the lighter end for finesse presentations, trout, and open water. Move toward the stronger end for bass, current, vegetation, or situations where a little more abrasion resistance and control are useful.`;
}

export function refresh({ projectRoot = root, reportDirectory } = {}) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(projectRoot, file), "utf8"));
  const manifestFile = path.join(projectRoot, "data/reel-page-embeds.json");
  const originalManifest = fs.readFileSync(manifestFile, "utf8");
  const manifest = JSON.parse(originalManifest);
  const reportFile = reportDirectory && path.join(reportDirectory, "changes.json");
  const previousReport = reportFile && fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, "utf8")) : { changes: [], files: [] };
  const previousChanges = new Map(previousReport.changes.map((change) => [change.slug, change]));
  const reels = new Map(read("data/reels.json").map((reel) => [reel.id, normalizeReel(reel)]));
  const changes = [];
  const retained = [];
  for (const [slug, entry] of Object.entries(manifest.pages)) {
    const reel = reels.get(entry.reelId);
    if (!reel) throw new Error(`Unknown exact reel: ${entry.reelId}`);
    const recommendation = buildRecommendationModel(reel);
    const advice = braidFaqAdvice(reel, recommendation);
    const existing = entry.content?.faqBraid;
    const previous = previousChanges.get(slug);
    if (existing && !isLegacyBraidFaq(existing) && existing !== advice.text && existing !== previous?.after) {
      retained.push({ slug, reelId: reel.id, reason: "Preserved existing customized FAQ and disclosures", text: existing });
      continue;
    }
    changes.push({ slug, reelId: reel.id, path: entry.canonicalPath, useCase: reel.useCase, braidRange: recommendation.braidRange, profile: advice.profile, before: previous?.before || existing || previousDefault(recommendation), after: advice.text });
    entry.content = { ...entry.content, faqBraid: advice.text };
  }
  const bySlug = new Map(changes.map((change) => [change.slug, change]));
  const fileChanges = new Map(previousReport.files.map((entry) => [entry.file, entry]));
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith(".html")) {
        const slug = entry.name.replace(/-(preview|squarespace)\.html$/, "");
        const change = bySlug.get(slug);
        if (!change) continue;
        const source = fs.readFileSync(file, "utf8");
        const result = patchFaq(source, change.after, [previousChanges.get(slug)?.after].filter(Boolean));
        if (!result.replacements.length) continue;
        const relative = path.relative(projectRoot, file).replace(/\\/g, "/");
        if (reportDirectory) {
          const backup = path.join(reportDirectory, "originals", relative);
          fs.mkdirSync(path.dirname(backup), { recursive: true });
          if (!fs.existsSync(backup)) fs.writeFileSync(backup, source);
        }
        fs.writeFileSync(file, result.updated);
        fileChanges.set(relative, { file: relative, replacements: result.replacements.length });
      }
    }
  }
  visit(path.join(projectRoot, "generated/reel-pages"));
  const files = [...fileChanges.values()];
  if (reportDirectory) {
    fs.mkdirSync(reportDirectory, { recursive: true });
    const backup = path.join(reportDirectory, "original-manifest.json");
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, originalManifest);
    fs.writeFileSync(path.join(reportDirectory, "changes.json"), JSON.stringify({ reviewed: Object.keys(manifest.pages).length, changes, retained, files }, null, 2) + "\n");
  }
  manifest.version = Math.max(15, Number(manifest.version) || 0);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  return { reviewed: Object.keys(manifest.pages).length, changes, retained, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reportDirectory = path.resolve(process.argv[2] || path.join(root, "outputs/reel-faq-context-2026-10-18"));
  const result = refresh({ reportDirectory });
  console.log(JSON.stringify({ reviewed: result.reviewed, refreshed: result.changes.length, customizedAnswersRetained: result.retained.length, htmlFilesPatched: result.files.length, reportDirectory }, null, 2));
}
