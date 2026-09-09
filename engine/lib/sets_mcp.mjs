// ⚠️ VeVePreda/veve-sites — engine/lib/sets_mcp.mjs   (FICHIER NEUF — lot 228)
// ═══════════════════════════════════════════════════════════════════════════
//  LE RENDEMENT MCP D'UN SET — « quels sets valent le plus par point gagné ? »
// ═══════════════════════════════════════════════════════════════════════════
//
// 🗣️ DEMANDE DE PREDA (05/09/2026), point `f` de l'audit du 14/08 :
// « posséder un set complet donne un bonus de points MCP, il est donc
//   intéressant d'avoir un outil qui permette de trier les sets les plus
//   intéressants en termes de $. On peut aussi exclure ceux qu'on possède si
//   l'utilisateur a renseigné son wallet. »
//
// ⭐⭐⭐ CE QUI DÉMONTRE CETTE FEATURE N'EST PAS L'ARGUMENT ÉVIDENT. VeVe
// applique des **doublons décroissants** : un 2ᵉ exemplaire du même set ne
// rapporte que **30 %**. Donc un `gems/MCP` identique pour tout le monde est
// FAUX dès la seconde copie, et « exclure ce que je possède » n'est pas un
// confort d'affichage — c'est la condition de véracité du classement.
// ⚠️ CE LOT NE FAIT PAS ENCORE CETTE EXCLUSION. Il pose l'agrégat et le tri ;
// l'exclusion par portefeuille vient après, et le fichier le dit à l'appelant
// par `personnalise: false`, pour qu'aucune étiquette ne promette l'inverse.
//
// ═══════════════════════════════════════════════════════════════════════════
//  🔴🔴 LE BARÈME — VÉRIFIÉ À LA SOURCE, PAS DÉDUIT
// ═══════════════════════════════════════════════════════════════════════════
// `veve.me/blog/veve/mcp/veve-master-collector-program-earning-mcp-points/`,
// lu le 05/09/2026. Points de **SET**, par jour, selon le NOMBRE de pièces :
//     5 pièces et plus → 5,0 · 4 → 4,0 · 3 → 3,0 · 2 → 2,0 · 1 → 1,0
// ⭐ Le barème PLAFONNE à 5. Un set de 40 pièces rapporte le même bonus de set
//   qu'un set de 5 — c'est ce plafond qui rend le classement intéressant, et
//   c'est aussi lui qu'une lecture rapide de la page VeVe fait manquer.
// ⛔ LE ONE-OFF DE 100 POINTS À LA COMPLÉTION N'EST PAS ICI, ET C'EST DÉLIBÉRÉ.
//   Ce module rend un rendement QUOTIDIEN. Mélanger un versement unique à un
//   débit journalier fabriquerait un chiffre qui ne décrit aucune durée.
//   L'étiquette de la page le mentionne à part ; le ratio ne le porte pas.
//
// ✅ LA PRÉMISSE EST MESURÉE DEPUIS LE LOT N (08/09/2026) — ET ELLE ÉTAIT
//   FAUSSE : « un set du site » n'était PAS « un Set de VeVe ». La clé
//   `<série> #<numéro>` (lot 71) confondait les réimpressions, et
//   `/api/analytics/sets_mcp?n=200` servait 176 numéros de comics sur 200,
//   hissés par ce bonus-là. Un set est désormais un `series_uuid` — la clé
//   de VeVe (comics : jamais plus de 5 pièces, 2 075/2 075 groupes de 5 à 5
//   raretés distinctes ; collectibles : 924 contre 936 « Sets » de `getSets`).
//   Voir `sets.mjs`, qui décide seul ce qu'est un set.
//   ⭐ La définition du set n'est toujours PAS recopiée ici : ce module
//   reçoit les `collections` déjà faites. Un seul endroit décide ce qu'est un
//   set — c'est exactement ce qui a rendu la correction locale.

import { mcpPoints } from './vitrine.mjs';

/** ⭐ LE PLAFOND, NOMMÉ. Écrit en clair plutôt que glissé dans un `Math.min` :
 *  c'est une décision de VeVe, pas une borne technique, et le jour où elle
 *  change c'est cette constante qu'on vient corriger. */
export const SET_POINTS_MAX = 5;

