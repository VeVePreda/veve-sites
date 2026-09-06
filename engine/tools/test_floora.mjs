// ⚠️ VeVePreda/veve-sites — engine/tools/test_floora.mjs   (FICHIER NEUF — relooking 2)
//
// ═══════════════════════════════════════════════════════════════════════════
//  🌱 FLOORA — LES QUATRE RÈGLES QUI LA PROTÈGENT
// ═══════════════════════════════════════════════════════════════════════════
//
//  Une mascotte est le genre d'ajout qui se dégrade sans qu'on le remarque :
//  une pose choisie « parce qu'elle va bien là », une taille arrondie, une
//  bulle qui finit par annoncer un chiffre. Les quatre règles du brief ferment
//  chacune une de ces dérives, et ce banc les tient.
//
//  ① LA POSE EST ASSIGNÉE. `loupe` → 404, `panique` → 500. Elle vit dans
//     `engine/lib/floora.mjs`, dans une table FERMÉE : un gabarit demande un
//     USAGE, jamais une pose. ⇒ le §1 vérifie qu'aucun gabarit n'écrit un nom
//     de pose en dur — ce serait contourner la table sans la modifier.
//
//  ② LES TAILLES NE SONT PAS LIBRES : 96 → 52 · 176 → 88 · 208 → 104, et
//     **il n'existe pas de -384**. Le sujet mesure 148 à 248 px dans le
//     fichier ; au-delà de +15 % il floute. L'erreur a été commise deux fois.
//
//  ③ AUCUNE BULLE NE PORTE DE VALEUR MESURÉE. Un nombre relevé devient faux au
//     premier cache, et le site aurait alors deux horloges. Floora explique
//     COMMENT lire ; le site dit QUOI lire.
//     ⭐ Liste blanche : `7 24 30 90 0 100` — ce sont des NOMS de période et
//       des bornes d'échelle, pas des mesures. Elle a été trouvée par le
//       contrôle lui-même, pas décidée avant.
//     ⛔ Et le contrôle porte sur le DICTIONNAIRE, pas sur la page : c'est là
//       que naissent les bulles, et c'est le seul endroit qui couvre aussi les
//       bulles des lots à venir.
//
//  ④ ELLE NE VIT PAS DANS UNE CARTE, et ses fichiers restent légers.
//
//  ⚠️ SANS OBJET N'EST PAS VERT : sur `vevewiki`, Floora n'existe pas — ce banc
//  le DIT. Un silence se confond avec un succès.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { POSE_DE, AFFICHAGE, floora } from '../lib/floora.mjs';

const R = new URL('../..', import.meta.url).pathname;
let echecs = 0;
const dire = (ok, msg) => { if (!ok) echecs++; console.log(`  ${ok ? '✅' : '❌'} ${msg}`); };
const noter = (msg) => console.log(`  ⚪ ${msg}`);

const DOSSIER_IMG = join(R, 'public/floora');
if (!existsSync(DOSSIER_IMG)) {
  console.log('\n⚪ floora — SANS OBJET : ce site ne dépose pas la mascotte (`public/floora/` absent)\n');
  process.exit(0);
}

// ═══ §1 — LA POSE EST ASSIGNÉE, JAMAIS ÉCRITE À LA MAIN ═══════════════════
console.log('\n§1 — aucun gabarit ne choisit sa pose');

const POSES = [...new Set(Object.values(POSE_DE))];
const GABARITS = [];
(function marcher(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) marcher(p);
    else if (/\.(astro|mjs|js)$/.test(e) && !p.includes('/tools/') && !p.endsWith('floora.mjs')) GABARITS.push(p);
  }
})(join(R, 'src'));

const fautifs = [];
/** ⛔⛔ DÉCAPAGE — ET CE BANC S'EST FAIT PRENDRE PAR SA PROPRE RÈGLE.
 *  Premier tour : un rouge sur `500.astro`, qui « nommait `panique` en dur ».
 *  C'était dans un COMMENTAIRE, celui qui explique que la pose vient de la
 *  table. *Un banc branché sur un nom lit la prose qui parle du nom* — la
 *  faute des quinze bancs de 08/26, et la voici commise une fois de plus.
 *  ⇒ On lit en suivant l'état (code / chaîne / commentaire), jamais par
 *    `replace()` : sur des gabarits commentés à 70 %, un appariement
 *    `/* … *\/` non-glouton enjambe du code réel. */
