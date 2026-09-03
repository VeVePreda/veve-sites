// ⚠️ VeVePreda/veve-sites — engine/tools/test_alertes.mjs  (FICHIER NEUF — lot 215)
//
//     npm run test:alertes
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'IL GARDE — et pourquoi il EXÉCUTE au lieu de LIRE
// ═══════════════════════════════════════════════════════════════════════════
// La plupart des bancs de ce dépôt lisent des sources : ils vérifient qu'une
// ligne est écrite. Ici ça ne suffirait pas, pour deux risques qu'aucune
// lecture ne voit :
//   ① QUATRE MAGASINS PARTAGENT UN FICHIER DE BASE (`favoris`, `prefs`,
//      `portes_surcharge`, et maintenant `alertes`). Si le dernier arrivé abîme
//      la table d'un autre, des données d'utilisateur disparaissent sans erreur,
//      sans run rouge et sans plainte.
//   ② LE FRANCHISSEMENT EST UNE MACHINE À DEUX ÉTATS. « Le prix est sous le
//      seuil » et « le prix vient de passer sous le seuil » se ressemblent dans
//      le code et n'ont rien à voir dans la page : le premier produit une ligne
//      par relevé, le second une seule.
//
// ⭐⭐⭐ CHAQUE POINT A UNE RÉPONSE DANS LES **DEUX** ÉTATS. C'est la règle que
// ce dépôt a payée plusieurs fois : un contrôle muet quand sa condition arrive
// n'est pas un contrôle, c'est un interrupteur. Le § 3 (la purge) est le cas
// typique — « la table est petite » est vrai le premier jour quoi qu'il
// arrive ; on vérifie donc qu'une ligne de 31 jours DISPARAÎT **et** qu'une
// ligne de 29 jours RESTE.
//
// ⛔ IL NE REND AUCUN INDÉCIDABLE. `node:sqlite` est intégré à Node 22, la
// réserve d'essai est fabriquée par le banc lui-même, et rien ici ne dépend du
// réseau ni du contenu de `dist/`. Il tranche, toujours.
//
// ⛔ IL N'ÉCRIT PAS DANS `/data` : base d'essai sous `mkdtempSync`, via
// `DB_PATH`, et réserve d'essai via `RESERVE_DIR`. Un banc qui toucherait le
// volume de production serait pire que le défaut qu'il surveille.

import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let echecs = 0;
const dit = (ok, quoi, detail = '') => {
  if (!ok) echecs++;
  console.log(`  ${ok ? '✅' : '❌'} ${quoi}${detail ? ` — ${detail}` : ''}`);
};
const lire = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

