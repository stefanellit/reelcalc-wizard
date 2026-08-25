import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateReelPage } from "./generate-reel-page.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "outputs", "reel-page-baitcaster-500");
const previewDir = path.join(root, "generated", "reel-pages", "baitcaster-500");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (filePath, value) => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

function slugify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function shortHash(value, length = 18) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(rows) {
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function sanitizeSquarespaceDescription(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?(?:article|section)\b[^>]*>/gi, "")
    .replace(/\s(?:class|id|data-[\w-]+|hidden|loading)=(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/\sdata-[\w-]+(?=\s|>)/gi, "")
    .replace(/\shidden(?=\s|>)/gi, "")
    .trim();
}

function displayName(reel) {
  return [reel.brand, reel.model, reel.size_label].filter(Boolean).join(" ");
}

function seoTitleFor(reel) {
  const full = `${displayName(reel)} Line Capacity & Setup | ReelCalc`;
  if (full.length <= 68) return full;
  const compact = `${reel.brand} ${reel.model} ${reel.sku} Line Capacity | ReelCalc`;
  if (compact.length <= 68) return compact;
  return `${reel.brand} ${reel.sku} Line Capacity & Setup | ReelCalc`;
}

function metaDescriptionFor(reel) {
  const full = `${displayName(reel)} line capacity, exact specifications, recommended braid and mono, backing guidance, and a preloaded ReelCalc calculator.`;
  if (full.length <= 160) return full;
  return `${reel.brand} ${reel.sku} line capacity, exact specifications, recommended braid and mono, backing guidance, and a preloaded ReelCalc calculator.`;
}

function familyKey(reel) {
  return `${reel.brand}|${reel.model}`;
}

const headers = [
  "Product ID [Non Editable]", "Variant ID [Non Editable]", "Product Type [Non Editable]",
  "Product Page", "Product URL", "Title", "Description", "SKU", "GTIN", "MPN",
  "Option Name 1", "Option Value 1", "Option Name 2", "Option Value 2", "Option Name 3",
  "Option Value 3", "Price", "Sale Price", "On Sale", "Stock", "Categories", "Tags",
  "Weight", "Length", "Width", "Height", "Visible", "Hosted Image URLs"
];

const reels = readJson("data/reels.json");
const lines = readJson("data/lines.json");
const liveRegistry = readJson("data/reel-pages.json");
const liveEmbeds = readJson("data/reel-page-embeds.json");
const affiliates = readJson("data/reel-affiliates.json");
const featureCatalog = readJson("data/reel-family-features.json");
const readiness = readJson("reports/baitcaster-page-catalog-readiness-500.json");
const imageReport = readJson("reports/baitcaster-page-image-candidates-500.json");

const reelById = new Map(reels.map((reel) => [reel.id, reel]));
const imageByFamily = new Map(imageReport.families.map((family) => [family.family, family.selected]));
const liveById = new Map(liveRegistry.pages.map((page) => [page.reelId, page]));
const livePaths = new Set(liveRegistry.pages.map((page) => page.path));
const canonicalReels = readiness.pageReelIds.map((id) => reelById.get(id));
if (canonicalReels.some((reel) => !reel)) throw new Error("A canonical page reel is missing from data/reels.json.");
if (canonicalReels.length !== 498) throw new Error(`Expected 498 canonical baitcasters, found ${canonicalReels.length}.`);

const newPages = [];
const candidatePages = [];
for (const reel of canonicalReels) {
  const existing = liveById.get(reel.id);
  if (existing) {
    candidatePages.push(existing);
    continue;
  }
  const image = imageByFamily.get(familyKey(reel));
  if (!image?.cachedUrl || !image?.sourceUrl || !image?.imageUrl) {
    throw new Error(`${reel.id}: exact-family image evidence is incomplete.`);
  }
  const slug = slugify(reel.id);
  const page = {
    reelId: reel.id,
    path: `/reel-pages/p/${slug}`,
    family: slugify(`${reel.brand}-${reel.model}`),
    imageUrl: image.cachedUrl,
    imageOriginalUrl: image.imageUrl,
    imageAlt: `${displayName(reel)} baitcasting reel`,
    imageSource: image.sourceName || "Exact-family product image",
    imageSourcePage: image.sourceUrl,
    imageMethod: image.metadataField || image.sourceType,
    verifiedLive: false,
    quickAnswerNote: "A short mono base can prevent braid slip and reduce how much premium line is needed."
  };
  if (livePaths.has(page.path)) throw new Error(`${reel.id}: page URL already exists.`);
  livePaths.add(page.path);
  newPages.push(page);
  candidatePages.push(page);
}

if (newPages.length !== 480) throw new Error(`Expected 480 new pages after the 18-page pilot, found ${newPages.length}.`);
const stagedRegistry = {
  ...liveRegistry,
  version: Math.max(Number(liveRegistry.version) || 1, 6),
  generatedAt: new Date().toISOString(),
  pages: [...liveRegistry.pages, ...newPages]
};

const generatedById = new Map();
for (const reel of canonicalReels) {
  const generated = generateReelPage(reel.id, {
    reels,
    lines,
    registry: stagedRegistry,
    affiliates,
    featureCatalog
  });
  if (generated.status !== "generated") {
    throw new Error(`${reel.id} failed generation: ${JSON.stringify(generated.problems || generated.validation?.failures)}`);
  }
  generated.model.seoTitle = seoTitleFor(reel);
  generated.model.metaDescription = metaDescriptionFor(reel);
  generatedById.set(reel.id, generated);
}

const productUrls = new Set();
const importSkus = new Set();
const csvRows = newPages.map((page) => {
  const reel = reelById.get(page.reelId);
  const generated = generatedById.get(page.reelId);
  const productSlug = page.path.split("/").at(-1);
  const importSku = `RCB${shortHash(reel.id).toUpperCase()}`;
  if (productUrls.has(productSlug)) throw new Error(`Duplicate product URL: ${productSlug}`);
  if (importSkus.has(importSku)) throw new Error(`Duplicate import SKU: ${importSku}`);
  productUrls.add(productSlug);
  importSkus.add(importSku);
  return [
    "", "", "SERVICE", "reel-pages", productSlug, generated.model.pageTitle,
    sanitizeSquarespaceDescription(generated.productionBlock), importSku, "", reel.sku,
    "", "", "", "", "", "", "0", "", "No", "Unlimited", "",
    "reelcalc-reel-guide,baitcaster-reel-guide", "", "", "", "", "Yes", ""
  ];
});

const stagedEmbeds = structuredClone(liveEmbeds);
stagedEmbeds.version = Math.max(Number(stagedEmbeds.version) || 1, 6);
for (const page of newPages) {
  const reel = reelById.get(page.reelId);
  const generated = generatedById.get(page.reelId);
  const slug = page.path.split("/").at(-1);
  stagedEmbeds.pages[slug] = {
    reelId: reel.id,
    pageTitle: generated.model.pageTitle,
    seoTitle: generated.model.seoTitle,
    metaDescription: generated.model.metaDescription,
    canonicalPath: page.path,
    imageUrl: page.imageUrl,
    imageAlt: page.imageAlt,
    intro: generated.model.intro,
    introVariant: generated.model.introVariant,
    introDetailMode: generated.model.introDetailMode,
    introFeatureNames: generated.model.introFeatureNames,
    introEvidenceSource: generated.model.introEvidenceSource,
    introEvidenceKey: generated.model.introEvidenceKey,
    related: generated.model.related,
    sizeGuide: null,
    calculator: generated.model.calculatorDefaults,
    content: {
      who: generated.model.who,
      setupIntro: generated.model.setupIntro,
      setupRows: generated.model.recommendation.rows,
      capacityIntro: generated.model.capacityIntro,
      capacityRows: generated.model.capacityRows,
      monoText: generated.model.monoText,
      braidText: generated.model.braidText,
      faqCapacity: generated.model.faqCapacity,
      specsIntro: generated.model.specsIntro
    }
  };
}

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });
const masterCsv = path.join(outputDir, "UPLOAD-THIS-reelcalc-baitcaster-pages-480.csv");
fs.writeFileSync(masterCsv, rowsToCsv([headers, ...csvRows]), "utf8");
const partSize = 120;
for (let index = 0; index < csvRows.length; index += partSize) {
  const part = index / partSize + 1;
  fs.writeFileSync(
    path.join(outputDir, `RECOVERY-ONLY-part-${part}-of-4.csv`),
    rowsToCsv([headers, ...csvRows.slice(index, index + partSize)]),
    "utf8"
  );
}
writeJson(path.join(outputDir, "ACTIVATE-AFTER-IMPORT-reel-pages.json"), stagedRegistry);
writeJson(path.join(outputDir, "ACTIVATE-AFTER-IMPORT-reel-page-embeds.json"), stagedEmbeds);

