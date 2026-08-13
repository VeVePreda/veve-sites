// ⚠️ VeVePreda/veve-sites — engine/tools/test_fraicheur.mjs   (FICHIER NEUF — lot 144)
// ═══════════════════════════════════════════════════════════════════════════
// L'INVARIANT DE FRAICHEUR — il lit `dist/`, et il COMPTE
// ═══════════════════════════════════════════════════════════════════════════
//
//   ① Aucune page publique ne peut afficher une date de fraicheur qui ne
//      provienne pas de la donnee qu'elle decrit.
//   ② Toute fiche sans date de relevement doit le DIRE — le silence est
//      indiscernable d'une donnee fraiche.
//
// ⭐⭐ IL COMPTE, IL NE DEDUIT PAS. Devant tout `si rien trouve -> INDECIDABLE`,
// la question du lot 143 : « de quoi cette absence est-elle la preuve ? ». Il
// annonce combien de fiches il a ouvertes, combien portent une date, combien
// portent l'avertissement, et il EXIGE QUE LA SOMME FASSE LE TOTAL. Un banc qui
// ne boucle pas sur son propre total peut etre muet sans le savoir.
//
// ⛔ PAS UNE LISTE DE CHEMINS. « Cette page decrit-elle une donnee ? » se lit
// dans le HTML servi : une fiche porte `socle__fav--fiche`, rendu POUR TOUT LE
// MONDE, TOUJOURS (Item.astro le dit et le lot 100 l'exige — ces pages sont
// pre-generees, elles n'ont pas de visiteur). Une liste tenue a la main
// laisserait passer la route suivante en silence, comme ROUTES_COMPTE.
//
// ⛔⛔ ET IL NE CROIT PAS `data-fraicheur` SUR PAROLE. Le marqueur est emis par
// le gabarit meme qu'on juge : s'y fier seul, ce serait un banc qui fabrique sa
// condition. Le §3 compare donc, fiche par fiche, la date ISO du PIED
// (`Base.astro`) a celle du bloc StackR (`Item.astro`) : deux composants, une
// seule source. S'ils divergent, le pied a ete rebranche ailleurs — et
// l'etiquette continuerait d'annoncer « donnee » sans que rien ne le dise.
//
// 📍 PLACEMENT — il lit `dist/`, donc APRES `npm run build`, et DANS le
// `Dockerfile`. ⭐⭐ Le Dockerfile est la seule porte que le deploiement
// respecte ; la CI CONSTATE, elle n'EMPECHE pas. Place avant le build, il
// sortirait INDECIDABLE, c'est-a-dire VERT SANS AVOIR MESURE.
//
// ⚠️ linkedom ne construit pas l'arbre comme un navigateur (head de 33 enfants
// la ou le navigateur en rend 0) : ⛔ jamais juger la STRUCTURE avec lui. Ce
// banc ne juge aucune structure — il compte des marqueurs et des textes.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { texteVu } from '../lib/seo.mjs';
import { CHAMPS_COTE, CHAMPS_FRAICHEUR } from '../lib/cote.mjs';
import { indexerReleves, jourDeReleve } from '../lib/dataset.mjs';

const R = new URL('../..', import.meta.url).pathname;
const DIST = process.env.DIST_DIR || join(R, 'dist');
const RACINE = existsSync(join(DIST, 'client')) ? join(DIST, 'client') : DIST;

let ko = 0;
const dit = (bon, quoi, detail) => {
  if (!bon) ko++;
  console.log(`  ${bon ? 'ok ' : 'KO '} ${quoi}${detail ? ` — ${detail}` : ''}`);
};

console.log('\n═══ LOT 144 — la fiche dit la date de SA donnee ═══');

