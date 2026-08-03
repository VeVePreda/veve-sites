// =============================================================================
//  astro_features.mjs — l'intégration Astro qui EFFACE les pages d'une
//  fonctionnalité désactivée par le manifeste.
//  ⚠️ VeVePreda/veve-sites — engine/lib/astro_features.mjs
//
//  LE PROBLÈME (audit SEO du 27/07/2026, « 3 pages fantômes »)
//  -----------------------------------------------------------------------------
//  Les routes de PRIX se coupent déjà toutes seules quand le site n'en publie
//  pas (`priceEnabled()` faux, cf. features.mjs) :
//    • version localisée `[locale]/movers.astro` -> `getStaticPaths()` rend []
//      -> AUCUNE page émise. Parfait.
//    • version racine `movers.astro` -> route STATIQUE, donc SANS
//      `getStaticPaths` : Astro la construit TOUJOURS, et le `Astro.redirect('/')`
//      y devient un talon `<meta http-equiv="refresh">`.
//  (Recit du 31/07/2026. `/rarity/` a depuis ete SUPPRIMEE du moteur — lot 34 —
//   et ne figure donc plus dans les prefixes ci-dessous.)
//  D'où, sur vevewiki, trois pages `/collections/`, `/movers/`, `/rarity/` sans
//  <html lang>, sans viewport, sans description, sans h1 — et toutes le même
//  <title> « Redirecting to: / ». Elles étaient en `noindex`, donc invisibles
//  dans l'index, mais elles restaient : du budget d'exploration dépensé pour
//  rien, et un audit rouge en permanence.
//
//  ⭐ LA LEÇON : une page ne se retire pas d'un site en la redirigeant.
//     Tant qu'elle est ÉMISE, elle existe. Il faut qu'elle ne soit pas écrite.
//
//  LE CHOIX
//  -----------------------------------------------------------------------------
//  Astro n'offre pas (encore) de moyen déclaratif d'annuler une route statique :
//  `astro:routes:resolved` est informatif, et `getStaticPaths` n'existe que sur
//  les routes dynamiques. On nettoie donc à `astro:build:done`, avec DEUX
//  garde-fous pour que ce ne soit jamais destructeur :
//    1. on ne regarde QUE les préfixes déclarés par une fonctionnalité ÉTEINTE ;
//    2. on n'efface un fichier que si c'est bel et bien un TALON DE REDIRECTION
//       (meta refresh + noindex). Une vraie page trouvée là = on n'y touche pas
//       et on le dit tout haut.
//  Résultat : sur veveprice (prix actifs) l'intégration ne fait STRICTEMENT rien.
// =============================================================================
import { readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { priceEnabled } from './features.mjs';

/** Préfixes d'URL portés par chaque fonctionnalité, dans l'ordre du plan de site.
 *  Ajouter une fonctionnalité gatée = ajouter une ligne ici, rien d'autre. */
const ZONES = [
  { nom: 'prix', actif: priceEnabled,
    prefixes: ['/market/', '/collections/', '/collectibles/', '/comics/', '/collection/'] },
];

const estTalon = (html) =>
  /http-equiv="refresh"/i.test(html) && /name="robots"[^>]*noindex/i.test(html);

export default function fonctionnalitesEteintes() {
  return {
    name: 'veve:fonctionnalites-eteintes',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const racine = fileURLToPath(dir);
        let efface = 0;
        for (const zone of ZONES) {
          if (zone.actif()) continue;                    // fonctionnalité ON : on ne touche à rien
          for (const prefixe of zone.prefixes) {
            const chemin = join(racine, prefixe.replace(/^\/|\/$/g, ''));
            if (!existsSync(chemin) || !statSync(chemin).isDirectory()) continue;
            const index = join(chemin, 'index.html');
            if (!existsSync(index)) continue;            // pas de page émise : rien à faire
            if (!estTalon(readFileSync(index, 'utf8'))) {
              logger.warn(`${prefixe} existe alors que la fonctionnalité « ${zone.nom} » est éteinte, `
                        + `et ce n'est PAS un talon de redirection — page conservée, à vérifier.`);
              continue;
            }
            rmSync(chemin, { recursive: true, force: true });
            efface += 1;
            logger.info(`talon de redirection retiré : ${prefixe} (fonctionnalité « ${zone.nom} » éteinte)`);
          }
        }
        if (!efface) logger.info('aucun talon de redirection à retirer.');
      },
    },
  };
}
