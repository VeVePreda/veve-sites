// Preuve qu'aucune page publiee n'affiche le NOM d'une cle de traduction.
//
//     SITE=veveprice npm run test:cles   (APRES `npm run build`)
//
// ═══════════════════════════════════════════════════════════════════════════
// LA PANNE QU'IL FERME — 03/08/2026, lot 34, et elle etait A MOI.
// ═══════════════════════════════════════════════════════════════════════════
// Le lot 34 retirait `/rarity/` : six cles i18n supprimees dans cinq langues,
// et six fichiers a supprimer A LA MAIN (l'upload web n'efface rien). Les cles
// sont parties. Les fichiers, non.
//
// Resultat, en ligne, dans cinq langues :
//     <title>rarities.title | VeVe Price</title>
//     <h1>rarities.title</h1>
//     <meta name="description" content="desc.rarities">
//
// 🔴 ET TOUT ETAIT VERT. 463 pages rendues sans une erreur, et les DIX
// controles passes : test:gabarits, test:langues, test:lastmod, test:schema,
// test:fiches, test:acces, test:reserve, test:donnees, css-mort,
// imports-orphelins. Aucun ne regarde ce que la page DIT.
//
// ⭐⭐ POURQUOI test:langues NE POUVAIT PAS LE VOIR — c'est la vraie lecon.
// Il compare chaque langue a la langue PIVOT : « fr a-t-il toutes les cles de
// en ? ». Les cinq langues avaient perdu EXACTEMENT LES MEMES SIX CLES. Il
// etait donc vert, et il avait raison de l'etre : les traductions etaient
// parfaitement coherentes entre elles. Coherentes ET absentes.
// ⭐ UN CONTROLE DE COHERENCE NE VOIT PAS UNE PERTE UNIFORME. Il faut un
//   controle qui compare la page a la REALITE, pas les langues entre elles.
//
// ⭐⭐ ET POURQUOI RIEN N'A PLANTE. `engine/lib/i18n.mjs` :
//     const raw = d[key] !== undefined ? d[key] : (dict(def)[key] ?? key);
// Le `?? key` est un repli DELIBERE, et il est bon : une cle manquante ne doit
// pas faire tomber un site en production. Mais un repli qui produit une valeur
// PLAUSIBLE est invisible — meme mecanisme que le `getattr(…, ())` qui a mal
// etiquete 216 838 transferts. On ne retire pas le repli : on ajoute
// l'instrument qui le rend audible.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'IL FAIT, ET CE QU'IL REFUSE DE FAIRE
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ IL NE DEVINE PAS a quoi « ressemble » une cle. Une regle de forme du genre
//    « mot.mot sans espace » accuserait `veveprice.com`, `sitemap.xml`, `3.14`,
//    `spider-man.jpg`… Un controle qui crie a tort cesse d'etre lu — c'est la
//    lecon du 31/07 (172 griefs de css-mort sur encyclopedie).
//
// ⭐ IL LIT LE VOCABULAIRE REEL. Les cles que le code peut emettre sont
//    ecrites en toutes lettres dans les gabarits : `t(lang, 'nav.blog')`. On
//    extrait cet ensemble des sources, et on cherche CES CHAINES-LA dans le
//    HTML produit. Zero heuristique, donc zero faux positif : pour accuser a
//    tort, il faudrait qu'une page affiche volontairement « rarities.title ».
//
// ⚠️ SA LIMITE, ECRITE ICI PARCE QU'ELLE EST REELLE : une cle CONSTRUITE
//    (`t(lang, 'nav.' + nom)`) n'est pas un litteral, n'entre pas dans le
//    vocabulaire, et ne sera pas vue. Il couvre les cles ecrites en clair.
//    ⭐ « Quelle FRACTION mon controle couvre-t-il ? » est la question, et la
//    reponse doit etre ECRITE, pas supposee. Le banc l'affiche a chaque tour.
//
// ⚠️ IL TOURNE APRES LE BUILD, et c'est le prix. css-mort, imports-orphelins
//    et cascade-aplatie parlent AVANT le compilateur, pour 40 ms. Celui-ci ne
//    peut pas : la question qu'il pose — « qu'est-ce que la page DIT ? » —
//    n'a de reponse qu'apres rendu.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let echecs = 0;
const dit = (ok, titre, detail) => {
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs++;
};

