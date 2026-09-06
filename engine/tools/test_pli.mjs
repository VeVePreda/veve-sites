// ⚠️ VeVePreda/veve-sites — engine/tools/test_pli.mjs   (FICHIER NEUF)
//
// ═══════════════════════════════════════════════════════════════════════════
//  RELOOKING veveprice — CE QUI EST AU-DESSUS DU PLI, ET CE QUI SE VOIT QUAND
//  ON TABULE
// ═══════════════════════════════════════════════════════════════════════════
//  Trois défauts mesurés SUR LA PRODUCTION le 06/09/2026, qu'aucun des 51 bancs
//  ne pouvait voir. Ils ont en commun d'être parfaitement bien formés : le HTML
//  est valide, les classes sont les bonnes, la feuille est servie au caractère
//  près. Ce sont des défauts de MISE EN PAGE et d'ÉTAT, pas de structure.
//
//  ① LE NOM DE LA PIÈCE ÉTAIT À 1 278 px SUR UN TÉLÉPHONE. `.fiche` passe en
//     une colonne sous 900 px, et ses enfants s'empilaient dans l'ordre du
//     code : `.fiche__viz` (1 131 px de visuel et d'identité) AVANT le `<h1>`.
//     On descendait 1,4 écran avant de savoir ce qu'on regardait.
//     ⛔ Et la correction évidente était la mauvaise : un `order` aurait fait
//     passer les 1 101 px de description DEVANT le visuel.
//
//  ② LE CONTOUR DE FOCUS ÉTAIT SUPPRIMÉ SUR TOUS LES CHAMPS DU SITE.
//     `.champ input:focus{outline:none}` annulait la règle `:focus-visible`
//     globale, qui était écrite et correcte. L'anneau qui restait mesure
//     1,25:1 — contre les 9,23:1 du contour de section. Au clavier, on ne
//     savait plus où on était.
//     ⭐⭐ L'AUDIT D'ACCESSIBILITÉ DISAIT « 2.4.7 ✅ ». Il avait raison — DE LA
//     MAQUETTE. C'est une observation juste avec un verdict périmé, et c'est
//     précisément ce qu'un banc empêche de se reproduire.
//
//  ③ LE TABLEAU DES SETS N'AVAIT PAS DE HAUTEUR. `.tbl-hote` est en
//     `overflow-y:hidden` : le correctif du défaut `n` le fait passer de 1 à 50
//     lignes, soit ~1 940 px, sur une page qui en mesure 3 040.
//
// ═══════════════════════════════════════════════════════════════════════════
//  ⛔⛔ CE BANC DÉCAPE LES COMMENTAIRES AVANT DE LIRE — ET C'EST LE POINT
// ═══════════════════════════════════════════════════════════════════════════
//  Le correctif de ces trois défauts est COMMENTÉ, et ses commentaires citent
//  les motifs exacts que ce banc cherche : le mot que le §2 traque est écrit
//  noir sur blanc dans la prose qui explique qu'on l'a RETIRÉ.
//
//  ⭐⭐⭐ Un banc branché sur un nom lit la prose qui parle du nom. C'est la
//  faute qui a rendu quinze bancs faux sans qu'une seule ligne de code soit
//  fautive. On décape donc les DEUX côtés — la feuille ET le gabarit — avant de
//  chercher quoi que ce soit, et jamais l'inverse.
//
//  ⛔ CE BANC N'EST PAS UN MOTEUR DE RENDU. Il ne mesure pas 1 278 px : hors
//  ligne, personne ne le peut. Il mesure l'INVARIANT DE FORME qui produit la
//  bonne position — l'ordre des zones nommées — et cet invariant, lui, est
//  vérifiable en quelques millisecondes et sans dépendance.
//
//  ⚠️ SANS OBJET N'EST PAS VERT. `.fiche` n'existe que dans le thème vitrine.
//  Sur `vevewiki`, ce banc DIT qu'il n'a rien à juger au lieu de se taire —
//  un silence se confond avec un succès, et c'est le piège qui a cassé le
//  build de vevewiki le 02/08.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const R = new URL('../..', import.meta.url).pathname;
let echecs = 0;
const dire = (ok, msg) => { if (!ok) echecs++; console.log(`  ${ok ? '✅' : '❌'} ${msg}`); };
const noter = (msg) => console.log(`  ⚪ ${msg}`);

