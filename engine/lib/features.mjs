// ⚠️ VeVePreda/veve-sites — engine/lib/features.mjs
// Fonctionnalités activées par le MANIFESTE. `priceEnabled()` = ce site publie-t-il
// des pages de PRIX (movers, collections, raretés, fiches) ? Vrai seulement si le
// manifeste déclare des modules de données prix (content.data_modules non vide),
// sauf override explicite `content.price: true|false`. Un wiki (data_modules vide)
// -> AUCUNE page de prix, ni dans le sitemap, ni dans la recherche.
import { manifest } from './manifest.mjs';
export function priceEnabled() {
  const m = manifest();
  if (m.content && typeof m.content.price === 'boolean') return m.content.price;
  return Array.isArray(m.content?.data_modules) && m.content.data_modules.length > 0;
}

// -----------------------------------------------------------------------------
//  RECHERCHE — ⭐ « déclarée » et « qui marche » ne sont pas la même chose
// -----------------------------------------------------------------------------
//  Constaté sur vevewiki le 27/07/2026 : le manifeste annonçait
//  `features.search: internal`, donc chacune des 32 pages publiait un
//  `WebSite.potentialAction.SearchAction` pointant vers `/?q=…` — alors que
//  l'accueil ÉDITORIAL ne rend AUCUNE boîte de recherche, et que
//  `search-index.json` renvoie `[]` dès que le site n'a pas de prix.
//  On déclarait donc à Google une fonction inexistante, sur tout le site.
//
//  ⭐ Une donnée structurée est une PROMESSE faite à un moteur. Elle doit
//     décrire ce que la page fait vraiment, pas ce que le manifeste espère.
//
//  D'où : la recherche n'est réelle que si elle est demandée ET alimentée.
//  Aujourd'hui l'index de recherche ne contient que des fiches de prix, donc
//  `searchEnabled()` exige aussi `priceEnabled()`. Le jour où l'index couvrira
//  le contenu éditorial (glossaire, acronymes, marques, jalons, articles),
//  c'est CETTE ligne qu'il faudra desserrer — et rien d'autre dans le réseau.
export function searchEnabled() {
  const m = manifest();
  const mode = String(m.features?.search || 'none').trim().toLowerCase();
  if (mode === 'none' || mode === 'false' || mode === '') return false;
  return priceEnabled();
}
