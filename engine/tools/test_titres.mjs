// ⚠️ VeVePreda/veve-sites — engine/tools/test_titres.mjs   (NEUF — lot 134)
// ═══════════════════════════════════════════════════════════════════════════
// UNE PAGE, UN TITRE — le banc qui aurait attrapé SEO‑1 ET SEO‑2
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI CE BANC EXISTE, ET POURQUOI MAINTENANT. L'audit du 10/08 a
// trouvé DEUX défauts de tête dans la production, tous deux vieux de plusieurs
// lots, tous deux invisibles pour les 39 bancs du dépôt :
//   · SEO‑1 — l'accueil servait DEUX `<h1>`. Le lot 104 avait posé le tableau
//     de bord DANS l'accueil ; le lot 126 lui a donné sa page `/dashboard/` et
//     a repointé le menu — sans retirer le bloc. Google lisait donc « My
//     dashboard » comme titre principal du site, et lisait sous lui « the
//     configurable widgets are not built yet », faux depuis le lot 131.
//   · SEO‑2 — `/collections/` et `/sets/` rendaient le même `<title>`
//     (« Sets | VeVe Price »). Le même défaut avait été corrigé le 29/07 pour
//     les fiches ; il est revenu au lot 113, quand `/collections/` a changé de
//     rôle sans changer de titre.
//
// ⭐⭐ CE QUE CES DEUX DÉFAUTS ONT EN COMMUN : **rien ne casse.** Le build est
// vert, la page s'affiche, aucun banc ne tombe, et un humain ne voit rien —
// dans un cas le second `<h1>` est `hidden`, dans l'autre le titre ne s'écrit
// que dans l'onglet. C'est le profil de panne le plus cher du dépôt : celui
// qui ne se manifeste que chez le robot, c'est‑à‑dire chez le seul visiteur
// dont on ne lit jamais l'écran. ⇒ *Ce qui n'a pas de lecteur humain n'a que
// des bancs pour lecteurs.*
//
// ⛔ IL LIT `dist/`, PAS LA SOURCE, ET C'EST NON NÉGOCIABLE. Un `<h1>` peut
// venir d'un gabarit de page, d'un composant, d'un article Markdown ou d'un
// bloc conditionné — la seule question qui compte est « combien y en a‑t‑il
// dans ce qu'on SERT ? ». Un banc qui aurait relu `Home.astro` aurait vu deux
// `<h1>` et un commentaire qui explique pourquoi c'est voulu ; il aurait eu
// tort, et il aurait eu l'air d'avoir raison.
//
// ⭐⭐ LES TITRES ÉGAUX ENTRE LOCALES SONT LÉGITIMES, ET C'EST MESURÉ.
// Depuis le lot 129, `<title>`, `<meta>` et le JSON‑LD restent **anglais** :
// c'est la contrepartie explicite qui protège le cache partagé. `/blog/` et
// `/fr/blog/` portent donc le même titre **par construction**, et `hreflang`
// dit lequel est lequel. ⛔ Un banc qui les compterait en double rougirait sur
// une décision, pas sur un défaut — et il se ferait désarmer au premier lot
// pressé. On compare donc les pages **à chemin localisé égal exclu** : deux
// adresses qui ne sont pas la traduction l'une de l'autre n'ont pas le droit
// au même titre.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { localeNames, nu, t } from '../lib/i18n.mjs';
// ⭐⭐ LA FENÊTRE DES DESCRIPTIONS EXISTE DÉJÀ, ET ELLE N'AVAIT PAS DE JUGE.
// `DESC_MIN = 70` / `DESC_MAX = 160` sont écrits dans `editorial_pages.mjs`
// depuis l'audit SEO du 27/07 — mais ils n'y produisaient qu'un `console.warn`,
// et seulement pour les pages ÉDITORIALES. Les rayons, l'orientation et les
// fiches n'étaient mesurés par personne : trois descriptions sont restées sous
// 70 caractères jusqu'à l'audit du 10/08. ⛔ On ne fabrique donc PAS deux
// nouveaux nombres ici. *Un seuil recopié est un seuil qui divergera ; un
// avertissement qui n'arrête rien est un seuil qui n'existe pas.*
import { DESC_MIN, DESC_MAX } from '../lib/editorial_pages.mjs';
import { pageTitle, TITLE_BUDGET, couperMilieu, couperMots } from '../lib/seo.mjs';