// ── 0. L'INSTRUMENT AVANT LA MESURE ───────────────────────────────────────
// ⭐⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » Sur un `dist/` absent,
// tout ce qui suit serait vert. On refuse d'abord de mesurer debranche.
if (!existsSync(RACINE)) {
  console.log(`  KO  dist/ introuvable (${RACINE}) — ce banc va APRES \`npm run build\``);
  console.log('      ⛔ Place avant, il sortirait INDECIDABLE : vert sans avoir mesure.');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// §1 · LA LIGNE DE PARTAGE, TENUE DANS LES DEUX SENS
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ M5 ET M6 SONT OPPOSES, ET C'EST LE POINT. Un banc qui ne tiendrait que
// M5 (« aucun prix ne fuit ») laisserait passer un lot qui reserve TOUT, y
// compris la date — et la fiche redeviendrait muette sans qu'un run rougisse.
console.log('\n1. la ligne de partage');
dit(CHAMPS_COTE.includes('floorStackr'),
  '`floorStackr` est RESERVE (CHAMPS_COTE)',
  CHAMPS_COTE.includes('floorStackr') ? null
    : 'c\'est un PRIX en clair sur 652 fiches — la fuite du lot 101 par la porte d\'a cote');
const fuite = CHAMPS_FRAICHEUR.filter((c) => CHAMPS_COTE.includes(c));
dit(fuite.length === 0,
  `les ${CHAMPS_FRAICHEUR.length} champs de fraicheur restent PUBLICS`,
  fuite.length === 0 ? CHAMPS_FRAICHEUR.join(', ')
    : `${fuite.join(', ')} est passe derriere le mur — la fiche ne peut plus dire quand elle a ete relevee`);

// ═══════════════════════════════════════════════════════════════════════════
// §2 · « ON GARDE LE PLUS FRAIS » — la fonction pure, pas ses consequences
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ C'EST LE SEUL CONTROLE QUI DEPARTAGE M7, et il ne pouvait pas se prendre
// sur `dist/` : une date perimee y a exactement la meme forme qu'une date
// juste. ⛔ Et il etait hors de question de rappeler `dataset()` — au lot 104,
// un banc qui le faisait a DETRUIT la reserve du build (1 201 fichiers -> 0).
console.log('\n2. le lecteur retient le plus frais (fonction pure)');
{
  // ⚠️ FIXTURE DANS L'ORDRE REEL DU FICHIER : trie sur `(uuid, ts)`, donc la
  // PREMIERE ligne d'un uuid est la PLUS ANCIENNE — 3 470 fois sur 3 470 le
  // 13/08. Une fixture ecrite dans l'ordre « naturel » (recent d'abord) aurait
  // laisse passer le lecteur naif.
  const { par, ignorees } = indexerReleves([
    { veve_uuid: 'A', ts_releve: '1000000', source: 'stackr', floor: '900000.0' },
    { veve_uuid: 'A', ts_releve: '2000000', source: 'veve', floor: '7.98' },
    { veve_uuid: 'B', ts_releve: '2000000', source: 'stackr', floor: '4200.0' },
    { veve_uuid: 'B', ts_releve: '1000000', source: 'veve', floor: '3.50' },
    { veve_uuid: 'C', ts_releve: '0', source: 'veve', floor: '1.0' },
    { veve_uuid: 'D', ts_releve: '', source: 'veve', floor: '1.0' },
    { veve_uuid: 'E', ts_releve: 'nan', source: 'stackr', floor: '1.0' },
  ]);
  const a = par.get('A') || {}, b = par.get('B') || {};
  dit(a.sec === 2000000, 'A : la ligne la PLUS FRAICHE gagne, meme placee en second',
    a.sec === 2000000 ? null : `retenu ${a.sec} au lieu de 2000000 — c'est le mutant M7, et c'est le cas MAJORITAIRE (47 % des uuid)`);
  dit(b.sec === 2000000, 'B : l\'autre extremite — `stackr` plus frais que `veve`',
    b.sec === 2000000 ? null : 'un lecteur qui prend TOUJOURS `veve` passerait sans ce cas');
  dit(a.stackr === 900000, 'A : le floor StackR survit a sa ligne, meme battue en fraicheur',
    a.stackr === 900000 ? null : `${a.stackr} — jete avec sa ligne, 652 fiches reperdent leur montant`);
  dit(b.stackr === 4200, 'B : `Number()` et non `parseInt` sur un `repr` Python',
    b.stackr === 4200 ? null : String(b.stackr));
  dit(!par.has('C') && !par.has('D') && !par.has('E'),
    'ts a 0, vide ou `nan` : IGNORES, pas comptes comme dates',
    'une date invalide affichee vaut pire qu\'une date absente');
  dit(ignorees === 3, `${ignorees} ligne(s) sans horodate exploitable comptee(s)`,
    ignorees === 3 ? null : 'le banc doit COMPTER ce qu\'il ecarte, pas s\'en debarrasser');
  dit(jourDeReleve(1786525683) === '2026-08-12',
    'un epoch en SECONDES devient une date ISO',
    `obtenu ${jourDeReleve(1786525683)} — \`new Date('1786525683')\` rend Invalid Date SANS rien lever`);
}

// ═══════════════════════════════════════════════════════════════════════════
// §2 bis · CE SITE PUBLIE-T-IL SEULEMENT DES FICHES ? — le manifeste repond
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CORRECTIF DU 13/08 13 h 30, ET C'EST MOI QUI AVAIS INTRODUIT LA PANNE.
// Le lot 144‑B est sorti VERT sur `veveprice` et ROUGE sur `vevewiki` : le wiki
// ne publie **aucune** fiche de prix (263 pages, 0 sous `/collectibles/`), et le
// §3 exigeait « plus de 50 fiches ». ⭐⭐ *Corrigé sur un site n'est pas
// corrigé* : ce dépôt construit DEUX sites, et je n'en avais éprouvé qu'un.
//
// ⛔ LA CORRECTION N'EST **PAS** « si 0 fiche, sortir vert ». Sur `veveprice`,
// zéro fiche EST la panne — et un banc qui déduit sa raison d'être de ce qu'il
// trouve sur le disque est exactement le défaut que `test_fuite_prix` a payé le
// 07/08 (il héritait d'un `.reserve/` laissé par l'autre site).
// ⭐⭐⭐ LA QUESTION A UNE REPONSE EXACTE, ET ELLE EST DANS LE MANIFESTE.
// `priceEnabled()` (`engine/lib/features.mjs`) dit si le site déclare des
// modules de données prix ; c'est ce même prédicat qui fait rendre `[]` aux
// six routes de fiches. Le banc lit donc LA MEME source que le rendu — deux
// définitions de « ce site publie-t-il des fiches » divergeraient un jour.
// → [[regle-banc-deduit-au-lieu-de-compter]] · [[regle-invariant-plutot-quune-seconde-liste]]
//
// ⚠️ L'import est DYNAMIQUE et vient APRES le réglage de `SITE` : `manifest()`
// lit cette variable, et un import statique serait hissé avant la ligne
// suivante — le banc jugerait alors le manifeste d'un autre site.
process.env.SITE = process.env.SITE || 'veveprice';
const { priceEnabled } = await import('../lib/features.mjs');
if (!priceEnabled()) {
  console.log(`\n  ..  SANS OBJET : ${process.env.SITE} ne publie AUCUNE page de prix`);
  console.log('      (manifeste : `content.data_modules` vide, et les 6 routes de fiches rendent []).');
  console.log('      ⚠️ Sur veveprice, CE MESSAGE EST LA PANNE — les 1 200 fiches devraient exister.');
  console.log(ko === 0 ? '\n✅ rien a verifier sur ce site\n' : `\n🔴 ${ko} controle(s) en echec\n`);
  process.exit(ko === 0 ? 0 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// §3 · LE PARCOURS DE `dist/` — un seul passage, rien n'est garde
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ UN SEUL `readFileSync` PAR FICHIER, ET SON CONTENU EST RELACHE AVANT LE
// SUIVANT. La lecon du lot 104 : trois lectures par page et la liste complete
// retenue, c'etait 3 Go de tas sur 8 484 pages, puis SIGABRT.
console.log('\n3. les pages publiees');

// « cette page decrit-elle une donnee ? » — le marqueur EXISTE DEJA, ce banc ne
// l'a pas invente : `socle__fav--fiche` est rendu par Item.astro pour tout le
// monde, toujours, et il porte l'uuid de la piece.
const RE_FICHE = /class="socle__fav socle__fav--fiche"[^>]*data-fav="([^"]+)"/;
const RE_MARQ = /data-fraicheur="(build|donnee|aucune)"[^>]*>([^<]*)</g;
// ⭐⭐⭐ LE CONTROLE QUI NE PASSE PAS PAR LE MARQUEUR. `data-releve` est ecrit
// par `Base.astro` (le pied) ; la date ISO du bloc StackR est ecrite par
// `Item.astro` (le corps). DEUX COMPOSANTS, UNE SEULE SOURCE — `item.releveLe`.
const RE_PIED_ISO = /data-releve="(\d{4}-\d{2}-\d{2})"/;
// 🔴🔴 LOT 145 — CE SELECTEUR ETAIT POSITIONNEL, ET LE LOT 145 L'AURAIT
// RETOURNE EN SILENCE. Il lisait « la premiere `mur__eq` porteuse d'une date » ;
// le lot 145 en insere une AVANT elle dans le mur de gauche, et il se serait mis
// a comparer le pied de page a la date de DERNIERE VARIATION — donc a rougir sur
// 91 % des fiches en accusant `Base.astro` d'un defaut inexistant.
// ⭐⭐⭐ Un critere de POSITION tient jusqu'a ce qu'on insere quelque chose
// au-dessus, et rien ne previent. `data-releve-corps` est ecrit par `Item.astro`
// depuis `item.releveLe`, dans la meme expression que le texte visible.
// → [[regle-selecteur-de-classe-en-prefixe]] · [[regle-note-qui-cite-son-terminateur]]
const RE_CORPS_ISO = /data-releve-corps="(\d{4}-\d{2}-\d{2})"/;
// ⛔ L'ATTRIBUT NE SE CROIT PAS LUI-MEME. Un attribut qui double un texte peut
// mentir : on exige que sa date soit AUSSI dans le texte rendu de la page.
// 🔴🔴 MESURE DU 13/08 : ASTRO N'ECRIT PAS `attr=""`, IL ECRIT `attr`. Ma
// premiere version exigeait `data-variation="…"` suivi de l'etat : elle a
// declare « 20 fiche(s) SANS le bloc » alors que le bloc etait la, rendu, avec
// l'attribut vide reduit a son nom. ⭐⭐⭐ Le banc accusait le GABARIT d'une
// faute qui etait la sienne — et il a fallu ouvrir le HTML pour le voir.
// ⇒ ON CLASSE SUR `data-variation-etat`, qui n'est JAMAIS vide, et la valeur se
// lit SEPAREMENT. Un critere pose sur un champ qui peut disparaitre juge la
// presence du champ, pas l'etat de la page.
const RE_VAR_ETAT = /data-variation-etat="(affichable|posterieur|absent)"/;
const RE_VAR_VAL = /data-variation="(\d{4}-\d{2}-\d{2})"/;
// 🔴🔴 LE MUTANT M7 EST PASSE VERT CONTRE MA PREMIERE VERSION, ET LA LECON EST
// UNE ECHELLE. J'ecrivais `texteVu(page).includes(date)` : la date d'une piece
// figure aussi dans le JSON-LD, dans le pied et dans la courbe, donc un gabarit
// qui affichait le LIBELLE SANS LA DATE passait le controle sans broncher.
// ⭐⭐⭐ Chercher une chaine dans TOUTE la page, c'est mesurer la page, pas le
// bloc. On lit desormais le contenu DU NOEUD, borne a son `</div>`.
// → [[regle-instrument-de-mesure]] · [[regle-critere-juge-la-valeur-cherche-la-chaine]]
const RE_VAR_TEXTE = /data-variation-etat="affichable"[^>]*>([\s\S]{0,300}?)<\/div>/;

let nPages = 0, nFiches = 0, nAutres = 0, nAutresDatees = 0;
let nDonnee = 0, nAucune = 0, nBuildSurFiche = 0, nDouble = 0, nMuette = 0;
let nConcorde = 0, nDiverge = 0;
let nVarDistinct = 0, nVarComparables = 0;
let nVarNoeud = 0, nVarAff = 0, nVarPost = 0, nVarAbs = 0, nVarMuet = 0, nVarTexte = 0, nVarIncoherent = 0;
const exVarMuet = [], exVarIncoherent = [];
const datesFiches = new Set();
const exBuild = [], exMuette = [], exDiverge = [];
const MAX_EX = 5;

(function marcher(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { marcher(p); continue; }
    if (!e.name.endsWith('.html')) continue;
    nPages++;
    const texte = readFileSync(p, 'utf8');
    const estFiche = RE_FICHE.test(texte);
    const marques = [...texte.matchAll(RE_MARQ)];
    if (!estFiche) {
      nAutres++;
      if (marques.some((m) => m[1] === 'build')) nAutresDatees++;
      continue;
    }
    nFiches++;
    if (marques.length > 1) nDouble++;
    // ── LOT 145 · LA DATE DE DERNIERE VARIATION, LUE DANS LE MEME `texte` ──
    // ⭐ Aucune lecture de fichier supplementaire : la lecon des 3 Go de tas du
    // lot 104 tient toujours.
    const mv = texte.match(RE_VAR_ETAT);
    if (!mv) {
      nVarMuet++;
      if (exVarMuet.length < MAX_EX) exVarMuet.push(p.slice(RACINE.length));
    } else {
      nVarNoeud++;
      const etat = mv[1];
      const val = (texte.match(RE_VAR_VAL) || [])[1] || '';
      if (etat === 'affichable') {
        nVarAff++;
        // l'attribut doit se retrouver DANS le texte rendu, sinon il ment
        const dedans = (texte.match(RE_VAR_TEXTE) || [])[1] || '';
        if (val && texteVu(dedans).includes(val)) nVarTexte++;
        // ⛔ L'INVARIANT : une variation ne peut pas etre POSTERIEURE au releve.
        const corps = (texte.match(RE_CORPS_ISO) || [])[1] || null;
        if (corps && val) { nVarComparables++; if (val !== corps) nVarDistinct++; }
        if (corps && val > corps) {
          nVarIncoherent++;
          if (exVarIncoherent.length < MAX_EX) exVarIncoherent.push(`${p.slice(RACINE.length)} variation=${val} > releve=${corps}`);
        }
      } else if (etat === 'posterieur') nVarPost++;
      else nVarAbs++;
    }
    if (!marques.length) {
      nMuette++;
      if (exMuette.length < MAX_EX) exMuette.push(p.slice(RACINE.length));
      continue;
    }
    const [, quoi, txt] = marques[0];
    if (quoi === 'build') {
      nBuildSurFiche++;
      if (exBuild.length < MAX_EX) exBuild.push(p.slice(RACINE.length));
    } else if (quoi === 'donnee') {
      nDonnee++;
      // ⚠️ `texteVu()` AVANT tout comptage sur du HTML servi : entites,
      // marqueurs i18n et caracteres de largeur nulle. Le `\s` de JS attrapait
      // le BOM par accident, pas par conception.
      datesFiches.add(texteVu(txt).trim());
      const pied = (texte.match(RE_PIED_ISO) || [])[1] || null;
      const corps = (texte.match(RE_CORPS_ISO) || [])[1] || null;
      if (pied && corps && pied === corps) nConcorde++;
      else {
        nDiverge++;
        if (exDiverge.length < MAX_EX) exDiverge.push(`${p.slice(RACINE.length)} pied=${pied || 'aucun'} corps=${corps || 'aucun'}`);
      }
    } else {
      nAucune++;
    }
  }
})(RACINE);

