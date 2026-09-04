// ⚠️ VeVePreda/veve-sites — engine/lib/marche_selection.mjs   (FICHIER NEUF — lot 155-C)
// ═══════════════════════════════════════════════════════════════════════════
//  LA SÉLECTION DU MARCHÉ — FILTRER, TRIER ET TRANCHER **AU SERVEUR**
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 POURQUOI CE FICHIER EXISTE, ET CE QUI A ÉTÉ MESURÉ AVANT DE L'ÉCRIRE
// (17/08/2026, sur la `.reserve/` d'un build réel, sans rien reconstruire).
//
// `/market/` passe de 200 à **8 840 fiches cotées**. Ce que coûteraient ces
// 8 840 lignes si on continuait de tout envoyer :
//
//     projection JSON, 45 champs ......... 16,3 Mo brut · **3,80 Mo gzip**
//     réduite à 15 champs .................. 4,8 Mo brut · 0,99 Mo gzip
//     réduite à 10 clés courtes ............ 2,91 Mo brut · 767 Ko gzip
//     le `<tbody>` rendu, 3 185 o/ligne ... **28,2 Mo brut** · ~80 000 nœuds
//
// ⚠️ ET CETTE PAGE N'EST JAMAIS SERVIE PAR LE BORD : `private, no-store` +
// `vary: cookie`. **Chaque octet est repayé à CHAQUE visite.** C'est la
// différence avec `/sets/`, qui est en `HIT` au edge et peut donc s'offrir un
// index client payé une fois pour tout le monde.
//
// ⭐⭐⭐ ET LE COÛT SERVEUR, LUI, N'EXISTE PAS — c'est la mesure qui décide :
//     `JSON.parse` de la projection de 16,3 Mo ...... **42,6 ms**
//     étalement des 8 840 objets ..................... 3,5 ms
//     `lireCotes()` sur 8 841 fichiers ............. **112 ms** à froid
// ⇒ **Le seul plafond de cette page est le FIL et le DOM.** Trier et filtrer
// 8 840 fiches ici coûte des millisecondes ; les envoyer coûte des mégaoctets.
// ⇒ **Arbitrage Preda du 17/08 : la sélection se fait AU SERVEUR**, et la page
// ne rend qu'une tranche. Un filtre coûte un aller-retour, et c'est assumé.
//
// ⛔⛔ POURQUOI PAS LE PATRON DE `/sets/` (index client + `rayon.js`), QUI
// EXISTE POURTANT DÉJÀ : `rayon_index.mjs` l. 190 porte `INTERDITS` —
// `floor`, `listings`, `ath`, `atl`, `change7d`, `change24h`, `score`… — et
// **lève** si l'un d'eux entre dans un index, parce que ce fichier part dans
// `dist/client/` : c'est la fuite du lot 101. Or **les quatre tris demandés
// portent sur ces champs**. Réutiliser ce patron exigerait de percer cette
// garde. ⇒ ⛔ `rayon.js` n'est PAS le pilote de `/market/`, et il ne peut pas
// l'être. Ce n'est pas un oubli, c'est la conséquence de la garde des prix.
//
// ⭐⭐ CE MODULE EST PUR : il ne lit ni fichier, ni cookie, ni `Astro`. Il prend
// un tableau et un objet de paramètres, il rend une sélection. C'est ce qui
// permet à `test:marche` de l'éprouver **sans build et sans DOM**, dans les
// DEUX corpus (hors réseau : 48 sets ; vraies données : 8 840).

import { jourISO, mcpPoints } from './vitrine.mjs';

