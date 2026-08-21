// ⚠️ VeVePreda/veve-sites — engine/tools/test_memoire.mjs   (FICHIER NEUF — lot 171)
//
// ═══════════════════════════════════════════════════════════════════════════
//  LA SONDE MÉMOIRE DU BUILD — un instrument, et rien qu'un instrument
// ═══════════════════════════════════════════════════════════════════════════
//  Trois déploiements sont morts en silence en quatre jours (18, 20 et 21/08),
//  en plein `prerendering static routes`, sur un VPS de 7,8 Go SANS SWAP. Ni
//  exception, ni `#39 ERROR`, ni code de sortie : la signature d'un conteneur
//  tué par le noyau. Preda a vérifié chez Coolify qu'il n'y a **qu'un seul
//  déploiement par push** ⇒ l'hypothèse « deux builds simultanés » est écartée,
//  et il ne reste que la consommation d'UN build.
//
//  ⭐⭐⭐ CE QUE CE BANC PROTÈGE N'EST PAS UN CALCUL, C'EST UNE MESURE.
//  La sonde ne répare rien. Sa seule valeur est d'être LÀ quand le prochain
//  build mourra, pour que son log dise où était le pic. Une sonde retirée « au
//  ménage » ne casse rien, ne rougit nulle part, et fait perdre la seule trace
//  qu'on aura de la prochaine mort. C'est exactement le profil du garde-fou
//  qui se désarme tout seul.
//
//  ⛔ ET IL VÉRIFIE AUSSI L'INVERSE : que la sonde n'influence RIEN. Un
//  instrument qui pilote n'est plus un instrument. `memoire.jalon()` ne doit
//  rien retourner d'exploitable, et aucun `if` du moteur ne doit la lire.
//
//  ⚠️ CE QU'IL NE PEUT PAS FAIRE — et c'est l'essentiel à dire :
//  **le bac à sable ne peut pas reproduire la mort du build.** Il prédit le
//  code, jamais la machine. Ce banc prouve que l'instrument est branché et
//  qu'il compte juste ; il ne prouve pas que le VPS tiendra.

import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
let echecs = 0;
const dire = (ok, quoi, detail = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${quoi}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs++;
};

console.log('\n🖥️ LA SONDE MÉMOIRE DU BUILD\n');

