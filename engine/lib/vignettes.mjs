// ⚠️ VeVePreda/veve-sites — engine/lib/vignettes.mjs   (FICHIER NEUF — lot 154-A)
// ═══════════════════════════════════════════════════════════════════════════
// 🖼️ L'INDEX DES VIGNETTES — « uuid → de quoi dessiner une tuile »
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 POURQUOI IL EXISTE, ET CE N'EST PAS UN CONFORT.
// Preda, 14/08 : « Mes favoris : présentation en TUILES ». Mesuré avant
// d'écrire une ligne : un favori ne retient QUE TROIS CHOSES — `uuid`,
// `chemin`, `nom` (`engine/lib/favoris.mjs`, table `favoris`, clé
// `(compte, uuid)`). Ni image, ni rareté, ni mention d'édition.
// ⇒ **UNE TUILE BÂTIE DEPUIS CETTE SOURCE NE PEUT PAS PORTER DE COUVERTURE.**
//   Ajouter des `<span>` au gabarit n'aurait rien produit : le manque n'est pas
//   d'affichage, il est de SOURCE. C'est mot pour mot la cause trouvée le 14/08
//   pour FA/FE/CE et ATL/ATH sur les tuiles de `/market/`, qui se bâtissent
//   depuis la LIGNE du tableau : *une seconde fabrique ne montre que ce que sa
//   source porte.* Le lot 155 lira donc CE fichier-ci, pas un second index.
//
// ⛔⛔ ET L'URL DE L'IMAGE NE SE DEVINE PAS. Mesuré sur la production le
// 17/08 : `…/collectible_type_image.<uuid>.<SECOND-uuid>.full.jpeg`, et aussi
// `comic_cover.<uuid>.<autre-uuid>.webpFull.webp`. Le second identifiant et le
// suffixe ne se dérivent de rien. Un navigateur ne peut pas fabriquer cette
// adresse ; il faut la lui donner.
//
// ⛔ ET ON NE PEUT PAS ALLER LA CHERCHER À LA DEMANDE. `/favoris/` est une
// route de COMPTE : `test:marche` §3 refuse tout `dataset()` dans ces
// routes-là et dans leurs composants — 10 328 ms mesurés au lot 125. Les deux
// autres dépôts du build ne servent pas non plus :
//   · `.reserve/marche.json` ne porte que **200 lignes** (le plafond de
//     `/market/`) — la plupart des favoris n'y seraient pas ;
//   · `.reserve/cote/<uuid>.json` ne porte que les champs **réservés** (le
//     plancher, la courbe), justement pas l'image.
// ⇒ Il manquait un index, et il en manquait UN SEUL : celui-ci.
//
// ⭐⭐⭐ CE FICHIER NE PORTE AUCUNE DONNÉE RÉSERVÉE, ET C'EST UNE PROPRIÉTÉ
// TENUE, PAS UNE INTENTION. `CHAMPS` ci-dessous est une liste FERMÉE de six
// champs que la carte publique imprime déjà en clair sur l'accueil et sur
// `/sets/`. `test:vignettes` balaie `CHAMPS_COTE` sur le dépôt : un plancher
// glissé ici serait la fuite du lot 101 refaite par la porte d'à côté, et il
// le verrait. ⛔ Ne jamais élargir cette liste sans relire ce paragraphe.
//
// ⭐ IL EST DÉPOSÉ AU BUILD, OÙ `ds.items` EST DÉJÀ LÀ. *La donnée manquante
// est presque toujours déjà calculée, puis jetée* — même motif que
// `.reserve/cote/` et que la projection du marché.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// 🔴🔴🔴 `process.cwd()`, ET SURTOUT PAS UN CHEMIN RELATIF AU MODULE — MESURÉ
// LE 17/08, ET LA PREMIÈRE VERSION DE CE FICHIER S'EST FAIT PRENDRE.
// Elle calculait la racine depuis `import.meta.url`. Au build, Astro BUNDLE ce
// module dans `dist/server/` : `import.meta.url` y pointe, et l'index de
// 2 684 Ko est parti dans `dist/server/.reserve/vignettes.json`.
// ⛔⛔ ET LE BUILD ÉTAIT VERT. Le journal annonçait fièrement « index depose :
// 8840 entree(s) » — il l'était, au mauvais endroit. Le Dockerfile copie
// `/app/.reserve` : l'index n'aurait pas été dans l'image, `lireVignettes()`
// aurait retombé sur `{}`, et `/favoris/` aurait servi une grille de gemmes
// grises. Sans erreur, sans run rouge, sans plainte.
// ⭐ *Un vert ne prouve pas qu'un fichier est ARRIVÉ, ni OÙ.*
// ⇒ On copie EXACTEMENT la ligne de `cote.mjs` (l. 61), qui a déjà tranché
//   cette question pour `.reserve/cote/` et `marche.json`. Les trois dépôts du
//   build doivent atterrir au même endroit ; trois façons de le calculer, c'est
//   deux occasions de diverger.
const ROOT = process.env.PROJECT_ROOT || process.cwd();

