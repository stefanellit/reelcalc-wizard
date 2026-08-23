export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function reelDisplayName(reel) {
  return [reel.brand, reel.model, reel.size_label].filter(Boolean).join(" ");
}

function reelSearchText(reel) {
  return normalizeText([
    reel.id,
    reel.brand,
    reel.model,
    reel.size_label,
    reel.size_class,
    reel.sku,
    reel.search_text
  ].filter(Boolean).join(" "));
}

export function resolveReel(reels, query) {
  const requested = String(query || "").trim();
  const normalized = normalizeText(requested);
  if (!normalized) {
    return { status: "missing-query", matches: [] };
  }

  const exact = reels.filter((reel) =>
    String(reel.id || "").toLowerCase() === requested.toLowerCase() ||
    String(reel.sku || "").toLowerCase() === requested.toLowerCase()
  );
  if (exact.length === 1) return { status: "resolved", reel: exact[0], matches: exact };
  if (exact.length > 1) return { status: "ambiguous", matches: exact };

  const exactName = reels.filter((reel) =>
    normalizeText(reelDisplayName(reel)) === normalized
  );
  if (exactName.length === 1) return { status: "resolved", reel: exactName[0], matches: exactName };
  if (exactName.length > 1) return { status: "ambiguous", matches: exactName };

  const tokens = normalized.split(" ").filter(Boolean);
  const matches = reels.filter((reel) => {
    const haystack = reelSearchText(reel);
    return tokens.every((token) => haystack.split(" ").includes(token));
  });

  if (matches.length === 1) return { status: "resolved", reel: matches[0], matches };
  if (matches.length > 1) return { status: "ambiguous", matches };
  return { status: "not-found", matches: [] };
}

export function parseCapacityNote(value) {
  const text = String(value || "");
  const rows = [];
  const pattern = /(PE\s*#?\s*)?(\d+(?:\.\d+)?)\s*(?:lb\s*)?[-/]\s*(\d+(?:\.\d+)?)\s*(m|yds?|yards?)?/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const ratingType = match[1] ? "PE" : "lb";
    const sourceLength = Number(match[3]);
    const sourceUnit = /^m$/i.test(match[4] || "") ? "m" : "yd";
    rows.push({
      lb: Number(match[2]),
      yards: sourceUnit === "m" ? Math.round(sourceLength * 1.0936133 * 10) / 10 : sourceLength,
      ratingType,
      sourceLength,
      sourceUnit
    });
  }
  return rows;
}

export function normalizeReel(reel) {
  const monoCapacities = Array.isArray(reel.capacity_options)
    ? reel.capacity_options
        .filter((item) => Number(item.lb) > 0 && Number(item.yards) > 0)
        .map((item) => ({
          lb: Number(item.lb),
          yards: Number(item.yards),
          diameterIn: Number(item.diameter_in) || null
        }))
    : [];
  const braidCapacities = parseCapacityNote(reel.braid_capacity_note);

  return {
    id: reel.id,
    brand: reel.brand,
    model: reel.model,
    sizeLabel: reel.size_label,
    sizeClass: reel.size_class,
    recommendationSizeClass: Number(reel.recommendation_size_class) || Number(String(reel.size_class || "").match(/\d+/)?.[0] || 0),
    sku: reel.sku,
    reelType: reel.reel_type,
    baitcasterClass: reel.baitcaster_class || "",
    retrieveHand: reel.retrieve_hand || "",
    marketRegion: reel.market_region || "",
    releaseYear: reel.release_year || null,
    currentStatus: reel.current_status || "",
    capacityYards: Number(reel.capacity_yards),
    ratedLineLb: Number(reel.rated_line_lb),
    ratedLineDiameterIn: Number(reel.rated_line_diameter_in),
    monoCapacities,
    braidCapacities,
    gearRatio: reel.gear_ratio,
    retrieveIn: Number(reel.line_retrieve_in),
    weightOz: Number(reel.weight_oz),
    maxDragLb: Number(reel.max_drag_lb),
    bearings: reel.bearings,
    recommendedBraid: reel.reelcalc_recommended_braid,
    recommendedMonoFluoro: reel.reelcalc_recommended_mono_fluoro,
    useCase: reel.reelcalc_use_case,
    sourceName: reel.capacity_data_source,
    sourceUrl: reel.source_url,
    sourceFile: reel.source_file,
    capacityStatus: reel.capacity_status,
    capacityReferenceType: reel.capacity_reference_type || "",
    warnings: Array.isArray(reel.data_warnings) ? reel.data_warnings : [],
    displayName: reelDisplayName(reel),
    raw: reel
  };
}

export function requiredDataProblems(reel) {
  const checks = [
    ["id", reel.id],
    ["brand", reel.brand],
    ["model", reel.model],
    ["size_label", reel.sizeLabel],
    ["sku", reel.sku],
    ["capacity_yards", reel.capacityYards > 0],
    ["rated_line_lb", reel.ratedLineLb > 0],
    ["rated_line_diameter_in", reel.ratedLineDiameterIn > 0],
    ["published capacity rows", reel.monoCapacities.length > 0 || reel.braidCapacities.length > 0],
    ["gear_ratio", reel.gearRatio],
    ["line_retrieve_in", reel.retrieveIn > 0],
    ["weight_oz", reel.weightOz > 0],
    ["max_drag_lb", reel.maxDragLb > 0],
    ["bearings", reel.bearings],
    ["reelcalc_recommended_braid", reel.recommendedBraid],
    ["reelcalc_recommended_mono_fluoro", reel.recommendedMonoFluoro],
    ["reelcalc_use_case", reel.useCase],
    ["source_url", reel.sourceUrl],
    ["source_file", reel.sourceFile]
  ];

  const problems = checks
    .filter(([, value]) => !value)
    .map(([field]) => field);
  if (reel.capacityStatus !== "ready") problems.push("capacity_status");
  if (reel.warnings.length) problems.push("data_warnings: " + reel.warnings.join("; "));
  return problems;
}
