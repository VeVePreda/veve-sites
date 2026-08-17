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
// ⛔ `prerender = true` ÉCRIT EXPLICITEMENT, dans les deux modes de rendu.
// En `RENDERING=server`, `astro_routes_compte.mjs` bascule quelques routes à la
// demande ; celle-ci ne doit JAMAIS en être — l'index est un fichier de build,
// identique pour tout le monde, et il doit partir au edge avec un `immutable`.
// ⚠️ L'inverse est un piège connu du dépôt : une route `prerender = false` FAIT
// ÉCHOUER le build en mode static (NoAdapterInstalled). Écrire `true` ferme les
// deux portes d'un coup.
export const prerender = true;

import { priceEnabled } from '../../../engine/lib/features.mjs';
import { dataset } from '../../../engine/lib/dataset.mjs';
import { CORPUS, indexRayon, journalIndex } from '../../../engine/lib/rayon_index.mjs';

// ⭐ LES TROIS CHEMINS VIENNENT DE `CORPUS`, JAMAIS D'UNE LISTE RECOPIÉE ICI.
// La barre écrit `/rayon-index/${corpus}.json` depuis la même constante : il n'y
// a donc pas d'accord à tenir entre deux endroits, il n'y a qu'un endroit.
// 🔴 Deux listes séparées auraient produit, un jour, un `fetch` vers un fichier
// absent — et une barre de filtres qui tourne dans le vide, sans la moindre
// erreur au build.
export function getStaticPaths() {
  return CORPUS.map((corpus) => ({ params: { corpus } }));
}

export async function GET({ params }) {
  // ⛔ SOUS LA PORTE DES PRIX, ET LA GARDE EST CELLE DE `search-index.json.js`.
  // vevewiki n'a ni rayon ni catalogue de pièces : `dataset()` y rendrait un jeu
  // vide, et trois fichiers vides serviraient à faire croire à un filtre.
  // ⭐ On rend un tableau vide plutôt qu'un 404 : le pilote sait lire « rien »
  // (il laisse la pagination du serveur en place), il ne sait pas lire un 404
  // autrement qu'en le taisant.
  if (!priceEnabled()) {
    return new Response(JSON.stringify({ v: 1, corpus: params.corpus, total: 0, cols: [], dic: {}, lignes: [] }),
      { headers: { 'content-type': 'application/json' } });
  }
  const ds = await dataset();
  const c = indexRayon(ds, params.corpus);
  // ⭐⭐ LE JOURNAL EST LA MOITIÉ DU LIVRABLE. Un index vide, ou un axe rempli à
  // 3 %, ne se voit pas sur une page : le filtre répond « aucun résultat » et a
  // l'air de marcher. Ces deux lignes le disent dans le log du build, avant le
  // déploiement — c'est ce qui a rattrapé la licence reconstruite depuis les
  // sets (6 306 comics sur 16 789).
  console.log(journalIndex(c));
  if (!c.total) {
    console.log(`[rayon-index] ATTENTION ${params.corpus} est VIDE : la barre de filtres `
      + 'se montrera et ne trouvera rien. Verifier ds.rayon / ds.collections.');
  }
  return new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } });
}
