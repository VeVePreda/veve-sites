// ⚠️ VeVePreda/veve-sites — engine/lib/cote.mjs   (FICHIER NEUF — lot 101)
// ═══════════════════════════════════════════════════════════════════════════
// LA COTE — le prix COURANT et les extrêmes quittent le jeu de données public.
// ═══════════════════════════════════════════════════════════════════════════
//
// L'ARBITRAGE (Preda, 06/08/2026) : « on peut laisser le prix de drop mais pas
// le floor price actuel », « le market ne doit pas être visible en public »,
// et — 07/08 — « ATL/ATH derrière le mur, les graphes sans échelle restent
// publics ».
//
// 🔴🔴 CE QUI REND CE FICHIER NÉCESSAIRE, ET POURQUOI UN `<Gate>` N'AURAIT PAS
// SUFFI. Le mur existant (`gates.price_history` + `.reserve/`) ne protège que
// l'HISTORIQUE. La valeur COURANTE, elle, voyage dans le jeu de données qui
// alimente les ~8 500 pages PRÉ-GÉNÉRÉES : elle est dans le HTML servi, dans
// le JSON-LD `offers.price`, et dans le cache de Google. Masquer par du CSS ou
// par un composant conditionnel n'y change rien — c'est la leçon du lot 27 :
// ⭐⭐⭐ CE QUI NE DOIT PAS FUITER NE DOIT PAS ÊTRE DANS `dist/`.
// On ne cache donc pas le champ : ON NE LE PROJETTE PAS.
//
// ⭐⭐ POURQUOI LA PROJECTION EST LA DERNIÈRE ÉTAPE, ET PAS LA PREMIÈRE.
// Le floor pilote encore, en interne : le classement de la vitrine
// (`scoreUtilite`), le tri des sets, le repère d'aberration, les mouvements.
// Retirer le champ à la lecture du catalogue casserait tout ça en silence — on
// aurait un site propre et un classement aléatoire. `projeter()` s'appelle donc
// APRÈS que tout ce qui dépend du prix a été calculé, et les tris déjà faits
// survivent dans l'ORDRE DES TABLEAUX. ⛔ Un gabarit qui re-trierait sur
// `item.floor` après ce lot trierait sur `undefined` — silencieusement, dans
// l'ordre d'insertion. C'est le seul piège de ce fichier : les tris migrent
// dans dataset.mjs, ils ne restent pas dans les .astro.
//
// ⭐⭐⭐ LA COURBE SURVIT, L'ÉCHELLE NON — et c'est ce qui la rend partageable.
// Preda veut garder le graphe public (« pub partageable »). Une courbe dont on
// retire les graduations reste une FORME : elle raconte la tendance et ne dit
// aucun prix. ⛔ Mais laisser les vraies valeurs dans le tableau « puisque le
// SVG les normalise » serait la faute du `voile()` de la maquette, en pire :
// on ferait confiance au rendu pour ne pas les écrire. On NORMALISE donc la
// donnée elle-même, à la source, en 0..1000. Après `projeter()`, il n'existe
// plus une seule valeur en gems côté public — la fuite n'est pas improbable,
// elle est IMPOSSIBLE.

// 🔴🔴🔴 LOT 117 — `readFileSync` MANQUAIT ICI, ET LA PAGE `/market/` ETAIT
// MUETTE POUR LES SEULS ABONNES DEPUIS LE LOT 104.
// `lireCotes()` (bas de fichier) l'appelait sans qu'il soit importe. L'appel
// levait `ReferenceError: readFileSync is not defined` — DANS UN `try/catch`
// ecrit pour un JSON corrompu. La reserve etait donc declaree ILLISIBLE pour
// CHAQUE uuid, `lireCotes()` rendait `{}`, et `/market/` servait 200 lignes de
// tirets avec un tri par prix mort. Build vert, Dockerfile vert (il compte les
// FICHIERS de `.reserve/cote/`, il ne les LIT pas), aucune erreur nulle part.
// ⭐⭐⭐ CE QU'IL FAUT EN RETENIR, ET C'EST PLUS GRAND QUE CETTE LIGNE :
// UN CONTROLE QUI PROUVE L'ECRITURE NE PROUVE PAS LA LECTURE. Le circuit
// n'etait ferme qu'a une extremite — « qui ecrit, qui lit ? ». `test:projection`
// (lot 117) fait desormais l'aller-retour complet : il ecrit une cote temoin,
// la relit par `lireCotes()`, et rougit si elle ne revient pas.
// ⛔ ET LE MESSAGE DE DIAGNOSTIC ACCUSAIT LE MAUVAIS COUPABLE : « reserve
// absente de l'image ? » aurait envoye chercher la panne dans le Dockerfile.
// Une phrase de diagnostic qui ne nomme qu'UNE cause en exclut les autres.
import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join , dirname } from 'node:path';
import { porte } from './access.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();

