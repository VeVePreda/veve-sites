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

import { readFileSync, existsSync } from 'node:fs';
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
for (const [nom, texte] of [['Base.astro', src], ['Home.astro', home]]) {
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
const heroAnon = /<div class="hero" data-anonyme>/.test(home);
const bordMembre = /<div class="tableau-bord" data-membre hidden>/.test(home);
dit(heroAnon && bordMembre,
  'l\'accueil déclare ses deux blocs : accroche (data-anonyme) et tableau de bord (data-membre)',
  heroAnon && bordMembre ? null
    : `hero[data-anonyme] : ${heroAnon ? 'ok' : 'ABSENT'} · tableau-bord[data-membre] : ${bordMembre ? 'ok' : 'ABSENT'}`);
// ⚠️ ET LA RÈGLE QUI LES BASCULE VIT DANS LE <head>, PAS DANS LE THÈME. Posée
// dans `theme.css`, elle arriverait avec la feuille externe — donc parfois
// après la première peinture, et le clignotement reviendrait « de temps en
// temps », ce qui est pire qu'à chaque fois.
dit(/html\[data-membre\] \.tableau-bord\[data-membre\]\[hidden\]/.test(src),
  'la règle qui ouvre le tableau de bord est EN LIGNE dans le <head>',
  'dans le thème, elle arriverait parfois après la première peinture');
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
const iScript = src.indexOf("setAttribute('data-membre'");
const iStyle = src.indexOf('html[data-membre]');
dit(iScript > 0 && iStyle > iScript, 'le script précède les règles qui lisent son attribut',
  iScript > 0 && iStyle > iScript ? null : `script à ${iScript}, règles à ${iStyle}`);

console.log(ko === 0 ? '\n✅ l\'en-tête est identique dans les deux modes de rendu\n'
                     : `\n🔴 ${ko} contrôle(s) en échec\n`);
process.exit(ko === 0 ? 0 : 1);
