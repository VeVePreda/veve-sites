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
import { existsSync, writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { lireTemoin } from '../lib/astro_temoin_build.mjs';

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
// ⭐⭐⭐ LOT 128 — LE NOMBRE DE LIGNES SE DEMANDE AU BUILD, IL NE SE POSTULE PAS.
// « 200 » est le chiffre de la PRODUCTION. La CI construit hors ligne sur
// l'échantillon et n'en rend que 90 : un banc qui exige 200 y est rouge par
// construction — la panne exacte que `test:marche` a payée du lot 125 au 128,
// et qui a fait lire le message Discord comme du bruit pendant trois lots.
// ⇒ On compare à ce que le build a SIGNÉ dans `.reserve/_temoin-build.json`.
// 🔴🔴🔴 LOT 155-C — CE CONTRÔLE A ÉTÉ REMPLACÉ, ET IL A ROUGI EN PRODUCTION
// AVANT DE L'ÊTRE (déploiement `ef9ddcd`, étape 50/55) :
//     « elle rend exactement les lignes que le build a déposées
//       — 20 ligne(s) rendue(s) pour 8840 déposée(s) »
// Il exigeait `rendues === déposées`. C'était l'invariant juste tant que la page
// rendait TOUT ce que le build projetait ; depuis que le serveur tranche, c'est
// exactement ce qu'il ne faut PLUS. ⭐ Le banc avait raison de rougir : il
// gardait une propriété que le lot a délibérément cassée, et il l'a dit avant le
// déploiement — c'est le Dockerfile qui a fait son travail.
//
// ⭐⭐⭐ CE QUI LE REMPLACE EST PLUS FORT QUE LUI. L'ancien vérifiait un nombre ;
// celui-ci vérifie que la TRANCHE EST PILOTÉE — la page rend `PAR_PAGE`, et elle
// en rend `40` quand l'URL le demande. Un serveur qui aurait cessé de trancher
// (ou qui ignorerait `f-n`) est rouge dans les deux cas.
// ⛔ `PAR_PAGE` N'EST PAS RECOPIÉ ICI : il vient du module qui tranche. Un « 20 »
// écrit dans ce banc deviendrait faux le jour où Preda demande 30, et le banc
// serait rouge pour une raison qui n'est pas une panne.
const { PAR_PAGE, RENDU_MAX } = await import('../lib/marche_selection.mjs');
const temoin = lireTemoin(ROOT);
const nLignes = (html.match(/<tr data-type=/g) || []).length;
const attendues = temoin?.marche ?? null;
if (attendues === null) {
  indecis('le nombre de lignes', `pas de témoin de build — la page en rend ${nLignes}, on ne sait pas ce qu'elle devrait en rendre`);
} else {
  const tranche = Math.min(PAR_PAGE, attendues);
  verifie('elle rend UNE TRANCHE, pas le catalogue',
    nLignes === tranche,
    `${nLignes} ligne(s) rendue(s) · PAR_PAGE = ${PAR_PAGE} · ${attendues} déposée(s)`);

  // ⛔ CE SECOND CONTRÔLE PEUT ÊTRE SANS OBJET, ET IL SE CONDITIONNE SUR LE
  //    CORPUS (`attendues > PAR_PAGE`), jamais sur ce que la page a rendu.
  //    Hors réseau le corpus peut tenir sous la tranche : il n'y a alors rien à
  //    prolonger, et le dire est plus honnête qu'un vert.
  if (attendues > PAR_PAGE) {
    const vise = Math.min(PAR_PAGE * 2, attendues);
    const rep2 = await fetch(`http://127.0.0.1:${PORT}/market/?f-n=${vise}`, { headers: { cookie: 'vp_session=banc-tuiles' } });
    const n2 = ((await rep2.text()).match(/<tr data-type=/g) || []).length;
    verifie('…et la tranche est PILOTÉE par l\'URL (`?f-n=`)',
      n2 === vise, `?f-n=${vise} → ${n2} ligne(s)`);
  } else {
    indecis('la tranche pilotée par l\'URL', `le corpus (${attendues}) tient sous PAR_PAGE (${PAR_PAGE}) : rien à prolonger`);
  }
}
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

// ⚠️ LE POIDS EST LA SEULE MESURE DE CE BANC QUI DÉPEND DE L'ÉCHELLE — 200
// lignes ou 90 ne pèsent pas pareil. ⛔ On ne « met pas le seuil au prorata » :
// un seuil calculé rend un verdict qui a l'air mesuré et ne l'est pas. Sur un
// build d'échantillon, ce point est INDÉCIDABLE, et tout le reste de ce banc —
// zéro tuile servie, aucune géométrie recopiée, chaque `<use>` adossé, la
// grille qui se bâtit et le filtre qui mord — reste PARFAITEMENT jugeable.
if (temoin?.horsLigne) {
  indecis('le poids de la page',
    `build HORS LIGNE (${nLignes} lignes d'échantillon, ${octets.toLocaleString('fr')} o). `
    + `Le seuil de ${SEUIL_OCTETS.toLocaleString('fr')} o est calibré sur les 200 lignes de production — `
    + `le Dockerfile construit en ligne et le juge.`);
} else {
  verifie(`la page pèse moins de ${SEUIL_OCTETS.toLocaleString('fr')} o`,
    octets < SEUIL_OCTETS,
    `${octets.toLocaleString('fr')} o  ·  <tbody> ${oTbody.toLocaleString('fr')} o  ·  #vue-tui ${oTui.toLocaleString('fr')} o`);
}

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
// 🔴🔴🔴 LOT 144 — CETTE EXEMPTION N'A JAMAIS FONCTIONNE, ET LE BANC EST
// ROUGE AUJOURD'HUI POUR CETTE RAISON.
// Le selecteur exigeait `class="spark"` — guillemet fermant COLLE au mot. Or
// `vitrine.mjs` emet `class="spark up"` / `class="spark down"` : AUCUNE
// sparkline n'a jamais ete exemptee. Le banc les comptait toutes depuis le
// lot 127, et il ne rougissait que le jour ou la donnee produisait treize
// courbes plates identiques. Mesure du 13/08 sur `/market/` en production :
//     <svg class="spark up" …>M0.0,24.0L25.0,24.0L50.0,24.0L75.0,24.0L100.0,4.0
//     250 o, ecrit 13 fois, seuil 12  ->  ROUGE
// ⭐⭐⭐ VERIFIE SUR LE DEPOT NU (HEAD `11153f85`, sans le lot 144) : le meme
// echec, au meme octet. Ce n'est pas un lot qui l'a introduit, c'est la DONNEE
// du jour qui a franchi un seuil qu'un defaut d'instrument rendait atteignable.
// ⛔ CE N'EST PAS « ASSOUPLIR UN BANC POUR QU'IL PASSE ». L'intention est
// ecrite quelques lignes plus haut, avec le trace exact en exemple : « ce n'est
// pas un gabarit qui se recopie, c'est la DONNEE qui se ressemble ». La regle
// etait mal ECRITE, pas trop stricte — exactement comme `class="cote[^"]*"` au
// lot 112, qui attrapait `cote__l` et annonçait 8 484 fuites de prix.
// ⭐⭐ QUATRIEME FOIS QU'UN SELECTEUR DE CLASSE MENT DANS CE DEPOT : un nom de
// classe se termine par une ESPACE ou par le guillemet, jamais « forcement par
// le guillemet ». ⛔ Et rien n'est perdu : `SEUIL_RECOPIE`, plus bas, continue
// de compter les sparklines dans les octets — on les exempte d'UNE regle, pas
// de la mesure.
const estSparkline = (s) => /class="spark(?:[ "])/.test(s);
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

