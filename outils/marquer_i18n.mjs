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
const FORME_CLE = /^[a-z][a-zA-Z0-9_]*(\.[a-z][a-zA-Z0-9_]*)*$/;

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
      if (seul && !cle.endsWith('!') && FORME_CLE.test(propre)) {
        paires.push(`${attr}:${propre}`);
        nAttribut++; clesAttribut.add(propre);
      } else if (trouves.length && !FORME_CLE.test(propre)) {
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
    if (!FORME_CLE.test(propre)) { nDeforme++; clesDeformees.add(propre); return texte; }
    nTexte++; clesVues.add(propre);
    return `<span data-i18n="${echapper(propre)}"${variable ? ' data-i18n-var' : ''}>${texte}</span>`;
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

const poids = [];
for (const lang of languesInterface()) {
  if (lang === def) continue;
  const complet = JSON.parse(readFileSync(join(ROOT, 'engine', 'i18n', `${lang}.json`), 'utf8'));
  const partiel = {};
  for (const k of new Set([...clesVues, ...clesAttribut])) if (complet[k] !== undefined) partiel[k] = complet[k];
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
  + `${nOrphelins ? ` · ⚠️ ${nOrphelins} page(s) portaient un marqueur AMPUTÉ (un gabarit coupe ou transforme un t()) — balayé` : ''}`
  + `${nDeforme ? ` · 🔴 ${nDeforme} clé(s) DÉFORMÉE(S) non échangeables : ${[...clesDeformees].join(', ')} — un gabarit transforme le résultat de t()` : ''}.`);
console.log(`[i18n] dictionnaires servis : ${poids.join(' · ') || 'aucun (une seule langue d\'interface)'}`);
