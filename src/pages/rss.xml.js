import { postsFor } from '../../engine/lib/blog.mjs';
import { manifest, siteUrl } from '../../engine/lib/manifest.mjs';
import { locales, localize, t } from '../../engine/lib/i18n.mjs';

// 🔴🔴 LOT J, POINT A-⑧ — LE FLUX NE PORTE PLUS LA PROMESSE DU SITE.
// ═══════════════════════════════════════════════════════════════════════════
// Il servait `site.tagline` en `<description>` : « The VeVe catalogue, with
// floor price tracking for members ». Un flux RSS ne contient QUE des articles
// — aucun montant, aucun suivi de plancher — et le HTML public n'en contient
// pas davantage. La promesse était donc fausse à l'endroit exact où elle est
// la plus difficile à reprendre : ⭐⭐ **un flux est RECOPIÉ par des
// agrégateurs qui ne repasseront pas.** Une description corrigée dans six mois
// resterait fausse chez eux pour toujours.
// ⭐ Le titre du canal gagne « — Articles » pour la même raison : « VeVe Price »
//   tout seul, dans un lecteur de flux, laisse croire que tout le site y passe.
// ⛔ `pick(m.site.tagline)` n'est PAS remplacé par une chaîne écrite ici : la
//    description du flux est une clé i18n, donc traduite dans les cinq langues
//    comme le reste. Une chaîne nue serait sortie en anglais partout (P30).

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
<title>${esc(m.site.brand)} — ${esc(t(lang, 'blog.title'))}</title>
<link>${root}${localize(lang, '/blog/')}</link>
<description>${esc(t(lang, 'blog.feed.desc'))}</description>
<language>${lang}</language>
<atom:link href="${root}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