for (const reel of canonicalReels) {
  const generated = generatedById.get(reel.id);
  const localPreview = generated.previewDocument.replaceAll(
    `${liveRegistry.assetBaseUrl}/assets/`,
    "../../../assets/"
  );
  fs.writeFileSync(path.join(previewDir, `${reel.id}-preview.html`), `${localPreview}\n`, "utf8");
}

const review = {
  generatedAt: new Date().toISOString(),
  databaseRows: 500,
  canonicalPhysicalVariants: canonicalReels.length,
  alreadyLivePilotPages: canonicalReels.filter((reel) => liveById.has(reel.id)).length,
  newSquarespacePages: newPages.length,
  totalBaitcasterPagesAfterActivation: canonicalReels.length,
  uniqueProductUrls: productUrls.size,
  uniqueImportSkus: importSkus.size,
  stagedRegistryPages: stagedRegistry.pages.length,
  pages: canonicalReels.map((reel) => {
    const page = stagedRegistry.pages.find((candidate) => candidate.reelId === reel.id);
    const generated = generatedById.get(reel.id);
    return {
      reelId: reel.id,
      name: displayName(reel),
      manufacturerSku: reel.sku,
      retrieveHand: reel.retrieve_hand,
      marketRegion: reel.market_region || "US",
      pagePath: page.path,
      status: liveById.has(reel.id) ? "already-live-pilot" : "ready-to-import",
      seoTitle: generated.model.seoTitle,
      seoTitleLength: generated.model.seoTitle.length,
      metaDescription: generated.model.metaDescription,
      metaDescriptionLength: generated.model.metaDescription.length,
      introDetailMode: generated.model.introDetailMode,
      introFeatureNames: generated.model.introFeatureNames,
      wizardUrl: `https://www.reelcalc.com/reelcalc-wizard?reel=${encodeURIComponent(reel.id)}`,
      comparisonUrl: `https://www.reelcalc.com/reel-comparison?reel1=${encodeURIComponent(reel.id)}`,
      validationChecks: generated.validation.checks.length
    };
  })
};
writeJson(path.join(outputDir, "baitcaster-pages-review.json"), review);