function nuJs(s) {
  let out = '', i = 0; const n = s.length;
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '*') { const f = s.indexOf('*/', i + 2); out += ' '; i = f < 0 ? n : f + 2; continue; }
    if (c === '/' && d === '/') { const f = s.indexOf('\n', i); out += ' '; i = f < 0 ? n : f; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && s[j] !== c) { if (s[j] === '\\') j++; j++; }
      out += s.slice(i, Math.min(j + 1, n)); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

for (const p of GABARITS) {
  const src = nuJs(readFileSync(p, 'utf8'));
  // ⛔ On cherche le nom d'une pose dans une CHAÎNE ou une adresse de fichier —
  // pas dans la prose. `floora('404')` est un usage, il ne matche pas ; écrire
  // `floora-loupe-208.webp` ou `pose="loupe"` matche, et c'est le but.
  for (const pose of POSES) {
    if (new RegExp(`floora-${pose}-|['"\`]${pose}['"\`]\\s*(?=[,)\\]}])`).test(src)) {
      fautifs.push(`${p.slice(R.length)} → « ${pose} »`);
    }
  }
}
dire(fautifs.length === 0,
  fautifs.length === 0
    ? `${GABARITS.length} fichier(s) de \`src/\` lus : la pose vient toujours de \`POSE_DE\``
    : `🔴 ${fautifs.length} endroit(s) nomment une pose en dur :\n       ${fautifs.slice(0, 4).join('\n       ')}`);

// ═══════════════════════════════════════════════════════════════════════════
// §1 bis — CHAQUE USAGE DÉCLARÉ EST-IL RÉELLEMENT SERVI ?
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE CONTRÔLE NAÎT D'UNE MESURE, PAS D'UNE PRÉCAUTION. Le 06/09/2026,
// sur les SEIZE poses livrées le 04/09 — 45 fichiers, 561 Ko, traduites dans
// les cinq langues — **QUINZE N'ÉTAIENT SERVIES NULLE PART**. Seules `404`,
// `500` et les trois perches de `BandeauOutil` étaient posées. Le dépôt
// portait le poids, la revue avait validé les tables, et personne ne l'a vu :
// tous les bancs regardaient si une pose SERVIE était bien choisie, aucun ne
// demandait si une pose DÉCLARÉE était servie.
//
// ⭐⭐⭐ *Le §1 vérifie que ce qu'on sert vient de la table. Celui-ci vérifie
// que ce que la table promet arrive quelque part. Ce sont deux questions, et
// la seconde ne se déduit pas de la première.*
//
// ⛔ IL NE COMPTE PAS LES FICHIERS, IL COMPTE LES APPELS. Un `.webp` présent
// dans `public/` ne prouve rien : c'est justement l'état qu'on vient de
// mesurer. Ce qui prouve, c'est `floora('<usage>')` ou `perche="<usage>"` ou
// `usage="<usage>"` écrit dans un gabarit.
console.log('\n§1 bis — chaque usage déclaré est-il servi quelque part ?');
{
  const USAGES = Object.keys(POSE_DE);
  const tout = GABARITS.map((p) => readFileSync(p, 'utf8')).join('\n');
  // 🧰 LE MOTIF EST ANCRÉ AUX DEUX BOUTS, ET C'EST UNE CORRECTION PAYÉE.
  // Premier jet : le guillemet fermant était optionnel. `usage="alertes-armees"`
  // matchait donc pour l'usage `alerte`, et le banc a déclaré posé un écran qui
  // ne l'était pas. ⭐⭐ *Un motif qui accepte un PRÉFIXE ne mesure pas ce qu'il
  // nomme : il mesure tout ce qui commence pareil.*
  const servis = USAGES.filter((u) => new RegExp(
    `floora\\(\\s*(['"\`])${u}\\1|(?:perche|usage)=\\{?\\s*(['"\`])${u}\\2`
  ).test(tout));
  const orphelins = USAGES.filter((u) => !servis.includes(u));
  dire(orphelins.length === 0,
    orphelins.length === 0
      ? `${USAGES.length} usage(s) déclaré(s), tous posés dans \`src/\``
      : `🔴 ${orphelins.length} usage(s) déclaré(s) et JAMAIS posé(s) : ${orphelins.join(' · ')}\n`
        + '       — le fichier est livré, la phrase est traduite, et l\'écran ne la montre pas');
}

// ═══ §2 — LES TAILLES SONT FERMÉES ════════════════════════════════════════
console.log('\n§2 — la table des tailles refuse ce qui n\'existe pas');

