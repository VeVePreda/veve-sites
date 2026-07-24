// =============================================================================
//  editorial.mjs — le CONSOMMATEUR générique du contenu éditorial (tous sites)
//
//  ⚠️ CE FICHIER VA DANS LE DÉPÔT  VeVePreda/veve-sites , dans  engine/lib/
//     (chemin exact : engine/lib/editorial.mjs)
//
//  Étape 2 du constructeur générique (bible/architecture-generateur-sites.md).
//  Il charge les snapshots écrits par le récolteur `editorial_pull.py`
//  (sites/<SITE>/editorial/<page>.json) et les prépare pour les pages Astro :
//
//    • filtre `publie`             — une ligne FAUX est masquée ;
//    • PUBLICATION PROGRAMMÉE      — un item n'est rendu que si sa date
//                                    (`publish` blog, `date` jalon) ≤ date du
//                                    build ; vide = brouillon (blog) ;
//    • REPLI MULTILINGUE           — champs `x_en/x_fr/…` → langue demandée avec
//                                    repli EN, et JOURNAL « à traduire » ;
//    • COMPTEURS `*_auto`          — pour Brands, viennent de l'ENTREPÔT
//                                    (licence_agregats), JAMAIS du Sheet.
//
//  Règle d'or de non-duplication : toute logique réutilisable par un 2ᵉ site vit
//  ICI, jamais dans une page ni un script de site. Le code est le MÊME pour les
//  15 sites ; seul le manifeste change.
// =============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { manifest, SITE } from './manifest.mjs';
import { locales } from './i18n.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const EDITORIAL_DIR = join(ROOT, 'sites', SITE, 'editorial');

// -----------------------------------------------------------------------------
// Date du build (publication programmée). Le cron GitHub a +2-3 h de décalage :
// on raisonne au JOUR, pas à l'heure (« le jour J », pas « l'heure exacte »).
// Surchargée par BUILD_DATE (AAAA-MM-JJ) pour tester/rejouer.
// -----------------------------------------------------------------------------
function buildDay() {
  const raw = process.env.BUILD_DATE;
  const d = raw ? new Date(raw + 'T23:59:59Z') : new Date();
  // Fin de journée UTC : un item daté « aujourd'hui » sort aujourd'hui.
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59);
}

// -----------------------------------------------------------------------------
// Gate de publication programmée, par type de page. `field` = la colonne date ;
// `emptyDraft` = une date vide signifie « brouillon » (blog) ou « pas de date,
// on montre » (jalons anciens sans date précise).
// -----------------------------------------------------------------------------
const PUBLISH_GATE = {
  blog:    { field: 'publish', emptyDraft: true,  statut: 'statut' },
  history: { field: 'date',    emptyDraft: false },
};

// Vocabulaire booléen toléré dans la colonne `publie` (locale FR incluse).
const VRAI = new Set(['vrai', 'true', '1', 'oui', 'yes', 'x', 'y', 'ok']);
const FAUX = new Set(['faux', 'false', '0', 'non', 'no', '']);

const norm = (v) => String(v ?? '').trim();
const lower = (v) => norm(v).toLowerCase();

// -----------------------------------------------------------------------------
// Chargement d'un snapshot
// -----------------------------------------------------------------------------
function snapshotPath(page) {
  return join(EDITORIAL_DIR, `${page}.json`);
}

/** Enregistrements bruts d'une page (tels que récoltés). [] si le fichier
 *  n'existe pas et que `required` est faux. */
export function records(page, { required = true } = {}) {
  const p = snapshotPath(page);
  if (!existsSync(p)) {
    if (required) {
      throw new Error(
        `[editorial] snapshot manquant : ${p}. Lancer le récolteur ` +
        `(editorial_pull.py) avant le build.`);
    }
    return [];
  }
  const data = JSON.parse(readFileSync(p, 'utf8'));
  const recs = Array.isArray(data) ? data : data.records;
  return Array.isArray(recs) ? recs : [];
}

