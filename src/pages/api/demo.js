// ⚠️ VeVePreda/veve-sites — src/pages/api/demo.js  (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LA PORTE DE LA DÉMONSTRATION — elle n'existe que si on lui a donné une clé.
// ═══════════════════════════════════════════════════════════════════════════
//   /api/demo?cle=<DEMO_CLE>&palier=crevette   → pose le jeton, va au compte
//   /api/demo?cle=<DEMO_CLE>&sortir=1          → retire le jeton
//
// ⭐ LITTERAL, ET C'EST LE POINT. Astro exige que `prerender` soit
// statiquement analysable ; une EXPRESSION n'est pas evaluee et retombe
// silencieusement sur `true`. La valeur reelle est posee par l'integration
// `veve:routes-compte` (engine/lib/astro_routes_compte.mjs) selon le mode du
// manifeste. `true` ici est le defaut SUR : sans adaptateur, un build static
// ne peut pas rendre cette route a la demande.
// 🔴 L'OUBLIER ICI PRÉ-GÉNÉRERAIT LA PORTE EN SILENCE : elle deviendrait un
// fichier figé, incapable de poser un cookie — exactement la panne que le lot
// 24 a payée sur `/api/deconnexion`, et qu'on ne repaiera pas.
export const prerender = true;

import { PALIERS } from '../../../engine/lib/access.mjs';
import { acces } from '../../../engine/lib/access.mjs';
import { COOKIE_DEMO, demoDisponible, emettre, optionsCookie } from '../../../engine/lib/demo_session.mjs';

// ⭐⭐ TOUT REFUS REND 404, JAMAIS 403.
// Un 403 dit « cette route existe, et ta clé est fausse » — il transforme une
// URL inconnue en cible connue. Un 404 ne dit rien du tout. La différence ne
// coûte rien à écrire et elle retire l'endpoint de la carte de quiconque le
// sonde au hasard.
const introuvable = () => new Response('Not found', {
  status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
});

export async function GET(context) {
  const env = context.locals?.runtime?.env;

  // Règles 2 et 3 de `demo_session.mjs` : pas de clé, ou un vrai service de
  // session configuré ⇒ la route n'existe pas. Pas « répond non » : n'existe pas.
  if (!demoDisponible(env)) return introuvable();

  const u = new URL(context.request.url);
  const fournie = u.searchParams.get('cle') || '';
  const attendue = String(env?.DEMO_CLE || process.env.DEMO_CLE || '').trim();

  // ⚠️ On compare des LONGUEURS d'abord puis la valeur ; `emettre()` refera le
  // travail de fond. Ici la comparaison est franche : une clé d'URL est déjà
  // dans les journaux du serveur, le temps de réponse n'est pas son secret le
  // plus fragile. ⭐ Ce qui protège vraiment, c'est qu'elle ne soit pas devinable.
  if (!fournie || fournie !== attendue) return introuvable();

  const secure = u.protocol === 'https:';

  // ── SORTIR ────────────────────────────────────────────────────────────────
  if (u.searchParams.get('sortir')) {
    context.cookies.delete(COOKIE_DEMO, { path: '/' });
    return new Response(null, { status: 302, headers: { location: '/compte/', 'cache-control': 'no-store' } });
  }

  // ── ENTRER ────────────────────────────────────────────────────────────────
  const demande = u.searchParams.get('palier') || 'crevette';

  // ⛔ ON NE DONNE QUE CE QUE LE SITE DÉCLARE. Poser `whale` sur un site dont
  // `access.tiers` ne connaît pas ce palier fabriquerait un jeton que
  // `palierVisiteur()` ramènerait à `visitor` — un jeton valide qui ne sert à
  // rien est pire qu'un refus : on le croit posé et on cherche ailleurs.
  const { tiers } = acces();
  if (!PALIERS.includes(demande) || !tiers.includes(demande)) {
    return new Response(
      `Palier « ${demande} » inconnu de ce site.\nDeclares dans access.tiers : ${tiers.join(', ')}\n`,
      { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
    );
  }

  const jeton = emettre(demande, env);
  if (!jeton) return introuvable();

  context.cookies.set(COOKIE_DEMO, jeton, optionsCookie(secure));

  // ⚠️ `no-store` ET PAS SEULEMENT SUR LA PAGE D'APRÈS. Une redirection mise en
  // cache par un intermédiaire rejouerait la pose du cookie pour le suivant.
  return new Response(null, {
    status: 302,
    headers: { location: '/compte/', 'cache-control': 'no-store', vary: 'cookie' },
  });
}
