/* ═══════════════════════════════════════════════════════════════════════════
   CSS MORT — les règles qui ne s'appliqueront JAMAIS, et ne le diront jamais
   ═══════════════════════════════════════════════════════════════════════════
   ⭐⭐ ÉCRIT LE 31/07/2026, APRÈS AVOIR LIVRÉ UN SITE DONT TOUTE LA GRAMMAIRE
   RESPONSIVE ÉTAIT MORTE DEPUIS LE PREMIER JOUR.

   Trois défauts, la même signature : le navigateur fait exactement ce qu'on lui
   a écrit, donc rien n'échoue, donc rien ne le dit.

   1. `@container X (...)` sans que rien ne déclare `container-name: X`.
      34 blocs inertes. Aucune erreur, aucun log, aucun build rouge.
   2. Une classe que le moteur ÉMET et pour laquelle le thème n'a AUCUNE règle.
      `body`, `header.site`, `nav.main`, `footer.site` avaient disparu : le blog,
      les mentions légales et la 404 étaient en HTML brut en production.
   3. `var(--x)` sans `--x` défini nulle part : la déclaration est ignorée.

   ⛔ MON COMPARATEUR DE FIDÉLITÉ NE POUVAIT VOIR AUCUN DES TROIS. Il vérifiait
   que la classe était dans le GABARIT — jamais qu'une RÈGLE existait pour elle.
   Il contrôlait le mauvais côté du contrat, et notait 92,9 % pendant que le
   site s'affichait en Times.

   Usage :  node outils/css-mort.mjs [racine]
*/
import fs from 'node:fs';
import path from 'node:path';

const R = process.argv[2] || '.';
const lire = (p) => fs.readFileSync(p, 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

function fichiers(d, re, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) fichiers(p, re, acc);
    else if (re.test(e.name)) acc.push(p);
  }
  return acc;
}

const themes = fichiers(path.join(R, 'themes'), /\.css$/);
const gabarits = fichiers(path.join(R, 'src'), /\.astro$/);
const gabaritsSrc = gabarits.map(lire).join('\n');
let griefs = 0;

