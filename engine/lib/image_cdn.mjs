// ⚠️ VeVePreda/veve-sites — engine/lib/image_cdn.mjs   (FICHIER NEUF — relooking 2)
// ═══════════════════════════════════════════════════════════════════════════
// 🖼️ CHOISIR LA BONNE TAILLE D'IMAGE SUR LE CDN — un point unique
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 CE FICHIER EXISTE PARCE QU'UNE MESURE A RENVERSÉ LA PRÉMISSE DU LOT C.
//
// Le brief demandait de **générer des vignettes au build**. Avant d'écrire une
// ligne, j'ai mesuré ce que le visiteur TÉLÉCHARGE — ce qui n'avait jamais été
// fait : `transferSize` vaut 0 dans le navigateur (`Timing-Allow-Origin` est
// absent des réponses du CDN), donc tous les poids cités jusqu'ici étaient des
// poids **décodés**, jamais transférés. Ça se mesure côté serveur, en lisant
// `content-length`.
//
// 📏 MESURÉ LE 06/09/2026, PAR `curl`, SUR 131 IMAGES TIRÉES AU SORT DANS LES
//    INDEX PUBLICS DES RAYONS (70 collectibles + 70 comics, fiches ouvertes) :
//
//   famille + variante servie   n     servi/img      thumbnail/img    gain
//   ────────────────────────────────────────────────────────────────────────
//   comic       full.jpeg      32     1 579 550 o        145 519 o    10,9×
//   comic       full.webp      28       254 345 o         22 166 o    11,5×
//   collectible full.jpeg       6       183 837 o         17 280 o    10,6×
//   collectible webpFull.webp  63        42 998 o          6 647 o     6,5×
//   ────────────────────────────────────────────────────────────────────────
//   ENSEMBLE                  129     58,63 Mo → 5,53 Mo        91 % de moins
//
// ⭐⭐⭐ AUTREMENT DIT : **LE CDN PORTE DÉJÀ LA VIGNETTE.** Il n'y a rien à
// générer au build. La couverture d'un comic pèse en moyenne **1,5 Mo** et le
// tableau de `/market/` la dessine dans une case de **48 px**. Ce n'est pas un
// défaut d'optimisation : c'est trente fois la donnée nécessaire, 200 lignes de
// suite. Un build de vignettes aurait coûté des heures de machine pour
// reproduire un fichier qui existe déjà à l'adresse d'à côté.
//
// 🔑 LA RÈGLE DE NOMMAGE, MESURÉE — ELLE NE SE DEVINE PAS, ELLE S'OBSERVE :
//        `….webpFull.webp`  ⟶  `….thumbnail.jpeg`
//        `….full.jpeg`      ⟶  `….thumbnail.jpeg`
//        `….full.webp`      ⟶  `….thumbnail.webp`
//   L'extension de la vignette **suit celle de la source**, pas le préfixe.
//
// ⛔⛔ ET ELLE N'EST PAS VRAIE PARTOUT : **129 sur 131**. Une image sur soixante
// n'a pas de vignette (2 sources sur 131 répondaient elles-mêmes 403). Une
// règle à 98,5 % qui décide seule affiche un cadre cassé une fois sur soixante.
// ⇒ **TOUTE URL RÉÉCRITE PART AVEC SON REPLI**, dans `data-repli`, et
//   `ONERROR_REPLI` y retombe. Le repli n'est pas une ceinture de confort :
//   c'est la moitié de la règle. *Une régularité vraie à 98 % reste fausse
//   dans les 2 % restants, et c'est là que le visiteur la voit.*
//
// 📐 LES LARGEURS AUSSI SONT MESURÉES, ET ELLES INTERDISENT LE RACCOURCI :
//        collectible_type_image : vignette **132 × 174** (60 sur 60 mesurées)
//        comic_cover            : vignette **239 × 367** ou **400 × 534**
//        comic_type_image       : vignette **276 × 194**
//   ⇒ Une tuile de rayon s'affiche à **173 px**. La vignette d'un collectible
//     en fait 132 : la poser là, c'est agrandir de 31 % une image déjà petite.
//     ⛔ **On ne la pose donc PAS sur les tuiles de collectibles.** Le gain
//     mesuré (6,5×) ne rachète pas un flou visible sur la page principale.
//     Le CDN n'offre AUCUNE taille intermédiaire : trois variantes existent —
//     `full`, `webpFull`, `thumbnail` — et rien d'autre, 228 noms essayés.
//
// ⭐ C'EST POURQUOI LA DÉCISION SE PREND SUR LA **LARGEUR D'AFFICHAGE**, jamais
// sur la page ni sur la famille. Un appelant dit « je dessine ça à 48 px » et
// ce module répond. Une seule question, un seul endroit : *le point unique bat
// la correction par émetteur* — la leçon du `jsonld()` de l'étape 0.