// ⭐ Même emplacement et même raison que `reserve.mjs` : HORS de `dist/`, nom
// commençant par un point, à la racine du projet. `test_reserve.mjs` fait déjà
// échouer le build si un fichier de `.reserve/` apparaît sous `dist/`.
export const COTE_DIR = process.env.RESERVE_COTE_DIR || join(ROOT, '.reserve', 'cote');

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidValide = (u) => RE_UUID.test(String(u || ''));

// ═══════════════════════════════════════════════════════════════════════════
// CE QUI PART DERRIÈRE LE MUR — la liste, et rien qu'elle
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ ÉCRITE UNE FOIS, LUE PAR TOUT LE MONDE : la projection, la réserve, la
// route d'API et le banc anti-fuite lisent CETTE constante. Deux définitions
// de « ce qui est un prix » divergeraient un jour, et le jour où elles
// divergent, c'est la version la plus permissive qui est en production.
export const CHAMPS_COTE = [
  'floor',        // le prix plancher COURANT — le cœur de l'arbitrage
  'ath', 'atl',   // les extrêmes (Preda, 07/08 : derrière le mur)
  'athDate', 'atlDate',
  'prixMedian', 'p95',   // des prix aussi, même s'ils portent un nom de statistique
  // 🔴🔴 LOT 117 — LA VARIATION REJOINT LA COTE. C'était la dette annoncée par
  // le lot 112 (« ⏳ le lot suivant le projette ET restitue la clé de tri »).
  // ⭐⭐⭐ L'ARGUMENT D'ORIGINE ÉTAIT CORRECT ET NE SUFFISAIT PAS : « une
  // variation sans niveau ne permet pas de reconstituer un prix » — vrai, et
  // hors sujet. `/market/` est réservé PARCE QUE « les plus fortes variations »
  // EST le produit. La question n'était pas « peut-on en déduire un montant ? »
  // mais « est-ce ce qu'on vend ? ». Mesuré le 10/08 : 1 700 pourcentages en
  // clair sur l'accueil. Le lot 112 les a fermés DANS LES GABARITS ; ce lot-ci
  // les retire DE LA DONNÉE — on ne cache pas un champ, on ne le projette pas.
  'change7d', 'change30d',
];

// ⛔ CE QUI RESTE PUBLIC, ET POURQUOI — à relire avant d'ajouter une ligne
// au-dessus. `storePrice` : le PRIX DE DROP, explicitement conservé par Preda,
// et il ne dit rien du marché d'aujourd'hui. `listings` : un COMPTE d'offres,
// pas un montant — et c'est lui qui permet à la fiche d'avertir qu'une offre
// isolée porte le plancher, ce que la FAQ promet. `prixAberrant` : un drapeau
// d'honnêteté éditoriale, sans montant. `courbe` : une forme normalisée 0..1000,
// sans échelle — c'est la « pub partageable » voulue par Preda.
// ⛔ `change7d`/`change30d` ONT QUITTÉ CETTE LISTE AU LOT 117. Ce paragraphe
// les y a gardés pendant onze lots sur un raisonnement juste — « on n'en déduit
// pas un montant » — qui ne répondait pas à la bonne question.
// ⭐⭐⭐ *Un principe correct devient un angle mort dès qu'il dispense de
// regarder.* La bonne question pour cette liste n'est pas « peut-on
// reconstituer un prix ? » mais « est-ce que c'est ce qu'on VEND ? ».

