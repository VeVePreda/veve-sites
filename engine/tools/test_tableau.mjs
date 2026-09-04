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

import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
// ═══════════════════════════════════════════════════════════════════════════
// 📊 LOT 202 — CE § A CHANGÉ DE SUJET SANS ÊTRE DÉSARMÉ, ET C'EST VOULU.
// ═══════════════════════════════════════════════════════════════════════════
// Il jugeait une table écrite DANS le gabarit, lue au texte. La table vit
// maintenant dans `engine/lib/tableau.mjs` : on l'IMPORTE au lieu de la
// découper, ce qui est plus fort — une table lue par regex ne dit rien de ce
// que le module exporte vraiment.
// ⚠️ Ce qui reste lu au TEXTE reste lu au texte : le filtre de la caisse, la
//    prop `tb`, les deux routes. Un contrôle qui vérifie qu'une ligne EXISTE
//    ne peut pas s'écrire autrement.
console.log('\n1. la grammaire de l\'agencement — EXÉCUTÉE, pas lue');

const TB = await import('../lib/tableau.mjs');
const { ACCES_RAPIDES, CLES } = TB;

verifie('le catalogue des accès rapides porte au moins 4 entrées',
  Array.isArray(ACCES_RAPIDES) && ACCES_RAPIDES.length >= 4,
  `${ACCES_RAPIDES.length} entrée(s) : ${CLES.join(', ')}`);
lus += ACCES_RAPIDES.length;

