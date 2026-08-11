// ⚠️ VeVePreda/veve-sites — engine/lib/cache_attendu.mjs   (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
//  LA DÉCLARATION DU CACHE — qui a le DROIT d'être servi depuis le bord
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EXISTE *AVANT* LA RÈGLE.
// La Cache Rule de Cloudflare ne vit pas dans ce dépôt — comme les en-têtes de
// sécurité, elle vit dans l'interface (Zone → Caching → Cache Rules). Le jour
// où quelqu'un l'élargit d'un cran, ou coche « Ignore cache-control », une page
// de compte peut se retrouver servie à un inconnu. Le build serait vert, la CI
// verte, le site parfaitement fonctionnel — et la fuite muette.
// ⇒ Ce fichier DÉCLARE ce qui a le droit d'être mis en cache et ce qui ne l'a
//   JAMAIS ; `engine/tools/test_cache.mjs` le RÉCLAME sur la production.
//
// ⛔⛔ L'ORDRE N'EST PAS NÉGOCIABLE : LE BANC, PUIS LA RÈGLE. Une page de compte
// mise en cache par erreur est la fuite la plus chère possible de ce réseau —
// elle ne casse rien, elle ne rougit nulle part, et elle sert le compte d'un
// membre à qui passe. Un banc écrit APRÈS la règle ne mesure plus le passage
// dangereux : il constate un état déjà installé.
//
// ⭐ SI VOUS MODIFIEZ LA RÈGLE DANS CLOUDFLARE, MODIFIEZ CE FICHIER DANS LE
//   MÊME GESTE. À partir de l'instant où les deux divergent, l'un des deux ment.
//   C'est exactement la leçon du plancher de la chaîne de bancs, resté à 25
//   pendant qu'elle montait à 40 : il autorisait quinze suppressions en silence.

// ⭐ LES ZONES SONT ÉCRITES UNE FOIS, PAS DEUX. Elles sont déjà déclarées pour
//   les en-têtes ; les recopier ici, ce serait fabriquer le « deux gabarits qui
//   rendent la même liste et divergent » que ce projet a déjà payé trois fois.
//   Le jour où une troisième zone apparaît, elle apparaît pour les deux bancs.
import { ZONES, PASSAGES, PAUSE_MS, DELAI_MS, METHODE } from './entetes_attendus.mjs';

export { ZONES, PASSAGES, PAUSE_MS, DELAI_MS, METHODE };

// ═══════════════════════════════════════════════════════════════════════════
// 1. L'INTERRUPTEUR — « la règle est-elle posée ? »
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 CE BOOLÉEN EST LA MOITIÉ DÉPÔT D'UN GESTE QUI SE FAIT DANS CLOUDFLARE.
// Tant qu'il vaut `false`, le banc CONSTATE que les pages publiques ne sont pas
// en cache et il le dit — sans rougir, parce qu'un banc qui rougit pour un
// travail qu'on n'a pas encore fait apprend à tout le monde à ignorer sa
// couleur.
// Dès qu'il vaut `true`, le banc EXIGE le `HIT` : si la règle disparaît, si
// quelqu'un la désactive, si un réglage la neutralise, il rougit le jour même.
//
// ⛔⛔ LE BASCULER FAIT PARTIE DE LA POSE DE LA RÈGLE, au même titre que le clic.
//   Une règle posée sans ce bascule est une règle que personne ne surveille ;
//   un bascule sans la règle est un banc rouge pour rien. Les deux, ou aucun.
//   ⭐ C'est le même dispositif que le `plancher` de HSTS, et pour la même
//   raison : un état qui vit hors du dépôt n'existe pour le dépôt que si
//   quelqu'un l'y écrit à la main, le jour même.
export const CACHE_RULE_POSEE = true;

// ═══════════════════════════════════════════════════════════════════════════
// 2. LE RÉGLAGE CHOISI — TTL court, aucune purge
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ DÉCISION DE PREDA (11/08/2026) : Edge TTL de 5 minutes, PAS de purge.
//   Le raisonnement, et il est mesurable : une page servie 300 s depuis le bord
//   au lieu de frapper l'origine à chaque visite, c'est déjà l'essentiel du
//   gain (3 097 pages pré-générées, TTFB mesuré 98–164 ms). Un TTL long
//   ajouterait quelques millisecondes et exigerait un jeton d'API Cloudflare,
//   une étape de purge, et — surtout — un chemin de panne NEUF : une purge qui
//   échoue en silence sert du périmé pendant 24 h sans que rien ne rougisse.
// ⭐⭐ On achète l'essentiel du gain sans ouvrir de risque nouveau. Le reste se
//   re-questionnera quand il sera MESURÉ, pas avant.
export const TTL_EDGE_S = 300;

