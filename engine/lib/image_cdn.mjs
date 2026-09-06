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
