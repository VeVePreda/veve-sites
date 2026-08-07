// ⚠️ VeVePreda/veve-sites — engine/tools/test_feuille.mjs   (NEUF — lot 105)
// ═══════════════════════════════════════════════════════════════════════════
// LE THÈME EST DEHORS, ET IL Y RESTE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI CE BANC EXISTE. Réinliner du CSS est le geste le plus naturel
// du monde : c'est plus simple, ça marche tout de suite, ça supprime une
// requête, et ça ne casse RIEN — ni build, ni page, ni banc. Le lot 105 se
// défait donc tout seul, de bonne foi, au premier lot qui aura besoin d'une
// règle « juste pour cette page ». Sans instrument, la seule alarme serait un
// déploiement qui échoue trois semaines plus tard sur un cache Docker plein —
// c'est-à-dire un symptôme à quatre couches de sa cause.
//
// ⛔ IL LIT `dist/`, PAS LA SOURCE, ET C'EST LE POINT. La question n'est pas
// « le gabarit a-t-il l'air correct ? » mais « qu'est-ce qu'on SERT ? ». Un
// composant, un article Markdown, un thème ou une intégration peuvent tous
// injecter du CSS sans passer par `Base.astro`.
//
// ⭐⭐ IL SORT SUR UNE DÉCLARATION. « Zéro page trop grosse » et « zéro page
// lue » se ressemblent exactement dans un compteur à zéro, et sont l'inverse
// l'un de l'autre. Ce banc exige donc d'abord d'avoir lu un nombre plausible
// de pages ET une feuille, et sort en rc=2 sinon — un vert qui n'a rien
// inspecté est le plus cher de tous.
//
// ⚠️ IL SE PLACE APRÈS `npm run build` ET AVANT LA PRÉCOMPRESSION : après, il
// verrait 8 500 `.gz` de plus et lirait du binaire. Il les ignore quand même,
// mais on ne fait pas payer un parcours pour rien.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const R = new URL('../..', import.meta.url).pathname;
// Deux modes, deux racines : `dist/` (static) ou `dist/client/` (server).
const DIST = existsSync(join(R, 'dist/client')) ? join(R, 'dist/client') : join(R, 'dist');

// 🔴 LE SEUIL, ET IL EST DÉLIBÉRÉMENT BAS. Mesuré le 07/08 sur le build réel,
// après le lot : il ne reste que deux `<style>` par page — les règles
// anti-clignotement (381 o) et les styles de portée d'Astro (1 737 à 1 999 o).
// 8 Ko laisse de la place à un composant qui grandit, et arrête net un thème
// qui reviendrait par la fenêtre (166 721 o).
const SEUIL = 8192;
// ⭐⭐ LE SECOND PLAFOND EST PAR PAGE, ET SURTOUT PAS EN TOTAL. Un total en
// octets DÉRIVE avec le catalogue : 8 484 pages aujourd'hui, le double le jour
// où l'identité passe à la chaîne — le même site franchirait le seuil sans
// qu'une seule ligne de CSS ait bougé, et le banc se ferait relever « parce
// qu'il crie pour rien ». Un plafond relevé une fois de trop est un plafond
// désarmé. Une MOYENNE PAR PAGE ne dérive pas.
// Mesuré le 07/08 après le lot, SUR LES DEUX SITES — et il fallait les deux :
//   veveprice  2 118 o/page   (anti-clignotement 381 o + portées Astro ~1 640)
//   vevewiki   2 765 o/page   (ses gabarits d'encyclopédie stylent davantage)
// ⚠️ 3 072 aurait laissé 11 % de marge à vevewiki — c'est-à-dire un banc qui
// rougirait au premier composant, pour une raison qui n'a rien à voir avec le
// thème, donc un banc qu'on relèverait sans regarder. 4 096 laisse 48 % au
// site le plus chargé et arrête net un thème qui reviendrait : il ajouterait
// 37 525 o (encyclopedie) à 168 850 o (vitrine).
const PLAFOND_PAR_PAGE = 4096;

let ko = 0;
const dit = (bon, quoi, detail) => {
  if (!bon) ko++;
  console.log(`  ${bon ? 'ok ' : 'KO '} ${quoi}${detail ? ` — ${detail}` : ''}`);
};

console.log('\n═══ LOT 105 — le thème est servi une fois, pas 8 484 ═══');

if (!existsSync(DIST)) {
  console.error(`\n❌ ${DIST} introuvable — ce banc ne peut rien prouver. Lancer le build d'abord.`);
  process.exit(2);
}

