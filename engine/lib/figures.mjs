// =============================================================================
//  figures.mjs — LES FIGURES DE DONNÉES DU RÉSEAU
//
//  ⚠️ CE FICHIER VA DANS LE DÉPÔT  VeVePreda/veve-sites , dans  engine/lib/
//     (chemin exact : engine/lib/figures.mjs)
//
//  À QUOI ÇA SERT
//  Un article de ce réseau parle de chiffres qu'on est seul à avoir. Les écrire
//  en toutes lettres, c'est les rendre invisibles ; les tracer, c'est les rendre
//  citables. Ce module transforme un DESCRIPTEUR (un petit JSON déposé dans
//  `engine/data/figures/`) en un SVG rendu AU BUILD : aucun JavaScript n'est
//  envoyé au navigateur pour l'afficher, la figure est dans le HTML.
//
//  ⭐ Sur un site de savoir, une figure n'est PAS une décoration : c'est du
//     contenu — recalculable, sourçable, et que personne d'autre ne publie.
//
//  ⭐⭐ TROIS RÈGLES QUI NE SE NÉGOCIENT PAS
//  1. **Le SVG est AUTONOME.** Aucune variable CSS (`var(--primary)`), aucune
//     feuille de style extérieure, aucune police du site. Raison : l'image sera
//     RASTÉRISÉE par le navigateur pour être partagée (cf. le bouton de
//     téléchargement). Un rendu rastérisé ne voit RIEN de la page qui l'entoure :
//     une couleur en variable CSS y devient noire, une police absente devient du
//     Times. Les couleurs arrivent donc du manifeste et sont écrites en dur ici.
//  2. **Le cartouche est OBLIGATOIRE.** Marque, domaine, DATE DE COLLECTE de la
//     donnée et source. Une image se partage sans son article : hors du site,
//     elle doit encore dire d'où elle vient et de quand elle date. Une figure
//     sans date de collecte est une figure qui vieillit en mentant.
//  3. **Aucun chiffre inventé.** Le descripteur porte ses données ET sa
//     provenance. Un descripteur sans `collecte` ni `source` est REFUSÉ au
//     build — bruyamment, pas en silence.
//
//  TYPES : `barres` (comparer des grandeurs) · `series` (une évolution dans le
//  temps) · `jalons` (des événements datés sur un axe).
// =============================================================================

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// Police : une pile SYSTÈME, écrite dans le SVG. Le rastériseur du navigateur
// n'a pas accès aux @font-face de la page ; il faut une police qu'il possède.
const POLICE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

const DIM = { l: 900, marge: 26, cartouche: 46 };

/** Choisit une langue dans un champ `{en, fr, …}` ou renvoie la chaîne telle quelle. */
export const dire = (v, lang, def = 'en') =>
  (v === null || v === undefined) ? ''
    : (typeof v === 'string' ? v : (v[lang] ?? v[def] ?? Object.values(v)[0] ?? ''));

const nf = (lang) => (lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : 'en-GB');
const nombre = (v, lang) => Number(v).toLocaleString(nf(lang));

