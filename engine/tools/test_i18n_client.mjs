// ⚠️ VeVePreda/veve-sites — engine/tools/test_i18n_client.mjs  (FICHIER NEUF — lot 129)
// ═══════════════════════════════════════════════════════════════════════════
//  L'ÉCHANGE DES LIBELLÉS — et ce banc l'EXÉCUTE, il ne le compte pas
// ═══════════════════════════════════════════════════════════════════════════
//
// Preda, 10/08 : « la langue est un coup en anglais, un coup en français. »
// Le lot 128 a réparé les huit liens morts du menu ; le lot 129 fait l'autre
// moitié — les 3 097 pages publiques sont pré-générées en anglais, et un script
// échange leurs libellés chez qui a un cookie de langue.
//
// ⭐⭐⭐ CE QU'UN BANC PARESSEUX AURAIT FAIT, ET POURQUOI IL AURAIT MENTI.
// Compter les `data-i18n` dans `dist/` est facile, rapide, et **totalement
// inutile** : dix mille attributs corrects ne prouvent pas qu'UN SEUL mot
// change à l'écran. Le lot 127 a déjà payé cette leçon dans l'autre sens (un
// banc qui compte des octets récompense la grille vide). Ici c'est pareil :
// *on ne mesure pas le marquage, on mesure l'ÉCHANGE.*
// ⇒ Ce banc monte une page réelle de `dist/` dans un DOM, pose le cookie,
//   sert le dictionnaire, joue le script de `Base.astro` TEL QUEL, et lit ce
//   que la page dit ensuite.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES QUATRE PANNES QU'IL GARDE
// ═══════════════════════════════════════════════════════════════════════════
//  ① UNE SENTINELLE SURVIVANTE. `t()` enrobe chaque libellé de caractères de
//     contrôle au build ; `outils/marquer_i18n.mjs` les convertit. Si ce
//     post-traitement ne tourne pas — oublié dans le Dockerfile, déplacé après
//     la précompression — les pages partent avec des caractères invisibles
//     collés à chaque libellé. ⛔ Rien ne casse, rien n'est vide, et le texte
//     est SUBTILEMENT faux. C'est la première chose qu'on regarde.
//  ② LE SEO QUI PART EN FRANÇAIS. `<title>`, `<meta description>` et les
//     données structurées doivent rester ANGLAIS : c'est toute la raison
//     d'avoir choisi l'échange navigateur plutôt que la regénération. Un
//     `data-i18n` qui s'y glisserait annulerait la décision sans le dire.
//  ③ UN DICTIONNAIRE SERVI QUI NE COUVRE PAS CE QUI EST MARQUÉ. Une clé marquée
//     dans la page et absente du fichier servi laisse ce libellé en anglais —
//     pour toujours, sans erreur, au milieu d'une page française.
//  ④ L'ÉCHANGE QUI N'ÉCHANGE PAS. Le seul verdict qui compte.
//
// ⚠️ IL LIT `dist/`, DONC IL VIENT APRÈS LE BUILD **ET APRÈS `marquer:i18n`**.
// Sur un build sans marquage (`I18N_MARQUAGE` absent) il sort INDÉCIDABLE : il
// n'a rien à mesurer, et « rien à mesurer » n'est pas « conforme ».

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DIST = join(ROOT, 'dist');
const RACINE = existsSync(join(DIST, 'client')) ? join(DIST, 'client') : DIST;

let ko = 0;
let indecidable = 0;
const verifie = (titre, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};
const indecis = (titre, pourquoi) => {
  console.log(`  ⚠️  INDÉCIDABLE — ${titre}   — ${pourquoi}`);
  indecidable++;
};
const fin = () => {
  console.log(
    ko === 0 && indecidable === 0 ? '\n✅ i18n : l\'échange fonctionne'
    : ko === 0 ? `\n⚠️  i18n : conforme, mais ${indecidable} point(s) INDÉCIDABLE(S)`
    : `\n❌ i18n : ${ko} écart(s)`);
  process.exit(ko === 0 ? 0 : 1);
};

if (!existsSync(RACINE)) { indecis('dist/', `${RACINE} absent — ce banc vient APRÈS npm run build`); fin(); }

