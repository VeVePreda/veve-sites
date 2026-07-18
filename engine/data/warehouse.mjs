// Accès à l'entrepôt de données jetonveve.
// Lit les releases publiques (CSV.gz par URL). Repli automatique sur la
// release N-1 (`-prev`), puis sur un échantillon local (build hors-ligne).
import { gunzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const SAMPLE_DIR = join(ROOT, 'engine', 'data', 'sample');
const REPO = process.env.WAREHOUSE_REPO || 'fanablefrance/jetonveve';
const OFFLINE = process.env.WAREHOUSE_OFFLINE === '1';
const base = (tag, file) => `https://github.com/${REPO}/releases/download/${tag}/${file}`;

const SOURCES = {
  catalogue: {
    url: process.env.CATALOGUE_URL || base('catalogue', 'catalogue.csv.gz'),
    prev: base('catalogue-prev', 'catalogue.csv.gz'),
    sample: 'catalogue.csv',
  },
  prices: {
    url: process.env.PRICES_URL || base('prices-full', 'prices.csv.gz'),
    prev: base('prices-full-prev', 'prices.csv.gz'),
    sample: 'prices.csv',
  },
  baselines: {
    url: process.env.BASELINES_URL || base('prices-full', 'prices_baselines.csv.gz'),
    prev: base('prices-full-prev', 'prices_baselines.csv.gz'),
    sample: 'prices_baselines.csv',
  },
};

export function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}

async function fetchTable(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = url.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  return parseCSV(text);
}

function readSample(file) {
  const p = join(SAMPLE_DIR, file);
  if (!existsSync(p)) return [];
  return parseCSV(readFileSync(p, 'utf8'));
}

const cache = new Map();

export async function load(name) {
  if (cache.has(name)) return cache.get(name);
  const src = SOURCES[name];
  if (!src) throw new Error(`source inconnue: ${name}`);
  let rows = null;
  if (!OFFLINE) {
    for (const url of [src.url, src.prev]) {
      try {
        rows = await fetchTable(url);
        if (rows.length) { console.log(`[entrepot] ${name}: ${rows.length} lignes depuis ${url}`); break; }
      } catch (e) {
        console.warn(`[entrepot] ${name}: echec ${url} (${e.message})`);
        rows = null;
      }
    }
  }
  if (!rows || !rows.length) {
    rows = readSample(src.sample);
    console.log(`[entrepot] ${name}: ECHANTILLON local (${rows.length} lignes)`);
  }
  cache.set(name, rows);
  return rows;
}

export const getCatalogue = () => load('catalogue');
export const getPrices = () => load('prices');
export const getBaselines = () => load('baselines');
