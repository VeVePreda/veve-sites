// ⚠️ VeVePreda/veve-sites — engine/lib/portes_surcharge.mjs  (FICHIER NEUF — lot 164)
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LE RÉGLAGE DES PORTES, À CHAUD, ET SA DATE DE FIN OBLIGATOIRE
// ═══════════════════════════════════════════════════════════════════════════
//
// Demande de Preda du 19/08/2026 : pouvoir déplacer un module d'un grade à
// l'autre depuis le site, « durant les tests je les donne accessibles aux
// membres, PUIS ENSUITE je les mets qu'aux payants ».
//
// ⛔⛔ CE MODULE FAIT CE QU'`access.mjs` INTERDIT PAR ÉCRIT. Son commentaire
//    sur `access.demo`, mot pour mot :
//      « Le risque énoncé n'est pas “la démo est dangereuse”, c'est RIEN NE ME
//        RAPPELLERA DE L'ÉTEINDRE. Une variable Coolify est invisible depuis
//        le dépôt : elle ne peut être rappelée par rien. […] ⛔ NE PAS la
//        déplacer dans l'environnement “pour pouvoir l'éteindre sans
//        redéployer” : c'est précisément la propriété qu'on ne veut pas. »
//    ⇒ Ce module n'est acceptable QUE parce que la fin est OBLIGATOIRE et
//      COURTE. Ce n'est pas un rappel, c'est une fermeture. Il n'existe
//      aucun chemin, dans ce fichier, qui écrive une surcharge sans date.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔑 LES QUATRE PROPRIÉTÉS QUI RENDENT CE MODULE SÛR
// ═══════════════════════════════════════════════════════════════════════════
//
// ① IL NE PEUT PAS ATTEINDRE LE BUILD, ET C'EST STRUCTUREL.
//    L'ouverture est PARESSEUSE (patron de `prefs.mjs` l. 77) : la base ne
//    s'ouvre qu'au premier appel. Or `astro build` tourne dans un conteneur où
//    `/data` n'existe pas — mesuré au lot 154-B : « aucun `.db` créé, `/data`
//    absent, les deux builds passent ». ⇒ pendant le build, `lire()` rend
//    `{}`, et les ~3 000 pages pré-générées figent le palier DU MANIFESTE.
//    ⭐ Ce n'est pas une précaution qu'on peut oublier de poser : c'est la
//      conséquence de l'endroit où vit le fichier.
//
// ② IL NE LÈVE JAMAIS VERS `porte()`, ET C'EST UNE DIFFÉRENCE ASSUMÉE AVEC
//    `prefs.mjs`. Celui-ci sert des routes où la panne DOIT se voir (503).
//    Celui-ci est lu par `porte()`, appelée des milliers de fois par build et
//    par toutes les pages : une exception y ferait tomber le site entier pour
//    un réglage d'exploitation. ⇒ en cas d'échec on rend `{}`.
//    ⛔ ET CE N'EST PAS « ÉCHOUER OUVERT ». Rendre `{}` = appliquer le
//      MANIFESTE, c'est-à-dire le comportement normal et le plus fermé des
//      deux. Un repli qui ouvrirait une porte serait inacceptable ; celui-ci
//      ne fait que renoncer à l'assouplir.
//
// ③ AUCUN ALLER-RETOUR RÉSEAU. `node:sqlite` est SYNCHRONE, et la base est un
//    fichier local sur le volume déjà monté. `porte()` est synchrone elle
//    aussi : elle peut donc lire directement. ⛔ Pas de middleware, pas de
//    second appel à veveid — la conception qui passait par la session a été
//    écartée le 19/08 : une surcharge de porte est GLOBALE au site, la ranger
//    dans un objet de session serait ranger un réglage collectif dans un
//    contenant individuel.
//
// ④ UN CACHE COURT, PARCE QUE `porte()` EST APPELÉE PARTOUT. Sans lui, une
//    page qui interroge six portes ferait six lectures SQLite. Avec 3 s, un
//    changement se voit au rechargement suivant — assez vif pour qu'on croie
//    que c'est instantané, assez long pour que le coût disparaisse.
//    ⚠️ Le cache est en MÉMOIRE DE PROCESSUS : il meurt au redémarrage du
//      conteneur, ce qui est exactement le bon comportement.
//
// ⭐ MÊME FICHIER DE BASE QUE `favoris.mjs` ET `prefs.mjs`, ET MÊME RAISON :
//   un second fichier serait un second volume à monter, à sauvegarder et à
//   oublier. SQLite en WAL accepte plusieurs connexions sur le même fichier
//   dans le même processus ; le coût est un descripteur.
// ⛔ ET ON NE TOUCHE NI `favoris.mjs` NI `prefs.mjs` — les deux servent en
//   production. *On ne réécrit pas ce qui marche pour faire de la place à ce
//   qu'on écrit.*
//
// ⚠️ CE MODULE NE CONNAÎT NI LES PORTES NI LES PALIERS, ET C'EST VOULU.
//   Importer `access.mjs` créerait un CYCLE (access → surcharge → access).
//   Même partage des rôles que `prefs.mjs` : « ici on borne la FORME,
//   l'appelant borne le SENS ». C'est `porte()` qui refuse un palier inconnu,
//   et c'est `/compte/` qui refuse une porte inconnue.

