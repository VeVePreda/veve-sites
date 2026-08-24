// ⚠️ VeVePreda/veve-sites — engine/lib/palier_vu.mjs  (FICHIER NEUF — lot 187)
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 « VOIR COMME » : REGARDER LE SITE AVEC LES YEUX D'UN AUTRE PALIER
// ═══════════════════════════════════════════════════════════════════════════
//
// Preda, 24/08/2026 : « donne moi la possibilité dans mon compte de switcher de
// palier pour vérifier que chaque abonné a bien accès à ce qu'il doit avoir. »
//
// ⛔⛔ CE MODULE FABRIQUE UNE ÉLÉVATION DE PRIVILÈGE. C'est sa raison d'être :
//    permettre à un administrateur de VOIR ce qu'un `whale` voit, sans être
//    `whale`. Tout le fichier existe pour que cette élévation soit BORNÉE,
//    INDIVIDUELLE, COURTE et VISIBLE. Les quatre, pas trois.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔑 LES CINQ PROPRIÉTÉS QUI RENDENT CE MODULE ACCEPTABLE
// ═══════════════════════════════════════════════════════════════════════════
//
// ① IL EST INDIVIDUEL, ET C'EST LA DIFFÉRENCE CAPITALE AVEC `portes_surcharge`.
//    Celui-là déplace une porte POUR TOUT LE MONDE — le commentaire de
//    `/compte/` le dit en gras. Un « voir comme » qui serait global ouvrirait
//    le site entier au premier visiteur venu pendant qu'un administrateur
//    vérifie une page. ⇒ la clé du magasin est LA SESSION, jamais le site.
//    ⭐⭐⭐ *Un réglage de vérification qui déborde sur les autres n'est plus
//      une vérification, c'est une fuite.*
//
// ② IL NE STOCKE JAMAIS LE `sid`, SEULEMENT SON EMPREINTE. Un identifiant de
//    session EST un jeton d'authentification : le poser en clair dans une base
//    de données, c'est offrir à qui la lit le droit de se faire passer pour ce
//    compte. On range un SHA-256, qui suffit à reconnaître et ne permet pas de
//    rejouer. ⛔ Ce n'est pas de la prudence décorative : `favoris.db` est
//      copiée par les sauvegardes du volume.
//
// ③ IL NE PEUT PAS ATTEINDRE LE BUILD, ET C'EST STRUCTUREL. Même argument
//    qu'au lot 164 : l'ouverture est PARESSEUSE et `/data` n'existe pas dans le
//    conteneur de build. En prime, le middleware sort AVANT sur une page
//    pré-générée (`isPrerendered`) : les ~8 500 pages ne connaissent même pas
//    ce module. ⭐ Ce n'est pas une précaution qu'on peut oublier de poser :
//    c'est la conséquence de l'endroit où vit le fichier.
//
// ④ LA FIN EST OBLIGATOIRE, ET ELLE EST COURTE. `portes_surcharge` plafonne à
//    30 JOURS parce qu'un réglage d'exploitation dure une campagne. Une
//    VÉRIFICATION dure quelques minutes : le plafond est ici de 120 MINUTES,
//    et il n'existe aucun chemin qui écrive sans échéance.
//    ⭐ Pourquoi si court, alors que c'est le même patron : une surcharge de
//      porte est VISIBLE dans `/compte/` (elle y est listée avec sa date) ;
//      un « voir comme » ne se voit que dans la page qu'on regarde. Ce qui se
//      voit moins doit s'éteindre plus vite.
//
// ⑤ IL NE LÈVE JAMAIS. Il est lu par le middleware, à chaque requête servie à
//    la demande : une exception y ferait tomber le site pour un réglage de
//    confort. En cas d'échec on rend `null`, c'est-à-dire LE PALIER RÉEL —
//    le comportement normal et le plus fermé des deux.
//    ⛔ ET CE N'EST PAS « ÉCHOUER OUVERT » : renoncer à voir comme un whale
//      rend le palier du compte, jamais l'inverse.
//
// ⚠️ CE MODULE NE CONNAÎT NI LES PALIERS NI LES PORTES, ET C'EST VOULU.
//    Importer `access.mjs` créerait un cycle (access → … → palier_vu →
//    access). Même partage des rôles que `prefs.mjs` et `portes_surcharge` :
//    « ici on borne la FORME, l'appelant borne le SENS ». C'est la route qui
//    refuse un palier inconnu, et le middleware qui refuse une session absente.
//
// ⭐ MÊME FICHIER DE BASE QUE `favoris.mjs`, `prefs.mjs` ET `portes_surcharge`,
//   ET MÊME RAISON : un second fichier serait un second volume à monter, à
//   sauvegarder et à oublier.

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

