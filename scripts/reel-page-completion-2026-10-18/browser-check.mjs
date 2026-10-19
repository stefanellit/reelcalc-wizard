import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {root,output,read,write} from './build.mjs';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1365,height:950}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://stefanellit.github.io/reelcalc-wizard/**',async route=>{const response=await page.request.get(route.request().url().replace('https://stefanellit.github.io/reelcalc-wizard','http://127.0.0.1:4197'));await route.fulfill({response});});
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/calculator-core.js'),'utf8'),sandbox);
const core=sandbox.window.ReelCalcCore,reels=read('data/reels.json'),lines=read('data/lines.json');
const near=(a,b,label)=>assert(Math.abs(a-b)<1.1,`${label}: ${a} vs ${b}`);
fs.mkdirSync(path.join(root,output,'screenshots'),{recursive:true});
try{
 for(const width of [1365,390]){
  await page.setViewportSize({width,height:950});
  for(const item of read(`${output}/build-pages.json`).files){
   await page.goto(`http://127.0.0.1:4197/${output}/native/${item.slug}.html`);
   const calc=page.locator('[data-reelcalc-calculator]:visible');
   await calc.getByRole('button',{name:'Capacity Only',exact:true}).click();
   await calc.getByRole('button',{name:'Metric',exact:true}).click();
   await calc.locator('.main-selector').getByRole('button',{name:"My line isn't listed",exact:true}).click();
   await calc.locator('#main-custom-lb').fill('20');await calc.locator('#main-custom-dia').fill('0.21');
   const reel=reels.find(r=>r.id===item.id),values={};
   for(const type of ['Braid','Mono','Fluorocarbon']){
    await calc.locator('.main-selector').getByRole('button',{name:type,exact:true}).click();
    await calc.getByRole('button',{name:'Calculate My Setup',exact:true}).click();
    const text=await calc.locator('.result-number').innerText(),actual=Number(text.replace(/,/g,'').match(/[\d.]+/)[0]);
    near(actual,core.calculateFullSpoolCapacity(reel,{type,lb:20,dia_in:.21/25.4,custom_line:true},{lineCatalog:lines})*.9144,`${item.slug} ${type}`);values[type]=actual;
   }
   await calc.getByRole('button',{name:'Standard',exact:true}).click();
   const inches=Number(await calc.locator('#main-custom-dia').inputValue());assert(Math.abs(inches-.21/25.4)<.000051);
   near(Number((await calc.locator('.result-number').innerText()).replace(/,/g,'').match(/[\d.]+/)[0]),core.calculateFullSpoolCapacity(reel,{type:'Fluorocarbon',lb:20,dia_in:inches,custom_line:true},{lineCatalog:lines}),item.slug+' unit conversion');
   await calc.getByRole('button',{name:'Backing + Main Line',exact:true}).click();
   await calc.locator('#main-yards').fill('20');
   await calc.locator('.backing-selector').getByRole('button',{name:"My line isn't listed",exact:true}).click();
   await calc.locator('#backing-custom-lb').fill('10');
   await calc.locator('#backing-custom-dia').fill('0.012');
   await calc.getByRole('button',{name:'Calculate My Setup',exact:true}).click();
   assert.equal(await calc.locator('.error').count(),0);
   assert.equal(await calc.locator('.result').count(),1);
   assert(!/NaN|undefined|Infinity/.test(await calc.innerText()));
   assert.equal(await calc.count(),1);assert.equal(await page.locator('h1:visible').count(),1);
   assert(await page.locator('.reelcalc-affiliate-disclosure:visible').count()>0,`${item.slug}: disclosure not displayed`);
   const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,broken:[...document.images].filter(i=>i.getBoundingClientRect().width&&(!i.complete||!i.naturalWidth)).map(i=>i.src)}));
   assert(!layout.overflow,`Overflow ${item.slug} ${width}`);assert.deepEqual(layout.broken,[],`Broken image ${item.slug}`);
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(root,output,`screenshots/${item.slug}-${width}.png`),fullPage:true});
   await page.screenshot({path:path.join(root,output,`screenshots/${item.slug}-${width}-top.png`)});
   results.push({id:item.id,width,...values,unitsPassed:true,backingRendered:true,layoutPassed:true});
  }
 }
 assert.deepEqual(errors,[]);write(`${output}/browser-results.json`,{results,errors});console.log(`Passed ${results.length} desktop/mobile checks.`);
}finally{await browser.close();}