/** Date de collecte affichée en toutes lettres, dans la langue du lecteur. */
function dateLisible(iso, lang) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(nf(lang), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

const MOT = {
  collecte: { en: 'data collected on', fr: 'données collectées le', es: 'datos recogidos el', de: 'Daten erhoben am', it: 'dati raccolti il' },
  source: { en: 'Source', fr: 'Source', es: 'Fuente', de: 'Quelle', it: 'Fonte' },
  telecharger: { en: 'Download this figure (PNG)', fr: 'Télécharger cette figure (PNG)', es: 'Descargar esta figura (PNG)', de: 'Diese Grafik herunterladen (PNG)', it: 'Scarica questa figura (PNG)' },
};

/**
 * Vérifie un descripteur AVANT de tracer quoi que ce soit.
 * ⭐ Une figure incomplète doit se voir au build. On ne trace pas « au mieux » :
 *    une figure sans provenance est pire que pas de figure du tout.
 */
export function verifierFigure(fig, id = '?') {
  const manque = [];
  if (!fig || typeof fig !== 'object') return [`descripteur illisible (${id})`];
  if (!fig.type) manque.push('type');
  if (!fig.titre) manque.push('titre');
  if (!fig.collecte) manque.push('collecte (date de collecte de la donnée)');
  if (!fig.source) manque.push('source');
  if (!Array.isArray(fig.donnees) || !fig.donnees.length) manque.push('donnees (non vide)');
  return manque.length ? [`figure « ${id} » : champ(s) manquant(s) — ${manque.join(', ')}`] : [];
}

// -----------------------------------------------------------------------------
//  Les trois traceurs. Chacun rend le CORPS du SVG et annonce sa hauteur.
// -----------------------------------------------------------------------------
function tracerBarres(fig, lang, p) {
  const d = fig.donnees;
  const hLigne = 34, hTete = 8;
  const largeurLibelle = Math.min(300, Math.max(...d.map((x) => dire(x.label, lang).length)) * 7.3 + 16);
  const x0 = DIM.marge + largeurLibelle;
  const dispo = DIM.l - x0 - DIM.marge - 78;
  const max = Math.max(...d.map((x) => Number(x.valeur) || 0)) || 1;
  const lignes = d.map((x, i) => {
    const y = hTete + i * hLigne;
    const w = Math.max(2, (Number(x.valeur) || 0) / max * dispo);
    const opac = (0.95 - (i / Math.max(1, d.length)) * 0.5).toFixed(2);
    return `<text x="${x0 - 12}" y="${y + 17}" text-anchor="end" fill="${p.muted}" font-size="13">${esc(dire(x.label, lang))}</text>`
      + `<rect x="${x0}" y="${y + 4}" width="${w.toFixed(1)}" height="18" rx="2" fill="${p.primary}" opacity="${opac}"/>`
      + `<text x="${(x0 + w + 9).toFixed(1)}" y="${y + 18}" fill="${p.text}" font-size="13" font-weight="600">${esc(nombre(x.valeur, lang))}</text>`;
  }).join('');
  return { corps: lignes, hauteur: hTete + d.length * hLigne + 6 };
}

function tracerSeries(fig, lang, p) {
  const d = fig.donnees.filter((x) => Number.isFinite(Number(x.valeur)));
  const h = 230, x0 = DIM.marge + 64, x1 = DIM.l - DIM.marge, y0 = 16, y1 = h - 34;
  const n = d.length;
  const vals = d.map((x) => Number(x.valeur));
  const bas = Math.min(0, ...vals), haut = Math.max(...vals) || 1;
  const px = (i) => x0 + (n < 2 ? 0 : (i / (n - 1)) * (x1 - x0));
  const py = (v) => y1 - ((v - bas) / ((haut - bas) || 1)) * (y1 - y0);
  const trace = d.map((x, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(Number(x.valeur)).toFixed(1)}`).join('');
  const aire = `${trace}L${px(n - 1).toFixed(1)},${y1}L${x0},${y1}Z`;
  const grille = [bas, bas + (haut - bas) / 2, haut].map((v) =>
    `<line x1="${x0}" y1="${py(v).toFixed(1)}" x2="${x1}" y2="${py(v).toFixed(1)}" stroke="${p.grille}" stroke-width="1"/>`
    + `<text x="${x0 - 10}" y="${(py(v) + 4).toFixed(1)}" text-anchor="end" fill="${p.muted}" font-size="11">${esc(nombre(Math.round(v), lang))}</text>`).join('');
  const pas = Math.max(1, Math.ceil(n / 6));
  const axeX = d.map((x, i) => (i % pas === 0 || i === n - 1)
    ? `<text x="${px(i).toFixed(1)}" y="${h - 14}" text-anchor="middle" fill="${p.muted}" font-size="11">${esc(dire(x.label, lang))}</text>` : '').join('');
  return { corps: `${grille}<path d="${aire}" fill="${p.primary}" opacity="0.13"/><path d="${trace}" fill="none" stroke="${p.primary}" stroke-width="2.2" stroke-linejoin="round"/>${axeX}`, hauteur: h };
}

function tracerJalons(fig, lang, p) {
  const d = fig.donnees;
  const hLigne = 30, x0 = DIM.marge + 92;
  const lignes = d.map((x, i) => {
    const y = 12 + i * hLigne;
    return `<text x="${x0 - 16}" y="${y + 14}" text-anchor="end" fill="${p.accent}" font-size="12.5" font-weight="600">${esc(dire(x.label, lang))}</text>`
      + `<circle cx="${x0 - 6}" cy="${y + 10}" r="3.5" fill="${p.primary}"/>`
      + (i < d.length - 1 ? `<line x1="${x0 - 6}" y1="${y + 14}" x2="${x0 - 6}" y2="${y + hLigne + 6}" stroke="${p.grille}" stroke-width="1.5"/>` : '')
      + `<text x="${x0 + 8}" y="${y + 14}" fill="${p.text}" font-size="13">${esc(dire(x.valeur, lang))}</text>`;
  }).join('');
  return { corps: lignes, hauteur: 12 + d.length * hLigne + 8 };
}

const TRACEURS = { barres: tracerBarres, series: tracerSeries, jalons: tracerJalons };

/**
 * Descripteur → SVG autonome (chaîne).
 * @param {object} fig      le descripteur (engine/data/figures/<id>.json)
 * @param {object} ctx      { lang, marque, domaine, palette }
 */
export function figureSVG(fig, ctx) {
  const { lang = 'en', marque = '', domaine = '' } = ctx;
  const pal = ctx.palette || {};
  const p = {
    bg: pal.bg || '#0c0d10', surface: pal.surface || '#16181d',
    text: pal.text || '#e7e9ee', muted: pal.muted || '#9aa0ab',
    primary: pal.primary || '#d4af37', accent: pal.accent || '#c0c5ce',
    grille: pal.muted ? `${pal.muted}33` : '#9aa0ab33',
  };
  const tracer = TRACEURS[fig.type];
  if (!tracer) return '';
  const { corps, hauteur } = tracer(fig, lang, p);

  const titre = dire(fig.titre, lang);
  const note = dire(fig.note, lang);
  const yTitre = 30;
  const yNote = note ? yTitre + 20 : yTitre;
  const yCorps = yNote + 18;
  const yCartouche = yCorps + hauteur + 14;
  const H = yCartouche + DIM.cartouche;

  const ligneSource = `${dire(MOT.source, lang)} : ${dire(fig.source, lang)}`;
  const ligneDate = `${dire(MOT.collecte, lang)} ${dateLisible(fig.collecte, lang)}`;

  // ⚠️ `width`/`height` EXPLICITES en plus du viewBox : sans eux, la
  // rastérisation donne une image de 0 pixel dans plusieurs navigateurs.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DIM.l} ${H}" width="${DIM.l}" height="${H}" `
    + `font-family="${POLICE}" role="img" aria-label="${esc(titre)}">`
    + `<title>${esc(titre)}</title><desc>${esc(note || titre)} — ${esc(ligneSource)}. ${esc(ligneDate)}.</desc>`
    + `<rect width="${DIM.l}" height="${H}" fill="${p.surface}"/>`
    + `<rect width="${DIM.l}" height="4" fill="${p.primary}"/>`
    + `<text x="${DIM.marge}" y="${yTitre}" fill="${p.text}" font-size="17" font-weight="600">${esc(titre)}</text>`
    + (note ? `<text x="${DIM.marge}" y="${yNote}" fill="${p.muted}" font-size="12.5">${esc(note)}</text>` : '')
    + `<g transform="translate(0 ${yCorps})">${corps}</g>`
    + `<line x1="${DIM.marge}" y1="${yCartouche - 2}" x2="${DIM.l - DIM.marge}" y2="${yCartouche - 2}" stroke="${p.grille}" stroke-width="1"/>`
    + `<text x="${DIM.marge}" y="${yCartouche + 16}" fill="${p.muted}" font-size="11.5">${esc(ligneSource)}</text>`
    + `<text x="${DIM.marge}" y="${yCartouche + 33}" fill="${p.muted}" font-size="11.5">${esc(ligneDate)}</text>`
    + `<text x="${DIM.l - DIM.marge}" y="${yCartouche + 16}" text-anchor="end" fill="${p.accent}" font-size="12.5" font-weight="600">${esc(marque)}</text>`
    + `<text x="${DIM.l - DIM.marge}" y="${yCartouche + 33}" text-anchor="end" fill="${p.muted}" font-size="11.5">${esc(domaine)}</text>`
    + `</svg>`;
}

/**
 * La figure complète, prête à insérer dans un article : le SVG + sa légende +
 * le bouton de téléchargement. Le bouton n'est qu'un déclencheur : le script
 * délégué (une seule fois par page, cf. Base.astro) fait le travail. Sans
 * JavaScript, la figure reste visible et lisible — seul le bouton ne fait rien,
 * il est donc masqué tant que le script n'a pas pris la main.
 */
export function figureHTML(fig, ctx) {
  const svg = figureSVG(fig, ctx);
  if (!svg) return '';
  const lang = ctx.lang || 'en';
  const legende = dire(fig.legende, lang) || dire(fig.note, lang);
  const nom = `${(ctx.domaine || 'figure').replace(/^www\./, '')}-${fig.id || 'figure'}-${String(fig.collecte).slice(0, 10)}`;
  return `<figure class="fig" data-fig="${esc(fig.id || '')}" data-fig-nom="${esc(nom)}">`
    + `<div class="fig-svg">${svg}</div>`
    + `<figcaption>${legende ? `<span>${esc(legende)}</span>` : '<span></span>'}`
    + `<button type="button" class="fig-dl" hidden>${esc(dire(MOT.telecharger, lang))}</button>`
    + `</figcaption></figure>`;
}

// =============================================================================
//  LE REGISTRE — un descripteur par fichier, sous engine/data/figures/
// -----------------------------------------------------------------------------
//  Pourquoi un fichier de données et pas des chiffres dans l'article : c'est la
//  même doctrine que partout ici — « le Sheet est l'interface, l'entrepôt est le
//  magasin ». L'auteur écrit `![légende](figure:mon-id)` et ne recopie AUCUN
//  chiffre ; la donnée vient du registre, qui est régénéré depuis l'entrepôt.
//  Un chiffre recopié à la main dans une prose est un chiffre qui se périme.
// =============================================================================
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { manifest } from './manifest.mjs';

const RACINE = process.env.PROJECT_ROOT || process.cwd();
const DOSSIER = join(RACINE, 'engine', 'data', 'figures');
let _reg = null;

/** Tout le registre, chargé une fois. Les descripteurs invalides sont ÉCARTÉS
 *  et signalés : mieux vaut un article sans figure qu'une figure sans source. */
export function registreFigures() {
  if (_reg) return _reg;
  _reg = new Map();
  if (!existsSync(DOSSIER)) return _reg;
  for (const f of readdirSync(DOSSIER).filter((x) => x.endsWith('.json')).sort()) {
    const id = f.replace(/\.json$/, '');
    let fig;
    try { fig = JSON.parse(readFileSync(join(DOSSIER, f), 'utf8')); }
    catch (e) { console.warn(`[figures] ${f} illisible : ${e.message}`); continue; }
    fig.id = fig.id || id;
    const pb = verifierFigure(fig, id);
    if (pb.length) { console.warn(`[figures] ${pb.join(' · ')} — figure ignorée.`); continue; }
    _reg.set(id, fig);
  }
  return _reg;
}

/** Le contexte de rendu d'un site : sa marque, son domaine, sa palette. */
export function contexteFigure(lang) {
  const m = manifest();
  return {
    lang,
    marque: m.site?.brand || '',
    domaine: m.site?.domain || '',
    palette: m.identity?.palette || {},
  };
}

/**
 * `figure:<id>` → HTML complet, ou chaîne vide si l'identifiant est inconnu.
 * ⚠️ Un identifiant inconnu est JOURNALISÉ : une figure qui disparaît d'un
 *    article sans un mot est exactement le genre de panne silencieuse qu'on
 *    passe six mois à ne pas voir.
 */
export function figureParId(id, lang, legende = '') {
  const fig = registreFigures().get(String(id).trim());
  if (!fig) {
    console.warn(`[figures] identifiant inconnu : « ${id} » — rien n'est inséré dans l'article.`);
    return '';
  }
  return figureHTML(legende ? { ...fig, legende } : fig, contexteFigure(lang));
}

export function _resetFigures() { _reg = null; }
