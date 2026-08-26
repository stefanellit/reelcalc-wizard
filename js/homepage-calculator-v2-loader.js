(function() {
    "use strict";

    var loaderScript = document.currentScript;
    if (!loaderScript) return;

    var targetId = loaderScript.dataset.target || "reelcalc-homepage-calculator-app";
    var host = document.getElementById(targetId);
    if (!host || host.dataset.reelcalcLoaderStarted === "true") return;
    host.dataset.reelcalcLoaderStarted = "true";

    var version = loaderScript.dataset.version || "1";
    var baseUrl = loaderScript.dataset.assetBase
        ? new URL(loaderScript.dataset.assetBase, loaderScript.src).href
        : new URL("../", loaderScript.src).href;

    function assetUrl(relativePath) {
        return new URL(relativePath, baseUrl).href + "?v=" + encodeURIComponent(version);
    }

    function showError() {
        host.innerHTML = '<div role="alert" style="border:1px solid #c58a25;border-radius:6px;background:#fff8e8;color:#5f4607;padding:12px;font:14px/1.5 Arial,sans-serif;">The ReelCalc calculator could not load. Refresh the page and try again.</div>';
    }

    function loadStylesheet() {
        var href = assetUrl("css/homepage-calculator-v2.css");
        var existing = document.querySelector('link[data-reelcalc-homepage-calculator-css]');
        if (existing) return Promise.resolve();

        return new Promise(function(resolve, reject) {
            var link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            link.dataset.reelcalcHomepageCalculatorCss = "true";
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    function loadTemplate() {
        return fetch(assetUrl("components/homepage-calculator-v2.html"), {
            credentials: "omit"
        }).then(function(response) {
            if (!response.ok) throw new Error("Calculator template returned HTTP " + response.status + ".");
            return response.text();
        }).then(function(markup) {
            host.innerHTML = markup;
        });
    }

    function loadCalculatorScript() {
        if (window.ReelCalcHomepageCalculator) {
            window.ReelCalcHomepageCalculator.initialize();
            return Promise.resolve();
        }

        return new Promise(function(resolve, reject) {
            var script = document.createElement("script");
            script.src = assetUrl("js/homepage-calculator-v2.js");
            script.async = true;
            script.onload = function() {
                if (!window.ReelCalcHomepageCalculator) {
                    reject(new Error("Calculator did not initialize."));
                    return;
                }
                window.ReelCalcHomepageCalculator.initialize();
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    Promise.all([loadStylesheet(), loadTemplate()])
        .then(loadCalculatorScript)
        .then(function() {
            host.dataset.reelcalcReady = "true";
            document.dispatchEvent(new CustomEvent("reelcalc:homepage-calculator-ready"));
        })
        .catch(function(error) {
            showError();
            if (window.console && typeof window.console.error === "function") {
                window.console.error("ReelCalc homepage calculator failed to load.", error);
            }
        });
})();
