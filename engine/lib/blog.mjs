// =============================================================================
//  blog.mjs — les ARTICLES, source HYBRIDE (Sheet + Markdown du dépôt)
//
//  ⚠️ CE FICHIER VA DANS LE DÉPÔT  VeVePreda/veve-sites , dans  engine/lib/
//     (chemin exact : engine/lib/blog.mjs)
//
//  DEUX SOURCES, UN SEUL FLUX (décision Preda, 27/07/2026) :
//
//   1. SHEET  — onglet `Blog` du Sheet éditorial, récolté par `editorial_pull.py`
//      vers `sites/<SITE>/editorial/blog.json`. DEUX FORMES acceptées, parce que
//      les Sheets du réseau n'ont pas tous la même (constaté sur vevewiki) :
//        a) UNE LIGNE PAR LANGUE  : colonne `lang` + `titre`/`body`/`excerpt`,
//           les langues reliées par `translation_key` ;
//        b) COLONNES PAR LANGUE   : une seule ligne, `titre_fr`/`body_fr`/
//           `description_fr`… — résolues par `resolveLang` d'editorial.mjs, avec
//           repli EN et journal « à traduire », comme le reste du réseau.
//      Colonnes lues (alias tolérés) : slug · translation_key · lang · titre|title ·
//      excerpt|description|chapeau · body|corps|contenu · tags|mots_cles|etiquette ·
//      date · items · publish · statut · publie.
//      → le corps (`body`) est du Markdown rendu par `engine/lib/markdown.mjs`.
//      → ⚠️ UNE LIGNE SANS CORPS EST IGNORÉE (et journalisée) : un article a
//        besoin d'une colonne `body` (ou `body_fr`/`body_en`) dans l'onglet.
//      → PUBLICATION PROGRAMMÉE : `publish` (date de sortie) ≤ jour du build ;
//        vide = brouillon. Géré par `passesPublishGate` d'editorial.mjs.
//
//   2. MARKDOWN — `sites/<SITE>/blog/<langue>/<slug>.md`, collection Astro
//      (frontmatter + pipeline remark complet). Pour les articles longs.
//      → même règle de date : un article daté du FUTUR est retenu jusqu'au jour dit.
//
//  ARBITRAGE : à (langue, slug) identique, le fichier `.md` du dépôt GAGNE — le
//  dépôt fait foi sur le Sheet (un avertissement est journalisé au build).
//
//  Le reste du réseau ne bouge pas : un site sans onglet Blog (veveprice) n'a
//  pas de `editorial/blog.json` → source 1 vide, comportement identique à avant.
// =============================================================================
import { locales } from './i18n.mjs';
import { manifest } from './manifest.mjs';
import { collection, parseDay } from './editorial.mjs';
import { renderMarkdown, stripMarkdown } from './markdown.mjs';

let _cache = null;

// -----------------------------------------------------------------------------
// Jour du build — même raisonnement qu'editorial.mjs : on compare des JOURS,
// jamais des heures (le cron GitHub a 2-3 h de retard). BUILD_DATE pour rejouer.
// -----------------------------------------------------------------------------
function buildDay() {
  const raw = process.env.BUILD_DATE;
  const d = raw ? new Date(raw + 'T23:59:59Z') : new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59);
}

const norm = (v) => String(v ?? '').trim();

/** « a, b ; c » → ['a','b','c'] (le Sheet ne sait pas écrire un tableau). */
function splitList(v) {
  if (Array.isArray(v)) return v.map(norm).filter(Boolean);
  return norm(v).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
}

