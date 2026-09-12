import assert from "node:assert/strict";

export function normalizeSeaguar(source, review) {
  assert.equal(review?.status, "verified", `${source.id}: source review has not passed`);
  const lbIndex = source.options.findIndex(option => /^LB Test\*?$/i.test(option.name));
  const spoolIndex = source.options.findIndex(option => option.name === "Spool Length");
  assert(lbIndex >= 0, `${source.id}: missing strength option`);
  const rows = new Map();
  for (const variant of source.variants) {
    // Unassigned combinations in Shopify are placeholders, not retail offerings.
    if (!variant.sku?.trim()) continue;
    const match = /^(\d+(?:\.\d+)?)\s*LB\s+(\.\d+|\d+\.\d+)\s*in\.?\s*\/\s*(\.\d+|\d+\.\d+)\s*mm\s*dia\.?$/i.exec(variant.options[lbIndex]);
    assert(match, `${source.id}: unrecognized diameter label ${variant.options[lbIndex]}`);
    const [lb, dia_in, dia_mm] = match.slice(1).map(Number);
    assert(lb > 0 && dia_in > 0 && dia_mm > 0, "Nonpositive specification");
    let yards = review.fixedSpoolYards;
    if (spoolIndex >= 0) {
      const length = /^(\d+(?:\.\d+)?)\s*YDS?$/i.exec(variant.options[spoolIndex]);
      assert(length, `${source.id}: unsupported package unit`);
      yards = Number(length[1]);
    } else {
      assert(review.fixedSpoolMeters && source.description.includes(String(review.fixedSpoolMeters) + "-meter") &&
        source.description.includes(String(yards) + " yards"), `${source.id}: fixed package length not supported by source`);
    }
    assert(yards > 0, `${source.id}: missing retail spool length`);
    const row = rows.get(lb) || { lb, dia_in, dia_mm, spool_sizes_yd: [], source_variant_ids: [], source_skus: [] };
    assert(row.dia_in === dia_in && row.dia_mm === dia_mm, `${source.id}: conflicting diameter for ${lb} lb`);
    row.spool_sizes_yd.push(yards);
    row.source_variant_ids.push(variant.id);
    row.source_skus.push(variant.sku);
    if (review.fixedSpoolMeters) row.spool_length_m = review.fixedSpoolMeters;
    rows.set(lb, row);
  }
  assert(rows.size > 0, `${source.id}: no assigned variants`);
  return [...rows.values()].sort((a,b) => a.lb-b.lb).map(row => ({...row,
    spool_sizes_yd: [...new Set(row.spool_sizes_yd)].sort((a,b) => a-b),
    source_skus: [...new Set(row.source_skus)]
  }));
}
