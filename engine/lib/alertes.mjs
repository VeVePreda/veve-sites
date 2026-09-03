// ⚠️ VeVePreda/veve-sites — engine/lib/alertes.mjs   (FICHIER NEUF — lot 215)
// ═══════════════════════════════════════════════════════════════════════════
// LES ALERTES — deux tables, et elles ne comptent PAS la même chose
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚖️ ARBITRAGES PREDA DU 03/09/2026, tranchés sur `maquette-lot215-alertes.html`
// (il tranche sur maquette). Ce fichier n'existe que parce que les quatre sont
// tombés — et le lot d'avant, écrit sans eux, était éprouvé ET à côté.
//
//   ① la ligne du feed est SOBRE : « est passé sous 40,00 $ », plus l'heure —
//      « mais l'heure doit être précise » ;
//   ② DEUX pages : `/alertes/` porte le feed, `/alertes/reglages/` les réglages ;
//   ③ on garde 30 JOURS : « veille bien à ce que ça ne prenne pas beaucoup de
//      place et que ça se nettoie » ;
//   ④ AUCUNE notification pour l'instant — le feed est tiré, jamais poussé.
//
// ⭐⭐⭐ CE QUE ① ET ③ FONT ENSEMBLE, ET C'EST LE POINT DE CONCEPTION DU LOT.
// Une ligne sobre n'affiche QUE le seuil — et le seuil, c'est la personne qui
// l'a tapé. ⇒ **`declenchements` NE PORTE AUCUN PRIX DE MARCHÉ.** Pas une
// colonne, pas un arrondi, rien. Le prix qui a franchi n'est pas stocké : il
// est reconstructible depuis la réserve, et le stocker créerait une seconde
// copie d'un montant réservé dans une base que personne ne surveille pour ça.
// ⛔ *Un champ qu'on range « au cas où » finit par s'afficher.* Le mur du lot
// 101 n'est donc pas seulement respecté ici : il n'est jamais approché.
// ⭐ Bénéfice non cherché : c'est aussi la table la plus petite possible, ce
// que ③ demandait explicitement.
//
// ⭐ MÊME FICHIER DE BASE QUE `favoris.mjs`, `prefs.mjs` ET `portes_surcharge.mjs`,
// et pour la même raison : `/data/veve-favoris.db` est le SEUL fichier monté.
// ⛔ Une seconde base voudrait un second volume, donc un second oubli possible
// — et l'oubli de volume est la panne muette décrite en tête de `favoris.mjs`.
// ⛔ ET ON NE TOUCHE PAS `favoris.mjs` : il ouvre sa propre poignée, il expose
// déjà la sentinelle du volume, et deux modules qui se partagent une poignée
// se ferment l'un l'autre au premier `_reinitialiser()` de banc.

import { DatabaseSync } from 'node:sqlite';

const CHEMIN = () => process.env.DB_PATH || '/data/veve-favoris.db';

// ⭐⭐ OUVERTURE PARESSEUSE, ET C'EST OBLIGATOIRE — même raison, mot pour mot,
// que `favoris.mjs` : `astro build` importe ce module dès qu'il analyse
// `/api/alertes`, et l'ouvrir à l'import ouvrirait la base DANS L'ÉTAPE DE
// CONSTRUCTION, où `/data` n'existe pas et n'a rien à faire là.
// ⛔ ET CE MODULE NE CRÉE AUCUN DOSSIER. Créer `/data` est le travail du
// Dockerfile, d'un seul endroit. Un appel de création de dossier ici serait
// exécuté au build (le site static ÉVALUE les handlers pour figer leur sortie)
// et cuirait une base fantôme dans l'image — et le bac à sable ne le verrait
// pas, puisqu'il ne tourne pas en root et que la création y échoue en silence.
let base = null;
let panne = null;

