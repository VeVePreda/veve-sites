import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Rendu HYBRIDE : chaque site choisit son mode via la variable RENDERING
//   static  (defaut) = pages pre-generees, ultra rapides
//   server           = rendu cote serveur (comptes, donnees live)
const mode = process.env.RENDERING || 'static';

export default defineConfig({
  site: process.env.SITE_URL || 'https://veveprice.com',
  output: mode === 'server' ? 'server' : 'static',
  adapter: mode === 'server' ? node({ mode: 'standalone' }) : undefined,
  build: { format: 'directory' },
  compressHTML: true,
  devToolbar: { enabled: false },
});
