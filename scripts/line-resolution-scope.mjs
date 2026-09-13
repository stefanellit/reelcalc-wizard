export function resolutionScopeLabel(model, row) {
  if (model.id === 'spiderwire-stealth-braid') return `2016 Japan import; actual-mm basis; SS${row.lb}G-125`;
  if (model.id === 'stren-super-knot') return '2014 US catalog; Clear/Lo-Vis Green; 220 yd';
  if (model.id === 'stren-fluorocast') return '2014 US catalog; Clear; 100/200 yd';
  if (model.id === 'stren-sonic-braid') return 'Undated US label; SCB30040-22; Lo-Vis Green';
  if (model.id === 'hi-seas-fluorocarbon') return 'Catalog-listed CFC-F200-25 Clear; stock unverified';
  if (model.id === 'sufix-calibr8') return '2026 launch label; 694-015L Neon Lime; nominal 150 yd';
  if (model.id === 'sufix-invisiline-fluorocarbon') return `${row.lb >= 17 ? '2018 catalog + current SKU' : '2026 US catalog'}; ${row.retail_packages[0].sku} Clear; 100 yd`;
  if (model.brand === 'P-Line') return `${row.publishedYear ? row.publishedYear + ' US catalog' : 'Undated US label'}; ${row.modelNumber} ${row.color}${model.id === 'p-line-tcb-8-braid' ? '; Teflon edition' : ''}`;
  throw new Error(`Missing reviewed scope label: ${model.id}`);
}
