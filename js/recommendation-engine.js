(function(global) {
  "use strict";

  var COMMON_LB = [2, 3, 4, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 65, 80, 100, 120];
  var MAX_RECOMMENDED_FULL_SPOOL_YARDS = 600;
  var recommendationCapacityFloorCache = new Map();

  var PFLUEGER_SIZE_EQUIVALENTS = {
    20: 500,
    25: 1000,
    30: 2000,
    35: 2500,
    40: 3000
  };

  var SHORT_REEL_SIZE_SYSTEMS = {
    "abu garcia": { maximum: 40, multiplier: 100 },
    "bass pro shops": { maximum: 40, multiplier: 100 },
    "lew's": { maximum: 400, multiplier: 10 },
    quantum: { maximum: 99, multiplier: 100 }
  };

  var TYPICAL_DIAMETER_RANGES_IN = {
    Braid: {
      4: [0.004, 0.006],
      6: [0.0045, 0.0065],
      8: [0.005, 0.007],
      10: [0.006, 0.007],
      12: [0.0065, 0.008],
      15: [0.007, 0.009],
      20: [0.008, 0.010],
      25: [0.009, 0.011],
      30: [0.010, 0.012],
      40: [0.012, 0.014],
      50: [0.014, 0.016],
      65: [0.016, 0.018],
      80: [0.017, 0.020],
      100: [0.018, 0.021],
      120: [0.021, 0.024]
    },
    Monofilament: {
      2: [0.005, 0.007],
      4: [0.007, 0.009],
      6: [0.009, 0.011],
      8: [0.010, 0.012],
      10: [0.011, 0.013],
      12: [0.013, 0.015],
      15: [0.014, 0.017],
      20: [0.017, 0.020],
      25: [0.019, 0.022],
      30: [0.021, 0.024],
      40: [0.024, 0.028],
      50: [0.027, 0.032],
      60: [0.030, 0.036]
    },
    Fluorocarbon: {
      4: [0.006, 0.008],
      6: [0.008, 0.010],
      8: [0.009, 0.011],
      10: [0.010, 0.012],
      12: [0.011, 0.0135],
      15: [0.013, 0.016],
      20: [0.015, 0.019],
      25: [0.017, 0.021],
      30: [0.020, 0.024],
      40: [0.024, 0.029],
      50: [0.028, 0.034],
      60: [0.032, 0.039]
    }
  };

  var FISHING_PROFILES = {
    trout: {
      label: "trout and panfish",
      setups: [
        profile("finesse", "Finesse Setup", "Braid", [4, 6], "Fluorocarbon", [2, 4]),
        profile("best-overall", "Best Overall Setup", "Braid", [6, 8], "Fluorocarbon", [4, 6]),
        profile("casting-distance", "Casting Distance Setup", "Braid", [4, 8], "Fluorocarbon", [2, 6]),
        profile("simple-mono", "Simple Mono Setup", "Monofilament", [4, 6], "", [0, 0]),
        profile("fluorocarbon", "Fluorocarbon Setup", "Fluorocarbon", [4, 6], "", [0, 0]),
        profile("heavy-cover", "Heavier Cover Setup", "Braid", [8, 10], "Fluorocarbon", [6, 8])
      ]
    },
    bass: {
      label: "bass",
      setups: [
        profile("finesse", "Finesse Setup", "Braid", [8, 10], "Fluorocarbon", [4, 8]),
        profile("best-overall", "Best Overall Setup", "Braid", [10, 15], "Fluorocarbon", [6, 10]),
        profile("heavy-cover", "Heavy Cover Setup", "Braid", [20, 30], "Fluorocarbon", [10, 15]),
        profile("casting-distance", "Casting Distance Setup", "Braid", [8, 12], "Fluorocarbon", [6, 8]),
        profile("simple-mono", "Simple Mono Setup", "Monofilament", [8, 12], "", [0, 0]),
        profile("fluorocarbon", "Fluorocarbon Setup", "Fluorocarbon", [8, 12], "", [0, 0])
      ]
    },
    walleye: {
      label: "walleye",
      setups: [
        profile("finesse", "Finesse Setup", "Braid", [6, 10], "Fluorocarbon", [6, 8]),
        profile("best-overall", "Best Overall Setup", "Braid", [10, 12], "Fluorocarbon", [8, 10]),
        profile("casting-distance", "Casting Distance Setup", "Braid", [8, 10], "Fluorocarbon", [6, 8]),
        profile("simple-mono", "Simple Mono Setup", "Monofilament", [6, 10], "", [0, 0]),
        profile("fluorocarbon", "Fluorocarbon Setup", "Fluorocarbon", [6, 10], "", [0, 0]),
        profile("heavy-cover", "Heavier Current Setup", "Braid", [15, 20], "Fluorocarbon", [10, 12])
      ]
    },
    inshore: {
      label: "inshore saltwater",
      setups: [
        profile("finesse", "Light Inshore Setup", "Braid", [10, 15], "Fluorocarbon", [15, 20]),
        profile("best-overall", "Best Overall Setup", "Braid", [15, 30], "Fluorocarbon", [20, 25]),
        profile("heavy-cover", "Heavy Structure Setup", "Braid", [30, 40], "Fluorocarbon", [25, 40]),
        profile("casting-distance", "Casting Distance Setup", "Braid", [10, 20], "Fluorocarbon", [15, 25]),
        profile("simple-mono", "Simple Mono Setup", "Monofilament", [10, 15], "", [0, 0]),
        profile("fluorocarbon", "Fluorocarbon Setup", "Fluorocarbon", [12, 20], "", [0, 0])
      ]
    },
    surf: {
      label: "surf and heavy saltwater",
      setups: [
        profile("casting-distance", "Casting Distance Setup", "Braid", [30, 40], "Fluorocarbon", [30, 40]),
        profile("best-overall", "Best Overall Setup", "Braid", [40, 50], "Fluorocarbon", [40, 50]),
        profile("heavy-cover", "Heavy Surf Setup", "Braid", [50, 80], "Fluorocarbon", [50, 60]),
        profile("simple-mono", "Simple Mono Setup", "Monofilament", [15, 25], "", [0, 0]),
        profile("fluorocarbon", "Fluorocarbon Setup", "Fluorocarbon", [15, 25], "", [0, 0])
      ]
    },
    freshwater: {
      label: "general freshwater",
      setups: [
        profile("finesse", "Finesse Setup", "Braid", [6, 10], "Fluorocarbon", [4, 8]),
        profile("best-overall", "Best Overall Setup", "Braid", [10, 15], "Fluorocarbon", [6, 10]),
        profile("heavy-cover", "Heavier Cover Setup", "Braid", [15, 25], "Fluorocarbon", [10, 12]),
        profile("casting-distance", "Casting Distance Setup", "Braid", [8, 12], "Fluorocarbon", [6, 8]),
        profile("simple-mono", "Simple Mono Setup", "Monofilament", [6, 10], "", [0, 0]),
        profile("fluorocarbon", "Fluorocarbon Setup", "Fluorocarbon", [6, 10], "", [0, 0])
      ]
    }
  };

  var FISHING_REEL_COMPATIBILITY = {
    trout: {
      label: "trout / panfish",
      commonRange: "500 to 3000",
      tooLargeAt: 4000,
      alternate: "Surf / heavy saltwater"
    },
    bass: {
      label: "bass",
      commonRange: "1000 to 4000",
      tooSmallBelow: 1000,
      tooLargeAt: 5000,
      alternate: "Surf / heavy saltwater"
    },
    walleye: {
      label: "walleye",
      commonRange: "1000 to 4000",
      tooSmallBelow: 1000,
      tooLargeAt: 5000,
      alternate: "Surf / heavy saltwater"
    },
    freshwater: {
      label: "general freshwater",
      commonRange: "500 to 4000",
      tooLargeAt: 5000,
      alternate: "Surf / heavy saltwater"
    },
    inshore: {
      label: "inshore saltwater",
      commonRange: "2500 to 6000",
      tooSmallBelow: 2500,
      tooLargeAt: 8000,
      tooSmallAlternate: "Bass or general freshwater",
      tooLargeAlternate: "Surf / heavy saltwater"
    },
    surf: {
      label: "surf / heavy saltwater",
      commonRange: "4000 and larger",
      tooSmallBelow: 3500,
      alternate: "Inshore saltwater or bass"
    }
  };

  var PRIORITY_BONUS = {
    "all-around": {
      "best-overall": 28,
      "casting-distance": 6,
      "finesse": 2,
      "heavy-cover": -6,
      "simple-mono": 2,
      "fluorocarbon": -2
    },
    distance: {
      "casting-distance": 44,
      "finesse": 14,
      "best-overall": -4,
      "heavy-cover": -22,
      "simple-mono": -8,
      "fluorocarbon": -10
    },
    sensitivity: {
      "finesse": 18,
      "best-overall": 16,
      "casting-distance": 10,
      "heavy-cover": 4,
      "simple-mono": -10,
      "fluorocarbon": -4
    },
    simplicity: {
      "simple-mono": 30,
      "best-overall": -2,
      "fluorocarbon": 3,
      "finesse": -6,
      "casting-distance": -6,
      "heavy-cover": -10
    },
    abrasion: {
      "heavy-cover": 24,
      "fluorocarbon": 18,
      "best-overall": 9,
      "simple-mono": 4,
      "finesse": -10,
      "casting-distance": -12
    }
  };

  function profile(useCase, title, mainType, mainRange, leaderType, leaderRange) {
    return {
      useCase: useCase,
      title: title,
      mainType: mainType,
      mainRange: mainRange,
      leaderType: leaderType,
      leaderRange: leaderRange
    };
  }

  function recommendSetups(options) {
    var reel = options && options.reel;
    var lines = options && options.lines ? options.lines : [];
    var fishingType = options && options.fishingType || "freshwater";
    var priority = options && options.priority || "all-around";
    var core = global.ReelCalcCore || {};
    var calculateFullSpoolCapacity = options && options.calculateFullSpoolCapacity || core.calculateFullSpoolCapacity;
    var publishedBraidCapacityEstimate = core.publishedBraidCapacityEstimate;
    var actualLineBraidCapacityEstimate = core.actualLineBraidCapacityEstimate;
    if (!reel || !calculateFullSpoolCapacity) return [];
    if (!recommendationCompatibility(reel, fishingType).recommend) return [];

    var group = FISHING_PROFILES[fishingType] || FISHING_PROFILES.freshwater;
    var reelSize = reelSizeClass(reel);
    var setups = group.setups.map(function(setupProfile) {
      setupProfile = scaledProfileForReel(setupProfile, reelSize, fishingType);
      setupProfile = profileForReel(setupProfile, reel, lines);
      if (!setupProfile) return null;
      return pickBestSetupForProfile(setupProfile, {
        reel: reel,
        lines: lines,
        fishingType: fishingType,
        priority: priority,
        speciesLabel: group.label,
        calculateFullSpoolCapacity: calculateFullSpoolCapacity,
        publishedBraidCapacityEstimate: publishedBraidCapacityEstimate,
        actualLineBraidCapacityEstimate: actualLineBraidCapacityEstimate
      });
    }).filter(Boolean).filter(function(setup) {
      return setupFitsReelSize(setup, reel, fishingType);
    });

    return setups.sort(function(a, b) {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      return setupPriorityOrder(a.useCase) - setupPriorityOrder(b.useCase);
    });
  }

  function scaledProfileForReel(setupProfile, reelSize, fishingType) {
    if (fishingType !== "surf" || !(reelSize >= 8000)) return setupProfile;

    var tier;
    if (reelSize >= 18000) {
      tier = {
        "casting-distance": [80, 100],
        "best-overall": [100, 120],
        "heavy-cover": [100, 120],
        "simple-mono": [40, 60]
      };
    } else if (reelSize >= 14000) {
      tier = {
        "casting-distance": [65, 80],
        "best-overall": [80, 100],
        "heavy-cover": [100, 120],
        "simple-mono": [30, 50]
      };
    } else if (reelSize >= 10000) {
      tier = {
        "casting-distance": [50, 65],
        "best-overall": [65, 80],
        "heavy-cover": [80, 100],
        "simple-mono": [25, 40]
      };
    } else {
      tier = {
        "casting-distance": [40, 50],
        "best-overall": [50, 65],
        "heavy-cover": [65, 80],
        "simple-mono": [20, 30]
      };
    }

    var mainRange = tier[setupProfile.useCase];
    if (!mainRange) return setupProfile;
    return {
      useCase: setupProfile.useCase,
      title: setupProfile.title,
      mainType: setupProfile.mainType,
      mainRange: mainRange,
      leaderType: setupProfile.leaderType,
      leaderRange: setupProfile.leaderRange
    };
  }

  function profileForReel(setupProfile, reel, lines) {
    if (normalizeType(setupProfile.mainType) !== "Braid") {
      return setupProfile;
    }

    var reelRange = recommendedBraidRange(reel, lines);
    if (!reelRange || Number(setupProfile.mainRange[0]) >= reelRange[0]) return setupProfile;

    if (Number(setupProfile.mainRange[1]) < reelRange[0] && setupProfile.useCase !== "best-overall") {
      return null;
    }

    var adjustedMaximum = Math.max(Number(setupProfile.mainRange[1]), reelRange[0]);

    return {
      useCase: setupProfile.useCase,
      title: setupProfile.title,
      mainType: setupProfile.mainType,
      mainRange: [reelRange[0], adjustedMaximum],
      leaderType: setupProfile.leaderType,
      leaderRange: setupProfile.leaderRange
    };
  }

  function recommendedBraidRange(reel, lines) {
    var value = String(reel && reel.reelcalc_recommended_braid || "");
    var strengths = value.match(/\d+(?:\.\d+)?/g);
    var minimum = strengths && strengths.length ? Number(strengths[0]) : 0;
    var maximum = strengths && strengths.length ? Number(strengths[1] || strengths[0]) : 0;
    var core = global.ReelCalcCore || {};
    var publishedOptions = core.publishedBraidCapacityOptions
      ? core.publishedBraidCapacityOptions(reel)
      : [];
    if (publishedOptions.length) {
      var lightestPublished = Math.min.apply(Math, publishedOptions.map(function(option) {
        return Number(option.lb);
      }));
      minimum = Math.max(minimum, lightestPublished * 0.5);
      maximum = Math.max(maximum, minimum);
    }
    if (minimum > 0) {
      minimum = recommendationCapacityFloor(reel, lines, minimum);
      maximum = Math.max(maximum, minimum);
    }
    if (!(minimum > 0) || !(maximum >= minimum)) return null;
    return [minimum, maximum];
  }

  function recommendationCapacityFloor(reel, lines, startingMinimum) {
    var core = global.ReelCalcCore || {};
    if (!core.actualLineBraidCapacityEstimate || !Array.isArray(lines)) return startingMinimum;

    var cacheKey = [
      reel && reel.id || "manual-reel",
      reel && reel.braid_capacity_note || "",
      reel && reel.capacity_yards || "",
      reel && reel.rated_line_diameter_in || "",
      startingMinimum,
      lines.length
    ].join("|");
    if (recommendationCapacityFloorCache.has(cacheKey)) {
      return recommendationCapacityFloorCache.get(cacheKey);
    }

    var options = COMMON_LB.filter(function(lb) {
      return lb >= startingMinimum;
    });
    for (var index = 0; index < options.length; index += 1) {
      var line = genericLine(lines, "Braid", options[index]);
      if (!line) continue;
      var estimate = core.actualLineBraidCapacityEstimate(reel, line, lines);
      if (!estimate || Number(estimate.centerYards) <= MAX_RECOMMENDED_FULL_SPOOL_YARDS) {
        recommendationCapacityFloorCache.set(cacheKey, options[index]);
        return options[index];
      }
    }
    recommendationCapacityFloorCache.set(cacheKey, startingMinimum);
    return startingMinimum;
  }

  function setupFitsReelSize(setup, reel, fishingType) {
    var reelSize = reelSizeClass(reel);
    if (!reelSize) return true;

    if (setup.useCase === "heavy-cover" && reelSize <= 1000) {
      return false;
    }
    if (fishingType === "inshore" && reelSize >= 5000) {
      return setup.useCase !== "finesse" && setup.useCase !== "casting-distance";
    }
    if (fishingType === "surf" && reelSize >= 8000 && setup.useCase === "fluorocarbon") {
      return false;
    }
    return true;
  }

  function recommendationCompatibility(reel, fishingType) {
    var reelSize = reelSizeClass(reel);
    var reelLabel = reelDisplaySize(reel, reelSize);
    var rule = FISHING_REEL_COMPATIBILITY[fishingType];
    if (!reelSize || !rule) {
      return { recommend: true, message: "" };
    }

    if (rule.tooLargeAt && reelSize >= rule.tooLargeAt) {
      var tooLargeAlternate = suggestedFishingTypesForReelSize(reelSize, fishingType);
      return {
        recommend: false,
        message: "This " + reelLabel + " size reel is much larger than a normal " + rule.label + " setup. ReelCalc will not call light line a Best Pick on this reel. For realistic recommendations with this reel, use " + tooLargeAlternate + ", or use exact line mode to calculate a specific line."
      };
    }

    if (rule.tooSmallBelow && reelSize < rule.tooSmallBelow) {
      var tooSmallAlternate = suggestedFishingTypesForReelSize(reelSize, fishingType);
      return {
        recommend: false,
        message: "This " + reelLabel + " size reel is smaller than a normal " + rule.label + " setup. For realistic recommendations with this reel, use " + tooSmallAlternate + ", or use exact line mode to calculate a specific line."
      };
    }

    return { recommend: true, message: "" };
  }

  function suggestedFishingTypesForReelSize(reelSize, currentFishingType) {
    var labels = [];
    Object.keys(FISHING_REEL_COMPATIBILITY).forEach(function(type) {
      var rule = FISHING_REEL_COMPATIBILITY[type];
      if (type === currentFishingType) return;
      if (rule.tooLargeAt && reelSize >= rule.tooLargeAt) return;
      if (rule.tooSmallBelow && reelSize < rule.tooSmallBelow) return;
      labels.push(rule.label);
    });

    if (!labels.length) return "exact line mode";
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return labels[0] + " or " + labels[1];
    return labels.slice(0, -1).join(", ") + ", or " + labels[labels.length - 1];
  }

  function pickBestSetupForProfile(setupProfile, context) {
    var candidates = buildCandidates(setupProfile, context.lines);
    if (!candidates.length) return null;

    return candidates.map(function(candidate) {
      return scoreCandidate(setupProfile, candidate, context);
    }).sort(function(a, b) {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      return a.line.lb - b.line.lb;
    })[0];
  }

  function buildCandidates(setupProfile, lines) {
    var mainOptions = lbOptions(setupProfile.mainRange);
    var leaderOptions = setupProfile.leaderType ? lbOptions(setupProfile.leaderRange) : [0];
    var candidates = [];

    mainOptions.forEach(function(mainLb) {
      var mainLine = genericLine(lines, setupProfile.mainType, mainLb);
      if (!mainLine) return;
      leaderOptions.forEach(function(leaderLb) {
        candidates.push({
          line: mainLine,
          leaderType: setupProfile.leaderType,
          leaderLb: leaderLb
        });
      });
    });

    return candidates;
  }

  function scoreCandidate(setupProfile, candidate, context) {
    var reel = context.reel;
    var line = candidate.line;
    var actualBraidEstimate = context.actualLineBraidCapacityEstimate
      ? context.actualLineBraidCapacityEstimate(reel, line, context.lines)
      : null;
    var capacity = actualBraidEstimate
      ? actualBraidEstimate.centerYards
      : context.calculateFullSpoolCapacity(reel, line);
    var publishedBraidEstimate = context.publishedBraidCapacityEstimate
      ? context.publishedBraidCapacityEstimate(reel, line)
      : null;
    var reelSize = reelSizeClass(reel);
    var score = 35;
    var warnings = [];
    var tradeoffs = [];
    var reasons = [];

    score += priorityBonus(context.priority, setupProfile.useCase);
    score += reelFitScore(setupProfile, reelSize, context.fishingType);
    score += lineStrengthScore(setupProfile, line.lb, candidate.leaderLb, reelSize);
    score += capacityFitScore(setupProfile, context.fishingType, capacity);
    score += diameterFitScore(setupProfile, context.priority, line, reel);
    score += realisticDiameterScore(line);

    warnings = warnings.concat(reelWarnings(setupProfile, reel, line, capacity));
    tradeoffs = tradeoffs.concat(tradeoffNotes(setupProfile, context.priority));
    reasons = reasons.concat(reasonNotes(setupProfile, context, line, candidate.leaderLb, capacity));

    warnings.forEach(function() { score -= 8; });
    var rankScore = Math.round(score);
    var displayScore = Math.max(0, Math.min(100, rankScore));

    return {
      title: setupProfile.title,
      useCase: setupProfile.useCase,
      line: line,
      leaderType: candidate.leaderType,
      leaderLb: candidate.leaderLb,
      capacityYards: Number(capacity) || 0,
      score: displayScore,
      rankScore: rankScore,
      explanation: reasons.join(" "),
      tradeoffs: tradeoffs,
      warnings: warnings,
      diameterNote: diameterNote(line),
      capacityBasis: actualBraidEstimate ? "published-braid-diameter" : publishedBraidEstimate ? "published-braid" : "diameter",
      publishedBraidEstimate: publishedBraidEstimate,
      actualLineBraidEstimate: actualBraidEstimate
    };
  }

  function lbOptions(range) {
    var min = Number(range[0]) || 0;
    var max = Number(range[1]) || min;
    return COMMON_LB.filter(function(lb) {
      return lb >= min && lb <= max;
    });
  }

  function genericLine(lines, type, lb) {
    var diameter = typicalDiameter(lines, type, lb);
    if (!(diameter && diameter.dia_in > 0)) return null;
    return {
      id: "generic-" + normalizeType(type).toLowerCase() + "-" + String(lb) + "-typical",
      brand: "Generic",
      model: "Typical diameter",
      type: type,
      lb: lb,
      dia_in: diameter.dia_in,
      dia_mm: Number((diameter.dia_in * 25.4).toFixed(3)),
      generic_recommendation: true,
      diameter_source: diameter.source,
      diameter_stats: diameter.stats,
      diameter_range_in: diameter.range
    };
  }

  function typicalDiameter(lines, type, lb) {
    var genericType = normalizeType(type);
    var range = typicalRange(genericType, lb);
    var diameters = lines.filter(function(line) {
      return lineEligibleForRecommendations(line) && lineMatchesType(line, genericType) && Number(line.lb) === Number(lb) && Number(line.dia_in) > 0;
    }).map(function(line) {
      return Number(line.dia_in);
    }).sort(function(a, b) {
      return a - b;
    });

    if (!diameters.length) {
      return fallbackDiameter(lines, genericType, lb, range);
    }

    var filtered = diameters.slice();
    if (range) {
      filtered = filtered.filter(function(value) {
        return value >= range[0] && value <= range[1];
      });
    }
    if (!filtered.length) filtered = trimDiameters(diameters);

    var value = median(filtered);
    if (range) value = clamp(value, range[0], range[1]);

    return {
      dia_in: roundDiameter(value),
      range: range,
      source: range ? "database median inside realistic range" : "database trimmed median",
      stats: stats(diameters, filtered)
    };
  }

  function fallbackDiameter(lines, type, lb, range) {
    var nearby = lines.filter(function(line) {
      return lineEligibleForRecommendations(line) && lineMatchesType(line, type) && Number(line.lb) > 0 && Number(line.dia_in) > 0;
    }).map(function(line) {
      return {
        lb: Number(line.lb),
        dia: Number(line.dia_in)
      };
    }).sort(function(a, b) {
      return Math.abs(a.lb - lb) - Math.abs(b.lb - lb);
    }).slice(0, 8).map(function(item) {
      return item.dia;
    }).sort(function(a, b) {
      return a - b;
    });

    var value;
    var source = "nearest database diameter";
    if (nearby.length) {
      value = median(trimDiameters(nearby));
    } else if (type === "Monofilament" && global.ReelCalcCore && global.ReelCalcCore.monoDiameter) {
      value = global.ReelCalcCore.monoDiameter(lb);
      source = "standard mono diameter estimate";
    } else if (range) {
      value = (range[0] + range[1]) / 2;
      source = "realistic range midpoint";
    }

    if (!(value > 0)) return null;
    if (range) value = clamp(value, range[0], range[1]);
    return {
      dia_in: roundDiameter(value),
      range: range,
      source: source,
      stats: stats(nearby, nearby)
    };
  }

  function trimDiameters(values) {
    if (values.length < 5) return values.slice();
    var trim = Math.max(1, Math.floor(values.length * 0.12));
    return values.slice(trim, values.length - trim);
  }

  function median(values) {
    if (!values.length) return 0;
    var middle = Math.floor(values.length / 2);
    if (values.length % 2) return values[middle];
    return (values[middle - 1] + values[middle]) / 2;
  }

  function stats(allValues, usedValues) {
    var all = allValues || [];
    var used = usedValues || [];
    return {
      count: all.length,
      usedCount: used.length,
      min: all.length ? all[0] : 0,
      median: all.length ? median(all) : 0,
      max: all.length ? all[all.length - 1] : 0
    };
  }

  function typicalRange(type, lb) {
    var table = TYPICAL_DIAMETER_RANGES_IN[type];
    if (!table) return null;
    if (table[lb]) return table[lb];
    var nearest = Object.keys(table).map(Number).sort(function(a, b) {
      return Math.abs(a - lb) - Math.abs(b - lb);
    })[0];
    return table[nearest] || null;
  }

  function priorityBonus(priority, useCase) {
    var table = PRIORITY_BONUS[priority] || PRIORITY_BONUS["all-around"];
    return Number(table[useCase]) || 0;
  }

  function reelFitScore(setupProfile, reelSize, fishingType) {
    var useCase = setupProfile.useCase;
    if (useCase === "heavy-cover") {
      if (reelSize && reelSize <= 1000) return -32;
      if (reelSize && reelSize < 2500) return -18;
      if (reelSize && reelSize >= 4000) return 18;
      if (reelSize && reelSize >= 3000) return 14;
      return 7;
    }
    if (useCase === "finesse") {
      if (reelSize && reelSize <= 1000) return 18;
      if (reelSize && reelSize <= 2500) return 13;
      if (reelSize && reelSize <= 3000) return 7;
      return fishingType === "surf" ? -20 : -6;
    }
    if (useCase === "casting-distance") {
      if (reelSize && reelSize <= 1000) return 4;
      if (reelSize && reelSize <= 3000) return 12;
      return 8;
    }
    if (useCase === "best-overall") {
      if (reelSize && reelSize <= 1000) return -4;
      if (reelSize && reelSize <= 3000) return 16;
      return 9;
    }
    if (useCase === "simple-mono") return reelSize && reelSize <= 1000 ? 8 : 5;
    if (useCase === "fluorocarbon") return reelSize && reelSize >= 4000 ? 3 : 0;
    return 0;
  }

  function lineStrengthScore(setupProfile, mainLb, leaderLb, reelSize) {
    var targetMain = idealMainLb(setupProfile, reelSize);
    var targetLeader = setupProfile.leaderType ? idealLeaderLb(setupProfile, reelSize) : 0;
    var score = 12 - Math.abs(mainLb - targetMain) * strengthPenalty(setupProfile.useCase);
    if (setupProfile.leaderType) {
      score += 8 - Math.abs(leaderLb - targetLeader) * 1.3;
    }
    if (setupProfile.useCase === "heavy-cover" && mainLb < 20) score -= 25;
    if (setupProfile.useCase === "finesse" && mainLb > 10) score -= 16;
    return score;
  }

  function idealMainLb(setupProfile, reelSize) {
    var min = setupProfile.mainRange[0];
    var max = setupProfile.mainRange[1];
    if (setupProfile.useCase === "heavy-cover") {
      if (reelSize && reelSize >= 3000) return max;
      return min;
    }
    if (setupProfile.useCase === "best-overall") {
      if (reelSize && reelSize >= 2500) return max;
      return min;
    }
    if (setupProfile.useCase === "finesse") return min;
    if (setupProfile.useCase === "casting-distance") return min;
    if (setupProfile.useCase === "simple-mono") return reelSize && reelSize >= 3000 ? max : min;
    return Math.round((min + max) / 2);
  }

  function idealLeaderLb(setupProfile, reelSize) {
    var min = setupProfile.leaderRange[0];
    var max = setupProfile.leaderRange[1];
    if (setupProfile.useCase === "heavy-cover") {
      if (reelSize && reelSize >= 3000) return max;
      return min;
    }
    if (setupProfile.useCase === "best-overall") {
      if (reelSize && reelSize >= 3000) return max;
      return min;
    }
    if (setupProfile.useCase === "finesse") return reelSize && reelSize <= 1000 ? min : (min + max) / 2;
    return min;
  }

  function strengthPenalty(useCase) {
    if (useCase === "heavy-cover") return 0.9;
    if (useCase === "best-overall") return 1.1;
    if (useCase === "finesse") return 2.4;
    if (useCase === "casting-distance") return 2.2;
    return 1.4;
  }

  function capacityFitScore(setupProfile, fishingType, capacity) {
    var target = capacityTarget(setupProfile, fishingType);
    if (!(capacity > 0)) return -35;
    if (capacity >= target) return 10;
    if (capacity >= target * 0.8) return 3;
    if (capacity >= target * 0.6) return -10;
    return -24;
  }

  function capacityTarget(setupProfile, fishingType) {
    var base = {
      trout: 70,
      bass: 85,
      walleye: 90,
      freshwater: 80,
      inshore: 120,
      surf: 160
    }[fishingType] || 80;
    if (setupProfile.useCase === "heavy-cover") return base * 0.75;
    if (setupProfile.useCase === "casting-distance") return base * 1.05;
    if (setupProfile.useCase === "finesse") return base * 0.9;
    return base;
  }

  function diameterFitScore(setupProfile, priority, line, reel) {
    var diameter = Number(line.dia_in);
    var rated = Number(reel.rated_line_diameter_in);
    var score = 0;

    if (rated > 0 && diameter > rated * 1.45) score -= 22;
    else if (rated > 0 && diameter > rated * 1.2) score -= 8;
    else if (rated > 0 && diameter <= rated) score += 4;

    if (priority === "distance" || setupProfile.useCase === "casting-distance" || setupProfile.useCase === "finesse") {
      score += thinnerWithinRealisticRangeScore(line);
      if (Number(line.dia_in) <= 0.006) score += 4;
      else if (Number(line.dia_in) <= 0.007) score += 2;
    }
    if (setupProfile.useCase === "heavy-cover" && priority !== "distance") {
      score += 4;
    }
    return score;
  }

  function thinnerWithinRealisticRangeScore(line) {
    var range = line.diameter_range_in;
    if (!range) return 0;
    var span = range[1] - range[0];
    if (!(span > 0)) return 0;
    var position = (Number(line.dia_in) - range[0]) / span;
    return Math.round((1 - clamp(position, 0, 1)) * 6);
  }

  function realisticDiameterScore(line) {
    var statsValue = line.diameter_stats || {};
    var score = 0;
    if (statsValue.count >= 4) score += 5;
    if (statsValue.usedCount && statsValue.count && statsValue.usedCount < statsValue.count) score += 3;
    return score;
  }

  function reelWarnings(setupProfile, reel, line, capacity) {
    var reelSize = reelSizeClass(reel);
    var warnings = [];
    var rated = Number(reel.rated_line_diameter_in);
    var diameter = Number(line.dia_in);

    if (setupProfile.useCase === "heavy-cover" && reelSize && reelSize <= 1000) {
      warnings.push("This is a small reel for heavy cover. Consider a 2500 to 4000 size reel before using this setup.");
    } else if (setupProfile.useCase === "heavy-cover" && reelSize && reelSize < 2500) {
      warnings.push("This reel is on the small side for heavy cover, so capacity and line management may be limited.");
    }

    if (rated > 0 && diameter > rated * 1.45) {
      warnings.push("The main line is much thicker than the reel's rated line, so spool capacity will drop quickly.");
    }

    if (capacity > 0 && capacity < capacityTarget(setupProfile, "bass") * 0.55 && setupProfile.useCase !== "simple-mono") {
      warnings.push("Estimated capacity is low for this style. A larger reel or thinner line would be more comfortable.");
    }

    return warnings;
  }

  function tradeoffNotes(setupProfile, priority) {
    var notes = {
      "finesse": ["Great for lighter baits and clear water, but not the first choice around thick grass or heavy wood."],
      "best-overall": ["A balanced choice when you want one setup that can handle a lot of everyday fishing."],
      "heavy-cover": ["More power around weeds, docks, and stronger hooksets, with less casting distance and less line on the spool."],
      "casting-distance": ["Easier to cast with lighter baits, while still using a realistic line diameter."],
      "simple-mono": ["Easy to tie and forgiving to fish with, but it will not feel as crisp as braid."],
      "fluorocarbon": ["Good when low visibility and abrasion resistance matter, but a full spool of fluoro can feel stiffer."]
    }[setupProfile.useCase] || [];

    if (priority === "abrasion" && setupProfile.leaderType) {
      notes = notes.concat(["Since abrasion resistance matters here, the leader is kept a little stronger."]);
    }
    if (priority === "distance" && setupProfile.mainType === "Braid") {
      notes = notes.concat(["Since casting distance was selected, this favors the lighter side of the braid range."]);
    }
    return notes;
  }

  function reasonNotes(setupProfile, context, line, leaderLb, capacity) {
    var reelSize = reelSizeClass(context.reel);
    var reason = setupIntro(setupProfile, context.speciesLabel);
    if (reelSize) reason += " It is a good match for a " + reelDisplaySize(context.reel, reelSize) + " size reel.";

    var diameterReason = lineRoleCopy(line, setupProfile);

    var capacityReason;
    if (capacity > 0 && normalizeType(line.type) === "Braid") {
      capacityReason = "Use the best estimate as your starting point; the expected range allows for differences in braid thickness, winding tension, and fill level.";
    } else if (capacity > 0) {
      capacityReason = "On this reel, expect roughly " + String(Math.round(capacity)) + " yards on a full spool.";
    } else {
      capacityReason = "ReelCalc could not estimate full-spool capacity for this setup.";
    }

    var leaderReason = setupProfile.leaderType && leaderLb
      ? "The " + String(leaderLb) + " lb " + setupProfile.leaderType.toLowerCase() + " leader gives you a practical bite section without making the setup feel too bulky."
      : "No leader is needed, so the setup stays simple.";

    return [reason, diameterReason, leaderReason, capacityReason].filter(Boolean);
  }

  function diameterNote(line) {
    if (!line || !line.generic_recommendation) return "";
    return "For this suggestion, ReelCalc uses a typical real-world diameter for " + String(line.lb) + " lb " + normalizeType(line.type).toLowerCase() + " so the capacity estimate stays realistic.";
  }

  function setupIntro(setupProfile, speciesLabel) {
    var label = speciesLabel || "this type of fishing";
    var copy = {
      "finesse": "This is the lighter, more responsive setup for small baits, clear water, and subtle bites.",
      "best-overall": "This is the everyday " + label + " setup: enough strength to be useful, but still easy to cast and manage.",
      "heavy-cover": "This is the stronger setup for grass, docks, wood, and situations where you need more control over the fish.",
      "casting-distance": "This setup leans toward easier casting and lighter-line handling without getting unrealistically thin.",
      "simple-mono": "This is the simplest setup to spool, tie, and fish without adding a leader knot.",
      "fluorocarbon": "This setup is for anglers who want a low-visibility main line with more abrasion resistance."
    };
    return copy[setupProfile.useCase] || "This setup is a practical match for " + label + ".";
  }

  function lineRoleCopy(line, setupProfile) {
    var type = normalizeType(line.type).toLowerCase();
    if (type === "braid") {
      if (setupProfile.useCase === "heavy-cover") {
        return String(line.lb) + " lb braid gives you more pulling strength while still staying manageable on a spinning reel.";
      }
      if (setupProfile.useCase === "finesse" || setupProfile.useCase === "casting-distance") {
        return String(line.lb) + " lb braid keeps the main line light, sensitive, and easy to cast.";
      }
      return String(line.lb) + " lb braid keeps the main line thin, sensitive, and easy to cast.";
    }
    if (type === "monofilament") {
      return String(line.lb) + " lb monofilament keeps the setup forgiving and simple.";
    }
    if (type === "fluorocarbon") {
      return String(line.lb) + " lb fluorocarbon gives you low visibility and better abrasion resistance.";
    }
    return String(line.lb) + " lb " + type + " is a practical fit for this setup.";
  }

  function setupLabel(useCase) {
    return String(useCase || "").replace(/-/g, " ");
  }

  function setupPriorityOrder(useCase) {
    return {
      "best-overall": 1,
      "finesse": 2,
      "casting-distance": 3,
      "heavy-cover": 4,
      "simple-mono": 5,
      "fluorocarbon": 6
    }[useCase] || 20;
  }

  function reelSizeClass(reel) {
    var explicitSize = Number(reel && reel.recommendation_size_class);
    if (explicitSize > 0) return explicitSize;

    var raw = reel && (reel.size_class || reel.size_label || "");
    var match = String(raw).match(/\d+/);
    var size = match ? Number(match[0]) : 0;
    var brand = String(reel && reel.brand || "").toLowerCase();
    if (brand === "pflueger" && PFLUEGER_SIZE_EQUIVALENTS[size]) {
      return PFLUEGER_SIZE_EQUIVALENTS[size];
    }

    var shortSizeSystem = SHORT_REEL_SIZE_SYSTEMS[brand];
    if (shortSizeSystem && size > 0 && size <= shortSizeSystem.maximum) {
      return size * shortSizeSystem.multiplier;
    }
    return size;
  }

  function reelDisplaySize(reel, fallback) {
    var raw = reel && (reel.size_label || reel.size_class || "");
    return String(raw || fallback || "");
  }

  function lineMatchesType(line, desiredType) {
    var type = String(line.type || "").toLowerCase();
    if (desiredType === "Braid") return type.indexOf("braid") !== -1;
    if (desiredType === "Monofilament") return type.indexOf("mono") !== -1;
    if (desiredType === "Fluorocarbon") return type.indexOf("fluoro") !== -1 && type.indexOf("coated") === -1 && type.indexOf("leader") === -1;
    return type.indexOf(String(desiredType || "").toLowerCase()) !== -1;
  }

  function lineEligibleForRecommendations(line) {
    return line && line.recommendation_eligible !== false;
  }

  function normalizeType(type) {
    var value = String(type || "").toLowerCase();
    if (value.indexOf("braid") !== -1) return "Braid";
    if (value.indexOf("mono") !== -1) return "Monofilament";
    if (value.indexOf("fluoro") !== -1) return "Fluorocarbon";
    if (value.indexOf("copoly") !== -1) return "Copolymer";
    return String(type || "Line");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundDiameter(value) {
    return Number(Number(value).toFixed(4));
  }

  function formatDiameter(value) {
    return Number(value).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }

  global.ReelCalcRecommendations = {
    recommendSetups: recommendSetups,
    recommendationCompatibility: recommendationCompatibility,
    typicalDiameter: typicalDiameter,
    reelSizeClass: reelSizeClass
  };
})(typeof window !== "undefined" ? window : globalThis);
