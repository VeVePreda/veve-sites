// ⚠️ VeVePreda/veve-sites — engine/lib/journal.mjs   (FICHIER NEUF — lot 215)
// ═══════════════════════════════════════════════════════════════════════════
// LE PRODUCTEUR — il DÉPOUILLE la réserve et écrit le journal des franchissements
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 IL S'APPELAIT `digest.mjs`, ET LE NOM EST MORT AVEC L'IDÉE.
// « Digest » était MON mot, pas une demande de Preda ; recopié de note en note
// jusqu'à devenir un fait, il a produit un lot éprouvé qui visait à côté.
// ⇒ Ce fichier ne poste rien, n'envoie rien, ne joint personne. Il ÉCRIT UN
// JOURNAL que la page `/alertes/` vient lire. *Une note qui nomme une solution
// fait sauter la question du besoin.*
//
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CE QU'IL LIT, ET POURQUOI C'EST LA BONNE SOURCE
// ═══════════════════════════════════════════════════════════════════════════
// `.reserve/historique/<uuid>.json` porte, pour chaque fiche publiée,
// l'historique COMPLET en points `[ts, floor, listings]` triés par `ts`, où
// `ts` est un EPOCH EN SECONDES — l'horodatage du relevé lui-même.
// (Format écrit par `reserve.mjs::fermer()`, servi tel quel par
// `/api/historique/[uuid]`, et copié dans l'image finale par le Dockerfile.)
//
// 🔑 C'EST CE QUI REND POSSIBLE LA DEMANDE ① DE PREDA — « l'heure doit être
// précise ». Je m'attendais à devoir répondre non : la réserve est figée au
// build, donc l'heure d'un franchissement aurait été celle du DÉPLOIEMENT, à
// quelques heures près. ⭐ C'est faux, et la mesure l'a dit : chaque point
// porte SA date. La ligne du feed peut donc dire « le 03/09 à 07:03 ».
//
// ⭐⭐⭐ ET LE MÊME CHOIX FERME UN TROU QUE PERSONNE N'AVAIT VU. Un producteur
// qui ne regarderait que le DERNIER point — le prix « courant » — raterait tout
// franchissement ouvert et refermé entre deux déploiements : un plancher qui
// plonge à 08 h et remonte à 11 h serait INVISIBLE, sans qu'aucune erreur ne le
// dise, sur un site parfaitement vert. On balaie donc TOUS les points depuis le
// dernier vu. *Lire une série au lieu d'un point ne coûte rien et change ce
// qu'on est capable de voir.*
//
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ POURQUOI IL NE TOURNE QU'UNE FOIS PAR BUILD
// ═══════════════════════════════════════════════════════════════════════════
// La réserve est ÉCRITE AU BUILD et ne bouge plus jusqu'au déploiement suivant.
// Rebalayer entre deux builds relit exactement les mêmes points et ne peut
// RIEN trouver de neuf. Le témoin `balaye_build` retient l'identifiant du build
// déjà dépouillé ; tout appel suivant sort immédiatement.
// ⛔ CE N'EST PAS UNE OPTIMISATION, C'EST LA CADENCE RÉELLE DE LA DONNÉE. Un
// battement horaire aurait donné l'illusion d'une fraîcheur qui n'existe pas.
// ⭐ Et c'est ce qui rend le feed honnête : une page qu'on consulte ne promet
// aucune fréquence, là où un courriel quotidien en promettait une.
//
// 🔴 QUI L'APPELLE : la page `/alertes/`, au moment où quelqu'un la regarde.
// ⛔ PAS `/api/sante` — elle est PUBLIQUE et interrogée par le lanceur à chaque
//    démarrage ; y accrocher un travail ferait dépendre le démarrage du
//    conteneur de l'état d'une base. Le lot 200 a déjà écrit que cette sonde
//    NE DOIT JAMAIS ATTENDRE.
// ⭐ Et c'est cohérent avec le produit : un feed est TIRÉ. Il n'a besoin d'être
//    à jour qu'au moment où on le lit.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESERVE_DIR, uuidValide } from './reserve.mjs';
import {
  toutesLesAlertes, franchi, poserDeclenchement, marquerVu, purger,
  lireEtat, ecrireEtat,
} from './alertes.mjs';

/**
 * La série d'une pièce, telle que la réserve l'a écrite.
 * @returns {Array<[number, number, number]>|null} `null` = ON NE SAIT PAS.
 *
 * ⛔ `null` ET `[]` NE SE CONFONDENT PAS, ET C'EST LA RÈGLE DE CE DÉPÔT.
 * Une réserve absente (`RESERVE_OFF=1`, pièce non publiée, fichier non copié)
 * n'est pas « cette pièce n'a jamais bougé ». Rendre `[]` ferait avancer
 * `vu_ts` sur du vide et ferait passer un balayage muet pour un balayage
 * complet.
 */
export function lireSerie(uuid) {
  if (!uuidValide(uuid)) return null;
  const f = join(RESERVE_DIR, `${uuid}.json`);
  if (!existsSync(f)) return null;
  try {
    const o = JSON.parse(readFileSync(f, 'utf8'));
    return Array.isArray(o && o.p) ? o.p : null;
  } catch {
    // ⚠️ Un fichier illisible est INDÉCIDABLE, pas vide. Même raison.
    return null;
  }
}

