import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const research = JSON.parse(fs.readFileSync(
  path.join(root, "research", "baitcaster-database", "recommended-first-500.json"),
  "utf8"
));
const registry = JSON.parse(fs.readFileSync(path.join(root, "data", "reel-pages.json"), "utf8"));
const imageOverrides = JSON.parse(fs.readFileSync(
  path.join(root, "research", "baitcaster-database", "official-image-overrides.json"),
  "utf8"
));
const outputPath = path.join(root, "reports", "baitcaster-page-image-candidates-500.json");
const imageDir = path.join(root, "assets", "reel-page-images");
const previousReport = fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
  : { families: [] };
const previousByFamily = new Map((previousReport.families || []).map((family) => [family.family, family]));
const registeredByReelId = new Map((registry.pages || []).map((page) => [page.reelId, page]));

function familyKey(record) {
  return `${record.brand}|${record.model}`;
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return result;
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function imageFromHtml(html, pageUrl) {
  const candidates = [];
  const tackleWarehouseImages = [...html.matchAll(/https:\/\/img\.tacklewarehouse\.com\/watermark\/rs\.php\?path=[^"'<>\s]+/gi)]
    .map((match) => decodeHtml(match[0]))
    .filter((value) => /(?:^|[?&])path=[^&]+\.(?:avif|jpe?g|png|webp)(?:&|$)/i.test(value))
    .sort((a, b) => {
      const aWidth = Number(new URL(a).searchParams.get("nw")) || 0;
      const bWidth = Number(new URL(b).searchParams.get("nw")) || 0;
      return bWidth - aWidth;
    });
  if (tackleWarehouseImages.length) {
    candidates.push({ metadataField: "exact-retailer-product-image", value: tackleWarehouseImages[0] });
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    const key = String(attrs.property || attrs.name || "").toLowerCase();
    if (["og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"].includes(key)) {
      candidates.push({ metadataField: key, value: attrs.content });
    }
  }
  const imageLink = (html.match(/<link\b[^>]*rel=["']image_src["'][^>]*>/i) || [])[0];
  if (imageLink) {
    candidates.push({ metadataField: "image_src", value: attributes(imageLink).href });
  }

  for (const candidate of candidates) {
    try {
      return {
        imageUrl: new URL(decodeHtml(candidate.value), pageUrl).href,
        metadataField: candidate.metadataField
      };
    } catch {}
  }
  return null;
}

function exactEvidence(record) {
  const evidence = Array.isArray(record.source_evidence) ? record.source_evidence : [];
  return evidence.filter((item) => item?.exact_sku && item?.url);
}

function sourcePriority(item) {
  if (String(item.source_type).startsWith("official_manufacturer")) return 0;
  if (item.source_type === "major_retailer") return 1;
  return 2;
}

function sourceCandidates(record) {
  return exactEvidence(record)
    .sort((a, b) => sourcePriority(a) - sourcePriority(b))
    .map((item) => ({
      sourceUrl: item.url,
      sourceType: item.source_type,
      sourceName: item.source_name
    }));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeout);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let response;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    response = await fetchWithTimeout(url, options);
    if (response.status !== 429 && response.status !== 503) return response;
    if (attempt < attempts - 1) await wait(1200 * (attempt + 1));
  }
  return response;
}

async function findSourceImage(source) {
  try {
    const response = await fetchWithRetry(source.sourceUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; ReelCalcPageBuilder/1.0; +https://www.reelcalc.com)"
      }
    });
    const html = await response.text();
    const image = imageFromHtml(html, response.url);
    return {
      ...source,
      finalUrl: response.url,
      pageStatus: response.status,
      imageUrl: image?.imageUrl || null,
      metadataField: image?.metadataField || null,
      error: response.ok ? (image ? null : "No product image metadata found") : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ...source,
      finalUrl: null,
      pageStatus: null,
      imageUrl: null,
      metadataField: null,
      error: error.name === "AbortError" ? "timeout" : error.message
    };
  }
}

function imageExtension(contentType, imageUrl) {
  const normalized = String(contentType || "").toLowerCase().split(";")[0];
  const known = {
    "image/avif": ".avif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
  };
  if (known[normalized]) return known[normalized];
  const urlExtension = path.extname(new URL(imageUrl).pathname).toLowerCase();
  return [".avif", ".jpeg", ".jpg", ".png", ".webp"].includes(urlExtension)
    ? (urlExtension === ".jpeg" ? ".jpg" : urlExtension)
    : ".jpg";
}

async function cacheImage(family, candidate) {
  try {
    const response = await fetchWithRetry(candidate.imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
        Referer: candidate.finalUrl || candidate.sourceUrl,
        "User-Agent": "Mozilla/5.0 (compatible; ReelCalcPageBuilder/1.0; +https://www.reelcalc.com)"
      }
    });
    if (!response.ok) throw new Error(`image HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!/^image\//i.test(contentType)) throw new Error(`unexpected content type ${contentType || "missing"}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 2000) throw new Error(`image response too small (${bytes.length} bytes)`);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 20);
    const filename = `${hash}${imageExtension(contentType, candidate.imageUrl)}`;
    const target = path.join(imageDir, filename);
    if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);
    return {
      ...candidate,
      family,
      cachedFile: `assets/reel-page-images/${filename}`,
      cachedUrl: `${registry.assetBaseUrl}/assets/reel-page-images/${filename}`,
      contentType: contentType.split(";")[0],
      bytes: bytes.length,
      imageError: null
    };
  } catch (error) {
    return {
      ...candidate,
      family,
      cachedFile: null,
      cachedUrl: null,
      contentType: null,
      bytes: null,
      imageError: error.message
    };
  }
}

