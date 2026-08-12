// ⚠️ VeVePreda/veve-sites — src/pages/api/historique/[uuid].js   (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LA ROUTE QUI REND LE MUR RÉEL — sans rien coûter au SEO.
// ═══════════════════════════════════════════════════════════════════════════
//
// LE DÉFAUT QU'ELLE FERME. Le `prerender` a été réglé le 31/07 (lot 24), et le
// middleware de session tourne — mais sur QUATRE routes. Les 461 pages de
// contenu, elles, restent pré-générées : c'est ce qui fait le référencement,
// et on n'y touche pas. Conséquence : le `<Gate>` d'une fiche est évalué AU
// BUILD, donc au niveau VISITEUR, pour tout le monde et pour toujours.
// ⭐ UN ABONNÉ VOYAIT ENCORE LA PAGE DU VISITEUR. La porte était écrite,
// testée, correcte — et calculée au mauvais moment.
//
// ⭐⭐ LA SEULE FORME QUI TIENT LES DEUX BOUTS. La page reste un fichier
// statique (donc rapide, donc indexable, donc identique pour Google et pour un
// visiteur), et la PARTIE RÉSERVÉE arrive par cette route, à la demande, après
// lecture de la session. Le HTML pré-généré ne contient jamais la donnée
// réservée — il ne l'a jamais contenue, `<Gate>` s'en assure depuis le 21/07.
// On ne déplace donc pas un secret : on en livre un qui n'était nulle part.
//
// 🔴 CE QUE CETTE ROUTE NE FAIT PAS. Elle n'authentifie personne. Elle lit
// `Astro.locals.palier`, que le middleware a déposé après avoir résolu un
// cookie opaque auprès de `SESSION_API`. Confondre « qui es-tu » et « à quoi
// as-tu droit » est la faute qui produit les élévations de privilège ; les
// deux vivent dans deux fichiers, et c'est voulu.
//
// ⚠️ `prerender = true` EN LITTÉRAL, ET C'EST VOULU — même dispositif que les
// quatre routes de compte. Un `false` littéral fait échouer le build en mode
// static (NoAdapterInstalled) et casserait vevewiki ; une EXPRESSION n'est pas
// évaluée par Astro, qui retombe silencieusement sur `true` (c'est exactement
// le défaut du lot 24). C'est `engine/lib/astro_routes_compte.mjs` qui bascule
// cette route à la demande en mode server, via `astro:route:setup`, et qui le
// TRACE dans le journal de build.
export const prerender = true;

// 🔴 SANS CETTE FONCTION, LE BUILD DE vevewiki CASSE — mesuré, pas supposé.
// Astro : « GetStaticPathsRequired : `getStaticPaths()` is required for
// dynamic routes ». Une route dynamique PRÉ-GÉNÉRÉE doit dire quels chemins
// générer ; les quatre routes de compte du lot 24 n'avaient pas ce problème
// parce qu'aucune n'a de `[param]`. Celle-ci en a un.
// ⭐ ET LA RÉPONSE HONNÊTE EST « AUCUN ». En mode static il n'y a pas de
// serveur, donc pas de session, donc aucun palier — l'historique réservé n'a
// simplement pas de sens. Rendre une liste vide n'est pas un contournement :
// c'est dire la vérité sur ce que ce mode peut faire.
// ⛔ NE PAS y mettre les uuid du catalogue « pour que ça marche aussi en
// static » : ça écrirait dans `dist/` un fichier JSON par pièce contenant
// l'historique complet, servi en clair par nginx à qui connaît l'adresse.
// Ce serait vendre un accès à une donnée déjà donnée.
export function getStaticPaths() { return []; }

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RESERVE_DIR, uuidValide, tronquer } from '../../../../engine/lib/reserve.mjs';
import { porte, profondeur } from '../../../../engine/lib/access.mjs';

// ⭐ Un seul en-tête, posé une fois. `no-store` n'est pas une optimisation
// négative : sans lui, un cache intermédiaire peut servir la réponse d'un
// abonné à un visiteur. C'est la même précaution que le `cache-control:
// private` du middleware, et elle doit être ici AUSSI — une réponse d'API ne
// passe pas par le même chemin qu'une page.
const ENTETES = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store',
  'vary': 'cookie',
  'x-content-type-options': 'nosniff',
};

// ⛔ LE CORPS D'UN REFUS NE DIT JAMAIS CE QU'IL REFUSE. « uuid inconnu » et
// « pas abonné » doivent se ressembler vus du dehors : sinon la route devient
// un oracle qui énumère le catalogue réservé, gratuitement, par différence de
// message. On distingue les CODES (401/403/404, qui sont un contrat HTTP) sans
// détailler les MOTIFS.
const refus = (code, cle) =>
  new Response(JSON.stringify({ ok: false, erreur: cle }), { status: code, headers: ENTETES });

