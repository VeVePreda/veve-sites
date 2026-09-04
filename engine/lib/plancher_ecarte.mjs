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
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 223 — LE COMPTEUR D'OFFRES NE COMMANDE PLUS LE TEST DE LA MÉDIANE
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ MESURE DU 04/09 QUI A OUVERT CE LOT (« point 156 »). `/api/sante` rendait
// `ecartes: 47` sur `candidats: 75` : **28 pièces au plancher > 5 000 $ étaient
// servies**. La cause n'était pas un seuil trop haut, c'était l'ORDRE des tests.
// La version d'avant sortait sur `if (offres > seuils.offres) return false;`
// AVANT d'avoir regardé la médiane — donc trois annonces suffisaient à mettre
// une pièce hors de portée de la règle, définitivement.
//
// Mesuré sur l'entrepôt (pièces à ≥ 20 relevés, plancher > 5 000 $) :
//   · `offres <= 2` ⇒ la règle peut mordre .......... 962 pièces
//   · `offres > 2`  ⇒ JAMAIS EXAMINÉE ................ 87 pièces, jusqu'à 8 888 888 $
// Et ce que ces 87 sont, une fois NOMMÉES : `Omni` (Common) à **888 888 888 $**
// pour une médiane de **6,98 $** · `Star Wars: Ahsoka` à 9 999 999 $ sur **un
// seul relevé** · `Bring On The Bad Guys: Doom` à 150 000 000 $ contre 10 $.
// ⇒ *Ce ne sont pas des prix, ce sont des valeurs-sentinelles de vendeur. Trois
//   vendeurs qui posent le même chiffre absurde ne font pas un marché.*
//
// 🔑 LA DISTINCTION QUI STRUCTURE CETTE VERSION — et c'est elle, pas le seuil :
//   · `muet`   = « son passé ne peut PAS la défendre » (trop peu de relevés, ou
//                pas de médiane utilisable). Là, le compteur d'offres GARDE son
//                rôle de garde-fou : une pièce neuve et légitimement chère n'a
//                pas encore d'historique, et un carnet fourni est le seul indice
//                qu'il nous reste que le prix est porté par quelqu'un.
//   · `dement` = « son passé la CONTREDIT » (plancher > médiane × facteur). Ici
//                le nombre d'annonces n'apporte RIEN : 9 999 999 $ contre une
//                médiane de 44 $ est faux qu'il y ait 2 annonces ou 30.
// ⛔ NE PAS refusionner ces deux tests sous une même condition d'offres : c'est
//    exactement le défaut que ce lot corrige, et il a tenu 30 lots sans se voir
//    parce que le compteur global (`ecartes`) restait plausible.
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

  const mediane = Number(i.prixMedian);
  const releves = Number(i.totalPoints);
  const medianeUtilisable = Number.isFinite(mediane) && mediane > 0;

  // ⭐ « SON PASSÉ NE PEUT PAS LA DÉFENDRE » — le carnet d'offres reste le
  //   garde-fou, parce qu'il est la SEULE information qui reste quand
  //   l'historique est absent. ⛔ `offres === null` (compteur non renseigné)
  //   n'est PAS zéro : on ne sait pas, donc on ne condamne pas sur ce motif.
  const muet = (!(releves >= seuils.points) || !medianeUtilisable)
            && offres !== null && offres <= seuils.offres;

  // ⭐⭐ « SON PASSÉ LA CONTREDIT » — INCONDITIONNEL. C'est tout le lot 223.
  const dement = medianeUtilisable && floor > mediane * seuils.facteur;

  return muet || dement;
}
