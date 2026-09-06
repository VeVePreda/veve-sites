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

console.log(echecs === 0
  ? '\n✅ pli : le nom passe devant, le focus se voit, le tableau tient dans la page\n'
  : `\n❌ pli : ${echecs} contrôle(s) en défaut\n`);
process.exit(echecs ? 1 : 0);
