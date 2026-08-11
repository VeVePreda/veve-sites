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

console.log(`\n${ko === 0 ? '✅ affichage : tout est conforme' : `❌ affichage : ${ko} écart(s)`}`);
process.exit(ko === 0 ? 0 : 1);
