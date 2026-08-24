// ⚠️ VeVePreda/veve-sites — engine/lib/taux_omi.mjs   (FICHIER NEUF — lot 181)
// ═══════════════════════════════════════════════════════════════════════════
// LE COURS OMI → USD : un seul nombre, une seule date, une seule règle
// ═══════════════════════════════════════════════════════════════════════════
//
// Preda, point 156 de sa liste : « StackR en $ ». Le mur droit de la fiche
// affiche un plancher en OMI ; ce module est ce qui permet d'écrire
// « ≈ $12.40 » dessous sans inventer quoi que ce soit.
//
// ⛔⛔ CE N'EST PAS LA CONVERSION QUE TROIS COMMENTAIRES DE CE PROJET
// INTERDISENT, ET C'EST LA DISTINCTION QUI TIENT TOUT LE LOT.
// `cote.mjs` l. 99, `warehouse.mjs` l. 50 et `floor-watch.yml` l. 544 disent
// tous les trois la même chose : ⛔ ne pas déduire le floor d'un marché du
// floor de l'AUTRE. `sfloors` (StackR, OMI) et `vfloors` (VeVe, USD) ont un
// rapport NON CONSTANT — médiane 4 423, p10 2 273, p90 8 520 sur 1 306 items
// communs. Cette conversion-là INVENTE un chiffre, et elle reste interdite.
// ⭐ Un cours de change entre un jeton et le dollar est autre chose : c'est
// une observation de marché, cotée sur uniswap, celle-là même que StackR
// affiche à ses propres clients. On convertit un montant DANS SA PROPRE
// DEVISE ; on ne traverse toujours pas d'un marché à l'autre.
// ⇒ Si quelqu'un lit ce module pour en tirer un floor VeVe depuis un floor
//   StackR, il aura mal lu : ce n'est pas ce que ces fonctions font.
//
// 🔑 D'OÙ VIENT LE NOMBRE. `floor_watch.py` (fanablefrance/jetonveve) appelle
// `getTokenPrices → omiPrice` à CHAQUE tour depuis toujours, s'en sert pour
// les alertes, et le jetait. Le lot 181-A le persiste dans `floor_state.json`,
// et `floor-watch.yml` en tire `omi_usd.csv` (2 lignes) sur la release
// `etat-floor-watch`, à côté de `releves.csv`.
// ⛔ ZÉRO requête ajoutée, ZÉRO collecteur neuf : on cesse de jeter.

import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COTE_DIR } from './cote.mjs';

// ⭐ IL VIT DANS `COTE_DIR`, AVEC `_projection.json`, ET PAS AILLEURS.
// Trois raisons, toutes mesurables : ce dossier est déjà copié dans l'image
// (si `.reserve/cote/` manque, les prix ne s'affichent plus du tout — la
// route le journalise déjà) ; il est déjà recréé à neuf à chaque build, donc
// un cours de la veille ne peut pas survivre à un build ; et `uuidValide()`
// interdit qu'un `?u=_taux` le fasse servir comme une cote.
// ⛔ Le préfixe `_` n'est PAS décoratif : c'est la convention posée par
//    `_projection.json`, et elle sépare les fichiers de service des 19 650
//    fichiers d'uuid.
export const TAUX_FICHIER = '_taux_omi.json';

// ⏱️ LE SEUIL DE PÉREMPTION — 24 HEURES, ET IL SE JUSTIFIE PAR LE PRODUCTEUR.
// `floor-watch.yml` tourne à `cron: "3 * * * *"`, donc 24 fois par jour ; un
// cours vieux de plus de 24 h veut dire que la chaîne est arrêtée, pas que le
// marché dort. ⛔ AU-DELÀ, ON N'AFFICHE RIEN — un cours périmé sur un actif
// volatil est un chiffre faux qui a l'air d'un chiffre juste, c'est-à-dire le
// défaut de famille de ce projet. ⭐ Le silence est la seule réponse honnête
// à une absence (même arbitrage que la courbe des offres du lot 171).
export const PEREMPTION_S = 24 * 3600;

/** Le cours lu depuis `omi_usd.csv` (2 lignes : en-tête + 1 valeur).
 *  ⚠️ IL REND `null` ET JAMAIS 0. Un 0 se propage en silence dans une
 *  multiplication et produit « ≈ $0.00 » sous chaque plancher — une valeur
 *  plausible pour une absence. `null` ne se multiplie pas par accident. */
export function lireCsv(lignes) {
  if (!Array.isArray(lignes) || !lignes.length) return null;
  const l = lignes[0] || {};
  const v = Number(l.omi_usd);
  const ts = Number(l.ts_utc);
  // ⛔ `isFinite` ET `> 0` : `Number('')` vaut 0, `Number('abc')` vaut NaN, et
  //    un cours négatif n'existe pas. Les trois sortent par la même porte.
  if (!isFinite(v) || v <= 0) return null;
  if (!isFinite(ts) || ts <= 0) return null;
  return { omiUsd: v, ts: Math.round(ts) };
}

/** Dépose le cours dans la réserve. Appelé UNE fois par build.
 *  ⭐ N'ÉCRIT RIEN QUAND IL N'A RIEN. Un fichier `{}` déposé « pour que la
 *  route le trouve » forcerait la route à distinguer « fichier absent » de
 *  « fichier vide » — deux formes pour une seule cause. */
export function deposerTaux(taux) {
  if (!taux) return false;
  if (!existsSync(COTE_DIR)) mkdirSync(COTE_DIR, { recursive: true });
  writeFileSync(join(COTE_DIR, TAUX_FICHIER),
    JSON.stringify({ omiUsd: taux.omiUsd, ts: taux.ts, maj: new Date().toISOString() }),
    'utf8');
  return true;
}

/** Le cours servi par la route, ou `null`.
 *  @param maintenant epoch SECONDES (injectable : un banc ne doit pas
 *         dépendre de l'heure de la machine qui le joue). */
export function lireTaux(maintenant) {
  const chemin = join(COTE_DIR, TAUX_FICHIER);
  if (!existsSync(chemin)) return null;
  let d;
  // ⚠️ UN `try/catch` AUTOUR D'UNE LECTURE TRANSFORME UNE FAUTE DE SYNTAXE EN
  // RÉPONSE PLAUSIBLE. Ici il ne rend PAS un objet de repli : il rend `null`,
  // c'est-à-dire exactement ce que rend un fichier absent. Un JSON corrompu et
  // un fichier manquant ont la même conséquence — le mur se tait — donc ils
  // doivent avoir la même sortie.
  try { d = JSON.parse(readFileSync(chemin, 'utf8')); }
  catch (e) { console.warn(`[taux] ${TAUX_FICHIER} illisible : ${e.message}`); return null; }
  const v = Number(d && d.omiUsd);
  const ts = Number(d && d.ts);
  if (!isFinite(v) || v <= 0 || !isFinite(ts) || ts <= 0) return null;
  const now = isFinite(maintenant) ? maintenant : Math.floor(Date.now() / 1000);
  // ⚠️ `now - ts` ET PAS `Math.abs` : un horodate dans le FUTUR (horloge
  // décalée chez le producteur) doit passer, pas être rejeté comme périmé.
  // C'est l'ancienneté qui disqualifie un cours, jamais l'avance.
  if (now - ts > PEREMPTION_S) return null;
  return { omiUsd: v, ts };
}
