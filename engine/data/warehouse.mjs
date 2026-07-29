// ⚠️ DEPOT : VeVePreda/veve-sites  ·  CHEMIN : engine/data/warehouse.mjs
//
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

// ===========================================================================
// ⭐⭐ LE REPLI N-1 NE PASSE PLUS EN SILENCE  (A3, 29/07/2026)
// ===========================================================================
// Il y avait DEUX replis muets dans ce fichier, pas un : `load()` (catalogue,
// baselines) et `streamPrices` (prix). Tous deux parcourent `[url, prev]` et
// se contentaient d'un `console.warn` sur l'echec de la fraiche : la lecture
// sur la release N-1 reussissait, le build restait VERT, et rien ne disait
// que le site venait d'etre construit sur l'identite de la veille.
//
// ⭐ La nuance qui fait tout : ce repli n'est PAS un defaut partout.
//    · `rebuild-daily`  -> reconstruire sur des donnees d'hier est un
//      comportement degrade ACCEPTABLE : demain rattrape.
//    · `freeze-slugs`   -> le gel est IRREVERSIBLE. Geler les adresses sur
//      `catalogue-prev` grave A VIE l'identite d'AVANT l'uniformisation.
//      Ce n'est pas degrade, c'est definitif.
//
// D'ou la forme : le repli CRIE toujours, et il n'est FATAL que la ou
// l'appelant le demande (`WAREHOUSE_REFUSE_PREV=1`). Un garde-fou qui casse
// tout casse aussi ce qu'il fallait laisser passer, et on finit par le
// desarmer -- voir D3 du plan.
const REFUSE_PREV = process.env.WAREHOUSE_REFUSE_PREV === '1';

// ⭐ Un marqueur LITTERAL et unique. `freeze-slugs.yml` greppait
// `catalogue-prev`, c'est-a-dire un fragment d'URL : ca ne couvrait ni les
// prix ni les baselines, et ca cassait au premier renommage de release.
export const MARQUEUR_REPLI = '[entrepot][REPLI-N-1]';

const REPLIS = [];
/** Les replis N-1 subis depuis le demarrage du process. */
export const getReplis = () => REPLIS.slice();
/** Remise a zero — pour les bancs de test uniquement. */
export const _resetReplis = () => { REPLIS.length = 0; };

function noterRepli(name, url) {
  if (!REPLIS.some((r) => r.source === name)) REPLIS.push({ source: name, url });
  console.warn(`${MARQUEUR_REPLI} ${name} : source fraiche injoignable, LU SUR LA RELEASE N-1 ${url}`);
  // Annotation GitHub Actions : visible dans le resume du run, pas seulement
  // noyee dans 3 000 lignes de log.
  console.warn(`::warning title=Entrepot en repli N-1::${name} a ete lu sur la release N-1 (${url}). Les donnees ont un jour de retard.`);
  if (REFUSE_PREV) {
    throw new Error(
      `${MARQUEUR_REPLI} ${name} : repli sur la release N-1 REFUSE (WAREHOUSE_REFUSE_PREV=1). ` +
      `Cette etape ecrit quelque chose d'irreversible : elle exige la source fraiche. ` +
      `Relancer quand ${SOURCES[name] ? SOURCES[name].url : name} sera de nouveau joignable.`);
  }
}

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
  // ⭐ On retient le RANG lu, pas l'URL : `CATALOGUE_URL` peut surcharger la
  // fraiche, et comparer deux chaines aurait rate le cas ou la surcharge
  // pointe deja la release N-1.
  let rangLu = -1;
  if (!OFFLINE) {
    const urls = [src.url, src.prev];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        rows = await fetchTable(url);
        if (rows.length) {
          rangLu = i;
          console.log(`[entrepot] ${name}: ${rows.length} lignes depuis ${url}`);
          break;
        }
      } catch (e) {
        console.warn(`[entrepot] ${name}: echec ${url} (${e.message})`);
        rows = null;
      }
    }
    // ⛔⛔ HORS du try/catch, et c'est le cœur du correctif. Appele a
    // l'interieur, le `throw` de `noterRepli()` serait avale par le `catch`
    // ci-dessus, relu comme « echec de la release N-1 » — et le refus se
    // serait transforme en un repli de plus, silencieux lui aussi.
    if (rangLu > 0) noterRepli(name, urls[rangLu]);
  }
  if (!rows || !rows.length) {
    // Le repli sur l'echantillon n'est autorise QUE si on l'a demande
    // explicitement. Sinon on echoue : publier de fausses donnees serait
    // pire que de laisser en ligne la version precedente.
    if (!OFFLINE && process.env.ALLOW_SAMPLE !== '1') {
      throw new Error(
        `[entrepot] ${name} : source ET secours N-1 injoignables. ` +
        `Build interrompu volontairement pour ne pas publier de donnees d'exemple.`);
    }
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
    const urls = [src.url, src.prev];
    let rangLu = -1;
    let lues = 0;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let stream = Readable.fromWeb(res.body);
        if (url.endsWith('.gz')) stream = stream.pipe(createGunzip());
        lues = await consumeStream(stream, onRow);
        rangLu = i;
        console.log(`[entrepot] prix : ${lues} lignes lues EN FLUX depuis ${url}`);
        break;
      } catch (e) {
        console.warn(`[entrepot] prix : echec ${url} (${e.message})`);
      }
    }
    // ⛔ Meme piege qu'au-dessus : le `return` etait DANS le `try`, donc toute
    // annonce posee la aurait ete avalee par le `catch`. On sort d'abord.
    if (rangLu >= 0) {
      if (rangLu > 0) noterRepli('prices', urls[rangLu]);
      return lues;
    }
  }
  if (!OFFLINE && process.env.ALLOW_SAMPLE !== '1') {
    throw new Error('[entrepot] prix : source ET secours N-1 injoignables. Build interrompu volontairement.');
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
