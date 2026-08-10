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

const marquees = pages.filter((f) => readFileSync(f, 'utf8').includes('data-i18n'));
if (!marquees.length) {
  indecis('le marquage', `aucune page ne porte \`data-i18n\` — build sans I18N_MARQUAGE=1, ou \`marquer:i18n\` non joué. `
    + `${pages.length} page(s) inspectées.`);
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
const FORME = /^[a-z][a-zA-Z0-9_]*(\.[a-z][a-zA-Z0-9_]*)*$/;   // le `_` est légitime : mod.price_history
const deformees = new Set();
for (const f of marquees) {
  const h = readFileSync(f, 'utf8');
  for (const m of h.matchAll(/data-i18n="([^"]+)"/g)) if (!FORME.test(m[1])) deformees.add(m[1]);
}
verifie('⛔ aucune clé déformée par une transformation du gabarit',
  deformees.size === 0,
  deformees.size === 0 ? 'toutes les clés ont la forme d\'une clé'
    : `🔴 ${deformees.size} : ${[...deformees].slice(0, 6).join(', ')} — un gabarit applique `
      + `.toUpperCase()/.slice()/.split() au résultat de t(), ce qui emporte la clé avec le texte.`);

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
const src = [...document.querySelectorAll('script')].map((s) => s.textContent)
  .find((x) => x && x.includes('data-i18n') && x.includes('vp_langue'));
if (!src) { indecis('le script d\'échange', 'introuvable dans la page (cherché : vp_langue + data-i18n)'); fin(); }

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
