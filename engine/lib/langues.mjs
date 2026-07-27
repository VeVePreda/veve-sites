// =============================================================================
//  langues.mjs — UNE SECTION PAR LANGUE : la couverture de traduction MESURÉE
//
//  ⚠️ CE FICHIER VA DANS LE DÉPÔT  VeVePreda/veve-sites , dans  engine/lib/
//     (chemin exact : engine/lib/langues.mjs)
//
//  LE PROBLÈME QU'IL RÉSOUT
//  --------------------------------------------------------------------------
//  vevewiki portait 152 entrées (87 termes de glossaire, 65 sigles) DÉJÀ
//  traduites en espagnol, italien et allemand — et invisibles, parce que le
//  moteur ne savait activer une langue que pour le SITE ENTIER. Ajouter `es` à
//  `languages.active` aurait publié /es/brands/, /es/history/ et /es/annuaire/
//  remplis d'anglais : `resolveLang()` retombe sur la langue par défaut quand
//  une traduction manque, sans rien casser. Un `<html lang="es">` rempli
//  d'anglais est exactement le « défaut par REPLI » du 27/07 — aucun build
//  n'échoue, aucune page n'est vide, et le contenu ment.
//
//  LE PRINCIPE — ⭐ L'ÉTAT SE CALCULE, IL NE SE DÉCLARE PAS
//  --------------------------------------------------------------------------
//  Le manifeste ne déclare que les langues CANDIDATES et un SEUIL. Ce module
//  mesure, dans les snapshots eux-mêmes, la part réellement traduite de chaque
//  (section, langue) et ne laisse publier que ce qui dépasse le seuil.
//  Conséquence voulue : le jour où les notes de marque sont traduites dans le
//  Sheet, /es/brands/ apparaît TOUT SEUL au prochain build. Aucune ligne de
//  code à retoucher — donc aucune traduction ne peut rester invisible parce
//  qu'on a oublié d'éditer un fichier, ce qui est exactement ce qui est arrivé
//  aux 152 entrées.
//
//  CE QUI COMPTE COMME « À TRADUIRE »
//  --------------------------------------------------------------------------
//  Un couple (enregistrement, famille de colonnes) compte SEULEMENT si la
//  langue pivot porte quelque chose. Une note de marque vide en anglais n'est
//  pas une traduction manquante : il n'y a rien à traduire. Sans cette règle,
//  une colonne facultative à moitié remplie condamnerait la section dans
//  toutes les langues.
//
//  GÉNÉRIQUE PAR CONSTRUCTION : rien ici ne connaît vevewiki. Un site sans bloc
//  `editorial` (veveprice) n'est pas mesuré du tout — ses langues restent
//  exactement celles de son manifeste.
// =============================================================================
import { manifest } from './manifest.mjs';
import { locales } from './i18n.mjs';
import { records, isPublished, passesPublishGate } from './editorial.mjs';

const LANG_SUFFIX = /^(.*)_(en|fr|es|it|de)$/;
const norm = (v) => String(v ?? '').trim();

/** Le seuil, en part (0→1). `languages.seuil_traduction` du manifeste ;
 *  défaut 1 = « intégralement traduite, ou pas publiée ». */
export function seuilTraduction() {
  const l = manifest().languages || {};
  const v = Number(l.seuil_traduction);
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 1;
}

/** Ce site a-t-il un bloc éditorial ? Sinon on ne mesure RIEN — zéro régression
 *  sur les sites de prix, dont tout le texte vient de engine/i18n. */
export function siteEditorial() {
  const pages = (manifest().editorial || {}).pages;
  return Array.isArray(pages) && pages.length > 0;
}

// -----------------------------------------------------------------------------
//  La mesure
// -----------------------------------------------------------------------------
const _cache = new Map();

/**
 * Couverture de traduction d'une section dans une langue.
 * @returns {{section,lang,total,traduits,taux,neutre}}
 *   `total`    = couples (enregistrement, famille) que la langue pivot remplit
 *   `traduits` = ceux que `lang` remplit aussi
 *   `taux`     = traduits/total  (0 si la section est vide, 1 si rien n'est traduisible)
 *   `neutre`   = true si la section ne porte AUCUNE colonne suffixée par langue
 */
export function couverture(section, lang) {
  const cle = `${section}/${lang}`;
  if (_cache.has(cle)) return _cache.get(cle);
  const def = locales().def;
  let out;

  if (lang === def) {
    out = { section, lang, total: 0, traduits: 0, taux: 1, neutre: false };
    _cache.set(cle, out);
    return out;
  }

  let recs = [];
  try { recs = records(section, { required: false }); } catch { recs = []; }
  const gardes = recs.filter((r) => isPublished(r) && passesPublishGate(r, section));

  let total = 0;
  let traduits = 0;
  let familleVue = false;

  for (const r of gardes) {
    const familles = new Set();
    for (const k of Object.keys(r)) {
      const m = LANG_SUFFIX.exec(k);
      if (m) familles.add(m[1]);
    }
    if (familles.size) familleVue = true;
    for (const base of familles) {
      // ⭐ Rien dans la langue pivot = rien à traduire. Ne compte pas.
      if (!norm(r[`${base}_${def}`])) continue;
      total += 1;
      if (norm(r[`${base}_${lang}`])) traduits += 1;
    }
  }

  // ⚠️ Une section VIDE n'est pas « traduite à 100 % » : elle n'a rien à
  // publier. Sans ce cas, une section dont le snapshot manque sortirait dans
  // TOUTES les langues — un 0/0 qui vaut 1, le pire des replis.
  const taux = gardes.length === 0 ? 0
             : total === 0 ? 1              // section sans colonne de langue : neutre
             : traduits / total;

  out = { section, lang, total, traduits, taux, neutre: gardes.length > 0 && !familleVue };
  _cache.set(cle, out);
  return out;
}

/**
 * Parmi `candidates`, les langues dans lesquelles cette section est publiable.
 * La langue pivot y est TOUJOURS : c'est elle la source, c'est elle qui définit
 * ce qu'il y a à traduire.
 */
export function languesPour(section, candidates) {
  const { def } = locales();
  const seuil = seuilTraduction();
  return candidates.filter((l) => l === def || couverture(section, l).taux >= seuil);
}

// -----------------------------------------------------------------------------
//  Le journal de build — une seule fois, et il dit LES DEUX CAMPS
// -----------------------------------------------------------------------------
// ⚠️ Ne journaliser que les manques donnerait un build muet le jour où tout est
// publié — et un build muet ne prouve rien. On imprime le tableau complet : ce
// qui sort ET ce qui est retenu, avec le compte exact.
let _journalFait = false;
export function journalLangues(sections) {
  if (_journalFait || !siteEditorial()) return;
  _journalFait = true;
  const { active, def } = locales();
  const seuil = seuilTraduction();
  const secondes = active.filter((l) => l !== def);
  if (!secondes.length) return;
  console.log(`[langues] seuil de publication ${Math.round(seuil * 100)} % — langue pivot « ${def} »`);
  for (const s of sections) {
    const cols = secondes.map((l) => {
      const c = couverture(s, l);
      const pct = Math.round(c.taux * 100);
      return `${l} ${c.taux >= seuil ? '✓' : '·'} ${String(pct).padStart(3)} %${c.total ? ` (${c.traduits}/${c.total})` : ''}`;
    });
    console.log(`[langues]   ${String(s).padEnd(10)} ${cols.join('  |  ')}`);
  }
}

/** Réinitialise le cache (tests). */
export function _resetLangues() { _cache.clear(); _journalFait = false; }
