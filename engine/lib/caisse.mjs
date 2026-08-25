// ⚠️ VeVePreda/veve-sites — engine/lib/caisse.mjs   (FICHIER NEUF — lot 200)
// ═══════════════════════════════════════════════════════════════════════════
//  LA CAISSE — encaisser de l'USDC/USDT sur Base, et ouvrir le palier
// ═══════════════════════════════════════════════════════════════════════════
//
// 💳 LE BESOIN, DIT PAR PREDA LE 25/08/2026, MOT POUR MOT : « recevoir des
// usdc/usdt sur le reseau base et que ça donne automatiquement le role qu'ils
// sont acheter pour la durée. »
//
// 🟢 CE QUI REND CE FICHIER POSSIBLE, ET QUI A ÉTÉ MESURÉ AVANT DE L'ÉCRIRE :
//   · le conteneur joint `mainnet.base.org` en 127 ms (lot 199, en production) ;
//   · `/data` est un volume MONTÉ (`/api/sante` → `favoris.montee: true`) ;
//   · `node:sqlite` est intégré à Node 22 ⇒ **`package.json` NE BOUGE PAS** ;
//   · `POST /api/abonner` existe déjà chez veveid, avec son anti-rejeu.
// ⇒ Il ne restait qu'à relier les quatre.
//
// ⛔ CE FICHIER NE DÉTIENT AUCUNE CLÉ PRIVÉE ET NE PEUT DÉPENSER RIEN. Il LIT
// une chaîne publique et POSTE un message à veveid. Le pire qu'un défaut ici
// puisse faire est de ne pas ouvrir un palier — jamais de perdre de l'argent.
// C'est la raison pour laquelle on encaisse « nous-mêmes » sans prestataire :
// il n'y a rien à garder.

import { DatabaseSync } from 'node:sqlite';
import { manifest } from './manifest.mjs';

// ═══════════════════════════════════════════════════════════════════════════
// ⑴ LES CONSTANTES DE LA CHAÎNE — publiques, vérifiables par quiconque
// ═══════════════════════════════════════════════════════════════════════════
// 🔑 Mesurés le 25/08 sur des transferts réels : `topics[1]` = l'expéditeur,
//   `topics[2]` = le destinataire (32 octets, adresse cadrée à droite),
//   `data` = le montant, **6 décimales** pour les deux jetons.
export const JETONS = {
  usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  usdt: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2',
};
const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// 🔴🔴 PLAFOND MESURÉ, PAS SUPPOSÉ : `mainnet.base.org` refuse au-delà de
//   10 000 blocs — `{"code":-32614,"message":"eth_getLogs is limited to a
//   10,000 range"}`. Un scan qui ignorerait ce plafond ne rendrait pas moins
//   de résultats : il rendrait une ERREUR, donc ZÉRO paiement vu, sur une
//   caisse qui a pourtant reçu l'argent. On scanne donc par tranches.
const TRANCHE_MAX = 9000;

// ⚠️ Base produit ~1 bloc toutes les 2 s (mesuré : 280 blocs en 9 min 20).
//   24 h ≈ 43 200 blocs. On ne remonte JAMAIS plus loin que ça : au-delà,
//   aucune commande n'est plus reconnaissable de toute façon.
const BLOCS_MAX_RETARD = 45000;

const RPC = () => process.env.CAISSE_RPC || 'https://mainnet.base.org';
const ADRESSE = () => String(process.env.CAISSE_ADRESSE || '').trim().toLowerCase();
const CHEMIN = () => process.env.CAISSE_DB || '/data/veve-caisse.db';

// ⭐ LES DEUX DURÉES DE PREDA, ET ELLES SONT DIFFÉRENTES EXPRÈS (25/08).
// Il a choisi « 15 minutes ». Mais un retrait d'exchange met couramment plus
// que ça : à une seule durée, un paiement RÉEL arriverait après la fermeture
// et serait perdu. On sépare donc ce que voit l'acheteur de ce que reconnaît
// la caisse — l'écran expire à 15 min, le montant reste reconnu 24 h et ouvre
// le palier a posteriori. ⚠️ Conséquence assumée : un montant ne se recycle
// pas avant 24 h, pas avant 15 min.
export const ECRAN_MS = Number(process.env.CAISSE_ECRAN_MS) || 15 * 60 * 1000;
export const LIMITE_MS = Number(process.env.CAISSE_LIMITE_MS) || 24 * 60 * 60 * 1000;