function ouvrir() {
  if (base) return base;
  if (panne) throw panne;
  try {
    const d = new DatabaseSync(CHEMIN());
    d.exec('PRAGMA journal_mode = WAL');

    // ── ① LES CONFIGURATIONS — « 1 alerte » AU SENS DE PREDA ──────────────
    // ⭐ La clé est (compte, uuid) : UNE ligne = UNE pièce surveillée. C'est
    //   exactement ce que Preda appelle « une alerte » (confirmé le 02/09), et
    //   c'est donc ce que `alerts.caps` plafonne. ⛔ Compter les DÉCLENCHEMENTS
    //   ferait payer le plafond à quelqu'un qui n'a rien configuré de plus.
    // ⚠️ CONSÉQUENCE ASSUMÉE : un seul seuil par pièce et par compte. Poser un
    //   second seuil sur la même pièce REMPLACE le premier. C'est ce que la
    //   clé dit, et la page le dit aussi — sinon « 30 alertes » deviendrait un
    //   nombre que personne ne peut relier à ce qu'il voit.
    d.exec(`CREATE TABLE IF NOT EXISTS alertes (
      compte  TEXT    NOT NULL,
      uuid    TEXT    NOT NULL,
      chemin  TEXT    NOT NULL DEFAULT '',
      nom     TEXT    NOT NULL DEFAULT '',
      sens    TEXT    NOT NULL,
      seuil   REAL    NOT NULL,
      pose_le INTEGER NOT NULL,
      vu_ts   INTEGER NOT NULL,
      arme    INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (compte, uuid)
    )`);

    // ── ② LE JOURNAL DES DÉCLENCHEMENTS — CE QUE LE FEED MONTRE ───────────
    // ⭐⭐ `quand` EST EN SECONDES, ET C'EST L'HORODATAGE DU RELEVÉ, PAS CELUI
    //   DU BUILD NI CELUI DE L'ÉCRITURE. C'est toute la demande ① de Preda.
    //   La réserve (`.reserve/historique/<uuid>.json`) porte l'historique
    //   complet en points `[ts, floor, listings]` triés ; `journal.mjs` y lit
    //   l'heure exacte du point qui a franchi. ⛔ Horodater à l'instant de
    //   l'écriture daterait le franchissement du moment où on s'en est aperçu
    //   — c'est-à-dire du déploiement, à quelques heures près, et personne ne
    //   verrait la différence sur la page.
    // ⭐ La clé (compte, uuid, quand) rend le producteur IDEMPOTENT : rejouer
    //   un balayage n'insère pas deux fois le même franchissement.
    // ⛔ AUCUNE COLONNE DE PRIX — voir l'en-tête. `seuil` est une valeur que la
    //   personne a tapée elle-même ; ce n'est pas un montant du marché.
    d.exec(`CREATE TABLE IF NOT EXISTS declenchements (
      compte TEXT    NOT NULL,
      uuid   TEXT    NOT NULL,
      quand  INTEGER NOT NULL,
      sens   TEXT    NOT NULL,
      seuil  REAL    NOT NULL,
      PRIMARY KEY (compte, uuid, quand)
    )`);
    // ⭐ L'index sert LA question du feed (« mes déclenchements, du plus récent
    //   au plus ancien ») et celle de la purge (« tout ce qui est plus vieux
    //   que »). Une seule structure pour les deux lectures qui existent.
    d.exec('CREATE INDEX IF NOT EXISTS idx_decl_compte_quand ON declenchements (compte, quand DESC)');

    // ── ③ LE TÉMOIN DU BALAYAGE ───────────────────────────────────────────
    // ⭐⭐⭐ POURQUOI UNE TABLE POUR UNE SEULE LIGNE : la réserve est FIGÉE AU
    //   BUILD. Balayer deux fois entre deux déploiements ne peut RIEN trouver
    //   de neuf — les points n'ont pas bougé. Ce témoin retient quel build a
    //   déjà été dépouillé, et c'est ce qui rend le producteur gratuit à
    //   l'appel.
    //   ⛔ Un compteur de temps (« pas plus d'une fois par heure ») aurait été
    //   un réglage arbitraire ; le build, lui, est la vraie unité de
    //   changement de la donnée. *On cadence sur ce qui change, pas sur
    //   l'horloge.*
    d.exec(`CREATE TABLE IF NOT EXISTS alertes_etat (
      cle    TEXT PRIMARY KEY,
      valeur TEXT NOT NULL
    )`);

    base = d;
    return base;
  } catch (e) {
    panne = e;
    throw e;
  }
}

// ⛔ ON VALIDE LA FORME, PAS LE CONTENU — même liste blanche que `favoris.mjs`
// et `reserve.mjs`. Une liste blanche ne se contourne pas ; une liste noire, si.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const coupe = (v, n) => String(v ?? '').slice(0, n);

/** Les deux seuls sens qui existent. ⛔ Une chaîne libre en base finirait par
 *  contenir un troisième sens que le producteur ne saurait pas lire — et il se
 *  tairait, ce qui est le pire des trois. */
export const SENS = ['sous', 'sur'];

