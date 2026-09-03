// ⚠️ VeVePreda/veve-sites — engine/lib/socle_js.mjs   (NEUF — lot 137, A2 / OPT‑3)
// ═══════════════════════════════════════════════════════════════════════════
// LE JAVASCRIPT SORT DU HTML — UN FICHIER, UNE FOIS, POUR 3 097 PAGES
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ CE MODULE EST LE JUMEAU DE `feuille_theme.mjs` (lot 105), ET C'EST
// DÉLIBÉRÉ. Le lot 105 a sorti le thème du HTML pour exactement la même raison
// et par exactement le même chemin : un glob `?raw`, une empreinte tirée du
// contenu, une route qui sert, un `<link>`/`<script>` qui pointe. Le
// raisonnement était juste pour le CSS en août ; il n'avait jamais été appliqué
// au JS. ⛔ Si tu modifies l'un des deux modules, regarde l'autre : ils doivent
// rester lisibles côte à côte.
//
// CE QUE ÇA CORRIGE, MESURÉ SUR LA SOURCE LE 11/08/2026 :
//   `Base.astro` porte 19 727 o de `<script is:inline>`, dont 14 415 o (73 %)
//   SANS `define:vars` — donc identiques d'une page à l'autre. `Base.astro`
//   habille TOUTES les pages : ces octets partent 3 097 fois.
//   ⭐⭐ ET LA COMPRESSION N'Y PEUT RIEN : gzip agit à l'intérieur d'une
//   réponse, jamais ENTRE deux réponses. Un visiteur qui lit trois fiches
//   télécharge aujourd'hui trois fois le même code.
//
// ⛔⛔ DEUX SCRIPTS DE `Base.astro` NE SONT **PAS** ICI, ET CE N'EST PAS UN
// OUBLI — C'EST LA RAISON D'ÊTRE DE CE COMMENTAIRE.
//   ① celui qui restaure `data-theme="nuit"`   (1 042 o)
//   ② celui qui pose `data-membre="1"`         (  466 o)
// Les deux vivent dans le `<head>` et n'existent que pour poser un attribut
// AVANT la première peinture. Les externaliser rendrait leur exécution
// dépendante d'une requête réseau — et ramènerait, une fois sur deux, l'éclair
// blanc du lot 98 et le clignotement « Inscription → avatar » du lot 100. Deux
// pannes déjà payées, déjà documentées dans `Base.astro`, et invisibles en test
// parce qu'elles ne se produisent qu'au premier chargement froid.
// ⭐ 1 508 o restent donc en ligne, et ils doivent y rester. *Un lot qui gagne
// des octets en réintroduisant une panne déjà réparée n'est pas une
// optimisation.*
//
// ⛔⛔⛔ `import.meta.glob` ET NON `readFileSync` — ET CETTE LIGNE-LÀ DÉCIDE DE
// LA PRODUCTION. C'est mot pour mot le piège de `feuille_theme.mjs` : le
// Dockerfile ne copie PAS `src/` dans l'image de runtime (il copie `dist`,
// `engine`, `sites`, `node_modules`, `.reserve`). Un `readFileSync('src/socle/…')`
// marcherait au build, marcherait dans le bac à sable, marcherait en
// développement — et jetterait ENOENT en production sur les seules routes
// rendues à la demande (`/compte/`, `/connexion/`, `/inscription/`, `/market/`),
// c'est-à-dire précisément celles qu'aucun banc hors-ligne ne rend. Avec le glob
// de Vite, le texte est cousu dans le paquet au build.
// ⭐ La maison avait déjà la bonne forme, deux fois. On la suit.

import { createHash } from 'node:crypto';
import { acces } from './access.mjs';
import { coteFermee } from './cote.mjs';
import { langueUiDansEntete } from './i18n.mjs';

const fichiers = import.meta.glob('../../src/socle/*.js', { query: '?raw', import: 'default', eager: true });

