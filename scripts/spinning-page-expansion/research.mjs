import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeReel, requiredDataProblems } from '../reel-pages/lookup.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const researchDir = path.join(root, 'research/spinning-page-expansion');
export const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
export function write(file, value) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n');
}
export const baseCommit='a5c6809bccd835cd8b0e57878cdf36bafb56de8e';
export const baseline=file=>JSON.parse(execFileSync('git',['show',`${baseCommit}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:40e6}));
export const reels = baseline('data/reels.json');
const published = new Set(baseline('data/reel-pages.json').pages.map(p => p.reelId));
export const missing = reels.filter(r => !published.has(r.id) && !/baitcast/i.test(r.reel_type));
export const normalizeSku = value => String(value || '').toUpperCase().replace(/[\s\u00ae\u2122]/g, '');
export const daiwaEndpoint = 'https://daiwa-us-sheets-proxy.devotedigital.workers.dev/sheets/specs?ranges=REELS!A1:Z100000';
const manifestFile = 'research/spinning-page-expansion/sources.json';
export async function cache(url) {
  const manifest = fs.existsSync(path.join(root, manifestFile)) ? read(manifestFile) : {};
  if (manifest[url]?.ok) return fs.readFileSync(path.join(root, manifest[url].file), 'utf8');
  const stem = crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(40000), headers: { 'User-Agent': 'Mozilla/5.0 ReelCalc specification verification', ...(url === daiwaEndpoint ? { Origin: 'https://daiwa.us', Referer: 'https://daiwa.us/' } : {}) } });
    const buffer = Buffer.from(await response.arrayBuffer());
    const pdf = buffer.subarray(0, 5).toString() === '%PDF-' || (response.headers.get('content-type') || '').includes('pdf');
    const file = `research/spinning-page-expansion/sources/${stem}.${pdf ? 'pdf' : 'txt'}`;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), buffer);
    manifest[url] = { ok: response.ok, status: response.status, finalUrl: response.url, file, checkedAt: new Date().toISOString(), sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
    write(manifestFile, manifest);
    console.log(`${response.status} ${buffer.length} ${url}`);
    return response.ok && !pdf ? buffer.toString('utf8') : '';
  } catch (error) {
    manifest[url] = { ok: false, error: error.message, checkedAt: new Date().toISOString() };
    write(manifestFile, manifest);
    console.log(`FAILED ${url}: ${error.message}`);
    return '';
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  write('research/spinning-page-expansion/inventory.json', {
    scope: 'Existing database spinning reels without a registered page; no baitcasters or already-live pages.',
    baselinePageCount: published.size,
    candidateCount: missing.length,
    candidates: missing.map(r => ({ id: r.id, brand: r.brand, model: r.model, sku: r.sku, source: r.source_url, problems: requiredDataProblems(normalizeReel(r)) }))
  });
  const urls = process.argv.slice(2);
  const selected = urls.length ? urls : [daiwaEndpoint, 'https://www.lews.com/en/shop/reels/spinning?p=1&s=100', ...new Set(missing.filter(r => /abugarcia|pennfishing|pfluegerfishing|fish.shimano|okumafishingusa/.test(r.source_url)).map(r => r.source_url))];
  for (const url of selected) await cache(url);
}
