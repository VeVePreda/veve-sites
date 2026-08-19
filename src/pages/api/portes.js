// ⚠️ VeVePreda/veve-sites — src/pages/api/portes.js  (FICHIER NEUF — lot 164)
// ═══════════════════════════════════════════════════════════════════════════
// RÉGLER UNE PORTE — le geste le plus large de tout le site
// ═══════════════════════════════════════════════════════════════════════════
// Demande de Preda du 19/08/2026 : pouvoir ouvrir un module aux membres pendant
// les tests, puis le refermer.
//
// ⛔⛔ CE GESTE NE TOUCHE PAS UNE PERSONNE, IL TOUCHE TOUT LE MONDE. `/api/
//    supprimer` détruit UN compte ; celui-ci change ce que voient TOUS les
//    visiteurs d'un site public. `wallet_watch` ouvert, c'est le classement
//    nominatif des cent plus gros portefeuilles AVEC LEURS ADRESSES, servi à
//    n'importe quel inscrit gratuit. ⇒ trois gardes, et une date de fin.
//
// ⭐⭐ POURQUOI UNE ROUTE API ET PAS UN POST SUR `/compte/`. Mesuré le 19/08 :
//    AUCUNE page `.astro` de ce dépôt ne traite de POST aujourd'hui. J'aurais
//    été le premier, sur un chemin que je ne peux pas éprouver ici (le contrôle
//    d'origine d'Astro dépend de `X-Forwarded-Proto`, donc de Cloudflare).
//    `api/supprimer.js` fait déjà exactement ça — formulaire HTML de `/compte/`
//    → route API → redirection — et il est EN PRODUCTION. On copie le patron
//    éprouvé plutôt que d'en inventer un qu'on ne peut pas mesurer.
//    ⭐ Et ça marche sans JavaScript, comme le reste du site.
//
// ⛔ ET SURTOUT PAS UN GET. Un geste qui écrit derrière un GET s'exécute depuis
//    n'importe quel site par une simple balise `<img src="…?porte=…">`. Sur un
//    geste qui ouvre des droits, ce serait la faille du lot entier.
//
// ⭐ LITTERAL, ET C'EST LE POINT. `prerender` doit etre statiquement
// analysable ; la valeur reelle est posee par l'integration
// `veve:routes-compte` selon le mode du manifeste. (Même formule que
// `api/supprimer.js` — ⛔ ne pas la « simplifier ».)
export const prerender = true;

import { poserSurcharge, JOURS_MAX } from '../../../engine/lib/portes_surcharge.mjs';
import { PORTES_CONNUES, PALIERS } from '../../../engine/lib/access.mjs';

const secretDeService = () => process.env.VEVEID_SERVICE || process.env.ID_SERVICE || '';

/**
 * 🔴🔴🔴 QUI A LE DROIT — ET C'EST UNE LISTE D'ADRESSES, PAS UN SECRET.
 *
 * ⭐⭐ POURQUOI PAS UN JETON DANS L'URL (le patron de `/admin?k=…` de veveid).
 *   Un secret dans une barre d'adresse part dans l'historique, dans le journal
 *   du proxy et dans le `Referer` de tout lien cliqué depuis la page. veveid
 *   s'en tire en l'échangeant tout de suite contre un cookie ; ici on n'a pas
 *   besoin de ce détour, parce que L'AUTHENTIFICATION EXISTE DÉJÀ : c'est la
 *   session du membre, posée par `/api/entrer`, vérifiée par veveid.
 * ⇒ On n'ajoute AUCUN secret. On désigne des personnes déjà authentifiées.
 *
 * ⛔ VIDE = PERSONNE. Une variable absente ne doit pas ouvrir la porte à tous
 *   — c'est la faute classique de la liste blanche vide, et elle est
 *   silencieuse. `JEUX` vide côté veveid porte le même commentaire.
 */
const ADMINS = () => String(process.env.ADMIN_COMPTES || '')
  .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

