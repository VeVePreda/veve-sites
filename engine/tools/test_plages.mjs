// ⚠️ VeVePreda/veve-sites — engine/tools/test_plages.mjs   (FICHIER NEUF — lot 132)
// ═══════════════════════════════════════════════════════════════════════════
//  LES DURÉES DU GRAPHIQUE — le banc qui aurait vu les trois jours de silence
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 CE QU'IL AURAIT ATTRAPÉ, ET QUE PERSONNE N'A VU PENDANT TROIS JOURS.
// Le lot 104 (07/08) a livré la fonctionnalité « boutons de durée avec cadenas
// selon le palier » en cinq morceaux :
//   ① la GRILLE      — `access.gates.price_history.plages` au manifeste ;
//   ② le CALCUL      — `plages()` dans `engine/lib/access.mjs` ;
//   ③ l'APPEL        — `const LES_PLAGES = plages();` dans `Item.astro` ;
//   ④ le LECTEUR     — `querySelector('[data-plages]')` dans `Cadran.astro` ;
//   ⑤ le STYLE       — `.plages button[data-verrou]` dans le thème.
// Il manquait le sixième : L'ÉMETTEUR. Aucun `<button data-tier>` n'était écrit.
// Résultat, mesuré le 10/08 avant de coder : `LES_PLAGES` calculé et jamais lu
// (`grep` : 1 occurrence, sa définition), `querySelector` rendant `null` sur
// 3 000 fiches, et trois règles CSS qui n'habillaient rien.
//
// ⭐⭐⭐ AUCUN DES CINQ MORCEAUX N'ÉTAIT FAUX. C'est ce qui rend cette panne
// coûteuse : chaque fichier, relu seul, avait raison. Un banc par fichier
// n'aurait rien dit. Il faut un banc qui suit la CHAÎNE — « qui écrit, qui
// lit ? » — et qui refuse qu'un maillon existe sans son voisin.
//
// ⛔ IL N'ACCEPTE PAS « LE SÉLECTEUR EST DANS LE CODE » COMME PREUVE. Il monte
// le HTML RÉELLEMENT SERVI dans un DOM, exécute le script de la page avec un
// faux `fetch`, et regarde ce qui a bougé. Un sélecteur qui ne matche jamais ne
// lève rien : c'est la seule mesure qui distingue « posé » de « branché ».
//
// ⭐⭐ ET IL EXIGE QUE LE VERROU NE SOIT PAS DÉCORATIF — le défaut d'origine
// que le lot 104 nommait lui-même : « le verrou ne dépendait d'aucun palier, il
// était décoratif ». On joue donc DEUX paliers et on exige DEUX résultats
// différents. Un contrôle qui rend la même chose pour un abonné et pour un
// visiteur n'est pas un verrou, c'est un dessin de verrou.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const R = new URL('../..', import.meta.url).pathname;
let echecs = 0, lus = 0;
const verifie = (titre, ok, detail = '') => {
  if (!ok) echecs++;
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre}${detail ? `\n       ${detail}` : ''}`);
};
const indecis = (titre, pourquoi) => console.log(`  ⏸️   ${titre} — INDÉCIDABLE : ${pourquoi}`);
const fin = () => {
  console.log('\n4. auto-contrôle');
  if (lus < 5) { console.log(`  🔴 ce banc n'a inspecté que ${lus} élément(s) : il ne prouve rien.`); process.exit(2); }
  console.log(`  OK   ${lus} élément(s) inspecté(s)`);
  console.log(echecs ? `\n❌ ${echecs} echec(s)` : '\n✅ tout est vert');
  process.exit(echecs ? 1 : 0);
};

console.log(`\n═══ LES DURÉES DU GRAPHIQUE — site « ${process.env.SITE || 'veveprice'} » ═══`);

// ═══════════════════════════════════════════════════════════════════════════
// 1. LA GRILLE DU MANIFESTE — et le site a-t-il seulement un graphe ?
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n1. la grille déclarée au manifeste');
const { plages, porte, PALIERS } = await import('../lib/access.mjs');
const p = porte('price_history');
if (!p.actif) {
  console.log('\n⏸️  sans objet — la porte « price_history » est inactive sur ce site.');
  process.exit(0);
}
const GRILLE = plages();
if (!GRILLE.length) {
  // ⭐ TROIS VERDICTS. Une grille vide est un choix LÉGITIME (`access.mjs` :
  //   « aucun défaut inventé »), pas une panne — et pas un succès non plus.
  indecis('les boutons de durée', 'le manifeste ne déclare aucune plage : rien à émettre, rien à juger');
  fin();
}
lus += GRILLE.length;
verifie('chaque plage nomme un palier connu',
  GRILLE.every((g) => PALIERS.includes(g.tier)),
  GRILLE.map((g) => `${g.cle}=${g.tier}${g.jours === null ? ' (sans borne)' : ` (${g.jours} j)`}`).join(' · '));
