// ⚠️ VeVePreda/veve-sites — engine/lib/rayon_index.mjs   (FICHIER NEUF — lot 155)
//
// ═══════════════════════════════════════════════════════════════════════════
//  L'INDEX D'UN RAYON — CE QUI PERMET DE FILTRER 16 789 LIGNES SANS LES SERVIR
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 LE CONFLIT QUE CE FICHIER EXISTE POUR LEVER, ET IL EST ÉCRIT DEPUIS
// LE LOT 113 EN TÊTE DE `src/pages/sets/index.astro` :
//     « Un filtre qui ne cherche que dans 20 lignes sur 910 est pire qu'un
//       filtre absent : il RÉPOND, et sa réponse est fausse. »
// D'où la règle du dépôt : **FILTRES *OU* PAGINATION, JAMAIS LES DEUX**. Elle
// est vraie tant que le filtre cherche dans les NŒUDS DU DOM — et c'est là
// qu'elle a coûté le plus cher :
//   · `/sets/` a gardé ses 3 113 cartes dans une seule page pour que son filtre
//     soit exact. Mesuré le 17/08 sur le `dist/` réel : **3 254 934 o et 6 090
//     `<img>`**, contre **51 025 o** pour `/comics/`. C'est le pire poids du site.
//   · `/comics/` et `/collectibles/` ont gardé leur pagination, donc n'ont
//     **AUCUN** filtre (0 occurrence de `barre-f` sur les deux pages servies).
//
// ⭐⭐⭐ LE FILTRE N'A JAMAIS EU BESOIN DES NŒUDS, IL A BESOIN DES VALEURS.
// Servir la page et servir la matière du filtre sont deux choses : la page rend
// une tranche, l'index porte le rayon entier, et c'est le PILOTE qui rend les
// résultats. La règle « filtres OU pagination » cesse alors de mordre — sans
// rendre 19 532 lignes à personne.
//
// ⛔⛔ ET SURTOUT : L'ANONYME NE PAIE PLUS RIEN. Les filtres sont RÉSERVÉS
// depuis le lot 115 (`data-membre hidden`, mur `filtres-mur`). `/sets/` servait
// donc 3,2 Mo de cartes à tout le monde pour qu'un membre puisse filtrer. Un
// index chargé par `fetch` au moment où la barre s'ouvre coûte **zéro octet** à
// qui ne l'ouvre pas.
//
// ─────────────────────────────────────────────────────────────────────────────
//  🔴🔴 POURQUOI CE N'EST PAS `search-index.json`, ET IL A FALLU LE MESURER
// ─────────────────────────────────────────────────────────────────────────────
// Un index public du catalogue EXISTE DÉJÀ : `src/pages/search-index.json.js`,
// **719 342 o** dans le `dist/` du 17/08. Le réflexe juste est de l'étendre —
// « le travail n'est pas à refaire, et il n'y aura pas un second index ».
// ⭐ Sauf que les deux ne portent pas le même corpus et ne sont pas payés par
// la même personne, et c'est mesuré :
//   · `search-index.json` = `ds.items`, les **8 840 FICHES**, `{s, n}` et rien
//     d'autre. Il est PUBLIC et il est chargé **à la première frappe** de la
//     recherche, donc par n'importe quel visiteur.
//   · l'index de rayon    = `ds.rayon`, les **19 532 LIGNES DU CATALOGUE**, avec
//     leurs axes. Il est chargé par le seul MEMBRE qui ouvre la barre.
// Les fondre ferait payer 3,3 Mo à chaque visiteur qui tape une lettre, pour
// des axes que la recherche n'utilise pas. ⇒ Deux index, deux consommateurs,
// et cette mesure écrite ici pour que le prochain lecteur n'ait pas à la
// refaire. *Un index existant ne dispense pas de regarder QUI le paie.*
//
// ─────────────────────────────────────────────────────────────────────────────
//  ⭐⭐⭐ LES VALEURS RÉPÉTÉES SONT FACTORISÉES, ET LE GAIN EST MESURÉ
// ─────────────────────────────────────────────────────────────────────────────
// 16 789 comics se partagent 1 243 séries, 1 169 marques, ~93 licences,
// 5 raretés. Écrire la chaîne sur chaque ligne, c'est écrire « Marvel » dix
// mille fois. Chaque ligne porte donc un ENTIER qui pointe dans un
// dictionnaire, et `0` veut dire « vide » (les dictionnaires sont 1-indexés).
//     mesuré le 17/08, comics :  chaînes en clair  2 777 Ko brut / 579 Ko gzip
//                                factorisé         1 283 Ko brut / 155 Ko gzip
// ⛔ Ce n'est pas une compression maison qui doublerait gzip : gzip ne sait pas
// qu'un nom de série revient quarante lignes plus loin — sa fenêtre est trop
// courte. Le dictionnaire, lui, le sait. Les deux se cumulent, et c'est ce que
// dit le chiffre.
//
// ⛔⛔ AUCUN CHAMP DE PRIX, JAMAIS, ET CE FICHIER EST SERVI EN CLAIR.
// C'est la fuite du lot 101 par la porte d'à côté : un `floor` glissé ici
// partirait dans `dist/client/`, servi par nginx à qui connaît l'adresse.
// La liste des colonnes ci-dessous est FERMÉE, `charge()` REFUSE d'écrire si un
// nom interdit y entre, et `test:fuite` ratisse tout `dist/`. ⇒ Les axes de ce
// fichier sont, par construction, des axes SANS PRIX : licence, marque, série,
// rareté, édition, année, tirage. Les axes de prix restent sur `/market/`,
// derrière la porte, où les cotes sont réinjectées par session.

