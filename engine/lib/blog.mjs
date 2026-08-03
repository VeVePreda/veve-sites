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
import { collection, parseDay, estRepli } from './editorial.mjs';
import { renderMarkdown, stripMarkdown } from './markdown.mjs';
import { localize } from './i18n.mjs';
import { figureParId } from './figures.mjs';

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

  const nonTraduits = [];

  for (const r of rows) {
    // Forme (a) : une ligne par langue -> on ne garde que la ligne de CETTE langue.
    const ligneLang = norm(r.lang || r.langue).toLowerCase();
    if (ligneLang && ligneLang !== lang) continue;

    // ⭐⭐ UN ARTICLE NON TRADUIT N'EST PAS UN ARTICLE DE CETTE LANGUE.
    // Forme (b) : `resolveLang` recopie l'anglais quand `body_es` n'existe pas.
    // Sans ce filtre, /es/blog/ publiait deux articles ANGLAIS sous
    // <html lang="es">, avec leur carte de partage, leur flux RSS et leur
    // entree de sitemap — et le compte « 2 articles en espagnol » avait l'air
    // juste. Le CORPS decide : un titre traduit sur un texte anglais reste un
    // texte anglais. Le tri se fait ARTICLE PAR ARTICLE, pas section par
    // section : une traduction arrive une piece a la fois.
    if (estRepli(r, 'body')) { nonTraduits.push(norm(r.slug) || norm(r.titre)); continue; }

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
      // ⭐ Deux choses que le Markdown du Sheet ne peut pas faire seul :
      //   • `localiser` — sans lui, un renvoi interne ecrit en dur envoie le
      //     lecteur FRANCAIS sur la page ANGLAISE, en silence, a chaque lien ;
      //   • `figure`    — `![legende](figure:id)` devient une figure de donnees
      //     tracee au build, l'auteur ne recopiant AUCUN chiffre.
      html: renderMarkdown(body, {
        localiser: (u) => localize(lang, u),
        figure: (id, legende) => figureParId(id, lang, legende),
      }),
      cover: norm(r.cover || r.image),
      // ⭐ DUREE DE LECTURE — colonne OPTIONNELLE du Sheet (arbitrage Preda
      // du 03/08 : c'est l'auteur qui l'ecrit). Alias toleres comme partout
      // ailleurs dans ce lecteur : un Sheet tenu a la main n'a pas d'en-tetes
      // stables, et refuser « duree » parce qu'on attendait « lecture » ferait
      // perdre la donnee en silence.
      // ⛔ ON NE LA COMPLETE PAS ICI. Vide = vide. Le repli calcule vit dans
      // `dureeLecture()`, en UN seul endroit : deux definitions d'un meme
      // chiffre, c'est le defaut de famille de ce projet.
      lectureDite: norm(r.lecture || r.reading_time || r.readingTime || r.duree || r.temps),
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

  if (nonTraduits.length) {
    console.log(`[blog] ${lang} : ${nonTraduits.length} article(s) non traduit(s), donc non publie(s) `
      + `dans cette langue : ${nonTraduits.join(', ')}`);
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

// ⭐⭐ SEUIL D'INDEXATION D'UNE ETIQUETTE — UNE SEULE SOURCE, LUE PAR TOUS.
// Corrige le 29/07/2026. Il y avait TROIS regles pour la meme page :
//   · blog.mjs        TAG_MIN_POSTS = 2   -> CREE la page ;
//   · BlogTag.astro   SEUIL_INDEX   = 4   -> la met en NOINDEX ;
//   · sitemap.xml.js  (aucun seuil)       -> l'ANNONCE quand meme.
// Mesure sur vevewiki : 10 pages (2 etiquettes x 5 langues) a la fois en
// noindex ET dans le sitemap. On demandait a Google d'aller voir une page
// qu'on lui interdisait d'indexer — une contradiction qu'aucun build ne signale.
// ⭐ Le commentaire de BlogTag.astro promettait deja « et le sitemap la suit ».
// La promesse etait ecrite dans le code, jamais tenue : le sitemap ne
// connaissait pas le seuil. Il vit donc ICI, et les deux autres le LISENT.
// ⛔ Ne PAS le recopier ailleurs : c'est exactement comme ca qu'on en est
// arrive a trois seuils pour une seule decision.
export const SEUIL_INDEX_TAG = Number(process.env.TAG_MIN_INDEX || 4);

export async function tagsFor(lang) {
  const counts = new Map();
  for (const p of await postsFor(lang)) {
    // ⚠️ `new Set` : un article qui liste DEUX FOIS la meme etiquette comptait
    // double ici, alors que `postsByTag` compte des ARTICLES. Les deux doivent
    // rendre le meme nombre, sinon le seuil se lit differemment des deux cotes
    // — et on recree en silence le defaut que ce correctif vient de fermer.
    for (const t of new Set(p.data.tags || [])) counts.set(t, (counts.get(t) || 0) + 1);
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
 * Les langues dans lesquelles le BLOG est publiable.
 *
 * ⭐ Le blog ne passe PAS par la mesure de couverture d'engine/lib/langues.mjs,
 * et c'est délibéré : ses articles viennent de DEUX sources (onglet Sheet et
 * fichiers .md du dépôt). Mesurer le seul snapshot `blog.json` ferait tomber à
 * zéro un site qui n'a que des .md — veveprice, dont les articles français
 * auraient disparu sans un mot. Le fait qui compte ici n'est pas « la colonne
 * est-elle traduite » mais « existe-t-il un article dans cette langue »,
 * et `postsFor` le sait des deux sources à la fois.
 * ⚠️ La langue pivot est toujours retenue : c'est elle qui porte l'index même
 * quand il est vide, et le sitemap la traite déjà à part (`langsAvecArticles`).
 */
export async function languesBlog() {
  const { active, def } = locales();
  const out = [];
  for (const l of active) {
    if (l === def || (await postsFor(l)).length) out.push(l);
  }
  return out;
}

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
// ═══════════════════════════════════════════════════════════════════════════
// LA DUREE DE LECTURE — dite par l'auteur, calculee a defaut.
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ ARBITRAGE PREDA DU 03/08/2026 : c'est un CHAMP OPTIONNEL DU SHEET. Quand
// l'auteur l'ecrit, elle fait foi — il sait si son article se lit vite.
//
// ⚠️ ET « OPTIONNEL » DOIT AVOIR UN COMPORTEMENT QUAND IL EST ABSENT. Sans
// repli, un article sans la colonne afficherait « — de lecture », ou pire une
// chaine vide dans une etiquette dessinee pour porter un chiffre. On calcule
// donc : mots du corps / 200, plancher a 1 minute.
//
// ⛔ LE PIEGE CONNU, ET IL EST REEL : un chiffre ECRIT A LA MAIN se perime des
// que l'article est rallonge, sans que rien ne le dise. C'est le meme mecanisme
// que l'habillage du Sheet pose hors du code qui ecrit. On ne peut pas
// l'empecher — c'est le prix du choix — mais on peut le RENDRE VISIBLE : le
// build journalise l'ecart quand la valeur dite s'eloigne de plus de 60 % du
// calcul. Il ne corrige rien, il le dit.
const MOTS_PAR_MINUTE = 200;

/** Minutes de lecture d'un article. `null` si le corps est vide. */
export function dureeLecture(post) {
  const dite = Number(String(post?.lectureDite ?? '').replace(/[^0-9]/g, ''));
  // Le corps : une ligne de Sheet arrive rendue en `html`, un .md porte son
  // `entry.body` brut. On mesure le TEXTE, jamais le balisage.
  const brut = post?.html
    ? String(post.html).replace(/<[^>]+>/g, ' ')
    : String(post?.entry?.body || '');
  const mots = brut.split(/\s+/).filter(Boolean).length;
  const calcule = mots ? Math.max(1, Math.round(mots / MOTS_PAR_MINUTE)) : null;

  if (Number.isFinite(dite) && dite > 0) {
    if (calcule && (dite > calcule * 1.6 || dite < calcule * 0.4)) {
      console.log(`[blog] « ${post.slug} » (${post.lang}) : duree dite ${dite} min, `
        + `corps mesure a ~${calcule} min. La valeur DITE est publiee — mais si `
        + `l'article a ete rallonge depuis, la colonne du Sheet est a reprendre.`);
    }
    return dite;
  }
  return calcule;
}

// ═══════════════════════════════════════════════════════════════════════════
// LA PEAU DU BLOG — quel jeu de gabarits rend les articles.
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 POURQUOI CE REGLAGE EXISTE, ET IL FAUT LE SAVOIR AVANT D'Y TOUCHER.
// Le blog de la maquette emploie 35 classes. TRENTE ET UNE n'existent QUE dans
// le theme `vitrine` : `boite`, `boites`, `bloc__os`, `etiq`, `carte`,
// `sect-t`, `avec-aside`, `panneau`, `filtres`, `num-s`… `encyclopedie` et
// `aurora` n'en ont aucune regle — mesure le 03/08/2026.
// Seules `prose`, `crumbs`, `lead` et `wrap` sont dans les trois.
//
// ⛔ PORTER LE BALISAGE DANS LE GABARIT PARTAGE AURAIT RENDU INERTE LE BLOG DE
// vevewiki — 40 pages reelles, 5 articles x 5 langues — POUR EMBELLIR CELUI DE
// veveprice, QUI EN A UN. C'est le miroir exact du 31/07 : on avait alors
// reclame a `encyclopedie` le vocabulaire de la vitrine via `css-mort`, et
// recolte 172 griefs. Ici, c'est le GABARIT qui l'aurait reclame — et personne
// n'aurait crie.
//
// ⭐ On suit le precedent du moteur plutot que d'en inventer un : `index.astro`
// choisit deja `Home` ou `EditorialHome` selon le manifeste.
// ⚠️ DEFAUT = `sobre`. Un site qui ne declare rien ne change pas de rendu.
export function blogSkin() {
  const v = String(manifest().editorial?.blog_skin || '').trim().toLowerCase();
  if (!v) return 'sobre';
  if (v !== 'vitrine' && v !== 'sobre') {
    // Porte inconnue = faute de frappe, pas fonctionnalite a venir. On refuse
    // bruyamment : un `blog_skin: vitrines` silencieux rendrait la page sobre
    // et on chercherait la panne dans le CSS pendant une heure.
    throw new Error(`[blog] editorial.blog_skin inconnu : « ${v} » (attendus : vitrine, sobre)`);
  }
  return v;
}

export function blogEnabled() {
  const m = manifest();
  const ed = m.editorial || {};
  const pages = Array.isArray(ed.pages) ? ed.pages.map((p) => String(p).trim()) : null;
  if (!pages || !pages.length) return true;        // site non éditorial : inchangé
  return pages.includes('blog');
}

/** Réinitialise le cache (tests). */
export function _reset() { _cache = null; }
