// ⚠️ VeVePreda/veve-sites — outils/marquer_i18n.mjs   (FICHIER NEUF — lot 129)
// ═══════════════════════════════════════════════════════════════════════════
//  LE POST-TRAITEMENT QUI TRANSFORME LES SENTINELLES EN `data-i18n`
// ═══════════════════════════════════════════════════════════════════════════
//
// `t()` (engine/lib/i18n.mjs) enrobe chaque libellé de trois caractères de
// contrôle quand `I18N_MARQUAGE=1` :   ␑clé␒texte␓
// Ce fichier les relit dans `dist/` et décide, POUR CHAQUE OCCURRENCE, ce
// qu'elle devient. ⛔ Il ne devine rien : il regarde OÙ elle est tombée.
//
// ═══════════════════════════════════════════════════════════════════════════
// TROIS CONTEXTES, TROIS SORTS — et le deuxième est celui qu'on oublie
// ═══════════════════════════════════════════════════════════════════════════
//   ① EN POSITION DE TEXTE  →  <span data-i18n="clé">texte</span>
//      Le navigateur pourra échanger le contenu. C'est le cas utile.
//
//   ② DANS UN ATTRIBUT  (`title="…"`, `aria-label="…"`, `alt="…"`, `content="…"`)
//      →  on RETIRE les sentinelles, on ne marque pas.
//      ⛔ Un `<span>` dans un attribut serait du texte littéral : la page
//      afficherait `<span data-i18n=...>` en toutes lettres. Et un attribut ne
//      peut pas porter d'enfant, donc il n'y a rien à échanger sans réécrire
//      l'attribut lui-même — ce qui demande de savoir LEQUEL, sur QUEL élément.
//      ⭐⭐ C'EST UNE LIMITE ASSUMÉE ET ELLE EST ÉNONCÉE : les infobulles et les
//      libellés d'accessibilité des pages PUBLIQUES restent en anglais. Le banc
//      `test:i18n` les COMPTE et affiche le nombre — une limite qu'on mesure
//      reste une limite ; une limite qu'on tait devient un bug dans six mois.
//
//   ③ DANS `<title>`, `<script>`, `<style>`  →  sentinelles retirées, rien d'autre.
//      Ces éléments ne contiennent que du texte brut : y écrire une balise
//      l'afficherait telle quelle. ⚠️ `<title>` est SEO — et il doit rester
//      anglais, c'est précisément ce que la décision de Preda protège.
//
// ⛔ IL DOIT TOURNER AVANT LA PRÉCOMPRESSION. Le Dockerfile écrit les `.gz` à
// partir des fichiers de `dist/` : compresser d'abord, ce serait servir des
// sentinelles à tout le monde. L'ordre est écrit dans le Dockerfile, et
// `test:i18n` refuse toute sentinelle survivante — le second est ce qui MESURE
// le premier.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DIST = join(ROOT, 'dist');
const RACINE = existsSync(join(DIST, 'client')) ? join(DIST, 'client') : DIST;

const DEB = '';
const MIL = '';
const FIN = '';

if (!existsSync(RACINE)) {
  console.log(`⏸️  ${RACINE} absent — rien à marquer (ce script vient APRÈS npm run build).`);
  process.exit(0);
}

// ── Les fichiers HTML, récursivement.
const html = [];
(function marcher(d) {
  for (const e of readdirSync(d)) {
    const f = join(d, e);
    if (statSync(f).isDirectory()) marcher(f);
    else if (e.endsWith('.html')) html.push(f);
  }
})(RACINE);