/** ⚠️ Voisin de `.reserve/marche.json`, HORS de `.reserve/cote/` : ce dossier-là
 *  est balayé fichier par fichier par `projeter()`, qui le vide à chaque build
 *  et n'accepte que des noms d'uuid. Un fichier étranger y serait effacé. */
export const VIGNETTES_FICHIER = process.env.RESERVE_VIGNETTES
  || join(ROOT, '.reserve', 'vignettes.json');

// ⭐⭐ DES CLÉS D'UNE LETTRE, ET CE N'EST PAS DE LA COQUETTERIE. 8 840 entrées :
// écrire `image`/`rarity`/`edition_type` au long coûte ~60 octets par ligne,
// soit un demi-mégaoctet de noms de champs répétés dans un fichier que le
// serveur relit à chaque redémarrage. ⚠️ La correspondance est ÉCRITE ICI, une
// seule fois, et `lireVignettes()` la rend en clair : aucun appelant ne
// manipule les lettres.
const CHAMPS = {
  i: 'image',        // l'adresse de la couverture — publique, sur chaque carte
  n: 'name',         // le nom court
  q: 'qualifie',     // le nom qualifié (série + nom), quand il existe
  p: 'path',         // l'adresse de la fiche
  r: 'rarity',       // la rareté — publique, imprimée par `Carte.astro`
  e: 'edition_type', // FA / FE / AP — publique depuis le lot 139
};

/**
 * Dépose l'index. Appelé UNE FOIS, à la fin de `dataset()`, donc au BUILD.
 *
 * ⚠️ APRÈS `projeterCote()`, COMME `deposerMarche()`, ET POUR LA MÊME RAISON.
 * `_ds` est scellé : les champs réservés ont déjà quitté les items. Un cran
 * plus haut, un `floor` aurait pu tomber dans cet index — et `CHAMPS` seul ne
 * l'aurait pas empêché, puisqu'il ne liste que ce qu'on COPIE. La liste fermée
 * et le moment de l'appel se gardent l'un l'autre.
 */
export function deposerVignettes(ds) {
  const items = Array.isArray(ds && ds.items) ? ds.items : [];
  const index = {};
  let sansImage = 0;
  for (const it of items) {
    if (!it || !it.uuid) continue;
    const e = {};
    for (const [court, long] of Object.entries(CHAMPS)) {
      const v = it[long];
      // ⭐ ON N'ÉCRIT PAS LES CHAMPS VIDES. `undefined` et `''` ne se
      //   distinguent pas à la lecture, et 8 840 clés vides pèsent pour rien.
      if (v !== null && v !== undefined && v !== '') e[court] = v;
    }
    if (!e.i) sansImage += 1;
    index[it.uuid] = e;
  }

  mkdirSync(dirname(VIGNETTES_FICHIER), { recursive: true });
  const charge = { genereLe: new Date().toISOString(), updatedAt: ds.updatedAt, index };
  writeFileSync(VIGNETTES_FICHIER, JSON.stringify(charge), 'utf8');

  const ko = (JSON.stringify(charge).length / 1024).toFixed(0);
  console.log('[vignettes] index depose : ' + Object.keys(index).length + ' entree(s), ' + ko + ' Ko');
  // ⭐⭐ LE TROU S'ANNONCE, DANS LE JOURNAL DE BUILD, AVANT LE DÉPLOIEMENT. Un
  // index plein d'entrées sans image rendrait une page de gemmes grises —
  // exactement l'écran qu'on cherche à éviter — et rien ne le dirait. Le
  // chiffre est donc écrit même quand il vaut zéro : *un contrôle qui ne
  // regarde que ce qui existe ne voit jamais ce qui manque.*
  console.log('[vignettes] sans couverture : ' + sansImage + ' / ' + items.length);
  return charge;
}

