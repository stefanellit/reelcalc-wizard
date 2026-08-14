(function(global) {
  "use strict";

  var YARDS_PER_METER = 1.0936132983;
  var MM_PER_INCH = 25.4;
  var LB_PER_KG = 2.2046226218;

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

  function monoDiameter(lb) {
    if (lb <= 2) return 0.006;
    if (lb <= 4) return 0.008;
    if (lb <= 6) return 0.0095;
    if (lb <= 8) return 0.011;
    if (lb <= 10) return 0.012;
    if (lb <= 12) return 0.014;
    if (lb <= 15) return 0.015;
    if (lb <= 20) return 0.018;
    if (lb <= 25) return 0.019;
    if (lb <= 30) return 0.022;
    return 0.025;
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
      estimate = upper.yards;
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

    var publishedYards = options.map(function(option) { return option.yards; });
    var minPublished = Math.min.apply(Math, publishedYards);
    var maxPublished = Math.max.apply(Math, publishedYards);
    estimate = clamp(estimate, Math.max(20, minPublished * 0.5), maxPublished);

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

  function calculateBraidCapacityRange(reel, line) {
    if (!line || !isBraidLine(line)) return null;

    var publishedEstimate = calculatePublishedBraidCapacity(reel, line);
    var centerYards = publishedEstimate
      ? Number(publishedEstimate.yards)
      : Number(calculateMainLineCapacity(reel, line));
    if (!(centerYards > 0)) return null;

    var uncertainty = braidCapacityUncertainty(line, publishedEstimate);
    var minimumYards = roundCapacityRange(centerYards * (1 - uncertainty), "down");
    var maximumYards = roundCapacityRange(centerYards * (1 + uncertainty), "up");

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

  function normalizedLineText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function braidProductMatches(left, right) {
    return isBraidLine(left) && isBraidLine(right) &&
      normalizedLineText(left.brand) === normalizedLineText(right.brand) &&
      normalizedLineText(left.model) === normalizedLineText(right.model);
  }

  function diameterRowsAtStrength(lines, targetLb) {
    return lines.filter(function(candidate) {
      return isBraidLine(candidate) &&
        Number(candidate.dia_in) > 0 &&
        Math.abs(Number(candidate.lb) - targetLb) < 0.001;
    });
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
    var productRows = catalog.filter(function(candidate) {
      return braidProductMatches(line, candidate) && Number(candidate.dia_in) > 0;
    });
    var productExact = diameterRowsAtStrength(productRows, targetLb);
    if (productExact.length) {
      return {
        diameterIn: median(productExact.map(function(candidate) { return Number(candidate.dia_in); })),
        quality: "selected-product-exact",
        qualityRank: 4
      };
    }

    var catalogExact = diameterRowsAtStrength(catalog, targetLb);
    if (catalogExact.length) {
      return {
        diameterIn: median(catalogExact.map(function(candidate) { return Number(candidate.dia_in); })),
        quality: "catalog-median-exact",
        qualityRank: 3
      };
    }

    var productInterpolated = interpolateDiameter(productRows, targetLb);
    if (productInterpolated > 0) {
      return {
        diameterIn: productInterpolated,
        quality: "selected-product-interpolated",
        qualityRank: 2
      };
    }

    var catalogInterpolated = interpolateDiameter(catalog.filter(isBraidLine), targetLb);
    if (catalogInterpolated > 0) {
      return {
        diameterIn: catalogInterpolated,
        quality: "catalog-median-interpolated",
        qualityRank: 1
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
    var centerYards = exactOption
      ? exactOption.yards
      : median(strongestAnchors.map(function(anchor) { return anchor.selectedLineCapacityYards; }));
    if (!(centerYards > 0)) return null;

    var anchorSpread = strongestAnchors.reduce(function(largest, anchor) {
      return Math.max(largest, Math.abs(anchor.selectedLineCapacityYards - centerYards) / centerYards);
    }, 0);
    var baseUncertainty = strongestRank === 5 ? 0.08 : strongestRank >= 4 ? 0.06 : strongestRank === 3 ? 0.10 : 0.12;
    if (line.custom_line === true) baseUncertainty += 0.03;
    var uncertainty = clamp(Math.max(baseUncertainty, anchorSpread + 0.03), baseUncertainty, 0.20);

    return {
      yards: centerYards,
      centerYards: centerYards,
      minimumYards: roundCapacityRange(centerYards * (1 - uncertainty), "down"),
      maximumYards: roundCapacityRange(centerYards * (1 + uncertainty), "up"),
      uncertaintyRate: uncertainty,
      method: exactOption ? "exact" : peOptions.length ? "pe-diameter-calibrated" : "diameter-calibrated",
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

  function calculateBackingForBasis(reel, basis, mainLine, desiredMainLineYards, backingLine) {
    var mainDiameter = Number(mainLine && mainLine.dia_in);
    var backingDiameter = Number(backingLine && backingLine.dia_in);
    var desired = Number(desiredMainLineYards);
    if (!basis || !(mainDiameter > 0) || !(backingDiameter > 0) || !(desired >= 0)) return null;

    // A usable published braid rating is an empirical full-spool anchor. Expressing
    // that anchor in the selected main line's diameter units preserves the rating,
    // then lets the backing diameter divide only the remaining calibrated space.
    var totalSpoolSpace = basis.type.indexOf("published-braid") === 0
      ? basis.capacityYards * mainDiameter * mainDiameter
      : getReelSpoolSpace(reel);
    if (!(totalSpoolSpace > 0)) return null;

    var mainLineSpace = desired * mainDiameter * mainDiameter;
    var backingSpace = totalSpoolSpace - mainLineSpace;
    var conversionTolerance = mainDiameter * mainDiameter * 0.5;
    if (backingSpace < 0 && Math.abs(backingSpace) <= conversionTolerance) backingSpace = 0;
    return {
      basis: basis,
      totalSpoolSpace: totalSpoolSpace,
      mainLineSpace: mainLineSpace,
      backingSpace: backingSpace,
      backingYards: Math.max(0, backingSpace / (backingDiameter * backingDiameter)),
      overCapacity: backingSpace < 0,
      mainPercent: Math.min(100, mainLineSpace / totalSpoolSpace * 100),
      backingPercent: Math.max(0, backingSpace) / totalSpoolSpace * 100
    };
  }

  function calculateCalibratedBacking(reel, mainLine, desiredMainLineYards, backingLine) {
    return calculateBackingForBasis(
      reel,
      capacityBasisForLine(reel, mainLine),
      mainLine,
      desiredMainLineYards,
      backingLine
    );
  }

  function calculateActualLineCalibratedBacking(reel, mainLine, desiredMainLineYards, backingLine, lineCatalog) {
    return calculateBackingForBasis(
      reel,
      capacityBasisForActualLine(reel, mainLine, lineCatalog),
      mainLine,
      desiredMainLineYards,
      backingLine
    );
  }

  function calculateCalibratedBackingRange(reel, mainLine, desiredMainLineYards, backingLine) {
    var center = calculateCalibratedBacking(reel, mainLine, desiredMainLineYards, backingLine);
    var range = calculateBraidCapacityRange(reel, mainLine);
    var mainDiameter = Number(mainLine && mainLine.dia_in);
    var backingDiameter = Number(backingLine && backingLine.dia_in);
    var desired = Number(desiredMainLineYards);
    if (!center || !range || !(mainDiameter > 0) || !(backingDiameter > 0)) return null;

    function backingAtCapacity(capacityYards) {
      var totalSpace = Number(capacityYards) * mainDiameter * mainDiameter;
      var remaining = totalSpace - desired * mainDiameter * mainDiameter;
      return Math.max(0, remaining / (backingDiameter * backingDiameter));
    }

    return {
      minimumYards: backingAtCapacity(range.minimumYards),
      centerYards: center.backingYards,
      maximumYards: backingAtCapacity(range.maximumYards),
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
    var mainDiameter = Number(mainLine && mainLine.dia_in);
    var backingDiameter = Number(backingLine && backingLine.dia_in);
    var desired = Number(desiredMainLineYards);
    if (!center || !range || !(mainDiameter > 0) || !(backingDiameter > 0)) return null;

    function backingAtCapacity(capacityYards) {
      var totalSpace = Number(capacityYards) * mainDiameter * mainDiameter;
      var remaining = totalSpace - desired * mainDiameter * mainDiameter;
      return Math.max(0, remaining / (backingDiameter * backingDiameter));
    }

    return {
      minimumYards: backingAtCapacity(range.minimumYards),
      centerYards: center.backingYards,
      maximumYards: backingAtCapacity(range.maximumYards),
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
    YARDS_PER_METER: YARDS_PER_METER,
    MM_PER_INCH: MM_PER_INCH,
    LB_PER_KG: LB_PER_KG,
    yardsToMeters: yardsToMeters,
    metersToYards: metersToYards,
    lbToKg: lbToKg,
    kgToLb: kgToLb,
    inchesToMm: inchesToMm,
    mmToInches: mmToInches,
    monoDiameter: monoDiameter,
    estimateMonoLbFromDiameter: estimateMonoLbFromDiameter,
    calculateLineCapacityFromDiameter: calculateLineCapacityFromDiameter,
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
