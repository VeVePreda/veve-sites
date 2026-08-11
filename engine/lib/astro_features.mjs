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
import { priceEnabled, comptesActifs } from './features.mjs';

/** Préfixes d'URL portés par chaque fonctionnalité, dans l'ordre du plan de site.
 *  Ajouter une fonctionnalité gatée = ajouter une ligne ici, rien d'autre. */
const ZONES = [
  { nom: 'prix', actif: priceEnabled,
    prefixes: ['/market/', '/collections/', '/collectibles/', '/comics/', '/collection/'] },
  // ⭐ LOT 42 — « ajouter une fonctionnalite gatee = ajouter une ligne ici ».
  // On suit le contrat que ce fichier annonce en tete, au lieu d'inventer un
  // second mecanisme d'extinction a cote du premier.
  // ⭐ LOT 44 — `/compte/` et `/connexion/` REJOIGNENT LA ZONE.
  // Elles emettaient de VRAIES pages sur vevewiki (55 Ko et 54 Ko de
  // vocabulaire `vitrine` sur un theme qui n'en a aucune regle). Le lot 42 les
  // avait laissees dehors parce que les gater fait DISPARAITRE deux pages et
  // que ca se decide. Preda a tranche le 03/08 : vevewiki n'aura jamais
  // d'espace membre.
  // ⚠️ Elles ne peuvent etre effacees QUE parce qu'elles emettent desormais un
  // TALON (le `redirect` ajoute dans chaque page). Sans lui, ce garde-fou ne
  // les toucherait pas — il refuse d'effacer une vraie page, par conception.
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LOT 136 — `/favoris/` ET `/dashboard/` REJOIGNENT LA ZONE.
  // ═════════════════════════════════════════════════════════════════════════
  // MESURÉ SUR LA PRODUCTION LE 11/08/2026 : `vevewiki.com/favoris/` rendait
  // **200** (418 o) et `/dashboard/` **200** (430 o) — deux TALONS de
  // redirection vers `/connexion/`, qui est un **404** sur ce site. Deux pages
  // fantômes qui envoient un visiteur nulle part, sur un site dont il est GELÉ
  // qu'il n'aura jamais d'espace membre.
  //
  // ⭐⭐⭐ ET C'EST EXACTEMENT LE DÉFAUT DU LOT 44, DEUX LOTS PLUS TARD.
  //   Le lot 104 a ajouté `market`, `favoris` et `dashboard` à `ROUTES_COMPTE`.
  //   `/market/` s'est trouvé couvert PAR HASARD — il figure dans la zone
  //   « prix ». Les deux autres n'étaient couverts par personne, et rien ne
  //   pouvait le dire : le build restait vert, les pages étaient en `noindex`,
  //   aucun humain ne va sur `/dashboard/` d'un wiki.
  // ⭐⭐ C'est `regle-circuit-ouvert` en entier : QUELQU'UN ÉCRIT (le lot 104
  //   ajoute des routes de compte), PERSONNE NE LIT (ce tableau n'a pas bougé).
  //   Le fichier annonce pourtant en tête « ajouter une fonctionnalité gatée =
  //   ajouter une ligne ici, rien d'autre » — le contrat était écrit, il n'était
  //   réclamé par rien.
  // ⇒ Le remède n'est pas cette ligne, c'est le § 1 de `test:cache` qui compare
  //   désormais `ROUTES_COMPTE` à ces préfixes et rougit à la prochaine
  //   omission. *Une phrase se relit ; un banc se déclenche.*
  //
  // ⚠️ Le garde-fou d'origine tient toujours : ces deux pages ne sont effacées
  //   QUE parce qu'elles émettent un TALON (meta refresh + noindex) — mesuré
  //   ci-dessus. Si l'une devenait une vraie page, l'intégration refuserait d'y
  //   toucher et le dirait tout haut, par conception.
  { nom: 'comptes', actif: comptesActifs,
    prefixes: ['/inscription/', '/compte/', '/connexion/', '/favoris/', '/dashboard/'] },
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
