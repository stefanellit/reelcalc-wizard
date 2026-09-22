import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root,read,write} from './research.mjs';
import {shimanoPhotoPages} from './reviewed-evidence.mjs';

const records=read('research/spinning-page-followup/reconciliation.json').filter(r=>r.status==='verified');
const extracted=read('research/spinning-page-followup/extracted.json');
const registry=read('data/reel-pages.json');
const reels=read('data/reels.json');
const base=registry.assetBaseUrl.replace(/\/$/,'');
const pdfImages={
  'Smoke S3':'quantum-2024-p6-Im2.jpg','Smoke S3 Inshore':'quantum-2024-p6-Im1.jpg',
  'Accurist':'quantum-2024-p7-Im1.jpg','Accurist Inshore':'quantum-2024-p7-Im2.jpg',
  'Reliance':'quantum-2024-p8-Im0.jpg','Throttle':'quantum-2024-p8-Im1.jpg',
  'Vapor':'quantum-2022-p82-Im1.jpg','Energy':'quantum-2022-p86-Im1.jpg',
  'Drive':'quantum-2022-p98-Im0.jpg','Strategy':'quantum-2022-p101-Im0.jpg'
};
const result={};
const fetched=new Map();
for(const record of records){
  const r=record.reel;
  let page=extracted.find(p=>p.url===record.official.url);
  if(r.brand==='Daiwa'&&r.model==='Eliminator Spinning Reel')page=extracted.find(p=>p.url==='https://daiwa.us/products/new-eliminator-spinning-reel');
  let url=record.official.image || page?.images?.[0];
  let source=page?.url || record.official.url;
  if(r.brand==='Shimano'&&!url)url=page?.imageCandidates?.find(i=>/Productsrelated.*_main\.jpg/.test(i.src||''))?.src;
  const sibling=registry.pages.find(p=>{const other=reels.find(o=>o.id===p.reelId);return other?.brand===r.brand&&other?.model===r.model});
  if(!url&&sibling){url=sibling.imageUrl;source=sibling.imageSourcePage||source;}
  let local;
  const shimanoPage=shimanoPhotoPages[r.model];
  if(r.brand==='Shimano'&&shimanoPage) {
    source=shimanoPage;
    url=extracted.find(p=>p.url===source)?.images?.[0];
  }
  if(r.brand==='Shimano'&&!shimanoPage&&sibling) {url=sibling.imageUrl;source=sibling.imageSourcePage||source;}
  if(r.brand==="Lew's"&&r.model==='MACH 1 Spinning Reel') {
    local='research/spinning-page-followup/catalog-images/mach-p5-Im3.png';
    source='https://www.lews.com/contentassets/2666016ab56e4b5483bec74eb26b0aca/2023_mach_final.pdf#page=5';
    url=null;
  }
  if(r.brand==='Quantum'&&r.model==='Smoke X') {
    local='research/spinning-page-followup/catalog-images/quantum-p7-Im0.png';
    source='https://www.quantumfishing.com/contentassets/c199c43376d34f1188bb60458a395dfe/quantum_2024.pdf#page=7';
    url=null;
  }
  if(r.brand==="Lew's"&&['KVD Spinning Reel','American Hero Tier 1 Spinning Reel'].includes(r.model)) {
    const file=r.model==='KVD Spinning Reel'?'lews-p17-Im2.png':'lews-p41-Im4.png';
    const meta=read('research/spinning-page-followup/catalog-images/manifest.json').find(m=>m.file===file);
    local='research/spinning-page-followup/catalog-images/'+file;
    source=meta.url+'#page='+meta.page;
    url=null;
  }
  if(r.brand==='Daiwa'&&r.model==='Procyon MQ LT') {
    source='https://www.tackledirect.com/daiwa-procyon-mq-lt-spinning-reels.html';
    url=extracted.find(p=>p.url===source)?.images?.[0];
  }
  if(r.brand==='Daiwa'&&r.model==='Tatula Elite Spinning') {
    source='https://www.tackledirect.com/daiwa-tatuel2500d-xh-tatula-elite-spinning-reel.html';
    url=extracted.find(p=>p.url===source)?.images?.[0];
  }
  if(r.brand==='Daiwa'&&r.model==='Kage LT') {
    source='https://tackletrap.com/pages/kage-lt-spinning-reels';
    url='https://cdn.shopify.com/s/files/1/0695/8697/7062/files/KGLT2500-XH_580x_e7d998d9-0802-4231-8d07-d37957e33056_480x480.webp?v=1690835230';
  }
  if(r.brand==='Quantum'&&!url&&pdfImages[r.model]){
    local='research/spinning-page-followup/catalog-images/'+pdfImages[r.model];
    const meta=read('research/spinning-page-followup/catalog-images/manifest.json').find(m=>m.file===pdfImages[r.model]);
    source=meta.url+'#page='+meta.page;
  }
  if(r.brand==='Bass Pro Shops'&&r.model==='Formula Spinning Reel'){
    url='https://assets.basspro.com/image/list/fn_select:jq:first(.%5B%5D%7Cselect(.public_id%20%7C%20endswith(%22main%22)))/2910832.json';
    source='https://www.basspro.com/shop/en/3074457345620582191';
  }
  if(r.brand==='Offshore Angler'&&r.model==='Sea Lion Spinning Reel'){
    url='https://assets.basspro.com/image/list/fn_select:jq:first(.%5B%5D%7Cselect(.public_id%20%7C%20endswith(%22main%22)))/2128104.json';
    source='https://www.basspro.com/shop/en/offshore-angler-saltwater-fishing-offshore/offshore-angler-sea-lion-spinning-reel';
  }
  if(!url&&!local){result[r.id]={status:'held',reason:'Verified product image still needed.'};continue;}
  if(url)url=new URL(url.replace(/^http:/,'https:'),source).href;
  const key=url||local;
  try{
    if(!fetched.has(key)){
      let bytes,ext;
      if(local){bytes=fs.readFileSync(path.join(root,local));ext=path.extname(local).slice(1);}
      else{
        const response=await fetch(url,{signal:AbortSignal.timeout(40000)});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const type=response.headers.get('content-type')||'';
        if(!type.startsWith('image/'))throw new Error('Not an image: '+type);
        ext=({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif' })[type.split(';')[0]];
        if(!ext)throw new Error('Unsupported image: '+type);
        bytes=Buffer.from(await response.arrayBuffer());
      }
      const assetPath='assets/reel-page-images/'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,20)+'.'+ext;
      fs.writeFileSync(path.join(root,assetPath),bytes);
      fetched.set(key,{assetPath,bytes:bytes.length,imageUrl:base+'/'+assetPath});
      console.log(r.brand,r.model,bytes.length);
    }
    result[r.id]={status:'ready',...fetched.get(key),source,originalUrl:url||source,imageAlt:`${r.brand} ${r.model} spinning reel - representative manufacturer image`};
  }catch(error){result[r.id]={status:'held',reason:error.message,source,url};console.log('HELD IMAGE',r.id,error.message);}
}
write('research/spinning-page-followup/images.json',result);
console.log('Images ready:',Object.values(result).filter(r=>r.status==='ready').length);
