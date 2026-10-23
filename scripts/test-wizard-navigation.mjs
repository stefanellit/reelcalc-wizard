import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from './line-page-publishing/node_modules/parse5/dist/index.js';

const html = fs.readFileSync('index.html', 'utf8');
const document = parse(html);
const flatten = node => [node, ...(node.childNodes || []).flatMap(flatten)];
const attr = (node, name) => node?.attrs?.find(a => a.name === name)?.value;
const hasClass = (node, name) => (attr(node, 'class') || '').split(' ').includes(name);
const nodes = flatten(document);
const header = nodes.find(node => hasClass(node, 'site-header'));
const footer = nodes.find(node => hasClass(node, 'site-footer'));
const main = nodes.find(node => node.tagName === 'main');
const navs = nodes.filter(node => node.tagName === 'nav' && hasClass(node, 'quick-links'));
assert.equal(navs.length, 1);
const nav = navs[0];
assert.equal(nav.parentNode, footer);
assert(!flatten(header).some(node => node.tagName === 'nav'));
assert(nodes.indexOf(footer) > Math.max(...nodes.filter(node => hasClass(node, 'panel')).map(node => nodes.indexOf(node))));
assert.equal(footer.parentNode, main.parentNode);
assert(!nodes.some(node => node.tagName === 'base'), 'Do not add a global base target');
const links = flatten(nav).filter(node => node.tagName === 'a');
assert.deepEqual(links.map(link => [flatten(link).filter(n => n.nodeName === '#text').map(n => n.value).join('').trim(), attr(link, 'href'), attr(link, 'target')]), [
  ['Home', 'https://www.reelcalc.com', '_top'],
  ['Line Database', 'https://www.reelcalc.com/line-database', '_top'],
  ['Setup Guides', 'https://www.reelcalc.com/fishing-line-setup-guides', '_top']
]);
const brand = nodes.find(node => hasClass(node, 'brand-link'));
assert.equal(attr(brand, 'target'), '_top');

// Keep the original release's exact scope audit available without pinning future releases.
if (process.argv.includes('--original-release-audit')) {
const baseline = parse(execFileSync('git', ['show', '54dee89:index.html'], { encoding: 'utf8' }));
footer.childNodes = footer.childNodes.filter(node => node !== nav);
header.childNodes.push(nav);
for (const link of [...links, brand]) link.attrs = link.attrs.filter(a => a.name !== 'target');
const stylesheet = nodes.find(node => node.tagName === 'link' && attr(node, 'href') === 'wizard.css?v=9');
assert(stylesheet);
stylesheet.attrs.find(a => a.name === 'href').value = 'wizard.css?v=8';
function structure(node) {
  if (node.nodeName === '#text') return node.value.trim() ? { text: node.value.trim() } : null;
  return { name: node.nodeName, attrs: node.attrs, children: (node.childNodes || []).map(structure).filter(Boolean) };
}
assert.deepEqual(structure(document), structure(baseline), 'Unrelated wizard HTML changed');
execFileSync('git', ['diff', '--exit-code', '54dee89', '--', 'js', 'data'], { encoding: 'utf8', maxBuffer: 10e6 });
}
console.log('PASS: footer position, all four _top targets, no global base.');
