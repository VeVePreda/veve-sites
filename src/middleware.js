// ⚠️ VeVePreda/veve-sites — src/middleware.js  (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LA PIÈCE QUI MANQUAIT — le middleware de session.
// ═══════════════════════════════════════════════════════════════════════════
// `engine/lib/access.mjs` l'attendait explicitement :
//     « `locals` = `Astro.locals`, où le FUTUR MIDDLEWARE DE SESSION déposera
//       le palier. Absent aujourd'hui => visitor. »
// Tant qu'il n'existe pas, TOUT LE MONDE est visiteur : la matrice de paliers
// tourne à vide, les portes se ferment pour tous, et aucun compte ne peut
// exister. C'est la clé de voûte de l'espace membres, et elle tient en 60 lignes.
//
// ⛔ CE FICHIER NE FAIT PAS L'AUTHENTIFICATION. Il ne fait que LIRE une session
// déjà émise et en déduire un palier. Émettre la session (mot de passe, lien
// magique, VEVE-ID) est un autre lot, et il vit ailleurs — cf. §Auth du
// LISEZ-MOI. Confondre « qui es-tu » et « à quoi as-tu droit » est la faute qui
// produit les failles d'élévation de privilège.
//
// ⚠️ EN MODE `static`, CE FICHIER NE S'EXÉCUTE JAMAIS. Astro n'appelle le
// middleware que pour les routes rendues à la demande. Un site statique reste
// donc intégralement public — ce qui est correct, et ce qu'il faut savoir avant
// de croire qu'une page est protégée parce qu'elle est « derrière un palier ».

import { PALIERS } from '../engine/lib/access.mjs';
// 👓 LOT 187 — « voir comme ». ⚠️ Importé ICI et pas dans `access.mjs` : ce
// module lit la SESSION, et `access.mjs` ne doit rien savoir des sessions
// (c'est la séparation « qui es-tu » / « à quoi as-tu droit », posée le 06/08
// et payée par trois fausses pannes).
import { lirePalierVu } from '../engine/lib/palier_vu.mjs';

const COOKIE = 'vp_session';