// -----------------------------------------------------------------------------
// Filtre `publie`
// -----------------------------------------------------------------------------
/** Une ligne est publiée SAUF si `publie` est explicitement faux. Le défaut
 *  (colonne vide) est réglable par site : `editorial.publish_default: draft`
 *  inverse la règle (rien n'est publié tant que `publie` n'est pas VRAI). */
function publishDefaultDraft() {
  return String((manifest().editorial || {}).publish_default || 'published')
    .toLowerCase() === 'draft';
}
export function isPublished(rec) {
  if (!('publie' in rec)) return true;             // page sans colonne publie
  const v = lower(rec.publie);
  if (VRAI.has(v)) return true;
  if (FAUX.has(v)) return v === '' ? !publishDefaultDraft() : false;
  return true;                                     // valeur exotique -> visible
}

// -----------------------------------------------------------------------------
// Gate de publication programmée
// -----------------------------------------------------------------------------
function parseDay(s) {
  const v = norm(s);
  if (!v) return null;
  const d = new Date(v.length <= 10 ? v + 'T00:00:00Z' : v);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}
/** true si l'item DOIT être rendu vu la date du build. */
export function passesPublishGate(rec, page, day = buildDay()) {
  const g = PUBLISH_GATE[page];
  if (!g) return true;
  if (g.statut && lower(rec[g.statut]) === 'brouillon') return false;
  const t = parseDay(rec[g.field]);
  if (t === null) return !g.emptyDraft;            // vide -> brouillon (blog) ou montré (jalon)
  return t <= day;                                 // futur -> retenu jusqu'à sa date
}

// -----------------------------------------------------------------------------
// Repli multilingue
// -----------------------------------------------------------------------------
const LANG_SUFFIX = /^(.*)_(en|fr|es|it|de)$/;

/** Résout les familles de colonnes `base_en/base_fr/…` vers `base` dans `lang`,
 *  avec repli sur la langue par défaut (EN). Les colonnes non suffixées sont
 *  recopiées telles quelles. Alimente `missing` (champs retombés sur le repli).*/
