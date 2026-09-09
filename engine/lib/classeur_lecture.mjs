// ⚠️ VeVePreda/veve-sites — engine/lib/classeur_lecture.mjs   (FICHIER NEUF — lot N ⑪)
// ═══════════════════════════════════════════════════════════════════════════
//  LIRE CE QU'UN PORTEFEUILLE DÉTIENT, DEPUIS LA RÉSERVE DU CLASSEUR
// ═══════════════════════════════════════════════════════════════════════════
// `classeur.mjs` ÉCRIT la réserve au build (fragments `wallets/<2 hex>.json`,
// index `uuids.json`) ; la route `/api/classeur/wallet` la LIT pour rendre
// l'inventaire. Le classement MCP personnalisé a besoin de la même lecture,
// réduite à une question : « quels uuid cette adresse détient-elle ? ».
// ⭐ Une seule lecture, ici, plutôt que recopiée dans deux routes : la forme
//   des fragments (`[[iu, edition, listed], …]`) n'a qu'un endroit où changer.
// ⛔ AUCUN REPLI : réserve absente ⇒ `null`, et l'appelant refuse en 503. Un
//   classement « personnalisé » calculé sur un portefeuille vide parce que le
//   fichier manquait dirait « vous ne possédez rien » — faux, en silence.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLASSEUR_DIR } from './classeur.mjs';

export const RE_ADRESSE = /^0x[0-9a-fA-F]{40}$/;

let _uuids = null;
const uuids = () => {
  if (_uuids) return _uuids;
  const f = join(CLASSEUR_DIR, 'uuids.json');
  if (!existsSync(f)) return null;
  try { return (_uuids = JSON.parse(readFileSync(f, 'utf8'))); } catch { return null; }
};
/** ⚠️ Pour les bancs, qui rebâtissent la réserve entre deux lectures. */
export const _oublierIndex = () => { _uuids = null; };

/**
 * Les uuid détenus par `adresse`, ou `null` si la réserve n'est pas là.
 * Une adresse inconnue du grand livre rend un `Set` VIDE (elle ne détient
 * rien de ce catalogue) — ce n'est pas une panne.
 */
export function piecesDetenues(adresse) {
  const a = String(adresse || '');
  if (!RE_ADRESSE.test(a)) return null;
  const us = uuids();
  if (!us) return null;
  // ⭐ `uuids.json` est le TÉMOIN de la réserve ; un fragment absent, lui,
  //   veut dire « aucun portefeuille ne commence par ces deux hex » — un Set
  //   vide, pas une panne (la prod en écrit 256, un banc peut n'en écrire qu'un).
  const f = join(CLASSEUR_DIR, 'wallets', `${a.slice(2, 4).toLowerCase()}.json`);
  if (!existsSync(f)) return new Set();
  let frag;
  try { frag = JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
  const lignes = frag[a] || frag[a.toLowerCase()] || [];
  const out = new Set();
  for (const l of lignes) { const u = us[l[0]]; if (u) out.add(u); }
  return out;
}