// ⛔ UNE GRILLE QUI NE MONTE PAS EST UNE GRILLE QUI NE VEND RIEN. Deux plages au
//    même palier sont légitimes (30 J + 90 J chez Langouste, arbitrage du 07/08
//    — « le + est une conjonction »), mais une plage PLUS LONGUE à un palier
//    PLUS BAS ouvrirait la profondeur par la porte d'à côté.
let monotone = true;
for (let i = 1; i < GRILLE.length; i++) {
  const a = GRILLE[i - 1], b = GRILLE[i];
  if (PALIERS.indexOf(b.tier) < PALIERS.indexOf(a.tier)) monotone = false;
  if (a.jours !== null && b.jours !== null && b.jours < a.jours) monotone = false;
}
verifie('la grille MONTE : jamais une durée plus longue à un palier plus bas',
  monotone, monotone ? 'profondeur et palier vont dans le même sens'
    : '🔴 une plage plus longue s\'ouvre plus bas : la profondeur se prend par la porte d\'à côté');

// ═══════════════════════════════════════════════════════════════════════════
// 2. L'ÉMETTEUR — le HTML RÉELLEMENT SERVI porte-t-il les boutons ?
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2. les boutons sont-ils ÉMIS, sur une vraie fiche ?');
const DIST = existsSync(join(R, 'dist/client')) ? join(R, 'dist/client') : join(R, 'dist');
if (!existsSync(DIST)) { indecis('l\'émission', '`dist/` absent — ce banc va APRÈS `npm run build`'); fin(); }

// La première fiche venue : on ne choisit pas, sinon on mesure notre choix.
const trouverFiche = (dir, prof = 0) => {
  if (prof > 4) return null;
  for (const e of readdirSync(dir)) {
    const c = join(dir, e);
    if (statSync(c).isDirectory()) { const r = trouverFiche(c, prof + 1); if (r) return r; }
    else if (e === 'index.html' && /\/(collectibles|comics)\/[^/]+\/[^/]+\//.test(c.replace(/\\/g, '/'))) {
      const h = readFileSync(c, 'utf8');
      if (h.includes('data-cadran')) return { chemin: c, html: h };
    }
  }
  return null;
};
const fiche = trouverFiche(DIST);
if (!fiche) { indecis('l\'émission', 'aucune fiche portant un cadran dans `dist/`'); fin(); }
console.log(`       fiche lue : ${fiche.chemin.replace(R, '')}`);