const pages = [];
(function marcher(d) {
  for (const e of readdirSync(d)) {
    const f = join(d, e);
    if (statSync(f).isDirectory()) marcher(f);
    else if (e.endsWith('.html')) pages.push(f);
  }
})(RACINE);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n1. aucune sentinelle n\'a survécu au post-traitement');
// ⛔ On cherche les caractères de contrôle EUX-MÊMES, pas leur absence de
// symptôme. Une sentinelle est invisible à l'œil et invisible dans un
// « affichage correct » : seul l'octet la dénonce.
const SENTINELLES = /[]/;
const sales = pages.filter((f) => SENTINELLES.test(readFileSync(f, 'utf8')));
verifie('⛔ zéro caractère de contrôle dans les pages servies',
  sales.length === 0,
  sales.length === 0 ? `${pages.length} page(s) propres`
    : `🔴 ${sales.length} page(s) portent encore ␑␒␓ : \`outils/marquer_i18n.mjs\` n'a pas tourné, `
      + `ou il a tourné APRÈS la précompression. Ex. ${sales.slice(0, 3).map((f) => f.replace(RACINE, '')).join(', ')}`);

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 228 — LE MÊME CONTRÔLE, MAIS À TRAVERS L'ÉCHAPPEMENT JSON
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CE BANC ÉTAIT VERT SUR UN SITE QUI PORTAIT LE DÉFAUT, ET POUR LA RAISON
// LA PLUS BANALE QUI SOIT : il cherche le CARACTÈRE ␑, et `JSON.stringify`
// écrit `\u0011`. Le motif du §1 ci-dessus ne pouvait donc PAS mordre dans un
// `<script type="application/ld+json">` — pas une fois, jamais.
// ⇒ MESURE DU 05/09/2026 sur un `dist/` réel de `vevewiki` :
//   **362 valeurs polluées, sur 277 des 283 pages**, toutes des `ListItem.name`,
//   dont `\u0011home.crumb\u0012Home\u0013` servi 111 fois à Google.
// ⭐⭐ *Un banc branché sur une valeur ne voit pas la couche qui la réécrit.*
//   C'est la même famille que « un banc qui cherche un nom trouve la prose qui
//   en parle » — sauf qu'ici, c'est la SORTIE qui a changé de forme.
// ⛔ ET LE FIL VISIBLE ÉTAIT PROPRE : les gabarits appellent `nu()`. Aucune
//   inspection à l'œil n'aurait pu le voir.
console.log('\n1 suite. ni dans les données structurées, où elles sont ÉCHAPPÉES');
const LD = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
// ⭐ LES DEUX FORMES, ET C'EST TOUT L'INTÉRÊT : la brute (si un jour elle
//   passe) ET l'échappée (celle qui passait vraiment). Chercher une seule des
//   deux, c'est refaire le trou dans l'autre sens.
const ECHAPPEE = /\\u001[123]/i;
let blocsLd = 0, ldSales = [];
for (const f of pages) {
  const h = readFileSync(f, 'utf8');
  for (const m of h.matchAll(LD)) {
    blocsLd++;
    if (ECHAPPEE.test(m[1]) || SENTINELLES.test(m[1])) { ldSales.push(f); break; }
  }
}
// 🔬 LE TÉMOIN DU DISPOSITIF, AVANT LE VERDICT. Sans blocs de données
// structurées à lire, « zéro pollué » ne dit rien — c'est un banc muet qui
// ressemble à un succès, et ce dépôt les paie cher.
if (blocsLd === 0) {
  indecis('les données structurées', 'aucun bloc ld+json dans dist/ — rien à mesurer, ce n\'est PAS « conforme »');
} else {
  verifie('⛔ zéro sentinelle ÉCHAPPÉE dans les données structurées servies',
    ldSales.length === 0,
    ldSales.length === 0
      ? `${blocsLd} bloc(s) ld+json propres — la garde est dans \`jsonld()\` (seo.mjs), le point unique d'émission`
      : `🔴 ${ldSales.length} page(s) servent \\u0011…\\u0013 à un moteur. Ex. ${ldSales.slice(0, 3).map((f) => f.replace(RACINE, '')).join(', ')}`);
}

