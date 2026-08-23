import { featureSentence } from "./features.mjs";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function absoluteAsset(assetBase, path) {
  return `${String(assetBase).replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;
}

const SIZE_GUIDE_RESOURCES = {
  2500: {
    label: "What Line Should I Put on a 2500 Spinning Reel?",
    path: "/blog/what-line-should-i-put-on-a-2500-spinning-reel"
  },
  3000: {
    label: "What Line Should I Put on a 3000 Spinning Reel?",
    path: "/blog/what-line-should-i-put-on-a-3000-spinning-reel"
  },
  4000: {
    label: "What Line Should I Put on a 4000 Spinning Reel?",
    path: "/blog/what-line-should-i-put-on-a-4000-spinning-reel"
  }
};

function resourcesForReel(reel, resources) {
  const size = Number(reel.recommendationSizeClass) ||
    Number(String(reel.sizeClass || "").match(/\d+/)?.[0] || 0);
  const baitcaster = isBaitcaster(reel);
  const sizeGuide = baitcaster ? null : SIZE_GUIDE_RESOURCES[size];
  const applicableResources = baitcaster
    ? resources.filter((resource) => !/spinning reel/i.test(String(resource.label || "")))
    : resources;
  return [...(sizeGuide ? [sizeGuide] : []), ...applicableResources.slice(0, 6)];
}

function isBaitcaster(reel) {
  return /baitcast|casting/.test(String(reel?.reelType || reel?.reel_type || "").toLowerCase());
}

function baitcasterFrameDescriptor(reel) {
  const reelClass = String(reel?.baitcasterClass || reel?.raw?.baitcaster_class || "standard").toLowerCase();
  const labels = {
    bfs: "bait-finesse",
    finesse: "finesse-oriented",
    standard: "standard low-profile",
    power: "power-class",
    deep_spool: "deep-spool",
    heavy_duty: "heavy-duty",
    saltwater_low_profile: "saltwater low-profile",
    round_casting: "round-frame"
  };
  return labels[reelClass] || "low-profile";
}

function formatCapacities(rows) {
  return rows.map((row) =>
    `${row.ratingLabel || `${row.lb} lb`} / ${row.capacityLabel || `${row.yards} yards`}`
  ).join(", ");
}

function formatGearRatio(value) {
  const ratio = String(value || "").trim();
  if (!ratio) return "";
  return /:\d+$/.test(ratio) ? ratio : `${ratio}:1`;
}

function naturalList(values) {
  const items = values.filter(Boolean);
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function humanizeReelType(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("saltwater") && normalized.includes("spinning")) {
    return "saltwater spinning reel";
  }
  if (normalized.includes("freshwater") && normalized.includes("spinning")) {
    return "freshwater spinning reel";
  }
  if (normalized.includes("front_drag") && normalized.includes("freshwater")) {
    return "freshwater spinning reel";
  }
  if (normalized.includes("front_drag") && normalized.includes("saltwater")) {
    return "saltwater spinning reel";
  }
  if (normalized.includes("spinning")) return "spinning reel";
  if (normalized.includes("baitcast")) return "baitcasting reel";
  return normalized.replace(/[_-]+/g, " ").trim() || "fishing reel";
}

function stableIndex(value, count) {
  let hash = 0;
  for (const character of String(value || "")) {
    hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  }
  return count ? hash % count : 0;
}

function numericArticle(value) {
  return /^(?:8|11|18)/.test(String(value || "").trim()) ? "an" : "a";
}

function introProfile(reel, recommendation) {
  const publishedSize = Number(String(reel.sizeClass || "").match(/\d+/)?.[0] || 0);
  const size = Number(reel.recommendationSizeClass) || publishedSize;
  const uses = recommendation.useCases.join(" ").toLowerCase();

  if (isBaitcaster(reel)) {
    if (/bait finesse|bfs/.test(uses)) return "finesse";
    if (/swimbait|heavy cover|frog|big bait|flipping|pitching/.test(uses)) return "heavy";
    if (/inshore|saltwater|coastal/.test(uses)) return "inshore";
    return "freshwater";
  }

  if (size <= 1000 || (size <= 1500 && /ultralight|panfish|creek/.test(uses))) {
    return "ultralight";
  }
  if (recommendation.heavyDuty && /offshore|big saltwater|shark|tuna|large saltwater/.test(uses)) {
    return "offshore";
  }
  if (recommendation.heavyDuty && /surf|pier|heavy bait/.test(uses)) {
    return "surf";
  }
  if (recommendation.heavyDuty && /inshore|saltwater|redfish|speckled trout|tarpon|cobia/.test(uses)) {
    return "big-inshore";
  }
  if (size >= 4000 && /salmon/.test(uses)) return "salmon";
  if (/inshore|saltwater|redfish|speckled trout|tarpon|cobia/.test(uses)) return "inshore";
  if (size >= 3000 && /catfish|carp/.test(uses)) return "catfish";
  if (/pike|muskie|musky/.test(uses)) return "pike";
  if (size <= 2500 && /trout|panfish|finesse|light/.test(uses)) return "finesse";
  if (/bass|walleye|freshwater/.test(uses)) return "freshwater";
  if (recommendation.heavyDuty) return "heavy";
  if (size >= 5000) return "large";
  return "general";
}

function baitcasterRetrieveGuidance(reel) {
  const gearRatio = Number(String(reel.gearRatio || "").match(/\d+(?:\.\d+)?/)?.[0] || 0);
  if (gearRatio > 0 && gearRatio <= 6.4) {
    return `Its ${reel.retrieveIn}-inch pickup favors controlled cadence with crankbaits and steady moving presentations.`;
  }
  if (gearRatio > 0 && gearRatio <= 7.6) {
    return `Its ${reel.retrieveIn}-inch pickup is the versatile middle ground for jigs, soft plastics, topwater, and moving baits.`;
  }
  if (gearRatio > 7.6) {
    return `Its ${reel.retrieveIn}-inch pickup gathers slack quickly after pitches, frog strikes, and casts toward cover.`;
  }
  return "";
}

function buildIntro(reel, recommendation, reelTypeLabel, featureProfile) {
  const uses = naturalList(recommendation.useCases);
  const sizeDescriptor = isBaitcaster(reel)
    ? baitcasterFrameDescriptor(reel)
    : `${reel.sizeClass}-size`;
  const sizeArticle = numericArticle(sizeDescriptor);
  const weightArticle = numericArticle(reel.weightOz);
  const openers = recommendation.heavyDuty
    ? [
        `The ${reel.displayName} (${reel.sku}) is ${sizeArticle} ${sizeDescriptor} ${reelTypeLabel} built for ${uses}.`,
        `Built around ${sizeArticle} ${sizeDescriptor} frame, the ${reel.displayName} (${reel.sku}) is intended for ${uses}.`,
        `The ${reel.displayName} (${reel.sku}) falls in the ${sizeDescriptor} class and is best matched to ${uses}.`
      ]
    : [
        `The ${reel.displayName} (${reel.sku}) is ${sizeArticle} ${sizeDescriptor} ${reelTypeLabel} suited to ${uses}.`,
        `Built around ${sizeArticle} ${sizeDescriptor} frame, the ${reel.displayName} (${reel.sku}) is best matched to ${uses}.`,
        `The ${reel.displayName} (${reel.sku}) falls in the ${sizeDescriptor} class and is intended for ${uses}.`
      ];
  const facts = {
    capacity: `${reel.ratedLineLb} lb / ${reel.capacityYards} yard`,
    drag: `${reel.maxDragLb} lb`,
    retrieve: `${reel.retrieveIn}-inch`,
    size: sizeDescriptor,
    weight: `${reel.weightOz}-ounce`
  };
  const observations = {
    ultralight: [
      `At ${reel.weightOz} oz, it keeps trout and panfish outfits light in hand, while the ${facts.retrieve} retrieve provides controlled line pickup.`,
      `Its ${facts.weight} weight suits repeated finesse casting, and ${reel.retrieveIn} inches of pickup per turn is practical for small jigs and light presentations.`,
      `The ${facts.size} format weighs ${reel.weightOz} oz and retrieves ${reel.retrieveIn} inches per turn, a sensible pairing for light rods and fine-diameter line.`,
      `With ${facts.drag} of published maximum drag and ${weightArticle} ${facts.weight} body, it is scaled for light-line control rather than heavy-cover pressure.`
    ],
    finesse: [
      `At ${reel.weightOz} oz, it stays comfortable for repeated finesse casting, while the ${facts.retrieve} pickup helps manage slack around small jigs and soft plastics.`,
      `Its published ${facts.capacity} capacity baseline gives light-line anglers practical reserve without stepping up to a bulky spool.`,
      `The combination of ${weightArticle} ${facts.weight} body and ${reel.retrieveIn} inches of pickup per turn fits light rods, fine-diameter line, and precision presentations.`,
      `A published maximum drag of ${facts.drag} adds useful headroom for bass and walleye while the reel remains sized for lighter tackle.`
    ],
    freshwater: [
      `Its ${facts.retrieve} pickup helps recover slack around jigs and moving baits, while ${facts.drag} of maximum drag leaves useful room for bass and walleye work.`,
      `At ${reel.weightOz} oz, it remains practical for repeated casting, with ${reel.retrieveIn} inches of pickup per turn for common freshwater presentations.`,
      `The published ${facts.capacity} capacity baseline gives this size useful line reserve without moving into a high-capacity surf reel.`,
      `A ${facts.retrieve} retrieve and ${facts.drag} maximum drag make it a useful middle ground between finesse duty and heavier freshwater setups.`,
      `Its weight, line pickup, and published drag are proportioned for anglers who want one reel to cover several common freshwater techniques.`
    ],
    inshore: [
      `The ${facts.retrieve} pickup helps manage line in current, and ${facts.drag} of maximum drag provides useful headroom for braid-and-leader inshore setups.`,
      `Its published ${facts.capacity} capacity baseline leaves room for working line and leader, while the ${facts.retrieve} pickup supports quick line control around moving fish.`,
      `At ${reel.weightOz} oz, this size balances repeated casting with the line reserve expected for light saltwater and inshore work.`,
      `The combination of ${reel.retrieveIn} inches of pickup per turn and ${facts.drag} maximum drag suits presentations that need both slack recovery and steady pressure.`
    ],
    "big-inshore": [
      `Its published ${facts.capacity} capacity baseline provides working-line reserve for heavier inshore braid and leader combinations.`,
      `The ${facts.retrieve} pickup and ${facts.drag} maximum drag suit larger inshore fish, stronger line, and situations where current adds pressure.`,
      `At ${reel.weightOz} oz, this reel puts capacity and pulling margin ahead of the light feel expected from smaller inshore sizes.`,
      `With ${reel.retrieveIn} inches of pickup per turn, it can recover line efficiently while carrying the stronger braid commonly used for heavy inshore work.`
    ],
    pike: [
      `The ${facts.drag} maximum drag and ${facts.retrieve} pickup provide useful control for pike, heavier bass, and leader-based setups.`,
      `Its published ${facts.capacity} capacity baseline leaves room for stronger main line and the heavier leaders commonly used around toothy fish.`,
      `With ${reel.retrieveIn} inches of pickup per turn, it can gather slack quickly when working larger lures or steering fish away from cover.`,
      `At ${reel.weightOz} oz with ${facts.drag} of maximum drag, it favors line control and pulling margin over ultralight handling.`
    ],
    catfish: [
      `The published ${facts.capacity} capacity baseline provides room for the heavier mono or braid-backed setups commonly used for catfish and bait fishing.`,
      `Its ${facts.drag} maximum drag and working-line reserve favor steady pressure and stronger line over finesse handling.`,
      `The ${facts.retrieve} pickup gathers line efficiently after a long cast, while the spool rating leaves useful reserve for sustained runs.`,
      `At ${reel.weightOz} oz, this size is better suited to larger baits and line capacity than to an all-day ultralight outfit.`
    ],
    salmon: [
      `Its ${facts.retrieve} pickup helps control slack in current, while the published ${facts.capacity} baseline supplies useful reserve for salmon and larger freshwater fish.`,
      `The combination of ${facts.drag} maximum drag and a ${facts.capacity} capacity baseline supports stronger line and fish that can make a sustained run.`,
      `With ${reel.retrieveIn} inches of pickup per turn, it can recover line efficiently when a fish changes direction in current.`,
      `At ${reel.weightOz} oz, it emphasizes line reserve and control for salmon and heavy freshwater work rather than finesse duty.`
    ],
    surf: [
      `Its published ${facts.capacity} capacity baseline gives surf and pier anglers useful reserve for long casts and running fish.`,
      `With ${reel.retrieveIn} inches of pickup per turn and ${facts.drag} of maximum drag, it is equipped to manage heavier line across open water and current.`,
      `At ${reel.weightOz} oz, this is a capacity-first reel for surf, pier, and heavy bait work rather than an all-day finesse option.`,
      `The large-spool format retrieves ${reel.retrieveIn} inches per turn, helping recover line efficiently after long casts or when repositioning baits.`
    ],
    offshore: [
      `Its published ${facts.capacity} capacity baseline and ${facts.drag} maximum drag emphasize heavy-line reserve for offshore and big-water use.`,
      `The ${facts.retrieve} pickup moves substantial line per crank, while ${facts.drag} of maximum drag supports heavier braid setups.`,
      `At ${reel.weightOz} oz, this is deliberately a power-and-capacity reel rather than a light-tackle all-rounder.`,
      `The spool's published capacity and ${facts.drag} maximum drag are aimed at hard-running fish, heavy leaders, and demanding saltwater conditions.`
    ],
    heavy: [
      `The published ${facts.capacity} capacity baseline and ${facts.drag} maximum drag make line reserve and pulling margin the priorities.`,
      `Its ${facts.retrieve} pickup gathers line quickly across a large spool, while the rated capacity supports heavier working line.`,
      `At ${reel.weightOz} oz, this reel is sized around capacity and sustained pressure rather than light-tackle handling.`,
      `With ${reel.retrieveIn} inches of pickup per turn and a ${facts.capacity} capacity baseline, it is built around demanding big-reel work.`
    ],
    large: [
      `Its published ${facts.capacity} capacity baseline gives anglers extra working-line reserve for larger fish and heavier presentations.`,
      `The ${facts.retrieve} pickup and ${facts.drag} maximum drag provide a practical step up from common 3000- and 4000-size setups.`,
      `At ${reel.weightOz} oz, it trades some light-tackle feel for additional capacity and control with stronger line.`,
      `With ${reel.retrieveIn} inches of pickup per turn, this size can manage slack efficiently while carrying more line than a typical freshwater reel.`
    ],
    general: [
      `At ${reel.weightOz} oz with a ${facts.retrieve} retrieve, its published dimensions fit the mix of casting comfort and line control expected from this size.`,
      `Its ${facts.capacity} capacity baseline and ${facts.drag} maximum drag provide a practical reference for choosing line without oversizing the setup.`,
      `The reel retrieves ${reel.retrieveIn} inches per turn and weighs ${reel.weightOz} oz, giving anglers a clear sense of how it will balance line pickup and handling.`,
      `The combination of published capacity, ${facts.retrieve} pickup, and ${facts.drag} maximum drag defines a versatile working range for this reel.`
    ]
  };
  const profile = introProfile(reel, recommendation);
  const profileObservations = observations[profile];
  const openerIndex = stableIndex(`${reel.id}:opener`, openers.length);
  const observationIndex = stableIndex(`${reel.id}:observation`, profileObservations.length);
  const retrieveGuidance = isBaitcaster(reel) ? baitcasterRetrieveGuidance(reel) : "";

  const approvedIntroTerms = (featureProfile?.terms || []).slice(0, 2);
  const verifiedFeatureSentence = featureSentence({ ...featureProfile, terms: approvedIntroTerms });
  const verifiedSpecificationSentence = `${reel.weightOz} oz, ${reel.retrieveIn} inches of line pickup per handle turn, and ${reel.maxDragLb} lb of published maximum drag define the working scale of this exact model.`;
  const marketSentence = /^(?:JP|JDM|Japan)$/i.test(String(reel.marketRegion || ""))
    ? `This page follows the exact Japanese-market ${reel.sku} specifications rather than a similarly named U.S. model.`
    : "";
  const detailMode = verifiedFeatureSentence ? "verified-features" : "verified-specifications";
  return {
    text: [
      openers[openerIndex],
      marketSentence,
      verifiedFeatureSentence || verifiedSpecificationSentence,
      retrieveGuidance || profileObservations[observationIndex]
    ].filter(Boolean).join(" "),
    variant: `${profile}-o${openerIndex + 1}-f${observationIndex + 1}-${verifiedFeatureSentence ? `t${approvedIntroTerms.length}` : "spec"}`,
    detailMode,
    featureNames: approvedIntroTerms.map((term) => term.name),
    evidenceSource: featureProfile?.sourceUrl || reel.sourceUrl,
    evidenceKey: featureProfile?.key || `${reel.brand}|${reel.model}`
  };
}

