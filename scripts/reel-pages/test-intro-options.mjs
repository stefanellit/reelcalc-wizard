import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {normalizeReel} from './lookup.mjs';
import {buildRecommendationModel} from './recommendations.mjs';
import {featureProfileFor} from './features.mjs';
import {buildIntro} from './render.mjs';
import {refreshIntros} from './refresh-intros.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const before = '619082ba55345ab6d365bf76dbf87eb3a02841fa';
const old = file => execFileSync('git', ['show', `${before}:${file}`], {cwd: root, encoding: 'utf8', maxBuffer: 40e6});
const previous = JSON.parse(old('data/reel-page-embeds.json'));
const current = read('data/reel-page-embeds.json');
const reels = read('data/reels.json');
const catalog = read('data/reel-family-features.json');
const approvedFeatureKeys = ['Shimano|Exsence A', 'Shimano|Nexave FI', 'Shimano|Twin Power XD FB'];
assert.equal(current.version, 13);
assert.deepEqual(Object.keys(current.pages), Object.keys(previous.pages));
assert.deepEqual(current, read('outputs/spinning-reel-followup/support/data/reel-page-embeds.json'));
const choices = new Set();
let changedFeatures = 0;
for (const [slug, was] of Object.entries(previous.pages)) {
  const now = current.pages[slug];
  const reel = normalizeReel(reels.find(r => r.id === now.reelId));
  const feature = featureProfileFor(reel, catalog);
  const intro = buildIntro(reel, buildRecommendationModel(reel), feature);
  assert.equal(now.intro, intro.text);
  const expected = {...was, intro: now.intro, introVariant: now.introVariant};
  if (approvedFeatureKeys.includes(now.introEvidenceKey)) {
    Object.assign(expected, {introDetailMode: intro.detailMode, introFeatureNames: intro.featureNames, introEvidenceSource: intro.evidenceSource});
    changedFeatures++;
  }
  assert.deepEqual(now, expected, `${slug}: unrelated data changed`);
  assert.match(now.intro, /full spool (?:of|or)|[Ff]ill the spool with main line/);
  assert.match(now.intro, /(?:or|either)[^.]*backing|or use backing/);
  assert.match(now.intro, /calculator below|calculator for|calculator.*below/);
  assert.doesNotMatch(now.intro, /before adding backing|before using backing|before deciding how much backing|front drag inshore|front_drag|sw_spinning|working scale|\b(?:undefined|NaN|null)\b/i);
  assert.ok(now.intro.split(/\s+/).length <= 150, `${slug}: intro too long`);
  for (const term of feature.excludedTerms || []) assert.ok(!now.introFeatureNames.includes(term));
  choices.add(now.introVariant.match(/choice\d+$/)?.[0]);
}
assert.equal(changedFeatures, 9);
assert.equal(choices.size, 4);
assert.ok(!choices.has(undefined));
assert.match(current.pages['shimano-exsence-a-c3000mhg'].intro, /3000-size inshore spinning reel/);
assert.match(current.pages['shimano-exsence-a-c3000mhg'].intro, /magnesium/);
assert.deepEqual(current.pages['daiwa-tatula-elite-spinning-2500d-xh'].introFeatureNames, [], 'Do not borrow features from the newer Tatula MQ.');

const sample = normalizeReel(reels.find(r => r.id === current.pages['shimano-exsence-a-c3000mhg'].reelId));
for (const [type, label] of Object.entries({front_drag_inshore:'inshore spinning reel', rear_drag:'rear-drag spinning reel', 'Rear-drag spinning reel':'rear-drag spinning reel', sw_spinning:'saltwater spinning reel', front_drag_freshwater:'freshwater spinning reel', low_profile_baitcast:'baitcasting reel', round_baitcast:'baitcasting reel', unknown_label:'fishing reel'})) {
  assert.ok(buildIntro({...sample, reelType:type}, {useCases:[], heavyDuty:false}, {terms:[]}).text.split('.')[0].includes(label), type);
}
const smallProfile = featureProfileFor({...sample, brand:'Test', model:'Family', sizeClass:'1000', sizeLabel:'1000'}, {families:{'Test|Family':{sourceUrl:sample.sourceUrl, terms:[{name:'Large-spool feature', clause:'must not leak'}], excludedBySize:{1000:['Large-spool feature']}}}});
assert.deepEqual(buildIntro(sample, {useCases:[], heavyDuty:false}, smallProfile).featureNames, []);
assert.throws(() => refreshIntros(structuredClone(previous), reels, catalog), /intro evidence changed|approved features changed/);
for (const file of ['reels', 'lines', 'reel-pages', 'reel-affiliates']) {
  assert.deepEqual(read(`data/${file}.json`), JSON.parse(old(`data/${file}.json`)), `${file}: unrelated data changed`);
}
const priorCatalog = JSON.parse(old('data/reel-family-features.json'));
assert.deepEqual(Object.fromEntries(Object.entries(catalog.families).filter(([key]) => !approvedFeatureKeys.includes(key))), priorCatalog.families);

const paragraph = /<p class="reelcalc-page-summary">[\s\S]*?<\/p>/g;
let htmlFiles = 0;
for (const slug of Object.keys(current.pages)) {
  for (const suffix of ['squarespace', 'preview']) {
    const file = `generated/reel-pages/p/${slug}-${suffix}.html`;
    if (!fs.existsSync(path.join(root, file))) continue;
    const was = old(file), now = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal([...now.matchAll(paragraph)].length, 1);
    assert.equal(now.replace(paragraph, ''), was.replace(paragraph, ''), `${file}: changed outside the introduction`);
    htmlFiles++;
  }
}
console.log(`Passed: ${Object.keys(current.pages).length} intros, ${htmlFiles} copy-only HTML checks, all four optional-backing variants, nine newly sourced feature intros. Specs, calculators, links, layout and directories unchanged.`);