/**
 * ⭐ LA DURÉE DE CONSERVATION — ARBITRAGE ③ DE PREDA, 03/09/2026 : 30 JOURS.
 * ⛔ ELLE EST ICI, EN UN SEUL ENDROIT, ET LE BANC LA LIT PLUTÔT QUE DE LA
 *    RECOPIER. Deux définitions d'une durée finissent toujours par diverger, et
 *    celle qui perd est celle qui efface des données.
 */
export const RETENTION_JOURS = 30;
const RETENTION_S = RETENTION_JOURS * 86_400;

// ═══════════════════════════════════════════════════════════════════════════
// LA PURGE — ⭐⭐⭐ C'EST ELLE LA FONCTIONNALITÉ, PAS LES 30 JOURS
// ═══════════════════════════════════════════════════════════════════════════
// Preda n'a pas demandé « 30 jours », il a demandé « que ça ne prenne pas
// beaucoup de place et que ça se nettoie ». 30 est le RÉGLAGE de ce qu'il a
// demandé ; le nettoyage en est le sujet.
//
// ⛔⛔ ELLE NE SE DÉCLENCHE PAS SOUS UN SEUIL DE TAILLE. « Purger quand la
// table dépasse N lignes » est un garde-fou qui n'existe pas tant que N n'est
// pas atteint : il ne peut ni être mesuré, ni rougir, et le jour où il compte
// est le jour où personne ne le regarde. On purge À CHAQUE BALAYAGE et à
// chaque lecture du feed — c'est-à-dire au battement du système, pas au
// franchissement d'un seuil.
// ⭐ Coût réel : un effacement sur un index déjà trié par `quand`. Sur une
// table qui ne peut pas dépasser quelques milliers de lignes (30 jours × le
// nombre de comptes × leurs configurations), c'est du bruit.
export function purger(maintenantS = Math.floor(Date.now() / 1000)) {
  const d = ouvrir();
  const limite = Math.floor(maintenantS) - RETENTION_S;
  const r = d.prepare('DELETE FROM declenchements WHERE quand < ?').run(limite);
  return { effaces: Number(r.changes || 0), limite };
}

// ═══════════════════════════════════════════════════════════════════════════
// LES CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Les configurations d'un compte, la plus récemment posée en premier. */
export function lireAlertes(compte) {
  const d = ouvrir();
  return d.prepare(
    `SELECT uuid, chemin, nom, sens, seuil, pose_le, vu_ts, arme
       FROM alertes WHERE compte = ? ORDER BY pose_le DESC`,
  ).all(String(compte)).map((l) => ({ ...l, arme: Boolean(l.arme) }));
}

/** Combien de pièces ce compte surveille. ⭐ C'est CE nombre que le plafond du
 *  manifeste borne — voir l'en-tête de la table `alertes`. */
export function compterAlertes(compte) {
  return ouvrir().prepare('SELECT COUNT(*) AS n FROM alertes WHERE compte = ?')
    .get(String(compte)).n;
}

/**
 * Pose ou remplace une surveillance.
 *
 * 🔴🔴🔴 `etatCourant` N'EST PAS UN CONFORT, C'EST CE QUI FAIT LA DIFFÉRENCE
 * ENTRE UN FRANCHISSEMENT ET UN NIVEAU. Poser « sous 40 $ » sur une pièce qui
 * vaut DÉJÀ 37 $ doit démarrer **désarmé** : sinon le premier balayage
 * déclencherait sur un prix qui n'a rien franchi du tout, et la personne
 * recevrait une alerte pour une information qu'elle avait sous les yeux en
 * posant le seuil. ⭐ C'est la faute la plus facile à écrire et la plus dure à
 * voir : elle produit un déclenchement PLAUSIBLE.
 *
 * ⚠️ `etatCourant` peut être `null` — la réserve d'une pièce peut manquer
 * (`RESERVE_OFF=1`, item non publié). On part alors ARMÉ et on ancre `vu_ts` à
 * maintenant : on ne rejoue pas le passé, et on ne prétend pas connaître un
 * état qu'on n'a pas lu. ⛔ Ancrer `vu_ts` à zéro rejouerait l'historique
 * entier et remplirait le feed de franchissements vieux de six mois, le jour
 * de l'installation.
 *
 * @param {object|null} etatCourant `{ ts, floor }` — dernier point de la réserve.
 */