{
  // ⭐⭐⭐ ON FORCE UN ÉTAT PUIS ON MESURE LE CHANGEMENT — une bascule prouve
  //   plus qu'une lecture. C'est la correction du 25/08 : un instrument qui
  //   lit sans avoir posé l'état mesure ce qu'un § précédent a laissé.
  const parDefaut = TB.lireAgencement('');
  verifie('valeur absente ⇒ le catalogue COMPLET, tout coché, dans l\'ordre du fichier',
    parDefaut.length === CLES.length
      && parDefaut.every((x, i) => x.cle === CLES[i] && x.montre === true),
    '⇒ il n\'existe aucun état où le tableau de bord arrive vide faute de cookie');

  const illisible = TB.lireAgencement('%%%,<script>,../../etc/passwd,favoris');
  verifie('une valeur fabriquée ne fait entrer AUCUNE clé inconnue',
    illisible.length === CLES.length && illisible.every((x) => CLES.includes(x.cle)),
    '⇒ liste BLANCHE : on n\'accepte que ce qu\'on connaît, on ne se protège pas de ce qu\'on imagine');

  const partiel = TB.lireAgencement(`-${CLES[0]}`);
  verifie('une clé décochée le reste, et les ABSENTES arrivent à la fin, COCHÉES',
    partiel[0].cle === CLES[0] && partiel[0].montre === false
      && partiel.length === CLES.length
      && partiel.slice(1).every((x) => x.montre === true),
    '⇒ le 8ᵉ accès rapide livré demain sera VU par ceux qui ont déjà enregistré un agencement');

  const doublons = TB.lireAgencement(`${CLES[1]},${CLES[1]},${CLES[1]}`);
  verifie('une clé répétée n\'apparaît qu\'une fois',
    doublons.filter((x) => x.cle === CLES[1]).length === 1
      && doublons.length === CLES.length);

  const inverse = TB.lireAgencement(`${CLES[1]},${CLES[0]}`);
  verifie('l\'ordre enregistré GAGNE sur l\'ordre du fichier',
    inverse[0].cle === CLES[1] && inverse[1].cle === CLES[0],
    '⇒ sans ce contrôle, les flèches bougeraient une valeur que personne ne relit');

  const monte = TB.deplacer(parDefaut, CLES[2], -1);
  verifie('la flèche du haut échange bien DEUX lignes, et seulement deux',
    monte[1].cle === CLES[2] && monte[2].cle === CLES[1]
      && monte.length === parDefaut.length
      && monte[0].cle === CLES[0],
    `${CLES[2]} passe devant ${CLES[1]}, le reste ne bouge pas`);

  const bord = TB.deplacer(parDefaut, CLES[0], -1);
  verifie('monter la PREMIÈRE ligne ne perd rien et ne réordonne rien',
    bord.length === parDefaut.length && bord.every((x, i) => x.cle === parDefaut[i].cle),
    '⇒ une requête fabriquée à la main ne casse pas l\'agencement');

  const fantome = TB.deplacer(parDefaut, 'nexiste-pas', +1);
  verifie('déplacer une clé inconnue rend la liste INCHANGÉE',
    fantome.length === parDefaut.length && fantome.every((x, i) => x.cle === parDefaut[i].cle));

  const allerRetour = TB.lireAgencement(TB.ecrireAgencement(
    parDefaut.map((x, i) => ({ ...x, montre: i % 2 === 0 }))));
  verifie('🔑 écrire puis relire rend EXACTEMENT le même état (aller-retour)',
    allerRetour.length === CLES.length
      && allerRetour.every((x, i) => x.cle === parDefaut[i].cle && x.montre === (i % 2 === 0)),
    '⇒ sans cela, un réglage enregistré se relirait autrement — « ça ne s\'enregistre pas »');

  // 🔬🔴 CE CONTRÔLE A ÉTÉ FAUX UNE FOIS, ET LA CORRECTION VAUT D'ÊTRE ÉCRITE.
  //   Il disait : `lireAgencement(ecrireAgencement([]))` porte les 7 clés. Mais
  //   c'est `lireAgencement` qui complète : retirer la complétion de
  //   `ecrireAgencement` laissait le contrôle VERT. *Une mesure qui compte la
  //   sortie de sa propre transformation ne dit rien de la source.*
  //   ⇒ on lit la CHAÎNE écrite, pas ce qu'une seconde fabrique en refait.
  const rien = TB.ecrireAgencement([]);
  const partielEcrit = TB.ecrireAgencement([{ cle: CLES[0], montre: true }]);
  verifie('écrire une liste VIDE ou INCOMPLÈTE nomme quand même TOUTES les clés',
    CLES.every((c) => rien.split(',').includes(c) || rien.split(',').includes(`-${c}`))
      && CLES.every((c) => partielEcrit.split(',').includes(c)
        || partielEcrit.split(',').includes(`-${c}`)),
    'une liste vide vaut « rien de demandé », jamais « efface le catalogue »');

  verifie('la valeur la plus longue possible tient sous le plafond du magasin',
    TB.ecrireAgencement(CLES.map((c) => ({ cle: c, montre: false }))).length <= TB.PLAFOND,
    `${TB.ecrireAgencement(CLES.map((c) => ({ cle: c, montre: false }))).length} o pour un plafond de ${TB.PLAFOND}`);
  lus += 10;
}

console.log('\n1 bis. le catalogue est-il d\'accord avec le manifeste ?');

const GAB = join(R, 'src', 'components', 'pages', 'Dashboard.astro');
verifie('le gabarit du tableau de bord existe', existsSync(GAB), GAB);
if (!existsSync(GAB)) { console.log('\n❌ 1 echec(s)'); process.exit(1); }
const src = readFileSync(GAB, 'utf8');
const nu = src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

const entre = (debut, fin) => {
  const i = src.indexOf(debut);
  if (i < 0) return null;
  const j = src.indexOf(fin, i);
  return j < 0 ? null : src.slice(i + debut.length, j);
};
const corpsSans = entre('const SANS_TUILE = {', '\n};');
verifie('la table des absences motivées se lit (SANS_TUILE)', corpsSans !== null,
  corpsSans === null ? '🔴 SANS_TUILE introuvable' : '');
