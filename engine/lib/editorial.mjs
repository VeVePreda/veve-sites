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
/**
 * Lit une date de Sheet et renvoie son JOUR en millisecondes UTC (minuit), ou
 * `null` si elle est illisible.
 *
 * POURQUOI CE N'EST PAS UN SIMPLE `new Date()` (payé le 27/07/2026).
 * Google Sheets convertit « 2026-07-27 » en VRAIE date au moment de l'import,
 * et `get_all_values()` renvoie ensuite la date TELLE QU'AFFICHEE — donc au
 * format d'affichage de la cellule, qui suit la locale du classeur. Une cellule
 * reformatee a la main (ou saisie en francais) renvoie « 27/07/2026 », que
 * `new Date()` ne sait pas lire : la date devenait `null`, et un `null` sur un
 * blog signifie BROUILLON. L'article disparaissait donc en silence, sans la
 * moindre erreur de build. On accepte desormais les formats reellement produits
 * par un Sheet, et on JOURNALISE ce qu'on n'a pas su lire.
 */
export function parseDay(s) {
  const v = norm(s);
  if (!v) return null;
  let m;
  // ISO : AAAA-MM-JJ / AAAA-MM / AAAA  (le format canonique du reseau)
  if ((m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(v))) {
    return Date.UTC(+m[1], (+m[2] || 1) - 1, +m[3] || 1);
  }
  // Locale FR : JJ/MM/AAAA (ou . ou -). Sheets affiche ainsi une vraie date.
  if ((m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(v))) {
    return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  }
  // Mois seul : MM/AAAA
  if ((m = /^(\d{1,2})[/.\-](\d{4})$/.exec(v))) {
    return Date.UTC(+m[2], +m[1] - 1, 1);
  }
  // Dernier recours : tout ce que le moteur JS sait lire (ISO avec heure, ...).
  const d = new Date(v);
  if (Number.isFinite(d.getTime())) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  console.warn(`[editorial] date illisible : ${JSON.stringify(v)} — l'element est `
    + `traite comme non date (donc BROUILLON sur le blog). Formater la colonne `
    + `en AAAA-MM-JJ dans le Sheet.`);
  return null;
}
/**
 * Ramene une date de Sheet a l'ISO tronque a sa PRECISION :
 *   jour -> AAAA-MM-JJ · mois -> AAAA-MM · annee -> AAAA.
 * Renvoie la valeur brute si elle est illisible (on n'invente rien).
 *
 * POURQUOI (payé le 27/07/2026). La chronologie est TRIEE sur la chaine de
 * caracteres de la date. Tant que le Sheet affiche de l'ISO, ce tri est juste.
 * Le jour ou une cellule est reformatee et renvoie « 01/03/2022 », le tri
 * compare des jours avant des annees : la timeline se melange ENTIEREMENT,
 * sans la moindre erreur — et un jalon de 2020 se retrouve entre deux de 2024.
 * On canonise donc a la lecture, une fois, pour tout le reseau.
 */
