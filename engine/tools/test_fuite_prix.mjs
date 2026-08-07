// ⚠️ VeVePreda/veve-sites — engine/tools/test_fuite_prix.mjs  (FICHIER NEUF — lot 101)
// ═══════════════════════════════════════════════════════════════════════════
// LE BANC ANTI-FUITE — il lit `dist/`, pas le code
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI IL REGARDE LE PRODUIT ET PAS LA SOURCE. Tous les autres bancs
// de ce lot prouvent des INTENTIONS : que `projeter()` retire les champs, que
// la route refuse sans session, que `productLd` n'emet plus d'`offers`. Aucun
// ne prouve le FAIT — « il n'y a pas un seul prix dans ce qu'on publie ». Or
// c'est le seul enonce qui compte, et c'est le seul qu'un lot suivant peut
// defaire sans toucher a une ligne de ce lot-ci : il suffira que quelqu'un
// passe une valeur a un gabarit, de bonne foi, pour une page neuve.
//
// ⭐⭐ ET IL CHERCHE DES VALEURS REELLES, PAS DES MOTIFS. Chercher « floor »
// dans le HTML aurait attrape des libelles et rate les chiffres. On prend les
// vrais montants dans `.reserve/cote/` — ceux qu'on vient de mettre a l'abri —
// et on va voir s'ils se retrouvent dans la page de LEUR piece. C'est la seule
// forme qui ne peut pas etre verte pour une mauvaise raison.
//
// ⛔ LIMITE ASSUMEE, ECRITE POUR NE PAS ETRE REDECOUVERTE : il ne verifie que
// les pieces dont le montant est ASSEZ DISTINCTIF (au moins une decimale, ou
// au moins 4 chiffres). Un plancher a « 12 » se retrouve dans n'importe quelle
// page par hasard, et un banc qui crie au hasard finit desactive. La couverture
// reelle est affichee a chaque execution : si elle tombe, c'est un signal.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const R = new URL('../..', import.meta.url).pathname;
const DIST = process.env.DIST_DIR || join(R, 'dist');
const RACINE = existsSync(join(DIST, 'client')) ? join(DIST, 'client') : DIST;
const COTE = process.env.RESERVE_COTE_DIR || join(R, '.reserve', 'cote');

let ko = 0;
const dit = (bon, quoi, detail) => {
  if (!bon) ko++;
  console.log(`  ${bon ? 'ok ' : 'KO '} ${quoi}${detail ? ` — ${detail}` : ''}`);
};

console.log('\n═══ LOT 101 — aucune cote ne doit se trouver dans dist/ ═══');

// ── 0. L'INSTRUMENT AVANT LA MESURE ───────────────────────────────────────
// ⭐⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » Sur un `dist/` vide ou
// une reserve absente, tout ce qui suit serait vert. On refuse d'abord de
// mesurer avec un instrument debranche — c'est la lecon du miroir perime.
if (!existsSync(RACINE)) {
  console.log(`  KO  dist/ introuvable (${RACINE}) — ce banc ne peut RIEN prouver`);
  process.exit(1);
}
const JOURNAL = join(COTE, '_projection.json');

// ── 0 bis. LE BANC SORT SUR LE MANIFESTE, PAS SUR L'ABSENCE D'UN DOSSIER ──
// 🔴 PREMIERE VERSION : elle sortait si `.reserve/cote/` n'existait pas. Mesure
// du 07/08 : sur vevewiki, ce dossier EXISTE — laisse par le build precedent de
// veveprice dans le meme arbre — et le banc partait alors verifier une reserve
// qui n'etait pas la sienne, puis echouait trois fois sur un site parfaitement
// sain. ⭐⭐⭐ UN CONTROLE QUI DEDUIT SA RAISON D'ETRE D'UN ARTEFACT SUR LE
// DISQUE HERITE DE TOUT CE QUE LE DISQUE A GARDE. La question « ce site
// ferme-t-il sa cote ? » a une reponse EXACTE et elle est dans le manifeste.
process.env.SITE = process.env.SITE || 'veveprice';
const { coteFermee, uuidValide } = await import('../lib/cote.mjs');
if (!coteFermee()) {
  console.log(`  ..  la porte « cote » est INACTIVE sur ce site (${process.env.SITE}) : rien a verifier.`);
  console.log('      ⚠️ Sur veveprice, ce message EST la panne — la porte devrait etre active.');
  process.exit(0);
}
if (!existsSync(JOURNAL)) {
  console.log(`  KO  la porte « cote » est active mais le journal de projection est absent (${JOURNAL})`);
  console.log('      -> le build n\'a pas tourne, ou `projeter()` n\'a pas ete appele.');
  process.exit(1);
}

