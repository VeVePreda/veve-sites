// ⚠️ VeVePreda/veve-sites  ·  CHEMIN : engine/lib/tuile.mjs
//
// ═══════════════════════════════════════════════════════════════════════════
// 🧩 LOT G — L'ADAPTATEUR SERVEUR DE **LA** TUILE
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CE FICHIER NE DÉCRIT RIEN. La description vit dans
// `src/socle/modules/tuile.js`, et elle y vit SEULE. Ce module ne fait que deux
// choses : évaluer ce fichier-là pour obtenir la même `decrire()` que le
// navigateur, et sérialiser l'arbre qu'elle rend en HTML.
//
// 🔴🔴 POURQUOI ÉVALUER PLUTÔT QU'IMPORTER. Le fichier de description est servi
// TEL QUEL au navigateur par `moduleJs()`, en `<script defer>` — donc sans
// `export`, sinon il échoue à l'analyse SANS message utile. Un second fichier
// `.mjs` qui redirait la même chose serait la QUATRIÈME copie de la tuile,
// c'est-à-dire exactement ce que ce lot supprime.
// ⭐ Le procédé n'est pas neuf ici : `test:rayon` § ⑧ exécute déjà le pilote par
// `new Function` pour le juger sur son EFFET plutôt que par `grep`.
//
// ⛔ ÉVALUÉ **UNE FOIS**, au premier appel, pas par page : 9 354 pages passent
// par ici. Le résultat est mémorisé dans `_mod`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 DEUX CHEMINS DE LECTURE, ET LE PREMIER N'EST PAS UN LUXE
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ `readFileSync(relatif à import.meta.url)` SEUL NE MARCHE PAS AU BUILD, et
//    la panne est instructive : Astro BUNDLE ce module dans
//    `dist/server/.prerender/chunks/`, donc `import.meta.url` n'y désigne plus
//    `engine/lib/`. Le fichier n'était pas trouvé, et Astro remontait
//    « The collection "blog" does not exist or is empty » — un message qui ne
//    nomme ni ce fichier ni la vraie cause.
//    ⭐⭐ *Une erreur d'exécution au build ne se lit pas dans son message ; elle
//    se lit dans la pile.* C'est la ligne `at classesTuile (…/chunks/…)` qui
//    l'a dit, pas le texte de l'erreur.
//
// ⭐ `import.meta.glob(..., '?raw')` EST LE MÊME MÉCANISME QUE `socle_js.mjs`
//    utilise pour les modules du socle : Vite INLINE la source au build, donc
//    plus aucun accès disque à l'exécution, et le bundle est autonome.
// ⭐ LE REPLI DISQUE RESTE POUR LES BANCS : `test:rayon` et consorts tournent
//    en Node pur, sans Vite, où `import.meta.glob` n'existe pas. Les deux
//    chemins lisent LE MÊME fichier — il n'y a toujours qu'une description.
const ICI = dirname(fileURLToPath(import.meta.url));
export const CHEMIN_TUILE = join(ICI, '..', '..', 'src', 'socle', 'modules', 'tuile.js');

function source() {
  // ⚠️ Le `try` est indispensable : hors Vite, `import.meta.glob` n'est pas une
  //   fonction et l'appel lève — il ne rend pas `undefined`.
  try {
    const g = import.meta.glob('../../src/socle/modules/tuile.js',
      { query: '?raw', import: 'default', eager: true });
    const v = Object.values(g)[0];
    if (typeof v === 'string' && v.length) return v;
  } catch { /* Node pur : on lit le disque */ }
  return readFileSync(CHEMIN_TUILE, 'utf8');
}

let _mod = null;
export function tuileModule() {
  if (_mod) return _mod;
  const faux = {};
  // ⚠️ `window` EST FOURNI EXPLICITEMENT : le fichier choisit `window` s'il
  //   existe, `globalThis` sinon. Sans ce paramètre, il écrirait `vpTuile` sur
  //   le `globalThis` du build — une fuite dans l'espace global du processus,
  //   partagée par tous les modules et par les bancs.
  new Function('window', source())(faux);
  if (!faux.vpTuile) throw new Error('tuile.js n\'expose pas `vpTuile`');
  _mod = faux.vpTuile;
  return _mod;
}

// ── L'ÉCHAPPEMENT ────────────────────────────────────────────────────────────
// 🔴🔴 IL PORTE `&` EN PREMIER, ET L'ORDRE N'EST PAS INDIFFÉRENT : échapper
//   `<` avant `&` transformerait `&lt;` en `&amp;lt;`. La faute classique.
// ⛔ Les guillemets AUSSI (`"` et `'`) : ces chaînes atterrissent dans des
//   attributs, et un nom de pièce vient d'un Sheet — c'est une donnée d'entrée.
const ech = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ⭐ LES BALISES SANS FERMETURE — `img` est la seule que la tuile émette, mais
//   la liste est écrite plutôt que devinée : un `<img></img>` est du HTML
//   invalide qu'aucun navigateur ne signale, et qui casse les comparaisons
//   octet à octet entre les deux fabriques.
const SEULES = new Set(['img', 'br', 'hr', 'input', 'source']);

/** Sérialise un arbre décrit par `decrire()` en HTML. */
export function htmlDe(d) {
  if (!d) return '';
  const at = [];
  if (d.c) at.push(` class="${ech(d.c)}"`);
  if (d.a) for (const [k, v] of Object.entries(d.a)) {
    if (v == null) continue;
    at.push(` ${k}="${ech(v)}"`);
  }
  const ouvre = `<${d.t}${at.join('')}>`;
  if (SEULES.has(d.t)) return ouvre;
  // ⛔ `h` SORT TEL QUEL, `x` EST ÉCHAPPÉ, et c'est la même ligne de partage que
  //   `monter()` tient côté client (`innerHTML` contre `textContent`). `h` ne
  //   reçoit que du HTML fabriqué par nos propres gabarits — pastille de
  //   rareté, cadenas, losange ; `x` reçoit la donnée de catalogue.
  const dedans = d.h != null ? d.h
    : d.k ? d.k.map(htmlDe).join('')
    : d.x != null ? ech(d.x) : '';
  return `${ouvre}${dedans}</${d.t}>`;
}

/** Le raccourci des gabarits : valeurs → HTML d'une tuile. */
export function tuileHtml(v) {
  return htmlDe(tuileModule().decrire(v));
}

/** Le vocabulaire de la tuile, pour les gabarits qui composent en JSX.
 *  ⭐ `Rayon.astro` l'utilise au lieu d'écrire `"tuile__n"` à la main : une
 *  classe renommée dans `tuile.js` casse le build ici plutôt que de laisser
 *  deux fabriques diverger en silence — la panne que ce lot supprime. */
export function classesTuile() { return tuileModule().classes; }