function fichiers(racine, exts) {
  const out = [];
  if (!existsSync(racine)) return out;
  for (const e of readdirSync(racine)) {
    if (e === 'node_modules' || e === '.git' || e === 'dist') continue;
    const p = join(racine, e);
    if (statSync(p).isDirectory()) out.push(...fichiers(p, exts));
    else if (exts.some((x) => e.endsWith(x))) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. LE VOCABULAIRE : les cles que les sources demandent EN CLAIR.
// ---------------------------------------------------------------------------
const MOTIF_T = /\bt\(\s*[A-Za-z_$][\w$.]*\s*,\s*(['"`])([^'"`]+)\1/g;
const sources = [
  ...fichiers(join(RACINE, 'src'), ['.astro', '.js', '.mjs', '.ts']),
  ...fichiers(join(RACINE, 'engine', 'lib'), ['.mjs', '.js']),
];
const vocabulaire = new Set();
let dynamiques = 0;
for (const f of sources) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(MOTIF_T)) vocabulaire.add(m[2]);
  // ⭐ On COMPTE ce qu'on ne sait pas lire, et on l'affiche. Une limite tue
  //    n'est pas une limite : c'est un mensonge par omission.
  for (const _ of s.matchAll(/\bt\(\s*[A-Za-z_$][\w$.]*\s*,\s*[^'"`\s)]/g)) dynamiques++;
}

// --- LES CLES QUI NE SONT PAS EN POSITION `t(...)` -------------------------
// ⭐ TROUVE EN ECRIVANT CE BANC, ET C'EST TOUT L'INTERET DE L'AVOIR ECRIT.
// Item.astro fait :
//     {[['item.7d', v7], ['item.30d', v30]].map(([k, v]) => … t(lang, k) …)}
// `item.7d` EST un litteral — il n'est simplement pas a l'endroit ou on
// regardait. Une premiere version de ce banc l'aurait rate et se serait
// declaree « couverture : 3 appels hors de portee », ce qui aurait ete vrai
// et inutile. On elargit donc au litteral, mais SOUS CONDITION.
//
// ⛔ LA CONDITION EST CE QUI EMPECHE LE BANC DE CRIER A TORT : on n'accepte un
// litteral que si son PREFIXE (avant le premier point) est un espace de noms
// REELLEMENT declare dans engine/i18n. `item.7d` -> prefixe « item », connu.
// `spider-man.jpg` -> prefixe « spider-man », inconnu : rejete. `3.14` ->
// rejete. `veveprice.com` -> prefixe « veveprice », inconnu : rejete.
// ⭐ Le vocabulaire se DEDUIT du dictionnaire, il ne se devine pas.
const I18N_DIR = join(RACINE, 'engine', 'i18n');
const espaces = new Set();
const clesConnues = new Set();
if (existsSync(I18N_DIR)) {
  for (const f of readdirSync(I18N_DIR).filter((x) => x.endsWith('.json'))) {
    for (const k of Object.keys(JSON.parse(readFileSync(join(I18N_DIR, f), 'utf8')))) {
      clesConnues.add(k);
      espaces.add(k.split('.')[0]);
    }
  }
}
// ⛔ TROUVE EN VERIFIANT LE VOCABULAIRE PLUTOT QU'EN LE CROYANT (03/08).
// Le seul filtre « prefixe connu » laissait entrer `blog.json` et
// `movers.astro` : leurs prefixes `blog` et `movers` SONT de vrais espaces de
// noms i18n. Ce sont des NOMS DE FICHIERS. Sur vevewiki — une encyclopedie —
// un article peut parfaitement citer « blog.json » dans son texte, et le banc
// aurait accuse une page parfaitement saine.
// ⭐⭐ UN DETECTEUR SE RELIT SUR CE QU'IL A MIS DANS SA LISTE, pas seulement
// sur son verdict. Le verdict etait vert ; la liste, elle, etait deja fausse.
const EXTENSIONS = new Set(['json', 'astro', 'mjs', 'js', 'ts', 'css', 'html', 'htm',
  'xml', 'png', 'jpg', 'jpeg', 'svg', 'webp', 'ico', 'txt', 'md', 'yml', 'yaml',
  'woff', 'woff2', 'gz', 'csv', 'py', 'sh', 'lock', 'map', 'avif']);
const FORME = /^[a-z][a-z0-9]*(\.[a-z0-9][\w-]*)+$/;
const MOTIF_LITTERAL = /(['"`])([a-z][\w.-]*\.[a-z0-9][\w.-]*)\1/g;
for (const f of sources) {
  for (const m of readFileSync(f, 'utf8').matchAll(MOTIF_LITTERAL)) {
    const c = m[2];
    if (!FORME.test(c)) continue;
    if (!espaces.has(c.split('.')[0])) continue;
    if (EXTENSIONS.has(c.split('.').pop())) continue;     // nom de fichier, pas une cle
    vocabulaire.add(c);
  }
}

console.log('\n1. Le vocabulaire des cles demandees par les gabarits');
// ⭐ rc=2 SI ON N'A RIEN LU — meme dispositif que css-mort. Une racine fausse
// rendrait ce banc vert A VIE. Un controle qui n'a rien inspecte n'a rien
// prouve, et c'est le mode de panne le plus cher : il rassure.
if (vocabulaire.size < 20) {
  console.error(`\n❌ seulement ${vocabulaire.size} cle(s) dans ${sources.length} fichier(s).`);
  console.error('   Racine fausse ou motif casse : ce banc ne prouverait RIEN. On refuse le vert.');
  process.exit(2);
}
dit(true, `${vocabulaire.size} cles litterales dans ${sources.length} fichier(s) source`);
console.log(`       (couverture : ${dynamiques} appel(s) a cle CONSTRUITE, hors de portee de ce banc)`);

// ---------------------------------------------------------------------------
// 2. LES PAGES PRODUITES.
// ---------------------------------------------------------------------------
const DIST = ['dist/client', 'dist'].map((d) => join(RACINE, d)).find((d) => existsSync(d));
console.log('\n2. Les pages produites');
if (!DIST) { console.error('\n❌ aucun dist/ : lancer `npm run build` avant ce banc.'); process.exit(2); }
const pages = fichiers(DIST, ['.html']);
if (pages.length === 0) {
  console.error(`\n❌ aucune page dans ${relative(RACINE, DIST)} : ce banc ne prouverait rien.`);
  process.exit(2);
}
dit(true, `${pages.length} page(s) lues dans ${relative(RACINE, DIST)}`);

// ---------------------------------------------------------------------------
// 3. LE CONTROLE — les surfaces qui PARLENT a l'utilisateur et aux moteurs.
//    ⛔ Pas les attributs techniques (href, class, src) : une adresse contient
//    legitimement des points.
// ---------------------------------------------------------------------------
const sansScripts = (h) => h
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ');

function surfaces(html) {
  const h = sansScripts(html);
  const out = [];
  const push = (ou, txt) => { if (txt && txt.trim()) out.push([ou, txt.trim()]); };
  push('<title>', (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  for (const m of h.matchAll(/<meta[^>]+name=["'](description)["'][^>]+content=["']([^"']*)["']/gi)) push('<meta description>', m[2]);
  for (const m of h.matchAll(/<meta[^>]+property=["']og:(title|description)["'][^>]+content=["']([^"']*)["']/gi)) push(`<meta og:${m[1]}>`, m[2]);
  for (const m of h.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)) push(`<${m[1]}>`, m[2].replace(/<[^>]+>/g, ' '));
  push('texte visible', h.replace(/<[^>]+>/g, ' '));
  return out;
}

const jetons = (texte) => texte.split(/[\s|,;:()\[\]{}"'<>]+/);

console.log('\n3. Aucune page n\'affiche le NOM d\'une cle');
const coupables = new Map();
for (const p of pages) {
  for (const [ou, texte] of surfaces(readFileSync(p, 'utf8'))) {
    for (const j of jetons(texte)) {
      if (!j.includes('.') || !vocabulaire.has(j)) continue;
      if (!coupables.has(j)) coupables.set(j, new Set());
      coupables.get(j).add(`${relative(DIST, p)}  ${ou}`);
    }
  }
}
const emplacements = [...coupables.values()].reduce((n, s) => n + s.size, 0);
dit(coupables.size === 0, 'aucune cle de traduction rendue en clair',
  coupables.size === 0 ? `${pages.length} page(s) propres`
    : `${coupables.size} cle(s) sur ${emplacements} emplacement(s)`);

for (const [cle, ou] of coupables) {
  console.log(`     🔴 « ${cle} » est demandee par un gabarit mais ABSENTE de engine/i18n/`);
  console.log(`        le visiteur lit « ${cle} » a la place du texte.`);
  for (const e of [...ou].slice(0, 4)) console.log(`        · ${e}`);
  if (ou.size > 4) console.log(`        · … et ${ou.size - 4} autre(s)`);
}

// ---------------------------------------------------------------------------
// 4. AUTO-CONTROLE — ce banc sait-il echouer, ET sait-il se taire ?
//    ⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » Un test incapable
//    d'echouer ne prouve rien : lecon du 18/07, ou un audit avait declare
//    « aucun lien casse » sur un repertoire vide.
// ---------------------------------------------------------------------------
console.log('\n4. Auto-controle');
const temoin = [...vocabulaire].sort()[0];
const compte = (html) => surfaces(html)
  .flatMap(([, t]) => jetons(t)).filter((j) => vocabulaire.has(j)).length;

const vu = compte(`<html><head><title>${temoin} | X</title></head><body><h1>${temoin}</h1></body></html>`);
dit(vu > 0, `une page temoin portant « ${temoin} » est bien detectee`,
  vu > 0 ? `${vu} detection(s)` : 'AUCUNE — le detecteur est aveugle, son vert ne vaut rien');

// ⭐ Et l'inverse. Sans cette ligne, un detecteur qui repond « coupable » a
//    TOUT serait vert ci-dessus — et rendrait le banc inutilisable en criant
//    sur chaque domaine, chaque nom de fichier et chaque decimale.
const faux = compte('<html><head><title>Spider-Man | VeVe Price</title>'
  + '<meta name="description" content="Plancher sur veveprice.com — cf. sitemap.xml, 3.14 OMI."></head>'
  + '<body><h1>Spider-Man</h1><p>veveprice.com/market/ a 12.50 OMI. Fichier spider-man.jpg.</p></body></html>');
dit(faux === 0, 'une page normale (domaine, fichier, decimales) n\'est PAS accusee',
  faux === 0 ? 'aucun faux positif' : `${faux} accusation(s) a tort — ce banc crierait pour rien`);

// ⭐ Le troisieme auto-controle, ajoute apres avoir trouve `blog.json` dans le
//    vocabulaire : on verifie la LISTE, pas seulement le verdict.
const pollution = [...vocabulaire].filter((c) => EXTENSIONS.has(c.split('.').pop()));
dit(pollution.length === 0, 'le vocabulaire ne contient aucun nom de fichier',
  pollution.length === 0 ? `${vocabulaire.size} cles, toutes plausibles`
    : `${pollution.length} intrus : ${pollution.slice(0, 5).join(', ')}`);


// ═══════════════════════════════════════════════════════════════════════════
// §VOIX (lot 207) — UNE SEULE VOIX PAR LANGUE, ET C'EST LE REGISTRE FORMEL
// ═══════════════════════════════════════════════════════════════════════════
// Arbitrage Preda du 26/08/2026 : « vous », partout. Mesuré ce jour-la :
// fr melangeait 2 cles tutoyees a 500+ vouvoyees, de 17 « du » contre 29
// « Sie », es 22 « tu » contre 25 « usted » — trois langues, trois voix
// melangees, invisibles page a page. La regle vit ici pour que la 541e cle
// ne reparte pas dans l'autre registre.
// ⭐ L'ITALIEN EST EXEMPTE, ET C'EST UNE DECISION MESUREE : 31 cles « tu »,
//    ZERO formelle — il a deja UNE voix, l'idiomatique du web italien. Le
//    converger serait 31 retraductions pour zero incoherence corrigee.
// ⭐ On scanne les SOURCES (dictionnaires + valeurs de langue du manifeste) :
//    c'est la qu'une nouvelle cle nait ; la page servie herite.
{
  const { readFileSync: lire } = await import('node:fs');
  const RACINE = new URL('../..', import.meta.url).pathname;
  // 🔴 PAS DE \b ICI, ET C'EST MESURÉ : le \b de JavaScript ne connaît que
  //    [A-Za-z0-9_] — dans « êtes » ou « complètes », l'accent ouvre une
  //    frontière et « tes » matchait DEDANS. Trois faux rouges à la première
  //    exécution. La borne se dit en Unicode : « pas une lettre autour ».
  const borne = (mots) => new RegExp('(?<![\\p{L}])(?:' + mots + ')(?![\\p{L}])', 'u');
  const MARQUES = {
    fr: borne('[Tt]u|[Tt]es|[Tt]on|[Tt]a|[Tt]oi'),
    de: borne('[Dd]u|[Dd]ich|[Dd]ir|[Dd]ein[\\p{L}]*'),
    es: borne('[Tt]ú|[Tt]us|[Tt]uyo[\\p{L}]*|tu|te|ti'),
  };
  const fautes = [];
  for (const [lg, m] of Object.entries(MARQUES)) {
    const dico = JSON.parse(lire(`${RACINE}engine/i18n/${lg}.json`, 'utf8'));
    for (const [k, v] of Object.entries(dico)) {
      if (m.test(String(v))) fautes.push(`${lg}.json ${k} : « ${String(v).slice(0, 48)} »`);
    }
  }
  // Le manifeste : seules les lignes-valeurs de langue, jamais les commentaires.
  const manifeste = lire(`${RACINE}sites/${process.env.SITE || 'veveprice'}/manifest.yml`, 'utf8');
  manifeste.split('\n').forEach((ligne, i) => {
    const val = ligne.match(/^\s*(fr|de|es):\s*"(.*)"/);
    if (!val) return;
    const m = MARQUES[val[1]];
    if (m && m.test(val[2])) fautes.push(`manifest.yml l.${i + 1} (${val[1]}) : « ${val[2].slice(0, 48)} »`);
  });
  dit(fautes.length === 0, 'fr, de et es parlent d\'une seule voix, la formelle (it : tu, assume)',
    fautes.length === 0 ? 'aucune marque de tutoiement' : fautes.slice(0, 6).join(' · '));
}

console.log(`\n${echecs === 0 ? '✅ tout est vert' : `❌ ${echecs} echec(s)`}`);
process.exit(echecs === 0 ? 0 : 1);