// 🪜 L'échelle, pour que la montée soit un palier connu et pas une improvisation.
//   ⚠️ Contrairement à HSTS, celle-ci est RÉVERSIBLE : on peut redescendre, et
//   un cache se vide. C'est précisément ce qui autorise à commencer bas.
export const ECHELLE_TTL = [0, 300, 3600, 86400];

// ⏱️ Combien de retard un visiteur peut-il voir après un déploiement ?
//   Le banc s'en sert pour juger la fraîcheur de ce qui est servi (§ 5). On
//   accorde le TTL plus une marge de propagation : au-delà, ce n'est plus du
//   cache, c'est un déploiement qui n'arrive pas.
export const RETARD_TOLERE_S = TTL_EDGE_S + 600;

// ═══════════════════════════════════════════════════════════════════════════
// 3. CE QUI NE DOIT JAMAIS ÊTRE MIS EN CACHE
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 LE DOSSIER DISAIT « `/compte/` ET `/market/` ». MESURÉ LE 11/08/2026 :
// `ROUTES_COMPTE` EN COMPTE **VINGT**. Un banc qui n'aurait réclamé que les deux
// pages nommées aurait laissé dix-huit portes sans personne pour les demander —
// et c'est le profil exact de la panne que ce projet paie le plus souvent : un
// contrôle qui ne regarde que ce qu'on lui a cité ne voit jamais ce qu'on a
// oublié de citer.
// ⇒ Le § 1 du banc VÉRIFIE que cette liste couvre encore `ROUTES_COMPTE`. Le
//   jour où un lot ajoute une route de compte sans venir ici, il rougit.
//   C'est `regle-circuit-ouvert` : « qui écrit, qui lit ? »
//
// ⛔⛔ ET ELLES NE CONCERNENT QU'UNE ZONE — MESURÉ, PAS SUPPOSÉ.
// `vevewiki.com` tourne en `rendering: static` et n'a **pas d'espace membre**
// (gelé, ne se re-questionne pas). Mesuré le 11/08 : `/compte/`, `/market/` et
// `/connexion/` y rendent **404**. Une liste unique pour les deux zones aurait
// fait rougir le banc sur vevewiki pour une raison qui n'est pas la sienne —
// et un banc qui rougit à tort finit par être ignoré quand il a raison.
//
// ⭐ `attendu` dit ce que la route doit prouver :
//   'no-store'   — la réponse elle-même refuse le stockage (le cas fort)
//   'jamais-hit' — on n'exige pas la directive, seulement qu'aucun
//                  `cf-cache-status: HIT` ne sorte. Réservé aux réponses qui
//                  n'ont aucun en-tête de cache (voir `/api/deconnexion`).
export const PRIVEES = [
  // — les pages qui lisent une session —
  { chemin: '/compte/', attendu: 'no-store', quoi: 'le compte du membre' },
  { chemin: '/market/', attendu: 'no-store', quoi: 'le marché, réservé aux membres' },
  { chemin: '/favoris/', attendu: 'no-store', quoi: 'les favoris du membre' },
  { chemin: '/dashboard/', attendu: 'no-store', quoi: 'le tableau de bord' },
  // ⭐ Ces deux-là rendent 200, pas 302 — elles sont donc les plus exposées :
  //   une réponse 200 est ce qu'un cache aime mettre de côté, et elles lisent
  //   `Accept-Language`, donc elles diffèrent d'un visiteur à l'autre.
  { chemin: '/connexion/', attendu: 'no-store', quoi: 'la page de connexion (lit Accept-Language)' },
  { chemin: '/inscription/', attendu: 'no-store', quoi: "la page d'inscription (lit Accept-Language)" },
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LES VARIANTES LOCALISÉES — TROUVÉES PAR LE BANC, PAS PAR UN AUDIT
  // ═════════════════════════════════════════════════════════════════════════
  // Le § 1 a refusé la première version de cette liste : `ROUTES_COMPTE` porte
  // `pages/[locale]/market/`, `pages/[locale]/favoris/` et
  // `pages/[locale]/dashboard/`, et aucune famille ne les couvrait.
  // ⇒ MESURÉ ENSUITE, ET C'EST LE POINT QUI COMPTE : elles RÉPONDENT.
  //   `/fr/market/`, `/es/market/`, `/de/favoris/` et `/fr/dashboard/` rendent
  //   toutes **302 + `private, no-store`** en production (11/08/2026).
  // ⛔⛔ CONSÉQUENCE DIRECTE SUR LA CACHE RULE : une exclusion écrite
  //   « le chemin commence par /market/ » NE COUVRE PAS `/fr/market/`. Il faut
  //   que la règle attrape aussi le préfixe de langue, sinon quatre langues
  //   d'interface ouvrent quatre portes que personne ne garde.
  // ⭐⭐ Et c'est le circuit fermé qui l'a dit : le banc a lu `ROUTES_COMPTE`,
  //   trouvé trois routes sans réclamant, et la mesure a montré qu'elles
  //   n'étaient pas théoriques. *Un audit ne voit que ce qu'il ouvre ; un
  //   circuit fermé, lui, ouvre ce qu'on a oublié de lui citer.*
  { chemin: '/fr/market/', attendu: 'no-store', quoi: 'le marché en français (préfixe de langue)' },
  { chemin: '/es/favoris/', attendu: 'no-store', quoi: 'les favoris en espagnol (préfixe de langue)' },
  { chemin: '/de/dashboard/', attendu: 'no-store', quoi: 'le tableau de bord en allemand (préfixe de langue)' },

  // — les routes d'API —
  { chemin: '/api/sante', attendu: 'no-store', quoi: 'la sonde' },
  // 🔴 MESURÉ LE 11/08 ET C'EST UN TROU, ÉCRIT COMME TEL : `/api/deconnexion`
  //   rend 405 SANS AUCUN `cache-control`. Une réponse qui ne dit rien sur son
  //   stockage est à la merci de la première règle qui décide pour elle. On ne
  //   peut pas exiger `no-store` sans toucher la route ; on exige donc au
  //   minimum qu'elle ne soit JAMAIS servie depuis le bord.
  // ⭐ Un défaut nommé dans une déclaration a une chance d'être réparé ; un
  //   défaut qu'on arrondit disparaît de la mémoire du projet.
  { chemin: '/api/deconnexion', attendu: 'jamais-hit', quoi: 'la déconnexion (405 sans cache-control — trou connu, 11/08)' },
];

