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
// 🔴 LOT 155-C ③ — LA MENTION D'ÉDITION EST CALCULÉE ICI, AU BUILD.
// ⛔ `vitrine.mjs` n'importe RIEN (vérifié) : aucun cycle possible.
import { mentionEdition } from './vitrine.mjs';

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
  // 🔒 LOT 144 — LE PLANCHER STACKR, ET IL N'Y A PAS A HESITER : C'EST UN PRIX.
  // Il arrive de `releves.csv` en OMI. Le publier serait la fuite du lot 101
  // refaite par la porte d'a cote — un montant exact, sur 652 fiches, en clair.
  // ⛔ Il ne se convertit PAS en dollars : `sfloors` (OMI) et `vfloors` (USD)
  // sont deux MARCHES, rapport non constant (mediane 4 423, p10 2 273,
  // p90 8 520 sur 1 306 items communs). Une conversion inventerait un chiffre.
  'floorStackr',
];

// ═══════════════════════════════════════════════════════════════════════════
// LA LIGNE DE PARTAGE, ECRITE DANS LE CODE — lot 144
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ ELLE EST TENUE DANS LES DEUX SENS, ET C'EST TOUT LE POINT. Un lot qui
// ne garderait que « aucun prix ne fuit » laisserait passer son exact contraire :
// tout reserver, y compris la DATE — et la fiche redeviendrait muette sans
// qu'un seul run rougisse. Les mutants M5 et M6 du banc de fraicheur sont
// opposes pour cette raison.
//
// Pourquoi une DATE reste publique alors que `athDate` ne l'est pas : la date
// d'un EXTREME, croisee a une courbe, DESIGNE un montant (« le plus haut, c'est
// ce pic-la »). Une date de RELEVEMENT ne designe rien du tout — elle repond a
// « ces chiffres datent de quand ? », qui est la question qu'un visiteur pose
// avant meme de regarder un prix, et a laquelle 1 200 fiches repondaient par
// l'heure du deploiement.
// 🔴 LOT 146 — LES DEUX DATES PAR MARCHE ENTRENT ICI, ET CE N'EST PAS DU
// ZELE. Sans cette ligne l'invariant ci-dessous ne les couvre pas : on
// pourrait les glisser dans `CHAMPS_COTE` sans qu'aucun banc ne bronche, et
// les murs se remettraient a se taire derriere le cadenas.
export const CHAMPS_FRAICHEUR = ['releveLe', 'releveSource', 'derniereVariation',
  'releveVeveLe', 'releveStackrLe'];

// ⛔⛔ UN INVARIANT, PAS UN COMMENTAIRE. Le jour ou quelqu'un ajoutera
// `releveLe` a `CHAMPS_COTE` — de bonne foi, « c'est lie a un prix » — ce
// module refusera de se charger, dans le build comme dans les 42 bancs, avant
// qu'une seule page soit rendue. Une regle tenue par la discipline seule se
// defait au lot suivant.
{
  const collision = CHAMPS_FRAICHEUR.filter((c) => CHAMPS_COTE.includes(c));
  if (collision.length) {
    throw new Error(
      `[cote] LIGNE DE PARTAGE VIOLEE : ${collision.join(', ')} est a la fois public et reserve. `
      + 'Un champ de FRAICHEUR ne peut pas entrer dans CHAMPS_COTE : la fiche cesserait de dire '
      + 'quand sa donnee a ete relevee, et aucun banc ne le verrait comme une panne.');
  }
}

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
// ═══════════════════════════════════════════════════════════════════════════
// 🔢 LE TROISIEME NOMBRE : LE COMPTE D'OFFRES — LOT 171 (21/08/2026)
// ═══════════════════════════════════════════════════════════════════════════
// Demande de Preda, point `v` : « le tableau Floor Price contient les listings »
// — le TABLEAU les avait deja, **la COURBE, elle, manquait**.
//
// ⭐⭐⭐ ET IL SORT EN CLAIR, PAS NORMALISE. C'EST DELIBERE ET C'EST SUR.
// `listings` est un COMPTE D'OFFRES, pas un montant. Ce fichier l'ecrit deja
// noir sur blanc plus haut (« `listings` : un COMPTE d'offres, [...] sans
// montant ») et le publie deja tel quel : `cote.listings = item.listings`.
// Un nombre d'annonces ne permet de reconstituer aucun prix, meme croise a la
// courbe : savoir qu'il y avait 6 offres un mardi ne dit pas a combien.
// ⛔ C'est le `floor`, et lui seul, qui reste normalise 0..1000.
//
// ⚠️ LE TUPLE PASSE DE 2 A 3 ELEMENTS, ET C'EST RETROCOMPATIBLE PAR
//   CONSTRUCTION : `courbeSVG` filtre sur `p[0]` et `p[1]` et ignore la suite.
//   Un ancien fichier de reserve a deux elements continue de tracer la courbe
//   de prix, simplement sans la seconde ligne. ⛔ Ne JAMAIS reordonner ces
//   trois positions : il n'y a pas de nom pour les proteger.

