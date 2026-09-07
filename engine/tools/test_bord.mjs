// ⚠️ VeVePreda/veve-sites — engine/tools/test_bord.mjs   (FICHIER NEUF — lot J)
// ═══════════════════════════════════════════════════════════════════════════
// LE BANC DU TABLEAU DE BORD — il FABRIQUE sa population et EXÉCUTE le pilote
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 SANS FABRICATION, CE BANC SERAIT VERT SANS RIEN MESURER, ET C'EST LA
// PREMIÈRE CHOSE À COMPRENDRE ICI. Mesuré le 07/09 sur le build hors ligne :
//   · `.reserve/cote/` ne contient QUE `_projection.json` — zéro cote. Les
//     uuid de l'échantillon s'appellent `sample-0053-15409`, et `uuidValide()`
//     (liste blanche `[0-9a-f-]{8,64}`) les REFUSE : « 90 uuid refusé(s) »
//     s'imprime à chaque build hors ligne ;
//   · un compte de banc n'a AUCUN favori, donc le bloc « vos favoris » n'est
//     pas rendu du tout.
// ⇒ Un banc qui se contenterait de regarder la page servie dirait « aucun
//   montant dans le HTML » d'un écran qui n'a même pas de tableau. *Un contrôle
//   qu'aucune faute ne peut faire rougir ne mesure rien.*
// ⭐ On FABRIQUE donc : trois cotes valides sur le disque, cinq vignettes dans
//   l'index, cinq favoris en base. C'est la règle du lot I — « avant le zip,
//   vérifier que la population mesurée ATTEINT les cas du lot ; sinon la
//   FABRIQUER ».
//
// ⭐⭐ ET IL EXÉCUTE `bord.js` DANS UN DOM. C'est ce qui a payé au lot I : un
// banc qui fait TOURNER le pilote trouve ce que trois passes de `grep` ne
// voient pas. La somme, la variation pondérée et les jauges ne vivent que
// là — aucune ne peut se lire dans le HTML servi, par construction.

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const ENTREE = join(ROOT, 'dist', 'server', 'entry.mjs');
const PORT = Number(process.env.PORT_BANC_BORD || 43251);
const PORT_SESSION = PORT + 1;
const COMPTE = 'banc-compte-J';

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
const fin = (code) => {
  console.log(ko === 0 && indecidable === 0 ? '\n✅ bord : tout est conforme'
    : ko === 0 ? `\n⚠️  bord : conforme, mais ${indecidable} point(s) INDÉCIDABLE(S)`
      : `\n❌ bord : ${ko} écart(s)`);
  process.exit(code ?? (ko === 0 ? 0 : 1));
};

console.log('\n0. de quoi ce banc a-t-il besoin pour prouver quoi que ce soit ?');
if (!existsSync(ENTREE)) {
  // ⭐ SUR vevewiki IL N'Y A PAS DE SERVEUR, ET CE N'EST PAS UNE PANNE : la
  //   route de compte y sort en talon de redirection. On le DIT au lieu de
  //   sortir vert — « je n'ai pas pu regarder » et « c'est correct » sont deux
  //   phrases différentes.
  indecis('le serveur de rendu', `pas de ${ENTREE} (site static : le tableau de bord n'y est pas rendu)`);
  fin(0);
}

