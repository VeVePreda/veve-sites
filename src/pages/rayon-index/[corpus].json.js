// ⚠️ VeVePreda/veve-sites — src/pages/rayon-index/[corpus].json.js   (NEUF — lot 155)
// ═══════════════════════════════════════════════════════════════════════════
//  L'INDEX DES RAYONS, SERVI EN TROIS FICHIERS STATIQUES
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ UNE ROUTE ET PAS UNE INTÉGRATION QUI ÉCRIT DANS `dist/` — c'est le
// raisonnement de `theme-[empreinte].css.js` et de `socle-[empreinte].js.js`,
// et il n'a pas changé : une intégration n'écrit qu'à `astro:build:done` et
// n'existe pas du tout sous `astro dev`. Le filtre marcherait en production et
// pas en développement, ce qui est la pire des deux.
//
// 🔴🔴🔴 CETTE ROUTE NE CONSTRUIT PLUS RIEN — ELLE SERT UN FICHIER.
// Première version : elle appelait `dataset()` puis `indexRayon()`, trois fois,
// PENDANT la génération des pages. Le build est mort sur le VPS à l'étape 31/55,
// à 187 s, après 4 189 pages sur 12 946, **sans ERROR et sans code de sortie**.
// ⇒ L'index est désormais déposé par `dataset()` (comme la projection du marché
// et l'index des vignettes), et lu ici. Le raisonnement complet, les trois pics
// mesurés et l'aveu sur le bruit de mesure vivent en tête de
// `engine/lib/rayon_index.mjs` — ⛔ ne pas le recopier ici, le lire là-bas.
//
// ⛔ `prerender = true` ÉCRIT EXPLICITEMENT, dans les deux modes de rendu.
// En `RENDERING=server`, `astro_routes_compte.mjs` bascule quelques routes à la
// demande ; celle-ci ne doit JAMAIS en être — l'index est un fichier de build,
// identique pour tout le monde, et il part au edge avec son `max-age` (règle
// nginx `location ^~ /rayon-index/`, dans les deux configurations jumelles).
// ⚠️ L'inverse est un piège connu du dépôt : une route `prerender = false` FAIT
// ÉCHOUER le build en mode static (NoAdapterInstalled). Écrire `true` ferme les
// deux portes d'un coup.
export const prerender = true;

import { priceEnabled } from '../../../engine/lib/features.mjs';
import { CORPUS, lireRayonIndex } from '../../../engine/lib/rayon_index.mjs';

// ⭐ LES TROIS CHEMINS VIENNENT DE `CORPUS`, JAMAIS D'UNE LISTE RECOPIÉE ICI.
// La barre écrit `/rayon-index/${corpus}.json` depuis la même constante, et
// `deposerRayonIndex()` boucle sur la même : il n'y a pas d'accord à tenir entre
// trois endroits, il n'y a qu'un endroit.
// 🔴 Deux listes séparées auraient produit, un jour, un `fetch` vers un fichier
// absent — et une barre de filtres qui tourne dans le vide, sans la moindre
// erreur au build.
export function getStaticPaths() {
  return CORPUS.map((corpus) => ({ params: { corpus } }));
}

// ⭐ LA CHARGE VIDE, DÉCLARÉE UNE FOIS. Le pilote sait lire « rien » (il laisse
// la pagination du serveur en place) ; il ne sait pas lire un 404 autrement
// qu'en le taisant.
const VIDE = (corpus) => JSON.stringify({ v: 1, corpus, prefixe: '', cols: [], dic: {}, total: 0, lignes: [] });

export function GET({ params }) {
  // ⛔ SOUS LA PORTE DES PRIX, ET LA GARDE EST CELLE DE `search-index.json.js`.
  // vevewiki n'a ni rayon ni catalogue de pièces : `deposerRayonIndex()` n'y a
  // rien déposé, et trois fichiers vides valent mieux que trois 404 — la route
  // existe dans les deux sites, c'est son CONTENU qui dépend de la porte.
  const corps = priceEnabled() ? lireRayonIndex(params.corpus) : VIDE(params.corpus);
  return new Response(corps, { headers: { 'content-type': 'application/json' } });
}
