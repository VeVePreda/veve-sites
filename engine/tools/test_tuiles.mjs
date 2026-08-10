// ⚠️ VeVePreda/veve-sites — engine/tools/test_tuiles.mjs   (FICHIER NEUF — lot 127)
// ═══════════════════════════════════════════════════════════════════════════
//  LE BANC DU POIDS DE `/market/` — ET LE PREMIER QUI EXÉCUTE LE SCRIPT DE LA PAGE
// ═══════════════════════════════════════════════════════════════════════════
//
// LA MESURE QUI L'A FAIT NAÎTRE (10/08/2026, serveur réel dans le bac à sable,
// `/market/` demandée par curl avec une session) :
//
//     TOTAL ................... 1 066 071 o
//     <tbody>, 200 lignes ......  635 674 o   (59,6 %)
//       dont 600 symboles SVG ..  135 699 o   pour SIX géométries distinctes
//       dont 200 sparklines ....   49 420 o   (uniques, irréductibles)
//     #vue-tui, 200 tuiles `hidden`  374 450 o   (35,1 %)
//     scripts inline ..........   35 229 o
//
// ⭐⭐⭐ 47,8 % DE LA PAGE EST DE LA RÉPÉTITION. Deux répétitions distinctes,
// et il faut les nommer séparément parce qu'elles se corrigent séparément :
//   ① la MÊME LISTE rendue DEUX FOIS — le tableau, puis les mêmes 200 pièces
//      en tuiles, `hidden`, que la plupart des visiteurs ne regarderont jamais ;
//   ② la MÊME GÉOMÉTRIE écrite 600 FOIS — six formes de rareté et un diamant
//      de gems, recopiés intégralement à chaque cellule.
//
// ⚠️ CE N'EST PAS UN PROBLÈME DE BANDE PASSANTE. gzip ramène la page à ~80 Ko :
// le fil n'a jamais souffert. Ce qui coûte, c'est le DOM — 200 nœuds `<a>` de
// plus, avec leurs 400 `<img>` et leurs 600 `<svg>`, que le navigateur analyse,
// construit et met en page pour les cacher aussitôt. ⇒ ON MESURE LES OCTETS
// SERVIS **ET** LE NOMBRE DE NŒUDS, jamais la taille compressée.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 POURQUOI CE BANC EXÉCUTE LE SCRIPT DE LA PAGE
// ═══════════════════════════════════════════════════════════════════════════
// Retirer les tuiles du serveur veut dire les CONSTRUIRE dans le navigateur.
// Or « le filtre ne fonctionne pas en vue tuiles » est un reproche que Preda a
// déjà fait une fois (lot 71), et que le lot 118 a re-corrigé. Un banc qui se
// contenterait de compter des octets serait vert le jour où la vue tuiles rend
// une grille VIDE : moins d'octets, plus de fonction. Ce serait le pire des
// instruments — celui qui récompense exactement la régression qu'on craint.
//
// ⇒ Il monte le HTML RÉELLEMENT SERVI dans un DOM (linkedom), joue le
//   `<script is:inline>` de la page tel quel, CLIQUE sur « Tuiles », COCHE une
//   rareté, et exige que la grille montre les mêmes pièces que le tableau.
//
// ⚠️ DÉFAUT D'INSTRUMENT CONNU ET CORRIGÉ *DANS L'INSTRUMENT* : linkedom ne
// reflète pas `.value` sur `<select>`. Sans le correctif ci-dessous, le pilote
// lève à la première ligne et le banc rougit pour une raison qui n'est pas la
// panne qu'il surveille. ⛔ On corrige l'instrument, jamais le code pour lui plaire.

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const ENTREE = join(ROOT, 'dist', 'server', 'entry.mjs');
const PORT = Number(process.env.PORT_BANC_TUILES || 43229);
const PORT_SESSION = PORT + 1;

let ko = 0;
let indecidable = 0;
const verifie = (titre, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};
// ⭐⭐⭐ TROIS VERDICTS. « Je n'ai pas pu mesurer » n'est pas « c'est conforme ».
const indecis = (titre, pourquoi) => {
  console.log(`  ⚠️  INDÉCIDABLE — ${titre}   — ${pourquoi}`);
  indecidable++;
};
const fin = (code) => {
  console.log(
    ko === 0 && indecidable === 0 ? '\n✅ tuiles : tout est conforme'
    : ko === 0 ? `\n⚠️  tuiles : conforme, mais ${indecidable} point(s) INDÉCIDABLE(S)`
    : `\n❌ tuiles : ${ko} écart(s)`);
  process.exit(code ?? (ko === 0 ? 0 : 1));
};

