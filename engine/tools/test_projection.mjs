// ⚠️ VeVePreda/veve-sites — engine/tools/test_projection.mjs   (FICHIER NEUF — lot 117)
// ═══════════════════════════════════════════════════════════════════════════
//  LE BANC DE LA PROJECTION — il ferme le CIRCUIT, pas seulement l'écriture
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 POURQUOI IL EXISTE. Le 10/08, trois pannes vivaient en même temps,
// toutes de la même famille, toutes sur un déploiement parfaitement vert :
//
//   1. `lireCotes()` appelait `readFileSync` sans l'importer. L'appel levait,
//      DANS UN `try/catch` écrit pour un JSON corrompu. `/market/` servait
//      200 lignes de tirets aux abonnés, avec un tri par prix mort.
//   2. `lastmod-prix.mjs` composait son empreinte de fiche sur `i.floor`,
//      `i.ath`, `i.atl`, `i.prixMedian`, `i.p95` — cinq champs PROJETÉS, donc
//      `undefined` pour tout le monde depuis le lot 101. Une fiche dont seul
//      le prix bougeait ne changeait plus de date au sitemap.
//   3. `Market.astro` traçait `sparkline(i.history, …)` — `history` est
//      supprimé par `projeter()`. La colonne « 7 j » était VIDE, et elle
//      avait l'air normale (« moins de 2 relevés => aucune courbe »).
//
// ⭐⭐⭐ CE QUE LES TROIS ONT EN COMMUN, ET C'EST ÇA QUE CE BANC MESURE :
// **un lecteur placé APRÈS la projection lit du vide sans le dire.** Ni
// exception, ni banc rouge, ni ligne de log — parce que dans les trois cas le
// résultat du vide était un cas déjà prévu : `{}`, une constante, `''`.
// *Un repli qui a une bonne raison d'exister est la meilleure cachette d'une
// panne : il rend le symptôme attendu.*
//
// ⛔ ET LE CONTRÔLE QUI EXISTAIT NE POUVAIT PAS LES VOIR. Le Dockerfile
// compte les FICHIERS de `.reserve/cote/` et arrête le déploiement s'il n'y en
// a aucun — il a d'ailleurs sauvé la mise en ligne du 10/08. Mais compter des
// fichiers prouve l'ÉCRITURE. Aucun contrôle ne prouvait la LECTURE.
// ⭐ « Qui écrit, qui lit ? » — ici on répond aux DEUX.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE BANC IMPORTE `dataset()` : IL VA **AVANT** `npm run build`.
// ═══════════════════════════════════════════════════════════════════════════
// Sous `WAREHOUSE_OFFLINE=1`, `dataset()` RECALCULE sur `engine/data/sample/`,
// et `projeter()` puis `reserve.fermer()` s'exécutent POUR DE BON : placé après
// le build, ce fichier VIDERAIT `.reserve/cote/` (1 201 → 0). C'est la panne du
// lot 101, repayée à l'identique par `test:rayon` au lot 113.
// ⭐⭐⭐ UN BANC QUI RECALCULE CE QU'IL DOIT JUGER NE LE JUGE PLUS, IL LE
// REMPLACE. ⛔ Ne jamais descendre cette ligne dans le Dockerfile.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let ko = 0;
const verifie = (titre, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. L'ALLER-RETOUR DE LA RÉSERVE — le contrôle qui manquait
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ IL TOURNE DANS SON PROPRE DOSSIER (`RESERVE_COTE_DIR` sur un `mktemp`),
// et JAMAIS sur `.reserve/cote/` : un banc qui écrit dans la réserve du build
// serait exactement le défaut qu'il prétend surveiller.
// ⭐ Il est en PREMIER et il n'a besoin d'aucun dataset : c'est le contrôle le
// moins cher du dépôt, et il aurait vu la panne la plus coûteuse.
console.log('\n1. la réserve de cote se relit-elle ? (aller-retour complet)');
const DIR = mkdtempSync(join(tmpdir(), 'cote-banc-'));
process.env.RESERVE_COTE_DIR = DIR;

const { lireCotes, uuidValide, CHAMPS_COTE, COTE_DIR, JOURNAL, coteFermee } =
  await import('../lib/cote.mjs');

verifie('le banc écrit bien dans un dossier temporaire, pas dans .reserve/',
  COTE_DIR === DIR, COTE_DIR);

const UUID_A = '11111111-2222-3333-4444-555555555555';
const UUID_B = '99999999-8888-7777-6666-555555555555';
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, `${UUID_A}.json`), JSON.stringify({ floor: 1234, listings: 7, change7d: -3.5 }), 'utf8');