/** Le seul hôte réécrit. Une URL d'ailleurs (un blog, un avatar) ressort telle
 *  quelle : ce module ne réécrit QUE ce qu'il a mesuré. */
const HOTE_CDN = 'd11unjture0ske.cloudfront.net';

/** Suffixe servi ⟶ suffixe de la vignette. Ordre significatif : `.full.webp` et
 *  `.webpFull.webp` finissent tous deux par `.webp`, on teste le plus long. */
const VIGNETTE_DE = [
  ['.webpFull.webp', '.thumbnail.jpeg'],
  ['.full.jpeg', '.thumbnail.jpeg'],
  ['.full.webp', '.thumbnail.webp'],
];

/** La grande image en `webp` quand la source servie est un `jpeg`.
 *  Mesuré le 06/09 sur 32 couvertures de comics servies en `.full.jpeg` :
 *  **29 ont un `.webpFull.webp`**, à 509 799 o de moyenne contre 1 579 550 o —
 *  soit **3,1×** sur l'image que la fiche affiche en grand, là où la vignette
 *  serait trop petite. Les 3 autres retombent par `data-repli`. */
const GRANDE_WEBP_DE = [['.full.jpeg', '.webpFull.webp']];

/** Largeur en pixels de la vignette, par famille — **mesurée**, pas déduite.
 *  Une famille inconnue vaut 0 : on ne réécrit alors jamais, faute de savoir si
 *  l'image serait assez grande. ⛔ Ne rien ajouter ici sans avoir mesuré la
 *  variante `thumbnail` de cette famille-là. */
const LARGEUR_VIGNETTE = {
  collectible_type_image: 132,
  comic_cover: 239, // la PLUS PETITE observée ; d'autres font 400
  comic_type_image: 276,
};

/** La largeur À LAQUELLE UNE CARTE DESSINE SA COUVERTURE, en px CSS —
 *  **mesurée en production le 06/09** : 174 px en fenêtre de 375, **207 px en
 *  fenêtre de 1600**. On garde la PLUS GRANDE : c'est elle qui décide si une
 *  vignette serait agrandie. ⛔ Ce n'est pas `width="400"` de la balise, qui est
 *  un ratio de réservation, pas une largeur d'affichage. */
const LARGEUR_CARTE = 207;

/** La famille est le premier segment du nom de fichier :
 *  `comic_cover.<uuid>.<uuid>.full.jpeg` ⟶ `comic_cover`. */
function famille(url) {
  const f = url.slice(url.lastIndexOf('/') + 1);
  const p = f.indexOf('.');
  return p > 0 ? f.slice(0, p) : '';
}

function remplacerSuffixe(url, table) {
  for (const [de, vers] of table) {
    if (url.endsWith(de)) return url.slice(0, -de.length) + vers;
  }
  return null;
}

/**
 * ⭐ LE POINT UNIQUE. Rend les attributs à poser sur une `<img>`.
 *
 * @param {string|null|undefined} url  l'adresse portée par la donnée (`item.image`)
 * @param {number} largeurCSS          la largeur À LAQUELLE ON DESSINE, en px CSS
 * @returns {{src:string, srcset:string|null, repli:string|null}}
 *
 * Trois cas, et ils sortent tous de la mesure :
 *
 *  ① `largeurCSS × 2 ≤ largeurVignette` — la vignette reste nette même sur un
 *    écran à double densité. On la sert seule. C'est le cas des cases de 48 px
 *    de `/market/` et des 44 px de `/alertes/` : **c'est là que vivent les
 *    1,5 Mo**, et c'est le cas le plus simple.
 *
 *  ② `largeurCSS ≤ largeurVignette` — nette à densité 1, trop petite à densité
 *    2. On donne les DEUX au navigateur avec des descripteurs `x`, qui sont
 *    EXACTS et ne demandent pas de connaître la largeur intrinsèque de chaque
 *    fichier. ⛔ Des descripteurs `w` seraient un mensonge : les sources font
 *    1 193 px OU 2 000 px selon la pièce, et le build est hors ligne — il ne
 *    peut pas les mesurer.
 *
 *  ③ sinon — on ne touche à rien. Une image floue est une régression VISIBLE ;
 *    un octet de trop ne l'est pas. Le doute profite au rendu.
 */
