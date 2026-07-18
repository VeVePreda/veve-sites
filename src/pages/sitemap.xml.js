import { dataset } from '../../engine/lib/dataset.mjs';
import { siteUrl } from '../../engine/lib/manifest.mjs';
import { locales, localize } from '../../engine/lib/i18n.mjs';
export async function GET() {
  const ds = await dataset();
  const root = siteUrl();
  const { active } = locales();
  const paths = ['/', '/movers/', '/collections/', '/rarity/']
    .concat(ds.items.map((i) => `/item/${i.slug}/`))
    .concat([...ds.collections.values()].map((c) => `/collection/${c.slug}/`))
    .concat([...ds.rarities.values()].map((r) => `/rarity/${r.slug}/`));
  const entries = [];
  for (const p of paths) {
    for (const l of active) {
      const alts = active.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, p)}"/>`).join('');
      entries.push(`<url><loc>${root}${localize(l, p)}</loc>${alts}</url>`);
    }
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml' } });
}
