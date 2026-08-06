// ⚠️ VeVePreda/veve-sites — engine/tools/test_session.mjs  (FICHIER NEUF, lot 90)
//
//     npm run test:session
//
// ═══════════════════════════════════════════════════════════════════════════
// LE TROU QU'IL FERME — et personne ne l'avait vu pendant quatre lots.
// ═══════════════════════════════════════════════════════════════════════════
// Le middleware LIT `vp_session` depuis le lot 42. `api/deconnexion.js`
// l'EFFACE depuis le lot 42. Entre les deux, PERSONNE NE LE POSAIT.
//
// Mesuré le 06/08/2026 : `grep -rn vp_session` sur tout le depot rendait
// exactement trois lignes — une lecture, un effacement, un test. Aucune pose.
// L'espace membre n'etait donc pas « a adapter » : il n'avait aucune entree.
//
// ⭐⭐ ET AUCUN DES 21 BANCS NE POUVAIT LE DIRE. Ils verifient que ce qui
//   existe est correct ; aucun ne demandait « ou est l'autre bout ? ». Un
//   cookie lu et efface mais jamais pose est un circuit ouvert : chaque
//   morceau est juste, l'ensemble ne fait rien.
// ⭐⭐⭐ UN CONTROLE QUI NE REGARDE QUE CE QUI EXISTE NE VOIT JAMAIS CE QUI
//   MANQUE. Celui-ci compte les DEUX BOUTS.
//
// ⛔ IL NE FAIT AUCUN APPEL RESEAU. Il lit les sources. Un banc qui exigerait
//    veveid en marche ne tournerait pas en CI, donc ne tournerait pas.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let echecs = 0;
const dit = (ok, quoi, detail = '') => {
  if (!ok) echecs++;
  console.log(`  ${ok ? '✅' : '❌'} ${quoi}${detail ? ` — ${detail}` : ''}`);
};

function fichiers(dossier, out = []) {
  for (const n of readdirSync(dossier)) {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) fichiers(p, out);
    else if (/\.(astro|js|mjs|ts)$/.test(n)) out.push(p);
  }
  return out;
}

const sources = [...fichiers(join(RACINE, 'src')), ...fichiers(join(RACINE, 'engine', 'lib'))];
const lire = (p) => readFileSync(p, 'utf-8');
const relatif = (p) => relative(RACINE, p).replace(/\\/g, '/');

console.log('\nLa session de bout en bout — les DEUX bouts du circuit\n');