export function sourcesImage(url, largeurCSS) {
  const vide = { src: url || '', srcset: null, repli: null };
  if (!url || typeof url !== 'string' || !url.includes(HOTE_CDN)) return vide;
  if (!Number.isFinite(largeurCSS) || largeurCSS <= 0) return vide;

  const w = LARGEUR_VIGNETTE[famille(url)] || 0;
  const vignette = w ? remplacerSuffixe(url, VIGNETTE_DE) : null;
  if (!vignette) return vide;

  if (largeurCSS * 2 <= w) return { src: vignette, srcset: null, repli: url };
  if (largeurCSS <= w) {
    return { src: vignette, srcset: `${vignette} 1x, ${url} 2x`, repli: url };
  }
  return vide;
}

/**
 * ⭐ La grande image d'une fiche : même source, mais en `webp` quand elle est
 * servie en `jpeg`. **3,1× mesuré**, sans changer un pixel de taille.
 * ⚠️ Rendu SÉPARÉMENT de `sourcesImage` : ce sont deux décisions différentes
 * (« plus petit » contre « mieux compressé ») et les mélanger ajouterait un
 * argument à chaque appel pour un cas qui n'arrive qu'une fois.
 */
export function grandeImage(url) {
  if (!url || typeof url !== 'string' || !url.includes(HOTE_CDN)) {
    return { src: url || '', repli: null };
  }
  const mieux = remplacerSuffixe(url, GRANDE_WEBP_DE);
  return mieux ? { src: mieux, repli: url } : { src: url, repli: null };
}

/** Les familles dont la vignette est assez grande pour une FICHE — mesuré, pas
 *  deviné. ⛔ `collectible_type_image` n'y est PAS : sa vignette fait 132 px
 *  pour une boîte qui en fait 263 à 316, elle serait agrandie de moitié. */
const FAMILLES_FICHE = ['comic_cover', 'comic_type_image'];

/**
 * ⭐⭐ LA GRANDE IMAGE D'UNE FICHE — ET LE SEUL ENDROIT DU MODULE QUI DÉCIDE
 * SUR LA FAMILLE PLUTÔT QUE SUR LA LARGEUR.
 *
 * 🔴🔴🔴 CELA CONTREDIT LA RÈGLE ÉCRITE EN TÊTE DE CE FICHIER — « la décision se
 * prend sur la LARGEUR D'AFFICHAGE, jamais sur la page ni sur la famille » — et
 * c'est VOLONTAIRE, parce qu'ici la largeur ne peut pas trancher. Ce n'est pas
 * une exception technique, c'est un ARBITRAGE DE PREDA (06/09) : « la grande
 * image passe à la vignette, en acceptant un peu de flou ».
 *
 * 📏 CE QUE LA MESURE DU 06/09 A RENVERSÉ, ET IL Y A TROIS RENVERSEMENTS :
 *
 *  ① **LA BOÎTE NE FAIT PAS 186 px.** Mesurée en production sur une fiche de
 *    comic, elle vaut **263 px à 320 et à 375 px de large**, 184 en fenêtre
 *    moyenne, **316 sur un écran de 1600**. Le « 186 × 286 » qui circulait était
 *    une lecture prise à UNE seule largeur de fenêtre, transmise comme si
 *    c'était LA largeur. ⭐⭐ *Une seule lecture ne décide jamais.*
 *
 *  ② **LA VIGNETTE D'UN COMIC N'A PAS DE TAILLE FIXE : elle vaut la grande
 *    image ÷ 5.** Sur 33 fiches tirées au sort en production : **29 vignettes de
 *    400 px** (source de 2 000) et **4 de 239 px** (source de 1 192), aucune
 *    valeur intermédiaire. `LARGEUR_VIGNETTE.comic_cover` vaut 239 parce que
 *    c'est la plus petite observée — donc un plancher, pas une taille. Le build
 *    est HORS LIGNE : il ne peut pas savoir laquelle des deux il sert.
 *
 *  ③ **ET C'EST POURQUOI IL N'Y A PAS DE `srcset` ICI.** J'avais recommandé
 *    « vignette en 1×, grande en 2× : net partout, léger pour le même travail ».
 *    ⛔⛔ C'ÉTAIT FAUX, et la mesure le dit : un descripteur `x` ne sert le 1×
 *    qu'à densité 1, or l'écran mesuré est à **1,375 en PC et 2 en mobile**. Le
 *    navigateur aurait repris la grande image dans les deux cas et le gain
 *    aurait été NUL — tout en ayant l'air d'un progrès. ⭐⭐⭐ *Une solution
 *    proposée avant d'avoir mesuré le terrain fait sauter la question du
 *    besoin ; elle se juge sur le parc réel, pas sur son élégance.*
 *
 * 💰 CE QU'ON ÉCHANGE, EN CHIFFRES MESURÉS : la fiche sert aujourd'hui
 * `webpFull` à **509 799 o** de moyenne ; la vignette d'un comic pèse
 * **145 519 o** — **3,5×**, sur tous les écrans et non plus sur certains. En
 * face : 88 % des couvertures arrivent en 400 px pour une boîte de 263 à 316
 * (légèrement adouci sur écran dense), et 12 % en 239 px, où le flou se verra.
 * ⛔ Ce 12 % n'est pas un défaut à corriger plus tard : il est la facture
 * assumée de l'arbitrage, et il est écrit ici pour qu'on ne le redécouvre pas.
 *
 * 🔑 LE REPLI RESTE L'URL SERVIE PAR LA DONNÉE, jamais une réécriture : une
 * vignette manque une fois sur soixante, et `ONERROR_REPLI` ne fait QU'UN saut.
 *
 * @param {string|null|undefined} url  l'adresse portée par la donnée (`item.image`)
 * @returns {{src:string, srcset:string|null, repli:string|null}}
 */
