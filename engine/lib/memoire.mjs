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
  console.log(
    `[memoire] ${nom} — rss ${Mo(m.rss)} Mo · tas ${Mo(m.heapUsed)}/${Mo(m.heapTotal)} Mo`
    + ` · hors-tas ${Mo(m.external)} Mo · PIC ${Mo(pic)} Mo${bout}`,
  );
  // ⭐ Le jalon est retenu EN PLUS d'être imprimé. Les deux chemins servent :
  //   le journal quand il arrive, le fichier quand il n'arrive pas.
  etapes.push({ nom, rss: Mo(m.rss), tas: Mo(m.heapUsed), horsTas: Mo(m.external) });
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
  etapes.length = 0; plafondMo = null;
}

/**
 * Écrit le rapport là où une requête pourra le lire. Appelé UNE FOIS, au
 * dernier jalon de `dataset()`.
 *
 * ⛔ N'ÉCHOUE JAMAIS. Un build qui tomberait parce que sa SONDE n'a pas pu
 *    écrire serait le comble : l'instrument casserait ce qu'il observe.
 * ⭐ Le fichier ne porte que des Mo et des noms d'étapes — aucun prix, aucun
 *    chemin, aucun secret. `/api/sante` est publique et le reste.
 */
export function clore(nom = 'fin du dataset') {
  jalon(nom);
  try {
    const ou = rapport();
    mkdirSync(dirname(ou), { recursive: true });
    writeFileSync(ou, JSON.stringify({
      picMo: Mo(pic),
      plafondMo,                // rempli par `plafond()` — `null` s'il n'a pas tourné
      lignesLues: compteur,
      etapes,
      ecritLe: new Date().toISOString(),
    }), 'utf8');
    console.log(`[memoire] rapport ecrit (${ou}) — lisible par /api/sante`);
  } catch (e) {
    console.log(`[memoire] rapport NON ecrit (${e.message}) — le journal reste le seul canal`);
  }
}
