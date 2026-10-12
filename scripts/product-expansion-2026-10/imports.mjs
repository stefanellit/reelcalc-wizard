import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as html from '../line-page-publishing/node_modules/parse5/dist/index.js';
import fs from 'node:fs';
import path from 'node:path';
import {root,read,write} from './research.mjs';
import {output,headers,baseline,all,attr,remove,save,escape} from './build-pages.mjs';
const reelPages=read(`${output}/build-pages.json`).files;
const entry=read('generated/line-pages/launch-settings.json').find(r=>r.id==='fins-bfs-ultralight');
const doc=html.parseFragment(fs.readFileSync(path.join(root,'components/line-pages/fins-bfs-ultralight.html'),'utf8'));
const article=doc.childNodes.find(n=>n.tagName==='article');
for(const node of all(article,n=>['script','nav'].includes(n.tagName)||['use-this-line','compare-lines','choose-leader'].includes(attr(n,'id'))||attr(n,'aria-labelledby')==='examples-title'))remove(node);
for(const node of all(article,n=>n.tagName==='button')){node.tagName='span';node.attrs=[];}
for(const node of all(article,n=>n.attrs))node.attrs=node.attrs.filter(a=>!a.name.startsWith('data-')&&a.name!=='aria-live');
article.attrs.push({name:'data-line-guide-fallback',value:entry.id});
for(const node of all(article,n=>n.tagName==='a'&&['#use-this-line','#choose-leader'].includes(attr(n,'href'))))node.attrs.find(a=>a.name==='href').value=`https://stefanellit.github.io/reelcalc-wizard/examples/line-pages/${entry.id}.html`+attr(node,'href');
const description=html.serializeOuter(article),sku='RCL'+crypto.createHash('sha256').update(entry.id).digest('hex').slice(0,17).toUpperCase();
assert(!/<(?:script|input|select|button|iframe|style)\b/i.test(description));
const row=Object.fromEntries(headers.map(h=>[h,'']));
Object.assign(row,{'Product Type [Non Editable]':'SERVICE','Product Page':'lines','Product URL':entry.slug,Title:entry.title,Description:description,SKU:sku,Price:'0','On Sale':'No',Stock:'Unlimited',Categories:'/line-guides',Tags:'reelcalc-line-guide',Visible:'No','Hosted Image URLs':new URL(entry.thumbnail,'https://stefanellit.github.io/reelcalc-wizard/').href});
const registry=baseline('data/line-page-imports.json');
assert(!registry.pages[entry.slug]);
registry.pages[entry.slug]={id:entry.id,title:entry.title,seoTitle:entry.seoTitle,seoDescription:entry.seoDescription,url:entry.url,image:row['Hosted Image URLs'],sku};
registry.version=read('data/line-page-release.json').version;
write('data/line-page-imports.json',registry);
write(`${output}/csv-rows.json`,{headers,reels:reelPages.map(p=>p.row),lines:[row]});
const pages=[...reelPages,{id:entry.id,name:entry.title,slug:entry.slug,row}];
for(const page of pages){
  const r=page.row,url=`https://www.reelcalc.com/${r['Product Page']}/p/${page.slug}`;
  save(`${output}/native/${page.slug}.html`,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="canonical" href="${url}"><title>${escape(r.Title)}</title>
<style>html{font-size:20px}body{margin:0;font-family:Georgia,serif;background:#eef1ef}header,footer{padding:20px}h1{font-size:32px}a{color:#931654}.product-content-wrapper{display:flex;gap:32px}.product-gallery{min-height:500px;width:50%}.product-meta{width:50%;padding-left:38px}.hidden-up-md{display:none}@media(max-width:720px){.hidden-up-md{display:block}.hidden-down-md{display:none}}</style>
<script src="/js/squarespace-reel-page-loader.js" data-asset-base="/" data-page-slug="${page.slug}" defer></script></head><body><header><a href="https://www.reelcalc.com/">ReelCalc</a></header><main class="product-detail tag-${r.Tags}"><div data-product-detail-layout="simple"><nav class="product-nav">Guides</nav><div class="product-content-wrapper"><div class="product-gallery">Product gallery</div><div class="product-meta"><h1 class="product-title">${escape(r.Title)}</h1><div class="product-price">$0.00</div><div class="product-description hidden-down-md">${r.Description}</div><div class="product-add-to-cart"><button>Add to cart</button></div><div class="product-description hidden-up-md">${r.Description}</div></div></div></div></main><footer>ReelCalc</footer></body></html>`);
}
save(`${output}/review.html`,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>New ReelCalc guides</title><style>body{max-width:960px;margin:30px auto;padding:0 20px;font:17px/1.55 Arial;color:#20342d}h1{font-size:28px}a{color:#17633e}li{padding:8px 0}img{width:100px;height:100px;object-fit:contain;vertical-align:middle;margin-right:14px}ul{padding:0;list-style:none}</style></head><body><h1>New ReelCalc guides</h1><p>18 reel pages and one line guide. These previews use the imported-page layout. New Squarespace pages will import hidden.</p><ul>${pages.map(p=>`<li><img src="${p.row['Hosted Image URLs'].replace('https://stefanellit.github.io/reelcalc-wizard/','/')}" alt=""><a href="native/${p.slug}.html">${escape(p.name)}</a></li>`).join('')}</ul><h2>Pages held for better specifications</h2><ul>${read(`${output}/build-pages.json`).held.map(r=>`<li>${escape(r.id)}: ${escape(r.reason)}</li>`).join('')}</ul></body></html>`);
console.log('Prepared 19 hidden import rows and native-page fixtures.');
