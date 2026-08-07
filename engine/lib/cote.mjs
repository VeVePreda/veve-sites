// ⚠️ VeVePreda/veve-sites — engine/lib/cote.mjs   (FICHIER NEUF — lot 101)
// ═══════════════════════════════════════════════════════════════════════════
// LA COTE — le prix COURANT et les extrêmes quittent le jeu de données public.
// ═══════════════════════════════════════════════════════════════════════════
//
// L'ARBITRAGE (Preda, 06/08/2026) : « on peut laisser le prix de drop mais pas
// le floor price actuel », « le market ne doit pas être visible en public »,
// et — 07/08 — « ATL/ATH derrière le mur, les graphes sans échelle restent
// publics ».
//
// 🔴🔴 CE QUI REND CE FICHIER NÉCESSAIRE, ET POURQUOI UN `<Gate>` N'AURAIT PAS
// SUFFI. Le mur existant (`gates.price_history` + `.reserve/`) ne protège que
// l'HISTORIQUE. La valeur COURANTE, elle, voyage dans le jeu de données qui
// alimente les ~8 500 pages PRÉ-GÉNÉRÉES : elle est dans le HTML servi, dans
// le JSON-LD `offers.price`, et dans le cache de Google. Masquer par du CSS ou
// par un composant conditionnel n'y change rien — c'est la leçon du lot 27 :
// ⭐⭐⭐ CE QUI NE DOIT PAS FUITER NE DOIT PAS ÊTRE DANS `dist/`.
// On ne cache donc pas le champ : ON NE LE PROJETTE PAS.
//
// ⭐⭐ POURQUOI LA PROJECTION EST LA DERNIÈRE ÉTAPE, ET PAS LA PREMIÈRE.
// Le floor pilote encore, en interne : le classement de la vitrine
// (`scoreUtilite`), le tri des sets, le repère d'aberration, les mouvements.
// Retirer le champ à la lecture du catalogue casserait tout ça en silence — on
// aurait un site propre et un classement aléatoire. `projeter()` s'appelle donc
// APRÈS que tout ce qui dépend du prix a été calculé, et les tris déjà faits
// survivent dans l'ORDRE DES TABLEAUX. ⛔ Un gabarit qui re-trierait sur
// `item.floor` après ce lot trierait sur `undefined` — silencieusement, dans
// l'ordre d'insertion. C'est le seul piège de ce fichier : les tris migrent
// dans dataset.mjs, ils ne restent pas dans les .astro.
//
// ⭐⭐⭐ LA COURBE SURVIT, L'ÉCHELLE NON — et c'est ce qui la rend partageable.
// Preda veut garder le graphe public (« pub partageable »). Une courbe dont on
// retire les graduations reste une FORME : elle raconte la tendance et ne dit
// aucun prix. ⛔ Mais laisser les vraies valeurs dans le tableau « puisque le
// SVG les normalise » serait la faute du `voile()` de la maquette, en pire :
// on ferait confiance au rendu pour ne pas les écrire. On NORMALISE donc la
// donnée elle-même, à la source, en 0..1000. Après `projeter()`, il n'existe
// plus une seule valeur en gems côté public — la fuite n'est pas improbable,
// elle est IMPOSSIBLE.

