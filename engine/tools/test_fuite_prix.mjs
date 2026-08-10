// ⚠️ VeVePreda/veve-sites — engine/tools/test_fuite_prix.mjs
// ═══════════════════════════════════════════════════════════════════════════
// LE BANC ANTI-FUITE — il lit `dist/`, pas le code
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ POURQUOI IL REGARDE LE PRODUIT ET PAS LA SOURCE. Tous les autres bancs
// du lot 101 prouvent des INTENTIONS : que `projeter()` retire les champs, que
// la route refuse sans session, que `productLd` n'emet plus d'`offers`. Aucun
// ne prouve le FAIT — « il n'y a pas un seul prix dans ce qu'on publie ». Or
// c'est le seul enonce qui compte, et le seul qu'un lot suivant peut defaire
// sans toucher a une ligne du lot 101 : il suffira que quelqu'un passe une
// valeur a un gabarit, de bonne foi, pour une page neuve.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 REECRIT AU LOT 104 — CE BANC TUAIT LE DEPLOIEMENT DEPUIS LE LOT 101
// ═══════════════════════════════════════════════════════════════════════════
// MESURE DU 07/08/2026, sur le depot `7cf15462` **SANS** le lot 104, dans les
// conditions exactes du Dockerfile (build REEL, puis `WAREHOUSE_OFFLINE=1
// npm run test:fuite`) :
//     KO  la couverture est suffisante (0 fiches)
//     FATAL ERROR: Reached heap limit — JavaScript heap out of memory
// ⭐ Le lot 104 n'en est pas la cause : il l'a rendu VISIBLE en faisant tourner
// le banc sur un vrai catalogue. Sur les 445 pages de l'echantillon local, il
// passe ; sur les 8 484 pages de la production, il abandonne.
// ⭐⭐⭐ UN INSTRUMENT VALIDE SUR UN ECHANTILLON N'EST PAS VALIDE. C'est toute
// la famille de pieges de ce depot, retournee contre le banc lui-meme.
//
// ── DEFAUT 1, ET C'EST LE PLUS GRAVE : IL DETRUISAIT LA RESERVE DU BUILD ───
// Il importait `dataset()`. Sous `WAREHOUSE_OFFLINE=1`, `dataset()` RECALCULE
// tout depuis `engine/data/sample/` — et `projeter()` comme `reserve.fermer()`
// s'executent pour de bon. Mesure : `.reserve/cote/` passe de **1 201 fichiers
// a 0**, et `_projection.json` est remplace par les 90 « sample-… ».
//   · d'ou le `0 fiche(s) verifiees, 1200 sautee(s)` : le banc comparait le
//     journal du build REEL (lu avant) a un dataset d'ECHANTILLON (calcule
//     apres). Deux populations qui ne se rencontrent jamais ;
//   · et l'image de production aurait embarque une reserve VIDE — un site
//     parfaitement vert ou SEULS LES ABONNES ne voient plus aucun prix. Seul le
//     garde-fou du Dockerfile (`COPY .reserve` + comptage separe) l'arretait.
// ⭐⭐⭐ UN BANC QUI RECALCULE CE QU'IL DOIT JUGER NE LE JUGE PLUS, IL LE
// REMPLACE. Ce banc n'a jamais eu besoin de `dataset()` : il compare `dist/` a
// `.reserve/`, deux choses deja ECRITES sur le disque par le build.
// ⛔ NE JAMAIS reimporter `dataset()` ici.
//
// ── DEFAUT 2 : LA MEMOIRE ─────────────────────────────────────────────────
// Chaque page etait lue jusqu'a trois fois, et la liste complete des chemins
// retenue. UN SEUL PARCOURS desormais, en flux : aucun contenu n'est garde, que
// des compteurs et cinq exemples.
//
// ── DEFAUT 3 : LA DISTINCTIVITE ───────────────────────────────────────────
// Le critere « >= 1000 ou non entier » suffisait tant qu'on ne cherchait que
// dans LA page de la piece. En balayant 8 484 pages, « 10,000 » et « 5,000 » se
// retrouvent dans `/analytics/` par pur hasard — trois faux positifs mesures en
// production. ⭐ Le lot 101 l'avait pourtant ecrit : « un banc qui crie au
// hasard finit desactive ». La portee avait ete elargie sans resserrer le
// critere ; les deux vont ensemble.

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

console.log('\n═══ LOT 101/104 — aucune cote ne doit se trouver dans dist/ ═══');