export function poserAlerte(compte, { uuid, chemin, nom, sens, seuil }, etatCourant = null,
                            plafond = Infinity) {
  if (!UUID.test(String(uuid || ''))) return { ok: false, raison: 'uuid' };
  if (!SENS.includes(String(sens))) return { ok: false, raison: 'sens' };
  const s = Number(seuil);
  // ⛔ Une chaîne vide convertie en nombre vaut zéro, et zéro est un seuil
  //    parfaitement valide en apparence. On refuse donc le non-fini ET le
  //    négatif ET le zéro : un plancher ne descend pas sous zéro, et « sous
  //    0 $ » est une alerte qui ne se déclenchera jamais — c'est-à-dire une
  //    alerte qui ment par le silence.
  if (!Number.isFinite(s) || s <= 0) return { ok: false, raison: 'seuil' };

  const d = ouvrir();
  const deja = d.prepare('SELECT 1 FROM alertes WHERE compte = ? AND uuid = ?')
    .get(String(compte), String(uuid));
  // ⛔ On vérifie l'existence AVANT de refuser au plafond — même raison que
  //    `favoris.mjs` : modifier le seuil d'une pièce déjà surveillée n'ajoute
  //    aucune ligne, et échouer là serait incompréhensible.
  if (!deja && compterAlertes(compte) >= plafond) return { ok: false, raison: 'plafond' };

  const nowS = Math.floor(Date.now() / 1000);
  const vuTs = etatCourant && Number.isFinite(Number(etatCourant.ts))
    ? Math.floor(Number(etatCourant.ts)) : nowS;
  // ⭐ « La condition est-elle DÉJÀ vraie ? » — si oui, on démarre désarmé.
  const dejaVrai = etatCourant && Number.isFinite(Number(etatCourant.floor))
    ? franchi(sens, Number(etatCourant.floor), s) : false;

  d.prepare(`INSERT INTO alertes (compte, uuid, chemin, nom, sens, seuil, pose_le, vu_ts, arme)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(compte, uuid) DO UPDATE SET
               chemin = excluded.chemin, nom = excluded.nom, sens = excluded.sens,
               seuil = excluded.seuil, pose_le = excluded.pose_le,
               vu_ts = excluded.vu_ts, arme = excluded.arme`)
    .run(String(compte), String(uuid), coupe(chemin, 300), coupe(nom, 200),
         String(sens), s, Date.now(), vuTs, dejaVrai ? 0 : 1);
  return { ok: true };
}

/**
 * Retire une surveillance — ET SES DÉCLENCHEMENTS.
 *
 * ⭐⭐ POURQUOI LES DEUX ENSEMBLE, ET C'EST UN CHOIX, PAS UNE FACILITÉ. Le feed
 * affiche le NOM de la pièce, et ce nom vit dans `alertes` — une seule fois,
 * pour ne pas avoir deux définitions du même libellé. Garder des
 * déclenchements orphelins produirait donc des lignes sans nom, c'est-à-dire
 * des lignes illisibles, dans la page dont c'est le seul sujet.
 * ⛔ L'alternative — recopier le nom dans chaque déclenchement — ferait
 * diverger les deux copies au premier renommage de pièce.
 * ⚠️ CE QUE ÇA COÛTE, ET IL FAUT LE DIRE : retirer une surveillance efface son
 * historique de franchissements. C'est une suppression demandée par la
 * personne sur sa propre donnée, et la page le dit avant de la faire.
 */
