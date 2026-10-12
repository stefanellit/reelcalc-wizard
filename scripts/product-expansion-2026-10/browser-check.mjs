import {chromium} from 'playwright';
import {root,read,write} from './research.mjs';
import {output} from './build-pages.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1365,height:950}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://stefanellit.github.io/reelcalc-wizard/**',async route=>{const response=await page.request.get(route.request().url().replace('https://stefanellit.github.io/reelcalc-wizard','http://127.0.0.1:4193'));await route.fulfill({response});});
fs.mkdirSync(path.join(root,output,'screenshots'),{recursive:true});
const pages=read(`${output}/build-pages.json`).files,results=[];
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/calculator-core.js'),'utf8'),sandbox);
const core=sandbox.window.ReelCalcCore,reels=read('data/reels.json'),lines=read('data/lines.json');
const near=(a,b,label)=>assert(Math.abs(a-b)<1.1,`${label}: ${a} vs ${b}`);
try{
for(const width of [1365,390]){
  await page.setViewportSize({width,height:950});
  for(const item of pages){
    await page.goto(`http://127.0.0.1:4193/${output}/native/${item.slug}.html`);
    const calc=page.locator('[data-reelcalc-calculator]:visible');
    await calc.locator('button').filter({hasText:'Capacity Only'}).click();
    await calc.getByRole('button',{name:'Metric',exact:true}).click();
    await calc.locator('.main-selector').getByRole('button',{name:"My line isn't listed",exact:true}).click();
    await calc.locator('#main-custom-lb').fill('20');
    await calc.locator('#main-custom-dia').fill('0.21');
    const reel=reels.find(r=>r.id===item.id),values={};
    for(const type of ['Braid','Mono']){
      await calc.locator('.main-selector').getByRole('button',{name:type,exact:true}).click();
      await calc.getByRole('button',{name:'Calculate My Setup',exact:true}).click();
      const text=await calc.locator('.result-number').innerText();
      const actual=Number(text.replace(/,/g,'').match(/[\d.]+/)[0]);
      const expected=core.calculateFullSpoolCapacity(reel,{type,lb:20,dia_in:.21/25.4,custom_line:true},{lineCatalog:lines})*.9144;
      near(actual,expected,`${item.id} ${type}`);values[type]=actual;
    }
    await calc.getByRole('button',{name:'Standard',exact:true}).click();
    const inches=Number(await calc.locator('#main-custom-dia').inputValue());
    assert(Math.abs(inches-.21/25.4)<.000051,'Converted inch diameter outside existing four-decimal rounding');
    near(Number((await calc.locator('.result-number').innerText()).replace(/,/g,'').match(/[\d.]+/)[0]),core.calculateFullSpoolCapacity(reel,{type:'Mono',lb:20,dia_in:inches,custom_line:true},{lineCatalog:lines}),'Unit conversion with existing displayed precision');
    assert.equal(await page.locator('[data-reelcalc-calculator]:visible').count(),1);
    assert.equal(await page.locator('h1:visible').count(),1);
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,broken:[...document.images].filter(i=>i.getBoundingClientRect().width&&(!i.complete||!i.naturalWidth)).map(i=>i.src)}));
    assert(!layout.overflow,`Overflow ${item.id} ${width}`);assert.deepEqual(layout.broken,[],`Broken image ${item.id}`);
    if(['penn-fierce-v-2500','abu-garcia-ambassadeur-c1-7000','daiwa-rs-500','lew-s-mach-bottomland-spinning-100'].includes(item.slug)){
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(root,output,`screenshots/${item.slug}-${width}.png`)});
    }
    results.push({id:item.id,width,visibleCalculators:1,unitsPassed:true,...values});
  }
  await page.goto(`http://127.0.0.1:4193/${output}/native/fins-bfs-ultralight-braid-diameter-capacity-guide.html`);
  await page.locator('#rcReelBrand').selectOption('Daiwa');
  await page.locator('#rcReelModel').selectOption('RS');
  await page.locator('#rcReelSize').selectOption('daiwa-rs-500-rs500');
  await page.locator('#rcCalculate').click();
  for(const lb of [4,6,8,10,12,15]){
    await page.locator('#rcStrength').selectOption(`fins-bfs-ultralight-braid-${lb}`);
    await page.locator('#rcCalculate').click();
    const text=await page.locator('#use-this-line').innerText();
    assert(!/NaN|undefined|Choose an exact reel to continue/.test(text));
  }
  await page.locator('#rcBackingModeButton').click();
  await page.locator('#rcWorkingYards').fill('25');
  await page.locator('#rcCalculate').click();
  assert.equal(await page.locator('#rcStrength:visible').count(),1);
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,broken:[...document.images].filter(i=>i.getBoundingClientRect().width&&(!i.complete||!i.naturalWidth)).map(i=>i.src)}));
  assert(!layout.overflow);assert.deepEqual(layout.broken,[]);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(root,output,`screenshots/fins-${width}.png`)});
  results.push({id:'fins-bfs-ultralight',width,strengthsChecked:6,backingPassed:true});
}
const wizard=[];
for(const item of read(`${output}/build-data.json`).newReels){
  await page.goto(`http://127.0.0.1:4193/index.html?reel=${item.id}&line=fins-bfs-ultralight-braid-10`);
  await page.waitForFunction(id=>document.querySelector('#reelSize').value===id,item.id);
  assert.equal(await page.locator('#lineBrand').inputValue(),'FINS');
  const text=await page.locator('#capacityResult').innerText();
  assert(/\d/.test(text)&&!/NaN|undefined/.test(text),`Wizard capacity: ${item.id}`);
  wizard.push({id:item.id,selected:true,finsSelected:true,capacityResult:text});
}
assert.deepEqual(errors,[]);write(`${output}/browser-results.json`,{results,wizard,errors});console.log(`Passed ${results.length} desktop/mobile page checks and ${wizard.length} Wizard selections, including capacity, material switching and units.`);
}finally{await browser.close();}