// ── LE DÉCAPAGE ────────────────────────────────────────────────────────────
// ⚠️ L'ordre compte : on retire `/* */` d'abord. Un `//` à l'intérieur d'un
// bloc `/* */` n'est pas un commentaire de ligne, et le traiter comme tel
// couperait la fin du bloc au milieu.
// ⛔ On ne touche PAS aux `//` du CSS : ils n'y sont pas des commentaires, et
// une URL de la forme `url(//cdn…)` disparaîtrait.
const nuCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
const nuAstro = (s) => s
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

// ═══ §1 — L'ORDRE DU PLI SUR LA FICHE ═════════════════════════════════════
console.log('\n§1 — le nom de la pièce passe devant le visuel sous 900 px');

const DOSSIER = join(R, 'themes');
const THEMES = readdirSync(DOSSIER).filter((d) => existsSync(join(DOSSIER, d, 'theme.css'))).sort();
let vus = 0;

for (const cle of THEMES) {
  const css = nuCss(readFileSync(join(DOSSIER, cle, 'theme.css'), 'utf8'));

  // ⛔⛔ ON RECONNAIT LA FICHE A `.fiche__viz`, JAMAIS A `.fiche`.
  // Premier jet de ce banc : il cherchait `.fiche`, et le thème `encyclopedie`
  // en déclare une — un composant SANS RAPPORT, qui porte le même mot. Le banc
  // jugeait donc vevewiki contre un contrat écrit pour veveprice, et rendait
  // sept rouges sur du code parfaitement sain.
  // ⭐⭐ C'est la faute qu'il est lui-même chargé d'éviter, commise dans sa
  // propre première version : un banc branché sur un NOM trouve les homonymes.
  // `.fiche__viz` n'existe que dans la fiche de veveprice — c'est un USAGE.
  if (!/\.fiche__viz\s*\{/.test(css)) { noter(`${cle} — SANS OBJET : ce thème ne porte pas la fiche de veveprice`); continue; }
  vus++;

  // ⭐ On lit la DERNIÈRE déclaration qui gagne, pas la première trouvée : une
  // feuille de 3 229 lignes redéclare, et c'est la cascade qui décide.
  // « Est-ce écrit ? » et « qu'est-ce qui gagne ? » sont deux questions
  // différentes, et seule la seconde décrit la page servie.
  const zonesDe = (bloc) => {
    const m = [...bloc.matchAll(/grid-template-areas\s*:\s*([^;}]+)/g)];
    if (!m.length) return null;
    return [...m[m.length - 1][1].matchAll(/"([^"]*)"/g)].map((x) => x[1].trim());
  };

  const mobiles = [...css.matchAll(/@media[^{]*max-width\s*:\s*(\d+)px[^{]*\{([\s\S]*?\})\s*\}/g)]
    .filter((m) => Number(m[1]) <= 900)
    .map((m) => m[2])
    .filter((b) => /\.fiche\s*\{/.test(b));

  const tousBlocs = [...css.matchAll(/\.fiche\s*\{([^}]*)\}/g)].map((x) => x[1]);
  const bureau = tousBlocs.filter((b) => /grid-template-areas/.test(b));
  dire(bureau.length > 0, `${cle} — \`.fiche\` déclare ses zones nommées`);

  const zBureau = bureau.length ? zonesDe(bureau[0]) : null;
  dire(!!zBureau && zBureau.some((r) => /\bviz\b/.test(r) && /\bid\b/.test(r)),
    `${cle} — sur grand écran, \`viz\` et \`id\` partagent la première rangée`
    + (zBureau ? `   — ${JSON.stringify(zBureau)}` : ''));

  dire(mobiles.length > 0, `${cle} — \`.fiche\` est redéclarée sous 900 px`);

  const blocMobile = mobiles.length
    ? (mobiles[mobiles.length - 1].match(/\.fiche\s*\{([^}]*)\}/) || [, ''])[1] : '';
  const zMobile = zonesDe(blocMobile);

  if (!zMobile) {
    dire(false, `${cle} — 🔴 sous 900 px, \`.fiche\` ne nomme aucune zone : l'ordre redevient celui du CODE, donc le visuel avant le nom`);
  } else {
    const iId = zMobile.findIndex((r) => /\bid\b/.test(r));
    const iViz = zMobile.findIndex((r) => /\bviz\b/.test(r));
    dire(iId >= 0 && iViz >= 0 && iId < iViz,
      `${cle} — sous 900 px, \`id\` est AU-DESSUS de \`viz\`   — ${JSON.stringify(zMobile)}`
      + (iId >= 0 && iViz >= 0 && iId >= iViz
        ? `\n     ⛔ LE NOM DE LA PIÈCE REPASSE SOUS LE VISUEL — le défaut de 1 278 px, rouvert.` : ''));
  }

  // ⭐ Une zone nommée que personne ne réclame est ignorée EN SILENCE, et la
  // grille retombe sur l'ordre du code — c'est-à-dire sur le défaut.
  for (const z of ['viz', 'id', 'txt']) {
    dire(new RegExp(`grid-area\\s*:\\s*${z}\\b`).test(css),
      `${cle} — la zone \`${z}\` est réclamée par un \`grid-area\``);
  }
}
if (!vus) dire(false, '🔴 aucun thème ne déclare `.fiche` — ce banc ne juge rien, et il doit le dire');

