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

  function initializeAnalyticsBridge() {
    if (document.documentElement.dataset.reelcalcAnalyticsBridge === "true") return;
    document.documentElement.dataset.reelcalcAnalyticsBridge = "true";
    var allowedEvents = new Set([
      "reelcalc_page_view",
      "wizard_viewed",
      "wizard_reel_selected",
      "wizard_line_selected",
      "wizard_technique_selected",
      "wizard_priority_selected",
      "wizard_recommendation_generated",
      "wizard_setup_selected",
      "wizard_calculation_completed",
      "wizard_backing_mode_selected",
      "wizard_backing_calculated",
      "wizard_manual_mode_changed",
      "wizard_mode_selected",
      "wizard_unit_changed",
      "wizard_reel_not_found",
      "reel_affiliate_clicked",
      "reel_line_selected",
      "reel_capacity_basis_selected",
      "reel_braid_capacity_fallback",
      "reel_calculator_mode_selected",
      "reel_recommended_setup_loaded",
      "reel_custom_line_changed",
      "line_affiliate_impression",
      "line_affiliate_clicked",
      "reelcalc_data_error"
    ]);
    var allowedParameters = new Set([
      "wizard_session_id", "page_type", "reel_preloaded", "placement",
      "reel_id", "reel_brand", "reel_model", "reel_size", "reel_size_class",
      "capacity_status", "retailer", "match_type", "selection_source",
      "manual_entry", "entry_type", "enabled", "wizard_mode", "fishing_use",
      "priority", "recommendation_count", "recommendation_rank",
      "recommendation_type", "top_recommendation_type", "top_line_type",
      "top_line_lb", "line_role", "line_id", "line_brand", "line_model",
      "line_type", "line_lb", "line_diameter_mm", "unit_system",
      "backing_used", "backing_mode", "desired_main_yards", "main_line_type",
      "main_line_lb", "backing_line_id", "backing_type", "backing_lb",
      "backing_diameter_mm", "data_area", "affiliate_context",
      "required_line_yards", "suggested_spool_yards", "selection_stage",
      "calculator_mode", "interaction_source", "capacity_basis", "fallback_used",
      "main_line_id", "main_line_brand", "main_line_model", "main_line_yards",
      "main_line_diameter_mm", "backing_line_brand", "backing_line_model",
      "backing_line_type", "backing_line_lb", "backing_yards",
      "custom_main_line", "custom_backing_line"
    ]);

    window.addEventListener("message", function(event) {
      if (event.origin !== "https://stefanellit.github.io") return;
      var data = event.data;
      if (!data || data.source !== "reelcalc-analytics" || !allowedEvents.has(data.name)) return;
      var parameters = {};
      Object.keys(data.parameters || {}).forEach(function(key) {
        if (allowedParameters.has(key)) parameters[key] = data.parameters[key];
      });
      if (window.ReelCalcAnalytics && typeof window.ReelCalcAnalytics.track === "function") {
        window.ReelCalcAnalytics.track(data.name, parameters);
      } else {
        window.ReelCalcAnalyticsQueue = window.ReelCalcAnalyticsQueue || [];
        window.ReelCalcAnalyticsQueue.push({
          name: data.name,
          parameters: parameters,
          options: {}
        });
      }
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
      if (paragraphs[1]) {
        paragraphs[1].classList.add("reelcalc-page-summary");
        if (entry.intro) paragraphs[1].textContent = entry.intro;
      }
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

  function setMeta(attribute, key, content) {
    if (!content) return;
    var selector = `meta[${attribute}="${key}"]`;
    var elements = Array.from(document.querySelectorAll(selector));
    if (!elements.length) {
      var meta = document.createElement("meta");
      meta.setAttribute(attribute, key);
      document.head.appendChild(meta);
      elements.push(meta);
    }
    elements.forEach(function(meta) {
      meta.content = content;
    });
  }

  function setCanonical(canonicalUrl) {
    var links = Array.from(document.querySelectorAll('link[rel="canonical"]'));
    if (!links.length) {
      var link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
      links.push(link);
    }
    links.forEach(function(link) {
      link.href = canonicalUrl;
    });
  }

  function removeSquarespaceProductMetadata() {
    document.querySelectorAll('meta[property^="product:"], meta[name^="product:"]').forEach(function(meta) {
      meta.remove();
    });
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function(script) {
      try {
        var value = JSON.parse(script.textContent);
        var nodes = Array.isArray(value) ? value : [value];
        var hasProduct = nodes.some(function(node) {
          if (!node || typeof node !== "object") return false;
          if (node["@type"] === "Product") return true;
          return Array.isArray(node["@graph"]) && node["@graph"].some(function(child) {
            return child && child["@type"] === "Product";
          });
        });
        if (hasProduct) script.remove();
      } catch (error) {
        // Leave unrelated structured data alone if Squarespace uses a non-JSON block.
      }
    });
  }

  function setStructuredData(id, value) {
    var current = document.getElementById(id);
    if (!current) {
      current = document.createElement("script");
      current.id = id;
      current.type = "application/ld+json";
      document.head.appendChild(current);
    }
    current.textContent = JSON.stringify(value);
  }

  function applyGuideStructuredData(entry, canonicalUrl) {
    removeSquarespaceProductMetadata();
    var breadcrumbs = [
      {
        "@type": "ListItem",
        position: 1,
        name: "ReelCalc",
        item: "https://www.reelcalc.com/"
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Fishing Line Setup Guides",
        item: "https://www.reelcalc.com/fishing-line-setup-guides"
      },
      {
        "@type": "ListItem",
        position: 3,
        name: entry.pageTitle,
        item: canonicalUrl
      }
    ];
    var article = {
      "@type": "Article",
      "@id": `${canonicalUrl}#article`,
      headline: entry.pageTitle,
      description: entry.metaDescription,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl
      },
      author: {
        "@type": "Organization",
        name: "ReelCalc",
        url: "https://www.reelcalc.com/"
      },
      publisher: {
        "@type": "Organization",
        name: "ReelCalc",
        url: "https://www.reelcalc.com/"
      }
    };
    if (entry.imageUrl) article.image = [entry.imageUrl];
    setStructuredData("reelcalc-guide-structured-data", {
      "@context": "https://schema.org",
      "@graph": [
        article,
        {
          "@type": "BreadcrumbList",
          "@id": `${canonicalUrl}#breadcrumbs`,
          itemListElement: breadcrumbs
        }
      ]
    });
  }

  function applyPageMetadata(entry) {
    var canonicalUrl = new URL(entry.canonicalPath, "https://www.reelcalc.com").href;
    if (entry.seoTitle) document.title = entry.seoTitle;
    setMeta("name", "description", entry.metaDescription);
    setMeta("property", "og:type", "article");
    setMeta("property", "og:title", entry.seoTitle || entry.pageTitle);
    setMeta("property", "og:description", entry.metaDescription);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", entry.imageUrl);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", entry.seoTitle || entry.pageTitle);
    setMeta("name", "twitter:description", entry.metaDescription);
    setMeta("name", "twitter:image", entry.imageUrl);
    setCanonical(canonicalUrl);
    applyGuideStructuredData(entry, canonicalUrl);
  }

  function initializeCollectionPage() {
    var path = location.pathname.replace(/\/+$/, "") || "/";
    if (path !== "/reel-pages") return false;

    document.body.classList.add("reelcalc-reel-collection");
    loadStylesheet();
    var collectionTitle = "Fishing Reel Line Capacity & Setup Guides | ReelCalc";
    var collectionDescription = "Browse verified fishing reel line capacities, recommended braid and mono sizes, backing guidance, and pre-loaded ReelCalc calculators for hundreds of reels.";
    var collectionUrl = "https://www.reelcalc.com/reel-pages";
    document.title = collectionTitle;
    setMeta("name", "description", collectionDescription);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", collectionTitle);
    setMeta("property", "og:description", collectionDescription);
    setMeta("property", "og:url", collectionUrl);
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", collectionTitle);
    setMeta("name", "twitter:description", collectionDescription);
    setCanonical(collectionUrl);
    setStructuredData("reelcalc-collection-structured-data", {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: collectionTitle.replace(" | ReelCalc", ""),
      description: collectionDescription,
      url: collectionUrl,
      isPartOf: {
        "@type": "WebSite",
        name: "ReelCalc",
        url: "https://www.reelcalc.com/"
      }
    });

    var heading = document.querySelector("main h1");
    if (heading) heading.textContent = "Fishing Reel Line Capacity & Setup Guides";

    var paragraphs = Array.from(document.querySelectorAll("main p"));
    var introduction = paragraphs.find(function(paragraph) {
      return paragraph.textContent.trim().indexOf("Discover the latest additions") === 0;
    });
    if (introduction) {
      introduction.classList.add("reelcalc-collection-introduction");
      introduction.textContent = "Choose your exact reel to see its published capacity, recommended line setup, backing guidance, and pre-loaded ReelCalc calculator.";
      var directoryLink = document.createElement("a");
      directoryLink.className = "reelcalc-collection-directory-link";
      directoryLink.href = "/fishing-line-setup-guides";
      directoryLink.textContent = "Browse the organized guide directory";
      introduction.insertAdjacentElement("afterend", directoryLink);
    }

    return true;
  }

  function initialize() {
    initializeAnalyticsBridge();
    loadScript("js/analytics.js", "ReelCalcAnalytics").then(function(analytics) {
      if (analytics && analytics.instrumentLineDatabase) {
        analytics.instrumentLineDatabase();
      }
    }).catch(function() {
      // Analytics is optional and must never block page content.
    });

    if (initializeCollectionPage()) return;

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

        applyPageMetadata(entry);

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

  initializeAnalyticsBridge();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
