// ⚠️ VeVePreda/veve-sites — engine/tools/test_phrases_retirees.mjs  (NEUF — lot 102)
// ═══════════════════════════════════════════════════════════════════════════
// LES PHRASES RETIRÉES NE REVIENNENT PAS — et on le VÉRIFIE
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 CE BANC EXISTE À CAUSE D'UN FAIT MESURÉ, PAS D'UNE CRAINTE.
// Le lot 77 (05/08) a retiré la cadence « toutes les 30 minutes » du texte
// public, sur demande de Preda. Sa notice affirmait tenir « la DERNIÈRE des
// trois mentions visibles ». Le 07/08, la phrase vivait toujours dans la FAQ du
// manifeste, EN QUATRE LANGUES, et elle y était depuis dix jours.
//
// ⭐⭐⭐ UN TEXTE NE S'IMPORTE PAS, IL SE RECOPIE. Une fonction retirée casse
// ses appelants ; une phrase retirée ne casse rien — ses copies continuent de
// s'afficher, correctes en tout point sauf qu'elles décrivent un site qui
// n'existe plus. C'est la forme de dette la plus silencieuse de ce dépôt, et la
// seule parade tenait en une commande que personne ne lance au bon moment :
// `grep -rn "<la phrase>" .` AVANT de déclarer un retrait terminé.
// ➡️ On ne compte plus sur la commande. On l'écrit ici, une fois, avec sa date
// et sa raison — et c'est la CI qui la lance, à chaque push, pour toujours.
//
// ⭐⭐ IL LIT `dist/`, PAS LES SOURCES, ET C'EST TOUT L'INTÉRÊT. Une phrase peut
// arriver d'un manifeste, d'un dictionnaire i18n, d'un gabarit, d'un article de
// blog ou d'un onglet de Sheet récolté ce matin. Le seul endroit où toutes se
// rejoignent est la page servie. ⛔ Un banc qui grepperait `src/` raterait
// exactement la source qu'on n'a pas pensé à surveiller — c'est-à-dire celle
// qui posera problème.
//
// ⛔ CE BANC NE JUGE PAS LE STYLE. Il ne connaît que des chaînes EXACTES, il
// n'a aucune heuristique, et il ne peut donc pas rendre un faux positif. Une
// phrase interdite est une phrase qu'un humain a décidé de retirer.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const R = new URL('../..', import.meta.url).pathname;
const DIST = process.env.DIST_DIR || join(R, 'dist');
const RACINE = existsSync(join(DIST, 'client')) ? join(DIST, 'client') : DIST;

