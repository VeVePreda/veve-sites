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

let precedent = null;
let pic = 0;
let compteur = 0;

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
export function _reinitialiser() { precedent = null; pic = 0; compteur = 0; }