// ⭐ LE PALIER NE VIENT JAMAIS DU COOKIE EN CLAIR. Un cookie `palier=whale`
// serait modifiable par n'importe qui depuis la console du navigateur : ce
// serait vendre un abonnement en le laissant sur la table. Le cookie ne porte
// qu'un IDENTIFIANT DE SESSION opaque ; le palier se relit à la source.
async function palierDeLaSession(sid, env) {
  if (!sid) return null;
  const base = env?.SESSION_API || process.env.SESSION_API;
  // Pas de service de session configuré : on ne devine pas, on ferme.
  // ⛔ Un repli « par défaut membre » transformerait une panne de réseau en
  // distribution gratuite de l'abonnement.
  if (!base) return null;
  try {
    const r = await fetch(`${base}/session/${encodeURIComponent(sid)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(1500),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (typeof j?.palier !== 'string') return null;
    // 🔔 LOT 201 — LE COMPTE À REBOURS VOYAGE AVEC LE PALIER, DANS LA MÊME
    //   RÉPONSE. La bannière « votre accès se termine dans N jours » a besoin
    //   d'un entier ; cette requête est DÉJÀ payée à chaque page rendue à la
    //   demande. Un second appel l'aurait doublée — sur `/market/`, qui est
    //   `no-store`, donc repayée à chaque visite.
    // ⚠️ `null` SI LE SERVICE NE LE DIT PAS. Un veveid plus ancien que ce site
    //   ne renvoie pas ce champ : `?? null` le distingue de « zéro jour »,
    //   sinon la bannière annoncerait une fin de droits à tous les abonnés
    //   pendant le temps du déploiement décalé des deux dépôts.
    const n = j?.jours_restants;
    return { palier: j.palier, jours: Number.isFinite(n) ? Number(n) : null };
  } catch {
    // ⚠️ ÉCHOUER FERMÉ. Un `catch` qui rendrait « member » serait exactement le
    // défaut de `getattr(…, ())` qui a mal étiqueté 216 838 transferts : une
    // erreur silencieuse qui produit une valeur plausible au lieu d'un refus.
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🗑️ LOT 161 — LA SESSION DE DÉMONSTRATION A ÉTÉ RETIRÉE (demande `r` de Preda)
// ═══════════════════════════════════════════════════════════════════════════
// Il y avait ici `palierDeDemonstration()` et, plus bas, la lecture d'un jeton
// nominatif signé. Les deux sont partis avec `engine/lib/demo_session.mjs` et
// `src/pages/api/demo.js`. ⭐ Mesuré avant de couper : `access.demo` était déjà
// commenté dans le manifeste depuis le 06/08, et AUCUNE mention n'était plus
// servie en production (5 pages sondées le 24/08, zéro occurrence).
//
// ⛔ CE QUI RESTE, ET QUI N'EST PAS LA DÉMO : `if (context.isPrerendered)`,
//    quelques lignes plus bas. Son commentaire raconte la panne du 03/08 où la
//    démo teintait 374 pages pré-générées — mais la règle qu'il protège vaut
//    pour TOUT palier, pas seulement pour celui-là. Une page pré-générée est le
//    même fichier pour tout le monde : lui attribuer un visiteur reste une
//    contradiction, démo ou pas. ⭐⭐ RETIRER UN MÉCANISME NE RETIRE PAS LE
//    GARDE-FOU QU'IL A FAIT ÉCRIRE.

export async function onRequest(context, next) {
  const env = context.locals?.runtime?.env;
  const sid = context.cookies.get(COOKIE)?.value || null;

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LE MIDDLEWARE TOURNE AUSSI PENDANT LE BUILD — corrigé le 03/08/2026.
  // ═══════════════════════════════════════════════════════════════════════════
  // Mon A-LIRE du lot 34 affirmait : « la démo ne concerne que les routes
  // rendues à la demande ; les pages pré-générées ne passent pas par le
  // middleware ». C'ÉTAIT FAUX, et c'était déjà déployé.
  //
  // MESURÉ, pas supposé : avec `access.demo: crevette`, une sonde dans un
  // composant pré-généré affiche `locals = {"palier":"crevette"}` AU BUILD.
  // Conséquence : 374 pages sur 447 changeaient — les bandeaux d'abonnement
  // (`sceau`) disparaissaient du HTML statique, pour tout le monde et pour
  // Google.
  //
  // ✅ CE QUI N'EST PAS ARRIVÉ, ET POURQUOI : aucune donnée réservée n'a fuité.
  // L'historique complet vit dans `.reserve/`, HORS de `dist/` (lot 27), et il
  // n'arrive que par `/api/historique/[uuid]`. C'est l'architecture qui a tenu,
  // pas le contrôle d'accès — et il faut le dire dans cet ordre.
  //
  // ⭐⭐ UNE PAGE PRÉ-GÉNÉRÉE N'A PAS DE VISITEUR. Lui attribuer un palier est
  // une contradiction : le fichier produit est le MÊME pour tout le monde et
  // pour toujours. Un palier qui vaut « crevette » pour un fichier servi à un
  // anonyme n'est pas un droit, c'est une fuite qui n'a pas encore eu lieu.
  // ⛔ NE PAS « corriger » ça dans chaque composant en appelant un
  //    `franchitVisiteur()` : trente gabarits devraient y penser, et le
  //    trente-et-unième oubliera. La règle vit ICI, en un seul endroit.
  if (context.isPrerendered) return next();

  // ⭐⭐ LE SEUL ENDROIT DU DÉPÔT QUI SAIT SI LA PAGE A UN VISITEUR — lot 97.
  // ⛔ NE PAS remplacer ça par `Astro.isPrerendered` dans les gabarits : cette
  // propriété change de nom et de sémantique d'une version majeure à l'autre,
  // et une page qui se trompe ICI se ferme à tout le monde (ou s'ouvre à tout
  // le monde) sans erreur. Le drapeau est posé par le code du dépôt, juste
  // sous la ligne qui décide — les deux se relisent ensemble.
  // ⭐ Il vaut `undefined` sur les ~8 500 pages pré-générées : le `return`
  // au-dessus n'arrive jamais ici. C'est précisément ce qu'on veut lire.
  context.locals.rendu = 'demande';

  // ═══════════════════════════════════════════════════════════════════════════
  // L'ORDRE DE CES TROIS SOURCES EST UN CHOIX DE SÉCURITÉ — lot 42, 03/08/2026
  // ═══════════════════════════════════════════════════════════════════════════
  //   1. la SESSION RÉELLE       — la seule qui vaudra en production ;
  //   2. le JETON DE DÉMO signé  — nominatif, il faut la clé pour l'obtenir ;
  //   3. la DÉMO DU MANIFESTE    — collective, elle vaut pour tout le monde.
  //
  // ⭐ DU PLUS SPÉCIFIQUE AU PLUS GÉNÉRAL, et jamais l'inverse. Si la démo
  // collective passait devant, un jeton nominatif « whale » serait écrasé par
  // le « crevette » du manifeste, et on chercherait longtemps pourquoi.
  // ⛔ Les trois s'effacent devant `SESSION_API` : `palierDeLaSession()` parce
  // qu'elle EST le service, les deux autres parce qu'elles ne tiennent la place
  // que d'un service absent. Cette condition vit dans les modules appelés, pas
  // ici : la dupliquer serait s'offrir une occasion de l'oublier d'un côté.
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LE PALIER ET LA SESSION SONT DEUX QUESTIONS — séparées le 06/08/2026.
  // ═══════════════════════════════════════════════════════════════════════════
  // CE QUE ÇA A COÛTÉ. Avec `access.demo: crevette`, tout visiteur PORTAIT un
  // palier. L'interface, qui n'avait qu'une variable, en concluait « cette
  // personne est connectée » : `/connexion/` répondait « vous êtes déjà
  // connecté », `/inscription/` se mettait en mode connecté, et le bouton de
  // déconnexion effaçait un cookie qui n'avait jamais existé. Preda a vu trois
  // pannes ; il n'y en avait aucune — une seule variable répondait à deux
  // questions, et elle répondait juste à la mauvaise.
  //
  // ⭐⭐⭐ LE PALIER DIT CE QU'ON A LE DROIT DE VOIR. LA SESSION DIT QUI ON EST.
  // La distinction reste, et elle a coûté trois fausses pannes à Preda : elle
  // ne dépendait pas du mécanisme retiré au lot 161, elle dépend du fait qu'une
  // seule variable ne peut pas répondre à deux questions.
  //
  // ⚠️ `locals.session` reste ABSENTE sur les ~8 500 pages pré-générées (le
  // middleware sort plus haut sur `isPrerendered`). C'est correct et voulu : une
  // page pré-générée n'a pas de visiteur, elle doit donc porter l'appel à
  // l'inscription — celui de quelqu'un qui n'est pas connecté.
  //   'reelle' -> une vraie session, chez le service d'identité
  //   absente  -> personne.
  // 🗑️ LOT 161 — il y avait ici une troisième valeur, 'demo'. Elle est partie
  // avec le mécanisme. ⚠️ `locals.session` n'a donc plus que DEUX états, et
  // tout ce qui testait `session === 'demo'` a été retiré dans le même geste
  // (`src/pages/compte/index.astro`) : une valeur qu'on cesse d'écrire et un
  // test qu'on laisse vivre, c'est une branche morte qui a l'air active.
  const etat = await palierDeLaSession(sid, env);
  const reelle = etat ? etat.palier : null;
  const brut = reelle;
  if (reelle) context.locals.session = 'reelle';
  // ⭐ DÉPOSÉ TEL QUEL, SANS SEUIL. C'est la PAGE qui décide à partir de quand
  //   elle prévient (cinq jours, l'arbitrage de Preda) : un seuil appliqué ici
  //   serait un second endroit où le nombre cinq vit, et le jour où il change
  //   l'un des deux resterait en arrière.
  // ⛔ Et il n'existe QUE pour une session réelle : sur les ~8 500 pages
  //   pré-générées, `locals` est figé au build — y écrire un compte à rebours
  //   servirait le même chiffre à tout le monde, pour toujours.
  if (reelle) context.locals.joursRestants = etat.jours;

  // ⭐ On dépose la valeur BRUTE. C'est `palierVisiteur()` d'access.mjs qui
  // décide ce qu'elle vaut : il vérifie qu'elle existe, qu'elle est déclarée
  // dans `access.tiers` du site, et il RAMÈNE À VISITOR sinon, en le disant.
  // Dupliquer ce contrôle ici en ferait la deuxième source de vérité, et deux
  // sources de vérité sur un droit d'accès finissent toujours par diverger.
  if (brut && PALIERS.includes(brut)) context.locals.palier = brut;

  // ═══════════════════════════════════════════════════════════════════════════
  // 👓 LOT 187 — « VOIR COMME » : LE PALIER D'OBSERVATION SE POSE ICI, ET
  //    SEULEMENT APRÈS QUE LE PALIER RÉEL A ÉTÉ ÉTABLI.
  // ═══════════════════════════════════════════════════════════════════════════
  // Preda, 24/08 : « switcher de palier pour vérifier que chaque abonné a bien
  // accès à ce qu'il doit avoir. »
  //
  // ⛔⛔ L'ORDRE DES DEUX BLOCS EST UNE PROPRIÉTÉ DE SÉCURITÉ, PAS UN STYLE.
  //    Le palier vu s'applique PAR-DESSUS un palier réel déjà résolu, et
  //    `if (reelle)` en est la condition. Poser le bloc avant, ou oublier
  //    cette condition, donnerait un palier à quelqu'un qui n'a AUCUNE
  //    session — c'est-à-dire à n'importe qui.
  // ⭐⭐⭐ *Une élévation de privilège se pose au-dessus d'une identité, jamais
  //    à sa place.*
  //
  // ⚠️ ON GARDE LE PALIER RÉEL À CÔTÉ. Sans `palierReel`, l'interface ne peut
  //    plus distinguer « je suis whale » de « je regarde comme un whale » —
  //    et c'est exactement la confusion « une variable, deux questions » qui a
  //    coûté trois fausses pannes le 06/08. Le bandeau de `Base.astro` en
  //    dépend, et un « voir comme » qu'on ne voit pas est une démonstration
  //    qui reste allumée.
  //
  // ⚠️ CE BLOC NE PEUT PAS S'EXÉCUTER AU BUILD : le middleware sort plus haut
  //    sur `isPrerendered`. Les ~8 500 pages pré-générées ne connaissent pas
  //    ce mécanisme, ce qui est la seule façon sûre de le tenir.
  if (reelle) {
    const vu = lirePalierVu(sid);
    // ⭐ `PALIERS.includes` MÊME ICI, alors que la route a déjà validé. La
    //   base est un fichier : ce qu'on en relit n'est pas ce qu'on y a écrit,
    //   c'est ce qui s'y trouve. Une ligne posée par une version précédente,
    //   ou par une main, ne doit pas nommer un palier inconnu.
    // ⛔ Et `vu.palier !== reelle` : réécrire la même valeur ferait allumer le
    //   bandeau sur une observation qui n'en est pas une.
    if (vu && PALIERS.includes(vu.palier) && vu.palier !== context.locals.palier) {
      context.locals.palierReel = context.locals.palier || 'visitor';
      context.locals.palier = vu.palier;
      context.locals.vuJusqua = vu.jusqu_a;
    }
  }

  const reponse = await next();

  // ⚠️ UNE PAGE QUI DÉPEND DE LA SESSION NE DOIT JAMAIS ÊTRE MISE EN CACHE
  // PARTAGÉ. Sans cet en-tête, un cache intermédiaire peut servir la page d'un
  // abonné à un visiteur — la fuite est silencieuse et totale.
  if (context.locals.palier) {
    reponse.headers.set('cache-control', 'private, no-store');
    reponse.headers.append('vary', 'cookie');
  }
  return reponse;
}
