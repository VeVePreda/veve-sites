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
// 📒🔴 LOT 224 — CE BANC N'A PAS BESOIN DU CLASSEUR, ET IL LE PAIERAIT.
// Ce fichier appelle `dataset()`, qui écrit désormais l'index du classeur :
// ~264 Mo téléchargés et ~46 s ajoutées à un banc dont la question est « N
// appels concurrents rendent-ils UNE seule construction ? ». Mesuré le
// 04/09 : sans cette ligne le banc dépasse 110 s et sort en **timeout** —
// c'est-à-dire ROUGE, pour une raison qui n'est pas la sienne.
// ⭐⭐ *Un banc qui rougit à cause d'un coût qu'il ne mesure pas cesse d'être
// lisible* : on cherche le défaut dans la concurrence, il est dans une source
// que le banc ne regarde même pas.
// ⛔ NE PAS étendre ce réglage aux autres bancs « au cas où » : le classeur
// s'écrit par défaut, et c'est ce qui fait qu'un vrai build le produit. Ici
// c'est une EXCEPTION nommée, avec sa mesure ; ailleurs ce serait un
// interrupteur oublié. ⭐ Le classeur, lui, a son propre banc (`test:classeur`).
// ⚠️ ET OUI, CETTE LIGNE S'EXÉCUTE APRÈS L'`import` CI-DESSOUS — les imports
// ES sont hissés. Ça marche quand même, et pour une raison précise :
// `CLASSEUR_OFF` est lu DANS `ecrire()`, à l'appel, pas au chargement du
// module. ⛔ Le jour où quelqu'un remonte cette lecture au niveau module, ce
// réglage devient muet et ce banc repart en timeout. *Vérifié en le jouant,
// pas déduit* : le journal dit « DESACTIVE par CLASSEUR_OFF=1 ».
process.env.CLASSEUR_OFF = '1';

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
