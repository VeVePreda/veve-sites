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
import { RESERVE_DIR, uuidValide } from '../../../../engine/lib/reserve.mjs';
import { porte, franchit } from '../../../../engine/lib/access.mjs';

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
  const p = porte('price_history');
  if (!franchit('price_history', locals)) {
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
  // ⭐ On enveloppe au lieu de renvoyer le fichier nu : le client a besoin de
  // savoir CE QU'IL VIENT D'OBTENIR (le palier qui a ouvert, la profondeur
  // publique qu'il remplace) pour l'annoncer à l'écran. Une donnée livrée sans
  // son origine oblige l'interface à la deviner.
  return new Response(
    `{"ok":true,"palier":${JSON.stringify(locals?.palier || 'visitor')},`
    + `"publicMax":${Number.isFinite(p.public_max) ? p.public_max : 0},`
    + `"publicDays":${Number.isFinite(p.public_days) ? p.public_days : 0},`
    + `"h":${brut}}`,
    { status: 200, headers: ENTETES });
}
