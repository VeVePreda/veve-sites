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

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 120 — TROIS LISTES DE LANGUES, ET ELLES NE DISENT PAS LA MÊME
// CHOSE
// ═══════════════════════════════════════════════════════════════════════════
// Décision de Preda du 10/08 : « le multilingue ne vaut pas son coût, car à
// part l'interface et la description de l'item il n'y a rien à traduire ».
// Mesuré : ~9 300 des 12 376 pages étaient des localisations, pour 433 clés
// d'interface et un champ `description`. Le cas d'école du contenu mince
// démultiplié.
//
// ⭐⭐⭐ MAIS « LES LANGUES DU SITE » RECOUVRAIT TROIS QUESTIONS DIFFÉRENTES,
// et c'est de les avoir confondues que venait le coût :
//   · `active`    — quelles langues ont une ADRESSE ? (→ `/fr/comics/…`)
//   · `interface` — quelles langues ont des LIBELLÉS ? (les 433 clés)
//   · `blog`      — quelles langues ont des ARTICLES écrits ?
// Elles avaient une seule réponse pour les trois. Les séparer, c'est pouvoir
// répondre `[en]` à la première (le gain SEO), `[en,fr,es,de]` à la deuxième
// (rien ne se perd) et `[en,fr]` à la troisième (le seul vrai contenu
// multilingue du réseau).
//
// ⛔ CHACUNE RETOMBE SUR `active` QUAND LE MANIFESTE SE TAIT. `vevewiki` ne
// déclare ni `interface` ni `blog` : il garde EXACTEMENT le comportement
// d'avant ce lot, sans qu'une ligne de son manifeste bouge. *Un réglage neuf
// dont l'absence change quelque chose est un piège pour l'autre site.*

/** Les langues dans lesquelles l'INTERFACE existe — libellés, pas adresses.
 *  ⭐ Ne sert QUE là où une langue est NÉGOCIÉE à la demande (`?lang=`,
 *  `Accept-Language`) : les pages de compte, qui ne sont pas mises en cache.
 *  ⛔ NE JAMAIS s'en servir pour composer une URL ou un `hreflang` : ces
 *  langues n'ont pas d'adresse, et annoncer une page qui n'existe pas est une
 *  promesse rompue faite à un moteur. */
export function languesInterface() {
  const l = manifest().languages || {};
  const i = Array.isArray(l.interface) && l.interface.length ? l.interface : null;
  return i || locales().active;
}

/** Les langues d'articles que le manifeste DÉCLARE.
 *  ═════════════════════════════════════════════════════════════════════════
 *  ⛔⛔ ELLE NE S'APPELLE PAS `languesBlog()`, ET C'EST DÉLIBÉRÉ : ce nom-là
 *  EXISTE DÉJÀ dans `engine/lib/blog.mjs`, et il répond à une autre question.
 *  Je l'ai découvert en écrivant celle-ci — j'allais poser une SECONDE
 *  définition de « qu'est-ce qu'une langue de blog », dans un autre fichier.
 *  ⭐⭐⭐ *Deux définitions de la même notion divergent un jour, et ce jour-là
 *  c'est la plus permissive qui est en production.* (Écrit noir sur blanc au
 *  lot 101 pour `CHAMPS_COTE`, et j'allais le repayer.)
 *
 *  LA DIFFÉRENCE, ET ELLE COMPTE :
 *    · ICI          — ce que le manifeste DÉCLARE. Une intention.
 *    · `blog.mjs`   — ce qui EXISTE vraiment : il ne garde une langue que si
 *                     `postsFor(l)` rend au moins un article. Une mesure.
 *  ⭐ La seconde consomme la première. Une intention sans article ne produit
 *  aucune page — c'est ce qui empêche d'annoncer un `/de/blog/` vide. */
export function languesDeclareesBlog() {
  const l = manifest().languages || {};
  const b = Array.isArray(l.blog) && l.blog.length ? l.blog : null;
  return b || locales().active;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌍 LOT 123 — LA LANGUE CHOISIE SURVIT À LA NAVIGATION
 * ═══════════════════════════════════════════════════════════════════════════
 * Preda, 10/08 : « j'ai réglé mon compte sur français, mais quand je navigue
 * ça me remet toujours anglais ».
 * LA CAUSE : le lot 120 a fait de `?lang=` un paramètre — il n'agissait que
 * sur la page où on était, et rien ne s'en souvenait. Un réglage qui ne
 * survit pas au clic suivant n'est pas un réglage, c'est un aperçu.
 *
 * ⭐⭐ TROIS SOURCES, DANS CET ORDRE, ET L'ORDRE EST LA DÉCISION :
 *   ① `?lang=` — un choix EXPLICITE, fait à l'instant. Il gagne toujours.
 *   ② le cookie — un choix explicite fait AVANT. Il bat la préférence du
 *      navigateur, sinon changer de langue serait sans effet pour tous ceux
 *      dont l'`Accept-Language` est reconnu, c'est-à-dire presque tout le
 *      monde.
 *   ③ `Accept-Language` — une préférence DEVINÉE. Le dernier recours.
 * ⛔ L'inverse (navigateur avant cookie) rendait le réglage inopérant sans
 *    qu'aucune erreur ne le dise : c'est exactement le défaut signalé.
 *
 * ⛔ ELLE NE DÉCIDE D'AUCUN DROIT et ne lit aucune session : elle choisit un
 *    DICTIONNAIRE. Le cookie qu'elle emploie ne porte qu'un code de langue à
 *    deux lettres, validé contre la liste du manifeste — ce qui n'est pas
 *    dedans n'est pas retenu. ⚠️ Sans cette validation, un cookie forgé
 *    composerait un chemin de fichier dans `dict()`.
 *
 * ⚠️ ELLE NE SERT QUE SUR LES ROUTES RENDUES À LA DEMANDE. Les ~3 000 pages
 *    publiques sont pré-générées et servies depuis un cache partagé : une
 *    seule version existe, en anglais. C'est la limite assumée du lot 120, et
 *    ce lot-ci ne la lève pas.
 */
export const COOKIE_LANGUE = 'vp_langue';

export function choisirLangue({ demande, cookie, accept, dispo, def }) {
  const ok = (v) => !!v && dispo.includes(v);
  if (ok(demande)) return { lang: demande, aPoser: demande !== cookie };
  if (ok(cookie)) return { lang: cookie, aPoser: false };
  const souhaits = String(accept || '')
    .split(',').map((x) => x.split(';')[0].trim().slice(0, 2).toLowerCase());
  return { lang: souhaits.find(ok) || def, aPoser: false };
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
