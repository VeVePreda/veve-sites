// ⚠️ VeVePreda/veve-sites — engine/tools/test_analytics.mjs  (FICHIER NEUF — lot 157)
// ═══════════════════════════════════════════════════════════════════════════
//  LE BANC DU DÉCOUPAGE D'ANALYTICS — il observe `dist/`, pas les sources
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 CE QU'IL EXISTE POUR ATTRAPER, ET CE N'EST PAS « LA PAGE EST CASSÉE ».
// Les quatre sujets sont `prerender = false` par arbitrage de Preda du 18/08 :
// zéro page, invisibles à Google. Le mode de panne n'est donc PAS un 500 ni un
// 404 — c'est le SILENCE :
//   · un oubli dans `ROUTES_COMPTE` les PRÉ-GÉNÉRERAIT. Quatre fichiers
//     apparaîtraient dans `dist/`, servis en clair par nginx à qui connaît
//     l'adresse, avec dedans tout ce que `franchit()` aurait laissé passer au
//     build. Le build resterait vert. Les pages auraient l'air correctes ;
//   · et elles entreraient dans le sitemap, que personne ne relit.
// ⭐⭐ C'est le mode de panne de `/market/` au lot 104, mot pour mot : « un
// oubli qui rend muet se découvre par une plainte ; un oubli qui rend public
// ne se découvre par rien ».
//
// ⭐⭐⭐ POURQUOI UN BANC DE PLUS PLUTÔT QU'UNE LIGNE DANS UN AUTRE. La règle
// du dépôt est d'ÉTENDRE. Elle a été suivie là où elle s'applique :
// `test:pages` gagne les quatre routes (il DEMANDE, il a un serveur),
// `test:nginx` les lit déjà tout seul dans `ROUTES_COMPTE`. Ce qui reste — ce
// que `dist/` contient et ce que deux fichiers source se promettent l'un à
// l'autre — n'est demandé par AUCUN banc existant et ne coûte pas un serveur.
// ⚠️ `test:fuite` balaie bien `dist/`, mais il cherche des MONTANTS : quatre
// pages entières apparues par surprise ne déclenchent rien chez lui si elles
// ne portent pas de prix. *Un banc branché sur la bonne zone peut regarder la
// mauvaise propriété.*
//
// ⛔ IL NE LANCE AUCUN SERVEUR, ET C'EST DÉLIBÉRÉ. Tout ce qu'il demande est
//    déjà écrit sur le disque après `npm run build`. Un serveur de plus, c'est
//    trente secondes et un port à disputer pour zéro question supplémentaire.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// ⭐ LA MÊME SOURCE QUE LA ZONE « comptes » DE `astro_features.mjs` — `tiers.length > 1`.
// ⛔ Pas un `if (site === 'vevewiki')` : ce serait une seconde définition de
//    « ce site vend-il un abonnement », et deux définitions divergent toujours.
import { comptesActifs } from '../lib/features.mjs';

const RACINE = process.env.PROJECT_ROOT || process.cwd();
const ICI = dirname(fileURLToPath(import.meta.url));
const DIST = join(RACINE, 'dist');
const CLIENT = existsSync(join(DIST, 'client')) ? join(DIST, 'client') : DIST;

const SUJETS = ['market', 'catalogue', 'collections', 'chain'];

let ko = 0;
let indecidables = 0;
const dit = (ok, titre, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};
const indecidable = (titre, pourquoi) => {
  console.log(`  ⏸️  ${titre}   — INDÉCIDABLE : ${pourquoi}`);
  indecidables++;
};

const lire = (p) => readFileSync(p, 'utf8');
const SRC = join(RACINE, 'src');
const PORTE = join(SRC, 'components', 'pages', 'Analytics.astro');
const SUJET = join(SRC, 'components', 'pages', 'AnalyticsSujet.astro');

console.log('\nle découpage d\'Analytics tient-il ses promesses ?');

// ═══════════════════════════════════════════════════════════════════════════
// 0. LES AUTO-CONTRÔLES — un banc doit d'abord prouver qu'il regarde quelque
//    chose. ⛔ Sans eux, tout ce qui suit passerait au vert sur un dépôt vide :
//    « aucune page de sujet dans dist/ » est trivialement vrai quand `dist/`
//    n'existe pas. C'est la faute du 17/08, comptée deux fois cette semaine.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n0. le banc regarde-t-il vraiment quelque chose ?');

const sourcesLa = existsSync(PORTE) && existsSync(SUJET);
dit(sourcesLa, 'les deux composants d\'Analytics existent',
    sourcesLa ? 'Analytics.astro + AnalyticsSujet.astro'
              : 'un composant manque — les §3 et §4 seraient creux');