// ── L'INSTRUMENT SE DECLARE ───────────────────────────────────────────────
dit(nFiches > 50, `${nFiches} fiche(s) ouverte(s) sur ${nPages} page(s)`,
  nFiches > 50 ? null
    : 'TROP PEU — ce banc serait vert par manque de matiere, pas par conformite');

// ── ① aucune fiche ne date du build ───────────────────────────────────────
dit(nBuildSurFiche === 0,
  'aucune fiche ne tire sa date de l\'heure du deploiement',
  nBuildSurFiche === 0 ? null
    : `${nBuildSurFiche} fiche(s), dont ${exBuild.join(' · ')}`
      + '\n     🔴 « Donnees mises a jour le <build> » sur une page qui decrit une donnee'
      + '\n        AFFIRME une fraicheur que personne n\'a mesuree.');

// ── ② toute fiche sans date le DIT ────────────────────────────────────────
dit(nMuette === 0,
  'aucune fiche ne se tait sur sa fraicheur',
  nMuette === 0 ? null
    : `${nMuette} fiche(s), dont ${exMuette.join(' · ')}`
      + '\n     🔴 Le silence est indiscernable d\'une donnee fraiche.');

// ── LA SOMME FAIT LE TOTAL, ET C'EST CE CONTROLE QUI EMPECHE D'ETRE MUET ──
// ⭐⭐ Un banc qui ne boucle pas sur son propre total peut compter zero panne
// parce qu'il n'a rien regarde. Une fiche qui echapperait aux quatre categories
// deferait l'egalite.
dit(nDonnee + nAucune + nBuildSurFiche + nMuette === nFiches,
  `la somme fait le total : ${nDonnee} datee(s) + ${nAucune} avertie(s) + ${nBuildSurFiche} au build + ${nMuette} muette(s) = ${nFiches}`,
  nDonnee + nAucune + nBuildSurFiche + nMuette === nFiches ? null
    : 'une fiche echappe au classement : le banc ne mesure pas ce qu\'il croit');