export function imageFiche(url) {
  const grande = grandeImage(url);
  if (!url || typeof url !== 'string' || !url.includes(HOTE_CDN)) {
    return { src: grande.src, srcset: null, repli: grande.repli };
  }
  // ⛔ Hors des familles mesurées — un collectible, une famille inconnue — on ne
  // touche PAS à la taille. Seulement à la compression, comme avant ce lot.
  if (!FAMILLES_FICHE.includes(famille(url))) {
    return { src: grande.src, srcset: null, repli: grande.repli };
  }
  const vignette = remplacerSuffixe(url, VIGNETTE_DE);
  // Une source dont le suffixe n'est pas dans la table (`.png`, un nom neuf) :
  // rien à réécrire, et surtout pas une adresse devinée.
  if (!vignette) return { src: grande.src, srcset: null, repli: grande.repli };

  return { src: vignette, srcset: null, repli: url };
}

/**
 * ⭐⭐ L'IMAGE D'UNE CARTE (`Carte.astro`) — LA MÊME DÉCISION QUE LA FICHE,
 * PRISE SUR UNE BOÎTE PLUS PETITE, DONC AVEC UNE FACTURE PLUS LÉGÈRE.
 *
 * 🔴🔴 POURQUOI CE N'EST PAS `sourcesImage(url, 207)`. Parce que ce module
 * répondrait par le CAS ②, `vignette 1x, original 2x` — et le renversement ③
 * écrit plus haut dit que ce cas NE GAGNE RIEN sur le parc réel : les deux
 * écrans mesurés le 06/09 sont à **1,375 en PC et 2 en mobile**, jamais à 1.
 * Un descripteur `x` n'y sert donc QUE l'original. ⛔ Le cas ② de `sourcesImage`
 * n'a d'ailleurs, à ce jour, **aucun appelant** : c'est un chemin jamais
 * emprunté, donc non mesuré — pas un chemin sûr.
 *
 * 📏 MESURÉ EN PRODUCTION LE 06/09, SUR UNE PAGE `/collection/` RÉELLE :
 *   fenêtre 375 px (dpr 2)  → la carte dessine **174 px**, soit 348 utiles
 *   fenêtre 1600 px (dpr 1,375) → **207 px**, soit 285 utiles
 * Et la source servie fait **2 000 px**. C'est **5,7×** la donnée nécessaire.
 *
 * 💰 LA FACTURE, SUR 97 IMAGES DE 6 PAGES, PESÉES PAR `content-length` :
 *   comic_cover  `.full.jpeg`   45 img   626 968 o → 61 275 o   **10,2×**
 *   comic_cover  `.full.webp`   24 img   226 691 o → 22 834 o    **9,9×**
 *   collectible  `.webpFull`    28 img    21 249 o →  3 114 o     **6,8×**
 *   ENSEMBLE                    97 img   34,25 Mo → 3,39 Mo — **90 % de moins**
 *   ⛔ 0 vignette manquante sur 97 — mais le repli reste posé quand même :
 *   la règle du CDN est vraie à 98,5 %, pas à 100 %.
 *
 * ⭐⭐⭐ ET ICI, CONTRAIREMENT À LA FICHE, LA VIGNETTE N'EST PAS UN COMPROMIS.
 * Sur la fiche, 400 px devaient couvrir une boîte de 526 à 632 px utiles : 63 à
 * 76 %, d'où les 12 % de flou assumés. Sur une carte il faut 285 à 348 px utiles
 * — **la vignette de 400 px les couvre entièrement**. Le seul cas mou reste la
 * vignette de 239 px, et il est mesuré : **22 % des images** (elle accompagne
 * les sources `.full.webp`), à 69 % de la densité voulue sur un mobile dpr 2.
 *
 * ⛔⛔ ET C'EST POURQUOI ON NE DÉDUIT PAS LA LARGEUR DU SUFFIXE. Un premier
 * échantillon de 69 images donnait une corrélation PARFAITE — `.full.jpeg` ⇒
 * 400 px, `.full.webp` ⇒ 239 px — et j'allais l'inscrire ici comme une règle.
 * **Un échantillon indépendant de 105 images l'a cassée** : `.full.jpeg` donne
 * 400 px 38 fois sur 41, mais aussi 398, 399, et **239 une fois**. Le plancher
 * de `LARGEUR_VIGNETTE.comic_cover` reste donc la seule valeur sur laquelle on
 * ait le droit de s'appuyer. ⭐ *Une corrélation parfaite sur un seul échantillon
 * est une lecture, pas une loi ; c'est le second échantillon qui en décide.*
 *
 * ⛔ LES COLLECTIBLES NE BOUGENT PAS, et le module le disait déjà : leur
 * vignette fait **132 px** (69 sur 69 mesurées) pour une carte de 174 à 207 —
 * la poser là, c'est agrandir une image déjà petite. On ne touche qu'à la
 * compression, comme avant ce lot.
 *
 * @param {string|null|undefined} url  l'adresse portée par la donnée (`item.image`)
 * @returns {{src:string, srcset:string|null, repli:string|null}}
 */