// ═══════════════════════════════════════════════════════════════════════════
// LE PREDICAT — « la cote est-elle fermee sur ce site ? »
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ NOMME UNE FOIS, ICI, ET IMPORTE PAR LES SIX GABARITS. La premiere version
// de ce lot ecrivait `porte('cote').actif` dans Carte, Item, Home, Collections,
// CollectionPage et Analytics : six copies d'une meme question, dont cinq
// auraient survecu au jour ou la reponse change de forme.
//
// ⭐⭐⭐ ET IL Y A UNE SECONDE RAISON, PLUS INTERESSANTE. `test:session` refuse
// qu'un fichier melange le cookie d'affichage et une decision de DROIT. Le
// script de remplissage (`CoteScript.astro`) porte forcement ce cookie, et doit
// forcement savoir s'il a lieu d'exister. ⛔ La reponse n'etait PAS d'assouplir
// le banc, ni de recopier son motif ailleurs pour lui echapper :
// ⭐ `coteFermee()` N'EST PAS UNE DECISION DE DROIT. Elle ne regarde aucune
// session, elle rend LA MEME VALEUR pour tous les visiteurs, et elle est connue
// au build. C'est une question de MANIFESTE — « ce site vend-il sa cote ? » —
// pas une question de palier — « cette personne y a-t-elle droit ? ». Les deux
// vivaient dans le meme appel, et c'est le banc qui a rendu la confusion
// visible. Le predicat separe les deux questions au lieu de les melanger.
// ⛔ NE JAMAIS lui faire prendre `locals` en parametre : ce serait exactement
// refaire la confusion, et le nom ne le dirait plus.
export const coteFermee = () => porte('cote').actif;

const estActive = coteFermee;

/** La valeur d'un point de courbe, normalisée 0..1000 sur SA PROPRE série.
 *  ⚠️ Entier : un flottant à 12 décimales rendrait le prix reconstructible par
 *  qui connaîtrait deux points réels — la normalisation serait décorative. */
function normaliser(points) {
  const ys = points.map((p) => Number(p.floor)).filter(Number.isFinite);
  if (ys.length < 2) return [];
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = (y1 - y0) || 1;
  return points
    .filter((p) => Number.isFinite(Number(p.floor)))
    .map((p) => [
      Math.round(new Date(p.ts).getTime() / 1000),
      Math.round(((Number(p.floor) - y0) / span) * 1000),
    ]);
}

// ═══════════════════════════════════════════════════════════════════════════
//  LA RÉSERVE — ce que la route d'API servira aux seuls porteurs de session
// ═══════════════════════════════════════════════════════════════════════════
let ecrits = 0;
let refuses = 0;

// ═══════════════════════════════════════════════════════════════════════════
// LE JOURNAL DE PROJECTION — et pourquoi il ne fait pas doublon
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LE PIEGE QU'IL DESAMORCE A DEJA ETE PAYE UNE FOIS, MOT POUR MOT, SUR
// `reserve.mjs` : « la reserve n'avait JAMAIS tourne sur de vraies donnees
// quand elle a ete livree — hors reseau, `engine/data/sample` n'a pas de vrais
// uuid, donc la liste blanche les refuse tous et le chemin complet n'est jamais
// exerce ». Mesure du 07/08 : les uuid de l'echantillon valent
// `sample-0033-570553`. La liste blanche les refuse TOUS, et
// `.reserve/cote/` sort VIDE de tout build hors reseau — donc de la CI.
//
// ⭐⭐⭐ CONSEQUENCE, ET C'EST ELLE QUI COMPTE : le banc anti-fuite, qui compare
// les VRAIS montants au HTML publie, n'aurait eu aucun montant a comparer. Il
// serait vert, en CI, pour toujours, et pour la seule raison qui rend un banc
// inutile — il n'a rien a mesurer. C'est exactement « un instrument branche en
// aval de la panne mesure la panne avec la panne ».
//
// ⭐ Ce fichier-ci est ecrit pour TOUS les items, uuid valide ou non, parce
// qu'il ne compose aucun chemin depuis une donnee d'entree : son nom est une
// constante. La liste blanche protege les fichiers SERVIS ; elle n'a pas a
// aveugler les fichiers de CONTROLE.
// ⛔ IL NE DOIT JAMAIS ETRE SERVI. Il vit dans `.reserve/` (hors de `dist/`,
// trois barrieres deja en place) et son nom commence par `_` : `uuidValide()`
// le refuse, donc ni `/api/cote/[uuid]` ni `/api/cote/lot` ne peuvent le lire,
// meme en le demandant nommement.
export const JOURNAL = '_projection.json';
const journal = {};

