// ROUTE DE SANTE — la preuve que le mode serveur vit vraiment.
//
// C'est la seule route dynamique du socle hybride, et elle ne fait rien d'utile :
// elle repond « je suis la, dans tel mode ». Son role est d'etre la premiere
// chose a interroger apres un deploiement. Si /api/sante repond « server »,
// alors l'image, le port et l'adaptateur sont corrects — et les lots suivants
// (comptes, webhook du prestataire) peuvent s'appuyer dessus.
//
// ⚠️ LE `prerender` EST CONDITIONNEL, ET IL LE DOIT.
// Une route `prerender = false` fait ECHOUER le build en mode static, ou aucun
// adaptateur n'est installe (erreur NoAdapterInstalled). En mode static cette
// route devient donc un simple fichier ; en mode server, elle est calculee a la
// demande. Le mode se lit dans la reponse : c'est ce qui distingue « une page
// servie » de « une page calculee ».
// ⭐ LITTERAL, ET C'EST LE POINT. Astro exige que `prerender` soit
// statiquement analysable ; une EXPRESSION n'est pas evaluee et retombe
// silencieusement sur `true`. La valeur reelle est posee par l'integration
// `veve:routes-compte` (engine/lib/astro_routes_compte.mjs) selon le mode du
// manifeste. `true` ici est le defaut SUR : sans adaptateur, un build static
// ne peut pas rendre cette route a la demande.
export const prerender = true;

// ⛔⛔ LE MODE SE FIGE AU BUILD, IL NE SE LIT PAS A LA REQUETE (31/07/2026).
// Cette sonde lisait `process.env.RENDERING` AU MOMENT DE L'APPEL. Or ce
// reglage est consomme par le BUILD (le Dockerfile fait
// `export RENDERING=$(cat /app/.rendering)` juste avant `astro build`) ; le
// processus qui SERT, lui, ne l'a pas. Resultat mesure : la sonde d'un site
// tournant en mode server repondait `"mode":"static"`.
// ⭐ Une sonde de sante qui se trompe sur ce qu'elle surveille est pire
// qu'absente : elle donne une reponse plausible a la question qu'on lui pose
// pour verifier. `import.meta.env` est fige a la compilation — c'est ce
// qu'on veut : la sonde rapporte le mode DANS LEQUEL ELLE A ETE CONSTRUITE.
// ⭐ Et cette route ne peut repondre a la demande que si elle a ete construite
// en mode server : `mode` est donc, litteralement, verifiable par le fait
// meme que cette reponse n'est pas un fichier statique.
const MODE = import.meta.env.RENDERING === 'server' ? 'server' : 'static';
const SITE = import.meta.env.SITE || 'veveprice';

// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ LA SONDE DIT AUSSI CE QUE LE SERVEUR CROIT ETRE — ajoute au lot 92.
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE CA A COUTE DE NE PAS L'AVOIR : deux lots pour trouver que nginx
// envoyait `X-Forwarded-Proto: http` a Node. Le symptome etait un 403 CSRF ;
// la cause etait une seule valeur, invisible de l'exterieur, que personne ne
// pouvait lire sans ouvrir un terminal sur le serveur.
//
// `origin` est CE QU'ASTRO A RECONSTRUIT, et c'est exactement ce qu'il compare
// a l'en-tete `Origin` du navigateur pour accepter ou refuser un POST de
// formulaire. S'il affiche `http://…` alors que le site est en https, tout
// envoi de formulaire rendra 403 — et ca se lit maintenant en une requete.
//
// ⭐ Un service doit savoir dire lui-meme s'il est correctement installe. Le
//   `demarrage.ts` de veveid porte deja ce principe ; ici la difference est
//   qu'un demarrage ne voit pas Cloudflare, et une vraie requete si.
//
// ⛔ ON NE REND AUCUN EN-TETE BRUT, ni IP, ni cookie : seulement l'origine
//   reconstruite, que le visiteur connait deja puisque c'est la sienne.
// ⭐⭐ ET CE QUI LUI MANQUE POUR SERVIR — ajoute au lot 93.
// ⛔ DES BOOLEENS, JAMAIS DES VALEURS. Ni URL, ni secret, ni fragment : la
//    question est « est-ce branche ? », pas « branche sur quoi ». Le jour ou
//    quelqu'un voudra y mettre l'adresse « pour verifier plus vite », cette
//    route cessera de pouvoir rester publique.
// ⭐ Et l'information n'apprend rien a personne : la page /inscription/ dit
//    deja en clair « la creation de compte n'est pas encore ouverte ».
//
// CE QUE CA A COUTE DE NE PAS L'AVOIR : la route rend 503 avec le MEME texte
// que `INSCRIPTION_API` manque ou que `SESSION_API` manque. Deux causes, un
// seul message — impossible de savoir laquelle depuis le navigateur.
// ⭐⭐⭐ « CAUSE A » ET « CAUSE B » NE DOIVENT PAS EMPRUNTER LE MEME CHEMIN DE
//   SORTIE, exactement comme « je ne sais pas » ne doit pas emprunter celui de
//   « rien a signaler ».
// ═══════════════════════════════════════════════════════════════════════════
// 🔬 LOT 136 — LA SONDE DIT ENFIN *QUELLE VERSION* ELLE SERT (P35)
// ═══════════════════════════════════════════════════════════════════════════
//
// CE QUE CA A COUTE DE NE PAS L'AVOIR, ET C'EST MESURE : le 11/08/2026, un
// deploiement declare ECHOUE tournait, et DEUX conteneurs servaient en
// parallele sur le meme reseau. Six `curl` identiques ne prouvaient rien : ils
// pouvaient tomber sur l'un ou sur l'autre, et les deux repondaient `ok:true`.
// « Quelle version sert la production ? » etait litteralement INDECIDABLE.
//
// ⭐⭐ ET LE CACHE REND CETTE QUESTION CENTRALE, PAS ANECDOTIQUE. A partir du
//   moment ou Cloudflare sert le HTML depuis le bord, un deploiement peut
//   REUSSIR sans atteindre personne : l'origine sert la nouvelle version, le
//   bord continue de servir l'ancienne, et rien ne rougit nulle part. Sans ce
//   champ, ce chemin de panne serait invisible — c'est exactement le profil
//   « posé ≠ branché ».
//
// ⛔ `commit` PEUT ETRE `null`, ET C'EST ECRIT COMME TEL. Rien ne garantit que
//   le constructeur passe un SHA (Coolify ne le fait pas toujours). ⭐ INCONNU
//   ≠ ZERO : la sonde rend `null`, et `test:cache` sort INDECIDABLE sur ce
//   point plutot que de conclure. Une valeur inventee serait pire qu'absente —
//   c'est la lecon de la sonde qui repondait `"mode":"static"` sur un site en
//   mode server.
//
// ⭐ Les deux valeurs sont FIGEES A LA COMPILATION (`vite.define` dans
//   `astro.config.mjs`), pas lues a la requete. Meme raison que `MODE` juste
//   au-dessus : le processus qui SERT n'a pas l'environnement du BUILD. Une
//   sonde qui lit son horodatage a la requete rendrait « maintenant », c'est-a-
//   dire la seule reponse qui ne renseigne sur rien.
/* global __BUILD_TIME__, __COMMIT__ */
const BUILD = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : null;
const COMMIT = typeof __COMMIT__ === 'string' && __COMMIT__ ? __COMMIT__ : null;

