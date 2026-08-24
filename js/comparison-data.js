(function(global) {
  "use strict";

  if (global.ReelCalcComparisonData) return;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalized(value) {
    return clean(value).toLowerCase();
  }

  function finiteNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function trimNumber(value, decimals) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "";
    return number.toFixed(decimals).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
  }

  function reelName(reel) {
    return [reel && reel.brand, reel && reel.model, reel && reel.size_label]
      .map(clean)
      .filter(Boolean)
      .join(" ");
  }

  function reelFamily(reel, page) {
    return clean(page && page.family) || clean(reel && reel.model);
  }

  function reelModel(reel) {
    return clean(reel && reel.sku) || clean(reel && reel.model);
  }

  function reelType(reel) {
    return /baitcast/i.test(clean(reel && reel.reel_type)) ? "baitcasting" : "spinning";
  }

  function normalizedPairId(firstId, secondId) {
    var ids = [clean(firstId), clean(secondId)];
    if (!ids[0] || !ids[1] || ids[0] === ids[1]) return "";
    ids.sort();
    return ids[0] + "__vs__" + ids[1];
  }

  function reelParameters(prefix, reel, page) {
    var output = {};
    output[prefix + "_id"] = clean(reel && reel.id);
    output[prefix + "_brand"] = clean(reel && reel.brand);
    output[prefix + "_family"] = reelFamily(reel, page);
    output[prefix + "_model"] = reelModel(reel);
    output[prefix + "_size"] = clean(reel && reel.size_label);
    output[prefix + "_type"] = reelType(reel);
    return output;
  }

  function comparisonParameters(reelA, reelB, pageA, pageB, source) {
    var params = Object.assign(
      {},
      reelParameters("reel_1", reelA, pageA),
      reelParameters("reel_2", reelB, pageB)
    );
    params.comparison_pair_id = normalizedPairId(reelA && reelA.id, reelB && reelB.id);
    params.same_brand = String(normalized(reelA && reelA.brand) === normalized(reelB && reelB.brand));
    params.same_family = String(normalized(reelFamily(reelA, pageA)) === normalized(reelFamily(reelB, pageB)));
    params.same_size = String(normalized(reelA && reelA.size_label) === normalized(reelB && reelB.size_label));
    params.comparison_source = ["manual_selection", "shared_url", "other"].includes(source)
      ? source
      : "other";
    return params;
  }

  function selectorParameters(reel, page, position) {
    return {
      reel_id: clean(reel && reel.id),
      brand: clean(reel && reel.brand),
      family: reelFamily(reel, page),
      model: reelModel(reel),
      size: clean(reel && reel.size_label),
      reel_type: reelType(reel),
      selector_position: position === "left" ? "left" : "right"
    };
  }

  function comparisonSummary(reelA, reelB) {
    var nameA = reelName(reelA);
    var nameB = reelName(reelB);
    var sentences = [];
    var weightA = finiteNumber(reelA && reelA.weight_oz);
    var weightB = finiteNumber(reelB && reelB.weight_oz);
    var retrieveA = finiteNumber(reelA && reelA.line_retrieve_in);
    var retrieveB = finiteNumber(reelB && reelB.line_retrieve_in);
    var dragA = finiteNumber(reelA && reelA.max_drag_lb);
    var dragB = finiteNumber(reelB && reelB.max_drag_lb);

    if (weightA !== null && weightB !== null) {
      var weightDifference = Math.abs(weightA - weightB);
      if (weightDifference >= 0.1) {
        sentences.push(
          (weightA < weightB ? nameA : nameB) + " is " + trimNumber(weightDifference, 1) +
          " oz lighter than " + (weightA < weightB ? nameB : nameA) + "."
        );
      } else {
        sentences.push("Both reels have the same published weight.");
      }
    }

    if (retrieveA !== null && retrieveB !== null) {
      var retrieveDifference = Math.abs(retrieveA - retrieveB);
      if (retrieveDifference >= 1) {
        sentences.push(
          (retrieveA > retrieveB ? nameA : nameB) + " retrieves " + trimNumber(retrieveDifference, 1) +
          " in more line per handle turn."
        );
      } else if (sentences.length < 2) {
        sentences.push("Their published retrieve rates are within 1 inch per handle turn.");
      }
    }

    if (dragA !== null && dragB !== null && sentences.length < 3) {
      var dragDifference = Math.abs(dragA - dragB);
      if (dragDifference >= 0.5) {
        sentences.push(
          (dragA > dragB ? nameA : nameB) + " lists " + trimNumber(dragDifference, 1) +
          " lb more maximum drag."
        );
      } else if (sentences.length < 2) {
        sentences.push("Both reels list nearly the same maximum drag.");
      }
    }

    if (!sentences.length) {
      sentences.push("Use the verified specifications and line-capacity tables below to compare these exact reel models.");
    }
    return sentences.slice(0, 3).join(" ");
  }

  global.ReelCalcComparisonData = {
    normalizedPairId: normalizedPairId,
    reelFamily: reelFamily,
    reelModel: reelModel,
    reelType: reelType,
    reelParameters: reelParameters,
    comparisonParameters: comparisonParameters,
    selectorParameters: selectorParameters,
    comparisonSummary: comparisonSummary
  };
})(window);
