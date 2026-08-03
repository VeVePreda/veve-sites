// test_lastmod.mjs — le `lastmod` du sitemap dit-il la vérité ?
//
//   node engine/tools/test_lastmod.mjs
//
// ⭐ POURQUOI CE TEST EXISTE
// `sitemap.xml.js` se replie sur la date du build quand `lastmod.<site>.json` manque
// ou qu'une clé est absente. Ce repli est VOULU — un sitemap doit sortir même
// dégradé. Mais un repli silencieux qui devient la norme, c'est exactement le
// défaut qu'on vient de corriger, revenu par la porte de derrière. Ce test est
// là pour que le repli reste une exception qui se voit.
import process from 'node:process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const F = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const dit = (b, quoi, detail = '') => {
  if (b) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ` — ${detail}` : ''}`); }
};

const { activeSections } = await import('../lib/editorial_pages.mjs');
const { ficheSections } = await import('../lib/editorial_entries.mjs');
const { priceEnabled } = await import('../lib/features.mjs');
const { SITE } = await import('../lib/manifest.mjs');

console.log(`\n1. Le fichier d'état de « ${SITE} » existe et se lit`);
// 🔴 UN FICHIER PAR SITE — ET C'EST CE TEST QUI EMPÊCHE LE RETOUR EN ARRIÈRE.
// Jusqu'au 29/07/2026 ce contrôle lisait `lastmod.json`, un fichier commun à
// tout le dépôt. veveprice le lisait donc alors qu'il ne contenait que les
// sections de vevewiki : le test passait au vert sur un fichier qui ne parlait
// pas de lui. En lisant `lastmod.<site>.json`, un site sans fichier ÉCHOUE.
const chemin = F(`../data/lastmod.${SITE}.json`);
dit(existsSync(chemin), `engine/data/lastmod.${SITE}.json est présent`,
  'lance engine/tools/lastmod.py (éditorial) et/ou engine/tools/lastmod-prix.mjs '
  + '(prix) — sinon TOUTES les URL retombent sur la date du build');
if (!existsSync(chemin)) { console.log('\n❌ arrêt : rien à vérifier\n'); process.exit(1); }

const etat = JSON.parse(readFileSync(chemin, 'utf8'));
const S = etat.sections || {};
const I = etat.items || {};
dit(Object.keys(S).length > 0, `il porte ${Object.keys(S).length} section(s)`);
// ⚠️ Un fichier qui ne se réclame pas de CE site est un fichier renommé à la
//    main : ses dates appartiennent à quelqu'un d'autre.
dit(etat.site === SITE, `il se déclare appartenir à « ${SITE} »`,
  `il dit « ${etat.site || '(rien)'} »`);

console.log('\n2. Chaque section publiée est couverte');
// ⚠️ Une section publiée SANS entrée ici retomberait en repli sans bruit : ses
// pages se déclareraient modifiées chaque jour, et personne ne le verrait.
for (const s of activeSections()) {
  dit(!!S[s], `« ${s} » a une date`, 'sinon repli silencieux sur la date du build');
}
for (const s of ficheSections()) {
  dit(!!S[s], `les fiches « ${s} » ont une date de section`);
}
for (const cle of ['donnees', 'legal']) {
  dit(!!S[cle], `« ${cle} » a une date`);
}

// ⭐⭐ LES FAMILLES DE PRIX. C'est le contrôle qui manquait : `activeSections()`
// et `ficheSections()` viennent du bloc `editorial` du manifeste, VIDE sur un
// site de prix. Sur veveprice, la boucle ci-dessus ne vérifiait donc RIEN, et
// le test passait au vert pendant que 4 800 URL portaient la date du build.
// Un contrôle qui ne s'applique à aucun site qu'il est censé garder est un
// contrôle décoratif.
if (priceEnabled()) {
  console.log('\n2 bis. Le site publie des prix : ses familles et ses fiches');
  for (const cle of ['collections', 'market']) {
    dit(!!S[cle], `l'index « ${cle} » a une date`,
      'lance engine/tools/lastmod-prix.mjs dans le workflow');
  }
  dit(Object.keys(I).length > 0, `${Object.keys(I).length} fiche(s) ont leur date propre`,
    'sans carte `items`, toutes les fiches partagent la date de leur famille — '
    + 'qui bouge dès qu\'un seul prix du catalogue bouge');
  const futur = Object.entries(I).filter(([, v]) => (v.d || '') > new Date().toISOString().slice(0, 10));
  dit(futur.length === 0, 'aucune fiche datée dans le futur', `${futur.length} fiche(s)`);
  const sansEmpreinte = Object.entries(I).filter(([, v]) => !(typeof v.h === 'string' && v.h.length >= 16));
  dit(sansEmpreinte.length === 0, 'chaque fiche porte son empreinte',
    `${sansEmpreinte.length} sans empreinte — leur date ne survivra pas au passage suivant`);
}

console.log('\n3. Les dates sont plausibles');
const jour = new Date().toISOString().slice(0, 10);
for (const [k, v] of Object.entries(S)) {
  dit(/^\d{4}-\d{2}-\d{2}$/.test(v.d || ''), `« ${k} » : date au format ISO`, v.d);
  // Une date dans le futur ne peut venir que d'une horloge fausse ou d'une
  // saisie à la main. Dans les deux cas le sitemap mentirait.
  dit((v.d || '') <= jour, `« ${k} » : pas dans le futur`, v.d);
  dit(typeof v.h === 'string' && v.h.length >= 16, `« ${k} » : porte son empreinte`,
    'sans empreinte, la date ne peut plus être conservée d\'un passage à l\'autre');
}

