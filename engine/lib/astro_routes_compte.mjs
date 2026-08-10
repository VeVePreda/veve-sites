// ⚠️ VeVePreda/veve-sites — engine/lib/astro_routes_compte.mjs  (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LES ROUTES DE COMPTE N'EXISTENT QU'EN MODE SERVER — arbitrage Preda, 31/07
// ═══════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QU'ON FERME. Les quatre routes dynamiques déclaraient :
//     export const prerender = process.env.RENDERING !== 'server';
// Astro exige que `prerender` soit STATIQUEMENT ANALYSABLE. Une EXPRESSION
// n'est pas évaluée : Astro retombe sur le défaut de `output:'static'`,
// c'est-à-dire `true`, et pré-génère la route EN SILENCE.
//
// CE QUE ÇA COÛTAIT, MESURÉ :
//   · /api/sante était un FICHIER FIGÉ répondant `{"ok":true}` — une sonde de
//     santé qui ne pouvait pas tomber ;
//   · /api/deconnexion ne pouvait pas effacer un cookie ;
//   · /compte/ et /connexion/ étaient statiques, donc aucune session lisible ;
//   · et surtout LE MIDDLEWARE NE S'EXÉCUTAIT SUR AUCUNE ROUTE : Astro ne
//     l'appelle que pour les routes rendues à la demande. `palierVisiteur()`
//     renvoyait donc `visitor` sur les 463 pages, toujours. Un abonné aurait
//     vu exactement la page d'un visiteur.
//
// ⭐⭐ LE BUILD LE CRIAIT DEPUIS LE DÉBUT. Astro émet, sur ces routes :
//   « `Astro.request.headers` was used… make sure that the page is
//     server-rendered using `export const prerender = false;` »
// Le message était juste. Il était noyé dans 463 lignes du MÊME avertissement,
// émis pour toutes les autres pages. ⭐ Un message correct, répété partout,
// cesse d'être un signal — c'est le bruit qui l'a caché, pas son absence.
//
// POURQUOI CETTE FORME, ET PAS UNE AUTRE.
//   ⛔ Un littéral `= false` dans le fichier FAIT ÉCHOUER le build en mode
//      static (NoAdapterInstalled) : vevewiki casserait. C'est cette
//      contrainte réelle qui avait justifié l'expression.
//   ⛔ `vite.define` ne marche pas : Astro analyse AVANT Vite (testé).
//   ⛔ Réécrire le littéral dans les fichiers avant le build « marcherait »,
//      mais le dépôt cesserait de dire la vérité sur lui-même — on a déjà payé
//      ça cher avec le CSS aplati de la maquette.
//   ✅ `astro:route:setup` est le point d'entrée OFFICIEL : Astro lit d'abord
//      l'export du fichier, puis laisse les intégrations le changer, et TRACE
//      le changement. Les fichiers gardent un littéral honnête (`true`), le
//      mode décide, et le mode vient du manifeste.
//
// ⭐ C'est la même ligne que tout le reste du moteur : le thème, la palette
// nuit, les paliers, les fontes, la place des langues sont des DONNÉES du
// manifeste. Le rendu des routes de compte en est une de plus.

