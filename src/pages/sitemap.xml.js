import { dataset } from '../../engine/lib/dataset.mjs';
import { siteUrl } from '../../engine/lib/manifest.mjs';
import { locales, localize } from '../../engine/lib/i18n.mjs';
import { DOCS } from '../../engine/lib/legal.mjs';
import { postsFor, tagsFor, translationPaths } from '../../engine/lib/blog.mjs';
export async function GET() {
  const ds = await dataset();
  const lastmod = new Date(ds.updatedAt).toISOString().slice(0, 10);
  const root = siteUrl();
  const { active } = locales();
  const paths = ['/', '/movers/', '/collections/', '/rarity/'].concat(DOCS.map((d) => `/legal/${d}/`))
    .concat(ds.items.map((i) => `/item/${i.slug}/`))
    .concat([...ds.collections.values()].map((c) => `/collection/${c.slug}/`))
    .concat([...ds.rarities.values()].map((r) => `/rarity/${r.slug}/`));
  const entries = [];
  for (const p of paths) {
    for (const l of active) {
      const alts = active.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, p)}"/>`).join('');
      entries.push(`<url><loc>${root}${localize(l, p)}</loc><lastmod>${lastmod}</lastmod>${alts}</url>`);
    }
  }
  // Articles et themes : le slug DIFFERE selon la langue -> chaque entree
  // porte ses propres alternates, calcules depuis translationKey.
  // L'index d'articles n'est declare QUE dans les langues qui ont vraiment des
  // articles : ailleurs la page est en noindex, l'annoncer serait contradictoire.
  const langsAvecArticles = [];
  for (const l of active) { if ((await postsFor(l)).length) langsAvecArticles.push(l); }
  for (const l of langsAvecArticles) {
    const alts = langsAvecArticles.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, '/blog/')}"/>`).join('');
    entries.push(`<url><loc>${root}${localize(l, '/blog/')}</loc><lastmod>${lastmod}</lastmod>${alts}</url>`);
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