export function imageCarte(url) {
  const grande = grandeImage(url);
  if (!url || typeof url !== 'string' || !url.includes(HOTE_CDN)) {
    return { src: grande.src, srcset: null, repli: grande.repli };
  }
  // La décision se prend sur la largeur de la VIGNETTE de cette famille, et la
  // carte dessine à 207 px au plus large. Une famille dont la vignette est plus
  // petite que la boîte serait AGRANDIE : on n'y touche pas.
  if ((LARGEUR_VIGNETTE[famille(url)] || 0) < LARGEUR_CARTE) {
    return { src: grande.src, srcset: null, repli: grande.repli };
  }
  const vignette = remplacerSuffixe(url, VIGNETTE_DE);
  if (!vignette) return { src: grande.src, srcset: null, repli: grande.repli };

  return { src: vignette, srcset: null, repli: url };
}

/**
 * ⭐⭐ LE GESTIONNAIRE, ÉCRIT UNE FOIS ET PARTAGÉ.
 *
 * Il enchaîne DEUX étapes, et l'ordre compte : d'abord retomber sur l'original
 * (la vignette manque une fois sur soixante), et seulement si CELUI-LÀ échoue,
 * marquer le socle cassé — ce que les gabarits faisaient déjà.
 *
 * ⚠️ `srcset` doit partir AVEC `data-repli` : tant qu'il est là, le navigateur
 * peut re-choisir la variante qui vient d'échouer, et la boucle recommence.
 *
 * ⛔ En attribut, et pas dans un module : `onerror` se déclenche pendant le
 * chargement du document, souvent AVANT que le moindre script ait tourné. Un
 * écouteur délégué arriverait trop tard pour la moitié des images. (Il n'y a
 * pas de `Content-Security-Policy` sur veveprice — vérifié en production le
 * 06/09 : aucun en-tête `content-security-policy` dans la réponse.)
 */
export const ONERROR_REPLI =
  "if(this.dataset.repli){this.removeAttribute('srcset');" +
  "this.src=this.dataset.repli;this.removeAttribute('data-repli');return}" +
  "var s=this.closest('.socle');if(s)s.classList.add('socle--casse')";