// ── 0. L'INSTRUMENT AVANT LA MESURE ───────────────────────────────────────
// ⭐⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » Sur un `dist/` vide ou
// une reserve absente, tout ce qui suit serait vert. On refuse d'abord de
// mesurer avec un instrument debranche.
if (!existsSync(RACINE)) {
  console.log(`  KO  dist/ introuvable (${RACINE}) — ce banc ne peut RIEN prouver`);
  process.exit(1);
}
const JOURNAL = join(COTE, '_projection.json');

// ── 0 bis. LE BANC SORT SUR LE MANIFESTE, PAS SUR L'ABSENCE D'UN DOSSIER ──
// 🔴 Une premiere version sortait si `.reserve/cote/` n'existait pas. Mesure du
// 07/08 : sur vevewiki ce dossier EXISTE — laisse par le build precedent de
// veveprice dans le meme arbre — et le banc partait verifier une reserve qui
// n'etait pas la sienne, puis echouait trois fois sur un site parfaitement
// sain. ⭐⭐⭐ UN CONTROLE QUI DEDUIT SA RAISON D'ETRE D'UN ARTEFACT SUR LE
// DISQUE HERITE DE TOUT CE QUE LE DISQUE A GARDE. La question « ce site
// ferme-t-il sa cote ? » a une reponse EXACTE, et elle est dans le manifeste.
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

// ═══════════════════════════════════════════════════════════════════════════
// LES MONTANTS TEMOINS — pris dans le journal, jamais recalcules
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ ON LIT LE JOURNAL DE PROJECTION, PAS LES FICHIERS SERVIS. Hors reseau,
// les uuid de l'echantillon valent « sample-0033-570553 » : la liste blanche
// les refuse tous, `.reserve/cote/` sort VIDE de tout build local, et un banc
// branche dessus n'aurait AUCUN montant a comparer. Il serait vert, en CI, pour
// toujours, et pour la seule raison qui rend un banc inutile.
const jrn = JSON.parse(readFileSync(JOURNAL, 'utf8'));
const entrees = Object.entries(jrn.valeurs || {});
dit(entrees.length > 0, `${entrees.length} cote(s) retiree(s) du public`,
  entrees.length ? `${jrn.ecrits || 0} servie(s), ${jrn.refuses || 0} uuid refuse(s)`
    : 'AUCUNE — soit la projection n\'a pas tourne, soit elle n\'ecrit rien');

// ── LE CRITERE DE DISTINCTIVITE, RESSERRE AU LOT 104 ──────────────────────
// ⭐ Un montant n'est retenu que s'il est difficilement INVENTABLE :
//   · non entier — « 10 000 » et « 5 000 » sont partout, « 627.95 » non ;
//   · au moins 100 — en dessous, deux decimales ne distinguent plus rien ;
//   · deuxieme decimale non nulle — ecarte les .50, .25, .10 du langage courant.
// ⛔ ON PERD DE LA COUVERTURE, ET ON L'ASSUME. Le nombre de temoins retenus est
// affiche a chaque execution et garde par un plancher : mieux vaut prouver
// moins et etre cru, que crier souvent et finir desactive.
const distinctif = (v) => Number.isFinite(v) && !Number.isInteger(v)
  && Math.abs(v) >= 100 && Math.round(Math.abs(v) * 100) % 10 !== 0;

// ⚠️ ON CHERCHE LES QUATRE FORMES, PAS LE NOMBRE BRUT. `toLocaleString` rend
// « 1 234,5 » en francais et « 1,234.5 » en anglais : chercher `1234.5` serait
// vert sur une page qui affiche le montant en toutes lettres.
const FORMATS = ['en-GB', 'fr-FR', 'es-ES', 'de-DE'];
const formes = (v) => {
  const out = new Set();
  for (const l of FORMATS) out.add(Number(v).toLocaleString(l, { maximumFractionDigits: 2 }));
  return [...out];
};

