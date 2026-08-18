// ⚠️ VeVePreda/veve-sites — engine/lib/prefs.mjs   (FICHIER NEUF — lot 154-B)
// ═══════════════════════════════════════════════════════════════════════════
// LE MAGASIN DES PRÉFÉRENCES DE COMPTE — la fondation, pas une fonctionnalité
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI CE FICHIER EXISTE, ET POURQUOI IL PASSE AVANT LE LOT 160.
// Trois demandes de Preda posent LA MÊME QUESTION : où range-t-on une
// préférence qui appartient à un COMPTE ?
//   · 154-B — la langue de l'interface (« je règle sur français, la navigation
//             me remet en anglais » — 10/08) ;
//   · 160 z — l'agencement des modules du tableau de bord ;
//   · 160 ae — les réglages d'emails (ne pas recevoir la newsletter).
// Écrite une fois, les deux autres coûtent quelques lignes. Écrite trois fois,
// elles divergeront — et c'est la seule raison pour laquelle ce lot est court.
//
// ⛔ CE FICHIER NE SAIT PAS CE QU'EST UNE LANGUE. Il range des couples
// (clé, valeur) sous un compte, et rien d'autre. Un magasin qui connaîtrait
// ses clés demanderait une migration au troisième réglage ; celui-ci n'en
// demandera aucune. C'est ce qui en fait une fondation et pas une table de
// plus.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔑 LES TROIS DÉCISIONS DE CONCEPTION, ET CE QU'ELLES ONT COÛTÉ À TRANCHER
// ═══════════════════════════════════════════════════════════════════════════
//
// ① LA MÊME BASE QUE LES FAVORIS (`/data/veve-favoris.db`), PAS UNE SECONDE.
//    Une seconde base, c'est un second fichier à monter — donc une seconde
//    occasion d'oublier le volume, et le piège décrit en tête de `favoris.mjs`
//    est armé DEUX fois. `etatDuStockage()` sonde un dossier : en partageant
//    le fichier, `/api/sante` couvre ce magasin sans une ligne de plus.
//    ⚠️ Le NOM du fichier dit « favoris » et porte maintenant autre chose.
//    ⛔ On ne le renomme PAS : le renommer perdrait la base en production au
//    déploiement suivant, silencieusement. Un nom un peu étroit coûte moins
//    cher qu'une migration de fichier sur un volume monté.
//
// ② UNE CONNEXION PROPRE, ET `favoris.mjs` N'EST PAS TOUCHÉ D'UNE LIGNE.
//    Extraire l'ouverture dans un module commun aurait été plus élégant — et
//    aurait réécrit un fichier qui sert les favoris EN PRODUCTION pour un gain
//    de pureté. SQLite en WAL accepte plusieurs connexions sur le même fichier
//    dans le même processus ; le coût est un descripteur, le gain est que ce
//    lot ne peut pas casser les favoris.
//    ⭐ *On ne réécrit pas ce qui marche pour faire de la place à ce qu'on
//    écrit.*
//
// ③ 🔴🔴🔴 LA BASE EST LA VÉRITÉ, LE COOKIE EST LE PORTEUR — ET C'EST LE
//    POINT LE PLUS IMPORTANT DE TOUT LE LOT.
//    La tentation était de lire la préférence sur chaque route rendue à la
//    demande. MESURÉ AVANT D'ÉCRIRE, et c'est ce qui a changé la conception :
//      · le middleware appelle déjà `${SESSION_API}/session/{sid}` — mais cet
//        endpoint ne rend QUE `palier`, jamais l'identifiant de compte ;
//      · l'identifiant vient de `${SESSION_API}/api/session?sid=…`, un AUTRE
//        endpoint, qui exige le secret de service et pose un délai de 4 s
//        (`compte.mjs` l. 73).
//    ⇒ Résoudre le compte sur chaque page ajouterait un SECOND aller-retour
//      réseau à chaque affichage — sur `/market/`, qui est `no-store` et donc
//      REPAYÉE à chaque visite. Pour choisir un dictionnaire.
//    ⛔ Et ça n'aurait même pas suffi : les ~3 000 pages publiques sont
//      pré-générées. Le middleware sort avant elles, il n'y a aucun serveur à
//      qui demander. Elles ne peuvent lire QUE le cookie (`src/socle/55-langue.js`,
//      lot 129). Une préférence qui ne vivrait qu'en base serait inopérante
//      sur 3 000 pages sur 3 100 — c'est-à-dire exactement là où Preda a
//      signalé le défaut.
//    ⇒ ON ÉCRIT LES DEUX ENSEMBLE, et on repose le cookie depuis la base à la
//      CONNEXION (`src/pages/api/entrer.js`) — le seul endroit du site où
//      l'aller-retour vers veveid est DÉJÀ payé. Zéro requête ajoutée sur les
//      pages courantes, et le changement d'appareil se résout au login, qui
//      est précisément le moment où la question se pose.

