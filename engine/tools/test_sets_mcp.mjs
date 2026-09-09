// ⚠️ VeVePreda/veve-sites — engine/tools/test_sets_mcp.mjs   (NEUF — lot 228)
// ═══════════════════════════════════════════════════════════════════════════
//  LE BANC DU RENDEMENT MCP DES SETS — demande `f` de Preda
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ IL N'IMPORTE PAS `dataset.mjs` : un banc qui l'importe recalcule la
// vitrine et VIDE `.reserve/cote/`. Il importe le module PUR et lit le TEXTE
// des deux fichiers qui le branchent.
//
// ⭐⭐ CE QU'IL SURVEILLE VRAIMENT, ET QU'AUCUN AUTRE BANC NE PEUT VOIR :
// **la PLACE du dépôt dans `dataset.mjs`.** Descendu sous `projeterCote()`, il
// sommerait des `undefined`, rendrait `cout: null` sur les 5 154 sets et
// servirait un tableau vide — build vert, journal fier, zéro erreur. C'est
// exactement la famille de pannes que ce dépôt paie le plus cher.
//
// 🔬 IL A ÉTÉ JUGÉ EN LUI INJECTANT LE MAUVAIS CODE (05/09/2026) : dépôt
// descendu sous la projection ⇒ ROUGE ; plafond de set porté à 40 ⇒ ROUGE ;
// pièce sans barème comptée 0 ⇒ ROUGE ; `null` triés en tête ⇒ ROUGE.

import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pointsDeSet, agregerSet, classerSets, construireSetsMcp,
         SET_POINTS_MAX, SETS_MCP_FICHIER, TRIS_SETS } from '../lib/sets_mcp.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(ICI, '..', '..');

let ko = 0;
const verifie = (titre, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};

// 📝 DÉCAPER LES COMMENTAIRES AVANT DE CHERCHER UN NOM. Cinquième fois que ce
// piège se paie : `projeterCote` et `deposerSetsMcp` sont tous deux CITÉS dans
// la prose de `dataset.mjs`, et un banc qui lit le fichier brut mesurerait la
// position de deux commentaires.
// ⛔ `//` sauf après `:` — sinon on décape le `https://` des URL.
const decape = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

console.log('\n🏆 LE RENDEMENT MCP DES SETS\n');

// ── ① LE BARÈME, ET SON PLAFOND ───────────────────────────────────────────
console.log('① le barème de set — source VeVe, plafond à 5');
verifie('la table est 1→1, 2→2, 3→3, 4→4, 5→5',
  [1, 2, 3, 4, 5].every((n) => pointsDeSet(n) === n),
  [1, 2, 3, 4, 5].map(pointsDeSet).join(' '));
// ⭐ LE TERME À ZÉRO EST ATTEIGNABLE : porter SET_POINTS_MAX à 40 fait rougir
//   cette ligne, et c'est la seule qui morde sur le plafond.
verifie('il PLAFONNE : un set de 40 pièces rapporte le même bonus qu\'un set de 5',
  pointsDeSet(40) === SET_POINTS_MAX && SET_POINTS_MAX === 5,
  `pointsDeSet(40) = ${pointsDeSet(40)} · SET_POINTS_MAX = ${SET_POINTS_MAX}`);
// 🕳️ `Number('')` VAUT 0 — le piège qui a déjà coûté au projet.
verifie('une taille vide, nulle ou non entière rend `null`, JAMAIS 0',
  ['', null, undefined, 0, -3, 2.5, 'x'].every((v) => pointsDeSet(v) === null),
  ['', null, undefined, 0, -3, 2.5, 'x'].map((v) => String(pointsDeSet(v))).join(' '));

// ── ② LES TROIS REFUS DE L'AGRÉGAT ────────────────────────────────────────
console.log('\n② les refus — un chiffre absent vaut mieux qu\'un chiffre inventé');
const piece = (floor, rarity = 'COMMON', type = 'collectible') => ({ floor, rarity, type });
const set = (items) => ({ slug: 's', name: 'S', brand: '', licensor: '', items });

const complet = agregerSet(set([piece(100), piece(50, 'RARE')]));
verifie('un set complet : coût = somme des planchers, points = bonus + pièces',
  complet.cout === 150 && complet.bonusSet === 2 && complet.pointsPieces === 2.25
  && complet.points === 4.25,
  `cout=${complet.cout} bonus=${complet.bonusSet} pieces=${complet.pointsPieces} pts=${complet.points}`);
verifie('… et son ratio est le quotient EXACT, sans arrondi',
  complet.usdParMcp === 150 / 4.25, String(complet.usdParMcp));

// REFUS ① — une seule pièce sans plancher suffit.
const troue = agregerSet(set([piece(100), piece(null, 'RARE')]));
verifie('REFUS ① une pièce sans plancher ⇒ `cout` ET `usdParMcp` sont `null`',
  troue.cout === null && troue.usdParMcp === null && troue.couvert === 1,
  `cout=${troue.cout} ratio=${troue.usdParMcp} couvert=${troue.couvert}/${troue.taille}`);
// ⭐ Et le zéro n'est pas un plancher : un `floor` à 0 ne couvre pas la pièce.
verifie('… et un plancher à 0 ne compte pas comme couvert (0 n\'est pas un prix)',
  agregerSet(set([piece(100), piece(0)])).cout === null);

// REFUS ② — une pièce hors barème ne vaut pas zéro point.
const horsBareme = agregerSet(set([piece(100), piece(50, 'ARTIST_PROOF', 'comic')]));
verifie('REFUS ② une pièce sans barème ⇒ `points` est `null`, pas un total gonflé',
  horsBareme.points === null && horsBareme.sansBareme === 1 && horsBareme.usdParMcp === null,
  `pts=${horsBareme.points} sansBareme=${horsBareme.sansBareme}`);

// ── ③ LE CLASSEMENT — LES `null` EN DERNIER, DANS LES DEUX SENS ───────────
console.log('\n③ le classement');
const corpus = [
  { nom: 'cher', usdParMcp: 900, points: 5, cout: 900, taille: 1 },
  { nom: 'muet', usdParMcp: null, points: null, cout: null, taille: 2 },
  { nom: 'bon', usdParMcp: 10, points: 9, cout: 90, taille: 3 },
];
const asc = classerSets(corpus, 'gpm-asc').map((a) => a.nom);
const desc = classerSets(corpus, 'gpm-desc').map((a) => a.nom);
verifie('croissant : le moins cher par point d\'abord, le muet EN DERNIER',
  asc.join(',') === 'bon,cher,muet', asc.join(','));
verifie('décroissant : l\'ordre s\'inverse, le muet reste EN DERNIER',
  desc.join(',') === 'cher,bon,muet', desc.join(','));
verifie('un tri inconnu retombe sur le défaut, il ne lève pas',
  classerSets(corpus, 'n-importe-quoi').map((a) => a.nom).join(',') === asc.join(','));
verifie(`les ${TRIS_SETS.length} tris déclarés rendent tous ${corpus.length} lignes — aucun n'en perd`,
  TRIS_SETS.every((t) => classerSets(corpus, t).length === corpus.length),
  TRIS_SETS.join(' '));

// ── ④ LA CHARGE DIT SON DÉNOMINATEUR ──────────────────────────────────────
console.log('\n④ la charge');
const charge = construireSetsMcp([set([piece(100)]), set([piece(null)])]);
verifie('elle porte `total`, `classables` et `personnalise`',
  charge.total === 2 && charge.classables === 1 && charge.personnalise === false,
  `total=${charge.total} classables=${charge.classables} perso=${charge.personnalise}`);