function deposer(item, courbe) {
  const cote = {};
  for (const champ of CHAMPS_COTE) {
    if (item[champ] !== undefined && item[champ] !== null) cote[champ] = item[champ];
  }
  // ⭐ On dépose aussi ce qui n'a de sens qu'À CÔTÉ d'un prix : un abonné qui
  // reçoit `floor` sans `listings` ne peut pas juger si le plancher tient sur
  // une seule offre. La réserve sert une VUE, pas une colonne.
  cote.listings = item.listings ?? null;
  cote.prixAberrant = !!item.prixAberrant;
  // 🔴🔴🔴 LOT 123 — LA COURBE PUBLIQUE PASSE DANS LA RÉSERVE.
  // Arbitrage Preda du 10/08 : « le graphique visible seulement une fois
  // connecté ». Jusqu'ici elle était NORMALISÉE (0..1000, aucun montant
  // lisible) et écrite dans le HTML de chaque fiche, où elle servait de fond
  // flouté au panneau verrouillé — donc servie à tout le monde, robots
  // compris, tout en n'étant lisible par personne.
  // ⭐⭐⭐ ON NE CACHE PAS UN CHAMP, ON NE LE PROJETTE PAS — la règle du lot
  // 101, appliquée cette fois à la FORME et plus seulement aux montants. Une
  // courbe sans échelle ne dit aucun prix, mais elle dit une TENDANCE, et
  // Preda a tranché qu'elle valait un compte.
  // ⚠️ Elle est déposée avec la cote, donc derrière la porte `cote` — le
  // palier qu'un membre franchit. L'historique COMPLET reste derrière
  // `price_history` (crevette) : deux profondeurs, deux portes, un seul bloc
  // à l'écran.
  if (courbe && courbe.length >= 2) cote.courbe = courbe;
  cote.maj = new Date().toISOString();

  // Le journal d'abord : il doit contenir CE QU'ON A RETIRE, y compris pour un
  // item dont l'uuid n'aura pas de fichier servi.
  journal[item.uuid] = cote;

  // 🔴 La liste blanche ne garde que L'ECRITURE DU FICHIER SERVI : `item.uuid`
  // compose ici un CHEMIN. Un `veve_uuid` valant `../../dist/index.html`
  // ecrirait ou il veut. On ne nettoie pas, on n'echappe pas — ON REFUSE.
  if (!uuidValide(item.uuid)) { refuses++; return; }
  writeFileSync(join(COTE_DIR, item.uuid + '.json'), JSON.stringify(cote), 'utf8');
  ecrits++;
}

/** ═════════════════════════════════════════════════════════════════════════
 *  LA PROJECTION PUBLIQUE — appelée UNE fois, à la toute fin de `dataset()`.
 *  ═════════════════════════════════════════════════════════════════════════
 *  ⚠️ ELLE MUTE LES ITEMS EN PLACE, volontairement. `bySlug`, `collections`,
 *  `rarities` et `movers` pointent tous vers LES MÊMES objets : rendre une
 *  copie laisserait quatre chemins par lesquels le prix atteindrait encore le
 *  HTML, et ces quatre-là sont exactement ceux qu'on veut fermer.
 *  ⭐ C'est aussi ce qui rend le banc anti-fuite crédible : il n'existe qu'un
 *  seul jeu d'objets, donc un seul endroit à prouver. */
