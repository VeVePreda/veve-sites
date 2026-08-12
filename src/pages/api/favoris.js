// ⚠️ VeVePreda/veve-sites — src/pages/api/favoris.js   (FICHIER NEUF — lot 140-3)
// ═══════════════════════════════════════════════════════════════════════════
// ❤️ LA PORTE DES FAVORIS — ce qu'elle garde appartient enfin au compte
// ═══════════════════════════════════════════════════════════════════════════
//
// CE QU'ELLE RÉPARE, ET C'ÉTAIT UN MUR DEVANT LA MAUVAISE PIÈCE. Le lot 118 a
// mis `/favoris/` derrière la session ; mais la liste vivait dans
// `localStorage`, donc DANS LE NAVIGATEUR. Un membre qui se connectait depuis
// son téléphone voyait une page vide — pas une erreur, pas un run rouge, juste
// rien. *Le mur gardait une pièce qui n'était pas la sienne.*
//
// ⭐ LITTÉRAL, ET C'EST LE POINT. Astro exige que `prerender` soit
// statiquement analysable ; une EXPRESSION n'est pas évaluée et retombe
// silencieusement sur `true`. La valeur réelle est posée par l'intégration
// `veve:routes-compte` selon le mode du manifeste.
// 🔴🔴 ET `ROUTES_COMPTE` EST UNE LISTE ÉCRITE À LA MAIN, PAS UNE RÈGLE :
// `pages/api/favoris.js` DOIT y être inscrit (engine/lib/astro_routes_compte.mjs).
// Oubliée là-bas, cette route devient un fichier FIGÉ qui rend la même réponse
// à tout le monde, sur un build parfaitement vert. C'est la panne du lot 24,
// la cinquième fois qu'elle est écrite dans ce dépôt.
export const prerender = true;

import { compteDeLaSession } from '../../../engine/lib/compte.mjs';
import { lireFavoris, poserFavori, retirerFavori } from '../../../engine/lib/favoris.mjs';

// ⛔⛔ AUCUN `dataset()` DANS UNE ROUTE DE COMPTE — 10 328 ms mesurés. Cette
// route ne charge donc RIEN du catalogue : elle rend des uuid, un chemin et un
// nom, exactement ce que le navigateur lui a confié. C'est aussi ce qui la
// rend incapable de fuir un prix, quoi qu'il arrive ensuite.

const ENTETES = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: ENTETES });

/**
 * ⭐⭐⭐ TROIS SORTIES, ET ELLES NE SE CONFONDENT PAS :
 *   · `{ compte }`  → on sait qui c'est ;
 *   · 401           → il n'y a personne (pas de cookie, ou veveid dit non) ;
 *   · 503           → on NE SAIT PAS (veveid muet, secret absent).
 * ⛔ Aplatir le 503 sur le 401 ferait qu'une panne de veveid ressemblerait à
 *    une déconnexion : le navigateur effacerait la liste affichée et la
 *    personne croirait avoir perdu ses favoris. « Je ne sais pas » n'emprunte
 *    jamais la sortie de « rien à signaler ».
 */
async function qui(cookies) {
  const sid = cookies.get('vp_session')?.value || null;
  if (!sid) return { refus: json({ erreur: 'session' }, 401) };
  let compte = null;
  try {
    compte = await compteDeLaSession(sid);
  } catch {
    return { refus: json({ erreur: 'indisponible' }, 503) };
  }
  if (!compte) return { refus: json({ erreur: 'session' }, 401) };
  return { compte };
}

// ⚠️ LE CORPS EST DU JSON, ET IL PEUT ÊTRE ILLISIBLE. Un `await
// request.json()` nu jette et produit un 500 — un code qui dit « le serveur
// est cassé » pour une requête malformée. On rend 400.
const corps = async (request) => { try { return await request.json(); } catch { return null; } };

export async function GET({ cookies }) {
  const { compte, refus } = await qui(cookies);
  if (refus) return refus;
  try {
    return json({ favoris: lireFavoris(compte) });
  } catch (e) {
    // ⛔ 503 ET PAS UNE LISTE VIDE. Une base injoignable qui rendrait `{}`
    //    ferait afficher « aucun favori » à quelqu'un qui en a trente — et le
    //    prochain clic écraserait la vraie liste par la fausse.
    return json({ erreur: 'stockage', detail: String(e && e.message || e) }, 503);
  }
}

export async function POST({ request, cookies }) {
  const { compte, refus } = await qui(cookies);
  if (refus) return refus;
  const b = await corps(request);
  if (!b) return json({ erreur: 'corps' }, 400);
  try {
    // ⚠️ `path` / `nom` viennent du bouton : ce sont deux valeurs déjà
    //    publiques sur la fiche qui les a écrites. `favoris.mjs` les borne.
    const r = poserFavori(compte, { uuid: b.uuid, chemin: b.path ?? b.chemin, nom: b.nom });
    if (!r.ok) return json({ erreur: r.raison }, r.raison === 'plafond' ? 409 : 400);
    return json({ ok: true, favoris: lireFavoris(compte) });
  } catch (e) {
    return json({ erreur: 'stockage', detail: String(e && e.message || e) }, 503);
  }
}

export async function DELETE({ request, cookies }) {
  const { compte, refus } = await qui(cookies);
  if (refus) return refus;
  const b = await corps(request);
  if (!b) return json({ erreur: 'corps' }, 400);
  try {
    const r = retirerFavori(compte, b.uuid);
    if (!r.ok) return json({ erreur: r.raison }, 400);
    return json({ ok: true, favoris: lireFavoris(compte) });
  } catch (e) {
    return json({ erreur: 'stockage', detail: String(e && e.message || e) }, 503);
  }
}
