// ⚠️ VeVePreda/veve-sites — engine/tools/test_familles_css.mjs  (NEUF — lot 225)
// ═══════════════════════════════════════════════════════════════════════════
// UNE FAMILLE EMPLOYÉE PAR DEUX GABARITS NE PEUT PAS VIVRE DANS UN `<style>`
// ═══════════════════════════════════════════════════════════════════════════
//
//     npm run test:familles          (aucun réseau, aucun build)
//
// 🔴🔴 LE DÉFAUT QUE CE BANC EXISTE POUR VOIR — MESURÉ, PAS SUPPOSÉ (04/09).
// Le lot 224 a livré `/classeur/` et `/mint-hunter/`, deux pages jumelles.
// `MintHunter.astro` portait ce commentaire :
//
//     « LES CLASSES `.cl-*` SONT PARTAGÉES AVEC `Classeur.astro`, ET C'EST
//       VOULU : deux pages jumelles, un seul jeu de règles. »
//
// C'était vrai des NOMS et faux des RÈGLES. Astro PORTE le `<style>` d'un
// composant à ce composant : les règles vivaient chez `Classeur.astro` et
// n'atteignaient jamais Mint Hunter, qui avait donc les classes et rien
// derrière. Mesuré sur la page SERVIE, à 375 px :
//   · `.cl-w` calculait `overflow-x: visible` (contre `auto` chez le jumeau) ;
//   · la table faisait 450 px dans un cadre de 343 ;
//   · `main.wrap` est en `overflow-x: clip` ⇒ il a AVALÉ le dépassement :
//     `scrollWidth === clientWidth === 375`, aucune barre de défilement ;
//   · la colonne « Listed » occupait x=402→466 — invisible ET inatteignable.
// ⭐⭐ AUCUN SYMPTÔME. Pas d'erreur, pas de débordement, pas de page qui
// défile de travers : juste une colonne absente. Une capture rapide ne l'aurait
// pas montrée — il a fallu demander `getComputedStyle` au navigateur.
//
// 🔬 POURQUOI `test:opacite` NE L'A PAS VU, ET CE N'EST PAS SA FAUTE. Il compte
// le CSS MORT : une règle que personne n'emploie. Ici la règle était employée
// — par un fichier — et la classe employée par deux. Des deux côtés, tout
// paraissait vivant. *Un banc branché sur « ce nom sert-il ? » ne peut pas
// répondre « la règle atteint-elle ceux qui s'en servent ? ».* Deux questions,
// deux instruments. ⛔ Ne pas fondre celui-ci dans celui-là.
//
// ⭐⭐ CE QUE CE BANC NE MESURE PAS, ET IL FAUT LE LIRE AVANT DE S'Y FIER :
//   · il ne juge PAS la cascade (spécificité, ordre) — seulement la PORTÉE ;
//   · il ne voit que les classes écrites en clair dans un `class="…"` : une
//     classe calculée (`class={x ? 'cl-w' : ''}`) lui échappe, et c'est écrit
//     ici pour que personne ne conclue « aucune classe dynamique n'existe » ;
//   · un `<style is:global>` est EXEMPT — c'est précisément la sortie prévue
//     par Astro pour ce cas, et l'employer n'est pas une faute.
//   ⇒ Verdicts possibles : conforme · écart · SANS OBJET. Jamais « tout va
//     bien partout ».

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RACINE = process.env.PROJECT_ROOT || process.cwd();
const SRC = join(RACINE, 'src');

let echecs = 0;
const dit = (ok, quoi, detail = '') => {
  if (!ok) echecs++;
  console.log(`${ok ? '  ✅' : '  ❌'} ${quoi}${detail ? ' — ' + detail : ''}`);
};

const astros = [];
(function marcher(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) marcher(p);
    else if (e.endsWith('.astro')) astros.push(p);
  }
})(SRC);