// ⭐ 60 temoins : une fuite de page ne fuit jamais UN prix, elle en fuit deux
// cents. Un seul retrouve suffit a la dire. Borner le nombre de temoins borne
// le cout du produit croise (temoins x pages) sans rien couter a la detection.
const ECHANTILLON = 60;
const temoins = [];
for (const [uuid, c] of entrees) {
  if (temoins.length >= ECHANTILLON) break;
  const v = ['floor', 'ath', 'atl', 'prixMedian', 'p95'].map((k) => c[k]).find(distinctif);
  if (v !== undefined) {
    for (const f of formes(v)) temoins.push([f, uuid, v]);
  }
}
// ⭐ L'INSTRUMENT SE DECLARE. Sans temoins, tout ce qui suit serait vert pour la
// seule raison qui rend un banc inutile : il n'a rien a mesurer. Et on le DIT.
dit(temoins.length >= 20, `${temoins.length} forme(s) temoin(s) sur ${entrees.length} cote(s)`,
  temoins.length >= 20 ? null
    : 'TROP PEU de montants distinctifs — ce banc ne prouve presque rien');

// ═══════════════════════════════════════════════════════════════════════════
// LE PARCOURS UNIQUE — tout se mesure ici, rien ne se garde
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ UN SEUL `readFileSync` PAR FICHIER, ET SON CONTENU EST RELACHE AVANT LE
// SUIVANT. La version precedente ouvrait chaque page jusqu'a trois fois et
// retenait la liste complete : 3 Go de tas sur 8 484 pages, puis SIGABRT.
let nbFichiers = 0;
let nbOffre = 0;
let nbMarqueurs = 0;
let sousDist = 0;
const exOffre = [];
const exFuite = [];
const exRempli = [];
// 🔴 LOT 112 — la variation chiffree, ou qu'elle soit rendue. On vise la CLASSE
// `.delta` et non « un pourcentage quelque part » : une page peut legitimement
// ecrire « 30 % » dans une phrase. ⭐ Le selecteur est celui que `vitrine.mjs`
// emet lui-meme (`delta()`), donc le banc et le rendu partagent une seule
// verite — deux parseurs, c'est un qui ment.
const RE_PCT = /class="delta[^"]*"[^>]*>(?:\s*<[^>]+>\s*)*[+-]?\d+[.,]\d+\s*%/g;
let nbPct = 0;
const exPct = [];
// ⛔ Un plafond d'exemples, pas un plafond de PARCOURS : on visite toutes les
// pages meme apres huit fuites. S'arreter tot rendrait le compte final faux, et
// un compte faux se cite ensuite comme un fait.
const MAX_EX = 5;