const lu = lireCotes([UUID_A]);
verifie('une cote déposée revient par lireCotes()', !!lu[UUID_A],
  Object.keys(lu).length ? JSON.stringify(lu[UUID_A]) :
    'lireCotes() rend {} — /market/ servirait 200 lignes de tirets aux abonnés');
verifie('elle revient ENTIÈRE (le montant, pas seulement la clé)',
  lu[UUID_A]?.floor === 1234 && lu[UUID_A]?.change7d === -3.5,
  JSON.stringify(lu[UUID_A] ?? null));

// ⭐⭐⭐ LE TÉMOIN NON DÉSARMÉ. Sans cette ligne, un `lireCotes()` qui rendrait
// n'importe quoi pour n'importe quel uuid passerait les deux contrôles
// ci-dessus. *Un banc qu'on ne peut pas faire rougir ne mesure rien.*
const absent = lireCotes([UUID_B]);
verifie('et un uuid SANS fichier ne revient pas (témoin)',
  !absent[UUID_B] && Object.keys(absent).length === 0, JSON.stringify(absent));
verifie('un uuid mal formé est refusé sans composer de chemin (témoin)',
  !uuidValide('../../dist/index.html') && Object.keys(lireCotes(['../../dist/index.html'])).length === 0);

// ═══════════════════════════════════════════════════════════════════════════
// 2. LA PROJECTION A-T-ELLE EU LIEU, ET SUR QUOI ?
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LE BANC SE JOUE SUR LES DEUX SITES, ET IL N'Y ATTEND PAS LA MÊME
// CHOSE — écrit après l'avoir joué sur `vevewiki` et l'avoir vu rougir 3 fois.
// ═══════════════════════════════════════════════════════════════════════════
// `projeter()` SORT IMMÉDIATEMENT quand la porte « cote » est inactive : sur un
// site gratuit, les prix RESTENT sur les items, il n'y a ni journal, ni
// `courbe`, ni réserve. C'est voulu — `test:acces` en fait déjà sa
// contre-épreuve (« et elle ne retire RIEN quand la porte est inactive »).
// ⛔ Un banc qui exigerait l'absence des champs PARTOUT réclamerait donc que le
// site gratuit se casse. ⭐⭐⭐ *Un contrôle qui ne connaît qu'une des deux
// configurations en fait une norme, et transforme l'autre en panne.*
// ⚠️ Le manifeste décide, le banc obéit — même dispositif que `coteFermee()`.
console.log('\n2. les champs de cote quittent-ils les objets publics ?');
process.env.SITE = process.env.SITE || 'veveprice';
const { dataset } = await import('../lib/dataset.mjs');
const ds = await dataset();
const FERMEE = coteFermee();
console.log(`   (site « ${process.env.SITE} » — porte « cote » ${FERMEE ? 'ACTIVE' : 'INACTIVE'})`);

const restants = new Map();
for (const i of ds.items) {
  for (const c of CHAMPS_COTE) if (i[c] !== undefined) restants.set(c, (restants.get(c) || 0) + 1);
  if (i.history !== undefined) restants.set('history', (restants.get('history') || 0) + 1);
}
if (FERMEE) {
  verifie(`aucun des ${CHAMPS_COTE.length} champs de cote ne survit sur un item`,
    restants.size === 0,
    restants.size ? [...restants].map(([c, n]) => `${c}×${n}`).join(' · ') : `${ds.items.length} fiches propres`);
} else {
  // ⭐ LA CONTRE-ÉPREUVE, et elle n'est pas décorative : un `projeter()` qui
  //   s'appliquerait TOUJOURS passerait le contrôle ci-dessus et casserait le
  //   classement du site gratuit en silence.
  verifie('les champs de cote RESTENT là où la porte est inactive',
    restants.size > 0, `${restants.size} champ(s) conservé(s) : ${[...restants.keys()].join(', ')}`);
}

// ⭐ La liste est LUE, pas recopiée : le jour où un champ y entre, ce banc le
// suit tout seul. ⛔ Mais on vérifie quand même que la dette du lot 112 est
// bien payée — c'est une DÉCISION, pas une propriété du code.
verifie('`change7d` et `change30d` sont désormais dans CHAMPS_COTE (dette du lot 112)',
  CHAMPS_COTE.includes('change7d') && CHAMPS_COTE.includes('change30d'),
  CHAMPS_COTE.join(', '));