// ⭐ LES CORPUS, DÉCLARÉS ICI ET LUS PARTOUT. La route en fait ses
// `getStaticPaths`, le banc en fait sa boucle, le composant en fait son adresse.
// ⛔ Un quatrième corpus ajouté à la main dans l'un des trois serait exactement
// `regle-circuit-ouvert` : deux écrivains, aucun lecteur.
export const CORPUS = ['comics', 'collectibles', 'sets'];

// ⭐⭐⭐ CE QUE LE SERVEUR REND, C'EST CE QUE L'INDEX PORTE — PAS LE CODE BRUT.
// `Rayon.astro` n'affiche pas `edition_type` : il affiche `mentionEdition()`.
// Il n'affiche pas `rarity` : il affiche `rar(rarity, { blanc: true })`, une
// pastille avec sa forme SVG et son libellé. Un pilote qui rendrait les lignes
// depuis les codes bruts écrirait « FIRST_APPEARANCE » là où le serveur écrit
// « FA », et « SECRET_RARE » là où il dessine une étoile.
// ⛔ Et RÉÉCRIRE ces deux fonctions en JavaScript client serait la cinquième
// occurrence de « deux gabarits qui rendent la même liste » — celle qui ne se
// verrait jamais, parce que les deux rendus ne sont jamais côte à côte.
// ⇒ Les DICTIONNAIRES portent la forme RENDUE, produite par la fonction du
// serveur. Il y a 6 raretés et une poignée de mentions : le coût est de l'ordre
// de 800 octets pour un index qui en pèse un million.
// ⭐ *Quand deux fabriques doivent montrer la même chose, on transporte le
// résultat, pas la recette.*
import { rar, mentionEdition, RAR } from './vitrine.mjs';

