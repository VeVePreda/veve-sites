// ⚠️ VeVePreda/veve-sites — engine/tools/test_feuille.mjs   (NEUF — lot 105)
// ═══════════════════════════════════════════════════════════════════════════
// LE THÈME EST DEHORS, ET IL Y RESTE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI CE BANC EXISTE. Réinliner du CSS est le geste le plus naturel
// du monde : c'est plus simple, ça marche tout de suite, ça supprime une
// requête, et ça ne casse RIEN — ni build, ni page, ni banc. Le lot 105 se
// défait donc tout seul, de bonne foi, au premier lot qui aura besoin d'une
// règle « juste pour cette page ». Sans instrument, la seule alarme serait un
// déploiement qui échoue trois semaines plus tard sur un cache Docker plein —
// c'est-à-dire un symptôme à quatre couches de sa cause.
//
// ⛔ IL LIT `dist/`, PAS LA SOURCE, ET C'EST LE POINT. La question n'est pas
// « le gabarit a-t-il l'air correct ? » mais « qu'est-ce qu'on SERT ? ». Un
// composant, un article Markdown, un thème ou une intégration peuvent tous
// injecter du CSS sans passer par `Base.astro`.
//
// ⭐⭐ IL SORT SUR UNE DÉCLARATION. « Zéro page trop grosse » et « zéro page
// lue » se ressemblent exactement dans un compteur à zéro, et sont l'inverse
// l'un de l'autre. Ce banc exige donc d'abord d'avoir lu un nombre plausible
// de pages ET une feuille, et sort en rc=2 sinon — un vert qui n'a rien
// inspecté est le plus cher de tous.
//
// ⚠️ IL SE PLACE APRÈS `npm run build` ET AVANT LA PRÉCOMPRESSION : après, il
// verrait 8 500 `.gz` de plus et lirait du binaire. Il les ignore quand même,
// mais on ne fait pas payer un parcours pour rien.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const R = new URL('../..', import.meta.url).pathname;
// Deux modes, deux racines : `dist/` (static) ou `dist/client/` (server).
const DIST = existsSync(join(R, 'dist/client')) ? join(R, 'dist/client') : join(R, 'dist');

