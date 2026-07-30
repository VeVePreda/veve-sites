// ⚠️ VeVePreda/veve-sites — src/pages/search-index.json.js
//
// Index de recherche du réseau. Une seule route, servie à la racine, consommée
// par `fetch('/search-index.json')` côté navigateur (Home.astro pour les sites
// de prix, EditorialHome.astro pour les wikis).
//
// ─────────────────────────────────────────────────────────────────────────────
//  DEUX SOURCES, UNE SEULE FORME
// ─────────────────────────────────────────────────────────────────────────────
//  L'index reste un TABLEAU PLAT d'objets courts. Les entrées de prix gardent
//  EXACTEMENT les champs qu'elles avaient — `{s, n}` — parce que le script
//  client de veveprice lit `.s` et `.n` : changer la forme (par exemple en
//  regroupant par langue dans un objet) casserait sa recherche sans qu'aucun
//  build ne s'en plaigne. Les entrées éditoriales ajoutent deux champs, `t`
//  (type) et `l` (langue) ; un champ ajouté est ignoré par un ancien lecteur,
//  un champ déplacé ne l'est pas.
//
//  ⭐ Reste VOLONTAIREMENT PAUVRE : nom + adresse (+ type + langue). Aucun
//  prix, aucune définition, aucun corps d'article. La règle du réseau est
//  « aucun endpoint en vrac » — un index de recherche est la porte la plus
//  facile à oublier.
//
// ─────────────────────────────────────────────────────────────────────────────
//  🔴 LA FAUTE À NE PAS COMMETTRE : INDEXER LE REPLI ANGLAIS
// ─────────────────────────────────────────────────────────────────────────────
//  `collection(page, lang)` applique un repli EN quand une entrée n'est pas
//  traduite. Un index construit naïvement sur les cinq langues candidates
//  contiendrait donc, pour es/it/de, les 157 entrées de `brands`, `history`,
//  `annuaire` et `blog` en ANGLAIS — alors que ces sections ne sont PAS
//  publiées dans ces langues. Mesuré sur les données du 27/07 :
//      index naïf     1 545 entrées   dont 471 FANTÔMES
//      index honnête  1 074 entrées   (en 309 · fr 309 · es/it/de 152)
//  Chacune des 471 aurait mené à une page inexistante — une recherche qui
//  renvoie un 404 est pire qu'une recherche vide : elle a l'air de marcher.
//  ➡️ On n'indexe une section QUE dans les langues où `activeSections(lang)`
//  la retient, et le blog QUE dans `languesBlog()`. Ce sont les mêmes
//  fonctions que la navigation et les `hreflang` : elles ne peuvent pas
//  diverger.
//
//  Poids mesuré de l'index honnête : 55,7 Ko brut, 4,4 Ko gzippé, cinq langues
//  comprises. Le client le charge à la PREMIÈRE FRAPPE, jamais au chargement de
//  la page : un visiteur qui ne cherche rien ne paie rien.
// ─────────────────────────────────────────────────────────────────────────────

import { priceEnabled, editorialEnabled } from '../../engine/lib/features.mjs';
import { dataset } from '../../engine/lib/dataset.mjs';
import { locales } from '../../engine/lib/i18n.mjs';
import { activeSections } from '../../engine/lib/editorial_pages.mjs';
import { collection } from '../../engine/lib/editorial.mjs';
import { blogEnabled, postsFor, languesBlog } from '../../engine/lib/blog.mjs';

/** Le libellé d'une entrée, selon sa section. Une entrée sans libellé n'est pas
 *  indexée : une ligne de recherche vide est un résultat sur lequel on clique
 *  sans savoir où l'on va. */
const LIBELLE = {
  glossary: (r) => r.terme,
  acronyms: (r) => (r.signification ? `${r.sigle} — ${r.signification}` : r.sigle),
  brands: (r) => r.nom_affiche || r.licence,
  history: (r) => r.titre,
  annuaire: (r) => r.nom,
};

async function indexEditorial() {
  const out = [];
  const { active } = locales();
  const languesDuBlog = blogEnabled() ? await languesBlog() : [];

  for (const lang of active) {
    // ⚠️ `activeSections(lang)` et non les sections du manifeste : c'est la
    // liste de ce qui est RÉELLEMENT construit dans cette langue.
    for (const section of activeSections(lang)) {
      const libelle = LIBELLE[section];
      if (!libelle) continue;
      let items = [];
      try {
        items = (await collection(section, lang)).items;
      } catch (e) {
        // Une section muette n'est pas une raison de rendre l'index entier
        // inutilisable — mais elle se journalise, sinon elle se tait.
        console.warn(`[index] ${section}/${lang} illisible : ${e && e.message}`);
        continue;
      }
      for (const r of items) {
        const n = String(libelle(r) || '').trim();
        if (!n) continue;
        out.push({ s: `/${section}/`, n, t: section, l: lang });
      }
    }

    if (languesDuBlog.includes(lang)) {
      let posts = [];
      try { posts = await postsFor(lang); } catch (e) { posts = []; }
      for (const p of posts) {
        const n = String(p?.data?.title || '').trim();
        if (!n) continue;
        out.push({ s: `/blog/${p.slug}/`, n, t: 'blog', l: lang });
      }
    }
  }
  return out;
}

export async function GET() {
  const json = (v) => new Response(JSON.stringify(v), {
    headers: { 'content-type': 'application/json' },
  });

  // --- Sites de PRIX : comportement inchangé, au champ près. ---
  if (priceEnabled()) {
    const ds = await dataset();
    return json(ds.items.map((i) => ({ s: i.path, n: i.qualifie || i.name })));
  }

  // --- Sites ÉDITORIAUX (wikis) ---
  if (editorialEnabled()) {
    const idx = await indexEditorial();
    // ⛔ Zéro entrée sur un site qui a des pages éditoriales est un SIGNAL, pas
    // un résultat : la boîte de recherche serait rendue et ne trouverait
    // jamais rien. Même règle que `fichesDe()`.
    if (!idx.length) {
      console.warn('[index] site éditorial mais AUCUNE entrée indexée — ' +
                   'la recherche sera rendue et restera muette.');
    } else {
      const parLangue = idx.reduce((m, x) => ((m[x.l] = (m[x.l] || 0) + 1), m), {});
      console.log(`[index] ${idx.length} entrées éditoriales ${JSON.stringify(parLangue)}`);
    }
    return json(idx);
  }

  return json([]);
}