// 🔴 LOT 133 — LE CORRECTIF D'INSTRUMENT A DÉMÉNAGÉ DANS `_dom_banc.mjs`.
// Il était écrit ICI depuis le lot 127, et je l'ai REDÉCOUVERT à l'identique en
// écrivant `test:series` : même panne (`undefined.trim()` sur un `<select>`),
// même cause, même remède, à 60 lignes d'écart dans un autre fichier.
// ⛔ Le recopier une deuxième fois aurait été la 4ᵉ occurrence de « deux
// endroits qui font la même chose divergent en silence » — et elle se serait
// payée le jour où l'un des deux gagne un correctif que l'autre n'a pas.
// ⭐⭐ `monterDOM()` porte désormais DEUX correctifs, pas un : le second
// (`:checked` qui suit l'ATTRIBUT et non la propriété) n'existait nulle part et
// aurait manqué ici aussi le jour où ce banc cochera une case.
const { monterDOM } = await import('./_dom_banc.mjs');
const dom = await monterDOM(html);
if (!dom) {
  indecis('l\'exécution du pilote', 'linkedom absent — `npm i -D linkedom`. Le poids est mesuré, le COMPORTEMENT ne l\'est pas.');
  fin();
}
const { document, window } = dom;

// 🔴🔴 LOT 155-C — LE REPÈRE A CHANGÉ, ET LE PRÉCÉDENT A RENDU CE § MUET.
// Le banc cherchait `function appliquer` : le lot 155-C a supprimé cette
// fonction (le filtre et le tri sont passés au serveur), et TOUT le §3 s'est
// déclaré INDÉCIDABLE d'un coup — l'exécution du pilote, le libellé d'attente,
// la construction des tuiles. **Un banc qui perd son point d'accroche ne rougit
// pas : il se tait**, et il se tait sur ce qu'il gardait le mieux.
// ⭐ On s'accroche donc à `batirTuiles`, qui est LE SUJET de ce banc : le jour
// où elle disparaît, c'est qu'il n'y a plus de tuiles à garder.
const src = [...document.querySelectorAll('script')].map((s) => s.textContent).find((t) => t && t.includes('function batirTuiles'));
if (!src) { indecis('le pilote de la barre', 'aucun <script> ne contient `function batirTuiles`'); fin(); }

