import { postsFor } from '../../engine/lib/blog.mjs';
import { manifest, siteUrl } from '../../engine/lib/manifest.mjs';
import { locales, localize, pick } from '../../engine/lib/i18n.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET() {
  const m = manifest();
  const root = siteUrl();
  const lang = locales().def;
  const posts = await postsFor(lang);
  const items = posts.map((p) => `<item><title>${esc(p.data.title)}</title><link>${root}${localize(lang, `/blog/${p.slug}/`)}</link><guid isPermaLink="true">${root}${localize(lang, `/blog/${p.slug}/`)}</guid><pubDate>${new Date(p.data.date).toUTCString()}</pubDate><description>${esc(p.data.description)}</description></item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(m.site.brand)}</title>
<link>${root}${localize(lang, '/blog/')}</link>
<description>${esc(pick(m.site.tagline, lang))}</description>
<language>${lang}</language>
<atom:link href="${root}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