const instructions = `# Start Here: Baitcaster Reel Pages\n\n` +
  `This release contains 480 new baitcaster pages. The 18 Shimano pilot pages are already live, producing 498 unique baitcaster reel pages after activation. Two duplicate database aliases are intentionally not separate pages.\n\n` +
  `1. Upload UPLOAD-THIS-reelcalc-baitcaster-pages-480.csv to the existing reel-pages Services collection.\n` +
  `2. Leave Update product quantities unchecked.\n` +
  `3. Upload the master file only once. The four RECOVERY-ONLY files are backups if Squarespace rejects the master file.\n` +
  `4. Wait for Squarespace to finish and confirm pages from several brands open normally.\n` +
  `5. Return to Codex. The two ACTIVATE files are published only after the pages exist, preventing broken guide-list and related-page links.\n`;
fs.writeFileSync(path.join(outputDir, "START-HERE-Squarespace-import-instructions.md"), instructions, "utf8");

console.log(JSON.stringify({
  status: "GENERATED",
  databaseRows: 500,
  canonicalPhysicalVariants: canonicalReels.length,
  alreadyLivePilotPages: review.alreadyLivePilotPages,
  newSquarespacePages: newPages.length,
  totalPagesAfterActivation: stagedRegistry.pages.length,
  masterCsv
}, null, 2));