// ── 1. LE CIRCUIT EST-IL FERMÉ ? ───────────────────────────────────────────
console.log('1. Le cookie de session a-t-il un POSEUR, un LECTEUR et un EFFACEUR ?');
const pose = [], lit = [], efface = [];
for (const f of sources) {
  const s = lire(f);
  if (!s.includes('vp_session')) continue;
  if (/cookies\.set\(\s*['"]vp_session['"]/.test(s)) pose.push(relatif(f));
  if (/cookies\.get\(\s*['"]?vp_session|COOKIE\s*=\s*['"]vp_session/.test(s)) lit.push(relatif(f));
  if (/cookies\.delete\(\s*['"]vp_session['"]/.test(s)) efface.push(relatif(f));
}
dit(pose.length > 0, 'quelqu’un POSE vp_session', pose.join(', ') || 'PERSONNE — le circuit est ouvert, aucune session ne peut naître');
dit(lit.length > 0, 'quelqu’un LIT vp_session', lit.join(', ') || 'personne');
dit(efface.length > 0, 'quelqu’un EFFACE vp_session', efface.join(', ') || 'personne');

// ── 2. LES ATTRIBUTS ───────────────────────────────────────────────────────
console.log('\n2. La pose et l’effacement décrivent-ils LE MÊME cookie ?');
// ⚠️ Un cookie posé `path:'/'` et effacé avec un autre chemin n'est pas
// effacé : le navigateur y voit deux cookies. C'est la raison n°1 des
// « déconnexions qui ne déconnectent pas », et elle est invisible en relisant
// un seul des deux fichiers.
// ⭐⭐ CE LECTEUR RÉSOUT LES CONSTANTES, ET C'EST UN CHOIX.
// Sa première version lisait l'objet littéral et rien d'autre. Elle a donc
// déclaré en échec un `cookies.set('vp_session', sid, { ...ATTRIBUTS, maxAge })`
// — c'est-à-dire la BONNE façon d'écrire, celle qui garantit précisément ce
// que le contrôle veut vérifier.
// ⛔ La réparation tentante était d'aller recopier les quatre attributs en
//    clair dans le fichier pour faire plaisir au banc. Un contrôle qui pousse
//    à dupliquer ce qu'il vérifie travaille contre lui-même.
// ⭐ On corrige l'INSTRUMENT. Un banc doit savoir lire ce qu'il regarde.
const attributs = (s, verbe) => {
  const m = s.match(new RegExp(`cookies\\.${verbe}\\([^)]*?\\{([^}]*)\\}`, 's'));
  if (!m) return null;
  let corps = m[1];
  // `{ ...ATTRIBUTS, maxAge: … }` → on remplace le spread par la constante.
  for (const nom of [...corps.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)].map((x) => x[1])) {
    const def = s.match(new RegExp(`const\\s+${nom}\\s*=\\s*\\{([^}]*)\\}`, 's'));
    corps = corps.replace(new RegExp(`\\.\\.\\.\\s*${nom}`), def ? def[1] : '');
  }
  return ['path', 'sameSite', 'secure', 'httpOnly']
    .map((a) => {
      const v = corps.match(new RegExp(`${a}\\s*:\\s*([^,\\n]+)`));
      return `${a}=${v ? v[1].trim().replace(/['"]/g, '') : '?'}`;
    }).join(' ');
};
const aPose = pose.length ? attributs(lire(join(RACINE, pose[0])), 'set') : null;
const aEfface = efface.length ? attributs(lire(join(RACINE, efface[0])), 'delete') : null;
dit(!!aPose && !!aEfface && aPose === aEfface,
  'mêmes path / sameSite / secure / httpOnly des deux côtés',
  aPose === aEfface ? aPose : `pose « ${aPose} » ≠ effacement « ${aEfface} »`);
dit(!!aPose && aPose.includes('httpOnly=true'), 'le cookie est httpOnly', 'sinon un script de page peut le lire');
dit(!!aPose && aPose.includes('secure=true'), 'le cookie est secure', 'sinon il part en clair sur une requête http');

// ── 3. LA ROUTE D'ENTRÉE EST-ELLE RENDUE À LA DEMANDE ? ────────────────────
console.log('\n3. Les routes de session sont-elles rendues à la demande ?');
// ⚠️ Pré-générée, `api/entrer.js` deviendrait un fichier figé : incapable de
// lire `?code=`, incapable de poser un cookie. Le symptôme serait « le lien du
// courriel ne connecte pas », et on chercherait du côté de veveid.
const routes = lire(join(RACINE, 'engine', 'lib', 'astro_routes_compte.mjs'));
for (const r of ['pages/api/entrer.js', 'pages/api/inscription.js', 'pages/api/deconnexion.js'])
  dit(routes.includes(`'${r}'`), `${r} est déclarée dans ROUTES_COMPTE`,
    routes.includes(`'${r}'`) ? '' : 'elle serait PRÉ-GÉNÉRÉE en silence');

// ── 4. LA ROUTE QUI N'A JAMAIS EXISTÉ ──────────────────────────────────────
console.log('\n4. Plus aucun appel à une route absente de veveid');
// `/oauth/start` était construit par `/connexion/` et n'existe pas dans le
// server.ts de veveid. Ce n'était pas une route oubliée : c'était une méprise
// sur la nature du service.
const oauthActif = sources.filter((f) => {
  const s = lire(f);
  // On ignore les lignes de COMMENTAIRE : le dépôt a le droit de raconter
  // pourquoi cette route n'existe pas. On ne cherche que du code vivant.
  return s.split('\n').some((l) => l.includes('oauth/start') && !/^\s*(\/\/|\*|\/\*|#)/.test(l));
}).map(relatif);
dit(oauthActif.length === 0, 'aucun code n’appelle /oauth/start', oauthActif.join(', ') || 'seulement des commentaires');

// ── 5. LES DEUX VARIABLES VONT ENSEMBLE ────────────────────────────────────
console.log('\n5. INSCRIPTION_API n’ouvre pas seule');
// Avec INSCRIPTION_API sans SESSION_API : la personne s'inscrit, reçoit son
// courriel, clique — et rien ne peut échanger le code. Un lien à usage unique
// brûlé pour rien, c'est-à-dire une inscription perdue.
for (const f of ['src/pages/api/inscription.js', 'src/pages/inscription/index.astro']) {
  const s = lire(join(RACINE, f));
  dit(s.includes('SESSION_API'), `${f} exige aussi SESSION_API`,
    s.includes('SESSION_API') ? '' : 'il ouvrirait l’inscription sans pouvoir la terminer');
}

// ── 6. AUTO-CONTRÔLE ───────────────────────────────────────────────────────
console.log('\n6. Auto-contrôle — ce banc a-t-il quelque chose à inspecter ?');
// ⭐ Un verdict rendu sur zéro élément n'a rien prouvé. Si `sources` était
// vide (chemin changé, dossier renommé), tout ce qui précède serait vert.
dit(sources.length > 20, 'des sources ont bien été lues', `${sources.length} fichiers`);
dit(sources.some((f) => lire(f).includes('vp_session')),
  'le nom du cookie est bien celui qu’on croit', 'sinon on cherchait une chaîne qui n’existe plus');

console.log(echecs === 0
  ? `\n✅ session : tout est vert (le circuit est fermé)\n`
  : `\n❌ session : ${echecs} contrôle(s) en échec\n`);
process.exit(echecs === 0 ? 0 : 1);
