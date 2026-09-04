// ⚠️ VeVePreda/veve-sites — engine/tools/test_prefs.mjs  (FICHIER NEUF, lot 154-B)
//
//     npm run test:prefs
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'IL GARDE — et pourquoi il EXÉCUTE au lieu de LIRE
// ═══════════════════════════════════════════════════════════════════════════
// La quasi-totalité des bancs de ce dépôt lisent des sources : ils vérifient
// qu'une ligne est écrite. Ici ça ne suffirait pas. Le risque de ce lot n'est
// pas qu'une ligne manque — c'est que DEUX MAGASINS PARTAGENT UN FICHIER DE
// BASE et que l'un abîme l'autre. Ça, aucune lecture de source ne le voit.
// ⇒ Le § 1 ouvre une vraie base SQLite dans un dossier temporaire, y pose des
//   favoris ET des préférences, et vérifie que les deux survivent.
//
// ⭐⭐⭐ CE BANC A ÉTÉ JUGÉ EN LUI INJECTANT LE MAUVAIS CODE — 8 injections,
// mesurées sur le CODE DE SORTIE et non sur le nombre de croix affichées.
// ⚠️ Cette distinction n'est pas de la pédanterie : l'injection ② fait LEVER le
// banc, qui sort en 1 sans écrire une seule croix. Une mesure qui comptait les
// « ❌ » l'avait donc lue « vert ». *On mesure ce que la CI lit, pas ce qu'on
// voit passer à l'écran.*
//
//   ① plafond de clés porté à 1 ......................... sortie 1 ✅
//   ② `PRIMARY KEY (cle)` au lieu de `(compte, cle)` ..... sortie 1 ✅ (il lève)
//   ③ revalidation de la langue retirée d'`entrer.js` .... sortie 1 ✅
//   ④ `DROP TABLE favoris` glissé dans l'ouverture ....... sortie 1 ✅ (après correction, voir § 1.0)
//   ⑤ le middleware résout le compte ..................... sortie 1 ✅
//   ⑥ cookie de langue posé en `httpOnly: true` .......... sortie 1 ✅ (après correction, voir § 2.2)
//   ⑦ `/compte/` ne range plus rien en base .............. sortie 1 ✅
//   ⑧ la pose du cookie désactivée par `if (false)` ...... sortie 0 ❌ NON DÉTECTÉ
//
// 🔴 ⑧ EST UNE LIMITE ASSUMÉE, ET ELLE EST ÉCRITE ICI PLUTÔT QU'ARRONDIE. Ce
// banc lit des SOURCES : il voit qu'une ligne existe, jamais qu'elle s'exécute.
// Juger l'exécution demanderait une session veveid réelle, donc un banc qui ne
// tournerait pas en CI — donc un banc qui ne tournerait pas. Ce qu'il attrape,
// c'est la SUPPRESSION d'un des deux bouts du circuit, qui est le défaut réel
// (lot 90 : un cookie lu et effacé que personne ne posait). Une ligne neutralisée
// par un `if (false)` n'arrive pas par accident.
// ⭐ *Un défaut nommé dans une déclaration a une chance d'être réparé ; un
//   défaut qu'on arrondit disparaît de la mémoire du projet.*
//
// ⛔ ET DEUX DE CES HUIT ONT TROUVÉ UN TROU DANS CE BANC, PAS DANS LE CODE : ④
//    et ⑥ passaient au vert sur un sabotage réel. Les corrections sont écrites
//    au § 1.0 et au § 2.2. Sans les injections, ce lot serait parti avec un
//    contrôle décoratif — c'est exactement ce que la règle du 16/08 achète.
//
// ⛔ IL NE FAIT AUCUN APPEL RÉSEAU et n'écrit que dans `os.tmpdir()`. Il tourne
//    donc sous `WAREHOUSE_OFFLINE=1`, dans la chaîne `npm test`.

import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
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

// 🔴🔴 DÉPOUILLER LES COMMENTAIRES AVANT DE CHERCHER — la leçon du 18/08.
// Un banc de ce dépôt a déclaré 8 routes ABSENTES parce qu'il mordait sur les
// apostrophes de ses propres commentaires ; un autre a validé un correctif en
// trouvant le motif dans une phrase explicative. ⭐ Un critère qui juge du CODE
// doit chercher dans le CODE. Les fichiers de ce lot sont très commentés, et
// tous les motifs cherchés au § 2 apparaissent AUSSI dans les commentaires qui
// les expliquent : sans ce dépouillement, le § 2 serait vert même si le
// branchement était entièrement supprimé.
const sansCommentaires = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n1. Le magasin — exécuté sur une vraie base, pas lu');
// ═══════════════════════════════════════════════════════════════════════════
const bac = mkdtempSync(join(tmpdir(), 'veve-prefs-'));
process.env.DB_PATH = join(bac, 'essai.db');

