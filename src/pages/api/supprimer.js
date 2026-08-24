// ⚠️ VeVePreda/veve-sites — src/pages/api/supprimer.js  (FICHIER NEUF, lot 98)
// ═══════════════════════════════════════════════════════════════════════════
// SUPPRIMER SON COMPTE — le seul geste de ce site qui détruit quelque chose.
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ CE FICHIER NE SUPPRIME RIEN. Il relaie vers `veveid`, qui tient déjà le
// délai de grâce de sept jours, la révocation de toutes les sessions et
// l'effacement différé. Écrire une seconde suppression « pour le site » en
// ferait deux à corriger le jour d'une erreur — et c'est toujours celle qu'on
// a oubliée qui sert.
//
// ⭐⭐⭐ LA CONFIRMATION EST VÉRIFIÉE PAR veveid, PAS ICI. Ce site connaît
// l'adresse e-mail du compte — il vient de l'afficher. Un contrôle fait par
// celui qui détient déjà la réponse ne prouve rien : il se contenterait de
// comparer une chaîne à elle-même. On transmet ce qui a été TAPÉ, et c'est le
// service d'identité qui juge.
//
// ⭐ LITTERAL, ET C'EST LE POINT. `prerender` doit etre statiquement
// analysable ; la valeur reelle est posee par l'integration
// `veve:routes-compte` selon le mode du manifeste.
export const prerender = true;

const secretDeService = () => process.env.VEVEID_SERVICE || process.env.ID_SERVICE || '';

// ⚠️ MÊMES ATTRIBUTS QUE LA POSE, AU CARACTÈRE PRÈS — `api/entrer.js` et
// `api/deconnexion.js` portent les mêmes, et `test:session` compare les trois.
// Un cookie effacé avec d'autres attributs n'est pas effacé : le navigateur y
// voit un second cookie et laisse vivre le premier.
const SESSION = { path: '/', sameSite: 'lax', secure: true, httpOnly: true };
const MEMBRE = { path: '/', sameSite: 'lax', secure: true, httpOnly: false };

export async function POST({ request, cookies, redirect }) {
  const sid = cookies.get('vp_session')?.value || null;
  const base = process.env.SESSION_API || '';
  if (!sid || !base) return redirect('/acces/', 303);

  let confirmation = '';
  try {
    confirmation = String((await request.formData()).get('confirmation') ?? '');
  } catch { /* corps illisible : la confirmation restera vide, donc refusée */ }

  let ok = false;
  try {
    const r = await fetch(`${base}/api/supprimer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-service': secretDeService() },
      body: JSON.stringify({ sid, confirmation }),
      signal: AbortSignal.timeout(4000),
    });
    const j = await r.json().catch(() => ({}));
    ok = r.ok && j?.ok === true;
    // ⭐ UNE ADRESSE QUI NE CORRESPOND PAS N'EST PAS UNE PANNE, C'EST UN GARDE-
    // FOU QUI A FAIT SON TRAVAIL. On le dit autrement — et surtout on ne
    // déconnecte personne : le compte est intact, la session doit l'être aussi.
    if (!ok && r.status === 400) return redirect('/compte/?e=mail', 303);
  } catch { /* on retombe sur l'échec générique */ }

  if (!ok) return redirect('/compte/?e=1', 303);

  // ⭐⭐ ON EFFACE LES DEUX COOKIES NOUS-MÊMES. `veveid` a déjà révoqué la
  // session à la source — c'est ce qui compte — mais laisser `vp_membre` dans
  // le navigateur afficherait un avatar « connecté » à quelqu'un qui vient de
  // supprimer son compte. Une interface qui contredit le geste qu'on vient de
  // faire est la panne la plus sûre de toutes : elle se voit.
  cookies.delete('vp_session', SESSION);
  cookies.delete('vp_membre', MEMBRE);
  return redirect('/acces/?supprime=1', 303);
}

export const GET = () => new Response('Méthode non autorisée — utiliser POST.',
  { status: 405, headers: { allow: 'POST' } });
