// Modele de donnees du site.
// REGLES (spec v3) :
//  - on ne publie QUE des fiches utiles (seuil de releves)
//  - l'historique public est tronque AU NIVEAU DE LA DONNEE
//  - les variations ne sont calculees que si elles ont un sens statistique
//  - l'historique des prix est lu EN FLUX : la memoire ne depend pas de la
//    taille du fichier, qui grandit indefiniment avec le backfill.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCatalogue, getBaselines, streamPrices } from '../data/warehouse.mjs';
import { manifest, SITE } from './manifest.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DAY = 86400000;

export const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

function pctChange(hist, days, o) {
  if (hist.length < o.minPoints) return null;
  const last = hist[hist.length - 1];
  if (!last || !last.floor) return null;
  const cutoff = Date.now() - days * DAY;
  let ref = null;
  for (const p of hist) { if (new Date(p.ts).getTime() <= cutoff) ref = p; }
  if (!ref || !ref.floor || ref.floor < o.minRef) return null;
  const v = ((last.floor - ref.floor) / ref.floor) * 100;
  if (!Number.isFinite(v) || Math.abs(v) > o.maxAbs) return null;
  return v;
}

let _ds = null;
export async function dataset() {
  if (_ds) return _ds;
  const m = manifest();
  const pub = m.publication || {};
  const MIN_POINTS = pub.min_price_points ?? 8;
  const MAX_POINTS = pub.public_points_max ?? 30;
  const MAX_ITEMS = pub.max_items ?? 0;
  const WINDOW_DAYS = pub.public_history_days ?? 90;
  const CHANGE = { minPoints: 5, minRef: 1, maxAbs: 300 };
  const TAIL = MAX_POINTS + 5;

  const [cat, baselines] = await Promise.all([getCatalogue(), getBaselines()]);

  // --- Agregation EN FLUX -------------------------------------------------
  // Par item on ne retient que : le nombre total de releves, la date du
  // premier, et une courte queue des derniers points. La memoire depend du
  // nombre d'items (~19 000), JAMAIS de la taille du fichier de prix.
  const known = new Set();
  for (const c of cat) { const u = c.uuid || c.veve_uuid; if (u) known.add(u); }
  const agg = new Map();
  await streamPrices((cols, idx) => {
    const u = cols[idx.uuid];
    if (!u || !known.has(u)) return;   // on ignore ce qui n'est pas au catalogue
    const f = Number(cols[idx.floor]);
    if (!Number.isFinite(f)) return;
    const ts = cols[idx.ts];
    let a = agg.get(u);
    if (!a) { a = { n: 0, first: ts, tail: [] }; agg.set(u, a); }
    a.n++;
    if (ts < a.first) a.first = ts;
    a.tail.push({ ts, floor: f, listings: Number(cols[idx.listings]) || 0 });
    if (a.tail.length > TAIL) a.tail.shift();
  });

  const bl = new Map();
  for (const b of baselines) bl.set(b.veve_uuid || b.uuid, b);

  const pinPath = join(ROOT, 'sites', SITE, 'slugs.json');
  let pinned = {};
  if (existsSync(pinPath)) { try { pinned = JSON.parse(readFileSync(pinPath, 'utf8')); } catch {} }

  const cutoff = Date.now() - WINDOW_DAYS * DAY;
  const publicSlice = (tail) => {
    const t = tail.slice(-MAX_POINTS);
    const recent = t.filter((p) => new Date(p.ts).getTime() >= cutoff);
    return recent.length >= 5 ? recent : t;
  };

  const candidates = [];
  for (const c of cat) {
    const uuid = c.uuid || c.veve_uuid;
    if (!uuid) continue;
    const a = agg.get(uuid);
    if (!a || a.n < MIN_POINTS) continue;               // <<< SEUIL : pas de page creuse
    const tail = [...a.tail].sort((x, y) => String(x.ts).localeCompare(String(y.ts)));
    const publicHist = publicSlice(tail);
    if (publicHist.length < 2) continue;                 // courbe illisible = pas de page
    const b = bl.get(uuid) || {};
    candidates.push({
      uuid,
      name: c.name || 'Sans nom',
      kind: c.kind || 'collectible',
      rarity: c.rarity || '',
      series: c.series || '',
      brand: c.brand || '',
      licensor: c.licensor || '',
      releaseDate: c.release_date || '',
      tirage: num(c.tirage),
      storePrice: num(c.store_price),
      floor: num(c.floor) ?? publicHist[publicHist.length - 1].floor,
      listings: num(c.listings) ?? publicHist[publicHist.length - 1].listings,
      ath: num(c.ath) ?? num(b.floor_max),
      atl: num(c.atl) ?? num(b.floor_min),
      history: publicHist,
      points: publicHist.length,
      totalPoints: a.n,
      since: a.first,
      change7d: pctChange(publicHist, 7, CHANGE),
      change30d: pctChange(publicHist, 30, CHANGE),
    });
  }
  agg.clear();                                           // on libere tout de suite

  candidates.sort((a, b) => b.points - a.points || String(a.name).localeCompare(String(b.name)));
  const items = MAX_ITEMS > 0 ? candidates.slice(0, MAX_ITEMS) : candidates;

  const seen = new Set();
  for (const i of items) {
    let s = pinned[i.uuid] || slugify(i.name);
    if (seen.has(s)) s = `${s}-${String(i.uuid).replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase()}`;
    seen.add(s);
    i.slug = s;
  }

  const bySlug = new Map(items.map((i) => [i.slug, i]));
  const collections = new Map();
  for (const i of items) {
    if (!i.series) continue;
    const s = slugify(i.series);
    if (!collections.has(s)) collections.set(s, { slug: s, name: i.series, brand: i.brand, items: [] });
    collections.get(s).items.push(i);
  }
  const rarities = new Map();
  for (const i of items) {
    if (!i.rarity) continue;
    const s = slugify(i.rarity);
    if (!rarities.has(s)) rarities.set(s, { slug: s, name: i.rarity, items: [] });
    rarities.get(s).items.push(i);
  }

  const withChange = items.filter((i) => i.change7d !== null);
  const movers = {
    up: [...withChange].filter((i) => i.change7d > 0).sort((a, b) => b.change7d - a.change7d).slice(0, 20),
    down: [...withChange].filter((i) => i.change7d < 0).sort((a, b) => a.change7d - b.change7d).slice(0, 20),
  };

  console.log(`[site] ${items.length} fiches publiees sur ${cat.length} items du catalogue (seuil ${MIN_POINTS} releves, ${MAX_POINTS} exposes max)`);

  _ds = { items, bySlug, collections, rarities, movers, catalogueSize: cat.length, windowDays: WINDOW_DAYS, maxPoints: MAX_POINTS, updatedAt: new Date().toISOString() };
  return _ds;
}