verifie('`personnalise` est FAUX — aucune étiquette ne peut promettre l\'exclusion des sets possédés',
  charge.personnalise === false);

// ── ⑤ 🔴🔴 LA PLACE DU DÉPÔT DANS `dataset.mjs` ───────────────────────────
console.log('\n⑤ la place du dépôt — le seul contrôle qu\'aucun autre banc ne fait');
const ds = decape(readFileSync(join(ROOT, 'engine', 'lib', 'dataset.mjs'), 'utf8'));
const iDepot = ds.indexOf('deposerSetsMcp(');
const iProj = ds.indexOf('projeterCote(items)');
verifie('les deux appels existent dans le CODE (et pas seulement dans la prose)',
  iDepot > 0 && iProj > 0, `depot@${iDepot} · projeterCote@${iProj}`);
verifie('🔴 `deposerSetsMcp()` vient AVANT `projeterCote()` — sinon il somme des `undefined`',
  iDepot > 0 && iProj > 0 && iDepot < iProj,
  iDepot < iProj ? 'ordre correct' : 'DÉPÔT TOMBÉ SOUS LA PROJECTION');

// ── ⑥ LE FICHIER N'EST DANS AUCUN DES DEUX DOSSIERS BALAYÉS ───────────────
console.log('\n⑥ l\'emplacement de la réserve');
const chemin = SETS_MCP_FICHIER.replace(/\\/g, '/');
verifie('il vit dans `.reserve/`, HORS de `cote/` (vidé par projeter()) et hors de `analytics/` (rmSync au build:done)',
  chemin.includes('/.reserve/')
  && !chemin.includes('/.reserve/cote/') && !chemin.includes('/.reserve/analytics/'),
  chemin);

// ── ⑦ LA ROUTE TRIE LE CORPUS AVANT DE LE COUPER ──────────────────────────
console.log('\n⑦ la route');
const rt = decape(readFileSync(join(ROOT, 'src', 'pages', 'api', 'analytics', '[module].js'), 'utf8'));
const iClasse = rt.indexOf('classerSets(tous');
const iCoupe = rt.indexOf('.slice(0, n)');
verifie('🔴 elle CLASSE le corpus entier AVANT de couper — l\'inverse rendrait « les 50 premiers du fichier, triés »',
  iClasse > 0 && iCoupe > 0 && iClasse < iCoupe, `classe@${iClasse} · coupe@${iCoupe}`);
verifie('le module est derrière une porte, et ce n\'est pas `visitor`',
  /sets_mcp:\s*\{[^}]*gate:\s*'modules'/.test(rt),
  rt.includes('sets_mcp:') ? 'déclaré' : 'ABSENT de MODULES');
verifie('la réponse rend `total`, `rendus` et `tronque` — le dénominateur voyage avec la tranche',
  rt.includes('rendus:') && rt.includes('tronque:'));

