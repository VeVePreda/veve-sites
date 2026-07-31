// ⚠️ VeVePreda/veve-sites — src/pages/api/deconnexion.js  (FICHIER NEUF)
// Effacer la session. ⛔ POST UNIQUEMENT.
// Un GET destructeur est déclenchable par un simple <img src="…">, et les
// préchargeurs de liens du navigateur le suivent d'eux-mêmes : on déconnecterait
// les gens sans qu'ils aient rien cliqué.
export const prerender = process.env.RENDERING !== 'server';

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
