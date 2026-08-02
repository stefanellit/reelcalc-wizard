(function() {
  "use strict";

  var loaderScript = document.currentScript;
  var scriptUrl = new URL(loaderScript.src, document.baseURI);
  var assetBase = loaderScript.dataset.assetBase
    ? new URL(loaderScript.dataset.assetBase, document.baseURI)
    : new URL("../", scriptUrl);
  var affiliateDataPromise = null;

  function isAllowedRetailerUrl(value, retailer) {
    try {
      var url = new URL(value);
      if (url.protocol !== "https:") return false;
      var host = url.hostname.toLowerCase();
      var allowedHosts = Array.isArray(retailer && retailer.allowedHosts)
        ? retailer.allowedHosts
        : [];
      return allowedHosts.some(function(allowedHost) {
        var allowed = String(allowedHost || "").toLowerCase();
        return allowed && (host === allowed || host.endsWith("." + allowed));
      });
    } catch (error) {
      return false;
    }
  }

  function loadAffiliateData() {
    if (!affiliateDataPromise) {
      var url = new URL("data/reel-affiliates.json", assetBase).href;
      affiliateDataPromise = fetch(url, { credentials: "omit" }).then(function(response) {
        if (!response.ok) throw new Error("Affiliate data returned HTTP " + response.status + ".");
        return response.json();
      });
    }
    return affiliateDataPromise;
  }

  function resolvePreferredReelOffer(data, reelId) {
    var mapping = data && data.reels ? data.reels[reelId] : null;
    var priority = data && Array.isArray(data.retailerPriority)
      ? data.retailerPriority
      : [];
    if (!mapping) return null;

    for (var index = 0; index < priority.length; index += 1) {
      var retailerId = priority[index];
      var retailer = data.retailers && data.retailers[retailerId];
      var offer = mapping.offers && mapping.offers[retailerId]
        ? mapping.offers[retailerId].reel
        : null;
      if (!retailer || !offer || !isAllowedRetailerUrl(offer.url, retailer)) continue;
      var isSearch = offer.matchType === "search";
      return {
        retailerId: retailerId,
        retailerName: retailer.name || retailerId,
        url: offer.url,
        matchType: isSearch ? "search" : "exact",
        label: offer.label || (isSearch ? retailer.searchLabel : retailer.directLabel) ||
          "Check Current Price at " + (retailer.name || retailerId),
        disclosure: [data.genericDisclosure, retailer.disclosure].filter(Boolean).join(" ")
      };
    }
    return null;
  }

  function renderAffiliateArea(mount, data) {
    var kind = mount.dataset.affiliateKind === "reel" ? "reel" : "line";
    var offer = kind === "reel"
      ? resolvePreferredReelOffer(data, mount.dataset.reelId)
      : null;
    if (!offer) {
      mount.hidden = true;
      mount.replaceChildren();
      return;
    }

    var heading = document.createElement("h3");
    heading.textContent = kind === "reel" ? "Check Current Reel Price" : "Lines That Match This Setup";
    var disclosure = document.createElement("p");
    disclosure.className = "reelcalc-affiliate-disclosure";
    disclosure.textContent = offer.disclosure;
    var links = document.createElement("div");
    links.className = "reelcalc-affiliate-links";

    var link = document.createElement("a");
    link.className = "reelcalc-affiliate-link";
    link.href = offer.url;
    link.target = "_blank";
    link.rel = "sponsored nofollow noopener";
    link.textContent = offer.label;
    link.dataset.retailer = offer.retailerId;
    link.dataset.matchType = offer.matchType;
    links.appendChild(link);

    mount.replaceChildren(heading, disclosure, links);
    mount.hidden = false;
  }

  function initializeAffiliates() {
    var mounts = Array.from(document.querySelectorAll("[data-reelcalc-affiliates]"));
    if (!mounts.length) return;
    mounts.forEach(function(mount) {
      mount.hidden = true;
    });

    loadAffiliateData().then(function(data) {
      mounts.forEach(function(mount) {
        renderAffiliateArea(mount, data);
      });
    }).catch(function() {
      mounts.forEach(function(mount) {
        mount.hidden = true;
        mount.replaceChildren();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAffiliates, { once: true });
  } else {
    initializeAffiliates();
  }

  window.ReelCalcReelPageRuntime = {
    initialize: initializeAffiliates
  };
})();