export function retirerAlerte(compte, uuid) {
  if (!UUID.test(String(uuid || ''))) return { ok: false, raison: 'uuid' };
  const d = ouvrir();
  d.prepare('DELETE FROM declenchements WHERE compte = ? AND uuid = ?').run(String(compte), String(uuid));
  d.prepare('DELETE FROM alertes WHERE compte = ? AND uuid = ?').run(String(compte), String(uuid));
  // ⭐ Retirer ce qui n'est pas là est un SUCCÈS : deux onglets peuvent l'avoir
  //   déjà fait, et une erreur ferait croire à une panne.
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// LE FRANCHISSEMENT
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⭐⭐⭐ LA SEULE DÉFINITION DE « LA CONDITION EST VRAIE », ET ELLE EST ICI.
 * `poserAlerte` s'en sert pour décider de l'armement initial, `journal.mjs`
 * pour détecter et pour réarmer. Trois appelants, une définition — sinon
 * l'armement et la détection divergent d'une comparaison stricte contre une
 * comparaison large, et l'écart ne se voit que sur une pièce dont le plancher
 * vaut exactement le seuil.
 */
export function franchi(sens, floor, seuil) {
  if (!Number.isFinite(floor) || !Number.isFinite(seuil)) return false;
  return sens === 'sous' ? floor <= seuil : floor >= seuil;
}

/** Enregistre un franchissement. ⭐ Idempotent par la clé primaire. */
export function poserDeclenchement(compte, uuid, quandS, sens, seuil) {
  ouvrir().prepare(
    `INSERT INTO declenchements (compte, uuid, quand, sens, seuil) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(compte, uuid, quand) DO NOTHING`,
  ).run(String(compte), String(uuid), Math.floor(quandS), String(sens), Number(seuil));
}

/** Met à jour ce que le producteur a vu, pour ne pas relire deux fois. */
export function marquerVu(compte, uuid, vuTs, arme) {
  ouvrir().prepare('UPDATE alertes SET vu_ts = ?, arme = ? WHERE compte = ? AND uuid = ?')
    .run(Math.floor(vuTs), arme ? 1 : 0, String(compte), String(uuid));
}

/** Toutes les configurations, tous comptes confondus — pour le producteur.
 *  ⭐ Triées par uuid pour que la réserve d'une pièce se lise UNE fois, même
 *  si douze comptes la surveillent. */
export function toutesLesAlertes() {
  return ouvrir().prepare(
    'SELECT compte, uuid, sens, seuil, vu_ts, arme FROM alertes ORDER BY uuid',
  ).all().map((l) => ({ ...l, arme: Boolean(l.arme) }));
}

// ═══════════════════════════════════════════════════════════════════════════
// LE FEED
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Les déclenchements d'un compte, le plus récent en tête, joints à la
 * configuration qui les porte (pour le nom et le chemin).
 *
 * ⛔ LA JOINTURE EST STRICTE, ET C'EST VOULU : une ligne sans configuration est
 * une ligne sans nom, donc illisible — et `retirerAlerte()` garantit qu'il n'y
 * en a pas. La jointure est la CEINTURE de cette garantie, pas une seconde
 * règle.
 */
export function lireFeed(compte, limite = 200) {
  const d = ouvrir();
  const n = Math.max(1, Math.min(1000, Number(limite) || 200));
  return d.prepare(
    `SELECT d.uuid, d.quand, d.sens, d.seuil, a.chemin, a.nom
       FROM declenchements d
       JOIN alertes a ON a.compte = d.compte AND a.uuid = d.uuid
      WHERE d.compte = ?
      ORDER BY d.quand DESC
      LIMIT ?`,
  ).all(String(compte), n);
}

/** Le témoin de balayage — quel build a déjà été dépouillé. */
export function lireEtat(cle) {
  const l = ouvrir().prepare('SELECT valeur FROM alertes_etat WHERE cle = ?').get(String(cle));
  return l ? l.valeur : null;
}

export function ecrireEtat(cle, valeur) {
  ouvrir().prepare(
    `INSERT INTO alertes_etat (cle, valeur) VALUES (?, ?)
     ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`,
  ).run(String(cle), String(valeur));
}

/**
 * ⭐ LA SONDE — même famille que `etatDuStockage()` de `favoris.mjs`, et pour
 * la même raison : sans volume monté, tout marche jusqu'au déploiement suivant,
 * où les alertes de tout le monde disparaissent sans une erreur.
 * ⛔ ELLE NE REND QUE DES COMPTES, JAMAIS UN MONTANT — `/api/sante` est une
 * route PUBLIQUE, et un chiffre qui sort par là ne se rattrape pas. ⚠️ Les
 * seuils, eux, sont des montants : ils ne sortent JAMAIS d'ici.
 * ⛔ `ouverte: false` porte sa cause, et `null` sur les comptes veut dire
 * INDÉCIDABLE — un zéro inventé se lirait « personne n'a d'alerte », ce qui est
 * exactement l'inverse de « je n'ai pas pu lire ».
 */
export function etatDesAlertes() {
  try {
    const d = ouvrir();
    return {
      ouverte: true,
      configurations: d.prepare('SELECT COUNT(*) AS n FROM alertes').get().n,
      declenchements: d.prepare('SELECT COUNT(*) AS n FROM declenchements').get().n,
      retentionJours: RETENTION_JOURS,
      balaye: lireEtat('balaye_build'),
    };
  } catch (e) {
    return {
      ouverte: false,
      configurations: null,
      declenchements: null,
      retentionJours: RETENTION_JOURS,
      balaye: null,
      cause: String((e && e.message) || e),
    };
  }
}

// ⭐ POUR LE BANC UNIQUEMENT — remet le module à zéro entre deux bases.
// ⛔ Aucune route ne l'appelle : refermer la base en production, c'est rouvrir
//    un fichier à chaque requête.
export function _reinitialiser() {
  try { base?.close(); } catch { /* déjà fermée */ }
  base = null; panne = null;
}
