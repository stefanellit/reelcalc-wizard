import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

// GITHUB_TOKEN commits do not start a legacy Pages build. Request one explicitly,
// and retry publication even on a no-change sync if the previous build failed.
const repository = process.env.GITHUB_REPOSITORY;
if (repository !== "stefanellit/reelcalc-wizard") throw new Error("Unexpected deployment repository");
const expected = JSON.parse(await fs.readFile("data/line-laboratory.json", "utf8"));
const expectedRelease = JSON.parse(await fs.readFile("data/line-laboratory-release.json", "utf8"));
const base = "https://stefanellit.github.io/reelcalc-wizard/";
async function matches() {
  try {
    for (const [file, value] of [["data/line-laboratory.json", expected], ["data/line-laboratory-release.json", expectedRelease]]) {
      const response = await fetch(base + file + "?sync-check=" + Date.now(), { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!response.ok || JSON.stringify(await response.json()) !== JSON.stringify(value)) return false;
    }
    return true;
  } catch { return false; }
}
if (process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" && await matches()) {
  console.log("Live catalog already matches the checked repository data.");
} else {
  execFileSync("gh", ["api", "--method", "POST", `repos/${repository}/pages/builds`], { stdio: "inherit" });
  let built = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await delay(10000);
    const build = JSON.parse(execFileSync("gh", ["api", `repos/${repository}/pages/builds/latest`], { encoding: "utf8" }));
    if (build.status === "errored") throw new Error("Pages build failed; repository data is retained for retry");
    if (build.status === "built" && await matches()) { built = true; break; }
  }
  if (!built) throw new Error("Timed out verifying the published catalog");
  console.log("Pages build and live catalog verified.");
}
