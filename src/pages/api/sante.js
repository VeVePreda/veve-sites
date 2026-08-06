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
    origin: url.origin,
    proto: url.protocol.replace(':', ''),
    comptes: branche(),
  }),
  { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } },
);
