// ⚠️ DEPOT : VeVePreda/veve-sites
// 🔴 CHEMIN EXACT DANS LE DEPOT :  src/pages/api/ventes/[uuid].js
//    (le nom livré ici s'appelle `CROCHET-uuid` parce que Windows refuse les
//     crochets dans un nom de fichier — À RENOMMER EN `[uuid].js` AU DÉPÔT.)
// ═══════════════════════════════════════════════════════════════════════════
// LA ROUTE QUI REND LES VENTES D'UNE PIÈCE — aux membres, et à eux seuls.
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ SŒUR DE `/api/historique/[uuid].js`, ET DÉLIBÉRÉMENT PLUS BÊTE.
// L'historique vend de la PROFONDEUR : il lit `plages:`, tronque, annonce ce
// qu'il a tronqué. Les ventes sont un OUI/NON — arbitrage Preda du 28/08 :
// « membres seulement ». Copier la mécanique de profondeur ici créerait une
// seconde déclaration de la même idée, et deux déclarations divergent toujours.
// ⇒ `franchit()`, rien de plus.
//
// ⭐ POURQUOI UNE ROUTE NEUVE NE COÛTE QU'UNE LIGNE, ET C'EST MESURÉ.
// `nginx.server.conf` délègue par `location ^~ /api/` — un bloc GÉNÉRIQUE. Et
// `cache_attendu.mjs` couvre la famille `pages/api/`. Les lots 140-3, portes
// et réglages l'ont écrit trois fois : pour une route SOUS `/api/`,
// `ROUTES_COMPTE` est le SEUL des quatre endroits à toucher. ⛔ Cela ne vaut
// PAS pour une route de page : celles-là se déclarent jusqu'au bord Cloudflare,
// hors dépôt.
//
// ⚠️ `prerender = true` EN LITTÉRAL — même dispositif que les routes de compte.
// Un `false` littéral casse le build static de vevewiki (NoAdapterInstalled) ;
// une EXPRESSION n'est pas évaluée par Astro, qui retombe silencieusement sur
// `true` — c'est le défaut du lot 24, et il ne se voit qu'en production.
// C'est `engine/lib/astro_routes_compte.mjs` qui bascule cette route en mode
// server, et qui le TRACE dans le journal de build.
export const prerender = true;

// 🔴 Route dynamique pré-générée ⇒ `getStaticPaths()` OBLIGATOIRE, sinon le
// build de vevewiki casse (« GetStaticPathsRequired »).
// ⭐ Et la réponse honnête est « aucun » : en mode static il n'y a pas de
// serveur, donc pas de session, donc pas de membre. ⛔ NE PAS y mettre les
// uuid du catalogue « pour que ça marche aussi en static » : ça écrirait dans
// `dist/` un JSON de ventes par pièce, servi en clair par nginx à qui connaît
// l'adresse — c'est-à-dire exactement la fuite que ce lot existe pour éviter.
export function getStaticPaths() { return []; }

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { uuidValide } from '../../../../engine/lib/reserve.mjs';
import { VENTES_DIR, ORDRE_SERVI } from '../../../../engine/lib/ventes.mjs';
import { franchit } from '../../../../engine/lib/access.mjs';

// ⭐ `no-store` + `vary: cookie` : sans eux, un cache intermédiaire peut servir
// la réponse d'un membre à un visiteur. Une réponse d'API ne passe pas par le
// chemin d'une page — la précaution doit être ICI AUSSI.
const ENTETES = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store',
  'vary': 'cookie',
  'x-content-type-options': 'nosniff',
};

// ⛔ LE CORPS D'UN REFUS NE DIT JAMAIS CE QU'IL REFUSE. « uuid inconnu » et
// « pas membre » doivent se ressembler vus du dehors, sinon la route devient un
// oracle qui énumère le catalogue par différence de message. On distingue les
// CODES (contrat HTTP), pas les MOTIFS.
const refus = (code, cle) =>
  new Response(JSON.stringify({ ok: false, erreur: cle }), { status: code, headers: ENTETES });