// ⭐ ET LA GARDE SE VÉRIFIE AUSSI À LA SOURCE : un `dist/` peut être propre
//   parce que le marquage n'a pas tourné. Les deux contrôles ensemble
//   distinguent « la garde marche » de « il n'y avait rien à garder ».
{
  const SEO = readFileSync(join(ROOT, 'engine', 'lib', 'seo.mjs'), 'utf8');
  const ligne = (SEO.match(/export const jsonld = [^\n]*/) || [''])[0];
  verifie('🔑 `jsonld()` décape les chaînes AU MOMENT de sérialiser — un seul endroit pour toutes les fabriques',
    /JSON\.stringify\(o,\s*\(_,\s*v\)\s*=>/.test(ligne) && /nu\(v\)/.test(ligne),
    ligne ? ligne.slice(0, 120) + '…' : 'export const jsonld introuvable');
}

// 🔴🔴🔴 LOT 130 — `data-i18n="` ET PAS `data-i18n`, ET ÇA A RENDU LA CI ROUGE
// SUR LES DEUX SITES.
// Le script d'échange de `Base.astro` contient LUI-MÊME les chaînes
// `'[data-i18n]'` et `'data-i18n-attr'` — ce sont ses SÉLECTEURS. Chercher le
// mot faisait donc croire à ce banc que TOUTES les pages étaient marquées, y
// compris sur un build sans `I18N_MARQUAGE` — celui de la CI. Il réclamait
// alors les dictionnaires servis, qui n'existaient pas, et tombait.
// ⇒ 4 écarts, deux sites, et le message « le prochain build part sur du code
//   non gardé » pendant que le déploiement passait au vert. **Exactement la
//   panne du lot 128, refaite par moi, un lot plus tard.**
//
// ⚠️⚠️ ET J'AVAIS DÉJÀ CORRIGÉ CE FAUX POSITIF AU §2, DANS CE MÊME FICHIER.
// Je l'avais corrigé LÀ OÙ IL M'AVAIT MORDU, pas partout où il pouvait mordre.
// ⭐⭐⭐ *Une règle à moitié appliquée est pire qu'absente* : elle donne le
// sentiment d'avoir traité le sujet. La règle complète tient en une phrase —
// **on cherche l'ATTRIBUT (`data-i18n="`), jamais le mot** — et elle vaut pour
// toute recherche de balisage dans une page qui embarque le script qui le lit.
const MARQUE = 'data-i18n="';
const marquees = pages.filter((f) => readFileSync(f, 'utf8').includes(MARQUE));
if (!marquees.length) {
  // ⛔ INDÉCIDABLE, PAS ROUGE, ET C'EST LE BON VERDICT. La CI construit sans
  // `I18N_MARQUAGE` et ne joue pas `marquer:i18n` : il n'y a rien à mesurer, et
  // « rien à mesurer » n'est pas « non conforme ».
  // ⭐ Le Dockerfile, lui, marque ET post-traite : c'est là que ce banc travaille
  //   vraiment, et c'est la seule porte que le déploiement respecte.
  indecis('le marquage', `aucune page ne porte \`${MARQUE}\` — build sans I18N_MARQUAGE=1, ou \`marquer:i18n\` non joué `
    + `(c'est le cas en CI, et c'est normal). ${pages.length} page(s) inspectées.`);
  fin();
}
console.log(`     ${marquees.length} page(s) marquées sur ${pages.length}`);

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 155 — LE MARQUAGE PEUT ÉCRIRE **DANS** UNE VALEUR D'ATTRIBUT
// ═══════════════════════════════════════════════════════════════════════════
// Le §1 ci-dessus ne cherche que les sentinelles SURVIVANTES. Il y a une seconde
// façon pour le post-traitement de casser une page, et elle laisse ZÉRO
// sentinelle derrière elle : `marquer_i18n.mjs` cherche la fin de la balise pour
// y écrire `data-i18n-attr`. Si un attribut porte du HTML — un SVG, par exemple —
// ses `>` et ses `&quot;` le désynchronisent, et il écrit son attribut AU MILIEU
// d'une valeur. La balise se referme trop tôt, le reste fuit dans la soupe
// d'attributs, et l'`aria-label` voisin sort en
//     aria-label="<span data-i18n="…">Filters</span>"
// ⭐ Mesuré le 17/08 sur le lot 155 : `data-cadenas={svg}` produisait exactement
// ça sur les 978 pages de rayon. Le build était VERT, `test:i18n` §1 VERT, et le
// cadenas des lignes filtrées était du texte cassé.
// ⭐⭐⭐ LE TERME EST À ZÉRO ET IL EST ATTEIGNABLE : la version fautive en
// produisait 1 par page de rayon. C'est ce qui distingue ce contrôle d'un vœu.
// ⇒ La leçon, générale : *on ne fait pas voyager du HTML dans un attribut sur un
//   site qui post-traite son HTML.* Un `<template>` est fait pour ça.
console.log('\n1 bis. le marquage n\'a pas écrit à l\'intérieur d\'une valeur d\'attribut');
{
  // ⚠️ On cherche la SIGNATURE, pas la cause : une balise ouvrante de marquage
  //    juste après un `="` ne peut arriver que par désynchronisation.
  const SIGNATURE = /="\s*<span[^>]*data-i18n/;
  const casses = pages.filter((f) => SIGNATURE.test(readFileSync(f, 'utf8')));
  verifie('⛔ aucun `<span data-i18n>` ouvert à l\'intérieur d\'une valeur d\'attribut',
    casses.length === 0,
    casses.length
      ? `🔴 ${casses.length} page(s) — un attribut porte du HTML et a désynchronisé `
        + `marquer_i18n.mjs. Ex. ${casses.slice(0, 3).map((f) => f.replace(RACINE, '')).join(', ')}`
      : `${pages.length} page(s) inspectées`);
}

console.log('\n2. le SEO reste ANGLAIS — c\'est la contrepartie de la décision');
// ⭐⭐ SANS CE POINT, LE LOT SE RETOURNERAIT CONTRE SA PROPRE RAISON D'ÊTRE.
// On a choisi l'échange navigateur POUR ne pas toucher au cache partagé ni au
// référencement anglais. Un `data-i18n` dans le `<title>` rendrait le titre
// dépendant du visiteur — donc le cache faux et le SEO instable.
let fautes = [];
for (const f of marquees) {
  const h = readFileSync(f, 'utf8');
  for (const m of h.matchAll(/<(title|script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    // ⚠️ FAUX POSITIF ÉVITÉ, ET IL M'A EU : le script d'échange de `Base.astro`
    // contient LUI-MÊME la chaîne `[data-i18n]` — c'est son sélecteur. On ne
    // cherche donc pas le mot, on cherche l'ATTRIBUT (`data-i18n="`), qui ne
    // peut apparaître que dans du balisage. *Un banc qui s'accuse lui-même
    // apprend à être ignoré.*
    if (/data-i18n(-attr)?="/.test(m[2])) fautes.push(`${f.replace(RACINE, '')} → <${m[1]}>`);
  }
  for (const m of h.matchAll(/<(meta|title|link|html|base)\b[^>]*>/gi)) {
    if (/data-i18n(-attr)?="/.test(m[0])) fautes.push(`${f.replace(RACINE, '')} → <${m[1]}>`);
  }
}
verifie('⛔ ni <title>, ni <meta description>, ni <script> ne portent de marquage',
  fautes.length === 0,
  fautes.length === 0 ? 'le HTML servi aux moteurs reste identique pour tout le monde'
    : `🔴 ${fautes.length} : ${fautes.slice(0, 3).join(', ')}`);

// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ LES CLÉS DÉFORMÉES — la panne la plus silencieuse de ce lot.
// `{t(lang,'analytics.title').toUpperCase()}` met LA CLÉ en capitales avec le
// texte : `ANALYTICS.TITLE` est introuvable, le libellé n'est jamais traduit,
// et la page s'affiche parfaitement. Huit clés étaient dans ce cas au premier
// passage. ⛔ On refuse toute clé qui n'a pas la forme d'une clé.
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 139 — CE § AVAIT SA PROPRE COPIE DU PRÉDICAT, ET C'EST LA MOITIÉ
// DE LA PANNE P30
// ═══════════════════════════════════════════════════════════════════════════
// Il portait la regexp du marqueur, RECOPIÉE. Deux fichiers, une seule règle,
// deux endroits où la changer : élargir le marqueur sans toucher ici aurait
// fait rougir ce banc sur exactement ce que le marqueur venait d'accepter — et
// le message aurait accusé un gabarit qui n'a rien fait. *Le marqueur ÉCRIT
// `data-i18n=`, ce § le RELIT : c'est une chaîne à deux morceaux, et un banc
// suit la chaîne, pas le fichier.*
// ⇒ Le prédicat est importé de `engine/lib/cle_i18n.mjs`. Il n'y en a plus
//   qu'un, et c'est le même octet des deux côtés.
const { estUneCle } = await import('../lib/cle_i18n.mjs');
const { locales: locRef } = await import('../lib/i18n.mjs');
// ⚠️ LE DICTIONNAIRE DE RÉFÉRENCE, ET SON ABSENCE EST **INDÉCIDABLE**, PAS
// VERTE. Sans lui `estUneCle` retombe sur la forme seule : le banc jugerait
// alors selon une règle plus stricte que celle qui a marqué les pages, et
// rougirait à tort. Un banc qui ne sait pas sur quoi il juge doit le DIRE.
let dictRef = null;
try {
  // ⚠️ `import.meta.url` ET NON `RACINE` : `RACINE` désigne `dist/`, où il n'y
  // a que les dictionnaires PARTIELS servis au navigateur (les clés réellement
  // marquées). Juger « cette clé existe-t-elle ? » sur un dictionnaire amputé
  // par le marquage, c'est demander à la sortie de valider son entrée.
  dictRef = JSON.parse(readFileSync(new URL(`../i18n/${locRef().def}.json`, import.meta.url), 'utf8'));
} catch { /* signalé juste en dessous */ }
if (!dictRef) {
  console.error('⏸️  INDÉCIDABLE — dictionnaire de référence illisible : ce § juge les clés '
    + 'marquées avec le MÊME prédicat que le marqueur, et il ne peut pas le charger.');
  process.exit(2);
}

const deformees = new Set();
for (const f of marquees) {
  const h = readFileSync(f, 'utf8');
  for (const m of h.matchAll(/data-i18n="([^"]+)"/g)) if (!estUneCle(m[1], dictRef)) deformees.add(m[1]);
}
verifie('⛔ aucune clé déformée par une transformation du gabarit',
  deformees.size === 0,
  deformees.size === 0 ? 'aucune clé marquée n\'échoue à la fois au dictionnaire et à la forme'
    : `🔴 ${deformees.size} : ${[...deformees].slice(0, 6).join(', ')} — un gabarit applique `
      + `.toUpperCase()/.slice()/.split() au résultat de t(), ce qui emporte la clé avec le texte.`);

// ═══════════════════════════════════════════════════════════════════════════
// 2 bis. ⭐⭐⭐ LES SIX CAS FABRIQUÉS — CE § VIENT DE S'ÉLARGIR, IL DOIT
// PROUVER QU'IL SAIT ENCORE ROUGIR
// ═══════════════════════════════════════════════════════════════════════════
// *Un banc qu'on assouplit pour réparer une panne est un banc qu'on peut avoir
// assoupli jusqu'à l'inutilité, et son vert ne le dira pas.* Le §2 ci-dessus
// est vert ; il l'était AUSSI avant ce lot, avec la règle stricte, parce que
// l'échantillon hors ligne ne contient aucune fiche à `drop_method`.
// ⛔ C'est la raison exacte pour laquelle ces cas existent : **P30 n'est pas
//   reproductible au bac à sable** (mesurée au build Docker du 10/08 sur le
//   catalogue réel, 1 199 libellés). Ce qu'on PEUT prouver ici, c'est que le
//   prédicat rend le bon verdict sur les chaînes exactes de la panne.
// ⚠️ Écrit comme fabriqué plutôt que présenté comme mesuré.
console.log('\n2 bis. le prédicat de clé : 6 cas fabriqués, dont 2 témoins inverses');
{
  const cas = [
    // [chaîne, au dictionnaire ?, attendu, ce que le cas modélise]
    ['item.drop.RESERVATION', true,  true,  'P30 — clé RÉELLE, traduite ×5, segment en majuscules'],
    ['item.drop.WAITLIST',    true,  true,  'P30 — la deuxième des quatre'],
    ['mod.price_history',     true,  true,  'le `_` : la panne de la PREMIÈRE version de la forme'],
    ['home.titreNeuf',        false, true,  'TÉMOIN — clé bien formée, PAS ENCORE traduite : ce n\'est pas une déformation'],
    ['ANALYTICS.TITLE',       false, false, 'TÉMOIN INVERSE — le lot 129 : un .toUpperCase() a mangé la clé'],
    ['Set : Return of the J', false, false, 'un .slice() sur un t() : du TEXTE, pas une clé'],
  ];
  let ko = 0;
  for (const [chaine, present, attendu, quoi] of cas) {
    // ⭐⭐ CHAQUE CAS DÉCLARE SON DICTIONNAIRE. Lire le vrai dictionnaire ferait
    // dépendre le verdict du site courant — c'est la faute payée au §5 de
    // `test:affichage` dans ce même lot : un cas qui HÉRITE sa condition teste
    // le manifeste, pas la règle.
    const faux = present ? { [chaine]: 'peu importe' } : {};
    const obtenu = estUneCle(chaine, faux);
    const bon = obtenu === attendu;
    if (!bon) ko++;
    console.log(`   ${bon ? '✅' : '❌'} ${attendu ? 'clé' : 'déformée'} — ${quoi}`);
  }
  verifie('les 6 cas fabriqués rendent le verdict attendu', ko === 0,
    ko === 0 ? '6/6 — le prédicat accepte les clés réelles ET refuse encore les t() transformés'
      : `🔴 ${ko} cas sur 6 : le prédicat a été élargi au-delà de ce qu'il devait couvrir`);
}

console.log('\n3. les dictionnaires servis couvrent-ils ce qui est marqué ?');
const { languesInterface, locales } = await import('../lib/i18n.mjs');
const { def } = locales();
const langues = languesInterface().filter((l) => l !== def);

// Toutes les clés réellement marquées dans les pages — texte ET attributs.
const cles = new Set();
for (const f of marquees) {
  const h = readFileSync(f, 'utf8');
  for (const m of h.matchAll(/data-i18n="([^"]+)"/g)) cles.add(m[1]);
  for (const m of h.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const paire of m[1].split(' ')) { const c = paire.indexOf(':'); if (c > 0) cles.add(paire.slice(c + 1)); }
  }
}
console.log(`     ${cles.size} clé(s) distinctes marquées`);

const dicos = {};
for (const lang of langues) {
  const f = join(RACINE, 'i18n', `${lang}.json`);
  if (!existsSync(f)) { verifie(`le dictionnaire /i18n/${lang}.json est servi`, false, '🔴 absent : la page resterait anglaise'); continue; }
  dicos[lang] = JSON.parse(readFileSync(f, 'utf8'));
  const manque = [...cles].filter((k) => dicos[lang][k] === undefined);
  // ⚠️ On TOLÈRE des manques — une clé peut n'exister qu'en anglais — mais on
  // les NOMME. ⛔ Ce qu'on refuse, c'est un dictionnaire qui couvre moins de la
  // moitié : ce serait une page à moitié traduite, pire qu'une page anglaise.
  verifie(`/i18n/${lang}.json couvre les clés marquées`,
    manque.length <= cles.size / 2,
    manque.length === 0 ? `${Object.keys(dicos[lang]).length} clé(s), ${(readFileSync(f).length / 1024).toFixed(1)} Ko`
      : `${cles.size - manque.length}/${cles.size} couvertes — non traduites : ${manque.slice(0, 5).join(', ')}`);

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LOT 161 — LES CLÉS `mf.` ET `lg.` NE TOLÈRENT AUCUN MANQUE
  // ═════════════════════════════════════════════════════════════════════════
  // Le contrôle ci-dessus accepte jusqu'à la MOITIÉ de clés non traduites, et
  // c'est justifié : une clé de `engine/i18n/` peut n'exister qu'en anglais.
  // ⛔ CE N'EST PAS VRAI DES NOUVELLES. `mf.<chemin>` et `lg.<doc>` sont
  // RÉSOLUES mécaniquement par `marquer_i18n.mjs` en relisant le manifeste et
  // `engine/legal/`. Une seule raison de manquer : le chemin ne mène nulle part
  // — une faute de frappe dans un gabarit, ou une clé du manifeste renommée.
  // ⭐⭐⭐ ET LE SYMPTÔME SERAIT INVISIBLE : le `data-i18n` est posé, la page
  //     s'affiche parfaitement, et le libellé reste anglais pour toujours.
  //     C'est P30, exactement, avec une autre porte d'entrée.
  // ⚠️ La tolérance de 50 % au-dessus les couvrirait sans jamais les nommer :
  //     cinq clés `mf.` mortes sur 218 marquées, c'est 2 % — donc vert.
  const horsDict = [...cles].filter((k) => k.startsWith('mf.') || k.startsWith('lg.'));
  const morts = horsDict.filter((k) => dicos[lang][k] === undefined);
  verifie(`...et les ${horsDict.length} clé(s) « mf./lg. » sont TOUTES résolues (${lang})`,
    morts.length === 0,
    morts.length === 0 ? ''
      : `🔴 ${morts.join(', ')} — le chemin ne mène nulle part dans le manifeste ou engine/legal/`);
}

// ⛔ ET IL DOIT Y EN AVOIR. Un gabarit qui cesserait d'appeler `pickT()` ferait
// tomber `horsDict` à zéro — et la boucle ci-dessus resterait VERTE, puisque
// « zéro clé morte sur zéro clé » est vrai. *Un banc muet ressemble à un succès.*
{
  const horsDict = [...cles].filter((k) => k.startsWith('mf.') || k.startsWith('lg.'));
  verifie('des clés « mf./lg. » sont bien marquées dans les pages',
    horsDict.length >= 5,
    horsDict.length >= 5 ? `${horsDict.length} clé(s)`
      : `seulement ${horsDict.length} — un gabarit a cessé d'appeler pickT(), et l'accroche,`
        + ' les liens légaux ou les formules sont repassés en anglais figé');
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. ET ON JOUE L\'ÉCHANGE — le seul verdict qui compte');
let parseHTML = null;
try { ({ parseHTML } = await import('linkedom')); } catch { /* absent */ }
if (!parseHTML) { indecis('l\'exécution de l\'échange', 'linkedom absent — `npm i -D linkedom`'); fin(); }

const lang = langues[0];
if (!lang || !dicos[lang]) { indecis('l\'échange', 'aucune langue d\'interface secondaire, ou dictionnaire absent'); fin(); }

// ⭐ On prend la page la PLUS marquée : c'est celle qui a le plus à perdre, et
// celle où une régression partielle se verra.
const cible = marquees
  .map((f) => ({ f, n: (readFileSync(f, 'utf8').match(/data-i18n/g) || []).length }))
  .sort((a, b) => b.n - a.n)[0];
const brut = readFileSync(cible.f, 'utf8');
const { document, window } = parseHTML(brut);

// Le cookie et le stockage, tels que le script les attend.
Object.defineProperty(document, 'cookie', { get: () => `vp_langue=${lang}`, configurable: true });
const rangé = {};
window.localStorage = { getItem: (k) => rangé[k] ?? null, setItem: (k, v) => { rangé[k] = v; } };

// ⛔ ON JOUE LE SCRIPT DE `Base.astro`, PAS UNE RÉÉCRITURE. Un banc qui
// réimplémenterait l'échange mesurerait sa propre réimplémentation — et
// resterait vert le jour où le vrai script casse.
// ⚡ LOT 137 (A2 / OPT‑3) — ET LE SCRIPT SE CHERCHE MAINTENANT AUX DEUX
// ENDROITS OÙ LE NAVIGATEUR LE TROUVE : en ligne, ou au bout d'un `src`.
// ⭐⭐⭐ CE §4 EST « LE SEUL VERDICT QUI COMPTE », ET IL A FAILLI DEVENIR MUET.
// Au premier build du lot 137 il est passé de VERT à INDÉCIDABLE — pas à
// rouge. Un banc muet ne réveille personne : la chaîne restait verte, le
// rapport disait « conforme », et plus rien ne vérifiait que l'échange des
// libellés fonctionne sur les trois langues. *Un banc peut être vert, rouge ou
// MUET pour de mauvaises raisons — et le muet est le plus cher des trois,
// parce qu'il ressemble à un succès.*
// ⛔ La réparation n'est donc pas d'accepter l'INDÉCIDABLE « puisque le code a
// bougé » : c'est de suivre le `src`, comme le navigateur.
const scriptsDeLaPage = [...document.querySelectorAll('script')];
const corps = [];
for (const s of scriptsDeLaPage) {
  const href = s.getAttribute('src');
  if (!href) { corps.push(s.textContent); continue; }
  if (!/^\/socle-[a-f0-9]+\.js$/.test(href)) continue;   // umami & co : pas les nôtres
  const f = join(RACINE, href.replace(/^\//, ''));
  // ⛔ LE 404 MUET SE DIT ICI. Un `<script src>` vers un fichier absent laisse
  // la page verte, le build vert, et l'interface définitivement anglaise pour
  // les visiteurs fr/es/de. C'est exactement la panne que ce banc existe pour
  // voir, et elle n'aurait produit aucune ligne rouge ailleurs.
  if (!existsSync(f)) { verifie('le fichier ' + href + ' référencé par la page existe dans dist/', false, 'absent — <script src> vers un 404 : page verte, interface jamais traduite'); continue; }
  corps.push(readFileSync(f, 'utf8'));
}
const src = corps.find((x) => x && x.includes('data-i18n') && x.includes('vp_langue'));
if (!src) { indecis('le script d\'échange', 'introuvable, ni en ligne ni dans un socle référencé (cherché : vp_langue + data-i18n)'); fin(); }

const avant = document.body.textContent;
// ⚠️⚠️ CE FAUX `fetch` REND `text()` **ET** `json()`, ET CE N'EST PAS DU ZÈLE.
//   Depuis le 25/08 le script lit `r.text()` (il compare le texte brut au
//   cache rangé, voir plus bas). Un faux `fetch` qui n'offrirait que `json()`
//   ferait lever le script — et ce banc l'aurait signalé comme « le script
//   d'échange lève », en accusant le code d'un défaut du BANC.
//   ⭐ C'est `regle-injection-qui-ne-mord-pas-accuse-le-jeu-dessai`, prise dans
//   l'autre sens : un faux trop pauvre invente un défaut au lieu d'en cacher un.
const reponse = (d) => ({
  ok: true,
  text: () => Promise.resolve(JSON.stringify(d)),
  json: () => Promise.resolve(d),
});
const faussetFetch = () => Promise.resolve(reponse(dicos[lang]));
let leve = '';
try {
  new Function('document', 'window', 'localStorage', 'fetch', src)(
    document, window, window.localStorage, faussetFetch);
} catch (e) { leve = e.message; }
verifie('le script d\'échange s\'exécute sans lever', !leve, leve || 'aucune exception');

// ⚠️ `fetch` rend une promesse : on laisse la micro-file se vider avant de lire.
await new Promise((r) => setTimeout(r, 20));

const apres = document.body.textContent;
const noeuds = [...document.querySelectorAll('[data-i18n]')].filter((e) => !e.hasAttribute('data-i18n-var'));
const traduits = noeuds.filter((e) => e.textContent === dicos[lang][e.getAttribute('data-i18n')]).length;

verifie(`⛔ les libellés CHANGENT vraiment (${cible.f.replace(RACINE, '')})`,
  traduits > 0 && traduits === noeuds.length && apres !== avant,
  traduits === noeuds.length
    ? `${traduits}/${noeuds.length} libellés portent le texte ${lang}`
    : `🔴 ${traduits}/${noeuds.length} seulement — l'échange est partiel, la page serait mi-anglaise mi-${lang}`);

const attrs = [...document.querySelectorAll('[data-i18n-attr]')];
let attrOk = 0, attrTotal = 0;
for (const e of attrs) {
  for (const paire of e.getAttribute('data-i18n-attr').split(' ')) {
    const c = paire.indexOf(':'); if (c < 1) continue;
    const [nom, cle] = [paire.slice(0, c), paire.slice(c + 1)];
    if (dicos[lang][cle] === undefined) continue;
    attrTotal++;
    if (e.getAttribute(nom) === dicos[lang][cle]) attrOk++;
  }
}
verifie('⛔ les infobulles et libellés d\'accessibilité changent AUSSI',
  attrTotal === 0 || attrOk === attrTotal,
  attrTotal === 0 ? 'aucun attribut marqué sur cette page'
    : attrOk === attrTotal ? `${attrOk} attribut(s) traduits — un lecteur d'écran entend du ${lang}`
      : `🔴 ${attrOk}/${attrTotal} : la page serait française à l'œil et anglaise à l'oreille`);

verifie('…et `<html lang>` suit, sinon la synthèse vocale garde l\'accent anglais',
  document.documentElement.getAttribute('lang') === lang,
  `lang="${document.documentElement.getAttribute('lang')}"`);

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴⭐⭐⭐ 4 bis. LES LIBELLÉS À VARIABLES — « 2,758 pieces in the catalogue »
// ═══════════════════════════════════════════════════════════════════════════
//
// Ces libellés-là arrivent DÉJÀ REMPLIS dans le HTML : le gabarit a été résolu
// au build. Jusqu'au 25/08/2026 le client les sautait (`data-i18n-var` ⇒
// `continue`), et ils restaient anglais **pour tout le monde** — cache vide
// compris, navigateur neuf compris, fenêtre privée comprise. Ce n'était donc
// PAS le même défaut que le cache périmé du § 4 ter : deux causes distinctes
// qui produisaient le même symptôme à l'écran.
// ⛔ NE PAS TRAITER L'UNE POUR L'AUTRE. Corriger le cache laisse cette phrase
//   en anglais ; corriger celle-ci laisse tous les anciens visiteurs en anglais.
//
// ⭐⭐ CE QUE CE § REFUSE PAR-DESSUS TOUT : un gabarit à moitié rempli. Voir
//   « {n} pièces au catalogue » à l'écran serait pire que l'anglais — le
//   lecteur verrait la mécanique. Le code doit rendre l'anglais plutôt que ça,
//   et cette ligne est ce qui l'y oblige.
console.log('\n4 bis. les libellés à VARIABLES sont-ils resubstitués ?');
{
  const varNoeuds = [...document.querySelectorAll('[data-i18n-var]')];
  const avecV = varNoeuds.filter((e) => e.hasAttribute('data-i18n-v'));

  // ⭐⭐⭐ LE JEU D'ESSAI D'ABORD. Si cette page ne porte aucun libellé à
  //   variables, il n'y a RIEN à mesurer — et le dire vert serait signer une
  //   page blanche. INDÉCIDABLE, jamais vert.
  if (varNoeuds.length === 0) {
    indecis('les libellés à variables',
      'aucun `data-i18n-var` sur la page la plus marquée — rien à mesurer ici');
  } else if (avecV.length === 0) {
    verifie('⛔ au moins un libellé à variables porte ses valeurs (`data-i18n-v`)', false,
      `🔴 ${varNoeuds.length} libellé(s) à variables, AUCUN ne porte de valeurs. ` +
      '`marquer_i18n.mjs` les a tous refusés : sans valeurs le client ne peut pas ' +
      'remplir le gabarit traduit, et la phrase reste anglaise pour TOUS les lecteurs.');
  } else {
    let bons = 0;
    const mauvais = [];
    for (const e of avecV) {
      const cle = e.getAttribute('data-i18n');
      const attendu = dicos[lang][cle];
      const vu = e.textContent;
      // ⛔ « traduit » ne suffit pas : on exige qu'AUCUN jeton ne subsiste.
      //   Un `{n}` ou un `%s` visible est un défaut plus grave que l'anglais.
      const jetonVisible = /\{\w+\}|%s/.test(vu);
      if (attendu === undefined) { bons++; continue; } // pas au dictionnaire : hors sujet
      if (!jetonVisible && vu !== e.getAttribute('data-i18n-v') && vu.trim() !== '') {
        // Le texte doit correspondre au gabarit traduit, jetons remplis.
        const motif = new RegExp('^' + attendu
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\\\{\w+\\\}|%s/g, '.+?') + '$', 's');
        if (motif.test(vu)) { bons++; continue; }
      }
      mauvais.push(`${cle} → « ${vu.slice(0, 60)} »`);
    }
    verifie(`⛔ les phrases à nombres passent en ${lang}, jetons remplis`,
      mauvais.length === 0,
      mauvais.length === 0
        ? `${bons}/${avecV.length} libellé(s) à variables resubstitués`
        : `🔴 ${mauvais.length}/${avecV.length} en échec : ${mauvais.slice(0, 3).join(' · ')}`);

    verifie('⛔ AUCUN gabarit à moitié rempli n\'atteint l\'écran',
      !avecV.some((e) => /\{\w+\}|%s/.test(e.textContent)),
      'un `{n}` ou un `%s` visible montre la mécanique au lecteur — ' +
      'le code doit rendre l\'anglais plutôt que ça');
  }

  // ⭐ ET LA CONTRE-ÉPREUVE : un libellé à variables SANS valeurs doit rester
  //   anglais, pas être écrasé par un gabarit brut. C'est ce qui arrive quand
  //   le marquage a refusé un découpage ambigu — le cas doit rester SÛR.
  const sansV = varNoeuds.filter((e) => !e.hasAttribute('data-i18n-v'));
  if (sansV.length) {
    verifie('⛔ un libellé à variables SANS valeurs reste anglais (pas de gabarit nu)',
      !sansV.some((e) => /\{\w+\}|%s/.test(e.textContent)),
      `${sansV.length} libellé(s) refusé(s) au marquage — ils gardent leur texte anglais`);
  } else {
    console.log('  ·    tous les libellés à variables de cette page portent leurs valeurs.');
  }
}

// ⭐⭐ LA CONTRE-ÉPREUVE : sans cookie, RIEN ne doit bouger. Sans elle, un
// script qui traduirait tout le monde en français passerait les lignes
// ci-dessus avec les félicitations du jury.
const { document: doc2, window: win2 } = parseHTML(brut);
Object.defineProperty(doc2, 'cookie', { get: () => '', configurable: true });
win2.localStorage = { getItem: () => null, setItem: () => {} };
const avant2 = doc2.body.textContent;
try { new Function('document', 'window', 'localStorage', 'fetch', src)(doc2, win2, win2.localStorage, faussetFetch); } catch { /* rien */ }
await new Promise((r) => setTimeout(r, 20));
verifie('⛔ SANS cookie de langue, la page ne bouge pas d\'un mot',
  doc2.body.textContent === avant2 && doc2.documentElement.getAttribute('lang') !== lang,
  doc2.body.textContent === avant2 ? 'anglais servi, anglais affiché' : '🔴 la page a été traduite sans qu\'on le demande');

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴⭐⭐⭐ 4 ter. LE VISITEUR QUI REVIENT — un cache PÉRIMÉ doit se rattraper
// ═══════════════════════════════════════════════════════════════════════════
//
// CE § EXISTE PARCE QU'AUCUN AUTRE N'AURAIT VU LE DÉFAUT DU 25/08/2026.
// Le script rangeait le dictionnaire dans `localStorage` puis, à la visite
// suivante, faisait `echanger(cache); return;` — sans jamais revalider. Toute
// clé ajoutée depuis restait anglaise chez ce visiteur, définitivement.
//
// ⭐⭐⭐ ET TOUS LES INSTRUMENTS HABITUELS ÉTAIENT VERTS, LÉGITIMEMENT :
//   le dépôt avait les traductions · `/i18n/fr.json` les servait · le gabarit
//   était correct · le § 4 ci-dessus passait — parce qu'il part d'un
//   `localStorage` VIDE, comme la CI, comme `curl`, comme un navigateur neuf.
// ⇒ *Un instrument qui ne garde pas d'état ne peut pas voir un défaut d'état.*
//   Le seul jeu d'essai qui mord est celui qui ARRIVE AVEC UN CACHE.
//
// LE MONTAGE : on range un dictionnaire AMPUTÉ (la moitié des clés de la page),
// on sert le dictionnaire COMPLET par `fetch`, et on exige que la page finisse
// ENTIÈREMENT traduite. Avec l'ancien code, les clés absentes du cache
// restaient anglaises et cette ligne rougissait.
console.log('\n4 ter. un visiteur qui revient avec un cache PÉRIMÉ finit-il traduit ?');

{
  const { document: doc3, window: win3 } = parseHTML(brut);
  Object.defineProperty(doc3, 'cookie', { get: () => `vp_langue=${lang}`, configurable: true });

  // Les clés RÉELLEMENT portées par cette page — pas celles du dictionnaire.
  // ⛔ Amputer des clés que la page n'utilise pas ne mesurerait rien.
  const clesPage = [...new Set([...doc3.querySelectorAll('[data-i18n]')]
    .filter((e) => !e.hasAttribute('data-i18n-var'))
    .map((e) => e.getAttribute('data-i18n'))
    .filter((c) => dicos[lang][c] !== undefined))];

  const moitie = Math.floor(clesPage.length / 2);
  const gardees = clesPage.slice(0, moitie);
  const retirees = clesPage.slice(moitie);

  // ⭐⭐⭐ LE JEU D'ESSAI SE JUGE AVANT DE JUGER LE CODE. S'il n'y a pas au
  //   moins une clé gardée ET une clé retirée, l'injection ne peut pas mordre :
  //   un cache complet ou un cache vide retomberaient tous deux dans le § 4.
  //   ⛔ Dans ce cas on dit INDÉCIDABLE — jamais vert.
  if (gardees.length < 1 || retirees.length < 1) {
    indecis('le cache périmé',
      `jeu d'essai insuffisant : ${gardees.length} clé(s) gardée(s) / ` +
      `${retirees.length} retirée(s) sur ${clesPage.length} — il en faut au moins ` +
      'une de chaque pour que le cache soit PÉRIMÉ et non vide ou complet');
  } else {
    const vieux = {};
    for (const c of gardees) vieux[c] = dicos[lang][c];
    const rangé3 = { [`vp-i18n-${lang}`]: JSON.stringify(vieux) };
    win3.localStorage = {
      getItem: (k) => rangé3[k] ?? null,
      setItem: (k, v) => { rangé3[k] = v; },
    };

    let leve3 = '';
    try {
      new Function('document', 'window', 'localStorage', 'fetch', src)(
        doc3, win3, win3.localStorage, faussetFetch);
    } catch (e) { leve3 = e.message; }
    await new Promise((r) => setTimeout(r, 40));

    const lit = (c) => {
      const e = doc3.querySelector(`[data-i18n="${c}"]`);
      return e ? e.textContent : null;
    };
    const rattrapees = retirees.filter((c) => lit(c) === dicos[lang][c]).length;

    verifie('le script survit à un cache déjà rempli', !leve3, leve3 || 'aucune exception');

    verifie('⛔ les clés ABSENTES du cache sont rattrapées par la revalidation',
      rattrapees === retirees.length,
      rattrapees === retirees.length
        ? `${rattrapees}/${retirees.length} clé(s) neuve(s) traduites malgré un cache périmé`
        : `🔴 ${rattrapees}/${retirees.length} — un lecteur fidèle verrait ces libellés ` +
          'EN ANGLAIS POUR TOUJOURS. Le script sert le cache et ne revalide pas : ' +
          '⛔ ne jamais faire `if (cache) { echanger(cache); return; }`');

    // ⭐ Et la moitié déjà cachée ne doit pas avoir été perdue au passage.
    const tenues = gardees.filter((c) => lit(c) === dicos[lang][c]).length;
    verifie('…sans casser ce que le cache portait déjà',
      tenues === gardees.length,
      `${tenues}/${gardees.length} clé(s) du cache toujours en place`);

    // ⭐ Le cache est-il RAFRAÎCHI ? Sinon le rattrapage recommence à chaque
    //   page vue : correct à l'écran, mais une revalidation gaspillée à vie.
    let range = null;
    try { range = JSON.parse(rangé3[`vp-i18n-${lang}`]); } catch { range = null; }
    verifie('…et le cache rangé est REMPLACÉ par le dictionnaire complet',
      Boolean(range) && retirees.every((c) => range[c] === dicos[lang][c]),
      range ? `${Object.keys(range).length} clé(s) rangées` : '🔴 cache illisible après passage');
  }

  // ⭐⭐ LA CONTRE-ÉPREUVE DU RÉSEAU MUET. Le cache existe pour ça : si le
  //   `fetch` échoue, la page doit RESTER traduite avec ce qu'on avait.
  //   ⛔ Sans cette ligne, « revalider toujours » pourrait dégénérer en
  //   « ne rien afficher tant que le réseau n'a pas répondu ».
  const { document: doc4, window: win4 } = parseHTML(brut);
  Object.defineProperty(doc4, 'cookie', { get: () => `vp_langue=${lang}`, configurable: true });
  const rangé4 = { [`vp-i18n-${lang}`]: JSON.stringify(dicos[lang]) };
  win4.localStorage = { getItem: (k) => rangé4[k] ?? null, setItem: () => {} };
  try {
    new Function('document', 'window', 'localStorage', 'fetch', src)(
      doc4, win4, win4.localStorage, () => Promise.reject(new Error('réseau coupé')));
  } catch { /* rien */ }
  await new Promise((r) => setTimeout(r, 40));
  const n4 = [...doc4.querySelectorAll('[data-i18n]')].filter((e) => !e.hasAttribute('data-i18n-var'));
  const t4 = n4.filter((e) => e.textContent === dicos[lang][e.getAttribute('data-i18n')]).length;
  verifie('⛔ RÉSEAU COUPÉ : le cache tient encore la page traduite',
    n4.length > 0 && t4 === n4.length,
    t4 === n4.length
      ? `${t4}/${n4.length} libellés servis par le seul cache`
      : `🔴 ${t4}/${n4.length} — la revalidation a fait perdre ce que le cache portait`);
}

fin();