// ═══ §2 — LE CONTOUR DE FOCUS DES CHAMPS ══════════════════════════════════
console.log('\n§2 — un champ au clavier montre toujours où il est');

const CHAMP = /input|select|textarea|\.champ/;
for (const cle of THEMES) {
  const css = nuCss(readFileSync(join(DOSSIER, cle, 'theme.css'), 'utf8'));
  const regles = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .map((m) => ({ sel: m[1].replace(/\s+/g, ' ').trim(), corps: m[2] }));

  // ⛔⛔ DEUXIÈME FAUTE DE CE BANC, TROUVÉE EN LUI INJECTANT LE DÉFAUT RÉEL.
  // Première version : « un `:focus-visible` qui parle d'un champ suffit ».
  // Elle restait VERTE sur le défaut de production exact, parce que
  // `.champ-f:focus-visible` — une règle SANS AUCUN RAPPORT, 1 800 lignes plus
  // loin — satisfaisait la condition : mon motif `\.champ` mord sur `.champ-f`.
  // ⭐⭐⭐ Un préfixe n'est pas un jeton. On compare donc des JETONS DE CLASSE
  // entiers, et le releveur doit en partager un avec le tueur.
  // ⭐⭐ Et un `:focus-visible` GLOBAL ne suffit jamais : `.champ input:focus`
  // pèse (0,2,1) contre (0,1,0), donc il GAGNE au clavier. C'est exactement
  // pour ça que la règle globale de cette feuille était écrite, correcte, et
  // sans effet. *« Écrit » n'est pas « ce qui gagne ».*
  const jetons = (sel) => new Set((sel.match(/\.[A-Za-z0-9_-]+/g) || []).map((c) => c.slice(1)));

  const tueurs = regles.filter((r) =>
    /:focus\b/.test(r.sel) && !/:focus-visible/.test(r.sel)
    && CHAMP.test(r.sel) && /outline\s*:\s*(none|0)\s*[;}]?/.test(r.corps));

  const releveursTous = regles.filter((r) =>
    /:focus-visible/.test(r.sel)
    && /outline\s*:\s*(?!none\b|0\s*[;}])[^;]+/.test(r.corps));

  const rendPour = (t) => {
    const jt = jetons(t.sel);
    return releveursTous.some((r) => [...jetons(r.sel)].some((j) => jt.has(j)));
  };

  if (!tueurs.length) {
    dire(true, `${cle} — aucun contour supprimé sur un champ (${regles.length} règles lues)`);
    continue;
  }
  // ⭐ Le supprimer reste permis — à condition d'en rendre un au clavier. C'est
  // le motif « un état de repos exige son releveur », transposé au focus.
  for (const t of tueurs) {
    const rendu = rendPour(t);
    dire(rendu,
      `${cle} — \`${t.sel.slice(0, 60)}\` supprime le contour`
      + (rendu
        ? `, et un \`:focus-visible\` le rend`
        : `\n     ⛔ ET RIEN NE LE REND AU CLAVIER. L'anneau restant mesure 1,25:1.`
          + `\n     ⭐ Soit on retire la suppression, soit on écrit la règle \`:focus-visible\` qui manque.`));
  }
}

// ═══ §3 — LA HAUTEUR DU TABLEAU D'ANALYTICS ═══════════════════════════════
console.log('\n§3 — un tableau de 50 lignes ne pousse pas la page à 4 900 px');

const vitrine = join(DOSSIER, 'vitrine', 'theme.css');
if (!existsSync(vitrine)) {
  noter('SANS OBJET : pas de thème vitrine ici');
} else {
  const css = nuCss(readFileSync(vitrine, 'utf8'));
  const bloc = (css.match(/\.tbl-hote--borne\s*\{([^}]*)\}/) || [, ''])[1];
  dire(!!bloc, 'la classe `.tbl-hote--borne` existe dans le thème vitrine');
  dire(/max-height\s*:\s*\d/.test(bloc), '…et elle borne la hauteur   — ' + (bloc.trim().slice(0, 60) || '(vide)'));
  dire(/overflow-y\s*:\s*auto/.test(bloc), '…et ce qui dépasse reste atteignable en défilant');
}

