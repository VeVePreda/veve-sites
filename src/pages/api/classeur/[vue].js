// ⚠️ VeVePreda/veve-sites — src/pages/api/classeur/[vue].js  (NEUF — lot 224)
// ═══════════════════════════════════════════════════════════════════════════
// LE CLASSEUR — trois vues, une porte, servies à la demande
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 SANS `getStaticPaths()`, LE BUILD DE vevewiki CASSE — « GetStaticPathsRequired »,
// mesuré au lot 27 sur `/api/historique/[uuid]`, même cause.
// ⭐ ET LA RÉPONSE HONNÊTE EST « AUCUN ». En static il n'y a pas de serveur,
// donc pas de session : ces vues n'ont pas de sens. ⛔ NE PAS y mettre la liste
// des vues « pour que ça marche aussi en static » : ça écrirait dans `dist/`
// un JSON par vue, servi en clair par nginx à qui connaît l'adresse.
export function getStaticPaths() { return []; }

// ⭐ LITTÉRAL, ET C'EST LE POINT. Astro exige que `prerender` soit statiquement
// analysable ; une EXPRESSION retombe silencieusement sur `true`. La valeur
// réelle est posée par l'intégration `veve:routes-compte`.
export const prerender = true;

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CLASSEUR_DIR, SANS_DETENTEUR } from '../../../../engine/lib/classeur.mjs';
import { connecte } from '../../../../engine/lib/access.mjs';

const ENTETES = {
  'content-type': 'application/json; charset=utf-8',
  // 🔐 `private, no-store` + `vary: cookie` : la réponse dépend de la session,
  // et rien — ni nginx, ni Cloudflare — ne doit la garder. ⚠️ Ça ne SUFFIT
  // pas : Cloudflare décide en dernier et une Cache Rule peut passer outre.
  // C'est pour ça que l'exclusion de `/api/` côté bord est un point de la
  // liste de Preda, pas une propriété de ce fichier.
  'cache-control': 'private, no-store',
  'vary': 'cookie',
  'x-content-type-options': 'nosniff',
};

// ⛔ LE CORPS D'UN REFUS NE DIT JAMAIS CE QU'IL REFUSE. « vue inconnue » et
// « pas connecté » doivent se ressembler vus du dehors, sinon la route devient
// un oracle. Même forme que `/api/analytics/[module]`.
const refus = (code, cle) =>
  new Response(JSON.stringify({ ok: false, erreur: cle }), { status: code, headers: ENTETES });
const ok = (o) =>
  new Response(typeof o === 'string' ? o : JSON.stringify(o), { status: 200, headers: ENTETES });

// Les deux listes blanches. ⚠️ `params.vue`, `uuid` et `adresse` composent tous
// les trois un CHEMIN DE FICHIER ou une clé d'objet : sans liste blanche,
// `..%2f..%2fsites%2fveveprice%2fmanifest.yml` lit ce qu'il veut.
// ⛔ Ne jamais « nettoyer » un paramètre : une liste noire se contourne.
const RE_UUID = /^[0-9a-f-]{8,64}$/i;
const RE_ADRESSE = /^0x[0-9a-fA-F]{40}$/;

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LES DEUX DICTIONNAIRES SONT LUS UNE FOIS ET GARDÉS — ~31 Mo DE RSS
// ═══════════════════════════════════════════════════════════════════════════
// `pieces/<uuid>.json` ne porte que des NUMÉROS de portefeuille : c'est ce qui
// fait passer ce découpage de 554 Mo à 155 Mo (mesuré le 04/09). Le prix de ce
// gain est ici : pour rendre une adresse, il faut le dictionnaire.
//
// ⭐ LECTURE PARESSEUSE, ET ELLE N'EST PAS DÉCORATIVE. Le serveur démarre sans
// ces 31 Mo ; ils n'arrivent qu'à la PREMIÈRE demande de Mint Hunter. Un site
// dont personne n'ouvre le classeur ne les paie jamais.
// ⛔ NE PAS relire le fichier à chaque requête : 30 Mo de `JSON.parse` par
// appel mettrait le serveur à genoux, et ce serait invisible en bac à sable où
// le fichier fait quelques kilo-octets.
// ⚠️ CE CACHE VIT DANS LE PROCESSUS. Un redéploiement le jette avec le reste,
// donc il ne peut pas servir l'index d'un build précédent — la panne que
// `rmSync` évite au build est ici évitée par construction.
let _adresses = null;
let _uuids = null;
const lire = (nom) => {
  const f = join(CLASSEUR_DIR, `${nom}.json`);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
};
const adresses = () => (_adresses ||= lire('adresses'));
const uuids = () => (_uuids ||= lire('uuids'));

