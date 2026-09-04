// ⚠️ DEPOT : VeVePreda/veve-sites  ·  CHEMIN : engine/lib/classeur.mjs  (FICHIER NEUF — lot 224)
// ═══════════════════════════════════════════════════════════════════════════
// LE CLASSEUR DU COLLECTIONNEUR — l'inventaire d'un wallet, et Mint Hunter
// ═══════════════════════════════════════════════════════════════════════════
//
// UNE SEULE LECTURE DU GRAND LIVRE, DEUX SORTIES. `ledger_full.csv.gz`
// (264 Mo, 12 466 996 lignes) est lu EN FLUX au build et découpé en deux
// index, écrits dans `.reserve/classeur/` :
//
//   · `pieces/<uuid>.json`  — « qui détient chaque numéro de CETTE pièce ? »
//                             ⇒ Mint Hunter.
//   · `wallets/<xx>.json`   — « que détient CE portefeuille ? »
//                             ⇒ l'inventaire.
//
// ⛔ NI L'UN NI L'AUTRE N'ENTRE DANS `dist/`. Arbitrage Preda du 04/09 : les
// deux vues sont réservées aux MEMBRES. Le dossier commence par un point et
// vit à la racine du projet — ni `public/`, ni `src/`, que Astro recopie. Même
// dispositif que `reserve.mjs`, `ventes.mjs` et `reserve_analytics.mjs`, et
// pour la raison écrite dans ce dernier : le 03/08, `access.demo: crevette` a
// contourné `franchit()` sur 374 pages et RIEN n'a fuité, parce que la donnée
// n'était nulle part dans `dist/`. C'est l'architecture qui protège.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE QUE CE MODULE PÈSE, ET POURQUOI L'ENCODAGE N'EST PAS UN DÉTAIL
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 04/09 sur le fichier ENTIER, avant d'écrire une ligne de ce
// module — parce que cette sortie part dans l'image Docker, et que le jalon
// précédent avait mesuré le TEMPS (19,6 s) sans mesurer la TAILLE :
//
//   | encodage                        | PIÈCES | WALLETS | dict. |  TOTAL   |
//   |---------------------------------|--------|---------|-------|----------|
//   | adresse et uuid en clair        | 554 Mo |  478 Mo |   —   | 1 032 Mo |
//   | par identifiants + dictionnaires| 155 Mo |  137 Mo | 31 Mo |   323 Mo |
//
// ⇒ **l'encodage naïf coûtait 1 Go d'image**, contre 1,2 Go pour `dist/`
// entier. Ce n'est pas une optimisation prématurée : c'est la différence
// entre un lot livrable et un lot qui double l'image du site.
// ⭐⭐ *Une mesure de débit ne dit rien d'un volume.* Le jalon précédent avait
// mesuré la bonne chose et une seule.
//
// 🔴 UN DICTIONNAIRE EST UN COUPLAGE, ET IL FAUT LE DIRE. `pieces/` ne porte
// que des NUMÉROS de wallet : sans `adresses.json`, ses 155 Mo sont
// illisibles. Les deux fichiers doivent donc être écrits par le MÊME passage,
// et c'est le cas — un seul `ecrire()`, jamais deux chemins.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 POURQUOI DEUX PASSES POUR LES WALLETS, ET UNE SEULE POUR LES PIÈCES
// ═══════════════════════════════════════════════════════════════════════════
// L'entrée est triée par `(veve_uuid, edition)`, mesuré sur 100 % des lignes.
//   · Côté PIÈCES, ce tri EST l'ordre de sortie : une poignée ouverte à la
//     fois, fermée au changement d'uuid, mémoire O(1). Rien à faire de plus.
//   · Côté WALLETS, il ne sert à RIEN : les lignes d'un même portefeuille sont
//     dispersées sur les 12,5 M. Grouper par adresse en mémoire coûterait
//     ~1 Go de tas (10,6 M lignes × ~100 o), sur un build qui culmine déjà à
//     1 984 Mo pour un plafond de 3 120.
// ⇒ passe 1 : on APPEND dans 256 fragments, par identifiants (22 o/ligne) ;
//    passe 2 : on relit UN fragment à la fois (130 591 lignes au pire), on
//    groupe par adresse, on réécrit, on jette le brouillon.
// Le pic mémoire est celui d'UN fragment, pas des 256.
//
// ⛔ NE PAS « SIMPLIFIER » EN GROUPANT DIRECTEMENT EN MÉMOIRE. C'est la panne
// du lot 166 en plus gros : agréger la table complète côté site coûtait déjà
// 480 Mo de RSS, et c'est précisément ce qui avait fait remonter les agrégats
// en amont. Ici la table est vingt fois plus grande.
//
// ⛔ NE PAS NON PLUS APPENDRE LIGNE À LIGNE SANS TAMPON : 10,6 M d'appels
// `appendFileSync` sont 10,6 M d'allers-retours noyau. Les tampons se vident
// à `SEUIL_TAMPON`, ce qui borne la mémoire à 256 × ce seuil.

