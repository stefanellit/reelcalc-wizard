(function() {
  "use strict";

  var loaderScript = document.currentScript;
  if (!loaderScript || !loaderScript.src) return;

  var scriptUrl = new URL(loaderScript.src, document.baseURI);
  var assetBase = loaderScript.dataset.assetBase
    ? new URL(loaderScript.dataset.assetBase, document.baseURI)
    : new URL("../", scriptUrl);
  var analyticsPromise = null;
  var affiliateDataPromise = null;
  var lineDataPromise = null;

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

  function testParameters(page) {
    return {
      page_type: "real_world_reel_test",
      test_id: page.dataset.testId || "",
      reel_id: page.dataset.reelId || "",
      test_number: Number(page.dataset.testNumber) || 0
    };
  }

  function loadJson(path) {
    return fetch(new URL(path, assetBase).href, { credentials: "omit" }).then(function(response) {
      if (!response.ok) throw new Error(path + " returned HTTP " + response.status + ".");
      return response.json();
    });
  }

  function loadAffiliateData() {
    if (!affiliateDataPromise) affiliateDataPromise = loadJson("data/reel-affiliates.json");
    return affiliateDataPromise;
  }

  function loadLineData() {
    if (!lineDataPromise) lineDataPromise = loadJson("data/lines.json");
    return lineDataPromise;
  }

  function imageUrl(page, file) {
    var base = page.dataset.imageBase || "assets/real-world-tests/";
    return new URL(file, new URL(base, assetBase)).href;
  }

  function loadPhoto(figure, page) {
    var file = figure.dataset.testImage;
    var media = figure.querySelector(".rc-test-photo-media");
    if (!file || !media) return;

    function requestImage() {
      if (figure.dataset.imageRequested === "true") return;
      figure.dataset.imageRequested = "true";

      var image = new Image();
      image.alt = figure.dataset.alt || "";
      image.decoding = "async";
      image.width = Number(figure.dataset.width) || 1200;
      image.height = Number(figure.dataset.height) || 900;

      image.addEventListener("load", function() {
        media.replaceChildren(image);
        figure.dataset.imageStatus = "loaded";
      }, { once: true });

      image.addEventListener("error", function() {
        figure.dataset.imageStatus = "missing";
      }, { once: true });

      image.src = imageUrl(page, file);
    }

    if (figure.dataset.eager === "true" || !("IntersectionObserver" in window)) {
      requestImage();
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      if (!entries.some(function(entry) { return entry.isIntersecting; })) return;
      observer.disconnect();
      requestImage();
    }, { rootMargin: "400px 0px" });

    observer.observe(figure);
  }

  function initializePage(page) {
    page.querySelectorAll("[data-test-image]").forEach(function(figure) {
      loadPhoto(figure, page);
    });

    track("real_world_test_view", testParameters(page), {
      onceKey: [location.pathname, page.dataset.testId || ""].join("|")
    });
  }

  function renderLineAffiliate(mount, affiliateData, lines) {
    var lineId = mount.dataset.lineId || "";
    var line = Array.isArray(lines)
      ? lines.find(function(entry) { return entry && entry.id === lineId; })
      : null;
    var builder = window.ReelCalcAffiliateLinks && window.ReelCalcAffiliateLinks.buildRecommendedLineOffer;
    var offer = line && typeof builder === "function"
      ? builder({
          affiliateData: affiliateData,
          line: line,
          requiredYards: Number(mount.dataset.requiredYards),
          spoolYards: Number(mount.dataset.spoolYards)
        })
      : null;

    if (!offer) {
      mount.hidden = true;
      mount.replaceChildren();
      return;
    }

    var heading = document.createElement("h3");
    heading.textContent = "Check the Line Used in This Test";
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
    link.dataset.lineId = lineId;
    link.dataset.requiredYards = String(offer.requiredYards);
    link.dataset.spoolYards = String(offer.suggestedSpoolYards);
    link.dataset.linkPlacement = "test_equipment";
    links.appendChild(link);
    mount.replaceChildren(heading, disclosure, links);
    mount.hidden = false;
  }

  function initializeLineAffiliates() {
    var mounts = Array.from(document.querySelectorAll("[data-real-world-line-affiliate]"));
    if (!mounts.length) return;
    mounts.forEach(function(mount) { mount.hidden = true; });

    Promise.all([loadAffiliateData(), loadLineData()]).then(function(results) {
      mounts.forEach(function(mount) {
        renderLineAffiliate(mount, results[0], results[1]);
      });
    }).catch(function() {
      mounts.forEach(function(mount) {
        mount.hidden = true;
        mount.replaceChildren();
      });
    });
  }

  function eventParameters(page, link) {
    var output = testParameters(page);
    output.link_placement = link.dataset.linkPlacement || "content";
    output.product_role = link.dataset.productRole || "";
    return output;
  }

  function initializeClicks() {
    document.addEventListener("click", function(event) {
      var link = event.target && event.target.closest
        ? event.target.closest("a")
        : null;
      if (!link) return;

      var page = link.closest(".reelcalc-real-world-test");
      if (!page) return;

      var eventName = link.dataset.rcTestEvent || "";
      if (!eventName && link.classList.contains("reelcalc-affiliate-link")) {
        var affiliateArea = link.closest("[data-product-role]");
        var role = affiliateArea ? affiliateArea.dataset.productRole || "" : "";
        var eventsByRole = {
          reel: "real_world_test_reel_affiliate_click",
          line: "real_world_test_line_affiliate_click",
          backing: "real_world_test_backing_affiliate_click",
          tool: "real_world_test_tool_affiliate_click"
        };
        eventName = eventsByRole[role] || "";
        link.dataset.productRole = role;
      }

      if (!eventName) return;
      track(eventName, eventParameters(page, link));
    });
  }

  function initialize() {
    document.querySelectorAll(".reelcalc-real-world-test[data-test-id]").forEach(initializePage);
    initializeLineAffiliates();
    initializeClicks();
    loadAnalytics().then(function() {
      document.querySelectorAll(".reelcalc-real-world-test[data-test-id]").forEach(function(page) {
        track("real_world_test_view", testParameters(page), {
          onceKey: [location.pathname, page.dataset.testId || ""].join("|")
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