for (const t of themes) {
  const brut = lire(t);
  const css = sansCommentaires(brut);
  const nom = path.relative(R, t);

  // ── 1 · un @container dont le conteneur n'est déclaré nulle part ────────
  const declares = new Set([...css.matchAll(/container-name\s*:\s*([\w-]+)/g)].map((m) => m[1]));
  // le raccourci `container: nom / type`
  for (const m of css.matchAll(/[^-]container\s*:\s*([\w-]+)\s*\//g)) declares.add(m[1]);
  const demandes = new Map();
  for (const m of css.matchAll(/@container\s+([\w-]+)\s*\(/g))
    demandes.set(m[1], (demandes.get(m[1]) || 0) + 1);
  for (const [c, n] of demandes) {
    if (!declares.has(c)) {
      griefs++;
      console.log(`⛔ ${nom}`);
      console.log(`   ${n} bloc(s) « @container ${c} » — RIEN ne declare container-name:${c}`);
      console.log(`   → ces ${n} bloc(s) ne s'appliqueront JAMAIS, sans une seule erreur.`);
    }
  }

  // ── 2 · var(--x) jamais defini ──────────────────────────────────────────
  // ⚠️ Les variables posees par un gabarit en style="--i:3" sont legitimes :
  // on les cherche donc AUSSI dans les .astro avant de crier.
  const definies = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const FOURNIES = ['--primary','--accent','--danger','--bg','--surface','--text',
                    '--muted','--font-heading','--font-body'];  // injectees par Base.astro
  FOURNIES.forEach((v) => definies.add(v));
  for (const m of gabaritsSrc.matchAll(/(--[\w-]+)\s*:/g)) definies.add(m[1]);
  // ⚠️ `var(--x, 2600)` est VALIDE meme si --x n'existe pas : le repli s'applique.
  // Un controle qui ignore le repli crie sur du code correct — et on finit par
  // ne plus l'ecouter. On ne retient que les lectures SANS repli.
  const sansRepli = new Set();
  for (const m of css.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g))
    if (m[2] === ')') sansRepli.add(m[1]);
  const orphelines = [...sansRepli].filter((v) => !definies.has(v));
  if (orphelines.length) {
    griefs++;
    console.log(`⛔ ${nom}`);
    console.log(`   ${orphelines.length} variable(s) lue(s) mais jamais definie(s) : ${orphelines.join(' ')}`);
    console.log(`   → chaque declaration qui les lit est ignoree, en silence.`);
  }
}

// ── 3 · une classe emise par le moteur, sans aucune regle dans le theme ────
// ⭐ C'EST LE CONTROLE QUI MANQUAIT. Le LISEZ-MOI disait « 27 classes, et c'est
// tout le contrat » — personne ne verifiait que le contrat etait tenu.
const SOCLE = ['wrap','card','grid','item','tag','stats','stat','lead','muted','up','down',
               'num','hide','crumbs','searchbox','chart','avertis','alerte','post','prose','legal'];
const BALISES = ['header.site','nav.main','footer.site','body','html'];
for (const t of themes) {
  const css = sansCommentaires(lire(t));
  const nom = path.relative(R, t);
  const absents = [
    ...SOCLE.filter((c) => !new RegExp(`\\.${c}[^\\w-]`).test(css)).map((c) => '.' + c),
    ...BALISES.filter((b) => !new RegExp(b.replace('.', '\\.') + '\\s*[,{]').test(css)),
  ];
  if (absents.length) {
    griefs++;
    console.log(`⛔ ${nom}`);
    console.log(`   ${absents.length} element(s) du socle SANS AUCUNE REGLE : ${absents.join(' ')}`);
    console.log(`   → les pages qui ne s'en servent que de ca (blog, legal, 404) sortent NUES.`);
  }
}

// ── 4 · une FAMILLE nommee que rien ne charge ─────────────────────────────
// ⭐⭐ AJOUTE LE 31/07/2026, APRES AVOIR LIVRE TOUS LES PRIX DU SITE EN
// CHASSE FIXE. Le theme declarait `--tech:'Space Grotesk',ui-monospace,…` et
// 58 regles s'en servaient — `.prix`, `.num`, `.stat__v`, `.rang`, `.tarif__p`,
// `thead th` : tous les chiffres d'un site de prix. Le manifeste ne listait
// qu'Archivo dans `fonts.files`. Les 58 regles descendaient jusqu'a
// `ui-monospace` et s'affichaient dans la fonte a chasse fixe du systeme.
// ⛔ AUCUN DES TROIS CONTROLES CI-DESSUS NE POUVAIT LE VOIR : la variable
// EXISTE, les regles EXISTENT, la classe EXISTE. Une pile de replis qui
// aboutit est du CSS parfaitement valide. C'est la meme signature que les
// trois autres — le navigateur fait ce qu'on a ecrit, donc rien n'echoue —
// mais sur un axe que je n'avais pas pense a regarder : le CONTRAT ENTRE LE
// THEME ET LE MANIFESTE, pas le contrat entre le theme et le gabarit.
// ⭐ On ne juge QUE la premiere famille de la pile : les suivantes SONT le
// repli, les nommer est leur role. Et on ignore les familles generiques et les
// piles `ui-*` / `system-ui`, que le systeme fournit par definition.
const GENERIQUES = new Set(['inherit','initial','unset','revert','currentcolor','none',
  'serif','sans-serif','monospace','cursive','fantasy','system-ui','ui-serif',
  'ui-sans-serif','ui-monospace','ui-rounded','math','emoji','fangsong']);

// ce que le site charge REELLEMENT : @font-face du theme + fonts.files du manifeste
const chargees = new Set();
for (const t of themes)
  for (const m of sansCommentaires(lire(t)).matchAll(/@font-face[\s\S]*?font-family\s*:\s*['"]?([^;'"}]+)/g))
    chargees.add(m[1].trim().toLowerCase());
for (const mf of fichiers(path.join(R, 'sites'), /^manifest\.ya?ml$/))
  for (const m of lire(mf).matchAll(/^\s*-?\s*famille\s*:\s*['"]?([^'"\n#]+)/gm))
    chargees.add(m[1].trim().toLowerCase());

for (const t of themes) {
  const css = sansCommentaires(lire(t));
  const nom = path.relative(R, t);
  const manquantes = new Map();
  // les deux formes : `font-family: X, …` et `--v: X, …` lue par font-family
  // ⭐ ON COMPTE LES REGLES TOUCHEES, PAS LES DECLARATIONS DE LA PILE. Une
  // variable definie deux fois (jour + nuit) et lue par 58 regles annoncait
  // « 2 regle(s) ». Un grief qui sous-estime son ampleur d'un facteur 29 se
  // fait ranger dans les details — et c'est ainsi qu'un vrai defaut survit a
  // sa propre detection.
  const piles = [];
  for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/g)) piles.push([m[1], 1]);
  const vues = new Set();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*((?:'[^']+'|"[^"]+")[^;}]*)/g)) {
    if (vues.has(m[1])) continue;
    const lectures = [...css.matchAll(new RegExp(`font-family\\s*:\\s*var\\(\\s*${m[1]}\\s*[,)]`, 'g'))].length;
    if (lectures) { piles.push([m[2], lectures]); vues.add(m[1]); }
  }
  for (const [pile, poids] of piles) {
    const first = pile.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    if (!first || first.startsWith('var(') || GENERIQUES.has(first.toLowerCase())) continue;
    if (!chargees.has(first.toLowerCase()))
      manquantes.set(first, (manquantes.get(first) || 0) + poids);
  }
  for (const [fam, n] of manquantes) {
    griefs++;
    console.log(`⛔ ${nom}`);
    console.log(`   « ${fam} » est nommee en tete de ${n} pile(s) — RIEN ne la charge`);
    console.log(`   (ni @font-face dans un theme, ni « famille: » dans un manifeste).`);
    console.log(`   → ces ${n} regle(s) tombent dans le repli. Aucune erreur, aucun build rouge.`);
  }
}

// ── 5 · LE THEME DOIT HONORER `hidden` ────────────────────────────────────
// ⭐⭐ AJOUTE LE 31/07/2026, APRES AVOIR SERVI /movers/ AVEC LE TABLEAU **ET**
// LA GRILLE EN MEME TEMPS. La bascule Tableau/Tuiles pose bien l'attribut
// `hidden` ; la feuille du navigateur dit `[hidden]{display:none}` — une regle
// de specificite (0,1,0). N'IMPORTE QUELLE CLASSE du theme qui pose un
// `display:` la vaut et, declaree plus tard, la GAGNE. Neuf classes le
// faisaient : .tuiles .socle__fond .socle__gemme .socle__ext .hero__piece
// .logo .cadenas .col-carte__pile .tete-p__viz
// ⛔ Le moteur avait raison, le theme aussi : c'est la CASCADE entre les deux
// qui donnait le mauvais resultat. Encore « est-ce la ? » contre « est-ce ce
// qui gagne ? », sur un troisieme axe.
// ⭐ Le controle est volontairement GROSSIER — il ne cherche pas quelles
// classes entrent en conflit, il exige la seule ligne qui clot le sujet pour
// toutes, presentes et a venir : `[hidden]{display:none!important}`.
{
  const utiliseHidden = /\shidden(\s|=|\/|>|})/.test(gabaritsSrc);
  if (utiliseHidden) {
    for (const t of themes) {
      const css = sansCommentaires(lire(t));
      if (!/\[hidden\][^{]*\{[^}]*display\s*:\s*none/.test(css)) {
        griefs++;
        console.log(`⛔ ${path.relative(R, t)}`);
        console.log(`   des gabarits cachent avec l'attribut « hidden », mais ce theme ne le neutralise pas.`);
        console.log(`   → toute classe du theme qui pose un display: GAGNE contre [hidden] : l'element reste VISIBLE.`);
        console.log(`   → ajouter : [hidden]{display:none!important}`);
      }
    }
  }
}

// ── 0 · L'INSTRUMENT SE MESURE LUI-MEME ───────────────────────────────────
// ⛔⛔ CE BLOC EXISTE PARCE QUE CET OUTIL A DIT « ✅ 0 theme(s) » ET SORTI EN 0.
// `node css-mort.mjs --verbose` : le drapeau etait pris pour `argv[2]`, donc
// pour une racine, donc introuvable, donc zero theme lu, donc zero grief,
// donc feu vert. Le controle ecrit pour attraper le CSS qui ne crie pas ne
// criait pas lui-meme. Cable dans un Dockerfile avec un chemin qui bouge un
// jour, il aurait rendu un vert a vie — pire que pas de controle du tout,
// parce qu'un vert a vie a l'air d'etre une preuve.
// ⭐ LA REGLE : un controle qui n'a rien inspecte n'a rien prouve. Il doit
// echouer, jamais rassurer.
if (themes.length === 0) {
  console.log(`⛔ AUCUN theme lu sous « ${path.resolve(R, 'themes')} ».`);
  console.log(`   Racine invalide, ou drapeau pris pour un chemin (l'argument EST la racine).`);
  console.log(`   → un controle qui n'inspecte rien ne prouve rien : c'est un echec, pas un succes.`);
  process.exit(2);
}

console.log(griefs
  ? `\n⛔ ${griefs} grief(s) — du CSS qui ne s'appliquera jamais et ne le dira pas.`
  : `\n✅ ${themes.length} theme(s), ${gabarits.length} gabarit(s) : aucun @container orphelin, `
    + `aucune variable fantome, socle complet, aucune famille non chargee.`);
process.exit(griefs ? 1 : 0);
