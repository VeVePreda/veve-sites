// Donnees structurees JSON-LD.
import { coteFermee } from './cote.mjs';
import { nu } from './i18n.mjs';
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

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 139b — LE TEXTE QUE LE LECTEUR REÇOIT, JAMAIS LA SÉRIALISATION
// ═══════════════════════════════════════════════════════════════════════════
// CE MODULE EXISTE PARCE QU'IL A ÉTÉ ÉCRIT DEUX FOIS, ET QU'UNE DES DEUX
// COPIES MANQUAIT AU MOMENT OÙ ELLE COMPTAIT.
//
// Le 11/08/2026, `test:titres` a découvert que cinq descriptions de marque
// s'annonçaient à 161–162 caractères alors qu'elles en font exactement 160 :
// `&amp;` occupe CINQ octets dans l'attribut et UN caractère à l'écran. La
// leçon a été écrite, longuement, dans `test_titres.mjs` — et elle y est
// restée.
//
// Le 11/08 au soir, `test:affichage` §5 a été écrit avec `nu()` seul. Il est
// passé vert sur les 147 pages du bac à sable, vert dans les quatre
// conditions, et il a **arrêté le déploiement de production** avec
// **714 noms « trop longs »** dont voici les deux premiers :
//
//     « I&#39;ll Take Those Odds »   compté 24, réellement **20**  ✅ conforme
//     « Mrs. Potts &amp; Chip »      compté 21, réellement **17**  ✅ conforme
//
// ⭐⭐⭐ SEPT CENT QUATORZE FAUX ROUGES, ET LE GABARIT AVAIT RAISON SUR LES
// SEPT CENT QUATORZE. `couperMots()` coupe le texte RÉEL à son budget ;
// l'encodage HTML ne fait qu'allonger sa représentation. ⛔ La réparation
// n'était pas de relever les budgets pour que le banc se taise — c'est
// exactement ce que `test_titres.mjs` interdisait déjà en toutes lettres,
// pour l'autre moitié du même défaut.
//
// ⭐⭐ *Une leçon apprise sur un cas et jamais généralisée produit le cas
// suivant, et le commentaire qui la raconte donne l'illusion qu'elle est
// acquise.* Quatrième occurrence de cette loi dans ce seul lot.
// ⇒ UN MODULE, DEUX IMPORTATEURS. `test:titres` et `test:affichage` appellent
// la même fonction. Il n'y a plus de copie à oublier.
//
// ⚠️ ET ELLE VIT ICI, à côté de `clen()` et `couperMots()` : *la fonction qui
// COMPTE et la fonction qui NETTOIE doivent se lire côte à côte*, sinon on
// appelle la première sans la seconde — ce qui vient d'arriver.
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
const decoder = (s) => String(s)
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  // ⚠️ `&amp;` EN DERNIER, ET CE N'EST PAS UN DÉTAIL : le décoder en premier
  // transformerait `&amp;lt;` en `&lt;` puis en `<` — un décodage en deux
  // tours qui invente un caractère que la page ne contient pas.
  .replace(/&(lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITES[e])
  .replace(/&amp;/g, '&');

/** Le texte tel qu'un LECTEUR le reçoit : sans marqueurs i18n (invisibles, en
 *  trop), entités décodées (visibles, en trop), espaces normalisées.
 *  ⭐⭐ Les deux sont la MÊME faute sous deux costumes : compter le tampon au
 *  lieu du texte. ⛔ Tout `clen()` / `.length` / `.slice()` appliqué à du HTML
 *  servi passe par ici d'abord. */
// 🔴🔴 TROISIÈME COSTUME DE LA MÊME FAUTE, MESURÉ LE 11/08/2026 À 18 h.
//   Marqueurs i18n : invisibles, en trop. Entités : visibles, en trop. Et
//   celui-ci : LARGEUR ZÉRO — invisible, en trop, et il passait.
//     `texteVu('\u200D\u200DSebulba’s Podracer Base')` rendait **25**, l'écran
//     en montre **23**. Mesuré sur 3 782 noms du catalogue réel : **14** en
//     portent (U+200B et U+200D), et l'échantillon hors ligne n'en avait aucun.
// ⚠️ ET LE PIÈGE EST QUE ÇA MARCHAIT DÉJÀ POUR LE BOM. `\s` en JavaScript couvre
//   U+2000→U+200A et U+FEFF, puis **s'arrête juste avant U+200B**. Le remède
//   attrapait donc le voisin par accident, ce qui donnait l'illusion que la
//   classe était couverte. ⭐⭐ *Un remède qui marche par hasard sur un cas voisin
//   se lit comme un remède, et il n'en est pas un.* Un `\s` n'est pas une
//   déclaration d'intention : c'est une liste, et il faut la lire.
// ⛔ CE RETRAIT NE PEUT PAS FAIRE ROUGIR UN BANC : il ne fait que BAISSER une
//   longueur mesurée, jamais la monter. Vérifié : 4 conditions inchangées.
const LARGEUR_ZERO = /[\u200B\u200C\u200D\u2060\uFEFF]/g;

export const texteVu = (s) => decoder(nu(s))
  .replace(LARGEUR_ZERO, '')
  .replace(/\s+/g, ' ')
  .trim();

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 134b — L'ELLIPSE PASSE AU MILIEU, ET C'EST UNE CORRECTION DE FOND
// ═══════════════════════════════════════════════════════════════════════════
// TROUVE PAR `test:titres` DANS LE BUILD DOCKER, SUR LE CATALOGUE REEL — jamais
// sur l'echantillon hors ligne (90 pieces), qui ne contient aucun de ces sets.
//
// LE DEFAUT, MESURE SUR 3 097 PAGES. Trois sets Disney partagent **50
// caracteres de prefixe** :
//     Set : Disney100 Platinum Moments Walt Disney Animation Series 1     (63)
//     Set : Disney100 Platinum Moments Walt Disney Animation Series 2     (63)
//     Set : Disney100 Platinum Moments Walt Disney Animation Studios Series (69)
// Le budget vaut 60. Une coupe PAR LA FIN tombe donc forcement DANS le prefixe
// commun, et les trois rendaient le meme titre :
//     « Set : Disney100 Platinum Moments Walt Disney Animation… »
//
// ⭐⭐⭐ ET LA CAUSE N'EST PAS LA LONGUEUR, C'EST L'ENDROIT DE LA COUPE. Sur ce
// site, ce qui DISTINGUE deux pages voisines vit systematiquement A LA FIN du
// nom : le numero de serie, l'edition (AP / FE), la variante, la rarete, le
// millesime. Couper par la fin, c'est jeter exactement le seul morceau qui
// portait l'information. *Une troncature n'est pas neutre : elle choisit ce
// qu'on perd, et par defaut elle choisit le plus utile.*
//
// ⛔ ET LA VARIANTE « LACHER L'ETIQUETTE QUAND CA DEPASSE » A DEJA ETE ECRITE,
// MESUREE ET REJETEE (`CollectionPage.astro`, l. 39) : **123 collisions**, deux
// fois pire. On ne la reessaie pas.
//
// ⇒ L'ellipse passe AU MILIEU : on garde la tete (on sait de quoi on parle) ET
// la queue (on sait DUQUEL on parle). ⚠️ Deux titres qui ne differeraient QUE
// dans la fenetre elidee collisionneraient encore — c'est pour ca que
// `test:titres` reste le juge, et qu'il tourne sur `dist/` entier.
/** Coupe `s` a `max` caracteres en elidant le MILIEU, tete et queue gardees. */
export function couperMilieu(s, max) {
  const txt = String(s ?? '');
  if ([...txt].length <= max) return txt;
  const mots = txt.split(/\s+/).filter(Boolean);
  // ⭐ ON RAISONNE EN MOTS, PAS EN CARACTERES, ET ON REMPLIT LE BUDGET.
  // Une premiere version coupait a un index puis reculait jusqu'a l'espace :
  // elle rendait 45 caracteres pour un budget de 60 — quinze de gaspilles sur
  // le seul texte que Google affiche. *Un budget qu'on n'utilise pas est une
  // information qu'on jette deux fois.*
  if (mots.length < 3) return couperMots(txt, max);
  const LIEN = ' … ';
  const dispo = max - LIEN.length;
  // 1. LA QUEUE D'ABORD — c'est elle qui DISTINGUE (numero, edition, variante).
  //    On lui reserve une part du budget, mot par mot depuis la fin.
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LOT 150 B — 0,45 -> 0,55, ET C'EST LA MESURE QUI CHOISIT LE CHIFFRE
  // ═════════════════════════════════════════════════════════════════════════
  // LA PANNE, ANNONCEE DIX LIGNES PLUS HAUT PAR CE FICHIER LUI-MEME :
  // « Deux titres qui ne differeraient QUE dans la fenetre elidee
  //   collisionneraient encore. » C'est arrive le 14/08, au deploiement du
  //   quota a 1600, et `test:titres` l'a arrete :
  //     JURASSIC WORLD DOMINION UCI Cinemas (Germany) Digital Collectible
  //     JURASSIC WORLD DOMINION UCI Cinemas (Italy)   Digital Collectible
  //   -> « Set : JURASSIC WORLD DOMINION UCI … Digital Collectible », deux fois.
  //   Le discriminant (`Germany` / `Italy`) vit AU MILIEU, pile dans l'elision.
  //
  // ⭐⭐⭐ LE CHIFFRE N'EST PAS TAILLE SUR CE CAS-LA. Il est mesure sur le
  // CATALOGUE ENTIER — les 2 168 series de `catalogue.csv.gz`, publiees ou non,
  // avec CETTE fonction, pas une reecriture :
  //     ratio   collisions   titre le + long
  //     0,45         2            60      <- avant (les deux ci-dessous)
  //     0,50         1            60
  //     0,55         0            60      <- retenu, premier a zero
  //     0,60-0,75    0            60
  // ⚠️ ET LA SECONDE COLLISION N'AVAIT PAS ENCORE ROUGI — elle serait tombee au
  // palier suivant :
  //     Disney100 Platinum Moments Walt Disney Animation Studios Series 1
  //       - Transformative Potion   (et la Series 2)
  // *Le banc voit ce qui est publie ; la mesure voit ce qui va l'etre.*
  //
  // 📐 CE QUE CA COUTE, MESURE AUSSI. Seules **38 series sur 2 168 (1,8 %)**
  // depassent le budget et sont donc coupees. Au ratio 0,55, **27 titres
  // changent**, dont **12 correspondent a une page DEJA EN LIGNE** (sur 910
  // `/collection/` publiees, soit 1,3 %). La tete moyenne passe de ~31 a
  // **23,9 caracteres** — assez pour savoir de quoi on parle, et la queue porte
  // desormais le discriminant.
  //
  // ⛔ ET ON DIT CE QUE CE CHIFFRE NE FAIT PAS : **un ratio ne peut pas garantir
  // l'absence de collision sur un catalogue qui grandit.** Il n'y a pas de
  // position de coupe qui distingue deux noms sans connaitre le voisin. Le
  // garde-fou reste `test:titres` §3, qui juge `dist/` entier — et le §5 porte
  // desormais les DEUX paires reelles, pour que la regression se voie hors
  // ligne. → regle-note-qui-cite-son-terminateur
  const plafondQueue = Math.floor(dispo * 0.55);
  let queue = '';
  for (let i = mots.length - 1; i >= 1; i--) {
    const essai = queue ? `${mots[i]} ${queue}` : mots[i];
    if ([...essai].length > plafondQueue) break;
    queue = essai;
  }
  // 2. LA TETE ENSUITE — elle prend TOUT ce qui reste.
  let tete = '';
  for (let i = 0; i < mots.length; i++) {
    const essai = tete ? `${tete} ${mots[i]}` : mots[i];
    if ([...essai].length + [...queue].length > dispo) break;
    tete = essai;
  }
  // ⛔ Si l'un des deux est vide, l'elision n'a plus de sens : un seul mot tres
  // long, ou un budget minuscule. On retombe sur la coupe simple plutot que de
  // rendre « … quelquechose », qui ne dit rien du sujet.
  if (!tete || !queue) return couperMots(txt, max);
  return `${tete}${LIEN}${queue}`;
}

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
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 134 — LE BUDGET COMPTAIT DES CARACTERES QUE PERSONNE NE VOIT
// ═══════════════════════════════════════════════════════════════════════════
// TROUVE PAR `test:titres` A SON PREMIER PASSAGE EN CONDITION `I18N_MARQUAGE=1`
// — c'est-a-dire par la quatrieme des quatre conditions de verification, celle
// qu'on est tente de sauter parce que « c'est le meme code ».
//
// LE DEFAUT. Sous `I18N_MARQUAGE=1` — et le Dockerfile de PRODUCTION le pose
// (ligne 245) — `t()` entoure chaque libelle de trois octets invisibles ET du
// NOM DE LA CLE : `\x11item.collection\x12Set\x13`. `clen()` les comptait.
// Un titre de 45 caracteres visibles en declarait 61, franchissait le budget de
// 60, et se faisait COUPER. `marquer_i18n.mjs` retire ensuite les sentinelles —
// donc la production servait un titre ampute pour une longueur qui n'a jamais
// existe.
// 🔴 ET LA COUPE FAISAIT COLLIDER DES PAGES. Mesure du 10/08 sur l'echantillon :
// `/collection/…-3/`, `…-ap/` et `…-fe/` rendaient TOUS LES TROIS
// « Set : Return of the Jedi #1: Poster… » — le suffixe qui les distingue etait
// precisement ce que la coupe emportait. Google n'en indexe qu'une des trois.
// ⭐⭐ C'est SEO-2 en plus grand : le meme defaut, sur des milliers de pages au
// lieu de deux, et invisible parce qu'il ne se voit qu'en comparant des titres
// entre eux — ce qu'aucun banc ne faisait avant celui-ci.
//
// ⚠️ ET UN SECOND RISQUE, CELUI QUI A DEJA COUTE 64 PAGES. `couperMots` sur une
// chaine MARQUEE peut trancher AU MILIEU d'un marqueur. Au lot 129, une coupe a
// 158 caracteres avait laisse un `\x11` orphelin que le post-traitement a suivi
// jusqu'a un `\x13` sept mille octets plus loin, SUPPRIMANT TOUT LE `<head>` au
// passage — sur un build vert. La branche de coupe rend donc du texte NU : on
// ne tend pas au ciseau une chaine dont il ne comprend pas la grammaire.
// ⛔ Les deux autres branches gardent leurs marqueurs : `marquer_i18n.mjs` les
// retire de `<title>` juste apres, c'est son travail et il le fait bien. On ne
// lui prend pas le sien — on cesse seulement de MESURER ce qu'il va effacer.
export function pageTitle(titre, gabarit = '%s', secours = '', journal = null) {
  const brut = String(titre || '').trim();
  if (!brut) return secours;
  const complet = String(gabarit || '%s').replace('%s', brut);
  // ⭐ `clen(nu(...))` PARTOUT : la longueur qui compte est celle que Google
  // lira et que l'onglet du navigateur affichera, pas celle du tampon de build.
  if (clen(nu(complet)) <= TITLE_BUDGET) return complet;
  const dire = journal || ((msg) => console.warn(`[seo] ${msg}`));
  if (clen(nu(brut)) <= TITLE_BUDGET) {
    dire(`titre > ${TITLE_BUDGET} avec le suffixe de marque, suffixe abandonne : "${nu(brut)}" (${clen(nu(complet))})`);
    return brut;
  }
  // 🔴🔴🔴 LOT 134b — ET C'EST BIEN `couperMots`, PAR LA FIN. J'AI ESSAYE
  // `couperMilieu` ICI, GLOBALEMENT, ET LE BANC L'A REFUSE EN UNE MINUTE :
  // 4 nouvelles collisions sur l'echantillon, toutes sur des fiches de comics.
  // ⭐⭐⭐ LA RAISON EST STRUCTURELLE, ET ELLE EST LA LECON DU LOT :
  //   · un SET s'appelle « Disney100 … Animation Series **1** » — ce qui le
  //     distingue est A LA FIN ;
  //   · une FICHE s'appelle « **Alex Ross Main Cover · Common · 3** — Return of
  //     the Jedi #1: Poster Series » — ce qui la distingue est AU DEBUT, et la
  //     fin est le nom de serie que ses quinze voisines partagent.
  // ⇒ **AUCUNE POSITION DE COUPE UNIQUE NE SERT LES DEUX.** Une regle globale
  //   choisie ici sauve une famille en cassant l'autre, sans qu'aucune des deux
  //   ne le dise. La coupe intelligente appartient a l'EMETTEUR, qui sait ou vit
  //   son discriminant — `CollectionPage.astro` pour les sets, `Item.astro` pour
  //   les fiches. Ici on garde la regle neutre, celle qui etait deja verte sur
  //   les 3 097 pages de production.
  const coupe = couperMots(nu(brut), TITLE_BUDGET);
  dire(`titre > ${TITLE_BUDGET} caracteres, coupe : "${nu(brut)}" (${clen(nu(brut))}) -> "${coupe}"`);
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