// ═══════════════════════════════════════════════════════════════════════════
// LE DÉCOUPAGE — on avance dans le fichier en sachant toujours où l'on est
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Pas de parseur HTML, et ce n'est pas de la paresse : un parseur
// reconstruit le document, donc le RÉÉCRIT — guillemets normalisés, attributs
// réordonnés, entités re-encodées — sur 3 097 fichiers, pour changer trois
// caractères. On ne touche que ce qu'on doit toucher.
// ⚠️ La règle est simple parce que la question l'est : une sentinelle est-elle
// tombée entre un `<` et un `>` ? Si oui elle est dans un attribut.
const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let nTexte = 0;
let nAttribut = 0;
let nAttributRefuse = 0;
let nDeforme = 0;
let nOrphelins = 0;
const clesDeformees = new Set();

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 139 — LE JUGE N'EST PLUS LA FORME, C'EST LE DICTIONNAIRE (P30)
// ═══════════════════════════════════════════════════════════════════════════
// **P30 : 1 199 libellés restés en anglais chez les visiteurs fr/es/de**, et
// la cause était CE contrôle, pas un gabarit. `item.drop.RESERVATION` (et
// `.WAITLIST`, `.CRAFT`, `.AUCTION`) sont des clés RÉELLES, traduites dans les
// CINQ dictionnaires ; la forme ci-dessous les refusait parce qu'un segment
// commence par une majuscule. Elles n'étaient donc jamais marquées, jamais
// échangées, et la page s'affichait parfaitement.
// ⭐⭐⭐ *Le commentaire d'en dessous porte déjà la leçon — « un contrôle trop
// strict produit exactement le même symptôme qu'une vraie panne » — écrite
// pour le `_` de `mod.price_history`. Elle a été apprise sur un cas et n'a pas
// été généralisée : le cas suivant a coûté 1 199 libellés.*
// ⇒ Le prédicat vit désormais dans `engine/lib/cle_i18n.mjs`, importé ICI **et**
//   par `test:i18n` §2 : le marqueur ÉCRIT `data-i18n=`, le banc le RELIT, et
//   deux copies de la même règle finissent toujours par diverger.
// ⛔ La forme SURVIT comme repêchage des clés neuves — voir le module. Ce qui
//   reste refusé échoue au dictionnaire ET à la forme : c'est le profil exact
//   d'un `t()` transformé par un gabarit, et rien d'autre.
import { estUneCle } from '../engine/lib/cle_i18n.mjs';

// ⚠️ CHARGÉ AVANT LA BOUCLE, ET SON ABSENCE SE DIT TOUT HAUT. Un dictionnaire
// muet ferait retomber `estUneCle` sur la forme seule — c'est-à-dire remettre
// P30 en place, en silence, pour la seule raison qu'un chemin a bougé.
// *Un repli silencieux est un repli qu'on découvre trois lots plus tard.*
let DICT_REF = null;
try {
  const { locales: loc0 } = await import(join(ROOT, 'engine', 'lib', 'i18n.mjs'));
  DICT_REF = JSON.parse(readFileSync(join(ROOT, 'engine', 'i18n', `${loc0().def}.json`), 'utf8'));
} catch (e) {
  console.warn(`[i18n] ⚠️ dictionnaire de référence ILLISIBLE (${e.message}) — `
    + 'le juge retombe sur la FORME seule : les clés à segment majuscule '
    + '(item.drop.RESERVATION…) ne seront PAS marquées. C\'est P30 qui revient.');
}

