import { dataset } from '../../engine/lib/dataset.mjs';
import { siteUrl } from '../../engine/lib/manifest.mjs';
export async function GET() {
  const ds = await dataset();
  const root = siteUrl();
  const urls = ['/', '/movers/', '/collections/', '/rarity/']
    .concat(ds.items.map((i) => `/item/${i.slug}/`))
    .concat([...ds.collections.values()].map((c) => `/collection/${c.slug}/`))
    .concat([...ds.rarities.values()].map((r) => `/rarity/${r.slug}/`));
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${root}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml' } });
}