dit(nDouble === 0, 'aucune fiche ne porte deux dates de fraicheur',
  nDouble === 0 ? null : `${nDouble} page(s) se contredisent dans leur propre pied`);

// ── ③ LE MECANISME EST-IL SEULEMENT VIVANT ? ──────────────────────────────
// 🔴🔴 CE CONTROLE-CI EST SEPARE DU SUIVANT, ET LA SEPARATION A ETE PAYEE PAR
// UN MUTANT. Ma premiere version n'avait que le comptage de dates distinctes :
// sur M1 (« `releveLe` n'est pas retenu »), il sortait ROUGE en annonçant
// « toutes les fiches affichent la meme date » — alors qu'aucune fiche
// n'affichait de date du tout. ⭐⭐⭐ UN MESSAGE D'ECHEC EST UNE INSTRUCTION :
// celui-la envoyait chercher dans `Base.astro` un defaut qui vivait dans
// `dataset.mjs`. → [[regle-banc-nomme-une-cause]]
dit(nDonnee > 0,
  `${nDonnee} fiche(s) portent une date de relevement`,
  nDonnee > 0 ? null
    : 'AUCUNE — le MECANISME est mort : `releves` n\'est pas lu, ou `dataset()` ne retient'
      + '\n        pas `releveLe`. ⛔ Ce n\'est PAS la meme panne qu\'une date de build.');

