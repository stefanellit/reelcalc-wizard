import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as html from '../line-page-publishing/node_modules/parse5/dist/index.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'research/reel-page-completion-2026-10-18');
fs.mkdirSync(dir,{recursive:true});
const all=(n,p)=>[...(p(n)?[n]:[]),...(n.childNodes||[]).flatMap(c=>all(c,p))];
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join(' ');
for(const [name,url]of Object.entries({beast:'https://www.abugarcia.com/products/beast-spinning-reel-1641517',stella:'https://fish.shimano.com/en-US/product/reels/spinning/swspinning/a075f000043mjvrqag.html'})){
 const file=path.join(dir,`${name}-official.html`);
 if(!fs.existsSync(file)){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${r.status} ${url}`);fs.writeFileSync(file,await r.text());}
 const doc=html.parse(fs.readFileSync(file,'utf8'));
 const rows=all(doc,n=>n.tagName==='tr').map(text).map(t=>t.replace(/\s+/g,' ').trim()).filter(t=>/BST[345]|STLSW8000/.test(t));
 const images=all(doc,n=>n.tagName==='img').map(n=>Object.fromEntries(n.attrs.map(a=>[a.name,a.value]))).filter(n=>name==='beast'?/Beast/i.test(n.alt||''):/PRD_|Stella/i.test((n.src||'')+(n.alt||'')));
 fs.writeFileSync(path.join(dir,`${name}-extracted.json`),JSON.stringify({url,checkedAt:new Date().toISOString(),rows,images},null,2));
 console.log(JSON.stringify({name,rows,images:images.slice(0,5)},null,2));
}
