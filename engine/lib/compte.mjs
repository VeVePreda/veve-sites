// ⚠️ VeVePreda/veve-sites — engine/lib/compte.mjs   (FICHIER NEUF — lot 140-3)
// ═══════════════════════════════════════════════════════════════════════════
// QUI EST CETTE PERSONNE ? — la seule réponse à laquelle on peut ranger
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 LE PROBLÈME, ET IL A DÉCIDÉ DE TOUTE L'ARCHITECTURE DU LOT.
// `src/middleware.js` ne dépose dans `Astro.locals` que TROIS choses :
// `rendu` (l. 122), `session` (l. 164-165) et `palier` (l. 172). Il n'y a
// AUCUN identifiant de compte côté veveprice. Et un palier n'identifie
// personne : on ne peut pas ranger des favoris sous « member », ils
// appartiendraient à tout le monde à la fois.
//
// ⛔ ET LE MIDDLEWARE NE PEUT PAS LE FOURNIR — IL A RAISON DE NE PAS POUVOIR.
// Il appelle `GET {SESSION_API}/session/<sid>`, la route PUBLIQUE de veveid,
// qui rend `{palier}` et rien d'autre. Le commentaire de veveid est explicite :
// « Elle ne rend QUE le palier. Le jour où on lui fera rendre l'adresse, il
// faudra la fermer. » On ne la touche pas.
//
// ✅ LA PORTE QUI EXISTE DÉJÀ — `GET {SESSION_API}/api/session?sid=<sid>`,
// derrière l'en-tête `x-service`. Elle rend
// `{ compte, email, palier, wallet, verifie, abonne, cree_le, supprime }`.
// ⭐⭐ ET ELLE N'AFFAIBLIT RIEN : c'est une LECTURE. La propriété de veveid
// « ce secret ne permet QUE DE LIRE : il ne signe rien, donc un jeu compromis
// ne peut usurper personne » reste intacte. ⇒ **zéro fichier modifié chez
// veveid** pour ce lot.
//
// ⛔⛔ JAMAIS LE `sid` COMME CLÉ DE RANGEMENT. Une session vit trente jours et
// se révoque (`sessions.revoquer`) : des favoris rangés sous le `sid`
// mourraient avec elle, sans un message. C'est `comptes.id` qu'on range, et
// c'est la seule valeur du système qui survive à une déconnexion.
//
// ⚠️ LE COÛT, ET IL SE DIT : `/api/favoris` fait DEUX allers-retours vers
// veveid — celui du middleware pour le palier, et le nôtre pour le compte.
// C'est accepté : les opérations sur favoris sont rares. ⛔ On n'« optimise »
// PAS en faisant porter le secret au middleware : il s'exécute sur CHAQUE page
// rendue à la demande, et son propre commentaire dit pourquoi il ne porte
// aucun secret.

// ⭐⭐ DEUX NOMS POUR LE MÊME SECRET — corrigé au lot 94, et la définition
// REMONTE ICI plutôt que d'être recopiée. `src/pages/api/veveid.js` la
// portait ; il l'importe désormais. ⛔ Deux copies d'un même prédicat sont
// deux copies qui divergeront — c'est la panne P30 du lot 139, et le lot 140-1
// vient d'en payer une autre avec trois lectures de `plages:`.
export const secretDeService = () => process.env.VEVEID_SERVICE || process.env.ID_SERVICE || '';

/**
 * Rend l'identifiant de compte derrière un `sid`, ou `null`.
 *
 * ⭐⭐⭐ TROIS ÉTATS, ET ILS NE PARTAGENT PAS LE MÊME CHEMIN DE SORTIE :
 *   · un compte      → la personne est identifiée ;
 *   · `null`         → il n'y a personne (pas de sid, refus de veveid) ;
 *   · une EXCEPTION  → on ne sait pas (service muet, réseau coupé).
 * ⛔ Le troisième ne doit JAMAIS être aplati sur le deuxième. « Je ne sais
 *    pas » qui emprunte la sortie de « il n'y a personne » transforme une
 *    panne de veveid en perte de favoris silencieuse : l'appelant croirait la
 *    liste vide et l'écrirait par-dessus. C'est la leçon de la sonde qui
 *    répondait `"mode":"static"` sur un site en mode server.
 */
export async function compteDeLaSession(sid) {
  if (!sid || typeof sid !== 'string') return null;
  const base = process.env.SESSION_API || '';
  const secret = secretDeService();
  // ⛔ Sans service configuré, ce n'est pas « personne » : c'est
  //    « indécidable ». On lève, et `/api/favoris` rendra 503 — un code que
  //    l'on peut distinguer d'un 401 depuis le navigateur.
  if (!base || !secret) throw new Error('compte: SESSION_API ou le secret de service manque');

  // ⚠️ SANS DÉLAI MAXIMUM, un service muet retient la requête du visiteur
  // jusqu'au bout du timeout système — deux minutes de page blanche. Même
  // valeur que `src/pages/api/veveid.js` l. 62, et c'est délibéré : deux
  // délais différents vers le même service seraient deux comportements à
  // expliquer.
  const r = await fetch(`${base}/api/session?sid=${encodeURIComponent(sid)}`, {
    headers: { 'x-service': secret },
    signal: AbortSignal.timeout(4000),
  });
  // ⭐ 401 / 404 = veveid a RÉPONDU, et sa réponse est « non ». C'est un refus,
  //   pas une panne : on rend `null`.
  if (r.status === 401 || r.status === 403 || r.status === 404) return null;
  if (!r.ok) throw new Error(`compte: veveid a répondu ${r.status}`);

  const j = await r.json().catch(() => null);
  // ⛔ UN COMPTE SUPPRIMÉ N'EST PAS UN COMPTE. veveid rend le champ
  //    `supprime` ; l'ignorer laisserait des favoris rattachés à quelqu'un qui
  //    a demandé son effacement.
  if (!j || j.supprime) return null;
  const id = j.compte;
  if (id === null || id === undefined || id === '') return null;
  // ⭐ On rend une CHAÎNE : la clé de rangement doit avoir un seul type. Un
  //   `41` et un `'41'` sont deux lignes différentes dans SQLite.
  return String(id);
}
