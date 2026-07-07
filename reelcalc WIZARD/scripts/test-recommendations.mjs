import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis;

function loadBrowserScript(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  vm.runInThisContext(fs.readFileSync(fullPath, "utf8"), { filename: fullPath });
}

loadBrowserScript("js/calculator-core.js");
loadBrowserScript("js/recommendation-engine.js");

const reels = JSON.parse(fs.readFileSync(path.join(rootDir, "data/reels.json"), "utf8"));
const lines = JSON.parse(fs.readFileSync(path.join(rootDir, "data/lines.json"), "utf8"));
const core = globalThis.ReelCalcCore;
const engine = globalThis.ReelCalcRecommendations;

function findReadyReel(sizeClass) {
  const reel = reels.find((item) => {
    return String(item.size_class) === String(sizeClass) && core.isReelReady(item);
  });
  if (!reel) throw new Error(`No ready ${sizeClass} reel found`);
  return reel;
}

function reelLabel(reel) {
  return [reel.brand, reel.model, reel.size_label || reel.size_class].filter(Boolean).join(" ");
}

function formatDiameter(value) {
  return `${Number(value).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} in`;
}

function setupLine(setup) {
  return `${setup.line.lb} lb ${String(setup.line.type).toLowerCase()} (${formatDiameter(setup.line.dia_in)})`;
}

function setupLeader(setup) {
  if (!setup.leaderType || !setup.leaderLb) return "none";
  return `${setup.leaderLb} lb ${setup.leaderType.toLowerCase()}`;
}

function recommendationFor(sizeClass, priority, useCase) {
  const reel = findReadyReel(sizeClass);
  const setups = engine.recommendSetups({
    reel,
    lines,
    fishingType: "bass",
    priority,
    calculateFullSpoolCapacity: core.calculateFullSpoolCapacity
  });
  const setup = useCase ? setups.find((item) => item.useCase === useCase) : setups[0];
  if (!setup) throw new Error(`No setup found for ${sizeClass} ${priority} ${useCase}`);
  return { reel, setup };
}

function printRecommendation(label, sizeClass, priority, useCase) {
  const { reel, setup } = recommendationFor(sizeClass, priority, useCase);
  console.log(`\n${label}`);
  console.log(`Inputs: ${reelLabel(reel)} / bass / ${priority}`);
  console.log(`Recommended setup: ${setup.title}`);
  console.log(`Main line: ${setupLine(setup)}`);
  console.log(`Leader: ${setupLeader(setup)}`);
  console.log(`Estimated capacity: ${Math.round(setup.capacityYards)} yd`);
  console.log(`Score: ${setup.score}`);
  console.log(`Explanation: ${setup.explanation}`);
  console.log(`Warnings: ${setup.warnings.length ? setup.warnings.join(" ") : "none"}`);
}

printRecommendation("1. 2500 reel / best overall", 2500, "all-around", "best-overall");
printRecommendation("2. 2500 reel / heavy cover", 2500, "all-around", "heavy-cover");
printRecommendation("3. 2500 reel / finesse", 2500, "all-around", "finesse");
printRecommendation("4. 3000 reel / best overall", 3000, "all-around", "best-overall");
printRecommendation("5. 3000 reel / heavy cover", 3000, "all-around", "heavy-cover");
printRecommendation("6. 1000 reel / heavy cover", 1000, "all-around", "heavy-cover");
printRecommendation("7. 4000 reel / heavy cover", 4000, "all-around", "heavy-cover");
printRecommendation("8. casting distance selected", 2500, "distance", null);

const exactReel = findReadyReel(2500);
const exactLine = lines.find((line) => {
  return line.type === "Braid" && Number(line.lb) === 10 && Number(line.dia_in) > 0;
});
console.log("\n9. exact line selected from the database");
console.log(`Inputs: ${reelLabel(exactReel)} / exact line mode`);
console.log(`Recommended setup: exact user-selected line`);
console.log(`Main line: ${[exactLine.brand, exactLine.model, exactLine.type, `${exactLine.lb} lb`].filter(Boolean).join(" ")} (${formatDiameter(exactLine.dia_in)})`);
console.log("Leader: none from recommendation engine");
console.log(`Estimated capacity: ${Math.round(core.calculateFullSpoolCapacity(exactReel, exactLine))} yd`);
console.log("Score: n/a");
console.log("Explanation: exact-line mode uses the selected product diameter from the database.");
console.log("Warnings: none");

const typicalTenBraid = engine.typicalDiameter(lines, "Braid", 10);
console.log("\n10. generic 10 lb braid recommendation using realistic/common diameter");
console.log("Inputs: line database / Braid / 10 lb");
console.log("Recommended setup: generic diameter lookup");
console.log(`Main line: 10 lb braid (${formatDiameter(typicalTenBraid.dia_in)})`);
console.log("Leader: n/a");
console.log("Estimated capacity: n/a");
console.log("Score: n/a");
console.log(`Explanation: uses ${typicalTenBraid.source}; database count ${typicalTenBraid.stats.count}, raw min ${formatDiameter(typicalTenBraid.stats.min)}, raw median ${formatDiameter(typicalTenBraid.stats.median)}, raw max ${formatDiameter(typicalTenBraid.stats.max)}.`);
console.log("Warnings: none");
