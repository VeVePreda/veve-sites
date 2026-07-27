import { postsFor } from '../../../engine/lib/blog.mjs';
import { manifest, siteUrl } from '../../../engine/lib/manifest.mjs';
import { locales, localize, pick } from '../../../engine/lib/i18n.mjs';
import { languesBlog } from '../../../engine/lib/blog.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Un flux RSS sans le moindre article est un fichier que des lecteurs vont
// interroger tous les jours pour rien. Meme regle que l'index.
export async function getStaticPaths() {
  const { def } = locales();
  return (await languesBlog()).filter((l) => l !== def).map((l) => ({ params: { locale: l } }));
}

export async function GET({ params }) {
  const lang = params.locale;
  const m = manifest();
  const root = siteUrl();
  const posts = await postsFor(lang);
  const items = posts.map((p) => `<item><title>${esc(p.data.title)}</title><link>${root}${localize(lang, `/blog/${p.slug}/`)}</link><guid isPermaLink="true">${root}${localize(lang, `/blog/${p.slug}/`)}</guid><pubDate>${new Date(p.data.date).toUTCString()}</pubDate><description>${esc(p.data.description)}</description></item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(m.site.brand)}</title>
<link>${root}${localize(lang, '/blog/')}</link>
<description>${esc(pick(m.site.tagline, lang))}</description>
<language>${lang}</language>
<atom:link href="${root}/${lang}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
