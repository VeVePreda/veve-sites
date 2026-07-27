// =============================================================================
//  editorial_entries.mjs — LES FICHES : une page par ENTITÉ, plus une par liste
//
//  ⚠️ CE FICHIER VA DANS LE DÉPÔT  VeVePreda/veve-sites , dans  engine/lib/
//     (chemin exact : engine/lib/editorial_entries.mjs)
//
//  LE PROBLÈME QU'IL RÉSOUT
//  vevewiki portait 296 entités de contenu — 87 termes, 65 sigles, 44 licences,
//  40 jalons, 47 entrées d'annuaire — empilées sur CINQ pages index. Chacune est
//  la réponse à une question que quelqu'un tape vraiment (« toutes les séries
//  Marvel VeVe »), mais aucune n'avait d'adresse à elle. On ne peut ni s'y
//  lier, ni la classer, ni la partager.
//
//  ⭐⭐ LE PIÈGE À NE PAS TOMBER DEDANS EN CHEMIN
//  Éclater une liste en pages ne crée de la valeur que si CHAQUE page en a.
//  Les notes de marque font ici 24 à 55 caractères : une page « nom + une
//  phrase + trois chiffres » est du *thin content*, et Google le pèse au niveau
//  du SITE — quelques dizaines de pages creuses abîment celles qui sont bonnes.
//  ➡️ D'où DEUX garde-fous, tous deux dans ce fichier :
//     1. la substance d'une fiche est **CALCULÉE** depuis l'entrepôt (rang,
//        part du catalogue, ordre d'arrivée, voisines, jalons qui la citent) —
//        pas recopiée, pas inventée ;
//     2. une entité qui n'atteint pas le SEUIL garde sa ligne dans l'index et
//        n'obtient PAS de page. Mieux vaut 29 bonnes fiches que 44 tièdes.
//
//  GÉNÉRIQUE PAR CONSTRUCTION : `brands` aujourd'hui, `glossary` demain — il
//  suffit d'ajouter une entrée à FICHES. Rien ici n'est propre à vevewiki.
// =============================================================================
import { manifest } from './manifest.mjs';
import { locales } from './i18n.mjs';
import { collection, licenceAgregats } from './editorial.mjs';
import { activeSections, languesDeSection } from './editorial_pages.mjs';

const norm = (s) => String(s ?? '').trim();
export const slugifier = (v) => norm(v).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

// -----------------------------------------------------------------------------
//  Les sections qui savent produire des fiches, et à quelles conditions.
//  `seuil` : ce qu'il faut pour mériter une page à soi.
// -----------------------------------------------------------------------------
const FICHES = {
  brands: {
    // La colonne `licence` est DÉJÀ un identifiant stable (`back-to-the-future`) :
    // on ne le re-slugifie pas, sinon un changement de libellé casserait l'URL.
    slug: (r) => slugifier(r.licence),
    titre: (r) => norm(r.nom_affiche) || norm(r.licence),
    // Une licence de 2 collectibles n'a rien à raconter qu'une ligne d'index ne
    // dise déjà. Sauf si l'Histoire la cite : là, il y a un récit.
    seuil: (r, ctx) => (ctx.agg?.n_items || 0) >= 5 || (ctx.jalons?.length || 0) > 0,
  },
};

export const SECTIONS_FICHES = Object.keys(FICHES);

/** Les sections qui produisent des fiches SUR CE SITE (actives ∩ outillées). */
export function ficheSections() {
  const declarees = new Set(activeSections());
  return SECTIONS_FICHES.filter((s) => declarees.has(s));
}

// -----------------------------------------------------------------------------
//  Enrichissement — tout ce qui suit est CALCULÉ, jamais saisi.
// -----------------------------------------------------------------------------
// ⚠️ MÊME règle d'ancre que src/components/pages/Editorial.astro : si les deux
// divergent, ces liens pointent dans le vide sans que rien n'échoue.
export const ancreJalon = (r) => (r.id ? `j-${slugifier(r.id)}` : `j-${slugifier(r.date)}-${slugifier(r.titre)}`);

async function jalonsCitant(lang, cle) {
  let items = [];
  try { items = (await collection('history', lang)).items; } catch { return []; }
  const veut = slugifier(cle);
  return items.filter((j) => String(j.entites || '').replace(/;/g, ',').split(',')
    .some((e) => slugifier(e) === veut));
}

/**
 * La fiche complète d'une entrée : son enregistrement + ce que l'entrepôt sait
 * d'elle + ses voisines. Renvoie `null` si l'entrée n'atteint pas le seuil.
 */
export async function ficheDe(section, lang, slug) {
  const toutes = await fichesDe(section, lang);
  return toutes.find((f) => f.slug === slug) || null;
}

const _cache = new Map();