// ⭐⭐ L'ORDRE DES CASES EST UN CONTRAT AVEC LE PILOTE, ET IL VOYAGE AVEC LA
// CHARGE (`cols`). Le jour où une colonne s'ajoute au milieu, le pilote lit
// `cols` et se décale tout seul ; s'il lisait des positions écrites en dur des
// deux côtés, il rendrait des marques à la place des licences — sans erreur.
// 🔴🔴🔴 `u` (L'UUID) EST DANS CETTE LISTE, ET C'EST LA DÉCISION LA PLUS CHÈRE
// DU LOT — PRISE SUR UNE MESURE, CONTRE MON PREMIER RÉFLEXE.
// Une ligne de rayon cliquable porte aujourd'hui son badge ATL/ATH
// (`Rayon.astro` l. 154, `<Extremes>`), et ce badge est un `<span data-cote=uuid>`
// que `60-cote.js` remplit à la demande. Un pilote qui rend les lignes DEPUIS
// L'INDEX ne peut pas l'émettre sans uuid ⇒ les lignes filtrées perdraient
// silencieusement leur badge. C'est `regle-seconde-fabrique-ne-montre-que-sa-
// source`, **TROISIÈME occurrence en quatre jours** (les tuiles de `/market/`,
// puis celles de `/favoris/`), et cette fois elle a été vue AVANT d'écrire.
// ⚠️ CE QUE ÇA COÛTE, MESURÉ le 17/08 sur les vrais uuid (⛔ pas sur un uuid
// factice répété, qui rendait gzip menteur : 127 Ko au lieu de 255) :
//     colonne uuid seule, comics : 261 Ko brut · **+131 Ko gzip**
//     l'index comics passe donc de 124 à 255 Ko gzip.
// ⛔ ET JE REFUSE LES DEUX ÉCONOMIES QUI SE PRÉSENTAIENT :
//   · base64 sur 22 caractères ne gagne que 20 Ko de gzip et demande un
//     décodeur des DEUX côtés — 20 Ko contre un mécanisme qui divergera ;
//   · un second fichier `…-uuid.json` chargé à part gagne 131 Ko sur un chemin
//     déjà réservé au membre, au prix d'une seconde route, d'un second `fetch`
//     et d'un sondage de palier. *Payer 131 Ko une fois vaut mieux qu'un badge
//     qui disparaît sans le dire.*
// ⭐ `0` pour une ligne sans fiche : pas de fiche, pas de cote, pas d'uuid à
// porter. 10 692 lignes sur 19 532 coûtent donc un octet.
const COLS_PIECE = ['n', 'se', 'p', 'u', 'r', 'e', 'b', 'l', 'a', 't'];
const COLS_SET = ['n', 'p', 'b', 'l', 'a', 't', 'ty'];

// ⛔ LA MÊME LISTE QUE `test:rayon` §①, ÉLARGIE AUX CHAMPS DÉRIVÉS DU PRIX, ET
// ELLE S'IMPORTE PLUTÔT QUE DE SE RECOPIER. Deux listes d'interdits divergent
// au premier champ ajouté — et celle-là garde un fichier public.
export const INTERDITS = ['floor', 'listings', 'ath', 'atl', 'ath_date', 'athDate', 'atlDate',
                          'prixMedian', 'p95', 'store_price', 'storePrice', 'history', 'courbe',
                          'change7d', 'change24h', 'amplitude', 'score'];

/** L'année de sortie sur 4 chiffres, tirée de « JJ/MM/AAAA hh:mm:ss ».
 *  🔴 `slice(0, 4)` rendrait « 06/1 » : le piège du lot 68, qui avait
 *  AUTO-SUPPRIMÉ le panneau « Année » en silence (il ne s'émet qu'à partir de
 *  deux années distinctes, et il n'en trouvait aucune). On lit donc les
 *  positions 6→10, et le banc tient la lecture. */
const annee = (d) => Number(String(d || '').slice(6, 10)) || 0;

/** Un dictionnaire qui s'écrit en se lisant : `idx(v)` rend la position de `v`,
 *  1-indexée, et `0` pour une valeur vide. */
function dictionnaire() {
  const m = new Map();
  return {
    idx(v) {
      const s = String(v || '').trim();
      if (!s) return 0;
      if (!m.has(s)) m.set(s, m.size + 1);
      return m.get(s);
    },
    valeurs: () => [...m.keys()],
  };
}

/**
 * Construit l'index d'un corpus depuis le jeu de données du build.
 *
 * ⚠️ `ds` DOIT être le jeu complet (celui que `dataset()` rend), pas la
 * projection de `/market/` : on lit `ds.rayon` et `ds.collections`.
 * ⛔ Et on ne lit RIEN d'autre. Un `ds.items` ici ferait entrer des fiches
 * portant des montants dans un fichier public.
 */
