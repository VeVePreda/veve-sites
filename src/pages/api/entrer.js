// ⚠️ VeVePreda/veve-sites — src/pages/api/entrer.js  (FICHIER NEUF, lot 90)
// ═══════════════════════════════════════════════════════════════════════════
// LE POINT D'ARRIVÉE — celui qui pose enfin `vp_session`.
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ CE FICHIER FERME UN TROU QU'ON AVAIT PRIS POUR UN DÉTAIL. Le middleware
// lit `vp_session` depuis le lot 42 ; `api/deconnexion.js` l'efface depuis le
// même lot. Entre les deux, PERSONNE NE LE POSAIT — mesuré le 06/08 : un
// `grep vp_session` sur tout le dépôt ne rendait que ces deux endroits, plus
// une ligne de test. La session n'était pas « à adapter », elle n'existait pas.
//
// LE PARCOURS, EN ENTIER :
//   1. /inscription/   → POST /api/inscription → veveid envoie un courriel
//   2. la personne clique le lien du courriel  → veveid consomme le lien
//   3. veveid redirige ICI avec ?code=…        → 60 s, usage unique
//   4. on échange le code CÔTÉ SERVEUR         → on reçoit le sid
//   5. on pose `vp_session` et on nettoie l'URL par une redirection
//
// 🔴 POURQUOI UN CODE PUIS UN ÉCHANGE, ET PAS LE `sid` DIRECTEMENT DANS L'URL.
// Le `sid` vit trente jours. Une valeur qui vit trente jours ne doit jamais
// traverser une barre d'adresse : elle se dépose dans l'historique du
// navigateur, dans les journaux du serveur ET du proxy, et dans l'en-tête
// `Referer` envoyé à tout site vers lequel on cliquerait ensuite. Le code, lui,
// vit soixante secondes et ne sert qu'une fois — et il est échangé d'ici,
// depuis le serveur, contre un `sid` qui n'arrive au navigateur que dans un
// cookie `HttpOnly`.
//
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


// ⚠️ MÊMES ATTRIBUTS QUE `api/deconnexion.js`, AU CARACTÈRE PRÈS. Un cookie
// posé avec `path:'/'` et effacé avec un autre chemin n'est pas effacé : le
// navigateur considère que ce sont deux cookies. C'est la raison n°1 des
// « déconnexions qui ne déconnectent pas », et elle se paie ici, à la pose.
const ATTRIBUTS = { path: '/', sameSite: 'lax', secure: true, httpOnly: true };

export async function GET({ url, cookies, redirect }) {
  const code = url.searchParams.get('code') || '';
  const base = process.env.SESSION_API || '';

  // ⛔ SANS SERVICE DE SESSION, ON NE POSE RIEN ET ON LE DIT. Le repli tentant
  // — « pose un cookie quand même, on verra plus tard » — donnerait un cookie
  // que `GET /session/<sid>` ne saurait pas résoudre : le middleware échouerait
  // fermé, et la personne serait « connectée » sans aucun droit, sans rien
  // comprendre. Une panne qui se nomme vaut mieux qu'une demi-session.
  if (!base) {
    return new Response(
      "Le service de session n'est pas configuré (SESSION_API).\n"
      + "Rien n'a été posé — vous n'êtes pas connecté.\n",
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
    );
  }
  if (!code) return redirect('/connexion/?e=1', 303);

  let sid = null;
  try {
    const r = await fetch(`${base}/api/echange`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // ⭐ Le secret partagé ne sert QU'À LIRE et à échanger : il ne signe
        // rien. Un site compromis ne peut usurper personne.
        'x-service': secretDeService(),
      },
      body: JSON.stringify({ code }),
      // ⚠️ Sans délai maximum, un service muet retient la requête du visiteur
      // jusqu'au bout du timeout système — deux minutes de page blanche, au
      // moment exact où il vient de cliquer le lien de son courriel.
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const j = await r.json();
      if (typeof j?.sid === 'string' && j.sid) sid = j.sid;
    }
  } catch {
    // ⚠️ ÉCHOUER FERMÉ, comme le middleware. Un `catch` qui poserait un cookie
    // au hasard serait exactement le défaut que `palierDeLaSession()` refuse.
    sid = null;
  }

  // Un code périmé ou déjà servi n'est pas une panne : c'est un lien rouvert
  // deux fois, ou une heure plus tard. On le dit sans accuser la personne.
  if (!sid) return redirect('/connexion/?e=2', 303);

  cookies.set('vp_session', sid, { ...ATTRIBUTS, maxAge: 30 * 24 * 3600 });

  // ⭐ ON NETTOIE L'URL PAR UNE REDIRECTION. Sans elle, `?code=…` resterait
  // dans la barre d'adresse, dans l'historique, et partirait dans le `Referer`
  // du premier lien cliqué depuis la page. Le code est déjà consommé, mais on
  // ne laisse pas traîner un secret usagé : la prochaine version pourrait
  // l'être moins.
  return redirect('/compte/', 303);
}

// Un POST ici n'est pas une entrée. Un 405 explicite plutôt qu'un 404, qui
// ferait croire à une route absente et enverrait quelqu'un la réécrire.
export const POST = () => new Response('Méthode non autorisée — utiliser GET.',
  { status: 405, headers: { allow: 'GET' } });
