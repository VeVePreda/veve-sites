import { dataset } from '../../engine/lib/dataset.mjs';
import { siteUrl, SITE } from '../../engine/lib/manifest.mjs';
import { locales, localize } from '../../engine/lib/i18n.mjs';
import { DOCS, languesLegales } from '../../engine/lib/legal.mjs';
import { priceEnabled } from '../../engine/lib/features.mjs';
import { activeSections, sectionMeta, languesDeSection, languesDuSite } from '../../engine/lib/editorial_pages.mjs';
import { ficheSections, fichesDe, cheminFiche } from '../../engine/lib/editorial_entries.mjs';
import { postsFor, tagsFor, translationPaths, SEUIL_INDEX_TAG, languesBlog } from '../../engine/lib/blog.mjs';
// ⭐⭐ LE `lastmod` NE PEUT PAS ÊTRE « AUJOURD'HUI » POUR TOUT LE MONDE.
// Avant le 27/07 les 82 URL portaient la date du build : les mentions légales,
// inchangées depuis des mois, se déclaraient modifiées chaque matin. Un moteur
// apprend à ignorer un `lastmod` qui bouge partout tous les jours — et il ne
// vaut alors plus rien le jour où il dit vrai.
// `engine/data/lastmod.<site>.json` est tenu par `engine/tools/lastmod.py` (familles
// éditoriales) et `engine/tools/lastmod-prix.mjs` (fiches de prix), qui datent
// par EMPREINTE DU CONTENU et non par date de récolte.
// ⚠️ Repli volontaire sur la date du jeu de données si le fichier manque ou si
//    une clé est absente : un sitemap doit sortir, même dégradé. Le test
//    `test:lastmod` est là pour que le repli ne devienne pas la norme en
//    silence — c'est exactement ainsi qu'un défaut par repli s'installe.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ⚠️⚠️ PIÈGE PAYÉ LE 27/07 — `import.meta.url` NE SURVIT PAS AU BUNDLING.
// Première version : `new URL('../../engine/data/lastmod.json', import.meta.url)`.
// Correct en développement, faux au build : Astro regroupe ce module ailleurs,
// le chemin ne résout plus, le `catch` renvoyait {} et les 82 URL retombaient
// sur la date du build. Le correctif AVAIT L'AIR posé — le fichier existait,
// le code le lisait, le sitemap sortait — et ne servait à rien.
// `manifest.mjs` porte l'avertissement depuis toujours : « process.cwd()
// survit au bundling (import.meta.url non) ». On fait comme tout le moteur.
const RACINE = process.env.PROJECT_ROOT || process.cwd();

function journalDesDates() {
  // 🔴 UN FICHIER PAR SITE. Avant le 29/07/2026 il n'y en avait qu'un pour tout
  // le depot : veveprice lisait donc les dates ECRITES PAR LE WORKFLOW DE
  // VEVEWIKI. Ses fiches portaient la date d'un autre site, et ses index
  // retombaient sur la date du build — le defaut d'origine, intact, sur le plus
  // gros site du reseau. Le nom du fichier porte desormais celui du site.
  const p = join(RACINE, 'engine', 'data', `lastmod.${SITE}.json`);
  if (!existsSync(p)) {
    // ⭐ Bruyant, pas silencieux : le repli reste permis, mais il se voit dans
    //    le journal de build. Un repli muet est ce qui a cree le defaut.
    console.warn(`[sitemap] engine/data/lastmod.${SITE}.json absent — toutes les URL `
      + 'vont porter la date du build. Lancer engine/tools/lastmod.py '
      + 'et/ou engine/tools/lastmod-prix.mjs.');
    return { sections: {}, items: {} };
  }
  const d = JSON.parse(readFileSync(p, 'utf8'));
  if (d.site && d.site !== SITE) {
    // Ne peut arriver qu'en cas de fichier renomme a la main. On le dit fort :
    // publier les dates d'un autre site est pire que ne pas en publier.
    console.warn(`[sitemap] lastmod.${SITE}.json se declare appartenir a `
      + `« ${d.site} » — dates ignorees.`);
    return { sections: {}, items: {} };
  }
  const sections = Object.fromEntries(
    Object.entries(d.sections || {}).map(([k, v]) => [k, v.d]));
  const items = Object.fromEntries(
    Object.entries(d.items || {}).map(([k, v]) => [k, v.d]));
  return { sections, items };
}