const CHEMIN = () => process.env.DB_PATH || '/data/veve-favoris.db';

/**
 * ⏱️ LE PLAFOND DE DURÉE. Voir ④ en tête de fichier : une vérification dure
 * des minutes. ⛔ NE PAS l'allonger « pour ne pas avoir à recommencer » —
 * c'est exactement la pente qui a transformé la démonstration du 01/08 en
 * fuite ouverte pendant cinq jours.
 */
export const MINUTES_MAX = 120;

/** ⭐ Le défaut proposé par la page. Assez pour vérifier, trop court pour oublier. */
export const MINUTES_DEFAUT = 30;

// ⚠️ CACHE COURT, POUR LA MÊME RAISON QU'AU LOT 164 : le middleware tourne à
//   CHAQUE requête servie à la demande. Sans lui, chaque page ferait une
//   lecture SQLite. 3 s : assez vif pour qu'un changement paraisse instantané,
//   assez long pour que le coût disparaisse.
// ⛔ LE CACHE EST INDEXÉ PAR EMPREINTE DE SESSION. Un cache global rendrait le
//   palier vu d'un administrateur à la session suivante, qui est une AUTRE
//   personne — la fuite que la propriété ① existe pour empêcher, réintroduite
//   par l'optimisation.
const CACHE_MS = 3000;
const _cache = new Map();     // empreinte -> { valeur, at }

let base = null;
let panne = null;

function ouvrir() {
  if (base || panne) return base;
  try {
    base = new DatabaseSync(CHEMIN());
    base.exec(`CREATE TABLE IF NOT EXISTS palier_vu (
      sid_h    TEXT PRIMARY KEY,
      palier   TEXT NOT NULL,
      jusqu_a  INTEGER NOT NULL,
      pose_le  INTEGER NOT NULL
    )`);
  } catch (e) {
    // ⭐ ON LE DIT UNE FOIS, PAS À CHAQUE REQUÊTE. Un journal qui répète la
    //   même ligne mille fois par minute enterre tout le reste — et c'est
    //   comme ça qu'on cesse de le lire.
    panne = e;
    console.warn(`[palier-vu] base indisponible (${e.message}) — le palier réel s'applique.`);
  }
  return base;
}

/**
 * L'empreinte d'une session. ⛔ JAMAIS le `sid` lui-même — voir ② en tête.
 * ⚠️ Rend '' sur une entrée vide : un appelant qui oublierait de vérifier ne
 * doit pas se retrouver avec l'empreinte de la chaîne vide comme clé valide.
 */
export function empreinte(sid) {
  const s = String(sid || '').trim();
  if (!s) return '';
  return createHash('sha256').update(s).digest('hex');
}

/**
 * Le palier vu POUR CETTE SESSION, ou `null`.
 * @returns {{palier: string, jusqu_a: number}|null}
 */