// ⭐⭐⭐ LA FORME D'UNE CLÉ, ET POURQUOI ON LA VÉRIFIE.
// MESURÉ à la deuxième exécution : huit clés arrivaient en CAPITALES —
// `ANALYTICS.TITLE`, `LED.PULSE`… Cause : `{t(lang,'analytics.title').toUpperCase()}`
// dans le gabarit. La transformation s'applique à la chaîne MARQUÉE, donc elle
// met la clé en capitales avec le texte. La clé devient introuvable, le libellé
// n'est jamais échangé, et RIEN NE LE SIGNALE — la page s'affiche parfaitement.
// ⛔ Toute opération sur le résultat de `t()` (`.toUpperCase()`, `.slice()`,
// `.split()`) casse le marquage. On ne peut pas l'empêcher ; on peut le VOIR.
// ⇒ Une clé qui n'a pas la forme d'une clé n'est pas marquée, elle est COMPTÉE
//   et NOMMÉE. `test:i18n` refuse qu'il y en ait.
// ⚠️ Le `_` EST LÉGITIME : `mod.price_history`, `mod.wallet_watch`. La première
// version de cette forme les refusait — huit clés parfaitement valides déclarées
// déformées. ⭐ Un contrôle trop strict produit exactement le même symptôme
// qu'une vraie panne, et coûte le temps qu'on met à comprendre laquelle c'est.
// 🔴 LOT 139 — LA CONSTANTE EST DEVENUE UNE FONCTION, ET SON NOM A CHANGÉ AVEC.
// ⛔ Garder le nom `FORME_CLE` sur un prédicat qui interroge le dictionnaire
// aurait laissé, à l'endroit exact de la panne, un nom qui dit le contraire de
// ce que fait le code. Le prochain lecteur cherchant « pourquoi cette clé
// passe-t-elle ? » aurait relu une regexp qui n'est plus le juge.
const estCle = (c) => estUneCle(c, DICT_REF);

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴⭐⭐⭐ LES LIBELLÉS À VARIABLES — la moitié qui manquait depuis le lot 139
// ═══════════════════════════════════════════════════════════════════════════
//
// Une clé à variables (`rayon.compte` = « {n} pieces in the catalogue · {c}
// have a page on this site. ») arrive ici DÉJÀ REMPLIE : le gabarit a été
// résolu au build, et le texte porte « 2,758 » et « 2,534 ». On la marquait
// `data-i18n-var`, et le navigateur passait son chemin — le commentaire d'à
// côté disait déjà pourquoi : *« pour que le navigateur puisse resubstituer
// S'IL SAIT LE FAIRE »*. Il ne savait pas. Résultat mesuré le 25/08 sur une
// capture de Preda : « 2,758 pieces in the catalogue » en anglais au milieu
// d'une page française, **pour tout le monde**, cache vide compris.
//
// ⭐⭐ CE QUI MANQUAIT N'EST PAS LA TRADUCTION, C'EST LA VALEUR. Le client a le
// gabarit français ; il n'a pas « 2,758 ». Personne ne peut le lui rendre
// après coup — sauf ici, où l'on tient à la fois le gabarit ANGLAIS et le
// texte REMPLI. On les compare, on en sort les variables, on les émet.
//
// ⛔⛔ ET ON REFUSE PLUTÔT QUE DE DEVINER. Deux jetons collés (`{a}{b}`) ou un
// littéral vide rendent le découpage ambigu : « 12 » pourrait être (1, 2) ou
// (12, ∅). Dans ce cas on n'émet RIEN, et le libellé reste anglais — *un texte
// anglais juste vaut mieux qu'un texte français faux*, c'est déjà la doctrine
// des attributs mixtes trente lignes plus haut.
let nVariable = 0, nVariableRefus = 0;

/**
 * Le gabarit de référence (langue pivot) derrière une clé.
 * 🔴🔴 LE DICTIONNAIRE EST **PLAT** : ses clés sont littéralement
 *   `'rayon.compte'`, PAS `{ rayon: { compte } }`. La première version de cette
 *   fonction découpait sur les points et descendait dans l'objet — elle rendait
 *   `null` sur les 26 libellés à variables du site, donc `data-i18n-v` n'était
 *   émis nulle part, donc rien n'était traduit. Et le marquage restait
 *   « réussi » : 0 resubstituable, 26 refusés, aucune erreur.
 * ⭐⭐⭐ MESURE DU 25/08 : ce chiffre imprimé est ce qui a révélé MA faute — sans
 *   lui, j'aurais livré une correction qui ne corrige rien, et le libellé serait
 *   resté anglais en croyant le contraire. *Un compte qu'on imprime est un
 *   compte qui se défend.*
 * ⚠️ On garde le repli imbriqué : si un jour le dictionnaire prend une forme
 *   arborescente, cette fonction ne redeviendra pas muette du jour au lendemain.
 */
const gabaritRef = (cle) => {
  if (!DICT_REF) return null;
  const direct = DICT_REF[cle];
  if (typeof direct === 'string') return direct;
  let n = DICT_REF;
  for (const part of String(cle).split('.')) {
    if (!n || typeof n !== 'object') return null;
    n = n[part];
  }
  return typeof n === 'string' ? n : null;
};

