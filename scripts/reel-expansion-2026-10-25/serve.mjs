import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {root,output,directory,read} from './common.mjs';
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.webp':'image/webp','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(name==='/'||name==='/review')name='/'+output+'/review.html';
 if(name==='/reelcalc-wizard')name='/index.html';
 if(name==='/reel-comparison')name='/examples/reel-comparison.html';
 const pending=read(`${directory}/new-page-records.json`).pages;
 if(pending.some(page=>page.path===name))name='/'+output+'/native/'+name.split('/').pop()+'.html';
 // Rehearse the post-import directory in this local server only.
 if(name==='/data/reel-pages.json'){
   const registry=read('data/reel-pages.json');
   registry.pages.push(...pending.filter(page=>!registry.pages.some(old=>old.reelId===page.reelId)));
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(JSON.stringify(registry));return;
 }
 const file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});if(['.html','.json'].includes(path.extname(file)))data=data.toString().replaceAll('https://stefanellit.github.io/reelcalc-wizard/assets/reel-expansion-2026-10-25/','/assets/reel-expansion-2026-10-25/');res.end(data);});
}).listen(Number(process.env.PORT||4200),'127.0.0.1',()=>console.log('ReelCalc preview ready'));
