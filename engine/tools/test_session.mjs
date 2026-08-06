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
const attributs = (s, verbe, nom) => {
  const m = s.match(new RegExp(`cookies\\.${verbe}\\(\\s*['"]${nom}['"][^)]*?\\{([^}]*)\\}`, 's'));
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
for (const f of ['src/pages/inscription/index.astro', 'src/pages/connexion/index.astro']) {
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
// ⭐⭐ « QUI ÉCRIT, QUI LIT ? » — appliqué au drapeau de rendu. La page décide
// de se fermer d'après `locals.rendu` ; si personne ne le POSE, la condition
// est éternellement fausse et la page reste ouverte. Vert des deux côtés,
// inerte au milieu : exactement la panne de `vp_session`.
dit(/locals\.rendu\s*=\s*'demande'/.test(mw), 'le middleware POSE locals.rendu',
  'sans lui, la fermeture de /compte/ ne se déclenche jamais');
dit(/locals\?\.rendu === 'demande'/.test(cpt), '/compte/ LIT locals.rendu');
dit(/Astro\.redirect\('\/connexion\/'/.test(cpt), '/compte/ redirige l’anonyme vers /connexion/',
  'une page de compte servie à quelqu’un sans session est une page publique');
dit(/!connecte && !enDemo/.test(cpt), 'le jeton de démonstration garde son accès',
  'sinon la démo s’enferme : le bouton pour en sortir vit sur cette page');
dit(/\{reglagesIci && connecte &&/.test(cpt), 'les réglages sont réservés aux membres (Preda, 06/08)');
dit(/<Base noindex/.test(cpt), '/compte/ est en noindex');
// ⚠️ Le drapeau est posé APRÈS la sortie sur `isPrerendered`, et cet ordre EST
// le contrôle : posé avant, il vaudrait « demande » sur les 8 500 fichiers, et
// /compte/ deviendrait une redirection figée dans le build — pour tout le
// monde, abonnés compris.
const iPre = mw.indexOf('isPrerendered) return next()');
const iFlag = mw.indexOf("locals.rendu = 'demande'");
dit(iPre >= 0 && iFlag > iPre, 'le drapeau est posé APRÈS la sortie sur isPrerendered',
  'posé avant, il figerait la redirection dans les pages pré-générées');

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