/** Les jetons d'un gabarit, dans l'ordre : `{nom}` nommés, `%s` positionnels. */
const jetonsDe = (g) => [...g.matchAll(/\{(\w+)\}|%s/g)]
  .map((m, i) => ({ nom: m[1] !== undefined ? m[1] : String(i), brut: m[0] }));

/**
 * Les valeurs d'un libellé rempli, ou `null` si le découpage est ambigu.
 * ⭐ On reconstruit le motif DEPUIS le gabarit : c'est la seule façon de ne pas
 *   dépendre de la ponctuation d'une langue en particulier.
 */
function variablesDe(cle, texte) {
  const g = gabaritRef(cle);
  if (!g) return null;
  const jetons = jetonsDe(g);
  if (!jetons.length) return null;

  // Les morceaux littéraux entre les jetons. Un littéral vide AU MILIEU rend
  // deux variables inséparables ⇒ on refuse. (Aux extrémités, c'est normal.)
  const morceaux = g.split(/\{\w+\}|%s/);
  for (let i = 1; i < morceaux.length - 1; i++) {
    if (morceaux[i] === '') return null;
  }
  const ech = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const motif = new RegExp('^' + morceaux.map(ech).join('(.*?)') + '$', 's');
  const m = String(texte).match(motif);
  if (!m) return null;

  const out = {};
  for (let i = 0; i < jetons.length; i++) {
    const v = m[i + 1];
    if (v === undefined) return null;
    out[jetons[i].nom] = v;
  }
  return out;
}


// ⛔ LES BALISES DE TÊTE NE SE MARQUENT PAS. `<meta>`, `<title>`, `<link>`,
// `<html>` : c'est le SEO, et tout ce lot existe pour que le HTML servi aux
// moteurs reste identique pour tout le monde. Un `data-i18n-attr` sur
// `<meta name="description">` ferait dépendre la description du visiteur — sans
// aucun bénéfice, puisque aucun moteur n'exécute l'échange.
const TETE = /^<(meta|title|link|html|base)\b/i;
let nBrut = 0;
let nFichiers = 0;
const clesVues = new Set();
const clesAttribut = new Set();

// ⚠️⚠️ `[^<]*?` ET PAS `[\s\S]*?`, ET CETTE DIFFÉRENCE A COÛTÉ UN `<head>`.
// MESURÉ le 10/08 sur vevewiki : un `<meta description>` portait DEUX libellés
// marqués ; la passe des attributs n'en consommait qu'un et laissait le second
// AMPUTÉ de sa sentinelle de fin. La passe suivante trouvait ce `␑` orphelin et
// cherchait son `␓` — qu'elle finissait par trouver 7 000 octets plus loin,
// dans le corps de la page. Elle a donc SUPPRIMÉ tout ce qu'il y avait entre :
// le canonical, les hreflang, le `<link>` de la feuille de style, l'ouverture
// du `<body>`. **64 pages servies nues, et le build est resté vert.**
// ⭐⭐⭐ Deux bancs l'ont vu, aucun ne cherchait ça : `test:feuille` (« 64 pages
// sans le lien CSS ») et `test:i18n` (« 75 pages portent encore des
// sentinelles »). *Un banc branché sur un symptôme voisin attrape ce qu'aucun
// banc dédié n'aurait deviné* — c'est l'argument pour en avoir plusieurs qui se
// recoupent, pas un par panne.
// ⇒ Un libellé ne traverse JAMAIS un `<`. Avec cette borne, un marqueur
//   incomplet ne peut plus manger que sa propre ligne.
const MOTIF = new RegExp(`${DEB}([^${MIL}]*)${MIL}([^<]*?)${FIN}`, 'g');

