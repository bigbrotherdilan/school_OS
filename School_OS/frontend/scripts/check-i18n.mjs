#!/usr/bin/env node
// Scans src/**/*.{ts,tsx} for t('...') / t("...") keys and reports which keys
// are missing from each namespace catalog (en/<ns>.json).
// Usage: node scripts/check-i18n.mjs [namespace]
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'src');
const nsDir = join(src, 'i18n', 'en');
const onlyNs = process.argv[2];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(entry)) out.push(p);
  }
  return out;
}

function extractKeys(code) {
  const keys = new Set();
  const re = /\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    if (m[1] === '`') continue; // template literals handled manually
    keys.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return keys;
}

const catalogs = {};
for (const f of readdirSync(nsDir)) {
  if (f.endsWith('.json')) catalogs[f.replace('.json', '')] = JSON.parse(readFileSync(join(nsDir, f), 'utf8'));
}

let missingAny = false;
for (const file of walk(src)) {
  const code = readFileSync(file, 'utf8');
  const nsMatch = code.match(/useTranslation\(['"]([^'"]+)['"]\)/);
  if (!nsMatch) continue;
  const ns = nsMatch[1];
  if (onlyNs && ns !== onlyNs) continue;
  const cat = catalogs[ns];
  if (!cat) { console.log(`NO CATALOG for ns ${ns}`); continue; }
  const missing = [...extractKeys(code)].filter((k) => !(k in cat));
  if (missing.length) {
    missingAny = true;
    console.log(`\n${file.replace(root + '\\', '').replace(root + '/', '')} [${ns}] missing ${missing.length}:`);
    for (const k of missing) console.log(`  - ${k}`);
  }
}
console.log(missingAny ? '\nMISSING KEYS FOUND' : '\nAll t() keys are present in catalogs.');
process.exit(missingAny ? 1 : 0);