// ⭐⭐ LES MODULES DE COMPOSANT — le socle a deux étages, et la distinction est
// une MESURE, pas un goût.
//   · `src/socle/*.js`         → ce que `Base.astro` émet sur TOUTES les pages.
//     Le mettre dans un fichier unique est un gain net : un seul aller-retour,
//     mis en cache une fois pour 3 097 pages.
//   · `src/socle/modules/*.js` → ce qu'UN composant émet sur QUELQUES pages.
//     Mesuré le 11/08 : le script de `Cadran.astro` pèse 8 194 o une fois rendu
//     et n'apparaît que sur 90 pages sur 148. Le verser au socle global le
//     ferait télécharger par les 58 autres — on aurait déplacé le gaspillage au
//     lieu de le supprimer.
// ⛔ Un module de composant n'est PAS un morceau du socle : il a sa propre
// empreinte, son propre fichier, et c'est le composant qui l'émet.
const modules = import.meta.glob('../../src/socle/modules/*.js', { query: '?raw', import: 'default', eager: true });

// ⭐⭐⭐ L'ORDRE EST DÉCLARÉ ICI, PAS DÉDUIT DU GLOB — ET C'EST UN CONTRÔLE,
// PAS UNE PRÉFÉRENCE.
// ① L'ordre du document est un contrat : `30-membre.js` relit l'attribut
//    `data-membre` que le `<head>` a posé, `50-i18n.js` échange des libellés que
//    `20-menu.js` a pu réécrire. Un tri alphabétique qui « marche aujourd'hui »
//    est un tri qui cassera le jour où quelqu'un renommera un fichier.
// ② Et surtout : cette liste est un LECTEUR. Un fichier déposé dans
//    `src/socle/` sans venir ici ne serait jamais servi — il partirait dans le
//    dépôt, passerait la revue, et ne s'exécuterait nulle part. C'est
//    exactement `regle-circuit-ouvert` : *deux écrivains, aucun lecteur*, la
//    panne qui a laissé `vevewiki.com/favoris/` répondre 200 pendant des mois.
//    ⇒ Le §4 ci-dessous LÈVE si le dossier et cette liste divergent.
const ORDRE = [
  '10-contact.js',   // réassemble les adresses de contact (anti-aspirateur)
  '20-menu.js',      // le tiroir de navigation et son voile
  '30-membre.js',    // l'avatar et l'en-tête, ⚠️ seulement si les comptes sont ouverts
  '40-favoris.js',   // les boutons ★, `localStorage` uniquement
  // 🔔 LOT 215-B — L'ACCÈS UNIQUE AUX ALERTES (`window.vpAlertes`).
  // ⭐ JUSTE APRÈS `40-favoris.js`, ET LA LISTE SE LIT COMME UNE CHRONOLOGIE :
  //   c'est son jumeau exact — même forme, même raison (un seul accès réseau
  //   pour tous les lecteurs), et on veut que le prochain lecteur les compare
  //   sans avoir à les chercher.
  // ⭐⭐ AVANT les modules de composant, forcément : le socle est émis dans le
  //   `<head>`, un module dans le `<body>`, et les deux sont `defer` — donc
  //   exécutés dans l'ordre du document. `alerte_fiche.js` et
  //   `modules/alertes.js` appellent `window.vpAlertes` ; il doit exister.
  '45-alertes.js',
  '50-i18n.js',      // l'échange des libellés chez le visiteur (lot 129)
  // 🌍 LOT 139 — le sélecteur de langue d'interface de l'en-tête public.
  // ⭐ APRÈS `50-i18n.js`, ET L'ORDRE EST UN CONTRAT ICI AUSSI : celui-ci pose
  // le cookie que celui-là consomme au chargement suivant. Les mettre dans
  // l'autre sens marcherait — ils ne se parlent qu'à travers un rechargement —
  // mais la liste se lit comme une chronologie, et une chronologie fausse est
  // un piège pour le prochain lecteur.
  '55-langue.js',
  // 🌐 LOT 212 — la suggestion de langue, en infobulle sous le bouton.
  // ⭐ APRÈS `50-i18n.js` : elle lit ses deux libellés dans des attributs que
  //   celui-ci vient d'échanger. Avant lui, la bulle s'ouvrirait en anglais sur
  //   un site affiché en français — et seulement au premier chargement, donc de
  //   façon irreproductible à la demande.
  // ⭐ APRÈS `55-langue.js` aussi, et ce n'est pas indifférent : les deux
  //   écrivent le cookie `vp_langue`, avec la MÊME écriture (`path=/`, un an,
  //   `SameSite=Lax`, pas de `Secure`). La liste se lit comme une chronologie ;
  //   le voisin qui pose ce cookie doit être juste au-dessus de celui qui le
  //   repose, pour que la prochaine personne les compare sans les chercher.
  '56-suggestion.js',
  '60-cote.js',      // les cotes remplies à la demande (ex-`CoteScript.astro`)
  '70-figures.js',   // le bouton « télécharger cette figure » (ex-`Figures.astro`)
];