import { DatabaseSync } from 'node:sqlite';

const CHEMIN = () => process.env.DB_PATH || '/data/veve-favoris.db';

/** ⭐ Le plafond de durée. Voir plus bas pourquoi il est plus court qu'un abonnement. */
export const JOURS_MAX = 30;

/** Le cache, et sa durée de vie. ⭐ 3 s : voir ④ en tête de fichier. */
const TTL_MS = 3000;
let _cache = null;
let _cacheAt = 0;

let base = null;
let panne = null;

function ouvrir() {
  if (base) return base;
  if (panne) throw panne;
  try {
    const d = new DatabaseSync(CHEMIN());
    d.exec('PRAGMA journal_mode = WAL');
    // ⭐⭐ `jusqu_a` EN EPOCH MILLISECONDES, ET C'EST ÉCRIT ICI PARCE QUE CE
    //   PROJET S'EST DÉJÀ FAIT AVOIR : `ts_releve` était en epoch SECONDES et
    //   a coûté une lecture fausse (lot 144-A). Un entier sans unité déclarée
    //   est un piège à retardement. ⇒ MILLISECONDES, comme `Date.now()`.
    // ⭐ `porte` est la CLÉ PRIMAIRE : une porte n'a qu'une surcharge à la
    //   fois. Deux lignes pour une même porte demanderaient de choisir, et
    //   « la plus récente gagne » est une règle qu'on oublie d'appliquer.
    d.exec(`CREATE TABLE IF NOT EXISTS portes_surcharge (
      porte   TEXT    NOT NULL PRIMARY KEY,
      tier    TEXT    NOT NULL,
      jusqu_a INTEGER NOT NULL,
      maj_le  INTEGER NOT NULL
    )`);
    base = d;
    return base;
  } catch (e) {
    panne = e;
    throw e;
  }
}

/**
 * Les surcharges ENCORE VALIDES, sous la forme `{ porte: tier }`.
 *
 * ⛔ ELLE NE LÈVE JAMAIS — voir ② en tête de fichier. Une base absente (le
 *    build), un fichier illisible, un disque plein : on rend `{}` et le
 *    manifeste reprend la main.
 * ⚠️ ON NE SUPPRIME PAS LA LIGNE EXPIRÉE en passant. Une lecture qui écrit est
 *    une lecture qui peut échouer, et la ligne expirée est le seul endroit qui
 *    dise « ceci a été ouvert jusqu'au 3 » — utile le jour où on cherche
 *    pourquoi quelqu'un a vu quelque chose.
 */
export function lireSurcharges(maintenant = Date.now()) {
  if (_cache && maintenant - _cacheAt < TTL_MS) return _cache;
  let out = {};
  try {
    const lignes = ouvrir()
      .prepare('SELECT porte, tier, jusqu_a FROM portes_surcharge').all();
    for (const l of lignes) {
      // ⭐ LE FILTRE D'EXPIRATION EST ICI, ET NULLE PART AILLEURS. Trois
      //   lectures justes de la même loi finissent par diverger le jour où UNE
      //   apprend une règle de plus — c'est la panne du lot 140-1, et elle a
      //   coûté trois copies de la profondeur d'historique.
      if (Number(l.jusqu_a) <= maintenant) continue;
      out[String(l.porte)] = String(l.tier);
    }
  } catch {
    // ⛔ SILENCE VOLONTAIRE, ET IL EST BORNÉ : cette fonction tourne au build
    //    sur des milliers d'appels. Un `console.log` par appel noierait le
    //    journal de build dans lequel on lit les vraies pannes. L'état
    //    « la base répond-elle ? » est déjà publié par `/api/sante`.
    out = {};
  }
  _cache = out;
  _cacheAt = maintenant;
  return out;
}

