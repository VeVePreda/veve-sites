// ⚠️ VeVePreda/veve-sites — src/pages/theme-[empreinte].css.js   (NEUF — lot 105)
// ═══════════════════════════════════════════════════════════════════════════
// LA FEUILLE DE THÈME, SERVIE UNE FOIS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ POURQUOI UNE ROUTE ET PAS UNE INTÉGRATION QUI ÉCRIT DANS `dist/`.
// Une intégration ne peut écrire qu'à `astro:build:done`, c'est-à-dire APRÈS
// que les 8 484 pages portent déjà le `<link>` — et elle n'existe pas du tout
// sous `astro dev`. Le site tournerait donc NU en développement, et le premier
// à s'en apercevoir corrigerait le symptôme en réinlinant. Une route est
// rendue par le même moteur dans les deux mondes : `npm run dev` et
// `npm run build` servent le même octet.
//
// ⛔ `prerender = true` ÉCRIT EXPLICITEMENT, dans les deux modes de rendu. En
// `RENDERING=server`, `astro_routes_compte.mjs` bascule quatre routes à la
// demande ; celle-ci ne doit JAMAIS en être. Une feuille de style calculée à
// chaque requête, c'est nginx court-circuité, `immutable` sans objet, et Node
// sur le chemin critique de chaque première visite.
// ⚠️ Et l'inverse est un piège connu du dépôt : une route `prerender = false`
// FAIT ÉCHOUER le build en mode static (NoAdapterInstalled). Écrire `true`
// ferme les deux portes d'un coup.
export const prerender = true;

import { feuilleTheme } from '../../engine/lib/feuille_theme.mjs';

// ⭐ L'EMPREINTE VIENT DU CONTENU, PAS L'INVERSE. `getStaticPaths` ne rend
// qu'UN chemin — celui que `Base.astro` va écrire dans son `<link>`, calculé
// par la même fonction. Il n'y a donc pas d'accord à tenir entre deux endroits :
// il n'y a qu'un seul endroit.
export function getStaticPaths() {
  return [{ params: { empreinte: feuilleTheme().empreinte } }];
}

export function GET() {
  const { css } = feuilleTheme();
  return new Response(css, {
    headers: {
      // ⚠️ `charset=utf-8` EXPLICITE : le thème porte des contenus `content:`
      // accentués. Sans lui, un navigateur qui devine en latin-1 rend des
      // caractères cassés dans les pseudo-éléments — et nulle part ailleurs,
      // donc personne ne fait le lien.
      'content-type': 'text/css; charset=utf-8',
      // ⛔ CET EN-TÊTE NE SERT QU'À `astro dev` ET AU MODE SERVEUR. En
      // production c'est nginx qui décide (`public, max-age=2592000,
      // immutable` sur tout `.css`), et il a raison de décider : le fichier
      // porte son empreinte.
      'cache-control': 'public, max-age=2592000, immutable',
    },
  });
}