for (const f of html) {
  const src = readFileSync(f, 'utf8');
  if (!src.includes(DEB)) continue;
  nFichiers++;

  // Les zones où le texte est BRUT : title, script, style.

  // ═══════════════════════════════════════════════════════════════════════
  // PREMIÈRE PASSE — LES ATTRIBUTS, ET ILS PESAIENT 39 % DES LIBELLÉS
  // ═══════════════════════════════════════════════════════════════════════
  // MESURÉ à la première exécution de ce script : 6 995 libellés en position de
  // texte, et **4 396 en attribut** — infobulles `title=`, `aria-label=`,
  // `alt=`, `placeholder=`. Les laisser en anglais aurait donné une page dont
  // le texte est français et dont CHAQUE infobulle est anglaise, y compris
  // celles que lit un lecteur d'écran. ⭐ La version précédente de ce fichier
  // assumait cette limite par écrit ; la mesure l'a rendue inacceptable —
  // *énoncer une limite ne la rend pas petite, ça la rend visible.*
  //
  // ⛔ UN ATTRIBUT NE PEUT PAS PORTER D'ENFANT : on ne peut rien y « envelopper ».
  // On note donc, SUR L'ÉLÉMENT, quel attribut porte quelle clé :
  //     <span title="Not collected" data-i18n-attr="title:data.notCollected">
  // et le navigateur réécrit l'attribut nommé. Une seule indirection, lisible
  // dans l'inspecteur, et qui survit à un attribut renommé (elle rougirait).
  let avecAttributs = src.replace(/<[a-zA-Z][^>]*>/g, (balise) => {
    if (!balise.includes(DEB)) return balise;
    if (TETE.test(balise)) {
      // sentinelles retirées, aucun marquage : le SEO reste servi en anglais.
      nBrut += (balise.match(new RegExp(DEB, 'g')) || []).length;
      return balise.replace(MOTIF, (t, c, x) => x);
    }
    const paires = [];
    // ⛔ ON TRAITE LA VALEUR ENTIÈRE, PAS « LE PREMIER LIBELLÉ QU'ON Y TROUVE ».
    // Un `content="Debuted with… ␑a␒X␓ ␑b␒Y␓"` porte DEUX libellés : n'en
    // consommer qu'un laisse l'autre à moitié mangé, et un marqueur à moitié
    // mangé est une bombe (cf. le `<head>` avalé, plus haut).
    const nette = balise.replace(/([a-zA-Z-]+)="([^"]*)"/g, (tout, attr, valeur) => {
      if (!valeur.includes(DEB)) return tout;
      const trouves = [...valeur.matchAll(new RegExp(`${DEB}([^${MIL}]*)${MIL}([^<]*?)${FIN}`, 'g'))];
      const nue = valeur.replace(new RegExp(`${DEB}([^${MIL}]*)${MIL}([^<]*?)${FIN}`, 'g'), (t, c, x) => x);
      // ⭐ On ne note l'attribut QUE s'il porte UN libellé et RIEN d'autre.
      // Une valeur mixte — du texte fixe, deux libellés, une donnée — serait
      // écrasée en entier par la traduction : on préfère l'anglais juste au
      // français faux.
      const seul = trouves.length === 1 && nue === trouves[0][2];
      const cle = trouves.length ? trouves[0][1] : '';
      const propre = cle.endsWith('!') ? cle.slice(0, -1) : cle;
      if (seul && !cle.endsWith('!') && estCle(propre)) {
        paires.push(`${attr}:${propre}`);
        nAttribut++; clesAttribut.add(propre);
      } else if (trouves.length && !estCle(propre)) {
        nDeforme++; clesDeformees.add(propre);
      } else {
        nAttributRefuse += trouves.length;
      }
      // ⛔ DANS TOUS LES CAS la valeur ressort NUE : aucune sentinelle ne
      // survit à cette passe, complète ou non. C'est la garantie qui manquait.
      return `${attr}="${nue}"`;
    });
    if (!paires.length) return nette;
    // ⚠️ On insère AVANT le `>` final, en respectant une balise auto-fermante.
    const auto = nette.endsWith('/>');
    return nette.slice(0, auto ? -2 : -1) + ` data-i18n-attr="${echapper(paires.join(' '))}"` + (auto ? '/>' : '>');
  });

  // ── SECONDE PASSE — ce qui reste : texte, <title>, <script>.
  const zonesBrutes2 = [];
  for (const m of avecAttributs.matchAll(/<(title|script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    zonesBrutes2.push([m.index, m.index + m[0].length]);
  }
  const brute2 = (i) => zonesBrutes2.some(([a, b]) => i >= a && i < b);

  const sortie = avecAttributs.replace(MOTIF, (tout, cle, texte, position) => {
    const variable = cle.endsWith('!');
    const propre = variable ? cle.slice(0, -1) : cle;
    if (brute2(position)) { nBrut++; return texte; }
    if (avecAttributs.lastIndexOf('<', position) > avecAttributs.lastIndexOf('>', position)) {
      // Reste d'attribut non pris par la première passe (valeur mixte).
      nAttributRefuse++; return texte;
    }
    // ⛔ UNE CLÉ À VARIABLES NE S'ÉCHANGE PAS BÊTEMENT : son texte anglais
    // contient déjà le nombre substitué. On la marque quand même — avec son
    // drapeau — pour que le navigateur puisse resubstituer s'il sait le faire,
    // et pour que le banc puisse la COMPTER. Ne pas la marquer du tout la
    // rendrait invisible, et une limite invisible n'est pas une limite : c'est
    // une surprise.
    if (!estCle(propre)) { nDeforme++; clesDeformees.add(propre); return texte; }
    nTexte++; clesVues.add(propre);
    // ⭐ `data-i18n-var` RESTE, même quand on sait resubstituer. C'est lui qui
    //   dit « ce texte n'est pas le libellé brut » — les bancs et le client
    //   s'en servent tous les deux, et le retirer changerait le sens d'un
    //   attribut que d'autres fichiers lisent déjà.
    let extra = '';
    if (variable) {
      const vals = variablesDe(propre, texte);
      if (vals) { extra = ` data-i18n-v="${echapper(JSON.stringify(vals))}"`; nVariable++; }
      else nVariableRefus++;
    }
    return `<span data-i18n="${echapper(propre)}"${variable ? ' data-i18n-var' : ''}${extra}>${texte}</span>`;
  });

  // ⛔⛔ LE BALAI DE FIN, ET IL EST LE FILET DE SÉCURITÉ DE TOUT CE FICHIER.
  // Un marqueur peut arriver ici AMPUTÉ — il suffit qu'un gabarit coupe ou
  // transforme le résultat de `t()` quelque part. C'est arrivé : une
  // description SEO tronquée à 158 caractères a laissé un `␑` sans son `␓`.
  // ⭐⭐⭐ Aucune règle de ce fichier ne peut deviner ce qu'un futur gabarit fera
  // d'une chaîne. Ce qu'on PEUT garantir, c'est qu'aucun caractère de contrôle
  // ne sort d'ici — et c'est cette garantie-là que `test:i18n` §1 mesure.
  const propre = sortie.replace(new RegExp(`[${DEB}${MIL}${FIN}]`, 'g'), '');
  if (propre !== sortie) nOrphelins++;
  writeFileSync(f, propre, 'utf8');
}

// ═══════════════════════════════════════════════════════════════════════════
// LES DICTIONNAIRES SERVIS — un fichier par langue d'interface, sauf la pivot
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ PAS LA LANGUE PAR DÉFAUT : elle est DÉJÀ dans le HTML. La servir serait
// faire télécharger 8 Ko pour remplacer chaque texte par lui-même.
// ⭐ On ne publie que les clés RÉELLEMENT MARQUÉES dans les pages. Servir les
// 442 clés quand 60 sont échangeables ferait payer sept fois le poids utile —
// et ferait croire, à qui lit le fichier, que tout est échangé.
const ICI = dirname(fileURLToPath(import.meta.url));
const { languesInterface, locales } = await import(join(ICI, '..', 'engine', 'lib', 'i18n.mjs'));
const { def } = locales();
const dossier = join(RACINE, 'i18n');
mkdirSync(dossier, { recursive: true });

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 161 — LES CLÉS QUI NE VIVENT PAS DANS `engine/i18n/`
// ═══════════════════════════════════════════════════════════════════════════
// `pickT()` marque les valeurs du MANIFESTE (`mf.<chemin>`) et les titres
// LÉGAUX (`lg.<doc>`). Elles portent leurs traductions ailleurs, et c'est
// délibéré : l'accroche et les formules appartiennent au site, pas au moteur.
// ⭐⭐ ON NE LES RECOPIE DONC PAS DANS `engine/i18n/` — on les RÉSOUT ici, en
// relisant leur source. Recopier aurait fabriqué une deuxième vérité pour la
// même phrase, et ce dépôt sait ce que ça coûte.
// ⛔ UNE CLÉ QUI NE SE RÉSOUT PAS EST DITE, JAMAIS SAUTÉE. Un `mf.` mal écrit
//    dans un gabarit produirait un `data-i18n` que le pilote chercherait en
//    vain : le libellé resterait anglais, et la page s'afficherait parfaitement.
//    C'est exactement le profil de P30.
const manifesteBrut = await (async () => {
  try {
    // ⚠️ IMPORT DYNAMIQUE, PAS `require` : ce fichier est un module ES. Un
    // `require` y lèverait à l'exécution — et le `catch` aurait rendu `null`,
    // donc « aucune clé de manifeste résolue », en silence.
    // ⚠️ `js-yaml` v5 est un module CJS SANS export `default` : `.default` vaut
    // `undefined`, et `.load` se lit directement sur le namespace. Mesuré, pas
    // supposé — la première version écrivait `.default` et le garde-fou
    // ci-dessous a crié « manifeste ILLISIBLE ». ⭐ Il a fait exactement son
    // travail : dire qu'il ne pouvait pas, au lieu de rendre zéro clé en silence.
    const mod = await import('js-yaml');
    const yaml = mod.load ? mod : mod.default;
    return yaml.load(readFileSync(join(ROOT, 'sites', process.env.SITE || 'veveprice', 'manifest.yml'), 'utf8'));
  } catch (e) {
    console.warn(`[i18n] ⚠️ manifeste ILLISIBLE (${e.message}) — aucune clé « mf. » ne sera résolue.`);
    return null;
  }
})();
const legalBrut = (lang) => {
  try { return JSON.parse(readFileSync(join(ROOT, 'engine', 'legal', `${lang}.json`), 'utf8')); } catch { return null; }
};
const nonResolues = new Set();
function horsDictionnaire(cle, lang) {
  if (cle.startsWith('mf.')) {
    if (!manifesteBrut) return undefined;
    let n = manifesteBrut;
    for (const seg of cle.slice(3).split('.')) {
      // ⭐ SUR UNE LISTE, ON CHERCHE PAR `cle`, PAS PAR INDEX. `offer.plans` est
      // un tableau : écrire `mf.offer.plans.0.nom` marcherait aujourd'hui et
      // désignerait un AUTRE plan le jour où Preda réordonne la grille — sans
      // erreur, avec un libellé plausible. `mf.offer.plans.member.nom` reste
      // juste quel que soit l'ordre. ⛔ Un index dans une clé de traduction est
      // une adresse qui bouge toute seule.
      n = Array.isArray(n) && !/^\d+$/.test(seg) ? n.find((x) => x && x.cle === seg) : n?.[seg];
      if (n === undefined || n === null) return undefined;
    }
    // La valeur doit être une CARTE de langues ; une chaîne nue n'a rien à échanger.
    return (n && typeof n === 'object' && !Array.isArray(n)) ? n[lang] : undefined;
  }
  if (cle.startsWith('lg.')) return legalBrut(lang)?.[`${cle.slice(3)}.title`];
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 161 — CE FICHIER ÉCRASAIT SES PROPRES DICTIONNAIRES, EN SILENCE
// ═══════════════════════════════════════════════════════════════════════════
// TROUVÉ LE 24/08/2026, en le relançant par mégarde sur un `dist/` déjà marqué :
//     « 0 page(s) marquée(s) · 0 libellé(s) · dictionnaires servis : fr 0.0 Ko »
// Les sentinelles ayant déjà été retirées au premier passage, la seconde
// exécution ne trouve plus rien — et RÉÉCRIT les trois dictionnaires à `{}`.
// ⇒ Le site part en production avec des dictionnaires VIDES : chaque libellé
// reste en anglais chez tout le monde, sans une erreur, sans un build rouge.
// C'est P30 en pire, et déclenché par une commande relancée deux fois.
//
// ⭐⭐⭐ « ZÉRO PARCE QU'IL N'Y A RIEN » ET « ZÉRO PARCE QUE C'EST DÉJÀ FAIT »
//     SE RESSEMBLENT EXACTEMENT DANS UN COMPTEUR À ZÉRO. Ce fichier écrivait
//     sur le premier sens en ayant mesuré le second.
// ⛔ ON NE « RÉPARE » PAS EN NE RÉÉCRIVANT PAS : un dist réellement neuf et
//    réellement vide doit crier, pas être toléré.
if (html.length > 0 && nTexte === 0) {
  console.error(`\n❌ ${html.length} page(s) HTML lues et AUCUN libellé marqué.`);
  console.error('   Soit `dist/` a déjà été marqué (la commande a été lancée deux fois),');
  console.error('   soit le build a tourné SANS `I18N_MARQUAGE=1`.');
  console.error('   ⛔ Les dictionnaires servis ne sont PAS réécrits : les vider ferait');
  console.error('      partir le site avec toute son interface figée en anglais.');
  process.exit(2);
}

const poids = [];
let nHors = 0;
for (const lang of languesInterface()) {
  if (lang === def) continue;
  const complet = JSON.parse(readFileSync(join(ROOT, 'engine', 'i18n', `${lang}.json`), 'utf8'));
  const partiel = {};
  for (const k of new Set([...clesVues, ...clesAttribut])) {
    if (complet[k] !== undefined) { partiel[k] = complet[k]; continue; }
    const v = horsDictionnaire(k, lang);
    if (v !== undefined && v !== null && v !== '') { partiel[k] = v; nHors++; }
    else if (k.startsWith('mf.') || k.startsWith('lg.')) nonResolues.add(`${k} (${lang})`);
  }
  const texte = JSON.stringify(partiel);
  writeFileSync(join(dossier, `${lang}.json`), texte, 'utf8');
  poids.push(`${lang} ${(texte.length / 1024).toFixed(1)} Ko`);
}

console.log(
  `[i18n] ${nFichiers} page(s) marquée(s) · ${nTexte} libellé(s) échangeables `
  + `(${clesVues.size} clés distinctes) `
  + `· ${nAttribut} en ATTRIBUT échangeables (${clesAttribut.size} clés, via data-i18n-attr) `
  + `· ${nAttributRefuse} attribut(s) mixte(s) laissés en anglais (le libellé n'occupe pas toute la valeur) `
  + `· ${nBrut} en <title>/<meta>/<script> laissés bruts (voulu : le SEO reste anglais)`
  // ⭐⭐ CE COMPTE DOIT ATTEINDRE LE LECTEUR. Sans lui, une extraction qui se
  //   mettrait à refuser TOUS les libellés à variables (un gabarit anglais
  //   reformulé, un jeton renommé) rendrait la page anglaise en silence — et
  //   le marquage resterait « réussi ». *Un chiffre qu'on n'imprime pas est un
  //   chiffre qu'on ne surveille pas.*
  + `${nVariable || nVariableRefus ? ` · ${nVariable} libellé(s) à VARIABLES resubstituables (data-i18n-v)${nVariableRefus ? `, ${nVariableRefus} refusé(s) — découpage ambigu, ils restent anglais` : ''}` : ''}`
  + `${nOrphelins ? ` · ⚠️ ${nOrphelins} page(s) portaient un marqueur AMPUTÉ (un gabarit coupe ou transforme un t()) — balayé` : ''}`
  + `${nDeforme ? ` · 🔴 ${nDeforme} clé(s) DÉFORMÉE(S) non échangeables : ${[...clesDeformees].join(', ')} — un gabarit transforme le résultat de t()` : ''}.`);
console.log(`[i18n] dictionnaires servis : ${poids.join(' · ') || 'aucun (une seule langue d\'interface)'}`);
console.log(`[i18n] hors dictionnaire (manifeste + légal) : ${nHors} valeur(s) résolue(s)`
  + `${nonResolues.size ? ` · 🔴 ${nonResolues.size} clé(s) NON RÉSOLUE(S) : ${[...nonResolues].slice(0, 8).join(', ')}` : ''}`);
