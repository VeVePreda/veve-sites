// ⚠️ VeVePreda/veve-sites — engine/lib/favoris.mjs   (FICHIER NEUF — lot 140-3)
// ═══════════════════════════════════════════════════════════════════════════
// LE RANGEMENT DES FAVORIS — SQLite, chez veveprice, rangé par COMPTE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚖️ ARBITRAGE PREDA ① DU 12/08 : la base vit ICI, pas chez veveid. Raison
// retenue : veveid garde intacte sa propriété « le secret de service ne permet
// que de lire ». On ne l'affaiblit pas pour une donnée de confort.
//
// ⭐ AUCUNE DÉPENDANCE AJOUTÉE. `node:sqlite` est intégré à Node 22 et ne
// demande aucun drapeau — MESURÉ, pas déduit : `veveid/Dockerfile` l. 78 est
// `CMD ["node", "server.ts"]`, sans `--experimental-sqlite`, sur
// `node:22-alpine`. Ce dépôt tourne sur la même image (Dockerfile l. 545).
// ⇒ `package.json` et `package-lock.json` NE BOUGENT PAS.
// ⚠️ Node émet `ExperimentalWarning: SQLite is an experimental feature` sur
// stderr. C'est NORMAL, veveid vit avec depuis juillet. ⛔ Ne pas le prendre
// pour une erreur de build.
//
// 🔴🔴🔴 LE PIÈGE QUI TUE LES DONNÉES SANS UN SEUL MESSAGE, ET IL EST ARMÉ.
// Sans volume monté sur `/data`, TOUT FONCTIONNE — la base s'ouvre, les
// favoris se posent, ils se relisent. Jusqu'au déploiement suivant, où le
// conteneur est remplacé et où `/data` redevient un dossier vide de l'image.
// Tous les favoris disparaissent, sans erreur, sans run rouge, sans plainte
// (il n'y a que deux comptes). ⇒ C'est `etatDuStockage()` ci-dessous, exposé
// par `/api/sante`, qui rend cet oubli VISIBLE de l'extérieur.
// ⛔ ET SURTOUT : PAS DE `VOLUME ["/data"]` DANS LE DOCKERFILE. C'est la
// recette de veveid (son Dockerfile l. 47-60 explique pourquoi) : sans cette
// ligne, un `/data` non monté reste un simple dossier de l'image, et la sonde
// le dit. Avec elle, Docker crée un volume ANONYME au démarrage — la base
// survivrait au redémarrage et mourrait au redéploiement, ce qui est
// exactement le pire des deux mondes, parce que ça a l'air de marcher.