/** Toutes les fiches PUBLIABLES d'une section, enrichies et ordonnées. */
export async function fichesDe(section, lang) {
  const cle = `${section}/${lang}`;
  if (_cache.has(cle)) return _cache.get(cle);
  const cfg = FICHES[section];
  if (!cfg) return [];

  const { items } = await collection(section, lang);
  const agg = section === 'brands' ? await licenceAgregats() : {};
  const poids = (r) => agg[norm(r.licence)]?.n_items || 0;
  const arrivee = (r) => agg[norm(r.licence)]?.first_drop || agg[norm(r.licence)]?.first_mint || '9999';

  // ⚠️ DEUX PASSES, ET C'EST LE POINT DÉLICAT.
  // Les « voisines » se calculent parmi les fiches qui ONT une page, jamais
  // parmi toutes les entrées : sinon une licence sous le seuil deviendrait la
  // voisine de quelqu'un et le lien pointerait vers une page inexistante.
  // Un lien mort par fiche, sur 29 fiches, en silence.
  const retenues = [];
  for (const r of items) {
    const jalons = (await jalonsCitant(lang, r.licence)).map((j) => ({ ...j, ancre: ancreJalon(j) }));
    if (!cfg.seuil(r, { agg: agg[norm(r.licence)] || null, jalons })) continue;
    retenues.push({ r, jalons });
  }

  const parPoids = [...retenues].sort((a, b) => poids(b.r) - poids(a.r));
  const parArrivee = [...retenues].sort((a, b) => arrivee(a.r).localeCompare(arrivee(b.r)));
  // La part se rapporte au catalogue ENTIER, pas au seul sous-ensemble publié :
  // dire « 78 % » quand on n'a compté que 29 licences sur 44 serait un chiffre faux.
  const totalItems = items.reduce((n, r) => n + poids(r), 0);
  const voisine = (e) => (e ? { ...e.r, slugFiche: cfg.slug(e.r) } : null);

  const out = [];
  for (const e of retenues) {
    const a = agg[norm(e.r.licence)] || null;
    const iPoids = parPoids.indexOf(e);
    const iArr = parArrivee.indexOf(e);
    // Fenêtre de comparaison pour la figure : la licence et ses plus proches
    // par la taille (2 de part et d'autre, recadrées aux bords du classement).
    const debut = Math.max(0, Math.min(iPoids - 2, parPoids.length - 5));
    const voisinesPoids = parPoids.slice(debut, debut + 5)
      .map((x) => ({ titre: cfg.titre(x.r), items: poids(x.r) }));

    out.push({
      section, slug: cfg.slug(e.r), titre: cfg.titre(e.r), record: e.r, agg: a, jalons: e.jalons,
      rangPoids: iPoids + 1, rangArrivee: iArr + 1, total: retenues.length,
      part: a && totalItems ? (a.n_items / totalItems) * 100 : null,
      precedente: voisine(iArr > 0 ? parArrivee[iArr - 1] : null),
      suivante: voisine(iArr < parArrivee.length - 1 ? parArrivee[iArr + 1] : null),
      voisinesPoids,
    });
  }
  // ⛔ Zéro fiche sur une section active = un signal, pas un résultat.
  if (items.length && !out.length) {
    console.warn(`[fiches] ${section}/${lang} : ${items.length} entrées, AUCUNE ne passe le seuil — seuil trop haut ou entrepôt muet ?`);
  }
  _cache.set(cle, out);
  return out;
}

/** L'adresse d'une fiche. Une seule définition, partagée par les routes, le
 *  sitemap, l'index et le gabarit : elles ne peuvent pas diverger. */
export const cheminFiche = (section, slug) => `/${section}/${slug}/`;

/** getStaticPaths — langue par défaut. */
export async function ficheParamsDefault() {
  const { def } = locales();
  const out = [];
  for (const s of ficheSections()) {
    for (const f of await fichesDe(s, def)) out.push({ params: { section: s, entree: f.slug } });
  }
  return out;
}

/** getStaticPaths — langues secondaires.
 *  ⭐ Une fiche vit dans les langues de SA SECTION, jamais dans plus : sa
 *  substance est calculée, mais son titre et sa note viennent du Sheet. Si
 *  /es/brands/ n'existe pas, /es/brands/marvel/ ne doit pas exister non plus —
 *  sinon on publie 29 pages orphelines, sans index qui y mène, en espagnol
 *  de façade. */
export async function ficheParamsLocalized() {
  const { def } = locales();
  const out = [];
  for (const s of ficheSections()) {
    for (const locale of languesDeSection(s)) {
      if (locale === def) continue;
      for (const f of await fichesDe(s, locale)) out.push({ params: { locale, section: s, entree: f.slug } });
    }
  }
  return out;
}

/** Date de collecte de l'entrepôt — pour le cartouche des figures générées à la
 *  volée. ⚠️ C'est la date du RELEVÉ, pas celle du build : cf. engine/data/entrepot.json. */
export function collecteEntrepot() {
  const m = manifest();
  return m.content?.entrepot_collecte || null;
}

export function _resetFiches() { _cache.clear(); }