/**
 * ⭐⭐ GEMS PAR POINT MCP — **DÉPLACÉE ICI DEPUIS `Market.astro` (l. 94)**, et
 * c'est le lot qui l'exige : le TRI « $/MCP croissant » et la COLONNE affichée
 * doivent lire la même valeur. Deux définitions, c'est un tableau trié dans un
 * ordre que la colonne ne montre pas — la panne la plus difficile à voir, parce
 * que les deux moitiés ont l'air correctes.
 * ⛔ TROIS REFUS DÉLIBÉRÉS, conservés mot pour mot : pas de floor ou barème
 * muet ⇒ `null` (l'appelant décide du tiret **et de sa marque**) · MCP ≤ 0 ⇒
 * pas d'infini déguisé en aubaine · aucun arrondi avant l'affichage.
 * ⚠️ Le floor est un prix DEMANDÉ : ce ratio est un PLAFOND de rendement, pas
 * un rendement observé.
 */
export const parMcp = (i) => {
  const m = mcpPoints(i.rarity, i.type);
  if (!m || m <= 0) return null;
  if (i.floor === null || i.floor === undefined) return null;
  return i.floor / m;
};

/**
 * 🔑 LOT 220 — L'OMI/MCP, LE DERNIER MORCEAU DE LA DEMANDE `f` DU 14/08.
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐⭐ IL N'A JAMAIS MANQUÉ DE DONNÉE. `Market.astro` l. 807 le disait déjà :
 * « le plancher StackR et l'OMI/MCP restent à faire — non par manque de donnée,
 * mais parce que `floorStackr` est dans `CHAMPS_COTE` et passe donc par
 * <Cote> ». Or sur CETTE page les cotes sont réinjectées côté serveur (l. 139),
 * donc le montant est là quand le droit est là — et absent sinon, sans qu'on
 * ait rien à masquer.
 *
 * ⛔⛔ ET IL NE SE CONVERTIT PAS EN DOLLARS. `floorStackr` est en **OMI**,
 * `floor` en **gems** : deux MARCHÉS, rapport non constant (médiane 4 423,
 * p10 2 273, p90 8 520 sur 1 306 items communs — mesure du lot 144). Les deux
 * colonnes vivent donc côte à côte et ne se comparent pas ; les additionner ou
 * les rapporter inventerait un chiffre.
 *
 * ⚠️ Même avertissement que `parMcp` : le plancher est un prix DEMANDÉ, donc
 * ce ratio est un PLAFOND de rendement, pas un rendement observé.
 */
export const parMcpOmi = (i) => {
  const m = mcpPoints(i.rarity, i.type);
  if (!m || m <= 0) return null;
  if (i.floorStackr === null || i.floorStackr === undefined) return null;
  return i.floorStackr / m;
};

// ⭐ 20 ET NON 50 (demande de Preda, 01/08). Ce n'est toujours PAS une
// pagination par adresses : `/market/` est réservée, `no-store`, absente du
// sitemap et redirige l'anonyme — un paramètre de requête n'y crée aucune URL
// indexable, et les 11 964 adresses gelées du site ne bougent pas.
// ⛔ Le jour où quelqu'un voudra la même chose sur une page PUBLIQUE, cette
// phrase ne s'y appliquera plus : c'est le `no-store` qui l'autorise ici.
// 🔴 LOT 193 — LA RÈGLE « CE PLANCHER N'EST PAS RETENU » N'EST PAS ICI, ET
// C'EST MESURÉ : elle lit `totalPoints`, un champ que la page ne lit JAMAIS
// (il ne sert qu'au build). Écrite dans ce fichier, le relevé du §9 l'aurait
// comptée comme « lue par la page », aurait exigé qu'elle soit projetée, et
// aurait fait voyager un entier de plus sur 8 840 lignes — ou rougi.
// ⇒ `engine/lib/plancher_ecarte.mjs`. Ce module-ci ne connaît que le VERDICT,
//   `i.floorEcarte`, qui lui est bien projeté.

export const PAR_PAGE = 20;

