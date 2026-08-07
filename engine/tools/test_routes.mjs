// Preuve que les pages que le manifeste PROMET sont bel et bien PRODUITES.
//
//     SITE=veveprice npm run test:routes    (APRES `npm run build`)
//
// ═══════════════════════════════════════════════════════════════════════════
// TROIS PANNES DE LA MEME FAMILLE, LE MEME JOUR — 03/08/2026.
// ═══════════════════════════════════════════════════════════════════════════
//  1. Lot 34 : 6 fichiers a supprimer a la main ne l'ont pas ete. 24 pages
//     `/rarity/` sont parties en ligne avec `<h1>rarities.title</h1>`.
//     -> ferme par `test:cles` (lot 35).
//  2. `src/pages/index.astro` est parti avec les 6. LA PAGE D'ACCUEIL.
//     Build vert, 438 pages, aucune erreur. Le garde-fou du Dockerfile
//     verifie `dist/index.html` en mode STATIC seulement : veveprice, en mode
//     server, aurait deploye un site SANS ACCUEIL.
//  3. Lot 37 : ajouter `editorial: {pages: [blog]}` au manifeste a fait passer
//     le build de 439 a 424 pages. Disparues : /fr/, /es/, /de/ et leurs 12
//     pages legales. Cause : `siteEditorial()` devient vrai, mais `blog`
//     n'est pas dans `SECTIONS`, donc ZERO section mesurable, donc seule la
//     langue pivot survivait.
//
// 🔴 LES TROIS ONT PASSE TOUS LES BANCS. Dans les trois cas le build a dit
// « Complete! » et les seize controles etaient verts. Le seul signe, pour la
// 2e et la 3e, etait un COMPTE DE PAGES qui bougeait — 438 au lieu de 439,
// 424 au lieu de 439. Deux fois, c'est un humain qui a compare a la main.
//
// ⭐⭐ « QU'EST-CE QUE LA PAGE DIT ? » (test:cles) ET « LA PAGE EXISTE-T-ELLE ? »
// SONT DEUX QUESTIONS. Aucun banc ne posait la seconde.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE PRINCIPE : L'ATTENTE SE DEDUIT DU MANIFESTE, ELLE NE S'ECRIT PAS.
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ Une liste de routes codee en dur ici deviendrait fausse au premier site du
//    reseau qui n'a pas /market/ — et un banc faux est retire, pas repare.
//    C'est la lecon du 31/07 : `css-mort` reclamait a `encyclopedie` le
//    vocabulaire de la vitrine, 172 griefs, et le controle a cesse d'etre lu.
// ⭐ On lit donc : `languages.active`, `content.data_modules` (priceEnabled),
//    `editorial.pages`, et les langues REELLES du blog. Chaque attente porte la
//    raison pour laquelle elle est attendue — un echec doit se lire sans
//    ouvrir le code.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { manifest } = await import('../lib/manifest.mjs');
const { locales, localize } = await import('../lib/i18n.mjs');
const { priceEnabled } = await import('../lib/features.mjs');
const { languesBlog, blogEnabled } = await import('../lib/blog.mjs');
const { languesDuSite } = await import('../lib/editorial_pages.mjs');

let echecs = 0;
const dit = (ok, titre, detail) => {
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs++;
};

// --- Ou sont les pages ? server -> dist/client, static -> dist -------------
const DIST = ['dist/client', 'dist'].map((d) => join(RACINE, d)).find((d) => existsSync(d));
if (!DIST) { console.error('\n❌ aucun dist/ : lancer `npm run build` avant ce banc.'); process.exit(2); }

const compte = (d) => {
  let n = 0;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) n += compte(p);
    else if (e.endsWith('.html')) n += 1;
  }
  return n;
};
const total = compte(DIST);
// ⭐ rc=2 si on n'a rien lu. Un banc qui n'a rien inspecte n'a rien prouve, et
// son vert est le plus cher de tous. Meme dispositif que css-mort.
if (total === 0) { console.error(`\n❌ aucune page dans ${DIST}.`); process.exit(2); }

const m = manifest();
const { active, def } = locales();
const langsSite = languesDuSite();
const prix = priceEnabled();

console.log(`\n1. Le contexte, lu dans le manifeste (jamais code en dur)`);
console.log(`     site ${m.site?.domain} · langues actives ${active.join(', ')} · pivot ${def}`);
console.log(`     langues du site ${langsSite.join(', ')} · prix ${prix ? 'ON' : 'OFF'} · ${total} page(s) produites`);

// --- La construction des attentes -------------------------------------------
const attentes = [];   // { chemin, pourquoi }
const veut = (p, pourquoi) => attentes.push({ chemin: p, pourquoi });
// 🔴 LOT 101 — L'ATTENTE INVERSE. Ce banc ne savait que reclamer des pages ;
// il lui manquait de savoir en INTERDIRE. ⭐ Un arbitrage de retrait n'est
// tenu que s'il est verifie : sinon il ne survit qu'aussi longtemps que la
// memoire de celui qui l'a pris.
const interdites = [];   // { chemin, pourquoi }
const refuse = (p, pourquoi) => interdites.push({ chemin: p, pourquoi });

