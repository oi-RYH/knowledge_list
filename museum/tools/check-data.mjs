#!/usr/bin/env node
// Checks the exhibit data against the knowledge records.
//   node museum/tools/check-data.mjs [dir with TECH_KNOWLEDGE.md and WORKFLOW_KNOWLEDGE.md]
// Lists items that still have no Korean entry or no quiz question, and entries that match nothing.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExhibit, keyOf, parseRecords } from '../js/data.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const dir = resolve(process.argv[2] || root);
const read = (p) => readFileSync(p, 'utf8');

const tech = parseRecords(read(join(dir, 'TECH_KNOWLEDGE.md')));
const workflow = parseRecords(read(join(dir, 'WORKFLOW_KNOWLEDGE.md')));
const lexicon = JSON.parse(read(join(root, 'museum', 'data', 'exhibit.ko.json')));
const exhibit = buildExhibit(tech, workflow, lexicon);

const count = (kind, status) => exhibit.items.filter((i) => i.kind === kind && (!status || i.status === status)).length;
console.log(`records: ${dir}`);
for (const kind of ['tech', 'workflow']) {
  console.log(`  ${kind}: ${count(kind)} items  (known ${count(kind, 'known')}, familiar ${count(kind, 'familiar')}, ` +
    `unlearned ${count(kind, 'unlearned')}, unreviewed ${count(kind, 'unreviewed')})`);
}

let problems = 0;
const report = (title, list) => {
  if (!list.length) return;
  problems += list.length;
  console.log(`\n${title}`);
  for (const line of list) console.log(`  - ${line}`);
};

report('No Korean entry (shown in English, not quizzed):', exhibit.missing);
report('No quiz question:', exhibit.items.filter((i) => !i.quiz.length && !exhibit.missing.includes(`${i.kind}: ${i.name}`)).map((i) => `${i.kind}: ${i.name}`));
report('No Korean category name:', [...new Set(exhibit.items.filter((i) => i.categoryLabel === i.category).map((i) => i.category))]);

for (const kind of ['tech', 'workflow']) {
  const used = new Set(exhibit.items.filter((i) => i.kind === kind).map((i) => i.id.slice(kind.length + 1)));
  const unused = Object.keys(lexicon[kind] || {}).filter((name) => !used.has(keyOf(name)));
  if (unused.length) console.log(`\n${kind} entries with no matching record (kept for records not pushed yet): ${unused.length}`);
}

const bad = [];
for (const kind of ['tech', 'workflow']) {
  for (const [name, e] of Object.entries(lexicon[kind] || {})) {
    if (!e.ko || !e.note) bad.push(`${kind}: ${name} (needs ko and note)`);
    for (const q of e.quiz || []) {
      if (!q.q || !Array.isArray(q.o) || q.o.length < 2 || !Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length) bad.push(`${kind}: ${name} (malformed quiz)`);
      else if (new Set(q.o).size !== q.o.length) bad.push(`${kind}: ${name} (duplicate choices)`);
    }
  }
}
report('Malformed entries:', bad);

console.log(problems ? `\n${problems} thing(s) to look at.` : '\nAll records have a Korean entry and a quiz question.');
process.exit(bad.length ? 1 : 0);