const ds = readFileSync(join(ROOT, 'engine/lib/dataset.mjs'), 'utf8');
// ⭐ On retire les COMMENTAIRES avant toute recherche. Sans ça, le long bloc
//   qui EXPLIQUE la sonde suffirait à satisfaire chaque contrôle : le banc
//   lirait la documentation du sujet au lieu du sujet. (Faute réellement
//   commise le 21/08 sur `filet.yml`, dans scrapeur-veve, le même jour.)
const code = ds.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// ─── ① LES QUATRE JALONS RÉCLAMÉS SONT POSÉS ───────────────────────────────
// Ce sont ceux de l'ordre de chantier : après le catalogue, après les prix,
// après `projeterCote()`, et juste avant le prerender.
const JALONS = [
  [/memoire\.jalon\('avant de lire les sources'\)/, 'avant de lire les sources'],
  [/memoire\.jalon\(`catalogue \(/, 'après le catalogue + baselines + relevés'],
  [/memoire\.jalon\(`prix agreges/, 'après l\'agrégation des prix'],
  [/memoire\.jalon\(`projeterCote fait/, 'après projeterCote()'],
  // ⭐ `clore()` DEPUIS LE LOT 175 : ce jalon-ci part aussi dans le fichier que
  //   `/api/sante` sert, parce que le journal du build ne l'atteint jamais.
  [/memoire\.clore\('dataset pret — LE PRERENDER COMMENCE ICI'\)/, 'juste avant le prerender (et il CLÔT le rapport)'],
];
for (const [re, quoi] of JALONS) {
  dire(re.test(code), `① jalon posé : ${quoi}`,
    re.test(code) ? '' : 'sans lui, le log de la prochaine mort ne dira pas où était le pic');
}

// ─── ② LE POINT DE BOUCLE EST DANS LA LECTURE DES PRIX ─────────────────────
// Un pic ENTRE deux jalons est un pic invisible, et c'est justement pendant la
// lecture des 2,4 M de relevés que la mémoire monte.
{
  const i = code.indexOf('await streamPrices(');
  const j = code.indexOf('const bl = new Map()');
  const bloc = (i >= 0 && j > i) ? code.slice(i, j) : '';
  dire(/memoire\.pointDeBoucle\(/.test(bloc),
    '② un point de mesure DANS la boucle des prix',
    bloc ? '' : 'bloc streamPrices introuvable — le banc ne peut pas juger');
}

// ─── ③ LE PLAFOND V8 EST DIT ───────────────────────────────────────────────
dire(/await memoire\.plafond\(\)/.test(code),
  '③ le plafond du tas V8 est journalisé',
  'un `rss` sans plafond ne se compare à rien : on ne saurait pas si la cible du remède est le tas ou le hors-tas');

// ─── ④ LA SONDE N'INFLUENCE RIEN ───────────────────────────────────────────
{
  const src = readFileSync(join(ROOT, 'engine/lib/memoire.mjs'), 'utf8');
  const c = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  // 🔴🔴 PREMIER JET DE CE CONTROLE : `/export function jalon[\s\S]{0,400}?\n  return /`.
  //   J'ai injecte `return pic;` dans `jalon()` — **et le banc est reste VERT**.
  //   Le corps de la fonction fait plus de 400 caracteres (le `console.log` a
  //   lui seul en fait 300) : le quantificateur paresseux s'arretait AVANT
  //   d'atteindre le `return`. ⭐⭐⭐ *Une borne posee au jugé sur une longueur
  //   qu'on n'a pas mesuree transforme un controle en decoration.*
  //   ⇒ On DECOUPE le corps au lieu de le survoler.
  const corps = (() => {
    const i = c.indexOf('export function jalon(');
    if (i < 0) return null;
    const j = c.indexOf('\n}', i);
    return j < 0 ? null : c.slice(i, j);
  })();
  dire(corps !== null, '④ le corps de `jalon()` a bien été isolé',
    corps === null ? 'sans ça, le contrôle suivant est vert par construction' : `${corps.length} o`);
  dire(corps !== null && !/\breturn\s+[^;\s]/.test(corps),
    '④ `jalon()` ne retourne rien d\'exploitable',
    'un instrument dont on peut lire la sortie finit par piloter une décision');
  // ⛔ Aucun `if` du moteur ne doit dépendre de la sonde.
  const lecteurs = ['engine/lib/dataset.mjs', 'engine/lib/cote.mjs', 'engine/lib/extremes.mjs'];
  let pilote = false;
  for (const f of lecteurs) {
    const s = readFileSync(join(ROOT, f), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    if (/(if|\?|&&|\|\|)[^\n]*memoire\.(picMo|jalon|pointDeBoucle)/.test(s)) pilote = true;
  }
  dire(!pilote, '④ aucune décision du moteur ne lit la sonde');
}

// ─── ⑤ ELLE COMPTE JUSTE — on la fait tourner pour de vrai ─────────────────
{
  const m = await import(new URL('../lib/memoire.mjs', import.meta.url));
  m._reinitialiser();
  const lignes = [];
  const vrai = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  m.jalon('a');
  const gros = Buffer.alloc(64 * 1024 * 1024);
  gros[0] = 1;
  m.jalon('b');
  for (let i = 0; i < 25; i++) m.pointDeBoucle('essai', 10);
  console.log = vrai;

  dire(lignes.length === 2 + 2, '⑤ 2 jalons + 2 points de boucle imprimés',
    `reçu ${lignes.length} ligne(s) (25 appels, un point tous les 10)`);
  dire(/^\[memoire\] a — rss \d+ Mo/.test(lignes[0]), '⑤ le premier jalon dit son `rss`', lignes[0]);
  dire(!/depuis le jalon precedent/.test(lignes[0]),
    '⑤ le PREMIER jalon n\'invente pas d\'écart',
    'il n\'a pas de précédent : afficher « +0 Mo » laisserait croire à une mesure');
  dire(/depuis le jalon precedent/.test(lignes[1]), '⑤ le second jalon dit l\'écart');
  dire(/hors-tas \d+ Mo/.test(lignes[1]),
    '⑤ le hors-tas est dit séparément du tas',
    'un Buffer de 64 Mo ne bouge PAS le tas V8 : sans cette colonne, la mémoire semblerait ne pas monter');
  dire(m.picMo() >= 1, '⑤ le pic est retenu', `${m.picMo()} Mo`);
  m._reinitialiser();
  dire(m.picMo() === 0, '⑤ la remise à zéro fonctionne (elle sert aux bancs)');
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑥ LE BUDGET DE LOG — LOT 174. Sans lui, la sonde parle et personne n'entend.
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE QUI S'EST PASSÉ LE 21/08, SUR LE LOG COOLIFY DU COMMIT `273d4ff` :
//   L'étape #39 (le build) s'arrête à **101 lignes**, sans même sa ligne
//   `DONE` — alors que les étapes #32, #21 et #25 (36, 63 et 77 lignes) sont
//   complètes. ⇒ **Coolify ne garde qu'une centaine de lignes par étape.**
//   Sur ces 101 lignes : **62 de `veve:routes-compte`** (market/index.astro y
//   figure 8 fois) et 10 avertissements `getStaticPaths`.
//   ⇒ La PREMIÈRE ligne de la sonde est passée (`rss 320 Mo`). Les cinq
//     suivantes, dont **« dataset pret — LE PRERENDER COMMENCE ICI »** qui porte
//     le pic, tombaient au-delà de la centième.
//
// ⭐⭐⭐ *Un instrument dont la sortie n'atteint pas le lecteur n'est pas un
// instrument.* Et le remède n'était pas dans l'instrument : il était chez le
// bavard qui occupait la place.
// ⛔ Ce contrôle appartient au banc de la SONDE, et pas à celui des routes :
//   c'est la sonde qui paie quand le budget est mangé. Le jour où quelqu'un
//   remettra un journal par passe, c'est ici que ça doit rougir.
{
  const mod = await import(new URL('../lib/astro_routes_compte.mjs', import.meta.url));
  const plugin = mod.default('server');
  const dit = [];
  const logger = { info: (l) => dit.push(l) };

  // Quatre passes sur les mêmes routes — c'est ce que fait Astro en vrai
  // (mesuré : market/index.astro annoncé 8 fois sur un seul build).
  // ⚠️ CES TROIS CHEMINS SONT LUS DANS `ROUTES_COMPTE`, PAS INVENTÉS.
  //   Premier jet : j'avais écrit `pages/[locale]/compte/index.astro`, qui
  //   N'Y EST PAS (la liste porte `pages/compte/index.astro`, sans locale).
  //   Le plugin l'ignorait, le banc comptait 2 lignes au lieu de 3 et rougissait
  //   pour une faute qui était la MIENNE. ⭐⭐ *Un banc qui fabrique sa matière
  //   doit la fabriquer à partir de la source, jamais de mémoire.*
  const routes = [
    'pages/[locale]/market/index.astro',
    'pages/compte/index.astro',
    'pages/[locale]/favoris/index.astro',
  ];
  {
    const liste = readFileSync(join(ROOT, 'engine/lib/astro_routes_compte.mjs'), 'utf8');
    const absentes = routes.filter((r) => !liste.includes(`'${r}'`));
    dire(absentes.length === 0,
      '⑥ les routes de ce contrôle sont bien dans ROUTES_COMPTE',
      absentes.length ? `inventée(s) : ${absentes.join(', ')}` : `${routes.length}/3`);
  }
  const vues = [];
  mod._oublier();
  for (let passe = 0; passe < 4; passe++) {
    for (const c of routes) {
      const route = { component: c };
      plugin.hooks['astro:route:setup']({ route, logger });
      vues.push(route.prerender);
    }
  }

  dire(dit.length === routes.length,
    '⑥ chaque route de compte ne se dit QU\'UNE fois',
    `${dit.length} ligne(s) pour ${routes.length} route(s) sur 4 passes `
    + `(avant le lot 174 : ${routes.length * 4})`);

  // 🔴🔴 LE RÉGLAGE DOIT SURVIVRE AU DÉDOUBLONNAGE, ET C'EST LE VRAI RISQUE.
  //   Si le `return` du dédoublonnage était posé AVANT `route.prerender`, les
  //   passes 2 à 4 ne régleraient plus rien — et le journal, lui, continuerait
  //   d'affirmer que si. ⭐⭐ *Une optimisation de journal qui emporte le
  //   travail est indiscernable d'un journal honnête.*
  dire(vues.length === 12 && vues.every((v) => v === false),
    '⑥ ET le réglage `prerender` est appliqué à CHAQUE passe',
    `${vues.filter((v) => v === false).length}/12 passes réglées`);

  // ⭐ ON L'ÉPROUVE, ON NE VÉRIFIE PAS QU'ELLE EXISTE. Premier jet :
  //   `typeof mod._oublier === 'function'` — j'ai vidé le corps de la fonction
  //   et le contrôle est resté VERT. *Vérifier qu'une porte est là ne dit rien
  //   de ce qu'elle ouvre.*
  const avant = dit.length;
  mod._oublier();
  plugin.hooks['astro:route:setup']({ route: { component: routes[0] }, logger });
  dire(dit.length === avant + 1,
    '⑥ le dédoublonnage se remet VRAIMENT à zéro (réservé aux bancs)',
    `${dit.length - avant} ligne(s) après remise à zéro — attendu 1`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑦ LE RAPPORT SORT DU JOURNAL — LOT 175
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LE LOT 174 AVAIT DÉDUIT FAUX, ET C'EST LA LEÇON DE CE §.
// Il affirmait « Coolify garde ~100 lignes par étape » sur la foi d'UN log
// (101 lignes, étape coupée). Le déploiement suivant en a conservé **70**, et
// **7 637 octets** contre 11 124. Ni les lignes ni les octets ne sont
// constants. ⭐⭐⭐ *Une régularité vue sur UN cas est une coïncidence tant
// qu'un second cas ne l'a pas confirmée.*
//
// 🔑 CE QUI EST CONSTANT, LUI : dans les DEUX logs, la dernière ligne conservée
//   est la MÊME (`[entrepot] baselines: 13899 lignes depuis …`), et l'étape a
//   duré **3 min 49** les deux fois. Le journal s'arrête à 21 s puis 27 s.
//   La cause reste INCONNUE, et on cesse d'en dépendre.
//
// ⇒ Le rapport part dans un fichier, embarqué dans l'image
//   (`COPY --from=build /app/.reserve ./.reserve`), servi par `/api/sante`.
// ⚠️ Ça ne couvre PAS un build qui MEURT : pas d'image, pas de fichier. Les
//   deux canaux sont complémentaires, aucun ne remplace l'autre — et c'est
//   écrit ici pour que personne ne retire l'un en croyant l'autre suffisant.
{
  const m = await import(new URL('../lib/memoire.mjs', import.meta.url));
  const dossier = join(ROOT, '.reserve', '_banc_memoire');
  const fichier = join(dossier, 'rapport.json');
  process.env.RESERVE_MEMOIRE = fichier;

  m._reinitialiser();
  const vrai = console.log;
  console.log = () => {};
  await m.plafond();
  m.jalon('un');
  m.jalon('deux');
  m.clore('trois');
  console.log = vrai;

  let r = null;
  try { r = JSON.parse(readFileSync(fichier, 'utf8')); } catch { /* rien */ }
  dire(!!r, '⑦ le rapport est écrit sur disque', r ? fichier : 'illisible');

  // ═════════════════════════════════════════════════════════════════════════
  // 🔑 LOT 176 — LE RAPPORT SUIT LE DERNIER JALON, QUEL QU'IL SOIT
  // ═════════════════════════════════════════════════════════════════════════
  // Ce que le lot 175 a rendu sur la prod : **1 774 Mo, dont 1 567 de tas, sur
  // un plafond de 3 120** — et 85 Mo de hors-tas, ce qui ÉCARTE ce chantier-là.
  // ⛔ Mais c'était le début du prerender, et les trois morts sont survenues
  //   PENDANT. ⇒ `jalon()` réécrit désormais le rapport à chaque appel, pour
  //   qu'un jalon posé plus tard (celui d'`astro_extremes.mjs`, après les
  //   3 097 pages) s'y ajoute sans dépendre d'un ordre d'appel.
  {
    m.jalon('un jalon POSTERIEUR a clore()');
    let apres = null;
    try { apres = JSON.parse(readFileSync(fichier, 'utf8')); } catch { /* rien */ }
    dire(apres && apres.etapes.length === 4,
      '⑦ un jalon posé APRÈS `clore()` entre quand même dans le rapport',
      `${apres ? apres.etapes.length : 0} étape(s) — attendu 4`);
    dire(apres && apres.etapes[3]
      && apres.etapes[3].nom === 'un jalon POSTERIEUR a clore()',
      '⑦ ...et c\'est bien LUI le dernier',
      'sinon le pic du prerender ne sortirait jamais');
  }

  // ⭐ ET LE DERNIER JALON DU BUILD EST BIEN POSÉ PAR LE DERNIER PLUGIN.
  {
    const cfg = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    const mm = cfg.match(/integrations:\s*\[([^\]]*)\]/);
    const dernier = mm ? mm[1].split(',').map((s) => s.trim()).filter(Boolean).pop() : '';
    dire(/^extremes\(/.test(dernier || ''),
      '⑦ `extremes()` est bien la DERNIÈRE intégration',
      `dernière : ${dernier || '(illisible)'} — si ça change, le jalon de fin `
      + 'cesse d\'être le dernier, sans que rien ne le dise');
    const ext = readFileSync(join(ROOT, 'engine/lib/astro_extremes.mjs'), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    dire(/memoire\.jalon\('BUILD FINI/.test(ext),
      '⑦ ...et elle pose le jalon de fin de build');
    // 🔴 HORS DU `try` DU CLASSEMENT : un build qui a rendu ses pages puis raté
    //    son classement a quand même consommé sa mémoire.
    const bloc = ext.slice(ext.indexOf("'astro:build:done'"));
    dire(bloc.indexOf('BUILD FINI') > bloc.indexOf('classement d\'amplitude NON'),
      '⑦ ...APRÈS le `catch`, pas dedans',
      'sinon un classement raté emporterait la mesure');
  }
  if (r) {
    dire(Array.isArray(r.etapes) && r.etapes.length === 3,
      '⑦ il porte TOUS les jalons, pas seulement le dernier',
      `${(r.etapes || []).length} étape(s) — attendu 3`);
    dire(r.etapes[2] && r.etapes[2].nom === 'trois',
      '⑦ `clore()` pose bien son propre jalon avant d\'écrire',
      'sinon le dernier point, celui qui compte, manquerait');
    dire(Number.isFinite(r.picMo) && r.picMo > 0, '⑦ le pic y est', `${r.picMo} Mo`);
    dire(Number.isFinite(r.plafondMo) && r.plafondMo > 0,
      '⑦ le plafond V8 y est aussi',
      `${r.plafondMo} Mo — un pic sans plafond ne se compare à rien`);
    // ⛔⛔ LISTE BLANCHE, JAMAIS LISTE NOIRE — `/api/sante` est PUBLIQUE.
    // 🔴 Premier jet : je cherchais `/app`, `/home`, `NODE_OPTIONS`,
    //   `PROJECT_ROOT`. J'ai injecté `ou: process.cwd()` dans le rapport — et
    //   le contrôle est resté VERT, parce que le chemin du bac à sable
    //   (`/tmp/…`) ne contenait aucun de ces mots.
    //   ⭐⭐⭐ *Une liste noire ne protège que de ce qu'on a déjà imaginé ; elle
    //   s'oublie le jour où la source gagne un champ.* C'est la règle que
    //   `dataset.mjs` applique déjà au rayon (« on n'ajoute que ce qu'on
    //   NOMME »), et elle vaut ici pour la même raison.
    const PERMIS = ['picMo', 'plafondMo', 'lignesLues', 'etapes', 'ecritLe'];
    const enTrop = Object.keys(r).filter((k) => !PERMIS.includes(k));
    dire(enTrop.length === 0,
      '⑦ le rapport ne porte QUE les champs nommés',
      enTrop.length ? `en trop : ${enTrop.join(', ')}` : PERMIS.join(', '));

    const CHAMPS_ETAPE = ['nom', 'rss', 'tas', 'horsTas'];
    const etapesSales = (r.etapes || []).filter(
      (e) => Object.keys(e).some((k) => !CHAMPS_ETAPE.includes(k)));
    dire(etapesSales.length === 0,
      '⑦ ...et chaque étape non plus',
      etapesSales.length ? JSON.stringify(etapesSales[0]) : CHAMPS_ETAPE.join(', '));

    // ⭐ ET LES VALEURS SONT DES NOMBRES. Un champ permis qui porterait un
    //   chemin passerait la liste blanche : on vérifie aussi la FORME.
    const nonNombres = ['picMo', 'plafondMo', 'lignesLues']
      .filter((k) => !Number.isFinite(r[k]));
    dire(nonNombres.length === 0,
      '⑦ ...et ce sont des nombres, pas des chaînes',
      nonNombres.length ? nonNombres.join(', ') : 'picMo, plafondMo, lignesLues');
  }

  // ⭐ `/api/sante` doit VRAIMENT le lire — et lire à CHAQUE appel, pas au
  //   chargement du module : un conteneur remplacé rendrait sinon la réponse
  //   d'un build précédent.
  const sante = readFileSync(join(ROOT, 'src/pages/api/sante.js'), 'utf8');
  const sansCom = sante.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  dire(/memoire: memoireDuBuild\(\)/.test(sansCom),
    '⑦ `/api/sante` sert le rapport');
  dire(/const memoireDuBuild = \(\) =>/.test(sansCom),
    '⑦ ...et le lit à chaque appel (une fonction, pas une constante de module)');
  dire(!/require\(/.test(sansCom),
    '⑦ ...sans `require()` — ce fichier est un module ES',
    'un `require` y lèverait À LA REQUÊTE, et le `catch` rendrait `memoire: null` pour toujours');

  try { rmSync(dossier, { recursive: true, force: true }); } catch { /* rien */ }
}

console.log(echecs ? `\n❌ ${echecs} écart(s)\n` : '\n✅ la sonde mémoire est branchée, et son rapport sort du journal\n');
process.exit(echecs ? 1 : 0);
