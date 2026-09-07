// ⚠️ VeVePreda/veve-sites — engine/lib/bord.mjs   (FICHIER NEUF — lot J)
// ═══════════════════════════════════════════════════════════════════════════
// CE QUE LE TABLEAU DE BORD CHARGE — une fois, pour DEUX routes
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 IL Y A DEUX ROUTES DE TABLEAU DE BORD, ET C'EST LE VRAI RISQUE DU LOT :
// `/dashboard/` et `/[locale]/dashboard/`. `test:tableau` les juge toutes les
// deux depuis le lot 202, parce qu'un chargement écrit dans une seule donne un
// écran qui marche en anglais et se tait en français — « une correction qui
// s'arrête au bord de son fichier ».
// ⇒ Le chargement vit ICI, les deux routes l'appellent, et il n'existe qu'une
//   seule version de « comment on va chercher les favoris d'un membre ».
//
// ⛔ ET IL NE LIT NI COOKIE NI `Astro.locals` : il reçoit le `sid`. C'est la
//    règle du lot 202, à la lettre — `Astro.cookies` dans autre chose qu'une
//    route marche tant que la page est rendue à la demande, puis rend « rien »
//    sans une erreur le jour où un gabarit pré-généré l'emploie.
//
// ⛔⛔ AUCUN MONTANT NE SORT D'ICI. `vignette()` a une liste FERMÉE de six
//    champs (image, nom, nom qualifié, chemin, rareté, mention d'édition) et
//    aucun n'est un prix. Les planchers, la variation 7 j et la jauge ATL/ATH
//    arrivent dans le NAVIGATEUR par `/api/cote/lot`, derrière la porte
//    `cote` — c'est le mur du lot 101, et ce fichier ne s'en approche pas.

import { compteDeLaSession } from './compte.mjs';
import { lireFavoris } from './favoris.mjs';
import { vignette } from './vignettes.mjs';
import { lireEtMarquerVisite, NON_SU } from './visite.mjs';

/**
 * @param {string|null} sid
 * @returns {Promise<{favoris: Array, visite: string|null|undefined, indisponible: boolean}>}
 */
export async function donneesDuBord(sid) {
  // ⚠️ `indisponible` N'EST PAS « aucun favori », ET LES DEUX NE SE DISENT PAS
  //    PAREIL — c'est mot pour mot la garde de la route `/favoris/`, et elle
  //    vaut ici pour la même raison : afficher « vous n'avez rien mis de côté »
  //    à quelqu'un qui a trente favoris est une affirmation fausse.
  let favoris = [];
  let visite = NON_SU;
  let indisponible = false;
  try {
    const compte = sid ? await compteDeLaSession(sid) : null;
    if (!compte) {
      indisponible = true;
    } else {
      const favs = lireFavoris(compte) || {};
      favoris = Object.keys(favs).map((u) => vignette(u, favs[u]));
      // ⭐ LA VISITE SE MARQUE ICI, ET SEULEMENT SI ON SAIT QUI REGARDE. Sur un
      //   compte inconnu il n'y a rien à dater, et poser une visite sous un
      //   identifiant absent écrirait la date de tout le monde au même endroit.
      visite = lireEtMarquerVisite(compte);
    }
  } catch {
    indisponible = true;
  }
  return { favoris, visite, indisponible };
}
