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
// ══════════════════════════════════════════════════════════════════════════
// 🫀 LE PONT — lot L, 08/09/2026
// ══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CE QUI MANQUAIT N'ÉTAIT PAS UNE COLLECTE. J'ai écrit quatre fois que
// « le pouls 24 h demande de collecter des données ». La donnée était publiée,
// quotidienne, à J-1, depuis toujours. Il manquait CETTE FONCTION : quinze
// lignes qui comptent. ⛔ Une note qui nomme une solution fait sauter la
// question du besoin — et se transmet ensuite comme une loi.
//
// ⛔ CE QUE CE CALCUL N'EST PAS : une mesure de l'activité VeVe complète. Il
// lit la CHAÎNE (IMX/CollectChain). Ce qui ne s'y écrit pas n'y est pas.
//
/** Compte le pouls d'une journée à partir des lignes `transfers_daily_<J>`.
 *  @param {Array<object>} lignes  le CSV du jour, tel quel
 *  @param {Map<string,number>} prixParUuid  `store_price` par `veve_uuid`
 *  @returns {{jour, transferts, wallets, mints, revenue, mintsChiffres}|null} */
export function compterPouls(lignes, prixParUuid = new Map()) {
  if (!Array.isArray(lignes) || lignes.length === 0) return null;
  // ⚠️ LES COLONNES S'APPELLENT `from` ET `to`, pas `from_address`. Lues sous
  // un nom absent, elles rendent `undefined` PARTOUT — et un compte écrit
  // dessus sort un nombre parfaitement plausible. C'est arrivé le 08/09.
  if (!('from' in lignes[0]) || !('to' in lignes[0]) || !('kind' in lignes[0])) return null;
  const wallets = new Set();
  let mints = 0; let revenue = 0; let mintsChiffres = 0;
  for (const l of lignes) {
    wallets.add(l.from); wallets.add(l.to);
    if (l.kind !== 'mint') continue;
    mints += 1;
    const p = prixParUuid.get(l.veve_uuid);
    // ⛔ Une pièce trop neuve pour le catalogue publié n'a PAS de prix : on ne
    //    la compte pas, et on dit combien de mints sont chiffrés. Mesuré le
    //    06/09 : 540 mints sur 1 922 hors catalogue — un total muet aurait
    //    laissé croire à une somme complète.
    if (typeof p === 'number' && Number.isFinite(p)) { revenue += p; mintsChiffres += 1; }
  }
  return {
    jour: lignes[0].date_pt || null,
    transferts: lignes.length,
    // 🔬 L'ADRESSE NULLE N'EST PAS UN PORTEFEUILLE ACTIF, c'est le contrat qui
    //    frappe. Le constat du 07/09 la comptait : il disait 943 wallets pour
    //    le 06/09, on en compte 942. ⚠️ L'écart d'UN est donc voulu, et c'est
    //    la seule différence entre ce calcul et le constat qu'il remplace.
    wallets: [...wallets].filter((w) => w && !/^0x0{40}$/i.test(w)).length,
    mints, revenue: mintsChiffres ? revenue : null, mintsChiffres,
  };
}

export function pouls24(marche = {}) {
  // ⭐⭐ LE CONSTAT N'EST PLUS ÉCRIT À LA MAIN — `engine/tools/preparer_pouls.mjs`
  //   le REGÉNÈRE depuis la chaîne. La page, elle, ne change pas d'un octet :
  //   elle lit toujours un JSON embarqué dans le bundle. ⛔ On ne met PAS un
  //   `fetch` dans le rendu d'une page pour « avoir du frais » : le lot J a
  //   déjà payé la page tronquée sous HTTP 200.
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
    // 💰 « REVENUE 24 H = LE SUPPLY AU DROP VENDUE » — Preda, 08/09. Ce n'est
    //    donc ni le volume échangé ni les achats de gems : c'est la somme des
    //    `store_price` des pièces FRAPPÉES dans la journée. `kind === 'mint'`
    //    la donne exactement, et le catalogue porte le prix.
    //    ⚠️ `pieces` dit sur combien de mints la somme porte : une somme sans
    //    son assiette se lit comme un total, et 28 % des mints du 06/09
    //    n'étaient pas encore au catalogue.
    revenue: (c.revenue && typeof c.revenue.usd === 'number')
      ? { etat: 'mesure', v: c.revenue.usd, jour, horloge,
          pieces: c.revenue.mintsChiffres, mints: c.revenue.mints }
      : { etat: 'non-servi', v: null },
    // 🔥 EN OMI, ⛔ JAMAIS CONVERTI. Le rapport OMI/USD n'est pas constant.
    omiBrules: (c.omiBrules && typeof c.omiBrules.v === 'number')
      ? { etat: 'mesure', v: c.omiBrules.v, jour: c.omiBrules.jour || jour, horloge }
      : { etat: 'non-servi', v: null },
    // ⏳ L'ÂGE EST CELUI DE CE QU'ON SERT. Branché sur la chaîne, le pouls a
    //    un jour ; c'est le constat figé, lui, qui périmait à 45 jours.
    age: agePouls(),
    perime: (agePouls() ?? 0) > PEREMPTION,
  };
}
