import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {root,read,write} from './research.mjs';
const require=createRequire(import.meta.url);
const sharp=require(process.env.REELCALC_NODE_MODULES+'/sharp');
const images=read('research/spinning-page-expansion/images.json');
const unique=new Map();
for(const image of Object.values(images).filter(i=>i.status==='ready')){
  if(!unique.has(image.assetPath)){
    const data=await sharp(path.join(root,image.assetPath)).resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();
    const metadata=await sharp(data).metadata();
    const assetPath='assets/reel-page-images/'+crypto.createHash('sha256').update(data).digest('hex').slice(0,20)+'.webp';
    fs.writeFileSync(path.join(root,assetPath),data);
    unique.set(image.assetPath,{assetPath,bytes:data.length,width:metadata.width,height:metadata.height});
  }
  const optimized=unique.get(image.assetPath);
  Object.assign(image,{originalAssetPath:image.assetPath,...optimized,imageUrl:read('data/reel-pages.json').assetBaseUrl.replace(/\/$/,'')+'/'+optimized.assetPath});
}
write('research/spinning-page-expansion/images-optimized.json',images);
console.log(unique.size,'web images,', [...unique.values()].reduce((n,i)=>n+i.bytes,0),'bytes');
