// ⚠️ VeVePreda/veve-sites — engine/tools/test_tableau.mjs   (FICHIER NEUF — lot 131)
// ═══════════════════════════════════════════════════════════════════════════
//  LE BANC DU TABLEAU DE BORD — et il regarde les DEUX côtés du circuit
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ CE QU'IL SURVEILLE, ET POURQUOI CE N'EST PAS « LES TUILES S'AFFICHENT ».
// Un banc qui vérifierait la présence des tuiles serait vert le jour où elles
// s'affichent toutes VERROUILLÉES, ou toutes SANS CHIFFRE, ou où une tuile
// pointe vers une page morte. C'est la leçon de `test:tuiles` (lot 127) :
// « un banc qui ne compte que des octets récompense la régression qu'il craint ».
// Ici la question est : *le tableau de bord dit-il la vérité sur ce que le
// manifeste vend et sur ce que la donnée contient ?*
//
// 🔴🔴 LES QUATRE SILENCES QU'IL FERME, chacun payé ailleurs sur ce dépôt :
//   ① UN MODULE LIVRÉ SANS TUILE ET SANS RAISON. `Dashboard.astro` porte deux
//      listes : `DESTINATIONS` (ce qui a une tuile) et `SANS_TUILE` (ce qui
//      n'en a pas, avec sa raison écrite). Tout module `bientot: false` doit
//      être dans l'une ou dans l'autre. Sans ce contrôle, ajouter un module au
//      manifeste le ferait disparaître du tableau de bord EN SILENCE — le
//      « circuit ouvert » : un contrôle qui ne regarde que ce qui existe ne
//      voit jamais ce qui manque.
//   ② UNE CLÉ DE TUILE QUI N'EXISTE PAS AU CATALOGUE. `t()` sur une clé absente
//      rend LA CLÉ, en toutes lettres, sans erreur : « mod.markt » s'afficherait
//      sur la page d'arrivée de chaque membre. Payé au lot 126 (`nav.account`).
//   ③ UN RÉSUMÉ INCOMPLET. `deposerMarche()` écrit `null` quand il n'a pas pu
//      compter — c'est honnête, et c'est aussi invisible : la tuile disparaît
//      sans un mot. Ce banc lit le VRAI `.reserve/marche.json` produit par le
//      build et exige que chaque champ soit un NOMBRE. ⭐ C'est la règle
//      « confronter le banc à l'AUTRE artefact » : `test:marche` juge la
//      projection sur un témoin fabriqué, celui-ci la juge sur la vraie.
//   ④ UN MONTANT DANS LE RÉSUMÉ. Le résumé voyage dans le même fichier que la
//      projection ; `test:marche` §2 balaie déjà `CHAMPS_COTE`, mais il balaie
//      `charge.marche`. Ici on balaie le RÉSUMÉ, explicitement, parce qu'un
//      champ ajouté demain (« floorMedian ») n'aurait aucune raison de tomber
//      dans l'autre balayage.
//
// ⛔ IL SORT EN rc=2 S'IL N'A RIEN LU. « Zéro tuile en trop » et « zéro tuile
//    lue » se ressemblent exactement dans un compteur à zéro, et sont l'inverse
//    l'un de l'autre. Un vert qui n'a rien inspecté est le plus cher de tous.
//
// ⚠️ IL NE DEMANDE PAS LA PAGE À UN SERVEUR, et c'est délibéré : `/dashboard/`
//    exige une session, et fabriquer une session dans un banc reviendrait à
//    tester le service d'identité. `test:pages` §2 s'en charge déjà — il suit
//    les liens que la page PROPOSE, dans chaque langue. Celui-ci lit la SOURCE
//    et la DONNÉE, les deux endroits où la vérité se fabrique.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const R = new URL('../..', import.meta.url).pathname;
let echecs = 0, lus = 0;
const verifie = (titre, ok, detail = '') => {
  if (!ok) echecs++;
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre}${detail ? `\n       ${detail}` : ''}`);
};
const indecis = (titre, pourquoi) =>
  console.log(`  ⏸️   ${titre} — INDÉCIDABLE : ${pourquoi}`);

const { priceEnabled } = await import('../lib/features.mjs');
const SITE = process.env.SITE || 'veveprice';

console.log(`\n═══ TABLEAU DE BORD — site « ${SITE} » ═══`);

// ═══════════════════════════════════════════════════════════════════════════
// 0. LE SITE A-T-IL SEULEMENT UN TABLEAU DE BORD ?
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ TROIS VERDICTS, PAS DEUX. vevewiki n'a ni compte ni prix : ce banc n'y a
// rien à dire, et il le DIT — il ne se déclare pas vert. Un banc qui rend
// « conforme » sur un site qu'il n'a pas regardé est un faux témoin.
if (!priceEnabled()) {
  console.log('\n⏸️  sans objet — ce site ne publie pas de prix, il n\'a pas de tableau de bord.');
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. LES DEUX LISTES DU GABARIT COUVRENT LE CATALOGUE — dans les deux sens
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n1. chaque module LIVRÉ a-t-il une tuile, ou une raison de ne pas en avoir ?');

const GAB = join(R, 'src', 'components', 'pages', 'Dashboard.astro');
verifie('le gabarit du tableau de bord existe', existsSync(GAB), GAB);
if (!existsSync(GAB)) { console.log('\n❌ 1 echec(s)'); process.exit(1); }
const src = readFileSync(GAB, 'utf8');

// ⛔ ON LIT LE CORPS DES DEUX TABLES, PAS LE FICHIER ENTIER. « Un contrôle lit
//    aussi les commentaires » : ce gabarit CITE `favoris`, `extremes` et
//    `market` dans ses explications, et un grep naïf les compterait comme des
//    tuiles. On découpe donc entre les bornes des littéraux.
const entre = (debut, fin) => {
  const i = src.indexOf(debut);
  if (i < 0) return null;
  const j = src.indexOf(fin, i);
  return j < 0 ? null : src.slice(i + debut.length, j);
};
const corpsDest = entre('const DESTINATIONS = [', '\n];');
const corpsSans = entre('const SANS_TUILE = {', '\n};');
verifie('les deux tables se lisent (DESTINATIONS et SANS_TUILE)',
  corpsDest !== null && corpsSans !== null,
  corpsDest === null ? '🔴 DESTINATIONS introuvable' : corpsSans === null ? '🔴 SANS_TUILE introuvable' : '');
if (corpsDest === null || corpsSans === null) { console.log(`\n❌ ${echecs} echec(s)`); process.exit(1); }

const clesDest = [...corpsDest.matchAll(/\bcle:\s*'([a-z_]+)'/g)].map((m) => m[1]);
const clesSans = [...corpsSans.matchAll(/^\s*([a-z_]+):\s*'/gm)].map((m) => m[1]);
lus += clesDest.length + clesSans.length;

// ⭐ L'AUTO-CONTRÔLE D'ABORD : un découpage qui rend zéro clé rendrait toutes
// les lignes suivantes vraies pour de mauvaises raisons.
verifie('le découpage a trouvé des tuiles — sinon tout ce qui suit est vrai pour rien',
  clesDest.length >= 2, `${clesDest.length} tuile(s), ${clesSans.length} exclusion(s) motivée(s)`);

const { catalogueModules } = await import('../lib/access.mjs');
const MODULES = catalogueModules();
const livres = MODULES.filter((m) => !m.bientot).map((m) => m.cle);

const orphelins = livres.filter((c) => !clesDest.includes(c) && !clesSans.includes(c));
verifie('aucun module livré n\'est absent des DEUX tables',
  orphelins.length === 0,
  orphelins.length
    ? `🔴 ${orphelins.join(', ')} — livré(s) au manifeste, invisible(s) au tableau de bord et sans raison écrite.\n`
      + '       ⇒ lui donner une tuile dans DESTINATIONS, ou l\'inscrire dans SANS_TUILE avec pourquoi.'
    : `${livres.length} module(s) livré(s), tous couverts`);

const inventees = [...clesDest, ...clesSans].filter((c) => !MODULES.some((m) => m.cle === c));
verifie('aucune tuile ne nomme un module absent du catalogue',
  inventees.length === 0,
  inventees.length
    ? `🔴 ${inventees.join(', ')} — « mod.${inventees[0]} » s'afficherait en toutes lettres : `
      + 't() sur une clé absente rend la clé, en silence.'
    : `${clesDest.length + clesSans.length} clé(s) vérifiée(s) contre le manifeste`);