import { mkdirSync, existsSync, writeFileSync, appendFileSync, readFileSync,
         rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { streamLedger } from '../data/warehouse.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
export const CLASSEUR_DIR = process.env.CLASSEUR_DIR || join(ROOT, '.reserve', 'classeur');

// 🔴🔴 LA SEULE DÉFINITION DU « VIDE » DE CE FICHIER, ET ELLE N'EST PAS CELLE
// QU'ON CROIT. Le champ `holder` d'une pièce que personne ne détient vaut
// littéralement DEUX GUILLEMETS — la chaîne `""`, longueur 2 — parce que
// `split(',')` ne dé-quote pas. Mesuré le 04/09 sur 12 466 996 lignes : le
// champ ne prend QUE deux longueurs, 42 (une adresse) et 2 (ceci), cette
// dernière 1 825 547 fois, soit 14,64 %.
//   ⛔ `!holder`         → FAUX, sur les 1,8 million.
//   ⛔ `holder === ''`   → FAUX, sur les 1,8 million.
// Ces deux tests ont été écrits et ont chacun rendu **0**, à deux tours
// d'intervalle. ⭐⭐ *Un champ « vide » se mesure par la DISTRIBUTION de ses
// valeurs, jamais par le test qu'on croit juste* — même famille que
// `Number('') === 0`, qui avait donné 2 208 fiches à « 0 gems ».
// ⛔ NE PAS ÉLARGIR CE TEST « pour être robuste ». Une liste blanche stricte
// fait CRIER une source qui changerait de forme (`compteurs.horsForme`) ; un
// test permissif l'avalerait et rendrait des inventaires troués en restant
// vert.
export const NON_DETENUE = '""';

// ⚠️ `-1` ET PAS `null`. Le tableau est POSITIONNEL (voir `ORDRE_PIECE`) : un
// `null` pèse quatre octets de plus par ligne sur 12,5 M de lignes, pour dire
// la même chose. `-1` ne peut être confondu avec aucun identifiant réel, qui
// sont des entiers à partir de 0, et se compare sans piège en JS — là où
// `null < 1` vaut vrai.
export const SANS_DETENTEUR = -1;

// ⚠️ Une adresse EVM : `0x` + 40 hexadécimaux. Liste BLANCHE de forme, comme
// `uuidValide()` de `reserve.mjs` et `RE_QUI` de `ventes.mjs` — ce qui entre
// ici devient une CLÉ DE FICHIER et un contenu servi à un membre. Une liste
// noire se contourne, une liste blanche non.
const RE_ADRESSE = /^0x[0-9a-fA-F]{40}$/;
const RE_UUID = /^[0-9a-f-]{8,64}$/i;

// ⭐ 256 FRAGMENTS, ET LE DÉCOUPAGE EST `h[2:4]` — PAS `h[0:2]`.
// ⛔⛔ LE PIÈGE EST ÉCRIT ICI PARCE QU'IL A ÉTÉ COMMIS. **Toutes** les adresses
// commencent par `0x` : découper sur les deux PREMIERS caractères produit UN
// fragment de 10,6 M de lignes — exactement ce que le découpage existe pour
// éviter. Le design du 04/09 le disait, et il a fallu le mesurer pour le voir.
// ⭐⭐ Et cette erreur en cachait une seconde : `h.slice(0,2)` ne rendait que
// deux valeurs (`0x` et le vide), et *un compteur à deux entrées ressemble
// assez à un découpage pour ne pas se faire regarder*.
//
// Sur `h[2:4]`, mesuré sur le fichier entier, APRÈS exclusion des non détenues
// (qui n'ont pas de portefeuille, donc ne sont dans l'inventaire de personne) :
//     256 fragments · min 27 191 lignes · médiane 39 077 · max 130 591
//     ratio max/médiane = 3,3 en octets
// ⛔ PAS TROIS CARACTÈRES : 4 096 fragments, donc 4 096 poignées, au-dessus du
// `ulimit -n` de 1 024.
const CLE = (adresse) => adresse.slice(2, 4);

// ⚠️ 256 Ko × 256 fragments = 64 Mo de pic, et c'est le seul poste de mémoire
// que ce module ne borne pas par construction. Le baisser ralentit (plus
// d'écritures), le monter rapproche du plafond du VPS. ⛔ Ne pas le passer en
// variable d'environnement : un réglage qu'on peut tordre sans le mesurer est
// un réglage qui sera tordu.
const SEUIL_TAMPON = 256 * 1024;

// 🔑 L'ORDRE DES CHAMPS SERVIS — LE CONTRAT AVEC LE CLIENT, des deux côtés.
// ⛔ Ne JAMAIS insérer au milieu : un champ ajouté en 2ᵉ position décalerait
// tout, et le client afficherait un numéro d'édition à la place d'un
// identifiant de wallet SANS qu'aucune erreur ne se produise — les deux sont
// des entiers. C'est mot pour mot l'avertissement de `ventes.mjs`, et il a été
// écrit là-bas parce que le risque est réel. ⇒ toute évolution s'ajoute À LA
// FIN, et `test:classeur` compare ces listes à ce que les gabarits lisent.
export const ORDRE_PIECE = ['edition', 'wallet', 'listed'];
export const ORDRE_WALLET = ['piece', 'edition', 'listed'];

/**
 * Écrit les deux index du classeur, à partir d'UNE lecture du grand livre.
 *
 * @param {Set<string>|string[]} publies  uuid ayant réellement une page
 * @returns {Promise<Object>} les compteurs, et `off` si rien n'a été écrit
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 UNE FOIS PAR PROCESSUS, ET LA PORTÉE MODULE N'Y SUFFIT PAS
// ═══════════════════════════════════════════════════════════════════════════
// MESURÉ AU PREMIER BUILD RÉEL DE CE LOT : `[classeur]` s'est écrit DEUX FOIS,
// à 70 s d'intervalle, dans le même build. `dataset()` est pourtant mémoïsé
// (`_promesse`, portée module) — mais Astro bâtit en DEUX PASSES et Vite
// recharge le graphe de modules à chacune : la portée module n'est PAS la
// portée processus. Le même journal le disait déjà pour `astro:route:setup`,
// « appelé une fois par route ET PAR PASSE », et je ne l'avais pas relié.
//
// ⇒ le coût réel était **le double du coût mesuré** : ~92 s au lieu de ~46 sur
// un déploiement de 9 min 16. ⭐⭐ *Un chiffre mesuré sur une passe ne dit rien
// d'un build qui en fait deux* — et rien dans le résultat ne l'aurait montré :
// la seconde passe réécrit exactement les mêmes fichiers.
//
// ⛔ NE PAS mémoïser dans une variable de module « comme `dataset()` » : c'est
// précisément ce qui ne marche pas ici. `globalThis` survit aux deux passes
// parce qu'il est porté par le processus, pas par le graphe.
// ⚠️ ET ÇA SUPPOSE UN SEUL JEU D'`publies` PAR PROCESSUS. C'est vrai : le seul
// appelant est `dataset.mjs`, avec le Set des uuid publiés. Un second appel
// avec un AUTRE périmètre serait servi par le premier — donc si ce module
// gagne un jour un deuxième appelant, cette clé doit porter le périmètre.
const MEMO = Symbol.for('veve.classeur.ecrit');

export async function ecrire(publies) {
  if (globalThis[MEMO]) {
    console.log('[classeur] deja ecrit dans ce processus (2e passe de build) — on ne refait pas.');
    return globalThis[MEMO];
  }
  if (process.env.CLASSEUR_OFF === '1') {
    console.log('[classeur] DESACTIVE par CLASSEUR_OFF=1 — aucune vue ne sera servie.');
    return (globalThis[MEMO] = { off: true, motif: 'eteint', pieces: 0, fragments: 0 });
  }

  // ⛔ ON REPART D'UN DOSSIER VIDE — même raison qu'à `ventes.ecrire()` : un
  // reste de build précédent servirait l'inventaire d'hier à un membre, sans
  // qu'aucune erreur ne le dise, et survivrait à un rollback.
  if (existsSync(CLASSEUR_DIR)) rmSync(CLASSEUR_DIR, { recursive: true, force: true });
  mkdirSync(join(CLASSEUR_DIR, 'pieces'), { recursive: true });
  mkdirSync(join(CLASSEUR_DIR, 'wallets'), { recursive: true });

  const garder = publies instanceof Set ? publies : new Set(publies || []);

  // Les deux dictionnaires. ⚠️ `Map` et pas objet : 709 450 clés hexadécimales
  // dans un objet forcent V8 en mode dictionnaire de toute façon, et `Map`
  // garde l'ordre d'insertion — c'est lui qui définit les identifiants.
  const idWallet = new Map();
  const idUuid = new Map();
  const adresses = [];
  const uuids = [];

  // Les tampons des 256 fragments de la passe 1.
  const tampons = new Map();
  let octetsTampons = 0;

  // La poignée séquentielle du découpage PIÈCES.
  let uuidCourant = null;
  let gardeCourant = false;
  let lignesPiece = [];

  const c = {
    lues: 0, nonDetenues: 0, listed: 0,
    piecesEcrites: 0, lignesPieces: 0, sansPage: 0,
    lignesWallets: 0, horsForme: 0,
  };

  const viderTampon = (cle) => {
    const t = tampons.get(cle);
    if (!t || !t.length) return;
    appendFileSync(join(CLASSEUR_DIR, 'wallets', `${cle}.ndjson`), t.join('\n') + '\n');
    octetsTampons -= t.octets || 0;
    tampons.set(cle, Object.assign([], { octets: 0 }));
  };

  const fermerPiece = () => {
    if (!gardeCourant || !lignesPiece.length) { lignesPiece = []; return; }
    // ⭐ AUCUN TRI ICI, ET C'EST DÉLIBÉRÉ — contrairement à `ventes.mjs`, qui
    // retrie ses dix lignes « parce que se fier à l'ordre d'un fichier qu'on
    // ne bâtit pas fait dépendre l'affichage d'une promesse non tenue par un
    // banc ». La différence est l'ÉCHELLE : ici la promesse EST tenue par un
    // banc (`test:classeur` §1 compte les ruptures de tri à chaque build), et
    // retrier 640 numéros × 9 354 pièces coûterait un temps réel pour refaire
    // ce qui vient d'être vérifié. ⚠️ Retirer ce banc rend ce commentaire faux.
    writeFileSync(join(CLASSEUR_DIR, 'pieces', `${uuidCourant}.json`),
                  JSON.stringify(lignesPiece));
    c.piecesEcrites++;
    c.lignesPieces += lignesPiece.length;
    lignesPiece = [];
  };

  // ── PASSE 1 — UNE SEULE LECTURE, DEUX SORTIES ────────────────────────────
  const lues = await streamLedger((cols, idx) => {
    const u = cols[idx.uuid];
    const ed = cols[idx.edition];
    const h = cols[idx.holder];
    const li = cols[idx.listed] === '1' ? 1 : 0;
    c.lues++;
    if (li) c.listed++;

    if (u !== uuidCourant) {
      fermerPiece();
      uuidCourant = u;
      // ⚠️ LA FORME DE L'UUID SE CONTRÔLE ICI, UNE FOIS PAR PIÈCE, PAS PAR
      // LIGNE. C'est 19 485 tests au lieu de 12,5 millions, et le résultat est
      // le même : l'uuid ne change qu'ici.
      gardeCourant = RE_UUID.test(u) && garder.has(u);
      if (!gardeCourant && !garder.has(u)) c.sansPage++;
    }

    if (h === NON_DETENUE) {
      // ⚖️ ARBITRAGE PREDA DU 04/09 : les non détenues sont AFFICHÉES, et
      // INDISTINCTES. Ni omises — ce qui trouerait la séquence et démentirait
      // la promesse « tous les numéros » —, ni étiquetées brûlée/stock, qui
      // n'est PAS reconstituable depuis ce fichier (le bit y est, la
      // distinction non : `ledger_statuts.csv` n'a que des totaux).
      // ⛔ Ne pas rouvrir sans un SECOND fichier en amont.
      c.nonDetenues++;
      if (gardeCourant) lignesPiece.push([Number(ed) || 0, SANS_DETENTEUR, li]);
      // ⭐ ET ELLES N'ENTRENT PAS DANS LE DÉCOUPAGE WALLETS. Ce n'est pas un
      // raccourci : une pièce que personne ne détient n'est dans l'inventaire
      // de personne. C'est aussi ce qui ramène le découpage à 256 fragments
      // exactement — sans cette sortie, elles formaient un 257ᵉ fragment de
      // 1,8 M de lignes, 46 fois la médiane, et faisaient mentir le « ratio
      // 4,8 » sur lequel le choix de `h[2:4]` avait été justifié.
      return;
    }

    if (!RE_ADRESSE.test(h)) {
      // ⚠️ NI `sansPage` NI UN REFUS DE DONNÉE : c'est la SOURCE qui a changé
      // de forme. Compteur séparé, comme les trois de `ventes.mjs` — les
      // fondre rendrait indiscernables un état normal et une panne.
      c.horsForme++;
      return;
    }

    let iw = idWallet.get(h);
    if (iw === undefined) { iw = adresses.length; idWallet.set(h, iw); adresses.push(h); }
    let iu = idUuid.get(u);
    if (iu === undefined) { iu = uuids.length; idUuid.set(u, iu); uuids.push(u); }

    if (gardeCourant) lignesPiece.push([Number(ed) || 0, iw, li]);

    const cle = CLE(h);
    let t = tampons.get(cle);
    if (!t) { t = Object.assign([], { octets: 0 }); tampons.set(cle, t); }
    const ligne = `${iw},${iu},${ed},${li}`;
    t.push(ligne);
    t.octets += ligne.length + 1;
    octetsTampons += ligne.length + 1;
    c.lignesWallets++;
    if (t.octets >= SEUIL_TAMPON) viderTampon(cle);
  });

  fermerPiece();
  for (const cle of [...tampons.keys()]) viderTampon(cle);

  // 🔴 ZÉRO LIGNE N'EST PAS UNE PANNE ICI — c'est l'état HORS LIGNE, et
  // `streamLedger` l'a déjà dit à voix haute avec le bon niveau d'alarme.
  // ⛔ Ne pas laisser un dossier À MOITIÉ écrit : le Dockerfile compte les
  // fichiers, et un dossier vide doit se lire comme vide, pas comme cassé.
  if (!lues) {
    rmSync(CLASSEUR_DIR, { recursive: true, force: true });
    mkdirSync(CLASSEUR_DIR, { recursive: true });
    console.log('[classeur] 0 ligne au grand livre — aucun index ecrit (etat HORS LIGNE attendu).');
    return (globalThis[MEMO] = { off: true, motif: 'vide', pieces: 0, fragments: 0, ...c });
  }

  // ── PASSE 2 — LA COMPACTION, UN FRAGMENT À LA FOIS ───────────────────────
  // ⭐ LE PIC MÉMOIRE EST CELUI D'UN SEUL FRAGMENT (130 591 lignes au pire),
  // parce qu'on relit, groupe, réécrit et JETTE avant de passer au suivant.
  // ⛔ Ne pas paralléliser : les 256 en vol, ce sont les ~1 Go que cette
  // architecture existe pour éviter.
  let fragments = 0, octetsWallets = 0, walletsIndexes = 0;
  for (const cle of [...tampons.keys()].sort()) {
    const brouillon = join(CLASSEUR_DIR, 'wallets', `${cle}.ndjson`);
    if (!existsSync(brouillon)) continue;
    const par = new Map();
    for (const l of readFileSync(brouillon, 'utf8').split('\n')) {
      if (!l) continue;
      const [iw, iu, ed, li] = l.split(',');
      const a = adresses[Number(iw)];
      let b = par.get(a);
      if (!b) { b = []; par.set(a, b); }
      b.push([Number(iu), Number(ed) || 0, Number(li) || 0]);
    }
    const json = JSON.stringify(Object.fromEntries(par));
    writeFileSync(join(CLASSEUR_DIR, 'wallets', `${cle}.json`), json);
    rmSync(brouillon, { force: true });
    fragments++; octetsWallets += json.length; walletsIndexes += par.size;
  }

  // ── LES DEUX DICTIONNAIRES ET LE MÉTA ────────────────────────────────────
  // ⚠️ `adresses.json` PÈSE ~30 Mo, et il est INDISPENSABLE : sans lui les
  // 155 Mo de `pieces/` ne sont que des entiers. Il est lu UNE fois par le
  // processus qui sert, et gardé — voir le commentaire de la route.
  writeFileSync(join(CLASSEUR_DIR, 'adresses.json'), JSON.stringify(adresses));
  writeFileSync(join(CLASSEUR_DIR, 'uuids.json'), JSON.stringify(uuids));

  const meta = {
    // ⏰ LA FRAÎCHEUR SE SERT, ELLE NE SE DEVINE PAS. `ledger_full.csv.gz` est
    // écrit par `analytics.yml`, qui court après `ledger-writer.yml` (cron
    // hebdomadaire, jeudi 22 h UTC) : la donnée servie a entre **1 et 8
    // jours**. ⛔ Ne pas l'arrondir à « hier ». *Une fraîcheur qu'on n'affiche
    // pas devient un reproche* — et ici elle peut atteindre huit jours, ce
    // qu'un membre ne devinera jamais seul.
    // ⚠️ C'est la date du BUILD, pas celle du fichier : la release ne porte
    // pas sa date dans son contenu, et le `Last-Modified` de la réponse HTTP
    // n'a pas survécu au flux. ⇒ le gabarit dit « au plus tard le … », jamais
    // « le … ». Un « à peu près » annoncé vaut mieux qu'un exact inventé.
    construitLe: new Date().toISOString(),
    fenetreFraicheurJours: [1, 8],
    lignes: c.lues,
    pieces: c.piecesEcrites,
    piecesAuLivre: uuids.length,
    wallets: adresses.length,
    walletsIndexes,
    nonDetenues: c.nonDetenues,
    listed: c.listed,
    fragments,
    ordrePiece: ORDRE_PIECE,
    ordreWallet: ORDRE_WALLET,
  };
  writeFileSync(join(CLASSEUR_DIR, 'meta.json'), JSON.stringify(meta));

  const mo = (o) => Math.round(o / 1048576);
  const octetsAdresses = statSync(join(CLASSEUR_DIR, 'adresses.json')).size;
  console.log(`[classeur] ${c.piecesEcrites} piece(s) sur ${uuids.length} au livre`
    + ` (${c.lignesPieces} numeros), ${fragments} fragment(s) wallet`
    + ` (${walletsIndexes} portefeuilles, ${c.lignesWallets} lignes),`
    + ` ${c.nonDetenues} non detenue(s), ${c.horsForme} hors forme`
    + ` — ~${mo(octetsWallets + octetsAdresses)} Mo, HORS de dist/`);

  // 🩺 UN REFUS MASSIF EST UNE PANNE DE SOURCE, PAS UN CAS LIMITE — même règle
  // et même seuil que `ventes.mjs`. ⛔ On n'interrompt pas le build : le
  // classeur est un ajout, pas le socle. Mais il doit CRIER, sinon les deux
  // pages se vident en restant vertes.
  if (c.lues > 0 && c.horsForme > c.lues / 10) {
    console.warn(`[classeur] ${c.horsForme}/${c.lues} lignes HORS FORME — le grand livre a probablement change de forme.`);
    console.warn('::warning title=Grand livre hors forme::Verifier les colonnes de ledger_full.csv.gz');
  }
  // ⚠️ ET UN SECOND CRI, QUI N'EST PAS LE MÊME. Zéro pièce écrite alors que le
  // livre en porte des milliers, ce n'est pas une source cassée : c'est la
  // liste `publies` qui n'est pas arrivée. Le symptôme serait « Mint Hunter
  // est vide sur toutes les fiches » avec un build parfaitement vert.
  if (uuids.length > 0 && c.piecesEcrites === 0) {
    console.warn('[classeur] 0 piece ecrite alors que le livre en porte '
      + `${uuids.length} — la liste des uuid PUBLIES est-elle bien passee ?`);
    console.warn('::warning title=Classeur sans piece::Mint Hunter serait vide sur toutes les fiches.');
  }

  return (globalThis[MEMO] = { off: false, ...c, fragments, wallets: adresses.length, meta });
}