// ⛔ LES FICHIERS QUI NE PARTENT QUE SOUS CONDITION.
// ⚠️ `30-membre.js` ne concerne QUE les sites qui ouvrent des comptes. Il
// vivait dans `Base.astro` sous `{comptesOuverts && (…)}` ; la condition voyage
// avec le code, elle ne se perd pas en chemin.
// 🔴🔴 ET ELLE EST RECOPIÉE À L'IDENTIQUE, PAS RÉÉCRITE. `Base.astro` ligne 272
// dit `acces().tiers.length > 1` — pas un champ du manifeste, une DÉRIVÉE.
// Écrire ici `manifest().features.comptes.ouverts`, qui « veut dire la même
// chose », donnerait deux définitions d'un même état : le jour où elles
// divergeraient, vevewiki servirait un script d'espace membre sur un site qui
// n'en a pas, ou veveprice le perdrait. *Un champ à deux populations, encore.*
// ⭐⭐ Conséquence assumée : le socle de veveprice et celui de vevewiki n'ont
// pas le même contenu, donc pas la même empreinte, donc pas la même adresse.
// C'est déjà le cas de la feuille de thème depuis le lot 105 — le mécanisme est
// per-SITE par construction, il n'a pas à le devenir.
// ⚠️ `60-cote.js` porte la MÊME logique, et elle a failli se perdre. Le script
// vivait sous `{emettre && (…)}` dans `CoteScript.astro`, avec `emettre =
// coteFermee()`. En sortant le code du composant, on sort aussi sa garde : si
// elle ne réapparaît pas ici, vevewiki (`tiers: [visitor]`) embarque le pilote
// d'un mur qu'il n'a pas. ⭐ *La condition voyage avec le code, ou elle
// disparaît en silence.* Le build reste vert dans les deux cas — c'est
// exactement pour ça que ça se rate.
const CONDITIONS = {
  '30-membre.js': () => acces().tiers.length > 1,
  // 🔔 LOT 215-B — MÊME CONDITION, MÊME PRÉDICAT, ET IL EST APPELÉ PAS RECOPIÉ.
  // Un site sans comptes n'a pas d'alertes : vevewiki (`tiers: [visitor]`)
  // n'embarque donc pas cet accès, exactement comme il n'embarque pas
  // `30-membre.js`. ⭐ Et `Item.astro` évalue LA MÊME expression pour décider
  // s'il rend le bouton : le script et son hôte apparaissent et disparaissent
  // ensemble. *La condition voyage avec le code, ou elle disparaît en silence.*
  '45-alertes.js': () => acces().tiers.length > 1,
  '60-cote.js': () => coteFermee(),
  // 🌍 LOT 139 — ⭐⭐ LA CONDITION EST IMPORTÉE, PAS RÉÉCRITE.
  // `Base.astro` appelle EXACTEMENT `langueUiDansEntete()` pour décider s'il
  // ÉMET le bouton ; ce fichier l'appelle pour décider s'il EMBARQUE le script
  // qui le fait marcher. Recopier ici `manifest().identity.langue_interface_dans
  // === 'entete'`, qui « veut dire la même chose », donnerait deux définitions
  // d'un seul état — et le jour où elles divergent, on sert un bouton sans
  // script (il ne fait rien) ou un script sans bouton (il sort sur son garde,
  // et on ne s'en aperçoit jamais). C'est la panne P30 de ce même lot, à
  // l'identique : *un prédicat recopié est un prédicat qui divergera.*
  // ⭐ Conséquence mesurable : vevewiki, qui ne pose pas la clé, n'embarque pas
  // ces 6 021 octets. *La condition voyage avec le code, ou elle disparaît.*
  '55-langue.js': () => langueUiDansEntete(),
};