// ⚠️⚠️ DÉFAUT D'INSTRUMENT PAYÉ EN ÉCRIVANT CE BANC, ET IL VAUT D'ÊTRE ÉCRIT.
//    Ma première version cherchait `data-jours="([^\"]*)"`. Elle a déclaré
//    « 4 boutons pour 5 plages » sur une page qui en portait bien cinq : Astro
//    sérialise une valeur VIDE en attribut NU — `data-jours`, pas
//    `data-jours=""`. Le cinquième bouton (« Max », `jours: null`) était le seul
//    concerné, c'est-à-dire le plus cher : le dernier palier.
//    ⭐⭐⭐ UN BANC ROUGE POUR UNE MAUVAISE RAISON COÛTE PLUS CHER QU'UN BANC
//    ABSENT — et celui-ci serait devenu rouge en permanence sur un code juste,
//    jusqu'à ce qu'on apprenne à ignorer sa couleur. ⛔ Le remède n'est PAS
//    d'écrire `data-jours="0"` dans le gabarit pour lui plaire : ce serait
//    corriger le code pour l'instrument, et « 0 » raboterait la courbe de Max à
//    rien. On corrige l'INSTRUMENT.
//    ⇒ La forme nue ET la forme longue sont acceptées, et `jours: null` est
//      reconnu à l'ABSENCE de valeur — ce qui est exactement ce que
//      `getAttribute()` rend au navigateur : la chaîne vide.
const boutons = [...fiche.html.matchAll(/<button[^>]*data-cle="([^"]*)"[^>]*>/g)]
  .map((m) => {
    const brut = m[0];
    const tier = (brut.match(/data-tier="([^"]*)"/) || [])[1] || '';
    const j = brut.match(/data-jours(?:="([^"]*)")?/);
    return { cle: (brut.match(/data-cle="([^"]*)"/) || [])[1], tier, jours: j ? (j[1] ?? '') : null };
  });
lus += boutons.length;
verifie('le groupe `[data-plages]` est ÉMIS dans le HTML',
  /data-plages/.test(fiche.html.replace(/<script[\s\S]*?<\/script>/g, '')),
  '⇒ sans lui, `querySelector` rend null et la boucle de déverrouillage tourne dans le vide');
verifie('autant de boutons que de plages déclarées',
  boutons.length === GRILLE.length, `${boutons.length} bouton(s) pour ${GRILLE.length} plage(s)`);
verifie('dans l\'ORDRE du manifeste (« l\'ordre du tableau est l\'ordre affiché »)',
  boutons.map((b) => b.cle).join(',') === GRILLE.map((g) => g.cle).join(','),
  `${boutons.map((b) => b.cle).join(' · ')}`);
verifie('chaque bouton porte le palier de sa plage',
  boutons.every((b, i) => GRILLE[i] && b.tier === GRILLE[i].tier),
  boutons.map((b) => `${b.cle}→${b.tier}`).join(' · '));
// ⛔ `jours: null` = SANS BORNE, et l'attribut doit être VIDE, pas « 0 » ni
//    « null ». Un `0` raboterait la courbe du dernier palier à rien : la panne
//    la plus chère possible, sur le grade le plus cher. « inconnu ≠ zéro ».
verifie('la plage sans borne rend un `data-jours` VIDE, jamais « 0 » ni « null »',
  boutons.every((b, i) => (GRILLE[i] && GRILLE[i].jours === null
    ? b.jours === '' : b.jours === String(GRILLE[i].jours))),
  boutons.map((b) => `${b.cle}=${b.jours === '' ? '(vide)' : b.jours === null ? '(ABSENT)' : b.jours}`).join(' · '));

// ⭐ L'INFOBULLE, demandée nommément par Preda le 10/08 : « n'oublie pas un
//   cadenas et une infobulle disant quel grade débloque quoi ».
const avecTitre = (fiche.html.match(/<button[^>]*data-verrou[^>]*title="[^"]+"/g) || []).length;
verifie('chaque bouton verrouillé porte une infobulle nommant le grade',
  avecTitre >= GRILLE.filter((g) => g.verrouillee).length && avecTitre > 0,
  `${avecTitre} infobulle(s) — ⛔ un cadenas sans nom de grade dit « non » sans dire « à quelle condition »`);

// ═══════════════════════════════════════════════════════════════════════════
// 3. LE LECTEUR — le script fait-il quelque chose, et FAIT-IL LA DIFFÉRENCE ?
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n3. le script déverrouille-t-il, et SEULEMENT ce qu\'il doit ?');
let parseHTML = null;
try { ({ parseHTML } = await import('linkedom')); } catch { /* absent */ }
if (!parseHTML) {
  // ⛔ INDÉCIDABLE, PAS VERT. Sans DOM, « les boutons sont là » est mesuré et
  //    « ils se déverrouillent » ne l'est pas — et c'est justement la moitié
  //    qui distingue un verrou d'un dessin de verrou.
  indecis('l\'exécution du pilote', 'linkedom absent — `npm i -D linkedom`');
  fin();
}

// ⚠️ On extrait le script de `Cadran.astro` DEPUIS LA PAGE SERVIE, pas depuis
//    la source : c'est ce que le navigateur reçoit qui décide. Un post-traitement
//    (i18n, minification) passe entre les deux, et il a déjà avalé un `<head>`
//    entier au lot 129.
const scripts = [...fiche.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).filter((s) => s.includes('data-cadran'));
verifie('le script du cadran voyage bien avec la page', scripts.length === 1,
  `${scripts.length} script(s) portant « data-cadran »`);
if (scripts.length !== 1) fin();
lus++;

const jouer = (palier) => {
  const { document, window } = parseHTML(fiche.html);
  document.documentElement.setAttribute('data-membre', '');
  const pts = [];
  const base = Math.floor(Date.now() / 1000);
  // 400 relevés quotidiens : de quoi qu'une plage « 3 j » et une plage « 90 j »
  // ne rendent PAS la même courbe. Sinon le filtrage serait vert sans filtrer.
  for (let i = 400; i >= 0; i--) pts.push([base - i * 86400, 10 + (i % 7)]);
  const faux = () => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ ok: true, palier, h: { n: pts.length, p: pts } }),
  });
  const fn = new Function('document', 'window', 'fetch', 'console', 'localStorage', scripts[0]);
  try { fn(document, window, faux, { log() {}, warn() {}, error() {} }, undefined); } catch (e) {
    return { erreur: e.message, document };
  }
  return { document };
};