/** La valeur d'un point de courbe, normalisée 0..1000 sur SA PROPRE série.
 *  ⚠️ Entier : un flottant à 12 décimales rendrait le prix reconstructible par
 *  qui connaîtrait deux points réels — la normalisation serait décorative.
 *  @returns {[number, number, number][]} [ts_secondes, prix_0_1000, offres] */
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
      // ⭐ `|| 0` et non `?? 0` : un `listings` absent, vide ou illisible vaut
      //   « on ne sait pas », et la seule reponse honnete a « combien
      //   d'offres » quand on ne sait pas est de ne rien tracer. Une ligne a
      //   zero, elle, AFFIRME qu'il n'y en avait aucune.
      Math.max(0, Math.round(Number(p.listings) || 0)),
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
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 131 — LE RÉSUMÉ, ET POURQUOI IL VOYAGE AVEC LA PROJECTION
// ═══════════════════════════════════════════════════════════════════════════
// Le tableau de bord montre des modules qui RÉSUMENT (demande de Preda, 10/08 :
// « des modules rapides qui résument et synthétisent, et donnent un accès
// rapide vers les vrais modules »). Résumer demande des NOMBRES.
// ⛔⛔ ET IL EST INTERDIT D'ALLER LES CHERCHER OÙ ILS SONT. `/dashboard/` est
// rendue À LA DEMANDE : un `await dataset()` y coûterait les 10 328 ms mesurées
// au lot 125 — 3 Releases retéléchargées et 2 372 025 lignes relues dans le
// processus qui sert la page. `test:marche` §3 refuse d'ailleurs tout appel à
// `dataset()` dans une route de compte ET dans ses composants.
// ⇒ Les nombres sont calculés AU BUILD, où `ds` est déjà là, et déposés ici.
//   C'est le motif de `.reserve/cote/` et de la projection : *la donnée
//   manquante est presque toujours déjà calculée, puis jetée.*
//
// ⭐⭐⭐ `null` ET SURTOUT PAS `0` QUAND LA SOURCE MANQUE — « inconnu ≠ zéro ».
// Un `0` se lit comme une mesure : « 0 set suivi » est une affirmation, et le
// tableau de bord l'afficherait tel quel. `null` dit « je n'ai pas compté », et
// le gabarit sait alors ne rien montrer plutôt que montrer faux.
// ⛔ AUCUN MONTANT ICI, JAMAIS. Ce sont des DÉNOMBREMENTS — combien de sets,
// combien de pièces. `test:marche` §2 balaie `CHAMPS_COTE` sur toute la charge,
// résumé compris : un plancher glissé dans un résumé serait la fuite du lot 101
// refaite par la porte d'à côté, et il la verrait.
const nombreOuNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function resumerPourLeTableauDeBord(ds) {
  const rayon = Array.isArray(ds.rayon) ? ds.rayon : null;
  return {
    // Ce que la vitrine PUBLIE (les fiches qui existent) contre ce que le
    // catalogue CONTIENT : les deux nombres ensemble disent la couverture, et
    // c'est la seule façon honnête d'annoncer « 1 200 » sans laisser croire
    // qu'on suit tout VeVe.
    publies: nombreOuNull(Array.isArray(ds.items) ? ds.items.length : undefined),
    catalogue: nombreOuNull(ds.catalogueSize),
    sets: nombreOuNull(ds.collections instanceof Map ? ds.collections.size : undefined),
    comics: nombreOuNull(rayon ? rayon.filter((r) => r.type === 'comic').length : undefined),
    collectibles: nombreOuNull(rayon ? rayon.filter((r) => r.type !== 'comic').length : undefined),
    aVenir: nombreOuNull(Array.isArray(ds.aVenir) ? ds.aVenir.length : undefined),
    // ⭐ Combien de drops à venir mènent RÉELLEMENT à une fiche. Le commentaire
    //   d'`AVenir.astro` affirmait « aucune fiche, donc aucune adresse » — c'est
    //   vrai de la plupart, pas de tous, et un avertissement qui survit à sa
    //   cause empêche de regarder. Ce nombre le rend mesurable à chaque build.
    aVenirCliquables: nombreOuNull(Array.isArray(ds.aVenir)
      ? ds.aVenir.filter((d) => d && d.path).length : undefined),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 155-D — LA PROJECTION NE PORTE QUE CE QUE LA PAGE LIT
// ═══════════════════════════════════════════════════════════════════════════
// MESURÉ, ET PAYÉ D'UN DÉPLOIEMENT ROUGE (17/08, étape 45/55) :
//     déploiement A ... 169 ms pour 15 802 Ko   (seuil 250 : vert, 32 % de marge)
//     déploiement B ... 887 ms pour 15 802 Ko   ❌ — même fichier, machine chargée
// Le lot 155-C a fait passer la projection de 200 à 8 840 lignes : 360 Ko → 15,8 Mo.
// La marge était déjà mince ; deux builds en parallèle l'ont mangée d'un coup.
//
// ⛔ RELEVER LE SEUIL AURAIT ÉTÉ LA MAUVAISE RÉPONSE — « un plafond relevé une
// fois de trop est un plafond désarmé », et celui-ci garde une vraie panne (les
// 10 328 ms du lot 125). ⭐ On réduit le TRAVAIL, pas le thermomètre.
//
// ⭐⭐⭐ LA LISTE EST L'INVENTAIRE DE CE QUE LE CODE LIT VRAIMENT — relevé sur
// `Market.astro` et `marche_selection.mjs`, pas deviné :
//     uuid · name · series · type · rarity · tirage · path · image · releaseDate
// Les 36 autres champs (dont `description`, **24,9 % du fichier à lui seul**,
// `veveUrl`, `veveMarketUrl`, `legacySlug`, `licensor`…) n'étaient lus par
// PERSONNE : ils voyageaient du build jusqu'au disque, et le serveur les
// reparsait à chaque requête. → `regle-donnee-collectee-puis-jetee`
//
// 🔴 ET LE GARDE-FOU EST DANS `test:marche` §9, PAS DANS UN COMMENTAIRE : il
// relit les deux fichiers, extrait chaque `i.<champ>` et EXIGE qu'il soit ici
// ou dans `CHAMPS_COTE`. Sans lui, la prochaine addition au gabarit lirait
// `undefined` — et une colonne vide n'a l'air d'une panne pour personne.
// ⚠️ Un champ qui vient de la COTE (floor, listings, change7d, courbe…) n'a
// rien à faire ici : il est réinjecté au rendu par `lireCotes()`.
// 🔴🔴🔴 LOT 155-C ③ — `ed` EST UN CHAMP DÉRIVÉ, ET C'EST MESURÉ.
// La page veut afficher FA/FE/AP. La source est `edition_type`, qui n'était
// PAS projeté : la colonne serait sortie VIDE sur les 8 840, sur un build vert
// — `regle-seconde-fabrique-ne-montre-que-sa-source`, quatrième fois.
// ⭐⭐⭐ MAIS ON NE PROJETTE PAS `edition_type` : on projette son VERDICT.
// Mesuré le 18/08 sur `catalogue.csv.gz` (18 839 fiches cotées) :
//     `edition_type` brut ........ 362,8 Ko  (+10,68 % de la projection)
//     la mention pré-calculée .....  19,7 Ko  (+0,58 %)   ⇒ 18,4× moins cher
// Parce que 90,2 % des valeurs sont des NUMÉROS de fascicule (`1`, `2`, `3`…)
// que `mentionEdition()` rejette — les transporter pour les jeter au rendu
// serait `regle-donnee-collectee-puis-jetee` à l'envers.
// ⚠️ SEULES 9,8 % DES FICHES EN PORTENT UNE (FE 978 · FA 774 · AP 106) : la
// clé est absente sur les neuf dixièmes, et `maigrir()` n'écrit pas les vides.
export const CHAMPS_MARCHE = ['uuid', 'name', 'series', 'type', 'rarity',
                              'tirage', 'path', 'image', 'releaseDate', 'ed'];

/** Ne garde que les champs de `CHAMPS_MARCHE`. ⛔ Une clé absente de la fiche
 *  n'est PAS écrite : `{image: undefined}` deviendrait `"image":null` dans le
 *  JSON, soit 14 octets par ligne pour dire « rien » — 124 Ko sur 8 840. */
export function maigrir(i) {
  const o = {};
  for (const k of CHAMPS_MARCHE) {
    // ⭐ `ed` n'est pas RECOPIÉ, il est CALCULÉ — il n'existe sur aucune fiche.
    //   Le laisser passer dans la boucle produirait `undefined`, donc rien,
    //   donc une colonne vide : exactement la panne que ce champ répare.
    if (k === 'ed') continue;
    if (i[k] !== undefined && i[k] !== null) o[k] = i[k];
  }
  // ⛔ `mentionEdition()` RESTE LE SEUL JUGE, ici comme dans les gabarits.
  //   Recopier la liste FA/FE/AP dans ce fichier ferait une deuxième vérité,
  //   et le jour où Preda ajoute `CE` elle divergerait en silence.
  //   ⭐ Il rend `''` pour tout ce qu'il ne reconnaît pas ⇒ le `if` suffit à
  //   n'écrire la clé que sur les ~9,8 % de fiches qui en portent une.
  const ed = mentionEdition(i.edition_type);
  if (ed) o.ed = ed;
  return o;
}

export function deposerMarche(ds) {
  mkdirSync(dirname(MARCHE_FICHIER), { recursive: true });
  const charge = {
    genereLe: new Date().toISOString(),
    updatedAt: ds.updatedAt,
    // ⭐ `itemsTotal` et pas `items` : la page n'affiche que le NOMBRE.
    itemsTotal: Array.isArray(ds.items) ? ds.items.length : 0,
    marcheTotal: ds.marcheTotal,
    resume: resumerPourLeTableauDeBord(ds),
    // ⭐ L'ORDRE EST CONSERVÉ : `maigrir()` filtre des CLÉS, il ne touche pas à
    //   la liste. L'ordre neutre posé dans `dataset.mjs` traverse intact.
    marche: (ds.marche || []).map(maigrir),
  };
  writeFileSync(MARCHE_FICHIER, JSON.stringify(charge), 'utf8');
  console.log(`[marche] projection deposee : ${charge.marche.length} ligne(s) sur ${charge.marcheTotal}, `
    + `${(JSON.stringify(charge).length / 1024).toFixed(0)} Ko — /market/ ne rappellera plus dataset()`);
  // ⭐ LE RÉSUMÉ S'ANNONCE, ET IL DIT SES TROUS. Un champ à `null` sort en
  // toutes lettres : c'est la seule façon de voir, DANS LE JOURNAL DE BUILD,
  // qu'un module du tableau de bord va rester muet — avant le déploiement, pas
  // après. Un résumé silencieusement incomplet serait invisible jusqu'à ce
  // qu'un membre ouvre sa page d'arrivée.
  const trous = Object.entries(charge.resume).filter(([, v]) => v === null).map(([k]) => k);
  console.log(`[marche] resume du tableau de bord : `
    + Object.entries(charge.resume).map(([k, v]) => `${k}=${v === null ? 'INCONNU' : v}`).join(' · ')
    + (trous.length ? `  ⚠️ ${trous.length} champ(s) INCONNU(S)` : ''));
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
  // 🔴🔴 LOT 155-D — ON NE RELIT LE FICHIER QU'UNE FOIS PAR PROCESSUS.
  // ⭐ Ce cache est LÉGITIME ici alors qu'il ne l'était pas au lot 125 pour
  // `dataset()`, et la différence tient en une phrase : `.reserve/` est déposée
  // AU BUILD et ne bouge plus de la vie du conteneur. Un contenu figé peut se
  // garder ; un calcul qui retélécharge 2,37 millions de lignes, non.
  // ⚠️ Le premier visiteur paie toujours la lecture — c'est ce que `test:marche`
  // mesure, et c'est pour ça que le fichier a MAIGRI en même temps (155-D) :
  // le cache masquerait le coût sans le supprimer, et le banc serait devenu
  // muet sur une dérive qu'il garde depuis le lot 125.
  // ⛔ Pas de `Date.now()`, pas de durée de vie : une expiration ferait relire un
  // fichier qui n'a pas changé, donc payer pour rien, à un moment imprévisible.
  if (_cacheMarche && _cacheMarcheDe === MARCHE_FICHIER) return _cacheMarche;
  const c = JSON.parse(readFileSync(MARCHE_FICHIER, 'utf8'));
  if (!Array.isArray(c.marche)) throw new Error(`[marche] projection illisible : champ \`marche\` absent`);
  _cacheMarche = c;
  _cacheMarcheDe = MARCHE_FICHIER;
  return c;
}

// ⚠️ LA CLÉ EST LE CHEMIN, ET JE DIS POURQUOI EXACTEMENT — parce que la raison
// évidente est fausse : `MARCHE_FICHIER` est calculé UNE FOIS, à l'import,
// donc changer `RESERVE_MARCHE` après coup ne le déplace pas. La clé ne sert
// donc à rien AUJOURD'HUI. Elle coûte deux comparaisons et elle couvre le jour
// où quelqu'un rendra ce chemin dynamique : ce jour-là, un cache aveugle
// servirait la projection d'un autre fichier, en silence, à un banc qui se
// croirait vert. → `regle-cle-de-cache-independante-du-contenu`
let _cacheMarche = null;
let _cacheMarcheDe = null;

/** ⛔ POUR LES BANCS UNIQUEMENT. Un cache qu'on ne peut pas vider est un cache
 *  qui rend un banc dépendant de l'ordre de ses propres sections. */
export function oublierMarche() { _cacheMarche = null; _cacheMarcheDe = null; }