export function resolveLang(rec, lang, missing) {
  const def = locales().def;
  const families = new Set();
  for (const k of Object.keys(rec)) {
    const m = LANG_SUFFIX.exec(k);
    if (m) families.add(m[1]);
  }
  const out = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!LANG_SUFFIX.test(k)) out[k] = v;          // colonne « unique » -> recopiée
  }
  for (const base of families) {
    const want = norm(rec[`${base}_${lang}`]);
    if (want) { out[base] = rec[`${base}_${lang}`]; continue; }
    const fb = rec[`${base}_${def}`];
    out[base] = fb ?? '';
    if (lang !== def && norm(fb)) {
      if (missing) missing.push({ base, lang });   // journal « à traduire »
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Compteurs Brands — depuis l'ENTREPÔT (jamais le Sheet)
// -----------------------------------------------------------------------------
let _agg = null;
/** Agrégats par licence : { <licence>: {n_series, n_items, first_mint} }.
 *  Priorité à l'artefact d'entrepôt `engine/data/licence_agregats.json`
 *  (dérivé du catalogue) ; à défaut, calcul depuis `getCatalogue()` +
 *  `alias_series_licence.json`. Aucune valeur inventée : licence absente = null.*/
export async function licenceAgregats() {
  if (_agg) return _agg;
  for (const rel of ['engine/data/licence_agregats.json',
                     `sites/${SITE}/editorial/_licence_agregats.json`]) {
    const p = join(ROOT, rel);
    if (existsSync(p)) {
      _agg = JSON.parse(readFileSync(p, 'utf8'));
      return _agg;
    }
  }
  _agg = await computeAgregats();                  // repli : recalcul depuis l'entrepôt
  return _agg;
}

async function computeAgregats() {
  const aliasPath = join(ROOT, 'engine', 'data', 'alias_series_licence.json');
  if (!existsSync(aliasPath)) {
    console.warn('[editorial] ni licence_agregats.json ni alias : compteurs Brands indisponibles.');
    return {};
  }
  const alias = JSON.parse(readFileSync(aliasPath, 'utf8'));   // { serie: [licence, ...] }
  const { getCatalogue } = await import('../data/warehouse.mjs');
  const cat = await getCatalogue();
  const agg = {};
  const seriesByLic = {};                          // licence -> Set(series)
  for (const row of cat) {
    const serie = norm(row.series);
    const lics = alias[serie] || [];
    const rd = norm(row.release_date);
    for (const lic of lics) {
      const a = (agg[lic] ||= { n_series: 0, n_items: 0, first_mint: '' });
      a.n_items += 1;
      (seriesByLic[lic] ||= new Set()).add(serie);
      if (rd && (!a.first_mint || rd < a.first_mint)) a.first_mint = rd;
    }
  }
  for (const [lic, set] of Object.entries(seriesByLic)) agg[lic].n_series = set.size;
  return agg;
}

/** Injecte premier_drop / nb_series / nb_items depuis l'entrepôt et RETIRE les
 *  colonnes `*_auto` du Sheet (elles ne font jamais foi). */
function mergeBrandCounters(rec, agg) {
  const out = { ...rec };
  for (const k of Object.keys(out)) {
    if (k.endsWith('_auto')) delete out[k];        // le Sheet ne compte pas
  }
  const a = agg[norm(rec.licence)] || null;
  out.premier_drop = a ? a.first_mint : '';
  out.nb_series = a ? a.n_series : '';
  out.nb_items = a ? a.n_items : '';
  out.compteurs_source = a ? 'entrepot' : 'absent';
  return out;
}

// -----------------------------------------------------------------------------
// API principale : la collection prête à rendre pour une page + une langue
// -----------------------------------------------------------------------------
/**
 * Pipeline complet d'une page pour une langue :
 *   brut → filtre publie → gate publication → repli multilingue
 *        → (Brands) compteurs entrepôt.
 * Renvoie { items, missing, dropped } ; `missing` = journal à-traduire.
 */
export async function collection(page, lang, { required = true } = {}) {
  const raw = records(page, { required });
  const day = buildDay();
  const missing = [];
  let dropped = 0;

  const kept = raw.filter((r) => {
    if (!isPublished(r)) { dropped++; return false; }
    if (!passesPublishGate(r, page, day)) { dropped++; return false; }
    return true;
  });

  let items = kept.map((r) => resolveLang(r, lang, missing));

  if (page === 'brands') {
    const agg = await licenceAgregats();
    items = items.map((r) => mergeBrandCounters(r, agg));
  }

  if (missing.length) {
    const byLang = missing.reduce((m, x) => ((m[x.lang] = (m[x.lang] || 0) + 1), m), {});
    console.warn(`[editorial] ${page}: à traduire ${JSON.stringify(byLang)} ` +
                 `(repli EN appliqué).`);
  }
  return { items, missing, dropped };
}

/** Raccourci : juste la liste d'items (sans le journal). */
export async function items(page, lang, opts) {
  return (await collection(page, lang, opts)).items;
}

// -----------------------------------------------------------------------------
// Config du site (page clé/valeur optionnelle : slogan, disclaimer, …)
// -----------------------------------------------------------------------------
/** Charge la page `config` (lignes cle/valeur) et résout les clés suffixées
 *  `_en/_fr/…` vers la langue demandée. Renvoie un objet plat. */
export function siteConfig(lang) {
  const rows = records('config', { required: false });
  const def = locales().def;
  const flat = {};
  for (const r of rows) {
    const key = norm(r.cle ?? r.key);
    if (!key) continue;
    flat[key] = r.valeur ?? r.value ?? '';
  }
  // Résolution des familles cle_en/cle_fr -> cle.
  const out = {};
  const families = new Set();
  for (const k of Object.keys(flat)) {
    const m = LANG_SUFFIX.exec(k);
    if (m) families.add(m[1]); else out[k] = flat[k];
  }
  for (const base of families) {
    out[base] = norm(flat[`${base}_${lang}`]) ? flat[`${base}_${lang}`]
              : (flat[`${base}_${def}`] ?? '');
  }
  return out;
}

/** Réinitialise les caches (tests). */
export function _reset() { _agg = null; }