export async function GET({ params, locals }) {
  // 1. LA FORME AVANT TOUT. L'uuid vient de l'URL et sert à composer un CHEMIN
  //    DE FICHIER : sans ce test, `..%2f..%2fsites%2fveveprice%2fmanifest.yml`
  //    lirait ce qu'il veut. Liste blanche, jamais liste noire — et la MÊME
  //    fonction que celle qui a écrit les fichiers, importée, pas recopiée.
  if (!uuidValide(params.uuid)) return refus(400, 'uuid');

  // 2. LE DROIT ENSUITE, ET AVANT TOUTE LECTURE DE DISQUE. Vérifier après la
  //    lecture marcherait aussi — et laisserait la porte ouverte au premier
  //    `return` mal placé ajouté plus tard.
  //    ⭐ `franchit()` répond à tout : porte inactive (vevewiki, site gratuit)
  //    ⇒ vrai pour tout le monde ; sinon comparaison de RANGS. Aucun nom de
  //    palier n'est écrit dans ce fichier, et c'est la raison pour laquelle
  //    l'arbitrage peut changer sans le rouvrir.
  if (!franchit('sales', locals)) {
    // 401 « connecte-toi » si personne n'est identifié, 403 « ton palier ne
    // suffit pas » sinon. Les deux méritent des messages différents DANS
    // L'INTERFACE, et c'est le seul endroit qui peut faire la différence.
    return refus(locals?.palier ? 403 : 401, locals?.palier ? 'palier' : 'session');
  }

  // 3. LA DONNÉE, SERVIE TELLE QUELLE. `engine/lib/ventes.mjs` l'a écrite au
  //    build au format que le client attend. La route ne parse pas, ne trie
  //    pas, ne recalcule pas — moins elle en fait, moins elle peut mentir.
  const chemin = join(VENTES_DIR, `${params.uuid}.json`);
  if (!existsSync(chemin)) {
    // ⚠️ CE 404 A DEUX SENS, ET LE SECOND EST UNE PANNE.
    // Soit cette pièce n'a aucune vente collectée — le cas NORMAL de ~68 % du
    // catalogue publié (2 869 pièces couvertes sur 8 840 fiches, mesuré le
    // 28/08) — soit `.reserve/ventes/` n'a pas été copié dans l'image, et
    // TOUTES les fiches sont muettes avec un site par ailleurs vert.
    // ⛔ Pas de `console.warn` ici : à 68 % de 404 légitimes, il noierait le
    // journal et le vrai cas deviendrait invisible. C'est le compteur du build
    // (`[ventes] N fiches`) qui distingue les deux, et lui seul.
    return refus(404, 'absent');
  }

  // ⭐ On enveloppe au lieu de renvoyer le tableau nu : le client a besoin de
  // savoir CE QU'IL VIENT D'OBTENIR (quel palier a ouvert) pour l'annoncer.
  // Une donnée livrée sans son origine oblige l'interface à la deviner.
  //
  // 🔑 `champs` EST LE CONTRAT, ET IL VOYAGE AVEC LA DONNÉE.
  // Chaque vente est un TABLEAU POSITIONNEL, pas un objet — 8 429 lignes × 7
  // clés répétées seraient ~350 Ko de noms de champs pour zéro information.
  // Mais un tableau positionnel se décale en silence : un champ inséré au
  // milieu ferait afficher un prix à la place d'une édition, sans erreur,
  // puisque les deux sont des nombres. ⇒ l'ordre part avec la réponse, le
  // client s'y indexe, et le jour où il change les deux bouts bougent ensemble.
  // ⛔ Ne JAMAIS écrire cette liste en dur ici : elle est importée du module
  // qui ÉCRIT les fichiers. Une seule déclaration, sinon elles divergent.
  //
  // ⚠️ DEUX PRIX, ET `0` VEUT DIRE « PAS DANS CETTE UNITÉ », jamais « gratuit ».
  // `usd` est vide sur une vente StackR dont le jour n'a pas de cours ; `omi`
  // est vide sur toute vente du marché VeVe, payée en gems. Le client affiche
  // ce qu'il a, et ne fabrique jamais l'autre.
  return new Response(
    `{"ok":true,"palier":${JSON.stringify(locals?.palier || 'visitor')},`
    + `"champs":${JSON.stringify(ORDRE_SERVI)},`
    + `"v":${readFileSync(chemin, 'utf8')}}`,
    { status: 200, headers: ENTETES });
}