// ⚠️ « Trop ⇒ on ouvre quand même » (Preda, 25/08). Mais PAS n'importe quel
//   « trop » : sans borne, un versement de 36 $ (whale) ouvrirait une commande
//   crevette de 6 $ restée en attente, et l'acheteur perdrait 30 $. La
//   tolérance est donc étroite, et elle ne s'applique qu'à la commande
//   immédiatement en dessous du montant reçu.
const TOLERANCE_CENTS = 50;

// ═══════════════════════════════════════════════════════════════════════════
// ⑵ LE MAGASIN — même recette que les favoris, mêmes pièges évités
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ OUVERTURE PARESSEUSE, ET CE MODULE NE CRÉE AUCUN DOSSIER. La première
// version des favoris faisait `mkdirSync('/data')` : le build, qui tourne en
// root dans le Dockerfile, aurait créé une base vide DANS L'IMAGE — et le bac
// à sable ne l'avait pas vu, parce qu'il ne tourne pas en root et que le
// `mkdir` y échouait. Un contrôle vert pour la mauvaise raison.
let base = null;
let panne = null;

function ouvrir() {
  if (base) return base;
  if (panne) throw panne;
  try {
    const d = new DatabaseSync(CHEMIN());
    d.exec('PRAGMA journal_mode = WAL');
    d.exec(`CREATE TABLE IF NOT EXISTS commandes (
      reference TEXT    PRIMARY KEY,
      compte    TEXT    NOT NULL,
      palier    TEXT    NOT NULL,
      mois      INTEGER NOT NULL,
      cents     INTEGER NOT NULL,
      cree_a    INTEGER NOT NULL,
      ecran_a   INTEGER NOT NULL,
      limite_a  INTEGER NOT NULL,
      etat      TEXT    NOT NULL,
      tx        TEXT,
      bloc      INTEGER,
      paye_a    INTEGER
    )`);
    // ⭐⭐ L'ANTI-REJEU EST UNE CONTRAINTE DE BASE, PAS UN `if`. Le scan peut
    //   repasser sur les mêmes blocs (redémarrage, tranche rejouée, horloge).
    //   Un `if (dejaVu)` en JavaScript se contourne par une course entre deux
    //   passes ; un index UNIQUE, non. ⛔ Et il est PARTIEL : les commandes non
    //   payées ont toutes `tx = NULL`, et SQLite considère chaque NULL comme
    //   distinct — sans le `WHERE`, l'index serait inutile mais surtout
    //   trompeur.
    d.exec('CREATE UNIQUE INDEX IF NOT EXISTS commandes_tx ON commandes(tx) WHERE tx IS NOT NULL');
    d.exec('CREATE INDEX IF NOT EXISTS commandes_etat ON commandes(etat, cents)');
    // 🔴 LES VERSEMENTS QUE PERSONNE NE RÉCLAME. Preda a tranché : « trop peu
    //   ⇒ rien ne s'ouvre, tu es prévenu ». Sans cette table, « prévenu »
    //   n'existe pas : l'argent arrive, aucun palier ne s'ouvre, et RIEN
    //   nulle part n'en garde la trace. Le silence parfait.
    d.exec(`CREATE TABLE IF NOT EXISTS orphelins (
      tx     TEXT    PRIMARY KEY,
      bloc   INTEGER NOT NULL,
      cents  INTEGER NOT NULL,
      jeton  TEXT    NOT NULL,
      vu_a   INTEGER NOT NULL
    )`);
    d.exec('CREATE TABLE IF NOT EXISTS caisse_suivi (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL)');
    base = d;
    return base;
  } catch (e) {
    panne = e;
    throw e;
  }
}

const lireSuivi = (cle) => {
  const l = ouvrir().prepare('SELECT valeur FROM caisse_suivi WHERE cle = ?').get(String(cle));
  return l ? l.valeur : null;
};
const poserSuivi = (cle, valeur) => {
  ouvrir().prepare(`INSERT INTO caisse_suivi (cle, valeur) VALUES (?, ?)
    ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur`).run(String(cle), String(valeur));
};