// ── ④ LE CONTROLE QUI NE CROIT PAS LE MARQUEUR ────────────────────────────
// 🔴🔴 IL A REMPLACE UN COMPTAGE DE DATES DISTINCTES, ET LA MESURE A TRANCHE.
// Ma premiere version exigeait « au moins 5 dates distinctes » : verte hors
// ligne (31 dates sur 90 fiches) et ROUGE en production — mesure du 13/08 sur
// un build reel : **1 seule date distincte sur 943 fiches**. Ce n'est pas une
// panne : `vfloors` est reecrit A CHAQUE run, donc presque toutes les pieces
// PUBLIEES ont ete relevees le jour meme. Le fichier porte bien 16 jours
// distincts, mais ils vivent chez les pieces non publiees.
// ⭐⭐⭐ UN BANC VALIDE SUR L'ECHANTILLON N'EST PAS VALIDE. Celui-la aurait rougi
// au premier deploiement en accusant `Base.astro` d'une faute inexistante — et
// on aurait « corrige » un code sain pour lui plaire.
dit(nDiverge === 0,
  `${nConcorde} fiche(s) : le pied et le bloc StackR portent LA MEME date`,
  nDiverge === 0 ? null
    : `${nDiverge} divergence(s), dont ${exDiverge.join(' · ')}`
      + '\n     🔴 Deux composants rendent `item.releveLe` et ne disent pas la meme chose :'
      + '\n        le pied a ete rebranche sur autre chose que la donnee de la fiche.');
