// ⚠️ VeVePreda/veve-sites — engine/lib/jour_du_build.mjs   (FICHIER NEUF — lot 161)
// ═══════════════════════════════════════════════════════════════════════════
//  LE JOUR DU BUILD — écrit UNE fois, parce qu'il l'était déjà DEUX
// ═══════════════════════════════════════════════════════════════════════════
//
// `buildDay()` existait à l'identique dans `engine/lib/blog.mjs` (l. 49) et
// `engine/lib/editorial.mjs` (l. 37) : même corps, même commentaire, aucune des
// deux exportée. Le lot 161 en aurait écrit une TROISIÈME pour l'image du jour
// de l'accueil. ⭐⭐ « Deux endroits qui font la même chose divergent en
// silence » est déjà la leçon de `_dom_banc.mjs` ; trois, c'est une habitude.
//
// 🔴 POURQUOI ON RAISONNE EN JOURS ET JAMAIS EN HEURES. Le cron GitHub part
// avec 2 à 3 h de retard, et la reconstruction quotidienne tourne deux fois par
// jour. Une décision prise sur l'HEURE changerait de réponse entre deux builds
// du même jour — c'est-à-dire au hasard. Prise sur le JOUR, elle est stable :
// deux builds du 24/08 rendent la même chose, le 25/08 en rend une autre.
//
// ⭐ `BUILD_DATE` (AAAA-MM-JJ) surcharge, pour rejouer une journée précise ou
// pour qu'un banc puisse mesurer DEUX jours différents dans le même processus.
// ⛔ Sans cette porte, « l'image change-t-elle chaque jour ? » serait
// invérifiable autrement qu'en attendant demain.

/** Fin de journée UTC du build, en millisecondes. Un item daté « aujourd'hui »
 *  est donc considéré comme sorti aujourd'hui, pas demain. */
export function jourDuBuild() {
  const brut = process.env.BUILD_DATE;
  const d = brut ? new Date(brut + 'T23:59:59Z') : new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59);
}

/** Le numéro du jour depuis l'époque Unix — l'index d'une rotation quotidienne.
 *  ⛔ Ne pas le calculer avec `Math.floor(Date.now() / 86400000)` ailleurs : ce
 *  calcul-là ignore `BUILD_DATE`, donc il ne se teste pas. */
export const numeroDuJour = () => Math.floor(jourDuBuild() / 86_400_000);

/** Choisit un élément d'après le jour. Stable dans la journée, différent le
 *  lendemain, et il revient au bout de `liste.length` jours.
 *  ⚠️ Rend `null` sur une liste vide — un appelant qui n'y penserait pas
 *  afficherait `undefined.image` et casserait la page. */
export function choisirDuJour(liste) {
  if (!Array.isArray(liste) || liste.length === 0) return null;
  return liste[((numeroDuJour() % liste.length) + liste.length) % liste.length];
}
