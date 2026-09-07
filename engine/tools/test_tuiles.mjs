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
import { existsSync, writeFileSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { lireTemoin } from '../lib/astro_temoin_build.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
// 📣 LOT 203 — la racine du dépôt, pour lire les dictionnaires. ⛔ Pas `ROOT` :
//   celui-là peut être surchargé par `PROJECT_ROOT` pour viser un `dist/` ailleurs,
//   alors que `engine/i18n/` vit toujours à côté de ce fichier-ci.
const R_I18N = new URL('../..', import.meta.url).pathname;
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

// 🔴🔴🔴 LOT 201 — DEUX RAISONS POUR UN MÊME FICHIER ABSENT, DEUX VERDICTS.
//   Ce banc annonçait « INDÉCIDABLE — entry.mjs absent » sur vevewiki, à
//   CHAQUE campagne. Or vevewiki est rendu en STATIQUE : il n'a pas de serveur,
//   il n'en aura jamais, et `/market/` n'existe pas chez lui. La question
//   « peut-on servir cette page avec une session ? » y est TRANCHÉE, elle vaut
//   non — c'est un SANS OBJET, pas un trou.
//   ⭐⭐⭐ ET LA DIFFÉRENCE N'EST PAS COSMÉTIQUE : le Dockerfile n'accepte aucun
//   indécidable, et un indécidable qui revient à chaque build apprend à tout le
//   monde à les ignorer — jusqu'au jour où il en apparaît un vrai.
//   ⚠️ Le VRAI indécidable existe toujours, et il reste : sur un site rendu au
//   serveur, un `entry.mjs` manquant veut bien dire « je n'ai pas pu regarder,
//   le banc est passé avant le build ». On distingue donc sur le MODE DE RENDU,
//   jamais sur l'absence du fichier — c'est la cause qu'on lit, pas le symptôme.
if (!existsSync(ENTREE)) {
  const statique = String(process.env.RENDERING || '').toLowerCase() === 'static';
  if (statique) {
    console.log('  --  SANS OBJET — ce site est rendu en statique : il n\'a pas de serveur,'
      + ' et `/market/` n\'existe que sur veveprice.');
  } else {
    indecis('le serveur', `${ENTREE} absent — ce banc vient APRÈS npm run build`);
  }
  fin(0);
}

// ── Le faux service de session. ⛔ IL NE MENT PAS SUR LE MUR : il tient la
// place du service d'identité, exactement comme `SESSION_API` en production.
// Sans lui `/market/` répond 302 et le banc mesurerait une page de connexion —
// c'est précisément l'angle mort de `test:pages`, qui demande `/market/` sans
// session et n'atteint donc JAMAIS le rendu qu'on veut peser.
// 🔔 LOT 201 — LE FAUX SERVICE REND AUSSI `jours_restants`, comme veveid.
// ⭐⭐⭐ ET IL RÉPOND SELON LE SID, ce qui permet de demander la MÊME page dans
//   deux états sans relancer le serveur. C'est ce qui rend mesurable « le
//   dernier jour a sa propre phrase » : on COMPARE deux rendus, au lieu de
//   croire une étiquette.
// ⚠️ 3 est DANS le délai de rappel (3 ≤ 5) : au-delà la bannière ne s'émettrait
//   pas du tout, et le §  serait vert sans avoir rien vu.
const JOURS_FAUX = 3;
const SID_DERNIER = 'banc-dernier-jour';
// 📊 LOT 202 — le compte que le faux service d'identité reconnaît, et la base
//   jetable dans laquelle ses préférences seront rangées. ⛔ Un chemin sous
//   `/data` ferait dépendre ce banc d'un volume monté : le bac à sable ne
//   tourne pas en root, et l'écriture échouerait pour une raison qui n'est pas
//   son sujet.
const COMPTE_FAUX = 'banc-compte-202';
const BASE_JETABLE = join(mkdtempSync(join(tmpdir(), 'veve-tuiles-')), 'prefs.db');
const faux = createServer((req, res) => {
  if (req.url.startsWith('/session/')) {
    const dernier = req.url.includes(SID_DERNIER);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ palier: 'member', jours_restants: dernier ? 1 : JOURS_FAUX }));
    return;
  }
  // 📊 LOT 202 — LE SECOND ENDPOINT, ET IL EST DIFFÉRENT DU PREMIER.
  //   `/session/<sid>` rend le palier, et c'est tout ce que le middleware
  //   demande. L'IDENTIFIANT DE COMPTE vient de `/api/session?sid=`, avec le
  //   secret de service — c'est cette distinction qui a décidé de toute
  //   l'architecture du lot 154-B, et sans elle `/api/reglages` ne peut rien
  //   ranger. ⇒ le faux service doit répondre aux DEUX, sinon ce banc mesure
  //   une route qui échoue pour une raison qui n'a rien à voir avec son sujet.
  if (req.url.startsWith('/api/session')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ compte: COMPTE_FAUX, email: 'banc@exemple.test' }));
    return;
  }
  res.writeHead(404); res.end('{}');
});
await new Promise((ok) => faux.listen(PORT_SESSION, '127.0.0.1', ok));

