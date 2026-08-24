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

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
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
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LOT 104 — CE BANC NE CHERCHAIT QUE DANS `dist/`, ET C'ETAIT SUFFISANT
//    JUSQU'A CE QU'UNE ENTREE DE MENU DEVIENNE UNE ROUTE DYNAMIQUE.
// ═══════════════════════════════════════════════════════════════════════════
// `/market/` et `/dashboard/` sont rendues A LA DEMANDE par Node : elles
// n'existent, par construction, dans AUCUN fichier de `dist/`. Le banc les
// declarait donc « liens vers le vide » — un verdict FAUX sur des pages
// parfaitement servies.
//
// ⭐⭐⭐ ON CORRIGE L'INSTRUMENT, PAS LE CODE POUR LUI PLAIRE. La tentation
// etait de passer ces deux entrees a `pret: false` pour faire taire le banc :
// le menu aurait cesse d'emettre les liens, la fonctionnalite serait morte, et
// tout aurait ete vert. C'est la faute que ce depot nomme depuis le 07/08.
//
// ⭐⭐ ET IL SORT SUR UNE DECLARATION, PAS SUR L'ETAT D'UN DOSSIER : la liste
// des routes dynamiques est lue dans `ROUTES_COMPTE`, la SEULE source qui
// decide de ce qui est rendu a la demande — exactement ce que fait deja
// `test:nginx`. ⛔ Une liste recopiee ici aurait diverge au premier ajout, et
// la divergence aurait rendu ce banc vert pour une mauvaise raison.
// ⚠️ UN OUBLI DANS `ROUTES_COMPTE` RESTE DONC ATTRAPE : la page ne serait ni
// dans `dist/` (elle y serait, mais on ne l'y cherche plus... si), ni dans la
// liste — non : elle SERAIT dans dist/, pre-generee, donc `existePage()` dirait
// vrai. C'est `test:fuite` et `test:nginx` qui couvrent ce cas-la, pas celui-ci.
const ROUTES_MJS_ROUTES = new URL('../lib/astro_routes_compte.mjs', import.meta.url).pathname;
const routesDynamiques = (() => {
  try {
    const src = readFileSync(ROUTES_MJS_ROUTES, 'utf8');
    const bloc = src.match(/const\s+ROUTES_COMPTE\s*=\s*\[([\s\S]*?)\];/);
    if (!bloc) return null;                 // ⭐ `null` = « je n'ai pas pu lire »,
    const out = new Set();                  //    surtout pas `[]` = « il n'y en a pas ».
    for (const f of bloc[1].match(/'[^']+\.(?:astro|js|ts)'/g) || []) {
      let u = f.slice(1, -1).replace(/^.*?pages\//, '/').replace(/\/index\.(astro|js|ts)$/, '/');
      u = u.replace(/\.(astro|js|ts)$/, '');
      // `[locale]` -> n'importe quelle langue : on garde la forme sans prefixe,
      // et la comparaison ci-dessous retire le prefixe de langue de la cible.
      if (u.startsWith('/[locale]/')) u = u.slice('/[locale]'.length);
      out.add(u);
    }
    return out;
  } catch (e) { return null; }
})();
// ⭐ L'INSTRUMENT SE DECLARE. Sans cette liste, l'assouplissement ci-dessous
// n'aurait aucun effet et le banc redeviendrait faux — en silence, et dans le
// sens qui fait perdre du temps plutot que dans celui qui laisse passer.
dit(routesDynamiques !== null && routesDynamiques.size >= 5,
  `${routesDynamiques ? routesDynamiques.size : 0} route(s) dynamique(s) lue(s) dans ROUTES_COMPTE`,
  routesDynamiques === null ? 'ILLISIBLE — ce banc va reclamer des fichiers pour des routes servies par Node'
    : (routesDynamiques.size >= 5 ? null : 'TROP PEU — la liste a-t-elle change de forme ?'));

// Une cible localisee (`/fr/market/`) rendue a la demande ? On compare sur la
// forme sans prefixe de langue.
const estDynamique = (cible) => {
  if (!routesDynamiques) return false;
  const nu = cible.replace(/^\/[a-z]{2}(-[a-z]+)?\//, '/');
  return routesDynamiques.has(nu) || routesDynamiques.has(cible);
};

const nav = Array.isArray(m.nav) ? m.nav : [];
if (nav.length) {
  console.log(`\n2 bis. Le menu declare par le manifeste`);
  const prets = nav.filter((e) => e && e.pret);
  const attente = nav.filter((e) => e && !e.pret);
  const casses = [];
  const dynamiquesVues = [];
  for (const e of prets) {
    for (const l of langsAccueil) {
      const cible = e.href === '/' ? localize(l, '/') : localize(l, e.href);
      // Le blog n'est emis que dans les langues qui ont un article : c'est
      // voulu, et Base.astro porte la meme condition. On ne le reclame donc
      // que la ou il existe — sinon ce banc crierait sur un comportement juste.
      if (e.cle === 'nav.blog' && !langsBlog.includes(l)) continue;
      // 🔴 LOT 104 — une route rendue A LA DEMANDE n'a pas de fichier, et c'est
      // sa definition, pas un manque. On ne lui reclame donc pas de page.
      if (estDynamique(cible)) { dynamiquesVues.push(cible); continue; }
      if (!existePage(cible)) casses.push(`${cible}  (${e.cle})`);
    }
  }
  dit(casses.length === 0, `${prets.length} entree(s) « pret: true » ont toutes leur page`,
    casses.length === 0
      ? `dans ${langsAccueil.length} langue(s)`
        + (dynamiquesVues.length ? ` · ${dynamiquesVues.length} cible(s) rendue(s) a la demande, non reclamee(s) : ${[...new Set(dynamiquesVues.map((c) => c.replace(/^\/[a-z]{2}\//, '/')))].join(', ')}` : '')
      : `${casses.length} LIEN(S) VERS LE VIDE`);
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

// ═══════════════════════════════════════════════════════════════════════════
// 3 bis. LE BLOG EN LANGUE NON-PIVOT : *ATTEIGNABLE*, PAS SEULEMENT PRODUIT
// ═══════════════════════════════════════════════════════════════════════════
// LOT 162, mesure du 24/08/2026 sur la PRODUCTION : `/fr/blog/` repondait 200
// et listait bien l'article francais — et CHACUN de ses liens pointait vers
// `/blog/…`, c'est-a-dire vers l'anglais. La page francaise de l'article
// existait dans `dist/`, servie par nginx, et RIEN sur le site n'y menait. Son
// `hreflang="fr"` annoncait meme l'adresse anglaise, et le `<head>` francais
// annoncait le flux anglais alors que `/fr/rss.xml` etait construit.
//
// ⭐⭐⭐ « LA PAGE EXISTE-T-ELLE ? » ET « Y MENE-T-ON ? » SONT DEUX QUESTIONS.
// La section 2 posait la premiere, et elle etait verte : la page etait bien
// produite. Personne ne posait la seconde. Un cul-de-sac ne se voit ni au
// build, ni dans un compte de pages : il se voit en suivant un lien.
//
// ⛔⛔ LES CHEMINS SONT ECRITS A LA MAIN ICI, JAMAIS PASSES A `localize()`.
//    C'est le piege que ce fichier documente plus haut, a la lettre :
//    `localize()` etait la fonction qui PORTAIT le defaut. Une attente
//    construite avec elle aurait retreci avec elle — elle aurait demande
//    « /blog/ existe-t-il ? », ce qui est toujours vrai — et ce banc serait
//    reste vert sur la panne exacte qu'il est cense attraper.
const langsBlogHorsPivot = langsBlog.filter((l) => l !== def);
if (langsBlogHorsPivot.length) {
  console.log(`\n3 bis. Le blog en ${langsBlogHorsPivot.join(', ')} est ATTEIGNABLE`);
  for (const l of langsBlogHorsPivot) {
    const index = join(DIST, l, 'blog', 'index.html');
    if (!existsSync(index)) {
      dit(false, `/${l}/blog/ est produite`, 'page absente de dist/');
      continue;
    }
    const html = readFileSync(index, 'utf8');
    const versLaLangue = (html.match(new RegExp(`href="/${l}/blog/[^"]+"`, 'g')) || []);
    const versLePivot = (html.match(/href="\/blog\/[^"]*"/g) || []);
    dit(versLaLangue.length > 0, `/${l}/blog/ mene a au moins un article en ${l}`,
      versLaLangue.length ? `${versLaLangue.length} lien(s)` :
        `aucun lien /${l}/blog/… : l'index est un cul-de-sac`);
    dit(versLePivot.length === 0, `/${l}/blog/ ne renvoie pas le lecteur au pivot`,
      versLePivot.length ? `${versLePivot.length} lien(s) vers ${[...new Set(versLePivot)].slice(0, 3).join(' ')}`
        : 'aucun lien relatif vers /blog/…');

    // Le flux RSS annonce dans le <head> doit etre CELUI DE CETTE LANGUE :
    // `[locale]/rss.xml` est construit sur les langues du blog, comme l'index.
    const fluxDeclare = (html.match(/type="application\/rss\+xml"[^>]*href="([^"]+)"/) || [])[1] || '';
    if (existsSync(join(DIST, l, 'rss.xml'))) {
      dit(fluxDeclare.includes(`/${l}/rss.xml`), `/${l}/blog/ annonce le flux ${l}`,
        fluxDeclare || 'aucun flux declare');
    }

    // Et l'article lui-meme : son `hreflang` de CETTE langue doit porter SON
    // adresse. Un hreflang qui annonce l'adresse d'une autre langue dit a
    // Google que les deux pages sont la meme — la traduction disparait.
    // ⚠️ ON CHOISIT UN ARTICLE, PAS N'IMPORTE QUEL LIEN. L'index se cite
    //    lui-meme et cite ses etiquettes ; ni l'un ni l'autre ne porte de
    //    `hreflang` d'article, et le banc echouait sur une page parfaitement
    //    saine — un rouge pour une mauvaise raison coute autant qu'un vert.
    const premier = versLaLangue
      .map((h) => h.replace(`href="/${l}/`, '').replace(/"$/, ''))
      .find((u) => /^blog\/[^/]+\/$/.test(u) && !u.startsWith('blog/tag/')) || '';
    const fiche = premier ? join(DIST, l, premier, 'index.html') : '';
    if (fiche && existsSync(fiche)) {
      const h = readFileSync(fiche, 'utf8');
      const alt = (h.match(new RegExp(`hreflang="${l}" href="([^"]+)"`)) || [])[1] || '';
      dit(alt.includes(`/${l}/blog/`), `l'article ${l} declare SON adresse en hreflang="${l}"`,
        alt || `aucun hreflang="${l}"`);
    }
  }
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
