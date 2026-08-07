// Donnees structurees JSON-LD.
import { coteFermee } from './cote.mjs';
export const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

// =============================================================================
//  TITRE DE PAGE — budget de 60 caracteres, applique A LA RACINE
// -----------------------------------------------------------------------------
//  Google tronque un <title> au-dela d'environ 60 caracteres. Le gabarit ajoute
//  un suffixe de marque (`seo.title_template`, ex. « %s | VeVe Wiki ») : un titre
//  d'article deja long PASSE la limite sans que personne ne le voie.
//
//  Regle, du moins destructif au plus destructif :
//    1. titre + suffixe tient dans le budget       -> on garde tout ;
//    2. sinon le titre SEUL tient                  -> on LACHE le suffixe
//                                                     (la marque est deja dans
//                                                      l'URL, l'og:site_name et
//                                                      le fil d'ariane) ;
//    3. sinon                                      -> coupe sur une FRONTIERE DE
//                                                     MOT + ellipse.
//  Dans les cas 2 et 3 on JOURNALISE : un titre rabote doit se voir au build,
//  jamais se decouvrir six mois plus tard dans la Search Console.
//
//  ⚠️ On compte les caracteres REELS ([...s].length), pas les octets ni les
//  entites HTML : « Black & White » fait 13 caracteres, pas 17 (`&amp;`).
// =============================================================================
export const TITLE_BUDGET = 60;

/** Longueur en caracteres reels (paires de substitution comptees pour 1). */
export const clen = (s) => [...String(s ?? '')].length;

/** Coupe `s` a `max` caracteres sur une frontiere de mot, ellipse comprise. */
export function couperMots(s, max) {
  const cs = [...String(s ?? '')];
  if (cs.length <= max) return cs.join('');
  const dur = cs.slice(0, Math.max(1, max - 1)).join('');
  const esp = dur.lastIndexOf(' ');
  return (esp > max * 0.5 ? dur.slice(0, esp) : dur).replace(/[\s,;:.\u2013-]+$/, '') + '…';
}

/**
 * Titre final d'une page.
 * @param {string} titre     titre editorial (peut etre vide -> `secours`)
 * @param {string} gabarit   `seo.title_template` du manifeste, ex. « %s | VeVe Wiki »
 * @param {string} secours   titre d'accueil quand `titre` est vide
 * @param {(msg:string)=>void} journal  ou signaler un raboutage (defaut console.warn)
 */
export function pageTitle(titre, gabarit = '%s', secours = '', journal = null) {
  const brut = String(titre || '').trim();
  if (!brut) return secours;
  const complet = String(gabarit || '%s').replace('%s', brut);
  if (clen(complet) <= TITLE_BUDGET) return complet;
  const dire = journal || ((msg) => console.warn(`[seo] ${msg}`));
  if (clen(brut) <= TITLE_BUDGET) {
    dire(`titre > ${TITLE_BUDGET} avec le suffixe de marque, suffixe abandonne : "${brut}" (${clen(complet)})`);
    return brut;
  }
  const coupe = couperMots(brut, TITLE_BUDGET);
  dire(`titre > ${TITLE_BUDGET} caracteres, coupe : "${brut}" (${clen(brut)}) -> "${coupe}"`);
  return coupe;
}

// 🔴🔴 LOT 101 — `offers.price` ETAIT LA FUITE LA PLUS COUTEUSE DE TOUTES.
// Une donnee structuree n'est pas lue par un visiteur : elle est lue par les
// MOTEURS, recopiee dans les resultats de recherche, et conservee dans leur
// cache bien apres qu'on l'a retiree de la page. Ce champ servait le plancher
// courant a Google, en clair, sur 8 500 pages — c'est-a-dire le produit qu'on
// veut vendre, publie a l'endroit precis d'ou on ne peut plus le rappeler.
//
// ⭐⭐⭐ LE RETRAIT EST INCONDITIONNEL QUAND LA PORTE EST FERMEE, ET IL NE SE
// NEGOCIE PAS AVEC UN `<Gate>` : le JSON-LD n'a pas de rendu conditionnel, pas
// de CSS, pas de JavaScript. Il est dans le HTML ou il n'y est pas.
// ⭐ En pratique la ligne serait deja inerte — `item.floor` n'existe plus apres
// `projeter()`, donc le ternaire retomberait sur `{}`. ON GARDE QUAND MEME LE
// TEST DE LA PORTE : « ca se trouve inerte » et « c'est interdit » ne sont pas
// la meme chose, et c'est la premiere qui se defait au lot suivant sans bruit.
// ⛔ NE JAMAIS declarer un `offers` sans prix « pour garder la donnee riche » :
// une donnee structuree est une PROMESSE faite au moteur, et une offre sans
// montant est une promesse vide — Search Console la signale comme une erreur.
export const productLd = (item, url, brand) => ({
  '@context': 'https://schema.org', '@type': 'Product',
  name: item.qualifie || item.name, sku: item.uuid, url,
  brand: { '@type': 'Brand', name: item.brand || brand },
  category: item.series || undefined,
  ...(!coteFermee() && item.floor ? { offers: { '@type': 'Offer', price: item.floor, priceCurrency: 'USD', availability: (item.listings || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url } } : {}),
});

export const breadcrumbLd = (parts) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: parts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, item: p.url })),
});

export const itemListLd = (items, url) => ({
  '@context': 'https://schema.org', '@type': 'ItemList', url,
  numberOfItems: items.length,
  itemListElement: items.slice(0, 50).map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
});

