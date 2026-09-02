// ⚠️ VeVePreda/veve-sites — engine/lib/chrono_build.mjs   (FICHIER NEUF — lot 214)
// ═══════════════════════════════════════════════════════════════════════════
// ⏱️🔴🔴🔴 LE CHRONO DU DÉPLOIEMENT — « QUELLE PHASE MANGE LES 45 MINUTES ? »
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EXISTE — 01 et 02/09/2026
// ─────────────────────────────────────────────────────────────────────────
// Un déploiement a pris 43 minutes ; le lot déposé se bâtit en 3 secondes.
// Tout ce qui se mesure depuis le bac à sable a été mesuré, et TOUT est
// innocent : le lot (3 s), `marquer:i18n` (0,30 s), les 23 bancs d'avant
// (132 s), les 22 bancs d'après (4,2 s de calcul), le build Astro en ligne
// (67 s pour 12 980 pages). La somme fait quatre minutes, pas quarante-cinq.
//
// ⭐⭐⭐ LE BAC À SABLE PRÉDIT LE CODE, JAMAIS LA MACHINE. Le 24/08, la MÊME
// étape a duré 72 s puis 720 s dans la même journée, à code identique. On ne
// cherche donc pas une faute de code : on cherche QUAND le temps disparaît, et
// personne ne le sait — parce que rien ne le mesure.
//
// ⛔⛔ ET LE JOURNAL COOLIFY NE PEUT PAS LE DIRE. Mesuré deux fois : il
// s'arrête au milieu d'une étape (à la 10ᵉ seconde le 25/08 ; à 18:17:16 sur
// un journal pris à 18:38:29 le 01/09). *Un instrument dont la sortie
// n'atteint pas son lecteur ne mesure rien.* C'est la troisième fois que ce
// journal tronqué coûte une journée.
//
// ⇒ Le chrono voyage par le SEUL canal dont on sait qu'il arrive : un fichier
//   embarqué dans l'image, servi par `/api/sante`. Exactement le chemin que
//   `memoire.mjs` (lot 175) et `astro_temoin_build.mjs` (lot 196) ont déjà
//   payé et éprouvé. On ne réinvente rien, on réutilise ce qui marche.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 POURQUOI PAS DANS `.reserve/` — ET ÇA A FAILLI ÊTRE ÉCRIT LÀ
// ═══════════════════════════════════════════════════════════════════════════
// Premier jet : `.reserve/_chrono.json`, à côté du témoin et du rapport
// mémoire. **C'EST FAUX, ET SILENCIEUSEMENT.** `engine/lib/reserve.mjs` l. 98
// fait `rmSync(RESERVE_DIR, { recursive: true, force: true })` **pendant le
// build** : les deux voisins survivent parce qu'ils sont écrits APRÈS cette
// ligne. Le chrono, lui, doit poser son premier jalon AVANT le build — il
// serait donc effacé, et `/api/sante` rendrait un chrono qui commence au
// milieu, sans qu'aucun banc ne rougisse.
// ⭐ D'où `/app/.chrono.json`, à la racine, hors de tout dossier que quelqu'un
//   nettoie. Le `COPY --from=build /app/.chrono.json` du Dockerfile l'amène
//   dans l'image de service.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CHAQUE JALON MARQUE UN DÉBUT, JAMAIS UNE FIN — ET C'EST UNE RÈGLE
// ═══════════════════════════════════════════════════════════════════════════
// Un jalon posé en FIN de `RUN` devient la dernière commande de l'étape, donc
// c'est SON code de sortie qui devient celui de l'étape. Ce chrono réussit
// toujours : il transformerait n'importe quel échec en vert.
// 🔴 C'EST EXACTEMENT LA FAUTE DU LOT 27, écrite noir sur blanc dans le
// Dockerfile l. 309 : `npm run build; mkdir -p /app/.reserve` faisait passer
// au vert un build Astro mort. ⛔ On ne la refait pas avec un instrument.
// ⇒ Tous les jalons se posent EN TÊTE d'un `RUN` qui existe déjà, et la durée
//   d'une phase se lit comme l'écart avec le jalon SUIVANT.
// ⭐ Bénéfice second : zéro couche Docker ajoutée. On cherche à alléger
//   l'image, pas à lui ajouter cinq étapes pour la mesurer.
//
// ⚠️ CE QUE CE CHRONO NE PEUT PAS FAIRE
//   · Un build qui MEURT ne produit aucune image, donc aucun fichier lisible.
//     Pour ce cas-là, seul le journal parle. Les deux moyens sont
//     complémentaires ; aucun ne remplace l'autre.
//   · Une couche servie par le CACHE Docker ne réexécute pas son jalon : son
//     horodatage est celui d'un build ANTÉRIEUR. ⭐ Ça se VOIT — l'écart avec
//     le jalon suivant devient énorme ou négatif — et `/api/sante` rend les
//     horodatages BRUTS pour que le lecteur puisse en juger. ⛔ On ne
//     « corrige » pas un écart négatif : on le montre.
//     🔑 En pratique le `COPY . .` (Dockerfile l. 30) invalide le cache de
//     TOUT ce qui suit dès qu'un fichier du dépôt change — c'est-à-dire à
//     chaque dépôt réel. Le cas reste possible, il n'est pas le cas courant.
//
// ⛔ AUCUN CHEMIN, AUCUNE VARIABLE D'ENVIRONNEMENT, AUCUN NOM DE MACHINE NE
//    SORT D'ICI. Des noms de phase et des horodatages. `/api/sante` est
//    publique et elle le reste — même règle que le lot 101.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadavg, cpus } from 'node:os';