const pages = [];
(function marcher(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) marcher(p);
    else if (e.name.endsWith('.html') || e.name.endsWith('.json') || e.name.endsWith('.xml')) pages.push(p);
  }
})(RACINE);
dit(pages.length > 50, `${pages.length} fichier(s) publie(s) a inspecter`,
  pages.length > 50 ? null : 'TROP PEU — le banc serait vert par manque de matiere');

// ── 1. LE JSON-LD NE DECLARE PLUS D'OFFRE ─────────────────────────────────
// C'etait la fuite la plus couteuse : elle part chez Google et y reste.
const avecOffre = pages.filter((f) => f.endsWith('.html')
  && /"@type"\s*:\s*"Offer"/.test(readFileSync(f, 'utf8')));
dit(avecOffre.length === 0, 'aucune page n\'emet un `Offer` en donnees structurees',
  avecOffre.length === 0 ? null : `${avecOffre.length} page(s), dont ${avecOffre[0]}`);

// ── 2. LES VRAIS MONTANTS NE SE RETROUVENT PAS DANS LEUR PAGE ─────────────
// ⭐⭐⭐ ON LIT LE JOURNAL DE PROJECTION, PAS LES FICHIERS SERVIS — ET C'EST LA
// DECISION QUI REND CE BANC UTILE EN CI. Hors reseau, l'echantillon porte des
// identifiants `sample-0033-570553` : la liste blanche des uuid les refuse
// tous, `.reserve/cote/` ne contient AUCUN fichier servi, et un banc branche
// dessus n'aurait rien a comparer. Il serait vert pour toujours, pour la seule
// raison qui rend un banc inutile. Le journal, lui, porte les montants de TOUS
// les items — c'est ce qui a ete RETIRE, et c'est exactement ce qu'on doit ne
// pas retrouver dans `dist/`.
const jrn = JSON.parse(readFileSync(JOURNAL, 'utf8'));
const entrees = Object.entries(jrn.valeurs || {});
dit(entrees.length > 0, `${entrees.length} cote(s) retiree(s) du public`,
  entrees.length ? `${jrn.ecrits || 0} servie(s), ${jrn.refuses || 0} uuid refuse(s)`
    : 'AUCUNE — soit la projection n\'a pas tourne, soit elle n\'ecrit rien');
const fichiersCote = readdirSync(COTE).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

// ⭐ Le jeu de donnees redonne le chemin de chaque piece. On l'importe APRES
// avoir lu la reserve : `dataset()` est en cache dans le processus de build,
// pas ici, donc cet appel relit — c'est acceptable pour un banc, et c'est ce
// qui garantit qu'on lit le MEME etat que celui qui a produit `dist/`.
const { dataset } = await import('../lib/dataset.mjs');
const ds = await dataset();
const parUuid = new Map(ds.items.map((i) => [i.uuid, i]));

// ⭐⭐ CONTROLE DE L'INSTRUMENT, ET IL EST INDISPENSABLE ICI : si `projeter()`
// ne tournait pas, `ds.items[].floor` existerait encore et ce banc aurait
// quand meme des chemins — il verifierait alors le HTML d'un site dont il n'a
// pas constate le nettoyage. On mesure d'abord le jeu de donnees lui-meme.
const encorePrix = ds.items.filter((i) => i.floor !== undefined || i.ath !== undefined
  || i.atl !== undefined || i.prixMedian !== undefined || i.history !== undefined).length;
dit(encorePrix === 0, 'le jeu de donnees public ne porte plus AUCUN champ de cote',
  encorePrix === 0 ? `${ds.items.length} fiches` : `${encorePrix} fiche(s) portent encore floor/ath/atl/history`);

// ⚠️ On formate comme les gabarits : `toLocaleString` avec la locale du site.
// Un montant cherche au format brut (« 1234.5 ») ne serait trouve nulle part
// alors qu'il s'affiche « 1,234.5 » — le banc serait vert et la fuite entiere.
const FORMATS = ['en-GB', 'fr-FR', 'es-ES', 'de-DE'];
const formes = (v) => {
  const out = new Set();
  for (const l of FORMATS) out.add(Number(v).toLocaleString(l, { maximumFractionDigits: 2 }));
  return [...out];
};
// ⭐ « Assez distinctif » : au moins une decimale, ou au moins 4 chiffres.
const distinctif = (v) => Number.isFinite(v) && (v >= 1000 || !Number.isInteger(v));