// 🔴 LE SEUIL, ET IL EST DÉLIBÉRÉMENT BAS. Mesuré le 07/08 sur le build réel,
// après le lot : il ne reste que deux `<style>` par page — les règles
// anti-clignotement (381 o) et les styles de portée d'Astro (1 737 à 1 999 o).
// 8 Ko laisse de la place à un composant qui grandit, et arrête net un thème
// qui reviendrait par la fenêtre (166 721 o).
const SEUIL = 8192;
// ⭐⭐ LE SECOND PLAFOND EST PAR PAGE, ET SURTOUT PAS EN TOTAL. Un total en
// octets DÉRIVE avec le catalogue : 8 484 pages aujourd'hui, le double le jour
// où l'identité passe à la chaîne — le même site franchirait le seuil sans
// qu'une seule ligne de CSS ait bougé, et le banc se ferait relever « parce
// qu'il crie pour rien ». Un plafond relevé une fois de trop est un plafond
// désarmé. Une MOYENNE PAR PAGE ne dérive pas.
// Mesuré le 07/08 après le lot, SUR LES DEUX SITES — et il fallait les deux :
//   veveprice  2 118 o/page   (anti-clignotement 381 o + portées Astro ~1 640)
//   vevewiki   2 765 o/page   (ses gabarits d'encyclopédie stylent davantage)
// ⚠️ 3 072 aurait laissé 11 % de marge à vevewiki — c'est-à-dire un banc qui
// rougirait au premier composant, pour une raison qui n'a rien à voir avec le
// thème, donc un banc qu'on relèverait sans regarder. 4 096 laisse 48 % au
// site le plus chargé et arrête net un thème qui reviendrait : il ajouterait
// 37 525 o (encyclopedie) à 168 850 o (vitrine).
const PLAFOND_PAR_PAGE = 4096;

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 134 — LE `<script>` N'AVAIT AUCUN PLAFOND, ET C'EST POUR ÇA QUE
//                28,9 Ko SE SONT ACCUMULÉS EN SILENCE
// ═══════════════════════════════════════════════════════════════════════════
// Ce banc plafonne le `<style>` en ligne depuis le lot 105. Il n'a JAMAIS rien
// dit du `<script>` en ligne, alors que le raisonnement est identique au mot
// près : recopié dans chaque page, retéléchargé à chaque visite, jamais mis en
// cache entre deux pages. Mesuré sur la production le 10/08 : **28 920 o par
// fiche, 56,7 % du poids de la page**.
// ⭐⭐⭐ *Une limite qui n'existe que pour une des deux ressources protège la
// moitié du problème — et laisse croire que l'autre moitié est surveillée.*
// C'est la même famille que « trois bancs sur quatre ne disent rien du
// quatrième », appliquée non pas à des cas mais à des RESSOURCES.
//
// ⭐⭐ POURQUOI CES VALEURS ET PAS 8 192 COMME LE `<style>` (arbitrage Preda,
// 10/08). Poser tout de suite la cible rendrait la chaîne rouge aujourd'hui :
// le lot 134 ne pourrait pas être déposé tant qu'OPT‑3 (sortir les pilotes en
// fichiers hachés) n'est pas fait, et OPT‑3 est un chantier, pas une ligne. Un
// banc rouge en permanence n'est pas un banc, c'est un obstacle qu'on finit par
// contourner. ⇒ **CLIQUET.** Le plafond est posé JUSTE AU-DESSUS du réel
// mesuré : il est vert aujourd'hui, et il interdit la croissance — c'est-à-dire
// exactement la panne qu'on vient de payer.
// 🔴 MESURÉ le 10/08, `SITE=veveprice RENDERING=server WAREHOUSE_OFFLINE=1`,
//    c'est-à-dire EXACTEMENT la configuration que la CI construit (`tests.yml`
//    pose `WAREHOUSE_OFFLINE: '1'`) — un cliquet réglé sur un build que la CI
//    ne fabrique pas rougirait chez elle le jour du dépôt, pas avant :
//        pire page  34 589 o  (`/sets/`, ses filtres et son pilote de tri)
//        moyenne    30 824 o/page sur 147 pages
//    (vevewiki, mesuré dans la foulée, est très en dessous : ses gabarits
//     d'encyclopédie n'embarquent ni cadran, ni favoris, ni filtres.)
// ⚠️ CES DEUX NOMBRES EXCLUENT LE `ld+json` — la première mesure, qui le
//    comptait, donnait 35 089 / 31 774. L'écart est petit et il aurait suffi à
//    faire passer un cliquet pour une marge. *Un seuil hérité d'une mesure qui
//    ne comptait pas la même chose est un seuil qui ne mesure rien.*
// ⛔ ET LA RÈGLE DU CLIQUET EST ÉCRITE ICI : **CES DEUX NOMBRES NE MONTENT
//    JAMAIS.** Le jour où un lot les fait rougir, on sort du JavaScript de la
//    page ; on ne relève pas la barre. Un plafond relevé une fois de trop est un
//    plafond désarmé — c'est déjà écrit vingt lignes plus haut pour le CSS, et
//    ça vaut mot pour mot ici.
// 🎯 LA CIBLE RESTE 8 192, comme le `<style>`, et ce banc l'imprime à chaque
//    passage tant qu'elle n'est pas atteinte : une dette qu'on lit à chaque run
//    est une dette qu'on finit par payer ; une dette écrite dans un audit ne se
//    relit qu'une fois.
// ⚡⚡ LOT 137 (A2 / OPT‑3) — LE CLIQUET DESCEND, ET C'EST LA MOITIÉ DU LOT.
// ═══════════════════════════════════════════════════════════════════════════
// Le socle JS a sorti des pages tout ce qui y était recopié à l'identique.
// MESURÉ, les quatre conditions, `dist/` réel :
//
//        site        avant        après      pire page (avant → après)
//   veveprice   30 945 o/p    7 333 o/p    34 707 → 16 125
//   vevewiki    19 031 o/p    7 606 o/p    26 431 → 12 638
//
// ⭐⭐⭐ LE CLIQUET NE MONTE JAMAIS — MAIS IL DOIT DESCENDRE, ET LE JOUR OÙ IL
// PEUT. Laisser 36 864 / 33 792 après ce lot laisserait **26 Ko de marge par
// page** : le banc afficherait « sous son cliquet » pendant qu'un lot futur
// réinlinerait tranquillement tout ce qu'on vient de sortir, sans un mot. Un
// cliquet qu'on oublie de resserrer se désarme exactement comme un plancher
// qu'on oublie de relever — c'est le plancher resté à 25 pendant que la chaîne
// montait à 40, vu dans l'autre sens.
// ⇒ Les deux nombres sont posés JUSTE AU-DESSUS des valeurs mesurées, et de
// rien de plus : la marge est celle du bruit, pas celle du confort.
// ⛔ 🎯 ET LA CIBLE DE 8 192 EST TENUE SUR LES DEUX SITES. Elle reste écrite :
// elle n'est plus une dette, elle est devenue le contrat.
const SEUIL_JS = 17408;            // 17 Ko — cliquet au-dessus des 16 125 o mesurés (pire page, veveprice)
const PLAFOND_JS_PAR_PAGE = 8192;  // 🎯 LA CIBLE EST DEVENUE LE PLAFOND — mesuré 7 333 (veveprice) et 7 606 (vevewiki)
const CIBLE_JS = 8192;             // la symétrie avec le <style> — ✅ ATTEINTE au lot 137

