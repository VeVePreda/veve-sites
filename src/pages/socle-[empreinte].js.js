// ⚠️ VeVePreda/veve-sites — src/pages/socle-[empreinte].js.js   (NEUF — lot 137)
// ═══════════════════════════════════════════════════════════════════════════
// LE SOCLE JAVASCRIPT, SERVI UNE FOIS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ POURQUOI UNE ROUTE ET PAS UNE INTÉGRATION QUI ÉCRIT DANS `dist/`.
// C'est le raisonnement de `theme-[empreinte].css.js`, et il n'a pas changé :
// une intégration ne peut écrire qu'à `astro:build:done`, c'est-à-dire APRÈS
// que les 3 097 pages portent déjà le `<script src>` — et elle n'existe pas du
// tout sous `astro dev`. Le site tournerait donc SANS SON JAVASCRIPT en
// développement, et le premier à s'en apercevoir corrigerait le symptôme en
// réinlinant. Une route est rendue par le même moteur dans les deux mondes :
// `npm run dev` et `npm run build` servent le même octet.
//
// ⛔ `prerender = true` ÉCRIT EXPLICITEMENT, dans les deux modes de rendu. En
// `RENDERING=server`, `astro_routes_compte.mjs` bascule quelques routes à la
// demande ; celle-ci ne doit JAMAIS en être. Un fichier de script calculé à
// chaque requête, c'est nginx court-circuité, `immutable` sans objet, et Node
// sur le chemin critique de chaque première visite.
// ⚠️ Et l'inverse est un piège connu du dépôt : une route `prerender = false`
// FAIT ÉCHOUER le build en mode static (NoAdapterInstalled). Écrire `true`
// ferme les deux portes d'un coup.
export const prerender = true;

import { toutLeJs } from '../../engine/lib/socle_js.mjs';

// ⭐ L'EMPREINTE VIENT DU CONTENU, PAS L'INVERSE. Chaque chemin rendu ici est
// celui qu'un gabarit va écrire dans son `<script src>`, calculé par la MÊME
// fonction. Il n'y a donc pas d'accord à tenir entre deux endroits : il n'y a
// qu'un seul endroit.
// 🔴 Deux calculs séparés auraient produit, un jour, un `<script>` vers un
// fichier absent — et un site entier sans menu, sans favoris et sans traduction,
// sans la moindre erreur au build.
//
// ⭐⭐ UNE SEULE ROUTE POUR LE SOCLE **ET** LES MODULES. Ils partagent le même
// motif de nom (`socle-<empreinte>.js`) donc la même route : le corps est
// choisi par l'empreinte demandée, pas par un second fichier à tenir à jour.
export function getStaticPaths() {
  return toutLeJs().map((f) => ({ params: { empreinte: f.empreinte }, props: { js: f.js } }));
}

export function GET({ props }) {
  const { js } = props;
  return new Response(js, {
    headers: {
      // ⚠️ `charset=utf-8` EXPLICITE : le socle porte des chaînes accentuées
      // (libellés d'accessibilité, textes de repli). Sans lui, un navigateur qui
      // devine en latin-1 rend des caractères cassés — et seulement dans le
      // texte injecté par JavaScript, donc personne ne fait le lien.
      'content-type': 'text/javascript; charset=utf-8',
      // ⛔ CET EN-TÊTE NE SERT QU'À `astro dev` ET AU MODE SERVEUR. En
      // production c'est nginx qui décide (`public, max-age=2592000, immutable`
      // sur tout `.js`, bloc `location ~* \.(css|js|…)$`), et il a raison de
      // décider : le fichier porte son empreinte.
      'cache-control': 'public, max-age=2592000, immutable',
    },
  });
}
