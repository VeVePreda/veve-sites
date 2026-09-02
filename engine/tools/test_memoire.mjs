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

import { mkdirSync, readFileSync, rmSync } from 'node:fs';
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
    // ⏱️ LOT 214 — `chargeMax` et `coeurs` REJOIGNENT LA LISTE BLANCHE, et
    //   la liste blanche est la raison pour laquelle ce banc a rougi dès le
    //   premier essai du lot. ⭐ C'est exactement son travail : un champ qui
    //   apparaît dans un rapport SERVI PUBLIQUEMENT doit être NOMMÉ par
    //   quelqu'un, jamais se glisser dedans. ⛔ On ne l'élargit donc pas « pour
    //   faire passer » : on l'élargit ET on exige la forme des deux nouveaux,
    //   quinze lignes plus bas.
    const PERMIS = ['picMo', 'plafondMo', 'lignesLues', 'chargeMax', 'coeurs', 'etapes', 'ecritLe'];
    const enTrop = Object.keys(r).filter((k) => !PERMIS.includes(k));
    dire(enTrop.length === 0,
      '⑦ le rapport ne porte QUE les champs nommés',
      enTrop.length ? `en trop : ${enTrop.join(', ')}` : PERMIS.join(', '));

    const CHAMPS_ETAPE = ['nom', 'rss', 'tas', 'horsTas', 'charge'];
    const etapesSales = (r.etapes || []).filter(
      (e) => Object.keys(e).some((k) => !CHAMPS_ETAPE.includes(k)));
    dire(etapesSales.length === 0,
      '⑦ ...et chaque étape non plus',
      etapesSales.length ? JSON.stringify(etapesSales[0]) : CHAMPS_ETAPE.join(', '));

    // ⭐ ET LES VALEURS SONT DES NOMBRES. Un champ permis qui porterait un
    //   chemin passerait la liste blanche : on vérifie aussi la FORME.
    const nonNombres = ['picMo', 'plafondMo', 'lignesLues', 'chargeMax', 'coeurs']
      .filter((k) => !Number.isFinite(r[k]));
    dire(nonNombres.length === 0,
      '⑦ ...et ce sont des nombres, pas des chaînes',
      nonNombres.length ? nonNombres.join(', ') : 'picMo, plafondMo, lignesLues, chargeMax, coeurs');

    // ═══════════════════════════════════════════════════════════════════════
    // ⏱️🔴🔴 LOT 214 — LA CHARGE EST-ELLE VRAIMENT RELEVÉE, OU JUSTE DÉCLARÉE ?
    // ═══════════════════════════════════════════════════════════════════════
    // ⛔ `Number.isFinite(chargeMax)` ci-dessus est VRAI pour `0`, et `0` est
    //    exactement ce que rendrait un champ posé mais jamais alimenté. Le
    //    contrôle de forme ne distingue pas « mesuré » de « déclaré ».
    // ⭐ Ce qui les distingue : `chargeMax` doit être le MAXIMUM des charges
    //    des étapes. Un champ décoratif ne tiendrait pas cette relation.
    // ⚠️ ON N'EXIGE PAS `> 0` : une machine parfaitement au repos rend `0.00`,
    //    et un banc qui refuserait ça rougirait pour une raison fausse — sur la
    //    seule machine où l'on voudrait qu'il soit vert. C'est la RELATION
    //    qu'on mesure, pas la valeur.
    const charges = (r.etapes || []).map((e) => e.charge).filter(Number.isFinite);
    dire(charges.length === (r.etapes || []).length,
      '⑦ CHAQUE étape porte sa charge',
      `${charges.length} sur ${(r.etapes || []).length} — une étape sans charge est un trou muet`);
    dire(charges.length > 0 && r.chargeMax === Math.max(...charges),
      '⑦ `chargeMax` est bien le MAXIMUM des étapes, pas un champ décoratif',
      `chargeMax=${r.chargeMax} · max des étapes=${charges.length ? Math.max(...charges) : 'aucune'}`);
    dire(r.coeurs >= 1,
      '⑦ `coeurs` accompagne la charge — sans lui elle ne se compare à rien',
      `${r.coeurs} coeur(s) — un loadavg de 3,5 est catastrophique sur 2 et confortable sur 8`);
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