let ko = 0;
const dit = (bon, quoi, detail) => {
  if (!bon) ko++;
  console.log(`  ${bon ? 'ok ' : 'KO '} ${quoi}${detail ? ` — ${detail}` : ''}`);
};

console.log('\n═══ LOT 105 — le thème est servi une fois, pas 8 484 ═══');

if (!existsSync(DIST)) {
  console.error(`\n❌ ${DIST} introuvable — ce banc ne peut rien prouver. Lancer le build d'abord.`);
  process.exit(2);
}

// ── 0. LA FEUILLE EXISTE, ET SON NOM DIT SON CONTENU ──────────────────────
const feuilles = readdirSync(DIST).filter((f) => /^theme-[0-9a-f]{12}\.css$/.test(f));
if (feuilles.length !== 1) {
  console.error(`\n❌ ${feuilles.length} feuille(s) « theme-<empreinte>.css » à la racine de ${DIST} `
    + `— il en faut exactement une. Trouvé : ${feuilles.join(', ') || '(aucune)'}`);
  process.exit(2);
}
const nomFeuille = feuilles[0];
const octets = readFileSync(join(DIST, nomFeuille));
const texteFeuilleBrut = octets.toString('utf8');
const empreinteLue = nomFeuille.slice(6, 18);
const empreinteVraie = createHash('sha256').update(octets).digest('hex').slice(0, 12);
// ⭐⭐ « EST-CE QU'IL Y A UNE EMPREINTE ? » ET « EST-CE QUE C'EST L'EMPREINTE
// DE CE FICHIER ? » SONT DEUX QUESTIONS. Un nom figé qui RESSEMBLE à un nom
// empreint passerait la première. Et nginx sert tout `.css` en `immutable`
// pendant 30 jours : une empreinte qui ne suit pas le contenu, c'est un thème
// périmé servi un mois aux seuls visiteurs déjà venus.
dit(empreinteLue === empreinteVraie,
  `l'empreinte du nom est bien celle du contenu (${empreinteVraie})`,
  empreinteLue === empreinteVraie ? null
    : `le nom dit ${empreinteLue}, le contenu dit ${empreinteVraie} — « immutable » servirait un thème périmé 30 jours`);
// ⭐⭐⭐ ON NE MESURE PAS LA FEUILLE À UN SEUIL, ON LA COMPARE À SA SOURCE.
// Première version : « elle doit peser plus de 10 000 o ». `aurora` en fait
// 6 785 — un thème parfaitement valide, et le banc rougissait dessus. ⚠️ UN
// NOMBRE MAGIQUE NE MESURE PAS CE QU'IL PRÉTEND : il mesure « vitrine », et il
// appelle « cassé » tout ce qui n'est pas vitrine. Le critère juste est une
// IDENTITÉ, pas une taille : la feuille doit contenir, au caractère près, le
// texte d'exactement UN des `themes/*/theme.css`.
// ⭐ Au passage, ça prouve les deux choses que ce lot a promises : le thème
// n'est ni tronqué ni retouché en chemin, et `themes/*/theme.css` n'a pas
// bougé — on les LIT, on les écrit ailleurs.
const DOSSIER_THEMES = join(R, 'themes');
const dispoTh = existsSync(DOSSIER_THEMES)
  ? readdirSync(DOSSIER_THEMES).filter((d) => existsSync(join(DOSSIER_THEMES, d, 'theme.css')))
  : [];
