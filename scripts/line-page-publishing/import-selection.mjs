import assert from "node:assert/strict";

export function selectNewImports(settings, release, requested) {
  const ids = settings.map(entry=>entry.id);
  assert.equal(new Set(ids).size, ids.length, "Duplicate launch IDs");
  assert.equal(new Set(settings.map(entry=>entry.slug)).size, settings.length, "Duplicate launch slugs");
  const published = new Set(release.publishedProducts || []);
  for(const id of published) assert(ids.includes(id), `Published guide missing from settings: ${id}`);
  const selected = requested || ids.filter(id=>!published.has(id));
  assert.equal(new Set(selected).size, selected.length, "Duplicate requested imports");
  for(const id of selected) {
    assert(ids.includes(id), `Unknown launch guide: ${id}`);
    assert(!published.has(id), `Refusing to reimport published guide: ${id}`);
  }
  return settings.filter(entry=>selected.includes(entry.id));
}
