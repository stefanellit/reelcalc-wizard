import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,read} from './research.mjs';

const before='7cfd881d05adbc93a671f63498bab8a0c77f0198';
const old=file=>execFileSync('git',['show',`${before}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:40e6});
const previous=JSON.parse(old('data/reel-page-embeds.json'));
const current=read('data/reel-page-embeds.json');
assert.equal(current.version,11);
assert.deepEqual(Object.keys(current.pages),Object.keys(previous.pages));
for(const [slug,entry] of Object.entries(previous.pages)){
  assert.deepEqual(current.pages[slug],{...entry,intro:current.pages[slug].intro,introVariant:current.pages[slug].introVariant},`${slug}: non-intro data changed`);
}
for(const file of ['reels','lines','reel-pages','reel-affiliates','reel-family-features']){
  assert.deepEqual(read(`data/${file}.json`),JSON.parse(old(`data/${file}.json`)),`${file}: unrelated data changed`);
}
const intro=/<p class="reelcalc-page-summary">[\s\S]*?<\/p>/g;
const build=read('outputs/spinning-reel-expansion/build.json');
let htmlFiles=0;
for(const page of build.files){
  for(const file of [page.blockFile,page.previewFile]){
    const was=old(file),now=fs.readFileSync(path.join(root,file),'utf8');
    assert.equal([...was.matchAll(intro)].length,1);
    assert.equal([...now.matchAll(intro)].length,1);
    assert.equal(now.replace(intro,''),was.replace(intro,''),`${file}: something outside the intro changed`);
    htmlFiles++;
  }
}
console.log(`Copy-only regression passed: ${Object.keys(current.pages).length} manifest entries, ${htmlFiles} HTML files; specs, URLs, layout, links, and calculator markup unchanged.`);
