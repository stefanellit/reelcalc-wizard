(function(global) {
  "use strict";
  var script = document.currentScript;
  var configs = {
    regular: { name: "line-database", api: "ReelCalcLineDatabase", data: "lines.json" },
    pe: { name: "pe-line-database", api: "ReelCalcPELineDatabase", data: "pe-lines.json" }
  };

  if (!global.ReelCalcLineDatabaseLoader) {
    var assets = new Map();
    var mounts = new WeakMap();

    function validateData(data, kind) {
      if (!Array.isArray(data) || !data.length) throw new Error("The line catalog is empty or invalid.");
      var ids = new Set();
      data.forEach(function(line) {
        if (!line || typeof line.id !== "string" || !line.id.trim() || ids.has(line.id) ||
            typeof line.brand !== "string" || !line.brand.trim() ||
            typeof line.model !== "string" || !line.model.trim()) throw new Error("Invalid line identity.");
        ids.add(line.id);
        var fields = kind === "pe" ? ["pe", "dia_in", "dia_mm"] : ["lb", "dia_in", "dia_mm"];
        fields.forEach(function(key) {
          if (typeof line[key] !== "number" || !Number.isFinite(line[key]) || line[key] <= 0) {
            throw new Error("Invalid line specification: " + key);
          }
        });
        if (kind !== "pe" && !/^(braid|monofilament|fluorocarbon(?: leader| coated)?|copolymer)$/i.test(line.type)) {
          throw new Error("Invalid line material.");
        }
        if (kind === "pe") {
          ["lb", "kg"].forEach(function(key) {
            if (line[key] !== "" && line[key] != null &&
                (typeof line[key] !== "number" || !Number.isFinite(line[key]) || line[key] <= 0)) {
              throw new Error("Invalid PE strength.");
            }
          });
          if (typeof line.notes !== "string") throw new Error("Missing PE notes.");
        }
      });
      return data;
    }

    async function request(url, json, fresh) {
      var target = new URL(url);
      if (fresh) target.searchParams.set("t", String(Date.now()));
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 20000);
      try {
        var response = await fetch(target.href, { cache: fresh ? "no-store" : "default", credentials: "omit", signal: controller.signal });
        if (!response.ok) throw new Error("Database request failed: " + response.status);
        return await (json ? response.json() : response.text());
      } finally { clearTimeout(timeout); }
    }

    function asset(url, css, api, options) {
      if (api && global[api]) return Promise.resolve(global[api]);
      if (assets.has(url)) return assets.get(url);
      var promise = new Promise(function(resolve, reject) {
        var element = document.createElement(css ? "link" : "script");
        var timeout;
        function finish(error) {
          clearTimeout(timeout);
          element.onload = element.onerror = null;
          if (error) { element.remove(); assets.delete(url); reject(error); }
          else resolve(api ? global[api] : true);
        }
        element.onload = function() {
          finish(api && !global[api] ? new Error("Database script did not initialize.") : null);
        };
        element.onerror = function() { finish(new Error("A database file could not load.")); };
        if (css) {
          element.rel = "stylesheet";
          element.href = url;
          if (new URL(url).pathname.endsWith("/css/line-database-tools.css")) element.dataset.reelcalcLineTools = "true";
        }
        else {
          element.src = url;
          element.async = true;
          element.dataset.assetBase = options.base;
          ["homepageUrl", "wizardUrl", "peCalculatorUrl"].forEach(function(key) {
            if (options[key]) element.dataset[key] = options[key];
          });
        }
        timeout = setTimeout(function() { finish(new Error("A database file timed out.")); }, 20000);
        document.head.appendChild(element);
      });
      assets.set(url, promise);
      return promise;
    }

    function status(host, message, retry) {
      host.replaceChildren();
      var text = document.createElement("p");
      text.setAttribute("role", retry ? "alert" : "status");
      text.textContent = message;
      host.appendChild(text);
      if (retry) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = "Retry loading database";
        button.addEventListener("click", retry);
        host.appendChild(button);
      }
    }

    function mount(options) {
      var config = configs[options.kind];
      if (!config) return Promise.reject(new Error("Unknown database type."));
      var host = document.getElementById(options.target || "reelcalc-" + config.name + "-app");
      if (!host) return Promise.reject(new Error("The database placeholder is missing."));
      if (mounts.has(host)) return mounts.get(host);
      var existing = document.getElementById("reelcalc-" + config.name);
      if (existing && !host.contains(existing)) {
        status(host, "This database is already on the page. Replace the old database code block with this snippet.");
        return Promise.resolve(false);
      }
      var base = new URL(options.base, document.baseURI).href;
      options = Object.assign({}, options, { base: base });
      host.style.minWidth = "0";
      host.style.maxWidth = "100%";
      host.setAttribute("aria-busy", "true");
      status(host, "Loading line database...");
      var promise = (async function() {
        try {
          var release = await request(new URL("data/line-database-release.json", base), true, true);
          if (!release || !/^[a-zA-Z0-9._-]+$/.test(release.version)) throw new Error("Invalid database release.");
          function versioned(path) {
            var url = new URL(path, base);
            url.searchParams.set("v", release.version);
            return url.href;
          }
          // Data stays independent of UI releases, so publishing a catalog alone updates the table.
          var data = validateData(await request(new URL("data/" + config.data, base), true, true), options.kind);
          var catalog = options.kind === "regular" ? data :
            validateData(await request(new URL("data/lines.json", base), true, true), "regular");
          var html = await request(versioned("components/" + config.name + ".html"), false, false);
          var template = document.createElement("template");
          template.innerHTML = html;
          var root = template.content.firstElementChild;
          if (!root || root.id !== "reelcalc-" + config.name || template.content.children.length !== 1 ||
              template.content.querySelector("script")) throw new Error("Invalid database layout.");
          await asset(versioned("css/" + config.name + ".css"), true, null, options);
          await asset(new URL("css/line-database-tools.css?v=2", base).href, true, null, options);
          var renderer = await asset(versioned("js/" + config.name + ".js"), false, config.api, options);
          var tools = await asset(new URL("js/line-database-tools.js?v=2", base).href, false, "ReelCalcLineTools", options);
          host.replaceChildren(root);
          renderer.initialize(root, data);
          tools.initialize({ catalog: catalog });
          host.setAttribute("aria-busy", "false");
          host.dataset.reelcalcDatabaseReady = "true";
          document.dispatchEvent(new CustomEvent("reelcalc:line-database-ready", { detail: { kind: options.kind, count: data.length } }));
          // Analytics is optional: a blocked tracker must never disable the database.
          asset(new URL("js/analytics.js", base).href, false, "ReelCalcAnalytics", options).then(function(analytics) {
            if (analytics.instrumentLineDatabase) analytics.instrumentLineDatabase();
          }).catch(function() {});
          return true;
        } catch (error) {
          mounts.delete(host);
          host.setAttribute("aria-busy", "false");
          delete host.dataset.reelcalcDatabaseReady;
          status(host, "The line database could not load. Please try again.", function() { mount(options); });
          if (global.console) console.warn("ReelCalc database:", error.message);
          return false;
        }
      })();
      mounts.set(host, promise);
      return promise;
    }
    global.ReelCalcLineDatabaseLoader = { mount: mount, validateData: validateData };
  }

  if (script && script.dataset.database) {
    var options = {
      kind: script.dataset.database,
      target: script.dataset.target,
      base: script.dataset.assetBase || new URL("../", script.src).href,
      homepageUrl: script.dataset.homepageUrl,
      wizardUrl: script.dataset.wizardUrl,
      peCalculatorUrl: script.dataset.peCalculatorUrl
    };
    function start() { global.ReelCalcLineDatabaseLoader.mount(options).catch(function(error) { console.warn(error.message); }); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})(window);
