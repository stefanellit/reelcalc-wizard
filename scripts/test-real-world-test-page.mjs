import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const pagePath = path.join(
  root,
  "examples",
  "reel-tests",
  "penn-fierce-iv-8000-line-capacity-test.html"
);
const dataPath = path.join(root, "data", "real-world-tests.json");
const outputPath = path.join(
  root,
  "reports",
  "real-world-test-001-qa.json"
);
const blogGeneratedPath = path.join(
  root,
  "generated",
  "reel-tests",
  "penn-fierce-iv-8000-line-capacity-test-squarespace-blog.html"
);

const [html, dataText, blogGenerated] = await Promise.all([
  fs.readFile(pagePath, "utf8"),
  fs.readFile(dataPath, "utf8"),
  fs.readFile(blogGeneratedPath, "utf8")
]);
const data = JSON.parse(dataText);
const test = data.tests.find((entry) => entry.id === "reelcalc-real-world-test-001");
const checks = [];

function check(name, passed, detail = "") {
  checks.push({ name, passed: Boolean(passed), detail });
}

function closeTo(actual, expected, tolerance = 0.001) {
  return Math.abs(actual - expected) <= tolerance;
}

check("test record exists", Boolean(test));
check("one H1", (html.match(/<h1(?:\s|>)/g) || []).length === 1);
check("canonical present", html.includes("https://www.reelcalc.com/reel-tests/penn-fierce-iv-8000-line-capacity-test"));
check("Article schema present", html.includes('"@type": "Article"'));
check("Breadcrumb schema present", html.includes('"@type": "BreadcrumbList"'));
check("stable reel ID used", html.includes("penn-fierce-iv-8000-frciv8000-474"));
check("preloaded line ID used", html.includes("reaction-tackle-braid-braid-30"));
check("prediction chronology stated", html.includes("completed and recorded before the physical backing amount was known"));
check("proper fill observation stated", html.includes("finished spool appeared properly filled"));
check("printed-diameter caveat retained", html.includes("probably would have overfilled this spool"));
check("no calculation-type label", !new RegExp(["hy", "brid"].join(""), "i").test(html));
check("Rapala counter Amazon affiliate link", html.includes("amazon.com/s?k=Rapala+RDLC+Digital+Line+Counter&amp;tag=reelcalc-20") && html.includes('data-product-role="tool"'));
check("calculator caption stays user-focused", html.includes("were entered into ReelCalc as shown") && !/recreat|original pre-test screenshot/i.test(html));
check("no universal accuracy claim", !html.includes("ReelCalc is 99.8% accurate"));
check("no invented ideal backing", !html.includes("200 yards would be perfect"));
check("recorded Uni-to-Uni knot named", /Uni-to-Uni knot/.test(html) && test.physicalResult.connectionKnot === "Uni-to-Uni knot");
check("no undefined text", !html.includes("undefined"));
check("blog snippet has one ReelCalc H1", (blogGenerated.match(/<h1(?:\s|>)/g) || []).length === 1);
check("blog snippet targets this test only", blogGenerated.includes('data-test-id="reelcalc-real-world-test-001"'));
check("blog snippet removes duplicate Squarespace header", blogGenerated.includes("nativeHeader.remove()") && blogGenerated.includes(".blog-item-top-wrapper"));
check("blog snippet verifies the exact page title", blogGenerated.includes("Penn Fierce IV 8000 Real-World Spool Test: 300 Yards of 30 lb Braid + Mono Backing"));
check("blog snippet remains an embeddable fragment", !/<!doctype|<html(?:\s|>)/i.test(blogGenerated));

const physicalBackingYards = test.backing.measuredFeet / 3;
const physicalBraidYards = test.mainLine.measuredFeet / 3;
const totalYards = physicalBackingYards + physicalBraidYards;
const predictionDifferenceYards = test.predictions.reelCalcBackingYards - physicalBackingYards;
const predictionDifferencePercent = (predictionDifferenceYards / physicalBackingYards) * 100;
const diameterYards = test.predictions.postTestDiameterBackingMeters * 1.093613;

check("600 ft equals 200 yd", closeTo(physicalBackingYards, 200));
check("900 ft equals 300 yd", closeTo(physicalBraidYards, 300));
check("total installed line length equals 500 yd", closeTo(totalYards, 500));
check("recorded prediction remains 207.4 yd", closeTo(test.predictions.reelCalcBackingYards, 207.4));
check("physical backing amount remains 200 yd", closeTo(test.physicalResult.backingYards, 200));
check("229 m equals about 250.4 yd", closeTo(diameterYards, 250.437377, 0.001));

const schemaMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
let schemaValid = false;
try {
  JSON.parse(schemaMatch ? schemaMatch[1] : "");
  schemaValid = true;
} catch {
  schemaValid = false;
}
check("JSON-LD parses", schemaValid);

const expectedImageFiles = test.images.map((image) => image.file);
const imageDir = path.join(root, "assets", "real-world-tests", "penn-fierce-iv-8000");
const missingImages = [];
for (const file of expectedImageFiles) {
  try {
    await fs.access(path.join(imageDir, file));
  } catch {
    missingImages.push(file);
  }
}

const failedChecks = checks.filter((item) => !item.passed);
const report = {
  testId: test.id,
  status: failedChecks.length ? "failed" : missingImages.length ? "content-ready-images-pending" : "passed",
  checksPassed: checks.length - failedChecks.length,
  checksTotal: checks.length,
  failedChecks,
  missingImages,
  arithmetic: {
    physicalBackingYards,
    physicalBraidYards,
    totalYards,
    predictionDifferenceYards,
    predictionDifferenceFeet: predictionDifferenceYards * 3,
    predictionDifferencePercent,
    diameterYards
  }
};

await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));

if (failedChecks.length) process.exitCode = 1;
