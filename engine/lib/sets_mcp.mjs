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
// ⚠️⚠️ LA PRÉMISSE QUI N'EST PAS MESURÉE, ET QUI DOIT SE RELIRE :
//   **« un set du site » = « un Set de VeVe » n'est pas vérifié.** Ici un set
//   est ce que `dataset.mjs` appelle une `collection` : une SÉRIE, ou
//   `<série> #<numéro>` pour un comic (`cleSet`, l. ~1323). Si VeVe groupe
//   autrement, le bonus de set est attribué au mauvais objet — et le chiffre
//   serait faux sans qu'aucun banc puisse le voir, parce que les deux côtés
//   seraient cohérents avec eux-mêmes. ⇒ À poser à Preda / à mesurer à la
//   source AVANT de publier ce classement hors du palier de mesure.
//   ⭐ C'est pourquoi la définition du set n'est PAS recopiée ici : ce module
//   reçoit les `collections` déjà faites. Un seul endroit décide ce qu'est un
//   set, et le jour où cette prémisse tombe, il n'y a qu'un endroit à changer.

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
 * ⚠️ `cout` EST EN **GEMS** — `i.floor` l'est (le marché VeVe), et le plancher
 *    StackR est en OMI : deux MARCHÉS dont le rapport n'est pas constant
 *    (médiane 4 423, p10 2 273, p90 8 520 — mesure du lot 144). ⛔ Ne jamais
 *    les additionner ni les rapporter ici.
 * ⚠️ Le plancher est un prix **DEMANDÉ** : ce ratio est un PLAFOND de coût
 *    d'entrée, pas un prix payé.
 */
export function agregerSet(col) {
  const items = Array.isArray(col?.items) ? col.items : [];
  const taille = items.length;

  let cout = 0;
  let couvert = 0;
  let pointsPieces = 0;
  let sansBareme = 0;

  for (const i of items) {
    const f = i?.floor;
    if (typeof f === 'number' && Number.isFinite(f) && f > 0) { cout += f; couvert++; }
    const m = mcpPoints(i?.rarity, i?.type);
    if (typeof m === 'number' && Number.isFinite(m) && m > 0) pointsPieces += m;
    else sansBareme++;
  }

  const bonusSet = pointsDeSet(taille);
  // ⭐ Le total est `null` dès qu'une pièce échappe au barème : voir refus ②.
  const points = bonusSet === null || sansBareme > 0 ? null : bonusSet + pointsPieces;
  const complet = taille > 0 && couvert === taille;

  return {
    slug: col?.slug || '',
    nom: col?.name || '',
    marque: col?.brand || '',
    licence: col?.licensor || '',
    taille,
    // Ce que le set coûte à compléter, en gems — `null` si un plancher manque.
    cout: complet ? cout : null,
    couvert,
    bonusSet,
    pointsPieces,
    sansBareme,
    points,
    // 🔑 LE CHIFFRE DE LA DEMANDE : gems par point MCP quotidien, croissant.
    gemsParMcp: complet && points !== null && points > 0 ? cout / points : null,
  };
}

/** Les clés de tri, déclarées ICI et nulle part ailleurs — la leçon de
 *  `marche_selection.mjs` : deux listes recopiées, c'est « deux menus, deux
 *  vérités ». ⭐ `gpm-asc` est le défaut : la demande est « les plus
 *  intéressants », et intéressant veut dire PEU CHER par point. */
export const TRIS_SETS = ['gpm-asc', 'gpm-desc', 'pts-desc', 'cout-asc', 'taille-desc', 'nom-asc'];
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
    'gpm-asc': (a) => a.gemsParMcp, 'gpm-desc': (a) => a.gemsParMcp,
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
  const classables = agregats.filter((a) => a.gemsParMcp !== null);
  return {
    // ⚠️ La date sert à l'étiquette : ces planchers sont ceux du BUILD, pas du
    // direct. La réserve est figée au build — c'est la cadence des
    // déploiements qui fixe la fraîcheur, pas un cron.
    calcule: new Date().toISOString(),
    total: agregats.length,
    classables: classables.length,
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
