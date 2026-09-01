// ⚠️ VeVePreda/veve-sites — engine/lib/feuille_theme.mjs   (NEUF — lot 105)
// ═══════════════════════════════════════════════════════════════════════════
// LE THÈME SORT DU HTML — UNE FEUILLE, UNE FOIS, POUR 8 484 PAGES
// ═══════════════════════════════════════════════════════════════════════════
//
// CE QUE ÇA CORRIGE, MESURÉ SUR LE BUILD RÉEL (07/08/2026, 8 484 pages) :
//   une fiche brute      223 712 o dont 168 850 de CSS recopié — 75,5 %
//   dist/                1 847 170 227 o, dont ~1,43 Go de thème en 8 484 copies
//   (et 2,35 Go une fois le Dockerfile passé : la précompression ajoute son .gz)
// Un visiteur qui lit trois fiches télécharge aujourd'hui TROIS FOIS le même
// thème. Le choix « en ligne » était juste quand le site faisait 400 pages ;
// à 8 484 il s'est inversé — et c'est ce volume qui gonflait le cache Docker
// jusqu'à faire échouer les déploiements (58 Go, panne muette du 07/08).
//
// ⛔⛔ CE MODULE NE MODIFIE AUCUN `themes/*/theme.css`. Il les LIT et les écrit
// AILLEURS. Les trois thèmes (`vitrine`, `encyclopedie`, `aurora`) passent par
// exactement le même chemin : le mécanisme n'est pas taillé pour veveprice.
//
// ⛔⛔⛔ `import.meta.glob` ET NON `readFileSync` — ET CETTE LIGNE-LÀ DÉCIDE DE
// LA PRODUCTION. Le Dockerfile ne copie PAS `themes/` dans l'image de runtime
// (il copie `dist`, `engine`, `sites`, `node_modules`, `.reserve`). Un
// `readFileSync('themes/…')` marcherait au build, marcherait dans le bac à
// sable, marcherait en développement — et jetterait ENOENT en production sur
// les seules routes rendues à la demande (`/compte/`, `/connexion/`,
// `/inscription/`, `/market/`), c'est-à-dire précisément celles qu'aucun banc
// hors-ligne ne rend. Avec le glob de Vite, le texte des thèmes est cousu dans
// le paquet au build : rien à lire à l'exécution, et le Dockerfile n'a pas à
// bouger. ⭐ C'est la forme qu'avait déjà `Base.astro` ; on la garde.
//
// ⭐ CE MODULE EST LA SEULE SOURCE DE LA FEUILLE. Le gabarit et la route qui
// la sert appellent la MÊME fonction : l'empreinte du nom ne peut donc pas
// désigner autre chose que ce qui sera servi. Deux calculs séparés auraient
// produit, un jour, un `<link>` vers un fichier absent — et une page nue,
// sans la moindre erreur au build.

import { createHash } from 'node:crypto';
import { manifest, SITE } from './manifest.mjs';

const themeFiles = import.meta.glob('../../themes/*/theme.css', { query: '?raw', import: 'default', eager: true });

