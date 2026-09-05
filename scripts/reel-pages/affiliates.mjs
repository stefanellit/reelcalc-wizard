const DEFAULT_AMAZON = {
  name: "Amazon",
  affiliateNetwork: "Amazon Associates",
  affiliateTag: "reelcalc-20",
  allowedHosts: ["amazon.com", "amzn.to"],
  directLabel: "Check Current Price on Amazon",
  searchLabel: "Search Amazon for This Reel",
  disclosure: "As an Amazon Associate, ReelCalc earns from qualifying purchases."
};

const GENERIC_DISCLOSURE =
  "ReelCalc may earn a commission from purchases made through these links, at no extra cost to you.";

function legacyAmazonOffer(mapping) {
  if (!mapping?.reelAffiliateUrl) return null;
  return {
    url: mapping.reelAffiliateUrl,
    matchType: "exact",
    verifiedExact: true,
    ...(mapping.productId ? { productId: mapping.productId } : {})
  };
}

export function normalizeAffiliateRegistry(raw = {}) {
  const retailers = {
    amazon: {
      ...DEFAULT_AMAZON,
      ...(raw.retailers?.amazon || {})
    },
    ...(raw.retailers || {})
  };
  const normalized = {
    ...structuredClone(raw),
    version: 2,
    retailerPriority: Array.isArray(raw.retailerPriority) && raw.retailerPriority.length
      ? [...raw.retailerPriority]
      : ["amazon"],
    genericDisclosure: raw.genericDisclosure || GENERIC_DISCLOSURE,
    retailers,
    lines: structuredClone(raw.lines || {}),
    lineProducts: structuredClone(raw.lineProducts || {}),
    reels: {}
  };

  Object.entries(raw.reels || {}).forEach(([reelId, mapping]) => {
    const offers = mapping?.offers && typeof mapping.offers === "object"
      ? structuredClone(mapping.offers)
      : {};
    const legacyOffer = legacyAmazonOffer(mapping);
    if (legacyOffer && !offers.amazon?.reel) {
      offers.amazon = { ...(offers.amazon || {}), reel: legacyOffer };
    }
    normalized.reels[reelId] = { offers };
  });

  return normalized;
}

export function amazonSearchQuery(reel) {
  return [reel?.brand, reel?.model, reel?.size_label, reel?.sku]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, values) =>
      values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index
    )
    .join(" ");
}

export function buildAmazonSearchOffer(reel, retailer = DEFAULT_AMAZON) {
  const query = amazonSearchQuery(reel);
  if (!query) return null;
  const tag = String(retailer.affiliateTag || DEFAULT_AMAZON.affiliateTag).trim();
  const params = new URLSearchParams({ k: query });
  if (tag) params.set("tag", tag);
  return {
    url: `https://www.amazon.com/s?${params.toString()}`,
    matchType: "search",
    verifiedExact: false,
    searchQuery: query
  };
}

export function ensureAmazonReelOffer(registry, reel) {
  if (!registry.reels[reel.id]) registry.reels[reel.id] = { offers: {} };
  const mapping = registry.reels[reel.id];
  if (!mapping.offers) mapping.offers = {};
  if (!mapping.offers.amazon) mapping.offers.amazon = {};
  if (mapping.offers.amazon.reel?.url) return "existing";
  mapping.offers.amazon.reel = buildAmazonSearchOffer(reel, registry.retailers.amazon);
  return "created-search";
}

export function isAllowedRetailerUrl(value, retailer = {}) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    const allowedHosts = Array.isArray(retailer.allowedHosts) ? retailer.allowedHosts : [];
    return allowedHosts.some((allowedHost) => {
      const allowed = String(allowedHost || "").toLowerCase();
      return allowed && (host === allowed || host.endsWith(`.${allowed}`));
    });
  } catch {
    return false;
  }
}

export function resolvePreferredReelOffer(registry, reelId) {
  const mapping = registry?.reels?.[reelId];
  if (!mapping) return null;
  const priority = Array.isArray(registry.retailerPriority)
    ? registry.retailerPriority
    : [];

  for (const retailerId of priority) {
    const retailer = registry.retailers?.[retailerId];
    const offer = mapping.offers?.[retailerId]?.reel;
    if (!retailer || !offer || !isAllowedRetailerUrl(offer.url, retailer)) continue;
    const isSearch = offer.matchType === "search";
    return {
      retailerId,
      retailerName: retailer.name || retailerId,
      url: offer.url,
      matchType: isSearch ? "search" : "exact",
      label: offer.label || (isSearch ? retailer.searchLabel : retailer.directLabel) ||
        `Check Current Price at ${retailer.name || retailerId}`,
      disclosure: [registry.genericDisclosure, retailer.disclosure].filter(Boolean).join(" "),
      productId: offer.productId || null
    };
  }
  return null;
}
