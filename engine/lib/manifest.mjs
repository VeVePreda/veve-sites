// Charge le manifeste du site actif (variable d'environnement SITE).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

// Racine du projet : process.cwd() survit au bundling (import.meta.url non).
const ROOT = process.env.PROJECT_ROOT || process.cwd();
export const SITE = process.env.SITE || 'veveprice';

let _m = null;
export function manifest() {
  if (_m) return _m;
  const p = join(ROOT, 'sites', SITE, 'manifest.yml');
  _m = yaml.load(readFileSync(p, 'utf8')) || {};
  _m.site = _m.site || {};
  _m.identity = _m.identity || {};
  _m.features = _m.features || {};
  _m.content = _m.content || {};
  _m.seo = _m.seo || {};
  return _m;
}

export function siteUrl() {
  const m = manifest();
  return (process.env.SITE_URL || `https://${m.site.domain}`).replace(/\/+$/, '');
}