export async function GET({ params, locals }) {
  // 1. LA FORME AVANT TOUT. L'uuid vient de l'URL : c'est une donnée d'entrée
  //    hostile par défaut, et elle sert à composer un CHEMIN DE FICHIER. Sans
  //    ce test, `/api/historique/..%2f..%2fsites%2fveveprice%2fmanifest.yml`
  //    lirait ce qu'il veut. On refuse tout ce qui n'a pas exactement la forme
  //    d'un uuid — liste blanche, jamais liste noire, et la MÊME fonction que
  //    celle qui a écrit les fichiers (une seule définition, sinon elles
  //    divergent un jour).
  if (!uuidValide(params.uuid)) return refus(400, 'uuid');

  // 2. LE DROIT ENSUITE, ET AVANT TOUTE LECTURE DE DISQUE. Vérifier l'accès
  //    après avoir lu le fichier marcherait aussi — et laisserait la porte
  //    ouverte au premier `return` mal placé ajouté plus tard.
  //    ⭐ `franchit()` répond à tout : porte inactive (site gratuit) => vrai
  //    pour tout le monde ; sinon comparaison de RANGS entre le palier de la
  //    session et celui du manifeste. Aucun test de palier n'est écrit ici.
  //    🔴🔴🔴 LOT 140-1 — CE N'EST PLUS UN OUI/NON, C'EST UNE PROFONDEUR.
  //    `franchit()` comparait le palier de la session à celui de la PORTE
  //    (`crevette`). Un membre prenait donc 403 sur la seule route capable de
  //    lui livrer les 3 jours que le manifeste lui promet depuis le lot 132 —
  //    l'arbitrage était juste, complet, écrit au bon endroit, et AUCUN
  //    mécanisme ne pouvait le livrer.
  //    ⭐ `profondeur()` lit `plages:`, c'est-à-dire LA MÊME LISTE qui dessine
  //    les boutons. Une seule déclaration : l'API ne peut plus servir autre
  //    chose que ce que l'écran promet. (`acces()` LÈVE si un manifeste tente
  //    d'écrire la même décision une deuxième fois, dans `caps:`.)
  //    ⚠️ TROIS VALEURS, TROIS SENS : `-1` sans borne · `0` rien · `N` N jours.
  //    Ne pas confondre `0` et `-1` — un site gratuit (vevewiki, porte
  //    inactive) reçoit `-1` et reste ENTIÈREMENT ouvert.
  const p = porte('price_history');
  const prof = profondeur(locals);
  if (prof === 0) {
    // 401 si personne n'est identifié (« connecte-toi »), 403 si quelqu'un
    // l'est mais n'a pas le rang (« ton palier ne suffit pas »). Les deux
    // méritent des messages différents DANS L'INTERFACE, et c'est le seul
    // endroit qui peut faire la différence.
    return refus(locals?.palier ? 403 : 401, locals?.palier ? 'palier' : 'session');
  }

  // 3. LA DONNÉE. Le fichier est servi TEL QUEL : il a été écrit au build au
  //    format attendu par le client. La route ne parse pas, ne recalcule pas,
  //    ne retrie pas — moins elle en fait, moins elle peut mentir.
  const chemin = join(RESERVE_DIR, `${params.uuid}.json`);
  if (!existsSync(chemin)) {
    // ⚠️ CE 404 EST PLUS INTÉRESSANT QU'IL N'EN A L'AIR. Il signifie soit
    // « cette pièce n'a pas de page », soit « la réserve n'a pas été copiée
    // dans l'image ». Le second cas rendrait TOUTES les fiches muettes pour
    // les abonnés, avec un site par ailleurs parfaitement vert. D'où la trace :
    // un silence qui ne laisse pas de ligne dans le journal est un silence
    // qu'on découvre par une réclamation.
    console.warn(`[historique] réserve absente pour ${params.uuid} (${RESERVE_DIR})`);
    return refus(404, 'absent');
  }

  const brut = readFileSync(chemin, 'utf8');

  // ⭐⭐ LE CHEMIN « SANS BORNE » NE CHANGE PAS D'UN OCTET, ET C'EST VOULU.
  // Le fichier part TEL QUEL, sans parse, sans re-sérialisation : c'est la
  // promesse d'origine de cette route (« moins elle en fait, moins elle peut
  // mentir ») et c'est aussi le chemin le plus chaud. On ne paie le parse que
  // pour les paliers qui ont réellement un plafond.
  let corps = brut;
  if (prof !== -1) {
    // ⛔ LA TRONCATURE SE FAIT ICI, À LA LECTURE, ET NULLE PART AILLEURS.
    // Pas au build (`dataset()` cuit les points dans le HTML, et un build n'a
    // QU'UN palier), pas en écrivant cinq réserves par pièce (elles finiraient
    // dans l'image, une par palier, pour la même donnée).
    // ⭐ La règle vit dans `reserve.mjs`, à côté de celle qui ÉCRIT le format —
    // et elle est identique à celle de `cadran.js` : ancrage sur le DERNIER
    // relevé, comparaison `>=`.
    try {
      corps = JSON.stringify(tronquer(JSON.parse(brut), prof));
    } catch (e) {
      // ⚠️ UNE RÉSERVE ILLISIBLE EST UNE PANNE, PAS UN CAS LIMITE — et servir
      // le fichier brut « pour dépanner » livrerait la profondeur COMPLÈTE au
      // palier le plus bas, c'est-à-dire exactement la fuite du 06/08.
      console.warn(`[historique] réserve illisible pour ${params.uuid} : ${e.message}`);
      return refus(500, 'reserve');
    }
  }

  // ⭐ On enveloppe au lieu de renvoyer le fichier nu : le client a besoin de
  // savoir CE QU'IL VIENT D'OBTENIR (le palier qui a ouvert, la profondeur
  // publique qu'il remplace) pour l'annoncer à l'écran. Une donnée livrée sans
  // son origine oblige l'interface à la deviner.
  // ⭐ `profondeur` est ANNONCÉE : une réponse tronquée qui ne dit pas qu'elle
  // l'est oblige l'interface à comparer des dates pour le deviner — et c'est
  // par ce genre de devinette que les deux côtés finissent par diverger.
  return new Response(
    `{"ok":true,"palier":${JSON.stringify(locals?.palier || 'visitor')},`
    + `"profondeur":${prof},`
    + `"publicMax":${Number.isFinite(p.public_max) ? p.public_max : 0},`
    + `"publicDays":${Number.isFinite(p.public_days) ? p.public_days : 0},`
    + `"h":${corps}}`,
    { status: 200, headers: ENTETES });
}
