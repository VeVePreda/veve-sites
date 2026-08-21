// ⚠️ VeVePreda/veve-sites — engine/lib/extremes.mjs  (FICHIER NEUF — lot 157)
// ═══════════════════════════════════════════════════════════════════════════
// LE CLASSEMENT D'AMPLITUDE, DÉPOSÉ AU BUILD — ET RELU SANS `dataset()`
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 CE FICHIER EXISTE PARCE QUE `test:marche` A ATTRAPÉ LE LOT 157.
// La première écriture de `AnalyticsSujet.astro` faisait `await dataset()`
// pour huit lignes de classement. Ces quatre pages sont rendues À LA DEMANDE :
// `dataset()` y retélécharge 2,37 millions de lignes de prix — **10 328 ms
// mesurées au lot 125** sur `/market/`, à la première requête après CHAQUE
// redémarrage du conteneur.
// ⭐⭐⭐ Et le banc l'a vu sans que personne n'ait à y penser, parce qu'il
// balaie les composants IMPORTÉS par les routes de `ROUTES_COMPTE`, pas
// seulement les routes. La panne du lot 125 n'était pas dans la page non
// plus : elle était dans `Market.astro`, deux niveaux plus bas.
//
// ⭐ MÊME DISPOSITIF QUE `lireMarche()` (cote.mjs), VOLONTAIREMENT :
//   · l'écriture se fait AU BUILD, où `dataset()` est déjà en mémoire ;
//   · la lecture LÈVE si le fichier manque — ⛔ elle ne retombe JAMAIS sur
//     `dataset()`. Un repli « pour que ça marche quand même » coûterait dix
//     secondes par visite ET masquerait la panne, qui deviendrait invisible.
//
// ⛔ CE FICHIER NE CONTIENT AUCUN MONTANT, ET C'EST UNE CONTRAINTE, PAS UN
//    HASARD. `amplitude` est un RAPPORT sans unité, calculé dans `dataset.mjs`
//    avant la projection — c'est précisément ce que le lot 101 a gardé quand
//    `ath` et `atl` ont quitté le jeu public. Y remettre les deux bornes
//    ferait de `.reserve/` un porteur de cote, et `test:fuite` comme
//    `test:projection` ont chacun une bonne raison de s'y opposer.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
export const EXTREMES_FICHIER = process.env.RESERVE_EXTREMES
  || join(ROOT, '.reserve', 'extremes.json');

// ⭐ HUIT, ET LE NOMBRE EST ICI PLUTÔT QUE DANS LE GABARIT. La page affichait
// `slice(0, 8)` : le fichier aurait alors porté 3 113 lignes pour en montrer
// huit. On coupe à la SOURCE — c'est la leçon de poids du lot 155-B.
const COMBIEN = 8;

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LE PLAFOND D'AMPLITUDE — LOT 171 (21/08/2026), ARBITRAGE DE PREDA
// ═══════════════════════════════════════════════════════════════════════════
//
// ⛔⛔ LE LOT 157 REFUSAIT CE PLAFOND, ET SON ARGUMENT ETAIT BON :
//   « un garde-fou ABSOLU sur une grandeur CONTINUE choisit sa frontiere au
//     hasard : il masquerait le symptome, ferait disparaitre le defaut des
//     conversations, et couperait un jour une amplitude legitime. »
// Ce qui a change : le defaut a ete MESURE, il est ECRIT ici, la page DIT
// combien de lignes elle ecarte, et Preda a tranche (« ecarter ces items du
// classement »). Un symptome qu'on nomme et qu'on compte n'est plus masque.
//
// 📏 CE QUE LA MESURE A DIT — 21/08, sur le catalogue REEL (18 748 items avec
//    un `atl`, 15 517 paires classables) :
//
//   ⛔ LA CAUSE SUPPOSEE EST FAUSSE. Ce fichier affirmait « un `atl` residuel
//      proche de zero fait exploser le rapport ». **Il n'existe PAS UN SEUL
//      item dont l'`atl` soit inferieur a 1.** Zero sous 0,5 ; zero sous 1.
//      Le plus bas plus-bas du catalogue vaut 1 gem.
//      ⭐⭐⭐ *J'ai verifie le facteur que personne ne contestait.*
//
//   🔑 LA VRAIE CAUSE EST L'`ath`, ET CE SONT DES ANNONCES FARCEUSES :
//        Daredevil #4 (1964) .... store    699 · ath 999 999 999 999
//        The Golden MYO ......... store      0 · ath 111 111 111 111
//        LISA - Salute .......... store      0 · ath  88 888 888 888
//        Phoenix #5 (2024) ...... store    698 · ath     100 000 000
//      Des suites de 9 et de 8 tapees a la main. 42 items portent un `ath`
//      au-dessus de 100 millions de gems, 25 au-dessus du milliard.
//
//   ⛔ ET AUCUN FILTRE « PROPRE » NE MARCHE, MESURE AUSSI :
//      · `ath > 10 x p95` de l'item : ecarte **32 %** du catalogue et laisse
//        la tete intacte — parce que l'annonce farceuse est restee en ligne
//        assez longtemps pour ENTRER dans le p95 de l'item lui-meme.
//      · `ath > 500 x mediane` : 9,9 % ecartes, tete a x1 000 004. Idem.
//      · `ath > k x store_price` : la distribution est CONTINUE, aucun creux
//        ou poser la frontiere (quantile 0,99 = x14 326).
//      ⭐⭐ *Quand la donnee farceuse pollue aussi les statistiques de l'item,
//        aucune statistique de l'item ne peut la reconnaitre.*
//
// ⇒ 🎯 ON PLAFONNE DONC L'AMPLITUDE ELLE-MEME, ET ON L'ASSUME. A x1 000 la
//   tete du classement redevient lisible (atl 10 -> ath 10 000 sur un item a
//   10 gems au store : c'est un mouvement de marche plausible), et 1 142 items
//   sortent, soit **7,4 %**. Au-dessus, les nombres sont visiblement TAPES
//   (10 000, 99 999, 1 000 000).
//
// ⚠️ CE QUE CE PLAFOND N'EST PAS : une reparation. La donnee reste fausse dans
//   le catalogue, sur la fiche, et partout ailleurs. **Le chantier ATL/ATH est
//   en amont, dans `scrapeur-veve`** — c'est la qu'il se regle. Ici on refuse
//   seulement de CLASSER ce qu'on sait faux.
// 🎚️ Se regle au manifeste (`public.amplitude_max`) sans toucher au code.
//   `0` remet le comportement d'avant : aucun plafond.
const PLAFOND_DEFAUT = 1000;

