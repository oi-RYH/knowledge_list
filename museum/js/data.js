// Reads the knowledge records (Markdown tables) and joins them with the Korean exhibit data.
// Pure functions are exported separately so they can be checked from Node (see tools/check-data.mjs).

const STATUS_MARKS = [
  ['✅', 'known'],
  ['🟡', 'familiar'],
  ['⬜', 'unlearned'],
  ['❓', 'unreviewed'],
];

/** Normalised lookup key for an item name: no backticks, single spaces, lower case. */
export function keyOf(name) {
  return name.replace(/`/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function splitRow(line) {
  const cells = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Parse one record file.
 * @returns {{name: string, items: {name, status, added, confirmed, note}[]}[]} categories in file order
 */
export function parseRecords(markdown) {
  const categories = [];
  let current = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = { name: heading[1], items: [] };
      categories.push(current);
      continue;
    }
    if (!current || !line.startsWith('|')) continue;
    const cells = splitRow(line);
    if (cells.length < 2) continue;
    if (/^:?-{2,}:?$/.test(cells[0])) continue;                    // separator row
    const mark = STATUS_MARKS.find(([m]) => cells[1].includes(m));
    if (!mark) continue;                                            // header row or legend table
    current.items.push({
      name: cells[0],
      status: mark[1],
      added: isDate(cells[2] || '') ? cells[2] : null,
      confirmed: isDate(cells[3] || '') ? cells[3] : null,
      note: cells.slice(4).join(' | '),
    });
  }
  return categories.filter((c) => c.items.length > 0);
}

function indexLexicon(map) {
  const out = new Map();
  for (const [name, entry] of Object.entries(map || {})) out.set(keyOf(name), entry);
  return out;
}

function validQuiz(q) {
  return q && typeof q.q === 'string' && Array.isArray(q.o) && q.o.length >= 2 &&
    Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length;
}

/**
 * Join parsed records with the exhibit lexicon.
 * @returns {{wings: {kind, categories: {name, label, items: object[]}[]}[], items: object[], missing: string[]}}
 */
export function buildExhibit(techCategories, workflowCategories, lexicon = {}) {
  const labels = lexicon.categories || {};
  const lex = { tech: indexLexicon(lexicon.tech), workflow: indexLexicon(lexicon.workflow) };
  const items = [];
  const missing = [];
  const wings = [['tech', techCategories], ['workflow', workflowCategories]].map(([kind, categories]) => ({
    kind,
    categories: categories.map((cat) => ({
      name: cat.name,
      label: labels[cat.name] || cat.name,
      items: cat.items.map((rec) => {
        const key = keyOf(rec.name);
        const entry = lex[kind].get(key);
        if (!entry) missing.push(`${kind}: ${rec.name}`);
        const item = {
          id: `${kind}:${key}`,
          kind,
          category: cat.name,
          categoryLabel: labels[cat.name] || cat.name,
          name: rec.name.replace(/`/g, ''),
          title: entry?.ko || rec.name.replace(/`/g, ''),
          caption: entry?.note || rec.note,
          status: rec.status,
          added: rec.added,
          confirmed: rec.confirmed,
          quiz: (entry?.quiz || []).filter(validQuiz),
          index: items.length,
        };
        items.push(item);
        return item;
      }),
    })),
  }));
  return { wings, items, missing };
}

async function fetchFirst(urls, as) {
  let lastError;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return { value: await res[as](), url };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('no source');
}

/** Load everything the museum shows. Never throws for a missing lexicon; throws if no records load. */
export async function loadExhibit(sources) {
  const [tech, workflow, lexicon] = await Promise.all([
    fetchFirst(sources.tech, 'text'),
    fetchFirst(sources.workflow, 'text'),
    fetchFirst(sources.exhibit, 'json').catch(() => ({ value: {}, url: null })),
  ]);
  const exhibit = buildExhibit(parseRecords(tech.value), parseRecords(workflow.value), lexicon.value);
  exhibit.origin = { tech: tech.url, workflow: workflow.url, exhibit: lexicon.url };
  return exhibit;
}
