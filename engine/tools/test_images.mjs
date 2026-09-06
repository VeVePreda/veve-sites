// ⚠️ VeVePreda/veve-sites — engine/tools/test_images.mjs   (FICHIER NEUF — relooking 2)
//
// ═══════════════════════════════════════════════════════════════════════════
//  LES IMAGES : CE QU'ON TÉLÉCHARGE CONTRE CE QU'ON DESSINE
// ═══════════════════════════════════════════════════════════════════════════
//
//  🔴🔴🔴 CE BANC NAÎT D'UNE MESURE, PAS D'UNE INTUITION. Le 06/09/2026, 131
//  images de production ont été pesées **côté serveur**, par `curl`, parce que
//  le navigateur ne peut pas les peser : `transferSize` vaut 0 et
//  `Timing-Allow-Origin` est absent des réponses du CDN. Tous les poids cités
//  jusque-là étaient des poids DÉCODÉS.
//
//    · une couverture de comic pèse **1 579 550 o** en moyenne en `.full.jpeg` ;
//    · la même, en `.thumbnail.jpeg`, pèse **145 519 o** — 10,9× ;
//    · `/market/` la dessine dans une case de **48 px**.
//
//  ⭐⭐⭐ ET LA CONCLUSION A RENVERSÉ LE LOT : il n'y a **rien à générer au
//  build**, le CDN porte déjà la vignette. Ce banc garde donc un invariant qui
//  n'existait pas avant : *on ne télécharge pas trente fois ce qu'on dessine.*
//
// ═══════════════════════════════════════════════════════════════════════════
//  ⛔⛔ LE PIÈGE QUE CE BANC A DÛ DÉSAMORCER AVANT DE POUVOIR MESURER
// ═══════════════════════════════════════════════════════════════════════════
//  L'échantillon hors ligne écrivait `https://exemple.invalid/i/<uuid>.jpg`.
//  `image_cdn.mjs` ne réécrit QUE `d11unjture0ske.cloudfront.net` : contre cet
//  échantillon-là, **ce banc aurait été vert dès sa première ligne, et pour une
//  mauvaise raison** — il n'aurait eu aucune image à juger. C'est exactement le
//  défaut déjà payé sur le barème MCP (`Ultra Rare` contre `ULTRA_RARE`).
//  ⇒ `gen-sample.mjs` et `engine/data/sample/catalogue.csv` portent désormais
//    la forme du CDN, et **le §1 ci-dessous est le témoin qui le vérifie** :
//    si l'échantillon repart à `exemple.invalid`, ce banc le DIT au lieu de
//    devenir muet.
//
//  ⚠️ SANS OBJET N'EST PAS VERT. `vevewiki` n'a ni `/market/` ni pile de set :
//  ce banc y annonce qu'il n'a rien à juger, il ne se tait pas.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sourcesImage, grandeImage, imageFiche, imageCarte, ONERROR_REPLI } from '../lib/image_cdn.mjs';

const R = new URL('../..', import.meta.url).pathname;
let echecs = 0;
const dire = (ok, msg) => { if (!ok) echecs++; console.log(`  ${ok ? '✅' : '❌'} ${msg}`); };
const noter = (msg) => console.log(`  ⚪ ${msg}`);

/** 🔴🔴🔴 DÉCAPAGE — ET LE REMPLACEMENT PAR EXPRESSION RÉGULIÈRE NE MARCHE PAS ICI.
 *
 *  Un correctif bien commenté cite les motifs que son banc traque : il FAUT
 *  décaper avant de chercher, des deux côtés. Ma première version reprenait le
 *  `nuJs` de `test_pli.mjs` — trois `replace()`. Mesuré sur les gabarits de ce
 *  lot : `Market.astro` passe de 126 129 à 41 827 caractères et **il n'y reste
 *  plus une seule `<img>`**. Les gabarits de ce projet sont commentés à 60-80 %,
 *  et un appariement `/* … *\/` non-glouton finit par enjamber du code réel dès
 *  qu'un `*\/` traîne dans de la prose ou dans une chaîne.
 *  ⭐⭐ Le banc serait alors resté VERT en ne lisant plus rien — et c'est
 *  exactement ce qui est arrivé : l'injection nº 3 (retirer le `onerror` de
 *  `/market/`) n'a rien déclenché.
 *
 *  ⇒ On lit donc caractère par caractère, en suivant l'ÉTAT (code, chaîne,
 *    commentaire de ligne, commentaire de bloc). C'est vingt lignes, et c'est
 *    la seule façon de ne pas confondre un `/*` de commentaire avec les deux
 *    caractères `/` et `*` au milieu d'autre chose. */