console.log('\n4. Le fichier n\'est pas une date unique déguisée');
// ⚠️ Si toutes les sections partagent la même date, c'est soit un tout premier
// passage (légitime), soit le signe que l'empreinte ne discrimine rien.
const dates = new Set(Object.values(S).map((v) => v.d));
if (dates.size === 1) {
  console.log(`  ⚠️  une seule date (${[...dates][0]}) — normal au premier passage, ` +
              'suspect ensuite : vérifier que lastmod.py tourne bien dans le workflow.');
} else {
  dit(true, `${dates.size} dates distinctes — les sections vivent leur propre vie`);
}

// ⭐⭐ MÊME QUESTION POUR LES FICHES — ET UN CONTRÔLE QUE J'AI DÛ DÉSARMER.
//
// Première version (29/07, matin) : « si les ~1 200 fiches partagent une seule
// date alors que l'outil est passé plus d'une fois, l'empreinte ne discrimine
// rien » — et ÉCHEC, donc build bloqué.
// C'est faux, et la copie neuve l'a montré le jour même : sur un site dont
// aucun prix n'a bougé entre deux passages, toutes les fiches gardent
// légitimement la date du premier jour. Une date unique n'est PAS un défaut,
// c'est ce qu'on voit sur un marché calme. Le contrôle aurait arrêté un
// déploiement pour un site en parfaite santé.
//
// ⭐ La leçon, et elle vaut plus que ce test : UNE HEURISTIQUE STATISTIQUE N'A
//    RIEN À FAIRE DANS UN GARDE-FOU BLOQUANT. Elle ne sait pas distinguer
//    « rien n'a changé » de « je ne vois plus rien changer ». Elle parle, elle
//    n'arrête pas.
//
// Ce qui SÉPARE vraiment les deux lectures est dans le journal du workflow :
//     lastmod-prix : N fiche(s) — M avec un contenu modifié
//   M = 0        -> marché calme, tout va bien ;
//   M = N, tous les jours -> l'empreinte ne discrimine rien, il faut regarder.
if (priceEnabled() && Object.keys(I).length) {
  const datesFiches = new Set(Object.values(I).map((v) => v.d));
  const passages = etat.passages || 0;
  const jourDit = new Date().toISOString().slice(0, 10);
  const uniqueEtDuJour = datesFiches.size === 1 && [...datesFiches][0] === jourDit;
  if (datesFiches.size > 1) {
    dit(true, `${datesFiches.size} dates distinctes sur les fiches (passage ${passages})`);
  } else if (passages <= 1) {
    console.log(`  ⚠️  une seule date au passage ${passages} — normal : le premier `
      + 'passage date tout du jour. Le prochain dira vrai.');
  } else if (uniqueEtDuJour) {
    console.log(`  ⚠️  les ${Object.keys(I).length} fiches sont TOUTES datées d'aujourd'hui `
      + `au passage ${passages}. Deux lectures possibles : tout le catalogue a `
      + 'bougé, ou l\'empreinte ne discrimine rien. Trancher avec la ligne '
      + '« lastmod-prix : N fiche(s) — M avec un contenu modifié » du workflow.');
  } else {
    console.log(`  ⚠️  une seule date (${[...datesFiches][0]}), plus ancienne qu'aujourd'hui `
      + '— c\'est la signature d\'un marché calme : aucun prix n\'a bougé depuis. '
      + 'Rien à corriger.');
  }
}

console.log('\n5. Le sitemap est vraiment BRANCHÉ sur ce fichier');
// ⭐⭐ POURQUOI UN CONTRÔLE SUR LE CODE SOURCE, ET PAS SUR SON RÉSULTAT.
// Tout ce qui précède vérifie que le FICHIER est bon. Rien ne vérifiait qu'il
// est LU. Or ce projet a déjà payé trois fois le même mode de panne : un
// module déposé sans son import, un builder écrit sans son cron, une globale
// jamais assignée — à chaque fois le livrable existait, était juste, et ne
// servait à rien, sans une ligne de journal différente.
// Un `grep` sur la source est laid ; il est surtout le seul contrôle qui
// tombe le jour où quelqu'un retire le câblage.
const SM = readFileSync(F('../../src/pages/sitemap.xml.js'), 'utf8');
dit(/lastmod\.\$\{SITE\}\.json/.test(SM),
  'le sitemap lit `lastmod.${SITE}.json`, pas un fichier commun',
  'un fichier commun à tout le dépôt fait lire à un site les dates d\'un autre');
dit(/if\s*\(I\[p\]\)\s*return\s+I\[p\]/.test(SM),
  'il consulte la date PROPRE à la fiche avant les dates de famille',
  'sans cette ligne, les ~1 200 fiches repartagent une seule date de famille');
const posItems = SM.indexOf('if (I[p])');
const posFamille = SM.indexOf('recent(S[sec]');
dit(posItems > 0 && posFamille > posItems,
  'la date de fiche est consultée AVANT le repli de famille',
  'l\'ordre est inversé : le repli gagnerait toujours');

console.log(`\n${ko === 0 ? '✅ lastmod : tout est vert' : `❌ ${ko} contrôle(s) en échec`} (${ok + ko} contrôles)\n`);
process.exit(ko === 0 ? 0 : 1);