export function projeter(items) {
  if (!estActive()) {
    // ⭐ Un site sans porte `cote` (vevewiki, ou veveprice si Preda rouvre)
    // ne paie RIEN : ni écriture, ni normalisation, ni champ perdu. Le
    // manifeste décide, le code obéit — même dispositif que `<Cadran>`.
    return { actif: false, ecrits: 0, projetes: 0 };
  }

  // Le dossier est recréé à neuf : une cote de la veille servie pour un prix
  // du jour serait pire qu'une absence, et personne ne le verrait.
  if (existsSync(COTE_DIR)) {
    for (const f of readdirSync(COTE_DIR)) rmSync(join(COTE_DIR, f), { force: true });
  } else {
    mkdirSync(COTE_DIR, { recursive: true });
  }
  ecrits = 0; refuses = 0;
  for (const k of Object.keys(journal)) delete journal[k];

  for (const item of items) {
    // 🔴 L'ORDRE A CHANGÉ AU LOT 123, ET IL COMPTE : `normaliser()` lit
    //    `history[].floor`, donc la courbe se calcule TANT QUE l'historique
    //    existe — puis elle part dans la réserve avec la cote, et non plus sur
    //    l'objet public. ⛔ Déplacer `deposer()` après le `delete` déposerait
    //    une cote vide, sans qu'aucune erreur ne le dise.
    const courbe = normaliser(item.history || []);
    deposer(item, courbe);
    // ⛔ `item.courbe` N'EXISTE PLUS. Un gabarit qui la lirait rendrait
    //    `undefined` — c'est voulu, et `test:projection` le vérifie : la
    //    courbe ne doit plus voyager dans le jeu de données public.
    delete item.history;
    for (const champ of CHAMPS_COTE) delete item[champ];
  }

  writeFileSync(join(COTE_DIR, JOURNAL), JSON.stringify({
    maj: new Date().toISOString(),
    projetes: items.length, ecrits, refuses,
    champs: CHAMPS_COTE,
    valeurs: journal,
  }), 'utf8');

  console.log('[cote] porte « cote » ACTIVE : ' + CHAMPS_COTE.length + ' champs retires du jeu public sur ' + items.length + ' fiches · ' + ecrits + ' cotes deposees dans .reserve/cote/');
  if (refuses) {
    // ⚠️ CE N'EST PAS UNE ERREUR HORS RESEAU, ET C'EN EST UNE EN PRODUCTION.
    // L'echantillon porte des identifiants `sample-…`, refuses par construction.
    // Un catalogue REEL n'en porte aucun : le meme chiffre veut donc dire deux
    // choses opposees selon la source, et c'est pour ca qu'il est CHIFFRE ici
    // au lieu d'etre un simple avertissement. `test:fuite` le relit.
    console.log('[cote] ' + refuses + ' uuid refuse(s) par la liste blanche (attendu hors reseau : '
      + 'l echantillon porte des identifiants « sample-… » ; ANORMAL sur un catalogue reel).');
  }
  if (items.length && !ecrits && !refuses) {
    console.log('[cote] ATTENTION aucune cote deposee et aucun refus : la projection n a rien vu passer.');
  }
  return { actif: true, ecrits, refuses, projetes: items.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LOT 104 — LIRE LA RESERVE DEPUIS UNE PAGE, ET PAS SEULEMENT DEPUIS UNE API
// ═══════════════════════════════════════════════════════════════════════════
// LE BESOIN. `/market/` rend jusqu'a 200 lignes chiffrees. Le motif habituel
// — page pre-generee vide + `<Cote>` rempli par `/api/cote/lot` — ne tient pas
// ici : cette route plafonne a 60 uuid (MAX_LOT), et le dupliquer a 200 ferait
// d'un plafond de securite une variable d'affichage.
//
// ⭐⭐ LA PAGE EST DONC RENDUE A LA DEMANDE, ET ELLE LIT LA RESERVE ELLE-MEME.
// C'est legitime, et a une condition qui n'est pas negociable : elle n'est
// JAMAIS pre-generee. Une page pre-generee ecrirait 200 montants dans `dist/`,
// servis en clair par nginx a qui connait l'adresse — la fuite exacte que le
// lot 101 a fermee, par la porte d'a cote.
// 🔴 TROIS VERROUS, PARCE QU'UN SEUL SE DEFAIT SANS BRUIT :
//   1. `pages/market.astro` est inscrite dans ROUTES_COMPTE (astro_routes_compte.mjs) ;
//   2. la page refuse et redirige quand `franchit()` dit non ;
//   3. `test:fuite` balaie DESORMAIS tout `dist/`, plus seulement la page de
//      chaque piece — si un montant reapparait ou que ce soit, il le voit.
// ⛔ Retirer l'un des trois rend les deux autres insuffisants : le 1 empeche la
// fuite, le 2 empeche l'acces, le 3 est le seul qui MESURE.

/** Lit la reserve pour une liste d'uuid. Rend `{ uuid: cote }`, sans les absents.
 *  ⚠️ AUCUN CONTROLE DE DROIT ICI, ET C'EST DELIBERE : cette fonction lit un
 *  disque, elle ne juge personne. L'appelant DOIT avoir appele `franchit()`
 *  avant. Melanger « lire » et « avoir le droit de lire » dans une meme
 *  fonction est la faute qui produit les elevations de privilege — c'est ce que
 *  `access.mjs` dit deja de `sessionDe()` contre `palierVisiteur()`. */
export function lireCotes(uuids) {
  const out = {};
  let absents = 0;
  for (const u of [...new Set(uuids || [])]) {
    // ⭐ La liste blanche s'applique a CHAQUE element : un seul uuid mal forme
    // suffit a composer un chemin. `_projection.json` est refuse par elle, donc
    // le journal de controle reste illisible depuis toute voie servie.
    if (!uuidValide(u)) { absents++; continue; }
    const chemin = join(COTE_DIR, `${u}.json`);
    if (!existsSync(chemin)) { absents++; continue; }
    try { out[u] = JSON.parse(readFileSync(chemin, 'utf8')); }
    catch (e) { absents++; console.warn(`[cote] reserve illisible pour ${u} : ${e.message}`); }
  }
  // ⚠️ MEME CAPTEUR QUE LES DEUX ROUTES D'API, et il compte autant ici : sans
  // lui, une reserve non copiee dans l'image rendrait la page de marche
  // integralement en tirets, pour les seuls abonnes, sur un deploiement vert.
  const n = [...new Set(uuids || [])].length;
  if (n && absents === n) {
    // ⚠️ TROIS CAUSES, PAS UNE — et la version qui n'en nommait qu'une a coûté
    // le lot 117 : elle envoyait chercher dans le Dockerfile une panne qui
    // tenait à un import manquant six lignes plus haut.
    console.warn(`[cote] AUCUNE des ${n} cotes demandees n'a pu etre lue (${COTE_DIR}). `
      + `Trois causes possibles, dans cet ordre de cout : (1) une ERREUR DE LECTURE `
      + `avalee par le catch ci-dessus — relire les lignes « reserve illisible » `
      + `au-dessus, elles portent le vrai message ; (2) la reserve n'a pas ete `
      + `copiee dans l'image ; (3) le build n'a depose aucune cote.`);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 125 — LA PROJECTION DU MARCHE, ET POURQUOI ELLE EXISTE
// ═══════════════════════════════════════════════════════════════════════════
// MESURE DU 10/08/2026, serveur reel lance dans le bac a sable :
//     premiere requete a /market/ : 10 440 ms   <<<
//     requetes suivantes          :     55 ms
//     dont `await dataset()` froid: 10 328 ms   (99 % du total)
//     dont `lireCotes(200)`       :      3 ms
//
// ⭐⭐⭐ LE SOUPCON ETAIT FAUX. La note « /market/ ouvre 200 fichiers JSON par
// requete » etait ecrite dans la memoire du projet et elle designait le mauvais
// coupable : ces 200 lectures coutent TROIS MILLISECONDES. Le temps est ailleurs,
// entierement, et il fallait le mesurer pour le voir.
//
// CE QUE FAISAIT `dataset()` A LA DEMANDE, DANS LE PROCESSUS QUI SERT LA PAGE :
//   1. telecharger 3 Releases GitHub (catalogue 19 412, baselines 13 835) ;
//   2. lire EN FLUX 2 372 025 lignes de prix ;
//   3. recalculer toute la vitrine (quotas, gels, medianes, extremes) ;
//   4. REECRIRE les 1 201 fichiers de `.reserve/cote/` — 9,1 Mo — sous les pieds
//      du serveur en train de repondre.
// ⛔ Autrement dit : le travail de BUILD refait a l'arrivee d'un visiteur.
//
// ⭐⭐ ET C'EST LA SEULE PAGE QUI LE PAIE. Les vingt autres appels a `dataset()`
// (comics, collectibles, blog, sitemap, search-index…) sont dans des pages
// PRE-GENEREES : ils s'executent au build, une fois. `/market/` est rendue a la
// demande — le meme appel y devient un telechargement par visite.
// 🔴 La memoisation (`_ds`) ne sauve rien : elle vit dans le processus. Chaque
// redemarrage du conteneur la vide, et `rebuild-daily` deploie deux fois par
// jour (cinq deploiements en treize minutes le 10/08 au matin). Le premier
// visiteur apres chaque deploiement paie les dix secondes.
//
// LA SORTIE : ce que la page a besoin de savoir est DEJA CALCULE AU BUILD. On
// le depose, on le relit. C'est exactement le motif de `.reserve/cote/` juste
// au-dessus — et exactement la regle « la donnee manquante est presque toujours
// deja collectee puis jetee ».
// ⛔ AUCUN REPLI VERS `dataset()` : un repli legitime est la meilleure cachette
// d'une panne. Si le fichier manque, l'image est mal construite et il faut que
// ca se voie — `test:marche` le dit au build, avant le deploiement.

/** Le fichier depose au build, lu a la demande. Voisin de `.reserve/cote/`,
 *  hors de lui : `uuidValide()` refuse tout nom qui n'est pas un uuid, et la
 *  projection n'en est pas un. */
export const MARCHE_FICHIER = process.env.RESERVE_MARCHE || join(ROOT, '.reserve', 'marche.json');

/** Depose la projection. Appele UNE FOIS, a la fin de `dataset()`, donc au build.
 *  ⚠️ On ne depose PAS `ds` en entier : `ds.items` fait 19 412 lignes et la page
 *  n'en rend que 200. Faire voyager le reste serait remplacer un cout par un autre. */
export function deposerMarche(ds) {
  mkdirSync(dirname(MARCHE_FICHIER), { recursive: true });
  const charge = {
    genereLe: new Date().toISOString(),
    updatedAt: ds.updatedAt,
    // ⭐ `itemsTotal` et pas `items` : la page n'affiche que le NOMBRE.
    itemsTotal: Array.isArray(ds.items) ? ds.items.length : 0,
    marcheTotal: ds.marcheTotal,
    marche: ds.marche,
  };
  writeFileSync(MARCHE_FICHIER, JSON.stringify(charge), 'utf8');
  console.log(`[marche] projection deposee : ${charge.marche.length} ligne(s) sur ${charge.marcheTotal}, `
    + `${(JSON.stringify(charge).length / 1024).toFixed(0)} Ko — /market/ ne rappellera plus dataset()`);
  return charge;
}

/** Relit la projection. ⛔ NE RETOMBE SUR RIEN, VOIR LE BLOC CI-DESSUS. */
export function lireMarche() {
  if (!existsSync(MARCHE_FICHIER)) {
    throw new Error(
      `[marche] projection absente (${MARCHE_FICHIER}). Trois causes, dans cet ordre de cout : `
      + `(1) le build n'a pas appele deposerMarche() — la porte « cote » etait-elle active ? ; `
      + `(2) \`.reserve/\` n'a pas ete copiee dans l'image (COPY --from=build /app/.reserve) ; `
      + `(3) RESERVE_MARCHE pointe ailleurs. `
      + `⛔ On ne retombe PAS sur dataset() : ce repli couterait 10 s par visite et masquerait la panne.`);
  }
  const c = JSON.parse(readFileSync(MARCHE_FICHIER, 'utf8'));
  if (!Array.isArray(c.marche)) throw new Error(`[marche] projection illisible : champ \`marche\` absent`);
  return c;
}