import { DatabaseSync } from 'node:sqlite';

// ⭐ MÊME CHEMIN QUE `favoris.mjs`, ET LU DE LA MÊME FAÇON. Une constante
// recopiée diverge ; une variable d'environnement lue deux fois ne peut pas.
const CHEMIN = () => process.env.DB_PATH || '/data/veve-favoris.db';

// ⭐⭐ OUVERTURE PARESSEUSE — même raison que `favoris.mjs`, et elle vaut
// encore plus ici : ce module sera importé par `/api/entrer`, que `astro build`
// analyse. Ouvrir à l'import ouvrirait la base AU BUILD, où `/data` n'existe
// pas et n'a rien à faire.
// ⛔ CE MODULE NE CRÉE AUCUN DOSSIER. Créer `/data` est le travail du
//    Dockerfile, et d'un seul endroit. Le bac à sable ne tourne pas en root :
//    un `mkdirSync` y échouerait et le contrôle passerait au vert pour la
//    mauvaise raison — c'est la correction mesurée du lot 140-3.
let base = null;
let panne = null;

function ouvrir() {
  if (base) return base;
  if (panne) throw panne;
  try {
    const d = new DatabaseSync(CHEMIN());
    // ⭐ WAL, comme `favoris.mjs`. Idempotent : le reposer sur une base qui
    //   l'a déjà ne coûte rien, et ne pas le poser du tout ferait dépendre ce
    //   module de l'ordre dans lequel les deux magasins s'ouvrent — un
    //   couplage invisible et impossible à retrouver le jour où il mord.
    d.exec('PRAGMA journal_mode = WAL');
    // ⭐⭐ LA CLÉ EST (compte, cle). Une préférence appartient à un COMPTE —
    //   pas à un navigateur, pas à une session. C'est cette ligne qui fait
    //   qu'un membre retrouve sa langue depuis son téléphone.
    // ⭐ `maj_le` n'est pas décoratif : le jour où deux appareils écrivent la
    //   même clé, c'est la seule chose qui permettra de dire lequel a gagné.
    //   Une colonne d'horodatage absente ne se rattrape pas après coup.
    d.exec(`CREATE TABLE IF NOT EXISTS prefs (
      compte  TEXT    NOT NULL,
      cle     TEXT    NOT NULL,
      valeur  TEXT    NOT NULL DEFAULT '',
      maj_le  INTEGER NOT NULL,
      PRIMARY KEY (compte, cle)
    )`);
    base = d;
    return base;
  } catch (e) {
    // ⛔ ON MÉMORISE LA PANNE plutôt que de retenter à chaque appel — même
    //    raison que `favoris.mjs` : sinon l'erreur change de forme au fil du
    //    temps et on cherche au mauvais endroit.
    panne = e;
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LES BORNES — ⛔ ON VALIDE LA FORME, PAS LE SENS
// ═══════════════════════════════════════════════════════════════════════════
// Ce module ne sait pas ce qu'est une langue valide : c'est `i18n.mjs` qui le
// sait, et il le sait déjà (`languesInterface()` valide contre le manifeste).
// Deux juges pour une même question, c'est deux réponses le jour où l'un
// change. ⇒ ici on borne la TAILLE, l'appelant borne le SENS.
//
// ⭐ PLAFOND DE CLÉS. Sans lui, un script pourrait écrire des millions de
// lignes sous un même compte dans une base montée sur le disque du VPS — qui
// a 7,8 Go et sur lequel le build tourne. Trente clés est déjà largement au-delà
// de ce que la langue + l'agencement + les emails demanderont.
export const PLAFOND_CLES = 30;
// ⭐ Un agencement de modules est la plus grosse valeur prévue : une liste de
// noms courts en JSON. 4 Ko la couvre dix fois.
export const PLAFOND_VALEUR = 4096;

// ⛔ La clé compose un identifiant de rangement : on la borne à un alphabet
//    étroit. Sans ça, une clé venue d'un formulaire pourrait porter n'importe
//    quoi, et la table deviendrait un dépotoir qu'aucune requête ne saurait
//    plus balayer.
const CLE_OK = /^[a-z][a-z0-9_.-]{0,39}$/;

/** Rend la valeur rangée sous (compte, cle), ou `null` si elle n'existe pas.
 *
 * ⭐⭐⭐ `null` VEUT DIRE « RIEN DE RANGÉ », ET PAS « JE N'AI PAS SU LIRE ».
 * La seconde situation LÈVE. ⛔ Aplatir les deux transformerait une panne de
 * disque en « ce membre n'a pas de préférence », donc en réglage effacé au
 * premier passage de l'appelant qui écrit par-dessus. C'est mot pour mot la
 * leçon de `compteDeLaSession()` (trois états, trois sorties) — on ne la
 * réapprend pas ici.
 */
export function lirePref(compte, cle) {
  if (!compte || !CLE_OK.test(String(cle || ''))) return null;
  const d = ouvrir();
  const r = d.prepare('SELECT valeur FROM prefs WHERE compte = ? AND cle = ?')
    .get(String(compte), String(cle));
  return r ? String(r.valeur) : null;
}

/** Range une valeur sous (compte, cle). Rend `{ ok }` ou `{ ok:false, pourquoi }`.
 *
 * ⭐ ELLE NE LÈVE PAS SUR UN REFUS, et c'est délibéré : un refus de forme est
 * une réponse, pas une panne. Seule l'impossibilité de lire ou d'écrire lève.
 */
export function poserPref(compte, cle, valeur) {
  if (!compte) return { ok: false, pourquoi: 'compte' };
  const k = String(cle || '');
  if (!CLE_OK.test(k)) return { ok: false, pourquoi: 'cle' };
  const v = String(valeur ?? '');
  if (v.length > PLAFOND_VALEUR) return { ok: false, pourquoi: 'valeur-trop-longue' };

  const d = ouvrir();
  const c = String(compte);
  // ⭐ LE PLAFOND SE VÉRIFIE SUR UNE CLÉ NEUVE SEULEMENT. Le compter avant un
  //   remplacement bloquerait la mise à jour d'une clé existante une fois le
  //   plafond atteint — un réglage qu'on ne peut plus changer, sans message.
  const existe = d.prepare('SELECT 1 FROM prefs WHERE compte = ? AND cle = ?').get(c, k);
  if (!existe) {
    const n = d.prepare('SELECT COUNT(*) AS n FROM prefs WHERE compte = ?').get(c);
    if ((n?.n ?? 0) >= PLAFOND_CLES) return { ok: false, pourquoi: 'plafond' };
  }
  d.prepare(`INSERT INTO prefs (compte, cle, valeur, maj_le) VALUES (?, ?, ?, ?)
             ON CONFLICT(compte, cle) DO UPDATE SET valeur = excluded.valeur,
                                                    maj_le = excluded.maj_le`)
    .run(c, k, v, Date.now());
  return { ok: true };
}

/** Retire une clé. ⭐ Retirer une préférence n'est pas la mettre à vide : une
 * clé absente retombe sur le défaut du site, une clé vide vaut « vide ». */
export function retirerPref(compte, cle) {
  if (!compte || !CLE_OK.test(String(cle || ''))) return { ok: false, pourquoi: 'cle' };
  ouvrir().prepare('DELETE FROM prefs WHERE compte = ? AND cle = ?')
    .run(String(compte), String(cle));
  return { ok: true };
}

/** Toutes les préférences d'un compte, en objet simple.
 * ⭐ Elle servira au lot 160 (le tableau de bord lit son agencement et ses
 *   réglages d'emails d'un coup) — une requête par réglage sur une page qui en
 *   porte cinq, c'est cinq allers-retours SQLite pour rien. */
export function lirePrefs(compte) {
  if (!compte) return {};
  const out = {};
  for (const r of ouvrir().prepare('SELECT cle, valeur FROM prefs WHERE compte = ?')
    .all(String(compte))) out[String(r.cle)] = String(r.valeur);
  return out;
}

/** ⭐ EFFACE TOUT D'UN COMPTE. Le lot 160 porte « suppression de mon compte » :
 *  le jour où il l'appellera, cette fonction devra exister ET être éprouvée.
 *  ⛔ L'écrire au moment de la suppression, sous pression, c'est l'écrire mal. */
export function oublierCompte(compte) {
  if (!compte) return { ok: false, pourquoi: 'compte' };
  const r = ouvrir().prepare('DELETE FROM prefs WHERE compte = ?').run(String(compte));
  return { ok: true, retirees: Number(r?.changes ?? 0) };
}

// ⭐ POUR LE BANC UNIQUEMENT — même dispositif que `favoris.mjs`.
// ⛔ Aucune route ne l'appelle : refermer une base en production, c'est une
//    requête sur deux qui rouvre un fichier.
export function _reinitialiser() {
  try { base?.close(); } catch { /* déjà fermée */ }
  base = null; panne = null;
}
