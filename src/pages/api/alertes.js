// ⚠️ VeVePreda/veve-sites — src/pages/api/alertes.js   (FICHIER NEUF — lot 215)
// ═══════════════════════════════════════════════════════════════════════════
// LA PORTE DES ALERTES — poser, modifier, retirer une surveillance
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ ELLE EST LE JUMEAU DE `/api/favoris` (lot 140-3), ET C'EST DÉLIBÉRÉ :
// mêmes trois sorties, même lecture de compte, même refus de confondre « il
// n'y a personne » et « je ne sais pas ». ⛔ Si tu modifies l'une des deux,
// regarde l'autre : elles doivent rester lisibles côte à côte.
//
// ⭐ LITTÉRAL, ET C'EST LE POINT. Astro exige que `prerender` soit statiquement
// analysable ; une EXPRESSION n'est pas évaluée et retombe silencieusement sur
// `true`. La valeur réelle est posée par l'intégration `veve:routes-compte`
// selon le mode du manifeste.
// 🔴🔴 ET `ROUTES_COMPTE` EST UNE LISTE ÉCRITE À LA MAIN, PAS UNE RÈGLE :
// `pages/api/alertes.js` DOIT y être inscrit (engine/lib/astro_routes_compte.mjs).
// Oubliée là-bas, cette route devient un fichier FIGÉ qui rend la même réponse
// à tout le monde, sur un build parfaitement vert — donc les alertes d'un
// compte servies à un autre, ou plus probablement une liste vide servie à tous.
// C'est la panne du lot 24, la huitième fois qu'elle est écrite dans ce dépôt.
// ✅ ET C'EST LE SEUL DEUXIÈME ENDROIT : `nginx.server.conf` porte déjà
//    `location ^~ /api/`, générique. Pour une route d'API, ce sont DEUX
//    endroits, pas sept.
export const prerender = true;

import { compteDeLaSession } from '../../../engine/lib/compte.mjs';
import { plafond } from '../../../engine/lib/access.mjs';
import {
  lireAlertes, poserAlerte, retirerAlerte, compterAlertes, SENS,
} from '../../../engine/lib/alertes.mjs';
import { dernierPoint } from '../../../engine/lib/journal.mjs';

// ⛔⛔ AUCUN `dataset()` DANS UNE ROUTE DE COMPTE — 10 328 ms mesurés au lot 140.
// Cette route ne charge donc RIEN du catalogue. Elle lit un point de la réserve
// (un `readFileSync` sur un fichier nommé par uuid) et rien d'autre.

const ENTETES = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: ENTETES });

/**
 * ⭐⭐⭐ TROIS SORTIES, ET ELLES NE SE CONFONDENT PAS :
 *   · `{ compte }`  → on sait qui c'est ;
 *   · 401           → il n'y a personne (pas de cookie, ou veveid dit non) ;
 *   · 503           → on NE SAIT PAS (veveid muet, secret absent).
 * ⛔ Aplatir le 503 sur le 401 ferait qu'une panne de veveid ressemblerait à
 *    une déconnexion : le navigateur effacerait la liste affichée et la
 *    personne croirait avoir perdu ses alertes.
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

const corps = async (request) => { try { return await request.json(); } catch { return null; } };

/**
 * ⭐ LE PLAFOND VIENT DE LA PORTE, JAMAIS D'UNE CONSTANTE ÉCRITE ICI.
 * `plafond('alerts', locals)` lit `access.gates.alerts.caps[palier]` dans le
 * manifeste. ⛔ Recopier la grille dans ce fichier en ferait une SECONDE
 * définition — et le jour où Preda change un chiffre, l'une des deux
 * continuerait à refuser. C'est exactement ce que `caps:` interdit sur
 * `price_history`, pour la même raison.
 * ⚠️ `plafond()` peut rendre `null`/`undefined` quand la porte n'a pas de
 * `caps` : on traite ça comme ZÉRO, pas comme l'infini. *Quand on doit se
 * tromper, on choisit le sens dans lequel se tromper.*
 */
const capacite = (locals) => {
  const v = Number(plafond('alerts', locals));
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

export async function GET({ cookies, locals }) {
  const { compte, refus } = await qui(cookies);
  if (refus) return refus;
  try {
    return json({ alertes: lireAlertes(compte), plafond: capacite(locals) });
  } catch (e) {
    // ⛔ 503 ET PAS UNE LISTE VIDE. Une base injoignable qui rendrait `[]`
    //    ferait afficher « aucune alerte » à quelqu'un qui en a trente — et le
    //    prochain geste écraserait la vraie liste par la fausse.
    return json({ erreur: 'stockage', detail: String((e && e.message) || e) }, 503);
  }
}

export async function POST({ request, cookies, locals }) {
  const { compte, refus } = await qui(cookies);
  if (refus) return refus;
  const b = await corps(request);
  if (!b) return json({ erreur: 'corps' }, 400);

  const max = capacite(locals);
  // ⭐ LE REFUS AU PLAFOND SE DIT AVANT D'ÉCRIRE, ET IL DIT LE CHIFFRE. Un 409
  //   nu ferait croire à un défaut ; la page a besoin du nombre pour écrire
  //   « 1 sur 1 » et proposer les paliers.
  if (max <= 0) return json({ erreur: 'palier', plafond: 0 }, 403);

  try {
    // 🔑 L'ÉTAT COURANT SE LIT ICI, SUR LA ROUTE, ET IL DÉCIDE DE L'ARMEMENT.
    //    Poser « sous 40 $ » sur une pièce qui vaut déjà 37 $ démarre DÉSARMÉ :
    //    sinon le premier balayage déclencherait sur un niveau, pas sur un
    //    franchissement — et le déclenchement serait PLAUSIBLE, donc invisible.
    // ⚠️ `null` est une réponse valable (réserve absente) : `poserAlerte` part
    //    alors armé et ancre `vu_ts` à maintenant. Il ne rejoue pas le passé.
    const etat = dernierPoint(b.uuid);
    const r = poserAlerte(compte, {
      uuid: b.uuid, chemin: b.path ?? b.chemin, nom: b.nom,
      sens: b.sens, seuil: b.seuil,
    }, etat, max);
    if (!r.ok) {
      const code = r.raison === 'plafond' ? 409 : 400;
      return json({ erreur: r.raison, plafond: max, sens: SENS }, code);
    }
    return json({ ok: true, alertes: lireAlertes(compte), plafond: max });
  } catch (e) {
    return json({ erreur: 'stockage', detail: String((e && e.message) || e) }, 503);
  }
}

export async function DELETE({ request, cookies, locals }) {
  const { compte, refus } = await qui(cookies);
  if (refus) return refus;
  const b = await corps(request);
  if (!b) return json({ erreur: 'corps' }, 400);
  try {
    // ⚠️ CECI EFFACE AUSSI LES DÉCLENCHEMENTS DE CETTE PIÈCE — voir
    //    `retirerAlerte()`. La page le dit AVANT de l'appeler ; une
    //    suppression qu'on découvre après coup n'est pas une suppression
    //    demandée.
    const r = retirerAlerte(compte, b.uuid);
    if (!r.ok) return json({ erreur: r.raison }, 400);
    return json({ ok: true, alertes: lireAlertes(compte), plafond: capacite(locals),
                  restant: compterAlertes(compte) });
  } catch (e) {
    return json({ erreur: 'stockage', detail: String((e && e.message) || e) }, 503);
  }
}