const ROUTES_COMPTE = [
  'pages/compte/index.astro',
  'pages/connexion/index.astro',
  'pages/api/sante.js',
  'pages/api/deconnexion.js',
  // ⭐⭐ AJOUTÉE LE 01/08/2026 — LA ROUTE QUI REND LE MUR RÉEL.
  // Les 461 pages de contenu restent PRÉ-GÉNÉRÉES : c'est ce qui fait le
  // référencement, et le lot 24 ne les a pas touchées. Mais un `<Gate>`
  // évalué au build l'est au niveau VISITEUR, pour tout le monde — un abonné
  // voyait donc encore la page du visiteur. Cette route sert la partie
  // réservée à la demande, après lecture de la session, sans que la page
  // cesse d'être un fichier statique.
  // ⚠️ ELLE SUIT EXACTEMENT LE MÊME DISPOSITIF que les quatre au-dessus, et
  // pour la même raison : `prerender` reste un LITTÉRAL honnête dans le
  // fichier, et c'est le MODE (donc le manifeste) qui décide. L'oublier ici
  // la pré-générerait en silence — le fichier serait figé au build, à vide,
  // et répondrait « pas de session » à un abonné parfaitement connecté.
  'pages/api/historique/[uuid].js',
  // 🔴 LOT 101 — LA COTE. Même famille, même raison : elle lit `locals.palier`,
  // donc elle n'a de sens qu'en mode server. ⛔ L'oublier ici ne casse RIEN au
  // build : la route resterait pré-générée et répondrait le refus de tout le
  // monde, en silence, sur un site par ailleurs vert. C'est la panne du lot 24,
  // et c'est pour ça que `test:routes` compte les routes basculées.
  'pages/api/cote/[uuid].js',
  'pages/api/cote/lot.js',
  // ⭐⭐ AJOUTÉES LE 03/08/2026 — LOT 42.
  // `/inscription/` lit `Accept-Language` comme `/compte/` et `/connexion/` :
  // elle DOIT être à la demande, sinon elle sert la langue du build à tout le
  // monde. `/api/demo` et `/api/inscription` posent ou lisent des cookies : une
  // route pré-générée est un fichier figé, elle ne peut poser aucun en-tête.
  // 🔴 C'est littéralement la panne du lot 24 sur `/api/deconnexion`. Ajouter
  // une route de compte SANS l'inscrire ici la pré-génère EN SILENCE — le build
  // reste vert, et la fonction est morte.
  'pages/inscription/index.astro',
  'pages/api/demo.js',
  'pages/api/inscription.js',
  // ⭐⭐ AJOUTÉE AU LOT 90 — LA ROUTE QUI POSE `vp_session`.
  // ⚠️ L'oublier ici la pré-générerait EN SILENCE : elle deviendrait un
  // fichier figé, incapable de lire `?code=` et incapable de poser un cookie.
  // Le symptôme aurait été « le lien du courriel ne connecte pas », et on
  // aurait cherché du côté de veveid, qui aurait pourtant fait son travail.
  'pages/api/entrer.js',
  // ⭐⭐ LOT 44 — les modules abonnés d'Analytics. Arbitrage Preda du 03/08 :
  // TOUT est derrière le mur. Cette route lit la session et sert `.reserve/` ;
  // pré-générée, elle deviendrait un fichier figé répondant « pas de session »
  // à un abonné parfaitement connecté. C'est la panne du lot 24, mot pour mot.
  'pages/api/analytics/[module].js',
  // ⭐⭐ AJOUTÉES AU LOT 98 — la passerelle vers VeVe ID et la suppression.
  // ⚠️ Les oublier ici les pré-générerait EN SILENCE : deux fichiers figés,
  // incapables de lire un cookie, incapables de poser un en-tête. Le symptôme
  // serait « le bouton ne fait rien », et on chercherait du côté de veveid —
  // qui n'aurait jamais reçu la requête. C'est la panne du lot 24, la
  // quatrième fois qu'on l'écrit.
  'pages/api/veveid.js',
  'pages/api/supprimer.js',
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LOT 104 — LE MARCHE ET LE TABLEAU DE BORD
  // ═════════════════════════════════════════════════════════════════════════
  // ⛔⛔ CELLES-CI SONT LES PLUS DANGEREUSES DE LA LISTE, ET IL FAUT LE DIRE.
  // Les seize au-dessus, oubliees ici, deviennent MUETTES : un fichier fige qui
  // repond « pas de session » a un abonne. C'est une panne, elle se voit.
  // `/market/` oubliee ici ne devient pas muette : elle devient PUBLIQUE, et
  // elle ecrit 200 montants reserves dans `dist/`, servis en clair par nginx a
  // qui connait l'adresse. Le build reste vert, la page a l'air correcte, et
  // c'est EXACTEMENT la fuite que le lot 101 a passe une journee a fermer.
  // ⭐ Un oubli qui rend muet se decouvre par une plainte ; un oubli qui rend
  // public ne se decouvre par rien. `test:fuite` balaie tout `dist/` depuis ce
  // lot pour cette seule raison.
  // ⚠️ `market/index.astro` ET PAS `market.astro`. Le fichier restauré du
  // commit ddab4376 était à plat — c'est la forme d'avant la convention. Or
  // `test:nginx` dérive l'URL du CHEMIN : `market.astro` donne `/market`, sans
  // barre finale, et aucune règle nginx ne sert cette forme-là. ⭐ Le banc a
  // attrapé la divergence entre la convention du dépôt et un fichier venu du
  // passé — c'est exactement ce qu'un fichier restauré fait de plus dangereux :
  // il rapporte les usages de son époque, et ils ont l'air normaux.
  'pages/market/index.astro',
  'pages/[locale]/market/index.astro',
  // ❤️ LOT 118 — `/favoris/` REJOINT LE MUR. Preda, 10/08 : « pas visible en
  // public, ni dans le menu ». ⛔ L'oublier ici laisserait la page
  // PRÉ-GÉNÉRÉE : elle répondrait 200 à tout le monde, la redirection écrite
  // dans le fichier serait figée au build au niveau visiteur, et le lien
  // masqué du menu donnerait l'illusion d'une porte. C'est la panne du lot 24,
  // et c'est la même que `/dashboard/` au lot 104.
  'pages/favoris/index.astro',
  'pages/[locale]/favoris/index.astro',
  // 🧭 LOT 126 — `/dashboard/` ENTRE ICI, ET C'EST LE PREMIER DES TROIS
  // ENDROITS. Les deux autres : la regex `location` de `nginx.server.conf`, et
  // `engine/tools/test_pages.mjs`. ⛔ L'oublier ICI laisse la page
  // PRÉ-GÉNÉRÉE : elle répondrait 200 à un anonyme, et la redirection écrite
  // dans le fichier serait figée au build, au niveau visiteur. L'oublier dans
  // NGINX la laisse hors de `dist/` sans que personne la demande à Node —
  // 404, sur un build vert. Les deux pannes ont déjà été payées (lots 24, 119).
  'pages/dashboard/index.astro',
  'pages/[locale]/dashboard/index.astro',
];

const normalise = (p) => String(p || '').replace(/\\/g, '/');

export default function routesCompte(mode) {
  const serveur = mode === 'server';
  return {
    name: 'veve:routes-compte',
    hooks: {
      'astro:route:setup': ({ route, logger }) => {
        const c = normalise(route.component);
        if (!ROUTES_COMPTE.some((f) => c.endsWith(f))) return;
        // ⭐ En static : PRÉ-GÉNÉRÉES. Un site statique ne PEUT pas avoir de
        // session — ce n'est pas un réglage, c'est une propriété du rendu.
        // Les pré-générer plutôt que les supprimer garde le build vert sans
        // adaptateur, et `access.tiers: [visitor]` les fait déjà disparaître
        // de la navigation de vevewiki.
        route.prerender = !serveur;
        logger.info(`${c.split('/').slice(-2).join('/')} : `
          + (serveur ? 'à la demande (le middleware de session s\'exécute)'
                     : 'pré-générée (mode static, aucune session possible)'));
      },
    },
  };
}
