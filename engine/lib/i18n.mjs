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

export function t(lang, key, vars) {
  const d = dict(lang);
  const raw = d[key] !== undefined ? d[key] : (dict(locales().def)[key] ?? key);
  if (!vars) return raw;
  return String(raw).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''));
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

// ⚠️ TOUTE LANGUE AJOUTEE A UN MANIFESTE DOIT ETRE ICI. Ces deux tables n'ont
// pas de repli visible : une langue absente se retrouve annoncee par son CODE
// (« it » au lieu de « Italiano ») dans la banniere de suggestion, et ses dates
// se formatent en anglais sous un <html lang="it">. Rien n'echoue, rien n'est
// vide — encore un defaut par repli. `test:langues` refuse desormais une langue
// active absente de ces tables.
export const localeNames = { en: 'English', fr: 'Français', es: 'Español', it: 'Italiano', de: 'Deutsch' };
export const dateLocale = { en: 'en-GB', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', de: 'de-DE' };
export const numberLocale = dateLocale;
