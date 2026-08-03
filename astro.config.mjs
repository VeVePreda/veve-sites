import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import fonctionnalitesEteintes from './engine/lib/astro_features.mjs';
import routesCompte from './engine/lib/astro_routes_compte.mjs';
import { satteri } from '@astrojs/markdown-satteri';
import figuresMarkdown from './engine/lib/figures_markdown.mjs';

// Rendu HYBRIDE : chaque site choisit son mode via la variable RENDERING
//   static  (defaut) = tout est pre-genere, aucun serveur
//   server           = les MEMES pages pre-generees + les routes qui declarent
//                      `prerender = false` (comptes, donnees live)
const mode = process.env.RENDERING || 'static';

// ⭐ `output` RESTE 'static' DANS LES DEUX MODES, ET C'EST VOLONTAIRE.
// Avec `output: 'server'`, Astro rend TOUT a la demande sauf mention contraire :
// les 458 pages perdraient leur pre-generation, donc la vitesse ET l'avantage
// SEO qui est la raison d'etre de ce reseau. En gardant 'static' et en ajoutant
// seulement l'adaptateur, la charge de la preuve s'inverse : tout reste
// pre-genere, et une route ne devient dynamique QUE si elle le declare.
//
// ⚠️ A CONNAITRE : une route `prerender = false` FAIT ECHOUER le build en mode
// static (aucun adaptateur, erreur NoAdapterInstalled). Une telle route doit
// donc conditionner son propre `prerender` au mode — cf. src/pages/api/sante.js.
export default defineConfig({
  site: process.env.SITE_URL || 'https://veveprice.com',
  output: 'static',
  adapter: mode === 'server' ? node({ mode: 'standalone' }) : undefined,
  // Retire les talons de redirection des fonctionnalites eteintes par le
  // manifeste (un wiki n'a pas de pages de prix). Sans quoi Astro emet
  // /movers/ et /collections/ en pages fantomes. Cf.
  // engine/lib/astro_features.mjs — no-op quand la fonctionnalite est active.
  // ⛔⛔ `routesCompte(mode)` — arbitrage du 31/07. Les 4 routes de compte
  // deviennent « a la demande » UNIQUEMENT en mode server. C'est ce qui fait
  // enfin tourner le middleware de session : Astro ne l'appelle que pour les
  // routes rendues a la demande, et elles etaient toutes pre-generees en
  // silence (`prerender` ecrit en EXPRESSION, jamais evaluee).
  integrations: [fonctionnalitesEteintes(), routesCompte(mode)],
  // `![legende](figure:mon-id)` dans un article .md du depot -> figure de
  // donnees tracee AU BUILD, exactement comme pour un corps venu du Sheet.
  // Une seule syntaxe pour les deux pipelines.
  // ⚠️ Astro 7 rend le Markdown avec SATTERI, pas avec remark : passer un
  //    greffon remark ici fait echouer le build en reclamant une dependance de
  //    plus (`@astrojs/markdown-remark`). On utilise donc le systeme de
  //    greffons de Satteri, deja installe. Cf. engine/lib/figures_markdown.mjs
  markdown: { processor: satteri({ mdastPlugins: [figuresMarkdown] }) },
  // ⛔⛔ `/movers/` DEVIENT `/market/` — ET NE DOIT PAS DEVENIR UN 404.
  // Les 4 adresses etaient PUBLIEES, indexees, et soumises a IndexNow (elles
  // sont dans `engine/data/indexnow_veveprice.json`). Les supprimer sans rien
  // laisser, c'est perdre leur referencement ET casser tout lien entrant.
  // ⭐ Une redirection 301 TRANSMET l'autorite de l'ancienne adresse a la
  // nouvelle. C'est la seule facon de renommer une page sans repartir de zero.
  // ⚠️ Les 4 langues, pas seulement le francais : chaque locale a sa propre
  // adresse et chacune etait indexee separement.
  redirects: {
    '/movers/':    { status: 301, destination: '/market/' },
    '/fr/movers/': { status: 301, destination: '/fr/market/' },
    '/es/movers/': { status: 301, destination: '/es/market/' },
    '/de/movers/': { status: 301, destination: '/de/market/' },
  },
  build: { format: 'directory' },
  compressHTML: true,
  devToolbar: { enabled: false },
});
