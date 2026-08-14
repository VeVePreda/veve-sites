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
  // ── LOT 128 — la remise annuelle n'est plus annoncée ─────────────────────
  // ⚠️ LES CINQ LANGUES, `it` COMPRIS, alors qu'`it` n'est jamais actif. Une
  // phrase laissée dans un dictionnaire dormant revient le jour où quelqu'un
  // active la langue — et ce jour-là personne ne relira ce lot.
  { quoi: '2 months free when paid yearly', lot: 128, sites: ['veveprice'], pourquoi: 'la promesse tarifaire « 2 mois offerts », retirée sur demande de Preda le 10/08. ⭐ Un CHIFFRE dans une promesse commerciale : il devient faux le jour où la remise change, et rien ne le signale.' },
  { quoi: '2 mois offerts à l’année', lot: 128, sites: ['veveprice'], pourquoi: 'idem, français.' },
  { quoi: '2 meses gratis al año', lot: 128, sites: ['veveprice'], pourquoi: 'idem, espagnol.' },
  { quoi: '2 Monate gratis bei Jahreszahlung', lot: 128, sites: ['veveprice'], pourquoi: 'idem, allemand.' },
  { quoi: '2 mesi gratis con il piano annuale', lot: 128, sites: ['veveprice'], pourquoi: 'idem, italien.' },
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

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 150 C — UNE SEULE PASSE SUR `dist/`, ET LE COMPTE EST MESURÉ
// ═══════════════════════════════════════════════════════════════════════════
// CE BANC RELISAIT `dist/` VINGT FOIS. Une passe complète par phrase du
// registre (18 sur veveprice), plus une pour les trous de substitution, plus
// une pour l'auto-contrôle « absente ». Mesuré le 14/08 à l'instrument, sur un
// `dist/` de 5 200 pages : **104 001 lectures, 2 965 577 531 octets**.
//
// ⛔ CE N'ÉTAIT PAS UN PROBLÈME DE MÉMOIRE, ET IL FAUT LE DIRE.
// Le pic est resté à **76 Mo** : chaque chaîne meurt à l'itération suivante et
// V8 la ramasse à coût constant. ⭐⭐⭐ *Ce qui coûte de la mémoire, c'est ce
// qu'on RETIENT, jamais ce qu'on lit.*
//
// ⭐ C'ÉTAIT UN PROBLÈME DE TEMPS, ET IL SE PAYAIT À CHAQUE DÉPLOIEMENT.
// Log Coolify du 14/08 (déploiement `28e854f`, 55/55) : cette étape est le
// **4ᵉ poste du build**, à **11,6 s** sur 3 103 pages — derrière `marquer:i18n`
// (30,0 s) et deux étapes d'image. Une seule passe la ramène à ~0,8 s.
// ⚠️ Et le lot 150 B porte le site à 3 903 pages : ce poste-là grandit avec le
// catalogue, à raison de 18 relectures par page ajoutée.
//
// ⚠️ LES VERDICTS NE CHANGENT PAS D'UN OCTET, et l'ordre d'affichage non plus.
// Contre-épreuve du 14/08 : sortie standard comparée caractère pour caractère
// avec la version précédente, sur le même `dist/` — identique.
const trouvees = new Map(applicables.map((r) => [r.quoi, []]));
const metas = [];
let temoin = false;
let fantome = false;

for (const f of pages) {
  const h = readFileSync(f, 'utf8');
  const court = f.replace(RACINE, '');

  // §1 — les phrases du registre
  for (const r of applicables) if (h.includes(r.quoi)) trouvees.get(r.quoi).push(court);

  // §2 — les trous de substitution
  const t = h.match(/<title>(.*?)<\/title>/s);
  const d = h.match(/<meta name="description" content="(.*?)"/s);
  const o = h.match(/<meta property="og:description" content="(.*?)"/s);
  for (const m of [t, d, o]) if (m && TROUS.test(m[1])) metas.push(`${court} : ${m[1].slice(0, 80)}`);

  // §3 — les deux témoins de l'auto-contrôle
  if (!temoin && h.includes('<html')) temoin = true;
  if (!fantome && h.includes('phrase-temoin-xyzzy-102')) fantome = true;
  // ⭐ `h` sort de portée ici. C'est toute la différence avec la version d'avant.
}

// ── 1. LES PHRASES DU REGISTRE ────────────────────────────────────────────
for (const r of applicables) {
  const t = trouvees.get(r.quoi);
  dit(t.length === 0, `« ${r.quoi} » (retirée au lot ${r.lot})`,
    t.length === 0 ? null
      : `${t.length} page(s), dont ${t[0]} — ${r.pourquoi}`);
}

// ── 2. LES TROUS DE SUBSTITUTION NON REMPLIS ──────────────────────────────
dit(metas.length === 0, 'aucun trou de substitution non rempli dans un titre ou une description',
  metas.length === 0 ? null : `${metas.length}, dont ${metas[0]}`);

// ── 3. AUTO-CONTRÔLE ──────────────────────────────────────────────────────
// ⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » On vérifie que le
// détecteur sait dire OUI : sans ça, tous les verdicts ci-dessus seraient vrais
// pour la seule raison que la recherche ne trouve jamais rien.
console.log('\n  — auto-contrôle —');
dit(temoin, 'le détecteur sait trouver une chaîne présente (« <html »)',
  'sinon ce banc rend tous ses verdicts sur du vide');
dit(!fantome, 'le détecteur sait dire « absente »');
// ⭐ L'auto-contrôle porte sur le REGISTRE, pas sur le site : « ce banc a-t-il
// une raison d'exister ? » se pose une fois pour le dépôt, pas une fois par
// site. Le cas « ce site n'a rien à interdire » est traité plus haut, et il
// sort AVANT d'avoir rendu le moindre verdict.
dit(RETIREES.length >= 5, `le registre est alimenté (${RETIREES.length} phrase(s))`,
  RETIREES.length >= 5 ? null : 'presque vide — ce banc ne protégerait presque rien');

console.log(ko === 0 ? '\n✅ aucune phrase retirée n\'est revenue\n' : `\n🔴 ${ko} contrôle(s) en échec\n`);
process.exit(ko === 0 ? 0 : 1);