// ═══════════════════════════════════════════════════════════════════════════
// ❤️ LOT 140-3 — LA SENTINELLE DU VOLUME, ET ELLE EXISTE POUR UN OUBLI PRÉCIS
// ═══════════════════════════════════════════════════════════════════════════
// Sans volume monté sur `/data`, LES FAVORIS FONCTIONNENT. Ils se posent, ils
// se relisent, la page est correcte. Jusqu'au déploiement suivant, où le
// conteneur est remplacé et où `/data` redevient un dossier vide de l'image :
// tout disparaît, sans erreur, sans run rouge, et sans plainte puisqu'il n'y a
// que deux comptes. ⭐⭐⭐ *Une feature que personne n'utilise ne se plaint
// jamais d'être cassée* — donc rien ne se juge sur l'usage, tout sur le
// MÉCANISME. Ce § est ce mécanisme.
//
// ⛔ DES BOOLÉENS, JAMAIS DE CHEMIN. La question est « est-ce monté ? », pas
//    « monté où ». Le dossier n'apprend rien à un visiteur et cette route est
//    publique.
// ⭐ `montee: null` EST UNE RÉPONSE, et c'est la troisième. INCONNU ≠ FAUX :
//    un `false` inventé parce qu'on n'a pas su lire ferait crier la sonde sur
//    une installation correcte, et on apprendrait à l'ignorer. C'est la leçon
//    de la sonde qui répondait `"mode":"static"` sur un site en mode server.
// ⭐⭐ LA CONDITION VOYAGE AVEC LE CODE, OU ELLE DISPARAIT EN SILENCE.
// vevewiki n'ouvre aucun compte : il n'a pas de favoris, donc pas de base, donc
// pas de volume a monter. Sans cette porte, sa sonde annoncerait
// `favoris:{ouverte:false}` — une sonde qui CRIE sur une installation
// parfaitement correcte. On apprend a l'ignorer, et le jour ou elle crie pour
// de bon, plus personne ne l'ecoute. C'est mesure : le build statique de
// vevewiki rendait bien ce faux negatif avant cette ligne.
// 🔴 ET LE PREDICAT EST IMPORTE, PAS RECOPIE. `socle_js.mjs` l. 119 emploie
// EXACTEMENT `acces().tiers.length > 1` pour decider s'il embarque le script
// d'espace membre. Ecrire ici `manifest().features.comptes`, qui « veut dire la
// meme chose », donnerait deux definitions d'un seul etat — la panne P30 du
// lot 139.
import { acces } from '../../../engine/lib/access.mjs';
import { etatDuStockage } from '../../../engine/lib/favoris.mjs';

const comptesOuverts = () => acces().tiers.length > 1;

const favoris = () => {
  try {
    const e = etatDuStockage();
    return { ouverte: e.ouverte, montee: e.montee };
  } catch {
    // ⛔ La sonde ne tombe JAMAIS à cause de ce §. Une sonde de santé qui
    //    échoue sur la question qu'elle pose est pire qu'absente.
    return { ouverte: false, montee: null };
  }
};

const branche = () => ({
  inscription: Boolean(process.env.INSCRIPTION_API),
  session: Boolean(process.env.SESSION_API),
  // ⭐ Les DEUX noms comptent : voir `secretDeService()` (lot 94).
  service: Boolean(process.env.VEVEID_SERVICE || process.env.ID_SERVICE),
});

export const GET = ({ url }) => new Response(
  JSON.stringify({
    ok: true,
    mode: MODE,
    site: SITE,
    // 🔬 P35 — ce que sert CE processus, pas ce qu'on croit avoir deploye.
    build: BUILD,
    commit: COMMIT,
    origin: url.origin,
    proto: url.protocol.replace(':', ''),
    comptes: branche(),
    ...(comptesOuverts() ? { favoris: favoris() } : {}),
  }),
  { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } },
);
