// ⚠️ DEPOT : VeVePreda/veve-sites  ·  CHEMIN : engine/lib/ventes.mjs   (FICHIER NEUF — lot 210-A2)
// ═══════════════════════════════════════════════════════════════════════════
// LES DERNIÈRES VENTES D'UNE PIÈCE — écrites hors de `dist/`, servies sous porte.
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI CE MODULE N'ÉCRIT RIEN DANS LA PAGE.
// Preda a tranché le 28/08 : la table des ventes est RÉSERVÉE AUX MEMBRES. Or
// une fiche est un fichier statique bâti une fois, au niveau visiteur, pour
// tout le monde et pour toujours — c'est ce qui fait le référencement. Un prix
// de vente écrit dans ce HTML serait servi à qui le demande, membre ou non,
// et `engine/tools/test_fuite_prix.mjs` a été écrit précisément pour attraper
// ça. ⇒ même dispositif que l'historique de prix (lot 24 puis 101) : la donnée
// part dans `.reserve/`, JAMAIS dans `dist/`, et une route la livre après
// lecture de la session.
//
// ⛔ NE PAS « SIMPLIFIER » EN PASSANT LES VENTES AU GABARIT. C'est la même
// tentation que la prop `valeur` refusée à `Cote.astro`, et elle rouvrirait en
// une ligne ce que ce module ferme.
//
// ⭐ CE MODULE EST BEAUCOUP PLUS SIMPLE QUE `reserve.mjs`, ET C'EST MESURÉ.
// La réserve d'historique lit un fichier de prix qui grandit sans limite, d'où
// ses tampons et son plafond d'octets. Ici la source est DÉJÀ agrégée en amont
// par `scraper/ventes_agregat.py` (scrapeur-veve) : 7 847 lignes, 687 Ko, au
// plus 10 ventes par pièce, mesuré le 28/08. Un seul passage en mémoire suffit
// et suffira — le fichier est borné par construction, pas par chance.
//
// 💵 LE PRIX ARRIVE EN DOLLARS, DÉJÀ CALCULÉ — ⛔ AUCUNE CONVERSION ICI.
// `ventes_agregat.py` (scrapeur-veve) fait la conversion en amont, au COURS DU
// JOUR DE LA VENTE (gate.io, 120 jours de profondeur), et laisse la colonne
// VIDE quand ce jour n'a pas de cours. Les ventes du marché VeVe sont en gems,
// et 1 gem ≈ 1 $ : recopiées telles quelles.
// ⭐ L'OMI VOYAGE AUSSI, et il n'est pas décoratif : c'est la valeur RÉELLEMENT
// échangée sur StackR. Le dollar en est une lecture, datée du jour de la vente.
// Quand le dollar manque, la fiche a encore quelque chose de vrai à montrer.
// ⛔⛔ NE JAMAIS reconvertir ici avec `omiUsd` (le cours du JOUR) : ça
// écraserait un prix daté par un prix d'aujourd'hui, sur des ventes vieilles
// de deux mois.
//
// 🔴 `vendeur` / `acheteur` : UN PSEUDO OU UNE ADRESSE TRONQUÉE, JAMAIS PLUS.
// Arbitrage Preda du 29/08 : le pseudo quand on l'a, l'adresse sinon.
// ⚠️ Et la couverture est très inégale, mesurée le 29/08 : StackR 100 %/100 %,
// VeVe 18 %/9 %. ⇒ les DEUX formes arrivent en nombre, et le contrôle plus bas
// doit accepter les deux — mais refuser une adresse ENTIÈRE, qui ne peut venir
// que d'une source qui aurait cessé de tronquer.

import { mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { uuidValide } from './reserve.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();

// ⭐ Même racine `.reserve/` que l'historique, dossier distinct. Le point de
// tête et la racine du projet valent pour la même raison qu'à côté : ni
// `public/`, ni `src/`, sinon Astro le recopie dans `dist/` et la porte ne
// protège plus rien.
export const VENTES_DIR = process.env.VENTES_DIR || join(ROOT, '.reserve', 'ventes');

// ⚠️ DEUX FORMES ACCEPTÉES, ET UNE SEULE INTERDITE.
//   · un pseudo — mesuré le 29/08 : médiane 8 caractères, p90 13, max 22 ;
//   · une adresse TRONQUÉE — `0x` + 6, soit 8 caractères.
// La liste blanche borne à 32 et n'admet ni espace, ni chevron, ni guillemet :
// ce qui entre ici finit dans un JSON servi à un membre, et une liste blanche
// de forme ne se contourne pas — une liste noire, si.
// 🔴 ET ELLE REFUSE UNE ADRESSE ENTIÈRE (42 caractères) par sa seule longueur.
// C'est le seul cas qui compte : une source qui cesserait de tronquer
// publierait le portefeuille complet de chaque vendeur sur 8 000 fiches.
const RE_QUI = /^[A-Za-z0-9_.\-]{0,32}$/;

// Les colonnes attendues, dans l'ordre où `ventes_agregat.py` les écrit.
const COLONNES = ['element_id', 'ts_utc', 'marche', 'edition',
                  'price_usd', 'price_omi', 'vendeur', 'acheteur'];

// ⚠️ Les deux seuls marchés. Un troisième nom qui apparaîtrait serait une
// source qu'on ne connaît pas — on refuse au lieu de l'afficher sous une
// étiquette inventée par le gabarit.
const MARCHES = new Set(['veve', 'stackr']);

/**
 * Écrit `.reserve/ventes/<uuid>.json` pour les pièces PUBLIÉES qui ont au
 * moins une vente.
 *
 * @param {Array<Object>} lignes  la source `ventes` (déjà parsée par warehouse)
 * @param {Set<string>|string[]} publies  uuid ayant réellement une page
 * @returns {{fichiers:number, ventes:number, octets:number, refuses:number, sansPage:number}}
 */
export function ecrire(lignes, publies) {
  // ⛔ ON REPART D'UN DOSSIER VIDE — même raison qu'à `reserve.ouvrir()` : un
  // reste de build précédent servirait les ventes d'hier à un membre, sans
  // qu'aucune erreur ne le dise, et survivrait à un rollback.
  if (existsSync(VENTES_DIR)) rmSync(VENTES_DIR, { recursive: true, force: true });
  mkdirSync(VENTES_DIR, { recursive: true });

  const garder = publies instanceof Set ? publies : new Set(publies || []);
  const par = new Map();
  let refuses = 0, sansPage = 0, horsForme = 0;

  for (const l of lignes || []) {
    const u = String(l.element_id || '').trim();
    // ⚠️ TROIS REFUS DIFFÉRENTS, TROIS COMPTEURS — et surtout : `horsForme`
    // N'EST PAS `refuses`. Les fondre rendrait indiscernables trois choses de
    // natures opposées :
    //   · `sansPage`  — cette pièce n'a pas de fiche. Cas NORMAL de 68 % du
    //                   fichier (2 869 pièces couvertes, 8 840 fiches).
    //   · `horsForme` — l'uuid n'a pas la forme d'un uuid. En production :
    //                   jamais. HORS LIGNE : TOUTES les lignes, parce que
    //                   `engine/data/sample/catalogue.csv` porte des uuid
    //                   factices (`sample-0000-582307`). C'est exactement ce
    //                   que documente la soupape de `reserve.mjs` (03/08) —
    //                   la réserve d'historique est vide hors ligne pour la
    //                   même raison, et c'est un état connu, pas une panne.
    //   · `refuses`   — la DONNÉE est inutilisable (prix, date, adresse). Ça,
    //                   c'est la source qui a changé de forme, et ça s'alerte.
    // ⛔ Ne jamais faire crier `horsForme` : le build hors ligne du bac à
    // sable hurlerait à chaque run, et l'avertissement qui compte finirait par
    // ne plus être lu.
    if (!uuidValide(u)) { horsForme++; continue; }
    if (!garder.has(u)) { sansPage++; continue; }
    const vendeur = String(l.vendeur || '');
    const acheteur = String(l.acheteur || '');
    if (!RE_QUI.test(vendeur) || !RE_QUI.test(acheteur)) { refuses++; continue; }
    const marche = String(l.marche || '');
    if (!MARCHES.has(marche)) { refuses++; continue; }

    // ⚠️ DEUX PRIX, ET IL EN FAUT AU MOINS UN. Un dollar vide est NORMAL (jour
    // sans cours) ; un OMI vide est NORMAL (marché VeVe, payé en gems). Les
    // DEUX vides, c'est une ligne qui ne dit rien — on la refuse.
    // ⛔ `Number('')` vaut 0, pas NaN : sans le test de chaîne vide, une
    // colonne absente deviendrait un prix de zéro, et « vendu pour rien » est
    // une information FAUSSE, pas une information manquante.
    const nb = (v) => {
      const s = String(v === undefined || v === null ? '' : v).trim();
      if (!s) return 0;
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const usd = nb(l.price_usd);
    const omi = nb(l.price_omi);
    if (!usd && !omi) { refuses++; continue; }

    const ts = Date.parse(String(l.ts_utc || '').replace(' ', 'T') + 'Z');
    if (!Number.isFinite(ts)) { refuses++; continue; }

    let b = par.get(u);
    if (!b) { b = []; par.set(u, b); }
    // ⭐ TABLEAU POSITIONNEL, PAS OBJET. 8 429 lignes × 7 clés répétées, ce
    // sont ~350 Ko de noms de champs écrits autant de fois qu'il y a de
    // ventes, pour zéro information. Le lecteur connaît l'ordre — il est écrit
    // dans ORDRE_SERVI juste en dessous, et le banc le scelle.
    // Epoch en SECONDES, comme la réserve d'historique — même convention des
    // deux côtés, sinon les deux lecteurs divergent un jour.
    // ⚠️ `0` SIGNIFIE « PAS DE PRIX DANS CETTE UNITÉ », et le lecteur DOIT le
    // traiter comme une absence, pas comme un montant. C'est le prix à payer
    // pour un tableau positionnel ; `null` pèserait 4 octets de plus par ligne
    // et JSON.stringify l'écrit tout aussi bien — mais `0` se compare sans
    // piège en JS, là où `null < 1` vaut vrai.
    b.push([Math.floor(ts / 1000), Number(l.edition) || 0,
            usd, omi, marche === 'veve' ? 0 : 1, vendeur, acheteur]);
  }

  let fichiers = 0, ventes = 0, octets = 0;
  // 🔢 LOT 211 — LE COMPTE PAR PIECE SORT D'ICI, ET DE NULLE PART AILLEURS.
  // La fiche doit savoir s'il existe des ventes AVANT d'emettre quoi que ce
  // soit : sans ce compte, le bloc s'emettrait sur les 8 840 fiches et
  // afficherait un cadenas sur les ~68 % qui n'ont aucune vente — un cadenas
  // qui MENT, exactement ce que `Cote.astro` interdit depuis le lot 101
  // (« un cadenas qui ment est pire qu'un tiret nu »).
  // ⭐⭐ IL SE PREND ICI PARCE QU'ICI EST LE SEUL ENDROIT QUI SAIT. `par` vient
  // d'etre filtre par `garder` (uuid publies), trie, et il disparait a la fin
  // de cette fonction. Le recompter dans `dataset.mjs` demanderait de relire
  // le CSV une seconde fois — et deux comptes du meme fait divergent un jour.
  // ⛔ UN COMPTE N'EST PAS UN MONTANT. `item.listings` (nombre d'offres) est
  // deja public dans les murs depuis le lot 43 au meme titre : c'est un fait de
  // catalogue. Aucun prix ne se deduit d'un cardinal — et `projeter()` retire
  // des champs par LISTE NOIRE (`CHAMPS_COTE`), donc celui-ci survit par
  // construction, sans qu'on ait a l'y inscrire.
  const comptes = new Map();
  for (const [u, b] of par) {
    // 🔴 LE TRI EST REFAIT ICI, ET CE N'EST PAS UNE REDONDANCE.
    // `ventes_agregat.py` trie déjà par (pièce, date décroissante) — mais ce
    // module lit un CSV publié par un AUTRE dépôt, à un AUTRE rythme. Se fier
    // à l'ordre d'un fichier qu'on ne bâtit pas, c'est faire dépendre l'ordre
    // d'affichage d'une promesse non tenue par un banc. Trier 10 éléments
    // coûte moins cher que la question « est-ce encore trié ? ».
    b.sort((x, y) => y[0] - x[0]);
    const json = JSON.stringify(b);
    writeFileSync(join(VENTES_DIR, `${u}.json`), json);
    fichiers++; ventes += b.length; octets += json.length;
    comptes.set(u, b.length);
  }

  console.log(`[ventes] ${fichiers} fiches, ${ventes} ventes, ${octets} o`
    + ` (${sansPage} sans page publiee, ${horsForme} hors forme, ${refuses} refusees)`);
  // ⭐ LE CAS HORS LIGNE SE NOMME LUI-MÊME. Sans cette ligne, un build de bac à
  // sable rend « 0 fiches » et laisse croire à une panne — alors que c'est le
  // comportement attendu et documenté depuis `reserve.mjs`.
  if (fichiers === 0 && horsForme > 0) {
    console.log('[ventes] aucun uuid de forme valide — build HORS LIGNE sur l\'echantillon, '
      + 'comme la reserve d\'historique. Le module se mesure par son banc, pas par ce build.');
  }

  // 🩺 UN REFUS MASSIF EST UNE PANNE DE SOURCE, PAS UN CAS LIMITE. Si plus
  // d'une ligne sur dix est refusée, la source a changé de forme (colonne
  // renommée, adresses non tronquées, prix en chaîne localisée) et le build
  // doit le CRIER — sinon les fiches perdent leurs ventes en restant vertes.
  // ⛔ On n'interrompt pas le build pour autant : les ventes sont un ajout,
  // pas le socle. Un site sans table de ventes reste un site.
  // ⚠️ LE DÉNOMINATEUR EXCLUT `horsForme`, ET C'EST TOUT L'INTÉRÊT DU
  // COMPTEUR SÉPARÉ : hors ligne, `lues` vaudrait le fichier entier et le
  // rapport serait de 0 %, donc muet — mais en production une source qui se
  // met à écrire des uuid tronqués passerait aussi inaperçue. On juge la
  // qualité de la DONNÉE sur les lignes qu'on a réellement essayé de lire.
  const lues = (lignes || []).length - horsForme;
  if (lues > 0 && refuses > lues / 10) {
    console.warn(`[ventes] ${refuses}/${lues} lignes REFUSEES — la source a probablement change de forme.`);
    console.warn('::warning title=Ventes refusees en masse::Verifier les colonnes de ventes_stackr.csv');
  }

  // ⭐ `comptes` VOYAGE AVEC LES COMPTEURS, dans le meme objet. Un second
  // canal (un export mutable, un fichier annexe) serait un second etat a tenir
  // en phase avec celui-ci — et le jour ou l'un des deux bouge sans l'autre,
  // la fiche annonce un nombre de ventes que la reserve ne porte pas.
  return { fichiers, ventes, octets, refuses, sansPage, horsForme, comptes };
}

// ⭐ Exportés pour le banc, et pour lui seul : un banc qui réécrit la liste des
// colonnes dans son propre fichier mesurerait sa copie, pas le module.
export const COLONNES_SOURCE = COLONNES;

// 🔑 L'ORDRE DES CHAMPS SERVIS, ET IL EST LE CONTRAT AVEC LE CLIENT.
// Le tableau positionnel n'a de sens que si les deux bouts lisent la même
// liste. ⛔ Ne JAMAIS insérer au milieu : un champ ajouté en 3ᵉ position
// décalerait tout, et le client afficherait un prix à la place d'une édition
// SANS qu'aucune erreur ne se produise — les deux sont des nombres.
// ⇒ toute évolution s'ajoute À LA FIN, et le banc compare cette liste à ce que
// le gabarit lit.
export const ORDRE_SERVI = ['ts', 'edition', 'usd', 'omi', 'marche', 'vendeur', 'acheteur'];

// ⚠️ `marche` est servi en NOMBRE : 0 = VeVe, 1 = StackR. Deux octets contre
// six ou huit, sur 8 429 lignes. Le libellé se traduit — le stocker en clair
// figerait l'anglais dans un fichier de données.
export const MARCHE_VEVE = 0;
export const MARCHE_STACKR = 1;
