import fs from 'node:fs';
import path from 'node:path';
import { root, read, write, missing, normalizeSku } from './research.mjs';

const sourceDir = path.join(root, 'research/spinning-page-expansion/sources');
const documents = fs.readdirSync(sourceDir).filter(f => f.endsWith('.pages.json')).map(f => JSON.parse(fs.readFileSync(path.join(sourceDir, f), 'utf8')));
const rows = [];
for (const doc of documents) for (const p of doc.pages) for (const line of p.text.split('\n')) {
  if (/abu_garcia_2025_catalog|105216BR|105206BR|96437BR/.test(doc.url)) {
    const m = line.match(/^(.+?)\s+\d{7}\s+(?:Box(?:\/\s*\d{7}\s+Clam)?|Clam)\s+(\d+(?:\.\d+)?) lb\/(\d+) yd\s+(\d+(?:\.\d+)?) lb\/(\d+) yd\s+(\d+(?:\.\d+)?) lb\s+(\d+(?:\.\d+)?):1\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?) oz\s+(\d+)\s+Right\/Left/);
    if (m) rows.push({ brand:'Abu Garcia', sku:m[1], mono:[{lb:+m[2],yards:+m[3]}],braid:[{lb:+m[4],yards:+m[5]}],max_drag_lb:+m[6],gear_ratio:+m[7],line_retrieve_in:+m[8],weight_oz:+m[9],bearings:m[10],partialCapacities:true,url:doc.url,evidenceUrl:doc.url,page:p.page,raw:line });
  }
  if (/penn_2025_catalog|105225BR|110425BR/.test(doc.url)) {
    const m = line.match(/^(\S+)\s+\d{7}\s+(\d+)\s*\/\s*(\d+)\s+(\d+)\s*\/\s*(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s*lbs?\s+(\d+(?:\.\d+)?):1\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
    if (m) rows.push({brand:'PENN',sku:m[1],mono:[{yards:+m[2],lb:+m[3]}],braid:[{yards:+m[4],lb:+m[5]}],bearings:m[6],max_drag_lb:+m[7],gear_ratio:+m[8],line_retrieve_in:+m[9],weight_oz:+m[10],partialCapacities:true,url:doc.url,evidenceUrl:doc.url,page:p.page,raw:line});
  }
  if (/quantum_2024|zebcobrands_product_catalog_2022/.test(doc.url)) {
    const m = line.match(/^(\S+)\s+(?:Spinning\s+)?(\d+)\s+(\d+(?:\.\d+)?):1\s+(\d+)\s*\/\s*(\d+)\s+(?:(\d+)\s*\/\s*(\d+)|n\/a)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s*\+\s*(\d+)\s+(\d+(?:\.\d+)?)\s+(?:Box|Clam)/);
    if (m) rows.push({brand:'Quantum',sku:m[1],gear_ratio:+m[3],mono:[{yards:+m[4],lb:+m[5]}],braid:m[6]?[{yards:+m[6],lb:+m[7]}]:[],max_drag_lb:+m[8],line_retrieve_in:+m[9],bearings:`${m[10]}+${m[11]}`,weight_oz:+m[12],url:doc.url,evidenceUrl:doc.url,page:p.page,raw:line});
  }
  if (/pflueger_2025/.test(doc.url) && p.page <= 9) {
    const m = line.match(/^(\S+)\s+\d{7}\s+(?:Box\s*\/\s*\d{7}\s+Clam\s+)?(\d+) yd\. \/ (\d+) lb\.\s+(\d+) yd\. \/ (\d+) lb\.\s+(\d+)\s*lb\.?\s+(\d+(?:\.\d+)?):1\s+(\d+(?:\.\d+)?)[”"]\s+(\d+(?:\.\d+)?) oz/);
    if (m) rows.push({brand:'Pflueger',sku:m[1],mono:[{yards:+m[2],lb:+m[3]}],braid:[{yards:+m[4],lb:+m[5]}],max_drag_lb:+m[6],gear_ratio:+m[7],line_retrieve_in:+m[8],weight_oz:+m[9],partialCapacities:true,url:doc.url,evidenceUrl:doc.url,page:p.page,raw:line});
  }
  if (/quantum_2026/.test(doc.url) && p.page === 8) {
    for (const m of line.matchAll(/\b((?:CB|BK|MT|SV)\d{4})\s+(\d+\+\d+)\s+(\d+(?:\.\d+)?):1\s+(\d+)[”"]?\s+(\d+)\s*\/\s*(\d+)\s+(\d+)\s*\/\s*(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+R\/L/g)) rows.push({brand:'Quantum',sku:m[1],bearings:m[2],gear_ratio:+m[3],line_retrieve_in:+m[4],mono:[{yards:+m[5],lb:+m[6]}],braid:[{yards:+m[7],lb:+m[8]}],weight_oz:+m[9],max_drag_lb:+m[10],url:doc.url,evidenceUrl:doc.url,page:p.page,raw:m[0]});
  }
  if (/lews_2023/.test(doc.url)) {
    const m=line.match(/^(\S+)\s+(\d+\+\d+)\s+([\d.]+):1\s+(\d+)"\s+(\d+)\/(\d+)\s+(\d+)\/(\d+)\s+([\d.]+)\s+([\d.]+) lbs\.\s+R\/L/);
    if(m) rows.push({brand:"Lew's",sku:m[1],bearings:m[2],gear_ratio:+m[3],line_retrieve_in:+m[4],mono:[{yards:+m[5],lb:+m[6]}],braid:[{yards:+m[7],lb:+m[8]}],weight_oz:+m[9],max_drag_lb:+m[10],url:doc.url,evidenceUrl:doc.url,page:p.page,raw:line});
  }
  if (/productmanual/.test(doc.url) && p.page === 1) {
    const m = line.match(/^(FMA\d+)\s+(\d+\+\d+)\s+([\d.]+)\s+(\d+)\s+([\d/, ]+)\s+(\d+)"\s+([\d.]+):1/);
    const s = line.match(/^(SLS\d+)\s+5\s+\(4\+1\)\s+([\d.]+):1\s+([\d.]+)\s+(\d+)\s+(\d+)"\s+([\d/, ]+)/);
    if (m || s) {
      const cap = value => [...value.matchAll(/(\d+)\/(\d+)/g)].map(x=>({lb:+x[1],yards:+x[2]}));
      const following=p.text.split('\n').slice(p.text.split('\n').indexOf(line)+1);
      const nextModel=following.findIndex(l=>/^(?:FMA|SLS)\d+\s/.test(l));
      const nextLine=following.slice(0,nextModel<0?following.length:nextModel).find(l=>/^\d+\/\d+,\s*\d+\/\d+,\s*\d+\/\d+/.test(l));
      if(!nextLine)throw new Error('Missing braid row in owner manual: '+(m?.[1]||s?.[1]));
      const r = m ? {brand:'Bass Pro Shops',sku:m[1],bearings:m[2],weight_oz:+m[3],max_drag_lb:+m[4],mono:cap(m[5]),line_retrieve_in:+m[6],gear_ratio:+m[7]} : {brand:'Offshore Angler',sku:s[1],bearings:'4+1',gear_ratio:+s[2],weight_oz:+s[3],max_drag_lb:+s[4],line_retrieve_in:+s[5],mono:cap(s[6])};
      const braid=cap(nextLine.split(/ [A-Za-z]/)[0]);
      if(braid.length!==3)throw new Error('Incomplete owner-manual braid row: '+r.sku);
      rows.push({...r,braid,url:doc.url,evidenceUrl:doc.url,page:p.page,raw:line+'\n'+nextLine});
    }
  }
}
for (const row of rows) if (['Abu Garcia','PENN','Pflueger'].includes(row.brand)) row.sap=row.raw.match(/\b\d{7}\b/)?.[0];
write('research/spinning-page-expansion/catalog-rows.json',rows);
console.log('Parsed catalog rows:',rows.length);
for (const brand of ['Abu Garcia','PENN','Pflueger','Quantum']) console.log(brand,missing.filter(r=>r.brand===brand&&rows.some(s=>s.brand===brand&&normalizeSku(s.sku)===normalizeSku(r.sku))).length);