// ⭐ Le nombre de dates distinctes reste AFFICHE — il ne juge plus, il informe.
console.log(`  ..  ${datesFiches.size} date(s) distincte(s) sur les ${nDonnee} fiche(s) datees (indicatif, non juge)`);

// ═══════════════════════════════════════════════════════════════════════════
// §5 · LOT 145 — « DEPUIS QUAND CE PRIX N'A-T-IL PAS BOUGE ? »
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n5. la date de derniere variation');

// ── ⑤ LE NOEUD EXISTE SUR CHAQUE FICHE, MEME MUET ─────────────────────────
// ⭐⭐⭐ CE CONTROLE-LA EST LE PLUS IMPORTANT DES QUATRE, ET C'EST LE MOINS
// EVIDENT. Sans lui, un gabarit qui cesserait de rendre le bloc sortirait VERT :
// « 0 fiche affichable, 0 incoherence » est exactement ce que produit un lot qui
// supprime la fonction. Un banc qui ne regarde que ce qui existe ne voit jamais
// ce qui manque. → [[regle-circuit-ouvert]]
dit(nVarMuet === 0,
  `${nVarNoeud} fiche(s) portent le bloc de derniere variation`,
  nVarMuet === 0 ? null
    : `${nVarMuet} fiche(s) SANS le bloc, dont ${exVarMuet.join(' · ')}`
      + '\n     🔴 Le bloc n\'est plus rendu : « pas de donnee » et « plus de gabarit »'
      + '\n        deviennent indiscernables, et ce banc serait vert sans lui.');