// 🔴🔴 LE PLAFOND DUR DE CE QU'UNE RÉPONSE PEUT RENDRE. Il ne coupe pas le
// CORPUS (le filtre voit les 8 840), il coupe le HTML.
// ⭐ Mesuré : 3 185 o de HTML brut par ligne. 500 lignes ≈ 1,6 Mo — déjà le
// poids de l'ancienne page. Au-delà on ne rend pas un tableau, on rend une
// panne de navigateur, et `n` vient de l'URL : quelqu'un ÉCRIRA `?f-n=99999`.
// ⛔ Ne pas le confondre avec `MARCHE_MAX` de `dataset.mjs`, qui coupait la
// PROJECTION au build — celui-là est mort au lot 155-C.
export const RENDU_MAX = 500;

// ⭐ LES CLÉS DE TRI, DÉCLARÉES ICI ET NULLE PART AILLEURS. Le gabarit y
// accroche ses libellés traduits ; le banc y accroche sa boucle. Deux listes
// recopiées, c'est le défaut « deux menus, deux vérités » du 03/08.
// ⚠️ `defaut: null` N'EST PAS UN OUBLI — voir `ORDRE` plus bas.
// 🎯 LOT 219 — `ten-desc` : « les plus tendues d'abord ». ⭐ UN SEUL SENS, et
// c'est un choix : « les moins tendues » n'est pas une question qu'on se pose —
// ce serait un tri qui remonte ce dont personne ne veut. Un tri qu'on ajoute
// « pour la symetrie » est une ligne de plus dans un menu deja long.
// 🔑 LOT 220 — `omcp-asc` rejoint `mcp-asc`. ⭐ DEUX TRIS ET PAS UN : ils
// portent sur deux marchés dont le rapport n'est pas constant, donc l'un ne
// classe pas comme l'autre. Un seul tri « par MCP » aurait forcé à choisir un
// marché en silence.
export const TRIS = ['defaut', 'ch-desc', 'ten-desc', 'floor-desc', 'floor-asc', 'sup-asc', 'mcp-asc', 'omcp-asc', 'nom-asc'];
export const TRI_DEFAUT = 'defaut';

// ⭐ Les axes de filtre, avec leur nom de champ TEL QU'IL EST DÉJÀ ÉCRIT dans
// la barre (`f-rar`, `f-pmin`…). ⛔ On ne les renomme pas : ces noms sont lus
// par le pilote (`input[name="f-rar"]:checked`) et par le thème. Un renommage
// « pour faire propre » casserait les trois en silence.
export const CHAMPS = ['f-c', 'f-q', 'f-tri', 'f-rar', 'f-var', 'f-pmin', 'f-pmax',
                       'f-mcp', 'f-smin', 'f-smax', 'f-lmin', 'f-d1', 'f-d2', 'f-n',
                       // 🔴 LOT 193 — la seule case qui ELARGIT au lieu de restreindre.
                       'f-abr',
                       // 🔑 LOT 219 — LES DEUX AXES QUI MANQUAIENT A CETTE TABLE.
                       // Cases a cocher, donc `getAll`, donc repetees dans l'URL —
                       // comme `f-rar`. ⛔ Ne pas les nommer `f-b`/`f-l` : `f-b` est
                       // deja la CLASSE des boutons de groupe de la barre, et un
                       // `input[name="f-b"]` a cote d'un `.f-b` rend les selecteurs
                       // du pilote ambigus a la lecture. `f-mar` et `f-lic` sont sans
                       // collision dans le depot (verifie avant d'ecrire).
                       'f-mar', 'f-lic'];

/** Un nombre, ou `null` — ⛔ jamais `0` par défaut : « pas de borne » et
 *  « borne à zéro » sont deux choses différentes, et les confondre ferait
 *  disparaître toutes les fiches sans plancher. */
const nb = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 🔴 UN ENTIER BORNÉ, PARCE QUE LA VALEUR VIENT DE L'URL. `Number('abc')`
 *  rend `NaN`, `parseInt('20aa')` rend 20, et `?f-n=-5` rendrait une tranche
 *  vide sur une page qui a l'air de marcher. */
const entier = (v, defaut, min, max) => {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return defaut;
  return Math.min(max, Math.max(min, n));
};