// ═══════════════════════════════════════════════════════════════════════════
// L'ACCUEIL — ET LE PIEGE QUE CE BANC S'ETAIT TENDU A LUI-MEME.
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 PREMIERE VERSION DE CE FICHIER : elle attendait un accueil « pour chaque
// langue de `languesDuSite()` ». Rejouee sur la panne n°3 (les 15 pages
// perdues), elle est restee VERTE.
//
// ⭐⭐⭐ PARCE QUE `languesDuSite()` EST LA FONCTION QUI PORTAIT LE DEFAUT.
// Quand elle perdait fr/es/de, l'ATTENTE DU BANC RETRECISSAIT AVEC ELLE : il
// demandait « les langues que tu rends ont-elles un accueil ? », ce qui est
// toujours vrai. Un instrument branche EN AVAL de la panne mesure la panne
// avec la panne.
// ⛔ C'est le meme defaut que le miroir perime d'`etat_reel.py` : la copie
//    qu'on interroge a vieilli avec ce qu'elle decrit.
//
// LA PARADE : l'attente vient de l'INTENTION DECLAREE, pas du calcul.
//  · SITE DE PRIX — ses pages de prix existent dans TOUTES les langues actives
//    par construction (cf. sitemap.xml.js : `langs: langsSite` pour /market/,
//    /collections/ et les fiches). Une langue active SANS accueil est donc
//    forcement une regression. On lit `languages.active` du manifeste.
//  · SITE EDITORIAL — la, le filtrage est LEGITIME et voulu : « une langue sans
//    une seule section publiable n'a pas d'accueil » (i18n, [locale]/index).
//    On lit `languesDuSite()`, et on DIT lesquelles sont ecartees, pour qu'un
//    ecart se voie au lieu de se deduire.
const langsAccueil = prix ? active : langsSite;
if (prix && langsSite.length !== active.length) {
  console.log(`     ⚠️ languesDuSite() rend ${langsSite.length} langue(s) sur ${active.length} `
    + `actives, alors que le site publie des PRIX. C'est l'anomalie du 03/08.`);
}
if (!prix) {
  const ecartees = active.filter((l) => !langsSite.includes(l));
  if (ecartees.length) {
    console.log(`     · langue(s) ecartee(s) volontairement (aucune section publiable) : ${ecartees.join(', ')}`);
  }
}
for (const l of langsAccueil) {
  veut(localize(l, '/'), prix
    ? `langue ACTIVE d'un site a prix : ses pages de prix existent, son accueil doit exister`
    : `langue retenue par languesDuSite() (site editorial)`);
}

// LES PAGES DE PRIX, si le site en publie.
if (prix) {
  for (const l of active) {
    // 🔴🔴 LOT 101 — CE BANC EXIGEAIT `/market/`. IL EXIGE MAINTENANT SON
    // ABSENCE, et ce n'est pas la meme chose que de le supprimer.
    // ⭐⭐⭐ Un banc qu'on efface parce qu'il gene ne protege plus rien ; un
    // banc qu'on RETOURNE protege la decision. Sans cette ligne, le jour ou
    // quelqu'un recree `src/pages/market.astro` — par un portage de maquette,
    // par un retour en arriere sur un lot — la page repartirait en production
    // avec ses floors, et la CI serait verte.
    refuse(localize(l, '/market/'), 'arbitrage Preda du 06/08 : le Market n\'est pas visible en public');
    veut(localize(l, '/collections/'), 'le manifeste declare data_modules (collection_index)');
  }
}

// LE BLOG, dans les langues qui ont VRAIMENT un article — pas dans celles qui
// n'en ont pas : un index d'articles vide est pire qu'une page absente.
const langsBlog = blogEnabled() ? await languesBlog() : [];
for (const l of langsBlog) veut(localize(l, '/blog/'), `${l} a au moins un article`);

// LES FICHIERS DE SERVICE. Ils ne se voient pas, donc leur disparition ne se
// voit pas non plus — jusqu'a ce que l'indexation s'arrete.
const fichiers = [
  ['/sitemap.xml', 'le plan de site — sans lui, plus rien ne se decouvre'],
  ['/robots.txt', 'sans lui, les regles d\'exploration disparaissent'],
  ['/404.html', 'la page d\'erreur'],
];