function nuJs(s) {
  let out = '', i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '*') {                 // commentaire de bloc
      const f = s.indexOf('*/', i + 2);
      out += ' '; i = f < 0 ? n : f + 2; continue;
    }
    if (c === '/' && d === '/') {                 // commentaire de ligne
      const f = s.indexOf('\n', i);
      out += ' '; i = f < 0 ? n : f; continue;
    }
    if (c === '"' || c === "'" || c === '`') {    // chaîne : on la garde telle quelle
      let j = i + 1;
      while (j < n && s[j] !== c) { if (s[j] === '\\') j++; j++; }
      out += s.slice(i, Math.min(j + 1, n)); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Tous les fichiers HTML du build, à plat. */
function pagesHtml(racine) {
  const out = [];
  const marcher = (d) => {
    let entrees; try { entrees = readdirSync(d); } catch { return; }
    for (const e of entrees) {
      const p = join(d, e);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) marcher(p);
      else if (e.endsWith('.html')) out.push(p);
    }
  };
  marcher(racine);
  return out;
}

const DIST = join(R, 'dist');
if (!existsSync(DIST)) {
  console.log('\n⚪ images — SANS OBJET : aucun `dist/`, le build n\'a pas tourné\n');
  process.exit(0);
}

const html = pagesHtml(DIST).map((p) => readFileSync(p, 'utf8')).join('\n');
/** Une balise <img> entière, attributs compris. */
const IMGS = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const attr = (tag, nom) => {
  const m = tag.match(new RegExp(`\\b${nom}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : null;
};
const CDN = 'd11unjture0ske.cloudfront.net';

// ═══ §1 — LE TÉMOIN : Y A-T-IL SEULEMENT QUELQUE CHOSE À MESURER ? ═════════
console.log('\n§1 — l\'échantillon porte-t-il la FORME du CDN ?');

// 🔴🔴 PREMIÈRE VERSION DE CE §, ET L'INJECTION L'A PRISE EN DÉFAUT.
// Il comptait les <img> dont le `src` CONTIENT le nom du CDN. J'ai vidé
// l'échantillon de toute adresse CloudFront — et le banc est **resté vert** :
// cinq images éditoriales passent par `www.veve.me/_next/image?url=<adresse
// encodée>`, qui contient le nom du CDN sans être une adresse que
// `image_cdn.mjs` sache réécrire. Le témoin comptait donc des images
// intouchables, et les §2 et §3 sont passés « SANS OBJET » — c'est-à-dire
// MUETS — pendant que le témoin annonçait que tout allait bien.
// ⭐⭐ *Un « sans objet » se confond avec un succès.* On compte donc la FORME
// RÉÉCRIVABLE, et un « rien à juger » devient un ÉCHEC dès que le build porte
// des images que la règle sait toucher.
const REECRIVABLE = new RegExp(`^https://${CDN.replace(/\./g, '\\.')}/[^"?]+`
  + '\\.(webpFull\\.webp|full\\.jpeg|full\\.webp|thumbnail\\.jpeg|thumbnail\\.webp)$');
const duCdn = IMGS.filter((t) => REECRIVABLE.test(attr(t, 'src') || ''));
// ⛔⛔ ET IL FAUT DISTINGUER DEUX SILENCES, CE QUE LA PREMIÈRE VERSION NE
// FAISAIT PAS : elle rougissait sur `vevewiki`, qui n'a simplement AUCUNE image
// de catalogue — un site sans le défaut, accusé de l'avoir. C'est l'inverse
// exact du piège précédent, et les deux se règlent au même endroit.
// ⇒ Le discriminant est mesurable hors ligne : un build qui ne sert AUCUNE
//   image distante n'a rien à optimiser (vevewiki : 3 <img>, 0 en https).
//   Un build qui en sert et dont AUCUNE n'est réécrivable, lui, a un problème.
const distantes = IMGS.filter((t) => /^https?:\/\//.test(attr(t, 'src') || ''));
if (!distantes.length) {
  noter(`SANS OBJET : ce site ne sert aucune image distante (${IMGS.length} <img>, toutes locales)`);
} else {
  dire(duCdn.length > 0,
    duCdn.length > 0
      ? `${duCdn.length} <img> sur ${IMGS.length} portent une adresse RÉÉCRIVABLE du CDN — les §2 à §4 ont de quoi mordre`
      : `🔴 ${distantes.length} image(s) distante(s) et AUCUNE réécrivable : les §2 à §4 seraient MUETS.`
        + '\n     ⇒ `engine/data/sample/catalogue.csv` a dû repartir à `exemple.invalid`.'
        + '\n     ⛔ Un `url=` encodé (proxy `_next/image`) ne compte pas : il contient le nom'
        + '\n        du CDN sans être une adresse que `image_cdn.mjs` sache réécrire.');
}

// ═══ §2 — ON NE TÉLÉCHARGE PAS TRENTE FOIS CE QU'ON DESSINE ═══════════════
console.log('\n§2 — les petites images servent la vignette, pas la pleine résolution');

/** Les émetteurs dont la largeur d'affichage est FIXÉE, donc jugeable hors
 *  ligne. ⛔ `.carte`/`.tuile` n'y sont PAS : leur `.socle` suit une grille
 *  `minmax()` et va jusqu'à ~250 px, au-delà des 132 px de la vignette d'un
 *  collectible. Les y inscrire rendrait ce banc faux, pas plus sévère. */
const PETITS = [
  ['vign__i', 48],  // theme.css : `.vign__i{width:48px}`
  ['feed__v', 44],  // gabarit d'alertes
  ['pile__v', 66],  // les trois vignettes d'une carte de set (216 px / 3)
];
const PLEINE = /\.(webpFull\.webp|full\.jpeg|full\.webp)$/;

let jugees = 0, grosses = [];
for (const tag of duCdn) {
  const cls = attr(tag, 'class') || '';
  const src = attr(tag, 'src') || '';
  // 🔴🔴 PREMIER JET DE CE §, ET IL ÉTAIT FAUX : il jugeait `socle__net`.
  // Ce nom habille AUSSI la grande image de la fiche, qui sert légitimement du
  // `webpFull` — **28 rouges sur du code sain**, la faute exacte que
  // `test:pli` avait déjà commise avec `.fiche`. *Un nom n'est pas un usage.*
  // ⇒ `pile__v` est posé par `CarteSet.astro` ET par `series.js`, et ne désigne
  //   que les trois vignettes de 66 px d'une carte de set.
  const petit = PETITS.find(([c]) => cls.split(/\s+/).includes(c));
  if (!petit) continue;
  jugees++;
  if (PLEINE.test(src)) grosses.push(`${petit[0]} (${petit[1]} px) → ${src.slice(-42)}`);
}
if (!jugees) {
  // ⛔ SANS OBJET SEULEMENT SI LE BUILD N'AVAIT RIEN À OFFRIR. S'il porte des
  // adresses réécrivables et qu'aucune n'arrive dans un émetteur étroit, c'est
  // que les marqueurs d'usage ont disparu — et ce § serait muet, pas satisfait.
  dire(duCdn.length === 0,
    duCdn.length === 0
      ? 'SANS OBJET : ce build ne porte aucune image du CDN'
      : `🔴 ${duCdn.length} image(s) du CDN dans le build, et AUCUNE dans un émetteur`
        + ' à largeur fixée : `vign__i`, `feed__v` ou `pile__v` a disparu, ce § ne mesure plus rien.');
} else {
  dire(grosses.length === 0,
    grosses.length === 0
      ? `${jugees} image(s) à largeur fixée, toutes en vignette`
      : `🔴 ${grosses.length} image(s) pleine résolution dans une case étroite :\n       `
        + grosses.slice(0, 4).join('\n       '));
}

// ═══ §3 — UNE ADRESSE RÉÉCRITE PART TOUJOURS AVEC SON REPLI, ARMÉ ═════════
console.log('\n§3 — le repli est présent ET armé');

const avecRepli = IMGS.filter((t) => attr(t, 'data-repli'));
const sansGestionnaire = avecRepli.filter((t) => !/\bonerror\s*=/.test(t));
if (!avecRepli.length) {
  dire(duCdn.length === 0,
    duCdn.length === 0
      ? 'SANS OBJET : aucune image du CDN, donc aucune réécriture possible'
      : `🔴 ${duCdn.length} image(s) du CDN et AUCUNE réécrite : la règle ne s'applique plus nulle part.`);
} else {
  dire(sansGestionnaire.length === 0,
    sansGestionnaire.length === 0
      ? `${avecRepli.length} image(s) réécrite(s), toutes avec un \`onerror\``
      : `🔴 ${sansGestionnaire.length} image(s) portent un repli que RIEN ne déclenche —`
        + ' l\'adresse de secours est là, morte. Une vignette sur soixante n\'existe pas.');
  // ⭐ Et le repli doit être une AUTRE adresse : `data-repli` égal au `src`
  // rechargerait la même chose et boucle.
  const memeAdresse = avecRepli.filter((t) => attr(t, 'data-repli') === attr(t, 'src'));
  dire(memeAdresse.length === 0,
    memeAdresse.length === 0 ? 'aucun repli ne pointe sur l\'adresse qui vient d\'échouer'
      : `🔴 ${memeAdresse.length} image(s) ont un repli identique à leur src — boucle`);
}

// ═══ §3b — ET LES ROUTES QUI NE SONT PAS DANS `dist/` ════════════════════
console.log('\n§3b — les émetteurs rendus À LA DEMANDE, jugés sur leur source');

// 🔴🔴🔴 CE § EXISTE PARCE QUE L'INJECTION A TROUVÉ LE TROU.
// J'ai retiré le `onerror` de la case de 48 px de `/market/` : **le banc est
// resté vert**. `/market/` et `/alertes/` sont rendues À LA DEMANDE
// (`prerender = false`) — leur HTML n'existe nulle part dans `dist/`, donc les
// §2 à §4, qui lisent le build, ne les voient pas et ne les verront jamais.
// ⭐⭐ *Un banc branché sur le build ne juge que les pages pré-générées.* Il
// faut le DIRE, et juger les autres sur ce qui existe hors ligne : leur source.
const GABARITS = [
  'src/components/pages/Market.astro',
  'src/components/pages/Alertes.astro',
  'src/components/CarteSet.astro',
  'src/components/Carte.astro',
  'src/components/pages/Item.astro',
];
let orphelins = [], lus = 0;
for (const rel of GABARITS) {
  const abs = join(R, rel);
  if (!existsSync(abs)) { noter(`SANS OBJET : ${rel} absent`); continue; }
  const src = nuJs(readFileSync(abs, 'utf8'));
  if (!/from '.*image_cdn\.mjs'/.test(src)) continue;
  lus++;
  // Chaque <img> qui porte un repli doit porter le gestionnaire, dans la MÊME
  // balise. On lit la source décapée : un exemple en commentaire ne compte pas.
  for (const m of src.matchAll(/<img\b[\s\S]{0,600}?\/>/g)) {
    const tag = m[0];
    if (/data-repli/.test(tag) && !/onerror\s*=/.test(tag)) {
      orphelins.push(`${rel} — <img …${tag.slice(0, 60).replace(/\s+/g, ' ')}…`);
    }
  }
}
if (!lus) noter('SANS OBJET : aucun gabarit n\'importe `image_cdn.mjs`');
else {
  dire(orphelins.length === 0,
    orphelins.length === 0
      ? `${lus} gabarit(s) lus à la source : tout repli y est armé`
      : `🔴 ${orphelins.length} <img> portent un repli sans gestionnaire :\n       `
        + orphelins.slice(0, 4).join('\n       '));
}
noter('⚠️ CE QUE CE BANC NE MESURE PAS : le rendu. Les §2 à §4 lisent `dist/`,'
  + ' donc les seules pages PRÉ-GÉNÉRÉES ; `/market/` et `/alertes/` n\'y sont pas.');

// ═══ §4 — LA PLACE EST RÉSERVÉE ═══════════════════════════════════════════
console.log('\n§4 — aucune image sans dimensions déclarées');

const sansDim = duCdn.filter((t) => !attr(t, 'width') || !attr(t, 'height'));
if (!duCdn.length) noter('SANS OBJET : aucune image du CDN dans ce build');
else {
  dire(sansDim.length === 0,
    sansDim.length === 0
      ? `${duCdn.length} image(s) du CDN, toutes avec width+height`
      : `🔴 ${sansDim.length} image(s) sans width/height — la page saute au chargement`);
}

// ═══ §5 — LES DEUX FABRIQUES DISENT LE MÊME GESTE ═════════════════════════
console.log('\n§5 — le pilote client refait exactement le geste du serveur');

const PILOTE = join(R, 'src/socle/modules/series.js');
if (!existsSync(PILOTE)) noter('SANS OBJET : `series.js` absent');
else {
  // ⛔ On décape AVANT de chercher : le bloc porté est commenté, et son
  // commentaire NOMME `ONERROR_REPLI`. Sans décapage, ce contrôle serait vert
  // en lisant la prose qui parle du code — la faute des quinze bancs de 08/26.
  const js = nuJs(readFileSync(PILOTE, 'utf8'));
  // Les trois gestes, dans l'ordre, tels que `ONERROR_REPLI` les enchaîne.
  const gestes = [
    [/removeAttribute\(\s*'srcset'\s*\)/, 'il retire `srcset` (sinon le navigateur re-choisit la variante qui vient d\'échouer)'],
    [/\.src\s*=\s*this\.dataset\.repli/, 'il bascule sur `data-repli`'],
    [/socle--casse/, '…et ne marque le socle cassé qu\'ENSUITE'],
  ];
  for (const [re, quoi] of gestes) dire(re.test(js), `\`series.js\` : ${quoi}`);
  // ⭐ Et le module serveur doit porter les trois aussi — sinon c'est LUI qui
  // a dérivé, et ce § pointerait le mauvais fichier.
  for (const [re, quoi] of gestes) {
    dire(re.test(ONERROR_REPLI), `\`ONERROR_REPLI\` : ${quoi}`);
  }
}

// ═══ §6 — LE CONTRAT DE `sourcesImage`, SUR LES CAS MESURÉS ═══════════════
console.log('\n§6 — la règle elle-même, sur les largeurs mesurées le 06/09');

const col = `https://${CDN}/collectible_type_image.a.b.webpFull.webp`;
const cmc = `https://${CDN}/comic_cover.a.b.full.jpeg`;
const cmw = `https://${CDN}/comic_cover.a.b.full.webp`;

const cas = [
  ['un collectible à 48 px prend la vignette', sourcesImage(col, 48).src.endsWith('.thumbnail.jpeg')],
  ['…et emporte son repli', sourcesImage(col, 48).repli === col],
  ['…sans srcset : 48 × 2 ≤ 132, elle est nette à densité 2', sourcesImage(col, 48).srcset === null],
  ['un collectible à 173 px NE prend PAS la vignette (132 px, elle serait floue)',
    sourcesImage(col, 173).src === col && sourcesImage(col, 173).repli === null],
  ['un comic à 190 px prend la vignette AVEC un srcset 1x/2x',
    sourcesImage(cmc, 190).src.endsWith('.thumbnail.jpeg')
    && /\b1x,.*\b2x$/.test(sourcesImage(cmc, 190).srcset || '')],
  ['l\'extension de la vignette suit celle de la SOURCE', sourcesImage(cmw, 48).src.endsWith('.thumbnail.webp')],
  ['une adresse hors CDN ressort intacte', sourcesImage('https://ailleurs.test/a.jpg', 48).src === 'https://ailleurs.test/a.jpg'],
  ['une largeur absurde ne réécrit rien', sourcesImage(col, 0).src === col],
  ['`grandeImage` passe un jpeg en webp (3,1× mesuré)', grandeImage(cmc).src.endsWith('.webpFull.webp')],
  ['…et ne touche pas ce qui est déjà en webp', grandeImage(cmw).src === cmw && grandeImage(cmw).repli === null],
];
for (const [quoi, ok] of cas) dire(ok, quoi);

// ═══ §7 — `imageFiche`, ET CE QU'ELLE REFUSE DE FAIRE ═════════════════════
//
// 🔴🔴 CE § EXISTE PARCE QUE LA FICHE EST LE SEUL ENDROIT QUI DÉCIDE SUR LA
// FAMILLE. Partout ailleurs le module tranche sur la largeur d'affichage ; ici
// la largeur ne PEUT pas trancher — la vignette d'un comic vaut 400 px ou 239
// selon la pièce, et le build est hors ligne. Une règle qui fait exception à la
// règle du module doit être tenue par un banc, ou elle sera « simplifiée » au
// premier lot qui relira le fichier sans l'historique.
//
// ⛔ LA LIGNE QUI COMPTE LE PLUS EST CELLE DU COLLECTIBLE. C'est la seule qui
// dise que l'exception est BORNÉE. Sans elle, remplacer la liste de familles
// par « tout le CDN » laisserait ce § entièrement vert, en posant une vignette
// de 132 px dans une boîte de 263.
console.log('\n§7 — la grande image d\'une fiche (arbitrage Preda du 06/09)');

const cti = `https://${CDN}/comic_type_image.a.b.full.jpeg`;

const casFiche = [
  ['un comic prend la vignette', imageFiche(cmc).src.endsWith('.thumbnail.jpeg')],
  ['…et emporte l\'URL SERVIE comme repli, pas une réécriture', imageFiche(cmc).repli === cmc],
  ['…SANS srcset : à densité 1,375 et 2, un descripteur `x` reprendrait la grande',
    imageFiche(cmc).srcset === null],
  ['l\'extension de la vignette suit celle de la source', imageFiche(cmw).src.endsWith('.thumbnail.webp')],
  ['`comic_type_image` est dans le périmètre (276 px mesurés)', imageFiche(cti).src.endsWith('.thumbnail.jpeg')],
  ['⛔ un COLLECTIBLE n\'y entre PAS : sa vignette fait 132 px pour une boîte de 263',
    imageFiche(col).src === grandeImage(col).src && !imageFiche(col).src.includes('thumbnail')],
  ['une adresse hors CDN ressort intacte',
    imageFiche('https://ailleurs.test/a.jpg').src === 'https://ailleurs.test/a.jpg'],
  ['une image absente ne fabrique ni src ni repli',
    imageFiche(null).src === '' && imageFiche(null).repli === null],
  ['un suffixe hors table ne fait pas deviner une adresse',
    imageFiche(`https://${CDN}/comic_cover.a.b.autre.png`).src.endsWith('.autre.png')],
];
for (const [quoi, ok] of casFiche) dire(ok, quoi);

// ⭐⭐ AUTO-CONTRÔLE — le §7 sait-il DIRE NON ? Les lignes ci-dessus seraient
// toutes vraies pour de mauvaises raisons si `imageFiche` rendait n'importe
// quoi de plausible. On lui montre ce qu'elle ne doit jamais produire.
dire(imageFiche(cmc).src !== cmc,
  'auto-contrôle : la vignette n\'est pas simplement l\'URL d\'entrée recopiée');
dire(imageFiche(col).repli !== col.replace('.webpFull.webp', '.thumbnail.jpeg'),
  'auto-contrôle : le repli d\'un collectible ne pointe pas sur une vignette');

// ═══ §8 — L'IMAGE D'UNE CARTE : LA VIGNETTE SANS AGRANDIR ════════════════
console.log('\n§8 — `imageCarte` : la carte dessine à 207 px, pas à 2 000');

// 🔴🔴 CE § EXISTE PARCE QUE `Carte.astro` N'ÉTAIT BRANCHÉE SUR RIEN. Elle
// servait `item.image` BRUT — ni vignette, ni compression — sur 3 195 pages de
// collection, plus l'accueil, l'orientation et les favoris. Mesuré en
// production le 06/09 : **2 000 px servis pour 174 à 207 px dessinés**, et
// **34,25 Mo → 3,39 Mo** sur 97 images pesées.
const casCarte = [
  ['un comic prend la vignette', imageCarte(cmc).src.endsWith('.thumbnail.jpeg')],
  ['…et garde l\'URL SERVIE comme repli', imageCarte(cmc).repli === cmc],
  ['…SANS srcset : le cas ② de `sourcesImage` ne gagne RIEN à densité 1,375 et 2',
    imageCarte(cmc).srcset === null],
  ['l\'extension de la vignette suit celle de la source', imageCarte(cmw).src.endsWith('.thumbnail.webp')],
  ['⛔ un COLLECTIBLE n\'y entre PAS : sa vignette fait 132 px pour une carte de 207',
    !imageCarte(col).src.includes('thumbnail')],
  ['une adresse hors CDN ressort intacte',
    imageCarte('https://ailleurs.test/a.jpg').src === 'https://ailleurs.test/a.jpg'],
  ['une image absente ne fabrique ni src ni repli',
    imageCarte(null).src === '' && imageCarte(null).repli === null],
  ['un suffixe hors table ne fait pas deviner une adresse',
    imageCarte(`https://${CDN}/comic_cover.a.b.autre.png`).src.endsWith('.autre.png')],
];
for (const [quoi, ok] of casCarte) dire(ok, quoi);

// ⭐⭐ AUTO-CONTRÔLE — le §8 sait-il DIRE NON ?
dire(imageCarte(cmc).src !== cmc,
  'auto-contrôle : la vignette n\'est pas l\'URL d\'entrée recopiée');
dire(imageCarte(col).src !== col.replace('.webpFull.webp', '.thumbnail.jpeg'),
  'auto-contrôle : un collectible ne repart pas en vignette par une autre porte');

// ⭐⭐⭐ ET LE CONTRÔLE QUI TIENT VRAIMENT LE LOT : les deux <img> d'une carte
// doivent partager UNE SEULE URL. C'était la propriété du balisage d'origine
// (« même requête, même cache ») et une vignette posée sur la seule image nette
// la casserait EN SILENCE — le rendu resterait juste, le trafic doublerait.
{
  const src = nuJs(readFileSync(join(R, 'src/components/Carte.astro'), 'utf8'));
  const imgs = [...src.matchAll(/<img\b[\s\S]{0,600}?\/>/g)].map((m) => m[0]);
  const socles = imgs.filter((t) => /class="socle__(fond|net)/.test(t));
  const srcs = [...new Set(socles.map((t) => (t.match(/src=\{([^}]+)\}/) || [])[1]))];
  dire(socles.length >= 2 && srcs.length === 1,
    socles.length >= 2 && srcs.length === 1
      ? `les ${socles.length} <img> du socle partagent une seule expression de src (${srcs[0]})`
      : `🔴 le fond et l'image nette ne partagent plus la même source (${srcs.join(' · ')})`
        + ' — deux requêtes au lieu d\'une, sans que le rendu change.');
}

console.log(echecs === 0
  ? '\n✅ images : on ne télécharge plus trente fois ce qu\'on dessine\n'
  : `\n❌ images : ${echecs} contrôle(s) en défaut\n`);
process.exit(echecs ? 1 : 0);