function tableRows(rows, cells) {
  return rows.map((row) =>
    `<tr>${cells.map((cell) => `<td>${escapeHtml(cell(row))}</td>`).join("")}</tr>`
  ).join("\n");
}

function linkList(items) {
  return items.map((item) =>
    `<li><a href="${escapeHtml(item.path)}">${escapeHtml(item.label)}</a></li>`
  ).join("\n");
}

export function buildPageModel({
  reel,
  page,
  registry,
  recommendation,
  calculatorDefaults,
  capacityRows,
  related,
  featureProfile
}) {
  const exactName = reel.displayName;
  const baitcaster = isBaitcaster(reel);
  const pageName = baitcaster ? exactName : `${reel.brand} ${reel.model} ${reel.sizeClass}`;
  const wizardUrl = `${registry.wizardPath}?reel=${encodeURIComponent(reel.id)}`;
  const comparisonUrl = `${registry.comparisonPath || "/reel-comparison"}?reel1=${encodeURIComponent(reel.id)}`;
  const monoText = formatCapacities(capacityRows.filter((row) => row.type === "Monofilament"));
  const braidText = formatCapacities(capacityRows.filter((row) => row.type !== "Monofilament"));
  const capacityIntro = monoText
    ? `${reel.brand} lists the monofilament capacities as ${monoText}.${braidText ? ` The published braid ratings are ${braidText}.` : ""} These factory ratings establish the spool's baseline, while the calculator adjusts the estimate for the diameter of the line you select.`
    : `${reel.brand} publishes braid capacity for this exact model as ${braidText}. No monofilament capacity is listed in the cited specification, so ReelCalc keeps the published braid rating as the calculator's verified baseline instead of inventing a mono rating.`;
  const faqCapacity = monoText
    ? `The reel is published at ${monoText}.${braidText ? ` Its listed braid ratings are ${braidText}.` : ""} Actual capacity can vary with the diameter of the exact line selected.`
    : `The cited specification publishes ${braidText} for this exact reel. Actual capacity can vary with the diameter of the exact braid selected.`;
  const heavyDuty = recommendation.heavyDuty;
  const gearRatio = formatGearRatio(reel.gearRatio);
  const useCaseText = recommendation.useCases.join(" ").toLowerCase();
  const hasSaltwaterUse = /inshore|surf|saltwater|offshore|redfish|speckled trout|tarpon|cobia/.test(useCaseText);
  const hasFreshwaterUse = /bass|walleye|trout|salmon|pike|catfish|panfish|freshwater/.test(useCaseText);
  const reelTypeLabel = hasSaltwaterUse && hasFreshwaterUse
    ? humanizeReelType(reel.reelType).replace(/^(?:freshwater|saltwater)\s+/, "")
    : (hasSaltwaterUse
      ? humanizeReelType(reel.reelType).replace(/^freshwater\s+/, "")
      : humanizeReelType(reel.reelType));
  const introModel = buildIntro(reel, recommendation, reelTypeLabel, featureProfile);

  return {
    reel,
    page,
    registry,
    recommendation,
    calculatorDefaults,
    capacityRows,
    related: related.map((item) => ({
      label: `${item.reel.brand} ${item.reel.model} ${item.reel.size_label || item.reel.size_class} Line Capacity & Setup Guide`,
      path: item.path,
      reelId: item.reelId
    })),
    resources: resourcesForReel(reel, registry.resources),
    pageTitle: `${exactName} Line Capacity & Reel Setup Guide`,
    suggestedUrl: `${registry.siteBaseUrl}${page.path}`,
    seoTitle: `${pageName} Line Capacity, Specs & Best Line - ReelCalc`,
    metaDescription: `${pageName} line capacity, specifications, recommended line sizes, backing guidance, and a pre-loaded ReelCalc spool calculator.`,
    wizardUrl,
    comparisonUrl,
    sourceLinkLabel: /official/i.test(String(reel.sourceName || ""))
      ? `${reel.brand}'s official ${/^(?:JP|JDM|Japan)$/i.test(String(reel.marketRegion || "")) ? "Japanese" : "U.S."} product specifications`
      : (reel.sourceName || "the published product specifications"),
    monoText,
    braidText,
    intro: introModel.text,
    introVariant: introModel.variant,
    introDetailMode: introModel.detailMode,
    introFeatureNames: introModel.featureNames,
    introEvidenceSource: introModel.evidenceSource,
    introEvidenceKey: introModel.evidenceKey,
    who: baitcaster
      ? `This baitcaster makes the most sense for anglers fishing ${naturalList(recommendation.useCases)}. Its spool holds practical casting-line amounts without the bulk of a deep conventional reel. Use ${recommendation.monoRange} for a straightforward main line, or ${recommendation.braidRange} when you want more strength for the same diameter and can manage braid carefully on the spool.`
      : heavyDuty
      ? `This reel makes the most sense for anglers fishing ${naturalList(recommendation.useCases)}. Its deep spool is designed around heavy line and substantial reserve, so ${recommendation.braidRange} over monofilament backing is usually more practical than filling the entire spool with premium braid. Anglers who prefer a straight-line setup can use the published ${recommendation.monoRange} range.`
      : `This reel makes the most sense for anglers fishing ${naturalList(recommendation.useCases)}. Its published capacity gives you room to choose between a simple ${recommendation.monoRange} setup or a thinner ${recommendation.braidRange} setup with a leader. That flexibility is useful when the same reel may see light presentations one day and stronger fish or mixed cover the next.`,
    calculatorIntro: `This calculator is pre-loaded for the exact ${reel.displayName}. Choose the actual line you plan to spool and ReelCalc automatically uses the appropriate published mono or braid capacity. In backing mode, the suggested main-line amount adjusts when needed to leave practical room for backing. The ${reel.retrieveIn}-inch retrieve is also loaded for the handle-turn estimate.`,
    setupIntro: baitcaster
      ? `A practical starting point for the ${exactName} is ${recommendation.primarySetup}. A short mono base can prevent braid from slipping and can reduce how much premium line is needed, but this compact spool does not require a large backing layer. Since two lines with the same pound-test label can have different diameters, use the listed diameter of the exact line whenever it is available.`
      : `A practical starting point for the ${exactName} is ${recommendation.primarySetup}. Backing lets you put the useful amount of working line on top without filling the entire spool with premium line. Since two lines with the same pound-test label can have different diameters, use the listed diameter of the exact line whenever it is available.`,
    capacityIntro,
    specsIntro: baitcaster
      ? `The ${exactName} uses a ${gearRatio} gear ratio. ${baitcasterRetrieveGuidance(reel)} It weighs ${reel.weightOz} oz and has a published maximum drag of ${reel.maxDragLb} lb. Maximum drag is the reel's upper rating, not a suggestion to fish every setup at that setting.`
      : heavyDuty
      ? `The ${exactName} uses a ${gearRatio} gear ratio and retrieves ${reel.retrieveIn} inches per handle turn. It weighs ${reel.weightOz} oz and has a published maximum drag of ${reel.maxDragLb} lb, reflecting its focus on capacity and pulling power rather than light-tackle handling. Maximum drag is the reel's upper rating, not a suggestion to fish every setup at that setting.`
      : `The ${exactName} uses a ${gearRatio} gear ratio and retrieves ${reel.retrieveIn} inches per handle turn, which helps pick up slack without making the reel oversized for its intended uses. It weighs ${reel.weightOz} oz and has a published maximum drag of ${reel.maxDragLb} lb. Maximum drag is the reel's upper rating, not a suggestion to fish every setup at that setting.`,
    faqBraid: baitcaster
      ? `${recommendation.braidRange} is the practical ReelCalc range for this baitcaster. Use the lighter end for open water and easier casting, and the stronger end around vegetation, docks, wood, frogs, or larger baits. Avoid choosing very thin braid only to maximize yardage because thin braid can dig into a baitcaster spool under load.`
      : heavyDuty
      ? `${recommendation.braidRange} is the practical ReelCalc range for this reel. Use the lighter end when line capacity and casting distance matter most. Move toward the stronger end for large baits, rough structure, heavy current, or situations where abrasion resistance and pulling power take priority.`
      : `${recommendation.braidRange} is the practical ReelCalc range for this reel. Use the lighter end for finesse presentations, trout, and open water. Move toward the stronger end for bass, current, vegetation, or situations where a little more abrasion resistance and control are useful.`,
    faqCapacity
  };
}

