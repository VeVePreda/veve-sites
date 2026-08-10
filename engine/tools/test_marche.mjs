// ⚠️ VeVePreda/veve-sites — engine/tools/test_marche.mjs
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 125 — LE BANC DE LA PAGE RENDUE À LA DEMANDE
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'IL GARDE, ET LA MESURE QUI L'A FAIT NAÎTRE (10/08/2026, serveur réel
// lancé dans le bac à sable, `/market/` demandée par curl) :
//
//     1ʳᵉ requête ......... 10 440 ms      ← ce que voyait Preda
//     requêtes suivantes ..     55 ms
//       dont `await dataset()` froid ... 10 328 ms   (99 %)
//       dont `lireCotes(200)` ..........      3 ms
//
// ⭐⭐⭐ LE SOUPÇON ÉCRIT DANS LA MÉMOIRE DU PROJET ÉTAIT FAUX. Il désignait
// « 200 fichiers JSON ouverts à chaque requête ». Ces 200 lectures coûtent
// TROIS MILLISECONDES. Un avertissement qui survit à sa cause se cite et
// empêche de regarder — c'est précisément pour ça que ce banc MESURE au lieu
// de déclarer.
//
// LA PANNE, telle qu'elle se reproduirait : quelqu'un rajoute un `await
// dataset()` dans une page de `ROUTES_COMPTE` parce qu'il lui manque un champ.
// Le build est vert, les 32 bancs sont verts, la page répond 200 — et le
// premier visiteur après chaque déploiement attend dix secondes pendant que le
// serveur retélécharge 2,37 millions de lignes de prix et réécrit
// `.reserve/cote/` sous ses propres pieds.
// ⛔ AUCUN AUTRE BANC NE PEUT LE VOIR : `test:pages` (lot 124) demande bien
// `/market/`, mais sans session il reçoit un 302 et n'atteint jamais le rendu.
//
// ⚠️ IL N'IMPORTE PAS `dataset.mjs`, ET C'EST OBLIGATOIRE : un banc qui
// l'importe recalcule la vitrine et VIDE `.reserve/cote/`. C'est la règle
// « tout banc qui importe dataset() va AVANT npm run build », payée deux fois.
// Celui-ci lit le disque et le texte des fichiers, rien d'autre — il peut donc
// se placer après le build, là où la projection existe.

import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(ICI, '..', '..');

let ko = 0;
let indecidable = 0;
const verifie = (titre, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};
// ⭐⭐⭐ TROIS VERDICTS, PAS DEUX. « Je n'ai pas pu mesurer » n'est pas
// « c'est conforme ». Un banc qui rend vert faute de matière est un banc qui
// ment, et il ment dans le sens le plus dangereux.
const indecis = (titre, pourquoi) => {
  console.log(`  ⚠️  INDÉCIDABLE — ${titre}   — ${pourquoi}`);
  indecidable++;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. LA PROJECTION SE RELIT — aller-retour complet, dans un dossier jetable
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ Sur un `mktemp`, JAMAIS sur `.reserve/` : un banc qui écrit dans la
// réserve du build serait exactement le défaut qu'il prétend surveiller.
console.log('\n1. la projection du marché se dépose-t-elle et se relit-elle ?');

const DIR = mkdtempSync(join(tmpdir(), 'marche-banc-'));
process.env.RESERVE_MARCHE = join(DIR, 'marche.json');

const { deposerMarche, lireMarche, MARCHE_FICHIER, CHAMPS_COTE } = await import('../lib/cote.mjs');

verifie('le banc écrit dans un dossier temporaire, pas dans .reserve/',
  MARCHE_FICHIER === join(DIR, 'marche.json'), MARCHE_FICHIER);

const FAUX = {
  items: new Array(19412).fill(0).map((_, n) => ({ uuid: `x${n}` })),
  marcheTotal: 1200,
  updatedAt: '2026-08-10T00:00:00.000Z',
  marche: new Array(200).fill(0).map((_, n) => ({
    uuid: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name: `piece ${n}`, series: 'serie', type: 'collectible',
    rarity: 'RARE', path: `/collectibles/serie/piece-${n}/`,
    // ⛔ NI `change7d` NI `floor` : le témoin doit ressembler à une projection
    //    RÉELLE, c'est-à-dire à un `ds.marche` qui a DÉJÀ traversé
    //    `projeterCote()`. La première version de ce banc en portait un, et le
    //    §2 l'a attrapée — j'ai corrigé le TÉMOIN, pas la règle. Un banc qu'on
    //    assouplit pour qu'il passe ne garde plus rien.
    //    ⚠️ `change7d` EST dans CHAMPS_COTE depuis le lot 117 : la variation est
    //    un produit, pas une statistique neutre. Elle revient à la page par
    //    `lireCotes()`, derrière le mur, jamais par la projection.
    tirage: 1000, listings: 3,
  })),
};

deposerMarche(FAUX);
const relu = lireMarche();

verifie('les 200 lignes reviennent', relu.marche.length === 200, `${relu.marche.length} ligne(s)`);
verifie('le TOTAL avant plafond survit au voyage', relu.marcheTotal === 1200, String(relu.marcheTotal));
verifie('`itemsTotal` remplace `items` (le nombre, pas les 19 412 objets)',
  relu.itemsTotal === 19412 && relu.items === undefined,
  relu.items === undefined ? `${relu.itemsTotal} — et les objets ne voyagent pas`
    : '🔴 `items` voyage : la projection porte 19 412 objets pour en rendre 200');
verifie('elle porte sa date de génération', typeof relu.genereLe === 'string' && relu.genereLe.length > 10, relu.genereLe);

// ⭐⭐⭐ LE TÉMOIN NON DÉSARMÉ, et il est le cœur du lot.
// Sans cette ligne, un `lireMarche()` qui retomberait silencieusement sur
// `dataset()` passerait ce banc en vert — en réintroduisant les dix secondes.
// « Un repli légitime est la meilleure cachette d'une panne. »
rmSync(join(DIR, 'marche.json'));
let aLeve = false;
let message = '';
try { lireMarche(); } catch (e) { aLeve = true; message = e.message; }
verifie('⛔ SANS FICHIER, `lireMarche()` LÈVE — elle ne retombe PAS sur dataset()',
  aLeve, aLeve ? 'et le message nomme les trois causes' : '🔴 un repli existe : la panne serait invisible et coûterait 10 s par visite');
verifie('et le message dit où chercher, pas seulement que ça a raté',
  aLeve && message.includes('.reserve') && message.includes('dataset()'),
  aLeve ? message.slice(0, 90) + '…' : '');

// ═══════════════════════════════════════════════════════════════════════════
// 2. LA PROJECTION NE PORTE AUCUN MONTANT
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 `deposerMarche()` est appelée APRÈS `projeterCote()`, et l'ordre est tout
// le dispositif. Un cran plus haut, elle écrirait `floor`, `ath`, `atl`,
// `prixMedian` et `p95` en clair dans un fichier de l'image — la fuite du lot
// 101, refaite par la porte d'à côté.
// ⚠️ Le fichier n'est pas dans `dist/` : `test:fuite` ne le balaie donc PAS.
// Ce contrôle-ci est le seul qui regarde de ce côté.
console.log('\n2. la projection ne transporte-t-elle aucun montant ?');

const champsVus = (charge) => {
  const vus = new Set();
  for (const i of charge.marche || []) {
    for (const c of CHAMPS_COTE) if (i[c] !== undefined) vus.add(c);
  }
  return [...vus];
};

verifie('aucun champ de cote dans la projection témoin', champsVus(FAUX).length === 0,
  champsVus(FAUX).length ? `🔴 ${champsVus(FAUX).join(', ')}` : `0 sur ${CHAMPS_COTE.length} champs surveillés`);

// ⭐⭐ LA CONTRE-ÉPREUVE. Une règle qu'on n'a jamais vue rougir n'est pas une
// règle, c'est une phrase. On fabrique la faute et on exige que le contrôle
// ci-dessus l'attrape — sinon il ne prouvait rien.
const PIEGE = { ...FAUX, marche: [{ ...FAUX.marche[0], floor: 49, ath: 120 }] };
verifie('…et le même contrôle ATTRAPE une projection qui en porterait',
  champsVus(PIEGE).length >= 2, champsVus(PIEGE).join(', ') || '🔴 le contrôle ne voit rien : il ne prouve rien');

rmSync(DIR, { recursive: true, force: true });

// ═══════════════════════════════════════════════════════════════════════════
// 3. AUCUNE PAGE RENDUE À LA DEMANDE N'APPELLE `dataset()`
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ C'EST LE GARDE-FOU DE RÉGRESSION, et il balaie les pages ET les
// composants qu'elles importent : `dataset()` n'était pas dans la page de
// marché, il était dans `Market.astro`, deux niveaux plus bas. Un contrôle qui
// ne lit que la page laisse passer exactement la panne qu'on vient de payer.
console.log('\n3. aucune route rendue à la demande n\'appelle dataset() ?');

const src = join(ROOT, 'engine', 'lib', 'astro_routes_compte.mjs');
let routes = [];
if (existsSync(src)) {
  const txt = readFileSync(src, 'utf8');
  const bloc = txt.slice(txt.indexOf('const ROUTES_COMPTE'), txt.indexOf('];', txt.indexOf('const ROUTES_COMPTE')));
  routes = [...bloc.matchAll(/'([^']+\.(?:astro|js|ts))'/g)].map((m) => m[1]);
}

if (!routes.length) {
  indecis('la liste des routes à la demande', 'ROUTES_COMPTE introuvable dans engine/lib/astro_routes_compte.mjs');
} else {
  // Suit les imports relatifs, sans quitter `src/`, jusqu'à 4 niveaux.
  const lu = new Set();
  const fautes = [];
  const suivre = (fichier, chaine, profondeur) => {
    if (profondeur > 4 || lu.has(fichier) || !existsSync(fichier)) return;
    lu.add(fichier);
    const txt = readFileSync(fichier, 'utf8');
    // ⛔ On cherche l'APPEL, pas l'import : `test:fuite` a payé la leçon
    //    inverse au lot 122 — « un import sans appel est un faux positif pour
    //    tout grep ». Ici c'est l'appel qui coûte les dix secondes.
    if (/\bdataset\s*\(\s*\)/.test(txt.replace(/^\s*\/\/.*$/gm, ''))) {
      fautes.push(`${relative(ROOT, fichier)}  (via ${chaine})`);
    }
    for (const m of txt.matchAll(/from\s+'(\.[^']+)'/g)) {
      const cible = resolve(dirname(fichier), m[1]);
      if (!cible.startsWith(join(ROOT, 'src'))) continue;
      suivre(cible, `${chaine} → ${m[1]}`, profondeur + 1);
    }
  };
  for (const r of routes) suivre(join(ROOT, 'src', r), r, 0);

  verifie('aucun `dataset()` dans les routes à la demande ni dans leurs composants',
    fautes.length === 0,
    fautes.length
      ? `\n      🔴 ${fautes.join('\n      🔴 ')}\n      ⇒ 10 s à la première requête après chaque redémarrage. Déposer la donnée au build (cf. lireMarche()).`
      : `${routes.length} route(s), ${lu.size} fichier(s) suivis`);

  // ⭐⭐ LA CONTRE-ÉPREUVE DU BALAYAGE : si le suivi d'imports ne descendait
  // pas jusqu'aux composants, la ligne au-dessus serait verte pour rien.
  // `Market.astro` EST atteint depuis `pages/market/index.astro` — on l'exige.
  const atteintMarket = [...lu].some((f) => f.endsWith(join('components', 'pages', 'Market.astro')));
  verifie('…et le balayage descend BIEN jusqu\'aux composants (Market.astro atteint)',
    atteintMarket, atteintMarket ? `${lu.size} fichiers suivis` :
      '🔴 le suivi d\'imports s\'arrête aux pages : un `dataset()` dans un composant passerait');
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. LA PROJECTION DU BUILD EST LÀ, ET ELLE EST COHÉRENTE
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. la projection déposée par le build (.reserve/marche.json) ?');

const VRAI = join(ROOT, '.reserve', 'marche.json');
if (!existsSync(VRAI)) {
  // ⚠️ Pas une faute EN SOI : sur vevewiki la porte « cote » est inactive et
  // il n'y a pas de page de marché. Mais ce n'est pas une réussite non plus.
  indecis('la projection du build', `${relative(ROOT, VRAI)} absent — normal sur vevewiki (porte « cote » inactive), anormal sur veveprice`);
} else {
  const t0 = Date.now();
  const charge = JSON.parse(readFileSync(VRAI, 'utf8'));
  const ms = Date.now() - t0;
  const octets = statSync(VRAI).size;

  verifie('elle porte des lignes', Array.isArray(charge.marche) && charge.marche.length > 0,
    `${charge.marche?.length ?? 0} ligne(s) · ${(octets / 1024).toFixed(0)} Ko`);
  verifie('le plafond de 200 est respecté', (charge.marche?.length ?? 0) <= 200, String(charge.marche?.length));
  verifie('le total avant plafond est au moins égal au rendu',
    (charge.marcheTotal ?? 0) >= (charge.marche?.length ?? 0), `${charge.marcheTotal} au total`);
  verifie('`itemsTotal` est renseigné (la page annonce ce nombre)',
    (charge.itemsTotal ?? 0) > 0, String(charge.itemsTotal));

  // 🔴 LE MÊME CONTRÔLE QU'AU §2, SUR LE VRAI FICHIER. Le témoin du §2 prouve
  // que le contrôle sait rougir ; celui-ci prouve que la SORTIE est propre.
  const fuit = champsVus(charge);
  verifie('⛔ aucun montant dans le fichier réellement déposé', fuit.length === 0,
    fuit.length ? `🔴 ${fuit.join(', ')} — deposerMarche() est passée AVANT projeterCote()` : `0 sur ${CHAMPS_COTE.length} champs`);

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 LA COHÉRENCE AVEC `.reserve/cote/` — ET ELLE M'A MANQUÉ D'ABORD.
  // ═════════════════════════════════════════════════════════════════════════
  // PAYÉ LE 10/08/2026, PENDANT L'ÉCRITURE DE CE LOT. J'ai joué `test:acces` et
  // `test:rayon` APRÈS `npm run build`, sous `WAREHOUSE_OFFLINE=1`. Ils
  // importent `dataset()` : il a recalculé la vitrine sur l'échantillon, et il
  // a RÉÉCRIT la réserve. Résultat mesuré :
  //     .reserve/cote/   1 201 fichiers → 1
  //     marche.json      200 lignes     → 90
  //
  // ⭐⭐⭐ ET LES QUATRE CONTRÔLES CI-DESSUS RESTAIENT VERTS. « 90 ≤ 200 » est
  // vrai, « 90 ≥ 90 » est vrai : une projection à 90 lignes est PARFAITEMENT
  // COHÉRENTE AVEC ELLE-MÊME. Un banc qui n'interroge qu'un seul fichier ne
  // peut pas savoir que ce fichier est le mauvais.
  // ⇒ On le confronte à l'AUTRE artefact du build. C'est la seule question qui
  //   distingue « 200 lignes justes » de « 90 lignes cohérentes ».
  //
  // ⚠️ CE LOT AJOUTE UN SECOND FICHIER À LA RÉSERVE, donc une seconde victime à
  // la règle « tout banc qui importe dataset() va AVANT npm run build ». Le
  // Dockerfile la tient déjà pour `.reserve/cote/` ; désormais elle protège
  // aussi `marche.json`, et cette ligne-ci est ce qui le MESURE.
  const dossierCote = join(ROOT, '.reserve', 'cote');
  if (!existsSync(dossierCote)) {
    indecis('la cohérence projection ↔ réserve', '.reserve/cote/ absent');
  } else {
    const cotes = new Set(readdirSync(dossierCote).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
    const orphelines = (charge.marche || []).filter((i) => !cotes.has(i.uuid));
    verifie('⛔ chaque ligne de la projection a SA cote dans .reserve/cote/',
      orphelines.length === 0,
      orphelines.length
        ? `🔴 ${orphelines.length} ligne(s) sur ${charge.marche.length} sans cote — ${cotes.size} fichier(s) dans .reserve/cote/. `
          + `Cause la plus probable : un banc qui importe dataset() a tourné APRÈS npm run build et a réécrit la réserve.`
        : `${charge.marche.length} ligne(s) adossées à ${cotes.size} cote(s)`);
    // ⭐ Et le volume : une réserve d'échantillon est petite ET cohérente.
    verifie('…et la réserve a la taille d\'une réserve de PRODUCTION (≥ 200 cotes)',
      cotes.size >= 200,
      cotes.size >= 200 ? `${cotes.size} cotes` :
        `🔴 ${cotes.size} cote(s) : c'est un échantillon, pas la production — le build a été recalculé hors ligne`);
  }

  // ⭐⭐⭐ ON SORT SUR UNE MESURE, PAS SUR UNE DÉCLARATION. Le lot entier existe
  // pour un chiffre ; le banc doit tenir ce chiffre, pas la promesse qu'on l'a
  // tenu. 250 ms est large — la mesure du 10/08 donne 2 ms — et c'est voulu :
  // un seuil serré rougirait sur la charge d'un runner, pas sur une panne.
  verifie(`la lecture est RAPIDE (${ms} ms, seuil 250 ms — le remplaçant des 10 328 ms)`,
    ms < 250, `${ms} ms pour ${(octets / 1024).toFixed(0)} Ko`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  ko === 0 && indecidable === 0 ? '\n✅ marché : tout est conforme'
  : ko === 0 ? `\n⚠️  marché : conforme, mais ${indecidable} point(s) INDÉCIDABLE(S) — voir ci-dessus`
  : `\n❌ marché : ${ko} écart(s)`);
process.exit(ko === 0 ? 0 : 1);
