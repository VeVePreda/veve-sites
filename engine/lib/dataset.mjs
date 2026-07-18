// Construit le modele de donnees du site a partir de l'entrepot.
import { getCatalogue, getPrices, getBaselines } from '../data/warehouse.mjs';

export const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

function pctChange(hist, days) {
  if (!hist.length) return null;
  const last = hist[hist.length - 1];
  const cutoff = Date.now() - days * 86400000;
  let ref = null;
  for (const p of hist) { if (new Date(p.ts).getTime() <= cutoff) ref = p; }
  if (!ref || !ref.floor || !last.floor) return null;
  return ((last.floor - ref.floor) / ref.floor) * 100;
}

let _ds = null;
export async function dataset() {
  if (_ds) return _ds;
  const [cat, prices, baselines] = await Promise.all([getCatalogue(), getPrices(), getBaselines()]);

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

  const seen = new Set();
  const items = [];
  for (const c of cat) {
    const uuid = c.uuid || c.veve_uuid;
    if (!uuid) continue;
    const h = hist.get(uuid) || [];
    let slug = slugify(c.name);
    if (seen.has(slug)) slug = `${slug}-${String(uuid).replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase()}`;
    seen.add(slug);
    const b = bl.get(uuid) || {};
    items.push({
      uuid, slug,
      name: c.name || 'Sans nom',
      kind: c.kind || 'collectible',
      rarity: c.rarity || '',
      series: c.series || '',
      brand: c.brand || '',
      licensor: c.licensor || '',
      releaseDate: c.release_date || '',
      tirage: num(c.tirage),
      storePrice: num(c.store_price),
      floor: num(c.floor) ?? (h.length ? h[h.length - 1].floor : null),
      listings: num(c.listings) ?? (h.length ? h[h.length - 1].listings : null),
      ath: num(c.ath) ?? num(b.floor_max),
      atl: num(c.atl) ?? num(b.floor_min),
      p50: num(b.p50), p95: num(b.p95), p5: num(b.p5),
      points: h.length,
      history: h,
      change7d: pctChange(h, 7),
      change30d: pctChange(h, 30),
    });
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
    up: [...withChange].sort((a, b) => b.change7d - a.change7d).slice(0, 20),
    down: [...withChange].sort((a, b) => a.change7d - b.change7d).slice(0, 20),
  };

  _ds = { items, bySlug, collections, rarities, movers, updatedAt: new Date().toISOString() };
  return _ds;
}