// ⚠️ `[\s\S]` ET PAS `.` : un `<style>` tient sur plusieurs lignes, et `.` ne
// franchit pas le saut de ligne. Sans ça, ce banc ne lirait que les styles
// écrits sur UNE ligne — c'est-à-dire aucun — et serait vert pour rien.
// 🔴🔴 ON DÉCAPE LES COMMENTAIRES AVANT DE CHERCHER UN NOM, ET CETTE LIGNE A
// ÉTÉ PAYÉE DEUX FOIS. Sans elle, l'INJECTION de contrôle est passée au VERT :
// le bloc que j'avais ajouté au thème explique le défaut en prose et y écrit
// « `.cl-w` » — le banc trouvait donc `.cl-w` « au thème » et déclarait la
// classe servie, alors que plus AUCUNE règle ne la posait.
// ⭐⭐ *Un banc qui cherche un NOM trouve le commentaire qui l'explique.* La
// règle était écrite dans ma propre note ; l'avoir écrite ne l'applique pas.
// ⇒ On ne cherche que la forme EXÉCUTÉE.
// ⚠️ TROIS FORMES DE COMMENTAIRE, PARCE QUE CE DÉPÔT LES EMPLOIE TOUTES TROIS,
//    et que ce banc s'est trompé UNE FOIS PAR FORME avant de le comprendre :
//      · `/* … */`   — CSS et JS  → il croyait `.cl-w` posée par le thème ;
//      · `{/* … */}` — le commentaire Astro dans le BALISAGE → il a rendu
//        `.tableau-bord` « employée par Home.astro » alors que la seule
//        occurrence est une phrase expliquant que l'élément a été RETIRÉ au
//        lot 134 ; l'autre moitié du faux venait du même mot chez `Base.astro` ;
//      · `<!-- … -->` — HTML, par prudence : rien ne l'interdit ici.
// ⭐⭐ LE MÊME DÉFAUT, TROIS FOIS, DANS LE BANC ÉCRIT POUR LE VOIR AILLEURS.
//    *Chercher un NOM, c'est chercher aussi tout ce qui en PARLE.* ⛔ Ne jamais
//    brancher un banc sur un identifiant sans décaper la prose d'abord.
const decape = (t) => t
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

const RE_STYLE = /<style([^>]*)>([\s\S]*?)<\/style>/g;
const RE_CLASSE_HTML = /class(?:Name)?\s*=\s*"([^"]*)"/g;
const RE_CLASSE_CSS = /\.(-?[_a-zA-Z][\w-]*)/g;

// 🔴🔴 LES THÈMES SE LISENT AUSSI, ET LA PREMIÈRE VERSION DE CE BANC NE LES
// LISAIT PAS — elle a rendu ONZE écarts, et les onze étaient FAUX : `.wrap`,
// `.tag`, `.muted`, `.veille`… sont toutes déclarées dans `themes/*/theme.css`.
// Le second gabarit reçoit donc bien des règles ; le `<style>` du premier n'est
// qu'une SURCHARGE locale, et c'est un motif sain, employé partout ici.
// ⭐⭐ *Un instrument qui mord sur tout ne mesure pas ce qu'il annonce.* Rendu
// tel quel, ce banc aurait été rouge sur du code sain — donc désarmé sous deux
// lots, et muet le jour où il aurait eu raison. Il n'a coûté qu'une relecture
// parce que le résultat était trop gros pour être cru.
const themes = [];
(function peaux(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) peaux(p);
    else if (e.endsWith('.css')) themes.push(p);
  }
})(join(RACINE, 'themes'));
const auTheme = new Set();
for (const p of themes)
  for (const c of decape(readFileSync(p, 'utf8')).replace(/\{[^{}]*\}/g, ' ').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g))
    auTheme.add(c[1]);

const declarePar = new Map();   // classe -> Set(fichiers qui la STYLENT en portée)
const emploiePar = new Map();   // classe -> Set(fichiers qui l'EMPLOIENT)
const ajoute = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };

