(function() {
  "use strict";

  var loaderScript = document.currentScript;
  if (!loaderScript || !loaderScript.src) return;

  var scriptUrl = new URL(loaderScript.src, document.baseURI);
  var assetBase = loaderScript.dataset.assetBase
    ? new URL(loaderScript.dataset.assetBase, document.baseURI)
    : new URL("../", scriptUrl);
  var guideTags = ["tag-reelcalc-reel-guide", "tag-reelcalc-import-test"];

  function assetUrl(relativePath) {
    return new URL(relativePath, assetBase).href;
  }

  function loadStylesheet() {
    var href = assetUrl("css/reel-page.css");
    if (document.querySelector('link[data-reelcalc-reel-page-css]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.reelcalcReelPageCss = "true";
    document.head.appendChild(link);
  }

  function loadScript(relativePath, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    var src = assetUrl(relativePath);
    var existing = Array.from(document.scripts).find(function(script) {
      return script.src === src;
    });
    if (existing) {
      return new Promise(function(resolve, reject) {
        existing.addEventListener("load", function() {
          resolve(globalName ? window[globalName] : true);
        }, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }

    return new Promise(function(resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.dataset.assetBase = assetBase.href;
      script.onload = function() {
        resolve(globalName ? window[globalName] : true);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function sectionKey(content, index) {
    if (index === 0) return "introduction";
    var heading = content.querySelector("h2");
    var text = heading ? heading.textContent.trim().toLowerCase() : "";
    if (text.indexOf("quick answer:") === 0) return "quick-answer";
    if (text.indexOf("who is the") === 0) return "who-is-this-reel-for";
    if (text.indexOf("use the pre-loaded") === 0) return "calculator";
    if (text.indexOf("best line setup") === 0) return "best-line-setup";
    if (text.indexOf("line capacity") >= 0) return "line-capacity";
    if (/ specs$/.test(text)) return "specifications";
    if (/ faqs$/.test(text)) return "faqs";
    if (text.indexOf("related reel pages") === 0) return "related-resources";
    if (text.indexOf("build your") === 0) return "cta";
    return "content";
  }

  function emptyDivIn(content) {
    return Array.from(content.children).find(function(child) {
      return child.tagName === "DIV" &&
        !child.textContent.trim() &&
        !child.querySelector("img, table, a, input, button");
    }) || null;
  }

  function decorateDescription(description, entry) {
    if (description.dataset.reelcalcEnhanced === "true") return;
    description.dataset.reelcalcEnhanced = "true";
    description.dataset.reelId = entry.reelId;
    description.classList.add("reelcalc-reel-page");

    var rawSections = Array.from(description.children).filter(function(child) {
      return child.tagName === "DIV";
    });

    rawSections.forEach(function(content, index) {
      var key = sectionKey(content, index);
      var section = document.createElement("section");
      section.className = "reelcalc-page-section";
      section.dataset.section = key;
      description.insertBefore(section, content);
      section.appendChild(content);
      content.classList.add("reelcalc-page-content");
      if (["quick-answer", "who-is-this-reel-for", "faqs"].includes(key)) {
        content.classList.add("reelcalc-page-content--narrow");
      }

      content.querySelectorAll("table").forEach(function(table) {
        if (table.parentElement) table.parentElement.classList.add("reelcalc-table-wrap");
      });
      content.querySelectorAll("ul").forEach(function(list) {
        list.classList.add("reelcalc-link-list");
      });

      if (key === "quick-answer") {
        var answer = content.querySelector("h2 + div");
        if (answer) answer.classList.add("reelcalc-page-quick-answer");
      }
      if (key === "calculator") {
        var calculator = emptyDivIn(content);
        if (calculator) {
          calculator.dataset.reelcalcCalculator = "true";
          calculator.dataset.reelId = entry.reelId;
          calculator.dataset.mainLineLb = entry.calculator.mainLineLb;
          calculator.dataset.mainLineYards = entry.calculator.mainLineYards;
          calculator.dataset.mainLineDiameterIn = entry.calculator.mainLineDiameterIn;
          calculator.dataset.backingLb = entry.calculator.backingLb;
          calculator.dataset.backingDiameterIn = entry.calculator.backingDiameterIn;
        }
      }
      if (key === "best-line-setup" || key === "specifications") {
        var affiliate = emptyDivIn(content);
        if (affiliate) {
          affiliate.classList.add("reelcalc-affiliate-area");
          affiliate.dataset.reelcalcAffiliates = "true";
          affiliate.dataset.affiliateKind = key === "specifications" ? "reel" : "line";
          affiliate.dataset.reelId = entry.reelId;
          affiliate.hidden = true;
        }
      }
      if (key === "specifications") {
        Array.from(content.querySelectorAll("p")).forEach(function(paragraph) {
          if (paragraph.textContent.trim().indexOf("Specifications checked against") === 0) {
            paragraph.classList.add("reelcalc-source-note");
          }
        });
      }
      if (key === "cta") {
        content.classList.add("reelcalc-page-cta");
        var button = content.querySelector('a[href*="reelcalc-wizard"]');
        if (button) button.classList.add("reelcalc-page-button");
      }
    });

    var image = description.querySelector("img");
    if (image) image.classList.add("reelcalc-product-image");
    var firstContent = description.querySelector('[data-section="introduction"] .reelcalc-page-content');
    if (firstContent) {
      var paragraphs = firstContent.querySelectorAll("p");
      if (paragraphs[0]) paragraphs[0].classList.add("reelcalc-page-kicker");
      if (paragraphs[1]) paragraphs[1].classList.add("reelcalc-page-summary");
    }
  }

  function showLoadError(detail, message) {
    var descriptions = detail.querySelectorAll(".product-description");
    descriptions.forEach(function(description) {
      var box = document.createElement("div");
      box.className = "reelcalc-page-status";
      box.textContent = message;
      description.prepend(box);
    });
  }

  function initialize() {
    var detail = document.querySelector(".product-detail");
    if (!detail || !guideTags.some(function(tag) { return detail.classList.contains(tag); })) return;

    detail.classList.add("reelcalc-imported-guide");
    loadStylesheet();

    var slug = loaderScript.dataset.pageSlug ||
      decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
    fetch(assetUrl("data/reel-page-embeds.json"), { credentials: "omit" })
      .then(function(response) {
        if (!response.ok) throw new Error("Reel page mapping returned HTTP " + response.status + ".");
        return response.json();
      })
      .then(function(manifest) {
        var canonicalSlug = manifest.aliases && manifest.aliases[slug]
          ? manifest.aliases[slug]
          : slug;
        var entry = manifest.pages && manifest.pages[canonicalSlug];
        if (!entry) throw new Error("No verified ReelCalc page mapping exists for this URL.");

        detail.querySelectorAll(".product-description").forEach(function(description) {
          decorateDescription(description, entry);
        });

        return Promise.all([
          loadScript("js/reel-page-calculator.js", "ReelCalcReelPageCalculator"),
          loadScript("js/reel-page-runtime.js", "ReelCalcReelPageRuntime")
        ]).then(function(services) {
          if (services[0] && services[0].initialize) services[0].initialize();
          if (services[1] && services[1].initialize) services[1].initialize();
        });
      })
      .catch(function(error) {
        showLoadError(detail, "This ReelCalc guide could not finish loading. " + error.message);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
