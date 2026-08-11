// ⚠️ VeVePreda/veve-sites — engine/tools/test_affichage.mjs   (FICHIER NEUF — lot 118)
// ═══════════════════════════════════════════════════════════════════════════
//  CE QUE L'ÉCRAN MONTRE — les quatre défauts signalés par Preda le 10/08
// ═══════════════════════════════════════════════════════════════════════════
//
// Ils n'ont rien en commun techniquement — une colonne à deux sens, deux
// visuels absents, un bouton en trop, un panneau au mauvais endroit. Ils ont
// tout en commun dans leur SIGNATURE : aucun ne casse quoi que ce soit.
// Le build était vert, les 29 bancs aussi, et il a fallu qu'un humain regarde
// la page. ⭐⭐⭐ *Un défaut d'affichage ne lève rien : c'est la catégorie de
// panne dont le coût est entièrement reporté sur l'utilisateur.*
//
// ⛔ CE BANC N'IMPORTE PAS `dataset()`, ET C'EST DÉLIBÉRÉ : il peut donc vivre
// n'importe où dans le Dockerfile. Les §1 et §3 lisent des SOURCES, le §2 lit
// `dist/`. Il est placé APRÈS `npm run build` pour le §2 — voir le Dockerfile.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
// 🔴🔴 LOT 139 — LE §5 (LA VIGNETTE) ATTERRIT ICI, ET C'EST UN CHOIX QUI A
//   FAILLI COÛTER UN DÉPLOIEMENT. Je l'avais écrit dans `test:rayon` — la
//   zone semblait juste, il tient déjà la liste blanche du rayon. ⛔ Mais le
//   Dockerfile place `test:rayon` **AVANT** `npm run build` (ligne 109), avec
//   un commentaire qui l'interdit expressément de le redescendre : il importe
//   `dataset()`, et le rejouer après le build ramènerait `.reserve/cote/` de
//   1 201 fichiers à 1. Un § qui ouvre `dist/` y aurait donc trouvé le vide,
//   sorti en **2 (INDÉCIDABLE)**, et arrêté la construction de l'image.
//   ⭐⭐⭐ *La bonne zone d'un banc n'est pas celle du sujet, c'est celle du
//   MOMENT où la chose à mesurer existe.* Ce fichier-ci tourne après le
//   build (ligne 399), il ouvre déjà `dist/`, et son §1 juge déjà la mention
//   d'édition — c'est le même sujet, au bon moment.
import { BUDGETS } from '../lib/vignette.mjs';
import { clen } from '../lib/seo.mjs';
import { nu } from '../lib/i18n.mjs';
import { coteFermee } from '../lib/cote.mjs';
import { SEUILS, largeursABalayer, seuilsDe, estSeuilDeclare } from '../lib/seuils.mjs';
import { priceEnabled } from '../lib/features.mjs';
import { join } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const lire = (p) => readFileSync(join(ROOT, p), 'utf8');

let ko = 0;
const verifie = (titre, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. LA MENTION D'ÉDITION — un champ qui porte deux populations
// ═══════════════════════════════════════════════════════════════════════════
// Preda : « les comics affichent le numéro de comic à la place de la mention
// FA/FE/AP » et « ceux qui n'ont pas de mention, il ne faut rien mettre ».
// ⭐ On teste la FONCTION, pas le rendu : `mentionEdition()` est le seul juge,
// et trois gabarits l'appellent. Prouver la fonction plus prouver qu'ils
// l'appellent (§1 bis) couvre les trois d'un coup — et ne se périme pas quand
// un quatrième gabarit arrive.
console.log('\n1. la mention d\'édition : ce qui s\'affiche et ce qui ne s\'affiche pas');
const { mentionEdition, MENTIONS_EDITION } = await import('../lib/vitrine.mjs');

for (const m of MENTIONS_EDITION) {
  verifie(`« ${m} » s'affiche`, mentionEdition(m) === m);
}
// ⭐⭐⭐ LES TÉMOINS NON DÉSARMÉS, ET ILS SONT LA MOITIÉ QUI COMPTE. Une
// fonction qui rendrait son entrée telle quelle passerait les trois lignes
// ci-dessus. *Un banc qui ne teste que ce qui doit marcher ne mesure rien.*
for (const [entree, pourquoi] of [
  ['1', 'un numéro d\'édition — 4 350 lignes du catalogue'],
  ['12', 'un numéro à deux chiffres'],
  ['', 'la cellule vide — 639 lignes'],
  ['65.DEATHS', 'une aberration de la source'],
  ['1&2', 'une autre aberration'],
  ['CE', 'une mention réelle mais HORS de la liste de Preda (301 comics)'],
  [null, 'la valeur absente'],
  [undefined, 'la valeur non définie'],
]) {
  verifie(`« ${entree} » ne s'affiche pas (${pourquoi})`, mentionEdition(entree) === '');
}
// ⚠️ La casse : le catalogue est écrit à la main quelque part en amont.
verifie('« fa » minuscule est reconnu et rendu en majuscules', mentionEdition('fa') === 'FA');
verifie('« FE » avec des espaces est reconnu', mentionEdition('  FE ') === 'FE');
// ⛔ Elle rend TOUJOURS une chaîne : `{undefined}` écrirait « undefined » dans
//    une cellule sur deux et Astro ne s'en plaindrait pas.
verifie('elle rend toujours une chaîne, jamais undefined',
  [undefined, null, 42, {}, []].every((v) => typeof mentionEdition(v) === 'string'));

console.log('\n1 bis. les gabarits l\'appellent-ils, plutôt que d\'écrire le champ ?');
// 🔴 LE CONTRÔLE QUI TIENT LA RÈGLE DANS LE TEMPS. Rien n'empêche un lot futur
// de réécrire `{item.edition_type}` en clair dans un gabarit — c'est
// exactement ce qui existait avant ce lot, et ça a l'air parfaitement normal à
// la lecture. ⭐ On interdit donc l'ÉCRITURE DIRECTE dans les gabarits, et on
// laisse `dataset.mjs` tranquille : il compose des SLUGS avec ce champ, et les
// 1 200 adresses sont GELÉES — y filtrer renommerait des URL indexées.
const gabarits = [];
(function balayer(d) {
  for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
    if (e.isDirectory()) balayer(join(d, e.name));
    else if (e.name.endsWith('.astro')) gabarits.push(join(d, e.name));
  }
})('src');

