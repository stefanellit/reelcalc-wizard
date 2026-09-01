(function(global) {
  "use strict";

  var MATERIALS = [
    { id: "Monofilament", label: "Mono" },
    { id: "Fluorocarbon", label: "Fluorocarbon" },
    { id: "Copolymer", label: "Copolymer" },
    { id: "Braid", label: "Braid" }
  ];

  function normalizedMaterial(value) {
    var type = String(value || "").toLowerCase();
    if (type.indexOf("braid") !== -1) return "Braid";
    if (type === "monofilament" || type.indexOf("mono") !== -1) return "Monofilament";
    if (type === "fluorocarbon") return "Fluorocarbon";
    if (type === "copolymer" || type === "fluorocarbon coated") return "Copolymer";
    return "";
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function validLine(line) {
    return !!line &&
      !!normalizedMaterial(line.type) &&
      !!cleanText(line.brand) &&
      !!cleanText(line.model) &&
      Number(line.lb) > 0 &&
      Number(line.dia_in) > 0;
  }

  function compareText(a, b) {
    return String(a || "").localeCompare(String(b || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function normalizeSearch(value) {
    return cleanText(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, " ")
      .trim();
  }

  function prepareLines(lines) {
    var unique = new Map();
    (Array.isArray(lines) ? lines : []).forEach(function(line) {
      if (!validLine(line)) return;
      var material = normalizedMaterial(line.type);
      var normalized = Object.assign({}, line, {
        material: material,
        brand: cleanText(line.brand),
        model: cleanText(line.model),
        lb: Number(line.lb),
        dia_in: Number(line.dia_in)
      });
      var key = [
        material.toLowerCase(),
        normalized.brand.toLowerCase(),
        normalized.model.toLowerCase(),
        normalized.lb,
        normalized.dia_in.toFixed(6)
      ].join("|");
      if (!unique.has(key)) unique.set(key, normalized);
    });
    return Array.from(unique.values()).sort(function(a, b) {
      return compareText(a.material, b.material) ||
        compareText(a.brand, b.brand) ||
        compareText(a.model, b.model) ||
        a.lb - b.lb ||
        a.dia_in - b.dia_in;
    });
  }

  function productKey(line) {
    return [line.material, line.brand, line.model].join("|");
  }

  function productLabel(line) {
    return [line.brand, line.model].filter(Boolean).join(" ");
  }

  function productsFor(lines, material) {
    var products = new Map();
    lines.forEach(function(line) {
      if (line.material !== material) return;
      var key = productKey(line);
      if (!products.has(key)) {
        products.set(key, {
          key: key,
          material: line.material,
          brand: line.brand,
          model: line.model,
          label: productLabel(line)
        });
      }
    });
    return Array.from(products.values()).sort(function(a, b) {
      return compareText(a.label, b.label);
    });
  }

  function strengthsFor(lines, product) {
    if (!product) return [];
    return lines.filter(function(line) {
      return productKey(line) === product.key;
    }).sort(function(a, b) {
      return a.lb - b.lb || a.dia_in - b.dia_in;
    });
  }

  function searchLines(lines, material, query) {
    var selectedMaterial = normalizedMaterial(material);
    var normalizedQuery = normalizeSearch(query);
    var tokens = normalizedQuery.split(" ").filter(Boolean);
    return lines.filter(function(line) {
      return !selectedMaterial || line.material === selectedMaterial;
    }).map(function(line) {
      var product = productLabel(line);
      var exactLabel = product + " " + line.lb + " lb";
      var searchable = normalizeSearch([
        line.id,
        product,
        exactLabel,
        line.material,
        line.search_text,
        line.lb + " lb",
        line.dia_in + " in",
        (line.dia_mm || line.dia_in * 25.4) + " mm",
        line.pe,
        line.pe_size,
        line.pe_rating
      ].filter(Boolean).join(" "));
      var productSearch = normalizeSearch(product);
      var exactSearch = normalizeSearch(exactLabel);
      var score = 1;
      if (normalizedQuery) {
        if (normalizeSearch(line.id) === normalizedQuery) score = 1200;
        else if (exactSearch === normalizedQuery) score = 1100;
        else if (exactSearch.startsWith(normalizedQuery)) score = 950;
        else if (productSearch === normalizedQuery) score = 900;
        else if (productSearch.startsWith(normalizedQuery)) score = 850;
        else if (tokens.every(function(token) { return searchable.includes(token); })) {
          score = 700 - Math.min(searchable.indexOf(tokens[0]), 100);
        } else {
          score = -1;
        }
      }
      return { line: line, score: score, product: product };
    }).filter(function(result) {
      return result.score >= 0;
    }).sort(function(a, b) {
      return b.score - a.score ||
        compareText(a.product, b.product) ||
        a.line.lb - b.line.lb ||
        a.line.dia_in - b.line.dia_in;
    }).map(function(result) {
      return result.line;
    });
  }

  function findLine(lines, productKeyValue, lineId) {
    if (lineId) {
      var exactId = lines.find(function(line) { return line.id === lineId; });
      if (exactId) return exactId;
    }
    return lines.find(function(line) {
      return productKey(line) === productKeyValue;
    }) || null;
  }

  function closestLine(lines, options) {
    var settings = options || {};
    var material = normalizedMaterial(settings.material);
    var targetLb = Number(settings.lb);
    var targetDiameter = Number(settings.dia_in);
    var candidates = lines.filter(function(line) {
      return !material || line.material === material;
    });
    if (!candidates.length) return null;

    return candidates.map(function(line) {
      var lbDifference = targetLb > 0 ? Math.abs(line.lb - targetLb) : 0;
      var diameterDifference = targetDiameter > 0
        ? Math.abs(line.dia_in - targetDiameter) * 10000
        : 0;
      return {
        line: line,
        score: lbDifference * 20 + diameterDifference
      };
    }).sort(function(a, b) {
      return a.score - b.score || compareText(productLabel(a.line), productLabel(b.line));
    })[0].line;
  }

  function parsePreload(search) {
    var params = new URLSearchParams(search || "");
    return {
      mode: params.get("mode") || "",
      mainLineId: params.get("mainLine") || params.get("line") || "",
      backingLineId: params.get("backingLine") || "",
      mainLineYards: Number(params.get("mainYards")) || 0
    };
  }

  global.ReelCalcLineSelector = {
    MATERIALS: MATERIALS.slice(),
    normalizedMaterial: normalizedMaterial,
    validLine: validLine,
    prepareLines: prepareLines,
    productKey: productKey,
    productLabel: productLabel,
    productsFor: productsFor,
    strengthsFor: strengthsFor,
    searchLines: searchLines,
    findLine: findLine,
    closestLine: closestLine,
    parsePreload: parsePreload
  };
})(window);