if (dispoTh.length === 0) {
  console.error(`\n❌ aucun thème lu sous ${DOSSIER_THEMES} — racine invalide, ce banc ne prouve rien.`);
  process.exit(2);
}
const dedans = dispoTh.filter((d) => texteFeuilleBrut.includes(readFileSync(join(DOSSIER_THEMES, d, 'theme.css'), 'utf8')));
dit(dedans.length === 1,
  `la feuille (${octets.length} o) porte le thème « ${dedans[0] || '?'} » au caractère près`
  + ` — ${dispoTh.length} thème(s) confrontés : ${dispoTh.join(', ')}`,
  dedans.length === 1 ? null
    : dedans.length === 0
      ? 'AUCUN thème du dépôt ne s\'y retrouve intégralement — feuille tronquée, réécrite, ou thème modifié'
      : `${dedans.length} thèmes s'y retrouvent : la feuille en empile plusieurs`);

// ── 1. LES RÈGLES ANTI-CLIGNOTEMENT NE SONT PAS DEDANS ────────────────────
// ⛔ LE CAS SYMÉTRIQUE, ET C'EST LUI QU'ON NE VERRAIT PAS. `test:entete`
// vérifie qu'elles sont EN LIGNE dans la source ; il ne dirait rien si on les
// AJOUTAIT au thème « pour ranger ». Elles arriveraient alors avec la feuille
// externe, donc parfois après la première peinture : le clignotement
// reviendrait « de temps en temps » — pire qu'à chaque fois, parce qu'on
// cesserait de savoir le reproduire.
dit(!/html\[data-membre\]/.test(texteFeuilleBrut),
  'les règles anti-clignotement ne sont PAS dans la feuille externe',
  'dans la feuille, elles arriveraient parfois après la première peinture');

// ── 2. TOUTES LES PAGES LA RÉFÉRENCENT, AUCUNE NE RÉINLINE ────────────────
const pages = [];
(function marche(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) marche(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
})(DIST);

// ⭐ LA DÉCLARATION AVANT LA MESURE.
if (pages.length < 100) {
  console.error(`\n❌ ${pages.length} page(s) lue(s) sous ${DIST} — trop peu pour prouver quoi que ce soit. `
    + `Un banc qui n'a rien inspecté n'a rien prouvé.`);
  process.exit(2);
}