import { mkdirSync, existsSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { porte } from './access.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();

// ⭐ Même emplacement et même raison que `reserve.mjs` : HORS de `dist/`, nom
// commençant par un point, à la racine du projet. `test_reserve.mjs` fait déjà
// échouer le build si un fichier de `.reserve/` apparaît sous `dist/`.
export const COTE_DIR = process.env.RESERVE_COTE_DIR || join(ROOT, '.reserve', 'cote');

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidValide = (u) => RE_UUID.test(String(u || ''));

// ═══════════════════════════════════════════════════════════════════════════
// CE QUI PART DERRIÈRE LE MUR — la liste, et rien qu'elle
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ ÉCRITE UNE FOIS, LUE PAR TOUT LE MONDE : la projection, la réserve, la
// route d'API et le banc anti-fuite lisent CETTE constante. Deux définitions
// de « ce qui est un prix » divergeraient un jour, et le jour où elles
// divergent, c'est la version la plus permissive qui est en production.
export const CHAMPS_COTE = [
  'floor',        // le prix plancher COURANT — le cœur de l'arbitrage
  'ath', 'atl',   // les extrêmes (Preda, 07/08 : derrière le mur)
  'athDate', 'atlDate',
  'prixMedian', 'p95',   // des prix aussi, même s'ils portent un nom de statistique
];

// ⛔ CE QUI RESTE PUBLIC, ET POURQUOI — à relire avant d'ajouter une ligne
// au-dessus. `storePrice` : le PRIX DE DROP, explicitement conservé par Preda,
// et il ne dit rien du marché d'aujourd'hui. `listings` : un COMPTE d'offres,
// pas un montant — et c'est lui qui permet à la fiche d'avertir qu'une offre
// isolée porte le plancher, ce que la FAQ promet. `change7d`/`change30d` : des
// POURCENTAGES ; une variation sans niveau ne permet pas de reconstituer un
// prix. `prixAberrant` : un drapeau d'honnêteté éditoriale, sans montant.

// ═══════════════════════════════════════════════════════════════════════════
// LE PREDICAT — « la cote est-elle fermee sur ce site ? »
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ NOMME UNE FOIS, ICI, ET IMPORTE PAR LES SIX GABARITS. La premiere version
// de ce lot ecrivait `porte('cote').actif` dans Carte, Item, Home, Collections,
// CollectionPage et Analytics : six copies d'une meme question, dont cinq
// auraient survecu au jour ou la reponse change de forme.
//
// ⭐⭐⭐ ET IL Y A UNE SECONDE RAISON, PLUS INTERESSANTE. `test:session` refuse
// qu'un fichier melange le cookie d'affichage et une decision de DROIT. Le
// script de remplissage (`CoteScript.astro`) porte forcement ce cookie, et doit
// forcement savoir s'il a lieu d'exister. ⛔ La reponse n'etait PAS d'assouplir
// le banc, ni de recopier son motif ailleurs pour lui echapper :
// ⭐ `coteFermee()` N'EST PAS UNE DECISION DE DROIT. Elle ne regarde aucune
// session, elle rend LA MEME VALEUR pour tous les visiteurs, et elle est connue
// au build. C'est une question de MANIFESTE — « ce site vend-il sa cote ? » —
// pas une question de palier — « cette personne y a-t-elle droit ? ». Les deux
// vivaient dans le meme appel, et c'est le banc qui a rendu la confusion
// visible. Le predicat separe les deux questions au lieu de les melanger.
// ⛔ NE JAMAIS lui faire prendre `locals` en parametre : ce serait exactement
// refaire la confusion, et le nom ne le dirait plus.
export const coteFermee = () => porte('cote').actif;

const estActive = coteFermee;

/** La valeur d'un point de courbe, normalisée 0..1000 sur SA PROPRE série.
 *  ⚠️ Entier : un flottant à 12 décimales rendrait le prix reconstructible par
 *  qui connaîtrait deux points réels — la normalisation serait décorative. */
function normaliser(points) {
  const ys = points.map((p) => Number(p.floor)).filter(Number.isFinite);
  if (ys.length < 2) return [];
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = (y1 - y0) || 1;
  return points
    .filter((p) => Number.isFinite(Number(p.floor)))
    .map((p) => [
      Math.round(new Date(p.ts).getTime() / 1000),
      Math.round(((Number(p.floor) - y0) / span) * 1000),
    ]);
}

// ═══════════════════════════════════════════════════════════════════════════
//  LA RÉSERVE — ce que la route d'API servira aux seuls porteurs de session
// ═══════════════════════════════════════════════════════════════════════════
let ecrits = 0;
let refuses = 0;

// ═══════════════════════════════════════════════════════════════════════════
// LE JOURNAL DE PROJECTION — et pourquoi il ne fait pas doublon
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LE PIEGE QU'IL DESAMORCE A DEJA ETE PAYE UNE FOIS, MOT POUR MOT, SUR
// `reserve.mjs` : « la reserve n'avait JAMAIS tourne sur de vraies donnees
// quand elle a ete livree — hors reseau, `engine/data/sample` n'a pas de vrais
// uuid, donc la liste blanche les refuse tous et le chemin complet n'est jamais
// exerce ». Mesure du 07/08 : les uuid de l'echantillon valent
// `sample-0033-570553`. La liste blanche les refuse TOUS, et
// `.reserve/cote/` sort VIDE de tout build hors reseau — donc de la CI.
//
// ⭐⭐⭐ CONSEQUENCE, ET C'EST ELLE QUI COMPTE : le banc anti-fuite, qui compare
// les VRAIS montants au HTML publie, n'aurait eu aucun montant a comparer. Il
// serait vert, en CI, pour toujours, et pour la seule raison qui rend un banc
// inutile — il n'a rien a mesurer. C'est exactement « un instrument branche en
// aval de la panne mesure la panne avec la panne ».
//
// ⭐ Ce fichier-ci est ecrit pour TOUS les items, uuid valide ou non, parce
// qu'il ne compose aucun chemin depuis une donnee d'entree : son nom est une
// constante. La liste blanche protege les fichiers SERVIS ; elle n'a pas a
// aveugler les fichiers de CONTROLE.
// ⛔ IL NE DOIT JAMAIS ETRE SERVI. Il vit dans `.reserve/` (hors de `dist/`,
// trois barrieres deja en place) et son nom commence par `_` : `uuidValide()`
// le refuse, donc ni `/api/cote/[uuid]` ni `/api/cote/lot` ne peuvent le lire,
// meme en le demandant nommement.
export const JOURNAL = '_projection.json';
const journal = {};

function deposer(item) {
  const cote = {};
  for (const champ of CHAMPS_COTE) {
    if (item[champ] !== undefined && item[champ] !== null) cote[champ] = item[champ];
  }
  // ⭐ On dépose aussi ce qui n'a de sens qu'À CÔTÉ d'un prix : un abonné qui
  // reçoit `floor` sans `listings` ne peut pas juger si le plancher tient sur
  // une seule offre. La réserve sert une VUE, pas une colonne.
  cote.listings = item.listings ?? null;
  cote.prixAberrant = !!item.prixAberrant;
  cote.maj = new Date().toISOString();

  // Le journal d'abord : il doit contenir CE QU'ON A RETIRE, y compris pour un
  // item dont l'uuid n'aura pas de fichier servi.
  journal[item.uuid] = cote;

  // 🔴 La liste blanche ne garde que L'ECRITURE DU FICHIER SERVI : `item.uuid`
  // compose ici un CHEMIN. Un `veve_uuid` valant `../../dist/index.html`
  // ecrirait ou il veut. On ne nettoie pas, on n'echappe pas — ON REFUSE.
  if (!uuidValide(item.uuid)) { refuses++; return; }
  writeFileSync(join(COTE_DIR, item.uuid + '.json'), JSON.stringify(cote), 'utf8');
  ecrits++;
}

/** ═════════════════════════════════════════════════════════════════════════
 *  LA PROJECTION PUBLIQUE — appelée UNE fois, à la toute fin de `dataset()`.
 *  ═════════════════════════════════════════════════════════════════════════
 *  ⚠️ ELLE MUTE LES ITEMS EN PLACE, volontairement. `bySlug`, `collections`,
 *  `rarities` et `movers` pointent tous vers LES MÊMES objets : rendre une
 *  copie laisserait quatre chemins par lesquels le prix atteindrait encore le
 *  HTML, et ces quatre-là sont exactement ceux qu'on veut fermer.
 *  ⭐ C'est aussi ce qui rend le banc anti-fuite crédible : il n'existe qu'un
 *  seul jeu d'objets, donc un seul endroit à prouver. */
export function projeter(items) {
  if (!estActive()) {
    // ⭐ Un site sans porte `cote` (vevewiki, ou veveprice si Preda rouvre)
    // ne paie RIEN : ni écriture, ni normalisation, ni champ perdu. Le
    // manifeste décide, le code obéit — même dispositif que `<Cadran>`.
    return { actif: false, ecrits: 0, projetes: 0 };
  }

  // Le dossier est recréé à neuf : une cote de la veille servie pour un prix
  // du jour serait pire qu'une absence, et personne ne le verrait.
  if (existsSync(COTE_DIR)) {
    for (const f of readdirSync(COTE_DIR)) rmSync(join(COTE_DIR, f), { force: true });
  } else {
    mkdirSync(COTE_DIR, { recursive: true });
  }
  ecrits = 0; refuses = 0;
  for (const k of Object.keys(journal)) delete journal[k];

  for (const item of items) {
    deposer(item);
    // La courbe AVANT les champs : `normaliser` lit `history[].floor`.
    item.courbe = normaliser(item.history || []);
    delete item.history;
    for (const champ of CHAMPS_COTE) delete item[champ];
  }

  writeFileSync(join(COTE_DIR, JOURNAL), JSON.stringify({
    maj: new Date().toISOString(),
    projetes: items.length, ecrits, refuses,
    champs: CHAMPS_COTE,
    valeurs: journal,
  }), 'utf8');

  console.log('[cote] porte « cote » ACTIVE : ' + CHAMPS_COTE.length + ' champs retires du jeu public sur ' + items.length + ' fiches · ' + ecrits + ' cotes deposees dans .reserve/cote/');
  if (refuses) {
    // ⚠️ CE N'EST PAS UNE ERREUR HORS RESEAU, ET C'EN EST UNE EN PRODUCTION.
    // L'echantillon porte des identifiants `sample-…`, refuses par construction.
    // Un catalogue REEL n'en porte aucun : le meme chiffre veut donc dire deux
    // choses opposees selon la source, et c'est pour ca qu'il est CHIFFRE ici
    // au lieu d'etre un simple avertissement. `test:fuite` le relit.
    console.log('[cote] ' + refuses + ' uuid refuse(s) par la liste blanche (attendu hors reseau : '
      + 'l echantillon porte des identifiants « sample-… » ; ANORMAL sur un catalogue reel).');
  }
  if (items.length && !ecrits && !refuses) {
    console.log('[cote] ATTENTION aucune cote deposee et aucun refus : la projection n a rien vu passer.');
  }
  return { actif: true, ecrits, refuses, projetes: items.length };
}