/**
 * Écrit le classement d'amplitude. ⚠️ REÇOIT `ds` — il ne l'appelle pas.
 * ⛔ Un `await dataset()` ici rendrait ce module dangereux à importer depuis
 *    une route : `test:marche` suit les imports, et il aurait raison.
 */
// 🔴🔴🔴 UN DÉFAUT CONNU, MESURÉ, ET **DÉLIBÉRÉMENT NON CORRIGÉ ICI** — 18/08.
// Le classement produit par ce calcul commence, en production, par :
//     01  Tarzan of the Apes #210 (1972)   ×143 061 516,3
//     02  X-Men: Gold #30 (2017)           ×123 333 333,3
//     03  Rogue & Gambit - Kinetic Kiss     ×99 999 999,9
// Une amplitude de 143 MILLIONS n'a aucun sens. La cause est en AMONT — un
// `atl` résiduel proche de zéro fait exploser le rapport — et elle est dans
// `dataset.mjs`, pas ici.
// ⭐⭐⭐ CE LOT NE FAIT QUE DÉPLACER CE CALCUL, À L'IDENTIQUE. Vérifié sur la
// page en ligne le 18/08 avant d'écrire ce fichier : les huit mêmes lignes,
// les huit mêmes valeurs. ⛔ Ce n'est donc PAS une régression du lot 157, et
// c'est la seule raison pour laquelle il part quand même.
// ⛔ ET ON NE POSE PAS DE SEUIL (« ignorer au-dessus de ×1 000 »). Un garde-fou
//    ABSOLU sur une grandeur CONTINUE choisit sa frontière au hasard : il
//    masquerait le symptôme, ferait disparaître le défaut des conversations, et
//    couperait un jour une amplitude légitime. Le chantier ATL/ATH est en
//    amont — c'est là qu'il se règle.
// 🙋 SIGNALÉ À PREDA LE 18/08 avec ces chiffres. Tant qu'il n'a pas tranché, la
//    page montre ce que la donnée dit.
export function deposerExtremes(ds, coteFermee, plafondAmplitude) {
  // ⛔ `?? PLAFOND_DEFAUT` et non `|| PLAFOND_DEFAUT` : un manifeste qui ecrit
  //    `0` demande explicitement « aucun plafond », et `||` le lui refuserait
  //    en silence.
  const PLAFOND = Number.isFinite(Number(plafondAmplitude))
    ? Math.max(0, Number(plafondAmplitude)) : PLAFOND_DEFAUT;
  // ⚠️ ON FILTRE LES PAIRES INCOHÉRENTES (atl > ath) PLUTÔT QUE DE LES
  // AFFICHER : le chantier ATL/ATH n'est pas clos en amont, et un plus-bas
  // au-dessus d'un plus-haut détruit la confiance qu'une page de cotes existe
  // pour construire. ⛔ On ne les CORRIGE pas — corriger à l'affichage
  // masquerait la panne au lieu de la soigner. On les écarte, et on le dit.
  const items = Array.isArray(ds?.items) ? ds.items : [];
  const rapport = (i) => (coteFermee ? (i.amplitude || 0) : (i.atl > 0 ? i.ath / i.atl : 0));
  const classable = coteFermee
    ? (i) => !!i.amplitude
    : (i) => !!(i.ath && i.atl && i.atl <= i.ath);
  // ⭐ LE PLAFOND EST UN SECOND FILTRE, POSE APRES LE PREMIER, et les deux
  //   comptent SEPAREMENT : « paire incoherente » et « plus-haut invraisemblable »
  //   sont deux pannes differentes en amont. Les additionner dans un seul
  //   nombre rendrait la page incapable de dire laquelle empire.
  const credible = (i) => !PLAFOND || rapport(i) <= PLAFOND;

  const coherents = items.filter(classable);
  const eligibles = coherents.filter(credible);
  const ecartesPaire = coteFermee
    ? 0
    : items.filter((i) => i.ath && i.atl && i.atl > i.ath).length;
  const ecartesPlafond = coherents.length - eligibles.length;
  const ecartes = ecartesPaire + ecartesPlafond;

  const charge = {
    updatedAt: ds?.updatedAt ?? null,
    coteFermee: !!coteFermee,
    eligibles: eligibles.length,
    ecartes,
    // ⭐ LE DETAIL VOYAGE AVEC LE TOTAL. Un `ecartes: 1150` sans ventilation
    //   ne dit pas si le catalogue s'est degrade ou si le plafond a mordu.
    ecartesPaire,
    ecartesPlafond,
    plafond: PLAFOND || null,
    // ⭐ TROIS CHAMPS, PAS LA FICHE ENTIÈRE. `name` et `path` pour le lien,
    //   `x` pour le classement. Rien d'autre ne sort d'ici.
    lignes: [...eligibles]
      .sort((a, b) => rapport(b) - rapport(a))
      .slice(0, COMBIEN)
      .map((i) => ({ name: i.name, path: i.path, x: Number(rapport(i).toFixed(1)) })),
  };

  mkdirSync(dirname(EXTREMES_FICHIER), { recursive: true });
  writeFileSync(EXTREMES_FICHIER, JSON.stringify(charge), 'utf8');
  console.log(`[extremes] classement depose : ${charge.lignes.length} ligne(s) sur ${charge.eligibles} eligible(s)`
    + `${ecartesPaire ? `, ${ecartesPaire} paire(s) incoherente(s) ecartee(s)` : ''}`
    + `${ecartesPlafond ? `, ${ecartesPlafond} au-dessus du plafond d'amplitude (x${PLAFOND})` : ''}`
    + ` — /analytics/market/ ne rappellera pas dataset()`);
  // ⚠️ L'INSTRUMENT SE DECLARE MEME QUAND IL NE MORD PAS. Un plafond actif qui
  // n'ecarte rien et un plafond desactive donnent le meme `0` : sans cette
  // ligne, on ne saurait pas lequel des deux on regarde.
  if (PLAFOND && !ecartesPlafond) {
    console.log(`[extremes] plafond d'amplitude actif (x${PLAFOND}) mais AUCUN item ne le depasse`);
  }
  if (!PLAFOND) console.log('[extremes] plafond d\'amplitude DESACTIVE au manifeste (amplitude_max = 0)');
  return charge;
}

