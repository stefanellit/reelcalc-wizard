import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {root,output,save,write} from './common.mjs';

// The original shopping release test forbids all reel-data additions. Preserve
// its behavioral tests; this batch's test.mjs separately checks append-only data.
let source=fs.readFileSync(path.join(root,'scripts/test-shopping-tracking.mjs'),'utf8');
const oldList="['js/calculator-core.js','js/recommendation-engine.js','data/reels.json','data/lines.json','data/reel-affiliates.json']";
assert(source.includes(oldList));
source=source.replace(oldList,"['js/calculator-core.js','js/recommendation-engine.js','data/lines.json']");
source=source.replace("new URL('../' + file, import.meta.url)",`new URL(file, ${JSON.stringify(pathToFileURL(root+path.sep).href)})`);
source=source.replace("'./line-page-publishing/node_modules/parse5/dist/index.js'",JSON.stringify(pathToFileURL(path.join(root,'scripts/line-page-publishing/node_modules/parse5/dist/index.js')).href));
const file=`${output}/shopping-behavior-test.mjs`;
save(file,source);
const stdout=execFileSync(process.execPath,[path.join(root,file)],{cwd:root,encoding:'utf8',maxBuffer:10e6});
write(`${output}/shopping-test-results.json`,{passed:true,note:'Only the historical no-reel-data-changes lock is excluded; append-only preservation is tested independently.',stdout});
console.log(stdout);