if (corpsSans === null) { console.log(`\n❌ ${echecs} echec(s)`); process.exit(1); }
const clesSans = [...corpsSans.matchAll(/^\s*([a-z_]+):\s*'/gm)].map((m) => m[1]);
lus += clesSans.length;

const { catalogueModules } = await import('../lib/access.mjs');
const MODULES = catalogueModules();
const livres = MODULES.filter((m) => !m.bientot).map((m) => m.cle);

// ⭐ DEUX FAMILLES, ET ELLES NE SE JUGENT PAS PAREIL : un `module:` doit
//   exister au manifeste et y porter son palier ; un `rayon: true` est PUBLIC
//   et n'a rien à y faire. Les confondre ferait poser un cadenas sur une page
//   qui n'a jamais été fermée — ou traiter un vrai module comme un rayon, donc
//   l'ouvrir à tous.
const parModule = ACCES_RAPIDES.filter((x) => x.module).map((x) => x.module);
const parRayon = ACCES_RAPIDES.filter((x) => x.rayon).map((x) => x.cle);

verifie('chaque accès rapide est OU BIEN un module OU BIEN un rayon, jamais les deux ni aucun',
  ACCES_RAPIDES.every((x) => Boolean(x.module) !== Boolean(x.rayon)),
  `${parModule.length} module(s), ${parRayon.length} rayon(s)`);

const inventees = parModule.filter((c) => !MODULES.some((m) => m.cle === c));
verifie('aucun accès rapide ne nomme un module absent du catalogue',
  inventees.length === 0,
  inventees.length
    ? `🔴 ${inventees.join(', ')} — le palier serait introuvable et la tuile ne sortirait jamais`
    : `${parModule.length} clé(s) vérifiée(s) contre le manifeste`);

const rayonsAuManifeste = parRayon.filter((c) => MODULES.some((m) => m.cle === c));
verifie('aucun RAYON n\'est aussi déclaré comme module au manifeste',
  rayonsAuManifeste.length === 0,
  rayonsAuManifeste.length
    ? `🔴 ${rayonsAuManifeste.join(', ')} — deux vérités sur un même palier, et deux réponses le jour où l'une change`
    : `${parRayon.length} rayon(s), tous publics`);

const orphelins = livres.filter((c) => !parModule.includes(c) && !clesSans.includes(c));
verifie('aucun module livré n\'est absent des DEUX tables',
  orphelins.length === 0,
  orphelins.length
    ? `🔴 ${orphelins.join(', ')} — livré(s) au manifeste, invisible(s) au tableau de bord et sans raison écrite.\n`
      + '       ⇒ lui donner une entrée dans ACCES_RAPIDES, ou l\'inscrire dans SANS_TUILE avec pourquoi.'
    : `${livres.length} module(s) livré(s), tous couverts`);

const promises = parModule.filter((c) => {
  const m = MODULES.find((x) => x.cle === c);
  return m && m.bientot;
});
verifie('aucun accès rapide ne pointe vers un module « bientôt »',
  promises.length === 0,
  promises.length ? `🔴 ${promises.join(', ')} — un bloc vide sur la page d'arrivée est une déception à chaque connexion`
    : 'aucune promesse posée sur le tableau de bord');
lus += 4;

console.log('\n1 ter. les libellés existent-ils VRAIMENT, dans les cinq dictionnaires ?');
// 🔴🔴🔴 LE CONTRÔLE QUI AURAIT ATTRAPÉ « mod.sets » EN TOUTES LETTRES.
//   `t()` sur une clé absente rend LA CLÉ, sans une erreur : une tuile mal
//   nommée s'affiche, elle ne casse rien, et personne ne la voit avant une
//   capture d'écran. Un rayon ne s'appelle pas `mod.sets` — il porte
//   `rayon.sets`. Composer le préfixe aurait donc marché pour quatre entrées
//   sur sept, ce qui est la pire proportion possible.
{
  const DICOS = join(R, 'engine', 'i18n');
  const langues = existsSync(DICOS)
    ? readdirSync(DICOS).filter((x) => x.endsWith('.json')) : [];
  verifie('les dictionnaires se lisent', langues.length >= 2, `${langues.length} langue(s)`);
  const manquantes = [];
  for (const f of langues) {
    const d = JSON.parse(readFileSync(join(DICOS, f), 'utf8'));
    for (const x of ACCES_RAPIDES) {
      for (const k of [x.nomCle, x.descCle]) {
        if (!k || !(k in d)) manquantes.push(`${f}:${k || '(absente)'}`);
      }
    }
  }
  verifie('chaque accès rapide a son nom ET sa description dans CHAQUE langue',
    manquantes.length === 0,
    manquantes.length
      ? `🔴 ${manquantes.slice(0, 8).join(', ')}${manquantes.length > 8 ? ` … (+${manquantes.length - 8})` : ''}\n`
        + '       ⇒ t() rendrait la clé elle-même, en silence, et la tuile afficherait « mod.sets »'
      : `${ACCES_RAPIDES.length * 2} libellé(s) × ${langues.length} langue(s) — tous présents`);
  lus += ACCES_RAPIDES.length * 2 * langues.length;

  // ⭐ ET L'INVERSE : la clé retirée par ce lot ne doit plus traîner nulle part.
  //   Une clé posée que personne ne lit voyage dans cinq fichiers.
  const restes = [];
  for (const f of langues) {
    const d = JSON.parse(readFileSync(join(DICOS, f), 'utf8'));
    if ('dash.catalogue' in d) restes.push(f);
  }
  verifie('`dash.catalogue` a bien quitté les dictionnaires', restes.length === 0,
    restes.length ? `🔴 encore dans ${restes.join(', ')} — le bloc qui la lisait a été retiré au lot 202`
      : 'retirée des cinq, comme les six clés du 154-A');
  lus++;
}

console.log('\n1 quater. le réglage arrive-t-il jusqu\'à l\'écran ? (le circuit complet)');
const lireNu = (...p) => {
  const f = join(R, ...p);
  if (!existsSync(f)) return null;
  return readFileSync(f, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
};

// 🔴🔴🔴 LE GABARIT NE DOIT PAS ALLER CHERCHER LE COOKIE TOUT SEUL. C'est la
//   panne du lot 24 vue depuis un composant : `Astro.cookies` y marche tant
//   que la page est rendue à la demande, puis rend l'ordre par défaut sans
//   erreur ni banc rouge le jour où un gabarit pré-généré l'emploie.
verifie('le gabarit REÇOIT l\'agencement en prop (`tb`)',
  /\btb\s*=\s*''\s*\}\s*=\s*Astro\.props/.test(nu) || /Astro\.props[\s\S]{0,200}?\btb\b/.test(nu),
  '⇒ la route lit, le composant reçoit');
verifie('🔑 et il ne lit PAS le cookie lui-même',
  !/Astro\.cookies/.test(nu),
  '`Astro.cookies` dans un composant : juste aujourd\'hui, muet le jour d\'un pré-rendu');
verifie('le gabarit passe la valeur reçue à `lireAgencement`',
  /lireAgencement\(\s*tb\s*\)/.test(nu),
  '⇒ sans ça la prop voyage et personne ne l\'ouvre');

// 🔬🔴 CONTRÔLE AJOUTÉ APRÈS UNE INJECTION QUI N'AVAIT PAS MORDU. Le § « 1 ter »
//   prouve que les libellés de la table existent dans les cinq dictionnaires —
//   il ne prouve pas que le GABARIT les lit. Remettre une clé composée
//   (`mod.` + la clé) laissait donc tout vert, pendant qu'un rayon aurait
//   affiché « mod.sets » en toutes lettres : `t()` sur une clé absente rend la
//   clé, sans une erreur.
verifie('🔑 les libellés viennent de la TABLE, jamais d\'une clé composée',
  /t\(lang,\s*x\.nomCle\)/.test(nu) && /t\(lang,\s*x\.descCle\)/.test(nu)
    && !/`mod\.\$\{/.test(nu),
  '⇒ un rayon porte `rayon.sets`, pas `mod.sets` : composer le préfixe marcherait\n'
  + '       pour 4 entrées sur 7, ce qui est la pire proportion possible');
lus += 4;

// ⚠️ LES DEUX ROUTES. N'en corriger qu'une donne un réglage qui marche en
//    anglais et se tait en français — « une correction qui s'arrête au bord de
//    son fichier ». C'est le vrai risque de ce lot.
for (const [ou, ...p] of [
  ['/dashboard/', 'src', 'pages', 'dashboard', 'index.astro'],
  ['/[locale]/dashboard/', 'src', 'pages', '[locale]', 'dashboard', 'index.astro'],
]) {
  const s = lireNu(...p);
  verifie(`${ou} lit le cookie et descend la prop`,
    s !== null && /Astro\.cookies\.get\(\s*TB_COOKIE\s*\)/.test(s) && /tb=\{tb\}/.test(s),
    s === null ? `🔴 fichier introuvable : ${p.join('/')}`
      : '⇒ les deux routes, ou le réglage ne marche que dans une langue');
  lus++;
}

// ⚠️ LA ROUTE D'ÉCRITURE. Le témoin `bloc` n'est pas décoratif : sans lui, un
//    POST du bloc e-mails est indiscernable d'un « tout décoché » venu de
//    l'autre bloc, et chaque enregistrement effacerait l'autre.
{
  const s = lireNu('src', 'pages', 'api', 'reglages.js');
  verifie('/api/reglages distingue les deux blocs qui postent chez elle',
    s !== null && /f\.get\('bloc'\)/.test(s) && /bloc === 'tableau'/.test(s),
    '⇒ deux formulaires, une route, un discriminant');
  verifie('elle recompose l\'ordre depuis le champ caché, et pas depuis la base',
    s !== null && /f\.get\('tb_ordre'\)/.test(s),
    '⇒ l\'ordre que la personne a sous les yeux gagne');
  verifie('🔑 elle repose le COOKIE après avoir rangé la préférence',
    s !== null && /cookies\.set\(\s*COOKIE\s*,/.test(s),
    '⇒ sans cette ligne le réglage est exact en base et sans effet jusqu\'au prochain login :\n'
    + '       le défaut le plus coûteux du lot, parce qu\'il ressemble à un enregistrement raté');
  verifie('les deux flèches sont lues comme des BOUTONS de soumission',
    s !== null && /f\.get\('haut'\)/.test(s) && /f\.get\('bas'\)/.test(s),
    '⇒ c\'est ce qui les fait marcher sans une ligne de JavaScript');
  lus += 4;
}

// ⚠️ ET LA CONNEXION, qui est le seul endroit où l'aller-retour vers veveid
//    est DÉJÀ payé — donc le seul où le cookie peut repartir d'un appareil neuf.
{
  const s = lireNu('src', 'pages', 'api', 'entrer.js');
  // 🔬🔴 MOTIF ANCRÉ EN DÉBUT DE LIGNE, APRÈS UNE INJECTION QUI N'AVAIT PAS
  //   MORDU. Le contrôle cherchait le NOM `TB_COOKIE` : poser un garde devant
  //   l'appel — deux mots — le laissait vert, alors que la ligne ne s'exécutait
  //   plus jamais. *Chercher un USAGE, jamais un NOM.*
  // ⚠️ ET CE QU'IL NE PROUVE TOUJOURS PAS, écrit ici pour que personne ne s'y
  //   fie : il lit du TEXTE. Il refuse un garde placé devant l'appel, il ne
  //   peut pas dire que ce chemin s'exécute — la seule mesure qui le dirait
  //   demanderait un service d'identité, que ce banc n'a pas.
  verifie('/api/entrer repose l\'agencement du compte à la connexion',
    s !== null && /^\s*cookies\.set\(TB_COOKIE,/m.test(s)
      && /lirePref\(compte,\s*TB_CLE\)/.test(s),
    '⇒ c\'est ce qui fait suivre le réglage sur un téléphone neuf');
  lus++;
}

// ⚠️ LE FORMULAIRE. Un bloc qui n'émettrait pas son témoin serait refusé par
//    la route à chaque envoi — vert au build, muet à l'usage.
{
  const s = lireNu('src', 'pages', 'compte', 'index.astro');
  verifie('/compte/ poste vers la route existante, sans en inventer une',
    s !== null && /action="\/api\/reglages"/.test(s));
  verifie('le formulaire du tableau de bord émet SES DEUX témoins',
    s !== null && /name="bloc" value="tableau"/.test(s) && /name="poste" value="1"/.test(s),
    '⇒ une case non cochée n\'est pas envoyée : sans témoin, un POST vide TOUT décocherait');
  verifie('il porte l\'ordre courant dans un champ caché',
    s !== null && /name="tb_ordre"/.test(s));
  verifie('les deux flèches sont des boutons nommés, pas des liens',
    s !== null && /type="submit" name="haut"/.test(s) && /type="submit" name="bas"/.test(s),
    '⛔ un lien qui écrit s\'exécute depuis n\'importe quel site par une balise image');
  verifie('la flèche du haut ne s\'affiche pas sur la première ligne',
    s !== null && /i > 0/.test(s),
    'un bouton qui ne peut rien faire est un bouton qui trompe');
  verifie('l\'ancre de retour existe, sinon chaque flèche renvoie en haut de mille lignes',
    s !== null && /id="tableau"/.test(s));
  lus += 6;
}

console.log('\n1 quinquies. le masquage des tuiles fermées est-il branché sur la CAISSE ?');
const { manifest } = await import('../lib/manifest.mjs');
const { PALIERS } = await import('../lib/access.mjs');
const branche = /const\s+caisse\s*=\s*Boolean\(\s*manifest\(\)\.offer\?\.url\s*\)/.test(nu);
verifie('la caisse est LUE au manifeste (`Boolean(manifest().offer?.url)`)',
  branche,
  branche ? '⇒ la même condition que /offre/ et /compte/ — une seule vérité'
    : '🔴 absente, ou écrite en dur : la décision du 20/08 serait gravée.');
lus++;
const filtre = /\.filter\(\(x\)\s*=>\s*x\.ouvert\s*\|\|\s*caisse\)/.test(nu);
verifie('les tuiles fermées ne sont masquées QUE faute de caisse (`x.ouvert || caisse`)',
  filtre,
  filtre ? '⇒ le jour où `offer.url` se vide, elles disparaissent seules'
    : '🔴 filtre absent ou réécrit. Un `.filter((x) => x.ouvert)` nu masque POUR TOUJOURS.');
lus++;
const gardeSite = /!avecPrix\s*\?\s*\[\]\s*:/.test(nu);
verifie('🔑 toute la chaîne reste gardée par `avecPrix`',
  gardeSite,
  gardeSite ? '⇒ sur vevewiki, aucune tuile de rayon vers une page qui n\'existe pas'
    : '🔴 depuis que les RAYONS sont des accès rapides, ils ne dépendent plus d\'aucun module :\n'
      + '       sans cette garde, vevewiki rendrait trois tuiles vers /sets/, /collectibles/, /comics/.');
lus++;

const defaut = (nu.match(/palier\s*=\s*'([a-z]+)'/) || [])[1] || null;
verifie('le gabarit déclare le palier plancher qu\'il sert par défaut',
  defaut !== null && PALIERS.includes(defaut),
  defaut ? `plancher lu dans le gabarit : « ${defaut} »`
    : '🔴 introuvable — sans lui, ce banc mesurerait sur `visitor`, qui est redirigé en 302');
lus++;

const caisseReelle = Boolean(manifest().offer?.url);
const rangDe = (c) => PALIERS.indexOf(c);
const declarees = ACCES_RAPIDES
  .map((x) => (x.rayon
    ? { cle: x.cle, tier: PALIERS[0] }
    : { cle: x.cle, mo: MODULES.find((m) => m.cle === x.module) }))
  .filter((x) => x.tier || (x.mo && !x.mo.bientot))
  .map((x) => ({ cle: x.cle, tier: x.tier || x.mo.tier }));
const renduesA = (pal) => declarees.filter((x) => rangDe(pal) >= rangDe(x.tier) || caisseReelle);
const masqueesA = (pal) => declarees.filter((x) => !(rangDe(pal) >= rangDe(x.tier) || caisseReelle));
lus += declarees.length;

console.log(`  ℹ️    caisse : ${caisseReelle ? 'OUVERTE (offer.url renseignée)' : 'ABSENTE (offer.url vide)'}`);
for (const pal of PALIERS) {
  const r = renduesA(pal).length;
  const m = masqueesA(pal).map((x) => `${x.cle}→${x.tier}`);
  console.log(`  ℹ️      ${pal.padEnd(10)} ${r}/${declarees.length} rendue(s)`
    + (m.length ? `   masquée(s) : ${m.join(', ')}` : ''));
}
const mordSurOuvert = PALIERS.some((pal) =>
  masqueesA(pal).some((x) => rangDe(pal) >= rangDe(x.tier)));
verifie('aucune tuile OUVERTE n\'est masquée, à aucun palier',
  !mordSurOuvert,
  `${PALIERS.length} palier(s) balayés — seuls les modules fermés disparaissent`);
if (defaut) {
  const r = renduesA(defaut).length;
  verifie(`il reste au moins une tuile au palier plancher « ${defaut} »`, r > 0,
    r > 0 ? `${r} tuile(s) rendue(s) — le bloc « Accès rapide » est affiché`
      : '🔴 zéro : le bloc entier disparaît de la page d\'arrivée d\'un membre');
}
verifie('les trois rayons sont ouverts au palier plancher, sans cadenas',
  parRayon.every((c) => renduesA(defaut || PALIERS[0]).some((x) => x.cle === c)),
  '⇒ un rayon est PUBLIC : lui poser un cadenas fermerait une porte qui ne l\'a jamais été');
lus++;
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
// ⚠️ `nu` EST CALCULÉ EN HAUT (juste après la lecture du gabarit) : §1 bis en a
//   besoin AVANT cette section, et deux découpages du même fichier finiraient
//   par diverger — l'un apprendrait une forme de commentaire que l'autre
//   ignorerait, et le plus vieux serait vert pour rien.

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
// 🧾🔴🔴🔴 LOT 212 — CE CONTRÔLE A ROUGI SANS AUCUNE FAUTE DANS LE CODE.
// Il exigeait la chaîne EXACTE `class="etiq etiq--bleu">// `. Le lot 212 ajoute
// un troisième jeton à la liste de classes (`tete-p__st`, qui masque le
// sur-titre sous 640 px) : l'étiquette est toujours là, toujours en tête de
// page, toujours bleue — et le banc a dit non.
// ⭐⭐⭐ IL NE MESURAIT PAS SA PROPRE QUESTION. Sa question est « la page
// ouvre-t-elle par l'étiquette de section ? » ; ce qu'il lisait était « la liste
// de classes est-elle écrite avec ces deux mots-là, dans cet ordre-là, et rien
// d'autre ». Un attribut `class` est un ENSEMBLE non ordonné et extensible : le
// comparer octet par octet fabrique un faux rouge à chaque ajout légitime, et
// c'est le dixième banc de ce projet à se faire prendre sur *sur quoi est-il
// branché ?* plutôt que sur ce qu'il croit surveiller.
// ⇒ On interroge désormais la FORME : un `<p>` dont la liste de classes
//   CONTIENT `etiq` et `etiq--bleu`, et dont le contenu ouvre par `// `.
// ⛔ ET SURTOUT PAS EN RELÂCHANT VERS `/etiq--bleu/` TOUT COURT : cette classe
//   habille aussi des étiquettes de MODULE au milieu de la page. Le banc doit
//   continuer à refuser une page qui n'ouvrirait plus par son sur-titre — c'est
//   sa seule raison d'exister.
const OUVRE_PAR_SURTITRE = /<p class="([^"]*)">\/\/ /;
const mCls = nu.match(OUVRE_PAR_SURTITRE);
const jetons = mCls ? mCls[1].trim().split(/\s+/) : [];
verifie('la page ouvre par l\'étiquette de section du réseau (`etiq` + `etiq--bleu`)',
  jetons.includes('etiq') && jetons.includes('etiq--bleu'),
  jetons.length ? `classes lues : ${jetons.join(' ')}`
    : '🔴 aucun `<p class="…">// ` en tête de page');
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

// 📊 LOT 202 — L'ID SE LIT MAINTENANT DANS LE MODULE, PAS DANS LE GABARIT.
//   ⭐ Plus fort qu'un découpage au texte : on lit ce que le module EXPORTE
//   vraiment, donc ce que les trois lecteurs de la table verront.
const idCompteur = (ACCES_RAPIDES.find((x) => x.cle === 'favoris') || {}).compteur || null;
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
// 4 ter. LOT 220 — CHAQUE CLÉ DE TRI A SON LIBELLÉ, ET UN BANC LE TIENT
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE CONTRÔLE EXISTE PARCE QUE LE DÉFAUT EST DÉJÀ PARTI EN PRODUCTION.
// Le lot 219 a ajouté la clé `ten-desc` à `TRIS` (`marche_selection.mjs`) et a
// oublié son libellé dans `LIB_TRI` (`Market.astro`). La table rendait donc
// `undefined` pour cette clé, `t()` le recopie tel quel, et le menu de tri
// affichait le mot **undefined** à un abonné.
//
// ⭐⭐⭐ ET LE FICHIER ANNONÇAIT LE PIÈGE — DANS L'AUTRE SENS. Son commentaire
// dit : « une liste recopiée ici proposerait un jour un tri que le serveur ne
// connaît pas ». C'est l'inverse qui s'est produit : un tri que le serveur
// connaît et que le gabarit ne sait pas nommer. *Une mise en garde protège le
// sens qu'elle énonce, pas le sens inverse* — et c'est pourquoi ce banc vérifie
// les DEUX directions, pas seulement celle qui a mordu.
//
// ⛔ ON NE FUSIONNE PAS LES DEUX LISTES POUR AUTANT : les clés vivent avec le
// code qui trie, les libellés avec le code qui affiche, et c'est juste. Ce qu'il
// fallait, ce n'est pas une liste de moins — c'est un banc de plus.
console.log('\n4 ter. les tris : une clé, un libellé');
{
  const { TRIS: CLES } = await import('../lib/marche_selection.mjs');
  const src = readFileSync(join(R, 'src', 'components', 'pages', 'Market.astro'), 'utf8');
  // La table telle qu'elle est écrite, entre son ouverture et sa fermeture.
  const bloc = (src.match(/const LIB_TRI = \{([\s\S]*?)\n\};/) || [])[1] || '';
  // ⛔ On lit les clés DÉCLARÉES, pas le résultat d'une évaluation : ce banc ne
  //    monte pas de DOM et ne rend pas la page. Une clé entre guillemets simples
  //    ou nue, les deux formes existent dans le fichier.
  const libelles = new Set((bloc.match(/^\s*'?([a-zA-Z0-9-]+)'?\s*:/gm) || [])
    .map((l) => l.replace(/[\s':]/g, '')));
  lus++;

  const orphelines = CLES.filter((k) => !libelles.has(k));
  verifie(`les ${CLES.length} clés de tri ont toutes un libellé`,
    orphelines.length === 0,
    orphelines.length ? `🔴 sans libellé : ${orphelines.join(', ')} — le menu afficherait « undefined »` : '');

  // ⭐ L'AUTRE SENS, celui que le commentaire d'origine annonçait : un libellé
  //   pour un tri que le serveur ne connaît pas. Il ne casse rien à l'écran,
  //   mais il propose une option qui retombera en silence sur le tri par défaut
  //   — « le <select> l'affiche, le serveur retombe, et personne ne sait
  //   pourquoi l'ordre ne change pas ».
  const fantomes = [...libelles].filter((k) => !CLES.includes(k));
  verifie('aucun libellé ne nomme un tri que le serveur ignore',
    fantomes.length === 0,
    fantomes.length ? `🔴 en trop : ${fantomes.join(', ')} — l'option retomberait sur le tri par défaut` : '');

  // 🔬 ET LE BANC SE JUGE : sans clés lues, les deux contrôles ci-dessus
  //    seraient VERTS en n'ayant rien comparé. *Un terme à zéro doit être
  //    atteignable pour que le vert veuille dire quelque chose.*
  verifie('…et ce banc a bien lu les deux listes',
    CLES.length > 0 && libelles.size > 0,
    `${CLES.length} clé(s) côté serveur · ${libelles.size} libellé(s) côté gabarit`);
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