export function indexRayon(ds, corpus) {
  if (!CORPUS.includes(corpus)) {
    throw new Error(`[rayon-index] corpus inconnu : « ${corpus} ». Connus : ${CORPUS.join(', ')}.`);
  }

  // ═══ LES SETS — même forme, source différente ═══
  // ⭐ `sets` n'est pas un rayon du catalogue, c'est le regroupement par série :
  // même branche que `Rayon.astro` l. 40, et pour la même raison. Un troisième
  // format aurait divergé au premier changement.
  if (corpus === 'sets') {
    const dic = { b: dictionnaire(), l: dictionnaire(), ty: dictionnaire() };
    const cols = [...ds.collections.values()].sort((a, b) => b.items.length - a.items.length);
    const lignes = cols.map((c) => {
      // ⚠️ CHAQUE AXE EST DÉRIVÉ DES PIÈCES DU SET, JAMAIS DÉCLARÉ SUR LE SET —
      // c'est le raisonnement du lot 68, repris ici parce que la source est la
      // même. L'année est la PLUS ANCIENNE (un set naît avec sa première pièce,
      // il ne renaît pas à chaque ajout) ; le type est le MAJORITAIRE (les
      // mélanges existent, on suit la majorité et on ne prétend pas trancher).
      const ans = c.items.map((i) => annee(i.releaseDate)).filter(Boolean).sort();
      const nbComic = c.items.filter((i) => i.type === 'comic').length;
      return [
        c.name || '',
        `${c.slug}/`,
        dic.b.idx(c.brand),
        dic.l.idx(c.licensor),
        ans[0] || 0,
        c.items.length,
        dic.ty.idx(nbComic * 2 > c.items.length ? 'comic' : 'collectible'),
      ];
    });
    return charge('sets', '/collection/', COLS_SET, dic, lignes);
  }

  // ═══ LES PIÈCES ═══
  const type = corpus === 'comics' ? 'comic' : 'collectible';
  const prefixe = `/${corpus}/`;
  const dic = { se: dictionnaire(), r: dictionnaire(), e: dictionnaire(), b: dictionnaire(), l: dictionnaire() };
  const lignes = (ds.rayon || [])
    .filter((r) => (r.type === 'comic') === (type === 'comic'))
    // 🔴🔴 LE MÊME ORDRE QUE `Rayon.astro`, ET CE N'EST PAS UN DÉTAIL : ce que la
    // barre rend quand aucun filtre n'est actif doit être ce que le serveur
    // rendait. Deux ordres, et un membre verrait la liste sauter à l'ouverture
    // de la barre sans avoir rien demandé — un défaut qu'on met une heure à
    // reproduire parce qu'il n'a l'air d'être rien.
    .sort((a, b) => (a.path ? 0 : 1) - (b.path ? 0 : 1)
      || (a.series || '').localeCompare(b.series || '') || a.name.localeCompare(b.name))
    .map((r) => [
      r.name || '',
      dic.se.idx(r.series),
      // ⭐ LE PRÉFIXE EST FACTORISÉ, PAS DEVINÉ. Toutes les adresses d'un rayon
      // commencent par `/comics/` ou `/collectibles/` — 14 octets × 8 840.
      // ⛔ `0` ET SURTOUT PAS UNE ADRESSE FABRIQUÉE quand la pièce n'a pas de
      // fiche : 10 692 liens vers des 404 seraient invisibles au build (ce sont
      // des liens, pas des routes). C'est la règle de `rayonDe()`, mot pour mot.
      r.path && r.path.startsWith(prefixe) ? r.path.slice(prefixe.length) : 0,
      // ⭐ L'UUID SEULEMENT SI LA FICHE EXISTE — voir le bloc de `COLS_PIECE`.
      //   ⛔ Un uuid porté par une ligne muette servirait à demander la cote
      //   d'une pièce qui n'en a pas : `/api/cote/lot` rendrait un trou, et le
      //   badge resterait cadenassé pour une raison fausse (« je ne montre pas »
      //   là où la vérité est « je n'ai pas »). C'est la règle de `Rayon.astro`
      //   l. 146, mot pour mot, et c'est le MÊME prédicat `path` qui décide déjà
      //   `<a>` contre `<div>`.
      r.path ? (r.uuid || 0) : 0,
      dic.r.idx(r.rarity),
      // ⭐ LA MENTION, PAS LE CODE — voir le bloc en tête de fichier. Mesuré :
      //   `edition_type` porte 220 valeurs brutes distinctes sur les comics,
      //   dont `mentionEdition()` ne retient que FA/FE/CE. Un filtre bâti sur
      //   les 220 aurait offert 217 cases qui ne séparent rien.
      dic.e.idx(mentionEdition(r.edition_type)),
      dic.b.idx(r.brand),
      dic.l.idx(r.licensor),
      annee(r.releaseDate),
      r.tirage || 0,
    ]);
  return charge(corpus, prefixe, COLS_PIECE, dic, lignes);
}

