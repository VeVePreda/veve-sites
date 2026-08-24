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

/** ⭐⭐ LE SÉLECTEUR DE LANGUE D'INTERFACE EST-IL DANS L'EN-TÊTE PUBLIC ?
 *  ═════════════════════════════════════════════════════════════════════════
 *  🔴🔴 CE PRÉDICAT NE LIT **PAS** `identity.langues_dans`, ET C'EST TOUT LE
 *  SUJET DU LOT 139. Mesuré le 11/08/2026 sur les 147 pages construites :
 *
 *    veveprice  ·  languages.active    = [en]                ← 1 ADRESSE
 *                  languages.interface = [en, fr, es, de]    ← 4 LIBELLÉS
 *
 *  `langues_dans` décide où vont les liens vers les AUTRES ADRESSES
 *  (`alternates`). Sur veveprice il n'y en a qu'une : les trois blocs qui en
 *  dépendent (`.langbar` de l'en-tête, `.globe` du compte, `.f-langues` du
 *  pied) sont soit gatés sur `alternates.length > 1`, soit réduits à un seul
 *  choix — « EN ». Mesuré : **0 `.langbar` et 0 `hreflang` dans le corps des
 *  147 pages**. Basculer `langues_dans` sur un axe public/privé, comme la
 *  notice du lot le proposait, n'aurait donc RIEN affiché du tout.
 *
 *  ⭐⭐⭐ *Une demande peut être parfaitement claire et porter sur un mécanisme
 *  qui ne peut pas la satisfaire.* Ce qu'un visiteur de veveprice ne peut pas
 *  faire aujourd'hui, ce n'est pas « changer d'adresse » — c'est **choisir la
 *  langue de l'interface**, alors que le site en porte quatre. Le seul endroit
 *  qui pose le cookie `vp_langue` est `/compte/`, `/connexion/` et
 *  `/inscription/` : la première redirige un anonyme vers la deuxième, et
 *  personne ne cherche un sélecteur de langue sur une page de connexion.
 *  ⇒ **quatre langues traduites, zéro porte publique.** C'est un circuit
 *  ouvert — *qui écrit, qui lit ?* — et il a vécu depuis le lot 120.
 *
 *  ⛔ POURQUOI UNE CLÉ NEUVE PLUTÔT QU'UNE QUATRIÈME VALEUR À `langues_dans` :
 *  ce réglage-là répond à « OÙ vont les liens d'adresse ». Lui ajouter une
 *  valeur qui veut dire « et par ailleurs, offre les LIBELLÉS » lui donnerait
 *  deux populations dans un seul champ. Le lot 120 a justement séparé les deux
 *  questions (« quelles langues ont une adresse » ≠ « quelles langues ont des
 *  libellés ») ; on ne les recolle pas dans un enum.
 *
 *  ⛔⛔ ET SURTOUT : PAS DE NÉGATION. Le défaut vaut `'compte'`, c'est-à-dire
 *  le comportement d'aujourd'hui — vevewiki, qui ne pose pas la clé, ne bouge
 *  pas d'un octet. Écrire `!== 'compte'` rendrait vraie toute valeur mal
 *  orthographiée : `entete` deviendrait la valeur par DÉFAUT des fautes de
 *  frappe. La comparaison est positive, comme `langueOu === 'entete'` que le
 *  lot qui l'a introduite avait déjà dû corriger.
 *
 *  ⭐ UN SEUL MODULE, DEUX IMPORTATEURS — `Base.astro` (qui ÉMET le bouton) et
 *  `socle_js.mjs` (qui EMBARQUE le script qui le fait marcher). Recopier la
 *  condition dans le second, c'est la panne P30 mot pour mot : le jour où les
 *  deux divergent, on sert un bouton sans script, ou un script sans bouton —
 *  et les deux se déploient en vert. */
