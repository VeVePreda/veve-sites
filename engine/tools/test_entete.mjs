// ⚠️ VeVePreda/veve-sites — engine/tools/test_entete.mjs   (NEUF — lot 103)
// ═══════════════════════════════════════════════════════════════════════════
// L'EN-TÊTE NE DÉPEND PAS DU MODE DE RENDU — et on le PROUVE
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 LA RÈGLE QUE CE BANC TIENT EST ÉCRITE DEPUIS LE LOT 100, ET ELLE A ÉTÉ
// VIOLÉE PAR LE LOT 100 LUI-MÊME :
//     « UNE PAGE PRÉ-GÉNÉRÉE N'A PAS DE VISITEUR — son en-tête ne doit donc
//       dépendre QUE du cookie, jamais du mode de rendu. »
// Le lot 100 a rendu l'AVATAR inconditionnel (`hidden={!aUneSession}`) et a
// laissé le BOUTON D'INSCRIPTION conditionnel (`{!aUneSession && (…)}`).
// Résultat : deux DOM différents selon que la page est un fichier ou un calcul,
// et un bouton « Inscription » qui apparaît « parfois » — c'est-à-dire au
// moment précis où l'on passe d'un type de page à l'autre. Preda l'a signalé
// deux fois ; il n'était reproductible ni à la demande, ni en local.
//
// ⭐⭐⭐ POURQUOI UN BANC STATIQUE ET PAS UN TEST DE RENDU. Reproduire le défaut
// demande une SESSION SERVEUR — donc `SESSION_API`, donc le réseau, donc
// exactement ce qu'aucun banc de ce dépôt n'a le droit de faire. La faute, en
// revanche, est parfaitement lisible dans la source : un élément qui porte
// `data-anonyme` ou `data-membre` DÉCLARE que son affichage est décidé par le
// cookie. S'il est en plus enveloppé dans une condition sur la session, il se
// contredit lui-même. On teste la CONTRADICTION, pas le symptôme.
//
// ⛔ CE BANC NE LIT QUE `Base.astro`. C'est volontaire : l'en-tête n'a qu'un
// seul émetteur, et un banc qui ratisserait tout `src/` attraperait des
// `!aUneSession` parfaitement légitimes ailleurs (une page de compte a le droit
// de se construire différemment — elle n'est jamais pré-générée).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const R = new URL('../..', import.meta.url).pathname;
const BASE = join(R, 'src/layouts/Base.astro');
// 🔴 LOT 104 — UN SECOND EMETTEUR ENTRE DANS LA REGLE.
// Ce banc ne lisait que `Base.astro`, et c'etait juste tant que l'en-tete etait
// le seul endroit ou un element dependait du cookie. L'accueil en a un depuis
// l'arbitrage du 07/08 : `.hero[data-anonyme]` et `.tableau-bord[data-membre]`
// s'echangent selon le cookie. ⭐⭐⭐ UNE REGLE QUI GAGNE UN EMETTEUR SANS QUE
// SON BANC LE SUIVE CESSE D'ETRE TENUE LA OU ELLE VIENT D'ARRIVER — et c'est
// precisement la ou personne ne l'a encore relue. Le lot 100 a paye ca : la
// regle etait ecrite, appliquee a un element sur trois, donc un defaut
// « parfois », donc irreproductible malgre deux signalements.
// ⛔ On n'elargit PAS a tout `src/` : une page de compte a le droit de se
// construire differemment, elle n'est jamais pre-generee. On nomme les
// fichiers qui portent la contrainte, et on exige qu'ils existent.
const HOME = join(R, 'src/components/pages/Home.astro');

let ko = 0;
const dit = (bon, quoi, detail) => {
  if (!bon) ko++;
  console.log(`  ${bon ? 'ok ' : 'KO '} ${quoi}${detail ? ` — ${detail}` : ''}`);
};

console.log('\n═══ LOT 103 — l\'en-tête ne se construit pas différemment selon le mode ═══');

if (!existsSync(BASE)) {
  console.error(`\n❌ ${BASE} introuvable — ce banc ne peut rien prouver.`);
  process.exit(2);
}
const src = readFileSync(BASE, 'utf8');
if (!existsSync(HOME)) {
  console.error(`\n❌ ${HOME} introuvable — ce banc ne peut plus rien prouver sur l'accueil.`);
  process.exit(2);
}
const home = readFileSync(HOME, 'utf8');

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 ON DÉCOMMENTE AVANT DE CHERCHER — QUATRIÈME FOIS DANS CE DÉPÔT
// ═══════════════════════════════════════════════════════════════════════════
// Après un `grep` de cron le 07/08, le §5 de `test:projection`, et le §3 de ce
// banc même au lot 123 : le lot 134 l'a repayé À L'ÉCRITURE. Le contrôle neuf
// (« la coquille n'est revenue dans aucun de ses 3 émetteurs ») rougissait sur
// les COMMENTAIRES qui expliquent son retrait — c'est-à-dire sur le code le
// mieux documenté du lot, et pour la raison exacte qui le rend correct.
// ⛔ LA RÉPARATION N'EST PAS DE REFORMULER LE COMMENTAIRE POUR LUI PLAIRE. Un
// gabarit qui n'ose plus nommer ce qu'il a retiré est un gabarit qu'on relira
// mal, et le prochain lot remettra le bloc en croyant l'inventer.
// ⭐⭐ LE DÉCOMMENTEUR EST ÉCRIT UNE FOIS ET PARTAGÉ. Le §3 en avait déjà un,
// local, et le §1 neuf en aurait fabriqué un second : deux copies d'une même
// règle divergent — ce dépôt l'a payé trois fois sur des gabarits (`data-ch`,
// les cartes de set, le corps de `AVenir`). *Le tag est une variable, le corps
// s'écrit une fois* vaut aussi pour un banc.
// ⚠️ ON REMPLACE PAR DES ESPACES DE MÊME LONGUEUR, on ne supprime pas : le §3
// compare des POSITIONS. Retirer les commentaires décalerait tout ce qui suit,
// et le banc mesurerait alors un ordre qui n'existe que dans sa copie.
const blanc = (m) => ' '.repeat(m.length);
const nuAstro = (txt) => txt
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, blanc)
  .replace(/^\s*\/\/.*$/gm, blanc);
