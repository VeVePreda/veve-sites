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
// 💱 LOT 181 — le cours OMI → USD voyage AVEC les cotes. Voir plus bas.
import { lireTaux } from '../../../../engine/lib/taux_omi.mjs';

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

  // ═══════════════════════════════════════════════════════════════════════
  // 💱 LOT 181 — LE COURS OMI VOYAGE ICI, ET PAS DANS LE HTML
  // ═══════════════════════════════════════════════════════════════════════
  // Preda, point 156 : « StackR en $ ». Trois endroits étaient possibles pour
  // faire arriver le cours au navigateur ; celui-ci est le seul qui ne coûte
  // rien et qui ne ment pas.
  //
  // ⛔ PAS UN ATTRIBUT SUR `<html>` (à côté de `data-nf`). Ce qui est dans le
  //    HTML est SERVI, et il est servi 8 840 fois — et surtout il serait FIGÉ
  //    À L'HEURE DU BUILD : la production sert un build de plusieurs heures,
  //    parfois d'un jour. Un cours de la veille affiché comme celui du jour,
  //    sur un jeton volatil, c'est un chiffre faux qui a l'air juste.
  // ⛔ PAS UN SECOND APPEL RÉSEAU depuis `60-cote.js` : ce serait un deuxième
  //    aller-retour pour 40 octets, sur la page où le premier vient de partir.
  // ⭐ ICI, il coûte ZÉRO octet de page, il est relu du disque à CHAQUE
  //    requête (donc frais dès que le prochain build le renouvelle), et il
  //    n'atteint que des gens qui ont déjà franchi la porte `cote` — les
  //    seuls à qui un plancher StackR est servi.
  //
  // ⚠️ CE N'EST PAS UNE DONNÉE RÉSERVÉE, ET C'EST POURTANT LA BONNE PLACE.
  // Le cours OMI est public (uniswap) ; le mettre derrière la porte ne le
  // protège pas — il n'y a rien à protéger. Il est ici parce que c'est le
  // paquet que son unique lecteur reçoit déjà, pas pour le cacher.
  //
  // ⛔ `taux` ABSENT DE L'OBJET quand il n'y en a pas (péremption, release pas
  // encore posée, JSON illisible) — et pas `taux: null`. Le lecteur teste
  // `if (j.taux && j.taux.omiUsd > 0)` : les deux formes passeraient, mais une
  // clé présente à `null` invite le prochain à écrire `j.taux.omiUsd` sans
  // garde. On ne laisse pas traîner l'occasion.
  const taux = lireTaux();

  return new Response(
    JSON.stringify({ ok: true, palier: locals?.palier || 'visitor',
      n: Object.keys(cotes).length, c: cotes, ...(taux ? { taux } : {}) }),
    { status: 200, headers: ENTETES });
}