// ⛔ ET LA CONTRE-ÉPREUVE : une tuile pour un module PAS ENCORE LIVRÉ serait un
//    widget « bientôt » sur la page d'arrivée d'un membre — précisément ce que
//    le lot 126 a refusé d'écrire.
const promises = clesDest.filter((c) => {
  const m = MODULES.find((x) => x.cle === c);
  return m && m.bientot;
});
verifie('aucune tuile ne pointe vers un module « bientôt »',
  promises.length === 0,
  promises.length ? `🔴 ${promises.join(', ')} — un bloc vide sur la page d'arrivée est une déception à chaque connexion`
    : 'aucune promesse posée sur le tableau de bord');

// ═══════════════════════════════════════════════════════════════════════════
// 2. LE GABARIT N'APPELLE PAS `dataset()` — la règle des 10 328 ms
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ `test:marche` §3 le vérifie déjà en suivant les imports depuis
//    `ROUTES_COMPTE`. On le REDIT ici, directement sur le fichier, et c'est
//    volontaire : « des bancs qui se recoupent plutôt qu'un par panne » (la
//    leçon des 64 `<head>` avalés du lot 129, vus par DEUX bancs dont aucun ne
//    cherchait ça). Si un jour le suivi d'imports cesse d'atteindre ce
//    composant, ce contrôle-ci parle encore.
console.log('\n2. le gabarit reste-t-il hors de `dataset()` ?');
const sansCommentaires = src.replace(/^\s*\/\/.*$/gm, '');
verifie('aucun `dataset()` dans Dashboard.astro',
  !/\bdataset\s*\(\s*\)/.test(sansCommentaires),
  '⇒ 10 328 ms à la première requête après chaque redémarrage (mesure du lot 125)');
