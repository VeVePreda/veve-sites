// ⚠️ VeVePreda/veve-sites — engine/lib/vignette.mjs   (FICHIER NEUF — lot 139)
// ═══════════════════════════════════════════════════════════════════════════
//  LA VIGNETTE — CE QU'UNE TUILE MONTRE, DÉCLARÉ UNE FOIS
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 POURQUOI CE FICHIER EXISTE — MESURÉ EN PRODUCTION LE 11/08/2026.
// Trois gabarits rendent une liste de pièces, et ils divergent :
//
//   page            gabarit      ATL/ATH   mention d'édition
//   ────────────────────────────────────────────────────────
//   accueil         Carte           8/8    3/8   (`ed` passé)
//   /collections/   Carte          12/12   0/12  (`ed` PAS passé)
//   /collectibles/  Rayon           0/20   15/20
//   /comics/        Rayon           0/20   0/20
//   /sets/          CarteSet        0/910  0/910
//
// ⭐⭐ « Je ne vois pas l'ATL/ATH sur les tuiles » n'est donc pas un défaut
// d'affichage : c'est un gabarit qui ne les émet nulle part. Et la mention
// d'édition ne tenait qu'à UNE ligne du dépôt — `Home.astro:391`, seul appel
// qui passait `ed`. ⛔ Ma note de tri disait « /collections/ : ed présent » :
// le `<span>` est là, il est VIDE. *Douzième note démentie par la mesure.*
//
// 🔴 QUATRIÈME OCCURRENCE de « deux gabarits qui rendent la même liste
// divergent » (lots 127, 131, 132). ⇒ On ne recopie pas le balisage d'un
// gabarit dans l'autre — ce serait deux copies au lieu d'une divergence, la
// même faute avec un lot de retard. Ce fichier déclare LES RÈGLES ; les trois
// gabarits les lisent.
//
// ⛔ CE FICHIER NE TOUCHE JAMAIS UN PRIX. Il ne connaît que du TEXTE. Les
// extrêmes passent par `<Extremes>` → `<Cote>`, gaté, jamais par la donnée :
// `ds.rayon` est une liste BLANCHE (`floor`, `listings`, `ath`, `atl` en sont
// retirés exprès) et l'y remettre publierait 19 412 prix par un chemin que
// `projeter()` ne voit pas. `test:rayon` §① tient cette liste.
import { clen, couperMots } from './seo.mjs';
import { nu } from './i18n.mjs';

// ═══════════════════════════════════════════════════════════════════════════
// LES BUDGETS — décidés par Preda le 11/08, écrits ici et nulle part ailleurs
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ « Nom d'item : 20 caractères puis “…” · nom de série : 13 » (Preda).
// ⭐⭐ ET LA CARTE DE SET A SON PROPRE BUDGET, PARCE QUE LA MESURE L'A IMPOSÉ :
// 585 des 910 noms de set dépassent 20 caractères (le plus long en fait 89).
// Coupé à 20, « Disney100 Platinum Moments Walt Disney Animation Studios… »
// devient « Disney100 Platinum… » — et 585 cartes cessent de se distinguer
// les unes des autres. Le nom EST le seul contenu d'une carte de set : c'est
// un titre, pas un sous-titre. ⇒ 30. Arbitrage Preda du 11/08.
// ⛔ Ces trois nombres ne se recopient nulle part ailleurs : `test:rayon` §④
// les IMPORTE d'ici. Un seuil déclaré deux fois diverge au premier lot.
// ⭐ LOT 158 — `avenir` EST UN AJOUT, PAS UNE RETOUCHE. Aucun des trois
// budgets ci-dessus ne bouge : `test:affichage` les importe et les mesure sur
// `dist/`, un seul chiffre déplacé ferait rougir un banc qui n'a rien à voir
// avec ce lot. ⭐⭐ 46 n'est pas un chiffre rond : la carte « à venir » passe
// d'une pilule d'une ligne à une bande de 104 px dont le bloc de texte fait
// ~220 px de large, soit ~28 caractères par ligne sur deux lignes. 46 tient
// dans deux lignes avec sa marge, 56 déborderait. ⛔ Le budget suit la BOÎTE
// qui l'accueille — il se recalcule si la carte change de forme, il ne
// s'hérite pas d'une autre carte.
export const BUDGETS = {
  item: 20,   // le nom d'une pièce, sur une tuile comme sur une ligne
  serie: 13,  // le nom de série, toujours en sous-titre
  set: 30,    // le titre d'une carte de set — seul contenu de la carte
  avenir: 46, // le titre d'un drop annoncé — deux lignes dans la bande
};

