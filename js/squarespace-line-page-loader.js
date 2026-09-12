(function(global) {
  "use strict";
  if (global.ReelCalcSquarespaceLinePages) return;
  var active = new WeakMap();
  var renderer;

  function stylesheet(base) {
    if (document.querySelector("link[data-line-guide-host-css]")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("css/squarespace-line-page.css?v=2", base).href;
    link.dataset.lineGuideHostCss = "true";
    document.head.appendChild(link);
  }

  function loadRenderer(base) {
    if (global.ReelCalcLinePageLoader) return Promise.resolve(global.ReelCalcLinePageLoader);
    if (renderer) return renderer;
    renderer = new Promise(function(resolve, reject) {
      var script = document.createElement("script");
      var timeout = setTimeout(function() { finish(new Error("Line guide loader timed out.")); }, 20000);
      function finish(error) {
        clearTimeout(timeout);
        script.onload = script.onerror = null;
        if (error) { script.remove(); renderer = null; reject(error); }
        else resolve(global.ReelCalcLinePageLoader);
      }
      script.src = new URL("js/line-page-loader.js?v=2", base).href;
      script.onload = function() { finish(global.ReelCalcLinePageLoader ? null : new Error("Missing line guide loader.")); };
      script.onerror = function() { finish(new Error("Line guide loader unavailable.")); };
      document.head.appendChild(script);
    });
    return renderer;
  }

  function metadata(entry) {
    document.title = entry.seoTitle;
    function meta(attribute, name, value) {
      var found = document.querySelectorAll('meta[' + attribute + '="' + name + '"]');
      if (!found.length) {
        var node = document.createElement("meta");
        node.setAttribute(attribute, name); document.head.appendChild(node); found = [node];
      }
      found.forEach(function(node) { node.content = value; });
    }
    meta("name", "description", entry.seoDescription);
    meta("property", "og:type", "article");
    ["title", "description", "url", "image"].forEach(function(key) {
      var value = { title: entry.seoTitle, description: entry.seoDescription, url: entry.url, image: entry.image }[key];
      meta("property", "og:" + key, value);
      if (key !== "url") meta("name", "twitter:" + key, value);
    });
    meta("name", "twitter:card", "summary_large_image");
    var canonicals = document.querySelectorAll('link[rel="canonical"]');
    if (!canonicals.length) {
      var canonical = document.createElement("link"); canonical.rel = "canonical";
      document.head.appendChild(canonical); canonicals = [canonical];
    }
    canonicals.forEach(function(node) { node.href = entry.url; });
    document.querySelectorAll('meta[property^="product:"]').forEach(function(node) { node.remove(); });
    // Keep unrelated site schema while removing the imported guide's $0 product offer.
    function stripProduct(node) {
      if (Array.isArray(node)) return node.map(stripProduct).filter(Boolean);
      if (!node || typeof node !== "object") return node;
      if ([].concat(node["@type"] || []).includes("Product")) return null;
      if (node["@graph"]) node["@graph"] = stripProduct(node["@graph"]);
      return node;
    }
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function(script) {
      if (script.closest("[data-reelcalc-line-page]")) return;
      try {
        var value = stripProduct(JSON.parse(script.textContent));
        if (!value || (Array.isArray(value) && !value.length)) script.remove();
        else script.textContent = JSON.stringify(value);
      } catch (_) { /* Unrelated non-JSON blocks are left intact. */ }
    });
  }

  function initialize(options) {
    var base = new URL(options.base, document.baseURI).href;
    var pathname = location.pathname.replace(/\/+$/, "");
    if (pathname === "/lines") {
      document.body.classList.add("reelcalc-line-collection"); stylesheet(base); return Promise.resolve(true);
    }
    var detail = document.querySelector(".product-detail, .ProductItem");
    if (!detail || (!detail.classList.contains("tag-reelcalc-line-guide") && !/^\/lines\/p\/[^/]+$/.test(pathname))) return Promise.resolve(false);
    if (active.has(detail)) return active.get(detail);
    var descriptions = Array.from(detail.querySelectorAll(".product-description, .ProductItem-details-excerpt"));
    var host = descriptions[0];
    if (!host) return Promise.resolve(false);
    // A single description stays visible at every width; never create two live calculators.
    detail.classList.add("reelcalc-imported-line-guide"); stylesheet(base);
    host.id = "reelcalc-line-page-app"; host.dataset.lineGuideHost = "true";
    descriptions.slice(1).forEach(function(node) { node.dataset.lineGuideDuplicate = "true"; node.replaceChildren(); });
    var promise = (async function() {
      try {
        var controller = new AbortController();
        var timeout = setTimeout(function() { controller.abort(); }, 20000);
        var manifest;
        try {
          var response = await fetch(new URL("data/line-page-imports.json?t=" + Date.now(), base).href,
            { credentials: "omit", cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error("Line guide mapping unavailable.");
          manifest = await response.json();
        } finally { clearTimeout(timeout); }
        var slug = options.slug || decodeURIComponent(pathname.split("/").pop());
        var entry = manifest.pages[slug];
        if (!entry) throw new Error("No line guide matches this address.");
        metadata(entry);
        var api = await loadRenderer(base);
        var result = await api.mount({ base: base, product: entry.id, target: host.id });
        if (result) {
          var title = host.querySelector(".rc-product-title");
          if (title && title.tagName !== "H1") {
            var heading = document.createElement("h1");
            Array.from(title.attributes).forEach(function(attr) { heading.setAttribute(attr.name, attr.value); });
            heading.textContent = title.textContent;
            title.replaceWith(heading);
          }
          detail.querySelectorAll(".product-title, .ProductItem-details-title").forEach(function(node) {
            if (!host.contains(node)) node.remove();
          });
        }
        if (!result) active.delete(detail);
        return result;
      } catch (error) {
        active.delete(detail);
        var old = host.querySelector("[data-line-import-error]"); if (old) old.remove();
        var notice = document.createElement("div"); notice.dataset.lineImportError = "true"; notice.setAttribute("role", "alert");
        var text = document.createElement("p"); text.textContent = "The calculator could not load. The line guide and diameter chart remain available.";
        var button = document.createElement("button"); button.type = "button"; button.textContent = "Retry loading calculator";
        button.addEventListener("click", function() { notice.remove(); initialize(options); }, { once: true });
        notice.append(text, button); host.prepend(notice);
        console.warn("ReelCalc imported line guide:", error.message);
        return false;
      }
    })();
    active.set(detail, promise);
    return promise;
  }
  global.ReelCalcSquarespaceLinePages = { initialize: initialize };
})(window);