let cache = null;

// ⭐ UN SEUL CALCUL PAR BUILD, comme la feuille. `SITE` ne change pas en cours
// de build : sans ce cache, le sha256 serait recalculé 3 097 fois — on
// remplacerait un coût réseau par un coût CPU.
export function socleJs() {
  if (cache) return cache;

  // ═══ §4 · LE CIRCUIT SE FERME ICI ═══════════════════════════════════════
  // ⭐⭐ Un module qui ne regarde que ce qu'il connaît ne voit jamais ce qu'on
  // a ajouté à côté de lui. On compare les DEUX sens.
  const surDisque = Object.keys(fichiers).map((k) => k.split('/').pop()).sort();
  const declares = [...ORDRE].sort();
  const orphelins = surDisque.filter((f) => !declares.includes(f));
  const fantomes = declares.filter((f) => !surDisque.includes(f));
  if (orphelins.length || fantomes.length) {
    throw new Error(
      '[socle-js] `src/socle/` et la liste ORDRE divergent — un fichier ne serait jamais servi.\n'
      + (orphelins.length ? `  sur le disque mais pas dans ORDRE : ${orphelins.join(', ')}\n` : '')
      + (fantomes.length ? `  dans ORDRE mais pas sur le disque : ${fantomes.join(', ')}\n` : '')
      + '  ⇒ ajouter la ligne manquante dans engine/lib/socle_js.mjs, ou retirer le fichier.');
  }

  const morceaux = [];
  const retenus = [];
  for (const nom of ORDRE) {
    const cond = CONDITIONS[nom];
    if (cond && !cond()) continue;
    const cle = `../../src/socle/${nom}`;
    // ⛔ PAS DE REPLI SILENCIEUX. Le glob est résolu au build : si la clé
    // manque ici alors que le §4 vient de passer, c'est que le motif du glob a
    // changé — une panne de mécanisme, pas de contenu. Elle doit crier.
    if (typeof fichiers[cle] !== 'string') {
      throw new Error(`[socle-js] ${nom} est déclaré et présent, mais le glob ne le rend pas. Motif du glob à revoir.`);
    }
    morceaux.push(fichiers[cle]);
    retenus.push(nom);
  }

  // ⚠️ `;\n` ENTRE DEUX MORCEAUX, ET CE N'EST PAS DE LA COQUETTERIE. Chaque
  // fichier est une IIFE ; deux IIFE collées sans séparateur se lisent comme un
  // appel de fonction — `(function(){})()(function(){})()` — et lèvent
  // « is not a function » à la première ligne, en emportant tout le socle.
  // ⭐ Le `\n` protège en plus des `//` de fin de fichier.
  const js = morceaux.join(';\n');

  // ⭐⭐ L'EMPREINTE EST DANS LE NOM, ET C'EST OBLIGATOIRE — même raison qu'au
  // lot 105, mesurée sur le même nginx : tout `.js` est servi en
  // `public, max-age=2592000, immutable`. Sur un nom FIXE, cette ligne servirait
  // le JavaScript d'avant pendant TRENTE JOURS à quiconque a visité le site une
  // fois : un déploiement parfaitement vert, invisible en navigation privée, et
  // signalé par les seuls habitués. Avec l'empreinte, un code qui change change
  // d'adresse — il n'y a plus rien à invalider.
  const empreinte = createHash('sha256').update(js).digest('hex').slice(0, 12);
  cache = {
    empreinte,
    nom: `socle-${empreinte}.js`,
    href: `/socle-${empreinte}.js`,
    js,
    // ⭐ EXPOSÉ POUR LE BANC, PAS POUR LE GABARIT. `test:feuille` a besoin de
    // savoir ce qui est PARTI pour distinguer « le socle a maigri » de « le
    // socle n'est plus servi » — deux états qui font baisser le même nombre et
    // qui sont l'inverse l'un de l'autre.
    morceaux: retenus,
    octets: Buffer.byteLength(js),
  };
  return cache;
}