// ── ⑥ LE MECANISME EST VIVANT ─────────────────────────────────────────────
// 🔴 SEPARE DU PRECEDENT, POUR LA RAISON QUI A DEJA COUTE UN MUTANT AU §3 : si
// `derniereVariation` cessait d'etre projete, le bloc serait la, muet, sur 100 %
// des fiches — et « le noeud existe » resterait vert. Ce controle-ci nomme
// `dataset.mjs`, l'autre nomme `Item.astro`. Deux causes, deux messages.
// ⛔ Le seuil est 1, PAS un pourcentage : la part d'affichables depend de la
// dispersion de DEUX collecteurs, et un banc cale sur une dispersion est vert
// hors ligne et rouge en production sur du code sain (lot 144, mesure).
// → [[regle-banc-cale-sur-la-dispersion]]
// 🔴🔴 LE GARDE, ET IL A ETE PAYE PAR LE MUTANT M2. Quand le bloc disparait du
// gabarit, ce controle-ci rougissait AUSSI, en envoyant chercher la panne dans
// `dataset.mjs` — alors qu'elle etait dans `Item.astro`, et que le controle du
// dessus le disait deja. ⭐⭐⭐ Deux rouges pour une faute, dont un qui MENT sur
// sa cause, c'est pire qu'un seul : on corrige le fichier qu'on vient de lire.
// Sans noeud a lire, ce controle n'a pas d'objet — il se tait, il ne devine pas.
// → [[regle-banc-nomme-une-cause]]
dit(nVarNoeud === 0 || nVarAff > 0,
  nVarNoeud === 0 ? 'SANS OBJET : aucun bloc a lire (voir le controle ci-dessus)' : `${nVarAff} affichable(s) · ${nVarPost} tue(s) par incoherence · ${nVarAbs} sans donnee`,
  nVarAff > 0 ? null
    : 'AUCUNE fiche n\'affiche de date de variation — `derniereVariation` n\'est plus'
      + '\n        projete par `dataset.mjs`, ou `last_ts` est vide dans les baselines.'
      + '\n        ⛔ Ce n\'est PAS la meme panne qu\'un bloc absent (controle ci-dessus).');

// ── ⑦ L'ATTRIBUT NE MENT PAS ──────────────────────────────────────────────
// ⭐⭐ « AFFIRME » N'EST PAS « CITE ». Un attribut qui porte une date que la page
// n'affiche pas laisserait le banc valider une fiche que le visiteur voit vide.
dit(nVarTexte === nVarAff,
  `${nVarTexte} date(s) annoncee(s) par l'attribut sont AUSSI dans le texte rendu`,
  nVarTexte === nVarAff ? null
    : `${nVarAff - nVarTexte} fiche(s) portent la date en attribut sans l'afficher :`
      + '\n     🔴 l\'attribut et le texte ont ete separes, le banc mesurait un fantome.');

// ── ⑧ L'INVARIANT : ON NE CHANGE PAS AVANT D'AVOIR REGARDE ────────────────
// 🔴🔴 UN INVARIANT, PAS UN GARDE-FOU TAILLE SUR LE BUG DU JOUR. La condition
// vit dans `Item.astro` (`varEtat`) ; ce controle dit qu'elle TIENT dans le HTML
// servi, quelle que soit la forme que prendra la prochaine regression.
// Mesure du 13/08 : 158 pieces sur 6 408 (2,5 %) en production, 20 sur 75 hors
// ligne — le cas est donc reellement traverse par les bancs, pas theorique.
dit(nVarIncoherent === 0,
  'aucune fiche n\'affiche une variation POSTERIEURE a son propre releve',
  nVarIncoherent === 0 ? null
    : `${nVarIncoherent} fiche(s), dont ${exVarIncoherent.join(' · ')}`
      + '\n     🔴 « Releve le 1er, change le 10 » se lit comme une contradiction.'
      + '\n        `varEtat` doit taire ce cas, pas l\'afficher.');