// 🔴🔴 LE CHEMIN SE RÉSOUT À L'APPEL, PAS À L'IMPORT. Une `const` lue au
//   chargement fige `process.env` tel qu'il était à ce moment-là, et un banc
//   qui règle la variable APRÈS l'import écrirait dans le vrai fichier du
//   build. Même piège que `rapport()` dans `memoire.mjs`, qui l'a payé.
export function fichier() {
  return process.env.CHRONO_FICHIER
    || join(process.env.PROJECT_ROOT || process.cwd(), '.chrono.json');
}

/** Le nom d'une phase : lettres, chiffres et tirets, 32 caractères au plus.
 *  ⛔ PAS DE TEXTE LIBRE. Ce fichier est servi tel quel par une route publique ;
 *     une forme exigée est ce qui garantit qu'on n'y versera jamais un chemin
 *     ou un message d'erreur par inadvertance. Un nom refusé n'écrit RIEN et
 *     ne fait pas échouer l'appelant — voir `jalonner()`. */
const NOM_OK = /^[a-z0-9-]{1,32}$/;

/**
 * Pose un jalon. ⛔ N'ÉCHOUE JAMAIS, ET NE REND RIEN D'UTILE : personne ne doit
 * pouvoir BRANCHER une décision sur cet instrument. Il observe, il ne pilote
 * pas — même règle que `jalon()` dans `memoire.mjs`.
 * @param {string} nom  le nom de la phase qui COMMENCE
 * @returns {boolean}   écrit ou non. Pour les bancs, jamais pour le build.
 */
export function jalonner(nom) {
  try {
    if (!NOM_OK.test(String(nom))) return false;
    const ou = fichier();
    let etat = { jalons: [] };
    if (existsSync(ou)) {
      try {
        const lu = JSON.parse(readFileSync(ou, 'utf8'));
        if (Array.isArray(lu.jalons)) etat = lu;
      } catch { /* fichier illisible : on recommence, un chrono partiel vaut mieux que rien */ }
    }
    // ⭐ LA CHARGE EST RELEVÉE ICI AUSSI, ET PAS SEULEMENT DANS `memoire.mjs`.
    //   Le rapport mémoire ne vit que pendant `astro build` : il ne dit rien
    //   des 23 bancs d'avant ni de la précompression, et c'est justement une
    //   de ces phases qu'on soupçonne. Un jalon sans sa charge dirait QUAND
    //   sans dire SOUS QUELLE CONTENTION.
    // ⚠️ `loadavg()` DANS UN CONTENEUR REND CELUI DE L'HÔTE, pas du cgroup.
    //   C'est une limite bien connue de Linux — et ICI C'EST CE QU'ON VEUT :
    //   l'hypothèse mesurée est que SIX applications plus le build se
    //   partagent DEUX cœurs. C'est la machine entière qu'on écoute.
    // ⭐ `coeurs` voyage avec : un `loadavg` de 3,5 ne veut rien dire sans le
    //   nombre de cœurs, exactement comme un `rss` sans son plafond.
    etat.jalons.push({
      nom: String(nom),
      ts: new Date().toISOString(),
      charge: Math.round(loadavg()[0] * 100) / 100,
      coeurs: cpus().length,
    });
    etat.ecritLe = new Date().toISOString();
    writeFileSync(ou, JSON.stringify(etat), 'utf8');
    // ⭐ ET IL S'IMPRIME AUSSI. Le journal se tronque, il ne ment pas : quand
    //   il arrive, il arrive plus tôt que la fin du déploiement. Deux canaux,
    //   et c'est le fichier qui est le canal SÛR.
    console.log(`[chrono] ${nom} — ${etat.jalons[etat.jalons.length - 1].ts}`
      + ` · charge ${etat.jalons[etat.jalons.length - 1].charge} sur ${cpus().length} coeur(s)`);
    return true;
  } catch {
    // ⛔ SILENCIEUX ET SANS ÉCHEC. Un build qui tomberait parce que son CHRONO
    //    n'a pas pu écrire serait le comble : l'instrument casserait ce qu'il
    //    observe. L'absence se lit à l'autre bout — `/api/sante` rend
    //    `chrono: null`, ce qui est une RÉPONSE.
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// APPEL EN LIGNE DE COMMANDE — c'est comme ça que le Dockerfile s'en sert
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ EN NODE, ET SURTOUT PAS EN SHELL. `test:dockerfile` ne lit QUE le
// Dockerfile : un `.sh` échapperait à son contrôle des gnuismes busybox
// (`find -printf`, `-delete`, `stat -c`, `xargs -P` n'existent pas sous
// Alpine). Écrit en Node, ce chrono est vérifié par les mêmes bancs que le
// reste du moteur, et il tourne à l'identique au bac à sable et en production.
// ⭐ `engine/` est copié dans l'image de service (Dockerfile l. 771), donc ce
//   fichier est appelable depuis les DEUX étapes du Dockerfile. `outils/`, lui,
//   ne l'est pas — c'est ce qui a décidé de son emplacement.
// ⛔ SORTIE 0 QUOI QU'IL ARRIVE, y compris sur un nom refusé. Voir le § sur les
//    jalons en tête de `RUN` : ce processus ne doit JAMAIS pouvoir décider du
//    sort d'une étape.
const appeleEnCli = process.argv[1] && process.argv[1].endsWith('chrono_build.mjs');
if (appeleEnCli) {
  jalonner(process.argv[2] || 'sans-nom');
  process.exit(0);
}
