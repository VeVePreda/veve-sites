// ⚠️ VeVePreda/veve-sites — src/pages/api/deconnexion.js  (FICHIER NEUF)
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

export const POST = ({ cookies, redirect }) => {
  // ⚠️ Les attributs doivent être IDENTIQUES à ceux de la pose, sinon le
  // navigateur considère que c'est un AUTRE cookie et laisse l'original vivre.
  // C'est la raison n°1 des « déconnexions qui ne déconnectent pas ».
  cookies.delete('vp_session', { path: '/', sameSite: 'lax', secure: true, httpOnly: true });
  return redirect('/', 303);
};

// Un GET explicite qui refuse, plutôt qu'un 404 : le 404 ferait croire à une
// route absente et enverrait quelqu'un la réécrire en GET.
export const GET = () => new Response('Méthode non autorisée — utiliser POST.',
  { status: 405, headers: { allow: 'POST' } });