const prefs = await import('../lib/prefs.mjs');
const favoris = await import('../lib/favoris.mjs');

try {
  // ── 1.0 🔴🔴 LE FAVORI TÉMOIN, POSÉ AVANT TOUT — ET L'ORDRE EST LE CONTRÔLE
  // ═════════════════════════════════════════════════════════════════════════
  // La première version de ce banc posait le favori à la FIN, juste avant de
  // vérifier qu'il survivait. MESURÉ EN INJECTANT LE MAUVAIS CODE : un
  // `DROP TABLE favoris` glissé dans l'ouverture de `prefs.mjs` laissait ce
  // banc ENTIÈREMENT VERT. Raison : chaque module ouvre sa base paresseusement,
  // au premier appel. `favoris.mjs` ne s'ouvrait qu'APRÈS le drop et recréait
  // donc sa table — la destruction était réelle, et parfaitement invisible.
  // ⭐⭐⭐ *Un contrôle qui crée son témoin après le sabotage ne teste rien.*
  //   Le témoin doit préexister à ce qu'on soupçonne. C'est ce que l'ordre de
  //   ces lignes garde, et rien d'autre ne le garde.
  const uuidT = '99999999-8888-7777-6666-555555555555';
  favoris.poserFavori('temoin', { uuid: uuidT, chemin: '/t/', nom: 'Témoin' });
  dit(Object.keys(favoris.lireFavoris('temoin')).length === 1,
    'un favori témoin est posé AVANT que prefs.mjs n’ouvre quoi que ce soit');
  // ── 1.1 poser puis relire ────────────────────────────────────────────────
  prefs.poserPref('c1', 'langue', 'fr');
  dit(prefs.lirePref('c1', 'langue') === 'fr', 'une préférence posée se relit');

  // ── 1.2 remplacer, pas empiler ───────────────────────────────────────────
  prefs.poserPref('c1', 'langue', 'es');
  dit(prefs.lirePref('c1', 'langue') === 'es', 'la reposer la REMPLACE',
    'sans `ON CONFLICT`, la seconde écriture lèverait sur la clé primaire');

  // ── 1.3 le cloisonnement par compte ──────────────────────────────────────
  // ⭐⭐ LE CONTRÔLE LE PLUS IMPORTANT DU § 1. C'est la seule ligne qui fait
  //   qu'un membre ne voit pas les réglages d'un autre. Une clé primaire posée
  //   sur `(cle)` seule ferait de ce magasin une variable GLOBALE partagée par
  //   tous les comptes — et ça marcherait parfaitement tant qu'il n'y a qu'un
  //   seul membre connecté, c'est-à-dire jusqu'à la mise en production.
  prefs.poserPref('c2', 'langue', 'de');
  dit(prefs.lirePref('c1', 'langue') === 'es' && prefs.lirePref('c2', 'langue') === 'de',
    'deux comptes ne se marchent pas dessus');
  dit(prefs.lirePref('c3', 'langue') === null,
    'un compte sans préférence rend null', 'et non la valeur d’un voisin');

  // ── 1.4 les bornes ───────────────────────────────────────────────────────
  dit(prefs.poserPref('c1', 'x'.repeat(60), 'v').ok === false, 'une clé trop longue est refusée');
  dit(prefs.poserPref('c1', 'Majuscule', 'v').ok === false, 'une clé hors alphabet est refusée');
  dit(prefs.poserPref('c1', 'grosse', 'v'.repeat(5000)).ok === false,
    'une valeur au-delà du plafond est refusée', `plafond ${prefs.PLAFOND_VALEUR} o`);

  // ⭐ LE PLAFOND MORD SUR UNE CLÉ NEUVE, PAS SUR UNE MISE À JOUR. Le vérifier
  //   dans les deux sens : un plafond qui bloque aussi le remplacement rendrait
  //   un réglage IMPOSSIBLE À CHANGER une fois la limite atteinte, sans message.
  for (let i = 0; i < prefs.PLAFOND_CLES + 5; i++) prefs.poserPref('c9', `k${i}`, 'v');
  dit(Object.keys(prefs.lirePrefs('c9')).length === prefs.PLAFOND_CLES,
    'le plafond de clés tient', `${prefs.PLAFOND_CLES} clés`);
  dit(prefs.poserPref('c9', 'k0', 'neuve').ok === true
    && prefs.lirePref('c9', 'k0') === 'neuve',
    'mais une clé DÉJÀ rangée reste modifiable au plafond');

  // ── 1.5 retirer ≠ vider · oublier un compte ──────────────────────────────
  prefs.poserPref('c1', 'vide', '');
  dit(prefs.lirePref('c1', 'vide') === '', 'une valeur vide se range et se relit comme vide');
  prefs.retirerPref('c1', 'vide');
  dit(prefs.lirePref('c1', 'vide') === null, 'retirée, elle rend null',
    'une clé absente retombe sur le défaut du site, une clé vide vaut « vide »');

  // ⭐ `oublierCompte()` servira au lot 160 (« suppression de mon compte »).
  //   L'éprouver AUJOURD'HUI, c'est ne pas l'écrire sous pression ce jour-là.
  const r = prefs.oublierCompte('c9');
  dit(r.ok && Object.keys(prefs.lirePrefs('c9')).length === 0, 'oublierCompte efface tout');
  dit(prefs.lirePref('c1', 'langue') === 'es', 'et ne touche PAS les autres comptes');

  // ── 1.6 🔴🔴 LA COHABITATION — LE VRAI RISQUE DE CE LOT ──────────────────
  // Deux modules ouvrent le MÊME fichier de base avec deux connexions
  // distinctes. C'est le choix de conception du lot (`prefs.mjs` ne touche pas
  // `favoris.mjs`, qui est en production), et c'est donc la chose à prouver.
  // ⛔ Aucune lecture de source ne peut la voir : il faut ouvrir les deux.
  const uuid = '11111111-2222-3333-4444-555555555555';
  favoris.poserFavori('c1', { uuid, chemin: '/x/', nom: 'Essai' });
  prefs.poserPref('c1', 'agencement', '["favoris","market"]');
  // 🔴 MESURÉ, PAS SUPPOSÉ : `lireFavoris()` rend un OBJET indexé par uuid, pas
  //    un tableau. La première version de ce contrôle testait `.length`, qui
  //    vaut `undefined` sur un objet — il rougissait sur un code parfaitement
  //    correct. ⭐ *Avant d'accuser le code : sur QUOI ce contrôle est-il
  //    branché ?* Il était branché sur une signature SUPPOSÉE.
  dit(Object.keys(favoris.lireFavoris('c1')).length === 1,
    '🔑 poser une préférence n’abîme pas les favoris du même compte');
  dit(prefs.lirePref('c1', 'agencement') === '["favoris","market"]',
    '🔑 et les favoris n’abîment pas les préférences');
  dit(prefs.lirePref('c1', 'langue') === 'es',
    '🔑 les deux tables cohabitent dans le même fichier');
  // ⭐⭐⭐ ET LE TÉMOIN DU § 1.0 EST TOUJOURS LÀ. C'est CE contrôle-ci qui
  //   rougit quand `prefs.mjs` abîme la table des favoris — pas les trois
  //   au-dessus, qui recréeraient ce qu'ils viennent de perdre.
  dit(Object.keys(favoris.lireFavoris('temoin')).length === 1,
    '🔑🔑 le favori témoin d’avant l’ouverture de prefs.mjs a SURVÉCU',
    'le seul contrôle qui voit une table détruite puis recréée');
} finally {
  prefs._reinitialiser();
  favoris._reinitialiser();
  rmSync(bac, { recursive: true, force: true });
  delete process.env.DB_PATH;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2. Le branchement — les deux bouts du circuit');
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ UN COOKIE POSÉ MAIS JAMAIS RANGÉ, OU RANGÉ MAIS JAMAIS REPOSÉ, EST UN
// CIRCUIT OUVERT : chaque moitié est juste, l'ensemble ne fait rien. C'est
// exactement le défaut que `test:session` a trouvé au lot 90 (un cookie lu et
// effacé que personne ne posait). On compte donc LES DEUX BOUTS.
const entrer = sansCommentaires(lire(join(RACINE, 'src/pages/api/entrer.js')));
const compte = sansCommentaires(lire(join(RACINE, 'src/pages/compte/index.astro')));

// ── 2.1 le bout qui ÉCRIT : /compte/ range le choix sous le compte ─────────
dit(/poserPref\s*\(/.test(compte), '/compte/ range la langue choisie sous le COMPTE');
dit(/_ch\.aPoser\s*&&\s*connecte/.test(compte),
  'et seulement sur un CHANGEMENT, et seulement si connecté',
  'sinon chaque affichage de /compte/ paierait un aller-retour de 4 s vers veveid');
dit(/Astro\.cookies\.set\(COOKIE_LANGUE/.test(compte),
  'le cookie reste posé', '🔴 c’est LUI que lisent les ~3 000 pages pré-générées');

// ── 2.2 le bout qui RELIT : /api/entrer repose le cookie depuis la base ────
dit(/lirePref\s*\(/.test(entrer), '/api/entrer relit la langue du compte à la connexion');
dit(/cookies\.set\(COOKIE_LANGUE/.test(entrer), 'et la repose dans le cookie',
  'c’est ce qui fait suivre la préférence sur un appareil neuf');
// 🔴 LA REVALIDATION. La valeur vient de notre base, donc d'une écriture
// passée — mais la liste des langues du manifeste a pu changer depuis. Poser un
// code que le site ne sert plus composerait un chemin de dictionnaire absent.
dit(/languesInterface\(\)\.includes\(/.test(entrer),
  '🔑 et il la revalide contre le manifeste avant de la poser',
  'une langue retirée du site resterait sinon collée au compte');
// 🔴🔴 CE CONTRÔLE VISE LE BLOC DU COOKIE DE LANGUE, PAS LE FICHIER.
// Première version : `/httpOnly:\s*false/` sur tout `entrer.js`. Elle mordait
// sur `ATTRIBUTS_MEMBRE` (l. 87), qui porte `httpOnly: false` depuis le lot 97
// — donc elle restait VERTE même en posant le cookie de langue en `HttpOnly`.
// MESURÉ en injectant exactement ce défaut : sortie 0, aucune croix.
// ⭐⭐⭐ *Un contrôle branché sur le fichier au lieu de la ligne trouve toujours
//   ce qu'il cherche ailleurs.* Le `[\s\S]{0,240}?` borne la fenêtre au bloc.
dit(/cookies\.set\(COOKIE_LANGUE[\s\S]{0,240}?httpOnly:\s*false/.test(entrer),
  'le cookie de langue reste lisible par le navigateur',
  'HttpOnly le rendrait invisible à 55-langue.js, là où il sert le plus');

// ── 2.2 bis 🎨 LOT 217 — LE THÈME : LE CIRCUIT, DANS SES QUATRE MAILLONS ──
// ⭐⭐⭐ POURQUOI QUATRE ET PAS DEUX. La langue et le tableau de bord ont deux
// bouts (écrire / reposer) parce qu'un FORMULAIRE les poste. Le thème est
// posté par du SCRIPT, et le script vit dans un troisième fichier — celui-là
// même qui, pendant onze lots, a porté une règle CSS sans émetteur. Le circuit
// est donc : le bouton POSTE · la route RANGE · `/api/entrer` REPOSE · le
// script anti-scintillement LIT. Manquer un seul maillon donne un réglage
// enregistré, exact, et sans effet — la panne qui se croit une réussite.
const base = sansCommentaires(lire(join(RACINE, 'src/layouts/Base.astro')));
const regl = sansCommentaires(lire(join(RACINE, 'src/pages/api/reglages.js')));

dit(/bloc=theme|append\('bloc',\s*'theme'\)/.test(base),
  '① le bouton de thème POSTE, et il dit quel bloc parle',
  'sans `bloc`, la route lirait ce POST comme un bloc e-mails « case décochée » — donc un DÉSABONNEMENT');
dit(/data-membre/.test(base),
  '① …et seulement pour quelqu’un de connecté',
  'un POST anonyme ferait un aller-retour pour rien, sur le geste le plus fréquent du site');
dit(/bloc === 'theme'/.test(regl) && /poserPref\(compte,\s*CLE_THEME/.test(regl),
  '② la route RANGE le thème sous le compte');
dit(/themeValide\(/.test(regl),
  '② …derrière une liste blanche',
  'cette valeur finit dans un `setAttribute(\'data-theme\', …)`, donc dans le DOM');
dit(/cookies\.set\(COOKIE_THEME[\s\S]{0,240}?httpOnly:\s*false/.test(regl),
  '② et le cookie porteur reste LISIBLE par le navigateur',
  '🔴 même défaut que le cookie de langue : HttpOnly le rendrait invisible au script anti-scintillement');
dit(/lirePref\(compte,\s*CLE_THEME\)/.test(entrer)
    && /cookies\.set\(COOKIE_THEME/.test(entrer),
  '③ /api/entrer REPOSE le thème du compte à la connexion',
  'c’est ce qui le fait suivre sur un appareil neuf');
// ⛔ LE MAILLON QUI MANQUAIT À TOUS LES AUTRES : LE LECTEUR.
//   Une préférence rangée, transportée, et jamais lue est le défaut le plus
//   courant de ce dépôt (`svgPublic`, `LES_PLAGES`, `.socle__fav`, `hist.denied`).
//   ⭐ Et on exige que le cookie soit lu AVANT `localStorage` : l'inverse
//   ferait gagner le choix du NAVIGATEUR sur celui du COMPTE, c'est-à-dire
//   exactement l'inverse de ce que ce lot installe — en restant vert.
const ordreLecture = base.indexOf('vp_theme');
const ordreStockage = base.indexOf("localStorage.getItem('veve-theme')");
dit(ordreLecture !== -1 && ordreStockage !== -1 && ordreLecture < ordreStockage,
  '④ le script anti-scintillement LIT le cookie, et AVANT `localStorage`',
  `cookie@${ordreLecture} doit précéder localStorage@${ordreStockage} — sinon le navigateur gagne sur le compte`);

// ── 2.3 ⛔ ce que ce lot ne doit PAS avoir fait ────────────────────────────
// ⭐ La conception tient à ce que le compte NE SOIT PAS résolu dans le
//   middleware : ce serait un second aller-retour réseau sur chaque page rendue
//   à la demande, dont `/market/` qui est `no-store`. Un « petit ajout »
//   plausible six mois plus tard, et personne ne saurait pourquoi les pages
//   ont ralenti. Ce contrôle est là pour que ça se voie le jour même.
const mw = sansCommentaires(lire(join(RACINE, 'src/middleware.js')));
dit(!/compteDeLaSession/.test(mw),
  '🔑 le middleware ne résout PAS le compte',
  'ce serait +1 requête veveid sur CHAQUE page à la demande, pour un dictionnaire');

// ── 2.4 le magasin n'est pas ouvert au build ──────────────────────────────
// 🔴🔴 CE BLOC LIT DU CODE DÉPOUILLÉ, ET IL A FALLU LE CORRIGER POUR ÇA.
// La première version cherchait `mkdir` dans le fichier BRUT : elle rougissait
// sur le commentaire qui EXPLIQUE pourquoi ce module ne fait pas de `mkdir`.
// ⭐ Neuvième banc faux de la semaine, même cause que les huit autres : *un
//   critère qui juge du code mais cherche une chaîne mord sur les commentaires.*
const src = sansCommentaires(lire(join(RACINE, 'engine/lib/prefs.mjs')));
dit(!/^\s*(const|let)\s+base\s*=\s*new DatabaseSync/m.test(src),
  'la base n’est pas ouverte à l’import',
  'astro build importerait alors /data, qui n’existe pas au build');
dit(/mkdir/.test(src) === false, 'et ce module ne crée aucun dossier',
  'créer /data est le travail du Dockerfile, et d’un seul endroit');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n3. Auto-contrôle — ce banc avait-il quelque chose à inspecter ?');
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Un verdict rendu sur du vide est vert. Si un chemin change, tout le § 2
//   passerait au vert sans avoir rien lu. On nomme donc une ANCRE indépendante
//   de ce que le lot a écrit : une chaîne qui existait AVANT lui.
dit(entrer.length > 500 && compte.length > 500, 'les deux sources ont bien été lues',
  `${entrer.length} et ${compte.length} o après dépouillement`);
dit(/vp_session/.test(entrer), 'l’ancre `vp_session` est bien dans /api/entrer',
  'elle précède ce lot : si elle manque, c’est le CHEMIN qui est faux, pas le code');
dit(/choisirLangue/.test(compte), 'l’ancre `choisirLangue` est bien dans /compte/');
// ⭐⭐ ET L'AUTO-CONTRÔLE DU DÉPOUILLEMENT LUI-MÊME. Si `sansCommentaires()`
//   rendait la chaîne entière (regex cassée), tout le § 2 mordrait de nouveau
//   sur les commentaires et redeviendrait faux — en silence, et en vert.
dit(entrer.length < lire(join(RACINE, 'src/pages/api/entrer.js')).length * 0.75,
  '🔑 le dépouillement des commentaires fonctionne',
  'sinon le § 2 jugerait des phrases explicatives au lieu du code');

console.log(echecs === 0
  ? `\n✅ prefs : tout est vert (le magasin tient, le circuit est fermé)\n`
  : `\n❌ prefs : ${echecs} contrôle(s) en échec\n`);
process.exit(echecs === 0 ? 0 : 1);