export function renderSquarespaceBlock(model, assetBase) {
  const { reel, recommendation, capacityRows } = model;
  const relatedLinks = model.related.length
    ? `<ul class="reelcalc-link-list">${linkList(model.related)}</ul>`
    : "<p>No verified related reel-page links are registered yet.</p>";
  const resourceLinks = `<ul class="reelcalc-link-list">${linkList(model.resources)}</ul>`;
  const setupRows = tableRows(recommendation.rows, [
    (row) => row.use,
    (row) => row.setup
  ]);
  const capacityTableRows = tableRows(capacityRows, [
    (row) => row.type,
    (row) => row.ratingLabel || `${row.lb} lb`,
    (row) => row.capacityLabel || `${row.yards} yards`
  ]);
  const specs = [
    ["Exact model", reel.sku],
    ["Reel size", reel.sizeLabel],
    ...(isBaitcaster(reel) ? [["Retrieve hand", reel.retrieveHand || "Not specified"]] : []),
    ["Gear ratio", formatGearRatio(reel.gearRatio)],
    ["Line retrieve", `${reel.retrieveIn} inches per crank`],
    ["Weight", `${reel.weightOz} oz`],
    ["Maximum drag", `${reel.maxDragLb} lb`],
    ["Bearings", reel.bearings],
    ["Mono capacity", model.monoText],
    ["Braid capacity", model.braidText || "Not published in the trusted record"]
  ];
  const specsRows = specs.map(([label, value]) =>
    `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
  ).join("\n");
  const cssUrl = absoluteAsset(assetBase, "css/reel-page.css?v=3");
  const calculatorUrl = absoluteAsset(assetBase, "js/reel-page-calculator.js");
  const runtimeUrl = absoluteAsset(assetBase, "js/reel-page-runtime.js?v=3");

  return `<!-- ReelCalc generated reel page: ${escapeHtml(reel.id)} -->
<link rel="stylesheet" href="${escapeHtml(cssUrl)}">
<article
  class="reelcalc-reel-page"
  data-reel-id="${escapeHtml(reel.id)}"
  data-capacity-yards="${escapeHtml(reel.capacityYards)}"
  data-rated-line-lb="${escapeHtml(reel.ratedLineLb)}">
  <section class="reelcalc-page-section" data-section="introduction">
    <div class="reelcalc-page-content">
      <img
        class="reelcalc-product-image"
        src="${escapeHtml(model.page.imageUrl)}"
        alt="${escapeHtml(model.page.imageAlt)}"
        width="481"
        height="481"
        referrerpolicy="no-referrer"
        loading="eager">
      <p class="reelcalc-page-kicker">ReelCalc Reel Setup Guide</p>
      <h1>${escapeHtml(model.pageTitle)}</h1>
      <p class="reelcalc-page-summary">${escapeHtml(model.intro)}</p>
    </div>
  </section>

  <section class="reelcalc-page-section" data-section="quick-answer">
    <div class="reelcalc-page-content reelcalc-page-content--narrow">
      <h2>Quick Answer: Best Line for the ${escapeHtml(reel.displayName)}</h2>
      <div class="reelcalc-page-quick-answer">
        <p><strong>Best overall range:</strong> ${escapeHtml(recommendation.braidRange)}</p>
        <p><strong>Simple alternative:</strong> ${escapeHtml(recommendation.monoRange)}</p>
        <p>${escapeHtml([recommendation.quickAnswer, model.page.quickAnswerNote].filter(Boolean).join(" "))}</p>
      </div>
      <p><a href="${escapeHtml(model.wizardUrl)}">Open this exact reel in the Reel Setup Wizard.</a></p>
    </div>
  </section>

  <section class="reelcalc-page-section" data-section="who-is-this-reel-for">
    <div class="reelcalc-page-content reelcalc-page-content--narrow">
      <h2>Who Is the ${escapeHtml(reel.displayName)} For?</h2>
      <p>${escapeHtml(model.who)}</p>
    </div>
  </section>

  <section class="reelcalc-page-section" data-section="calculator">
    <div class="reelcalc-page-content">
      <h2>Use the Pre-Loaded ${escapeHtml(isBaitcaster(reel) ? reel.displayName : `${reel.model} ${reel.sizeClass}`)} ReelCalc Calculator</h2>
      <p>${escapeHtml(model.calculatorIntro)}</p>
      <div
        data-reelcalc-calculator
        data-reel-id="${escapeHtml(reel.id)}"
        data-main-line-lb="${escapeHtml(model.calculatorDefaults.mainLineLb)}"
        data-main-line-yards="${escapeHtml(model.calculatorDefaults.mainLineYards)}"
        data-main-line-diameter-in="${escapeHtml(model.calculatorDefaults.mainLineDiameterIn)}"
        data-backing-lb="${escapeHtml(model.calculatorDefaults.backingLb)}"
        data-backing-diameter-in="${escapeHtml(model.calculatorDefaults.backingDiameterIn)}"
      ></div>
    </div>
  </section>

  <section class="reelcalc-page-section" data-section="best-line-setup">
    <div class="reelcalc-page-content">
      <h2>Best Line Setup for the ${escapeHtml(reel.displayName)}</h2>
      <p>${escapeHtml(model.setupIntro)}</p>
      <div class="reelcalc-table-wrap">
        <table>
          <thead><tr><th>Fishing Use</th><th>Suggested Line Setup</th></tr></thead>
          <tbody>${setupRows}</tbody>
        </table>
      </div>
      <div
        class="reelcalc-affiliate-area"
        data-reelcalc-affiliates
        data-affiliate-kind="line"
        data-reel-id="${escapeHtml(reel.id)}"
        hidden></div>
    </div>
  </section>

  <section class="reelcalc-page-section" data-section="line-capacity">
    <div class="reelcalc-page-content">
      <h2>${escapeHtml(reel.displayName)} Line Capacity</h2>
      <p>${escapeHtml(model.capacityIntro)}</p>
      <div class="reelcalc-table-wrap">
        <table>
          <thead><tr><th>Line Type</th><th>Line Rating</th><th>Capacity</th></tr></thead>
          <tbody>${capacityTableRows}</tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="reelcalc-page-section" data-section="specifications">
    <div class="reelcalc-page-content">
      <h2>${escapeHtml(reel.displayName)} Specs</h2>
      <p>${escapeHtml(model.specsIntro)}</p>
      <div class="reelcalc-table-wrap">
        <table>
          <thead><tr><th>Specification</th><th>${escapeHtml(reel.displayName)}</th></tr></thead>
          <tbody>${specsRows}</tbody>
        </table>
      </div>
      <p class="reelcalc-source-note">Specifications checked against <a href="${escapeHtml(reel.sourceUrl)}" rel="nofollow noopener" target="_blank">${escapeHtml(model.sourceLinkLabel)}</a>.</p>
      <div
        class="reelcalc-affiliate-area"
        data-reelcalc-affiliates
        data-affiliate-kind="reel"
        data-reel-id="${escapeHtml(reel.id)}"
        hidden></div>
    </div>
  </section>

  <section class="reelcalc-page-section" data-section="faqs">
    <div class="reelcalc-page-content reelcalc-page-content--narrow">
      <h2>${escapeHtml(reel.displayName)} FAQs</h2>
      <h3>What Size Braid Is Best for the ${escapeHtml(reel.displayName)}?</h3>
      <p>${escapeHtml(model.faqBraid)}</p>
      <h3>How Much Line Does the ${escapeHtml(reel.displayName)} Hold?</h3>
      <p>${escapeHtml(model.faqCapacity)}</p>
    </div>
  </section>

  <section class="reelcalc-page-section" data-section="related-resources">
    <div class="reelcalc-page-content">
      <h2>Related Reel Pages and ReelCalc Resources</h2>
      <h3>Compare Similar Reels</h3>
      ${relatedLinks}
      <h3>Helpful Resources</h3>
      ${resourceLinks}
    </div>
  </section>

  <section class="reelcalc-page-section reelcalc-page-cta" data-section="wizard-cta">
    <div class="reelcalc-page-content">
      <h2>Build Your ${escapeHtml(reel.displayName)} Line Setup</h2>
      <p>Open the Reel Setup Wizard with this exact reel already selected for a guided line and backing recommendation.</p>
      <div class="reelcalc-page-actions">
        <a class="reelcalc-page-button" href="${escapeHtml(model.wizardUrl)}">Open This Reel in the Setup Wizard</a>
        <a class="reelcalc-page-button reelcalc-page-button--secondary reelcalc-comparison-link" data-reel-id="${escapeHtml(reel.id)}" data-link-placement="page_cta" href="${escapeHtml(model.comparisonUrl)}">Compare This Reel</a>
      </div>
    </div>
  </section>
</article>
<script src="${escapeHtml(calculatorUrl)}"></script>
<script src="${escapeHtml(runtimeUrl)}"></script>`;
}

export function renderPreviewDocument(model, block) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(model.pageTitle)} - Local Preview</title>
  <meta name="description" content="${escapeHtml(model.metaDescription)}">
  <style>
    body { margin: 0; padding: 34px 0; font-family: Arial, sans-serif; color: #1f2528; }
  </style>
</head>
<body>
${block}
</body>
</html>`;
}
