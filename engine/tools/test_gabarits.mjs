// ⚠️ VeVePreda/veve-sites — engine/tools/test_gabarits.mjs
//
// ═══════════════════════════════════════════════════════════════════════════
//  POURQUOI CE BANC EXISTE — 30/07/2026, un build de production cassé
// ═══════════════════════════════════════════════════════════════════════════
//  Le déploiement de 09:35 est tombé à l'étape 17/20 sur :
//
//      [CompilerError] Expected `,` or `)` but found `class`
//        src/components/pages/Editorial.astro:187:13
//
//  La cause : un commentaire JSX glissé EN POSITION DE RETOUR d'une fonction
//  fléchée.
//
//      {items.map((r) => (
//        {/* … */}          ← ici
//        <div class="term" …>
//      ))}
//
//  Une flèche qui retourne entre parenthèses ne rend QU'UNE expression. Le
//  commentaire en était une, l'élément une seconde ; le compilateur s'arrête sur
//  le premier attribut qu'il ne sait plus lire — d'où le `found 'class'`.
//
//  ⭐⭐ CE QUI A MANQUÉ N'ÉTAIT PAS L'ATTENTION, C'ÉTAIT LA COUVERTURE DU
//  CONTRÔLE. J'avais annoncé « `node --check` vert » — c'était vrai, et sans
//  valeur : `node --check` ne lit que le FRONTMATTER (entre les `---`), et
//  j'avais modifié le GABARIT, en dessous. Un contrôle vert sur la partie qu'on
//  n'a pas changée ne dit rien de celle qu'on a changée, et fait pire : il donne
//  le sentiment d'avoir vérifié.
//
//  ⛔ CE BANC N'EST PAS UN COMPILATEUR. Il ne remplace pas `astro build` : il
//  attrape, en quelques millisecondes et sans dépendance, les fautes de forme
//  qui coûtent un déploiement complet. Le vrai compilateur passe juste après,
//  dans le même Dockerfile.
//
//  ⚠️ ET LE CONTRÔLE LUI-MÊME A UNE ZONE VALIDE : il ne regarde QUE le corps du
//  fichier. Ma première version scannait aussi le frontmatter, où `=> (` ouvre
//  légitimement une expression JS ou un objet — elle sortait 17 faux positifs.
//  L'instrument du contrôle avait le défaut du contrôle qu'il remplaçait.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = 'src';
let echecs = 0;
const dire = (ok, msg) => { if (!ok) echecs++; console.log(`  ${ok ? '✅' : '❌'} ${msg}`); };

/** Tous les .astro sous src/, en profondeur. */
function gabarits(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const chemin = join(dir, e);
    if (statSync(chemin).isDirectory()) gabarits(chemin, acc);
    else if (e.endsWith('.astro')) acc.push(chemin);
  }
  return acc;
}

/** Le CORPS d'un composant Astro : ce qui suit le frontmatter.
 *  Renvoie null quand le fichier n'a pas de frontmatter (rien à contrôler).
 *
 *  ⚠️⚠️ MA PREMIÈRE VERSION FAISAIT `source.split('---')` ET ELLE ÉTAIT FAUSSE.
 *  Les commentaires de ce dépôt sont pleins de séparateurs en tirets
 *  (`// ------------------------------`). `split('---')` coupait DEDANS, et le
 *  « corps » obtenu contenait encore la moitié du frontmatter : 19 faux
 *  positifs sur 48 fichiers, tous sur du code parfaitement correct.
 *  ⭐ Troisième fois dans la même journée que l'instrument est le fautif. Le
 *  frontmatter se délimite par des `---` SEULS SUR LEUR LIGNE, en tête de
 *  fichier — c'est ce que dit Astro, et c'est ce qu'on lit.
 *  ⛔ Une alarme qui crie sur du code sain ne se lit plus, puis se désarme. */
function corpsDe(source) {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(source);
  if (!m) return null;
  return { corps: source.slice(m[0].length), decalage: m[0].length };
}

const ligneDe = (source, i) => source.slice(0, i).split('\n').length;

// ─────────────────────────────────────────────────────────────────────────────
//  Les contrôles. Chacun renvoie la liste de ses griefs : { ligne, quoi }.
// ─────────────────────────────────────────────────────────────────────────────