function charge(corpus, prefixe, cols, dic, lignes) {
  const c = {
    v: 1,
    corpus,
    prefixe,
    cols,
    dic: Object.fromEntries(Object.entries(dic).map(([k, d]) => [k, d.valeurs()])),
    total: lignes.length,
    lignes,
  };
  // ⭐ LA PASTILLE DE RARETÉ, RENDUE PAR LA FONCTION DU SERVEUR, une fois par
  // rareté PRÉSENTE. ⛔ Pas `Object.keys(RAR)` en entier : une pastille émise
  // pour une rareté qu'aucune ligne ne porte serait une case de filtre qui rend
  // toujours zéro — le contrôle qui apprend à ne plus cliquer dessus (lot 133).
  if (c.dic.r) {
    c.rar = Object.fromEntries(c.dic.r.map((code) => [code, {
      l: (RAR[code] || RAR.COMMON).l,
      h: rar(code, { blanc: true }),
    }]));
  }
  // ⛔⛔ LE CONTRÔLE EST *DANS* LE PRODUCTEUR, PAS SEULEMENT DANS LE BANC.
  // Un banc dit « ça a fui » après le build ; ici on refuse d'écrire. Les deux,
  // parce que le banc voit ce que ce fichier ne voit pas (le `dist/` entier) et
  // que ce fichier voit ce que le banc ne verra jamais (une charge construite
  // dans un mode de rendu où le banc ne tourne pas).
  const noms = new Set([...cols, ...Object.keys(c.dic)]);
  const fuite = INTERDITS.filter((k) => noms.has(k));
  if (fuite.length) {
    throw new Error(`[rayon-index] champ de prix dans un index PUBLIC : ${fuite.join(', ')}. `
      + '⛔ Ce fichier part dans dist/client/ : c\'est la fuite du lot 101.');
  }
  return c;
}

// ═══════════════════════════════════════════════════════════════════════════
//  🔴🔴🔴 DÉPÔT AU BUILD, LECTURE À LA ROUTE — ET C'EST UN DÉPLOIEMENT ROUGE
//  QUI L'A EXIGÉ (17/08, commit `a4b613c`)
// ═══════════════════════════════════════════════════════════════════════════
// La première version faisait construire l'index PAR LA ROUTE, trois fois,
// pendant la génération des pages. Le build est mort sur le VPS à l'étape
// **31/55** (`npm run build`), à **187 s**, après **4 189 pages sur 12 946**,
// **sans ERROR et sans code de sortie** — conteneur TUÉ.
// ⭐ Mesuré dans le bac à sable, dans la condition EXACTE du Dockerfile
// (`I18N_MARQUAGE=1`), pic de mémoire résidente :
//     sans le lot                    1 776 468 Ko
//     la barre seule, sans les routes 1 628 512 Ko
//     le lot complet                 1 912 788 Ko
// ⚠️⚠️ ET LE BRUIT ENTRE DEUX RUNS EST DE ~150 Mo : « la barre seule » sort
// SOUS « sans le lot », ce qui est impossible. ⇒ **On ne peut donc pas attribuer
// un nombre exact aux routes** ; ce qu'on peut dire, c'est que les trois
// constructions arrivent AU PIRE MOMENT — pendant la génération des pages, quand
// `dataset()` retient déjà 2,1 M de relevés et 40,6 Mo de réserve.
// → `regle-statistique-sans-contre-epreuve` : je dis ce que la mesure permet, et
//   pas plus.
//
// ⇒ **Le correctif ne dépend pas de l'attribution exacte** : construire trois
// fois 16 789 lignes au moment le plus chargé du build est un gaspillage, quelle
// qu'en soit la facture. ⭐⭐ Et la maison a déjà la bonne forme, DEUX fois :
// `deposerMarche()` et `deposerVignettes()` déposent à la fin de `dataset()`, où
// `ds` est chaud, et une route relit le fichier. On la suit — les tableaux sont
// construits UNE fois, dans une portée qui se libère aussitôt.
// ⛔ ET LA ROUTE NE RETOMBE PAS SUR `indexRayon()` SI LE FICHIER MANQUE. C'est la
// règle de `lireMarche()`, mot pour mot : un repli silencieux coûterait le pic
// qu'on vient de supprimer, et masquerait une image mal construite.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

