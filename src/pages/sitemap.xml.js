import { dataset } from '../../engine/lib/dataset.mjs';
import { siteUrl } from '../../engine/lib/manifest.mjs';
import { locales, localize } from '../../engine/lib/i18n.mjs';
import { DOCS } from '../../engine/lib/legal.mjs';
import { priceEnabled } from '../../engine/lib/features.mjs';
import { activeSections, sectionMeta } from '../../engine/lib/editorial_pages.mjs';
import { ficheSections, fichesDe, cheminFiche } from '../../engine/lib/editorial_entries.mjs';
import { postsFor, tagsFor, translationPaths } from '../../engine/lib/blog.mjs';
// ⭐⭐ LE `lastmod` NE PEUT PAS ÊTRE « AUJOURD'HUI » POUR TOUT LE MONDE.
// Avant le 27/07 les 82 URL portaient la date du build : les mentions légales,
// inchangées depuis des mois, se déclaraient modifiées chaque matin. Un moteur
// apprend à ignorer un `lastmod` qui bouge partout tous les jours — et il ne
// vaut alors plus rien le jour où il dit vrai.
// `engine/data/lastmod.json` est tenu par `engine/tools/lastmod.py`, qui date
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

function datesParSection() {
  const p = join(RACINE, 'engine', 'data', 'lastmod.json');
  if (!existsSync(p)) {
    // ⭐ Bruyant, pas silencieux : le repli reste permis, mais il se voit dans
    //    le journal de build. Un repli muet est ce qui a créé le défaut.
    console.warn('[sitemap] engine/data/lastmod.json absent — toutes les URL '
      + 'vont porter la date du build. Lancer engine/tools/lastmod.py.');
    return {};
  }
  const d = JSON.parse(readFileSync(p, 'utf8')).sections || {};
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.d]));
}

export async function GET() {
  const ds = await dataset();
  const lastmod = new Date(ds.updatedAt).toISOString().slice(0, 10);
  const S = datesParSection();
  const recent = (...c) => c.filter(Boolean).sort().pop() || lastmod;

  // Chaque famille d'URL est datée par ce qui la fait VRAIMENT changer.
  const dateDe = (p) => {
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
  const paths = ['/'].concat(DOCS.map((d) => `/legal/${d}/`));
  // Pages editoriales (wiki) : leurs sections actives.
  for (const sec of activeSections()) paths.push(sectionMeta(sec, active[0]).path);
  // Les FICHES : une adresse par entite qui a passe le seuil. Elles existent
  // dans toutes les langues actives (meme slug), donc elles suivent le meme
  // traitement d'alternates que les pages ci-dessus.
  for (const sec of ficheSections()) {
    for (const f of await fichesDe(sec, active[0])) paths.push(cheminFiche(sec, f.slug));
  }
  // Pages de PRIX : uniquement si le site en publie.
  if (price) {
    paths.push('/movers/', '/collections/', '/rarity/');
    for (const i of ds.items) paths.push(i.path);
    for (const c of ds.collections.values()) paths.push(`/collection/${c.slug}/`);
    for (const r of ds.rarities.values()) paths.push(`/rarity/${r.slug}/`);
  }
  const entries = [];
  for (const p of paths) {
    for (const l of active) {
      const alts = active.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, p)}"/>`).join('');
      entries.push(`<url><loc>${root}${localize(l, p)}</loc><lastmod>${dateDe(p)}</lastmod>${alts}</url>`);
    }
  }
  // Articles et themes : le slug DIFFERE selon la langue -> chaque entree
  // porte ses propres alternates, calcules depuis translationKey.
  // L'index d'articles n'est declare QUE dans les langues qui ont vraiment des
  // articles : ailleurs la page est en noindex, l'annoncer serait contradictoire.
  const langsAvecArticles = [];
  for (const l of active) { if ((await postsFor(l)).length) langsAvecArticles.push(l); }
  // ⭐ L'index d'articles est daté par son article le plus récent, pas par le
  // build : c'est la seule chose qui le fait vraiment changer.
  const datesArticles = [];
  for (const l of active) {
    for (const p of await postsFor(l)) {
      datesArticles.push(new Date(p.data.updated || p.data.date).toISOString().slice(0, 10));
    }
  }
  const dateBlog = datesArticles.sort().pop() || lastmod;
  for (const l of langsAvecArticles) {
    const alts = langsAvecArticles.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, '/blog/')}"/>`).join('');
    entries.push(`<url><loc>${root}${localize(l, '/blog/')}</loc><lastmod>${dateBlog}</lastmod>${alts}</url>`);
  }
  for (const l of active) {
    for (const p of await postsFor(l)) {
      const tp = await translationPaths(p.data.translationKey);
      const alts = Object.keys(tp).map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, tp[a])}"/>`).join('');
      entries.push(`<url><loc>${root}${localize(l, `/blog/${p.slug}/`)}</loc><lastmod>${new Date(p.data.updated || p.data.date).toISOString().slice(0,10)}</lastmod>${alts}</url>`);
    }
    for (const x of await tagsFor(l)) {
      entries.push(`<url><loc>${root}${localize(l, `/blog/tag/${x.tag}/`)}</loc><lastmod>${lastmod}</lastmod></url>`);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml' } });
}
