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
