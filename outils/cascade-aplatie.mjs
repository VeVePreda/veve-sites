/* ═══════════════════════════════════════════════════════════════════════════
   CASCADE APLATIE — la mise en page mobile servie sur les grands écrans
   ═══════════════════════════════════════════════════════════════════════════
   ⭐⭐ ÉCRIT LE 31/07/2026, APRÈS AVOIR LIVRÉ UN SITE QUI AFFICHAIT SA
   DISPOSITION LA PLUS ÉTROITE À TOUTES LES LARGEURS.
   ⭐⭐ ÉLARGI LE MÊME JOUR : la v1 ne comparait qu'aux `@media (max-width)`,
   trouvait 46 règles et EN LAISSAIT 24 (reduced-motion, @supports, @keyframes).

   LE DÉFAUT. En portant le CSS de la maquette vers le thème, le contenu des
   blocs `@media (max-width:…)` a été RECOPIÉ à la racine, en plus d'y rester.
   Chaque règle existait donc deux fois : une fois dans son media, une fois
   sans condition. Comme la copie racine vient APRÈS la règle de base et qu'à
   spécificité égale c'est la dernière qui gagne, la valeur MOBILE s'appliquait
   partout — et la media query en dessous ne faisait que répéter ce qui était
   déjà en vigueur.

   MESURÉ SUR veveprice : 46 règles. Conséquences visibles sur chaque page :
     .nav__liens{display:none}          → la navigation invisible, TOUJOURS
     .tarifs{grid-template-columns:1fr} → les 4 paliers empilés en 1 colonne
     .fiche{grid-template-columns:1fr}  → la fiche sans sa colonne latérale
     .h-rech{width:var(--tap)}          → la barre de recherche réduite à un
                                          carré de 44 px (le « bloc vide »)

   ⛔ POURQUOI AUCUN CONTRÔLE NE POUVAIT LE VOIR. `css-mort.mjs` demande
   « cette règle EXISTE-T-ELLE ? » — et la réponse était oui, partout. Les 116
   variables correspondaient, les 320 classes avaient une règle, la maquette et
   le thème contenaient le même CSS. Le défaut n'est pas dans l'EXISTENCE d'une
   règle, il est dans son APPLICATION : un problème de CASCADE, pas d'inventaire.
   ⭐⭐ LA LEÇON : « est-ce là ? » et « est-ce ce qui gagne ? » sont deux
   questions, et tous mes contrôles ne posaient que la première.

   Usage :  node outils/cascade-aplatie.mjs [racine]
*/
import fs from 'node:fs';
import path from 'node:path';

const R = process.argv[2] || '.';
const fichiers = (d, acc = []) => {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) fichiers(p, acc);
    else if (e.name.endsWith('.css')) acc.push(p);
  }
  return acc;
};

// Découpe une feuille en règles { contexte, sélecteur, corps } en suivant les
// accolades. Suffisant ici : on ne cherche qu'une égalité texte à texte.
function regles(css) {
  const net = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const pile = [];
  let i = 0, debut = 0;
  while (i < net.length) {
    const c = net[i];
    if (c === '{') {
      const tete = net.slice(debut, i).trim();
      if (tete.startsWith('@')) { pile.push(tete); debut = i + 1; }
      else {
        let prof = 1, j = i + 1;
        while (j < net.length && prof > 0) { if (net[j] === '{') prof++; else if (net[j] === '}') prof--; j++; }
        out.push({ ctx: pile.slice(), sel: tete, corps: net.slice(i + 1, j - 1).replace(/\s+/g, ' ').trim() });
        i = j; debut = j; continue;
      }
    } else if (c === '}') { pile.pop(); debut = i + 1; }
    i++;
  }
  return out;
}

const themes = fichiers(path.join(R, 'themes'));
let griefs = 0;

for (const f of themes) {
  const rs = regles(fs.readFileSync(f, 'utf8'));
  const nom = path.relative(R, f);
  // ⛔⛔ NE PAS RESTREINDRE A `max-width` — C'ETAIT MA PROPRE FAUTE, LE 31/07.
  // La premiere version de ce fichier ne comparait qu'aux `@media (max-width)`.
  // Elle a trouve 46 regles et EN A LAISSE 24, recopiees depuis
  // `prefers-reduced-motion`, `@supports` et des `@keyframes`. La plus grave :
  // le bloc `*,*::before,*::after{animation-duration:.01ms!important;…}` de
  // `prefers-reduced-motion: reduce`, pose A LA RACINE avec ses `!important` —
  // toutes les animations et transitions du site mortes, pour tout le monde.
  // ⭐⭐ J'AI ECRIT UN OUTIL CONTRE UN APLATISSEMENT ET NE L'AI CHERCHE QUE LA
  // OU JE VENAIS DE LE VOIR. Un controle calibre sur l'exemplaire qu'on tient
  // en main ne couvre que lui : la question n'est pas « est-ce que j'attrape ce
  // defaut-ci ? » mais « quelle FRACTION de sa famille j'attrape ? ».
  const sousAt = new Map();          // "sel|corps" -> la @-regle d'origine
  for (const r of rs)
    if (r.ctx.length) sousAt.set(`${r.sel}|${r.corps}`, r.ctx[0]);
  const fautives = rs.filter((r) => !r.ctx.length && sousAt.has(`${r.sel}|${r.corps}`));
  if (fautives.length) {
    griefs += fautives.length;
    console.log(`⛔ ${nom}`);
    console.log(`   ${fautives.length} regle(s) presentes A LA RACINE **et** a l'identique dans un @media (max-width).`);
    console.log(`   → la valeur mobile s'applique a TOUTES les largeurs ; le media query ne fait que la repeter.`);
    for (const r of fautives.slice(0, 12))
      console.log(`     · ${r.sel}  {${r.corps.slice(0, 52)}${r.corps.length > 52 ? '…' : ''}}`
        + `   ← ${sousAt.get(`${r.sel}|${r.corps}`).slice(0, 34)}`);
    if (fautives.length > 12) console.log(`     … et ${fautives.length - 12} autre(s).`);
  }
}

// ⛔ Un controle qui n'a rien inspecte n'a rien prouve — cf. css-mort.mjs.
if (!themes.length) {
  console.log(`⛔ AUCUN theme lu sous « ${path.resolve(R, 'themes')} » — racine invalide.`);
  process.exit(2);
}
console.log(griefs
  ? `\n⛔ ${griefs} regle(s) aplatie(s) — la disposition mobile est servie aux grands ecrans.`
  : `\n✅ ${themes.length} theme(s) : aucune regle mobile recopiee a la racine, la cascade est intacte.`);
process.exit(griefs ? 1 : 0);