/**
 * Points de SET par jour pour un set de `taille` pièces, ou `null` si la
 * taille n'est pas un entier positif.
 * ⛔ `null` ET NON `0` : « je ne sais pas combien de pièces » et « ce set ne
 *    rapporte rien » sont deux choses, et `Number('')` vaut 0 — c'est le
 *    piège qui a déjà coûté au projet (`regle-vide-nest-pas-zero`).
 */
export const pointsDeSet = (taille) => {
  const n = Number(taille);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return Math.min(SET_POINTS_MAX, n);
};

/**
 * L'agrégat d'UN set. Prend une `collection` de `dataset.mjs`
 * (`{ slug, name, brand, licensor, items[] }`) et rend un objet plat.
 *
 * ⭐⭐ TROIS REFUS DÉLIBÉRÉS, dans l'esprit de `parMcp()` de
 * `marche_selection.mjs` — un chiffre absent vaut mieux qu'un chiffre inventé :
 *
 *  ① **UNE SEULE PIÈCE SANS PLANCHER ⇒ `cout = null`.** Le coût d'un set est
 *     le prix de TOUTES ses pièces. Sommer celles qu'on a et publier le total
 *     rendrait un set incomplet moins cher qu'un set complet — le classement
 *     remonterait exactement les sets les moins bien connus, et il aurait
 *     l'air de marcher. ⇒ `couvert` dit combien de pièces ont un plancher, et
 *     le ratio n'existe QUE si elles l'ont toutes.
 *  ② **UNE PIÈCE SANS BARÈME NE VAUT PAS ZÉRO POINT.** `mcpPoints()` rend
 *     `undefined` pour un couple (rareté, type) qu'elle ne connaît pas — les
 *     Artist Proof comics, par exemple, que VeVe n'a jamais publiés. La
 *     compter à 0 gonflerait le `gems/MCP` du set (moins de points pour le
 *     même prix) et le ferait passer pour cher. ⇒ `sansBareme` les compte, et
 *     un set qui en porte n'a pas de ratio non plus.
 *  ③ **AUCUN ARRONDI.** L'affichage arrondit ; le tri, jamais. Deux sets
 *     séparés par 0,004 doivent rester dans l'ordre où le calcul les met.
 *
 * 🔴🔴🔴⭐⭐⭐ L'UNITÉ — CETTE NOTE DISAIT « GEMS », ET C'ÉTAIT FAUX (lot M).
 *    Elle affirmait « `cout` EST EN GEMS — `i.floor` l'est ». **Mesuré le
 *    08/09/2026 sur `/market/` SERVI** : la colonne s'appelle **`$/MCP`**, et
 *    sur sa première ligne elle rend `55` pour un plancher de `330` et
 *    `6.00 MCP` — soit exactement `330 / 6`. Le site lui-même publie donc ce
 *    quotient en DOLLARS, et il n'écrit le mot « GEMS » nulle part (0 occurrence
 *    sur la page). ⇒ `i.floor` est un montant en **dollars**.
 *    ⭐⭐⭐ Et la faute ne vivait pas que dans la prose : le champ s'appelait
 *    `gemsParMcp`. **Un nom faux voyage plus loin qu'un commentaire faux** — il
 *    part dans la réserve, dans la route, dans le tableau servi, et le premier
 *    qui le lira convertira un dollar en gem. Renommé `usdParMcp`.
 * ⚠️ LE SECOND MARCHÉ SE RAPPORTE, LUI, PARCE QU'IL EST DÉJÀ CONVERTI.
 *    `dataset.mjs` pose `floorStackrUsd = stackr(OMI) × omiUsd` : le plancher
 *    StackR arrive ici **en dollars**, comme celui de VeVe. Les deux ratios
 *    partagent donc le même axe, et c'est précisément le modèle que Preda a
 *    donné (`vevesetlist.com/sets`, colonnes `Price` et `$/MCP`).
 *    ⛔⛔ CE QUI RESTE INTERDIT, ET LA NUANCE EST TOUTE LA RÈGLE : additionner
 *    ou rapporter les planchers BRUTS, dont l'un est en OMI (rapport non
 *    constant — médiane 4 423, p10 2 273, p90 8 520, lot 144). On ne compare
 *    jamais deux unités ; on compare deux montants **déjà ramenés à la même**.
 * ⚠️ Le plancher est un prix **DEMANDÉ** : ce ratio est un PLAFOND de coût
 *    d'entrée, pas un prix payé.
 */