function shimanoImageCandidate(record) {
  if (record.brand !== "Shimano") return null;
  const official = sourceCandidates(record).find((source) =>
    String(source.sourceType).startsWith("official_manufacturer")
  );
  if (!official) return null;
  const productCode = new URL(official.sourceUrl).pathname
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/\.html$/i, "");
  if (!/^a[0-9a-z]+$/i.test(productCode || "")) return null;
  return {
    ...official,
    finalUrl: official.sourceUrl,
    pageStatus: 200,
    imageUrl: `https://dassets2.shimano.com/content/dam/Shimanofish/Common/Productsrelated/cg2SHIFGlobalREEL/cg3SHIFGlobalREELBaitReel/SICPlanningProducts/Product/PRD_${productCode}_main.jpg/jcr:content/renditions/cq5dam.web.481.481.jpeg`,
    metadataField: "official-product-code-image-pattern",
    error: null
  };
}

async function collectFamily(record) {
  const family = familyKey(record);
  const override = imageOverrides.families?.[family];
  const previous = previousByFamily.get(family);
  if (!override?.force && previous?.selected?.cachedFile && fs.existsSync(path.join(root, previous.selected.cachedFile))) {
    return previous;
  }

  const familyRecordIds = (research.records || [])
    .filter((item) => familyKey(item) === family)
    .map((item) => item.id);
  const registered = familyRecordIds.map((id) => registeredByReelId.get(id)).find((page) => page?.imageUrl);
  if (registered) {
    return {
      family,
      brand: record.brand,
      model: record.model,
      selected: {
        sourceUrl: registered.imageSourcePage || registered.imageOriginalUrl,
        sourceType: "verified_registry",
        sourceName: registered.imageSource,
        finalUrl: registered.imageSourcePage || registered.imageOriginalUrl,
        pageStatus: 200,
        imageUrl: registered.imageOriginalUrl || registered.imageUrl,
        metadataField: "verified-registry",
        error: null,
        cachedFile: registered.imageUrl.startsWith(registry.assetBaseUrl)
          ? registered.imageUrl.slice(registry.assetBaseUrl.length + 1)
          : null,
        cachedUrl: registered.imageUrl,
        contentType: null,
        bytes: null,
        imageError: null
      },
      attempts: []
    };
  }

  const attempts = [];
  if (override?.imageUrl) {
    const exactOfficialSource = sourceCandidates(record).find((source) =>
      String(source.sourceType).startsWith("official_manufacturer") && source.sourceUrl === override.sourceUrl
    );
    if (exactOfficialSource) {
      const candidate = {
        ...exactOfficialSource,
        finalUrl: override.sourceUrl,
        pageStatus: 200,
        imageUrl: override.imageUrl,
        metadataField: "verified-case-sensitive-official-image",
        error: null
      };
      const cached = await cacheImage(family, candidate);
      attempts.push(cached);
      if (cached.cachedUrl) {
        return { family, brand: record.brand, model: record.model, selected: cached, attempts };
      }
    }
  }
  if (override?.fallback?.sourceUrl) {
    const fallbackSource = {
      sourceUrl: override.fallback.sourceUrl,
      sourceType: "reputable_tackle_retailer",
      sourceName: override.fallback.sourceName || "Exact-family tackle retailer"
    };
    const candidate = override.fallback.imageUrl
      ? {
          ...fallbackSource,
          finalUrl: fallbackSource.sourceUrl,
          pageStatus: 200,
          imageUrl: override.fallback.imageUrl,
          metadataField: "curated-exact-family-retailer-image",
          error: null
        }
      : await findSourceImage(fallbackSource);
    attempts.push(candidate);
    if (candidate.imageUrl) {
      const cached = await cacheImage(family, candidate);
      attempts.push(cached);
      if (cached.cachedUrl) {
        return { family, brand: record.brand, model: record.model, selected: cached, attempts };
      }
    }
  }
  const shimanoCandidate = shimanoImageCandidate(record);
  if (shimanoCandidate) {
    const cached = await cacheImage(family, shimanoCandidate);
    attempts.push(cached);
    if (cached.cachedUrl) {
      return { family, brand: record.brand, model: record.model, selected: cached, attempts };
    }
  }
  for (const source of sourceCandidates(record)) {
    const candidate = await findSourceImage(source);
    attempts.push(candidate);
    if (!candidate.imageUrl) continue;
    const cached = await cacheImage(family, candidate);
    if (cached.cachedUrl) {
      return { family, brand: record.brand, model: record.model, selected: cached, attempts };
    }
    attempts.push({ ...candidate, error: cached.imageError });
  }
  return { family, brand: record.brand, model: record.model, selected: null, attempts };
}

async function mapLimit(items, limit, work) {
  const output = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      output[index] = await work(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

const records = research.records || [];
const familyRecords = [...new Map(records.map((record) => [familyKey(record), record])).values()];
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.mkdirSync(imageDir, { recursive: true });

const families = await mapLimit(familyRecords, 2, async (record) => {
  const result = await collectFamily(record);
  await wait(250);
  return result;
});
const report = {
  generatedAt: new Date().toISOString(),
  sourceRecordCount: records.length,
  familyCount: familyRecords.length,
  summary: {
    familiesWithImages: families.filter((family) => family.selected?.cachedUrl).length,
    missingImages: families.filter((family) => !family.selected?.cachedUrl).length,
    officialImages: families.filter((family) => String(family.selected?.sourceType).startsWith("official_manufacturer")).length,
    retailerFallbackImages: families.filter((family) => family.selected?.sourceType === "major_retailer").length
  },
  families
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary, null, 2));
console.log(outputPath);
