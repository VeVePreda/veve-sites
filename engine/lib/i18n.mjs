// Multilingue : dictionnaires, langue par defaut par site, construction des chemins.
// Regle SEO : chaque langue a sa propre adresse. AUCUNE redirection automatique.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { manifest } from './manifest.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const cache = new Map();

export function locales() {
  const l = manifest().languages || {};
  const active = Array.isArray(l.active) && l.active.length ? l.active : ['en'];
  const def = l.default && active.includes(l.default) ? l.default : active[0];
  return { active, def };
}

export function dict(lang) {
  if (cache.has(lang)) return cache.get(lang);
  let d = {};
  try { d = JSON.parse(readFileSync(join(ROOT, 'engine', 'i18n', `${lang}.json`), 'utf8')); } catch {}
  cache.set(lang, d);
  return d;
}

export function t(lang, key) {
  const d = dict(lang);
  if (d[key] !== undefined) return d[key];
  return dict(locales().def)[key] ?? key;
}

// Valeur de manifeste pouvant etre une chaine OU une carte { en: "...", fr: "..." }
export function pick(value, lang) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value[locales().def] ?? Object.values(value)[0] ?? '';
}

export const prefixOf = (lang) => (lang === locales().def ? '' : `/${lang}`);
export const localize = (lang, path) => `${prefixOf(lang)}${path.startsWith('/') ? path : '/' + path}`;

// Pour getStaticPaths : la langue par defaut n'a PAS de prefixe (param undefined).
export function localeParams() {
  const { active, def } = locales();
  return active.map((lang) => ({ lang, param: lang === def ? undefined : lang }));
}
export const langFromParam = (param) => {
  const { active, def } = locales();
  const l = Array.isArray(param) ? param[0] : param;
  return l && active.includes(l) ? l : def;
};

export const localeNames = { en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch' };
export const dateLocale = { en: 'en-GB', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' };
export const numberLocale = dateLocale;
