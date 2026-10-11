import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.resolve(process.argv[2] || path.join(root, '../..'));
const frozen = 'outputs/tier3-capacity-research/phase-6-2026-09-27/frozen/';
const files = {
  audit: frozen + 'raw-audit.json',
  evidence: frozen + 'evidence-records.json',
  decisions: frozen + 'source-eligibility.json',
  photos: 'outputs/physical-capacity-evidence-2026-10-03/master-physical-evidence.json',
  admissions: 'outputs/capacity-release-checks-2026-10-03/admissions.json',
  reviews: 'outputs/reel-diameter-audit/catalog-research/reel-diameter-review-queue.json'
};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const inputs = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(path.join(workspace, file))]));
const manifest = Object.entries(files).map(([key, file]) => ({ key, file, sha256: sha(fs.readFileSync(path.join(workspace, file))) }));
const inventoryPath = path.join(root, 'data/reels.json');
const inventoryText = fs.readFileSync(inventoryPath, 'utf8');
const reels = JSON.parse(inventoryText);
const inventory = new Map(reels.map(reel => [reel.id, reel]));
assert.equal(inventory.size, reels.length, 'Duplicate inventory IDs');
const decisions = new Map(inputs.decisions.decisions.map(row => [row.evidence_id, row]));
const byPointer = new Map(inputs.evidence.records.map(row => [row.raw.pointer, row]));
const sources = {};
const photoRecords = {};
const reviewByReel = {};
const originalReels = reels.map(reel => {
  const { manufacturer_capacity_ratings, ...original } = reel;
  return original;
});
for (const reel of reels) delete reel.manufacturer_capacity_ratings;

function normalize(original) {
  const d = original?.diameter, c = original?.capacity;
  if (!(typeof d?.value === 'number' && d.value > 0 && typeof c?.value === 'number' && c.value > 0)) return null;
  const mm = d.unit === 'mm' ? d.value : ['in', 'inch', 'inches'].includes(d.unit) ? d.value * 25.4 : null;
  const meters = c.unit === 'm' ? c.value : ['yd', 'yards'].includes(c.unit) ? c.value * 0.9144 : null;
  if (!(mm > 0 && meters > 0 && Number.isFinite(mm) && Number.isFinite(meters))) return null;
  return { diameter_mm: mm, capacity_meters: meters };
}

function add(reel, raw, origin, material, verification, eligible, original, extra = {}) {
  const id = 'diam-' + sha(JSON.stringify([reel.id, origin])).slice(0, 24);
  assert.ok(!sources[id], 'Duplicate evidence ID');
  sources[id] = { reel_id: reel.id, origin, raw: extra.physical_rating || raw, ...extra };
  const normalized = normalize(original);
  if (!original?.diameter) return;
  const rating = {
    id, reel_id: reel.id, material: material || 'unclassified',
    original, normalized, verification_status: verification,
    calculation_eligible: Boolean(eligible && normalized && ['mono', 'braid'].includes(material)),
    evidence_file: 'data/reel-diameter-evidence.json',
    source_url: raw.source_url || raw.image_url || null
  };
  (reel.manufacturer_capacity_ratings ||= []).push(rating);
}

for (const [index, audit] of inputs.audit.reels.entries()) {
  const reel = inventory.get(audit.reel_id);
  assert.ok(reel, 'Audit reel missing from inventory: ' + audit.reel_id);
  for (const key of ['sku', 'brand', 'model', 'size_label']) assert.equal(reel[key], audit[key], 'Exact identity changed: ' + reel.id + '/' + key);
  reviewByReel[reel.id] = {
    audit_status: audit.audit_status, review_issue_ids: audit.review_issue_ids,
    evidence_review_required: audit.evidence_review_required,
    original_review_records: inputs.reviews.filter(row => row.reel_id === reel.id),
    held_research: {}
  };
  for (const material of ['mono', 'braid']) {
    for (const [i, anchor] of (audit.manufacturer_capacity_anchors[material] || []).entries()) {
      const pointer = `/reels/${index}/manufacturer_capacity_anchors/${material}/${i}`;
      const record = byPointer.get(pointer);
      const decision = record && decisions.get(record.id);
      assert.ok(record && decision, 'Missing inherited evidence decision: ' + pointer);
      assert.equal(record.raw.record_sha256, sha(JSON.stringify(anchor)), 'Frozen anchor hash mismatch');
      assert.deepEqual(record.original, anchor.original);
      const eligible = anchor.exact_model_verified === true && anchor.status === 'verified_source' && decision.state === 'eligible_verified';
      add(reel, anchor, { file: files.audit, pointer }, material, anchor.status, eligible, anchor.original,
        { inherited_evidence: record, inherited_source_decision: decision });
    }
  }
  for (const bucket of ['material_unclassified_capacity_evidence', 'candidate_capacity_anchors', 'catalog_held_evidence', 'deeper_held_evidence']) {
    reviewByReel[reel.id].held_research[bucket] = audit[bucket] || [];
    for (const [i, anchor] of (audit[bucket] || []).entries()) {
      if (anchor.exact_model_verified !== true || !anchor.original?.diameter) continue;
      add(reel, anchor, { file: files.audit, pointer: `/reels/${index}/${bucket}/${i}` }, anchor.material,
        anchor.status, false, anchor.original);
    }
  }
}

