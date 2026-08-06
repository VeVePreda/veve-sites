// ⚠️ VeVePreda/veve-sites — src/pages/api/deconnexion.js
// Effacer la session. ⛔ POST UNIQUEMENT.
// Un GET destructeur est déclenchable par un simple <img src="…">, et les
// préchargeurs de liens du navigateur le suivent d'eux-mêmes : on déconnecterait
// les gens sans qu'ils aient rien cliqué.
// ⭐ LITTERAL, ET C'EST LE POINT. Astro exige que `prerender` soit
// statiquement analysable ; une EXPRESSION n'est pas evaluee et retombe
// silencieusement sur `true`. La valeur reelle est posee par l'integration
// `veve:routes-compte` (engine/lib/astro_routes_compte.mjs) selon le mode du
// manifeste. `true` ici est le defaut SUR : sans adaptateur, un build static
// ne peut pas rendre cette route a la demande.
export const prerender = true;

// ⭐⭐ DEUX NOMS POUR LE MEME SECRET — corrige au lot 94.
// `veveid` lit `ID_SERVICE`, ce depot lisait `VEVEID_SERVICE`. C'est la MEME
// valeur, et rien ne le disait : recopier la variable sous son nom d'origine
// — le geste evident — laissait `x-service` vide, veveid repondait 401, et la
// page affichait « nous n'avons pas pu envoyer le lien ».
// ⭐⭐⭐ UN SECRET PARTAGE QUI PORTE DEUX NOMS SELON LE COTE EST UNE ERREUR DE
//   RECOPIE EN ATTENTE. On accepte donc les deux, et `VEVEID_SERVICE` reste
//   le nom recommande — celui qui dit A QUI on parle.
const secretDeService = () => process.env.VEVEID_SERVICE || process.env.ID_SERVICE || '';


export const POST = async ({ cookies, redirect }) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔴🔴 SE DÉCONNECTER, C'EST RÉVOQUER — PAS EFFACER UN COOKIE (lot 90).
  // ═══════════════════════════════════════════════════════════════════════════
  // Effacer le cookie ne ferme que CE navigateur. La session, elle, reste
  // ouverte chez veveid pendant trente jours : quiconque aurait copié le `sid`
  // — un ordinateur partagé, une sauvegarde de navigateur, un journal mal
  // configuré — continuerait d'entrer. « Déconnecté » décrirait alors ce que
  // la personne CROIT, pas ce qui est.
  // ⭐ On ferme donc à la source, PUIS on efface le cookie.
  const sid = cookies.get('vp_session')?.value || null;
  const base = process.env.SESSION_API || '';
  if (sid && base) {
    try {
      await fetch(`${base}/api/deconnexion`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-service': secretDeService() },
        body: JSON.stringify({ sid }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (e) {
      // ⚠️ ON EFFACE LE COOKIE QUAND MÊME. Ici, échouer OUVERT est le bon
      // choix — et c'est l'inverse de `api/entrer.js`, pour une raison
      // précise : refuser de déconnecter parce que le réseau est tombé
      // laisserait la personne connectée sur un poste qu'elle quitte.
      // ⭐⭐ « Échouer fermé » veut dire « refuser le DROIT en cas de doute ».
      //    Retirer un droit n'est jamais le geste risqué.
      console.error(`[deconnexion] révocation impossible : ${e?.message}`);
    }
  }
  // ⚠️ Les attributs doivent être IDENTIQUES à ceux de la pose, sinon le
  // navigateur considère que c'est un AUTRE cookie et laisse l'original vivre.
  // C'est la raison n°1 des « déconnexions qui ne déconnectent pas ».
  cookies.delete('vp_session', { path: '/', sameSite: 'lax', secure: true, httpOnly: true });
  // 🍪 LE COOKIE D'AFFICHAGE PART AVEC LA SESSION — lot 97.
  // ⛔ Il n'accorde aucun droit : l'oublier ne laisserait aucune porte
  // ouverte. Il laisserait quelque chose de pire à sa façon — un bouton
  // « Mon compte » sur 8 500 pages, chez quelqu'un qui vient de cliquer
  // « Se déconnecter ». Une interface qui contredit le geste qu'on vient de
  // faire est la panne la plus sûre de toutes : elle se voit.
  // 🔴 `httpOnly: false` ET LE MÊME `path` QU'À LA POSE, AU CARACTÈRE PRÈS.
  // Un cookie effacé avec d'autres attributs n'est pas effacé : le navigateur
  // y voit un second cookie et laisse vivre le premier. `test:session`
  // compare maintenant les deux côtés POUR LES DEUX cookies.
  cookies.delete('vp_membre', { path: '/', sameSite: 'lax', secure: true, httpOnly: false });
  return redirect('/', 303);
};

// Un GET explicite qui refuse, plutôt qu'un 404 : le 404 ferait croire à une
// route absente et enverrait quelqu'un la réécrire en GET.
export const GET = () => new Response('Méthode non autorisée — utiliser POST.',
  { status: 405, headers: { allow: 'POST' } });
