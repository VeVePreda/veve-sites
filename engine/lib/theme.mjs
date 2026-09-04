// ⚠️ VeVePreda/veve-sites — engine/lib/theme.mjs   (FICHIER NEUF — lot 217)
// ═══════════════════════════════════════════════════════════════════════════
// LE THÈME SUIT LE COMPTE — la dernière préférence restée dans le navigateur
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 CE QUE CE FICHIER FERME, ET IL ÉTAIT SEUL À NE PAS L'ÊTRE.
// `/compte/` porte depuis le lot 97 une phrase que la page se dit à elle-même :
// « Ils suivent ce navigateur. Le jour où le compte existera, ils suivront le
// compte. » Le compte existe depuis le palier `member`, et DEUX des trois
// réglages ont suivi :
//   · la LANGUE  — lot 154-B, `lirePref(compte, 'langue')` reposé par `/api/entrer` ;
//   · le TABLEAU DE BORD — lot 202, `CLE_PREF` + cookie porteur.
// Le THÈME, lui, est resté dans `localStorage` (`veve-theme`, `Base.astro`).
//
// ⭐⭐⭐ ET LA PHRASE, ELLE, EST RESTÉE VRAIE POUR LES TROIS. Une note qui
// décrit l'état d'avant se lit comme une spécification : elle a survécu à
// deux lots qui l'avaient à moitié démentie. *Une observation datée vieillit ;
// écrite au présent, elle ment.* Elle est corrigée dans les cinq langues avec
// ce lot — et pas « quand tout sera fini », sinon elle mentira encore.
//
// 🔑🔑 LA BASE EST LA VÉRITÉ, LE COOKIE EST LE PORTEUR. Même dispositif que le
// lot 202, pour la même raison mécanique : les 9 354 fiches sont PRÉ-GÉNÉRÉES
// et n'ont personne à qui demander. Elles ne peuvent lire qu'un cookie.
// ⛔ D'OÙ `httpOnly: false`, ET C'EST UNE DIFFÉRENCE ASSUMÉE AVEC LE COOKIE DU
//    TABLEAU DE BORD. Celui-ci est lu par le script anti-scintillement, en
//    ligne, AVANT le premier octet de style — un cookie `httpOnly` y serait
//    invisible, et la page s'afficherait en clair une fraction de seconde
//    avant de basculer en sombre. C'est le même raisonnement que le cookie de
//    langue (`vp_langue`, lot 129) : ce qui doit être lu par le navigateur
//    n'a pas à être caché du navigateur.
// ⭐ ET IL N'ACCORDE AUCUN DROIT. Une couleur de fond n'est pas une porte :
//   quiconque forge ce cookie s'offre… un fond sombre. Le jour où il
//   déciderait d'un CONTENU, il faudrait le refaire signer côté serveur.

/** La clé sous laquelle le thème est rangé dans `prefs`. */
export const CLE_THEME = 'theme';

/** Le cookie qui PORTE le thème jusqu'aux pages pré-générées. */
export const COOKIE_THEME = 'vp_theme';

/** Un an, comme le cookie de langue : un réglage d'affichage ne se réexplique
 *  pas tous les mois — et si le cookie disparaît, la base le repose à la
 *  connexion suivante. */
export const THEME_DUREE = 31536000;

// ⛔ LISTE BLANCHE, JAMAIS LISTE NOIRE. Deux valeurs, et rien d'autre : ce
//   cookie finit dans un `setAttribute('data-theme', …)`, donc dans le DOM.
//   Une valeur libre y écrirait ce qu'elle veut.
// ⚠️ `'jour'` EST UNE VALEUR, PAS UNE ABSENCE. Elle dit « j'ai choisi clair »,
//   ce qui n'est pas « je n'ai rien choisi » — et la différence compte le jour
//   où un thème automatique lira la préférence système : sans elle, quelqu'un
//   qui a explicitement choisi le clair se verrait imposer le sombre à la
//   tombée de la nuit. *Inconnu ≠ défaut.*
const VALEURS = ['jour', 'nuit'];

/** Rend le thème s'il est connu, `null` sinon. ⛔ Jamais de repli sur 'jour' :
 *  ce serait transformer une valeur illisible en un choix explicite. */
export function themeValide(v) {
  const s = String(v ?? '').trim();
  return VALEURS.includes(s) ? s : null;
}
