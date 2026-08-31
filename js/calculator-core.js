(function(global) {
  "use strict";

  var YARDS_PER_METER = 1.0936132983;
  var MM_PER_INCH = 25.4;
  var LB_PER_KG = 2.2046226218;
  var ENGINE_VERSION = "2026.08-dual-anchor-v1";
  var LARGE_EXTRAPOLATION_MIN_RATIO = 0.75;
  var LARGE_EXTRAPOLATION_MAX_RATIO = 1 / LARGE_EXTRAPOLATION_MIN_RATIO;
  var MONO_RATING_DIAMETERS_IN = {
    2: 0.006, 4: 0.008, 6: 0.0095, 8: 0.011, 10: 0.012,
    12: 0.014, 15: 0.015, 20: 0.018, 25: 0.019, 30: 0.022,
    40: 0.025, 50: 0.028, 60: 0.031, 80: 0.035, 100: 0.04,
    120: 0.044
  };
  var BRAID_RATING_DIAMETERS_IN = {
    2: 0.003, 3: 0.0035, 4: 0.004, 6: 0.005, 8: 0.005,
    10: 0.006, 12: 0.007, 15: 0.008, 20: 0.009, 25: 0.01,
    30: 0.011, 40: 0.013, 50: 0.014, 60: 0.0155, 65: 0.016,
    80: 0.017, 100: 0.02, 120: 0.022
  };

  function yardsToMeters(yards) {
    return Number(yards) / YARDS_PER_METER;
  }

  function metersToYards(meters) {
    return Number(meters) * YARDS_PER_METER;
  }

  function lbToKg(lb) {
    return Number(lb) / LB_PER_KG;
  }

  function kgToLb(kg) {
    return Number(kg) * LB_PER_KG;
  }

  function inchesToMm(inches) {
    return Number(inches) * MM_PER_INCH;
  }

  function mmToInches(mm) {
    return Number(mm) / MM_PER_INCH;
  }

  function normalizedRatingType(type) {
    return String(type || "").toLowerCase().indexOf("braid") !== -1 ? "braid" : "mono";
  }

  function assumedRatingDiameter(type, strengthLb) {
    var table = normalizedRatingType(type) === "braid"
      ? BRAID_RATING_DIAMETERS_IN
      : MONO_RATING_DIAMETERS_IN;
    var strengths = Object.keys(table).map(Number).sort(function(a, b) { return a - b; });
    var lb = Number(strengthLb);
    if (!(lb > 0)) return null;
    if (table[lb]) return table[lb];

    if (lb < strengths[0]) {
      return table[strengths[0]] * Math.sqrt(lb / strengths[0]);
    }
    var maximum = strengths[strengths.length - 1];
    if (lb > maximum) {
      return table[maximum] * Math.sqrt(lb / maximum);
    }

    for (var index = 1; index < strengths.length; index += 1) {
      var high = strengths[index];
      if (lb > high) continue;
      var low = strengths[index - 1];
      var fraction = (lb - low) / (high - low);
      return table[low] + (table[high] - table[low]) * fraction;
    }
    return null;
  }

  function monoDiameter(lb) {
    return assumedRatingDiameter("mono", lb);
  }

  function estimateMonoLbFromDiameter(diameterIn) {
    var monoTable = [2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 40];
    return monoTable.reduce(function(best, current) {
      return Math.abs(monoDiameter(current) - diameterIn) < Math.abs(monoDiameter(best) - diameterIn) ? current : best;
    }, monoTable[0]);
  }

  function calculateLineCapacityFromDiameter(capacityYards, ratedLineDiameterIn, selectedLineDiameterIn) {
    if (!(capacityYards > 0) || !(ratedLineDiameterIn > 0) || !(selectedLineDiameterIn > 0)) return null;
    var totalSpoolSpace = capacityYards * ratedLineDiameterIn * ratedLineDiameterIn;
    return totalSpoolSpace / (selectedLineDiameterIn * selectedLineDiameterIn);
  }

  function resolveCapacityRating(requestedType, ratings) {
    var requested = normalizedRatingType(requestedType);
    var available = ratings || {};
    if (available[requested]) {
      return {
        rating: available[requested],
        requestedType: requested,
        anchorType: requested,
        fallback: false
      };
    }
    var alternate = requested === "braid" ? "mono" : "braid";
    if (available[alternate]) {
      return {
        rating: available[alternate],
        requestedType: requested,
        anchorType: alternate,
        fallback: true
      };
    }
    return null;
  }

  function capacityFromRating(rating, lineDiameterIn) {
    if (!rating) return null;
    return calculateLineCapacityFromDiameter(
      Number(rating.capacityYards),
      Number(rating.referenceDiameterIn),
      Number(lineDiameterIn)
    );
  }

  function estimateSetup(options) {
    var settings = options || {};
    var fullWorkingCapacityYards = capacityFromRating(
      settings.workingRating,
      settings.workingDiameterIn
    );
    if (!(fullWorkingCapacityYards > 0)) return { error: "invalid_working_rating" };

    if (settings.capacityOnly) {
      return {
        engineVersion: ENGINE_VERSION,
        calculationMethod: "capacity-from-matching-rating",
        fullWorkingCapacityYards: fullWorkingCapacityYards,
        backingYards: null,
        workingFraction: null,
        backingFraction: null
      };
    }

    var desired = Number(settings.workingYards);
    if (!(desired >= 0)) return { error: "invalid_working_amount" };
    var workingFraction = desired / fullWorkingCapacityYards;
    if (workingFraction > 1 + 1e-10) {
      return {
        error: "working_exceeds_capacity",
        engineVersion: ENGINE_VERSION,
        calculationMethod: "dual-anchor-fraction",
        fullWorkingCapacityYards: fullWorkingCapacityYards,
        workingFraction: workingFraction
      };
    }

    var fullBackingCapacityYards = capacityFromRating(
      settings.backingRating,
      settings.backingDiameterIn
    );
    if (!(fullBackingCapacityYards > 0)) return { error: "invalid_backing_rating" };
    var backingFraction = Math.max(0, 1 - workingFraction);
    return {
      engineVersion: ENGINE_VERSION,
      calculationMethod: "dual-anchor-fraction",
      fullWorkingCapacityYards: fullWorkingCapacityYards,
      fullBackingCapacityYards: fullBackingCapacityYards,
      workingFraction: workingFraction,
      backingFraction: backingFraction,
      backingYards: fullBackingCapacityYards * backingFraction
    };
  }

  function likelyDiameterSuggestion(value, metric) {
    var amount = Number(value);
    if (!(amount > 0)) return null;
    if (metric) {
      if (amount >= 10 && amount < 100) return amount / 100;
      if (amount >= 100 && amount < 1000) return amount / 1000;
      return null;
    }
    if (amount >= 1 && amount < 1000) return amount / 1000;
    if (amount >= 0.25 && amount < 1) return amount / 10;
    return null;
  }

  function formatSuggestedDiameter(value, metric) {
    var decimals = metric
      ? (value < 0.1 ? 3 : 2)
      : (value < 0.01 ? 4 : 3);
    return Number(value).toFixed(decimals);
  }

  function assessDiameter(value, metric, warningAccepted) {
    var amount = Number(value);
    if (!Number.isFinite(amount)) {
      return { valid: false, kind: "missing", message: "Enter a numeric diameter." };
    }
    if (!(amount > 0)) {
      return { valid: false, kind: "error", message: "Diameter must be greater than zero." };
    }

    var diameterMm = metric ? amount : amount * MM_PER_INCH;
    var suggestion = likelyDiameterSuggestion(amount, metric);
    if (suggestion && suggestion > 0 && suggestion * (metric ? 1 : MM_PER_INCH) <= 3) {
      var unit = metric ? "mm" : "in";
      var formatted = formatSuggestedDiameter(suggestion, metric);
      if (!warningAccepted) {
        return {
          valid: false,
          kind: "warning",
          suggestion: suggestion,
          message: "That diameter looks unusually high. Did you mean " + formatted + " " + unit + "?"
        };
      }
    }

    if (diameterMm > 20) {
      return {
        valid: false,
        kind: "error",
        message: "That diameter is too large to be a realistic fishing-line diameter."
      };
    }

    if ((diameterMm > 3 || diameterMm < 0.01) && !warningAccepted) {
      return {
        valid: false,
        kind: "warning",
        message: "That diameter is unusual for fishing line. Check the decimal and unit before continuing."
      };
    }

    return {
      valid: true,
      kind: (diameterMm > 3 || diameterMm < 0.01) ? "warning" : "",
      message: (diameterMm > 3 || diameterMm < 0.01) ? "Using the unusual diameter you confirmed." : "",
      diameterIn: diameterMm / MM_PER_INCH
    };
  }

  function diameterExtrapolation(referenceDiameterIn, selectedDiameterIn) {
    var reference = Number(referenceDiameterIn);
    var selected = Number(selectedDiameterIn);
    if (!(reference > 0) || !(selected > 0)) return { large: false, direction: "unknown", ratio: null };
    var ratio = selected / reference;
    return {
      large: ratio < LARGE_EXTRAPOLATION_MIN_RATIO || ratio > LARGE_EXTRAPOLATION_MAX_RATIO,
      direction: ratio < LARGE_EXTRAPOLATION_MIN_RATIO ? "thinner" : ratio > LARGE_EXTRAPOLATION_MAX_RATIO ? "thicker" : "similar",
      ratio: ratio
    };
  }

  function isReelReady(reel) {
    return !!reel && Number(reel.capacity_yards) > 0 && Number(reel.rated_line_diameter_in) > 0;
  }

  function isLineReady(line) {
    return !!line && Number(line.dia_in) > 0;
  }

  function isBraidLine(line) {
    return String(line && line.type || "").toLowerCase().indexOf("braid") !== -1;
  }

  function slashCapacityIsYardsFirst(reel) {
    var brand = String(reel && reel.brand || "").toLowerCase();
    return brand === "okuma" || brand === "pflueger" || brand === "quantum";
  }

  function publishedBraidCapacityOptions(reel) {
    var note = String(reel && reel.braid_capacity_note || "").trim();
    if (!note || /^(unknown|tbd)$/i.test(note)) return [];
    // PE numbers are Japanese diameter classes, not pound-test strengths.
    // Exact-line PE calibration is handled separately by publishedPeCapacityAnchors.
    if (/\bPE\b/i.test(note)) return [];

    var options = [];
    var pairPattern = /(\d+(?:\.\d+)?)\s*([\/-])\s*(\d+(?:\.\d+)?)/g;
    var match;
    while ((match = pairPattern.exec(note))) {
      var first = Number(match[1]);
      var separator = match[2];
      var second = Number(match[3]);
      var yardsFirst = separator === "/" && slashCapacityIsYardsFirst(reel);
      var lb = yardsFirst ? second : first;
      var yards = yardsFirst ? first : second;
      if (!(lb > 0 && lb <= 200 && yards >= 20 && yards <= 10000)) continue;
      options.push({ lb: lb, yards: yards });
    }

    var byStrength = new Map();
    options.forEach(function(option) {
      var current = byStrength.get(option.lb);
      if (!current || option.yards < current.yards) byStrength.set(option.lb, option);
    });
    return Array.from(byStrength.values()).sort(function(a, b) {
      return a.lb - b.lb;
    });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function publishedBraidCapacityEstimate(reel, line) {
    if (!line || !isBraidLine(line)) return null;
    var targetLb = Number(line.lb);
    if (!(targetLb > 0)) return null;

    var options = publishedBraidCapacityOptions(reel);
    if (!options.length) return null;

    var exact = options.find(function(option) {
      return Math.abs(option.lb - targetLb) < 0.001;
    });
    if (exact) {
      return {
        yards: exact.yards,
        method: "exact",
        targetLb: targetLb,
        anchors: [exact],
        sourceNote: String(reel.braid_capacity_note || "")
      };
    }

    var lower = null;
    var upper = null;
    options.forEach(function(option) {
      if (option.lb < targetLb) lower = option;
      if (!upper && option.lb > targetLb) upper = option;
    });

    var estimate;
    var method;
    var anchors;
    if (!lower && upper) {
      // A lighter braid cannot reasonably have the same full-spool yardage as
      // the only heavier published rating. Strength ratio is a conservative
      // fallback when a line catalog is not available for diameter calibration.
      estimate = upper.yards * upper.lb / targetLb;
      method = "minimum-published-rating";
      anchors = [upper];
    } else if (lower && upper && upper.lb !== lower.lb && lower.yards >= upper.yards) {
      var position = (targetLb - lower.lb) / (upper.lb - lower.lb);
      estimate = lower.yards + (upper.yards - lower.yards) * position;
      method = "interpolated";
      anchors = [lower, upper];
    } else if (lower && !upper) {
      estimate = lower.yards * lower.lb / targetLb;
      method = "maximum-published-rating";
      anchors = [lower];
    } else {
      var nearest = options.reduce(function(best, option) {
        return Math.abs(option.lb - targetLb) < Math.abs(best.lb - targetLb) ? option : best;
      }, options[0]);
      estimate = targetLb < nearest.lb
        ? nearest.yards
        : nearest.yards * nearest.lb / targetLb;
      method = "nearest-rating";
      anchors = [nearest];
    }

    estimate = clamp(estimate, 20, 10000);

    return {
      yards: Math.round(estimate),
      method: method,
      targetLb: targetLb,
      anchors: anchors,
      sourceNote: String(reel.braid_capacity_note || "")
    };
  }

  function calculatePublishedBraidCapacity(reel, line) {
    return publishedBraidCapacityEstimate(reel, line);
  }

  function capacityRangeIncrement(yards) {
    if (yards >= 1000) return 25;
    if (yards >= 500) return 10;
    if (yards < 50) return 1;
    return 5;
  }

  function roundCapacityRange(value, direction) {
    var increment = capacityRangeIncrement(value);
    var rounded = direction === "down"
      ? Math.floor(value / increment) * increment
      : Math.ceil(value / increment) * increment;
    return Math.max(increment, rounded);
  }

  function braidCapacityUncertainty(line, publishedEstimate) {
    var genericRecommendation = line && line.generic_recommendation === true;
    var verifiedDatabaseLine = line && line.id && !genericRecommendation && line.custom_line !== true;

    // A selected database braid that exactly matches a published reel rating
    // has the strongest available anchor, so it earns the tightest range.
    if (verifiedDatabaseLine && publishedEstimate && publishedEstimate.method === "exact") {
      return 0.06;
    }

    var uncertainty = genericRecommendation ? 0.15 : 0.10;

    if (line && line.custom_line === true) uncertainty += 0.05;
    if (!publishedEstimate) return uncertainty + 0.05;
    if (publishedEstimate.method !== "exact") return uncertainty + 0.05;
    return uncertainty;
  }

  function calculateBraidCapacityRange(reel, line, lineCatalog) {
    if (!line || !isBraidLine(line)) return null;

    var calibratedEstimate = Array.isArray(lineCatalog)
      ? actualLineBraidCapacityEstimate(reel, line, lineCatalog)
      : null;
    if (calibratedEstimate) return calibratedEstimate;

    var publishedEstimate = calculatePublishedBraidCapacity(reel, line);
    var centerYards = publishedEstimate
      ? Number(publishedEstimate.yards)
      : Number(calculateMainLineCapacity(reel, line));
    if (!(centerYards > 0)) return null;

    var uncertainty = braidCapacityUncertainty(line, publishedEstimate);
    var minimumYards = Math.min(centerYards, roundCapacityRange(centerYards * (1 - uncertainty), "down"));
    var maximumYards = Math.max(centerYards, roundCapacityRange(centerYards * (1 + uncertainty), "up"));

    return {
      centerYards: centerYards,
      minimumYards: minimumYards,
      maximumYards: maximumYards,
      uncertaintyRate: uncertainty,
      basis: publishedEstimate ? "published-braid" : "diameter-fallback",
      method: publishedEstimate ? publishedEstimate.method : "diameter-fallback",
      publishedEstimate: publishedEstimate,
      genericRecommendation: line.generic_recommendation === true
    };
  }

  function median(values) {
    var sorted = values.filter(function(value) {
      return Number.isFinite(value) && value > 0;
    }).sort(function(a, b) { return a - b; });
    if (!sorted.length) return null;
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  var braidCatalogDiameterCache = new Map();

  function braidCatalogDiameterData(lineCatalog) {
    var catalog = Array.isArray(lineCatalog) ? lineCatalog : [];
    if (braidCatalogDiameterCache.has(catalog)) return braidCatalogDiameterCache.get(catalog);

    var byStrength = new Map();
    catalog.forEach(function(line) {
      if (!isBraidLine(line)) return;
      var lb = Number(line.lb);
      var diameter = Number(line.dia_in);
      if (!(lb > 0) || !(diameter > 0)) return;
      if (!byStrength.has(lb)) byStrength.set(lb, []);
      byStrength.get(lb).push(diameter);
    });
    var points = Array.from(byStrength.entries()).map(function(entry) {
      return { lb: entry[0], diameterIn: median(entry[1]) };
    }).filter(function(point) {
      return point.diameterIn > 0;
    }).sort(function(a, b) {
      return a.lb - b.lb;
    });
    var data = {
      byStrength: new Map(points.map(function(point) {
        return [point.lb, point.diameterIn];
      })),
      points: points
    };
    braidCatalogDiameterCache.set(catalog, data);
    return data;
  }

  function interpolateDiameterPoints(points, targetLb) {
    var lower = null;
    var upper = null;
    points.forEach(function(point) {
      if (point.lb < targetLb) lower = point;
      if (!upper && point.lb > targetLb) upper = point;
    });
    if (!lower || !upper || upper.lb === lower.lb) return null;
    var position = (targetLb - lower.lb) / (upper.lb - lower.lb);
    return lower.diameterIn + (upper.diameterIn - lower.diameterIn) * position;
  }

  function normalizedLineText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function braidProductMatches(left, right) {
    return isBraidLine(left) && isBraidLine(right) &&
      normalizedLineText(left.brand) === normalizedLineText(right.brand) &&
      normalizedLineText(left.model) === normalizedLineText(right.model);
  }

  function interpolateDiameter(rows, targetLb) {
    var byStrength = new Map();
    rows.forEach(function(row) {
      var lb = Number(row.lb);
      var diameter = Number(row.dia_in);
      if (!(lb > 0) || !(diameter > 0)) return;
      if (!byStrength.has(lb)) byStrength.set(lb, []);
      byStrength.get(lb).push(diameter);
    });
    var points = Array.from(byStrength.entries()).map(function(entry) {
      return { lb: entry[0], diameterIn: median(entry[1]) };
    }).filter(function(point) {
      return point.diameterIn > 0;
    }).sort(function(a, b) { return a.lb - b.lb; });
    var lower = null;
    var upper = null;
    points.forEach(function(point) {
      if (point.lb < targetLb) lower = point;
      if (!upper && point.lb > targetLb) upper = point;
    });
    if (!lower || !upper || upper.lb === lower.lb) return null;
    var position = (targetLb - lower.lb) / (upper.lb - lower.lb);
    return lower.diameterIn + (upper.diameterIn - lower.diameterIn) * position;
  }

  function braidReferenceDiameter(line, targetLb, lineCatalog) {
    var catalog = Array.isArray(lineCatalog) ? lineCatalog : [];
    var catalogData = braidCatalogDiameterData(catalog);
    var catalogExact = catalogData.byStrength.get(targetLb);
    if (catalogExact > 0) {
      return {
        diameterIn: catalogExact,
        quality: "catalog-median-exact",
        qualityRank: 4
      };
    }

    var catalogInterpolated = interpolateDiameterPoints(catalogData.points, targetLb);
    if (catalogInterpolated > 0) {
      return {
        diameterIn: catalogInterpolated,
        quality: "catalog-median-interpolated",
        qualityRank: 3
      };
    }

    var productRows = catalog.filter(function(candidate) {
      return braidProductMatches(line, candidate) && Number(candidate.dia_in) > 0;
    });
    var productInterpolated = interpolateDiameter(productRows, targetLb);
    if (productInterpolated > 0) {
      return {
        diameterIn: productInterpolated,
        quality: "selected-product-interpolated",
        qualityRank: 2
      };
    }

    return null;
  }

  function publishedPeCapacityAnchors(reel) {
    var note = String(reel && reel.braid_capacity_note || "").trim();
    if (!/\bPE\b/i.test(note)) return [];
    var usesYards = /\b(?:yd|yds|yard|yards)\b/i.test(note);
    var anchors = [];
    var pairPattern = /(\d+(?:\.\d+)?)\s*[\/-]\s*(\d+(?:\.\d+)?)/g;
    var match;
    while ((match = pairPattern.exec(note))) {
      var peSize = Number(match[1]);
      var publishedLength = Number(match[2]);
      if (!(peSize > 0 && peSize <= 30 && publishedLength >= 20 && publishedLength <= 10000)) continue;
      var diameterMm = 0.165 * Math.sqrt(peSize);
      anchors.push({
        peSize: peSize,
        yards: usesYards ? publishedLength : metersToYards(publishedLength),
        referenceDiameterIn: mmToInches(diameterMm),
        publishedLength: publishedLength,
        publishedUnit: usesYards ? "yards" : "meters"
      });
    }
    return anchors;
  }

  function actualLineBraidCapacityEstimate(reel, line, lineCatalog) {
    if (!line || !isBraidLine(line) || !(Number(line.dia_in) > 0)) return null;
    var targetLb = Number(line.lb);
    var selectedDiameter = Number(line.dia_in);
    var peOptions = publishedPeCapacityAnchors(reel);
    var options = peOptions.length ? [] : publishedBraidCapacityOptions(reel);
    if (!(targetLb > 0) || (!options.length && !peOptions.length)) return null;

    var anchors = peOptions.length
      ? peOptions.map(function(option) {
        var peSpoolSpace = option.yards * option.referenceDiameterIn * option.referenceDiameterIn;
        return {
          peSize: option.peSize,
          yards: option.yards,
          publishedLength: option.publishedLength,
          publishedUnit: option.publishedUnit,
          referenceDiameterIn: option.referenceDiameterIn,
          selectedLineCapacityYards: peSpoolSpace / (selectedDiameter * selectedDiameter),
          spoolSpace: peSpoolSpace,
          quality: "published-pe-diameter",
          qualityRank: 5
        };
      })
      : options.map(function(option) {
        var reference = braidReferenceDiameter(line, option.lb, lineCatalog);
        if (!reference || !(reference.diameterIn > 0)) return null;
        var spoolSpace = option.yards * reference.diameterIn * reference.diameterIn;
        return {
          lb: option.lb,
          yards: option.yards,
          referenceDiameterIn: reference.diameterIn,
          selectedLineCapacityYards: spoolSpace / (selectedDiameter * selectedDiameter),
          spoolSpace: spoolSpace,
          quality: reference.quality,
          qualityRank: reference.qualityRank
        };
      }).filter(Boolean);
    if (!anchors.length) return null;

    var strongestRank = Math.max.apply(Math, anchors.map(function(anchor) { return anchor.qualityRank; }));
    var strongestAnchors = anchors.filter(function(anchor) { return anchor.qualityRank === strongestRank; });
    var exactOption = options.find(function(option) {
      return Math.abs(option.lb - targetLb) < 0.001;
    });
    var centerYards = median(strongestAnchors.map(function(anchor) { return anchor.selectedLineCapacityYards; }));
    if (!(centerYards > 0)) return null;

    var anchorSpread = strongestAnchors.reduce(function(largest, anchor) {
      return Math.max(largest, Math.abs(anchor.selectedLineCapacityYards - centerYards) / centerYards);
    }, 0);
    var baseUncertainty = strongestRank === 5 ? 0.08 : strongestRank >= 4 ? 0.10 : strongestRank === 3 ? 0.12 : 0.15;
    if (line.generic_recommendation === true) baseUncertainty += 0.05;
    if (line.custom_line === true) baseUncertainty += 0.03;
    var baitcasterReel = /baitcast|casting/i.test(String(reel && reel.reel_type || ""));
    var exactDatabaseLine = Boolean(
      baitcasterReel &&
      exactOption &&
      line.id &&
      line.generic_recommendation !== true &&
      line.custom_line !== true
    );
    var uncertaintyCeiling = exactDatabaseLine ? 0.12 : 0.20;
    var uncertainty = clamp(
      Math.max(baseUncertainty, anchorSpread + 0.03),
      baseUncertainty,
      uncertaintyCeiling
    );
    var minimumYards = Math.min(centerYards, roundCapacityRange(centerYards * (1 - uncertainty), "down"));
    var maximumYards = Math.max(centerYards, roundCapacityRange(centerYards * (1 + uncertainty), "up"));

    return {
      yards: centerYards,
      centerYards: centerYards,
      minimumYards: minimumYards,
      maximumYards: maximumYards,
      uncertaintyRate: uncertainty,
      method: peOptions.length ? "pe-diameter-calibrated" : exactOption ? "label-match-diameter-calibrated" : "diameter-calibrated",
      targetLb: targetLb,
      anchors: strongestAnchors,
      referenceQuality: strongestAnchors[0].quality,
      sourceNote: String(reel.braid_capacity_note || "")
    };
  }

  function calculateActualLineBraidCapacityRange(reel, line, lineCatalog) {
    return actualLineBraidCapacityEstimate(reel, line, lineCatalog);
  }

  function capacityBasisForActualLine(reel, line, lineCatalog) {
    if (!line || !isLineReady(line)) return null;
    if (!isBraidLine(line)) return capacityBasisForLine(reel, line);

    var calibrated = actualLineBraidCapacityEstimate(reel, line, lineCatalog);
    if (calibrated) {
      return {
        type: "published-braid-diameter",
        label: "Using this reel's published braid capacity",
        capacityYards: Number(calibrated.centerYards),
        publishedEstimate: calibrated,
        actualLineEstimate: calibrated,
        fallback: false
      };
    }

    var fallbackCapacity = calculateMainLineCapacity(reel, line);
    if (!(fallbackCapacity > 0)) return null;
    return {
      type: "mono-derived-braid-fallback",
      label: "Estimating from this reel's published mono capacity",
      capacityYards: Number(fallbackCapacity),
      publishedEstimate: null,
      actualLineEstimate: null,
      fallback: true
    };
  }

  function capacityBasisForLine(reel, line) {
    if (!line || !isLineReady(line)) return null;
    if (isBraidLine(line)) {
      var braidEstimate = calculatePublishedBraidCapacity(reel, line);
      if (braidEstimate) {
        return {
          type: "published-braid",
          label: "Using this reel's published braid capacity",
          capacityYards: Number(braidEstimate.yards),
          publishedEstimate: braidEstimate,
          fallback: false
        };
      }
      var braidFallback = calculateMainLineCapacity(reel, line);
      if (!(braidFallback > 0)) return null;
      return {
        type: "mono-derived-braid-fallback",
        label: "Estimating from this reel's published mono capacity",
        capacityYards: Number(braidFallback),
        publishedEstimate: null,
        fallback: true
      };
    }

    var solidCapacity = calculateMainLineCapacity(reel, line);
    if (!(solidCapacity > 0)) return null;
    return {
      type: "published-mono",
      label: "Using this reel's published mono capacity",
      capacityYards: Number(solidCapacity),
      publishedEstimate: null,
      fallback: false
    };
  }

  function ratingFromBasis(basis, line) {
    var diameter = Number(line && line.dia_in);
    if (!basis || !(Number(basis.capacityYards) > 0) || !(diameter > 0)) return null;
    return {
      capacityYards: Number(basis.capacityYards),
      referenceDiameterIn: diameter,
      type: normalizedRatingType(line && line.type),
      basis: basis
    };
  }

  function calculateBackingForBases(reel, basis, backingBasis, mainLine, desiredMainLineYards, backingLine) {
    var mainDiameter = Number(mainLine && mainLine.dia_in);
    var backingDiameter = Number(backingLine && backingLine.dia_in);
    var desired = Number(desiredMainLineYards);
    if (!basis || !backingBasis || !(mainDiameter > 0) || !(backingDiameter > 0) || !(desired >= 0)) return null;

    var estimate = estimateSetup({
      workingRating: ratingFromBasis(basis, mainLine),
      backingRating: ratingFromBasis(backingBasis, backingLine),
      workingYards: desired,
      workingDiameterIn: mainDiameter,
      backingDiameterIn: backingDiameter,
      capacityOnly: false
    });
    var totalSpoolSpace = basis.type.indexOf("published-braid") === 0
      ? basis.capacityYards * mainDiameter * mainDiameter
      : getReelSpoolSpace(reel);
    if (!(totalSpoolSpace > 0)) return null;

    var mainLineSpace = desired * mainDiameter * mainDiameter;
    var backingSpace = totalSpoolSpace - mainLineSpace;
    var conversionTolerance = mainDiameter * mainDiameter * 0.5;
    if (backingSpace < 0 && Math.abs(backingSpace) <= conversionTolerance) backingSpace = 0;
    var overCapacity = estimate.error === "working_exceeds_capacity";
    if (estimate.error && !overCapacity) return null;
    var workingFraction = Math.max(0, Math.min(1, Number(estimate.workingFraction) || 0));
    var backingFraction = Math.max(0, 1 - workingFraction);
    return {
      engineVersion: ENGINE_VERSION,
      calculationMethod: "dual-anchor-fraction",
      basis: basis,
      backingBasis: backingBasis,
      totalSpoolSpace: totalSpoolSpace,
      mainLineSpace: mainLineSpace,
      backingSpace: backingSpace,
      fullMainCapacityYards: Number(basis.capacityYards),
      fullBackingCapacityYards: Number(backingBasis.capacityYards),
      workingFraction: workingFraction,
      backingFraction: backingFraction,
      backingYards: overCapacity ? 0 : Number(estimate.backingYards),
      overCapacity: overCapacity,
      mainPercent: workingFraction * 100,
      backingPercent: backingFraction * 100
    };
  }

  function calculateCalibratedBacking(reel, mainLine, desiredMainLineYards, backingLine) {
    return calculateBackingForBases(
      reel,
      capacityBasisForLine(reel, mainLine),
      capacityBasisForLine(reel, backingLine),
      mainLine,
      desiredMainLineYards,
      backingLine
    );
  }

  function calculateActualLineCalibratedBacking(reel, mainLine, desiredMainLineYards, backingLine, lineCatalog) {
    return calculateBackingForBases(
      reel,
      capacityBasisForActualLine(reel, mainLine, lineCatalog),
      capacityBasisForActualLine(reel, backingLine, lineCatalog),
      mainLine,
      desiredMainLineYards,
      backingLine
    );
  }

  function calculateCalibratedBackingRange(reel, mainLine, desiredMainLineYards, backingLine) {
    var center = calculateCalibratedBacking(reel, mainLine, desiredMainLineYards, backingLine);
    var range = calculateBraidCapacityRange(reel, mainLine);
    var desired = Number(desiredMainLineYards);
    if (!center || !range || !(center.fullBackingCapacityYards > 0)) return null;

    function backingAtCapacity(capacityYards) {
      return center.fullBackingCapacityYards * Math.max(0, 1 - desired / Number(capacityYards));
    }

    var minimumYards = backingAtCapacity(range.minimumYards);
    var maximumYards = backingAtCapacity(range.maximumYards);
    return {
      minimumYards: Math.min(minimumYards, center.backingYards),
      centerYards: center.backingYards,
      maximumYards: Math.max(maximumYards, center.backingYards),
      capacityRange: range,
      basis: center.basis
    };
  }

  function calculateActualLineCalibratedBackingRange(reel, mainLine, desiredMainLineYards, backingLine, lineCatalog) {
    var center = calculateActualLineCalibratedBacking(
      reel,
      mainLine,
      desiredMainLineYards,
      backingLine,
      lineCatalog
    );
    var range = calculateActualLineBraidCapacityRange(reel, mainLine, lineCatalog);
    var desired = Number(desiredMainLineYards);
    if (!center || !range || !(center.fullBackingCapacityYards > 0)) return null;

    function backingAtCapacity(capacityYards) {
      return center.fullBackingCapacityYards * Math.max(0, 1 - desired / Number(capacityYards));
    }

    var minimumYards = backingAtCapacity(range.minimumYards);
    var maximumYards = backingAtCapacity(range.maximumYards);
    return {
      minimumYards: Math.min(minimumYards, center.backingYards),
      centerYards: center.backingYards,
      maximumYards: Math.max(maximumYards, center.backingYards),
      capacityRange: range,
      basis: center.basis
    };
  }

  function calculateMainLineCapacity(reel, line) {
    if (!isReelReady(reel) || !isLineReady(line)) return null;
    return calculateLineCapacityFromDiameter(Number(reel.capacity_yards), Number(reel.rated_line_diameter_in), Number(line.dia_in));
  }

  function calculateFullSpoolCapacity(reel, line, options) {
    var settings = options || {};
    if (isBraidLine(line) && Array.isArray(settings.lineCatalog)) {
      var calibratedBraidEstimate = actualLineBraidCapacityEstimate(reel, line, settings.lineCatalog);
      if (calibratedBraidEstimate) return calibratedBraidEstimate.centerYards;
    }
    if (line && line.generic_recommendation === true) {
      var genericBraidEstimate = calculatePublishedBraidCapacity(reel, line);
      if (genericBraidEstimate) return genericBraidEstimate.yards;
    }
    if (settings.usePublishedBraid === true) {
      var selectedBraidEstimate = calculatePublishedBraidCapacity(reel, line);
      if (selectedBraidEstimate) return selectedBraidEstimate.yards;
    }
    return calculateMainLineCapacity(reel, line);
  }

  function getReelSpoolSpace(reel) {
    if (!isReelReady(reel)) return null;
    return Number(reel.capacity_yards) * Number(reel.rated_line_diameter_in) * Number(reel.rated_line_diameter_in);
  }

  function calculateBackingNeeded(reel, mainLine, desiredMainLineYards, backingLine) {
    var totalSpoolSpace = getReelSpoolSpace(reel);
    var mainLineSpace = Number(desiredMainLineYards) * Number(mainLine.dia_in) * Number(mainLine.dia_in);
    var backingSpace = totalSpoolSpace - mainLineSpace;
    var backingYards = backingSpace / (Number(backingLine.dia_in) * Number(backingLine.dia_in));
    var mainPercent = totalSpoolSpace > 0 ? mainLineSpace / totalSpoolSpace * 100 : 0;
    var backingPercent = totalSpoolSpace > 0 ? Math.max(0, backingSpace) / totalSpoolSpace * 100 : 0;
    return {
      totalSpoolSpace: totalSpoolSpace,
      mainLineSpace: mainLineSpace,
      backingSpace: backingSpace,
      backingYards: Math.max(0, backingYards),
      overCapacity: backingSpace < 0,
      mainPercent: Math.min(100, mainPercent),
      backingPercent: backingPercent
    };
  }

  function roundHandleTurns(value) {
    var turns = Number(value);
    if (!Number.isFinite(turns) || turns < 0) return null;
    if (turns === 0) return 0;
    var increment = turns < 100 ? 5 : turns < 500 ? 10 : 25;
    return Math.max(increment, Math.round(turns / increment) * increment);
  }

  function calculateHandleTurns(lineYards, inchesPerTurn) {
    var yards = Number(lineYards);
    var ipt = Number(inchesPerTurn);
    if (!(yards >= 0) || !(ipt > 0)) return null;

    var rawTurns = yards * 36 / ipt;
    return {
      rawTurns: rawTurns,
      approximateTurns: roundHandleTurns(rawTurns),
      rangeMin: roundHandleTurns(rawTurns * 0.9),
      rangeMax: roundHandleTurns(rawTurns * 1.1)
    };
  }

  global.ReelCalcCore = {
    ENGINE_VERSION: ENGINE_VERSION,
    YARDS_PER_METER: YARDS_PER_METER,
    MM_PER_INCH: MM_PER_INCH,
    LB_PER_KG: LB_PER_KG,
    LARGE_EXTRAPOLATION_MIN_RATIO: LARGE_EXTRAPOLATION_MIN_RATIO,
    LARGE_EXTRAPOLATION_MAX_RATIO: LARGE_EXTRAPOLATION_MAX_RATIO,
    yardsToMeters: yardsToMeters,
    metersToYards: metersToYards,
    lbToKg: lbToKg,
    kgToLb: kgToLb,
    inchesToMm: inchesToMm,
    mmToInches: mmToInches,
    normalizedRatingType: normalizedRatingType,
    assumedRatingDiameter: assumedRatingDiameter,
    monoDiameter: monoDiameter,
    estimateMonoLbFromDiameter: estimateMonoLbFromDiameter,
    calculateLineCapacityFromDiameter: calculateLineCapacityFromDiameter,
    resolveCapacityRating: resolveCapacityRating,
    capacityFromRating: capacityFromRating,
    estimateSetup: estimateSetup,
    likelyDiameterSuggestion: likelyDiameterSuggestion,
    formatSuggestedDiameter: formatSuggestedDiameter,
    assessDiameter: assessDiameter,
    diameterExtrapolation: diameterExtrapolation,
    publishedBraidCapacityOptions: publishedBraidCapacityOptions,
    publishedBraidCapacityEstimate: publishedBraidCapacityEstimate,
    calculatePublishedBraidCapacity: calculatePublishedBraidCapacity,
    calculateBraidCapacityRange: calculateBraidCapacityRange,
    actualLineBraidCapacityEstimate: actualLineBraidCapacityEstimate,
    calculateActualLineBraidCapacityRange: calculateActualLineBraidCapacityRange,
    capacityBasisForLine: capacityBasisForLine,
    capacityBasisForActualLine: capacityBasisForActualLine,
    calculateCalibratedBacking: calculateCalibratedBacking,
    calculateCalibratedBackingRange: calculateCalibratedBackingRange,
    calculateActualLineCalibratedBacking: calculateActualLineCalibratedBacking,
    calculateActualLineCalibratedBackingRange: calculateActualLineCalibratedBackingRange,
    calculateFullSpoolCapacity: calculateFullSpoolCapacity,
    calculateMainLineCapacity: calculateMainLineCapacity,
    getReelSpoolSpace: getReelSpoolSpace,
    calculateBackingNeeded: calculateBackingNeeded,
    calculateHandleTurns: calculateHandleTurns,
    isReelReady: isReelReady,
    isLineReady: isLineReady
  };
})(window);
