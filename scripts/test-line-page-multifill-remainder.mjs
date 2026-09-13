import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const directory='reports/recovery-launch-integration/rt001';
const baseline=process.argv.includes('--baseline');
assert(process.argv.slice(2).every(arg=>arg==='--baseline'));
const engine=baseline?`${directory}/line-page-engine.before.js`:'js/line-page-engine.js';
const read=file=>fs.readFileSync(file,'utf8'), hash=value=>createHash('sha256').update(value).digest('hex');
const lines=JSON.parse(read('data/lines.json')), line=lines.find(row=>row.id==='sunline-kantan-cast-braid-x8-braid-30');
const cases=[{capacity:150,remaining:'0 yd',name:'Exact 150/600 identity'},
  {capacity:150+Number.EPSILON*300,remaining:'0 yd',name:'Upstream arithmetic roundoff near 150'},
  {capacity:149.75,remaining:'1 yd',name:'Real one-yard remainder'}].map(fixture=>{
  const context=vm.createContext({window:{},URL,URLSearchParams,console,
    document:{baseURI:'http://127.0.0.1/',querySelector:()=>({dataset:{}})}});
  vm.runInContext(read('js/calculator-core.js'),context);
  vm.runInContext(read(engine).replace('var ready = init();','var ready; global.testSetup={calculateSetup:calculateSetup,state:state};'),context);
  const api=context.window.testSetup;api.state.lines=lines;
  const result=api.calculateSetup({line,spoolYards:600,workingYards:fixture.capacity,capacityOnly:true,
    reel:{manualRating:{type:'braid',capacityYards:fixture.capacity,referenceDiameterIn:line.dia_in,diameterProvided:true}}});
  const pass=result.ok&&result.spoolEnoughForPlan&&result.shortfallYards===0&&!result.overCapacity&&
    result.efficiencyText.includes('4 separate ')&&result.efficiencyText.includes(`about ${fixture.remaining} remaining.`)&&
    !/-0(?:\.0)? yd|NaN|undefined/.test(result.efficiencyText);
  return {...fixture,fullCapacity:result.fullCapacity,efficiencyText:result.efficiencyText,pass};
});
const report={checkedAt:new Date().toISOString(),engine,engineSha256:hash(read(engine)),coreSha256:hash(read('js/calculator-core.js')),
  lineId:line.id,spoolYards:600,method:'Fresh read-only Node VM per fixture; real calculation and formatting. Second fixture explicitly injects tiny upstream roundoff, not a new product specification.',
  passed:cases.every(row=>row.pass),cases};
fs.writeFileSync(`${directory}/${baseline?'before':'after'}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