const serveur = spawn(process.execPath, [ENTREE], {
  env: {
    ...process.env, HOST: '127.0.0.1', PORT: String(PORT),
    SESSION_API: `http://127.0.0.1:${PORT_SESSION}`,
    // 📊 LOT 202 — sans ces deux-là, `/api/reglages` lève avant d'avoir rien
    //   fait : `compteDeLaSession()` refuse de partir sans secret de service,
    //   et `prefs.mjs` ouvrirait `/data`, que ce bac à sable n'a pas.
    VEVEID_SERVICE: process.env.VEVEID_SERVICE || 'secret-de-banc',
    DB_PATH: BASE_JETABLE,
  },
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

// ═══ 🆕 LOT D — LA FORME DE LA BARRE, JUGÉE ICI ET NULLE PART AILLEURS ══════
// 🔴🔴🔴 POURQUOI CES CINQ LIGNES SONT DANS *CE* BANC. `test:pli` §5 juge le
// rail sur les pages pré-générées, en lisant `dist/`. `/market/` n'y est PAS :
// elle est `prerender = false`, donc absente du disque, donc invisible à tout
// contrôle qui lit des fichiers. Ce banc est le SEUL du dépôt qui la RENDE.
// ⭐⭐ Et l'absence de contrôle y coûte cher : c'est exactement ici que le LOT D
// s'est cassé sans que rien ne rougisse. Une variable `forme` déclarée dans le
// gabarit écrasait la fonction `forme()` de `vitrine.mjs`, le rendu levait
// `TypeError: forme is not a function`, le SERVEUR mourait — et ce banc ne
// disait pas « écart », il s'écroulait sur un socket fermé. *Un build vert ne
// dit rien d'une page que le build ne rend pas.*
console.log('\n1 bis. la barre de filtres a bien sa forme de rail');
verifie('la barre vit dans son enveloppe (`.avec-rail`)',
  /class="avec-rail"/.test(html),
  '🔴 sans enveloppe, le rail redevient une bande horizontale en PC');
verifie('…et le contenu a la sienne (`.avec-rail__c`)',
  /class="avec-rail__c"/.test(html),
  '🔴 sans elle, tableau, tuiles et pagination deviennent trois cellules de grille');
verifie('…et la barre porte `data-rail` — les groupes s\'ouvrent ensemble',
  /class="barre-f"[^>]*data-rail/.test(html),
  '🔴 sans lui, ouvrir un panneau referme le précédent, en silence');
{
  // ⭐ AUTANT DE GROUPES QUE DE PANNEAUX, et surtout pas le nombre 8 gravé :
  // le jour où un neuvième axe arrive, un contrôle qui compte 8 rougit sur du
  // code sain — et *un faux rouge se fait désarmer en trois jours.*
  const g = (html.match(/class="rail-g"/g) || []).length;
  const pan = new Set(html.match(/id="fp-[a-z]+"/g) || []).size;
  verifie(`chaque axe a SON panneau dans son groupe (${g} groupes, ${pan} panneaux)`,
    g > 0 && g === pan,
    `🔴 ${g} groupe(s) pour ${pan} panneau(x) — l'accordéon du rail est boiteux`);
}
verifie('…et le pied de la feuille SOUMET, il ne recopie pas un nombre',
  /class="f-pied"[\s\S]{0,300}?type="submit"/.test(html),
  '🔴 ici le filtrage est SERVEUR : un bouton qui ne soumet pas ne filtre rien');
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
// 🔴🔴🔴 LOT 155-C — LE FILTRE S'ÉPROUVE ICI, ET LA PLACE EST LE SUJET
// ═══════════════════════════════════════════════════════════════════════════
// PAYÉ LE 17/08 : ce bloc était écrit à la fin du §3, après `arreter()`. Il
// demandait une page à un serveur déjà tué — `TypeError: fetch failed`,
// `SocketError: other side closed`, et le banc ne rougissait pas : **il
// PLANTAIT**, message Node à l'appui, sur un déploiement dont tous les
// contrôles étaient verts. ⭐ *Un contrôle réseau posé après la coupure du
// serveur ne mesure rien — il tombe.* ⇒ tout ce qui parle au serveur vit AVANT
// `arreter()`, et le `try/catch` ci-dessous nomme la cause si ça recommence.
//
// ⭐⭐⭐ ET IL REMPLACE L'ANCIEN CONTRÔLE CLIENT (cocher une case, compter les
// tuiles restées visibles), devenu impossible : depuis le lot 155-C, cocher une
// case SOUMET le formulaire — dans `linkedom` il ne se passerait rien, et le
// banc aurait mesuré l'absence de réaction d'un DOM sans navigateur.
// Il est plus fort à trois titres : il exerce la CHAÎNE ENTIÈRE (URL →
// `lireParams` → `selectionMarche` → HTML), il ne dépend d'aucun émulateur, et
// son ANCRE est indépendante — le nombre attendu vient de `.reserve/marche.json`,
// pas de la page qu'on juge.
// ⛔ La cause ② du lot 71 (« deux vues, deux corpus ») reste gardée autrement :
// les tuiles se bâtissent DEPUIS les lignes servies (§3, `bati === lignesDom`).
// ═══════════════════════════════════════════════════════════════════════════
// 🖼️🔴🔴 LA COUVERTURE DE LA PREMIÈRE COLONNE ARRIVE-T-ELLE À L'ÉCRAN ?
// ═══════════════════════════════════════════════════════════════════════════
// Preda, deux jours de suite : « la vignette en mode tableau n'est visible sur
// AUCUNE ligne, je viens de vérifier. » Le 25/08, tout ce qui pouvait se
// mesurer sans servir la page disait le contraire — le gabarit l'émet, le CSS
// servi la dimensionne (48×72, `display:block`), le champ est dans
// `CHAMPS_MARCHE`, la porte « cote » ne le retire pas.
//
// ⭐⭐⭐ CE BANC EST LE SEUL ENDROIT DU DÉPÔT QUI SERT `/market/` AVEC UNE
// SESSION. C'était donc le seul capable de répondre, et personne n'y regardait :
// aucun contrôle ne comptait les couvertures rendues. *Un défaut que personne
// n'a instrumenté ne se mesure jamais, il se discute.*
// ⛔ ET IL NE JUGE PAS L'AVANCEMENT D'UNE COLLECTE : il n'exige pas un
//    pourcentage d'images. Il exige que la CELLULE existe sur chaque ligne, et
//    que chacune porte l'une des deux formes prévues — une image, ou le losange
//    de repli. Le jour où le catalogue n'aurait plus une seule couverture, ce
//    banc resterait vrai ; c'est le journal du build qui dit le nombre.
console.log('\n2 ter. la colonne « couverture » arrive-t-elle jusqu\'à la page ?');
{
  const tds = html.match(/<td class="rang vign">[\s\S]*?<\/td>/g) || [];
  const lignes = (html.match(/<tr data-type=/g) || []).length;
  verifie('⛔ chaque ligne rendue porte SA cellule de couverture',
    lignes > 0 && tds.length === lignes,
    `${tds.length} cellule(s) pour ${lignes} ligne(s)`
    + (lignes && tds.length === 0 ? ' 🔴 la colonne ne sort pas du gabarit' : ''));
  const avecImg = tds.filter((t) => t.includes('vign__i')).length;
  const avecRepli = tds.filter((t) => t.includes('vign__v')).length;
  verifie('…et chacune porte une image OU le losange de repli, jamais rien',
    tds.length > 0 && avecImg + avecRepli === tds.length,
    `${avecImg} image(s) · ${avecRepli} repli(s) · ${tds.length - avecImg - avecRepli} vide(s)`);
  // ⭐ L'EN-TÊTE AUSSI : une cellule sans son `<th>` décale toute la grille, et
  //   `test:gabarits` ne compte que les accolades, pas les colonnes.
  const th = (html.match(/<th scope="col" class="rang">/g) || []).length;
  verifie('…et l\'en-tête de la colonne est là (sinon la grille se décale)',
    th === 1, `${th} en-tête(s) « rang »`);
  // ⛔ LE TÉMOIN INVERSE, sinon les trois lignes ci-dessus seraient vraies sur
  //   une page vide : on vérifie que la première cellule porte VRAIMENT une
  //   adresse d'image, pas une balise creuse.
  const premiere = tds.find((t) => t.includes('vign__i'));
  verifie('⛔ la première image porte une adresse, pas un attribut creux',
    !!premiere && /src="https?:\/\/[^"]{10,}"/.test(premiere),
    premiere ? premiere.replace(/\s+/g, ' ').slice(0, 120) : '🔴 aucune image parmi les lignes servies');
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔇🔴🔴🔴 LOT 196 — LA MESURE ATTEINT-ELLE UN LECTEUR ?
// ═══════════════════════════════════════════════════════════════════════════
// Le lot 195 comptait les couvertures dans le JOURNAL du build. Mesuré sur le
// déploiement du 25/08 à 11 h 23 : le journal Coolify s'arrête à la 10ᵉ seconde
// de l'étape. La ligne était écrite, elle était juste, personne ne l'a lue.
// ⇒ Le compte passe par le témoin et ressort sur `/api/sante`, une adresse
//   publique qu'on interroge quand on veut.
// ⭐⭐⭐ ET CE CONTRÔLE EXISTE PARCE QU'UN INSTRUMENT NON ÉPROUVÉ N'EST PAS UN
// INSTRUMENT. Si le champ disparaissait du témoin, la sonde rendrait `null` —
// c'est-à-dire exactement ce qu'elle rend sur un site sans projection — et on
// conclurait « pas de couverture » sur une panne de mesure. Le banc sépare les
// deux : ici, il y a une projection, donc le nombre DOIT être un nombre.
console.log('\n2 quater. la mesure des couvertures sort-elle par la sonde ?');
{
  const sante = await (await fetch(`http://127.0.0.1:${PORT}/api/sante`)).json().catch(() => null);
  const m = sante && sante.marche;
  if (!m) {
    verifie('⛔ `/api/sante` porte le bloc « marche »', false,
      '🔴 absent — la mesure des couvertures ne sort nulle part');
  } else {
    verifie('⛔ `/api/sante` porte le bloc « marche »', true,
      `lignes=${m.lignes} · avecImage=${m.avecImage} · ecartes=${m.ecartes} · horsLigne=${m.horsLigne}`);
    // ⛔ `null` EST UN ÉCHEC ICI, ET SEULEMENT ICI : ce banc tourne avec une
    //    projection sous la main. Ailleurs (site sans porte « cote »), `null`
    //    est la bonne réponse. Un contrôle qui accepterait `null` des deux
    //    côtés ne saurait plus distinguer « aucune image » de « je n'ai pas su
    //    compter » — la confusion même qui a coûté deux jours sur la vignette.
    verifie('…et ses trois nombres sont des NOMBRES, pas des « je ne sais pas »',
      Number.isFinite(m.lignes) && Number.isFinite(m.avecImage) && Number.isFinite(m.ecartes),
      `lignes ${typeof m.lignes} · avecImage ${typeof m.avecImage} · ecartes ${typeof m.ecartes}`);
    // ⭐ ET IL DIT LA VÉRITÉ : le nombre annoncé par la sonde doit être celui
    //   de la projection sur le disque, pas un compte parallèle.
    const proj0 = JSON.parse(readFileSync(join(ROOT, '.reserve', 'marche.json'), 'utf8'));
    const vrai = (proj0.marche || []).reduce((n, i) => n + (i && i.image ? 1 : 0), 0);
    verifie('⛔ le nombre annoncé est celui de la projection déposée',
      m.avecImage === vrai, `sonde ${m.avecImage} · disque ${vrai}`);
    // ⭐ Le témoin dit d'où vient le chiffre. Sans lui, « 83 sur 90 » se lirait
    //   comme un chiffre de production alors qu'il vient de l'échantillon.
    verifie('…et la sonde dit si le build était hors ligne',
      typeof m.horsLigne === 'boolean', `horsLigne = ${m.horsLigne}`);
  }
}

console.log('\n2 bis. le filtre mord-il AU SERVEUR, et sur tout le catalogue ?');
{
  const proj = JSON.parse(readFileSync(join(ROOT, '.reserve', 'marche.json'), 'utf8'));
  const pop = proj.marche || [];
  // ⭐ La rareté vient de la PROJECTION, pas de la page : un critère lu sur la
  //   page qu'on juge serait un contrôle qui interroge sa propre source.
  //   ⛔ Et on prend la PLUS FRÉQUENTE : une rareté à 1 exemplaire rendrait le
  //   contrôle vrai pour la mauvaise raison — « 1 sur 1 », c'est aussi ce que
  //   rend un filtre cassé qui ne garde que la première ligne.
  // 🔴🔴 LOT 193 — ON NE COMPTE QUE LES PIÈCES QUE LA PAGE MONTRE.
  // Depuis le lot 193, le corpus par défaut de `/market/` retire les planchers
  // fantaisistes AVANT tout filtre. Compter la rareté sur la projection BRUTE
  // revenait à exiger que le filtre de rareté annule ce retrait : le compteur
  // annonçait 20 là où ce banc attendait 21, et il avait tort d'attendre 21.
  // ⭐ La propriété gardée n'a pas changé — « le filtre a vu TOUT le catalogue,
  //   pas la tranche affichée » — seule l'idée de « tout le catalogue » s'est
  //   précisée : c'est le catalogue VISIBLE, celui dont le compteur parle.
  // ⛔ La case « prix non retenus » est un choix du visiteur ; sans elle, la
  //   page n'a jamais prétendu montrer les planchers écartés.
  const parRar = {};
  for (const it of pop) if (it.rarity && !it.floorEcarte) parRar[it.rarity] = (parRar[it.rarity] || 0) + 1;
  const rarete = Object.keys(parRar).sort((a, b) => parRar[b] - parRar[a])[0];
  if (!rarete) {
    indecis('le filtre de rareté', 'aucune rareté dans la projection : rien à filtrer');
  } else {
    const attendu = parRar[rarete];
    // 🔴🔴🔴 ON DEMANDE UNE TRANCHE COURTE, PAS `RENDU_MAX`, ET C'EST TOUT LE
    // CONTRÔLE. Première version : `?f-n=RENDU_MAX`, puis « le nombre de lignes
    // rendues = le nombre de fiches de cette rareté ». **Elle est restée VERTE
    // sous injection** — j'ai fait filtrer le serveur APRÈS avoir tranché (la
    // panne exacte que ce § doit attraper) et rien n'a bougé : sur un corpus
    // plus petit que `RENDU_MAX`, trancher puis filtrer et filtrer puis trancher
    // rendent la MÊME liste. *Un contrôle dont le terme à zéro n'est pas
    // atteignable ne garde rien.*
    // ⭐⭐⭐ En demandant `PAR_PAGE`, les deux nombres se séparent : la page rend
    // 20 lignes, mais le COMPTEUR doit annoncer les 55 retenues. Un serveur qui
    // filtrerait la tranche annoncerait 20 — et la différence se voit à toute
    // échelle, y compris hors réseau.
    let hf = null, erreur = '';
    try {
      const rf = await fetch(`http://127.0.0.1:${PORT}/market/?f-rar=${encodeURIComponent(rarete)}&f-n=${PAR_PAGE}`,
        { headers: { cookie: 'vp_session=banc-tuiles' } });
      hf = await rf.text();
    } catch (e) { erreur = e.message; }

    if (hf === null) {
      // ⛔ PAS « INDÉCIDABLE » : un serveur qui ne répond plus au milieu d'un banc
      //    EST une faute, et le message dit laquelle chercher en premier.
      verifie('le serveur répond encore pour la requête filtrée', false,
        `🔴 ${erreur} — ce bloc est-il passé APRÈS arreter() ? (panne du 17/08)`);
    } else {
      // ⛔ ON S'ARRÊTE AU PREMIER `>`, PAS À `data-date`. Un attribut vide peut
      //    disparaître au rendu : une regex qui exige `data-date` avalerait la
      //    ligne suivante sur toute fiche sans date, et SOUS-compterait — un banc
      //    trop indulgent, en silence. ⭐ `data-rar` est écrit AVANT `data-n` :
      //    même si un nom contenait un `>`, la rareté est déjà captée.
      const trs = hf.match(/<tr data-type=[\s\S]*?>/g) || [];
      const horsFiltre = trs.filter((t) => !t.includes(`data-rar="${rarete}"`)).length;
      verifie(`⛔ le filtre « ${rarete} » mord AU SERVEUR — aucune ligne étrangère`,
        trs.length > 0 && horsFiltre === 0,
        trs.length === 0 ? '🔴 aucune ligne rendue : le filtre a tout jeté'
          : (horsFiltre ? `🔴 ${horsFiltre} ligne(s) d'une autre rareté sur ${trs.length}`
            : `${trs.length} ligne(s), toutes en ${rarete}`));

      verifie('…et la page filtrée rend bien UNE TRANCHE',
        trs.length === Math.min(PAR_PAGE, attendu),
        `${trs.length} ligne(s) pour ${Math.min(PAR_PAGE, attendu)} attendue(s)`);

      // ⭐ Le compteur est écrit par le SERVEUR depuis ce lot : il annonce ce que
      //   le filtre a RETENU sur tout le catalogue, pas ce que la page montre.
      // ⛔ ON NE DEVINE PAS LE SÉPARATEUR DE MILLIERS : « 8 840 », « 8,840 » et
      //   « 8.840 » sont le même nombre. Un motif qui en suppose un serait rouge
      //   dans quatre langues sur cinq.
      const cptTxt = (hf.match(/id="cpt"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1].replace(/<[^>]*>/g, ' ');
      const compact = cptTxt.replace(/(\d)[^\d\w](\d)/g, '$1$2').replace(/(\d)[^\d\w](\d)/g, '$1$2');
      const chiffres = (compact.match(/\d+/g) || []).map(Number);
      const lisible = cptTxt.trim().replace(/\s+/g, ' ');
      if (attendu <= PAR_PAGE) {
        // ⛔ SANS OBJET, ET ÇA SE DIT : quand la rareté la plus fréquente tient
        //    dans une tranche, « rendues » et « retenues » sont le même nombre —
        //    le contrôle ne peut pas les départager. Se conditionner sur le
        //    CORPUS, jamais sur ce que la page a rendu.
        indecis('la portée du filtre',
          `la rareté la plus fréquente (${rarete}) n'a que ${attendu} fiche(s), sous PAR_PAGE (${PAR_PAGE}) : rendues et retenues se confondent`);
      } else {
        verifie('⛔ le filtre a vu TOUT le catalogue coté, pas la tranche affichée',
          chiffres.includes(attendu),
          chiffres.includes(attendu)
            ? `${trs.length} ligne(s) rendue(s), compteur « ${lisible} »`
            : `🔴 le compteur ne dit nulle part ${attendu} : « ${lisible} » — le serveur a-t-il filtré APRÈS avoir tranché ?`);
      }
    }
  }
}

// 🔴🔴🔴 CE §  DOIT VIVRE **AVANT** `arreter()`, ET C'EST TOUT LE PIÈGE.
//   Première rédaction : placé à la fin du fichier, après les sections qui
//   travaillent sur un DOM déjà chargé. Le serveur y est mort depuis deux
//   cents lignes — le banc est tombé sur ECONNREFUSED, pas sur un écart.
//   ⭐⭐⭐ *Un banc au mauvais MOMENT ne mesure pas son sujet, il mesure son
//   propre ordre d'exécution* — et un plantage n'est pas un verdict.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2 quinquies. la bannière « votre accès se termine dans N jours » (lot 201)');
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ POURQUOI CE §  VIT **ICI**, DANS LE BANC DES TUILES. Ce fichier est le
// SEUL endroit du dépôt qui sert une page avec une SESSION : un vrai serveur
// lancé sur `dist/`, et un faux service d'identité à la place de veveid. La
// bannière ne s'affiche QUE pour un membre connecté dont l'abonnement se
// termine — c'est-à-dire dans un rendu qu'aucun autre banc n'atteint.
// ⛔ Un contrôle de SOURCE aurait dit qu'un gabarit contient un `if`. Il
//   n'aurait rien dit du middleware, ni de `Astro.locals`, ni du seuil, ni de
//   savoir si le chiffre traverse vraiment les deux dépôts.
//
// 🔴🔴 ET IL MESURE UNE CHAÎNE COMPLÈTE, C'EST TOUT SON INTÉRÊT :
//   faux veveid → `GET /session/<sid>` → middleware → `Astro.locals` → seuil
//   de la page → HTML servi. Un maillon coupé n'importe où et ce §  rougit.
{
  const lire = async (sid) => {
    const rep = await fetch(`http://127.0.0.1:${PORT}/compte/`, { headers: { cookie: `vp_session=${sid}` } });
    return { statut: rep.status, html: await rep.text() };
  };
  const BANDEAU = /<p class="avertis"[^>]*data-fin="(\d+)"[^>]*>([\s\S]*?)<\/p>/;
  // ⚠️ LES TROIS SENTINELLES DU MARQUAGE S'ÉCRIVENT EN ÉCHAPPEMENT, JAMAIS
  //    EN CLAIR : ce sont des caractères de CONTRÔLE, invisibles dans un
  //    éditeur et perdus à la première copie qui les normalise.
  const nu = (x) => x.replace(/<[^>]*>/g, '')
    .replace(/[\u0011\u0012\u0013]/g, ' ').replace(/\s+/g, ' ').trim();

  const { statut, html: page } = await lire('banc-tuiles');
  verifie('`/compte/` se rend pour un membre connecté', statut === 200,
    statut === 200 ? `${Buffer.byteLength(page)} o` : `🔴 statut ${statut}`);

  if (statut === 200) {
    // ═════════════════════════════════════════════════════════════════════
    // 🔴🔴🔴 CE §  A DÉJÀ FAIT ÉCHOUER UN DÉPLOIEMENT — SUR DU CODE JUSTE.
    // ═════════════════════════════════════════════════════════════════════
    // Première version : il cherchait la CLÉ i18n `account.endsIn` dans le
    // HTML servi. Cette clé n'y est QUE sous `I18N_MARQUAGE=1` — un réglage
    // que la CI pose pour `npm test`, et que le **Dockerfile ne pose PAS**
    // pour ce banc-ci (`RUN WAREHOUSE_OFFLINE=1 npm run test:tuiles`). Vert en
    // bac à sable, rouge à l'étape 52 sur 57 du build de production.
    // ⭐⭐⭐ *Sur quoi est-il branché ?* — sur un marqueur de mise au point, pas
    // sur son sujet. Un banc doit tenir dans les DEUX conditions : c'est le
    // Dockerfile, et lui seul, qui décide d'un déploiement.
    // ⇒ On lit `data-fin`, posé par le gabarit : il ne dépend ni de la langue,
    //   ni du mode de marquage, ni de la formulation.
    const bandeau = page.match(BANDEAU);
    verifie('`/compte/` porte la bannière de fin d\'accès',
      !!bandeau, bandeau ? `data-fin="${bandeau[1]}"`
        : '🔴 absente — le chiffre n\'a pas traversé middleware → locals → page');

    if (bandeau) {
      const texte = nu(bandeau[2]);
      verifie('…et son chiffre est celui du service d\'identité',
        bandeau[1] === String(JOURS_FAUX), `${bandeau[1]} vu · ${JOURS_FAUX} attendu`);

      // 🐛 LE DÉFAUT DU 26/08, QUE LA VERSION PRÉCÉDENTE AVAIT LAISSÉ PASSER :
      //    le libellé était écrit « ends in ${n} days » — la forme recopiée sur
      //    `caisse.perMonth` (« ${v} / month »), où le `$` est le SYMBOLE
      //    DOLLAR et non une syntaxe. `t()` substitue `{n}`, jamais `${n}` ⇒ la
      //    page servait « ends in $3 days » à des clients qui paient.
      //    ⭐⭐⭐ *Un banc qui cherche une CLÉ ne lit jamais ce que l'utilisateur
      //    voit.* Celui-ci lit le TEXTE, et refuse toute trace de gabarit.
      const reste = texte.match(/\$\{|\{\w+\}|\$\d/);
      verifie('…et le libellé ne porte AUCUNE trace de gabarit non substitué',
        !reste, reste ? `🔴 « ${texte.slice(0, 90)} » — motif ${reste[0]}` : `« ${texte.slice(0, 58)}… »`);
      verifie('…et le nombre est bien écrit dans la phrase',
        new RegExp(`(^|[^\\d])${JOURS_FAUX}([^\\d]|$)`).test(texte), `« ${texte.slice(0, 58)}… »`);

      // ⭐⭐⭐ LE DERNIER JOUR SE MESURE PAR COMPARAISON, PAS PAR UNE ÉTIQUETTE.
      //    « il reste 1 jours » ne s'écrit pas, et aucune langue ne pluralise
      //    comme le français. On demande donc la MÊME page dans l'autre état et
      //    on exige que la phrase DIFFÈRE — vrai en cinq langues, vrai avec ou
      //    sans marquage, et vrai le jour où la formulation change.
      const autre = (await lire(SID_DERNIER)).html.match(BANDEAU);
      const distinctes = !!autre && nu(autre[2]) !== texte;
      verifie('…et le DERNIER jour a sa propre phrase',
        !!autre && autre[1] === '1' && distinctes,
        autre ? `data-fin="${autre[1]}" · phrase ${distinctes ? 'différente' : '🔴 IDENTIQUE'}`
          : '🔴 aucune bannière à 1 jour');
    }

    // ⭐ LA CONTRE-ÉPREUVE : la classe existe VRAIMENT dans la feuille servie.
    //   Une bannière posée avec une classe que personne ne peint est un « posé
    //   jamais lu » — invisible dans les deux sens.
    const feuille = [...page.matchAll(/href="(\/theme-[^"]+\.css)"/g)][0];
    if (!feuille) {
      indecis('la classe de la bannière', 'aucune feuille de thème référencée sur cette page');
    } else {
      const css = await (await fetch(`http://127.0.0.1:${PORT}${feuille[1]}`)).text();
      verifie('…et `.avertis` est bien peinte par le thème servi',
        /\.avertis\s*\{/.test(css),
        /\.avertis\s*\{/.test(css) ? 'règle présente' : '🔴 classe posée, jamais peinte');
    }
  }
}

// 🔴🔴🔴 CE § DOIT VIVRE **AVANT** `arreter()`, COMME CELUI D'AU-DESSUS.
//   Écrit à la fin du fichier au premier jet, il tombait après l'arrêt du
//   serveur : `ECONNREFUSED`, et un banc qui meurt au lieu de mesurer.
//   6ᵉ occurrence de ce piège dans ce dépôt — il est écrit deux fois plus
//   haut dans CE fichier, et je l'ai quand même repayé.
// ═══════════════════════════════════════════════════════════════════════════
// 📊 LOT 202, POINT `z` — LE CIRCUIT COMPLET, EXÉCUTÉ SUR UN VRAI SERVEUR
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 POURQUOI CE § EXISTE ALORS QUE `test:tableau` EST DÉJÀ VERT.
//   `test:tableau` lit du TEXTE : il prouve que les lignes sont écrites, jamais
//   qu'elles s'exécutent. Il a d'ailleurs laissé passer une injection au premier
//   essai — un `if (false)` posé devant la pose du cookie, deux mots, et le
//   contrôle restait vert parce qu'il cherchait un NOM et non un USAGE.
//   ⇒ Ici on POSTE vraiment, on relit vraiment, et on compare deux états.
//
// 🔴🔴 ET IL MESURE LA CHAÎNE ENTIÈRE, c'est tout son intérêt :
//   formulaire → `/api/reglages` → `compteDeLaSession` (faux veveid) →
//   `prefs.mjs` (vraie base SQLite) → cookie → `/dashboard/` → HTML servi.
//   Un maillon coupé n'importe où et ce § rougit.
//
// ⭐⭐⭐ ON FORCE UN ÉTAT PUIS ON MESURE LE CHANGEMENT. Lire l'ordre des tuiles
//   sans l'avoir changé ne prouverait rien : c'est la correction du 25/08 sur
//   un instrument qui gardait un état entre deux mesures. Une BASCULE prouve
//   plus qu'une lecture.
console.log('\n📊 LOT 202 — l\'agencement du tableau de bord, de bout en bout');
{
  const SID = 'banc-tuiles';
  const { ACCES_RAPIDES: TB_CAT } = await import('../lib/tableau.mjs');
  const cookieDe = (rep) => (rep.headers.getSetCookie?.() || [])
    .map((c) => c.split(';')[0]);

  // ⭐ L'ORDRE DES TUILES SE LIT SUR LES ADRESSES, pas sur les libellés : une
  //   adresse ne dépend ni de la langue, ni du mode de marquage i18n. C'est la
  //   leçon du § précédent, payée par un déploiement rouge à l'étape 52/57.
  const ordreDe = (html) => [...html.matchAll(/<a class="module module--ouvert" href="([^"]+)"/g)]
    .map((m) => m[1]);

  const voirTableau = async (cookie) => {
    const rep = await fetch(`http://127.0.0.1:${PORT}/dashboard/`, { headers: { cookie } });
    return { statut: rep.status, ordre: ordreDe(await rep.text()) };
  };

  const avant = await voirTableau(`vp_session=${SID}`);
  verifie('`/dashboard/` se rend, et il rend des tuiles', avant.statut === 200 && avant.ordre.length >= 4,
    avant.statut === 200 ? `${avant.ordre.length} tuile(s) : ${avant.ordre.join(' ')}`
      : `🔴 statut ${avant.statut}`);

  // ⭐ LE FORMULAIRE EST LU SUR LA PAGE, PAS RECOPIÉ ICI. Recopier l'ordre
  //   attendu ferait de ce banc un miroir de mes suppositions ; le lire fait de
  //   lui un client du formulaire réel.
  const repCompte = await fetch(`http://127.0.0.1:${PORT}/compte/`, { headers: { cookie: `vp_session=${SID}` } });
  const pageCompte = await repCompte.text();
  const champ = pageCompte.match(/name="tb_ordre" value="([^"]*)"/);
  const cases = [...pageCompte.matchAll(/name="tb" value="([^"]+)"/g)].map((m) => m[1]);
  verifie('`/compte/` porte le formulaire d\'agencement, avec ses cases',
    !!champ && cases.length >= 4,
    champ ? `${cases.length} case(s) · ordre « ${champ[1]} »`
      : '🔴 champ `tb_ordre` absent — la route ne saurait rien recomposer');

  if (champ && cases.length >= 4 && avant.statut === 200) {
    // 🔑 UN SEUL GESTE, DEUX EFFETS À MESURER : on descend la première ligne
    //   (une flèche) ET on décoche la dernière (une case). Un formulaire qui
    //   n'enregistrerait que l'un des deux se verrait aussitôt.
    // 🔬🔴🔴 CE CHOIX A ÉTÉ FAUX UNE FOIS, ET LA LEÇON EST LA MÊME QUE LES SEPT
    //   PRÉCÉDENTES : j'avais pris la DERNIÈRE case du formulaire (`modules`).
    //   Elle est fermée au palier `member`, donc rendue en `<div>` et non en
    //   `<a class="module--ouvert">` — c'est-à-dire invisible à `ordreDe()`. La
    //   décocher ne changeait rien à ce que l'instrument compte, et le contrôle
    //   accusait le code. *Une injection qui ne mord pas accuse le jeu d'essai
    //   ou l'instrument, jamais le code* — 8ᵉ fois.
    //   ⇒ on décoche une ligne QUE L'INSTRUMENT VOIT, et on le prouve en
    //   partant de la liste qu'il vient lui-même de lire.
    const parHref = new Map(TB_CAT.map((x) => [x.href, x.cle]));
    const visibles = avant.ordre.map((h) => parHref.get(h)).filter(Boolean);
    const decochee = visibles[visibles.length - 1];
    verifie('le jeu d\'essai vise une tuile que l\'instrument VOIT',
      Boolean(decochee) && cases.includes(decochee),
      decochee ? `« ${decochee} » — ${visibles.length} tuile(s) ouverte(s) sur ${cases.length} cases`
        : '🔴 aucune case ouverte : les contrôles suivants seraient vrais pour rien');
    const corps = new URLSearchParams();
    corps.set('poste', '1');
    corps.set('bloc', 'tableau');
    corps.set('tb_ordre', champ[1]);
    for (const c of cases) if (c !== decochee) corps.append('tb', c);
    corps.set('bas', cases[0]);

    // ═════════════════════════════════════════════════════════════════════
    // 🔑🔑🔑 DÉCOUVERTE DU 26/08, ET ELLE VALAIT LE DÉTOUR : sans en-tête
    //    `Origin`, ce POST rend **403**. C'est le contrôle d'origine d'Astro,
    //    et le lot 160-A avait écrit noir sur blanc qu'il était « une chose que
    //    je ne peux pas éprouver ici ». On peut : il suffit d'un vrai serveur.
    //    ⭐ On en fait donc un contrôle À PART ENTIÈRE plutôt qu'un obstacle à
    //    contourner — c'est la seule mesure du dépôt qui prouve qu'une route
    //    d'écriture refuse un POST venu d'ailleurs.
    //    ⛔ Et c'est la raison pour laquelle `checkOrigin: false` reste interdit
    //    (derrière Cloudflare, `$scheme` ment) : ce § montre ce qu'on perdrait.
    const horsSite = await fetch(`http://127.0.0.1:${PORT}/api/reglages`, {
      method: 'POST', redirect: 'manual',
      headers: {
        cookie: `vp_session=${SID}`,
        origin: 'https://exemple-mechant.test',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: corps.toString(),
    });
    verifie('🔑 un POST venu d\'un AUTRE site est refusé (contrôle d\'origine)',
      horsSite.status === 403,
      horsSite.status === 403 ? '403 — la route n\'écrit rien pour un tiers'
        : `🔴 statut ${horsSite.status} : n'importe quelle page pourrait ranger un agencement`);

    const post = await fetch(`http://127.0.0.1:${PORT}/api/reglages`, {
      method: 'POST', redirect: 'manual',
      headers: {
        cookie: `vp_session=${SID}`,
        origin: `http://127.0.0.1:${PORT}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: corps.toString(),
    });
    const ou = post.headers.get('location') || '';
    verifie('le POST est accepté et renvoie sur l\'ancre du bloc',
      post.status === 303 && /m=tbok/.test(ou) && /#tableau/.test(ou),
      post.status === 303 ? ou : `🔴 statut ${post.status} — ${ou || 'sans destination'}`);

    const pose = cookieDe(post).find((c) => c.startsWith('vp_tb='));
    verifie('🔑 la route repose le COOKIE dans la même réponse',
      !!pose,
      pose ? pose.slice(0, 70)
        : '🔴 aucun `vp_tb` — le réglage serait exact en base et sans effet jusqu\'au prochain login,\n'
          + '       c\'est-à-dire indiscernable d\'un enregistrement qui a raté');

    if (pose) {
      const apres = await voirTableau(`vp_session=${SID}; ${pose}`);
      verifie('la case décochée a QUITTÉ le tableau de bord',
        apres.ordre.length === avant.ordre.length - 1,
        `${avant.ordre.length} → ${apres.ordre.length} tuile(s) (« ${decochee} » retiré)`);
      verifie('…et l\'ordre a bougé, exactement d\'un cran',
        apres.ordre.join(' ') !== avant.ordre.join(' ')
          && apres.ordre[0] === avant.ordre[1],
        `avant ${avant.ordre.slice(0, 3).join(' ')} … · après ${apres.ordre.slice(0, 3).join(' ')} …`);

      // ⭐⭐ LA CONTRE-ÉPREUVE, ET ELLE EST OBLIGATOIRE : sans le cookie, la
      //   même requête doit rendre l'ordre d'AVANT. Sans elle, un tableau de
      //   bord qui aurait changé pour une tout autre raison passerait pour une
      //   preuve — et l'instrument aurait mesuré son propre bruit.
      const sansCookie = await voirTableau(`vp_session=${SID}`);
      verifie('🔑 sans le cookie, le tableau de bord retombe sur l\'ordre par défaut',
        sansCookie.ordre.join(' ') === avant.ordre.join(' '),
        sansCookie.ordre.join(' ') === avant.ordre.join(' ')
          ? 'c\'est bien le cookie qui a agi, et rien d\'autre'
          : `🔴 « ${sansCookie.ordre.join(' ')} » — le changement ne venait pas de lui`);

      // ⭐⭐⭐ ET LA BASE, QUI EST LA VÉRITÉ. `/compte/` ne lit PAS le cookie :
      //   il relit la préférence rangée. Si ce contrôle passe, l'écriture a
      //   vraiment traversé veveid, `prefs.mjs` et SQLite — le cookie seul
      //   aurait pu tout expliquer sans qu'une ligne soit rangée nulle part.
      const relu = await (await fetch(`http://127.0.0.1:${PORT}/compte/`,
        { headers: { cookie: `vp_session=${SID}` } })).text();
      const champ2 = relu.match(/name="tb_ordre" value="([^"]*)"/);
      verifie('🔑🔑 la BASE a été écrite : `/compte/` relit le nouvel agencement',
        !!champ2 && champ2[1] !== champ[1] && champ2[1].includes(`-${decochee}`),
        champ2 ? `« ${champ[1]} » → « ${champ2[1]} »`
          : '🔴 le formulaire ne se relit plus');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 📣 LOT 203, POINT `o` — LA PAGE D'ACCÈS NE DOIT PLUS GRAVER SON CHIFFRE
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE QU'AUCUN BANC NE VOYAIT : la page promettait « 1 200 fiches » pendant
//   que le site en publiait 8 840. Un chiffre faux d'un facteur sept, sur le
//   premier argument de vente, et VERT partout — parce qu'un chiffre gravé est
//   du texte, et que du texte ne casse rien.
//   ⇒ Ce § confronte ce que la page SERT à ce que le build a COMPTÉ. C'est la
//   seule confrontation qui puisse attraper ce genre de mensonge.
// ⭐ Et il vit ici, pas dans un banc de source, parce que `/connexion/` est
//   rendue À LA DEMANDE : elle n'est pas dans `dist/`, aucun banc de fichiers
//   ne peut la lire.
console.log('\n📣 LOT 203 — la page d\'accès dit-elle un chiffre VRAI ?');
{
  const rep = await fetch(`http://127.0.0.1:${PORT}/connexion/`);
  const page = await rep.text();
  verifie('`/connexion/` se rend sans session', rep.status === 200,
    rep.status === 200 ? `${Buffer.byteLength(page)} o` : `🔴 statut ${rep.status}`);

  // 🔬🔴 LA ZONE S'ARRÊTE À SON `</ul>`, ET CE N'EST PAS UN DÉTAIL. Écrite
  //   d'abord en « 2 500 caractères après le repère », elle attrapait 17 lignes
  //   au lieu de 6 — les entrées du PIED DE PAGE. Le contrôle « il y a des
  //   lignes » serait alors resté vert si le panneau entier disparaissait, et
  //   le contrôle du nombre aurait pu le trouver n'importe où sur la page.
  //   *Un instrument qui regarde trop large mesure autre chose que son sujet.*
  const i = page.indexOf('inscr__liste');
  const fin = i < 0 ? -1 : page.indexOf('</ul>', i);
  const zone = i < 0 || fin < 0 ? '' : page.slice(i, fin);
  const lignes = [...zone.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
    .map((m) => m[1].replace(/<[^>]*>/g, '')
      // ⚠️ Les trois sentinelles du marquage s'écrivent en ÉCHAPPEMENT, jamais
      //    en clair : ce sont des caractères de contrôle, invisibles dans un
      //    éditeur et perdus à la première copie qui les normalise.
      .replace(/[]/g, ' ').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim());
  verifie('le panneau « ce que le compte ouvre » est servi, et il a des lignes',
    lignes.length >= 4, `${lignes.length} ligne(s)`);

  if (lignes.length >= 4) {
    // ⭐⭐⭐ LA CONFRONTATION. On ne demande pas « y a-t-il un nombre » : on
    //   exige QUE CE SOIT CELUI-LÀ. Un banc qui accepterait n'importe quel
    //   nombre aurait laissé passer « 1 200 » pendant huit mois.
    const { MARCHE_FICHIER } = await import('../lib/cote.mjs');
    const attendu = JSON.parse(readFileSync(MARCHE_FICHIER, 'utf8'))?.resume?.publies ?? null;
    const chiffres = lignes.join(' ').match(/\d[\d  ., ]*\d|\d/g) || [];
    const vus = chiffres.map((x) => Number(x.replace(/[^\d]/g, ''))).filter((n) => n > 0);
    verifie('🔑 le nombre annoncé est EXACTEMENT celui que le build a compté',
      attendu !== null && vus.includes(attendu),
      attendu === null ? '⏸️ pas de résumé dans la projection'
        : vus.includes(attendu) ? `${attendu} annoncé et publié`
          : `🔴 la page dit ${vus.join(', ') || 'aucun nombre'} · le build a compté ${attendu}`);

    // ⚠️ ET LE TEXTE, PAS LA CLÉ. C'est la leçon du 25/08, payée en production :
    //    un banc qui cherche `signup.o1` ne voit jamais « The site's {n} records »
    //    servi tel quel à un visiteur.
    const reste = lignes.join(' ').match(/\$\{|\{\w+\}|\$\d/);
    verifie('…et aucune ligne ne porte de gabarit non substitué',
      !reste, reste ? `🔴 motif ${reste[0]} dans « ${lignes.join(' | ').slice(0, 110)} »`
        : `${lignes.length} ligne(s) propres`);

    // ⭐⭐ LA SOURCE, ET C'EST LE CONTRÔLE QUI EMPÊCHE LA RÉGRESSION.
    //   Le § ci-dessus attrape un chiffre faux ; celui-ci interdit d'en graver
    //   un nouveau. ⛔ Sans lui, il suffirait de réécrire « 8 840 » en dur pour
    //   que tout redevienne vert — jusqu'au prochain drop.
    const DICOS = join(R_I18N, 'engine', 'i18n');
    const graves = [];
    for (const f of readdirSync(DICOS).filter((x) => x.endsWith('.json'))) {
      const d = JSON.parse(readFileSync(join(DICOS, f), 'utf8'));
      const v = String(d['signup.o1'] ?? '');
      if (!v.includes('{n}')) graves.push(`${f} (« ${v.slice(0, 40)} »)`);
      if (/\d/.test(v.replace('{n}', ''))) graves.push(`${f} : chiffre en dur`);
      // 🔬🔴 CE CONTRÔLE-CI A ÉTÉ AJOUTÉ APRÈS UNE INJECTION QUI N'AVAIT PAS
      //   MORDU : `${n}` CONTIENT `{n}`, donc le contrôle du dessus le laissait
      //   passer — et `t()` substitue `{n}`, JAMAIS `${n}`. La page aurait
      //   servi « Les ${n} fiches » en toutes lettres.
      //   ⭐ C'est mot pour mot la faute du 25/08 (« ends in $3 days »), et
      //   elle vient toujours du même endroit : `caisse.perMonth` écrit
      //   « ${v} / month » où le dollar est le SYMBOLE MONÉTAIRE, pas une
      //   syntaxe. Le motif se recopie, la prémisse ne se recopie pas.
      if (v.includes('${')) graves.push(`${f} : un dollar devant le trou`);
    }
    verifie('🔑 `signup.o1` porte un TROU, jamais un chiffre, dans chaque langue',
      graves.length === 0,
      graves.length ? `🔴 ${graves.join(' · ')}\n`
        + '       ⇒ un chiffre gravé se périme au prochain drop, en silence'
        : 'les cinq dictionnaires attendent leur nombre du build');
  }
}


arreter();

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

// 🧩🔴🔴🔴 LOT I ④ — LA DESCRIPTION PART **AVANT** LE PILOTE, ET CE BANC DOIT
// REJOUER L'ORDRE DU DOCUMENT. `batirTuiles()` ne décrit plus la tuile : elle
// lit `window.vpTuile`, que `src/socle/modules/tuile.js` pose. Ce fichier est
// un `<script defer src>` dans la page ; ici, il faut le jouer à la main.
// ⭐⭐⭐ CE BANC L'A DÉMONTRÉ TOUT SEUL : à la première exécution du lot I, sans
// cette ligne, la grille a été bâtie à **0 tuile sur 20** et le §3 a rougi.
// C'est le bon comportement des deux côtés — `batirTuiles()` refuse de bâtir
// une tuile approximative, et le banc le voit tout de suite.
// ⛔ NE PAS « RENDRE LE PILOTE AUTONOME » POUR FAIRE TAIRE CE ROUGE : ce serait
// la troisième fabrique qui renaîtrait, celle que le lot vient de supprimer.
// ⚠️ Même geste que `test:rayon` §7, qui a payé cette leçon au lot G.
const GABARIT_TUILE = join(ROOT, 'src', 'socle', 'modules', 'tuile.js');

// ═══════════════════════════════════════════════════════════════════════════
// 🔀🔴🔴🔴 LOT I ③ — LE TRANSPORT DU TRI EST FOURNI AU PILOTE, PAS DEVINÉ
// ═══════════════════════════════════════════════════════════════════════════
// Le pilote lit `fetch` et `DOMParser` SUR LE `window` QU'ON LUI PASSE. C'est
// ce qui rend le tri sans rechargement mesurable ici : on lui donne un
// transport de banc, et le vrai chemin — écouteur, requête, chirurgie,
// rebranchement — est celui qu'exerce la production.
// ⛔ S'il les avait lus dans la portée globale, TOUT ce bloc aurait été
//   inatteignable en banc, et vert pour la seule raison qu'il n'aurait jamais
//   été joué. C'est le piège de `window.location` du lot 201, à l'identique.
// ⚠️ ON N'INSTALLE PAS `window.location` : sans lui, le repli du pilote
//   (`window.location.href = url`) lève et est avalé par son `try`. C'est
//   voulu — un banc où le repli NAVIGUE ne mesurerait plus rien.
const { DOMParser: DOMParserBanc } = await import('linkedom');
window.DOMParser = DOMParserBanc;
const trafic = { url: null, reponse: null, ok: true, appels: 0 };
window.fetch = (u) => {
  trafic.url = String(u); trafic.appels += 1;
  return Promise.resolve({
    ok: trafic.ok, status: trafic.ok ? 200 : 503,
    text: () => Promise.resolve(trafic.reponse == null ? '' : trafic.reponse),
  });
};
const pousses = [];
window.history = { pushState: (_e, _t, u) => { pousses.push(String(u)); } };

let leve = '';
try {
  new Function('window', readFileSync(GABARIT_TUILE, 'utf8'))(window);
  new Function('document', 'window', 'localStorage', 'console', src)(document, window, undefined, { log() {}, warn() {}, error() {} });
}
catch (e) { leve = e.message; }
verifie('le pilote de la barre s\'exécute sans lever', !leve, leve || 'aucune exception');
if (leve) fin(1);
// 🔑 LE TÉMOIN : sans lui, une `tuile.js` qui n'exposerait plus rien ferait
// rougir le §3 sans dire POURQUOI — « 0 tuile » a deux causes très
// différentes (la description absente, ou la construction cassée).
// 🔴🔴🔴 ET LA PAGE DOIT LE CHARGER, ELLE AUSSI — L'ANGLE MORT DE CE BANC.
// Ci-dessus, le banc joue `tuile.js` À LA MAIN : il serait donc VERT même si la
// page servie ne le chargeait plus. C'est exactement la panne du lot 226 —
// *un fichier déposé n'est pas un fichier branché* — et elle coûterait ici une
// vue Tuiles vide en production, sans une erreur nulle part.
// ⭐ On mesure donc la PAGE, pas le banc : un `<script src>` dont l'adresse
//   porte le nom du module. `moduleJs()` y met une empreinte, d'où le motif.
// 🧰🔴🔴 ET LE MOTIF S'EST TROMPÉ D'ABORD : `moduleJs()` sert
//   `/socle-<empreinte>.js` — LE NOM DU MODULE N'EST PAS DANS L'ADRESSE. Un
//   motif qui cherchait « tuile » dans le `src` rougissait sur une page juste.
//   ⭐⭐ On refait donc le calcul du serveur : sha256 du fichier, 12 signes. Ce
//   qui rend le contrôle plus fort que prévu — il ne dit plus seulement « un
//   script est chargé », il dit « c'est EXACTEMENT le fichier du dépôt ».
{
  const { createHash } = await import('node:crypto');
  const empreinte = createHash('sha256')
    .update(readFileSync(GABARIT_TUILE, 'utf8')).digest('hex').slice(0, 12);
  const charge = html.includes(`src="/socle-${empreinte}.js"`);
  verifie('⛔ la page servie CHARGE CE `tuile.js`-ci (le banc, lui, le joue à la main)',
    charge, charge ? `<script src="/socle-${empreinte}.js"> — l'empreinte du fichier du dépôt`
      : `🔴 aucun \`<script src="/socle-${empreinte}.js">\` : la grille serait VIDE en production, et ce banc ne le verrait pas`);
}
verifie('⛔ la description partagée est bien posée (`window.vpTuile`)',
  !!(window.vpTuile && window.vpTuile.decrire && window.vpTuile.monter),
  window.vpTuile ? 'decrire + monter exposés' : '🔴 `tuile.js` n\'expose pas `vpTuile` — la grille resterait vide');

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
    // ═══════════════════════════════════════════════════════════════════════
    // 🔴🔴 LOT 220 — « AUCUNE CELLULE » N'EST PLUS UN ÉCHEC, C'EST UN VERDICT.
    // ═══════════════════════════════════════════════════════════════════════
    // Ce contrôle exigeait `cells.length > 0`, et il avait raison de le faire :
    // sans cellule, il serait passé au vert en n'ayant rien comparé — la
    // contre-épreuve du banc, pas un détail.
    // ⭐⭐⭐ MAIS SA CONDITION A DISPARU POUR UNE BONNE RAISON. Le lot 220 a
    // rempli les deux dernières colonnes « en attente » du tableau (le plancher
    // StackR et l'OMI/MCP, annoncés « à faire » depuis août). Il n'y a donc plus
    // de cellule en attente à surveiller — et rougir là-dessus ferait échouer un
    // banc parce que le site s'est amélioré.
    // ⇒ **SANS OBJET**, imprimé en toutes lettres. C'est le 4ᵉ verdict de la
    // maison (conforme · écart · indécidable · sans objet), et c'est exactement
    // la forme que `test_fuite_prix.mjs` §6 emploie pour son panneau de seuil.
    // ⛔ ET LE CONTRÔLE NE DEVIENT PAS INOFFENSIF : dès qu'une cellule en attente
    // réapparaît — une colonne neuve, une source qui retombe en panne — elle doit
    // porter le libellé, et `nus.length` la fait rougir. Le banc dort ; il n'est
    // pas désarmé.
    if (cells.length === 0) {
      console.log('  ..  ② aucune cellule en attente dans le tableau — SANS OBJET.'
        + ' Le lot 220 a rempli le plancher StackR et l\'OMI/MCP ; il ne reste rien à'
        + ' étiqueter. ⚠️ ANORMAL si une colonne vient d\'être ajoutée sans donnée.');
    } else
    verifie('② le pilote le repose sur CHAQUE cellule en attente', nus.length === 0,
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

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 155-C ③ — CE QUE LA TUILE DOIT PORTER, ET OÙ
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ ON MESURE LA **CAUSE**, PAS L'EFFET. Preda a rapporté « les tuiles
// n'ont pas la même hauteur » — une propriété de MISE EN PAGE, que linkedom ne
// calcule pas et ne calculera jamais. Un banc qui prétendrait mesurer une
// hauteur ici serait vert par construction : il n'aurait rien regardé.
// → `regle-linkedom-ne-construit-pas-larbre`
// ⇒ Ce qui se mesure, c'est la cause exacte relevée le 18/08 : la pastille de
//   rareté vivait DANS `.tuile__n`, un bloc plafonné à deux lignes qu'elle
//   débordait, et la série vivait dans le bandeau en overlay où elle écrasait
//   le compteur d'offres. Deux questions de STRUCTURE, décidables ici.
console.log('\n5. la tuile porte-t-elle ses morceaux là où ils tiennent ?');
{
  const t = document.querySelector('#vue-tui .tuile');
  if (!t) {
    indecis('la structure de la tuile', 'aucune tuile bâtie — le §3 a déjà rougi là-dessus');
  } else {
    const titre = t.querySelector('.tuile__n');
    const hd = t.querySelector('.tuile__hd');
    const bas = t.querySelector('.tuile__b');

    // ⛔ LA PANNE DU 18/08, NOMMÉE. Une pastille `inline-flex` dans un bloc
    //    `-webkit-line-clamp:2` passe à la 3ᵉ ligne dès que le titre remplit
    //    les deux premières — et la tuile grandit avec elle.
    verifie('⛔ le bloc du titre ne contient QUE du texte (aucune pastille à déborder)',
      !!titre && titre.children.length === 0,
      !titre ? '🔴 pas de .tuile__n'
        : titre.children.length === 0 ? `« ${(titre.textContent || '').trim().slice(0, 40)} », 0 enfant`
        : `🔴 ${titre.children.length} enfant(s) : ${[...titre.children].map((c) => c.className || c.tagName).join(', ')}`
          + ' — un titre de deux lignes les pousse à la troisième, et la grille perd son alignement');

    verifie('la rareté est montée dans le bandeau (.tuile__rar), la place de la maquette',
      !!hd && !!hd.querySelector('.tuile__rar .rar'),
      hd && hd.querySelector('.tuile__rar .rar') ? 'forme + libellé, clonés de la ligne'
        : '🔴 absente du bandeau — elle est restée dans le titre, ou elle a disparu');

    // ⭐ La série a QUITTÉ le bandeau : en `nowrap`, elle y prenait la largeur
    //   du compteur d'offres, qui se cassait alors sur deux lignes.
    verifie('…et la série est descendue SOUS le titre, pas dans le bandeau',
      !!bas && !!bas.querySelector('.tuile__s') && !(hd && hd.querySelector('.tuile__s')),
      bas && bas.querySelector('.tuile__s') && !hd.querySelector('.tuile__s')
        ? `« ${(bas.querySelector('.tuile__s').textContent || '').trim().slice(0, 40)} »`
        : '🔴 .tuile__s est encore dans .tuile__hd — « N Offres » se cassera en deux');

    // ═══════════════════════════════════════════════════════════════════════
    // 📏 LOT 203, POINT `ag` — « qu'on voie le nom complet dans une infobulle »
    // ═══════════════════════════════════════════════════════════════════════
    // ⭐⭐ MESURÉ SUR LA TUILE BÂTIE, PAS SUR LA LIGNE SOURCE, et c'est tout
    //   l'intérêt : le pilote recopie le TEXTE depuis `.tbl-obj__s`. Rien ne
    //   l'obligeait à recopier l'attribut — il aurait donc laissé l'infobulle
    //   dans le tableau, où la place est large, et l'aurait retirée de la
    //   tuile, qui est deux fois plus étroite. Un contrôle de source n'aurait
    //   rien vu : les deux lignes du gabarit sont justes séparément.
    const tS = bas && bas.querySelector('.tuile__s');
    const tN = t.querySelector('.tuile__n');
    verifie('…et son infobulle a suivi jusqu\'à la tuile (point `ag`)',
      !!tS && (tS.getAttribute('title') || '').length > 0,
      tS && tS.getAttribute('title')
        ? `title = « ${tS.getAttribute('title').slice(0, 46)} »`
        : '🔴 la tuile coupe le texte et n\'offre aucun moyen de le lire en entier');
    verifie('…et le titre de la pièce aussi',
      !!tN && (tN.getAttribute('title') || '').length > 0,
      tN && tN.getAttribute('title') ? 'les deux lignes coupées sont lisibles au survol'
        : '🔴 `.tuile__n` est bornée à deux lignes et ne dit pas ce qu\'elle cache');
    // ⭐⭐⭐ ET L'INFOBULLE DOIT EN DIRE PLUS QUE CE QUI EST DÉJÀ VISIBLE.
    //   Un `title` recopié du texte affiché est une infobulle qui s'ouvre pour
    //   ne rien apprendre — elle a l'air de marcher, et elle ne sert à rien.
    //   ⚠️ On compare au texte de la LIGNE SOURCE, seul endroit où le texte est
    //   entier : celui de la tuile est déjà coupé par le CSS, que `linkedom` ne
    //   calcule pas. *On ne mesure pas une coupe visuelle dans un DOM sans
    //   moteur de rendu — on mesure ce qui la rend RÉPARABLE.*
    if (tS && tS.getAttribute('title')) {
      const src = document.querySelector('.tbl-obj__s');
      verifie('…et ce `title` porte bien le texte ENTIER de la source',
        !!src && tS.getAttribute('title') === (src.getAttribute('title') || ''),
        src ? 'la tuile dit exactement ce que la ligne sait'
          : '⏸️ pas de ligne source à comparer');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LES MONTANTS DE LA TUILE VIENNENT DE LA LIGNE, ET DE NULLE PART AILLEURS
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ L'ANCRE EST INDÉPENDANTE, ET C'EST TOUT L'INTÉRÊT : on ne compare pas
// la tuile à elle-même, on la compare à LA CELLULE DU TABLEAU. Un banc qui
// vérifierait seulement « le bandeau existe » resterait vert le jour où
// quelqu'un le remplirait depuis `ILE_TUILES` — c'est-à-dire le jour où le lot
// 127 serait défait. → `regle-controle-qui-interroge-sa-propre-source`
console.log('\n6. les montants de la tuile sont-ils CLONÉS de la ligne ?');
{
  const t = document.querySelector('#vue-tui .tuile');
  const l = lignesDom[0];
  if (!t || !l) {
    indecis('les montants clonés', 'ni tuile ni ligne à comparer');
  } else {
    // ⛔ CONTRE-ÉPREUVE D'ABORD : sans cellule ATL/ATH dans le tableau, ce
    //    contrôle n'a pas de sujet. Le dire, plutôt que rendre un vert vide —
    //    c'est le corpus qui décide, jamais ce que la page a rendu.
    const cAtl = l.querySelector('[data-ext="atl"] .num');
    const cAth = l.querySelector('[data-ext="ath"] .num');
    if (!cAtl && !cAth) {
      indecis('le bandeau ATL/ATH de la tuile',
        'la ligne ne porte aucune cellule [data-ext] — colonnes retirées du gabarit ?');
    } else {
      const ext = t.querySelector('.socle__ext');
      verifie('⛔ la tuile porte le bandeau des extrêmes, sur le SOCLE',
        !!ext && !!t.querySelector('.socle .socle__ext'),
        ext ? 'socle__ext posé sur la couverture'
          : '🔴 absent — ATL/ATH ne se voient qu\'en vue Tableau');
      if (ext) {
        const lu = (sel) => {
          const e = ext.querySelector(sel);
          return e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : null;
        };
        const cell = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : null);
        for (const [sel, src, nom] of [['.b', cAtl, 'ATL'], ['.h', cAth, 'ATH']]) {
          if (!src) continue;
          const attendu = cell(src);
          const vu = lu(sel);
          // 🔴🔴🔴 LE TERME À ZÉRO DOIT ÊTRE ATTEIGNABLE, ET ICI IL NE L'EST
          // PAS TOUJOURS. Première version : `vu.indexOf(attendu) !== -1`,
          // rendu VERT hors ligne — en comparant « — » à « — ». Un clone
          // branché sur la mauvaise cellule aurait passé ce contrôle sans
          // broncher, parce que TOUTES les cellules disent « — ».
          // ⚠️ Et le corpus hors réseau ne peut PAS porter de montant : ses
          // uuid sont des `sample-…`, que la liste blanche de `lireCotes()`
          // refuse tous. Ce n'est donc pas un manque à combler, c'est une
          // propriété du corpus — elle se DIT, elle ne se contourne pas.
          // ⇒ Trois verdicts. En ligne (Dockerfile, production) les montants
          //   existent et l'écart y est un vrai écart.
          // → `regle-terme-a-zero-doit-etre-atteignable`
          if (!attendu || !/[0-9]/.test(attendu)) {
            indecis(`le ${nom} cloné de la tuile`,
              `la cellule ne porte aucun chiffre (« ${attendu || '(vide)'} ») — sans cote `
              + 'réelle, ce contrôle comparerait deux tirets et serait vert quoi qu\'il arrive');
            continue;
          }
          verifie(`…et son ${nom} vaut EXACTEMENT celui de la cellule`,
            !!vu && vu.indexOf(attendu) !== -1,
            vu && vu.indexOf(attendu) !== -1 ? `« ${attendu} »`
              : `🔴 tuile « ${vu} » ≠ ligne « ${attendu} » — le montant a une seconde source`);
        }
        verifie('⛔ le bandeau porte `data-col` sur ses deux moitiés',
          [...ext.children].every((c) => c.hasAttribute('data-col')) && ext.children.length > 0,
          ext.children.length
            ? [...ext.children].map((c) => c.getAttribute('data-col')).join(' · ')
            : '🔴 bandeau vide — `.every()` sur du vide est VRAI, on compte donc les enfants');
      }
    }

    // 🔴🔴 L'AVERTISSEMENT DE PRIX ABERRANT. Mesuré en production le 18/08 :
    //   « Faces of The ADDICTION », 42 420 420 420 420 gems sur UNE offre,
    //   affiché NU en vue Tuiles — le tableau posait son « ! », le clone ne
    //   visait que `.num`, et `.alerte` est son frère.
    // ⚠️ Conditionné au CORPUS : si aucune ligne servie n'a de prix aberrant,
    //   ce contrôle est SANS OBJET, et il le dit.
    const ligneAlerte = lignesDom.find((x) => x.querySelector('[data-prix] .alerte'));
    if (!ligneAlerte) {
      console.log('  ⏸️  sans objet — aucune des lignes servies ne porte d\'alerte de prix');
    } else {
      const k = lignesDom.indexOf(ligneAlerte);
      const tuile = document.querySelectorAll('#vue-tui .tuile')[k];
      verifie('⛔ l\'alerte « prix aberrant » suit le prix jusqu\'à la tuile',
        !!tuile && !!tuile.querySelector('.tuile__p .alerte'),
        tuile && tuile.querySelector('.tuile__p .alerte')
          ? `ligne ${k} : le « ! » est cloné avec le montant`
          : `🔴 ligne ${k} porte l'alerte, sa tuile NON — un prix manifestement faux `
            + 's\'affiche sans sa marque sur la vue par défaut');
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. « voir plus » emporte-t-il la VUE et les COLONNES ? (lot 201)');
// ═══════════════════════════════════════════════════════════════════════════
// 🐛 LE DÉFAUT §M-209, ET POURQUOI IL SE MESURE **ICI** ET NULLE PART AILLEURS.
// La vue et les colonnes sont de l'affichage pur : elles ne soumettent rien,
// elles écrivent dans des champs cachés et attendent le prochain filtre. Le
// « voir plus », lui, est un `<a href>` calculé PAR LE SERVEUR. Les deux ne se
// parlaient pas ⇒ basculer en tuiles puis cliquer « voir plus » revenait au
// tableau, toutes colonnes revenues.
// ⛔ UN BANC DE SOURCE N'AURAIT RIEN PROUVÉ. Chercher `majPlus` dans le texte
//    du fichier dit qu'un nom existe, pas qu'un clic répare un lien — et ce
//    dépôt a déjà trouvé cinq fois la chaîne qu'il cherchait dans un
//    commentaire, dont une fois dans celui qui DÉSACTIVAIT la ligne.
// ⭐⭐⭐ Ce §  vit donc après l'exécution du pilote : on CLIQUE, et on relit
//    l'adresse du lien. C'est le geste de l'utilisateur, pas sa description.
{
  const plus = document.getElementById('plus');
  if (!plus) {
    // ⭐ SANS OBJET, pas indécidable : le bouton n'existe que s'il RESTE des
    //   lignes à montrer. La condition est tranchée, elle vaut non.
    indecis('« voir plus »', 'le lien n\'est pas rendu : tout le corpus tient dans la première tranche');
  } else {
    const bTui = document.querySelector('.v-b[data-vue="tui"]');
    const bTbl = document.querySelector('.v-b[data-vue="tbl"]');
    const cases = [...document.querySelectorAll('input[name="f-col"]')];

    verifie('les deux boutons de vue et les cases « colonnes » existent',
      !!bTui && !!bTbl && cases.length > 0,
      bTui && bTbl && cases.length ? `${cases.length} colonne(s) commutable(s)` : '🔴 repères absents');

    if (bTui && bTbl && cases.length) {
      // 🔴🔴🔴 LA CONTRE-ÉPREUVE EST UNE **BASCULE**, PAS UNE LECTURE DE DÉPART.
      //   Première version : « l'adresse ne porte pas encore `f-vue=tui` ».
      //   Elle a rougi sur du code juste — parce que le §3 de CE MÊME FICHIER
      //   exécute le pilote et construit les tuiles AVANT d'arriver ici : le
      //   DOM lui était déjà passé entre les mains, la vue valait `tui`, et
      //   mon « départ » n'était pas un départ.
      //   ⭐⭐⭐ *Mon instrument garde-t-il un état entre deux mesures ?* — oui,
      //   et un banc qui l'ignore mesure le § d'avant.
      //   ⇒ On force donc l'état, puis on mesure le CHANGEMENT. C'est plus
      //   fort qu'une lecture : ça prouve que le lien SUIT la vue dans les
      //   deux sens, pas qu'il contient une chaîne par hasard.
      bTbl.dispatchEvent(new window.Event('click', { bubbles: true }));
      const enTbl = plus.getAttribute('href') || '';
      verifie('⛔ ramené en vue Tableau, le lien dit « tableau » (il y a de quoi mesurer)',
        /[?&]f-vue=tbl(&|$)/.test(enTbl),
        /[?&]f-vue=tbl(&|$)/.test(enTbl) ? enTbl
          : `🔴 ${enTbl} — le lien ne suit pas la vue : le contrôle suivant ne prouverait rien`);

      bTui.dispatchEvent(new window.Event('click', { bubbles: true }));
      const apresVue = plus.getAttribute('href') || '';
      verifie('après un clic sur « Tuiles », « voir plus » emporte la vue',
        /[?&]f-vue=tui(&|$)/.test(apresVue),
        /[?&]f-vue=tui(&|$)/.test(apresVue) ? apresVue
          : `🔴 ${apresVue} — le clic ramènerait au TABLEAU (défaut §M-209)`);

      // ⚠️ `:checked` SUIT L'ATTRIBUT dans linkedom (correctif déjà porté par
      //    `monterDOM`) : on retire donc l'ATTRIBUT, pas seulement la
      //    propriété — sinon le pilote relirait une case encore cochée et le
      //    contrôle serait vert pour la mauvaise raison.
      // 🔴🔴 LOT H — CE BANC COMPTAIT `cases.length - 1`, ET IL AVAIT RAISON
      // TANT QUE TOUTES LES CASES ÉTAIENT COCHÉES AU DÉPART. Depuis ce lot,
      // deux colonnes (`ten`, `c7`) sont DÉCOCHÉES par défaut : la soustraction
      // attendait 8 et l'URL en portait 6 — le banc rougissait sur un site qui
      // marche.
      // ⭐⭐ ON NE L'ASSOUPLIT PAS, ON LUI APPREND CE QU'IL MESURE VRAIMENT :
      // « l'URL emporte EXACTEMENT les cases cochées ». Cette formulation-là est
      // vraie quel que soit le défaut, donc elle ne se périmera pas au prochain
      // arbitrage — et elle mord toujours, puisqu'elle compare deux ensembles
      // et pas deux nombres écrits d'avance.
      // ⭐⭐⭐ *Un banc qui code le défaut du jour dans son arithmétique juge le
      // défaut, pas le mécanisme.*
      const cocheesAvant = cases.filter((c) => c.hasAttribute('checked')).map((c) => c.value);
      const victime = cases.find((c) => c.hasAttribute('checked')) || cases[0];
      victime.removeAttribute('checked');
      victime.checked = false;
      victime.dispatchEvent(new window.Event('change', { bubbles: true }));
      const apresCols = plus.getAttribute('href') || '';
      const emportees = [...apresCols.matchAll(/[?&]f-col=([^&#]*)/g)].map((m) => m[1]);

      verifie('…et il emporte la liste EXPLICITE des colonnes (`f-cx=1`)',
        /[?&]f-cx=1(&|$)/.test(apresCols),
        /[?&]f-cx=1(&|$)/.test(apresCols) ? apresCols
          : '🔴 sans ce témoin, tout décocher est indiscernable d\'une première visite');
      const attendues = cocheesAvant.filter((v) => v !== victime.value);
      const memeEnsemble = attendues.length === emportees.length
        && attendues.every((v) => emportees.includes(v));
      verifie('…et l\'URL emporte EXACTEMENT les cases cochées, décochée retirée',
        !emportees.includes(victime.value) && memeEnsemble,
        !emportees.includes(victime.value) && memeEnsemble
          ? `${emportees.length} colonne(s) emportée(s) sur ${cases.length} commutables, « ${victime.value} » retirée`
          : (emportees.includes(victime.value)
            ? `🔴 « ${victime.value} » voyage encore : la tranche suivante la ferait revenir`
            : `🔴 attendu [${attendues.join(' ')}], emporté [${emportees.join(' ')}]`));
      verifie('…et la vue n\'a pas été perdue en chemin',
        /[?&]f-vue=tui(&|$)/.test(apresCols),
        /[?&]f-vue=tui(&|$)/.test(apresCols) ? 'vue et colonnes voyagent ensemble'
          : '🔴 le second geste a écrasé le premier');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧩 §5 bis — LOT I ④ : CE QUE LA DESCRIPTION PARTAGÉE DOIT ENCORE PRODUIRE
// ═══════════════════════════════════════════════════════════════════════════
// `batirTuiles()` ne décrit plus la tuile : elle passe des valeurs à
// `tuile.js`. Le §5 garde la STRUCTURE (où vivent le titre, la rareté, la
// série) ; il ne dit rien des quatre morceaux qui n'appartiennent qu'au
// Marché — le compteur d'offres, la classe d'apparition, le rang `--i`, et la
// cartouche de prix à TROIS enfants directs.
// ⭐⭐⭐ ET C'EST EXACTEMENT LÀ QUE LE PORTAGE POUVAIT ÉCHOUER SANS BRUIT : la
// tuile aurait gardé sa forme générale et perdu un détail que personne ne
// regarde en banc. *Un remaniement « sans effet visible » a besoin d'un banc
// qui regarde ce que l'œil ne regarde plus.*
console.log('\n5 bis. la tuile porte-t-elle ce que le Marché SEUL lui donne ? (lot I ④)');
{
  const t = document.querySelector('#vue-tui .tuile');
  const l = [...document.querySelectorAll('#vue-tbl tbody tr')][0];
  // ⭐ L'ÎLE EST LA SOURCE DE DEUX VALEURS QUE LA LIGNE N'A PAS : le libellé
  //   « Listings » et le pourcentage AFFICHÉ. On la lit ici pour comparer la
  //   tuile à sa source, et non à une chaîne écrite dans ce banc — qui serait
  //   fausse à la première page servie dans une autre langue.
  let ileBanc = null;
  try { ileBanc = JSON.parse(document.getElementById('tui-src').textContent); } catch { ileBanc = null; }
  if (!t || !l || !ileBanc) {
    indecis('les morceaux propres au Marché', 'aucune tuile, aucune ligne, ou pas d\'île');
  } else {
    // ① LA CLASSE D'APPARITION ET LE RANG
    verifie('⛔ la boîte garde `tuile revele` et son rang `--i`',
      /(^|\s)tuile(\s|$)/.test(t.className) && /(^|\s)revele(\s|$)/.test(t.className)
        && /--i:\s*0/.test(t.getAttribute('style') || ''),
      `class="${t.className}" style="${t.getAttribute('style') || ''}"`
        + ((/(^|\s)revele(\s|$)/.test(t.className) && /--i:/.test(t.getAttribute('style') || ''))
          ? '' : ' 🔴 sans `revele` les tuiles n\'apparaissent plus, sans `--i` elles apparaissent toutes ensemble'));

    // ② LE COMPTEUR D'OFFRES — et sa valeur, pas seulement sa présence
    const off = t.querySelector('.tuile__hd .tuile__off');
    const attenduOff = ((l.dataset.lst || '0') + ' ' + (ileBanc && ileBanc.lst ? ileBanc.lst : '')).trim();
    verifie('le compteur d\'offres est dans le bandeau, et il dit ce que la ligne dit',
      !!off && (off.textContent || '').trim() === attenduOff,
      off ? `« ${(off.textContent || '').trim()} » (attendu « ${attenduOff} »)`
        : '🔴 `.tuile__off` absent — la tuile ne dit plus combien d\'offres existent');

    // ③ LA CARTOUCHE : TROIS ENFANTS DIRECTS, PAS UN EMBALLAGE
    // ⭐ `.tuile__p` est en `justify-content:space-between` : ce sont ses
    //   enfants DIRECTS qui font la mise en page. Emballer le montant et
    //   l'alerte dans un `<span>` — ce que fait la fabrique du rayon, qui n'a
    //   qu'un cadenas — aurait déplacé la variation sans rien casser d'autre.
    const pied = t.querySelector('.tuile__p');
    const attendus = [];
    if (l.querySelector('[data-prix] .num')) attendus.push('num');
    if (l.querySelector('[data-prix] .alerte')) attendus.push('alerte');
    attendus.push('delta');
    const rendus = pied ? [...pied.children].map((c) => {
      const cl = String(c.className || '');
      return cl.indexOf('delta') === 0 ? 'delta' : cl.split(' ')[0];
    }) : [];
    verifie('⛔ la cartouche a ses enfants DIRECTS, dans l\'ordre (pas d\'emballage)',
      rendus.join(',') === attendus.join(','),
      `rendus [${rendus.join(', ')}] · attendus [${attendus.join(', ')}]`);

    // ④ LA VARIATION : LE SENS, LE TRACÉ ET LE TEXTE
    // ⛔ Le tracé est la RECETTE que ce lot a sortie de `Market.astro`. S'il
    //   se perdait, la flèche disparaîtrait sans que rien ne lève.
    const TRACES = { up: 'M6 2 11 9H1z', down: 'M6 10 1 3h10z', flat: 'M2 6h8' };
    const sens = l.dataset.var || 'flat';
    const badge = t.querySelector('.tuile__p .delta');
    const chemin = badge ? badge.querySelector('svg path') : null;
    verifie('la variation porte le sens de la ligne, son tracé et son texte',
      !!badge && badge.className.indexOf('delta--' + sens) !== -1
        && !!chemin && chemin.getAttribute('d') === TRACES[sens]
        && (badge.textContent || '').trim() !== '',
      badge ? `class="${badge.className}" d="${chemin ? chemin.getAttribute('d') : '—'}" texte « ${(badge.textContent || '').trim()} »`
        : '🔴 aucune `.delta` : la tuile ne dit plus la variation');
    verifie('…et le POURCENTAGE vient de l\'île, jamais de `data-ch` (deux arrondis)',
      !!badge && (badge.textContent || '').trim() === String((ileBanc && ileBanc.pct ? ileBanc.pct[0] : '') || '—'),
      badge ? `tuile « ${(badge.textContent || '').trim() }» · île « ${(ileBanc && ileBanc.pct ? ileBanc.pct[0] : '—')} » · data-ch « ${l.dataset.ch} »`
        : '🔴 pas de badge');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔀 §7 — LOT I ③ : LE TRI REMPLACE LE TABLEAU, IL NE RECHARGE PLUS
// ═══════════════════════════════════════════════════════════════════════════
// 🗣️ Preda, 06/09 : « quand je clique sur un des noms de colonne ça me recharge
// la page ». ⭐⭐⭐ CE QUI SE MESURE ICI N'EST PAS « ÇA NE RECHARGE PAS » — un
// banc ne voit pas un rechargement. C'est l'INVERSE, et c'est décidable : le
// clic est INTERCEPTÉ (une requête part), et le DOM d'après porte le contenu
// de la réponse, avec tout ce qui tenait à l'ancien tableau REBRANCHÉ.
// ⛔ Le repli sans JavaScript n'est pas mesurable ici non plus : ce qui l'est,
//   c'est que l'en-tête reste un `<a href>` — et le §7 c le vérifie.
console.log('\n7. le tri remplace le tableau au lieu de recharger la page (lot I ③)');
{
  const hote = document.getElementById('vue-tbl');
  const lien = document.querySelector('#vue-tbl a.th-tri[data-tri-col]');
  if (!hote || !lien) {
    indecis('le tri sans rechargement', 'aucun `a.th-tri[data-tri-col]` dans #vue-tbl');
  } else {
    // ── a) L'EN-TÊTE EST RESTÉ UN LIEN, AVEC UNE ADRESSE COMPLÈTE
    // ⭐ C'est la promesse « ça marche sans JavaScript », et c'est la seule
    //   partie du repli qu'un banc puisse constater.
    const href = lien.getAttribute('href') || '';
    verifie('a) l\'en-tête est un `<a href>` qui porte le tri (repli sans JavaScript)',
      lien.tagName === 'A' && /[?&]f-tri=/.test(href),
      `<${lien.tagName.toLowerCase()} href="${href}">`);

    // ── b) ON FABRIQUE LA RÉPONSE DU SERVEUR
    // 🔴🔴 LA POPULATION EST FABRIQUÉE, PAS ATTENDUE. Hors ligne, ce bac ne
    //   sait pas produire deux tris différents de la même sélection ; sans
    //   cette page fabriquée, le chemin entier serait VERT SANS AVOIR ÉTÉ
    //   EXERCÉ — la faute exacte qui a coûté le déploiement du lot G.
    // ⭐ On part du HTML RÉELLEMENT SERVI et on le retourne : les lignes
    //   changent d'ordre, le compteur change de texte, l'île suit. C'est
    //   précisément ce que fait un tri.
    const corps = (html.match(/<tbody>([\s\S]*?)<\/tbody>/i) || [])[1] || '';
    const trs = corps.split(/(?=<tr)/).filter((x) => x.trim().startsWith('<tr'));
    const renverse = trs.slice().reverse().join('');
    let page2 = html.replace(/<tbody>[\s\S]*?<\/tbody>/i, '<tbody>' + renverse + '</tbody>');
    const ileAvant = JSON.parse(document.getElementById('tui-src').textContent);
    const ile2 = JSON.parse(JSON.stringify(ileAvant));
    ile2.img = (ile2.img || []).slice().reverse();
    ile2.pct = (ile2.pct || []).slice().reverse();
    // 🧪🔴🔴🔴 ON FABRIQUE LE CAS QUE LA POPULATION NE PORTE PAS.
    //   Hors ligne, `.reserve/cote/` est vide : `data-ch` et `ile.pct` valent
    //   TOUS LES DEUX « — » sur chaque ligne. Une injection qui ferait lire
    //   `data-ch` au lieu de l'île n'aurait donc RIEN changé, et le contrôle
    //   serait resté vert — mesuré, c'est arrivé.
    //   ⭐⭐⭐ *Quand la population n'atteint pas le cas, on le FABRIQUE ; on
    //   n'attend pas qu'il arrive.* Le témoin ne peut venir que de l'île : s'il
    //   apparaît sur la tuile, c'est que le pourcentage n'a pas été déduit de
    //   `data-ch`, qui est arrondi à 2 décimales POUR LE TRI.
    ile2.pct[0] = 'ÎLE-TÉMOIN';
    page2 = page2.replace(/(<script type="application\/json" id="tui-src">)[\s\S]*?(<\/script>)/i,
      (m, o, f) => o + JSON.stringify(ile2) + f);
    page2 = page2.replace(/(<p class="etiq" id="cpt"[^>]*>)[\s\S]*?(<\/p>)/i, '$1TÉMOIN-DU-BANC$2');
    // ⭐ Le `aria-sort` de la colonne cliquée bascule : c'est le serveur qui le
    //   pose, et la preuve que l'en-tête vient bien de la RÉPONSE.
    const col = lien.getAttribute('data-tri-col');
    page2 = page2.replace(new RegExp('(<th[^>]*aria-sort=")[^"]*("[^>]*><a class="th-tri" data-tri-col="' + col + '")'),
      '$1ascending$2');

    const avantPremier = (document.querySelector('#vue-tbl tbody tr') || {}).dataset;
    const avantN = avantPremier ? avantPremier.n : null;
    const appelsAvant = trafic.appels;
    trafic.reponse = page2; trafic.ok = true;

    // ⭐ ON CLIQUE. Le vrai geste, sur le vrai lien, avec le vrai écouteur.
    const ev = new window.Event('click', { bubbles: true, cancelable: true });
    lien.dispatchEvent(ev);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    verifie('b) le clic est INTERCEPTÉ : une requête part vers l\'adresse du lien',
      trafic.appels === appelsAvant + 1 && trafic.url === href,
      trafic.appels === appelsAvant + 1 ? `1 requête vers ${trafic.url}`
        : `🔴 ${trafic.appels - appelsAvant} requête(s) — sans interception, la page se recharge`);

    const apres = [...document.querySelectorAll('#vue-tbl tbody tr')];
    const apresN = apres.length ? apres[0].dataset.n : null;
    verifie('c) le CORPS du tableau est remplacé par celui de la réponse',
      apres.length === trs.length && apresN !== avantN,
      `${apres.length} ligne(s) · première « ${apresN} » (elle était « ${avantN} »)`);

    verifie('…et l\'EN-TÊTE aussi : `aria-sort` vient de la réponse',
      (document.querySelector('#vue-tbl th[aria-sort="ascending"]') || null) !== null,
      document.querySelector('#vue-tbl th[aria-sort="ascending"]')
        ? 'la flèche de tri suit le serveur'
        : '🔴 seul le `<tbody>` a bougé : l\'en-tête montrerait l\'ancien tri');

    verifie('…et le COMPTEUR suit (il porte `role=status`, il s\'annonce)',
      ((document.getElementById('cpt') || {}).textContent || '').indexOf('TÉMOIN-DU-BANC') !== -1,
      (document.getElementById('cpt') || {}).textContent || '🔴 pas de #cpt');

    // ── d) LE REBRANCHEMENT — la partie qu'on oublie
    // 🔴🔴 `L`, l'île, les tuiles et le libellé d'attente tenaient à l'ANCIEN
    //   corps. Un échange qui ne les refait pas donne une page qui a l'air
    //   juste et ment à la première bascule.
    const ileApres = JSON.parse(document.getElementById('tui-src').textContent);
    verifie('d) l\'île des tuiles a suivi l\'ordre des lignes',
      JSON.stringify(ileApres.img) === JSON.stringify(ile2.img),
      JSON.stringify(ileApres.img) === JSON.stringify(ile2.img)
        ? 'les couvertures suivent le nouveau tri'
        : '🔴 l\'île porte l\'ANCIEN ordre — chaque tuile prendrait la couverture d\'une autre');

    const btnTui = [...document.querySelectorAll('.v-b')].find((b) => b.dataset.vue === 'tui');
    if (btnTui) {
      btnTui.dispatchEvent(new window.Event('click', { bubbles: true }));
      const tuiles = [...document.querySelectorAll('#vue-tui .tuile')];
      verifie('…et les TUILES sont rebâties depuis le nouveau corps',
        tuiles.length === apres.length && tuiles[0] && tuiles[0].dataset.n === apresN,
        tuiles.length ? `${tuiles.length} tuile(s), première « ${tuiles[0].dataset.n} » (ligne « ${apresN} »)`
          : '🔴 aucune tuile : `tuilesFaites` n\'a pas été remis à zéro, ou la grille n\'a pas été vidée');
      // ⭐ ET LE POURCENTAGE VIENT DE L'ÎLE — le témoin fabriqué le prouve, là
      //   où la population hors ligne ne le pouvait pas.
      const badgeT = tuiles[0] ? tuiles[0].querySelector('.tuile__p .delta') : null;
      verifie('…et le POURCENTAGE de la tuile vient de l\'ÎLE, pas de `data-ch`',
        !!badgeT && (badgeT.textContent || '').trim() === 'ÎLE-TÉMOIN',
        badgeT ? `« ${(badgeT.textContent || '').trim()} » (île « ÎLE-TÉMOIN » · data-ch « ${tuiles[0].dataset.ch} »)`
          : '🔴 aucune `.delta` sur la tuile rebâtie');
    }

    const declare = hote.getAttribute('data-attente-txt') || '';
    const cellules = [...document.querySelectorAll('#vue-tbl [data-attente]')];
    const nus = cellules.filter((e) => e.getAttribute('title') !== declare);
    if (!declare || cellules.length === 0) {
      console.log('  ..  …le libellé d\'attente : SANS OBJET — aucune cellule en attente dans ce corps.');
    } else {
      verifie('…et le libellé d\'attente est REPOSÉ sur les cellules neuves',
        nus.length === 0,
        nus.length ? `🔴 ${nus.length}/${cellules.length} cellule(s) sans libellé après l'échange`
          : `${cellules.length} cellule(s) réétiquetées`);
    }

    verifie('e) l\'historique reçoit l\'adresse (« précédent » annule le tri)',
      pousses.length === 1 && pousses[0] === href,
      pousses.length ? `pushState(${pousses.join(', ')})`
        : '🔴 aucun `pushState` : l\'URL mentirait sur le tri affiché');

    // ── f) LA RÉPONSE QUI N'EN EST PAS UNE
    // ⭐⭐⭐ C'EST LA CONTRE-ÉPREUVE, ET ELLE EST OBLIGATOIRE. `/market/` rend
    //   302 vers `/connexion/` quand la session tombe : la réponse est alors
    //   une page SANS `#resultats`. Un échange qui l'installerait quand même
    //   viderait le tableau en silence — le pire des deux mondes.
    const avantF = document.querySelectorAll('#vue-tbl tbody tr').length;
    trafic.reponse = '<html><body><div id="vue-tbl"></div></body></html>';
    const lien2 = document.querySelector('#vue-tbl a.th-tri[data-tri-col]');
    if (lien2) {
      lien2.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
      const apresF = document.querySelectorAll('#vue-tbl tbody tr').length;
      verifie('f) ⛔ une réponse SANS `#resultats` ne remplace RIEN (elle replie)',
        apresF === avantF && apresF > 0,
        apresF === avantF ? `${apresF} ligne(s) intactes — le pilote laisse la navigation faire`
          : `🔴 le tableau est passé de ${avantF} à ${apresF} ligne(s) : une page de connexion a vidé le tableau`);
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// 🖼️🔤 §8 — LOT I ① ET ⑤ : LA COLONNE COUVERTURE, ET LES DEUX EN-TÊTES ABRÉGÉS
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ CE BANC S'APPELLE `test:tuiles` ET C'EST DEVENU CELUI DE LA PAGE `/market/`
// SERVIE : il est le seul à monter son DOM (le §3 des libellés d'attente et le
// §4 de « voir plus » n'ont déjà rien à voir avec des tuiles). On le dit ici
// plutôt que d'ouvrir un cinquième banc sur la même page — mais c'est un nom
// qui a dérivé de son sujet, et ça se saura le jour où quelqu'un cherchera où
// vit le contrôle de la colonne « Cover ».
console.log('\n8. la couverture et les extrêmes, dans le tableau (lot I ① ⑤)');
{
  // ── ① LA MINIATURE. ⭐⭐⭐ ON MESURE LE MÉCANISME, PAS LA VALEUR.
  //   Le défaut du 06/09 n'était pas « 48 est trop petit » : `width:48px` était
  //   ÉCRIT et l'image faisait 0. Un `img{max-width:100%}` global transformait
  //   sa demande FERME en demande CONDITIONNELLE, et une colonne
  //   `table-layout:auto` qui se règle sur les demandes accorde zéro à une
  //   demande conditionnelle. ⛔ Un banc qui vérifierait « width vaut 42 »
  //   serait donc VERT sur exactement le bug d'origine.
  //   📏 L'EFFET, lui, a été mesuré au navigateur sur la page servie : image
  //   42×63, colonne 52, tableau 1 103,0 dans un hôte de 1 103 — et sans
  //   `max-width:none`, image 5 px et colonne 15. linkedom ne met rien en page :
  //   ici on garde la CAUSE, pas la mise en page.
  const CSS = readFileSync(join(ROOT, 'themes', 'vitrine', 'theme.css'), 'utf8');
  const regle = (CSS.match(/\.vign__i\s*\{([^}]*)\}/) || [])[1] || '';
  const larg = ((regle.match(/(?:^|;)\s*width\s*:\s*([^;]+)/) || [])[1] || '').trim();
  const plaf = ((regle.match(/max-width\s*:\s*([^;]+)/) || [])[1] || '').trim();
  verifie('① la vignette DEMANDE une largeur en px, et sa demande est INCONDITIONNELLE',
    /^\d+(\.\d+)?px$/.test(larg) && plaf === 'none',
    `width:${larg || '—'} · max-width:${plaf || '— (donc 100% hérité du socle)'}`
      + ((plaf === 'none') ? '' : ' 🔴 une demande conditionnelle vaut ZÉRO dans une colonne `auto`'));

  // ⭐ ET LES ATTRIBUTS DU `<img>` DISENT LE MÊME RATIO. Ils ne servent qu'à
  //   réserver la place avant l'arrivée de la feuille ; s'ils divergent du CSS,
  //   la ligne saute d'une frame au premier rendu, à chaque visite.
  const balise = (html.match(/<img[^>]*class="vign__i"[^>]*>/) || [])[0] || '';
  const aW = Number((balise.match(/\swidth="(\d+)"/) || [])[1]);
  const aH = Number((balise.match(/\sheight="(\d+)"/) || [])[1]);
  const cssW = Number(larg.replace('px', ''));
  const cssH = Number(((regle.match(/height\s*:\s*([\d.]+)px/) || [])[1] || 0));
  verifie('…et les attributs `width`/`height` disent EXACTEMENT ce que le CSS dessine',
    !!balise && aW === cssW && aH === cssH,
    balise ? `balise ${aW}×${aH} · feuille ${cssW}×${cssH}` : '🔴 aucune `<img class="vign__i">` servie');

  // ── ② LE TITRE DU BANDEAU — on garde le MÉCANISME, pas le nombre
  // 🗣️ Preda, 06/09 : « je veux qu'il soit impactant comme sur la maquette ».
  // ⭐⭐⭐ CE QUI A ÉTÉ CORRIGÉ N'EST PAS UNE TAILLE, C'EST UNE ANNULATION : le
  //   `<h1>` porte `class="mono-t"` — la classe des grands titres du site,
  //   800, capitales, `wdth 108` — et `.bandeau h1`, plus spécifique, lui
  //   reprenait le poids, la casse et l'interlettrage ligne par ligne. Un banc
  //   qui vérifierait « font-size vaut 62 » serait vert le jour où quelqu'un
  //   remet `font-weight:700` et `text-transform:none` à côté.
  // ⛔ La MISE EN PAGE ne se mesure pas ici (linkedom ne compose rien) : elle
  //   l'a été au navigateur — COLLECTIONS, le plus long des cinq titres, fait
  //   448,2 px dans un hôte de 1 376,7, et le document ne déborde pas.
  {
    const pc = (CSS.match(/@media\s*\(min-width:821px\)\s*\{[\s\S]*?\n\}/) || [])[0] || '';
    const regleH1 = (pc.match(/\.bandeau h1\s*\{([^}]*)\}/) || [])[1] || '';
    const taille = Number(((regleH1.match(/font-size\s*:\s*(\d+)px/) || [])[1] || 0));
    const reprises = ['text-transform', 'font-weight', 'letter-spacing', 'font-stretch']
      .filter((d) => new RegExp(d + '\\s*:').test(regleH1));
    verifie('② le titre du bandeau monte à 48 px ou plus en PC',
      taille >= 48, `font-size:${taille || '—'}px`
        + (taille >= 48 ? '' : ' 🔴 le cran « outil » de 38 px a été remis'));
    verifie('…et il LAISSE `.mono-t` porter le caractère (il ne le réécrit pas)',
      reprises.length === 0,
      reprises.length ? `🔴 le bandeau redéclare ${reprises.join(', ')} — il annule la classe des grands titres`
        : 'seules la taille et la marge sont propres au bandeau');
  }

  // ── ⑤ LES DEUX EN-TÊTES ABRÉGÉS
  // 🗣️ Preda, 06/09 : « réduire l'épaisseur des colonnes ALL-TIME LOW et
  //   ALL-TIME HIGH en renommant ça ATL et ATH, et dans l'infobulle All Time
  //   Low ». 📏 Les deux en-têtes faisaient 124,6 et 127,4 px sur la page
  //   servie — les deux plus larges après le nom.
  // ⭐⭐ ON EXIGE LES DEUX MOITIÉS : abrégé À L'ÉCRAN, entier EN INFOBULLE. Un
  //   banc qui ne verrait que l'abréviation serait vert sur une colonne devenue
  //   illisible ; un banc qui ne verrait que le `title` serait vert sur une
  //   colonne restée large.
  // 🧰🔴🔴 ON NE MESURE PAS LA LONGUEUR DU TEXTE RENDU, ET C'EST UNE LEÇON DÉJÀ
  //   PAYÉE. `I18N_MARQUAGE=1` PRÉFIXE chaque libellé de sa clé : la première
  //   version de ce contrôle lisait « item.atlAbbrATL », 18 caractères, et
  //   rougissait sur un code juste. *On mesure avec la règle du SITE, jamais
  //   avec celle de son propre outil.* ⇒ on juge le DICTIONNAIRE (ce qui fixe
  //   la largeur à l'écran) et la CLÉ EMPLOYÉE (ce qui fixe la structure), pas
  //   la chaîne que le mode de marquage a réécrite en chemin.
  // ⚠️ `DICOS` du §… vit dans un bloc : on refait le chemin ici plutôt que de
  //   le sortir de sa portée — deux lignes contre un remaniement à distance.
  // 🧰🔴🔴🔴 ET LA SECONDE FOIS, C'ÉTAIT ENCORE MON INSTRUMENT. Comparer par
  //   SUFFIXE ne suffisait pas : en mode marquage, `t()` rend
  //   `SENT_DEB + clé + SENT_MIL + texte + SENT_FIN` — il y a une sentinelle
  //   APRÈS le texte, donc `endsWith('ATL')` est faux sur une page juste.
  //   ⭐⭐ Le dépôt a déjà l'outil : `nu()` dans `engine/lib/i18n.mjs`. *Quand on
  //   mesure une chaîne que le site a réécrite, on la lit avec la fonction du
  //   site, pas avec une règle qu'on se donne.*
  const { nu } = await import(join(R_I18N, 'engine', 'lib', 'i18n.mjs').replace(/^/, 'file://'));
  const DOSSIER_DICOS = join(ROOT, 'engine', 'i18n');
  const dicos = {};
  for (const f of readdirSync(DOSSIER_DICOS).filter((x) => x.endsWith('.json'))) {
    try { dicos[f.replace('.json', '')] = JSON.parse(readFileSync(join(DOSSIER_DICOS, f), 'utf8')); } catch { /* ignoré */ }
  }
  for (const col of ['atl', 'ath']) {
    const th = [...document.querySelectorAll('#vue-tbl th')]
      .find((x) => x.querySelector(`a.th-tri[data-tri-col="${col}"]`));
    if (!th) { indecis(`l'en-tête ${col.toUpperCase()}`, 'colonne absente du tableau servi'); continue; }
    const vu = nu(th.querySelector('a.th-tri')?.textContent || '').trim();
    const bulle = nu(th.getAttribute('title') || '').trim();

    // ① LE DICTIONNAIRE : l'abrégé est court PARTOUT, le long est plus long.
    const trop = Object.entries(dicos)
      .filter(([, d]) => d[`item.${col}Abbr`] == null || String(d[`item.${col}Abbr`]).length > 4);
    verifie(`⑤ « item.${col}Abbr » existe et tient en 4 signes dans les 5 langues`,
      Object.keys(dicos).length >= 5 && trop.length === 0,
      trop.length ? `🔴 ${trop.map(([l, d]) => `${l}: ${d[`item.${col}Abbr`] === undefined ? 'ABSENT' : `« ${d[`item.${col}Abbr`]} »`}`).join(' · ')}`
        : Object.entries(dicos).map(([l, d]) => `${l}: ${d[`item.${col}Abbr`]}`).join(' · '));

    // ② LA PAGE SERVIE : l'en-tête porte l'abrégé, le `title` porte l'entier.
    //   ⭐ On compare par SUFFIXE : le marquage préfixe, il ne suffixe pas.
    const abr = (dicos.en || {})[`item.${col}Abbr`] || '';
    const lng = (dicos.en || {})[`item.${col}`] || '';
    verifie(`…et l'en-tête servi affiche l'abrégé, pas le libellé entier`,
      !!abr && vu.endsWith(abr) && !vu.endsWith(lng),
      `en-tête « ${vu} » (attendu se terminant par « ${abr} »)`);
    verifie(`…et son infobulle porte le libellé ENTIER, traduit`,
      !!lng && bulle.endsWith(lng),
      bulle ? `title « ${bulle} » (attendu se terminant par « ${lng} »)`
        : '🔴 aucun `title` : « ATL » seul n\'apprend rien à qui ne connaît pas le jargon');
  }
}


fin();