// ⚠️ Le CSS n'a QUE les commentaires `/* … */` : `//` y est une valeur légale
// (une URL de protocole relatif). Un décommenteur unique pour les deux langages
// mangerait `url(//cdn…)`. Deux fonctions, parce que ce sont deux grammaires.
const nuCss = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, blanc);
const homeNu = nuAstro(home);
const srcNu = nuAstro(src);

// ⭐ ET L'INSTRUMENT SE PROUVE AVANT DE SERVIR. Un décommenteur qui ne
// décommenterait rien laisserait tout ce qui suit vert pour la mauvaise
// raison — c'est « est-ce là ? » contre « est-ce que ça marche ? », le défaut
// d'instrument ② du lot 133. On monte un témoin et on lit ce qu'il rend.
const TEMOIN_NU = '{/* class="tableau-bord" */}\n<div class="hero"></div>\n// .tableau-bord[x]\n';
if (/tableau-bord/.test(nuAstro(TEMOIN_NU)) || !/class="hero"/.test(nuAstro(TEMOIN_NU))) {
  console.error('\n❌ le décommenteur ne fait pas ce qu\'il dit — tout ce qui suit serait vert à tort.');
  process.exit(2);
}

// ⭐ LES THÈMES SE LISENT TOUS, ET LEUR NOMBRE EST DIT. Un contrôle « la règle
// n'est revenue dans aucun thème » serait vert sur zéro thème lu — « aucune
// faute » et « rien à juger » se ressemblent exactement dans un compteur à
// zéro. On sort en rc=2 si la liste est vide plutôt que d'annoncer un vert.
const DOSSIER_THEMES = join(R, 'themes');
const themesLus = existsSync(DOSSIER_THEMES)
  ? readdirSync(DOSSIER_THEMES)
      .filter((d) => existsSync(join(DOSSIER_THEMES, d, 'theme.css')))
      .map((d) => ({ nom: d, css: readFileSync(join(DOSSIER_THEMES, d, 'theme.css'), 'utf8') }))
  : [];
if (themesLus.length === 0) {
  console.error(`\n❌ aucun thème lu sous ${DOSSIER_THEMES} — racine invalide, ce banc ne prouve rien.`);
  process.exit(2);
}

// ── 0. L'INSTRUMENT AVANT LA MESURE ───────────────────────────────────────
// ⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » Si les marqueurs
// disparaissaient du gabarit — renommés, retirés — tout ce qui suit serait vert
// sur un en-tête devenu quelconque.
const marqueurs = (src.match(/data-(anonyme|membre)\b/g) || []).length;
dit(marqueurs >= 3, `${marqueurs} marqueur(s) data-anonyme / data-membre dans l'en-tête`,
  marqueurs >= 3 ? null : 'TROP PEU — les marqueurs ont disparu, ce banc ne garde plus rien');
dit(/aUneSession/.test(src), 'le gabarit connaît bien `aUneSession`',
  'sinon ce banc chercherait une chaîne qui n\'existe plus');

