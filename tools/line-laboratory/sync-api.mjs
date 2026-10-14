import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { captureFeed } from "./inspect-api.mjs";
import { prepareApi } from "./prepare-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serial = value => JSON.stringify(value, null, 2) + "\n";

export async function syncApi({ directory, dataFile = path.join(root, "data/line-laboratory.json"), write = false, fetchImpl = fetch }) {
  const before = await fs.readFile(dataFile, "utf8");
  const current = JSON.parse(before);
  const receipt = await captureFeed(directory, fetchImpl);
  const text = await fs.readFile(path.join(receipt.folder, "api-response.json"), "utf8");
  const result = prepareApi(text, current, receipt.observedAt, { holdChanged: true });
  const oldIds = new Set(current.records.map(r => r.source_record_id));
  const report = {
    checkedAt: receipt.observedAt, feedSha256: receipt.feedSha256,
    records: result.data.records.length, changed: result.changed,
    added: result.data.records.filter(r => !oldIds.has(r.source_record_id)).map(r => ({ id: r.source_record_id, name: r.original_name, strength: r.rated_strength.label })),
    review: result.review, written: false
  };
  if (write && result.changed) {
    if (await fs.readFile(dataFile, "utf8") !== before) throw new Error("Catalog changed during sync; retry from latest repository");
    const temporary = dataFile + ".sync-tmp";
    await fs.writeFile(temporary, serial(result.data), { flag: "wx" });
    await fs.rename(temporary, dataFile);
    report.written = true;
  }
  await fs.writeFile(path.join(directory, "sync-report.json"), serial(report));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = process.argv[process.argv.indexOf("--output") + 1];
  if (!process.argv.includes("--output") || !directory) throw new Error("An external --output directory is required");
  try {
    const report = await syncApi({ directory, write: process.argv.includes("--write") });
    console.log(JSON.stringify(report, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
      `## Line Laboratory sync\n\n${report.records} saved lines; ${report.added.length} new lines; ${report.review.length} records held for review.\n\nRaw public feed and review details are in the run artifact.\n`);
  } catch (error) {
    console.error("Line Laboratory sync failed. No unvalidated data was published.");
    console.error(error.message);
    process.exitCode = 1;
  }
}