// ── ⑨ LES DEUX HORLOGES NE SONT PAS LA MEME ──────────────────────────────
// 🔴🔴 SANS CE CONTROLE, LE MUTANT LE PLUS PROBABLE PASSAIT. Un gabarit qui
// afficherait `item.releveLe` a la place de `item.derniereVariation` — copier la
// ligne d'a cote et oublier de changer le champ — sortait VERT sur les quatre
// controles precedents : l'attribut serait rempli, le texte concordant, la date
// jamais posterieure a elle-meme. La fiche afficherait deux fois la meme date
// sous deux libelles differents, et rien ne l'aurait dit.
// ⛔ LE SEUIL EST 1, PAS UN POURCENTAGE. La part de fiches ou les deux dates
// different depend de deux collecteurs : 91 % en production (13/08, 6 408
// pieces), 100 % hors ligne. Un banc cale sur cette part serait vert ici et
// rouge en prod sur du code sain — c'est la faute exacte qui a coute deux
// versions du §4. Ici on ne mesure pas une proportion, on mesure qu'un
// MECANISME peut produire deux dates differentes.
// → [[regle-banc-cale-sur-la-dispersion]] · [[regle-demande-juste-mecanisme-impuissant]]
// ⛔ LE GARDE PORTE SUR `nVarAff`, PAS SUR `nVarNoeud`, ET LE MUTANT M3 A
// TRANCHE ENTRE LES DEUX. Quand `dataset.mjs` cesse de projeter le champ, les
// blocs sont TOUS rendus (donc `nVarNoeud` = 90) et TOUS vides : ce controle-ci
// rougissait en accusant le gabarit d'une copie qu'il n'avait pas faite. La
// question « les deux dates different-elles ? » n'a d'objet que s'il existe au
// moins un COUPLE lisible — le mutant M5 (ancrage du releve retire) a montre que
// `nVarAff > 0` ne suffisait pas : les dates etaient la, l'autre bout manquait.
// → [[regle-banc-nomme-une-cause]] · [[regle-echantillon-ne-contient-pas]]
dit(nVarComparables === 0 || nVarDistinct > 0,
  nVarComparables === 0 ? 'SANS OBJET : aucun couple (variation, releve) lisible' : `${nVarDistinct} fiche(s) portent une variation DIFFERENTE de leur date de releve`,
  nVarDistinct > 0 ? null
    : 'AUCUNE : les deux dates sont toujours egales. Le gabarit affiche probablement'
      + '\n        `item.releveLe` sous le libelle de la variation — deux libelles, une'
      + '\n        seule horloge, et la fiche ment sur ce qu\'elle montre.');

// ── LA SOMME FAIT LE TOTAL, ICI AUSSI ─────────────────────────────────────
dit(nVarAff + nVarPost + nVarAbs + nVarMuet === nFiches,
  `la somme fait le total : ${nVarAff} + ${nVarPost} + ${nVarAbs} + ${nVarMuet} = ${nFiches}`,
  nVarAff + nVarPost + nVarAbs + nVarMuet === nFiches ? null
    : 'une fiche echappe au classement de la variation : le banc ne mesure pas ce qu\'il croit');

// ── ET LES AUTRES PAGES N'ONT PAS ETE CASSEES AU PASSAGE ──────────────────
// ⭐ 30 fichiers passent `updatedAt` a `Base` (blog, legales, plan du site) :
// pour eux « mis a jour le <build> » est EXACT. Un lot qui les priverait de
// leur date serait vert sur tout le reste. On compte ce qu'on n'a PAS voulu
// changer, pas seulement ce qu'on a change.
dit(nAutresDatees > 0,
  `${nAutresDatees} page(s) hors fiche gardent la date du deploiement, sur ${nAutres}`,
  nAutresDatees > 0 ? null
    : 'AUCUNE — le lot a retire la date des pages ou elle etait juste (blog, legales)');

console.log(ko === 0
  ? '\n✅ chaque fiche dit la date de SA donnee, ou dit qu\'elle ne la connait pas\n'
  : `\n🔴 ${ko} controle(s) en echec\n`);
process.exit(ko === 0 ? 0 : 1);
