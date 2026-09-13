import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const save=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const lines=read('data/lines.json'),batch=read('research/line-pages/batch-two-specs.json');
const audit=[],evidence={};
for(const item of batch){
  const sources=item.sourceIds.map(id=>read(`research/line-pages/sources/${item.brand.toLowerCase()}/${id}.json`));
  const rows=new Map();
  function add(lb,dia_in,dia_mm,yards,variant,meters){
    assert(lb>0&&dia_in>0&&dia_mm>0&&yards>0,`${item.id}: invalid input`);
    const row=rows.get(lb)||{lb,dia_in,dia_mm,spool_sizes_yd:[],source_variant_ids:[],source_skus:[],retail_packages:[]};
    assert.equal(row.dia_in,dia_in); assert.equal(row.dia_mm,dia_mm);
    row.spool_sizes_yd.push(yards);
    if(variant){row.source_variant_ids.push(variant.id);row.source_skus.push(variant.sku);}
    if(meters)row.retail_packages.push({yards,meters});
    rows.set(lb,row);
  }
  if(item.metric){
    const table=sources[0].tables.join(' ');
    for(const [lb,mm] of item.diametersMm){
      assert(table.includes(mm.toFixed(3)),`${item.id}: diameter missing from official table`);
      const spools=Array.isArray(item.spoolsMeters)?item.spoolsMeters:item.spoolsMeters[lb];
      for(const meters of spools)add(lb,Number((mm/25.4).toFixed(6)),mm,Number((meters/.9144).toFixed(2)),null,meters);
    }
  }else for(const source of sources)for(const variant of source.variants){
    if(!variant.sku)continue;
    const lb=Number(variant.options[0].match(/^(\d+(?:\.\d+)?)\s*LB/i)?.[1]);
    let inches,mm,yards;
    if(item.fromVariantDiameters){
      inches=Number(variant.metadata['Line Diameter'].match(/^([\d.]+)\s*in$/)?.[1]);
      mm=Number((inches*25.4).toFixed(4));
      yards=source.url.includes('bulk')?2000:200;
      assert(source.features.some(f=>f.replace(/,/g,'').includes(String(yards))),`${item.id}: package length`);
    }else{
      const spec=item.diameters.find(r=>r[0]===lb);assert(spec,`${item.id}: missing chart row ${lb}`);
      [,inches,mm]=spec;
      yards=source.id.startsWith('sunline-super-natural-')?Number(source.id.split('-').at(-1)):Number(variant.options.find(o=>/^\d+\s*YD$/i.test(o))?.match(/^\d+/)[0]);
    }
    add(lb,inches,mm,yards,variant);
  }
  const normalized=[...rows.values()].sort((a,b)=>a.lb-b.lb).map(r=>({...r,
    spool_sizes_yd:[...new Set(r.spool_sizes_yd)].sort((a,b)=>a-b),source_skus:[...new Set(r.source_skus)],
    source_variant_ids:[...new Set(r.source_variant_ids)],retail_packages:[...new Map(r.retail_packages.map(p=>[p.meters,p])).values()]}));
  const sourceUrls=sources.map(s=>s.url);
  evidence[item.id]={sourceUrls,charts:sources.flatMap(s=>(s.descriptionImages||[]).filter(i=>i.src?.includes('/Dia_')).map(i=>i.src)),
    checkedAt:sources[0].retrievedAt,rows:normalized,excludedLineIds:lines.filter(l=>l.brand===item.brand&&l.model===item.model&&!rows.has(l.lb)).map(l=>l.id),
    note:item.metric?'Current JDM product. Inch diameter and yard lengths converted from published metric specifications.':item.fromVariantDiameters?'Inch diameters from assigned manufacturer variants. Millimeters converted from inches.':'Manufacturer chart inch/mm pairs transcribed separately; assigned SKU variants verify strength-specific package lengths.'};
  for(const spec of normalized){
    const old=lines.find(l=>l.brand===item.brand&&l.model===item.model&&l.type===item.type&&l.lb===spec.lb);
    const next={...old,...spec,brand:item.brand,model:item.model,type:item.type,
      id:old?.id||`${item.id}-${item.type.toLowerCase()}-${spec.lb}`,
      product_source_url:sourceUrls[0],diameter_source_url:evidence[item.id].charts.at(-1)||sourceUrls[0],
      source_note:`Verified ${sources[0].retrievedAt.slice(0,10)}. ${evidence[item.id].note}`,
      search_text:`${item.brand} ${item.model} ${item.type} ${spec.lb} lb`.toLowerCase()};
    if(JSON.stringify(old)!==JSON.stringify(next)){
      audit.push({id:next.id,old:old||null,updated:next,sourceUrls});
      if(old)lines[lines.indexOf(old)]=next;else lines.push(next);
    }
  }
}
assert.equal(new Set(lines.map(l=>l.id)).size,lines.length);
save('data/lines.json',lines);save('research/line-pages/batch-two-evidence.json',evidence);
if(audit.length)save('research/line-pages/batch-two-catalog-changes.json',audit);
console.log(`Verified ${Object.keys(evidence).length} models; ${audit.length} updated/new catalog rows. Unsupported legacy strengths retained but excluded from line pages.`);
