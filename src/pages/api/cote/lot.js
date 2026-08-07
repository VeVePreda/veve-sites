// ⚠️ VeVePreda/veve-sites — src/pages/api/cote/lot.js   (FICHIER NEUF — lot 101)
// ═══════════════════════════════════════════════════════════════════════════
// LES COTES D'UNE PAGE, EN UN SEUL ALLER-RETOUR
// ═══════════════════════════════════════════════════════════════════════════
//
// POURQUOI ELLE EXISTE, ET POURQUOI CE N'EST PAS UNE OPTIMISATION.
// `/api/cote/[uuid]` suffit à une FICHE : un uuid, une requête. Une LISTE en
// porte 24 (une carte par pièce), une page de set jusqu'à 40. Vingt-quatre
// appels par page, c'est vingt-quatre réveils de Node pour une personne qui
// fait défiler — donc soit on renonce à montrer les prix aux abonnés dans les
// listes, soit on groupe.
// ⭐ Renoncer aurait été le vrai risque : on aurait fermé la fuite ET dégradé
// en silence le produit de ceux qui paient. Une fermeture qui abîme le service
// vendu se paie en remboursements, pas en référencement.
//
// ⭐⭐ POURQUOI GET ET PAS POST. Un POST déclenche la vérification d'origine
// d'Astro — et derrière Cloudflare, `$scheme` ment : la même faute a déjà
// produit des 403 CSRF sur tout POST (corrigée par `map` + `allowedDomains`,
// jamais par `checkOrigin:false`). Une lecture n'a aucune raison d'aller
// chercher ce piège. La requête ne modifie rien, `no-store` interdit tout
// cache partagé, et le paramètre est plafonné.
export const prerender = true;

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { COTE_DIR, uuidValide } from '../../../../engine/lib/cote.mjs';
import { franchit } from '../../../../engine/lib/access.mjs';

const ENTETES = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store',
  'vary': 'cookie',
  'x-content-type-options': 'nosniff',
};

const refus = (code, cle) =>
  new Response(JSON.stringify({ ok: false, erreur: cle }), { status: code, headers: ENTETES });

// ⚠️ PLAFOND, ET IL EST LÀ POUR UNE RAISON MESURABLE : sans lui, `?u=` répété
// assez longtemps fait lire au serveur autant de fichiers que le catalogue en
// compte, en une requête, par un abonné au palier le plus bas. 60 couvre la
// plus grande page réelle (un set de 40) avec de la marge ; au-delà, on
// tronque au lieu de refuser — une liste un peu plus longue que prévu doit
// s'afficher en partie, pas échouer.
const MAX_LOT = 60;

export async function GET({ url, locals }) {
  if (!franchit('cote', locals)) {
    return refus(locals?.palier ? 403 : 401, locals?.palier ? 'palier' : 'session');
  }

  const brut = String(url.searchParams.get('u') || '');
  if (!brut) return refus(400, 'vide');

  // ⭐ LA LISTE BLANCHE S'APPLIQUE À CHAQUE ÉLÉMENT, PAS À LA CHAÎNE. Filtrer
  // la chaîne entière laisserait passer un lot où un seul uuid est un chemin.
  // ⭐ Et les doublons sautent : une page qui répète une pièce ne doit pas
  // faire lire deux fois le même fichier, ni compter deux fois dans le plafond.
  const uuids = [...new Set(brut.split(',').map((s) => s.trim()))]
    .filter(uuidValide)
    .slice(0, MAX_LOT);
  if (!uuids.length) return refus(400, 'uuid');

  const cotes = {};
  let absents = 0;
  for (const u of uuids) {
    const chemin = join(COTE_DIR, `${u}.json`);
    if (!existsSync(chemin)) { absents++; continue; }
    try { cotes[u] = JSON.parse(readFileSync(chemin, 'utf8')); }
    catch (e) { absents++; console.warn(`[cote] reserve illisible pour ${u} : ${e.message}`); }
  }

  // ⚠️ MÊME CAPTEUR QUE SUR LA ROUTE UNITAIRE, et il compte davantage ici : si
  // `.reserve/cote/` n'a pas été copié dans l'image, CETTE route répond 200
  // avec un objet vide — un succès qui ne sert rien. Sans cette trace, le
  // symptôme serait « les prix ne s'affichent plus » sur un déploiement vert.
  if (absents === uuids.length) {
    console.warn(`[cote] AUCUNE des ${uuids.length} cotes demandees n'existe (${COTE_DIR}) — reserve absente de l'image ?`);
  }

  return new Response(
    JSON.stringify({ ok: true, palier: locals?.palier || 'visitor', n: Object.keys(cotes).length, c: cotes }),
    { status: 200, headers: ENTETES });
}
