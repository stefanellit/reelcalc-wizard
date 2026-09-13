import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'research/line-pages/sources/sunline');
for (const file of fs.readdirSync(sourceDir).filter(x => x.endsWith('.json'))) {
  const record = JSON.parse(fs.readFileSync(path.join(sourceDir, file), 'utf8'));
  const chart = record.descriptionImages.find(x => x.src?.includes('/Dia_'))?.src;
  const photo = record.images[0];
  for (const [kind, rawUrl] of [['diameter-chart', chart], ['product', photo]]) {
    if (!rawUrl) throw new Error(`${record.id}: missing ${kind}`);
    const url = new URL(rawUrl, 'https://sunlineamerica.com');
    if (!['cdn.shopify.com', 'sunlineamerica.com'].includes(url.hostname)) throw new Error('Unexpected image host');
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Invalid image ${url}`);
    const ext = path.extname(url.pathname);
    const dest = kind === 'product' ? path.join(root, 'assets/line-pages', record.id + ext) : path.join(sourceDir, record.id + '-diameter-chart' + ext);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
    console.log(`${record.id}: ${kind} -> ${path.relative(root, dest)}`);
  }
}