const R = new URL('../..', import.meta.url).pathname;
// Deux modes, deux racines : `dist/` (static) ou `dist/client/` (server).
const DIST = existsSync(join(R, 'dist/client')) ? join(R, 'dist/client') : join(R, 'dist');

// ⭐ LES PRÉFIXES DE LOCALE SE LISENT, ILS NE S'ÉCRIVENT PAS ICI. `localeNames`
// est la liste close des codes que ce dépôt sait produire. Une locale ajoutée
// au manifeste demain est prise en compte sans toucher à ce fichier ; une
// locale écrite en dur ici serait une quatrième liste de langues, après les
// trois du lot 120. *On ne fabrique pas une source de vérité de plus.*
const LOCALES = Object.keys(localeNames);

let ko = 0;
const dit = (bon, quoi, detail) => {
  if (!bon) ko++;
  console.log(`  ${bon ? 'ok ' : 'KO '} ${quoi}${detail ? ` — ${detail}` : ''}`);
};

console.log('\n═══ LOT 134 — une page, un <h1>, un <title> ═══');

// ═══════════════════════════════════════════════════════════════════════════
// LES DEUX DÉTECTEURS, ÉCRITS UNE FOIS
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ `<h1` SUIVI D'UN ESPACE OU DE `>`, JAMAIS `<h1` SEUL : sans l'ancrage,
// un hypothétique `<h1x>` compterait. C'est le « sélecteur préfixe qui attrape
// un suffixe » du dépôt, transposé en expression régulière.
const compteH1 = (html) => (html.match(/<h1(?=[\s>])/gi) || []).length;
// ⚠️ ON PREND LE PREMIER `<title>` DU DOCUMENT, PAS TOUS : un `<title>` peut
// légitimement apparaître dans un `<svg>` (c'est son libellé accessible).
// Chercher le dernier, ou les compter, ferait rougir une icône bien faite.
// 🔴🔴 LES ENTITES HTML SE DECODENT AVANT DE COMPTER — TROISIEME DEFAUT
// D'INSTRUMENT DE CE BANC, ET LE MEME QUE `nu()` SOUS UN AUTRE COSTUME.
// Mesuré sur vevewiki : cinq descriptions de marque annoncées à 161–162
// caractères alors qu'elles en font exactement 160. La différence : `&amp;`
// occupe CINQ octets dans l'attribut et UN caractère à l'écran. Le producteur
// avait raison, l'instrument avait tort — et il aurait fait « corriger » cinq
// textes parfaitement conformes. ⛔ La réparation n'était pas de relever la
// borne à 162 pour qu'il se taise.
// ⭐⭐ *On mesure ce que le LECTEUR reçoit, jamais la sérialisation.* Les
// marqueurs i18n (invisibles, en trop) et les entités (visibles, en trop) sont
// la même faute : compter le tampon au lieu du texte.
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
const decoder = (s) => String(s)
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  // ⚠️ `&amp;` EN DERNIER, ET CE N'EST PAS UN DETAIL : le decoder en premier
  // transformerait `&amp;lt;` en `&lt;` puis en `<` — un decodage en deux
  // tours qui invente un caractere que la page ne contient pas.
  .replace(/&(lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITES[e])
  .replace(/&amp;/g, '&');
// ⭐ LE TEXTE TEL QU'ON LE LIT : sans marqueurs i18n, entites decodees, espaces
// normalisees. Une seule fonction pour le titre ET la description — deux copies
// d'une meme regle divergent, ce depot l'a paye trois fois sur des gabarits.
const texte = (s) => decoder(nu(s)).replace(/\s+/g, ' ').trim();

const titreDe = (html) => {
  const m = html.match(/<head[\s>][\s\S]*?<\/head>/i);
  const zone = m ? m[0] : html;
  const t = zone.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t ? texte(t[1]) : null;
};
// ⭐ LE CHEMIN SANS SA LOCALE. `/fr/blog/` et `/blog/` rendent tous deux
// `/blog/` : ce sont deux vues d'une même page, elles ont le droit au même
// titre. `/collections/` et `/sets/` rendent `/collections/` et `/sets/` :
// deux pages distinctes, donc deux titres exigés.
const sansLocale = (chemin) => {
  const seg = chemin.replace(/^\/+/, '').split('/');
  return LOCALES.includes(seg[0]) ? '/' + seg.slice(1).join('/') : chemin;
};

// ═══════════════════════════════════════════════════════════════════════════
// ── 0. L'INSTRUMENT AVANT LA MESURE ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LA LEÇON DU LOT 133, APPLIQUÉE AVANT D'EN AVOIR BESOIN. Trois défauts
// d'instrument ce jour‑là, dont deux de la même famille : un correctif qui ne
// s'appliquait jamais, et une contre‑épreuve qui se déclarait verte alors que
// rien n'avait été coché. ⇒ **On monte un témoin hostile et on lit ce qu'il
// rend.** Un détecteur qu'on n'a pas vu attraper une faute fabriquée n'a
// jamais prouvé qu'il sait en attraper une vraie.
// ⛔ Le témoin est fabriqué ICI, en mémoire : il ne touche jamais `dist/`.
const TEMOIN_DEUX_H1 = '<html><head><title>Faux | Témoin</title></head><body>'
  + '<h1 class="a">un</h1><div hidden><h1>deux</h1></div></body></html>';
const TEMOIN_ZERO_H1 = '<html><head><title>Faux | Témoin</title></head><body><p>rien</p></body></html>';
const TEMOIN_SVG = '<html><head><title>Vrai</title></head><body>'
  + '<svg><title>une icône</title></svg><h1>seul</h1></body></html>';

dit(compteH1(TEMOIN_DEUX_H1) === 2,
  'le détecteur voit bien DEUX <h1> sur un témoin qui en porte deux',
  compteH1(TEMOIN_DEUX_H1) === 2 ? null
    : `il en compte ${compteH1(TEMOIN_DEUX_H1)} — il ne pourrait pas attraper SEO‑1`);
dit(compteH1(TEMOIN_ZERO_H1) === 0,
  'et ZÉRO sur un témoin qui n\'en porte aucun');
dit(titreDe(TEMOIN_SVG) === 'Vrai',
  'le lecteur de titre ignore le <title> d\'un <svg> et prend celui du <head>',
  titreDe(TEMOIN_SVG) === 'Vrai' ? null : `il a lu « ${titreDe(TEMOIN_SVG)} »`);
dit(sansLocale('/fr/blog/index.html') === '/blog/index.html'
    && sansLocale('/sets/index.html') === '/sets/index.html',
  'le chemin sans locale reconnaît /fr/… et laisse /sets/ intact',
  `${LOCALES.length} préfixe(s) connu(s) : ${LOCALES.join(', ')}`);
// 🔴🔴 `nu()` AVANT TOUTE LONGUEUR — LA RÈGLE DU LOT 129, ET CE BANC L'A
// D'ABORD OUBLIÉE. Sous `I18N_MARQUAGE=1`, `t()` entoure chaque libellé de
// trois octets invisibles ET DU NOM DE LA CLÉ. Mesurée brute, une description
// de 149 caractères en annonce 163 ; comparés bruts, deux titres différents
// peuvent se ressembler et deux titres identiques différer. ⭐⭐⭐ Le banc a
// donc rougi sur QUATRE descriptions parfaitement conformes — et il aurait pu
// aussi laisser passer un vrai doublon. *Un instrument qui compte des octets
// que personne ne verra mesure autre chose que ce qu'il croit.*
// ⭐ On monte un témoin marqué à la main et on lit ce que `nu()` en fait :
// « est-ce importé ? » n'est pas « est-ce que ça retire quelque chose ? ».
const TEMOIN_MARQUE = '\u0011rayon.comics.d\u0012Les comics\u0013';
dit(nu(TEMOIN_MARQUE) === 'Les comics',
  'nu() retire bien les marqueurs i18n avant toute mesure de longueur',
  nu(TEMOIN_MARQUE) === 'Les comics' ? null
    : `nu() rend « ${nu(TEMOIN_MARQUE)} » — les longueurs et les comparaisons seraient fausses`);
const TEMOIN_ENTITES = '\u0011x.k\u0012Batman B&amp;W &#8212; 1 &lt;2\u0013';
dit(texte(TEMOIN_ENTITES) === 'Batman B&W \u2014 1 <2',
  'le texte mesuré est celui du lecteur : marqueurs retirés, entités décodées',
  texte(TEMOIN_ENTITES) === 'Batman B&W \u2014 1 <2'
    ? null : `il rend « ${texte(TEMOIN_ENTITES)} » — les longueurs seraient fausses`);
dit(texte('&amp;lt;') === '&lt;',
  'un `&amp;lt;` reste `&lt;` — le décodage ne se fait pas en deux tours',
  texte('&amp;lt;') === '&lt;' ? null : `il rend « ${texte('&amp;lt;')} »`);
dit(LOCALES.length >= 2,
  `la liste des locales est lue depuis i18n.mjs (${LOCALES.length} codes)`,
  LOCALES.length >= 2 ? null : 'liste vide ou tronquée — le groupement par locale ne garderait plus rien');

if (!existsSync(DIST)) {
  console.error(`\n❌ ${DIST} introuvable — ce banc ne peut rien prouver. Lancer le build d'abord.`);
  process.exit(2);
}

// ═══════════════════════════════════════════════════════════════════════════
// ── 1. LES PAGES, ET CE QU'ON ÉCARTE ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
const pages = [];
(function marche(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) marche(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
})(DIST);

// ⭐⭐ LE MÊME CRITÈRE QUE `test:feuille`, ET LE MÊME AVERTISSEMENT. En mode
// STATIC, Astro écrit un talon de ~320 o par redirection : `<meta
// http-equiv="refresh">` et rien d'autre. Un talon n'a ni `<h1>` ni titre
// propre, et c'est correct. ⛔ On ne les écarte PAS par leur nom mais par ce
// qu'ils SONT, et leur nombre est DIT : une exclusion qui grossit en silence
// finit par tout couvrir.
const contenu = [];
let talons = 0;
for (const p of pages) {
  const h = readFileSync(p, 'utf8');
  if (h.length < 2048 && /http-equiv="refresh"/.test(h)) { talons++; continue; }
  contenu.push([p.slice(DIST.length), h]);
}

// ⭐⭐ LA DÉCLARATION AVANT LA MESURE. « Zéro page fautive » et « zéro page
// lue » se ressemblent exactement dans un compteur à zéro, et sont l'inverse
// l'un de l'autre. Un vert qui n'a rien inspecté est le plus cher de tous.
if (contenu.length < 100) {
  console.error(`\n❌ ${contenu.length} page(s) de contenu sous ${DIST} `
    + `(${pages.length} fichiers, ${talons} talon(s)) — trop peu pour prouver quoi que ce soit.`);
  process.exit(2);
}
dit(true, `${contenu.length} page(s) de contenu jugée(s)`
  + (talons ? ` (${talons} talon(s) de redirection écarté(s))` : ''));

// ═══════════════════════════════════════════════════════════════════════════
// ── 2. EXACTEMENT UN <h1> PAR PAGE ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ DEUX FAUTES SYMÉTRIQUES, ET ON LES DIT SÉPARÉMENT. Plusieurs `<h1>` :
// Google choisit, et il choisit le premier — donc le mauvais dans le cas de
// SEO‑1. Aucun `<h1>` : la page n'a pas de titre principal du tout, ce qui
// coûte au robot ET au lecteur d'écran, qui navigue par en‑têtes.
const trop = [];
const aucun = [];
for (const [chemin, html] of contenu) {
  const n = compteH1(html);
  if (n > 1) trop.push(`${chemin} : ${n}`);
  else if (n === 0) aucun.push(chemin);
}
dit(trop.length === 0, `aucune page ne porte plus d'un <h1>`,
  trop.length === 0 ? null
    : `${trop.length} page(s) : ${trop.slice(0, 6).join(' · ')}${trop.length > 6 ? ' …' : ''}`);
dit(aucun.length === 0, `aucune page de contenu n'est sans <h1>`,
  aucun.length === 0 ? null
    : `${aucun.length} page(s) : ${aucun.slice(0, 6).join(' · ')}${aucun.length > 6 ? ' …' : ''}`);
if (trop.length) {
  console.log('     ⭐ Un second <h1> caché (`hidden`, `data-membre`) reste LU par Google et');
  console.log('        par les lecteurs d\'écran : la page dit une chose au robot et une autre');
  console.log('        aux gens. C\'est exactement SEO‑1 — l\'accueil a annoncé « My dashboard »');
  console.log('        à la place de sa promesse commerciale pendant huit lots.');
  console.log('     ➡️  Un seul <h1> par page. Un titre secondaire est un <h2>.');
}

// ═══════════════════════════════════════════════════════════════════════════
// ── 3. AUCUN <title> EN DOUBLE ENTRE DEUX PAGES DIFFÉRENTES ────────────────
// ═══════════════════════════════════════════════════════════════════════════
const parTitre = new Map();
const sansTitre = [];
for (const [chemin, html] of contenu) {
  const titre = titreDe(html);
  if (!titre) { sansTitre.push(chemin); continue; }
  if (!parTitre.has(titre)) parTitre.set(titre, []);
  parTitre.get(titre).push(chemin);
}
dit(sansTitre.length === 0, 'toutes les pages de contenu portent un <title>',
  sansTitre.length === 0 ? null
    : `${sansTitre.length} sans titre : ${sansTitre.slice(0, 5).join(' · ')}`);

// ⭐ ON NE COMPTE PAS LES PAGES, ON COMPTE LES CHEMINS SANS LOCALE DISTINCTS.
// Trois traductions d'une même page font trois fichiers et UN chemin : elles
// ne sont pas un doublon. Deux pages différentes font deux chemins : c'en est
// un.
const doublons = [];
for (const [titre, chemins] of parTitre) {
  const distincts = [...new Set(chemins.map(sansLocale))];
  if (distincts.length > 1) doublons.push(`« ${titre} » → ${distincts.slice(0, 4).join(' + ')}`);
}
dit(doublons.length === 0, `${parTitre.size} titre(s) distinct(s), aucun partagé par deux pages différentes`,
  doublons.length === 0 ? null
    : `${doublons.length} doublon(s) : ${doublons.slice(0, 5).join(' · ')}${doublons.length > 5 ? ' …' : ''}`);
if (doublons.length) {
  console.log('     ⭐ Deux pages, un titre : Google en retient UNE et jette l\'autre — celle');
  console.log('        qu\'il jette est indexée puis désindexée, et personne ne le voit passer.');
  console.log('     ⚠️  Les traductions d\'une MÊME page ne comptent pas : le <title> reste');
  console.log('        anglais depuis le lot 129 et `hreflang` dit lequel est lequel. Ce banc');
  console.log('        les regroupe déjà — un doublon signalé ici est bien deux pages.');
  console.log('     ➡️  Une adresse, un rôle, un titre.');
}

// ═══════════════════════════════════════════════════════════════════════════
// ── 4. LA DESCRIPTION TIENT DANS LA FENÊTRE QUE LE DÉPÔT S'EST DONNÉE ──────
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ SEO‑4 de l'audit du 10/08 : `/comics/` 62 caractères, `/collectibles/` 67,
// `/collections/` 68. Sous ~70, Google jette la description et fabrique son
// propre extrait à partir de la page — la balise est écrite, servie, et sans
// effet. C'est le profil « posé et jamais lu », côté moteur de recherche.
// ⛔ ET L'AUDIT DIT AUSSI CE QU'IL NE FAUT PAS FAIRE : ne pas rallonger pour
// rallonger. Une description qui répète le titre ne gagne rien. La seule chose
// que ce site a et que les autres n'ont pas, c'est le NOMBRE.
// ⚠️ ON MESURE `dist/`, DONC LE TEXTE AVEC SON `{n}` REMPLACÉ. Une clé qui
// tient dans la fenêtre « en général » peut en sortir dès que le catalogue
// grossit : `{n}` vaut 54 dans l'échantillon et 16 682 en production — quatre
// caractères d'écart, et c'est exactement le genre d'écart qui fait passer un
// seuil sans qu'une ligne de texte ait bougé.
const hors = [];
const vues = new Set();
let sansDesc = 0;
for (const [chemin, html] of contenu) {
  const m = html.match(/<meta\s+name="description"\s+content="([\s\S]*?)"\s*\/?>/i);
  if (!m) { sansDesc++; continue; }
  const d = texte(m[1]);
  if (vues.has(d)) continue;
  vues.add(d);
  const n = d.length;
  if (n < DESC_MIN || n > DESC_MAX) hors.push(`${chemin} : ${n} car.`);
}
dit(sansDesc === 0, 'toutes les pages de contenu portent une <meta description>',
  sansDesc === 0 ? null : `${sansDesc} page(s) sans description`);
dit(hors.length === 0,
  `${vues.size} description(s) distincte(s), toutes dans la fenêtre ${DESC_MIN}–${DESC_MAX} caractères`,
  hors.length === 0 ? null
    : `${hors.length} hors fenêtre : ${hors.slice(0, 6).join(' · ')}${hors.length > 6 ? ' …' : ''}`);
if (hors.length) {
  console.log(`     ⭐ Sous ${DESC_MIN} caractères, Google ignore la balise et invente son extrait :`);
  console.log('        la description est écrite, servie, et sans aucun effet. Au-dessus de');
  console.log(`        ${DESC_MAX}, elle est coupée — et la fin, c'est ce qu'on avait à dire.`);
  console.log('     ➡️  Y faire entrer le NOMBRE (« 16 682 comics »), pas des adjectifs.');
  console.log(`     ⚠️  Les bornes viennent de \`engine/lib/editorial_pages.mjs\` — les changer`);
  console.log('        ici seulement les ferait diverger de l\'avertissement éditorial.');
}

// ═══════════════════════════════════════════════════════════════════════════
// ── 5. LA CONDITION HOSTILE QUE L'ÉCHANTILLON NE CONTIENT PAS ──────────────
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE §5 EXISTE PARCE QUE LES §2–4 ONT ÉTÉ VERTS EN LOCAL ET ROUGES EN
// PRODUCTION. Le build hors ligne rend 147 pages sur un échantillon de 90
// pièces ; le catalogue réel en rend 3 097. Les trois sets Disney qui ont fait
// échouer le déploiement du lot 134 **n'existent pas dans l'échantillon** — et
// aucun `dist/` local ne les fera apparaître.
// ⭐⭐ *Un banc qui ne juge que ce que l'échantillon contient déclare conforme
// tout ce que l'échantillon ignore.* On fabrique donc la condition, avec les
// noms EXACTS relevés dans le build Docker du 10/08 (log `echec2.txt`) — ⛔ pas
// des noms inventés : une condition hostile qui n'existe pas en production
// mesure un écran que personne ne verra.
//
// ⚠️ CE §5 NE LIT PAS `dist/` : il appelle les FONCTIONS. C'est volontaire — il
// doit rester vrai même quand le `dist/` disponible est un échantillon, c'est
// même sa seule raison d'être.
// ⭐⭐⭐ DEUX FAMILLES, ET C'EST TOUT L'INTÉRÊT DE CE §5. Le discriminant ne vit
// pas au même endroit selon le type de page — et une correction qui ne regarde
// qu'une famille casse l'autre EN SILENCE. C'est arrivé pendant l'écriture de
// ce lot : `couperMilieu` posée globalement dans `pageTitle()` a réparé les
// trois sets et cassé quatre groupes de fiches, d'un seul geste.
// ⇒ Les deux familles sont donc jugées ICI, ensemble, à chaque passage.
const NOMS_REELS = [
  // ── FAMILLE 1 : LES SETS — le discriminant est À LA FIN. ────────────────
  // 50 caractères de préfixe commun, budget de titre à 60 : toute coupe PAR LA
  // FIN tombe forcément dans le préfixe. Relevé dans le build Docker du 10/08.
  'Disney100 Platinum Moments Walt Disney Animation Series 1',
  'Disney100 Platinum Moments Walt Disney Animation Series 2',
  'Disney100 Platinum Moments Walt Disney Animation Studios Series',
];
// ── FAMILLE 2 : LES FICHES — le discriminant est AU DÉBUT. ────────────────
// La fin est le nom de série que quinze voisines partagent : une coupe qui
// rogne la TÊTE pour préserver la queue les fait toutes collisionner.
// ⛔ Ces trois-là existent dans l'échantillon hors ligne — mais ils sont écrits
// ici quand même : le §2 ne les juge que si le `dist/` du moment les contient,
// et un échantillon change.
const FICHES_REELLES = [
  'Alex Ross Main Cover · Common · 3 — Return of the Jedi #1: Poster Series',
  'Alex Ross Main Cover · Common · AP — Return of the Jedi #1: Poster Series',
  'Todd McFarlane Variant · Uncommon · FE — Return of the Jedi #1: Poster Series',
];
const GABARIT = '%s | VeVe Price';
const muet = () => {};
// ⚠️ CE BANC REFAIT LE GESTE DE `CollectionPage.astro`, IL NE L'IMPORTE PAS :
// un composant `.astro` ne se charge pas depuis node. ⛔ C'est donc une COPIE,
// et une copie diverge — la parade est qu'elle appelle les MÊMES fonctions
// (`couperMilieu`, `TITLE_BUDGET`, `pageTitle`) : si le gabarit change de
// stratégie sans toucher à celles-ci, ce §5 ment. Le §2, lui, lit `dist/` et ne
// ment jamais : les deux ensemble, jamais l'un sans l'autre.
const titreDeSet = (nom) => {
  const brut = `Set : ${nom}`;
  const t = [...brut].length <= TITLE_BUDGET
    ? brut : `Set : ${couperMilieu(nom, TITLE_BUDGET - 'Set'.length - 3)}`;
  return pageTitle(t, GABARIT, '', muet);
};
// ⭐ Le préfixe commun se CALCULE, il ne se recopie pas : le jour où quelqu'un
// change un de ces noms, le libellé dit la vérité au lieu de citer un souvenir.
const prefixeCommun = (() => {
  let i = 0;
  while (NOMS_REELS.every((n) => n[i] !== undefined && n[i] === NOMS_REELS[0][i])) i++;
  return i;
})();
const titresFab = NOMS_REELS.map((n) => titreDeSet(n));
const fichesFab = FICHES_REELLES.map((n) => pageTitle(n, GABARIT, '', muet));
dit(new Set(titresFab).size === NOMS_REELS.length,
  `${NOMS_REELS.length} noms réels partageant ${prefixeCommun} caractères de préfixe`
  + ` rendent ${new Set(titresFab).size} titres DISTINCTS`,
  new Set(titresFab).size === NOMS_REELS.length ? null
    : `ils collisionnent : ${[...new Set(titresFab)].join(' | ')}`);
dit(new Set(fichesFab).size === FICHES_REELLES.length,
  `${FICHES_REELLES.length} fiches réelles au nom de série PARTAGÉ rendent ${
    new Set(fichesFab).size} titres DISTINCTS`,
  new Set(fichesFab).size === FICHES_REELLES.length ? null
    : `⛔ une coupe qui protège la QUEUE les écrase : ${[...new Set(fichesFab)].join(' | ')}`);
dit(titresFab.every((t) => [...t].length <= TITLE_BUDGET),
  `…et aucun ne dépasse le budget de ${TITLE_BUDGET} caractères`,
  titresFab.every((t) => [...t].length <= TITLE_BUDGET) ? null
    : `le plus long : ${Math.max(...titresFab.map((t) => [...t].length))}`);
// ⭐ ET LE CONTRÔLE SYMÉTRIQUE, CELUI QUI DIT QUE LE BANC SAIT ENCORE ÉCHOUER.
// Sans lui, une `pageTitle()` qui rendrait le nom entier sans jamais couper
// passerait les deux lignes ci-dessus — et le §2 aussi. On vérifie donc qu'un
// titre trop long est bel et bien RACCOURCI.
// ── ET LA DESCRIPTION, MÊME MÉTHODE ────────────────────────────────────────
// Les 17 pages hors fenêtre du build Docker étaient TOUTES sur ce set-là : son
// nom fait 62 caractères À LUI SEUL, avant même le nom de la pièce. Aucune
// pièce de l'échantillon hors ligne n'approche ça.
// ⭐ On refait ici le geste de `Base.astro` — mesurer `nu()`, couper à
// `DESC_MAX` — avec la VRAIE clé du dictionnaire et le PIRE nom réel connu.
const SERIE_MONSTRE = 'Disney100 Platinum Moments Walt Disney Animation Studios Series';
const descFab = t('en', 'desc.item', {
  name: 'Minnie Mouse Poster', series: ` — ${SERIE_MONSTRE}`,
  price: '$41.00', n: '1,204', year: '2023', brand: 'VeVe Price',
});
const descBornee = [...nu(descFab)].length > DESC_MAX ? couperMots(nu(descFab), DESC_MAX) : nu(descFab);
dit([...descBornee].length <= DESC_MAX && [...descBornee].length >= DESC_MIN,
  `la description de la pire pièce réelle tient dans ${DESC_MIN}–${DESC_MAX}`
  + ` (${[...nu(descFab)].length} → ${[...descBornee].length} car.)`,
  [...descBornee].length <= DESC_MAX && [...descBornee].length >= DESC_MIN ? null
    : `elle sort à ${[...descBornee].length} — la borne de Base.astro ne tient pas`);
dit([...nu(descFab)].length > DESC_MAX,
  'et ce témoin dépasse bien la borne AVANT correction (sinon il ne prouve rien)',
  [...nu(descFab)].length > DESC_MAX ? null
    : `il fait ${[...nu(descFab)].length} car. — trouver un nom plus long, ou ce contrôle est décoratif`);

const tropLong = pageTitle(`Set : ${NOMS_REELS[2]}`, GABARIT, '', muet);
dit([...tropLong].length < [...`Set : ${NOMS_REELS[2]}`].length,
  'un titre au-dessus du budget est bien raccourci (l\'instrument sait échouer)',
  `« ${tropLong} »`);

console.log(ko === 0
  ? `\n✅ ${contenu.length} pages : un <h1> chacune, ${parTitre.size} titres tous distincts,`
    + ` ${vues.size} descriptions dans la fenêtre\n`
  : `\n🔴 ${ko} contrôle(s) en échec\n`);
process.exit(ko === 0 ? 0 : 1);