const leve = (fn) => { try { fn(); return false; } catch { return true; } };
dire(leve(() => floora('404', 384)), '`-384` lève — il n\'existe pas de fichier de cette taille');
dire(leve(() => floora('404', 150)), '`150` lève — une taille arrondie floute le sujet (erreur déjà commise deux fois)');
dire(leve(() => floora('loupe')), 'demander une POSE au lieu d\'un USAGE lève — la table ne se contourne pas');
dire(Object.keys(AFFICHAGE).join(',') === '96,176,208', 'la table d\'affichage porte exactement 96, 176 et 208');
// 🔴🔴 J'AVAIS ÉCRIT « le rapport est toujours 2 », ET LE BANC M'A CONTREDIT.
// La table du brief dit **96 → 52**, pas 96 → 48. Le rapport vaut 1,85 · 2 · 2.
// C'était une déduction de ma part, présentée avec l'autorité d'une mesure —
// exactement ce qu'il ne faut pas faire. La table est celle du brief ; ce qui
// se vérifie, c'est qu'aucune ligne n'AGRANDIT le fichier (au-delà de +15 %,
// le sujet floute — c'est ça, la règle qui a un coût visible).
for (const [f, a] of Object.entries(AFFICHAGE)) {
  dire(a <= Number(f),
    `le fichier de ${f} px s'affiche à ${a} px — jamais agrandi (rapport ${(Number(f) / a).toFixed(2)})`);
}

// ═══ §3 — LES DIMENSIONS DÉCLARÉES SONT CELLES DU FICHIER ═════════════════
console.log('\n§3 — la place réservée est la bonne');

