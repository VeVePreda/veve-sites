// Pages legales : textes par langue + substitution des informations du site.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { manifest } from './manifest.mjs';
import { locales } from './i18n.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const cache = new Map();
export const DOCS = ['mentions', 'privacy', 'terms', 'contact'];

function legalDict(lang) {
  if (cache.has(lang)) return cache.get(lang);
  let d = {};
  try { d = JSON.parse(readFileSync(join(ROOT, 'engine', 'legal', `${lang}.json`), 'utf8')); } catch {}
  cache.set(lang, d);
  return d;
}

export function legalDoc(lang, doc) {
  const m = manifest();
  const info = m.legal_info || {};
  const d = legalDict(lang);
  const fb = legalDict(locales().def);
  const title = d[`${doc}.title`] ?? fb[`${doc}.title`] ?? doc;
  let body = d[`${doc}.body`] ?? fb[`${doc}.body`] ?? '';
  const vals = {
    brand: m.site.brand || '',
    domain: m.site.domain || '',
    contact: info.contact || '',
    host: info.host || '',
    updated: info.updated || new Date().toISOString().slice(0, 10),
  };
  body = body.replace(/\{\{(\w+)\}\}/g, (_, k) => (vals[k] ?? ''));
  return { title, body };
}

export const legalTitle = (lang, doc) => legalDoc(lang, doc).title;