export async function POST({ request, cookies, redirect }) {
  const sid = cookies.get('vp_session')?.value || null;
  const base = process.env.SESSION_API || '';
  // ⛔ ÉCHOUER FERMÉ. Pas de session, pas de service, pas d'administrateur
  //   déclaré : on ne règle rien. ⚠️ Et on redirige vers `/compte/` sans dire
  //   pourquoi — une page qui explique « vous n'êtes pas administrateur »
  //   apprend à un inconnu que ce réglage existe.
  if (!sid || !base || ADMINS().length === 0) return redirect('/compte/', 303);

  // ⭐ ON DEMANDE AVEC LE `sid`, PAS AVEC UNE ADRESSE. Même raison qu'en tête
  //   de `/compte/` : ce site ne détient pas l'identité, il a un cookie. Lui
  //   laisser DÉSIGNER un compte, avec le secret de service en main,
  //   reviendrait à le laisser lire n'importe lequel.
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
  try { f = await request.formData(); } catch { return redirect('/compte/?p=forme', 303); }

  const porte = String(f.get('porte') ?? '').trim();
  const tier = String(f.get('tier') ?? '').trim();

  /**
   * 🔴🔴 LA FORME SE VALIDE AVANT LA CONVERSION, ET C'EST UNE LEÇON PAYÉE.
   * `0` est ici une valeur SIGNIFIANTE (retirer la surcharge). Or `Number('')`
   * vaut **0** : un champ laissé vide retirerait donc une surcharge, en
   * rendant une redirection de succès. `Number.isInteger` ne peut rien voir —
   * 0 est un entier parfaitement valide.
   * ⭐⭐⭐ Ce trou existait mot pour mot dans ma première écriture du même
   *   mécanisme, et c'est le BANC qui l'a trouvé, pas la relecture : j'avais
   *   écrit juste au-dessus « on exige la forme, on ne la devine pas », et le
   *   code ne le faisait pas. *Un commentaire décrit l'intention, jamais le
   *   code.* ⇒ la sentinelle `-1` tombe hors bornes et se fait refuser.
   */
  const brut = String(f.get('jours') ?? '').trim();
  const jours = /^[0-9]{1,3}$/.test(brut) ? Number(brut) : -1;

  // ⛔ LA PORTE ET LE PALIER SONT VALIDÉS ICI, parce que le magasin ne les
  //   connaît pas : il n'importe pas `access.mjs`, ce serait un cycle. Même
  //   partage que `prefs.mjs` — « ici on borne la FORME, l'appelant borne le
  //   SENS ». C'est donc à cet appelant-ci de le faire, et il le fait.
  if (!PORTES_CONNUES.has(porte)) return redirect('/compte/?p=porte', 303);
  if (jours < 0 || jours > JOURS_MAX) return redirect('/compte/?p=duree', 303);
  // ⚠️ Le palier n'est exigé QUE si on pose. Au retrait, sa valeur n'a plus de
  //   sens — et refuser un retrait parce que le palier est vide empêcherait de
  //   nettoyer une ligne devenue invalide, c'est-à-dire le seul cas qui compte.
  if (jours > 0 && !PALIERS.includes(tier)) return redirect('/compte/?p=palier', 303);

  try {
    poserSurcharge(porte, tier, jours);
  } catch {
    // ⭐ ICI ON NE SE TAIT PAS. Un réglage qu'on croit posé et qui ne l'est pas
    //   envoie chercher le défaut ailleurs pendant une heure. La page le dira.
    return redirect('/compte/?p=ecriture', 303);
  }
  // ⛔ La trace dit le GESTE, jamais QUI l'a fait — même règle que les routes
  //   de compte : le journal du serveur n'a pas à porter d'identité.
  console.log(`[portes] ${porte} → ${jours === 0 ? 'retrait' : `${tier}, ${jours} j`}`);
  return redirect('/compte/?p=ok', 303);
}

// ⭐ MÊME FORME QUE `api/supprimer.js` ET `api/inscription.js` : un GET sur une
//   route qui écrit est une erreur d'appel, pas une page. On le dit en 405
//   plutôt que de rendre un 404 qui enverrait chercher un fichier manquant.
export const GET = () => new Response('Méthode non autorisée — utiliser POST.',
  { status: 405, headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8' } });