const sujet = join(R, 'src/components/pages/AnalyticsSujet.astro');
if (!existsSync(sujet)) {
  noter('SANS OBJET : `AnalyticsSujet.astro` absent');
} else {
  const src = nuAstro(readFileSync(sujet, 'utf8'));
  // ⭐ On juge la FABRIQUE, pas ses appelants : `tab()` est le point unique par
  // lequel passent tous les tableaux d'analytics. Un banc branché sur le seul
  // module des sets serait vert le jour où le module suivant rouvre le trou.
  const fab = (src.match(/var tab = function[\s\S]*?\n  \};/) || [''])[0];
  dire(/tbl-hote--borne/.test(fab), '`tab()` — la fabrique unique — pose la classe bornée');
  dire(/tabindex="0"/.test(fab),
    '`tab()` rend la zone défilante atteignable au clavier'
    + (/tabindex="0"/.test(fab) ? '' : "\n     ⛔ `.tbl-hote` défile déjà en X sans être tabulable : le manque est ANTÉRIEUR au bornage."));
}

// ═══ §4 — LE BANDEAU-OUTIL : UN SEUL RÔLE, UNE SEULE FORME ═══════════════
console.log('\n§4 — les pages-outil se coiffent toutes de la même bande');

// 🔴🔴 CE § EXISTE PARCE QUE LE MÊME RÔLE ÉTAIT ÉCRIT QUATRE FOIS. Mesuré en
// production le 06/09 : `.sect-t.sect-t--gd` sur les rayons, `.wrap` sur
// `/market/`, un `<div>` nu sur `/collections/` et sur `/collection/<x>/` —
// quatre enveloppes, trois traitements du compte, un seul rôle.
// ⛔ Et comme le §1, CE BANC NE REND RIEN : il juge la FORME qui produit la
// bonne page, pas des pixels.
{
  const fT = join(R, 'themes/vitrine/theme.css');
  if (!existsSync(fT)) noter('SANS OBJET : pas de thème vitrine ici');
  else {
    const css = nuCss(readFileSync(fT, 'utf8'));
    const bloc = (css.match(/\.bandeau\s*\{([^}]*)\}/) || [])[1] || '';
    dire(!!bloc, '`.bandeau` existe dans le thème vitrine');
    dire(/border-bottom\s*:/.test(bloc), '…et il porte le filet   — ' + (bloc.match(/border-bottom[^;]*/) || ['(aucun)'])[0].trim());
    // ⭐ Le bandeau doit être RESTYLÉ en PC : sans cette bascule, le titre
    // resterait en capitales et la bande n'aurait pas sa hauteur de 80 px.
    //
    // 🔴🔴🔴 CETTE LIGNE A ÉTÉ ÉCRITE FAUSSE, ET L'INJECTION L'A MONTRÉ. Elle
    // cherchait `/@media \(min-width: 821px\)[\s\S]*?\.bandeau\b/`. Deux trous,
    // tous deux invisibles à la lecture :
    //   ① `\b` entre « u » et « - » EST une frontière de mot ⇒ le renommage en
    //      `.bandeau-INEXISTANT` satisfaisait le motif. Le banc restait VERT
    //      alors que plus une règle PC ne portait sur `.bandeau`.
    //   ② `[\s\S]*?` ne s'arrête pas à l'accolade fermante du `@media` : il
    //      pouvait sauter le bloc entier et mordre sur un `.bandeau` écrit
    //      n'importe où PLUS BAS dans la feuille.
    // ⇒ On délimite donc le bloc pour de vrai, puis on exige un sélecteur qui
    //   soit EXACTEMENT `.bandeau` — suivi de `{`, `>`, `,` ou d'un descendant.
    // ⭐⭐ *Un banc branché sur une orthographe est satisfait par le voisin qui
    //   la contient.*
    const bloc821 = (() => {
      const i = css.search(/@media\s*\(min-width:\s*821px\)\s*\{/);
      if (i < 0) return '';
      let j = css.indexOf('{', i), p = 0;
      for (let k = j; k < css.length; k++) {
        if (css[k] === '{') p++;
        else if (css[k] === '}' && --p === 0) return css.slice(j + 1, k);
      }
      return '';
    })();
    const pc = /\.bandeau\s*(?:[{>,]|[a-z])/i.test(bloc821)
      && /\.bandeau\s*(?:\{|>|,|[a-z][^{,]*\{)/i.test(bloc821);
    dire(pc, 'il est redéclaré au-delà de 820 px (la vue PC de la maquette)');
    // ⛔ Le mur : aucun jeton de PRIX n'a le droit d'entrer dans cette bande.
    const sale = ['floor', 'listings', 'ath', 'atl', 'prixMedian', 'change7d']
      .filter((m) => new RegExp(`\\.bandeau[^{]*\\{[^}]*${m}`, 'i').test(css));
    dire(sale.length === 0, sale.length === 0
      ? 'aucun jeton de prix dans la bande'
      : `🔴 le bandeau touche à ${sale.join(', ')} — le mur du prix passe par là`);
  }
}

// ── Les quatre familles l'emploient-elles VRAIMENT ? ──────────────────────
// ⭐⭐ On lit la SOURCE DÉCAPÉE, pas `dist/` : `/market/` est rendue à la
// demande (`prerender = false`), son HTML n'existe nulle part dans le build.
// C'est exactement le trou que `test:images` §3b avait trouvé par injection.
{
  const FAMILLES = [
    ['les rayons', 'src/components/Rayon.astro'],
    ['/market/', 'src/components/pages/Market.astro'],
    ['/collections/', 'src/components/pages/Collections.astro'],
    ['/collection/<x>/', 'src/components/pages/CollectionPage.astro'],
  ];
  let vus = 0;
  for (const [quoi, rel] of FAMILLES) {
    const abs = join(R, rel);
    if (!existsSync(abs)) { noter(`SANS OBJET : ${rel} absent`); continue; }
    vus++;
    const src = nuAstro(readFileSync(abs, 'utf8'));
    dire(/from '.*BandeauOutil\.astro'/.test(src) && /<BandeauOutil\b/.test(src),
      `${quoi} — coiffée par \`<BandeauOutil>\``);
    // 🔑 ET SON TITRE NE DOIT PLUS ÊTRE ÉCRIT À CÔTÉ : un `<h1>` resté dans le
    // gabarit ferait DEUX titres, et c'est le genre de doublon qu'un œil ne
    // voit pas parce que les deux sont justes.
    dire(!/<h1\b/.test(src),
      `${quoi} — aucun \`<h1>\` ne subsiste hors du bandeau`);
  }
  if (!vus) dire(false, '🔴 aucune famille lue : ce banc ne juge rien, et il le dit');
}

// ── Et dans ce qui EST pré-généré : jamais deux titres ────────────────────
{
  const D = join(R, 'dist/client');
  if (!existsSync(D)) noter('SANS OBJET : pas de `dist/client` (build non joué)');
  else {
    const html = [];
    const marche = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) marche(p); else if (e.name.endsWith('.html')) html.push(p);
    } };
    marche(D);
    const avec = html.filter((f) => /class="bandeau"/.test(readFileSync(f, 'utf8')));
    if (!avec.length) noter('SANS OBJET : aucune page pré-générée ne porte le bandeau');
    else {
      const doubles = avec.filter((f) => (readFileSync(f, 'utf8').match(/<h1\b/g) || []).length !== 1);
      dire(doubles.length === 0, doubles.length === 0
        ? `${avec.length} page(s) pré-générée(s) avec bandeau, toutes à UN seul <h1>`
        : `🔴 ${doubles.length} page(s) n'ont pas exactement un <h1> — la maquette a deux VUES, le DOM n'a qu'un titre`);
      // ⭐ Et le titre doit être DANS la bande, pas posé à côté d'elle.
      const dehors = avec.filter((f) => !/<div class="bandeau">[\s\S]{0,400}?<h1\b/.test(readFileSync(f, 'utf8')));
      dire(dehors.length === 0, dehors.length === 0
        ? '…et sur chacune, le <h1> est à l\'intérieur de la bande'
        : `🔴 ${dehors.length} page(s) portent la bande et un titre AILLEURS`);
    }
  }
}


// ═══ §5 — LA BARRE DE FILTRES A DEUX FORMES, ET UNE SEULE SOURCE ══════════
// 🔴🔴🔴 CE QUE CE PARAGRAPHE PROTÈGE, ET IL A ÉTÉ ÉCRIT DEFAUT PAR DÉFAUT.
// Le LOT D ne change aucun filtre : il change la FORME de la barre. Les pannes
// possibles sont donc toutes des pannes de forme, et elles ont ceci de commun
// qu'AUCUNE NE CASSE LE BUILD — le site se construit, les bancs de filtrage
// restent verts, et la page est simplement fausse à l'œil.
//   ① l'enveloppe disparaît d'une page-outil ⇒ le rail redevient une bande ;
//   ② la colonne de contenu disparaît ⇒ la grille place la liste, la
//      pagination et le « voir plus » dans TROIS cellules, donc trois lignes,
//      donc la pagination sous le rail ;
//   ③ `data-rail` tombe ⇒ les six groupes redeviennent exclusifs, en silence :
//      on ouvre Tirage, Rareté se referme, et rien ne le signale ;
//   ④ la feuille perd son état ouvert ⇒ un bouton qui n'ouvre rien ;
//   ⑤ le rail perd `position:static` ⇒ il reste collé en bas de l'écran, en
//      PC, par-dessus le contenu — le défaut le plus laid, et le plus facile
//      à écrire : il suffit d'oublier de DÉFAIRE ce que la feuille a posé ;
//   ⑥ les deux seuils divergent : 1 041 dans le thème, 1 041 dans `rail.js`.
//      C'est une duplication assumée (le module ne peut pas lire une feuille
//      qui n'est pas encore arrivée) ; ce qui n'est pas assumé, c'est qu'elle
//      diverge sans que personne ne le voie.
//   ⑦ un CHIFFRE entre dans le mur de l'anonyme — l'arbitrage de Preda du
//      06/09 est « ouvrir la FORME, fermer tout CHIFFRE ».
//
// ⚠️ ET LE PARAGRAPHE LIT `dist/` POUR LES QUATRE PREMIERS. Il faut donc que
// le build ait tourné AVANT — c'est l'ordre de la chaîne (build ⇒ marquer:i18n
// ⇒ npm test), et c'est ce qui a fait croire, le 06/09, qu'une injection ne
// mordait pas alors qu'elle n'avait simplement pas été reconstruite.
console.log('\n§5 — la barre de filtres : un rail en PC, une feuille en mobile');
{
  const css = nuCss(readFileSync(join(DOSSIER, 'vitrine', 'theme.css'), 'utf8'));

  // ── ⑤ et ④ : les deux formes existent, et la seconde DÉFAIT la première ──
  // ⭐⭐ On ne cherche pas « `.barre-f` apparaît quelque part » : ce nom est
  // servi depuis le lot 155 et le contrôle serait vert sans rien surveiller.
  // On cherche les DEUX déclarations qui font la bascule, chacune dans son
  // contexte. C'est la leçon du 06/09 : `\b` entre « u » et « - » est une
  // frontière de mot, et `.bandeau-INEXISTANT` satisfaisait `\.bandeau\b`.
  const blocPC = (() => {
    // ⛔ PAS de `[\s\S]*?` pour attraper le bloc : il ne s'arrête pas à
    // l'accolade fermante du `@media` et mordrait sur n'importe quelle règle
    // écrite plus bas. On délimite par COMPTAGE d'accolades — même méthode
    // qu'au §4, et pour la même raison payée le même jour.
    const i = css.indexOf('@media (min-width:1041px)');
    if (i < 0) return '';
    let n = 0, j = css.indexOf('{', i);
    for (let k = j; k < css.length; k++) {
      if (css[k] === '{') n++;
      else if (css[k] === '}') { n--; if (!n) return css.slice(j + 1, k); }
    }
    return '';
  })();

  dire(blocPC.length > 0, blocPC.length > 0
    ? `le thème porte un bloc PC à 1 041 px (${blocPC.length} caractères)`
    : '🔴 aucun `@media (min-width:1041px)` — le rail n\'a pas de forme PC');

  dire(/\.barre-f\s*\{[^}]*position:\s*fixed/.test(css), /\.barre-f\s*\{[^}]*position:\s*fixed/.test(css)
    ? '…la feuille est hors flux (`position:fixed`) sous le seuil'
    : '🔴 `.barre-f` n\'est plus une feuille : elle redeviendrait une bande sur mobile');

  dire(/\.barre-f\s*\{[^}]*position:\s*static/.test(blocPC), /\.barre-f\s*\{[^}]*position:\s*static/.test(blocPC)
    ? '…et le rail lui REND son flux (`position:static`) — la feuille est défaite, pas complétée'
    : '🔴 le bloc PC ne défait pas `position:fixed` — le rail resterait collé en bas de l\'écran');

  dire(/\.barre-f\[data-ouverte\]/.test(css), /\.barre-f\[data-ouverte\]/.test(css)
    ? '…et la feuille a un état OUVERT, sinon son bouton n\'ouvre rien'
    : '🔴 aucune règle `.barre-f[data-ouverte]` — le déclencheur poserait un attribut sans effet');

  dire(/\.avec-rail\s*\{[^}]*display:\s*grid/.test(blocPC), /\.avec-rail\s*\{[^}]*display:\s*grid/.test(blocPC)
    ? '…et l\'enveloppe devient une grille de deux colonnes en PC'
    : '🔴 `.avec-rail` ne devient pas une grille : le rail se poserait AU-DESSUS de la liste');

  // ── ⑥ : le seuil du thème et celui du module ne divergent pas ────────────
  // ⭐⭐ C'EST LE SEUL CONTRÔLE DE CE PARAGRAPHE QUI COMPARE DEUX FICHIERS, et
  // c'est le plus utile : la duplication est assumée, donc invisible à la
  // relecture. Un jour on déplacera le rail à 1 200 px dans le thème, la
  // feuille se fermera toujours à 1 041 dans le module, et l'écart de 159 px
  // servira une feuille repliée sur un rail déjà affiché.
  const railJs = readFileSync(join(R, 'src/socle/modules/rail.js'), 'utf8');
  const seuilJs = (railJs.match(/matchMedia\(['"]\(min-width:\s*(\d+)px\)['"]\)/) || [])[1];
  dire(seuilJs === '1041', seuilJs === '1041'
    ? `…et le module lit le MÊME seuil que le thème (${seuilJs} px)`
    : `🔴 le module lit ${seuilJs || '(aucun)'} px là où le thème bascule à 1 041`);

  // ── ⑦ : le mur de l'anonyme ne porte aucun chiffre ──────────────────────
  const barre = readFileSync(join(R, 'src/components/BarreRayon.astro'), 'utf8');
  const mur = (nuAstro(barre).match(/<div class="rail-mur"[\s\S]*?<\/div>/) || [''])[0];
  dire(mur.length > 0, mur.length > 0
    ? 'le mur de l\'anonyme existe et nomme les axes'
    : '🔴 pas de `.rail-mur` : un visiteur sans compte ne voit plus ce que le compte ouvre');
  // ⛔ On cherche un CHIFFRE, pas un nom de champ : `{o.l}` est un libellé,
  // `812` serait un compte d'options. L'arbitrage du 06/09 ferme le second.
  const chiffres = (mur.match(/>\s*\d[\d\s,.]*\s*</g) || []);
  dire(chiffres.length === 0, chiffres.length === 0
    ? '…et il ne porte AUCUN chiffre — la forme est ouverte, le chiffre reste fermé'
    : `🔴 ${chiffres.length} chiffre(s) dans le mur : ${chiffres.join(' · ').slice(0, 60)}`);

  // ── ⑧ : le déclencheur a sa règle de membre, EN LIGNE ────────────────────
  // 🔴 Sans elle, `.f-lancer[data-membre][hidden]` reste masqué POUR TOUT LE
  // MONDE : le membre n'a plus de bouton pour ouvrir la feuille, et il n'a pas
  // non plus de barre — elle est hors écran. La page perd ses filtres en
  // silence. ⚠️ Et la règle doit être dans l'EN-TÊTE EN LIGNE, pas dans le
  // thème : la feuille externe arrive parfois après la première peinture
  // (règle du 05/09, `regle-variable-de-marque-est-locale`).
  const base = readFileSync(join(R, 'src/layouts/Base.astro'), 'utf8');
  const enLigne = (base.match(/<style is:inline>[\s\S]*?<\/style>/g) || []).join('\n');
  dire(/\.f-lancer\[data-membre\]\[hidden\]/.test(enLigne),
    /\.f-lancer\[data-membre\]\[hidden\]/.test(enLigne)
      ? '…et le déclencheur de la feuille a sa règle de membre, EN LIGNE dans l\'en-tête'
      : '🔴 aucune règle en ligne pour `.f-lancer` : le membre n\'aurait aucun bouton de filtres');

  // ── ⑨ : les deux nombres ont chacun UN seul producteur ───────────────────
  const pilote = readFileSync(join(R, 'src/socle/modules/rayon.js'), 'utf8');
  const ecrit = (pilote.match(/data-retenues/g) || []).length;
  dire(ecrit === 1, ecrit === 1
    ? '…le pilote écrit `data-retenues` une seule fois, là où il connaît le nombre'
    : `🔴 ${ecrit} occurrence(s) de \`data-retenues\` dans le pilote — deux producteurs, deux vérités`);
  dire(!/querySelectorAll\([^)]*rayon__l/.test(railJs) && !/\.children\.length/.test(railJs.split('actifs')[0] || ''),
    'et le module de forme ne recompte RIEN par lui-même — il recopie');

  // ── ①②③ : ce que la production SERT ─────────────────────────────────────
  const D = join(R, 'dist');
  if (!existsSync(D)) noter('INDÉCIDABLE : pas de `dist/` — ce contrôle se juge APRÈS le build');
  else {
    const html = [];
    const marche = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) marche(p); else if (e.name.endsWith('.html')) html.push(p);
    } };
    marche(D);
    // 🔴🔴 ON CHERCHE UN USAGE, PAS UN IDENTIFIANT. Brancher ce contrôle sur
    // `id="f-rayon"` l'aurait limité aux deux rayons, et `/sets/` — qui porte
    // la MÊME barre sous `id="f-sets"` — serait sorti du périmètre sans que
    // personne ne le remarque. C'est la faute payée le 06/09 sur le bandeau :
    // « hero apparaît 24 fois » répondait à un nom, pas à un usage.
    // ⚠️ `/market/` porte lui aussi une `.barre-f`, mais il est rendu à la
    // demande (`prerender = false`) : il n'est PAS dans `dist/`, donc pas jugé
    // ici. C'est une absence, pas une conformité — elle est écrite au trou.
    const avecBarre = html.filter((f) => /class="barre-f"/.test(readFileSync(f, 'utf8')));
    if (!avecBarre.length) noter('SANS OBJET : aucune page pré-générée ne porte de barre de filtres');
    else {
      const sansEnv = avecBarre.filter((f) => !/class="avec-rail"/.test(readFileSync(f, 'utf8')));
      dire(sansEnv.length === 0, sansEnv.length === 0
        ? `${avecBarre.length} page(s) servent la barre, toutes dans leur enveloppe`
        : `🔴 ${sansEnv.length} page(s) servent une barre SANS enveloppe — le rail y serait une bande`);

      const sansCol = avecBarre.filter((f) => !/class="avec-rail__c"/.test(readFileSync(f, 'utf8')));
      dire(sansCol.length === 0, sansCol.length === 0
        ? '…et chacune a sa colonne de contenu — la pagination reste à côté du rail, pas dessous'
        : `🔴 ${sansCol.length} page(s) sans \`.avec-rail__c\` : la grille éclaterait la liste en trois cellules`);

      const sansRail = avecBarre.filter((f) => !/class="barre-f"[^>]*data-rail/.test(readFileSync(f, 'utf8')));
      dire(sansRail.length === 0, sansRail.length === 0
        ? '…et chacune porte `data-rail` : les six groupes s\'ouvrent ensemble'
        : `🔴 ${sansRail.length} page(s) sans \`data-rail\` — les panneaux redeviendraient exclusifs en silence`);

      // ⭐ Un groupe = un bouton ET son panneau, DANS le même parent. C'est ce
      // qui fait l'accordéon ; sans ça le panneau s'ouvre à 400 px de son
      // bouton et ne se rattache visuellement à rien.
      // ⭐⭐ AUTANT DE GROUPES QUE DE PANNEAUX, SUR CHAQUE PAGE — et surtout pas
      // « six », qui était vrai des deux rayons et faux de `/sets/` : il a
      // quatre axes, dont trois n'apparaissent que s'ils ont au moins deux
      // valeurs. Un contrôle qui grave le nombre 6 rougirait sur une page
      // parfaitement saine, et *un faux rouge se fait désarmer en trois jours.*
      const boiteux = avecBarre.filter((f) => {
        const t = readFileSync(f, 'utf8');
        const g = (t.match(/class="rail-g"/g) || []).length;
        const pan = new Set(t.match(/id="(?:rp|sp)-[a-z]+"/g) || []).size;
        return g === 0 || g !== pan;
      });
      dire(boiteux.length === 0, boiteux.length === 0
        ? `…et sur chacune, chaque axe a SON panneau dans son groupe (${avecBarre.map((f) => (readFileSync(f, 'utf8').match(/class="rail-g"/g) || []).length).join(' · ')})`
        : `🔴 ${boiteux.length} page(s) où un axe a perdu son panneau, ou l'inverse — l'accordéon est boiteux`);
    }
  }
}

console.log(echecs === 0
  ? '\n✅ pli : le nom passe devant, le focus se voit, le tableau tient, la barre a ses deux formes\n'
  : `\n❌ pli : ${echecs} contrôle(s) en défaut\n`);
process.exit(echecs ? 1 : 0);
