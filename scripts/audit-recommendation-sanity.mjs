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

const reels = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "reels.json"), "utf8"));
const lines = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "lines.json"), "utf8"));
const core = globalThis.ReelCalcCore;
const engine = globalThis.ReelCalcRecommendations;

const fishingTypes = ["trout", "bass", "walleye", "freshwater", "inshore", "surf"];
const sampleSizeClasses = [500, 750, 1000, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000, 14000];
const baitcasterBraidCaps = {
  trout: { finesse: 10, "best-overall": 12, "casting-distance": 12, "heavy-cover": 15 },
  bass: { finesse: 15, "best-overall": 40, "casting-distance": 30, "heavy-cover": 65 },
  walleye: { finesse: 15, "best-overall": 30, "casting-distance": 30, "heavy-cover": 40 },
  freshwater: { finesse: 15, "best-overall": 40, "casting-distance": 30, "heavy-cover": 65 },
  inshore: { finesse: 30, "best-overall": 50, "casting-distance": 40, "heavy-cover": 80 },
  surf: { "best-overall": 80, "casting-distance": 65, "heavy-cover": 100 },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function reelSize(reel) {
  return Number(engine.reelSizeClass(reel));
}

function reelLabel(reel) {
  return [reel.brand, reel.model, reel.size_label || reel.size_class].filter(Boolean).join(" ");
}

function isReady(reel) {
  return core.isReelReady(reel);
}

function isBaitcaster(reel) {
  return /baitcast|casting/i.test(String(reel?.reel_type || ""));
}

function representativeReels() {
  return sampleSizeClasses.map((sizeClass) => {
    return reels.find((reel) => String(reel.size_class) === String(sizeClass) && isReady(reel));
  }).filter(Boolean);
}

function topSetup(reel, fishingType) {
  const setups = engine.recommendSetups({
    reel,
    lines,
    fishingType,
    priority: "all-around",
    calculateFullSpoolCapacity: core.calculateFullSpoolCapacity,
  });
  return { setups, top: setups[0] || null };
}

function suggestedUseText(message) {
  const match = String(message || "").match(/use (.*?), or use exact line mode/i);
  return match ? match[1] : "";
}

function recommendedBraidMinimum(reel) {
  const match = String(reel.reelcalc_recommended_braid || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function recommendedBraidRange(reel) {
  const values = String(reel.reelcalc_recommended_braid || "").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  return values.length ? [values[0], values[1] || values[0]] : null;
}

function allowedBraidMinimum(reel) {
  const configured = recommendedBraidMinimum(reel);
  const published = core.publishedBraidCapacityOptions(reel).map((option) => Number(option.lb));
  const publishedMinimum = published.length ? Math.min(...published) : 0;
  if (configured > 0 && publishedMinimum > 0) return Math.min(configured, publishedMinimum);
  return configured || publishedMinimum;
}

function unrealisticReason(reel, fishingType, setup) {
  const size = reelSize(reel);
  if (!setup) return "";
  const lb = Number(setup.line && setup.line.lb);
  const capacity = Number(setup.capacityYards);
  const braid = String(setup.line?.type || "").toLowerCase().includes("braid");

  if (isBaitcaster(reel)) {
    if (braid && capacity > 325) return "baitcaster braid recommendations must stay at or below 325 estimated yards";
    const cap = Number(baitcasterBraidCaps[fishingType]?.[setup.useCase]);
    if (braid && cap > 0 && lb > cap) return `${setup.title} exceeds the ${cap} lb ${fishingType} technique cap`;
    if (braid && lb >= 40 && /thin, sensitive, and easy to cast/i.test(String(setup.explanation || ""))) {
      return "heavy braid must not be described as thin and easy-casting";
    }
    return "";
  }

  if (size >= 4000 && fishingType === "trout") {
    return "trout/panfish recommendations should not appear on 4000+ size reels";
  }
  if (size < 1000 && ["bass", "walleye"].includes(fishingType)) {
    return `${fishingType} recommendations should not appear on sub-1000 size reels`;
  }
  if (size >= 5000 && ["bass", "walleye", "freshwater"].includes(fishingType)) {
    return `${fishingType} recommendations should not appear on 5000+ size reels`;
  }
  if (size >= 8000 && fishingType === "inshore") {
    return "inshore recommendations should not appear on 8000+ size reels";
  }
  if (size < 2500 && fishingType === "inshore") {
    return "inshore recommendations should not appear on sub-2500 size reels";
  }
  if (size < 3500 && fishingType === "surf") {
    return "surf/heavy saltwater recommendations should not appear on sub-3500 size reels";
  }
  if (size >= 8000 && lb < 30) {
    return "8000+ size reels should not get a light-line best pick";
  }
  if (size >= 10000 && capacity > 3000) {
    return "10000+ size reels should not show huge-yardage light-line recommendations";
  }
  return "";
}

const rows = [];
const failures = [];
const allReadyFailures = [];

for (const reel of representativeReels()) {
  for (const fishingType of fishingTypes) {
    const compatibility = engine.recommendationCompatibility(reel, fishingType);
    const { setups, top } = topSetup(reel, fishingType);
    const blocked = compatibility && compatibility.recommend === false;
    const reason = top ? unrealisticReason(reel, fishingType, top) : "";

    rows.push({
      reel: reelLabel(reel),
      size: reelSize(reel),
      fishingType,
      status: blocked ? "blocked" : "cards",
      top: top ? `${top.line.lb} lb ${String(top.line.type).toLowerCase()} / ${Math.round(top.capacityYards)} yd / ${top.title}` : "no cards",
    });

    if (blocked) {
      if (setups.length) {
        failures.push(`${reelLabel(reel)} / ${fishingType}: compatibility blocked but ${setups.length} cards were returned`);
      }
      continue;
    }

    if (!top) {
      failures.push(`${reelLabel(reel)} / ${fishingType}: expected setup cards but none were returned`);
      continue;
    }

    if (reason) {
      failures.push(`${reelLabel(reel)} / ${fishingType}: ${reason}; got ${rows[rows.length - 1].top}`);
    }
  }
}

for (const reel of reels.filter(isReady)) {
  for (const fishingType of fishingTypes) {
    const compatibility = engine.recommendationCompatibility(reel, fishingType);
    const { setups, top } = topSetup(reel, fishingType);
    const blocked = compatibility && compatibility.recommend === false;

    if (blocked && setups.length) {
      allReadyFailures.push(`${reelLabel(reel)} / ${fishingType}: compatibility blocked but ${setups.length} cards were returned`);
      continue;
    }
    const suggestedText = suggestedUseText(compatibility.message);
    if (blocked && !isBaitcaster(reel) && reelSize(reel) < 1000 && /\b(bass|walleye)\b/i.test(suggestedText)) {
      allReadyFailures.push(`${reelLabel(reel)} / ${fishingType}: small-reel message suggests bass or walleye, which is also blocked`);
      continue;
    }
    if (blocked && !isBaitcaster(reel) && reelSize(reel) < 2500 && /inshore saltwater/i.test(suggestedText)) {
      allReadyFailures.push(`${reelLabel(reel)} / ${fishingType}: small-reel message suggests inshore, which is also blocked`);
      continue;
    }

    if (!blocked && top) {
      const reason = unrealisticReason(reel, fishingType, top);
      if (reason) {
        allReadyFailures.push(`${reelLabel(reel)} / ${fishingType}: ${reason}; got ${top.line.lb} lb ${String(top.line.type).toLowerCase()} / ${Math.round(top.capacityYards)} yd / ${top.title}`);
      }
      const bestOverall = setups.find((setup) => setup.useCase === "best-overall" && String(setup.line.type).toLowerCase().includes("braid"));
      const minimumBraid = isBaitcaster(reel) ? allowedBraidMinimum(reel) : recommendedBraidMinimum(reel);
      if (bestOverall && minimumBraid > 0 && Number(bestOverall.line.lb) < minimumBraid) {
        allReadyFailures.push(`${reelLabel(reel)} / ${fishingType}: Best Overall ${bestOverall.line.lb} lb braid is below the reel-specific ${minimumBraid} lb practical minimum`);
      }
      if (isBaitcaster(reel)) {
        const heavyCover = setups.find((setup) => setup.useCase === "heavy-cover" && String(setup.line.type).toLowerCase().includes("braid"));
        const configuredRange = recommendedBraidRange(reel);
        if (bestOverall && heavyCover && configuredRange && configuredRange[1] > configuredRange[0] && Number(bestOverall.line.lb) >= Number(heavyCover.line.lb)) {
          allReadyFailures.push(`${reelLabel(reel)} / ${fishingType}: Best Overall ${bestOverall.line.lb} lb is not lighter than Heavy Cover ${heavyCover.line.lb} lb`);
        }
      }
    }
  }
}

console.log("Recommendation sanity audit");
for (const row of rows) {
  console.log(`${String(row.size).padStart(5)} | ${row.fishingType.padEnd(10)} | ${row.status.padEnd(7)} | ${row.top} | ${row.reel}`);
}

assert(failures.length === 0, `\nSanity failures:\n- ${failures.join("\n- ")}`);
assert(allReadyFailures.length === 0, `\nAll-reel sanity failures:\n- ${allReadyFailures.join("\n- ")}`);
console.log(`\nPassed ${rows.length} representative reel/fishing-type combinations.`);
console.log(`Scanned ${reels.filter(isReady).length} ready reels across ${fishingTypes.length} fishing types.`);
