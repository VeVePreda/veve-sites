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
import { lireTemoin } from '../lib/astro_temoin_build.mjs';

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
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 LOT 128 — ON DEMANDE D'ABORD AU BUILD CE QU'IL A DÉPOSÉ.
  // ═════════════════════════════════════════════════════════════════════════
  // CE QUI S'EST PASSÉ, MESURÉ LE 10/08 : Discord annonçait « les bancs sont
  // tombés sur `main` » pendant qu'un déploiement Coolify passait au vert. Les
  // deux avaient raison. La CI construit avec `WAREHOUSE_OFFLINE=1` — c'est
  // voulu — et hors ligne l'échantillon porte des uuid que la liste blanche
  // refuse : **1 cote et 90 lignes, toujours**. Le seuil « ≥ 200 cotes » écrit
  // ci-dessous au lot 125 était donc INTENABLE en CI, et tenable dans le
  // Dockerfile, qui construit en ligne. Un banc rouge pour une mauvaise raison
  // coûte plus cher qu'un banc absent : on finit par ignorer sa couleur, et
  // c'est arrivé — le message Discord a été lu comme du bruit.
  //
  // ⚠️ ET `cote.mjs` LE DISAIT DÉJÀ, depuis le 07/08, quatre lignes au-dessus du
  // code concerné : « `.reserve/cote/` sort VIDE de tout build hors reseau —
  // donc de la CI. » La phrase était juste, elle était là, et le lot 125 a écrit
  // le seuil quand même. *Un avertissement qui ne se MESURE pas finit lu sans
  // être suivi.* ⇒ il est devenu un fichier : `.reserve/_temoin-build.json`.
  //
  // ⭐⭐⭐ LE TÉMOIN REND LE CONTRÔLE PLUS STRICT, PAS PLUS SOUPLE. Avant, un
  // banc qui écrasait la réserve après un build EN LIGNE se voyait (1 201 → 1) ;
  // après un build HORS LIGNE il était invisible, la réserve valant déjà 1.
  // Maintenant on compare au chiffre que le build a SIGNÉ : les deux se voient.
  const temoin = lireTemoin(ROOT);
  const dossierCote = join(ROOT, '.reserve', 'cote');
  if (!existsSync(dossierCote)) {
    indecis('la cohérence projection ↔ réserve', '.reserve/cote/ absent');
  } else {
    const cotes = new Set(readdirSync(dossierCote).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));

    if (!temoin) {
      // ⛔ PAS DE TÉMOIN = INDÉCIDABLE, jamais « conforme ». Sans lui on ne
      // peut pas distinguer un échantillon d'une réserve écrasée : les deux
      // rendent exactement les mêmes chiffres.
      indecis('l\'origine de la réserve',
        '.reserve/_temoin-build.json absent — build antérieur au lot 128, ou build interrompu. '
        + `Constat brut : ${cotes.size} cote(s), ${charge.marche?.length ?? 0} ligne(s).`);
    } else {
      // ── ① CE QUE LE BUILD A DÉPOSÉ EST-IL TOUJOURS LÀ ?
      // 🔴 C'EST LE VRAI GARDE-FOU, et il vaut dans les DEUX mondes.
      verifie('⛔ la réserve est INTACTE depuis la fin du build',
        cotes.size === temoin.cotes && (charge.marche?.length ?? 0) === temoin.marche,
        cotes.size === temoin.cotes && (charge.marche?.length ?? 0) === temoin.marche
          ? `${cotes.size} cote(s) et ${charge.marche.length} ligne(s), comme à ${temoin.quand}`
          : `🔴 le build avait déposé ${temoin.cotes} cote(s) et ${temoin.marche} ligne(s) ; on en trouve `
            + `${cotes.size} et ${charge.marche?.length ?? 0}. Un banc qui importe dataset() a tourné APRÈS `
            + `npm run build et a réécrit la réserve sous ses pieds (panne des lots 101 et 113).`);

      // ── ② LES LIGNES ONT-ELLES LEUR COTE ?
      const orphelines = (charge.marche || []).filter((i) => !cotes.has(i.uuid));
      if (temoin.horsLigne) {
        // ⚠️ HORS LIGNE, L'ÉCHANTILLON N'A PAS DE VRAIS uuid : la liste blanche
        // les refuse tous, donc AUCUNE ligne n'a de cote — c'est le
        // comportement CORRECT, documenté dans `cote.mjs` depuis le 07/08.
        // ⛔ Rendre vert ici serait mentir ; rendre rouge aussi. Troisième verdict.
        indecis('l\'adossement des lignes à leurs cotes',
          `build HORS LIGNE (témoin) : l'échantillon porte des uuid que la liste blanche refuse, `
          + `donc ${orphelines.length} ligne(s) sans cote est NORMAL ici. Ce point ne se juge que sur un build en ligne — `
          + `le Dockerfile, lui, construit en ligne et le juge.`);
      } else {
        verifie('⛔ chaque ligne de la projection a SA cote dans .reserve/cote/',
          orphelines.length === 0,
          orphelines.length
            ? `🔴 ${orphelines.length} ligne(s) sur ${charge.marche.length} sans cote — ${cotes.size} fichier(s) dans .reserve/cote/.`
            : `${charge.marche.length} ligne(s) adossées à ${cotes.size} cote(s)`);
        // ⭐ Le volume — et il ne se demande QUE sur un build en ligne.
        verifie('…et la réserve a la taille d\'une réserve de PRODUCTION (≥ 200 cotes)',
          cotes.size >= 200,
          cotes.size >= 200 ? `${cotes.size} cotes` :
            `🔴 ${cotes.size} cote(s) sur un build EN LIGNE : la production en compte 1 201. `
            + `L'entrepôt a-t-il répondu ?`);
      }
    }
  }

  // ⭐⭐⭐ ON SORT SUR UNE MESURE, PAS SUR UNE DÉCLARATION. Le lot entier existe
  // pour un chiffre ; le banc doit tenir ce chiffre, pas la promesse qu'on l'a
  // tenu. 250 ms est large — la mesure du 10/08 donne 2 ms — et c'est voulu :
  // un seuil serré rougirait sur la charge d'un runner, pas sur une panne.
  verifie(`la lecture est RAPIDE (${ms} ms, seuil 250 ms — le remplaçant des 10 328 ms)`,
    ms < 250, `${ms} ms pour ${(octets / 1024).toFixed(0)} Ko`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. 🖼️ L'INDEX DES VIGNETTES — LOT 154-A
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ IL VIT ICI ET NON DANS UN 43ᵉ BANC. C'est le MÊME objet que la projection
// du marché — un fichier déposé au build, dans `.reserve/`, relu à la demande
// par une route de compte, et qui ne doit porter AUCUN montant. Un banc de plus
// aurait dupliqué `champsVus()`, `CHAMPS_COTE` et la règle du dossier jetable ;
// c'est la troisième fois que ce dépôt paie une seconde liste.
//
// 🔴🔴 CE QU'IL GARDE, ET LE DÉFAUT QU'IL RENDRAIT VISIBLE : `/favoris/` rend
// désormais des TUILES depuis cet index. S'il est vide, la page sort sans une
// seule couverture — une grille de gemmes grises, sans erreur, sans run rouge,
// et personne pour le dire. C'est exactement la forme de panne que ce projet
// paie le plus souvent : la dégradation muette.
console.log('\n6. l\'index des vignettes se dépose-t-il, et reste-t-il muet sur les montants ?');

{
  const DIRV = mkdtempSync(join(tmpdir(), 'vignettes-banc-'));
  process.env.RESERVE_VIGNETTES = join(DIRV, 'vignettes.json');
  const { deposerVignettes, lireVignettes, vignette, VIGNETTES_FICHIER } =
    await import('../lib/vignettes.mjs');

  verifie('le banc écrit dans un dossier temporaire, pas dans .reserve/',
    VIGNETTES_FICHIER === join(DIRV, 'vignettes.json'), VIGNETTES_FICHIER);

  const TEMOIN = {
    updatedAt: '2026-08-17T00:00:00.000Z',
    items: [
      { uuid: 'u-1', name: 'Piece une', qualifie: 'Serie — Piece une',
        path: '/collectibles/serie/piece-une/', rarity: 'RARE', edition_type: 'FA',
        image: 'https://exemple/collectible_type_image.u-1.autre.full.jpeg' },
      // ⭐ UNE ENTRÉE SANS IMAGE, DÉLIBÉRÉMENT : c'est le cas dégradé que la
      //   page doit savoir rendre, et le compteur du journal de build doit le
      //   voir. Un témoin dont toutes les lignes sont parfaites ne mesure que
      //   le cas facile.
      { uuid: 'u-2', name: 'Piece deux', path: '/comics/serie/2/rare/', rarity: 'COMMON' },
    ],
  };
  deposerVignettes(TEMOIN);
  const idx = lireVignettes();

  verifie('les deux entrées reviennent', Object.keys(idx).length === 2,
    `${Object.keys(idx).length} entrée(s)`);
  verifie('les clés courtes sont rendues en clair (image, rarity, edition_type)',
    idx['u-1'].image && idx['u-1'].rarity === 'RARE' && idx['u-1'].edition_type === 'FA',
    JSON.stringify(idx['u-1']));
  verifie('un champ absent ne devient pas une chaîne vide',
    idx['u-2'].image === undefined && idx['u-2'].edition_type === undefined,
    JSON.stringify(idx['u-2']));

  // ⭐⭐⭐ L'INDEX GAGNE SUR LE FAVORI, ET C'EST CE QU'ON MESURE — pas le
  //   contraire. Le nom rangé dans la base a été écrit par un navigateur, il
  //   peut avoir des mois ; l'index est reconstruit à chaque build.
  const v1 = vignette('u-1', { n: 'un nom d’il y a six mois', p: '/vieille/adresse/' });
  verifie('`vignette()` préfère le catalogue au nom rangé dans la base',
    v1.name === 'Piece une' && v1.path === '/collectibles/serie/piece-une/',
    `${v1.name} · ${v1.path}`);
  // ⚠️ …ET LE FAVORI RESTE LE REPLI. Un item sorti du catalogue ne doit pas
  //    disparaître de la liste de quelqu'un : il ressort dégradé, pas effacé.
  const v9 = vignette('u-inconnu', { n: 'Sorti du catalogue', p: '/ancienne/fiche/' });
  verifie('un favori absent de l\'index ressort dégradé, pas effacé',
    v9.name === 'Sorti du catalogue' && v9.path === '/ancienne/fiche/' && v9.image === null,
    `${v9.name} · sans couverture`);
  verifie('⛔ `vignette()` ne rend jamais de montant', v9.floor === null && v1.floor === null,
    'floor = null dans les deux cas');

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 LA CONTRE-ÉPREUVE — ON JUGE LE BANC EN LUI DONNANT LE MAUVAIS CODE
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ SANS ELLE, LE CONTRÔLE CI-DESSOUS EST UNE DÉCLARATION. « Aucun
  // montant dans l'index » est vrai d'un index VIDE, d'un index mal lu, et d'un
  // contrôle qui regarde la mauvaise clé. On lui présente donc un jeu qui
  // PORTE des montants, et on exige qu'ils n'arrivent PAS dans le dépôt —
  // c'est la liste FERMÉE `CHAMPS` de `vignettes.mjs` qui doit les arrêter.
  // *Un terme à zéro qui n'est atteignable par aucune entrée ne garde rien.*
  const PIEGE = {
    updatedAt: '2026-08-17T00:00:00.000Z',
    items: [{ uuid: 'p-1', name: 'Piege', path: '/x/', image: 'https://exemple/i.jpg',
      ...Object.fromEntries(CHAMPS_COTE.map((c) => [c, 42])) }],
  };
  process.env.RESERVE_VIGNETTES = join(DIRV, 'piege.json');
  const { deposerVignettes: deposer2 } = await import('../lib/vignettes.mjs?piege');
  deposer2(PIEGE);
  const brutPiege = JSON.parse(readFileSync(join(DIRV, 'piege.json'), 'utf8'));
  const fuitPiege = CHAMPS_COTE.filter((c) => JSON.stringify(brutPiege).includes(`"${c}"`));
  verifie('⛔ un item qui PORTE des montants les laisse tous à la porte',
    fuitPiege.length === 0,
    fuitPiege.length ? `🔴 ${fuitPiege.join(', ')} — la liste fermée CHAMPS a été élargie`
      : `${CHAMPS_COTE.length} champ(s) présentés, 0 déposé`);
  // ⭐ ET ON VÉRIFIE QUE LE PIÈGE ÉTAIT BIEN ARMÉ : si l'item témoin ne portait
  //   AUCUN montant, le contrôle ci-dessus serait vert pour rien.
  verifie('…et le piège portait bien de quoi fuir',
    CHAMPS_COTE.length > 0 && CHAMPS_COTE.every((c) => PIEGE.items[0][c] === 42),
    `${CHAMPS_COTE.length} champ(s) armés dans le témoin`);

  rmSync(DIRV, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. 🖼️ L'INDEX RÉELLEMENT DÉPOSÉ PAR LE BUILD
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Le §6 prouve que le contrôle SAIT rougir ; celui-ci prouve que la SORTIE
// est propre. Les deux moitiés, jamais l'une sans l'autre.
console.log('\n7. l\'index déposé par le build : est-il là, et est-il plein ?');

const VRAI_V = join(ROOT, '.reserve', 'vignettes.json');
if (!existsSync(VRAI_V)) {
  // ⚠️ INDÉCIDABLE ET NON ROUGE : ce banc tourne aussi hors d'un build (au
  //    dépôt, dans le bac à sable). « Je n'ai pas pu mesurer » n'est pas « c'est
  //    conforme », et ce n'est pas non plus « c'est cassé ».
  indecis('l\'index des vignettes n\'a pas été déposé ici',
    `${VRAI_V} absent — attendu hors build ; ANORMAL après \`npm run build\` sur veveprice`);
} else {
  const c = JSON.parse(readFileSync(VRAI_V, 'utf8'));
  const entrees = Object.keys(c.index || {});
  const avecImage = entrees.filter((u) => c.index[u].i);
  const octets = statSync(VRAI_V).size;

  verifie('il porte des entrées', entrees.length > 0,
    `${entrees.length} entrée(s) · ${(octets / 1024).toFixed(0)} Ko`);
  // 🔴🔴 LE CHIFFRE QUI COMPTE N'EST PAS LE NOMBRE D'ENTRÉES, C'EST LA PART
  // QUI PORTE UNE COUVERTURE. Un index complet dont aucune ligne n'a d'image
  // rendrait une page de gemmes grises — et les deux contrôles ci-dessus
  // seraient verts. ⭐ Le seuil est en PROPORTION, pas en valeur absolue : un
  // garde-fou absolu sur une grandeur qui grandit se désarme tout seul.
  const part = entrees.length ? avecImage.length / entrees.length : 0;
  verifie('…et au moins 8 entrées sur 10 portent une couverture',
    part >= 0.8,
    `${avecImage.length} / ${entrees.length} (${(part * 100).toFixed(1)} %)`);

  const fuitV = CHAMPS_COTE.filter((ch) => JSON.stringify(c).includes(`"${ch}"`));
  verifie('⛔ aucun montant dans l\'index réellement déposé', fuitV.length === 0,
    fuitV.length ? `🔴 ${fuitV.join(', ')} — deposerVignettes() est passée AVANT projeterCote()`
      : `0 sur ${CHAMPS_COTE.length} champs`);

  // ⭐ LA COHÉRENCE AVEC L'AUTRE DÉPÔT DU BUILD — même leçon qu'au §5 : un banc
  //   qui n'interroge qu'un seul fichier ne peut pas savoir que ce fichier est
  //   celui d'un build précédent. `itemsTotal` de `marche.json` compte les
  //   MÊMES items que l'index.
  if (existsSync(VRAI)) {
    const m = JSON.parse(readFileSync(VRAI, 'utf8'));
    verifie('…et il compte autant d\'items que la projection du marché en annonce',
      entrees.length === m.itemsTotal,
      entrees.length === m.itemsTotal ? `${entrees.length} des deux côtés`
        : `🔴 ${entrees.length} contre ${m.itemsTotal} : les deux dépôts ne viennent pas du même build`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  ko === 0 && indecidable === 0 ? '\n✅ marché : tout est conforme'
  : ko === 0 ? `\n⚠️  marché : conforme, mais ${indecidable} point(s) INDÉCIDABLE(S) — voir ci-dessus`
  : `\n❌ marché : ${ko} écart(s)`);
process.exit(ko === 0 ? 0 : 1);
