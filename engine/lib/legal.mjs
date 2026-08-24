// Pages legales : textes par langue + substitution des informations du site.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { manifest } from './manifest.mjs';
import { locales, SENT_DEB, SENT_MIL, SENT_FIN } from './i18n.mjs';

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

// 🔴 LOT 161 — LE TITRE SE DIT ÉCHANGEABLE (point `s` de Preda).
// Mesuré le 24/08 : « Legal notice », « Privacy policy », « Terms of use » et
// « Contact » restaient en anglais sur **156 pages sur 158**, dans toutes les
// langues. Les traductions existaient pourtant dans `engine/legal/<lang>.json`
// depuis toujours : elles étaient simplement choisies AU BUILD, sans sentinelle,
// donc le navigateur n'avait rien à échanger.
// ⭐ La clé `lg.<doc>` est MÉCANIQUE : `outils/marquer_i18n.mjs` la résout en
// relisant `engine/legal/<lang>.json`. Aucune valeur n'est recopiée ailleurs.
// ⚠️ Le `<title>` de la page reste anglais : le marqueur retire les sentinelles
// des balises de tête, c'est voulu, et c'est le SEO de Preda qui le demande.
export const legalTitle = (lang, doc) => {
  const titre = legalDoc(lang, doc).title;
  if (process.env.I18N_MARQUAGE !== '1' || !titre) return titre;
  return `${SENT_DEB}lg.${doc}${SENT_MIL}${titre}${SENT_FIN}`;
};

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
