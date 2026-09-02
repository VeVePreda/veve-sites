// ═══════════════════════════════════════════════════════════════════════════
// 🖥️ LA SONDE MÉMOIRE DU BUILD — faire dire au build son propre pic
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 POURQUOI CE FICHIER EXISTE — 21/08/2026
// ─────────────────────────────────────────────────────────────────────────
// Trois fois en quatre jours, le déploiement Coolify s'est arrêté NET en plein
// `prerendering static routes`, juste après la lecture des 2 377 904 lignes de
// prix. **Ni exception, ni `#39 ERROR`, ni code de sortie.** Un défaut de code
// laisse toujours une trace ; là, il n'y en avait aucune.
//
// Ce qui est déjà mesuré, et qu'on ne remesure pas :
//   · VPS **7,8 Go / 2 cœurs**, le compose ne déclare AUCUNE limite mémoire,
//     et le noyau **n'a pas de swap** (`memory swappiness discarded`)
//     ⇒ un pic tue le conteneur **en silence**, sans rien écrire.
//   · un build sain dure ~7 min ; un build mort tombe à 26 s.
//   · Preda a vérifié chez Coolify : **un seul déploiement par push**.
//     ⇒ l'hypothèse « deux builds simultanés » est ÉCARTÉE. Il ne reste que
//       la consommation d'UN build.
//
// ⭐⭐⭐ CE FICHIER NE RÉPARE RIEN, ET C'EST LE BUT.
// Il transforme « c'est peut-être la mémoire » en **un chiffre**. Sans lui,
// tout remède choisit sa cible au hasard : plafonner le tas, alléger les prix,
// couper le prerender — trois chantiers différents, et rien pour dire lequel.
// Avec lui, le log de la prochaine mort **dira lui-même où était le pic**.
//
// ⚠️ CE QU'IL NE PEUT PAS FAIRE
//   · Il ne survit pas à un `SIGKILL` du noyau : quand l'OOM killer frappe,
//     aucun gestionnaire de sortie ne tourne. C'est précisément pour ça que
//     les jalons **impriment au fil de l'eau** au lieu d'accumuler un
//     récapitulatif final. Le dernier jalon imprimé EST la réponse.
//   · `rss` inclut ce que Node a rendu au système mais pas encore libéré : il
//     surestime parfois. C'est la bonne grandeur quand même — c'est elle que
//     le noyau regarde pour tuer.
//   · Le bac à sable ne peut PAS reproduire ce défaut : il prédit le code,
//     jamais la machine. Cette sonde ne s'éprouve donc vraiment qu'en prod.

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 175 — LE JOURNAL DU BUILD NE SUFFIT PAS, ET C'EST MESURÉ
// ═══════════════════════════════════════════════════════════════════════════
// Le lot 171 a posé cette sonde. Le lot 174 a fait de la place dans le journal
// en dédoublonnant `routes-compte` — **et ça n'a pas suffi.**
//
// 📏 DEUX DÉPLOIEMENTS, MESURÉS DANS LES LOGS COOLIFY TÉLÉCHARGÉS :
//     `273d4ff` — étape #39 : **101 lignes**, dernière à **20,92 s**
//     `469944e` — étape #36 :  **70 lignes**, dernière à **27,07 s**
//   ...alors que les deux étapes ont duré **3 min 49**.
//   ⇒ ni le nombre de lignes, ni les octets (11 124 vs 7 637) ne sont
//     constants. **La coupure n'est pas un volume.**
//   🔑 Ce qui EST constant : la dernière ligne conservée est **la même dans les
//     deux logs** — `[entrepot] baselines: 13899 lignes depuis …`, juste avant
//     le téléchargement de `prices.csv.gz` (32 Mo).
//   ⛔ `Server built`, `Complete!` et les points de boucle n'apparaissent
//     **jamais** : le journal de cette étape ne reprend pas.
//
// ⛔⛔ ET J'AI DÉDUIT FAUX UNE FOIS. Le lot 174 affirmait « Coolify garde ~100
//   lignes par étape » : 70 lignes conservées sur le déploiement suivant l'ont
//   démenti. ⭐⭐⭐ *Une régularité vue sur UN cas est une coïncidence tant
//   qu'un second cas ne l'a pas confirmée.*
//
// ⇒ ON SORT DU JOURNAL. Le rapport est écrit dans un FICHIER, embarqué dans
//   l'image (`COPY --from=build /app/.reserve ./.reserve`, Dockerfile l. 710),
//   et servi par `/api/sante`. Il devient interrogeable **à volonté, de
//   l'extérieur, sans log et sans personne** — une requête suffit.
// ⚠️ CE QUE ÇA NE COUVRE PAS : un build qui MEURT ne produit aucune image,
//   donc aucun fichier. Pour ce cas-là, seul le journal parle — et on ne sait
//   pas encore pourquoi il s'arrête. Les deux moyens sont complémentaires,
//   aucun ne remplace l'autre.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
// ⚠️ `loadavg()` DANS UN CONTENEUR REND CELUI DE L'HÔTE, pas du cgroup. C'est
// une limite connue de Linux, et ICI C'EST LA BONNE GRANDEUR : l'hypothèse
// mesurée est que six applications PLUS le build se partagent DEUX cœurs. Ce
// qu'on écoute, c'est la machine entière — pas la part du build.
import { loadavg, cpus } from 'node:os';

