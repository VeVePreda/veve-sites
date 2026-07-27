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
//
// ⚠️ LONGUEUR DES DESCRIPTIONS (audit SEO du 27/07/2026) : une description de
// moins de ~70 caractères ne donne rien à afficher à Google, qui invente alors
// son propre extrait à partir de la page. Ces textes visent la fenêtre utile,
// **DESC_MIN…DESC_MAX**, et disent ce qu'on TROUVE sur la page, pas ce qu'elle
// « est ». ⛔ Aucun CHIFFRE ici : un compteur écrit en dur dans une description
// vieillit en silence (règle « un chiffre = une requête »).
export const DESC_MIN = 70;
export const DESC_MAX = 160;

const META = {
  glossary: {
    title: { en: 'Glossary', fr: 'Glossaire', es: 'Glosario', it: 'Glossario', de: 'Glossar' },
    description: {
      en: 'Every VeVe term defined in plain language: drops, mint numbers, rarity tiers, gems, OMI, craft and the rest of the collector vocabulary.',
      fr: 'Tous les termes VeVe définis en clair : drops, numéros de mint, paliers de rareté, gems, OMI, craft et le reste du vocabulaire du collectionneur.',
      es: 'Todos los términos de VeVe definidos con claridad: drops, números de mint, niveles de rareza, gems, OMI, craft y el resto del vocabulario del coleccionista.',
      it: 'Tutti i termini VeVe definiti in modo chiaro: drop, numeri di mint, livelli di rarità, gems, OMI, craft e il resto del vocabolario del collezionista.',
      de: 'Alle VeVe-Begriffe verständlich erklärt: Drops, Mint-Nummern, Seltenheitsstufen, Gems, OMI, Craft und der Rest des Sammler-Vokabulars.' },
  },
  acronyms: {
    title: { en: 'Acronyms', fr: 'Acronymes', es: 'Acrónimos', it: 'Acronimi', de: 'Abkürzungen' },
    description: {
      en: 'The VeVe and crypto abbreviations you meet in a Discord thread, spelled out and explained: MCP, IMX, ATL, ATH, FOMO, gas, floor and more.',
      fr: 'Les abréviations VeVe et crypto croisées dans un fil Discord, développées et expliquées : MCP, IMX, ATL, ATH, FOMO, gas, floor et les autres.',
      es: 'Las abreviaturas de VeVe y cripto que aparecen en un hilo de Discord, desarrolladas y explicadas: MCP, IMX, ATL, ATH, FOMO, gas, floor y más.',
      it: 'Le abbreviazioni VeVe e cripto che si incontrano in un thread Discord, sciolte e spiegate: MCP, IMX, ATL, ATH, FOMO, gas, floor e altre.',
      de: 'Die VeVe- und Krypto-Abkürzungen aus jedem Discord-Thread, ausgeschrieben und erklärt: MCP, IMX, ATL, ATH, FOMO, Gas, Floor und mehr.' },
  },
  annuaire: {
    title: { en: 'Directory', fr: 'Annuaire', es: 'Directorio', it: 'Directory', de: 'Verzeichnis' },
    description: {
      en: 'Who is who around VeVe: the team, the artists and creators behind the drops, and the collector clubs and communities, each with its own links.',
      fr: 'Qui est qui autour de VeVe : l’équipe, les artistes et créateurs derrière les drops, les clubs et communautés de collectionneurs, avec leurs liens.',
      es: 'Quién es quién en torno a VeVe: el equipo, los artistas y creadores detrás de los drops, y los clubes y comunidades de coleccionistas, con sus enlaces.',
      it: 'Chi è chi attorno a VeVe: il team, gli artisti e i creatori dietro i drop, i club e le comunità di collezionisti, ognuno con i propri link.',
      de: 'Wer ist wer rund um VeVe: das Team, die Künstler und Creator hinter den Drops sowie die Sammler-Clubs und Communities, jeweils mit ihren Links.' },
  },
  history: {
    title: { en: 'History', fr: 'Histoire', es: 'Historia', it: 'Storia', de: 'Geschichte' },
    description: {
      en: 'The VeVe timeline, milestone by milestone and each one dated: the first drop, the chain migrations, the licences and the features, from 2020 onwards.',
      fr: 'La chronologie de VeVe, jalon par jalon et chacun daté : le premier drop, les migrations de chaîne, les licences et les fonctionnalités, depuis 2020.',
      es: 'La cronología de VeVe, hito a hito y cada uno fechado: el primer drop, las migraciones de cadena, las licencias y las funciones, desde 2020.',
      it: 'La cronologia di VeVe, tappa dopo tappa e ognuna datata: il primo drop, le migrazioni di catena, le licenze e le funzioni, dal 2020 in poi.',
      de: 'Die VeVe-Chronik, Meilenstein für Meilenstein und jeder datiert: der erste Drop, die Chain-Migrationen, die Lizenzen und die Funktionen, seit 2020.' },
  },
  brands: {
    title: { en: 'Brands', fr: 'Marques', es: 'Marcas', it: 'Marchi', de: 'Marken' },
    description: {
      en: 'Every licence published on VeVe, listed by arrival: how many series and how many collectibles each one weighs, and the date of its very first drop.',
      fr: 'Toutes les licences publiées sur VeVe, classées par arrivée : combien de séries et de collectibles chacune pèse, et la date de son tout premier drop.',
      es: 'Todas las licencias publicadas en VeVe, ordenadas por llegada: cuántas series y cuántos coleccionables pesa cada una, y la fecha de su primer drop.',
      it: 'Tutte le licenze pubblicate su VeVe, ordinate per arrivo: quante serie e quanti collezionabili pesa ciascuna, e la data del suo primo drop.',
      de: 'Alle auf VeVe veröffentlichten Lizenzen, nach Ankunft sortiert: wie viele Serien und Collectibles jede umfasst und das Datum ihres ersten Drops.' },
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

// Une description trop courte se voit AU BUILD, pas six mois plus tard dans la
// Search Console. On journalise une fois par (section, langue) — y compris pour
// les surcharges de manifeste, qui sont la cause la plus probable.
const _vus = new Set();
function controlerDescription(section, lang, desc) {
  if (!desc) return desc;
  const n = [...desc].length;
  const cle = `${section}/${lang}`;
  if ((n < DESC_MIN || n > DESC_MAX) && !_vus.has(cle)) {
    _vus.add(cle);
    console.warn(`[editorial] description ${cle} : ${n} caractères (fenêtre ${DESC_MIN}–${DESC_MAX}) — "${desc.slice(0, 60)}…"`);
  }
  return desc;
}

/** Titre/adresse/description d'une section pour une langue (surcharge manifeste
 *  prioritaire sur les défauts réseau). */
export function sectionMeta(section, lang) {
  const over = (editorialCfg().labels || {})[section] || {};
  const base = META[section] || {};
  return {
    section,
    path: `/${section}/`,
    title: pickLang(over.title || base.title, lang) || section,
    description: controlerDescription(section, lang, pickLang(over.description || base.description, lang) || ''),
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
