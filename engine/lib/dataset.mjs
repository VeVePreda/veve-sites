// Modele de donnees du site.
// REGLES DE PROTECTION (spec v3) :
//  - on ne publie QUE des fiches utiles (seuil de relevés dans la fenetre publique)
//  - l'historique public est tronque AU NIVEAU DE LA DONNEE (rien d'ancien n'entre dans la page)
//  - les variations ne sont calculees que si elles ont un sens statistique
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCatalogue, getPrices, getBaselines } from '../data/warehouse.mjs';
import { manifest, SITE } from './manifest.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DAY = 86400000;

export const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Variation en % : null si la donnee ne permet pas une lecture honnete.
function pctChange(hist, days, o) {
  if (hist.length < o.minPoints) return null;
  const last = hist[hist.length - 1];
  if (!last || !last.floor) return null;
  const cutoff = Date.now() - days * DAY;
  let ref = null;
  for (const p of hist) { if (new Date(p.ts).getTime() <= cutoff) ref = p; }
  if (!ref || !ref.floor || ref.floor < o.minRef) return null;   // pas de reference significative
  const v = ((last.floor - ref.floor) / ref.floor) * 100;
  if (!Number.isFinite(v) || Math.abs(v) > o.maxAbs) return null; // aberration = manque de donnees
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

  const [cat, prices, baselines] = await Promise.all([getCatalogue(), getPrices(), getBaselines()]);

  // Historique complet (interne uniquement, jamais rendu tel quel)
  const hist = new Map();
  for (const r of prices) {
    const u = r.veve_uuid || r.uuid;
    const f = num(r.floor);
    if (!u || f === null) continue;
    if (!hist.has(u)) hist.set(u, []);
    hist.get(u).push({ ts: r.ts_utc || r.ts, floor: f, listings: num(r.listings) ?? 0 });
  }
  for (const arr of hist.values()) arr.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  const bl = new Map();
  for (const b of baselines) bl.set(b.veve_uuid || b.uuid, b);

  // Slugs figes : un item renomme chez VeVe ne doit JAMAIS changer d'adresse.
  const pinPath = join(ROOT, 'sites', SITE, 'slugs.json');
  let pinned = {};
  if (existsSync(pinPath)) { try { pinned = JSON.parse(readFileSync(pinPath, 'utf8')); } catch {} }

  const cutoff = Date.now() - WINDOW_DAYS * DAY;
  // Tranche publique : au plus MAX_POINTS releves, en privilegiant la fenetre recente
  // tant qu'elle laisse une courbe lisible. Le reste de l'historique ne quitte jamais le build.
  const publicSlice = (full) => {
    const tail = full.slice(-MAX_POINTS);
    const recent = tail.filter((p) => new Date(p.ts).getTime() >= cutoff);
    return recent.length >= 5 ? recent : tail;
  };
  const candidates = [];
  for (const c of cat) {
    const uuid = c.uuid || c.veve_uuid;
    if (!uuid) continue;
    const full = hist.get(uuid) || [];
    if (full.length < MIN_POINTS) continue;                   // <<< SEUIL : pas de page creuse
    const publicHist = publicSlice(full);
    if (publicHist.length < 2) continue;                      // courbe illisible = pas de page
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
      history: publicHist,                                    // <<< TRONQUE : 90 jours
      points: publicHist.length,
      totalPoints: full.length,                               // teaser : on montre le NOMBRE
      since: full.length ? full[0].ts : null,                 // ... et la profondeur
      change7d: pctChange(publicHist, 7, CHANGE),
      change30d: pctChange(publicHist, 30, CHANGE),
    });
  }

  // Vitrine : les mieux documentes d'abord
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

  _ds = {
    items, bySlug, collections, rarities, movers,
    catalogueSize: cat.length,
    windowDays: WINDOW_DAYS,
    maxPoints: MAX_POINTS,
    updatedAt: new Date().toISOString(),
  };
  return _ds;
}
