import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("js/real-world-test-runtime.js", "utf8");
const catalog = JSON.parse(fs.readFileSync("data/line-guide-links.json", "utf8"));
const origin = "https://www.reelcalc.com";
function runtime(fail = false) {
  let requests = 0;
  const context = {
    window: {}, URL, Map, Promise, location: { origin },
    document: { baseURI: origin + "/reel-tests/shimano-vanford-c3000xg-fluorocarbon-respool-test", readyState: "loading",
      currentScript: { src: "https://stefanellit.github.io/reelcalc-wizard/js/real-world-test-runtime.js?v=2", dataset: {} }, addEventListener() {} },
    fetch: async url => {
      requests++;
      assert.equal(url, "https://stefanellit.github.io/reelcalc-wizard/data/line-guide-links.json");
      if (fail) throw new Error("Offline");
      return { ok: true, json: async () => catalog };
    }
  };
  const marker = '  if (document.readyState === "loading")';
  assert.equal(source.split(marker).length, 2);
  vm.runInNewContext(source.replace(marker, "  window.repairTestLinks = updateLineGuideLinks;\n" + marker), context);
  return { repair: context.window.repairTestLinks, requests: () => requests };
}
const anchor = href => ({ href, getAttribute(name) { return name === "href" ? this.href : null; } });
const page = links => ({ querySelectorAll: () => links });
const check = runtime();
for (const guide of Object.values(catalog.guides)) {
  const current = new URL(guide.url);
  const legacy = current.pathname.replace("/lines/p/", "/lines/");
  for (const prefix of ["", origin, "https://reelcalc.com"]) {
    const link = anchor(prefix + legacy + "/?line=example&lb=10#diameter-chart");
    await check.repair(page([link]));
    assert.equal(link.href, guide.url + "?line=example&lb=10#diameter-chart");
  }
}
assert.equal(check.requests(), 1, "Reuse one guide-catalog request across article mounts.");
const invizx = catalog.guides["seaguar-invizx"].url;
const untouched = [invizx, "/lines/p/seaguar-invizx-fluorocarbon-diameter-capacity-guide", "/lines/unknown-guide", "/line-database", "#line-guide", "javascript:void(0)", "https://other.example/lines/seaguar-invizx-fluorocarbon-diameter-capacity-guide"].map(anchor);
const before = untouched.map(a => a.href);
await check.repair(page(untouched));
assert.deepEqual(untouched.map(a => a.href), before);
const noLegacy = runtime();
await noLegacy.repair(page([anchor(invizx)]));
assert.equal(noLegacy.requests(), 0, "Current article HTML needs no migration request.");
const offline = runtime(true);
const legacy = anchor(invizx.replace("/lines/p/", "/lines/"));
await offline.repair(page([legacy]));
assert.equal(legacy.href, invizx.replace("/lines/p/", "/lines/"), "A catalog outage must not interrupt the rest of the test page.");
console.log(JSON.stringify({ passed: true, knownGuidePaths: Object.keys(catalog.guides).length, queryAndHashPreserved: true, unrelatedLinksUnchanged: true, offlineFallback: true }));