if (!sourcesLa) { console.log('\n⛔ banc creux : on s\'arrête ici.'); process.exit(1); }

const distLa = existsSync(CLIENT) && existsSync(join(CLIENT, 'analytics', 'index.html'));
const batiLa = existsSync(CLIENT) && existsSync(join(CLIENT, 'index.html'));

// ═══════════════════════════════════════════════════════════════════════════
// 0 bis. LE SITE A-T-IL SEULEMENT UN ESPACE MEMBRE ? — lot 157-B
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 SUR vevewiki, TOUT CE QUI SUIT S'INVERSE, ET LA PREMIÈRE VERSION DE CE
// BANC NE LE SAVAIT PAS. Elle rendait « INDÉCIDABLE — jouer après le build »,
// ce qui est FAUX DEUX FOIS : le build avait eu lieu, et l'absence de
// `/analytics/` y est **voulue** (arbitrage Preda du 18/08 : « le wiki n'a plus
// de page Analytics »). ⭐ Un verdict imprécis envoie chercher un build qui a
// déjà tourné.
// ⭐⭐ QUATRE VERDICTS, PAS TROIS : conforme · écart · indécidable · SANS OBJET.
// Et « sans objet » ne veut pas dire « rien à contrôler » : sur ce site-là, la
// question devient l'INVERSE — *l'extinction a-t-elle bien tout emporté ?*
// C'est ce que le § 1 bis vérifie, et il aurait attrapé le défaut du 18/08
// (4 talons fantômes servis en 200 sur le wiki).
if (!comptesActifs()) {
  console.log('\n⏸️  SANS OBJET — ce site n\'a pas d\'espace membre (`access.tiers` = 1 palier).');
  console.log('   Analytics y est ÉTEINTE par `astro_features.mjs` — arbitrage Preda du 18/08.');
  console.log('\n1 bis. l\'extinction a-t-elle TOUT emporté ?');
  if (!batiLa) {
    indecidable('aucune page d\'Analytics ne survit', `${CLIENT} ne contient pas d'index.html — jouer après \`npm run build\``);
  } else {
    // ⛔ ON BALAIE `dist/`, ON NE TESTE PAS QUATRE CHEMINS. Les préfixes de
    //    langue en fabriquent d'autres (`/fr/analytics/…`) — c'est la panne du
    //    lot 139 : « le talon racine partait, ses trois traductions restaient ».
    const restants = [];
    (function balayer(d) {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const f = join(d, e.name);
        if (e.isDirectory()) { if (e.name !== 'server' && e.name !== 'chunks') balayer(f); }
        else if (e.name === 'index.html' && /(^|\/)analytics(\/|$)/.test(f.slice(CLIENT.length).replace(/\\/g, '/'))) {
          restants.push(f.slice(CLIENT.length).replace(/\\/g, '/'));
        }
      }
    })(CLIENT);
    dit(restants.length === 0, 'aucune page d\'Analytics ne survit dans dist/',
      restants.length
        ? `🔴 ${restants.length} page(s) FANTÔME(S) : ${restants.slice(0, 8).join(', ')} — servies en 200, `
          + 'en `noindex`, donc jamais visitées et jamais signalées. ⇒ leur préfixe manque dans '
          + '`astro_features.mjs`, ou la page n\'émet pas de talon.'
        : `${readdirSync(CLIENT).length} entrée(s) balayée(s) à la racine de dist/`);
    // ⭐ ET LE SITEMAP, parce que c'est lui qu'un moteur lit.
    const sm = join(CLIENT, 'sitemap.xml');
    if (existsSync(sm)) {
      const n = (lire(sm).match(/analytics/g) || []).length;
      dit(n === 0, 'le sitemap n\'annonce aucune adresse d\'Analytics',
        n ? `🔴 ${n} mention(s)` : 'aucune mention');
    } else {
      indecidable('le sitemap n\'annonce aucune adresse', 'sitemap.xml absent');
    }
  }
  console.log(`\n${ko === 0 ? '✅' : '❌'} ${ko} écart(s)`
    + (indecidables ? ` · ⏸️ ${indecidables} indécidable(s)` : ''));
  process.exit(ko === 0 ? 0 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. AUCUN SUJET NE DOIT AVOIR ÉTÉ ÉCRIT DANS `dist/`
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ EN MODE STATIQUE, L'ATTENDU S'INVERSE, et c'est écrit dans le moteur :
// `astro_routes_compte.mjs` PRÉ-GÉNÈRE ces routes quand `mode !== 'server'`,
// parce qu'un site statique n'a pas de session. Vérifier « absentes » là-bas
// ferait rougir vevewiki pour un comportement correct.
// ⭐ Trois verdicts, pas deux : conforme, écart, SANS OBJET.
//
// 🔴🔴🔴 ET LE MODE NE SE LIT **PAS** DANS `process.env.RENDERING` — MESURÉ LE
// 18/08. Dans le `Dockerfile`, `RENDERING` n'est PAS un `ENV` : il est exporté
// dans le SEUL `RUN` du build (l. 273, `export RENDERING=$(cat
// /app/.rendering)`). Chaque `RUN` est un shell neuf. Tout banc qui teste
// `process.env.RENDERING !== 'server'` se déclare donc « sans objet » À CHAQUE
// BUILD DES DEUX SITES, et sort en 0.
// ⭐⭐⭐ *Un banc muet ressemble à un succès*, et celui-là le serait pour une
// raison qu'on ne peut pas voir en le lisant : la panne n'est pas dans le banc,
// elle est dans l'environnement de la ligne qui l'appelle.
// ⇒ ON CALE SUR UNE ANCRE INDÉPENDANTE : `dist/server/entry.mjs` n'existe
//   QU'EN MODE SERVER. C'est un fait produit par le build lui-même, pas une
//   variable que quelqu'un doit penser à passer.
// ⛔ `RENDERING` reste lu en SECOURS, jamais seul : si l'adaptateur change un
//   jour de chemin de sortie, on veut encore pouvoir trancher.
console.log('\n1. les quatre sujets sont-ils absents de `dist/` ?');

const modeServeur = existsSync(join(DIST, 'server', 'entry.mjs'))
  || process.env.RENDERING === 'server';

// ⛔ L'ORDRE DE CES TROIS BRANCHES EST LE CONTRÔLE LUI-MÊME. Sans `dist/`,
//    `modeServeur` est faux — et conclure « sans objet, site statique » serait
//    une réponse CONFIANTE tirée d'une absence de mesure. On distingue « je
//    sais que ce site est statique » de « je n'ai rien à regarder ».
if (!distLa) {
  indecidable('les quatre sujets sont absents de `dist/`',
    `${join(CLIENT, 'analytics', 'index.html')} est absent — ce banc doit être joué APRÈS \`npm run build\``);
} else if (!modeServeur) {
  console.log('  ⏸️  sans objet — ce site est en mode STATIQUE : ces routes y sont '
    + 'pré-générées à dessein (aucune session n\'y est possible).');
} else {
  for (const s of SUJETS) {
    const f = join(CLIENT, 'analytics', s, 'index.html');
    dit(!existsSync(f), `/analytics/${s}/ n'est pas dans dist/`,
        existsSync(f)
          // ⚠️ CE MESSAGE DIT CE QU'IL A MESURÉ, PAS CE QU'IL EN DÉDUIT.
          // Sa première version affirmait « son contenu réservé est servi en
          // clair et elle est entrée dans le sitemap » — deux conséquences
          // PLAUSIBLES que ce contrôle-ci n'a pas constatées. Mesuré le 18/08
          // par injection : le fichier pré-généré faisait 477 o, c'était la
          // REDIRECTION figée au build, et le sitemap ne la portait pas.
          // ⭐ Un message d'échec qui affirme au-delà de sa mesure envoie
          // chercher une fuite qui n'existe pas — et fait douter du banc le
          // jour où elle existera vraiment.
          ? `LE FICHIER EXISTE (${statSync(f).size} o) : la route a été PRÉ-GÉNÉRÉE, donc figée au `
            + 'palier `visitor` du build et servie par nginx à qui connaît l\'adresse. '
            + `⇒ \`${'pages/analytics/' + s + '/index.astro'}\` manque dans ROUTES_COMPTE. `
            + 'Vérifier ensuite ce que le fichier CONTIENT et si le sitemap l\'annonce.'
          : 'rendue à la demande, comme voulu');
  }
  // ⭐ ET ON REGARDE AUSSI LE SITEMAP, parce que c'est LUI que Preda a demandé
  // de garder propre. Un fichier absent de `dist/analytics/<s>/` mais présent
  // dans le sitemap voudrait dire qu'une liste d'URL est écrite ailleurs qu'à
  // partir des pages réellement produites — ça s'est déjà vu (lot du blog).
  const sm = join(CLIENT, 'sitemap.xml');
  if (existsSync(sm)) {
    const x = lire(sm);
    const fuites = SUJETS.filter((s) => x.includes(`/analytics/${s}/`));
    dit(fuites.length === 0, 'aucun sujet n\'est annoncé dans le sitemap',
        fuites.length ? `annoncés : ${fuites.join(', ')}` : `${SUJETS.length} sujets vérifiés`);
  } else {
    indecidable('le sitemap n\'annonce aucun sujet', 'sitemap.xml absent de dist/');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. LA PORTE, ELLE, DOIT ÊTRE PUBLIQUE ET PORTER LES QUATRE ADRESSES
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ C'EST LE CONTRÔLE QUI EMPÊCHE LE PIRE DES RÉSULTATS DE CE LOT : quatre
// pages fermées et un index qui n'y mène pas. Le site aurait alors du contenu
// réservé qu'AUCUN membre ne peut atteindre — invisible à Google par
// construction, et invisible aux membres par accident. Personne ne s'en
// plaindrait, et c'est bien le problème.
console.log('\n2. la porte `/analytics/` mène-t-elle aux quatre sujets ?');

if (!distLa) {
  indecidable('la porte mène aux quatre sujets', 'dist/analytics/index.html est absent — jouer après le build');
} else {
  const html = lire(join(CLIENT, 'analytics', 'index.html'));
  dit(html.length > 500, 'la porte a bien été produite', `${html.length} o`);
  for (const s of SUJETS) {
    dit(html.includes(`/analytics/${s}/`), `elle porte le lien vers /analytics/${s}/`,
        html.includes(`/analytics/${s}/`) ? '' : 'ADRESSE ABSENTE : ce sujet est inatteignable depuis le site');
  }

  // ═══ 3. ET ELLE NE DOIT PLUS RIEN SERVIR ═══════════════════════════════
  // ⭐ « Porte nue » est un choix de Preda, pas une figure de style : si le
  // contenu remontait ici, il redeviendrait PUBLIC — l'inverse exact de ce
  // qu'il a demandé, sur un build vert.
  // ⚠️ ON VISE DES MARQUEURS DE STRUCTURE, PAS DES CHIFFRES. Chercher un
  // montant ferait de ce contrôle un doublon de `test:fuite`, et surtout un
  // contrôle INDÉCIDABLE quand la cote est fermée — le journal n'a alors aucun
  // montant à trouver, et l'absence passerait pour une preuve.
  console.log('\n3. la porte est-elle bien NUE ?');
  const marqueurs = [
    ['<table', 'un tableau (l\'amplitude est descendue chez le sujet Marché)'],
    ['<figure', 'une figure (les figures sont descendues chez les sujets)'],
    ['data-led=', 'un conteneur du grand livre (ils vivent chez les sujets)'],
    ['data-sceau=', 'un sceau de porte fermée (plus rien n\'est à cadenasser ici)'],
  ];
  for (const [m, quoi] of marqueurs) {
    dit(!html.includes(m), `la porte ne contient plus ${quoi}`,
        html.includes(m) ? `« ${m} » trouvé : du contenu est REMONTÉ dans la page publique` : '');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. LES DEUX LISTES DE SUJETS NE DOIVENT PAS DIVERGER
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ ELLES SONT SÉPARÉES VOLONTAIREMENT — la porte est publique et pré-générée,
// et elle ne doit pas importer un module qui parle de contenu réservé. Le prix
// de cette séparation, c'est qu'elles peuvent diverger en silence : un sujet
// ajouté chez l'un et pas chez l'autre donne soit une carte vers un 404, soit
// une page que rien n'annonce.
// ⭐ Le banc paie ce prix à leur place. C'est le seul contrôle du lot qui lise
//    les SOURCES, et il le dit.
console.log('\n4. les deux listes de sujets concordent-elles ?');

// 🔴🔴 `^ {2}` — DEUX ESPACES EXACTEMENT, PAS « DEUX À QUATRE ».
// Première écriture : `^\s{2,4}([a-z_]+):`. Elle attrapait les clés du SECOND
// niveau (`cle`, `amplitude`, `figures`, `led`) en même temps que les sujets,
// et rendait 20 entrées au lieu de 4. Le banc rougissait — pour la mauvaise
// raison, sur un code juste. ⭐ Un contrôle qui vise « une clé indentée » vise
// aussi toutes les clés imbriquées : c'est la STRUCTURE qu'il faut nommer, pas
// une plage d'espaces.
const clesDe = (src, motif) => {
  const bloc = src.match(motif);
  if (!bloc) return null;
  return bloc[1].match(/^ {2}([a-z_]+):/gm)?.map((x) => x.trim().replace(':', '')) || [];
};
const srcPorte = lire(PORTE);
const srcSujet = lire(SUJET);

const listePorte = srcPorte.match(/const\s+SUJETS\s*=\s*\[([^\]]*)\]/)?.[1]
  ?.match(/'([a-z_]+)'/g)?.map((x) => x.replace(/'/g, '')) || null;
const listeSujet = clesDe(srcSujet, /const\s+SUJETS\s*=\s*\{([\s\S]*?)\n\};/);

if (!listePorte || !listeSujet) {
  // ⛔ ON NE PASSE PAS AU VERT PARCE QU'ON N'A RIEN TROUVÉ. Une expression
  // régulière qui perd son point d'accroche rend une liste vide, et deux
  // listes vides « concordent » parfaitement. C'est le faux vert le plus
  // fréquent de ce dépôt.
  dit(false, 'les deux listes ont pu être lues',
      `porte: ${listePorte ? listePorte.length : 'ILLISIBLE'} · sujets: ${listeSujet ? listeSujet.length : 'ILLISIBLE'} `
      + '— le banc a perdu son point d\'accroche, il ne conclut pas');
} else {
  dit(listePorte.length >= 4 && listeSujet.length >= 4, 'les deux listes sont non vides',
      `porte: ${listePorte.length} · sujets: ${listeSujet.length}`);
  const seulPorte = listePorte.filter((s) => !listeSujet.includes(s));
  const seulSujet = listeSujet.filter((s) => !listePorte.includes(s));
  dit(seulPorte.length === 0, 'aucun sujet annoncé par la porte n\'est inconnu du composant',
      seulPorte.length ? `${seulPorte.join(', ')} → la carte mènerait à une page qui LÈVE` : '');
  dit(seulSujet.length === 0, 'aucun sujet du composant n\'est absent de la porte',
      seulSujet.length ? `${seulSujet.join(', ')} → une page que RIEN n'annonce` : '');
  dit(listePorte.join() === SUJETS.join(), 'la liste est bien celle qu\'attend ce banc',
      `attendu ${SUJETS.join(', ')} — lu ${listePorte.join(', ')}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. LES HUIT ROUTES SONT-ELLES INSCRITES DANS `ROUTES_COMPTE` ?
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ `test:nginx` lit déjà cette liste pour vérifier que nginx les DEMANDE.
// Personne ne vérifie qu'elles y SONT. Le §1 l'attrape après un build en mode
// server — celui-ci l'attrape sans build, en trois millisecondes, et il le dit
// en nommant la ligne à écrire.
console.log('\n5. les huit routes sont-elles dans ROUTES_COMPTE ?');

const ROUTES_MJS = join(RACINE, 'engine', 'lib', 'astro_routes_compte.mjs');
if (!existsSync(ROUTES_MJS)) {
  dit(false, 'astro_routes_compte.mjs est lisible', 'fichier absent');
} else {
  const src = lire(ROUTES_MJS);
  const bloc = src.match(/const\s+ROUTES_COMPTE\s*=\s*\[([\s\S]*?)\];/);
  if (!bloc) {
    dit(false, 'ROUTES_COMPTE a pu être lue', 'motif introuvable — banc creux');
  } else {
    // 🔴🔴🔴 ON RETIRE LES COMMENTAIRES AVANT DE LIRE, ET C'EST LA CORRECTION
    // D'UN FAUX ROUGE MESURÉ LE 18/08 SUR CE FICHIER MÊME.
    // Première écriture : `bloc[1].match(/'([^']+)'/g)`. Les commentaires de
    // `ROUTES_COMPTE` sont en français et pleins d'apostrophes droites —
    // « qui connaît l'adresse », « qu'elles n'entrent ». Chacune ouvre ou ferme
    // une chaîne aux yeux de cette expression : l'extraction rendait 56
    // « routes » dont la plupart étaient des morceaux de phrase, et les vraies
    // lignes ne s'y retrouvaient plus. Le banc a déclaré ABSENTES huit routes
    // parfaitement inscrites, sur un build qui venait de les basculer.
    // ⭐⭐⭐ *Un critère qui juge une VALEUR mais cherche une CHAÎNE mord sur
    // les commentaires.* Septième banc faux de la semaine, aucun défaut dans
    // le code livré — et c'est toujours la même cause.
    // ⛔ Et on ancre sur `pages/` : une route de ce dépôt commence TOUJOURS
    //    par là. Une phrase de commentaire, jamais.
    const sansCommentaires = bloc[1].replace(/\/\/[^\n]*/g, '');
    const inscrites = (sansCommentaires.match(/'(pages\/[^']+)'/g) || [])
      .map((x) => x.replace(/'/g, ''));
    dit(inscrites.length >= 20, 'ROUTES_COMPTE a bien été lue', `${inscrites.length} routes`);
    for (const s of SUJETS) {
      for (const p of [`pages/analytics/${s}/index.astro`, `pages/[locale]/analytics/${s}/index.astro`]) {
        dit(inscrites.includes(p), `${p}`,
            inscrites.includes(p) ? '' : 'ABSENTE : cette route sera PRÉ-GÉNÉRÉE en silence');
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. LES LIBELLÉS DES QUATRE SUJETS EXISTENT-ILS DANS LES CINQ DICTIONNAIRES ?
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ `test:cles` fait ce travail pour tout le dépôt — mais il compare les clés
// ENTRE dictionnaires, donc une clé oubliée dans les CINQ passe inaperçue chez
// lui. Elle sortirait alors telle quelle à l'écran (« analytics.market »), sur
// un build vert. ⭐ Ici on nomme les clés qu'on attend, et le terme à zéro est
// atteignable : retirer une ligne d'un dictionnaire rougit.
console.log('\n6. les libellés des sujets sont-ils traduits partout ?');

const I18N = join(RACINE, 'engine', 'i18n');
const CLES = ['analytics.market', 'analytics.catalog', 'analytics.collections', 'analytics.chain']
  .flatMap((c) => [c, `${c}.d`])
  .concat(['analytics.subjects', 'analytics.membersOnly', 'analytics.lead'])
  // ⭐ LOT 165 — les cinq clés des compteurs de carte. Elles entrent ICI plutôt
  // que dans un banc neuf : ce § vérifie déjà « toute clé de cette page vit
  // dans les cinq dictionnaires », et c'est exactement la question posée.
  // 🔴 UNE CLÉ PAR NOMBRE GRAMMATICAL — `.fig` / `.figs`. Un gabarit qui
  // ajouterait un `s` coderait la règle du français dans une page servie en
  // cinq langues, et l'allemand la démentirait tout seul (Grafik/Grafiken).
  .concat(['analytics.n.rank', 'analytics.n.fig', 'analytics.n.figs',
           'analytics.n.mod', 'analytics.n.mods']);

if (!existsSync(I18N)) {
  dit(false, 'le dossier des dictionnaires existe', `${I18N} absent`);
} else {
  const dicos = readdirSync(I18N).filter((f) => f.endsWith('.json'));
  dit(dicos.length >= 4, 'les dictionnaires ont été trouvés', dicos.join(', '));
  for (const d of dicos) {
    let j;
    try { j = JSON.parse(lire(join(I18N, d))); }
    catch (e) { dit(false, `${d} est un JSON valide`, e.message); continue; }
    // ⚠️ `=== undefined` ET PAS `!j[c]` : une chaîne VIDE est falsy, elle
    // serait donc annoncée « manquante » alors qu'elle est présente et creuse.
    // Les deux défauts se corrigent différemment — l'un s'ajoute, l'autre se
    // remplit — et un message qui les confond envoie chercher au mauvais
    // endroit.
    const manquantes = CLES.filter((c) => j[c] === undefined);
    const vides = CLES.filter((c) => j[c] !== undefined && String(j[c]).trim() === '');
    dit(manquantes.length === 0 && vides.length === 0, `${d} porte les ${CLES.length} clés du lot 157`,
        manquantes.length ? `manque : ${manquantes.join(', ')}`
        : vides.length ? `vide(s) : ${vides.join(', ')}` : '');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 bis. LES COMPTEURS DE CARTE DISENT-ILS LE VRAI ? (lot 165)
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ POURQUOI CE § EXISTE. Les quatre cartes de la porte annoncent désormais ce
// qu'on trouve derrière (« 5 figures », « 2 modules »…). Ces chiffres vivent
// dans une TROISIÈME liste, `CONTENU`, séparée de `SUJETS` d'
// `AnalyticsSujet.astro` pour la même raison que la deuxième : une page
// publique et pré-générée ne doit pas importer le module qui parle de contenu
// réservé. ⛔ Le prix de cette séparation, c'est qu'elle peut mentir — une
// figure ajoutée au sujet et pas au compteur, et la porte promet faux.
// 🔴 UNE PROMESSE FAUSSE EST PIRE QU'UNE ABSENCE DE PROMESSE : « 5 figures »
//    sur une page qui en porte 3 se lit comme une panne du site, pas comme une
//    note périmée.
console.log('\n4 bis. les compteurs annoncés par la porte sont-ils ceux des sujets ?');

// ⚠️ ON RELIT LA SOURCE, ON NE L'IMPORTE PAS : `AnalyticsSujet.astro` est un
// composant Astro, il ne s'importe pas depuis Node. C'est la même contrainte
// que le § 4, et le même remède.
const blocContenu = srcPorte.match(/const\s+CONTENU\s*=\s*\{([\s\S]*?)\n\};/);
const blocSujets  = srcSujet.match(/const\s+SUJETS\s*=\s*\{([\s\S]*?)\n\};/);

if (!blocContenu || !blocSujets) {
  // ⛔ MÊME DISCIPLINE QU'AU § 4 : une accroche perdue ne conclut pas.
  dit(false, 'les deux blocs ont pu être lus',
      `CONTENU: ${blocContenu ? 'lu' : 'ILLISIBLE'} · SUJETS: ${blocSujets ? 'lu' : 'ILLISIBLE'}`
      + ' — le banc a perdu son point d\'accroche, il ne conclut pas');
} else {
  // CONTENU : `  market: { fig: 0, mod: 1, rang: true },`
  const annonce = {};
  for (const m of blocContenu[1].matchAll(/^ {2}([a-z_]+):\s*\{([^}]*)\}/gm)) {
    const corps = m[2];
    annonce[m[1]] = {
      fig: Number(corps.match(/fig:\s*(\d+)/)?.[1] ?? -1),
      mod: Number(corps.match(/mod:\s*(\d+)/)?.[1] ?? -1),
      rang: /rang:\s*true/.test(corps),
    };
  }
  // SUJETS : on découpe sujet par sujet, puis on compte dans CHAQUE tranche.
  // 🔴 ON NE COMPTE PAS SUR TOUT LE BLOC : un `figures: [...]` global attraperait
  //    les cinq listes d'un coup et rendrait un total qui ne concerne personne.
  const reel = {};
  const tranches = [...blocSujets[1].matchAll(/^ {2}([a-z_]+):\s*\{([\s\S]*?)\n {2}\},/gm)];
  for (const tr of tranches) {
    const corps = tr[2];
    const figs = corps.match(/figures:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
    const leds = corps.match(/led:\s*\[([\s\S]*?)\]/)?.[1] ?? '';
    reel[tr[1]] = {
      fig: (figs.match(/'[^']+'/g) || []).length,
      mod: (leds.match(/\bid:/g) || []).length,
      rang: /amplitude:\s*true/.test(corps),
    };
  }

  dit(Object.keys(annonce).length >= 4 && Object.keys(reel).length >= 4,
      'les deux blocs ont rendu leurs quatre sujets',
      `annoncés: ${Object.keys(annonce).length} · lus: ${Object.keys(reel).length}`);

  // ⭐ LE TOTAL NE PEUT PAS ÊTRE NUL. Deux expressions régulières qui ne
  //    trouvent rien rendent partout 0 = 0, et le banc passerait au vert en
  //    n'ayant rien mesuré. C'est le faux vert que le § 4 décrit déjà.
  const totalReel = Object.values(reel).reduce((a, x) => a + x.fig + x.mod, 0);
  dit(totalReel > 0, 'le banc a bien compté quelque chose dans les sujets',
      `${totalReel} figure(s)+module(s) lus — 0 voudrait dire que le compteur est aveugle`);

  for (const s of SUJETS) {
    const a = annonce[s]; const r = reel[s];
    if (!a || !r) { dit(false, `${s} : présent des deux côtés`, `annoncé: ${!!a} · lu: ${!!r}`); continue; }
    dit(a.fig === r.fig && a.mod === r.mod && a.rang === r.rang,
        `${s} : la porte annonce ce que le sujet contient`,
        `annoncé fig ${a.fig}/mod ${a.mod}/rang ${a.rang} — réel fig ${r.fig}/mod ${r.mod}/rang ${r.rang}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. `.module__c` A-T-ELLE ENCORE DEUX RÔLES ? (lot 165)
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE § GARDE UN DÉFAUT QUI A ATTEINT LA PRODUCTION. `.module__c` était
// écrite dans `themes/vitrine/theme.css` pour le CHEVRON de droite
// (`margin-left:auto`, `flex:0 0 auto`) et utilisée par CINQ émetteurs sur six
// comme CONTENEUR de texte. Résultat vu par Preda le 19/08 : sur `/analytics/`
// les quatre cartes rendaient leur contenu sur une seule ligne qui débordait
// de sa case et recouvrait les voisines.
// ⭐ CE QU'IL SURVEILLE N'EST PAS « la mise en page est jolie » — indécidable
//    hors d'un navigateur — mais les DEUX PROPRIÉTÉS MÉCANIQUES sans lesquelles
//    le débordement revient : le conteneur doit s'empiler (`column`) et
//    pouvoir rétrécir (`min-width:0`).
console.log('\n7. `.module__c` a-t-elle un seul rôle ?');

const FEUILLE = join(RACINE, 'themes', 'vitrine', 'theme.css');
if (!existsSync(FEUILLE)) {
  indecidable('la feuille vitrine est lisible', `${FEUILLE} absent — ce site n'a pas ce thème`);
} else {
  const css = lire(FEUILLE);
  // ⛔ ON VISE LA RÈGLE, PAS LE NOM. Un `grep '.module__c'` trouve aussi le
  //    commentaire qui la décrit — et un commentaire ne met rien en colonne.
  const regle = css.match(/^\.module__c\{([^}]*)\}/m)?.[1] ?? null;
  dit(regle !== null, 'la règle `.module__c` a été trouvée dans la feuille',
      regle === null ? 'accroche perdue — le banc ne conclut pas' : '');
  if (regle !== null) {
    dit(/flex-direction:\s*column/.test(regle), '`.module__c` empile ses enfants',
        `lu : ${regle}`);
    dit(/min-width:\s*0/.test(regle), '`.module__c` peut rétrécir sous son contenu',
        'sans `min-width:0` un enfant flex refuse de passer sous sa largeur minimale — le débordement revient');
    dit(!/margin-left:\s*auto/.test(regle), '`.module__c` n\'a pas repris le rôle du chevron',
        `lu : ${regle}`);
  }
  const regleX = css.match(/^\.module__x\{([^}]*)\}/m)?.[1] ?? null;
  dit(regleX !== null && /margin-left:\s*auto/.test(regleX), '`.module__x` porte le rôle du chevron',
      regleX === null ? '`.module__x` absente de la feuille' : `lu : ${regleX}`);

  // ⭐⭐ UNE RÈGLE SANS ÉMETTEUR NE LÈVE RIEN ET NE SE VOIT PAS — c'est la
  //    « règle sans émetteur » que ce dépôt traque depuis le lot 134. Si plus
  //    personne n'écrit `.module__x`, la règle doit partir avec lui.
  const composants = join(SRC, 'components');
  const tousFichiers = (d) => readdirSync(d, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? tousFichiers(join(d, e.name)) : [join(d, e.name)]));
  const astros = existsSync(composants) ? tousFichiers(composants).filter((f) => f.endsWith('.astro')) : [];
  const emetteursX = astros.filter((f) => /class="module__x"/.test(lire(f)));
  dit(emetteursX.length > 0, '`.module__x` a au moins un émetteur',
      emetteursX.length ? emetteursX.map((f) => f.split(/[\\/]/).pop()).join(', ')
                        : 'aucun — la règle du chevron ne peut plus rien habiller');

  // 🔴 LE DÉFAUT D'ORIGINE, DANS SA FORME EXACTE : un émetteur qui REPOSE à la
  //    main les propriétés du chevron sur `.module__c`. C'est le style en ligne
  //    de `Dashboard.astro` l. 240 qui a permis de trancher — s'il revient,
  //    c'est que quelqu'un a de nouveau confondu les deux rôles.
  const recidive = astros.filter((f) => {
    const src = lire(f);
    return [...src.matchAll(/class="module__c"[^>]*style="([^"]*)"/g)]
      .some((m) => /margin-left:\s*auto|flex:\s*0 0 auto/.test(m[1]));
  });
  dit(recidive.length === 0, 'aucun émetteur ne repose le rôle du chevron sur `.module__c`',
      recidive.length ? recidive.map((f) => f.split(/[\\/]/).pop()).join(', ')
                      : `${astros.length} composant(s) relus`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${ko === 0 ? '✅' : '❌'} ${ko} écart(s)`
  + (indecidables ? ` · ⏸️ ${indecidables} indécidable(s) — ce banc veut un build`  : ''));
// ⛔ UN INDÉCIDABLE NE FAIT PAS ÉCHOUER, ET IL NE FAIT PAS SEMBLANT DE PASSER.
//    Il est compté, nommé, et affiché dans la ligne finale. C'est la seule
//    forme qui ne se lit pas comme un succès.
process.exit(ko === 0 ? 0 : 1);
