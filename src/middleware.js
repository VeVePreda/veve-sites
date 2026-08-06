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

import { PALIERS, palierDemo } from '../engine/lib/access.mjs';
import { COOKIE_DEMO, lire as lireDemo } from '../engine/lib/demo_session.mjs';

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
    return typeof j?.palier === 'string' ? j.palier : null;
  } catch {
    // ⚠️ ÉCHOUER FERMÉ. Un `catch` qui rendrait « member » serait exactement le
    // défaut de `getattr(…, ())` qui a mal étiqueté 216 838 transferts : une
    // erreur silencieuse qui produit une valeur plausible au lieu d'un refus.
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LA SESSION DE DÉMONSTRATION — arbitrage du 01/08/2026, livré le 03/08.
// ═══════════════════════════════════════════════════════════════════════════
// `access.demo` du manifeste fait entrer tout le monde au palier déclaré.
// C'est une porte ouverte, assumée, sans date de fin.
//
// 🔴 LA SEULE CONDITION, ET ELLE N'EST PAS UN GARDE-FOU DÉCORATIF : la démo ne
// s'applique QUE si `SESSION_API` n'est pas configuré du tout.
// ⭐⭐ CE N'EST PAS « la démo expire ». C'est la DÉFINITION de la démo : elle
// tient la place d'un service de session qui n'existe pas encore. Le jour où ce
// service existe, il n'y a plus de place à tenir.
// ⛔ SANS CETTE CONDITION, la démo deviendrait un CONTOURNEMENT du service de
// session — et une panne réseau de `SESSION_API` distribuerait l'abonnement à
// tout le monde. C'est exactement le défaut que `palierDeLaSession()` refuse
// dix lignes plus haut en échouant fermé ; on ne va pas le réintroduire par la
// porte d'à côté. Un `catch` qui rend « member » et une démo qui rend
// « member » quand l'API tombe sont le MÊME bug écrit deux fois.
export function palierDeDemonstration(env) {
  const base = env?.SESSION_API || process.env.SESSION_API;
  if (base) return null;              // le vrai service existe : la démo s'efface
  try {
    return palierDemo();              // `null` si le manifeste ne déclare rien
  } catch {
    // Manifeste illisible à la requête : on ne devine pas, on ferme.
    return null;
  }
}

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
  // Un jeton de démonstration donne le premier sans le second, et c'est
  // exactement ce qu'on veut : voir la vue d'un abonné sans prétendre en être un.
  //
  // ⚠️ `locals.session` reste ABSENTE sur les ~8 500 pages pré-générées (le
  // middleware sort plus haut sur `isPrerendered`). C'est correct et voulu : une
  // page pré-générée n'a pas de visiteur, elle doit donc porter l'appel à
  // l'inscription — celui de quelqu'un qui n'est pas connecté.
  //   'reelle' -> une vraie session, chez le service d'identité
  //   'demo'   -> le jeton NOMINATIF signé (il faut la clé pour l'obtenir)
  //   absente  -> personne. Y compris sous `access.demo`, qui est COLLECTIF :
  //               un palier donné à tout le monde n'identifie personne.
  const reelle = await palierDeLaSession(sid, env);
  const nominative = reelle ? null : lireDemo(context.cookies.get(COOKIE_DEMO)?.value || null, env);
  const brut = reelle || nominative || palierDeDemonstration(env);
  if (reelle) context.locals.session = 'reelle';
  else if (nominative) context.locals.session = 'demo';

  // ⭐ On dépose la valeur BRUTE. C'est `palierVisiteur()` d'access.mjs qui
  // décide ce qu'elle vaut : il vérifie qu'elle existe, qu'elle est déclarée
  // dans `access.tiers` du site, et il RAMÈNE À VISITOR sinon, en le disant.
  // Dupliquer ce contrôle ici en ferait la deuxième source de vérité, et deux
  // sources de vérité sur un droit d'accès finissent toujours par diverger.
  if (brut && PALIERS.includes(brut)) context.locals.palier = brut;

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