for (const p of astros) {
  const rel = relative(RACINE, p);
  const src = decape(readFileSync(p, 'utf8'));
  for (const m of src.matchAll(RE_CLASSE_HTML))
    for (const c of m[1].split(/\s+/)) if (c && !c.includes('{')) ajoute(emploiePar, c, rel);
  for (const m of src.matchAll(RE_STYLE)) {
    if (/\bis:global\b/.test(m[1] || '')) continue;   // ⭐ la sortie prévue : exempte
    // ⚠️ on retire les blocs `{…}` avant de chercher les sélecteurs, sinon
    //    `var(--r-md)` et `.5rem` ressortiraient comme des classes.
    const selecteurs = decape(m[2]).replace(/\{[^{}]*\}/g, ' ');
    for (const c of selecteurs.matchAll(RE_CLASSE_CSS)) ajoute(declarePar, c[1], rel);
  }
}

console.log('\n🎨 LES FAMILLES DE CLASSES — la règle atteint-elle ceux qui s\'en servent ?\n');

console.log('§1 — l\'instrument a-t-il mordu ?');
// 🔴 LE PREMIER TERME EST TOUJOURS « AI-JE LU QUELQUE CHOSE ? ». Sans lui, un
// `src/` déplacé rendrait 0 fichier, 0 classe, et un vert éclatant. C'est la
// leçon de `test:classeur`, payée le jour même (04/09).
dit(astros.length > 20, 'assez de gabarits lus pour que ce banc ait un sens',
    `${astros.length} fichier(s) .astro`);
dit(declarePar.size > 0, 'des `<style>` de composant ont été lus',
    `${declarePar.size} classe(s) déclarée(s) en portée`);
if (astros.length <= 20 || declarePar.size === 0) {
  console.log('\n❌ test:familles — rien n\'a été lu, les §§ suivants ne sont pas jouables.');
  process.exit(1);
}

console.log('\n§2 — toute classe employée reçoit-elle des règles QUI L\'ATTEIGNENT ?');
// ⭐⭐ LA QUESTION EXACTE, ET ELLE A MIS DEUX ESSAIS À S'ÉCRIRE :
//   une classe est SERVIE si elle est déclarée dans un thème (portée globale,
//   elle atteint tout le monde) OU dans le `<style>` du gabarit QUI L'EMPLOIE.
//   Elle est ORPHELINE si le seul endroit qui la style est le `<style>` d'un
//   AUTRE gabarit — Astro porte ce bloc à son fichier, et la règle n'arrive
//   jamais. C'était l'état exact de `.cl-w` sur `/mint-hunter/`.
// ⛔ « déclarée quelque part » NE SUFFIT PAS : c'est la version qui a rendu
//    onze faux. La portée fait partie de la question, pas de la réponse.
const orphelines = [];
for (const [classe, users] of emploiePar) {
  if (auTheme.has(classe)) continue;                       // le thème atteint tout le monde
  const chez = declarePar.get(classe);
  if (!chez) continue;                                     // stylée nulle part : ce n'est pas ce banc
  const prives = [...users].filter((f) => !chez.has(f));
  if (prives.length) orphelines.push({ classe, chez: [...chez], prives });
}
dit(orphelines.length === 0,
    'aucune classe n\'est employée par un gabarit que sa règle n\'atteint pas',
    orphelines.length
      ? orphelines.map((f) => `\n       🔴 .${f.classe} — stylée SEULEMENT dans ${f.chez.join(', ')} · EMPLOYÉE SANS RÈGLE par ${f.prives.join(', ')}`).join('')
      : `${emploiePar.size} classe(s) employée(s) · ${auTheme.size} au thème`);
if (orphelines.length) {
  console.log('       ⇒ déplacer ces règles dans le thème (`themes/<peau>/theme.css`),');
  console.log('         comme `.veille` et `.cl-*`. ⛔ Ne PAS les recopier des deux côtés :');
  console.log('         deux copies divergent, et aucun banc ne voit la divergence.');
}

console.log(`\n${echecs ? '❌' : '✅'} test:familles — ${echecs ? echecs + ' écart(s)' : 'tout est vert'}`);
process.exit(echecs ? 1 : 0);
