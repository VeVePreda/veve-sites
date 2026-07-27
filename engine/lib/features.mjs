// ⚠️ VeVePreda/veve-sites — engine/lib/features.mjs
// Fonctionnalités activées par le MANIFESTE. `priceEnabled()` = ce site publie-t-il
// des pages de PRIX (movers, collections, raretés, fiches) ? Vrai seulement si le
// manifeste déclare des modules de données prix (content.data_modules non vide),
// sauf override explicite `content.price: true|false`. Un wiki (data_modules vide)
// -> AUCUNE page de prix, ni dans le sitemap, ni dans la recherche.
import { manifest } from './manifest.mjs';
export function priceEnabled() {
  const m = manifest();
  if (m.content && typeof m.content.price === 'boolean') return m.content.price;
  return Array.isArray(m.content?.data_modules) && m.content.data_modules.length > 0;
}
