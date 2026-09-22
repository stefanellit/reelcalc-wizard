// Exact-model evidence reviewed separately from the automatic source extractors.
export const aliases = {
  'Quantum|BM2500.B2': 'BK2500.B2',
  'Quantum|BM3000.B2': 'BK3000.B2',
  'Quantum|BM4000.B2': 'BK4000.B2',
  'Quantum|BM5000.B2': 'BK5000.B2',
  'Quantum|BM6000.B2': 'BK6000.B2',
  'Quantum|BM8000.B2': 'BK8000.B2',
  // Manufacturer catalog UPC 032784640608 matches the BX3 packaged reel listing.
  'Quantum|SMX25XPT.BX3': 'SMX25XPT',
  'Daiwa|TAEL2500D-XH': 'TATUEL2500D-XH',
  'Daiwa|TAEL4000D-CXH': 'TATUEL4000D-CXH',
  'Daiwa|SALTISTMQ8000-H': 'SALTISTMQ8000H',
  'Daiwa|SALTISTMQ10000-H': 'SALTISTMQ10000H',
  'Daiwa|SALTISTMQ14000-H': 'SALTISTMQ14000H'
};

export const additionalHolds = {
  NEX1000FI: 'Shimano product and Fishshop tables disagree on mono 4 lb and braid 15 lb capacities. Manufacturer clarification is needed.',
  IX2000R: 'Shimano product and Fishshop tables disagree on the PowerPro capacity ratings. Manufacturer clarification is needed.'
};

export function supplementReviewedRows(rows, catalog, pages) {
  const machSource='https://www.lews.com/contentassets/2666016ab56e4b5483bec74eb26b0aca/2023_mach_final.pdf#page=5';
  for(const [sku,weight,retrieve,drag,monoLb,monoYards,braidLb,braidYards] of [
    ['MH100A',7.8,30,13,6,120,8,150],['MH200A',8.1,31,13,8,120,10,180],['MH300A',9,32,17,10,145,15,250]
  ]) catalog.push({brand:"Lew's",sku,url:machSource,evidenceUrl:machSource,gear_ratio:6.2,weight_oz:weight,line_retrieve_in:retrieve,max_drag_lb:drag,bearings:'9+1',mono:[{lb:monoLb,yards:monoYards}],braid:[{lb:braidLb,yards:braidYards}],raw:{catalog:'2023 MACH Spec Book, printed page 3'}});
  const azoresSource = 'https://assets.unilogcorp.com/187/ITEM/DOC/OKUMA_103259611_Catalog.pdf#page=10';
  for (const [sku, weight_oz] of Object.entries({'Z-4000H-BLUE':12,'Z-6000H-BLUE':18.5,'Z-8000H-BLUE':25.6,'Z-14000H-BLUE':26.3})) {
    catalog.push({brand:'Okuma',sku,weight_oz,evidenceUrl:azoresSource});
  }
  const ix = pages.find(p=>p.url==='https://fishshop.shimano.com/products/ix');
  for(const sku of ['IX1000R','IX4000R']) {
    const row = rows.find(r=>r.brand==='Shimano'&&r.sku===sku);
    const cells = ix.tables[0].find(c=>c[0].includes(`SKU: ${sku} `));
    if (!row || !cells) throw new Error('Missing reviewed IX source: '+sku);
    const pairs = value=>[...value.matchAll(/(\d+)\/(\d+)/g)].map(m=>({lb:+m[1],yards:+m[2]}));
    if(JSON.stringify(row.braid)!==JSON.stringify(pairs(cells[3]))) throw new Error('IX braid conflict: '+sku);
    row.mono=pairs(cells[2]);
    row.bearings=cells[4];
    catalog.push({brand:'Shimano',sku,evidenceUrl:ix.url,bearings:cells[4]});
  }
  // Bass Pro is the brand owner. Values read from its full product chart, not a retailer summary.
  for (const [size,asset,weight,drag,monoLb,monoYards,braidLb,braidYards,retrieve] of [
    [1500,'4460687',6.5,11,6,80,8,150,32],
    [3000,'4460689',7.4,22,10,95,20,100,36.8]
  ]) {
    const url=`https://www.basspro.com/shop/en/bass-pro-shops-johnny-morris-carbonlite-tech-spinning-reel-${size}-size-${asset}`;
    rows.push({brand:'Bass Pro Shops',sku:`JCTT${size}`,url,evidenceUrl:url,gear_ratio:6.2,weight_oz:weight,max_drag_lb:drag,line_retrieve_in:retrieve,bearings:'7+1',mono:[{lb:monoLb,yards:monoYards}],braid:[{lb:braidLb,yards:braidYards}],image:`https://assets.basspro.com/image/list/fn_select:jq:first(.%5B%5D%7Cselect(.public_id%20%7C%20endswith(%22main%22)))/${asset}.json`,raw:{reviewed:'Brand-owner Product Chart, September 21, 2026'}});
  }
}

export const shimanoPhotoPages = {
  'Nexave FI':'https://fishshop.shimano.com/products/nexave-fi',
  'Exsence A':'https://fishshop.shimano.com/products/exsence-a',
  'Twin Power XD FB':'https://fishshop.shimano.com/products/25twinpower-xd-fb',
  'IX':'https://fishshop.shimano.com/products/ix'
};
