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

// ═══════════════════════════════════════════════════════════════════════════
// ❤️ LOT 141 — CE QUE LE PORTEFEUILLE VÉRIFIÉ RAPPORTE ENFIN
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LA DONNÉE ÉTAIT DÉJÀ COLLECTÉE, PUIS JETÉE — LA 13ᵉ FOIS SUR CE DOSSIER.
// `veveid` expose `GET /api/avoirs` depuis des semaines, derrière `x-service`.
// Le site ne l'appelait jamais. `veveid` promet pourtant, mot pour mot :
// « Vérifiez le vôtre pour retrouver vos collectibles ici » — et `/compte/`
// n'affichait que l'adresse. ⇒ Aucune collecte nouvelle n'a été nécessaire.
//
// ⛔⛔ ON DEMANDE AVEC LE `sid`, JAMAIS AVEC UN IDENTIFIANT DE COMPTE, et
// l'enchaînement par l'identifiant MARCHERAIT — `/api/session` le rend juste
// au-dessus. C'est exactement pour ça qu'il faut refuser de l'écrire : le
// principe ne protège pas contre un identifiant inventé par un navigateur, il
// protège contre CE SITE-LÀ, compromis, qui parcourrait les comptes avec le
// secret de service. Le contourner « puisque ça marche » serait une leçon
// apprise sur un cas et non généralisée, au premier essai.
//
// ⭐⭐⭐ QUATRE ÉTATS NOMMÉS, ET AUCUN N'EMPRUNTE LA SORTIE D'UN AUTRE :
//   · `liste`      → on a la collection (et `partiel` dit si elle est entière) ;
//   · `vide`       → veveid a répondu, la synchronisation est FINIE, il n'y a
//                    rien : c'est un fait, on peut l'écrire à l'écran ;
//   · `personne`   → veveid a répondu « non » (session inconnue ou révoquée) ;
//   · `inconnu`    → ON NE SAIT PAS : service muet, réseau coupé, secret
//                    absent, ou synchronisation encore en cours.
//   · `nonverifie` → le portefeuille n'est pas prouvé : ce n'est pas une
//                    panne, c'est une étape du parcours, et elle a son mot.
//
// ⛔ APLATIR `inconnu` SUR `vide` EST LA SEULE VRAIE FAUTE POSSIBLE ICI, et
// elle est invisible : sur le disque, « aucun avoir parce que la
// synchronisation n'a pas fini » et « aucun avoir parce qu'il n'y en a pas »
// s'écrivent tous les deux `avoirs: []`. La première afficherait « aucun
// collectible » à quelqu'un qui en a trois cents, sur une simple coupure
// réseau, et personne ne verrait jamais l'erreur. C'est la même leçon que la
// sonde qui répondait `"mode":"static"` sur un site en mode server.
//
// ⚠️ CETTE FONCTION NE LÈVE PAS, contrairement à `compteDeLaSession()` — et la
// différence est délibérée. Son appelant est un GABARIT, pas une route d'API :
// une exception dans le frontmatter d'une page rendue à la demande donne une
// 500 à un membre parfaitement connecté. L'indécidable devient donc une VALEUR
// (`inconnu`) que la page sait dire, au lieu d'une exception que personne
// n'attrape. ⛔ Ce n'est pas un aplatissement : l'état reste distinct de `vide`.
export async function avoirsDeLaSession(sid) {
  if (!sid || typeof sid !== 'string') return { etat: 'personne', avoirs: [], partiel: false, wallet: null };
  const base = process.env.SESSION_API || '';
  const secret = secretDeService();
  // ⛔ Sans service configuré, ce n'est pas « personne » : c'est « je ne sais
  //    pas ». Un site mal configuré n'est pas un compte vide.
  if (!base || !secret) return { etat: 'inconnu', avoirs: [], partiel: false, wallet: null, pourquoi: 'service' };

  let r;
  try {
    // ⚠️ MÊME DÉLAI que `/api/session` juste au-dessus : deux délais différents
    // vers le même service seraient deux comportements à expliquer.
    r = await fetch(`${base}/api/avoirs?sid=${encodeURIComponent(sid)}`, {
      headers: { accept: 'application/json', 'x-service': secret },
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return { etat: 'inconnu', avoirs: [], partiel: false, wallet: null, pourquoi: 'reseau' };
  }

  // ⭐ 409 = veveid a répondu, et sa réponse est « ce portefeuille n'est pas
  //   prouvé ». C'est une étape du parcours, pas un refus et pas une panne.
  if (r.status === 409) return { etat: 'nonverifie', avoirs: [], partiel: false, wallet: null };
  // ⭐ 401 / 403 / 404 = veveid a répondu « non ». Un refus n'est pas une panne.
  if (r.status === 401 || r.status === 403 || r.status === 404) {
    return { etat: 'personne', avoirs: [], partiel: false, wallet: null };
  }
  if (!r.ok) return { etat: 'inconnu', avoirs: [], partiel: false, wallet: null, pourquoi: `http ${r.status}` };

  const j = await r.json().catch(() => null);
  if (!j) return { etat: 'inconnu', avoirs: [], partiel: false, wallet: null, pourquoi: 'corps illisible' };
  // ⛔ UN COMPTE SUPPRIMÉ N'EST PAS UN COMPTE — même règle que ci-dessus.
  if (j.supprime) return { etat: 'personne', avoirs: [], partiel: false, wallet: null };

  const avoirs = Array.isArray(j.avoirs) ? j.avoirs : [];
  // ⭐ `complet` vaut 1 quand veveid a fini de parcourir la chaîne. Absent, on
  //   ne suppose pas qu'il est fini : on ne le sait pas, et c'est la valeur
  //   par défaut la plus sûre puisqu'elle n'efface jamais rien à l'écran.
  const complet = Number(j?.sync?.complet ?? 0) === 1;
  const wallet = typeof j.wallet === 'string' ? j.wallet : null;

  if (avoirs.length) return { etat: 'liste', avoirs, partiel: !complet, wallet };
  // 🔴🔴 ICI, ET NULLE PART AILLEURS, SE JOUE LE LOT. Une liste vide ne devient
  //    un FAIT que si la synchronisation est terminée.
  if (!complet) return { etat: 'inconnu', avoirs: [], partiel: true, wallet, pourquoi: 'sync' };
  return { etat: 'vide', avoirs: [], partiel: false, wallet };
}
