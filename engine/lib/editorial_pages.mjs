// =============================================================================
//  editorial_pages.mjs — les TYPES DE PAGE éditoriaux activables par manifeste
//
//  ⚠️ CE FICHIER VA DANS LE DÉPÔT  VeVePreda/veve-sites , dans  engine/lib/
//     (chemin exact : engine/lib/editorial_pages.mjs)
//
//  Étape 3 du constructeur générique (bible/architecture-generateur-sites.md).
//  Un site n'active QUE ses pages, via `manifest.editorial.pages`. Ce module dit
//  quelles sections « index » existent, leur adresse et leur titre multilingue —
//  et sert les listes de `getStaticPaths` (défaut + localisé). UN SEUL code pour
//  les 15 sites ; rien de vevewiki-spécifique.
//
//  blog & submit ne sont PAS ici : le blog a son rendu propre (engine/lib/blog.mjs)
//  et « submit » est un formulaire, pas une page-liste de contenu.
// =============================================================================
import { manifest } from './manifest.mjs';
import { locales } from './i18n.mjs';

// Sections « index » que ce module sait rendre (ordre = ordre du menu).
export const SECTIONS = ['glossary', 'acronyms', 'annuaire', 'history', 'brands'];

// Métadonnées réseau par défaut (titre + description), surchargeables par site
// via `manifest.editorial.labels.<section>.{title,description}.<lang>`.
// EN obligatoire ; les autres langues retombent sur EN (comme le reste du réseau).
const META = {
  glossary: {
    title: { en: 'Glossary', fr: 'Glossaire', es: 'Glosario', it: 'Glossario', de: 'Glossar' },
    description: {
      en: 'Every VeVe term, defined.', fr: 'Tous les termes VeVe, définis.',
      es: 'Todos los términos VeVe, definidos.', it: 'Tutti i termini VeVe, definiti.',
      de: 'Alle VeVe-Begriffe, erklärt.' },
  },
  acronyms: {
    title: { en: 'Acronyms', fr: 'Acronymes', es: 'Acrónimos', it: 'Acronimi', de: 'Abkürzungen' },
    description: {
      en: 'VeVe & crypto acronyms explained.', fr: 'Les acronymes VeVe et crypto expliqués.',
      es: 'Acrónimos VeVe y cripto explicados.', it: 'Acronimi VeVe e cripto spiegati.',
      de: 'VeVe- und Krypto-Abkürzungen erklärt.' },
  },
  annuaire: {
    title: { en: 'Directory', fr: 'Annuaire', es: 'Directorio', it: 'Directory', de: 'Verzeichnis' },
    description: {
      en: 'Creators, clubs and team behind VeVe.', fr: 'Créateurs, clubs et équipe autour de VeVe.',
      es: 'Creadores, clubes y equipo de VeVe.', it: 'Creatori, club e team di VeVe.',
      de: 'Kreative, Clubs und Team hinter VeVe.' },
  },
  history: {
    title: { en: 'History', fr: 'Histoire', es: 'Historia', it: 'Storia', de: 'Geschichte' },
    description: {
      en: 'The VeVe timeline, milestone by milestone.', fr: 'La chronologie VeVe, jalon par jalon.',
      es: 'La cronología de VeVe, hito a hito.', it: 'La cronologia di VeVe, tappa dopo tappa.',
      de: 'Die VeVe-Chronik, Meilenstein für Meilenstein.' },
  },
  brands: {
    title: { en: 'Brands', fr: 'Marques', es: 'Marcas', it: 'Marchi', de: 'Marken' },
    description: {
      en: 'Every licence on VeVe, with counts.', fr: 'Toutes les licences VeVe, avec les compteurs.',
      es: 'Todas las licencias VeVe, con recuentos.', it: 'Tutte le licenze VeVe, con i conteggi.',
      de: 'Alle Lizenzen auf VeVe, mit Zählungen.' },
  },
};

const editorialCfg = () => manifest().editorial || {};

/** Sections réellement actives pour ce site = intersection de
 *  `manifest.editorial.pages` avec les sections rendables ici, dans l'ordre
 *  canonique. */
export function activeSections() {
  const declared = new Set((editorialCfg().pages || []).map((p) => String(p).trim()));
  return SECTIONS.filter((s) => declared.has(s));
}

const pickLang = (map, lang) =>
  (map && (map[lang] || map[locales().def] || Object.values(map)[0])) || '';

/** Titre/adresse/description d'une section pour une langue (surcharge manifeste
 *  prioritaire sur les défauts réseau). */
export function sectionMeta(section, lang) {
  const over = (editorialCfg().labels || {})[section] || {};
  const base = META[section] || {};
  return {
    section,
    path: `/${section}/`,
    title: pickLang(over.title || base.title, lang) || section,
    description: pickLang(over.description || base.description, lang) || '',
  };
}

/** Le menu éditorial (sections actives) résolu pour une langue — pour un header
 *  ou un plan de site. */
export function editorialMenu(lang) {
  return activeSections().map((s) => sectionMeta(s, lang));
}

/** getStaticPaths — langue par défaut : une entrée par section active. */
export function sectionParamsDefault() {
  return activeSections().map((section) => ({ params: { section } }));
}

/** getStaticPaths — langues secondaires : sections actives × locales ≠ défaut. */
export function sectionParamsLocalized() {
  const { active, def } = locales();
  const out = [];
  for (const locale of active.filter((l) => l !== def)) {
    for (const section of activeSections()) {
      out.push({ params: { locale, section } });
    }
  }
  return out;
}
