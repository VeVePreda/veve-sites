// =============================================================================
//  og.mjs — quelle IMAGE DE PARTAGE pour cette page ?
//  ⚠️ VeVePreda/veve-sites — engine/lib/og.mjs
//
//  Les 83 pages du site partageaient la MÊME vignette (`/og.png`) : un article
//  publié sur X ou Discord s'affichait exactement comme la page d'accueil. Or
//  la vignette est la seule chose qu'un lecteur voit avant de décider s'il
//  clique.
//
//  Les cartes par article sont produites par `engine/tools/make_article_cards.py`
//  et COMMITTÉES dans `public/og/<langue>/<slug>.png` — la construction tourne
//  dans une image Docker `node:22-alpine` qui n'a ni Python ni PIL.
//
//  ⭐ On ne DÉCLARE une carte que si son fichier existe VRAIMENT. Une `og:image`
//     qui pointe vers un 404 est pire que la vignette générique : les réseaux
//     mettent le résultat en cache, parfois pour des semaines, et l'aperçu
//     reste cassé longtemps après la correction.
// =============================================================================
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SITE } from './manifest.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();

/** Chemin de la carte d'un article, ou `null` si elle n'a pas été produite.
 *  ⚠️ Le chemin porte le NOM DU SITE : `public/` est partagé par les 15 sites du
 *     dépôt, deux articles homonymes s'écraseraient sinon. */
export function carteArticle(lang, slug) {
  if (!lang || !slug) return null;
  const rel = `/og/${SITE}/${lang}/${slug}.png`;
  return existsSync(join(ROOT, 'public', rel.slice(1))) ? rel : null;
}