/**
 * Lit les paramètres de la requête. ⭐ Prend un `URLSearchParams` — donc
 * testable avec `new URLSearchParams('f-rar=RARE&f-n=40')`, sans serveur.
 */
export function lireParams(sp) {
  const un = (k) => (sp && sp.get(k)) || '';
  return {
    corpus: ['collectible', 'comic'].includes(un('f-c')) ? un('f-c') : '',
    q: un('f-q').trim().toLowerCase(),
    // ⭐ `getAll` : les raretés sont des cases à cocher, elles arrivent répétées.
    rar: sp ? sp.getAll('f-rar').filter(Boolean) : [],
    // 🔑 LOT 219 — MARQUE ET LICENCE, EN VALEURS BRUTES ET NON EN INDEX.
    // ⭐ `/market/` filtre au SERVEUR : la valeur brute est ce que la fiche
    //   porte, donc la comparaison est directe et l'URL est LISIBLE
    //   (`?f-lic=Marvel` plutot que `?f-lic=37`). Le rayon, lui, indexe parce
    //   que son index part chez le client — deux mecaniques, deux raisons.
    // ⛔ Un index ici casserait a la premiere recollecte qui reordonne le
    //   dictionnaire : toutes les adresses partagees pointeraient vers une
    //   AUTRE licence, sans erreur et sans page morte.
    mar: sp ? sp.getAll('f-mar').filter(Boolean) : [],
    lic: sp ? sp.getAll('f-lic').filter(Boolean) : [],
    vari: ['up', 'down'].includes(un('f-var')) ? un('f-var') : '',
    pmin: nb(un('f-pmin')), pmax: nb(un('f-pmax')),
    mcp: nb(un('f-mcp')),
    smin: nb(un('f-smin')), smax: nb(un('f-smax')),
    lmin: nb(un('f-lmin')),
    d1: un('f-d1'), d2: un('f-d2'),
    // ⛔ Un tri inconnu retombe sur le défaut, il ne lève pas : une URL
    // partagée puis un renommage de tri ne doivent pas rendre une page morte.
    tri: TRIS.includes(un('f-tri')) ? un('f-tri') : TRI_DEFAUT,
    n: entier(un('f-n'), PAR_PAGE, PAR_PAGE, RENDU_MAX),
    // 🔴🔴 LOT 193 — « MONTRE-MOI AUSSI LES PRIX QU'ON N'A PAS RETENUS ».
    // ⛔ EXACTEMENT `'1'`, ET RIEN D'AUTRE. Le piege est connu et il est
    //    dans l'autre sens : UNE CASE NON COCHEE N'EST PAS ENVOYEE. L'etat par
    //    defaut du site — ecarter — est donc l'ABSENCE du parametre, ce qui
    //    tombe juste : une adresse partagee sans `f-abr` montre ce que tout le
    //    monde voit. Si le defaut avait ete « montrer », il aurait fallu un
    //    `f-abr=0` que le navigateur n'envoie jamais, et la case n'aurait
    //    JAMAIS pu etre decochee par un formulaire — un reglage qui ne se
    //    reglerait que dans un sens.
    abr: un('f-abr') === '1',
  };
}

/** Vrai si AU MOINS un filtre mord. ⭐ Sert à ne pas afficher « 0 résultat sur
 *  0 filtre », qui ne veut rien dire, et à savoir si la mention de troncature
 *  parle du catalogue ou d'une recherche. */
