(function(global) {
  "use strict";

  var COMMON_SPOOL_YARDS = [100, 125, 150, 200, 300, 500, 600, 1000, 1500, 3000, 5000];
  var MINIMUM_BUFFER_YARDS = 0;
  var PURCHASE_BUFFER_RATE = 0;

  function normalizedLineType(value) {
    var type = String(value || "line").toLowerCase();
    if (type.indexOf("braid") !== -1) return "braid";
    if (type.indexOf("mono") !== -1) return "monofilament";
    if (type.indexOf("fluoro") !== -1) return "fluorocarbon";
    if (type.indexOf("copoly") !== -1) return "copolymer";
    return "fishing line";
  }

  function searchLineType(value) {
    var type = normalizedLineType(value);
    if (type === "braid") return "braided fishing line";
    if (type === "monofilament") return "monofilament fishing line";
    if (type === "fluorocarbon") return "fluorocarbon fishing line";
    if (type === "copolymer") return "copolymer fishing line";
    return type;
  }

  function recommendedSpoolYards(requiredYards) {
    var required = Math.ceil(Number(requiredYards));
    if (!(required > 0) || required > 100000) return null;
    // Capacity results already include their practical uncertainty where needed.
    // Choose the smallest common spool that covers that result so a 142-yard
    // requirement sensibly points to a 150-yard spool instead of a bulk spool.
    var purchaseTarget = required;
    for (var index = 0; index < COMMON_SPOOL_YARDS.length; index += 1) {
      if (COMMON_SPOOL_YARDS[index] >= purchaseTarget) return COMMON_SPOOL_YARDS[index];
    }
    return Math.ceil(purchaseTarget / 500) * 500;
  }

  function allowedRetailerUrl(value, retailer) {
    try {
      var url = new URL(String(value || ""));
      var host = url.hostname.toLowerCase();
      var allowedHosts = Array.isArray(retailer && retailer.allowedHosts)
        ? retailer.allowedHosts
        : [];
      var allowed = allowedHosts.some(function(allowedHost) {
        var expected = String(allowedHost || "").toLowerCase();
        return expected && (host === expected || host.endsWith("." + expected));
      });
      return url.protocol === "https:" && allowed ? url : null;
    } catch (error) {
      return null;
    }
  }

  function buildSearchUrl(retailer, query) {
    var url = allowedRetailerUrl(retailer && retailer.searchUrl, retailer);
    if (!url) return "";
    url.searchParams.set(retailer.searchQueryParameter || "q", query);
    if (retailer.affiliateTag && retailer.affiliateTagParameter) {
      url.searchParams.set(retailer.affiliateTagParameter, retailer.affiliateTag);
    }
    return url.href;
  }

  function lineProductKey(line) {
    return [line && line.brand, line && line.model].map(function(value) {
      return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    }).join("|");
  }

  function mappedLineOffer(data, line, retailerId, retailer) {
    var exact = data.lines && line.id ? data.lines[line.id] : null;
    var product = data.lineProducts ? data.lineProducts[lineProductKey(line)] : null;
    var mapping = exact || product;
    var offer = mapping && mapping.offers ? mapping.offers[retailerId] : null;
    var lineOffer = offer && (offer.line || offer);
    if (!lineOffer) return null;
    var url = allowedRetailerUrl(lineOffer.url, retailer);
    if (!url) return null;
    return {
      url: url.href,
      matchType: lineOffer.matchType || "exact",
      label: lineOffer.label || retailer.directLineLabel || retailer.directLabel ||
        "Check Current Price at " + (retailer.name || retailerId)
    };
  }

  function buildRecommendedLineOffer(options) {
    var settings = options || {};
    var data = settings.affiliateData;
    var line = settings.line;
    var requiredYards = Number(settings.requiredYards);
    var spoolYards = recommendedSpoolYards(requiredYards);
    if (!data || !line || !(Number(line.lb) > 0) || !spoolYards) return null;

    var priority = Array.isArray(data.retailerPriority) ? data.retailerPriority : [];
    var strength = Number(line.lb);
    var strengthLabel = Number.isInteger(strength) ? String(strength) : String(Number(strength.toFixed(1)));
    var isActualProduct = line.custom_line !== true && line.generic_recommendation !== true && line.brand && line.model;
    var productName = isActualProduct
      ? String(line.brand).trim() + " " + String(line.model).trim()
      : "";
    var query = [
      productName,
      strengthLabel + " lb",
      searchLineType(line.type),
      spoolYards + " yard spool"
    ].filter(Boolean).join(" ");

    for (var index = 0; index < priority.length; index += 1) {
      var retailerId = priority[index];
      var retailer = data.retailers && data.retailers[retailerId];
      if (!retailer) continue;
      var mapped = isActualProduct ? mappedLineOffer(data, line, retailerId, retailer) : null;
      var url = buildSearchUrl(retailer, query);
      if (!mapped && !url) continue;
      return {
        retailerId: retailerId,
        retailerName: retailer.name || retailerId,
        url: mapped ? mapped.url : url,
        matchType: mapped ? mapped.matchType : "generic_search",
        label: mapped ? mapped.label : (isActualProduct
          ? "Check " + productName + " price on " + (retailer.name || retailerId)
          : retailer.lineSearchLabel || "Shop Recommended Line at " + (retailer.name || retailerId)),
        disclosure: [data.genericDisclosure, retailer.disclosure].filter(Boolean).join(" "),
        query: query,
        requiredYards: requiredYards,
        suggestedSpoolYards: spoolYards,
        lineType: normalizedLineType(line.type),
        lineLb: strength,
        lineId: line.id || "",
        lineBrand: line.brand || "",
        lineModel: line.model || ""
      };
    }
    return null;
  }

  global.ReelCalcAffiliateLinks = {
    COMMON_SPOOL_YARDS: COMMON_SPOOL_YARDS.slice(),
    MINIMUM_BUFFER_YARDS: MINIMUM_BUFFER_YARDS,
    PURCHASE_BUFFER_RATE: PURCHASE_BUFFER_RATE,
    normalizedLineType: normalizedLineType,
    lineProductKey: lineProductKey,
    recommendedSpoolYards: recommendedSpoolYards,
    buildRecommendedLineOffer: buildRecommendedLineOffer
  };
})(window);
