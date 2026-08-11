import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import fonctionnalitesEteintes from './engine/lib/astro_features.mjs';
import routesCompte from './engine/lib/astro_routes_compte.mjs';
import reserveAnalytics from './engine/lib/astro_reserve_analytics.mjs';
import temoinBuild from './engine/lib/astro_temoin_build.mjs';
import { satteri } from '@astrojs/markdown-satteri';
import figuresMarkdown from './engine/lib/figures_markdown.mjs';
import { siteUrl } from './engine/lib/manifest.mjs';

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
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LE 403 « Cross-site POST form submissions are forbidden » (lot 91)
// ═══════════════════════════════════════════════════════════════════════════
// LE SYMPTOME : page blanche au clic sur « créer mon compte », en production
// seulement. Le formulaire est pourtant sur le même domaine que sa cible.
//
// LE MECANISME, lu dans `astro/dist/core/app/origin-check.js` :
//     const isSameOrigin = request.headers.get("origin") === url.origin;
// Le navigateur envoie `Origin: https://veveprice.com`. Mais nginx parle
// **http** à Node (`proxy_pass http://127.0.0.1:4321`), et l'adaptateur
// reconstruit `url` depuis le protocole de la CONNEXION — donc
// `http://veveprice.com`. Deux origines identiques au schéma près : 403.
//
// ⭐⭐ nginx transmettait déjà `X-Forwarded-Proto: https`. **Astro l'IGNORE**
//    tant qu'on ne lui a pas dit à quel proxy se fier
//    (`validateForwardedHeaders`, dans `core/app/node.js` : sans
//    `allowedDomains`, l'en-tête est jeté sans un mot).
//
// ⛔ CE N'EST PAS `checkOrigin: false`. Désactiver la protection CSRF pour
//    faire passer un formulaire, c'est retirer le garde-fou au lieu de le
//    renseigner. Ici on ne l'affaiblit pas : on lui donne l'origine de
//    référence qui lui manquait, et il continue de refuser tout le reste.
//
// ⚠️ DERIVE DU MANIFESTE, jamais écrite en dur : ce moteur sert plusieurs
//    sites, et un domaine codé ici ferait échouer tous les autres — en
//    silence, et seulement en production.
const origineDuSite = (() => {
  try { return new URL(siteUrl()); }
  catch { return new URL('https://veveprice.com'); }
})();

export default defineConfig({
  site: process.env.SITE_URL || 'https://veveprice.com',
  output: 'static',
  adapter: mode === 'server' ? node({ mode: 'standalone' }) : undefined,
  security: {
    allowedDomains: [{
      protocol: origineDuSite.protocol.replace(':', ''),
      hostname: origineDuSite.hostname,
    }],
  },
  // Retire les talons de redirection des fonctionnalites eteintes par le
  // manifeste (un wiki n'a pas de pages de prix). Sans quoi Astro emet
  // /movers/ et /collections/ en pages fantomes. Cf.
  // engine/lib/astro_features.mjs — no-op quand la fonctionnalite est active.
  // ⛔⛔ `routesCompte(mode)` — arbitrage du 31/07. Les 4 routes de compte
  // deviennent « a la demande » UNIQUEMENT en mode server. C'est ce qui fait
  // enfin tourner le middleware de session : Astro ne l'appelle que pour les
  // routes rendues a la demande, et elles etaient toutes pre-generees en
  // silence (`prerender` ecrit en EXPRESSION, jamais evaluee).
  // 🔴 LOT 128 — `temoinBuild(mode)` EN DERNIER, ET L'ORDRE EST LE DISPOSITIF.
  // Il enregistre ce que le build a deposé ; il doit donc passer APRES ceux qui
  // déposent. Astro appelle `astro:build:done` dans l'ordre des intégrations.
  integrations: [fonctionnalitesEteintes(), routesCompte(mode), reserveAnalytics(mode), temoinBuild(mode)],
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
  // ═════════════════════════════════════════════════════════════════════════
  // 🔬 LOT 136 — L'IDENTITE DU BUILD, FIGEE A LA COMPILATION (P35)
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐⭐ POURQUOI ICI ET PAS DANS LA ROUTE. Le processus qui SERT n'a pas
  //   l'environnement du BUILD — c'est la lecon deja payee par `/api/sante`,
  //   qui repondait `"mode":"static"` sur un site tournant en mode server parce
  //   qu'elle lisait `process.env.RENDERING` a la requete. Une valeur de build
  //   se GRAVE dans le bundle, elle ne se lit pas plus tard.
  // ⭐ Et une horodatage calcule a la requete rendrait « maintenant » : la seule
  //   reponse qui ne renseigne sur rien.
  //
  // ⛔ `__COMMIT__` vaut `null` si le constructeur ne passe pas de SHA, et ce
  //   n'est PAS un defaut a masquer. INCONNU ≠ ZERO : `test:cache` sort
  //   INDECIDABLE sur ce point. Le jour ou Coolify (ou un `--build-arg`) fournit
  //   `SOURCE_COMMIT`, la valeur apparait sans qu'aucune ligne ne change ici.
  //   ⚠️ Les trois noms sont acceptes parce qu'on ne sait pas lequel le
  //   constructeur emploie — et le DEMANDER coute une conversation, alors que
  //   les trois accepter coute une ligne. On mesurera lequel a servi.
  vite: {
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __COMMIT__: JSON.stringify(
        process.env.SOURCE_COMMIT || process.env.GIT_COMMIT || process.env.COMMIT_SHA || null,
      ),
    },
  },
});
