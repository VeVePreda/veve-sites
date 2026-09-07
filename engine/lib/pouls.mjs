// ⚠️ VeVePreda/veve-sites — engine/lib/pouls.mjs   (FICHIER NEUF — lot J)
// ═══════════════════════════════════════════════════════════════════════════
// LE POULS 24 H — trois chiffres datés et deux tirets, et pas un zéro
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 CE FICHIER N'EXISTE PAS PARCE QUE LA DONNÉE MANQUE — ELLE EST LÀ, ET
// ELLE EST FRAÎCHE. C'EST LE CHEMIN JUSQU'AU SITE QUI MANQUE.
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ J'AI ÉCRIT L'INVERSE CE MATIN, ET C'ÉTAIT FAUX. La première version de ce
// fichier affirmait « aucune source n'existe » ; ma propre mémoire disait le
// contraire, je l'ai vérifiée, et c'est elle qui avait raison. Mesuré le
// 07/09 à 17:39 UTC, par l'API :
//   · release `chain-archive-daily` (dépôt **VeVePreda/scrapeur-veve**, pas
//     jetonveve) : **89 assets**, un `transfers_daily_<AAAA-MM-JJ>.csv.gz` par
//     jour, le dernier (`…2026-09-06`) **mis à jour le 07/09 à 07:22 UTC** —
//     soit J-1, tous les matins ;
//   · `jetonveve/data/burns_daily.csv` (`omi_burned`) et
//     `burns_split_daily.csv` (`omi_volume`) : **quotidiens** eux aussi.
// ⇒ Le « pouls 24 h » n'attend AUCUNE collecte. Ce qui manque tient en une
//   ligne : `warehouse.mjs` ne DÉCLARE pas ces sources, donc le build ne les
//   reçoit pas. C'est le **pont**, et il vit dans ce dépôt-ci.
//
// ⛔ CE QUE LE BUILD A SOUS LA MAIN AUJOURD'HUI NE SUFFIT PAS, EN REVANCHE :
//   le grand livre servi (`SOURCES.ledger`) porte QUATRE colonnes —
//   `veve_uuid, edition, holder, listed` (`IDX_LEDGER`) — **sans aucune date**,
//   et `pulse.csv` est un `_MonthlyPulse`, à la maille MOIS. Compter « les
//   dernières 24 h » avec ce qu'il reçoit est donc impossible, et aucune
//   agrégation ne le rendra possible.
//
// ⚖️ ARBITRAGE PREDA (06/09 puis 07/09) : **l'étape 6 d'abord, le pont
//   ensuite** — « 3 chiffres datés et 2 tirets, tout de suite ». Ce fichier
//   est donc un CONSTAT recopié à la main, en attendant le pont.
// ⭐ Mais il est recopié depuis la source SERVIE, pas depuis l'archive locale :
//   `Archive/` s'arrête au 11/08 (27 jours), la release est à J-1. *Un « ça
//   s'arrête au… » lu en local ne dit rien de la production.*
//
// ⛔⛔ ET C'EST POURQUOI LE CONSTAT EST UN FICHIER, PAS DES LITTÉRAUX DANS UN
//    GABARIT. Un nombre écrit dans du JSX perd sa fenêtre, sa méthode et sa
//    date au premier copier-coller ; six mois plus tard il est encore là, et
//    plus personne ne sait de quoi il est le compte. Ici la donnée voyage avec
//    ses bornes, son horloge et son mode de mesure — et `test:bord` REFUSE un
//    chiffre dont la date manque.
//
// ⏳ IL PÉRIME, ET IL LE DIT. `agePouls()` rend l'âge en jours du constat ;
//    le gabarit l'affiche sous forme de date, et le banc crie au-delà de
//    `PEREMPTION`. ⭐ Un constat figé qui ne vieillit pas visiblement est
//    exactement le « chiffre sans sa date » que ce projet paie depuis huit
//    jours. ⛔ Ne pas relever le seuil quand il rougira : poser le pont.
//
// ⛔ AUCUN MONTANT ICI, ET CE N'EST PAS UNE COÏNCIDENCE. Les cinq cases sont
//    des DÉNOMBREMENTS (transferts, wallets, offres) ou des tirets. La ligne
//    de partage du lot 101 n'est donc pas approchée : rien de ce fichier ne
//    permet de reconstituer le plancher d'une pièce. ⭐ C'est aussi ce qui
//    autorise le pouls à vivre dans le HTML servi, là où la valeur des favoris
//    doit passer par `/api/cote/lot`.

// 🔴🔴🔴 IL EST **IMPORTÉ**, PAS LU SUR LE DISQUE — ET C'EST UNE PANNE SERVIE
// QUI L'A IMPOSÉ, TROUVÉE PAR UN BANC QUI FAIT TOURNER UN VRAI SERVEUR.
// Première version : `readFileSync(join(dirname(fileURLToPath(import.meta.url)),
// '..', 'data', 'pouls24.json'))`. Elle marche au build et en `node` nu. En
// PRODUCTION, ce module est bundlé dans `dist/server/chunks/` : `import.meta.url`
// y désigne le chunk, le chemin devient `dist/server/data/pouls24.json`, et le
// fichier n'existe pas.
// ⭐⭐⭐ LE PLUS CHER N'EST PAS LA PANNE, C'EST SA FORME : le serveur répondait
// **HTTP 200**, puis levait « in the middle of the stream ». La page partait
// TRONQUÉE sous un code de succès — aucun contrôle de statut ne l'aurait vue.
// *Un 200 ne dit pas que la page est entière.*
// ⇒ `import` : le bundler EMBARQUE la donnée, il n'y a plus de chemin à
//   résoudre à l'exécution, et un fichier manquant devient une erreur de BUILD
//   (bruyante, avant tout déploiement) au lieu d'une page coupée en deux.
// ⛔ Ne pas revenir à `readFileSync` « pour pouvoir recharger à chaud » : ce
//    constat ne change qu'au dépôt, et un rechargement à chaud rouvrirait
//    exactement le chemin qui vient de casser.
import CONSTAT from '../data/pouls24.json' with { type: 'json' };

