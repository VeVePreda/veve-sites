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
const faussetFetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(dicos[lang]) });
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

fin();
