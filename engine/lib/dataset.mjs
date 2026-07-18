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
  // Sans releve RECENT, la variation est inconnue - pas nulle. Afficher
  // « 0,0 % » ferait croire a une stabilite qui n'a jamais ete mesuree.
  if (new Date(last.ts).getTime() < cutoff) return null;
  let ref = null;
  for (const p of hist) { if (new Date(p.ts).getTime() <= cutoff) ref = p; }
  if (!ref || ref.ts === last.ts) return null;          // une seule et meme mesure
  if (!ref.floor || ref.floor < o.minRef) return null;
  const v = ((last.floor - ref.floor) / ref.floor) * 100;
  if (!Number.isFinite(v) || Math.abs(v) > o.maxAbs) return null;
  return v;
}

let _ds = null;
// Le vocabulaire du champ « kind » du catalogue n'est pas garanti : on a vu
// des comics evidents classes ailleurs. On accepte donc toute variante
// contenant « comic » (comic, comics, comic_book, Comic...), sans casse.
function estComic(kind) {
  return /comic/i.test(String(kind || ''));
}

// SECRET_RARE -> Secret Rare
function jolieRarete(r) {
  return String(r).toLowerCase().split(/[_\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// ⚠️ MEMOISER LA PROMESSE, PAS LE RESULTAT.
// 18 fichiers de route appellent dataset() et Astro les evalue EN PARALLELE.
// Si l'on ne memorise qu'a la fin (apres le telechargement et la lecture en
// flux), chaque appel voit encore null et relance un flux complet du fichier
// de prix : 18 lectures simultanees de centaines de Mo = build a genoux.
// Invisible sur l'echantillon, fatal sur les vraies donnees.
let _promesse = null;
export function dataset() {
  if (!_promesse) _promesse = construireDataset();
  return _promesse;
}

async function construireDataset() {
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
  const cutoffTs = Date.now() - WINDOW_DAYS * DAY;
  const BUCKET_MS = Math.max(1, Math.floor((WINDOW_DAYS / MAX_POINTS) * DAY));
  const agg = new Map();
  await streamPrices((cols, idx) => {
    const u = cols[idx.uuid];
    if (!u || !known.has(u)) return;   // on ignore ce qui n'est pas au catalogue
    const f = Number(cols[idx.floor]);
    if (!Number.isFinite(f)) return;
    const ts = cols[idx.ts];
    let a = agg.get(u);
    if (!a) { a = { n: 0, first: ts, buckets: new Map(), tail: [] }; agg.set(u, a); }
    a.n++;
    if (ts < a.first) a.first = ts;
    const pt = { ts, floor: f, listings: Number(cols[idx.listings]) || 0 };
    // repli : les tout derniers releves, quel que soit leur age (les prix sont
    // enregistres AU CHANGEMENT : un item stable n'a rien de recent).
    a.tail.push(pt);
    if (a.tail.length > 5) a.tail.shift();
    // courbe publique : un point par tranche, etale sur la fenetre.
    const t = new Date(ts).getTime();
    if (Number.isFinite(t) && t >= cutoffTs) {
      a.buckets.set(Math.floor(t / BUCKET_MS), pt);
      if (a.buckets.size > MAX_POINTS) a.buckets.delete(Math.min(...a.buckets.keys()));
    }
  });

  const bl = new Map();
  for (const b of baselines) bl.set(b.veve_uuid || b.uuid, b);

  const pinPath = join(ROOT, 'sites', SITE, 'slugs.json');
  let pinned = {};
  if (existsSync(pinPath)) { try { pinned = JSON.parse(readFileSync(pinPath, 'utf8')); } catch {} }

  const candidates = [];
  for (const c of cat) {
    const uuid = c.uuid || c.veve_uuid;
    if (!uuid) continue;
    const a = agg.get(uuid);
    if (!a || a.n < MIN_POINTS) continue;               // <<< SEUIL : pas de page creuse
    const byTs = (x, y) => String(x.ts).localeCompare(String(y.ts));
    const spread = [...a.buckets.values()].sort(byTs);
    const publicHist = spread.length >= 2 ? spread : [...a.tail].sort(byTs);
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

  // Desambiguisation des noms : on ajoute la rarete UNIQUEMENT aux collectibles
  // dont le couple (nom, collection) est partage. Un titre doit etre unique.
  const cles = new Map();
  for (const c of candidates) {
    const k = `${c.name}|${c.series}`;
    cles.set(k, (cles.get(k) || 0) + 1);
  }
  for (const c of candidates) {
    const k = `${c.name}|${c.series}`;
    c.ambigu = cles.get(k) > 1;
    c.qualifie = c.ambigu && c.rarity ? `${c.name} · ${jolieRarete(c.rarity)}` : c.name;
  }
  // Deuxieme passe : si le nom qualifie reste ambigu (meme nom, meme collection,
  // meme rarete), on ajoute le tirage, puis en dernier recours un rang. On veut
  // une garantie d'unicite PAR CONSTRUCTION, pas une esperance.
  const cles2 = new Map();
  for (const c of candidates) {
    const k = `${c.qualifie}|${c.series}`;
    cles2.set(k, (cles2.get(k) || 0) + 1);
  }
  const rangs = new Map();
  for (const c of candidates) {
    const k = `${c.qualifie}|${c.series}`;
    if (cles2.get(k) <= 1) continue;
    const r = (rangs.get(k) || 0) + 1;
    rangs.set(k, r);
    c.qualifie = c.tirage ? `${c.qualifie} · ${c.tirage}` : `${c.qualifie} · ${r}`;
  }
  // Le tirage peut lui aussi etre identique : on tranche definitivement.
  const vus = new Set();
  for (const c of candidates) {
    let q = `${c.qualifie}|${c.series}`;
    if (!vus.has(q)) { vus.add(q); continue; }
    let i = 2;
    while (vus.has(`${c.qualifie} (${i})|${c.series}`)) i += 1;
    c.qualifie = `${c.qualifie} (${i})`;
    vus.add(`${c.qualifie}|${c.series}`);
  }

  candidates.sort((a, b) => b.totalPoints - a.totalPoints || String(a.name).localeCompare(String(b.name)));
  // ENSEMBLE PUBLIE COLLANT : une fiche deja publiee (donc presente dans
  // slugs.json) le reste. Seules les nouvelles venues sont plafonnees.
  const dejaPublie = candidates.filter((c) => pinned[c.uuid]);
  const nouvelles = candidates.filter((c) => !pinned[c.uuid]);
  const place = MAX_ITEMS > 0 ? Math.max(0, MAX_ITEMS - dejaPublie.length) : nouvelles.length;
  const items = [...dejaPublie, ...nouvelles.slice(0, place)];

  // ═══ ADRESSES ═══
  // Hierarchie par type (decision Preda 18/07) :
  //   collectibles : /collectible/<serie>/<nom>/
  //   comics       : /comic/<serie>/<rarete>/   <- chez les comics le nom
  //                  recopie souvent la serie ; la rarete est le vrai
  //                  discriminant (une serie = plusieurs couvertures).
  // L'attribution est DETERMINISTE et independante des donnees de prix : on
  // parcourt par uuid (immuable), jamais par classement. Sinon l'adresse
  // /item/batgirl/ change d'objet d'un jour a l'autre (constate en prod).
  const seen = new Set();
  const ordreStable = [...items].sort((a, b) => {
    const pa = pinned[a.uuid] ? 0 : 1;
    const pb = pinned[b.uuid] ? 0 : 1;
    return pa - pb || String(a.uuid).localeCompare(String(b.uuid));
  });
  const suffixeUuid = (u) => String(u).replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
  for (const i of ordreStable) {
    i.racine = estComic(i.kind) ? 'comic' : 'collectible';
    i.serieSlug = slugify(i.series) || 'sans-collection';
    i.legacySlug = slugify(i.name);
    if (pinned[i.uuid]) { i.path = pinned[i.uuid]; seen.add(i.path); continue; }
    // Feuille des comics : reglable au manifeste (urls.comic_leaf).
    //  'rarity' (defaut, choix Preda) -> /comic/alias-1-2001/secret-rare/
    //  'name'                          -> /comic/<serie>/<nom de la couverture>/
    // Utile car certaines series de comics ont des noms de couverture tres
    // parlants ("Bill Sienkiewicz Original Main Cover") qu'on perd avec la rarete.
    const feuilleComic = (pub.comic_leaf || 'rarity') === 'name' ? i.legacySlug : slugify(i.rarity);
    const principal = i.racine === 'comic' ? (feuilleComic || i.legacySlug) : i.legacySlug;
    // Repli en cas de collision : pour un comic, ajouter le nom serait redondant
    // (il recopie souvent la serie) -> on prend l'autre attribut, puis l'uuid.
    // Repli en cas de collision. Pour un comic, ajouter le nom serait redondant
    // (il recopie souvent la serie) : on prend directement l'identifiant court.
    const secours = i.racine === 'comic'
      ? `${principal}-${suffixeUuid(i.uuid)}`
      : `${i.legacySlug}-${slugify(i.rarity) || 'edition'}`;
    let feuille = principal || 'sans-nom';
    if (seen.has(`/${i.racine}/${i.serieSlug}/${feuille}/`)) feuille = secours;
    if (seen.has(`/${i.racine}/${i.serieSlug}/${feuille}/`)) feuille = `${principal}-${suffixeUuid(i.uuid)}`;
    i.path = `/${i.racine}/${i.serieSlug}/${feuille}/`;
    seen.add(i.path);
  }

  const bySlug = new Map(items.map((i) => [i.path, i]));
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

  console.log(`[site] ${items.length} fiches publiees (${dejaPublie.length} deja connues + ${items.length - dejaPublie.length} nouvelles) sur ${cat.length} items du catalogue`);

  _ds = { items, bySlug, collections, rarities, movers, catalogueSize: cat.length, windowDays: WINDOW_DAYS, maxPoints: MAX_POINTS, updatedAt: new Date().toISOString() };
  const parType = {};
  for (const c of cat) { const k = String(c.kind || '(vide)'); parType[k] = (parType[k] || 0) + 1; }
  console.log(`[entrepot] valeurs du champ kind dans le catalogue : ${JSON.stringify(parType)}`);
  const parRacine = {};
  for (const i of items) parRacine[i.racine] = (parRacine[i.racine] || 0) + 1;
  console.log(`[entrepot] jeu de donnees construit : ${items.length} fiches publiees ${JSON.stringify(parRacine)}`);
  return _ds;
}
