(function () {
  "use strict";

  var embed = document.getElementById("reelcalc-wizard-embed");
  if (!embed || embed.querySelector("iframe")) return;

  var script = document.currentScript;
  var baseUrl = script && script.dataset.wizardUrl
    ? script.dataset.wizardUrl
    : "https://stefanellit.github.io/reelcalc-wizard/";
  var wizardUrl = new URL(baseUrl, window.location.href);
  var pageParams = new URLSearchParams(window.location.search);
  var forwardedParams = [
    "reel",
    "line",
    "mainLine",
    "lb",
    "mainYards",
    "spool",
    "mode"
  ];

  forwardedParams.forEach(function (name) {
    var value = pageParams.get(name);
    if (value) wizardUrl.searchParams.set(name, value);
  });

  var frame = document.createElement("iframe");
  frame.src = wizardUrl.toString();
  frame.title = "ReelCalc Reel Setup Wizard";
  frame.loading = "lazy";
  frame.style.display = "block";
  frame.style.width = "100%";
  frame.style.minHeight = "1400px";
  frame.style.border = "0";

  embed.appendChild(frame);
})();