// ═══════════════════════════════════════════════════════════════════════════
// LA POPULATION FABRIQUÉE
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ DES uuid QUI PASSENT `uuidValide()`, sinon `deposer()` les refuse et la
//   route `/api/cote/lot` répond « aucune cote » — le banc mesurerait alors le
//   refus de sa propre fabrication et l'imputerait au code.
const PIECES = [
  { u: 'aaaaaaaa-1111-4000-8000-000000000001', n: 'Banc Piece Une',   floor: 100, atl: 50,  ath: 200, ch: 10 },
  { u: 'aaaaaaaa-1111-4000-8000-000000000002', n: 'Banc Piece Deux',  floor: 300, atl: 100, ath: 400, ch: -20 },
  { u: 'aaaaaaaa-1111-4000-8000-000000000003', n: 'Banc Piece Trois', floor: 50,  atl: 50,  ath: 50,  ch: 0 },
  { u: 'aaaaaaaa-1111-4000-8000-000000000004', n: 'Banc Piece Quatre', floor: 25, atl: 10,  ath: 90,  ch: 5 },
  // ⭐ LA CINQUIÈME N'A PAS DE COTE, ET C'EST UN CAS DU LOT : la sous-ligne
  //   doit dire « 4 de vos 5 pièces ont un plancher », pas annoncer un total
  //   muet. Une pièce sans plancher n'est PAS une pièce à zéro.
  { u: 'aaaaaaaa-1111-4000-8000-000000000005', n: 'Banc Piece Cinq',  floor: null, atl: null, ath: null, ch: null },
];
// 🔴🔴🔴 LA FABRICATION VIT DANS UN DOSSIER À CE BANC, PAS DANS `.reserve/`.
// ═══════════════════════════════════════════════════════════════════════════
// Première version : elle écrivait ses cotes dans `.reserve/cote/` et ses
// vignettes dans `.reserve/vignettes.json`, les vrais. Résultat mesuré le
// 07/09 : `test:marche` § 9 est devenu ROUGE — « courbe : lu par la page,
// porté par PERSONNE ». Il pioche UN fichier de cote au hasard pour savoir
// quelles clés une cote porte, et il tombait sur l'un des miens, qui n'a pas
// de `courbe`.
// ⭐⭐⭐ MON INSTRUMENT AVAIT CASSÉ UN AUTRE BANC, ET LE ROUGE ACCUSAIT LE CODE.
// C'est la forme la plus coûteuse d'erreur de mesure : elle ne se voit pas là
// où elle est commise. *Un banc qui fabrique doit fabriquer CHEZ LUI.*
// ⇒ `RESERVE_COTE_DIR` et `RESERVE_VIGNETTES` existent déjà, et le serveur
//   enfant les reçoit dans son environnement : rien de partagé n'est touché.
const BANC_DIR = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'veve-bord-reserve-'));
const COTE_DIR = join(BANC_DIR, 'cote');
mkdirSync(COTE_DIR, { recursive: true });
for (const p of PIECES) {
  if (p.floor === null) continue;
  writeFileSync(join(COTE_DIR, `${p.u}.json`), JSON.stringify({
    floor: p.floor, atl: p.atl, ath: p.ath, change7d: p.ch, listings: 3,
    maj: new Date().toISOString(),
  }), 'utf8');
}
// L'index des vignettes : le serveur y lit nom, chemin, rareté.
const VIGN = join(BANC_DIR, 'vignettes.json');
let indexVign = {};
// ⭐ ON PART DE L'INDEX RÉEL pour garder la forme du fichier (`{index: {...}}`
//   ou plat) : une copie faite « comme je crois qu'il est » aurait mesuré ma
//   croyance. Puis on écrit AILLEURS.
try { indexVign = JSON.parse(readFileSync(join(ROOT, '.reserve', 'vignettes.json'), 'utf8')); } catch { indexVign = {}; }
const cible = indexVign.index && typeof indexVign.index === 'object' ? indexVign.index : indexVign;
for (const p of PIECES) cible[p.u] = { n: p.n, p: `/collectibles/banc/${p.u}/`, r: 'RARE' };
writeFileSync(VIGN, JSON.stringify(indexVign), 'utf8');
verifie('la population est fabriquée', true,
  `${PIECES.length} favoris · ${PIECES.filter((p) => p.floor !== null).length} cotes sur disque`);

// Les favoris du compte, dans la base jetable que le serveur recevra.
const BASE = join(mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'veve-bord-')), 'bord.db');
process.env.DB_PATH = BASE;
const { poserFavori } = await import('../lib/favoris.mjs');
for (const p of PIECES) poserFavori(COMPTE, { uuid: p.u, chemin: `/collectibles/banc/${p.u}/`, nom: p.n });