// ═══════════════════════════════════════════════════════════════════════════
// ⑶ LES PRIX — ils viennent du manifeste, JAMAIS d'ici
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ UN TARIF ÉCRIT EN DUR DANS DEUX FICHIERS N'EST PAS UNE DUPLICATION, C'EST
// UN LITIGE. `/offre/` affiche un prix, la caisse en réclamerait un autre, et
// aucun banc ne pourrait dire lequel est le bon. La formule ci-dessous est
// donc EXACTEMENT celle d'`Offre.astro` l. 123 — `test:caisse` compare les
// deux et rougit si elles divergent d'un centime.
// ⭐ `plans.prix` est l'ANNUEL MENSUALISÉ (arbitrage Preda du 10/08) : le
//   mensuel s'en déduit vers le HAUT, c'est l'engagement qui fait la remise.
export function grille() {
  const m = manifest();
  const remise = m.offer?.annual_discount ?? 0.20;
  const plans = Array.isArray(m.offer?.plans) ? m.offer.plans : [];
  const o = {};
  for (const p of plans) {
    const prix = Number(p?.prix);
    if (!Number.isFinite(prix) || prix <= 0) continue; // ⛔ `member` est gratuit : il ne se vend pas.
    o[String(p.cle)] = {
      1: Math.round(prix / (1 - remise)) * 100,
      12: prix * 12 * 100,
    };
  }
  return o;
}

export const JOURS = { 1: 30, 12: 365 };

// ═══════════════════════════════════════════════════════════════════════════
// ⑷ LE MONTANT UNIQUE — l'étiquette du paiement, et le seul verrou qui tienne
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 UN VERSEMENT ERC-20 NE PORTE AUCUN MÉMO. Trois moyens de reconnaître qui
// a payé, et un seul survit à l'examen :
//   · l'adresse d'envoi déclarée → il paie depuis un exchange, le `from` n'est
//     pas le sien. Inutilisable comme verrou.
//   · une adresse par commande → il faudrait garder une CLÉ PRIVÉE ici. ⛔ Non.
//   · le montant unique → ⭐ il marche quelle que soit la provenance.
// ⭐⭐⭐ ET LA COLLISION EST BORNÉE PAR CONSTRUCTION, C'EST CE QUI REND CE
// CHOIX SÛR : le scan filtre sur le DESTINATAIRE, donc deux montants ne
// peuvent se confondre qu'entre NOS commandes encore actives — jamais avec le
// reste de la chaîne. Neuf places par prix suffisent très largement ici, et
// coûtent au maximum neuf centimes à l'acheteur.
const SUFFIXES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const hex = (n) => {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Ouvre une commande et lui réserve un montant que rien d'autre n'utilise.
 * ⛔ Rend `{ok:false, raison}` — il ne LÈVE pas. Une caisse qui jette une
 *    exception sur un clic rend une page 500 ; elle doit rendre un refus lisible.
 */
export function ouvrirCommande(compte, palier, mois) {
  const g = grille();
  const p = String(palier || '');
  const mm = Number(mois);
  if (!g[p]) return { ok: false, raison: 'palier' };
  if (mm !== 1 && mm !== 12) return { ok: false, raison: 'duree' };
  if (!String(compte || '').trim()) return { ok: false, raison: 'compte' };
  if (!/^0x[0-9a-f]{40}$/.test(ADRESSE())) return { ok: false, raison: 'caisse' };

  const d = ouvrir();
  const maintenant = Date.now();
  const socle = g[p][mm];

  // ⚠️ « ACTIVE » VEUT DIRE « QUI PEUT ENCORE ÊTRE PAYÉE », donc jusqu'à
  //   `limite_a` (24 h) et NON jusqu'à `ecran_a` (15 min). Recycler un montant
  //   au bout de 15 minutes rouvrirait exactement le trou qu'on vient de
  //   fermer : le retardataire paierait le montant d'une commande devenue
  //   celle de quelqu'un d'autre.
  const pris = new Set(d.prepare(
    "SELECT cents FROM commandes WHERE etat = 'ouverte' AND limite_a > ?",
  ).all(maintenant).map((l) => l.cents));

  const cents = SUFFIXES.map((s) => socle + s).find((c) => !pris.has(c));
  if (!cents) return { ok: false, raison: 'sature' };

  const reference = hex(8);
  d.prepare(`INSERT INTO commandes
    (reference, compte, palier, mois, cents, cree_a, ecran_a, limite_a, etat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ouverte')`)
    .run(reference, String(compte), p, mm, cents,
      maintenant, maintenant + ECRAN_MS, maintenant + LIMITE_MS);

  return { ok: true, reference, cents, palier: p, mois: mm, ecran_a: maintenant + ECRAN_MS };
}

export function lireCommande(reference, compte) {
  const l = ouvrir().prepare('SELECT * FROM commandes WHERE reference = ?').get(String(reference || ''));
  // ⛔ LA RÉFÉRENCE NE SUFFIT PAS À DÉSIGNER UNE COMMANDE : on exige AUSSI le
  //    compte. Sans ce contrôle, une référence devinée ou récupérée dans un
  //    historique de navigation laisserait lire l'état d'achat d'autrui.
  if (!l || l.compte !== String(compte || '')) return null;
  return l;
}

export const commandesActives = () => ouvrir().prepare(
  "SELECT COUNT(*) AS n FROM commandes WHERE etat = 'ouverte' AND limite_a > ?",
).get(Date.now()).n;

// ═══════════════════════════════════════════════════════════════════════════
// ⑸ LIRE LA CHAÎNE
// ═══════════════════════════════════════════════════════════════════════════
async function rpc(methode, params, delaiMs = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), delaiMs);
  try {
    const r = await fetch(RPC(), {
      method: 'POST',
      signal: ac.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: methode, params }),
    });
    if (!r.ok) return { erreur: 'http' };
    const j = await r.json();
    // ⚠️ UN NOEUD QUI REFUSE RÉPOND 200 AVEC UN CHAMP `error`. Le lire comme
    //   un succès rendrait « zéro transfert » — indiscernable de « personne
    //   n'a payé ». Deux causes, un seul chemin de sortie : c'est le défaut
    //   qu'on refuse.
    if (j && j.error) return { erreur: 'refus' };
    return { resultat: j?.result };
  } catch (e) {
    return { erreur: e && e.name === 'AbortError' ? 'delai' : 'reseau' };
  } finally {
    clearTimeout(t);
  }
}