// 🔴🔴 DÉPOUILLER LES COMMENTAIRES AVANT DE CHERCHER — la leçon du 18/08, et
// elle a été repayée TROIS FOIS sur le lot 215 d'avant. Les fichiers de ce lot
// sont très commentés, et tous les motifs cherchés au § 6 apparaissent AUSSI
// dans les phrases qui les expliquent : sans ce dépouillement, le § 6 serait
// vert même si le branchement était entièrement supprimé.
// ⭐ *Un banc qui lit du texte lit aussi les commentaires.*
//
// 🔴🔴🔴 ET LE DÉPOUILLEMENT NAÏF SE TROMPE — MESURÉ, PAS SUPPOSÉ. La forme
// évidente, `s.replace(/\/\*[\s\S]*?\*\//g, ' ')`, prend le `/*` de
// `import.meta.glob('../../src/socle/*.js')` pour un OUVREUR DE COMMENTAIRE et
// avale tout jusqu'au prochain `*/` — dans `socle_js.mjs`, c'est-à-dire la
// liste `ORDRE` en entier. Trois contrôles de ce banc sont sortis ROUGES sur du
// code parfaitement conforme.
// ⇒ On ne retire un bloc que s'il OUVRE une ligne (JSDoc, `/* … */` en tête) ou
//   s'il est une accolade JSX (`{/* … */}`). Un `/*` au milieu d'une chaîne
//   reste ce qu'il est : du texte.
// ⭐ *Un banc qui lit du texte lit aussi ce qui RESSEMBLE à du texte.* Quatrième
//   fois que ce dépôt paie une variante de cette faute.
const sansCommentaires = (s) => s
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')   // les commentaires JSX/Astro
  .replace(/^\s*\/\*[\s\S]*?\*\//gm, ' ')        // les blocs qui ouvrent une ligne
  .split('\n').filter((l) => !/^\s*(\/\/|#|\*)/.test(l)).join('\n');

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const U3 = '33333333-3333-3333-3333-333333333333';
const JOUR = 86_400;

// ═══════════════════════════════════════════════════════════════════════════
// LE BAC — une base ET une réserve, toutes deux jetables
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LES DEUX VARIABLES SE POSENT AVANT LE PREMIER `import` DYNAMIQUE.
// `reserve.mjs` fige `RESERVE_DIR` à l'évaluation du module, et `alertes.mjs`
// lit `DB_PATH` à la première ouverture. Les poser après ferait travailler le
// banc sur les vrais chemins — c'est-à-dire, en production, sur le volume.
const bac = mkdtempSync(join(tmpdir(), 'veve-alertes-'));
const dossierReserve = join(bac, 'historique');
mkdirSync(dossierReserve, { recursive: true });
process.env.DB_PATH = join(bac, 'essai.db');
process.env.RESERVE_DIR = dossierReserve;

/** Écrit une série au FORMAT EXACT de `reserve.mjs::fermer()`. ⛔ Si ce format
 *  change là-bas, ce banc doit rougir : c'est le contrat entre les deux. */
const poserSerie = (uuid, points) => writeFileSync(
  join(dossierReserve, `${uuid}.json`),
  JSON.stringify({ u: uuid, n: points.length, p: points }),
);

const A = await import('../lib/alertes.mjs');
const J = await import('../lib/journal.mjs');
const favoris = await import('../lib/favoris.mjs');

try {
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n1. Le magasin — exécuté sur une vraie base, pas lu');
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LE FAVORI TÉMOIN SE POSE **AVANT** TOUT, ET L'ORDRE EST LE CONTRÔLE.
  // Chaque module ouvre sa base paresseusement, au premier appel. Posé à la
  // fin, un favori serait écrit APRÈS un éventuel `DROP TABLE` de `alertes.mjs`
  // — donc dans une table recréée, et le banc sortirait vert sur un magasin qui
  // détruit les données du voisin. C'est mesuré : le lot 154-B l'a payé.
  favoris.poserFavori('temoin', { uuid: U3, chemin: '/c/x/', nom: 'Témoin' });

  A.poserAlerte('c1', { uuid: U1, chemin: '/c/a/', nom: 'A', sens: 'sous', seuil: 40 });
  dit(A.compterAlertes('c1') === 1, 'une configuration se pose et se relit');

  const favsApres = favoris.lireFavoris('temoin');
  dit(Boolean(favsApres && favsApres[U3]),
    'le favori témoin a survécu à l\'ouverture du magasin des alertes',
    favsApres && favsApres[U3] ? '' : '🔴 la table `favoris` a été abîmée par `alertes.mjs`');

  A.poserAlerte('c1', { uuid: U1, chemin: '/c/a/', nom: 'A', sens: 'sur', seuil: 99 });
  dit(A.compterAlertes('c1') === 1 && A.lireAlertes('c1')[0].sens === 'sur',
    'reposer un seuil sur la même pièce REMPLACE, il n\'ajoute pas de ligne');

  dit(!A.poserAlerte('c1', { uuid: 'pas-un-uuid', sens: 'sous', seuil: 1 }).ok,
    'un uuid de mauvaise forme est refusé');
  dit(!A.poserAlerte('c1', { uuid: U2, sens: 'ailleurs', seuil: 1 }).ok,
    'un sens inconnu est refusé');
  dit(!A.poserAlerte('c1', { uuid: U2, sens: 'sous', seuil: 0 }).ok,
    'un seuil de zéro est refusé — une alerte qui ne peut jamais partir ment par le silence');
  dit(!A.poserAlerte('c2', { uuid: U2, sens: 'sous', seuil: 5 }, null, 0).ok,
    'un plafond de zéro refuse la première configuration');

  // ⭐ ET LE CONTRÔLE INVERSE : modifier une pièce DÉJÀ surveillée doit passer
  //   même quand la liste est pleine — sinon changer un seuil devient
  //   impossible au plafond, ce qui est incompréhensible pour la personne.
  dit(A.poserAlerte('c1', { uuid: U1, sens: 'sous', seuil: 12 }, null, 1).ok,
    'au plafond, modifier une pièce déjà surveillée reste possible');

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n2. Le franchissement — un PASSAGE, jamais un NIVEAU');
  // ═════════════════════════════════════════════════════════════════════════
  const T0 = 1_000_000_000;
  A._reinitialiser();
  process.env.DB_PATH = join(bac, 'franchissement.db');

  // ── 2.1 LE CREUX QUI S'OUVRE ET SE REFERME ENTRE DEUX DÉPLOIEMENTS ───────
  // ⭐⭐⭐ C'EST LE POINT LE PLUS CHER DU LOT, ET IL VIENT DE LA DEMANDE ① DE
  // PREDA (« l'heure doit être précise »). Un producteur qui ne lirait que le
  // DERNIER point — le prix « courant » — ne verrait RIEN ici : la série finit
  // au-dessus du seuil. Le creux serait invisible, sans qu'aucune erreur ne le
  // dise, sur un site parfaitement vert.
  poserSerie(U1, [
    [T0,          50, 1],
    [T0 + 3600,   37, 1],   // ← le franchissement, à CETTE heure-là
    [T0 + 7200,   55, 1],   // ← et c'est déjà remonté
    [T0 + 10800,  56, 1],
  ]);
  A.poserAlerte('c1', { uuid: U1, nom: 'A', sens: 'sous', seuil: 40 },
    { ts: T0, floor: 50 }, 10);
  const r1 = J.balayer({ buildId: 'b1' });
  const f1 = A.lireFeed('c1');
  dit(f1.length === 1, 'un creux ouvert ET refermé entre deux relevés est vu',
    `${f1.length} déclenchement(s), balayage : ${JSON.stringify(r1)}`);
  dit(f1.length === 1 && f1[0].quand === T0 + 3600,
    "l'heure enregistrée est celle DU RELEVÉ, pas celle du balayage",
    f1.length ? `quand = ${f1[0].quand}, attendu ${T0 + 3600}` : 'aucune ligne à juger');

  // ── 2.2 UN NIVEAU NE PRODUIT PAS UNE LIGNE PAR RELEVÉ ────────────────────
  poserSerie(U2, [
    [T0, 50, 1], [T0 + 3600, 30, 1], [T0 + 7200, 29, 1],
    [T0 + 10800, 28, 1], [T0 + 14400, 27, 1],
  ]);
  A.poserAlerte('c1', { uuid: U2, nom: 'B', sens: 'sous', seuil: 40 },
    { ts: T0, floor: 50 }, 10);
  J.balayer({ buildId: 'b2' });
  const f2 = A.lireFeed('c1').filter((l) => l.uuid === U2);
  dit(f2.length === 1, 'un prix qui RESTE sous le seuil ne produit qu\'UNE ligne',
    `${f2.length} ligne(s) pour quatre relevés sous le seuil`);

  // ── 2.3 LE RÉARMEMENT NE S'ANNONCE PAS ───────────────────────────────────
  // ⭐ « Le prix est repassé au-dessus » n'est pas ce qu'on a demandé à
  //   surveiller. Le réarmement change un état, il n'écrit pas une ligne.
  const avant = A.lireAlertes('c1').find((x) => x.uuid === U2);
  poserSerie(U2, [
    [T0, 50, 1], [T0 + 3600, 30, 1], [T0 + 7200, 29, 1],
    [T0 + 10800, 28, 1], [T0 + 14400, 27, 1], [T0 + 18000, 60, 1],
  ]);
  J.balayer({ buildId: 'b3' });
  const apres = A.lireAlertes('c1').find((x) => x.uuid === U2);
  dit(avant && !avant.arme && apres && apres.arme,
    'un prix repassé de l\'autre côté RÉARME la configuration',
    `armée avant : ${avant && avant.arme} → après : ${apres && apres.arme}`);
  dit(A.lireFeed('c1').filter((l) => l.uuid === U2).length === 1,
    '...et le réarmement n\'écrit AUCUNE ligne de feed');

  // ── 2.4 POSER UN SEUIL DÉJÀ FRANCHI DÉMARRE DÉSARMÉ ──────────────────────
  // 🔴 LA FAUTE LA PLUS FACILE À ÉCRIRE ET LA PLUS DURE À VOIR : elle produit
  //    un déclenchement PLAUSIBLE. Poser « sous 40 » sur une pièce déjà à 27
  //    ne doit rien déclencher — il n'y a pas eu de passage.
  poserSerie(U3, [[T0, 27, 1], [T0 + 3600, 26, 1]]);
  A.poserAlerte('c9', { uuid: U3, nom: 'C', sens: 'sous', seuil: 40 },
    { ts: T0, floor: 27 }, 10);
  J.balayer({ buildId: 'b4' });
  dit(A.lireFeed('c9').length === 0,
    'poser un seuil DÉJÀ franchi ne déclenche rien — c\'est un niveau, pas un passage',
    `${A.lireFeed('c9').length} ligne(s)`);
  // ⭐ ET LA CONTRE-ÉPREUVE, sans laquelle le point ci-dessus serait vert même
  //   si le producteur ne déclenchait JAMAIS rien pour ce compte.
  poserSerie(U3, [[T0, 27, 1], [T0 + 3600, 26, 1], [T0 + 7200, 80, 1], [T0 + 10800, 25, 1]]);
  J.balayer({ buildId: 'b5' });
  dit(A.lireFeed('c9').length === 1,
    '...et la même configuration déclenche dès qu\'un VRAI passage a lieu',
    `${A.lireFeed('c9').length} ligne(s) après remontée puis rechute`);

  // ── 2.5 DEUX BALAYAGES NE DOUBLENT PAS UNE LIGNE ─────────────────────────
  J.balayer({ buildId: 'b6' });
  J.balayer({ buildId: 'b7' });
  dit(A.lireFeed('c9').length === 1, 'rebalayer n\'insère pas deux fois le même franchissement');

  // ── 2.5 bis LE PLANCHER QUI VAUT EXACTEMENT LE SEUIL FRANCHIT ────────────
  // ⭐ La borne se mesure, elle ne se suppose pas. `franchi()` est la SEULE
  //   définition de « la condition est vraie » — armement initial, détection et
  //   réarmement s'en servent tous les trois. Une comparaison stricte au lieu
  //   d'une comparaison large ne se verrait QUE sur une pièce dont le plancher
  //   vaut exactement le seuil : autant dire jamais, jusqu'au jour où.
  const EGAL = '55555555-5555-5555-5555-555555555555';
  poserSerie(EGAL, [[T0, 50, 1], [T0 + 3600, 40, 1]]);
  A.poserAlerte('ce', { uuid: EGAL, nom: 'E', sens: 'sous', seuil: 40 },
    { ts: T0, floor: 50 }, 10);
  J.balayer({ buildId: 'begal' });
  dit(A.lireFeed('ce').length === 1,
    'un plancher ÉGAL au seuil compte comme un franchissement',
    `${A.lireFeed('ce').length} ligne(s) pour un plancher à 40 sous un seuil de 40`);

  // ── 2.5 ter RETIRER UNE CONFIGURATION EMPORTE SES DÉCLENCHEMENTS ─────────
  // ⭐ Le feed lit le NOM dans `alertes` : une ligne orpheline serait une ligne
  //   sans nom, donc illisible, dans la page dont c'est le seul sujet.
  // ⛔ Et ce point a une réponse dans les DEUX états : on vérifie qu'il y avait
  //   bien quelque chose à effacer AVANT de vérifier que c'est parti.
  dit(A.lireFeed('ce').length === 1, '...et cette ligne existe bien avant le retrait');
  A.retirerAlerte('ce', EGAL);
  // 🔴🔴🔴 ON COMPTE LES LIGNES **DANS LA TABLE**, PAS PAR `lireFeed()`, ET
  // C'EST L'INSTRUMENT QUI L'A IMPOSÉ. La première version de ce point lisait
  // le feed — or `lireFeed()` fait une JOINTURE STRICTE sur `alertes` : une
  // ligne orpheline y est INVISIBLE par construction. ⭐ MESURÉ EN INJECTANT LE
  // MAUVAIS CODE : retirer l'effacement des déclenchements dans
  // `retirerAlerte()` laissait ce point ENTIÈREMENT VERT.
  // ⇒ *Une mesure qui passe par le mécanisme qui masque le défaut ne mesure
  //   rien.* On ouvre donc la base directement.
  const { DatabaseSync: DB1 } = await import('node:sqlite');
  const dv = new DB1(process.env.DB_PATH);
  const orphelines = dv.prepare(
    'SELECT COUNT(*) AS n FROM declenchements WHERE compte = ? AND uuid = ?').get('ce', EGAL).n;
  dv.close();
  dit(orphelines === 0 && A.compterAlertes('ce') === 0,
    'retirer une configuration efface AUSSI ses déclenchements EN BASE',
    `${orphelines} ligne(s) orpheline(s) et ${A.compterAlertes('ce')} configuration(s) restantes`);

  // ── 2.6 UNE RÉSERVE ABSENTE EST INDÉCIDABLE, PAS VIDE ────────────────────
  // ⛔ Avancer `vu_ts` sur une pièce dont on n'a pas pu lire la série ferait
  //    passer un balayage muet pour un balayage complet : au déploiement
  //    suivant, les points sautés ne seraient jamais relus.
  const SANS = '44444444-4444-4444-4444-444444444444';
  // 🔴🔴 LE CURSEUR DE DÉPART EST **ANCIEN**, ET C'EST LE JEU D'ESSAI QUI L'A
  // IMPOSÉ. La première version posait cette alerte avec `etatCourant = null` :
  // `poserAlerte` ancre alors `vu_ts` à MAINTENANT, et une injection qui faisait
  // avancer le curseur à `Date.now()` produisait donc la MÊME valeur, à la
  // seconde près. Le point sortait vert sur du code fautif.
  // ⭐ *Une injection qui ne mord pas accuse le jeu d'essai ou l'instrument,
  //   jamais le code.* On part d'un curseur de 2001 : tout déplacement se voit.
  // ⚠️ `floor: 99` sous un seuil de 10 : la condition n'est PAS déjà vraie,
  //    donc l'alerte démarre armée — le point mesure le curseur, rien d'autre.
  A.poserAlerte('c9', { uuid: SANS, nom: 'D', sens: 'sous', seuil: 10 },
    { ts: T0, floor: 99 }, 10);
  const vuAvant = A.lireAlertes('c9').find((x) => x.uuid === SANS).vu_ts;
  const rSans = J.balayer({ buildId: 'b8' });
  const vuApres = A.lireAlertes('c9').find((x) => x.uuid === SANS).vu_ts;
  dit(rSans.sansReserve >= 1 && vuAvant === vuApres,
    'une pièce sans réserve est COMPTÉE et son curseur ne bouge pas',
    `sansReserve = ${rSans.sansReserve}, vu_ts ${vuAvant} → ${vuApres}`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n3. La purge — 30 jours, et elle a une réponse dans les DEUX sens');
  // ═════════════════════════════════════════════════════════════════════════
  // ⛔⛔ NE PAS ÉCRIRE « la table est petite » : c'est vrai le premier jour quoi
  //    qu'il arrive, donc ce serait un contrôle vert par construction. On
  //    vérifie qu'une ligne VIEILLE part **et** qu'une ligne RÉCENTE reste.
  // ⭐ Et la durée est LUE dans le module, pas recopiée ici : deux définitions
  //    d'une durée finissent par diverger, et celle qui perd efface des données.
  A._reinitialiser();
  process.env.DB_PATH = join(bac, 'purge.db');
  const maintenant = 2_000_000_000;
  const R = A.RETENTION_JOURS;
  A.poserAlerte('cp', { uuid: U1, nom: 'A', sens: 'sous', seuil: 40 }, null, 10);
  A.poserDeclenchement('cp', U1, maintenant - (R + 1) * JOUR, 'sous', 40);  // trop vieux
  A.poserDeclenchement('cp', U1, maintenant - (R - 1) * JOUR, 'sous', 40);  // encore bon
  dit(A.lireFeed('cp').length === 2, `deux lignes posées de part et d'autre des ${R} jours`);
  const p = A.purger(maintenant);
  const restantes = A.lireFeed('cp');
  dit(p.effaces === 1, `la purge efface la ligne de ${R + 1} jours`, `effacées : ${p.effaces}`);
  dit(restantes.length === 1 && restantes[0].quand === maintenant - (R - 1) * JOUR,
    `...et elle GARDE celle de ${R - 1} jours`,
    `${restantes.length} ligne(s) restante(s)`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n4. Le témoin de build — le producteur ne travaille qu\'une fois');
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐ La réserve est figée au build : rebalayer sous le même identifiant
  //   relirait les mêmes points. ⛔ Et le contrôle inverse compte autant : sous
  //   un identifiant DIFFÉRENT, le producteur doit retravailler — sinon le
  //   témoin ne serait pas un cadencement, ce serait un interrupteur d'arrêt.
  const r2 = J.balayer({ buildId: 'meme' });
  const r3 = J.balayer({ buildId: 'meme' });
  const r4 = J.balayer({ buildId: 'autre' });
  dit(r2.saute === false, 'le premier balayage d\'un build travaille');
  dit(r3.saute === true, '...le second, sous le même build, sort immédiatement');
  dit(r4.saute === false, '...et un build DIFFÉRENT fait retravailler le producteur');

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n5. Aucun prix de marché ne peut entrer dans la table');
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ CE CONTRÔLE PORTE L'ARBITRAGE ① DE PREDA (« sobre ») JUSQU'AU SCHÉMA.
  // La ligne du feed n'affiche que le SEUIL — une valeur que la personne a
  // tapée. `declenchements` n'a donc AUCUNE colonne de prix, et ce point le
  // vérifie sur le schéma réel, pas sur une intention écrite en commentaire.
  // ⛔ *Un champ qu'on range « au cas où » finit par s'afficher.*
  const { DatabaseSync } = await import('node:sqlite');
  const d = new DatabaseSync(process.env.DB_PATH);
  const colonnes = d.prepare('PRAGMA table_info(declenchements)').all().map((c) => c.name);
  d.close();
  const suspectes = colonnes.filter((c) => /prix|price|floor|montant|valeur/i.test(c));
  dit(colonnes.length > 0, 'le schéma de `declenchements` a pu être lu',
    `colonnes : ${colonnes.join(', ')}`);
  dit(suspectes.length === 0, 'aucune colonne de la table ne porte un prix de marché',
    suspectes.length ? `🔴 ${suspectes.join(', ')}` : `${colonnes.length} colonne(s) vérifiée(s)`);

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n6. Le branchement — les endroits d\'une route de compte');
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 ON CHERCHE UN **USAGE**, JAMAIS UN NOM, et on cherche dans du CODE
  // DÉPOUILLÉ. Une injection du lot précédent n'a pas mordu parce qu'elle
  // cherchait un identifiant : les noms survivent comme définition et comme
  // import longtemps après que plus personne ne les appelle.
  const routes = sansCommentaires(lire(join(RACINE, 'engine/lib/astro_routes_compte.mjs')));
  for (const r of ['pages/alertes/index.astro', 'pages/alertes/reglages/index.astro',
                   'pages/[locale]/alertes/index.astro',
                   'pages/[locale]/alertes/reglages/index.astro',
                   'pages/api/alertes.js']) {
    dit(routes.includes(`'${r}'`), `ROUTES_COMPTE porte ${r}`,
      routes.includes(`'${r}'`) ? '' : '🔴 elle serait PRÉ-GÉNÉRÉE en silence — la panne du lot 24');
  }

  const nginx = sansCommentaires(lire(join(RACINE, 'nginx.server.conf')));
  dit(/location\s*~[^\n]*\balertes\b/.test(nginx),
    'nginx PROXIE les pages d\'alertes vers Node',
    '🔴 sans ça : 404 sur un build vert — la panne du lot 119');
  dit(/location\s*=\s*\/alertes\s/.test(nginx) && /location\s*=\s*\/alertes\/reglages\s/.test(nginx),
    'nginx redirige les DEUX adresses sans barre finale');
  // ⭐ ET L'ORDRE DE L'ALTERNANCE — `alertes/reglages` AVANT `alertes`. PCRE
  //   prend la première branche qui correspond, pas la plus longue.
  const alt = nginx.match(/location\s*~\s*\^\/\(\[a-z\]\[a-z-\]\*\/\)\?\(([^)]*(?:\([^)]*\))?[^)]*)\)\//);
  const ordre = alt ? alt[1] : '';
  dit(ordre.indexOf('alertes/reglages') >= 0
      && ordre.indexOf('alertes/reglages') < ordre.indexOf('|alertes|'),
    '...et `alertes/reglages` est écrit AVANT `alertes` dans l\'alternance',
    ordre ? `alternance lue : ${ordre.slice(0, 90)}…` : '🔴 alternance illisible');

  const cache = sansCommentaires(lire(join(RACINE, 'engine/lib/cache_attendu.mjs')));
  dit(cache.includes("'/alertes/'") && cache.includes("'/alertes/reglages/'"),
    '`cache_attendu.mjs` réclame les deux adresses',
    '🔴 elles rendent 200 : sans exclusion Cloudflare, le bord peut les stocker');
  dit(/source:\s*'pages\/alertes\/'/.test(cache) && /source:\s*'pages\/\[locale\]\/alertes\/'/.test(cache),
    '...et les deux familles de routes sont déclarées');

  const pages = sansCommentaires(lire(join(RACINE, 'engine/tools/test_pages.mjs')));
  dit(pages.includes("p: '/alertes/'") && pages.includes("p: '/alertes/reglages/'"),
    '`test:pages` DEMANDE les deux pages au serveur');

  const dockerfile = sansCommentaires(lire(join(RACINE, 'Dockerfile')));
  dit(/npm run test:alertes/.test(dockerfile),
    'ce banc est branché dans le Dockerfile',
    '🔴 leçon du 214 : un banc qui n\'est dans aucun RUN n\'existe pas');

  // ⭐⭐ LA SONDE ATTEINT-ELLE SON LECTEUR ? Sans ce point, tout le reste peut
  //   être juste et parfaitement inutile — c'est la leçon du lot 195, payée une
  //   journée entière : *un instrument dont la sortie n'atteint pas le lecteur
  //   ne mesure rien.*
  // 🩹 ON ISOLE LE CONTENU DE LA CONDITIONNELLE, PAS L'ORTHOGRAPHE DE LA LIGNE.
  //   `test:caisse` §⑧ a rougi deux fois sur du code conforme pour avoir exigé
  //   une ligne mot pour mot : toute sonde ajoutée sous la même porte la
  //   cassait. Ici, une quatrième sonde pourra arriver sans réveiller ce banc.
  const sante = sansCommentaires(lire(join(RACINE, 'src/pages/api/sante.js')));
  const sousPorte = sante.match(/comptesOuverts\(\)\s*\?\s*\{([^}]*)\}/);
  dit(Boolean(sousPorte) && /alertes:\s*alertes\(\)/.test(sousPorte[1]),
    '`/api/sante` sert le bloc `alertes`, SOUS la porte des comptes',
    sousPorte ? `servi : ${sousPorte[1].trim().slice(0, 70)}` : '🔴 porte introuvable');
  // ⛔ ET LA SONDE NE DOIT RENDRE AUCUN MONTANT : cette route est publique.
  //   `seuil` est un montant ; il n'a rien à faire dans une réponse publique.
  const blocSonde = sante.match(/const alertes = \(\) => \{([\s\S]*?)\n\};/);
  dit(Boolean(blocSonde) && !/seuil|prix|montant/i.test(blocSonde[1]),
    '...et elle ne rend QUE des comptes, jamais un montant',
    blocSonde ? '' : '🔴 bloc de la sonde introuvable');

  const socle = lire(join(RACINE, 'src/socle/modules/alertes.js'));
  dit(socle.length > 0, 'le pilote existe');
  dit(!/localStorage|sessionStorage/.test(sansCommentaires(socle)),
    '...et il ne range rien dans le navigateur — la base est rangée par COMPTE');

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n7. Les clés d\'interface, dans les cinq langues');
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐ LES CLÉS SONT LUES DANS LES COMPOSANTS, PAS RECOPIÉES ICI. Une liste
  //   écrite à la main dans ce fichier vieillirait au premier libellé ajouté,
  //   et elle serait verte sur une clé qui n'existe plus.
  const vues = new Set();
  for (const f of ['src/components/pages/Alertes.astro',
                   'src/components/pages/AlertesReglages.astro']) {
    for (const m of lire(join(RACINE, f)).matchAll(/t\(lang,\s*'([^']+)'/g)) vues.add(m[1]);
  }
  dit(vues.size >= 15, `${vues.size} clé(s) relevées dans les deux composants`);
  for (const lg of ['fr', 'en', 'es', 'de', 'it']) {
    let dico = {};
    try { dico = JSON.parse(lire(join(RACINE, 'engine/i18n', `${lg}.json`))); } catch { dico = {}; }
    const absentes = [...vues].filter((k) => dico[k] === undefined);
    dit(absentes.length === 0, `toutes les clés existent en « ${lg} »`,
      absentes.length ? `🔴 ${absentes.join(' · ')}` : `${vues.size} clé(s)`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n8. La grille des plafonds — une seule définition qui gagne');
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐⭐ Le manifeste est la SOURCE, `access.mjs` porte le DÉFAUT. Les deux sont
  //   écrits pareil délibérément : un défaut qui diverge du manifeste ne se voit
  //   que sur un site qui ne déclare rien — c'est-à-dire nulle part, jusqu'au
  //   jour où quelqu'un ajoute un site.
  // ⛔ ET LE BANC NE RECOPIE PAS LA GRILLE : il compare les deux fichiers l'un à
  //   l'autre. Écrire « 1/10/30/100 » ici en ferait une TROISIÈME définition.
  const man = lire(join(RACINE, 'sites/veveprice/manifest.yml'));
  const blocMan = man.match(/alerts:[\s\S]{0,2200}?caps:\s*\n((?:\s+\w+:\s*\d+\n)+)/);
  const capsMan = blocMan
    ? Object.fromEntries([...blocMan[1].matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]))
    : null;
  const acc = sansCommentaires(lire(join(RACINE, 'engine/lib/access.mjs')));
  const blocAcc = acc.match(/alerts:\s*\{[^}]*caps:\s*\{([^}]*)\}/);
  const capsAcc = blocAcc
    ? Object.fromEntries([...blocAcc[1].matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]))
    : null;
  dit(capsMan && capsAcc, 'les deux grilles ont pu être lues',
    `manifeste : ${JSON.stringify(capsMan)} · défaut : ${JSON.stringify(capsAcc)}`);
  dit(capsMan && capsAcc && JSON.stringify(capsMan) === JSON.stringify(capsAcc),
    'le défaut de `access.mjs` dit la même chose que le manifeste');
  dit(capsMan && Number(capsMan.member) >= 1,
    'le palier gratuit permet au moins UNE alerte — arbitrage Preda du 03/09',
    capsMan ? `member = ${capsMan.member}` : 'grille illisible');

  // ⭐ ET LE MODULE EST DÉCLARÉ LIVRÉ. `test:promesses` §4 le vérifie aussi, sur
  //   le disque ; ici on garde l'autre moitié : la porte descend à `member`,
  //   sinon un membre gratuit aurait un plafond de 1 sur une porte fermée.
  dit(/alerts,\s*bientot:\s*false|porte:\s*alerts,\s*bientot:\s*false/.test(man.replace(/\s+/g, ' ')),
    '`offer.modules` déclare le module LIVRÉ');
  dit(/alerts:\s*\n\s*binaire:[\s\S]{0,1600}?tier:\s*member/.test(man),
    '...et la porte `alerts` s\'ouvre au palier `member`');
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n9. Le panneau de la fiche — poser un seuil (lot 215-B)');
  // ═════════════════════════════════════════════════════════════════════════
  const item = lire(join(RACINE, 'src/components/pages/Item.astro'));
  const itemCode = sansCommentaires(item);

  dit(/data-alerte=\{item\.uuid\}/.test(itemCode), 'la fiche porte le bloc de veille');
  for (const face of ['anon', 'poser', 'posee', 'plein', 'hs']) {
    dit(itemCode.includes(`data-face="${face}"`), `...et sa face « ${face} »`,
      '🔴 une face absente est un état que la page ne sait pas montrer');
  }
  // ⚖️ ARBITRAGE ① — LES DEUX SENS. Le menu doit porter les deux valeurs que la
  //   route accepte, et pas une de plus : `SENS` est la seule définition.
  for (const s of A.SENS) {
    dit(new RegExp(`value="${s}"`).test(itemCode), `le menu porte le sens « ${s} »`);
  }
  // ⛔ ET PAS UN DE PLUS. Un `<option>` dont la valeur n'est pas dans `SENS`
  //    serait refusé par la route — un menu qui propose un choix impossible.
  const optionsSens = [...itemCode.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  dit(optionsSens.length > 0 && optionsSens.every((v) => A.SENS.includes(v)),
    '...et aucun sens que la route refuserait',
    `menu : ${optionsSens.join(', ')} · accepté : ${A.SENS.join(', ')}`);

  // 🔴🔴🔴 AUCUN MONTANT RENDU PAR LE SERVEUR — LA CONTRAINTE QUI A DÉCIDÉ DE
  // LA FORME. La fiche est PRÉ-GÉNÉRÉE : un `value` sur ce champ cuirait un
  // plancher réservé dans 8 484 fichiers publics. `test:fuite` §6 le vérifie sur
  // `dist/` ; ici on le prend à la source, avant même que le build ait lieu.
  const champ = itemCode.match(/<input[^>]*data-seuil[^>]*\/>/s);
  dit(Boolean(champ), 'le champ de seuil a pu être lu');
  dit(Boolean(champ) && !/\svalue[=\s]/.test(champ[0]),
    '...et il ne porte AUCUNE valeur pré-remplie',
    champ ? champ[0].replace(/\s+/g, ' ').slice(0, 110) : '');
  // ⛔ Et la face « déjà posée » est VIDE dans la source : le seuil s'écrit à
  //    l'exécution, depuis une route qui lit la session.
  const etatVide = itemCode.match(/<p[^>]*data-etat[^>]*>([\s\S]*?)<\/p>/);
  dit(Boolean(etatVide) && etatVide[1].trim() === '',
    'la face « déjà posée » est vide dans le fichier servi',
    etatVide ? `contenu : « ${etatVide[1].trim().slice(0, 40)} »` : '🔴 introuvable');

  // 🎨 LA COLLISION DE CLASSE — ELLE A ÉTÉ ATTRAPÉE, ELLE NE DOIT PAS REVENIR.
  // `.alerte` EXISTE DÉJÀ dans le thème : c'est la pastille rouge de 16 px du
  // prix aberrant (Market.astro, CollectionPage.astro). Le bloc en aurait hérité
  // `width:16px; height:16px; background:var(--down)` — invisible avant capture.
  const theme = lire(join(RACINE, 'themes/vitrine/theme.css'));
  dit(/\.veille\s*\{/.test(theme), 'la famille `.veille` existe dans le thème');
  dit(!/class="alerte"/.test(itemCode),
    '...et la fiche n\'emploie pas `.alerte`, déjà pris par la pastille du prix aberrant',
    '🔴 collision : le bloc deviendrait un rond rouge de 16 px');

  // ⭐⭐ UN SEUL ACCÈS RÉSEAU AUX ALERTES — la leçon du lot 140-1.
  const socle45 = lire(join(RACINE, 'src/socle/45-alertes.js'));
  dit(/window\.vpAlertes\s*=/.test(sansCommentaires(socle45)),
    'le socle expose l\'accès unique `window.vpAlertes`');
  for (const f of ['src/socle/modules/alerte_fiche.js', 'src/socle/modules/alertes.js']) {
    const m = sansCommentaires(lire(join(RACINE, f)));
    dit(!/\bfetch\s*\(/.test(m), `${f.split('/').pop()} n'ouvre AUCUN fetch`,
      '🔴 deux accès finissent par traiter le 401 différemment');
    dit(/window\.vpAlertes/.test(m), `...et il passe bien par l'accès unique`);
  }
  // ⛔ ET LA CONTRE-ÉPREUVE : l'accès unique, lui, DOIT en ouvrir un. Sans ce
  //    point, les deux contrôles au-dessus resteraient verts si plus personne
  //    n'appelait le réseau du tout.
  dit(/\bfetch\s*\(/.test(sansCommentaires(socle45)),
    '...et c\'est LUI qui parle au réseau (sinon rien n\'appellerait la route)');

  // 🧭 LA CONDITION VOYAGE AVEC LE CODE — le script et son hôte apparaissent et
  //    disparaissent ENSEMBLE, sur le même prédicat.
  const socleJs = sansCommentaires(lire(join(RACINE, 'engine/lib/socle_js.mjs')));
  dit(/'45-alertes\.js',/.test(socleJs), '`45-alertes.js` est déclaré dans ORDRE',
    '🔴 sinon `socleJs()` LÈVE — le circuit est fermé, mais autant le dire ici');
  dit(/'45-alertes\.js':\s*\(\)\s*=>\s*acces\(\)\.tiers\.length > 1/.test(socleJs),
    '...sous la MÊME condition que `30-membre.js`, appelée et non recopiée');
  dit(/const comptesOuverts = acces\(\)\.tiers\.length > 1/.test(itemCode),
    'la fiche évalue le MÊME prédicat pour rendre le bloc');
  dit(/\{comptesOuverts && <script defer src=\{moduleJs\('alerte_fiche'\)\.href\}><\/script>\}/.test(itemCode),
    '...et le pilote n\'est émis que sous cette condition');
} finally {
  // ⛔ ON NETTOIE MÊME QUAND ÇA ÉCHOUE. Un `finally` absent laisserait des bases
  //    d'essai dans le dossier temporaire de l'image à chaque build rouge.
  A._reinitialiser();
  favoris._reinitialiser();
  delete process.env.DB_PATH;
  delete process.env.RESERVE_DIR;
  rmSync(bac, { recursive: true, force: true });
}

console.log(`\n${echecs === 0 ? '✅ test:alertes — tout est vert' : `❌ test:alertes — ${echecs} échec(s)`}\n`);
process.exit(echecs === 0 ? 0 : 1);