// La contrepartie : ce qui est retiré du public doit être DÉPOSÉ, sinon on n'a
// pas fermé une porte, on a perdu une donnée.
// ⚠️ On lit le JOURNAL et pas les fichiers servis : hors réseau, l'échantillon
// porte des uuid `sample-…` que la liste blanche refuse TOUS, donc
// `.reserve/cote/` sort vide de la CI. Le journal, lui, est écrit pour tous.
const chemin = join(COTE_DIR, JOURNAL);
const journal = existsSync(chemin) ? JSON.parse(readFileSync(chemin, 'utf8')) : null;
verifie(FERMEE ? 'le journal de projection existe'
               : 'et aucun journal n\'est écrit (rien n\'a été retiré)',
  FERMEE ? !!journal : !journal, chemin);
const valeurs = Object.values(journal?.valeurs || {});
// ⭐⭐⭐ TROIS VERDICTS, PAS DEUX : conforme · écart · INDÉCIDABLE.
// Hors réseau, `engine/data/sample/` n'a pas sept jours d'historique : TOUTES
// les fiches ont `change7d === null`, et `deposer()` ne stocke pas les nuls.
// Le journal sortirait donc sans une seule variation — et faire ROUGIR le banc
// là-dessus apprendrait à l'ignorer, ce qui est pire que de ne pas le poser.
// ⛔ MAIS SE TAIRE SERAIT PIRE ENCORE : un contrôle qui répond « pas
// d'échantillon » est un contrôle qui n'a rien mesuré, et il doit le DIRE, à
// voix haute, à chaque build. En production, `movers` n'est jamais vide : le
// verdict y est décidable, et l'écart y est un vrai écart.
const bougeantes = (ds.movers?.up?.length || 0) + (ds.movers?.down?.length || 0);
if (!FERMEE) {
  console.log('  ⏸️  sans objet ici — la porte est inactive, rien n\'est déposé.');
} else if (bougeantes === 0) {
  console.log('  ⏸️  INDÉCIDABLE — aucune fiche n\'a de variation 7 j non nulle dans cette'
    + ' source (attendu sur engine/data/sample/, ANORMAL sur le catalogue réel).'
    + ' Le dépôt des variations au journal n\'a donc pas pu être exercé ici.');
} else {
  verifie('et il porte les variations retirées, pas seulement les planchers',
    valeurs.some((c) => c.change7d !== undefined || c.change30d !== undefined),
    `${valeurs.length} entrée(s) au journal · ${bougeantes} fiche(s) en mouvement`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. L'EMPREINTE DES PRIX EST-ELLE PRISE **AVANT** LA PROJECTION ?
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ UNE IDENTITÉ, PAS UN SEUIL, ET C'EST TOUT L'INTÉRÊT DE CE CONTRÔLE.
// Si `empreinteCote` descendait sous `projeterCote()` — le geste le plus
// naturel du monde en réorganisant `dataset()` — elle scellerait onze
// `undefined` pour CHAQUE fiche : toutes les empreintes seraient LA MÊME.
// Le sitemap dirait alors « plus rien ne bouge » pour toujours, sans erreur.
// On ne mesure donc pas une valeur, on mesure une PROPRIÉTÉ : des prix
// différents doivent produire des empreintes différentes.
// ⛔ Un `> 0` ou un nombre magique ici mesurerait l'échantillon dont il vient.
console.log('\n3. l\'empreinte des prix est-elle scellée pendant qu\'ils existent ?');
verifie('`dataset()` rend `empreinteCote`', ds.empreinteCote instanceof Map,
  ds.empreinteCote instanceof Map ? `${ds.empreinteCote.size} entrée(s)` : String(ds.empreinteCote));
verifie('une empreinte par fiche publiée',
  ds.empreinteCote?.size === ds.items.length, `${ds.empreinteCote?.size} / ${ds.items.length}`);

const distinctes = new Set(ds.empreinteCote?.values() || []).size;
// ⛔ CE CONTRÔLE N'A PAS ROUGI À SA PREMIÈRE ÉCRITURE, ET LA RAISON VAUT LA
//    PEINE D'ÊTRE GARDÉE : l'empreinte scellait aussi `listings` et
//    `offresMedianes`, qui SURVIVENT à la projection. Descendue par erreur
//    sous `projeterCote()`, elle restait donc différente d'une fiche à
//    l'autre — le banc restait vert sur une empreinte sans un seul prix.
//    ⭐⭐⭐ *Un instrument dont le signal a une seconde source de variation
//    mesure la seconde.* Elle ne scelle plus que `CHAMPS_COTE`.
verifie('des prix différents donnent des empreintes DIFFÉRENTES',
  ds.items.length < 2 || distinctes > 1,
  distinctes > 1 ? `${distinctes} empreintes distinctes sur ${ds.items.length} fiches`
    : 'TOUTES IDENTIQUES — l\'empreinte est calculée APRÈS projeterCote(), elle scelle des undefined');
verifie('`empreinteMarche` existe et n\'est pas vide',
  typeof ds.empreinteMarche === 'string' && ds.empreinteMarche.length > 0, String(ds.empreinteMarche));

// ═══════════════════════════════════════════════════════════════════════════
// 4. CE QUE LE MARCHÉ RENDRA VRAIMENT — la courbe et la clé de tri
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ On ne rend pas la page (elle est servie à la demande, pas au build) : on
// exerce les DEUX fonctions dont elle dépend, sur SA liste (`ds.marche`).
console.log('\n4. la page /market/ a-t-elle de quoi tracer et de quoi trier ?');
const { sparklineNormalisee } = await import('../lib/vitrine.mjs');

// ⚠️ `courbe` N'EXISTE QUE SI LA PROJECTION A TOURNÉ : c'est elle qui la
//    fabrique en normalisant `history`. Sur un site à porte inactive, il n'y a
//    ni `courbe` ni page `/market/` réservée — la question ne se pose pas, et
//    le dire est plus utile que de la déclarer verte.
if (!FERMEE) {
  console.log('  ⏸️  sans objet ici — pas de projection, donc pas de `courbe` :'
    + ' le gabarit trace `history` par son chemin d\'origine.');
} else {
  // 🔴 LOT 123 — LA COURBE A CHANGÉ D'ENDROIT, ET CE CONTRÔLE AVEC ELLE.
  //   Elle ne vit plus sur les items (`i.courbe`) : `projeter()` la dépose
  //   dans `.reserve/cote/<uuid>.json`, derrière la porte `cote`. La fiche ne
  //   la reçoit plus qu'après un appel d'API qui a lu une session.
  // ⭐⭐ CE BANC A ROUGI TOUT SEUL SUR CE DÉPLACEMENT (« 0 / 0 tracée(s) »),
  //   et c'est ce qu'on lui demande : il mesurait `ds.marche[].courbe`, une
  //   propriété qui n'existe plus. On ne le désarme pas — on le rebranche là
  //   où la donnée est allée.
  // ⛔ ON LIT LE JOURNAL, PAS LES FICHIERS SERVIS : hors réseau, l'échantillon
  //   porte des uuid « sample-… » que la liste blanche refuse tous, donc
  //   `.reserve/cote/` sort vide de la CI. Le journal, lui, est écrit pour tous.
  const avecCourbe = valeurs.filter((c) => Array.isArray(c.courbe) && c.courbe.length >= 2);
  const tracées = avecCourbe.filter((c) => sparklineNormalisee(c.courbe, null).startsWith('<svg'));
  verifie('la courbe est déposée DANS LA RÉSERVE, et elle se trace',
    avecCourbe.length > 0 && tracées.length === avecCourbe.length,
    `${tracées.length} / ${avecCourbe.length} tracée(s) sur ${valeurs.length} cote(s)`);

  // ⭐⭐⭐ ET LA CONTRE-ÉPREUVE, qui est le vrai sujet du lot 123 : la courbe
  //   ne doit PLUS voyager dans le jeu de données public. Sans elle, la ligne
  //   ci-dessus resterait verte le jour où quelqu'un la remettrait sur les
  //   items « pour que le gabarit y accède plus simplement » — et elle
  //   repartirait dans le HTML des 3 000 fiches.
  const surItems = ds.items.filter((i) => i.courbe !== undefined).length;
  verifie('et elle ne voyage plus sur les items publics', surItems === 0,
    surItems ? `${surItems} item(s) portent encore \`courbe\` — elle repartirait dans le HTML`
             : `${ds.items.length} items sans courbe`);
}

// ⭐ Le point le plus BAS d'une série normalisée vaut 0. `sparkline()` filtrait
//   `v > 0` : reprendre ce filtre aurait jeté ce point, et aplati la courbe
//   d'un cran sans que rien ne le dise.
const svgTemoin = sparklineNormalisee([[1, 0], [2, 500], [3, 1000]], 4.2);
verifie('le minimum normalisé (0) n\'est pas jeté par le filtre',
  (svgTemoin.match(/[ML]\d/g) || []).length >= 3, `${(svgTemoin.match(/[ML]\d/g) || []).length} point(s) tracé(s)`);
verifie('moins de 2 points ne rend RIEN (pas une ligne plate — témoin)',
  sparklineNormalisee([[1, 500]], 0) === '' && sparklineNormalisee(undefined, 0) === '');

// La clé de tri : `/market/` trie côté client sur `data-floor` et `data-ch`,
// remplis depuis la réserve fusionnée. Si la réserve ne se relit pas (panne 1),
// les deux sont vides et les quatre tris par prix/variation sont morts.
// ⭐ On rejoue la fusion exacte du gabarit, sur un témoin déposé nous-mêmes.
// 🔴 LE TÉMOIN SE REDÉPOSE ICI, ET CE N'EST PAS UN DÉTAIL : `projeter()` VIDE
//    `COTE_DIR` au début de chaque passage (« une cote de la veille servie pour
//    un prix du jour serait pire qu'une absence »). Le fichier écrit en §1 a
//    donc été effacé par `dataset()` — c'est ce banc qui l'a montré, en
//    rougissant, à sa première exécution. ⭐ Un banc qui n'a jamais rougi n'a
//    jamais été branché.
const temoinUuid = UUID_A;
writeFileSync(join(DIR, `${temoinUuid}.json`),
  JSON.stringify({ floor: 1234, listings: 7, change7d: -3.5 }), 'utf8');
const fusion = { ...(ds.marche[0] || {}), ...(lireCotes([temoinUuid])[temoinUuid] || {}) };
verifie('la fusion « item + cote » rend bien une clé de tri numérique',
  Number.isFinite(Number(fusion.floor)) && Number.isFinite(Number(fusion.change7d)),
  `floor=${fusion.floor} · change7d=${fusion.change7d}`);

// ═══════════════════════════════════════════════════════════════════════════
// 5. AUCUN GABARIT NE LIT `history` SANS REPLI — le contrôle STATIQUE
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ LES §1-4 EXERCENT DU CODE ; CELUI-CI LIT LE CODE, ET C'EST NÉCESSAIRE.
// La panne n° 3 du 10/08 vivait dans un GABARIT servi à la demande
// (`Market.astro`), que le build ne rend jamais : aucun banc dynamique hors
// réseau ne peut l'atteindre. Elle ne se voyait qu'en lisant la ligne.
// ⛔ `history` est SUPPRIMÉ par `projeter()`. Un gabarit qui le lit lit
// `undefined` — et `[...undefined]` LÈVE, tandis que `f(undefined)` se contente
// de rendre du vide. C'est la seconde forme qui est dangereuse.
// ⭐ Le repli `|| []` / `?? []` est donc EXIGÉ, pas toléré : il rend l'absence
// explicite à la lecture, au lieu de la laisser se deviner.
console.log('\n5. aucune lecture de `history` qui ne soit pas NOMMÉE');
// ⭐⭐⭐ UNE LISTE BLANCHE, PAS UNE HEURISTIQUE — et c'est le seul choix qui
// tient. Une lecture de `history` peut être parfaitement légitime : sur
// vevewiki la porte `cote` est inactive, `projeter()` sort tout de suite, et le
// champ existe. Un contrôle qui déduirait la légitimité de la FORME de la ligne
// (« y a-t-il un `|| []` ? », « le mot coteFermee est-il à côté ? ») dirait tôt
// ou tard le contraire de la vérité, dans les deux sens.
// ⛔ On n'essaie donc pas de deviner : ON N'AUTORISE QUE CE QU'ON NOMME, avec
// la raison écrite à côté. Le jour où une ligne change, le banc rougit et
// demande qu'on réécrive la raison — ce qui est exactement le moment où il faut
// se reposer la question. Même règle que la liste blanche du Rayon (lot 113).
const LECTURES_NOMMEES = [
  // 🔴 LOT 123 — L'AUTORISATION `priceChartSVG(item.history,` A ÉTÉ RETIRÉE.
  //   Le ternaire qu'elle couvrait n'existe plus : `svg` a disparu d'Item.astro
  //   avec le bloc de graphe public, mort depuis le lot 101.
  // ⭐⭐⭐ C'EST LE CONTRÔLE « aucune autorisation ne survit à la ligne qu'elle
  //   autorisait » QUI L'A DIT, à la première exécution après le changement.
  //   Écrit deux lots plus tôt en pensant à un futur lointain — il a servi
  //   trois jours après. *Une liste blanche qu'on ne nettoie pas devient une
  //   liste blanche vide qui a l'air pleine.*
  { motif: '[...(item.history || [])]',
    ou: 'src/components/pages/Item.astro',
    raison: 'repli explicite posé au lot 101 — `[...undefined]` LÈVE, et un '
          + 'frontmatter qui plante fait échouer les 1 200 pages, pas une.' },
];

const { readdirSync } = await import('node:fs');
const fichiersAstro = [];
(function balayer(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const chem = join(d, e.name);
    if (e.isDirectory()) balayer(chem);
    else if (e.name.endsWith('.astro')) fichiersAstro.push(chem);
  }
})('src');

// ⚠️ LES COMMENTAIRES D'ABORD, ET LES TROIS FORMES. Un contrôle qui lit aussi
//    les commentaires rougit sur ses propres explications : défaut payé le
//    07/08 (un `grep` de cron qui lisait une ligne commentée). Ici il y en a
//    trois à retirer — `//`, `/* */` et le `{/* */}` propre à Astro.
const decommenter = (l) => l
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')
  .replace(/^\s*[*]\s.*$/, ' ')
  .replace(/^\s*(\{?\/\*|\/\/).*$/, ' ')
  .replace(/\/\/.*$/, ' ');

const nues = [];
const vues = new Set();
for (const f of fichiersAstro) {
  readFileSync(f, 'utf8').split('\n').forEach((l, n) => {
    const code = decommenter(l);
    if (!/\b\w+\.history\b/.test(code)) return;
    const connue = LECTURES_NOMMEES.find((a) => code.includes(a.motif) && f.endsWith(a.ou.split('/').pop()));
    if (connue) { vues.add(connue.motif); return; }
    nues.push(`${f}:${n + 1}  ${l.trim().slice(0, 88)}`);
  });
}
verifie('aucune lecture de `history` hors de la liste blanche',
  nues.length === 0,
  nues.length ? `\n      ${nues.join('\n      ')}` : `${fichiersAstro.length} gabarits balayés`);

// ⭐⭐⭐ ET LA CONTRE-ÉPREUVE, SANS LAQUELLE LA LIGNE AU-DESSUS NE PROUVE RIEN.
// Une autorisation dont le motif ne correspond plus à aucune ligne est une
// autorisation MORTE : elle ne protège plus rien et elle continue d'excuser.
// C'est le mécanisme par lequel une liste blanche devient, avec le temps, une
// liste blanche vide qui a l'air pleine.
const mortes = LECTURES_NOMMEES.filter((a) => !vues.has(a.motif)).map((a) => a.motif);
verifie('et aucune autorisation ne survit à la ligne qu\'elle autorisait',
  mortes.length === 0,
  mortes.length ? `à retirer : ${mortes.join(' · ')}` : `${vues.size} autorisation(s) toutes utilisées`);

// ═══════════════════════════════════════════════════════════════════════════
// 6. LE COURS OMI → USD — LOT 181, son point 156 (« StackR en $ »)
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ IL EST DANS **CE** BANC ET PAS DANS UN BANC NEUF : la question qu'il pose
// est mot pour mot celle des cinq blocs au-dessus — « qui écrit, qui lit ? ».
// Le cours est déposé au build par `dataset()`, relu au RUNTIME par
// `/api/cote/lot`, puis employé par un script de navigateur. Trois processus,
// trois moments : aucun des trois ne verrait le silence des deux autres.
console.log('\n6. le cours OMI → USD : déposé, relu, employé ?');
{
  const { rmSync } = await import('node:fs');
  const DIRT = mkdtempSync(join(tmpdir(), 'taux-banc-'));
  process.env.RESERVE_COTE_DIR = DIRT;
  const T = await import('../lib/taux_omi.mjs');
  const N = Math.floor(Date.now() / 1000);

  // --- a) la lecture du CSV : ⛔ elle ne rend JAMAIS 0 --------------------
  // Un 0 se propage en silence dans une multiplication et écrit « ≈ $0.00 »
  // sous chaque plancher — une valeur PLAUSIBLE pour une absence, c'est-à-dire
  // le défaut de famille de ce dépôt. `null` ne se multiplie pas par accident.
  const casCsv = [
    ['cours normal', [{ omi_usd: '0.00456', ts_utc: '1700' }], 0.00456],
    ['liste vide', [], null],
    ['source absente (chargerFacultatif rend [])', null, null],
    ['cours à zéro', [{ omi_usd: '0', ts_utc: '1700' }], null],
    ['cours illisible', [{ omi_usd: 'abc', ts_utc: '1700' }], null],
    ['cours négatif', [{ omi_usd: '-1', ts_utc: '1700' }], null],
    ['horodate absente', [{ omi_usd: '0.004' }], null],
  ];
  const ratesKo = casCsv.filter(([, e, att]) => {
    const r = T.lireCsv(e);
    return att === null ? r !== null : (r && r.omiUsd) !== att;
  }).map(([n]) => n);
  verifie('`lireCsv` : un cours douteux sort par `null`, jamais par 0',
    ratesKo.length === 0,
    ratesKo.length ? `échoue sur : ${ratesKo.join(' · ')}` : `${casCsv.length} cas`);

  // --- b) la péremption ---------------------------------------------------
  // `floor-watch.yml` tourne toutes les heures : un cours de plus de 24 h dit
  // que la chaîne est ARRÊTÉE, pas que le marché dort.
  T.deposerTaux({ omiUsd: 0.00456, ts: N - T.PEREMPTION_S + 60 });
  const frais = T.lireTaux(N);
  T.deposerTaux({ omiUsd: 0.00456, ts: N - T.PEREMPTION_S - 60 });
  const vieux = T.lireTaux(N);
  // 🔴🔴 L'AVANCE TESTÉE DÉPASSE LE SEUIL, ET C'EST TOUT L'INTÉRÊT DU CAS.
  // Premier jet : `ts = N + 3600`. Faute injectée (`Math.abs(now - ts)`) — le
  // banc est resté VERT : |−3 600| < 86 400, donc le cas passait des deux
  // côtés. Un contrôle qu'aucune faute ne peut faire rougir ne mesure rien, il
  // décore. ⇒ L'avance doit franchir le seuil pour que `Math.abs` la rejette.
  // → [[regle-terme-a-zero-doit-etre-atteignable]]
  T.deposerTaux({ omiUsd: 0.00456, ts: N + T.PEREMPTION_S + 3600 });
  const avance = T.lireTaux(N);
  verifie('un cours de moins de 24 h est servi, au-delà il se tait',
    frais !== null && vieux === null,
    `23 h 59 → ${frais ? 'servi' : 'MUET'} · 24 h 01 → ${vieux ? 'SERVI' : 'muet'}`);
  // ⚠️ Une horloge en avance chez le producteur ne doit pas disqualifier un
  //    cours : c'est l'ANCIENNETÉ qui périme, jamais l'avance. Un `Math.abs`
  //    ici rendrait le mur muet le jour d'un décalage de serveur.
  verifie('un horodate en avance passe (⛔ pas de `Math.abs` sur l\'âge)',
    avance !== null, avance ? '+25 h accepté' : 'REFUSÉ');

  // --- c) 🔴🔴 L'ORDRE DU DÉPÔT, ET C'EST LE CONTRÔLE QUI COMPTE ----------
  // `projeter()` VIDE `COTE_DIR` (cote.mjs : `for (…) rmSync(f)`), exprès, pour
  // qu'une cote de la veille ne soit jamais servie pour un prix du jour. Un
  // `deposerTaux()` placé une ligne trop haut serait EFFACÉ par ce ménage : le
  // mur StackR n'afficherait aucun équivalent, en local comme en production, et
  // AUCUNE erreur ne le dirait — le fichier absent est un cas déjà prévu.
  // ⭐⭐ Le banc ne le suppose pas : il PROVOQUE l'effacement, pour que la
  //    ligne du dessous mesure un danger démontré et pas une crainte.
  // ⚠️⚠️ SANS OBJET SUR UN SITE SANS PORTE `cote`, ET IL LE DIT AU LIEU DE SE
  // TAIRE. `projeter()` sort AVANT le ménage quand la porte est inactive
  // (`if (!estActive()) return`) : sur vevewiki le cours survivrait, et ce
  // contrôle rougirait sur une condition qui n'existe pas là-bas. Il ne
  // rougissait pas pour la bonne raison — il posait sa question au mauvais
  // site. ⭐ Mesuré : rouge sur vevewiki au premier jet, vert sur veveprice.
  // ⛔ Ne PAS le sauter en silence : un banc muet ressemble à un succès. Le
  //    verdict « SANS OBJET » est un verdict, il s'imprime.
  // → [[regle-banc-muet-ressemble-a-un-succes]]
  if (FERMEE) {
    const { projeter } = await import('../lib/cote.mjs');
    T.deposerTaux({ omiUsd: 0.00456, ts: N });
    projeter([]);
    const survivant = T.lireTaux(N);
    verifie('`projeter()` EFFACE bien un cours déposé avant lui (le danger existe)',
      survivant === null,
      survivant ? 'il a survécu — ce contrôle ne prouve plus rien, le relire' : 'effacé');
  } else {
    console.log('  ⏭️  SANS OBJET   `projeter()` n\'efface rien ici — porte « cote » INACTIVE, ce site n\'a pas de réserve de cote (donc pas de cours à effacer)');
  }

  // ⭐ Et donc : dans `dataset.mjs`, le dépôt vient APRÈS la projection.
  // ⚠️ LES COMMENTAIRES D'ABORD — ce fichier en porte plusieurs qui NOMMENT
  //    les deux appels ; sans `decommenter`, ce contrôle serait vert sur ses
  //    propres explications. (Défaut payé quatre fois sur ce dépôt.)
  const ds = readFileSync('engine/lib/dataset.mjs', 'utf8')
    .split('\n').map(decommenter).join('\n');
  const iProj = ds.indexOf('projeterCote(items)');
  const iTaux = ds.indexOf('deposerTaux(');
  verifie('dans `dataset.mjs`, `deposerTaux()` vient APRÈS `projeterCote()`',
    iProj > 0 && iTaux > iProj,
    iProj < 0 ? 'projeterCote introuvable' : (iTaux < 0 ? 'deposerTaux introuvable' : `projeterCote@${iProj} < deposerTaux@${iTaux}`));

  // --- d) le CIRCUIT : trois fichiers, et chacun doit tenir sa part -------
  // ⛔ Écrire sans lecteur est la panne que ce banc existe pour attraper. Les
  //    trois lignes ci-dessous sont les trois maillons, mesurés HORS
  //    commentaires, chacun dans le fichier qui doit le porter.
  const lu = (f) => readFileSync(f, 'utf8').split('\n').map(decommenter).join('\n');
  const route = lu('src/pages/api/cote/lot.js');
  const pilote = lu('src/socle/60-cote.js');
  const fiche = lu('src/components/pages/Item.astro');
  const maillons = [
    ['la route sert le cours', route.includes('lireTaux(') && /taux\s*\?/.test(route)],
    ['le pilote lit `j.taux`', pilote.includes('j.taux')],
    ['le pilote vise l\'emplacement', pilote.includes('data-omi-usd')],
    ['la fiche émet l\'emplacement', fiche.includes('data-omi-usd')],
    ['la fiche porte le texte, pas le pilote', fiche.includes('data-omi-modele')],
  ];
  const casses = maillons.filter(([, ok]) => !ok).map(([n]) => n);
  verifie('le circuit dépôt → route → pilote → fiche est complet',
    casses.length === 0,
    casses.length ? `rompu : ${casses.join(' · ')}` : `${maillons.length} maillons`);

  // --- e) ⛔ LA GARDE QUI EMPÊCHE LA CONVERSION INTERDITE -----------------
  // `floor`, `ath`, `atl` sont en GEMS chez VeVe. Leur appliquer un cours OMI
  // serait la conversion entre DEUX MARCHÉS que `cote.mjs`, `warehouse.mjs` et
  // `floor-watch.yml` interdisent tous les trois — rapport non constant
  // (médiane 4 423, p10 2 273, p90 8 520 sur 1 306 items communs).
  // ⭐ La garde porte sur le NOM DU CHAMP, pas sur la présence du taux : un
  //   jour sans cours ne doit pas être ce qui protège les trois autres champs.
  verifie('⛔ le pilote ne convertit QUE `floorStackr`',
    /champ\s*!==\s*'floorStackr'/.test(pilote),
    /champ\s*!==\s*'floorStackr'/.test(pilote) ? 'garde sur le nom du champ' : 'GARDE ABSENTE — floor/ath/atl convertibles');

  rmSync(DIRT, { recursive: true, force: true });
}

console.log(`\n${ko === 0 ? '✅ projection : tout est conforme' : `❌ projection : ${ko} écart(s)`}`);
process.exit(ko === 0 ? 0 : 1);