// ═══════════════════════════════════════════════════════════════════════════
const faux = createServer((req, res) => {
  if (req.url.startsWith('/session/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ palier: 'member', jours_restants: 30 }));
  }
  if (req.url.startsWith('/api/session')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ compte: COMPTE, email: 'banc@exemple.test' }));
  }
  res.writeHead(404); return res.end('{}');
});
await new Promise((ok) => faux.listen(PORT_SESSION, '127.0.0.1', ok));

const serveur = spawn(process.execPath, [ENTREE], {
  env: {
    ...process.env, HOST: '127.0.0.1', PORT: String(PORT),
    SESSION_API: `http://127.0.0.1:${PORT_SESSION}`,
    VEVEID_SERVICE: process.env.VEVEID_SERVICE || 'secret-de-banc',
    DB_PATH: BASE,
    // ⭐ LE SERVEUR LIT LA RÉSERVE DU BANC, ET ELLE SEULE.
    RESERVE_COTE_DIR: COTE_DIR,
    RESERVE_VIGNETTES: VIGN,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let journal = '';
serveur.stdout.on('data', (d) => { journal += d; });
serveur.stderr.on('data', (d) => { journal += d; });
const arreter = () => { try { serveur.kill('SIGTERM'); } catch { /* déjà mort */ } faux.close(); };
process.on('exit', arreter);

let pret = false;
for (let i = 0; i < 60 && !pret; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try { pret = (await fetch(`http://127.0.0.1:${PORT}/api/sante`)).ok; } catch { /* pas encore */ }
}
verifie('un vrai serveur, un vrai rendu à la demande', pret,
  pret ? `port ${PORT}` : `aucune réponse en 30 s — journal :\n${journal.slice(-600)}`);
if (!pret) { arreter(); fin(1); }

const COOKIE = 'vp_session=banc-sid; vp_membre=1';
const r = await fetch(`http://127.0.0.1:${PORT}/dashboard/`, { headers: { cookie: COOKIE } });
const html = await r.text();

console.log('\n1. la page est-elle ENTIÈRE ? (et pas seulement « 200 »)');
// 🔴🔴 CE CONTRÔLE EST NÉ D'UNE PANNE SERVIE, LE 07/09. `pouls.mjs` lisait son
//   constat avec `readFileSync(import.meta.url + '../data/…')` : juste au
//   build, FAUX une fois bundlé dans `dist/server/chunks/`. Le serveur
//   répondait **200**, puis levait « uncaught error in the middle of the
//   stream » — la page partait TRONQUÉE sous un code de succès.
// ⭐⭐⭐ *Un 200 ne dit pas que la page est entière.* Un banc qui ne lit que le
//   statut aurait certifié cette panne.
verifie('/dashboard/ répond 200', r.status === 200, `reçu ${r.status}`);
verifie("…et le document va jusqu'à `</html>`", /<\/html>/i.test(html),
  /<\/html>/i.test(html) ? `${html.length} o` : '🔴 flux interrompu — chercher « uncaught error » dans le journal du serveur');
verifie('…et le journal du serveur ne porte aucune erreur de rendu',
  !/uncaught error/i.test(journal),
  /uncaught error/i.test(journal) ? `🔴 ${(journal.match(/Error: [^\n]{0,120}/) || [''])[0]}` : 'aucune');

// ⭐⭐⭐ LE DOM EST MONTÉ ICI, AVANT LE PREMIER CONTRÔLE QUI LIT DU TEXTE, ET
//   C'EST UNE INJECTION QUI NE MORDAIT PAS QUI L'A IMPOSÉ.
//   Première version du § 2 : un `RegExp` cherchant `>0</div><div class="s">not
//   collected`. Injection « remplacer le tiret par un 0 » ⇒ le banc est resté
//   VERT. Cause : sous `I18N_MARQUAGE=1` — que la chaîne CI et le Dockerfile
//   posent tous deux — le marquage PRÉFIXE chaque libellé de sa clé et pose une
//   sentinelle APRÈS. Le texte servi est « bord.pouls.absent⟨sent⟩not
//   collected », que mon motif ne reconnaissait pas.
//   ⭐⭐ *Une injection qui ne mord pas accuse le BANC.* Et la règle de lecture
//   est celle du SITE (`nu()`), jamais celle qu'on se donne.
const { nu } = await import('../lib/i18n.mjs');
const { monterDOM } = await import('./_dom_banc.mjs');
const dom = await monterDOM(html);
const propre = (n) => nu(n ? n.textContent : '').replace(/\s+/g, ' ').trim();

console.log('\n2. le pouls dit-il ses dates, et jamais un zéro ?');
const bloc = (html.match(/<div class="stats">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || []).join(' ');
verifie('les trois chiffres mesurés sont servis',
  html.includes('7,013') && html.includes('943'),
  '7 013 transferts · 943 wallets actifs (union « a envoyé OU reçu »), journée VeVe du 06/09');
// ⛔⛔ LE CONTRÔLE QUI COMPTE : les deux cases sans source ne doivent JAMAIS
//    porter un nombre. On cherche « not collected » ET on refuse un « 0 » sous
//    ces libellés — un zéro affirme « il ne s'est rien passé », c'est une
//    mesure, et elle est fausse.
if (!dom) {
  indecis('les cases du pouls', 'linkedom absent — leur contenu n\'a pas été mesuré');
} else {
  // ⭐ ON PART DES CASES, PAS DU TEXTE : chaque `.stat` porte son libellé
  //   (`.k`), sa valeur (`.v`) et sa date ou son état (`.s`). Une case dont le
  //   `.s` dit « non collecté » DOIT porter un tiret — quel que soit le mot,
  //   dans les cinq langues, avec ou sans marquage.
  const cases = [...dom.document.querySelectorAll('.stat')].map((el) => ({
    k: propre(el.querySelector('.k')),
    v: propre(el.querySelector('.v')),
    s: propre(el.querySelector('.s')),
  }));
  // ⚠️ LES CINQ LANGUES, et le mot a CHANGÉ en cours de lot : « non collecté »
  //   était faux (la donnée existe, elle n'est pas servie). Le banc suit les
  //   libellés, il ne fige pas une formulation.
  const sansSource = cases.filter((c) => /not wired up|pas encore branché|noch nicht angebunden|aún no conectado|non ancora collegato/i.test(c.s));
  verifie('les deux cases non servies le disent, et ne disent pas « zéro »', sansSource.length >= 2,
    `${sansSource.length} case(s) sur ${cases.length} — attendu au moins 2 (revenue, OMI brûlés)`);
  // ⛔⛔ LE CONTRÔLE QUI COMPTE : aucune d'elles ne porte un CHIFFRE. Un zéro
  //    affirme « il ne s'est rien passé » — c'est une mesure, et elle est fausse.
  const chiffrees = sansSource.filter((c) => /[0-9]/.test(c.v));
  verifie('⛔ et aucune ne porte un chiffre', chiffrees.length === 0,
    chiffrees.length ? `🔴 ${chiffrees.map((c) => `${c.k} = « ${c.v} »`).join(' · ')}`
      : sansSource.map((c) => `« ${c.v} »`).join(' · '));
  // ⭐ ET LES CASES MESURÉES, ELLES, PORTENT BIEN LEUR CHIFFRE : sans ce
  //   contre-contrôle, un gabarit qui rendrait TOUT en tiret serait vert.
  const mesurees = cases.filter((c) => /7,013|7 013|7\.013|943/.test(c.v));
  verifie('…et les cases mesurées, elles, portent leur chiffre ET leur date',
    mesurees.length >= 2 && mesurees.every((c) => /2026|06\/09|09\/06/.test(c.s)),
    mesurees.map((c) => `${c.v} (${c.s})`).join(' · ') || '🔴 aucune case chiffrée trouvée');
}
// 🕐 L'HORLOGE EST DANS L'ÉTIQUETTE, et c'est la mesure du 07/09 qui l'impose :
//   le jour de l'entrepôt est un jour PACIFIQUE, pas un jour UTC.
verifie("…et l'étiquette du pouls nomme son horloge", /UTC-7/.test(html),
  /UTC-7/.test(html) ? 'l’écran dit dans quelle horloge il compte'
    : '🔴 sans elle, « 11/08 » et « 12/08 » sont tous deux défendables et personne ne tranche');

console.log('\n3. ⛔ AUCUN MONTANT DANS LE HTML SERVI — le mur du lot 101');
// ⭐ On cherche les VALEURS fabriquées, pas des noms de champs : c'est le seul
//   contrôle qu'une fuite ne peut pas contourner en renommant une clé.
const fuites = PIECES.filter((p) => p.floor !== null)
  .filter((p) => new RegExp(`>\\s*${p.floor}\\s*<`).test(html));
verifie('aucun plancher fabriqué n\'apparaît dans la page', fuites.length === 0,
  fuites.length ? `🔴 ${fuites.map((p) => p.floor).join(', ')} servis en clair` : `${PIECES.length - 1} plancher(s) testé(s)`);
// 🔬 CE CONTRÔLE ÉTAIT FAIBLE, ET UNE INJECTION L'A MONTRÉ : il exigeait qu'AU
//   MOINS une cellule soit vide. Avec un montant servi sur une ligne et le
//   tiret sur les autres, il restait VERT — c'est le premier contrôle (les
//   valeurs) qui a mordu. ⭐ *« il en existe une bonne » ne dit rien de celles
//   qui ne le sont pas.* ⇒ on compte, et on exige que TOUTES le soient.
const hotesFloor = (html.match(/data-champ="floor"/g) || []).length;
const videsFloor = (html.match(/data-champ="floor"><span data-cote-v>(—|<\/span>)/g) || []).length;
verifie('TOUTES les cellules de plancher sont servies vides',
  hotesFloor > 0 && videsFloor === hotesFloor,
  `${videsFloor} vide(s) sur ${hotesFloor} hôte(s) — elles portent le tiret, et le socle les remplira dans le navigateur`);
verifie('…et aucune jauge n\'est servie remplie', !/data-remplie/.test(html),
  'une jauge remplie au serveur voudrait dire que trois montants y sont passés');

console.log('\n4. la table des favoris, et les hôtes que la somme exige');
const lignes = (html.match(/data-champ="floor"/g) || []).length;
verifie('les 3 premières pièces ont leur ligne', /<table id="tb-fav-t">/.test(html),
  `${lignes} hôte(s) de plancher au total`);
// 🔴🔴 LE CONTRÔLE LE PLUS IMPORTANT DE CE §. Sans les hôtes cachés, `60-cote.js`
//   ne demanderait que les 3 uuid VISIBLES et « valeur de vos favoris »
//   additionnerait 3 planchers sur 5 — un nombre faux qui a l'air juste.
verifie('⛔ et TOUS les favoris ont un hôte, pas seulement les 3 affichés',
  lignes === PIECES.length,
  lignes === PIECES.length ? `${lignes} hôtes pour ${PIECES.length} favoris`
    : `🔴 ${lignes} hôte(s) pour ${PIECES.length} favori(s) — la somme porterait sur l'affichage, pas sur la collection`);

console.log('\n5. le pilote, EXÉCUTÉ — la somme, la variation, les jauges');
if (!dom) {
  indecis('l\'exécution du pilote', 'linkedom absent — le comportement n\'a pas été mesuré');
} else {
  const { document, window } = dom;
  const cotes = {};
  for (const p of PIECES) {
    if (p.floor === null) continue;
    cotes[p.u] = { floor: p.floor, atl: p.atl, ath: p.ath, change7d: p.ch };
  }
  window.vpQuandCotes = (f) => f(cotes, null);
  globalThis.window = window;
  globalThis.document = document;
  const code = readFileSync(join(ROOT, 'src', 'socle', 'modules', 'bord.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', code)(window, document);

  const total = document.getElementById('tb-valeur')?.textContent || '';
  // 100 + 300 + 50 + 25 = 475, la cinquième n'a pas de cote.
  verifie('la somme porte sur les CINQ favoris, pas sur les trois affichés',
    /475/.test(total.replace(/[\s  ,.]/g, '')) || /475/.test(total),
    `« ${total} » — attendu 475 (100+300+50+25 ; la 5ᵉ n'a pas de plancher)`);
  const sous = document.getElementById('tb-valeur-s')?.textContent || '';
  verifie('…et la page DIT que la 5ᵉ n\'a pas de plancher', /4/.test(sous) && /5/.test(sous),
    `« ${sous} » — un total muet laisserait croire qu'il porte sur tout`);

  // ⭐⭐ L'ATTENDU EST **CALCULÉ**, PAS RECOPIÉ D'UN BROUILLON. Première
  //   version : « −12,2 % », écrit à la main — et le banc a rougi sur un code
  //   JUSTE, parce que MON addition avait oublié une pièce. *Un attendu écrit
  //   de tête est une seconde implémentation, avec ses propres fautes.*
  let avantRef = 0; let apresRef = 0;
  for (const p of PIECES) {
    if (p.floor === null) continue;
    avantRef += p.floor / (1 + p.ch / 100);
    apresRef += p.floor;
  }
  const attendu = ((apresRef - avantRef) / avantRef) * 100;
  // ⛔ ET CE CONTRÔLE NE VAUT QUE PARCE QUE LES DEUX RÉPONSES DIFFÈRENT : la
  //   moyenne SIMPLE des pourcentages donnerait tout autre chose. Si un jour la
  //   population fabriquée rendait les deux égales, ce contrôle serait vert quoi
  //   qu'il arrive — on le mesure ici plutôt que de le découvrir.
  const cotees = PIECES.filter((p) => p.floor !== null);
  const simple = cotees.reduce((n, p) => n + p.ch, 0) / cotees.length;
  const varTxt = (document.getElementById('tb-var')?.textContent || '').replace(/\s/g, '');
  const lu = Number(varTxt.replace(',', '.').replace('%', ''));
  verifie('la variation 7 j est PONDÉRÉE par les planchers',
    Math.abs(attendu - simple) > 1 && Number.isFinite(lu) && Math.abs(lu - attendu) < 0.6,
    `« ${varTxt} » — pondérée ${attendu.toFixed(2)} % · moyenne simple ${simple.toFixed(2)} % `
    + '(les deux DOIVENT différer, sinon ce contrôle ne prouve rien)');

  // 🔬🔴 L'ATTENDU DES JAUGES SE LIT DANS LE DOM, IL NE SE SUPPOSE PAS.
  //   Première version : « 2 remplies », parce que je croyais savoir QUELLES
  //   pièces la table affiche. `lireFavoris()` ne rend pas l'ordre
  //   d'insertion : les trois lignes n'étaient pas celles que j'avais en tête,
  //   et le banc a rougi sur un pilote correct.
  //   ⭐ *On mesure la population qu'on a, pas celle qu'on a voulu fabriquer.*
  const hotes = [...document.querySelectorAll('[data-jauge]')];
  const placables = hotes.filter((g) => {
    const c = cotes[g.getAttribute('data-jauge')];
    return c && Number.isFinite(c.atl) && Number.isFinite(c.ath) && c.ath > c.atl;
  }).length;
  const remplies = document.querySelectorAll('[data-jauge][data-remplie]').length;
  verifie('les jauges plaçables sont remplies, les autres NON', remplies === placables,
    `${remplies} remplie(s) pour ${placables} plaçable(s) sur ${hotes.length} ligne(s) — une pièce `
    + "dont l'ATL vaut l'ATH n'a pas de place à montrer : elle reste VIDE, jamais un curseur "
    + 'collé à zéro (qui se lirait « au plus bas »)');
  // ⭐⭐ ET IL FAUT QUE LES DEUX CAS SOIENT PRÉSENTS. Tout plaçable, ou rien de
  //   plaçable, et l'égalité serait vraie sans rien dire. *Un contrôle qu'aucune
  //   faute ne peut faire rougir ne mesure rien.*
  if (!(placables > 0 && placables < hotes.length)) {
    indecis('la distinction plaçable / non plaçable',
      `${placables} plaçable(s) sur ${hotes.length} ligne(s) : la table n'affiche pas les deux cas`);
  }
}

arreter();
fin();
