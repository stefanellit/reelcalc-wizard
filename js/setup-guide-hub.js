(function(global) {
  "use strict";
  var VERSION = "1";
  var initialized = new WeakMap();
  var collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

  function normalize(value) {
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function matches(entry, query) {
    var text = normalize([entry.label, entry.brand, entry.model, entry.sku, entry.size].join(" "));
    var compact = text.replace(/ /g, "");
    return normalize(query).split(/\s+/).every(function(word) {
      return text.includes(word) || compact.includes(word);
    });
  }

  function brandName(brand) {
    return /^penn$/i.test(brand) ? "PENN" : brand || "Other";
  }

  function groupBrands(entries) {
    var groups = new Map();
    entries.forEach(function(entry) {
      var brand = brandName(entry.brand);
      if (!groups.has(brand)) groups.set(brand, []);
      groups.get(brand).push(entry);
    });
    return Array.from(groups).sort(function(a, b) { return collator.compare(a[0], b[0]); });
  }

  function groupFamilies(entries) {
    var groups = new Map();
    entries.forEach(function(entry) {
      var model = entry.model || entry.label;
      var key = entry.category + "|" + model;
      if (!groups.has(key)) groups.set(key, { model: model, category: entry.category, entries: [] });
      groups.get(key).entries.push(entry);
    });
    return Array.from(groups.values()).sort(function(a, b) {
      return collator.compare(a.model, b.model) || collator.compare(a.category, b.category);
    }).map(function(group) {
      group.entries.sort(function(a, b) {
        var aSize = Number(String(a.sizeClass || a.size || "").match(/\d+/)?.[0]);
        var bSize = Number(String(b.sizeClass || b.size || "").match(/\d+/)?.[0]);
        return (Number.isFinite(aSize) && Number.isFinite(bSize) ? aSize - bSize : 0) || collator.compare(a.label, b.label);
      });
      return group;
    });
  }

  function buildLineEntries(imports, release, products) {
    var published = new Set(release.publishedProducts || []);
    return Object.values(imports.pages || {}).filter(function(entry) {
      return published.has(entry.id);
    }).map(function(entry) {
      var product = (products.products || {})[entry.id] || {};
      var type = String(product.lineType || "").toLowerCase();
      var material = /braid/.test(type) ? "braid" : /fluoro/.test(type) ? "fluoro" : /copoly/.test(type) ? "copolymer" : /mono|nylon/.test(type) ? "mono" : "other";
      return { id: entry.id, label: entry.title, path: entry.url, brand: product.brand || "Other",
        model: product.model || entry.title, material: material,
        role: product.role === "leader" || /leader/i.test(product.lineType || "") ? "leader" : "mainline" };
    }).sort(function(a, b) { return collator.compare(a.label, b.label); });
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function link(label, href, className) {
    var node = element("a", className, label);
    node.href = href;
    return node;
  }

  function control(form, label, id, options) {
    var field = element("div", "rc-hub-field");
    var caption = element("label", "", label);
    caption.htmlFor = id;
    var input = element(options ? "select" : "input");
    input.id = id;
    if (options) options.forEach(function(option) {
      var node = element("option", "", option[1]); node.value = option[0]; input.appendChild(node);
    });
    else { input.type = "search"; input.autocomplete = "off"; field.classList.add("rc-hub-search"); }
    field.append(caption, input); form.appendChild(field);
    return input;
  }

  function buildDirectory(kind, entries) {
    var reels = kind === "reels";
    var section = element("section", "rc-hub-section");
    section.id = reels ? "reelcalc-reel-guide-directory" : "reelcalc-line-guide-directory";
    var heading = element("h2", "", reels ? "Reel Guides" : "Line Guides");
    heading.id = section.id + "-title"; section.setAttribute("aria-labelledby", heading.id);
    section.appendChild(heading);
    var form = element("form", "rc-hub-filters");
    form.setAttribute("role", "search"); form.setAttribute("aria-label", reels ? "Find a reel guide" : "Find a line guide");
    form.addEventListener("submit", function(event) { event.preventDefault(); });
    var search = control(form, reels ? "Reel model or model code" : "Line brand or model", "rc-hub-" + kind + "-search");
    search.placeholder = reels ? "e.g. Battle IV 5000" : "e.g. J-Braid X4";
    var groups = groupBrands(entries);
    var brand = control(form, "Brand", "rc-hub-" + kind + "-brand", [["", "All brands"]].concat(groups.map(function(group) { return [group[0], group[0]]; })));
    var type = control(form, reels ? "Reel type" : "Material", "rc-hub-" + kind + "-type", reels
      ? [["", "All reel types"], ["spinning", "Spinning"], ["baitcasting", "Baitcasting"]]
      : [["", "All materials"], ["braid", "Braid"], ["mono", "Monofilament"], ["fluoro", "Fluorocarbon"], ["copolymer", "Copolymer"]]);
    var role = reels ? null : control(form, "Line use", "rc-hub-lines-role", [["", "Main line & leaders"], ["mainline", "Main line"], ["leader", "Leader"]]);
    section.appendChild(form);
    var bar = element("div", "rc-hub-result-bar");
    var status = element("p", "rc-hub-status"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    var actions = element("div", "rc-hub-actions");
    var reset = element("button", "rc-hub-text-button", "Clear filters"); reset.type = "button"; reset.hidden = true;
    var expand = element("button", "rc-hub-text-button", "Expand all"); expand.type = "button";
    actions.append(reset, expand); bar.append(status, actions); section.appendChild(bar);
    var list = element("div", "rc-hub-brands"); section.appendChild(list);
    var rows = [];
    groups.forEach(function(group) {
      var details = element("details", "rc-hub-brand");
      var summary = element("summary");
      summary.appendChild(element("span", "rc-hub-brand-name", group[0]));
      var count = element("span", "rc-hub-count"); summary.appendChild(count);
      details.appendChild(summary);
      var families = reels ? groupFamilies(group[1]) : [{ entries: group[1] }];
      var familyRows = families.map(function(family) {
        var block = element("div", "rc-hub-family");
        if (reels) {
          var title = element("h3", "", family.model);
          title.appendChild(element("span", "rc-hub-kind", family.category === "baitcasting" ? "Baitcasting" : "Spinning"));
          block.appendChild(title);
        }
        var ul = element("ul", reels ? "rc-hub-variants" : "rc-hub-lines");
        var items = family.entries.map(function(entry) {
          var li = element("li");
          var label = entry.label;
          var prefix = entry.brand + " " + entry.model + " ";
          if (reels && entry.model && label.startsWith(prefix)) label = label.slice(prefix.length);
          var a = link(label, entry.path);
          a.setAttribute("aria-label", entry.label);
          if (entry.reelId) a.dataset.reelId = entry.reelId;
          li.appendChild(a); ul.appendChild(li);
          return { node: li, entry: entry };
        });
        block.appendChild(ul); details.appendChild(block);
        return { node: block, items: items };
      });
      list.appendChild(details); rows.push({ details: details, count: count, families: familyRows });
      details.addEventListener("toggle", updateExpandLabel);
    });
    var empty = element("p", "rc-hub-empty", "No matching guides. Try a different model or clear the filters.");
    empty.hidden = true; section.appendChild(empty);
    section.appendChild(link(reels ? "Browse the reel-page collection" : "Browse the line-page collection", reels ? "/reel-pages" : "/lines", "rc-hub-collection"));
    function updateExpandLabel() {
      var visible = rows.filter(function(row) { return !row.details.hidden; });
      expand.textContent = visible.length && visible.every(function(row) { return row.details.open; }) ? "Collapse all" : "Expand all";
      expand.hidden = !visible.length;
    }
    function update() {
      var filtered = Boolean(search.value.trim() || brand.value || type.value || (role && role.value));
      var found = 0;
      rows.forEach(function(row) {
        var total = 0;
        row.families.forEach(function(family) {
          var count = 0;
          family.items.forEach(function(item) {
            var entry = item.entry;
            var show = matches(entry, search.value) && (!brand.value || brandName(entry.brand) === brand.value) &&
              (!type.value || (reels ? entry.category : entry.material) === type.value) && (!role || !role.value || entry.role === role.value);
            item.node.hidden = !show;
            if (show) count += 1;
          });
          family.node.hidden = !count; total += count;
        });
        row.details.hidden = !total; row.count.textContent = total + (total === 1 ? " guide" : " guides");
        row.details.open = filtered && total > 0; found += total;
      });
      status.textContent = found.toLocaleString("en-US") + (filtered ? " of " + entries.length.toLocaleString("en-US") : "") + (reels ? " reel guides" : " line guides");
      reset.hidden = !filtered; empty.hidden = found > 0; updateExpandLabel();
    }
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    reset.addEventListener("click", function() { form.reset(); update(); search.focus(); });
    expand.addEventListener("click", function() {
      var open = expand.textContent === "Expand all";
      rows.forEach(function(row) { if (!row.details.hidden) row.details.open = open; });
      updateExpandLabel();
    });
    update();
    return section;
  }

  function topicGroup(title, links) {
    var group = element("section", "rc-hub-topic"); group.appendChild(element("h3", "", title));
    var ul = element("ul");
    links.forEach(function(item) { var li = element("li"); li.appendChild(link(item[0], item[1])); ul.appendChild(li); });
    group.appendChild(ul); return group;
  }

  function buildHub(reels, lines, base) {
    var root = element("div", "rc-hub"); root.id = "reelcalc-setup-hub"; root.dataset.version = VERSION;
    var intro = element("header", "rc-hub-intro");
    intro.append(element("h1", "", "Fishing Line Setup Guides"), element("p", "", "Line capacity, backing, and practical spooling advice for your next setup."));
    var nav = element("nav", "rc-hub-nav"); nav.setAttribute("aria-label", "Setup guide sections");
    [["Reel Guides", "reelcalc-reel-guide-directory"], ["Line Guides", "reelcalc-line-guide-directory"], ["Setup Advice", "reelcalc-setup-advice"], ["Real-World Tests", "reelcalc-spool-tests"]].forEach(function(item) {
      nav.appendChild(link(item[0], "#" + item[1]));
    });
    intro.appendChild(nav);
    var wizard = element("p", "rc-hub-wizard");
    wizard.append(document.createTextNode("Still choosing a setup? "), link("Open the Setup Wizard", "/reelcalc-wizard"));
    intro.appendChild(wizard); root.appendChild(intro);
    root.append(buildDirectory("reels", reels), buildDirectory("lines", lines));
    var advice = element("section", "rc-hub-section"); advice.id = "reelcalc-setup-advice";
    advice.appendChild(element("h2", "", "Setup Advice"));
    var topics = element("div", "rc-hub-topics");
    topics.append(topicGroup("Choosing your line", [
      ["Best Line Setup for Spinning Reels", "/blog/best-line-setup-for-spinning-reels-braid-mono-fluoro-explained"],
      ["What Pound Test Line Should I Use?", "/blog/what-pound-test-line-should-i-use-on-a-spinning-reel"],
      ["How Much Braid Do I Need?", "/blog/how-much-braid-should-i-put-on-my-reel"]
    ]), topicGroup("Choosing a reel size", [
      ["What Size Spinning Reel Should I Use?", "/blog/what-size-spinning-reel-should-i-use-1000-2500-3000-4000-5000-explained"],
      ["2500 vs 3000 Spinning Reel", "/blog/2500-vs-3000-spinning-reel-which-should-you-choose"],
      ["Line Setup for a 2500 Spinning Reel", "/blog/what-line-should-i-put-on-a-2500-spinning-reel"],
      ["Line Setup for a 3000 Spinning Reel", "/blog/what-line-should-i-put-on-a-3000-spinning-reel"]
    ]), topicGroup("Capacity and backing tools", [
      ["Fishing Reel Backing Calculator", "/home"], ["Line Diameter Database", "/line-database"], ["How to Use ReelCalc", "/how-to-use"]
    ]), topicGroup("PE line sizes", [
      ["What Is PE Fishing Line?", "/blog/what-is-pe-fishing-line-a-beginner-friendly-guide"],
      ["PE Line Capacity Calculator", "/pe-line-capacity-calculator"], ["PE Line Diameter Database", "/pe-line-diameter-database"]
    ]));
    advice.appendChild(topics); root.appendChild(advice);
    var tests = element("section", "rc-hub-section"); tests.id = "reelcalc-spool-tests";
    tests.append(element("h2", "", "Real-World Spooling Tests"), element("p", "", "Actual reels, measured line amounts, and photos of the finished spool."));
    var feature = element("div", "rc-hub-test-feature");
    var image = element("img"); image.src = base + "/assets/real-world-tests/daiwa-bg-lt-3000d-xh/IMG_2664.jpeg";
    image.alt = "Daiwa BG LT 3000D-XH used in ReelCalc's physical spooling test"; image.loading = "lazy"; image.width = 300; image.height = 300;
    feature.append(image, topicGroup("From the workbench", [
      ["Daiwa BG LT 3000D-XH: Mono and Braid", "/reel-tests/daiwa-bg-lt-3000d-xh-line-capacity-test"],
      ["PENN Fierce IV 8000: Braid and Backing", "/reel-tests/penn-fierce-iv-8000-line-capacity-test"],
      ["Shimano Curado 200 M: Mono Respool", "/reel-tests/shimano-curado-200hg-mono-respool-test"],
      ["Shimano Vanford C3000XG: Fluorocarbon Respool", "/reel-tests/shimano-vanford-c3000xg-fluorocarbon-respool-test"],
      ["View all real-world tests", "/reel-tests"]
    ]));
    tests.appendChild(feature); root.appendChild(tests);
    return root;
  }

  async function fetchData(base, name) {
    var response = await fetch(base + "/data/" + name, { cache: "no-cache", credentials: "omit", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Setup guide data unavailable: " + name);
    return response.json();
  }

  function loadStyle(base) {
    return new Promise(function(resolve, reject) {
      var style = element("link"); style.rel = "stylesheet"; style.href = base + "/css/setup-guide-hub.css?v=" + VERSION;
      var timer = setTimeout(function() { style.remove(); reject(new Error("Setup guide styles timed out")); }, 15000);
      style.onload = function() { clearTimeout(timer); resolve(); };
      style.onerror = function() { clearTimeout(timer); style.remove(); reject(new Error("Setup guide styles unavailable")); };
      document.head.appendChild(style);
    });
  }

  function enhanceLayout(mount) {
    // Only the known hub content blocks are replaced. Header, footer, ads, and new blocks are not selected.
    var grid = mount.closest(".fluid-engine");
    if (!grid) return;
    var wrapper = mount.closest(".fe-block");
    var section = grid.closest('[data-section-id="6a2f55884b60020366322284"]');
    if (!section || !wrapper) return;
    var ids = ["421", "660", "1200", "930", "2278", "1965", "3324", "3707", "4790", "6325"];
    var blocks = ids.map(function(id) { return "block-yui_3_17_2_1_1781486960818_" + id; }).concat([
      "block-yui_3_17_2_1_1783008995341_4423", "block-yui_3_17_2_1_1781488585209_3263",
      "block-yui_3_17_2_1_1781488585209_22296", "block-yui_3_17_2_1_1781488585209_8001"
    ]);
    blocks.forEach(function(id) {
      var block = document.getElementById(id);
      if (block && grid.contains(block)) block.closest(".fe-block").classList.add("rc-hub-original-block");
    });
    section.classList.add("rc-hub-host-section"); grid.classList.add("rc-hub-host-grid"); wrapper.classList.add("rc-hub-host-block");
    grid.prepend(wrapper);
  }

  async function mount(mountNode, reels, base) {
    if (initialized.has(mountNode)) return initialized.get(mountNode);
    var promise = (async function() {
      var data = await Promise.all([fetchData(base, "line-page-imports.json"), fetchData(base, "line-page-release.json"), fetchData(base, "line-page-products.json"), loadStyle(base)]);
      var lines = buildLineEntries(data[0], data[1], data[2]);
      if (!lines.length) throw new Error("No published line guides available");
      var root = buildHub(reels, lines, base);
      document.getElementById("reelcalc-line-guide-directory")?.remove();
      mountNode.replaceChildren(root); mountNode.removeAttribute("aria-live");
      enhanceLayout(mountNode);
      // A cached older line loader can finish after this hub and insert its old directory.
      if (mountNode.parentNode) {
        new MutationObserver(function() {
          Array.from(mountNode.parentNode?.children || []).forEach(function(node) {
            if (node.id === "reelcalc-line-guide-directory") node.remove();
          });
        }).observe(mountNode.parentNode, { childList: true });
      }
      var hash = location.hash.slice(1);
      try { hash = decodeURIComponent(hash); } catch (_) { /* Ignore malformed incoming anchors. */ }
      var anchor = document.getElementById(hash);
      if (anchor && root.contains(anchor)) anchor.scrollIntoView({ block: "start" });
      return true;
    })();
    initialized.set(mountNode, promise);
    try { return await promise; }
    catch (error) { initialized.delete(mountNode); throw error; }
  }

  global.ReelCalcSetupHub = { version: VERSION, normalize: normalize, matches: matches, groupBrands: groupBrands,
    groupFamilies: groupFamilies, buildLineEntries: buildLineEntries, buildHub: buildHub, mount: mount };
})(typeof window !== "undefined" ? window : globalThis);
