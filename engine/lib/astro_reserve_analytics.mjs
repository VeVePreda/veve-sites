// ⚠️ VeVePreda/veve-sites — engine/lib/astro_reserve_analytics.mjs  (NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// L'intégration qui écrit les dérivés du grand livre dans `.reserve/analytics/`
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ POURQUOI UNE INTÉGRATION ET PAS LE FRONTMATTER D'UNE PAGE.
// Écrire la réserve depuis `Analytics.astro` marcherait — et lierait la
// production de la donnée à l'existence d'une page. Le jour où la page change
// de nom, la réserve cesse d'être écrite, l'API sert du vide, et le build reste
// vert. C'est exactement la forme des pannes qu'on paie ici depuis une semaine.
//
// ⭐ `astro:build:done` et pas `build:start` : aucune page ne lit ces données
// (elles sont toutes derrière le mur). Les écrire après le rendu évite de
// retarder le build de 447 pages pour cinq fichiers que personne n'attend.
//
// ⛔ ET ELLE NE TOURNE QU'EN MODE `server`. En static il n'y a pas de serveur,
// donc pas de session, donc personne à qui servir ces fichiers : les écrire
// ferait grossir l'image d'un contenu que rien ne peut lire — et le
// `COPY /app/.reserve` du Dockerfile les emporterait quand même.

import { ecrire } from './reserve_analytics.mjs';

export default function reserveAnalytics(mode) {
  const serveur = mode === 'server';
  return {
    name: 'veve:reserve-analytics',
    hooks: {
      'astro:build:done': async ({ logger }) => {
        if (!serveur) {
          logger.info('mode static : aucun module abonné à écrire (pas de session possible).');
          return;
        }
        try {
          const r = await ecrire();
          if (!r.off) logger.info(`réserve analytics écrite (${r.ecrits} fichiers), hors de dist/.`);
        } catch (e) {
          // ⛔ ON NE LAISSE PAS PASSER EN SILENCE, ET ON NE TUE PAS LE BUILD.
          // ⭐ La nuance est la même que celle du repli N-1 de `warehouse.mjs` :
          // le site doit continuer à se déployer si l'entrepôt est injoignable
          // — les 447 pages publiques ne dépendent pas de ces cinq fichiers.
          // Mais le Dockerfile, lui, REFUSE une réserve vide en mode server :
          // c'est là que l'échec devient fatal, au bon endroit.
          logger.error(`réserve analytics NON écrite : ${e.message}`);
          logger.error('les modules abonnés d\'Analytics répondront « indisponible ».');
        }
      },
    },
  };
}
