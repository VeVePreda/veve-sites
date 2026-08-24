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
// ⚠️ LOT 97 — LE LECTEUR VISE MAINTENANT UN COOKIE PRÉCIS. Sa v1 prenait le
// PREMIER `cookies.set(…)` du fichier. Tant qu'il n'y en avait qu'un, elle
// avait raison ; le jour où `api/entrer.js` en pose deux, elle aurait comparé
// les attributs de `vp_session` à ceux de `vp_membre` et déclaré un écart
// parfaitement imaginaire — ou pire, l'inverse : deux cookies mal appariés
// jugés identiques. ⭐ Un banc qui lit « le premier » lit en réalité « celui
// qu'il y avait quand je l'ai écrit ».
// ⚠️ LOT 98 — TROISIÈME RÉPARATION DE CE LECTEUR, ET LA MÊME LEÇON.
// `api/supprimer.js` écrit `cookies.delete('vp_session', SESSION)` : les
// attributs sont une CONSTANTE NUE, sans accolades. Le lecteur rendait `null`,
// et déclarait en échec la façon la plus sûre d'écrire — celle qui garantit
// justement que la pose et l'effacement décrivent le même cookie.
// ⭐⭐ UN BANC QUI POUSSE À RECOPIER CE QU'IL VÉRIFIE TRAVAILLE CONTRE
//   LUI-MÊME. On corrige l'instrument, jamais le code, pour lui faire plaisir.
const attributs = (s, verbe, nom) => {
  const m = s.match(new RegExp(`cookies\\.${verbe}\\(\\s*['"]${nom}['"][^)]*?\\{([^}]*)\\}`, 's'));
  let corps;
  if (m) corps = m[1];
  else {
    // `cookies.delete('vp_session', SESSION)` → on résout la constante.
    const n = s.match(new RegExp(`cookies\\.${verbe}\\(\\s*['"]${nom}['"]\\s*,\\s*([A-Za-z_$][\\w$]*)\\s*\\)`));
    if (!n) return null;
    const def = s.match(new RegExp(`const\\s+${n[1]}\\s*=\\s*\\{([^}]*)\\}`, 's'));
    if (!def) return null;
    corps = def[1];
  }
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
const aPose = pose.length ? attributs(lire(join(RACINE, pose[0])), 'set', 'vp_session') : null;
const aEfface = efface.length ? attributs(lire(join(RACINE, efface[0])), 'delete', 'vp_session') : null;
dit(!!aPose && !!aEfface && aPose === aEfface,
  'mêmes path / sameSite / secure / httpOnly des deux côtés',
  aPose === aEfface ? aPose : `pose « ${aPose} » ≠ effacement « ${aEfface} »`);
dit(!!aPose && aPose.includes('httpOnly=true'), 'le cookie est httpOnly', 'sinon un script de page peut le lire');
dit(!!aPose && aPose.includes('secure=true'), 'le cookie est secure', 'sinon il part en clair sur une requête http');

// ═══════════════════════════════════════════════════════════════════════════
// 🍪 2 bis. LE COOKIE D'AFFICHAGE — lot 97
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ MÊME QUESTION QU'AU §1, POSÉE À UN COOKIE NEUF : QUI ÉCRIT, QUI LIT ?
// `vp_session` a vécu quatre lots lu et effacé sans que personne ne le pose,
// avec 21 bancs verts. On ne recommence pas : le contrôle est écrit EN MÊME
// TEMPS que le cookie, pas quatre lots plus tard.
console.log('\n2 bis. Le cookie d’AFFICHAGE vp_membre a-t-il ses trois bouts ?');
const poseM = [], litM = [], effaceM = [];
for (const f of sources) {
  const src = lire(f);
  if (!src.includes('vp_membre')) continue;
  if (/cookies\.set\(\s*['"]vp_membre['"]/.test(src)) poseM.push(relatif(f));
  if (/cookies\.delete\(\s*['"]vp_membre['"]/.test(src)) effaceM.push(relatif(f));
  // ⚠️ CELUI-CI SE LIT EN JAVASCRIPT DE PAGE, pas par `cookies.get()` : c'est
  // sa raison d'être. On cherche donc le lecteur là où il est — dans le
  // gabarit — sinon le banc conclurait « personne ne lit » sur un dispositif
  // qui fonctionne, et on retirerait un cookie utile.
  if (/document\.cookie/.test(src) && /vp_membre/.test(src)) litM.push(relatif(f));
}
dit(poseM.length > 0, 'quelqu’un POSE vp_membre', poseM.join(', ') || 'PERSONNE — le bouton ne changera jamais');
dit(litM.length > 0, 'quelqu’un LIT vp_membre (script de page)', litM.join(', ') || 'personne — le cookie serait posé pour rien');
dit(effaceM.length > 0, 'quelqu’un EFFACE vp_membre', effaceM.join(', ')
  || 'personne — « Mon compte » resterait affiché après une déconnexion');

const mPose = poseM.length ? attributs(lire(join(RACINE, poseM[0])), 'set', 'vp_membre') : null;
const mEfface = effaceM.length ? attributs(lire(join(RACINE, effaceM[0])), 'delete', 'vp_membre') : null;
dit(!!mPose && !!mEfface && mPose === mEfface,
  'vp_membre : mêmes attributs à la pose et à l’effacement',
  mPose === mEfface ? mPose : `pose « ${mPose} » ≠ effacement « ${mEfface} »`);
// ⭐ CELUI-CI DOIT ÊTRE LISIBLE PAR UN SCRIPT — c'est l'inverse exact de
// l'attente sur `vp_session`, et c'est pourquoi il est écrit noir sur blanc.
// Un `httpOnly: true` recopié par mimétisme rendrait le dispositif inerte :
// le cookie serait parfaitement posé et parfaitement invisible.
dit(!!mPose && mPose.includes('httpOnly=false'), 'vp_membre est LISIBLE par le script (httpOnly=false)',
  'un cookie d’affichage httpOnly est un cookie que personne ne peut afficher');
dit(!!mPose && mPose.includes('secure=true'), 'vp_membre est secure');

// 🔴🔴 LA GARANTIE QUI REND LE DISPOSITIF ACCEPTABLE : IL N'ACCORDE RIEN.
// Ce cookie est falsifiable depuis la console du navigateur. Tant qu'il ne
// décide que d'un libellé, c'est sans conséquence. Le jour où un `franchit()`,
// un `palier`, un `Gate` ou une route d'API le regarderait, il faudrait le
// SIGNER — et ce banc doit crier AVANT que la ligne parte en production.
const cotePalier = sources.filter((f) => {
  const src = lire(f);
  if (!src.includes('vp_membre')) return false;
  return /vp_membre/.test(src) && /(franchit|palierVisiteur|locals\.palier|porte\()/.test(src);
}).map(relatif);
dit(cotePalier.length === 0, 'vp_membre n’approche AUCUNE décision de droit',
  cotePalier.join(', ') || 'il ne décide que d’un libellé — c’est ce qui permet qu’il soit falsifiable');
// ⛔ Et il ne porte que « 1 » : ni palier, ni identifiant, ni date. Une valeur
// riche appelle une lecture, une lecture appelle une décision.
const posé = poseM.length ? lire(join(RACINE, poseM[0])) : '';
dit(/cookies\.set\(\s*['"]vp_membre['"]\s*,\s*'1'/.test(posé), 'vp_membre ne porte que « 1 »',
  'toute autre valeur serait une donnée exposée en clair, modifiable par son porteur');

// ── 3. LA ROUTE D'ENTRÉE EST-ELLE RENDUE À LA DEMANDE ? ────────────────────
console.log('\n3. Les routes de session sont-elles rendues à la demande ?');
// ⚠️ Pré-générée, `api/entrer.js` deviendrait un fichier figé : incapable de
// lire `?code=`, incapable de poser un cookie. Le symptôme serait « le lien du
// courriel ne connecte pas », et on chercherait du côté de veveid.
const routes = lire(join(RACINE, 'engine', 'lib', 'astro_routes_compte.mjs'));
for (const r of ['pages/acces/index.astro', 'pages/connexion/index.astro', 'pages/api/entrer.js', 'pages/api/inscription.js', 'pages/api/deconnexion.js'])
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
// 🔴 LOT 177/178 — `src/pages/connexion/index.astro` PORTE L'ÉCRAN UNIQUE,
// qui n'est plus qu'une redirection. Laisser l'ancien chemin ici aurait gardé
// le banc VERT sur un fichier de 30 lignes qui ne porte plus le formulaire :
// le contrôle aurait survécu à son sujet.
for (const f of ['src/pages/api/inscription.js', 'src/pages/connexion/index.astro']) {
  const s = lire(join(RACINE, f));
  dit(s.includes('SESSION_API'), `${f} exige aussi SESSION_API`,
    s.includes('SESSION_API') ? '' : 'il ouvrirait l’inscription sans pouvoir la terminer');
}

// ── 7. LE PROXY ET LE CONTRÔLE D'ORIGINE — deux fichiers, une seule vérité ─
console.log('\n7. nginx parle http à Node : Astro doit le savoir');
/**
 * 🔴🔴 LA PANNE DU 06/08, ET ELLE N'EXISTAIT QU'EN PRODUCTION.
 *
 * Astro refuse un POST de formulaire dont l'`Origin` diffère de `url.origin`
 * (`core/app/origin-check.js`). Le navigateur envoie `https://veveprice.com` ;
 * nginx fait `proxy_pass http://127.0.0.1:4321`, et l'adaptateur reconstruit
 * l'URL depuis le protocole de la CONNEXION — donc `http://…`. Deux origines
 * identiques au schéma près : 403 « Cross-site POST form submissions are
 * forbidden », page blanche au clic sur « créer mon compte ».
 *
 * ⭐⭐ nginx transmettait DÉJÀ `X-Forwarded-Proto`. Astro le JETTE tant que
 *    `security.allowedDomains` est vide — sans un mot dans le journal.
 * ⛔ Le correctif n'est PAS `checkOrigin: false` : on ne retire pas le
 *    garde-fou, on lui donne l'origine de référence qui lui manquait.
 *
 * ⭐⭐⭐ MÊME FAMILLE QUE LE 404 DE `/compte/` : Astro décide, nginx sert, et
 *    les deux moitiés vivent dans deux fichiers. Ce contrôle-ci les tient
 *    ensemble — c'est la seule façon qu'aucune des deux ne dérive seule.
 */
const conf = lire(join(RACINE, 'astro.config.mjs'));
const nginxServeur = lire(join(RACINE, 'nginx.server.conf'));
const enHttp = /proxy_pass\s+http:\/\/127\.0\.0\.1/.test(nginxServeur);
const transmetProto = /proxy_set_header\s+X-Forwarded-Proto/i.test(nginxServeur);
dit(enHttp, 'nginx parle bien http à Node (c’est la cause du décalage)', enHttp ? '' : 'proxy_pass introuvable — ce contrôle ne mesure plus rien');
dit(transmetProto, 'nginx transmet X-Forwarded-Proto', transmetProto ? '' : 'sans lui, Astro ne PEUT pas connaître le vrai schéma');
/**
 * 🔴🔴 LE CONTRÔLE QUI MANQUAIT AU LOT 91, ET QUI A COÛTÉ UN LOT DE PLUS.
 *
 * `proxy_set_header X-Forwarded-Proto $scheme` a l'air correct — c'est même la
 * ligne qu'on trouve dans tous les exemples. Mais `$scheme` décrit la connexion
 * CLOUDFLARE → NGINX. Ce serveur n'écoute qu'en `listen 80` : `$scheme` vaut
 * donc toujours `http`, et cette ligne ÉCRASE par `http` le `https` que
 * Cloudflare venait d'envoyer.
 *
 * ⭐⭐ Le banc du lot 91 vérifiait que l'en-tête était TRANSMIS. Il ne
 *    vérifiait pas AVEC QUOI. « Est-ce là ? » et « qu'est-ce que ça vaut ? »
 *    sont deux questions — la même leçon que le CSS, dans une autre couche.
 */
const ecoutePas443 = !/listen\s+443/.test(nginxServeur);
const ecraseAvecScheme = /X-Forwarded-Proto\s+\$scheme\s*;/.test(nginxServeur);
dit(!(ecoutePas443 && ecraseAvecScheme),
  'X-Forwarded-Proto ne vaut pas $scheme sur un serveur qui n’écoute qu’en 80',
  ecoutePas443 && ecraseAvecScheme
    ? '$scheme vaut TOUJOURS http ici — il écrase le https envoyé par le proxy amont ⇒ 403 sur tout POST de formulaire'
    : '');
dit(/map\s+\$http_x_forwarded_proto/.test(nginxServeur),
  'une map propage le protocole du visiteur, avec repli sur $scheme',
  'sans elle, le protocole du dernier saut remplace celui du visiteur');
dit(/security\s*:\s*\{[\s\S]{0,400}allowedDomains/.test(conf),
  'astro.config.mjs déclare security.allowedDomains',
  'sans lui, X-Forwarded-Proto est jeté ⇒ 403 sur TOUT POST de formulaire, en production seulement');
/**
 * ⚠️ ON NE CHERCHE QUE DU CODE VIVANT — piège payé deux fois dans ce même
 *    fichier. La v1 lisait le fichier entier, or `astro.config.mjs` EXPLIQUE
 *    en commentaire pourquoi `checkOrigin: false` serait la mauvaise réponse.
 *    Le banc accusait donc le texte qui le lui interdisait.
 * ⭐⭐ Un dépôt a le droit de NOMMER ce qu'il refuse de faire. Un contrôle qui
 *    lit les commentaires transforme chaque avertissement en infraction — et
 *    pousse à effacer les explications pour passer au vert.
 */
const codeVivant = (src) => src.split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*|#)/.test(l)).join('\n');
dit(!/checkOrigin\s*:\s*false/.test(codeVivant(conf)),
  'la protection CSRF n’a PAS été désactivée',
  '⛔ checkOrigin:false ferait passer le formulaire en retirant le garde-fou');
dit(/siteUrl\(\)/.test(conf),
  'le domaine autorisé est DÉRIVÉ du manifeste',
  'un domaine en dur casserait les autres sites du moteur — en silence, et en production seulement');

// ── 8. LE SECRET PARTAGÉ N'A QU'UNE VALEUR, ET DEUX NOMS ───────────────────
console.log('\n8. Le secret de service se lit sous ses deux noms');
/**
 * 🔴 `veveid` lit `ID_SERVICE`. Ce dépôt lisait `VEVEID_SERVICE`. Même valeur,
 *    deux noms, et rien ne le disait : recopier la variable sous son nom
 *    d'origine — le geste évident — laissait l'en-tête `x-service` vide,
 *    veveid répondait 401, et la page disait « nous n'avons pas pu envoyer le
 *    lien ». Une heure pour une lettre de différence.
 * ⭐⭐⭐ UN SECRET PARTAGÉ QUI PORTE DEUX NOMS SELON LE CÔTÉ EST UNE ERREUR DE
 *   RECOPIE EN ATTENTE.
 */
for (const f of ['src/pages/api/entrer.js', 'src/pages/api/inscription.js',
                 'src/pages/api/deconnexion.js', 'src/pages/api/sante.js']) {
  const src = lire(join(RACINE, f));
  const tolere = /VEVEID_SERVICE\s*\|\|\s*process\.env\.ID_SERVICE/.test(src)
    || /secretDeService\(\)/.test(src);
  dit(tolere, `${f} accepte les deux noms du secret`,
    tolere ? '' : 'une recopie sous le nom de veveid (ID_SERVICE) resterait sans effet');
}

// ── 9. LES GARDE-FOUS ANTI-ROBOTS ──────────────────────────────────────────
console.log('\n9. Le formulaire d’inscription se défend');
/**
 * 🔴 LE DANGER N'EST PAS « des robots créent des comptes » — un compte naît à
 *    la CONSOMMATION du lien. C'est le QUOTA D'ENVOI (300/jour) et le
 *    BOMBARDEMENT D'UN TIERS (qui coûte la réputation du domaine).
 */
// 🔴 LOT 177 — UN SEUL FORMULAIRE À DÉFENDRE, PARCE QU'IL N'EN RESTE QU'UN.
// ⛔ Garder les deux anciens chemins ici aurait exigé un champ piège de deux
// redirections de 30 lignes : le banc aurait rougi sur des fichiers qui ne
// peuvent plus rien envoyer. C'est le contraire d'un contrôle.
for (const f of ['src/pages/connexion/index.astro']) {
  const src = lire(join(RACINE, f));
  dit(/champPiegeHtml\(\)/.test(src) && /name="sceau"/.test(src),
    `${f} porte le champ piège et le sceau`,
    'un formulaire sans garde-fou laisse brûler le quota d’envoi en minutes');
}
const insc = lire(join(RACINE, 'src/pages/api/inscription.js'));
dit(/verdict\(piege, sceau\)/.test(insc), 'la route juge le piège et le sceau AVANT de relayer');
dit(/x-client-ip/.test(insc), 'la route transmet l’adresse du visiteur',
  'sans elle, le limiteur de veveid est un seau partagé par le monde entier — 5 inscriptions / 10 min pour tous');
/**
 * ⛔ CE CONTRÔLE EXISTE PARCE QUE J'AI FAIT L'ERREUR. Ma v1 retransmettait le
 *    sceau à veveid pour qu'il le revérifie — avec un secret différent de
 *    chaque côté. Résultat mesuré : 100 % des inscriptions écartées pour
 *    « sceau invalide ». Une protection qui bloque tout le monde n'est pas
 *    stricte, elle est cassée.
 * ⭐⭐⭐ UN SCEAU NE SE VÉRIFIE QUE PAR CELUI QUI L'A ÉMIS.
 */
dit(!/piege,\s*sceau,/.test(insc), 'le sceau ne voyage PAS vers veveid',
  'un sceau vérifié par qui ne l’a pas émis suppose un second secret partagé, que personne n’a posé');
const rb = lire(join(RACINE, 'engine/lib/robots.mjs'));
dit(/timingSafeEqual/.test(rb), 'le sceau est comparé à durée constante');
dit(/DELAI_MAX_MS/.test(rb), 'le sceau EXPIRE',
  'un sceau éternel se récolte une fois et se rejoue mille fois');

// ── 10. IL N'Y A PAS DE PAGE COMPTE PUBLIQUE (lot 97) ──────────────────────
console.log('\n10. /compte/ se ferme à qui n’a pas de session');
const cpt = lire(join(RACINE, 'src/pages/compte/index.astro'));
const mw = lire(join(RACINE, 'src/middleware.js'));

// 🔬🔴 LOT 161 — LES COMMENTAIRES SONT RETIRES AVANT TOUTE RECHERCHE DE CHAINE.
// C'est la QUATRIEME fois dans ce depot qu'un banc trouve ce qu'il cherche dans
// un commentaire. Je viens de l'y remettre moi-meme : en retirant `enDemo` du
// gabarit, j'ai ecrit `enDemo` dans le commentaire qui explique le retrait — et
// le controle « le mot a disparu » serait rouge sur sa propre note de bas de
// page. ⭐⭐⭐ UN BANC QUI LIT DU CODE DOIT LIRE LE CODE, PAS SA DOCUMENTATION.
// ⚠️ Les chaines de caracteres, elles, RESTENT : elles sont servies au visiteur.
const sansCommentaires = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')      // /* … */  (et {/* … */} d'Astro)
  .replace(/^\s*\/\/.*$/gm, ' ');          // // … en debut de ligne
const cptCode = sansCommentaires(cpt);
// ⭐⭐ « QUI ÉCRIT, QUI LIT ? » — appliqué au drapeau de rendu. La page décide
// de se fermer d'après `locals.rendu` ; si personne ne le POSE, la condition
// est éternellement fausse et la page reste ouverte. Vert des deux côtés,
// inerte au milieu : exactement la panne de `vp_session`.
dit(/locals\.rendu\s*=\s*'demande'/.test(mw), 'le middleware POSE locals.rendu',
  'sans lui, la fermeture de /compte/ ne se déclenche jamais');
dit(/locals\?\.rendu === 'demande'/.test(cpt), '/compte/ LIT locals.rendu');
dit(/Astro\.redirect\('\/connexion\/'/.test(cpt), '/compte/ redirige l’anonyme vers /connexion/',
  'une page de compte servie à quelqu’un sans session est une page publique');
// 🗑️ LOT 161 — ce contrôle exigeait `!connecte && !enDemo` : le jeton de
// démonstration devait garder son accès à `/compte/`, sinon la démo s'enfermait
// (le bouton pour en sortir vivait sur cette page). Le mécanisme est retiré.
// ⭐⭐ LE CONTRÔLE N'EST PAS SUPPRIMÉ, IL EST RETOURNÉ : on exigeait une
// dérogation, on exige maintenant qu'il n'y en ait AUCUNE. Supprimer la ligne
// aurait laissé `/compte/` sans banc sur sa condition de fermeture — et une
// dérogation qui reviendrait un jour ne serait dite par personne.
dit(/if \(aLaDemande && !connecte\) return Astro\.redirect/.test(cptCode),
  '/compte/ se ferme SANS aucune dérogation',
  'la condition a changé de forme, ou une exception y est revenue');
dit(!/enDemo/.test(cptCode), '/compte/ ne porte plus aucune trace de la démonstration',
  '`enDemo` est encore DANS LE CODE du gabarit (les commentaires sont écartés)');
dit(/\{reglagesIci && connecte &&/.test(cpt), 'les réglages sont réservés aux membres (Preda, 06/08)');
// 🔴 LOT 103 — CE CONTRÔLE EXIGEAIT UN ORDRE D'ATTRIBUTS, PAS UN FAIT.
// Il testait `/<Base noindex/` : ajouter `sect="general"` devant — ce que fait
// le lot 103 pour aligner cette page sur les autres — le faisait rougir sur une
// page toujours parfaitement en noindex.
// ⭐⭐⭐ TROISIÈME FOIS AUJOURD'HUI QU'UN BANC MESURE LA FORME AU LIEU DU FAIT
// (après le compteur de balises qui lisait les commentaires, et `test:session`
// lui-même qui rougissait sur un commentaire). ⛔ On corrige l'INSTRUMENT.
// ⭐ On cherche l'attribut DANS la balise ouvrante, où qu'il soit — c'est la
// question qu'on voulait poser depuis le début : « cette page est-elle en
// noindex ? », et non « est-il écrit en deuxième position ? ».
const baliseBase = (cpt.match(/<Base\b[^>]*>/s) || [''])[0];
dit(/\bnoindex\b/.test(baliseBase), '/compte/ est en noindex',
  baliseBase ? `balise lue : ${baliseBase.slice(0, 70)}…` : 'aucune balise <Base> trouvée');
// ⚠️ Le drapeau est posé APRÈS la sortie sur `isPrerendered`, et cet ordre EST
// le contrôle : posé avant, il vaudrait « demande » sur les 8 500 fichiers, et
// /compte/ deviendrait une redirection figée dans le build — pour tout le
// monde, abonnés compris.
const iPre = mw.indexOf('isPrerendered) return next()');
const iFlag = mw.indexOf("locals.rendu = 'demande'");
dit(iPre >= 0 && iFlag > iPre, 'le drapeau est posé APRÈS la sortie sur isPrerendered',
  'posé avant, il figerait la redirection dans les pages pré-générées');

// ── 11. L'AVATAR ET LES DEUX ROUTES DE SERVICE (lot 98) ────────────────────
console.log('\n11. L’avatar, la passerelle et la suppression');
const base_ = lire(join(RACINE, 'src/layouts/Base.astro'));

// ⚡ LOT 137 (A2 / OPT‑3) — CE BANC SUIT DÉSORMAIS LA CHAÎNE, PAS LE FICHIER.
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 Les scripts d'en-tête et d'avatar ont quitté `Base.astro` pour
// `src/socle/*.js` : ils sont servis par un fichier haché au lieu d'être
// recopiés sur 3 097 pages. Trois contrôles de ce banc les cherchaient dans
// `Base.astro` et ont rougi — ⭐⭐ **et ils avaient raison de rougir** : de leur
// point de vue, le code avait disparu.
// ⛔⛔ LA RÉPARATION N'EST PAS DE LES SUPPRIMER, NI DE LES ASSOUPLIR. Ce qu'ils
// protègent n'a pas changé d'un mot ; c'est leur ADRESSE qui a changé. On leur
// donne la vue complète — le gabarit ET le socle qu'il émet — ce qui est
// exactement ce que le navigateur reçoit.
// ⚠️ ET ON NE REMPLACE PAS `base_` PARTOUT, SURTOUT PAS. Les contrôles de
// POSITION (« la décision membre est prise dans le `<head>` », « le
// `<style is:inline>` est avant `</head>` ») n'ont de sens que dans le
// gabarit : un `indexOf('</head>')` sur une concaténation mesurerait une
// position qui n'existe nulle part. ⇒ deux variables, deux usages, et le
// commentaire qui dit lequel.
const socle_ = readdirSync(join(RACINE, 'src', 'socle'))
  .filter((f) => f.endsWith('.js')).sort()
  .map((f) => lire(join(RACINE, 'src', 'socle', f))).join('\n');
// ⭐ Auto-contrôle : un socle vide rendrait les trois contrôles ci-dessous
// verts pour de mauvaises raisons — ils cherchent une chaîne dans un texte, et
// un texte absent ne contredit rien. *Un banc branché sur du vide rend tous
// ses verdicts sur du vide.*
dit(socle_.length > 2000, 'le socle JS a bien été lu — sinon les contrôles qui suivent jugent du vide',
  `src/socle/ n'a rendu que ${socle_.length} caractère(s)`);
const baseEtSocle = base_ + '\n' + socle_;

// ⭐⭐ LE MÊME EN-TÊTE PARTOUT, ET C'ÉTAIT LE VRAI DÉFAUT. L'avatar est rendu
// sur TOUTES les pages, masqué par défaut : le HTML servi reste identique pour
// tout le monde (donc cachable, indexable, rapide), et c'est le navigateur qui
// découvre s'il faut le montrer. Une condition `aUneSession` seule aurait
// produit deux en-têtes différents selon le mode de rendu — exactement ce que
// Preda a vu sur /compte/.
dit(/<details class="globe" data-membre hidden=\{!aUneSession\}>/.test(base_),
  'l’avatar est rendu partout, masqué tant qu’on ne sait pas',
  'un avatar rendu SEULEMENT si connecté ferait deux en-têtes différents');
dit(/av\.hidden = !membre/.test(baseEtSocle), 'le script révèle l’avatar sur les pages pré-générées');
dit((base_.match(/data-anonyme/g) || []).length >= 3,
  'le globe ET l’appel à l’inscription portent data-anonyme',
  'sans ça, un membre garde le sélecteur de langue dans l’en-tête — deux commandes pour un réglage');
dit(/action="\/api\/deconnexion"/.test(base_) && /method="POST"/.test(base_),
  'la déconnexion du menu est un POST',
  'un GET destructeur part tout seul dans un <img> et les préchargeurs le suivent');
// ⛔ LE SURVOL NE DOIT PAS ÊTRE LE SEUL MOYEN D'OUVRIR. `<details>` s'ouvre au
// clic et au clavier sans JavaScript ; un menu qui n'existe qu'au survol
// n'existe pas sur un téléphone.
dit(/mouseenter/.test(baseEtSocle) && /<details class="globe" data-membre/.test(baseEtSocle),
  'le survol est un confort POSÉ SUR un <details> qui s’ouvre au clic');

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LE CLIGNOTEMENT — lot 100. Un banc, parce qu'un commentaire ne s'exécute pas.
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CE QUI SE RÉPARE ICI N'EST PAS UNE LIGNE, C'EST UN ORDRE. La décision
// « membre ou pas » doit être prise dans le `<head>` — avant la première
// peinture — et l'AFFICHAGE réglé par du CSS. Prise en bas du `<body>`, elle
// est juste, elle arrive simplement trop tard : le navigateur a déjà montré la
// version visiteur. ⛔ Aucun `defer`, `async` ni ordre de balises n'y change
// rien : un script qui touche le DOM ne peut pas s'exécuter avant qu'il existe.
// ⚠️ Un banc qui vérifierait seulement « le script existe » serait vert
//    aujourd'hui ET le jour où quelqu'un le redescendra en bas du corps.
//    Celui-ci mesure la POSITION.
const iHead = base_.indexOf('</head>');
const iCookieHead = base_.indexOf("setAttribute('data-membre'");
dit(iCookieHead > 0 && iHead > 0 && iCookieHead < iHead,
  'la décision « membre » est prise dans le <head>',
  'plus bas, le navigateur peint « Inscription » avant de la corriger — le clignotement vu en prod');
dit(/html\[data-membre\] \[data-anonyme\]\s*\{\s*display:\s*none/.test(base_),
  'et c\'est le CSS qui masque, pas le script',
  'un script qui corrige après coup ne peut pas être plus rapide que la première peinture');
dit(base_.indexOf('<style is:inline>') < iHead,
  'les deux règles sont EN LIGNE dans le <head>, pas dans le thème',
  'une feuille externe arrive parfois après la peinture ⇒ un clignotement intermittent, pire qu’un permanent');
// ⭐ Et le script du bas ne doit PLUS relire le cookie : deux sources de
// vérité pour la même question finissent par se contredire.
dit(/hasAttribute\('data-membre'\)/.test(baseEtSocle),
  'le script du bas relit l’ATTRIBUT, pas le cookie',
  'deux lectures du même fait divergent le jour où un autre onglet efface le cookie');

for (const r of ['pages/api/veveid.js', 'pages/api/supprimer.js'])
  dit(routes.includes(`'${r}'`), `${r} est déclarée dans ROUTES_COMPTE`,
    routes.includes(`'${r}'`) ? '' : 'elle serait PRÉ-GÉNÉRÉE en silence : un fichier figé, incapable de lire un cookie');

const vid = lire(join(RACINE, 'src/pages/api/veveid.js'));
// 🔴 UNE REDIRECTION VERS UNE ADRESSE RENDUE PAR UN TIERS EST UNE REDIRECTION
// OUVERTE tant qu'on ne vérifie pas d'où elle vient — et elle porterait NOTRE
// domaine dans la barre d'adresse de départ.
dit(/j\.url\.startsWith\(base\)/.test(vid), 'on ne redirige que vers une adresse fabriquée par veveid');
dit(/export const GET = \(\) => new Response/.test(vid), '/api/veveid refuse le GET',
  'un préchargeur de liens brûlerait un jeton à usage unique sans que personne ait cliqué');

const sup = lire(join(RACINE, 'src/pages/api/supprimer.js'));
dit(/cookies\.delete\('vp_session'/.test(sup) && /cookies\.delete\('vp_membre'/.test(sup),
  'la suppression efface LES DEUX cookies',
  'laisser vp_membre afficherait un avatar « connecté » à qui vient de supprimer son compte');
const supP = attributs(sup, 'delete', 'vp_session');
const supM = attributs(sup, 'delete', 'vp_membre');
dit(supP === aPose, 'vp_session : mêmes attributs qu’à la pose', `${supP} contre ${aPose}`);
dit(supM === mPose, 'vp_membre : mêmes attributs qu’à la pose', `${supM} contre ${mPose}`);
// ⭐⭐ LA CONFIRMATION NE SE JUGE PAS ICI. Ce site connaît l'adresse du compte,
// il vient de l'afficher : un contrôle fait par celui qui détient déjà la
// réponse compare une chaîne à elle-même et ne prouve rien.
dit(!/confirmation\s*===|confirmation\s*!==/.test(sup),
  'la confirmation est JUGÉE par veveid, pas par ce site');

const cpt2 = lire(join(RACINE, 'src/pages/compte/index.astro'));
dit(!/const MODULES =/.test(cpt2), 'la liste des modules a quitté /compte/ (Preda, 06/08)');
dit(/\/api\/session\?sid=/.test(cpt2), '/compte/ lit l’état du compte chez veveid, avec le sid',
  'un identifiant de compte porté par le site le laisserait DÉSIGNER n’importe quel compte');
dit(/x-service/.test(cpt2), 'et il porte le secret de service');
dit(/VeVe ID/.test(lire(join(RACINE, 'engine/i18n/fr.json'))),
  'la page nomme VeVe ID comme service indépendant (demande de Preda)');

// ── 6. AUTO-CONTRÔLE ───────────────────────────────────────────────────────
console.log('\n6. Auto-contrôle — ce banc a-t-il quelque chose à inspecter ?');
// ⭐ Un verdict rendu sur zéro élément n'a rien prouvé. Si `sources` était
// vide (chemin changé, dossier renommé), tout ce qui précède serait vert.
dit(sources.length > 20, 'des sources ont bien été lues', `${sources.length} fichiers`);
dit(sources.some((f) => lire(f).includes('vp_session')),
  'le nom du cookie est bien celui qu’on croit', 'sinon on cherchait une chaîne qui n’existe plus');
dit(sources.some((f) => lire(f).includes('vp_membre')),
  'le cookie d’affichage porte bien le nom vp_membre (choix de Preda, 06/08)',
  'un banc qui cherche une chaîne absente rend tous ses verdicts sur du vide');

console.log(echecs === 0
  ? `\n✅ session : tout est vert (le circuit est fermé)\n`
  : `\n❌ session : ${echecs} contrôle(s) en échec\n`);
process.exit(echecs === 0 ? 0 : 1);
