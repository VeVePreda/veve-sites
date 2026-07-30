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
//
//  ─────────────────────────────────────────────────────────────────────────
//  DESSERRÉ LE 30/07/2026 — et c'est très exactement la ligne que le
//  commentaire d'origine désignait :
//      « Le jour où l'index couvrira le contenu éditorial (glossaire,
//        acronymes, marques, jalons, articles), c'est CETTE ligne qu'il
//        faudra desserrer — et rien d'autre dans le réseau. »
//  `src/pages/search-index.json.js` indexe désormais l'éditorial. La condition
//  devient donc : la recherche est réelle si l'index est alimenté par les prix
//  OU par l'éditorial.
//
//  ⚠️ LA FORME DU DESSERRAGE COMPTE. On n'écrit pas `return true` : ce qui
//  était garanti reste garanti. Un site qui n'a NI prix NI page éditoriale
//  mais qui écrirait `search: internal` par optimisme continue de rendre
//  `false` — donc pas de boîte, et surtout pas de `SearchAction` promis à
//  Google. La promesse reste adossée à une source, seulement il y en a deux.
//
//  ⛔ Ne PAS remplacer par `editorial.pages` non vide sans vérifier la LANGUE :
//  une section peut être déclarée au manifeste et non publiée dans une langue
//  (es/it/de n'ont que le glossaire et les acronymes). C'est l'index qui gère
//  ce détail, page par page et langue par langue ; ici on ne décide que de
//  l'existence de la fonction pour le SITE.
//  ─────────────────────────────────────────────────────────────────────────

/** Le site a-t-il des pages éditoriales susceptibles d'alimenter l'index ?
 *  Lecture du seul manifeste : aucune E/S, aucun await — cette fonction est
 *  appelée depuis le gabarit de CHAQUE page. */
export function editorialEnabled() {
  const m = manifest();
  return Array.isArray(m.editorial?.pages) && m.editorial.pages.length > 0;
}

export function searchEnabled() {
  const m = manifest();
  const mode = String(m.features?.search || 'none').trim().toLowerCase();
  if (mode === 'none' || mode === 'false' || mode === '') return false;
  return priceEnabled() || editorialEnabled();
}