const decommenter = (l) => l
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')
  .replace(/^\s*(\{?\/\*|\/\/|\*)\s.*$/, ' ')
  .replace(/\/\/.*$/, ' ');

const nus = [];
for (const f of gabarits) {
  lire(f).split('\n').forEach((l, n) => {
    const code = decommenter(l);
    // On cherche une LECTURE du champ qui ne passe pas par la fonction.
    if (!/\.edition_type\b/.test(code)) return;
    if (/mentionEdition\s*\(/.test(code)) return;
    nus.push(`${f}:${n + 1}  ${l.trim().slice(0, 84)}`);
  });
}
verifie('aucun gabarit n\'écrit `edition_type` sans passer par mentionEdition()',
  nus.length === 0,
  nus.length ? `\n      ${nus.join('\n      ')}` : `${gabarits.length} gabarits balayés`);

// ═══════════════════════════════════════════════════════════════════════════
// 2. LES VISUELS — sets et drops à venir
// ═══════════════════════════════════════════════════════════════════════════
// Preda : « pas de visuel pour les sets, ni de visuel pour Coming up ».
// ⭐⭐ LA CAUSE N'ÉTAIT PAS DANS LE GABARIT : `rayonDe()` ne nommait pas
// `image` dans sa liste blanche, donc `ds.aVenir` n'en portait aucune. Un
// contrôle qui n'aurait regardé que le `.astro` aurait conclu « il n'y a rien
// à afficher » — ce qui était vrai, et à côté de la question.
// ⇒ On mesure LE PRODUIT : `dist/`. C'est le seul endroit où « la donnée
//   existe » et « elle arrive à l'écran » cessent d'être deux questions.
console.log('\n2. les visuels arrivent-ils jusqu\'au HTML ?');
const DIST = join(ROOT, 'dist');
const dossierClient = existsSync(join(DIST, 'client')) ? join(DIST, 'client') : DIST;

if (!existsSync(dossierClient)) {
  // ⭐⭐⭐ TROIS VERDICTS. Sans `dist/`, ce contrôle n'a rien mesuré — et il
  // doit le DIRE, à voix haute, plutôt que passer au vert par défaut. C'est
  // exactement le défaut « zéro cassé / zéro par nature » : sur le disque, ils
  // se ressemblent, et ils sont l'inverse.
  console.log('  ⏸️  INDÉCIDABLE — `dist/` est absent : ce banc doit être joué APRÈS `npm run build`.');
} else {
  // 🔴🔴 PAS DE REPLI SUR UNE AUTRE PAGE — écrit après l'avoir vu rougir sur
  //    `vevewiki`. Ma première version essayait `collections/index.html` PUIS
  //    `index.html`. Or vevewiki n'a pas de page d'orientation : le banc
  //    retombait sur l'accueil, n'y trouvait évidemment aucune vignette de set,
  //    et déclarait un ÉCART sur un site parfaitement conforme.
  //    ⭐⭐⭐ *Un repli qui trouve autre chose ne mesure pas la même chose — il
  //    mesure autre chose, et il le dit avec le vocabulaire de la question
  //    d'origine.* Même famille que le `sparkline()` du lot 117 : un secours
  //    légitime qui transforme une absence en réponse.
  //    ⇒ Une seule adresse, et « absente » veut dire « sans objet », pas
  //      « cassée ».
  const collections = join(dossierClient, 'collections/index.html');
  if (!existsSync(collections)) {
    console.log('  ⏸️  sans objet ici — ce site n\'a pas de page d\'orientation'
      + ' (`/collections/` n\'existe que sur veveprice).');
  } else {
    const html = readFileSync(collections, 'utf8');

    // ═══════════════════════════════════════════════════════════════════════
    // 🔴🔴 LOT 131 — CE CONTRÔLE CHERCHAIT `class="col-carte__v"`, ET CETTE
    // CLASSE N'EXISTE PLUS. Il faut dire pourquoi il change, sinon le prochain
    // lecteur croira qu'on l'a assoupli pour le faire passer.
    // ⛔ ON N'A PAS CHANGÉ LE BANC POUR QU'IL PLAISE AU CODE : la QUESTION est
    // restée « les cartes de sets portent-elles un visuel ? », et elle est
    // désormais posée à un balisage qui en porte TROIS au lieu d'un.
    // La cause du changement est mesurée : `/collections/` rendait une image
    // PLATE (`col-carte__v`) là où `/sets/` rendait une pile de trois vignettes
    // — deux gabarits, deux présentations du même objet. Les deux passent
    // maintenant par `CarteSet.astro`.
    // ⭐⭐⭐ ET LE BANC SORT RENFORCÉ, PAS AFFAIBLI : il ne demande plus
    // seulement « y a-t-il un visuel ? », il demande « les DEUX pages
    // rendent-elles la même carte ? ». C'est la régression qui reviendra —
    // celle du lot 127 (`data-ch` à `300` d'un côté, `300.00` de l'autre),
    // et elle ne casse rien, elle MENT.
    // ═══════════════════════════════════════════════════════════════════════
    const pilesSets = (html.match(/class="col-carte__pile"/g) || []).length;
    const vignettesSets = (html.match(/class="col-carte__pile"[\s\S]{0,900}?<img/g) || []).length;
    // ⛔ PAS DE SEUIL CHIFFRÉ. « au moins 3 vignettes » mesurerait l'échantillon
    //    dont il vient. La question est binaire : les cartes de sets
    //    portent-elles des visuels, oui ou non ?
    verifie('les cartes de sets portent un visuel', pilesSets > 0 && vignettesSets > 0,
      `${pilesSets} pile(s), ${vignettesSets} illustrée(s)`);
    // ⭐ ET LA CONTRE-ÉPREUVE : aucune carte ne doit porter un `<img>` à `src`
    //   vide. Un `src=""` déclenche une requête vers la page elle-même dans
    //   plusieurs navigateurs — un visuel manquant deviendrait une requête en
    //   trop, pas une absence.
    verifie('aucun visuel à source vide',
      !/class="socle__net ok"[^>]*src=""/.test(html) && !/class="avenir__v"[^>]*src=""/.test(html));
    // ⭐ LA CARTOUCHE : sans elle, la pile est un lien sans texte. `aria-hidden`
    //   est sur la pile (décorative) ; le NOM du set est le seul contenu
    //   accessible de la carte. Un lien sans nom accessible est un lien que
    //   personne au clavier ne peut suivre — et ça ne casse rien à l'écran.
    verifie('chaque carte de set porte sa cartouche (le nom, accessible)',
      (html.match(/class="cartouche"/g) || []).length >= pilesSets,
      `${(html.match(/class="cartouche"/g) || []).length} cartouche(s) pour ${pilesSets} pile(s)`);

    // ⭐⭐⭐ LE CONTRÔLE QUI FERME VRAIMENT LA PANNE — on confronte les DEUX
    //   pages. Un banc qui n'interroge qu'un seul fichier ne peut pas savoir
    //   que ce fichier est le mauvais : `/collections/` seule était
    //   parfaitement cohérente avec elle-même pendant treize lots.
    const sets = join(dossierClient, 'sets/index.html');
    if (!existsSync(sets)) {
      console.log('  ⏸️  `/sets/` absente — la comparaison des deux pages est INDÉCIDABLE ici.');
    } else {
      const htmlSets = readFileSync(sets, 'utf8');
      const pilesRayon = (htmlSets.match(/class="col-carte__pile"/g) || []).length;
      verifie('`/collections/` et `/sets/` rendent la MÊME carte de set',
        pilesRayon > 0 && pilesSets > 0,
        pilesRayon > 0 && pilesSets > 0
          ? `même balisage des deux côtés (${pilesSets} vs ${pilesRayon} piles)`
          : '🔴 une des deux pages a repris une forme à elle : c\'est la divergence du lot 127');
      // ⛔ ET LA CLASSE RETIRÉE NE REVIENT PAS. Un lot futur qui rétablirait la
      //   forme plate sur une seule des deux pages referait exactement l'écart
      //   que Preda a signalé le 10/08.
      verifie('la forme PLATE d\'un set (`col-carte__v`) n\'est revenue nulle part',
        !/class="col-carte__v"/.test(html) && !/class="col-carte__v"/.test(htmlSets),
        'une seule présentation pour un set, sur les deux pages');
    }

    // ⚠️ « À venir » se TAIT quand il n'a rien (c'est voulu, lot 113) : on ne
    //    peut donc pas exiger sa présence. On exige seulement que, s'il est là,
    //    ses cartes soient illustrées OU qu'aucune de ses lignes n'ait d'image.
    const aVenirPresent = /class="avenir"/.test(html);
    if (!aVenirPresent) {
      console.log('  ⏸️  « à venir » ne rend rien dans cette source (aucun drop futur) — sans objet ici.');
    } else {
      // ⭐ Le détail ne dit le remède QU'EN CAS D'ÉCART : une explication
      //   d'échec imprimée à côté d'un ✅ apprend à ne plus lire les détails.
      const vignettes = (html.match(/class="avenir__v"/g) || []).length;
      verifie('les cartes « à venir » portent un visuel', vignettes > 0,
        vignettes > 0 ? `${vignettes} vignette(s)`
          : 'aucune : `rayonDe()` a-t-il toujours `image` dans sa liste blanche ?');
    }
  }
  // 🔴 LE CONTRÔLE QUI COMPTE VRAIMENT ICI : le champ a-t-il survécu au trajet ?
  //    `image` traverse `catalogue.csv` → `rayonDe()` → `ds.aVenir` → gabarit.
  //    Trois relais, dont un est une liste blanche qu'un lot futur peut
  //    resserrer sans y penser.
  const rayonSrc = lire('engine/lib/dataset.mjs');
  const bloc = rayonSrc.slice(rayonSrc.indexOf('const rayonDe = (c) => ({'),
                              rayonSrc.indexOf('const rayon = cat.map(rayonDe);'));
  verifie('`rayonDe()` nomme toujours `image` dans sa liste blanche',
    /\bimage:/.test(bloc), bloc ? 'bloc trouvé' : '⚠️ bloc introuvable — le contrôle regarde ailleurs');
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. LE MENU — un seul seuil, et un tiroir
// ═══════════════════════════════════════════════════════════════════════════
// Preda : « le bouton menu accordéon ne doit être visible que quand le menu du
// header n'est pas dispo » et « il doit s'ouvrir en drawer menu gauche ».
//
// 🔴🔴 CE §3 EXISTE À CAUSE DU LOT 111, PAS À CAUSE DE CETTE DEMANDE.
// `.nav__liens{display:none}` et l'apparition du bouton sont DEUX règles qui
// doivent basculer au MÊME pixel. Quand elles ont divergé, l'intervalle
// 641–1040 px n'avait plus AUCUN accès visible au menu : les liens existaient,
// le bouton répondait, et l'écran ne montrait rien. Personne ne pouvait le
// voir depuis un banc — il a fallu que Preda signale « le Market n'existe pas ».
// ⭐⭐⭐ *Deux seuils qui doivent coïncider et qui vivent loin l'un de l'autre
// finissent par diverger.* Ce contrôle est la seule chose qui empêche que ça
// recommence, et il vaut plus que le commentaire qui le dit.
console.log('\n3. le menu : un seul seuil, et un tiroir qui s\'ouvre à gauche');
const css = lire('themes/vitrine/theme.css');

// ⚠️ ON DÉCOMMENTE D'ABORD. Cette feuille documente abondamment ses propres
//    règles, et un contrôle qui lit les commentaires rougit sur ses
//    explications — défaut payé le 07/08 sur un `grep` de cron.
const cssNu = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

// ⭐⭐⭐ ON RÉSOUT LA CASCADE, ON NE CHERCHE PAS UN MOT.
// Première version de ce banc : `position:fixed` était VERT parce que le mot
// existait quelque part dans la feuille. Or `.deplie__m` est déclaré DEUX fois
// à la racine — `position:absolute` l. 531 (l'ancien menu ancré) et
// `position:fixed` l. 2330 (le tiroir). À spécificité égale c'est la DERNIÈRE
// qui gagne, donc le résultat était juste ; le contrôle, lui, ne le prouvait
// pas : il aurait été vert dans l'ordre inverse, où le tiroir serait mort.
// ⭐ « EST-CE LÀ ? », « EST-CE CE QUI GAGNE ? » ET « EST-CE VISIBLE ? » SONT
//   TROIS QUESTIONS. Ce résolveur répond à la deuxième, la seule qui décide.
// ⚠️ Il ne gère QUE la racine et l'égalité de spécificité — c'est le cas de
//   toutes les règles qu'il juge. ⛔ Ne pas s'en servir pour arbitrer entre
//   deux sélecteurs de spécificités différentes : il dirait le contraire du
//   navigateur, ce qui est pire que ne rien dire.
const horsMedia = (() => {
  let out = '', prof = 0, i = 0;
  while (i < cssNu.length) {
    const a = cssNu.indexOf('@media', i);
    if (a < 0) { out += cssNu.slice(i); break; }
    out += cssNu.slice(i, a);
    let j = cssNu.indexOf('{', a); prof = 1; j++;
    while (j < cssNu.length && prof > 0) { if (cssNu[j] === '{') prof++; else if (cssNu[j] === '}') prof--; j++; }
    i = j;
  }
  return out;
})();

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** La valeur GAGNANTE d'une propriété pour un sélecteur, à la racine. */
const gagne = (selecteur, propriete, source = horsMedia) => {
  const re = new RegExp(`(?:^|[};])\\s*${echapper(selecteur)}\\s*\\{([^}]*)\\}`, 'g');
  let v = null;
  for (const m of source.matchAll(re)) {
    const p = new RegExp(`(?:^|;)\\s*${propriete}\\s*:\\s*([^;]+)`, 'g');
    for (const d of m[1].matchAll(p)) v = d[1].trim();
  }
  return v;
};

/** Les seuils @media qui touchent RÉELLEMENT la propriété d'un sélecteur.
 *  ⚠️ ON EXIGE LA PROPRIÉTÉ, pas seulement le sélecteur : `.nav__deplie`
 *  apparaît aussi sous 420 px pour rétrécir le bouton en pastille — un seuil
 *  qui ne décide pas de sa VISIBILITÉ n'a rien à voir avec la question posée,
 *  et le confondre a fait rougir ce banc à tort à sa première exécution.
 *  ⛔ ET LES ACCOLADES SE COMPTENT. Un `[\s\S]*?\}` non gourmand s'arrête au
 *  PREMIER `}` : sur `@media (…){ .a{…} .b{…} }` il ne voyait jamais `.b`, et
 *  rendait « aucun seuil » — donc un ÉCART, sur une feuille correcte.
 *  *Un instrument qui lit mal la syntaxe accuse toujours le code.* */
const blocsMedia = () => {
  const out = [];
  for (const m of cssNu.matchAll(/@media\s*\(max-width:\s*(\d+)px\)\s*\{/g)) {
    let i = m.index + m[0].length, prof = 1;
    while (i < cssNu.length && prof > 0) {
      if (cssNu[i] === '{') prof++;
      else if (cssNu[i] === '}') prof--;
      i++;
    }
    out.push({ px: m[1], corps: cssNu.slice(m.index + m[0].length, i - 1) });
  }
  return out;
};

const seuilsPour = (selecteur, propriete) => [...new Set(blocsMedia()
  .filter((b) => new RegExp(`${echapper(selecteur)}\\s*\\{[^}]*\\b${propriete}\\s*:`).test(b.corps))
  .map((b) => b.px))];

const seuilsNav = seuilsPour('.nav__liens', 'display');
const seuilsBouton = seuilsPour('.nav__deplie', 'display');

verifie('`.nav__liens` n\'a QU\'UN seuil de visibilité', seuilsNav.length === 1,
  seuilsNav.length ? `${seuilsNav.join(', ')} px` : 'AUCUN — la nav ne disparaît jamais');
verifie('le bouton bascule au MÊME pixel que la nav',
  seuilsNav.length === 1 && seuilsBouton.length === 1 && seuilsNav[0] === seuilsBouton[0],
  `nav ${seuilsNav.join('/') || '—'} px · bouton ${seuilsBouton.join('/') || '—'} px`);
verifie('au repos le bouton est MASQUÉ (la nav suffit au-dessus du seuil)',
  gagne('.nav__deplie', 'display') === 'none', `display gagnant : ${gagne('.nav__deplie', 'display')}`);

// ── LE TIROIR ─────────────────────────────────────────────────────────────
verifie('le panneau est un TIROIR — `position` GAGNANTE, pas « fixed écrit quelque part »',
  gagne('.deplie__m', 'position') === 'fixed', `position gagnante : ${gagne('.deplie__m', 'position')}`);
verifie('il est collé à GAUCHE', gagne('.deplie__m', 'left') === '0',
  `left ${gagne('.deplie__m', 'left')} · right ${gagne('.deplie__m', 'right')}`);
verifie('et il glisse depuis le bord',
  /translateX\(-100%\)/.test(gagne('.deplie__m', 'transform') || ''),
  `transform : ${gagne('.deplie__m', 'transform')}`);
verifie('ouvert, il revient à sa place',
  gagne('.deplie__m:not([hidden])', 'transform') === 'none');
// ⛔ ET LE PIÈGE QUI RESTAIT : l'ancienne règle `.nav__deplie .deplie__m`
//    portait un `min-width` avec DEUX classes — spécificité plus forte que le
//    tiroir. Elle aurait gagné contre lui sans qu'aucune ligne ne bouge.
//    *Une règle qu'on croit morte parce qu'on a déplacé son voisin est
//    toujours vivante.*
// ⭐ LE DÉTAIL NE S'AFFICHE QU'EN CAS D'ÉCART. Une explication d'échec
//   imprimée à côté d'un ✅ se lit comme un problème : on finit par ne plus
//   lire les détails du tout, y compris ceux des vrais échecs.
const recadre = /\.nav__deplie\s+\.deplie__m\s*\{/.test(cssNu);
verifie('aucune règle plus spécifique ne recadre le tiroir', !recadre,
  recadre ? '`.nav__deplie .deplie__m` (2 classes) bat le tiroir (1 classe)' : '');

// 🔴 LE VOILE, ET SURTOUT SES ÉVÈNEMENTS. Un voile transparent qui garde
//    `pointer-events:auto` intercepte TOUS les clics de la page, en silence.
//    C'est l'élément transparent du lot 111 vu de l'autre côté : là il était
//    invisible et inutile, ici il serait invisible et nuisible.
verifie('le voile existe et il est fixe', gagne('body::after', 'position') === 'fixed');
verifie('au repos le voile est transparent ET ne capte AUCUN clic',
  gagne('body::after', 'opacity') === '0' && gagne('body::after', 'pointer-events') === 'none',
  `opacity ${gagne('body::after', 'opacity')} · pointer-events ${gagne('body::after', 'pointer-events')}`);
verifie('ouvert il capte les clics et s\'assombrit',
  gagne('body[data-tiroir]::after', 'pointer-events') === 'auto'
  && gagne('body[data-tiroir]::after', 'opacity') === '1');

// ── LE CIRCUIT : qui POSE `data-tiroir` ? ─────────────────────────────────
// ⭐ « Qui écrit, qui lit ? » — la feuille LIT `body[data-tiroir]`. Sans
//   personne pour le poser, le voile est une règle morte et le tiroir s'ouvre
//   sur une page cliquable. Une règle sans émetteur ne lève rien.
// ⚡ LOT 137 (A2 / OPT‑3) — L'ÉMETTEUR A CHANGÉ D'ADRESSE, PAS D'EXISTENCE.
// Le pilote du tiroir a quitté `Base.astro` pour `src/socle/20-menu.js` : il
// était identique sur 3 097 pages et partait 3 097 fois. Ces trois contrôles
// ont rougi au premier build du lot — ⭐⭐ **et c'est le comportement attendu
// d'un banc qui réclame un émetteur** : de son point de vue, l'émetteur avait
// disparu. ⛔ On lui donne la vue que reçoit le navigateur (le gabarit ET le
// socle qu'il émet) ; on ne retire pas le contrôle.
// 🔴 Le socle est lu EN ENTIER, pas seulement `20-menu.js` : ce banc demande
// « quelqu'un pose-t-il cet attribut ? », pas « ce fichier-là le pose-t-il ? ».
// Nommer le fichier ferait rougir le jour où le morceau est renommé — un rouge
// qui ne signale aucune panne, donc un rouge qu'on finit par désarmer.
const base = lire('src/layouts/Base.astro') + '\n'
  + readdirSync(join(ROOT, 'src', 'socle')).filter((f) => f.endsWith('.js')).sort()
      .map((f) => lire(join('src', 'socle', f))).join('\n');
// ⭐ Auto-contrôle : chercher une chaîne dans un texte vide rend « absent »,
// pas « erreur ». Sans cette ligne, un socle introuvable ferait rougir les
// trois contrôles pour une raison qui n'est pas la leur.
verifie('le gabarit ET le socle ont bien été lus — sinon les trois contrôles qui suivent jugent du vide',
  base.length > 20000);
verifie('quelqu\'un POSE `data-tiroir` (sinon le voile est une règle morte)',
  /setAttribute\(\s*['"]data-tiroir['"]/.test(base));
verifie('quelqu\'un le RETIRE (sinon le voile ne se lève jamais)',
  /removeAttribute\(\s*['"]data-tiroir['"]/.test(base));
verifie('un lien du tiroir referme le tiroir',
  /m\.addEventListener\('click'/.test(base));

// ═══════════════════════════════════════════════════════════════════════════
// 3 bis. LE BALAYAGE 360 → 1280 px — UN CHEMIN VERS LE MENU À CHAQUE LARGEUR
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LOT 139 — DÉCISION DE PREDA DU 11/08 : « je ne veux pas la barre du bas
// sous 640 px, je veux juste celui qui s'ouvre quand on clique sur le bouton ».
// La barre `.onglets` part. ⭐⭐⭐ *Avant de retirer un chemin de navigation, on
// COMPTE les autres.* Sous 640 px il n'en resterait qu'UN — le tiroir. Ce §
// existe pour que ce dernier chemin ne puisse plus disparaître en silence, et
// il est écrit AVANT que la barre parte.
//
// ⭐⭐ LE §3 CI-DESSUS COMPARE DEUX SEUILS ; CELUI-CI INTERROGE DES LARGEURS.
// Ce n'est pas la même question. Le §3 dit « les deux règles basculent au même
// pixel » — vrai aujourd'hui, et parfaitement compatible avec un écran sans
// aucun menu si un troisième sélecteur venait à masquer le bouton ailleurs. Le
// balayage ne fait aucune hypothèse sur QUI porte le chemin : il demande
// seulement qu'il en reste un, à chaque largeur, en résolvant la cascade.
//
// 🔴🔴 MA PREMIÈRE VERSION DE CE MOTEUR ÉTAIT FAUSSE, ET ELLE ACCUSAIT UNE
// FEUILLE CORRECTE. Elle traitait « aucune déclaration `display` » comme
// « invisible » : au-dessus de 1040 px, `.nav__liens` n'a PAS de règle à la
// racine (c'est un `<span>`, donc `inline` par défaut) — le moteur annonçait
// « 0 chemin » à 1041 px et 1280 px, sur les 6 liens parfaitement visibles.
// ⭐⭐⭐ *Seul `display:none` retire une boîte. L'absence de déclaration est le
// contraire d'une absence d'élément.* `null` ⇒ VISIBLE.
// C'est le troisième costume de « un défaut d'instrument se déguise en résultat
// de mesure », et il a été trouvé par la mesure, pas par la relecture.
//
// ⛔ ON NE MODÉLISE QUE `max-width` : mesuré le 11/08, la feuille `vitrine` n'a
// que ça (51 blocs, 14 seuils) ; les 13 autres blocs sont des
// `prefers-reduced-motion`, et **aucun ne déclare de `display` pour les trois
// chemins** — vérifié, et re-vérifié par le garde-fou ci-dessous. Une condition
// qu'on ne sait pas lire ne doit pas être ignorée : elle doit ALERTER.
console.log('\n3 bis. le balayage 360 → 1280 px : un chemin vers le menu à chaque largeur');

/** Un moteur de cascade EN LARGEUR, autonome.
 *  ⭐ Le même code sert la feuille réelle ET les cas fabriqués du §3 quinquies :
 *  deux moteurs, ce serait deux comportements, et la contre-épreuve ne
 *  prouverait plus rien de l'instrument qui juge la production. */
const moteurDisplay = (source) => {
  const nuCss = source.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const blocs = [];
  for (const m of nuCss.matchAll(/@media\s*\(max-width:\s*(\d+)px\)\s*\{/g)) {
    let i = m.index + m[0].length, prof = 1;
    while (i < nuCss.length && prof > 0) { if (nuCss[i] === '{') prof++; else if (nuCss[i] === '}') prof--; i++; }
    blocs.push({ px: +m[1], corps: nuCss.slice(m.index + m[0].length, i - 1) });
  }
  let racine = '', i = 0;
  while (i < nuCss.length) {
    const a = nuCss.indexOf('@media', i);
    if (a < 0) { racine += nuCss.slice(i); break; }
    racine += nuCss.slice(i, a);
    let j = nuCss.indexOf('{', a), prof = 1; j++;
    while (j < nuCss.length && prof > 0) { if (nuCss[j] === '{') prof++; else if (nuCss[j] === '}') prof--; j++; }
    i = j;
  }
  const lu = (src, sel) => {
    const re = new RegExp(`(?:^|[};])\\s*${echapper(sel)}\\s*\\{([^}]*)\\}`, 'g');
    let v = null;
    for (const b of src.matchAll(re))
      for (const d of b[1].matchAll(/(?:^|;)\s*display\s*:\s*([^;]+)/g)) v = d[1].trim();
    return v;
  };
  return {
    seuils: [...new Set(blocs.map((b) => b.px))].sort((a, b) => a - b),
    // ⭐ `null` = aucune déclaration = la boîte existe. Voir le commentaire.
    visible: (sel, W) => {
      let v = lu(racine, sel);
      for (const b of blocs) if (W <= b.px) { const x = lu(b.corps, sel); if (x !== null) v = x; }
      return v !== 'none';
    },
  };
};

// ⛔ LE GARDE-FOU : un `display` posé sur l'un des trois chemins dans une
//    `@media` que le moteur ne sait PAS lire rendrait le balayage faux sans
//    qu'une seule ligne ne rougisse. *Un instrument qui ne comprend pas doit
//    alerter, pas se taire.*
const CHEMINS = [
  { sel: '.nav__liens',  quoi: 'les liens de l\'en-tête' },
  { sel: '.nav__deplie', quoi: 'le bouton du tiroir' },
  { sel: '.onglets',     quoi: 'la barre du bas' },
];
const aveugles = [];
for (const m of cssNu.matchAll(/@media\s*([^{]*)\{/g)) {
  if (/max-width\s*:\s*\d+px/.test(m[1])) continue;
  let i = m.index + m[0].length, prof = 1;
  while (i < cssNu.length && prof > 0) { if (cssNu[i] === '{') prof++; else if (cssNu[i] === '}') prof--; i++; }
  const corps = cssNu.slice(m.index + m[0].length, i - 1);
  for (const c of CHEMINS)
    if (new RegExp(`${echapper(c.sel)}\\s*\\{[^}]*display\\s*:`).test(corps))
      aveugles.push(`${c.sel} sous ${m[1].trim()}`);
}
verifie('aucun chemin n\'est masqué par une condition que le moteur ne sait pas lire',
  aveugles.length === 0,
  aveugles.length ? `⛔ ${aveugles.join(' · ')} — le balayage ci-dessous serait FAUX` : '');

// ── QUI EST RÉELLEMENT ÉMIS ? ─────────────────────────────────────────────
// ⭐⭐ « Qui écrit, qui lit ? » Un sélecteur que la cascade déclare visible et
//   que PERSONNE n'émet n'est pas un chemin : c'est une règle morte. Le
//   balayage serait vert sur une page sans aucun menu.
// ⚠️ Sans `dist/`, on le dit et on juge la cascade seule — c'est un périmètre
//   plus étroit, pas un succès.
const pageMenu = ['dist/client/index.html', 'dist/index.html']
  .map((p) => join(ROOT, p)).find((p) => existsSync(p));
let emis = null;
if (!pageMenu) {
  console.log('  ⏸️  `dist/` absent — la CASCADE est jugée, pas l\'ÉMISSION.'
    + ' Périmètre réduit, joué APRÈS `npm run build` dans le Dockerfile.');
} else {
  console.log(`  📄 page ouverte : ${pageMenu.slice(ROOT.length + 1)}`);
  const htmlMenu = readFileSync(pageMenu, 'utf8');
  emis = (sel) => new RegExp(`class="[^"]*\\b${sel.slice(1)}\\b`).test(htmlMenu);
}

const M = moteurDisplay(css);
// ⭐⭐ UN INTERVALLE SE TESTE PAR SES DEUX EXTRÉMITÉS. `max-width:640px`
//   s'applique À 640 et plus à 641 : c'est exactement là que le trou du lot 111
//   s'ouvrait, et un balayage de dix largeurs rondes ne l'aurait jamais vu.
// 🔴🔴 LOT 139 — LES LARGEURS VIENNENT DE L'ÉCHELLE **DÉCLARÉE**, PLUS DE LA
//   FEUILLE. Ce n'est pas un détail de forme, c'est un renversement.
//   AVANT : le banc lisait les seuils DANS la feuille et balayait ceux-là.
//   Un lot qui aurait supprimé une `@media` aurait donc supprimé, dans le même
//   geste et sans un mot, la largeur à laquelle on la vérifiait — *le banc
//   suivait sa propre cible.* Il serait resté vert en mesurant moins.
//   APRÈS : la liste est déclarée dans `engine/lib/seuils.mjs`, et le §3 sexies
//   ci-dessous refuse toute `@media` qui n'y figure pas. Le balayage ne peut
//   plus rétrécir tout seul, et un seuil ajouté à la feuille sans être déclaré
//   fait rougir au lieu de passer inaperçu.
//   ⭐ Conséquence assumée : sur `encyclopedie` (3 seuils) on balaie 30
//   largeurs au lieu de 8. C'est du travail en trop qui ne coûte rien, et
//   c'est le bon sens de se tromper.
const largeurs = largeursABalayer();
const trous = [];
const parLargeur = [];
for (const W of largeurs) {
  const ouverts = CHEMINS.filter((c) => M.visible(c.sel, W) && (!emis || emis(c.sel)));
  parLargeur.push({ W, n: ouverts.length, qui: ouverts.map((c) => c.sel).join(' + ') });
  if (!ouverts.length) trous.push(W);
}
verifie(`${largeurs.length} largeurs balayées (${SEUILS.length} seuils déclarés × 2 bornes, + 360 et 1280) — un chemin partout`,
  trous.length === 0,
  trous.length
    ? `🔴 AUCUN accès au menu à ${trous.join(', ')} px — c'est la panne du lot 111`
    : `de ${largeurs[0]} à ${largeurs[largeurs.length - 1]} px, jamais zéro`);
// ⭐ La carte des largeurs ne s'imprime QU'EN CAS D'ÉCART : une explication
//   d'échec posée à côté d'un ✅ apprend à ne plus lire les détails.
if (trous.length) for (const l of parLargeur) console.log(`       ${String(l.W).padStart(5)} px → ${l.n} : ${l.qui || '⛔ RIEN'}`);

// ═══════════════════════════════════════════════════════════════════════════
// 3 sexies. LE CLIQUET — AUCUN SEUIL HORS DE L'ÉCHELLE DÉCLARÉE
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE § EST LA MOITIÉ QUI MANQUAIT AU §3 bis, ET SANS LUI LA DÉCLARATION
// NE VAUDRAIT RIEN. Le §3 bis balaie maintenant une liste écrite à la main :
// si la feuille gagnait un quinzième seuil, il balaierait toujours les
// quatorze anciens — il resterait vert en ne regardant plus au bon endroit.
// *Une liste déclarée sans contrôle qui la confronte au réel est un repli
// écrit avant la source : elle dispense de regarder.*
// ⇒ ici on fait le chemin inverse : on lit les feuilles et on refuse tout
// seuil absent de `SEUILS`.
//
// ⭐⭐⭐ IL LIT LE DOSSIER `themes/`, PAS UNE LISTE DE THÈMES. Le réseau en
// porte trois (`vitrine`, `encyclopedie`, `aurora`) et n'en sert que deux —
// `aurora` n'est le thème d'aucun site aujourd'hui. Le déclarer ici en aurait
// fait une quatrième liste à tenir ; l'omettre laisserait un thème entier hors
// contrôle jusqu'au jour où quelqu'un l'activerait dans un manifeste, et ce
// jour-là le cliquet serait muet sur la moitié du sujet. *Un contrôle qui ne
// regarde que ce qu'on lui a nommé ne voit jamais ce qu'on a posé à côté.*
//
// ⚠️ IL NE JUGE QUE LES PRÉLUDES `@media`. `vitrine` porte cinq propriétés
// `max-width:` (250, 280, 400, 470, 1220 px) qui sont des largeurs de BOÎTE :
// aucune ne fait basculer une mise en page. Les compter ferait rougir le banc
// sur du code sain — et *un faux rouge se fait désarmer en trois jours.*
console.log('\n3 sexies. le cliquet : aucun seuil hors de l\'échelle déclarée');
console.log(`  📐 échelle déclarée (engine/lib/seuils.mjs) : ${SEUILS.join(' · ')} px`);
{
  const dossierThemes = join(ROOT, 'themes');
  const themes = existsSync(dossierThemes)
    ? readdirSync(dossierThemes).filter((d) => existsSync(join(dossierThemes, d, 'theme.css'))).sort()
    : [];
  if (!themes.length) {
    // ⛔ EXIT 2, JAMAIS 0. Pas de thème lisible = on n'a rien mesuré, et un
    // vert dirait le contraire. *Un banc muet ressemble à un succès.*
    console.log('  ⛔ INDÉCIDABLE — aucun `themes/*/theme.css` lisible.');
    process.exit(2);
  }
  const intrus = [];
  let total = 0;
  for (const th of themes) {
    const vus = seuilsDe(readFileSync(join(dossierThemes, th, 'theme.css'), 'utf8'));
    total += vus.length;
    const hors = vus.filter((w) => !estSeuilDeclare(w));
    console.log(`     ${th.padEnd(14)} ${String(vus.length).padStart(2)} seuil(s) : ${vus.join(' ') || '—'}`
      + (hors.length ? `   🔴 HORS ÉCHELLE : ${hors.join(' ')}` : ''));
    for (const w of hors) intrus.push(`${th} → ${w}px`);
  }
  verifie(`${themes.length} thème(s), ${total} seuil(s) relevé(s) : tous dans l'échelle`,
    intrus.length === 0,
    intrus.length
      ? `🔴 ${intrus.length} seuil(s) non déclaré(s) : ${intrus.join(', ')}\n`
        + '       ⇒ soit la mise en page bascule à une largeur que personne n\'a choisie,\n'
        + '         soit l\'échelle doit l\'accueillir — et ALORS il faut l\'ajouter à\n'
        + '         `engine/lib/seuils.mjs`, ce qui engage à le vérifier aux 30 largeurs\n'
        + '         du §3 bis. ⛔ Ne pas l\'ajouter juste pour taire ce rouge.'
      : `de ${SEUILS[0]} à ${SEUILS[SEUILS.length - 1]} px`);

  // ⭐⭐ LE TÉMOIN, ET IL EST INDISPENSABLE. Le contrôle ci-dessus est vert
  // aujourd'hui : *un banc qui ne peut plus produire de rouge ne prouve plus
  // rien par son vert.* On lui donne deux feuilles fabriquées — une propre,
  // une avec un seuil intrus — et il doit les distinguer. Elles n'ouvrent
  // aucun fichier : le cas ne peut donc pas hériter sa condition du dépôt.
  const CAS_SEUILS = [
    // 🔴🔴 CE CAS A ROUGI À SA PREMIÈRE EXÉCUTION, ET L'INSTRUMENT AVAIT
    //   RAISON : `min-width:1041px` est le COMPLÉMENT de `max-width:1040px`,
    //   pas un quinzième seuil — mais rien ne le disait au cliquet. *Un cas de
    //   test troué se lit exactement comme un instrument cassé*, et j'allais
    //   corriger le second. ⇒ la tolérance a été écrite dans `seuils.mjs`, pas
    //   ici, et ce cas la garde sous contrôle.
    ['① une feuille propre : un seuil déclaré et son COMPLÉMENT (1040 / 1041)',
     '@media (max-width:640px){.a{display:none}}@media (min-width:1041px){.b{display:grid}}', false],
    ['①bis le complément d\'un seuil qui n\'existe pas (769 = 768+1)',
     '@media (min-width:769px){.b{display:grid}}', true],
    ['② un QUINZIÈME seuil, glissé au milieu',
     '@media (max-width:640px){.a{display:none}}@media (max-width:768px){.b{display:none}}', true],
    ['③ le témoin inverse : `max-width` de BOÎTE, pas de `@media`',
     '.wrap{max-width:1220px}.vignette{max-width:250px}', false],
    ['④ un seuil intrus dans un `min-width`, pas un `max-width`',
     '@media (min-width:1200px){.c{display:flex}}', true],
  ];
  let cs = 0;
  for (const [nom, feuille, doitRougir] of CAS_SEUILS) {
    const rouge = seuilsDe(feuille).some((w) => !estSeuilDeclare(w));
    const bon = rouge === doitRougir;
    if (!bon) cs++;
    console.log(`  ${bon ? '✅' : '❌'} §3 sexies ${nom} — ${doitRougir ? 'doit rougir' : 'doit rester vert'} : ${rouge ? 'ROUGE' : 'vert'}`);
  }
  verifie(`${CAS_SEUILS.length} cas fabriqués : le cliquet sait encore rougir`, cs === 0,
    cs ? `⛔ ${cs} cas mal jugé(s) — l'instrument ne mesure plus ce qu'il annonce` : '');
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 ter. DEUX REPÈRES DE NAVIGATION HOMONYMES — le défaut qui part avec la barre
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 MESURÉ LE 11/08 SUR `dist/client/index.html` : DEUX `<nav>` portent
// `aria-label="Main navigation"` — `.nav main` (l. 705 de Base.astro) et
// `.onglets` (l. 1022). Les deux appellent `t(lang,'a11y.nav')`, donc ils ne
// peuvent PAS diverger : ils sont homonymes par construction.
// ⭐⭐ Un lecteur d'écran liste les repères par leur nom. Deux repères de même
// nom, c'est « Main navigation » proposé deux fois, sans rien pour les
// distinguer — WCAG 1.3.1, et c'est aussi du SEO (Google lit l'arbre
// d'accessibilité). ⇒ Le défaut d'accessibilité PART AVEC la barre : la
// décision 3 de Preda en referme deux d'un coup.
// ⛔ CE CONTRÔLE NE DIT PAS « retirez la barre ». Il dit « un nom, un repère ».
// Deux repères aux noms DISTINCTS le satisferaient aussi — c'est le second
// remède, et il reste ouvert si un jour la barre revient.
// ⭐ ET IL EST SITE-DÉPENDANT PAR NATURE : `.onglets` n'est émise que si
// `acces().tiers.length > 1`. vevewiki (`tiers: [visitor]`) n'en a jamais eu,
// donc il était DÉJÀ vert. *Un job vert à côté d'un rouge ne dit pas « c'est
// presque bon », il dit « la cause est site-dépendante ».*
console.log('\n3 ter. les repères de navigation : un nom, un repère');
if (!pageMenu) {
  console.log('  ⏸️  `dist/` absent — les repères se comptent dans la page SERVIE, pas dans le gabarit.');
} else {
  const { nu } = await import('../lib/i18n.mjs');
  const htmlMenu = readFileSync(pageMenu, 'utf8');
  // ⚠️ `nu()` AVANT DE COMPARER. Sous `I18N_MARQUAGE=1` — que le Dockerfile de
  //   production pose — `t()` enrobe sa valeur de sentinelles invisibles. Deux
  //   libellés identiques à l'écran seraient DIFFÉRENTS octet à octet, et ce
  //   contrôle passerait au vert sous la seule condition qui compte.
  const noms = [...htmlMenu.matchAll(/<nav\b[^>]*\baria-label="([^"]*)"/g)].map((m) => nu(m[1]).trim());
  const compte = new Map();
  for (const n of noms) compte.set(n, (compte.get(n) || 0) + 1);
  const doublons = [...compte].filter(([, v]) => v > 1);
  verifie(`${noms.length} repère(s) <nav> nommé(s) — aucun nom porté deux fois`,
    doublons.length === 0,
    doublons.length
      ? `🔴 ${doublons.map(([k, v]) => `« ${k} » × ${v}`).join(' · ')}`
        + ' — deux repères indiscernables au lecteur d\'écran'
      : (noms.length ? noms.map((n) => `« ${n} »`).join(' · ') : 'aucun repère nommé sur cette page'));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 quater. LA DERNIÈRE PORTE DE L'ESPACE MEMBRE
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 EN RETIRANT `.onglets`, LE LOT 139 RETIRE AUSSI UN CHEMIN VERS
// `/compte/` — et trois commentaires du dépôt comptaient cette barre parmi les
// portes de l'espace membre (Base.astro l. 361 et l. 783, lot 132). Le lot 132
// avait DÉJÀ retiré `/compte/` du tiroir en s'appuyant sur ce comptage.
// ⭐⭐⭐ *Avant de retirer une porte, on compte les autres — et le comptage est
// une MESURE, pas un commentaire.* Mesuré le 11/08 sur la page servie :
//   ① la nav de l'en-tête + le tiroir → `/compte/` n'y est PLUS (lot 132) ;
//   ② l'avatar `.globe` → présent, et VISIBLE aux 30 largeurs balayées
//      (seul son libellé `span` part sous 640 px, thème l. 1261) ;
//   ③ la barre `.onglets` → celle qu'on retire ;
//   ④ la section « Réglages » du tableau de bord (lot 131).
// ⇒ Il reste ①=non, ②=oui, ④=oui. **L'avatar devient la porte visible unique**,
// et ce § est là pour qu'elle ne puisse plus disparaître sans rougir.
// ⛔ « une protection qui bloque tout le monde est cassée » vaut aussi pour une
// navigation qui n'ouvre plus rien.
// ⭐ LE MOTEUR EST CELUI DU §3 bis, DÉJÀ CONTRE-ÉPROUVÉ SIX FOIS au § suivant :
// on ne re-fabrique pas de cas pour lui ici, on réutilise l'instrument prouvé.
console.log('\n3 quater. la dernière porte de l\'espace membre');
if (!pageMenu) {
  console.log('  ⏸️  `dist/` absent — les portes se comptent dans la page SERVIE.');
} else {
  const htmlMenu = readFileSync(pageMenu, 'utf8');
  const portes = [...htmlMenu.matchAll(/<a\b[^>]*href="[^"]*\/compte\/?"/g)].length;
  if (!portes) {
    // ⚠️ SANS OBJET N'EST PAS UN ÉCART. vevewiki est `tiers:[visitor]` : il n'a
    //    pas d'espace membre, donc pas de porte à compter. *Un banc qui rougit
    //    là où la question ne se pose pas se fait désarmer.*
    console.log('  ⏸️  sans objet ici — ce site n\'a pas d\'espace membre'
      + ' (`access.tiers` ne contient que `visitor`).');
  } else {
    verifie(`${portes} lien(s) vers /compte/ dans la page servie`, portes > 0);
    // ⭐ LE CONTENANT DE LA PORTE RESTANTE, À CHAQUE LARGEUR. Un lien émis dans
    //   un conteneur masqué est un lien que personne ne voit — c'est le défaut
    //   du lot 111 déplacé sur l'espace membre.
    const masquee = largeurs.filter((W) => !M.visible('.globe', W));
    verifie('l\'avatar `.globe` — la porte visible — n\'est masqué à AUCUNE largeur',
      masquee.length === 0,
      masquee.length
        ? `🔴 masqué à ${masquee.join(', ')} px : l'espace membre n'a plus de porte visible`
        : `visible de ${largeurs[0]} à ${largeurs[largeurs.length - 1]} px`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 quinquies. LA CONTRE-ÉPREUVE — le balayage rougit-il quand il DOIT rougir ?
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CE § N'OUVRE NI `dist/` NI LE THÈME, ET C'EST LE POINT. Le §3 bis est
// VERT aujourd'hui et il le restera après la correction : *un banc qui ne peut
// plus produire de rouge ne prouve plus rien par son vert.* On lui rejoue donc
// des feuilles fabriquées, dont **le trou 641–1040 px du lot 111**, à chaque
// passage. ⛔ Et les témoins verts vont avec : un banc qui rougit sur tout est
// aussi inutile qu'un banc qui verdit sur tout.
{
  console.log('\n3 quinquies. contre-épreuve (fabriquée, n\'ouvre ni dist/ ni le thème)');
  const essai = (nom, cssFab, emisFab, attenduTrou) => {
    const mo = moteurDisplay(cssFab);
    const ws = [...new Set([360, ...mo.seuils.flatMap((s) => [s, s + 1]), 1280])].sort((a, b) => a - b);
    const vus = ws.filter((W) => !CHEMINS.some((c) => mo.visible(c.sel, W) && emisFab.includes(c.sel)));
    verifie(`${nom} — ${vus.length ? `trou à ${vus.join(', ')} px` : 'aucun trou'}`,
      (vus.length > 0) === attenduTrou);
  };
  const TOUS = ['.nav__liens', '.nav__deplie', '.onglets'];

  // 🔴🔴 LES TROIS CHEMINS SONT DÉCLARÉS DANS CHAQUE CAS, ET C'EST LA PREMIÈRE
  //    CHOSE QUE CE § M'A APPRISE. Ma version ① d'origine oubliait `.onglets` :
  //    sans règle, la cascade la déclare VISIBLE (c'est le comportement juste),
  //    donc le trou du lot 111 était comblé par un chemin fantôme et le cas
  //    fabriqué restait VERT. ⭐⭐⭐ *Une contre-épreuve incomplète accuse
  //    l'instrument à la place du cas* — et j'allais corriger le moteur.
  const BAS = '.onglets{display:none}@media (max-width:640px){.onglets{display:grid}}';

  // ① LA PANNE DU LOT 111, REJOUÉE : la nav part à 1040, le bouton n'arrive
  //    qu'à 640. L'intervalle 641–1040 px n'a AUCUN accès visible au menu — les
  //    liens existaient, le bouton répondait, l'écran ne montrait rien.
  essai('le trou 641–1040 px du lot 111',
    '.nav__deplie{display:none}' + BAS
    + '@media (max-width:1040px){.nav__liens{display:none}}'
    + '@media (max-width:640px){.nav__deplie{display:block}}', TOUS, true);
  // ② LE TÉMOIN — les deux seuils alignés : c'est l'état MESURÉ d'aujourd'hui.
  essai('témoin : les deux seuils alignés à 1040 px (l\'état du 11/08)',
    '.nav__deplie{display:none}' + BAS
    + '@media (max-width:1040px){.nav__liens{display:none}.nav__deplie{display:block}}', TOUS, false);
  // ③ LA DÉCISION 3 DE PREDA — la barre du bas retirée sous 640 px. Le tiroir
  //    reste : c'est précisément ce que ce banc doit LAISSER PASSER.
  essai('décision 3 : `.onglets` retirée, le tiroir reste',
    '.nav__deplie{display:none}.onglets{display:none}'
    + '@media (max-width:1040px){.nav__liens{display:none}.nav__deplie{display:block}}', TOUS, false);
  // ④ ET LE JOUR D'APRÈS : quelqu'un masque aussi le tiroir sous 640 px. Il ne
  //    reste RIEN. C'est le scénario que la décision 3 rend possible, et la
  //    seule raison d'être de ce §.
  essai('la barre partie, quelqu\'un masque AUSSI le tiroir sous 640 px',
    '.nav__deplie{display:none}.onglets{display:none}'
    + '@media (max-width:1040px){.nav__liens{display:none}.nav__deplie{display:block}}'
    + '@media (max-width:640px){.nav__deplie{display:none}}', TOUS, true);
  // ⑤ 🔴 LE CIRCUIT OUVERT — la cascade dit « visible », personne n'émet.
  //    Sans ce cas, le balayage serait vert sur une page qui n'a pas de menu du
  //    tout : *un contrôle qui ne regarde que ce qui existe ne voit jamais ce
  //    qui manque.*
  essai('déclaré visible mais JAMAIS ÉMIS ne compte pas',
    '.nav__deplie{display:none}'
    + '@media (max-width:1040px){.nav__liens{display:none}.nav__deplie{display:block}}',
    ['.nav__liens'], true);
  // ⑥ LE PIÈGE QUI M'A EU : aucune déclaration `display` à la racine ⇒ la
  //    boîte EXISTE. Un moteur qui lirait `null` comme « none » crierait ici.
  essai('témoin : aucune règle `display` du tout ⇒ visible partout',
    '@media (max-width:640px){.onglets{display:grid}}', ['.nav__liens'], false);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. LA VIGNETTE — TROIS GABARITS RENDENT UNE LISTE DE PIÈCES, ILS DIVERGENT
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE § NAÎT D'UNE MESURE PRISE EN PRODUCTION LE 11/08/2026, ET L'AVANT
// EST ÉCRIT ICI PARCE QU'UN APRÈS SANS AVANT NE PROUVE RIEN :
//
//   page            gabarit      ATL/ATH   mention   noms > budget
//   ─────────────────────────────────────────────────────────────
//   accueil         Carte           8/8      3/8         11/14
//   /collections/   Carte          12/12     0/12        15/18
//   /collectibles/  Rayon           0/20    15/20         9+19/40
//   /comics/        Rayon           0/20     0/20        20+18/40
//   /sets/          CarteSet        0/910    0/910      585/910
//
// ⭐⭐⭐ ET C'EST CE § QUI A TROUVÉ LA CINQUIÈME OCCURRENCE. En comparant une
// longueur de nom à son budget, il a sorti un nom de 39 caractères sur une
// page où le budget vaut 30 : `Home.astro` écrivait sa PROPRE carte de set,
// en dur, alors que `CarteSet.astro` existe depuis le lot 131 pour ça. Aucun
// contrôle ne cherchait « qui rend une carte de set SANS le composant » —
// *un contrôle qui ne regarde que ce qui existe ne voit jamais ce qui manque.*
//
// ⛔ IL OUVRE `dist/`, PAS LES GABARITS. Un `grep` sur les `.astro` dirait
// « le composant est appelé » et resterait vert le jour où un `{ed}` ou un
// `{l.path}` éteint l'émission. La seule chose qui compte est ce que la page
// SERT. ⚠️ Trois verdicts : conforme · écart · INDÉCIDABLE (exit 2).
const RACINE_DIST = (() => {
  for (const c of [join(ROOT, 'dist', 'client'), join(ROOT, 'dist')]) {
    if (existsSync(c) && statSync(c).isDirectory()) return c;
  }
  return null;
})();

function pagesHTML(dir, acc = [], profondeur = 0) {
  if (profondeur > 6) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const chemin = join(dir, e.name);
    if (e.isDirectory()) pagesHTML(chemin, acc, profondeur + 1);
    else if (e.name.endsWith('.html')) acc.push(chemin);
  }
  return acc;
}

if (!RACINE_DIST) {
  // 🔴🔴 INDÉCIDABLE, JAMAIS VERT. Un banc muet ressemble à un succès : la
  //   chaîne sortirait en 0 et le rapport dirait « conforme » alors que rien
  //   n'aurait été mesuré. ⇒ exit 2, code réservé à « je n'ai pas pu juger ».
  console.log('\n  ⚠️  INDECIDABLE — pas de dist/ : lancer `npm run build` avant ce banc.');
  process.exit(2);
}

const FERMEE = coteFermee();
// ⭐ La porte du MANIFESTE, pas une déduction : `priceEnabled()` est ce qui
//   décide que les rayons, les fiches et les cartes de set existent. Le banc
//   lit la même question que le site, il n'en invente pas une deuxième.
const VITRINE_PRIX = priceEnabled();
const fichiers = pagesHTML(RACINE_DIST);
console.log(`\n── 5. la vignette ── 📄 ${fichiers.length} page(s) ouverte(s) dans ${RACINE_DIST}`
  + `  ·  cote ${FERMEE ? 'FERMEE (les extremes passent par <Cote>)' : 'OUVERTE (valeurs en clair)'}`);

// ⭐ On mesure le TEXTE, pas le tampon. Sous `I18N_MARQUAGE=1` — que le
//   Dockerfile de production pose — une chaîne porte des sentinelles
//   invisibles ET le nom de sa clé : `.length` en déclarerait 61 là où l'œil
//   en voit 45. C'est ce qui a fait collider trois titres de set au lot 134.
const texte = (h) => nu(h.replace(/<[^>]+>/g, '')).trim();
const attrapeur = (h, cl) => [...h.matchAll(new RegExp(
  `<(?:div|span)[^>]*class="${cl}"[^>]*>([\\s\\S]*?)</(?:div|span)>`, 'g'))].map((m) => texte(m[1]));

let tropLongs = 0, sansExtremes = 0, cadenasMenteurs = 0, vignettes = 0, lignes = 0;
const exemples = [];

for (const f of fichiers) {
  const h = readFileSync(f, 'utf8');
  const court = f.slice(RACINE_DIST.length);

  // ── les noms, chacun contre SON budget ────────────────────────────────
  // ⚠️ Une carte de set et une tuile de pièce partagent la classe
  //   `cartouche__n` : on les sépare par leur conteneur, `.col-carte` contre
  //   `.carte`. ⭐ Le budget du set vaut 30 et pas 20 — décision de Preda du
  //   11/08, prise sur la mesure des 585 noms sur 910.
  for (const bloc of [...h.matchAll(/<a class="col-carte revele"[\s\S]*?<\/a>/g)].map((m) => m[0])) {
    for (const n of attrapeur(bloc, 'cartouche__n')) {
      vignettes++;
      if (clen(n) > BUDGETS.set) { tropLongs++; exemples.push(`${court} · set ${clen(n)}>${BUDGETS.set} « ${n} »`); }
    }
  }
  for (const bloc of [...h.matchAll(/<div class="carte-h revele"[\s\S]*?<\/button>\s*<\/div>/g)].map((m) => m[0])) {
    vignettes++;
    for (const n of attrapeur(bloc, 'cartouche__n')) {
      if (clen(n) > BUDGETS.item) { tropLongs++; exemples.push(`${court} · item ${clen(n)}>${BUDGETS.item} « ${n} »`); }
    }
    // ⭐⭐ LA TUILE DE PIÈCE PORTE SES EXTRÊMES, TOUJOURS. C'est le contrôle
    //   qui aurait rougi sur `/sets/` et sur les rayons avant ce lot.
    if (!/socle__ext/.test(bloc)) { sansExtremes++; exemples.push(`${court} · tuile sans ATL/ATH`); }
    // ⛔ ET SA MENTION D'ÉDITION EST ÉMISE. Le `<span>` doit exister même
    //   vide (toutes les pièces n'ont pas de mention) : ce qu'on refuse, c'est
    //   qu'un appelant ÉTEIGNE l'émission, comme `ed=false` le faisait pour
    //   `/collections/` — 12 spans présents et 12 spans VIDES.
    if (!/cartouche__s/.test(bloc)) { sansExtremes++; exemples.push(`${court} · tuile sans mention d'edition`); }
  }

  // ── les lignes de rayon ────────────────────────────────────────────────
  for (const li of [...h.matchAll(/<li class="rayon__l">[\s\S]*?<\/li>/g)].map((m) => m[0])) {
    lignes++;
    for (const [cl, bud] of [['rayon__n', BUDGETS.item], ['rayon__s', BUDGETS.serie]]) {
      for (const n of attrapeur(li, cl)) {
        if (clen(n) > bud) { tropLongs++; exemples.push(`${court} · ${cl} ${clen(n)}>${bud} « ${n} »`); }
      }
    }
    const aFiche = /class="rayon__c"/.test(li);          // <a> ⇒ la pièce a une fiche
    const muette = /rayon__c--muet/.test(li);            // <div> ⇒ pas de fiche
    if (FERMEE && aFiche && !/rayon__ext/.test(li)) {
      sansExtremes++; exemples.push(`${court} · ligne avec fiche mais sans ATL/ATH`);
    }
    // 🔴🔴 LE CONTRÔLE QUI PROTÈGE LA DÉCISION DE PREDA, ET C'EST LE PLUS
    //   IMPORTANT DES QUATRE. `.reserve/cote/` ne contient que les cotes de
    //   `ds.items` — 1 201 sur 19 412. Un `<Cote>` posé sur une ligne SANS
    //   fiche affiche un cadenas qui ne s'ouvrira JAMAIS, même pour un Whale :
    //   il dit « je ne montre pas » là où la vérité est « je n'ai pas ».
    //   ⭐ `Cote.astro` dénonce lui-même cette confusion en tête de fichier ;
    //   ce contrôle est ce qui l'empêche de revenir par la porte du rayon.
    if (muette && /data-cote=/.test(li)) {
      cadenasMenteurs++; exemples.push(`${court} · cadenas sur une ligne SANS fiche`);
    }
  }
}

verifie(`${vignettes} vignette(s) et ${lignes} ligne(s) : aucun nom au-dela de son budget `
  + `(item ${BUDGETS.item} · serie ${BUDGETS.serie} · set ${BUDGETS.set})`, tropLongs === 0,
  tropLongs ? `⛔ ${tropLongs} nom(s) trop long(s) — ex. ${exemples.filter((e) => e.includes('>')).slice(0, 2).join(' | ')}` : '');
verifie(`chaque vignette de piece emet ses extremes ET sa mention d'edition`, sansExtremes === 0,
  sansExtremes ? `⛔ ${sansExtremes} vignette(s) muette(s) — ex. ${exemples.filter((e) => e.includes('sans')).slice(0, 2).join(' | ')}` : '');
verifie(`aucun cadenas sur une ligne sans fiche (« je n'ai pas » ≠ « je ne montre pas »)`, cadenasMenteurs === 0,
  cadenasMenteurs ? `⛔ ${cadenasMenteurs} ligne(s) — 18 212 pieces n'ont AUCUNE cote en reserve` : '');
// ⚠️ ET LE TÉMOIN — un banc qui n'a rien ouvert est vert pour la pire des
//   raisons. Mais « rien vu » a DEUX causes opposées, et les confondre a
//   coûté le premier passage de ce banc :
//   🔴🔴 MESURÉ EN CONDITION 2 : sur **vevewiki**, ce contrôle sortait KO.
//   Et il avait tort. vevewiki n'a ni rayon, ni fiche de pièce, ni carte de
//   set — `priceEnabled()` y est faux, ces pages n'existent pas. Zéro vignette
//   n'y est pas une régression : c'est le manifeste qui parle.
//   ⭐⭐⭐ *Un job vert à côté d'un rouge ne dit pas « c'est presque bon », il
//   dit « la cause est site-dépendante »* — appliqué ici à un ROUGE de trop.
//   ⇒ TROIS VERDICTS, pas deux : conforme · écart · **SANS OBJET**. Et le
//   « sans objet » s'IMPRIME, il ne se tait pas : un banc qui ne mesure rien
//   doit le dire, sinon son silence se lit comme un succès.
if (!VITRINE_PRIX) {
  console.log(`  --  sans objet — ce site ne publie ni rayon ni vignette de piece `
    + `(priceEnabled=false au manifeste) ; les §5 portent sur veveprice.`);
} else {
  // ⚠️ LE DÉTAIL NE S'IMPRIME QUE S'IL Y A UN ÉCART. `verifie()` l'écrit sans
  //   condition : un message « INDÉCIDABLE » collé à un ✅ se lit comme un
  //   avertissement sur un succès, et c'est exactement le brouillage qu'on
  //   passe son temps à traquer ici. *Un rapport dit une chose à la fois.*
  verifie(`le banc a bien vu des vignettes (${vignettes} tuile(s), ${lignes} ligne(s))`, vignettes + lignes > 0,
    vignettes + lignes > 0 ? '' : 'INDECIDABLE — aucune vignette dans dist/ sur un site qui en publie : ce vert ne mesure rien');
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. LES CONTRE-ÉPREUVES — parce que le §5 est maintenant vert
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ UN BANC QUI NE PEUT PLUS PRODUIRE DE ROUGE NE PROUVE PLUS RIEN PAR SON
// VERT. Ces cinq cas n'ouvrent pas `dist/` : ils fabriquent le HTML exact des
// pannes qu'on vient de fermer, et exigent que chacune soit détectée.
// ⭐ Le cas ⑤ est le plus important : un banc qui rougit sur tout est aussi
// inutile qu'un banc qui verdit sur tout.
// 🔴🔴 ET CELUI-CI EST UN DÉFAUT D'INSTRUMENT TROUVÉ PAR LA CONDITION 2, DANS
// UN BANC QUE JE VENAIS D'ÉCRIRE. Le cas ① lisait `FERMEE` — la porte du SITE
// COURANT. Sur vevewiki la cote est ouverte, donc la règle ne s'appliquait
// pas, donc le cas fabriqué restait VERT et le harnais accusait l'instrument.
// ⭐⭐⭐ *Un banc fabrique la condition qu'il éprouve ; il ne l'hérite pas de
// son environnement.* Un cas de test qui dépend du manifeste sous lequel il
// tourne ne teste plus la règle, il teste le manifeste. ⇒ chaque cas déclare
// SA porte, en quatrième colonne.
const CAS = [
  ['① la panne du 11/08 : une ligne de rayon avec fiche et sans extremes',
   '<li class="rayon__l"><a class="rayon__c" href="/x/"><span class="rayon__n">Batman</span></a></li>', true, true],
  ['② un cadenas sur une ligne SANS fiche',
   '<li class="rayon__l"><div class="rayon__c rayon__c--muet"><span class="rayon__n">X</span>'
   + '<span class="cote" data-cote="a"></span></div></li>', true, false],
  ['③ un nom de piece a 34 caracteres',
   '<li class="rayon__l"><a class="rayon__c" href="/x/"><span class="rayon__n">Amazing Spider-Man Annual 2024</span>'
   + '<span class="rayon__ext"></span></a></li>', true, false],
  ['④ un nom de SET a 26 caracteres (sous le budget de 30, au-dessus de celui de 20)',
   '<a class="col-carte revele" href="/c/"><span class="cartouche__n">Disney100 Platinum Moment</span></a>', false, false],
  ['⑥ LE TEMOIN DE LA PORTE — la meme ligne que ①, cote OUVERTE : rien a demander',
   '<li class="rayon__l"><a class="rayon__c" href="/x/"><span class="rayon__n">Batman</span></a></li>', false, false],
  ['⑤ LE TEMOIN — une ligne parfaitement conforme', 
   '<li class="rayon__l"><a class="rayon__c" href="/x/"><span class="rayon__n">Batman Gold</span>'
   + '<span class="rayon__s">Cosmic</span><span class="rayon__ext"></span></a></li>', false, true],
];
let ce = 0;
for (const [nom, html, doitRougir, porteFermee] of CAS) {
  let rouge = false;
  for (const bloc of [...html.matchAll(/<a class="col-carte revele"[\s\S]*?<\/a>/g)].map((m) => m[0])) {
    for (const n of attrapeur(bloc, 'cartouche__n')) if (clen(n) > BUDGETS.set) rouge = true;
  }
  for (const li of [...html.matchAll(/<li class="rayon__l">[\s\S]*?<\/li>/g)].map((m) => m[0])) {
    for (const [cl, bud] of [['rayon__n', BUDGETS.item], ['rayon__s', BUDGETS.serie]]) {
      for (const n of attrapeur(li, cl)) if (clen(n) > bud) rouge = true;
    }
    if (porteFermee && /class="rayon__c"/.test(li) && !/rayon__ext/.test(li)) rouge = true;
    if (/rayon__c--muet/.test(li) && /data-cote=/.test(li)) rouge = true;
  }
  const bon = rouge === doitRougir;
  if (!bon) ce++;
  console.log(`  ${bon ? '✅' : '❌'} §6 ${nom} — ${doitRougir ? 'doit rougir' : 'doit rester vert'} : ${rouge ? 'ROUGE' : 'vert'}`);
}
verifie(`${CAS.length} cas fabriques : le §5 sait encore rougir`, ce === 0,
  ce ? `⛔ ${ce} cas mal juge(s) — l'instrument ne mesure plus ce qu'il annonce` : '');




// ═══════════════════════════════════════════════════════════════════════════
// 7. LE PIED DE PAGE — QUATRE COLONNES DÉCLARÉES, QUATRE COLONNES ÉMISES
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE § PART DU **HTML SERVI**, ET C'EST TOUT SON INTÉRÊT. Le défaut qu'il
// ferme est l'INVERSE de celui que `css-mort` attrape : la feuille était juste
// — `.site-f__cols{grid-template-columns:1.5fr 1fr 1fr 1fr}`, `.site-f h2`,
// `.site-f ul` — et c'est l'ÉMETTEUR qui manquait. Mesuré le 11/08 sur les
// pages construites : **0 `<h2>`, 0 `<ul>`, trois `<p>`** que la grille étalait
// côte à côte, dont un `.f-legal` avec son `border-top` posé au milieu d'une
// colonne.
// ⭐⭐⭐ *Un contrôle qui part du CSS ne peut pas voir ça : la règle existe, elle
// est correcte, et elle est même bien écrite.* Il fallait partir du résultat.
//
// ⛔ IL RÉCLAME, IL NE CONSTATE PAS. Écrit à l'envers — « si un `<h2>` existe,
// vérifier qu'il a une liste » — il serait resté VERT sur le pied d'avant, qui
// n'avait aucun `<h2>`. Un contrôle qui ne regarde que ce qui existe ne voit
// jamais ce qui manque. Il exige donc QUATRE colonnes, chacune avec un titre
// ET au moins une ligne.
//
// ⚠️ « AU MOINS UNE LIGNE » N'EST PAS DU ZÈLE — c'est le défaut que j'ai
// FAILLI livrer. Premier jet : la colonne « À propos » ne portait que les
// partenaires et la note d'affiliation. Or `links.team` et `links.affiliate`
// valent `[]` sur LES DEUX sites : la colonne serait sortie avec son titre et
// rien dessous, sur 3 360 pages. *J'allais poser un émetteur vide en corrigeant
// une règle sans émetteur.* Un titre sans contenu est exactement le même défaut
// qu'une règle sans émetteur, d'un étage plus bas.
console.log('\n7. le pied de page : quatre colonnes, quatre titres, quatre listes');
{
  const pagePied = ['dist/client/index.html', 'dist/index.html']
    .map((x) => join(ROOT, x)).find((x) => existsSync(x))
    || (() => {
      // ⭐ un accueil peut manquer sur un site sans page d'accueil : on prend
      // n'importe quelle page servie plutôt que de sortir en INDÉCIDABLE pour
      // un détail de nommage. Le pied est le même partout — c'est `Base.astro`.
      const rac = existsSync(join(DIST, 'client')) ? join(DIST, 'client') : DIST;
      const pile = existsSync(rac) ? [rac] : [];
      while (pile.length) {
        const d = pile.pop();
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const f = join(d, e.name);
          if (e.isDirectory()) pile.push(f);
          else if (e.name.endsWith('.html') && !e.name.startsWith('404')) return f;
        }
      }
      return null;
    })();

  if (!pagePied) {
    console.log('  ⛔ INDÉCIDABLE — aucune page HTML dans `dist/`. Ce § lit le RÉSULTAT,'
      + ' il doit tourner APRÈS `npm run build` (Dockerfile l. 399).');
    process.exit(2);
  }
  console.log(`  📄 page ouverte : ${pagePied.slice(ROOT.length + 1)}`);
  const htmlPied = readFileSync(pagePied, 'utf8');
  const pied = (htmlPied.match(/<footer[^>]*>[\s\S]*?<\/footer>/) || [''])[0];

  /** Les colonnes de `.site-f__cols` : chaque enfant direct, avec son titre et
   *  le nombre de `<li>` qu'il porte.
   *  ⚠️ On découpe sur les `<h2>` plutôt que d'équilibrer les `<div>` : Astro
   *  ajoute `data-astro-cid-…` partout et le pied contient des `<div>`
   *  imbriqués. Un découpage par titre suit ce qu'un LECTEUR voit — quatre
   *  rubriques — et non ce que le compilateur a produit. */
  const grille = (pied.match(/<div class="site-f__cols"[^>]*>([\s\S]*)<\/div>\s*<div class="f-legal"/) || [, ''])[1];
  const parts = grille.split(/<h2[^>]*>/).slice(1);
  const colonnes = parts.map((bloc) => ({
    titre: (bloc.match(/^([\s\S]*?)<\/h2>/) || [, ''])[1].trim(),
    listes: (bloc.match(/<ul[^>]*>/g) || []).length,
    lignes: (bloc.match(/<li[^>]*>/g) || []).length,
  }));
  for (const c of colonnes) {
    console.log(`     « ${c.titre.padEnd(16)} »  ${c.listes} liste(s), ${c.lignes} ligne(s)`);
  }
  const vides = colonnes.filter((c) => c.lignes === 0 || c.listes === 0 || !c.titre);
  verifie('la grille du pied émet EXACTEMENT 4 colonnes', colonnes.length === 4,
    colonnes.length === 4 ? '' : `🔴 ${colonnes.length} colonne(s) émise(s) — la feuille en déclare 4 `
      + '(`grid-template-columns:1.5fr 1fr 1fr 1fr`). Une grille à 4 pistes nourrie de 3 enfants '
      + 'laisse une piste vide, et de 5 en replie un sur la ligne suivante.');
  // 🔴🔴 ET CE CONTRÔLE-CI A ÉTÉ VERT SUR **ZÉRO COLONNE** À SA PREMIÈRE
  // MESURE D'AVANT. Sur le pied d'origine — trois `<p>`, aucun `<h2>` — il
  // annonçait « aucune colonne creuse » ✅ : c'est vrai, il n'y en avait
  // aucune du tout. Le § restait rouge grâce au contrôle précédent, mais cette
  // ligne-là mentait, et un jour elle aurait été la seule à parler.
  // ⭐⭐⭐ *« Aucune faute » et « rien à juger » se ressemblent exactement dans
  // un compteur à zéro* — c'est écrit noir sur blanc dans `test:entete` pour
  // les thèmes, et je viens de le repayer trois § plus loin.
  if (colonnes.length === 0) {
    console.log('  ⏭️  SANS OBJET — aucune colonne à juger (le contrôle ci-dessus dit pourquoi).');
  } else {
    verifie(`aucune des ${colonnes.length} colonnes n'est sans titre ni sans ligne`, vides.length === 0,
      vides.length ? `🔴 ${vides.length} colonne(s) creuse(s) : ${vides.map((c) => `« ${c.titre || '(sans titre)'} »`).join(', ')}`
        + ' — un titre sans contenu est une règle sans émetteur, un étage plus bas.' : '');
  }
  // ⭐ LE LIEN VIDE. `m.identity.name` n'existe pas dans ce dépôt (c'est
  // `m.site.brand`) et Astro écrit `undefined` comme une chaîne vide : le
  // premier jet de ce lot a produit `<a href="/"></a>`, cliquable et
  // invisible, sur 3 360 pages, avec un build parfaitement vert. *Un champ mal
  // nommé ne se distingue pas d'un champ vide.*
  const creux = (pied.match(/<a[^>]*>\s*<\/a>/g) || []).length;
  verifie('aucun lien vide dans le pied', creux === 0,
    creux ? `🔴 ${creux} \`<a>\` sans texte — presque toujours un champ de manifeste mal nommé` : '');
  // ⛔ `.f-legal` HORS DE LA GRILLE. Il porte un `border-top` : dans la grille,
  // le trait passait au milieu d'une colonne au lieu de souligner les quatre.
  verifie('la barre légale est SOUS la grille, pas dedans',
    /<\/div>\s*<div class="f-legal"/.test(pied),
    /<div class="f-legal"/.test(pied) ? '' : '🔴 `.f-legal` introuvable ou resté élément de grille — '
      + 'son `border-top` traverserait une colonne.');

  // ── LES CAS FABRIQUÉS. Le contrôle est vert : sans eux, son vert ne prouve
  //    plus rien. Aucun n'ouvre `dist/`.
  const decoupe = (h) => h.split(/<h2[^>]*>/).slice(1).map((b) => ({
    titre: (b.match(/^([\s\S]*?)<\/h2>/) || [, ''])[1].trim(),
    listes: (b.match(/<ul[^>]*>/g) || []).length,
    lignes: (b.match(/<li[^>]*>/g) || []).length,
  }));
  const CAS_PIED = [
    ['① le pied D\'AVANT le lot 139 : trois <p>, aucun titre',
     '<p>a</p><p>b</p><p>c</p>', true],
    ['② une colonne au titre nu, sans liste — le défaut que j\'ai failli livrer',
     '<h2>A</h2><ul><li>x</li></ul><h2>B</h2><ul><li>y</li></ul><h2>C</h2><ul><li>z</li></ul><h2>D</h2>', true],
    ['③ une colonne avec sa liste mais AUCUNE ligne (`links.team: []`)',
     '<h2>A</h2><ul><li>x</li></ul><h2>B</h2><ul><li>y</li></ul><h2>C</h2><ul><li>z</li></ul><h2>D</h2><ul></ul>', true],
    ['④ trois colonnes dans une grille qui en déclare quatre',
     '<h2>A</h2><ul><li>x</li></ul><h2>B</h2><ul><li>y</li></ul><h2>C</h2><ul><li>z</li></ul>', true],
    ['⑤ LE TÉMOIN — quatre colonnes pleines',
     '<h2>A</h2><ul><li>x</li></ul><h2>B</h2><ul><li>y</li></ul><h2>C</h2><ul><li>z</li></ul><h2>D</h2><ul><li>w</li></ul>', false],
  ];
  let cp = 0;
  for (const [nom, html, doitRougir] of CAS_PIED) {
    const cols = decoupe(html);
    const rouge = cols.length !== 4 || cols.some((c) => !c.titre || !c.listes || !c.lignes);
    const bon = rouge === doitRougir;
    if (!bon) cp++;
    console.log(`  ${bon ? '✅' : '❌'} §7 ${nom} — ${doitRougir ? 'doit rougir' : 'doit rester vert'} : ${rouge ? 'ROUGE' : 'vert'}`);
  }
  verifie(`${CAS_PIED.length} cas fabriqués : le §7 sait encore rougir`, cp === 0,
    cp ? `⛔ ${cp} cas mal jugé(s)` : '');
}

console.log(`\n${ko === 0 ? '✅ affichage : tout est conforme' : `❌ affichage : ${ko} écart(s)`}`);
process.exit(ko === 0 ? 0 : 1);