export async function GET() {
  const ds = await dataset();
  const lastmod = new Date(ds.updatedAt).toISOString().slice(0, 10);
  const { sections: S, items: I } = journalDesDates();
  const recent = (...c) => c.filter(Boolean).sort().pop() || lastmod;

  // Chaque famille d'URL est datée par ce qui la fait VRAIMENT changer.
  const dateDe = (p) => {
    // ⭐⭐ LA DATE PROPRE À LA FICHE D'ABORD. Sans elle, les ~1 200 fiches de prix
    // partagent une seule date de famille, qui bouge dès qu'un seul prix du
    // catalogue bouge : autant dire « tout a changé aujourd'hui », tous les
    // jours. `engine/tools/lastmod-prix.mjs` en tient une PAR ADRESSE, datée
    // par ce que le visiteur verrait changer — et pas par la courbe, qui
    // gagne un point chaque jour sans que rien ne change pour lui.
    if (I[p]) return I[p];
    if (p === '/') return recent(...Object.values(S));          // l'accueil bouge dès que quoi que ce soit bouge
    if (p.startsWith('/legal/')) return recent(S.legal);
    const sec = p.split('/')[1];
    // Une fiche d'entité affiche des chiffres calculés : elle dépend de sa
    // section ET des données. Une page d'index de section, non.
    const estFiche = p.split('/').filter(Boolean).length > 1;
    return estFiche ? recent(S[sec], S.donnees) : recent(S[sec]);
  };
  const root = siteUrl();
  const { active } = locales();
  const price = priceEnabled();
  // ⭐⭐ CHAQUE ADRESSE PORTE SES LANGUES. Avant le 28/07 le sitemap croisait
  // toutes les adresses avec `active` : le jour ou une langue etait ajoutee au
  // manifeste, il declarait /es/brands/ et /es/history/ — des URL qui ne sont
  // pas construites. Un sitemap qui liste des 404 est pire qu'un sitemap
  // incomplet : il apprend au moteur a se mefier de TOUT le fichier.
  // Une section n'est publiee que dans les langues ou elle est traduite
  // (engine/lib/langues.mjs) ; la liste vient de la MEME fonction que les
  // routes et que les hreflang du gabarit, donc les trois ne peuvent pas
  // diverger.
  const langsSite = languesDuSite();
  const paths = [{ p: '/', langs: langsSite }];
  for (const d of DOCS) paths.push({ p: `/legal/${d}/`, langs: languesLegales(langsSite) });
  // Pages editoriales (wiki) : leurs sections actives.
  for (const sec of activeSections()) {
    paths.push({ p: sectionMeta(sec, active[0]).path, langs: languesDeSection(sec) });
  }
  // Les FICHES : une adresse par entite qui a passe le seuil, dans les langues
  // de LEUR section (meme slug partout).
  for (const sec of ficheSections()) {
    const langs = languesDeSection(sec);
    for (const f of await fichesDe(sec, active[0])) paths.push({ p: cheminFiche(sec, f.slug), langs });
  }
  // Pages de PRIX : uniquement si le site en publie. Leur texte vient de
  // engine/i18n (pas d'un Sheet) : elles existent dans toutes les langues du site.
  if (price) {
    // 🔴 LOT 101 — `/market/` A DISPARU DU SITEMAP EN MEME TEMPS QUE DE
    // `src/pages/`. Un sitemap qui declare une page absente n'est pas une
    // coquette : Search Console le compte comme une ERREUR d'exploration, et
    // c'est le genre d'erreur qui fait baisser la confiance accordee au
    // sitemap ENTIER. ⛔ Les 4 URL /market/ restent dans indexnow_veveprice.json
    // et c'est VOULU : ce fichier est un JOURNAL de ce qu'on a deja soumis,
    // pas une liste de ce qui existe. Le reecrire effacerait la trace.
    for (const p of ['/collections/']) paths.push({ p, langs: langsSite });
    for (const i of ds.items) paths.push({ p: i.path, langs: langsSite });
    for (const c of ds.collections.values()) paths.push({ p: `/collection/${c.slug}/`, langs: langsSite });
    // ⛔ 03/08/2026 — LES PAGES /rarity/ SONT SUPPRIMEES (arbitrage assume :
    //    404 sec, referencement perdu). `ds.rarities` SURVIT dans dataset.mjs :
    //    c'est l'index dont la vraie page Marche aura besoin pour filtrer par
    //    rarete. Une donnee derivee n'est pas une page ; on retire la page.
  }
  const entries = [];
  for (const { p, langs } of paths) {
    const alts = langs.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, p)}"/>`).join('');
    for (const l of langs) {
      entries.push(`<url><loc>${root}${localize(l, p)}</loc><lastmod>${dateDe(p)}</lastmod>${alts}</url>`);
    }
  }
  // Articles et themes : le slug DIFFERE selon la langue -> chaque entree
  // porte ses propres alternates, calcules depuis translationKey.
  // L'index d'articles n'est declare QUE dans les langues qui ont vraiment des
  // articles : ailleurs la page est en noindex, l'annoncer serait contradictoire.
  // 🔴 LOT 120 — LE PLAN DU SITE SUIT LE BLOG, PLUS `active`.
  //    `active` ne contient plus qu'`en` : ce sont les langues qui ont une
  //    adresse sur le SITE. Le blog garde `en` + `fr`. Continuer à boucler sur
  //    `active` ici aurait retiré du plan les articles français — qui EXISTENT
  //    et sont générés. ⭐⭐⭐ *Un plan du site qui omet des pages réelles est
  //    pire qu'un plan absent : il affirme que ces pages n'existent pas.*
  //    ⛔ Et l'inverse est vrai aussi : ce lot RETIRE du plan les ~9 300 URL
  //    localisées du site, parce qu'elles n'existent plus. Les deux moitiés
  //    comptent — annoncer ce qui n'existe pas, et taire ce qui existe.
  const langsBlog = await languesBlog();
  const langsAvecArticles = [];
  for (const l of langsBlog) { if ((await postsFor(l)).length) langsAvecArticles.push(l); }
  // ⭐ L'index d'articles est daté par son article le plus récent, pas par le
  // build : c'est la seule chose qui le fait vraiment changer.
  const datesArticles = [];
  for (const l of langsBlog) {
    for (const p of await postsFor(l)) {
      datesArticles.push(new Date(p.data.updated || p.data.date).toISOString().slice(0, 10));
    }
  }
  const dateBlog = datesArticles.sort().pop() || lastmod;
  for (const l of langsAvecArticles) {
    const alts = langsAvecArticles.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, '/blog/')}"/>`).join('');
    entries.push(`<url><loc>${root}${localize(l, '/blog/')}</loc><lastmod>${dateBlog}</lastmod>${alts}</url>`);
  }
  for (const l of langsBlog) {
    for (const p of await postsFor(l)) {
      const tp = await translationPaths(p.data.translationKey);
      const alts = Object.keys(tp).map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, tp[a])}"/>`).join('');
      entries.push(`<url><loc>${root}${localize(l, `/blog/${p.slug}/`)}</loc><lastmod>${new Date(p.data.updated || p.data.date).toISOString().slice(0,10)}</lastmod>${alts}</url>`);
    }
    for (const x of await tagsFor(l)) {
      // ⭐⭐ MEME SEUIL QUE BlogTag.astro, ET IL EST *LU*, PAS RECOPIE.
      // Une etiquette sous le seuil est rendue en `noindex` : l'annoncer au
      // sitemap revient a demander a Google de visiter une page qu'on lui
      // interdit d'indexer. C'est le defaut mesure le 29/07/2026 (10 pages).
      // ⭐ `tagsFor` rend deja le compte (`x.n`) : aucun recalcul ici, on lit
      // la valeur d'amont. La page, elle, continue d'exister pour le lecteur.
      if (x.n < SEUIL_INDEX_TAG) continue;
      entries.push(`<url><loc>${root}${localize(l, `/blog/tag/${x.tag}/`)}</loc><lastmod>${lastmod}</lastmod></url>`);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml' } });
}