// ⛔ La zone qui porte l'espace membre. Une seule, et c'est gelé.
export const ZONE_MEMBRE = 'veveprice.com';

// ⭐⭐ ET LE CONTRÔLE INVERSE, CELUI QUI NE COÛTE RIEN ET QUI DIT BEAUCOUP.
//   Sur vevewiki, ces adresses doivent rendre 404 — c'est-à-dire NE PAS
//   EXISTER. Le jour où l'une d'elles répondrait 200, ce serait qu'un espace
//   membre s'est glissé sur un site qui n'en a pas, et le cache le diffuserait.
//   Un banc qui ne regarde que ce qui existe ne voit jamais ce qui apparaît.
export const ABSENTES_HORS_MEMBRE = ['/compte/', '/market/', '/connexion/', '/favoris/'];

// ⭐⭐ LE MOTIF QUI RATTACHE UNE ADRESSE À `ROUTES_COMPTE`.
//   Le § 1 du banc lit `astro_routes_compte.mjs` COMME UN TEXTE et vérifie que
//   chaque famille de routes de compte a un représentant ci-dessus. On ne teste
//   pas les vingt fichiers un par un — `/api/cote/[uuid]` n'a pas d'adresse
//   fixe — on teste que chaque FAMILLE est réclamée par quelqu'un.
export const FAMILLES_COMPTE = [
  { source: 'pages/compte/', couvertPar: '/compte/' },
  { source: 'pages/connexion/', couvertPar: '/connexion/' },
  { source: 'pages/inscription/', couvertPar: '/inscription/' },
  { source: 'pages/market/', couvertPar: '/market/' },
  { source: 'pages/favoris/', couvertPar: '/favoris/' },
  { source: 'pages/dashboard/', couvertPar: '/dashboard/' },
  { source: 'pages/api/', couvertPar: '/api/sante' },
  // ⭐ Les trois familles que la première version de ce fichier avait oubliées.
  //   Chacune est réclamée par une adresse dans une langue DIFFÉRENTE : si les
  //   trois pointaient vers `/fr/…`, on ne saurait rien des trois autres
  //   préfixes, et « je n'ai testé qu'une langue » se lirait « les langues sont
  //   couvertes ».
  { source: 'pages/[locale]/market/', couvertPar: '/fr/market/' },
  { source: 'pages/[locale]/favoris/', couvertPar: '/es/favoris/' },
  { source: 'pages/[locale]/dashboard/', couvertPar: '/de/dashboard/' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. CE QUI DOIT ÊTRE MIS EN CACHE (une fois la règle posée)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ POURQUOI CES PAGES-LÀ SONT SÛRES, ET C'EST MESURÉ, PAS SUPPOSÉ.
// Elles sont PRÉ-GÉNÉRÉES : un fichier écrit au build, identique pour tout le
// monde par construction. Le lot 129 a rendu ce cache possible en déplaçant la
// traduction de l'interface chez le visiteur — avant lui, la même adresse
// pouvait rendre quatre HTML différents.
// 🔬 Contre-épreuve mesurée le 11/08/2026 : `/` et `/sets/` reviennent
//   IDENTIQUES OCTET POUR OCTET avec et sans cookie de session (117 733 o), sans
//   `Set-Cookie`, avec `vary: Accept-Encoding` seul. Le § 4 du banc REJOUE cette
//   mesure à chaque passage — parce que la fuite ne viendra pas du cache
//   lui-même, elle viendra du jour où une page publique se mettra à
//   personnaliser son contenu, et ce jour-là le cache la diffusera à tous.
//
// ⛔ LES DEUX ZONES N'ONT PAS LES MÊMES PAGES. Mesuré le 11/08 : `/collections/`
//   rend 404 sur vevewiki. Une liste commune aurait fait échouer le banc sur une
//   page qui n'a jamais existé — « un banc peut rougir pour de mauvaises
//   raisons », et celle-là aurait coûté une heure à chercher dans le cache.
export const PUBLIQUES_PAR_ZONE = {
  'veveprice.com': [
    { chemin: '/', quoi: "l'accueil" },
    { chemin: '/sets/', quoi: 'la grille des sets (878 Ko bruts — la plus lourde)' },
    { chemin: '/collections/', quoi: 'les collections' },
  ],
  'vevewiki.com': [
    { chemin: '/', quoi: "l'accueil" },
    { chemin: '/sets/', quoi: 'les sets' },
    { chemin: '/brands/', quoi: 'les marques' },
  ],
};

// ⭐ Les `vary` tolérés sur une page publique.
//   ⛔ Un `Set-Cookie` sur une page publique interdit le cache partagé : il
//   serait servi au visiteur suivant. Cloudflare refuse d'ailleurs par défaut de
//   mettre en cache une réponse qui en porte un — mais on ne délègue pas la
//   garde d'une fuite à la politique par défaut d'un tiers, qui peut changer
//   sans nous prévenir et sans qu'aucun de nos fichiers ne bouge.
export const VARY_TOLERES = ['accept-encoding'];

// ═══════════════════════════════════════════════════════════════════════════
// 5. LA FRAÎCHEUR — P35, et elle devient urgente le jour du cache
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 « QUELLE VERSION VOIT UN VISITEUR ? » EST AUJOURD'HUI INDÉCIDABLE, et le
// cache rend cette question centrale : avec le bord qui répond, un déploiement
// peut réussir sans que personne ne le voie. C'est la panne P35 déguisée en
// succès — deux versions servies en parallèle, sauf qu'ici la seconde version
// est une copie figée dans un cache.
// ⇒ `/api/sante` porte désormais l'horodatage du build (et le commit, s'il est
//   fourni au build). Le banc compare ce que la sonde annonce à ce que l'accueil
//   sert dans son `<meta name="build-time">`.
//
// ⛔ `commit` peut être `null` : rien ne garantit que le constructeur passe un
//   SHA. ⭐ INCONNU ≠ ZÉRO — sur ce point le banc rend INDÉCIDABLE, jamais vert.
export const SONDE = '/api/sante';
export const META_BUILD = 'build-time'; // <meta name="build-time"> du gabarit
