import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root,read,write,directory} from './research.mjs';
const output='outputs/product-expansion-2026-10-12';
const additions=read(`${output}/build-data.json`).newReels;
const images={};
const base='https://stefanellit.github.io/reelcalc-wizard/';
for(const item of [...additions.filter(r=>r.config.brand!=='Shakespeare'),{id:'fins-bfs-ultralight',config:{image:'https://www.finsfishing.com/cdn/shop/files/BFS-Ultralight-Dark_Green_boxandspool-_1500x1500_ae79f4a6-dc53-45ef-8b57-873dc2f297c0.png?v=1782232209&width=800'}}]) {
  const url=item.config.image;
  const extension=path.extname(new URL(url).pathname).toLowerCase();
  const file=`assets/product-expansion-2026-10/${item.id}${extension}`;
  let bytes;
  if(fs.existsSync(path.join(root,file))) bytes=fs.readFileSync(path.join(root,file));
  else {
    const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
    if(!response.ok||!/^image\//.test(response.headers.get('content-type')||'')) throw new Error(`${response.status}: ${url}`);
    bytes=Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
    fs.writeFileSync(path.join(root,file),bytes);
  }
  images[item.id]={file,originalUrl:url,imageUrl:base+file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
  console.log(item.id,bytes.length);
}
write(`${directory}/images.json`,images);
