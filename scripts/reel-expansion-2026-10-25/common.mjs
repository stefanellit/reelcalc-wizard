import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const directory = 'research/reel-expansion-2026-10-25';
export const output = 'outputs/reel-expansion-2026-10-25';
export const date = '2026-10-25';
export const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
export function save(file, value) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, value);
}
export const write = (file, value) => save(file, JSON.stringify(value, null, 2) + '\n');
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const slugify = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const identity = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
export const mutableFiles = ['data/reels.json','data/reel-diameter-evidence.json','data/reel-page-embeds.json','data/reel-affiliates.json'];
export function snapshot() {
  if (fs.existsSync(path.join(root, output, 'originals/manifest.json'))) return;
  const files = execFileSync('git', ['ls-files'], {cwd:root,encoding:'utf8'}).trim().split('\n');
  const hashes = {};
  for (const file of files) {
    if (!fs.existsSync(path.join(root, file))) continue;
    hashes[file] = hash(fs.readFileSync(path.join(root, file)));
  }
  for (const file of [...mutableFiles,'data/lines.json','data/reel-pages.json','data/reel-family-features.json']) {
    save(`${output}/originals/${file}`, fs.readFileSync(path.join(root, file)));
  }
  save(`${output}/originals/uncommitted-before.patch`, execFileSync('git',['diff','--binary'],{cwd:root,maxBuffer:64e6}));
  write(`${output}/originals/manifest.json`, {
    commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    capturedAt:new Date().toISOString(),hashes
  });
}
export const original = file => read(`${output}/originals/${file}`);