// ═══════════════════════════════════════════════════════════════════════════
// ⑧ ⏱️🔴🔴🔴 LOT 214 — LE CHRONO DU DÉPLOIEMENT
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ IL VIT DANS **CE** BANC, ET PAS DANS UN 52ᵉ. Ce fichier n'observe pas
// « la mémoire » : il observe **les instruments que le build écrit dans un
// fichier et que `/api/sante` sert**, parce que le journal Coolify se tronque.
// Le chrono est le troisième de cette famille, après le rapport mémoire et le
// témoin de marché. ⛔ Un banc de plus aurait ajouté une couche au Dockerfile
// pour mesurer un lot qui cherche à en RETIRER. *On étend un banc plutôt que
// d'en créer un — et on le choisit par ce qu'il OBSERVE, jamais par son nom.*
{
  const dossier = join(ROOT, '.reserve', '_banc_chrono');
  mkdirSync(dossier, { recursive: true });
  const fichier = join(dossier, '.chrono.json');
  process.env.CHRONO_FICHIER = fichier;
  const { jalonner } = await import('../lib/chrono_build.mjs');

  // ⭐ DEUX APPELS, ET C'EST TOUT LE MÉCANISME : le chrono est écrit par CINQ
  //   processus Node différents (cinq `RUN` distincts du Dockerfile, chacun
  //   son shell). S'il ÉCRASAIT au lieu d'AJOUTER, `/api/sante` ne servirait
  //   jamais qu'un seul jalon — celui de l'image — et les quatre durées qu'on
  //   cherche n'existeraient dans aucun canal. C'est LE défaut qui rendrait ce
  //   lot inutile tout en le laissant parfaitement vert partout ailleurs.
  jalonner('debut');
  jalonner('build');
  const c1 = JSON.parse(readFileSync(fichier, 'utf8'));
  dire(Array.isArray(c1.jalons) && c1.jalons.length === 2,
    '⑧ deux appels AJOUTENT deux jalons (ils ne s\'écrasent pas)',
    `${(c1.jalons || []).length} jalon(s) — attendu 2 : cinq RUN, cinq processus`);
  dire(c1.jalons[0].nom === 'debut' && c1.jalons[1].nom === 'build',
    '⑧ ...dans l\'ORDRE où ils ont été posés',
    'un chrono qui perd l\'ordre ne mesure plus des durées, mais des écarts au hasard');
  dire(c1.jalons.every((j) => Number.isFinite(j.charge) && j.coeurs >= 1),
    '⑧ chaque jalon porte sa charge ET son nombre de cœurs',
    'un loadavg sans son nombre de cœurs ne se compare à rien');

  // ⛔⛔ LISTE BLANCHE, MÊME RAISON QU'AU § ⑦ : ce fichier est servi tel quel
  //   par une route PUBLIQUE. Une liste noire ne protège que de ce qu'on a
  //   déjà imaginé, et s'oublie le jour où la source gagne un champ.
  const PERMIS_J = ['nom', 'ts', 'charge', 'coeurs'];
  const sales = c1.jalons.filter((j) => Object.keys(j).some((k) => !PERMIS_J.includes(k)));
  dire(sales.length === 0, '⑧ un jalon ne porte QUE les champs nommés',
    sales.length ? JSON.stringify(sales[0]) : PERMIS_J.join(', '));

  // 🔴🔴 UN NOM REFUSÉ N'ÉCRIT RIEN — ET NE LÈVE PAS. Le nom voyage jusqu'à une
  //   route publique : la forme est EXIGÉE, pas espérée. Mais un instrument qui
  //   ferait ÉCHOUER une étape du Dockerfile sur un nom mal tapé casserait ce
  //   qu'il observe — c'est la faute qu'on refuse depuis le lot 27.
  const refuse = jalonner('/app/secret ; rm -rf /');
  const c2 = JSON.parse(readFileSync(fichier, 'utf8'));
  dire(refuse === false && c2.jalons.length === 2,
    '⑧ un nom hors forme est REFUSÉ, sans rien écrire et sans lever',
    `${c2.jalons.length} jalon(s) après l'appel refusé — attendu 2`);

  // ⭐ ET IL N'ÉCHOUE JAMAIS, MÊME SUR UN CHEMIN IMPOSSIBLE. Un build qui
  //   tomberait parce que son CHRONO n'a pas pu écrire serait le comble.
  process.env.CHRONO_FICHIER = join(dossier, 'nexiste-pas', 'sous', 'dossier', 'c.json');
  let leve = false;
  try { jalonner('image'); } catch { leve = true; }
  dire(!leve, '⑧ un chemin impossible ne fait PAS lever le chrono',
    'l\'instrument ne doit jamais pouvoir casser ce qu\'il observe');
  process.env.CHRONO_FICHIER = fichier;

  // ═════════════════════════════════════════════════════════════════════════
  // ⑧ bis — CE QUE `/api/sante` EN FAIT, ET LA DISTINCTION QUI PORTE LE LOT
  // ═════════════════════════════════════════════════════════════════════════
  const sante = readFileSync(join(ROOT, 'src/pages/api/sante.js'), 'utf8');
  const sansCom = sante.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  dire(/chrono: chronoDuBuild\(\)/.test(sansCom), '⑧ `/api/sante` sert le chrono');
  dire(/const chronoDuBuild = \(\) =>/.test(sansCom),
    '⑧ ...et le lit à CHAQUE appel (une fonction, pas une constante de module)',
    'un conteneur remplacé rendrait sinon le chrono du build précédent');
  dire(/demarre: DEMARRE/.test(sansCom) && /const DEMARRE = new Date\(\)/.test(sansCom),
    '⑧ `demarre` est figé au CHARGEMENT, pas lu à la requête',
    'lu dans le GET il rendrait « maintenant » — la seule réponse qui ne renseigne sur rien');

  // ⭐⭐⭐ « CHRONO VIDE » ET « CHAMP ABSENT » NE PRENNENT PAS LE MÊME CHEMIN.
  // C'est la moitié de l'intérêt du bloc, et c'est la leçon d'`ecartes: 0`
  // (lot 193, remesuré le 02/09) : un seul zéro portait deux états du monde
  // opposés — « la collecte s'est nettoyée » et « la règle ne mord plus » —
  // et rien ne permettait de les distinguer. Ici :
  //     `chrono: null`      = le fichier manque   → un conteneur d'AVANT ce lot
  //     `chrono.jalons: []` = le fichier est vide → l'instrument est DÉBRANCHÉ
  // ⛔ Les confondre ferait passer une sonde débranchée pour une sonde pas
  //   encore déployée, et on chercherait la panne du mauvais côté.
  dire(/if \(!Array\.isArray\(c\.jalons\)\) return null;/.test(sansCom),
    '⑧ un fichier SANS tableau de jalons rend `null` (« je ne sais pas »)',
    'et surtout PAS une liste vide, qui affirmerait « l\'instrument tourne et n\'a rien vu »');

  // 🔴🔴🔴 LE CONTRÔLE QUI EMPÊCHE DE REFAIRE LA FAUTE DU LOT 27.
  // Un jalon posé en FIN de `RUN` devient la dernière commande de l'étape :
  // c'est SON code de sortie qui devient celui de l'étape. Ce chrono réussit
  // toujours ⇒ il ferait passer AU VERT n'importe quel échec devant lui.
  // C'est mot pour mot ce que `npm run build; mkdir -p /app/.reserve` avait
  // fait le 03/08/2026, et le Dockerfile porte encore le commentaire.
  // ⭐ Le banc est volontairement GROSSIER : il refuse tout jalon qui n'est pas
  //   en tête. Un faux négatif ici rendrait un déploiement rouge invisible.
  const dock = readFileSync(join(ROOT, 'Dockerfile'), 'utf8').split('\n');
  const lignesJalon = dock.map((l, i) => [i + 1, l])
    .filter(([, l]) => l.includes('chrono_build.mjs'));
  dire(lignesJalon.length >= 4,
    '⑧ le Dockerfile appelle vraiment le chrono',
    `${lignesJalon.length} appel(s) — un instrument non appelé est un instrument absent`);
  // ⭐ « EN TÊTE » SE MESURE SUR LE CONTENU, PAS SUR LE NUMÉRO DE LIGNE : le
  //   jalon doit être suivi d'un `;` et d'AUTRE CHOSE, sur sa ligne ou par une
  //   continuation. Ce qu'on refuse, c'est qu'il soit le DERNIER maillon.
  const enFin = lignesJalon.filter(([n, l]) => {
    const nu = l.trim().replace(/\\$/, '').trim();
    const finit = /chrono_build\.mjs\s+[a-z0-9-]+\s*$/.test(nu);
    if (!finit) return false;                        // suivi de quelque chose : bon
    const suite = (dock[n] || '').trim();            // la ligne d'après (continuation)
    return !(l.trim().endsWith('\\') && suite.length > 0);
  });
  dire(enFin.length === 0,
    '⑧ AUCUN jalon n\'est la dernière commande de son `RUN`',
    enFin.length
      ? `🔴 ligne(s) ${enFin.map(([n]) => n).join(', ')} — le chrono réussit TOUJOURS : il ferait passer au vert l'échec qui le précède (faute du lot 27)`
      : `${lignesJalon.length} appel(s), tous en tête ou suivis`);
  // 🔬 AUTO-CONTRÔLE : le détecteur ci-dessus rougit-il sur un cas fabriqué ?
  //   Sans lui, une expression régulière fausse rendrait ce contrôle VERT pour
  //   toujours, sur un Dockerfile qui aurait le défaut. ⭐ C'est le geste qui a
  //   révélé que cinq bancs étaient aveugles à 58 liens morts.
  {
    const faux = ['RUN set -e; npm run build; node engine/lib/chrono_build.mjs fin'];
    const mord = faux.filter((l) => /chrono_build\.mjs\s+[a-z0-9-]+\s*$/.test(l.trim()));
    dire(mord.length === 1,
      '⑧ auto-contrôle : le détecteur mord sur un jalon fabriqué EN FIN de RUN',
      mord.length ? 'il voit le défaut qu\'il existe pour voir' : '🔴 le détecteur est aveugle, son vert ne vaut rien');
  }

  delete process.env.CHRONO_FICHIER;
  try { rmSync(dossier, { recursive: true, force: true }); } catch { /* rien */ }
}

console.log(echecs ? `\n❌ ${echecs} écart(s)\n` : '\n✅ les sondes du build sont branchées, et leurs rapports sortent du journal\n');
process.exit(echecs ? 1 : 0);