// ═══════════════════════════════════════════════════════════════════════════
//  LE REGISTRE — une ligne par phrase retirée, avec son lot et sa raison
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ `quoi` est cherché TEL QUEL dans le HTML servi. Écrire un fragment court
// et distinctif vaut mieux qu'une phrase entière : une phrase entière rate sa
// propre variante, un fragment trop court attrape le voisinage. On vise le
// groupe de mots qui PORTE la promesse.
// ⚠️ `sites` limite la recherche quand une phrase n'est fautive que quelque
// part : vevewiki peut légitimement parler d'une cadence, il ne vend rien.
const RETIREES = [
  {
    quoi: 'toutes les 30 minutes', lot: 77, sites: ['veveprice'],
    pourquoi: "Preda, 05/08 : « ne précise pas à quelle fréquence ». Un incident de cron rendrait la phrase fausse, et personne ne penserait à la corriger ce jour-là.",
  },
  { quoi: 'toutes les trente minutes', lot: 77, sites: ['veveprice'], pourquoi: 'même retrait, écrit en lettres — la variante qui avait survécu dix jours.' },
  { quoi: 'every 30 minutes', lot: 77, sites: ['veveprice'], pourquoi: 'idem, anglais.' },
  { quoi: 'every thirty minutes', lot: 77, sites: ['veveprice'], pourquoi: 'idem, anglais en lettres.' },
  { quoi: 'cada treinta minutos', lot: 77, sites: ['veveprice'], pourquoi: 'idem, espagnol.' },
  { quoi: 'alle dreißig Minuten', lot: 77, sites: ['veveprice'], pourquoi: 'idem, allemand.' },

  // ── LOT 101/102 — le site ne MONTRE plus le plancher, il le SUIT ────────
  {
    quoi: 'Track the floor price and price history', lot: 102, sites: ['veveprice'],
    pourquoi: "la description du site promettait de MONTRER le floor. Depuis le lot 101 aucune page publique ne l'affiche : c'est une promesse rompue faite à un moteur.",
  },
  { quoi: "Suivez le prix plancher et l'historique", lot: 102, sites: ['veveprice'], pourquoi: 'même promesse, français.' },
  { quoi: 'Historique de prix et plancher VeVe', lot: 102, sites: ['veveprice'], pourquoi: "l'ancien <title> de l'accueil — la balise la plus lue du site." },
  {
    quoi: 'où se situe le prix du jour entre les deux', lot: 102, sites: ['veveprice'],
    pourquoi: "décrivait la JAUGE, retirée par le lot 101 parce que la position du curseur rendait le plancher à qui savait diviser. Le texte a survécu à la chose qu'il décrivait.",
  },
  { quoi: "where today's price sits between them", lot: 102, sites: ['veveprice'], pourquoi: 'idem, anglais.' },
  {
    quoi: 'Le prix affiché est-il', lot: 102, sites: ['veveprice'],
    pourquoi: "la FAQ parlait du prix « affiché ». Il n'y en a plus — la question porte désormais sur le prix SUIVI.",
  },
  { quoi: 'Is the price shown a sale price', lot: 102, sites: ['veveprice'], pourquoi: 'idem, anglais.' },
];

// ⭐ On garde AUSSI un contrôle sans registre : un gabarit qui laisse fuir son
// propre trou de substitution. `{price}`, `{name}`, `{n}`… servis tels quels
// sont invisibles au build (ce sont des chaînes valides) et parfaitement
// visibles dans un résultat Google.
const TROUS = /\{(price|name|series|n|year|brand|v)\}/;

const SITE = process.env.SITE || 'veveprice';
let ko = 0;
const dit = (bon, quoi, detail) => {
  if (!bon) ko++;
  console.log(`  ${bon ? 'ok ' : 'KO '} ${quoi}${detail ? ` — ${detail}` : ''}`);
};

console.log(`\n═══ LOT 102 — aucune phrase retirée n'est revenue (site ${SITE}) ═══`);

if (!existsSync(RACINE)) {
  console.error(`\n❌ aucun dist/ (${RACINE}) : lancer \`npm run build\` avant ce banc.`);
  process.exit(2);
}

const pages = [];
(function marcher(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) marcher(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
})(RACINE);

// ⭐⭐ L'INSTRUMENT AVANT LA MESURE. Sur un `dist/` vide, tout ce qui suit
// serait vert — et pour la pire des raisons : rien à lire.
dit(pages.length > 20, `${pages.length} page(s) HTML à relire`,
  pages.length > 20 ? null : 'TROP PEU — ce banc serait vert par manque de matière');