// ── 0. LA FEUILLE EXISTE, ET SON NOM DIT SON CONTENU ──────────────────────
const feuilles = readdirSync(DIST).filter((f) => /^theme-[0-9a-f]{12}\.css$/.test(f));
if (feuilles.length !== 1) {
  console.error(`\n❌ ${feuilles.length} feuille(s) « theme-<empreinte>.css » à la racine de ${DIST} `
    + `— il en faut exactement une. Trouvé : ${feuilles.join(', ') || '(aucune)'}`);
  process.exit(2);
}
const nomFeuille = feuilles[0];
const octets = readFileSync(join(DIST, nomFeuille));
const texteFeuilleBrut = octets.toString('utf8');
const empreinteLue = nomFeuille.slice(6, 18);
const empreinteVraie = createHash('sha256').update(octets).digest('hex').slice(0, 12);
// ⭐⭐ « EST-CE QU'IL Y A UNE EMPREINTE ? » ET « EST-CE QUE C'EST L'EMPREINTE
// DE CE FICHIER ? » SONT DEUX QUESTIONS. Un nom figé qui RESSEMBLE à un nom
// empreint passerait la première. Et nginx sert tout `.css` en `immutable`
// pendant 30 jours : une empreinte qui ne suit pas le contenu, c'est un thème
// périmé servi un mois aux seuls visiteurs déjà venus.
dit(empreinteLue === empreinteVraie,
  `l'empreinte du nom est bien celle du contenu (${empreinteVraie})`,
  empreinteLue === empreinteVraie ? null
    : `le nom dit ${empreinteLue}, le contenu dit ${empreinteVraie} — « immutable » servirait un thème périmé 30 jours`);
// ⭐⭐⭐ ON NE MESURE PAS LA FEUILLE À UN SEUIL, ON LA COMPARE À SA SOURCE.
// Première version : « elle doit peser plus de 10 000 o ». `aurora` en fait
// 6 785 — un thème parfaitement valide, et le banc rougissait dessus. ⚠️ UN
// NOMBRE MAGIQUE NE MESURE PAS CE QU'IL PRÉTEND : il mesure « vitrine », et il
// appelle « cassé » tout ce qui n'est pas vitrine. Le critère juste est une
// IDENTITÉ, pas une taille : la feuille doit contenir, au caractère près, le
// texte d'exactement UN des `themes/*/theme.css`.
// ⭐ Au passage, ça prouve les deux choses que ce lot a promises : le thème
// n'est ni tronqué ni retouché en chemin, et `themes/*/theme.css` n'a pas
// bougé — on les LIT, on les écrit ailleurs.
const DOSSIER_THEMES = join(R, 'themes');
const dispoTh = existsSync(DOSSIER_THEMES)
  ? readdirSync(DOSSIER_THEMES).filter((d) => existsSync(join(DOSSIER_THEMES, d, 'theme.css')))
  : [];
if (dispoTh.length === 0) {
  console.error(`\n❌ aucun thème lu sous ${DOSSIER_THEMES} — racine invalide, ce banc ne prouve rien.`);
  process.exit(2);
}
const dedans = dispoTh.filter((d) => texteFeuilleBrut.includes(readFileSync(join(DOSSIER_THEMES, d, 'theme.css'), 'utf8')));
dit(dedans.length === 1,
  `la feuille (${octets.length} o) porte le thème « ${dedans[0] || '?'} » au caractère près`
  + ` — ${dispoTh.length} thème(s) confrontés : ${dispoTh.join(', ')}`,
  dedans.length === 1 ? null
    : dedans.length === 0
      ? 'AUCUN thème du dépôt ne s\'y retrouve intégralement — feuille tronquée, réécrite, ou thème modifié'
      : `${dedans.length} thèmes s'y retrouvent : la feuille en empile plusieurs`);

// ── 1. LES RÈGLES ANTI-CLIGNOTEMENT NE SONT PAS DEDANS ────────────────────
// ⛔ LE CAS SYMÉTRIQUE, ET C'EST LUI QU'ON NE VERRAIT PAS. `test:entete`
// vérifie qu'elles sont EN LIGNE dans la source ; il ne dirait rien si on les
// AJOUTAIT au thème « pour ranger ». Elles arriveraient alors avec la feuille
// externe, donc parfois après la première peinture : le clignotement
// reviendrait « de temps en temps » — pire qu'à chaque fois, parce qu'on
// cesserait de savoir le reproduire.
dit(!/html\[data-membre\]/.test(texteFeuilleBrut),
  'les règles anti-clignotement ne sont PAS dans la feuille externe',
  'dans la feuille, elles arriveraient parfois après la première peinture');

// ── 2. TOUTES LES PAGES LA RÉFÉRENCENT, AUCUNE NE RÉINLINE ────────────────
const pages = [];
(function marche(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) marche(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
})(DIST);