export function lirePalierVu(sid, maintenant = Date.now()) {
  const h = empreinte(sid);
  if (!h) return null;
  const c = _cache.get(h);
  if (c && maintenant - c.at < CACHE_MS) return c.valeur;

  let valeur = null;
  try {
    const db = ouvrir();
    if (db) {
      const l = db.prepare('SELECT palier, jusqu_a FROM palier_vu WHERE sid_h = ?').get(h);
      // ⛔ L'EXPIRATION SE JUGE À LA LECTURE, PAS À L'ÉCRITURE. Une ligne
      //   périmée qu'on laisserait « pour la nettoyer plus tard » serait
      //   exactement l'élévation de privilège qu'on croit avoir bornée.
      if (l && Number(l.jusqu_a) > maintenant) {
        valeur = { palier: String(l.palier), jusqu_a: Number(l.jusqu_a) };
      }
    }
  } catch (e) {
    // ⑤ : on renonce à voir comme, on ne tombe pas. `valeur` reste `null`.
    console.warn(`[palier-vu] lecture impossible (${e.message}) — palier réel.`);
  }
  _cache.set(h, { valeur, at: maintenant });
  return valeur;
}

/**
 * Pose (ou retire, avec `minutes === 0`) le palier vu d'une session.
 * ⚠️ NE VALIDE PAS LE PALIER : ce module ne connaît pas la liste (cycle
 * d'import). L'appelant le fait — voir `src/pages/api/palier-vu.js`.
 * @throws si la base est indisponible : ÉCRIRE est le seul geste qui a le
 *   droit d'échouer bruyamment. Un réglage qu'on croit posé et qui ne l'est
 *   pas envoie chercher le défaut ailleurs pendant une heure (leçon du 164).
 */
export function poserPalierVu(sid, palier, minutes, maintenant = Date.now()) {
  const h = empreinte(sid);
  if (!h) throw new Error('[palier-vu] session absente');
  const db = ouvrir();
  if (!db) throw panne || new Error('[palier-vu] base indisponible');

  const m = Number(minutes);
  // ⛔ LA BORNE EST ICI AUSSI, PAS SEULEMENT DANS LA ROUTE. Un second appelant
  //   écrit un jour, et il n'aura pas relu la route. Deux gardes ne sont pas
  //   une duplication quand l'une protège un invariant de sécurité.
  if (!Number.isInteger(m) || m < 0 || m > MINUTES_MAX) {
    throw new Error(`[palier-vu] durée hors bornes : ${minutes} (0..${MINUTES_MAX})`);
  }
  if (m === 0) {
    db.prepare('DELETE FROM palier_vu WHERE sid_h = ?').run(h);
  } else {
    db.prepare(`INSERT INTO palier_vu (sid_h, palier, jusqu_a, pose_le) VALUES (?,?,?,?)
                ON CONFLICT(sid_h) DO UPDATE SET palier=excluded.palier,
                jusqu_a=excluded.jusqu_a, pose_le=excluded.pose_le`)
      .run(h, String(palier), maintenant + m * 60000, maintenant);
  }
  _cache.delete(h);
  // ⭐ MÉNAGE OPPORTUNISTE. Sans lui, la table garde une ligne par session
  //   ayant jamais vérifié quelque chose. ⚠️ Il ne conditionne RIEN : la
  //   lecture juge déjà l'expiration, ceci ne fait que rendre de la place.
  try { db.prepare('DELETE FROM palier_vu WHERE jusqu_a <= ?').run(maintenant); } catch { /* sans effet */ }
}

/**
 * Ce que `/compte/` affiche : l'état BRUT, expiration comprise.
 * ⭐ ON REND AUSSI CE QUI EST EXPIRÉ. N'afficher que ce qui est actif
 * cacherait précisément ce qu'on vient de faire — même choix qu'au lot 164
 * pour les surcharges de portes.
 */
export function etatVu(sid, maintenant = Date.now()) {
  const h = empreinte(sid);
  if (!h) return null;
  try {
    const db = ouvrir();
    if (!db) return null;
    const l = db.prepare('SELECT palier, jusqu_a FROM palier_vu WHERE sid_h = ?').get(h);
    if (!l) return null;
    return {
      palier: String(l.palier),
      jusqu_a: Number(l.jusqu_a),
      expire: Number(l.jusqu_a) <= maintenant,
    };
  } catch { return null; }
}

/** ⚠️ Bancs uniquement — remet le module à neuf entre deux cas. */
export function _reinitialiser() { _cache.clear(); base = null; panne = null; }
