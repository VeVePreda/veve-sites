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
// 🔴🔴 06/09 — CE CONTRÔLE LISAIT LA PROSE, ET IL A ROUGI SUR UN COMMENTAIRE.
// Le bloc du rail (LOT D) EXPLIQUE en commentaire pourquoi il ne s'appuie pas
// sur `gap` : parce que `html[data-membre] form[data-membre][hidden]` force un
// `display:block`. Citer la règle a suffi à faire rougir le banc, alors
// qu'aucune règle n'avait été ajoutée à la feuille.
// ⭐⭐ *Un banc branché sur un NOM trouve la prose ; il faut le brancher sur un
// USAGE.* C'est une règle déjà payée dans ce dépôt, et `test_membre.mjs` porte
// déjà la fonction qu'il faut (« un contrôle lit aussi les commentaires »,
// leçon payée trois fois).
// ⛔ ET ON NE RETIRE PAS LE COMMENTAIRE POUR FAIRE PASSER LE BANC : ce serait
// effacer l'explication d'une contrainte réelle pour satisfaire un instrument
// mal réglé. C'est l'instrument qu'on règle.
// ⚠️ Le décapage se fait sur les commentaires CSS `/* … */` UNIQUEMENT. Une
// feuille n'a pas de `//` : un `//` y apparaît dans les `url(https://…)`, et
// décaper là-dessus mangerait la moitié des lignes.
const feuilleSansProse = texteFeuilleBrut.replace(/\/\*[\s\S]*?\*\//g, ' ');
dit(!/html\[data-membre\]/.test(feuilleSansProse),
  'les règles anti-clignotement ne sont PAS dans la feuille externe',
  'dans la feuille, elles arriveraient parfois après la première peinture');

// ⭐⭐⭐ L'AUTO-CONTRÔLE, ET IL EST LE PRIX DU DÉCAPAGE. Décaper, c'est retirer
// du texte au banc : il faut donc prouver, dans le même souffle, qu'il mord
// encore sur ce qu'il protège. Sans ça, un décapage trop large rendrait ce
// contrôle vert POUR TOUJOURS, et personne ne le saurait.
dit(/html\[data-membre\]/.test('a{b:c}html[data-membre] x{display:none}'.replace(/\/\*[\s\S]*?\*\//g, ' ')),
  '…et le décapage laisse passer une VRAIE règle (auto-contrôle)',
  'le décapage a mangé autre chose que des commentaires');
dit(!/html\[data-membre\]/.test('/* html[data-membre] cité en prose */a{b:c}'.replace(/\/\*[\s\S]*?\*\//g, ' ')),
  '…et il retire bien la citation en commentaire (auto-contrôle)',
  'le commentaire survit au décapage');

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

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 161 — « EST-CE ÉCRIT ? » ET « EST-CE CE QUI GAGNE ? »
// ═══════════════════════════════════════════════════════════════════════════
// Ce banc savait dire que la feuille était SERVIE, UNE fois, ENTIÈRE et à la
// bonne empreinte. Il ne savait pas dire si ce qu'elle contient S'APPLIQUE.
// Le 24/08/2026, mesuré sur la production : `main{padding:… var(--s8)}`, écrit
// le 06/08 avec douze lignes de commentaire pour le défendre, valait **0** —
// `Base.astro` émet `<main class="wrap">` et `.wrap{padding:0 24px}` le bat en
// spécificité. Deux semaines de règle morte, zéro alerte, zéro banc rouge.
// ⛔ CE CONTRÔLE NE JUGE PAS LE DESIGN. Il ne dit pas « 88 px est la bonne
//    valeur » : il dit « une valeur a été posée là exprès, et elle gagne ».
//    Le jour où Preda voudra 60 px, la constante bouge et le banc suit.
{
  const { decouper, quiGagne } = await import('./_cascade.mjs');
  const { regles, anomalies } = decouper(texteFeuilleBrut);

  // ── A · la feuille se découpe-t-elle proprement ? ────────────────────────
  // Deux signatures, trouvées le 24/08 dans la feuille SERVIE : un sélecteur
  // pendant sans bloc (`  .decor,.banniere,` puis `}` — règle jetée par le
  // navigateur, en silence), et douze étapes `0%/22%/78%/100%` posées à la
  // racine sans leur `@keyframes`. Ni le build, ni un log, ni un banc.
  dit(anomalies.length === 0,
    `la feuille se découpe sans reste (${regles.length} règles lues)`,
    anomalies.length === 0 ? null
      : anomalies.slice(0, 5).map((a) => `${a.quoi} « ${a.texte} »`).join(' · ')
        + (anomalies.length > 5 ? ` … et ${anomalies.length - 5} autre(s)` : ''));

  // ── B · les espaces de page gagnent-ils vraiment ? ───────────────────────
  // ⚠️ ON LE MESURE SUR UNE PAGE DE `dist/`, PAS SUR LE GABARIT. La question
  // est « qu'est-ce qu'on SERT », comme pour le reste de ce banc.
  const { parseHTML } = await import('linkedom');
  const pageJugee = pages.find((f) => {
    const h = readFileSync(f, 'utf8');
    return h.length > 2048 && /<main[^>]*>/.test(h);
  });
  if (!pageJugee) {
    console.error('\n❌ aucune page de dist/ ne porte de <main> — ce contrôle ne peut rien prouver.');
    process.exit(2);
  }
  const { document: docJuge } = parseHTML(readFileSync(pageJugee, 'utf8'));

  // 🔴🔴 CE CONTRÔLE A ÉTÉ ÉCRIT TROIS FOIS. LES DEUX PREMIÈRES ÉTAIENT FAUSSES,
  // ET PAS DE LA MÊME FAÇON.
  //
  //  ① « la valeur gagnante est-elle différente de 0 ? » — MUET. Injection
  //     faite le 24/08 : j'ai retiré `footer.site.site-f{padding:var(--s7) 0}`,
  //     le banc est resté VERT parce que `footer.site{padding:var(--s6) 0}`
  //     reprenait la main avec 36 px. Non nul, donc « bon ». Il validait la
  //     panne. ⭐⭐⭐ « UNE VALEUR EST POSÉE » ET « C'EST LA VALEUR VOULUE »
  //     SONT DEUX QUESTIONS — la même erreur qu'il traque, d'un cran plus fin.
  //
  //  ② les valeurs de `vitrine`, exigées de TOUS LES THÈMES — FAUX ROUGE.
  //     `vevewiki` sert `encyclopedie`, dont le `main` vaut `0 0 20px` par
  //     dessein. Cinq contrôles rouges sur un site parfaitement sain.
  //     ⛔ CE FICHIER PORTE DÉJÀ CETTE LEÇON, ÉCRITE À PROPOS DE LA TAILLE DE
  //     LA FEUILLE : « UN NOMBRE MAGIQUE NE MESURE PAS CE QU'IL PRÉTEND : il
  //     mesure vitrine, et il appelle cassé tout ce qui n'est pas vitrine. »
  //     Je l'ai relue après l'avoir refaite.
  //
  // ⇒ Les attentes sont donc INDEXÉES PAR THÈME, et un thème non décrit rend
  //   SANS OBJET — affiché, jamais tu. La demande de Preda (`t`, 24/08) porte
  //   sur veveprice : c'est `vitrine` qui est décrit, et c'est dit ici.
  // ⛔ CONSÉQUENCE ASSUMÉE : le jour où Preda voudra 60 px au lieu de 88, ce
  //    banc rougira. C'est le but. La constante change ICI, dans le même geste
  //    que le thème — un espace de page bouge exprès, ou il ne bouge pas.
  // ⭐ `i` = la position dans le RACCOURCI `padding` (0 haut, 2 bas). `i: null`
  //   veut dire « cette propriété n'a pas de raccourci à surveiller ».
  const ESPACES_PAR_THEME = {
    vitrine: [
      { quoi: 'main',          sel: 'main',          prop: 'padding-bottom', i: 2, largeur: 1280, attendu: 'var(--s8)' },
      { quoi: 'main',          sel: 'main',          prop: 'padding-top',    i: 0, largeur: 1280, attendu: 'var(--s7)' },
      { quoi: 'main (mobile)', sel: 'main',          prop: 'padding-bottom', i: 2, largeur: 390,  attendu: 'var(--s8)' },
      { quoi: 'main (mobile)', sel: 'main',          prop: 'padding-top',    i: 0, largeur: 390,  attendu: 'var(--s5)' },
      { quoi: 'pied de page',  sel: 'footer.site-f', prop: 'padding-top',    i: 0, largeur: 1280, attendu: 'var(--s7)' },
      // 🔴 LOT 161 — LE BOUTON DE RECHERCHE, ET C'EST UNE DÉCISION QU'ON VERROUILLE.
      // Le lot 139 avait écrit `border-radius:var(--r-md)` dessus, à la demande
      // de Preda. `nav.main a{border-radius:var(--r-full)}` (0,1,2) le battait :
      // le bouton était ROND en ligne, pendant treize jours, sans que rien le
      // dise. Preda a tranché le 24/08 sur trois formes montrées : on GARDE le
      // rond, et le carré mort est parti. ⛔ Cette ligne empêche les deux
      // rechutes : qu'on ressuscite le carré, et qu'on l'écrive à nouveau sans
      // qu'il gagne.
      { quoi: 'bouton recherche', sel: '.h-rech--b', prop: 'border-radius', i: null, largeur: 1280, attendu: 'var(--r-full)' },
      { quoi: 'bouton recherche (mobile)', sel: '.h-rech--b', prop: 'border-radius', i: null, largeur: 390, attendu: 'var(--r-full)' },
    ],
  };
  const themeServi = dedans[0] || '?';
  const ESPACES = ESPACES_PAR_THEME[themeServi];
  if (!ESPACES) {
    console.log(`  --  espaces de page : SANS OBJET pour le thème « ${themeServi} »`
      + ` — seuls ${Object.keys(ESPACES_PAR_THEME).join(', ')} ont des valeurs décrites.`);
    console.log('      ⚠️ Ce site n\'est donc PAS protégé contre une règle battue en spécificité.');
  }
  for (const e of ESPACES || []) {
    const el = docJuge.querySelector(e.sel);
    // ⛔ ON NE SAUTE PAS EN SILENCE. Un sélecteur absent de la page servie est
    // soit un gabarit qui a changé, soit un banc branché sur une page qui ne
    // porte pas l'élément — les deux méritent un rouge, pas un vide.
    if (!el) { dit(false, `« ${e.sel} » présent dans la page servie`, `${pageJugee} n'en a pas — le gabarit a changé, ou la page jugée n'est pas la bonne`); continue; }
    const g = quiGagne(regles, el, e.prop, e.largeur, e.i === null ? null : ['padding', e.i]);
    const val = g ? String(g.val).trim() : null;
    dit(val === e.attendu,
      `${e.quoi} · ${e.prop} @${e.largeur}px = ${val ?? '(rien)'}${g ? `  \u27f5 ${g.sel}` : ''}`,
      val === e.attendu ? null
        : !g ? `AUCUNE règle ne le pose — on attendait ${e.attendu}`
             : `« ${g.sel} » gagne avec ${val}, on attendait ${e.attendu} — soit la valeur`
               + ` a changé, soit la règle voulue est BATTUE en spécificité par celle-ci`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 📏 LOT 203, POINT `ag` — UNE SÉRIE LISTÉE NE DÉFORME PLUS SA CARTE
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 CE QUE PREDA A DEMANDÉ, AVEC SES MOTS : « il faut juste tronquer
//   l'affichage, et quand on passe le curseur dessus on voit dans une infobulle
//   le nom complet — le but est que ça ne déforme pas les tuiles. Vérifie
//   partout. »
//
// ⭐⭐⭐ « PARTOUT » EST LA MOITIÉ DE LA DEMANDE, ET C'EST CE § QUI LA TIENT.
//   La série s'affiche à QUATRE endroits, mesurés le 26/08 :
//     · `/market/` en tableau  → `.tbl-obj__s`, bornée à 34ch depuis le lot 139
//     · `/market/` en tuiles   → `.tuile__s`, bornée par la largeur de sa case
//     · `/collection/<x>/`     → `.tbl-obj__s`, la même classe
//     · les cartes du blog     → `.item .s`, AUCUNE borne (série jusqu'à 89 car.)
//   Les deux premiers sont couverts par `test:tuiles`, qui a un vrai serveur.
//   Les CARTES DU BLOG sont pré-générées : aucun banc à serveur ne les voit,
//   et sans ce §-ci le seul endroit qui n'avait pas de borne serait aussi le
//   seul à n'être pas mesuré. *Le trou du filet se trouve toujours là où le
//   défaut est le plus probable.*
//
// ⚠️ CE QU'IL NE PROUVE PAS, écrit pour que personne ne s'y fie : il ne mesure
//   pas une largeur en pixels. `dist/` est du texte, il n'y a pas de moteur de
//   rendu ici. Il mesure ce qui REND la coupe possible (la règle est servie) et
//   ce qui la rend RÉPARABLE (le texte entier reste lisible au survol).
console.log('\n═══ LOT 203, POINT `ag` — la série est bornée, et son nom reste lisible ═══');
{
  // ⭐ ON JUGE LA FEUILLE SERVIE, pas le fichier source du thème. Trois thèmes
  //   existent (`vitrine`, `aurora`, `encyclopedie`) et chaque site n'en sert
  //   qu'un : lire la source dirait « la règle est écrite quelque part », ce
  //   qui n'est pas « elle arrive au lecteur de CE site ».
  const css = texteFeuilleBrut.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const regle = /\.item\s+\.s\[data-serie\]/.test(css);
  dit(regle, 'la feuille servie borne la série des cartes (`.item .s[data-serie]`)',
    regle ? 'coupe à la place réelle, sans toucher au texte'
      : '🔴 absente de CE thème — une série de 89 caractères repousserait la carte');
  const parent = /\.item\s*\{[^}]*min-width\s*:\s*0/.test(css);
  dit(parent, '…et le parent accepte de rétrécir (`.item { min-width:0 }`)',
    parent ? 'sans lui l\'`ellipsis` ne se déclenche jamais : l\'enfant élargit la carte'
      : '🔴 absent — c\'est le défaut qu\'on croit corriger chez l\'enfant');

  // ⚠️ ET LA RÈGLE NE DOIT PAS DÉBORDER SUR SES VOISINES. `.item .s` porte
  //   aussi des dates d'article, des rôles et des notes éditoriales : leur
  //   imposer une ligne unique tronquerait des textes qui ont le droit de
  //   respirer. Un correctif global sur une classe partagée avait déjà coûté
  //   764 titres à ce projet — ce contrôle est là pour qu'on ne le refasse pas
  //   en « simplifiant » le sélecteur.
  const nu = /\.item\s+\.s\s*\{[^}]*white-space\s*:\s*nowrap/.test(css);
  dit(!nu, '…et elle ne mord QUE sur la série, jamais sur `.item .s` nu',
    !nu ? 'dates, rôles et notes éditoriales gardent leurs lignes'
      : '🔴 le sélecteur a été élargi : il tronque maintenant des textes qui doivent respirer');

  // ⭐⭐ ET DANS LES PAGES : chaque série marquée doit porter son nom entier.
  //   Un `data-serie` sans `title` est le pire des deux mondes — le texte est
  //   coupé ET il n'y a plus moyen de le lire.
  let marques = 0; let sansTitre = 0; let vus = 0;
  for (const p of pages) {
    const h = readFileSync(p, 'utf8');
    for (const m of h.matchAll(/<(?:div|span)[^>]*class="s"[^>]*>/g)) {
      vus++;
      if (!/data-serie/.test(m[0])) continue;
      marques++;
      if (!/title="[^"]+"/.test(m[0])) sansTitre++;
    }
  }
  if (marques === 0) {
    // ⭐ « SANS OBJET » EST UN VERDICT LÉGITIME, et ce n'est pas un indécidable :
    //   la question est tranchée — ce corpus ne cite aucune pièce dans un
    //   article. Le Dockerfile refuse les indécidables, pas les sans-objet.
    console.log(`  --  SANS OBJET — aucune série listée dans ${pages.length} page(s) :`
      + ` ce site ne cite pas de pièce dans ses articles (${vus} « .s » vus, aucun marqué).`);
  } else {
    dit(sansTitre === 0,
      `chaque série listée porte son nom entier en infobulle (${marques} trouvée(s))`,
      sansTitre === 0 ? 'coupée à l\'écran, lisible au survol'
        : `🔴 ${sansTitre} sur ${marques} sans \`title\` — coupée ET illisible, le pire des deux`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 204 — LE BANC QUI MANQUAIT : « EST-CE LISIBLE ? »
// ═══════════════════════════════════════════════════════════════════════════
// LE 26/08, LE BLOC « MON TABLEAU DE BORD » DU LOT 202 EST ARRIVÉ EN PRODUCTION
// ILLISIBLE. Il était passé par 43 bancs, 4 conditions et 21 injections. Aucun
// n'a rougi. Tous mesuraient le CIRCUIT — la valeur est rangée, le cookie
// repart, la tuile bouge — et AUCUN ne mesurait la MISE EN PAGE.
// C'est une capture d'écran de Preda qui l'a vu. ⇒ « produite » ≠ « atteignable »
// ≠ **« lisible »**, et une capture valait ici quarante-trois bancs.
//
// ⭐⭐⭐ CE § NE DEMANDE PAS « LA RÈGLE EST-ELLE ÉCRITE ? » MAIS « QUI GAGNE ? ».
// La distinction est toute la valeur du bloc. Le défaut du 202 n'était pas une
// règle absente : c'était une règle PRÉSENTE — `.champ input{width:100%}` — qui
// gagnait sur une case à cocher parce que rien ne la contredisait. Un contrôle
// qui aurait cherché la chaîne « checkbox » dans la feuille serait resté vert
// le jour où quelqu'un aurait écrit cette exception DERRIÈRE la règle générale
// avec une spécificité plus faible. On résout donc la cascade : ordre source,
// spécificité, `!important` — et on lit la valeur qui l'emporte.
//
// ⛔ LES RÈGLES SOUS `@media` / `@supports` SONT IGNORÉES, EXPRÈS. La question
// posée est « que voit-on par défaut ? ». Une exception qui ne vaudrait qu'au
// delà de 900 px laisserait le téléphone cassé — ce banc la compte donc pour
// absente, et c'est le verdict conservateur qu'on veut.
//
// ⚠️ CE QU'IL NE PEUT PAS FAIRE, ET IL FAUT L'ÉCRIRE : il ne dessine pas. Il ne
// dira jamais qu'un contraste est faible ou qu'une marge est laide. Il borne UNE
// famille de fautes — « une classe employée hors de son rôle écrase ses
// enfants » — celle qui a coûté deux blocs illisibles le même jour.
// ⇒ ⛔ IL NE REMPLACE PAS UNE CAPTURE. Il empêche CE défaut-ci de revenir.
{
  const css204 = texteFeuilleBrut.replace(/\/\*[\s\S]*?\*\//g, ' ');

  // ── L'ANALYSEUR : les règles PLATES, dans l'ordre de la source ────────────
  // ⛔ On ne descend pas dans les `@media` : `pileAt` retient les blocs `@`
  //    ouverts, et tant qu'il n'est pas vide on ne retient rien.
  const reglesPlates = (css) => {
    const out = [];
    const pileAt = [];
    let prof = 0, selDebut = 0;
    for (let i = 0; i < css.length; i++) {
      const c = css[i];
      if (c === '{') {
        const tete = css.slice(selDebut, i).trim();
        prof++;
        if (tete.startsWith('@')) pileAt.push(prof);
        else if (pileAt.length === 0) {
          let p = 1, j = i + 1;
          while (j < css.length && p > 0) { if (css[j] === '{') p++; else if (css[j] === '}') p--; j++; }
          out.push({ sel: tete, corps: css.slice(i + 1, j - 1), ordre: out.length });
        }
        selDebut = i + 1;
      } else if (c === '}') {
        if (pileAt.length && pileAt[pileAt.length - 1] === prof) pileAt.pop();
        prof--;
        selDebut = i + 1;
      }
    }
    return out;
  };

  // ── LE MATCHEUR : un seul élément, sa chaîne d'ancêtres ───────────────────
  // ⚠️ SOUS-ENSEMBLE ASSUMÉ : type, `.classe`, `#id`, `[attr="v"]`, descendance
  //    et `>`. Tout sélecteur portant une pseudo-classe, `~` ou `+` est ÉCARTÉ :
  //    il décrit un ÉTAT (`:hover`, `:focus`) ou un voisinage, pas le repos —
  //    et c'est le repos qu'on mesure. Un sélecteur écarté ne peut donc jamais
  //    faire passer ce banc au vert par accident : il ne participe pas.
  const compose = (part) => {
    const m = { tag: null, ids: [], classes: [], attrs: [] };
    const re = /([a-zA-Z][\w-]*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:([~|^$*]?=)"?([^\]"]*)"?)?\]/g;
    let x; let vu = 0;
    while ((x = re.exec(part))) {
      vu = re.lastIndex;
      if (x[1]) m.tag = x[1];
      else if (x[2]) m.classes.push(x[2]);
      else if (x[3]) m.ids.push(x[3]);
      else if (x[4]) m.attrs.push([x[4], x[6] ?? null]);
    }
    return vu === part.length ? m : null;   // ⛔ reste illisible ⇒ on écarte
  };
  const colle = (n, c) => {
    if (c.tag && c.tag !== '*' && c.tag !== n.tag) return false;
    if (c.ids.some((i) => i !== n.id)) return false;
    if (c.classes.some((k) => !(n.classes || []).includes(k))) return false;
    return c.attrs.every(([a, v]) => (n.attrs || {})[a] !== undefined && (v === null || (n.attrs || {})[a] === v));
  };
  // chaîne = du plus lointain ancêtre à l'élément lui-même
  const matche = (sel, chaine) => {
    if (/[:~+]/.test(sel)) return null;
    const jetons = sel.trim().split(/\s+/).flatMap((j) => (j === '>' ? ['>'] : j.split(/(?=>)|(?<=>)/))).filter(Boolean);
    const parts = [];
    for (let i = 0; i < jetons.length; i++) {
      if (jetons[i] === '>') { parts[parts.length - 1].enfant = true; continue; }
      const c = compose(jetons[i]);
      if (!c) return null;
      parts.push({ c, enfant: false });
    }
    if (!parts.length) return null;
    // le dernier doit coller à l'élément
    const dernier = parts[parts.length - 1];
    if (!colle(chaine[chaine.length - 1], dernier.c)) return false;
    let k = chaine.length - 2;
    for (let p = parts.length - 2; p >= 0; p--) {
      const direct = parts[p + 1].enfant;
      if (direct) { if (k < 0 || !colle(chaine[k], parts[p].c)) return false; k--; continue; }
      let trouve = false;
      while (k >= 0) { if (colle(chaine[k], parts[p].c)) { trouve = true; k--; break; } k--; }
      if (!trouve) return false;
    }
    // spécificité (id, classe+attr, type)
    const spec = parts.reduce((a, { c }) => [a[0] + c.ids.length, a[1] + c.classes.length + c.attrs.length, a[2] + (c.tag && c.tag !== '*' ? 1 : 0)], [0, 0, 0]);
    return spec;
  };

  // ── QUI GAGNE SUR CETTE PROPRIÉTÉ ? ───────────────────────────────────────
  const REGLES_204 = reglesPlates(css204);
  const gagnant = (chaine, prop) => {
    let best = null;
    for (const r of REGLES_204) {
      for (const sel of r.sel.split(',')) {
        const spec = matche(sel.trim(), chaine);
        if (!spec) continue;
        const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'gi');
        let d;
        while ((d = re.exec(r.corps))) {
          const brut = d[1].trim();
          const imp = /!important/i.test(brut);
          const val = brut.replace(/!important/i, '').trim();
          // ⭐ L'ORDRE DE LA CASCADE, DANS SON ORDRE : `!important` d'abord,
          //   puis la spécificité (id, classe+attr, type), puis l'ordre de la
          //   source. ⚠️ Une comparaison lexicographique, pas une somme : une
          //   spécificité ne s'additionne pas — 11 classes ne battent pas un id.
          const rang = [imp ? 1 : 0, spec[0], spec[1], spec[2], r.ordre];
          const plusFort = !best || rang.some((v, i) => v > best.rang[i] && rang.slice(0, i).every((w, j) => w === best.rang[j]));
          if (plusFort) best = { val, rang, sel: sel.trim() };
        }
      }
    }
    return best;
  };

  // ── §204-A — UNE CASE À COCHER N'EST PAS UN CHAMP DE SAISIE ───────────────
  // La chaîne reproduit le balisage RÉEL de `src/pages/compte/index.astro` :
  // `<section class="panneau champ">` → `<form>` → `<div>` → `<label>` → la case.
  const CASE = [
    { tag: 'html', classes: [] }, { tag: 'body', classes: [] },
    { tag: 'section', classes: ['panneau', 'champ'] },
    { tag: 'form', classes: [] }, { tag: 'div', classes: [] }, { tag: 'label', classes: [] },
    { tag: 'input', classes: [], attrs: { type: 'checkbox' } },
  ];
  const TEXTE = [
    { tag: 'html', classes: [] }, { tag: 'body', classes: [] },
    { tag: 'section', classes: ['panneau', 'champ'] },
    { tag: 'form', classes: [] }, { tag: 'div', classes: [] }, { tag: 'label', classes: [] },
    { tag: 'input', classes: [], attrs: { type: 'text' } },
  ];
  // ⭐⭐ LE TÉMOIN D'ABORD, ET IL EST LA MOITIÉ DU CONTRÔLE. Si aucune règle ne
  //    gagne sur un `input[type=text]` dans un `.champ`, c'est que ce thème
  //    n'a pas de trousse de formulaire — le contrôle est SANS OBJET, pas vert.
  //    ⛔ « zéro parce que c'est corrigé » et « zéro parce qu'il n'y a rien
  //    ici » sont deux verdicts opposés, et `aurora` comme `encyclopedie`
  //    tombent dans le second : `.champ` n'existe que dans `vitrine`.
  const largeurTexte = gagnant(TEXTE, 'width');
  if (!largeurTexte) {
    console.log('\n  --  §204-A SANS OBJET — ce thème ne pose aucune largeur sur un `input` de `.champ` :');
    console.log('      il n\'a pas de trousse de formulaire, il n\'y a pas de case à écraser.');
    console.log('      ⭐ Ce message est volontaire : un banc muet et un banc vert se ressemblent.');
  } else {
    console.log(`\n  · §204-A — sur un champ de SAISIE, « ${largeurTexte.sel} » gagne : width:${largeurTexte.val}`);
    const l = gagnant(CASE, 'width');
    const h = gagnant(CASE, 'min-height');
    const p = gagnant(CASE, 'padding');
    const okL = Boolean(l) && !/%/.test(l.val) && l.val !== '100%';
    dit(okL, 'ce qui GAGNE en largeur sur une case à cocher n\'est pas une pleine largeur',
      okL ? `« ${l.sel} » l'emporte avec width:${l.val}`
        : `🔴 « ${l ? l.sel : '(aucune)'} » l'emporte avec width:${l ? l.val : '—'} — la case devient une barre, et le navigateur dessine la coche au milieu`);
    const okH = Boolean(h) && /^0(?:px|em|rem)?$/.test(h.val);
    dit(okH, '…et sa hauteur minimale ne lui impose pas la cible tactile',
      okH ? `« ${h.sel} » l'emporte avec min-height:${h.val}`
        : `🔴 min-height:${h ? h.val : '(aucune)'} — une case de 44 px de haut désaligne son libellé même une fois la largeur rendue`);
    const okP = Boolean(p) && /^0(?:px|em|rem)?$/.test(p.val);
    dit(okP, '…et son rembourrage est nul',
      okP ? `« ${p.sel} » l'emporte avec padding:${p.val}`
        : `🔴 padding:${p ? p.val : '(aucune)'} — 14 px de rembourrage sur une case la décale de son libellé`);
    // ⭐ LE CONTRE-CONTRÔLE : l'exception ne doit pas avoir tout emporté. Un
    //   `input[type="text"]` doit CONTINUER de prendre la largeur. Sans ce
    //   point, un `.champ input{width:auto}` global passerait les trois
    //   contrôles ci-dessus en cassant tous les formulaires du site.
    dit(largeurTexte.val === '100%', '…et le champ de saisie, lui, garde sa pleine largeur',
      largeurTexte.val === '100%' ? 'l\'exception mord sur les cases, pas sur les champs'
        : `🔴 width:${largeurTexte.val} sur un champ texte — l'exception a débordé sur ce qu'elle devait épargner`);
  }

  // ── §204-B — LE CONTENEUR DES PRIX NE DOIT PAS ÊTRE UNE COLONNE DE TABLEAU ─
  // ⭐⭐⭐ ON CHERCHE UN USAGE, JAMAIS UN NOM. Un contrôle « `.rang` n'est pas
  //    dans `CaisseAchat.astro` » serait vert le jour où quelqu'un y met une
  //    AUTRE classe étroite. On lit donc la classe que le composant emploie
  //    RÉELLEMENT autour de ses boutons de prix, quelle qu'elle soit, et on
  //    demande à la feuille SERVIE ce qu'elle lui fait.
  const COMPO = join(R, 'src/components/CaisseAchat.astro');
  // 🔴 MESURÉ SUR VEVEWIKI LE 26/08 : ma première version lisait le manifeste À
  //   LA MAIN, avec une expression sur le texte YAML. `vevewiki` déclare
  //   `offer:` avec une `url: ""` VIDE — et mon motif, qui acceptait un
  //   guillemet optionnel puis « un caractère non blanc », a pris le guillemet
  //   FERMANT pour l'adresse. Le banc a donc cru la vente ouverte sur un site
  //   qui ne vend rien, et il a rougi sur l'absence de règles de caisse dans un
  //   thème qui n'a pas de caisse.
  // ⭐⭐⭐ ON NE REDÉCODE PAS UN FORMAT QUAND LE CODE SAIT LE LIRE. `manifest()`
  //   est ce que la PAGE interroge, et `Boolean(String(url).trim())` est le
  //   critère EXACT que `Dashboard.astro` et `test:promesses` emploient déjà
  //   pour décider si la caisse existe. Trois lecteurs, un seul critère : c'est
  //   la seule façon qu'ils ne divergent pas.
  const { manifest: manifeste204 } = await import(join(R, 'engine/lib/manifest.mjs'));
  const venteOuverte204 = Boolean(String(manifeste204().offer?.url || '').trim());
  if (!venteOuverte204) {
    console.log(`\n  --  §204-B SANS OBJET — « ${process.env.SITE} » ne déclare pas d'\`offer.url\` : ce site ne sert pas de caisse.`);
    console.log('      ⭐ Ce message est volontaire : un banc muet et un banc vert se ressemblent.');
  } else if (!existsSync(COMPO)) {
    console.error(`\n❌ ${COMPO.replace(R, '')} introuvable alors que la vente est ouverte — ce banc ne peut rien prouver.`);
    process.exit(2);
  } else {
    const src = readFileSync(COMPO, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
    const iBouton = src.indexOf('data-caisse-acheter');
    if (iBouton < 0) {
      console.error('\n❌ aucun `data-caisse-acheter` dans CaisseAchat.astro — l\'instrument ne trouve plus son sujet.');
      process.exit(2);
    }
    // ── LE CONTENEUR : LE DERNIER `<div>` ENCORE OUVERT AVANT LE BOUTON ──
    // 🔴 MESURÉ LE 26/08 PAR INJECTION : ma première version prenait « le
    //   dernier `<div class="…">` rencontré avant le bouton ». Elle ne comptait
    //   pas les fermetures. On remplace le conteneur par un `<div>` NU — le
    //   défaut le plus bête qui soit — et le banc restait VERT : il remontait
    //   jusqu'à un `<div class="…">` d'un bloc PRÉCÉDENT, déjà refermé, et
    //   annonçait fièrement que le conteneur « porte une classe à lui ».
    //   ⭐⭐ L'INSTRUMENT MESURAIT UN AUTRE ÉLÉMENT QUE SON SUJET, et il le
    //   disait avec aplomb. C'est la famille de fautes qui a coûté 14 bancs
    //   faux en quatre jours : la question n'est pas « le banc rougit-il ? »
    //   mais « sur QUOI est-il branché ? ».
    // ⇒ On remonte en comptant les fermetures : le conteneur est le premier
    //   `<div>` dont la fermeture n'a pas encore été vue.
    const avant = src.slice(0, iBouton);
    const jetonsDiv = [...avant.matchAll(/<div(\s[^>]*)?>|<\/div>/g)];
    let profondeur = 0; let conteneur = null;
    for (let i = jetonsDiv.length - 1; i >= 0; i--) {
      const j = jetonsDiv[i][0];
      if (j === '</div>') { profondeur++; continue; }
      if (profondeur > 0) { profondeur--; continue; }
      conteneur = j; break;                       // ⇐ le premier encore ouvert
    }
    const mClasse = conteneur && conteneur.match(/\sclass="([^"]*)"/);
    const classes = mClasse ? mClasse[1].trim().split(/\s+/).filter(Boolean) : [];
    if (!conteneur) {
      console.error('\n❌ aucun `<div>` ouvert n\'entoure les boutons de prix — l\'instrument ne trouve plus son sujet.');
      process.exit(2);
    }
    console.log(`\n  · §204-B — les boutons de prix vivent dans « ${classes.join(' ') || '(aucune classe)'} »`);
    dit(classes.length > 0, 'le conteneur des boutons de prix porte une classe à lui',
      classes.length ? null : '🔴 sans classe, rien ne le peint et il hérite de ce qu\'il trouve');
    // ⚠️ ON RÉSOUT SUR CHAQUE CLASSE DU CONTENEUR, pas seulement la première :
    //    `class="rang machin"` cassait autant que `class="rang"`.
    for (const k of classes) {
      const chaine = [{ tag: 'html', classes: [] }, { tag: 'body', classes: [] },
        { tag: 'div', classes: ['champ'], id: null }, { tag: 'div', classes: [k], id: null }];
      const w = gagnant(chaine, 'width');
      const etroit = w && (/^\d+(\.\d+)?%$/.test(w.val) && parseFloat(w.val) < 100);
      dit(!etroit, `« .${k} » ne réduit pas le conteneur à une colonne de tableau`,
        etroit ? `🔴 « ${w.sel} » l'emporte avec width:${w.val} — c'est ce qui a roulé les six boutons de prix en pastilles rondes le 26/08`
          : w ? `width:${w.val}` : 'aucune largeur imposée');
    }
    // et la grille elle-même doit être peinte
    const peint = REGLES_204.some((r) => r.sel.split(',').some((s) => s.trim() === '#caisse-choix'));
    dit(peint, 'la grille des prix est peinte dans la feuille servie (`#caisse-choix`)',
      peint ? null : '🔴 aucune règle : un conteneur non peint hérite de ce qu\'il trouve — et il avait trouvé `.rang`');
    // ⭐ « $36.00 / mois » ne doit JAMAIS se couper : c'est la coupure en trois
    //   lignes qui rendait la pilule aussi haute que large, donc ronde.
    const BTN = [{ tag: 'html', classes: [] }, { tag: 'body', classes: [] },
      { tag: 'div', classes: [], id: 'caisse-choix' },
      { tag: 'div', classes: classes, id: null },
      { tag: 'button', classes: ['btn', 'btn--principal', 'btn--sm'], id: null }];
    const ws = gagnant(BTN, 'white-space');
    dit(Boolean(ws) && ws.val === 'nowrap', 'et un prix ne peut pas se couper en trois lignes dans son bouton',
      ws && ws.val === 'nowrap' ? `« ${ws.sel} » l'emporte avec white-space:nowrap`
        : `🔴 white-space:${ws ? ws.val : '(aucune)'} — « $36.00 / mois » se casse en trois lignes et la pilule devient un disque`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑦ UNE RÈGLE EN LIGNE QUI FORCE `.f-lancer` DOIT PORTER SON PALIER
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE § NAÎT D'UN DÉFAUT VU EN PRODUCTION LE 06/09, DIX MINUTES APRÈS LE
// DÉPLOIEMENT, ET QU'AUCUN BANC N'AURAIT TROUVÉ.
// `theme.css` porte `@media (min-width:1041px){ .f-lancer,.f-pied{display:none} }`
// — le déclencheur de la FEUILLE n'a rien à faire en PC, où le rail est déplié.
// Mais `Base.astro` pose, en ligne dans l'en-tête :
//     html[data-membre] .f-lancer[data-membre][hidden] { display:block !important }
// pour le révéler au MEMBRE (il est `hidden` pour l'anonyme). Sans palier, ce
// `!important` gagne À TOUTES LES LARGEURS : mesuré à 1 440 px, `.f-lancer`
// sortait en `display:block`, 248 × 44 px, au-dessus d'un rail déjà ouvert.
//
// ⭐⭐⭐ *« LA RÈGLE EST LÀ » NE VEUT PAS DIRE « LA RÈGLE GAGNE ».* Les deux
// existaient, toutes deux justes prises séparément, et c'est la CASCADE qui
// tranchait. Aucun banc du dépôt ne compare deux feuilles entre elles, et le
// rendu n'avait jamais été ouvert — il a fallu regarder la page servie.
// ⛔ Et on ne peut pas battre un `!important` de l'en-tête depuis `theme.css` :
// la seule correction est de BORNER la règle en ligne au même palier.
{
  console.log('\n── ⑦ le palier des règles en ligne de `.f-lancer` ──');
  const gab = 'src/layouts/Base.astro';
  if (!existsSync(gab)) {
    console.log('  --  SANS OBJET — ce site n\'a pas ce gabarit.');
  } else {
    const src = readFileSync(gab, 'utf8');
    // ⭐ On ne lit QUE les blocs `<style>` : une règle citée dans un commentaire
    //   n'est pas servie, et cinq fois dans ce dépôt un banc s'est fait avoir
    //   par la prose qui documentait le sujet.
    const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    const lignes = styles.split('\n').filter((l) => l.includes('.f-lancer'));
    dit(lignes.length > 0,
      `l'en-tête porte ${lignes.length} règle(s) en ligne sur \`.f-lancer\` — sinon ce § est sans objet`,
      '⛔ aucune : la règle a disparu, ou ce § ne regarde plus au bon endroit');
    const nues = lignes.filter((l) => /display\s*:/.test(l) && !/@media/.test(l));
    dit(nues.length === 0,
      'chacune est bornée par un `@media` — elle ne peut pas gagner en PC',
      `⛔ ${nues.length} règle(s) sans palier : un \`!important\` de l'en-tête bat le`
      + ' `@media (min-width:1041px)` du thème, et le déclencheur de la feuille'
      + ' reste affiché au-dessus d\'un rail déjà ouvert');
    // 🔑 ET LE PALIER EST LE COMPLÉMENT EXACT DE CELUI DU THÈME : 1040 / 1041.
    //   ⛔ Deux paliers voisins mais différents laisseraient une bande de
    //   largeurs où NI l'une NI l'autre ne s'applique — le trou qu'on ne voit
    //   qu'à une largeur précise.
    const bornees = lignes.filter((l) => /@media/.test(l));
    for (const l of bornees) {
      const mx = /max-width\s*:\s*(\d+)px/.exec(l);
      dit(!!mx && mx[1] === '1040',
        `le palier de la règle en ligne est \`max-width:1040px\` (complément de 1041)`,
        `⛔ ${mx ? mx[1] + 'px' : 'aucun max-width'} : une bande de largeurs sans règle`);
    }
  }
}


// ════════════════════════════════════════════════════════════════════════════
// 🔴🔴 §K — DEUX `:root` NE DOIVENT JAMAIS SE CONTREDIRE  (lot K — 08/09/2026)
// ════════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI CE § EXISTE, ET IL A FAILLI ME COÛTER LE LOT ENTIER.
// `themes/vitrine/theme.css` déclare `:root` DEUX fois : un bloc lisible et
// commenté en tête, et un bloc MINIFIÉ en fin de fichier qui en redéfinit 101
// jetons. Le second gagne. Le 08/09, en alignant les jetons sur la maquette v5,
// j'ai commencé par éditer le bloc lisible — un changement PARFAITEMENT
// INVISIBLE en production, que ni le build, ni aucun banc, ni une relecture du
// diff n'auraient signalé. « LÀ ? » n'est pas « GAGNE ? ».
//
// ⛔ CE § N'INTERDIT PAS LE DOUBLON. Le supprimer serait le bon geste, mais
// c'est un autre lot : le bloc minifié fige aussi `--surface`, `--text`,
// `--muted` et les 8 alias du manifeste, donc le retirer REBRANCHE le thème sur
// `identity.palette` — mesuré identique en valeur au 08/09, mais c'est un
// changement de MÉCANISME, pas de couleur. Ce § se contente de rendre la
// divergence IMPOSSIBLE À NE PAS VOIR.
//
// ⛔ IL LIT LA FEUILLE SERVIE, pas la source : c'est ce qu'on SERT qui décide.
{
  // Les blocs `:root` NUS uniquement — `:root[data-theme]`, `:root .x` ou
  // `[data-theme="jour"]` sont d'autres sélecteurs, avec d'autres spécificités,
  // et il est parfaitement légitime qu'ils divergent.
  const sansCommentaires = texteFeuilleBrut.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocs = [];
  const re = /(^|[};])\s*:root\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(sansCommentaires)) !== null) blocs.push(m[2]);

  const jetonsDe = (txt) => {
    const d = new Map();
    for (const j of txt.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)) {
      d.set(j[1], j[2].split(/\s+/).join(' ').trim());
    }
    return d;
  };
  const tables = blocs.map(jetonsDe);

  // ⭐⭐ LA CONTRE-ÉPREUVE PORTE SUR LE PARSEUR, PAS SUR LA RICHESSE DU THÈME.
  // Première version de ce §, le 08/09 : « au moins 2 blocs et 50 jetons, sinon
  // rc=2 ». Elle a rougi sur `encyclopedie` — 2 blocs, 20 jetons — un thème
  // parfaitement sain. ⛔ UN NOMBRE MAGIQUE NE MESURE PAS CE QU'IL PRÉTEND : il
  // mesurait « vitrine », et appelait « cassé » tout ce qui n'est pas vitrine.
  // C'est mot pour mot la leçon écrite en tête de ce fichier, réapprise le jour
  // même. Le bon garde ne demande pas au thème d'être gros : il demande au
  // PARSEUR de savoir trouver ce qu'il cherche, sur une chaîne dont on connaît
  // la réponse.
  const essai = jetonsDe('--a:#111;--b: 2px ;--c:var(--a)');
  const parseurOk = essai.size === 3 && essai.get('--a') === '#111'
    && essai.get('--b') === '2px' && essai.get('--c') === 'var(--a)';
  if (!parseurOk) {
    console.error('\n❌ §K — le parseur de jetons échoue sur une chaîne témoin dont on connaît'
      + ` la réponse (lu ${essai.size} jeton(s) au lieu de 3). Il ne prouve rien.`);
    process.exit(2);
  }
  // Et il doit avoir vu quelque chose de RÉEL : une feuille sans aucun `:root`
  // ni aucun jeton n'est pas un thème, c'est une feuille qu'on n'a pas lue.
  const totalJetons = tables.reduce((n, t) => n + t.size, 0);
  if (blocs.length === 0 || totalJetons === 0) {
    console.error(`\n❌ §K n'a trouvé aucun \`:root\` (${blocs.length}) ou aucun jeton (${totalJetons})`
      + ' dans la feuille SERVIE — elle a changé de forme, ou ce § lit au mauvais endroit.');
    process.exit(2);
  }
  // ⛔ UN SEUL BLOC : il n'y a rien à comparer. On le DIT — « rien à comparer »
  // et « comparé, tout va bien » se ressemblent dans un vert, et sont l'inverse
  // l'un de l'autre.
  if (blocs.length < 2) {
    console.log(`\n  --  §K SANS OBJET — un seul bloc \`:root\` servi (${totalJetons} jetons) :`
      + ' aucun doublon ne peut se contredire ici.');
  }

  const divergences = [];
  for (let a = 0; a < tables.length; a += 1) {
    for (let b = a + 1; b < tables.length; b += 1) {
      for (const [k, va] of tables[a]) {
        const vb = tables[b].get(k);
        // ⚠️ Une valeur qui référence une AUTRE variable n'est pas une
        // contradiction : `--nuit: var(--bg)` puis `--nuit: #1A1A1A` est
        // précisément le débranchement qu'on veut voir, mais il se juge à
        // l'œil, pas au rouge — on ne compare que des valeurs LITTÉRALES.
        if (vb === undefined || va === vb) continue;
        if (va.includes('var(') || vb.includes('var(')) continue;
        divergences.push(`${k} : bloc ${a + 1} dit « ${va} », bloc ${b + 1} dit « ${vb} » (c'est le ${b + 1}ᵉ qui gagne)`);
      }
    }
  }

  dit(divergences.length === 0,
    `§K — ${blocs.length} blocs \`:root\` servis, ${totalJetons} jetons lus : aucun ne se contredit`,
    divergences.length === 0 ? null
      : `⛔ ${divergences.length} jeton(s) déclarés deux fois avec des valeurs DIFFÉRENTES.`
        + ' Le dernier bloc gagne, donc une édition du premier est invisible en production :\n      '
        + divergences.slice(0, 12).join('\n      ')
        + (divergences.length > 12 ? `\n      … et ${divergences.length - 12} autre(s)` : ''));
}


// ════════════════════════════════════════════════════════════════════════════
// 🔴 §K-bis — DEUX MOITIÉS D'UNE MÊME DÉCISION  (lot K — 08/09/2026)
// ════════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI. Le lot K refait deux objets, et CHACUN se décide en DEUX
// endroits qui doivent s'accorder. Injection faite le 08/09 : le bloc de
// chiffres remis en quatre cartes séparées — les 1 745 contrôles des deux
// chaînes sont restés VERTS. *Un banc ne trouve rien hors de la population
// qu'il s'est donnée*, et aucune population n'incluait la structure du thème.
//
// ⛔ CE § NE FIGE PAS LES PIXELS, ET C'EST DÉLIBÉRÉ. Un banc écrit contre UNE
// faute juge « tout ce qui n'est pas l'état sain » comme cette faute-là : il
// finit par s'opposer aux corrections (lot I, `test:projection`). Il ne dit
// donc pas « gap:1px » ni « radius:6px » — il dit que les deux moitiés d'une
// même décision ne doivent pas se contredire. Preda peut revenir à des cartes
// séparées demain : ce § restera vert, tant que les deux moitiés bougent
// ensemble.
{
  const re1 = /(^|[};])\s*\.stats\s*\{([^}]*)\}/.exec(texteFeuilleBrut.replace(/\/\*[\s\S]*?\*\//g, ''));
  const re2 = /(^|[};])\s*\.stat\s*\{([^}]*)\}/.exec(texteFeuilleBrut.replace(/\/\*[\s\S]*?\*\//g, ''));

  if (!re1 || !re2) {
    console.log('\n  --  §K-bis SANS OBJET — ce thème ne déclare pas `.stats`/`.stat`'
      + ` (${re1 ? '' : '.stats absent'} ${re2 ? '' : '.stat absent'}).`);
  } else {
    const conteneur = re1[2];
    const cellule = re2[2];
    // La GOUTTIÈRE d'un pixel n'est un filet que si le conteneur peint le fond
    // qu'elle laisse voir. Une gouttière fine SANS fond ne dessine rien ; une
    // cellule qui garde sa bordure PAR-DESSUS le filet en fait deux.
    const gap = /(?:^|;)\s*gap\s*:\s*([^;]+)/.exec(conteneur);
    const px = gap ? parseFloat(gap[1]) : NaN;
    const filet = Number.isFinite(px) && px <= 2;
    const fondConteneur = /(?:^|;)\s*background\s*:/.test(conteneur);
    // ⛔ « IL Y A UN `border:` » N'EST PAS « IL Y A UNE BORDURE ». Première
    // version de ce §, le 08/09 : elle a rougi sur `encyclopedie`, qui écrit
    // `border:0` — c'est-à-dire AUCUNE bordure, et ce thème faisait déjà
    // exactement ce que la maquette v5 demande. Un motif qui accepte la
    // PRÉSENCE ne mesure pas ce qu'il nomme : on lit la VALEUR.
    const bord = /(?:^|;)\s*border\s*:\s*([^;]+)/.exec(cellule);
    const bordCellule = !!bord
      && !/^\s*(0\w*|none)\s*$/.test(bord[1])
      && !/(^|\s)none(\s|$)/.test(bord[1])
      && parseFloat(bord[1]) !== 0;

    // ⭐ CONTRE-ÉPREUVE : ces trois lectures savent-elles trouver ce qu'elles
    // cherchent ? On les rejoue sur une déclaration dont on connaît la réponse.
    const t = 'display:grid;gap:1px;background:var(--rule);border:1px solid var(--rule)';
    const okLecture = /(?:^|;)\s*gap\s*:\s*([^;]+)/.exec(t)
      && parseFloat(/(?:^|;)\s*gap\s*:\s*([^;]+)/.exec(t)[1]) === 1
      && /(?:^|;)\s*background\s*:/.test(t) && /(?:^|;)\s*border\s*:/.test(t)
      && !/(?:^|;)\s*border\s*:/.test('background:var(--surface);padding:12px 15px')
      // …et elle doit savoir que `border:0` n'est PAS une bordure :
      && parseFloat(/(?:^|;)\s*border\s*:\s*([^;]+)/.exec('background:var(--bg);border:0;padding:11px')[1]) === 0;
    if (!okLecture) {
      console.error('\n❌ §K-bis — ses lectures échouent sur une déclaration témoin. Il ne prouve rien.');
      process.exit(2);
    }

    dit(!filet || fondConteneur,
      `§K-bis — la gouttière du bloc de chiffres (${gap ? gap[1].trim() : '—'}) et le fond du conteneur s'accordent`,
      '⛔ une gouttière d\'un pixel SANS `background` sur `.stats` : le filet ne se voit pas,'
      + ' les cellules se touchent presque et la grille a l\'air cassée');
    dit(!filet || !bordCellule,
      '§K-bis — le filet est dessiné À UN SEUL ENDROIT (le conteneur), pas deux',
      '⛔ `.stats` sépare ses cellules par un filet d\'un pixel ET `.stat` garde sa propre'
      + ' `border` : deux traits adjacents font 2px, et le rayon de chaque cellule troue le filet');
    dit(filet || !fondConteneur || bordCellule,
      '§K-bis — cartes séparées : chaque cellule porte bien son propre cadre',
      '⛔ `.stats` peint un fond mais espace ses cellules de plus de 2px, et `.stat` n\'a pas'
      + ' de bordure : le fond du conteneur apparaît en larges bandes entre des cartes sans cadre');

    // La CARTOUCHE se décide aussi en deux : POSÉE (rayon + marge sur 4 côtés)
    // ou SOUDÉE (rayon 0 + `margin-top:auto`). Une moitié de chaque donne une
    // pastille arrondie collée au bas — l'état que personne n'a choisi.
    const rc = /(^|[};])\s*\.cartouche\s*\{([^}]*)\}/.exec(texteFeuilleBrut.replace(/\/\*[\s\S]*?\*\//g, ''));
    if (rc) {
      const c = rc[2];
      const rayon = /(?:^|;)\s*border-radius\s*:\s*([^;]+)/.exec(c);
      const arrondie = !!rayon && parseFloat(rayon[1]) > 0;
      const soudee = /(?:^|;)\s*margin-top\s*:\s*auto/.test(c);
      dit(!(arrondie && soudee),
        `§K-bis — la cartouche est cohérente : ${arrondie ? 'POSÉE (rayon ' + rayon[1].trim() + ')' : 'SOUDÉE au socle'}`,
        '⛔ elle est à la fois arrondie et collée en bas (`margin-top:auto`) : une pastille'
        + ' dont deux coins ronds tombent sur le bord de la carte — ni posée, ni soudée');
    }
  }
}


// ════════════════════════════════════════════════════════════════════════════
// 🔴🔴 §L — UN JETON BRANCHÉ NE SE FAIT PAS RE-FIGER  (lot L — 08/09/2026)
// ════════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI, ET C'EST LA SUITE EXACTE DU §K. Le §K attrape deux `:root`
// qui se CONTREDISENT — deux valeurs littérales différentes. Il laisse passer,
// délibérément, le cas où l'un dit `var(--danger)` et l'autre `#F08A9B` : ce
// n'est pas une contradiction de couleur, les deux peuvent valoir la même
// chose. C'est pourtant le défaut le plus coûteux des deux, parce qu'il ne se
// voit JAMAIS : le thème cesse d'obéir au manifeste, la couleur ne bouge pas,
// et le jour où quelqu'un change `identity.palette`, rien ne se passe.
// C'était l'état de `themes/vitrine` jusqu'au lot L : huit jetons branchés sur
// la palette, et huit valeurs en dur écrites juste après.
//
// ⛔ CE QUE CE § NE DIT PAS. Une SECTION qui pose sa propre couleur
// (`[data-sect="comics"]{--sect-a:#3EC875}`) ne re-fige rien : elle spécialise,
// c'est son rôle. On ne compare donc que des `:root` entre eux — même portée,
// même poids, seul l'ordre décide. Les jetons CALCULÉS sont l'exception traitée
// en §L-ter : un `color-mix` qui suit déjà `--sect-a` n'a aucune raison d'être
// recopié à la main quelque part.
{
  const decls = (txt) => {
    // découpe « a:1;b:calc(2;3) » en déclarations, sans casser sur les `;`
    // internes aux parenthèses. Un `split(';')` naïf coupe dans `color-mix(…)`.
    const out = []; let cur = ''; let prof = 0;
    for (const c of txt) {
      if (c === '(') prof += 1;
      else if (c === ')') prof -= 1;
      if (c === ';' && prof === 0) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out.map((d) => d.trim()).filter(Boolean);
  };
  // ⭐⭐ CONTRE-ÉPREUVE DU DÉCOUPEUR, avant toute accusation : sait-il trouver
  // ce qu'il cherche ? Une regex ou un split qui rend la même réponse pour deux
  // états opposés est le mensonge d'instrument le plus cher de ce dépôt.
  const t = decls('color:var(--a);background:color-mix(in srgb,var(--b) 12%,transparent);x:1');
  if (t.length !== 3 || t[1] !== 'background:color-mix(in srgb,var(--b) 12%,transparent)') {
    console.error('\n❌ §L — son découpeur de déclarations échoue sur une chaîne témoin'
      + ` dont on connaît la réponse (${t.length} morceau(x), attendu 3). Il ne prouve rien.`);
    process.exit(2);
  }

  const blocsRoot = [...feuilleSansProse.matchAll(/(^|[};])\s*:root\s*\{([^}]*)\}/g)].map((m) => m[2]);

  // ── §L — un `:root` postérieur ne re-fige pas un jeton branché ────────────
  const branche = new Map();     // jeton -> l'expression qui le branche
  const refiges = [];
  for (const bloc of blocsRoot) {
    for (const d of decls(bloc)) {
      const m = /^(--[a-z0-9-]+)\s*:\s*(.+)$/s.exec(d);
      if (!m) continue;
      const [, jeton, valeur] = m;
      const calcule = /var\(|color-mix\(|calc\(/.test(valeur);
      if (calcule) { branche.set(jeton, valeur.trim()); continue; }
      if (branche.has(jeton)) {
        refiges.push(`${jeton} : branché sur « ${branche.get(jeton)} », puis re-figé en dur à « ${valeur.trim()} » plus bas`);
        branche.delete(jeton);
      }
    }
  }
  if (branche.size === 0 && refiges.length === 0) {
    console.log('\n  --  §L SANS OBJET — aucun jeton de ce thème n\'est branché sur une autre'
      + ' variable dans `:root` : il n\'y a rien qui puisse être re-figé.');
  } else {
    dit(refiges.length === 0,
      `§L — ${branche.size} jeton(s) branché(s) dans \`:root\`, aucun re-figé en dur ensuite`,
      refiges.length === 0 ? null
        : `⛔ ${refiges.length} jeton(s) débranché(s) du manifeste. La couleur ne change pas — c'est`
          + ' précisément pourquoi personne ne le voit :\n      ' + refiges.join('\n      '));
  }

  // ── §L-bis — l'APLAT et l'ENCRE ne se croisent pas ────────────────────────
  // Convention du thème : `--x` est l'aplat, `--x-txt` son encre. Le lot L les
  // sépare parce qu'AUCUNE des deux valeurs ne fait les deux métiers : l'aplat
  // porte une encre noire à 5,36:1, l'encre se lit à 7,30:1 sur la nuit, et
  // l'inverse tombe à 2,38:1. Le banc ne juge PAS les couleurs — il juge que
  // chacune reste dans son métier. ⛔ Aucun nom en dur : on cherche la PAIRE.
  const paires = [...feuilleSansProse.matchAll(/(--[a-z0-9-]+)-txt\s*:/g)]
    .map((m) => m[1]).filter((base, i, a) => a.indexOf(base) === i)
    .filter((base) => new RegExp(`${base}\\s*:`).test(feuilleSansProse));
  if (paires.length === 0) {
    console.log('\n  --  §L-bis SANS OBJET — ce thème ne déclare aucune paire `--x` / `--x-txt`.');
  } else {
    const ENCRE = /^(color|stroke|fill|-webkit-text-fill-color)$/;
    const APLAT = /^(background|background-color|border|border-color|border-.*-color|box-shadow|outline-color)$/;
    const croises = [];
    for (const d of decls(feuilleSansProse.replace(/\{|\}/g, ';'))) {
      const m = /^([a-z-]+)\s*:\s*(.+)$/s.exec(d);
      if (!m) continue;
      const [, prop, val] = m;
      for (const base of paires) {
        const aplatUtilise = new RegExp(`var\\(\\s*${base}\\s*[,)]`).test(val);
        const encreUtilisee = new RegExp(`var\\(\\s*${base}-txt\\s*[,)]`).test(val);
        if (ENCRE.test(prop) && aplatUtilise) croises.push(`${prop}: var(${base}) — c'est l'APLAT posé en encre`);
        if (APLAT.test(prop) && encreUtilisee) croises.push(`${prop}: var(${base}-txt) — c'est l'ENCRE étalée en aplat`);
      }
    }
    dit(croises.length === 0,
      `§L-bis — ${paires.length} paire(s) aplat/encre (${paires.join(', ')}) : chacune reste dans son métier`,
      croises.length === 0 ? null
        : `⛔ ${croises.length} croisement(s) :\n      ` + croises.slice(0, 10).join('\n      '));
  }

  // ── §L-ter — un jeton CALCULÉ ne se recopie pas en dur ailleurs ───────────
  const calcules = [...branche.entries()].filter(([, v]) => /color-mix\(|calc\(/.test(v)).map(([k]) => k);
  if (calcules.length === 0) {
    console.log('\n  --  §L-ter SANS OBJET — aucun jeton calculé dans `:root`.');
  } else {
    const recopies = [];
    for (const m of feuilleSansProse.matchAll(/([^{};]*\[data-[^{}]*)\{([^}]*)\}/g)) {
      for (const d of decls(m[2])) {
        const j = /^(--[a-z0-9-]+)\s*:\s*(.+)$/s.exec(d);
        if (!j || !calcules.includes(j[1])) continue;
        if (/var\(|color-mix\(|calc\(/.test(j[2])) continue;
        recopies.push(`${j[1]} = « ${j[2].trim()} » dans « ${m[1].trim().slice(0, 46)} »`);
      }
    }
    dit(recopies.length === 0,
      `§L-ter — ${calcules.length} jeton(s) calculé(s) (${calcules.join(', ')}) : aucune recopie en dur`,
      recopies.length === 0 ? null
        : `⛔ ${recopies.length} recopie(s) — le calcul suit déjà la couleur de section, la valeur en dur`
          + ' la fige et diverge au premier changement :\n      ' + recopies.slice(0, 10).join('\n      '));
  }
}

console.log(ko === 0
  ? `\n✅ une feuille de ${octets.length} o pour ${pages.length} pages, rien de recopié,`
    + ` et le JS en ligne sous son cliquet (${moyenneJs} o/page)\n`
  : `\n🔴 ${ko} contrôle(s) en échec\n`);
process.exit(ko === 0 ? 0 : 1);