/**
 * Poser une surcharge. `jours = 0` la RETIRE.
 *
 * ⛔ CONTRAIREMENT À LA LECTURE, CELLE-CI LÈVE. C'est un geste, pas un
 *    affichage : si l'écriture échoue, la personne doit le savoir tout de
 *    suite — sinon elle croit avoir ouvert une porte qui est restée fermée,
 *    et elle cherchera le défaut ailleurs pendant une heure.
 *
 * ⚠️ LA BORNE : 0..JOURS_MAX, et `JOURS_MAX` vaut 30 quand un abonnement va
 *    jusqu'à 400. ⭐ L'ARGUMENT, ET IL N'EST PAS UNE PRÉFÉRENCE : un
 *    abonnement ouvre des droits À UNE PERSONNE qui a payé ; une surcharge de
 *    porte les ouvre À TOUT LE MONDE sur un site public — dont `wallet_watch`,
 *    qui est le classement nominatif des cent plus gros portefeuilles AVEC
 *    LEURS ADRESSES. Deux rayons, deux bornes. ⛔ Les aligner « par
 *    cohérence » reviendrait à s'aligner sur le plus permissif.
 *
 * ⭐ RESSERRER EST PERMIS (poser `whale` sur une porte ouverte). Un outil qui
 *   ne saurait qu'ouvrir n'aurait rien à offrir le jour où il faut refermer
 *   vite, et c'est le jour où on en a le plus besoin.
 */
export function poserSurcharge(porte, tier, jours) {
  const p = String(porte ?? '').trim();
  const t = String(tier ?? '').trim();
  if (!p) throw new Error('portes: aucune porte donnée');

  // ⭐ LE RETRAIT PASSE AVANT TOUTE VALIDATION DE PALIER : on doit pouvoir
  //   retirer une surcharge même si sa valeur est devenue invalide (porte
  //   renommée, ligne importée). Un nettoyage qui exige que la saleté soit
  //   bien formée ne nettoie pas le seul cas qui compte.
  if (jours === 0) {
    ouvrir().prepare('DELETE FROM portes_surcharge WHERE porte = ?').run(p);
    _cache = null;
    return { porte: p, retiree: true };
  }

  // ⚠️ `Number.isInteger` NE SUFFIT PAS À LUI SEUL, et c'est mesuré : `0` est
  //    ici une valeur SIGNIFIANTE (retirer), or `Number('')` vaut 0. Un champ
  //    laissé vide retirerait donc une surcharge en rendant un succès. La
  //    forme se valide chez l'appelant, AVANT la conversion ; ici on garde la
  //    borne, qui est la dernière ligne de défense.
  if (!Number.isInteger(jours) || jours < 1 || jours > JOURS_MAX) {
    throw new Error(`portes: durée refusée (${jours}) — un entier de 0 à ${JOURS_MAX}`);
  }
  if (!t) throw new Error('portes: aucun palier donné');

  const maintenant = Date.now();
  const jusqu_a = maintenant + jours * 86_400_000;
  ouvrir().prepare(
    'INSERT INTO portes_surcharge (porte, tier, jusqu_a, maj_le) VALUES (?,?,?,?) '
    + 'ON CONFLICT(porte) DO UPDATE SET tier=excluded.tier, jusqu_a=excluded.jusqu_a, maj_le=excluded.maj_le',
  ).run(p, t, jusqu_a, maintenant);
  // ⛔ ON VIDE LE CACHE, SINON LE GESTE N'A L'AIR DE RIEN FAIRE PENDANT 3 s —
  //    et trois secondes suffisent à recliquer, puis à conclure que ça ne
  //    marche pas.
  _cache = null;
  return { porte: p, tier: t, jusqu_a };
}

/**
 * L'état BRUT de toutes les lignes, expirées comprises — pour l'écran.
 * ⭐ « rien » et « ouvert jusqu'à avant-hier » sont deux états différents, et
 *   le second se relit avec profit. ⛔ Elle ne lève pas non plus : un écran
 *   qui tombe parce que la base est absente n'apprend rien à personne.
 */
export function etatBrut(maintenant = Date.now()) {
  try {
    return ouvrir()
      .prepare('SELECT porte, tier, jusqu_a, maj_le FROM portes_surcharge').all()
      .map((l) => ({
        porte: String(l.porte), tier: String(l.tier),
        jusqu_a: Number(l.jusqu_a), maj_le: Number(l.maj_le),
        active: Number(l.jusqu_a) > maintenant,
      }));
  } catch { return []; }
}

/** Réservée aux bancs : le cache est mémoïsé pour la durée du processus. */
export function _reinitialiser() { _cache = null; _cacheAt = 0; base = null; panne = null; }
