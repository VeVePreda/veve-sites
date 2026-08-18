// ⚠️ VeVePreda/veve-sites — engine/tools/test_cache.mjs   (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
//  LE CACHE — le banc qui s'écrit AVANT la règle, et qui garde la porte
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 CE BANC EXISTE POUR AUTORISER UN GESTE, PAS POUR CONSTATER UN ÉTAT.
// Mettre 3 097 pages en cache au bord est le plus gros gain du dossier. Il
// s'accompagne du risque le plus cher : une page de compte servie depuis le
// bord à quelqu'un qui n'est pas son propriétaire. Cette fuite-là ne casse
// rien, ne rougit nulle part, et se découvre par un membre qui voit le compte
// d'un autre.
// ⇒ On écrit d'abord ce qui doit rester impossible, on le voit rougir sur des
//   pannes fabriquées, ET SEULEMENT ENSUITE on pose la règle.
//
// ⛔⛔ IL NE VA PAS DANS LE DOCKERFILE. Il interroge le réseau : un hoquet
// Cloudflare ferait échouer un déploiement, et un banc ne doit JAMAIS rougir
// pour une raison qui n'est pas la sienne.
// ⛔⛔ IL N'ENTRE PAS NON PLUS DANS `npm test` : cette chaîne est une suite `&&`
// déclarée HORS RÉSEAU (`WAREHOUSE_OFFLINE=1`), et un banc qui en sort en 2 y
// arrêterait les quarante autres. Il vit dans une ÉTAPE DÉDIÉE du workflow,
// exactement comme `test:entetes` — et pour la même raison, mesurée le 11/08.
// ⇒ La chaîne reste à 40 bancs. ⛔ Le plancher `-ge 40` NE MONTE PAS.
//
// 🔴🔴 TROIS VERDICTS, PAS DEUX :  conforme (0) · écart (1) · INDÉCIDABLE (2)
// ⛔ RÉSEAU MUET ⇒ INDÉCIDABLE, JAMAIS VERT. Un banc qui se déclare vert parce
//   qu'il n'a rien pu mesurer transforme une absence de mesure en preuve de
//   conformité — c'est `regle-silence-du-non-execute` sous une forme neuve.
//
// Usage :
//     npm run test:cache
//     npm run test:cache -- --attendre     (75 s d'abord — APRÈS avoir posé ou
//                                           modifié une règle Cloudflare)
//     BANC_CACHE_BASE=http://127.0.0.1:8788 npm run test:cache
//                                          (⭐ la contre-épreuve : on détourne
//                                           les deux zones vers un serveur qui
//                                           fabrique les pannes une par une)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ZONES, PASSAGES, PAUSE_MS, DELAI_MS, METHODE,
  CACHE_RULE_POSEE, TTL_EDGE_S, ECHELLE_TTL, RETARD_TOLERE_S,
  PRIVEES, ZONE_MEMBRE, ABSENTES_HORS_MEMBRE, FAMILLES_COMPTE,
  PUBLIQUES_PAR_ZONE, VARY_TOLERES, SONDE, META_BUILD,
} from '../lib/cache_attendu.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));

let echecs = 0, indecidables = 0, mesures = 0, zonesJoignables = 0;