// ── 1. AUCUN ÉLÉMENT MARQUÉ N'EST CONDITIONNÉ PAR LA SESSION ──────────────
// ⭐ On découpe le fichier en expressions `{ … && ( … )}` et on regarde, pour
// chacune, si sa CONDITION parle de la session ET si son CORPS porte un
// marqueur. La condition peut légitimement tester `comptesOuverts` (le site
// vend-il des comptes ?) — c'est une question de manifeste, identique pour
// tous les visiteurs et connue au build. `aUneSession`, non : elle est vide sur
// une page pré-générée et pleine sur une route dynamique.
const fautes = [];
for (const [nom, texte] of [['Base.astro', srcNu], ['Home.astro', homeNu]]) {
  const re = /\{([^{}]*?)&&\s*\(/g;
  let m;
  while ((m = re.exec(texte)) !== null) {
    const condition = m[1];
    if (!/aUneSession|locals|palierVisiteur|connecte\(/.test(condition)) continue;
    // le corps : jusqu'à la fermeture `)}` la plus proche qui referme l'expression
    const corps = texte.slice(m.index, texte.indexOf(')}', m.index) + 2);
    const marque = corps.match(/data-(anonyme|membre)\b/);
    if (marque) {
      fautes.push(`${nom} : condition « ${condition.trim().slice(0, 60)} » enveloppe un élément data-${marque[1]}`);
    }
  }
}

// 🔴 LOT 104 — L'ACCUEIL PORTE BIEN SES DEUX BLOCS, ET ILS SONT INCONDITIONNELS.
// ⭐⭐ Sans ce contrôle, le contrôle ci-dessus resterait vert si les marqueurs
// DISPARAISSAIENT de l'accueil : « aucune faute » et « rien à juger » se
// ressemblent exactement dans un compteur à zéro. Un banc sort sur une
// DÉCLARATION — ici : ces deux blocs doivent exister.
// 🔴🔴 LOT 134 — CE CONTRÔLE EXIGEAIT UN BLOC QUI ÉTAIT DEVENU UN DÉFAUT.
// Il réclamait `.tableau-bord[data-membre]` dans l'accueil ET la règle qui
// l'ouvre dans le `<head>`. Les deux étaient justes au lot 104. Au lot 126, le
// tableau de bord a reçu sa propre adresse ; au lot 131, ses vrais modules. Ce
// bloc n'était donc plus qu'un SECOND `<h1>` (« My dashboard ») lu par Google
// à la place de la promesse commerciale, sous un texte devenu faux.
// ⭐⭐⭐ ET CE BANC LE PROTÉGEAIT. *Un banc qui RÉCLAME un élément garantit
// aussi sa survie : le jour où l'élément devient faux, l'instrument passe du
// côté du défaut, et il faut le corriger AVANT le code.* C'est le pendant
// exact de « corriger l'instrument, jamais le code pour lui plaire » — ici,
// c'est l'instrument qui avait tort, et le retirer sans le dire aurait rendu
// la chaîne verte sur un accueil devenu quelconque.
// ⛔ ON NE SUPPRIME PAS LE CONTRÔLE, ON LE RETOURNE. La règle du lot 100 vit
// toujours (« une page pré-générée n'a pas de visiteur ») et elle a encore un
// porteur sur l'accueil : `.hero[data-anonyme]`. On exige donc celui-là — et
// on exige EN PLUS que l'autre ne revienne pas, ni dans le gabarit, ni dans la
// règle en ligne, ni dans le thème. Un circuit fermé dans les deux sens.
const heroAnon = /<div class="hero" data-anonyme>/.test(home);
dit(heroAnon,
  'l\'accueil déclare toujours son accroche conditionnée par le cookie (hero[data-anonyme])',
  heroAnon ? null : 'hero[data-anonyme] ABSENT — plus rien ne porte la règle du lot 100 sur cette page');

// ── LE RETOUR DE LA COQUILLE, DANS SES TROIS ÉMETTEURS ────────────────────
// ⭐⭐ TROIS FICHIERS, PAS UN. Le bloc HTML, la règle en ligne de `Base.astro`
// et les deux règles de `themes/*/theme.css` sont partis ENSEMBLE au lot 134.
// N'en surveiller qu'un laisserait les autres revenir en « règle sans
// émetteur » — le silence que ce dépôt paie le plus souvent, parce qu'il ne
// lève rien, ne casse rien et se relit comme une intention encore vivante.
const revenus = [];
if (/class="tableau-bord"/.test(homeNu)) revenus.push('Home.astro : le bloc HTML');
if (/\.tableau-bord\[data-membre\]/.test(srcNu)) revenus.push('Base.astro : la règle en ligne');
for (const th of themesLus) {
  if (/^\s*\.tableau-bord[\s{.]/m.test(nuCss(th.css))) revenus.push(`themes/${th.nom}/theme.css`);
}
dit(revenus.length === 0,
  `la coquille du tableau de bord n'est revenue dans aucun de ses 3 émetteurs`
  + ` (${themesLus.length} thème(s) relu(s) : ${themesLus.map((t) => t.nom).join(', ')})`,
  revenus.length === 0 ? null : revenus.join(' · '));
if (revenus.length) {
  console.log('     ⭐ Ce bloc a coûté un second <h1> sur la page la plus vue du site pendant');
  console.log('        huit lots, et un texte faux lu par Google seul. Le tableau de bord a');
  console.log('        son adresse depuis le lot 126 : `/dashboard/`.');
  console.log('     ➡️  S\'il doit revenir sur l\'accueil, il revient en <h2>, et `test:titres`');
  console.log('        doit rester vert — c\'est lui qui tient « un seul <h1> par page ».');
}
dit(fautes.length === 0,
  'aucun élément décidé par le cookie n\'est conditionné par la session',
  fautes.length === 0 ? null : fautes.join(' · '));
if (fautes.length) {
  console.log('     ⭐ Un élément qui porte `data-anonyme` / `data-membre` DÉCLARE que son');
  console.log('        affichage se décide dans le <head>, par le cookie. L\'envelopper en plus');
  console.log('        dans un test de session le fait DISPARAÎTRE du DOM sur les routes');
  console.log('        dynamiques et RESTER sur les 8 500 pages pré-générées : deux en-têtes');
  console.log('        différents, donc un clignotement au passage de l\'un à l\'autre.');
  console.log('     ➡️  Le rendre inconditionnel et porter l\'état par `hidden={…}`.');
}

// ── 2. LES RÈGLES DU <head> EXISTENT ET SONT EN LIGNE ─────────────────────
// ⛔ Une règle posée dans `theme.css` arriverait avec la feuille externe, donc
// parfois après la première peinture — et le clignotement reviendrait « de
// temps en temps », ce qui est pire qu'à chaque fois : on cesse de savoir le
// reproduire.
const styleEnLigne = /<style is:inline>[\s\S]*?html\[data-membre\][\s\S]*?<\/style>/.test(src);
dit(styleEnLigne, 'les règles anti-clignotement sont EN LIGNE dans le gabarit',
  'une feuille externe arrive parfois après la première peinture');
dit(/document\.documentElement\.setAttribute\('data-membre'/.test(src),
  'un script du <head> pose data-membre sur <html>',
  'sans lui, aucune règle ne peut s\'appliquer avant la peinture');

// ── 3. LE MARQUEUR EST POSÉ AVANT D'ÊTRE UTILISÉ ──────────────────────────
// ⭐ L'ordre compte : le script doit précéder la feuille de style qui s'en
// sert. L'inverse marche aussi en pratique (le CSS est réévalué), mais on ne
// s'appuie pas sur une réévaluation dont la performance dépend du navigateur.
// 🔴🔴 LOT 123 — ON DÉCOMMENTE AVANT DE CHERCHER, ET C'EST LA TROISIÈME FOIS
// QUE CE DÉPÔT LE PAIE (après un `grep` de cron le 07/08 et le §5 de
// `test:projection`). Ce banc cherchait `html[data-membre]` dans le fichier
// BRUT : un commentaire du frontmatter qui CITE la règle pour l'expliquer
// arrivait avant le script, et le banc concluait que l'ordre était inversé.
// ⭐⭐⭐ *Un contrôle qui lit les commentaires rougit sur les explications de
// ce qu'il vérifie — c'est-à-dire précisément sur le code le mieux documenté.*
// ⛔ LA RÉPARATION N'ÉTAIT PAS DE REFORMULER MON COMMENTAIRE POUR LUI PLAIRE :
//    on corrige l'INSTRUMENT, jamais le code pour lui plaire. Un gabarit qui
//    n'ose plus nommer la règle qu'il applique est un gabarit qu'on relira mal.
// ⭐ LOT 134 — CE §3 AVAIT SON PROPRE DÉCOMMENTEUR, RECOPIÉ. Il est remonté en
// tête du fichier (`nuAstro`) et sert maintenant les deux contrôles.
const nu = srcNu;
// ⚠️ ON REMPLACE PAR DES ESPACES DE MÊME LONGUEUR, on ne supprime pas : ce
//    contrôle compare des POSITIONS. Retirer les commentaires décalerait tout
//    ce qui suit, et le banc mesurerait alors un ordre qui n'existe que dans
//    sa copie. *Quand on juge une position, on ne change pas la longueur.*
const iScript = nu.indexOf("setAttribute('data-membre'");
const iStyle = nu.indexOf('html[data-membre]');
dit(iScript > 0 && iStyle > iScript, 'le script précède les règles qui lisent son attribut',
  iScript > 0 && iStyle > iScript ? null : `script à ${iScript}, règles à ${iStyle}`);

// ═══════════════════════════════════════════════════════════════════════════
// 5. LA CHAÎNE DU SÉLECTEUR DE LANGUE D'INTERFACE — LOT 139
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE § SUIT UNE CHAÎNE, PAS UN FICHIER, ET C'EST DÉLIBÉRÉ. Un bouton de
// langue qui marche demande SIX morceaux d'accord, dans cinq fichiers :
//     ① le manifeste dit `identity.langue_interface_dans: entete`
//     ② `i18n.mjs` en fait UN prédicat, `langueUiDansEntete()`
//     ③ `Base.astro` l'appelle pour ÉMETTRE `<details id="langue-ui">`
//     ④ `socle_js.mjs` l'appelle pour EMBARQUER `55-langue.js`
//     ⑤ `55-langue.js` cherche `langue-ui` et écrit `vp_langue`
//     ⑥ le thème habille `.globe__m button` (le menu n'habillait que des `<a>`)
// ⭐⭐⭐ CINQ SUR SIX, ET LE BOUTON EST LÀ, VISIBLE, ET NE FAIT RIEN. Aucune
// erreur, aucun rouge : le script sort sur son garde (`if (!boite) return`) ou
// le bouton s'affiche sans script. Les deux pannes se déploient en VERT.
// C'est « la chaîne à cinq morceaux », et c'est pour ça qu'on ne teste pas
// « le fichier existe » mais « les six se désignent l'un l'autre ».
//
// ⛔ QUATRE VERDICTS, DONT « SANS OBJET ». vevewiki ne pose pas la clé — il a
// cinq vraies adresses et garde sa `.langbar`. Le déclarer en échec serait un
// faux rouge ; le déclarer conforme serait un vert qui n'a rien mesuré. On dit
// « sans objet », et on l'imprime.
console.log('\n── 5. la chaîne du sélecteur de langue d\'interface ──');
{
  const { manifest } = await import('../lib/manifest.mjs');
  const { langueUiDansEntete, languesInterface, COOKIE_LANGUE } = await import('../lib/i18n.mjs');
  const reglage = manifest().identity?.langue_interface_dans || 'compte';
  const actif = langueUiDansEntete();
  console.log(`     identity.langue_interface_dans = « ${reglage} »`
    + `  ·  languages.interface = [${languesInterface().join(', ')}]`);

  const socleBrut = readFileSync(join(R, 'engine/lib/socle_js.mjs'), 'utf8');
  const pilote = join(R, 'src/socle/55-langue.js');
  const pilotePresent = existsSync(pilote);
  // 🔴🔴 LE PILOTE SE LIT **DÉCOMMENTÉ**, ET CE BANC VIENT DE REPAYER SA
  // PROPRE LEÇON. À sa première exécution, le contrôle « le pilote ne traduit
  // pas lui-même » a rougi — sur la PHRASE « tout ce qui est marqué
  // `data-i18n` suit », écrite dans l'en-tête du pilote pour expliquer
  // pourquoi il ne traduit justement pas. ⭐⭐⭐ *Un banc qui lit le texte brut
  // rougit sur le code le MIEUX documenté*, et c'est déjà écrit trente lignes
  // plus bas dans ce fichier, pour un autre contrôle, au lot 134.
  // ⛔ La réparation n'est pas de reformuler le commentaire pour lui plaire :
  // un fichier qui n'ose plus nommer la règle qu'il applique se relit mal.
  // ⚠️ On remplace par des espaces de MÊME LONGUEUR, comme `nuAstro` : rien
  // ici ne juge une position aujourd'hui, mais deux décommenteurs du même
  // dépôt qui se comportent différemment sont un piège pour le prochain.
  // 🔴🔴🔴 ET LE DÉCOMMENTEUR LUI-MÊME A EU UN TROISIÈME DÉFAUT, LE PIRE DES
  // TROIS : écrit en deux expressions régulières, il a AVALÉ 40 LIGNES DE CODE
  // VIVANT. `socle_js.mjs` contient `import.meta.glob('../../src/socle/*.js')`
  // — et `/*` dans une CHAÎNE ouvre un commentaire pour une regexp, qui l'a
  // refermé au premier `*/` venu, une quarantaine de lignes plus bas. La
  // déclaration `'55-langue.js'` de `ORDRE` disparaissait donc du texte lu, et
  // le banc annonçait « posé sur le disque, servi nulle part » sur une chaîne
  // parfaitement câblée.
  // ⭐⭐⭐ *Un instrument qui rougit à tort est plus cher qu'un instrument
  // muet* : j'ai failli aller « corriger » `socle_js.mjs`, c'est-à-dire casser
  // du code juste pour faire taire un banc faux. Seule la lecture du texte
  // décommenté l'a dit.
  // ⇒ un vrai balayage caractère par caractère, qui connaît les trois états
  // d'un fichier JavaScript : dans une chaîne, dans un commentaire, ailleurs.
  // ⛔ Il ne gère pas les expressions régulières littérales (`/.../`) — ce
  // dépôt n'en écrit aucune dans les fichiers que ce § lit, et il vaut mieux
  // une limite ÉCRITE qu'une regexp qui prétend tout comprendre.
  const nuJs = (t) => {
    let out = '', i = 0, etat = 'code', quote = '';
    while (i < t.length) {
      const c = t[i], d = t[i + 1];
      if (etat === 'code') {
        if (c === '"' || c === "'" || c === '`') { etat = 'chaine'; quote = c; out += c; i++; continue; }
        if (c === '/' && d === '*') { etat = 'bloc'; out += '  '; i += 2; continue; }
        if (c === '/' && d === '/') { etat = 'ligne'; out += '  '; i += 2; continue; }
        out += c; i++; continue;
      }
      if (etat === 'chaine') {
        if (c === '\\') { out += '  '; i += 2; continue; }
        if (c === quote) etat = 'code';
        out += c; i++; continue;
      }
      if (etat === 'bloc') {
        if (c === '*' && d === '/') { etat = 'code'; out += '  '; i += 2; continue; }
        out += (c === '\n' ? '\n' : ' '); i++; continue;
      }
      // ligne
      if (c === '\n') { etat = 'code'; out += '\n'; i++; continue; }
      out += ' '; i++;
    }
    return out;
  };  const piloteSrc = pilotePresent ? nuJs(readFileSync(pilote, 'utf8')) : '';
  // 🔴🔴 ET LA MÊME FAUTE, UN FICHIER PLUS LOIN, DANS LE MÊME §. Le contrôle
  // « socle_js importe le prédicat » a rougi juste après, sur le commentaire
  // que je venais d'écrire DANS `socle_js.mjs` : « ⛔ ne pas recopier ici
  // `manifest().identity.langue_interface_dans === 'entete'` ». La phrase qui
  // INTERDIT la recopie se lisait comme la recopie.
  // ⭐⭐⭐ *Deux occurrences du même défaut d'instrument dans un seul § que je
  // venais d'écrire, et la leçon était déjà notée trente lignes plus haut.*
  // C'est « une leçon apprise sur un cas et jamais généralisée produit le cas
  // suivant », à l'échelle d'un quart d'heure. ⇒ TOUT texte source lu par ce §
  // passe par `nuJs`, sans exception à retenir.
  const socleSrc = nuJs(socleBrut);
  // ⭐ ET L'INSTRUMENT SE PROUVE AVANT DE SERVIR — même dispositif qu'en tête
  // de fichier. Un décommenteur qui ne décommenterait rien rendrait le
  // contrôle ci-dessous vert pour la mauvaise raison.
  // ⚠️ LE TÉMOIN PORTE LES TROIS PIÈGES QUI M'ONT EU, dans l'ordre où ils
  // sont arrivés : un `data-i18n` en commentaire de ligne, un en commentaire
  // de bloc, un `//` dans une URL, et surtout **un `/*` dans une chaîne suivi
  // de code vivant** — celui-là seul aurait suffi à tout expliquer.
  const TEMOIN_JS = '// data-i18n en ligne\nvar g = \'src/socle/*.js\';\nconst GARDE = 1;\n'
    + 'var x = 1; /* data-i18n en bloc */\nvar url = "http://a";\n';
  const TN = nuJs(TEMOIN_JS);
  if (/data-i18n/.test(TN) || !/var x = 1;/.test(TN) || !/http:/.test(TN) || !/const GARDE = 1;/.test(TN)) {
    console.error('\n❌ le décommenteur JS ne fait pas ce qu\'il dit — le §5 serait vert à tort.');
    process.exit(2);
  }

  // ── ② et ④ : LE PRÉDICAT EST IMPORTÉ DES DEUX CÔTÉS, JAMAIS RECOPIÉ.
  // 🔴 C'est la panne P30 de ce même lot, mot pour mot : un prédicat recopié
  //    dans le banc avait fait accuser un gabarit innocent. Ici, une recopie
  //    ferait servir un bouton sans script le jour où les deux divergent.
  // ⚠️ LE DÉTAIL NE S'IMPRIME QU'EN CAS D'ÉCHEC. Premier jet : il sortait
  // toujours, donc un « ok » traînait derrière lui une explication d'échec en
  // rouge. ⭐ *Une explication d'échec posée à côté d'un ✅ apprend à ne plus
  // lire les détails* — la règle est déjà écrite dans `test:affichage` §3 bis,
  // et je viens de la casser dans le fichier d'à côté.
  const importeLePredicat = /langueUiDansEntete/.test(socleSrc) && !/langue_interface_dans/.test(socleSrc);
  dit(importeLePredicat,
    '`socle_js.mjs` IMPORTE le prédicat (il ne le recopie pas)',
    importeLePredicat ? null
      : (/langue_interface_dans/.test(socleSrc)
          ? '🔴 il lit le manifeste EN DIRECT — deux définitions d\'un seul état'
          : '🔴 introuvable'));
  dit(/langueUiDansEntete/.test(src),
    '`Base.astro` IMPORTE le même prédicat',
    /langueUiDansEntete/.test(src) ? null : '🔴 introuvable — l\'émission et l\'embarquement peuvent diverger');

  // ── ④ : DÉCLARÉ DANS `ORDRE`, SINON LE FICHIER NE SERAIT JAMAIS SERVI.
  // ⭐ `socle_js.mjs` lève déjà si `src/socle/` et `ORDRE` divergent ; on le
  //    redit ici parce que ce banc RÉCLAME, alors que le jet CONSTATE. Les deux
  //    ne se déclenchent pas au même moment : le jet arrive au build, ce banc
  //    au moment où quelqu'un relit la chaîne.
  dit(pilotePresent, '`src/socle/55-langue.js` existe',
    pilotePresent ? null : '🔴 le prédicat, le bouton et le thème sans le pilote');
  // 🔴🔴 CE CONTRÔLE CONFONDAIT `ORDRE` ET `CONDITIONS`, ET LA CONTRE-ÉPREUVE
  // L'A DIT. J'ai retiré `'55-langue.js'` d'`ORDRE` pour vérifier qu'il
  // rougissait : il est resté VERT. Le nom vit dans DEUX tableaux de ce
  // fichier — `ORDRE`, qui décide de ce qui est SERVI, et `CONDITIONS`, qui
  // décide de QUAND. Une recherche du nom dans le texte entier trouvait
  // toujours le second.
  // ⭐⭐⭐ Ce n'est pas un détail de regexp : un fichier retiré d'`ORDRE` mais
  // laissé dans `CONDITIONS` n'est **jamais servi**, et c'est exactement le
  // circuit ouvert que ce contrôle existe pour attraper — le seul état où il
  // devait parler est celui où il se taisait. *Un banc se juge sur ce qu'il
  // LAISSE PASSER.*
  // ⇒ on borne la recherche au tableau `ORDRE`, et on dit ce qu'on lit.
  const blocOrdre = (socleSrc.match(/const\s+ORDRE\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1];
  dit(blocOrdre.length > 0, 'le tableau `ORDRE` est lisible dans `socle_js.mjs`',
    blocOrdre.length ? null : '🔴 introuvable — ce contrôle ne mesurerait rien');
  dit(/'55-langue\.js'/.test(blocOrdre), '`55-langue.js` est déclaré dans `ORDRE` (pas seulement dans `CONDITIONS`)',
    /'55-langue\.js'/.test(blocOrdre) ? null
      : '🔴 posé sur le disque, conditionné peut-être, mais SERVI nulle part — circuit ouvert');

  // ── ⑤ : LE PILOTE DÉSIGNE LE MÊME NŒUD ET LE MÊME COOKIE.
  dit(!pilotePresent || /getElementById\('langue-ui'\)/.test(piloteSrc),
    'le pilote cherche bien `#langue-ui`', null);
  dit(!pilotePresent || new RegExp(`${COOKIE_LANGUE}=`).test(piloteSrc),
    `le pilote écrit bien le cookie \`${COOKIE_LANGUE}\` (celui que lit 50-i18n.js)`,
    (!pilotePresent || new RegExp(`${COOKIE_LANGUE}=`).test(piloteSrc)) ? null
      : '🔴 un autre nom de cookie : le choix serait posé et jamais relu');
  // ⛔ LE PILOTE NE DOIT PAS TRADUIRE. `50-i18n.js` le fait déjà, avec cinq
  //    gardes durement acquis. Un second traducteur serait la définition la
  //    plus permissive, et c'est elle qui gagnerait.
  dit(!pilotePresent || !/data-i18n/.test(piloteSrc),
    'le pilote NE traduit PAS lui-même (un seul traducteur : 50-i18n.js)',
    (!pilotePresent || !/data-i18n/.test(piloteSrc)) ? null
      : '🔴 seconde définition de l\'échange des libellés');

  // ── ⑥ : LE THÈME HABILLE LE `<button>`, PAS SEULEMENT LE `<a>`.
  // ⭐ Sur TOUS les thèmes qui habillent déjà `.globe__m` : celui qui en habille
  //    un et pas l'autre a un menu à moitié peint, et ça ne se voit qu'à
  //    l'écran. On ne nomme aucun thème — on lit le dossier.
  for (const th of themesLus) {
    if (!/\.globe__m\s+a/.test(th.css)) continue;
    dit(/\.globe__m\s+button/.test(th.css),
      `thème « ${th.nom} » : \`.globe__m button\` est habillé`,
      /\.globe__m\s+button/.test(th.css) ? null
        : '🔴 il habille `.globe__m a` seulement — les langues sortiraient en police système, centrées');
  }

  // ── ③ et ⑥ SUR LE RÉSULTAT : ce que la page SERVIE contient vraiment.
  // ⚠️ Ce § tourne APRÈS `npm run build` (Dockerfile l. 328) : `dist/` existe.
  const racine = ['dist/client', 'dist'].map((x) => join(R, x)).find((x) => existsSync(x));
  let pageLue = null;
  if (racine) {
    const pile = [racine];
    while (pile.length && !pageLue) {
      const d = pile.pop();
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const f = join(d, e.name);
        if (e.isDirectory()) pile.push(f);
        else if (e.name.endsWith('.html') && !e.name.startsWith('404')) { pageLue = f; break; }
      }
    }
  }
  if (!pageLue) {
    console.log('  ⏸️  INDÉCIDABLE sur l\'ÉMISSION — pas de `dist/`. La chaîne de SOURCE'
      + ' est jugée, le résultat non. Périmètre réduit, pas un succès.');
  } else {
    console.log(`     📄 page ouverte : ${pageLue.slice(R.length)}`);
    const h = readFileSync(pageLue, 'utf8');
    const emis = /id="langue-ui"/.test(h);
    if (!actif) {
      // ⭐ SANS OBJET — et le contraire serait un vrai défaut : un bouton émis
      //   alors que le manifeste ne le demande pas.
      console.log(`  ⏭️  SANS OBJET — ce site est sur « ${reglage} » : aucun sélecteur d'interface attendu.`);
      dit(!emis, 'et il n\'en émet effectivement aucun',
        emis ? '🔴 émis alors que le manifeste ne le demande pas' : null);
    } else {
      dit(emis, 'la page servie émet `<details id="langue-ui">`',
        emis ? null : '🔴 le manifeste le demande, la page ne le porte pas');
      // ⭐⭐ AUTANT DE BOUTONS QUE DE LANGUES D'INTERFACE — et c'est LE
      //    contrôle qui aurait attrapé la faute de conception d'origine. Un
      //    sélecteur branché sur `alternates` en aurait sorti UN SEUL (une
      //    adresse), et un bouton à un seul choix a l'air de marcher.
      const bloc139 = (h.match(/<details[^>]*id="langue-ui"[\s\S]*?<\/details>/) || [''])[0];
      const nb = (bloc139.match(/data-lang="/g) || []).length;
      dit(nb === languesInterface().length,
        `${nb} choix de langue émis — autant que \`languages.interface\` (${languesInterface().length})`,
        nb === languesInterface().length ? null
          : `🔴 ${nb} contre ${languesInterface().length} : un sélecteur à ${nb} choix `
            + '— c\'est le symptôme d\'un branchement sur `alternates` (les ADRESSES) au lieu de `interface`');
      // ⭐ AUCUN `aria-current` AU BUILD : le fichier est le même pour les
      //   quatre langues, il ne peut pas savoir laquelle est courante.
      dit(!/data-lang="[a-z]{2}"[^>]*aria-current/.test(bloc139),
        'aucun `aria-current` écrit au build (le fichier ne connaît pas le visiteur)',
        /aria-current/.test(bloc139) ? '🔴 état figé au build : faux pour qui a déjà choisi' : null);
      // ⑤ le script est-il RÉELLEMENT dans le socle servi ?
      const socles = [];
      const pile2 = [racine];
      while (pile2.length) {
        const d = pile2.pop();
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const f = join(d, e.name);
          if (e.isDirectory()) pile2.push(f);
          else if (/^socle-[0-9a-f]+\.js$/.test(e.name)) socles.push(f);
        }
      }
      const demande = (h.match(/src="(\/socle-[0-9a-f]+\.js)"/) || [, ''])[1];
      const servi = socles.find((f) => f.endsWith(demande.slice(1)));
      dit(Boolean(servi) && /langue-ui/.test(readFileSync(servi, 'utf8')),
        'le socle QUE CETTE PAGE DEMANDE contient le pilote',
        (servi && /langue-ui/.test(readFileSync(servi, 'utf8'))) ? null
          : `🔴 ${demande || '(aucun socle demandé)'} — un bouton sans script, visible et inerte`);
    }
  }

  // ── LA CONTRE-ÉPREUVE. Tout est vert ci-dessus ; sans elle, ce vert ne
  //    prouve rien. Aucun cas n'ouvre de fichier.
  const CAS = [
    ['① le prédicat RECOPIÉ dans socle_js au lieu d\'être importé',
     "const CONDITIONS={'55-langue.js':()=>manifest().identity.langue_interface_dans==='entete'}", true],
    // ⚠️ CE TÉMOIN A ÉTÉ TROUÉ, ET IL A ACCUSÉ L'INSTRUMENT. Écrit d'abord
    //   sans tableau `ORDRE` — il n'éprouvait que l'import — il est devenu
    //   ROUGE le jour où le contrôle a appris à lire `ORDRE`, et il désignait
    //   un banc parfaitement juste. ⭐⭐⭐ *Un cas qui n'énonce qu'une partie de
    //   la condition se lit exactement comme un instrument cassé* — troisième
    //   fois dans ce lot, et la deuxième dans ce seul §. Chaque cas déclare
    //   désormais LA CHAÎNE ENTIÈRE, pas le morceau qui l'intéresse.
    ['② le prédicat importé ET le fichier servi — le témoin',
     "import { langueUiDansEntete } from './i18n.mjs';\nconst ORDRE=['50-i18n.js','55-langue.js'];\n"
     + "const CONDITIONS={'55-langue.js':()=>langueUiDansEntete()}", false],
    ['③ le fichier posé mais absent de `ORDRE`',
     "import { langueUiDansEntete } from './i18n.mjs';\nconst ORDRE=['50-i18n.js'];", true],
    // ⭐ LE CAS QUI A DÉMASQUÉ LE DÉFAUT D'INSTRUMENT : présent dans
    //   `CONDITIONS`, absent d'`ORDRE`. Le fichier n'est jamais servi, et la
    //   première version de ce § le déclarait conforme.
    ['④ présent dans `CONDITIONS` mais ABSENT d\'`ORDRE` — jamais servi',
     "import { langueUiDansEntete } from './i18n.mjs';\nconst ORDRE=['50-i18n.js'];\n"
     + "const CONDITIONS={'55-langue.js':()=>langueUiDansEntete()};", true],
    ['⑤ LE TÉMOIN — présent dans les deux',
     "import { langueUiDansEntete } from './i18n.mjs';\nconst ORDRE=['50-i18n.js','55-langue.js'];\n"
     + "const CONDITIONS={'55-langue.js':()=>langueUiDansEntete()};", false],
  ];
  let cc = 0;
  for (const [nom, faux, doitRougir] of CAS) {
    const ordreDuCas = (faux.match(/const\s+ORDRE\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1];
    const rouge = !/langueUiDansEntete/.test(faux) || /langue_interface_dans/.test(faux)
      || !/'55-langue\.js'/.test(ordreDuCas);
    const bon = rouge === doitRougir;
    if (!bon) cc++;
    console.log(`  ${bon ? 'ok ' : 'KO '} §5 ${nom} — ${doitRougir ? 'doit rougir' : 'doit rester vert'} : ${rouge ? 'ROUGE' : 'vert'}`);
  }
  dit(cc === 0, `${CAS.length} cas fabriqués : le §5 sait encore rougir`,
    cc ? `⛔ ${cc} cas mal jugé(s)` : null);
}

console.log(ko === 0 ? '\n✅ l\'en-tête est identique dans les deux modes de rendu\n'
                     : `\n🔴 ${ko} contrôle(s) en échec\n`);
process.exit(ko === 0 ? 0 : 1);
