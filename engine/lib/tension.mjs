// ⚠️ VeVePreda/veve-sites — engine/lib/tension.mjs   (FICHIER NEUF — lot 219)
// ═══════════════════════════════════════════════════════════════════════════
// LA TENSION DE L'OFFRE — une note calculée, SANS AUCUN PRIX.
// ═══════════════════════════════════════════════════════════════════════════
//
// 🎯 L'ARBITRAGE (Preda, 04/09) : « un score CALCULÉ, pas éditorial », colonne
// triable dans `/market/` ET note sur la fiche. Puis, la question posée avant
// d'écrire une ligne : « de quoi le score est-il fait ? » — réponse : **SANS
// PRIX**.
//
// ⭐⭐⭐ ET CE CHOIX EST CE QUI REND LA NOTE PUBLIABLE. Un score qui dépend du
// plancher est un champ de cote : il serait entré dans `CHAMPS_COTE`, et la
// « note sur la fiche » se serait affichée derrière un cadenas sur les 9 354
// fiches publiques — c'est-à-dire l'inverse de ce qui a été demandé. En le
// bâtissant sur des axes de CATALOGUE (tirage, circulation, brûlures), il vit
// en clair sur la fiche, il est du contenu que ni vevealpha ni my-nft-tracker
// n'ont, et `test:fuite` n'a rien à surveiller de plus.
// ⛔ NE JAMAIS y faire entrer `floor`, `floorStackr`, `prixMedian`, `ath`,
// `atl` ni une variation : ce serait rouvrir en une ligne les 9 354 pages que
// le lot 101 a fermées, et transformer une note publique en fuite.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔬 LA PREMIÈRE FORMULE ÉTAIT JUSTE ET NE CLASSAIT RIEN — MESURE DU 04/09
// ═══════════════════════════════════════════════════════════════════════════
// Version écrite d'abord : `50·épuisement + 30·rareté + 20·combustion`, chaque
// terme borné 0..1. Elle était défendable ligne à ligne. Mesurée sur les 19 650
// pièces réelles, elle donnait :
//     0-9 : 1,8 % · 10-19 : 5,8 % · **20-29 : 73,7 %** · 30-39 : 5,0 % · …
// ⭐⭐⭐ TROIS QUARTS DU CATALOGUE DANS DIX POINTS. Un score qui rend presque la
// même valeur pour presque toutes les pièces ne trie pas : c'est une colonne
// qui a l'air d'un classement. *Un instrument qui rend le même chiffre à toutes
// ses questions n'en pose qu'une.*
// La cause : les grandeurs sont ÉCRASÉES. `circulation/tirage` a une médiane de
// 0,017 (donc 50·E ≈ 0,85 pour la moitié du catalogue) et le tirage vaut 1 000
// pour la médiane ET le p10 — la composante « rareté » était quasi constante.
// Une moyenne pondérée de grandeurs écrasées reste écrasée, quels que soient
// les poids ; changer les poids n'aurait rien réparé, seulement déplacé le tas.
//
// ⇒ **ON NOTE PAR RANG, PAS PAR FORMULE LINÉAIRE.** L'étalement devient une
// propriété de construction — mesuré : 10,0 % par dizaine, de 0 à 100 — et la
// note se lit en français sans barème : « plus tendue que 87 % du catalogue ».
// ⛔ Et ce n'est PAS un artifice pour faire joli : le rang répond exactement à
// la question posée (« qu'est-ce qui compte, ici, comparé au reste ? »), là où
// une échelle absolue aurait demandé un référentiel que personne n'a.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE LA NOTE MESURE, ET CE QU'ELLE NE MESURE PAS
// ═══════════════════════════════════════════════════════════════════════════
// L'axe principal est **la part du tirage réellement en circulation**.
//   · 100 % en circulation = le tirage est sorti, plus rien à frapper ⇒ tendu ;
//   ·   0 % en circulation = la pièce n'a jamais trouvé preneur  ⇒ détendu.
// Départage, dans cet ordre : le tirage le plus PETIT d'abord (à épuisement
// égal, 1 exemplaire est plus tendu que 60 000), puis la part BRÛLÉE (une pièce
// détruite ne revient pas).
//
// 🔴 UNE QUATRIÈME COMPOSANTE A ÉTÉ ÉCARTÉE, ET C'EST UNE MESURE QUI L'A ÉCARTÉE :
// `annonces / circulation` — « l'offre est-elle retenue ? ». Distribution
// mesurée : p10 = 0,000 · **médiane = 0,000** · p90 = 0,006. Plus de la moitié
// du catalogue y porte la même valeur : elle ne sépare rien. ⛔ On ne garde pas
// un terme parce qu'il a du sens ; on le garde s'il DISCRIMINE.
//
// ⚠️ LA NOTE NE DIT PAS « BONNE AFFAIRE ». Elle ne connaît aucun prix — c'est sa
// définition. Elle dit « rare et sortie » ou « abondante et dormante ». Un
// lecteur qui y verrait un conseil d'achat lirait autre chose que ce qui est
// écrit ; le libellé affiché doit donc porter le mot « tension », jamais
// « valeur », « potentiel » ni « note » tout court.
// ⚠️ ET ELLE EST RELATIVE À UNE POPULATION ET À UNE DATE. Recalculée à chaque
// build sur le catalogue publié : un rang n'est pas une constante physique. La
// fiche l'affiche donc AVEC sa date, comme les figures de `/analytics/`.