/** Dimensions réelles d'un `.webp` (VP8 / VP8L / VP8X). */
function dimWebp(p) {
  const d = readFileSync(p);
  if (d.slice(0, 4).toString('latin1') !== 'RIFF') return null;
  const c = d.slice(12, 16).toString('latin1');
  if (c === 'VP8X') return [((d[24] | (d[25] << 8) | (d[26] << 16)) + 1), ((d[27] | (d[28] << 8) | (d[29] << 16)) + 1)];
  if (c === 'VP8L') { const b = d.readUInt32LE(21); return [(b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1]; }
  const i = d.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
  return i < 0 ? null : [d.readUInt16LE(i + 3) & 0x3FFF, d.readUInt16LE(i + 5) & 0x3FFF];
}

let mesurees = 0;
for (const usage of Object.keys(POSE_DE)) {
  let f; try { f = floora(usage); } catch { continue; }   // pose non déposée : le §4 le dira
  const abs = join(R, 'public', f.src);
  if (!existsSync(abs)) continue;
  const dim = dimWebp(abs);
  if (!dim) { noter(`${f.pose} — INDÉCIDABLE : forme webp non reconnue`); continue; }
  mesurees++;
  const attendu = Math.round(f.height * (dim[0] / dim[1]));
  dire(f.width === attendu,
    `${usage} → ${f.pose} : ${dim[0]}×${dim[1]} affiché en ${f.width}×${f.height}`
    + (f.width === attendu ? ' — le rapport est respecté' : ` 🔴 largeur annoncée ${f.width}, mesurée ${attendu} : l'image serait déformée`));
}
dire(mesurees > 0, mesurees > 0 ? `${mesurees} pose(s) mesurée(s) sur leur fichier`
  : '🔴 AUCUNE pose mesurable : ce § serait muet');

// ═══ §4 — LE FICHIER, LA LIGNE NGINX, ET LA PAGE : LES TROIS ══════════════
console.log('\n§4 — la 500 n\'existe que si les trois existent');

const DIST = join(R, 'dist');
const page500 = ['dist/client/500.html', 'dist/500.html'].map((p) => join(R, p)).find(existsSync);
if (!existsSync(DIST)) noter('SANS OBJET : pas de `dist/`, le build n\'a pas tourné');
else dire(!!page500, page500 ? '`500.html` est bâti' : '🔴 `500.html` absent du build — nginx désignerait une page qui n\'existe pas');

for (const f of ['nginx.conf', 'nginx.server.conf']) {
  const p = join(R, f);
  if (!existsSync(p)) { noter(`SANS OBJET : ${f} absent`); continue; }
  const conf = readFileSync(p, 'utf8').split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  dire(/error_page\s+500[^;]*\/500\.html\s*;/.test(conf), `${f} désigne \`/500.html\``);
}
// ⭐ Et l'interception, sans laquelle la ligne ci-dessus ne sert à rien en mode
//   serveur — mais JAMAIS sous `/api/`, où une 500 doit rester du JSON.
const srv = join(R, 'nginx.server.conf');
if (existsSync(srv)) {
  const conf = readFileSync(srv, 'utf8');
  const blocApi = (conf.match(/location \^~ \/api\/ \{[\s\S]*?\n  \}/) || [''])[0];
  dire(/proxy_intercept_errors\s+on/.test(conf), 'le mode serveur intercepte les erreurs de Node');
  dire(!/proxy_intercept_errors\s+on/.test(blocApi),
    '…mais PAS sous `/api/` : une erreur d\'API doit rester du JSON');
}

// ═══ §5 — AUCUNE BULLE NE PORTE DE VALEUR MESURÉE ═════════════════════════
console.log('\n§5 — les bulles expliquent, elles ne mesurent pas');

const BLANCHE = new Set(['7', '24', '30', '90', '0', '100']);
const LANGUES = ['en', 'fr', 'es', 'de', 'it'];
let bulles = 0; const chiffrees = [];
for (const l of LANGUES) {
  const p = join(R, `engine/i18n/${l}.json`);
  if (!existsSync(p)) { noter(`SANS OBJET : engine/i18n/${l}.json absent`); continue; }
  const d = JSON.parse(readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(d)) {
    if (!k.startsWith('floora.')) continue;
    bulles++;
    // ⛔ On retire d'abord les clés qui SONT un numéro d'erreur : `floora.404.t`
    //   parle d'une page 404, ce n'est pas une valeur mesurée. Le nombre est
    //   dans la CLÉ, jamais dans le texte — on ne lit donc que la valeur.
    for (const m of String(v).matchAll(/\d[\d\s.,]*/g)) {
      const n = m[0].replace(/[\s.,]+$/, '').replace(/[\s.,]/g, '');
      if (!BLANCHE.has(n)) chiffrees.push(`${l} · ${k} → « ${m[0].trim()} »`);
    }
  }
}
if (!bulles) noter('SANS OBJET : aucune clé `floora.*` dans les dictionnaires');
else {
  dire(chiffrees.length === 0,
    chiffrees.length === 0
      ? `${bulles} bulle(s) lues dans ${LANGUES.length} langues : aucun nombre hors liste blanche`
      : `🔴 ${chiffrees.length} bulle(s) portent un nombre qui n'est pas un nom de période :\n       `
        + chiffrees.slice(0, 4).join('\n       '));
  // ⭐ Et le témoin d'atteignabilité : sans clés dans les 5 langues, le § est muet.
  dire(bulles >= LANGUES.length,
    `${bulles} clé(s) \`floora.*\` au total — le § a de quoi mordre dans chaque langue`);
}

// ═══ §5 bis — AUCUNE BULLE NE SERT SA PROPRE CLÉ ══════════════════════════
// 🔴🔴🔴 CE PARAGRAPHE EXISTE PARCE QUE LA PANNE A ÉTÉ SERVIE, LE 06/09.
// La bulle de `/sets/` sortait, mot pour mot :
//     « floora.setsA set has no single price but … »
// Cause : `set:html={t(…)}` était le PREMIER du dépôt. Sous `I18N_MARQUAGE=1`
// — que le Dockerfile pose, donc en PRODUCTION — `t()` entoure le texte de
// sentinelles, et `outils/marquer_i18n.mjs` ne sait les convertir en
// `span data-i18n` que sur du texte SIMPLE. La valeur contenant du balisage,
// il a retiré les sentinelles et laissé la CLÉ dans la phrase.
// ⭐⭐ ET AUCUN BANC N'AURAIT MORDU : `test:i18n` cherche les sentinelles
// SURVIVANTES, il n'en restait aucune. Le défaut n'est visible qu'en LISANT le
// texte servi. *Un contrôle qui cherche des restes ne voit pas une substitution
// qui a « réussi » au mauvais endroit.*
// ⛔ Il se juge sur `dist/`, donc APRÈS le build ET après `marquer:i18n` :
// avant le marquage, la clé n'est pas encore là.
console.log('\n§5 bis — aucune bulle ne sert sa propre clé');
{
  const D = join(R, 'dist');
  if (!existsSync(D)) noter('INDÉCIDABLE : pas de `dist/` — ce contrôle se juge après le build');
  else {
    const html = [];
    const marche = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
      const q = join(d, e.name);
      if (e.isDirectory()) marche(q); else if (e.name.endsWith('.html')) html.push(q);
    } };
    marche(D);
    const fautives = [];
    let vues = 0;
    for (const f of html) {
      const t0 = readFileSync(f, 'utf8');
      for (const m of t0.matchAll(/<p class="bulle"[^>]*>([\s\S]{0,80})/g)) {
        vues++;
        // ⭐ On cherche une CLÉ EN TÊTE DE PHRASE — `floora.sets` collé au
        // texte. ⛔ Pas « la chaîne floora apparaît » : le mot « Floora » est
        // dans l'`alt` de toutes les images, et le contrôle serait rouge
        // partout pour une raison qui n'a rien à voir.
        if (/^\s*[a-z][a-z0-9]*(\.[a-z0-9]+)+/.test(m[1])) {
          fautives.push(`${f.replace(R, '')} → « ${m[1].slice(0, 40)}… »`);
        }
      }
    }
    if (!vues) noter('SANS OBJET : aucune bulle servie dans `dist/`');
    else {
      dire(fautives.length === 0, fautives.length === 0
        ? `${vues} bulle(s) servie(s), aucune ne commence par une clé i18n`
        : `🔴 ${fautives.length} bulle(s) servent leur clé :\n       ` + fautives.slice(0, 3).join('\n       '));
      // ⭐⭐ L'AUTO-CONTRÔLE — sans lui, un motif trop strict rendrait ce
      // paragraphe vert pour toujours, et personne ne le saurait.
      const motif = /^\s*[a-z][a-z0-9]*(\.[a-z0-9]+)+/;
      dire(motif.test('floora.setsA set has no single price'),
        '…et le motif reconnaît bien la phrase qui a été SERVIE le 06/09 (auto-contrôle)');
      dire(!motif.test('A set has no single price but <b>a range</b>'),
        '…et il laisse passer une bulle saine (auto-contrôle)');
    }
  }
}

