// ⚠️ VeVePreda/veve-sites — engine/lib/astro_extremes.mjs  (FICHIER NEUF — lot 157)
// ═══════════════════════════════════════════════════════════════════════════
// L'intégration qui dépose le classement d'amplitude dans `.reserve/`
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ POURQUOI UNE INTÉGRATION ET PAS LE FRONTMATTER D'UNE PAGE — c'est le même
// raisonnement que `astro_reserve_analytics.mjs`, et il vaut d'être relu :
// écrire depuis `AnalyticsSujet.astro` marcherait, et lierait la PRODUCTION de
// la donnée à l'EXISTENCE d'une page. Le jour où la page change de nom, le
// fichier cesse d'être écrit, la page lève à la première visite d'un membre,
// et le build reste vert.
//
// ⭐⭐ ET SURTOUT : c'est ICI que `dataset()` a le droit d'être appelé. Au
// build il est déjà en mémoire, l'appel est gratuit. Dans une route rendue à
// la demande il coûte **10 328 ms** (mesuré au lot 125). Toute la conception
// de ce lot tient dans ce déplacement d'un appel d'un endroit à l'autre.
// ⛔ NE JAMAIS importer `dataset.mjs` depuis `extremes.mjs` : ce module-là est
//    importé par une route, et `test:marche` — à raison — refuse un
//    `dataset()` atteignable depuis `ROUTES_COMPTE`.
//
// ⭐ `astro:build:done` et pas `build:start` : le classement se calcule sur le
// jeu PROJETÉ, celui que les pages viennent d'utiliser. Le faire avant
// obligerait à charger `dataset()` deux fois.
//
// ⛔ ELLE TOURNE DANS LES DEUX MODES, CONTRAIREMENT À `reserveAnalytics`, et la
//    différence est réelle : la réserve du grand livre ne sert QU'À des
//    routes de session (inutile en static), alors que ce classement est lu par
//    `/analytics/market/` — laquelle est PRÉ-GÉNÉRÉE en mode static
//    (`astro_routes_compte.mjs` le fait exprès). Ne pas l'écrire là-bas ferait
//    LEVER le build de vevewiki. ⚠️ C'est exactement le genre d'asymétrie qui
//    se paie en « ça marche sur un site et pas sur l'autre ».

import { dataset } from './dataset.mjs';
import { coteFermee } from './cote.mjs';
import { deposerExtremes } from './extremes.mjs';
import { manifest } from './manifest.mjs';
// 🖥️ La sonde mémoire — elle OBSERVE, elle ne pilote rien (voir memoire.mjs).
import * as memoire from './memoire.mjs';

export default function extremes() {
  return {
    name: 'veve:extremes',
    hooks: {
      'astro:build:done': async ({ logger }) => {
        try {
          const ds = await dataset();
          // 🔢 Le plafond d'amplitude vient du MANIFESTE, pas du code : les
          //   deux sites n'ont pas le meme catalogue, et le jour ou l'amont
          //   sera propre il se desactive sans toucher a une ligne de calcul.
          const r = deposerExtremes(ds, coteFermee(), manifest().public?.amplitude_max);
          logger.info(`classement d'amplitude déposé : ${r.lignes.length} ligne(s), hors de dist/.`);
        } catch (e) {
          // ⛔ ON NE TUE PAS LE BUILD, ET ON NE PASSE PAS EN SILENCE — même
          // nuance que `reserveAnalytics`. Les 12 945 pages publiques ne
          // dépendent pas de ce fichier ; `/analytics/market/` si, et elle
          // LÈVERA en le disant. ⭐ Une page réservée qui explose est moins
          // grave qu'un site entier qui ne se déploie plus — mais elle doit
          // laisser une trace ICI, dans le journal de build, avant le
          // déploiement et pas après.
          logger.error(`classement d'amplitude NON déposé : ${e.message}`);
          logger.error('/analytics/market/ lèvera à la première visite d\'un membre.');
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🖥️🔑 LE DERNIER JALON MÉMOIRE DU BUILD — LOT 176, ET SA PLACE EST TOUT
        // ═══════════════════════════════════════════════════════════════════
        // Le lot 175 a fait sortir le pic par `/api/sante`. Lu sur la prod le
        // 21/08 : **1 774 Mo, dont 1 567 de tas, sur un plafond de 3 120** —
        // et **85 Mo seulement de hors-tas**, ce qui ÉCARTE le chantier des
        // tampons et du gzip. Mais ce chiffre est celui du **début** du
        // prerender : les trois builds morts sont tombés PENDANT, sur les
        // 3 097 pages qui suivent. On mesurait le départ de la course, pas son
        // sommet.
        //
        // ⭐⭐⭐ CE HOOK EST LE DERNIER À S'EXÉCUTER DE TOUT LE BUILD :
        // `extremes()` est la dernière intégration d'`astro.config.mjs`
        // (l. 84) et `astro:build:done` tombe après le prerender complet.
        // C'est le seul endroit d'où l'on puisse dire ce que les pages ont
        // coûté.
        // ⛔ SI QUELQU'UN AJOUTE UNE INTÉGRATION APRÈS `extremes()`, ce jalon
        //   cesse d'être le dernier — sans rien casser et sans que rien ne le
        //   dise. C'est écrit ici pour que ce soit lu là.
        //
        // ⭐ HORS DU `try` ci-dessus, et délibérément : un build qui a rendu
        //   ses 3 097 pages puis raté son classement a quand même consommé sa
        //   mémoire, et c'est cette mémoire-là qu'on cherche.
        // ⚠️ ET ÇA NE SAUVE TOUJOURS PAS LE CAS DE LA MORT : un build tué
        //   n'atteint pas ce hook, ne produit pas d'image, donc pas de
        //   fichier. On apprend ce que coûte un build SAIN — c'est la
        //   référence qui manque pour juger si la marge est mince.
        // ⛔ Jamais bloquant : l'instrument ne casse pas ce qu'il observe.
        try {
          memoire.jalon('BUILD FINI — le prerender est passé');
        } catch { /* une sonde ne fait pas échouer un déploiement */ }
      },
    },
  };
}