export async function GET({ params, request, locals }) {
  const vue = String(params.vue || '');

  // ⭐⭐ LA PORTE EST `connecte()`, PAS `franchit()`, ET C'EST UN ARBITRAGE.
  // Preda, 04/09 : les DEUX vues sont réservées aux MEMBRES, sans distinction
  // de palier. `connecte()` répond « qui es-tu », `franchit()` répond « à quoi
  // as-tu droit » — les confondre produit les élévations de privilège dans les
  // deux sens. Ici la question est bien la première.
  // ⚠️ Ce n'est pas le choix le plus rentable en SEO et c'est délibéré : Preda
  // a préféré une porte unique à un troisième mur à tenir. À rouvrir un jour
  // SUR MESURE — jamais par glissement.
  // 🔴 ET LE CONTRÔLE EST AVANT TOUTE LECTURE DE DISQUE. Le faire après
  // marcherait aussi, et laisserait la porte ouverte au premier `return` mal
  // placé ajouté plus tard.
  if (!connecte(locals)) return refus(401, 'session');

  const url = new URL(request.url);

  // ── LA FRAÎCHEUR ─────────────────────────────────────────────────────────
  // ⏰ Servie comme une vue à part entière, parce que les deux gabarits en ont
  // besoin et qu'un chiffre sans date n'est pas vérifiable. La fenêtre va de
  // J‑1 à J‑8 : `analytics.yml` court après `ledger-writer.yml` (cron hebdo,
  // jeudi 22 h UTC). ⛔ Ne pas l'arrondir à « hier ».
  if (vue === 'meta') {
    const m = lire('meta');
    return m ? ok(m) : refus(503, 'reserve');
  }

  // ── MINT HUNTER : tous les numéros d'une pièce ────────────────────────────
  if (vue === 'piece') {
    const uuid = url.searchParams.get('uuid') || '';
    if (!RE_UUID.test(uuid)) return refus(400, 'uuid');
    const f = join(CLASSEUR_DIR, 'pieces', `${uuid}.json`);
    // ⚠️ 404 ET PAS 503 ICI : la réserve peut être écrite et cette pièce ne pas
    // y être — 9 354 fiches publiées pour 19 485 pièces au grand livre. C'est
    // un état NORMAL de plus d'une pièce sur deux, pas une panne.
    if (!existsSync(f)) return refus(existsSync(CLASSEUR_DIR) ? 404 : 503, 'absent');
    const brut = JSON.parse(readFileSync(f, 'utf8'));
    const ad = adresses();
    if (!ad) return refus(503, 'reserve');
    // ⚖️ LES NON DÉTENUES SORTENT AVEC `holder: null`, ET ELLES SORTENT.
    // Arbitrage Preda du 04/09 : affichées, INDISTINCTES. Ni omises — ce qui
    // trouerait la séquence et démentirait « tous les numéros » —, ni
    // étiquetées brûlée/stock, qui n'est pas reconstituable depuis la source.
    // ⛔ Le gabarit doit écrire « non détenue », JAMAIS « brûlée ».
    return ok({
      ok: true, uuid,
      editions: brut.map(([ed, iw, li]) => ({
        edition: ed,
        holder: iw === SANS_DETENTEUR ? null : (ad[iw] || null),
        listed: li === 1,
      })),
    });
  }

  // ── L'INVENTAIRE : tout ce que détient un portefeuille ────────────────────
  if (vue === 'wallet') {
    const a = url.searchParams.get('adresse') || '';
    if (!RE_ADRESSE.test(a)) return refus(400, 'adresse');
    // ⭐ LE FRAGMENT SE DÉDUIT DE L'ADRESSE, il ne se cherche pas : `h[2:4]`,
    // 256 fragments. ⛔ PAS `h[0:2]` — toutes les adresses commencent par `0x`,
    // et ce découpage-là rend UN fragment de 10,6 M de lignes. Le piège est
    // écrit ici parce qu'il a été commis, dans le design de ce lot.
    const cle = a.slice(2, 4).toLowerCase();
    const f = join(CLASSEUR_DIR, 'wallets', `${cle}.json`);
    if (!existsSync(f)) return refus(503, 'reserve');
    const frag = JSON.parse(readFileSync(f, 'utf8'));
    // ⚠️ LA CASSE. Les adresses arrivent en minuscules du grand livre, et un
    // membre colle volontiers une adresse en casse mixte (checksum EIP-55).
    // Sans ce repli, un inventaire parfaitement rempli sortirait VIDE, avec un
    // 200 — la pire des réponses : elle a l'air juste.
    const lignes = frag[a] || frag[a.toLowerCase()] || null;
    // ⭐ `null` ET PAS 404 : « ce portefeuille ne détient rien » est une
    // réponse VRAIE, et le gabarit doit pouvoir la distinguer de « je n'ai pas
    // pu regarder ». 709 450 portefeuilles sont indexés ; une adresse valide
    // absente du fragment est simplement vide.
    const us = uuids();
    if (!us) return refus(503, 'reserve');
    return ok({
      ok: true, adresse: a, detient: lignes !== null,
      pieces: (lignes || []).map(([iu, ed, li]) => ({
        uuid: us[iu] || null, edition: ed, listed: li === 1,
      })),
    });
  }

  return refus(404, 'vue');
}