export function langueUiDansEntete() {
  return (manifest().identity?.langue_interface_dans || 'compte') === 'entete';
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

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 129 — LE MARQUAGE, ET POURQUOI IL PASSE PAR `t()` ET PAR RIEN D'AUTRE
// ═══════════════════════════════════════════════════════════════════════════
// Preda, 10/08 : « j'ai toujours un problème avec la langue, d'une page à
// l'autre c'est un coup anglais un coup français. »
//
// ⚠️⚠️ MA PROPRE NOTE DISAIT « traduire l'interface = 534 `t()` À MARQUER ».
// MESURÉ AVANT DE CODER : les 536 `t(lang, …)` sont **déjà** marqués et
// fonctionnent parfaitement. Le blocage n'a jamais été là. Il est que les
// 3 097 pages publiques sont **pré-générées** puis **pré-compressées** (3 104
// `.gz`) : au moment où elles se fabriquent, il n'y a personne à qui demander
// sa langue, et au moment où quelqu'un les lit, elles sont déjà écrites.
// ⭐⭐⭐ *Mesurer avant de corriger, même ce qu'on a écrit soi-même.* Sans cette
// vérification j'aurais passé la session à marquer ce qui l'était déjà.
//
// LA SORTIE CHOISIE (Preda, 10/08) : l'échange se fait dans le NAVIGATEUR. Le
// HTML reste anglais — le cache partagé, la précompression et le SEO anglais
// tout juste posé restent intacts — et un script échange les libellés chez qui
// a un cookie de langue.
//
// ⛔ POUR ÇA IL FAUT SAVOIR QUEL MORCEAU DE TEXTE EST QUELLE CLÉ, ET IL N'Y A
//    QUE DEUX FAÇONS DE LE SAVOIR :
//    ① retrouver la clé à l'envers, en cherchant le texte anglais dans le
//       dictionnaire. ⛔ REFUSÉ, et c'est important : une pièce nommée
//       « History » ou une série nommée « Origins » se ferait traduire comme un
//       libellé d'interface. *Un dictionnaire inversé confond un libellé avec
//       une donnée qui lui ressemble* — et sur un catalogue de 19 412 pièces,
//       la collision n'est pas une hypothèse.
//    ② demander à `t()` de dire qui il est. C'est ce qu'on fait.
//
// ⭐⭐ ET ON NE TOUCHE AUCUN DES 536 APPELS. Un marquage posé à la main sur 536
// sites serait faux dès le premier oubli, et surtout dès le PROCHAIN `t()`
// écrit par quelqu'un qui n'a pas lu ce commentaire. Ici c'est `t()` lui-même
// qui s'annonce : tout appel présent ET FUTUR est marqué sans effort.
//
// ⛔ LE MARQUAGE NE VIT QUE PENDANT LE BUILD. `I18N_MARQUAGE=1` est posé sur la
// commande de build et sur elle seule ; le serveur de production (`node
// dist/server/entry.mjs`) est un AUTRE processus, qui ne l'a pas. Les pages
// rendues à la demande — `/compte/`, `/favoris/`, `/market/` — rendent donc du
// texte NU, déjà dans la bonne langue : elles ont un visiteur, elles n'ont rien
// à échanger. ⭐ Les deux mondes ne se croisent jamais.
//
// ⚠️ LES SENTINELLES SONT DES CARACTÈRES DE CONTRÔLE (U+0011..U+0013), pas des
// balises : ils traversent l'échappement HTML d'Astro sans être transformés, et
// ils ne peuvent apparaître dans aucun texte réel. `outils/marquer_i18n.mjs`
// les convertit en `data-i18n` après le build. ⛔ Si ce post-traitement ne
// tourne pas, ils resteraient VISIBLES dans la page : `test:i18n` refuse toute
// sentinelle survivante dans `dist/`, c'est la première chose qu'il regarde.
export const SENT_DEB = '';
export const SENT_MIL = '';
export const SENT_FIN = '';

// ⭐⭐⭐ `nu()` — LE TEXTE SANS SES MARQUEURS, ET IL EST OBLIGATOIRE DÈS QU'ON
// MESURE OU QU'ON COUPE. Le marquage rend la chaîne PLUS LONGUE de bytes
// invisibles. Tout code qui fait `.slice(0, 158)`, `.length`, `.padEnd()` ou
// `.split()` sur un résultat de `t()` travaille donc sur une longueur fausse.
// 🔴 MESURÉ, ET ÇA A COÛTÉ 64 PAGES : `EditorialEntry.astro` compose la
// description SEO puis la coupe à 158 caractères. Avec les marqueurs, la coupe
// tombait AU MILIEU d'un marqueur — laissant un `␑` orphelin que le
// post-traitement suivait jusqu'à trouver un `␓` sept mille octets plus loin,
// **supprimant tout le `<head>` au passage**. Les pages partaient nues, sans
// feuille de style, et le build restait vert.
// ⛔ Et même sans ça : la description SEO aurait été RACCOURCIE par des octets
//    invisibles. La coupe doit voir le texte, pas le balisage.
export const nu = (s) => String(s ?? '')
  .replace(new RegExp(`${SENT_DEB}[^${SENT_MIL}]*${SENT_MIL}`, 'g'), '')
  .replace(new RegExp(SENT_FIN, 'g'), '')
  // ⚠️ Et le balai de fin : une sentinelle ORPHELINE (coupée de ses voisines)
  // ne correspond à aucun motif ci-dessus. On la retire quand même — mieux vaut
  // un texte nu qu'un caractère de contrôle servi à un navigateur.
  .replace(new RegExp(`[${SENT_DEB}${SENT_MIL}${SENT_FIN}]`, 'g'), '');

export function t(lang, key, vars) {
  const d = dict(lang);
  const raw = d[key] !== undefined ? d[key] : (dict(locales().def)[key] ?? key);
  const texte = !vars ? raw
    : String(raw).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''));
  if (process.env.I18N_MARQUAGE !== '1') return texte;
  // ⚠️ UN TEXTE VIDE NE SE MARQUE PAS : une clé qui rend '' produirait un
  // `<span data-i18n>` vide, donc un nœud invisible que rien ne justifie.
  if (texte === '' || texte === null || texte === undefined) return texte;
  // ⛔ ON MARQUE LA CLÉ, JAMAIS LES VARIABLES SUBSTITUÉES. `t(lang,'x',{n:1200})`
  // rend « 1 200 pièces suivies » : le nombre appartient à la DONNÉE, pas au
  // libellé. Le navigateur ne peut donc pas re-substituer — il reçoit la clé ET
  // le texte anglais déjà rempli, et `marquer_i18n.mjs` marque ce cas comme
  // « variable » pour qu'on ne l'échange pas à tort.
  return `${SENT_DEB}${key}${vars ? '!' : ''}${SENT_MIL}${texte}${SENT_FIN}`;
}