/**
 * Relit le classement.
 * ⛔ NE RETOMBE SUR RIEN — même règle que `lireMarche()`, et pour la même
 *    raison. Le message nomme les trois causes dans leur ordre de coût, parce
 *    qu'une exception qui ne dit pas quoi faire fait chercher au mauvais
 *    endroit pendant une heure.
 */
export function lireExtremes() {
  if (!existsSync(EXTREMES_FICHIER)) {
    throw new Error(
      `[extremes] classement absent (${EXTREMES_FICHIER}). Trois causes, dans cet ordre de cout : `
      + `(1) le build n'a pas appele deposerExtremes() — l'integration `
      + `\`veve:extremes\` est-elle dans astro.config.mjs ? ; `
      + `(2) \`.reserve/\` n'a pas ete copiee dans l'image (COPY --from=build /app/.reserve) ; `
      + `(3) RESERVE_EXTREMES pointe ailleurs. `
      + `⛔ On ne retombe PAS sur dataset() : ce repli couterait 10 s par visite et masquerait la panne.`);
  }
  // ⭐ MÊME CACHE QUE `lireMarche()`, ET IL EST LÉGITIME POUR LA MÊME RAISON :
  //   `.reserve/` est déposée AU BUILD et ne bouge plus de la vie du conteneur.
  //   Un contenu figé peut se garder. ⛔ Pas de durée de vie : une expiration
  //   ferait relire un fichier qui n'a pas changé, à un moment imprévisible.
  // ⚠️ La clé est le CHEMIN, pas un booléen — le jour où `RESERVE_EXTREMES`
  //   devient dynamique, un cache aveugle servirait le classement d'un autre
  //   fichier, en silence, à un banc qui se croirait vert.
  if (_cache && _cacheDe === EXTREMES_FICHIER) return _cache;
  const c = JSON.parse(readFileSync(EXTREMES_FICHIER, 'utf8'));
  if (!Array.isArray(c.lignes)) {
    throw new Error('[extremes] classement illisible : champ `lignes` absent');
  }
  _cache = c;
  _cacheDe = EXTREMES_FICHIER;
  return c;
}

let _cache = null;
let _cacheDe = null;

/** ⛔ POUR LES BANCS UNIQUEMENT. Un cache qu'on ne peut pas vider rend un banc
 *  dépendant de l'ordre de ses propres sections. */
export function oublierExtremes() { _cache = null; _cacheDe = null; }
