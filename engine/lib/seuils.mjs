// ⚠️ VeVePreda/veve-sites — engine/lib/seuils.mjs   (FICHIER NEUF — lot 139)
// ═══════════════════════════════════════════════════════════════════════════
//  L'ÉCHELLE DE SEUILS DU RÉSEAU — DÉCLARÉE UNE FOIS, TENUE PAR UN CLIQUET
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 CE FICHIER NE DÉCIDE DE RIEN À L'ÉCRAN. Il ne pose aucune largeur, il
// ne remplace aucune `@media`. Il DÉCLARE la liste des largeurs auxquelles ce
// réseau a le droit de changer de mise en page, et `test:affichage` §3 sexies
// refuse toute `@media` qui n'y figure pas. C'est un CLIQUET, comme `SEUIL_JS`
// du lot 137 : il ne descend jamais tout seul.
//
// ⭐⭐⭐ POURQUOI UNE DÉCLARATION PLUTÔT QU'UNE RÉDUCTION.
// Preda a demandé « moins de seuils ». La demande est juste — quatorze points
// de bascule sur un même site, c'est quatorze mises en page à vérifier, et
// `test:affichage` §3 bis balaie déjà 30 largeurs pour cette seule raison.
// ⛔ Mais on ne réduit pas AVANT de déclarer. Aujourd'hui personne ne sait
// lequel des quatorze sert à quoi : les fusionner à l'aveugle, c'est casser
// une mise en page sans savoir laquelle. *Déclarer d'abord rend la réduction
// mesurable ; réduire d'abord la rend irréversible.*
// ⇒ ce lot POSE l'échelle et FERME la porte au quinzième. La réduction est un
// travail à part, et elle sera lisible : chaque ligne retirée d'ici devra
// disparaître des deux feuilles dans le même geste.
//
// ⭐⭐ UNE ÉCHELLE POUR LE RÉSEAU, PAS UNE PAR THÈME — ET C'EST UNE MESURE.
// Relevé le 11/08/2026 dans les préludes `@media` des feuilles servies :
//     vitrine       14 seuils : 420 520 560 580 600 640 700 760 820 840
//                               900 940 1000 1040
//     encyclopedie   3 seuils : 520 640 820   (dont 520 et 820, lot 139)
//     aurora         1 seuil  : 640
// Les quatre seuils des deux petits thèmes sont DÉJÀ dans les quatorze du
// grand. Une carte `{ theme: [...] }` aurait donc été une seconde liste à
// tenir à jour, pour n'exprimer aucune différence réelle — et le jour où
// `encyclopedie` gagne un seuil, on l'aurait ajouté LÀ plutôt que de se
// demander s'il existe ailleurs. *Ne pas demander à une liste ce que le
// résultat sait déjà.*
//
// ⛔⛔ CE QUE LE CLIQUET NE MESURE PAS, ET IL LE DIT.
// Il lit les `@media` de la feuille SERVIE (`feuilleTheme()`), pas les
// propriétés `max-width:` posées sur des boîtes — il y en a cinq dans
// `vitrine` (250, 280, 400, 470, 1220 px) et ce ne sont PAS des seuils : une
// largeur maximale de boîte ne fait basculer aucune mise en page. Les
// confondre ferait crier le banc sur du code parfaitement sain, et *un faux
// rouge se fait désarmer en trois jours.*
// ⛔ Il ne lit pas non plus les `@container`, les `@supports` ni les
// `clamp()` : aucun n'existe encore dans ce dépôt. Le jour où l'un apparaît,
// c'est ici qu'il faudra décider s'il entre dans l'échelle — pas dans le banc.