(function marcher(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { marcher(p); continue; }
    if (!/\.(html|json|xml)$/.test(e.name)) continue;
    nbFichiers++;
    if (p.includes('.reserve')) sousDist++;
    const texte = readFileSync(p, 'utf8');

    // 0. 🔴🔴🔴 LOT 112 — LES POURCENTAGES SONT DES PRIX, ET CE BANC NE LES
    //    VOYAIT PAS. Mesure de production du 10/08 : les 84 emplacements de
    //    prix de l'accueil affichaient « — », et la MEME page servait 44
    //    variations exactes (+277.2 %, +192.9 %…). 2 par fiche, 1 par carte.
    //    ⭐⭐⭐ ET CE BANC ETAIT VERT, A JUSTE TITRE SELON SA PROPRE
    //    DEFINITION : il ne cherche que des MONTANTS « difficilement
    //    inventables ». Un pourcentage n'est pas un montant — il ne figure
    //    dans aucun temoin, il ne ressemble a aucun prix, il passe.
    //    ⛔ Or `/market/` est reserve aux membres PRECISEMENT parce que « les
    //    plus fortes variations » est le produit : on vendait derriere le mur
    //    ce qu'on donnait devant. *Un banc anti-fuite qui ne connait qu'une
    //    forme de fuite garantit surtout qu'on cherchera les autres ailleurs.*
    //    ⚠️ IL EXISTE PARCE QUE `change7d` N'EST PAS ENCORE PROJETE HORS DES
    //    OBJETS. Le lot 112 ferme la fuite dans les GABARITS ; or « on ne cache
    //    pas un champ, on ne le projette pas » — une regle tenue par la
    //    discipline seule se defait au lot suivant. C'est ce controle, et lui
    //    seul, qui rend l'etat intermediaire tenable jusqu'au lot 114 (qui
    //    projette le champ ET restitue la cle de tri du Market depuis la
    //    reserve). ⛔ NE PAS LE SUPPRIMER ce jour-la : il deviendra le controle
    //    qui PROUVE que la projection a bien eu lieu.
    if (e.name.endsWith('.html')) {
      const pc = texte.match(RE_PCT);
      if (pc) {
        nbPct += pc.length;
        if (exPct.length < MAX_EX) exPct.push(`${p.slice(RACINE.length)} (${pc.length})`);
      }
    }

    // 1. Aucune page n'annonce un prix en donnees structurees.
    if (e.name.endsWith('.html') && /"@type"\s*:\s*"Offer"/.test(texte)) {
      nbOffre++;
      if (exOffre.length < MAX_EX) exOffre.push(p.slice(RACINE.length));
    }

    // 2. Les emplacements de cote sont VIDES. ⭐ Le controle qui attrape la
    // faute la plus probable des lots suivants : quelqu'un passe une prop
    // `valeur` a <Cote> « juste pour cette page-la ».
    if (e.name.endsWith('.html')) {
      // 🔴 LOT 112 — LE SELECTEUR ETAIT UN PREFIXE, ET IL S'EST MIS A MENTIR.
      // `class="cote[^"]*"` attrape `cote`, mais aussi `cote__v` et — depuis ce
      // lot — `cote__l`, le cadenas. Le cadenas ne contient pas « — » mais un
      // <svg> : le banc a donc annonce 8 484 emplacements « remplis », c'est-a-
      // dire une FUITE DE PRIX MASSIVE, sur un lot qui n'en introduit aucune.
      // ⭐⭐⭐ IL ETAIT ROUGE POUR UNE MAUVAISE RAISON, et le reflexe naturel
      // aurait ete de retirer le cadenas pour le faire taire. C'est
      // l'instrument qu'on corrige, jamais le code pour lui plaire.
      // ⭐ La faiblesse etait LATENTE depuis le lot 101 : toute classe
      // commençant par « cote » l'aurait declenchee. Elle attendait qu'on en
      // ajoute une. `(?: [^"]*)?` exige desormais soit la fin du nom, soit une
      // ESPACE — c'est-a-dire une seconde classe, jamais un suffixe BEM.
      const m = texte.match(/<span class="cote(?: [^"]*)?"[^>]*>.*?<\/span>/gs);
      if (m) {
        nbMarqueurs += m.length;
        for (const bloc of m) {
          if (!/>\s*—\s*</.test(bloc) && exRempli.length < MAX_EX) exRempli.push(p.slice(RACINE.length));
        }
      }
    }

    // 3. AUCUN MONTANT TEMOIN NULLE PART — le controle central du lot 104.
    // ⭐⭐⭐ Il ne demande plus « la fiche de cette piece porte-t-elle son
    // prix ? » mais « CE MONTANT EXISTE-T-IL QUELQUE PART DANS dist/ ? ».
    // La premiere question etait suffisante au lot 101 — seules les fiches
    // portaient un montant. Elle a cesse de l'etre quand `/market/` est
    // revenue : une page de liste qui retomberait en pre-generee ecrirait 200
    // montants d'un coup, et l'ancienne forme ne l'aurait jamais regarde.
    // ⛔ « Un controle qui ne regarde que ce qui existe ne voit jamais ce qui
    // manque » — et un oubli dans ROUTES_COMPTE ne produit AUCUN run rouge.
    if (exFuite.length < MAX_EX) {
      for (const [forme, uuid] of temoins) {
        if (texte.includes(forme)) {
          exFuite.push(`${p.slice(RACINE.length)} porte « ${forme} » (${uuid.slice(0, 8)})`);
          break;
        }
      }
    }
  }
})(RACINE);

dit(nbFichiers > 50, `${nbFichiers} fichier(s) publie(s) inspecte(s)`,
  nbFichiers > 50 ? null : 'TROP PEU — le banc serait vert par manque de matiere');
dit(nbOffre === 0, 'aucune page n\'emet un `Offer` en donnees structurees',
  nbOffre === 0 ? null : `${nbOffre} page(s), dont ${exOffre.join(' · ')}`);
dit(nbMarqueurs > 0, `${nbMarqueurs} emplacement(s) de cote emis`,
  nbMarqueurs ? null : 'AUCUN — le composant <Cote> n\'est rendu nulle part, verifier les gabarits');
dit(exRempli.length === 0, 'aucun emplacement de cote ne porte de valeur',
  exRempli.length === 0 ? null : `rempli(s), dont ${exRempli.join(' · ')}`);
dit(nbPct === 0, `aucune variation chiffree dans les ${nbFichiers} page(s) publiee(s)`,
  nbPct === 0 ? null
    : `${nbPct} pourcentage(s) en clair, dont ${exPct.join(' · ')}`
      + '\n     🔴 LE PRIX EST FERME ET LE MOUVEMENT EST OUVERT — c\'est le'
      + '\n        classement que /market/ fait payer, donne devant le mur.');