// ═══════════════════════════════════════════════════════════════════════════
// LA COUPE — et pourquoi elle ne fait pas `.slice()`
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 DEUX PIÈGES, LES DEUX DÉJÀ PAYÉS PAR CE DÉPÔT, ET AUCUN NE PLANTE.
//
// ① `.slice()` COUPE AU MILIEU D'UN MOT. C'est P29, mesuré au lot 134 sur
//    vevewiki : « …unter der Lizenz Call Of Cthulhu veröffentlich ». Les
//    descriptions faisaient exactement 160, donc elles PASSAIENT le banc de
//    longueur — ce n'était pas un défaut de longueur, c'était une coupe dure
//    là où il fallait `couperMots()`.
//
// ② `.length` COMPTE LE TAMPON, PAS LE TEXTE. Sous `I18N_MARQUAGE=1` — que
//    le Dockerfile de production pose — une chaîne porte des sentinelles
//    invisibles ET le nom de sa clé. Un titre de 45 caractères visibles en
//    déclarait 61 au lot 134, franchissait le budget et se faisait couper :
//    trois pages de set rendaient le MÊME titre. ⭐⭐ Et la coupe tombait au
//    milieu d'un marqueur, laissant un orphelin qui a supprimé 64 `<head>`.
//    ⇒ `clen(nu(...))` avant toute mesure, `couperMots(nu(...))` avant toute
//    coupe. C'est la loi de la maison, on ne la réécrit pas ici.
//
// ⭐ ON REND UN COUPLE `{ vu, complet }`, ET C'EST DÉLIBÉRÉ. Le gabarit écrit
// le texte coupé et pose le complet en `title` : un nom tronqué sans moyen de
// lire l'entier est une perte d'information, pas une mise en forme. ⛔ Et le
// `title` porte le nom NU : servir des sentinelles à un attribut les rendrait
// visibles en infobulle.
export function coupe(texte, budget) {
  const complet = nu(texte);
  if (!complet) return { vu: '', complet: '', tronque: false };
  if (clen(complet) <= budget) return { vu: complet, complet, tronque: false };
  // ⚠️ `couperMots` pose déjà l'ellipse — ⛔ ne pas en ajouter une seconde.
  return { vu: couperMots(complet, budget), complet, tronque: true };
}

// ⭐ Les trois raccourcis nommés : le gabarit dit CE QU'IL COUPE, pas COMBIEN.
// Un `coupe(x, 20)` écrit dans quatre fichiers redevient quatre seuils.
export const nomItem = (s) => coupe(s, BUDGETS.item);
export const nomSerie = (s) => coupe(s, BUDGETS.serie);
export const nomSet = (s) => coupe(s, BUDGETS.set);
export const nomAvenir = (s) => coupe(s, BUDGETS.avenir);

// ═══════════════════════════════════════════════════════════════════════════
// LA PILE D'UNE CARTE DE SET — DÉCLARÉE ICI PARCE QUE DEUX FABRIQUES LA LISENT
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 155-B — ELLE VIVAIT DANS `CarteSet.astro`, ET ELLE NE POUVAIT PLUS
// Y RESTER. `/sets/` ne rend plus ses 3 113 cartes : il en rend 60, et le pilote
// peint le reste depuis `/rayon-index/sets.json`. Deux fabriques doivent donc
// choisir LES MÊMES vignettes dans le MÊME ordre — et « choisir les premières
// qui ont une image, puis compléter avec celles qui n'en ont pas » est
// exactement le genre de règle qu'on recopie de travers.
// ⇒ `pileSet()` est la seule qui choisisse. `CarteSet.astro` l'appelle pour
// rendre, `rayon_index.mjs` l'appelle pour déposer. Elles ne peuvent pas
// diverger : il n'y a plus qu'un choix.
// ⭐ C'est la leçon des lots 127/131/132 appliquée AVANT la divergence, pas
// après — et c'est la même que celle des dictionnaires de `rayon_index.mjs` :
// *quand deux fabriques doivent montrer la même chose, on transporte le
// RÉSULTAT, pas la recette.*
//
// ⚠️ LE COMMENTAIRE D'ORIGINE VAUT TOUJOURS, ET IL EST LA RAISON DU `filter` :
// 6 609 comics n'ont pas d'`image_url` (`ARCHIVE_HEADER` jette 14 champs sur
// 25). `col.items` arrive trié par plancher DÉCROISSANT (`dataset.mjs`, lot
// 101) : un set dont les trois pièces les plus chères sont des variantes rares
// non illustrées rendrait trois hexagones gris alors que la donnée est là, deux
// rangs plus bas. *Prendre le premier élément d'une liste triée, c'est hériter
// de son critère de tri sans le vouloir.*
// ⛔ On complète avec des pièces SANS image pour garder l'ÉPAISSEUR de la pile,
// et un set d'une seule pièce rend une seule vignette — on ne fabrique pas de
// fausse épaisseur.
// ⛔ Et on ne re-trie PAS : sous la porte « cote », `floor` n'existe plus et un
// tri local trierait sur `undefined`.
export function pileSet(col, pile = 3) {
  const items = (col && col.items) || [];
  const avec = items.filter((i) => i.image).slice(0, pile);
  const sans = items.filter((i) => !i.image).slice(0, Math.max(0, pile - avec.length));
  return [...avec, ...sans];
}