/** ⭐ LES QUATORZE LARGEURS, EN PIXELS, DANS L'ORDRE.
 *  ⚠️ RE-MESURÉES le 11/08/2026 au soir sur les feuilles avec le lot 139
 *  appliqué, et une quinzième fois le 12/08 avec les colonnes du pied : le
 *  compte n'a pas bougé, parce que 520 et 820 y étaient déjà.
 *  ⛔ Cette liste ne se complète pas « pour faire passer le banc ». Un seuil
 *  qu'on ajoute ici est un engagement à le vérifier aux 30 largeurs du §3 bis.
 *  Ajouter une ligne pour taire un rouge, c'est désarmer le cliquet — il n'y
 *  aurait alors plus de différence entre l'avoir et ne pas l'avoir. */
export const SEUILS = [420, 520, 560, 580, 600, 640, 700, 760, 820, 840, 900, 940, 1000, 1040];

/** ⭐⭐ LES DEUX BORNES DE CHAQUE SEUIL, ET C'EST TOUT LE SUJET.
 *  `max-width:640px` s'applique **à 640 et plus à 641** : un balayage de
 *  largeurs rondes (360, 768, 1024…) ne voit jamais la bascule. C'est
 *  exactement là que le trou du lot 68 s'ouvrait — le menu disparaissait entre
 *  641 px et 1040 px — et un intervalle ne se teste que par SES DEUX
 *  EXTRÉMITÉS.
 *  ⚠️ 360 et 1280 encadrent l'échelle : sans eux, on ne mesurerait jamais le
 *  téléphone étroit ni le grand écran, c'est-à-dire les deux régimes où AUCUNE
 *  `@media` de cette liste ne s'applique. */
export function largeursABalayer() {
  const l = new Set([360, 1280]);
  for (const s of SEUILS) { l.add(s); l.add(s + 1); }
  return [...l].sort((a, b) => a - b);
}

/** ⭐⭐⭐ UN SEUIL SE DIT DE DEUX CÔTÉS, ET LES DEUX SONT LE MÊME SEUIL.
 *  `@media (max-width:1040px)` et `@media (min-width:1041px)` décrivent la
 *  MÊME bascule, vue de chaque bord : les pixels sont entiers, donc le
 *  complément d'un `max` à N est un `min` à N+1. Refuser `1041` parce que la
 *  liste dit `1040` ferait rougir le banc sur du CSS parfaitement juste — et
 *  *un faux rouge se fait désarmer en trois jours*, ce qui coûterait le cliquet
 *  entier pour un pixel.
 *  ⚠️ CE N'EST PAS UNE PORTE OUVERTE À N'IMPORTE QUOI : `1042` reste refusé,
 *  `768` reste refusé. Et ça ne coûte AUCUNE couverture — `largeursABalayer()`
 *  visite déjà `s` ET `s+1` pour chaque seuil, donc les deux formulations sont
 *  vérifiées aux mêmes largeurs de toute façon.
 *  🔴 MESURÉ le 12/08/2026 : ce dépôt n'écrit **aucune** `@media (min-width)`
 *  aujourd'hui — les 18 seuils relevés sur les 3 thèmes sont tous des `max`.
 *  Cette tolérance ne sert donc encore à rien, et c'est exactement pour ça
 *  qu'elle est écrite maintenant : le jour où quelqu'un écrira le complément,
 *  il ne trouvera pas un banc rouge sans explication. */
export function estSeuilDeclare(px) {
  return SEUILS.includes(px) || SEUILS.includes(px - 1);
}

/** Les largeurs des `@media (min|max-width: …px)` réellement présentes dans un
 *  texte CSS, dédupliquées et triées.
 *  ⛔ NE LIT QUE LES PRÉLUDES `@media`. Un `max-width:1220px` posé sur `.wrap`
 *  est une largeur de boîte, pas un seuil — cf. l'en-tête de ce fichier. */
export function seuilsDe(css) {
  const vus = new Set();
  for (const m of String(css || '').matchAll(/@media[^{]*/g)) {
    for (const w of m[0].matchAll(/(?:min|max)-width\s*:\s*([0-9.]+)px/g)) vus.add(Number(w[1]));
  }
  return [...vus].sort((a, b) => a - b);
}
