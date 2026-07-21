import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

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
  build: { format: 'directory' },
  compressHTML: true,
  devToolbar: { enabled: false },
});