// ═══ §6 — L'ALT PORTE SON NOM, DANS TOUTES LES LANGUES ════════════════════
console.log('\n§6 — chaque `alt` dit « Floora »');

let alts = 0; const muets = [];
for (const l of LANGUES) {
  const p = join(R, `engine/i18n/${l}.json`);
  if (!existsSync(p)) continue;
  const d = JSON.parse(readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(d)) {
    if (!/^floora\.alt/.test(k)) continue;
    alts++;
    if (!/Floora/.test(String(v))) muets.push(`${l} · ${k}`);
  }
}
dire(alts > 0 && muets.length === 0,
  muets.length === 0 && alts > 0
    ? `${alts} texte(s) alternatif(s), tous nommant Floora`
    : alts === 0 ? '🔴 aucune clé `floora.alt*` : les images seraient sans texte alternatif traduit'
      : `🔴 ${muets.length} \`alt\` ne nomment pas Floora : ${muets.slice(0, 3).join(', ')}`);

// ═══ §7 — LES FICHIERS RESTENT LÉGERS ═════════════════════════════════════
console.log('\n§7 — aucun fichier au-dessus de 25 Ko');

const PLAFOND = 25 * 1024;
const fichiers = readdirSync(DOSSIER_IMG).filter((f) => f.endsWith('.webp'));
const lourds = fichiers.map((f) => [f, statSync(join(DOSSIER_IMG, f)).size]).filter(([, o]) => o > PLAFOND);
dire(fichiers.length > 0 && lourds.length === 0,
  lourds.length === 0 && fichiers.length > 0
    ? `${fichiers.length} fichier(s), le plus lourd à ${Math.max(...fichiers.map((f) => statSync(join(DOSSIER_IMG, f)).size))} o`
    : fichiers.length === 0 ? '🔴 `public/floora/` est vide'
      : `🔴 ${lourds.length} fichier(s) au-dessus de 25 Ko : ${lourds.map(([f, o]) => `${f} (${o} o)`).join(', ')}`);

// ⚠️ CE QUE CE BANC NE MESURE PAS
noter('⚠️ NON MESURÉ : le RENDU. Aucune de ces deux pages n\'a été vue affichée —');
noter('   ni la place que prend Floora, ni ce que la 500 donne quand Node est vraiment tombé.');

console.log(echecs === 0
  ? '\n✅ floora : la pose est assignée, la taille est fermée, les bulles ne mesurent rien\n'
  : `\n❌ floora : ${echecs} contrôle(s) en défaut\n`);
process.exit(echecs ? 1 : 0);