const verifie = (titre, ok, detail = '') => {
  if (!ok) echecs++;
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre}${detail ? `\n       ${detail}` : ''}`);
};
const indecis = (titre, pourquoi) => {
  indecidables++;
  console.log(`  ⏸️   ${titre} — INDÉCIDABLE : ${pourquoi}`);
};
const note = (t) => console.log(`  ·    ${t}`);
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));

// ⭐ LE DÉTOURNEMENT DE LA CONTRE-ÉPREUVE. Sans lui, prouver que ce banc rougit
//   sur une page de compte mise en cache exigerait de VRAIMENT mettre une page
//   de compte en cache sur la production. ⛔ On ne fabrique pas la panne qu'on
//   veut interdire sur le site réel : on la fabrique sur un serveur à soi.
const BASE_TEST = process.env.BANC_CACHE_BASE || null;
const baseDe = (zone) => (BASE_TEST ? `${BASE_TEST}/${zone.nom}` : zone.base);

// ⭐ LA PAUSE N'A DE SENS QUE FACE À UN CACHE RÉEL : elle laisse au bord le
//   temps de peupler entre deux frappes. Contre un serveur local elle ne fait
//   qu'allonger la contre-épreuve de plusieurs minutes — et une contre-épreuve
//   lente est une contre-épreuve qu'on finit par ne plus jouer.
// ⛔ Elle n'est raccourcie QUE lorsque les zones sont détournées : sur la
//   production, les 3 passages gardent leur espacement déclaré.
const PAUSE = BASE_TEST ? 0 : PAUSE_MS;

console.log('\n═══ LE CACHE — les DEUX zones Cloudflare ═══');
console.log(`    (méthode ${METHODE}, ${PASSAGES} passages, ${ZONES.length} zones` +
  `, règle ${CACHE_RULE_POSEE ? 'POSÉE ⇒ le HIT est EXIGÉ' : 'PAS ENCORE POSÉE ⇒ le HIT est seulement CONSTATÉ'})`);
if (BASE_TEST) console.log(`    ⚠️  MODE CONTRE-ÉPREUVE — tout est détourné vers ${BASE_TEST}`);

// ═══════════════════════════════════════════════════════════════════════════
// 1. LA DÉCLARATION — le § QUI N'OUVRE PAS LE RÉSEAU
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ C'EST LE SEUL § QUI REND UN VERDICT MÊME HORS LIGNE, et c'est le plus
// important des six. Il ne regarde pas la production : il vérifie que ce qu'on
// demande au banc d'exiger a encore un sens. Une déclaration qui s'est dégradée
// — une route privée retirée « parce qu'elle faisait rougir », un TTL improvisé
// — rendrait tous les autres § verts en ne prouvant plus rien.
console.log('\n1. la déclaration est-elle saine ? (aucun appel réseau)');

verifie('les DEUX zones sont déclarées', ZONES.length === 2,
  ZONES.map((z) => z.nom).join(' · ') + ' — ⛔ une règle par zone, elle ne voyage pas');

verifie('le TTL déclaré est un palier connu de l\'échelle',
  ECHELLE_TTL.includes(TTL_EDGE_S),
  `TTL = ${TTL_EDGE_S} s · échelle = ${ECHELLE_TTL.join(' → ')}`);

verifie('le TTL n\'est pas nul', TTL_EDGE_S > 0,
  '⛔ un TTL à 0 est exactement l\'état d\'aujourd\'hui : la règle ne servirait à rien');

verifie('la tolérance de retard dépasse le TTL', RETARD_TOLERE_S > TTL_EDGE_S,
  `${RETARD_TOLERE_S} s > ${TTL_EDGE_S} s — sinon le § 5 rougirait sur du cache ` +
  'parfaitement normal, et on aurait un banc qui interdit ce qu\'il vient d\'autoriser');

verifie(`${PRIVEES.length} route(s) privée(s) déclarée(s)`, PRIVEES.length >= 8,
  PRIVEES.map((p) => p.chemin).join(' · '));

// ⭐⭐ LE CIRCUIT SE REFERME ICI, ET C'EST LA MOITIÉ QUI MANQUE PRESQUE TOUJOURS.
//   On lit `astro_routes_compte.mjs` COMME UN TEXTE. Le jour où un lot ajoute
//   une route de compte sans venir la déclarer ici, cette ligne rougit — et
//   c'est le seul moment où quelqu'un peut encore l'apprendre avant la fuite.
//   ⛔ Sans ce §, la liste ci-dessus vieillirait exactement comme le plancher
//   resté à 25 : silencieusement, par le simple passage du temps.
{
  let source = null;
  try {
    source = readFileSync(join(ICI, '..', 'lib', 'astro_routes_compte.mjs'), 'utf8');
  } catch (e) {
    indecis('la couverture de ROUTES_COMPTE',
      `\`astro_routes_compte.mjs\` illisible — ${e?.message || e}. ⛔ On ne conclut ` +
      'PAS « couvert » : on dit qu\'on n\'a pas pu regarder.');
  }
  if (source) {
    const declarees = [...source.matchAll(/'(pages\/[^']+)'/g)].map((m) => m[1]);
    verifie('`ROUTES_COMPTE` a bien été lue', declarees.length >= 15,
      `${declarees.length} route(s) trouvée(s) dans le fichier source`);

    const orphelines = declarees.filter(
      (r) => !FAMILLES_COMPTE.some((f) => r.startsWith(f.source)),
    );
    verifie('toute route de compte appartient à une famille déclarée ici',
      orphelines.length === 0,
      orphelines.length
        ? `🔴 ${orphelines.length} route(s) SANS COUVERTURE : ${orphelines.join(' · ')}\n` +
          '       ⇒ ajouter la famille dans `cache_attendu.mjs` ET une adresse dans ' +
          '`PRIVEES`.\n       ⛔ Ne « réparez » pas ce banc en élargissant un motif : ' +
          'une route de compte non réclamée est une porte que personne ne garde.'
        : `${declarees.length} route(s) réparties dans ${FAMILLES_COMPTE.length} famille(s)`);

    // ⭐ Et l'inverse : une famille déclarée qui ne correspond plus à rien est un
    //   avertissement qui a survécu à sa cause — ce projet en a trouvé trois le
    //   même jour. Elle donnerait l'illusion d'une garde qui ne garde plus rien.
    const mortes = FAMILLES_COMPTE.filter((f) => !declarees.some((r) => r.startsWith(f.source)));
    verifie('aucune famille déclarée ne vise une route disparue',
      mortes.length === 0,
      mortes.length
        ? `🟠 ${mortes.map((f) => f.source).join(' · ')} — plus aucune route ne commence ` +
          'ainsi. Une garde qui ne garde plus rien fait croire que quelque chose est gardé.'
        : 'les 7 familles visent toutes au moins une route réelle');

    // ⭐ Chaque famille doit nommer une adresse qui est VRAIMENT dans PRIVEES.
    //   « Est-ce là ? » n'est pas « est-ce que ça marche ? » : on relie les deux
    //   listes au lieu de supposer qu'elles se ressemblent.
    const cheminsPrives = new Set(PRIVEES.map((p) => p.chemin));
    const pendantes = FAMILLES_COMPTE.filter((f) => !cheminsPrives.has(f.couvertPar));
    verifie('chaque famille nomme une adresse réellement réclamée',
      pendantes.length === 0,
      pendantes.length
        ? `🔴 ${pendantes.map((f) => `${f.source} → ${f.couvertPar}`).join(' · ')} — ` +
          'l\'adresse citée n\'est pas dans `PRIVEES` : la famille se croit gardée, ' +
          'et personne ne frappe à sa porte.'
        : 'les 7 familles pointent vers une adresse de `PRIVEES`');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ LE SECOND CIRCUIT, ET C'EST LUI QUI A TROUVÉ LE DÉFAUT DU 11/08.
// ═══════════════════════════════════════════════════════════════════════════
// `astro_features.mjs` EFFACE du site les pages d'une fonctionnalité éteinte.
// Il annonce en tête : « ajouter une fonctionnalité gatée = ajouter une ligne
// ici, rien d'autre ». Le contrat était écrit ; il n'était réclamé par personne.
// 🔴 Résultat mesuré le 11/08/2026 : le lot 104 a ajouté `market`, `favoris` et
//   `dashboard` à `ROUTES_COMPTE`. `/market/` s'est trouvé couvert PAR HASARD
//   (il figure dans la zone « prix »). `/favoris/` et `/dashboard/` ne l'étaient
//   par rien ⇒ `vevewiki.com/favoris/` rendait 200, un talon de redirection vers
//   `/connexion/` qui est un 404 sur ce site. Deux pages fantômes, invisibles :
//   `noindex`, donc absentes de l'index ; sur un wiki, donc jamais visitées.
// ⇒ Ce § est le lecteur qui manquait. Le jour où une route de compte s'ajoute
//   sans venir ici, il rougit — avant le déploiement, pas six lots après.
// ⛔ Ne le « réparez » pas en retirant une adresse de la liste ci-dessous : ce
//   serait débrancher le seul lecteur d'un contrat que personne d'autre ne lit.
{
  let features = null;
  try {
    features = readFileSync(join(ICI, '..', 'lib', 'astro_features.mjs'), 'utf8');
  } catch (e) {
    indecis("l'extinction des pages de compte hors zone membre",
      `\`astro_features.mjs\` illisible — ${e?.message || e}`);
  }
  if (features) {
    // Les préfixes déclarés, toutes zones confondues.
    // 🔴🔴 LOT 157-B — LE MOTIF NE SAVAIT LIRE QU'UN SEUL SEGMENT.
    // `'(\/[a-z0-9-]+\/)'` attrapait `/favoris/` mais PAS `/analytics/market/`.
    // Tant qu'aucune fonctionnalité gatée n'avait de sous-chemin, il disait
    // vrai ; le 157 en a ajouté quatre, et le motif serait devenu un juge qui
    // ne voit pas la moitié des pièces — il aurait déclaré « non éteintes » des
    // adresses parfaitement déclarées dans `astro_features.mjs`.
    // ⭐⭐ ON ÉLARGIT ICI SANS AFFAIBLIR, ET LA NUANCE COMPTE : le § 1 interdit
    // d'élargir un motif pour faire taire un rouge — là, ça masquerait une
    // route non gardée. Ici c'est l'INVERSE : le motif élargi fait VOIR PLUS de
    // préfixes déclarés, donc il rend le contrôle plus exigeant, jamais moins.
    // ⛔ La différence entre les deux : est-ce que le motif décrit ce qu'on
    //    GARDE, ou ce dont on se PLAINT ? Élargir le premier renforce ; élargir
    //    le second aveugle.
    const prefixes = new Set(
      [...features.matchAll(/'(\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/)'/g)].map((m) => m[1]),
    );
    // Les adresses de compte qui sont de VRAIES pages (les `/api/` ne sont
    // jamais émises comme fichiers : elles n'ont rien à éteindre).
    const pagesDeCompte = PRIVEES
      .map((p) => p.chemin)
      .filter((c) => !c.startsWith('/api/') && !/^\/(fr|es|de|en)\//.test(c));
    const nonEteintes = pagesDeCompte.filter((c) => !prefixes.has(c));
    verifie('toute page de compte est ÉTEINTE sur un site sans espace membre',
      nonEteintes.length === 0,
      nonEteintes.length
        ? `🔴 ${nonEteintes.join(' · ')} — absente(s) des préfixes d'\`astro_features.mjs\`.\n` +
          '       ⇒ Sur vevewiki, ces adresses restent ÉMISES : un talon de redirection ' +
          'vers `/connexion/`, qui y est un 404.\n       ⭐ C\'est le défaut du lot 44, ' +
          'reproduit par le lot 104 sur les routes qu\'il ajoutait. Deux écrivains, ' +
          'aucun lecteur.'
        : `${pagesDeCompte.length} page(s) de compte, toutes couvertes par une zone ` +
          `(${prefixes.size} préfixe(s) déclaré(s))`);
  }
}

verifie('les pages publiques sont déclarées PAR ZONE',
  Object.keys(PUBLIQUES_PAR_ZONE).length === ZONES.length &&
  ZONES.every((z) => (PUBLIQUES_PAR_ZONE[z.nom] || []).length >= 2),
  '🔴 mesuré le 11/08 : `/collections/` rend 404 sur vevewiki. Une liste commune ' +
  'aurait fait rougir le banc sur une page qui n\'a jamais existé');

// ⛔ Une adresse ne peut pas être à la fois publique et privée. Ça paraît
//   évident ; c'est exactement le genre d'évidence qui se casse en silence le
//   jour où une page change de camp, et le cache diffuse la conséquence.
{
  const prives = new Set(PRIVEES.map((p) => p.chemin));
  const collision = Object.values(PUBLIQUES_PAR_ZONE).flat()
    .map((p) => p.chemin).filter((c) => prives.has(c));
  verifie('aucune adresse n\'est à la fois publique et privée', collision.length === 0,
    collision.length ? `🔴 ${collision.join(' · ')}` : '');
}

// ═══════════════════════════════════════════════════════════════════════════
// L'OUTILLAGE DE MESURE
// ═══════════════════════════════════════════════════════════════════════════

/** Un GET qui ne lève jamais : il rend soit la réponse, soit la panne. */
async function frappe(url, entetes = {}) {
  const stop = AbortSignal.timeout(DELAI_MS);
  try {
    const r = await fetch(url, {
      method: METHODE, redirect: 'manual', signal: stop,
      headers: { 'cache-control': 'no-cache', ...entetes },
    });
    // ⛔ ON CONSOMME LE CORPS. Un corps non lu laisse la socket ouverte et le
    //   processus ne rend jamais la main — un banc qui ne se termine pas est un
    //   banc muet, et un banc muet se lit comme un banc lent.
    const corps = await r.text().catch(() => '');
    const h = {};
    for (const [k, v] of r.headers) h[k.toLowerCase()] = v;
    mesures++;
    return { ok: true, code: r.status, h, corps };
  } catch (e) {
    mesures++;
    return { ok: false, panne: e?.message || String(e) };
  }
}

/**
 * ⭐⭐ DIT *OÙ* DEUX RÉPONSES DIVERGENT, PAS SEULEMENT *QU'ELLES* DIVERGENT.
 * Écrit après un défaut d'instrument de ce lot même : le harnais recalculait un
 * horodatage à chaque requête, et le banc rendait « 155 vs 155 caractère(s) » —
 * un message VRAI mais qui n'aidait pas à trancher entre « la page personnalise »
 * et « mon serveur de test bouge ». Deux longueurs égales pour deux contenus
 * différents sont l'indice le plus parlant qu'il y avait, et il fallait le lire
 * à la main.
 * ⛔ Un banc qui a raison sans être lisible se fait corriger à la place du défaut.
 */
function ouDiffere(a, b) {
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return '(aucune divergence trouvée)';
  const fenetre = (s) => JSON.stringify(s.slice(Math.max(0, i - 30), i + 40));
  return `première divergence au caractère ${i} :\n       ` +
    `       sans session : …${fenetre(a)}\n       ` +
    `       avec session : …${fenetre(b)}`;
}

const estHit = (r) => String(r.h?.['cf-cache-status'] || '').toUpperCase() === 'HIT';
const cc = (r) => String(r.h?.['cache-control'] || '');
const refuseLeStockage = (r) => /no-store/i.test(cc(r));

// ═══════════════════════════════════════════════════════════════════════════
// 2. LES ROUTES PRIVÉES — la moitié qui coûte cher
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ CE § EST LA RAISON D'ÊTRE DU BANC. Tout le reste peut échouer sans
// conséquence grave ; celui-ci garde la seule chose qu'on ne peut pas réparer
// après coup, parce qu'une page servie l'a été.
console.log(`\n2. ${ZONE_MEMBRE} — les routes privées ne doivent JAMAIS venir du bord`);

const zoneMembre = ZONES.find((z) => z.nom === ZONE_MEMBRE);
if (!zoneMembre) {
  verifie(`la zone « ${ZONE_MEMBRE} » est déclarée`, false,
    '⛔ la zone qui porte l\'espace membre a disparu de `ZONES` — plus personne ' +
    'ne garde les routes privées');
} else {
  let joignable = false;
  for (const route of PRIVEES) {
    const url = baseDe(zoneMembre) + route.chemin;
    const vus = [];
    for (let i = 0; i < PASSAGES; i++) {
      vus.push(await frappe(url));
      await dodo(PAUSE);
    }
    const bons = vus.filter((v) => v.ok);
    if (bons.length === 0) {
      // ⛔ Réseau muet sur cette route : INDÉCIDABLE, jamais vert.
      indecis(`${route.chemin}`,
        `aucun des ${PASSAGES} passages n'a abouti — ${vus[0]?.panne || 'panne inconnue'}`);
      continue;
    }
    joignable = true;

    // ⭐ LE CŒUR : jamais servi depuis le bord. Les passages successifs comptent
    //   double ici — c'est justement à la DEUXIÈME frappe qu'un cache se
    //   trahit. Un seul appel ne pourrait pas voir la différence entre « pas
    //   encore en cache » et « jamais mis en cache ».
    const hits = bons.filter(estHit);
    verifie(`${route.chemin} — jamais \`cf-cache-status: HIT\``, hits.length === 0,
      hits.length
        ? `🔴🔴 ${hits.length}/${bons.length} passage(s) servis DEPUIS LE BORD — ` +
          `${route.quoi}.\n       ⛔⛔ C'est la fuite que ce banc existe pour rendre ` +
          'impossible : cette réponse a été calculée pour quelqu\'un, puis rendue à ' +
          'quelqu\'un d\'autre.\n       ⇒ Retirer la Cache Rule AVANT toute autre ' +
          'analyse, puis purger le cache de la zone.'
        : `${bons.length} passage(s) · ` +
          [...new Set(bons.map((b) => b.h['cf-cache-status'] || '(aucun)'))].join(', '));

    if (route.attendu === 'no-store') {
      const sansStore = bons.filter((b) => !refuseLeStockage(b));
      verifie(`${route.chemin} — la réponse refuse elle-même le stockage`,
        sansStore.length === 0,
        sansStore.length
          ? `🔴 \`cache-control\` = « ${cc(sansStore[0]) || '(absent)'} » — il manque ` +
            '`no-store`.\n       ⭐ Une réponse privée qui ne le dit pas s\'en remet à ' +
            'la politique du cache : elle délègue sa confidentialité à un réglage ' +
            'qui vit ailleurs et peut changer sans nous.'
          : cc(bons[0]));
    } else {
      // 'jamais-hit' — le trou est connu, nommé, daté. On ne le maquille pas en
      // succès : on l'affiche à chaque passage pour qu'il finisse par être réparé.
      note(`${route.chemin} — ⚠️ trou connu : aucun \`cache-control\` servi ` +
        `(« ${cc(bons[0]) || 'absent'} », code ${bons[0].code}). Seul le « jamais HIT » ` +
        'est exigé ici. ⇒ à refermer dans le lot qui touchera cette route.');
    }
  }
  if (joignable) zonesJoignables++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. L'ESPACE MEMBRE N'EXISTE PAS SUR L'AUTRE ZONE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ LE CONTRÔLE INVERSE, CELUI QUI NE COÛTE RIEN. `vevewiki` n'a pas d'espace
// membre — c'est gelé. Mesuré le 11/08 : ces adresses y rendent 404. Le jour où
// l'une d'elles répondrait 200, ce serait qu'un espace membre s'est glissé sur
// un site qui n'en a pas — et le cache le diffuserait avant que quiconque le
// remarque. Un contrôle qui ne regarde que ce qui existe ne voit jamais ce qui
// APPARAÎT.
console.log('\n3. les autres zones n\'ont pas d\'espace membre');
for (const zone of ZONES.filter((z) => z.nom !== ZONE_MEMBRE)) {
  for (const chemin of ABSENTES_HORS_MEMBRE) {
    const r = await frappe(baseDe(zone) + chemin);
    await dodo(PAUSE);
    if (!r.ok) { indecis(`${zone.nom} · ${chemin}`, r.panne); continue; }
    verifie(`${zone.nom} · ${chemin} n'existe pas`, r.code === 404,
      r.code === 404 ? 'code 404' :
        `🔴 code ${r.code} — une route de compte répond sur un site qui n'a pas ` +
        'd\'espace membre. ⛔ Vérifier `access.tiers` et le mode de rendu AVANT ' +
        'de toucher au cache.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. LES PAGES PUBLIQUES — sûres d'abord, en cache ensuite
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ L'ORDRE DE CE § EST SON PROPOS. On ne demande pas d'abord « est-ce en
// cache ? » mais « est-ce que ce serait sûr de le mettre en cache ? ». La fuite
// ne viendra pas du cache : elle viendra du jour où une page publique se mettra
// à personnaliser son contenu — un « Bonjour Preda » dans l'en-tête, un
// `Set-Cookie` d'analytique — et le bord diffusera cette personnalisation au
// visiteur suivant. Ce jour-là, la Cache Rule sera vieille de six mois et
// personne ne fera le lien.
// ⇒ Ces trois contrôles doivent survivre à tous les lots à venir.
console.log('\n4. les pages publiques sont-elles sûres à mettre en cache ?');

for (const zone of ZONES) {
  const pages = PUBLIQUES_PAR_ZONE[zone.nom] || [];
  let joignable = false;

  for (const page of pages) {
    const url = baseDe(zone) + page.chemin;

    // ⭐ LA CONDITION FABRIQUÉE : la même adresse, avec et sans session.
    //   C'est la mesure qui a autorisé tout ce lot le 11/08 (117 733 o
    //   identiques). La rejouer à chaque passage est ce qui la rend durable —
    //   une mesure faite une fois est une phrase ; rejouée, c'est un nombre.
    // ═════════════════════════════════════════════════════════════════════
    // 🔴🔴🔴 DEUX BUILDS DIFFÉRENTS NE SE COMPARENT PAS. (mesuré le 11/08/2026)
    // ═════════════════════════════════════════════════════════════════════
    // CE QUI S'EST PASSÉ. Le run #121 a déclaré :
    //   « vevewiki.com · / — 30278 vs 30278 caractère(s) — cette page
    //     PERSONNALISE son contenu » — première divergence au caractère 2423 :
    //        sans session : build-time content="2026-08-11T15:38:28.044Z"
    //        avec session : build-time content="2026-08-11T17:28:27.045Z"
    // La page ne personnalisait RIEN. Les deux réponses venaient de DEUX BUILDS
    // DIFFÉRENTS : l'une du cache (page de 15:38), l'autre de l'origine
    // (déploiement de 17:28 en cours). Vérifié cache chaud, hors déploiement :
    // 30 405 octets **strictement identiques**, même `build-time`.
    //
    // ⭐⭐⭐ ET LE DANGER N'EST PAS LE ROUGE, C'EST CE QU'IL CONSEILLAIT :
    //   « soit elle sort de `PUBLIQUES_PAR_ZONE` ET de la Cache Rule ».
    //   Le suivre aurait retiré l'accueil de vevewiki du cache — défaisant le
    //   gain du lot A1 — à cause d'un artefact de mesure.
    // ⇒ **Un banc qui NOMME une cause qu'il ne sait pas départager d'une autre
    //   est plus dangereux qu'un banc muet : celui-là, on le suit.**
    //
    // ⛔ LE REMÈDE N'EST PAS D'IGNORER `build-time` DANS LA COMPARAISON. Ce
    //   serait masquer le fait qu'on a comparé deux états, et ça cacherait au
    //   passage toute autre différence liée au build. La mesure n'est pas
    //   bruyante : elle est INVALIDE. On la refait, et si elle reste invalide
    //   on le DIT — c'est le troisième verdict, pas un échec.
    // ⚠️ La CI tourne sur `push` et Coolify construit sur `push` : les deux
    //   COURENT L'UNE CONTRE L'AUTRE PAR CONSTRUCTION. Ce cas n'est pas rare,
    //   il est structurel.
    const buildDe = (corps) => {
      const m = /name="build-time" content="([^"]*)"/.exec(corps || '');
      return m ? m[1] : null;
    };

    let nu = null;
    let avecSession = null;
    let memeBuild = false;
    const ESSAIS = 4;
    for (let essai = 1; essai <= ESSAIS; essai++) {
      nu = await frappe(url);
      await dodo(PAUSE);
      avecSession = await frappe(url, { cookie: 'vp_session=banc-cache-temoin; vp_lang=fr' });
      await dodo(PAUSE);
      if (!nu.ok || !avecSession.ok) break;
      const bn = buildDe(nu.corps);
      const bs = buildDe(avecSession.corps);
      // Une page sans balise `build-time` (fichier statique, 404) n'a pas de
      // build à comparer : la question ne se pose pas, on ne la bloque pas.
      if (bn === bs) { memeBuild = true; break; }
      if (essai < ESSAIS) {
        note(`${zone.nom} · ${page.chemin} — deux builds vus (${bn} / ${bs}), ` +
             `déploiement probablement en cours — nouvelle mesure (${essai}/${ESSAIS - 1})`);
        await dodo(15_000);
      }
    }

    if (!nu.ok || !avecSession.ok) {
      indecis(`${zone.nom} · ${page.chemin}`,
        `illisible — ${nu.panne || avecSession.panne}`);
      continue;
    }
    joignable = true;

    if (!memeBuild) {
      indecis(`${zone.nom} · ${page.chemin} — identique avec et sans session`,
        `les deux réponses viennent de builds DIFFÉRENTS ` +
        `(${buildDe(nu.corps)} / ${buildDe(avecSession.corps)}) après ${ESSAIS} mesures. ` +
        `Un déploiement est en cours : la comparaison n'a pas de sens, et un ` +
        `rouge ici accuserait la page d'une personnalisation qu'elle n'a pas. ` +
        `⇒ rejouer ce banc une fois le déploiement fini.`);
      continue;
    }

    verifie(`${zone.nom} · ${page.chemin} — identique avec et sans session`,
      nu.corps === avecSession.corps && nu.code === avecSession.code,
      nu.corps === avecSession.corps
        ? `${nu.corps.length} caractère(s), codes ${nu.code}/${avecSession.code}`
        : `🔴🔴 ${nu.corps.length} vs ${avecSession.corps.length} caractère(s) — ` +
          `cette page PERSONNALISE son contenu (${page.quoi}).\n       ` +
          ouDiffere(nu.corps, avecSession.corps) +
          '\n       ⛔⛔ Elle ne peut PAS être servie par un cache partagé : la ' +
          'version d\'un membre serait rendue au visiteur suivant.\n       ⇒ Soit la ' +
          'page redevient impersonnelle, soit elle sort de `PUBLIQUES_PAR_ZONE` ET ' +
          'de la Cache Rule.');

    verifie(`${zone.nom} · ${page.chemin} — aucun \`Set-Cookie\``,
      !nu.h['set-cookie'] && !avecSession.h['set-cookie'],
      nu.h['set-cookie'] || avecSession.h['set-cookie']
        ? '🔴 un cookie posé sur une page publique serait servi au visiteur suivant'
        : 'aucun');

    const varys = String(nu.h.vary || '').split(',').map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    const intrus = varys.filter((v) => !VARY_TOLERES.includes(v));
    verifie(`${zone.nom} · ${page.chemin} — \`vary\` sans surprise`, intrus.length === 0,
      intrus.length
        ? `🟠 « ${intrus.join(', ')} » — la réponse varie selon quelque chose que le ` +
          'cache doit prendre en compte. ⛔ Un `vary: cookie` fait exploser le nombre ' +
          'de variantes ; un `vary` oublié fait servir la mauvaise.'
        : varys.join(', ') || '(aucun)');

    // ⭐ ET LE GAIN LUI-MÊME — exigé seulement quand la règle est déclarée posée.
    if (CACHE_RULE_POSEE) {
      // Deux frappes rapprochées : la première peuple, la seconde doit toucher.
      const a = await frappe(url); await dodo(PAUSE);
      const b = await frappe(url); await dodo(PAUSE);
      let frappes = [a, b];
      // ═════════════════════════════════════════════════════════════════════
      // 🆕🟠 LOT 143 — CE CONTRÔLE COURAIT AVEC LA PURGE. 15 ÉCHECS SUR 63.
      // ═════════════════════════════════════════════════════════════════════
      // Les deux workflows partent sur le MÊME `push` : celui-ci demande un
      // HIT pendant que l'autre vide le cache. L'échec était donc réel et sans
      // objet à la fois — et c'est l'INTERMITTENCE qui est dangereuse : on
      // apprend à ne plus lire un rouge qui passe une fois sur quatre, et le
      // jour où il dit vrai on ne le lit pas non plus.
      // ⛔ CE QU'ON NE FAIT PAS : baisser l'exigence, réessayer jusqu'à ce que
      //   ça passe, ou remettre le booléen à `false`. Ce banc est la seule
      //   sentinelle d'une fuite de cache ; l'assouplir pour éteindre un rouge
      //   reviendrait à retirer le détecteur parce qu'il siffle en cuisinant.
      // ⭐⭐⭐ CE QU'ON FAIT : ON SÉPARE DEUX QUESTIONS QUI ÉTAIENT CONFONDUES.
      //   « la règle s'applique-t-elle ? » et « le cache est-il peuplé ? » ne
      //   sont pas la même chose, et le statut de Cloudflare les distingue :
      //     · MISS / EXPIRED / REVALIDATED → la règle S'APPLIQUE, le cache est
      //       simplement vide. C'est exactement ce qu'une purge vient de faire.
      //     · DYNAMIC / BYPASS / rien       → AUCUNE règle ne s'applique. Ça,
      //       c'est la panne, et elle reste un ÉCART.
      //   Mesuré le 12/08 en production : `/sets/` sans paramètre rend MISS
      //   puis HIT six secondes plus tard ; `/market/`, qui n'est pas cachée,
      //   rend DYNAMIC. Les deux familles ne se confondent pas.
      // ⚠️ ET L'INDÉCIDABLE NE DOIT PAS S'INSTALLER : on frappe une troisième
      //   fois, après une pause plus longue. Un cache qui se repeuple a touché
      //   au troisième coup ; s'il n'a toujours pas touché, ce n'est plus une
      //   course, et on le dit sans trancher la cause.
      const REPEUPLE = ['MISS', 'EXPIRED', 'REVALIDATED'];
      const statutDe = (r) => String(r.h?.['cf-cache-status'] || '').toUpperCase();
      if (!frappes.some((r) => r.ok && estHit(r))
          && frappes.filter((r) => r.ok).every((r) => REPEUPLE.includes(statutDe(r)))) {
        // ⚠️ LA PAUSE NORMALE SUFFIT, ET C'EST MESURÉ. Ce délai n'est pas un
        // temps de propagation : la frappe précédente a déjà peuplé le bord,
        // il faut seulement une requête DE PLUS pour le constater. Une attente
        // de six secondes par cible ajoutait plus d'une minute au banc pour
        // rien — un banc qu'on n'ose plus lancer ne mesure rien non plus.
        await dodo(PAUSE);
        frappes = frappes.concat([await frappe(url)]);
      }
      const statuts = frappes.filter((r) => r.ok).map((r) => r.h['cf-cache-status'] || '(aucun)');
      const touche = frappes.some((r) => r.ok && estHit(r));
      const repeuplement = !touche
        && frappes.filter((r) => r.ok).length > 0
        && frappes.filter((r) => r.ok).every((r) => REPEUPLE.includes(statutDe(r)));
      if (repeuplement) {
        indecis(`${zone.nom} · ${page.chemin} — servie depuis le bord`,
          `statuts vus : ${statuts.join(', ')} — la règle s'applique (aucun DYNAMIC) mais le ` +
          'cache est vide sur les trois frappes. ⇒ une purge vient de passer, ou cette adresse ' +
          'ne reçoit pas assez de trafic pour rester chaude. ⛔ Ce n\'est PAS un vert : ' +
          'le gain n\'a pas été mesuré ici.');
      } else {
        verifie(`${zone.nom} · ${page.chemin} — servie depuis le bord`, touche,
          `statuts vus : ${statuts.join(', ')}` +
          (touche ? '' :
            '\n       🔴 `CACHE_RULE_POSEE = true` et le bord répond sans que la règle ' +
            's\'applique (statut hors MISS/EXPIRED/REVALIDATED). ⇒ soit la règle a été ' +
            'retirée ou désactivée, soit elle ne couvre pas cette adresse.\n' +
            '       ⛔ Ne « réparez » pas ce banc en remettant le booléen à `false` : ' +
            'ce serait éteindre le témoin au lieu de rallumer la règle.'));
      }
    } else {
      const enCache = estHit(nu);
      note(`${zone.nom} · ${page.chemin} — ${nu.h['cf-cache-status'] || '(aucun statut)'}` +
        (enCache
          ? ' ⚠️ DÉJÀ en cache alors que `CACHE_RULE_POSEE = false` : quelqu\'un a posé ' +
            'la règle sans basculer le booléen. ⇒ le basculer MAINTENANT, sinon plus ' +
            'personne ne surveille cette règle.'
          : ' — attendu tant que la règle n\'est pas posée.'));
    }
  }
  if (joignable) zonesJoignables++;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. LA FRAÎCHEUR — ce que le visiteur voit est-il ce qu'on a déployé ? (P35)
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 CETTE QUESTION EST INDÉCIDABLE AUJOURD'HUI, ET LE CACHE LA REND CENTRALE.
// Le 11/08, un déploiement déclaré ÉCHOUÉ tournait, et deux versions servaient
// en parallèle. Avec un cache au bord, le même incident devient invisible : le
// bord continue de servir l'ancienne page pendant que l'origine sert la neuve,
// et six `curl` identiques ne prouvent rien.
// ⇒ La sonde porte l'horodatage du build ; l'accueil le porte aussi dans son
//   `<meta name="build-time">`. Les comparer répond enfin à « quelle version
//   voit un visiteur ? ».
console.log('\n5. la fraîcheur de ce qui est servi (P35)');

for (const zone of ZONES) {
  const s = await frappe(baseDe(zone) + SONDE);
  await dodo(PAUSE);
  if (!s.ok) { indecis(`${zone.nom} · sonde`, s.panne); continue; }

  let sonde = null;
  try { sonde = JSON.parse(s.corps); } catch { /* pas du JSON */ }
  if (!sonde) {
    indecis(`${zone.nom} · sonde`,
      'réponse illisible en JSON — ⛔ on ne conclut pas « pas de SHA », on dit ' +
      'qu\'on n\'a pas pu lire.');
    continue;
  }

  // ⛔ INCONNU ≠ ZÉRO. Une sonde sans horodatage rend INDÉCIDABLE, pas ÉCART :
  //   le lot qui pose ce champ peut ne pas être encore déployé.
  if (!sonde.build) {
    indecis(`${zone.nom} · fraîcheur`,
      'la sonde ne porte pas encore `build` — ⇒ ce lot n\'est pas déployé sur cette ' +
      'zone. Rejouer après déploiement. ⭐ Tant que ce champ manque, « quelle version ' +
      'voit un visiteur ? » reste sans réponse.');
    if (!sonde.commit) {
      note(`${zone.nom} · \`commit\` absent lui aussi — le constructeur ne passe pas ` +
        'de SHA. ⭐ INCONNU ≠ ZÉRO : ce n\'est pas un écart, c\'est une mesure ' +
        'manquante, et elle est écrite comme telle.');
    }
    continue;
  }

  const page = await frappe(baseDe(zone) + '/');
  await dodo(PAUSE);
  if (!page.ok) { indecis(`${zone.nom} · accueil`, page.panne); continue; }

  const m = page.corps.match(
    new RegExp(`<meta[^>]+name=["']${META_BUILD}["'][^>]+content=["']([^"']+)["']`, 'i'),
  );
  if (!m) {
    indecis(`${zone.nom} · fraîcheur`,
      `aucun \`<meta name="${META_BUILD}">\` sur l'accueil — la comparaison est ` +
      'impossible, pas fausse.');
    continue;
  }

  const tPage = Date.parse(m[1]);
  const tSonde = Date.parse(sonde.build);
  if (Number.isNaN(tPage) || Number.isNaN(tSonde)) {
    indecis(`${zone.nom} · fraîcheur`,
      `dates illisibles (page « ${m[1]} », sonde « ${sonde.build} »)`);
    continue;
  }

  const ecart = Math.round(Math.abs(tSonde - tPage) / 1000);
  verifie(`${zone.nom} — la page servie et la sonde parlent du même build`,
    ecart <= RETARD_TOLERE_S,
    ecart <= RETARD_TOLERE_S
      ? `écart ${ecart} s (toléré ${RETARD_TOLERE_S} s) · sonde ${sonde.build}` +
        (sonde.commit ? ` · commit ${String(sonde.commit).slice(0, 8)}` : ' · commit inconnu')
      : `🔴🔴 écart ${ecart} s — bien au-delà du TTL de ${TTL_EDGE_S} s.\n` +
        `       page : ${m[1]}\n       sonde : ${sonde.build}\n` +
        '       ⇒ Ce n\'est plus du cache, c\'est un déploiement qui n\'atteint pas les ' +
        'visiteurs. ⛔ Premier réflexe : `docker ps -a` sur le VPS — le 11/08, deux ' +
        'versions servaient en parallèle après un `rolling_update` déclaré échoué.');
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. AUTO-CONTRÔLE — un banc qui n'a rien inspecté ne prouve rien
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ UN BANC SE JUGE SUR CE QU'IL LAISSE PASSER. Sans ce §, une panne DNS
// rendrait 0 mesure, 0 échec, et un « ✅ tout est vert » parfaitement faux — le
// pire des trois verdicts, parce qu'il est rassurant.
console.log('\n6. auto-contrôle');
note(`${mesures} requête(s) émise(s) · ${zonesJoignables} groupe(s) de cibles joint(s)`);
note(`règle déclarée ${CACHE_RULE_POSEE ? 'POSÉE' : 'NON POSÉE'} · TTL ${TTL_EDGE_S} s · ` +
  `${PRIVEES.length} route(s) privée(s) gardée(s)`);

if (zonesJoignables === 0) {
  console.log('\n⏸️  INDÉCIDABLE — aucune cible n\'a répondu.');
  console.log('    ⛔ Ce banc NE SE DÉCLARE PAS VERT sans mesure. Il ne dit pas « le');
  console.log('       cache est correct », il dit « je n\'ai pas pu regarder ».');
  console.log('       Rejouer quand le réseau revient ; sortie 2, pas 0.');
  process.exit(2);
}

if (echecs) {
  console.log(`\n❌ ${echecs} ecart(s)` +
    (indecidables ? ` · ⏸️ ${indecidables} indécidable(s)` : ''));
  console.log('   ⛔ La Cache Rule vit dans CLOUDFLARE (Zone → Caching → Cache Rules),');
  console.log('      PAS dans ce dépôt. Une règle par zone, elle ne voyage pas.');
  console.log('   ⛔⛔ Si l\'écart porte sur une ROUTE PRIVÉE servie depuis le bord :');
  console.log('      retirer la règle et purger la zone AVANT toute autre analyse.');
  console.log('   ⛔ Ne « réparez » jamais ce banc en retirant une route de `PRIVEES`');
  console.log('      ni en remettant `CACHE_RULE_POSEE` à `false` : ce serait éteindre');
  console.log('      le témoin à la place de réparer ce qu\'il signale.');
  process.exit(1);
}

if (indecidables) {
  console.log(`\n⏸️  ${indecidables} point(s) non mesuré(s) — aucun écart sur le reste.`);
  console.log('    ⭐ Ce banc dit ce qu\'il n\'a PAS regardé plutôt que de le combler');
  console.log('       par une impression. Sortie 0 : rien de faux n\'a été mesuré.');
}

console.log(indecidables ? '\n✅ conforme sur tout ce qui a pu être mesuré'
  : '\n✅ tout est vert');
process.exit(0);
