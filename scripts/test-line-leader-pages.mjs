import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from './line-page-publishing/node_modules/parse5/dist/index.js';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const products = read('data/line-page-products.json').products;
const lines = read('data/lines.json');
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const all = (node, predicate) => [...(predicate(node) ? [node] : []), ...(node.childNodes || []).flatMap(n => all(n, predicate))];
const context = vm.createContext({ window: {}, URL });
vm.runInContext(fs.readFileSync('js/affiliate-links.js', 'utf8'), context);
const affiliateData = read('data/reel-affiliates.json');
let pages = 0, offers = 0;
for (const [id, product] of Object.entries(products).filter(([, p]) => p.role === 'leader')) {
  const doc = parse(fs.readFileSync(`examples/line-pages/${id}.html`, 'utf8'));
  assert.equal(all(doc, n => attr(n, 'data-line-role') === 'leader').length, 1);
  for (const name of ['rcCalculate', 'rcWorkingYards', 'rcReelBrand', 'rcExamples', 'rcBackingControls']) {
    assert.equal(all(doc, n => attr(n, 'id') === name).length, 0, `${id}: mainline control ${name} leaked`);
  }
  const wizard = all(doc, n => attr(n, 'id') === 'rcLeaderWizard')[0];
  assert.equal(attr(wizard, 'href'), 'https://www.reelcalc.com/reelcalc-wizard', `${id}: must not preload a leader as mainline`);
  const chartIds = all(doc, n => attr(n, 'data-chart-line') !== undefined).map(n => attr(n, 'data-chart-line'));
  assert(chartIds.includes(product.defaultLineId), `${id}: missing default`);
  for (const lineId of chartIds) {
    const line = lines.find(l => l.id === lineId);
    assert.equal(line.role, 'leader');
    for (const spoolYards of line.spool_sizes_yd) {
      const offer = context.window.ReelCalcAffiliateLinks.buildRecommendedLineOffer({ affiliateData, line, spoolYards });
      assert(offer);
      const url = new URL(offer.url);
      assert.equal(url.searchParams.get('tag'), 'reelcalc-20');
      assert(offer.query.includes(line.brand) && offer.query.includes(line.model) && offer.query.includes(`${line.lb} lb`));
      offers++;
    }
  }
  assert.equal(all(doc, n => n.tagName === 'script' && /line-page-engine|calculator-core/.test(attr(n, 'src') || '')).length, 0);
  assert.equal(all(doc, n => n.tagName === 'script' && /line-leader-page/.test(attr(n, 'src') || '')).length, 1);
  pages++;
}
console.log(JSON.stringify({ passed: true, leaderPages: pages, exactPackageOffers: offers }));