// ⭐ `color-scheme` DÉDUIT de la palette, jamais écrit en dur : ce dépôt sert
// plusieurs sites et en servira d'autres. Sans cette déclaration, le navigateur
// rend SES propres pièces — barres de défilement, champs, menus natifs — en
// thème clair au-dessus d'une page noire.
const luminance = (hex) => {
  const h = String(hex || '').trim().replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
export const colorScheme = (pal) => (luminance(pal.bg) < 0.18 ? 'dark' : 'light');

// ⛔ LE SOCLE — les règles qui n'appartiennent à aucun thème (liens légaux,
// barre de langues, lien d'évitement, bandeau de suggestion). Elles vivaient
// dans un `<style is:inline>` du gabarit, recopié 8 484 fois lui aussi.
// ⚠️ ELLES RESTENT EN DERNIER, comme dans le gabarit : à spécificité égale
// c'est l'ordre qui tranche, et `.langbar a[aria-current]` doit continuer de
// gagner sur ce que le thème dit d'un `a`. Déplacer ces 1 197 octets plus haut
// ne casserait rien de visible au build — seulement quelques couleurs, sur
// quelques éléments, que personne ne relierait à ce lot.
const SOCLE = `.legal-links{margin:0 0 10px;font-size:12.5px;line-height:1.9;color:var(--muted)}.legal-links a{color:var(--muted);text-decoration:none;border-bottom:1px solid transparent}.legal-links a:hover,.legal-links a:focus-visible{color:var(--text);border-bottom-color:var(--muted)}.langbar{display:flex;gap:6px;margin-left:12px}.langbar a{font-size:13px;color:var(--muted);padding:2px 6px;border-radius:6px;min-height:24px;min-width:24px;display:inline-flex;align-items:center;justify-content:center}.langbar a[aria-current]{background:#ffffff14;color:var(--text)}.crumbs a{display:inline-block;padding:3px 0;min-height:24px}.legal-links a{display:inline-block;padding:3px 0;min-height:24px}.saut{position:absolute;left:-9999px;top:0;z-index:100;background:var(--surface);color:var(--text);border:1px solid var(--primary);border-radius:0 0 8px 0;padding:10px 16px;text-decoration:none}.saut:focus{left:0}#langsuggest{display:none;background:var(--surface);border:1px solid var(--primary);border-radius:10px;padding:10px 14px;margin:14px 0;font-size:14px}#langsuggest a{font-weight:500}#langsuggest button{background:none;border:0;color:var(--muted);cursor:pointer;font-size:13px;text-decoration:underline}.globe__sugg{border-top:1px solid var(--rule);margin-top:6px;padding-top:8px;max-width:230px}.globe__sugg p{margin:0 0 7px;font-size:12.5px;line-height:1.45;color:var(--text-2);white-space:normal}.globe__sugg span{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.globe__sugg button{padding:5px 10px;border-radius:6px;font-size:12.5px;cursor:pointer;min-height:30px;white-space:nowrap}.globe__sugg button:first-child{background:var(--primary);color:var(--surface);border:0;font-weight:600}.globe__sugg button:last-child{background:none;border:0;color:var(--muted);text-decoration:underline}`;

let cache = null;

// ⭐ UN SEUL CALCUL PAR BUILD. `SITE` ne change pas en cours de build : le
// résultat est mémorisé. Sans ce cache, le sha256 de 168 Ko serait recalculé
// 8 484 fois — c'est-à-dire qu'on remplacerait un coût réseau par un coût CPU.
export function feuilleTheme() {
  if (cache) return cache;
  const m = manifest();
  const p = m.identity.palette || {};
  const f = m.identity.fonts || {};
  const pNuit = m.identity.palette_nuit || null;

  // ⭐⭐ GARDE-FOU repris du gabarit (30/07/2026) — LE REPLI SILENCIEUX EST MORT.
  // Une faute de frappe dans `identity.theme` ne doit PAS retomber sur le
  // premier thème du glob : le site sortirait entièrement construit, vert, et
  // dans le mauvais thème — un symptôme rigoureusement identique à « le lot
  // n'a pas été déployé ».
  const cle = `../../themes/${m.identity.theme}/theme.css`;
  if (!themeFiles[cle]) {
    const dispo = Object.keys(themeFiles).map((k) => k.split('/')[3]).join(', ');
    throw new Error(
      `[theme] identity.theme = « ${m.identity.theme} » ne désigne aucun dossier. `
      + `Thèmes disponibles : ${dispo}. `
      + `Corriger sites/${SITE}/manifest.yml, ou créer themes/${m.identity.theme}/theme.css.`);
  }

  const varsDe = (pal) => `--primary:${pal.primary};--accent:${pal.accent};`
    + `--danger:${pal.danger};--bg:${pal.bg};--surface:${pal.surface};`
    + `--text:${pal.text};--muted:${pal.muted};`
    + `--font-heading:${f.heading};--font-body:${f.body}`;

  // ⚠️ `@font-face` PART BIEN DANS LA FEUILLE EXTERNE, ET ÇA NE RETARDE RIEN :
  // le `<link rel="preload" as="font" crossorigin>` du `<head>` déclenche déjà
  // le téléchargement de la fonte au premier octet du document. C'est
  // exactement ce pour quoi il avait été posé au lot 79. Sans ce preload, ces
  // 310 octets devraient rester en ligne.
  const fontFiles = Array.isArray(f.files) ? f.files : [];
  const fontFace = fontFiles.map((ff) => `@font-face{font-family:'${ff.famille}';`
    + `src:url('${ff.fichier}') format('woff2');`
    + `font-weight:${ff.graisses || '400'};font-style:normal;`
    + `font-display:swap;}`).join('');

  const vars = pNuit
    ? `:root{color-scheme:${colorScheme(p)};${varsDe(p)}}`
      + `:root[data-theme="nuit"]{color-scheme:${colorScheme(pNuit)};${varsDe(pNuit)}}`
    : `:root{color-scheme:${colorScheme(p)};${varsDe(p)}}`;

  // 🔴 L'ORDRE EST LE MÊME QU'EN LIGNE, AU CARACTÈRE PRÈS : fontes, variables,
  // thème, socle. La cascade ne se relit pas — elle se conserve.
  const css = fontFace + vars + themeFiles[cle] + SOCLE;

  // ⭐⭐ L'EMPREINTE EST DANS LE NOM, ET C'EST OBLIGATOIRE. nginx sert déjà tout
  // `.css` en `public, max-age=2592000, immutable`. Sur un nom FIXE, cette
  // ligne servirait le thème d'avant pendant TRENTE JOURS à quiconque a visité
  // le site une fois — un déploiement parfaitement vert, invisible en navigation
  // privée, et signalé par les seuls habitués. Avec l'empreinte, un thème qui
  // change change d'adresse : il n'y a plus rien à invalider.
  const empreinte = createHash('sha256').update(css).digest('hex').slice(0, 12);
  cache = { empreinte, nom: `theme-${empreinte}.css`, href: `/theme-${empreinte}.css`, css };
  return cache;
}