const slugify = (s) => norm(s).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// -----------------------------------------------------------------------------
// Source 1 : le SHEET
//
// On passe par `collection()` d'editorial.mjs — donc on hérite GRATUITEMENT du
// filtre `publie`, de la publication programmée et du repli multilingue. Une
// lecture PAR LANGUE : c'est ce qui permet d'accepter les deux formes d'onglet.
// -----------------------------------------------------------------------------
async function sheetPostsFor(lang) {
  // `required: false` : un site sans onglet Blog n'est pas une erreur.
  const { items: rows } = await collection('blog', lang, { required: false });
  if (!rows.length) return [];
  const def = locales().def;
  const out = [];
  const sansCorps = [];

  for (const r of rows) {
    // Forme (a) : une ligne par langue -> on ne garde que la ligne de CETTE langue.
    const ligneLang = norm(r.lang || r.langue).toLowerCase();
    if (ligneLang && ligneLang !== lang) continue;

    const titre = norm(r.titre || r.title);
    const body = String(r.body ?? r.corps ?? r.contenu ?? '');
    const slugBrut = slugify(r.slug) || slugify(titre);
    if (!titre) continue;
    if (!body.trim()) { sansCorps.push(slugBrut || '(sans slug)'); continue; }

    const tk = norm(r.translation_key || r.translationKey) || slugBrut;
    // `date` = date affichée ; à défaut on retombe sur `publish` (date de sortie).
    const dateBrute = norm(r.date) || norm(r.publish) || '';
    // MEME lecteur de date que la gate de publication : un Sheet peut afficher
    // « 27/07/2026 » aussi bien que « 2026-07-27 » (cf. parseDay).
    const jour = (v) => { const t = parseDay(v); return t === null ? new Date(0) : new Date(t); };

    out.push({
      source: 'sheet',
      lang,
      slug: slugBrut,
      html: renderMarkdown(body),
      cover: norm(r.cover || r.image),
      data: {
        title: titre,
        description: norm(r.excerpt || r.description || r.chapeau)
          || stripMarkdown(body).slice(0, 180),
        date: dateBrute ? jour(dateBrute) : new Date(0),
        updated: norm(r.updated || r.maj) ? jour(norm(r.updated || r.maj)) : undefined,
        tags: splitList(r.tags ?? r.mots_cles ?? r.etiquette),
        items: splitList(r.items),
        translationKey: tk,
        draft: false,
      },
    });
  }

  if (sansCorps.length && lang === def) {
    console.warn(`[blog] ${sansCorps.length} ligne(s) de l'onglet Blog sans corps, ` +
      `donc non publiée(s) : ${sansCorps.join(', ')}. Un article a besoin d'une ` +
      `colonne \`body\` (ou \`body_${def}\`/\`body_fr\`) dans le Sheet.`);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Source 2 : les fichiers MARKDOWN (collection Astro)
// -----------------------------------------------------------------------------
async function mdPosts() {
  let getCollection;
  try {
    ({ getCollection } = await import('astro:content'));
  } catch (e) {
    // Hors contexte Astro (tests node en ligne de commande) : le schéma « astro: »
    // n'existe pas -> pas de collection markdown, ce n'est pas une erreur.
    // Toute AUTRE erreur doit remonter — on ne masque pas un vrai échec de build.
    const hors = e && (e.code === 'ERR_UNSUPPORTED_ESM_URL_SCHEME'
                    || e.code === 'ERR_MODULE_NOT_FOUND'
                    || /astro:content/.test(String(e && e.message)));
    if (hors) return [];
    throw e;
  }
  const entries = await getCollection('blog', (e) => !e.data.draft);
  return entries.map((e) => {
    const i = e.id.indexOf('/');
    const lang = i > 0 ? e.id.slice(0, i) : locales().def;
    const slug = i > 0 ? e.id.slice(i + 1) : e.id;
    return { source: 'md', entry: e, lang, slug, data: e.data };
  });
}

// -----------------------------------------------------------------------------
// Fusion
// -----------------------------------------------------------------------------
async function loadAll() {
  if (_cache) return _cache;
  const md = await mdPosts();
  const sheet = [];
  for (const l of locales().active) sheet.push(...await sheetPostsFor(l));
  const day = buildDay();

  // Le dépôt fait foi : un .md masque la ligne de Sheet de même (langue, slug).
  const pris = new Set(md.map((p) => `${p.lang}/${p.slug}`));
  const doublons = [];
  const retenus = md.slice();
  for (const p of sheet) {
    const k = `${p.lang}/${p.slug}`;
    if (pris.has(k)) { doublons.push(k); continue; }
    pris.add(k);
    retenus.push(p);
  }
  if (doublons.length) {
    console.warn(`[blog] ${doublons.length} article(s) du Sheet masqué(s) par un .md ` +
                 `du dépôt : ${doublons.join(', ')}`);
  }

  // Publication programmée aussi pour les .md : un article daté du futur attend
  // son jour (règle générale du réseau, cf. bible/sheet-vevewiki-spec.md).
  const visibles = retenus.filter((p) => {
    const t = new Date(p.data.date).getTime();
    return !Number.isFinite(t) || t <= day;
  });

  const n = { md: visibles.filter((p) => p.source === 'md').length,
              sheet: visibles.filter((p) => p.source === 'sheet').length };
  console.log(`[blog] ${n.md + n.sheet} article(s) : ${n.md} markdown + ${n.sheet} sheet`);

  _cache = visibles;
  return _cache;
}

const byDateDesc = (a, b) => new Date(b.data.date) - new Date(a.data.date);

export async function postsFor(lang) {
  return (await loadAll()).filter((p) => p.lang === lang).sort(byDateDesc);
}

export async function postBySlug(lang, slug) {
  return (await loadAll()).find((p) => p.lang === lang && p.slug === slug) || null;
}

// Les traductions d'un meme article peuvent avoir des slugs DIFFERENTS :
// c'est cette carte qui permet un hreflang correct.
export async function translationPaths(key) {
  const out = {};
  for (const p of await loadAll()) {
    if (p.data.translationKey === key) out[p.lang] = `/blog/${p.slug}/`;
  }
  return out;
}

export async function tagsFor(lang) {
  const counts = new Map();
  for (const p of await postsFor(lang)) {
    for (const t of p.data.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  }
  // Un theme a un seul article ne serait qu'un doublon de l'index :
  // on ne lui cree pas de page tant qu'il n'a pas au moins 2 articles.
  const MIN = Number(process.env.TAG_MIN_POSTS || 2);
  return [...counts.entries()].filter(([, n]) => n >= MIN)
    .map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);
}

export async function postsByTag(lang, tag) {
  return (await postsFor(lang)).filter((p) => (p.data.tags || []).includes(tag));
}

// Maillage interne : les articles qui citent une fiche donnee.
export async function postsForItem(lang, uuid) {
  return (await postsFor(lang)).filter((p) => (p.data.items || []).includes(uuid));
}

export const allLangs = async () => [...new Set((await loadAll()).map((p) => p.lang))];

/**
 * Titre + description de l'INDEX des articles. Le libellé réseau par défaut
 * parle de relevés de prix : un wiki n'en publie pas. Chaque site peut donc
 * surcharger dans son manifeste :
 *   editorial:
 *     labels:
 *       blog: { title: {fr: "…"}, description: {fr: "…"} }
 */
export function blogMeta(lang, fallback = {}) {
  const over = ((manifest().editorial || {}).labels || {}).blog || {};
  const pick = (m) => (m && (m[lang] || m[locales().def] || Object.values(m)[0])) || '';
  return {
    title: pick(over.title) || fallback.title || '',
    description: pick(over.description) || fallback.description || '',
  };
}

/** Ce site a-t-il un blog ? (nav, sitemap) — vrai si le manifeste l'active
 *  (`editorial.pages` contient `blog`) OU si le site n'est pas un site éditorial
 *  (les sites de prix gardent leur blog markdown historique). */
export function blogEnabled() {
  const m = manifest();
  const ed = m.editorial || {};
  const pages = Array.isArray(ed.pages) ? ed.pages.map((p) => String(p).trim()) : null;
  if (!pages || !pages.length) return true;        // site non éditorial : inchangé
  return pages.includes('blog');
}

/** Réinitialise le cache (tests). */
export function _reset() { _cache = null; }
