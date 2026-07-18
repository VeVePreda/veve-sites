import { manifest } from '../../engine/lib/manifest.mjs';
// IndexNow exige que la cle soit servie a la racine du site sous <cle>.txt
export function getStaticPaths() {
  const key = manifest().seo?.indexnow_key;
  return key ? [{ params: { key } }] : [];
}
export function GET({ params }) {
  return new Response(params.key, { headers: { 'content-type': 'text/plain' } });
}
