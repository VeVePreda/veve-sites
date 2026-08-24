// ⚠️ VeVePreda/veve-sites — src/pages/api/palier-vu.js  (FICHIER NEUF — lot 187)
// ═══════════════════════════════════════════════════════════════════════════
// 👓 « VOIR COMME » — regarder le site avec les yeux d'un autre palier
// ═══════════════════════════════════════════════════════════════════════════
// Preda, 24/08/2026 : « donne moi la possibilité dans mon compte de switcher de
// palier pour vérifier que chaque abonné a bien accès à ce qu'il doit avoir. »
//
// ⭐⭐⭐ CE GESTE EST L'EXACT OPPOSÉ DE `/api/portes` PAR SA PORTÉE, ET IDENTIQUE
//    PAR SES GARDES. Régler une porte change ce que voit TOUT LE MONDE ;
//    « voir comme » ne change que ce que voit LA SESSION QUI LE DEMANDE.
//    C'est ce qui le rend beaucoup moins dangereux — et c'est précisément
//    pour ça qu'il ne faut pas relâcher les gardes : la seule chose qui
//    l'empêche de devenir global, c'est que sa clé soit la session.
//
// ⛔ LES QUATRE GARDES SONT COPIÉES MOT POUR MOT DE `api/portes.js`, ET C'EST
//    VOULU : session, service, liste d'administrateurs non vide, adresse dans
//    la liste. Les réécrire autrement créerait deux définitions de « qui a le
//    droit », et deux définitions d'un droit d'accès finissent par diverger.
//
// ⛔ ET SURTOUT PAS UN GET. Un geste qui écrit derrière un GET s'exécute depuis
//    n'importe quel site par une simple balise `<img src="…">`.
//
// ⭐ LITTERAL, ET C'EST LE POINT. `prerender` doit etre statiquement
// analysable ; la valeur reelle est posee par l'integration
// `veve:routes-compte` selon le mode du manifeste. (Même formule que
// `api/portes.js` — ⛔ ne pas la « simplifier ».)
export const prerender = true;

import { poserPalierVu, MINUTES_MAX } from '../../../engine/lib/palier_vu.mjs';
import { PALIERS } from '../../../engine/lib/access.mjs';

const secretDeService = () => process.env.VEVEID_SERVICE || process.env.ID_SERVICE || '';

/**
 * 🔴🔴🔴 QUI A LE DROIT — la MÊME liste que `/api/portes`, et pas une autre.
 * ⛔ VIDE = PERSONNE. Une variable absente ne doit pas ouvrir la porte à tous.
 */
const ADMINS = () => String(process.env.ADMIN_COMPTES || '')
  .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

export async function POST({ request, cookies, redirect }) {
  const sid = cookies.get('vp_session')?.value || null;
  const base = process.env.SESSION_API || '';
  // ⛔ ÉCHOUER FERMÉ, et sans expliquer pourquoi : une page qui dit « vous
  //   n'êtes pas administrateur » apprend à un inconnu que ce réglage existe.
  if (!sid || !base || ADMINS().length === 0) return redirect('/compte/', 303);

  // ⭐ ON DEMANDE AVEC LE `sid`, PAS AVEC UNE ADRESSE. Ce site ne détient pas
  //   l'identité, il a un cookie. Lui laisser DÉSIGNER un compte, avec le
  //   secret de service en main, reviendrait à le laisser lire n'importe lequel.
  let email = '';
  try {
    const r = await fetch(`${base}/api/session?sid=${encodeURIComponent(sid)}`, {
      headers: { accept: 'application/json', 'x-service': secretDeService() },
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) email = String((await r.json())?.email ?? '').trim().toLowerCase();
  } catch { /* ⛔ muet et fermé : `email` reste vide, donc refusé */ }

  if (!email || !ADMINS().includes(email)) return redirect('/compte/', 303);

  let f;
  try { f = await request.formData(); } catch { return redirect('/compte/?v=forme', 303); }

  const palier = String(f.get('palier') ?? '').trim();

  /**
   * 🔴🔴 LA FORME SE VALIDE AVANT LA CONVERSION — la leçon du lot 164, mot
   * pour mot, et elle vaut ici aussi : `0` est une valeur SIGNIFIANTE (arrêter
   * de voir comme), or `Number('')` vaut **0**. Un champ vide arrêterait donc
   * l'observation en rendant une redirection de succès, et `Number.isInteger`
   * ne peut rien voir — 0 est un entier parfaitement valide.
   * ⇒ la sentinelle `-1` tombe hors bornes et se fait refuser.
   */
  const brut = String(f.get('minutes') ?? '').trim();
  const minutes = /^[0-9]{1,3}$/.test(brut) ? Number(brut) : -1;

  // ⛔ LE PALIER EST VALIDÉ ICI, parce que le magasin ne les connaît pas : il
  //   n'importe pas `access.mjs`, ce serait un cycle. Même partage que
  //   `prefs.mjs` — « là on borne la FORME, ici on borne le SENS ».
  if (minutes < 0 || minutes > MINUTES_MAX) return redirect('/compte/?v=duree', 303);
  // ⚠️ Le palier n'est exigé QUE si on pose. À l'arrêt, sa valeur n'a plus de
  //   sens — et refuser l'arrêt parce que le palier est vide empêcherait de
  //   revenir à soi-même, c'est-à-dire le seul cas qui compte vraiment.
  if (minutes > 0 && !PALIERS.includes(palier)) return redirect('/compte/?v=palier', 303);

  try {
    poserPalierVu(sid, palier, minutes);
  } catch {
    // ⭐ ICI ON NE SE TAIT PAS. Un réglage qu'on croit posé et qui ne l'est pas
    //   envoie chercher le défaut ailleurs pendant une heure.
    return redirect('/compte/?v=ecriture', 303);
  }
  // ⛔ La trace dit le GESTE, jamais QUI l'a fait ni AVEC QUELLE SESSION — le
  //   journal du serveur n'a pas à porter d'identité, et un `sid` dans un log
  //   est un jeton d'authentification dans un log.
  console.log(`[palier-vu] ${minutes === 0 ? 'arrêt' : `${palier}, ${minutes} min`}`);
  return redirect('/compte/?v=ok', 303);
}

// ⭐ MÊME FORME QUE `api/portes.js` : un GET sur une route qui écrit est une
//   erreur d'appel, pas une page.
export const GET = () => new Response('Méthode non autorisée — utiliser POST.',
  { status: 405, headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' } });