let testees = 0, sautees = 0;
const fuites = [];
for (const [uuid, c] of entrees) {
  const item = parUuid.get(uuid);
  if (!item || !item.path) { sautees++; continue; }
  const valeurs = ['floor', 'ath', 'atl', 'prixMedian', 'p95']
    .map((k) => c[k]).filter(distinctif);
  if (!valeurs.length) { sautees++; continue; }

  // La page de la piece, dans la langue pivot (les autres portent le meme
  // gabarit : une fuite qui existe dans l'une existe dans les quatre).
  const html = join(RACINE, item.path.replace(/^\//, ''), 'index.html');
  if (!existsSync(html)) { sautees++; continue; }
  const texte = readFileSync(html, 'utf8');
  testees++;
  for (const v of valeurs) {
    for (const forme of formes(v)) {
      if (texte.includes(forme)) { fuites.push(`${item.path} porte « ${forme} »`); break; }
    }
  }
}
dit(fuites.length === 0, `${testees} fiche(s) verifiees, aucun montant retrouve dans leur page`,
  fuites.length === 0 ? `${sautees} sautee(s) (montant peu distinctif ou page absente)`
    : `${fuites.length} FUITE(S) : ${fuites.slice(0, 5).join(' · ')}`);
dit(testees >= 20, `la couverture est suffisante (${testees} fiches)`,
  testees >= 20 ? null : 'TROP PEU de montants distinctifs — ce banc ne prouve presque rien');

// ── 3. LES EMPLACEMENTS DE COTE SONT VIDES DANS LE HTML ───────────────────
// ⭐ Le controle qui attrape la faute la plus probable des lots suivants :
// quelqu'un ajoute une prop `valeur` a <Cote> « juste pour cette page-la ».
const marqueurs = pages.filter((f) => f.endsWith('.html'))
  .flatMap((f) => (readFileSync(f, 'utf8').match(/<span class="cote[^"]*"[^>]*>.*?<\/span>/gs) || [])
    .map((s) => [f, s]));
const remplis = marqueurs.filter(([, s]) => !/>\s*—\s*</.test(s));
dit(marqueurs.length > 0, `${marqueurs.length} emplacement(s) de cote emis`,
  marqueurs.length ? null : 'AUCUN — le composant <Cote> n\'est rendu nulle part, verifier les gabarits');
dit(remplis.length === 0, 'aucun emplacement de cote ne porte de valeur',
  remplis.length === 0 ? null : `${remplis.length} rempli(s), dont ${remplis[0][0]}`);

// ── 3 bis. LE JOURNAL N'EST PAS ATTEIGNABLE PAR LES ROUTES ────────────────
// ⭐ Il porte, en clair, TOUS les montants du site. Il vit hors de `dist/` — mais
// les deux routes de cote composent un chemin depuis l'URL, donc la seule chose
// qui l'en protege vraiment est la liste blanche des uuid. On le PROUVE, ici,
// avec la meme fonction que celle des routes : « c'est hors de dist/ » et « on
// ne peut pas le demander » sont deux proprietes differentes.
dit(!uuidValide('_projection'), 'le journal ne passe pas la liste blanche des uuid',
  'sinon /api/cote/_projection le servirait a tout abonne');
dit(!uuidValide('_projection.json') && !uuidValide('../.reserve/cote/_projection'),
  'aucune variante du nom du journal ne passe la liste blanche');

// ── 4. LA RESERVE N'EST PAS SOUS dist/ ────────────────────────────────────
// Meme garde que `test_reserve.mjs` pour l'historique : trois barrieres valent
// mieux qu'une, et celle-ci couvre le dossier NEUF de ce lot.
const sousDist = pages.filter((f) => f.includes(`${'.reserve'}`)).length;
dit(sousDist === 0, '.reserve/ n\'apparait pas sous dist/',
  sousDist === 0 ? null : `${sousDist} fichier(s) de reserve SERVIS EN CLAIR`);

console.log(ko === 0 ? '\n✅ aucune fuite de cote dans dist/\n' : `\n🔴 ${ko} controle(s) en echec\n`);
process.exit(ko === 0 ? 0 : 1);