// ═══════════════════════════════════════════════════════════════════════════
// LES MODULES DE COMPOSANT
// ═══════════════════════════════════════════════════════════════════════════
const cacheModules = new Map();

/**
 * Rend `{ empreinte, nom, href, js }` pour un module de `src/socle/modules/`.
 * Le composant appelle `moduleJs('cadran')` et émet
 * `<script defer src={…href}></script>` lui-même.
 *
 * ⛔ PAS DE REPLI SILENCIEUX, ET C'EST LE POINT LE PLUS IMPORTANT DE CETTE
 * FONCTION. Un nom inconnu LÈVE, il ne rend pas une chaîne vide. Sans ce jet,
 * une faute de frappe dans `moduleJs('cardan')` produirait un `<script
 * src="/socle-.js">` — un 404 dans la console, une page qui s'affiche
 * parfaitement, un build vert, et un cadran mort sur 1 201 fiches que personne
 * ne relierait jamais à ce lot. *Le repli écrit avant la source, encore.*
 */
export function moduleJs(nom) {
  if (cacheModules.has(nom)) return cacheModules.get(nom);
  const cle = `../../src/socle/modules/${nom}.js`;
  if (typeof modules[cle] !== 'string') {
    const dispo = Object.keys(modules).map((k) => k.split('/').pop().replace(/\.js$/, ''));
    throw new Error(
      `[socle-js] moduleJs('${nom}') ne désigne aucun fichier. `
      + `Modules disponibles : ${dispo.join(', ') || '(aucun)'}. `
      + `Créer src/socle/modules/${nom}.js, ou corriger l'appel.`);
  }
  const js = modules[cle];
  const empreinte = createHash('sha256').update(js).digest('hex').slice(0, 12);
  const v = { empreinte, nom: `socle-${empreinte}.js`, href: `/socle-${empreinte}.js`, js, octets: Buffer.byteLength(js) };
  cacheModules.set(nom, v);
  return v;
}

/**
 * ⭐⭐ TOUT CE QUI DOIT ÊTRE ÉCRIT DANS `dist/`, socle et modules confondus.
 * La route `socle-[empreinte].js.js` l'appelle pour son `getStaticPaths`.
 *
 * 🔴 ELLE REND **TOUS** LES MODULES, y compris ceux qu'aucun composant
 * n'émettrait aujourd'hui. C'est délibéré : un module écrit dans `dist/` mais
 * jamais référencé coûte quelques kilo-octets sur le disque ; un module
 * référencé mais jamais écrit est un 404 sur une page de production. *Quand on
 * doit se tromper, on choisit le sens dans lequel se tromper.*
 */
export function toutLeJs() {
  const tout = [socleJs()];
  for (const cle of Object.keys(modules)) {
    tout.push(moduleJs(cle.split('/').pop().replace(/\.js$/, '')));
  }
  return tout;
}