dit(exFuite.length === 0,
  `aucun des ${temoins.length} montants temoins ne se retrouve dans les ${nbFichiers} page(s) publiee(s)`,
  exFuite.length === 0 ? null : `FUITE(S) : ${exFuite.join(' · ')}`);
if (exFuite.length) {
  console.log('     🔴 UN MONTANT RESERVE EST DANS `dist/`, DONC SERVI EN CLAIR PAR NGINX.');
  console.log('     ➡️  Verifier d\'abord `engine/lib/astro_routes_compte.mjs` : une page qui lit');
  console.log('        la reserve et qui n\'y est PAS inscrite reste pre-generee, en silence.');
  console.log('        C\'est la panne du lot 24, et elle ne produit aucun run rouge.');
}

// ── 4. LE JOURNAL N'EST PAS ATTEIGNABLE PAR LES ROUTES ────────────────────
// ⭐ Il porte, en clair, TOUS les montants du site. Il vit hors de `dist/` — mais
// les deux routes de cote composent un chemin depuis l'URL, donc la seule chose
// qui l'en protege vraiment est la liste blanche des uuid. On le PROUVE, ici,
// avec la meme fonction que celle des routes : « c'est hors de dist/ » et « on
// ne peut pas le demander » sont deux proprietes differentes.
dit(!uuidValide('_projection'), 'le journal ne passe pas la liste blanche des uuid',
  'sinon /api/cote/_projection le servirait a tout abonne');
dit(!uuidValide('_projection.json') && !uuidValide('../.reserve/cote/_projection'),
  'aucune variante du nom du journal ne passe la liste blanche');

// ── 5. LA RESERVE N'EST PAS SOUS dist/ ────────────────────────────────────
// Meme garde que `test_reserve.mjs` pour l'historique : trois barrieres valent
// mieux qu'une, et celle-ci couvre le dossier de cote.
dit(sousDist === 0, '.reserve/ n\'apparait pas sous dist/',
  sousDist === 0 ? null : `${sousDist} fichier(s) de reserve SERVIS EN CLAIR`);

console.log(ko === 0 ? '\n✅ aucune fuite de cote dans dist/\n' : `\n🔴 ${ko} controle(s) en echec\n`);
// ═══════════════════════════════════════════════════════════════════════════
//  🔴🔴🔴 LOT 112 — LES POURCENTAGES SONT DES PRIX, ET CE BANC NE LES VOYAIT PAS
// ═══════════════════════════════════════════════════════════════════════════
//  Mesuré en production le 10/08/2026 : les 84 emplacements de prix de
//  l'accueil affichaient « — », et la même page servait 44 VARIATIONS EXACTES
//  (+277.2 %, +192.9 %…). Chaque fiche en portait 2, chaque carte 1.
//
//  ⭐⭐⭐ ET CE BANC ÉTAIT VERT, À JUSTE TITRE SELON SA PROPRE DÉFINITION : il
//  cherche des MONTANTS « difficilement inventables » (voir plus haut). Un
//  pourcentage n'est pas un montant — il ne figure dans aucun témoin, il ne
//  ressemble à aucun prix, il passe.
//  ⛔ Or `/market/` est réservé aux membres PRÉCISÉMENT parce que « les plus
//  fortes variations » est le produit. On vendait derrière le mur ce qu'on
//  donnait devant. *Un banc anti-fuite qui ne connaît qu'une forme de fuite
//  garantit surtout qu'on cherchera les autres ailleurs.*
//
//  ⚠️ IL EXISTE PARCE QUE `change7d` N'EST PAS ENCORE PROJETÉ HORS DES OBJETS.
//  Le lot 112 ferme la fuite dans les GABARITS ; or « on ne cache pas un champ,
//  on ne le projette pas » — une règle tenue par la discipline seule se défait
//  au lot suivant. C'est ce contrôle, et lui seul, qui rend l'état intermédiaire
//  tenable jusqu'au lot 114 (qui projette le champ ET restitue la clé de tri du
//  Market depuis la réserve).
//  ⛔ NE PAS LE SUPPRIMER quand le champ sera projeté : il deviendra alors le
//  contrôle qui prouve que la projection a bien eu lieu.

process.exit(ko === 0 ? 0 : 1);