// ⭐ `PROJECT_ROOT || cwd()` — LA LIGNE EXACTE DE `cote.mjs` l. 61 ET DE
//   `vignettes.mjs`. ⛔ Pas `import.meta.url` : Astro **bundle** ce module dans
//   `dist/server/`, et les fichiers seraient partis dans
//   `dist/server/.reserve/` — build VERT, journal fier, et en production une
//   barre de filtres qui ne trouve rien. C'est la panne du §M‑190, déjà payée.
//   *Trois dépôts du build, une seule façon de calculer où ils vont.*
const RACINE = process.env.PROJECT_ROOT || process.cwd();
export const RAYON_INDEX_DIR = process.env.RESERVE_RAYON_INDEX || join(RACINE, '.reserve', 'rayon-index');

export const fichierIndex = (corpus) => join(RAYON_INDEX_DIR, `${corpus}.json`);

/** Dépose les trois index. Appelé UNE FOIS, à la fin de `dataset()`.
 *  ⚠️ Rend le journal de chaque corpus, que l'appelant écrit : ce module ne
 *  décide pas de ce qui va dans le log du build. */
export function deposerRayonIndex(ds) {
  mkdirSync(RAYON_INDEX_DIR, { recursive: true });
  const lignes = [];
  for (const corpus of CORPUS) {
    // ⭐ LA PORTÉE EST LE CORRECTIF : `c` et son texte meurent à chaque tour de
    //   boucle. Trois charges vivantes en même temps, c'était le défaut.
    const c = indexRayon(ds, corpus);
    const texte = JSON.stringify(c);
    writeFileSync(fichierIndex(corpus), texte, 'utf8');
    lignes.push(journalIndex(c) + ` — deposé (${texte.length} o)`);
    if (!c.total) {
      lignes.push(`[rayon-index] ATTENTION ${corpus} est VIDE : la barre de filtres `
        + 'se montrera et ne trouvera rien. Verifier ds.rayon / ds.collections.');
    }
  }
  return lignes;
}

/** Relit un index déposé, **en TEXTE**.
 *  ⭐⭐ On ne fait PAS `JSON.parse` puis `JSON.stringify` : la route n'a rien à
 *  inspecter, elle a un fichier à servir. Analyser 1,5 Mo pour le réécrire à
 *  l'identique, c'est payer deux fois le pic qu'on essaie de supprimer.
 *  ⛔ NE RETOMBE SUR RIEN — voir le bloc ci-dessus. */
export function lireRayonIndex(corpus) {
  const f = fichierIndex(corpus);
  if (!existsSync(f)) {
    throw new Error(
      `[rayon-index] index absent (${f}). Trois causes, dans cet ordre de cout : `
      + '(1) le build n\'a pas appele deposerRayonIndex() — regarder la fin de dataset() ; '
      + '(2) `.reserve/` n\'a pas ete copiee dans l\'image (COPY --from=build /app/.reserve) ; '
      + '(3) RESERVE_RAYON_INDEX pointe ailleurs. '
      + '⛔ On ne retombe PAS sur indexRayon() : ce repli ramenerait le pic memoire '
      + 'qui a tue le build du 17/08, et masquerait une image mal construite.');
  }
  return readFileSync(f, 'utf8');
}

/** Le journal du build. ⭐ Il dit les octets ET le remplissage de chaque axe :
 *  un axe vide à 90 % est un filtre qui répondra « aucun résultat » et aura
 *  l'air cassé. C'est la seule façon de le voir AVANT le déploiement. */
export function journalIndex(c) {
  const o = JSON.stringify(c).length;
  const pos = Object.fromEntries(c.cols.map((k, i) => [k, i]));
  const remplis = Object.keys(c.dic)
    .filter((k) => pos[k] !== undefined)
    .map((k) => {
      const n = c.lignes.filter((l) => l[pos[k]]).length;
      return `${k} ${n}/${c.total} (${c.dic[k].length} valeurs)`;
    });
  return `[rayon-index] ${c.corpus} : ${c.total} ligne(s), ${(o / 1024).toFixed(0)} Ko`
    + ` — ${(o / Math.max(1, c.total)).toFixed(0)} o/ligne · ${remplis.join(' · ')}`;
}