// ⭐⭐ LU UNE FOIS PAR PROCESSUS, ET GARDÉ. `/favoris/` est rendue à la demande :
// relire et réanalyser ~1,5 Mo à chaque visite serait un coût par visiteur pour
// une donnée qui ne bouge qu'au déploiement. Le conteneur est remplacé à chaque
// build — le cache ne peut donc pas vieillir.
// 🔴 Les octets LUS ne sont pas de la mémoire : ce qui est retenu ici est
//    l'objet analysé, une fois, pas le flux de lecture.
let cache = null;

/**
 * Relit l'index et le rend en CLAIR (noms de champs longs).
 *
 * ⭐ RETOMBE SUR UN INDEX VIDE, ET C'EST L'INVERSE DE `lireMarche()`.
 * La différence est le produit : sans la projection du marché, `/market/`
 * n'a rien à afficher et doit tomber bruyamment. Sans l'index des vignettes,
 * `/favoris/` a toujours ses noms et ses adresses — elle rend des tuiles sans
 * couverture. Faire tomber la page entière pour une image manquante serait
 * échanger une dégradation contre une panne.
 * ⚠️ Le silence n'est pas total pour autant : le journal de build a déjà dit
 *    combien d'entrées il a déposées, et `test:vignettes` l'exige non vide.
 */
export function lireVignettes() {
  if (cache) return cache;
  if (!existsSync(VIGNETTES_FICHIER)) {
    console.log('[vignettes] index absent (' + VIGNETTES_FICHIER + ') — les tuiles sortiront sans '
      + 'couverture. Causes, par ordre de cout : (1) le build n a pas appele deposerVignettes() ; '
      + '(2) .reserve/ n a pas ete copiee dans l image ; (3) RESERVE_VIGNETTES pointe ailleurs.');
    cache = {};
    return cache;
  }
  const c = JSON.parse(readFileSync(VIGNETTES_FICHIER, 'utf8'));
  const brut = (c && c.index) || {};
  const out = {};
  for (const [uuid, e] of Object.entries(brut)) {
    const o = {};
    for (const [court, long] of Object.entries(CHAMPS)) if (e[court] !== undefined) o[long] = e[court];
    out[uuid] = o;
  }
  cache = out;
  return cache;
}

/**
 * Rend un objet prêt pour `<Carte>` à partir d'un uuid et de ce que le favori
 * avait retenu.
 *
 * ⭐⭐⭐ L'INDEX GAGNE SUR LE FAVORI, ET C'EST DÉLIBÉRÉ. Le `nom` et le `chemin`
 * rangés dans la base ont été écrits par un NAVIGATEUR, le jour où le cœur a
 * été cliqué — ils peuvent avoir des mois. L'index, lui, est reconstruit à
 * chaque build depuis le catalogue. Quand un item est renommé ou déplacé, la
 * page doit montrer le nom d'aujourd'hui, pas celui d'alors.
 * ⚠️ ET LE FAVORI RESTE LE REPLI, pas l'inverse : un item sorti du catalogue
 *    n'a plus d'entrée dans l'index, et il ne doit pas disparaître de la liste
 *    de quelqu'un sans un mot. Il ressort avec son nom d'époque et sans
 *    couverture — dégradé, pas effacé.
 */
export function vignette(uuid, favori) {
  const f = favori || {};
  const v = lireVignettes()[uuid] || {};
  return {
    uuid,
    image: v.image || null,
    name: v.name || f.n || uuid,
    qualifie: v.qualifie || null,
    path: v.path || f.p || null,
    rarity: v.rarity || null,
    edition_type: v.edition_type || null,
    // ⛔ AUCUN MONTANT, ET IL N'Y EN A PAS UN SEUL À PORTÉE. `CHAMPS` n'en
    //    copie aucun ; ce champ est écrit `null` en toutes lettres pour que le
    //    prochain lecteur voie que l'absence est VOULUE et non oubliée.
    floor: null,
  };
}
