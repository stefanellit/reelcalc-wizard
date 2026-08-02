(function() {
  "use strict";

  var loaderScript = document.currentScript;
  var scriptUrl = new URL(loaderScript.src, document.baseURI);
  var assetBase = loaderScript.dataset.assetBase
    ? new URL(loaderScript.dataset.assetBase, document.baseURI)
    : new URL("../", scriptUrl);
  var affiliateDataPromise = null;
  var analyticsPromise = null;

  function loadAnalytics() {
    if (window.ReelCalcAnalytics) return Promise.resolve(window.ReelCalcAnalytics);
    if (analyticsPromise) return analyticsPromise;
    var src = new URL("js/analytics.js", assetBase).href;
    var existing = Array.from(document.scripts).find(function(script) {
      return script.src === src;
    });
    analyticsPromise = new Promise(function(resolve) {
      if (existing) {
        existing.addEventListener("load", function() {
          resolve(window.ReelCalcAnalytics || null);
        }, { once: true });
        existing.addEventListener("error", function() { resolve(null); }, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.dataset.assetBase = assetBase.href;
      script.onload = function() { resolve(window.ReelCalcAnalytics || null); };
      script.onerror = function() { resolve(null); };
      document.head.appendChild(script);
    });
    return analyticsPromise;
  }

  function track(name, parameters, options) {
    if (window.ReelCalcAnalytics && typeof window.ReelCalcAnalytics.track === "function") {
      window.ReelCalcAnalytics.track(name, parameters || {}, options || {});
      return;
    }
    window.ReelCalcAnalyticsQueue = window.ReelCalcAnalyticsQueue || [];
    window.ReelCalcAnalyticsQueue.push({
      name: name,
      parameters: parameters || {},
      options: options || {}
    });
    loadAnalytics();
  }

  function reelDetailParameters(detail) {
    var data = detail || {};
    return {
      page_type: "reel_guide",
      reel_id: data.reelId || "",
      reel_brand: data.reelBrand || "",
      reel_model: data.reelModel || "",
      reel_size: data.reelSize || ""
    };
  }

  function trackReelPageViews() {
    document.querySelectorAll(".reelcalc-reel-page[data-reel-id]").forEach(function(page) {
      var reelId = page.dataset.reelId || "";
      if (!reelId) return;
      track("reel_page_view", {
        page_type: "reel_guide",
        reel_id: reelId
      }, { onceKey: location.pathname + "|" + reelId });
    });
  }

  function initializeAnalytics() {
    if (document.documentElement.dataset.reelcalcPageAnalyticsReady === "true") {
      trackReelPageViews();
      return;
    }
    document.documentElement.dataset.reelcalcPageAnalyticsReady = "true";
    trackReelPageViews();

    document.addEventListener("reelcalc:calculator-ready", function(event) {
      var detail = event.detail || {};
      track("reel_calculator_ready", reelDetailParameters(detail), {
        onceKey: location.pathname + "|" + (detail.reelId || "")
      });
    });

    document.addEventListener("reelcalc:calculation-completed", function(event) {
      var detail = event.detail || {};
      if (!detail.isUserInitiated) return;
      track("reel_calculation_completed", Object.assign(
        reelDetailParameters(detail),
        {
          calculator_mode: detail.mode || "",
          interaction_source: detail.interactionSource || "",
          unit_system: detail.unitSystem || "",
          main_line_yards: Number(detail.mainLineYards) || 0,
          main_line_diameter_mm: Number(detail.mainLineDiameterMm) || 0,
          backing_yards: Number(detail.backingYards) || 0,
          backing_diameter_mm: Number(detail.backingDiameterMm) || 0,
          starting_main_line_lb: Number(detail.startingMainLineLb) || 0,
          starting_backing_lb: Number(detail.startingBackingLb) || 0
        }
      ));
    });

    document.addEventListener("click", function(event) {
      var target = event.target && event.target.closest
        ? event.target.closest("a")
        : null;
      if (!target) return;

      if (target.classList.contains("reelcalc-affiliate-link")) {
        var affiliateMount = target.closest("[data-reelcalc-affiliates]");
        track("reel_affiliate_clicked", {
          page_type: "reel_guide",
          placement: "reel_page",
          reel_id: affiliateMount ? affiliateMount.dataset.reelId || "" : "",
          retailer: target.dataset.retailer || "",
          match_type: target.dataset.matchType || ""
        });
        return;
      }

      if (target.href && target.href.indexOf("reelcalc-wizard") >= 0) {
        var reelId = "";
        try {
          reelId = new URL(target.href, document.baseURI).searchParams.get("reel") || "";
        } catch (error) {
          reelId = "";
        }
        track("wizard_opened_from_reel_page", {
          page_type: "reel_guide",
          reel_id: reelId,
          link_placement: target.closest('[data-section="cta"]') ? "page_cta" : "content_link"
        });
      }
    });
  }

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
    document.addEventListener("DOMContentLoaded", function() {
      initializeAnalytics();
      initializeAffiliates();
    }, { once: true });
  } else {
    initializeAnalytics();
    initializeAffiliates();
  }

  loadAnalytics().then(function() {
    initializeAnalytics();
  });

  window.ReelCalcReelPageRuntime = {
    initialize: function() {
      initializeAnalytics();
      initializeAffiliates();
    }
  };
})();
