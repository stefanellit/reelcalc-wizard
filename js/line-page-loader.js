(function(global) {
  "use strict";
  var script = document.currentScript;
  if (!global.ReelCalcLinePageLoader) {
    var mounts = new WeakMap();
    var assets = new Map();

    async function request(url, json, fresh) {
      var target = new URL(url);
      if (fresh) target.searchParams.set("t", Date.now());
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 20000);
      try {
        var response = await fetch(target.href, { credentials: "omit", cache: fresh ? "no-store" : "default", signal: controller.signal });
        if (!response.ok) throw new Error("Line page file returned " + response.status);
        return await (json ? response.json() : response.text());
      } finally { clearTimeout(timeout); }
    }

    function asset(url, css, api) {
      if (api && global[api]) return Promise.resolve(global[api]);
      if (assets.has(url)) return assets.get(url);
      var promise = new Promise(function(resolve, reject) {
        var node = document.createElement(css ? "link" : "script");
        var timeout;
        function finish(error) {
          clearTimeout(timeout);
          node.onload = node.onerror = null;
          if (error) { node.remove(); assets.delete(url); reject(error); }
          else resolve(api ? global[api] : true);
        }
        node.onload = function() { finish(api && !global[api] ? new Error("Line page script did not initialize.") : null); };
        node.onerror = function() { finish(new Error("A line page asset could not load.")); };
        if (css) { node.rel = "stylesheet"; node.href = url; }
        else { node.src = url; node.async = true; }
        timeout = setTimeout(function() { finish(new Error("A line page asset timed out.")); }, 20000);
        document.head.appendChild(node);
      });
      assets.set(url, promise);
      return promise;
    }

    function mount(options) {
      var host = document.getElementById(options.target || "reelcalc-line-page-app");
      if (!host) return Promise.resolve(false);
      if (mounts.has(host)) return mounts.get(host);
      var base = new URL(options.base, document.baseURI).href;
      host.style.minWidth = "0";
      host.style.maxWidth = "100%";
      host.setAttribute("aria-busy", "true");
      var promise = (async function() {
        var root;
        try {
          var other = document.querySelector("[data-reelcalc-line-page]");
          if (other && !host.contains(other)) throw new Error("Use one line guide per page.");
          var release = await request(new URL("data/line-page-release.json", base), true, true);
          if (!release || !/^[a-zA-Z0-9._-]+$/.test(release.version) ||
              !Array.isArray(release.products) || !release.products.includes(options.product)) throw new Error("Unknown line page release.");
          function versioned(path) {
            var url = new URL(path, base);
            url.searchParams.set("v", release.version);
            return url.href;
          }
          var html = await request(versioned("components/line-pages/" + options.product + ".html"), false, false);
          var template = document.createElement("template");
          template.innerHTML = html;
          root = template.content.firstElementChild;
          if (!root || !root.matches("article[data-reelcalc-line-page]") ||
              root.dataset.productId !== options.product || template.content.children.length !== 1 ||
              root.querySelector("script:not([type='application/ld+json'])")) throw new Error("Invalid line guide component.");
          root.dataset.assetBase = base;
          root.querySelectorAll("[data-line-page-image]").forEach(function(img) {
            img.src = new URL(img.dataset.linePageImage, base).href;
          });
          await asset(versioned("css/line-page-embed.css"), true);
          host.replaceChildren(root);
          await asset(versioned("js/calculator-core.js"), false, "ReelCalcCore");
          await asset(versioned("js/affiliate-links.js"), false, "ReelCalcAffiliateLinks");
          // Analytics is optional. Blocking it must not block the guide or calculator.
          asset(versioned("js/analytics.js"), false, "ReelCalcAnalytics").catch(function() {});
          var renderer = await asset(versioned("js/line-page-engine.js"), false, "ReelCalcLinePages");
          var success = await renderer.mount(root);
          host.setAttribute("aria-busy", "false");
          return success;
        } catch (error) {
          mounts.delete(host);
          host.setAttribute("aria-busy", "false");
          var previous = host.querySelector("[data-line-page-error]");
          if (previous) previous.remove();
          var message = document.createElement("div");
          message.dataset.linePageError = "true";
          message.setAttribute("role", "alert");
          var text = document.createElement("p");
          text.textContent = "The line guide could not finish loading. Please try again.";
          var retry = document.createElement("button");
          retry.type = "button";
          retry.textContent = "Retry loading line guide";
          retry.addEventListener("click", function() { mount(options); }, { once: true });
          message.append(text, retry);
          host.prepend(message);
          if (root && root.isConnected) {
            var status = root.querySelector("#rcLoading");
            status.textContent = "The calculator is unavailable. The diameter chart and guide remain available below.";
            root.querySelector("#rcToolStatus").textContent = "Static guide available";
          }
          if (global.console) console.warn("ReelCalc line guide:", error.message);
          return false;
        }
      })();
      mounts.set(host, promise);
      return promise;
    }
    global.ReelCalcLinePageLoader = { mount: mount };
  }
  if (script && script.dataset.product) {
    var options = { product: script.dataset.product, target: script.dataset.target,
      base: script.dataset.assetBase || new URL("../", script.src).href };
    function start() { global.ReelCalcLinePageLoader.mount(options); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})(window);