const applicables = RETIREES.filter((r) => !r.sites || r.sites.includes(SITE));
console.log(`     ${applicables.length} phrase(s) interdite(s) sur ce site, sur ${RETIREES.length} au registre`);

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 UN SITE SANS PHRASE RETIRÉE N'EST PAS UN BANC EN ÉCHEC — 3ᵉ FOIS EN UN JOUR
// ═══════════════════════════════════════════════════════════════════════════
// Ma première version faisait échouer ce banc sur vevewiki, par son propre
// auto-contrôle : « le registre n'a rien à interdire ici ». C'est vrai, et ce
// n'est pas une panne — aucune phrase n'a jamais été retirée de ce site-là.
//
// ⭐⭐⭐ C'EST LA TROISIÈME FOIS AUJOURD'HUI QUE J'ÉCRIS LA MÊME FAUTE, sous
// trois formes différentes, et il faut la nommer une bonne fois :
//   · `test:fuite` sortait sur « le dossier .reserve/cote/ existe-t-il ? »
//     — un artefact du disque, hérité du build d'un autre site ;
//   · `test:slugs` échouait sur « zéro fiche produite »
//     — vrai sur un site qui n'en publie aucune, par construction ;
//   · celui-ci échouait sur « zéro phrase applicable ».
// ⭐ À CHAQUE FOIS, LA MÊME CONFUSION : « je n'ai rien mesuré » et « il n'y a
// rien à mesurer ici » se ressemblent parfaitement vus du disque, et ce sont
// deux verdicts opposés. Seule une DÉCLARATION (le manifeste, le registre)
// permet de les distinguer — jamais l'état d'un dossier.
// ⛔ Et l'inverse est aussi vrai : sortir en silence serait rendre le banc
// muet. On sort en le DISANT, et en disant sur quel site ce message serait
// lui-même la panne.
if (!applicables.length) {
  console.log(`  ..  aucune phrase n'a été retirée du site « ${SITE} » : ce banc n'a rien à y garder.`);
  console.log('      ⚠️ Sur veveprice, ce message EST la panne — le registre en porte 13.');
  console.log('      (Le registre global n\'est pas vide : ' + RETIREES.length + ' entrée(s).)');
  process.exit(RETIREES.length ? 0 : 1);
}

// ── 1. LES PHRASES DU REGISTRE ────────────────────────────────────────────
for (const r of applicables) {
  const trouvees = pages.filter((f) => readFileSync(f, 'utf8').includes(r.quoi));
  dit(trouvees.length === 0, `« ${r.quoi} » (retirée au lot ${r.lot})`,
    trouvees.length === 0 ? null
      : `${trouvees.length} page(s), dont ${trouvees[0].replace(RACINE, '')} — ${r.pourquoi}`);
}

// ── 2. LES TROUS DE SUBSTITUTION NON REMPLIS ──────────────────────────────
const metas = [];
for (const f of pages) {
  const h = readFileSync(f, 'utf8');
  const t = h.match(/<title>(.*?)<\/title>/s);
  const d = h.match(/<meta name="description" content="(.*?)"/s);
  const o = h.match(/<meta property="og:description" content="(.*?)"/s);
  for (const m of [t, d, o]) if (m && TROUS.test(m[1])) metas.push(`${f.replace(RACINE, '')} : ${m[1].slice(0, 80)}`);
}
dit(metas.length === 0, 'aucun trou de substitution non rempli dans un titre ou une description',
  metas.length === 0 ? null : `${metas.length}, dont ${metas[0]}`);

// ── 3. AUTO-CONTRÔLE ──────────────────────────────────────────────────────
// ⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » On vérifie que le
// détecteur sait dire OUI : sans ça, tous les verdicts ci-dessus seraient vrais
// pour la seule raison que la recherche ne trouve jamais rien.
console.log('\n  — auto-contrôle —');
const temoin = pages.some((f) => readFileSync(f, 'utf8').includes('<html'));
dit(temoin, 'le détecteur sait trouver une chaîne présente (« <html »)',
  'sinon ce banc rend tous ses verdicts sur du vide');
dit(!pages.some((f) => readFileSync(f, 'utf8').includes('phrase-temoin-xyzzy-102')),
  'le détecteur sait dire « absente »');
// ⭐ L'auto-contrôle porte sur le REGISTRE, pas sur le site : « ce banc a-t-il
// une raison d'exister ? » se pose une fois pour le dépôt, pas une fois par
// site. Le cas « ce site n'a rien à interdire » est traité plus haut, et il
// sort AVANT d'avoir rendu le moindre verdict.
dit(RETIREES.length >= 5, `le registre est alimenté (${RETIREES.length} phrase(s))`,
  RETIREES.length >= 5 ? null : 'presque vide — ce banc ne protégerait presque rien');

console.log(ko === 0 ? '\n✅ aucune phrase retirée n\'est revenue\n' : `\n🔴 ${ko} contrôle(s) en échec\n`);
process.exit(ko === 0 ? 0 : 1);