verifie('il lit bien la projection déposée au build (`lireMarche`)',
  /\blireMarche\s*\(/.test(sansCommentaires), 'la donnée vient du build, pas de la requête');
lus++;

// ═══════════════════════════════════════════════════════════════════════════
// 3. LE RÉSUMÉ RÉELLEMENT DÉPOSÉ — pas un témoin fabriqué
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n3. le résumé déposé par le build est-il COMPLET et SANS MONTANT ?');

const { MARCHE_FICHIER, CHAMPS_COTE } = await import('../lib/cote.mjs');
if (!existsSync(MARCHE_FICHIER)) {
  // ⭐ INDÉCIDABLE, PAS VERT ET PAS ROUGE. Ce banc peut tourner avant le build
  //    (l'ordre de `npm test` place les bancs qui importent `dataset()` avant
  //    `npm run build`). Se déclarer vert ici serait exactement le défaut qu'on
  //    reproche aux autres ; se déclarer rouge ferait un banc rouge pour une
  //    mauvaise raison, et on finirait par ignorer sa couleur (lot 128).
  indecis('le résumé du build', `${MARCHE_FICHIER} absent — build non joué dans cette session`);
} else {
  const charge = JSON.parse(readFileSync(MARCHE_FICHIER, 'utf8'));
  const resume = charge.resume;
  verifie('la projection porte un bloc `resume`', !!resume && typeof resume === 'object',
    resume ? Object.keys(resume).join(', ') : '🔴 absent — le tableau de bord n\'aurait aucun chiffre');

  if (resume) {
    lus += Object.keys(resume).length;
    const inconnus = Object.entries(resume).filter(([, v]) => v === null).map(([k]) => k);
    verifie('aucun champ du résumé n\'est INCONNU sur un vrai build',
      inconnus.length === 0,
      inconnus.length
        ? `🔴 ${inconnus.join(', ')} — écrits \`null\` par deposerMarche() : la tuile disparaîtra sans un mot.\n`
          + '       ⚠️ `null` (pas compté) et 0 (compté, vaut zéro) sont deux états différents : c\'est le premier.'
        : `${Object.keys(resume).length} champ(s), tous chiffrés`);

    // ⛔ AUCUN MONTANT. On balaie les NOMS de champs autant que les valeurs :
    //    un `floor` glissé dans le résumé serait servi à tout membre connecté,
    //    dans un fichier que `test:fuite` ne balaie pas (il est hors de `dist/`).
    const fuit = Object.keys(resume).filter((k) => CHAMPS_COTE.includes(k));
    verifie('le résumé ne porte AUCUN champ de cote',
      fuit.length === 0,
      fuit.length ? `🔴 ${fuit.join(', ')} — la fuite du lot 101, refaite par la porte d'à côté`
        : `0 sur ${CHAMPS_COTE.length} champs surveillés`);

    // ⭐ ET LA COHÉRENCE INTERNE : `publies` ne peut pas dépasser `catalogue`.
    //    Un banc qui ne lit qu'un fichier ne sait pas que ce fichier est le
    //    mauvais — 90 lignes sont parfaitement cohérentes avec elles-mêmes.
    //    Ici on confronte deux champs l'un à l'autre : c'est peu, mais c'est la
    //    seule vérification que le fichier ne peut pas satisfaire tout seul.
    if (typeof resume.publies === 'number' && typeof resume.catalogue === 'number') {
      verifie('`publies` ≤ `catalogue` — la vitrine ne publie pas plus que le catalogue',
        resume.publies <= resume.catalogue,
        `${resume.publies} publiée(s) sur ${resume.catalogue} ligne(s) de catalogue`);
    }
    if (typeof resume.aVenirCliquables === 'number' && typeof resume.aVenir === 'number') {
      // ⭐ CE N'EST PAS UNE ASSERTION, C'EST UNE MESURE QUI S'AFFICHE.
      //    `AVenir.astro` affirme « un drop à venir n'a aucune fiche, donc
      //    aucune adresse ». Ce nombre le dit à chaque build, au lieu de laisser
      //    l'avertissement survivre à sa cause.
      console.log(`  ℹ️    drops à venir : ${resume.aVenir}, dont ${resume.aVenirCliquables} menant à une fiche`);
      verifie('les drops cliquables ne dépassent pas les drops à venir',
        resume.aVenirCliquables <= resume.aVenir, `${resume.aVenirCliquables} / ${resume.aVenir}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. AUTO-CONTRÔLE — le banc a-t-il vraiment regardé quelque chose ?
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. auto-contrôle');
if (lus < 6) {
  console.log(`  🔴 ce banc n'a inspecté que ${lus} élément(s) : il ne prouve rien.`);
  process.exit(2);
}
console.log(`  OK   ${lus} élément(s) inspecté(s)`);

console.log(echecs ? `\n❌ ${echecs} echec(s)` : '\n✅ tout est vert');
process.exit(echecs ? 1 : 0);