export function filtreActif(p) {
  // ⭐ `p.abr` EN FAIT PARTIE, ET C'EST DISCUTABLE — donc c'est argumente.
  //   Il ne RESTREINT pas, il elargit : « filtre actif » pourrait sembler faux.
  //   Mais cette fonction ne repond pas a « as-tu retire des lignes ? », elle
  //   repond a « ce que tu vois est-il le reglage par defaut du site ? ». Et
  //   avec la case cochee, non. L'omettre laisserait une page qui montre des
  //   prix farceurs sans qu'aucun jeton ne dise pourquoi, et sans que le bouton
  //   « tout effacer » ne la ramene — le pire des deux mondes.
  return !!(p.corpus || p.q || p.rar.length || p.mar.length || p.lic.length || p.vari
    || p.pmin !== null || p.pmax !== null || p.mcp !== null
    || p.smin !== null || p.smax !== null || p.lmin !== null || p.d1 || p.d2
    || p.abr);
}

/**
 * ⭐⭐ LES BORNES ET LES FACETTES SE CALCULENT SUR LA POPULATION ENTIÈRE,
 * JAMAIS SUR LA TRANCHE. C'est la règle du lot 68 (« les bornes sont calculées
 * sur le corpus publié, jamais écrites en dur »), et elle devient CRITIQUE ici :
 * une borne calculée sur 20 lignes rétrécirait à chaque filtre, en silence, et
 * la barre finirait par proposer « de 4 à 9 gems » sur un catalogue qui va de
 * 0,5 à 12 000. Même raison pour les raretés proposées et pour les compteurs
 * « Collectibles / Comics ».
 * ⚠️ Ils ne tiennent donc PAS compte des filtres actifs : ce sont les bornes du
 * CATALOGUE, pas de la recherche en cours. C'est un choix, et il est dit à
 * l'écran par le compteur « n sur N ».
 */
export function facettes(population) {
  const floors = [], tirages = [], dates = [];
  const rarete = new Set();
  // 🔑 LOT 219 — LE COMPTEUR PAR VALEUR, COMME SUR `/collectibles/`.
  // ⭐⭐ C'est ce que le concurrent n'a PAS sur son screener, et qu'on avait
  // deja d'un cote du site : « Marvel 503 » dit, avant de cocher, si la case
  // vaut la peine. Une liste de 1 511 marques sans compteur est une liste ou
  // l'on ne sait pas quoi cocher.
  // ⛔ SUR LA POPULATION ENTIERE, pas sur la tranche ni sur la selection — voir
  // l'en-tete de cette fonction : un compteur qui retrecit a chaque filtre
  // ferait croire que Marvel a perdu 400 pieces.
  const marques = new Map(), licences = new Map();
  let coll = 0;
  for (const i of population) {
    if (i.brand) marques.set(i.brand, (marques.get(i.brand) || 0) + 1);
    if (i.licensor) licences.set(i.licensor, (licences.get(i.licensor) || 0) + 1);
    const f = nb(i.floor); if (f !== null) floors.push(f);
    const tg = nb(i.tirage); if (tg !== null && tg > 0) tirages.push(tg);
    const d = jourISO(i.releaseDate); if (d) dates.push(d);
    if (i.rarity) rarete.add(i.rarity);
    if (i.type === 'collectible') coll++;
  }
  dates.sort();
  // ⭐⭐⭐ LA LICENCE SE TRIE PAR NOMBRE, LA MARQUE PAR NOM — C'EST UNE MESURE,
  // PAS UN GOUT, et elle n'est pas de ce lot : `rayon.js` l. 205 la porte depuis
  // le lot 133. « Marvel porte l'essentiel des titres ; un ordre alphabetique
  // mettrait ABLAZE Publishing en tete et enterrerait Marvel au milieu. La
  // marque, elle, se cherche par son nom. » 97 licences, 1 511 marques : les
  // deux listes n'ont pas le meme usage, donc pas le meme ordre.
  // ⛔ On ne redecide pas ici ce qui a deja ete mesure ailleurs — on le suit.
  const parNombre = (a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]);
  const parNom = (a, b) => a[0].localeCompare(b[0]);
  return {
    rarete,
    licences: [...licences.entries()].sort(parNombre),
    marques: [...marques.entries()].sort(parNom),
    nbColl: coll,
    nbComic: population.length - coll,
    bornes: {
      floorMin: floors.length ? Math.floor(Math.min(...floors)) : 0,
      floorMax: floors.length ? Math.ceil(Math.max(...floors)) : 0,
      tirageMin: tirages.length ? Math.min(...tirages) : 0,
      tirageMax: tirages.length ? Math.max(...tirages) : 0,
      dateMin: dates[0] || '',
      dateMax: dates[dates.length - 1] || '',
    },
  };
}