// Valeur de manifeste pouvant etre une chaine OU une carte { en: "...", fr: "..." }
export function pick(value, lang) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value[locales().def] ?? Object.values(value)[0] ?? '';
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 161 — `pick()` NE DISAIT PAS QUI IL ÉTAIT, DONC IL NE S'ÉCHANGEAIT PAS
// ═══════════════════════════════════════════════════════════════════════════
// MESURÉ le 24/08/2026 sur les 158 pages servies : **8 048 libellés
// échangeables, et 312 qui ne le sont pas** — dont la devise sous le logo, les
// quatre liens légaux du pied de page (156 pages chacun) et **toute la page
// `/offre/`, formules comprises**. La page qui vend était la moins traduite.
//
// ⭐⭐⭐ ET CE N'ÉTAIT PAS UN DÉFAUT DE TRADUCTION. `manifest.yml` porte
// `fr/en/es/de/it` pour l'accroche comme pour les paliers ; `engine/legal/*.json`
// porte les cinq titres. **Les traductions existaient toutes.** Ce qui manquait,
// c'est que `pick()` rend la chaîne anglaise choisie AU BUILD, sans sentinelle :
// le navigateur n'a rien à échanger, et rien ne le signale.
//
// ⭐⭐ LE COMMENTAIRE DU LOT 129, VINGT LIGNES PLUS HAUT, PORTAIT DÉJÀ LA
// RÉPONSE : « il n'y a que deux façons de savoir quel texte est quelle clé —
// retrouver la clé à l'envers (REFUSÉ : une pièce nommée "History" se ferait
// traduire), ou DEMANDER À `t()` DE DIRE QUI IL EST. » On demande la même chose
// à `pick()`. La seule différence : `pick()` ne connaît pas sa clé, puisque sa
// valeur vient du manifeste — c'est donc l'appelant qui la donne.
//
// LA CONVENTION, ET ELLE EST MÉCANIQUE — ⛔ pas un nom choisi au hasard :
//   `mf.<chemin.dans.le.manifeste>`   ex. `mf.identity.accroche`
//   `lg.<doc>`                        ex. `lg.mentions`  (engine/legal/<lang>.json)
// ⭐ `outils/marquer_i18n.mjs` RÉSOUT ces clés en relisant le manifeste et les
// fichiers légaux — donc **aucun registre à tenir, aucune valeur recopiée**.
// Une clé dont le chemin ne mène nulle part est signalée, pas ignorée.
//
// ⛔ NE PAS écrire `pickT(x, lang, 'accroche')` : sans le préfixe, le marqueur
//    la chercherait dans `engine/i18n/` et ne la trouverait pas. Le préfixe
//    n'est pas décoratif, c'est l'adresse de la valeur.
export function pickT(value, lang, cle) {
  const texte = pick(value, lang);
  if (process.env.I18N_MARQUAGE !== '1') return texte;
  if (texte === '' || texte === null || texte === undefined) return texte;
  // ⚠️ Une valeur qui n'est PAS une carte de langues n'a rien à échanger : la
  // marquer promettrait une traduction qui n'existe pas, et le dictionnaire
  // servi porterait une clé morte. On la rend nue.
  if (typeof value === 'string') return texte;
  return `${SENT_DEB}${cle}${SENT_MIL}${texte}${SENT_FIN}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 128 — UNE ADRESSE SE PRÉFIXE AVEC UNE LANGUE QUI A UNE ADRESSE
// ═══════════════════════════════════════════════════════════════════════════
// MESURÉ LE 10/08/2026, serveur réel : depuis `/favoris/` avec le cookie
// `vp_langue=fr`, le header et le pied de page émettaient DIX-NEUF liens, dont
// **HUIT rendaient 404** — `/fr/analytics/`, `/fr/collections/`, `/fr/offre/`,
// les quatre pages légales, et **`/fr/`, c'est-à-dire le logo**. Preda :
// « quand je passe de favoris à analytics ça me renvoie sur la page d'accueil,
// il y a des problèmes de menu dans le header ».
//
// LA CAUSE, ET ELLE EST ÉCRITE EN TOUTES LETTRES DANS LE MANIFESTE DEPUIS LE
// LOT 120 : « `active` — LES LANGUES QUI ONT UNE ADRESSE. C'est cette liste, et
// elle seule, que lisent les `getStaticPaths`, le sitemap et les `hreflang`. »
// `active` vaut `[en]`. `interface` vaut `[en, fr, es, de]`.
// Les pages négociées à la demande — `/compte/`, `/favoris/`, `/dashboard/` —
// choisissent leur langue dans `interface`, ce qui est CORRECT : elles n'ont
// qu'une adresse et traduisent leurs libellés. Puis elles passaient cette
// langue à `localize()`, qui fabriquait des adresses `/fr/…` **qui n'existent
// pas**.
//
// ⭐⭐⭐ TROIS LISTES, ET LA FAUTE EST DE N'EN VOIR QU'UNE. « En quelle langue
// PARLER » et « à quelle ADRESSE aller » sont deux questions ; les confondre ne
// produit ni erreur, ni build rouge, ni banc qui tombe — ça produit un menu où
// huit liens sur dix-neuf sont morts, et personne ne s'en aperçoit tant que
// personne ne clique avec un cookie non anglais.
// ⭐⭐ C'est la MÊME famille que `connecte()` / `franchit()` : « qui es-tu »
// n'est pas « à quoi as-tu droit ». Ici : « quelle langue lis-tu » n'est pas
// « quelle langue est publiée ».
//
// ⛔ LE REPLI EST LE BON REPLI : une langue sans adresse retombe sur la langue
// par défaut, qui a TOUJOURS une adresse. On ne rend jamais un lien mort.
// ⚠️ CETTE LIGNE NE CHANGE RIEN SUR vevewiki, dont les cinq langues sont toutes
// dans `active` — vérifié, 268 pages inchangées. Elle ne mord que là où une
// langue d'INTERFACE s'était échappée dans une URL.
// 🔴 Elle guérit aussi le canonical : `Base.astro` construisait
//    `<link rel=canonical href=".../fr/favoris/">` vers une page inexistante.
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 162 — LE BLOG A SA PROPRE LISTE D'ADRESSES, ET `prefixOf` NE LA
//                  CONNAISSAIT PAS
// ═══════════════════════════════════════════════════════════════════════════
// MESURÉ LE 24/08/2026 SUR LA PRODUCTION, page par page :
//   · `/fr/blog/` répond 200 et liste bien l'article français ;
//   · CHACUN de ses liens pointe vers `/blog/…`, c'est-à-dire vers l'ANGLAIS ;
//   · le `hreflang="fr"` de l'article français annonce l'adresse ANGLAISE ;
//   · `/fr/rss.xml` est construit, et le `<head>` français annonce `/rss.xml` ;
//   · le plan du site ne contient AUCUNE adresse `/fr/blog/…`.
// Autrement dit : les pages françaises du blog existent, sont servies par
// nginx (`location ^~ /fr/blog/`), et RIEN sur le site n'y mène. Un blog
// français où chaque lien ramène à l'anglais est un cul-de-sac.
//
// LA CAUSE EST LA MÊME QU'AU LOT 128, D'UN CRAN PLUS LOIN. Le lot 128 a eu
// raison de dire « une adresse se préfixe avec une langue QUI A UNE ADRESSE »,
// et il a lu cette liste dans `active`. Or `active` répond à la question pour
// les pages du SITE, et le blog — seul contenu du réseau qui diffère vraiment
// d'une langue à l'autre — tient sa propre liste (`languages.blog`), que les
// `getStaticPaths`, nginx et le plan du site respectent déjà.
// ⇒ Ce n'est donc pas UNE liste ni DEUX : c'est « quelle liste, pour QUEL
//   chemin ». Le préfixe se décide sur le CHEMIN demandé, en un seul endroit,
//   et les ~35 appels à `localize()` du blog guérissent d'un coup.
//
// ⭐ `/rss.xml` en fait partie : la route `[locale]/rss.xml` est construite sur
//    les langues du blog, exactement comme `[locale]/blog/`.
// ⭐ LE REPLI NE CHANGE PAS : une langue qui n'a d'adresse dans AUCUNE des deux
//    listes retombe sur la langue par défaut. On ne rend jamais un lien mort.
// ⚠️ SANS EFFET SUR vevewiki, dont les cinq langues sont dans `active` : les
//    deux listes y donnent le même préfixe. Vérifié par la chaîne, deux sites.
// ⛔ NE PAS étendre ce motif à d'autres chemins « par prudence » : chaque
//    entrée est une promesse que la page existe dans cette langue, et une
//    promesse non tenue, ici, s'appelle un 404.
const CHEMIN_DU_BLOG = /^\/(blog(\/|$)|rss\.xml$)/;

export const prefixOf = (lang, chemin = '') => {
  const { active, def } = locales();
  const adressables = CHEMIN_DU_BLOG.test(chemin) ? languesDeclareesBlog() : active;
  const adresse = adressables.includes(lang) ? lang : def;
  return adresse === def ? '' : `/${adresse}`;
};
export const localize = (lang, path) => {
  const chemin = path.startsWith('/') ? path : '/' + path;
  return `${prefixOf(lang, chemin)}${chemin}`;
};

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
