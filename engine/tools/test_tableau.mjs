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
// 4. LOT 160-A, POINT `y` — LA COULEUR ET L'OSSATURE DE LA PAGE
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE QUE CE BANC DOIT SAVOIR REFUSER, ET C'EST TOUT SON INTÉRÊT :
//   `sect="general"` était une valeur PARFAITEMENT LÉGALE (elle est dans
//   `SECTIONS_COULEUR`) qui ne matchait AUCUNE règle du thème. Ni le build, ni
//   `test:gabarits`, ni `test:feuille` ne pouvaient la voir : rien n'était
//   cassé, la page prenait simplement les variables héritées de `:root`.
//   ⇒ La seule mesure qui distingue est de confronter TROIS fichiers : ce que
//   le gabarit ÉMET, ce que `Base.astro` ACCEPTE, et ce que le thème PEINT.
//   Un banc qui n'en lirait qu'un serait vert dans les deux mondes.
//
// ⛔⛔ ET IL NE LIT PAS LES COMMENTAIRES. Le gabarit EXPLIQUE ce lot-ci : il
//   cite `sect="general"` et `[data-sect="tableau"]` en toutes lettres dans son
//   en-tête. Un grep naïf trouverait donc la bonne réponse dans la prose et se
//   déclarerait vert sur un gabarit qui aurait gardé l'ancienne valeur.
//   C'est la règle « un critère qui juge la valeur cherche la chaîne » —
//   elle mord sur les commentaires, et elle a déjà coûté cinq fois.
console.log('\n4. le tableau de bord porte-t-il SA couleur et l\'ossature du site ?');

// ⭐ ON DÉCOUPE LES TROIS FORMES DE COMMENTAIRE D'UN `.astro`, pas seulement
//    les `//` du frontmatter : le corps du gabarit emploie `{/* … */}`, qui est
//    précisément là où cette explication-ci est écrite.
const nu = src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

// ⭐ AUTO-CONTRÔLE AVANT TOUT : si le découpage avalait le gabarit entier,
//   chaque « absence » ci-dessous serait vraie pour rien. La borne est haute
//   exprès — le corps utile de ce fichier fait plusieurs milliers d'octets.
verifie('le découpage laisse un gabarit à lire — sinon les absences ne prouvent rien',
  nu.length > 2000 && /<Base\b/.test(nu), `${nu.length} o hors commentaires`);
lus++;

const sectEmise = (nu.match(/<Base[^>]*?\bsect="([a-z]+)"/) || [])[1] || null;
verifie('le gabarit émet `sect="tableau"`', sectEmise === 'tableau',
  sectEmise === null ? '🔴 aucun `sect=` sur <Base> — la page prendrait la valeur par défaut'
    : sectEmise === 'general'
      ? '🔴 `general` : légale, mais AUCUNE règle du thème ne porte ce nom — couleur prise par hasard'
      : `émis : « ${sectEmise} »`);
lus++;