// ⏳ 45 JOURS, ET LE CHIFFRE SE DÉFEND : c'est la durée au-delà de laquelle
// « les dernières 24 h » cesse d'être une expression honnête pour un lecteur,
// même daté. En dessous, la date affichée suffit à dire ce qu'on montre.
export const PEREMPTION = 45;

export function constat() {
  // ⭐ AUCUN ACCÈS DISQUE, AUCUN CACHE À TENIR : la donnée est dans le bundle,
  //   et elle ne change qu'au dépôt.
  return CONSTAT;
}

/** L'âge du constat en jours pleins, à la date passée (ou aujourd'hui). */
export function agePouls(maintenant = new Date()) {
  const c = constat();
  const fin = Date.parse(c.fenetre.finUtc);
  if (!Number.isFinite(fin)) return null;
  return Math.floor((maintenant.getTime() - fin) / 86400000);
}

/**
 * Les cinq cases du pouls, chacune avec son état.
 *
 * ⭐⭐⭐ TROIS ÉTATS, ET ILS NE PARTAGENT AUCUNE SORTIE :
 *   · `{ etat: 'mesure', v: <nombre>, jour }` — on a compté, et on dit quand ;
 *   · `{ etat: 'non-servi', v: null }`       — la donnée existe quelque part,
 *                                             le site ne la reçoit pas ;
 *   · une case ABSENTE de l'objet             — n'existe pas sur ce site.
 * ⛔ `v: 0` n'est produit NULLE PART pour un manque. Un zéro affirme « il ne
 *    s'est rien passé », ce qui est une mesure, et fausse.
 *
 * @param {{offres?: number|null, offresPieces?: number|null, offresLe?: string|null}} marche
 *        Les seuls chiffres que le BUILD sait compter lui-même. `null` ⇒ absent.
 */
export function pouls24(marche = {}) {
  const c = constat();
  const jour = c.fenetre.jourVeve;
  const horloge = c.fenetre.horloge;
  const mesure = (v) => (typeof v === 'number' && Number.isFinite(v)
    ? { etat: 'mesure', v, jour, horloge } : { etat: 'non-servi', v: null });

  return {
    // 🕐🔴 L'ÉTIQUETTE DIT L'HORLOGE, ET C'EST TOUT LE SUJET DE CETTE CASE.
    //   Mesuré le 07/09 : la fenêtre glissante de 24 h sur `ts_utc`
    //   (11/08 06:59:30Z → 12/08 06:59:30Z) et le comptage sur `date_pt =
    //   2026-08-11` rendent le MÊME nombre au transfert près — parce que le
    //   jour de l'entrepôt est un jour PACIFIQUE complet.
    //   ⭐⭐ J'avais écrit « la maquette étiquette 11/08, la fenêtre finit le
    //   12/08, donc l'étiquette est fausse ». C'était MOI qui lisais un jour
    //   PT dans une horloge UTC. *Deux dates justes dans deux horloges ne se
    //   corrigent pas l'une l'autre : elles se nomment.*
    transferts: mesure(c.transferts),
    // 👛 « ACTIF » = a envoyé OU reçu, l'union et jamais la somme.
    wallets: mesure(c.wallets && c.wallets.actifs),
    // 🏷️ LA SEULE CASE QUE LE BUILD COMPTE LUI-MÊME, et elle a donc SA date à
    //   elle — celle du relevé des prix, pas celle des transferts. ⛔ Ne pas
    //   les fondre sous une seule étiquette : trois fraîcheurs mélangées sans
    //   le dire mentent par omission (c'est la faute des DEUX HORLOGES).
    offres: (typeof marche.offres === 'number' && Number.isFinite(marche.offres))
      ? { etat: 'mesure', v: marche.offres, pieces: marche.offresPieces ?? null,
          le: marche.offresLe || null }
      : { etat: 'non-servi', v: null },
    // ⛔⛔ `non-servi` ET PAS `absent` — LE MOT COMPTE, ET LE PREMIER ÉTAIT
    //    FAUX. `burns_daily.csv` (`omi_burned`) et `burns_split_daily.csv`
    //    (`omi_volume`) existent chez jetonveve et sont QUOTIDIENS ; le 02/09
    //    ils portaient 763 078 OMI brûlés et 38 916 978 de volume. Écrire
    //    « n'existe pas » sur cet écran aurait enterré une donnée qui est là —
    //    et c'est ce que j'avais transmis à Preda, qui a tranché dessus.
    //    ⭐ « Pas encore branché » est vrai, et ça se répare ; « n'existe pas »
    //    est faux, et ça se croit.
    revenue: { etat: 'non-servi', v: null },
    omiBrules: { etat: 'non-servi', v: null },
    age: agePouls(),
    perime: (agePouls() ?? 0) > PEREMPTION,
  };
}