/** ⛔ Le même refus du vide que `numRenseigne` (lot 218) : `Number('')` vaut 0,
 *  et un tirage vide deviendrait un tirage de zéro — donc une division par
 *  zéro, donc une note absente là où il fallait dire « je ne sais pas ». */
const num = (v) => {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Le couple (épuisement, départages) d'une pièce, ou `null` si elle n'est pas
 * mesurable. ⭐ EXPORTÉ POUR ÊTRE ÉPROUVÉ SEUL, sans dataset et sans DOM.
 */
export function ingredients(item) {
  const tirage = num(item.tirage);
  const circ = num(item.circulationStackr);
  // ⛔ Les deux sont exigés. Une pièce sans tirage connu n'a pas de « part du
  //    tirage en circulation » — elle n'est pas à 0, elle est hors mesure, et
  //    une note de 0 la ferait descendre en bas d'un classement qu'elle ne
  //    devrait pas rejoindre. *Une borne ne juge pas ce qu'elle ne connaît pas.*
  if (tirage === null || tirage <= 0 || circ === null) return null;
  const brulees = num(item.bruleesStackr);
  return {
    // ⛔ Borné à 1 : `in_circulation` peut dépasser un tirage annoncé périmé.
    //    Sans ce plafond, une donnée en retard produirait une note > 100.
    epuisement: Math.min(1, Math.max(0, circ / tirage)),
    tirage,
    partBrulee: brulees === null ? 0 : Math.min(1, brulees / tirage),
  };
}

/**
 * Pose `item.tension` (0 à 100) sur chaque pièce mesurable de la population.
 * ⭐ EN PLACE, et sur la POPULATION ENTIÈRE : un rang calculé sur une tranche
 * dirait « plus tendue que 87 % des 20 lignes affichées », ce qui ne veut rien
 * dire. Même règle que les facettes de `/market/`.
 * @returns {{notees:number, sansMesure:number}} — ⭐ il RÉPOND, même à zéro.
 */
export function poserTension(items) {
  const mesurables = [];
  let sansMesure = 0;
  for (const it of items) {
    const g = ingredients(it);
    if (!g) { sansMesure++; continue; }
    mesurables.push({ it, g });
  }
  // ⭐ L'ORDRE EST LE CLASSEMENT : épuisement croissant, puis tirage
  //   DÉCROISSANT (le plus gros tirage est le moins tendu, donc il vient en
  //   premier), puis part brûlée croissante.
  mesurables.sort((a, b) =>
    (a.g.epuisement - b.g.epuisement)
    || (b.g.tirage - a.g.tirage)
    || (a.g.partBrulee - b.g.partBrulee));

  const n = mesurables.length;
  for (let i = 0; i < n; i++) {
    // ⚠️ `n - 1` au dénominateur, et le cas `n === 1` traité : une population
    //    d'une seule pièce donnerait une division par zéro, donc `NaN`, donc
    //    une note qui s'affiche « NaN » sur la seule fiche du site. Ce cas
    //    arrive dans les bancs, jamais en production — et c'est exactement
    //    pour ça qu'il faut l'écrire ici plutôt que de compter dessus.
    mesurables[i].it.tension = n === 1 ? 50 : Math.round((100 * i) / (n - 1));
  }
  return { notees: n, sansMesure };
}