// --- Le controle -------------------------------------------------------------
const existePage = (p) => existsSync(join(DIST, p.replace(/^\//, ''), 'index.html'))
  || existsSync(join(DIST, `${p.replace(/^\//, '').replace(/\/$/, '')}.html`));

console.log(`\n2. Chaque page promise par le manifeste est PRODUITE`);
const manquantes = attentes.filter((a) => !existePage(a.chemin));
dit(manquantes.length === 0, `${attentes.length} route(s) attendue(s) presente(s)`,
  manquantes.length === 0 ? 'aucune absente' : `${manquantes.length} ABSENTE(S)`);
for (const a of manquantes) {
  console.log(`     🔴 ${a.chemin}`);
  console.log(`        attendue parce que : ${a.pourquoi}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 ter. LES PAGES QUI NE DOIVENT PAS EXISTER — lot 101
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » Celui-ci laissait
// passer la reapparition d'une page retiree sur arbitrage. Le Market a ete
// ferme parce qu'il donnait gratuitement ce que le site vend ; rien, jusqu'ici,
// n'aurait signale son retour — ni le compilateur (une page en plus n'est pas
// une erreur), ni la section 2 (elle ne sait que reclamer).
if (interdites.length) {
  console.log(`\n2 ter. Les pages RETIREES sur arbitrage ne sont pas revenues`);
  const revenues = interdites.filter((a) => existePage(a.chemin));
  dit(revenues.length === 0, `${interdites.length} route(s) interdite(s) absente(s) de dist/`,
    revenues.length === 0 ? 'aucune n\'est revenue' : `${revenues.length} REVENUE(S)`);
  for (const a of revenues) {
    console.log(`     🔴 ${a.chemin}`);
    console.log(`        cette page NE DOIT PAS etre produite : ${a.pourquoi}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 bis. LE MENU — toute entree `pret: true` DOIT avoir une page.
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ UN LIEN VERS UNE PAGE NON EMISE EST UN 404 INVISIBLE AU BUILD : c'est un
// lien, pas une route, donc aucun compilateur ne le regarde. Ce defaut a ete
// paye DEUX FOIS sur Base.astro — le blog dans les langues sans article, et
// /compte/ prefixe par `localize` qui fabriquait /fr/compte/.
// ⭐ Depuis le lot 38 le menu est une DONNEE (`nav:` du manifeste) : on peut
// donc enfin le VERIFIER, au lieu de relire le gabarit a l'oeil.
const nav = Array.isArray(m.nav) ? m.nav : [];
if (nav.length) {
  console.log(`\n2 bis. Le menu declare par le manifeste`);
  const prets = nav.filter((e) => e && e.pret);
  const attente = nav.filter((e) => e && !e.pret);
  const casses = [];
  for (const e of prets) {
    for (const l of langsAccueil) {
      const cible = e.href === '/' ? localize(l, '/') : localize(l, e.href);
      // Le blog n'est emis que dans les langues qui ont un article : c'est
      // voulu, et Base.astro porte la meme condition. On ne le reclame donc
      // que la ou il existe — sinon ce banc crierait sur un comportement juste.
      if (e.cle === 'nav.blog' && !langsBlog.includes(l)) continue;
      if (!existePage(cible)) casses.push(`${cible}  (${e.cle})`);
    }
  }
  dit(casses.length === 0, `${prets.length} entree(s) « pret: true » ont toutes leur page`,
    casses.length === 0 ? `dans ${langsAccueil.length} langue(s)` : `${casses.length} LIEN(S) VERS LE VIDE`);
  for (const c of casses) {
    console.log(`     🔴 ${c}`);
    console.log(`        le menu pointe vers une page que le build ne produit pas.`);
    console.log(`        -> soit passer l'entree a « pret: false », soit creer la route.`);
  }
  if (attente.length) {
    console.log(`     ⏳ ${attente.length} entree(s) declaree(s) mais PAS emise(s) : `
      + attente.map((e) => e.href).join(', '));
    console.log(`        (c'est un etat SAIN : l'intention est ecrite, le lien n'existe pas.)`);
  }
}

console.log(`\n3. Les fichiers de service`);
for (const [f, pourquoi] of fichiers) {
  const la = existsSync(join(DIST, f.replace(/^\//, '')));
  dit(la, `${f}`, la ? 'present' : pourquoi);
}

// --- 4. AUTO-CONTROLE ---------------------------------------------------------
// ⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » Un test incapable
// d'echouer ne prouve rien : lecon du 18/07, ou un audit avait declare
// « aucun lien casse » sur un repertoire vide.
console.log(`\n4. Auto-controle`);
dit(attentes.length >= langsSite.length,
  `l'attente n'est pas vide (${attentes.length} routes pour ${langsSite.length} langue(s))`,
  attentes.length ? 'le banc a quelque chose a verifier'
    : 'AUCUNE attente construite — ce banc serait vert sur un dist/ VIDE');
dit(!existePage('/cette-page-ne-doit-pas-exister-xyzzy/'),
  'le detecteur sait dire « absente »',
  'sinon toutes les lignes ci-dessus seraient vraies pour de mauvaises raisons');
dit(existePage(localize(def, '/')),
  `le detecteur sait dire « presente » (accueil pivot)`,
  'sinon le banc crierait sur un site parfaitement sain');

console.log(`\n${echecs === 0 ? '✅ tout est vert' : `❌ ${echecs} echec(s)`}`);
process.exit(echecs === 0 ? 0 : 1);