import { DatabaseSync } from 'node:sqlite';
import { statSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CHEMIN = () => process.env.DB_PATH || '/data/veve-favoris.db';

// ⭐⭐ OUVERTURE PARESSEUSE, ET C'EST OBLIGATOIRE. Ouvrir la base au moment de
// l'IMPORT la ferait ouvrir AU BUILD : `astro build` importe ce module dès
// qu'il analyse `/api/favoris`, et il tournerait alors dans l'étape de
// construction, où `/data` n'existe pas et n'a rien à faire là. Un fichier
// `veve-favoris.db` serait cuit dans l'image — une base fantôme, non montée,
// que le premier déploiement remplacerait.
let base = null;
let panne = null;

function ouvrir() {
  if (base) return base;
  if (panne) throw panne;
  try {
    const p = CHEMIN();
    // ⛔⛔ CE MODULE NE CRÉE AUCUN DOSSIER, ET C'EST UNE CORRECTION MESURÉE.
    // La première version faisait `mkdirSync('/data')`. Or `/api/sante`
    // importe ce fichier, et sur un site en mode STATIC (vevewiki) Astro
    // EXÉCUTE le handler AU BUILD pour en figer la sortie : le build aurait
    // donc créé `/data` et une base vide DANS L'IMAGE DE CONSTRUCTION.
    // 🔴🔴 ET LE BAC À SABLE NE L'A PAS VU — il ne tourne pas en root, le
    // `mkdir` a échoué, et le contrôle est passé au vert pour la mauvaise
    // raison. Le Dockerfile, lui, construit en root. *CI et bac à sable sont
    // le même instrument avec le même angle mort : « c'est vert » n'est pas
    // « c'est mesuré ».*
    // ⇒ Créer `/data` est le travail du Dockerfile (`RUN mkdir -p /data`), et
    //   d'un seul endroit. Si le dossier manque, l'ouverture échoue et
    //   `etatDuStockage()` le DIT — c'est exactement ce qu'on lui demande.
    const d = new DatabaseSync(p);
    // ⭐ WAL : deux processus Node ne servent jamais en parallèle ici, mais un
    //   redéploiement peut les faire se chevaucher quelques secondes. Sans
    //   WAL, l'ancien tient un verrou exclusif et le nouveau rend 500.
    d.exec('PRAGMA journal_mode = WAL');
    // ⭐⭐ LA CLÉ EST (compte, uuid), ET C'EST LE CŒUR DU LOT. Un favori
    //   appartient à un COMPTE — pas à un navigateur, pas à une session. C'est
    //   cette seule ligne qui fait qu'un membre retrouve sa liste depuis son
    //   téléphone.
    // ⛔ AUCUN PRIX, AUCUNE COTE, comme dans `vp_fav` avant lui : un favori est
    //   une intention, pas une valeur. Le mur ne bouge pas d'un pouce, et cette
    //   table ne peut donc pas devenir une fuite dérivée du prix.
    d.exec(`CREATE TABLE IF NOT EXISTS favoris (
      compte  TEXT    NOT NULL,
      uuid    TEXT    NOT NULL,
      chemin  TEXT    NOT NULL DEFAULT '',
      nom     TEXT    NOT NULL DEFAULT '',
      pose_le INTEGER NOT NULL,
      PRIMARY KEY (compte, uuid)
    )`);
    base = d;
    return base;
  } catch (e) {
    // ⛔ ON MÉMORISE LA PANNE plutôt que de retenter à chaque requête : un
    //    `/data` absent ferait sinon un `mkdir` par appel, et l'erreur
    //    changerait de forme au fil du temps.
    panne = e;
    throw e;
  }
}

// ⭐ PLAFOND. Sans lui, un script pourrait écrire des millions de lignes dans
// une base montée sur le disque du VPS. Deux cents favoris est déjà vingt-cinq
// fois ce que la page en montre.
export const PLAFOND = 200;

// ⛔ ON VALIDE LA FORME, PAS LE CONTENU. L'uuid vient du navigateur : il doit
// ressembler à un uuid, sinon la table devient un dépotoir. Les longueurs
// bornent ce qu'un client peut écrire — ce sont deux champs d'affichage.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const coupe = (v, n) => String(v ?? '').slice(0, n);

export function lireFavoris(compte) {
  const d = ouvrir();
  // ⭐ Le plus récemment posé en premier — le même ordre que `vp_fav` rendait,
  //   et pour la même raison : on revient chercher ce qu'on vient de mettre de
  //   côté. Le tri vit ICI, une fois, et plus dans chacun des lecteurs.
  const lignes = d.prepare(
    'SELECT uuid, chemin, nom, pose_le FROM favoris WHERE compte = ? ORDER BY pose_le DESC',
  ).all(String(compte));
  // ⭐⭐ LA MÊME FORME QUE `vp_fav` RENDAIT (`{ uuid: {p, n, t} }`). Les trois
  //   lecteurs n'ont donc pas à réapprendre un format en même temps qu'ils
  //   changent de source — un seul changement à la fois.
  const o = {};
  for (const l of lignes) o[l.uuid] = { p: l.chemin, n: l.nom, t: l.pose_le };
  return o;
}

export function poserFavori(compte, { uuid, chemin, nom }) {
  if (!UUID.test(String(uuid || ''))) return { ok: false, raison: 'uuid' };
  const d = ouvrir();
  const n = d.prepare('SELECT COUNT(*) AS n FROM favoris WHERE compte = ?').get(String(compte)).n;
  // ⛔ On vérifie que la pièce n'est pas DÉJÀ là avant de refuser au plafond :
  //    sinon reposer un favori existant échouerait une fois la liste pleine,
  //    alors qu'il n'ajoute aucune ligne.
  const deja = d.prepare('SELECT 1 FROM favoris WHERE compte = ? AND uuid = ?').get(String(compte), String(uuid));
  if (!deja && n >= PLAFOND) return { ok: false, raison: 'plafond' };
  d.prepare(`INSERT INTO favoris (compte, uuid, chemin, nom, pose_le) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(compte, uuid) DO UPDATE SET chemin = excluded.chemin,
               nom = excluded.nom, pose_le = excluded.pose_le`)
    .run(String(compte), String(uuid), coupe(chemin, 300), coupe(nom, 200), Date.now());
  return { ok: true };
}

export function retirerFavori(compte, uuid) {
  if (!UUID.test(String(uuid || ''))) return { ok: false, raison: 'uuid' };
  ouvrir().prepare('DELETE FROM favoris WHERE compte = ? AND uuid = ?').run(String(compte), String(uuid));
  // ⭐ Retirer ce qui n'est pas là est un SUCCÈS, pas une erreur : le bouton ★
  //   est une bascule, et deux onglets peuvent l'avoir déjà fait.
  return { ok: true };
}

/**
 * ⭐⭐⭐ LA SENTINELLE DU VOLUME — c'est elle qui rend l'oubli visible.
 *
 * ⛔ TROIS VALEURS POUR `montee`, ET LA TROISIÈME COMPTE AUTANT QUE LES DEUX
 * AUTRES : `true`, `false`, et `null` = INDÉCIDABLE. Un `false` inventé parce
 * qu'on n'a pas su lire ferait crier une sonde sur une installation correcte,
 * et on apprendrait à l'ignorer — après quoi elle ne servirait plus à rien.
 */
export function etatDuStockage() {
  const chemin = CHEMIN();
  const dossier = dirname(resolve(chemin));
  let ouverte = false;
  try { ouvrir(); ouverte = true; } catch { ouverte = false; }

  // ① LA SOURCE DE VÉRITÉ : la table des montages du noyau. Si le dossier y
  //    figure comme CIBLE, c'est un point de montage, sans interprétation.
  let montee = null;
  try {
    const cibles = readFileSync('/proc/self/mounts', 'utf8')
      .split('\n').map((l) => l.split(' ')[1]).filter(Boolean)
      // les espaces sont échappés en octal dans /proc
      .map((c) => c.replace(/\\040/g, ' '));
    montee = cibles.includes(dossier);
  } catch { montee = null; }

  // ② LE REPLI, ET IL EST ÉCRIT APRÈS LA SOURCE, PAS AVANT. Un point de
  //    montage change de périphérique par rapport à son parent. C'est vrai, et
  //    ça suffit à confirmer un `false` douteux — mais ça se trompe sur un
  //    bind-mount du même disque, d'où l'ordre.
  if (montee === false) {
    try {
      if (statSync(dossier).dev !== statSync(dirname(dossier)).dev) montee = true;
    } catch { /* le dossier n'existe pas : le `false` de ① tient */ }
  }
  return { ouverte, montee, dossier };
}

// ⭐ POUR LE BANC UNIQUEMENT — remet le module à zéro entre deux bases.
// ⛔ Elle n'est appelée par aucune route : une base qu'on referme en
//    production, c'est une requête sur deux qui rouvre un fichier.
export function _reinitialiser() {
  try { base?.close(); } catch { /* déjà fermée */ }
  base = null; panne = null;
}