export function agregerSet(col) {
  // 🎯 LOT N — LE SET ENTIER, PAS SES SEULES PAGES. `dataset.mjs` pose
  //   `col.pieces` (toutes les pièces du catalogue pour ce `series_uuid`) à
  //   côté de `col.items` (celles qui ont une page). Mesuré le 08/09 sur le
  //   build réel : 127 des 200 premiers sets se calculaient sur une taille
  //   PUBLIÉE inférieure à leur taille VeVe (1 page pour 5 pièces). Le ratio
  //   d'un set est celui de TOUTES ses pièces — refus ① appliqué à la
  //   population, pas seulement aux planchers.
  //   ⭐ `col.items` reste accepté (bancs, appelants anciens) : un set sans
  //   `pieces` est un set dont toutes les pièces ont une page.
  const items = Array.isArray(col?.pieces) ? col.pieces : (Array.isArray(col?.items) ? col.items : []);
  const taille = items.length;

  let cout = 0;
  let couvert = 0;
  let pointsPieces = 0;
  let sansBareme = 0;
  // 🏪 LE SECOND MARCHÉ — StackR, déjà ramené en dollars par `dataset.mjs`.
  // ⭐ Il se compte À PART, avec SA propre couverture : un set peut être
  // entièrement coté chez VeVe et à moitié chez StackR. Un compteur partagé
  // ferait disparaître le ratio VeVe dès qu'une pièce manque chez StackR —
  // c'est-à-dire punir le marché COMPLET pour le trou de l'autre.
  let coutStackr = 0;
  let couvertStackr = 0;

  // 👛 LOT N ⑪ — CHAQUE PIÈCE VOYAGE AVEC LE SET, sous forme compacte
  //   `[uuid, plancher VeVe, plancher StackR en $, points MCP]` (`null` quand
  //   inconnu). C'est ce qui permet à `personnaliser()` de recalculer le coût
  //   sur les seules pièces MANQUANTES d'un portefeuille, à la requête, sans
  //   relire le catalogue. 🔒 Ces planchers vont dans `.reserve/sets_mcp.json`,
  //   derrière la même porte que `cout` : même nature, même mur.
  const pieces = [];
  for (const i of items) {
    const f = i?.floor;
    const fOk = typeof f === 'number' && Number.isFinite(f) && f > 0;
    if (fOk) { cout += f; couvert++; }
    const s2 = i?.floorStackrUsd;
    const sOk = typeof s2 === 'number' && Number.isFinite(s2) && s2 > 0;
    if (sOk) { coutStackr += s2; couvertStackr++; }
    const m = mcpPoints(i?.rarity, i?.type);
    const mOk = typeof m === 'number' && Number.isFinite(m) && m > 0;
    if (mOk) pointsPieces += m;
    else sansBareme++;
    pieces.push([String(i?.uuid || ''), fOk ? f : null, sOk ? s2 : null, mOk ? m : null]);
  }

  const bonusSet = pointsDeSet(taille);
  // ⭐ Le total est `null` dès qu'une pièce échappe au barème : voir refus ②.
  const points = bonusSet === null || sansBareme > 0 ? null : bonusSet + pointsPieces;
  const complet = taille > 0 && couvert === taille;
  // ⭐ MÊME REFUS ①, APPLIQUÉ AU SECOND MARCHÉ : le coût d'un set est celui de
  // TOUTES ses pièces. Un set coté chez StackR sur 3 pièces sur 5 n'a pas de
  // ratio StackR — il en aurait un plus BAS que la réalité, donc il remonterait
  // en tête d'un tri croissant. *Un classement se trompe toujours du côté où on
  // a le moins regardé.*
  const completStackr = taille > 0 && couvertStackr === taille;

  return {
    slug: col?.slug || '',
    nom: col?.name || '',
    marque: col?.brand || '',
    licence: col?.licensor || '',
    taille,
    // Ce que le set coûte à compléter, en gems — `null` si un plancher manque.
    cout: complet ? cout : null,
    couvert,
    // Le même coût, sur l'autre marché — en dollars lui aussi.
    coutStackr: completStackr ? coutStackr : null,
    couvertStackr,
    bonusSet,
    pointsPieces,
    sansBareme,
    points,
    // 🔑 LE CHIFFRE DE LA DEMANDE : le COÛT D'UN POINT MCP quotidien, croissant.
    // ⚠️ En DOLLARS (voir le bloc d'unité en tête de cette fonction), et non en
    // gems comme le nom précédent l'affirmait.
    usdParMcp: complet && points !== null && points > 0 ? cout / points : null,
    // 🔑 ET LE MÊME, SUR STACKR — la seconde moitié de la demande `f`.
    // ⭐ Les deux se comparent : même unité, même dénominateur, même définition.
    stackrParMcp: completStackr && points !== null && points > 0 ? coutStackr / points : null,
    pieces,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 👛 LOT N ⑪ — LE CLASSEMENT VU D'UN PORTEFEUILLE
// ═══════════════════════════════════════════════════════════════════════════
// 🗣️ Preda (05/09) : « on peut aussi exclure ceux qu'on possède si
//   l'utilisateur a renseigné son wallet ». Et l'en-tête de ce fichier dit
//   pourquoi ce n'est pas un confort : un 2ᵉ exemplaire ne rapporte que 30 %,
//   donc le `$/MCP` de tout le monde est FAUX pour celui qui possède déjà.
// ⭐ CE QUE LE PORTEFEUILLE CHANGE, ET RIEN D'AUTRE :
//   · un set dont il détient TOUTES les pièces est EXCLU du classement (le
//     compléter n'est plus possible, le racheter ne vaut que 30 %) ;
//   · pour les autres, le coût est celui des pièces MANQUANTES, et les points
//     gagnés = le bonus de set (qu'il n'a pas encore) + les points des pièces
//     manquantes. Les pièces qu'il a déjà lui rapportent déjà leurs points :
//     elles ne comptent ni au numérateur ni au dénominateur.
//   · les refus ① et ② s'appliquent aux pièces MANQUANTES : une manquante sans
//     plancher ⇒ pas de coût, sans barème ⇒ pas de points, donc pas de ratio.
// ⛔ La liste des pièces détenues vient du CLASSEUR (grand livre on-chain,
//   `engine/lib/classeur.mjs`) — jamais d'une déclaration de l'utilisateur.
/**
 * @param agregats  sortie de `agregerSet` (avec `pieces`)
 * @param possedes  `Set` des uuid détenus (une pièce compte une fois, quel que
 *                  soit le nombre d'éditions)
 * @returns `{ sets, exclus, touches }` — `sets` sans les sets complets
 */
export function personnaliser(agregats, possedes) {
  const det = possedes instanceof Set ? possedes : new Set(possedes || []);
  let exclus = 0, touches = 0;
  const sets = [];
  for (const a of agregats) {
    const pieces = Array.isArray(a.pieces) ? a.pieces : [];
    const manque = pieces.filter((p) => !det.has(p[0]));
    const possede = pieces.length - manque.length;
    if (possede === 0 || pieces.length === 0) { sets.push({ ...a, possede }); continue; }
    if (manque.length === 0) { exclus++; continue; }
    touches++;
    let cout = 0, ok = true, coutS = 0, okS = true, pts = 0, okP = true;
    for (const [, f, s2, m] of manque) {
      if (f === null) ok = false; else cout += f;
      if (s2 === null) okS = false; else coutS += s2;
      if (m === null) okP = false; else pts += m;
    }
    const bonus = pointsDeSet(pieces.length);
    const points = okP && bonus !== null ? bonus + pts : null;
    sets.push({
      ...a, possede,
      cout: ok ? cout : null,
      coutStackr: okS ? coutS : null,
      points,
      usdParMcp: ok && points !== null && points > 0 ? cout / points : null,
      stackrParMcp: okS && points !== null && points > 0 ? coutS / points : null,
    });
  }
  return { sets, exclus, touches };
}

/** Les clés de tri, déclarées ICI et nulle part ailleurs — la leçon de
 *  `marche_selection.mjs` : deux listes recopiées, c'est « deux menus, deux
 *  vérités ». ⭐ `gpm-asc` est le défaut : la demande est « les plus
 *  intéressants », et intéressant veut dire PEU CHER par point. */
export const TRIS_SETS = ['gpm-asc', 'gpm-desc', 'spm-asc', 'spm-desc', 'pts-desc', 'cout-asc', 'taille-desc', 'nom-asc'];
export const TRI_SETS_DEFAUT = 'gpm-asc';

/**
 * ⭐⭐ LE CLASSEMENT. Les sets SANS ratio ne sont pas jetés — ils sont rangés
 * EN FIN, quel que soit le sens du tri.
 * 🔴 C'EST UNE DÉCISION, ET ELLE SE RELIT : les jeter ferait disparaître de
 * la page les sets dont on ne connaît pas encore tous les planchers, et un
 * total qui rétrécit sans rien dire est la panne la plus difficile à voir de
 * ce dépôt. Les mettre en tête ferait ouvrir la page sur des lignes vides.
 * ⇒ Ils restent, en bas, comptés — et l'appelant peut dire combien.
 */
export function classerSets(agregats, tri = TRI_SETS_DEFAUT) {
  const t = TRIS_SETS.includes(tri) ? tri : TRI_SETS_DEFAUT;
  const cle = {
    'gpm-asc': (a) => a.usdParMcp, 'gpm-desc': (a) => a.usdParMcp,
    // 🏪 `spm` = StackR par MCP. ⭐ Les clés gardent leur préfixe court parce
    // qu'elles voyagent dans une URL ; `gpm` est conservé tel quel pour ne pas
    // casser les liens déjà partagés, même si le `g` ne veut plus dire « gems ».
    'spm-asc': (a) => a.stackrParMcp, 'spm-desc': (a) => a.stackrParMcp,
    'pts-desc': (a) => a.points, 'cout-asc': (a) => a.cout,
    'taille-desc': (a) => a.taille, 'nom-asc': null,
  }[t];
  const desc = t.endsWith('-desc');

  return [...agregats].sort((a, b) => {
    if (t === 'nom-asc') return String(a.nom).localeCompare(String(b.nom));
    const va = cle(a), vb = cle(b);
    // ⛔ Un `null` ne se compare pas : il se range en dernier, TOUJOURS.
    const na = va === null || va === undefined, nb2 = vb === null || vb === undefined;
    if (na && nb2) return String(a.nom).localeCompare(String(b.nom));
    if (na) return 1;
    if (nb2) return -1;
    return desc ? vb - va : va - vb;
  });
}

/**
 * La réserve complète : les agrégats + de quoi dire ce que la page NE dit PAS.
 * ⭐⭐ LE DÉNOMINATEUR VOYAGE AVEC LE CLASSEMENT. Un « top des sets » sans son
 * total laisse croire que le catalogue fait la taille de la page — c'est la
 * règle déjà écrite dans `reserve_analytics.mjs` pour `corner_top`.
 */
export function construireSetsMcp(collections) {
  const cols = collections instanceof Map ? [...collections.values()] : (collections || []);
  const agregats = cols.map(agregerSet);
  const classables = agregats.filter((a) => a.usdParMcp !== null);
  const classablesStackr = agregats.filter((a) => a.stackrParMcp !== null);
  return {
    // ⚠️ La date sert à l'étiquette : ces planchers sont ceux du BUILD, pas du
    // direct. La réserve est figée au build — c'est la cadence des
    // déploiements qui fixe la fraîcheur, pas un cron.
    calcule: new Date().toISOString(),
    total: agregats.length,
    classables: classables.length,
    // ⭐ Le second marché a SON dénominateur : StackR ne cote pas tout, et une
    // page qui trierait dessus sans le dire laisserait croire à un classement
    // complet. Le chiffre voyage, comme `classables`.
    classablesStackr: classablesStackr.length,
    // ⭐ Dit explicitement que le classement n'est PAS personnalisé, pour
    //   qu'aucune étiquette ne promette l'exclusion des sets déjà possédés.
    personnalise: false,
    baremeSetMax: SET_POINTS_MAX,
    sets: classerSets(agregats),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  LE DÉPÔT — HORS DE `dist/`, ET À UN ENDROIT QUE PERSONNE NE BALAIE
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE FICHIER PORTE DES PRIX. Il ne peut donc pas vivre dans `dist/` : la
// règle est celle de `reserve_analytics.mjs` — c'est l'ARCHITECTURE qui
// protège, pas le contrôle d'accès. Il part dans `.reserve/`, et n'en sort que
// par une route qui vérifie le palier.
//
// ⛔⛔ ET IL Y A **DEUX** BALAIS DANS `.reserve/`, PAS UN :
//   · `projeter()` (`cote.mjs` l. ~318) VIDE `.reserve/cote/` à chaque build,
//     fichier par fichier — un fichier étranger y serait effacé.
//   · `reserve_analytics.ecrire()` fait `rmSync(ANALYTICS_DIR, recursive)` à
//     `astro:build:done`, donc APRÈS `dataset()` — un fichier déposé là par le
//     build serait supprimé, et l'API répondrait « réserve » sans qu'aucune
//     étape n'ait rougi.
// ⇒ CE FICHIER VIT À LA **RACINE** DE `.reserve/`, comme `vignettes.json` et
//   `marche.json`. Les trois y sont pour la même raison, mesurée.
//
// ⚠️⚠️ ET CONTRAIREMENT À `deposerVignettes()`, IL SE DÉPOSE **AU-DESSUS** DE
// `projeterCote()` — parce qu'il a besoin des planchers, qui n'existent plus
// en dessous. C'est l'exception, donc elle s'écrit : un dépôt descendu sous la
// projection sommerait des `undefined`, rendrait `cout: null` sur les 5 154
// sets, et la page servirait un tableau vide **sans une seule erreur**.
// C'est la signature exacte des pannes de ce dépôt : un calcul qui continue de
// tourner sur du vide. `test:sets-mcp` mesure cet ordre dans le source.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();

export const SETS_MCP_FICHIER = process.env.RESERVE_SETS_MCP
  || join(ROOT, '.reserve', 'sets_mcp.json');

/** Dépose le classement. Appelé UNE FOIS par `dataset()`, AU-DESSUS de
 *  `projeterCote()`. Rend la charge écrite, pour que l'appelant puisse la
 *  journaliser sans la relire. */
export function deposerSetsMcp(collections) {
  const charge = construireSetsMcp(collections);
  mkdirSync(dirname(SETS_MCP_FICHIER), { recursive: true });
  writeFileSync(SETS_MCP_FICHIER, JSON.stringify(charge), 'utf8');

  const ko = (JSON.stringify(charge).length / 1024).toFixed(0);
  // ⭐⭐ LE TROU S'ANNONCE DANS LE JOURNAL, AVANT LE DÉPLOIEMENT. Un classement
  // dont 0 set est classable est exactement ce que produirait un dépôt tombé
  // sous `projeterCote()` — et sans cette ligne, il ressemblerait à un succès.
  console.log('[sets-mcp] ' + charge.classables + ' set(s) classable(s) sur '
    + charge.total + ', ' + ko + ' Ko depose dans .reserve/sets_mcp.json');
  // ⭐⭐ UN AVERTISSEMENT QUI NE NOMME PAS SA CAUSE S'APPREND PAR COEUR ET
  // CESSE D'ETRE LU. Trois causes produisent le meme « 0 classable », et elles
  // n'appellent pas du tout le meme geste :
  //   · aucun plancher      -> le depot est tombe SOUS projeterCote(), ou
  //                            l'entrepot n'a rien rendu ;
  //   · aucun bareme        -> les raretes n'ont pas la forme des cles de
  //                            `MCP` (`ULTRA_RARE` et non « Ultra Rare ») —
  //                            c'est le cas de l'echantillon HORS LIGNE, et
  //                            c'est normal la, jamais sur un catalogue reel ;
  //   · les deux            -> lire la premiere avant la seconde.
  if (charge.total > 0 && charge.classables === 0) {
    const sansPlancher = charge.sets.filter((a) => a.couvert < a.taille).length;
    const sansBareme = charge.sets.filter((a) => a.sansBareme > 0).length;
    console.log('[sets-mcp] ⚠️ AUCUN set classable — ' + sansPlancher
      + ' set(s) a plancher manquant, ' + sansBareme + ' set(s) a piece hors bareme.');
    if (sansBareme === charge.total) {
      console.log('[sets-mcp]    100 % hors bareme : les raretes ne sont pas aux'
        + ' cles de MCP. ATTENDU hors ligne (gen-sample ecrit « Ultra Rare »),'
        + ' ANORMAL sur un catalogue reel (qui ecrit « ULTRA_RARE »).');
    }
    if (sansPlancher === charge.total) {
      console.log('[sets-mcp]    100 % sans plancher : verifier que ce depot est'
        + ' bien AU-DESSUS de projeterCote() dans dataset.mjs.');
    }
  }
  return charge;
}