/** ① Un commentaire JSX en position de RETOUR de flèche. Le défaut du 30/07.
 *
 *  ⚠️⚠️ CE CONTRÔLE A ÉTÉ RESSERRÉ, ET C'EST IMPORTANT.
 *  Ma première règle était « tout `=> (` du gabarit doit ouvrir sur un
 *  élément ». Elle sortait 2 griefs sur du code parfaitement valide :
 *      BlogPost.astro:56   `(tg) => (tagsAvecPage.has(tg) ? <a…> : …)`
 *      Base.astro:208      `(c) => ({ name: c.name, url: … })`
 *  Un ternaire, un objet — parfaitement légitimes DANS un conteneur
 *  d'expression `{…}`. Ma règle confondait « le corps du fichier » avec « du
 *  JSX pur », alors que le corps contient les deux.
 *  ⭐ On ne signale donc QUE ce qui est toujours faux : un commentaire JSX
 *  `{/* … *\/}` n'est valide qu'en position d'ENFANT, jamais en expression.
 *  ⛔ Un contrôle qui crie sur du code sain finit désarmé — c'est la faute que
 *  ce dépôt a déjà payée avec les « 45 attentes d'upload dont aucune vraie ». */
function retoursDeFleche(source) {
  const c = corpsDe(source);
  if (!c) return [];
  const griefs = [];
  for (const m of c.corps.matchAll(/=>\s*\(\s*\{\/\*/g)) {
    griefs.push({
      ligne: ligneDe(source, c.decalage + m.index),
      quoi: 'commentaire JSX en position de retour de flèche : une flèche ne rend '
          + 'QU\'UNE expression. Le remonter dans les enfants du parent.',
    });
  }
  return griefs;
}

/** ② Accolades équilibrées dans le corps : une expression non fermée décale
 *  tout ce qui suit, et le message du compilateur désigne alors une ligne
 *  parfaitement innocente. */
function accolades(source) {
  const c = corpsDe(source);
  if (!c) return [];
  const o = (c.corps.match(/\{/g) || []).length;
  const f = (c.corps.match(/\}/g) || []).length;
  return o === f ? [] : [{ ligne: 0, quoi: `accolades déséquilibrées dans le corps : ${o} ouvertes, ${f} fermées` }];
}

/** ③ Balises de bloc équilibrées. On ne vérifie que celles qui portent la
 *  structure — pas les balises auto-fermantes ni celles qui tolèrent l'omission. */
const BALISES = ['div', 'section', 'ol', 'ul', 'dl', 'nav', 'main', 'header', 'footer', 'figure', 'table'];
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 103 — CE CONTRÔLE COMPTAIT LES BALISES ÉCRITES DANS LES COMMENTAIRES
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 07/08 : le lot 103 remplace trois `<table class="fiche-tbl">` par
// des `<dl>` et l'explique dans un commentaire JSX qui CITE les deux balises.
// Ce contrôle a compté « <dl> : 6 ouvertes, 4 fermées » sur un fichier qui
// construit parfaitement — les deux surnuméraires étaient dans la prose.
//
// ⭐⭐⭐ « UN BANC QUI POUSSE À RECOPIER CE QU'IL VÉRIFIE TRAVAILLE CONTRE
// LUI-MÊME. » Ce dépôt porte déjà la leçon (le lecteur d'attributs de
// `test:session`, réparé trois fois) et elle s'est repayée DEUX FOIS le 07/08 :
// ici, et sur `test:session` qui rougissait sur un commentaire citant un nom de
// cookie près d'un appel d'accès.
// ⛔ LA RÉPONSE N'EST PAS DE NE PLUS DOCUMENTER. Un banc qui rend la
// documentation coûteuse obtient exactement ce qu'il mérite : des fichiers
// silencieux. On corrige l'INSTRUMENT — jamais le code, pour lui faire plaisir.
//
// ⚠️ On retire les commentaires JSX `{/* … */}` ET les commentaires de ligne
// `//` du corps. ⭐ On les remplace par un ESPACE et non par du vide : les
// numéros de ligne des autres contrôles se calculent sur des décalages, et
// écraser des caractères sans les compter les décalerait tous.
const sansCommentaires = (corps) => corps
  .replace(/\{\/\*[\s\S]*?\*\//g, (bloc) => ' '.repeat(bloc.length))
  .replace(/^\s*\/\/.*$/gm, (bloc) => ' '.repeat(bloc.length));

function balises(source) {
  const c = corpsDe(source);
  if (!c) return [];
  const griefs = [];
  const propre = sansCommentaires(c.corps);
  for (const t of BALISES) {
    // ⭐ `propre` et non `c.corps` : voir l'en-tête de ce bloc.
    const o = (propre.match(new RegExp(`<${t}[\\s>]`, 'g')) || []).length;
    const f = (propre.match(new RegExp(`</${t}>`, 'g')) || []).length;
    // ⚠️ Les AUTO-FERMANTES ne comptent pas : `<div class="legal" set:html={…} />`
    // est parfaitement valide en Astro et n'attend aucune fermeture. Sans cette
    // soustraction, le banc accusait LegalPage.astro d'un `<div>` non fermé.
    const auto = (propre.match(new RegExp(`<${t}[^>]*/>`, 'g')) || []).length;
    if (o - auto !== f) {
      griefs.push({ ligne: 0, quoi: `<${t}> : ${o - auto} ouverte(s), ${f} fermée(s)` });
    }
  }
  return griefs;
}

const CONTROLES = [
  ['retour de flèche', retoursDeFleche],
  ['accolades', accolades],
  ['balises de bloc', balises],
];

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n1. Les gabarits du dépôt');
const fichiers = gabarits(RACINE);
dire(fichiers.length > 0, `${fichiers.length} fichier(s) .astro trouvé(s)`);

let griefsTotaux = 0;
for (const f of fichiers) {
  const source = readFileSync(f, 'utf8');
  for (const [nom, controle] of CONTROLES) {
    for (const g of controle(source)) {
      griefsTotaux++;
      console.log(`  ❌ ${f}${g.ligne ? ':' + g.ligne : ''} — [${nom}] ${g.quoi}`);
    }
  }
}
dire(griefsTotaux === 0, `aucun défaut de forme — ${griefsTotaux} grief(s)`);

// ─────────────────────────────────────────────────────────────────────────────
//  ⭐⭐ CONTRE-ÉPREUVE — un banc se juge sur ce qu'il LAISSE PASSER.
//  On ne se contente pas de vérifier qu'il est vert : on lui soumet les fautes
//  qu'il prétend attraper, UNE PAR UNE, et on exige qu'il rougisse à chaque
//  fois. Un test qui n'affirme que la propriété souhaitée passe pour de
//  mauvaises raisons.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Contre-épreuve : chaque faute doit le faire rougir');

const SAIN = `---
const items = [];
const f = (a, b) => ({ a, b });
const g = (x) => (x > 2 ? 'oui' : 'non');
---
<div class="wrap">
  {items.map((r) => (
    <span class="x">{r}</span>
  ))}
</div>
`;
dire(CONTROLES.every(([, c]) => c(SAIN).length === 0),
     'un gabarit sain passe (y compris ses `=> (` de frontmatter)');

const MUTATIONS = [
  ['commentaire JSX en retour de flèche (le défaut du 30/07)',
   SAIN.replace('    <span class="x">{r}</span>', '    {/* note */}\n    <span class="x">{r}</span>')],
  ['accolade non fermée',
   SAIN.replace('<div class="wrap">', '<div class="wrap">\n  {items.length > 0 && (<b>x</b>)')],
  ['<div> non fermé',
   SAIN.replace('</div>\n', '')],
];
for (const [nom, mute] of MUTATIONS) {
  const vu = CONTROLES.reduce((n, [, c]) => n + c(mute).length, 0);
  dire(vu > 0, `mutation détectée — ${nom}`);
}

// ⚠️ Le faux positif que ma première version produisait : le frontmatter d'un
// vrai composant contient des `=> (` légitimes. S'il était scanné, ce contrôle
// crierait sur du code correct — et une alarme qui crie sur tout ne se lit plus.
const FRONTMATTER_PIEGEUX = `---
const ld = items.map((r) => ({ name: r.nom, url: r.url }));
const social = (v) => (/^https?:/.test(v) ? v : null);
---
<p>ok</p>
`;
dire(retoursDeFleche(FRONTMATTER_PIEGEUX).length === 0,
     'les `=> (` du FRONTMATTER ne déclenchent rien (17 faux positifs évités)');

// Les deux faux positifs que mes premières versions produisaient, figés ici :
// tant qu'ils sont verts, le banc ne peut plus les refabriquer.
const TIRETS_DANS_UN_COMMENTAIRE = `---
// ---------------------------------------------------------------------------
const f = (a) => ({ a });
// ---------------------------------------------------------------------------
---
<div class="x">{[].map((r) => (<b>{r}</b>))}</div>
`;
dire(CONTROLES.every(([, c]) => c(TIRETS_DANS_UN_COMMENTAIRE).length === 0),
     'un séparateur en tirets DANS le frontmatter ne coupe pas le fichier');

const TERNAIRE_ET_OBJET = `---
const c = [];
---
<div>
  {c.map((tg) => (tg.ok ? <a href="#">{tg.n}</a> : <span>{tg.n}</span>))}
  <Fragment set:html={JSON.stringify(c.map((x) => ({ name: x.n })))} />
</div>
`;
dire(retoursDeFleche(TERNAIRE_ET_OBJET).length === 0,
     'un ternaire ou un objet en retour de flèche reste LÉGITIME dans le corps');

const AUTO_FERMANTE = `---
const body = '';
---
<div class="legal" set:html={body} />
`;
dire(balises(AUTO_FERMANTE).length === 0,
     'une balise auto-fermante n\'est pas comptée comme non fermée');

// ─────────────────────────────────────────────────────────────────────────────
console.log(echecs === 0
  ? `\n✅ gabarits : tout est vert (${fichiers.length} fichiers, ${CONTROLES.length} contrôles)\n`
  : `\n❌ gabarits : ${echecs} échec(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
