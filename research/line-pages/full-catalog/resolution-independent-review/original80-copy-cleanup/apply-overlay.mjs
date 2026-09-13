import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const numericTokens = text => text.match(/\d+(?:\.\d+)?|\.\d+/g) || [];
const permittedField = /^(?:sources\/(?:0|[1-9]\d*)\/note|strengthGuide\/(?:0|[1-9]\d*)|spoolingGuide\/(?:0|[1-9]\d*)\/text|faqs\/(?:0|[1-9]\d*)\/(?:question|answer)|sourceNote|suitabilitySummary|chartNote|reviewNote)$/;

function partsFor(change) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(change.productId)) throw new Error('Invalid product ID');
  const prefix = `/products/${change.productId}/`;
  if (!change.path?.startsWith(prefix) || !permittedField.test(change.path.slice(prefix.length))) {
    throw new Error(`Non-copy or invalid path: ${change.path}`);
  }
  return change.path.slice(1).split('/');
}

export function readPath(document, change) {
  return partsFor(change).reduce((value, key) => {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) {
      throw new Error(`Missing field: ${change.path}`);
    }
    return value[key];
  }, document);
}

export function setPath(document, change, value) {
  readPath(document, change);
  const keys = partsFor(change);
  const key = keys.pop();
  keys.reduce((node, part) => node[part], document)[key] = value;
}

export function validateOverlay(overlay) {
  if (overlay.schemaVersion !== 1 || !Array.isArray(overlay.changes) || !overlay.changes.length) {
    throw new Error('Unsupported or empty overlay');
  }
  const paths = new Set();
  const ids = new Set();
  const changeIds = new Set();
  for (const change of overlay.changes) {
    const parts = partsFor(change).slice(2);
    const fieldPath = parts.map((part, i) => /^\d+$/.test(part) ? `[${part}]` : `${i ? '.' : ''}${part}`).join('');
    if (change.fieldPath !== fieldPath) throw new Error(`Mismatched fieldPath: ${change.path}`);
    if (paths.has(change.path) || changeIds.has(change.changeId)) throw new Error(`Duplicate change: ${change.path}`);
    if (!change.changeId || typeof change.before !== 'string' || typeof change.after !== 'string' || change.before === change.after) {
      throw new Error(`Invalid string change: ${change.path}`);
    }
    if (!isDeepStrictEqual(numericTokens(change.before), numericTokens(change.after))) {
      throw new Error(`Numeric tokens changed: ${change.path}`);
    }
    if (!overlay.scope.original80ProductIds.includes(change.productId) || !overlay.scope.targetProductIds.includes(change.productId)) {
      throw new Error(`Out-of-scope model: ${change.productId}`);
    }
    paths.add(change.path);
    ids.add(change.productId);
    changeIds.add(change.changeId);
  }
  if (paths.size !== overlay.scope.counts.changedFields || ids.size !== overlay.scope.counts.targetedModels) {
    throw new Error('Overlay count mismatch');
  }
  if (!isDeepStrictEqual([...ids].sort(), [...overlay.scope.targetProductIds].sort()) ||
      !isDeepStrictEqual([...ids].sort(), Object.keys(overlay.identityGuards).sort())) {
    throw new Error('Target identity scope mismatch');
  }
  return { fields: paths.size, models: ids.size };
}

export function evaluateOverlay(document, overlay) {
  const counts = validateOverlay(overlay);
  const conflicts = [];
  const pending = [];
  const alreadyApplied = [];
  for (const [id, guard] of Object.entries(overlay.identityGuards)) {
    for (const [field, expected] of Object.entries(guard)) {
      if (document.products?.[id]?.[field] !== expected) conflicts.push(`${id}.${field}: identity differs`);
    }
  }
  for (const change of overlay.changes) {
    try {
      const actual = readPath(document, change);
      if (actual === change.before) pending.push(change);
      else if (actual === change.after) alreadyApplied.push(change.changeId);
      else conflicts.push(`${change.path}: neither exact before nor exact after`);
    } catch (error) { conflicts.push(error.message); }
  }
  if (conflicts.length) throw new Error(`No changes applied; ${conflicts.length} conflict(s):\n${conflicts.join('\n')}`);
  // Validate the whole patch first so a late conflict cannot leave a partial update.
  const result = structuredClone(document);
  for (const change of pending) setPath(result, change, change.after);
  return { document: result, counts, pending: pending.map(c => c.changeId), alreadyApplied };
}

export function runCli(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--input', '--overlay', '--output', '--apply', '--dry-run'].includes(key) || Object.hasOwn(options, key)) {
      throw new Error(`Unknown or duplicate option: ${key}`);
    }
    if (['--apply', '--dry-run'].includes(key)) options[key] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${key}`);
      options[key] = value;
    }
  }
  if (options['--apply'] && (options['--dry-run'] || options['--output'])) throw new Error('--apply cannot be combined with --dry-run or --output');
  if (options['--dry-run'] && options['--output']) throw new Error('--dry-run cannot write --output');
  if (options['--apply'] && !options['--input']) throw new Error('--apply requires an explicit --input path');
  const input = path.resolve(options['--input'] || path.join(root, 'data/line-page-products.json'));
  const overlayPath = path.resolve(options['--overlay'] || path.join(here, 'overlay.json'));
  const bytes = fs.readFileSync(input);
  const overlayBytes = fs.readFileSync(overlayPath);
  const evaluation = evaluateOverlay(JSON.parse(bytes), JSON.parse(overlayBytes));
  const output = options['--output'] ? path.resolve(options['--output']) : null;
  let writtenPath = null;
  if (output || (options['--apply'] && evaluation.pending.length)) {
    if (output === input || output === overlayPath || input === overlayPath) throw new Error('Input, output and overlay paths must be distinct');
    if (!bytes.equals(fs.readFileSync(input))) throw new Error('Input changed during validation; retry without overwriting concurrent work');
    const newline = bytes.includes(Buffer.from('\r\n')) ? '\r\n' : '\n';
    const serialized = `${JSON.stringify(evaluation.document, null, 2).replace(/\n/g, newline)}${newline}`;
    if (output) {
      fs.writeFileSync(output, serialized, { flag: 'wx' });
      writtenPath = output;
    } else {
      const temp = `${input}.copy-cleanup-${randomUUID()}.tmp`;
      try {
        fs.writeFileSync(temp, serialized, { flag: 'wx' });
        if (!bytes.equals(fs.readFileSync(input))) throw new Error('Input changed before replacement; no replacement made');
        fs.renameSync(temp, input);
        writtenPath = input;
      } finally {
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
      }
    }
  }
  return {
    mode: options['--apply'] ? 'apply' : output ? 'write-new-copy' : 'dry-run',
    input, inputSha256: sha256(bytes), overlaySha256: sha256(overlayBytes),
    ...evaluation.counts, pendingFields: evaluation.pending.length,
    alreadyAppliedFields: evaluation.alreadyApplied.length,
    conflicts: 0, writtenPath,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(runCli(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