// 🔑 LA VALEUR ÉMISE DOIT ÊTRE ACCEPTÉE PAR LA LISTE FERMÉE DE `Base.astro`.
//   Sans ce contrôle, une faute de frappe (`tablo`) retomberait SILENCIEUSEMENT
//   sur `general` — c'est ce que fait `sectCouleur`, et c'est voulu là-bas.
const baseSrc = readFileSync(join(R, 'src', 'layouts', 'Base.astro'), 'utf8');
const listeBase = (baseSrc.match(/const SECTIONS_COULEUR = \[([\s\S]*?)\]/) || [])[1] || '';
const acceptees = [...listeBase.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
verifie('`Base.astro` accepte cette valeur (liste fermée `SECTIONS_COULEUR`)',
  sectEmise !== null && acceptees.includes(sectEmise),
  acceptees.length ? `${acceptees.length} valeur(s) acceptées : ${acceptees.join(', ')}`
    : '🔴 liste illisible — le découpage a raté');
lus += acceptees.length;

// 🔑 ET LE THÈME DOIT LA PEINDRE. C'est l'avertissement écrit dans `Base.astro`
//   l. 57 : « ajouter une valeur ici ne suffit pas ». Une section acceptée mais
//   non peinte est exactement le défaut que ce lot corrige — le refaire sous un
//   autre nom serait la même panne déguisée.
const THEME = join(R, 'themes', 'vitrine', 'theme.css');
if (!existsSync(THEME)) {
  indecis('la palette du thème', `${THEME} absent`);
} else {
  const css = readFileSync(THEME, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const peintes = new Set([...css.matchAll(/\[data-sect="([a-z]+)"\]/g)].map((m) => m[1]));
  verifie('le thème porte bien une palette à ce nom',
    sectEmise !== null && peintes.has(sectEmise),
    peintes.size
      ? `${peintes.size} palette(s) peinte(s) : ${[...peintes].sort().join(', ')}`
      : '🔴 aucune palette lue — le découpage a raté');
  // ⭐ ET LA MESURE QUI A DÉCIDÉ DU LOT, LAISSÉE VISIBLE : `general` n'est PAS
  //   peinte, et elle reste acceptée. Ce n'est pas une assertion — c'est le
  //   chiffre qui explique pourquoi ce banc existe.
  console.log(`  ℹ️    acceptées mais NON peintes : ${acceptees.filter((x) => !peintes.has(x)).join(', ') || 'aucune'}`);
  lus += peintes.size;
}

// ⭐ L'OSSATURE — les trois lignes que 8 gabarits sur 11 portent déjà.
verifie('la page ouvre par l\'étiquette de section du réseau (`etiq etiq--bleu">// `)',
  /class="etiq etiq--bleu">\/\/ /.test(nu),
  '⇒ « présentation comme les autres pages » — Analytics, Market, Offre, Collections… l\'ont');
verifie('le `<h1 class="mono-t">` n\'est plus enfermé dans un titre de SECTION',
  /<h1 class="mono-t">/.test(nu) && !/sect-t--gd"><h1/.test(nu),
  '`sect-t sect-t--gd` est le titre de second rang : l\'employer au premier était l\'écart mesuré');
// ⛔ LE PALIER NE DOIT PAS DISPARAÎTRE AVEC LE DÉCOR. Le lot 131 l'a posé sur
//   cette page parce que c'est la première chose qu'un membre vient vérifier ;
//   une refonte visuelle qui l'emporterait serait une régression silencieuse.
verifie('le palier du membre est toujours affiché', /nomPalier\(palier\)/.test(nu),
  'lot 131 — « il n\'était écrit NULLE PART dans le parcours »');
lus += 3;


// ═══════════════════════════════════════════════════════════════════════════
// 4 bis. LE MODULE D'ACCÈS RAPIDE AUX FAVORIS — le circuit, pas la ligne
// ═══════════════════════════════════════════════════════════════════════════
// ❤️ LOT 160-B, POINT `aa`. Ce module tient en QUATRE pièces qui doivent se
// nommer pareil, et trois d'entre elles se taisent quand elles se perdent :
//   ① `DESTINATIONS` déclare la tuile et l'id de son compteur ;
//   ② le gabarit rend l'hôte `<span id={…} hidden>` ;
//   ③ le gabarit émet le pilote (`moduleJs('favoris')` + `<script defer>`) ;
//   ④ le pilote cherche CET id-là et le remplit.
// ⛔ Casser ①→④ ne produit AUCUNE erreur : un `getElementById` qui rend `null`
//    sort en silence, un `<span hidden>` que personne ne remplit reste caché,
//    et la tuile s'affiche parfaitement — sans son chiffre. C'est le silence
//    que le 154-A décrivait déjà (« un pilote qui ne trouve pas son hôte ne
//    dit rien »), et il n'y avait alors rien pour le mesurer.
// ⭐ On lit `nu` (le gabarit SANS ses commentaires) : cette explication-ci
//    cite `tb-nfav` et `moduleJs('favoris')` en toutes lettres, et un grep
//    naïf serait vert sur un gabarit qui les aurait perdus.
console.log('\n4 bis. le module d\'accès rapide aux favoris tient-il de bout en bout ?');

const idCompteur = (corpsDest.match(/cle:\s*'favoris'[^}]*?compteur:\s*'([a-z0-9-]+)'/) || [])[1] || null;
verifie('la tuile `favoris` déclare l\'id de son compteur (`compteur:`)',
  idCompteur !== null,
  idCompteur ? `id déclaré : « ${idCompteur} »`
    : '🔴 aucune tuile `favoris` avec un `compteur:` — le point `aa` demande un module d\'ACCÈS RAPIDE,\n'
      + '       et son chiffre ne peut pas venir du build : il appartient à un compte.');
lus++;

// ⭐ L'HÔTE. On exige la forme `id={x.compteur}` et non l'id écrit en dur :
//   un id littéral dans le gabarit serait une SECONDE source pour le même nom,
//   et les deux divergeraient au premier renommage.
verifie('le gabarit rend l\'hôte du compteur, `hidden`, depuis la table',
  /id=\{x\.compteur\}/.test(nu) && /hidden><\/span>/.test(nu),
  '⇒ vide et caché au rendu : un « 0 » rendu au serveur mentirait à qui en a trente');
verifie('le gabarit demande le pilote et l\'émet',
  /moduleJs\(\s*'favoris'\s*\)/.test(nu) && /<script defer src=\{pilote\.href\}><\/script>/.test(nu),
  '⇒ sans le `<script>`, la tuile s\'affiche et le chiffre n\'arrive jamais');
// ⛔ ET IL NE DOIT PAS ÊTRE ÉMIS INCONDITIONNELLEMENT. Sans la porte des prix,
//   `avecPrix` est faux, `catalogueModules()` n'est pas appelé et `tuiles` est
//   VIDE : il n'y a alors aucun hôte à remplir. Un script servi sans hôte ne
//   fait pas d'erreur — il ne fait rien, et c'est le silence habituel.
verifie('le pilote n\'est demandé que si une tuile porte un compteur',
  /tuiles\.some\(\(x\) => x\.compteur\)/.test(nu),
  '⇒ sans la porte des prix, `tuiles` est vide : aucun hôte à piloter');
lus += 3;

const PILOTE = join(R, 'src', 'socle', 'modules', 'favoris.js');
if (!existsSync(PILOTE)) {
  verifie('le pilote `src/socle/modules/favoris.js` existe', false, '🔴 absent');
} else {
  const pilote = readFileSync(PILOTE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  // 🔑 LE CONTRAT, ET C'EST LA SEULE LIGNE QUI COMPTE VRAIMENT ICI : le pilote
  //   doit chercher L'ID QUE LA TABLE DÉCLARE. Deux noms qui se ressemblent
  //   (`tb-nfav` / `tb-fav`) donnent un tableau de bord parfaitement vert et
  //   un compteur définitivement vide.
  verifie(`le pilote cherche l'id déclaré (« ${idCompteur || '?'} »)`,
    idCompteur !== null && new RegExp(`getElementById\\('${idCompteur}'\\)`).test(pilote),
    idCompteur === null ? '🔴 id indécidable : la table ne le déclare pas'
      : '⇒ un `getElementById` qui rend `null` sort en silence');
  // ⛔ ET L'ACCÈS RESTE UNIQUE. La leçon du 140-1 : trois lectures justes de la
  //   même liste divergent le jour où UNE apprend une règle de plus. Ici, la
  //   règle qui divergerait est « 401 = personne » contre « 503 = je ne sais
  //   pas » — et s'aplatir dessus fait afficher « aucun favori » à quelqu'un
  //   qui en a trente.
  verifie('le pilote passe par l\'accès unique (`window.vpFav`), sans `fetch` à lui',
    /window\.vpFav\b/.test(pilote) && !/\bfetch\s*\(/.test(pilote),
    '⇒ `40-favoris.js` est le seul à parler à `/api/favoris`, ici comme sur une fiche');
  lus += 2;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. AUTO-CONTRÔLE — le banc a-t-il vraiment regardé quelque chose ?
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n5. auto-contrôle');
if (lus < 6) {
  console.log(`  🔴 ce banc n'a inspecté que ${lus} élément(s) : il ne prouve rien.`);
  process.exit(2);
}
console.log(`  OK   ${lus} élément(s) inspecté(s)`);

console.log(echecs ? `\n❌ ${echecs} echec(s)` : '\n✅ tout est vert');
process.exit(echecs ? 1 : 0);
