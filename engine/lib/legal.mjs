// Pages legales : textes par langue + substitution des informations du site.
import { readFileSync, existsSync } from 'node:fs';
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
  // L'adresse de contact n'est JAMAIS ecrite en entier dans le HTML :
  // elle est decoupee et reassemblee par le navigateur. Les aspirateurs
  // d'adresses lisent la source sans executer de JavaScript.
  const mailMarkup = (addr) => {
    const [u, d] = String(addr || '').split('@');
    if (!u || !d) return '';
    const human = `${u} (at) ${d.replace(/\./g, ' (dot) ')}`;
    return `<span class="mail" data-u="${u}" data-d="${d}"><noscript>${human}</noscript></span>`;
  };
  const vals = {
    brand: m.site.brand || '',
    domain: m.site.domain || '',
    contact: mailMarkup(info.contact),
    host: info.host || '',
    updated: info.updated || new Date().toISOString().slice(0, 10),
  };
  body = body.replace(/\{\{(\w+)\}\}/g, (_, k) => (vals[k] ?? ''));
  return { title, body };
}

export const legalTitle = (lang, doc) => legalDoc(lang, doc).title;

/**
 * Les langues qui ont VRAIMENT un jeu de textes légaux.
 *
 * ⚠️ `legalDict` retombe silencieusement sur `{}` quand le fichier manque, et
 * `legalDoc` retombe alors sur l'anglais : /it/legal/privacy/ sortait en
 * anglais sous un `<html lang="it">`, sans un mot dans le journal. Des
 * mentions légales dans la mauvaise langue ne sont pas un détail cosmétique —
 * c'est le document qui engage l'éditeur. On les émet donc seulement là où le
 * texte existe, et on DIT ce qui manque.
 */
export function languesLegales(candidates) {
  const def = locales().def;
  const out = [];
  for (const l of candidates) {
    if (l === def || existsSync(join(ROOT, 'engine', 'legal', `${l}.json`))) out.push(l);
    else console.warn(`[legal] engine/legal/${l}.json absent — aucune page légale ne sera publiée en « ${l} ».`);
  }
  return out;
}
