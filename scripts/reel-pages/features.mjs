function familyKey(reel) {
  return `${reel.brand}|${reel.model}`;
}

function normalizedSize(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function officialProductIdentity(value) {
  try {
    const url = new URL(value);
    const productCode = url.pathname.split("/").filter(Boolean).at(-1)?.replace(/\.html$/i, "");
    return `${url.hostname.toLowerCase()}|${String(productCode || "").toLowerCase()}`;
  } catch {
    return "";
  }
}

export function featureProfileFor(reel, catalog) {
  const profile = catalog?.families?.[familyKey(reel)];
  if (!profile) {
    return {
      key: familyKey(reel),
      verification: "exact-specification-fallback",
      sourceUrl: reel.sourceUrl,
      terms: [],
      missingProfile: true
    };
  }

  const sizeValues = [reel.sizeLabel, reel.sizeClass]
    .map(normalizedSize)
    .filter(Boolean);
  const excluded = new Set();
  for (const [size, terms] of Object.entries(profile.excludedBySize || {})) {
    const normalized = normalizedSize(size);
    if (sizeValues.some((value) => value === normalized || value.includes(normalized))) {
      terms.forEach((term) => excluded.add(term));
    }
  }

  const profileIdentity = officialProductIdentity(profile.sourceUrl);
  const reelIdentity = officialProductIdentity(reel.sourceUrl);
  const equivalentOfficialProduct = profileIdentity && profileIdentity === reelIdentity;

  return {
    ...profile,
    key: familyKey(reel),
    sourceUrl: equivalentOfficialProduct ? reel.sourceUrl : profile.sourceUrl,
    catalogSourceUrl: profile.sourceUrl,
    equivalentOfficialProduct,
    terms: (profile.terms || []).filter((term) => !excluded.has(term.name)),
    excludedTerms: [...excluded],
    missingProfile: false
  };
}

export function featureSentence(profile) {
  const terms = (profile?.terms || []).slice(0, 3);
  if (!terms.length) return "";
  if (terms.length === 1) return `${terms[0].name} ${terms[0].clause}.`;
  if (terms.length === 2) {
    return `${terms[0].name} ${terms[0].clause}, while ${terms[1].name} ${terms[1].clause}.`;
  }
  return `${terms[0].name} ${terms[0].clause}; ${terms[1].name} ${terms[1].clause}; and ${terms[2].name} ${terms[2].clause}.`;
}