// 🔴🔴 LE CHEMIN SE RÉSOUT À L'APPEL, PAS À L'IMPORT. Une `const` lue au
//   chargement fige `process.env` tel qu'il était à ce moment-là — et un banc
//   qui règle la variable APRÈS avoir importé le module écrirait dans le vrai
//   `.reserve/` du build. C'est exactement le piège qui a coûté la réserve du
//   lot 104 (1 201 fichiers → 0), et il ne lève aucune erreur.
export function rapport() {
  return process.env.RESERVE_MEMOIRE
    || join(process.env.PROJECT_ROOT || process.cwd(), '.reserve', 'memoire-build.json');
}

let precedent = null;
let pic = 0;
let compteur = 0;
const etapes = [];
let plafondMo = null;
// ⭐ LE PIC DE CHARGE, comme il y a un pic de mémoire. Un maximum survit à la
//   troncature du journal : même si un seul jalon arrive, le rapport porte le
//   plus haut vu depuis le début.
let chargeMax = 0;
// ⛔ LU UNE FOIS À L'IMPORT, ET C'EST LÉGITIME ICI : le nombre de cœurs d'une
//   machine ne change pas pendant un build. (Le CHEMIN du rapport, lui, se
//   résout à l'appel — voir `rapport()` : ce n'est pas la même question.)
const COEURS = cpus().length;

const Mo = (o) => Math.round(o / 1048576);

function mesurer() {
  const m = process.memoryUsage();
  if (m.rss > pic) pic = m.rss;
  return m;
}

/**
 * Un jalon nommé, imprimé tout de suite.
 * ⛔ Ne rien retourner d'utile : personne ne doit pouvoir BRANCHER une
 *    décision sur cette sonde. Elle observe, elle ne pilote pas.
 */
export function jalon(nom) {
  const m = mesurer();
  const delta = precedent === null ? null : m.rss - precedent;
  precedent = m.rss;
  const bout = delta === null ? '' : ` · ${delta >= 0 ? '+' : ''}${Mo(delta)} Mo depuis le jalon precedent`;
  // ⏱️🔴🔴 LOT 214 — LA CHARGE, AU MÊME ENDROIT QUE LA MÉMOIRE.
  // Le lot 175 a rendu le pic mémoire lisible et il a tranché : le hors-tas est
  // écarté, le tas est à 50 % de son plafond. ⇒ **la mémoire n'est pas la cause
  // des 45 minutes**, et il ne restait aucun chiffre pour la phrase du 24/08 :
  // « 72 s → 720 s le même jour, c'est la machine ».
  // ⭐⭐ Ce relevé coûte un appel système par jalon et il répond à la seule
  //   question qui restait ouverte. ⚠️ Il n'est PAS le loadavg du conteneur —
  //   voir l'import en tête. ⛔ Un `loadavg` sans son nombre de cœurs ne se
  //   compare à rien, exactement comme un `rss` sans son plafond : les deux
  //   voyagent ensemble.
  const charge1 = Math.round(loadavg()[0] * 100) / 100;
  if (charge1 > chargeMax) chargeMax = charge1;
  console.log(
    `[memoire] ${nom} — rss ${Mo(m.rss)} Mo · tas ${Mo(m.heapUsed)}/${Mo(m.heapTotal)} Mo`
    + ` · hors-tas ${Mo(m.external)} Mo · PIC ${Mo(pic)} Mo${bout}`
    + ` · charge ${charge1} sur ${COEURS} coeur(s)`,
  );
  // ⭐ Le jalon est retenu EN PLUS d'être imprimé. Les deux chemins servent :
  //   le journal quand il arrive, le fichier quand il n'arrive pas.
  etapes.push({ nom, rss: Mo(m.rss), tas: Mo(m.heapUsed), horsTas: Mo(m.external), charge: charge1 });
  // 🔑 LOT 176 — on écrit MAINTENANT, pas à la fin. Un build qui meurt au jalon
  //   suivant laisse quand même celui-ci derrière lui... **dans son conteneur
  //   de build**, qui disparaît. ⚠️ Ça ne sauve donc PAS le cas de la mort ;
  //   ça garantit seulement que le dernier jalon ATTEINT est toujours celui que
  //   `/api/sante` rendra, quel qu'il soit et quel que soit qui l'a posé.
  ecrire();
}

/**
 * Un point de mesure DANS une boucle chaude, sans en imprimer un par tour.
 * ⭐ Appelé une fois par ligne de prix (2,4 M d'appels), il ne fait qu'un
 *   modulo : le coût est invisible devant le parsing d'une ligne CSV.
 * @param {number} chaque  imprime un point tous les `chaque` appels
 * @param {string} nom     ce qu'on est en train de traverser
 */
export function pointDeBoucle(nom, chaque = 500000) {
  if (++compteur % chaque) return;
  const m = mesurer();
  console.log(`[memoire] ${nom} — ${compteur.toLocaleString('fr-FR')} lignes · rss ${Mo(m.rss)} Mo · PIC ${Mo(pic)} Mo`);
}