// ⭐ LA DÉCLARATION AVANT LA MESURE.
if (pages.length < 100) {
  console.error(`\n❌ ${pages.length} page(s) lue(s) sous ${DIST} — trop peu pour prouver quoi que ce soit. `
    + `Un banc qui n'a rien inspecté n'a rien prouvé.`);
  process.exit(2);
}

const lien = new RegExp(`<link[^>]+href="/${nomFeuille}"`);
const reStyle = /<style[^>]*>([\s\S]*?)<\/style>/g;
let sansLien = 0;
let talons = 0;
const gros = [];
const nus = [];
let cumul = 0;
let pire = 0;
for (const p of pages) {
  const h = readFileSync(p, 'utf8');
  // ⭐⭐ LES TALONS DE REDIRECTION N'ONT RIEN À HABILLER — ET C'EST vevewiki
  // QUI L'A DIT. En mode SERVER, `redirects:` est servi par l'adaptateur : il
  // n'y a aucun fichier, et ce banc était vert sur veveprice. En mode STATIC,
  // Astro écrit un talon HTML de 320 octets par redirection — 4 pages sans
  // feuille, donc un banc ROUGE en production sur un site parfaitement sain.
  // ⭐ « Corrigé sur un site » ne veut pas dire « corrigé » : ces deux sites ne
  // se ressemblent que jusqu'au premier détail qui compte.
  // ⛔ ON NE LES ÉCARTE PAS PAR LEUR NOM. Le critère est ce qu'ils SONT — un
  // `<meta http-equiv="refresh">` et rien d'autre, sous 2 Ko — et leur nombre
  // est DIT plus bas : une exclusion qui grossit en silence est une exclusion
  // qui finit par tout couvrir.
  if (h.length < 2048 && /http-equiv="refresh"/.test(h)) { talons++; continue; }
  if (!lien.test(h)) nus.push(p.slice(DIST.length)), sansLien++;
  let m;
  reStyle.lastIndex = 0;
  while ((m = reStyle.exec(h)) !== null) {
    const n = Buffer.byteLength(m[1]);
    cumul += n;
    if (n > pire) pire = n;
    if (n > SEUIL) gros.push(`${p.slice(DIST.length)} : <style> de ${n} o`);
  }
}

dit(sansLien === 0, `les ${pages.length - talons} pages de contenu référencent /${nomFeuille}`
  + (talons ? ` (${talons} talon(s) de redirection écarté(s))` : ''),
  sansLien === 0 ? null
    : `${sansLien} page(s) SANS le lien — elles s'afficheront nues : ${nus.slice(0, 5).join(' · ')}`);
// ⭐ L'INSTRUMENT AVANT LA MESURE, UNE SECONDE FOIS. Si un jour tout devenait
// un talon, la ligne au-dessus serait verte sur zéro page jugée.
dit(pages.length - talons >= 100,
  `${pages.length - talons} page(s) de contenu réellement jugée(s)`,
  pages.length - talons >= 100 ? null : 'presque tout a été écarté — ce banc ne prouve plus rien');
dit(gros.length === 0, `aucun <style> au-dessus de ${SEUIL} o (le pire : ${pire} o)`,
  gros.length === 0 ? null : `${gros.length} bloc(s) : ${gros.slice(0, 5).join(' · ')}${gros.length > 5 ? ' …' : ''}`);
const moyenne = Math.round(cumul / pages.length);
dit(moyenne < PLAFOND_PAR_PAGE,
  `CSS en ligne : ${moyenne} o par page en moyenne (${(cumul / 1024 / 1024).toFixed(2)} Mo sur tout dist/)`,
  moyenne < PLAFOND_PAR_PAGE ? null
    : `au-dessus de ${PLAFOND_PAR_PAGE} o par page — du CSS de site est revenu dans les pages`);

if (gros.length) {
  console.log('     ⭐ Un thème recopié dans chaque page coûte deux fois : au réseau du');
  console.log('        visiteur (il le retélécharge à chaque page) et au cache de build');
  console.log('        Docker, qui a déjà fait échouer des déploiements en silence.');
  console.log('     ➡️  Le CSS de site va dans `themes/<nom>/theme.css` — il sortira tout');
  console.log('        seul dans la feuille. Seules les règles qui doivent précéder la');
  console.log('        PREMIÈRE PEINTURE restent en ligne, et elles tiennent en 400 octets.');
}

console.log(ko === 0
  ? `\n✅ une feuille de ${octets.length} o pour ${pages.length} pages, et rien de recopié\n`
  : `\n🔴 ${ko} contrôle(s) en échec\n`);
process.exit(ko === 0 ? 0 : 1);
