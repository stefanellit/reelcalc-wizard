(function() {
  "use strict";

  var loaderScript = document.currentScript;
  var scriptUrl = new URL(loaderScript.src, document.baseURI);
  var assetBase = loaderScript.dataset.assetBase
    ? new URL(loaderScript.dataset.assetBase, document.baseURI)
    : new URL("../", scriptUrl);
  var affiliateDataPromise = null;

  function isValidUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
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

  function affiliateItems(mapping, kind) {
    if (!mapping || typeof mapping !== "object") return [];
    var reelItems = [
      { key: "reelAffiliateUrl", label: mapping.reelLabel || "Check Current Reel Price on Amazon" }
    ];
    var lineItems = [
      { key: "braidAffiliateUrl", label: mapping.braidLabel || "View Matching Braid on Amazon" },
      { key: "monoAffiliateUrl", label: mapping.monoLabel || "View Matching Monofilament on Amazon" },
      { key: "fluoroAffiliateUrl", label: mapping.fluoroLabel || "View Matching Fluorocarbon on Amazon" }
    ];
    var items = kind === "reel" ? reelItems : lineItems;
    return items.filter(function(item) {
      return isValidUrl(mapping[item.key]);
    }).map(function(item) {
      return {
        label: item.label,
        url: mapping[item.key]
      };
    });
  }

  function renderAffiliateArea(mount, mapping) {
    var kind = mount.dataset.affiliateKind === "reel" ? "reel" : "line";
    var items = affiliateItems(mapping, kind);
    if (!items.length) {
      mount.hidden = true;
      mount.replaceChildren();
      return;
    }

    var heading = document.createElement("h3");
    heading.textContent = kind === "reel" ? "Check Current Reel Price" : "Lines That Match This Setup";
    var disclosure = document.createElement("p");
    disclosure.className = "reelcalc-affiliate-disclosure";
    disclosure.textContent = "ReelCalc may earn a commission from purchases made through these links, at no extra cost to you. As an Amazon Associate I earn from qualifying purchases.";
    var links = document.createElement("div");
    links.className = "reelcalc-affiliate-links";

    items.forEach(function(item) {
      var link = document.createElement("a");
      link.className = "reelcalc-affiliate-link";
      link.href = item.url;
      link.target = "_blank";
      link.rel = "sponsored nofollow noopener";
      link.textContent = item.label;
      links.appendChild(link);
    });

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
      var reelMappings = data && data.reels ? data.reels : {};
      mounts.forEach(function(mount) {
        renderAffiliateArea(mount, reelMappings[mount.dataset.reelId]);
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
})();
