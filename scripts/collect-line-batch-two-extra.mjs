import fs from 'node:fs';
import { parse } from './line-page-publishing/node_modules/parse5/dist/index.js';
const walk=(n,fn)=>{fn(n);for(const c of n.childNodes||[])walk(c,fn);};
const content=n=>{const a=[];walk(n,c=>{if(c.nodeName==='#text')a.push(c.value);});return a.join(' ').replace(/\s+/g,' ').trim();};
const sources=[
  ['sunline-shooter-machinegun-cast','https://fishing.sunline.co.jp/line/31894/','https://fishing.sunline.co.jp/fishing/wp-content/uploads/2025/12/891b438b8cd9475c45b1c83158ca1505.jpg'],
  ['sunline-shooter-bms-azayaka-fc','https://fishing.sunline.co.jp/english/line/18699/','https://fishing.sunline.co.jp/english/wp-content/uploads/2026/02/846fce95d22ded400024790adc749787.jpg']
];
for(const [id,url,image] of sources){
  const response=await fetch(url);if(!response.ok)throw Error(`${url}: ${response.status}`);
  const html=await response.text();const tables=[];const headings=[];
  walk(parse(html),n=>{if(n.tagName==='table')tables.push(content(n));if(/^h[1-3]$/.test(n.tagName||''))headings.push(content(n));});
  fs.writeFileSync(`research/line-pages/sources/sunline/${id}.json`,JSON.stringify({id,url,retrievedAt:new Date().toISOString(),headings,tables,images:[image]},null,2)+'\n');
  fs.writeFileSync(`research/line-pages/sources/sunline/${id}.html`,html);
}
const gin=JSON.parse(fs.readFileSync('research/line-pages/sources/berkley/ginclear_filler_spool.json'));
sources.push(['berkley-ginclear',gin.url,new URL(gin.images[0],gin.url).href]);
for(const [id,,url] of sources){
  const r=await fetch(url);if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error(url);
  fs.writeFileSync(`assets/line-pages/${id}.jpg`,Buffer.from(await r.arrayBuffer()));
  console.log(id+' source and image saved');
}