// =============================================================================
//  DONNEES STRUCTUREES DES PAGES EDITORIALES — ajoutees le 29/07/2026
// -----------------------------------------------------------------------------
//  Jusqu'ici, la plus grande surface editoriale du reseau — glossaire, sigles,
//  annuaire, chronologie, marques — n'emettait QUE le fil d'Ariane. Des
//  centaines d'entrees parfaitement structurees dans le HTML, et rien qui les
//  declare a un moteur.
//
//  ⭐ REGLE DE CE FICHIER, ET ELLE VAUT POUR TOUT CE QUI SUIT :
//     « une donnee structuree est une PROMESSE faite au moteur, pas un vœu ».
//     On ne declare donc que ce que la page porte VRAIMENT :
//       - pas de `datePublished` inventee ;
//       - pas d'`Article` sur une page qui n'est pas un article ;
//       - une entree sans definition ne devient pas un `DefinedTerm` vide ;
//       - une date imprecise (« 2020-10 ») reste imprecise, elle n'est pas
//         completee en « 2020-10-01 ».
// =============================================================================

// Retire les cles vides d'un objet — un `"description": null` dans un JSON-LD
// est une promesse vide, pas une absence.
const net = (o) => Object.fromEntries(
  Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

/**
 * Un GLOSSAIRE ou une liste de SIGLES.
 * `termes` : [{ name, description, url }] — `url` est l'ancre de l'entree.
 * ⚠️ Une entree sans definition est ECARTEE : `DefinedTerm` sans `description`
 *    n'apprend rien et gonfle la promesse.
 */
export const definedTermSetLd = ({ name, description, url, termes }) => {
  const retenus = (termes || []).filter((x) => x && x.name && x.description);
  return net({
    '@context': 'https://schema.org', '@type': 'DefinedTermSet',
    name, description: description || undefined, url,
    hasDefinedTerm: retenus.length ? retenus.map((x) => net({
      '@type': 'DefinedTerm', name: x.name, description: x.description,
      url: x.url || undefined, inDefinedTermSet: url,
    })) : undefined,
  });
};

/**
 * Une CHRONOLOGIE : une liste ordonnee de jalons dates.
 * ⚠️ `startDate` n'est pose QUE si la date est une date ISO reconnaissable
 *    (AAAA, AAAA-MM ou AAAA-MM-JJ). Le Sheet porte des precisions variables ;
 *    inventer un jour ferait dire au moteur ce que la page ne dit pas.
 */
const DATE_ISO = /^\d{4}(-\d{2}(-\d{2})?)?$/;
export const chronologieLd = (jalons, url) => net({
  '@context': 'https://schema.org', '@type': 'ItemList', url,
  numberOfItems: jalons.length,
  itemListElement: jalons.slice(0, 100).map((j, i) => net({
    '@type': 'ListItem', position: i + 1,
    item: net({
      '@type': 'Event', name: j.name,
      startDate: DATE_ISO.test(String(j.date || '')) ? j.date : undefined,
      description: j.description || undefined,
      url: j.url || undefined,
    }),
  })),
});

/**
 * Une page QUI PARLE D'UNE ENTITE (fiche de marque / licence).
 * ⭐ Volontairement `WebPage` + `about`, PAS `Article`. Une fiche de marque est
 *    faite d'une note de 30 caracteres et de chiffres calcules : la declarer
 *    comme un article serait une promesse que la page ne tient pas, et Google
 *    pese le contenu maigre au niveau du SITE.
 */
export const pageAProposLd = ({ name, description, url, type = 'Brand', aPropos }) => net({
  '@context': 'https://schema.org', '@type': 'WebPage',
  name, description: description || undefined, url,
  about: net({ '@type': type, name: aPropos || name }),
});

// `avecRecherche` : n'annoncer un SearchAction QUE si le site rend vraiment une
// boite de recherche alimentee (cf. searchEnabled() dans features.mjs). Une
// donnee structuree est une promesse faite au moteur, pas un voeu.
export const websiteLd = (site, url, avecRecherche = false) => ({
  '@context': 'https://schema.org', '@type': 'WebSite', name: site, url,
  ...(avecRecherche ? { potentialAction: { '@type': 'SearchAction', target: `${url}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } } : {}),
});

// =============================================================================
//  TITRE D'ACCUEIL — ⭐ la page la plus importante du site decrivait un AUTRE site
// -----------------------------------------------------------------------------
//  Constate le 27/07/2026 : vevewiki.com titrait
//      « VeVe Wiki — VeVe price history & floor tracker »
//  sur ses DEUX accueils. Le gabarit, faute de titre, retombait sur la cle i18n
//  RESEAU `title.home` — ecrite pour veveprice. Un wiki qui ne publie aucun prix
//  se vendait donc comme un tracker de prix, sur sa page d'entree.
//
//  ⭐ Un defaut par REPLI est le plus dur a voir : rien n'echoue, rien n'est
//     vide, la page s'affiche parfaitement — elle dit simplement autre chose.
//
//  Regle : le titre d'accueil se declare dans le MANIFESTE (`seo.home_title`,
//  par langue). Le repli reseau ne sert plus qu'aux sites de prix, et un site
//  SANS prix qui l'utiliserait quand meme se fait journaliser au build.
export function homeTitle({ brand, homeTitles, lang, defLang, repliReseau, sitePrix, journal }) {
  const propre = (homeTitles && (homeTitles[lang] || homeTitles[defLang] || Object.values(homeTitles)[0])) || '';
  if (propre) return `${brand} — ${propre}`;
  if (!sitePrix) {
    (journal || ((m) => console.warn(`[seo] ${m}`)))(
      `accueil sans \`seo.home_title\` : repli sur le libelle RESEAU "${repliReseau}", ecrit pour un site de PRIX. `
      + `Ce site n'en publie pas — son accueil annonce donc autre chose que ce qu'il est.`);
  }
  return `${brand} — ${repliReseau}`;
}
