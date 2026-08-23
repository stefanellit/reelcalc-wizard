(function () {
  "use strict";

  var DEFAULT_ASSET_BASE = "https://stefanellit.github.io/reelcalc-wizard";
  var BRAND_ORDER = [
    "Shimano",
    "Daiwa",
    "PENN",
    "Pflueger",
    "Abu Garcia",
    "Lew's",
    "Okuma",
    "KastKing",
    "Quantum",
    "Bass Pro Shops",
    "Offshore Angler"
  ];

  function normalizePath(value) {
    var input = String(value || "").trim();
    if (!input) return "";
    try {
      var parsed = new URL(input, "https://www.reelcalc.com");
      var path = parsed.pathname.replace(/\/+$/, "");
      return path || "/";
    } catch (error) {
      var fallback = input.split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/i, "");
      fallback = (fallback.charAt(0) === "/" ? fallback : "/" + fallback).replace(/\/+$/, "");
      return fallback || "/";
    }
  }

  function decodeXml(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function parseSitemapPaths(xmlText) {
    var paths = new Set();
    var pattern = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
    var match;
    while ((match = pattern.exec(String(xmlText || ""))) !== null) {
      var path = normalizePath(decodeXml(match[1]));
      if (path) paths.add(path);
    }
    return paths;
  }

  function reelLabel(reel) {
    var size = reel.size_label || reel.size_class || "";
    return [reel.brand, reel.model, size].filter(Boolean).join(" ").trim();
  }

  function reelCategory(reel) {
    return /baitcast|casting/.test(String(reel && reel.reel_type || "").toLowerCase())
      ? "baitcasting"
      : "spinning";
  }

  function disambiguateLabels(entries) {
    var labels = new Map();

    entries.forEach(function (entry) {
      var key = String(entry.label || "").trim().toLowerCase();
      if (!labels.has(key)) labels.set(key, []);
      labels.get(key).push(entry);
    });

    labels.forEach(function (matches) {
      if (matches.length < 2) return;
      matches.forEach(function (entry) {
        var detail = entry.sku || entry.reelId || "";
        if (detail && !String(entry.label).toLowerCase().includes(String(detail).toLowerCase())) {
          entry.label += " (" + detail + ")";
        }
      });
    });

    return entries;
  }

  function buildRegistryEntries(registry, reels) {
    var reelsById = new Map((Array.isArray(reels) ? reels : []).map(function (reel) {
      return [reel.id, reel];
    }));

    var entries = (Array.isArray(registry && registry.pages) ? registry.pages : []).map(function (page) {
      var reel = reelsById.get(page.reelId);
      var path = normalizePath(page.path);
      if (!reel || !path) return null;
      return {
        brand: reel.brand,
        category: reelCategory(reel),
        family: page.family || "",
        label: page.guideLabel || reelLabel(reel),
        sku: reel.sku || "",
        path: path,
        reelId: reel.id,
        verifiedLive: page.verifiedLive === true,
        registry: true,
        legacy: false
      };
    }).filter(Boolean);

    return disambiguateLabels(entries);
  }

  function mergeEntries(legacyData, registry, reels, publishedPaths, includeUnpublished) {
    var entriesByPath = new Map();
    var legacyPages = registry && registry.replaceLegacy === true
      ? []
      : (Array.isArray(legacyData && legacyData.pages) ? legacyData.pages : []);

    legacyPages.forEach(function (page) {
      var path = normalizePath(page.path);
      if (!path) return;
      entriesByPath.set(path, {
        brand: page.brand,
        category: page.category || "spinning",
        family: page.family || "",
        label: page.label,
        path: path,
        reelId: page.reelId || "",
        registry: false,
        legacy: true
      });
    });

    buildRegistryEntries(registry, reels).forEach(function (entry) {
      var existing = entriesByPath.get(entry.path);
      entriesByPath.set(entry.path, Object.assign({}, existing || {}, entry, {
        legacy: Boolean(existing && existing.legacy)
      }));
    });

    var published = publishedPaths instanceof Set ? publishedPaths : new Set();
    return Array.from(entriesByPath.values()).filter(function (entry) {
      return entry.legacy || entry.verifiedLive || includeUnpublished || published.has(entry.path);
    });
  }

  function groupEntries(entries) {
    var groups = new Map();
    entries.forEach(function (entry) {
      var brand = entry.brand || "Other";
      if (!groups.has(brand)) groups.set(brand, []);
      groups.get(brand).push(entry);
    });

    groups.forEach(function (items) {
      items.sort(function (a, b) {
        return String(a.label).localeCompare(String(b.label), undefined, {
          numeric: true,
          sensitivity: "base"
        });
      });
    });

    return Array.from(groups.entries()).sort(function (a, b) {
      var aIndex = BRAND_ORDER.indexOf(a[0]);
      var bIndex = BRAND_ORDER.indexOf(b[0]);
      if (aIndex < 0) aIndex = BRAND_ORDER.length;
      if (bIndex < 0) bIndex = BRAND_ORDER.length;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a[0].localeCompare(b[0]);
    });
  }

  function assetBaseForScript() {
    if (typeof document === "undefined") return DEFAULT_ASSET_BASE;
    var script = document.currentScript;
    if (!script || !script.src) {
      script = Array.from(document.scripts || []).find(function (item) {
        return /\/js\/reel-guide-list\.js(?:[?#]|$)/.test(item.src || "");
      });
    }
    if (!script || !script.src) return DEFAULT_ASSET_BASE;
    try {
      return new URL("../", script.src).href.replace(/\/+$/, "");
    } catch (error) {
      return DEFAULT_ASSET_BASE;
    }
  }

  function setStatus(mount, message, state) {
    mount.replaceChildren();
    mount.dataset.state = state;
    var status = document.createElement("p");
    status.className = "reelcalc-guide-status";
    status.textContent = message;
    mount.appendChild(status);
  }

  function renderDirectory(mount, entries) {
    mount.replaceChildren();
    mount.dataset.state = "ready";
    mount.setAttribute("aria-live", "polite");

    [
      { key: "spinning", label: "Spinning Reel Guides" },
      { key: "baitcasting", label: "Baitcaster Reel Guides" }
    ].forEach(function (category) {
      var categoryEntries = entries.filter(function (entry) {
        return (entry.category || "spinning") === category.key;
      });
      if (!categoryEntries.length) return;

      var categorySection = document.createElement("section");
      categorySection.className = "reelcalc-guide-category reelcalc-guide-category--" + category.key;
      categorySection.dataset.reelCategory = category.key;

      var categoryHeading = document.createElement("h2");
      categoryHeading.className = "reelcalc-guide-category-heading";
      categoryHeading.textContent = category.label;
      categorySection.appendChild(categoryHeading);

      var directory = document.createElement("div");
      directory.className = "reelcalc-guide-directory";

      groupEntries(categoryEntries).forEach(function (group) {
        var brand = group[0];
        var items = group[1];
        var section = document.createElement("section");
        section.className = "reelcalc-guide-brand";

        var heading = document.createElement("h3");
        heading.textContent = brand + " Reel Line Capacity Guides";
        section.appendChild(heading);

        var list = document.createElement("ul");
        items.forEach(function (entry) {
          var item = document.createElement("li");
          var link = document.createElement("a");
          link.href = entry.path;
          link.textContent = entry.label;
          if (entry.reelId) link.dataset.reelId = entry.reelId;
          item.appendChild(link);
          list.appendChild(item);
        });
        section.appendChild(list);
        directory.appendChild(section);
      });

      categorySection.appendChild(directory);
      mount.appendChild(categorySection);
    });
  }

  async function fetchJson(url) {
    var response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error("Could not load " + url);
    return response.json();
  }

  async function fetchPublishedPaths(url) {
    var response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error("Could not load the ReelCalc sitemap");
    var text = await response.text();
    if (!/<(?:urlset|sitemapindex)\b/i.test(text)) {
      throw new Error("The sitemap response was not XML");
    }
    return parseSitemapPaths(text);
  }

  async function loadDirectory(mounts) {
    var assetBase = assetBaseForScript();
    var sitemapUrl = new URL("/sitemap.xml", window.location.origin).href;
    mounts.forEach(function (mount) {
      setStatus(mount, "Loading reel guides...", "loading");
    });

    try {
      var data = await Promise.all([
        fetchJson(assetBase + "/data/reel-guide-legacy.json"),
        fetchJson(assetBase + "/data/reel-pages.json"),
        fetchJson(assetBase + "/data/reels.json")
      ]);
      var publishedPaths = new Set();
      try {
        publishedPaths = await fetchPublishedPaths(sitemapUrl);
      } catch (sitemapError) {
        publishedPaths = new Set();
      }

      mounts.forEach(function (mount) {
        var includeUnpublished = mount.dataset.includeUnpublished === "true";
        var entries = mergeEntries(data[0], data[1], data[2], publishedPaths, includeUnpublished);
        if (!entries.length) {
          setStatus(mount, "The reel guide list is temporarily unavailable.", "error");
          return;
        }
        renderDirectory(mount, entries);
      });
    } catch (error) {
      mounts.forEach(function (mount) {
        setStatus(mount, "The reel guide list is temporarily unavailable. Please use the Reel Setup Wizard.", "error");
      });
    }
  }

  function start() {
    var mounts = Array.from(document.querySelectorAll("[data-reelcalc-guide-list]"));
    if (!mounts.length) return;
    loadDirectory(mounts);
  }

  var api = {
    normalizePath: normalizePath,
    parseSitemapPaths: parseSitemapPaths,
    reelLabel: reelLabel,
    reelCategory: reelCategory,
    disambiguateLabels: disambiguateLabels,
    buildRegistryEntries: buildRegistryEntries,
    mergeEntries: mergeEntries,
    groupEntries: groupEntries,
    renderDirectory: renderDirectory,
    start: start
  };

  if (typeof window !== "undefined") window.ReelCalcGuideList = api;
  if (typeof document === "undefined") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
