import {Workbook} from '@oai/artifact-tool';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,read,write} from './research.mjs';
import {output} from './build-pages.mjs';
const input=read(`${output}/csv-rows.json`),files=[];
for(const [kind,name]of [['reels','UPLOAD-18-NEW-REEL-PAGES.csv'],['lines','UPLOAD-1-FINS-LINE-GUIDE.csv']]){
  const matrix=[input.headers,...input[kind].map(r=>input.headers.map(h=>r[h]??''))];
  const workbook=Workbook.create(),sheet=workbook.worksheets.add('Squarespace import');
  const range=sheet.getRangeByIndexes(0,0,matrix.length,28);
  range.setNumberFormat('@');range.values=matrix;
  sheet.getRange('A1:AB1').format.font={bold:true};
  sheet.getRange('A1:E1').format.columnWidth=32;
  sheet.getRange('A1:E1').format.rowHeight=45;
  sheet.getRange('A1:E1').format.wrapText=true;
  workbook.recalculate();
  const values=range.values.map(r=>r.map(v=>v==null?'':String(v)));
  assert.deepEqual(values,matrix,'Artifact workbook changed native import values');
  console.log((await workbook.inspect({kind:'table',range:"'Squarespace import'!A1:E2",include:'values,formulas',tableMaxRows:2,tableMaxCols:5,maxChars:1500})).ndjson);
  const preview=await workbook.render({sheetName:'Squarespace import',range:'A1:E2',scale:1,format:'png'});
  fs.writeFileSync(path.join(root,output,`${kind}-csv-preview.png`),new Uint8Array(await preview.arrayBuffer()));
  // CSV is a native text import: export the checked Artifact Tool cell values without styling or extra rows.
  const cell=value=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value;
  const csv=values.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
  const file=path.join(root,output,name);fs.writeFileSync(file,csv,'utf8');
  assert(!fs.readFileSync(file).subarray(0,3).equals(Buffer.from([239,187,191])));
  const roundTrip=await Workbook.fromCSV(fs.readFileSync(file,'utf8'),{sheetName:'Check'});
  const restored=roundTrip.worksheets.getItem('Check').getRangeByIndexes(0,0,matrix.length,28).values.map(r=>r.map(v=>v==null?'':String(v)));
  assert.deepEqual(restored,matrix,'CSV round-trip lost content');
  for(const row of input[kind]){assert.equal(row.Visible,'No');assert.equal(row['Product ID [Non Editable]'],'');assert.equal(row['Product Type [Non Editable]'],'SERVICE');}
  assert.equal(new Set(input[kind].map(r=>r.SKU)).size,input[kind].length);
  files.push({kind,file,rows:matrix.length-1,columns:28,hidden:true,roundTripPassed:true,bytes:fs.statSync(file).size});
}
write(`${output}/csv-validation.json`,files);console.log(JSON.stringify(files,null,2));