// ⭐ On laisse au `fetch` faux le temps de résoudre : le script est asynchrone.
const attendre = () => new Promise((ok) => setTimeout(ok, 0)).then(() => new Promise((ok) => setImmediate(ok)));

const rMembre = jouer('member');
await attendre(); await attendre(); await attendre();
verifie('le script s\'exécute sans lever', !rMembre.erreur, rMembre.erreur || 'aucune exception');

const ouverts = (doc) => [...doc.querySelectorAll('[data-plages] button[data-tier]')]
  .filter((b) => !b.hasAttribute('data-verrou')).map((b) => b.getAttribute('data-cle'));

const attendusPour = (pal) => GRILLE
  .filter((g) => PALIERS.indexOf(pal) >= PALIERS.indexOf(g.tier)).map((g) => g.cle);

const vusMembre = ouverts(rMembre.document);
verifie('un MEMBRE voit s\'ouvrir exactement ses plages',
  vusMembre.join(',') === attendusPour('member').join(','),
  `ouvertes : ${vusMembre.join(' · ') || '(aucune)'} — attendues : ${attendusPour('member').join(' · ') || '(aucune)'}`);

const rWhale = jouer('whale');
await attendre(); await attendre(); await attendre();
const vusWhale = ouverts(rWhale.document);
verifie('un WHALE en voit s\'ouvrir davantage — le verrou n\'est pas décoratif',
  vusWhale.length > vusMembre.length,
  `membre ${vusMembre.length} · whale ${vusWhale.length} sur ${GRILLE.length}`);
lus += 2;

// ⛔ LA CONTRE-ÉPREUVE, ET C'EST ELLE QUI DONNE SA VALEUR AU RESTE.
//    Sans elle, un script qui déverrouille TOUT passerait les deux lignes
//    au-dessus. « Un banc doit rougir sur CHAQUE panne, pas sur trois sur
//    quatre. »
const rVisiteur = jouer('visitor');
await attendre(); await attendre(); await attendre();
const vusVisiteur = ouverts(rVisiteur.document);
verifie('⛔ un VISITEUR n\'ouvre rien de plus que ce que le manifeste lui donne',
  vusVisiteur.join(',') === attendusPour('visitor').join(','),
  `ouvertes : ${vusVisiteur.join(' · ') || '(aucune)'} — attendues : ${attendusPour('visitor').join(' · ') || '(aucune)'}`);

// ⭐⭐ ET LE FILTRAGE FAIT-IL QUELQUE CHOSE ? Un bouton déverrouillé qui ne
//    change pas la courbe est un bouton mort — la version « on peut cliquer »
//    du sélecteur qui ne matche jamais.
const doc = rWhale.document;
const svgAvant = (doc.querySelector('[data-svg]') || {}).innerHTML || '';
const btn3 = doc.querySelector('[data-plages] button[data-cle="3j"]');
if (!btn3 || !svgAvant) {
  indecis('le filtrage par durée', 'pas de courbe rendue dans le DOM du banc');
} else {
  btn3.click();
  const svgApres = (doc.querySelector('[data-svg]') || {}).innerHTML || '';
  verifie('cliquer une durée REDESSINE la courbe (elle raccourcit)',
    svgApres.length > 0 && svgApres !== svgAvant,
    svgApres === svgAvant ? '🔴 le clic ne change rien : le bouton est un décor'
      : `SVG ${svgAvant.length} o → ${svgApres.length} o sur 3 jours`);
  lus++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 bis. LE STYLE — la règle existe-t-elle, et a-t-elle un émetteur ?
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Le contrat gabarit↔thème, dans les DEUX sens, sur cette fonctionnalité
//   précise : la règle a attendu son émetteur pendant trois jours.
const feuilles = [];
const chercheCss = (dir, prof = 0) => {
  if (prof > 3 || !existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    const c = join(dir, e);
    if (statSync(c).isDirectory()) chercheCss(c, prof + 1);
    else if (e.endsWith('.css')) feuilles.push(readFileSync(c, 'utf8'));
  }
};
chercheCss(join(R, 'themes'));
const css = feuilles.join('\n');
verifie('le thème habille `.plages button[data-verrou]` — et quelqu\'un l\'émet',
  /\.plages\s+button\[data-verrou\]/.test(css) && /data-verrou/.test(fiche.html),
  'règle ET émetteur présents — c\'est la paire, pas l\'un des deux');

fin();
