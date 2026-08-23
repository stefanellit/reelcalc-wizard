function parseStrengthRange(value) {
  const numbers = String(value || "").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (!numbers.length) return null;
  return {
    low: Math.min(...numbers),
    high: Math.max(...numbers)
  };
}

function formatRange(range, suffix) {
  if (!range) return "";
  const value = range.low === range.high ? String(range.low) : `${range.low}-${range.high}`;
  return `${value} lb ${suffix}`;
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function withLeader(lineSetup, leaderSetup) {
  const firstNumber = Number(String(leaderSetup).match(/\d+/)?.[0] || 0);
  const article = [8, 11, 18, 80].includes(firstNumber) ? "an" : "a";
  return `${lineSetup} with ${article} ${leaderSetup}`;
}

function isBaitcaster(reel) {
  return /baitcast|casting/.test(String(reel?.reelType || reel?.reel_type || "").toLowerCase());
}

function isHeavyDutyBaitcaster(reel) {
  return /^(?:power|deep_spool|heavy_duty|saltwater_low_profile|round_casting)$/i.test(
    String(reel?.baitcasterClass || reel?.raw?.baitcaster_class || "")
  );
}

function baitcasterRecommendationModel(reel, braid, mono, useCases) {
  const braidRange = formatRange(braid, "braid");
  const monoRange = formatRange(mono, "mono/fluoro");
  const braidLow = braid?.low || 30;
  const braidHigh = braid?.high || braidLow;
  const braidMiddle = [30, 40, 50, 60, 65, 80].find((value) =>
    value >= ((braidLow + braidHigh) / 2) && value <= braidHigh
  ) || braidHigh;
  const leaderRange = mono ? `${mono.low}-${mono.high} lb mono/fluoro leader` : monoRange;
  const rows = useCases.slice(0, 4).map((useCase) => {
    const normalized = useCase.toLowerCase();
    let setup;
    if (/frog|heavy cover|vegetation|flipping|pitching|swimbait|big bait|umbrella rig/.test(normalized)) {
      setup = `${braidMiddle}-${braidHigh} lb braid`;
    } else if (/crank|moving bait|topwater|spinnerbait|jerkbait/.test(normalized)) {
      setup = monoRange;
    } else {
      setup = withLeader(`${braidLow}-${braidMiddle} lb braid`, leaderRange);
    }
    return { use: titleCase(useCase), setup };
  });
  rows.push({ use: "Straight-line setup", setup: monoRange });

  return {
    heavyDuty: isHeavyDutyBaitcaster(reel),
    baitcaster: true,
    braidRange,
    monoRange,
    useCases,
    rows,
    quickAnswer: `For a versatile starting point, use ${monoRange} as a straight main line or ${braidRange} with a leader matched to the cover and lure.`,
    primarySetup: withLeader(`${braidLow} lb braid over monofilament backing`, leaderRange)
  };
}

function formatLeaderStrength(low, high, suffix) {
  const strength = low === high ? String(low) : `${low}-${high}`;
  return `${strength} lb ${suffix}`;
}

function specializedLeader(normalizedUse, braid) {
  if (/pike|muskie|musky/.test(normalizedUse)) {
    return "30-50 lb fluorocarbon or wire leader";
  }
  if (/catfish/.test(normalizedUse)) {
    const low = Math.max(20, braid?.low || 0);
    const high = Math.max(low, braid?.high || 30);
    return formatLeaderStrength(low, high, "monofilament leader");
  }
  if (/surf/.test(normalizedUse)) {
    const low = Math.max(30, braid?.low || 0);
    const high = Math.max(50, braid?.high || 0);
    return formatLeaderStrength(low, high, "mono/fluoro leader");
  }
  if (/salmon/.test(normalizedUse)) {
    return "20-30 lb mono/fluoro leader";
  }
  if (/heavy freshwater/.test(normalizedUse)) {
    return "20-30 lb mono/fluoro leader";
  }
  if (/tarpon|cobia/.test(normalizedUse)) {
    const low = Math.max(50, braid?.low || 0);
    const high = Math.max(80, braid?.high || 0);
    return formatLeaderStrength(low, high, "mono/fluoro leader");
  }
  if (/redfish|speckled trout/.test(normalizedUse)) {
    const low = Math.max(15, braid?.low || 0);
    const high = Math.max(20, Math.min(30, braid?.high || 0));
    return formatLeaderStrength(low, high, "mono/fluoro leader");
  }
  if (/light saltwater|light inshore/.test(normalizedUse)) {
    const low = Math.max(15, braid?.low || 0);
    const high = Math.max(low, Math.min(20, braid?.high || 20));
    return formatLeaderStrength(low, high, "mono/fluoro leader");
  }
  if (/saltwater|inshore/.test(normalizedUse)) {
    const low = Math.max(20, braid?.low || 0);
    const high = Math.max(low, braid?.high || 30);
    return formatLeaderStrength(low, high, "mono/fluoro leader");
  }
  return null;
}

export function buildRecommendationModel(reel) {
  const braid = parseStrengthRange(reel.recommendedBraid);
  const mono = parseStrengthRange(reel.recommendedMonoFluoro);
  const sizeNumber = Number(reel.recommendationSizeClass) || Number(String(reel.sizeClass || "").match(/\d+/)?.[0] || 0);
  const useCaseText = String(reel.useCase || "").toLowerCase();
  const heavyDuty = sizeNumber >= 6000 ||
    (sizeNumber >= 5000 && (braid?.low || 0) >= 50) ||
    /\boffshore\b|\bbig saltwater\b|\bshark\b/.test(useCaseText);
  const useCases = String(reel.useCase || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (isBaitcaster(reel)) {
    return baitcasterRecommendationModel(reel, braid, mono, useCases);
  }
  const braidRange = formatRange(braid, "braid");
  const monoRange = formatRange(mono, heavyDuty ? "mono" : "mono/fluoro");
  const lightBraid = braid ? `${braid.low} lb braid` : braidRange;
  const strongBraid = braid ? `${braid.high} lb braid` : braidRange;
  const walleyeBraid = braid
    ? `${Math.min(braid.high, Math.max(braid.low, 15))} lb braid`
    : braidRange;
  const lightLeader = mono ? `${mono.low} lb leader` : monoRange;
  const leaderRange = mono ? `${mono.low}-${mono.high} lb leader` : monoRange;

  const rows = useCases.slice(0, 4).map((useCase, index) => {
    const normalizedUse = useCase.toLowerCase();
    const isLightUse = /trout|panfish|finesse|light|open water/.test(normalizedUse);
    const isStrongUse = /cover|pike|catfish|salt|inshore|heavy|structure|surf|redfish|speckled trout|tarpon|cobia/.test(normalizedUse);
    const useSpecificLeader = specializedLeader(normalizedUse, braid);
    let setup = heavyDuty
      ? `${braidRange} over monofilament backing`
      : withLeader(braidRange, leaderRange);
    if (isLightUse) {
      setup = heavyDuty
        ? `${lightBraid} over monofilament backing`
        : withLeader(lightBraid, lightLeader);
    }
    if (isStrongUse) {
      setup = heavyDuty
        ? (useSpecificLeader
          ? withLeader(`${strongBraid} over monofilament backing`, useSpecificLeader)
          : `${strongBraid} over monofilament backing`)
        : withLeader(strongBraid, useSpecificLeader || leaderRange);
    }
    if (/light saltwater|light inshore/.test(normalizedUse) && !heavyDuty) {
      setup = withLeader(lightBraid, useSpecificLeader);
    }
    if (index > 0 && !isLightUse && !isStrongUse) {
      setup = heavyDuty
        ? `${lightBraid} over monofilament backing`
        : withLeader(lightBraid, leaderRange);
    }
    if (/walleye/.test(normalizedUse) && !heavyDuty) {
      setup = withLeader(walleyeBraid, leaderRange);
    }
    if (/surf/.test(normalizedUse)) {
      setup = heavyDuty
        ? withLeader(`${braidRange} over monofilament backing`, useSpecificLeader)
        : withLeader(braidRange, useSpecificLeader);
    }
    if (/salmon/.test(normalizedUse) && !heavyDuty) {
      setup = withLeader(lightBraid, useSpecificLeader);
    }
    if (/heavy freshwater/.test(normalizedUse) && !heavyDuty) {
      setup = withLeader(braidRange, useSpecificLeader);
    }
    return {
      use: titleCase(useCase),
      setup
    };
  });

  rows.push({
    use: "Simple straight-line setup",
    setup: monoRange
  });

  return {
    heavyDuty,
    braidRange,
    monoRange,
    useCases,
    rows,
    quickAnswer: heavyDuty
      ? `For most anglers, start with ${braidRange} over monofilament backing. A straightforward all-mono alternative is ${monoRange}.`
      : `For most anglers, start with ${braidRange} and add ${withLeader("", leaderRange).trim().replace(/^with /, "")} matched to the water and target species. A straightforward alternative is ${monoRange}.`,
    primarySetup: heavyDuty
      ? `${lightBraid} over monofilament backing`
      : withLeader(`${lightBraid} over monofilament backing`, leaderRange)
  };
}

function reelSizeNumber(reel) {
  return Number(reel.recommendationSizeClass) ||
    Number(String(reel.sizeClass || "").match(/\d+/)?.[0] || 0);
}

export function recommendedBackingStrength(reel, mainLineLb) {
  const sizeNumber = reelSizeNumber(reel);
  const braidLb = Number(mainLineLb) || 0;
  const publishedMonoLb = Number(reel.ratedLineLb) || 0;

  if (isBaitcaster(reel)) {
    if (braidLb <= 20) return 10;
    if (braidLb <= 40) return 12;
    if (braidLb <= 65) return 15;
    return 20;
  }

  if (sizeNumber <= 1000) return 6;
  if (sizeNumber < 2000) return braidLb <= 6 ? 6 : 8;
  if (sizeNumber <= 3000) return braidLb <= 6 ? 6 : (braidLb <= 20 ? 8 : 10);

  if (sizeNumber <= 5000) {
    if (braidLb <= 15) return 8;
    if (braidLb <= 25) return 10;
    if (braidLb <= 30) return 12;
    if (braidLb <= 40) return 15;
    return Math.max(15, publishedMonoLb >= 15 ? publishedMonoLb : 15);
  }

  let heavyBackingLb = 15;
  if (braidLb > 30) heavyBackingLb = 20;
  if (braidLb > 50) heavyBackingLb = 30;
  if (braidLb > 80) heavyBackingLb = 40;
  return Math.max(heavyBackingLb, publishedMonoLb >= 15 ? publishedMonoLb : 0);
}

export function buildBackingPreset(reel, mainLineLb, lines, services) {
  const backingLb = recommendedBackingStrength(reel, mainLineLb);
  const diameter = services?.typicalDiameter?.(lines, "Monofilament", backingLb);
  const backingDiameterIn = Number(diameter?.dia_in);

  if (backingLb > 0 && backingDiameterIn > 0) {
    return {
      backingLb,
      backingDiameterIn,
      diameterSource: diameter.source || "ReelCalc line database"
    };
  }

  return {
    backingLb: reel.ratedLineLb,
    backingDiameterIn: reel.ratedLineDiameterIn,
    diameterSource: "published reel mono rating fallback"
  };
}

export function buildCalculatorDefaults(reel, recommendation, lines, services) {
  const braid = parseStrengthRange(reel.recommendedBraid);
  if (!braid || !services?.typicalDiameter || !services?.calculateMainLineCapacity) {
    return null;
  }

  const mainLineLb = braid.low;
  const diameter = services.typicalDiameter(lines, "Braid", mainLineLb);
  const mainLineDiameterIn = Number(diameter?.dia_in);
  if (!(mainLineDiameterIn > 0)) return null;

  const fullSpoolYards = services.calculateMainLineCapacity(
    {
      capacity_yards: reel.capacityYards,
      rated_line_diameter_in: reel.ratedLineDiameterIn
    },
    { dia_in: mainLineDiameterIn }
  );
  if (!(fullSpoolYards > 0)) return null;

  const ultralight = /ultralight|panfish|creek/.test(String(reel.useCase || "").toLowerCase());
  const largeWorkingSpool = (Number(reel.recommendationSizeClass) || Number(String(reel.sizeClass || "").match(/\d+/)?.[0] || 0)) >= 5000 && braid.low >= 40;
  const desiredMainLineYards = isBaitcaster(reel)
    ? (recommendation.heavyDuty ? 125 : 100)
    : (recommendation.heavyDuty || largeWorkingSpool ? 300 : (ultralight ? 100 : 150));
  const backingFriendlyMaximum = Math.max(25, Math.floor((fullSpoolYards * 0.8) / 25) * 25);
  const mainLineYards = Math.min(desiredMainLineYards, backingFriendlyMaximum);
  const backingPreset = buildBackingPreset(reel, mainLineLb, lines, services);

  return {
    mainLineLb,
    mainLineType: "braid",
    mainLineDiameterIn,
    mainLineYards,
    backingLb: backingPreset.backingLb,
    backingType: "monofilament",
    backingDiameterIn: backingPreset.backingDiameterIn,
    diameterSource: diameter.source || "ReelCalc line database"
  };
}

export function buildCapacityRows(reel) {
  const mono = reel.monoCapacities.map((capacity) => ({
    type: "Monofilament",
    lb: capacity.lb,
    yards: capacity.yards,
    ratingLabel: `${capacity.lb} lb`,
    capacityLabel: `${capacity.yards} yards`
  }));
  const braidLabel = reel.brand === "Shimano" ? "PowerPro Braid" : "Braid";
  const braid = reel.braidCapacities.map((capacity) => ({
    type: capacity.ratingType === "PE" ? "PE Braid" : braidLabel,
    lb: capacity.lb,
    yards: capacity.yards,
    ratingLabel: capacity.ratingType === "PE" ? `PE ${capacity.lb}` : `${capacity.lb} lb`,
    capacityLabel: capacity.sourceUnit === "m"
      ? `${capacity.yards} yards (${capacity.sourceLength} m)`
      : `${capacity.yards} yards`
  }));
  return [...mono, ...braid];
}

function relatedReelSizeNumber(reel) {
  return Number(reel?.recommendationSizeClass || reel?.recommendation_size_class) ||
    Number(String(reel?.sizeClass || reel?.size_class || "").match(/\d+/)?.[0] || 0);
}

function sortRelatedPages(pages, reelsById, currentSize) {
  pages.sort((a, b) => {
    const aReel = reelsById.get(a.reelId);
    const bReel = reelsById.get(b.reelId);
    const sizeDifference =
      Math.abs(relatedReelSizeNumber(aReel) - currentSize) -
      Math.abs(relatedReelSizeNumber(bReel) - currentSize);
    if (sizeDifference) return sizeDifference;

    const brandDifference = String(aReel?.brand || "").localeCompare(String(bReel?.brand || ""));
    if (brandDifference) return brandDifference;

    const modelDifference = String(aReel?.model || "").localeCompare(String(bReel?.model || ""));
    if (modelDifference) return modelDifference;

    return String(a.path || "").localeCompare(String(b.path || ""));
  });
}

function brandDiversePages(pages, reelsById, limit) {
  const selected = [];
  const brands = new Set();
  for (const page of pages) {
    const brand = String(reelsById.get(page.reelId)?.brand || "").toLowerCase();
    if (!brand || brands.has(brand)) continue;
    brands.add(brand);
    selected.push(page);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function relatedPagesFor(reel, registry, reelsById, limit = 6) {
  const current = registry.pages.find((page) => page.reelId === reel.id);
  if (!current) return [];

  const sizeNumber = relatedReelSizeNumber(reel);
  const baitcaster = isBaitcaster(reel);
  const candidates = registry.pages.filter((page) => {
    if (page.reelId === reel.id || !reelsById.has(page.reelId)) return false;
    return isBaitcaster(reelsById.get(page.reelId)) === baitcaster;
  });
  const sameFamily = registry.pages.filter((page) =>
    page.reelId !== reel.id &&
    page.family === current.family &&
    reelsById.has(page.reelId)
  );
  const crossBrandSameSize = candidates.filter((page) => {
    const candidate = reelsById.get(page.reelId);
    return (
      page.family !== current.family &&
      candidate.brand !== reel.brand &&
      relatedReelSizeNumber(candidate) === sizeNumber
    );
  });
  const crossBrandNearby = candidates.filter((page) => {
    const candidate = reelsById.get(page.reelId);
    return (
      page.family !== current.family &&
      candidate.brand !== reel.brand &&
      relatedReelSizeNumber(candidate) !== sizeNumber
    );
  });
  const sameBrand = candidates.filter((page) => {
    const candidate = reelsById.get(page.reelId);
    return page.family !== current.family && candidate.brand === reel.brand;
  });

  sortRelatedPages(sameFamily, reelsById, sizeNumber);
  sortRelatedPages(crossBrandSameSize, reelsById, sizeNumber);
  sortRelatedPages(crossBrandNearby, reelsById, sizeNumber);
  sortRelatedPages(sameBrand, reelsById, sizeNumber);

  const related = [];
  const seen = new Set();
  function addPages(pages, pageLimit = limit) {
    if (related.length >= limit) return;
    let added = 0;
    for (const page of pages) {
      if (seen.has(page.reelId)) continue;
      seen.add(page.reelId);
      related.push(page);
      added += 1;
      if (related.length >= limit || added >= pageLimit) break;
    }
  }

  addPages(brandDiversePages(crossBrandSameSize, reelsById, 3));
  addPages(sameFamily, 3);
  addPages(crossBrandSameSize);
  addPages(crossBrandNearby);
  addPages(sameBrand);

  return related.map((page) => ({
    ...page,
    reel: reelsById.get(page.reelId)
  }));
}
