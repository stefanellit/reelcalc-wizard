import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {refreshIntros} from '../reel-pages/refresh-intros.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n');
const approvedFeatureKeys = ['Shimano|Exsence A', 'Shimano|Nexave FI', 'Shimano|Twin Power XD FB'];
const manifest = read('data/reel-page-embeds.json');
refreshIntros(manifest, read('data/reels.json'), read('data/reel-family-features.json'), {approvedFeatureKeys});
manifest.version = 13;
write('data/reel-page-embeds.json', manifest);
write('outputs/spinning-reel-followup/support/data/reel-page-embeds.json', manifest);

const introPattern = /<p class="reelcalc-page-summary">[\s\S]*?<\/p>/g;
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
let htmlFiles = 0;
// Replace only the known generated paragraph; leave the rest of each file byte-for-byte intact.
for (const [slug, entry] of Object.entries(manifest.pages)) {
  for (const suffix of ['squarespace', 'preview']) {
    const file = path.join(root, `generated/reel-pages/p/${slug}-${suffix}.html`);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    assert.equal([...html.matchAll(introPattern)].length, 1, file);
    fs.writeFileSync(file, html.replace(introPattern, () => `<p class="reelcalc-page-summary">${escapeHtml(entry.intro)}</p>`));
    htmlFiles++;
  }
}
console.log(`Refreshed ${Object.keys(manifest.pages).length} introductions and ${htmlFiles} generated HTML files. No page registrations or calculator settings changed.`);