let leve = '';
try { new Function('document', 'window', 'localStorage', 'console', src)(document, window, undefined, { log() {}, warn() {}, error() {} }); }
catch (e) { leve = e.message; }
verifie('le pilote de la barre s\'exécute sans lever', !leve, leve || 'aucune exception');
if (leve) fin(1);

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 LOT 143 — LE LIBELLÉ D'ATTENTE N'EST PLUS SERVI, IL EST REPOSÉ
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 12/08 : il partait 7 fois par ligne dans le HTML, 630 fois sur
// 90 lignes en bac à sable, environ 1 855 fois en production. `/market/` n'est
// jamais servie par le bord — elle est `no-store` et redirige en anonyme —
// donc ces octets repartaient de l'origine à chaque visite.
// ⭐⭐⭐ LE CONTRÔLE SE FAIT DANS LES DEUX SENS, et c'est tout l'intérêt :
//   ① le HTML SERVI n'en porte plus aucun — sinon on n'a rien économisé ;
//   ② le DOM APRÈS pilote les porte TOUS — sinon on n'a pas allégé la page,
//      on a supprimé une aide, et personne ne s'en apercevrait avant un
//      utilisateur qui survole une cellule vide et ne comprend pas.
// Un banc qui ne tiendrait que ① serait vert le jour où le pilote cesse de
// reposer le libellé. C'est la faute du §9 de `test:membre` la veille du
// lot 142 : contrôler la forme qu'on vient de retirer, pas l'effet voulu.
// ⚠️ Le libellé est TRADUIT : on ne compare pas à une chaîne écrite ici, on
// compare à ce que le gabarit a déclaré. Une valeur en dur dans ce banc
// deviendrait fausse à la première page servie dans une autre langue.
{
  const declare = (document.getElementById('vue-tbl') || {}).getAttribute
    ? document.getElementById('vue-tbl').getAttribute('data-attente-txt')
    : null;
  verifie('le libellé d\'attente est déclaré UNE fois sur l\'hôte du tableau',
    !!declare, declare ? `« ${declare} »` : '🔴 `data-attente-txt` absent de #vue-tbl');
  if (declare) {
    // ⚠️ LE PÉRIMÈTRE SE DÉCLARE, IL NE SE RÉTRÉCIT PAS EN SILENCE. Ce qui
    // coûtait, c'est la RÉPÉTITION par ligne, pas le libellé lui-même : une
    // occurrence isolée hors du tableau (la puce verrouillée de la barre) est
    // légitime et vaut 25 o. On mesure donc les deux, avec un plafond nommé —
    // un contrôle qu'on restreint jusqu'à ce qu'il passe finit par ne plus
    // rien interdire.
    const PLAFOND_HORS_TABLEAU = 2;
    const compte = (t) => (t.match(/title="[^"]*"/g) || [])
      .filter((x) => x === `title="${declare}"`).length;
    const corpsHtml = (html.match(/<tbody[\s\S]*?<\/tbody>/i) || [''])[0];
    const dansCorps = compte(corpsHtml);
    const surPage = compte(html);
    verifie('① le corps du tableau ne répète plus le libellé', dansCorps === 0,
      dansCorps ? `🔴 ${dansCorps} occurrence(s) dans le <tbody>` : `zéro dans le <tbody>, ${surPage} ailleurs sur la page`);
    verifie(`…et le reste de la page en garde au plus ${PLAFOND_HORS_TABLEAU}`,
      surPage - dansCorps <= PLAFOND_HORS_TABLEAU,
      `${surPage - dansCorps} hors tableau (plafond ${PLAFOND_HORS_TABLEAU})`);
    const cells = [...document.querySelectorAll('#vue-tbl [data-attente]')];
    const nus = cells.filter((e) => e.getAttribute('title') !== declare);
    verifie('② le pilote le repose sur CHAQUE cellule en attente', cells.length > 0 && nus.length === 0,
      cells.length === 0 ? '🔴 aucune cellule `data-attente` — le banc ne mesure rien'
        : (nus.length ? `🔴 ${nus.length}/${cells.length} cellule(s) sans libellé`
          : `${cells.length} cellule(s) servies par le pilote`));
  }
}

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

// ── ET LE FILTRE MORD — MAIS IL A CHANGÉ DE CÔTÉ, ET LE CONTRÔLE AUSSI.
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 155-C — CE CONTRÔLE ÉTAIT DEVENU IMPOSSIBLE À TENIR TEL QUEL.
// Il cochait une case et comptait les tuiles restées visibles : c'était juste
// tant que le pilote filtrait des nœuds. Depuis, cocher une case SOUMET le
// formulaire — dans `linkedom` il ne se passerait rien du tout, et le banc
// aurait mesuré l'absence de réaction d'un DOM sans navigateur.
//
// ⭐⭐⭐ ON LE POSE DONC LÀ OÙ LE FILTRE VIT MAINTENANT : sur le vrai serveur,
// avec une vraie requête. C'est plus fort que l'ancien à trois titres — il
// exerce la CHAÎNE ENTIÈRE (URL → `lireParams` → `selectionMarche` → HTML), il
// ne dépend d'aucun émulateur de DOM, et il vérifie que ce que la page AFFICHE
// est ce qu'elle a RETENU.
// ⛔ La cause ② du lot 71 reste gardée, autrement : les tuiles se bâtissent
// DEPUIS les lignes servies (contrôle ci-dessus, `bati === lignesDom.length`).
// Deux corpus différents entre les vues sont devenus structurellement
// impossibles — il n'y a plus qu'une liste, et c'est le serveur qui la fait.
const rarete = [...document.querySelectorAll('input[name=f-rar]')].map((x) => x.value)[0];
if (!rarete) {
  indecis('le filtre de rareté', 'aucune case f-rar dans la page');
} else {
  const rf = await fetch(`http://127.0.0.1:${PORT}/market/?f-rar=${encodeURIComponent(rarete)}&f-n=${RENDU_MAX}`,
    { headers: { cookie: 'vp_session=banc-tuiles' } });
  const hf = await rf.text();
  const trs = hf.match(/<tr data-type=[\s\S]*?data-date="[^"]*"/g) || [];
  const horsFiltre = trs.filter((t) => !t.includes(`data-rar="${rarete}"`)).length;

  // ⭐ L'ANCRE EST INDÉPENDANTE DE LA PAGE FILTRÉE : c'est la projection du
  //   build. Compter les lignes retenues dans le HTML puis les comparer à ce
  //   même HTML serait un contrôle qui interroge sa propre source — il ne
  //   pourrait pas échouer.
  const proj = JSON.parse(readFileSync(join(ROOT, '.reserve', 'marche.json'), 'utf8'));
  const attendu = (proj.marche || []).filter((i) => i.rarity === rarete).length;

  verifie(`⛔ le filtre « ${rarete} » mord AU SERVEUR — aucune ligne étrangère`,
    trs.length > 0 && horsFiltre === 0,
    trs.length === 0 ? '🔴 aucune ligne rendue : le filtre a tout jeté'
      : (horsFiltre ? `🔴 ${horsFiltre} ligne(s) d'une autre rareté sur ${trs.length}`
        : `${trs.length} ligne(s), toutes en ${rarete}`));

  // ⛔ ET IL DOIT MORDRE SUR LE CATALOGUE ENTIER, PAS SUR LA TRANCHE. C'est la
  //    panne que ce lot rendrait possible : filtrer APRÈS avoir tranché rendrait
  //    « 3 résultats » là où il y en a 300, sans qu'aucun nombre n'ait l'air faux.
  if (attendu > 0) {
    verifie('…et il a vu TOUT le catalogue coté, pas la tranche affichée',
      trs.length === Math.min(attendu, RENDU_MAX),
      `${trs.length} rendue(s) pour ${attendu} en ${rarete} dans la projection (RENDU_MAX = ${RENDU_MAX})`);
  } else {
    indecis('la portée du filtre', `aucune fiche « ${rarete} » dans la projection : rien à retenir`);
  }

  // ⭐ LE COMPTEUR EST ÉCRIT PAR LE SERVEUR DEPUIS CE LOT : il doit dire le
  //   nombre RETENU, pas le nombre rendu. Un compteur qui recopierait la
  //   tranche afficherait « 20 » sur 300 correspondances — et il aurait l'air
  //   parfaitement normal.
  const cptTxt = (hf.match(/id="cpt"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1].replace(/<[^>]*>/g, ' ');
  // ⛔ ON NE DEVINE PAS LE SÉPARATEUR DE MILLIERS. `toLocaleString` rend « 8 840 »
  //    avec une espace fine insécable en français, une virgule en anglais, un
  //    point en allemand : un motif qui en suppose un serait rouge dans quatre
  //    langues sur cinq. On recolle les groupes de chiffres séparés par UN seul
  //    caractère quelconque, et on compare des nombres.
  const compact = cptTxt.replace(/(\d)[^\d\w](\d)/g, '$1$2').replace(/(\d)[^\d\w](\d)/g, '$1$2');
  const chiffres = (compact.match(/\d+/g) || []).map(Number);
  verifie('le compteur annonce le nombre RETENU, pas la tranche',
    attendu === 0 || chiffres.includes(attendu),
    `« ${cptTxt.trim()} » · attendu ${attendu} quelque part`);
}

fin();