// ═══════════════════════════════════════════════════════════════════════════
// LES SEUILS — chacun adossé à la mesure du 10/08, avec de la marge
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Un seuil serré rougirait sur une dérive de données (200 pièces dont les
// noms s'allongent), pas sur une régression. Un seuil large ne garde rien.
// Les deux ci-dessous sont posés SOUS l'état d'aujourd'hui et AU-DESSUS de
// l'état visé : ils ne peuvent être verts que si le lot a réellement eu lieu.
const SEUIL_OCTETS = 700_000;   // avant : 1 066 071 · visé : ~560 000
const SEUIL_NOEUDS_TUILE = 0;   // aucune tuile rendue par le serveur
const SEUIL_REPETITION = 12;    // une géométrie écrite au plus 12× (6 formes × 2)
const SEUIL_RECOPIE = 90_000;   // avant : 249 252 o · après le sprite : 54 112 o

if (!existsSync(ENTREE)) {
  indecis('le serveur', `${ENTREE} absent — ce banc vient APRÈS npm run build`);
  fin(0);
}

// ── Le faux service de session. ⛔ IL NE MENT PAS SUR LE MUR : il tient la
// place du service d'identité, exactement comme `SESSION_API` en production.
// Sans lui `/market/` répond 302 et le banc mesurerait une page de connexion —
// c'est précisément l'angle mort de `test:pages`, qui demande `/market/` sans
// session et n'atteint donc JAMAIS le rendu qu'on veut peser.
const faux = createServer((req, res) => {
  if (req.url.startsWith('/session/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ palier: 'member' }));
    return;
  }
  res.writeHead(404); res.end('{}');
});
await new Promise((ok) => faux.listen(PORT_SESSION, '127.0.0.1', ok));

const serveur = spawn(process.execPath, [ENTREE], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT), SESSION_API: `http://127.0.0.1:${PORT_SESSION}` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let journal = '';
serveur.stdout.on('data', (d) => { journal += d; });
serveur.stderr.on('data', (d) => { journal += d; });
const arreter = () => { try { serveur.kill('SIGTERM'); } catch {} try { faux.close(); } catch {} };
process.on('exit', arreter);

let pret = false;
for (let n = 0; n < 60 && !pret; n++) {
  await new Promise((r) => setTimeout(r, 500));
  try { pret = (await fetch(`http://127.0.0.1:${PORT}/api/sante`)).ok; } catch {}
}
console.log('\n0. le serveur répond ?');
verifie('un vrai serveur, un vrai rendu à la demande', pret,
  pret ? `port ${PORT}` : `aucune réponse en 30 s — journal :\n${journal.slice(-600)}`);
if (!pret) { arreter(); fin(1); }

// ── LA PAGE, DEMANDÉE AVEC UNE SESSION
const rep = await fetch(`http://127.0.0.1:${PORT}/market/`, { headers: { cookie: 'vp_session=banc-tuiles' } });
const html = await rep.text();
const octets = Buffer.byteLength(html);

console.log('\n1. le mur tient, et la page est bien la page réservée');
// ⭐ LA CONTRE-ÉPREUVE DU MUR, et elle est obligatoire. Sans elle, un banc qui
// mesurerait 40 Ko de page de connexion serait VERT — un « poids conforme »
// obtenu en n'affichant plus rien. C'est la mesure qui distingue « allégé » de
// « vide ».
const sansSession = await fetch(`http://127.0.0.1:${PORT}/market/`, { redirect: 'manual' });
verifie('sans session, /market/ redirige (302)', sansSession.status === 302, `reçu ${sansSession.status}`);
verifie('avec session, /market/ rend la page (200)', rep.status === 200, `reçu ${rep.status}`);
const nLignes = (html.match(/<tr data-type=/g) || []).length;
verifie('elle porte bien ses 200 lignes de marché', nLignes === 200, `${nLignes} ligne(s)`);
if (nLignes === 0) { arreter(); fin(1); }

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2. le poids servi (octets NON compressés — c\'est le DOM qui coûte)');
const bloc = (deb, finBloc) => {
  const a = html.indexOf(deb); if (a < 0) return 0;
  const b = html.indexOf(finBloc, a); if (b < 0) return 0;
  return Buffer.byteLength(html.slice(a, b));
};
const oTbody = bloc('<tbody>', '</tbody>');
const iTui = html.indexOf('id="vue-tui"');
const oTui = iTui < 0 ? 0 : Buffer.byteLength(
  html.slice(html.lastIndexOf('<div', iTui), html.indexOf('id="plus"') > 0
    ? html.lastIndexOf('<p', html.indexOf('id="plus"')) : html.lastIndexOf('<p', html.indexOf('id="vide"'))));
const nTuilesServeur = (html.match(/class="tuile\b/g) || []).length;

verifie(`la page pèse moins de ${SEUIL_OCTETS.toLocaleString('fr')} o`,
  octets < SEUIL_OCTETS,
  `${octets.toLocaleString('fr')} o  ·  <tbody> ${oTbody.toLocaleString('fr')} o  ·  #vue-tui ${oTui.toLocaleString('fr')} o`);

verifie('⛔ le serveur ne rend AUCUNE tuile — la seconde copie de la liste a disparu',
  nTuilesServeur <= SEUIL_NOEUDS_TUILE,
  nTuilesServeur === 0 ? `0 tuile servie (elles se bâtissent au clic), #vue-tui ${oTui.toLocaleString('fr')} o`
    : `🔴 ${nTuilesServeur} tuiles servies pour ${oTui.toLocaleString('fr')} o — la même liste rendue deux fois`);

// ── LA RÉPÉTITION DES GÉOMÉTRIES
// ⭐ On compte les SVG IDENTIQUES. Une sparkline est unique par pièce : elle
// n'entre pas dans ce compte et ne doit pas y entrer.
// ⚠️⚠️ CORRECTION D'INSTRUMENT DU 10/08, ET ELLE MÉRITE D'ÊTRE JUSTIFIÉE.
// La première version comptait TOUT `<svg>` identique. Une fois le sprite posé,
// elle rougissait sur `<svg viewBox="0 0 24 24"><use href="#s-gems"/></svg>` —
// 52 o, écrits 400 fois. C'est-à-dire sur la SOLUTION.
// ⛔ Ce n'est PAS « assouplir un banc pour qu'il passe » : l'en-tête de ce
// fichier dit ce qu'il surveille — « la MÊME GÉOMÉTRIE écrite 600 fois ». Un
// `<svg>` qui ne contient qu'un `<use>` ne porte AUCUNE géométrie ; il porte une
// RÉFÉRENCE, et une référence de 52 o est précisément ce qu'on voulait obtenir.
// La règle était mal ÉNONCÉE, pas trop stricte.
// ⭐⭐ ET ON NE LÂCHE RIEN POUR AUTANT : la seconde mesure (`SEUIL_RECOPIE`)
// compte les octets de recopie TOUS `<svg>` confondus, `<use>` inclus. Retirer
// le sprite ferait bondir le total de 54 112 à ~250 000 o et rougir la ligne —
// un banc qui n'aurait gardé que la première serait aveugle à une prolifération
// de références.
const estReference = (s) => /<svg[^>]*>\s*<use[^>]*\/?>\s*<\/svg>/.test(s);
// ⚠️ LES SPARKLINES SORTENT DE CETTE RÈGLE-CI, ET UNIQUEMENT DE CELLE-CI.
// Mesuré : 35 pièces partagent le MÊME tracé plat (`M0,24 L25,24 L50,24…`) —
// ce n'est pas un gabarit qui se recopie, c'est la DONNÉE qui se ressemble.
// Les mettre en sprite exigerait un identifiant par tracé distinct : on
// remplacerait 35 tracés de 249 o par 35 symboles + 35 références, c'est-à-dire
// PLUS d'octets. ⛔ Une règle qu'on applique là où elle coûte au lieu de
// rapporter est une règle à moitié appliquée, et « à moitié appliquée est pire
// qu'absente ».
// ⭐⭐ Elles restent comptées dans `SEUIL_RECOPIE` ci-dessous : on les exempte
// d'une règle, pas de la mesure.
// 🔎 À REGARDER UN AUTRE JOUR (hors de ce lot) : `vitrine.mjs` promet « moins
// de 2 relevés ⇒ AUCUNE courbe, jamais une ligne plate ». Trente-cinq lignes
// parfaitement plates méritent qu'on vérifie que la platitude est OBSERVÉE et
// non produite par la normalisation.
const estSparkline = (s) => /class="spark"/.test(s);
const vus = new Map();
for (const m of html.matchAll(/<svg[\s\S]*?<\/svg>/g)) vus.set(m[0], (vus.get(m[0]) || 0) + 1);
let pireN = 0, pireO = 0, gaspille = 0;
for (const [s, n] of vus) {
  if (n > pireN && !estReference(s) && !estSparkline(s)) { pireN = n; pireO = Buffer.byteLength(s); }
  if (n > 1) gaspille += Buffer.byteLength(s) * (n - 1);
}
verifie(`⛔ aucune GÉOMÉTRIE n'est recopiée plus de ${SEUIL_REPETITION} fois (sprite + <use>)`,
  pireN <= SEUIL_REPETITION,
  pireN <= SEUIL_REPETITION ? `au pire ${pireN}×`
    : `🔴 une même géométrie de ${pireO} o écrite ${pireN} fois — ${gaspille.toLocaleString('fr')} o de pure recopie`);

verifie(`⛔ la recopie totale de SVG reste sous ${SEUIL_RECOPIE.toLocaleString('fr')} o (références comprises)`,
  gaspille < SEUIL_RECOPIE,
  `${gaspille.toLocaleString('fr')} o sur ${vus.size} balisage(s) distinct(s)`);

// ── ET LE SPRITE EXISTE VRAIMENT, ET IL EST COMPLET.
// 🔴 « Une règle sans émetteur est une intention en attente » : un `<use
// href="#x">` qui ne trouve pas son `<symbol id="x">` ne lève RIEN, ne casse
// RIEN — il rend un trou. Le symbole de rareté disparaîtrait de 200 lignes sur
// un build vert. ⇒ chaque référence doit trouver sa cible, et on l'exige ici.
const refs = [...html.matchAll(/<use[^>]+href="#([^"]+)"/g)].map((m) => m[1]);
const symboles = new Set([...html.matchAll(/<symbol[^>]+id="([^"]+)"/g)].map((m) => m[1]));
if (!refs.length) {
  indecis('le sprite', 'aucun <use> dans la page — le sprite n\'est pas posé');
} else {
  const orphelins = [...new Set(refs)].filter((r) => !symboles.has(r));
  verifie('⛔ chaque <use href="#…"> trouve son <symbol id="…">',
    orphelins.length === 0,
    orphelins.length ? `🔴 ${orphelins.length} référence(s) sans cible : ${orphelins.join(', ')} — ${refs.length} occurrence(s) rendraient un trou`
      : `${refs.length} référence(s) vers ${symboles.size} symbole(s)`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. LE SCRIPT DE LA PAGE, JOUÉ POUR DE VRAI
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n3. la vue Tuiles marche-t-elle ENCORE ? (le script de la page est exécuté)');
arreter();

let parseHTML = null;
try { ({ parseHTML } = await import('linkedom')); } catch {}
if (!parseHTML) {
  indecis('l\'exécution du pilote', 'linkedom absent — `npm i -D linkedom`. Le poids est mesuré, le COMPORTEMENT ne l\'est pas.');
  fin();
}

const { document, window } = parseHTML(html);
// ⚠️ LE CORRECTIF D'INSTRUMENT (cf. en-tête) : `.value` sur <select>.
if (window.HTMLSelectElement) {
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    get() { const o = this.querySelector('option[selected]') || this.querySelector('option'); return o ? (o.getAttribute('value') ?? o.textContent) : ''; },
    set(v) { for (const o of this.querySelectorAll('option')) { if ((o.getAttribute('value') ?? o.textContent) === v) o.setAttribute('selected', ''); else o.removeAttribute('selected'); } },
    configurable: true,
  });
}

const src = [...document.querySelectorAll('script')].map((s) => s.textContent).find((t) => t && t.includes('function appliquer'));
if (!src) { indecis('le pilote de la barre', 'aucun <script> ne contient `function appliquer`'); fin(); }

let leve = '';
try { new Function('document', 'window', 'localStorage', 'console', src)(document, window, undefined, { log() {}, warn() {}, error() {} }); }
catch (e) { leve = e.message; }
verifie('le pilote de la barre s\'exécute sans lever', !leve, leve || 'aucune exception');
if (leve) fin(1);

const visibles = (sel) => [...document.querySelectorAll(sel)].filter((x) => !x.hasAttribute('hidden')).length;
const lignesDom = [...document.querySelectorAll('#vue-tbl tbody tr')];

// ── ON CLIQUE SUR « TUILES ». ⭐ Le vrai geste, pas un appel de fonction interne.
const btn = [...document.querySelectorAll('.v-b')].find((b) => b.dataset.vue === 'tui');
if (!btn) { indecis('le bouton Tuiles', 'introuvable (.v-b[data-vue=tui])'); fin(); }
btn.dispatchEvent(new window.Event('click', { bubbles: true }));

const bati = document.querySelectorAll('#vue-tui .tuile').length;
verifie('⛔ au clic, la grille SE BÂTIT — elle n\'est pas vide',
  bati === lignesDom.length,
  bati === lignesDom.length ? `${bati} tuiles bâties pour ${lignesDom.length} lignes`
    : `🔴 ${bati} tuile(s) pour ${lignesDom.length} ligne(s) — la vue Tuiles montrerait ${bati === 0 ? 'RIEN' : 'un corpus plus petit que le tableau'}`);

verifie('la vue bascule vraiment (tableau masqué, grille montrée)',
  document.getElementById('vue-tbl').hasAttribute('hidden') && !document.getElementById('vue-tui').hasAttribute('hidden'));

// ⭐⭐ LES DIX ATTRIBUTS. C'est la cause ① du lot 71 : des tuiles qui ne
// portaient que 4 `data-` sur 10 laissaient passer tous les filtres — ce qui se
// lit exactement comme « le filtre ne marche pas ».
const CLES = ['type', 'rar', 'n', 'var', 'ch', 'floor', 'sup', 'lst', 'mcp', 'date'];
const t0 = document.querySelector('#vue-tui .tuile');
const l0 = lignesDom[0];
if (t0 && l0) {
  const manquants = CLES.filter((k) => t0.dataset[k] === undefined);
  verifie('⛔ chaque tuile porte les DIX attributs de filtrage', manquants.length === 0,
    manquants.length ? `🔴 manque : ${manquants.join(', ')} — ces filtres laisseraient tout passer` : CLES.join(', '));
  const differents = CLES.filter((k) => (t0.dataset[k] || '') !== (l0.dataset[k] || ''));
  verifie('…et ils valent EXACTEMENT ceux de la ligne correspondante',
    differents.length === 0,
    differents.length ? `🔴 divergent : ${differents.map((k) => `${k} (tuile « ${t0.dataset[k]} » ≠ ligne « ${l0.dataset[k]} »)`).join(', ')}`
      : 'les deux vues filtrent sur la même matière');
}

// ── ET LE FILTRE MORD SUR LES DEUX VUES, SUR LE MÊME CORPUS.
// 🔴 C'est la cause ② du lot 71 : tableau 200 pièces, grille 120. « 3 résultats »
// en Tableau et RIEN en Tuiles — un filtre qui ment une fois sur deux.
const rarete = [...document.querySelectorAll('input[name=f-rar]')].map((x) => x.value)[0];
if (rarete) {
  const attendu = lignesDom.filter((x) => x.dataset.rar === rarete).length;
  const c = document.querySelector(`input[name=f-rar][value="${rarete}"]`);
  c.checked = true; c.setAttribute('checked', '');
  document.getElementById('filtres').dispatchEvent(new window.Event('change', { bubbles: true }));
  const cpt = document.getElementById('cpt').textContent;
  const vuesT = visibles('#vue-tui .tuile');
  const paquet = Math.min(attendu, 20);   // la première tranche
  verifie(`le filtre « ${rarete} » mord sur la grille comme sur le tableau`,
    vuesT === paquet && cpt.startsWith(String(attendu)),
    vuesT === paquet ? `${attendu} pièce(s), ${vuesT} montrée(s), compteur « ${cpt} »`
      : `🔴 ${attendu} attendue(s), ${vuesT} tuile(s) montrée(s), compteur « ${cpt} »`);
} else {
  indecis('le filtre de rareté', 'aucune case f-rar dans la page');
}

fin();