const versDecimal = (hexa) => {
  if (typeof hexa !== 'string' || !/^0x[0-9a-fA-F]{1,16}$/.test(hexa)) return null;
  return Number.parseInt(hexa, 16);
};

// ⭐ 6 décimales chez les deux jetons ⇒ les cents sont le brut divisé par 10⁴.
//   ⚠️ On ARRONDIT, on ne tronque pas : un acheteur qui envoie 6,009999 a
//   payé plus que 6,00 — le tronquer le pénaliserait d'un centime pour une
//   imprécision qui n'est pas la sienne.
const centsDeBrut = (brut) => Math.round(brut / 1e4);

// ═══════════════════════════════════════════════════════════════════════════
// ⑹ LE RAPPROCHEMENT — la seule décision qui touche à de l'argent
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⭐ EXPORTÉE ET PURE, PARCE QU'ELLE EST LA PARTIE QU'IL FAUT POUVOIR ÉPROUVER
 * SANS RÉSEAU ET SANS BASE. Un rapprochement enfoui dans la boucle de scan ne
 * s'éprouve qu'en montant une chaîne entière — donc mal, donc rarement.
 */
export function rapprocher(centsRecus, ouvertes) {
  // ① L'EXACT D'ABORD, TOUJOURS. C'est le cas normal, et il ne doit jamais
  //    être arbitré par la règle de tolérance.
  const exact = ouvertes.find((c) => c.cents === centsRecus);
  if (exact) return { commande: exact, trop: 0 };

  // ② « TROP » — Preda : on ouvre quand même. ⛔ Mais uniquement la commande
  //    immédiatement en dessous, et à moins de 50 cents. Sans cette double
  //    borne, un versement whale ouvrirait une commande crevette oubliée et
  //    l'acheteur perdrait la différence.
  const dessous = ouvertes.filter((c) => c.cents < centsRecus)
    .sort((a, b) => b.cents - a.cents)[0];
  if (dessous && centsRecus - dessous.cents <= TOLERANCE_CENTS) {
    return { commande: dessous, trop: centsRecus - dessous.cents };
  }

  // ③ TROP PEU, OU RIEN QUI CORRESPONDE. ⛔ On n'ouvre RIEN, et on garde la
  //    trace — c'est le « tu es prévenu » de l'arbitrage du 25/08.
  return { commande: null, trop: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑺ OUVRIR LE PALIER — l'appel à veveid
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ `ID_CAISSE` est un secret PARTAGÉ : veveprice le présente, veveid le
//   compare à durée constante. Sans lui, `/api/abonner` répond 404 — comme une
//   adresse inconnue, jamais 401, pour ne pas signaler qu'il y a une caisse là.
// ⛔ CE MODULE NE JOURNALISE NI LE COMPTE, NI LA RÉFÉRENCE : la référence
//   désigne une transaction réelle. La même règle que chez veveid.
async function accorder({ reference, compte, palier, mois }) {
  const socle = String(process.env.SESSION_API || '').replace(/\/+$/, '');
  const cle = String(process.env.ID_CAISSE || '');
  if (!socle || !cle) return { ok: false, raison: 'non branche' };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(`${socle}/api/abonner`, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'content-type': 'application/json', 'x-caisse': cle },
      body: JSON.stringify({ reference, compte, jours: JOURS[mois], palier }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j?.ok !== false, raison: r.ok ? '' : `http ${r.status}` };
  } catch (e) {
    return { ok: false, raison: e && e.name === 'AbortError' ? 'delai' : 'reseau' };
  } finally {
    clearTimeout(t);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑻ LE SCAN
// ═══════════════════════════════════════════════════════════════════════════
let scanEnCours = false;
let dernierBilan = { quand: null, blocs: 0, vus: 0, credites: 0, erreur: null };

export async function scanner() {
  // ⛔ UN SEUL SCAN À LA FOIS. Deux passes simultanées liraient les mêmes logs
  //   et tenteraient le même crédit ; l'index UNIQUE sur `tx` les arrêterait,
  //   mais après l'appel à veveid — donc en double.
  if (scanEnCours) return dernierBilan;
  const adresse = ADRESSE();
  if (!/^0x[0-9a-f]{40}$/.test(adresse)) return dernierBilan;
  scanEnCours = true;
  try {
    const d = ouvrir();
    const tete = await rpc('eth_blockNumber', []);
    const courant = versDecimal(tete.resultat);
    if (!Number.isFinite(courant)) {
      dernierBilan = { ...dernierBilan, quand: new Date().toISOString(), erreur: tete.erreur || 'forme' };
      return dernierBilan;
    }

    // ⭐ AU TOUT PREMIER DÉMARRAGE ON PART DE TOUT PRÈS DE LA TÊTE, jamais de
    //   zéro : aucune commande n'existe avant, et remonter la chaîne entière
    //   prendrait des heures pour ne rien trouver.
    //
    // 🔴🔴🔴 ET ON PERSISTE **IMMÉDIATEMENT**, HORS DE LA BOUCLE. Sans cette
    //   ligne, le curseur valait `courant` et la boucle `depuis < courant` ne
    //   tournait pas une seule fois — donc `poserSuivi()`, qui n'était appelée
    //   QUE dans la boucle, n'écrivait jamais rien. Au tour suivant le curseur
    //   était de nouveau vide, repartait du nouveau `courant`, et ainsi de
    //   suite : **le collecteur n'aurait scanné aucun bloc, jamais, sans une
    //   seule erreur.** Une caisse parfaitement verte qui n'encaisse rien.
    //   ⭐ Attrapé par `test:caisse` §⑬ avant le premier dépôt — c'est
    //   exactement le genre de défaut qui ne se découvre autrement que par la
    //   plainte d'un acheteur qui a déjà payé.
    // ⚠️ Le recul de 500 blocs (~17 min) n'est pas décoratif : si la base est
    //   recréée pendant qu'une commande attend, il rattrape ce qui vient
    //   d'arriver au lieu de l'enjamber.
    let depuis = Number(lireSuivi('dernier_bloc'));
    if (!Number.isFinite(depuis) || depuis <= 0) {
      depuis = Math.max(0, courant - 500);
      poserSuivi('dernier_bloc', String(depuis));
    }
    // ⚠️ Après un long arrêt, on ne remonte pas au-delà de la fenêtre de
    //   reconnaissance : ce qui est plus vieux ne peut plus rien ouvrir.
    if (courant - depuis > BLOCS_MAX_RETARD) depuis = courant - BLOCS_MAX_RETARD;

    const cible = '0x' + adresse.slice(2).padStart(64, '0');
    let vus = 0; let credites = 0; let blocs = 0;

    while (depuis < courant) {
      const fin = Math.min(depuis + TRANCHE_MAX, courant);
      for (const [nom, contrat] of Object.entries(JETONS)) {
        const r = await rpc('eth_getLogs', [{
          address: contrat,
          topics: [TOPIC_TRANSFER, null, cible],
          fromBlock: '0x' + depuis.toString(16),
          toBlock: '0x' + fin.toString(16),
        }]);
        // 🔴🔴 UNE TRANCHE EN ÉCHEC N'AVANCE PAS LE CURSEUR. Poser
        //   `dernier_bloc = fin` après une erreur sauterait définitivement
        //   par-dessus des paiements réels, en silence, sur un site vert.
        //   *Où l'état est-il écrit quand ça rate ?* — ici, nulle part, et
        //   c'est la bonne réponse.
        if (!Array.isArray(r.resultat)) {
          dernierBilan = {
            quand: new Date().toISOString(), blocs, vus, credites, erreur: r.erreur || 'forme',
          };
          return dernierBilan;
        }
        for (const log of r.resultat) {
          const tx = `${String(log.transactionHash || '')}#${String(log.logIndex || '')}`;
          const brut = versDecimal(log.data);
          const bloc = versDecimal(log.blockNumber);
          if (brut === null || !Number.isFinite(bloc)) continue;
          vus++;
          if (await crediter({ tx, bloc, cents: centsDeBrut(brut), jeton: nom, d })) credites++;
        }
      }
      blocs += fin - depuis;
      depuis = fin;
      poserSuivi('dernier_bloc', String(depuis));
    }

    dernierBilan = { quand: new Date().toISOString(), blocs, vus, credites, erreur: null };
    return dernierBilan;
  } catch {
    dernierBilan = { ...dernierBilan, quand: new Date().toISOString(), erreur: 'interne' };
    return dernierBilan;
  } finally {
    scanEnCours = false;
  }
}

async function crediter({ tx, bloc, cents, jeton, d }) {
  // ⭐ L'ANTI-REJEU SE JOUE AVANT TOUT LE RESTE, et il s'appuie sur les deux
  //   tables : un transfert déjà crédité, comme un transfert déjà classé
  //   orphelin, ne se rejoue pas.
  if (d.prepare('SELECT 1 FROM commandes WHERE tx = ?').get(tx)) return false;
  if (d.prepare('SELECT 1 FROM orphelins WHERE tx = ?').get(tx)) return false;

  const ouvertes = d.prepare(
    "SELECT * FROM commandes WHERE etat = 'ouverte' AND limite_a > ?",
  ).all(Date.now());
  const { commande } = rapprocher(cents, ouvertes);

  if (!commande) {
    d.prepare('INSERT OR IGNORE INTO orphelins (tx, bloc, cents, jeton, vu_a) VALUES (?, ?, ?, ?, ?)')
      .run(tx, bloc, cents, jeton, Date.now());
    return false;
  }

  // 🔴🔴🔴 ON MARQUE **AVANT** D'APPELER VEVEID, ET C'EST DÉLIBÉRÉ. Si l'appel
  //   échoue après avoir réussi côté veveid (une coupure sur la réponse), un
  //   second tour de scan rappellerait `/api/abonner` — dont l'anti-rejeu par
  //   `reference` répondrait « déjà fait », en 200. Poser la marque APRÈS
  //   l'appel, en revanche, laisserait un échec de réseau recréditer le même
  //   transfert indéfiniment. ⭐ Des deux ordres possibles, celui-ci est celui
  //   dont le pire cas est déjà géré à l'autre bout.
  d.prepare("UPDATE commandes SET etat = 'payee', tx = ?, bloc = ?, paye_a = ? WHERE reference = ?")
    .run(tx, bloc, Date.now(), commande.reference);

  const r = await accorder(commande);
  if (!r.ok) {
    // ⛔ ON NE REMET PAS LA COMMANDE EN 'ouverte' : l'argent EST arrivé. On
    //   marque un état distinct pour que ça se voie, et `/admin` de veveid
    //   permet d'accorder à la main — le filet existe déjà.
    d.prepare("UPDATE commandes SET etat = 'a_accorder' WHERE reference = ?").run(commande.reference);
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑼ LE RÉVEIL — pourquoi il n'y a NI middleware, NI tâche au chargement
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 UN `setInterval` AU NIVEAU DU MODULE, OU DANS LE MIDDLEWARE, PARTIRAIT
// PENDANT `astro build`. Et le garde-fou évident ne tient pas : `RENDERING` est
// exporté par le Dockerfile JUSTE AVANT le build, donc elle existe des deux
// côtés — et Preda a laissé `CAISSE_ADRESSE` « available during build » chez
// Coolify, ce qui rend ce discriminant-là faux aussi.
// ⭐⭐⭐ ON PART DONC D'UN FAIT DE STRUCTURE, PAS D'UNE VARIABLE : les routes
// `/api/` de veveprice sont `prerender = false`. Elles ne s'exécutent JAMAIS
// pendant le build, par construction. `reveiller()` n'est appelée que depuis
// elles — `/api/sante` (donc à chaque démarrage, le lanceur l'interroge) et
// `/api/caisse`. Il n'y a rien à garder, rien à deviner.
// ⭐ ET IL S'ARRÊTE TOUT SEUL quand plus aucune commande n'attend : une caisse
//   au repos ne doit rien coûter au noeud public qu'elle interroge.
let minuteur = null;
const PERIODE_MS = () => Number(process.env.CAISSE_PERIODE_MS) || 30000;

export function reveiller() {
  try {
    if (!/^0x[0-9a-f]{40}$/.test(ADRESSE())) return false;
    if (minuteur) return true;
    if (commandesActives() === 0) return false;
    // ⛔ LE PREMIER TOUR NE S'ATTEND PAS. `reveiller()` est appelée depuis une
    //    route HTTP : l'attendre ferait patienter le visiteur pendant un aller
    //    -retour vers un noeud public. C'est le défaut que le lot 199 a fermé
    //    sur `/api/sante`, et il se recommet ici en une ligne.
    scanner().catch(() => {});
    minuteur = setInterval(() => {
      try {
        if (commandesActives() === 0) { clearInterval(minuteur); minuteur = null; return; }
        scanner().catch(() => {});
      } catch { /* une caisse ne tue jamais son serveur */ }
    }, PERIODE_MS());
    // ⭐ `unref()` : ce minuteur ne doit pas empêcher le processus de s'arrêter
    //   proprement quand Coolify remplace le conteneur.
    if (typeof minuteur.unref === 'function') minuteur.unref();
    return true;
  } catch {
    return false;
  }
}

// ⭐ Pour le banc : un instrument qui garde un état entre deux mesures rend
//   chaque contrôle dépendant du précédent.
export function arreter() {
  if (minuteur) { clearInterval(minuteur); minuteur = null; }
  scanEnCours = false;
}

// ═══════════════════════════════════════════════════════════════════════════
// ⑽ CE QUE LA SONDE PUBLIQUE PEUT DIRE
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ DES COMPTEURS, JAMAIS DES MONTANTS, JAMAIS UNE RÉFÉRENCE, JAMAIS UN
//    COMPTE. `/api/sante` est publique — la règle du lot 101 tient ici aussi.
// ⭐ `orphelins` EST LE CHIFFRE QUI COMPTE POUR PREDA : c'est « quelqu'un a
//    payé et rien ne s'est ouvert ». Tant qu'il vaut 0, la caisse est saine.
// ⚠️ ELLE S'APPELLE `etatDuMagasin`, PAS `etatDeLaCaisse` — ce nom-là est DÉJÀ
//    pris par la sonde réseau du lot 199 (`caisse_sonde.mjs`), et `sante.js`
//    importe les deux. Deux fonctions homonymes dans un même fichier, ce n'est
//    pas une gêne de style : c'est un import qui en écrase silencieusement un
//    autre, et une sonde qui répond à la mauvaise question.
export function etatDuMagasin() {
  try {
    const d = ouvrir();
    return {
      ouverte: true,
      enAttente: commandesActives(),
      payees: d.prepare("SELECT COUNT(*) AS n FROM commandes WHERE etat = 'payee'").get().n,
      aAccorder: d.prepare("SELECT COUNT(*) AS n FROM commandes WHERE etat = 'a_accorder'").get().n,
      orphelins: d.prepare('SELECT COUNT(*) AS n FROM orphelins').get().n,
      dernierBloc: Number(lireSuivi('dernier_bloc')) || null,
      dernierScan: dernierBilan.quand,
      erreur: dernierBilan.erreur,
      branchee: Boolean(process.env.SESSION_API && process.env.ID_CAISSE),
    };
  } catch {
    return {
      ouverte: false, enAttente: null, payees: null, aAccorder: null, orphelins: null,
      dernierBloc: null, dernierScan: null, erreur: null,
      branchee: Boolean(process.env.SESSION_API && process.env.ID_CAISSE),
    };
  }
}