/**
 * Le dernier point connu d'une pièce — `{ ts, floor }` ou `null`.
 * ⭐ C'est ce que la route de pose passe à `poserAlerte()` pour décider de
 * l'armement initial : poser « sous 40 $ » sur une pièce déjà à 37 $ doit
 * démarrer DÉSARMÉ, sinon la première alerte porte sur un niveau, pas sur un
 * franchissement.
 */
export function dernierPoint(uuid) {
  const p = lireSerie(uuid);
  if (!p || !p.length) return null;
  const [ts, floor] = p[p.length - 1];
  if (!Number.isFinite(Number(ts))) return null;
  return { ts: Math.floor(Number(ts)), floor: Number(floor) };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE BALAYAGE
 * ═══════════════════════════════════════════════════════════════════════════
 * Pour chaque configuration, on rejoue les points APPARUS DEPUIS LE DERNIER VU,
 * dans l'ordre, et on applique la machine à deux états :
 *
 *   ARMÉE   + la condition devient vraie  →  DÉCLENCHEMENT, et on DÉSARME ;
 *   DÉSARMÉE + la condition redevient fausse → on RÉARME, en silence.
 *
 * ⭐⭐⭐ C'EST CE DÉSARMEMENT QUI FAIT LA DIFFÉRENCE ENTRE UN FRANCHISSEMENT ET
 * UN NIVEAU. Sans lui, une pièce restée sous son seuil pendant trois semaines
 * produirait un déclenchement à CHAQUE point — des centaines de lignes pour un
 * seul événement, et un feed que plus personne ne lit. ⛔ Et le réarmement, lui,
 * ne s'annonce jamais : « le prix est repassé au-dessus » n'est pas ce que la
 * personne a demandé à surveiller.
 *
 * @param {string} buildId  identité du build (`__BUILD_TIME__`). Deux appels
 *   sous le même identifiant ne travaillent qu'une fois.
 * @param {boolean} force   rejoue même si ce build a déjà été dépouillé.
 *   ⛔ Réservé aux bancs : en production, forcer relit les mêmes points.
 */
export function balayer({ buildId = null, force = false, maintenantS = null } = {}) {
  const now = Number.isFinite(Number(maintenantS))
    ? Math.floor(Number(maintenantS)) : Math.floor(Date.now() / 1000);
  const cle = String(buildId || 'inconnu');

  // ⭐ LA SORTIE COURTE. Elle dit `saute: true` plutôt que de mentir avec des
  //   zéros : « rien à faire » et « rien trouvé » sont deux verdicts, et les
  //   confondre rendrait un producteur mort indiscernable d'un producteur au
  //   repos. *C'est la même faute que « zéro parce que c'est cassé » contre
  //   « zéro parce qu'il n'y a rien ici ».*
  if (!force && buildId && lireEtat('balaye_build') === cle) {
    return { saute: true, raison: 'build deja depouille', build: cle,
             alertes: 0, uuids: 0, declenchements: 0, sansReserve: 0, effaces: 0 };
  }

  const toutes = toutesLesAlertes();
  // ⭐ Une seule lecture de fichier par PIÈCE, quel que soit le nombre de
  //   comptes qui la surveillent. `toutesLesAlertes()` trie déjà par uuid ;
  //   ce cache local ne garde donc qu'une série à la fois dans le cas
  //   ordinaire, et le tri est ce qui le rend borné.
  const series = new Map();
  let declenchements = 0;
  let sansReserve = 0;

  for (const a of toutes) {
    if (!series.has(a.uuid)) series.set(a.uuid, lireSerie(a.uuid));
    const points = series.get(a.uuid);
    if (!points) { sansReserve++; continue; }   // ⛔ INDÉCIDABLE : on ne touche pas `vu_ts`.

    let arme = a.arme;
    let vu = Number(a.vu_ts) || 0;
    let bouge = false;

    for (const pt of points) {
      const ts = Math.floor(Number(pt[0]));
      const floor = Number(pt[1]);
      if (!Number.isFinite(ts) || ts <= vu) continue;
      const cond = franchi(a.sens, floor, Number(a.seuil));
      if (arme && cond) {
        // 🔑 L'HEURE EXACTE DU RELEVÉ — pas celle du build, pas celle d'ici.
        poserDeclenchement(a.compte, a.uuid, ts, a.sens, a.seuil);
        declenchements++;
        arme = false;
      } else if (!arme && !cond) {
        arme = true;
      }
      vu = ts;
      bouge = true;
    }

    // ⛔ On n'écrit que si quelque chose a changé : une écriture par
    //    configuration et par visite ferait travailler le disque pour rien sur
    //    une base montée sur le volume du VPS.
    if (bouge || arme !== a.arme) marquerVu(a.compte, a.uuid, vu, arme);
  }

  // 🧹 LA PURGE TOURNE ICI, AU BATTEMENT, JAMAIS SOUS UN SEUIL DE TAILLE.
  //    Arbitrage ③ de Preda : « que ça ne prenne pas beaucoup de place et que
  //    ça se nettoie ». Un garde-fou qui n'agit qu'au-delà d'un seuil n'existe
  //    pas tant que le seuil n'est pas atteint — et le jour où il compte est le
  //    jour où personne ne le regarde.
  const { effaces } = purger(now);

  if (buildId) ecrireEtat('balaye_build', cle);

  return {
    saute: false, build: cle,
    alertes: toutes.length, uuids: series.size,
    declenchements, sansReserve, effaces,
  };
}
