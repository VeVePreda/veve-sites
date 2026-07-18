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


// --- Lecture EN FLUX de l'historique des prix -------------------------------
// Ce fichier grandit sans limite (append-on-change sur 18 900 items) : le
// charger en entier fait exploser la memoire du build. On le traite donc
// ligne par ligne, et l'appelant ne garde que ce dont il a besoin.
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';

async function consumeStream(stream, onRow) {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let idx = null;
  let n = 0;
  for await (const line of rl) {
    if (!line) continue;
    const cols = line.split(',');
    if (idx === null) {
      const h = cols.map((c) => c.trim());
      idx = {
        uuid: h.indexOf('veve_uuid') >= 0 ? h.indexOf('veve_uuid') : h.indexOf('uuid'),
        ts: h.indexOf('ts_utc') >= 0 ? h.indexOf('ts_utc') : h.indexOf('ts'),
        floor: h.indexOf('floor'),
        listings: h.indexOf('listings'),
      };
      continue;
    }
    onRow(cols, idx);
    n++;
  }
  return n;
}

export async function streamPrices(onRow) {
  const src = SOURCES.prices;
  if (!OFFLINE) {
    for (const url of [src.url, src.prev]) {
      try {
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let stream = Readable.fromWeb(res.body);
        if (url.endsWith('.gz')) stream = stream.pipe(createGunzip());
        const n = await consumeStream(stream, onRow);
        console.log(`[entrepot] prix : ${n} lignes lues EN FLUX depuis ${url}`);
        return n;
      } catch (e) {
        console.warn(`[entrepot] prix : echec ${url} (${e.message})`);
      }
    }
  }
  const p = join(SAMPLE_DIR, src.sample);
  if (existsSync(p)) {
    const n = await consumeStream(createReadStream(p), onRow);
    console.log(`[entrepot] prix : ECHANTILLON local (${n} lignes, en flux)`);
    return n;
  }
  console.warn('[entrepot] prix : aucune source disponible');
  return 0;
}

export const getCatalogue = () => load('catalogue');
export const getBaselines = () => load('baselines');