/** Le plafond que V8 s'est donné : sans lui, un `rss` ne se compare à rien. */
export function plafond() {
  // ⭐ Import dynamique : `node:v8` n'est utile qu'ici, et une seule fois.
  return import('node:v8').then((v8) => {
    const s = v8.getHeapStatistics();
    plafondMo = Mo(s.heap_size_limit);
    console.log(
      `[memoire] plafond du tas V8 : ${Mo(s.heap_size_limit)} Mo`
      + ` · NODE_OPTIONS=${process.env.NODE_OPTIONS || '(non defini)'}`
      + ' — 🔑 si le PIC ci-dessous approche ce plafond, la cible du remede est'
      + ' le tas ; s\'il le depasse largement en rss sans l\'atteindre en tas,'
      + ' la cible est le HORS-TAS (buffers, gzip, fichiers).',
    );
  }).catch(() => {});
}

/** Le pic vu jusqu'ici, en Mo. Réservé aux bancs. */
export function picMo() { return Mo(pic); }

/** Remet la sonde à zéro. Réservé aux bancs. */
export function _reinitialiser() {
  precedent = null; pic = 0; compteur = 0;
  etapes.length = 0; plafondMo = null; chargeMax = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 176 — LE RAPPORT S'ÉCRIT À CHAQUE JALON, PLUS SEULEMENT À LA FIN
// ═══════════════════════════════════════════════════════════════════════════
// 📏 CE QUE LE LOT 175 A RENDU, LU SUR LA PROD LE 21/08 :
//     veveprice · PIC 1 774 Mo · plafond du tas 3 120 Mo · hors-tas 85 Mo
//       avant de lire les sources ......... rss 1587 · tas 1044
//       sources lues ...................... rss 1576 · tas  955
//       prix agrégés (14 008 items) ....... rss 1691 · tas 1485
//       projeterCote (8 840 fiches) ....... rss 1760 · tas 1556
//       LE PRERENDER COMMENCE ICI ......... rss 1774 · tas 1567
//   ⇒ 🔑 **le HORS-TAS est écarté** (85 Mo sur 1 774) : le chantier est celui
//     du TAS, et il est à **50 % de son plafond**.
//   ⛔ MAIS CE N'EST PAS LE PIC DU BUILD : les trois morts sont survenues **en
//     plein prerender**, c'est-à-dire APRÈS ce dernier jalon. On mesurait le
//     point de départ de la course, pas son sommet.
//
// ⇒ Le rapport est réécrit à CHAQUE jalon. Un jalon posé plus tard — après les
//   3 097 pages, dans le dernier plugin (`astro_extremes.mjs`) — s'y ajoute
//   donc tout seul, sans dépendre d'un ordre d'appel.
// ⭐ Sept écritures de quelques centaines d'octets sur un build de 4 minutes :
//   le coût est invisible, et il supprime une classe entière de fautes
//   (« qui appelle `clore()`, et est-il bien le dernier ? »).
function ecrire() {
  try {
    const ou = rapport();
    mkdirSync(dirname(ou), { recursive: true });
    writeFileSync(ou, JSON.stringify({
      picMo: Mo(pic),
      plafondMo,                // rempli par `plafond()` — `null` s'il n'a pas tourné
      lignesLues: compteur,
      // ⏱️ LOT 214 — la charge de la MACHINE pendant le build, pas celle du
      //   conteneur. `coeurs` est ce qui rend `chargeMax` lisible : 3,5 est
      //   catastrophique sur 2 cœurs et confortable sur 8.
      chargeMax,
      coeurs: COEURS,
      etapes,
      ecritLe: new Date().toISOString(),
    }), 'utf8');
    return ou;
  } catch {
    // ⛔ SILENCIEUX, ET C'EST VOULU. Écrit à chaque jalon, un message d'échec
    //    tomberait sept fois et noierait le journal — celui-là même qu'on
    //    essaie de désencombrer. L'absence se lit à l'autre bout :
    //    `/api/sante` rend `memoire: null`, ce qui est une RÉPONSE.
    return null;
  }
}

/**
 * Le dernier jalon connu, et le rapport avec lui.
 *
 * ⛔ N'ÉCHOUE JAMAIS. Un build qui tomberait parce que sa SONDE n'a pas pu
 *    écrire serait le comble : l'instrument casserait ce qu'il observe.
 * ⭐ Le fichier ne porte que des Mo et des noms d'étapes — aucun prix, aucun
 *    chemin, aucun secret. `/api/sante` est publique et le reste.
 * ⚠️ Depuis le lot 176 `jalon()` écrit déjà : `clore()` ne sert plus qu'à
 *    NOMMER la fin du dataset, et à le dire dans le journal.
 */
export function clore(nom = 'fin du dataset') {
  jalon(nom);
  const ou = ecrire();
  console.log(ou
    ? `[memoire] rapport ecrit (${ou}) — lisible par /api/sante`
    : '[memoire] rapport NON ecrit — le journal reste le seul canal');
}