/**
 * ⛔ UNE BORNE NE JETTE PAS CE QU'ELLE NE CONNAÎT PAS — mot pour mot la règle
 * de `rayon.js`. Un tirage absent vaut « inconnu », pas « zéro » : le filtrer
 * sur `< min` ferait disparaître des centaines de comics sans mention, et le
 * filtre AURAIT L'AIR DE MARCHER. Elles passent, et le tri les met au bout.
 */
function garde(i, p) {
  // 🔴🔴🔴 LOT 193 — EN PREMIER, ET DELIBEREMENT. Ce n'est pas un filtre parmi
  // les autres : c'est l'ETAT PAR DEFAUT DU CATALOGUE. Le placer plus bas ne
  // changerait rien au resultat, mais le rendrait illisible — on croirait a un
  // critere que le visiteur a choisi, alors que c'est celui qu'il n'a pas eu a
  // choisir.
  // ⛔ `i.floorEcarte` est ABSENT (et pas `false`) sur les 8 700 lignes saines :
  //    `dataset.mjs` ne pose la cle que quand elle est vraie. Un test qui
  //    exigerait `=== false` ne mordrait donc JAMAIS — dans l'autre sens, ce
  //    serait la panne muette du lot 192 refaite a l'identique.
  if (!p.abr && i.floorEcarte) return false;
  if (p.corpus && i.type !== p.corpus) return false;
  if (p.rar.length && !p.rar.includes(i.rarity)) return false;
  // 🔑 LOT 219 — ⛔ COMPARAISON EXACTE, SUR LA VALEUR TELLE QUE LE CATALOGUE
  //   L'ECRIT. Les puces sont rendues par le serveur A PARTIR DE CETTE MEME
  //   POPULATION (voir `facettes`), donc une valeur cochee existe forcement.
  //   Normaliser ici (minuscules, accents) creerait une SECONDE verite sur ce
  //   qu'est « la meme marque », et elle divergerait de celle des puces.
  if (p.mar.length && !p.mar.includes(i.brand)) return false;
  if (p.lic.length && !p.lic.includes(i.licensor)) return false;
  // ⭐ LA RECHERCHE PORTE SUR LE NOM **ET** LA SÉRIE : un collectionneur tape
  //   « spider-man » en pensant à la série autant qu'au titre de la pièce.
  if (p.q) {
    const n = String(i.name || '').toLowerCase();
    const s = String(i.series || '').toLowerCase();
    // 🔑 LOT 219 — ET SUR LA MARQUE ET LA LICENCE. Demande de l'audit : taper
    //   « marvel » dans la recherche d'une table de PRIX ne rendait rien, parce
    //   que le mot n'est ni dans le nom de la piece ni dans celui de la serie.
    //   ⭐ La recherche cherche desormais dans les quatre axes textuels que la
    //   ligne porte — et elle ne peut pas en chercher un cinquieme : c'est
    //   exactement ce que `CHAMPS_MARCHE` decide.
    const b = String(i.brand || '').toLowerCase();
    const l = String(i.licensor || '').toLowerCase();
    if (!n.includes(p.q) && !s.includes(p.q) && !b.includes(p.q) && !l.includes(p.q)) return false;
  }
  if (p.vari) {
    const c = nb(i.change7d);
    // ⛔ Une variation ABSENTE n'est ni une hausse ni une baisse : elle est
    //    écartée par ce filtre, et c'est la seule lecture honnête de « ▲ ».
    if (c === null) return false;
    if (p.vari === 'up' && !(c > 0)) return false;
    if (p.vari === 'down' && !(c < 0)) return false;
  }
  const f = nb(i.floor);
  if (f !== null) {
    if (p.pmin !== null && f < p.pmin) return false;
    if (p.pmax !== null && f > p.pmax) return false;
  }
  const tg = nb(i.tirage);
  if (tg) {
    if (p.smin !== null && tg < p.smin) return false;
    if (p.smax !== null && tg > p.smax) return false;
  }
  const l = nb(i.listings);
  if (l !== null && p.lmin !== null && l < p.lmin) return false;
  if (p.mcp !== null) {
    const m = parMcp(i);
    // ⛔ Une fiche dont le barème ne connaît pas la rareté n'a pas de $/MCP :
    //    elle n'est pas « moins chère que la borne », elle est hors sujet.
    //    Elle passe — la borne ne jette pas ce qu'elle ne connaît pas.
    if (m !== null && m > p.mcp) return false;
  }
  if (p.d1 || p.d2) {
    const d = jourISO(i.releaseDate);
    // ⚠️ `jourISO` et PAS un `slice(0, 10)` : la donnée est en JJ/MM/AAAA, un
    //    découpage naïf rendait un filtre par dates qui ne mordait jamais.
    if (d) {
      if (p.d1 && d < p.d1) return false;
      if (p.d2 && d > p.d2) return false;
    }
  }
  return true;
}

