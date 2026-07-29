import { siteUrl } from '../../engine/lib/manifest.mjs';
import { priceEnabled, searchEnabled } from '../../engine/lib/features.mjs';

// ⭐ ON N'INTERDIT QUE CE QUI N'EST PAS DU CONTENU, ET SEULEMENT S'IL EXISTE.
// Deux adresses sont explorables et n'apprennent rien a un moteur :
//   /api/          — routes calculees (mode serveur), jamais du contenu ;
//   /search-index.json — l'index de la recherche interne, du JSON brut.
// Chaque URL exploree pour rien est prise sur le budget d'exploration des
// ~7 900 URL qui, elles, doivent etre vues. On ne les liste que si le site les
// publie : un `Disallow` vers une adresse inexistante est du bruit.
export async function GET() {
  const root = siteUrl();
  const interdits = ['/api/'];
  if (priceEnabled() && searchEnabled()) interdits.push('/search-index.json');
  const regles = interdits.map((u) => `Disallow: ${u}`).join('\n');
  return new Response(
    `User-agent: *\nAllow: /\n${regles}\n\nSitemap: ${root}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain' } });
}