const lien = new RegExp(`<link[^>]+href="/${nomFeuille}"`);
const reStyle = /<style[^>]*>([\s\S]*?)<\/style>/g;
// ⚠️ `(?![^>]*\bsrc=)` — ON NE COMPTE QUE LE JS **EN LIGNE**. Un
// `<script src="/pilote-abc123.js">` est précisément ce qu'on VEUT : externe,
// haché, `immutable`, mis en cache 30 jours. Le compter ferait rougir le banc
// sur la correction qu'il réclame — l'instrument punirait le remède.
// ⭐ Et `type="application/ld+json"` est EXCLU, avec une raison : les données
// structurées sont du CONTENU, pas un pilote. Elles doivent rester dans la
// page (Google les lit là), elles ne se factorisent pas dans un fichier
// externe, et elles grandissent avec le catalogue. Les compter mélangerait
// deux dettes dont une n'en est pas une. *Un champ à deux populations.*
const reScript = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
const estDonnees = (attrs) => /type\s*=\s*["']application\/(ld\+json|json)["']/i.test(attrs);
let sansLien = 0;
let talons = 0;
const gros = [];
const nus = [];
let cumul = 0;
let pire = 0;
const grosJs = [];
let cumulJs = 0;
let pireJs = 0;
let pireJsOu = '';
let blocsJs = 0;
let cumulLd = 0;
for (const p of pages) {
  const h = readFileSync(p, 'utf8');
  // ⭐⭐ LES TALONS DE REDIRECTION N'ONT RIEN À HABILLER — ET C'EST vevewiki
  // QUI L'A DIT. En mode SERVER, `redirects:` est servi par l'adaptateur : il
  // n'y a aucun fichier, et ce banc était vert sur veveprice. En mode STATIC,
  // Astro écrit un talon HTML de 320 octets par redirection — 4 pages sans
  // feuille, donc un banc ROUGE en production sur un site parfaitement sain.
  // ⭐ « Corrigé sur un site » ne veut pas dire « corrigé » : ces deux sites ne
  // se ressemblent que jusqu'au premier détail qui compte.
  // ⛔ ON NE LES ÉCARTE PAS PAR LEUR NOM. Le critère est ce qu'ils SONT — un
  // `<meta http-equiv="refresh">` et rien d'autre, sous 2 Ko — et leur nombre
  // est DIT plus bas : une exclusion qui grossit en silence est une exclusion
  // qui finit par tout couvrir.
  if (h.length < 2048 && /http-equiv="refresh"/.test(h)) { talons++; continue; }
  if (!lien.test(h)) nus.push(p.slice(DIST.length)), sansLien++;
  let m;
  reStyle.lastIndex = 0;
  while ((m = reStyle.exec(h)) !== null) {
    const n = Buffer.byteLength(m[1]);
    cumul += n;
    if (n > pire) pire = n;
    if (n > SEUIL) gros.push(`${p.slice(DIST.length)} : <style> de ${n} o`);
  }
  // ── LE MÊME COMPTAGE, POUR LE `<script>` EN LIGNE ──────────────────────
  let totJs = 0;
  reScript.lastIndex = 0;
  while ((m = reScript.exec(h)) !== null) {
    const n = Buffer.byteLength(m[2]);
    if (estDonnees(m[1])) { cumulLd += n; continue; }
    blocsJs++;
    totJs += n;
    if (n > SEUIL_JS) grosJs.push(`${p.slice(DIST.length)} : <script> de ${n} o`);
  }
  cumulJs += totJs;
  if (totJs > pireJs) { pireJs = totJs; pireJsOu = p.slice(DIST.length); }
}

dit(sansLien === 0, `les ${pages.length - talons} pages de contenu référencent /${nomFeuille}`
  + (talons ? ` (${talons} talon(s) de redirection écarté(s))` : ''),
  sansLien === 0 ? null
    : `${sansLien} page(s) SANS le lien — elles s'afficheront nues : ${nus.slice(0, 5).join(' · ')}`);
// ⭐ L'INSTRUMENT AVANT LA MESURE, UNE SECONDE FOIS. Si un jour tout devenait
// un talon, la ligne au-dessus serait verte sur zéro page jugée.
dit(pages.length - talons >= 100,
  `${pages.length - talons} page(s) de contenu réellement jugée(s)`,
  pages.length - talons >= 100 ? null : 'presque tout a été écarté — ce banc ne prouve plus rien');
dit(gros.length === 0, `aucun <style> au-dessus de ${SEUIL} o (le pire : ${pire} o)`,
  gros.length === 0 ? null : `${gros.length} bloc(s) : ${gros.slice(0, 5).join(' · ')}${gros.length > 5 ? ' …' : ''}`);
const moyenne = Math.round(cumul / pages.length);
dit(moyenne < PLAFOND_PAR_PAGE,
  `CSS en ligne : ${moyenne} o par page en moyenne (${(cumul / 1024 / 1024).toFixed(2)} Mo sur tout dist/)`,
  moyenne < PLAFOND_PAR_PAGE ? null
    : `au-dessus de ${PLAFOND_PAR_PAGE} o par page — du CSS de site est revenu dans les pages`);

// ═══ LE CLIQUET DU JAVASCRIPT EN LIGNE ════════════════════════════════════
// ⭐ L'INSTRUMENT AVANT LA MESURE, UNE TROISIÈME FOIS. Si le motif cessait de
// matcher — un lot qui passe tout en `<script src>`, une balise réécrite par
// une intégration — les deux contrôles ci-dessous seraient verts sur ZÉRO
// octet inspecté, et ils annonceraient une victoire. Ce site a des pilotes en
// ligne sur toutes ses pages ; en lire zéro n'est pas un progrès, c'est une
// panne d'instrument.
dit(blocsJs >= (pages.length - talons),
  `${blocsJs} bloc(s) <script> en ligne réellement lu(s) sur ${pages.length - talons} page(s)`,
  blocsJs >= (pages.length - talons) ? null
    : 'moins d\'un bloc par page — le motif ne matche plus, ce banc ne mesure plus rien');
dit(grosJs.length === 0,
  `aucun <script> en ligne au-dessus de ${SEUIL_JS} o (la pire page : ${pireJs} o — ${pireJsOu || 'n/a'})`,
  grosJs.length === 0 ? null
    : `${grosJs.length} bloc(s) : ${grosJs.slice(0, 5).join(' · ')}${grosJs.length > 5 ? ' …' : ''}`);
const moyenneJs = Math.round(cumulJs / (pages.length - talons));
dit(moyenneJs < PLAFOND_JS_PAR_PAGE,
  `JS en ligne : ${moyenneJs} o par page en moyenne (${(cumulJs / 1024 / 1024).toFixed(2)} Mo sur tout dist/`
  + `, hors ${(cumulLd / 1024).toFixed(0)} Ko de données structurées)`,
  moyenneJs < PLAFOND_JS_PAR_PAGE ? null
    : `au-dessus de ${PLAFOND_JS_PAR_PAGE} o par page — ⛔ LE CLIQUET NE SE RELÈVE PAS : `
      + 'du JavaScript de site est entré dans les pages, il en ressort en fichier haché');
// 🎯 LA DETTE SE LIT À CHAQUE PASSAGE, ET ELLE EST CHIFFRÉE. ⭐ *Une phrase se
// relit ; un nombre se vérifie.* Tant que ce bloc s'imprime, OPT‑3 n'est pas
// fait — et le jour où il l'est, ce sont ces deux lignes qui le diront, pas un
// document.
if (moyenneJs > CIBLE_JS) {
  const aRecuperer = (moyenneJs - CIBLE_JS) * (pages.length - talons);
  console.log(`     🎯 DETTE OPT‑3 — cible ${CIBLE_JS} o/page (celle du <style> depuis le lot 105) :`);
  console.log(`        ${moyenneJs - CIBLE_JS} o de trop par page, soit ${(aRecuperer / 1024 / 1024).toFixed(2)} Mo sur ce dist/.`);
  console.log('        Ces octets voyagent dans CHAQUE page : la compression les écrase à');
  console.log('        l\'intérieur d\'une page, jamais ENTRE deux pages. Un visiteur qui ouvre');
  console.log('        cinq fiches télécharge cinq fois le même pilote.');
  console.log('     ➡️  Sortir les pilotes en fichiers hachés (favoris, cadran, filtres, i18n).');
  console.log('        ⛔ Restent en ligne, et ce n\'est pas négociable : l\'anti-clignotement du');
  console.log('        thème et tout ce qui lit un cookie d\'affichage AVANT la première peinture.');
}

if (gros.length) {
  console.log('     ⭐ Un thème recopié dans chaque page coûte deux fois : au réseau du');
  console.log('        visiteur (il le retélécharge à chaque page) et au cache de build');
  console.log('        Docker, qui a déjà fait échouer des déploiements en silence.');
  console.log('     ➡️  Le CSS de site va dans `themes/<nom>/theme.css` — il sortira tout');
  console.log('        seul dans la feuille. Seules les règles qui doivent précéder la');
  console.log('        PREMIÈRE PEINTURE restent en ligne, et elles tiennent en 400 octets.');
}

console.log(ko === 0
  ? `\n✅ une feuille de ${octets.length} o pour ${pages.length} pages, rien de recopié,`
    + ` et le JS en ligne sous son cliquet (${moyenneJs} o/page)\n`
  : `\n🔴 ${ko} contrôle(s) en échec\n`);
process.exit(ko === 0 ? 0 : 1);