// ⭐ LES COMPARATEURS. `defaut: null` — ET C'EST VOULU.
// L'ordre par défaut est celui que `dataset.mjs` a posé AVANT `projeterCote()`,
// quand `floor` existait encore et que le tri pouvait être juste. Le refaire
// ici, sur des champs projetés, produirait un AUTRE ordre : c'est exactement le
// piège que `rayon.js` documente (« un comparateur qui refait ce tri risquerait
// d'en produire un autre »). ⇒ `null` = on rend l'ordre du fichier.
// → regle-invariant-plutot-quune-seconde-liste
const cmpNum = (get, sens) => (a, b) => {
  const x = nb(get(a)), y = nb(get(b));
  // ⛔ LES INCONNUS VONT AU BOUT, DANS LES DEUX SENS. Un `null` traité comme 0
  //    remonterait toutes les fiches sans plancher en tête d'un tri croissant :
  //    « les moins chères » seraient celles dont on ne sait rien.
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return sens * (x - y);
};

const ORDRE = {
  defaut: null,
  'ch-desc': cmpNum((i) => i.change7d, -1),
  // ⭐ `cmpNum` MET LES INCONNUS AU BOUT DANS LES DEUX SENS — c'est deja sa
  //   regle, et elle vaut ici mot pour mot : une piece sans tension mesurable ne
  //   doit pas ouvrir le classement « les plus tendues ».
  'ten-desc': cmpNum((i) => i.tension, -1),
  'floor-desc': cmpNum((i) => i.floor, -1),
  'floor-asc': cmpNum((i) => i.floor, 1),
  'sup-asc': cmpNum((i) => i.tirage, 1),
  'mcp-asc': cmpNum(parMcp, 1),
  'omcp-asc': cmpNum(parMcpOmi, 1),
  'nom-asc': (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
};

/**
 * ⭐⭐⭐ LE POINT D'ENTRÉE UNIQUE. Les deux routes de `/market/` (racine et par
 * langue) rendent le MÊME composant, et le composant appelle CECI : il n'y a
 * qu'un endroit où la sélection s'écrit, donc qu'un endroit où la corriger.
 *
 * @param population les fiches déjà fusionnées avec leurs cotes (`{...i, ...cote}`)
 * @param p          la sortie de `lireParams()`
 */
export function selectionMarche(population, p) {
  const retenues = population.filter((i) => garde(i, p));
  // 🔴🔴 LOT 193 — LE COMPTEUR DOIT SUIVRE, SINON LA PAGE MENT.
  // « X pieces cotees » a cote d'une liste dont on vient de retirer 171 lignes
  // est un chiffre qu'aucun geste du visiteur ne peut retrouver : il compte
  // toujours, mais il ne compte plus RIEN de ce qu'on lui montre.
  // ⭐ `total` GARDE son sens d'origine (le catalogue cote entier) — d'autres
  //   lectures en dependent — et `totalVisible` dit ce que ce reglage laisse
  //   voir. Deux nombres distincts plutot qu'un nombre dont le sens change.
  const ecartes = population.reduce((n, i) => n + (i.floorEcarte ? 1 : 0), 0);
  const cmp = ORDRE[p.tri];
  // ⛔ `sort()` MUTE — on trie une COPIE. `population` est la fusion faite par
  //    le gabarit, mais `ds.marche` derrière elle est mémoïsé pour la durée du
  //    processus : muter l'ordre contaminerait la visite suivante, et le défaut
  //    n'apparaîtrait qu'au deuxième visiteur.
  const triees = cmp ? retenues.slice().sort(cmp) : retenues;

  // 🔑 LOT 220 — LA COMPOSITION DE CE QUI EST RETENU, PAS SON SEUL VOLUME.
  // ═══════════════════════════════════════════════════════════════════════════
  // Demande de l'audit du 04/09 : « une ligne de résultat qui décrit la
  // COMPOSITION, pas le volume ». « 440 pièces » ne dit pas si ce sont 440
  // comics d'une seule série ou 440 objets de douze licences — et c'est cette
  // seconde information qui dit au visiteur si son filtre a mordu au bon endroit.
  // ⭐ SUR LES RETENUES, JAMAIS SUR LA TRANCHE : la tranche en montre 20, et une
  // composition calculée dessus décrirait l'échantillon en le faisant passer
  // pour le tout. Même règle que les facettes et que la tension.
  // ⛔ Trois chiffres, pas douze : une ligne de résultat qui devient un tableau
  // cesse d'être lue.
  const compo = { coll: 0, comic: 0, licences: new Set(), rarete: new Map() };
  for (const i of triees) {
    if (i.type === 'collectible') compo.coll++; else compo.comic++;
    if (i.licensor) compo.licences.add(i.licensor);
    if (i.rarity) compo.rarete.set(i.rarity, (compo.rarete.get(i.rarity) || 0) + 1);
  }
  // ⚠️ `null` ET PAS UNE CHAÎNE VIDE quand il n'y a rien : le gabarit doit
  //    pouvoir NE PAS écrire la phrase, pas écrire une phrase vide.
  let rarDom = null, rarDomN = 0;
  for (const [r, n] of compo.rarete) if (n > rarDomN) { rarDom = r; rarDomN = n; }

  return {
    composition: {
      collectibles: compo.coll,
      comics: compo.comic,
      licences: compo.licences.size,
      rareteDominante: rarDom,
      rareteDominanteN: rarDomN,
    },
    lignes: triees.slice(0, p.n),
    // ⭐ TROIS NOMBRES, ET ILS NE DISENT PAS LA MÊME CHOSE :
    //   `rendues`  ce que le HTML porte · `retenues` ce que le filtre garde ·
    //   `total`    ce que le catalogue coté contient.
    //   Les confondre, c'est la mention « 200 sur 8 840 » qui devient fausse
    //   sans que rien ne casse.
    rendues: Math.min(p.n, triees.length),
    retenues: triees.length,
    total: population.length,
    //   `ecartes`      combien de planchers la regle du lot 193 retire ;
    //   `totalVisible` le catalogue tel que CE reglage le laisse voir.
    // ⭐ Avec la case cochee, `totalVisible === total` : le nombre remonte, et
    //   c'est la preuve visible a l'ecran que rien n'a ete supprime — seulement
    //   mis de cote.
    ecartes,
    totalVisible: p.abr ? population.length : population.length - ecartes,
    reste: Math.max(0, triees.length - p.n),
  };
}