const heldPhotos = [];
for (const [photoIndex, photo] of inputs.photos.evidence.entries()) {
  if (!photo.assessment_active || !photo.verified_photo_candidate || !photo.visual_verified) {
    if (photo.ratings?.some(row => row.diameter != null)) heldPhotos.push(photo);
    continue;
  }
  const admission = inputs.admissions.admissions.find(row => row.evidence_id === photo.id);
  photoRecords[photo.id] = photo;
  for (const reelId of photo.reel_ids) {
    const reel = inventory.get(reelId);
    assert.ok(reel && reel.sku === photo.sku, 'Photo exact SKU mismatch: ' + photo.id);
    for (const [i, row] of photo.ratings.entries()) {
      if (row.diameter == null) continue;
      const original = {
        diameter: { value: row.diameter, unit: row.diameter_unit },
        capacity: { value: row.capacity, unit: row.capacity_unit }
      };
      if (row.printed_alternate_capacity != null) original.also_printed_capacity = { value: row.printed_alternate_capacity, unit: row.printed_alternate_capacity_unit };
      const material = row.material === 'nylon' ? 'mono' : row.material;
      const eligible = Boolean(admission?.materials.includes(material) && !row.interpretation_hold);
      add(reel, photo, { file: files.photos, pointer: `/evidence/${photoIndex}/ratings/${i}` }, material,
        eligible ? 'reviewed_physical_source' : 'photo_candidate_pending_review', eligible, original,
        { physical_rating: row, photo_id: photo.id, release_review: admission || null });
    }
  }
}

// Conflicting same-material lengths at the same stated diameter are not silently resolved.
for (const reel of reels) {
  const rows = reel.manufacturer_capacity_ratings || [];
  for (const row of rows.filter(r => r.calculation_eligible)) {
    const conflicts = rows.filter(other => other.calculation_eligible && other.material === row.material &&
      other.normalized.diameter_mm === row.normalized.diameter_mm &&
      Math.max(other.normalized.capacity_meters, row.normalized.capacity_meters) / Math.min(other.normalized.capacity_meters, row.normalized.capacity_meters) > 1.05);
    if (conflicts.length) {
      row.conflicting_rating_ids = conflicts.map(r => r.id);
      for (const conflict of conflicts) conflict.conflicting_rating_ids = [...new Set([...(conflict.conflicting_rating_ids || []), row.id])];
    }
  }
  for (const row of rows) if (row.conflicting_rating_ids) row.calculation_eligible = false;
}

const coverage = { both: 0, mono_only: 0, braid_only: 0, neither: 0 };
for (const reel of reels) {
  const eligible = (reel.manufacturer_capacity_ratings || []).filter(row => row.calculation_eligible);
  const mono = eligible.some(row => row.material === 'mono'), braid = eligible.some(row => row.material === 'braid');
  coverage[mono && braid ? 'both' : mono ? 'mono_only' : braid ? 'braid_only' : 'neither']++;
}
const ratings = reels.flatMap(reel => reel.manufacturer_capacity_ratings || []);
const summary = {
  date: '2026-10-11', total_reels: reels.length,
  reels_with_stored_diameter_evidence: reels.filter(reel => reel.manufacturer_capacity_ratings?.length).length,
  reels_with_eligible_material_ratings: reels.length - coverage.neither,
  eligible_material_coverage: coverage,
  stored_evidence_rows: ratings.length,
  eligible_rows: ratings.filter(row => row.calculation_eligible).length,
  held_rows: ratings.filter(row => !row.calculation_eligible).length,
  prior_research_preserved: true, legacy_reel_fields_unchanged: true,
  scope: 'Source admission only. No experimental resolver, PE conversion, inferred diameter, cross-material substitution, or range endpoint selection.'
};
assert.deepEqual(reels.map(({ manufacturer_capacity_ratings, ...original }) => original), originalReels);
for (const entry of manifest) assert.equal(sha(fs.readFileSync(path.join(workspace, entry.file))), entry.sha256);
const write = (file, data, eol = '\n') => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, (JSON.stringify(data, null, 2) + '\n').replaceAll('\n', eol));
};
write('data/reels.json', reels, inventoryText.includes('\r\n') ? '\r\n' : '\n');
write('data/reel-diameter-evidence.json', { schema_version: 1, input_manifest: manifest, summary, sources, photo_records: photoRecords, review_by_reel: reviewByReel, held_photo_records: heldPhotos, admission_review: inputs.admissions });
write('reports/manufacturer-diameter-first/coverage.json', summary);
console.log(JSON.stringify(summary, null, 2));