export function canonDate(raw, precision) {
  const v = norm(raw);
  if (!v) return '';
  const t = parseDay(v);
  if (t === null) return v;
  const d = new Date(t);
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-`
            + `${String(d.getUTCDate()).padStart(2, '0')}`;
  const p = lower(precision) || (/^\d{4}$/.test(v) ? 'annee'
                              : /^\d{4}-\d{1,2}$/.test(v) ? 'mois' : 'jour');
  if (p === 'annee') return iso.slice(0, 4);
  if (p === 'mois') return iso.slice(0, 7);
  return iso;
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
 *  recopiées telles quelles. Alimente `missing` (champs retombés sur le repli).
 *
 *  ⭐⭐ L'ITEM PORTE DÉSORMAIS SA PROPRE MARQUE DE REPLI : `__repli` liste les
 *  familles qui n'existaient PAS dans la langue demandée. Sans elle, un appelant
 *  ne peut pas faire la différence entre « traduit » et « anglais recopié » —
 *  et c'est ainsi que 2 articles anglais sont sortis sous /es/blog/ au premier
 *  essai de cette couche : `postsFor('es')` renvoyait 2 articles, donc l'espagnol
 *  « avait un blog ». Le journal `missing` ne servait qu'à écrire une ligne dans
 *  la console ; il fallait que la donnée elle-même le dise. */
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
  const repli = [];
  for (const base of families) {
    const want = norm(rec[`${base}_${lang}`]);
    if (want) { out[base] = rec[`${base}_${lang}`]; continue; }
    const fb = rec[`${base}_${def}`];
    out[base] = fb ?? '';
    if (lang !== def && norm(fb)) {
      repli.push(base);
      if (missing) missing.push({ base, lang });   // journal « à traduire »
    }
  }
  out.__repli = repli;
  return out;
}

/** Ce champ de cet item a-t-il été RECOPIÉ de la langue pivot ? */
export const estRepli = (item, base) =>
  Array.isArray(item && item.__repli) && item.__repli.includes(base);

// -----------------------------------------------------------------------------
// SOURCES — « toute information porte un lien vers sa source » (règle Preda,
// 27/07/2026). La colonne `sources` d'une fiche contient des entrées séparées
// par `;` ou par un saut de ligne. Chaque entrée est soit une URL, soit un
// libellé (« Infos VeVe.docx »), soit « libellé <url> ». On rend les URL en
// liens et on garde les libellés en texte : une source non cliquable reste une
// source, et un wiki doit dire d'où il tient ce qu'il affirme.
// -----------------------------------------------------------------------------
export function parseSources(raw) {
  return String(raw ?? '')
    .split(/[;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((entree) => {
      const m = /^(.*?)[\s<]*((?:https?:\/\/)[^\s>]+)>?$/.exec(entree);
      if (m) {
        const url = m[2];
        const label = (m[1] || '').trim().replace(/[–—-]$/, '').trim()
          || url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return { label, href: url };
      }
      return { label: entree, href: null };
    });
}

// -----------------------------------------------------------------------------
// Compteurs Brands — depuis l'ENTREPÔT (jamais le Sheet)
// -----------------------------------------------------------------------------
let _agg = null;
/** Agrégats par licence :
 *  `{ <licence>: {n_series, n_items, first_mint, first_drop, first_drop_source} }`.
 *
 *  ⭐⭐ DEUX DATES, DEUX FAITS (corrigé le 27/07/2026) — ne pas les confondre :
 *    • `first_mint`  = 1re FRAPPE on-chain. VeVe frappe dans son coffre AVANT
 *                      d'ouvrir le drop : médiane +2 j d'avance, jusqu'à +54 j.
 *    • `first_drop`  = 1re SORTIE PUBLIQUE (catalogue). C'est CELA qu'un lecteur
 *                      appelle « premier drop », et c'est ce que confirment les
 *                      annonces datées du blog officiel (vérifié 5 fois sur 5).
 *  `first_drop` peut être `null` quand le catalogue ne prouve rien : on retombe
 *  alors sur la frappe, et `compteurs_date` le dit (cf. mergeBrandCounters).
 *
 *  Priorité à l'artefact d'entrepôt `engine/data/licence_agregats.json` (produit
 *  par `outils/construire_licence_agregats.py` côté ScrapeurVeVe) ; à défaut,
 *  calcul depuis `getCatalogue()` + `alias_series_licence.json`.
 *  Aucune valeur inventée : licence absente = null. */
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
      // ⚠️ Ce repli lit le CATALOGUE : sa date est donc une date de SORTIE
      // (`first_drop`), pas une frappe. On ne remplit surtout pas `first_mint`
      // avec, sinon on recrée la confusion que l'artefact vient de lever.
      const a = (agg[lic] ||= { n_series: 0, n_items: 0, first_mint: '', first_drop: '', first_drop_source: 'catalogue' });
      a.n_items += 1;
      (seriesByLic[lic] ||= new Set()).add(serie);
      if (rd && (!a.first_drop || rd < a.first_drop)) a.first_drop = rd;
    }
  }
  for (const [lic, set] of Object.entries(seriesByLic)) agg[lic].n_series = set.size;
  return agg;
}

/** Injecte premier_drop / nb_series / nb_items depuis l'entrepôt et RETIRE les
 *  colonnes `*_auto` du Sheet (elles ne font jamais foi).
 *
 *  `premier_drop` prend la SORTIE PUBLIQUE (`first_drop`) et retombe sur la
 *  FRAPPE (`first_mint`) quand le catalogue ne prouve rien. `date_nature` dit
 *  laquelle des deux est affichée — le gabarit s'en sert pour l'étiqueter, parce
 *  qu'un wiki qui donne une date doit dire de quelle date il parle. */
function mergeBrandCounters(rec, agg) {
  const out = { ...rec };
  for (const k of Object.keys(out)) {
    if (k.endsWith('_auto')) delete out[k];        // le Sheet ne compte pas
  }
  const a = agg[norm(rec.licence)] || null;
  const drop = a && a.first_drop ? a.first_drop : '';
  out.premier_drop = drop || (a ? a.first_mint || '' : '');
  out.date_nature = !a || !out.premier_drop ? '' : (drop ? 'drop' : 'mint');
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

  // Chronologie : dates canonisees -> le tri par chaine reste juste quel que
  // soit le format d'affichage du Sheet (cf. canonDate).
  if (page === 'history') {
    items = items.map((r) => ({ ...r, date: canonDate(r.date, r.precision) }));
  }

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
