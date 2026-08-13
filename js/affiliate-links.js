(function(global) {
  "use strict";

  var COMMON_SPOOL_YARDS = [100, 125, 150, 200, 300, 500, 600, 1000, 1500, 3000, 5000];
  var MINIMUM_BUFFER_YARDS = 15;
  var PURCHASE_BUFFER_RATE = 0.1;

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
    var purchaseTarget = required + Math.max(MINIMUM_BUFFER_YARDS, Math.ceil(required * PURCHASE_BUFFER_RATE));
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
    var query = strengthLabel + " lb " + searchLineType(line.type) + " " + spoolYards + " yard spool";

    for (var index = 0; index < priority.length; index += 1) {
      var retailerId = priority[index];
      var retailer = data.retailers && data.retailers[retailerId];
      var url = buildSearchUrl(retailer, query);
      if (!retailer || !url) continue;
      return {
        retailerId: retailerId,
        retailerName: retailer.name || retailerId,
        url: url,
        matchType: "generic_search",
        label: retailer.lineSearchLabel || "Shop Recommended Line at " + (retailer.name || retailerId),
        disclosure: [data.genericDisclosure, retailer.disclosure].filter(Boolean).join(" "),
        query: query,
        requiredYards: requiredYards,
        suggestedSpoolYards: spoolYards,
        lineType: normalizedLineType(line.type),
        lineLb: strength
      };
    }
    return null;
  }

  global.ReelCalcAffiliateLinks = {
    COMMON_SPOOL_YARDS: COMMON_SPOOL_YARDS.slice(),
    MINIMUM_BUFFER_YARDS: MINIMUM_BUFFER_YARDS,
    PURCHASE_BUFFER_RATE: PURCHASE_BUFFER_RATE,
    normalizedLineType: normalizedLineType,
    recommendedSpoolYards: recommendedSpoolYards,
    buildRecommendedLineOffer: buildRecommendedLineOffer
  };
})(window);