// ── ⑧ L'AFFICHAGE — BRANCHÉ, ÉTIQUETÉ, ET SANS CLASSE NEUVE ──────────────
console.log('\n⑧ l\'affichage');
const AS = readFileSync(join(ROOT, 'src', 'components', 'pages', 'AnalyticsSujet.astro'), 'utf8');
const ASnu = decape(AS);
// 🧩 UN FICHIER DÉPOSÉ N'EST PAS BRANCHÉ. La réserve peut être écrite, la
// route servir, et la page ne rien demander — trois pièces justes, zéro
// affichage, et aucun rouge nulle part.
verifie('🔴 le module est BRANCHÉ dans le sujet `collections` (réserve + route ne suffisent pas)',
  /collections:\s*\{[\s\S]{0,400}?cible:\s*'sets_mcp'/.test(ASnu),
  ASnu.includes("'sets_mcp'") ? 'déclaré' : 'ABSENT de SUJETS.collections.led');
verifie('… et il a une fonction de rendu du même nom que son `id`',
  /\bsets:\s*function\s*\(d\)/.test(ASnu),
  'sans elle, `rendus[cle]` est `undefined` et la section reste au verrou, EN SILENCE');
// ⭐⭐ L'ÉTIQUETTE EST UN LIVRABLE, PAS UN ORNEMENT : sans elle le tableau
// promet un revenu qu'on ne tient pas.
verifie('🔑 l\'étiquette `led.sets.note` est passée au script ET rendue',
  /sNote:\s*t\(lang, 'led\.sets\.note'\)/.test(ASnu) && /ech\(L\.sNote\)/.test(ASnu));
// ⛔ Un zéro à la place d'un tiret dirait « ce set est gratuit ».
verifie('⛔ un chiffre absent rend un TIRET, jamais un zéro',
  /v == null \? '—'/.test(ASnu));

// 🎨 AUCUNE CLASSE NEUVE — le rework du design est en vol ailleurs.
{
  const bloc = (ASnu.match(/sets: function \(d\)[\s\S]*?\n    \},/) || [''])[0];
  const classes = [...bloc.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  const connues = ['etiq', 'muted', 'tbl-hote'];
  const neuves = [...new Set(classes)].filter((c) => !connues.includes(c));
  verifie('🎨 le bloc n\'introduit AUCUNE classe neuve — le rework l\'emportera avec le reste',
    neuves.length === 0, neuves.length ? `🔴 ${neuves.join(', ')}` : classes.join(' ') || 'aucune classe');
}

// ── ⑨ LES CLÉS i18n, DANS LES CINQ LANGUES ───────────────────────────────
console.log('\n⑨ les clés i18n');
// ⛔ `t()` retombe sur la CLÉ quand elle manque : une langue oubliée n'affiche
// pas un vide, elle affiche `led.sets.ratio` dans un en-tête de colonne.
const CLES = ['led.sets', 'led.sets.d', 'led.sets.set', 'led.sets.size',
              'led.sets.cost', 'led.sets.pts', 'led.sets.ratio', 'led.sets.note'];
for (const lg of ['en', 'fr', 'es', 'de', 'it']) {
  const dico = JSON.parse(readFileSync(join(ROOT, 'engine', 'i18n', `${lg}.json`), 'utf8'));
  const manquantes = CLES.filter((k) => !dico[k]);
  verifie(`${lg} : les ${CLES.length} clés du module existent`,
    manquantes.length === 0, manquantes.length ? `🔴 ${manquantes.join(', ')}` : 'toutes présentes');
  // ⭐ Et la note DIT les quatre choses qu'elle doit dire. Une étiquette qui
  //   rétrécit d'une traduction à l'autre promet plus dans une langue que dans
  //   l'autre — sur un chiffre d'argent, c'est le pire des écarts.
  const note = String(dico['led.sets.note'] || '');
  verifie(`${lg} : la note porte le 100, le 7 et le 30 % — les trois chiffres qui bornent la promesse`,
    note.includes('100') && note.includes('7') && note.includes('30'),
    `${note.length} car.`);
}


// ── ⑩ LA ROUTE, EXÉCUTÉE POUR DE VRAI ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE BLOC EXISTE PARCE QUE TOUT LE RESTE DE CE BANC ÉTAIT VERT PENDANT
// QUE LA PRODUCTION SERVAIT **1 SET SUR 3 194**. Le module pur était juste, le
// dépôt était au bon endroit, les cinq langues disaient la vérité — et la
// ROUTE, elle, n'avait jamais été appelée par personne.
//
// ⭐⭐ ET UN BANC QUI LIT LE TEXTE DE LA ROUTE NE L'AURAIT PAS VU NON PLUS : le
// fichier DIT `SETS_DEFAUT = 50`, en toutes lettres, et c'est lisible et faux.
// `searchParams.get()` rend `null` pour un paramètre absent, `Number(null)`
// vaut 0, `Number.isFinite(0)` est vrai — le défaut était INATTEIGNABLE.
// ⇒ **seul un banc qui EXÉCUTE pouvait mordre.** C'est le patron de
// `test_reserve.mjs`, qui importe `/api/historique/[uuid]` et l'appelle.
//
// 🧪 IL TOURNE DANS UN SOUS-PROCESSUS, et c'est délibéré : `SETS_MCP_FICHIER`
// est figé à l'import de `sets_mcp.mjs`, déjà chargé en tête de ce banc. Poser
// `RESERVE_SETS_MCP` ici n'aurait plus aucun effet, et écrire dans la vraie
// `.reserve/` polluerait les bancs qui suivent. Un process neuf coûte 0,2 s et
// ne laisse rien derrière lui.
//
// 🔬 JUGÉ EN LUI INJECTANT LE MAUVAIS CODE (05/09/2026) : garde-fou retiré de
// `entierBorne` ⇒ ROUGE sur « absent » et sur les trois vides ; `trim()` retiré
// ⇒ ROUGE sur la seule ligne des espaces ; plafond ignoré ⇒ ROUGE sur 99999.
console.log('\n⑩ la route /api/analytics/sets_mcp — EXÉCUTÉE, pas relue');
{
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');

  // ⭐ LA CHARGE D'ESSAI DOIT ÊTRE PLUS GRANDE QUE LE PLAFOND. Avec 60 sets,
  //   « sans n » et « n=99999 » rendraient le même nombre : le banc serait vert
  //   sans distinguer le défaut du plafond. On en met franchement plus.
  const boite = mkdtempSync(join(tmpdir(), 'banc-sets-'));
  const reserve = join(boite, 'sets_mcp.json');
  const faux = { calcule: new Date().toISOString(), total: 500, classables: 500,
    personnalise: false, baremeSetMax: SET_POINTS_MAX,
    sets: Array.from({ length: 500 }, (_, i) => ({
      slug: 's' + i, nom: 'Set ' + i, marque: 'M', licence: 'L', taille: 1,
      cout: i + 1, couvert: 1, bonusSet: 1, pointsPieces: 1, sansBareme: 0,
      points: 2, usdParMcp: (i + 1) / 2 })) };
  writeFileSync(reserve, JSON.stringify(faux), 'utf8');

  // ⛔ PAS DE TEMPLATE LITTÉRAL DANS CE CODE INJECTÉ : il traverse un argument
  //    de ligne de commande, et un `$` y aurait deux lecteurs.
  const CODE = [
    "import { pathToFileURL } from 'node:url';",
    "import { join } from 'node:path';",
    "const R = process.env.PROJECT_ROOT;",
    "const url = (f) => pathToFileURL(join(R, f)).href;",
    "const route = await import(url('src/pages/api/analytics/[module].js'));",
    "const acces = await import(url('engine/lib/access.mjs'));",
    // ⭐⭐ LE PALIER SE LIT DANS LE MANIFESTE, IL NE S'ÉCRIT PAS ICI. vevewiki
    //    déclare un seul palier : la porte y est INACTIVE et tout le monde
    //    franchit. Un banc qui coderait `member` en dur casserait le build de
    //    l'autre site sur un moteur parfaitement sain — c'est déjà arrivé le
    //    02/08 avec `test_reserve`, et c'est écrit là-bas en toutes lettres.
    "const P = acces.porte('modules');",
    "const locals = P.actif ? { palier: P.tier } : {};",
    "const appel = async (q) => {",
    "  const r = await route.GET({ params: { module: 'sets_mcp' },",
    "    request: new Request('https://banc.test/api/analytics/sets_mcp' + q), locals });",
    "  const t = await r.text();",
    "  let j = null; try { j = JSON.parse(t); } catch (e) { j = null; }",
    "  return { status: r.status, rendus: j && j.rendus,",
    "           lignes: j && Array.isArray(j.sets) ? j.sets.length : null,",
    "           tri: j && j.tri, corps: t.slice(0, 120) };",
    "};",
    "const out = { defaut: route.SETS_DEFAUT, max: route.SETS_MAX, porte: P.actif ? P.tier : 'inactive' };",
    "for (const q of ['', '?n=', '?n=%20%20', '?n=10', '?n=abc', '?n=-5', '?n=99999'])",
    "  out[q === '' ? 'absent' : q] = await appel(q);",
    "console.log(JSON.stringify(out));",
  ].join('\n');

  let R = null; let erreur = '';
  try {
    const brut = execFileSync(process.execPath, ['--input-type=module', '-e', CODE],
      { cwd: ROOT, encoding: 'utf8', timeout: 30000,
        env: { ...process.env, PROJECT_ROOT: ROOT, RESERVE_SETS_MCP: reserve } });
    R = JSON.parse(brut.trim().split('\n').pop());
  } catch (e) {
    erreur = String(e.stderr || e.message).split('\n').slice(-4).join(' | ');
  }

  // 🔴 UN BANC QUI N'A RIEN PU INSPECTER N'A RIEN PROUVÉ. S'il n'a pas tourné,
  //    il rougit — il ne se tait pas.
  verifie('la route se charge et répond', R !== null, erreur || `porte : ${R && R.porte}`);

  if (R) {
    verifie('elle rend 200 au palier que le manifeste exige',
      R.absent.status === 200, `status ${R.absent.status} — ${R.absent.corps}`);

    // ⭐⭐⭐ LE CONTRÔLE QUI AURAIT ÉVITÉ LE DÉFAUT. `rendus` est comparé à la
    //   constante EXPORTÉE par la route, jamais à un 50 recopié ici.
    verifie('🎯 SANS `n`, elle rend LE DÉFAUT — pas 1, pas 0',
      R.absent.rendus === R.defaut && R.absent.lignes === R.defaut,
      `rendus=${R.absent.rendus} lignes=${R.absent.lignes} · défaut déclaré=${R.defaut}`);

    // 🕳️ Les trois façons d'écrire « rien », qui valent toutes 0 une fois
    //    converties. La troisième (des espaces) est la seule que `trim()` sauve.
    for (const [q, nom] of [['?n=', '`n` présent mais VIDE'], ['?n=%20%20', '`n` fait de deux ESPACES'],
                            ['?n=abc', '`n` illisible']]) {
      verifie(`${nom} ⇒ le défaut, jamais 1`,
        R[q] && R[q].rendus === R.defaut, `rendus=${R[q] && R[q].rendus}`);
    }

    verifie('une valeur explicite est respectée (`n=10`)',
      R['?n=10'].rendus === 10, `rendus=${R['?n=10'].rendus}`);
    verifie('un `n` négatif ne rend pas une tranche vide (il est remonté au minimum)',
      R['?n=-5'].rendus >= 1, `rendus=${R['?n=-5'].rendus}`);
    // ⭐ Le plafond protège une route `private, no-store` : chaque octet est
    //   repayé à chaque visite. Il doit mordre AVANT que la charge parte.
    verifie('un `n` démesuré est PLAFONNÉ au maximum déclaré',
      R['?n=99999'].rendus === R.max && R['?n=99999'].lignes === R.max,
      `rendus=${R['?n=99999'].rendus} · plafond déclaré=${R.max}`);
    verifie('le défaut déclaré est strictement sous le plafond — sinon rien ne distingue les deux',
      R.defaut < R.max, `${R.defaut} < ${R.max}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏪 §M — LE SECOND MARCHÉ, ET L'UNITÉ QUI ÉTAIT FAUSSE
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE QUE CE § FERME EN PREMIER, ET ÇA N'EST PAS UN CALCUL : **UN NOM.**
// Le champ s'appelait `gemsParMcp`, le commentaire affirmait « `cout` EST EN
// GEMS », et les cinq dictionnaires servaient l'en-tête « gems / MCP ».
// 🔬 MESURÉ LE 08/09/2026 SUR `/market/` SERVI : la colonne du site s'appelle
// **`$/MCP`** et rend `55` pour un plancher de `330` et `6.00 MCP` — soit
// `330 / 6`, au centième. Le mot « GEMS » n'apparaît **pas une fois** sur la
// page. Le même quotient portait donc deux unités selon l'endroit où on le
// lisait, et l'une des deux était fausse.
// ⭐⭐⭐ **UN NOM FAUX VOYAGE PLUS LOIN QU'UN COMMENTAIRE FAUX** : celui-ci
// partait dans `.reserve/sets_mcp.json`, dans la route publique, dans le
// tableau servi et dans cinq langues. Un commentaire se lit une fois ; un nom
// se lit à chaque usage, et il finit par convertir.
// ⇒ Ce § interdit au libellé de reparler de gems, DANS LES CINQ LANGUES — et
//   il ne juge pas le champ par son nom (qu'on peut renommer) mais par ce que
//   l'utilisateur LIT.
console.log('\n⑪ le second marché, et l\'unité');
{
  const I18N = join(ROOT, 'engine', 'i18n');
  const langues = ['en', 'fr', 'es', 'de', 'it'];
  const fautifs = [];
  for (const lg of langues) {
    const d = JSON.parse(readFileSync(join(I18N, `${lg}.json`), 'utf8'));
    const r = String(d['led.sets.ratio'] ?? '');
    const rs = String(d['led.sets.ratioS'] ?? '');
    if (/gem/i.test(r) || /gem/i.test(rs)) fautifs.push(`${lg} : « ${r} » / « ${rs} »`);
    if (!r || !rs) fautifs.push(`${lg} : clé manquante (ratio=« ${r} » ratioS=« ${rs} »)`);
  }
  verifie('aucun en-tête ne parle de « gems » — le site écrit $/MCP',
    fautifs.length === 0,
    fautifs.length === 0 ? `${langues.length} langues relues` : fautifs.join(' · '));

  // ── LES DEUX MARCHÉS SONT INDÉPENDANTS ────────────────────────────────────
  // ⭐⭐ LA VRAIE QUESTION DE CE § : un trou chez StackR ne doit PAS effacer le
  // ratio VeVe. Un compteur de couverture partagé entre les deux marchés ferait
  // exactement ça — et le symptôme serait « moins de sets classables », c'est-à-
  // dire un chiffre qui rétrécit sans erreur. On l'exerce dans les deux sens.
  const p2 = (floor, stackr, rarity = 'COMMON', type = 'collectible') =>
    ({ floor, floorStackrUsd: stackr, rarity, type });
  const set2 = (items) => ({ slug: 's', name: 'S', brand: '', licensor: '', items });

  const deux = agregerSet(set2([p2(100, 80), p2(50, 40, 'RARE')]));
  verifie('les deux marchés se calculent, chacun sur SA somme',
    deux.cout === 150 && deux.coutStackr === 120
      && deux.usdParMcp === 150 / 4.25 && deux.stackrParMcp === 120 / 4.25,
    `veve=${deux.cout}/${deux.usdParMcp} · stackr=${deux.coutStackr}/${deux.stackrParMcp}`);

  const trouStackr = agregerSet(set2([p2(100, 80), p2(50, null, 'RARE')]));
  verifie('🎯 un trou chez StackR n\'efface PAS le ratio VeVe',
    trouStackr.usdParMcp === 150 / 4.25 && trouStackr.stackrParMcp === null
      && trouStackr.couvert === 2 && trouStackr.couvertStackr === 1,
    `veve=${trouStackr.usdParMcp} stackr=${trouStackr.stackrParMcp}`
      + ` · couvert ${trouStackr.couvert}/${trouStackr.couvertStackr}`);

  const trouVeve = agregerSet(set2([p2(100, 80), p2(null, 40, 'RARE')]));
  verifie('… et réciproquement : un trou chez VeVe n\'efface pas celui de StackR',
    trouVeve.usdParMcp === null && trouVeve.stackrParMcp === 120 / 4.25,
    `veve=${trouVeve.usdParMcp} stackr=${trouVeve.stackrParMcp}`);

  // ⛔ MÊME REFUS QUE LE MARCHÉ VeVe : un set à moitié coté n'a pas de ratio.
  verifie('REFUS ① s\'applique aussi à StackR : 1 pièce cotée sur 2 ⇒ pas de ratio',
    agregerSet(set2([p2(100, 80), p2(50, 0, 'RARE')])).stackrParMcp === null,
    'un plancher à 0 ne compte pas comme coté');

  // ── LES TRIS DU SECOND MARCHÉ ─────────────────────────────────────────────
  const corpus2 = [
    { nom: 'cher', stackrParMcp: 900, usdParMcp: 1, points: 5, cout: 900, taille: 1 },
    { nom: 'muet', stackrParMcp: null, usdParMcp: 2, points: null, cout: null, taille: 2 },
    { nom: 'bon', stackrParMcp: 10, usdParMcp: 3, points: 9, cout: 90, taille: 3 },
  ];
  verifie('`spm-asc` classe sur StackR, le muet en dernier',
    classerSets(corpus2, 'spm-asc').map((a) => a.nom).join(',') === 'bon,cher,muet',
    classerSets(corpus2, 'spm-asc').map((a) => a.nom).join(','));
  verifie('`spm-desc` inverse, et le muet reste en dernier',
    classerSets(corpus2, 'spm-desc').map((a) => a.nom).join(',') === 'cher,bon,muet',
    classerSets(corpus2, 'spm-desc').map((a) => a.nom).join(','));
  // ⭐⭐ CONTRE-ÉPREUVE : les deux tris ne doivent pas rendre la MÊME chose,
  // sinon `spm-asc` pourrait n'être qu'un alias silencieux de `gpm-asc` et ce §
  // serait vert sur un tri qui n'existe pas. Le corpus est fabriqué pour que les
  // deux ordres DIVERGENT — sans ça, on mesurerait une coïncidence.
  verifie('🎯 et il ne classe pas comme `gpm-asc` — sinon ce serait un alias muet',
    classerSets(corpus2, 'spm-asc').map((a) => a.nom).join(',')
      !== classerSets(corpus2, 'gpm-asc').map((a) => a.nom).join(','),
    `spm : ${classerSets(corpus2, 'spm-asc').map((a) => a.nom).join(',')}`
      + ` · gpm : ${classerSets(corpus2, 'gpm-asc').map((a) => a.nom).join(',')}`);

  verifie('les deux clés sont déclarées dans TRIS_SETS, pas recopiées ailleurs',
    TRIS_SETS.includes('spm-asc') && TRIS_SETS.includes('spm-desc'),
    TRIS_SETS.join(' '));
}


// ═══════════════════════════════════════════════════════════════════════════
// ── ⑦ LOT N — UN SET = UN `series_uuid` (engine/lib/sets.mjs) ─────────────
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Le module est PUR : on lui donne des pièces, il rend des sets. Le banc
//   fabrique donc les cas que la prod a montrés le 08/09 (réimpression sous
//   la même adresse, homonymes, pièce dont la `series` diverge) et lit ce
//   qui sort. `slugify` est recopié ici à l'identique plutôt qu'importé de
//   `dataset.mjs` (l'importer vide `.reserve/cote/`, voir l'en-tête).
{
  console.log('\n⑦ LOT N — un set = un `series_uuid`, les adresses survivent');
  const { exigerColonneSets, construireSets, cleHeritee, uuid8, ORPHELINS_MAX } = await import('../lib/sets.mjs');
  const { jourISO } = await import('../lib/vitrine.mjs');
  const slugify = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
  const outils = { slugify, jourISO };
  const U = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const piece = (o) => ({ uuid: o.uuid || `${o.seriesUuid}-${o.rarity}`, type: o.type || 'comic', series: o.series,
    edition_type: o.edition_type ?? '1', name: o.name, seriesUuid: o.seriesUuid, releaseDate: o.releaseDate, rarity: o.rarity || 'COMMON' });
  const RARETES = ['COMMON', 'UNCOMMON', 'RARE', 'ULTRA_RARE', 'SECRET_RARE'];
  const setDe = (n, o) => RARETES.slice(0, n).map((r) => piece({ ...o, rarity: r }));

  // la porte
  let leve = null;
  try { exigerColonneSets([{ uuid: 'a', series: 'S' }]); } catch (e) { leve = e; }
  verifie('🚪 la porte LÈVE quand l\'en-tête n\'a pas `series_uuid`',
    !!leve && /series_uuid/.test(leve.message), leve ? leve.message.slice(0, 70) : '🔴 rien levé');
  let calme = true;
  try { exigerColonneSets([{ uuid: 'a', series: 'S', series_uuid: '' }]); exigerColonneSets([]); } catch { calme = false; }
  verifie('…et reste muette sur une colonne présente (même vide) ou un catalogue vide', calme);

  // le cas de la prod : Red Sonja: Noir #1, éditions 2025 et 2026 sous UNE adresse
  const rs25 = setDe(5, { series: 'Red Sonja: Noir', name: 'Red Sonja: Noir #1 (2025)', seriesUuid: U(1), releaseDate: '16/07/2025' });
  const rs26 = setDe(4, { series: 'Red Sonja: Noir', name: 'Red Sonja: Noir #1 (2026)', seriesUuid: U(2), releaseDate: '01/07/2026' });
  const { collections: c1, stats: s1 } = construireSets([...rs26, ...rs25], outils);
  verifie('une adresse qui mêlait 2 sets ÉCLATE en 2 pages',
    c1.size === 2 && s1.groupesEclates === 1, `${c1.size} set(s), ${s1.groupesEclates} groupe(s) éclaté(s)`);
  verifie('l\'AÎNÉ (sortie la plus ancienne) GARDE l\'ancienne adresse — aucune ancienne adresse ne meurt',
    c1.get('red-sonja-noir-1')?.seriesUuid === U(1) && c1.get('red-sonja-noir-1')?.items.length === 5,
    `red-sonja-noir-1 → ${c1.get('red-sonja-noir-1')?.name || '∅'}`);
  verifie('le cadet reçoit l\'adresse de son NOM (elle était libre)',
    c1.get('red-sonja-noir-1-2026')?.seriesUuid === U(2), [...c1.keys()].join(' '));
  verifie('`colSlug` est posé sur CHAQUE pièce, par le module (leçon du lot 102)',
    rs25.every((i) => i.colSlug === 'red-sonja-noir-1') && rs26.every((i) => i.colSlug === 'red-sonja-noir-1-2026'));
  verifie('le nom d\'un set de comics est celui de ses pièces (l\'année y est), pas la série',
    c1.get('red-sonja-noir-1').name === 'Red Sonja: Noir #1 (2025)', c1.get('red-sonja-noir-1').name);

  // stabilité : l'ordre d'entrée ne change rien
  const bis = [...rs25, ...rs26].map((i) => ({ ...i, colSlug: undefined }));
  const { collections: c1b } = construireSets(bis.reverse(), outils);
  verifie('les adresses ne dépendent PAS de l\'ordre des pièces (deux passes, mêmes slugs)',
    [...c1b.keys()].sort().join() === [...c1.keys()].sort().join()
      && c1b.get('red-sonja-noir-1').seriesUuid === U(1));

  // le nom est PRIS → 8 hex ; et un nom ne vole jamais l'adresse d'un autre groupe
  const sn1 = setDe(5, { series: 'Supernatural', name: 'Supernatural #1 (2025)', seriesUuid: U(3), releaseDate: '29/10/2025' });
  const sn2 = setDe(5, { series: 'Supernatural', name: 'Supernatural #1 (2025)', seriesUuid: U(4), releaseDate: '04/02/2026' });
  const sn3 = setDe(5, { series: 'Supernatural', name: 'Supernatural #1 (2025)', seriesUuid: U(5), releaseDate: '04/02/2026' });
  // un set d'un AUTRE groupe dont le nom vaut exactement un ancien slug
  const voleur = setDe(2, { series: 'Autre', edition_type: '9', name: 'Supernatural #1', seriesUuid: U(6), releaseDate: '01/01/2020' });
  const autre = setDe(3, { series: 'Autre', edition_type: '9', name: 'Autre #9', seriesUuid: U(7), releaseDate: '01/01/2019' });
  const { collections: c2, stats: s2 } = construireSets([...sn1, ...sn2, ...sn3, ...voleur, ...autre], outils);
  verifie('deux homonymes de plus : le 2ᵉ prend l\'adresse de son nom (`-2025`, libre), le 3ᵉ la trouve PRISE et prend `<ancien>-<8 hex>`',
    c2.get('supernatural-1')?.seriesUuid === U(3) && c2.get('supernatural-1-2025')?.seriesUuid === U(4)
      && c2.get(`supernatural-1-${uuid8(U(5))}`)?.seriesUuid === U(5),
    [...c2.keys()].join(' '));
  verifie('un set dont le NOM vaut l\'ancienne adresse d\'un autre groupe ne la VOLE pas (réservée d\'abord)',
    c2.get('supernatural-1')?.seriesUuid === U(3) && !c2.get('autre-9') === false && c2.get('autre-9').seriesUuid === U(7)
      && [...c2.values()].find((c) => c.seriesUuid === U(6))?.slug === `autre-9-${uuid8(U(6))}`,
    [...c2.values()].map((c) => `${c.slug}=${c.seriesUuid.slice(0, 8)}`).join(' '));
  verifie('trois sets au même nom rendent trois NOMS distincts (jour de sortie, puis 8 hex)',
    new Set([...c2.values()].map((c) => c.name)).size === c2.size && s2.nomsDesambigues >= 2,
    [...c2.values()].map((c) => c.name).join(' | '));

  // deux cadets de deux GROUPES veulent le même slug de nom : le plus ANCIEN l'a, quel que soit l'ordre des groupes
  const gA1 = setDe(2, { series: 'Zed', edition_type: '1', name: 'Zed #1', seriesUuid: U(20), releaseDate: '01/01/2020' });
  const gA2 = setDe(2, { series: 'Zed', edition_type: '1', name: 'Zed #1 (2024)', seriesUuid: U(21), releaseDate: '01/01/2024' });   // cadet du groupe `zed-1`, jeune
  const gB1 = setDe(2, { series: 'Zed', edition_type: '2', name: 'Zed #2', seriesUuid: U(22), releaseDate: '01/01/2020' });
  const gB2 = setDe(2, { series: 'Zed', edition_type: '2', name: 'Zed #1 (2024)', seriesUuid: U(23), releaseDate: '01/01/2022' });   // cadet du groupe `zed-2`, PLUS ANCIEN, même nom voulu
  const { collections: c5 } = construireSets([...gA1, ...gA2, ...gB1, ...gB2], outils);
  verifie('deux cadets de deux groupes veulent `zed-1-2024` : le plus ANCIEN l\'obtient (pas le premier groupe dans l\'ordre), l\'autre prend 8 hex',
    c5.get('zed-1-2024')?.seriesUuid === U(23) && c5.get(`zed-1-${uuid8(U(21))}`)?.seriesUuid === U(21),
    [...c5.values()].map((c) => `${c.slug}=${c.seriesUuid.slice(6, 8)}`).join(' '));

  // alias : une pièce dont la `series` diverge rejoint son set, son ancienne adresse survit
  const ff = setDe(4, { series: 'Fantastic Four', edition_type: '13', name: 'Fantastic Four #13 (2025)', seriesUuid: U(8), releaseDate: '01/03/2025' });
  const egaree = piece({ series: 'Fantastic Four Vol. 8', edition_type: '13', name: 'Fantastic Four #13 (2025)', seriesUuid: U(8), releaseDate: '01/03/2025', rarity: 'SECRET_RARE' });
  const { collections: c3, stats: s3 } = construireSets([...ff, egaree], outils);
  verifie('la pièce égarée rejoint son set (5 pièces, une page)',
    c3.size === 1 && c3.get('fantastic-four-13')?.items.length === 5, `${c3.size} set(s)`);
  verifie('…et son ancienne adresse devient un ALIAS du set (servie, canonical vers la vraie page)',
    c3.get('fantastic-four-13')?.alias.join() === 'fantastic-four-vol-8-13' && s3.alias === 1,
    `alias : ${c3.get('fantastic-four-13')?.alias.join(' ') || '∅'}`);

  // orphelins : tolérés et COMPTÉS, rangés derniers ; au-delà du seuil, refus
  const orphelin = piece({ series: 'Red Sonja: Noir', name: 'Red Sonja: Noir #1 (2024)', seriesUuid: '', releaseDate: '01/01/2024', rarity: 'RARE', uuid: 'orph' });
  // ⚠️ 1 orpheline sur 11 pièces = 9 % : SOUS le seuil, sinon c'est le refus qu'on mesure
  const { collections: c4, stats: s4 } = construireSets([orphelin, ...rs25.map((i) => ({ ...i })), ...sn1.map((i) => ({ ...i }))], outils);
  verifie('une pièce SANS clé forme un set orphelin, compté, et ne prend PAS l\'ancienne adresse d\'un vrai set (même plus ancienne)',
    s4.orphelins === 1 && s4.setsOrphelins === 1 && c4.get('red-sonja-noir-1')?.seriesUuid === U(1)
      && [...c4.values()].find((c) => c.orphelin)?.slug !== 'red-sonja-noir-1',
    `orphelins ${s4.orphelins} · ${[...c4.keys()].join(' ')}`);
  let refus = null;
  try { construireSets([orphelin, piece({ series: 'X', name: 'X #1', seriesUuid: '', releaseDate: '', uuid: 'o2' })], outils); } catch (e) { refus = e; }
  verifie(`au-delà de ${100 * ORPHELINS_MAX} % de pièces sans clé, le module REFUSE (colonne vide déguisée en présente)`,
    !!refus && /series_uuid/.test(refus.message), refus ? refus.message.slice(0, 60) : '🔴 accepté');
  verifie('`cleHeritee` rend toujours l\'ancienne clé du lot 71 — c\'est l\'histoire des adresses',
    cleHeritee({ type: 'comic', series: 'S', edition_type: '3' }) === 'S #3'
      && cleHeritee({ type: 'comic', series: 'S', edition_type: '' }) === 'S'
      && cleHeritee({ type: 'collectible', series: 'S', edition_type: '3' }) === 'S');

  // LA POPULATION : le set entier (`pieces`), pas ses seules pages (`items`)
  // 🔬 127 des 200 premiers sets se calculaient sur 1 page pour 5 pièces (08/09).
  const publiee = { floor: 100, rarity: 'COMMON', type: 'comic', path: '/x/' };
  const sansPage = (f, r) => ({ floor: f, rarity: r, type: 'comic', path: null });
  const partiel = agregerSet({ slug: 'p', name: 'P', items: [publiee] });
  const entier = agregerSet({ slug: 'p', name: 'P', items: [publiee],
    pieces: [publiee, sansPage(50, 'UNCOMMON'), sansPage(200, 'RARE'), sansPage(400, 'ULTRA_RARE'), sansPage(900, 'SECRET_RARE')] });
  verifie('🎯 `agregerSet` compte TOUTES les pièces du set (`pieces`), pas seulement celles qui ont une page',
    entier.taille === 5 && entier.cout === 1650 && entier.bonusSet === 5 && partiel.taille === 1,
    `entier : ${entier.taille} p, ${entier.cout} $, bonus ${entier.bonusSet} · sans \`pieces\` : ${partiel.taille} p`);
  verifie('…et un set dont une pièce SANS page n\'a pas de plancher n\'a PAS de ratio (refus ① sur la population entière)',
    agregerSet({ slug: 'q', name: 'Q', items: [publiee], pieces: [publiee, sansPage(null, 'RARE')] }).usdParMcp === null);

  // BRANCHÉ : le moteur appelle la porte AVANT de bâtir, et n'a plus sa propre clé
  const DS = readFileSync(join(ROOT, 'engine', 'lib', 'dataset.mjs'), 'utf8');
  const DSnu = DS.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  const iPorte = DSnu.indexOf('exigerColonneSets(cat)');
  const iBatir = DSnu.indexOf('construireSets(pieces');
  verifie('🔌 `dataset.mjs` passe la PORTE puis bâtit les sets par `construireSets()` — et plus par une clé à lui',
    iPorte > 0 && iBatir > iPorte && !/const cleSet\s*=/.test(DSnu) && /seriesUuid:\s*String\(c\.series_uuid/.test(DSnu),
    `porte@${iPorte} bâtir@${iBatir} cleSet ${/const cleSet\s*=/.test(DSnu) ? 'ENCORE LÀ' : 'retirée'}`);
  verifie('🔌 …sur le CATALOGUE ENTIER (`construireSets(pieces`, bâties depuis `cat`), et le classement reçoit TOUS les sets (`deposerSetsMcp(setsTous)`)',
    /construireSets\(pieces,/.test(DSnu) && /for \(const c of cat\)[\s\S]{0,400}parUuidPublie\.get\(uuid\)/.test(DSnu)
      && /deposerSetsMcp\(setsTous\)/.test(DSnu),
    `pieces ${/construireSets\(pieces,/.test(DSnu) ? 'oui' : 'NON'} · setsTous ${/deposerSetsMcp\(setsTous\)/.test(DSnu) ? 'oui' : 'NON'}`);
  verifie('🔌 …et une ancienne adresse dont l\'aîné n\'a pas de page reste SERVIE, en alias du plus ancien set servi du groupe (`aliasMigres`)',
    /aliasMigres\+\+/.test(DSnu) && /c\.rang === 0/.test(DSnu) && /cible\.alias\.push\(c\.slug\)/.test(DSnu));
  verifie('🔒 …et les planchers des pièces sans page sont EFFACÉS après le dépôt, comme `projeterCote()` efface ceux des fiches',
    // ⚠️ `delete x.floor;` AVEC son point-virgule : `delete x.floorStackrUsd` contient
    //    la même chaîne, et ma première version de ce § restait verte sans le plancher
    //    VeVe effacé — une injection qui ne mord pas accuse le banc (08/09).
    (() => { const a = DSnu.indexOf('deposerSetsMcp(setsTous)'); const b = DSnu.indexOf('delete x.floor;');
             const c = DSnu.indexOf('delete x.floorStackrUsd;'); return a > 0 && b > a && c > a; })());
  // et l'ÉCHANTILLON porte la forme du réel : une colonne, un groupe éclaté, un alias, un orphelin
  const { parseCSV } = await import('../data/warehouse.mjs');
  const ech = parseCSV(readFileSync(join(ROOT, 'engine', 'data', 'sample', 'catalogue.csv'), 'utf8'));
  let echOk = false, echStats = null;
  try {
    exigerColonneSets(ech);
    const its = ech.map((c) => ({ uuid: c.uuid, type: /comic/i.test(c.kind) ? 'comic' : 'collectible', series: c.series,
      edition_type: c.edition_type, name: c.name, seriesUuid: c.series_uuid, releaseDate: c.release_date }));
    echStats = construireSets(its, outils).stats;
    echOk = echStats.groupesEclates >= 1 && echStats.slugsUuid >= 1 && echStats.alias >= 1 && echStats.orphelins >= 1;
  } catch (e) { echStats = e.message; }
  verifie('🧪 l\'échantillon hors ligne EXERCE les quatre chemins (éclatement, 8 hex, alias, orphelin) — sinon la CI est verte sur du vide',
    echOk, typeof echStats === 'string' ? echStats.slice(0, 80) : JSON.stringify(echStats));
  // …et il porte des pièces SANS page (absentes de prices.csv) : un set partiel ET un set fantôme
  const prix = readFileSync(join(ROOT, 'engine', 'data', 'sample', 'prices.csv'), 'utf8');
  const sansHistorique = ech.filter((c) => !prix.includes(c.uuid));
  const setsSansHist = new Set(sansHistorique.map((c) => c.series_uuid));
  const setsAvecHist = new Set(ech.filter((c) => prix.includes(c.uuid)).map((c) => c.series_uuid));
  verifie('🧪 …et des pièces SANS historique de prix : au moins un set PARTIEL et un set entièrement sans page',
    sansHistorique.length >= 3 && [...setsSansHist].some((u) => setsAvecHist.has(u)) && [...setsSansHist].some((u) => !setsAvecHist.has(u)),
    `${sansHistorique.length} pièce(s) hors prices.csv dans ${setsSansHist.size} set(s)`);
  // …et un groupe dont l'AÎNÉ (le plus ancien set) n'a aucune page pendant qu'un cadet en a
  const parLegacy = new Map();
  for (const c of ech) {
    const k = slugify(cleHeritee({ type: /comic/i.test(c.kind) ? 'comic' : 'collectible', series: c.series, edition_type: c.edition_type }));
    if (!parLegacy.has(k)) parLegacy.set(k, new Map());
    const g = parLegacy.get(k);
    if (!g.has(c.series_uuid)) g.set(c.series_uuid, { sortie: jourISO(c.release_date), page: false });
    const e = g.get(c.series_uuid);
    if (jourISO(c.release_date) < e.sortie) e.sortie = jourISO(c.release_date);
    if (prix.includes(c.uuid)) e.page = true;
  }
  const aineSansPage = [...parLegacy.values()].some((g) => {
    const l = [...g.values()].sort((a, b) => a.sortie.localeCompare(b.sortie));
    return l.length > 1 && !l[0].page && l.some((x) => x.page);
  });
  verifie('🧪 …et un groupe dont l\'AÎNÉ n\'a pas de page pendant qu\'un cadet en a (l\'ancienne adresse doit rester servie)',
    aineSansPage);
}


// ═══════════════════════════════════════════════════════════════════════════
// ── ⑧ LOT N ⑪ — LE CLASSEMENT VU D'UN PORTEFEUILLE ────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
{
  console.log('\n⑧ LOT N ⑪ — le classement vu d\'un portefeuille');
  const { personnaliser } = await import('../lib/sets_mcp.mjs');
  const P = (u, f, t = 'comic', r = 'COMMON') => ({ uuid: u, floor: f, floorStackrUsd: f ? f * 2 : null, rarity: r, type: t, path: '/x/' });
  // un set de 4 : A B C D — planchers 10 20 30 40 ; points comics C/U/R/UR
  const set4 = agregerSet({ slug: 'q', name: 'Q', items: [P('A', 10), P('B', 20, 'comic', 'UNCOMMON'), P('C', 30, 'comic', 'RARE'), P('D', 40, 'comic', 'ULTRA_RARE')] });
  verifie('`agregerSet` emporte ses pièces sous forme compacte [uuid, plancher, StackR $, points]',
    Array.isArray(set4.pieces) && set4.pieces.length === 4 && set4.pieces[0][0] === 'A' && set4.pieces[0][1] === 10
      && set4.pieces[0][2] === 20 && typeof set4.pieces[0][3] === 'number',
    JSON.stringify(set4.pieces[0]));

  const rien = personnaliser([set4], new Set());
  verifie('un portefeuille qui n\'a AUCUNE pièce du set ne change rien (mêmes coût, points, ratio)',
    rien.sets.length === 1 && rien.exclus === 0 && rien.sets[0].cout === set4.cout && rien.sets[0].points === set4.points
      && rien.sets[0].usdParMcp === set4.usdParMcp && rien.sets[0].possede === 0);

  const complet = personnaliser([set4], new Set(['A', 'B', 'C', 'D']));
  verifie('🎯 un set COMPLET est EXCLU du classement (le racheter ne vaut que 30 %)',
    complet.sets.length === 0 && complet.exclus === 1, `sets ${complet.sets.length} · exclus ${complet.exclus}`);

  const moitie = personnaliser([set4], new Set(['A', 'B']));
  const m = moitie.sets[0];
  const ptsManquants = set4.pieces[2][3] + set4.pieces[3][3];
  verifie('🎯 avec A et B en poche : coût = C + D (70 $), points gagnés = bonus de set + points de C et D',
    m.possede === 2 && m.cout === 70 && m.coutStackr === 140 && m.points === set4.bonusSet + ptsManquants
      && Math.abs(m.usdParMcp - 70 / (set4.bonusSet + ptsManquants)) < 1e-12,
    `possede ${m.possede} · cout ${m.cout} · points ${m.points} (bonus ${set4.bonusSet} + ${ptsManquants}) · ratio ${m.usdParMcp}`);
  verifie('…et le ratio personnalisé est PLUS BAS que celui de tout le monde (ce qui manque coûte moins que le tout)',
    m.usdParMcp < set4.usdParMcp, `${m.usdParMcp} < ${set4.usdParMcp}`);

  // refus ① sur les pièces MANQUANTES seulement
  const troue = agregerSet({ slug: 't', name: 'T', items: [P('A', 10), P('B', null, 'comic', 'RARE'), P('C', 30, 'comic', 'ULTRA_RARE')] });
  const p1 = personnaliser([troue], new Set(['B'])).sets[0];
  const p2 = personnaliser([troue], new Set(['A'])).sets[0];
  verifie('une pièce SANS plancher : si elle est DÉTENUE le ratio existe, si elle MANQUE il n\'existe pas (refus ①)',
    p1.usdParMcp !== null && p1.cout === 40 && p2.usdParMcp === null && p2.cout === null,
    `détenue → ${p1.usdParMcp} · manquante → ${p2.usdParMcp}`);
  verifie('les éditions ne comptent pas : une pièce détenue deux fois est détenue une fois (un Set, pas une liste)',
    personnaliser([set4], new Set(['A', 'A', 'B'])).sets[0].possede === 2);

  // BRANCHÉ : la route lit `?adresse=`, refuse 400 / 503, et ne laisse pas sortir `pieces`
  const ROUTE = readFileSync(join(ROOT, 'src', 'pages', 'api', 'analytics', '[module].js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  verifie('🔌 la route lit `adresse`, passe par `piecesDetenues()` + `personnaliser()`, refuse 400 (forme) et 503 (classeur absent)',
    /sp\.get\('adresse'\)/.test(ROUTE) && /piecesDetenues\(adresse\)/.test(ROUTE) && /personnaliser\(tous, det\)/.test(ROUTE)
      && /refus\(400, 'adresse'\)/.test(ROUTE) && /refus\(503, 'classeur'\)/.test(ROUTE));
  verifie('🔒 …et `pieces` (uuid + planchers de chaque pièce) ne sort JAMAIS de la route',
    /const \{ pieces, \.\.\.reste \} = a; return reste;/.test(ROUTE) && /\.map\(sansPieces\)/.test(ROUTE));
  const SER = readFileSync(join(ROOT, 'src', 'socle', 'modules', 'series.js'), 'utf8');
  verifie('🔌 le pilote de `/sets/` envoie l\'adresse de `#s-adresse` (bien formée seulement) et met le classement en cache PAR adresse',
    /getElementById\('s-adresse'\)|val\('s-adresse'\)/.test(SER) && /&adresse=/.test(SER) && /tri \+ '\|' \+ a\.toLowerCase\(\)/.test(SER)
      && /RANGS\[cleRangs\(tri\)\]/.test(SER));
  const COL = readFileSync(join(ROOT, 'src', 'components', 'pages', 'Collections.astro'), 'utf8');
  verifie('🔌 `/sets/` sert le champ `#s-adresse` DANS `#f-sets` (donc derrière `data-membre`, comme les tris MCP)',
    /id="s-adresse"/.test(COL) && COL.indexOf('id="s-adresse"') > COL.indexOf('id="f-sets"'));
  for (const l of ['en', 'fr', 'es', 'de', 'it']) {
    const d = JSON.parse(readFileSync(join(ROOT, 'engine', 'i18n', `${l}.json`), 'utf8'));
    verifie(`${l} : \`sets.wallet\` et \`sets.walletHelp\` existent et parlent d'un 0x`,
      typeof d['sets.wallet'] === 'string' && d['sets.wallet'].includes('0x') && typeof d['sets.walletHelp'] === 'string' && d['sets.walletHelp'].length > 40);
  }

  // EXÉCUTÉE : la route avec une réserve de classeur FABRIQUÉE
  const { execFileSync } = await import('node:child_process');
  const { writeFileSync, mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const boite = mkdtempSync(join(tmpdir(), 'banc-perso-'));
  const reserve = join(boite, 'sets_mcp.json');
  const A = '0xabcdef0123456789abcdef0123456789abcdef01';
  const charge = { calcule: new Date().toISOString(), total: 3, classables: 3, classablesStackr: 3, personnalise: false,
    baremeSetMax: SET_POINTS_MAX,
    sets: [
      agregerSet({ slug: 'complet', name: 'Complet', items: [P('A', 10), P('B', 20, 'comic', 'RARE')] }),
      agregerSet({ slug: 'moitie', name: 'Moitié', items: [P('C', 10), P('D', 1000, 'comic', 'RARE')] }),
      agregerSet({ slug: 'libre', name: 'Libre', items: [P('E', 100), P('F', 100, 'comic', 'RARE')] }),
    ] };
  writeFileSync(reserve, JSON.stringify(charge), 'utf8');
  const cl = join(boite, 'classeur'); mkdirSync(join(cl, 'wallets'), { recursive: true });
  writeFileSync(join(cl, 'uuids.json'), JSON.stringify(['A', 'B', 'C', 'D', 'E', 'F']));
  // le portefeuille A détient A, B (set complet) et D (la pièce CHÈRE de « moitié »)
  writeFileSync(join(cl, 'wallets', 'ab.json'), JSON.stringify({ [A]: [[0, 1, 0], [1, 1, 0], [3, 2, 0]] }));
  const CODE = [
    "import { pathToFileURL } from 'node:url';",
    "import { join } from 'node:path';",
    "const R = process.env.PROJECT_ROOT;",
    "const url = (f) => pathToFileURL(join(R, f)).href;",
    "const route = await import(url('src/pages/api/analytics/[module].js'));",
    "const acces = await import(url('engine/lib/access.mjs'));",
    "const P = acces.porte('modules');",
    "const locals = P.actif ? { palier: P.tier } : {};",
    "const appel = async (q) => {",
    "  const r = await route.GET({ params: { module: 'sets_mcp' },",
    "    request: new Request('https://banc.test/api/analytics/sets_mcp' + q), locals });",
    "  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}",
    "  return { status: r.status, j, corps: t.slice(0, 100) };",
    "};",
    "const out = {};",
    "out.sans = await appel('?tri=gpm-asc&n=10');",
    "out.avec = await appel('?tri=gpm-asc&n=10&adresse=" + A + "');",
    "out.mal = await appel('?adresse=0x123');",
    "out.inconnu = await appel('?adresse=0x0000000000000000000000000000000000000000');",
    "console.log(JSON.stringify(out));",
  ].join('\n');
  let R2 = null; let err2 = '';
  try {
    const brut = execFileSync(process.execPath, ['--input-type=module', '-e', CODE],
      { cwd: ROOT, encoding: 'utf8', timeout: 30000,
        env: { ...process.env, PROJECT_ROOT: ROOT, RESERVE_SETS_MCP: reserve, CLASSEUR_DIR: cl } });
    R2 = JSON.parse(brut.trim().split('\n').pop());
  } catch (e) { err2 = String(e.stderr || e.message).split('\n').slice(-4).join(' | '); }
  verifie('la route personnalisée se charge et répond', R2 !== null, err2);
  if (R2) {
    const sans = R2.sans.j, avec = R2.avec.j;
    verifie('sans adresse : 3 sets, `personnalise: false`, et aucune ligne ne porte `pieces`',
      sans && sans.sets.length === 3 && sans.personnalise === false && sans.sets.every((x) => !('pieces' in x)),
      R2.sans.corps);
    verifie('🎯 avec l\'adresse : le set complet a DISPARU, « moitié » ne coûte plus que sa pièce manquante (10 $) et passe DEVANT « libre »',
      avec && avec.personnalise === true && avec.exclus === 1 && avec.possedes === 3
        && avec.sets.map((x) => x.slug).join(',') === 'moitie,libre' && avec.sets[0].cout === 10 && avec.sets[0].possede === 1,
      avec ? `${avec.sets.map((x) => x.slug + ':' + x.cout).join(' ')} · exclus ${avec.exclus} · possedes ${avec.possedes}` : R2.avec.corps);
    verifie('…et `total`/`classables` suivent : 2 et 2, pas les 3 de tout le monde',
      avec && avec.total === 2 && avec.classables === 2, avec ? `total ${avec.total} classables ${avec.classables}` : '');
    verifie('une adresse mal formée est REFUSÉE (400), une adresse inconnue du grand livre rend le classement de tout le monde (200, 0 possédée)',
      R2.mal.status === 400 && R2.inconnu.status === 200 && R2.inconnu.j && R2.inconnu.j.possedes === 0 && R2.inconnu.j.sets.length === 3,
      `mal ${R2.mal.status} · inconnu ${R2.inconnu.status}`);
  }
}

console.log(ko === 0 ? '\n✅ SETS MCP — tout est conforme\n'
                     : `\n❌ SETS MCP — ${ko} contrôle(s) en échec\n`);
process.exit(ko === 0 ? 0 : 1);
