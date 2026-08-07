// ⚠️ VeVePreda/veve-sites — src/pages/api/cote/[uuid].js   (FICHIER NEUF — lot 101)
// ═══════════════════════════════════════════════════════════════════════════
// LA COTE D'UNE PIÈCE — prix plancher courant, extrêmes, percentiles.
// ═══════════════════════════════════════════════════════════════════════════
//
// SŒUR JUMELLE DE `/api/historique/[uuid].js`, ET DÉLIBÉRÉMENT SÉPARÉE.
// L'historique se VEND par sa PROFONDEUR (le mur tronque à 30 relevés sur
// 3 jours) ; la cote se vend par son EXISTENCE — un prix courant ne se tronque
// pas, il se donne ou pas. Deux marchandises, deux portes (`price_history` et
// `cote`), deux routes. ⛔ Les fusionner obligerait à écrire, dans une seule
// route, deux tests de palier qui ne veulent pas dire la même chose : c'est
// exactement la forme dans laquelle une élévation de privilège se cache.
//
// ⭐ ET ELLES NE S'OUVRENT PAS ENSEMBLE. Le jour où Preda vend « le prix du
// jour » moins cher que « toute l'histoire », il change UNE ligne du manifeste.
// Ici, rien.
export const prerender = true;

// 🔴 Même raison que sur `/api/historique` et `/api/analytics` : sans
// `getStaticPaths()`, le build de vevewiki casse (GetStaticPathsRequired).
// ⭐ Et la réponse honnête est « aucun chemin ». En static il n'y a pas de
// serveur, donc pas de session, donc aucun palier.
// ⛔ NE PAS y mettre les uuid du catalogue « pour que ça marche aussi en
// static » : ça écrirait dans `dist/` un JSON par pièce contenant le prix
// courant — c'est-à-dire exactement la fuite que tout ce lot referme, réécrite
// une deuxième fois par la porte de service.
export function getStaticPaths() { return []; }

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

// ⛔ LE CORPS D'UN REFUS NE DIT JAMAIS CE QU'IL REFUSE — sinon la route devient
// un oracle qui énumère le catalogue par différence de message.
const refus = (code, cle) =>
  new Response(JSON.stringify({ ok: false, erreur: cle }), { status: code, headers: ENTETES });

export async function GET({ params, locals }) {
  // 1. LA FORME AVANT TOUT : `params.uuid` compose un CHEMIN DE FICHIER.
  //    Liste blanche, et la MÊME fonction que celle qui a écrit les fichiers.
  if (!uuidValide(params.uuid)) return refus(400, 'uuid');

  // 2. LE DROIT ENSUITE, ET AVANT TOUTE LECTURE DE DISQUE.
  if (!franchit('cote', locals)) {
    return refus(locals?.palier ? 403 : 401, locals?.palier ? 'palier' : 'session');
  }

  // 3. LA DONNÉE, SERVIE TELLE QUELLE — moins la route en fait, moins elle
  //    peut mentir. Le fichier a été écrit au build par `cote.mjs` au format
  //    exact que le composant attend.
  const chemin = join(COTE_DIR, `${params.uuid}.json`);
  if (!existsSync(chemin)) {
    // ⚠️ CE 404 EST UN CAPTEUR, pas un cas limite. Il dit soit « cette pièce
    // n'a pas de page », soit « `.reserve/cote/` n'a pas été copié dans
    // l'image » — et le second rendrait le site MUET POUR LES SEULS ABONNÉS,
    // avec un déploiement parfaitement vert. C'est la panne qu'on ne découvre
    // que par une réclamation, donc elle laisse une ligne.
    console.warn(`[cote] réserve absente pour ${params.uuid} (${COTE_DIR})`);
    return refus(404, 'absent');
  }

  const brut = readFileSync(chemin, 'utf8');
  return new Response(
    `{"ok":true,"palier":${JSON.stringify(locals?.palier || 'visitor')},"c":${brut}}`,
    { status: 200, headers: ENTETES });
}
