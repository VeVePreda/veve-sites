// ⚠️ VeVePreda/veve-sites — engine/lib/visite.mjs   (FICHIER NEUF — lot J)
// ═══════════════════════════════════════════════════════════════════════════
// « DEPUIS VOTRE DERNIÈRE VISITE » — une date, et elle se lit AVANT de s'écrire
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚖️ ARBITRAGE PREDA, 07/09/2026 : oui, une date de visite EN BASE, écrite à
// chaque ouverture du tableau de bord. Sans elle, « 2 seuils franchis » n'a pas
// de borne basse : franchis DEPUIS QUAND ? Un compteur sans son point de départ
// est un nombre qui a l'air d'une mesure.
//
// ⭐⭐⭐ ET IL N'Y A NI TABLE NEUVE, NI FICHIER DE BASE NEUF, NI MIGRATION.
// `prefs.mjs` range déjà « (compte, clé) → valeur » dans `/data/veve-favoris.db`
// — le SEUL fichier monté (voir l'en-tête de `favoris.mjs` : une seconde base
// voudrait un second volume, donc un second oubli possible, et l'oubli de
// volume est une panne MUETTE). Une date de visite est une préférence de compte
// comme une autre : elle appartient à une personne, elle tient en 24 octets, et
// `test:prefs` couvre déjà tout le mécanisme.
// ⛔ Écrire ici un `CREATE TABLE visites` aurait été la deuxième forme de
//    rangement pour la même chose, avec sa propre ouverture de base, son propre
//    plafond et sa propre panne à diagnostiquer.
//
// 🔴🔴 LA LECTURE PASSE AVANT L'ÉCRITURE, ET C'EST TOUT LE FICHIER.
// Poser la visite d'abord puis la lire rendrait TOUJOURS « il y a 0 seconde » —
// la page effacerait sa propre réponse en la calculant. Une seule fonction fait
// les deux, dans cet ordre, pour qu'aucun appelant ne puisse les inverser.
//
// ⚠️ ET ELLE NE LÈVE JAMAIS. Le tableau de bord doit s'ouvrir même si la base
// est muette : sans date, la case « seuils franchis » ne s'affiche pas, et
// c'est tout. ⛔ Mais on ne rend pas `0` pour autant — voir `NON_SU`.

import { lirePref, poserPref } from './prefs.mjs';

export const CLE = 'bord.visite';

/** ⭐ TROIS ÉTATS, ET ILS NE SE CONFONDENT PAS :
 *    · une date  → on sait, et on peut dire « depuis le … » ;
 *    · `null`    → PREMIÈRE visite : il n'y a pas de « depuis » ;
 *    · `undefined` → on ne SAIT PAS (base muette). L'appelant n'affiche rien.
 */
export const NON_SU = undefined;

/**
 * Rend la visite PRÉCÉDENTE, puis inscrit celle-ci.
 * @param {string|null} compte
 * @param {Date} [maintenant]
 */
export function lireEtMarquerVisite(compte, maintenant = new Date()) {
  if (!compte) return NON_SU;
  let precedente;
  try {
    const brut = lirePref(compte, CLE);
    // ⚠️ ON VALIDE CE QU'ON RELIT. La valeur vient d'une base que d'autres lots
    //   écrivent : une chaîne vide, un « 0 » ou une date illisible doivent
    //   sortir en `null` (« pas de précédente ») et surtout pas en `Invalid
    //   Date`, qui se propage en « NaN jour » jusque dans la page.
    const t = brut ? Date.parse(brut) : NaN;
    precedente = Number.isFinite(t) ? new Date(t).toISOString() : null;
  } catch {
    // ⛔ « Je ne sais pas » n'emprunte pas la sortie de « première visite » :
    //    la première dit « rien à montrer », la seconde dit « tout est neuf ».
    return NON_SU;
  }
  try {
    poserPref(compte, CLE, maintenant.toISOString());
  } catch {
    // ⭐ ÉCHOUER À ÉCRIRE N'EFFACE PAS CE QU'ON VIENT DE LIRE. La page reste
    //   juste ; c'est la PROCHAINE visite qui comparera à une date plus
    //   ancienne. Un `throw` ici fermerait le tableau de bord pour une
    //   préférence — ⛔ jamais.
  }
  return precedente;
}
