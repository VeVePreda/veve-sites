// ⚠️ VeVePreda/veve-sites — engine/lib/plancher_ecarte.mjs   (FICHIER NEUF — lot 193)
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 193 — LA RÈGLE DU PLANCHER ÉCARTÉ, ÉCRITE **UNE SEULE FOIS**
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ ELLE VIT DANS SON PROPRE FICHIER ET PAS DANS `dataset.mjs`, POUR UNE RAISON QUI EST UNE
// LEÇON DE CE DOSSIER : enfouie dans `construireDataset()`, elle n'aurait été
// éprouvable qu'en construisant un dataset — c'est-à-dire en lisant l'entrepôt,
// c'est-à-dire JAMAIS hors ligne. Le banc se serait déclaré INDÉCIDABLE, se
// serait tu, et se serait réveillé dans le Dockerfile, au refus de déploiement.
// C'est exactement ce qui a coûté le déploiement du 25/08 au matin.
// ⇒ Une règle qu'on veut mesurer se sort de ce qu'on ne peut pas construire.
//
// `dataset.mjs` l'appelle au build pour poser `item.floorEcarte` ; le banc
// l'appelle avec six objets fabriqués à la main. Un seul juge, deux appelants.
//
// @param i       une fiche portant `floor`, `listings`, `totalPoints`, `prixMedian`
// @param seuils  { prix, offres, points, facteur } — tous requis, aucun deviné
export function planchierEcarte(i, seuils) {
  if (!i || !seuils) return false;
  // ⛔ `Number.isFinite` ET PAS UNE VÉRITÉ : `listings: 0` est une VRAIE valeur,
  //    et c'est même le cas le plus net — un plancher à sept chiffres que plus
  //    personne ne porte. Un `if (i.listings)` l'aurait laissé passer.
  const offres = Number.isFinite(Number(i.listings)) ? Number(i.listings) : null;
  const floor = Number(i.floor);
  if (!Number.isFinite(floor) || floor <= seuils.prix) return false;
  if (offres === null || offres > seuils.offres) return false;
  // ⭐ LES DEUX FAÇONS DONT LE PASSÉ D'UNE PIÈCE REFUSE DE LA DÉFENDRE.
  const mediane = Number(i.prixMedian);
  const releves = Number(i.totalPoints);
  const muet = !(releves >= seuils.points) || !Number.isFinite(mediane) || mediane <= 0;
  const dement = Number.isFinite(mediane) && mediane > 0 && floor > mediane * seuils.facteur;
  return muet || dement;
}
