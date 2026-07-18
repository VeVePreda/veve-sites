import { siteUrl } from '../../engine/lib/manifest.mjs';
export async function GET() {
  const root = siteUrl();
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${root}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
}
