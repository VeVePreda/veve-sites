// Le jeu de donnees ne doit etre construit QU'UNE FOIS par build.
//
// Astro evalue getStaticPaths de 18 fichiers de route EN PARALLELE. Si la
// memoisation n'intervient qu'apres le telechargement et la lecture en flux,
// chaque route relance un flux complet du fichier de prix (des centaines de
// Mo en production) : le build tombe en memoire, et pire, chaque route
// travaille sur SON PROPRE jeu de donnees — le sitemap peut alors decrire des
// adresses que les pages n'ont pas.
//
// Invisible sur l'echantillon, fatal sur les vraies donnees (deploiement en
// echec du 18/07/2026).
import { dataset } from '../lib/dataset.mjs';

const N = 8;
const resultats = await Promise.all(Array.from({ length: N }, () => dataset()));
const distincts = new Set(resultats).size;

console.log(`${N} appels simultanes -> ${distincts} jeu(x) de donnees distinct(s)`);
if (distincts !== 1) {
  console.error("ECHEC : le jeu de donnees est reconstruit a chaque appel simultane.");
  process.exit(1);
}
console.log('OK : une seule construction partagee par toutes les routes.');
