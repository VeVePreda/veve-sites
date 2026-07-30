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
import { fichesDe, cheminFiche, ancreJalon, ancreTerme, ancresAnnuaire } from '../../engine/lib/editorial_entries.mjs';
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

// -----------------------------------------------------------------------------
//  L'ANCRE — corrigé le 30/07/2026 après essai en production
// -----------------------------------------------------------------------------
//  ⚠️ DÉFAUT CONSTATÉ : l'index renvoyait `/glossary/` pour les 87 termes. On
//  cherchait « Floor Price », on cliquait, on atterrissait en HAUT d'une page de
//  87 définitions — à charge de retrouver le mot soi-même. Une recherche qui
//  amène sur la bonne PAGE mais pas au bon ENDROIT ne fait que la moitié du
//  travail, et c'est la moitié facile.
//
//  ⛔ LA RÈGLE QUE `Editorial.astro` ÉCRIT DÉJÀ, ET QU'ON SUIT ICI :
//     « une entrée ne reçoit une url QUE si elle porte vraiment un `id` dans le
//       HTML. Renvoyer vers une ancre qui n'existe pas serait la même faute que
//       les hreflang vers des pages non construites. »
//  D'où le tableau ci-dessous, écrit en regardant le gabarit, pas en devinant :
//     glossary  <div class="term" id={ancreTerme(r)}>  -> #<slug>
//     acronyms  <div class="term" id={ancreTerme(r)}>  -> #<slug>
//               ⚠️ PAS le sigle brut : 8 sur 65 portent une espace, donc un
//               identifiant HTML invalide et une ancre inatteignable.
//     history   <li class="milestone" id={ancre}> -> #j-…
//     annuaire  <div class="item">                -> id AJOUTÉ dans le même lot
//     brands    aucun id sur l'index, mais 29 licences sur 44 ont leur PROPRE
//               fiche : on envoie vers la fiche, pas vers l'index + ancre.
//
//  ⭐ `ancreJalon` et `slugifier` sont IMPORTÉS, jamais recopiés. Le dépôt
//  portait déjà trois copies de la règle d'ancre (Editorial.astro,
//  EditorialHome.astro, editorial_entries.mjs) — et elles avaient DÉJÀ divergé :
//  `slice(0, 60)` d'un côté, `slice(0, 70)` de l'autre. Sans effet aujourd'hui
//  (le plus long identifiant de jalon fait 29 caractères, mesuré sur les 41), et
//  parfaitement silencieux le jour où un titre dépasse. Une quatrième copie
//  aurait été une quatrième occasion.
const ancreDe = {
  glossary: (r) => (ancreTerme(r) ? `#${ancreTerme(r)}` : ''),
  acronyms: (r) => (ancreTerme(r) ? `#${ancreTerme(r)}` : ''),
  history: (r) => `#${ancreJalon(r)}`,
  // ⚠️ remplacé plus bas par `ancresAnnuaire(items)` : l'unicité d'un nom ne
  // se juge pas sur une entrée seule, mais sur la liste entière.
  annuaire: null,
  brands: () => '',   // traité à part : la fiche l'emporte sur l'ancre
};

async function indexEditorial() {
  const out = [];
  const { active } = locales();
  const languesDuBlog = blogEnabled() ? await languesBlog() : [];

  for (const lang of active) {
    // Les licences qui ont VRAIMENT une fiche à elles (seuil dans
    // editorial_entries.mjs). Même clé de contenu que Editorial.astro : on
    // n'indexe pas par identité d'objet, `collection()` étant relu ici et dans
    // `fichesDe` — deux instances du même contenu, `Map.has(objet)` toujours
    // faux. Ce piège a déjà coûté 58 fiches inatteignables.
    const fiches = new Map();
    if (activeSections(lang).includes('brands')) {
      try {
        for (const f of await fichesDe('brands', lang)) {
          fiches.set(String(f.record.licence ?? '').trim(), cheminFiche(f.section, f.slug));
        }
      } catch (e) { /* section muette : traitée plus bas */ }
    }

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
      // Même verdict d'unicité que le gabarit, calculé sur la même liste.
      const ancreAnnuaire = section === 'annuaire' ? ancresAnnuaire(items) : null;
      for (const r of items) {
        const n = String(libelle(r) || '').trim();
        if (!n) continue;
        // Une licence qui a sa fiche y va directement ; sinon elle reste sur
        // l'index, sans ancre — l'index des marques n'en porte aucune.
        const versFiche = section === 'brands'
          ? fiches.get(String(r.licence ?? '').trim())
          : null;
        const anc = section === 'annuaire'
          ? (ancreAnnuaire(r) ? `#${ancreAnnuaire(r)}` : '')
          : (ancreDe[section] ? ancreDe[section](r) : '');
        const s = versFiche || `/${section}/${anc}`;
        out.push({ s, n, t: section, l: lang });
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
      // ⭐ On journalise le taux d'ancrage, pas seulement le total : une entrée
      // sans ancre atterrit en haut d'une page de 87 lignes. Si ce taux chute,
      // c'est qu'un gabarit a cessé d'émettre ses `id` — et rien d'autre ne le
      // dirait.
      const ancrees = idx.filter((x) => x.s.includes('#')).length;
      console.log(`[index] ${idx.length} entrées éditoriales ${JSON.stringify(parLangue)} — `
                + `${ancrees} ancrées (${Math.round((ancrees / idx.length) * 100)} %)`);
    }
    return json(idx);
  }

  return json([]);
}
